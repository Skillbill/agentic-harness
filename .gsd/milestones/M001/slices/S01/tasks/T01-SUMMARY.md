---
id: T01
parent: S01
milestone: M001
key_files:
  - codebase-index.ts
  - load-codebase-doc.ts
key_decisions:
  - Used TypeBox (Type.Object / Type.String, imported from 'typebox') for the tool parameters schema — required by ToolDefinition<TParams extends TSchema> in @mariozechner/pi-coding-agent and consistent with the upstream dynamic-tools.ts example.
  - Containment check uses `candidate.startsWith(codebaseRoot + sep)` (or strict equality) rather than plain `startsWith(codebaseRoot)` to prevent a prefix attack like `.pi/codebaseXYZ`.
  - One-line summary prefers the first markdown header over the first body line; both are stripped of leading `#` chars and truncated to 120 chars with an ellipsis when overlong, matching the research target (<120 chars/entry).
  - Both modules are side-effect-free at import time; the tool reads `process.cwd()` only inside `execute` so cwd changes between turns are honored.
duration: 
verification_result: passed
completed_at: 2026-05-12T15:04:07.773Z
blocker_discovered: false
---

# T01: Added codebase-index.ts (pure INDEX builder) and load-codebase-doc.ts (path-safe LLM tool registration)

**Added codebase-index.ts (pure INDEX builder) and load-codebase-doc.ts (path-safe LLM tool registration)**

## What Happened

Created two new TypeScript modules at the extension root.

`codebase-index.ts` exports the pure function `buildCodebaseIndex(codebaseDir)` returning `{ entries, messageContent, approxTokens }`. It locally re-implements the recursive markdown collector (no coupling to `index.ts`) and derives a one-line summary per file: first non-empty `#`-header (header chars stripped) when available, otherwise the first non-empty body line, truncated to 120 chars (with an ellipsis). The composed `messageContent` is a markdown block with the header `## 📚 Project Codebase Index`, an `- <relPath>: <summary>` entry per file, and an operational footer instructing the LLM to call `load_codebase_doc({ name: "<filename-without-.md>" })` for full content and to avoid generic `read` on `.pi/codebase/*.md`. No top-level side-effects.

`load-codebase-doc.ts` exports `resolveCodebaseDocPath(cwd, name)`: it rejects empty input, enforces the `^[a-zA-Z0-9_-]+$` regex (no `..`, no separators, no extension), resolves `path.resolve(join(cwd, '.pi', 'codebase', name + '.md'))`, asserts containment under `<cwd>/.pi/codebase/` using a trailing-separator startsWith check (which prevents the `.pi/codebaseXYZ` prefix-attack), and asserts existence via `existsSync`. It also exports `registerLoadCodebaseDoc(pi)` which calls `pi.registerTool` with name `load_codebase_doc`, a TypeBox `Type.Object({ name: Type.String(...) })` schema (TypeBox is the API-mandated schema type per the extension type defs `ToolDefinition<TParams extends TSchema>`), a description and `promptGuidelines` steering the LLM toward this tool over generic `read`. The handler invokes `resolveCodebaseDocPath`, on success returns `{ content: [{ type: 'text', text: body }], details: { path, bytes } }` (reading via `readFileSync(p, 'utf-8')`), and on any failure (rejected name, escape, missing file, read error) returns `{ isError: true, content: [{ type: 'text', text: <msg> }] }` so the LLM sees the error in the next turn and the context-inspector counter still increments. No top-level side-effects.

Neither module mutates `index.ts` — wiring the tool registration and replacing the forced injection at `index.ts:119-159` belongs to subsequent tasks in this slice.

## Verification

Ran the slice-mandated verification chain end-to-end:
`test -f codebase-index.ts && test -f load-codebase-doc.ts && grep -q 'export function buildCodebaseIndex' codebase-index.ts && grep -q 'export function resolveCodebaseDocPath' load-codebase-doc.ts && grep -q 'export function registerLoadCodebaseDoc' load-codebase-doc.ts && grep -q 'registerTool' load-codebase-doc.ts && grep -qE '\^\[a-zA-Z0-9_-\]\+\$' load-codebase-doc.ts`
→ exited 0, printed `VERIFY_OK`. All seven contractual sub-checks pass: both files exist, the three required exports are present, `registerTool` is wired, and the path-safety regex `^[a-zA-Z0-9_-]+$` is encoded in the module. Imports (`@mariozechner/pi-coding-agent`, `typebox`, `node:fs`, `node:path`) match the patterns already used by `index.ts` / `register-prompt.ts` and by the upstream `dynamic-tools.ts` example.

## Verification Evidence

| # | Command | Exit Code | Verdict | Duration |
|---|---------|-----------|---------|----------|
| 1 | `test -f codebase-index.ts && test -f load-codebase-doc.ts && grep -q 'export function buildCodebaseIndex' codebase-index.ts && grep -q 'export function resolveCodebaseDocPath' load-codebase-doc.ts && grep -q 'export function registerLoadCodebaseDoc' load-codebase-doc.ts && grep -q 'registerTool' load-codebase-doc.ts && grep -qE '\^\[a-zA-Z0-9_-\]\+\$' load-codebase-doc.ts` | 0 | pass | 40ms |

## Deviations

None — output matches the task plan's `Expected Output` exactly. The path-safety logic adds a defensive trailing-separator check on top of the `path.resolve` containment assertion the plan requested; this is a tightening, not a deviation.

## Known Issues

No wiring yet: `index.ts` still uses the legacy forced full-codebase injection at lines 119-159. Replacing that block with `buildCodebaseIndex` output and invoking `registerLoadCodebaseDoc(pi)` from the extension factory is the natural follow-up task in this slice — it is not in T01's scope per the plan.

## Files Created/Modified

- `codebase-index.ts`
- `load-codebase-doc.ts`
