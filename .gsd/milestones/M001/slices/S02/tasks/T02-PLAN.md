---
estimated_steps: 1
estimated_files: 1
skills_used: []
---

# T02: Rewrite ah-task-plan to emit context-needed in PLAN.md frontmatter

`ah-task-plan` becomes the sole producer of `context-needed:`. Delete the static tipo-task→doc table in §3-codebase (lines 112-129) plus the 'Usa questi documenti per:' usage prose. Replace with instructions to (a) consult the already-injected `.pi/codebase/INDEX.md`, (b) pick the doc stems needed to plan, (c) call `load_codebase_doc({name})` for each, (d) write the chosen stem list into PLAN.md frontmatter as `context-needed:`. Strip `.md` from INDEX entries when emitting. Always emit the key (`context-needed: []` if truly no codebase context is needed). Update §8b 'PLAN.md' template to show the YAML frontmatter block at the top. Add a one-liner in §5 ('propose decomposition') reminding the LLM to also pick context-needed names. Add a replan rule in §7: replan recomputes context-needed from current TASK.md + DISCUSS.md state. Keep §3-bis (load referenced code files) untouched. Keep the safe-default fallback (load `ARCHITETTURA` + `CONVENZIONI` when type unclear) but rephrase it to operate on the LLM's discretion over INDEX, not the deleted table.

## Inputs

- ``skills/ah-task-plan/INSTRUCTIONS.md` — current file; §3-codebase (lines 112-129) holds the duplicated table and §8b (lines 280-308) is the PLAN.md template; §5 (decomposition proposal) and §7 (replan) also need touch-ups`
- ``task-layout.md` — T01 output; the frontmatter spec to cite as canonical`
- ``load-codebase-doc.ts` — for the NAME_PATTERN regex to mention in the stem-stripping rule`
- ``codebase-index.ts` — for the INDEX message format the LLM consults`

## Expected Output

- ``skills/ah-task-plan/INSTRUCTIONS.md` — §3-codebase rewritten (table deleted, replaced with INDEX-driven on-demand loading + `context-needed:` emission instructions); §5 augmented with a sub-step to pick context-needed names; §7 augmented with a replan rule for recomputing context-needed; §8b template updated to show the YAML frontmatter at the top of PLAN.md`

## Verification

! grep -E 'Tipo di task' skills/ah-task-plan/INSTRUCTIONS.md >/dev/null && ! grep -E 'CONVENZIONI\.md.*STRUTTURA\.md' skills/ah-task-plan/INSTRUCTIONS.md >/dev/null && grep -q 'context-needed' skills/ah-task-plan/INSTRUCTIONS.md && grep -q 'load_codebase_doc' skills/ah-task-plan/INSTRUCTIONS.md && grep -q 'INDEX.md' skills/ah-task-plan/INSTRUCTIONS.md
