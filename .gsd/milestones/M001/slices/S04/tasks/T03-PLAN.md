---
estimated_steps: 1
estimated_files: 1
skills_used: []
---

# T03: Wire ## Context audit section into ah-task-verify INSTRUCTIONS

Text-only update to `skills/ah-task-verify/INSTRUCTIONS.md`. (a) In the first-run skeleton inside §2a, insert a `## Context audit` heading between `## Definition of Done (globale)` (and its child blocks) and `## Verify Log`, with a single placeholder line `<!-- popolato dallo step 6.5 -->`. (b) Add a new §2.5 `Context audit (sezione)` immediately after the §2 group describing the section: one paragraph stating that it mirrors the latest `tasks/<T-NNN>/context-audit.json` produced by the Context Inspector via `ah:ctx-audit <T-NNN>`, reset on every run like the DoD checkboxes (decision V-4 parity), with declared / loaded / delta_token / label and an optional `errors:` sub-block. (c) Insert a new numbered step 6.5 between the existing step 6 (`Scrivi il log della run`) and step 7 (`Mostra il report al dev`): the step instructs the agent to invoke `ah:ctx-audit <T-NNN>` (or read the JSON directly if the command is unavailable), then on first run append the rendered block under the new `## Context audit` heading, and on subsequent runs REPLACE the body of that section (do not append history — same semantics as the DoD reset). Keep the §Git Safety Rule invariant: the only path that may change is still `.pi/tasks/in-progress/<ID>-<slug>/VERIFY.md`. Do not modify any other section heading, numbering, or git command. Verification is mechanical: greps must find the new heading, §2.5, and step 6.5 (`grep -q '^## Context audit' skills/ah-task-verify/INSTRUCTIONS.md`, `grep -q 'ah:ctx-audit' skills/ah-task-verify/INSTRUCTIONS.md`, `grep -q 'Context audit (sezione)' skills/ah-task-verify/INSTRUCTIONS.md`); the existing §Git Safety block and the §2a skeleton must still be present (`grep -q 'Git Safety Rule' skills/ah-task-verify/INSTRUCTIONS.md`, `grep -q '## Verify Log' skills/ah-task-verify/INSTRUCTIONS.md`).

## Inputs

- ``skills/ah-task-verify/INSTRUCTIONS.md` — current verify skill prompt template (first-run skeleton §2a, re-run reset §2b, step 6 log writer, §Git Safety Rule).`
- ``task-layout.md` — §3.5 VERIFY.md contract reference for the section ordering.`
- ``context-inspector.ts` — names of the new command (`ah:ctx-audit`) the skill must invoke.`

## Expected Output

- ``skills/ah-task-verify/INSTRUCTIONS.md` — adds `## Context audit` heading to the first-run skeleton, new §2.5 description, and new step 6.5 wiring.`

## Verification

grep -q '^## Context audit' skills/ah-task-verify/INSTRUCTIONS.md && grep -q 'ah:ctx-audit' skills/ah-task-verify/INSTRUCTIONS.md && grep -q 'Context audit (sezione)' skills/ah-task-verify/INSTRUCTIONS.md && grep -q 'Git Safety Rule' skills/ah-task-verify/INSTRUCTIONS.md && grep -q '## Verify Log' skills/ah-task-verify/INSTRUCTIONS.md
