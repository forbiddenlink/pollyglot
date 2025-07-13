// DOM Elements
const textInput = document.querySelector('.text-input');
const textOutput = document.querySelector('.text-output');
const translateBtn = document.querySelector('.translate-btn');
const detectLangBtn = document.querySelector('.detect-lang');
const loadingOverlay = document.querySelector('.loading-overlay');
const sourceLangOptions = document.querySelectorAll('.source-lang .lang-option');
const targetLangOptions = document.querySelectorAll('.target-lang .lang-option');
const charCounter = document.querySelector('.char-counter');
const copyBtn = document.querySelector('.copy-btn');
const toast = document.querySelector('.toast');
const inputSpeakBtn = document.querySelector('.input-speak');
const outputSpeakBtn = document.querySelector('.output-speak');

// State
let selectedSourceLang = null;
let selectedTargetLang = null;
let currentSpeech = null;
let availableVoices = [];

// Language mapping
const languageNames = {
    'fr': 'French',
    'es': 'Spanish',
    'ja': 'Japanese'
};

// BCP 47 language tags for speech synthesis
const speechLangs = {
    'fr': 'fr-FR',
    'es': 'es-ES',
    'ja': 'ja-JP'
};

// Event Listeners
sourceLangOptions.forEach(option => {
    option.addEventListener('click', () => selectLanguage(option, 'source'));
});

targetLangOptions.forEach(option => {
    option.addEventListener('click', () => selectLanguage(option, 'target'));
});

translateBtn.addEventListener('click', handleTranslation);
detectLangBtn.addEventListener('click', detectLanguage);
textInput.addEventListener('input', updateCharCounter);
copyBtn.addEventListener('click', copyTranslation);
inputSpeakBtn.addEventListener('click', () => speakText(textInput.value, selectedSourceLang));
outputSpeakBtn.addEventListener('click', () => speakText(textOutput.textContent, selectedTargetLang));

// Functions
function selectLanguage(option, type) {
    const options = type === 'source' ? sourceLangOptions : targetLangOptions;
    options.forEach(opt => opt.classList.remove('selected'));
    option.classList.add('selected');
    
    const langCode = option.querySelector('.lang-flag').dataset.lang;
    if (type === 'source') {
        selectedSourceLang = langCode;
    } else {
        selectedTargetLang = langCode;
    }
}

function updateCharCounter() {
    const count = textInput.value.length;
    charCounter.textContent = `${count} character${count !== 1 ? 's' : ''}`;
}

async function handleTranslation() {
    const text = textInput.value.trim();
    if (!text) {
        showToast('Please enter some text to translate');
        return;
    }

    if (!selectedTargetLang) {
        showToast('Please select a target language');
        return;
    }

    try {
        showLoading(true);
        const response = await fetch('/api/translate', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                text,
                sourceLang: selectedSourceLang ? languageNames[selectedSourceLang] : undefined,
                targetLang: languageNames[selectedTargetLang]
            })
        });

        const data = await response.json();
        if (!response.ok) {
            throw new Error(data.error || 'Translation failed');
        }

        textOutput.textContent = data.translation;
        copyBtn.style.display = 'flex';
        outputSpeakBtn.style.display = 'flex';
    } catch (error) {
        console.error('Translation error:', error);
        showToast('An error occurred during translation. Please try again.');
    } finally {
        showLoading(false);
    }
}

async function detectLanguage() {
    const text = textInput.value.trim();
    if (!text) {
        showToast('Please enter some text to detect its language');
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

        sourceLangOptions.forEach(option => {
            const langCode = option.querySelector('.lang-flag').dataset.lang;
            if (langCode === data.detectedLanguage) {
                selectLanguage(option, 'source');
            }
        });
    } catch (error) {
        console.error('Language detection error:', error);
        showToast('An error occurred during language detection. Please try again.');
    } finally {
        showLoading(false);
    }
}

async function copyTranslation() {
    const text = textOutput.textContent;
    if (!text) return;

    try {
        await navigator.clipboard.writeText(text);
        showToast('Translation copied to clipboard!');
    } catch (error) {
        console.error('Copy error:', error);
        showToast('Failed to copy translation');
    }
}

function speakText(text, langCode) {
    if (!text || !langCode) {
        showToast('Please enter text and select a language first');
        return;
    }

    // Check if speech synthesis is supported
    if (!window.speechSynthesis) {
        showToast('Text-to-speech is not supported in your browser');
        return;
    }

    // Stop any current speech
    if (currentSpeech) {
        window.speechSynthesis.cancel();
        currentSpeech = null;
        document.querySelectorAll('.speak-btn').forEach(btn => btn.classList.remove('speaking'));
    }

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = speechLangs[langCode];
    
    // Find the best voice for the language
    const voice = availableVoices.find(v => v.lang.startsWith(langCode)) || 
                 availableVoices.find(v => v.lang.startsWith(speechLangs[langCode]));
    
    if (voice) {
        utterance.voice = voice;
    } else {
        console.log('No specific voice found for', langCode, 'using default voice');
    }

    // Handle speaking state
    const button = langCode === selectedSourceLang ? inputSpeakBtn : outputSpeakBtn;
    button.classList.add('speaking');

    utterance.onend = () => {
        button.classList.remove('speaking');
        currentSpeech = null;
    };

    utterance.onerror = (event) => {
        console.error('Speech error:', event);
        button.classList.remove('speaking');
        currentSpeech = null;
        showToast('Text-to-speech failed. Please try again.');
    };

    try {
        window.speechSynthesis.speak(utterance);
        currentSpeech = utterance;
    } catch (error) {
        console.error('Speech synthesis error:', error);
        button.classList.remove('speaking');
        showToast('Failed to start text-to-speech. Please try again.');
    }
}

function showToast(message, duration = 3000) {
    const toastMessage = toast.querySelector('p');
    toastMessage.textContent = message;
    toast.classList.remove('hidden');
    
    setTimeout(() => {
        toast.classList.add('hidden');
    }, duration);
}

function showLoading(show) {
    loadingOverlay.classList.toggle('hidden', !show);
}

// Initialize
updateCharCounter();
copyBtn.style.display = 'none';
outputSpeakBtn.style.display = 'none';

// Initialize speech synthesis
function initializeSpeechSynthesis() {
    // Load available voices
    availableVoices = window.speechSynthesis.getVoices();
    
    if (availableVoices.length === 0) {
        // Some browsers (like Chrome) load voices asynchronously
        window.speechSynthesis.onvoiceschanged = () => {
            availableVoices = window.speechSynthesis.getVoices();
            console.log('Voices loaded:', availableVoices.length);
        };
    } else {
        console.log('Voices loaded:', availableVoices.length);
    }
}

// Check if speech synthesis is supported
if (window.speechSynthesis) {
    initializeSpeechSynthesis();
} else {
    console.warn('Speech synthesis not supported');
    document.querySelectorAll('.speak-btn').forEach(btn => {
        btn.style.display = 'none';
    });
}
