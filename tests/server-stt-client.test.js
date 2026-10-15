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

describe('ServerStt.startRecording', () => {
  function makeEnv({ ctorThrows = false, startThrows = false } = {}) {
    const track = { stop: vi.fn() }
    const instances = []
    class MR {
      static isTypeSupported() { return true }
      constructor() {
        if (ctorThrows) throw new Error('ctor')
        this.state = 'inactive'
        this.mimeType = 'audio/webm'
        instances.push(this)
      }
      start() {
        if (startThrows) throw new Error('start')
        this.state = 'recording'
      }
      stop() {
        this.state = 'inactive'
        this.ondataavailable({ data: new Blob(['x']) })
        this.onstop()
      }
    }
    const env = {
      MediaRecorder: MR,
      navigator: { mediaDevices: { getUserMedia: async () => ({ getTracks: () => [track] }) } },
    }
    return { env, track, instances }
  }

  it('releases mic tracks when the MediaRecorder constructor throws', async () => {
    const { env, track } = makeEnv({ ctorThrows: true })
    await expect(ServerStt.startRecording(env)).rejects.toThrow('ctor')
    expect(track.stop).toHaveBeenCalled()
  })

  it('releases mic tracks when start() throws', async () => {
    const { env, track } = makeEnv({ startThrows: true })
    await expect(ServerStt.startRecording(env)).rejects.toThrow('start')
    expect(track.stop).toHaveBeenCalled()
  })

  it('manual stop resolves done once and releases tracks', async () => {
    const { env, track } = makeEnv()
    const session = await ServerStt.startRecording(env)
    const blob = await session.stop()
    expect(blob.size).toBe(1)
    expect(await session.done).toBe(blob)
    expect(track.stop).toHaveBeenCalledTimes(1)
  })

  it('60s auto-stop resolves done without anyone calling stop()', async () => {
    vi.useFakeTimers()
    try {
      const { env, track } = makeEnv()
      const session = await ServerStt.startRecording(env)
      let resolved = false
      session.done.then(() => { resolved = true })
      await vi.advanceTimersByTimeAsync(ServerStt.MAX_SECONDS * 1000 + 1)
      expect(resolved).toBe(true)
      expect(track.stop).toHaveBeenCalled()
    } finally {
      vi.useRealTimers()
    }
  })
})
