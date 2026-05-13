---
id: T03
parent: S03
milestone: M001
key_files:
  - context-inspector.ts
  - context-audit.js
  - tests/s03-inspector-wire.test.mts
key_decisions:
  - Inlined resolveCodebaseDocPath (≈25 LOC) in context-inspector.ts instead of importing from ./load-codebase-doc.js — keeps the Inspector module typebox-free at module-load time and avoids dragging the typebox shim into more test paths than necessary.
  - Inlined detectCurrentTaskLocal (≈25 LOC) instead of re-exporting detectCurrentTask from ./index.js — index.ts already imports context-inspector.ts, so the alternative is a true ESM cycle.
  - Added context-audit.js as a plain-JS sibling of context-audit.ts (same pattern as plan-context.js from T01). Node 22.20.0 --experimental-strip-types does not rewrite .js→.ts in import specifiers, but the must-have requires single-quoted `from './context-audit.js'`.
  - persistSummary now always writes `{...totals, context: <serialized map>}` rather than splitting summary.json across two write paths — guarantees the two writers (totals updates and audit updates) cannot clobber each other's keys.
duration: 
verification_result: passed
completed_at: 2026-05-12T15:50:47.166Z
blocker_discovered: false
---

# T03: Wired context-audit core into the Context Inspector with per-task summary.json + tasks/&lt;id&gt;/context-audit.json artifacts, /ah:ctx-stats audit block, and a passing end-to-end fixture test.

**Wired context-audit core into the Context Inspector with per-task summary.json + tasks/&lt;id&gt;/context-audit.json artifacts, /ah:ctx-stats audit block, and a passing end-to-end fixture test.**

## What Happened

Extended `context-inspector.ts` with: (1) `SessionCtx.context: Record<taskId, ContextAudit>` (init `{}` in `initSession`); (2) inlined `detectCurrentTaskLocal` (avoids the `index → context-inspector → index` cycle); (3) `ensureAuditForCurrentTask(cwd, sc)` that reads sibling PLAN.md, parses via `parseContextNeeded`, computes declared byte budget by `statSync` on each `resolveCodebaseDocPath(cwd, stem)` (errors appended to `audit.errors`), and stores the audit; (4) `persistContextAudit` that rewrites `summary.json` as `{...totals, context: {<taskId>: serializeAudit(audit)}}` and writes a per-task `tasks/<T-NNN>/context-audit.json`; (5) two observer-only `pi.on('tool_call', ...)` and `pi.on('tool_result', ...)` listeners (no `return {` in either body — verified by awk+grep); (6) `/ah:ctx-stats` audit block printing declared / loaded / delta_token / label / errors with the `≈N tok` prefix, including `<none — no PLAN.md or no context-needed:>` for the null-declaration case.

`resolveCodebaseDocPath` was inlined (≈25 LOC) instead of imported from `./load-codebase-doc.js` so the test path does not have to load typebox transitively for an unrelated tool. `context-audit.js` was added as a plain-JS sibling of `context-audit.ts` — same pattern (and same rationale) as `plan-context.js` from T01: Node 22.20.0 `--experimental-strip-types` does not rewrite `.js → .ts` in import specifiers, but the must-have requires `from './context-audit.js'` (single quotes).

New `tests/s03-inspector-wire.test.mts` builds an OS-tmp `.pi/codebase` (INDEX.md, CONVENZIONI.md @ 400 B, STRUTTURA.md @ 200 B) and `.pi/tasks/in-progress/T-001-demo/{TASK.md,PLAN.md}` with `context-needed: [CONVENZIONI]`, runs `git init && checkout -b feature/T-001-demo`, dispatches `tool_call`/`tool_result` pairs for CONVENZIONI (declared) and STRUTTURA (not declared), then asserts: `summary.json.context['T-001'].declared === ['CONVENZIONI']`, `.label === 'over-load'`, `.loaded.CONVENZIONI.calls === 1`, `.errors === []`; `tasks/T-001/context-audit.json` exists with the same shape and no `pending`; both listener return-values are `undefined` (D-Q3=A invariant). A negative case dispatches a `NONEXISTENT` load with `isError: true` and asserts `errors[].name === 'NONEXISTENT'` and that `loaded.NONEXISTENT` is undefined.

## Verification

Ran the full task-plan verification chain: seven grep must-haves against `context-inspector.ts` (single-quote `from './context-audit.js'` + `from './plan-context.js'` imports, `pi.on('tool_call'` and `pi.on('tool_result'` listeners, `📚 Context audit` literal, `context-audit.json` literal, `context: {}` initializer) plus three test files (`s03-inspector-wire`, `s03-context-audit`, `s02-plan-context-needed`) all hitting `# fail 0`. Full suite (s01..s03) = 15 tests, 0 failures. Observer-only invariant double-checked: `awk` slice of each new listener body shows 0 `return {` occurrences.

## Verification Evidence

| # | Command | Exit Code | Verdict | Duration |
|---|---------|-----------|---------|----------|
| 1 | `grep -q "from './context-audit.js'" context-inspector.ts` | 0 | pass | 5ms |
| 2 | `grep -q "from './plan-context.js'" context-inspector.ts` | 0 | pass | 5ms |
| 3 | `grep -qE "pi\.on\(['\"]tool_call['\"]" context-inspector.ts` | 0 | pass | 5ms |
| 4 | `grep -qE "pi\.on\(['\"]tool_result['\"]" context-inspector.ts` | 0 | pass | 5ms |
| 5 | `grep -q '📚 Context audit' context-inspector.ts` | 0 | pass | 5ms |
| 6 | `grep -q 'context-audit.json' context-inspector.ts` | 0 | pass | 5ms |
| 7 | `grep -q 'context: {}' context-inspector.ts` | 0 | pass | 5ms |
| 8 | `node --experimental-strip-types --test tests/s03-inspector-wire.test.mts` | 0 | pass | 315ms |
| 9 | `node --experimental-strip-types --test tests/s03-context-audit.test.mts` | 0 | pass | 300ms |
| 10 | `node --experimental-strip-types --test tests/s02-plan-context-needed.test.mts` | 0 | pass | 300ms |
| 11 | `node --experimental-strip-types --test tests/s01..s03 (15 tests)` | 0 | pass | 471ms |

## Deviations

No structural deviations from the plan. Minor: `resolveCodebaseDocPath` was inlined (the plan permitted either import or inline for the analogous detectCurrentTask but did not explicitly bless inlining the codebase resolver). Rationale documented in code as a one-line comment.

## Known Issues

None.

## Files Created/Modified

- `context-inspector.ts`
- `context-audit.js`
- `tests/s03-inspector-wire.test.mts`
