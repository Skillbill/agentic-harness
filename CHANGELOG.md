# Changelog

All notable changes to `@skillbill/agentic-harness` are documented in this file.

The format is based on [Keep a Changelog 1.1.0](https://keepachangelog.com/en/1.1.0/), and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

In addition to the standard Keep a Changelog sections (`Added`, `Changed`, `Deprecated`, `Removed`, `Fixed`, `Security`), every release may include a **`Migration`** section describing the compatibility steps a consumer project must apply when upgrading AH to that version. When a migration is automatable, AH applies it at the next `session_start` via the consumer migration framework (see R-0003 in `REQUIREMENTS.md`); the `Migration` bullet below serves as human-readable documentation.

## [Unreleased]

## [0.21.0] — 2026-05-20

### Changed
- **(R-0009)** The `/ah:help` overlay (and the `alt+h` shortcut that shares its handler) becomes interactive in its "Slash commands" section. `↑` / `↓` move a `▶` marker between the listed `/ah:*` commands; pressing `ENTER` closes the popup and prefills the core input editor with `/<name> ` so the dev can append arguments (or hit `ENTER` again for args-less commands). `ESC` still closes without selection. Implementation: new `lib/help-popup.ts` Component, modelled on `lib/branch-switch-popup.ts` (view-only, side-effect-free); the prefill happens in the shortcut handler via `ctx.ui.setEditorText`. The previous `lib/info-popup.ts` is removed — it was only used by `/ah:help` and its read-only contract no longer fits.

### Migration
- No action required. Existing `alt+h` / `/ah:help` muscle memory keeps working — ESC still closes. The new `↑` / `↓` + `ENTER` behavior is purely additive.

## [0.20.0] — 2026-05-19

### Added
- **(R-0016)** New slash command `/ah:project-bootstrap` — a guided greenfield on-ramp. Single-session dialogue that takes a brand-new project (no code yet, perhaps a README) through five phases: pre-flight + raw-material read → vision/context (Phase A, free 1–3 question loop) → requirements harvesting (Phase B, one R-NNNN at a time with `accept/edit/drop/next`) → technical intent (Phase C, three mini-questions on stack/architecture/conventions) → initial backlog (Phase D, batch proposal of 3–7 tasks each linked to ≥ 1 R-NNNN). Produces a populated `.pi/REQUIREMENTS.md` (Context + first R-NNNN entries), three intent-based codebase docs (`.pi/codebase/STACK.md`, `ARCHITECTURE.md`, `CONVENTIONS.md` with `source: intent` frontmatter and `<!-- intent:keep -->` markers) plus a coherent `INDEX.md`, and N task directories under `.pi/tasks/backlog/`. All written in `$CONTENT_LANG`. Committed in a single `chore(bootstrap): initialize project — N requirements, M tasks` commit on `main`/`master` via a scoped Git Safety exception. Pre-flight refuses to run if the project shows any sign of being non-greenfield (existing `.pi/codebase/` content, existing R-NNNN entries, or existing task directories).

### Changed
- **(R-0016)** `skills/ah-task-discuss/INSTRUCTIONS.md` step 2 softened: only `ARCHITECTURE.md` + `CONVENTIONS.md` are blocking prerequisites — `STRUCTURE.md` is now advisory (a fresh bootstrap legitimately has no structure to map yet). The skill also recognizes the `source: intent` frontmatter flag on bootstrap-produced docs and anchors gray-area questions to *planned* architecture in that case. The STOP message points greenfield projects at `/ah:project-bootstrap` rather than at `map-codebase`.
- **(R-0016)** `procedures/map-codebase.md` updated to preserve intent-based docs. The "Skip" guidance now targets "projects just bootstrapped and not yet carrying source-code commits" instead of the older "greenfield projects" wording. Step 1a scenario 1 grows a "bootstrap-state map" sub-case: when `STACK.md`/`ARCHITECTURE.md`/`CONVENTIONS.md` carry `source: intent`, the procedure does **not** mark them stale on first run — only `STRUCTURE.md`/`INTEGRATIONS.md`/`TESTING.md`/`TECHNICAL_DEBT.md` enter `stale_docs`. When intent-based docs are eventually re-generated, blocks wrapped in `<!-- intent:keep --> … <!-- /intent:keep -->` HTML comments are preserved verbatim, observed content is appended under a `## Observed state` section, and `source:` flips to `intent+observed`.
- `WORKFLOW.md` adds a "Greenfield entry" subsection and lists `/ah:project-bootstrap` as the first row of the slash-command table. `README.md` mirrors the same addition.

### Migration
- No action required. `/ah:project-bootstrap` is opt-in and refuses to run on projects that aren't greenfield. Consumers upgrading from v0.19.2 don't need to do anything; the new command is available the next time they start a brand-new project from `main`.

## [0.19.2] — 2026-05-19

### Changed
- `README.md` gains a `Workflow at a glance` section with two ASCII diagrams: the **external lifecycle** (task directory moves `backlog → in-progress → review → done`, each transition driven by a single slash command) and the **inner cycle** (`discuss → plan → execute → verify`, with the artifacts each phase writes). Cosmetic-only; the underlying behavior was already documented in `WORKFLOW.md` and `task-layout.md`.

### Migration
- No action required.

## [0.19.1] — 2026-05-19

### Fixed
- `/ah:project-status` step 3 had asymmetric wording that *looked* like a residual current-vs-others branching even though R-0015 in v0.19.0 had unified the computation: "if the feature branch is checked out locally, the artifacts are on disk… otherwise read via `git show`". Functionally equivalent in the committed-only common case, but cognitively confusing and semantically wrong — the current task would have picked up uncommitted working-tree state while the others read only committed content from the branch. Rewrote the resolution flow to mirror step 1: always `git show <branch>:<path>` first (then `origin/<branch>`, then disk as last-resort fallback), regardless of which branch is checked out. A percentage seen from `main` now matches the percentage seen from the feature branch.

### Migration
- No action required.

## [0.19.0] — 2026-05-19

### Changed
- **(R-0015)** `/ah:project-status` now computes per-task `pct` and inner-cycle phase the same way for **every** task in `in-progress/` — current task and others. Source of truth is the inner-cycle artifacts (`PLAN.md` + `steps/NN-*.md` with `status: todo | doing | done | …`), read from the feature branch via `git show <branch>:<path>` when the branch isn't checked out (or from `origin/<branch>` as a second-tier fallback). The stale `progress:` frontmatter field is no longer consulted as the primary source — only as a last resort when artifacts are entirely unreachable.

  Previous behavior (v0.18.x) showed `0%` and `[-]` for any in-progress task that wasn't on the current branch, because `progress:` was never updated incrementally by `task-execute`. Tasks like T-019 with 1/8 steps done rendered as `0%` from `main`. Now they render as `12% [execute 1/8]`.

- **(R-0015)** New phase indicator `[no plan]` for the case where `/ah:task-start` ran but the dev bypassed `task-discuss` / `task-plan` / `task-execute` (the task dir contains only `TASK.md`, no `DISCUSS.md` / `PLAN.md` / `steps/`). The bar stays at `0%` — honest, because there's no plan to measure progress against. Catches free-form work that's invisible to the inner cycle.

- **(R-0015)** `pct` for the current in-progress task is no longer derived from `## Definition of Done` checkbox counts. DoD checkboxes describe *readiness to close* (lint/typecheck/tests passed, docs updated, …), not *how far through execute we are*. The two metrics were conflated in v0.18.x. Now `pct` = `steps_done / steps_total` consistently for every in-progress task; DoD readiness shows up implicitly via the `verify` phase appearing.

### Migration
- No action required. Existing tasks with `progress: null` in their frontmatter will start displaying correct percentages at the next `/ah:project-status` run — derived from their existing step files. No write side-effects are added to `task-execute`: the `TASK.md` frontmatter stays the same to avoid merge-conflict noise on long-running tasks.

## [0.18.0] — 2026-05-19

### Added
- `README.md` — first proper project entry point. Short tagline, what AH is, install instructions (with the three `pi install` variants and the version-pin form), at-a-glance tables for slash commands and keyboard shortcuts, a typical task flow, repo layout map, pointers to the four authoritative docs (`CLAUDE.md` / `WORKFLOW.md` / `task-layout.md` / `REQUIREMENTS.md`), update/migration model, license summary, contributing note.
- `LICENSE` — full text of **PolyForm Noncommercial 1.0.0** (SPDX `PolyForm-Noncommercial-1.0.0`). Permits use / modification / redistribution for non-commercial purposes (personal, research, education, charity, government non-commercial); commercial use requires a separate license from Skillbill.

### Changed
- `package.json#license` switched from `MIT` to `PolyForm-Noncommercial-1.0.0`. The previous declaration was orphaned — `MIT` was listed but no `LICENSE` file existed. R-0014 codifies the choice and the rationale.
- `package.json#files` now ships `README.md` and `LICENSE` so users who install AH via `pi install git:...` get both alongside `CLAUDE.md` and the rest.

### Migration
- No action required. Consumers that already track an AH install see the new license metadata at next `pi update`. Existing usage of AH inside consumer projects remains permitted — consumer projects are themselves the dev's work, not redistribution of AH.

## [0.17.1] — 2026-05-19

### Removed
- `node_modules/typebox` (a symlink to the original dev's local PI install — `/home/toto/.nvm/.../@earendil-works/pi-coding-agent/node_modules/typebox`) was committed in `4eba528` despite `.gitignore` correctly listing `node_modules/`. It must have been added with `git add -f`. Untracked with `git rm --cached`: the symlink is a broken pointer on any other machine and `typebox` is already declared as a `peerDependency` in `package.json` (PI provides it at runtime). The local symlink is kept on the original dev's machine for editor TS resolution; it just isn't versioned anymore.

### Migration
- No action required.

## [0.17.0] — 2026-05-19

### Added
- **(R-0013)** `lib/migrate-consumer.ts` now auto-commits `.pi/ah-version` after the migration loop when the working tree contains *only* that marker bump and the consumer is on `main` or `master`. Removes the paper cut where every `pi update` left a stray `modified: .pi/ah-version` for the dev to clean up at next session start. Commit message is hard-coded: `chore: bump AH consumer marker to vX.Y.Z`. No push — that remains the dev's call.

  Trivial-state gate (all must hold):
  1. Inside a git working tree (`git rev-parse --is-inside-work-tree`).
  2. Current branch is `main` or `master`.
  3. `git status --porcelain` returns exactly one line, and its path is `.pi/ah-version`.

  Any other state — feature branch, multiple dirty files, real migration touched other files — silently skips the auto-commit. The marker stays modified on disk so the dev can commit by hand exactly as before.
- Requirement **R-0013** in `REQUIREMENTS.md` and a matching carve-out note next to the R-0003 "no git mutations" invariant in `CLAUDE.md`.

### Migration
- No action required. The next `pi update` of AH followed by a `session_start` on `main` / `master` will auto-commit the marker bump.
- Working on a feature branch? The behavior is unchanged from v0.16.x: the marker shows as modified, you commit when you want.

## [0.16.2] — 2026-05-19

### Changed
- Stripped explicit references to a specific consumer project ("Efesto") from `lib/context-inspector.ts`, `REQUIREMENTS.md`, and earlier `CHANGELOG.md` entries (v0.8.1 migration note, v0.15.2 fix description). AH is a generic Pi Package and its source / docs / changelog must not name any one of the N possible consumer projects — pick "consumer project" / "consumers" wording instead. Historical GitHub Releases keep their original text (driven by the commit they were tagged from); only the in-tree CHANGELOG is normalized.

### Migration
- No action required.

## [0.16.1] — 2026-05-19

### Removed
- `task-layout.md` §2bis "CODEMAP.md — deprecated" block. Per-task `CODEMAP.md` was retired long ago in favor of the project-level codebase map in `.pi/codebase/`; the only mention left was this deprecation notice itself, with zero callers across prompts / skills / code. Git history keeps the archeology if it ever matters.

### Migration
- No action required.

## [0.16.0] — 2026-05-19

### Removed
- `/ah:map-codebase` slash command. The 1015-line prompt body never had standalone value for the dev — it was always invoked inline by `discuss` / `plan` / `execute` (cold-start bootstrap of `.pi/codebase/`) and by `/ah:task-done` (post-close refresh). Codified the new pattern as **R-0012**.

### Changed
- The codebase-map logic file moves from `prompts/map-codebase.md` to `procedures/map-codebase.md`. The auto-discovery loop in `extensions/index.ts` only scans `prompts/*.md`, so the move alone is enough to stop registering `/ah:map-codebase` as a command — no flag, no opt-out marker. The procedure stays referenced via `$EXT_DIR/procedures/map-codebase.md` by the four call sites:
  - `skills/ah-task-discuss/INSTRUCTIONS.md` step 2
  - `skills/ah-task-plan/INSTRUCTIONS.md` step 2
  - `skills/ah-task-execute/INSTRUCTIONS.md` step 1
  - `prompts/task-done.md` step 5
- `WORKFLOW.md` command table loses the `/ah:map-codebase` row; the "Codebase map" section is rewritten to describe the implicit trigger model and how to request a manual refresh in chat (no slash command).
- `CLAUDE.md` reference to `lib/codebase-cache.ts` now points at the procedure instead of the (former) command.
- `task-layout.md` updated in 4 places — section §2 intro, blocking-prerequisite paragraph, "Updating" bullets, and the commits table.
- `procedures/` is now an explicit category in AH's source tree (was declared in CLAUDE.md but empty until v0.16.0). Convention: any long body that one or more phases execute inline lives here; standalone slash commands live in `prompts/`.
- Requirement **R-0012** in `REQUIREMENTS.md`.

### Migration
- No consumer action required. After `pi update`:
  - `/ah:map-codebase` no longer appears in PI's slash command palette or in the `/ah:help` overlay.
  - The four task phases continue to (re)generate `.pi/codebase/` automatically.
  - Devs who used to type `/ah:map-codebase` manually should instead let the next `/ah:task-done` regenerate the map, or ask the agent in chat to "run the codebase-map procedure".

## [0.15.2] — 2026-05-19

### Fixed
- AH ↔ PI compatibility check fired a `[ah-pi-compat-warning]` banner at every session start when running on PI 0.75.x because `peerDependencies["@earendil-works/pi-coding-agent"]` was still `^0.74.0`, which under npm's pre-1.0 caret rule resolves to `>=0.74.0 <0.75.0` and excludes 0.75.x. All the v0.12.0+ features (`registerShortcut`, `ui.custom`, `pi.exec`) have been exercised against PI 0.75.3 in a consumer project with no API drift, so widening the range is safe. Bumped to `^0.75.0` (matches the current published PI line); the doc comment in `lib/check-pi-compat.ts` was updated to reflect the new pinning.

### Migration
- No action required. The warning banner disappears at next `pi update` of AH.
- If you're still on PI 0.74.x, stay on AH v0.15.1 (the matcher in `lib/check-pi-compat.ts` doesn't support compound ranges, and we chose `^0.75.0` over `>=0.74.0` to avoid falsely declaring future PI 1.0+ as compatible).

## [0.15.1] — 2026-05-19

### Fixed
- `alt+s` branch switcher crashed at ENTER with `Error: Could not check working tree: ctx.exec is not a function`. The handler called `ctx.exec(...)` but `exec` lives on `pi` (ExtensionAPI), not on the per-handler `ctx` (ExtensionContext). Easy to mix up because most other I/O surfaces (`ui`, `cwd`, `notify`) DO come through `ctx`. Switched the three call sites (`git branch --show-current`, `git status --porcelain`, `git checkout`) to `pi.exec(...)`, with a one-line reminder next to the first call so the trap is documented for the next contributor.

### Migration
- No action required.

## [0.15.0] — 2026-05-19

### Added
- **(R-0010)** `alt+s` keyboard shortcut: opens a selector popup with the default branch (`main`) plus every in-progress task whose `TASK.md` frontmatter exposes a `branch:`. `↑`/`↓` move the focus, `ENTER` runs the checkout, `ESC` cancels. The currently checked-out row is annotated `(current)` and selecting it is a no-op (toast only — no `git checkout`). On every other selection, AH first runs `git status --porcelain`: a non-empty output aborts the switch with a `⚠ Working tree not clean — commit or stash before switching` warning toast; an empty output proceeds with `git checkout <branch>` and a success toast on `code === 0`. Hot path is `lib/branch-switch-popup.ts` (selector component) + the `openSwitchPopup` handler in `extensions/index.ts` that wraps the git side-effects. This is a sanctioned exception to the Git Safety Rule: pressing `alt+s` + `ENTER` is the dev's explicit trigger, mirroring the convention used by `/ah:task-new` and `/ah:do-git-stuff`.
- **(R-0011)** Help-popup completeness contract — every keyboard shortcut AH registers MUST appear in the `shortcutRows` array rendered by `/ah:help` (and `alt+h`), in registration order. The handler that builds the list is the single source of truth; a brief comment next to it cross-references R-0011 so future contributors don't drift. PI doesn't expose a runtime enumeration of registered shortcuts, so this invariant is maintained by convention (and reviewed at merge time), not enforced by code.
- New `branch: string | null` field on `TaskInfo` returned by `lib/show-task.ts`, populated from the `branch:` frontmatter key (falls back to `null` for `"null"` / missing / empty values).

### Changed
- `/ah:help` and `alt+h` overlay now lists the new `alt+s` row in the Keyboard shortcuts section, with a comment in the source pointing back to R-0011.

### Migration
- No action required. Consumers gain the shortcut on next `pi update` + session restart.

## [0.14.1] — 2026-05-19

### Fixed
- Popup right border (`│`) was missing on lines that contained certain emoji (`✅`, `📋`, `📥`, `🆘`, etc.). Cause: `lib/popup-frame.ts` used `.length` (UTF-16 code units) for padding, but BMP emoji like `✅` (U+2705) are 1 code unit yet take 2 terminal columns. Padded lines therefore exceeded the overlay width by 1+ visible cols, and PI's overlay compositor (`pi-tui`'s `compositeLineAt`, which slices by `visibleWidth`) clipped the right border. Replaced with an emoji-aware `visibleWidth` implementation (`\p{Emoji_Presentation}` + non-BMP code points → 2 cols, everything else → 1 col). `clipToWidth` and `padRight` both honor visible width now, so emoji-heavy lines stay within the box and the `│`/`┘` are no longer cut.

### Migration
- No action required.

## [0.14.0] — 2026-05-19

### Added
- `alt+h` keyboard shortcut that opens the `/ah:help` overlay directly (same handler as the slash command). Listed inside the help popup itself for discoverability.

### Changed
- Both AH overlays (`/ah:help` and the three `alt+p`/`alt+k`/`alt+c` task popups) now render inside a Unicode-box border (`┌─┐ │ │ ├─┤ └─┘`) with a horizontal divider between header, body, and footer. New shared helper `lib/popup-frame.ts` (`renderBox` + `clipToWidth`) makes the chrome consistent across the two popup types.
- `/ah:help` layout reordered to match the natural read order: the version is now on the title line itself (`🆘 agentic-harness — help   vX.Y.Z`), the body begins with **Keyboard shortcuts**, then **Docs**, and the longer **Slash commands** list comes last. Previously the slash-command list appeared first and pushed the shortcuts off-screen on smaller terminals.
- `InfoPopup` API drops the separate `subtitle` field; callers fold the subtitle text into `title` when needed.

### Migration
- No action required.

## [0.13.0] — 2026-05-19

### Added
- **(R-0009)** `/ah:help` slash command. Opens a single-page TUI overlay with the installed AH version, the list of AH slash commands (discovered dynamically via `pi.getCommands()` and filtered by the `ah:` prefix so it stays in sync as prompts are added or removed), and the three keyboard shortcuts registered in v0.12.0. `ESC` closes. Unlike every other `/ah:*` command, `/ah:help` does **not** flow through `pi.sendUserMessage` — the handler is registered with `pi.registerCommand` and runs entirely locally, so opening help never burns an LLM turn.
- New TUI module `lib/info-popup.ts` (static read-only overlay; sibling of `lib/task-popup.ts`, no navigation — just title + body + ESC).
- Requirement **R-0009** in `REQUIREMENTS.md`.

### Changed
- `WORKFLOW.md` command table gains the `/ah:help` row.

### Migration
- No action required.

## [0.12.0] — 2026-05-19

### Added
- **(R-0008)** Three keyboard shortcuts that open a TUI popup viewer scoped to a single task bucket:
  - `alt+p` → tasks in `.pi/tasks/in-progress/` (sorted by id ascending).
  - `alt+k` → tasks in `.pi/tasks/backlog/` (sorted by `priority` descending, tie-break by id ascending — same order as `/ah:project-status`).
  - `alt+c` → tasks in `.pi/tasks/done/` (sorted by `updated` descending, tie-break by id descending).

  Inside the popup, `↑` / `↓` cycles through the bucket, `ESC` closes. The popup body shows the full `TASK.md` content (frontmatter + sections) truncated to ~30 lines; the relative path is displayed so the dev can `code <path>` or equivalent to read the rest. Empty buckets surface a `notify` toast instead of opening an empty popup.
- Documentation for the new shortcuts in `WORKFLOW.md` under "Keyboard shortcuts".
- Requirement **R-0008** in `REQUIREMENTS.md`.

### Changed
- New TUI module `lib/task-popup.ts` (the overlay Component, ~100 lines, no `@earendil-works/pi-tui` runtime imports — duck-types the Component interface and recognizes ESC / ↑ / ↓ via raw ANSI bytes to keep AH free of an extra peer dependency).
- New listing/sort helpers in `lib/show-task.ts` (`listBucketTasks`, `sortForBucket`, `parseTaskFrontmatter`) reused by the three shortcut handlers in `extensions/index.ts`.

### Migration
- No action required. Shortcuts are registered at session start; if a consumer is running on a PI version that lacks `pi.registerShortcut`, AH logs a single `console.warn` and the rest of the extension keeps working.

## [0.11.0] — 2026-05-19

### Removed
- `/ah:standup` slash command. The command was registered but unused in practice — `/ah:project-status` already covers the "what's the state of the project right now" need, and the standup-specific framing (async daily report) never picked up real usage. Deletes `prompts/standup.md` and the corresponding row in the `WORKFLOW.md` command table. Auto-discovery in `extensions/index.ts` reads the `prompts/` directory, so no code change is required to stop registering the command.

### Migration
- No action required. Devs who muscle-memorize `/ah:standup` will get a "command not found" from PI after `pi update`; use `/ah:project-status` instead.

## [0.10.1] — 2026-05-19

### Fixed
- `/ah:project-status` priority badge is now actually visible. v0.10.0 used a single-character column where `NORMAL` rendered as a blank space, which made the column appear empty in any project where most tasks are at the default — defeating the point of "show priority". Replaced with a fixed 4-character `[XY]` badge using `!!` (IMMEDIATE), `^ ` (HIGH), ` ·` (NORMAL), `v ` (LOW). Every level now has a visible glyph.

### Changed
- `/ah:project-status` priority badge is shown **only** in the `In progress` and `Backlog` sections. `In review` and `Recently closed` revert to the pre-v0.10.0 layout (no badge, no prefix column). Rationale: priority is most actionable while planning the next bit of work (backlog) and tracking what's open (in-progress); on review-pending and already-closed items the badge is mostly noise.

### Migration
- No action required.

## [0.10.0] — 2026-05-19

### Added
- **(R-0007)** Task `priority` frontmatter field on `TASK.md`. Coarse-grained urgency tag with exactly four levels — `LOW`, `NORMAL`, `HIGH`, `IMMEDIATE` (uppercase, case-sensitive). Default `NORMAL`. New tasks created via `/ah:task-new` get `priority: NORMAL` directly from `templates/task.md`; the interview does not ask for priority — the dev edits the field by hand when a task is more or less urgent than the default. Documented in `task-layout.md` §3.1.
- **(R-0007)** `/ah:project-status` now displays the priority of every task as a single-character marker placed in column 2 of the row prefix (`!` = IMMEDIATE, `^` = HIGH, ` ` = NORMAL, `v` = LOW). Column 1 remains the current-task marker (`▶`), so a row reads `<prefix><priority> T-NNN  …`. The 2-char prefix applies to every section (In progress, In review, Backlog, Recently closed) so columns line up.
- **(R-0007)** `Backlog` section in `/ah:project-status` is now sorted by `priority` descending (`IMMEDIATE → HIGH → NORMAL → LOW`), tie-break by `id` ascending. Other sections keep their existing order (in-progress / in-review / recently-closed are ordered by status, branch, and `updated` respectively).
- New consumer migration `lib/migrations/v0_10_0.ts` that walks `.pi/tasks/{backlog,in-progress,review,done}/T-*/TASK.md` and inserts `priority: NORMAL` into any frontmatter that lacks the field. Insertion point is right after the `status:` line, matching the order in `templates/task.md`. Idempotent (skips files that already declare any `priority:` value, regardless of which of the four levels) and non-destructive (does not normalize existing values — the dev owns that). One advisory `console.log` line at session_start when at least one task is touched.
- Requirement **R-0007** in `REQUIREMENTS.md`.

### Changed
- `templates/task.md` gains the `priority: NORMAL` line in the frontmatter (after `status:`). No placeholder — the value is always `NORMAL` on creation.
- `prompts/project-status.md` step 1 extracts `priority` in addition to the existing fields, normalizing missing / blank / unrecognized values to `NORMAL` (case-insensitive parse, uppercase output).

### Migration
- Auto-applied at the first `session_start` after upgrading to v0.10.0. Existing tasks (in any of the four buckets) get `priority: NORMAL` written explicitly into their `TASK.md` frontmatter. The migration is idempotent — re-running it on a tree where every task already has a priority value is a no-op. Future tasks created via `/ah:task-new` inherit `priority: NORMAL` from the template directly.
- Dev action: review the resulting `priority:` values and bump the urgent ones to `HIGH` or `IMMEDIATE` by hand (the migration does not guess — every legacy task starts at `NORMAL`).

## [0.9.2] — 2026-05-19

### Fixed
- Long filesystem-wide stalls during `/ah:task-new` (and other AH commands referencing `$EXT_DIR`) caused by the agent running `find /` to locate AH-internal templates instead of using the absolute path already substituted in the prompt body. `lib/register-prompt.ts` now prepends a short directive to every prompt that references `$EXT_DIR`, instructing the agent that AH-internal paths arrive pre-resolved as absolute paths and must be read directly (no `find` / `locate` / `grep -r`). The `/ah:task-new` step that loads `templates/task.md` is reinforced with the same instruction inline.

### Migration
- No action required.

## [0.9.1] — 2026-05-19

### Added
- `/ah:project-status` now renders a **"Recently closed"** section listing the last 5 tasks in `done/`, sorted by the `updated` frontmatter field in descending order (most recent first). Falls back to `created` if `updated` is missing; tasks with neither sink to the bottom. Each line shows ID, date (`YYYY-MM-DD` or `-`), truncated title, and `(assignee, estimate)`. Section is omitted when `done/` is empty.

### Changed
- Step 1 of `/ah:project-status` extracts `updated` from the TASK.md frontmatter in addition to the existing fields.

### Migration
- No action required.

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
- No action required from the dev. On the first `session_start` after upgrading to v0.8.1, AH writes `.pi/ah-config.json` if absent. Consumers that already committed the file are untouched. Consumers whose `.pi/codebase/*.md` were generated in Italian get `"contentLanguage": "it"` automatically and can simply `git add .pi/ah-config.json && git commit` to pin the choice.

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

[Unreleased]: https://github.com/Skillbill/agentic-harness/compare/v0.20.0...HEAD
[0.21.0]: https://github.com/Skillbill/agentic-harness/compare/v0.20.0...v0.21.0
[0.20.0]: https://github.com/Skillbill/agentic-harness/compare/v0.19.2...v0.20.0
[0.19.2]: https://github.com/Skillbill/agentic-harness/compare/v0.19.1...v0.19.2
[0.19.1]: https://github.com/Skillbill/agentic-harness/compare/v0.19.0...v0.19.1
[0.19.0]: https://github.com/Skillbill/agentic-harness/compare/v0.18.0...v0.19.0
[0.18.0]: https://github.com/Skillbill/agentic-harness/compare/v0.17.1...v0.18.0
[0.17.1]: https://github.com/Skillbill/agentic-harness/compare/v0.17.0...v0.17.1
[0.17.0]: https://github.com/Skillbill/agentic-harness/compare/v0.16.2...v0.17.0
[0.16.2]: https://github.com/Skillbill/agentic-harness/compare/v0.16.1...v0.16.2
[0.16.1]: https://github.com/Skillbill/agentic-harness/compare/v0.16.0...v0.16.1
[0.16.0]: https://github.com/Skillbill/agentic-harness/compare/v0.15.2...v0.16.0
[0.15.2]: https://github.com/Skillbill/agentic-harness/compare/v0.15.1...v0.15.2
[0.15.1]: https://github.com/Skillbill/agentic-harness/compare/v0.15.0...v0.15.1
[0.15.0]: https://github.com/Skillbill/agentic-harness/compare/v0.14.1...v0.15.0
[0.14.1]: https://github.com/Skillbill/agentic-harness/compare/v0.14.0...v0.14.1
[0.14.0]: https://github.com/Skillbill/agentic-harness/compare/v0.13.0...v0.14.0
[0.13.0]: https://github.com/Skillbill/agentic-harness/compare/v0.12.0...v0.13.0
[0.12.0]: https://github.com/Skillbill/agentic-harness/compare/v0.11.0...v0.12.0
[0.11.0]: https://github.com/Skillbill/agentic-harness/compare/v0.10.1...v0.11.0
[0.10.1]: https://github.com/Skillbill/agentic-harness/compare/v0.10.0...v0.10.1
[0.10.0]: https://github.com/Skillbill/agentic-harness/compare/v0.9.2...v0.10.0
[0.9.2]: https://github.com/Skillbill/agentic-harness/compare/v0.9.1...v0.9.2
[0.9.1]: https://github.com/Skillbill/agentic-harness/compare/v0.9.0...v0.9.1
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
