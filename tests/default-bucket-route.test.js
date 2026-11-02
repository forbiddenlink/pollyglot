// @vitest-environment node
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import { createRequire } from 'module'

const require = createRequire(import.meta.url)

let server, base
const realFetch = globalThis.fetch

beforeAll(async () => {
  process.env.NODE_ENV = 'production'
  process.env.OPENAI_API_KEY = 'test-key'
  // Redis configured but unreachable: every non-local fetch fails.
  process.env.UPSTASH_REDIS_REST_URL = 'https://redis.invalid'
  process.env.UPSTASH_REDIS_REST_TOKEN = 'tok'
  const app = require('../api/index.js')
  await new Promise((resolve) => {
    server = app.listen(0, '127.0.0.1', resolve)
  })
  base = `http://127.0.0.1:${server.address().port}`
})

afterAll(() => new Promise((resolve) => server.close(resolve)))

describe('default rate-limit bucket when the store is down', () => {
  it('returns 503 and never reaches OpenAI', async () => {
    const outbound = []
    vi.stubGlobal('fetch', (url, init) => {
      if (String(url).startsWith(base)) return realFetch(url, init)
      outbound.push(String(url))
      return Promise.reject(new Error('network down'))
    })
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const res = await realFetch(base + '/translate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: 'Hello', sourceLang: 'en', targetLang: 'fr' }),
    })
    vi.stubGlobal('fetch', realFetch)
    errSpy.mockRestore()
    expect(res.status).toBe(503)
    expect(outbound.some((u) => u.includes('openai.com'))).toBe(false)
  })
})
