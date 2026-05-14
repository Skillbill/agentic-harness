---
description: Closes a task (PR merged) by moving it to done/ and committing to main
argument-hint: "<task-id>"
---

You are the SCRUM-lite workflow assistant for this project. The dev has seen
the PR merged on `main` and wants to close the task: move it from `review/` (or
directly from `in-progress/` if it didn't go through review) to `done/`,
update the frontmatter, and commit on `main`.

**Task to close:** $@

**Output language**: any natural-language output you produce for the dev (summaries, descriptions, PR bodies, commit-message *prose*) MUST be in **$CONTENT_LANG**. Identifiers, file paths, branch names, commit prefixes (e.g. `feat(T-001/01):`) stay as the convention dictates.

## 🔒 Explicit exception to the Git Safety Rule

This command **is authorized** to run mutating git operations, only:

- `git mv` of the task file from `review/` (or `in-progress/`) to `done/`
- `git add` of the task file
- `git add .pi/codebase/` (if the map was updated)
- `git commit -m "chore(<ID>): mark task as done"`
- `git push`

No branches, no other files, no `--force`. See `AGENTS.md` →
*Git Safety Rule*.

## Steps

1. **Normalize the ID and find the task**:
   - Normalize `$1` to `T-NNN` (e.g. `T001`, `t1`, `1` → `T-001`).
   - If missing → error: "Usage: `/task-done <task-id>`".
   - Look for the file in this priority order:
     1. `.pi/tasks/review/<ID>-*.md` → "normal" path (post-PR).
     2. `.pi/tasks/in-progress/<ID>-*.md` → accepted with warning
        ("task closed without going through review state").
     3. `.pi/tasks/done/<ID>-*.md` → STOP: already closed, nothing to do.
     4. `.pi/tasks/backlog/<ID>-*.md` → error (workflow violation:
        "you can't close a task that was never started").
     5. Not found anywhere → error with list of existing IDs.

2. **Verify preconditions** (blocking):
   - `git branch --show-current` must be `main`. Otherwise → STOP:
     "To close the task you need to be on `main`. Run
     `git switch main && git pull`, then rerun `/task-done <ID>`."
   - `git status --porcelain` must be clean **for the task file**.
     Other modified/untracked files don't block (but the command will
     `git add` ONLY the task file).

3. **Verify the PR is actually merged** (best-effort, non-blocking):
   - Read the `branch:` field from the task frontmatter.
   - If the `gh` CLI is available (`command -v gh`), try:
     `gh pr list --state merged --head <branch> --json number,mergedAt --limit 1`
     and show the result to the dev.
   - If the PR isn't shown as merged (or `gh` is unavailable), **don't block**: ask
     the dev for explicit confirmation: "I can't verify that the PR is
     merged. Do you confirm you've merged it and want to close the task?
     [yes/no]". If `no` → exit without touching anything.

4. **Compute DoD completion rate** (informational):
   - Read the `## Definition of Done` section of the task.
   - Count `- [x]` checkboxes vs total.
   - For final output only; does not block even if not 100%.

5. **Update the codebase map** (if present):
   - If `.pi/codebase/` exists, the map must be updated to reflect
     the changes introduced by the just-closed task.
   - Execute the `/ah:map-codebase` logic inline: read the file
     `$EXT_DIR/prompts/map-codebase.md` and run the instructions of
     steps 2–5 (the 4 mapping passes). When the map already
     exists, use "Regenerate" mode (delete and remap).
   - When done, the updated files in `.pi/codebase/` go into
     the commit of step 8.
   - If `.pi/codebase/` **does not exist** → skip this step (the map
     was never created, nothing to update).

6. **Update the task frontmatter** (via `edit`) while the file is
   still in `review/` (or `in-progress/`):
   - `status: done`
   - `progress: 100` (if the key exists, or add it under `estimate:`)
   - `updated: <YYYY-MM-DD>` (today, via `date +%Y-%m-%d`)

7. **Move the file** with `git mv` from `review/` (or `in-progress/`) to `done/`,
   preserving the filename.

8. **Commit and push on `main`** (task file + updated codebase map):

   ```
   git add <old-path> <new-path>          # covers the rename
   git add .pi/codebase/                  # updated map (if present)
   git commit -m "chore(<ID>): mark task as done"
   git push
   ```

   If the push fails with `non-fast-forward`:
   - Do NOT run `git pull --rebase` automatically.
   - Warn the dev: "`main` has moved on the remote. Run `git pull --rebase`
     by hand, then rerun `/task-done`."

9. **Final output — concise** (4 lines):

   ```
   ✅ <ID> closed — <title>
      DoD: <N_checked>/<N_total> checked
      file: .pi/tasks/done/<ID>-<slug>.md
      commit: <short-sha> on main (pushed)
   ```

   If DoD < 100% add ONE optional warning line:
   ```
      ⚠ Some DoD items are unchecked — review the file if intentional.
   ```

   No tables, no next steps, no repetition of commands.

## Operational notes

- **`/task-done` does not delete the feature branch**: that's the dev's
  responsibility (GitHub typically auto-deletes on merge). If it remains
  locally: `git branch -d feature/<ID>-*`.
- **If the task skipped the review state** (closed directly from
  in-progress), that's fine: it happens for small tasks or hotfixes. The command
  adds a line to the task log noting
  `skipped review (closed directly from in-progress)`.
- **Incomplete DoD**: the command does NOT block. It's up to the dev (and the
  PR reviewer) to decide if unchecked items are acceptable
  (e.g. `N/A for Python`) or if the task should be reopened.
