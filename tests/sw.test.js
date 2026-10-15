// @vitest-environment node
import { describe, it, expect, vi } from 'vitest'
import fs from 'fs'
import vm from 'vm'

function loadSw() {
  const listeners = {}
  const store = new Map([['pollyglot-v3', 1], ['pollyglot-v2', 1]])
  const added = []
  const self = {
    addEventListener: (type, fn) => { listeners[type] = fn },
    skipWaiting: async () => {},
    clients: { claim: async () => {} },
  }
  const caches = {
    open: async (name) => { store.set(name, 1); return { add: async (u) => { added.push(u) } } },
    keys: async () => [...store.keys()],
    delete: async (name) => { store.delete(name) },
    match: async () => undefined,
  }
  vm.runInNewContext(fs.readFileSync(new URL('../sw.js', import.meta.url), 'utf8'), {
    self, caches, console, fetch: vi.fn(),
  })
  const run = async (type) => {
    let p
    listeners[type]({ waitUntil: (x) => { p = x } })
    await p
  }
  return { run, store, added }
}

describe('service worker cache', () => {
  it('uses a new cache name, precaches lib/server-stt.js, and deletes old caches on activate', async () => {
    const { run, store, added } = loadSw()
    await run('install')
    expect(added).toContain('/lib/server-stt.js')
    expect(added).toContain('/script.js')
    await run('activate')
    expect([...store.keys()]).toEqual(['pollyglot-v4'])
  })
})
