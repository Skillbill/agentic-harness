---
id: T02
parent: S04
milestone: M001
key_files:
  - context-inspector.ts
  - tests/s04-ctx-audit-cmd.test.mts
key_decisions:
  - Kept findLatestAuditForTask inside context-inspector.ts (the Inspector home) per the plan — context-audit.ts stays a pure module with no fs/path dependencies.
  - Sorted session dirs by name descending rather than by mtime, since the YYYYMMDD-HHMMSS prefix is monotonic and survives clock skew across NFS-style mounts.
  - Funneled every failure branch (no task detected, no audit file found, read/JSON error) through renderContextAuditMarkdown(null) so the user always sees the canonical 'Context audit not available' message instead of an exception or empty notify.
  - Imported renderContextAuditMarkdown via './context-audit.js' to preserve the T01 dual-sibling pattern documented in MEM008 (Node 22 --experimental-strip-types does not rewrite .js → .ts in specifiers).
duration: 
verification_result: passed
completed_at: 2026-05-13T08:07:00.497Z
blocker_discovered: false
---

# T02: Wired ah:ctx-audit command + audit locator into context-inspector with happy-path and no-audit fallback tests

**Wired ah:ctx-audit command + audit locator into context-inspector with happy-path and no-audit fallback tests**

## What Happened

Added two pieces to context-inspector.ts. (1) Exported `findLatestAuditForTask(cwd, taskId)` that lists entries in `.pi/context-inspector/`, filters on the `^\d{8}-\d{6}_[A-Za-z0-9]+$` session-dir pattern, sorts lexicographically descending (timestamp prefix is monotonic — survives clock skew across mounts, per S03 research), and returns the absolute path of `<dir>/tasks/<taskId>/context-audit.json` for the first session whose audit file exists, else null. (2) Registered the `ah:ctx-audit` pi command. Its handler trims the `<taskId>` arg, validates it against `^T-\d+$`, falls back to `detectCurrentTaskLocal(process.cwd())?.id` if absent/invalid, calls `findLatestAuditForTask`, reads + JSON-parses the file, invokes the T01 `renderContextAuditMarkdown`, and emits the result through `ctx.ui.notify(_, 'info')`. The no-audit/no-task/read-error branches all funnel through `renderContextAuditMarkdown(null)` so the user gets the literal "Context audit not available — Inspector did not record `load_codebase_doc` calls for this task" line instead of a thrown exception. Imported `renderContextAuditMarkdown` from `./context-audit.js` (runtime sibling), keeping `context-audit.ts` pure — the locator deliberately lives in the Inspector home. Wrote `tests/s04-ctx-audit-cmd.test.mts` mirroring the S03 fixture (typebox symlink shim, tmpdir + `git init` + `feature/T-001-demo` branch, PLAN.md with `context-needed: [CONVENZIONI]`, mock pi). Sub-test 1 drives one `session_start` + one `tool_call`/`tool_result` cycle for CONVENZIONI, then invokes `commands.get('ah:ctx-audit').handler('T-001', ctx)` and asserts the captured notify string contains the literal substrings `Label:`, `declared: [CONVENZIONI]`, `loaded: [CONVENZIONI]`, and `delta_token:`. Sub-test 2 starts a fresh session, never drives a tool cycle, calls the handler with `T-999`, and asserts the captured string contains `Context audit not available`. Observer invariant from S03 remains intact — the new command only reads from disk and calls a pure renderer; the `tool_call`/`tool_result` listeners are unchanged.

## Verification

Ran the plan's verification command and saw `# pass 2 / # fail 0`. Also re-ran `tests/s03-inspector-wire.test.mts` (1 pass) and `tests/s04-context-audit-render.test.mts` (8 pass) to confirm no regression in the underlying observer wiring or the T01 renderer.

## Verification Evidence

| # | Command | Exit Code | Verdict | Duration |
|---|---------|-----------|---------|----------|
| 1 | `node --experimental-strip-types --test tests/s04-ctx-audit-cmd.test.mts` | 0 | pass | 310ms |
| 2 | `node --experimental-strip-types --test tests/s03-inspector-wire.test.mts` | 0 | pass | 300ms |
| 3 | `node --experimental-strip-types --test tests/s04-context-audit-render.test.mts` | 0 | pass | 60ms |

## Deviations

None.

## Known Issues

None.

## Files Created/Modified

- `context-inspector.ts`
- `tests/s04-ctx-audit-cmd.test.mts`
