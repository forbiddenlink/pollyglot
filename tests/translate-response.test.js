// @vitest-environment node
import { describe, expect, it } from 'vitest'
import fs from 'node:fs'
import vm from 'node:vm'
const source = fs.readFileSync(new URL('../script.js', import.meta.url), 'utf8')
const start = source.indexOf('async function readTranslateResponse(')
const end = source.indexOf('// Fixed user-facing copy.')
const helpers = source.slice(start, end) + source.slice(end, source.indexOf('// On narrow screens'))
const context = vm.createContext({ Error })
vm.runInContext(helpers, context)
const readTranslateResponse = vm.runInContext('readTranslateResponse', context)
const translationFailureMessage = vm.runInContext('translationFailureMessage', context)

const htmlPage = (status) => ({
  ok: false,
  status,
  json: async () => { throw new SyntaxError('Unexpected token < in JSON at position 0') },
})

describe('readTranslateResponse', () => {
  it('keeps the HTTP status when an error response is not JSON (e.g. a 429 gateway page)', async () => {
    const error = await readTranslateResponse(htmlPage(429)).catch((e) => e)
    expect(error).toBeInstanceOf(Error)
    expect(error.status).toBe(429)
    expect(error.name).not.toBe('SyntaxError')
    expect(translationFailureMessage(error.status)).toMatch(/Too many requests/)
  })

  it('reports a readable error for a non-JSON 502', async () => {
    const error = await readTranslateResponse(htmlPage(502)).catch((e) => e)
    expect(error.status).toBe(502)
    expect(error.message).toMatch(/502/)
  })

  it('uses the JSON error body when present', async () => {
    const error = await readTranslateResponse({ ok: false, status: 400, json: async () => ({ error: 'bad text' }) }).catch((e) => e)
    expect(error.status).toBe(400)
    expect(error.message).toBe('bad text')
  })

  it('reports an unreadable success body', async () => {
    const error = await readTranslateResponse({ ok: true, status: 200, json: async () => { throw new SyntaxError('x') } }).catch((e) => e)
    expect(error.message).toMatch(/unreadable/i)
  })

  it('returns parsed data on success', async () => {
    const data = await readTranslateResponse({ ok: true, status: 200, json: async () => ({ translation: 'hola' }) })
    expect(data.translation).toBe('hola')
  })
})
