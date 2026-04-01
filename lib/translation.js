/**
 * LibreTranslate API client
 * Supports both self-hosted and public LibreTranslate instances
 */

const DEFAULT_URL = 'https://libretranslate.com'

/**
 * @typedef {object} TranslationOptions
 * @property {string} [apiUrl] - LibreTranslate API URL (defaults to https://libretranslate.com)
 * @property {string} [apiKey] - API key for authenticated requests
 */

/**
 * @typedef {object} DetectionResult
 * @property {string} language - Detected language code
 * @property {number} confidence - Confidence score (0-1)
 */

/**
 * @typedef {object} Language
 * @property {string} code - Language code (e.g., 'en', 'es')
 * @property {string} name - Language name (e.g., 'English', 'Spanish')
 */

/**
 * Create a translation client
 * @param {TranslationOptions} options - Client configuration
 * @returns {object} Translation client methods
 */
export function createTranslationClient(options = {}) {
  const apiUrl = options.apiUrl ?? DEFAULT_URL
  const apiKey = options.apiKey

  /**
   * Make a request to the LibreTranslate API
   * @param {string} endpoint - API endpoint
   * @param {object} body - Request body
   * @returns {Promise<any>} Response data
   */
  async function request(endpoint, body) {
    const payload = apiKey ? { ...body, api_key: apiKey } : body

    const res = await fetch(`${apiUrl}${endpoint}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })

    if (!res.ok) {
      const error = await res.json().catch(() => ({ error: res.statusText }))
      throw new Error(error.error ?? `Translation API error: ${res.status}`)
    }

    return res.json()
  }

  return {
    /**
     * Translate text from one language to another
     * @param {string} text - Text to translate
     * @param {string} sourceLang - Source language code (e.g., 'en') or 'auto' for detection
     * @param {string} targetLang - Target language code (e.g., 'es')
     * @returns {Promise<string>} Translated text
     */
    async translate(text, sourceLang, targetLang) {
      const data = await request('/translate', {
        q: text,
        source: sourceLang,
        target: targetLang,
      })
      return data.translatedText
    },

    /**
     * Detect the language of text
     * @param {string} text - Text to analyze
     * @returns {Promise<DetectionResult[]>} Array of detection results sorted by confidence
     */
    async detectLanguage(text) {
      const data = await request('/detect', { q: text })
      return data.map((d) => ({
        language: d.language,
        confidence: d.confidence,
      }))
    },

    /**
     * Get list of supported languages
     * @returns {Promise<Language[]>} Array of supported languages
     */
    async getLanguages() {
      const res = await fetch(`${apiUrl}/languages`)
      if (!res.ok) {
        throw new Error(`Failed to fetch languages: ${res.status}`)
      }
      return res.json()
    },

    /**
     * Translate with automatic language detection
     * @param {string} text - Text to translate
     * @param {string} targetLang - Target language code
     * @returns {Promise<{translatedText: string, detectedLanguage: string}>}
     */
    async translateAuto(text, targetLang) {
      const [detections, translatedText] = await Promise.all([
        this.detectLanguage(text),
        this.translate(text, 'auto', targetLang),
      ])
      return {
        translatedText,
        detectedLanguage: detections[0]?.language ?? 'unknown',
      }
    },
  }
}

/**
 * Translate text using the public LibreTranslate API
 * @param {string} text - Text to translate
 * @param {string} sourceLang - Source language code or 'auto'
 * @param {string} targetLang - Target language code
 * @returns {Promise<string>} Translated text
 */
export async function translate(text, sourceLang, targetLang) {
  const client = createTranslationClient()
  return client.translate(text, sourceLang, targetLang)
}

/**
 * Detect language using the public LibreTranslate API
 * @param {string} text - Text to analyze
 * @returns {Promise<DetectionResult[]>} Detection results
 */
export async function detectLanguage(text) {
  const client = createTranslationClient()
  return client.detectLanguage(text)
}
