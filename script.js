// DOM Elements
const textInput = document.querySelector('.text-input');
const textOutput = document.querySelector('.text-output');
const translateBtn = document.querySelector('.translate-btn');
const detectLangBtn = document.querySelector('.detect-lang');
const loadingOverlay = document.querySelector('.loading-overlay');
const sourceLangOptions = document.querySelectorAll('.source-lang .lang-option');
const targetLangOptions = document.querySelectorAll('.target-lang .lang-option');
const charCounter = document.querySelector('.char-counter');
const wordCounter = document.querySelector('.word-counter');
const outputWordCounter = document.querySelector('.output-word-counter');
const copyBtn = document.querySelector('.copy-btn');
const toast = document.querySelector('.toast');
const inputSpeakBtn = document.querySelector('.input-speak');
const outputSpeakBtn = document.querySelector('.output-speak');
const themeToggle = document.querySelector('.theme-toggle');
const historyToggle = document.querySelector('.history-toggle');
const historySidebar = document.querySelector('.history-sidebar');
const historyList = document.querySelector('.history-list');
const clearHistoryBtn = document.querySelector('.clear-history-btn');
const swapLangBtn = document.querySelector('.swap-lang-btn');
const clearTextBtn = document.querySelector('.clear-text-btn');
const saveTranslationBtn = document.querySelector('.save-translation-btn');
const voiceInputBtn = document.querySelector('.voice-input-btn');
const shareBtn = document.querySelector('.share-btn');
const exportHistoryBtn = document.querySelector('.export-history-btn');
const settingsToggle = document.querySelector('.settings-toggle');
const settingsModal = document.querySelector('.settings-modal');
const closeSettings = document.querySelector('.close-settings');
const fullscreenToggle = document.querySelector('.fullscreen-toggle');
const sourceSearch = document.querySelector('.source-search');
const targetSearch = document.querySelector('.target-search');
const closeHistoryBtn = document.querySelector('.close-history-btn');
const favoriteBtn = document.querySelector('.favorite-btn');
const favoritesList = document.querySelector('.favorites-list');
const historyTabs = document.querySelectorAll('.history-tab');
const alternativesSection = document.querySelector('.alternatives-section');
const alternativesList = document.querySelector('.alternatives-list');
const pronunciationGuide = document.querySelector('.pronunciation-guide');
const pronunciationText = document.querySelector('.pronunciation-text');
const practiceBtn = document.querySelector('.practice-btn');
const ttsControls = document.getElementById('tts-controls');
const ttsVoiceSelect = document.getElementById('tts-voice-select');
const ttsSpeedSlider = document.getElementById('tts-speed-slider');
const ttsSpeedValue = document.getElementById('tts-speed-value');
const ttsCloseBtn = document.getElementById('tts-close-btn');
const ttsUnavailableMsg = document.getElementById('tts-unavailable-msg');

// State
let selectedSourceLang = null;
let selectedTargetLang = 'es'; // Default to Spanish
let currentSpeech = null;
let currentAudio = null; // Magica server-TTS audio element (for stop-toggle)
let availableVoices = [];
let translationHistory = [];
let recognition = null;
let favoriteLanguages = [];
let favoriteTranslations = [];
let undoStack = [];
let practiceState = {
    isActive: false,
    currentPhrase: null,
    originalText: null,
    targetLang: null,
    mediaRecorder: null,
    audioChunks: [],
    recordingStartTime: null,
    timerInterval: null,
    recordingBlob: null,
    whisperReady: false,
    whisperLoading: false,
    wavesurferRecording: null,
    practiceHistory: []
};
let appSettings = {
    autoTheme: false,
    animationsEnabled: true,
    autoTranslate: false,
    autoSave: true,
    autoDetectInput: false,
    speechRate: 0.9,
    autoSpeak: false,
    historyLimit: 50
};
let themeMediaQuery = null;
let themeListenerAttached = false;
let ttsState = {
    controlsVisible: false,
    selectedVoice: null,
    voicesForCurrentLang: []
};

// Language mapping with full names
const languageNames = {
    'en': 'English',
    'es': 'Spanish',
    'fr': 'French',
    'de': 'German',
    'it': 'Italian',
    'pt': 'Portuguese',
    'ru': 'Russian',
    'zh': 'Chinese',
    'ja': 'Japanese',
    'ko': 'Korean',
    'ar': 'Arabic',
    'hi': 'Hindi',
    'nl': 'Dutch',
    'pl': 'Polish',
    'tr': 'Turkish',
    'vi': 'Vietnamese',
    'th': 'Thai',
    'sv': 'Swedish',
    'el': 'Greek',
    'he': 'Hebrew'
};

// BCP 47 language tags for speech synthesis
const speechLangs = {
    'en': 'en-US',
    'es': 'es-ES',
    'fr': 'fr-FR',
    'de': 'de-DE',
    'it': 'it-IT',
    'pt': 'pt-PT',
    'ru': 'ru-RU',
    'zh': 'zh-CN',
    'ja': 'ja-JP',
    'ko': 'ko-KR',
    'ar': 'ar-SA',
    'hi': 'hi-IN',
    'nl': 'nl-NL',
    'pl': 'pl-PL',
    'tr': 'tr-TR',
    'vi': 'vi-VN',
    'th': 'th-TH',
    'sv': 'sv-SE',
    'el': 'el-GR',
    'he': 'he-IL'
};

// Initialize
function init() {
    loadSettings();
    loadTheme();
    syncThemeWithSettings();
    loadHistory();
    loadFavorites();
    detectBrowserLanguage();
    updateCharCounter();
    selectDefaultLanguages();
    initializeSpeechSynthesis();
    initializeVoiceRecognition();
    initTTSControls();
    attachEventListeners();
    registerServiceWorker();
    initPronunciationPractice();
}

// Event Listeners
function attachEventListeners() {
    // Language selection with keyboard accessibility
    sourceLangOptions.forEach(option => {
        option.setAttribute('tabindex', '0');
        option.setAttribute('role', 'button');
        option.addEventListener('click', () => selectLanguage(option, 'source'));
        option.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                selectLanguage(option, 'source');
            }
        });
    });

    targetLangOptions.forEach(option => {
        option.setAttribute('tabindex', '0');
        option.setAttribute('role', 'button');
        option.addEventListener('click', () => selectLanguage(option, 'target'));
        option.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                selectLanguage(option, 'target');
            }
        });
    });

    // Translation
    translateBtn.addEventListener('click', handleTranslation);
    detectLangBtn.addEventListener('click', detectLanguage);
    
    // Text input
    textInput.addEventListener('input', updateCharCounter);
    textInput.addEventListener('keydown', handleKeyPress);
    textInput.addEventListener('paste', handlePaste);

    // Example phrases
    document.querySelectorAll('.example-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            textInput.value = btn.dataset.text;
            textInput.focus();
            updateCharCounter();
            document.getElementById('example-phrases').classList.add('hidden');
        });
    });
    
    // Actions
    copyBtn.addEventListener('click', copyTranslation);
    inputSpeakBtn.addEventListener('click', () => speakText(textInput.value, selectedSourceLang));
    outputSpeakBtn.addEventListener('click', handleOutputSpeakClick);

    // TTS Controls
    if (ttsCloseBtn) {
        ttsCloseBtn.addEventListener('click', hideTTSControls);
    }
    if (ttsVoiceSelect) {
        ttsVoiceSelect.addEventListener('change', handleTTSVoiceChange);
    }
    if (ttsSpeedSlider) {
        ttsSpeedSlider.addEventListener('input', handleTTSSpeedChange);
    }
    // Right-click on speak button to show TTS options
    outputSpeakBtn.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        toggleTTSControls();
    });

    // Click on output to skip typing animation
    textOutput.addEventListener('click', skipTypingAnimation);
    
    // Theme and history
    themeToggle.addEventListener('click', toggleTheme);
    historyToggle.addEventListener('click', toggleHistory);
    clearHistoryBtn.addEventListener('click', clearHistory);
    closeHistoryBtn.addEventListener('click', () => historySidebar.classList.remove('open'));

    // Favorites
    favoriteBtn.addEventListener('click', toggleFavorite);
    historyTabs.forEach(tab => {
        tab.addEventListener('click', () => switchHistoryTab(tab.dataset.tab));
    });
    
    // New features
    swapLangBtn.addEventListener('click', swapLanguages);
    clearTextBtn.addEventListener('click', clearText);
    saveTranslationBtn.addEventListener('click', saveCurrentTranslation);
    voiceInputBtn.addEventListener('click', toggleVoiceInput);
    shareBtn.addEventListener('click', shareTranslation);
    exportHistoryBtn.addEventListener('click', exportHistory);
    
    // Settings
    settingsToggle.addEventListener('click', openSettings);
    closeSettings.addEventListener('click', closeSettingsModal);
    document.querySelectorAll('.settings-modal input, .settings-modal select').forEach(input => {
        input.addEventListener('change', saveSettings);
    });
    document.querySelector('.reset-settings-btn').addEventListener('click', resetSettings);
    
    // Fullscreen
    fullscreenToggle.addEventListener('click', toggleFullscreen);
    
    // Language search
    sourceSearch.addEventListener('input', (e) => filterLanguages(e.target.value, 'source'));
    targetSearch.addEventListener('input', (e) => filterLanguages(e.target.value, 'target'));
    
    // Keyboard shortcuts
    document.addEventListener('keydown', handleGlobalKeyPress);
    
    // Close modals when clicking outside
    document.addEventListener('click', (e) => {
        if (historySidebar.classList.contains('open') && 
            !historySidebar.contains(e.target) && 
            !historyToggle.contains(e.target)) {
            historySidebar.classList.remove('open');
        }
        if (!settingsModal.classList.contains('hidden') && 
            !settingsModal.querySelector('.settings-content').contains(e.target) &&
            !settingsToggle.contains(e.target)) {
            closeSettingsModal();
        }
    });
}

// Language Selection
function selectLanguage(option, type) {
    const options = type === 'source' ? sourceLangOptions : targetLangOptions;
    options.forEach(opt => opt.classList.remove('selected'));
    option.classList.add('selected');

    const langCode = option.dataset.lang;
    if (type === 'source') {
        selectedSourceLang = langCode;
    } else {
        selectedTargetLang = langCode;
        // Reset selected voice when target language changes
        ttsState.selectedVoice = null;
        // Update TTS voice options if controls are visible
        if (ttsState.controlsVisible) {
            updateTTSVoiceOptions(langCode);
        }
    }

    // Save language pair to localStorage
    saveLanguagePair();

    // Optional: auto-translate when language pair changes
    if (
        appSettings.autoTranslate &&
        textInput.value.trim() &&
        selectedTargetLang &&
        selectedSourceLang !== selectedTargetLang
    ) {
        handleTranslation();
    }
}

function saveLanguagePair() {
    localStorage.setItem('languagePair', JSON.stringify({
        source: selectedSourceLang,
        target: selectedTargetLang
    }));
}

function loadLanguagePair() {
    try {
        const saved = localStorage.getItem('languagePair');
        if (saved) {
            const { source, target } = JSON.parse(saved);
            if (source) {
                sourceLangOptions.forEach(opt => {
                    if (opt.dataset.lang === source) {
                        selectLanguage(opt, 'source');
                    }
                });
            }
            if (target) {
                targetLangOptions.forEach(opt => {
                    if (opt.dataset.lang === target) {
                        selectLanguage(opt, 'target');
                    }
                });
            }
            return true;
        }
    } catch (error) {
        console.error('Failed to load language pair:', error);
    }
    return false;
}

function selectDefaultLanguages() {
    // Try to load saved language pair first
    if (loadLanguagePair()) {
        return;
    }

    // Select Spanish as default target if no saved pair
    targetLangOptions.forEach(opt => {
        if (opt.dataset.lang === 'es') {
            selectLanguage(opt, 'target');
        }
    });
}

// Character and Word Counter
function updateCharCounter() {
    const text = textInput.value;
    const charCount = text.length;
    const max = 5000;
    const words = text.trim().split(/\s+/).filter(w => w.length > 0);
    const wordCount = text.trim() === '' ? 0 : words.length;

    charCounter.textContent = `${charCount} / ${max} characters`;
    wordCounter.textContent = `${wordCount} word${wordCount !== 1 ? 's' : ''}`;

    // Calculate reading time (average 200 words per minute)
    const readingTime = document.querySelector('.reading-time');
    if (readingTime) {
        const minutes = Math.ceil(wordCount / 200);
        if (wordCount === 0) {
            readingTime.textContent = '~0 min read';
        } else if (minutes < 1) {
            readingTime.textContent = '<1 min read';
        } else {
            readingTime.textContent = `~${minutes} min read`;
        }
    }

    charCounter.classList.remove('warning', 'error');
    if (charCount > max * 0.9) {
        charCounter.classList.add('warning');
    }
    if (charCount >= max) {
        charCounter.classList.add('error');
    }

    // Show/hide example phrases
    const examplePhrases = document.getElementById('example-phrases');
    if (examplePhrases) {
        examplePhrases.classList.toggle('hidden', charCount > 0);
    }
}

function updateOutputWordCounter() {
    const text = textOutput.textContent;
    const words = text.trim().split(/\s+/).filter(w => w.length > 0);
    const wordCount = text.trim() === '' ? 0 : words.length;
    outputWordCounter.textContent = `${wordCount} word${wordCount !== 1 ? 's' : ''}`;
}

// Translation
async function handleTranslation() {
    const text = textInput.value.trim();
    if (!text) {
        showToast('Please enter some text to translate', 'warning');
        return;
    }

    if (text.length > 5000) {
        showToast('Text is too long. Maximum 5000 characters.', 'error');
        return;
    }

    if (!selectedTargetLang) {
        showToast('Please select a target language', 'warning');
        return;
    }

    if (selectedSourceLang === selectedTargetLang) {
        showToast('Source and target languages must be different', 'warning');
        return;
    }

    try {
        showLoading(true);
        translateBtn.disabled = true;
        
        const formality = document.getElementById('formality').value;

        const response = await fetch('/api/translate', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                text,
                sourceLang: selectedSourceLang ? languageNames[selectedSourceLang] : undefined,
                targetLang: languageNames[selectedTargetLang],
                formality
            })
        });

        const data = await response.json();
        if (!response.ok) {
            throw new Error(data.error || 'Translation failed');
        }

        const translationText = data.translation;

        // Show action buttons
        copyBtn.style.display = 'flex';
        outputSpeakBtn.style.display = 'flex';
        saveTranslationBtn.style.display = 'flex';
        shareBtn.style.display = 'flex';
        if (practiceBtn) practiceBtn.style.display = 'flex';

        // Type out the translation with animation
        typeText(translationText, () => {
            updateOutputWordCounter();
            checkIfFavorited();
            announceToScreenReader('Translation complete: ' + translationText);

            // Auto-speak if enabled (after typing finishes)
            if (appSettings.autoSpeak) {
                setTimeout(() => speakText(translationText, selectedTargetLang), 300);
            }
        });

        showToast('Translation completed!', 'success');

        // Auto-save to history
        if (appSettings.autoSave) {
            addToHistory({
                sourceText: text,
                targetText: translationText,
                sourceLang: selectedSourceLang || 'auto',
                targetLang: selectedTargetLang,
                timestamp: Date.now()
            });
        }

        // Fetch alternatives for short texts
        if (text.length <= 200) {
            fetchAlternatives(text, translationText);
        } else {
            alternativesSection.style.display = 'none';
        }

        // Fetch pronunciation for non-Latin scripts
        const nonLatinLangs = ['zh', 'ja', 'ko', 'ar', 'hi', 'ru', 'th', 'el', 'he'];
        if (nonLatinLangs.includes(selectedTargetLang) && translationText.length <= 500) {
            fetchPronunciation(translationText);
        } else {
            pronunciationGuide.style.display = 'none';
        }
        
    } catch (error) {
        console.error('Translation error:', error);
        showToast(`Translation failed: ${error.message}`, 'error');
    } finally {
        showLoading(false);
        translateBtn.disabled = false;
    }
}

// Language Detection
async function detectLanguage() {
    const text = textInput.value.trim();
    if (!text) {
        showToast('Please enter some text to detect its language', 'warning');
        return;
    }

    try {
        showLoading(true);
        const response = await fetch('/api/detect', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ text })
        });

        const data = await response.json();
        if (!response.ok) {
            throw new Error(data.error || 'Language detection failed');
        }

        const detectedLang = (data.detectedLanguage || '').toLowerCase();
        let langFound = false;
        
        sourceLangOptions.forEach(option => {
            const langCode = option.dataset.lang;
            if (langCode === detectedLang) {
                selectLanguage(option, 'source');
                langFound = true;
            }
        });

        if (langFound) {
            showToast(`Detected language: ${languageNames[detectedLang]}`, 'success');
        } else {
            showToast('Could not detect a supported language', 'warning');
        }
    } catch (error) {
        console.error('Language detection error:', error);
        showToast('Language detection failed. Please try again.', 'error');
    } finally {
        showLoading(false);
    }
}

// Copy Translation
async function copyTranslation() {
    const text = textOutput.textContent;
    if (!text) {
        showToast('Nothing to copy', 'warning');
        return;
    }

    try {
        await navigator.clipboard.writeText(text);
        showToast('Translation copied to clipboard!', 'success');
    } catch (error) {
        console.error('Copy error:', error);
        showToast('Failed to copy translation', 'error');
    }
}

// Server-side TTS via Magica (better multilingual voices). Handles its own
// start/stop toggle. Returns true if it handled playback (started or stopped),
// false if unavailable — in which case the caller falls back to the browser voice.
// The API key stays server-side (see api/index.js /tts) — never in this file.
async function speakWithMagica(text, langCode, button) {
    // Toggle off if Magica audio is already playing.
    if (currentAudio) {
        currentAudio.pause();
        currentAudio = null;
        document.querySelectorAll('.speak-btn').forEach(b => b.classList.remove('speaking'));
        return true;
    }
    try {
        if (button) button.classList.add('speaking');
        const res = await fetch('/api/tts', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ text, language: langCode }),
        });
        if (!res.ok) throw new Error('tts ' + res.status);
        const audio = new Audio(URL.createObjectURL(await res.blob()));
        currentAudio = audio;
        audio.onended = audio.onerror = () => {
            if (button) button.classList.remove('speaking');
            URL.revokeObjectURL(audio.src);
            currentAudio = null;
        };
        await audio.play();
        return true;
    } catch (err) {
        console.warn('Magica TTS unavailable, using browser voice:', err);
        if (button) button.classList.remove('speaking');
        currentAudio = null;
        return false;
    }
}

// Text-to-Speech
async function speakText(text, langCode) {
    if (!text) {
        showToast('No text to speak', 'warning');
        return;
    }

    if (!langCode) {
        showToast('Please select a language first', 'warning');
        return;
    }

    const button = langCode === selectedSourceLang ? inputSpeakBtn : outputSpeakBtn;

    // Prefer Magica server TTS; it manages its own start/stop. Fall back to the
    // browser voice below if the server route is unavailable.
    if (await speakWithMagica(text, langCode, button)) {
        return;
    }

    if (!window.speechSynthesis) {
        showToast('Text-to-speech is not supported in your browser', 'error');
        return;
    }

    // Stop any current speech
    if (currentSpeech) {
        window.speechSynthesis.cancel();
        document.querySelectorAll('.speak-btn').forEach(btn => btn.classList.remove('speaking'));
        currentSpeech = null;
        return;
    }

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = speechLangs[langCode] || 'en-US';
    utterance.rate = appSettings.speechRate;
    utterance.pitch = 1;
    
    // Find the best voice for the language
    const voice = availableVoices.find(v => v.lang.startsWith(langCode)) || 
                 availableVoices.find(v => v.lang.startsWith(speechLangs[langCode]));
    
    if (voice) {
        utterance.voice = voice;
    }

    // Handle speaking state (button already resolved above)
    button.classList.add('speaking');

    utterance.onend = () => {
        button.classList.remove('speaking');
        currentSpeech = null;
    };

    utterance.onerror = (event) => {
        console.error('Speech error:', event);
        button.classList.remove('speaking');
        currentSpeech = null;
        showToast('Text-to-speech failed. Please try again.', 'error');
    };

    try {
        window.speechSynthesis.speak(utterance);
        currentSpeech = utterance;
    } catch (error) {
        console.error('Speech synthesis error:', error);
        button.classList.remove('speaking');
        showToast('Failed to start text-to-speech.', 'error');
    }
}

// ================================
// Enhanced TTS Controls
// ================================

/**
 * Initialize TTS controls UI
 */
function initTTSControls() {
    if (!window.speechSynthesis) {
        console.warn('TTS not supported');
        return;
    }

    // Load TTS settings from localStorage
    const savedTTSSettings = localStorage.getItem('ttsSettings');
    if (savedTTSSettings) {
        try {
            const parsed = JSON.parse(savedTTSSettings);
            if (parsed.rate !== undefined) {
                appSettings.speechRate = parsed.rate;
                if (ttsSpeedSlider) ttsSpeedSlider.value = parsed.rate;
                if (ttsSpeedValue) ttsSpeedValue.textContent = parsed.rate + 'x';
            }
        } catch (e) {
            console.warn('Failed to load TTS settings:', e);
        }
    }
}

/**
 * Handle output speak button click
 */
function handleOutputSpeakClick() {
    const text = textOutput.textContent;

    if (!text) {
        showToast('No text to speak', 'warning');
        return;
    }

    // If currently speaking, stop
    if (currentSpeech) {
        window.speechSynthesis.cancel();
        document.querySelectorAll('.speak-btn').forEach(btn => btn.classList.remove('speaking'));
        currentSpeech = null;
        return;
    }

    // Use enhanced TTS with selected voice
    speakTextEnhanced(text, selectedTargetLang);
}

/**
 * Enhanced speak function with TTS controls support
 */
async function speakTextEnhanced(text, langCode) {
    if (!text) {
        showToast('No text to speak', 'warning');
        return;
    }

    if (!langCode) {
        showToast('Please select a language first', 'warning');
        return;
    }

    // Prefer Magica server TTS (handles its own start/stop); fall back below.
    if (await speakWithMagica(text, langCode, outputSpeakBtn)) {
        return;
    }

    if (!window.speechSynthesis) {
        showToast('Text-to-speech is not supported in your browser', 'error');
        return;
    }

    // Stop any current speech
    if (currentSpeech) {
        window.speechSynthesis.cancel();
        document.querySelectorAll('.speak-btn').forEach(btn => btn.classList.remove('speaking'));
        currentSpeech = null;
        return;
    }

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = speechLangs[langCode] || 'en-US';
    utterance.rate = appSettings.speechRate;
    utterance.pitch = 1;

    // Use selected voice from TTS controls if available
    if (ttsState.selectedVoice) {
        utterance.voice = ttsState.selectedVoice;
    } else {
        // Find the best voice for the language
        const voice = getVoiceForLanguage(langCode);
        if (voice) {
            utterance.voice = voice;
        }
    }

    // Handle speaking state
    outputSpeakBtn.classList.add('speaking');

    utterance.onend = () => {
        outputSpeakBtn.classList.remove('speaking');
        currentSpeech = null;
    };

    utterance.onerror = (event) => {
        console.error('Speech error:', event);
        outputSpeakBtn.classList.remove('speaking');
        currentSpeech = null;
        if (event.error !== 'canceled') {
            showToast('Text-to-speech failed. Please try again.', 'error');
        }
    };

    try {
        window.speechSynthesis.speak(utterance);
        currentSpeech = utterance;
    } catch (error) {
        console.error('Speech synthesis error:', error);
        outputSpeakBtn.classList.remove('speaking');
        showToast('Failed to start text-to-speech.', 'error');
    }
}

/**
 * Get the best voice for a language
 */
function getVoiceForLanguage(langCode) {
    const tags = [speechLangs[langCode], langCode];

    // Find voices matching the language
    const matchingVoices = availableVoices.filter(v => {
        const voiceLang = v.lang.toLowerCase();
        return tags.some(tag => tag && voiceLang.startsWith(tag.toLowerCase()));
    });

    if (matchingVoices.length === 0) {
        return null;
    }

    // Prefer local voices
    const localVoice = matchingVoices.find(v => v.localService);
    if (localVoice) return localVoice;

    // Prefer default voices
    const defaultVoice = matchingVoices.find(v => v.default);
    if (defaultVoice) return defaultVoice;

    return matchingVoices[0];
}

/**
 * Get all voices for a language
 */
function getVoicesForLanguage(langCode) {
    const tags = [speechLangs[langCode], langCode];

    return availableVoices.filter(v => {
        const voiceLang = v.lang.toLowerCase();
        return tags.some(tag => tag && voiceLang.startsWith(tag.toLowerCase()));
    });
}

/**
 * Toggle TTS controls visibility
 */
function toggleTTSControls() {
    if (!ttsControls) return;

    if (ttsState.controlsVisible) {
        hideTTSControls();
    } else {
        showTTSControls();
    }
}

/**
 * Show TTS controls panel
 */
function showTTSControls() {
    if (!ttsControls) return;

    // Update voice options for current language
    updateTTSVoiceOptions(selectedTargetLang);

    ttsControls.style.display = 'block';
    ttsState.controlsVisible = true;
}

/**
 * Hide TTS controls panel
 */
function hideTTSControls() {
    if (!ttsControls) return;

    ttsControls.style.display = 'none';
    ttsState.controlsVisible = false;
}

/**
 * Update voice dropdown options for a language
 */
function updateTTSVoiceOptions(langCode) {
    if (!ttsVoiceSelect || !ttsUnavailableMsg) return;

    const voices = getVoicesForLanguage(langCode);
    ttsState.voicesForCurrentLang = voices;

    // Clear existing options except default
    ttsVoiceSelect.innerHTML = '<option value="">Default</option>';

    if (voices.length === 0) {
        ttsUnavailableMsg.style.display = 'block';
        ttsVoiceSelect.disabled = true;
    } else {
        ttsUnavailableMsg.style.display = 'none';
        ttsVoiceSelect.disabled = false;

        voices.forEach((voice, index) => {
            const option = document.createElement('option');
            option.value = index.toString();
            option.textContent = `${voice.name} (${voice.lang})`;
            if (voice.localService) {
                option.textContent += ' [Local]';
            }
            ttsVoiceSelect.appendChild(option);
        });
    }
}

/**
 * Handle voice selection change
 */
function handleTTSVoiceChange(event) {
    const value = event.target.value;

    if (value === '') {
        ttsState.selectedVoice = null;
    } else {
        const index = parseInt(value, 10);
        ttsState.selectedVoice = ttsState.voicesForCurrentLang[index] || null;
    }

    // Save preference
    saveTTSSettings();
}

/**
 * Handle speed slider change
 */
function handleTTSSpeedChange(event) {
    const rate = parseFloat(event.target.value);
    appSettings.speechRate = rate;

    if (ttsSpeedValue) {
        ttsSpeedValue.textContent = rate + 'x';
    }

    // Save preference
    saveTTSSettings();

    // Also update the settings modal if it exists
    const settingsRateSlider = document.getElementById('speech-rate');
    const settingsRateValue = document.querySelector('.range-value');
    if (settingsRateSlider) settingsRateSlider.value = rate;
    if (settingsRateValue) settingsRateValue.textContent = rate + 'x';
}

/**
 * Save TTS settings to localStorage
 */
function saveTTSSettings() {
    try {
        localStorage.setItem('ttsSettings', JSON.stringify({
            rate: appSettings.speechRate
        }));
    } catch (e) {
        console.warn('Failed to save TTS settings:', e);
    }
}

/**
 * Create an inline TTS button for a phrase/word
 * @param {string} text - Text to speak
 * @param {string} langCode - Language code
 * @returns {HTMLButtonElement}
 */
function createInlineTTSButton(text, langCode) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'tts-inline-btn';
    button.setAttribute('aria-label', `Speak: ${text.substring(0, 20)}...`);
    button.title = 'Click to hear pronunciation';
    button.innerHTML = `
        <svg class="icon" viewBox="0 0 24 24">
            <path fill="currentColor" d="M14,3.23V5.29C16.89,6.15 19,8.83 19,12C19,15.17 16.89,17.84 14,18.7V20.77C18,19.86 21,16.28 21,12C21,7.72 18,4.14 14,3.23M16.5,12C16.5,10.23 15.5,8.71 14,7.97V16C15.5,15.29 16.5,13.76 16.5,12M3,9V15H7L12,20V4L7,9H3Z"/>
        </svg>
    `;

    button.addEventListener('click', (e) => {
        e.stopPropagation();

        // Stop any current speech
        if (currentSpeech) {
            window.speechSynthesis.cancel();
            document.querySelectorAll('.tts-inline-btn.speaking').forEach(btn => btn.classList.remove('speaking'));
            currentSpeech = null;
            return;
        }

        // Speak the text
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = speechLangs[langCode] || 'en-US';
        utterance.rate = appSettings.speechRate;
        utterance.pitch = 1;

        const voice = getVoiceForLanguage(langCode);
        if (voice) {
            utterance.voice = voice;
        }

        button.classList.add('speaking');

        utterance.onend = () => {
            button.classList.remove('speaking');
            currentSpeech = null;
        };

        utterance.onerror = () => {
            button.classList.remove('speaking');
            currentSpeech = null;
        };

        try {
            window.speechSynthesis.speak(utterance);
            currentSpeech = utterance;
        } catch (error) {
            button.classList.remove('speaking');
            console.error('TTS error:', error);
        }
    });

    return button;
}

/**
 * Stop all TTS playback
 */
function stopTTS() {
    if (window.speechSynthesis) {
        window.speechSynthesis.cancel();
    }
    document.querySelectorAll('.speak-btn.speaking, .tts-inline-btn.speaking').forEach(btn => {
        btn.classList.remove('speaking');
    });
    currentSpeech = null;
}

/**
 * Check if TTS has a voice for the given language
 */
function hasVoiceForLanguage(langCode) {
    return getVoicesForLanguage(langCode).length > 0;
}

// Expose TTS functions globally for use in other modules
window.createInlineTTSButton = createInlineTTSButton;
window.speakTextEnhanced = speakTextEnhanced;
window.stopTTS = stopTTS;
window.hasVoiceForLanguage = hasVoiceForLanguage;

// Voice Input
function initializeVoiceRecognition() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    
    if (!SpeechRecognition) {
        voiceInputBtn.style.display = 'none';
        console.warn('Speech recognition not supported');
        return;
    }

    recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = false;

    recognition.onresult = (event) => {
        const transcript = event.results[0][0].transcript;
        textInput.value = transcript;
        updateCharCounter();
        voiceInputBtn.classList.remove('recording');
        showToast('Voice input completed!', 'success');
    };

    recognition.onerror = (event) => {
        console.error('Recognition error:', event.error);
        voiceInputBtn.classList.remove('recording');
        showToast(`Voice input error: ${event.error}`, 'error');
    };

    recognition.onend = () => {
        voiceInputBtn.classList.remove('recording');
    };
}

function toggleVoiceInput() {
    if (!recognition) {
        showToast('Voice input is not supported in your browser', 'error');
        return;
    }

    if (voiceInputBtn.classList.contains('recording')) {
        recognition.stop();
        voiceInputBtn.classList.remove('recording');
    } else {
        const lang = selectedSourceLang ? speechLangs[selectedSourceLang] : 'en-US';
        recognition.lang = lang;
        recognition.start();
        voiceInputBtn.classList.add('recording');
        showToast('Listening... Speak now', 'success');
    }
}

// Theme Toggle
function toggleTheme() {
    if (appSettings.autoTheme) {
        appSettings.autoTheme = false;
        localStorage.setItem('appSettings', JSON.stringify(appSettings));
        const autoThemeToggle = document.getElementById('auto-theme');
        if (autoThemeToggle) {
            autoThemeToggle.checked = false;
        }
        showToast('Auto-theme disabled for manual override', 'warning', 2500);
    }

    const currentTheme = document.documentElement.getAttribute('data-theme');
    const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
    applyTheme(newTheme, true);
    
    showToast(`${newTheme === 'dark' ? 'Dark' : 'Light'} mode enabled`, 'success');
}

function loadTheme() {
    const savedTheme = localStorage.getItem('theme') || 'light';
    applyTheme(savedTheme, false);
}

function applyTheme(theme, persist = false) {
    document.documentElement.setAttribute('data-theme', theme);
    if (persist) {
        localStorage.setItem('theme', theme);
    }
}

function syncThemeWithSettings() {
    if (!window.matchMedia) {
        return;
    }

    if (!themeMediaQuery) {
        themeMediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    }

    if (!themeListenerAttached) {
        themeMediaQuery.addEventListener('change', () => {
            if (appSettings.autoTheme) {
                applyTheme(themeMediaQuery.matches ? 'dark' : 'light', false);
            }
        });
        themeListenerAttached = true;
    }

    if (appSettings.autoTheme) {
        applyTheme(themeMediaQuery.matches ? 'dark' : 'light', false);
    }
}

// Translation History
function toggleHistory() {
    historySidebar.classList.toggle('open');
    if (historySidebar.classList.contains('open')) {
        renderHistory();
    }
}

function addToHistory(translation) {
    translationHistory.unshift(translation);

    // Keep only translations up to the configured limit
    const limit = appSettings.historyLimit || 50;
    if (translationHistory.length > limit) {
        translationHistory = translationHistory.slice(0, limit);
    }

    saveHistory();
}

function saveHistory() {
    try {
        localStorage.setItem('translationHistory', JSON.stringify(translationHistory));
    } catch (error) {
        console.error('Failed to save history:', error);
    }
}

function loadHistory() {
    try {
        const saved = localStorage.getItem('translationHistory');
        if (saved) {
            translationHistory = JSON.parse(saved);
        }
    } catch (error) {
        console.error('Failed to load history:', error);
        translationHistory = [];
    }
}

function renderHistory() {
    if (translationHistory.length === 0) {
        historyList.innerHTML = '<p style="text-align: center; color: var(--text-lighter); padding: 2rem;">No translation history yet</p>';
        return;
    }

    historyList.innerHTML = translationHistory.map((item, index) => {
        const date = new Date(item.timestamp);
        const dateStr = date.toLocaleDateString() + ' ' + date.toLocaleTimeString();
        const sourceLangName = item.sourceLang === 'auto' ? 'Auto' : languageNames[item.sourceLang];
        const targetLangName = languageNames[item.targetLang];

        return `
            <div class="history-item" data-index="${index}">
                <div class="history-item-header">
                    <span class="history-item-langs">${sourceLangName} → ${targetLangName}</span>
                    <span class="history-item-date">${dateStr}</span>
                </div>
                <div class="history-item-source">${escapeHtml(item.sourceText.substring(0, 100))}${item.sourceText.length > 100 ? '...' : ''}</div>
                <div class="history-item-target">
                    ${escapeHtml(item.targetText.substring(0, 100))}${item.targetText.length > 100 ? '...' : ''}
                    <button type="button" class="tts-inline-btn history-tts-btn" data-text="${escapeHtml(item.targetText)}" data-lang="${item.targetLang}" aria-label="Hear pronunciation" title="Hear pronunciation">
                        <svg class="icon" viewBox="0 0 24 24">
                            <path fill="currentColor" d="M14,3.23V5.29C16.89,6.15 19,8.83 19,12C19,15.17 16.89,17.84 14,18.7V20.77C18,19.86 21,16.28 21,12C21,7.72 18,4.14 14,3.23M16.5,12C16.5,10.23 15.5,8.71 14,7.97V16C15.5,15.29 16.5,13.76 16.5,12M3,9V15H7L12,20V4L7,9H3Z"/>
                        </svg>
                    </button>
                </div>
                <div class="history-item-actions">
                    <button class="history-item-btn use-btn" onclick="useHistoryItem(${index})">
                        <svg class="icon" style="width: 16px; height: 16px;" viewBox="0 0 24 24">
                            <path fill="currentColor" d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/>
                        </svg>
                        Use
                    </button>
                    <button class="history-item-btn delete-btn" onclick="deleteHistoryItem(${index})">
                        <svg class="icon" style="width: 16px; height: 16px;" viewBox="0 0 24 24">
                            <path fill="currentColor" d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
                        </svg>
                        Delete
                    </button>
                </div>
            </div>
        `;
    }).join('');

    // Attach TTS click handlers to history items
    attachHistoryTTSHandlers();
}

/**
 * Attach TTS click handlers to history item speak buttons
 */
function attachHistoryTTSHandlers() {
    document.querySelectorAll('.history-tts-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const text = btn.dataset.text;
            const lang = btn.dataset.lang;

            if (!text || !lang) return;

            // Stop any current speech
            if (currentSpeech) {
                window.speechSynthesis.cancel();
                document.querySelectorAll('.tts-inline-btn.speaking').forEach(b => b.classList.remove('speaking'));
                currentSpeech = null;
                return;
            }

            const utterance = new SpeechSynthesisUtterance(text);
            utterance.lang = speechLangs[lang] || 'en-US';
            utterance.rate = appSettings.speechRate;

            const voice = getVoiceForLanguage(lang);
            if (voice) utterance.voice = voice;

            btn.classList.add('speaking');

            utterance.onend = () => {
                btn.classList.remove('speaking');
                currentSpeech = null;
            };

            utterance.onerror = () => {
                btn.classList.remove('speaking');
                currentSpeech = null;
            };

            try {
                window.speechSynthesis.speak(utterance);
                currentSpeech = utterance;
            } catch (error) {
                btn.classList.remove('speaking');
            }
        });
    });
}

function useHistoryItem(index) {
    const item = translationHistory[index];
    if (!item) return;
    
    textInput.value = item.sourceText;
    textOutput.textContent = item.targetText;
    
    // Select the languages
    if (item.sourceLang !== 'auto') {
        sourceLangOptions.forEach(opt => {
            if (opt.dataset.lang === item.sourceLang) {
                selectLanguage(opt, 'source');
            }
        });
    }
    
    targetLangOptions.forEach(opt => {
        if (opt.dataset.lang === item.targetLang) {
            selectLanguage(opt, 'target');
        }
    });
    
    updateCharCounter();
    copyBtn.style.display = 'flex';
    outputSpeakBtn.style.display = 'flex';
    if (practiceBtn) practiceBtn.style.display = 'flex';
    checkIfFavorited();

    historySidebar.classList.remove('open');
    showToast('Translation loaded from history', 'success');
}

function deleteHistoryItem(index) {
    translationHistory.splice(index, 1);
    saveHistory();
    renderHistory();
    showToast('History item deleted', 'success');
}

function clearHistory() {
    if (confirm('Are you sure you want to clear all translation history?')) {
        translationHistory = [];
        saveHistory();
        renderHistory();
        showToast('History cleared', 'success');
    }
}

// Swap Languages
function swapLanguages() {
    if (!selectedSourceLang || !selectedTargetLang) {
        showToast('Please select both source and target languages', 'warning');
        return;
    }

    // Save state for undo
    saveStateForUndo();

    // Swap selections
    const tempLang = selectedSourceLang;
    selectedSourceLang = selectedTargetLang;
    selectedTargetLang = tempLang;

    // Update UI
    sourceLangOptions.forEach(opt => {
        opt.classList.toggle('selected', opt.dataset.lang === selectedSourceLang);
    });

    targetLangOptions.forEach(opt => {
        opt.classList.toggle('selected', opt.dataset.lang === selectedTargetLang);
    });

    // Swap text
    const tempText = textInput.value;
    textInput.value = textOutput.textContent;
    textOutput.textContent = tempText;
    
    updateCharCounter();
    showToast('Languages swapped!', 'success');
}

// Undo functionality
function saveStateForUndo() {
    undoStack.push({
        sourceText: textInput.value,
        targetText: textOutput.textContent,
        sourceLang: selectedSourceLang,
        targetLang: selectedTargetLang
    });
    // Keep only last 5 states
    if (undoStack.length > 5) {
        undoStack.shift();
    }
}

function undo() {
    if (undoStack.length === 0) {
        showToast('Nothing to undo', 'warning');
        return;
    }

    const state = undoStack.pop();
    textInput.value = state.sourceText;
    textOutput.textContent = state.targetText;

    if (state.sourceLang) {
        sourceLangOptions.forEach(opt => {
            if (opt.dataset.lang === state.sourceLang) {
                selectLanguage(opt, 'source');
            }
        });
    }
    if (state.targetLang) {
        targetLangOptions.forEach(opt => {
            if (opt.dataset.lang === state.targetLang) {
                selectLanguage(opt, 'target');
            }
        });
    }

    updateCharCounter();
    if (state.targetText) {
        copyBtn.style.display = 'flex';
        outputSpeakBtn.style.display = 'flex';
    }
    showToast('Undone!', 'success');
}

// Clear Text
function clearText() {
    if (textInput.value || textOutput.textContent) {
        saveStateForUndo();
    }
    textInput.value = '';
    textOutput.textContent = '';
    updateCharCounter();
    copyBtn.style.display = 'none';
    outputSpeakBtn.style.display = 'none';
    saveTranslationBtn.style.display = 'none';
    alternativesSection.style.display = 'none';
    pronunciationGuide.style.display = 'none';
    if (practiceBtn) practiceBtn.style.display = 'none';
    favoriteBtn.classList.remove('favorited');
    showToast('Text cleared (Ctrl+Z to undo)', 'success');
}

// Save Current Translation
function saveCurrentTranslation() {
    const sourceText = textInput.value.trim();
    const targetText = textOutput.textContent.trim();
    
    if (!sourceText || !targetText) {
        showToast('No translation to save', 'warning');
        return;
    }

    addToHistory({
        sourceText,
        targetText,
        sourceLang: selectedSourceLang || 'auto',
        targetLang: selectedTargetLang,
        timestamp: Date.now()
    });
    
    showToast('Translation saved to history!', 'success');
}

// Handle paste event for auto-detect
function handlePaste(event) {
    if (appSettings.autoDetectInput) {
        // Use setTimeout to ensure the pasted content is in the textarea
        setTimeout(() => {
            const text = textInput.value.trim();
            if (text && text.length > 0 && text.length <= 1000) {
                detectLanguage();
            }
        }, 100);
    }
}

// Keyboard Shortcuts
function handleKeyPress(event) {
    // Enter to translate (without Shift)
    if (event.key === 'Enter' && !event.shiftKey) {
        event.preventDefault();
        handleTranslation();
    }
}

function handleGlobalKeyPress(event) {
    // Escape to clear
    if (event.key === 'Escape') {
        clearText();
    }

    // Ctrl/Cmd + K to swap languages
    if ((event.ctrlKey || event.metaKey) && event.key === 'k') {
        event.preventDefault();
        swapLanguages();
    }

    // Ctrl/Cmd + H to toggle history
    if ((event.ctrlKey || event.metaKey) && event.key === 'h') {
        event.preventDefault();
        toggleHistory();
    }

    // Ctrl/Cmd + Z to undo (when not in text input)
    if ((event.ctrlKey || event.metaKey) && event.key === 'z' && document.activeElement !== textInput) {
        event.preventDefault();
        undo();
    }
}

// Utility Functions
function showToast(message, type = 'success', duration = 3000) {
    const toastMessage = toast.querySelector('p');
    toastMessage.textContent = message;
    
    toast.className = 'toast';
    toast.classList.add(type);
    toast.classList.remove('hidden');
    
    setTimeout(() => {
        toast.classList.add('hidden');
    }, duration);
}

function showLoading(show) {
    loadingOverlay.classList.toggle('hidden', !show);
}

// Typing animation for translation output
let typingAnimation = null;
let typingFullText = '';
let typingCallback = null;

function typeText(text, callback) {
    // Cancel any existing animation
    if (typingAnimation) {
        clearInterval(typingAnimation);
        typingAnimation = null;
    }

    // If animations are disabled, show immediately
    if (!appSettings.animationsEnabled) {
        textOutput.textContent = text;
        if (callback) callback();
        return;
    }

    let index = 0;
    const speed = Math.max(5, Math.min(30, 1500 / text.length)); // Adaptive speed
    typingFullText = text;
    typingCallback = callback;

    textOutput.textContent = '';
    textOutput.classList.add('typing');

    typingAnimation = setInterval(() => {
        if (index < text.length) {
            textOutput.textContent += text.charAt(index);
            index++;
        } else {
            clearInterval(typingAnimation);
            typingAnimation = null;
            textOutput.classList.remove('typing');
            const onComplete = typingCallback;
            typingFullText = '';
            typingCallback = null;
            if (onComplete) onComplete();
        }
    }, speed);
}

function skipTypingAnimation() {
    if (typingAnimation) {
        clearInterval(typingAnimation);
        typingAnimation = null;
        textOutput.classList.remove('typing');
        textOutput.textContent = typingFullText;
        const onComplete = typingCallback;
        typingFullText = '';
        typingCallback = null;
        if (onComplete) {
            onComplete();
        }
    }
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Screen reader announcements
function announceToScreenReader(message) {
    const announcer = document.getElementById('sr-announcer');
    if (announcer) {
        announcer.textContent = '';
        setTimeout(() => {
            announcer.textContent = message;
        }, 100);
    }
}

// Fetch alternative translations
async function fetchAlternatives(sourceText, mainTranslation) {
    try {
        const response = await fetch('/api/alternatives', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                text: sourceText,
                sourceLang: selectedSourceLang ? languageNames[selectedSourceLang] : undefined,
                targetLang: languageNames[selectedTargetLang]
            })
        });

        const data = await response.json();

        if (data.alternatives && data.alternatives.length > 0) {
            const filtered = data.alternatives.filter(
                alt => alt.toLowerCase() !== mainTranslation.toLowerCase()
            ).slice(0, 3);

            if (filtered.length > 0) {
                displayAlternatives(filtered);
            } else {
                alternativesSection.style.display = 'none';
            }
        } else {
            alternativesSection.style.display = 'none';
        }
    } catch (error) {
        console.error('Failed to fetch alternatives:', error);
        alternativesSection.style.display = 'none';
    }
}

function displayAlternatives(alternatives) {
    alternativesList.textContent = '';

    alternatives.forEach(alt => {
        const item = document.createElement('div');
        item.className = 'alternative-item';
        item.textContent = alt;
        item.addEventListener('click', () => {
            textOutput.textContent = alt;
            updateOutputWordCounter();
            checkIfFavorited();
            showToast('Alternative selected', 'success');
        });
        alternativesList.appendChild(item);
    });

    alternativesSection.style.display = 'block';
}

// Fetch pronunciation guide
async function fetchPronunciation(translatedText) {
    try {
        const response = await fetch('/api/pronunciation', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                text: translatedText,
                targetLang: languageNames[selectedTargetLang]
            })
        });

        const data = await response.json();

        if (data.phonetic) {
            pronunciationText.textContent = data.phonetic;
            pronunciationGuide.style.display = 'block';
        } else {
            pronunciationGuide.style.display = 'none';
        }
    } catch (error) {
        console.error('Failed to fetch pronunciation:', error);
        pronunciationGuide.style.display = 'none';
    }
}

// Initialize Speech Synthesis
function initializeSpeechSynthesis() {
    if (!window.speechSynthesis) {
        document.querySelectorAll('.speak-btn').forEach(btn => {
            btn.style.display = 'none';
        });
        console.warn('Speech synthesis not supported');
        return;
    }

    function loadVoices() {
        availableVoices = window.speechSynthesis.getVoices();
        console.log('Voices loaded:', availableVoices.length);
    }

    loadVoices();
    
    if (availableVoices.length === 0) {
        window.speechSynthesis.onvoiceschanged = loadVoices;
    }
}

// Language Search/Filter
function filterLanguages(searchTerm, type) {
    const options = type === 'source' ? sourceLangOptions : targetLangOptions;
    const term = searchTerm.toLowerCase().trim();
    
    options.forEach(option => {
        const langCode = option.dataset.lang;
        const langName = languageNames[langCode].toLowerCase();
        const matches = langName.includes(term) || langCode.includes(term);
        option.style.display = matches ? 'flex' : 'none';
    });
}

// Share Translation
async function shareTranslation() {
    const sourceText = textInput.value.trim();
    const targetText = textOutput.textContent.trim();
    
    if (!sourceText || !targetText) {
        showToast('No translation to share', 'warning');
        return;
    }
    
    const sourceLangName = selectedSourceLang ? languageNames[selectedSourceLang] : 'Auto';
    const targetLangName = languageNames[selectedTargetLang];
    const shareText = `Translation (${sourceLangName} → ${targetLangName}):\n\n${sourceText}\n\n→\n\n${targetText}\n\n(via PollyGlot)`;
    
    if (navigator.share) {
        try {
            await navigator.share({
                title: 'Translation from PollyGlot',
                text: shareText
            });
            showToast('Translation shared!', 'success');
        } catch (error) {
            if (error.name !== 'AbortError') {
                console.error('Share error:', error);
                copyShareText(shareText);
            }
        }
    } else {
        copyShareText(shareText);
    }
}

function copyShareText(text) {
    navigator.clipboard.writeText(text).then(() => {
        showToast('Translation text copied for sharing!', 'success');
    }).catch(() => {
        showToast('Could not share translation', 'error');
    });
}

// Export History
function exportHistory() {
    if (translationHistory.length === 0) {
        showToast('No history to export', 'warning');
        return;
    }
    
    // Create CSV format
    const csv = [
        ['Date', 'Source Language', 'Target Language', 'Source Text', 'Translation'].join(','),
        ...translationHistory.map(item => {
            const date = new Date(item.timestamp).toLocaleString();
            const sourceLang = item.sourceLang === 'auto' ? 'Auto' : languageNames[item.sourceLang];
            const targetLang = languageNames[item.targetLang];
            return [
                `"${date}"`,
                `"${sourceLang}"`,
                `"${targetLang}"`,
                `"${item.sourceText.replace(/"/g, '""')}"`,
                `"${item.targetText.replace(/"/g, '""')}"`
            ].join(',');
        })
    ].join('\n');
    
    // Download CSV file
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `pollyglot-history-${Date.now()}.csv`);
    link.style.display = 'none';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    
    showToast('History exported successfully!', 'success');
}

// Settings Management
function openSettings() {
    settingsModal.classList.remove('hidden');
    loadSettingsUI();
}

function closeSettingsModal() {
    settingsModal.classList.add('hidden');
}

let speechRateListenerAttached = false;

function loadSettingsUI() {
    document.getElementById('auto-theme').checked = appSettings.autoTheme;
    document.getElementById('animations-enabled').checked = appSettings.animationsEnabled;
    document.getElementById('auto-translate').checked = appSettings.autoTranslate;
    document.getElementById('auto-save').checked = appSettings.autoSave;
    document.getElementById('auto-detect-input').checked = appSettings.autoDetectInput;
    document.getElementById('speech-rate').value = appSettings.speechRate;
    document.querySelector('.range-value').textContent = appSettings.speechRate + 'x';
    document.getElementById('auto-speak').checked = appSettings.autoSpeak;
    document.getElementById('history-limit').value = appSettings.historyLimit;

    // Add range input listener for live update (only once)
    if (!speechRateListenerAttached) {
        document.getElementById('speech-rate').addEventListener('input', (e) => {
            document.querySelector('.range-value').textContent = e.target.value + 'x';
        });
        speechRateListenerAttached = true;
    }
}

function saveSettings() {
    appSettings.autoTheme = document.getElementById('auto-theme').checked;
    appSettings.animationsEnabled = document.getElementById('animations-enabled').checked;
    appSettings.autoTranslate = document.getElementById('auto-translate').checked;
    appSettings.autoSave = document.getElementById('auto-save').checked;
    appSettings.autoDetectInput = document.getElementById('auto-detect-input').checked;
    appSettings.speechRate = parseFloat(document.getElementById('speech-rate').value);
    appSettings.autoSpeak = document.getElementById('auto-speak').checked;
    appSettings.historyLimit = parseInt(document.getElementById('history-limit').value);
    
    localStorage.setItem('appSettings', JSON.stringify(appSettings));
    
    // Apply animations setting
    if (appSettings.animationsEnabled) {
        document.body.classList.remove('no-animations');
    } else {
        document.body.classList.add('no-animations');
    }

    syncThemeWithSettings();

    if (translationHistory.length > appSettings.historyLimit) {
        translationHistory = translationHistory.slice(0, appSettings.historyLimit);
        saveHistory();
        if (historySidebar.classList.contains('open') && historyList.style.display !== 'none') {
            renderHistory();
        }
    }
    
    showToast('Settings saved!', 'success');
}

function loadSettings() {
    try {
        const saved = localStorage.getItem('appSettings');
        if (saved) {
            appSettings = { ...appSettings, ...JSON.parse(saved) };
        }
        
        // Apply animations setting
        if (!appSettings.animationsEnabled) {
            document.body.classList.add('no-animations');
        }

        syncThemeWithSettings();
    } catch (error) {
        console.error('Failed to load settings:', error);
    }
}

function resetSettings() {
    if (confirm('Reset all settings to defaults?')) {
        appSettings = {
            autoTheme: false,
            animationsEnabled: true,
            autoTranslate: false,
            autoSave: true,
            autoDetectInput: false,
            speechRate: 0.9,
            autoSpeak: false,
            historyLimit: 50
        };
        localStorage.setItem('appSettings', JSON.stringify(appSettings));
        loadSettingsUI();
        syncThemeWithSettings();
        showToast('Settings reset to defaults!', 'success');
    }
}

// Fullscreen Mode
function toggleFullscreen() {
    document.body.classList.toggle('fullscreen');
    const isFullscreen = document.body.classList.contains('fullscreen');
    showToast(isFullscreen ? 'Fullscreen mode enabled' : 'Fullscreen mode disabled', 'success');
}

// Favorites Management
function loadFavorites() {
    try {
        const saved = localStorage.getItem('favoriteLanguages');
        if (saved) {
            favoriteLanguages = JSON.parse(saved);
        }
        const savedTranslations = localStorage.getItem('favoriteTranslations');
        if (savedTranslations) {
            favoriteTranslations = JSON.parse(savedTranslations);
        }
    } catch (error) {
        console.error('Failed to load favorites:', error);
        favoriteLanguages = [];
        favoriteTranslations = [];
    }
}

function saveFavorites() {
    localStorage.setItem('favoriteLanguages', JSON.stringify(favoriteLanguages));
    localStorage.setItem('favoriteTranslations', JSON.stringify(favoriteTranslations));
}

// Favorites System
function toggleFavorite() {
    const sourceText = textInput.value.trim();
    const targetText = textOutput.textContent.trim();

    if (!sourceText || !targetText) {
        showToast('No translation to favorite', 'warning');
        return;
    }

    const existingIndex = favoriteTranslations.findIndex(
        f => f.sourceText === sourceText && f.targetText === targetText
    );

    if (existingIndex >= 0) {
        favoriteTranslations.splice(existingIndex, 1);
        favoriteBtn.classList.remove('favorited');
        showToast('Removed from favorites', 'success');
    } else {
        favoriteTranslations.unshift({
            sourceText,
            targetText,
            sourceLang: selectedSourceLang || 'auto',
            targetLang: selectedTargetLang,
            timestamp: Date.now()
        });
        favoriteBtn.classList.add('favorited');
        showToast('Added to favorites!', 'success');
    }

    saveFavorites();
}

function checkIfFavorited() {
    const sourceText = textInput.value.trim();
    const targetText = textOutput.textContent.trim();

    const isFavorited = favoriteTranslations.some(
        f => f.sourceText === sourceText && f.targetText === targetText
    );

    favoriteBtn.classList.toggle('favorited', isFavorited);
}

function switchHistoryTab(tab) {
    historyTabs.forEach(t => t.classList.remove('active'));
    document.querySelector(`[data-tab="${tab}"]`).classList.add('active');

    if (tab === 'history') {
        historyList.style.display = 'flex';
        favoritesList.style.display = 'none';
        renderHistory();
    } else {
        historyList.style.display = 'none';
        favoritesList.style.display = 'flex';
        renderFavorites();
    }
}

function renderFavorites() {
    if (favoriteTranslations.length === 0) {
        favoritesList.textContent = '';
        const emptyMsg = document.createElement('p');
        emptyMsg.style.cssText = 'text-align: center; color: var(--text-lighter); padding: 2rem;';
        emptyMsg.textContent = 'No favorites yet. Click the star to save translations!';
        favoritesList.appendChild(emptyMsg);
        return;
    }

    favoritesList.textContent = '';
    favoriteTranslations.forEach((item, index) => {
        const date = new Date(item.timestamp);
        const dateStr = date.toLocaleDateString();
        const sourceLangName = item.sourceLang === 'auto' ? 'Auto' : languageNames[item.sourceLang];
        const targetLangName = languageNames[item.targetLang];

        const div = document.createElement('div');
        div.className = 'history-item favorite-item';
        div.dataset.index = index;

        const header = document.createElement('div');
        header.className = 'history-item-header';

        const langs = document.createElement('span');
        langs.className = 'history-item-langs';
        langs.textContent = `${sourceLangName} → ${targetLangName}`;

        const dateSpan = document.createElement('span');
        dateSpan.className = 'history-item-date';
        dateSpan.textContent = dateStr;

        header.appendChild(langs);
        header.appendChild(dateSpan);

        const source = document.createElement('div');
        source.className = 'history-item-source';
        source.textContent = item.sourceText.substring(0, 100) + (item.sourceText.length > 100 ? '...' : '');

        const target = document.createElement('div');
        target.className = 'history-item-target';

        // Add text content
        const targetText = document.createTextNode(
            item.targetText.substring(0, 100) + (item.targetText.length > 100 ? '...' : '')
        );
        target.appendChild(targetText);

        // Add TTS button
        const ttsBtn = document.createElement('button');
        ttsBtn.type = 'button';
        ttsBtn.className = 'tts-inline-btn';
        ttsBtn.setAttribute('aria-label', 'Hear pronunciation');
        ttsBtn.title = 'Hear pronunciation';
        ttsBtn.innerHTML = `
            <svg class="icon" viewBox="0 0 24 24">
                <path fill="currentColor" d="M14,3.23V5.29C16.89,6.15 19,8.83 19,12C19,15.17 16.89,17.84 14,18.7V20.77C18,19.86 21,16.28 21,12C21,7.72 18,4.14 14,3.23M16.5,12C16.5,10.23 15.5,8.71 14,7.97V16C15.5,15.29 16.5,13.76 16.5,12M3,9V15H7L12,20V4L7,9H3Z"/>
            </svg>
        `;
        ttsBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            speakFavoriteItem(item.targetText, item.targetLang, ttsBtn);
        });
        target.appendChild(ttsBtn);

        const actions = document.createElement('div');
        actions.className = 'history-item-actions';

        const useBtn = document.createElement('button');
        useBtn.className = 'history-item-btn use-btn';
        useBtn.textContent = 'Use';
        useBtn.onclick = () => useFavoriteItem(index);

        const removeBtn = document.createElement('button');
        removeBtn.className = 'history-item-btn delete-btn';
        removeBtn.textContent = 'Remove';
        removeBtn.onclick = () => deleteFavoriteItem(index);

        actions.appendChild(useBtn);
        actions.appendChild(removeBtn);

        div.appendChild(header);
        div.appendChild(source);
        div.appendChild(target);
        div.appendChild(actions);

        favoritesList.appendChild(div);
    });
}

/**
 * Speak a favorite item's translation
 */
function speakFavoriteItem(text, lang, button) {
    // Stop any current speech
    if (currentSpeech) {
        window.speechSynthesis.cancel();
        document.querySelectorAll('.tts-inline-btn.speaking').forEach(b => b.classList.remove('speaking'));
        currentSpeech = null;
        return;
    }

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = speechLangs[lang] || 'en-US';
    utterance.rate = appSettings.speechRate;

    const voice = getVoiceForLanguage(lang);
    if (voice) utterance.voice = voice;

    button.classList.add('speaking');

    utterance.onend = () => {
        button.classList.remove('speaking');
        currentSpeech = null;
    };

    utterance.onerror = () => {
        button.classList.remove('speaking');
        currentSpeech = null;
    };

    try {
        window.speechSynthesis.speak(utterance);
        currentSpeech = utterance;
    } catch (error) {
        button.classList.remove('speaking');
    }
}

function useFavoriteItem(index) {
    const item = favoriteTranslations[index];
    if (!item) return;

    textInput.value = item.sourceText;
    textOutput.textContent = item.targetText;

    if (item.sourceLang !== 'auto') {
        sourceLangOptions.forEach(opt => {
            if (opt.dataset.lang === item.sourceLang) {
                selectLanguage(opt, 'source');
            }
        });
    }

    targetLangOptions.forEach(opt => {
        if (opt.dataset.lang === item.targetLang) {
            selectLanguage(opt, 'target');
        }
    });

    updateCharCounter();
    copyBtn.style.display = 'flex';
    outputSpeakBtn.style.display = 'flex';
    if (practiceBtn) practiceBtn.style.display = 'flex';
    favoriteBtn.classList.add('favorited');

    historySidebar.classList.remove('open');
    showToast('Favorite loaded', 'success');
}

function deleteFavoriteItem(index) {
    favoriteTranslations.splice(index, 1);
    saveFavorites();
    renderFavorites();
    checkIfFavorited();
    showToast('Favorite removed', 'success');
}

// Browser Language Detection
function detectBrowserLanguage() {
    const browserLang = navigator.language || navigator.userLanguage;
    const langCode = browserLang.split('-')[0];
    
    // Check if the browser language is in our supported languages
    if (languageNames[langCode]) {
        // Set as default target language if it's different from current
        if (!selectedTargetLang || selectedTargetLang === 'es') {
            targetLangOptions.forEach(opt => {
                if (opt.dataset.lang === langCode) {
                    selectLanguage(opt, 'target');
                }
            });
        }
    }
}

// Service Worker for PWA
function registerServiceWorker() {
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('/sw.js').then(() => {
            console.log('Service Worker registered');
        }).catch((error) => {
            console.log('Service Worker registration failed:', error);
        });
    }
}

// Initialize app when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}

// ================================
// Pronunciation Practice System
// ================================

/**
 * Initialize pronunciation practice event listeners
 */
function initPronunciationPractice() {
    const closePracticeBtn = document.querySelector('.close-practice-btn');
    const recordBtn = document.getElementById('practice-record-btn');
    const playReferenceBtn = document.getElementById('play-reference-btn');
    const playRecordingBtn = document.getElementById('play-recording-btn');
    const retryBtn = document.getElementById('retry-btn');
    const nextPhraseBtn = document.getElementById('next-phrase-btn');

    // Practice button in output section
    if (practiceBtn) {
        practiceBtn.addEventListener('click', startPronunciationPractice);
        // Pre-load Whisper on hover
        practiceBtn.addEventListener('mouseenter', preloadWhisper, { once: true });
    }

    // Close practice
    if (closePracticeBtn) {
        closePracticeBtn.addEventListener('click', closePronunciationPractice);
    }

    // Record button - hold to record
    if (recordBtn) {
        recordBtn.addEventListener('mousedown', startPracticeRecording);
        recordBtn.addEventListener('mouseup', stopPracticeRecording);
        recordBtn.addEventListener('mouseleave', stopPracticeRecording);
        recordBtn.addEventListener('touchstart', (e) => {
            e.preventDefault();
            startPracticeRecording();
        });
        recordBtn.addEventListener('touchend', stopPracticeRecording);
    }

    // Playback buttons
    if (playReferenceBtn) {
        playReferenceBtn.addEventListener('click', playReferenceAudio);
    }
    if (playRecordingBtn) {
        playRecordingBtn.addEventListener('click', playRecordingAudio);
    }

    // Feedback actions
    if (retryBtn) {
        retryBtn.addEventListener('click', retryPracticeRecording);
    }
    if (nextPhraseBtn) {
        nextPhraseBtn.addEventListener('click', () => closePronunciationPractice());
    }

    // Load practice history
    loadPracticeHistory();
}

/**
 * Pre-load Whisper model in background
 */
async function preloadWhisper() {
    if (practiceState.whisperReady || practiceState.whisperLoading) return;

    practiceState.whisperLoading = true;
    console.log('Pre-loading Whisper model...');

    try {
        // Dynamically import Transformers.js from CDN
        const { pipeline } = await import('https://cdn.jsdelivr.net/npm/@xenova/transformers@2.17.2');

        window.whisperPipeline = await pipeline('automatic-speech-recognition', 'Xenova/whisper-tiny', {
            progress_callback: (progress) => {
                if (progress.status === 'progress' && progress.progress !== undefined) {
                    console.log(`Loading Whisper: ${Math.round(progress.progress)}%`);
                }
            }
        });

        practiceState.whisperReady = true;
        practiceState.whisperLoading = false;
        console.log('Whisper model loaded!');
    } catch (error) {
        console.warn('Whisper loading failed:', error);
        practiceState.whisperLoading = false;
    }
}

/**
 * Start pronunciation practice from current translation
 */
async function startPronunciationPractice() {
    const translatedText = textOutput.textContent.trim();
    const sourceText = textInput.value.trim();

    if (!translatedText) {
        showToast('Please translate something first', 'warning');
        return;
    }

    practiceState.currentPhrase = translatedText;
    practiceState.originalText = sourceText;
    practiceState.targetLang = selectedTargetLang;

    const practiceSection = document.getElementById('pronunciation-practice');
    if (practiceSection) {
        practiceSection.style.display = 'block';
        practiceState.isActive = true;

        // Update phrase display
        const phraseText = document.getElementById('practice-phrase-text');
        const originalText = document.getElementById('practice-original-text');
        if (phraseText) phraseText.textContent = translatedText;
        if (originalText) originalText.textContent = sourceText;

        // Initialize Whisper if not ready
        const loadingEl = document.getElementById('practice-loading');
        const contentEl = document.querySelector('.practice-content');

        if (!practiceState.whisperReady && !practiceState.whisperLoading) {
            if (loadingEl) loadingEl.style.display = 'flex';
            if (contentEl) contentEl.style.display = 'none';

            await preloadWhisper();

            if (loadingEl) loadingEl.style.display = 'none';
            if (contentEl) contentEl.style.display = 'block';
        }

        // Reset UI
        resetPracticeUI();

        // Scroll to practice section
        practiceSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
}

/**
 * Close pronunciation practice
 */
function closePronunciationPractice() {
    const practiceSection = document.getElementById('pronunciation-practice');
    if (practiceSection) {
        practiceSection.style.display = 'none';
    }
    practiceState.isActive = false;
    resetPracticeUI();

    // Clean up WaveSurfer instance
    if (practiceState.wavesurferRecording) {
        practiceState.wavesurferRecording.destroy();
        practiceState.wavesurferRecording = null;
    }
}

/**
 * Reset practice UI state
 */
function resetPracticeUI() {
    const recordingPlayback = document.getElementById('recording-playback');
    const feedback = document.getElementById('practice-feedback');
    const timer = document.getElementById('recording-timer');
    const recordBtn = document.getElementById('practice-record-btn');

    if (recordingPlayback) recordingPlayback.style.display = 'none';
    if (feedback) feedback.style.display = 'none';
    if (timer) timer.style.display = 'none';
    if (recordBtn) recordBtn.classList.remove('recording');

    stopPracticeTimer();
    practiceState.recordingBlob = null;
}

/**
 * Play reference audio using browser TTS with enhanced voice selection
 */
function playReferenceAudio() {
    if (!practiceState.currentPhrase) return;

    const synth = window.speechSynthesis;
    const playBtn = document.getElementById('play-reference-btn');

    if (synth.speaking) {
        synth.cancel();
        updatePracticePlayButton(playBtn, false);
        return;
    }

    const utterance = new SpeechSynthesisUtterance(practiceState.currentPhrase);
    utterance.lang = speechLangs[practiceState.targetLang] || 'en-US';
    utterance.rate = 0.85; // Slower for learning

    // Use the best available voice for the language
    const voice = getVoiceForLanguage(practiceState.targetLang);
    if (voice) {
        utterance.voice = voice;
    } else {
        // Warn if no voice available
        const langName = languageNames[practiceState.targetLang] || practiceState.targetLang;
        showToast(`No native voice available for ${langName}. Using default.`, 'warning');
    }

    utterance.onstart = () => updatePracticePlayButton(playBtn, true);
    utterance.onend = () => updatePracticePlayButton(playBtn, false);
    utterance.onerror = () => updatePracticePlayButton(playBtn, false);

    synth.speak(utterance);
}

/**
 * Start recording user's pronunciation
 */
async function startPracticeRecording() {
    if (practiceState.mediaRecorder?.state === 'recording') return;

    try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        const mimeType = MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' : 'audio/mp4';

        practiceState.mediaRecorder = new MediaRecorder(stream, { mimeType });
        practiceState.audioChunks = [];

        practiceState.mediaRecorder.ondataavailable = (e) => {
            if (e.data.size > 0) {
                practiceState.audioChunks.push(e.data);
            }
        };

        practiceState.mediaRecorder.onstop = async () => {
            stream.getTracks().forEach(track => track.stop());
            await processPracticeRecording();
        };

        practiceState.mediaRecorder.start();
        practiceState.recordingStartTime = Date.now();

        // Update UI
        const recordBtn = document.getElementById('practice-record-btn');
        if (recordBtn) recordBtn.classList.add('recording');
        startPracticeTimer();

    } catch (error) {
        console.error('Failed to start recording:', error);
        showToast('Could not access microphone', 'error');
    }
}

/**
 * Stop recording
 */
function stopPracticeRecording() {
    if (practiceState.mediaRecorder?.state !== 'recording') return;

    practiceState.mediaRecorder.stop();
    const recordBtn = document.getElementById('practice-record-btn');
    if (recordBtn) recordBtn.classList.remove('recording');
    stopPracticeTimer();
}

/**
 * Process the recorded audio
 */
async function processPracticeRecording() {
    const blob = new Blob(practiceState.audioChunks, {
        type: practiceState.mediaRecorder.mimeType
    });
    practiceState.recordingBlob = blob;

    // Show playback section
    const recordingPlayback = document.getElementById('recording-playback');
    if (recordingPlayback) {
        recordingPlayback.style.display = 'block';
    }

    // Create audio URL for playback
    const audioUrl = URL.createObjectURL(blob);

    // Initialize WaveSurfer for waveform visualization
    const waveformEl = document.getElementById('recording-waveform');
    if (waveformEl) {
        // Clean up existing
        if (practiceState.wavesurferRecording) {
            practiceState.wavesurferRecording.destroy();
        }

        try {
            // Dynamically load WaveSurfer
            if (!window.WaveSurfer) {
                const script = document.createElement('script');
                script.src = 'https://cdn.jsdelivr.net/npm/wavesurfer.js@7';
                document.head.appendChild(script);
                await new Promise(resolve => script.onload = resolve);
            }

            practiceState.wavesurferRecording = WaveSurfer.create({
                container: waveformEl,
                waveColor: 'rgba(232, 93, 59, 0.4)',
                progressColor: '#e85d3b',
                cursorColor: '#4299e1',
                cursorWidth: 2,
                barWidth: 2,
                barGap: 1,
                barRadius: 2,
                height: 48,
                url: audioUrl
            });

            const playBtn = document.getElementById('play-recording-btn');
            practiceState.wavesurferRecording.on('play', () => updatePracticePlayButton(playBtn, true));
            practiceState.wavesurferRecording.on('pause', () => updatePracticePlayButton(playBtn, false));
            practiceState.wavesurferRecording.on('finish', () => updatePracticePlayButton(playBtn, false));
        } catch (e) {
            console.warn('WaveSurfer failed:', e);
            // Fallback to simple audio
            waveformEl.innerHTML = `<audio controls style="width:100%;height:48px" src="${audioUrl}"></audio>`;
        }
    }

    // Transcribe with Whisper
    await transcribePracticeRecording(blob);
}

/**
 * Transcribe the recording using Whisper
 */
async function transcribePracticeRecording(blob) {
    const feedback = document.getElementById('practice-feedback');
    const transcriptionEl = document.getElementById('feedback-transcription');

    if (!practiceState.whisperReady || !window.whisperPipeline) {
        // Fallback: show feedback without transcription
        if (feedback) feedback.style.display = 'block';
        if (transcriptionEl) transcriptionEl.textContent = '(Speech recognition not available - try listening to your recording)';
        return;
    }

    try {
        showToast('Transcribing...', 'success');

        // Convert blob to audio data
        const arrayBuffer = await blob.arrayBuffer();
        const audioContext = new AudioContext({ sampleRate: 16000 });
        const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);

        // Mix to mono
        const length = audioBuffer.length;
        const numChannels = audioBuffer.numberOfChannels;
        const mono = new Float32Array(length);
        for (let i = 0; i < length; i++) {
            let sum = 0;
            for (let ch = 0; ch < numChannels; ch++) {
                sum += audioBuffer.getChannelData(ch)[i];
            }
            mono[i] = sum / numChannels;
        }

        // Resample to 16kHz if needed
        let audioData = mono;
        if (audioBuffer.sampleRate !== 16000) {
            const ratio = audioBuffer.sampleRate / 16000;
            const newLength = Math.round(length / ratio);
            audioData = new Float32Array(newLength);
            for (let i = 0; i < newLength; i++) {
                const srcIndex = i * ratio;
                const floor = Math.floor(srcIndex);
                const ceil = Math.min(floor + 1, length - 1);
                const t = srcIndex - floor;
                audioData[i] = mono[floor] * (1 - t) + mono[ceil] * t;
            }
        }

        await audioContext.close();

        // Transcribe
        const result = await window.whisperPipeline(audioData, {
            language: practiceState.targetLang,
            task: 'transcribe'
        });

        // Show result
        if (feedback) feedback.style.display = 'block';
        if (transcriptionEl) transcriptionEl.textContent = result.text.trim() || '(No speech detected)';

        // Save to practice history
        savePracticeAttempt(result.text.trim());

    } catch (error) {
        console.error('Transcription failed:', error);
        if (feedback) feedback.style.display = 'block';
        if (transcriptionEl) transcriptionEl.textContent = '(Transcription failed - try again)';
    }
}

/**
 * Play recording audio
 */
function playRecordingAudio() {
    if (practiceState.wavesurferRecording) {
        practiceState.wavesurferRecording.playPause();
    }
}

/**
 * Retry practice recording
 */
function retryPracticeRecording() {
    resetPracticeUI();
}

/**
 * Timer functions for recording
 */
function startPracticeTimer() {
    const timer = document.getElementById('recording-timer');
    if (timer) timer.style.display = 'block';

    practiceState.timerInterval = setInterval(() => {
        const elapsed = Math.floor((Date.now() - practiceState.recordingStartTime) / 1000);
        const mins = Math.floor(elapsed / 60);
        const secs = elapsed % 60;
        const timerValue = timer?.querySelector('.timer-value');
        if (timerValue) {
            timerValue.textContent = `${mins}:${secs.toString().padStart(2, '0')}`;
        }
    }, 100);
}

function stopPracticeTimer() {
    if (practiceState.timerInterval) {
        clearInterval(practiceState.timerInterval);
        practiceState.timerInterval = null;
    }
}

/**
 * Update play button state
 */
function updatePracticePlayButton(btn, isPlaying) {
    if (!btn) return;
    const playIcon = btn.querySelector('.play-icon');
    const pauseIcon = btn.querySelector('.pause-icon');
    if (playIcon) playIcon.style.display = isPlaying ? 'none' : 'block';
    if (pauseIcon) pauseIcon.style.display = isPlaying ? 'block' : 'none';
}

/**
 * Save practice attempt to history
 */
function savePracticeAttempt(transcription) {
    const phrase = practiceState.currentPhrase;
    let entry = practiceState.practiceHistory.find(h => h.phrase === phrase);

    if (!entry) {
        entry = {
            phrase,
            original: practiceState.originalText,
            targetLang: practiceState.targetLang,
            attempts: []
        };
        practiceState.practiceHistory.push(entry);
    }

    entry.attempts.push({
        transcription,
        timestamp: Date.now()
    });

    // Keep only last 100 entries
    if (practiceState.practiceHistory.length > 100) {
        practiceState.practiceHistory = practiceState.practiceHistory.slice(-100);
    }

    try {
        localStorage.setItem('pronunciationPracticeHistory', JSON.stringify(practiceState.practiceHistory));
    } catch (e) {
        console.warn('Failed to save practice history:', e);
    }
}

/**
 * Load practice history from localStorage
 */
function loadPracticeHistory() {
    try {
        const saved = localStorage.getItem('pronunciationPracticeHistory');
        if (saved) {
            practiceState.practiceHistory = JSON.parse(saved);
        }
    } catch (e) {
        console.warn('Failed to load practice history:', e);
        practiceState.practiceHistory = [];
    }
}

// Make showToast globally accessible for practice module
window.showToast = showToast;

// Hide output actions initially
copyBtn.style.display = 'none';
outputSpeakBtn.style.display = 'none';
if (saveTranslationBtn) {
    saveTranslationBtn.style.display = 'none';
}
if (shareBtn) {
    shareBtn.style.display = 'none';
}
if (practiceBtn) {
    practiceBtn.style.display = 'none';
}
