# Upgrade progress

Branch: `design/upgrade`. Started from `b999453`, 18 commits behind origin/main. Do not merge or deploy. Preserve pre-existing untracked `.env.example` and `CLAUDE.md`.

| Phase | Status | Evidence / next step |
|---|---|---|
| 1 Understand | done | `profile.md`, eight Playwright Chrome baseline screenshots, `before-captures.json` |
| 2 Research | done | `references.md`: 13 live references; `features.md`: nine usable peers; real Chrome screenshots and blocked candidates documented. |
| 3 Decide | done | `plan.md` selects editorial paper/forest direction, ten ranked local improvements and every-page rollout. |
| 4 Foundation + home | done | Shared system, rebuilt home and local features; two screenshot/score/fix rounds plus final home capture; 25 browser checks passed. `scores.md`, `browser-results.json`. |
| 5 Every page | done | About, Contact, Privacy: desktop/mobile reviewed; FAQ, contact empty/invalid/prepared/edited states and policy anchors checked. 54 browser checks passed. |
| 6 Verify | done | 59 Chrome checks; 11 axe states clean; four offline app-shell pages; Vitest 2/2; JS syntax/diff checks. Lighthouse performance 96/100/100/100, accessibility 100 throughout. See `verification.md`. |
| 7 Report | done | `report.md` includes every before/after template, rubric, features, verification limits and full approval list. Stop; do not merge/deploy. |

## Runtime and tooling

Node verified `v22.23.1` via mise's global pin; packageManager pnpm 10.18.0. Installed Playwright module is under mise's global `@playwright/mcp/node_modules/playwright`; use installed Chrome channel because bundled revision is unavailable. `capture.cjs` records real-browser evidence without reading env/secrets. Browser and loopback server require sandbox escalation. Current routed static preview: `python3 design-research/preview.py` at http://127.0.0.1:48731. It implements only the existing HTML rewrites and returns a no-key API error; Playwright tests intercept API requests for simulated states. Earlier baseline server was port 4173 and `.html` pages. Port 4174 was occupied; no unrelated service was touched.

## Findings

Mobile overflow and overlapping examples confirmed in screenshots. Supporting pages do not load declared web fonts. Existing service worker caches app shell first; version/cache additions will need to accompany new assets. Real API/microphone/mail delivery remain untested and must not be represented as tested by mock UI checks.

## Functionality continuation — October 9

User authorized continuing with features/functionality on the existing branch. Scope: result validity, late async responses, typing cancellation, programmatic draft/pair persistence and request cancellation/timeout; no service or API contract changes. Done: initial six Chrome regressions reproduced, followed by error/clear, swap/undo and saved-entry restoration cases. Final 14 functionality tests + 59 existing browser checks + 2 Vitest tests pass; automated accessibility checks pass, including new pending/Cancel state. See `functionality.md` and `functionality-after.json`. Commit this continuation; no merge/deploy.

## Upstream integration / PR review

User authorized integration, pushing a PR and reviewing its preview; main merge/deployment remain deferred. Integrated origin/main `7d35974` without conflicts. 73 browser checks / 11 axe states / frozen-lockfile install / dependency-override check passed. Vitest has no files after upstream's intentional sample-test removal. See `integration.md`. PR/preview checks in progress.
