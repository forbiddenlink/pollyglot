// @vitest-environment node
import { describe, it, expect, vi } from 'vitest'
import { createRequire } from 'module'

const require = createRequire(import.meta.url)
const { validateAudio, transcribeAudio, SttError, MAX_AUDIO_BYTES, MAX_AUDIO_SECONDS } = require('../api/stt.js')

describe('validateAudio', () => {
  const audio = Buffer.from('abc')
  it('accepts supported types, ignoring codec params', () => {
    expect(validateAudio(audio, 'audio/webm;codecs=opus')).toEqual({ ok: true, contentType: 'audio/webm' })
  })
  it('rejects non-audio', () => {
    expect(validateAudio(audio, 'application/json')).toMatchObject({ ok: false, status: 415 })
  })
  it('rejects empty and non-buffer bodies', () => {
    expect(validateAudio(Buffer.alloc(0), 'audio/webm')).toMatchObject({ ok: false, status: 400 })
    expect(validateAudio({}, 'audio/webm')).toMatchObject({ ok: false, status: 400 })
  })
  it('rejects over the size cap', () => {
    expect(validateAudio(Buffer.alloc(MAX_AUDIO_BYTES + 1), 'audio/webm')).toMatchObject({
      ok: false,
      status: 413,
    })
  })
})

const FILE = {
  id: 'file-1',
  upload_url: 'https://upload.example.test/put',
  upload_method: 'PUT',
  upload_headers: { 'Content-Type': 'audio/webm', 'Content-Length': '5', 'x-amz-meta-filename': 'speech.webm' },
  url: 'https://f.spiral.ai/file-1',
}
const ok = (body, status = 200) => ({ ok: true, status, json: async () => body, text: async () => JSON.stringify(body) })
const done = (text = 'hi') => ok({ id: 'r', status: 'completed', output: { items: [{ type: 'json', data: { text } }] } })

describe('transcribeAudio', () => {
  const base = { body: Buffer.from('audio'), contentType: 'audio/webm', apiKey: 'k', sleep: async () => {} }

  it('uploads, runs universal-2 with a language hint, returns trimmed text', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(ok(FILE))
      .mockResolvedValueOnce(ok({}))
      .mockResolvedValueOnce(ok({ id: 'r1', status: 'queued' }, 202))
      .mockResolvedValueOnce(ok({ id: 'r1', status: 'running' }))
      .mockResolvedValueOnce(done(' Hola mundo '))
    const text = await transcribeAudio({ ...base, language: 'es', fetchImpl })
    expect(text).toBe('Hola mundo')
    const [files, put, start] = fetchImpl.mock.calls
    expect(files[0]).toBe('https://api.spiral.ai/v1/files')
    expect(files[1].headers.Authorization).toBe('Bearer k')
    expect(put[0]).toBe(FILE.upload_url)
    expect(put[1]).toMatchObject({ method: 'PUT', headers: FILE.upload_headers })
    expect(JSON.parse(start[1].body)).toEqual({
      provider: 'assemblyai',
      model: 'universal-2',
      input: { audio_url: FILE.url, audio_end_at: 60000, language_code: 'es' },
    })
  })

  it('omits language_code when none given (auto-detect)', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(ok(FILE))
      .mockResolvedValueOnce(ok({}))
      .mockResolvedValueOnce(ok({ id: 'r', status: 'queued' }, 202))
      .mockResolvedValueOnce(done())
    await transcribeAudio({ ...base, language: null, fetchImpl })
    expect(JSON.parse(fetchImpl.mock.calls[2][1].body).input.language_code).toBeUndefined()
  })

  it('always bounds the billed duration with audio_end_at', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(ok(FILE))
      .mockResolvedValueOnce(ok({}))
      .mockResolvedValueOnce(ok({ id: 'r', status: 'queued' }, 202))
      .mockResolvedValueOnce(done())
    await transcribeAudio({ ...base, fetchImpl })
    expect(JSON.parse(fetchImpl.mock.calls[2][1].body).input.audio_end_at).toBe(MAX_AUDIO_SECONDS * 1000)
  })

  it('starts no paid run when the upload fails', async () => {
    const fetchImpl = vi.fn().mockResolvedValueOnce({ ok: false, status: 500, json: async () => ({}) })
    await expect(transcribeAudio({ ...base, fetchImpl })).rejects.toBeInstanceOf(SttError)
    expect(fetchImpl).toHaveBeenCalledTimes(1)
  })

  it('starts no paid run when the byte PUT fails', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(ok(FILE))
      .mockResolvedValueOnce({ ok: false, status: 403, json: async () => ({}) })
    await expect(transcribeAudio({ ...base, fetchImpl })).rejects.toBeInstanceOf(SttError)
    expect(fetchImpl).toHaveBeenCalledTimes(2)
  })

  it('throws 502 when the run fails', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(ok(FILE))
      .mockResolvedValueOnce(ok({}))
      .mockResolvedValueOnce(ok({ id: 'r', status: 'queued' }, 202))
      .mockResolvedValueOnce(ok({ id: 'r', status: 'failed' }))
    await expect(transcribeAudio({ ...base, fetchImpl })).rejects.toMatchObject({ status: 502 })
  })

  it('maps 402 INSUFFICIENT_BALANCE on start to 502', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(ok(FILE))
      .mockResolvedValueOnce(ok({}))
      .mockResolvedValueOnce({ ok: false, status: 402, json: async () => ({ code: 'INSUFFICIENT_BALANCE', retryable: false }) })
    await expect(transcribeAudio({ ...base, fetchImpl })).rejects.toMatchObject({ status: 502 })
  })

  it('times out with 504 if the run never finishes', async () => {
    const fetchImpl = vi.fn(async (url, init) => {
      const u = String(url)
      if (u.endsWith('/v1/files')) return ok(FILE)
      if (init?.method === 'PUT') return ok({})
      if (u.endsWith('/v1/runs')) return ok({ id: 'r', status: 'queued' }, 202)
      return ok({ id: 'r', status: 'running' })
    })
    await expect(transcribeAudio({ ...base, deadlineMs: 1500, fetchImpl, sleep: (ms) => new Promise((r) => setTimeout(r, ms)) })).rejects.toMatchObject({ status: 504 })
  })
})

describe('overall deadline', () => {
  const base = { body: Buffer.from('audio'), contentType: 'audio/webm', apiKey: 'k' }

  it('returns 504 when a fetch never resolves, and passes an abort signal', async () => {
    vi.useFakeTimers()
    try {
      const fetchImpl = vi.fn(() => new Promise(() => {}))
      const p = transcribeAudio({ ...base, fetchImpl, deadlineMs: 1000 })
      const assertion = expect(p).rejects.toMatchObject({ status: 504 })
      await vi.advanceTimersByTimeAsync(1001)
      await assertion
      expect(fetchImpl.mock.calls[0][1].signal).toBeInstanceOf(AbortSignal)
    } finally {
      vi.useRealTimers()
    }
  })
})
