// @vitest-environment node
import { describe, it, expect, vi } from 'vitest'
import { createRequire } from 'module'

const require = createRequire(import.meta.url)
const { validateAudio, transcribeAudio, SttError, MAX_AUDIO_BYTES } = require('../api/stt.js')

const json = (body, ok = true) => ({ ok, json: async () => body })

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

describe('transcribeAudio', () => {
  const base = { body: Buffer.from('audio'), contentType: 'audio/webm', apiKey: 'k', sleep: async () => {} }

  it('uploads, runs ai_transcription with a language hint, polls, returns text', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(json({ url: 'https://static/x.webm', metadata: { duration: 4 } }))
      .mockResolvedValueOnce(json({ runId: 'r1' }))
      .mockResolvedValueOnce(json({ status: 'RUNNING' }))
      .mockResolvedValueOnce(json({ status: 'COMPLETED', output: { result: ' Hola mundo ' } }))
    const text = await transcribeAudio({ ...base, language: 'es', fetchImpl })
    expect(text).toBe('Hola mundo')
    const runCall = fetchImpl.mock.calls[1]
    expect(runCall[0]).toMatch(/nodes\/ai_transcription\/run$/)
    expect(JSON.parse(runCall[1].body).input).toMatchObject({
      inputMode: 'upload',
      audioUrl: ['https://static/x.webm'],
      language: 'es',
    })
    expect(runCall[1].headers.Authorization).toBe('Bearer k')
  })

  it('omits language when none given (auto-detect)', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(json({ url: 'https://static/x', metadata: { duration: 3 } }))
      .mockResolvedValueOnce(json({ runId: 'r' }))
      .mockResolvedValueOnce(json({ status: 'COMPLETED', output: { result: 'hi' } }))
    await transcribeAudio({ ...base, language: null, fetchImpl })
    expect(JSON.parse(fetchImpl.mock.calls[1][1].body).input.language).toBeUndefined()
  })

  it('rejects audio longer than the cap before spending on transcription', async () => {
    const fetchImpl = vi.fn().mockResolvedValueOnce(json({ url: 'https://static/x', metadata: { duration: 90 } }))
    await expect(transcribeAudio({ ...base, fetchImpl })).rejects.toMatchObject({ status: 413 })
    expect(fetchImpl).toHaveBeenCalledTimes(1)
  })

  it.each([
    ['missing metadata', undefined],
    ['missing duration', {}],
    ['NaN duration', { duration: NaN }],
    ['string duration', { duration: '4' }],
  ])('fails closed (422) on %s, before any paid run', async (_n, metadata) => {
    const fetchImpl = vi.fn().mockResolvedValueOnce(json({ url: 'https://static/x', metadata }))
    await expect(transcribeAudio({ ...base, fetchImpl })).rejects.toMatchObject({ status: 422 })
    expect(fetchImpl).toHaveBeenCalledTimes(1)
  })

  it('throws SttError when upload fails', async () => {
    const fetchImpl = vi.fn().mockResolvedValueOnce(json({}, false))
    await expect(transcribeAudio({ ...base, fetchImpl })).rejects.toBeInstanceOf(SttError)
  })

  it('throws when the run fails', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(json({ url: 'https://static/x', metadata: { duration: 3 } }))
      .mockResolvedValueOnce(json({ runId: 'r' }))
      .mockResolvedValueOnce(json({ status: 'FAILED' }))
    await expect(transcribeAudio({ ...base, fetchImpl })).rejects.toMatchObject({ status: 502 })
  })

  it('times out with 504 if the run never finishes', async () => {
    const fetchImpl = vi.fn(async (url) =>
      String(url).includes('/uploads')
        ? json({ url: 'https://static/x', metadata: { duration: 3 } })
        : String(url).endsWith('/run')
          ? json({ runId: 'r' })
          : json({ status: 'RUNNING' }),
    )
    await expect(transcribeAudio({ ...base, fetchImpl })).rejects.toMatchObject({ status: 504 })
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

  it('returns 504 when polling runs past the deadline', async () => {
    vi.useFakeTimers()
    try {
      const fetchImpl = vi.fn(async (url) =>
        String(url).includes('/uploads')
          ? json({ url: 'https://static/x', metadata: { duration: 3 } })
          : String(url).endsWith('/run')
            ? json({ runId: 'r' })
            : json({ status: 'RUNNING' }),
      )
      const p = transcribeAudio({ ...base, fetchImpl, deadlineMs: 5000 })
      const assertion = expect(p).rejects.toMatchObject({ status: 504 })
      await vi.advanceTimersByTimeAsync(6000)
      await assertion
      expect(fetchImpl.mock.calls.length).toBeLessThan(10)
    } finally {
      vi.useRealTimers()
    }
  })
})
