# Functionality continuation — October 9, 2026

Implemented on `design/upgrade` following the user's request to continue with features and functionality. No production changes, paid requests, new API contracts, services, dependencies, routes or database changes.

## What changed

- **Cancel translation** in the main action row. Cancellation aborts the browser request, keeps the source text and allows another attempt. A 45-second client timeout releases controls and offers Retry. Cancellation does not guarantee that a provider has stopped work already started on the server.
- **Result validity** follows source text, source/target language and tone. A previous result remains visible with an outdated-result notice; copy/listen/save/favorite/share/practice/download actions are disabled until the result matches the workspace. Partially animated output cannot be saved as a complete result.
- **Async response protection** extends to alternatives, pronunciation and detection. Changed workspace versions reject late results; delayed auto-speech checks the original result and destination. Old guides are hidden when a new request starts or a saved result is restored.
- **Clear and typing** now stop pending typing callbacks. Clear also aborts a pending translation so the translator does not remain locked.
- **Draft and pair persistence** follows programmatic changes, including swap, undo, examples, voice-input text and saved-entry reuse through the shared workspace event. Swap preserves unfinished source text when there is no current result; undo preserves whether the previous result was valid.
- **History/favorite restoration** restores automatic source-language state and avoids triggering extra translation requests merely to reuse an existing result. Existing user-triggered auto-translate behavior remains.
- **Replacement request errors** retain persistent error feedback and Retry even when an older result is still visible.

The original alternative, detection, typing, swap and restoration paths shared mutable workspace state without tying responses/actions to a completed result. Reproductions and request-version/result-context guards address those causes rather than adding delays.

## Evidence

All checks use installed Chrome through Playwright against the isolated static preview. Provider responses are intercepted; no live paid requests or actual microphone recordings occurred.

- **14 functionality tests passed**, `functionality-checks.cjs` and `functionality-after.json`.
- Initial six problems reproduced in `functionality-before.json`; additional error/clear, swap/undo, and restoration failures are retained in the intermediate/before JSON files.
- **59 existing browser checks passed**, `browser-results.json`.
- **2/2 repository tests passed**, Node v22.23.1 and pnpm 10.18.0.
- JS syntax and whitespace checks passed.
- Existing 11 automated accessibility states passed. The new pending/cancel mobile state also has zero axe WCAG A/AA violations, asserted in the cancellation regression.
- Real-browser screenshots: [pending desktop](screenshots/functionality/pending-desktop.png), [pending mobile](screenshots/functionality/pending-mobile.png), [outdated result](screenshots/functionality/outdated-result-desktop.png). Reviewed directly after capture.

The fourteen cases cover outdated-result actions, late alternatives, late detection, clearing typing, draft/pair reloads and undo, cancel/retry, replacement-error retry, clear during requests, timeout recovery, swap before translation, stale undo, avoiding extra requests on history reuse, restoring automatic sources and Spanish-browser startup. Spanish startup was investigated and already passed; no unnecessary change was made for it.

## Remaining priorities

1. Provider-contract tests for backend translation/detection/TTS using isolated simulated provider responses, then an explicitly approved small live-provider QA pass. Actual accuracy, voice quality and fallback behavior remain untested.
2. Device/browser checks for microphone permissions, speech playback, pronunciation practice, native sharing and PWA upgrades. Desktop Chrome automation cannot establish those experiences across platforms.
3. Reconcile the 18 newer upstream commits in an approved integration step before deployment, and confirm the canonical production domain.
4. Further local storage resilience and user-data validation merit a dedicated pass; the older history/settings loaders still use browser storage independently. This batch does not claim storage-blocked/corrupted-data coverage.

Provider-backed OCR, accounts/cloud sync, new keys/services, route changes and legal-policy substance stay in `needs-approval.md`. The original seven-phase Lighthouse scores are retained as that phase's measurements; Lighthouse was not rerun for this functionality-only continuation.
