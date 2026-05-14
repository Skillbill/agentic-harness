# Changelog

All notable changes to `@skillbill/agentic-harness` are documented in this file.

The format is based on [Keep a Changelog 1.1.0](https://keepachangelog.com/en/1.1.0/), and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

In addition to the standard Keep a Changelog sections (`Added`, `Changed`, `Deprecated`, `Removed`, `Fixed`, `Security`), every release may include a **`Migration`** section describing the compatibility steps a consumer project must apply when upgrading AH to that version. When a migration is automatable, AH applies it at the next `session_start` via the consumer migration framework (see R-0003 in `REQUIREMENTS.md`); the `Migration` bullet below serves as human-readable documentation.

## [Unreleased]

## [0.7.0] — 2026-05-14

### Breaking
- AH is now **English-only**: prompts, skills, top-level docs, console logs, and migration `description` strings are all authored in English. Italian-speaking consumers that want their generated content to stay in Italian must commit `.pi/ah-config.json` with `{"configVersion":"1","contentLanguage":"it"}`. The default `contentLanguage` when the config file is absent is `"en"` — this replaces the implicit Italian default that existed up to v0.6.0.
- **(R-0005)** The 5 Italian-named docs under `.pi/codebase/` are renamed to English: `INTEGRAZIONI.md → INTEGRATIONS.md`, `ARCHITETTURA.md → ARCHITECTURE.md`, `STRUTTURA.md → STRUCTURE.md`, `CONVENZIONI.md → CONVENTIONS.md`, `CRITICITA.md → TECHNICAL_DEBT.md`. `STACK.md` and `TESTING.md` are unchanged. The rename is auto-applied by the consumer migration framework on the first `session_start` after upgrade — no dev action required.

### Added
- **(R-0004)** AH ↔ PI compatibility check at `session_start` (`lib/check-pi-compat.ts`): compares AH's `peerDependencies["@earendil-works/pi-coding-agent"]` against the `VERSION` exported by the PI runtime. On mismatch, warns the user through a simultaneous triple notification — `console.warn` + `ctx.ui.notify('warning')` (toast in PI's TUI footer) + `pi.sendMessage({ display: true })` (persistent message in the scrollback). Non-blocking: AH keeps registering commands/tools/hooks. Minimal in-house semver matcher (supports `X.Y.Z`, `^X.Y.Z`, `~X.Y.Z`, `>=X.Y.Z`); unrecognized ranges return `null` and the check is skipped with a single diagnostic `console.warn`.
- **(R-0005)** `.pi/ah-config.json` schema with `configVersion: "1"` and `contentLanguage` (free-form locale code, default `"en"`). Read at `session_start` by `lib/ah-config.ts`. The reader never throws: any failure path downgrades to a single `console.warn` and falls back to defaults. The resolved language is logged once at `session_start` as `🌐 Content language: <Display name> (<code>)`.
- Languages are surfaced to prompts as `$CONTENT_LANG` (display name, e.g. `"English"`) and `$CONTENT_LANG_CODE` (raw code, e.g. `"en"`), substituted by `lib/register-prompt.ts` in every prompt body. All shipped prompts and skills now carry an `**Output language**: ... MUST be written in **$CONTENT_LANG**` directive so generated content honors the consumer's choice. Unknown locale codes pass through to prompts unchanged, so future languages work without an AH code change.
- **(R-0003)** First real consumer migration ships in `lib/migrations/v0_7_0.ts` — idempotent rename of the 5 Italian-named codebase docs to English, plus rewrite of references in `.pi/codebase/INDEX.md` and keys in `.pi/codebase/.cache.json`. No git mutations.
- `WORKFLOW.md`: FAQ on `.pi/git/` — clarifies that PI v0.74.0 already drops a self-managed `.gitignore` in that directory and the consumer only needs to track it (no entry in the root `.gitignore`).
- `WORKFLOW.md`: FAQ on when the `Package Updates Available` banner triggers — PI tracks the upstream commit ref, not `package.json#version`, so on unpinned installs every commit on AH's `main` causes the banner. Three paths documented (`pi update`, pin to a tag, ignore) and the implication for the consumer migration framework (migrations fire on the semver version, not the ref).
- New `Consumer migration` section in `CLAUDE.md` and requirements **R-0004**, **R-0005** in `REQUIREMENTS.md`.

### Changed
- All AH prompts (`prompts/*.md`), skills (`skills/*/INSTRUCTIONS.md`), templates (`templates/*.md`), top-level docs (`WORKFLOW.md`, `REQUIREMENTS.md`, `task-layout.md`, `CLAUDE.md`, `CHANGELOG.md`), and console logs translated to English.
- `session_start` hook in `extensions/index.ts` invokes `migrateConsumer(pi, cwd)` before the startup log, and emits the `🌐 Content language: …` line right after reading `.pi/ah-config.json`.

### Migration
- No dev action required for the rename: on the first `session_start` after upgrading, the consumer migration runner renames the 5 Italian-named `.pi/codebase/*.md` docs in place (idempotent rename, no `git` calls) and rewrites the corresponding entries in `INDEX.md` and `.cache.json`. If you want AH-generated content to remain in Italian, drop `.pi/ah-config.json` at the consumer root with the body `{ "configVersion": "1", "contentLanguage": "it" }`.
- The R-0004 PI-compat check is purely diagnostic and activates only if the running PI version does not satisfy the range declared in `peerDependencies`; otherwise it is silent.

## [0.6.0] — 2026-05-14

### Changed
- Test release to verify the interaction with PI v0.74.0's native `Package Updates Available` banner in a chain of consecutive releases (no code changes).

### Migration
- No action required.

## [0.5.0] — 2026-05-14

### Removed
- Custom OTA: removed `lib/ota-update.ts`, `lib/install-info.ts`, `lib/version.ts` (~280 lines). AH delegates entirely to PI v0.74.0's native banner (`Package Updates Available`) and the manual `pi update` command. Decision documented in R-0002 (declined) of `REQUIREMENTS.md`.

### Changed
- Rewrote the OTA-related sections of `CLAUDE.md` and `REQUIREMENTS.md` to reflect the new flow based on the native banner (PR #4).

### Migration
- No automatic mutation of the consumer filesystem.
- If you had previously pinned AH to `v0.4.0` or lower, be aware that `pi update` skips pinned packages: to upgrade, re-run `pi install git:github.com/Skillbill/agentic-harness@v0.5.0` (or a later ref).

## [0.4.0] — 2026-05-14

### Changed
- End-to-end test release of the custom OTA flow (no code changes).

### Migration
- No action required.

## [0.3.0] — 2026-05-14

### Fixed
- (PR #3) Removed the unsupported `-l` flag from the `pi update` invocation in the custom OTA module: PI does not expose that option.

### Migration
- No action required.

## [0.2.0] — 2026-05-14

### Added
- (PR #2) Scope detection (project-local vs global) and pinning detection in the OTA flow, reading PI settings to decide whether to propose the update.

### Migration
- No action required.

## [0.1.0] — 2026-05-14

### Added
- (PR #1) Distribution of AH as a **Pi Package** installable via `pi install git:github.com/Skillbill/agentic-harness[@<ref>]` (R-0001).
- `pi` manifest in `package.json` with entry `extensions/index.ts`, convention dirs `prompts/` and `skills/`, TS helpers isolated in `lib/`.
- Complete custom OTA: GitHub Releases check at startup, accept modal, automatic `ctx.reload()` after `pi update` (R-0002, later removed in v0.5.0).
- Peer dependencies on `@earendil-works/pi-coding-agent` and `typebox` (both provided by PI).

### Migration
- No action required — first public release.

[Unreleased]: https://github.com/Skillbill/agentic-harness/compare/v0.7.0...HEAD
[0.7.0]: https://github.com/Skillbill/agentic-harness/compare/v0.6.0...v0.7.0
[0.6.0]: https://github.com/Skillbill/agentic-harness/compare/v0.5.0...v0.6.0
[0.5.0]: https://github.com/Skillbill/agentic-harness/compare/v0.4.0...v0.5.0
[0.4.0]: https://github.com/Skillbill/agentic-harness/compare/v0.3.0...v0.4.0
[0.3.0]: https://github.com/Skillbill/agentic-harness/compare/v0.2.0...v0.3.0
[0.2.0]: https://github.com/Skillbill/agentic-harness/compare/v0.1.0...v0.2.0
[0.1.0]: https://github.com/Skillbill/agentic-harness/releases/tag/v0.1.0
