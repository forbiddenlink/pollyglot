# PollyGlot - AI Translation App

A vanilla JS + Express translation app using OpenAI's GPT-4o-mini for translation, language detection, pronunciation guides, and alternative phrasings between 20 languages. Text-to-speech runs through a server-side voice pipeline (Magica/ElevenLabs, then MiniMax, then OpenAI TTS) with a browser `speechSynthesis` fallback. Voice input uses the browser's native Web Speech API.

The repo also carries a number of dependencies for features that aren't wired into the running app yet (see "Not Yet Wired Up" below). Don't assume something works just because it's in `package.json`.

## Features

### Translation
- **20 Languages**: English, Spanish, French, German, Italian, Portuguese, Russian, Chinese, Japanese, Korean, Arabic, Hindi, Dutch, Polish, Turkish, Vietnamese, Thai, Swedish, Greek, Hebrew
- **Automatic Language Detection**: Detect the source language via GPT-4o-mini
- **Formality Selector**: Choose neutral, formal, or informal tone
- **Alternative Translations**: 3 alternative phrasings for short text (under 200 characters)
- **Pronunciation Guide**: Phonetic spelling for non-Latin scripts (under 500 characters)
- **Email Delivery**: Optionally send a translation result via email (Resend), if `RESEND_API_KEY` is configured

### Audio
- **Text-to-Speech**: Server-side voice via Magica (ElevenLabs multilingual v2), falling back to MiniMax `speech-02-hd`, falling back to OpenAI `tts-1`. Falls back further to the browser's `speechSynthesis` if none of those are configured or all fail
- **Voice Input**: Native browser `SpeechRecognition`/`webkitSpeechRecognition` (Chrome/Edge)

### Organization
- **Favorites**: Star translations for quick access
- **Translation History**: Auto-saves last 50 translations to `localStorage` (configurable)
- **Export History**: Download history as CSV

### User Experience
- **Example Phrases**: Clickable examples when input is empty
- **Undo**: Restore text after clear/swap (Ctrl/Cmd+Z)
- **Typing Animation**: Smooth character-by-character output
- **Dark Mode**: Toggle between light and dark themes
- **Reading Time**: Estimated read time for input text
- **Keyboard Shortcuts**:
  - `Enter` - Translate
  - `Esc` - Clear
  - `Ctrl/Cmd + K` - Swap languages
  - `Ctrl/Cmd + H` - Toggle history
  - `Ctrl/Cmd + Z` - Undo

### Technical
- **PWA Support**: `manifest.json` + service worker (`sw.js`), installable
- **Rate Limiting**: In-memory per-IP rate limit on the API (50 requests/minute)
- **Accessibility**: Keyboard navigation, `aria-live` screen reader announcer
- **Observability**: Langfuse tracing on every OpenAI call, PostHog event capture on completed translations (both no-op if their keys aren't configured)

## Not Yet Wired Up

These packages are in `package.json` but aren't imported by `index.html` or `script.js` (the code that actually runs in the browser), and there's no route or UI reaching them:

- **Next.js, `next-safe-action`**: no `app/`/`pages/` directory exists; `next` is only used for `next-sitemap`'s postbuild sitemap/robots.txt generation
- **`@ai-sdk/google`, `ai`**: not imported anywhere
- **`@xenova/transformers`, `whisper-web-transcriber`**: an in-browser Whisper transcription module exists at `lib/speech-recognition.js`/`.ts` but isn't loaded by the app; voice input actually uses the browser's native Web Speech API
- **`wavesurfer.js`**: a waveform audio player exists at `lib/audio-player.js` but isn't used
- **`ts-fsrs`**: a spaced-repetition scheduler exists at `lib/spaced-repetition.js` but isn't used
- **`franc`, `compromise`, `natural`**: NLP/language-detection utilities exist at `src/lib/language.ts` but aren't used
- **`@trigger.dev/sdk`**: `trigger.config.ts` points at `./src/trigger`, which doesn't exist yet (no jobs defined)
- **`sharp`**: unused
- **Wiktionary lookups** (`src/lib/wiktionary.ts`): standalone, unused

## Installation

### Prerequisites
- Node.js (v18+)
- OpenAI API key ([Get one here](https://platform.openai.com/api-keys)) - required for translation, detection, pronunciation, and alternatives
- Optional: Magica, MiniMax, Resend, Langfuse, PostHog API keys for TTS voices, email delivery, and tracing/analytics (each feature degrades gracefully if its key is missing)

### Setup

```bash
# Clone and install root dependencies (dev/test tooling)
git clone https://github.com/forbiddenlink/pollyglot.git
cd pollyglot
pnpm install

# Configure and start the API
cd api
npm install
echo "OPENAI_API_KEY=your_key_here" > .env
echo "PORT=3000" >> .env
npm run dev
```

In a second terminal, serve the static frontend from the project root (there's no root build step):

```bash
cd pollyglot
python3 -m http.server 4173
```

Open http://localhost:4173

### Testing

```bash
pnpm test          # watch mode (vitest)
pnpm test:run      # single run
pnpm test:coverage # with coverage
```

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
- Use Ctrl/Cmd+Z to undo after clearing

## Tech Stack

- **Frontend**: Vanilla JavaScript, CSS3, Web Speech API
- **Backend**: Node.js, Express (deployed as a single Vercel serverless function, routed via `vercel.json` rewrites)
- **AI**: OpenAI GPT-4o-mini (translation, detection, pronunciation, alternatives)
- **Voice**: Magica (ElevenLabs) / MiniMax `speech-02-hd` / OpenAI `tts-1`, with browser `speechSynthesis` fallback
- **Email**: Resend (optional, for emailing translation results)
- **Observability**: Langfuse (tracing), PostHog (product analytics)
- **Testing**: Vitest, Testing Library, MSW

## License

MIT License

---

Built by Elizabeth Stein
