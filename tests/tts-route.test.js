// @vitest-environment node
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import { createRequire } from 'module'

const require = createRequire(import.meta.url)

let server, base
const realFetch = globalThis.fetch

beforeAll(async () => {
  process.env.NODE_ENV = 'production'
  delete process.env.UPSTASH_REDIS_REST_URL
  delete process.env.KV_REST_API_URL
  process.env.OPENAI_API_KEY = 'test-key'
  process.env.MAGICA_KEY = 'magica-test'
  process.env.MINIMAX_API_KEY = 'minimax-test'
  process.env.TTS_DEADLINE_MS = '600'
  const app = require('../api/index.js')
  await new Promise((resolve) => {
    server = app.listen(0, '127.0.0.1', resolve)
  })
  base = `http://127.0.0.1:${server.address().port}`
})

afterAll(() => new Promise((resolve) => server.close(resolve)))

// A provider that never answers but honours the abort signal, like real fetch.
function hang(init) {
  return new Promise((_, reject) => {
    init?.signal?.addEventListener('abort', () => reject(init.signal.reason))
  })
}

function stub(handler) {
  const calls = []
  vi.stubGlobal('fetch', (url, init) => {
    if (String(url).startsWith(base)) return realFetch(url, init)
    calls.push({ url: String(url), signal: init?.signal })
    return handler(String(url), init)
  })
  return calls
}

const postTts = () =>
  realFetch(base + '/tts', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text: 'Hello', language: 'en' }),
  })

describe('POST /tts deadline', () => {
  it('answers 504 within the budget when every provider hangs', async () => {
    const calls = stub((_url, init) => hang(init))
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const started = Date.now()
    const res = await postTts()
    const elapsed = Date.now() - started
    vi.stubGlobal('fetch', realFetch)
    errSpy.mockRestore()
    expect(res.status).toBe(504)
    expect(elapsed).toBeLessThan(1500)
    expect(calls.length).toBeGreaterThan(0)
    expect(calls.every((c) => c.signal instanceof AbortSignal)).toBe(true)
  })

  it('falls through hung Magica and MiniMax to OpenAI TTS', async () => {
    stub((url, init) => {
      if (new URL(url).hostname === 'api.openai.com') {
        return Promise.resolve({ ok: true, status: 200, arrayBuffer: async () => new TextEncoder().encode('mp3').buffer })
      }
      return hang(init)
    })
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const res = await postTts()
    vi.stubGlobal('fetch', realFetch)
    errSpy.mockRestore()
    expect(res.status).toBe(200)
    expect(res.headers.get('content-type')).toBe('audio/mpeg')
  })
})
