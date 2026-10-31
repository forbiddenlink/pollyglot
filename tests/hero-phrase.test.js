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
  const card = read('index.html').match(/<aside class="hero-card"[\s\S]*?<\/aside>/)
  expect(card, 'index.html has the hero card').not.toBeNull()
  document.body.innerHTML = `<div id="home">${card[0]}</div><main id="translator"></main>`
  return document.querySelector('.hero-card')
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
  it('uses only foreign-language text already present on the 404 page', () => {
    const { PHRASES } = loadModule()
    const page = read('404.html')
    expect(PHRASES.length).toBeGreaterThanOrEqual(2)
    for (const p of PHRASES) {
      expect(page).toContain(`lang="${p.lang}">${p.text}<`)
    }
  })
})

describe('hero phrase card', () => {
  let api
  beforeEach(() => { api = loadModule() })

  it('swaps the phrase, lang attribute, chip and pressed state from the language control', () => {
    const card = mountCard()
    const { win } = fakeWindow()
    api.init(card, win)
    const fr = [...card.querySelectorAll('[data-hero-lang]')].find((b) => b.dataset.heroLang === 'fr')
    fr.click()
    const text = card.querySelector('.hero-phrase')
    expect(text.textContent).toBe('Page introuvable')
    expect(text.getAttribute('lang')).toBe('fr')
    expect(card.querySelector('.hero-chip-name').textContent).toBe('French')
    expect(fr.getAttribute('aria-pressed')).toBe('true')
    expect(card.querySelectorAll('[aria-pressed="true"]').length).toBe(1)
  })

  it('keeps the play button hidden when speech synthesis is missing', () => {
    const card = mountCard()
    api.init(card, fakeWindow({ withSpeech: false }).win)
    expect(card.querySelector('.hero-play').hidden).toBe(true)
  })

  it('keeps the play button hidden when no voice matches the language', () => {
    const card = mountCard()
    api.init(card, fakeWindow({ voices: [{ lang: 'de-DE', name: 'Anna' }] }).win)
    expect(card.querySelector('.hero-play').hidden).toBe(true)
  })

  it('speaks the visible phrase with a matching voice, and stops on a second press', () => {
    const card = mountCard()
    const voice = { lang: 'es-MX', name: 'Paulina' }
    const { win, synth, spoken } = fakeWindow({ voices: [{ lang: 'de-DE' }, voice] })
    api.init(card, win)
    const play = card.querySelector('.hero-play')
    expect(play.hidden).toBe(false)
    play.click()
    expect(spoken[0].text).toBe('Página no encontrada')
    expect(spoken[0].lang).toBe('es')
    expect(spoken[0].voice).toBe(voice)
    play.click()
    expect(synth.cancel).toHaveBeenCalled()
  })

  it('moves the card below the translator on narrow screens and back on wide ones', () => {
    const card = mountCard()
    const { win } = fakeWindow({ matches: true })
    api.init(card, win)
    expect(document.getElementById('translator').nextElementSibling).toBe(card)
    api.place(card, false)
    expect(card.parentElement.id).toBe('home')
  })
})

describe('hero markup', () => {
  it('drops the decorative ribbon, keeps the H1, and loads the script after script.js', () => {
    const html = read('index.html')
    expect(html).not.toContain('script-ribbon')
    expect(html).toContain('<h1>A world of words.<br>A little <em>closer.</em></h1>')
    expect(html.indexOf('src="script.js"')).toBeLessThan(html.indexOf('src="hero-phrase.js"'))
  })

  it('precaches hero-phrase.js in the service worker', () => {
    expect(read('sw.js')).toContain("'/hero-phrase.js'")
  })
})
