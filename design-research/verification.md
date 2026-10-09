# Verification — October 9, 2026

Node v22.23.1 (mise), pnpm 10.18.0. Local routed preview only; no deployment, environment-file reads or paid API calls.

## Results

- Vitest: 1 file, 2 tests passed. These are the repository's small existing sample tests; they are not meaningful translation-provider coverage.
- Browser: **59 checks passed**, zero unhandled page errors. `verify.cjs` and `browser-results.json` record the journeys. Translation/detection/alternatives responses are explicitly simulated. Tests cover retry, loading, success, stale-response rejection, language persistence/search, draft recovery, local import limits, text/CSV downloads, clipboard, keyboard alternatives, swap/undo, history/favorites search, modal focus/Escape, phrase starters, offline notice, dark theme, route navigation, About FAQ, contact validation/prepared/edit-reset states and privacy anchors/date. Overflow checks: 320/390/768/1440px home; 390/1440px every supporting template.
- axe in installed Chrome: **11 states, zero WCAG 2 A/AA and 2.1 AA violations**. Home light/dark, open language menu, settings, empty history, all supporting pages light/dark. See `accessibility-results.json`. Initial selected-label and toast contrast failures were fixed; transition-time false positives were resolved by waiting for the actual settled state. This is not a complete manual accessibility audit.
- PWA: with real service workers enabled, the v3 cache includes the shared assets and all four public pages load offline with their shared header. `pwa-results.json`. Offline translation is not provided or claimed.
- Content preservation: all 15 original paragraphs across About, Contact and Privacy remain, with no missing paragraphs (`content-preservation.json`); policy date and original addresses/hours retained.
- `node --check` passed for script.js, site.js and sw.js; `git diff --check` passed.
- Build, typecheck and lint: **not applicable/configured**. No corresponding scripts, frontend build pipeline or tsconfig exists. The app serves static HTML/CSS/JS. The unused Next analyze/postbuild commands do not build this app and were not run. No dependencies were added.

## Lighthouse 12.6.1 — mobile simulated throttling

| Page | Performance | Accessibility | Best practices | SEO | LCP | CLS |
|---|---:|---:|---:|---:|---:|---:|
| Home | 96 | 100 | 100 | 92 | 2.6s | .0010 |
| About | 100 | 100 | 100 | 92 | 1.5s | .0006 |
| Contact | 100 | 100 | 100 | 92 | 1.5s | .0006 |
| Privacy | 100 | 100 | 100 | 92 | 1.5s | .0009 |

Full JSON reports and `lighthouse-summary.json` retained. The initial redesigned-home audit scored 85 performance/96 accessibility/CLS .083. Reserving language-picker space and fixing labels/contrast raised it to 96/100/CLS .001. This compares two iterations of the redesign, not the original site. Local uncompressed preview and external font timing differ from production; no production performance claim is made.

SEO 92: existing relative canonical URLs are not accepted as valid canonicals. Choosing the authoritative production domain is deferred in needs-approval.md rather than guessing.

## Untested / deferred

Actual OpenAI translation accuracy, live detection/alternatives/pronunciation/TTS fallback providers, rate limiting and email delivery were not exercised. Real microphone permissions/recording, pronunciation scoring, OS sharing/email handlers, fullscreen behavior across platforms, mobile PWA installation, browser/device compatibility beyond installed desktop Chrome and manual screen-reader use remain untested. The contact flow prepares a mailto link; it does not send. Service-worker upgrade from an already-installed production v2 cache was not tested. Upstream's 18 newer commits have not been integrated.
