---
id: S04
parent: M001
milestone: M001
provides:
  - renderContextAuditMarkdown(audit, opts?) pure renderer in context-audit.{ts,js}
  - ah:ctx-audit <T-NNN> pi command emitting rendered markdown via ctx.ui.notify
  - findLatestAuditForTask(cwd, taskId) locator using lexicographic descending session-dir sort
  - ## Context audit section + §2.5 + step 6.5 in skills/ah-task-verify/INSTRUCTIONS.md (REPLACE semantics)
requires:
  - slice: S03
    provides: context-audit.ts types/serialisation + per-task tasks/<T-NNN>/context-audit.json writer
  - slice: S02
    provides: context-needed: [...] declared list source in PLAN.md
  - slice: S01
    provides: load-codebase-doc events captured by the Inspector for the loaded list
affects:
  - M001 milestone closeout — completes the end-to-end declared→loaded→VERIFY.md loop
key_files:
  - context-audit.ts
  - context-audit.js
  - context-inspector.ts
  - tests/s04-context-audit-render.test.mts
  - tests/s04-ctx-audit-cmd.test.mts
  - skills/ah-task-verify/INSTRUCTIONS.md
key_decisions:
  - Keep context-audit.ts pure (no fs/typebox/cross-module imports); inline fmtN + synthesisFor helpers and locate impure concerns (session-dir lookup, command registration, ui.notify) in context-inspector.ts.
  - Sort Inspector session directories lexicographically descending on the YYYYMMDD-HHMMSS_<sid8> name prefix instead of by mtime — the monotonic prefix survives clock skew across NFS-style mounts.
  - Funnel every failure branch (no task detected, no audit file, read/JSON error) through renderContextAuditMarkdown(null) so the user always sees the canonical 'Context audit not available' message via ctx.ui.notify rather than an exception or empty notify.
  - On VERIFY.md re-runs, REPLACE the ## Context audit body (V-4 reset semantics, like DoD checkboxes) instead of appending — the section mirrors only the latest run, while ## Verify Log remains the chronological record.
  - Step 6.5 documents a renderer-direct fallback (read tasks/<T-NNN>/context-audit.json + apply renderContextAuditMarkdown) so the skill stays usable even when the Inspector extension is unloaded and ah:ctx-audit is unregistered.
  - Preserve MEM008 dual-sibling pattern by adding context-audit.js alongside context-audit.ts and importing via './context-audit.js' from context-inspector.ts.
patterns_established:
  - Pure-renderer + impure-shell split: a pure markdown renderer lives in the data module (context-audit.ts), and the pi command + filesystem locator live in the home module (context-inspector.ts).
  - Failure funnel: every error branch in a pi command handler routes through the renderer's null-input path so the user-visible 'not available' message has exactly one source of truth.
  - VERIFY.md section reset semantics: REPLACE-on-re-run for state-snapshot sections (DoD, Context audit) vs. append-only for chronological log sections (Verify Log).
observability_surfaces:
  - `ah:ctx-audit <T-NNN>` pi command emits rendered markdown via ctx.ui.notify (manual diagnostic surface)
  - `## Context audit` section inside .pi/tasks/in-progress/<ID>-<slug>/VERIFY.md (persisted artifact, refreshed on every /ah:task-verify run)
  - Renderer's null-branch message ('Context audit not available — Inspector did not record load_codebase_doc calls for this task') as the canonical failure signal when no audit file exists
drill_down_paths:
  - .gsd/milestones/M001/slices/S04/tasks/T01-SUMMARY.md
  - .gsd/milestones/M001/slices/S04/tasks/T02-SUMMARY.md
  - .gsd/milestones/M001/slices/S04/tasks/T03-SUMMARY.md
duration: ""
verification_result: passed
completed_at: 2026-05-13T08:22:14.829Z
blocker_discovered: false
---

# S04: Report fine-task 'Context audit' in VERIFY.md

**Wired the per-task ContextAudit into a `## Context audit` block of VERIFY.md via a pure renderer, a thin `ah:ctx-audit <T-NNN>` pi command, and a §2.5 + step 6.5 update to the ah-task-verify skill.**

## What Happened

S04 closes M001's end-to-end success criteria by making the declared→loaded→delta_token signal visible to a dev (and the next agent) inside the existing VERIFY.md artifact.

**T01** added `renderContextAuditMarkdown(audit, opts?)` to `context-audit.ts` (and the `.js` runtime sibling per the MEM008 dual-file pattern) as a strictly pure function: no fs, no typebox, no cross-module imports. The renderer emits a leading `Label:` line, `declared:` / `loaded:` lines with inline `≈N tok` token annotations, a signed `delta_token: ±N`, a one-line synthesis sentence keyed to all 5 labels (`on-budget` / `over-load` / `under-load` / `divergent` / `no-declaration`), and an optional `errors:` sub-block. The null-audit branch emits the canonical `> Context audit not available …` message instead of throwing. Eight `node:test` cases cover the five labels plus three edge cases (null audit, `declared:[]` + empty loaded → must label `on-budget`, errors-only happy path). Helpers (`fmtN`, `synthesisFor`) are inlined to preserve the no-cross-module-dependency guarantee.

**T02** wired the renderer behind a thin `pi.registerCommand('ah:ctx-audit', handler)` inside `context-inspector.ts`, plus a `findLatestAuditForTask(cwd, taskId)` locator. The locator filters `.pi/context-inspector/` entries to the `YYYYMMDD-HHMMSS_<sid8>` pattern, sorts them lexicographically descending (the monotonic prefix survives NFS-style clock skew — see MEM009), and returns the first session whose `tasks/<taskId>/context-audit.json` exists. The handler normalises the arg to `T-NNN` (falling back to `detectCurrentTaskLocal` when missing), reads + parses the audit file, and funnels every failure branch (no task, no file, read/JSON error) through `renderContextAuditMarkdown(null)` so the user always sees the canonical "not available" message via `ctx.ui.notify`. Two `node:test` cases cover the happy path (assertions on literal `Label:`, `declared: [CONVENZIONI]`, `loaded: [CONVENZIONI]`, `delta_token:` substrings) and the missing-audit fallback.

**T03** was a text-only update to `skills/ah-task-verify/INSTRUCTIONS.md`: (a) inserted a `## Context audit` heading + placeholder line in the §2a first-run skeleton between the DoD block and `## Verify Log`; (b) added §2.5 "Context audit (sezione)" describing what the section mirrors and the reset semantics; (c) inserted step 6.5 between the existing step 6 and step 7 instructing the agent to invoke `ah:ctx-audit <T-NNN>` (or read the JSON directly as a fallback), append on first run, and REPLACE the body on subsequent runs — same V-4 reset semantics as the DoD checkboxes (see MEM010). The §Git Safety invariant remains intact: the only path that may change is still `.pi/tasks/in-progress/<ID>-<slug>/VERIFY.md`.

Slice-level verification (`node --experimental-strip-types --test tests/s01-*.test.mts tests/s02-*.test.mts tests/s03-*.test.mts tests/s04-*.test.mts`) reports `# pass 25 / # fail 0`, and the five mechanical greps for T03 all pass. Pure-module / observer / dual-sibling invariants from S01–S03 are preserved.

## Verification

Ran the slice plan's must-have verification through `gsd_exec`:

1. **Full M001 test suite green** — `node --experimental-strip-types --test tests/s01-*.test.mts tests/s02-*.test.mts tests/s03-*.test.mts tests/s04-*.test.mts 2>&1 | tail -30` → `# tests 25 / # pass 25 / # fail 0` (S01 + S02 + S03 + S04 combined; includes T01's 8 renderer cases and T02's 2 command cases).
2. **T01 renderer scope** — covered all 5 labels (`on-budget`, `over-load`, `under-load`, `divergent`, `no-declaration`) + 3 edge cases (null audit, `declared:[]`, errors-only).
3. **T02 command path** — happy-path test asserts literal `Label:`, `declared: [CONVENZIONI]`, `loaded: [CONVENZIONI]`, `delta_token:` in the captured `ui.notify` string; fallback test asserts `Context audit not available` for missing audit.
4. **T03 INSTRUCTIONS greps** — all 5 required greps return exit 0: `^## Context audit`, `ah:ctx-audit`, `Context audit (sezione)`, `Git Safety Rule`, `## Verify Log`.

Evidence digests: gsd_exec ids `2db64129-eb8d-4fa6-8058-269eab801dd7` (test suite, exit 0) and `e5f049e1-6592-49b7-b055-5ea8a7a5ac95` (greps, exit 0, stdout `ALL 5 GREPS PASS`).

## Requirements Advanced

None.

## Requirements Validated

None.

## New Requirements Surfaced

None.

## Requirements Invalidated or Re-scoped

None.

## Operational Readiness

None.

## Deviations

None. Each task delivered exactly the must-haves and verification commands listed in S04-PLAN.md.

## Known Limitations

- The locator scans the on-disk `.pi/context-inspector/` tree on every command invocation; for projects with many historical sessions this is O(N) in session count. Fine for current scale but a future indexing layer (or capped retention) would help if the directory grows unbounded.
- Step 6.5's renderer-direct fallback assumes the agent can resolve `tasks/<T-NNN>/context-audit.json` against the latest session itself — there is no documented helper for that path; the fallback is intentional and only used when the Inspector extension is unloaded.

## Follow-ups

- Consider exposing a programmatic helper (e.g. `findLatestAuditForTask` as an exported utility or a second pi command returning the path) so the §6.5 fallback can be mechanised without re-implementing session-dir scanning.
- M001 milestone closeout: with S04 complete the milestone's four success criteria are met end-to-end and the milestone is ready for validation.

## Files Created/Modified

- `context-audit.ts` — Added pure renderContextAuditMarkdown(audit, opts?) function plus inlined fmtN / synthesisFor helpers.
- `context-audit.js` — Mirror of context-audit.ts for the Node 22 --experimental-strip-types specifier-resolution pattern (MEM008).
- `context-inspector.ts` — Added findLatestAuditForTask(cwd, taskId) locator and pi.registerCommand('ah:ctx-audit', handler) wiring the renderer to ctx.ui.notify.
- `tests/s04-context-audit-render.test.mts` — 8 node:test cases covering the 5 labels + 3 edge cases (null audit, declared:[], errors-only).
- `tests/s04-ctx-audit-cmd.test.mts` — 2 node:test cases: happy-path command output + missing-audit fallback message.
- `skills/ah-task-verify/INSTRUCTIONS.md` — Added ## Context audit heading + placeholder in §2a skeleton, §2.5 'Context audit (sezione)' description, and step 6.5 between existing steps 6 and 7.
