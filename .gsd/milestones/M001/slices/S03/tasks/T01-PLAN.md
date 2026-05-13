---
estimated_steps: 8
estimated_files: 2
skills_used: []
---

# T01: Extract parseContextNeeded into shared plan-context.ts

Move the canonical YAML-frontmatter parser for `context-needed:` out of the S02 test and into a new module `plan-context.ts` at the worktree root so the Inspector and the test share one implementation. Re-point `tests/s02-plan-context-needed.test.mts` to import from the new module. Byte-identical behavior — no logic changes. This unblocks T02/T03.

Failure modes: none — pure function over a string. Negative tests: malformed frontmatter, missing `context-needed:` key, inline empty list `[]`, multi-line list with `-` items — already exercised by the existing test and the new round-trip case added here.

Must-haves:
- `plan-context.ts` exports `parseContextNeeded(planMd: string): { ok: true; stems: string[] } | { ok: false; reason: string }` and `NAME_PATTERN: RegExp` with values byte-identical to tests/s02-plan-context-needed.test.mts:4-43.
- Existing S02 test imports `parseContextNeeded` and `NAME_PATTERN` from `../plan-context.js` (the dynamic-strip-types runtime resolves .js → .ts) and the original local definitions are removed.
- The new file has zero external runtime dependencies (no `typebox`, no `pi-coding-agent`) — this keeps it importable from any test file without the S01 symlink shim.
- `node --experimental-strip-types --test tests/s02-plan-context-needed.test.mts` still prints `# pass 2` / `# fail 0` after the move.

Skills the executor should load: tdd, verify-before-complete.

## Inputs

- ``tests/s02-plan-context-needed.test.mts` — source of the canonical parser (lines 4-43)`
- ``load-codebase-doc.ts` — same NAME_PATTERN constant for cross-check (no edit)`

## Expected Output

- ``plan-context.ts` — new module exporting `parseContextNeeded` and `NAME_PATTERN``
- ``tests/s02-plan-context-needed.test.mts` — updated to import from `../plan-context.js`, local parser definitions removed`

## Verification

test -f plan-context.ts && grep -q 'export function parseContextNeeded' plan-context.ts && grep -q 'export const NAME_PATTERN' plan-context.ts && grep -q "from '../plan-context.js'" tests/s02-plan-context-needed.test.mts && ! grep -qE '^function parseContextNeeded' tests/s02-plan-context-needed.test.mts && node --experimental-strip-types --test tests/s02-plan-context-needed.test.mts 2>&1 | grep -qE '# pass 2'
