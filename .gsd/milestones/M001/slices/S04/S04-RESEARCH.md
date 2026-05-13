# S04: Report fine-task "Context audit" in VERIFY.md — Research

**Date:** 2026-05-12

## Summary

S04 is the consumer slice that closes M001: it must render the persisted per-task `ContextAudit` (produced by S03) into the `## Context audit` section of `VERIFY.md` so a dev (and the next agent) can read declared-vs-loaded + delta_token + label at a glance after `/ah:task-verify` runs.

All upstream pieces already exist on disk: S03 writes `<session>/tasks/<T-NNN>/context-audit.json` on every `tool_result` and mirrors a serialized copy into `summary.json.context[<taskId>]`. The shape (`taskId, declared, declaredBudgetTokens, loaded, loadedTokens, deltaToken, label, errors`) is stable and tested. What is missing is (a) a deterministic way to **locate** the right audit JSON for the current task, (b) a **pure render** function `ContextAudit → markdown block`, and (c) a small **wire change in `skills/ah-task-verify/INSTRUCTIONS.md`** so the verify run materialises a `## Context audit` section in `VERIFY.md` next to the existing `## Verify Log`.

Recommendation: keep the rendering as a pure, side-effect-free function inside `context-audit.ts` (typebox-free, like the rest of the S03 accumulator) and expose it via a thin `ah:ctx-audit <T-NNN>` pi command in `context-inspector.ts` that returns the rendered markdown. The verify skill then either invokes the command or directly reads the JSON + calls the same render via a tiny script. Either way the heuristics live in one place and stay unit-testable.

## Recommendation

**Three-task slice. Pure core → thin command → skill wiring. Same pattern S03 used (and validated).**

1. **T01 — Pure renderer + unit tests.** Add `renderContextAuditMarkdown(audit: ContextAudit | null, opts?: { now?: string }): string` to `context-audit.ts` (with the `.js` sibling that S03 introduced for specifier resolution under `--experimental-strip-types`). Renders all five labels, the "no audit available" fallback, the `errors` block when non-empty, and a one-line synthesis ("on-budget" / "over-load" / "under-load" / "divergent" / "no declaration"). Unit-test in `tests/s04-context-audit-render.test.mts` with one test per label + edge cases (empty `loaded`, errors-only, null audit).
2. **T02 — Locator + pi command.** Add `findLatestAuditForTask(cwd: string, taskId: string): string | null` (helper in `context-inspector.ts`) that scans `.pi/context-inspector/*/tasks/<taskId>/context-audit.json`, picks the most recent session by directory mtime, and returns the path. Register `ah:ctx-audit <taskId>` that loads + renders + emits the markdown via `ctx.ui.notify`. Integration test under `tests/s04-ctx-audit-cmd.test.mts` mirrors the S03 wire test (mock pi, tmp session dir, drive a tool_call/tool_result, then assert command output).
3. **T03 — Verify skill wiring.** Update `skills/ah-task-verify/INSTRUCTIONS.md`:
   - Add **§2.5 "Context audit (sezione)"** describing the new section.
   - Add a new **step 6.5** between "Scrivi il log della run" (step 6) and "Mostra il report al dev" (step 7): "Materializza/aggiorna la sezione `## Context audit`" — fetch the rendered block via `ah:ctx-audit <T-NNN>` (or read the JSON directly and inline), insert/replace under `## Context audit` in `VERIFY.md`. On the first run (`§2a`) include the `## Context audit` heading in the initial skeleton; on subsequent runs (`§2b`) replace the section body, not append.
   - Keep the existing `git add` mirror invariant: the only path that changes is still `.pi/tasks/in-progress/<ID>-<slug>/VERIFY.md`.

This is the minimal end-to-end path that satisfies S04's after-condition without introducing parser fragility or a new artifact format. All decision points are local to `context-audit.ts` (pure) or `context-inspector.ts` (already the Inspector home). The skill INSTRUCTIONS.md change is text-only.

## Implementation Landscape

### Key Files

- `context-audit.ts` / `context-audit.js` — pure accumulator from S03. Add the `renderContextAuditMarkdown` function here. Keep typebox-free (verified pattern from S03 T02).
- `context-inspector.ts` — already owns `/ah:ctx-stats` and per-task `context-audit.json` writer (`persistContextAudit`, lines ~264–277). Add `findLatestAuditForTask` and register `ah:ctx-audit`. The "scan `.pi/context-inspector/*/tasks/<taskId>/`" logic is the only new I/O. Session dir naming `${YYYYMMDD-HHMMSS}_${sid8}` (line 144) is sortable lexicographically — pick the lexicographically largest, no `statSync` needed.
- `skills/ah-task-verify/INSTRUCTIONS.md` — text-only update. Insert §2.5 (description of the section) and step 6.5 (materialize/update). The first-run skeleton in §2a needs a new `## Context audit` heading after `## Definition of Done (globale)` and before `## Verify Log`.
- `tests/s04-context-audit-render.test.mts` — NEW. Pure-fn tests, no fixtures, no typebox shim needed.
- `tests/s04-ctx-audit-cmd.test.mts` — NEW. Same shape as `tests/s03-inspector-wire.test.mts` (mock pi, tmp cwd, real `git init` + `feature/T-001-demo` branch, write `PLAN.md` with `context-needed:`, drive a `tool_call/tool_result` cycle, then invoke the `ah:ctx-audit` command and assert the captured `ui.notify` argument contains `declared:`/`loaded:`/`delta_token:`/`label:`.

### Build Order

**T01 first** — the renderer is the highest-risk surface (label transitions, edge cases) and unblocks T02 (which uses it) and T03 (which describes its output to the LLM). A failing T01 unit test catches contract issues before any I/O work.

**T02 second** — once render is locked in, the only new code is the disk locator + a 10-line command wrapper. Integration test verifies on-disk audit → command output. This is also where we discover any cross-session edge cases (multiple sessions for the same task, no session, no audit yet).

**T03 last** — purely textual prompt-template change. With T01+T02 green, the verify skill has a deterministic command to invoke and a deterministic markdown block to inline; the LLM step is reduced to "find the section, replace its body".

### Verification Approach

- **T01:** `node --experimental-strip-types --test tests/s04-context-audit-render.test.mts` — 5 label cases + 3 edge cases (null audit, empty loaded, errors-only). Each asserts the output contains the literal `Label: <X>` line and the expected `declared:` / `loaded:` lists.
- **T02:** `node --experimental-strip-types --test tests/s04-ctx-audit-cmd.test.mts` — drive the Inspector session, then invoke the registered command and assert the rendered string round-trips. Also assert the "no session yet" path: command returns a graceful "Context audit not available yet" message rather than crashing.
- **S04 aggregate:** `node --experimental-strip-types --test tests/s01-*.test.mts tests/s02-*.test.mts tests/s03-*.test.mts tests/s04-*.test.mts` — full milestone suite must remain green (regression check on S01–S03 wiring).
- **End-to-end (manual)** under the success-criteria check: with the worktree active, fake the upstream flow — write a `PLAN.md` with `context-needed: [CONVENZIONI]`, set the feature branch, fire a synthetic Inspector run, then execute the verify skill instructions by hand and confirm `VERIFY.md` ends with a `## Context audit` block carrying `declared / loaded / delta_token / label`.

## Don't Hand-Roll

| Problem | Existing Solution | Why Use It |
|---------|------------------|------------|
| Locating the current task | `detectCurrentTaskLocal` (context-inspector.ts:187) | Already inlined for S03; reuse — do not re-implement |
| Parsing `context-needed:` | `parseContextNeeded` (plan-context.ts) | Single source from S03 T01; render must not re-parse |
| Audit shape & serialisation | `serializeAudit` (context-audit.ts) | Already strips `pending`; render reads the serialised form |
| Token formatting | `fmtN` / `fmtBytes` (context-inspector.ts:130–140) | If render lives in `context-inspector.ts` reuse them; if it lives in `context-audit.ts` (pure), inline a 3-line `fmtN` to keep the module dep-free |

## Constraints

- **Typebox-free invariant on `context-audit.ts`** (MEM/S03 deviation). Anything imported transitively by the verify skill at runtime must not pull typebox at module scope — otherwise the worktree's symlink shim is needed again. Render lives in `context-audit.ts` precisely to preserve this.
- **Observer-only Inspector** (D-Q3=A). Render and command are read-only over the on-disk JSON; no `tool_call` / `tool_result` handler may mutate payloads.
- **`.ts` + `.js` sibling pattern.** Node 22.20.0 `--experimental-strip-types` does not rewrite `.js` → `.ts` import specifiers, so any new shared module needs a runtime `.js` mirror (MEM/S03 deviation). The render fn belongs in `context-audit.ts` which already has a sibling.
- **Single-writer for `summary.json`** (S03 contract). S04 only **reads** the JSON files — no new writer paths. The per-task `tasks/<T-NNN>/context-audit.json` is the canonical source; `summary.json` is a convenience mirror.
- **VERIFY.md single-path commit invariant** (`ah-task-verify` §Git Safety Rule). The new section must live inside `VERIFY.md` — no sibling files, no separate artifacts under the task dir. Inspector artifacts under `.pi/context-inspector/` are session-scoped and already outside the task dir.
- **First-run vs re-run semantics** (`ah-task-verify` §2a/§2b). DoD checkboxes reset on each run; the Context audit section should follow the **same "replace body" rule** (reflect the most recent inspector run, not append history), to stay coherent with V-4.

## Common Pitfalls

- **Multiple session dirs for the same task.** If `/task-verify` runs across sessions, multiple `.pi/context-inspector/*/tasks/T-NNN/context-audit.json` files can exist. **Pick by directory name (lexicographically largest)**, not by file mtime — the `${YYYYMMDD-HHMMSS}_${sid8}` naming is monotonic and survives clock skew across mounts.
- **No audit available yet.** If the dev runs `/task-verify` before the Inspector has seen a `tool_call`, the JSON does not exist. Render must accept `null` and emit `> Context audit not available — Inspector did not record `load_codebase_doc` calls for this task.` rather than throwing.
- **Empty `context-needed: []`** is a legal "no doc needed" declaration (task-layout.md §3.3). Render must label such cases as `on-budget` only if `loaded` is also empty; otherwise `over-load` (declared = []). The existing `recomputeDelta` already encodes this — render must surface it without second-guessing.
- **`no-declaration` vs `context-needed: []`.** `declared = null` means PLAN.md was missing or unparseable; `declared = []` means the dev explicitly opted out. They render differently (the first surfaces a warning; the second is a clean "no docs required").
- **Section idempotence.** On re-run, the prompt template must **replace** the `## Context audit` body, not append. Use a `<!-- ah:ctx-audit:start --> ... <!-- ah:ctx-audit:end -->` fence if the LLM proves unreliable at section replacement.
- **Pure render must not read disk.** Keep `renderContextAuditMarkdown` 100% pure (input = audit object). The locator + the I/O wrap lives in `context-inspector.ts`.

## Open Risks

- **Skill prompt drift.** `ah-task-verify` is a prompt template, not code. A future edit to that prompt could silently drop the §2.5 step. Mitigation: T03 should also add a one-line grep target ("Context audit") in the e2e fixture or in `S04-SUMMARY.md` boundary map so a future regression surfaces.
- **The verify skill is an LLM step, not a deterministic renderer.** The actual write into `VERIFY.md` happens via the LLM following INSTRUCTIONS.md. If we want strict guarantees, T03 could instead register an in-extension command that writes the section directly. Default plan: leave it as a prompt instruction (consistent with the rest of `ah-task-verify`), revisit if observed drift.
- **Cross-session aggregation deferred.** If a task spans multiple Inspector sessions (e.g. dev paused work), we render only the latest session's audit. That is acceptable for M001 success criteria but worth a follow-up if dev workflow demands cumulative view.

## Skills Discovered

| Technology | Skill | Status |
|------------|-------|--------|
| node:test | (built-in)  | available — already used in S01–S03, no skill needed |
| YAML frontmatter parsing | (in-repo `plan-context.ts`) | already installed in worktree |

No external skill installs recommended for this slice — it is a pure consumer of S01–S03 outputs with no new dependencies.

## Sources

- `.gsd/milestones/M001/slices/S03/S03-SUMMARY.md` — boundary map and persisted artifact contract.
- `.gsd/milestones/M001/M001-CONTEXT.md` — D-Q3=A observer-only invariant.
- `task-layout.md` §2.5 and §3.3 — VERIFY.md and PLAN.md contracts.
- `skills/ah-task-verify/INSTRUCTIONS.md` — current first-run/re-run semantics and git safety rule.
