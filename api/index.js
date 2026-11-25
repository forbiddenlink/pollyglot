require("dotenv").config();
const express = require("express");
const { getLangfuse, flushLangfuse } = require("./_lib/langfuse");
const { anonymizeIp, captureEvent } = require("./_lib/posthog");
const { createRateLimiter, RateLimitUnavailableError } = require("./ratelimit");
const {
  validateAudio,
  transcribeAudio,
  SttError,
  MAX_AUDIO_BYTES,
} = require("./stt");
const { runToCompletion } = require("./_lib/spiral");
const { SYSTEM_PROMPT: TTS_SYSTEM_PROMPT, wrapForSpeech, maxAudioTokens, transcriptMatches } = require("./_lib/tts-guard");

const app = express();
if (process.env.SENTRY_DSN) {
  const Sentry = require("@sentry/node");
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    environment: "production",
    defaultIntegrations: false,
    skipOpenTelemetrySetup: true,
    sendDefaultPii: false,
    maxBreadcrumbs: 0,
  });
  app.use((req, res, next) => {
    res.once("finish", () => {
      if (res.statusCode < 500) return;
      // Express supplies the route template. Never include learner text or audio.
      const route = typeof req.route?.path === "string" ? req.route.path : "unknown route";
      Sentry.captureMessage(`HTTP ${res.statusCode} on ${route}`, "error");
      // Serverless functions can freeze once the response ends; drain the queue.
      Sentry.flush(2000).catch(() => {});
    });
    next();
  });
}
const port = Number.parseInt(process.env.PORT, 10) || 3000;
const OPENAI_TIMEOUT_MS =
  Number.parseInt(process.env.OPENAI_TIMEOUT_MS, 10) || 30000;
const OPENAI_CHAT_MODEL = "gpt-6-luna";

const SUPPORTED_LANGUAGES = Object.freeze({
  en: "English",
  es: "Spanish",
  fr: "French",
  de: "German",
  it: "Italian",
  pt: "Portuguese",
  ru: "Russian",
  zh: "Chinese",
  ja: "Japanese",
  ko: "Korean",
  ar: "Arabic",
  hi: "Hindi",
  nl: "Dutch",
  pl: "Polish",
  tr: "Turkish",
  vi: "Vietnamese",
  th: "Thai",
  sv: "Swedish",
  el: "Greek",
  he: "Hebrew",
});
const SUPPORTED_LANGUAGE_CODES = new Set(Object.keys(SUPPORTED_LANGUAGES));
const SUPPORTED_LANGUAGE_NAMES = new Map(
  Object.values(SUPPORTED_LANGUAGES).map((name) => [name.toLowerCase(), name]),
);

const fetchImpl = global.fetch
  ? (...args) => global.fetch(...args)
  : (...args) =>
      import("node-fetch").then(({ default: fetch }) => fetch(...args));

const defaultAllowedOrigins = [
  "http://localhost:3000",
  "http://127.0.0.1:3000",
  "http://localhost:4173",
  "http://127.0.0.1:4173",
];
const configuredAllowedOrigins = (process.env.ALLOWED_ORIGINS || "")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);
const allowedOrigins = new Set([
  ...(configuredAllowedOrigins.length > 0
    ? configuredAllowedOrigins
    : defaultAllowedOrigins),
  // The app's own deployed pages must reach its API, even with a custom allowlist.
  "https://pollyglot-topaz.vercel.app",
  "https://pollyglot-elizabeth-emersons-projects.vercel.app",
  "https://pollyglot-git-main-elizabeth-emersons-projects.vercel.app",
  ...[
    process.env.VERCEL_URL,
    process.env.VERCEL_BRANCH_URL,
    process.env.VERCEL_PROJECT_PRODUCTION_URL,
  ].filter(Boolean).map((hostname) => `https://${hostname}`),
]);

// Middleware
app.use((req, res, next) => {
  // Vercel preserves the function prefix; local development uses bare API paths.
  if (req.url.startsWith("/api/")) req.url = req.url.slice(4);
  next();
});
app.use(express.json({ limit: "64kb" }));

// CORS configuration
app.use((req, res, next) => {
  const requestOrigin = req.get("origin");

  if (requestOrigin) {
    if (!allowedOrigins.has(requestOrigin)) {
      if (req.method === "OPTIONS") {
        return res.status(403).json({ error: "Origin not allowed" });
      }
      return res.status(403).json({ error: "Origin not allowed" });
    }
    res.header("Access-Control-Allow-Origin", requestOrigin);
    res.header("Vary", "Origin");
  }
  res.header("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.header("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") {
    return res.sendStatus(204);
  }
  next();
});

// Rate limiting: durable via Upstash when configured, in-memory otherwise (see ratelimit.js)
const rateLimiter = createRateLimiter();
const CLEANUP_INTERVAL = 300000; // 5 minutes

function getClientIp(req) {
  const forwardedFor = req.headers["x-forwarded-for"];
  if (typeof forwardedFor === "string" && forwardedFor.trim() !== "") {
    return forwardedFor.split(",")[0].trim();
  }
  return req.ip || req.connection.remoteAddress || "unknown";
}

function checkRateLimit(ip, bucket = "default") {
  return rateLimiter.check(ip, bucket);
}

// Periodically clean up old in-memory entries to prevent memory leak
const cleanupTimer = setInterval(rateLimiter.cleanup, CLEANUP_INTERVAL);
cleanupTimer.unref?.();

function normalizeLanguage(input, { required = false } = {}) {
  if (input === null || input === undefined || input === "") {
    if (required) {
      return { valid: false, error: "Language is required" };
    }
    return { valid: true, code: null, name: null };
  }

  if (typeof input !== "string") {
    return { valid: false, error: "Language must be a string" };
  }

  const normalized = input.trim();
  if (!normalized) {
    if (required) {
      return { valid: false, error: "Language is required" };
    }
    return { valid: true, code: null, name: null };
  }

  const code = normalized.toLowerCase();
  if (SUPPORTED_LANGUAGE_CODES.has(code)) {
    return { valid: true, code, name: SUPPORTED_LANGUAGES[code] };
  }

  const name = SUPPORTED_LANGUAGE_NAMES.get(code);
  if (name) {
    const matchedCode = Object.keys(SUPPORTED_LANGUAGES).find(
      (langCode) => SUPPORTED_LANGUAGES[langCode] === name,
    );
    return { valid: true, code: matchedCode || null, name };
  }

  return { valid: false, error: `Unsupported language: ${normalized}` };
}

function parseJsonSafe(value) {
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

function extractAssistantContent(data) {
  return data?.choices?.[0]?.message?.content?.trim() || "";
}

async function callOpenAI(messages, options = {}) {
  const controller = new AbortController();
  const timeoutHandle = setTimeout(() => controller.abort(), OPENAI_TIMEOUT_MS);

  const langfuse = getLangfuse();
  const trace = options.traceName
    ? langfuse?.trace({
        name: options.traceName,
        metadata: options.traceMetadata,
      })
    : null;
  const generation = trace?.generation({
    name: options.traceName ?? "openai-call",
    model: OPENAI_CHAT_MODEL,
    input: messages,
  });

  try {
    const response = await fetchImpl(
      "https://api.openai.com/v1/chat/completions",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        },
        signal: controller.signal,
        body: JSON.stringify({
          model: OPENAI_CHAT_MODEL,
          messages,
          temperature: options.temperature ?? 0.3,
          reasoning_effort: "none",
          max_completion_tokens: options.maxTokens ?? 500,
        }),
      },
    );

    let data = {};
    try {
      data = await response.json();
    } catch {
      data = {};
    }

    const content = extractAssistantContent(data);
    generation?.end({
      output: { content },
      usage: {
        promptTokens: data.usage?.prompt_tokens,
        completionTokens: data.usage?.completion_tokens,
      },
    });
    flushLangfuse().catch(() => {});

    return { response, data };
  } finally {
    clearTimeout(timeoutHandle);
  }
}

// Input validation
function validateTranslationInput(text, sourceLang, targetLang, formality) {
  if (!text || typeof text !== "string") {
    return { valid: false, error: "Text is required" };
  }

  const trimmedText = text.trim();
  if (!trimmedText) {
    return { valid: false, error: "Text is required" };
  }

  if (trimmedText.length > 5000) {
    return { valid: false, error: "Text is too long (max 5000 characters)" };
  }

  const normalizedSource = normalizeLanguage(sourceLang, { required: false });
  if (!normalizedSource.valid) {
    return { valid: false, error: normalizedSource.error };
  }

  const normalizedTarget = normalizeLanguage(targetLang, { required: true });
  if (!normalizedTarget.valid) {
    return { valid: false, error: normalizedTarget.error };
  }

  if (
    normalizedSource.code &&
    normalizedSource.code === normalizedTarget.code
  ) {
    return {
      valid: false,
      error: "Source and target languages must be different",
    };
  }

  if (formality && !["neutral", "formal", "informal"].includes(formality)) {
    return { valid: false, error: "Invalid formality option" };
  }

  return {
    valid: true,
    text: trimmedText,
    sourceLanguage: normalizedSource.name,
    targetLanguage: normalizedTarget.name,
  };
}

// Translation endpoint
app.post("/translate", async (req, res) => {
  try {
    const clientIp = getClientIp(req);

    // Check rate limit
    if (!(await checkRateLimit(clientIp))) {
      return res.status(429).json({
        error: "Too many requests. Please try again later.",
      });
    }

    const { text, sourceLang, targetLang, formality } = req.body;

    // Validate input
    const validation = validateTranslationInput(
      text,
      sourceLang,
      targetLang,
      formality,
    );
    if (!validation.valid) {
      return res.status(400).json({ error: validation.error });
    }

    // Check API key
    if (!process.env.OPENAI_API_KEY) {
      console.error("OpenAI API key not configured");
      return res.status(503).json({
        error: "Translation service is not configured properly",
      });
    }

    // Build formality instruction
    let formalityInstruction = "";
    if (formality === "formal") {
      formalityInstruction =
        " Use formal, polite, and professional language appropriate for business or official contexts.";
    } else if (formality === "informal") {
      formalityInstruction =
        " Use casual, friendly, and conversational language as you would with friends.";
    }

    const systemPrompt = validation.sourceLanguage
      ? `You are a professional translator. Translate the following text from ${validation.sourceLanguage} to ${validation.targetLanguage}.${formalityInstruction} Provide ONLY the translation, with no additional explanations, quotes, or formatting.`
      : `You are a professional translator. Translate the following text to ${validation.targetLanguage}.${formalityInstruction} Provide ONLY the translation, with no additional explanations, quotes, or formatting.`;

    const { response, data } = await callOpenAI(
      [
        { role: "system", content: systemPrompt },
        { role: "user", content: validation.text },
      ],
      {
        temperature: 0.3,
        maxTokens: 2000,
        traceName: "translation",
        traceMetadata: { targetLang: validation.targetLanguage, formality },
      },
    );

    if (!response.ok) {
      console.error(
        "OpenAI API error:",
        data.error?.message || "Translation failed",
      );

      if (response.status === 401) {
        return res.status(500).json({
          error: "Translation service authentication failed",
        });
      } else if (response.status === 429) {
        return res.status(429).json({
          error: "Translation service is busy. Please try again in a moment.",
        });
      }

      return res.status(500).json({ error: "Translation failed. Please try again." });
    }

    const translation = extractAssistantContent(data);
    if (!translation) {
      return res.status(502).json({ error: "Translation response was empty" });
    }

    await captureEvent("translation_completed", {
      sessionId: anonymizeIp(clientIp),
      sourceLanguage: validation.sourceLanguage,
      targetLanguage: validation.targetLanguage,
      formality,
      textLength: validation.text.length,
    });

    res.json({ translation });
  } catch (error) {
    if (error.name === "AbortError") {
      return res.status(504).json({
        error: "Translation request timed out. Please try again.",
      });
    }
    if (error instanceof RateLimitUnavailableError) {
      return res.status(503).json({ error: "Service temporarily unavailable" });
    }
    console.error("Translation error:", error);
    res.status(500).json({
      error: "An unexpected error occurred. Please try again.",
    });
  }
});

// Language detection endpoint
app.post("/detect", async (req, res) => {
  try {
    const clientIp = getClientIp(req);

    // Check rate limit
    if (!(await checkRateLimit(clientIp))) {
      return res.status(429).json({
        error: "Too many requests. Please try again later.",
      });
    }

    const { text } = req.body;

    // Validate input
    if (!text || typeof text !== "string") {
      return res.status(400).json({ error: "Text is required" });
    }

    const trimmedText = text.trim();
    if (!trimmedText) {
      return res.status(400).json({ error: "Text is required" });
    }

    if (trimmedText.length > 1000) {
      return res.status(400).json({
        error: "Text is too long for detection (max 1000 characters)",
      });
    }

    // Check API key
    if (!process.env.OPENAI_API_KEY) {
      console.error("OpenAI API key not configured");
      return res.status(503).json({
        error: "Language detection service is not configured properly",
      });
    }

    const { response, data } = await callOpenAI(
      [
        {
          role: "system",
          content:
            "You are a language detection expert. Analyze the text and respond with ONLY the two-letter ISO 639-1 language code. Supported codes: en, es, fr, de, it, pt, ru, zh, ja, ko, ar, hi, nl, pl, tr, vi, th, sv, el, he.",
        },
        { role: "user", content: trimmedText },
      ],
      {
        temperature: 0.1,
        maxTokens: 10,
        traceName: "language-detection",
      },
    );

    if (!response.ok) {
      console.error(
        "OpenAI API error:",
        data.error?.message || "Language detection failed",
      );
      return res
        .status(500)
        .json({ error: "Language detection failed. Please try again." });
    }

    const detectedLanguage = extractAssistantContent(data).toLowerCase();
    const normalizedLanguage = SUPPORTED_LANGUAGE_CODES.has(detectedLanguage)
      ? detectedLanguage
      : "unknown";

    if (normalizedLanguage === "unknown") {
      return res.json({
        detectedLanguage: normalizedLanguage,
        warning: "Could not confidently detect a supported language",
      });
    }

    res.json({ detectedLanguage: normalizedLanguage });
  } catch (error) {
    if (error.name === "AbortError") {
      return res.status(504).json({
        error: "Language detection timed out. Please try again.",
      });
    }
    if (error instanceof RateLimitUnavailableError) {
      return res.status(503).json({ error: "Service temporarily unavailable" });
    }
    console.error("Language detection error:", error);
    res.status(500).json({
      error: "An unexpected error occurred during language detection.",
    });
  }
});

// Pronunciation guide endpoint
app.post("/pronunciation", async (req, res) => {
  try {
    const clientIp = getClientIp(req);

    if (!(await checkRateLimit(clientIp))) {
      return res.status(429).json({
        error: "Too many requests. Please try again later.",
      });
    }

    const { text, targetLang } = req.body;

    if (!text || typeof text !== "string") {
      return res.status(400).json({
        error: "Text is required",
      });
    }

    const trimmedText = text.trim();
    if (!trimmedText || trimmedText.length > 500) {
      return res.status(400).json({
        error: "Text must be under 500 characters",
      });
    }

    const normalizedTarget = normalizeLanguage(targetLang, { required: true });
    if (!normalizedTarget.valid) {
      return res.status(400).json({
        error: normalizedTarget.error,
      });
    }

    if (!process.env.OPENAI_API_KEY) {
      return res.status(503).json({
        error: "Service not configured",
      });
    }

    const { response, data } = await callOpenAI(
      [
        {
          role: "system",
          content: `Provide a phonetic pronunciation guide for the ${normalizedTarget.name} text. Use simple English phonetics that an English speaker can read aloud. Return ONLY the phonetic spelling, nothing else.`,
        },
        { role: "user", content: trimmedText },
      ],
      {
        temperature: 0.3,
        maxTokens: 300,
        traceName: "pronunciation",
        traceMetadata: { targetLang: normalizedTarget.name },
      },
    );

    if (!response.ok) {
      console.error(
        "OpenAI API error:",
        data.error?.message || "Failed to get pronunciation",
      );
      return res.status(500).json({ error: "Failed to get pronunciation guide" });
    }

    const phonetic = extractAssistantContent(data);
    if (!phonetic) {
      return res.status(502).json({
        error: "Pronunciation response was empty",
      });
    }

    res.json({ phonetic });
  } catch (error) {
    if (error.name === "AbortError") {
      return res.status(504).json({
        error: "Pronunciation request timed out. Please try again.",
      });
    }
    if (error instanceof RateLimitUnavailableError) {
      return res.status(503).json({ error: "Service temporarily unavailable" });
    }
    console.error("Pronunciation error:", error);
    res.status(500).json({ error: "Failed to get pronunciation guide" });
  }
});

// Alternative translations endpoint (for short phrases)
app.post("/alternatives", async (req, res) => {
  try {
    const clientIp = getClientIp(req);

    if (!(await checkRateLimit(clientIp))) {
      return res.status(429).json({
        error: "Too many requests. Please try again later.",
      });
    }

    const { text, sourceLang, targetLang } = req.body;

    if (!text || typeof text !== "string") {
      return res.status(400).json({
        error: "Text is required",
      });
    }

    const trimmedText = text.trim();
    if (!trimmedText || trimmedText.length > 200) {
      return res.status(400).json({
        error: "Text must be under 200 characters for alternatives",
      });
    }

    const normalizedSource = normalizeLanguage(sourceLang, { required: false });
    if (!normalizedSource.valid) {
      return res.status(400).json({
        error: normalizedSource.error,
      });
    }

    const normalizedTarget = normalizeLanguage(targetLang, { required: true });
    if (!normalizedTarget.valid) {
      return res.status(400).json({
        error: normalizedTarget.error,
      });
    }

    if (!process.env.OPENAI_API_KEY) {
      return res.status(503).json({
        error: "Translation service is not configured properly",
      });
    }

    const sourceInfo = normalizedSource.name
      ? `from ${normalizedSource.name} `
      : "";
    const prompt = `Translate the following text ${sourceInfo}to ${normalizedTarget.name}. Provide exactly 3 alternative translations that convey the same meaning but with different wording or formality levels. Return ONLY a JSON array with 3 strings, no explanation. Example format: ["translation 1", "translation 2", "translation 3"]`;

    const { response, data } = await callOpenAI(
      [
        { role: "system", content: prompt },
        { role: "user", content: trimmedText },
      ],
      {
        temperature: 0.7,
        maxTokens: 500,
        traceName: "translation-alternatives",
        traceMetadata: { targetLang: normalizedTarget.name },
      },
    );

    if (!response.ok) {
      console.error(
        "OpenAI API error:",
        data.error?.message || "Failed to get alternatives",
      );
      return res
        .status(500)
        .json({ error: "Failed to get alternative translations" });
    }

    try {
      const content = extractAssistantContent(data);
      const alternatives = parseJsonSafe(content);

      if (!Array.isArray(alternatives)) {
        return res.json({ alternatives: [] });
      }

      const sanitized = alternatives
        .filter((entry) => typeof entry === "string")
        .map((entry) => entry.trim())
        .filter(Boolean)
        .slice(0, 3);

      return res.json({ alternatives: sanitized });
    } catch {
      res.json({ alternatives: [] });
    }
  } catch (error) {
    if (error.name === "AbortError") {
      return res.status(504).json({
        error: "Alternatives request timed out. Please try again.",
      });
    }
    if (error instanceof RateLimitUnavailableError) {
      return res.status(503).json({ error: "Service temporarily unavailable" });
    }
    console.error("Alternatives error:", error);
    res.status(500).json({ error: "Failed to get alternative translations" });
  }
});

// Health check endpoint
app.get("/health", (req, res) => {
  const configured = !!process.env.OPENAI_API_KEY;
  res.status(configured ? 200 : 503).json({
    status: configured ? "ok" : "unconfigured",
    timestamp: new Date().toISOString(),
    supportedLanguages: Object.keys(SUPPORTED_LANGUAGES).length,
  });
});

// The whole /tts provider chain must finish before vercel.json maxDuration (60s),
// so each outbound call carries a deadline derived from one shared budget.
function getTtsDeadlineMs() {
  return Number.parseInt(process.env.TTS_DEADLINE_MS, 10) || 50000;
}

function ttsFetch(url, init, { deadlineAt, capMs = Infinity }) {
  const remaining = Math.min(deadlineAt - Date.now(), capMs);
  if (remaining <= 0) {
    const err = new Error("TTS deadline exceeded");
    err.name = "TimeoutError";
    throw err;
  }
  return fetchImpl(url, { ...init, signal: AbortSignal.timeout(remaining) });
}

function isTimeoutError(error) {
  return error?.name === "TimeoutError" || error?.name === "AbortError";
}

// TTS endpoint: Spiral (ElevenLabs), then MiniMax speech-02-hd, then OpenAI audio output (gpt-audio-1.5)
app.post("/tts", async (req, res) => {
  try {
    if (!(await checkRateLimit(getClientIp(req), "tts"))) {
      return res.status(429).json({
        error: "Too many requests. Please try again later.",
      });
    }

    const { text, language } = req.body;

    if (!text || typeof text !== "string" || !text.trim()) {
      return res.status(400).json({ error: "Text is required" });
    }
    if (text.trim().length > 1000) {
      return res
        .status(400)
        .json({ error: "Text too long (max 1000 characters)" });
    }

    const budgetMs = getTtsDeadlineMs();
    const deadlineAt = Date.now() + budgetMs;
    // Spiral may use half the budget (it long-polls), MiniMax a fifth; OpenAI gets what is left.
    const spiralDeadline = { deadlineAt: Math.min(deadlineAt, Date.now() + budgetMs * 0.5) };

    // Spiral TTS (preferred when configured: ElevenLabs multilingual v2).
    // Inert unless SPIRAL_API_KEY is set; falls through to MiniMax/OpenAI on any failure.
    if (process.env.SPIRAL_API_KEY) {
      try {
        const call = (url, init) => ttsFetch(url, init, spiralDeadline);
        const run = await runToCompletion({
          apiKey: process.env.SPIRAL_API_KEY,
          provider: "elevenlabs",
          model: "eleven_multilingual_v2",
          input: {
            text: text.trim(),
            voice_id: "21m00Tcm4TlvDq8ikWAM",
            output_format: "mp3_44100_128",
          },
          call,
          remainingMs: () => spiralDeadline.deadlineAt - Date.now(),
        });
        const url = run.output?.items?.find((i) => i.type === "audio" && i.url)?.url;
        if (url) {
          const audioRes = await call(url, {});
          if (audioRes.ok) {
            const audioBuffer = Buffer.from(await audioRes.arrayBuffer());
            res.set("Content-Type", "audio/mpeg");
            return res.send(audioBuffer);
          }
        }
      } catch (err) {
        console.error("Spiral TTS failed, falling back:", err.message);
      }
    }

    // MiniMax TTS (preferred — native multilingual)
    if (process.env.MINIMAX_API_KEY) {
      try {
        const minimaxRes = await ttsFetch(
          "https://api.minimax.io/v1/t2a_v2",
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${process.env.MINIMAX_API_KEY}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              model: "speech-02-hd",
              text: text.trim(),
              stream: false,
              voice_setting: { voice_id: "Calm_Woman", speed: 1.0, vol: 1.0 },
              audio_setting: { format: "mp3", sample_rate: 32000 },
            }),
          },
          { deadlineAt, capMs: budgetMs * 0.2 },
        );

        if (minimaxRes.ok) {
          const minimaxData = await minimaxRes.json();
          const hexAudio = minimaxData?.data?.audio;
          if (hexAudio) {
            const audioBuffer = Buffer.from(hexAudio, "hex");
            res.set("Content-Type", "audio/mpeg");
            return res.send(audioBuffer);
          }
        }
      } catch (err) {
        console.error("MiniMax TTS failed, falling back:", err.message);
      }
      // Fall through to OpenAI TTS if MiniMax fails
    }

    // OpenAI TTS fallback
    if (!process.env.OPENAI_API_KEY) {
      return res.status(503).json({ error: "TTS service not configured" });
    }

    const langCode = language || "en";
    const voice = ["zh", "ja", "ko", "ar", "hi", "th"].includes(langCode)
      ? "coral"
      : "alloy";

    // tts-1 shuts down 2027-01-06 and its replacement (gpt-realtime-2.1-mini) is not
    // served on /v1/audio/speech, so use Chat Completions audio output instead.
    const ttsRes = await ttsFetch(
      "https://api.openai.com/v1/chat/completions",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        },
        body: JSON.stringify({
          model: "gpt-audio-1.5",
          modalities: ["text", "audio"],
          audio: { voice, format: "mp3" },
          max_completion_tokens: maxAudioTokens(text.trim().length),
          messages: [
            { role: "system", content: TTS_SYSTEM_PROMPT },
            { role: "user", content: wrapForSpeech(text.trim()) },
          ],
        }),
      },
      { deadlineAt },
    );

    if (!ttsRes.ok) {
      const errData = await ttsRes.json().catch(() => ({}));
      console.error("OpenAI TTS error:", errData.error?.message || "TTS failed");
      return res.status(502).json({ error: "Speech generation failed. Please try again." });
    }

    const ttsData = await ttsRes.json().catch(() => ({}));
    const b64Audio = ttsData?.choices?.[0]?.message?.audio?.data;
    if (!b64Audio || !transcriptMatches(text, ttsData.choices[0].message.audio.transcript)) {
      console.error(
        b64Audio ? "OpenAI TTS rejected: transcript diverges from input" : "OpenAI TTS error: no audio in response",
      );
      return res.status(502).json({ error: "Speech generation failed. Please try again." });
    }
    res.set("Content-Type", "audio/mpeg");
    return res.send(Buffer.from(b64Audio, "base64"));
  } catch (error) {
    if (error instanceof RateLimitUnavailableError) {
      return res.status(503).json({ error: "Service temporarily unavailable" });
    }
    if (isTimeoutError(error)) {
      return res.status(504).json({ error: "Speech took too long. Please try again." });
    }
    console.error("TTS error:", error);
    res.status(500).json({ error: "An unexpected error occurred" });
  }
});

// Speech-to-text endpoint — raw audio body, for browsers without SpeechRecognition
app.post(
  "/transcribe",
  express.raw({ type: "audio/*", limit: MAX_AUDIO_BYTES }),
  async (req, res) => {
    try {
      if (!(await checkRateLimit(getClientIp(req), "stt"))) {
        return res.status(429).json({
          error: "Too many requests. Please try again later.",
        });
      }
      if (!process.env.SPIRAL_API_KEY) {
        return res.status(503).json({ error: "Transcription not configured" });
      }

      const checked = validateAudio(req.body, req.get("content-type"));
      if (!checked.ok) {
        return res.status(checked.status).json({ error: checked.error });
      }

      const lang = normalizeLanguage(req.query.lang);
      const text = await transcribeAudio({
        body: req.body,
        contentType: checked.contentType,
        language: lang.valid ? lang.code : null,
        apiKey: process.env.SPIRAL_API_KEY,
        fetchImpl,
      });
      return res.json({ text });
    } catch (error) {
      if (error instanceof SttError) {
        return res.status(error.status).json({ error: error.message });
      }
      if (error instanceof RateLimitUnavailableError) {
        return res.status(503).json({ error: "Service temporarily unavailable" });
      }
      console.error("Transcribe error:", error.message);
      res.status(500).json({ error: "An unexpected error occurred" });
    }
  },
);

// Error handling middleware
app.use((err, req, res, next) => {
  if (err?.type === "entity.parse.failed") {
    return res.status(400).json({ error: "Invalid JSON" });
  }
  if (err?.type === "entity.too.large") {
    return res.status(413).json({ error: "Request body too large" });
  }
  console.error("Unhandled error:", err);
  res.status(500).json({
    error: "An unexpected error occurred",
  });
});

// Start server (only in development)
if (process.env.NODE_ENV !== "production") {
  app.listen(port, () => {
    console.log(`🦜 PollyGlot server running at http://localhost:${port}`);
    console.log(
      `📡 API Key configured: ${process.env.OPENAI_API_KEY ? "Yes" : "No"}`,
    );
    if (!process.env.OPENAI_API_KEY) {
      console.warn(
        "⚠️  Warning: OPENAI_API_KEY not found in environment variables",
      );
    }
  });
}

// Export for Vercel
module.exports = app;
