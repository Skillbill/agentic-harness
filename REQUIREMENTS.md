---
feature: AH OTA update
status: approved
created: 2026-05-14
updated: 2026-05-14
---

# REQUIREMENTS — OTA update of the AH extension for PI

## Context

`agentic-harness` (AH) is an extension for [`@earendil-works/pi-coding-agent`](https://www.npmjs.com/package/@earendil-works/pi-coding-agent) (PI). Today the extension is installed manually by cloning/copying the source into PI's extensions directory, and updates require an explicit dev intervention.

This feature introduces an "official" distribution of AH as a **Pi Package** installable via `pi install git:...`, and an OTA (over-the-air) mechanism that, at startup of a PI environment with AH installed, checks for a new version and — subject to dev confirmation — applies it and reloads the extension.

Top-level objective: reduce the friction of adopting and updating AH while keeping the dev in control of the changes applied to their environment.

## Requirements

### R-0001 — Installation via `pi install`

AH is a PI extension and can be installed with the `pi install` command.

**Decisions**:
- **Channel**: Git (GitHub) — install via `pi install git:github.com/Skillbill/agentic-harness[@<ref>]`. No npm publish in v1.
- **Identity**: `name = "@skillbill/agentic-harness"` in `package.json` (scoped to the Skillbill org).
- **PI layout**: convention dirs — `extensions/index.ts` (entry), `prompts/` (slash commands), `skills/` (skills). TS helpers in `lib/` excluded from the convention dirs and reached via relative imports.
- **PI manifest**: the `pi` field of `package.json` points explicitly at `extensions/index.ts`, `skills`, `prompts` (safety belt: auto-discovery does not promote `.ts` files in `lib/` to standalone extensions).
- **Peer dependencies**: `@earendil-works/pi-coding-agent` and `typebox` (both provided by PI, not bundled by AH — see PI's `docs/packages.md`).

### R-0002 — ~~Startup OTA check and on-demand update~~ → DECLINED in v0.5.0

> **Status**: declined. Implemented in v0.1.0 (PR #1) + v0.2.0 (PR #2) + v0.3.0 (PR #3 fix), then removed in v0.5.0.
>
> **Rationale**: PI v0.74.0 **natively** displays a `Package Updates Available` banner at startup when an installed package has a new upstream ref — see screenshot in the cleanup PR. AH's custom OTA duplicated this notification with slightly richer UX (interactive modal, automatic `ctx.reload()`) but:
>
> - added ~280 lines across the OTA module, install-info, version-reader, cache I/O, and dialog;
> - introduced maintenance edge cases (stale cache, network errors, invalid `pi update` flags, install-path detection, pinning detection);
> - displayed the prompt **in competition** with the native PI banner, creating visual noise;
> - relied on `ctx.reload()` with subtle behavior (terminal-only, loses in-memory state) and on the `pi update` subprocess.
>
> **Decision**: removed all OTA code. AH delegates entirely to PI's native mechanism. The user runs `pi update` (or `pi update --extension git:...`) at will, from the terminal, outside the pi session.
>
> **Consequences for the user**:
> - On unpinned install: PI shows the banner; a manual command updates the package. No automatic reload — the user restarts `pi` to load the new code.
> - On pinned install (`@vX.Y.Z`): PI follows its standard semantics (`pi update` skips pinned packages). To upgrade: `pi install` with the new ref.
>
> See `CLAUDE.md` § *How to release a new version* and § *Install scopes* for the updated operational flow.

### R-0003 — Versioning, Changelog & Consumer Migration

Starting from v0.7.0 AH adopts a formalized release workflow and a **consumer migration** mechanism applied automatically at PI's `session_start`. Goal: when a consumer project upgrades AH (e.g. v0.7.0 → v0.8.0 via `pi update`), AH must be able to bring the project state in line with the new version without any manual intervention from the dev.

**Decisions**:

- **CHANGELOG.md** at root, [Keep a Changelog 1.1.0](https://keepachangelog.com/en/1.1.0/) format, SemVer. Standard sections + a `Migration` section per version (English, prose or pseudocode). Populated retroactively from v0.1.0. Shipped with the Pi Package (included in `package.json#files`).
- **GitHub Action** `.github/workflows/release.yml`: triggers on `v*.*.*` tags, extracts the matching section from `CHANGELOG.md` with POSIX `awk` (zero deps) and creates the release via `gh release create` (preinstalled on GitHub-hosted runners). No `npm install`, no third-party actions — we minimize the supply chain.
- **Consumer marker**: `<consumerRoot>/.pi/ah-version`. Tolerant read: accepts plain text (`0.7.0\n`) or JSON `{ "version": "x.y.z" }`. Written by AH after every successful migration step (checkpoint).
- **Migration framework**: `lib/migrate-consumer.ts` (runner) + `lib/migrations/index.ts` (registry) + `lib/migrations/types.ts` (`ConsumerMigration` contract) + `lib/migrations/v<M>_<m>_<p>.ts` (entries). Single signature: `apply(consumerRoot, pi) => Promise<void>`. Application order: ascending semver, with filter `marker < target ≤ installed`.
- **Idempotency**: mandatory invariant — every `apply` must be safe to re-run (`mkdirSync(..., { recursive: true })`, `if (!existsSync) ...`, rename only if source exists and target does not).
- **Git Safety Rule** unchanged: migrations **never run** mutating git commands. They may mutate files under `.pi/` and in the working tree, but staging/commit/push remain the dev's responsibility.
- **Failure non-blocking**: error on a migration → marker stays at the last successful step, error printed, AH keeps loading. The user fixes and relaunches the session.
- **Hook**: registered inside the existing `session_start` handler of `extensions/index.ts`, not in `before_agent_start`. Rationale: the migration is a one-shot action per session; `before_agent_start` fires for every LLM turn (as confirmed by the existing `codebase-index` and `current-task-context` handlers which re-detect at every turn) and is not the right layer.
- **Initial list**: empty. v0.6.0 is the baseline; the framework exists and writes the marker but applies nothing. v0.7.0 keeps the list empty (framework shipped, no consumer-side change to apply yet). The first real migration arrives with v0.8.0.

**Update (v0.8.0)**: the first real consumer migration ships in `lib/migrations/v0_8_0.ts` — an idempotent rename of the 5 Italian-named codebase docs to English (`INTEGRAZIONI.md → INTEGRATIONS.md`, etc.), plus rewrite of references in `INDEX.md` and keys in `.cache.json`. This confirms the framework works end-to-end: the marker advances, the rename is idempotent, no git mutations are emitted, and failures remain non-blocking.

**Consequences for the AH dev** (see `CLAUDE.md` § *How to release a new version* and § *Consumer migration*):

- Every release requires a `CHANGELOG.md` update **before** tagging.
- Compatibility steps that touch the consumer filesystem live as **migration code**, not as textual instructions in the changelog (though they must still be documented in the corresponding `Migration` section).
- A pushed tag triggers the GitHub Release automatically: no need to create the release by hand in the GitHub UI.

### R-0004 — PI peer-version compatibility check

Starting from v0.8.0 AH verifies at `session_start` that the running PI version satisfies the range declared in `package.json#peerDependencies["@earendil-works/pi-coding-agent"]`. On a mismatch the user in the consumer project is clearly notified; AH still keeps loading commands/tools/hooks (warn loud, non-blocking).

**Rationale**: PI v0.74.0 does not validate an extension's peerDependencies on its own. Without this check, an AH version that requires APIs newer (or older) than those actually exposed by the installed PI only fails at runtime — typically in the middle of an LLM turn, with an opaque stack trace. The check moves the failure from "silent crash mid-task" to "visible warning at first `session_start`".

**Decisions**:

- **Source of truth**: `peerDependencies["@earendil-works/pi-coding-agent"]` in AH's `package.json`. No dedicated `pi.compatibility` field: the range is already there, it's already the standard npm/Pi convention, and the AH dev updates it on every release that adopts new PI APIs anyway.
- **Runtime source for the PI version**: named export `VERSION` from `@earendil-works/pi-coding-agent` (see PI v0.74.0's `dist/config.d.ts`). No lookup via `getPackageJsonPath()` — fewer hops.
- **Minimal in-house semver matcher** (`lib/check-pi-compat.ts:satisfies`): supports `X.Y.Z` (exact), `^X.Y.Z`, `~X.Y.Z`, `>=X.Y.Z`. More exotic ranges (e.g. `0.74.x || 0.75.x`) return `null` → skip + diagnostic warn ("range not recognized"). Consistent with AH's zero-deps philosophy (see also the `awk`-only `release.yml` for R-0003): no `semver` package added.
- **Warn loud, non-blocking**: on a real mismatch AH emits a warning on **three channels** simultaneously and continues loading.
  1. `console.warn` — consistent with the existing `[agentic-harness] …` logging.
  2. `ctx.ui.notify(msg, "warning")` — toast in PI's TUI footer (guarded by `ctx.hasUI` because in print/RPC mode no UI exists).
  3. `pi.sendMessage({ customType: "ah-pi-compat-warning", content, display: true })` — persistent message in the session scrollback; it does not disappear. The triple coverage is intentional: a user who ignores the toast still finds the message scrolled above, and someone launching in non-TUI mode still sees the `console.warn`.
- **Never blocking**: even on a severe mismatch AH keeps registering prompts/tools/hooks. The decision to "stop" is left to the user, who — once the warning is visible — chooses whether to fix the version or proceed. Consistent with the non-blocking policy of `migrateConsumer` (R-0003).
- **Never throws**: the module self-isolates with try/catch; the `session_start` handler in `extensions/index.ts` also has its own safeguard try/catch.
- **Hook**: registered inside the existing `session_start` handler of `extensions/index.ts`, **before** `migrateConsumer`. Rationale: if PI is too old, the migration might use missing APIs and crash before the compat warning is seen.

**Consequences for the AH dev**:

- Update `peerDependencies["@earendil-works/pi-coding-agent"]` **before** tagging every time newer PI APIs are adopted. The check protects the user only if this field is honest.
- If a more exotic range than those supported is needed, first extend `satisfies()` in `lib/check-pi-compat.ts` (and the relevant verification checklist), then tag.

**Out of scope**: extending the check to `typebox` (the other peerDep). `typebox` arrives from PI as a transitive dep and is not practically replaceable by the user — a mismatch indicates a PI-side problem, not a consumer-side one.

### R-0005 — AH ships English-only; consumer chooses content language via `.pi/ah-config.json`

Starting from v0.8.0 AH's authoring language is **English** across the board: prompts, skills, top-level docs (`WORKFLOW.md`, `task-layout.md`, `REQUIREMENTS.md`, `CLAUDE.md`, `CHANGELOG.md`), console logs, and migration `description` fields. The natural language of the **content generated by AH inside a consumer project** (the body of `TASK.md`, `DISCUSS.md`, `PLAN.md`, `VERIFY.md`, and the prose of `.pi/codebase/*.md`) is instead chosen by the consumer via a small config file committed at the project root.

**Rationale**: a single English source of truth is easier to maintain and review by non-Italian-speaking contributors and makes AH legible to the wider Pi ecosystem. At the same time, each consumer team retains the freedom to localize its own working documents — many of which are read by non-technical stakeholders who may prefer the team's working language.

**Decisions**:

- **Config file**: `<consumerRoot>/.pi/ah-config.json`, JSON, committable. Shape:
  ```json
  { "configVersion": "1", "contentLanguage": "en" }
  ```
  - `configVersion` is a string and is currently `"1"`. It governs future schema evolutions of this same file; bump only on breaking-shape changes.
  - `contentLanguage` is a free-form code (e.g. `"en"`, `"it"`, `"fr"`). Unknown codes are **not rejected**: they are surfaced to prompts as-is, so the consumer can experiment with future languages without an AH code change.
- **Default**: when the file is unreadable (malformed JSON, wrong shape), `readAhConfig` falls back to `contentLanguage = "en"`. This is the new global default, replacing the implicit Italian default that existed up to v0.7.0.
- **Auto-creation (v0.8.1)**: when the file is **absent**, AH writes it at `session_start` so the language choice is always explicit and committable. The value comes from `detectConsumerLanguage`: if at least 3 distinct unambiguous Italian function words (`della`, `degli`, `perché`, `sono`, …) appear anywhere in the existing `.pi/codebase/*.md` content (excluding `INDEX.md`), the file is created with `"contentLanguage": "it"` — preserving the voice of legacy v0.7.x consumers like Efesto whose docs were authored under the old implicit-Italian default. Otherwise (new consumers, empty `.pi/codebase/`, English-looking content) the file is created with `"contentLanguage": "en"`. The write is atomic (tmp + rename), never throws, and silent on failure beyond a single `console.warn`. Once the file exists, AH never overwrites it — a manual edit (or a commit with a different value) is the source of truth.
- **Filenames are never localized**: `TASK.md`, `DISCUSS.md`, `PLAN.md`, `VERIFY.md`, `INDEX.md`, and the 7 codebase docs keep the exact names AH defines, in every locale. Only the **prose inside** these files honors `contentLanguage`.
- **Error handling**: `readAhConfig` never throws. Missing file, invalid JSON, wrong shape, permission errors — every failure path downgrades to a single `console.warn` and returns the default config. AH always boots.
- **Surface to prompts**: `lib/register-prompt.ts` substitutes two new placeholders in every prompt body — `$CONTENT_LANG` (display name, e.g. `"English"`, `"Italian"`) and `$CONTENT_LANG_CODE` (raw code, e.g. `"en"`, `"it"`) — and every shipped prompt / skill carries an `**Output language**: ... MUST be written in **$CONTENT_LANG**` directive so the LLM honors the consumer's choice when generating content.
- **Visibility**: the resolved language is logged once at `session_start` in `extensions/index.ts` (`🌐 Content language: English (en)`), so the dev sees immediately what AH thinks the project's working language is.

**Implementation pointers**:

- `lib/ah-config.ts` — typed reader, default fallback, single `console.warn` on any failure.
- `lib/register-prompt.ts` — placeholder substitution for `$CONTENT_LANG` / `$CONTENT_LANG_CODE`.
- `extensions/index.ts` — calls `readAhConfig` at `session_start` and emits the `🌐 Content language: …` log line.
- `lib/migrations/v0_8_0.ts` — consumer-side rename of the 5 Italian-named codebase docs (`INTEGRAZIONI.md`, `ARCHITETTURA.md`, `STRUTTURA.md`, `CONVENZIONI.md`, `CRITICITA.md`) to their English counterparts (`INTEGRATIONS.md`, `ARCHITECTURE.md`, `STRUCTURE.md`, `CONVENTIONS.md`, `TECHNICAL_DEBT.md`), with rewrite of `.pi/codebase/INDEX.md` references and `.pi/codebase/.cache.json` keys.

**Consequences for the AH dev**:

- New prompts, skills, docs, and migration `description` strings must be authored in English. Don't reintroduce Italian.
- When adding a placeholder substitution beyond `$CONTENT_LANG` / `$CONTENT_LANG_CODE`, mirror the same defensive style (substitution, not parsing): the prompt body remains the spec.
- The default `contentLanguage = "en"` is **a behavioral default**, not a policy: a consumer is free to commit `.pi/ah-config.json` with `"contentLanguage": "it"` and expect AH-generated content to stay in Italian.

### R-0006 — Consumer-side `.pi/REQUIREMENTS.md` (project requirements as input)

Starting from v0.9.0 AH manages a single document `<consumerRoot>/.pi/REQUIREMENTS.md` listing the consumer project's requirements as `R-NNNN` entries. The list is treated as an **input** to the task workflow: it is read by `/ah:task-discuss`, `/ah:task-plan`, and `/ah:task-verify`, and is mutated only by `/ah:task-new` (step 2-bis — link to existing R-NNNN, create one inline, or skip) and `/ah:task-discuss` (step 7.5 — new / amend / no change post-discussion). It is **never** harvested at `/ah:task-done` — that phase has no opinion on requirements.

**Decisions**:

- **Location**: `<consumerRoot>/.pi/REQUIREMENTS.md` (single file, never split). Sibling of `.pi/codebase/`, `.pi/tasks/`, `.pi/ah-config.json` — under AH's `.pi/` namespace, not in repo root.
- **Format**: frontmatter (`project`, `status: living`, `created`, `updated`) + sections `Context` / `Requirements` / `Out of scope` / `Historicized decisions` / `Release history`. Each R-NNNN entry: 1–3 sentence body + `**Rationale**` line + `**Linked tasks**` line maintained automatically. R-NNNN ids are monotonic, zero-padded to 4 digits.
- **Filename invariance**: always `.pi/REQUIREMENTS.md`, never localized. Body prose is in `$CONTENT_LANG` (per R-0005); identifiers, frontmatter keys, and section headings stay English/ASCII.
- **Bootstrap**: the v0.9.0 consumer migration (`lib/migrations/v0_9_0.ts`) drops an empty skeleton in `.pi/` on first session after upgrade. Idempotent. No dedicated bootstrap command — R-NNNN entries grow organically through `/ah:task-new` and `/ah:task-discuss`.
- **Linking**: `TASK.md` frontmatter gains an optional `implements: [R-NNNN, ...]` key (list, `^R-\d{4}$`). Set by `/ah:task-new` (single id or empty), optionally extended by `/ah:task-discuss`. AH appends the task id to the R-NNNN's `**Linked tasks**` line; reverse cleanup on rename/removal is the dev's responsibility (tolerant, never destructive).
- **Context loading**: skill prompts read REQUIREMENTS.md directly when needed (discuss / plan / verify). **Not** added to `context-needed:` in `PLAN.md` — that list remains scoped to the 7 codebase docs. **Not** injected at `session_start` either: the per-skill Read pattern is sufficient and avoids token waste in unrelated turns.
- **Git Safety widening**: the existing `/ah:task-new` git-auto-commit exception is widened to allow `.pi/REQUIREMENTS.md` in the same commit, **only** when step 2-bis touched it; the `/ah:task-discuss` exception is widened identically for step 7.5. No other prompt or skill mutates the file.

**Consequences for the AH dev**:
- Any new prompt/skill that operates on a task and needs intent context should read `.pi/REQUIREMENTS.md` directly, mirroring the §3-bis pattern in discuss/plan and the DoD-Requirements subsection in verify.
- Do not extend `context-needed:` to cover REQUIREMENTS — keep the two namespaces (codebase docs vs project intent) distinct.
- When changing the file's structure (sections, frontmatter keys, R-NNNN body fields), update `templates/REQUIREMENTS.md`, the v0.9.0 migration's substitution logic, and the parsing rules in `prompts/task-new.md` step 2-bis and `skills/ah-task-discuss/INSTRUCTIONS.md` step 7.5 together.

### R-0007 — Task `priority` frontmatter field

Starting from v0.10.0 every `TASK.md` carries a `priority:` key in its frontmatter, a coarse-grained urgency tag with exactly four levels (`LOW`, `NORMAL`, `HIGH`, `IMMEDIATE`, uppercase, case-sensitive). The default is `NORMAL`. The field is consumed by `/ah:project-status` to render a per-task priority marker and to sort the `Backlog` section in priority-descending order; it is **not** consumed by the inner-cycle phases (discuss / plan / execute / verify) — priority is about queue ordering, not work content.

**Decisions**:

- **Allowed values & casing**: exactly the four uppercase tokens above. Anything else (missing, blank, lowercase, typo) is normalized to `NORMAL` by readers; the migration only writes the canonical uppercase form.
- **Default on creation**: `NORMAL`. `/ah:task-new` does not interview the dev about priority — it writes the template's literal `priority: NORMAL` and stops. The dev edits the file by hand when a task needs a different urgency. Rationale: priority changes over time and is usually a queue-management decision separate from defining the task; bolting it into the creation interview would conflate the two.
- **Display in `/ah:project-status`**: a single-character marker in column 2 of the row prefix (`!` = IMMEDIATE, `^` = HIGH, ` ` = NORMAL, `v` = LOW), uniform across all sections so columns align. Column 1 stays the current-task marker (`▶`).
- **Backlog ordering**: `IMMEDIATE → HIGH → NORMAL → LOW`, tie-break by `id` ascending. Other sections keep their existing order (in-progress / review / recently-closed have their own natural sort).
- **Bootstrap & migration**: existing TASK.md files in any consumer that upgrades to v0.10.0 are walked by `lib/migrations/v0_10_0.ts` and get `priority: NORMAL` inserted after the `status:` line. Idempotent — skips any file that already declares a `priority:` value. Non-destructive — never overrides an existing value (the dev owns it).
- **Linkage to other contracts**: no impact on `implements:`, `progress:`, `branch:`, the inner-cycle phases, or the codebase-doc workflow. `WORKFLOW.md` is unchanged because the lifecycle states are still the same; only the per-task metadata grows by one field.

**Consequences for the AH dev**:
- When you add a new reader of TASK.md frontmatter, normalize the priority field the same way as `/ah:project-status` (case-insensitive parse, default `NORMAL` on miss). Don't add a fifth level without updating R-0007, the template, the migration, and the project-status renderer in lockstep.
- The migration is **append-only on missing fields**; if you ever need to rewrite an existing priority (e.g. to normalize casing), add a new migration rather than retrofitting v0.10.0.

## Out of scope

- Distribution of third-party extensions other than AH.
- Publishing on the npm registry (changes the channel but not requirement R-0001 — can be a later iteration).

## Project constraints

- Compliance with the **Git Safety Rule** (`CLAUDE.md`): the extension does not mutate git state in the dev's repo.
- Compatibility with the existing authoritative contracts (`WORKFLOW.md`, `task-layout.md`).
- The extension stays loaded by PI through the `default export` of `extensions/index.ts`.

## Historicized decisions

1. *Does PI already offer primitives for `pi install` and for reloading an extension?* → **Yes**. `pi install`/`pi update` documented in `docs/packages.md` of PI v0.74.0 (npm, git, https, local paths). Reload via `ctx.reload()` or session restart.
2. *Does the OTA check run inside `index.ts` or as a dedicated hook?* → **N/A**: R-0002 declined in v0.5.0. PI has a native `Package Updates Available` banner that covers the use case without custom code.
3. *Does the update proposal go through `pi.sendUserMessage` or a dedicated UI channel?* → **N/A**: R-0002 declined. No custom prompt: the user sees the PI banner and runs `pi update` manually.

## Release history

- **v0.1.0** (PR #1): Distributable Pi Package (R-0001) + complete custom OTA (R-0002).
- **v0.2.0** (PR #2): scope detection (project-local vs global) + pinning detection for OTA.
- **v0.3.0** (PR #3): fix `pi update -l` (the option does not exist in PI).
- **v0.4.0**: test release to validate the OTA flow end-to-end (no code changes).
- **v0.5.0**: cleanup — custom OTA removed after observing PI's native banner. R-0001 unchanged.
- **v0.6.0**: test release to validate PI's native banner in a chain of consecutive releases (no code changes).
- **v0.7.0**: introduces R-0003 — `CHANGELOG.md` (Keep a Changelog), GitHub Action `release.yml`, consumer migration framework (`lib/migrate-consumer.ts` + `lib/migrations/`). Migration list still empty: the framework writes the marker but has nothing to apply yet.
- **v0.8.0**: introduces R-0004 — peer-version compatibility check (`lib/check-pi-compat.ts`) run at `session_start` before `migrateConsumer`. Warn loud non-blocking on three channels (console + UI toast + persistent message). Also introduces R-0005 — AH becomes English-only (prompts, skills, docs, console logs) and the consumer picks content language via `.pi/ah-config.json`. The first real consumer migration (`lib/migrations/v0_8_0.ts`) renames the 5 Italian-named codebase docs (`INTEGRAZIONI → INTEGRATIONS`, etc.), exercising the migration framework end-to-end.
- **v0.8.1**: extends R-0005 — AH auto-creates `.pi/ah-config.json` at `session_start` when missing, with a `contentLanguage` chosen by `detectConsumerLanguage` (Italian if existing `.pi/codebase/*.md` content looks Italian — rescues legacy v0.7.x consumers like Efesto; English otherwise). Makes the language choice explicit and committable instead of relying on a silent in-memory default.
- **v0.9.0**: introduces R-0006 — consumer-side `.pi/REQUIREMENTS.md`. New `templates/REQUIREMENTS.md` skeleton, consumer migration `lib/migrations/v0_9_0.ts` that drops an empty file on first session after upgrade, new `implements:` frontmatter key on `TASK.md`, and integration into `/ah:task-new` (step 2-bis), `/ah:task-discuss` (step 3-bis + 7.5), `/ah:task-plan` (§3-bis read-only), and `/ah:task-verify` (Requirements DoD subsection). `/ah:task-execute` is deliberately unchanged. No new slash command — requirements grow organically.
- **v0.9.1**: small UX tweak to `/ah:project-status` — adds a `Recently closed` section showing the last 5 tasks in `done/` sorted by `updated` desc. No new requirement.
- **v0.9.2**: defensive fix to `lib/register-prompt.ts` — prepends a short directive to any prompt body that references `$EXT_DIR` instructing the agent that AH-internal paths arrive pre-resolved as absolute paths and must be read directly (no `find` / `locate` / `grep -r`). Caps a long stall observed in `/ah:task-new` where some agents scanned the entire filesystem to "locate" the template. No new requirement.
- **v0.10.0**: introduces R-0007 — `priority` field on `TASK.md` frontmatter (`LOW | NORMAL | HIGH | IMMEDIATE`, default `NORMAL`). `/ah:project-status` renders the priority marker for every task and sorts the Backlog by priority desc. Consumer migration `lib/migrations/v0_10_0.ts` retrofits the field as `NORMAL` on every legacy task in the four task buckets.
