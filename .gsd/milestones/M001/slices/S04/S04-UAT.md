# S04: Report fine-task 'Context audit' in VERIFY.md — UAT

**Milestone:** M001
**Written:** 2026-05-13T08:22:14.831Z

## UAT Type

End-to-end integration — exercises the full S01→S02→S03→S04 chain (load-codebase-doc events → ContextAudit on disk → rendered VERIFY.md section) on a real PI session.

## Preconditions

- M001 worktree checked out at HEAD with all S01–S04 changes applied (`context-audit.{ts,js}`, `context-inspector.ts`, `skills/ah-task-verify/INSTRUCTIONS.md`).
- Node 22.20.0+ available (`node --experimental-strip-types` works).
- A real (or fixture) task directory `.pi/tasks/in-progress/T-NNN-<slug>/` exists with:
  - `PLAN.md` containing a `context-needed: [CONVENZIONI]` (or similar) frontmatter block,
  - the corresponding feature branch (`feature/T-NNN-<slug>`) checked out,
  - the Context Inspector extension loaded so that `pi.registerCommand('ah:ctx-audit', ...)` and `findLatestAuditForTask` are available.
- At least one PI session has run end-to-end for this task so that `.pi/context-inspector/<YYYYMMDD-HHMMSS>_<sid8>/tasks/<T-NNN>/context-audit.json` exists on disk.

## Steps

1. **Verify the renderer is shipped and pure.** Run `node --experimental-strip-types --test tests/s04-context-audit-render.test.mts 2>&1 | grep -E '^# (pass|fail) '`. Expect `# pass 8 / # fail 0`.
2. **Verify the command wiring.** Run `node --experimental-strip-types --test tests/s04-ctx-audit-cmd.test.mts 2>&1 | grep -E '^# (pass|fail) '`. Expect `# pass 2 / # fail 0`.
3. **Verify the full M001 test surface stays green.** Run `node --experimental-strip-types --test tests/s01-*.test.mts tests/s02-*.test.mts tests/s03-*.test.mts tests/s04-*.test.mts 2>&1 | tail -10`. Expect `# pass 25 / # fail 0`.
4. **Verify the verify-skill text update.** Run all five mechanical greps from S04-PLAN T03:
   ```
   grep -q '^## Context audit' skills/ah-task-verify/INSTRUCTIONS.md \
   && grep -q 'ah:ctx-audit' skills/ah-task-verify/INSTRUCTIONS.md \
   && grep -q 'Context audit (sezione)' skills/ah-task-verify/INSTRUCTIONS.md \
   && grep -q 'Git Safety Rule' skills/ah-task-verify/INSTRUCTIONS.md \
   && grep -q '## Verify Log' skills/ah-task-verify/INSTRUCTIONS.md
   ```
   All five must return exit 0.
5. **End-to-end demo.** Inside a real PI session for the task in the preconditions: invoke `ah:ctx-audit T-NNN`. The session UI should display a markdown block starting with `Label: <label>`, followed by `declared: [...]   (≈N tok)`, `loaded: [...]   (≈N tok, K calls)`, `delta_token: ±N`, and a one-line synthesis sentence keyed to the label.
6. **Run /ah:task-verify on the task.** Open `.pi/tasks/in-progress/T-NNN-<slug>/VERIFY.md` and confirm:
   - a `## Context audit` heading exists between `## Definition of Done (globale)` and `## Verify Log`,
   - its body matches the block produced in step 5 (declared / loaded / delta_token / synthesis line),
   - `## Verify Log` retains entries from any earlier runs (chronological log is unaffected).
7. **Re-run /ah:task-verify** without changing anything else. Re-open VERIFY.md and confirm:
   - the `## Context audit` body has been REPLACED with the latest renderer output (not appended — V-4 reset semantics),
   - `## Verify Log` has a new appended entry (chronological log grows).
8. **Negative path.** Pick a task `T-XXX` for which no Inspector session has yet recorded a `tool_call` (i.e. no `context-audit.json` file exists). Invoke `ah:ctx-audit T-XXX`. The notify output must be exactly the canonical line `> Context audit not available — Inspector did not record \`load_codebase_doc\` calls for this task.` — no exception, no empty notify.

## Expected Outcomes

- Steps 1–4 all exit 0 / show `# pass N / # fail 0`.
- Step 5 produces a 4–6 line markdown block via `ctx.ui.notify`, with literal substrings `Label:`, `declared:`, `loaded:`, `delta_token:`.
- Step 6 leaves VERIFY.md with the new `## Context audit` section in the correct position and `## Verify Log` intact.
- Step 7 demonstrates REPLACE semantics for the Context audit body and APPEND semantics for Verify Log.
- Step 8 produces the canonical "not available" line with no stack trace and no exception in the PI host log.

## Edge Cases

- `declared: []` (empty list legal per MEM004) + empty `loaded` ⇒ label `on-budget`; renderer emits `declared: []   (≈0 tok)` and `loaded: []   (≈0 tok, 0 calls)`.
- `declared: null` (no PLAN.md or no `context-needed:` key) ⇒ renderer emits `declared: <none — no PLAN.md or no context-needed:>` and the synthesis line keyed to label `no-declaration`.
- `errors[]` non-empty ⇒ an `errors:` sub-block lists `  - <name>: <reason>` lines after the synthesis sentence.
- Multiple historical sessions on disk ⇒ locator returns the audit from the lexicographically greatest `YYYYMMDD-HHMMSS_<sid8>` directory that contains a `tasks/<T-NNN>/context-audit.json`, even when an earlier-mtime mount serves files out of clock order.
- Missing `<taskId>` arg ⇒ handler falls back to `detectCurrentTaskLocal(process.cwd())?.id`; if still no task, the renderer's null branch is used.

## Not Proven By This UAT

- Multi-user / concurrent-session correctness of the locator under simultaneous writes (the sort is correct but locking/serialisation is out of scope; current usage is single-agent per worktree).
- Behaviour when an audit file exists but is malformed JSON — the handler routes it through `renderContextAuditMarkdown(null)` (verified in T02 unit tests) but a real corruption scenario has not been live-tested.
- Cross-platform line-ending handling in VERIFY.md (steps assume Unix `\n`; Windows CRLF would need separate verification).
- Performance under thousands of historical Inspector session directories — the O(N) name scan is fine at current scale and not stress-tested here.
