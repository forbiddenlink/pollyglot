// @vitest-environment node
import { describe, it, expect, vi } from 'vitest'
import { createRequire } from 'module'

const require = createRequire(import.meta.url)
const ServerStt = require('../lib/server-stt.js')

describe('ServerStt.isSupported', () => {
  it('needs MediaRecorder and getUserMedia', () => {
    expect(ServerStt.isSupported({})).toBe(false)
    expect(ServerStt.isSupported({ MediaRecorder: function () {}, navigator: {} })).toBe(false)
    expect(
      ServerStt.isSupported({
        MediaRecorder: function () {},
        navigator: { mediaDevices: { getUserMedia: () => {} } },
      }),
    ).toBe(true)
  })
})

describe('ServerStt.pickMimeType', () => {
  it('picks the first supported candidate', () => {
    const MR = { isTypeSupported: (t) => t === 'audio/mp4' }
    expect(ServerStt.pickMimeType(MR)).toBe('audio/mp4')
  })
  it('returns empty string when none or no API', () => {
    expect(ServerStt.pickMimeType({ isTypeSupported: () => false })).toBe('')
    expect(ServerStt.pickMimeType(undefined)).toBe('')
  })
})

describe('ServerStt.transcribe', () => {
  const blob = new Blob(['x'], { type: 'audio/webm;codecs=opus' })

  it('posts audio with base content type and lang query', async () => {
    const fetchImpl = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ text: 'hola' }) })
    expect(await ServerStt.transcribe(blob, 'es', fetchImpl)).toBe('hola')
    expect(fetchImpl).toHaveBeenCalledWith('/api/transcribe?lang=es', expect.objectContaining({
      method: 'POST',
      headers: { 'Content-Type': 'audio/webm' },
    }))
  })
  it('omits lang when unset', async () => {
    const fetchImpl = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ text: '' }) })
    await ServerStt.transcribe(blob, null, fetchImpl)
    expect(fetchImpl.mock.calls[0][0]).toBe('/api/transcribe')
  })
  it('surfaces server error messages', async () => {
    const fetchImpl = vi.fn().mockResolvedValue({ ok: false, json: async () => ({ error: 'Too many requests' }) })
    await expect(ServerStt.transcribe(blob, 'es', fetchImpl)).rejects.toThrow('Too many requests')
  })
  it('rejects empty recordings without calling the server', async () => {
    const fetchImpl = vi.fn()
    await expect(ServerStt.transcribe(new Blob([]), 'es', fetchImpl)).rejects.toThrow('No audio recorded')
    expect(fetchImpl).not.toHaveBeenCalled()
  })
})
