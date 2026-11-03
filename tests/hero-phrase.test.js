// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import fs from 'fs'
import path from 'path'

const read = (name) => fs.readFileSync(path.resolve(process.cwd(), name), 'utf8')

function loadModule() {
  const mod = { exports: {} }
  new Function('module', 'exports', read('hero-phrase.js'))(mod, mod.exports)
  return mod.exports
}

function mountCard() {
  const card = read('index.html').match(/<aside class="route"[\s\S]*?<\/aside>/)
  expect(card, 'index.html has the hero route map').not.toBeNull()
  document.body.innerHTML = `<div id="home">${card[0]}</div><main id="translator"></main>`
  return document.querySelector('.route')
}

function fakeWindow({ voices = [], matches = false, withSpeech = true } = {}) {
  const spoken = []
  const synth = {
    speaking: false,
    getVoices: () => voices,
    addEventListener: () => {},
    cancel: vi.fn(() => { synth.speaking = false }),
    speak: vi.fn((u) => { spoken.push(u); synth.speaking = true }),
  }
  class Utterance { constructor(text) { this.text = text } }
  const mq = { matches, addEventListener: () => {} }
  const win = { matchMedia: () => mq, SpeechSynthesisUtterance: Utterance }
  if (withSpeech) win.speechSynthesis = synth
  return { win, synth, spoken }
}

describe('hero phrase data', () => {
  it('holds one greeting per language, all meaning Hello', () => {
    const { PHRASES } = loadModule()
    expect(PHRASES.map((p) => [p.lang, p.text])).toEqual([
      ['es', 'Hola'],
      ['fr', 'Bonjour'],
      ['ja', 'こんにちは'],
    ])
    expect(read('index.html')).toContain('<p class="route-word" lang="en">Hello</p>')
  })
})

describe('hero route map', () => {
  let api
  beforeEach(() => { api = loadModule() })

  it('renders every language row in the markup, each with a lang attribute and its word', () => {
    const card = mountCard()
    const rows = [...card.querySelectorAll('[data-hero-lang]')]
    expect(rows.map((r) => r.dataset.heroLang)).toEqual(['es', 'fr', 'ja'])
    expect(rows.map((r) => r.querySelector('.leg-word').textContent)).toEqual(['Hola', 'Bonjour', 'こんにちは'])
    expect(rows.map((r) => r.querySelector('.leg-word').getAttribute('lang'))).toEqual(['es', 'fr', 'ja'])
    expect(rows[2].querySelector('.leg-say').textContent).toBe('konnichiwa')
  })

  it('keeps every play button hidden when speech synthesis is missing', () => {
    const card = mountCard()
    api.init(card, fakeWindow({ withSpeech: false }).win)
    expect([...card.querySelectorAll('.hero-play')].every((b) => b.hidden)).toBe(true)
  })

  it('shows the play button only for languages that have a matching voice', () => {
    const card = mountCard()
    api.init(card, fakeWindow({ voices: [{ lang: 'de-DE', name: 'Anna' }, { lang: 'fr-FR', name: 'Thomas' }] }).win)
    const hidden = Object.fromEntries([...card.querySelectorAll('[data-hero-lang]')].map((r) => [r.dataset.heroLang, r.querySelector('.hero-play').hidden]))
    expect(hidden).toEqual({ es: true, fr: false, ja: true })
  })

  it('speaks the pressed row with a matching voice, and stops on a second press', () => {
    const card = mountCard()
    const voice = { lang: 'es-MX', name: 'Paulina' }
    const { win, synth, spoken } = fakeWindow({ voices: [{ lang: 'de-DE' }, voice] })
    api.init(card, win)
    const row = card.querySelector('[data-hero-lang="es"]')
    const play = row.querySelector('.hero-play')
    expect(play.hidden).toBe(false)
    play.click()
    expect(spoken[0].text).toBe('Hola')
    expect(spoken[0].lang).toBe('es')
    expect(spoken[0].voice).toBe(voice)
    expect(row.hasAttribute('data-speaking')).toBe(true)
    expect(play.getAttribute('aria-label')).toBe('Stop the Spanish phrase')
    play.click()
    expect(synth.cancel).toHaveBeenCalled()
    expect(row.hasAttribute('data-speaking')).toBe(false)
    expect(play.getAttribute('aria-label')).toBe('Hear the Spanish phrase')
  })

  it('moves the speaking state to the newest row', () => {
    const card = mountCard()
    const { win } = fakeWindow({ voices: [{ lang: 'es-MX' }, { lang: 'fr-FR' }] })
    api.init(card, win)
    const es = card.querySelector('[data-hero-lang="es"]')
    const fr = card.querySelector('[data-hero-lang="fr"]')
    es.querySelector('.hero-play').click()
    fr.querySelector('.hero-play').click()
    expect(es.hasAttribute('data-speaking')).toBe(false)
    expect(fr.hasAttribute('data-speaking')).toBe(true)
  })
})

describe('hero markup', () => {
  it('drops the decorative ribbon, keeps the H1 copy without an accent word, and loads the script after script.js', () => {
    const html = read('index.html')
    expect(html).not.toContain('script-ribbon')
    expect(html).toContain('<h1>A world of words.<br>A little closer.</h1>')
    expect(html.indexOf('src="script.js"')).toBeLessThan(html.indexOf('src="hero-phrase.js"'))
  })

  it('precaches hero-phrase.js in the service worker', () => {
    expect(read('sw.js')).toContain("'/hero-phrase.js'")
  })
})
