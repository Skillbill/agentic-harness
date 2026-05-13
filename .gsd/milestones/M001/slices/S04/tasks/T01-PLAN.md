---
estimated_steps: 1
estimated_files: 3
skills_used: []
---

# T01: Add pure renderContextAuditMarkdown + unit tests

Add a pure, dependency-free `renderContextAuditMarkdown(audit: ContextAudit | null, opts?: { now?: string }): string` function to `context-audit.ts` (and mirror in `context-audit.js` to satisfy the runtime `.js` specifier pattern from S03). The function must be 100% pure — input is a `ContextAudit` object (or null), output is a markdown block. No file I/O, no typebox import, no `load-codebase-doc` import. Output shape (one block, no trailing whitespace lines): a leading `Label: <label>` line, then `declared: [a, b]   (≈N tok)` (or `<none — no PLAN.md or no context-needed:>` when `declared` is null, or `[]` when declared is the empty list), then `loaded: [c, d]   (≈N tok, K calls)`, then `delta_token: ±N`, then a one-line synthesis sentence keyed to the label (`on-budget` / `over-load` / `under-load` / `divergent` / `no-declaration`), then an optional `errors:` sub-block (`  - <name>: <reason>` per entry) only when `errors.length > 0`. The null-audit branch emits `> Context audit not available — Inspector did not record \`load_codebase_doc\` calls for this task.` and nothing else. Token formatting may inline a 3-line `fmtN` helper to keep the module dep-free (do NOT import from `context-inspector.ts`). Write `tests/s04-context-audit-render.test.mts` with one node:test case per label (5) plus three edge cases: null audit, `declared:[]` with empty `loaded:{}` (must label `on-budget`), and errors-only happy path (declared loaded fine, plus one entry in `errors[]`). Each test asserts via `assert.match` / `assert.ok` on the literal lines (`Label:`, `declared:`, `loaded:`, `delta_token:`). No typebox shim is required because the test imports only `context-audit.{js,ts}`.

## Inputs

- ``context-audit.ts` — current pure accumulator from S03 T02; provides ContextAudit type and serializeAudit.`
- ``context-audit.js` — runtime sibling that must stay in sync.`
- ``.gsd/milestones/M001/slices/S03/S03-SUMMARY.md` — boundary map of the S03 contract (label semantics, errors shape).`

## Expected Output

- ``context-audit.ts` — exports new `renderContextAuditMarkdown` function (pure, no new deps).`
- ``context-audit.js` — runtime sibling updated identically.`
- ``tests/s04-context-audit-render.test.mts` — NEW; node:test suite covering 5 labels + 3 edge cases.`

## Verification

node --experimental-strip-types --test tests/s04-context-audit-render.test.mts 2>&1 | grep -E '^# (pass|fail) '
