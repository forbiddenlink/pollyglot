// @vitest-environment node
import { describe, expect, it } from 'vitest'
import fs from 'node:fs'
import vm from 'node:vm'
const source = fs.readFileSync(new URL('../script.js', import.meta.url), 'utf8')
const loader = source.slice(source.indexOf('function loadHistory()'), source.indexOf('function renderHistory()'))
const valid = { sourceText: 'hello', targetText: 'hola', sourceLang: 'en', targetLang: 'es', timestamp: 1234, favorite: true }
function load(value) {
  const context = vm.createContext({ localStorage: { getItem: () => JSON.stringify(value) }, console })
  vm.runInContext('let translationHistory = []; ' + loader + '; loadHistory();', context)
  return JSON.parse(vm.runInContext('JSON.stringify(translationHistory)', context))
}
describe('history recovery from synthetic storage', () => {
  it.each([null, {}, [null], [{ sourceText: 'incomplete' }]])('ignores invalid structures', value => {
    expect(load(value)).toEqual([])
  })
  it('preserves valid records, order and extra metadata among malformed neighbors', () => {
    const second = { ...valid, timestamp: '2026-01-01T00:00:00Z' }
    expect(load([null, valid, {}, second, { ...valid, timestamp: 'invalid' }])).toEqual([valid, second])
  })
})
