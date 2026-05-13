---
estimated_steps: 2
estimated_files: 1
skills_used: []
---

# T01: Lock context-needed frontmatter spec in task-layout.md (§3.3 + §2.2 rewrite)

Make `task-layout.md` the canonical spec for the new per-task context mechanism. Rewrite §2.2 'Caricamento selettivo' to describe INDEX + load_codebase_doc + PLAN.md frontmatter (removing the static tipo-task table) and extend §3.3 'PLAN.md' template to show the `context-needed:` YAML frontmatter at the top of the file, with stem-vs-filename rule, an empty-list example, and a counter-example. Italian-language prose to match surrounding tone; key name stays English (`context-needed:`). No other sections of task-layout.md are touched.

Decision (locked): YAML frontmatter at top of PLAN.md with single `context-needed:` key whose value is a YAML list of doc stems matching regex `^[a-zA-Z0-9_-]+$` (no `.md` suffix). Empty list `context-needed: []` is legal and means 'task plans without codebase context'. Missing key is also tolerated by parsers but skills MUST always emit the key.

## Inputs

- ``task-layout.md` — current design doc with §2.2 static table (lines 71-86) and §3.3 PLAN.md template (lines 171-194) to update`
- ``load-codebase-doc.ts` — for the canonical NAME_PATTERN regex (`^[a-zA-Z0-9_-]+$`) to cite in the spec`
- ``codebase-index.ts` — for the INDEX message format (`- <relPath>: <summary>`) to reference when explaining stem-stripping`

## Expected Output

- ``task-layout.md` — §2.2 rewritten (table removed, replaced with one short paragraph pointing to PLAN.md frontmatter as authority); §3.3 PLAN.md template extended with `---\ncontext-needed: [...]\n---` block at the top, plus a worked example (`context-needed: [CONVENZIONI, STRUTTURA]`), a counter-example (`# wrong: CONVENZIONI.md  # right: CONVENZIONI`), and the empty-list semantics noted explicitly`

## Verification

grep -q 'context-needed' task-layout.md && grep -q 'context-needed: \[\]' task-layout.md && ! grep -E 'Tipo di lavoro \| Documenti caricati' task-layout.md >/dev/null && grep -q 'load_codebase_doc' task-layout.md && grep -cE '^## ' task-layout.md
