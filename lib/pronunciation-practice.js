/**
 * Pronunciation Practice Module
 * Wires up speech recognition (Whisper), audio player (WaveSurfer), and translation
 */

// Import from lib modules (these use ES modules)
import { initWhisper, transcribeAudio, isWhisperReady, isWhisperLoading } from './speech-recognition.js'
import { createAudioPlayer } from './audio-player.js'
import {
  createNewCard,
  scheduleReview,
  getSchedulingOptions,
  cardToStorage,
  cardFromStorage,
  isDue,
  Rating
} from './spaced-repetition.js'

// Practice state
let practiceState = {
  isActive: false,
  currentPhrase: null,
  originalText: null,
  targetLang: null,
  sourceLang: null,
  mediaRecorder: null,
  audioChunks: [],
  recordingStartTime: null,
  timerInterval: null,
  referencePlayer: null,
  recordingPlayer: null,
  recordingBlob: null,
  phrases: [],
  currentIndex: 0,
  practiceHistory: [],
}

// DOM Elements (lazily initialized)
let elements = {}

/**
 * Initialize DOM element references
 */
function initElements() {
  elements = {
    section: document.getElementById('pronunciation-practice'),
    phraseText: document.getElementById('practice-phrase-text'),
    originalText: document.getElementById('practice-original-text'),
    referenceWaveform: document.getElementById('reference-waveform'),
    playReferenceBtn: document.getElementById('play-reference-btn'),
    recordBtn: document.getElementById('practice-record-btn'),
    recordingTimer: document.getElementById('recording-timer'),
    recordingPlayback: document.getElementById('recording-playback'),
    recordingWaveform: document.getElementById('recording-waveform'),
    playRecordingBtn: document.getElementById('play-recording-btn'),
    feedback: document.getElementById('practice-feedback'),
    transcription: document.getElementById('feedback-transcription'),
    retryBtn: document.getElementById('retry-btn'),
    nextPhraseBtn: document.getElementById('next-phrase-btn'),
    progressFill: document.getElementById('practice-progress-fill'),
    progressText: document.getElementById('practice-progress-text'),
    loading: document.getElementById('practice-loading'),
    closeBtn: document.querySelector('.close-practice-btn'),
    practiceBtn: document.querySelector('.practice-btn'),
  }
}

/**
 * Initialize the pronunciation practice system
 */
export async function initPronunciationPractice() {
  initElements()
  attachEventListeners()
  loadPracticeHistory()

  // Pre-load Whisper model in background when user hovers practice button
  if (elements.practiceBtn) {
    elements.practiceBtn.addEventListener('mouseenter', () => {
      if (!isWhisperReady() && !isWhisperLoading()) {
        initWhisper({ model: 'tiny' }).catch(console.warn)
      }
    }, { once: true })
  }
}

/**
 * Attach event listeners
 */
function attachEventListeners() {
  // Close button
  if (elements.closeBtn) {
    elements.closeBtn.addEventListener('click', closePractice)
  }

  // Practice button (in output section)
  if (elements.practiceBtn) {
    elements.practiceBtn.addEventListener('click', startPracticeFromTranslation)
  }

  // Record button - hold to record
  if (elements.recordBtn) {
    elements.recordBtn.addEventListener('mousedown', startRecording)
    elements.recordBtn.addEventListener('mouseup', stopRecording)
    elements.recordBtn.addEventListener('mouseleave', stopRecording)
    elements.recordBtn.addEventListener('touchstart', (e) => {
      e.preventDefault()
      startRecording()
    })
    elements.recordBtn.addEventListener('touchend', stopRecording)
  }

  // Playback buttons
  if (elements.playReferenceBtn) {
    elements.playReferenceBtn.addEventListener('click', toggleReferencePlay)
  }
  if (elements.playRecordingBtn) {
    elements.playRecordingBtn.addEventListener('click', toggleRecordingPlay)
  }

  // Feedback actions
  if (elements.retryBtn) {
    elements.retryBtn.addEventListener('click', retryRecording)
  }
  if (elements.nextPhraseBtn) {
    elements.nextPhraseBtn.addEventListener('click', nextPhrase)
  }
}

/**
 * Start practice from the current translation
 */
async function startPracticeFromTranslation() {
  const textOutput = document.querySelector('.text-output')
  const textInput = document.querySelector('.text-input')

  if (!textOutput || !textOutput.textContent.trim()) {
    showToast('Please translate something first', 'warning')
    return
  }

  // Get selected languages from the main app
  const sourceLangOption = document.querySelector('.source-lang .lang-option.selected')
  const targetLangOption = document.querySelector('.target-lang .lang-option.selected')

  practiceState.currentPhrase = textOutput.textContent.trim()
  practiceState.originalText = textInput.value.trim()
  practiceState.targetLang = targetLangOption?.dataset.lang || 'es'
  practiceState.sourceLang = sourceLangOption?.dataset.lang || 'en'
  practiceState.phrases = [practiceState.currentPhrase]
  practiceState.currentIndex = 0

  await showPractice()
}

/**
 * Show the practice section and initialize
 */
async function showPractice() {
  if (!elements.section) return

  elements.section.style.display = 'block'
  practiceState.isActive = true

  // Show loading while Whisper initializes
  showLoading(true)

  try {
    // Initialize Whisper if not ready
    if (!isWhisperReady()) {
      await initWhisper({ model: 'tiny' })
    }

    showLoading(false)
    displayCurrentPhrase()
    initReferenceAudio()
    updateProgress()

  } catch (error) {
    console.error('Failed to initialize Whisper:', error)
    showLoading(false)
    showToast('Speech recognition unavailable. You can still practice!', 'warning')
    displayCurrentPhrase()
    updateProgress()
  }

  // Scroll to practice section
  elements.section.scrollIntoView({ behavior: 'smooth', block: 'start' })
}

/**
 * Display current phrase for practice
 */
function displayCurrentPhrase() {
  if (elements.phraseText) {
    elements.phraseText.textContent = practiceState.currentPhrase
  }
  if (elements.originalText) {
    elements.originalText.textContent = practiceState.originalText
  }

  // Reset UI state
  resetRecordingUI()
}

/**
 * Initialize reference audio player using Web Speech API
 */
function initReferenceAudio() {
  // Clean up existing player
  if (practiceState.referencePlayer) {
    practiceState.referencePlayer.destroy?.()
    practiceState.referencePlayer = null
  }

  // For reference, we'll use browser's TTS since we don't have pre-recorded audio
  // The waveform will show when user generates speech
  if (elements.referenceWaveform) {
    elements.referenceWaveform.innerHTML = '<div style="display:flex;align-items:center;justify-content:center;height:100%;color:var(--text-lighter);font-size:0.85rem;">Click play to hear reference</div>'
  }
}

/**
 * Toggle reference audio playback (uses browser TTS)
 */
function toggleReferencePlay() {
  if (!practiceState.currentPhrase) return

  const synth = window.speechSynthesis

  if (synth.speaking) {
    synth.cancel()
    updatePlayButton(elements.playReferenceBtn, false)
    return
  }

  const utterance = new SpeechSynthesisUtterance(practiceState.currentPhrase)

  // Map language codes to BCP-47 tags
  const langMap = {
    'en': 'en-US', 'es': 'es-ES', 'fr': 'fr-FR', 'de': 'de-DE',
    'it': 'it-IT', 'pt': 'pt-PT', 'ru': 'ru-RU', 'zh': 'zh-CN',
    'ja': 'ja-JP', 'ko': 'ko-KR', 'ar': 'ar-SA', 'hi': 'hi-IN',
    'nl': 'nl-NL', 'pl': 'pl-PL', 'tr': 'tr-TR', 'vi': 'vi-VN',
    'th': 'th-TH', 'sv': 'sv-SE', 'el': 'el-GR', 'he': 'he-IL'
  }

  utterance.lang = langMap[practiceState.targetLang] || 'en-US'
  utterance.rate = 0.85 // Slightly slower for learning

  utterance.onstart = () => updatePlayButton(elements.playReferenceBtn, true)
  utterance.onend = () => updatePlayButton(elements.playReferenceBtn, false)
  utterance.onerror = () => updatePlayButton(elements.playReferenceBtn, false)

  synth.speak(utterance)
}

/**
 * Start recording user's pronunciation
 */
async function startRecording() {
  if (practiceState.mediaRecorder?.state === 'recording') return

  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true })

    const mimeType = MediaRecorder.isTypeSupported('audio/webm')
      ? 'audio/webm'
      : 'audio/mp4'

    practiceState.mediaRecorder = new MediaRecorder(stream, { mimeType })
    practiceState.audioChunks = []

    practiceState.mediaRecorder.ondataavailable = (e) => {
      if (e.data.size > 0) {
        practiceState.audioChunks.push(e.data)
      }
    }

    practiceState.mediaRecorder.onstop = async () => {
      stream.getTracks().forEach(track => track.stop())
      await processRecording()
    }

    practiceState.mediaRecorder.start()
    practiceState.recordingStartTime = Date.now()

    // Update UI
    elements.recordBtn?.classList.add('recording')
    startTimer()

  } catch (error) {
    console.error('Failed to start recording:', error)
    showToast('Could not access microphone', 'error')
  }
}

/**
 * Stop recording
 */
function stopRecording() {
  if (practiceState.mediaRecorder?.state !== 'recording') return

  practiceState.mediaRecorder.stop()
  elements.recordBtn?.classList.remove('recording')
  stopTimer()
}

/**
 * Process the recorded audio
 */
async function processRecording() {
  const blob = new Blob(practiceState.audioChunks, {
    type: practiceState.mediaRecorder.mimeType
  })
  practiceState.recordingBlob = blob

  // Create object URL for playback
  const audioUrl = URL.createObjectURL(blob)

  // Initialize recording player with WaveSurfer
  if (elements.recordingPlayback) {
    elements.recordingPlayback.style.display = 'block'
  }

  if (elements.recordingWaveform) {
    // Clean up existing player
    if (practiceState.recordingPlayer) {
      practiceState.recordingPlayer.destroy?.()
    }

    try {
      practiceState.recordingPlayer = createAudioPlayer(
        elements.recordingWaveform,
        audioUrl,
        {
          height: 48,
          waveColor: 'rgba(232, 93, 59, 0.4)',
          progressColor: '#e85d3b'
        }
      )

      practiceState.recordingPlayer.on('play', () => {
        updatePlayButton(elements.playRecordingBtn, true)
      })
      practiceState.recordingPlayer.on('pause', () => {
        updatePlayButton(elements.playRecordingBtn, false)
      })
      practiceState.recordingPlayer.on('finish', () => {
        updatePlayButton(elements.playRecordingBtn, false)
      })
    } catch (e) {
      console.warn('WaveSurfer failed, using simple audio:', e)
      // Fallback: simple audio element
      elements.recordingWaveform.innerHTML = '<audio controls style="width:100%"></audio>'
      elements.recordingWaveform.querySelector('audio').src = audioUrl
    }
  }

  // Transcribe with Whisper
  await transcribeRecording(blob)
}

/**
 * Transcribe the recording using Whisper
 */
async function transcribeRecording(blob) {
  if (!isWhisperReady()) {
    showFeedback('(Speech recognition not available)', false)
    return
  }

  try {
    showToast('Transcribing...', 'success')

    const result = await transcribeAudio(blob, {
      language: practiceState.targetLang,
      task: 'transcribe'
    })

    showFeedback(result.text, true)
    savePracticeAttempt(result.text)

  } catch (error) {
    console.error('Transcription failed:', error)
    showFeedback('(Could not transcribe)', false)
  }
}

/**
 * Show transcription feedback
 */
function showFeedback(text, success) {
  if (elements.feedback) {
    elements.feedback.style.display = 'block'
  }
  if (elements.transcription) {
    elements.transcription.textContent = text || '(No speech detected)'
  }
}

/**
 * Save practice attempt to history with spaced repetition
 */
function savePracticeAttempt(transcription) {
  const phrase = practiceState.currentPhrase

  // Find or create card for this phrase
  let entry = practiceState.practiceHistory.find(h => h.phrase === phrase)

  if (!entry) {
    entry = {
      phrase,
      original: practiceState.originalText,
      targetLang: practiceState.targetLang,
      card: createNewCard(),
      attempts: []
    }
    practiceState.practiceHistory.push(entry)
  }

  // Add attempt
  entry.attempts.push({
    transcription,
    timestamp: Date.now()
  })

  // Schedule next review (user should rate themselves)
  // For now, assume "Good" rating
  entry.card = scheduleReview(entry.card, Rating.Good)

  savePracticeHistory()
}

/**
 * Retry recording
 */
function retryRecording() {
  resetRecordingUI()
}

/**
 * Move to next phrase
 */
function nextPhrase() {
  if (practiceState.currentIndex < practiceState.phrases.length - 1) {
    practiceState.currentIndex++
    practiceState.currentPhrase = practiceState.phrases[practiceState.currentIndex]
    displayCurrentPhrase()
    initReferenceAudio()
  } else {
    showToast('Practice complete!', 'success')
    closePractice()
  }
  updateProgress()
}

/**
 * Update progress bar
 */
function updateProgress() {
  const total = practiceState.phrases.length
  const current = practiceState.currentIndex + 1
  const percent = total > 0 ? (current / total) * 100 : 0

  if (elements.progressFill) {
    elements.progressFill.style.width = `${percent}%`
  }
  if (elements.progressText) {
    elements.progressText.textContent = `${current} / ${total} phrases practiced`
  }
}

/**
 * Reset recording UI
 */
function resetRecordingUI() {
  if (elements.recordingPlayback) {
    elements.recordingPlayback.style.display = 'none'
  }
  if (elements.feedback) {
    elements.feedback.style.display = 'none'
  }
  if (practiceState.recordingPlayer) {
    practiceState.recordingPlayer.destroy?.()
    practiceState.recordingPlayer = null
  }
  practiceState.recordingBlob = null
  stopTimer()
}

/**
 * Close practice section
 */
function closePractice() {
  if (elements.section) {
    elements.section.style.display = 'none'
  }
  practiceState.isActive = false
  resetRecordingUI()

  // Clean up players
  if (practiceState.referencePlayer) {
    practiceState.referencePlayer.destroy?.()
    practiceState.referencePlayer = null
  }
}

/**
 * Timer functions
 */
function startTimer() {
  if (elements.recordingTimer) {
    elements.recordingTimer.style.display = 'block'
  }

  practiceState.timerInterval = setInterval(() => {
    const elapsed = Math.floor((Date.now() - practiceState.recordingStartTime) / 1000)
    const mins = Math.floor(elapsed / 60)
    const secs = elapsed % 60
    const timerValue = elements.recordingTimer?.querySelector('.timer-value')
    if (timerValue) {
      timerValue.textContent = `${mins}:${secs.toString().padStart(2, '0')}`
    }
  }, 100)
}

function stopTimer() {
  if (practiceState.timerInterval) {
    clearInterval(practiceState.timerInterval)
    practiceState.timerInterval = null
  }
  if (elements.recordingTimer) {
    elements.recordingTimer.style.display = 'none'
  }
}

/**
 * Update play button state
 */
function updatePlayButton(btn, isPlaying) {
  if (!btn) return
  const playIcon = btn.querySelector('.play-icon')
  const pauseIcon = btn.querySelector('.pause-icon')
  if (playIcon) playIcon.style.display = isPlaying ? 'none' : 'block'
  if (pauseIcon) pauseIcon.style.display = isPlaying ? 'block' : 'none'
}

/**
 * Toggle recording playback
 */
function toggleRecordingPlay() {
  if (practiceState.recordingPlayer) {
    practiceState.recordingPlayer.playPause()
  }
}

/**
 * Show/hide loading state
 */
function showLoading(show) {
  if (elements.loading) {
    elements.loading.style.display = show ? 'flex' : 'none'
  }
  const content = document.querySelector('.practice-content')
  if (content) {
    content.style.display = show ? 'none' : 'block'
  }
}

/**
 * Load practice history from localStorage
 */
function loadPracticeHistory() {
  try {
    const saved = localStorage.getItem('pronunciationPracticeHistory')
    if (saved) {
      const parsed = JSON.parse(saved)
      practiceState.practiceHistory = parsed.map(entry => ({
        ...entry,
        card: entry.card ? cardFromStorage(entry.card) : createNewCard()
      }))
    }
  } catch (e) {
    console.warn('Failed to load practice history:', e)
    practiceState.practiceHistory = []
  }
}

/**
 * Save practice history to localStorage
 */
function savePracticeHistory() {
  try {
    const toSave = practiceState.practiceHistory.map(entry => ({
      ...entry,
      card: cardToStorage(entry.card)
    }))
    localStorage.setItem('pronunciationPracticeHistory', JSON.stringify(toSave))
  } catch (e) {
    console.warn('Failed to save practice history:', e)
  }
}

/**
 * Show toast notification (uses main app's toast if available)
 */
function showToast(message, type = 'success') {
  // Try to use main app's toast
  if (typeof window.showToast === 'function') {
    window.showToast(message, type)
    return
  }

  // Fallback: find and use toast element
  const toast = document.querySelector('.toast')
  if (toast) {
    const toastMessage = toast.querySelector('p')
    if (toastMessage) toastMessage.textContent = message
    toast.className = `toast ${type}`
    toast.classList.remove('hidden')
    setTimeout(() => toast.classList.add('hidden'), 3000)
  }
}

// Export for use by main script
export {
  initPronunciationPractice,
  startPracticeFromTranslation,
  closePractice,
  practiceState
}
