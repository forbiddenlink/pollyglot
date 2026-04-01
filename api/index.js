require("dotenv").config();
const express = require("express");
const { getLangfuse, flushLangfuse } = require("../lib/langfuse");
const { captureEvent } = require("../lib/posthog");
const { sendTranslationEmail } = require("../lib/email");

const app = express();
const port = Number.parseInt(process.env.PORT, 10) || 3000;
const OPENAI_TIMEOUT_MS =
  Number.parseInt(process.env.OPENAI_TIMEOUT_MS, 10) || 30000;

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
const allowedOrigins = new Set(
  configuredAllowedOrigins.length > 0
    ? configuredAllowedOrigins
    : defaultAllowedOrigins,
);

// Middleware
app.use(express.json({ limit: "10mb" }));

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

// Rate limiting (simple in-memory implementation)
const requestCounts = new Map();
const RATE_LIMIT = 50; // requests per minute
const RATE_WINDOW = 60000; // 1 minute
const CLEANUP_INTERVAL = 300000; // 5 minutes

function getClientIp(req) {
  const forwardedFor = req.headers["x-forwarded-for"];
  if (typeof forwardedFor === "string" && forwardedFor.trim() !== "") {
    return forwardedFor.split(",")[0].trim();
  }
  return req.ip || req.connection.remoteAddress || "unknown";
}

function checkRateLimit(ip) {
  const now = Date.now();
  const userRequests = requestCounts.get(ip) || [];

  // Remove old requests outside the window
  const recentRequests = userRequests.filter(
    (time) => now - time < RATE_WINDOW,
  );

  if (recentRequests.length >= RATE_LIMIT) {
    return false;
  }

  recentRequests.push(now);
  requestCounts.set(ip, recentRequests);
  return true;
}

// Periodically clean up old rate limit entries to prevent memory leak
const cleanupTimer = setInterval(() => {
  const now = Date.now();
  for (const [ip, requests] of requestCounts.entries()) {
    const recentRequests = requests.filter((time) => now - time < RATE_WINDOW);
    if (recentRequests.length === 0) {
      requestCounts.delete(ip);
    } else {
      requestCounts.set(ip, recentRequests);
    }
  }
}, CLEANUP_INTERVAL);
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
    model: "gpt-4o-mini",
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
          model: "gpt-4o-mini",
          messages,
          temperature: options.temperature ?? 0.3,
          max_tokens: options.maxTokens ?? 500,
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
    if (!checkRateLimit(clientIp)) {
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
      return res.status(500).json({
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
      const errorMessage = data.error?.message || "Translation failed";
      console.error("OpenAI API error:", errorMessage);

      if (response.status === 401) {
        return res.status(500).json({
          error: "Translation service authentication failed",
        });
      } else if (response.status === 429) {
        return res.status(429).json({
          error: "Translation service is busy. Please try again in a moment.",
        });
      }

      return res.status(500).json({ error: errorMessage });
    }

    const translation = extractAssistantContent(data);
    if (!translation) {
      return res.status(502).json({ error: "Translation response was empty" });
    }

    captureEvent("translation_completed", {
      sessionId: clientIp,
      sourceLanguage: validation.sourceLanguage,
      targetLanguage: validation.targetLanguage,
      formality,
      textLength: validation.text.length,
    });

    // Send translation result email if requested
    if (req.body?.emailAddress) {
      try {
        await sendTranslationEmail({
          to: req.body.emailAddress,
          targetLanguage: validation.targetLanguage,
          translatedContent: translation,
        });
      } catch (emailError) {
        console.warn("Email notification failed:", emailError.message);
      }
    }

    res.json({ translation });
  } catch (error) {
    if (error.name === "AbortError") {
      return res.status(504).json({
        error: "Translation request timed out. Please try again.",
      });
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
    if (!checkRateLimit(clientIp)) {
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
      return res.status(500).json({
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
      const errorMessage = data.error?.message || "Language detection failed";
      console.error("OpenAI API error:", errorMessage);
      return res.status(500).json({ error: errorMessage });
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

    if (!checkRateLimit(clientIp)) {
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
      return res.status(500).json({
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
      return res.status(500).json({
        error: data.error?.message || "Failed to get pronunciation",
      });
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
    console.error("Pronunciation error:", error);
    res.status(500).json({ error: "Failed to get pronunciation guide" });
  }
});

// Alternative translations endpoint (for short phrases)
app.post("/alternatives", async (req, res) => {
  try {
    const clientIp = getClientIp(req);

    if (!checkRateLimit(clientIp)) {
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
      return res.status(500).json({
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
      return res.status(500).json({
        error: data.error?.message || "Failed to get alternatives",
      });
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
    console.error("Alternatives error:", error);
    res.status(500).json({ error: "Failed to get alternative translations" });
  }
});

// Health check endpoint
app.get("/health", (req, res) => {
  res.json({
    status: "ok",
    timestamp: new Date().toISOString(),
    hasApiKey: !!process.env.OPENAI_API_KEY,
    supportedLanguages: Object.keys(SUPPORTED_LANGUAGES).length,
  });
});

// TTS endpoint — MiniMax speech-02-hd with OpenAI TTS fallback
app.post("/tts", async (req, res) => {
  try {
    const { text, language } = req.body;

    if (!text || typeof text !== "string" || !text.trim()) {
      return res.status(400).json({ error: "Text is required" });
    }
    if (text.trim().length > 1000) {
      return res
        .status(400)
        .json({ error: "Text too long (max 1000 characters)" });
    }

    // MiniMax TTS (preferred — native multilingual)
    if (process.env.MINIMAX_API_KEY) {
      const minimaxRes = await fetchImpl("https://api.minimax.chat/v1/t2a_v2", {
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
      });

      if (minimaxRes.ok) {
        const minimaxData = await minimaxRes.json();
        const hexAudio = minimaxData?.data?.audio;
        if (hexAudio) {
          const audioBuffer = Buffer.from(hexAudio, "hex");
          res.set("Content-Type", "audio/mpeg");
          return res.send(audioBuffer);
        }
      }
      // Fall through to OpenAI TTS if MiniMax fails
    }

    // OpenAI TTS fallback
    if (!process.env.OPENAI_API_KEY) {
      return res.status(500).json({ error: "TTS service not configured" });
    }

    const langCode = language || "en";
    const voice = ["zh", "ja", "ko", "ar", "hi", "th"].includes(langCode)
      ? "nova"
      : "alloy";

    const ttsRes = await fetchImpl("https://api.openai.com/v1/audio/speech", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: "tts-1",
        input: text.trim(),
        voice,
        response_format: "mp3",
      }),
    });

    if (!ttsRes.ok) {
      const errData = await ttsRes.json().catch(() => ({}));
      return res
        .status(502)
        .json({ error: errData.error?.message || "TTS failed" });
    }

    res.set("Content-Type", "audio/mpeg");
    const audioBuffer = Buffer.from(await ttsRes.arrayBuffer());
    return res.send(audioBuffer);
  } catch (error) {
    console.error("TTS error:", error);
    res.status(500).json({ error: "An unexpected error occurred" });
  }
});

// Error handling middleware
app.use((err, req, res, next) => {
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
