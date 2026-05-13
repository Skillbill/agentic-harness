---
estimated_steps: 1
estimated_files: 2
skills_used: []
---

# T01: Add codebase-index.ts (pure INDEX builder) and load-codebase-doc.ts (path-safe tool)

Create two new TypeScript modules in the extension root, both with pure, testable functions plus the pi-API registration wrapper for the tool. Module `codebase-index.ts` exports `buildCodebaseIndex(codebaseDir: string): { entries: { relPath: string; summary: string }[]; messageContent: string; approxTokens: number }` — reuses the existing `collectMarkdownFiles` pattern from `index.ts:16-32` (re-implement locally to avoid coupling, scanning recursive `.md` files), derives the 1-line summary as the first non-empty header line (`# ...`) or first non-empty body line, truncated to 120 chars. The returned `messageContent` is a markdown block with header `## 📚 Project Codebase Index`, the entries as `- <relPath>: <summary>`, and an operational footer instructing the LLM: *"To read the full content of a codebase document, call the tool `load_codebase_doc({ name: \"<filename-without-.md>\" })`. Do not read `.pi/codebase/*.md` directly with the `read` tool."*. Module `load-codebase-doc.ts` exports `resolveCodebaseDocPath(cwd: string, name: string): { ok: true; path: string } | { ok: false; error: string }` — sanitizes `name` to `^[a-zA-Z0-9_-]+$` (reject `..`, slashes, absolute paths, anything else), resolves to `path.resolve(join(cwd, '.pi', 'codebase', name + '.md'))`, asserts the resolved path is still under `<cwd>/.pi/codebase/` after `path.resolve`, then asserts file existence with `existsSync`. Also exports `registerLoadCodebaseDoc(pi: ExtensionAPI): void` which calls `pi.registerTool` with name `load_codebase_doc`, parameters schema `{ type: 'object', properties: { name: { type: 'string' } }, required: ['name'] }` (use typebox `Type.Object`/`Type.String` if imported from the existing dep — otherwise inline JSON-schema works per the API), description directing the LLM toward this tool over generic `read` on `.pi/codebase/`. The tool handler invokes `resolveCodebaseDocPath`, reads file with `readFileSync(p, 'utf-8')` on success, returns `{ content: [{ type: 'text', text: body }] }`; on failure returns `{ isError: true, content: [{ type: 'text', text: errorMsg }] }`. Both modules: zero side-effects at import time, no top-level reads.

## Inputs

- ``index.ts` — reference for `collectMarkdownFiles` (lines 16-32) and current injection pattern`
- ``context-inspector.ts` — reference for `pi.registerTool`/handler shape and the `payload.tools` field at lines 302-310`
- ``.gsd/milestones/M001/slices/S01/S01-RESEARCH.md` — full design and security constraints`

## Expected Output

- ``codebase-index.ts` — new file exporting `buildCodebaseIndex` pure function`
- ``load-codebase-doc.ts` — new file exporting `resolveCodebaseDocPath` pure function and `registerLoadCodebaseDoc(pi)` registration wrapper`

## Verification

test -f codebase-index.ts && test -f load-codebase-doc.ts && grep -q 'export function buildCodebaseIndex' codebase-index.ts && grep -q 'export function resolveCodebaseDocPath' load-codebase-doc.ts && grep -q 'export function registerLoadCodebaseDoc' load-codebase-doc.ts && grep -q 'registerTool' load-codebase-doc.ts && grep -qE '\^\[a-zA-Z0-9_-\]\+\$' load-codebase-doc.ts
