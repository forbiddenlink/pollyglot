/**
 * Text-to-Speech Library for PollyGlot
 * Uses Web Speech API with fallback support
 */

// State
let currentUtterance = null
let voicesLoaded = false
let voicesLoadedPromise = null
let ttsSettings = {
  rate: 0.9,
  pitch: 1.0,
  volume: 1.0,
}

// Language to BCP 47 tag mapping
const LANGUAGE_TAGS = {
  en: ['en-US', 'en-GB', 'en-AU', 'en-IN'],
  es: ['es-ES', 'es-MX', 'es-US', 'es-AR'],
  fr: ['fr-FR', 'fr-CA', 'fr-BE'],
  de: ['de-DE', 'de-AT', 'de-CH'],
  it: ['it-IT', 'it-CH'],
  pt: ['pt-PT', 'pt-BR'],
  ja: ['ja-JP'],
  zh: ['zh-CN', 'zh-TW', 'zh-HK', 'cmn-Hans-CN'],
  ko: ['ko-KR'],
  ru: ['ru-RU'],
  ar: ['ar-SA', 'ar-AE', 'ar-EG'],
  hi: ['hi-IN'],
  nl: ['nl-NL', 'nl-BE'],
  pl: ['pl-PL'],
  tr: ['tr-TR'],
  vi: ['vi-VN'],
  th: ['th-TH'],
  sv: ['sv-SE'],
  el: ['el-GR'],
  he: ['he-IL'],
}

// Language display names
const LANGUAGE_NAMES = {
  en: 'English',
  es: 'Spanish',
  fr: 'French',
  de: 'German',
  it: 'Italian',
  pt: 'Portuguese',
  ja: 'Japanese',
  zh: 'Chinese',
  ko: 'Korean',
  ru: 'Russian',
  ar: 'Arabic',
  hi: 'Hindi',
  nl: 'Dutch',
  pl: 'Polish',
  tr: 'Turkish',
  vi: 'Vietnamese',
  th: 'Thai',
  sv: 'Swedish',
  el: 'Greek',
  he: 'Hebrew',
}

/**
 * Check if TTS is supported in the browser
 * @returns {boolean}
 */
export function isTTSSupported() {
  return 'speechSynthesis' in window && 'SpeechSynthesisUtterance' in window
}

/**
 * Initialize TTS and load voices
 * Call this early in app lifecycle
 * @returns {Promise<SpeechSynthesisVoice[]>}
 */
export function initTTS() {
  if (!isTTSSupported()) {
    return Promise.resolve([])
  }

  if (voicesLoadedPromise) {
    return voicesLoadedPromise
  }

  voicesLoadedPromise = new Promise((resolve) => {
    const loadVoices = () => {
      const voices = window.speechSynthesis.getVoices()
      if (voices.length > 0) {
        voicesLoaded = true
        resolve(voices)
      }
    }

    // Try immediate load
    loadVoices()

    // Also listen for voiceschanged event (Chrome)
    if (!voicesLoaded) {
      window.speechSynthesis.onvoiceschanged = () => {
        loadVoices()
      }

      // Timeout fallback
      setTimeout(() => {
        if (!voicesLoaded) {
          const voices = window.speechSynthesis.getVoices()
          voicesLoaded = true
          resolve(voices)
        }
      }, 1000)
    }
  })

  return voicesLoadedPromise
}

/**
 * Get all available voices
 * @returns {SpeechSynthesisVoice[]}
 */
export function getVoices() {
  if (!isTTSSupported()) {
    return []
  }
  return window.speechSynthesis.getVoices()
}

/**
 * Get voices available for a specific language
 * @param {string} lang - Language code (e.g., 'en', 'es')
 * @returns {SpeechSynthesisVoice[]}
 */
export function getVoicesForLanguage(lang) {
  const allVoices = getVoices()
  const tags = LANGUAGE_TAGS[lang] || [lang]

  return allVoices.filter((voice) => {
    const voiceLang = voice.lang.toLowerCase()
    return tags.some(
      (tag) =>
        voiceLang.startsWith(tag.toLowerCase()) ||
        voiceLang.startsWith(lang.toLowerCase())
    )
  })
}

/**
 * Get the best voice for a language
 * Prefers local voices, then falls back to remote
 * @param {string} lang - Language code
 * @returns {SpeechSynthesisVoice | null}
 */
export function getVoiceForLanguage(lang) {
  const voices = getVoicesForLanguage(lang)

  if (voices.length === 0) {
    return null
  }

  // Prefer local (non-network) voices for better performance
  const localVoice = voices.find((v) => v.localService)
  if (localVoice) {
    return localVoice
  }

  // Prefer default voices
  const defaultVoice = voices.find((v) => v.default)
  if (defaultVoice) {
    return defaultVoice
  }

  // Return first available
  return voices[0]
}

/**
 * Check if a voice is available for a language
 * @param {string} lang - Language code
 * @returns {boolean}
 */
export function hasVoiceForLanguage(lang) {
  return getVoicesForLanguage(lang).length > 0
}

/**
 * Set speech rate
 * @param {number} rate - Speech rate (0.1 to 10, default 1)
 */
export function setRate(rate) {
  ttsSettings.rate = Math.max(0.1, Math.min(10, rate))
}

/**
 * Set speech pitch
 * @param {number} pitch - Pitch (0 to 2, default 1)
 */
export function setPitch(pitch) {
  ttsSettings.pitch = Math.max(0, Math.min(2, pitch))
}

/**
 * Set speech volume
 * @param {number} volume - Volume (0 to 1, default 1)
 */
export function setVolume(volume) {
  ttsSettings.volume = Math.max(0, Math.min(1, volume))
}

/**
 * Get current TTS settings
 * @returns {{ rate: number, pitch: number, volume: number }}
 */
export function getSettings() {
  return { ...ttsSettings }
}

/**
 * Update all TTS settings at once
 * @param {{ rate?: number, pitch?: number, volume?: number }} settings
 */
export function updateSettings(settings) {
  if (settings.rate !== undefined) setRate(settings.rate)
  if (settings.pitch !== undefined) setPitch(settings.pitch)
  if (settings.volume !== undefined) setVolume(settings.volume)
}

/**
 * Speak text in specified language
 * @param {string} text - Text to speak
 * @param {string} lang - Language code
 * @param {object} options - Optional settings
 * @param {SpeechSynthesisVoice} options.voice - Specific voice to use
 * @param {number} options.rate - Speech rate override
 * @param {number} options.pitch - Pitch override
 * @param {number} options.volume - Volume override
 * @param {Function} options.onStart - Callback when speech starts
 * @param {Function} options.onEnd - Callback when speech ends
 * @param {Function} options.onError - Callback on error
 * @param {Function} options.onBoundary - Callback on word boundaries
 * @returns {Promise<void>}
 */
export function speak(text, lang, options = {}) {
  return new Promise((resolve, reject) => {
    if (!isTTSSupported()) {
      const error = new Error('Text-to-speech is not supported in this browser')
      if (options.onError) options.onError(error)
      reject(error)
      return
    }

    if (!text || !text.trim()) {
      const error = new Error('No text to speak')
      if (options.onError) options.onError(error)
      reject(error)
      return
    }

    // Stop any current speech
    stop()

    // Create utterance
    const utterance = new SpeechSynthesisUtterance(text)

    // Set language
    const tags = LANGUAGE_TAGS[lang]
    utterance.lang = tags ? tags[0] : lang

    // Set voice
    const voice = options.voice || getVoiceForLanguage(lang)
    if (voice) {
      utterance.voice = voice
    }

    // Set rate, pitch, volume
    utterance.rate = options.rate ?? ttsSettings.rate
    utterance.pitch = options.pitch ?? ttsSettings.pitch
    utterance.volume = options.volume ?? ttsSettings.volume

    // Event handlers
    utterance.onstart = () => {
      currentUtterance = utterance
      if (options.onStart) options.onStart()
    }

    utterance.onend = () => {
      currentUtterance = null
      if (options.onEnd) options.onEnd()
      resolve()
    }

    utterance.onerror = (event) => {
      currentUtterance = null
      const error = new Error(`Speech synthesis error: ${event.error}`)
      if (options.onError) options.onError(error)
      reject(error)
    }

    utterance.onboundary = (event) => {
      if (options.onBoundary) options.onBoundary(event)
    }

    // Speak
    try {
      window.speechSynthesis.speak(utterance)
    } catch (error) {
      currentUtterance = null
      if (options.onError) options.onError(error)
      reject(error)
    }
  })
}

/**
 * Stop any current speech
 */
export function stop() {
  if (!isTTSSupported()) return

  window.speechSynthesis.cancel()
  currentUtterance = null
}

/**
 * Pause current speech
 */
export function pause() {
  if (!isTTSSupported()) return
  window.speechSynthesis.pause()
}

/**
 * Resume paused speech
 */
export function resume() {
  if (!isTTSSupported()) return
  window.speechSynthesis.resume()
}

/**
 * Check if currently speaking
 * @returns {boolean}
 */
export function isSpeaking() {
  if (!isTTSSupported()) return false
  return window.speechSynthesis.speaking
}

/**
 * Check if speech is paused
 * @returns {boolean}
 */
export function isPaused() {
  if (!isTTSSupported()) return false
  return window.speechSynthesis.paused
}

/**
 * Get supported languages with available voices
 * @returns {Array<{ code: string, name: string, voices: SpeechSynthesisVoice[] }>}
 */
export function getSupportedLanguages() {
  const supported = []

  for (const [code, name] of Object.entries(LANGUAGE_NAMES)) {
    const voices = getVoicesForLanguage(code)
    if (voices.length > 0) {
      supported.push({ code, name, voices })
    }
  }

  return supported
}

/**
 * Get language name from code
 * @param {string} code - Language code
 * @returns {string}
 */
export function getLanguageName(code) {
  return LANGUAGE_NAMES[code] || code
}

// Export settings getters for convenience
export { LANGUAGE_TAGS, LANGUAGE_NAMES }
