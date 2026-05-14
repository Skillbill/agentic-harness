# Changelog

All notable changes to `@skillbill/agentic-harness` are documented in this file.

The format is based on [Keep a Changelog 1.1.0](https://keepachangelog.com/en/1.1.0/), and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

In addition to the standard Keep a Changelog sections (`Added`, `Changed`, `Deprecated`, `Removed`, `Fixed`, `Security`), every release may include a **`Migration`** section describing the compatibility steps a consumer project must apply when upgrading AH to that version. When a migration is automatable, AH applies it at the next `session_start` via the consumer migration framework (see R-0003 in `REQUIREMENTS.md`); the `Migration` bullet below serves as human-readable documentation.

## [Unreleased]

## [0.9.0] — 2026-05-14

### Added
- **(R-0006)** Consumer-side `.pi/REQUIREMENTS.md` — a single AH-managed document listing the project's requirements as enumerated `R-NNNN` entries (title + 1–3 sentence body + rationale + auto-maintained `**Linked tasks**` line). Read as input by the inner-cycle phases that need the project's intent layer; never harvested at task-done.
- **(R-0006)** `templates/REQUIREMENTS.md` skeleton consumed by the new v0.9.0 consumer migration (`lib/migrations/v0_9_0.ts`). The migration drops an empty `.pi/REQUIREMENTS.md` on the first `session_start` after upgrade, idempotent and non-destructive (no-op if the file already exists). Single advisory line emitted on creation, same shape as the v0.8.1 `📝 Created .pi/ah-config.json` log.
- **(R-0006)** Optional `implements: [R-NNNN, ...]` frontmatter key on `TASK.md` linking a task to one or more requirements. Empty list `[]` is legal and meaningful ("no declared requirement link"). Documented in `task-layout.md` §3.1.
- **(R-0006)** `/ah:task-new` step 2-bis: presents the existing R-NNNN list (or "no entries yet" prompt on a fresh project), accepts an id / `new` (inline mini-interview that assigns the next R-NNNN and pre-seeds the `**Linked tasks**` line) / `skip`. Output language for new R-NNNN bodies honors `$CONTENT_LANG`.
- **(R-0006)** `/ah:task-discuss` step 3-bis (load REQUIREMENTS as constraint context, with `implements:` R-NNNN front and center) and step 7.5 (post-discussion `new` / `amend` / `no change` one-shot prompt). Amendments append a one-line audit entry to `## Historicized decisions`.
- **(R-0006)** `/ah:task-plan` §3-bis: reads REQUIREMENTS.md read-only and quotes the relevant R-NNNN at the top of the `## Strategy` section so step files can reference them. **Not** added to `context-needed:` — that key remains scoped to `.pi/codebase/*.md` thematic docs.
- **(R-0006)** `/ah:task-verify` Requirements DoD subsection: one advisory line per R-NNNN declared in `implements:` ("still satisfied after this task?"). Omitted when the list is empty or REQUIREMENTS.md is absent. Reset on each run (decision V-4 parity); collected together with the other manual checks in step 5.
- New `Project requirements (.pi/REQUIREMENTS.md) — input layer` section in `WORKFLOW.md` documenting the per-phase read/write matrix.
- Requirement **R-0006** in `REQUIREMENTS.md`.

### Changed
- `/ah:task-new` Git Safety exception widened: the auto-commit may now include `.pi/REQUIREMENTS.md` **only if** step 2-bis touched it (new R-NNNN created or `**Linked tasks**` line appended). When the dev chooses `skip`, REQUIREMENTS.md must not appear in the commit. The commit message format is unchanged (`chore(<ID>): add task to backlog — <TITLE>`).
- `/ah:task-discuss` Git Safety exception widened symmetrically: the post-discuss commit may include `.pi/REQUIREMENTS.md` **only if** step 7.5 produced a new/amended R-NNNN. Commit message unchanged (`chore(<ID>): update DISCUSS`).
- `templates/task.md` gains `implements: {{IMPLEMENTS}}` in the frontmatter (substituted by `/ah:task-new` to `[R-NNNN]` or `[]`).
- `CLAUDE.md` "Authoritative contracts" list updated to mention the new REQUIREMENTS contract.

### Migration
- No dev action required. On the first `session_start` after upgrading to v0.9.0, AH writes an empty `.pi/REQUIREMENTS.md` skeleton if absent (idempotent — does not clobber a dev-authored file). R-NNNN entries then grow organically through `/ah:task-new` and `/ah:task-discuss`. Consumers may also commit the skeleton's `project:` field by hand (it ships as `<TBD>`).
- `/ah:task-execute` is deliberately unchanged: execute does not read REQUIREMENTS.md (steps are already planned, no decisional surface).

## [0.8.1] — 2026-05-14

### Added
- **(R-0005)** Auto-creation of `.pi/ah-config.json` at `session_start` when the file is missing, so the consumer's content-language choice is always explicit and committable instead of relying on AH's silent in-memory default. Implementation in `lib/ah-config.ts:ensureAhConfigFile` + wire-up in `extensions/index.ts`. The written `contentLanguage` is chosen with this priority:
  1. **Detected** (`source: "detected"`): if AH finds Italian function words across the existing `.pi/codebase/*.md` content (legacy v0.7.x consumers whose docs were authored under AH's old implicit-Italian default), the file is written with `"contentLanguage": "it"` to preserve the existing voice. Heuristic: at least 3 distinct unambiguous Italian markers (e.g. `della`, `degli`, `perché`, `sono`, `quando`, `tutti`) anywhere in the combined doc bodies, `INDEX.md` excluded.
  2. **Default** (`source: "default"`): otherwise — new consumers, empty `.pi/codebase/`, or content that looks English — the file is written with `"contentLanguage": "en"`.
- A `📝 Created .pi/ah-config.json (contentLanguage: <X> — <reason>). Commit it to share the choice with your team.` line is logged at `session_start` whenever the file was auto-created.
- The existing `🌐 Content language` log now reports `auto-created (detected)` / `auto-created (default)` / `from .pi/ah-config.json` / `default — write failed, in-memory fallback` so the source of the resolved language is always visible.

### Migration
- No action required from the dev. On the first `session_start` after upgrading to v0.8.1, AH writes `.pi/ah-config.json` if absent. Consumers that already committed the file are untouched. Consumers like Efesto whose `.pi/codebase/*.md` were generated in Italian get `"contentLanguage": "it"` automatically and can simply `git add .pi/ah-config.json && git commit` to pin the choice.

## [0.8.0] — 2026-05-14

### Breaking
- AH is now **English-only**: prompts, skills, top-level docs, console logs, and migration `description` strings are all authored in English. Italian-speaking consumers that want their generated content to stay in Italian must commit `.pi/ah-config.json` with `{"configVersion":"1","contentLanguage":"it"}`. The default `contentLanguage` when the config file is absent is `"en"` — this replaces the implicit Italian default that existed up to v0.6.0.
- **(R-0005)** The 5 Italian-named docs under `.pi/codebase/` are renamed to English: `INTEGRAZIONI.md → INTEGRATIONS.md`, `ARCHITETTURA.md → ARCHITECTURE.md`, `STRUTTURA.md → STRUCTURE.md`, `CONVENZIONI.md → CONVENTIONS.md`, `CRITICITA.md → TECHNICAL_DEBT.md`. `STACK.md` and `TESTING.md` are unchanged. The rename is auto-applied by the consumer migration framework on the first `session_start` after upgrade — no dev action required.

### Added
- **(R-0004)** AH ↔ PI compatibility check at `session_start` (`lib/check-pi-compat.ts`): compares AH's `peerDependencies["@earendil-works/pi-coding-agent"]` against the `VERSION` exported by the PI runtime. On mismatch, warns the user through a simultaneous triple notification — `console.warn` + `ctx.ui.notify('warning')` (toast in PI's TUI footer) + `pi.sendMessage({ display: true })` (persistent message in the scrollback). Non-blocking: AH keeps registering commands/tools/hooks. Minimal in-house semver matcher (supports `X.Y.Z`, `^X.Y.Z`, `~X.Y.Z`, `>=X.Y.Z`); unrecognized ranges return `null` and the check is skipped with a single diagnostic `console.warn`.
- **(R-0005)** `.pi/ah-config.json` schema with `configVersion: "1"` and `contentLanguage` (free-form locale code, default `"en"`). Read at `session_start` by `lib/ah-config.ts`. The reader never throws: any failure path downgrades to a single `console.warn` and falls back to defaults. The resolved language is logged once at `session_start` as `🌐 Content language: <Display name> (<code>)`.
- Languages are surfaced to prompts as `$CONTENT_LANG` (display name, e.g. `"English"`) and `$CONTENT_LANG_CODE` (raw code, e.g. `"en"`), substituted by `lib/register-prompt.ts` in every prompt body. All shipped prompts and skills now carry an `**Output language**: ... MUST be written in **$CONTENT_LANG**` directive so generated content honors the consumer's choice. Unknown locale codes pass through to prompts unchanged, so future languages work without an AH code change.
- **(R-0003)** First real consumer migration ships in `lib/migrations/v0_8_0.ts` — idempotent rename of the 5 Italian-named codebase docs to English, plus rewrite of references in `.pi/codebase/INDEX.md` and keys in `.pi/codebase/.cache.json`. No git mutations.
- `WORKFLOW.md`: FAQ on `.pi/git/` — clarifies that PI v0.74.0 already drops a self-managed `.gitignore` in that directory and the consumer only needs to track it (no entry in the root `.gitignore`).
- `WORKFLOW.md`: FAQ on when the `Package Updates Available` banner triggers — PI tracks the upstream commit ref, not `package.json#version`, so on unpinned installs every commit on AH's `main` causes the banner. Three paths documented (`pi update`, pin to a tag, ignore) and the implication for the consumer migration framework (migrations fire on the semver version, not the ref).
- New `Consumer migration` section in `CLAUDE.md` and requirements **R-0004**, **R-0005** in `REQUIREMENTS.md`.

### Changed
- All AH prompts (`prompts/*.md`), skills (`skills/*/INSTRUCTIONS.md`), templates (`templates/*.md`), top-level docs (`WORKFLOW.md`, `REQUIREMENTS.md`, `task-layout.md`, `CLAUDE.md`, `CHANGELOG.md`), and console logs translated to English.
- `session_start` hook in `extensions/index.ts` invokes `migrateConsumer(pi, cwd)` before the startup log, and emits the `🌐 Content language: …` line right after reading `.pi/ah-config.json`.

### Migration
- No dev action required for the rename: on the first `session_start` after upgrading, the consumer migration runner renames the 5 Italian-named `.pi/codebase/*.md` docs in place (idempotent rename, no `git` calls) and rewrites the corresponding entries in `INDEX.md` and `.cache.json`. If you want AH-generated content to remain in Italian, drop `.pi/ah-config.json` at the consumer root with the body `{ "configVersion": "1", "contentLanguage": "it" }`.
- The R-0004 PI-compat check is purely diagnostic and activates only if the running PI version does not satisfy the range declared in `peerDependencies`; otherwise it is silent.

## [0.7.0] — 2026-05-14

### Added
- **(R-0003)** Consumer migration framework: `lib/migrate-consumer.ts` (runner) + `lib/migrations/{index,types}.ts` (registry). Marker `<consumerRoot>/.pi/ah-version` tracks the last AH version applied to the project. Migration list shipped empty at this release — v0.6.0 is the baseline and the framework writes the marker without applying anything yet.
- **(R-0003)** `CHANGELOG.md` adopted in Keep a Changelog 1.1.0 format, populated retroactively from v0.1.0 through v0.6.0.
- **(R-0003)** GitHub Action `.github/workflows/release.yml`: on push of a `vX.Y.Z` tag, extracts the matching CHANGELOG section with POSIX `awk` and creates the GitHub Release with that body (zero external deps, `gh` CLI preinstalled on the runners).
- New `Consumer migration` section in `CLAUDE.md` and requirement **R-0003** in `REQUIREMENTS.md`.

### Migration
- No action required. The framework is staged but inert at this release: AH writes `.pi/ah-version` on `session_start` if absent, but the migration registry is empty.

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

[Unreleased]: https://github.com/Skillbill/agentic-harness/compare/v0.9.0...HEAD
[0.9.0]: https://github.com/Skillbill/agentic-harness/compare/v0.8.1...v0.9.0
[0.8.1]: https://github.com/Skillbill/agentic-harness/compare/v0.8.0...v0.8.1
[0.8.0]: https://github.com/Skillbill/agentic-harness/compare/v0.7.0...v0.8.0
[0.7.0]: https://github.com/Skillbill/agentic-harness/compare/v0.6.0...v0.7.0
[0.6.0]: https://github.com/Skillbill/agentic-harness/compare/v0.5.0...v0.6.0
[0.5.0]: https://github.com/Skillbill/agentic-harness/compare/v0.4.0...v0.5.0
[0.4.0]: https://github.com/Skillbill/agentic-harness/compare/v0.3.0...v0.4.0
[0.3.0]: https://github.com/Skillbill/agentic-harness/compare/v0.2.0...v0.3.0
[0.2.0]: https://github.com/Skillbill/agentic-harness/compare/v0.1.0...v0.2.0
[0.1.0]: https://github.com/Skillbill/agentic-harness/releases/tag/v0.1.0
