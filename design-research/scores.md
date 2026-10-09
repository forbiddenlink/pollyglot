# Screenshot review and scores

Scale 1–5; internal assessment, not an independent award or user study. Order: point of view / typography / layout and rhythm / color and imagery / motion / audience fit / memorability / craft.

## Home

| Review | Scores | Evidence and action |
|---|---|---|
| Round 1 | 4 / 4 / 2 / 4 / 4 / 4 / 4 / 2 | `screenshots/home-round1/home-{desktop,mobile}.png`: inherited body flex layout placed the shared nav beside the page, constraining mobile. Fixed body layout, then captured round 2. |
| Round 2 | 4 / 3 / 3 / 4 / 4 / 4 / 4 / 3 | `screenshots/home-round2/home-{desktop,mobile}.png`: inline headline put the badge beside it; closed sidebar expanded screenshot bounds; inherited blur established a fixed-position containing block. Fixed headline flow, removed blur/entrance transform, hid closed sidebar, restored mobile heading/tool order. |
| Final home review | 4 / 4 / 4 / 4 / 4 / 4 / 4 / 4 | `screenshots/after/home-{desktop,mobile}.png`: clean 1440px/390px captures, source accessible without scrolling through 20 language tiles. 25 Playwright checks in `browser-results.json`, including 320/390/768/1440px overflow, persisted pair/draft, error/retry, simulated loading/success, local files, search and keyboard dialogs. Reduced motion tested. |

Motion is intentionally restrained for a utility; a high score means appropriate and accessible, not elaborate animation. Real translation accuracy, voice capture and delivery are excluded from craft verification until real-provider/device testing.
