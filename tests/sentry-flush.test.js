// @vitest-environment node
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import { createRequire } from 'module'

const require = createRequire(import.meta.url)

const sentry = {
  init: vi.fn(),
  captureMessage: vi.fn(),
  flush: vi.fn(() => Promise.resolve(true)),
}
let server, base
const realFetch = globalThis.fetch

beforeAll(async () => {
  process.env.NODE_ENV = 'production'
  process.env.SENTRY_DSN = 'https://public@example.invalid/1'
  process.env.OPENAI_API_KEY = 'test-key'
  process.env.TTS_DEADLINE_MS = '300'
  delete process.env.UPSTASH_REDIS_REST_URL
  delete process.env.KV_REST_API_URL
  const sentryPath = require.resolve('@sentry/node', { paths: [require.resolve('../api/index.js')] })
  require.cache[sentryPath] = { id: sentryPath, filename: sentryPath, loaded: true, exports: sentry }
  const app = require('../api/index.js')
  await new Promise((resolve) => {
    server = app.listen(0, '127.0.0.1', resolve)
  })
  base = `http://127.0.0.1:${server.address().port}`
})

afterAll(() => {
  delete process.env.SENTRY_DSN
  return new Promise((resolve) => server.close(resolve))
})

describe('Sentry 5xx reporting', () => {
  it('flushes after capturing a server error so serverless freeze cannot drop it', async () => {
    vi.stubGlobal('fetch', (url, init) =>
      String(url).startsWith(base)
        ? realFetch(url, init)
        : new Promise((_, reject) => init?.signal?.addEventListener('abort', () => reject(init.signal.reason))),
    )
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const res = await realFetch(base + '/tts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: 'Hello', language: 'en' }),
    })
    vi.stubGlobal('fetch', realFetch)
    errSpy.mockRestore()
    expect(res.status).toBeGreaterThanOrEqual(500)
    await vi.waitFor(() => expect(sentry.captureMessage).toHaveBeenCalled())
    expect(sentry.flush).toHaveBeenCalledWith(2000)
    expect(sentry.captureMessage.mock.invocationCallOrder[0]).toBeLessThan(sentry.flush.mock.invocationCallOrder[0])
  })
})
