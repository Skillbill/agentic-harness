---
id: T05
parent: S02
milestone: M001
key_files:
  - tests/s02-plan-context-needed.test.mts
key_decisions:
  - The S02 parser test accepts BOTH inline-list (`context-needed: [A, B]`) and block-sequence (`context-needed:\n  - A`) YAML forms. /ah:task-plan emits inline today, but the spec in task-layout.md §3.3 doesn't forbid block form, so the test was written against the contract — not the current single emission style — to avoid coupling S02 closeout to a producer detail that S03 may revisit.
  - The test does NOT import any skill INSTRUCTIONS.md or any extension TypeScript module. It exercises a stand-alone parser against in-memory fixtures so it has zero coupling to runtime code paths, runs offline with no node_modules, and survives any future relocation of the skill tree.
duration: 
verification_result: passed
completed_at: 2026-05-12T15:30:34.487Z
blocker_discovered: false
---

# T05: Added tests/s02-plan-context-needed.test.mts: two node:test cases lock the PLAN.md `context-needed:` YAML frontmatter contract (inline list of stems matching ^[a-zA-Z0-9_-]+$ and empty list → zero-length array).

**Added tests/s02-plan-context-needed.test.mts: two node:test cases lock the PLAN.md `context-needed:` YAML frontmatter contract (inline list of stems matching ^[a-zA-Z0-9_-]+$ and empty list → zero-length array).**

## What Happened

Authored a stand-alone parser test that doubles as the S03 reference implementation. The test extracts the frontmatter block with `/^---\n([\s\S]*?)\n---/`, scans for a `context-needed:` line, and supports both the inline-list form (`context-needed: [A, B]`) and the YAML block-sequence form (`context-needed:\n  - A\n  - B`) so it accepts any spec-compliant emission from /ah:task-plan. Case 1 asserts that `context-needed: [CONVENZIONI, STRUTTURA]` parses to exactly two stems and that each stem matches the `^[a-zA-Z0-9_-]+$` NAME_PATTERN — the same regex enforced by load-codebase-doc.ts, ensuring the spec, producer, and runtime guard agree. Case 2 asserts that `context-needed: []` parses to a zero-length array, locking the explicit-empty-list contract from T01. The test imports nothing from the skill files or the rest of the worktree; it only uses node:test + node:assert/strict against in-memory fixtures, so it runs verbatim under `node --experimental-strip-types --test` with zero deps. The slice closeout audit (no `Tipo di (task|step)` / no `CONVENZIONI.md…STRUTTURA.md` in skills/, and load_codebase_doc referenced in all three rewritten skills) also passes — verifying that T01–T04 left the skill tree in the intended shape.

## Verification

Ran the new test directly: `node --experimental-strip-types --test tests/s02-plan-context-needed.test.mts` — both cases pass (`# pass 2`). Then ran the full slice verification chain from T05-PLAN.md (test pass + 4 grep audits) — exit 0 with `ALL VERIFY OK`. The duplicated tipo-task→doc table is structurally absent from skills/, all three rewritten skills cite load_codebase_doc, and the empty-list semantics for `context-needed:` are now locked by an executable test.

## Verification Evidence

| # | Command | Exit Code | Verdict | Duration |
|---|---------|-----------|---------|----------|
| 1 | `node --experimental-strip-types --test tests/s02-plan-context-needed.test.mts` | 0 | pass | 193ms |
| 2 | `node --experimental-strip-types --test tests/s02-plan-context-needed.test.mts 2>&1 | grep -E '# pass [1-9]' && [ "$(grep -RE 'Tipo di (task|step)' skills/ | wc -l)" = '0' ] && [ "$(grep -RE 'CONVENZIONI\.md.*STRUTTURA\.md' skills/ | wc -l)" = '0' ] && grep -q 'load_codebase_doc' skills/ah-task-plan/INSTRUCTIONS.md && grep -q 'load_codebase_doc' skills/ah-task-execute/INSTRUCTIONS.md && grep -q 'load_codebase_doc' skills/ah-task-discuss/INSTRUCTIONS.md` | 0 | pass | 250ms |

## Deviations

The T05-PLAN.md narrative suggested an additional sanity-grep for an 'unchanged sentinel string like Verify finale del task' in ah-task-verify, but that exact string does not exist in skills/ah-task-verify/INSTRUCTIONS.md (the file opens with `Sei l'Assistente del workflow SCRUM-lite...`). The hard verification command in the same plan does not include this sentinel check, so the canonical Verification gate ran clean; the suggested optional check was treated as illustrative, not contractual. ah-task-verify is git-untouched in S02.

## Known Issues

none

## Files Created/Modified

- `tests/s02-plan-context-needed.test.mts`
