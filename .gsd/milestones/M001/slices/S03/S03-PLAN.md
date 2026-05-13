# S03: Inspector: dichiarato vs effettivo

**Goal:** Extend the Context Inspector to compute, persist, and surface declared-vs-loaded per-task context: read `context-needed:` from `PLAN.md`, capture `load_codebase_doc` tool invocations from runtime `tool_call`/`tool_result` events, compute `delta_token` plus a qualitative label, write the result both into `summary.json.context` and a per-task `tasks/<T-NNN>/context-audit.json`, and render the audit in `/ah:ctx-stats`. The Inspector stays observer-only (D-Q3=A): no in-flight payload mutation.
**Demo:** Dopo l'esecuzione di un task reale, /ah:ctx-stats riporta: declared: [a, b, c], loaded: [a, b], delta_token: <numero>, e segnala l'over/under-load qualitativo (es. 'loaded ⊊ declared').

## Must-Haves

- After a task runs through the extension, `/ah:ctx-stats` prints a "📚 Context audit" block with `declared: [...]`, `loaded: [...]`, `delta_token: ±N`, and a qualitative label (`on-budget` / `under-load` / `over-load` / `divergent` / `no-declaration`). The same data is persisted to `.pi/context-inspector/<ts>_<sid>/summary.json` under a new `context` key and mirrored per task at `.pi/context-inspector/<ts>_<sid>/tasks/<T-NNN>/context-audit.json`. S02's frontmatter parser is shared between the test and the Inspector via `plan-context.ts`. All three new test files run verbatim with `node --experimental-strip-types --test` and pass.

## Proof Level

- This slice proves: contract — proven by pure-function tests over the audit accumulator and an OS-tmp fixture end-to-end test exercising the on-disk artifact shape. No live pi session required at slice level (the command handler is a thin pretty-printer over the persisted state).

## Integration Closure

Upstream surfaces consumed: `parseContextNeeded` (from S02 test, extracted to `plan-context.ts`); `resolveCodebaseDocPath` from `load-codebase-doc.ts` (used to compute declared byte budget path-safely); `detectCurrentTask` from `index.ts` (re-called per event to handle mid-session branch switches); pi `tool_call`/`tool_result` events. New wiring introduced in this slice: two listeners (`tool_call`, `tool_result`) registered inside `registerContextInspector`, a `context: Record<taskId, ContextAudit>` block on `SessionCtx`, a per-task `context-audit.json` writer, and a new "📚 Context audit" section in `/ah:ctx-stats`. Remaining before milestone is end-to-end usable: S04 (render the audit into `VERIFY.md`).

## Verification

- Adds a per-task on-disk artifact (`tasks/<T-NNN>/context-audit.json`) and a `summary.json.context` block that together let a future agent inspect, with no live runtime, exactly which codebase docs were declared vs read for any past task — answering "did the context-selection contract hold?" by reading two JSON files. `/ah:ctx-stats` exposes the same data interactively. Tool failures (`isError:true` results from `load_codebase_doc`) are surfaced under a separate `errors: [{name, reason}]` array in the audit, not silently dropped. Token figures are labelled "≈ tokens" to avoid implying provider-grade accuracy.

## Tasks

- [ ] **T01: Extract parseContextNeeded into shared plan-context.ts** `est:20m`
  Move the canonical YAML-frontmatter parser for `context-needed:` out of the S02 test and into a new module `plan-context.ts` at the worktree root so the Inspector and the test share one implementation. Re-point `tests/s02-plan-context-needed.test.mts` to import from the new module. Byte-identical behavior — no logic changes. This unblocks T02/T03.
  - Files: `plan-context.ts`, `tests/s02-plan-context-needed.test.mts`
  - Verify: test -f plan-context.ts && grep -q 'export function parseContextNeeded' plan-context.ts && grep -q 'export const NAME_PATTERN' plan-context.ts && grep -q "from '../plan-context.js'" tests/s02-plan-context-needed.test.mts && ! grep -qE '^function parseContextNeeded' tests/s02-plan-context-needed.test.mts && node --experimental-strip-types --test tests/s02-plan-context-needed.test.mts 2>&1 | grep -qE '# pass 2'

- [ ] **T02: Build pure context-audit core module + accumulator tests** `est:75m`
  Create a pure, dependency-free `context-audit.ts` module that owns the per-task state machine. The module is imported by the Inspector but is unit-testable in isolation — it must NOT import `load-codebase-doc.ts` at module scope (transitively pulls `typebox` into the test path).
  - Files: `context-audit.ts`, `tests/s03-context-audit.test.mts`
  - Verify: test -f context-audit.ts && ! grep -qE "from ['\"]\\./load-codebase-doc" context-audit.ts && ! grep -qE "from ['\"]typebox" context-audit.ts && ! grep -qE 'pi-coding-agent' context-audit.ts && grep -q 'export function createAudit' context-audit.ts && grep -q 'export function onToolCall' context-audit.ts && grep -q 'export function onToolResult' context-audit.ts && grep -q 'export function recomputeDelta' context-audit.ts && grep -q 'export function serializeAudit' context-audit.ts && node --experimental-strip-types --test tests/s03-context-audit.test.mts 2>&1 | grep -qE '# pass 9' && node --experimental-strip-types --test tests/s03-context-audit.test.mts 2>&1 | grep -qE '# fail 0'

- [ ] **T03: Wire context-audit into Inspector + extend /ah:ctx-stats + end-to-end fixture test** `est:2h`
  Glue T02's pure core into the Inspector and ship the runtime observable artifacts. This is the slice's closing increment — after this, `/ah:ctx-stats` shows the audit and the per-task JSON file exists on disk.
  - Files: `context-inspector.ts`, `tests/s03-inspector-wire.test.mts`
  - Verify: grep -q "from './context-audit.js'" context-inspector.ts && grep -q "from './plan-context.js'" context-inspector.ts && grep -qE "pi\\.on\\(['\"]tool_call['\"]" context-inspector.ts && grep -qE "pi\\.on\\(['\"]tool_result['\"]" context-inspector.ts && grep -q '📚 Context audit' context-inspector.ts && grep -q 'context-audit.json' context-inspector.ts && grep -q 'context: {}' context-inspector.ts && node --experimental-strip-types --test tests/s03-inspector-wire.test.mts 2>&1 | grep -qE '# fail 0' && node --experimental-strip-types --test tests/s03-context-audit.test.mts 2>&1 | grep -qE '# fail 0' && node --experimental-strip-types --test tests/s02-plan-context-needed.test.mts 2>&1 | grep -qE '# fail 0'

## Files Likely Touched

- plan-context.ts
- tests/s02-plan-context-needed.test.mts
- context-audit.ts
- tests/s03-context-audit.test.mts
- context-inspector.ts
- tests/s03-inspector-wire.test.mts
