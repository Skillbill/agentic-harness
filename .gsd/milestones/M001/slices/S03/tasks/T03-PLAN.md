---
estimated_steps: 41
estimated_files: 2
skills_used: []
---

# T03: Wire context-audit into Inspector + extend /ah:ctx-stats + end-to-end fixture test

Glue T02's pure core into the Inspector and ship the runtime observable artifacts. This is the slice's closing increment — after this, `/ah:ctx-stats` shows the audit and the per-task JSON file exists on disk.

Wiring inside `registerContextInspector` (context-inspector.ts):
1. Extend `SessionCtx` with `context: Record<taskId, ContextAudit>` (initialized to `{}` in `initSession`).
2. Add a small helper `ensureAuditForCurrentTask(cwd, sc)` that: (a) calls `detectCurrentTask(cwd)` re-imported from `./index.js` (or inlines the same 25-line function — pick whichever avoids a module cycle; document the choice in a one-line comment), (b) if no task, returns null, (c) else if `sc.context[task.id]` exists, returns it, (d) else reads `dirname(task.taskFile)/PLAN.md` if present and parses `context-needed:` via `parseContextNeeded` from `plan-context.ts`; if parser fails or file absent, declared := null; (e) for each declared stem, compute byte budget by calling `resolveCodebaseDocPath(cwd, stem)` and if `ok`, statSync(path).size; sum and approx-token via local `/ 4` math; if any stem fails to resolve, treat its contribution as 0 and append an entry to `errors`; (f) stores the audit in `sc.context[task.id]` and returns it. Re-call this on every `tool_call`/`tool_result` (cheap idempotent check after first hit).
3. Register `pi.on('tool_call', ...)`: ensure audit, then `onToolCall(audit, {toolName: event.toolName, toolCallId: event.toolCallId, input: event.input})`.
4. Register `pi.on('tool_result', ...)`: ensure audit, then `onToolResult(audit, {toolCallId: event.toolCallId, content: event.content, isError: event.isError}, new Date().toISOString())`. Then call new helper `persistContextAudit(sc, audit)` which (a) sets `sc.totals` is NOT touched — instead writes a sibling key by maintaining a second JSON snapshot under `sc.summaryFile` (rewrite logic: write `{...totals, context: Object.fromEntries(Object.entries(sc.context).map(([k,v]) => [k, serializeAudit(v)]))}`), and (b) writes `tasks/<taskId>/context-audit.json` with `serializeAudit(audit)` (mkdirSync recursive).
5. Extend `/ah:ctx-stats` handler: after the existing 'Tool dichiarati' block, iterate `Object.entries(current.context)` and for each task print:
   ```
   📚 Context audit — <taskId>
      declared:    [a, b, c]   (≈N tok)
      loaded:      [a, b]      (≈M tok, K calls)
      delta_token: ±D
      label:       <on-budget|under-load|over-load|divergent|no-declaration>
      errors:      <count> (if >0, list each as 'stem: reason')
   ```
   When `declared===null`, print `declared: <none — no PLAN.md or no context-needed:>`. Token figures must be labelled with the `≈` prefix (research §Open Risks).

Observer-only invariant: neither `tool_call` nor `tool_result` listeners may return a non-undefined value. Verify by grep: no `return {` inside the new listener blocks.

New end-to-end fixture test `tests/s03-inspector-wire.test.mts`:
- Build an OS-tmp fixture with `.pi/codebase/INDEX.md`, `.pi/codebase/CONVENZIONI.md` (≈400 bytes), `.pi/codebase/STRUTTURA.md` (≈200 bytes), and `.pi/tasks/in-progress/T-001-demo/TASK.md` + `PLAN.md` containing `---\nestimated_steps: 2\ncontext-needed: [CONVENZIONI]\n---`.
- Self-heal typebox via the S01 symlink shim so importing context-inspector.ts (which transitively imports load-codebase-doc.ts? — confirm during execution; if the Inspector itself does NOT import load-codebase-doc.ts at module scope you can skip the shim, but the fixture also needs to call `resolveCodebaseDocPath` directly so prefer to keep the shim).
- Construct a minimal mock pi with `.on(event, handler)` storing handlers and `.registerTool/.registerCommand` storing definitions. Call `registerContextInspector(mockPi)`. Invoke the `session_start` handler with a fake `ctx` exposing `sessionManager.getSessionId()` and `ui.notify`. Drive `process.chdir(fixtureRoot)` and ensure `git branch --show-current` resolves to `feature/T-001-demo` — either by initializing a real git repo in the fixture or by stubbing `execSync` via a re-exported indirection in `index.ts` (least-invasive: `git init && git checkout -b feature/T-001-demo`).
- Dispatch a `tool_call` event with `{toolName:'load_codebase_doc', toolCallId:'tc1', input:{name:'CONVENZIONI'}}`, then a `tool_result` with `{toolCallId:'tc1', content:[{type:'text', text: 'X'.repeat(390)}], isError: false}`. Then a `tool_call`/`tool_result` pair for `STRUTTURA` (NOT declared).
- Assert the on-disk artifacts: (a) `summary.json` contains a `context['T-001'].loaded.CONVENZIONI` entry with `calls:1`, (b) `summary.json.context['T-001'].label === 'over-load'`, (c) `summary.json.context['T-001'].declared === ['CONVENZIONI']`, (d) `tasks/T-001/context-audit.json` exists with the same shape, (e) errors array empty.
- Negative case (same test file or sibling): a `tool_call` with `{name:'NONEXISTENT'}` then a `tool_result` with `isError:true` produces an `errors[0].name === 'NONEXISTENT'` entry and does NOT add to `loaded`.

Failure modes:
| Dependency | On error | On timeout | On malformed response |
|-|-|-|-|
| `parseContextNeeded` | declared:=null, label:='no-declaration', do not throw | n/a (pure) | log to errors[] with reason:'parse-failed' |
| `resolveCodebaseDocPath` for declared budget | exclude stem from budget sum, log to errors[] | n/a | n/a |
| `tool_result` without matching `pending[toolCallId]` | ignore (no-op) — likely a non-load_codebase_doc tool | n/a | n/a |
| `detectCurrentTask` returns null | no audit created; listeners no-op | n/a | n/a |

Load profile: per-task audit map is O(#stems-loaded). Each tool_result re-serializes `summary.json` (synchronous fs write). 10x breakpoint: writes-per-second ceiling — acceptable because tool_result events are LLM-paced (sub-Hz). Per-op cost: one JSON.stringify + one writeFileSync per tool_result.

Negative tests: covered by the end-to-end fixture (declared==loaded → on-budget; declared⊊loaded → over-load; isError → errors[], no loaded entry; missing PLAN.md → no-declaration). Add an assertion that the Inspector's `tool_call`/`tool_result` listeners return `undefined` (observer-only invariant) by inspecting return values from the handler dispatch.

Must-haves:
- context-inspector.ts imports `createAudit, onToolCall, onToolResult, serializeAudit` from `./context-audit.js` and `parseContextNeeded` from `./plan-context.js`.
- Two new `pi.on('tool_call', ...)` and `pi.on('tool_result', ...)` listeners are present and neither contains a `return {` (observer-only).
- `initSession` initializes `context: {}` on the returned SessionCtx and `SessionCtx` type/interface is extended accordingly.
- `/ah:ctx-stats` handler body contains the literal string `📚 Context audit` and the literal `≈` prefix on at least one token figure.
- The end-to-end test passes (`node --experimental-strip-types --test tests/s03-inspector-wire.test.mts` exits 0 with `# pass` matching the case count and `# fail 0`).
- D-Q3=A invariant preserved: `before_provider_request` still returns `undefined` at the existing site, and neither new listener returns a non-undefined value (assert by grep + by test-level return-value inspection).

Skills the executor should load: tdd, verify-before-complete, observability, error-handling-patterns.

## Inputs

- ``context-audit.ts` — pure core from T02 (createAudit, onToolCall, onToolResult, serializeAudit)`
- ``plan-context.ts` — parser from T01`
- ``context-inspector.ts` — primary edit target (existing 467 LOC, observer-only)`
- ``index.ts` — read-only reference for `detectCurrentTask` (lines 37-62); decide between import vs inline at coding time`
- ``load-codebase-doc.ts` — read-only reference for `resolveCodebaseDocPath` used to compute declared byte budget`
- ``tests/s01-load-on-demand.test.mts` — pattern reference for the typebox self-heal symlink shim`

## Expected Output

- ``context-inspector.ts` — extended SessionCtx, two new pi.on listeners, audit persistence, /ah:ctx-stats audit block`
- ``tests/s03-inspector-wire.test.mts` — end-to-end fixture test that builds an OS-tmp .pi/ tree, drives the listeners, and asserts on-disk shape`

## Verification

grep -q "from './context-audit.js'" context-inspector.ts && grep -q "from './plan-context.js'" context-inspector.ts && grep -qE "pi\\.on\\(['\"]tool_call['\"]" context-inspector.ts && grep -qE "pi\\.on\\(['\"]tool_result['\"]" context-inspector.ts && grep -q '📚 Context audit' context-inspector.ts && grep -q 'context-audit.json' context-inspector.ts && grep -q 'context: {}' context-inspector.ts && node --experimental-strip-types --test tests/s03-inspector-wire.test.mts 2>&1 | grep -qE '# fail 0' && node --experimental-strip-types --test tests/s03-context-audit.test.mts 2>&1 | grep -qE '# fail 0' && node --experimental-strip-types --test tests/s02-plan-context-needed.test.mts 2>&1 | grep -qE '# fail 0'

## Observability Impact

Adds (1) a per-task on-disk artifact at `.pi/context-inspector/<ts>_<sid>/tasks/<T-NNN>/context-audit.json` containing declared, loaded, delta_token, label, errors; (2) a new `context` key on `summary.json` mirroring the same data session-wide; (3) a '📚 Context audit' section in the `/ah:ctx-stats` command output. A future agent debugging context-selection mistakes can inspect either artifact with no live runtime. Tool failures (`isError:true` from `load_codebase_doc`) are first-class via the `errors:[]` array, not silently dropped. Token figures are explicitly approximate (`≈N tok`).
