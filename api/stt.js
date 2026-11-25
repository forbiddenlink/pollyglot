// Server speech-to-text via Spiral (AssemblyAI universal-2), for browsers without
// SpeechRecognition (Safari, Firefox). SPIRAL_API_KEY stays server-side.

const { uploadFile, runToCompletion, SpiralError } = require("./_lib/spiral");

// Vercel rejects request bodies over 4.5MB, so the cap sits just under it.
const MAX_AUDIO_BYTES = 4 * 1024 * 1024;
const MAX_AUDIO_SECONDS = 60;
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
  if (!Buffer.isBuffer(body)) {
    return { ok: false, status: 400, error: "Audio is required" };
  }
  const size = Buffer.byteLength(body);
  if (size === 0) {
    return { ok: false, status: 400, error: "Audio is required" };
  }
  if (size > MAX_AUDIO_BYTES) {
    return { ok: false, status: 413, error: "Audio too large (max 4MB)" };
  }
  return { ok: true, contentType };
}

// Pulls the transcript out of a completed run. universal-2 returns the transcript object
// as a json item: inline in `data`, or behind `url` when it is too large to inline.
async function extractText(run, call) {
  for (const item of run?.output?.items || []) {
    if (item.type !== "json" && item.type !== "text") continue;
    let payload = item.data;
    if (payload === undefined && item.url) {
      const res = await call(item.url, {});
      if (!res.ok) continue;
      payload = item.type === "text" ? await res.text() : await res.json();
    }
    if (typeof payload === "string") return payload.trim();
    if (typeof payload?.text === "string") return payload.text.trim();
  }
  throw new SttError("Transcription failed");
}

async function transcribeAudio({
  body,
  contentType,
  language,
  apiKey,
  fetchImpl,
  sleep,
  deadlineMs = DEADLINE_MS,
}) {
  const deadlineAt = Date.now() + deadlineMs;
  const controller = new AbortController();
  const { signal } = controller;
  const timer = setTimeout(() => controller.abort(), deadlineMs);
  const aborted = new Promise((_, reject) => {
    signal.addEventListener("abort", () => reject(new SttError("Transcription timed out", 504)));
  });
  aborted.catch(() => {}); // avoid unhandled rejection when nothing is racing it

  const call = (url, init) => Promise.race([fetchImpl(url, { ...init, signal }), aborted]);

  try {
    const audioUrl = await uploadFile({
      apiKey,
      body,
      filename: `speech.${extensionFor(contentType)}`,
      contentType,
      call,
    });

    // Billing guard (replaces Magica's fail-closed upload-duration check; Spiral's upload
    // does not report duration). universal-2 is billed per hour of audio, so duration is
    // bounded in three layers: (1) audio_end_at makes the provider stop at
    // MAX_AUDIO_SECONDS, (2) MAX_AUDIO_BYTES caps the file, and (3) the worst case if the
    // provider bills the whole file anyway is 4MB at ~6kbps Opus (about 1.5h, roughly
    // $0.29 at $0.195/h). Real MediaRecorder output is 32-128kbps, so 60s is under 1MB.
    const input = {
      audio_url: audioUrl,
      audio_end_at: MAX_AUDIO_SECONDS * 1000,
    };
    if (language) input.language_code = language;

    const run = await runToCompletion({
      apiKey,
      provider: "assemblyai",
      model: "universal-2",
      input,
      call,
      remainingMs: () => deadlineAt - Date.now(),
      sleep,
    });
    return await extractText(run, call);
  } catch (err) {
    if (err instanceof SttError) throw err;
    if (signal.aborted) throw new SttError("Transcription timed out", 504);
    if (err instanceof SpiralError) {
      throw new SttError(
        err.status === 504 ? "Transcription timed out" : "Transcription failed",
        err.status === 504 ? 504 : 502,
      );
    }
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
