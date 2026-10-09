# Upgrade progress

Branch: `design/upgrade`. Started from `b999453`, 18 commits behind origin/main. Do not merge or deploy. Preserve pre-existing untracked `.env.example` and `CLAUDE.md`.

| Phase | Status | Evidence / next step |
|---|---|---|
| 1 Understand | done | `profile.md`, eight Playwright Chrome baseline screenshots, `before-captures.json` |
| 2 Research | done | `references.md`: 13 live references; `features.md`: nine usable peers; real Chrome screenshots and blocked candidates documented. |
| 3 Decide | pending | Write one direction and ranked feature/page plan after research. |
| 4 Foundation + home | pending | Shared styles/components; two screenshot/score/fix rounds. |
| 5 Every page | pending | About / Contact / Privacy desktop + mobile + states. |
| 6 Verify | pending | Appropriate scripts, browser journeys, Lighthouse. |
| 7 Report | pending | Honest before/after, scores, limitations, approval list. |

## Runtime and tooling

Node verified `v22.23.1` via mise's global pin; packageManager pnpm 10.18.0. Installed Playwright module is under mise's global `@playwright/mcp/node_modules/playwright`; use installed Chrome channel because bundled revision is unavailable. `capture.cjs` records real-browser evidence without reading env/secrets. Browser and loopback server require sandbox escalation. Python static preview currently at http://127.0.0.1:4173; supporting baseline pages loaded as `.html`.

## Findings

Mobile overflow and overlapping examples confirmed in screenshots. Supporting pages do not load declared web fonts. Existing service worker caches app shell first; version/cache additions will need to accompany new assets. Real API/microphone/mail delivery remain untested and must not be represented as tested by mock UI checks.
