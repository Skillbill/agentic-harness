# S03: Inspector: dichiarato vs effettivo — UAT

**Milestone:** M001
**Written:** 2026-05-12T15:52:25.940Z

## UAT Type

Test-fixture UAT (no live pi session required). The slice's must-have explicitly scopes proof to "contract — proven by pure-function tests over the audit accumulator and an OS-tmp fixture end-to-end test exercising the on-disk artifact shape."

## Preconditions

- Working directory: `/home/toto/scm-projects/agentic-harness/.gsd/worktrees/M001`.
- Node 22.x available on PATH (uses `--experimental-strip-types`).
- The four new/changed files exist: `plan-context.ts` (+ `plan-context.js` runtime sibling), `context-audit.ts` (+ `context-audit.js` runtime sibling), `context-inspector.ts`, and the three test files `tests/s02-plan-context-needed.test.mts`, `tests/s03-context-audit.test.mts`, `tests/s03-inspector-wire.test.mts`.

## Steps

1. From the worktree root, run the shared parser test:
   `node --experimental-strip-types --test tests/s02-plan-context-needed.test.mts`
2. Run the pure accumulator unit suite:
   `node --experimental-strip-types --test tests/s03-context-audit.test.mts`
3. Run the Inspector wire-in fixture test:
   `node --experimental-strip-types --test tests/s03-inspector-wire.test.mts`
4. Inspect a generated context-audit artifact: the fixture test in step 3 writes to an OS-tmp Inspector session directory; assert that on success the test reports `# pass` and creates both `summary.json` (with a `context` key) and `tasks/<T-NNN>/context-audit.json`.
5. (Smoke-grep) Confirm the `/ah:ctx-stats` command body in `context-inspector.ts` contains the literal block header `📚 Context audit`.

## Expected Outcomes

- Step 1: `# pass 2`, `# fail 0`.
- Step 2: `# pass 9`, `# fail 0`. All nine cases — declared-only / loaded-only / on-budget / under-load / over-load / divergent / pending-result handling / error surfacing / serializeAudit-strips-pending — green.
- Step 3: `# fail 0`. The e2e fixture asserts the on-disk shape of `summary.json.context[<T-NNN>]` and `tasks/<T-NNN>/context-audit.json` after synthesized `tool_call`/`tool_result` events.
- Step 4: Both JSON files exist for at least one task ID; the per-task file contains `declared`, `loaded`, `deltaToken`, `label`, and (when applicable) `errors`.
- Step 5: `grep -n '📚 Context audit' context-inspector.ts` returns at least one hit inside the `/ah:ctx-stats` handler.

## Edge Cases Exercised

- `context-needed: []` (legal empty declaration) → label `no-declaration` semantics for downstream comparison.
- `isError: true` tool result → surfaces under `errors: [{name, reason}]`, never silently dropped.
- Repeated successful load of the same stem → increments `calls` only; `bytes` / `approxTokens` / `firstSeenAt` remain frozen to the first load (cached-first-result semantics).
- `serializeAudit` strips the in-memory `pending` map before persistence so JSON round-trips are stable.

## Not Proven By This UAT

- A real, live pi session driving the extension end-to-end (deferred to S04, which renders the audit into `VERIFY.md`).
- Token figures are labelled "≈ tokens"; this UAT does not validate provider-grade tokenizer parity.
- Mid-session branch switches in `detectCurrentTask` are exercised only through the inlined `detectCurrentTaskLocal` helper, not against a real git operation.
- Cross-slice consumption by S04 (the `VERIFY.md` rendering path) — only the source artifacts (`summary.json.context` + `tasks/<T-NNN>/context-audit.json`) are proven here.
