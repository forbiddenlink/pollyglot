// Minimal Spiral (https://api.spiral.ai) client shared by /tts and /transcribe.
// Replaces the Magica API, which shuts down 2026-12-01. SPIRAL_API_KEY stays server-side.

const crypto = require("crypto");

const SPIRAL_API = "https://api.spiral.ai";
const FINAL = new Set(["completed", "failed", "canceled"]);
// Long-poll window per request; the caller's remainingMs() still bounds the whole run.
const MAX_WAIT_SECONDS = 10;

class SpiralError extends Error {
  constructor(message, { status, code, retryable } = {}) {
    super(message);
    this.name = "SpiralError";
    this.status = status;
    this.code = code;
    this.retryable = retryable;
  }
}

async function problem(res, fallback) {
  let body = null;
  try {
    body = await res.json();
  } catch {
    // non-JSON error body
  }
  return new SpiralError(body?.detail || body?.title || fallback, {
    status: res.status,
    code: body?.code,
    retryable: body?.retryable,
  });
}

function authHeaders(apiKey) {
  return { Authorization: `Bearer ${apiKey}` };
}

// `call(url, init)` is the caller's fetch wrapper (it owns deadlines and abort signals).
async function startRun({ apiKey, provider, model, input, call }) {
  const res = await call(`${SPIRAL_API}/v1/runs`, {
    method: "POST",
    headers: {
      ...authHeaders(apiKey),
      "Content-Type": "application/json",
      "Idempotency-Key": crypto.randomUUID(),
    },
    body: JSON.stringify({ provider, model, input }),
  });
  if (!res.ok) throw await problem(res, "Spiral run failed to start");
  const run = await res.json();
  if (!run?.id) throw new SpiralError("Spiral run failed to start");
  return run;
}

// Long-polls until the run is final or remainingMs() hits zero. Returns the final run.
async function waitForRun({
  apiKey,
  run,
  call,
  remainingMs,
  sleep = (ms) => new Promise((r) => setTimeout(r, ms)),
}) {
  let current = run;
  while (!FINAL.has(current.status)) {
    const left = remainingMs();
    if (left <= 0) throw new SpiralError("Spiral run timed out", { status: 504 });
    const wait = Math.min(MAX_WAIT_SECONDS, Math.floor(left / 1000) - 1);
    const res = await call(
      `${SPIRAL_API}/v1/runs/${encodeURIComponent(run.id)}?wait_seconds=${Math.max(wait, 0)}`,
      { headers: authHeaders(apiKey) },
    );
    if (!res.ok) throw await problem(res, "Spiral run poll failed");
    current = await res.json();
    // Too little budget left for a long-poll: pace plain polls instead of spinning.
    if (wait <= 0 && !FINAL.has(current.status)) await sleep(Math.min(500, Math.max(left - 1, 0)));
  }
  if (current.status !== "completed") {
    throw new SpiralError(`Spiral run ${current.status}`, {
      code: current.error?.code,
      retryable: current.error?.retryable,
    });
  }
  return current;
}

async function runToCompletion(args) {
  const run = await startRun(args);
  return waitForRun({ ...args, run });
}

// Registers a file and PUTs the bytes. Returns the reference to pass to a model's url field.
async function uploadFile({ apiKey, body, filename, contentType, call }) {
  const res = await call(`${SPIRAL_API}/v1/files`, {
    method: "POST",
    headers: {
      ...authHeaders(apiKey),
      "Content-Type": "application/json",
      "Idempotency-Key": crypto.randomUUID(),
    },
    body: JSON.stringify({
      filename,
      mime_type: contentType,
      size_bytes: body.length,
    }),
  });
  if (!res.ok) throw await problem(res, "Audio upload failed");
  const file = await res.json();
  if (!file?.upload_url || !file?.id) throw new SpiralError("Audio upload failed");
  const put = await call(file.upload_url, {
    method: file.upload_method || "PUT",
    headers: file.upload_headers,
    body,
  });
  if (!put.ok) throw new SpiralError("Audio upload failed", { status: put.status });
  return file.url || file.id;
}

module.exports = { SPIRAL_API, SpiralError, startRun, waitForRun, runToCompletion, uploadFile };
