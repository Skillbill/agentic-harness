---
estimated_steps: 1
estimated_files: 2
skills_used: []
---

# T02: Wire ah:ctx-audit command + audit locator into context-inspector

Add two pieces to `context-inspector.ts`. (1) Helper `findLatestAuditForTask(cwd: string, taskId: string): string | null` that lists entries in `.pi/context-inspector/` (the inspector root), filters to directories whose name matches the `${YYYYMMDD-HHMMSS}_${sid8}` pattern, sorts them lexicographically descending (NOT by mtime — the timestamp prefix is monotonic and survives clock skew across mounts, per the research), and returns the absolute path of `<dir>/tasks/<taskId>/context-audit.json` for the first session whose audit file exists; returns null if no session contains the file. (2) `pi.registerCommand('ah:ctx-audit', ...)` whose handler: parses the `<taskId>` arg, normalises to `T-NNN` (`T-NNN` regex; if missing arg, fall back to `detectCurrentTaskLocal(process.cwd())?.id`), calls `findLatestAuditForTask`, reads + JSON-parses the file, calls the T01 renderer, and emits the result via `ctx.ui.notify(markdown, 'info')`. When no audit file is found the handler emits the renderer's null-branch message instead of throwing. Keep the helper inside `context-inspector.ts` (the Inspector home) — do not push it into `context-audit.ts`, which must stay pure. Write `tests/s04-ctx-audit-cmd.test.mts` mirroring `tests/s03-inspector-wire.test.mts` (same typebox-shim preamble, same tmpdir + `git init` + `feature/T-001-demo` branch, same PLAN.md fixture with `context-needed: [CONVENZIONI]`). Drive one `session_start` + one `tool_call`/`tool_result` cycle for `CONVENZIONI`, then capture `ui.notify` arguments by passing a stub ctx whose `notify` pushes into an array; invoke `commands.get('ah:ctx-audit').handler('T-001', ctx)` and assert the captured string contains the literal substrings `Label:`, `declared: [CONVENZIONI]`, `loaded: [CONVENZIONI]`, and `delta_token:`. Add a second sub-test for the no-audit path: drop the audit file (or use a different `T-NNN`) and assert the message contains `Context audit not available`. Observer invariant from S03 must remain intact — the new code only reads from disk and calls a pure renderer.

## Inputs

- ``context-inspector.ts` — current Inspector that already owns session dir creation, ensureAuditForCurrentTask, and persistContextAudit (S03 T03).`
- ``context-audit.ts` — provides the new renderContextAuditMarkdown from T01.`
- ``context-audit.js` — runtime sibling consumed via `./context-audit.js` specifier.`
- ``tests/s03-inspector-wire.test.mts` — fixture pattern to mirror (typebox shim, tmpdir + git init + branch, mock pi, PLAN.md with context-needed).`

## Expected Output

- ``context-inspector.ts` — adds findLatestAuditForTask helper and `ah:ctx-audit` command registration.`
- ``tests/s04-ctx-audit-cmd.test.mts` — NEW; node:test suite covering happy-path render via command and no-audit fallback.`

## Verification

node --experimental-strip-types --test tests/s04-ctx-audit-cmd.test.mts 2>&1 | grep -E '^# (pass|fail) '
