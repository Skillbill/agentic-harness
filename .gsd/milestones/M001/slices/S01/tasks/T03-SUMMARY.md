---
id: T03
parent: S01
milestone: M001
key_files:
  - commands/map-codebase.md
key_decisions:
  - Placed the new INDEX generation section as step 4 (immediately after Passata 4 / CRITICITA) and renumbered subsequent steps to keep the sequential narrative intact.
  - Documented the regex `^[A-Za-z0-9_\-\./]+\.md: .{1,120}$` verbatim and added an illustrative example so the LLM has a concrete pattern to follow.
  - Stated explicitly that the extension prefers disk-resident INDEX.md over the lazy in-memory fallback (regeneration recommended, not mandatory) to align with the T01 carry-forward context.
duration: 
verification_result: passed
completed_at: 2026-05-12T15:06:06.292Z
blocker_discovered: false
---

# T03: Extended commands/map-codebase.md to emit INDEX.md as the 8th artifact with documented format and regex.

**Extended commands/map-codebase.md to emit INDEX.md as the 8th artifact with documented format and regex.**

## What Happened

Updated `commands/map-codebase.md` so `/ah:map-codebase` produces 8 artifacts instead of 7. Changes: (1) front-matter `description` now says "8 documenti" and mentions INDEX.md; (2) intro paragraph updated to reflect 7 tematici + INDEX.md; (3) the artifact list at the former lines 97-104 now has an 8th bullet `` `INDEX.md` (path + 1-line summary per doc, machine-parsed by the extension) ``; (4) added a new section `### 4. Genera INDEX.md` that instructs the LLM to write `.pi/codebase/INDEX.md` containing one line per `.md` in `.pi/codebase/` (excluding INDEX.md itself), in the form `<relPath>: <one-line summary ≤ 120 char>`, where the summary is the first `# ` heading or the first non-empty body line, and explicitly documents the regex `^[A-Za-z0-9_\-\./]+\.md: .{1,120}$`; included an illustrative example block. The new section also states that the extension prefers a disk-resident INDEX.md over its lazy in-memory fallback, so regenerating after edits is recommended but not mandatory. Subsequent sections were renumbered (security scan → 5, verify output → 6, output finale → 7) and the final output block now lists INDEX.md as an additional emitted artifact. Verify-output section also checks that each INDEX line matches the regex. No `.ts` files were touched.

## Verification

Ran the gate from the task plan: `grep -q 'INDEX.md' commands/map-codebase.md && grep -cE '^- \`(STACK|INTEGRAZIONI|ARCHITETTURA|STRUTTURA|CONVENZIONI|TESTING|CRITICITA|INDEX)\.md\`' commands/map-codebase.md | awk '$1>=8'`. Output: `9` (the 8 entries in the artifact list plus one in the final-output bullets), exit code 0.

## Verification Evidence

| # | Command | Exit Code | Verdict | Duration |
|---|---------|-----------|---------|----------|
| 1 | `grep -q 'INDEX.md' commands/map-codebase.md && grep -cE '^- `(STACK|INTEGRAZIONI|ARCHITETTURA|STRUTTURA|CONVENZIONI|TESTING|CRITICITA|INDEX)\.md`' commands/map-codebase.md | awk '$1>=8'` | 0 | PASS — INDEX.md present and 9 matching artifact-list lines (>=8) | 7ms |

## Deviations

None.

## Known Issues

None.

## Files Created/Modified

- `commands/map-codebase.md`
