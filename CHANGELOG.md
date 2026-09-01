# Changelog

## [1.1.0](https://github.com/forbiddenlink/pollyglot/compare/v1.0.1...v1.1.0) (2026-09-01)


### Features

* Magica server TTS with browser-voice fallback ([6ce9c02](https://github.com/forbiddenlink/pollyglot/commit/6ce9c02361c05fa5abda382591007558aa984d2a))


### Bug Fixes

* **build:** resync lockfile with the pnpm overrides block ([6c349e5](https://github.com/forbiddenlink/pollyglot/commit/6c349e5a6dfd1f6d51c2fb7a4f380f874ba57802))

## [1.0.1](https://github.com/forbiddenlink/pollyglot/compare/v1.0.0...v1.0.1) (2026-08-29)


### Bug Fixes

* **deps:** move resolution overrides to package.json and add missing patches ([#46](https://github.com/forbiddenlink/pollyglot/issues/46)) ([531f3ff](https://github.com/forbiddenlink/pollyglot/commit/531f3fffe347758b032f8353a36b2ba288ef1841))

## 1.0.0 (2026-08-16)


### Features

* fluency-journey visual layer ([fa36450](https://github.com/forbiddenlink/pollyglot/commit/fa3645050e907ec06b19dbbfd2db6a8a29f402fb))
* re-apply fluency-journey visual layer with overflow hardening ([44b2982](https://github.com/forbiddenlink/pollyglot/commit/44b2982431dda89c6bcfd2ba2fcf235c6c3ce8c0))


### Bug Fixes

* add required maxDuration to TriggerConfig ([23f3ef5](https://github.com/forbiddenlink/pollyglot/commit/23f3ef55df3ab16c525871ee3dbd8a6690a35a7e))
* cap cookie override below v2 to prevent @supabase/ssr build break ([a7da7b3](https://github.com/forbiddenlink/pollyglot/commit/a7da7b3eb96cb9083d42098675fb60096b4d816b))
* clamp .container overflow-x to stop history-sidebar bleed ([2cd4ddc](https://github.com/forbiddenlink/pollyglot/commit/2cd4ddcd617351fd24f1997970ed4c10e1eeff72))
* harden fluency-journey overflow edges ([0f33265](https://github.com/forbiddenlink/pollyglot/commit/0f33265db66afdfe2496ba2733d6aa8fe47b687b))
* migrate pnpm overrides to pnpm-workspace.yaml ([19d03e0](https://github.com/forbiddenlink/pollyglot/commit/19d03e041f54991c6dde676739c34c2f8bfe9e4e))
* Move API to /api folder, remove vercel.json, let Vercel handle routing ([0e1f299](https://github.com/forbiddenlink/pollyglot/commit/0e1f2993c5a92aa0f458746cf941968e6538395a))
* patch 4 security vulnerabilities ([4670443](https://github.com/forbiddenlink/pollyglot/commit/4670443fc5280faa75b2cbadf2161c79b063ab1c))
* remove /api prefix from alternatives route ([36d3474](https://github.com/forbiddenlink/pollyglot/commit/36d34744bf66d1ee6d3e190fa55948638b04a6a7))
* sec sweep v3 tier 2 - pin next/protobufjs/uuid ([#8](https://github.com/forbiddenlink/pollyglot/issues/8)) ([12bba5f](https://github.com/forbiddenlink/pollyglot/commit/12bba5fa7ec068198a8175690ac0e2794cbfb1e6))
* **security:** pin transitive deps to patched versions (Dependabot high alerts) ([8e09eb2](https://github.com/forbiddenlink/pollyglot/commit/8e09eb26df21b1c8599b360da4f62068d737b007))
* Use rewrites for root path ([ceacc62](https://github.com/forbiddenlink/pollyglot/commit/ceacc62abdbff8f6a9ab00631753d34a2f7d2da1))
