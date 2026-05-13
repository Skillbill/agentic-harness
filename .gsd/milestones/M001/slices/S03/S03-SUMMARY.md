---
id: S03
parent: M001
milestone: M001
provides:
  - context-audit.ts pure accumulator (createAudit/onToolCall/onToolResult/recomputeDelta/serializeAudit)
  - plan-context.ts shared parser (parseContextNeeded + NAME_PATTERN)
  - summary.json.context per-session block keyed by taskId
  - tasks/<T-NNN>/context-audit.json per-task on-disk artifact
  - '📚 Context audit' section in /ah:ctx-stats
  - pi tool_call / tool_result listeners in Context Inspector (observer-only)
requires:
  - slice: S01
    provides: load_codebase_doc tool emits pi tool_call/tool_result events; .pi/codebase/INDEX.md as the canonical doc name registry
  - slice: S02
    provides: context-needed: [...] YAML-frontmatter block in PLAN.md as the declared-set source
affects:
  - S04
key_files:
  - plan-context.ts
  - plan-context.js
  - context-audit.ts
  - context-audit.js
  - context-inspector.ts
  - tests/s02-plan-context-needed.test.mts
  - tests/s03-context-audit.test.mts
  - tests/s03-inspector-wire.test.mts
key_decisions:
  - Inspector stays observer-only (D-Q3=A): tool_call/tool_result listeners accumulate state but never mutate the in-flight payload.
  - Pure accumulator (context-audit.ts) is isolated from runtime deps — no load-codebase-doc, no typebox imports — so unit tests run without the worktree's typebox shim.
  - Single-writer for summary.json: persistSummary always writes {...totals, context: serializedMap} to prevent the two updater paths (totals vs audit) from clobbering each other's keys.
  - Inlined resolveCodebaseDocPath (≈25 LOC) and detectCurrentTaskLocal (≈25 LOC) in context-inspector.ts — the first to keep the Inspector typebox-free at module-load time, the second to avoid a real ESM cycle with index.ts.
  - Cached-first-result semantics: repeated successful load of the same stem bumps `calls` only; bytes/approxTokens/firstSeenAt remain frozen to the first load.
  - Tool failures (isError:true) surface under a separate `errors:[{name,reason}]` array — never silently dropped.
  - Token figures are labelled '≈ tokens' to avoid implying provider-grade accuracy.
  - Runtime sibling .js pattern for plan-context and context-audit (Node 22.20.0 strip-types does not rewrite .js→.ts in import specifiers).
patterns_established:
  - Observer-only listener wiring in registerContextInspector — tool_call/tool_result handlers append into a per-session Record<taskId, ContextAudit> map without touching the payload.
  - Pure-core + thin-glue split: a typebox-free pure accumulator module is wired into the Inspector via a small bridge, making the heuristics independently unit-testable.
  - Runtime `.js` sibling alongside the canonical `.ts` module to satisfy specifier-literal requirements in tests while keeping the typed source authoritative.
  - Single-writer persistSummary contract: every writer composes the full {totals, context, ...} object rather than updating shards, eliminating partial-write races at the file level.
observability_surfaces:
  - /ah:ctx-stats now prints a '📚 Context audit' block per task with declared / loaded / deltaToken / label
  - summary.json.context[taskId] persisted per session under .pi/context-inspector/<ts>_<sid>/
  - tasks/<T-NNN>/context-audit.json persisted per task with declared, loaded, deltaToken, label, and optional errors
  - tool failures captured in audit.errors:[{name, reason}] rather than silently dropped
drill_down_paths:
  - .gsd/milestones/M001/slices/S03/tasks/T01-SUMMARY.md
  - .gsd/milestones/M001/slices/S03/tasks/T02-SUMMARY.md
  - .gsd/milestones/M001/slices/S03/tasks/T03-SUMMARY.md
duration: ""
verification_result: passed
completed_at: 2026-05-12T15:52:25.938Z
blocker_discovered: false
---

# S03: Inspector: dichiarato vs effettivo

**Context Inspector now computes declared-vs-loaded per task, persists it to `summary.json.context` + `tasks/<T-NNN>/context-audit.json`, and surfaces the audit in `/ah:ctx-stats`.**

## What Happened

S03 closes the observer side of the context-selection contract established in S01+S02. T01 extracted S02's inline YAML-frontmatter parser into a shared module (`plan-context.ts`, with a runtime `.js` sibling) so both the test suite and Inspector consume one implementation of `parseContextNeeded` + `NAME_PATTERN`. T02 built `context-audit.ts`: a pure, dependency-free accumulator with `createAudit / onToolCall / onToolResult / recomputeDelta / serializeAudit` — deliberately isolated from `load-codebase-doc.ts` and typebox so its 9-case unit suite runs without the worktree's typebox shim. Label transitions (`on-budget` / `under-load` / `over-load` / `divergent` / `no-declaration`) and the pending/error/serialize contracts are all covered. T03 wired the core into the Inspector: two new listeners (`tool_call`, `tool_result`) drive a `SessionCtx.context: Record<taskId, ContextAudit>` map, `persistSummary` always writes `{...totals, context: serialized}` (single-writer for `summary.json` to avoid key clobbering), per-task `tasks/<T-NNN>/context-audit.json` artifacts are produced on every result, and `/ah:ctx-stats` gained a "📚 Context audit" block. Two small helpers (`resolveCodebaseDocPath`, `detectCurrentTaskLocal`) were inlined rather than imported — the first to keep the Inspector typebox-free at module-load time, the second to avoid a real ESM cycle with `index.ts`. Observer-only invariant (D-Q3=A) is preserved: no in-flight payload mutation. Tool failures (`isError:true`) surface under a separate `errors` array on the audit and are never silently dropped. The full s01..s03 suite reports 15/15 pass.

## Verification

Ran all three task verification chains plus the full slice suite via `gsd_exec`. T01: `plan-context.ts` exposes `parseContextNeeded` + `NAME_PATTERN`; S02 test imports from `'../plan-context.js'`; `node --experimental-strip-types --test tests/s02-plan-context-needed.test.mts` → `# pass 2`. T02: `context-audit.ts` is grep-clean of `load-codebase-doc`, `typebox`, and `pi-coding-agent`; all five required `export function` symbols present; `tests/s03-context-audit.test.mts` → `# pass 9 # fail 0`. T03: `context-inspector.ts` imports from `'./context-audit.js'` + `'./plan-context.js'`, registers `pi.on('tool_call', …)` and `pi.on('tool_result', …)`, contains the literal `📚 Context audit`, writes `context-audit.json`, initializes `context: {}`; `tests/s03-inspector-wire.test.mts` → `# fail 0` (e2e fixture asserts on-disk artifact shape). Aggregate s01..s03 suite: 15 tests, 0 failures, duration ≈ 449 ms.

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

T01 added a sibling `plan-context.js` (and T03 added `context-audit.js`) because Node 22.20.0 `--experimental-strip-types` does not rewrite `.js`→`.ts` in import specifiers — the must-haves require the single-quoted `'./<name>.js'` import literals. T03 also inlined `resolveCodebaseDocPath` (~25 LOC) and `detectCurrentTaskLocal` (~25 LOC) in context-inspector.ts rather than importing them: the first to keep the Inspector typebox-free at module-load time, the second to avoid a true ESM cycle with index.ts. None of these deviations weaken the observer-only invariant or the verification contract.</deviations>
<parameter name="knownLimitations">Two physical files exist for each shared module (plan-context.ts/.js and context-audit.ts/.js) carrying the same runtime implementation. If S04 or beyond evolves either parser/accumulator, both files must be kept in sync — or consolidated (delete the .js sibling and switch the test import to `'./<name>.ts'`, or make the .ts a typed re-export wrapper). Token figures are deliberately approximate ('≈ tokens') and not provider-grade. The Inspector is observer-only; it does not gate or shape requests.</knownLimitations>
<parameter name="followUps">S04 should render the persisted audit (`summary.json.context` + `tasks/<T-NNN>/context-audit.json`) into the per-task `VERIFY.md` 'Context audit' section, closing the milestone's success criteria for end-to-end visibility. Consider consolidating the `.ts`/`.js` sibling pairs once Node node:test handles `.js`→`.ts` specifier resolution natively, or by switching to a TS build step.</followUps>
</invoke>

## Known Limitations

None.

## Follow-ups

None.

## Files Created/Modified

- `plan-context.ts` — NEW: shared YAML-frontmatter parser (parseContextNeeded + NAME_PATTERN) extracted from the S02 test.
- `plan-context.js` — NEW: runtime sibling of plan-context.ts so `from '../plan-context.js'` specifiers resolve under Node --experimental-strip-types.
- `context-audit.ts` — NEW: pure accumulator (createAudit/onToolCall/onToolResult/recomputeDelta/serializeAudit) with no runtime deps.
- `context-audit.js` — NEW: runtime sibling of context-audit.ts for `from './context-audit.js'` specifier resolution.
- `context-inspector.ts` — Wired pi.on('tool_call')/pi.on('tool_result') listeners; added context: {} to SessionCtx; introduced per-task tasks/<T-NNN>/context-audit.json writer; added '📚 Context audit' block to /ah:ctx-stats; inlined resolveCodebaseDocPath and detectCurrentTaskLocal.
- `tests/s02-plan-context-needed.test.mts` — Re-pointed to import parseContextNeeded + NAME_PATTERN from '../plan-context.js' instead of an inline copy.
- `tests/s03-context-audit.test.mts` — NEW: 9-case node:test suite covering all label transitions and the pending/error/serialize contracts.
- `tests/s03-inspector-wire.test.mts` — NEW: end-to-end fixture test exercising tool_call/tool_result wiring and asserting on-disk artifact shape.
