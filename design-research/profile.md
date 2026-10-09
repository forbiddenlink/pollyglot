# PollyGlot site profile

Phase 1 · inspected October 9, 2026 · baseline commit `b999453` · branch `design/upgrade`.

## Purpose and audience

PollyGlot is Elizabeth Stein's AI-assisted translator for everyday text across 20 languages, with tone, speech, pronunciation and locally saved translations.

Audience inferred from existing examples: travelers, language learners and people communicating across languages. Main action: enter text, select a destination language and translate; then listen, copy or save the result. No audience analytics were consulted.

## Repository and routes

| Template | Public route | Source | Baseline screenshots |
|---|---|---|---|
| Translator workspace | `/`, `/index.html` | `index.html`, `script.js`, `index.css` | [Desktop](screenshots/before/home-desktop.png), [mobile](screenshots/before/home-mobile.png) |
| About | `/about`, `/about.html` | `about.html` | [Desktop](screenshots/before/about-desktop.png), [mobile](screenshots/before/about-mobile.png) |
| Contact | `/contact`, `/contact.html` | `contact.html` | [Desktop](screenshots/before/contact-desktop.png), [mobile](screenshots/before/contact-mobile.png) |
| Privacy | `/privacy-policy`, `/privacy-policy.html` | `privacy-policy.html` | [Desktop](screenshots/before/privacy-policy-desktop.png), [mobile](screenshots/before/privacy-policy-mobile.png) |

`vercel.json` supplies extensionless rewrites. Local baseline captures use the underlying HTML files because Python's basic static server has no Vercel rewrites. All eight captures are from installed Chrome driven by Playwright at 1440×1000 and 390×844. See `before-captures.json` for response codes, titles, URLs and visible text. Service workers were blocked to avoid stale captures.

Root uses pnpm 10.18.0 for Vitest and library dependencies; `api/` has a separate npm tree and Express function. There is no frontend build step, lint script, typecheck script or tsconfig. Root Next.js dependencies do not imply a Next app. `api/index.js` exposes translation, detection, alternatives, pronunciation, TTS and health endpoints; frontend prefixes requests with `/api`. No CMS or database is present. Most `src/` and `lib/` browser modules are not loaded by `index.html`. `.claude/` contains local permissions and a TypeScript cache, no additional project skills. Pre-existing untracked `.env.example` and `CLAUDE.md` are excluded from our commits. Starting checkout was 18 commits behind origin/main; no pull, merge or production access performed.

## Existing design and content types

Homepage CSS has tropical palette tokens: jungle #1a3a2f, orange #e85d3b, cream #faf7f2, paper #fffef9, ink #1a1a18; semantic colors, shadows and dark mode overrides. Playfair Display headings and DM Sans UI load from Google Fonts on home. Supporting pages declare these fonts but do not load them, falling back to Georgia/system sans. Each supporting page duplicates inline styling. Homepage has a large wordmark, animated glyph ribbon, source/target panels, flag tiles, central action column and footer. No shared component system or server-rendered templates.

Content types: static editorial/legal prose; 20 language options; example phrases; translation output, pronunciation and alternatives; browser-local history/favorites/preferences; ephemeral loading/toast states. Assets include parrot PNGs and flag images. No editorial imagery, testimonials, pricing plans or customer metrics are established.

## Feature and journey inventory

- Translate up to 5,000 characters; neutral/formal/casual tone; auto detection; remembered language pair; searchable language grids; swap and undo.
- Example text; word/character/read-time counters; voice input using native Web Speech API.
- Copy, share, save, favorite, listen; server TTS fallback pipeline plus browser speech; voice and speed controls.
- Short-text alternatives; non-Latin pronunciation guide; pronunciation practice with recording/transcription and a lazily loaded Whisper model.
- History and favorites sidebar; reuse/delete/clear entries; CSV export; history limit settings and automatic save.
- Theme, system theme, animation, automatic translation/speech/detection settings; fullscreen; keyboard shortcuts.
- PWA manifest and cache-first service worker; manifest share target exists but query input is not consumed by the running script.
- About → translator; Contact → existing support/feedback/security mail links; Privacy → privacy email. Mail delivery and mailbox ownership are unverified.

## Observed shortcomings

Homepage desktop devotes ~800 pixels to branding/language choices before input. Empty examples overlap the textarea placeholder. At 390px, content overflows and clips source/target controls. Selected destination appears English on the initial screenshot despite a Spanish default, requiring behavioral investigation. Supporting pages are plain single cards with different typography and navigation. Translation errors use temporary toasts; no persistent retry state. Search, navigation and accessibility need systematic verification in later phases.

## Unknowns and boundaries

No production URL, credentials, audience analytics, uptime/accuracy guarantees or verified contact operations supplied. Existing business hours and email addresses remain content, not independently verified claims. Preserve privacy policy wording and date; substantive legal revisions require approval. No real translation API calls or paid requests made in phase 1. Offline shell caching does not provide offline AI translation. Do not add accounts, billing, database persistence, camera/OCR providers or paid services without approval.
