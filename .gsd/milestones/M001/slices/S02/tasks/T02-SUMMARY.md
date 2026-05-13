---
id: T02
parent: S02
milestone: M001
key_files:
  - skills/ah-task-plan/INSTRUCTIONS.md
key_decisions:
  - ah-task-plan is the sole producer of context-needed: — discuss/execute/verify consume; replan recomputes from scratch and never inherits.
  - Safe-default fallback kept as ARCHITETTURA + CONVENZIONI but reframed as a discretionary judgment over INDEX, not a residue of the deleted tipo-task table.
  - PLAN.md template carries the YAML frontmatter block at the top per task-layout.md §3.3; stem rules (regex, no .md, no path, [] legal) restated inline with a cross-reference to the canonical spec to avoid drift.
duration: 
verification_result: passed
completed_at: 2026-05-12T15:25:24.601Z
blocker_discovered: false
---

# T02: Rewrote ah-task-plan §3-codebase/§5/§7/§8b to drop the static tipo-task table and make the skill emit `context-needed:` YAML frontmatter in PLAN.md from INDEX-driven on-demand selection.

**Rewrote ah-task-plan §3-codebase/§5/§7/§8b to drop the static tipo-task table and make the skill emit `context-needed:` YAML frontmatter in PLAN.md from INDEX-driven on-demand selection.**

## What Happened

§3-codebase replaced: removed the seven-row "Tipo di task → Documenti da caricare" table and the "Usa questi documenti per:" prose. Wrote a five-step procedure that (1) reads the already-injected `.pi/codebase/INDEX.md` entries (`- <relPath>: <summary>`), (2) judges which docs are needed based on TASK.md + DISCUSS.md, (3) calls `load_codebase_doc({ name: "<stem>" })` per chosen doc, (4) enforces the stem regex `^[a-zA-Z0-9_-]+$` (NAME_PATTERN), (5) records the stem list to be written verbatim into PLAN.md frontmatter at §8b. The safe-default fallback was kept but rephrased: ARCHITETTURA + CONVENZIONI when the task is ambiguous — framed as a discretionary read of INDEX, not a tipo-task lookup. Added an explicit empty-list case (`context-needed: []`) for tasks touching only process files. §5 augmented with a paragraph reminding the agent to fix the stem list alongside the step decomposition so step add/remove cycles can also adjust required docs. §7 augmented with a replan rule: `context-needed:` is recomputed from current TASK.md + DISCUSS.md state and never inherited from the previous PLAN.md — same safe default and empty-list semantics apply. §8b template prepended a YAML frontmatter block at the top of PLAN.md and added a vincoli postface listing stem rules (no `.md`, no path, regex match, `[]` legal) with cross-reference to task-layout.md §3.3 for counter-examples. One incidental fix: an INDEX-format example originally read `\`- CONVENZIONI.md: …\`, \`- STRUTTURA.md: …\`` on a single line, which tripped the verification regex `CONVENZIONI\\.md.*STRUTTURA\\.md`; rewrote it as `\`- <relPath>: <summary>\` (es. \`- CONVENZIONI.md: …\`)` to keep the prose clear without coincidentally resembling the deleted table.

## Verification

Ran the verification one-liner from the task plan in 15ms: confirmed (a) no `Tipo di task` heading remains, (b) no line pairs `CONVENZIONI.md` with `STRUTTURA.md` (which would indicate the static table is still present), (c) `context-needed` is referenced, (d) `load_codebase_doc` is referenced, (e) `INDEX.md` is referenced. Exit code 0, output `VERIFY_OK`.

## Verification Evidence

| # | Command | Exit Code | Verdict | Duration |
|---|---------|-----------|---------|----------|
| 1 | `! grep -E 'Tipo di task' skills/ah-task-plan/INSTRUCTIONS.md >/dev/null && ! grep -E 'CONVENZIONI\.md.*STRUTTURA\.md' skills/ah-task-plan/INSTRUCTIONS.md >/dev/null && grep -q 'context-needed' skills/ah-task-plan/INSTRUCTIONS.md && grep -q 'load_codebase_doc' skills/ah-task-plan/INSTRUCTIONS.md && grep -q 'INDEX.md' skills/ah-task-plan/INSTRUCTIONS.md` | 0 | pass | 15ms |

## Deviations

One minor: rephrased the INDEX-format example line that incidentally matched the verification's CONVENZIONI.md/STRUTTURA.md regex. Kept the example clear (`- <relPath>: <summary>` with a single concrete sample) without weakening the prose.

## Known Issues

Downstream skills ah-task-discuss, ah-task-next-step, and ah-task-verify still read the old tipo-task table (or its equivalent) and have no `context-needed:` parser — those are T03/T04 in this slice. The s02 verification test that asserts PLAN.md parseability is also still to be added (T05/S02 verify).

## Files Created/Modified

- `skills/ah-task-plan/INSTRUCTIONS.md`
