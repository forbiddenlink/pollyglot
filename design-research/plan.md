# One direction: Words bring us closer

Phase 3 · October 9, 2026. Decisions made autonomously under the user's explicit instruction to continue without choosing options.

## Design system

An editorial language companion: warm paper, dark forest ink, precise ruled panels, a restrained coral detail and an expressive serif headline. References: Exemplar and Tengile for type; Tekt for warm restraint; Mintlify for readable UI; Terms for input-first composition; Paste for saved utility. The product itself occupies the prime position. No invented testimonials, claims, pricing or customer counts.

- Typography: existing Playfair Display for wordmark/headlines, existing DM Sans for readable controls and body. Desktop display 64–72px, mobile 40px; section 30–40px; UI 14–16px; input/output 22px. Web-font loading with swap; system fallbacks. No new paid font.
- Palette: paper #f7f6f0, surface #fffefa, forest #193c32, muted #59675e, line #d8ded3, sage #e8eee3, coral #bd432c. Semantic success green, error deep red; accessible text/focus contrast. Dark mode uses ink canvas and lighter text/accent.
- Spacing: 4/8/12/16/24/32/48/64/96px. Max content 1200px, editorial reading measure 66ch. All grids use minmax(0,1fr); no fixed minimum width that clips mobile.
- Layout: compact shared navigation; left-aligned editorial intro with small multilingual mark; equal source/result cards; action bar below inputs; clearly subordinate extras. Supporting pages share brand/nav/footer, asymmetric title/reading grids and an explicit return to translation.
- Imagery: existing parrot for identity; decorative multilingual type and simple CSS orbital lines. No stock imagery or added image dependency.
- Motion: 140–200ms feedback, short opacity/transform entrances only. Respect reduced motion and animation settings; no continuously moving hero. Preserve existing optional typing animation with reduced-motion support.
- Components: shared site CSS and small shared enhancement script; static semantic header/footer in each HTML page; consistent buttons, panels, forms, badges, cards and focus rings. Keep vanilla frontend; no framework migration or dependency additions.

## Ranked features

| Rank | Feature | Reason | Scope |
|---|---|---|---|
| 1 | Compact searchable language menus + reliable pair persistence | Makes typing immediately accessible; fixes observed startup/default problem | Existing selectors/20 options preserved and enhanced |
| 2 | Persistent translation state + retry + stale-result protection | Keeps failures understandable and prevents mismatched results | Existing API contract unchanged |
| 3 | Mobile layout and accessible controls/dialogs | Core workflow must work on a phone and keyboard | CSS, semantic states, focus management |
| 4 | Categorized practical phrase starters | Low-friction first translation, inspired by Bing/iTranslate | Local examples; original examples preserved |
| 5 | Recoverable local draft | Protects work across reloads | Browser storage with failure fallback |
| 6 | History/favorites search | Makes saved content reusable | Existing browser history, no schema migration |
| 7 | Local .txt import and translation download | Helps move real text in/out without a service | 5,000-character limit, explicit text-only validation |
| 8 | Offline indicator and shortcut reference | Sets expectations; makes existing tools discoverable | No promise of offline AI translation |
| 9 | Contact issue composer | Helps send useful reports | Opens existing mail app; no sending or new backend |
| 10 | Privacy contents links + About guide/FAQ | Faster information finding and return to the task | Preserve every existing paragraph/legal date |

Needs approval: provider-backed OCR/document translation; accounts/cloud sync; database/CMS; new API keys/paid services; route changes; legal policy substance; removing files/features/content. See `needs-approval.md`. No such work will be performed.

## Every page

- Home: compact nav, editorial introduction, recognizable two-column translator with compact language menus, tone/action bar, example categories, useful empty result, status/retry, local input/output tools, supporting feature/FAQ guidance. Preserve settings/history/practice/speech/share/favorite/fullscreen/shortcuts.
- About: shared shell, distinctive editorial intro, original explanation organized into numbered reading sections; how-to links and practical FAQ; original attribution retained.
- Contact: shared shell, clear support/feedback/security pathways using existing addresses; preserve existing hours; local issue composer with input/error/prepared-mail states. No message is sent by the site.
- Privacy: shared shell, original full text/date retained, contents links and improved reading rhythm. No substantive legal claim or retention promise added.

## Verification and rubric

Use Playwright-driven installed Chrome. Capture home desktop/mobile twice, score and fix between rounds. Then capture every supporting template at both widths and test interactions/states. Rubric order: point of view, typography, layout/rhythm, color/imagery, motion, audience fit, memorability, craft. Scores are internal design assessments, not external validation. Rework any score below 4.

Run existing Vitest suite, JS syntax checks and meaningful browser regression tests; record absent build/typecheck/lint scripts honestly rather than running an unrelated Next build. Run Lighthouse on key pages with installed tooling where available. AI output correctness, microphone recording, OS share/mail delivery and paid integrations require real providers/devices and must be reported separately from mocked UI tests. Stop after report and phase commits; do not merge or deploy.
