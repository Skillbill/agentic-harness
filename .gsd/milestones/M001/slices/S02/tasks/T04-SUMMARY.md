---
id: T04
parent: S02
milestone: M001
key_files:
  - skills/ah-task-discuss/INSTRUCTIONS.md
key_decisions:
  - ah-task-discuss runs before PLAN.md exists, so it does NOT consume `context-needed:` — the new §3 explicitly states this asymmetry to prevent a future reader from re-introducing the duplicated tipo-task→doc table on the consumer side.
  - Safe-default fallback (`ARCHITETTURA` + `CONVENZIONI`) is retained but reframed as discretionary judgment over INDEX; rationale documented inline because discuss-quality degrades sharply on pathological/sparse TASK.md inputs and a zero-context fallback is worse than two generic docs.
duration: 
verification_result: passed
completed_at: 2026-05-12T15:29:07.431Z
blocker_discovered: false
---

# T04: Rewrote ah-task-discuss §3 to drop the static tipo-task table and load codebase docs on-demand via INDEX, keeping the ARCHITETTURA+CONVENZIONI safe-default and preserving the PLAN/steps/VERIFY exclusion rule.

**Rewrote ah-task-discuss §3 to drop the static tipo-task table and load codebase docs on-demand via INDEX, keeping the ARCHITETTURA+CONVENZIONI safe-default and preserving the PLAN/steps/VERIFY exclusion rule.**

## What Happened

Replaced the duplicated `Tipo di task → Documenti` table (lines 85-99) in `skills/ah-task-discuss/INSTRUCTIONS.md` §3 with an INDEX-driven on-demand selection procedure mirroring the producer-side prose adopted by `/ah:task-plan` in T02 (`skills/ah-task-plan/INSTRUCTIONS.md` §3-codebase). The new §3 explicitly states why discuss does NOT consume `context-needed:` — the key does not yet exist at discuss time because `/ah:task-plan` is its sole producer — closing the producer/consumer asymmetry without re-introducing duplicated selection logic. The lead-in (TASK.md, DISCUSS.md loads) and the `Non caricare PLAN.md, steps/, VERIFY.md` rule were preserved verbatim. The safe-default fallback (`ARCHITETTURA` + `CONVENZIONI`) was kept and reframed as discretionary judgment over INDEX, with an explicit note that discuss-quality is sensitive to weak LLM judgment on pathological inputs — matching the spec rationale in T04-PLAN.md.

## Verification

Ran the slice-task verification chain: `! grep -E 'Tipo di task' …` (table heading gone), `! grep -E 'CONVENZIONI\.md.*STRUTTURA\.md' …` (no per-category row remains), `grep -q 'load_codebase_doc' …` (on-demand loader cited), `grep -q 'INDEX.md' …` (INDEX referenced). All four checks composed into a single AND chain returned PASS. Additionally confirmed via `grep -n 'context-needed' …` that the key is mentioned only once — in a negative clarifier explaining discuss does NOT consume it — consistent with the Q2=C puro design constraint.

## Verification Evidence

| # | Command | Exit Code | Verdict | Duration |
|---|---------|-----------|---------|----------|
| 1 | `! grep -E 'Tipo di task' skills/ah-task-discuss/INSTRUCTIONS.md >/dev/null && ! grep -E 'CONVENZIONI\.md.*STRUTTURA\.md' skills/ah-task-discuss/INSTRUCTIONS.md >/dev/null && grep -q 'load_codebase_doc' skills/ah-task-discuss/INSTRUCTIONS.md && grep -q 'INDEX.md' skills/ah-task-discuss/INSTRUCTIONS.md` | 0 | pass | 50ms |
| 2 | `grep -n 'context-needed' skills/ah-task-discuss/INSTRUCTIONS.md` | 0 | pass | 20ms |

## Deviations

None.

## Known Issues

None.

## Files Created/Modified

- `skills/ah-task-discuss/INSTRUCTIONS.md`
