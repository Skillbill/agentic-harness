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
   For each file extract from the frontmatter: `id`, `title`, `status`, `priority`,
   `estimate`, `assignee`, `branch`, `updated`.

   **Priority normalization**: if `priority` is missing, blank, or not in
   `{LOW, NORMAL, HIGH, IMMEDIATE}` (compare case-insensitively, then
   uppercase the result), treat it as `NORMAL`.

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

3. **For every task in `in-progress/`**, determine percentage and phase
   using the same logic — *no* distinction between the current task and
   the others. The numbers reflect the inner-cycle artifacts, not the
   stale `progress:` frontmatter field.

   **Where the artifacts live**: if the feature branch (from TASK.md's
   `branch:` field) is checked out locally, the artifacts are on disk at
   `.pi/tasks/in-progress/<ID>-<slug>/`. Otherwise, read them from the
   branch tree:
   - `git ls-tree -r <branch> -- .pi/tasks/in-progress/<ID>-<slug>/` to
     enumerate the artifacts present on the branch.
   - `git show <branch>:<path>` to read individual files (e.g. each
     step's frontmatter `status:`).
   - Fall back to `origin/<branch>` if the local branch is missing, then
     to the on-disk file as a last resort.

   a. **Step inventory**: enumerate `steps/NN-*.md` (exclude `steps/archive/`).
      For each step file, read the frontmatter `status:` field.

   b. **`pct` (progress percentage)**:
      - If `PLAN.md` is absent **or** there are zero non-archived step
        files: `pct = 0` (the task hasn't entered the execute phase).
      - Otherwise: `pct = round(steps_done / steps_total * 100)`, where
        `steps_done` is the count of step files whose frontmatter says
        `status: done`.

   c. **Inner-cycle phase**:
      - `DISCUSS.md` doesn't exist → `discuss`
      - `PLAN.md` doesn't exist → `plan`
      - `steps/` empty or absent → `plan`
      - **`PLAN.md` exists but every step file is `status: todo` (zero
        done) and no execute commit exists yet** → `plan` (the plan has
        been written but execute hasn't started). Distinguishable from
        the previous bullet by the presence of `PLAN.md`.
      - At least one step `done` and at least one step not `done` →
        `execute N/M` (where `N`/`M` are done/total).
      - All steps `done` and `VERIFY.md` doesn't exist → `verify`
      - All steps `done` and `VERIFY.md` exists → `✔ ready`
      - **Special case — `task-start` but no inner-cycle artifacts**:
        the task dir contains only `TASK.md` (no `DISCUSS.md`, no
        `PLAN.md`, no `steps/`) → `no plan`. Means the dev started the
        task but bypassed discuss/plan/execute. Surface it explicitly so
        the dev can decide to enter the cycle or leave the task
        free-form.

   d. **Fallback when even artifacts can't be loaded** (e.g. branch
      missing locally AND on origin AND only `TASK.md` exists on disk):
      use the `progress` field from frontmatter. If that is also null or
      missing, `pct = 0` and phase = `[?]`.

4. **Render** — use exactly this format, nothing else:

   ```
   📊 Project — <today YYYY-MM-DD>        🎯 T-003 Add web camera support

   Project   [██████░░░░░░░░░░░░░░]  30%   (3/10 done · 2 active · 5 backlog)

   In progress
   ▶ [!!] T-003  ███░░░░░░░░░░  25%  Add web camera support       (toto, 4h)  [execute 1/4]
     [^ ] T-007  ░░░░░░░░░░░░░   0%  Refactor cctv module         (marco, 6h) [discuss]
     [ ·] T-009  ░░░░░░░░░░░░░   0%  Minor cleanup in modbus      (-, 2h)     [plan]
     [ ·] T-022  ░░░░░░░░░░░░░   0%  Free-form work, no inner cycle (-, -)    [no plan]

   In review
     T-001  Fix alarm broadcast                                   (marco, 2h)

   Backlog
     [!!] T-010  Integrate thermal cameras                        (-, -)
     [^ ] T-011  DTS module setup                                 (-, 8h)
     [ ·] T-012  Minor cleanup                                    (-, -)
     [v ] T-013  Nice-to-have polish                              (-, -)

   Recently closed
     T-002  2026-05-18  Fix alarm broadcast                       (marco, 2h)
     T-001  2026-05-15  Initial scaffolding                       (toto, 4h)
   ```

   Rendering rules:
   - **Priority badge** — shown only in the **In progress** and **Backlog**
     sections (not in "In review" or "Recently closed"). Format: a fixed
     4-character `[XY]` token inserted between the current-task marker
     and the task ID, where `XY` is one of:
     - `!!` = IMMEDIATE
     - `^ ` = HIGH
     - ` ·` = NORMAL
     - `v ` = LOW

     Every level renders a visible glyph (NORMAL is `·`, not blank) so
     the column is readable even when most tasks are at the default.
   - **Current task**: detect the current task from the git branch (`feature/T-NNN-…`).
     If found, show it in the header after the date: `🎯 T-NNN <title>`.
     In the "In progress" block, the current task gets the prefix `▶` —
     otherwise the prefix is a single space. The priority badge (4 chars)
     follows the prefix. So an in-progress row reads
     `<prefix> [XY] T-NNN  …`. If there is no current task (not on a
     feature/ branch), omit `🎯` from the header.
   - **In review** and **Recently closed**: no priority badge, no prefix
     column. Just `  T-NNN  …` (two leading spaces for alignment with
     the body of the report, identical to the pre-v0.10.0 layout).
   - Project progress bar: **20 chars** (`█` filled, `░` empty).
   - Per-task progress bar for in-progress tasks: **13 chars** (`█` / `░`).
   - Title truncated to 40 chars with `…` if it exceeds.
   - Assignee/estimate in parentheses; if missing show `-`.
   - **Inner-cycle phase**: for each in-progress task, show the phase in
     square brackets after `(assignee, estimate)`. Format: `[discuss]`,
     `[plan]`, `[execute N/M]` (steps done/total), `[verify]`, `[✔ ready]`.
   - "In review" section without bar: just ID, title, (assignee, estimate).
   - **"Backlog" section**: list all tasks in `backlog/` without a progress
     bar. Format: just ID, truncated title, (assignee, estimate). **Sort
     order**: by `priority` **descending** (`IMMEDIATE → HIGH → NORMAL →
     LOW`), tie-break by `id` ascending.
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
