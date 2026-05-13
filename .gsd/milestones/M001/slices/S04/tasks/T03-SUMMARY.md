---
id: T03
parent: S04
milestone: M001
key_files:
  - skills/ah-task-verify/INSTRUCTIONS.md
key_decisions:
  - Step 6.5 explicitly tells the agent to REPLACE (not append) the ## Context audit body on re-runs — same V-4 reset semantics as the DoD checkboxes, so the section reflects only the latest run while ## Verify Log remains the cronological record.
  - Step 6.5 documents a fallback path (read context-audit.json directly + apply renderContextAuditMarkdown) for contexts where the ah:ctx-audit command isn't registered, so the skill remains usable even if the Inspector extension is unloaded.
duration: 
verification_result: passed
completed_at: 2026-05-13T08:20:12.421Z
blocker_discovered: false
---

# T03: Wired ## Context audit section, §2.5 description, and step 6.5 into ah-task-verify INSTRUCTIONS

**Wired ## Context audit section, §2.5 description, and step 6.5 into ah-task-verify INSTRUCTIONS**

## What Happened

Edited `skills/ah-task-verify/INSTRUCTIONS.md` with three surgical insertions per T03-PLAN: (a) added the `## Context audit` heading with `<!-- popolato dallo step 6.5 -->` placeholder inside the §2a first-run skeleton, positioned between the DoD globale block and `## Verify Log`; (b) inserted a new §2.5 "Context audit (sezione)" immediately after §2b describing the section as a mirror of the latest `tasks/<T-NNN>/context-audit.json` produced by the Context Inspector and exposed via `ah:ctx-audit <T-NNN>`, with explicit V-4 reset parity (refreshed every run, no history) and the no-audit fallback line; (c) inserted a new numbered step 6.5 "Materializza la sezione `## Context audit`" between step 6 (Verify Log) and step 7 (report to dev), instructing the agent to invoke `ah:ctx-audit <T-NNN>` (or fall back to reading the JSON + applying `renderContextAuditMarkdown` directly), and to REPLACE — not append — the section body on subsequent runs. Preserved the §Git Safety Rule invariant (only `VERIFY.md` may change) by explicitly restating it at the end of step 6.5. No other section heading, numbering, or git command was touched.

## Verification

Ran the five mechanical greps from the plan: `grep -q '^## Context audit'`, `grep -q 'ah:ctx-audit'`, `grep -q 'Context audit (sezione)'`, `grep -q 'Git Safety Rule'`, `grep -q '## Verify Log'`. All five returned exit 0 (PASS).

## Verification Evidence

| # | Command | Exit Code | Verdict | Duration |
|---|---------|-----------|---------|----------|
| 1 | `grep -q '^## Context audit' skills/ah-task-verify/INSTRUCTIONS.md` | 0 | pass | 5ms |
| 2 | `grep -q 'ah:ctx-audit' skills/ah-task-verify/INSTRUCTIONS.md` | 0 | pass | 5ms |
| 3 | `grep -q 'Context audit (sezione)' skills/ah-task-verify/INSTRUCTIONS.md` | 0 | pass | 5ms |
| 4 | `grep -q 'Git Safety Rule' skills/ah-task-verify/INSTRUCTIONS.md` | 0 | pass | 5ms |
| 5 | `grep -q '## Verify Log' skills/ah-task-verify/INSTRUCTIONS.md` | 0 | pass | 5ms |

## Deviations

None.

## Known Issues

None.

## Files Created/Modified

- `skills/ah-task-verify/INSTRUCTIONS.md`
