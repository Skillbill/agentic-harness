---
phase: complete-milestone
phase_name: Milestone Closeout
project: agentic-harness
generated: 2026-05-13T08:30:00Z
counts:
  decisions: 6
  lessons: 5
  patterns: 6
  surprises: 3
missing_artifacts: []
---

# M001 — Structured Learnings

## Milestone

**M001: Consolidamento harness + calibrazione contesto LLM.** Replaced forced full-body codebase injection with an INDEX + on-demand loader, made per-task context selection an explicit PLAN.md frontmatter contract, wired the Context Inspector as a pure observer of declared-vs-loaded, and surfaced the audit inside VERIFY.md + a dedicated `ah:ctx-audit` command.

### Decisions

- **D-Q1 → on-demand context loading (INDEX + load_codebase_doc tool).** Replaced `index.ts:119-159` forced-injection of full `.pi/codebase/*.md` bodies with a compact `.pi/codebase/INDEX.md` (≤500 tokens) plus a `load_codebase_doc({name})` `pi.registerTool`; the LLM decides which doc to pull and when. Source: M001-CONTEXT.md/Decisioni chiave
- **D-Q2 → PLAN.md `context-needed:` is the single producer/consumer contract.** `ah-task-plan` is the sole producer; `ah-task-execute` is the sole consumer; `ah-task-discuss` runs before PLAN exists and uses INDEX + on-demand judgment without referencing `context-needed:`. Empty list `context-needed: []` is legal and must be emitted. Source: S02-SUMMARY.md/key_decisions
- **D-Q3 → Inspector stays observer-only; decisore separato.** `tool_call` / `tool_result` listeners accumulate `declared` vs `loaded` per task but never mutate the in-flight payload; the audit surfaces post-hoc through `summary.json.context`, `tasks/<T-NNN>/context-audit.json`, `/ah:ctx-stats`, `ah:ctx-audit`, and the `## Context audit` block in VERIFY.md. Source: S03-SUMMARY.md/key_decisions
- **VERIFY.md `## Context audit` uses REPLACE semantics on re-runs.** State-snapshot sections (DoD, Context audit) reset to the latest run; chronological sections (`## Verify Log`) stay append-only. Source: S04-SUMMARY.md/key_decisions
- **Producer/consumer asymmetry as the deduplication mechanism for prompt-level skills.** Designate one skill as sole producer of a decision into a shared artifact; others are pure consumers that read the declaration and never re-derive. This is what eliminated the duplicated `tipo task → doc` table from the four skills. Source: S02-SUMMARY.md/patterns_established
- **Tool input safety = regex + `path.resolve` containment.** `load_codebase_doc` validates `name` with `^[a-zA-Z0-9_-]+$` AND resolves the candidate and asserts `candidate.startsWith(root + sep)`, defeating prefix attacks like `.pi/codebaseXYZ`. Source: S01-SUMMARY.md/key_decisions

### Lessons

- **Node 22.20.0 `--experimental-strip-types` does NOT rewrite `.js`→`.ts` in import specifiers.** When a test or production module mandates a literal `'./foo.js'` import, the runtime pattern is to keep `foo.ts` as the canonical typed source and add a `foo.js` runtime sibling with the same implementation for specifier resolution. Used twice in M001 (`plan-context.{ts,js}` in S03 T01, `context-audit.{ts,js}` in S03 T02 and S04 T01); both must stay in sync or be consolidated in a future cleanup. Source: M001-VALIDATION.md/Verification Class Compliance + S03-SUMMARY.md/key_decisions
- **Transitive deps live only under the global PI host's node_modules.** The worktree has no `package.json`/`node_modules`; `typebox` is only reachable via the PI host's `@earendil-works/pi-coding-agent` (or `@mariozechner/pi-coding-agent`). S01 T04's test self-heals by symlinking that copy into `<worktree>/node_modules/typebox` at preflight so the verification command runs verbatim. Source: S01-SUMMARY.md/What Happened (T04)
- **Verification-grep fidelity beats local style.** S01 T02 used single-quote import specifiers in `index.ts` (mismatched with the file's double quotes) so the slice plan's literal grep would pass verbatim — chosen deliberately. Source: S01-SUMMARY.md/key_decisions
- **Runtime gaps must surface as replan, not silent auto-load.** When `ah-task-execute` discovers it needs a doc not in `context-needed:`, it logs the gap in `## Log` and proposes a replan; it never auto-loads. Preserves PLAN.md as the single authority and keeps context-selection mistakes observable. Source: S02-SUMMARY.md/key_decisions
- **Inspector session directories must sort lexicographically descending on the `YYYYMMDD-HHMMSS_<sid8>` prefix, not by mtime.** The monotonic prefix survives NFS-style clock skew where `mtime` can lie. Source: S04-SUMMARY.md/key_decisions

### Patterns

- **Two-piece on-demand context: compact INDEX + LLM-driven loader tool.** Replaces forced full-body injection while keeping the doc set discoverable. Source: S01-SUMMARY.md/patterns_established
- **Pure-core + thin-glue split.** Keep heuristic modules (`codebase-index.ts`, `context-audit.ts`, `plan-context.ts`, `renderContextAuditMarkdown`) dependency-free (no fs, no typebox, no cross-module imports) and unit-testable; wire impure concerns (fs reads, pi.registerTool/Command, ctx.ui.notify) only at the integration boundary (`index.ts`, `context-inspector.ts`). Source: S01/S03/S04 SUMMARY/patterns_established
- **Stand-alone parser tests for prompt-emitted artifact shapes.** Zero-dep `node --test` on in-memory fixtures, runnable from the worktree without `package.json`; doubles as executable documentation for downstream consumers (S02's parser test became the reference contract S03 reused via `plan-context.{ts,js}`). Source: S02-SUMMARY.md/patterns_established
- **Single-writer for shared persisted artifacts.** `persistSummary` always writes the full `{...totals, context: serialized}` object rather than shard-updates, eliminating partial-write races between the totals updater and audit updater. Source: S03-SUMMARY.md/patterns_established
- **Failure funnel through a canonical null-render path.** Every error branch (no task detected, no audit file, read/JSON error) in the `ah:ctx-audit` handler routes through `renderContextAuditMarkdown(null)` so the user always sees the same "Context audit not available …" message via `ctx.ui.notify` rather than exceptions or empty notifies. Source: S04-SUMMARY.md/patterns_established
- **Runtime `.js` sibling alongside the canonical `.ts` module.** Satisfies literal specifier requirements in tests/production while keeping the typed source authoritative. See MEM008. Source: S03-SUMMARY.md/patterns_established

### Surprises

- **No package.json / node_modules in the worktree.** Standard JS workflows assume a per-project install; this extension lives only under the global PI host's `node_modules`, requiring the symlink-self-heal pattern documented above. Source: S01-SUMMARY.md/What Happened (T04)
- **`pi.registerTool` requires TypeBox schemas.** Upstream `ToolDefinition<TParams extends TSchema>` from `@mariozechner/pi-coding-agent` rejects plain JSON Schema objects; `Type.Object({ name: Type.String(...) })` is mandatory for parameter declarations. Source: S01-SUMMARY.md/key_decisions
- **Live PI session evidence for the full discuss→plan→execute→verify chain remains unrecorded.** All four success criteria are proven by unit tests, prompt-contract greps, producer/consumer SUMMARY artefacts, and the renderer/UAT artifacts, but no slice persisted a recorded harness transcript. Validation logged this as `needs-attention` (not `needs-remediation`); the gap is closable by recording the S04-UAT step 5–7 demo against a real task in a follow-up. Source: M001-VALIDATION.md/Verdict Rationale
