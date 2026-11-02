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
  process.env.OPENAI_API_KEY = 'test-key'
  process.env.RESEND_API_KEY = 're_test_key'
  const app = require('../api/index.js')
  await new Promise((resolve) => {
    server = app.listen(0, '127.0.0.1', resolve)
  })
  base = `http://127.0.0.1:${server.address().port}`
})

afterAll(() => new Promise((resolve) => server.close(resolve)))

// Local requests go to the real server; every outbound provider call is recorded and mocked.
function stubProviders(providerResponse) {
  const outbound = []
  vi.stubGlobal('fetch', (url, init) => {
    if (String(url).startsWith(base)) return realFetch(url, init)
    outbound.push(String(url))
    return Promise.resolve(providerResponse(String(url)))
  })
  return outbound
}

function openAiOk(content) {
  return { ok: true, status: 200, json: async () => ({ choices: [{ message: { content } }] }) }
}

function postJson(path, body) {
  return realFetch(base + path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

describe('POST /translate', () => {
  it('translates and never calls an email provider, even when emailAddress is supplied', async () => {
    const outbound = stubProviders(() => openAiOk('Bonjour'))
    const res = await postJson('/translate', {
      text: 'Hello',
      sourceLang: 'en',
      targetLang: 'fr',
      emailAddress: 'victim@example.com',
    })
    vi.stubGlobal('fetch', realFetch)
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ translation: 'Bonjour' })
    expect(outbound.filter((u) => u.includes('resend.com'))).toEqual([])
  })
})

describe('provider error text never reaches the client', () => {
  const upstream = 'Incorrect API key provided: sk-test-abcdef. Org org-secret.'
  const openAiFails = () => ({ ok: false, status: 500, json: async () => ({ error: { message: upstream } }) })
  const bodies = {
    '/translate': { text: 'Hello', sourceLang: 'en', targetLang: 'fr' },
    '/detect': { text: 'Hello there' },
    '/pronunciation': { text: 'Bonjour', targetLang: 'French' },
    '/alternatives': { text: 'Hello', sourceLang: 'en', targetLang: 'fr' },
    '/tts': { text: 'Hello', language: 'en' },
  }

  for (const [path, body] of Object.entries(bodies)) {
    it(`${path} returns a generic message when OpenAI errors`, async () => {
      stubProviders(openAiFails)
      const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
      const res = await postJson(path, body)
      vi.stubGlobal('fetch', realFetch)
      const text = await res.text()
      errSpy.mockRestore()
      expect(res.status).toBeGreaterThanOrEqual(500)
      expect(text).not.toContain('sk-test')
      expect(text).not.toContain('org-secret')
      expect(text).not.toContain('Incorrect API key')
    })
  }
})
