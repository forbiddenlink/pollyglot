// @vitest-environment node
import { describe, it, expect, beforeAll, afterAll, afterEach, vi } from 'vitest'
import { createRequire } from 'module'

const require = createRequire(import.meta.url)

const captured = []
let flushCalls = 0
require.cache[require.resolve('posthog-node', { paths: [`${process.cwd()}/api`] })] = {
  id: 'posthog-stub',
  loaded: true,
  exports: {
    PostHog: class {
      capture(event) {
        captured.push(event)
      }
      flush() {
        flushCalls += 1
        return Promise.resolve()
      }
    },
  },
}

let server, base
const realFetch = globalThis.fetch

beforeAll(async () => {
  process.env.NODE_ENV = 'production'
  delete process.env.UPSTASH_REDIS_REST_URL
  delete process.env.KV_REST_API_URL
  delete process.env.MINIMAX_API_KEY
  delete process.env.MAGICA_KEY
  delete process.env.OPENAI_API_KEY
  process.env.POSTHOG_API_KEY = 'test-posthog'
  const app = require('../api/index.js')
  await new Promise((resolve) => {
    server = app.listen(0, '127.0.0.1', resolve)
  })
  base = `http://127.0.0.1:${server.address().port}`
})

afterAll(() => new Promise((resolve) => server.close(resolve)))

afterEach(() => {
  vi.unstubAllGlobals()
  delete process.env.OPENAI_API_KEY
  delete process.env.MAGICA_KEY
  captured.length = 0
  flushCalls = 0
})

const post = (path, body) =>
  realFetch(`${base}/api${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-forwarded-for': `203.0.113.${Math.floor(Math.random() * 200) + 1}` },
    body: JSON.stringify(body),
  })

describe('FUNC-004: missing OPENAI_API_KEY', () => {
  it.each([
    ['/translate', { text: 'hello', sourceLang: 'en', targetLang: 'es' }],
    ['/detect', { text: 'hello' }],
    ['/pronunciation', { text: 'hello', targetLang: 'es' }],
    ['/alternatives', { text: 'hello', sourceLang: 'en', targetLang: 'es' }],
    ['/tts', { text: 'hello', language: 'en' }],
  ])('%s answers 503', async (path, body) => {
    const res = await post(path, body)
    expect(res.status).toBe(503)
  })

  it('/health answers 503 and does not expose hasApiKey', async () => {
    const res = await realFetch(`${base}/api/health`)
    const data = await res.json()
    expect(res.status).toBe(503)
    expect(data.status).toBe('unconfigured')
    expect(data).not.toHaveProperty('hasApiKey')
  })

  it('/health answers 200 when configured', async () => {
    process.env.OPENAI_API_KEY = 'test-key'
    const res = await realFetch(`${base}/api/health`)
    expect(res.status).toBe(200)
    expect((await res.json()).status).toBe('ok')
  })
})

describe('FUNC-003: Magica audio download fails', () => {
  it('falls through to OpenAI instead of returning the error body as audio', async () => {
    process.env.OPENAI_API_KEY = 'test-key'
    process.env.MAGICA_KEY = 'test-magica'
    vi.stubGlobal('fetch', (url, init) => {
      const u = String(url)
      if (u.startsWith(base)) return realFetch(url, init)
      if (new URL(u).hostname === 'api.magica.com') {
        if (u.includes('/runs/')) {
          return Promise.resolve(Response.json({ status: 'COMPLETED', output: { result: ['https://cdn.example.test/a.mp3'] } }))
        }
        return Promise.resolve(Response.json({ runId: 'r1', id: 'r1', run_id: 'r1' }))
      }
      if (new URL(u).hostname === 'cdn.example.test') {
        return Promise.resolve(new Response('<Error>expired</Error>', { status: 403 }))
      }
      return Promise.resolve(new Response('good-audio', { status: 200 }))
    })
    const res = await post('/tts', { text: 'hello', language: 'en' })
    expect(res.status).toBe(200)
    expect(await res.text()).toBe('good-audio')
  })
})

describe('SEC-005: JSON body limit', () => {
  it('rejects a body far above the longest allowed text', async () => {
    const res = await post('/detect', { text: 'x'.repeat(200 * 1024) })
    expect(res.status).toBe(413)
  })
})

describe('FUNC-006: server analytics', () => {
  it('flushes before responding and never sends the raw client IP', async () => {
    process.env.OPENAI_API_KEY = 'test-key'
    vi.stubGlobal('fetch', (url, init) => {
      if (String(url).startsWith(base)) return realFetch(url, init)
      return Promise.resolve(Response.json({ choices: [{ message: { content: 'hola' } }] }))
    })
    const res = await realFetch(`${base}/api/translate`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-forwarded-for': '198.51.100.7' },
      body: JSON.stringify({ text: 'hello', sourceLang: 'en', targetLang: 'es' }),
    })
    expect(res.status).toBe(200)
    expect(captured).toHaveLength(1)
    expect(flushCalls).toBe(1)
    expect(JSON.stringify(captured[0])).not.toContain('198.51.100.7')
    expect(captured[0].distinctId).toMatch(/^[0-9a-f]{16}$/)
  })
})
