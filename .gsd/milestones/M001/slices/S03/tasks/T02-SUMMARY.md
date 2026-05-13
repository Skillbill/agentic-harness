---
id: T02
parent: S03
milestone: M001
key_files:
  - context-audit.ts
  - tests/s03-context-audit.test.mts
key_decisions:
  - pending map lives on the ContextAudit type but is stripped by serializeAudit via destructuring — chose 'strip on serialize' over 'non-enumerable' for portability and JSON-roundtrip safety.
  - Repeated successful load of the same stem increments calls only; bytes/approxTokens/firstSeenAt remain frozen to the first load (S03-RESEARCH §Open Risks: treat first successful load as cached).
  - deltaToken uses declaredBudgetTokens ?? 0 so a null budget yields delta == loadedTokens; tests that need deltaToken<0 pass an explicit budget.
  - Label computation uses bare-stem set comparison via Set + every(); under-load and over-load require strict subset (handled by the on-budget-first branch eating the equality case).
duration: 
verification_result: passed
completed_at: 2026-05-12T15:45:13.074Z
blocker_discovered: false
---

# T02: Built pure context-audit.ts accumulator with 9-case unit test covering all label transitions and the pending/error/serialize contracts

**Built pure context-audit.ts accumulator with 9-case unit test covering all label transitions and the pending/error/serialize contracts**

## What Happened

Created context-audit.ts as a zero-dependency module that owns the per-task declared-vs-loaded state machine for the Context Inspector. Exports the ContextAudit type plus createAudit, onToolCall, onToolResult, recomputeDelta, and serializeAudit. The module deliberately imports nothing from load-codebase-doc.ts, typebox, or pi-coding-agent, so the test path stays clean of native deps.

Behavior: onToolCall stashes input.name keyed by toolCallId in `pending`; onToolResult matches by toolCallId, deletes the pending entry, and either appends to `errors[]` (isError:true) or records `loaded[stem]` with bytes = Buffer.byteLength(JSON.stringify(content),'utf8'), approxTokens = round(bytes/4), calls = 1, firstSeenAt = nowIso. Repeated successful loads bump `calls` only — bytes/firstSeenAt freeze to the first load, per S03 research §Open Risks. recomputeDelta sums approxTokens, computes deltaToken against declaredBudgetTokens ?? 0, and labels via set comparison: declared===null → no-declaration; equal sets → on-budget; loadedSet ⊊ declaredSet → under-load; declaredSet ⊊ loadedSet → over-load; otherwise divergent. serializeAudit destructures `pending` out so summary.json.context and tasks/<T>/context-audit.json share an identical, JSON-roundtrippable shape.

Wrote tests/s03-context-audit.test.mts with all 9 spec cases (empty-on-budget, single-load-on-budget, under-load with positive budget proving deltaToken<0, over-load with zero budget proving deltaToken>0, divergent, repeated-load idempotent bytes, error path, declared:null sticks at no-declaration, serialize strips pending & JSON-roundtrips). All cases pass under node --experimental-strip-types --test.

## Verification

Ran the exact verification command from the task plan as a single shell chain: file exists; module is grep-clean of load-codebase-doc/typebox/pi-coding-agent imports; all five required `export function` symbols are present; `node --experimental-strip-types --test tests/s03-context-audit.test.mts` reports `# pass 9` and `# fail 0`. The chain exited 0 (VERIFY_OK).

## Verification Evidence

| # | Command | Exit Code | Verdict | Duration |
|---|---------|-----------|---------|----------|
| 1 | `test -f context-audit.ts && ! grep -qE "from ['\"]\\./load-codebase-doc" context-audit.ts && ! grep -qE "from ['\"]typebox" context-audit.ts && ! grep -qE 'pi-coding-agent' context-audit.ts && grep -q 'export function createAudit' context-audit.ts && grep -q 'export function onToolCall' context-audit.ts && grep -q 'export function onToolResult' context-audit.ts && grep -q 'export function recomputeDelta' context-audit.ts && grep -q 'export function serializeAudit' context-audit.ts && node --experimental-strip-types --test tests/s03-context-audit.test.mts 2>&1 | grep -qE '# pass 9' && node --experimental-strip-types --test tests/s03-context-audit.test.mts 2>&1 | grep -qE '# fail 0'` | 0 | pass | 900ms |
| 2 | `node --experimental-strip-types --test tests/s03-context-audit.test.mts` | 0 | pass | 213ms |

## Deviations

None.

## Known Issues

None.

## Files Created/Modified

- `context-audit.ts`
- `tests/s03-context-audit.test.mts`
