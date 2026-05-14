---
description: Take ownership of a task, create the feature branch, and push
argument-hint: "<task-id>"
---

You are the SCRUM-lite workflow assistant for this project. The dev wants to take ownership of
a task: update the frontmatter, move the file to `in-progress/`, commit on
`main`, create the feature branch, and push it to the remote.

**Task to start:** $@

**Output language**: any natural-language output you produce for the dev (summaries, descriptions, PR bodies, commit-message *prose*) MUST be in **$CONTENT_LANG**. Identifiers, file paths, branch names, commit prefixes (e.g. `feat(T-001/01):`) stay as the convention dictates.

## 🔒 Explicit exception to the Git Safety Rule

This command **is authorized** to run mutating git operations —
limited to the commands listed below. Outside this scope the global rule
applies (no commit/push/branch/checkout). See also `AGENTS.md` →
*Git Safety Rule*.

## Steps

1. **Normalize the ID and find the task**:
   - Normalize `$1` to `T-NNN` (e.g. `T001`, `t1`, `1` → `T-001`).
   - If missing, error.
   - Look for the file in `.pi/tasks/backlog/<ID>-*.md`.
   - If it's already in `in-progress/` → warn and exit (already started).
   - If it's in `review/` or `done/` → error (workflow violation).
   - If it doesn't exist anywhere → error.

2. **Verify preconditions** (read-only, and **blocking**):
   - `git branch --show-current` must be `main`. Otherwise → STOP: show
     "You're on `<branch>`. First run `git switch main && git pull`, then rerun
     `/task-start`".
   - `git status --porcelain` must be **empty**. Otherwise → STOP: show
     "Working tree not clean. Commit or stash before starting the task".
   - If any of these fail, do NOT proceed.

3. **Check estimate (blocking)**:
   - Read the frontmatter. If `estimate` is `null` or absent, **ask the dev
     for the estimate in hours**: "Task T-NNN has no estimate. Give me the estimate in hours
     (e.g. `4h`) or write `cancel` to stop".
   - Wait for the answer. If `cancel` → exit without touching anything.
   - If you get a value (e.g. `4h`, `2.5h`, `8`), normalize it to `<N>h` and
     use it in the next step.

4. **Determine username** for `assignee`:
   - `git config --get user.email`: take the part before `@`, lowercase
     → e.g. `paolo.infante@skillbill.it` → `paolo.infante`.
   - Fallback: `git config --get user.name` lowercase, spaces → `.`.

5. **Build the branch name**:
   - `feature/<ID>-<slug>` (slug = same suffix as the task filename).

6. **Run the git workflow** (in order, stopping at the first error):

   a. **Update the task frontmatter** (with `edit`) while it's still in
      `backlog/`:
      - `status: in-progress`
      - `estimate: <N>h` (only if it was null and was collected in step 3)
      - `assignee: <username>`
      - `branch: feature/<ID>-<slug>`
      - `updated: <YYYY-MM-DD>` (today, via `date +%Y-%m-%d`)

   b. **Move the file** with `git mv` from `backlog/` to `in-progress/`.

   c. **Commit on `main`**:
      ```
      git add -A
      git commit -m "chore(<ID>): start task — <title>"
      ```

   d. **Push `main`** (task state must be visible to the team):
      ```
      git push
      ```
      If push fails with `non-fast-forward`, STOP: warn the dev that
      `main` has moved on the remote and must be realigned manually (`git pull
      --rebase`) before restarting; restore the file in `backlog/` if
      necessary.

   e. **Create and push the feature branch**:
      ```
      git switch -c feature/<ID>-<slug>
      git push -u origin feature/<ID>-<slug>
      ```

7. **Final output — concise**:

   Print *only* this block, no preconditions table or
   repetition of commands:

   ```
   ▶ T-<ID> started — <title>
     estimate: <N>h · assignee: <username>
     branch: feature/<ID>-<slug> (pushed)
     file:   .pi/tasks/in-progress/<ID>-<slug>.md
   ```

   If something went wrong halfway, show instead a clear summary of the
   state (what was done, what wasn't, how to recover).
