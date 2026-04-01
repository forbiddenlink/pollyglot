import { pipeline, Pipeline, AutomaticSpeechRecognitionOutput } from '@xenova/transformers'

let transcriber: Pipeline | null = null
let isLoading = false
let loadPromise: Promise<void> | null = null

export interface TranscriptionResult {
  text: string
  chunks?: Array<{
    text: string
    timestamp: [number, number]
  }>
}

export interface WhisperOptions {
  model?: 'tiny' | 'base' | 'small'
  language?: string
  task?: 'transcribe' | 'translate'
  timestamps?: boolean
}

const MODEL_MAP = {
  tiny: 'Xenova/whisper-tiny',
  base: 'Xenova/whisper-base',
  small: 'Xenova/whisper-small',
} as const

/**
 * Initialize the Whisper model. Call this early to start downloading the model.
 * The model is cached in IndexedDB after first download.
 */
export async function initWhisper(
  options: Pick<WhisperOptions, 'model'> = {}
): Promise<void> {
  if (transcriber) return
  if (loadPromise) return loadPromise

  const modelName = MODEL_MAP[options.model ?? 'tiny']

  isLoading = true
  loadPromise = (async () => {
    try {
      transcriber = await pipeline('automatic-speech-recognition', modelName, {
        progress_callback: (progress: { status: string; progress?: number }) => {
          if (progress.status === 'progress' && progress.progress !== undefined) {
            console.log(`Loading Whisper: ${Math.round(progress.progress)}%`)
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
 */
export function isWhisperReady(): boolean {
  return transcriber !== null
}

/**
 * Check if Whisper is currently loading
 */
export function isWhisperLoading(): boolean {
  return isLoading
}

/**
 * Convert AudioBuffer to Float32Array suitable for Whisper
 */
function audioBufferToFloat32(audioBuffer: AudioBuffer): Float32Array {
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
 */
export async function transcribeAudio(
  audioBlob: Blob,
  options: Omit<WhisperOptions, 'model'> = {}
): Promise<TranscriptionResult> {
  if (!transcriber) {
    await initWhisper()
  }

  const arrayBuffer = await audioBlob.arrayBuffer()
  const audioContext = new AudioContext({ sampleRate: 16000 })
  const audioBuffer = await audioContext.decodeAudioData(arrayBuffer)
  const audioData = audioBufferToFloat32(audioBuffer)
  await audioContext.close()

  const result = (await transcriber!(audioData, {
    language: options.language,
    task: options.task ?? 'transcribe',
    return_timestamps: options.timestamps ?? false,
  })) as AutomaticSpeechRecognitionOutput

  return {
    text: result.text.trim(),
    chunks: result.chunks as TranscriptionResult['chunks'],
  }
}

/**
 * Transcribe audio from a Float32Array (raw audio samples at 16kHz)
 */
export async function transcribeRawAudio(
  audioData: Float32Array,
  options: Omit<WhisperOptions, 'model'> = {}
): Promise<TranscriptionResult> {
  if (!transcriber) {
    await initWhisper()
  }

  const result = (await transcriber!(audioData, {
    language: options.language,
    task: options.task ?? 'transcribe',
    return_timestamps: options.timestamps ?? false,
  })) as AutomaticSpeechRecognitionOutput

  return {
    text: result.text.trim(),
    chunks: result.chunks as TranscriptionResult['chunks'],
  }
}

/**
 * Record audio from microphone and transcribe
 */
export async function recordAndTranscribe(
  durationMs: number = 5000,
  options: Omit<WhisperOptions, 'model'> = {}
): Promise<TranscriptionResult> {
  const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
  const mediaRecorder = new MediaRecorder(stream, {
    mimeType: MediaRecorder.isTypeSupported('audio/webm')
      ? 'audio/webm'
      : 'audio/mp4',
  })

  const chunks: Blob[] = []

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
