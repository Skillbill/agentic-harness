---
estimated_steps: 1
estimated_files: 1
skills_used: []
---

# T02: Replace forced full-doc injection in index.ts with INDEX-only injection + register load_codebase_doc

Modify `index.ts` to (a) wire the tool registration and (b) shrink the `before_agent_start` injection. At the top of the factory `export default function(pi)` (`index.ts:62-67`), add `registerLoadCodebaseDoc(pi)` immediately after the existing `registerContextInspector(pi)` call. Replace the body of the first `before_agent_start` hook (`index.ts:119-159`) with logic that: (1) keeps the `codebaseContextInjected`/`cachedCodebaseContext` closure-cache pattern (the one-shot-per-session guarantee at line 116-117 stays); (2) if `.pi/codebase/INDEX.md` exists on disk, reads it and uses its body verbatim as the message content (so a freshly-generated INDEX from `map-codebase` is authoritative); (3) otherwise calls `buildCodebaseIndex(join(cwd, '.pi', 'codebase'))` and uses the returned `messageContent`; (4) if the codebase dir is empty/missing, returns without injecting and sets the flag (preserving current behavior at lines 127-130); (5) renames the existing console log to `[agentic-harness] codebase-index: injecting N entries (~K tokens)` for the new sentinel; (6) returns the message with `customType: 'project-codebase-index'` (rename from `project-codebase-map`), `display: false`. Do NOT touch the second `before_agent_start` hook (current-task context, lines 162-191) — it is orthogonal. Do NOT touch any `skills/*/INSTRUCTIONS.md` (S02 territory). Imports to add at top of `index.ts`: `import { buildCodebaseIndex } from './codebase-index.js';` and `import { registerLoadCodebaseDoc } from './load-codebase-doc.js';` (use the `.js` extension — runtime ESM resolution, as the rest of the file already does at line 7).

## Inputs

- ``index.ts` — file being modified; preserve lines 1-67 except for the two new imports and the new `registerLoadCodebaseDoc(pi)` call, and lines 162-191 (second hook) unchanged`
- ``codebase-index.ts` — produced by T01, source of `buildCodebaseIndex``
- ``load-codebase-doc.ts` — produced by T01, source of `registerLoadCodebaseDoc``

## Expected Output

- ``index.ts` — modified: new imports at top, `registerLoadCodebaseDoc(pi)` in factory, first `before_agent_start` body rewritten to inject INDEX-only`

## Verification

grep -q "from './codebase-index.js'" index.ts && grep -q "from './load-codebase-doc.js'" index.ts && grep -q 'registerLoadCodebaseDoc(pi)' index.ts && grep -q 'buildCodebaseIndex' index.ts && grep -q 'project-codebase-index' index.ts && ! grep -q 'project-codebase-map' index.ts && ! grep -qE 'sections\.push\(.+f\.content' index.ts

## Observability Impact

Replaces the existing `[agentic-harness] codebase-map: ...` log line with `[agentic-harness] codebase-index: injecting N entries (~K tokens)`. The new sentinel is the primary runtime signal that the slice is working; absence means the hook didn't fire.
