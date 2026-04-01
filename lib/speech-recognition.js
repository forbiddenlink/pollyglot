/**
 * Speech Recognition using Whisper via Transformers.js
 * Browser-compatible ES module version
 */

// Dynamic import for Transformers.js (loaded from CDN)
let pipeline = null
let transcriber = null
let isLoading = false
let loadPromise = null

const MODEL_MAP = {
  tiny: 'Xenova/whisper-tiny',
  base: 'Xenova/whisper-base',
  small: 'Xenova/whisper-small',
}

/**
 * Load the Transformers.js library from CDN
 */
async function loadTransformers() {
  if (pipeline) return

  try {
    // Import from CDN
    const module = await import('https://cdn.jsdelivr.net/npm/@xenova/transformers@2.17.2/dist/transformers.min.js')
    pipeline = module.pipeline
  } catch (error) {
    console.error('Failed to load Transformers.js:', error)
    throw new Error('Could not load speech recognition library')
  }
}

/**
 * Initialize the Whisper model. Call this early to start downloading the model.
 * The model is cached in IndexedDB after first download.
 * @param {object} options - Configuration options
 * @param {string} options.model - Model size: 'tiny', 'base', or 'small'
 */
export async function initWhisper(options = {}) {
  if (transcriber) return
  if (loadPromise) return loadPromise

  const modelName = MODEL_MAP[options.model ?? 'tiny']

  isLoading = true
  loadPromise = (async () => {
    try {
      await loadTransformers()

      transcriber = await pipeline('automatic-speech-recognition', modelName, {
        progress_callback: (progress) => {
          if (progress.status === 'progress' && progress.progress !== undefined) {
            console.log(`Loading Whisper: ${Math.round(progress.progress)}%`)
            // Dispatch custom event for UI updates
            window.dispatchEvent(new CustomEvent('whisper-progress', {
              detail: { progress: progress.progress, status: progress.status }
            }))
          }
        },
      })
    } finally {
      isLoading = false
    }
  })()

  return loadPromise
}

/**
 * Check if Whisper is ready to transcribe
 * @returns {boolean}
 */
export function isWhisperReady() {
  return transcriber !== null
}

/**
 * Check if Whisper is currently loading
 * @returns {boolean}
 */
export function isWhisperLoading() {
  return isLoading
}

/**
 * Convert AudioBuffer to Float32Array suitable for Whisper
 * @param {AudioBuffer} audioBuffer
 * @returns {Float32Array}
 */
function audioBufferToFloat32(audioBuffer) {
  // Whisper expects mono 16kHz audio
  const targetSampleRate = 16000
  const numChannels = audioBuffer.numberOfChannels
  const length = audioBuffer.length
  const sampleRate = audioBuffer.sampleRate

  // Mix to mono
  const mono = new Float32Array(length)
  for (let i = 0; i < length; i++) {
    let sum = 0
    for (let channel = 0; channel < numChannels; channel++) {
      sum += audioBuffer.getChannelData(channel)[i]
    }
    mono[i] = sum / numChannels
  }

  // Resample if needed
  if (sampleRate === targetSampleRate) {
    return mono
  }

  const ratio = sampleRate / targetSampleRate
  const newLength = Math.round(length / ratio)
  const resampled = new Float32Array(newLength)

  for (let i = 0; i < newLength; i++) {
    const srcIndex = i * ratio
    const srcIndexFloor = Math.floor(srcIndex)
    const srcIndexCeil = Math.min(srcIndexFloor + 1, length - 1)
    const t = srcIndex - srcIndexFloor
    resampled[i] = mono[srcIndexFloor] * (1 - t) + mono[srcIndexCeil] * t
  }

  return resampled
}

/**
 * Transcribe audio from a Blob (e.g., from MediaRecorder)
 * @param {Blob} audioBlob - Audio blob to transcribe
 * @param {object} options - Transcription options
 * @param {string} options.language - Language code (e.g., 'en', 'es')
 * @param {string} options.task - 'transcribe' or 'translate'
 * @param {boolean} options.timestamps - Include word timestamps
 * @returns {Promise<{text: string, chunks?: Array}>}
 */
export async function transcribeAudio(audioBlob, options = {}) {
  if (!transcriber) {
    await initWhisper()
  }

  const arrayBuffer = await audioBlob.arrayBuffer()
  const audioContext = new AudioContext({ sampleRate: 16000 })
  const audioBuffer = await audioContext.decodeAudioData(arrayBuffer)
  const audioData = audioBufferToFloat32(audioBuffer)
  await audioContext.close()

  const result = await transcriber(audioData, {
    language: options.language,
    task: options.task ?? 'transcribe',
    return_timestamps: options.timestamps ?? false,
  })

  return {
    text: result.text.trim(),
    chunks: result.chunks,
  }
}

/**
 * Transcribe audio from a Float32Array (raw audio samples at 16kHz)
 * @param {Float32Array} audioData - Raw audio samples
 * @param {object} options - Transcription options
 * @returns {Promise<{text: string, chunks?: Array}>}
 */
export async function transcribeRawAudio(audioData, options = {}) {
  if (!transcriber) {
    await initWhisper()
  }

  const result = await transcriber(audioData, {
    language: options.language,
    task: options.task ?? 'transcribe',
    return_timestamps: options.timestamps ?? false,
  })

  return {
    text: result.text.trim(),
    chunks: result.chunks,
  }
}

/**
 * Record audio from microphone and transcribe
 * @param {number} durationMs - Recording duration in milliseconds
 * @param {object} options - Transcription options
 * @returns {Promise<{text: string, chunks?: Array}>}
 */
export async function recordAndTranscribe(durationMs = 5000, options = {}) {
  const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
  const mediaRecorder = new MediaRecorder(stream, {
    mimeType: MediaRecorder.isTypeSupported('audio/webm')
      ? 'audio/webm'
      : 'audio/mp4',
  })

  const chunks = []

  return new Promise((resolve, reject) => {
    mediaRecorder.ondataavailable = (e) => {
      if (e.data.size > 0) {
        chunks.push(e.data)
      }
    }

    mediaRecorder.onstop = async () => {
      stream.getTracks().forEach((track) => track.stop())
      const blob = new Blob(chunks, { type: mediaRecorder.mimeType })
      try {
        const result = await transcribeAudio(blob, options)
        resolve(result)
      } catch (error) {
        reject(error)
      }
    }

    mediaRecorder.onerror = (e) => {
      stream.getTracks().forEach((track) => track.stop())
      reject(e)
    }

    mediaRecorder.start()
    setTimeout(() => mediaRecorder.stop(), durationMs)
  })
}
