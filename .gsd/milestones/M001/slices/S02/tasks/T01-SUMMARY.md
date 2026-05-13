---
id: T01
parent: S02
milestone: M001
key_files:
  - task-layout.md
key_decisions:
  - PLAN.md frontmatter uses YAML with single `context-needed:` key whose value is a list of doc stems (no `.md`, no path) matching ^[a-zA-Z0-9_-]+$ — same regex as load-codebase-doc.ts NAME_PATTERN, ensuring spec and runtime guard agree.
  - Empty list `context-needed: []` is legal and must be emitted by skills even when no codebase doc is needed; missing key is tolerated by parsers for back-compat but not produced by the official template.
  - Static tipo-task → doc table is removed entirely; INDEX + on-demand judgment is the only fallback when PLAN.md does not yet exist.
duration: 
verification_result: passed
completed_at: 2026-05-12T15:22:55.403Z
blocker_discovered: false
---

# T01: Locked context-needed frontmatter spec in task-layout.md by rewriting §2.2 to drop the static tipo-task table and extending §3.3 with the PLAN.md YAML frontmatter contract, example, counter-example, and empty-list semantics.

**Locked context-needed frontmatter spec in task-layout.md by rewriting §2.2 to drop the static tipo-task table and extending §3.3 with the PLAN.md YAML frontmatter contract, example, counter-example, and empty-list semantics.**

## What Happened

Made task-layout.md the canonical spec for the new per-task context mechanism.

§2.2 "Caricamento selettivo" rewritten: removed the seven-row `Tipo di lavoro | Documenti caricati` table and the fallback line. Replaced with two short paragraphs explaining that (a) PLAN.md `context-needed:` frontmatter is authoritative — discuss/execute/verify load exactly those docs via `load_codebase_doc`, nothing more, nothing less — and (b) when PLAN.md does not yet exist (typically during the first `/task-discuss` or `/task-plan`), phases fall back to `.pi/codebase/INDEX.md` and on-demand judgment. Italian prose preserved.

§3.3 "PLAN.md" extended: added a preamble explaining the `context-needed:` key rules (YAML list of stems, regex `^[a-zA-Z0-9_-]+$` mirroring load-codebase-doc.ts NAME_PATTERN, empty list legal and required to be emitted by skills); prepended a `---\ncontext-needed: [CONVENZIONI, STRUTTURA]\n---` frontmatter block to the existing PLAN.md code-fence template; added a separate fenced empty-list example (`context-needed: []`); added a fenced counter-example block showing the three forbidden forms (`.md` suffix, path prefix) and the correct stem-only form; closed with the stem-vs-INDEX mapping rule (`- CONVENZIONI.md: …` → stem `CONVENZIONI`).

No other sections of task-layout.md touched. Pure prompt/contract change — no TypeScript or hook code modified.

## Verification

Ran the task plan's verification one-liner against the updated file: it confirmed `context-needed` is present, the empty-list form `context-needed: []` is present, the old `Tipo di lavoro | Documenti caricati` table header is absent, `load_codebase_doc` is referenced, and counted 17 `## ` section headers. Exit code 0.

## Verification Evidence

| # | Command | Exit Code | Verdict | Duration |
|---|---------|-----------|---------|----------|
| 1 | `grep -q 'context-needed' task-layout.md && grep -q 'context-needed: \[\]' task-layout.md && ! grep -E 'Tipo di lavoro \| Documenti caricati' task-layout.md >/dev/null && grep -q 'load_codebase_doc' task-layout.md && grep -cE '^## ' task-layout.md` | 0 | pass | 50ms |

## Deviations

None. §2.2 rewritten and §3.3 extended exactly as scoped; no other sections of task-layout.md were touched.

## Known Issues

The four skills (discuss/plan/execute/verify) and any tests that assert on the old tipo-task table still need to be updated and a parser added — those are downstream tasks in this slice (S02), not T01.

## Files Created/Modified

- `task-layout.md`
