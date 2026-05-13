---
id: T04
parent: S01
milestone: M001
key_files:
  - tests/s01-load-on-demand.test.mts
key_decisions:
  - Used top-level `await import(...)` for `../codebase-index.ts` and `../load-codebase-doc.ts` so a small preflight (`ensureTypeboxResolvable`) can run first and create the `node_modules/typebox` symlink before module resolution.
  - Discovered the upstream typebox via `npm root -g` and probed two candidate package paths (`@earendil-works/pi-coding-agent` and `@mariozechner/pi-coding-agent`) for portability across PI distros — best-effort, swallows errors silently and lets the failed import surface a clear MODULE_NOT_FOUND if no candidate exists.
  - Asserted summary equality to the literal header text ('Foo' / 'Bar') rather than only the length bound — exercises `deriveSummary`'s preference for the first `#` header over the first body line, which is the contract the index relies on.
duration: 
verification_result: passed
completed_at: 2026-05-12T15:10:46.658Z
blocker_discovered: false
---

# T04: Added tests/s01-load-on-demand.test.mts — node:test coverage for INDEX size, header-derived summaries, tool resolver, and path-traversal rejection.

**Added tests/s01-load-on-demand.test.mts — node:test coverage for INDEX size, header-derived summaries, tool resolver, and path-traversal rejection.**

## What Happened

Created `tests/s01-load-on-demand.test.mts`, a Node-native test (node:test + node:assert/strict) covering the two pure modules produced in T01.

The test:
1. In a `before()` hook, creates a tmp dir via `mkdtempSync(join(tmpdir(), "ah-s01-"))`, populates `<tmpDir>/.pi/codebase/FOO.md` ("# Foo\n\nSome convention.") and `<tmpDir>/.pi/codebase/BAR.md` ("# Bar\n\nAnother thing."), and tears it down in `after()` with `rmSync(..., { recursive: true, force: true })`.
2. Imports `buildCodebaseIndex` from `../codebase-index.ts` and asserts: `result.entries.length === 2`; both `FOO.md` and `BAR.md` are present; summaries are non-empty and ≤120 chars; the summary for each is the header text ("Foo" / "Bar") derived from `# Foo` / `# Bar`; `result.messageContent.length < 2048`; `result.messageContent` matches `/load_codebase_doc/`.
3. Imports `resolveCodebaseDocPath` from `../load-codebase-doc.ts` and asserts: a valid name (`"FOO"`) returns `{ ok: true, path: <tmpDir>/.pi/codebase/FOO.md }` with the resolved path under the codebase root.
4. Asserts path-traversal rejection: `"../etc/passwd"`, `"/etc/passwd"`, `"FOO/../BAR"`, and `"NONEXISTENT"` all return `ok: false`. The first three are rejected by the NAME_PATTERN regex; the last is rejected because the file does not exist.

DEVIATION FROM PLAN (recorded): `load-codebase-doc.ts` does `import { Type } from "typebox"` at module scope. The worktree has no local node_modules and no package.json — typebox is only installed transitively under the PI host's global `@earendil-works/pi-coding-agent/node_modules/`. A naïve `import "../load-codebase-doc.ts"` therefore fails with MODULE_NOT_FOUND, contradicting the plan's claim that the file is "pure" and immediately importable.

To preserve the slice verification command verbatim (`node --experimental-strip-types --test tests/s01-load-on-demand.test.mts`), the test file performs a small self-healing preflight before importing the modules: it checks `node_modules/typebox` at the worktree root, and if absent, runs `npm root -g` and symlinks the upstream typebox copy (from `@earendil-works/pi-coding-agent` or `@mariozechner/pi-coding-agent`) into `<repoRoot>/node_modules/typebox`. `node_modules/` is gitignored, so this is a runtime-only fixture. The two production modules are then loaded via `await import(...)` so the symlink is established before resolution runs. Verified the self-heal: deleting node_modules and re-running the verification command still passes 3/3.

## Verification

Ran the exact slice verification command from the plan twice — once with `node_modules/typebox` pre-existing, and once after `rm -rf node_modules` to confirm the test's self-healing preflight works. Both runs exit 0 with 3/3 tests passing (`# pass 3`, `# fail 0`).

## Verification Evidence

| # | Command | Exit Code | Verdict | Duration |
|---|---------|-----------|---------|----------|
| 1 | `test -f tests/s01-load-on-demand.test.mts && node --experimental-strip-types --test tests/s01-load-on-demand.test.mts 2>&1 | tee /tmp/s01-test.out && grep -E '^# pass [1-9]' /tmp/s01-test.out && ! grep -E '^# fail [1-9]' /tmp/s01-test.out` | 0 | pass | 538ms |
| 2 | `rm -rf node_modules && node --experimental-strip-types --test tests/s01-load-on-demand.test.mts (self-healing rerun)` | 0 | pass | 629ms |

## Deviations

Plan claimed `load-codebase-doc.ts` is a "pure" module importable directly; in practice it has a runtime `import { Type } from "typebox"` and the worktree has no node_modules. Added a self-healing `node_modules/typebox` symlink step inside the test file (preflight before dynamic imports) so the exact verification command from the plan still works without any out-of-band setup. node_modules/ is gitignored, so no tracked-state pollution.

## Known Issues

The self-healing preflight assumes typebox is installed under the global PI host (either `@earendil-works/pi-coding-agent` or `@mariozechner/pi-coding-agent`). If those packages move or are uninstalled, the dynamic import of `../load-codebase-doc.ts` will fail with MODULE_NOT_FOUND. A future task could add a real `package.json` at the worktree root with `typebox` as a devDependency to make the dependency explicit.

## Files Created/Modified

- `tests/s01-load-on-demand.test.mts`
