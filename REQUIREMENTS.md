# REQUIREMENTS — agentic-harness

This file is the rolling list of AH's product-level requirements. Each entry below is a self-contained `R-NNNN` — a single feature / capability of the extension, with rationale and decisions captured at the time it was introduced. R-NNNN ids are append-only and never recycled; declined requirements stay in place with a strikethrough and a `DECLINED in vX.Y.Z` marker (see R-0002).

> **Heads-up — do not confuse with the consumer-side file.** This is `REQUIREMENTS.md` *of the AH repo itself*, listing AH's own product requirements. The companion file `.pi/REQUIREMENTS.md`, created inside each **consumer** project (per R-0006 from v0.9.0), is a different document with the same shape but a different scope: it lists the *consumer project's* requirements (the things the dev is building **with** AH), not AH's own. Keep the two cleanly separated when editing.

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
- **Auto-creation (v0.8.1)**: when the file is **absent**, AH writes it at `session_start` so the language choice is always explicit and committable. The value comes from `detectConsumerLanguage`: if at least 3 distinct unambiguous Italian function words (`della`, `degli`, `perché`, `sono`, …) appear anywhere in the existing `.pi/codebase/*.md` content (excluding `INDEX.md`), the file is created with `"contentLanguage": "it"` — preserving the voice of legacy v0.7.x consumers whose docs were authored under the old implicit-Italian default. Otherwise (new consumers, empty `.pi/codebase/`, English-looking content) the file is created with `"contentLanguage": "en"`. The write is atomic (tmp + rename), never throws, and silent on failure beyond a single `console.warn`. Once the file exists, AH never overwrites it — a manual edit (or a commit with a different value) is the source of truth.
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

### R-0008 — Keyboard shortcuts for per-bucket task popup

Starting from v0.12.0, AH registers three keyboard shortcuts via PI's `pi.registerShortcut` API. Each opens a TUI overlay scoped to a single task bucket and lets the dev cycle through the bucket's tasks with `↑` / `↓` and dismiss with `ESC`. The popup body shows the full `TASK.md` (frontmatter + sections) truncated to ~30 lines, plus the relative file path.

**Decisions**:

- **Three shortcuts, one per bucket** (rather than a single picker over all tasks): keeps each popup focused on the slice the dev is reasoning about — current work, next pick-up, or recent closures. Matches the same mental model as the three sections in `/ah:project-status`.
  - `alt+p` → `in-progress/`, sorted by id ascending.
  - `alt+k` → `backlog/`, sorted by `priority` descending (IMMEDIATE → LOW) with id-ascending tie-break (mirrors `/ah:project-status` Backlog).
  - `alt+c` → `done/`, sorted by `updated` descending with id-descending tie-break (most recent closure first).
- **`alt+b` is deliberately not used** — PI already binds it (and `alt+left`, `ctrl+left`) to the "move back one word" editor command. `alt+k` was chosen as the next closest mnemonic for ba**c**k**l**og.
- **Body truncation**: hard cap of 30 content lines. Long bodies (typical for tasks with verbose `## Goal` or `## Definition of Done`) trigger a `… N more line(s) truncated — open <relPath> for full text` footer. Rationale: the popup is for the "fast glance" use case; full reading happens in an editor.
- **No runtime import of `@earendil-works/pi-tui`**: the popup component duck-types pi-tui's `Component` shape (`render` / `handleInput` / `invalidate`) and matches ESC / ↑ / ↓ from raw ANSI byte sequences. Avoids adding pi-tui to `peerDependencies` for a single overlay component. Side effect: only standard-mode escape sequences are recognized; Kitty CSI-u modifiers are out of scope (the three keys we care about all work in standard mode regardless).
- **Backward-compatibility on old PI**: `pi.registerShortcut` is called inside a `try/catch`. If the running PI is too old to support shortcut registration, AH logs a single `console.warn` and continues — the rest of the extension stays functional.
- **Empty bucket UX**: shortcut shows a `ctx.ui.notify("No tasks in .pi/tasks/<bucket>/", "info")` toast and does not open an empty popup.

**Consequences for the AH dev**:
- Don't break parity with `/ah:project-status` Backlog ordering: both use `sortForBucket` from `lib/show-task.ts`. Any change to the priority-rank function or tie-break rule must update both call sites consistently.
- When adding a fourth shortcut (or moving keys), pick from the alt+letter combinations not reserved by PI's editor / app keymaps (`alt+b`, `alt+d`, `alt+f`, `alt+y`, `alt+v`, `alt+up`, `alt+enter`, `alt+left`, `alt+right`, `alt+delete`, `alt+backspace` are all taken — see `core/keybindings.d.ts` in PI).
- The popup is a single-page renderer (no intra-task scroll). If the body cap becomes too restrictive in practice, the right move is a paged Component with `pageUp` / `pageDown` — not raising the cap, which would dwarf the chat area.

### R-0009 — `/ah:help` overlay

Starting from v0.13.0, AH ships a `/ah:help` slash command that opens a single-page TUI overlay with the installed AH version, the list of AH slash commands, and the keyboard shortcuts from R-0008. ESC closes.

**Decisions**:

- **Registered via `pi.registerCommand`, not via a prompt file**. The default registration path for `/ah:*` commands is the `prompts/*.md` loop in `extensions/index.ts`, which routes the body through `pi.sendUserMessage` so the LLM produces the response. `/ah:help` deliberately bypasses that — the popup is purely local (overlay + raw filesystem read of `package.json`) and never burns an LLM turn.
- **Command list is discovered, not hard-coded**. The handler calls `pi.getCommands().filter(c => c.name.startsWith("ah:"))` so the popup automatically reflects whatever set of prompts is currently registered (after `/ah:standup` was dropped in v0.11.0, after `/ah:help` itself was added in v0.13.0, etc.). The shortcut list, by contrast, is hard-coded — there is no public PI API to enumerate registered shortcuts.
- **Layout**: title (`🆘 agentic-harness — help`), subtitle (`vX.Y.Z`), separator, "Slash commands" section, blank line, "Keyboard shortcuts" section, blank line, docs link, separator, footer (`esc close`).
- **Reuse, not generalization**: a new `lib/info-popup.ts` Component sits next to `lib/task-popup.ts`. Both duck-type pi-tui's `Component` and recognize ESC from a raw ANSI byte. They share the `clipToWidth` helper conceptually but each owns its own copy — a real generalization (a `BasePopup` class) isn't justified by two call sites.
- **Fallback on missing UI**: if `ctx.hasUI` is false (RPC / print mode), the handler returns early after a `ctx.ui.notify` (when notify is available) instead of crashing.

**Consequences for the AH dev**:
- When you add or remove a `prompts/*.md` file, `/ah:help` updates on its own — no doc churn here.
- When you add a new keyboard shortcut in `extensions/index.ts`, also append a row to the hard-coded `shortcutRows` array in the `/ah:help` handler. Same applies if you change the key for an existing shortcut.
- Do not add LLM-bound content to the popup body (no `$@`, `$EXT_DIR`, or `pi.sendUserMessage` from inside the handler). The popup is meant to be cheap — a single overlay open / close cycle should not cost a token.

### R-0010 — `alt+s` branch switcher with clean-tree gate

Starting from v0.15.0, AH ships a keyboard shortcut `alt+s` that opens a selector popup listing the default branch (`main`) plus every in-progress task with a `branch:` field in its `TASK.md` frontmatter. The dev navigates with `↑` / `↓`, picks with `ENTER`, cancels with `ESC`. On selection AH runs `git checkout <branch>` — gated by a working-tree-clean check.

**Decisions**:

- **List composition**: the first row is always `main`, hard-coded for now (TBD: detect the consumer's actual default branch via `git symbolic-ref refs/remotes/origin/HEAD`). The rest are in-progress tasks (`.pi/tasks/in-progress/`) filtered by having a non-null `branch:` in frontmatter, sorted by id ascending — matches the order used by `/ah:project-status` and the `alt+p` popup.
- **Current branch annotation**: the row matching `git branch --show-current` is suffixed with `(current)`. Selecting it is a no-op — AH shows a `Already on <branch>` toast and skips the checkout. Rationale: avoids running `git checkout` on the branch we're already on, which is a no-op for git but a confusing UX.
- **Clean-tree gate**: before any `git checkout`, AH runs `git status --porcelain`. A non-empty stdout aborts the switch with a `⚠ Working tree not clean — commit or stash before switching` warning toast. The dev is expected to commit or stash and try again; AH does **not** offer to stash automatically (out of scope — git workflow is the dev's call).
- **Git Safety Rule exception**: the shortcut is an explicit dev-triggered mutation, same posture as `/ah:task-new` and `/ah:do-git-stuff`. The popup separates view (selection) from action (checkout): the component itself never touches git; only the shortcut handler does.
- **Error surfacing**: every git-side failure (status, checkout) is reported through `ctx.ui.notify(message, "error" | "warning")` — never thrown. AH stays alive and the popup is closed by the time we get there.
- **`branch: null` semantics**: a task whose frontmatter says `branch: null` (the default before `/ah:task-start`) is filtered out of the list — there's no branch to switch to. Same for `branch:` missing entirely.

**Consequences for the AH dev**:
- The component (`lib/branch-switch-popup.ts`) must remain side-effect-free: it owns the keyboard handling and the visual marker, nothing else. Adding git logic inside the component is a regression — keep it in the handler.
- When you add a new candidate source (e.g. `review/` task branches, recently-pushed remotes), update both the popup's list-building block in `extensions/index.ts` and the sort logic. Don't sneak `await` calls inside `render()` — the Component contract requires synchronous render.
- If you ever change the clean-tree definition (e.g. tolerate untracked-but-ignored files), centralize it in a `lib/git-status.ts` helper; right now the check is a one-liner inline because it has a single call site.

### R-0011 — Help popup is the single source of truth for shortcuts

Every keyboard shortcut AH registers via `pi.registerShortcut(...)` MUST be listed in the `shortcutRows` array rendered by the `/ah:help` (and `alt+h`) overlay. The rows in the popup are in registration order — same order the dev encounters the shortcuts in `extensions/index.ts`.

**Decisions**:

- **Hard-coded, not enumerated**: PI exposes no runtime API to enumerate registered shortcuts (`pi.getCommands()` only covers slash commands). The list lives next to the `pi.registerShortcut(...)` calls; a comment on both sides cross-references R-0011 so future contributors know to keep them in sync.
- **One-line format per row**: `  <key>   <emoji> <label>   (<hint>)`. The emoji mirrors the popup title's icon (📋, 📥, ✅, 🔀, 🆘) for visual continuity. Wide-char alignment is handled by `lib/popup-frame.ts` via the emoji-aware `visibleWidth` (R-0008 fix in v0.14.1).
- **Coverage scope**: shortcuts only. Slash commands continue to be discovered dynamically via `pi.getCommands()` in the same popup — that part is auto-maintained.
- **Enforcement**: convention + review. There's no test that diffs the registered set against `shortcutRows`. The cost of a missed entry is low (the dev's shortcut works but is invisible in `/ah:help`), so a runtime check isn't justified.

**Consequences for the AH dev**:
- When you add or rename a shortcut: edit the `pi.registerShortcut(...)` call AND the corresponding `shortcutRows` line in the same commit. The two changes belong together — a commit that splits them is a bug bait.
- When you remove a shortcut: delete both lines. Leaving a stale row in `shortcutRows` lies to the user.
- If a new PR adds a shortcut without touching `shortcutRows`, the right reviewer comment is "missing R-0011 entry in `/ah:help`" — pointing at this requirement makes the fix obvious.

### R-0012 — Codebase map as internal procedure, not a slash command

Starting from v0.16.0, the codebase-map logic lives in `procedures/map-codebase.md` and is **not** exposed as the `/ah:map-codebase` slash command anymore. The 1015-line procedure is referenced via `$EXT_DIR/procedures/map-codebase.md` by every consumer that needs to (re)generate `.pi/codebase/`.

**Decisions**:

- **No auto-registration**: `extensions/index.ts` scans `prompts/*.md` for slash-command registration. By moving the file to `procedures/` we make AH's "is this a command?" decision a function of *location*, not of a frontmatter flag — there's nothing to remember, no opt-in/opt-out marker that can be forgotten.
- **`procedures/` is for inline sub-procedures**: this directory was already listed in `CLAUDE.md` as a sibling of `templates/` referenced by prompts/skills via `$EXT_DIR`, but it was empty. R-0012 establishes the convention: anything that is *executed inline by another phase* (1+ caller, no standalone user value) belongs in `procedures/`; anything *the dev types directly* belongs in `prompts/`.
- **Four call sites, one source**: `skills/ah-task-discuss`, `skills/ah-task-plan`, `skills/ah-task-execute`, and `prompts/task-done.md` all read `$EXT_DIR/procedures/map-codebase.md` and execute its steps 2–5. The dev never types the command — they hit `/ah:task-discuss` (or similar), and if `.pi/codebase/` is missing the phase proposes running the procedure inline.
- **Manual refresh path**: if a dev wants to regenerate the map outside the task cycle, they ask the agent in chat ("run the codebase-map procedure" or similar). AH reads the procedure file and runs it. No slash command, no shortcut — chat is the only entry.
- **Why not a frontmatter `internal: true` flag**: the alternative was to keep the file in `prompts/` and filter it out of the auto-discovery loop based on a frontmatter marker. Rejected because: (a) it'd add a one-off code path in `register-prompt.ts` for a single file, (b) prompts and procedures have different *audiences* (dev vs. agent), and a folder separation makes that explicit, (c) the existing `procedures/` directory was already declared in `CLAUDE.md` waiting for content.

**Consequences for the AH dev**:
- When you introduce a new long sub-procedure that other phases reference (security audit, dependency scan, license check, …), drop it in `procedures/` from day one. Do not put it in `prompts/` then refactor.
- When you edit `procedures/map-codebase.md` and renumber the steps, search-and-update the four `steps 2–5` references in the consumers (`grep -rn "procedures/map-codebase" --include='*.md'`). The references are step-number-coupled — splitting that coupling would mean changing the procedure layout.
- Do not silently re-introduce `/ah:map-codebase` as a slash command. If a future requirement says "the dev wants a one-line manual refresh", prefer a different name (e.g. `/ah:refresh-codebase`) that's a *wrapper* whose body is `read $EXT_DIR/procedures/map-codebase.md and run it`. Keeps the procedure file the single source of truth and the slash command minimal.

### R-0013 — Auto-commit of `.pi/ah-version` marker bump (sanctioned Git Safety exception)

Starting from v0.17.0, when the consumer migration framework (R-0003) advances `<consumerRoot>/.pi/ah-version` and the resulting working-tree change is *only* that marker bump, AH stages and commits the file on the consumer's behalf. Without this exception every `pi update` produced a stray modification the dev had to clean up by hand at next session start — a paper cut the user explicitly asked us to fix.

**Decisions**:

- **Trivial-state gate, not policy switch**: the auto-commit fires only when *all* of these hold (parallel check in `autoCommitMarkerBump`):
  1. The consumer is inside a git working tree (`git rev-parse --is-inside-work-tree`).
  2. The current branch is `main` or `master`. Feature branches are deliberately excluded — committing the marker bump on a feature branch pulls AH's housekeeping into that feature's history and produces a merge conflict when the feature lands.
  3. `git status --porcelain` returns *exactly one* line, and its path is `.pi/ah-version`. Any other state (multiple files, different path) means a real migration touched the tree (e.g. v0.10.0 retrofitting `priority:` into every `TASK.md`) or the dev has work in progress — both demand human review.
- **Single commit shape**: `chore: bump AH consumer marker to vX.Y.Z`. Hard-coded message, no `Co-Authored-By:` trailer. Versioned identically to the installed AH version so `git log --grep "consumer marker"` is a clean audit trail.
- **No push**: the dev keeps push authority. Auto-commit is local-only.
- **Never throws, always non-blocking**: every git failure (no git on `$PATH`, non-zero exit, detached HEAD, hook failure, pre-commit reject) is downgraded to a single `console.warn` and session start continues. The marker file remains modified on disk so the dev can still commit it manually.
- **Branch detection is best-effort**: we accept `main` *and* `master` to cover the two near-universal defaults without paying the round-trip to `git symbolic-ref refs/remotes/origin/HEAD` (which also requires a remote). Consumers with a custom default branch fall back to the v0.16.x behavior (manual commit) — they can rename to `main` if they want the auto-commit. This is a deliberate trade-off: covers ~99% of real consumers, zero latency, zero remote chatter.
- **Explicit exception, not policy reversal**: R-0003 still says "no git mutations from consumer migrations". R-0013 carves out *one* surgical case — the marker file written by the framework itself. Real migrations (`lib/migrations/v*.ts`) keep the original prohibition; they may touch consumer files but never call `git`. Same exception model used by `/ah:task-new` (auto-commit of the new TASK.md).

**Consequences for the AH dev**:
- Do not weaken the trivial-state gate to cover "messy but the marker is in there somewhere" cases. The single-file check is the only thing that prevents AH from accidentally committing a dev's WIP. A dirty-tree auto-commit would turn into the worst kind of footgun (lost diffs, stray commits, unhappy users).
- A future migration that legitimately wants to commit something must declare its own exception — do **not** reuse this auto-commit path. It's scoped to the marker only.
- When you add a new migration `vX.Y.Z` that touches consumer files (rename, frontmatter retrofit, etc.), expect the gate to *not* fire on that update: the working tree will contain `.pi/ah-version` *plus* the files the migration changed. The dev sees both, reviews, commits together. This is by design.
- If the consumer's default branch is anything other than `main` / `master` (`develop`, `trunk`, …) the auto-commit silently skips. That's intentional — adding more defaults to the allowlist is a one-line edit when a real consumer asks for it. Don't widen speculatively.

### R-0014 — Source-available distribution under PolyForm Noncommercial 1.0.0

Starting from v0.18.0, AH ships with a `LICENSE` file containing the full text of [PolyForm Noncommercial 1.0.0](https://polyformproject.org/licenses/noncommercial/1.0.0) and `package.json#license` set to the SPDX identifier `PolyForm-Noncommercial-1.0.0`. Until v0.17.x the `package.json` declared `MIT` without a matching `LICENSE` file — an orphan declaration.

**Decisions**:

- **PolyForm Noncommercial 1.0.0, not MIT / Apache / GPL**: the intent expressed by Skillbill is "anyone can use and modify AH unless they make money from it". That intent does not match any OSI-approved license (the OSI definition requires unrestricted commercial use). PolyForm Noncommercial is the modern, software-tailored, lawyer-drafted (Heather Meeker et al., 2020) license that says exactly this. SPDX-recognized.
- **Not Creative Commons BY-NC**: CC explicitly recommends against using its licenses for software. PolyForm is the software-specific analog.
- **Not "Commons Clause" rider** on top of a permissive license: that pattern (used historically by Redis, MongoDB) is now considered convoluted and legally murky compared to a single-document license like PolyForm.
- **Not BUSL** (Business Source License): BUSL allows commercial use except for a specific competing-product carve-out and converts to OSI-licensed after a delay. Heavier than what's needed here, and changes shape over time.
- **No automatic conversion to permissive after N years**: AH stays PolyForm-NC indefinitely. If/when the policy changes, a new release with a different `LICENSE` is the migration path — `git log` keeps the historical license attached to historical tags.
- **Skillbill internal use is unaffected**: the licensor (Skillbill) holds the copyright and the license restricts *licensees*, not the licensor. Skillbill's internal commercial use of AH is implicit and unrestricted.
- **"Use" of AH inside a consumer project is non-commercial use of AH, not commercial**: a paid developer running AH against a commercial codebase is using AH as a *tool* (the same way they'd use VS Code or an OS), not redistributing or selling AH. PolyForm Noncommercial covers that case via the "noncommercial purpose" + "fair use" sections. Distribution / resale of AH as a paid product is the case that requires a separate commercial license.

**Consequences for the AH dev**:
- Source files / docs may carry SPDX headers if added later, but the canonical statement is `package.json#license` + `LICENSE` at repo root. Don't add per-file copyright headers retroactively — they age badly.
- When merging external contributions: the contributor agrees, by submitting, that their changes are licensed back to Skillbill under PolyForm Noncommercial (documented in `README.md` Contributing section). No CLA file required for now; revisit if/when contribution volume justifies one.
- Changing license at a future release is a significant decision — it would warrant a major bump (e.g. `v1.0.0` → `v2.0.0` with a different `LICENSE`). Old releases keep their original license attached to their git tag.
- `README.md` carries a one-paragraph plain-English summary of the license so a casual visitor doesn't have to parse the legal text. Keep that summary truthful — if you change the license, change the README in the same commit.

### R-0015 — Project-status progress derived from inner-cycle artifacts, not from the `progress:` frontmatter

Starting from v0.19.0, `/ah:project-status` computes the per-task percentage and inner-cycle phase the same way for **every** task in `in-progress/` — current task and others. The numbers come from inspecting `PLAN.md` + `steps/NN-*.md` (with their frontmatter `status:` field) and the presence of `DISCUSS.md` / `VERIFY.md`. The `progress:` frontmatter field on `TASK.md` is no longer the source of truth — it remains as a last-resort fallback when no artifacts at all can be reached.

**Why this change**:

- The `progress:` field was a dead letter. A `grep -rn "progress:" skills/ prompts/` across the AH source shows that **no phase writes it incrementally** — only `pr-open` and `task-done` set it to `100`. So every in-progress task that wasn't the current one rendered as `0%` until it reached PR. The deeper the task, the more the bar lied.
- Inner-cycle artifacts already carry the right signal: each `steps/NN-*.md` has a `status: todo | doing | done | blocked | failed` field that the agent is supposed to bump as it works through them. Reading those gives an honest `done/total` ratio per task without any new write path.

**Decisions**:

- **Single computation path for all in-progress tasks**: drops the v0.18.x branch that treated "current task" differently. Same logic everywhere. Avoids the surprise where T-019 with 1/8 steps done renders as `[execute 1/8]` from inside its branch but as `0% [-]` from `main`.
- **Artifact source resolution order**: (a) on-disk files if the feature branch is currently checked out, (b) `git show <branch>:<path>` on the local branch otherwise, (c) `git show origin/<branch>:<path>` if the local branch is missing, (d) fall back to the on-disk file under the task dir as a last resort. Mirrors the existing TASK.md resolution flow from step 1 of the prompt.
- **New phase indicator `[no plan]`**: when the task dir contains only `TASK.md` (no `DISCUSS.md`, no `PLAN.md`, no `steps/`), surface "task started but inner cycle bypassed" explicitly. Catches the case where `/ah:task-start` was run and then the dev did freeform implementation commits without `task-discuss` / `task-plan` / `task-execute`. The bar stays at 0% — honest, because AH has no plan to measure against.
- **Fallback `[?]`**: when even artifacts can't be loaded (branch missing locally and on origin, disk only has `TASK.md`, `progress:` is null), show `[?]` to signal "cannot determine". Different from `[no plan]`: `[no plan]` is a known state (the dev bypassed the cycle), `[?]` is an unknown state (the data is unreachable from this checkout).
- **DoD checkboxes no longer drive `pct`**: in v0.18.x the current task's percentage came from `## Definition of Done` checkbox count. That metric conflates "ready to close" (DoD) with "how far into execute" (steps). The new logic puts each in its own lane — `pct` = step progress, DoD readiness becomes visible only through the `verify` phase appearing.
- **No write side-effects**: `task-execute` is **not** changed to update `progress:` after each step. Side-effecting `TASK.md`'s frontmatter every commit would create merge-conflict noise on long-running tasks. Computing at read time keeps the file boring.

**Consequences for the AH dev**:

- The `progress:` frontmatter key now has a single legitimate writer set: `pr-open` (→ `100`) and `task-done` (→ `100`). If you ever consider writing it from another phase, prefer extending the read-time computation in `project-status.md` instead. The field is kept (with its two writers) only as the documented fallback when artifacts can't be reached.
- Step files **must** carry a `status:` line per `task-layout.md` §3.4. AH's plan templates already enforce this; if you add new step authoring paths, mirror the contract.
- The `[no plan]` indicator is informational — `/ah:project-status` doesn't gate or warn on it. If you want to enforce "tasks must follow the inner cycle", add a separate `/ah:audit` command; don't bolt enforcement onto the status renderer.

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
- **v0.8.1**: extends R-0005 — AH auto-creates `.pi/ah-config.json` at `session_start` when missing, with a `contentLanguage` chosen by `detectConsumerLanguage` (Italian if existing `.pi/codebase/*.md` content looks Italian — rescues legacy v0.7.x consumers; English otherwise). Makes the language choice explicit and committable instead of relying on a silent in-memory default.
- **v0.9.0**: introduces R-0006 — consumer-side `.pi/REQUIREMENTS.md`. New `templates/REQUIREMENTS.md` skeleton, consumer migration `lib/migrations/v0_9_0.ts` that drops an empty file on first session after upgrade, new `implements:` frontmatter key on `TASK.md`, and integration into `/ah:task-new` (step 2-bis), `/ah:task-discuss` (step 3-bis + 7.5), `/ah:task-plan` (§3-bis read-only), and `/ah:task-verify` (Requirements DoD subsection). `/ah:task-execute` is deliberately unchanged. No new slash command — requirements grow organically.
- **v0.9.1**: small UX tweak to `/ah:project-status` — adds a `Recently closed` section showing the last 5 tasks in `done/` sorted by `updated` desc. No new requirement.
- **v0.9.2**: defensive fix to `lib/register-prompt.ts` — prepends a short directive to any prompt body that references `$EXT_DIR` instructing the agent that AH-internal paths arrive pre-resolved as absolute paths and must be read directly (no `find` / `locate` / `grep -r`). Caps a long stall observed in `/ah:task-new` where some agents scanned the entire filesystem to "locate" the template. No new requirement.
- **v0.10.0**: introduces R-0007 — `priority` field on `TASK.md` frontmatter (`LOW | NORMAL | HIGH | IMMEDIATE`, default `NORMAL`). `/ah:project-status` renders the priority marker for every task and sorts the Backlog by priority desc. Consumer migration `lib/migrations/v0_10_0.ts` retrofits the field as `NORMAL` on every legacy task in the four task buckets.
- **v0.10.1**: visibility fix for the priority badge — uses a fixed 4-char `[XY]` token (`!!`/`^ `/` ·`/`v `) instead of a single-character column where NORMAL rendered as blank space. Limited to the `In progress` and `Backlog` sections of `/ah:project-status`.
- **v0.11.0**: drops the unused `/ah:standup` slash command. `/ah:project-status` covers the same use case.
- **v0.12.0**: introduces R-0008 — three keyboard shortcuts (`alt+p`, `alt+k`, `alt+c`) that open a TUI overlay listing the tasks of a single bucket. New `lib/show-task.ts` listing/sort helpers and `lib/task-popup.ts` overlay component. No consumer migration.
- **v0.13.0**: introduces R-0009 — `/ah:help` slash command that opens a single-page overlay (`lib/info-popup.ts`) showing the AH version, the AH command list (discovered dynamically), and the shortcut list from R-0008. Registered via `pi.registerCommand` so it never burns an LLM turn.
- **v0.14.0**: bordered popups (`lib/popup-frame.ts`), reordered `/ah:help` body, new `alt+h` shortcut. No new requirement — purely visual / additive.
- **v0.14.1**: emoji-aware width fix in `lib/popup-frame.ts` (closes the right border of the box on lines containing wide BMP emoji like `✅`).
- **v0.15.0**: introduces R-0010 (`alt+s` branch switcher + clean-tree gate) and R-0011 (help popup is the single source of truth for shortcuts). New `lib/branch-switch-popup.ts`; `TaskInfo` grows a `branch` field populated from frontmatter.
- **v0.15.1**: fixes `alt+s` runtime crash — `exec` lives on `pi` (ExtensionAPI), not on `ctx` (ExtensionContext). Three call sites in `extensions/index.ts` switched from `ctx.exec` to `pi.exec`.
- **v0.15.2**: bumps `peerDependencies["@earendil-works/pi-coding-agent"]` from `^0.74.0` to `^0.75.0` to silence the compat warning on PI 0.75.x. No API drift observed between 0.74 and 0.75 for the surfaces AH uses.
- **v0.16.0**: introduces R-0012 — codebase-map logic moves from `prompts/map-codebase.md` (auto-registered as `/ah:map-codebase`) to `procedures/map-codebase.md` (inline sub-procedure referenced via `$EXT_DIR`). Drops the slash command. Four consumers updated to read the new path. No consumer migration.
- **v0.16.1**: drops the obsolete `CODEMAP.md — deprecated` block from `task-layout.md`. Single-line deprecation notice with no remaining callers anywhere in the repo — git history keeps the archeology.
- **v0.16.2**: scrubs explicit consumer-project names ("Efesto") from `lib/context-inspector.ts`, `REQUIREMENTS.md`, and earlier `CHANGELOG.md` entries. AH is a generic Pi Package; source and docs must not name any one of the N possible consumers.
- **v0.17.0**: introduces R-0013 — `lib/migrate-consumer.ts` auto-commits `.pi/ah-version` when the marker bump is the only thing dirty and the consumer is on `main` / `master`. Removes the paper cut where every `pi update` left a stray modification at session start.
- **v0.17.1**: untracks a stray `node_modules/typebox` symlink (committed in `4eba528` against `.gitignore`, pointed at an absolute path on the original dev's machine — broken for everyone else). `typebox` is already a `peerDependency` provided by PI.
- **v0.18.0**: introduces R-0014 — ships first `LICENSE` (PolyForm Noncommercial 1.0.0) and first `README.md`. `package.json#license` switches from the orphan `MIT` declaration to `PolyForm-Noncommercial-1.0.0`. AH becomes source-available rather than orphan-MIT.
- **v0.19.0**: introduces R-0015 — `/ah:project-status` derives the in-progress `pct` and phase from `PLAN.md` + `steps/NN-*.md` (`status:` field), the same way for every in-progress task, dropping the v0.18.x split between "current task" and "others". The `progress:` frontmatter is no longer the source of truth — it stays as a last-resort fallback. New phase indicator `[no plan]` for tasks where `task-start` ran but the inner cycle was bypassed.
