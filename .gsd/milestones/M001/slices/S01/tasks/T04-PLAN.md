---
estimated_steps: 1
estimated_files: 1
skills_used: []
---

# T04: Write executable test covering INDEX size, tool resolver, and path-traversal rejection

Create `tests/s01-load-on-demand.test.mts` — a Node-native test (no external test framework needed; use `node:assert/strict` and `node:test`) that exercises the pure functions produced in T01. Runnable as `node --experimental-strip-types --test tests/s01-load-on-demand.test.mts` (Node 22.20 supports `--experimental-strip-types` natively for `.mts`). The test must: (1) create a tmp dir via `fs.mkdtempSync(join(os.tmpdir(), 'ah-s01-'))`, populate it with `.pi/codebase/FOO.md` (body: `# Foo\n\nSome convention.`) and `.pi/codebase/BAR.md` (body: `# Bar\n\nAnother thing.`); (2) import `buildCodebaseIndex` from `../codebase-index.ts` and assert: `result.entries.length === 2`, both relPaths present, summaries derived from the `# Foo`/`# Bar` headers (truncated ≤ 120 char each), `result.messageContent.length < 2048`, `result.messageContent` contains the literal string `load_codebase_doc`; (3) import `resolveCodebaseDocPath` from `../load-codebase-doc.ts` and assert: `resolveCodebaseDocPath(tmpDir, 'FOO').ok === true` with the returned path under `<tmpDir>/.pi/codebase/FOO.md`; (4) assert path-traversal rejection: `resolveCodebaseDocPath(tmpDir, '../etc/passwd').ok === false`, `resolveCodebaseDocPath(tmpDir, '/etc/passwd').ok === false`, `resolveCodebaseDocPath(tmpDir, 'FOO/../BAR').ok === false`, `resolveCodebaseDocPath(tmpDir, 'NONEXISTENT').ok === false`; (5) `afterEach`/cleanup: `fs.rmSync(tmpDir, { recursive: true, force: true })`. The test must NOT import `../index.ts` (that file imports `@mariozechner/pi-coding-agent` which isn't resolvable from the worktree root); only the two pure modules from T01 are imported. The test must NOT read or write under `.gsd/` — all fixtures live under the OS tmp dir.

## Inputs

- ``codebase-index.ts` — module under test (produced by T01)`
- ``load-codebase-doc.ts` — module under test (produced by T01)`

## Expected Output

- ``tests/s01-load-on-demand.test.mts` — new test file using `node:test` + `node:assert/strict``

## Verification

test -f tests/s01-load-on-demand.test.mts && node --experimental-strip-types --test tests/s01-load-on-demand.test.mts 2>&1 | tee /tmp/s01-test.out && grep -E '^# pass [1-9]' /tmp/s01-test.out && ! grep -E '^# fail [1-9]' /tmp/s01-test.out

## Observability Impact

Failure of this test is the canonical sentinel that the slice is broken — the executor must surface stdout/stderr of `node --test` on failure. The test prints which assertion failed (file:line), which is sufficient to diagnose without additional logging.
