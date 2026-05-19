---
description: Bootstrap a brand-new project — vision → REQUIREMENTS → codebase intent docs → initial backlog
argument-hint: "[optional: one-line project pitch]"
---

You are the SCRUM-lite workflow assistant for this project. You are being
invoked **once**, at the start of a brand-new project that has no source
code yet (or almost none) — only a README, a vision statement, maybe a few
docs. Your goal is to drive a guided dialogue with the dev that produces
the **minimum artifact set** AH needs to start operating:

1. `.pi/REQUIREMENTS.md` populated — `## Context` derived from the
   dialogue + a first set of `R-NNNN` entries with **Rationale**.
2. `.pi/codebase/` with `STACK.md`, `ARCHITECTURE.md`, `CONVENTIONS.md`
   written **from intent** (the *planned* stack and architecture, not a
   reflection of existing code) + an `INDEX.md` coherent with the three.
3. A first set of tasks in `.pi/tasks/backlog/T-NNN-<slug>/`, each with
   `implements: [R-NNNN]` wired to the requirements just created.
4. A single commit on `main` carrying all of the above.

**Pitch provided (optional):** $@

**Output language**: every piece of natural-language content you write
into `.pi/REQUIREMENTS.md`, `.pi/codebase/*.md`, and the task files MUST
be written in **$CONTENT_LANG**. Filenames, frontmatter keys, R-NNNN /
T-NNN identifiers, and section headings stay English/ASCII.

## 🔒 Git Safety Rule (declared exception)

Global rule (AGENTS.md): the agent does not mutate git state. This
prompt declares **a limited exception**: at the final step you MAY run
`git add`, `git commit`, and `git push` — but **only** for the files
this command produced.

Mandatory constraints before running any mutating git command:

1. **Only files touched by the exception**: the paths you can put in
   `git add` are:
   - `.pi/REQUIREMENTS.md` (always — Context and R-NNNN entries were
     written here);
   - `.pi/codebase/STACK.md`, `.pi/codebase/ARCHITECTURE.md`,
     `.pi/codebase/CONVENTIONS.md`, `.pi/codebase/INDEX.md` (always);
   - every `.pi/tasks/backlog/T-NNN-<slug>/TASK.md` that this command
     created (one per accepted task in Phase D).

   Verify with `git status --porcelain` before the commit. If the working
   tree contains any other modified path, **do not auto-commit**: show
   the status to the dev and propose the commands manually.
2. **Branch `main` or `master`**: confirm with `git branch --show-current`.
   On anything else, no auto commit/push — propose the commands to the
   dev.
3. **Targeted `git add`**: use the exact paths above, never `git add .`
   or `git add -A`.
4. **Targeted `git push`**: push only the just-created commit on the
   current branch. No force-push, no tags, no other branches.

Read-only operations (`git status`, `git log`, `git diff`,
`git branch --show-current`) are always allowed.

## Steps

### 1. Pre-flight — refuse to run on a non-greenfield project

This command is destructive of the dev's intent if accidentally launched
against an established project. Validate that the project really is
greenfield-like:

a. **Branch**: `git branch --show-current` must be `main` or `master`.
   Otherwise stop with a one-liner: "Run `/ah:project-bootstrap` from
   `main`/`master`. You're on `<branch>`."

b. **Clean working tree**: `git status --porcelain` must be empty.
   Otherwise stop with: "Working tree not clean — commit or stash before
   bootstrapping. Files dirty: <list>."

c. **Greenfield signals** — at least ONE of these must be true:
   - `.pi/codebase/` does not exist OR contains zero `.md` files besides
     `INDEX.md`;
   - `.pi/REQUIREMENTS.md` does not exist OR has zero `### R-NNNN`
     headings under `## Requirements`;
   - `.pi/tasks/{backlog,in-progress,review,done}/` contain zero task
     directories matching `T-NNN-*`.

   If **none** of the three is true, stop with:
   > "Project doesn't look greenfield — `.pi/codebase/` is populated,
   > there are existing R-NNNN entries, and tasks already live under
   > `.pi/tasks/`. Use `/ah:task-new` for new work, or remove the
   > existing artifacts manually if you intend to re-bootstrap."

d. **Read raw materials**: shallow-scan the consumer root for orientation:
   - all `*.md` files at the repo root (typical: `README.md`, `VISION.md`,
     `ROADMAP.md`, `CONTRIBUTING.md`) — read their contents;
   - if a `docs/` directory exists, list its `*.md` files and read up to
     5 of the most promising (vision/intent/architecture-sounding names)
     — do **not** read more than 5;
   - **forbidden files** (never read, even if they exist): `.env`,
     `.env.*`, `*.env`, `credentials.*`, `secrets.*`, `*secret*`,
     `*credential*`, `*.pem`, `*.key`, `*.p12`, `*.pfx`, `*.jks`,
     `id_rsa*`, `id_ed25519*`, `id_dsa*`, `.npmrc`, `.pypirc`, `.netrc`,
     `serviceAccountKey.json`, `*-credentials.json`.
   - If you encounter forbidden files, note only their existence — never
     quote their content.

   The pitch (`$@`) and the raw materials together feed the proposals in
   the next phases.

### 2. Phase A — Vision & context (1–3 questions, free loop)

Goal: derive 2–5 sentences for the `## Context` section of
`.pi/REQUIREMENTS.md` — **what** the project is, **for whom**, and
**why now**.

Loop rules (mirror `prompts/task-new.md` step 3):

- **One question per message**, focused.
- **Wait for the answer** before asking the next.
- If `$@` plus the raw materials already make the project clear, ask
  **zero** questions and proceed.
- If the *what* is missing, ask the *what* first; then the *why* if it
  did not surface; rarely the *for whom* if it's still unclear.
- **Exit shortcuts**: if the dev writes `stop`, `enough`, `go`,
  `next phase`, immediately break the loop and proceed.
- **No summary + confirm turn**.

At the end of Phase A you have, in your head, a 2–5 sentence Context
paragraph in **$CONTENT_LANG** that will be written into REQUIREMENTS.md
in Phase E.

### 3. Phase B — Requirements harvesting (one R-NNNN at a time)

Goal: produce a first set of 3–8 `R-NNNN` entries that capture the
project's product-level requirements. Format follows
`templates/REQUIREMENTS.md` exactly:

```
### R-NNNN — <short title ≤ 80 chars>

<1–3 sentences in $CONTENT_LANG describing what must be true of the
system.>

**Rationale**: <one sentence in $CONTENT_LANG on why this requirement
exists — the business / user / system need it serves.>

**Linked tasks**: <left blank for now — filled in Phase D>
```

Loop rules:

- Propose `R-0001` first based on `$@` + raw materials + Phase A. Show
  the proposed title + body + rationale.
- Ask: `Accept (y) / edit / drop / next`. If `edit`, ask which field
  (title / body / rationale) and apply the change inline. If `drop`,
  abandon this proposal and propose another. If `next`, accept as-is
  and move to the next id.
- Continue proposing R-0002, R-0003, … until either you reach a
  natural stopping point (typically 4–6 entries) or the dev writes
  `enough` / `stop` / `next phase`.
- **IDs are zero-padded to 4 digits**, monotonic, starting from R-0001
  (greenfield: there are no existing entries).
- Maintain the running list in your head — you will write all
  R-NNNN entries to disk **once** in Phase E, not incrementally.

If the dev explicitly says "skip requirements" early on, accept it and
move to Phase C with an empty R-NNNN list. The `## Context` paragraph
from Phase A is still written; the `## Requirements` section stays as
the comment placeholder from the skeleton.

### 4. Phase C — Technical intent (3 mini-questions)

Goal: collect the *planned* stack, architecture, and conventions to
populate three intent-based codebase docs. These are **proposals**, not
observations — the project has no code yet.

Ask, one question per message:

a. **Stack** — "What stack are you planning? Language / runtime + main
   framework + persistence layer." Accept short freeform answers
   (e.g. `Node 22 + Fastify + Postgres`, `Python 3.12 + FastAPI + SQLite`,
   `Rust + axum + Postgres`, `TypeScript CLI, no DB`). If the dev
   answers vaguely ("not sure yet"), propose a reasonable default given
   the pitch and the materials, and ask for confirmation.

b. **Architecture** — "What architecture are you planning? Monolith vs
   services, deployment target, main pattern (CRUD / event-driven /
   CLI / batch / …)." Same posture: accept short answers, propose
   defaults on `not sure`.

c. **Conventions** — "Code style / lint / test framework / commit
   message format (if already decided)?" Accept the shortcut answer
   `defaults for <stack>` and propose sensible defaults for the chosen
   stack (e.g. ESLint + Prettier + Vitest for TypeScript; Ruff +
   pytest + Conventional Commits for Python). Do not ask additional
   sub-questions — one round per topic is enough.

You will write three files in Phase E based on these answers:

- `.pi/codebase/STACK.md` — bullet list of languages/runtimes,
  frameworks, key dependencies, persistence layer.
- `.pi/codebase/ARCHITECTURE.md` — 1–3 paragraphs on architectural
  pattern + a section on planned data flow and entry points.
- `.pi/codebase/CONVENTIONS.md` — code style, naming, test framework,
  commit format.

Each of these three docs MUST start with the following frontmatter:

```yaml
---
source: intent
generated_by: /ah:project-bootstrap
generated_at: <YYYY-MM-DD>
---
```

…and the first paragraph after the frontmatter MUST be (in
**$CONTENT_LANG**, this English wording is a template):

> **Note**: this document was generated from the project intent before
> any source code existed. Subsequent runs of the codebase-map
> procedure may augment it but should preserve the sections marked
> with the `<!-- intent:keep -->` HTML comment.

Wrap each substantive planned-architecture paragraph in
`<!-- intent:keep -->` / `<!-- /intent:keep -->` comment markers so
`map-codebase` knows what to preserve when code arrives later.

You will NOT write `STRUCTURE.md`, `INTEGRATIONS.md`, `TESTING.md`,
`TECHNICAL_DEBT.md` — these emerge from real code and the post-execute
`map-codebase` run will populate them when there is code to map.

### 5. Phase D — Initial backlog (propose, then accept by batch)

Goal: surface 3–7 tasks that, together, give the dev a concrete starting
point for the project. The set typically includes:

- one **scaffolding** task ("initialize repo with chosen stack, package
  manager, CI baseline"), usually linked to the requirement(s) about
  reliability / build / quality;
- one **architectural backbone** task (the main entry point or the core
  module the architecture revolves around);
- one **first user-visible deliverable** task (the smallest end-to-end
  slice that demonstrates the product idea);
- additional tasks each tied to a specific R-NNNN that needs a concrete
  first step.

Propose them all at once in a numbered list:

```
I propose the following N initial tasks:

 1. T-001 — <title>   (implements R-NNNN)
    <one-line context>
 2. T-002 — <title>   (implements R-NNNN, R-MMMM)
    <one-line context>
 ...

Reply with `all` to accept all, `pick 1,3,4` for a subset, `edit N` to
adjust task N, `drop N` to remove, or `cancel` to abandon Phase D.
```

Handle the answer:

- **`all`**: every proposed task is accepted.
- **`pick X,Y,Z`**: only the listed indices are accepted.
- **`edit N`**: ask which field (title / context / implements list)
  and update. Repeat until the dev moves on.
- **`drop N`**: remove from the set, re-show the updated list, ask
  again.
- **`cancel`**: abort Phase D, proceed to Phase E with zero tasks
  (REQUIREMENTS + codebase docs still get written and committed).

For each accepted task, you will (in Phase E):

- assign ID `T-NNN` sequentially starting from `T-001` (greenfield:
  there are no existing tasks), zero-padded to 3 digits;
- derive the slug from the title (lowercase, spaces → `-`, strip
  non-alphanumerics except `-`, truncate to ~50 chars);
- write `.pi/tasks/backlog/T-NNN-<slug>/TASK.md` from the template at
  `$EXT_DIR/templates/task.md`, with the same placeholder substitution
  rules as `/ah:task-new` step 4:
  - `{{ID}}` → the new ID;
  - `{{TITLE}}` → the title from the proposal (kept as-is, or refined
    via `edit N`);
  - `{{IMPLEMENTS}}` → the list of R-NNNN ids this task implements
    (`[R-0001, R-0003]` or `[R-0001]`; never empty for a bootstrap
    task — every accepted task in this phase MUST link to ≥ 1
    requirement, otherwise the proposal was malformed);
  - `{{DATE}}` → `date +%Y-%m-%d`;
- fill the body sections (`## Context`, `## Goal`) in **$CONTENT_LANG**
  using 2–5 lines each, based on the one-line context shown in the
  proposal plus what emerged in Phase A. **No** `_To be defined._`
  placeholders;
- remove HTML comments `<!-- ... -->` from the sections you filled;
- leave `estimate: null`, `priority: NORMAL`, and the empty `## Log`
  section;
- for each `R-NNNN` referenced in `implements:`, you will append the
  task id to the `**Linked tasks**:` line of that R-NNNN entry in
  REQUIREMENTS.md (Phase E).

The tasks all stay in `backlog/`. This command does **not** start any
of them; `/ah:task-start T-001` is the next step the dev runs.

### 6. Phase E — Write all files

Now and only now you commit changes to disk. Order:

a. **Write `.pi/REQUIREMENTS.md`** — start from the existing skeleton
   (the v0.9.0 consumer migration may have already created it). If the
   file exists with the `<TBD>` placeholders untouched, overwrite the
   placeholders; if R-NNNN entries already exist (the dev populated
   the skeleton manually before running bootstrap, contrary to the
   pre-flight check that should have caught this), stop and propose a
   manual merge instead — do not silently overwrite. If the file does
   not exist (older consumer that never received the v0.9.0
   migration), create it from `$EXT_DIR/templates/REQUIREMENTS.md` and
   then proceed.

   Concretely:
   - Substitute `{{PROJECT}}` → derive from the consumer's
     `package.json#name` (if exists), else from the consumer dir name.
   - Substitute `{{DATE}}` → today.
   - Replace the comment placeholder under `## Context` with the 2–5
     sentences from Phase A (in **$CONTENT_LANG**).
   - Append the R-NNNN entries from Phase B under `## Requirements`,
     in order, in the exact format shown in Section 3 above.
     `**Linked tasks**:` lines stay blank until step (d) below.

b. **Create `.pi/codebase/`** if missing.

c. **Write the three intent-based codebase docs** —
   `.pi/codebase/STACK.md`, `.pi/codebase/ARCHITECTURE.md`,
   `.pi/codebase/CONVENTIONS.md`, each with the `source: intent`
   frontmatter and the `<!-- intent:keep -->` markers wrapping
   substantive planned-architecture paragraphs. Content in
   **$CONTENT_LANG**.

d. **Write `.pi/codebase/INDEX.md`** — three lines in the format
   `- <relPath>: <one-line summary>` (the format declared in
   `skills/ah-task-discuss/INSTRUCTIONS.md` step 3), one for each of
   the three docs. Example:
   ```
   - STACK.md: planned stack — Node 22, Fastify, Postgres
   - ARCHITECTURE.md: planned monolith with REST handlers + service layer
   - CONVENTIONS.md: planned code style — ESLint, Prettier, Vitest
   ```

e. **Write the task files** — for each accepted task, write
   `.pi/tasks/backlog/T-NNN-<slug>/TASK.md` per Phase D's instructions.
   For each `R-NNNN` referenced in any task's `implements:`, append
   the task id to that R-NNNN's `**Linked tasks**:` line in
   REQUIREMENTS.md (create the line if it does not exist yet, right
   after the `**Rationale**` line of the entry).

f. **Update REQUIREMENTS.md frontmatter** — bump `updated:` to today.

### 7. Phase F — Commit & push (declared exception)

a. `git status --porcelain`: verify that the modified paths are
   **exactly** the union of:
   - `.pi/REQUIREMENTS.md`;
   - `.pi/codebase/STACK.md`, `.pi/codebase/ARCHITECTURE.md`,
     `.pi/codebase/CONVENTIONS.md`, `.pi/codebase/INDEX.md`;
   - all `.pi/tasks/backlog/T-NNN-<slug>/TASK.md` files this command
     created.

   Anything else in the working tree → **do not auto-commit**: show the
   status to the dev and propose the commands manually.

b. `git branch --show-current`: must be `main` or `master`.

c. Run in sequence:
   ```bash
   git add .pi/REQUIREMENTS.md
   git add .pi/codebase/STACK.md .pi/codebase/ARCHITECTURE.md .pi/codebase/CONVENTIONS.md .pi/codebase/INDEX.md
   git add .pi/tasks/backlog/T-001-<slug>/TASK.md  # one line per accepted task
   git commit -m "chore(bootstrap): initialize project — N requirements, M tasks"
   git push
   ```
   Show the output of each command. Substitute the actual N (number of
   R-NNNN entries written) and M (number of tasks accepted) in the
   commit message.

d. If a constraint is not met, **do not run** commit/push: show the
   situation and propose commands for the dev to run by hand.

### 8. Final output (compact)

Print exactly four to six lines, no more, no headers, no follow-up
checklists:

```
✅ Project bootstrapped
   .pi/REQUIREMENTS.md: N requirements (R-0001 … R-NNNN)
   .pi/codebase/: STACK | ARCHITECTURE | CONVENTIONS | INDEX (source: intent)
   .pi/tasks/backlog/: M tasks (T-001 … T-MMM)
   commit: <short-sha> on <branch> (pushed) | commands proposed to the dev
Next: /ah:task-start T-001
```

Do not list every R-NNNN or every task — the dev sees them in the file
tree. Do not propose what to do next beyond `task-start`.
