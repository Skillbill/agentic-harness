---
estimated_steps: 1
estimated_files: 1
skills_used: []
---

# T04: Rewrite ah-task-discuss to remove duplicated table (INDEX + on-demand)

`ah-task-discuss` runs BEFORE `PLAN.md` exists, so it does NOT consume `context-needed:`. Delete the static table in §3 (lines 85-99) and replace with: 'INDEX.md is already injected at session start. Identify the doc stems needed to anchor gray-area questions to the codebase. Use `load_codebase_doc({name})` to read them on demand. Do not pre-load by category.' Keep the safe-default fallback ('if unsure, load `ARCHITETTURA` + `CONVENZIONI`') explicit, since discuss-quality is sensitive to weak LLM judgment on pathological inputs. Preserve §3 lead-in (TASK.md, DISCUSS.md) and the 'Non caricare PLAN.md, steps/, VERIFY.md' rule. The skill must NOT mention `context-needed:` as its source — by design (Q2=C puro) the PLAN frontmatter is for-plan-and-after only.

## Inputs

- ``skills/ah-task-discuss/INSTRUCTIONS.md` — current file; §3 (lines 85-99) holds the duplicated table to delete`
- ``task-layout.md` — T01 output; for the canonical mechanism description`
- ``codebase-index.ts` — for the INDEX format the LLM reads on-session`

## Expected Output

- ``skills/ah-task-discuss/INSTRUCTIONS.md` — §3 rewritten (table deleted, replaced with INDEX-driven on-demand loading + explicit safe-default fallback); 'Non caricare PLAN.md…' line preserved; no mention of `context-needed:` as a discuss-time source`

## Verification

! grep -E 'Tipo di task' skills/ah-task-discuss/INSTRUCTIONS.md >/dev/null && ! grep -E 'CONVENZIONI\.md.*STRUTTURA\.md' skills/ah-task-discuss/INSTRUCTIONS.md >/dev/null && grep -q 'load_codebase_doc' skills/ah-task-discuss/INSTRUCTIONS.md && grep -q 'INDEX.md' skills/ah-task-discuss/INSTRUCTIONS.md
