# PollyGlot - AI Translation App

A modern AI-powered translation app using OpenAI's GPT-4o-mini for high-quality translations between 20 languages. Features include text-to-speech, voice input, translation history, favorites, pronunciation guides, and dark mode.

## Features

### Translation
- **20 Languages**: English, Spanish, French, German, Italian, Portuguese, Russian, Chinese, Japanese, Korean, Arabic, Hindi, Dutch, Polish, Turkish, Vietnamese, Thai, Swedish, Greek, Hebrew
- **Automatic Language Detection**: Intelligently detect the source language
- **Formality Selector**: Choose neutral, formal, or casual tone
- **Alternative Translations**: See 2-3 alternative phrasings for short text
- **Pronunciation Guide**: Phonetic spelling for non-Latin scripts (Chinese, Japanese, Korean, Arabic, etc.)

### Audio
- **Text-to-Speech**: Listen to source and translated text
- **Voice Input**: Speak instead of typing (Chrome/Edge)

### Organization
- **Favorites**: Star translations for quick access
- **Translation History**: Auto-saves last 50 translations (configurable)
- **Export History**: Download as CSV

### User Experience
- **Example Phrases**: Clickable examples when input is empty
- **Undo**: Restore text after clear/swap (Ctrl+Z)
- **Typing Animation**: Smooth character-by-character output
- **Dark Mode**: Toggle between light and dark themes
- **Reading Time**: Estimated read time for input text
- **Keyboard Shortcuts**:
  - `Enter` - Translate
  - `Esc` - Clear
  - `Ctrl/Cmd + K` - Swap languages
  - `Ctrl/Cmd + Z` - Undo
  - `Ctrl/Cmd + H` - Toggle history

### Technical
- **PWA Support**: Install as native app
- **Rate Limiting**: Built-in API protection
- **Accessibility**: Keyboard navigation, screen reader support

## Installation

### Prerequisites
- Node.js (v14+)
- OpenAI API key ([Get one here](https://platform.openai.com/api-keys))

### Setup

```bash
# Clone and install
git clone https://github.com/forbiddenlink/pollyglot.git
cd pollyglot
npm install

# Configure environment
echo "OPENAI_API_KEY=your_key_here" > .env
echo "PORT=3000" >> .env

# Start
npm start
```

Open http://localhost:3000

## Usage

1. Enter text or click an example phrase
2. Select source language (or use Auto-Detect)
3. Select target language
4. Choose formality (optional)
5. Click Translate or press Enter

### Tips
- Star translations to save as favorites
- For non-Latin scripts, check the pronunciation guide
- Short phrases show alternative translations
- Use Ctrl+Z to undo after clearing

## Tech Stack

- **Frontend**: Vanilla JavaScript, CSS3
- **Backend**: Node.js, Express
- **AI**: OpenAI GPT-4o-mini
- **APIs**: Web Speech API, Speech Recognition API

## License

MIT License

---

Built by Elizabeth Stein
