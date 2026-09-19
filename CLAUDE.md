# PollyGlot: AI Translation App

A vanilla JS + Express translation app using OpenAI GPT-4o-mini for translation, language
detection, pronunciation guides, and alternative phrasings between 20 languages. Text-to-speech
runs through a server-side voice pipeline (Magica/ElevenLabs, then MiniMax, then OpenAI TTS)
with a browser `speechSynthesis` fallback. Voice input uses the browser's native Web Speech API.

Repo: https://github.com/forbiddenlink/pollyglot

**The repo carries a large number of dependencies not wired into the running app.** Do not
assume a package in `package.json` is actually used; see Not Wired Up below.

## Structure (two separate Node trees)

- Root (`package.json`, pnpm): test tooling (Vitest, Testing Library, MSW) plus a long list of
  library dependencies for features that mostly aren't connected yet (see below). No app router,
  no build step for the frontend itself; `next`/`next-sitemap` here exist only to run
  `postbuild` sitemap/robots.txt generation.
- `api/` (`api/package.json`, npm): the real Express backend (`api/index.js`), deployed as a
  single Vercel serverless function via `vercel.json` rewrites.
- The static frontend (`index.html`, `script.js`, `index.css`, `about.html`, `contact.html`) is
  served directly with no build step.

## Commands

Root (pnpm):
- `pnpm test` / `pnpm test:watch` - Vitest watch mode
- `pnpm test:run` - single run
- `pnpm test:coverage` - with coverage

API (npm, run from `api/`):
- `npm run dev` - `nodemon index.js`
- `npm start` - `node index.js`

Frontend (no build): serve the repo root with any static server, e.g.
`python3 -m http.server 4173`, then open the page. In production, `vercel.json` rewrites
`/api/:path*` to the Express function and serves `index.html`/`about.html`/`contact.html`.

## Env vars

- `OPENAI_API_KEY` (required) - translation, detection, pronunciation, alternatives
- `PORT` - api/index.js listen port (default 3000)
- `ALLOWED_ORIGINS` - CORS allowlist for the API
- `OPENAI_TIMEOUT_MS` - request timeout override (default 30000)
- `MAGICA_KEY` - Magica/ElevenLabs TTS voice (optional, first choice in the TTS fallback chain)
- `MINIMAX_API_KEY` - MiniMax `speech-02-hd` TTS (optional, second fallback)
- `RESEND_API_KEY` / `RESEND_FROM_EMAIL` - email delivery of a translation result (optional)
- `LANGFUSE_PUBLIC_KEY` / `LANGFUSE_SECRET_KEY` / `LANGFUSE_HOST` - LLM call tracing (optional)
- `NEXT_PUBLIC_POSTHOG_KEY` / `POSTHOG_HOST` - product analytics (optional)

Every optional integration degrades gracefully (no-ops) when its key is absent.

## Not wired up

These are real dependencies in root `package.json` with no import path reaching them from
`index.html` or `script.js` (the code that actually runs in the browser):

- Next.js, `next-safe-action` - no `app/`/`pages/` directory exists
- `@ai-sdk/google`, `ai` - not imported anywhere
- `@xenova/transformers`, `whisper-web-transcriber` - an in-browser Whisper module exists at
  `lib/speech-recognition.js`/`.ts` but isn't loaded; voice input uses the native Web Speech API
- `wavesurfer.js` - a waveform player exists at `lib/audio-player.js` but isn't used
- `ts-fsrs` - a spaced-repetition scheduler exists at `lib/spaced-repetition.js` but isn't used
- `franc`, `compromise`, `natural` - language utilities exist at `src/lib/language.ts` but
  aren't used
- `@trigger.dev/sdk` - `trigger.config.ts` points at `src/trigger`, which has no jobs defined
- `sharp` - unused
- `src/lib/wiktionary.ts` - standalone, unused

## Conventions

- Rate limiting is in-memory, per-IP, 50 requests/minute in the Express API.
- Translation history auto-saves the last 50 entries to `localStorage`; export as CSV.
- Keyboard shortcuts are part of the UX contract: Enter translate, Esc clear, Ctrl/Cmd+K swap
  languages, Ctrl/Cmd+H toggle history, Ctrl/Cmd+Z undo.
- PWA: `manifest.json` + `sw.js` service worker, installable.

## Claude Code

Project-level `.claude/` directory present, check its contents before assuming no
project-specific hooks or skills exist.
