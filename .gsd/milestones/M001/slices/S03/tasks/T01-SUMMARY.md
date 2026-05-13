---
id: T01
parent: S03
milestone: M001
key_files:
  - plan-context.ts
  - plan-context.js
  - tests/s02-plan-context-needed.test.mts
key_decisions:
  - Added a sibling plan-context.js (no types) alongside plan-context.ts because Node 22.20.0 --experimental-strip-types does not rewrite .js→.ts in import specifiers, yet the must-have mandates `from '../plan-context.js'` in the test.
duration: 
verification_result: untested
completed_at: 2026-05-12T15:42:28.172Z
blocker_discovered: false
---

# T01: Extracted parseContextNeeded + NAME_PATTERN into shared plan-context.ts and rewired the S02 test to import from it.

**Extracted parseContextNeeded + NAME_PATTERN into shared plan-context.ts and rewired the S02 test to import from it.**

## What Happened

Created plan-context.ts at the worktree root exporting `parseContextNeeded(planMd: string)` and `NAME_PATTERN`, byte-identical (modulo type annotations) to the implementation previously inlined in tests/s02-plan-context-needed.test.mts lines 4–43. Removed the local parser+pattern from the S02 test and replaced them with `import { parseContextNeeded, NAME_PATTERN } from '../plan-context.js'`. No runtime dependencies — the module is pure ESM TypeScript with zero imports, so it does not require the S01 typebox symlink shim.\n\nDuring verification the import statement `from '../plan-context.js'` (as mandated by the task must-have) failed under `node --experimental-strip-types` on Node 22.20.0: the resolver does not rewrite `.js` → `.ts` in this Node version (probe confirmed). To honor the literal verify contract (both the `grep -q "from '../plan-context.js'"` check AND the `# pass 2` test result must hold), I added a sibling `plan-context.js` carrying the same parser without type annotations. Both files export identical runtime values; `plan-context.ts` remains the canonical typed source for downstream Inspector code (T02/T03) and `plan-context.js` exists solely as a runtime sibling for the test's `.js` import specifier.

## Verification

Ran the task plan's compound verification command verbatim: `test -f plan-context.ts && grep -q 'export function parseContextNeeded' plan-context.ts && grep -q 'export const NAME_PATTERN' plan-context.ts && grep -q "from '../plan-context.js'" tests/s02-plan-context-needed.test.mts && ! grep -qE '^function parseContextNeeded' tests/s02-plan-context-needed.test.mts && node --experimental-strip-types --test tests/s02-plan-context-needed.test.mts 2>&1 | grep -qE '# pass 2'` — exited 0. The node:test run printed `# pass 2 / # fail 0` for both the non-empty-inline-list and the empty-list `[]` cases.</verification>
<parameter name="verificationEvidence">[{"command":"test -f plan-context.ts && grep -q 'export function parseContextNeeded' plan-context.ts && grep -q 'export const NAME_PATTERN' plan-context.ts && grep -q \"from '../plan-context.js'\" tests/s02-plan-context-needed.test.mts && ! grep -qE '^function parseContextNeeded' tests/s02-plan-context-needed.test.mts && node --experimental-strip-types --test tests/s02-plan-context-needed.test.mts 2>&1 | grep -qE '# pass 2'","exitCode":0,"verdict":"pass","durationMs":200}]

## Verification Evidence

| # | Command | Exit Code | Verdict | Duration |
|---|---------|-----------|---------|----------|
| — | No verification commands discovered | — | — | — |

## Deviations

Task plan asserted that `--experimental-strip-types` would resolve `'../plan-context.js'` to `plan-context.ts`. Empirically false in Node 22.20.0 (ERR_MODULE_NOT_FOUND). Deviated by also adding `plan-context.js` with the same runtime impl so the literal verify command passes. The `.ts` file remains the canonical typed source for Inspector code in T02/T03; the `.js` exists purely as a runtime sibling for the test's import specifier. T02/T03 can keep importing from `./plan-context.ts` directly with type info.

## Known Issues

Two physical files (plan-context.ts and plan-context.js) currently carry the same runtime implementation. If T02/T03 evolve the parser, both must be kept in sync — or T02 should consolidate by either (a) deleting plan-context.js and changing the test to import `'../plan-context.ts'`, or (b) making plan-context.ts a typed re-export wrapper over plan-context.js. Flagging here so the next executor decides.

## Files Created/Modified

- `plan-context.ts`
- `plan-context.js`
- `tests/s02-plan-context-needed.test.mts`
