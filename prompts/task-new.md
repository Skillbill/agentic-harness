---
description: Creates a new task in the backlog (SCRUM-lite)
argument-hint: "<task topic>"
---

You are the SCRUM-lite workflow assistant for this project. You must create a new task
in the backlog starting from the topic supplied by the user.

**Topic provided:** $@

**Output language**: the TASK.md content you generate (Context, Goal, DoD, etc.) MUST be written in **$CONTENT_LANG**. The frontmatter keys and slug stay English/ASCII.

The sole goal of the interview is to clarify **what the task is about** —
context (why it exists) and goal (what needs to be done). Everything else
(components involved, specific DoD, technical notes, estimate) **is not
asked**: the dev will fill it in later by hand if needed, or we will discuss it
in `/ah:task-discuss` / `/ah:task-plan`.

## 🔒 Git Safety Rule (declared exception)

Global rule (AGENTS.md): the agent does not mutate git state. This
prompt declares **a limited exception**: at the final step you MAY run
`git add`, `git commit` and `git push` — but **only** for the file
of the task just created in the backlog.

Mandatory constraints before running any mutating git command:

1. **Only files touched by the exception**: the paths you can put in
   `git add` are:
   - `.pi/tasks/backlog/<ID>-<slug>/TASK.md` (always);
   - `.pi/REQUIREMENTS.md` **only if** this turn linked the task to a new
     or existing R-NNNN (step 2-bis below). When the dev answered `skip`
     in step 2-bis, REQUIREMENTS.md must NOT appear in the commit.

   Verify with `git status --porcelain` before the commit. If the working
   tree has other unrelated changes (staged or unstaged), **do not
   auto-commit**: show the status to the dev and propose the commands
   manually.
2. **Branch `main`**: confirm with `git branch --show-current`. If you're not
   on `main`, no auto commit/push — propose the commands to the dev.
3. **Targeted `git add`**: use the exact paths of the files, never `git add .` or
   `git add -A`.
4. **Targeted `git push`**: push only the just-created commit on the current
   branch. No force-push, no tags, no other branches.

Read-only operations (`git status`, `git log`, `git diff`,
`git branch --show-current`) are always allowed.

## Steps

### 1. Verify git context (read-only)

- `git branch --show-current`. If you are NOT on `main`, warn the dev (a single
  line, not a block): "You're on `<branch>`, the task should be born on
  `main`. Proceed anyway? (yes/no)". If "no", exit.

### 2. Determine ID and slug

- **ID**: scan `.pi/tasks/{backlog,in-progress,review,done}/` for
  folders matching `T-NNN-*`. Take the highest number + 1.
  Format `T-NNN` (zero-padded to 3 digits).
- **Slug**: from the provided topic → lowercase, spaces → `-`, strip
  non-alphanumeric characters except `-`, truncate to ~50 chars.

Don't show them to the dev yet: the definitive ID will appear in the final output,
so the interview stays clean.

### 2-bis. Link to a project requirement (R-NNNN)

The project may maintain a `.pi/REQUIREMENTS.md` file with enumerated
requirements (`R-NNNN`). This step lets the dev declare which one the
task implements — used as input by `/ah:task-discuss`, `/ah:task-plan`,
and `/ah:task-verify` for context anchoring. Optional: a task with no
declared link is legal.

Procedure:

1. **Read `.pi/REQUIREMENTS.md`** if it exists. If it doesn't, print a
   one-line advisory (`(no .pi/REQUIREMENTS.md found — entries are
   proposed inline; run /ah:task-new on a fresh project to bootstrap.)`)
   and continue to step 3 with `implements:` left as `[]`.
2. Parse the existing `### R-NNNN — <title>` headings under
   `## Requirements`. Build a one-line-per-entry summary list
   (`R-NNNN — title`). Compute the next available R-NNNN id (max + 1,
   zero-padded to 4 digits) — you may need it if the dev chooses `new`.
3. If the list is **empty** (skeleton only, no R-NNNN yet), present a
   compact prompt:

   > `.pi/REQUIREMENTS.md` has no R-NNNN entries yet. Does this task
   > introduce the first one?
   > `new` to create R-0001 inline · `skip` for no link.

4. If the list is **non-empty**, present the list followed by:

   > Does this task implement one of these requirements?
   > Reply with an R-NNNN id (e.g. `R-0002`), `new` to create one
   > inline, or `skip` for no link.

5. Handle the answer:
   - **Valid `R-NNNN` id present in the list**: record
     `implements: [R-NNNN]` for step 4. Append `T-NNN` to that entry's
     `**Linked tasks**` line in REQUIREMENTS.md. If the entry has no
     `**Linked tasks**` line yet, create it right after the `**Rationale**`
     line (or at the end of the entry body if `**Rationale**` is missing).
     Update `updated: <today>` in the frontmatter.
   - **`new`**: run a short inline interview, one question at a time:
     - a) Short title (≤ 80 chars, will become `### R-NNNN — <title>`).
     - b) Body: 1–3 sentences in **$CONTENT_LANG** describing what must
       be true of the system. Skip if the dev answers `skip`.
     - c) Rationale: 1 sentence in **$CONTENT_LANG** on why the
       requirement exists. Skip if the dev answers `skip`.

     Then append a new entry under `## Requirements` (after the last
     existing R-NNNN, or right after the section heading if the list is
     empty), using the next available id, with `**Linked tasks**: T-NNN`
     pre-filled. Update `updated: <today>` in the frontmatter. Record
     `implements: [R-NNNN]` for step 4.
   - **`skip`** or anything unparseable: record `implements: []` for
     step 4. REQUIREMENTS.md is **not** touched.

6. **Output language reminder**: any prose you write into REQUIREMENTS.md
   (titles, bodies, rationale) is in **$CONTENT_LANG**. The `R-NNNN`
   identifiers, frontmatter keys, and section headings (`## Requirements`,
   `## Out of scope`, etc.) stay English/ASCII regardless.

### 3. Interview — free loop, one question at a time

⚠️ **No rigid turns, no section checklist.** You have a single
goal: understand **why** this task exists and **what concretely** needs
to be done, well enough to write a short Context paragraph and a Goal
paragraph in the TASK.md. Typically 1–3 questions in total are enough.

Loop rules:

- **One question per message**, focused. No walls of bundled questions.
- **Wait for the answer** before asking another.
- If the initial argument `$@` is already clear enough (e.g. the dev wrote
  a descriptive title + 2 lines of explanation), **don't ask any
  question**: go directly to step 4.
- If the "why" is missing, ask for it. If the "what" is missing, ask for it. If
  both are missing, ask the "what" first (more concrete), then at most
  the "why" if it doesn't emerge naturally from the answer.
- **Don't ask about** involved components, additional DoD, technical notes,
  estimate, dependencies, risks. They are not `/task-new`'s business.
- **Exit shortcut**: if the dev writes `stop`, `enough`, `create the
  task`, `ok go`, immediately break the loop and proceed to step 4 with
  what you have. Never insist.
- **No summary + confirm turn**. When you have enough
  to write Context + Goal, **go straight to step 4** —
  the final output (step 6) acts as an implicit "after-the-fact confirmation".

### 4. Create the task file

Layout (see `task-layout.md` §1): each task is a **directory**
`.pi/tasks/backlog/<ID>-<slug>/` containing at least `TASK.md`.

- Create the folder `.pi/tasks/backlog/<ID>-<slug>/`.
- File path: `.pi/tasks/backlog/<ID>-<slug>/TASK.md`.
- Start from the template `$EXT_DIR/templates/task.md` (slim version: only
  Context, Goal, standard Definition of Done, Log).
- Replace the frontmatter placeholders:
  - `{{ID}}` → new ID
  - `{{TITLE}}` → title derived from the dev's topic. If the topic is
    already a title-phrase (≤ 80 chars, capitalized or typical title
    style), use it as-is. Otherwise synthesize a 5–10 word title
    summarizing the task.
  - `{{IMPLEMENTS}}` → the list decided in step 2-bis:
    `[R-NNNN]` if linked, `[]` if `skip` was chosen.
  - `{{DATE}}` → `date +%Y-%m-%d`.
- Fill the body sections with what was gathered in the interview:
  - `## Context` → 2–5 lines of prose explaining why the task exists
    (problem, motivation, any links/decisions if they came up).
  - `## Goal` → 2–5 lines describing concretely what needs to be done
    (scope). No bullet points unless the dev explicitly listed
    sub-goals.
- **No** `_To be defined._`, no empty sections, no placeholders.
  If a point really isn't clear even after the interview (e.g. the dev
  wrote "dunno" everywhere), write an honest line like "To be clarified
  in the discuss phase." directly in the prose, without inventing
  content.
- **Remove instructional HTML comments `<!-- ... -->`** from the sections
  you filled in.
- Leave `estimate: null` in the frontmatter (estimate is not asked in
  `/task-new`).
- Leave the `## Log` section empty (it's filled in during work).

Write the file.

### 5. Commit & push the task (using the exception)

a. `git status --porcelain`: verify that the only modified paths are
   `.pi/tasks/backlog/<ID>-<slug>/TASK.md` (and the containing directory),
   **plus** `.pi/REQUIREMENTS.md` if and only if step 2-bis touched it
   (new R-NNNN created, or `**Linked tasks**` line appended).
b. `git branch --show-current`: must be `main`.
c. If the constraints are met, run in sequence:
   ```bash
   git add .pi/tasks/backlog/<ID>-<slug>/TASK.md
   # only if step 2-bis touched REQUIREMENTS.md:
   git add .pi/REQUIREMENTS.md
   git commit -m "chore(<ID>): add task to backlog — <TITLE>"
   git push
   ```
   Show the output of each command. The commit message stays the same
   whether or not REQUIREMENTS.md is included.
d. If a constraint is not met, **do not run** commit/push:
   show the situation and propose commands for the dev to run by hand.

### 6. Final output (concise)

Three lines, no more:

```
✅ <ID> created — <TITLE>
   file: .pi/tasks/backlog/<ID>-<slug>/TASK.md
   commit: <short-sha> on main (pushed) | commands proposed to the dev
```

No next steps, no checklist, no "now run task-start". The dev
knows what to do.
