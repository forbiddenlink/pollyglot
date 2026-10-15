// @vitest-environment node
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import { createRequire } from 'module'

const require = createRequire(import.meta.url)

let server, base
const realFetch = globalThis.fetch

beforeAll(async () => {
  process.env.NODE_ENV = 'production' // api/index.js only auto-listens outside production
  delete process.env.UPSTASH_REDIS_REST_URL
  delete process.env.KV_REST_API_URL
  process.env.MAGICA_KEY = 'test-key'
  const app = require('../api/index.js')
  await new Promise((resolve) => {
    server = app.listen(0, '127.0.0.1', resolve)
  })
  base = `http://127.0.0.1:${server.address().port}`
})

afterAll(() => new Promise((resolve) => server.close(resolve)))

function post(path, body, type) {
  return realFetch(base + path, { method: 'POST', headers: { 'Content-Type': type }, body })
}

describe('POST /transcribe', () => {
  it('415 for non-audio content type', async () => {
    const res = await post('/transcribe', '{}', 'application/json')
    expect(res.status).toBe(415)
  })

  it('413 above the size cap', async () => {
    const res = await post('/transcribe', Buffer.alloc(4 * 1024 * 1024 + 10), 'audio/webm')
    expect(res.status).toBe(413)
  })

  it('returns text from Magica for valid audio', async () => {
    const magica = vi
      .fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ url: 'https://static/x', metadata: { duration: 3 } }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ runId: 'r' }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ status: 'COMPLETED', output: { result: 'bonjour' } }) })
    vi.stubGlobal('fetch', magica)
    const res = await post('/transcribe?lang=fr', Buffer.from('fake-audio'), 'audio/webm;codecs=opus')
    vi.stubGlobal('fetch', realFetch)
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ text: 'bonjour' })
    expect(JSON.parse(magica.mock.calls[1][1].body).input.language).toBe('fr')
  })

  it('429 once the stt bucket is exhausted', async () => {
    const statuses = []
    for (let i = 0; i < 12; i++) {
      const res = await post('/transcribe', '{}', 'application/json')
      statuses.push(res.status)
    }
    expect(statuses).toContain(429)
  })
})
