# Integration and PR review — October 9, 2026

Integrated origin/main at `7d35974` into design/upgrade under the user's authorization. All 23 upstream commits retained, including dependency/security updates, pnpm 10.34.5, CI updates and upstream documentation/history/sample-test cleanup. No conflicts; no upgraded app files overwritten. Main and production remain unchanged.

Local untracked CLAUDE.md was byte-identical to upstream's newly tracked file. Preserved copies at `/private/tmp/pollyglot-integration-20261009/CLAUDE.md` and `CLAUDE.original.md`, then accepted upstream's tracked version. Local `.env.example` remains untracked and excluded from commits.

## Verification before push

- Node v22.23.1 and pinned pnpm 10.34.5 verified.
- Frozen lockfile installation passed with package lifecycle scripts disabled; no lockfile regeneration.
- All declared dependency overrides verified in force.
- 59 browser regressions and 14 functionality checks passed after integration; 11 axe states clean.
- HTML existence CI check, JS syntax checks (frontend and API) and whitespace checks passed.
- `pnpm test:run`: exits 1 with **No test files found**, as upstream intentionally removed the sample tests. No Vitest pass is claimed for this integrated tree. Existing browser suites provide application coverage; current GitHub CI only checks HTML existence, with separate security scanning.
- Build/typecheck/lint scripts remain unconfigured for the static frontend.

## PR and final review

PR: https://github.com/forbiddenlink/pollyglot/pull/75. User subsequently authorized fixing and merging ready work.

- GitHub CI, CodeQL and both Socket checks passed on d5b312f. Dependabot-only jobs correctly skipped.
- Automatic Vercel previews are deliberately ignored by an existing project command. The API preview retry was rejected by automatic approval review for ambiguous targeting. An explicit CLI `--target preview` deployment succeeded; shared project and production settings were not changed. A temporary local config overrides only the preview ignore command.
- Preview: https://pollyglot-bep3q6pgt-elizabeth-emersons-projects.vercel.app (READY, target null = Preview). Authenticated GETs through `vercel curl` feed real Chrome rendering; API calls are mocked or blocked.
- Preview verification: 59 general browser checks + 15 functionality checks passed; 11 axe states clean, plus pending/Cancel accessibility. Every template loaded at desktop and mobile sizes. Evidence: `preview/`.
- Found and reproduced a clear/undo bug before merge: Clear invalidated the result before saving its undo state. Save the undo state first so Copy and Save work after undo. New regression fails before the fix and passes afterward; all 15 functionality checks pass locally too.
- Corrected `.vercelignore` because it replaces Git ignore rules: environment files, local tooling, history and logs are now excluded alongside research. Dry-run retains all required app/API files. Preview confirms research/environment/local-tooling paths return 404.
- Manual review covered the app JS diff and shared enhancements; no API/backend changes relative to origin/main. No remaining merge-blocking issue identified in that review. Global commit hooks reported inherited CI workflow warnings, unchanged relative to main; these are separate hardening work, not new PR changes.
- No live paid-provider requests performed. Translation quality, provider TTS, microphone and OS sharing/email remain untested; these are existing integrations whose server code is unchanged.

Final GitHub checks are rerun after pushing the review fixes; merge proceeds only after they pass. GitHub PR state records the final merge result.

Final CI follow-up: CodeQL identified prefix-based URL validation in the non-deployed preview test helper. Replaced it with parsed URL origin equality; reran the 59 preview browser checks. The production application is unaffected. Fresh remote security analysis is required before merge.
