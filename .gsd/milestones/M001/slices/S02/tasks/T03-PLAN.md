---
estimated_steps: 1
estimated_files: 1
skills_used: []
---

# T03: Rewrite ah-task-execute to consume context-needed from PLAN.md frontmatter

`ah-task-execute` becomes the sole consumer of `context-needed:`. Delete the static tipo-step→doc table in §4-codebase (lines 136-164) plus the per-doc 'Usa questi documenti durante l'implementazione per:' prose. Replace with: 'Read `PLAN.md` frontmatter `context-needed: [...]`. For each stem in the list, call `load_codebase_doc({name})`. Do not load other codebase docs by category heuristic — trust the declaration.' Keep §4 (load TASK/DISCUSS/PLAN/step file) untouched as the entry point. Keep §4-bis (ad-hoc code-file reads) untouched as the explicit loophole for code files referenced in `## Execute`. Compact the 'piano ha precedenza sulla mappa globale' rule into a one-liner: 'If a loaded codebase doc contradicts `## Execute`, follow `## Execute` and log the contradiction in `## Log`.' If at execute time the step appears to need another codebase doc, the skill logs that gap in `## Log` and proposes replan rather than silently loading.

## Inputs

- ``skills/ah-task-execute/INSTRUCTIONS.md` — current file; §4-codebase (lines 136-164) holds the table + usage prose to delete`
- ``task-layout.md` — T01 output; the frontmatter spec the execute skill must cite when explaining where to read the declaration`
- ``skills/ah-task-plan/INSTRUCTIONS.md` — T02 output; defines the producer side of the contract`

## Expected Output

- ``skills/ah-task-execute/INSTRUCTIONS.md` — §4-codebase rewritten (table deleted, replaced with PLAN frontmatter read + per-stem `load_codebase_doc` loop); contradiction rule compacted to a single line; §4 and §4-bis preserved verbatim aside from incidental renumbering`

## Verification

! grep -E 'Tipo di step' skills/ah-task-execute/INSTRUCTIONS.md >/dev/null && ! grep -E 'CONVENZIONI\.md.*STRUTTURA\.md' skills/ah-task-execute/INSTRUCTIONS.md >/dev/null && grep -q 'context-needed' skills/ah-task-execute/INSTRUCTIONS.md && grep -q 'load_codebase_doc' skills/ah-task-execute/INSTRUCTIONS.md && grep -q 'PLAN.md' skills/ah-task-execute/INSTRUCTIONS.md
