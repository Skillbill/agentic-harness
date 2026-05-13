---
estimated_steps: 1
estimated_files: 1
skills_used: []
---

# T03: Extend commands/map-codebase.md to emit .pi/codebase/INDEX.md as 8th artifact

Update the slash-command document `commands/map-codebase.md` so that when an LLM runs `/ah:map-codebase`, after producing the existing 7 documents it also writes `.pi/codebase/INDEX.md`. Concretely: (1) in the section at line 97-104 listing the 7 expected documents, add `INDEX.md` as an 8th bullet labeled `INDEX.md (path + 1-line summary per doc, machine-parsed by the extension)`; (2) add a new section (or extend the relevant existing one) titled `### N. Genera INDEX.md` that instructs the LLM to write `.pi/codebase/INDEX.md` containing one line per `.md` file in `.pi/codebase/` (excluding INDEX.md itself), in the form `<relPath>: <one-line summary ≤ 120 char>`, where the summary is the first `# ` heading or the first non-empty body line. Document the format explicitly: lines must match the regex `^[A-Za-z0-9_\-\./]+\.md: .{1,120}$`. State that the extension prefers a disk-resident `INDEX.md` over its lazy in-memory fallback, so regenerating after edits is recommended but not mandatory. Keep the rest of the command instructions intact. This task touches documentation only — no `.ts` files.

## Inputs

- ``commands/map-codebase.md` — file being modified; the 7-doc list at lines 97-104 is the anchor point`
- ``.gsd/milestones/M001/slices/S01/S01-RESEARCH.md` — section `## Implementation Landscape` describes the INDEX format`

## Expected Output

- ``commands/map-codebase.md` — modified: 8th artifact `INDEX.md` listed and a generation section added`

## Verification

grep -q 'INDEX.md' commands/map-codebase.md && grep -cE '^- `(STACK|INTEGRAZIONI|ARCHITETTURA|STRUTTURA|CONVENZIONI|TESTING|CRITICITA|INDEX)\.md`' commands/map-codebase.md | awk '$1>=8'
