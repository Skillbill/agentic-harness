# Task Layout & Inner Cycle

> **Status:** proposal approved, implementation in progress.
> **Audience:** project devs and agents (pi / PI extensions / prompt templates).
> **Scope:** defines the on-disk structure of a task and the inner cycle
> `discuss → plan → execute → verify`. Does not cover milestones, releases,
> or version roadmaps: those are out of scope.

This document is the **authoritative contract** for all prompt templates and
pi extensions that operate on tasks. If you change anything here, the
prompts in `.pi/prompts/` and the conventions in `AGENTS.md` must be updated
accordingly.

---

## 1. Task directory layout

A task = a **folder** `T-NNN-slug/` containing multiple files.
The folder moves between states exactly as the single file used to.

```
.pi/tasks/
├── backlog/
│   └── T-NNN-slug/
│       └── TASK.md                 ← created by /task-new
├── in-progress/
│   └── T-NNN-slug/
│       ├── TASK.md
│       ├── DISCUSS.md              ← created/extended by /task-discuss
│       ├── PLAN.md                 ← created by /task-plan (step index)
│       ├── steps/
│       │   ├── 01-*.md
│       │   ├── 02-*.md
│       │   └── ...                 ← step files, one per step
│       └── VERIFY.md               ← global DoD + Verify Log, managed by /task-verify
├── review/
│   └── T-NNN-slug/   (same structure)
└── done/
    └── T-NNN-slug/   (same structure, archive)
```

**Identification criterion:** a task is a *directory* whose name matches
`T-NNN-<slug>/` and which contains at least `TASK.md`. Every tool that
scans tasks must look for directories, not files.

---

## 2. Codebase map (`.pi/codebase/`) — project-level prerequisite

The codebase map is a **project-level** resource (not per-task), produced
by the codebase-map procedure (`procedures/map-codebase.md`, R-0012 —
**not** an explicit slash command). It contains 7 structured documents
describing cross-cutting aspects of the whole project:

| Document | Content |
|---|---|
| `STACK.md` | Languages, runtime, frameworks, dependencies, configuration |
| `INTEGRATIONS.md` | External APIs, databases, auth providers, webhooks |
| `ARCHITECTURE.md` | Patterns, layers, data flow, abstractions, entry points |
| `STRUCTURE.md` | Directory layout, key locations, where to add code |
| `CONVENTIONS.md` | Code style, naming, patterns, error handling |
| `TESTING.md` | Test framework, structure, mocking, coverage |
| `TECHNICAL_DEBT.md` | Technical debt, known bugs, security, performance |

### Blocking prerequisite

The map is **mandatory** for the `discuss`, `plan`, and `execute` phases.
If `.pi/codebase/` does not exist or is incomplete when a phase requires it,
the agent **proposes running the codebase-map procedure inline** (it reads
`$EXT_DIR/procedures/map-codebase.md` and executes steps 2–5). If the dev
refuses, the phase halts.

### Selective loading

Phases do not load all 7 documents: the selection is **per-task** and is
declared in the YAML frontmatter key `context-needed:` at the top of
`PLAN.md` (see §3.3). `PLAN.md` is the authority: discuss/execute/verify
load — via `load_codebase_doc` — exactly the docs listed there, nothing
more, nothing less. The list may be empty (`context-needed: []`) for
tasks that don't need any codebase context.

When `PLAN.md` does not yet exist (typically during `/task-discuss`, or
for the first `/task-plan`), the phase falls back on the **INDEX**
(`.pi/codebase/INDEX.md`) — a compact `<path>: <summary>` list — and
uses its own judgment to call `load_codebase_doc` only on the relevant
documents. There is no longer a static task-type → document table: the
choice is explicit for every task.

### Updating

The map is updated:
- **Automatically** when one of the inner-cycle phases (`discuss`, `plan`,
  `execute`) needs `.pi/codebase/` and finds it missing or incomplete —
  the phase runs the codebase-map procedure inline before continuing.
- **Automatically** by `/ah:task-done` at task closure (regenerates the
  map to reflect the changes introduced).
- **Manually**, when the dev wants a refresh outside the task cycle: ask
  the agent in chat to "run the codebase-map procedure" — it will read
  `$EXT_DIR/procedures/map-codebase.md` and execute it. There is no
  slash command for this (R-0012).

### CODEMAP.md — deprecated

> ⚠️ **`CODEMAP.md` (per-task) is deprecated.** Existing tasks that
> contain it can keep it as historical reference, but the inner-cycle
> phases no longer generate it, update it, or require it as a
> prerequisite. Code context is provided entirely by the project-level
> codebase map (`.pi/codebase/`).

---

## 3. Task files

### 3.1 `TASK.md` — the card (always present)

Contains the frontmatter (task identity) and the high-level narrative
sections. It's the file you look at to "know what this is about".

**Frontmatter**:

```yaml
---
id: T-NNN
title: <human title>
status: backlog | in-progress | review | done
priority: LOW | NORMAL | HIGH | IMMEDIATE   # default NORMAL
estimate: <N>h | null
assignee: <username> | null
branch: feature/T-NNN-<slug> | null
implements: [R-NNNN, ...]   # optional; empty list `[]` is legal
created: YYYY-MM-DD
updated: YYYY-MM-DD
---
```

**`priority:` key — coarse-grained urgency tag**

- Allowed values: `LOW`, `NORMAL`, `HIGH`, `IMMEDIATE` (uppercase, case-sensitive). Default `NORMAL`.
- Set to `NORMAL` by `/ah:task-new`; not asked during the interview. The dev edits it by hand when a task is more (or less) urgent than the default.
- Consumed by `/ah:project-status`: priority is displayed next to each task and the `Backlog` section is rendered in priority-descending order (`IMMEDIATE → HIGH → NORMAL → LOW`, tie-break by ID ascending).
- Existing tasks without the field are migrated to `priority: NORMAL` by the v0.10.0 consumer migration.

**`implements:` key — linking to project requirements**

- Value: YAML list of `R-NNNN` strings (each matches `^R-\d{4}$`), each
  referring to an entry in `<consumerRoot>/.pi/REQUIREMENTS.md`. The empty
  list `[]` is legal and means "no declared requirement link".
- Populated by `/ah:task-new` step 2-bis (the dev picks an existing
  R-NNNN id, creates one inline, or skips). May be extended by
  `/ah:task-discuss` step 7.5 when a new R-NNNN is created and the dev
  opts to link it to the current task.
- Consumed by `/ah:task-discuss`, `/ah:task-plan`, and `/ah:task-verify`
  to load the relevant R-NNNN entries as context. **Not** consumed by
  `/ah:task-execute`.
- Linked tasks back-references are maintained automatically: when
  `implements:` is set on a task, AH appends the task id to that
  R-NNNN's `**Linked tasks**` line in `.pi/REQUIREMENTS.md` (no reverse
  cleanup on rename / removal — the dev edits by hand).

**Body sections** (slim version, after the simplification of
`/ah:task-new`):

- `## Context` — short prose: why the task exists.
- `## Objective` — short prose: what must be done, scope.
- `## Definition of Done` — standard entries (lint/typecheck/build/test/PR)
  copied from the template. Task-specific "human" DoD, if needed, is
  either added by the dev by hand or emerges in `/ah:task-discuss` /
  `/ah:task-plan`. The verify phase reads it and materializes it in
  `VERIFY.md`.
- `## Log` (macro notes by the dev, not tied to individual steps).

The sections `## Components involved` and `## Technical notes` are **no
longer part of the template**: `/ah:task-new` does not ask for them. If
a specific task needs them, the dev can add them by hand — no other AH
command reads them as mandatory.

### 3.2 `DISCUSS.md` — output of the discuss phase (optional)

Created/extended by `/task-discuss`. Formalizes the questions and answers
that emerged *beyond* the interview from `/task-new`, typically:

- Gray areas: UX choices / error-case behavior / data formats.
- Architectural decisions discussed and motivated.
- Impacts on data model, API surface, WebSocket events.
- Alternatives considered and discarded.

Structure:

```markdown
# Discuss — T-NNN

> Last update: YYYY-MM-DD

## <Gray area 1 title>

**Decision:** ...
**Rationale:** ...
**Alternatives discarded:** ...
**Notes / risks:** ...
```

### 3.3 `PLAN.md` — plan index (created by `/task-plan`)

`PLAN.md` **does not contain step detail**: it's an ordered index, plus
the cross-cutting aspects of the plan. At the top of `PLAN.md` lives a
YAML frontmatter block with the `context-needed:` key declaring which
documents from `.pi/codebase/` subsequent phases must load via
`load_codebase_doc`.

**Rules for the `context-needed:` key**

- Value: YAML list of **stems** of files under `.pi/codebase/`, i.e.
  the name without the `.md` extension.
- Each stem must match the regex `^[a-zA-Z0-9_-]+$` (the same applied by
  `load_codebase_doc`).
- The empty list (`context-needed: []`) is **legal and meaningful**: it
  indicates a task that needs no codebase context (e.g. changes to
  process documents, prompt-file cleanup).
- All commands that emit `PLAN.md` (starting with `/task-plan`) **must**
  write the key, even when empty. Downstream parsers and phases tolerate
  the key's absence for backward compatibility, but the official
  template always requires it.

```markdown
---
context-needed: [CONVENTIONS, STRUCTURE]
---

# Plan — T-NNN

## Strategy

A line or two on the overall "how", derived from TASK.md + DISCUSS.md.

## Steps (tight series, order = execution)

1. [01-db-schema-camera-kind](steps/01-db-schema-camera-kind.md) — DB schema: add camera.kind + stream_url · `todo` · 2h
2. [02-server-api-web-camera](steps/02-server-api-web-camera.md) — Server API for web-camera · `todo` · 3h
3. ...

## Known risks
...

## Plan updates
- YYYY-MM-DD: ...
```

**Example: empty list.**

```yaml
---
context-needed: []
---
```

Means: "Subsequent phases must not load any doc from `.pi/codebase/`."
This is the correct value for tasks that only touch process files (e.g.
templates, prompts, design docs).

**Counter-example: extensions and paths are forbidden.**

```yaml
# WRONG — includes the .md extension
context-needed: [CONVENTIONS.md, STRUCTURE.md]

# WRONG — includes a path
context-needed: [.pi/codebase/CONVENTIONS]

# RIGHT — stem only
context-needed: [CONVENTIONS, STRUCTURE]
```

The stem matches the `relPath` portion in `INDEX.md` stripped of the
`.md` extension: a line `- CONVENTIONS.md: …` in the INDEX becomes the
stem `CONVENTIONS` in `context-needed:`.

### 3.4 `steps/NN-<slug>.md` — one file per step

Each step is an **atomic commit** (see §5). The filename carries a
numeric prefix that determines order (tight series).

```markdown
---
id: T-NNN/NN
title: <step title>
status: todo | doing | done | blocked | failed
estimate: <N>h | null
---

## Execute

What must be done, concretely. Files that will be created/modified.
Technical decisions of detail concerning *only this step*.

**Files involved** (from the codebase map):
- To modify: `path/a.ts`, `path/b.ts`
- To create: `path/new.ts`

## Verify

Done criteria **local** to the step, ideally executable:

- [ ] `npm run lint` on touched components
- [ ] <specific check>
- [ ] <verifiable command>

## Log

(populated by /task-execute during the work: commands run, errors,
recovery notes)
```

**Step states:**

| State | Meaning |
|---|---|
| `todo` | not yet started |
| `doing` | `/task-execute` is working on this step |
| `done` | execute + local verify OK, atomic commit done |
| `blocked` | blocked by an external constraint; the dev must intervene |
| `failed` | verify failed, requires plan or step revision |

### 3.5 `VERIFY.md` — global task DoD and verify log

Created at the first run of `/task-verify`. Contains **the global DoD**
of the task and the log of verification commands run.

```markdown
# Verify — T-NNN

## Definition of Done (global)

### Standard
- [ ] `npm run lint` passes on touched components
- [ ] `npm run typecheck` passes (if applicable)
- [ ] `npm run build` passes on touched components
- [ ] Tests updated/added if applicable
- [ ] If DB schema: Liquibase migration created and tested
- [ ] Documentation updated (AGENTS.md, docs/, component README)
- [ ] Backward compatibility verified
- [ ] PR opened and approved

### Task-specific
(Copied/adapted from the DoD section of TASK.md)
- [ ] ...

## Verify Log

### YYYY-MM-DD HH:MM — /task-verify
- `npm run lint` (server): ✅
- ...
```

---

## 4. Inner cycle `discuss → plan → execute → verify`

All phases require `.pi/codebase/` as a blocking prerequisite (see §2).
If the map is missing, the phases propose to generate it inline.

All four commands **auto-detect the current task** from the git branch
(`git branch --show-current` matching `feature/T-NNN-*`).

### 4.1 `/task-discuss`

- Input: `TASK.md`, codebase map (`.pi/codebase/`), any existing
  `DISCUSS.md`.
- Output: `DISCUSS.md` created or extended with new sections.
- Behavior: loads the codebase map relevant to the task type, then
  conducts a structured interview on the gray areas. The questions are
  anchored to real code thanks to the map documents.

### 4.2 `/task-plan`

- Input: `TASK.md` + codebase map + `DISCUSS.md`.
- Output:
  - `PLAN.md` created with step index, strategy, risks.
  - `steps/NN-<slug>.md` for each identified step.
- Behavior: loads the codebase map, proposes a decomposition into
  atomic steps anchored to real files, asks for confirmation, generates
  the files.

### 4.3 `/task-execute`

- Input: `PLAN.md` + `steps/` + codebase map.
- Output: real code in the repo + updates to the current step file.
- Behavior:
  1. Find the first `todo` step (or `doing` if interrupted).
  2. Load codebase map relevant to the step.
  3. Mini-plan → dev approval → implementation → local verify.
  4. If OK, atomic commit.
  5. **Mandatory stop.** Only one step per invocation.

### 4.4 `/task-verify`

- Input: `TASK.md` + all steps + `VERIFY.md` (if present).
- Output: updated `VERIFY.md`.
- Behavior: runs the global DoD entries, logs the output.
  **Advisory:** does not block task closure.

---

## 5. Commit conventions

| Type | Format | Use |
|---|---|---|
| Step | `feat(T-NNN/NN): <step title>` | Generated by `/task-execute` |
| Discuss | `chore(T-NNN): update DISCUSS` | At the end of `/task-discuss` |
| Plan | `chore(T-NNN): plan` · `chore(T-NNN): replan` | At the end of `/task-plan` |
| Verify | `chore(T-NNN): verify` | At the end of `/task-verify` |
| Task state | `chore(T-NNN): start task` · `chore(T-NNN): to review` · `chore(T-NNN): done` | State transitions |
| Backlog | `chore(T-NNN): add task to backlog` | `/task-new` |
| Codebase map | `docs: codebase map` | Inline codebase-map procedure (run by `discuss`/`plan`/`execute` on cold start, by `/task-done` at closure) |

---

## 6. Key operational rules

- **Tight series of steps.** No graph, no parallelization.
- **One step = one commit.** If a step is too big, split it.
- **Mandatory stop in `/task-execute`.** The agent does not chain steps.
- **Advisory DoD.** `/task-verify` is not a gate.
- **No task file is ever deleted.** Replan: obsolete steps go to
  `steps/archive/`.
- **Codebase map mandatory.** The discuss/plan/execute phases require
  it and generate it inline if it's missing.
- **Map updated at closure.** `/task-done` regenerates the map to
  reflect the task's changes.

---

## 7. What's out of scope (intentionally)

- Milestones, roadmaps, versioning (explicitly out of dev scope).
- Sub-agent orchestration / wave execution (not available in pi).
- Automatic execution of multiple steps in sequence without stops.
- DoD as a blocking gate.
