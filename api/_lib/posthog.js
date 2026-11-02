/**
 * PostHog server-side analytics (CJS singleton)
 * Tracks translation requests, language detection, and TTS events.
 */

const { createHmac } = require("node:crypto");
const { PostHog } = require("posthog-node");

// A serverless function can freeze right after it responds, so queued events
// must be sent first. The cap keeps a slow PostHog from delaying a translation.
const FLUSH_TIMEOUT_MS = 800;

let posthogInstance = null;

function posthogKey() {
  return process.env.POSTHOG_API_KEY || process.env.NEXT_PUBLIC_POSTHOG_KEY;
}

function getPostHog() {
  const key = posthogKey();
  if (!key) return null;

  if (!posthogInstance) {
    posthogInstance = new PostHog(key, {
      host: process.env.POSTHOG_HOST || "https://us.i.posthog.com",
      flushAt: 20,
      flushInterval: 10000,
    });
  }

  return posthogInstance;
}

/**
 * Stable pseudonymous ID for a client IP, so raw IPs never reach PostHog.
 * @param {string} ip
 */
function anonymizeIp(ip) {
  return createHmac("sha256", posthogKey() ?? "").update(String(ip)).digest("hex").slice(0, 16);
}

/**
 * Capture a server-side event and send it before the caller responds.
 * Silent no-op if PostHog is not configured. Never throws.
 * @param {string} event
 * @param {Record<string,unknown>} properties
 */
async function captureEvent(event, properties = {}) {
  const ph = getPostHog();
  if (!ph) return;
  ph.capture({
    distinctId: properties.sessionId ?? "server",
    event,
    properties,
  });
  let timer;
  const timeout = new Promise((resolve) => {
    timer = setTimeout(resolve, FLUSH_TIMEOUT_MS);
  });
  try {
    await Promise.race([ph.flush(), timeout]);
  } catch (error) {
    console.error("PostHog flush failed:", error.message);
  } finally {
    clearTimeout(timer);
  }
}

module.exports = { anonymizeIp, getPostHog, captureEvent };
