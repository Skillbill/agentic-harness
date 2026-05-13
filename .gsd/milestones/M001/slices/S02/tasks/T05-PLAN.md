---
estimated_steps: 1
estimated_files: 1
skills_used: []
---

# T05: Add S02 verification test for PLAN.md frontmatter shape + cross-skill grep audit

Add `tests/s02-plan-context-needed.test.mts` that asserts two things: (1) given a fixture `PLAN.md` with `context-needed: [CONVENZIONI, STRUTTURA]` YAML frontmatter, a minimal parser (regex `/^---\n([\s\S]*?)\n---/` + line scan) extracts the two stems and each matches `^[a-zA-Z0-9_-]+$`; (2) an empty list `context-needed: []` parses to a zero-length array. The test runs via `node --experimental-strip-types --test` (same posture as `tests/s01-load-on-demand.test.mts`) — no package.json or external deps. The test doubles as documentation for the S03 parser. It does NOT import the skill files; it only exercises a stand-alone parser against in-memory fixtures (no filesystem writes outside the test's own temp scratch if needed). Slice closeout verifies: this test passes AND `grep -RE 'Tipo di (task|step)' skills/` returns 0 across all four skills AND each of the three rewritten skills (plan/execute/discuss) references `load_codebase_doc` AND ah-task-verify is untouched (sanity-grep for an unchanged sentinel string like 'Verify finale del task' to confirm).

## Inputs

- ``task-layout.md` — T01 output; the frontmatter spec this test enforces`
- ``skills/ah-task-plan/INSTRUCTIONS.md` — T02 output; audited for `context-needed` + `load_codebase_doc` references and absence of the deleted table`
- ``skills/ah-task-execute/INSTRUCTIONS.md` — T03 output; audited for `context-needed` + `load_codebase_doc` references and absence of the deleted table`
- ``skills/ah-task-discuss/INSTRUCTIONS.md` — T04 output; audited for `load_codebase_doc` reference and absence of the deleted table`
- ``skills/ah-task-verify/INSTRUCTIONS.md` — untouched; sanity-grepped for an unchanged sentinel`
- ``tests/s01-load-on-demand.test.mts` — reference for the node:test + node:assert/strict + experimental-strip-types posture`

## Expected Output

- ``tests/s02-plan-context-needed.test.mts` — new node:test suite with two cases (non-empty list parses to N stems matching the NAME_PATTERN regex; empty list parses to []); runs verbatim under `node --experimental-strip-types --test``

## Verification

node --experimental-strip-types --test tests/s02-plan-context-needed.test.mts 2>&1 | grep -E '# pass [1-9]' && [ "$(grep -RE 'Tipo di (task|step)' skills/ | wc -l)" = '0' ] && [ "$(grep -RE 'CONVENZIONI\.md.*STRUTTURA\.md' skills/ | wc -l)" = '0' ] && grep -q 'load_codebase_doc' skills/ah-task-plan/INSTRUCTIONS.md && grep -q 'load_codebase_doc' skills/ah-task-execute/INSTRUCTIONS.md && grep -q 'load_codebase_doc' skills/ah-task-discuss/INSTRUCTIONS.md
