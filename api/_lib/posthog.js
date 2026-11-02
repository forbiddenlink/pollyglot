/**
 * PostHog server-side analytics (CJS singleton)
 * Tracks translation requests, language detection, and TTS events.
 */

const { PostHog } = require("posthog-node");

let posthogInstance = null;

function getPostHog() {
  const key =
    process.env.POSTHOG_API_KEY || process.env.NEXT_PUBLIC_POSTHOG_KEY;
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
 * Capture a server-side event. Silent no-op if PostHog is not configured.
 * @param {string} event
 * @param {Record<string,unknown>} properties
 */
function captureEvent(event, properties = {}) {
  const ph = getPostHog();
  if (!ph) return;
  ph.capture({
    distinctId: properties.sessionId ?? "server",
    event,
    properties,
  });
}

module.exports = { getPostHog, captureEvent };
