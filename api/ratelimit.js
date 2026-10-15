// Rate limiting. Durable (Upstash sliding window) when Redis REST creds are set,
// per-instance in-memory otherwise. The in-memory path alone does not cap spend on
// Vercel: every serverless instance keeps its own counts.

const WINDOW_MS = 60000;

// Per-minute caps. TTS and STT call paid third-party APIs, so they sit lower.
const LIMITS = Object.freeze({
  default: 50,
  tts: 20,
  stt: 10,
});

// Paid-provider buckets: when the durable store is configured but errors, deny rather than
// fall back to a per-instance counter that would not cap spend.
const FAIL_CLOSED = new Set(["tts", "stt"]);

class RateLimitUnavailableError extends Error {
  constructor() {
    super("Rate limit store unavailable");
    this.status = 503;
  }
}

function resolveRedisConfig(env = process.env) {
  const url = env.UPSTASH_REDIS_REST_URL || env.KV_REST_API_URL;
  const token = env.UPSTASH_REDIS_REST_TOKEN || env.KV_REST_API_TOKEN;
  return url && token ? { url, token } : null;
}

function createMemoryLimiter({ now = () => Date.now(), limits = LIMITS } = {}) {
  const counts = new Map();

  function check(key, bucket = "default") {
    const max = limits[bucket] ?? limits.default;
    const mapKey = `${bucket}:${key}`;
    const t = now();
    const recent = (counts.get(mapKey) || []).filter((time) => t - time < WINDOW_MS);
    if (recent.length >= max) {
      counts.set(mapKey, recent);
      return false;
    }
    recent.push(t);
    counts.set(mapKey, recent);
    return true;
  }

  function cleanup() {
    const t = now();
    for (const [key, times] of counts.entries()) {
      const recent = times.filter((time) => t - time < WINDOW_MS);
      if (recent.length === 0) counts.delete(key);
      else counts.set(key, recent);
    }
  }

  return { check, cleanup, size: () => counts.size };
}

// Returns { check(key, bucket) -> Promise<boolean>, mode, cleanup }.
// `deps` lets tests inject fakes instead of loading the Upstash packages.
function createRateLimiter({ env = process.env, deps, limits = LIMITS, logger = console } = {}) {
  const memory = createMemoryLimiter({ limits });
  const config = resolveRedisConfig(env);

  if (!config) {
    return {
      mode: "memory",
      cleanup: memory.cleanup,
      check: async (key, bucket) => memory.check(key, bucket),
    };
  }

  const { Redis } = deps?.redis ? deps.redis : require("@upstash/redis");
  const { Ratelimit } = deps?.ratelimit ? deps.ratelimit : require("@upstash/ratelimit");
  const redis = new Redis(config);
  const limiters = new Map();

  function forBucket(bucket) {
    const name = bucket in limits ? bucket : "default";
    if (!limiters.has(name)) {
      limiters.set(
        name,
        new Ratelimit({
          redis,
          limiter: Ratelimit.slidingWindow(limits[name], "60 s"),
          prefix: `pollyglot:rl:${name}`,
        }),
      );
    }
    return limiters.get(name);
  }

  return {
    mode: "redis",
    cleanup: memory.cleanup,
    async check(key, bucket = "default") {
      try {
        const { success } = await forBucket(bucket).limit(key);
        return success;
      } catch (err) {
        // Redis outage must not take translation down, but must not remove the cap either.
        if (FAIL_CLOSED.has(bucket)) {
          logger.error("Rate limit store unavailable, failing closed:", err.message);
          throw new RateLimitUnavailableError();
        }
        logger.error("Rate limit store unavailable, using in-memory fallback:", err.message);
        return memory.check(key, bucket);
      }
    },
  };
}

module.exports = { RateLimitUnavailableError, createRateLimiter, createMemoryLimiter, resolveRedisConfig, LIMITS, WINDOW_MS };
