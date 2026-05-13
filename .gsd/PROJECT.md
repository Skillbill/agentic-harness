# Agentic Harness (AH)

## Vision

Agentic Harness is an **extension of PI.dev** (`@mariozechner/pi-coding-agent`) — skills + commands only, no standalone CLI — that runs a SCRUM-lite workflow (high-level metaphor, no rigid ceremonies) for software development where **LLM agents and humans coexist** on the same repository. Humans verify and correct code produced by agents (HITL on-demand). Non-negotiable constraint: **maximally calibrated LLM context economy with quality preserved**.

## Architecture (current state, post-M001)

- TypeScript extension; entry `index.ts` registers `ah:*` commands and the Context Inspector.
- Hooks: `session_start`, `before_agent_start`, `before_provider_request`, `after_provider_response`, `message_end`, `turn_end`.
- **Codebase context injection (M001):** `.pi/codebase/INDEX.md` (compact `<path>: <one-line summary>` lines, ≤500 tokens) is injected once per session as `customType: project-codebase-index`; full doc bodies are loaded on demand via the `load_codebase_doc({name})` `pi.registerTool`. Disk-resident `INDEX.md` is authoritative; in-memory `buildCodebaseIndex` is the fallback.
- **Per-task context selection (M001):** PLAN.md YAML frontmatter `context-needed: [stem1, stem2, ...]` is the single producer/consumer contract. `ah-task-plan` is the sole producer; `ah-task-execute` is the sole consumer; `ah-task-discuss` runs before PLAN exists and uses INDEX + on-demand judgment. Stems match `^[a-zA-Z0-9_-]+$`; empty list `context-needed: []` is legal.
- **Context Inspector (M001):** observer-only listeners on pi `tool_call` / `tool_result` accumulate per-task `declared` vs `loaded` audits; no in-flight payload mutation. Persisted via `summary.json.context[taskId]` and `tasks/<T-NNN>/context-audit.json` per session under `.pi/context-inspector/<ts>_<sid>/`. Surfaces: `/ah:ctx-stats` (📚 Context audit block), `ah:ctx-audit <T-NNN>` pi command (renders via `ctx.ui.notify`), and a `## Context audit` section in `.pi/tasks/in-progress/<ID>-<slug>/VERIFY.md`.
- **Skills (4):** `ah-task-discuss`, `ah-task-plan`, `ah-task-execute`, `ah-task-verify`. The duplicated `tipo task → doc da caricare` table has been removed from all four; the decision lives once, in PLAN.md.

## Milestone Registry

- ✅ **M001 — Consolidamento harness + calibrazione contesto LLM** (completed 2026-05-13)
  Replaced forced full-body codebase injection with INDEX + on-demand loader; made per-task context selection an explicit PLAN.md frontmatter contract; wired Context Inspector as a pure observer of declared-vs-loaded; surfaced the audit in VERIFY.md and via `ah:ctx-audit`. Validation: `needs-attention` — every contract is proven (25/25 tests, cross-skill greps clean, all 4 boundary contracts honoured) but no recorded live PI session driving discuss→plan→execute→verify against a real task is persisted under the milestone. Closeable by attaching the S04-UAT step 5–7 demo evidence in a follow-up.

## Key Decisions (M001)

| ID | Question | Choice |
|---|---|---|
| D-Q1 | Where does context selection live? | **C** — `INDEX.md` + `load_codebase_doc(name)` on-demand |
| D-Q2 | What determines per-task context? | **C puro** — PLAN.md `context-needed:` is the sole authority; no `context-hint` in TASK.md |
| D-Q3 | How does the Inspector evolve? | **A** — observer-only + separate end-of-task decisore; no in-flight intervention |
| D-V4 | VERIFY.md `## Context audit` semantics | REPLACE-on-rerun (state snapshot); `## Verify Log` stays append-only |

## Out of Scope (deferred)

- Concurrent multi-agent coordination (lock, ownership, branch policy).
- Strict SCRUM ceremonies (sprints, retros, PO/SM roles).
- Quantitative token-reduction KPI (M001 target is qualitative).
- In-flight Inspector intervention (warning/block during the run). Re-evaluable after collecting data with the observer version.
- Pluggable event/policy pipeline for the Inspector (over-engineering until ≥2 concrete policies exist).

## Open Follow-ups

- **Live-session demo for M001:** record a real PI harness transcript driving discuss → plan → execute → verify with on-demand loading + Inspector capture; attach as additional evidence under `.gsd/milestones/M001/` to close the `needs-attention` integration-class gap.
- Consider exposing a programmatic helper (e.g. `findLatestAuditForTask` as an exported utility or a second pi command returning the path) so the §6.5 renderer-direct fallback can be mechanised without re-implementing session-dir scanning.
- Track the dual `.ts`/`.js` runtime-sibling pattern (`plan-context`, `context-audit`) so the two stay in sync, or consolidate when Node strip-types stops requiring the workaround.
