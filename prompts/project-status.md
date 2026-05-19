---
description: Project progress bar and status of in-flight tasks
---

You are the SCRUM-lite workflow assistant for this project. Produce a **concise**
and **visual** report of project status. No explanatory text, no
suggestions, no next steps.

**Output language**: any natural-language output you produce for the dev (summaries, descriptions, PR bodies, commit-message *prose*) MUST be in **$CONTENT_LANG**. Identifiers, file paths, branch names, commit prefixes (e.g. `feat(T-001/01):`) stay as the convention dictates.

## 🔒 Git Safety Rule
Read-only. No changes to files or git.

## Steps

1. **Scan `.pi/tasks/{backlog,in-progress,review,done}/T-*/TASK.md`**.
   For each file extract from the frontmatter: `id`, `title`, `status`, `estimate`,
   `assignee`, `branch`, `updated`.

   **⚠ Authoritative source for active tasks (not `done`, not `backlog`)**:
   the TASK.md on `main` may be stale (status/progress updated only
   on the feature branch and not yet merged). For each task with a
   `branch` field in the frontmatter:
   - Try `git show <branch>:<path-of-TASK.md>` (local).
   - If the local branch doesn't exist, try `origin/<branch>`.
   - If the remote doesn't exist either, use the file on disk (fallback).
   Use the resulting frontmatter (`status`, `progress`, `updated`) as the
   authoritative version. This may move a task from `in-progress` to
   `review` (or vice versa) relative to the directory it sits in on `main`.

2. **Compute project progress**:
   - `total   = backlog + in-progress + review + done`
   - `closed  = done`
   - `active  = in-progress + review`
   - `pct_done = round(closed / total * 100)`  (0 if `total == 0`)

3. **For each task in `in-progress/`**, determine % and phase:

   **Only for the current task** (the one on the current git branch) run
   the full inspection:

   a. **% of DoD**:
      - Read the `## Definition of Done` section of TASK.md.
      - Count the `- [x]` and `- [ ]` checkboxes.
      - `pct = round(checked / total_items * 100)` (0 if no checkboxes).

   b. **Inner-cycle phase** — check the artifacts in the task directory
      (`.pi/tasks/in-progress/T-NNN-<slug>/`):
      - `DISCUSS.md` doesn't exist → `discuss`
      - `PLAN.md` doesn't exist → `plan`
      - `steps/` empty or absent → `plan`
      - At least one step is not `done` → `execute` (show `done/total`)
      - `VERIFY.md` doesn't exist → `verify`
      - Everything complete → `✔ ready`

   **For other in-progress tasks** (not current): trust the frontmatter.
   - `pct` = `progress` field from frontmatter (if `null` or absent → `0`).
   - Phase = do not inspect artifacts; show `[-]` (unverified state).

4. **Render** — use exactly this format, nothing else:

   ```
   📊 Project — <today YYYY-MM-DD>        🎯 T-003 Add web camera support

   Project   [██████░░░░░░░░░░░░░░]  30%   (3/10 done · 2 active · 5 backlog)

   In progress
   ▶ T-003  ███████░░░░░░  58%  Add web camera support            (toto, 4h)  [execute 3/5]
     T-007  ██░░░░░░░░░░░  15%  Refactor cctv module              (marco, 6h) [discuss]

   In review
     T-001  Fix alarm broadcast                                   (marco, 2h)

   Backlog
     T-010  Integrate thermal cameras                             (-, -)
     T-011  DTS module setup                                      (-, 8h)

   Recently closed
     T-002  2026-05-18  Fix alarm broadcast                       (marco, 2h)
     T-001  2026-05-15  Initial scaffolding                       (toto, 4h)
   ```

   Rendering rules:
   - **Current task**: detect the current task from the git branch (`feature/T-NNN-…`).
     If found, show it in the header after the date: `🎯 T-NNN <title>`.
     In the "In progress" block, the current task gets the prefix `▶` instead of ` `.
     If there is no current task (not on a feature/ branch), omit `🎯` from the header.
   - Project progress bar: **20 chars** (`█` filled, `░` empty).
   - Per-task progress bar for in-progress tasks: **13 chars** (`█` / `░`).
   - Title truncated to 40 chars with `…` if it exceeds.
   - Assignee/estimate in parentheses; if missing show `-`.
   - **Inner-cycle phase**: for each in-progress task, show the phase in
     square brackets after `(assignee, estimate)`. Format: `[discuss]`,
     `[plan]`, `[execute N/M]` (steps done/total), `[verify]`, `[✔ ready]`.
   - "In review" section without bar: just ID, title, (assignee, estimate).
   - **"Backlog" section**: list all tasks in `backlog/` without a progress
     bar. Format: just ID, truncated title, (assignee, estimate).
   - **"Recently closed" section**: list the **last 5** tasks in `done/`
     sorted by `updated` frontmatter field **descending** (most recent
     first). If `updated` is missing, fall back to `created`; if both are
     missing, treat as the earliest possible date (sinks to the bottom).
     Format: ID, `updated` date (`YYYY-MM-DD` or `-` if missing),
     truncated title, (assignee, estimate). No progress bar. Omit the
     section entirely if `done/` is empty.
   - **Omit** empty sections (if no in-progress, don't print the
     "In progress" block; same for review, backlog, recently closed).
   - If `total == 0`, print only: `📊 Project — <today>  (no tasks)`.
   - **DO NOT** add any other output: no advice, no "next steps",
     no legend, no explanations. Only the block above.
