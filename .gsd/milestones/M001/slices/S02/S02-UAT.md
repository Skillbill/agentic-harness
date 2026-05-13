# S02: context-needed in PLAN.md + deduplica delle 4 skill — UAT

**Milestone:** M001
**Written:** 2026-05-12T15:32:38.146Z

## UAT — S02

**UAT Type:** Contract / artifact-shape verification (no runtime UI to drive).

### Preconditions

- Worktree at `/home/toto/scm-projects/agentic-harness/.gsd/worktrees/M001` on branch `milestone/M001`.
- `task-layout.md`, `skills/ah-task-{plan,execute,discuss,verify}/INSTRUCTIONS.md`, and `tests/s02-plan-context-needed.test.mts` present.
- Node ≥ 22 available on PATH (for `--experimental-strip-types`).

### Steps

1. **Verify canonical spec.** From the worktree root run:
   ```
   grep -q 'context-needed' task-layout.md \
     && grep -q 'context-needed: \[\]' task-layout.md \
     && ! grep -E 'Tipo di lavoro \| Documenti caricati' task-layout.md
   ```
   **Expected:** exit 0. task-layout.md §3.3 documents the frontmatter contract; §2.2 no longer carries the static tipo-task table.

2. **Verify producer rewrite (ah-task-plan).**
   ```
   ! grep -E 'Tipo di task' skills/ah-task-plan/INSTRUCTIONS.md \
     && grep -q 'context-needed' skills/ah-task-plan/INSTRUCTIONS.md \
     && grep -q 'load_codebase_doc' skills/ah-task-plan/INSTRUCTIONS.md \
     && grep -q 'INDEX.md' skills/ah-task-plan/INSTRUCTIONS.md
   ```
   **Expected:** exit 0.

3. **Verify consumer rewrite (ah-task-execute).**
   ```
   ! grep -E 'Tipo di step' skills/ah-task-execute/INSTRUCTIONS.md \
     && grep -q 'context-needed' skills/ah-task-execute/INSTRUCTIONS.md \
     && grep -q 'load_codebase_doc' skills/ah-task-execute/INSTRUCTIONS.md \
     && grep -q 'PLAN.md' skills/ah-task-execute/INSTRUCTIONS.md
   ```
   **Expected:** exit 0.

4. **Verify pre-PLAN phase (ah-task-discuss).**
   ```
   ! grep -E 'Tipo di task' skills/ah-task-discuss/INSTRUCTIONS.md \
     && grep -q 'load_codebase_doc' skills/ah-task-discuss/INSTRUCTIONS.md \
     && grep -q 'INDEX.md' skills/ah-task-discuss/INSTRUCTIONS.md
   ```
   **Expected:** exit 0. The skill does NOT reference `context-needed:` (by design).

5. **Cross-skill audit (deduplication).**
   ```
   grep -RE 'Tipo di (task|step)' skills/ | wc -l
   grep -RE 'CONVENZIONI\.md.*STRUTTURA\.md' skills/ | wc -l
   ```
   **Expected:** both print `0`.

6. **Parser test.**
   ```
   node --experimental-strip-types --test tests/s02-plan-context-needed.test.mts
   ```
   **Expected:** `# pass 2`, `# fail 0`, exit 0. The test parses `context-needed: [CONVENZIONI, STRUTTURA]` to two stems matching `^[a-zA-Z0-9_-]+$` and `context-needed: []` to a zero-length array.

### Expected Outcomes

- Steps 1–6 all exit 0 / produce the expected counts.
- A future task pipeline (S03+) reading `PLAN.md` frontmatter will find `context-needed: [...]` and can use it as the `declared` source for declared-vs-loaded diff.

### Edge Cases

- **Empty list:** `context-needed: []` MUST parse to a zero-length array (covered by parser test case 2).
- **Missing key (legacy PLAN):** tolerated as empty by parsers, flagged in `## Log` by ah-task-execute; the official template always emits the key.
- **Stem with disallowed char (e.g. `convenzioni/sub`):** out of contract; the canonical regex `^[a-zA-Z0-9_-]+$` is documented in task-layout.md §3.3 and matches `load-codebase-doc.ts` NAME_PATTERN, so runtime rejects it.

### Not Proven By This UAT

- A real end-to-end task run (task-plan invoked by the harness producing a real PLAN.md, then task-execute consuming it from a live session). This slice proves contract shape and cross-skill deduplication only — full end-to-end is exercised by M001's success criteria across S01–S04.
- The S03 Inspector declared-vs-loaded diff (consumes this frontmatter but is out of scope here).
- `ah-task-verify` content unchanged: verified via git history rather than a literal sentinel grep (the plan's `Verify finale del task` string is not in the current file body, but git shows no S02 modifications).
- Token-budget impact of the new frontmatter on real prompts (measured downstream in S03/S04).
