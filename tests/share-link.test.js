// @vitest-environment jsdom
import { describe, it, expect } from 'vitest'
import fs from 'fs'
import path from 'path'

const read = (name) => fs.readFileSync(path.resolve(process.cwd(), name), 'utf8')

function loadModule() {
  const mod = { exports: {} }
  new Function('module', 'exports', read('lib/share-link.js'))(mod, mod.exports)
  return mod.exports
}

const LANGS = ['en', 'es', 'fr', 'de']

describe('share link', () => {
  it('builds a link that carries text, source and target', () => {
    const { buildShareUrl } = loadModule()
    const url = new URL(buildShareUrl('https://pollyglot-topaz.vercel.app', { text: 'Good morning', from: 'en', to: 'fr' }))
    expect(url.pathname).toBe('/')
    expect(url.searchParams.get('t')).toBe('Good morning')
    expect(url.searchParams.get('from')).toBe('en')
    expect(url.searchParams.get('to')).toBe('fr')
  })

  it('omits from when the source is auto-detected', () => {
    const { buildShareUrl } = loadModule()
    const url = new URL(buildShareUrl('https://x.test', { text: 'hi', from: null, to: 'es' }))
    expect(url.searchParams.has('from')).toBe(false)
  })

  it('round-trips text with unicode, quotes and ampersands', () => {
    const { buildShareUrl, parseShareParams } = loadModule()
    const text = 'Où est "la gare" & le café? ¿Sí?'
    const url = new URL(buildShareUrl('https://x.test', { text, from: 'fr', to: 'en' }))
    expect(parseShareParams(url.search, LANGS)).toEqual({ text, from: 'fr', to: 'en' })
  })

  it('returns null when there is no text param', () => {
    const { parseShareParams } = loadModule()
    expect(parseShareParams('', LANGS)).toBeNull()
    expect(parseShareParams('?to=fr', LANGS)).toBeNull()
    expect(parseShareParams('?t=%20%20&to=fr', LANGS)).toBeNull()
  })

  it('ignores unknown language codes instead of trusting the link', () => {
    const { parseShareParams } = loadModule()
    expect(parseShareParams('?t=hi&from=zz&to=<script>', LANGS)).toEqual({ text: 'hi', from: null, to: null })
  })

  it('refuses text over the 5000 character limit', () => {
    const { parseShareParams, buildShareUrl } = loadModule()
    expect(parseShareParams('?t=' + 'a'.repeat(5001), LANGS)).toBeNull()
    expect(buildShareUrl('https://x.test', { text: 'a'.repeat(5001), from: null, to: 'es' })).toBeNull()
  })

  it('keeps links short enough to paste: no link for text past 1000 characters', () => {
    const { buildShareUrl } = loadModule()
    expect(buildShareUrl('https://x.test', { text: 'a'.repeat(1001), from: null, to: 'es' })).toBeNull()
  })

  it('is loaded by the page and cached by the service worker', () => {
    expect(read('index.html')).toContain('lib/share-link.js')
    expect(read('sw.js')).toContain("'/lib/share-link.js'")
  })
})
