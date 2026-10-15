// @vitest-environment node
import { describe, it, expect, vi } from 'vitest'
import { createRequire } from 'module'

const require = createRequire(import.meta.url)
const { createRateLimiter, createMemoryLimiter, resolveRedisConfig, LIMITS } = require('../api/ratelimit.js')

function fakeDeps({ failWith } = {}) {
  const calls = []
  class Redis {
    constructor(config) {
      this.config = config
    }
  }
  class Ratelimit {
    static slidingWindow(max, window) {
      return { max, window }
    }
    constructor(opts) {
      this.opts = opts
      this.used = new Map()
    }
    async limit(key) {
      calls.push({ prefix: this.opts.prefix, key, limiter: this.opts.limiter })
      if (failWith) throw new Error(failWith)
      const n = (this.used.get(key) || 0) + 1
      this.used.set(key, n)
      return { success: n <= this.opts.limiter.max }
    }
  }
  return { deps: { redis: { Redis }, ratelimit: { Ratelimit } }, calls }
}

describe('resolveRedisConfig', () => {
  it('returns null when nothing is set', () => {
    expect(resolveRedisConfig({})).toBeNull()
  })
  it('needs both url and token', () => {
    expect(resolveRedisConfig({ UPSTASH_REDIS_REST_URL: 'https://x' })).toBeNull()
  })
  it('reads UPSTASH_* names', () => {
    expect(
      resolveRedisConfig({ UPSTASH_REDIS_REST_URL: 'https://u', UPSTASH_REDIS_REST_TOKEN: 't' }),
    ).toEqual({ url: 'https://u', token: 't' })
  })
  it('reads KV_REST_API_* names (Vercel marketplace)', () => {
    expect(resolveRedisConfig({ KV_REST_API_URL: 'https://k', KV_REST_API_TOKEN: 'kt' })).toEqual({
      url: 'https://k',
      token: 'kt',
    })
  })
  it('prefers UPSTASH_* over KV_*', () => {
    expect(
      resolveRedisConfig({
        UPSTASH_REDIS_REST_URL: 'https://u',
        UPSTASH_REDIS_REST_TOKEN: 't',
        KV_REST_API_URL: 'https://k',
        KV_REST_API_TOKEN: 'kt',
      }),
    ).toEqual({ url: 'https://u', token: 't' })
  })
})

describe('createRateLimiter selection', () => {
  it('uses memory without Redis env', () => {
    expect(createRateLimiter({ env: {} }).mode).toBe('memory')
  })
  it('uses redis with Redis env', () => {
    const { deps } = fakeDeps()
    const limiter = createRateLimiter({
      env: { UPSTASH_REDIS_REST_URL: 'https://u', UPSTASH_REDIS_REST_TOKEN: 't' },
      deps,
    })
    expect(limiter.mode).toBe('redis')
  })
  it('uses redis with KV env', () => {
    const { deps } = fakeDeps()
    const limiter = createRateLimiter({
      env: { KV_REST_API_URL: 'https://k', KV_REST_API_TOKEN: 'kt' },
      deps,
    })
    expect(limiter.mode).toBe('redis')
  })
})

describe('redis-backed limiter', () => {
  const env = { UPSTASH_REDIS_REST_URL: 'https://u', UPSTASH_REDIS_REST_TOKEN: 't' }

  it('uses a sliding window per bucket with the bucket limit and its own prefix', async () => {
    const { deps, calls } = fakeDeps()
    const limiter = createRateLimiter({ env, deps })
    await limiter.check('1.1.1.1', 'tts')
    await limiter.check('1.1.1.1')
    expect(calls[0]).toMatchObject({
      prefix: 'pollyglot:rl:tts',
      key: '1.1.1.1',
      limiter: { max: LIMITS.tts, window: '60 s' },
    })
    expect(calls[1]).toMatchObject({
      prefix: 'pollyglot:rl:default',
      limiter: { max: LIMITS.default },
    })
  })

  it('denies once the store reports failure', async () => {
    const { deps } = fakeDeps()
    const limiter = createRateLimiter({ env, deps, limits: { default: 2 } })
    expect(await limiter.check('ip')).toBe(true)
    expect(await limiter.check('ip')).toBe(true)
    expect(await limiter.check('ip')).toBe(false)
  })

  it('falls back to in-memory limits when Redis throws, and logs', async () => {
    const { deps } = fakeDeps({ failWith: 'boom' })
    const logger = { error: vi.fn() }
    const limiter = createRateLimiter({ env, deps, logger, limits: { default: 2 } })
    expect(await limiter.check('ip')).toBe(true)
    expect(await limiter.check('ip')).toBe(true)
    expect(await limiter.check('ip')).toBe(false)
    expect(logger.error).toHaveBeenCalled()
  })
})

describe('in-memory limiter', () => {
  it('allows up to the limit then blocks', () => {
    const m = createMemoryLimiter({ limits: { default: 3 } })
    expect([1, 2, 3, 4].map(() => m.check('ip'))).toEqual([true, true, true, false])
  })

  it('tracks clients independently', () => {
    const m = createMemoryLimiter({ limits: { default: 1 } })
    expect(m.check('a')).toBe(true)
    expect(m.check('b')).toBe(true)
    expect(m.check('a')).toBe(false)
  })

  it('tracks buckets independently with their own caps', () => {
    const m = createMemoryLimiter({ limits: { default: 5, stt: 1 } })
    expect(m.check('ip', 'stt')).toBe(true)
    expect(m.check('ip', 'stt')).toBe(false)
    expect(m.check('ip')).toBe(true)
  })

  it('slides the window: old requests expire', () => {
    let t = 0
    const m = createMemoryLimiter({ now: () => t, limits: { default: 1 } })
    expect(m.check('ip')).toBe(true)
    t = 59999
    expect(m.check('ip')).toBe(false)
    t = 60001
    expect(m.check('ip')).toBe(true)
  })

  it('cleanup drops expired entries', () => {
    let t = 0
    const m = createMemoryLimiter({ now: () => t })
    m.check('ip')
    t = 120000
    m.cleanup()
    expect(m.size()).toBe(0)
  })
})
