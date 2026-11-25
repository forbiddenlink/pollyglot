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
  process.env.SPIRAL_API_KEY = 'spiral-test'
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

  it('falls through hung Spiral and MiniMax to OpenAI TTS', async () => {
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

  it('sends the pinned ElevenLabs model with an idempotency key and returns the audio', async () => {
    const calls = []
    vi.stubGlobal('fetch', (url, init) => {
      if (String(url).startsWith(base)) return realFetch(url, init)
      const u = String(url)
      calls.push({ url: u, init })
      if (u === 'https://api.spiral.ai/v1/runs') {
        return Promise.resolve(Response.json({ id: 'run-1', status: 'queued' }, { status: 202 }))
      }
      if (u.startsWith('https://api.spiral.ai/v1/runs/run-1')) {
        return Promise.resolve(
          Response.json({
            id: 'run-1',
            status: 'completed',
            output: { items: [{ type: 'audio', url: 'https://g.spiral.ai/a.mp3', mime_type: 'audio/mpeg' }] },
          }),
        )
      }
      if (u === 'https://g.spiral.ai/a.mp3') return Promise.resolve(new Response('spiral-audio', { status: 200 }))
      return Promise.reject(new Error('unexpected ' + u))
    })
    const res = await postTts()
    vi.stubGlobal('fetch', realFetch)
    expect(res.status).toBe(200)
    expect(await res.text()).toBe('spiral-audio')
    const start = calls[0]
    expect(start.init.headers.Authorization).toBe('Bearer spiral-test')
    expect(start.init.headers['Idempotency-Key']).toMatch(/^[0-9a-f-]{36}$/)
    expect(JSON.parse(start.init.body)).toEqual({
      provider: 'elevenlabs',
      model: 'eleven_multilingual_v2',
      input: { text: 'Hello', voice_id: '21m00Tcm4TlvDq8ikWAM', output_format: 'mp3_44100_128' },
    })
    expect(calls[1].url).toContain('wait_seconds=')
  })

  it('falls through to OpenAI when the Spiral run fails', async () => {
    stub((url) => {
      const host = new URL(url).hostname
      if (host === 'api.spiral.ai') {
        return Promise.resolve(Response.json({ id: 'r', status: 'failed' }, { status: 200 }))
      }
      if (host === 'api.openai.com') {
        return Promise.resolve({ ok: true, status: 200, arrayBuffer: async () => new TextEncoder().encode('mp3').buffer })
      }
      return Promise.resolve(new Response('no', { status: 500 }))
    })
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const res = await postTts()
    vi.stubGlobal('fetch', realFetch)
    errSpy.mockRestore()
    expect(res.status).toBe(200)
  })
})
