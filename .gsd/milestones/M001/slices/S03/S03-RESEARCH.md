# S03: Inspector — dichiarato vs effettivo — Research

**Date:** 2026-05-12

## Summary

S03 closes the measurement half of the M001 context-calibration loop. S01 introduced an INDEX-based on-demand loader (`load_codebase_doc` registered via `pi.registerTool`). S02 turned the per-task declaration into a parseable YAML frontmatter contract in `PLAN.md` (`context-needed: [stem1, stem2]`). S03 must extend the existing **Context Inspector** (`context-inspector.ts`, ~470 LOC, observer-only) to compute and persist three signals per task — `declared` (from `PLAN.md`), `loaded` (from runtime `load_codebase_doc` tool events), and `delta_token` (a numeric over/under-load indicator) — and surface them in `/ah:ctx-stats` plus a structured artifact that S04 can render into `VERIFY.md`.

The right primitives are already in place: pi exposes `tool_call` and `tool_result` events with `event.toolName`, `event.input`, `event.toolCallId`, `event.content`, and `event.isError` (extensions.md §"Tool Events"). The Inspector is already wired to `before_provider_request`/`message_end`/`turn_end` and writes ndjson + summary.json under `.pi/context-inspector/<ts>_<sid>/`. The active task is already detected via `detectCurrentTask(cwd)` in `index.ts` and is keyed off `feature/T-NNN-<slug>` branches. The frontmatter parser is already prototyped in `tests/s02-plan-context-needed.test.mts` (the canonical `parseContextNeeded` implementation that S03 is required to reuse — explicit follow-up from S02 SUMMARY).

Recommendation: **add a thin per-task context-audit module to the Inspector, source `declared` from PLAN.md frontmatter via the extracted S02 parser, source `loaded` from `tool_call`/`tool_result` events filtered by `event.toolName === 'load_codebase_doc'`, and define `delta_token = approx(loaded_bytes) - approx(declared_budget)` with a qualitative label.** Keep the Inspector observer-only (no in-flight mutation, consistent with D-Q3=A). Persist per-task data both inline in `summary.json` (extending the existing schema) and as a discrete `context-audit.json` file so S04 can render without re-scanning ndjson.

## Recommendation

**Build approach:** Extend `context-inspector.ts` rather than introducing a sibling module. The Inspector already owns session lifecycle, ndjson plumbing, summary persistence, and the `/ah:ctx-stats` UI — adding a `context` block keeps state coherent and avoids a second writer to `.pi/context-inspector/`. Extract `parseContextNeeded` from the S02 test into a new module so both the Inspector and the test share one implementation.

**Data flow:**
1. On `session_start` or `turn_start` (whichever fires after the branch is established): call `detectCurrentTask(cwd)`. If a task is active, locate `PLAN.md` at `dirname(taskFile)/PLAN.md`. If it exists, parse `context-needed:` into `declared: string[]`. Store under `current.context[taskId] = { declared, loaded: {}, ... }`.
2. On `tool_call` with `event.toolName === 'load_codebase_doc'`: register `event.toolCallId → event.input.name` into a pending map.
3. On `tool_result` with the same `toolCallId`: read `event.content` byte size, `event.isError`. Promote the entry into `loaded` keyed by stem with `{ bytes, approxTokens, errored, calls }` (calls increments on repeats).
4. After each `tool_result`, recompute `delta_token` and persist `summary.json` + `tasks/<T-NNN>/context-audit.json`.
5. Extend `/ah:ctx-stats` with a "📚 Context audit" block showing `declared: [...]`, `loaded: [...]`, `delta_token: ±N`, and the qualitative label (`on-budget` / `over-load` / `under-load` / `loaded ⊊ declared`).

**Budget definition:** S02 declares stems, not byte budgets. The `declared` token cost is therefore computed by reading each `declared` stem's file size at parse time (via `resolveCodebaseDocPath` from `load-codebase-doc.ts` — already path-safe) and summing `Math.round(bytes/4)`. `loaded_token` is the sum of `tool_result.content` byte→token approximations. This keeps the math consistent with the Inspector's existing `approxTokens()` heuristic.

**Qualitative label** (derived from set comparison + delta):

| Loaded set vs declared set | delta_token | Label |
|---|---|---|
| `loaded == declared` | ≈0 | `on-budget` |
| `loaded ⊊ declared` (proper subset) | <0 | `under-load` (some declared docs never read) |
| `loaded ⊋ declared` (extras) | >0 | `over-load` (read docs not declared) |
| `loaded ≠ declared`, overlap and extras both present | any | `divergent` |

This three-tier classification matches the S03 acceptance criterion verbatim: "*riporta: declared: [...], loaded: [...], delta_token: <numero>, e segnala l'over/under-load qualitativo (es. 'loaded ⊊ declared')*".

## Implementation Landscape

### Key Files

- `context-inspector.ts` (467 lines) — **primary edit.** Add a `ContextAudit` map to `SessionCtx`, register `tool_call`/`tool_result` listeners, extend `/ah:ctx-stats` output. The `Totals.tools` counter at L302–311 today counts tool **declarations in the request schema**, not actual invocations — leave it alone; S03 needs a separate counter sourced from `tool_call` events. Lines 287–376 (the `registerContextInspector` body) is where all four new listeners attach.
- `tests/s02-plan-context-needed.test.mts` — **source of the parser.** Lines 4–43 (`NAME_PATTERN` + `parseContextNeeded`) are the canonical implementation. Extract verbatim into a new module so the Inspector and the test share one implementation; update the test to import from the new module.
- `load-codebase-doc.ts` (83 lines) — **reuse `resolveCodebaseDocPath` (L12–36)** to compute the byte budget of each `declared` stem path-safely. No changes needed.
- `index.ts` — **reuse `detectCurrentTask` (L37–62)** to find the active task and its `PLAN.md` (sibling of `TASK.md` at `dirname(taskFile)/PLAN.md`). No changes needed.
- `.pi/context-inspector/<ts>_<sid>/` — **output location.** Add `summary.json.context` block and per-task `tasks/<T-NNN>/context-audit.json` file. Both consumed by S04.

### Build Order

Build in three thin commits so each can be verified independently:

1. **Parser extraction** — move `parseContextNeeded` into a shared module (`plan-context.ts` at worktree root); have `tests/s02-plan-context-needed.test.mts` import from it; re-run the S02 test verbatim. This proves the extraction is non-breaking before any Inspector wiring touches it. This unblocks every downstream step.
2. **Tool-event capture + per-task state** — wire `tool_call` and `tool_result` listeners filtered by `toolName === 'load_codebase_doc'`; build the per-task `loaded` map keyed by stem; persist into `summary.json` under a new `context` key. Verified by a unit test that dispatches fake events through the listener body and inspects the resulting JSON shape.
3. **Declared/delta + UI + per-task file** — read `PLAN.md` via `detectCurrentTask`, compute `declared` token budget by summing file sizes, compute `delta_token` + label, write `tasks/<T-NNN>/context-audit.json`, extend `/ah:ctx-stats`. Verified by a fixture test that builds a fake `.pi/codebase/`, fake `.pi/tasks/in-progress/T-NNN-x/`, drives the state machine, and asserts both the on-disk artifact shape and a computed delta value.

**First proof:** step 1 — the parser must be testable in isolation before the Inspector depends on it; getting the file path right also locks S04's parser source.

### Verification Approach

Three layers, each runnable verbatim from the worktree like S01/S02 (`node --experimental-strip-types --test tests/<file>.test.mts`):

- **Parser:** the existing S02 test re-points its import to `plan-context.ts` and still passes — proves the move is byte-identical.
- **Inspector tool-event accumulator (new test `tests/s03-context-audit.test.mts`):** import the new audit-builder helper as a pure function, feed it a sequence of `{toolName, toolCallId, input}` and `{toolName, toolCallId, content, isError}` records, assert `loaded[stem] = { bytes, approxTokens, calls }` aggregates correctly across repeats and errors (errored results count `errored++`, do not contribute to `bytes`).
- **End-to-end fixture (same test file or a sibling):** build an OS-tmp fixture with `.pi/codebase/CONVENZIONI.md` + `STRUTTURA.md` + `INDEX.md`, a `.pi/tasks/in-progress/T-001-x/` with `TASK.md` + `PLAN.md` containing `context-needed: [CONVENZIONI]`, simulate loading both stems, then assert the computed audit emits `declared:[CONVENZIONI], loaded:[CONVENZIONI,STRUTTURA], delta_token>0, label:'over-load'`.

The slice's acceptance is `/ah:ctx-stats` printing the three fields. A runtime-only check is not strictly necessary because the underlying state is fully testable as a pure function over events; the command handler is a thin pretty-printer.

## Don't Hand-Roll

| Problem | Existing Solution | Why Use It |
|---|---|---|
| Parsing `context-needed:` from PLAN.md frontmatter | `parseContextNeeded` in `tests/s02-plan-context-needed.test.mts:8–43` | Already validated by S02 — extract, don't rewrite. The test doubles as documentation; S02 SUMMARY explicitly flags this as a follow-up. |
| Path-safe access to `.pi/codebase/<stem>.md` for the declared budget | `resolveCodebaseDocPath(cwd, name)` in `load-codebase-doc.ts:12–36` | Already enforces NAME_PATTERN + `path.resolve` containment + trailing-separator check. Reusing it eliminates an attack-surface duplication. |
| Active-task detection | `detectCurrentTask(cwd)` in `index.ts:37–62` | Branch-driven, idempotent, already used by the second `before_agent_start` hook. The Inspector should call it on demand rather than thread state through. |
| Byte→token approximation | `approxTokens(bytes)` in `context-inspector.ts:71–75` | One-line helper, consistent with the rest of the Inspector's heuristics. Using anything else would force two different "token" numbers in the same `summary.json`. |
| ndjson append + summary.json snapshot pattern | `appendFileSync` + `persistSummary` (already in `context-inspector.ts`) | Idempotent on each event, crash-safe enough for an observer extension; do not introduce a new persistence layer. |

## Constraints

- **Worktree has no `package.json`**, only a global-host-symlinked `node_modules/typebox` (S01 self-heal pattern). Any new test that imports `load-codebase-doc.ts` transitively pulls in `typebox` — the test must replicate S01's preflight symlink shim, **or** the audit logic must be split so the unit-testable core does not transitively import `typebox`. The cleanest path is a pure `context-audit.ts` module that takes `(cwd, taskFile, eventStream)` inputs and never imports `load-codebase-doc.ts` at module scope (only `parseContextNeeded` + a local re-implementation or a same-shape helper).
- **D-Q3=A is non-negotiable:** the Inspector remains observer-only. `before_provider_request` must continue returning `undefined` (`context-inspector.ts:324`); no in-flight rewrites; no warnings injected into the prompt. S03 only writes files and prints to `/ah:ctx-stats`.
- **Single-session, single-task assumption.** A pi session can outlive a single task (branch switch mid-session). The audit must therefore key its state by `taskId`, not by session. `detectCurrentTask` must be re-called on every relevant event, not cached at session_start alone.
- **`load_codebase_doc` is the only counted channel.** If the LLM reads a codebase doc via the generic `read` tool (S02 reframed this as an "ad-hoc code-file loophole"), it does NOT count toward `loaded` and the qualitative label will read `loaded ⊊ declared` — that's a feature, not a bug, and the right signal for a future S04 follow-up.
- **`tool_call` event semantics** (extensions.md L674–706): in parallel-tool mode, sibling tool calls preflight sequentially but execute concurrently. Pair `tool_call` with `tool_result` via `toolCallId`, never positional order.
- **`tool_result.content` shape**: an array of content blocks (`[{type:'text', text:'...'}]` for `load_codebase_doc`; `isError:true` if `resolveCodebaseDocPath` returned `ok:false`). Compute bytes from `JSON.stringify(event.content)` length to stay consistent with `sizeOf()` in the Inspector.

## Common Pitfalls

- **Counting tool *declarations* instead of tool *invocations*.** `Totals.tools` at `context-inspector.ts:302–311` increments once per request per tool-schema-presence. S03 needs invocation counts — sourced from `tool_call`, not from the request schema. Do not "extend" `Totals.tools`; add a separate `current.context[taskId].loaded` map. S01 SUMMARY incorrectly suggested the existing infra already captured invocations under `totals.tools`; that was a planning claim, not a measured fact.
- **Trusting `tool_result.content` to be a string.** It is an array of content blocks. Always JSON-stringify before measuring bytes.
- **Trusting message-block walks to recover tool names.** `analyzePayload` only sets `hasToolCalls` (L218, L227) — it does not capture the tool *name* or *input*. Do not retrofit name extraction there; use the dedicated `tool_call` event.
- **Loading PLAN.md on `session_start` only.** Branch switches happen; `detectCurrentTask` re-runs in the second `before_agent_start` hook for this exact reason. Mirror that pattern.
- **Treating a missing `context-needed:` key as `[]`.** S02 chose: missing key tolerated by parsers but never produced. Treat absent key as "task pre-dates the contract" → set `declared: null` and emit `label: 'no-declaration'` instead of synthesizing an empty list. Same for "no PLAN.md yet" (task in `discuss` phase).
- **Off-by-one on stem-vs-filename.** `declared` stems have no `.md` (S02 contract). `loaded` stems come from `tool_call.event.input.name` which is also bare (`load-codebase-doc.ts` rejects names with dots). Set arithmetic compares bare stems directly — no normalization required.

## Open Risks

- **typebox transitive dep**: if the Inspector ends up importing anything that pulls `typebox` into the test path, the test must mimic S01's symlink self-heal. Mitigation: keep the audit core in a pure module with zero runtime dependencies.
- **Token approximation honesty**: `bytes/4` is a coarse estimate. The Inspector also tracks `usageInput` from the provider (authoritative). For S03's qualitative label this is fine — direction matters, not magnitude — but the report must label the figure as "≈ tokens", not "tokens", to avoid implying provider-grade accuracy. S04 may want to additionally surface `usageInput` as a sanity floor.
- **Repeated loads of the same doc** (legal — the LLM may re-read for refresh). The accumulator must increment `calls` but only count bytes once (treat the doc as cached after the first successful load). Otherwise `delta_token` inflates artificially.
- **Tool failures** (`isError:true` — e.g., NAME_PATTERN reject, traversal, missing file). These should be counted under a separate `errors: [{name, reason}]` array so S04 can render them as red flags, but must not contribute to `loaded` bytes.
- **Inspector started after task is mid-flight**: if pi starts a session with the LLM already in-turn (replay/resume), `tool_call` for the first invocations may be missed. Mitigation: also seed `loaded` lazily by scanning `requests.ndjson` for past `tool_use` blocks named `load_codebase_doc` when the audit module first activates for a task — best effort, document as a known limitation if it doesn't fit the slice budget.

## Skills Discovered

None applicable. This is pure local TypeScript on a known event API; the relevant guidance is already inlined (extensions.md is on disk under the pi-coding-agent install).

## Sources

- pi extensions API — `tool_call` / `tool_result` event shape and ordering guarantees (`@earendil-works/pi-coding-agent/docs/extensions.md:674–770`).
- pi extensions API — `tool_execution_start/update/end` lifecycle (`extensions.md:570–590`).
- S01 SUMMARY — Inspector tool_use auto-capture claim (file `.gsd/milestones/M001/slices/S01/S01-SUMMARY.md`) reviewed and partially corrected here: the existing capture is at request-schema level, not invocation level.
- S02 SUMMARY — frontmatter contract, `parseContextNeeded` test as canonical implementation, explicit follow-up "S03 declared-vs-loaded Inspector parser must reuse the regex from `tests/s02-plan-context-needed.test.mts` as the `declared:` source".
- M001 CONTEXT — D-Q3=A (Inspector osservatore + decisore separato, no in-flight intervention).
