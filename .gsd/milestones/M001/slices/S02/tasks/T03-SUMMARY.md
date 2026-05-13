---
id: T03
parent: S02
milestone: M001
key_files:
  - skills/ah-task-execute/INSTRUCTIONS.md
key_decisions:
  - ah-task-execute is a pure *consumer* of `context-needed:` — it never selects codebase docs by category or step-type heuristic. The producer/consumer asymmetry (only /ah:task-plan writes the key) is what removes the duplicated tipo-task→doc table across skills.
  - Runtime gaps (step appears to need a doc not in the frontmatter) are *logged and surfaced as replan*, never silently auto-loaded. This keeps PLAN.md authoritative and makes context-selection mistakes observable instead of papered over.
  - Missing `context-needed:` key on a legacy PLAN is tolerated as an empty list (back-compat) but flagged in `## Log` — matches the T01 spec where parsers tolerate absence but the official template always emits the key.
duration: 
verification_result: passed
completed_at: 2026-05-12T15:27:32.944Z
blocker_discovered: false
---

# T03: Rewrote ah-task-execute §4-codebase to consume `context-needed:` from PLAN.md frontmatter, deleting the static tipo-step→doc table and per-doc prose.

**Rewrote ah-task-execute §4-codebase to consume `context-needed:` from PLAN.md frontmatter, deleting the static tipo-step→doc table and per-doc prose.**

## What Happened

Replaced §4-codebase (lines 136-164) of `skills/ah-task-execute/INSTRUCTIONS.md` with a consumer-side procedure: read PLAN.md YAML frontmatter, iterate `context-needed: [...]`, call `load_codebase_doc({name: stem})` once per stem, and never load other codebase docs by category heuristic. Kept §4 (load TASK/DISCUSS/PLAN/step file) and §4-bis (ad-hoc code-file reads) untouched as instructed. Compacted the prior 4-line "piano ha precedenza sulla mappa globale" rule into a single line. Added two new sub-rules required by the plan: (a) absent key on a legacy PLAN is treated as an empty list with a `## Log` note suggesting replan; (b) if a runtime gap appears (step seems to need a doc not in `context-needed:`), the skill logs the missing stem and proposes replan rather than silently loading — this preserves the producer/consumer split established by T02 where ah-task-plan is the *sole* producer of `context-needed:`. Cross-referenced `task-layout.md` §3.3 as the contract source. Verification gate (all 5 grep predicates) passes.

## Verification

Ran the inlined gate verbatim: `! grep 'Tipo di step' && ! grep 'CONVENZIONI\.md.*STRUTTURA\.md' && grep 'context-needed' && grep 'load_codebase_doc' && grep 'PLAN.md'` against `skills/ah-task-execute/INSTRUCTIONS.md` — printed `VERIFY OK`. This confirms the static table prose is gone and the three required tokens (context-needed, load_codebase_doc, PLAN.md) are present.

## Verification Evidence

| # | Command | Exit Code | Verdict | Duration |
|---|---------|-----------|---------|----------|
| 1 | `! grep -E 'Tipo di step' skills/ah-task-execute/INSTRUCTIONS.md >/dev/null && ! grep -E 'CONVENZIONI\.md.*STRUTTURA\.md' skills/ah-task-execute/INSTRUCTIONS.md >/dev/null && grep -q 'context-needed' skills/ah-task-execute/INSTRUCTIONS.md && grep -q 'load_codebase_doc' skills/ah-task-execute/INSTRUCTIONS.md && grep -q 'PLAN.md' skills/ah-task-execute/INSTRUCTIONS.md` | 0 | pass | 50ms |

## Deviations

None. §4 entry point and §4-bis ad-hoc code-file reads were preserved verbatim per the plan; only §4-codebase was rewritten.

## Known Issues

None.

## Files Created/Modified

- `skills/ah-task-execute/INSTRUCTIONS.md`
