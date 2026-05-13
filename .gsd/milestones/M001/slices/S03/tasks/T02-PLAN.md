---
estimated_steps: 24
estimated_files: 2
skills_used: []
---

# T02: Build pure context-audit core module + accumulator tests

Create a pure, dependency-free `context-audit.ts` module that owns the per-task state machine. The module is imported by the Inspector but is unit-testable in isolation — it must NOT import `load-codebase-doc.ts` at module scope (transitively pulls `typebox` into the test path).

Exports:
- `type ContextAudit = { taskId: string; declared: string[] | null; declaredBudgetTokens: number | null; loaded: Record<stem, { bytes: number; approxTokens: number; calls: number; firstSeenAt: string }>; loadedTokens: number; deltaToken: number; label: 'on-budget'|'under-load'|'over-load'|'divergent'|'no-declaration'; errors: Array<{name: string; reason: string}>; pending: Record<toolCallId, string> }` (the `pending` map is internal-but-exposed because the same struct is what gets serialized; mark it non-enumerable or strip it on serialize — pick one, document the choice).
- `createAudit(taskId: string, declared: string[] | null, declaredBudgetTokens: number | null): ContextAudit` — initializes a fresh audit. `declared === null` means no PLAN.md / no `context-needed:` key — label becomes `no-declaration`.
- `onToolCall(audit: ContextAudit, event: { toolName: string; toolCallId: string; input: any }): void` — if `toolName !== 'load_codebase_doc'`, no-op. Else if `input.name` is a string, register `pending[toolCallId] = input.name`.
- `onToolResult(audit: ContextAudit, event: { toolCallId: string; content: any; isError?: boolean }, nowIso: string): void` — match `pending[toolCallId]` to a stem. If `isError`, append to `errors` (`{name: stem, reason: text-of-first-content-block-or-'unknown'}`) and do not contribute to `loaded`. Else, bytes = `Buffer.byteLength(JSON.stringify(event.content) ?? '', 'utf8')`; if `loaded[stem]` exists, increment `calls` only (treat first successful load as cached — see research §Open Risks: 'Repeated loads… must increment calls but only count bytes once'). Else create `loaded[stem] = { bytes, approxTokens: round(bytes/4), calls: 1, firstSeenAt: nowIso }`. Always `delete pending[toolCallId]` after. Then `recomputeDelta(audit)`.
- `recomputeDelta(audit: ContextAudit): void` — recompute `loadedTokens = sum(loaded[*].approxTokens)`, `deltaToken = loadedTokens - (declaredBudgetTokens ?? 0)`, and label by set comparison: `declared===null → 'no-declaration'`; else compare bare stems: `declaredSet === loadedSet → 'on-budget'`; `loadedSet ⊊ declaredSet → 'under-load'`; `declaredSet ⊊ loadedSet → 'over-load'`; otherwise `'divergent'`.
- `serializeAudit(audit: ContextAudit): object` — returns a JSON-safe shape that strips `pending` and inlines all other fields (so `summary.json.context` and `tasks/<T>/context-audit.json` get the same shape).

New test `tests/s03-context-audit.test.mts` exercises:
1. Empty declared list (`[]`) + zero events → `loaded:{}`, `loadedTokens:0`, `deltaToken:0`, `label:'on-budget'`.
2. Declared `['CONVENZIONI']`, one successful `load_codebase_doc({name:'CONVENZIONI'})` with `content:[{type:'text',text:'X'.repeat(400)}]` → `loaded.CONVENZIONI.bytes ≈ JSON-encoded length`, `calls:1`, `label:'on-budget'`.
3. Declared `['A','B']`, load A only → `label:'under-load'`, `deltaToken < 0`.
4. Declared `['A']`, load A and B → `label:'over-load'`, `deltaToken > 0`.
5. Declared `['A']`, load B only (no A) → `label:'divergent'`.
6. Repeated load of A → `calls:2`, `bytes` unchanged.
7. Error path: `isError:true` result → `errors[0].name === 'A'`, `loaded.A === undefined`.
8. `declared:null` → `label:'no-declaration'` regardless of events.
9. `serializeAudit` output is a plain JSON-roundtrippable object that does NOT contain `pending`.

Failure modes / negative tests are encoded directly into the cases above.

Must-haves:
- `context-audit.ts` does NOT import `load-codebase-doc.ts`, `typebox`, or `@mariozechner/pi-coding-agent` at module scope (verifiable with grep).
- All 9 test cases pass with `node --experimental-strip-types --test tests/s03-context-audit.test.mts`.
- Module exports listed above are present with the exact names (`createAudit`, `onToolCall`, `onToolResult`, `recomputeDelta`, `serializeAudit`).

Skills the executor should load: tdd, verify-before-complete, error-handling-patterns.

## Inputs

- ``plan-context.ts` — from T01 (for stem validation regex reuse; import `NAME_PATTERN` if you need it for input validation, otherwise unused)`
- ``.gsd/milestones/M001/slices/S03/S03-RESEARCH.md` — §Recommendation, §Common Pitfalls, §Open Risks`

## Expected Output

- ``context-audit.ts` — new pure module: createAudit, onToolCall, onToolResult, recomputeDelta, serializeAudit, ContextAudit type`
- ``tests/s03-context-audit.test.mts` — 9-case unit test over the accumulator, zero-dep, runs verbatim under node --experimental-strip-types --test`

## Verification

test -f context-audit.ts && ! grep -qE "from ['\"]\\./load-codebase-doc" context-audit.ts && ! grep -qE "from ['\"]typebox" context-audit.ts && ! grep -qE 'pi-coding-agent' context-audit.ts && grep -q 'export function createAudit' context-audit.ts && grep -q 'export function onToolCall' context-audit.ts && grep -q 'export function onToolResult' context-audit.ts && grep -q 'export function recomputeDelta' context-audit.ts && grep -q 'export function serializeAudit' context-audit.ts && node --experimental-strip-types --test tests/s03-context-audit.test.mts 2>&1 | grep -qE '# pass 9' && node --experimental-strip-types --test tests/s03-context-audit.test.mts 2>&1 | grep -qE '# fail 0'
