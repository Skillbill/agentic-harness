# S01: INDEX + load on-demand (foundation) — UAT

**Milestone:** M001
**Written:** 2026-05-12T15:13:18.319Z

## UAT — S01: INDEX + load on-demand (foundation)

**UAT Type:** integration-level smoke + code-resident automated test. End-to-end with a real skill arrives in S02.

### Preconditions
- Worktree at `/home/toto/scm-projects/agentic-harness/.gsd/worktrees/M001` checked out at the post-S01 commit.
- Node 22.20+ available on PATH (required for `--experimental-strip-types`).
- The global PI host has `@earendil-works/pi-coding-agent` (or `@mariozechner/pi-coding-agent`) installed with its bundled `typebox` (needed for the test's self-healing preflight).
- `.pi/codebase/` may or may not contain `*.md` artifacts — both branches are exercised.

### Steps

1. From the worktree root, verify the two new modules exist and expose the contracted symbols:
   ```bash
   test -f codebase-index.ts && test -f load-codebase-doc.ts \
     && grep -q 'export function buildCodebaseIndex' codebase-index.ts \
     && grep -q 'export function resolveCodebaseDocPath' load-codebase-doc.ts \
     && grep -q 'export function registerLoadCodebaseDoc' load-codebase-doc.ts
   ```
   **Expected:** exit 0.

2. Verify `index.ts` was rewired — imports added, tool registered, legacy `project-codebase-map` sentinel removed:
   ```bash
   grep -q "from './codebase-index.js'" index.ts \
     && grep -q "from './load-codebase-doc.js'" index.ts \
     && grep -q 'registerLoadCodebaseDoc(pi)' index.ts \
     && grep -q 'project-codebase-index' index.ts \
     && ! grep -q 'project-codebase-map' index.ts \
     && ! grep -qE 'sections\.push\(.+f\.content' index.ts
   ```
   **Expected:** exit 0 — new wiring present, legacy injection removed.

3. Verify `/ah:map-codebase` documentation lists 8 artifacts (the 7 thematic docs + INDEX.md):
   ```bash
   grep -q 'INDEX.md' commands/map-codebase.md \
     && grep -cE '^- `(STACK|INTEGRAZIONI|ARCHITETTURA|STRUTTURA|CONVENZIONI|TESTING|CRITICITA|INDEX)\.md`' commands/map-codebase.md
   ```
   **Expected:** count ≥ 8 (observed: 9), exit 0.

4. Run the slice's automated test (covers INDEX size budget, header-derived summaries, valid-path resolution, and traversal rejection):
   ```bash
   node --experimental-strip-types --test tests/s01-load-on-demand.test.mts 2>&1 | tee /tmp/s01-test.out
   grep -E '^# pass [1-9]' /tmp/s01-test.out && ! grep -E '^# fail [1-9]' /tmp/s01-test.out
   ```
   **Expected:** `# pass 3`, `# fail 0`, exit 0.

5. Self-healing rerun (verifies the test boots even without a pre-existing `node_modules/typebox` symlink):
   ```bash
   rm -rf node_modules
   node --experimental-strip-types --test tests/s01-load-on-demand.test.mts
   ```
   **Expected:** 3/3 pass; a `node_modules/typebox` symlink is recreated by the test preflight.

### Expected Outcomes
- The extension factory in `index.ts` now invokes `registerLoadCodebaseDoc(pi)` and ships only the compact INDEX in the first `before_agent_start` message (customType `project-codebase-index`, `display: false`).
- A startup log line `[agentic-harness] codebase-index: injecting N entries (~K tokens)` with `K < 500` would appear in a real PI session (observable via existing extension logging — not exercised in steps because PI runtime isn't booted here).
- `load_codebase_doc({name: "FOO"})` resolves through `resolveCodebaseDocPath` → reads `.pi/codebase/FOO.md` → returns `{ content: [{type:"text", text: <body>}] }`. Names containing `..`, `/`, or other characters outside `^[a-zA-Z0-9_-]+$` get rejected with `{isError: true, content:[{type:"text", text:<msg>}]}`.

### Edge Cases
- **Empty/missing `.pi/codebase/`:** the hook short-circuits and sets the one-shot flag without injecting any message (regression-tested by the early-return in `index.ts`; observable as the absence of the new log line in a no-codebase session).
- **Disk INDEX.md present:** body is used verbatim (so `/ah:map-codebase`-generated INDEX is authoritative, even if its entries diverge from a fresh `buildCodebaseIndex` scan).
- **Disk INDEX.md absent but `.md` files present:** `buildCodebaseIndex` runs and injects its `messageContent`.
- **Path-traversal inputs:** `'../etc/passwd'`, `'/etc/passwd'`, `'FOO/../BAR'`, `'NONEXISTENT'` all return `{ok: false}` (covered by the test).
- **Prefix attack on codebase dir:** containment check uses `candidate.startsWith(codebaseRoot + sep)` (or strict equality), defeating `.pi/codebaseXYZ`-style escapes.

### Not Proven By This UAT
- No live PI session was booted; the rename of the startup log line and the `customType` change are verified via code inspection, not by observing a real `before_agent_start` event in a running agent. A real-session smoke check is implicit in S02 (which exercises the skills against the new mechanism).
- Token-count budget (`K < 500`) is asserted only indirectly via the test's `messageContent.length < 2048` bound on a 2-entry fixture; a real-world `.pi/codebase/` with 7+ docs has not been measured in this slice.
- The Context Inspector's automatic capture of `load_codebase_doc` tool-use events (claimed at `context-inspector.ts:217-237`) is asserted by code-reading only — S03 will exercise it end-to-end with an actual tool call and produce `summary.json` / `requests.ndjson` evidence.
- No change to `skills/*/INSTRUCTIONS.md` is verified here (deduplication is explicitly S02 scope).
