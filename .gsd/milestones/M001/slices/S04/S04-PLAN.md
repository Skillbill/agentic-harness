# S04: Report fine-task 'Context audit' in VERIFY.md

**Goal:** Render the per-task ContextAudit (produced and persisted by S03) into a `## Context audit` section of `VERIFY.md` so a dev (and the next agent) sees declared / loaded / delta_token / label at a glance after `/ah:task-verify`. Add a pure renderer to `context-audit.ts` plus a `.js` sibling, expose it through a thin `ah:ctx-audit <T-NNN>` pi command in `context-inspector.ts`, and update `skills/ah-task-verify/INSTRUCTIONS.md` so the verify run materialises the section.
**Demo:** Un task completato end-to-end produce un VERIFY.md la cui sezione 'Context audit' mostra in formato tabellare/lista declared, loaded, delta_token, e una sintesi ('on-budget' / 'over-load' / 'under-load') ricavata dal confronto.

## Must-Haves

- `renderContextAuditMarkdown` exists in `context-audit.ts` (+ `.js` sibling), is pure (no I/O, no typebox import), handles all 5 labels, `errors[]`, null audit, and the `declared:[]` vs `declared:null` distinction; covered by `tests/s04-context-audit-render.test.mts`.
- `ah:ctx-audit <taskId>` command is registered in `context-inspector.ts`, locates the latest session by lexicographic directory name (no statSync), reads `tasks/<taskId>/context-audit.json`, and emits the rendered markdown via `ctx.ui.notify`; "no audit yet" returns a graceful message; covered by `tests/s04-ctx-audit-cmd.test.mts`.
- `skills/ah-task-verify/INSTRUCTIONS.md` adds §2.5 "Context audit (sezione)" and a step 6.5 instructing the verify run to materialise/replace a `## Context audit` block in `VERIFY.md`, keeping the existing single-path git invariant intact.
- Full milestone test suite green: `node --experimental-strip-types --test tests/s01-*.test.mts tests/s02-*.test.mts tests/s03-*.test.mts tests/s04-*.test.mts` reports 0 failures.

## Proof Level

- This slice proves: integration — produces the final visible artifact (`## Context audit` block in `VERIFY.md`) wired through the existing Inspector + verify skill; closes M001's end-to-end success criteria.

## Integration Closure

Upstream surfaces consumed: `context-audit.ts` types/serialisation (S03 T02), `context-inspector.ts` per-task `tasks/<T-NNN>/context-audit.json` writer (S03 T03), `skills/ah-task-verify/INSTRUCTIONS.md` first-run/re-run structure. New wiring: a new pi command (`ah:ctx-audit`) inside the existing `registerContextInspector` plus a textual step in the verify skill prompt template. After this slice the four ah-task-* skills round-trip declared→loaded→VERIFY.md without further plumbing.

## Verification

- New runtime signal: `ah:ctx-audit <T-NNN>` command output (rendered markdown via `ctx.ui.notify`).
- New visible artifact: `## Context audit` section inside `.pi/tasks/in-progress/<ID>-<slug>/VERIFY.md` showing declared / loaded / delta_token / label + optional errors block, refreshed on every `/ah:task-verify` run.
- Failure visibility: when the Inspector has not yet seen a `tool_call`, the renderer emits an explicit "Context audit not available — Inspector did not record load_codebase_doc calls for this task" line rather than crashing; PLAN.md parse failures surface as `errors[]` entries already captured by S03.
- No new redaction concerns: rendered content is the same data already persisted to disk under `.pi/context-inspector/`.

## Tasks

- [ ] **T01: Add pure renderContextAuditMarkdown + unit tests** `est:60m`
  Add a pure, dependency-free `renderContextAuditMarkdown(audit: ContextAudit | null, opts?: { now?: string }): string` function to `context-audit.ts` (and mirror in `context-audit.js` to satisfy the runtime `.js` specifier pattern from S03). The function must be 100% pure — input is a `ContextAudit` object (or null), output is a markdown block. No file I/O, no typebox import, no `load-codebase-doc` import. Output shape (one block, no trailing whitespace lines): a leading `Label: <label>` line, then `declared: [a, b]   (≈N tok)` (or `<none — no PLAN.md or no context-needed:>` when `declared` is null, or `[]` when declared is the empty list), then `loaded: [c, d]   (≈N tok, K calls)`, then `delta_token: ±N`, then a one-line synthesis sentence keyed to the label (`on-budget` / `over-load` / `under-load` / `divergent` / `no-declaration`), then an optional `errors:` sub-block (`  - <name>: <reason>` per entry) only when `errors.length > 0`. The null-audit branch emits `> Context audit not available — Inspector did not record \`load_codebase_doc\` calls for this task.` and nothing else. Token formatting may inline a 3-line `fmtN` helper to keep the module dep-free (do NOT import from `context-inspector.ts`). Write `tests/s04-context-audit-render.test.mts` with one node:test case per label (5) plus three edge cases: null audit, `declared:[]` with empty `loaded:{}` (must label `on-budget`), and errors-only happy path (declared loaded fine, plus one entry in `errors[]`). Each test asserts via `assert.match` / `assert.ok` on the literal lines (`Label:`, `declared:`, `loaded:`, `delta_token:`). No typebox shim is required because the test imports only `context-audit.{js,ts}`.
  - Files: `context-audit.ts`, `context-audit.js`, `tests/s04-context-audit-render.test.mts`
  - Verify: node --experimental-strip-types --test tests/s04-context-audit-render.test.mts 2>&1 | grep -E '^# (pass|fail) '

- [ ] **T02: Wire ah:ctx-audit command + audit locator into context-inspector** `est:75m`
  Add two pieces to `context-inspector.ts`. (1) Helper `findLatestAuditForTask(cwd: string, taskId: string): string | null` that lists entries in `.pi/context-inspector/` (the inspector root), filters to directories whose name matches the `${YYYYMMDD-HHMMSS}_${sid8}` pattern, sorts them lexicographically descending (NOT by mtime — the timestamp prefix is monotonic and survives clock skew across mounts, per the research), and returns the absolute path of `<dir>/tasks/<taskId>/context-audit.json` for the first session whose audit file exists; returns null if no session contains the file. (2) `pi.registerCommand('ah:ctx-audit', ...)` whose handler: parses the `<taskId>` arg, normalises to `T-NNN` (`T-NNN` regex; if missing arg, fall back to `detectCurrentTaskLocal(process.cwd())?.id`), calls `findLatestAuditForTask`, reads + JSON-parses the file, calls the T01 renderer, and emits the result via `ctx.ui.notify(markdown, 'info')`. When no audit file is found the handler emits the renderer's null-branch message instead of throwing. Keep the helper inside `context-inspector.ts` (the Inspector home) — do not push it into `context-audit.ts`, which must stay pure. Write `tests/s04-ctx-audit-cmd.test.mts` mirroring `tests/s03-inspector-wire.test.mts` (same typebox-shim preamble, same tmpdir + `git init` + `feature/T-001-demo` branch, same PLAN.md fixture with `context-needed: [CONVENZIONI]`). Drive one `session_start` + one `tool_call`/`tool_result` cycle for `CONVENZIONI`, then capture `ui.notify` arguments by passing a stub ctx whose `notify` pushes into an array; invoke `commands.get('ah:ctx-audit').handler('T-001', ctx)` and assert the captured string contains the literal substrings `Label:`, `declared: [CONVENZIONI]`, `loaded: [CONVENZIONI]`, and `delta_token:`. Add a second sub-test for the no-audit path: drop the audit file (or use a different `T-NNN`) and assert the message contains `Context audit not available`. Observer invariant from S03 must remain intact — the new code only reads from disk and calls a pure renderer.
  - Files: `context-inspector.ts`, `tests/s04-ctx-audit-cmd.test.mts`
  - Verify: node --experimental-strip-types --test tests/s04-ctx-audit-cmd.test.mts 2>&1 | grep -E '^# (pass|fail) '

- [ ] **T03: Wire ## Context audit section into ah-task-verify INSTRUCTIONS** `est:30m`
  Text-only update to `skills/ah-task-verify/INSTRUCTIONS.md`. (a) In the first-run skeleton inside §2a, insert a `## Context audit` heading between `## Definition of Done (globale)` (and its child blocks) and `## Verify Log`, with a single placeholder line `<!-- popolato dallo step 6.5 -->`. (b) Add a new §2.5 `Context audit (sezione)` immediately after the §2 group describing the section: one paragraph stating that it mirrors the latest `tasks/<T-NNN>/context-audit.json` produced by the Context Inspector via `ah:ctx-audit <T-NNN>`, reset on every run like the DoD checkboxes (decision V-4 parity), with declared / loaded / delta_token / label and an optional `errors:` sub-block. (c) Insert a new numbered step 6.5 between the existing step 6 (`Scrivi il log della run`) and step 7 (`Mostra il report al dev`): the step instructs the agent to invoke `ah:ctx-audit <T-NNN>` (or read the JSON directly if the command is unavailable), then on first run append the rendered block under the new `## Context audit` heading, and on subsequent runs REPLACE the body of that section (do not append history — same semantics as the DoD reset). Keep the §Git Safety Rule invariant: the only path that may change is still `.pi/tasks/in-progress/<ID>-<slug>/VERIFY.md`. Do not modify any other section heading, numbering, or git command. Verification is mechanical: greps must find the new heading, §2.5, and step 6.5 (`grep -q '^## Context audit' skills/ah-task-verify/INSTRUCTIONS.md`, `grep -q 'ah:ctx-audit' skills/ah-task-verify/INSTRUCTIONS.md`, `grep -q 'Context audit (sezione)' skills/ah-task-verify/INSTRUCTIONS.md`); the existing §Git Safety block and the §2a skeleton must still be present (`grep -q 'Git Safety Rule' skills/ah-task-verify/INSTRUCTIONS.md`, `grep -q '## Verify Log' skills/ah-task-verify/INSTRUCTIONS.md`).
  - Files: `skills/ah-task-verify/INSTRUCTIONS.md`
  - Verify: grep -q '^## Context audit' skills/ah-task-verify/INSTRUCTIONS.md && grep -q 'ah:ctx-audit' skills/ah-task-verify/INSTRUCTIONS.md && grep -q 'Context audit (sezione)' skills/ah-task-verify/INSTRUCTIONS.md && grep -q 'Git Safety Rule' skills/ah-task-verify/INSTRUCTIONS.md && grep -q '## Verify Log' skills/ah-task-verify/INSTRUCTIONS.md

## Files Likely Touched

- context-audit.ts
- context-audit.js
- tests/s04-context-audit-render.test.mts
- context-inspector.ts
- tests/s04-ctx-audit-cmd.test.mts
- skills/ah-task-verify/INSTRUCTIONS.md
