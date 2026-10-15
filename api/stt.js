// Server speech-to-text via Magica ai_transcription, for browsers without
// SpeechRecognition (Safari, Firefox). MAGICA_KEY stays server-side.

const MAGICA_API = "https://api.magica.com/api/v1";
const MAGICA_UPLOAD = "https://inference.magica.com/v1/uploads";

// Vercel rejects request bodies over 4.5MB, so the cap sits just under it.
const MAX_AUDIO_BYTES = 4 * 1024 * 1024;
const MAX_AUDIO_SECONDS = 60;
const POLL_INTERVAL_MS = 1500;
const POLL_ATTEMPTS = 30;
// Vercel maxDuration is 60s; answer with a controlled 504 before it kills the function.
const DEADLINE_MS = 50000;

const AUDIO_TYPES = new Set([
  "audio/webm",
  "audio/ogg",
  "audio/mp4",
  "audio/m4a",
  "audio/x-m4a",
  "audio/mpeg",
  "audio/mp3",
  "audio/wav",
  "audio/x-wav",
  "audio/aac",
]);

class SttError extends Error {
  constructor(message, status = 502) {
    super(message);
    this.status = status;
  }
}

function baseContentType(header) {
  return String(header || "").split(";")[0].trim().toLowerCase();
}

function extensionFor(contentType) {
  const sub = contentType.split("/")[1] || "webm";
  return { mpeg: "mp3", "x-m4a": "m4a", "x-wav": "wav" }[sub] || sub;
}

// Returns { ok: true, contentType } or { ok: false, status, error }.
function validateAudio(body, contentTypeHeader) {
  const contentType = baseContentType(contentTypeHeader);
  if (!AUDIO_TYPES.has(contentType)) {
    return { ok: false, status: 415, error: "Unsupported audio type" };
  }
  if (!Buffer.isBuffer(body) || body.length === 0) {
    return { ok: false, status: 400, error: "Audio is required" };
  }
  if (body.length > MAX_AUDIO_BYTES) {
    return { ok: false, status: 413, error: "Audio too large (max 4MB)" };
  }
  return { ok: true, contentType };
}

async function transcribeAudio({
  body,
  contentType,
  language,
  apiKey,
  fetchImpl,
  sleep = (ms) => new Promise((r) => setTimeout(r, ms)),
  deadlineMs = DEADLINE_MS,
}) {
  const controller = new AbortController();
  const { signal } = controller;
  const timer = setTimeout(() => controller.abort(), deadlineMs);
  const aborted = new Promise((_, reject) => {
    signal.addEventListener("abort", () => reject(new SttError("Transcription timed out", 504)));
  });
  aborted.catch(() => {}); // avoid unhandled rejection when nothing is racing it

  const guard = (promise) => Promise.race([promise, aborted]);
  const auth = { Authorization: `Bearer ${apiKey}` };
  const call = (url, init) => guard(fetchImpl(url, { ...init, signal }));

  try {
    const uploadRes = await call(MAGICA_UPLOAD, {
      method: "POST",
      headers: { ...auth, "Content-Type": "application/json" },
      body: JSON.stringify({
        base64: body.toString("base64"),
        content_type: contentType,
        media_type: "audio",
        filename: `speech.${extensionFor(contentType)}`,
      }),
    });
    if (!uploadRes.ok) throw new SttError("Audio upload failed");
    const upload = await guard(uploadRes.json());
    if (!upload?.url) throw new SttError("Audio upload failed");

    const duration = upload.metadata?.duration;
    // Fail closed: unknown duration could be a long low-bitrate file, billed per minute.
    if (typeof duration !== "number" || !Number.isFinite(duration)) {
      throw new SttError("Could not determine audio duration", 422);
    }
    if (duration > MAX_AUDIO_SECONDS + 1) {
      throw new SttError(`Audio too long (max ${MAX_AUDIO_SECONDS}s)`, 413);
    }

    const input = {
      inputMode: "upload",
      audioUrl: [upload.url],
      output_format: "text",
      diarize: false,
    };
    if (language) input.language = language;

    const startRes = await call(`${MAGICA_API}/nodes/ai_transcription/run`, {
      method: "POST",
      headers: { ...auth, "Content-Type": "application/json" },
      body: JSON.stringify({ input }),
    });
    if (!startRes.ok) throw new SttError("Transcription failed to start");
    const { runId } = await guard(startRes.json());
    if (!runId) throw new SttError("Transcription failed to start");

    for (let i = 0; i < POLL_ATTEMPTS; i++) {
      const pollRes = await call(`${MAGICA_API}/nodes/runs/${runId}`, { headers: auth });
      const run = await guard(pollRes.json());
      if (!["RUNNING", "PENDING", "QUEUED"].includes(run.status)) {
        const text = run?.output?.result;
        if (run.status === "COMPLETED" && typeof text === "string") return text.trim();
        throw new SttError("Transcription failed");
      }
      await guard(sleep(POLL_INTERVAL_MS));
    }
    throw new SttError("Transcription timed out", 504);
  } catch (err) {
    if (err instanceof SttError) throw err;
    if (signal.aborted) throw new SttError("Transcription timed out", 504);
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

module.exports = {
  validateAudio,
  transcribeAudio,
  SttError,
  MAX_AUDIO_BYTES,
  MAX_AUDIO_SECONDS,
  DEADLINE_MS,
  AUDIO_TYPES,
};
