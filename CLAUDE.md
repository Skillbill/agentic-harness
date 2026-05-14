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

`extensions/index.ts` is the single entry point (per the convention path declared in `package.json#pi.extensions`). Its `default export` receives `pi: ExtensionAPI` and wires four categories of behavior:

1. **Commands** — every `.md` file under `prompts/` becomes a slash command `/ah:<basename>`. `lib/register-prompt.ts` parses the file's YAML frontmatter (`description`, `argument-hint`), substitutes `$@`, `$1`, and `$EXT_DIR` in the body, then calls `pi.sendUserMessage` so the prompt body runs as if the user typed it. The body **is** the spec for the command — there is no separate handler logic. `$EXT_DIR` resolves to the **repo root** (`dirname(__dirname)` of `extensions/index.ts`), not to `extensions/` itself — prompts use it to locate sibling dirs like `prompts/`, `skills/`, `templates/`.

2. **Tools** — `lib/load-codebase-doc.ts` registers `load_codebase_doc({ name })`, a path-safe reader scoped to `.pi/codebase/*.md`. The `^[a-zA-Z0-9_-]+$` name regex and the `resolve()` + prefix check together prevent traversal; this contract is mirrored (duplicated, deliberately — see comment in `lib/context-inspector.ts`) in the inspector module. **Do not** loosen it.

3. **Context injection** — two `before_agent_start` handlers run per LLM turn. The first injects `.pi/codebase/INDEX.md` (or builds an equivalent index via `lib/codebase-index.ts` if INDEX.md is missing) **once per session**, cached in closure. The second re-detects the current task on every turn (so branch switches are picked up mid-session) and injects a `current-task-context` block with the `TASK.md` frontmatter. Both messages use `display: false` — they're invisible to the user but consume tokens; see the dated note in `extensions/index.ts` for the rationale on what was *removed* from this injection.

4. **OTA update** — a `session_start` handler with `event.reason === "startup"` guard fires `lib/ota-update.ts:maybeProposeUpdate` as **fire-and-forget**. It queries GitHub Releases (`https://api.github.com/repos/Skillbill/agentic-harness/releases/latest`) with a 6h TTL cache under `~/.pi/agent/.cache/agentic-harness-ota.json`, and on a newer version asks `ctx.ui.confirm(...)`. On accept it runs `pi update --extension <spec>` via `execFile` (with `-l` if the install was project-local) and calls `ctx.reload()` (terminal — no code after). Behaviour is driven by `lib/install-info.ts:detectInstallInfo`, which reads PI settings (`.pi/settings.json` for project-local, `~/.pi/agent/settings.json` for global) and returns `{ scope, pinned, source }`: **pinned installs skip the prompt entirely** (because `pi update` would skip them per PI docs), and the exact source spec from settings is reused when running `pi update`. Any network / exec / parsing error is silenced — the check is best-effort and must never block startup. See R-0002 in `REQUIREMENTS.md`.

`lib/context-inspector.ts` is a self-contained observability module: it taps `before_provider_request` / `after_provider_response` / `message_end` and writes per-session NDJSON logs under `.pi/context-inspector/<timestamp>_<sid>/`. It must remain non-mutating — its provider-request handler always returns `undefined`.

`lib/codebase-cache.ts` defines the **doc → file-pattern map** used by `/ah:map-codebase` to decide which of the 7 thematic codebase docs (`STACK`, `INTEGRAZIONI`, `ARCHITETTURA`, `STRUTTURA`, `CONVENZIONI`, `TESTING`, `CRITICITA`) is stale after a diff. Two entries are "special": `STRUTTURA.md` regenerates on any add/delete (topology trigger), and `CRITICITA.md` is broad with a content filter for TODO/FIXME markers. Editing `PATTERN_MAP` directly changes what map-codebase regenerates incrementally.

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
  version.ts            — reads version from package.json
  ota-update.ts         — OTA check + reload (R-0002)
  install-info.ts       — detect PI install scope/pinning from settings
prompts/*.md            — registered as /ah:* commands
skills/ah-task-*/INSTRUCTIONS.md — inner-cycle skills
templates/, procedures/ — referenced by prompts via $EXT_DIR
```

## How to release a new version

1. Bump `version` in `package.json` (semver).
2. Commit + push to `main`.
3. Create an **annotated git tag** `vX.Y.Z` and a corresponding **GitHub Release** (not a draft) on `Skillbill/agentic-harness`. The OTA check queries `/releases/latest` so the release **must be published** to be detected.
4. Users on unpinned installs get prompted on next pi startup. Users on pinned installs (`@vX.Y.Z`) **never see the prompt** — AH detects pinning from PI settings and stays silent, since `pi update` would skip them. To upgrade a pinned install, re-`pi install` with the new ref.

## Install scopes (global vs project-local)

AH can be installed in two scopes; the OTA flow adapts to either:

- **Global** (`pi install git:github.com/Skillbill/agentic-harness`) — written to `~/.pi/agent/settings.json`. OTA runs `pi update --extension <spec>`.
- **Project-local** (`pi install -l git:github.com/Skillbill/agentic-harness`) — written to `<cwd>/.pi/settings.json` (committable, shared with team). OTA runs `pi update --extension <spec> -l` so the project entry is the one refreshed.

The detection is automatic: `lib/install-info.ts:detectInstallInfo` reads project settings first (PI rule: project wins on conflict), then global. If neither contains an entry referencing AH (by repo path fragment or by resolved local path == `repoRoot`), the OTA stays silent — there is nothing to update.

Known limitation (v1): if a user is on an unpinned git install and `HEAD` of `main` is ahead of the latest tagged release, the OTA prompt may still appear because the comparison is `tag_name` vs `package.json#version` of the installed snapshot.

## Authoritative contracts — read before changing prompts

- **`WORKFLOW.md`** — task lifecycle (`backlog → in-progress → review → done`), branch/commit conventions, the full `/ah:*` command table, and the Git Safety Rule.
- **`task-layout.md`** — directory layout of a task (`T-NNN-slug/` with `TASK.md` + optional `DISCUSS.md`, `PLAN.md`, `steps/NN-*.md`, `VERIFY.md`), the `discuss → plan → execute → verify` inner cycle contract, and the `context-needed:` frontmatter spec for `PLAN.md` (YAML list of bare stems, regex `^[a-zA-Z0-9_-]+$`, empty list `[]` is legal and meaningful).

If you change either of these, the prompts under `prompts/` and the skills under `skills/` likely need matching updates — they reference these contracts by behavior, not by import.

## 🔒 Git Safety Rule (load-bearing, non-negotiable)

The agent **never** runs git commands that mutate state (`add`, `commit`, `push`, `checkout -b`, `merge`, `rebase`, `reset`, `gh pr create`, …). Read-only commands (`status`, `log`, `diff`, `branch --show-current`, `remote -v`) are always fine. When a task needs a state-changing command, **propose it to the dev** as text — do not execute it. All prompts under `prompts/` follow this rule.

The **only** declared exception is `/ah:task-new` (`prompts/task-new.md:17-39`): it may run `git add` / `commit` / `push` for exactly the one new `TASK.md` file in the backlog, only on `main`, only with a mirror-checked porcelain status. Do not extend this exception to other commands without an equivalent declared block.

If the dev explicitly says "committa tu" / "push it", that's a per-invocation override and is allowed.

## Inner-cycle skills

`skills/ah-task-{discuss,plan,execute,verify,pr-open}` mirror the inner-cycle phases. They are invoked indirectly: the dev runs `/ah:task-next-step`, which auto-detects the task from the branch (`feature/T-NNN-*`) and advances one phase. Key invariants enforced by the prompts:

- **One step = one commit** during `execute`. `/ah:task-next-step` must stop after a single step — never chain.
- **`.pi/codebase/` is a blocking prerequisite** for discuss/plan/execute. If missing, propose generating it inline via the map-codebase logic; if the dev refuses, halt the phase.
- **`PLAN.md` is the authority** for what codebase docs get loaded: only docs listed in its `context-needed:` frontmatter, loaded via `load_codebase_doc`. Empty list means "no codebase context for this task" — that is correct, not a bug.
- **DoD in `VERIFY.md` is advisory**, not a gate.
- **Step files are never deleted on replan** — they move to `steps/archive/`.

## Conventions when editing this repo

- Prompts under `prompts/` and `skills/` are in **Italian**. Match the existing voice when editing them; new prompts should also be in Italian unless the user requests otherwise.
- Commit message format for AH itself follows the same `feat(T-NNN/NN): …` / `chore(T-NNN): …` patterns documented in `task-layout.md:373-381` when you're operating inside the task cycle. For ad-hoc commits to this extension's own code, no specific format is enforced.
- `.pi/codebase/.cache.json` is gitignored; the 7 thematic docs under `.pi/codebase/` are versioned in the consumer project, not here.
