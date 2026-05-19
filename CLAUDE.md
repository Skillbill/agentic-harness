# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this repo is

`agentic-harness` (AH) is a TypeScript **Pi Package** for `pi` (`@earendil-works/pi-coding-agent`). It loads at pi startup and bolts a SCRUM-lite task workflow onto pi by registering commands, tools, and context-injection hooks.

AH is distributed as a Pi Package via git: users install it with

```
pi install git:github.com/Skillbill/agentic-harness          # tracks main
pi install git:github.com/Skillbill/agentic-harness@v0.1.0   # pinned
```

`package.json` declares the `pi` manifest (extensions / skills / prompts paths) plus peer dependencies on `@earendil-works/pi-coding-agent` and `typebox`. AH ships as source: pi loads `.ts` files directly via `jiti`, no build step required. The only runtime `node_modules/` entry typically resolved is `typebox` (used by `load-codebase-doc.ts`); peer deps come from PI itself.

## Architecture (the parts that span files)

`extensions/index.ts` is the single entry point (per the convention path declared in `package.json#pi.extensions`). Its `default export` receives `pi: ExtensionAPI` and wires three categories of behavior:

1. **Commands** — every `.md` file under `prompts/` becomes a slash command `/ah:<basename>`. `lib/register-prompt.ts` parses the file's YAML frontmatter (`description`, `argument-hint`), substitutes `$@`, `$1`, and `$EXT_DIR` in the body, then calls `pi.sendUserMessage` so the prompt body runs as if the user typed it. The body **is** the spec for the command — there is no separate handler logic. `$EXT_DIR` resolves to the **repo root** (`dirname(__dirname)` of `extensions/index.ts`), not to `extensions/` itself — prompts use it to locate sibling dirs like `prompts/`, `skills/`, `templates/`.

2. **Tools** — `lib/load-codebase-doc.ts` registers `load_codebase_doc({ name })`, a path-safe reader scoped to `.pi/codebase/*.md`. The `^[a-zA-Z0-9_-]+$` name regex and the `resolve()` + prefix check together prevent traversal; this contract is mirrored (duplicated, deliberately — see comment in `lib/context-inspector.ts`) in the inspector module. **Do not** loosen it.

3. **Context injection** — two `before_agent_start` handlers run per LLM turn. The first injects `.pi/codebase/INDEX.md` (or builds an equivalent index via `lib/codebase-index.ts` if INDEX.md is missing) **once per session**, cached in closure. The second re-detects the current task on every turn (so branch switches are picked up mid-session) and injects a `current-task-context` block with the `TASK.md` frontmatter. Both messages use `display: false` — they're invisible to the user but consume tokens; see the dated note in `extensions/index.ts` for the rationale on what was *removed* from this injection.

> **Note on update notification**: AH does **not** implement a custom OTA check. PI v0.74.0 natively displays a `Package Updates Available` banner at startup when a package in settings has a newer git ref / npm version upstream; the user runs `pi update` (or the package-specific form) on demand. See R-0002 in `REQUIREMENTS.md` for the decision rationale (v0.5.0 dropped a custom OTA module after observing the native banner already covered the use case).

`lib/check-pi-compat.ts` runs at `session_start` (before `migrateConsumer`) and compares the `VERSION` constant exported by PI against `peerDependencies["@earendil-works/pi-coding-agent"]` in AH's `package.json`. On a real mismatch it emits a **triple warning** — `console.warn`, `ctx.ui.notify('warning')`, and a persistent `pi.sendMessage({ display: true })` — then returns. Never throws, never blocks: AH keeps loading commands/tools/hooks regardless. The matcher (`satisfies()`) handles `X.Y.Z`, `^X.Y.Z`, `~X.Y.Z`, `>=X.Y.Z`; anything more exotic returns `null` and the check is skipped with a single diagnostic `console.warn` (so a future change to the range string doesn't silently bypass the check). See R-0004 in `REQUIREMENTS.md`. **Implication for releases**: bump `peerDependencies` before tagging whenever AH starts using API from a newer PI — the check only protects users if that field is honest.

`lib/context-inspector.ts` is a self-contained observability module: it taps `before_provider_request` / `after_provider_response` / `message_end` and writes per-session NDJSON logs under `.pi/context-inspector/<timestamp>_<sid>/`. It must remain non-mutating — its provider-request handler always returns `undefined`.

`lib/codebase-cache.ts` defines the **doc → file-pattern map** used by the codebase-map procedure (`procedures/map-codebase.md`, R-0012) to decide which of the 7 thematic codebase docs (`STACK`, `INTEGRATIONS`, `ARCHITECTURE`, `STRUCTURE`, `CONVENTIONS`, `TESTING`, `TECHNICAL_DEBT`) is stale after a diff. Two entries are "special": `STRUCTURE.md` regenerates on any add/delete (topology trigger), and `TECHNICAL_DEBT.md` is broad with a content filter for TODO/FIXME markers. Editing `PATTERN_MAP` directly changes what the procedure regenerates incrementally. **Note**: the procedure is not a slash command — it is invoked inline by `discuss`, `plan`, `execute`, and `task-done` when `.pi/codebase/` is missing or stale (R-0012).

`lib/ah-config.ts` is a third configuration input alongside `package.json` (release metadata) and `.pi/ah-version` (consumer migration marker). It reads `<consumerRoot>/.pi/ah-config.json` at `session_start` and exposes `{ configVersion, contentLanguage }`. `configVersion` is currently `"1"`; `contentLanguage` is the locale code (default `"en"`) that drives the natural language of AH-generated content inside the consumer — body of `TASK.md`, `DISCUSS.md`, `PLAN.md`, `VERIFY.md`, and the prose of `.pi/codebase/*.md`. Filenames are never localized. The reader never throws: any failure path downgrades to a single `console.warn` and the defaults are used. `lib/register-prompt.ts` substitutes the resolved values into every prompt body as `$CONTENT_LANG` (display name, e.g. `"English"`) and `$CONTENT_LANG_CODE` (raw code), so every shipped prompt / skill carries an `**Output language**` directive that honors the consumer's choice. See R-0005 in `REQUIREMENTS.md`.

### Directory layout

```
package.json            — Pi Package manifest (pi.extensions/skills/prompts, peerDeps)
extensions/
  index.ts              — single entry point (factory function)
lib/                    — helpers imported by extensions/index.ts; NOT auto-loaded as extensions
  register-prompt.ts
  load-codebase-doc.ts
  context-inspector.ts
  codebase-cache.ts, codebase-index.ts
  plan-context.ts/.js, context-audit.ts/.js
prompts/*.md            — registered as /ah:* commands
skills/ah-task-*/INSTRUCTIONS.md — inner-cycle skills
templates/, procedures/ — referenced by prompts via $EXT_DIR
```

## How to release a new version

1. **Update `CHANGELOG.md`**: move the bullets from `## [Unreleased]` to a new `## [X.Y.Z] — YYYY-MM-DD` section. Include the `Migration` sub-section (even if it's just "No action required."). Append the reference link `[X.Y.Z]: …compare/v(X.Y.Z-1)...vX.Y.Z` at the bottom of the file.
2. Bump `version` in `package.json` (semver).
3. If the release requires automatable consumer-side compatibility steps, add `lib/migrations/v<MAJOR>_<MINOR>_<PATCH>.ts` and register it in `lib/migrations/index.ts` (see § Consumer migration).
4. Commit + push to `main`.
5. Create an **annotated git tag** `vX.Y.Z` and push it (`git push origin vX.Y.Z`).
6. The `.github/workflows/release.yml` GitHub Action triggers on the tag, extracts the `[X.Y.Z]` section from CHANGELOG via POSIX `awk`, and creates the GitHub Release with that body automatically. No manual UI intervention needed.

At next pi startup, users with an **unpinned** git install (`pi install git:github.com/Skillbill/agentic-harness` or with `-l`) will see PI's native `Package Updates Available` banner pointing at this package. They then run `pi update` (global) or `pi update --extension git:github.com/Skillbill/agentic-harness` (precise) to pull the new ref. Users with a **pinned** install (`@vX.Y.Z`) are skipped by `pi update` — to upgrade, they re-`pi install` with the new ref.

After `pi update`, at the first PI session with the new AH version, the consumer migration framework (see § Consumer migration) automatically applies any compatibility steps to the consumer project.

## Install scopes

AH can be installed at either scope (PI v0.74.0 supports both natively, no AH code involved):

- **Global**: `pi install git:github.com/Skillbill/agentic-harness` — written to `~/.pi/agent/settings.json`.
- **Project-local**: `pi install -l git:github.com/Skillbill/agentic-harness` — written to `<cwd>/.pi/settings.json`, committable to share with the team. PI auto-installs project packages on startup if missing.

Add `@vX.Y.Z` to pin the version (recommended for CI / reproducible team setups).

## Consumer migration

When a consumer project upgrades AH (e.g. v0.7.0 → v0.8.0 via `pi update`), AH automatically applies any compatibility steps to the project at the next PI `session_start`. This prevents the consumer from drifting out of sync with conventions / file layout / frontmatter changed by the new AH version. Codified in R-0003 of `REQUIREMENTS.md`.

**Architecture** (`extensions/index.ts` calls `migrateConsumer` inside the `session_start` handler):

- **Marker**: `<consumerRoot>/.pi/ah-version`, plain text containing `X.Y.Z` (or JSON `{"version":"x.y.z"}` — both formats accepted on read). Absent = first install. Written by AH after every successful migration step.
- **Runner**: `lib/migrate-consumer.ts` reads its own installed version from the adjacent `package.json`, reads the marker, computes the pending set (`marker < target ≤ installed`, semver order), and runs them one at a time, checkpointing the marker after each success.
- **Registry**: `lib/migrations/index.ts` exports `MIGRATIONS: readonly ConsumerMigration[]` (see `lib/migrations/types.ts` for the contract). Empty list at v0.6.0 and v0.7.0; the first entry ships in v0.8.0 (`v0_8_0.ts` — rename of the 5 Italian-named codebase docs to English).

**Invariants**:
- **Idempotency** mandatory: every `apply` must be safe to re-run (e.g. `mkdirSync(..., { recursive: true })`, rename only if source exists and target does not).
- **No git mutations**: the Git Safety Rule applies inside migrations too. They may mutate files in `.pi/` or in the working tree, but `git add/commit/push/checkout` remain the dev's responsibility.
- **Failure non-blocking**: if a migration fails, AH logs the error, leaves the marker at the last successful step, and keeps loading. The dev fixes and relaunches the session.

**To add a migration**:
1. Create `lib/migrations/v<MAJOR>_<MINOR>_<PATCH>.ts` with `export const migration: ConsumerMigration = { version, description, apply }`. Keep `description` in English.
2. Import and add it to the array in `lib/migrations/index.ts` preserving semver order.
3. Document the step in the `Migration` section of the corresponding version in `CHANGELOG.md`.

## Authoritative contracts — read before changing prompts

- **`WORKFLOW.md`** — task lifecycle (`backlog → in-progress → review → done`), branch/commit conventions, the full `/ah:*` command table, and the Git Safety Rule.
- **`task-layout.md`** — directory layout of a task (`T-NNN-slug/` with `TASK.md` + optional `DISCUSS.md`, `PLAN.md`, `steps/NN-*.md`, `VERIFY.md`), the `discuss → plan → execute → verify` inner cycle contract, the `context-needed:` frontmatter spec for `PLAN.md` (YAML list of bare stems, regex `^[a-zA-Z0-9_-]+$`, empty list `[]` is legal and meaningful), and the `implements: [R-NNNN, ...]` frontmatter key on `TASK.md` that links a task to entries in `<consumerRoot>/.pi/REQUIREMENTS.md`.
- **`.pi/REQUIREMENTS.md` (consumer-side, R-0006 from v0.9.0)** — AH-managed list of project requirements as `R-NNNN` entries. Read by discuss/plan/verify; mutated only by `/ah:task-new` (step 2-bis) and `/ah:task-discuss` (step 7.5). Created as an empty skeleton by the v0.9.0 consumer migration. Filename is invariant; body is in `$CONTENT_LANG`. Treated as an **input** to task work, never harvested at `/ah:task-done`.

If you change any of these, the prompts under `prompts/` and the skills under `skills/` likely need matching updates — they reference these contracts by behavior, not by import.

## 🔒 Git Safety Rule — scope

> **Heads up to whoever is reading this CLAUDE.md while editing the AH repo itself**: the Git Safety Rule **does not apply to you**. It constrains the **agent running inside a consumer project** when AH is loaded there — i.e. the prompts under `prompts/` (executed via `pi.sendUserMessage`) and the consumer-migration code (executed at PI's `session_start` in the consumer). When you instead work on this repo (`Skillbill/agentic-harness`) as an AH dev, mutating git operations (`add` / `commit` / `push` / branch / PR) are perfectly normal — on the user's request.

The authoritative rule — list of forbidden commands, the `/ah:task-new` exception, and the "you commit it" / "push it" override — lives in **`WORKFLOW.md` § Git Safety Rule**. That file is loaded as context by AH's prompts inside consumers; this `CLAUDE.md` is not.

Implication for **consumer migrations** (`lib/migrations/v*.ts`): when they run inside the consumer they mutate `<consumerRoot>/.pi/...` or the consumer's working tree, but they **never** run `git add` / `commit` / `push` / `checkout`. See R-0003.

## Inner-cycle skills

`skills/ah-task-{discuss,plan,execute,verify,pr-open}` mirror the inner-cycle phases. They are invoked indirectly: the dev runs `/ah:task-next-step`, which auto-detects the task from the branch (`feature/T-NNN-*`) and advances one phase. Key invariants enforced by the prompts:

- **One step = one commit** during `execute`. `/ah:task-next-step` must stop after a single step — never chain.
- **`.pi/codebase/` is a blocking prerequisite** for discuss/plan/execute. If missing, propose running the codebase-map procedure inline (`$EXT_DIR/procedures/map-codebase.md`); if the dev refuses, halt the phase. The procedure is **not** a slash command (R-0012).
- **`PLAN.md` is the authority** for what codebase docs get loaded: only docs listed in its `context-needed:` frontmatter, loaded via `load_codebase_doc`. Empty list means "no codebase context for this task" — that is correct, not a bug.
- **DoD in `VERIFY.md` is advisory**, not a gate.
- **Step files are never deleted on replan** — they move to `steps/archive/`.

## Conventions when editing this repo

- Prompts under `prompts/` and `skills/` are in **English**. New prompts MUST stay in English. The natural language of the content the LLM generates inside a consumer is driven separately by `.pi/ah-config.json#contentLanguage` and surfaced into prompt bodies as `$CONTENT_LANG` / `$CONTENT_LANG_CODE` — never hard-code a language in a prompt.
- Commit message format for AH itself follows the same `feat(T-NNN/NN): …` / `chore(T-NNN): …` patterns documented in `task-layout.md:373-381` when you're operating inside the task cycle. For ad-hoc commits to this extension's own code, no specific format is enforced.
- `.pi/codebase/.cache.json` is gitignored; the 7 thematic docs under `.pi/codebase/` are versioned in the consumer project, not here.
