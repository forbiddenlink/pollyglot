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
  process.env.SPIRAL_API_KEY = 'test-key'
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

  it('uploads to Spiral, runs assemblyai universal-2, and returns the transcript', async () => {
    const fetchMock = vi
      .fn()
      // POST /v1/files
      .mockResolvedValueOnce(
        Response.json({
          id: 'file-1',
          upload_url: 'https://upload.example.test/put',
          upload_method: 'PUT',
          upload_headers: { 'Content-Type': 'audio/webm', 'Content-Length': '10', 'x-amz-meta-filename': 'speech.webm' },
          url: 'https://f.spiral.ai/file-1',
        }),
      )
      // PUT bytes
      .mockResolvedValueOnce(new Response(null, { status: 200 }))
      // POST /v1/runs
      .mockResolvedValueOnce(Response.json({ id: 'run-1', status: 'queued' }, { status: 202 }))
      // GET /v1/runs/run-1
      .mockResolvedValueOnce(
        Response.json({ id: 'run-1', status: 'completed', output: { items: [{ type: 'json', data: { text: ' bonjour ' } }] } }),
      )
    vi.stubGlobal('fetch', fetchMock)
    const res = await post('/transcribe?lang=fr', Buffer.from('fake-audio'), 'audio/webm;codecs=opus')
    vi.stubGlobal('fetch', realFetch)
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ text: 'bonjour' })

    const [files, put, start, poll] = fetchMock.mock.calls
    expect(files[0]).toBe('https://api.spiral.ai/v1/files')
    expect(JSON.parse(files[1].body)).toEqual({ filename: 'speech.webm', mime_type: 'audio/webm', size_bytes: 10 })
    expect(put[0]).toBe('https://upload.example.test/put')
    expect(put[1].method).toBe('PUT')
    expect(put[1].headers['x-amz-meta-filename']).toBe('speech.webm')
    expect(start[1].headers['Idempotency-Key']).toBeTruthy()
    // Billing guard: the provider is told to stop at 60s.
    expect(JSON.parse(start[1].body)).toEqual({
      provider: 'assemblyai',
      model: 'universal-2',
      input: { audio_url: 'https://f.spiral.ai/file-1', audio_end_at: 60000, language_code: 'fr' },
    })
    expect(poll[0]).toContain('/v1/runs/run-1?wait_seconds=')
  })

  it('reads the transcript from the output url when data is not inlined', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(Response.json({ id: 'f', upload_url: 'https://upload.example.test/p', upload_headers: {}, url: 'https://f.spiral.ai/f' }))
      .mockResolvedValueOnce(new Response(null, { status: 200 }))
      .mockResolvedValueOnce(Response.json({ id: 'r', status: 'running' }, { status: 202 }))
      .mockResolvedValueOnce(Response.json({ id: 'r', status: 'completed', output: { items: [{ type: 'json', url: 'https://g.spiral.ai/t.json' }] } }))
      .mockResolvedValueOnce(Response.json({ text: 'hola' }))
    vi.stubGlobal('fetch', fetchMock)
    const res = await post('/transcribe', Buffer.from('fake-audio'), 'audio/ogg')
    vi.stubGlobal('fetch', realFetch)
    expect(await res.json()).toEqual({ text: 'hola' })
  })

  it('502 when the Spiral run fails', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(Response.json({ id: 'f', upload_url: 'https://upload.example.test/p', upload_headers: {}, url: 'https://f.spiral.ai/f' }))
      .mockResolvedValueOnce(new Response(null, { status: 200 }))
      .mockResolvedValueOnce(Response.json({ id: 'r', status: 'failed' }))
    vi.stubGlobal('fetch', fetchMock)
    const res = await post('/transcribe', Buffer.from('fake-audio'), 'audio/webm')
    vi.stubGlobal('fetch', realFetch)
    expect(res.status).toBe(502)
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
