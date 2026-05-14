---
description: Summary of current project state for async daily standup
argument-hint: "[--mine]"
---

You are the SCRUM-lite workflow assistant for this project. Generate an async
standup report: who is working on what, what's in review, what's blocked, what was
closed recently.

**Output language**: any natural-language output you produce for the dev (summaries, descriptions, PR bodies, commit-message *prose*) MUST be in **$CONTENT_LANG**. Identifiers, file paths, branch names, commit prefixes (e.g. `feat(T-001/01):`) stay as the convention dictates.

**Filter:** $@ (if `--mine`, show only the current user's tasks)

## 🔒 Git Safety Rule
Read-only: `git log`, `git branch -a`, task frontmatter.

## Steps

1. **Determine scope**:
   - If `--mine`: derive username from `git config --get user.name` or email.
     Filter tasks by matching `assignee`.
   - Otherwise: all tasks.

2. **Scan state**:
   - `in-progress/`: active tasks.
   - `review/`: tasks awaiting merge.
   - `done/`: only consider those closed in the last 7 days
     (`closed` or `updated` field in frontmatter).
   - `backlog/`: don't show them all — only the count and top 3 by lowest ID
     (next to be picked up).

3. **For each active task, compute "health"**:
   - Time elapsed (since `updated`) vs remaining estimate.
   - ⚠ Warning if:
     - In `in-progress/` for > 3 days without file updates.
     - In `review/` for > 2 days without merge.
     - No estimate (`estimate: null`) on active tasks.
     - DoD with 0 items checked after > 1 day of work.

4. **Enrich with git activity** (read-only):
   - For each `in-progress/` task with `branch` populated:
     - `git log --oneline main..<branch>` → number of commits and last message.
     - `git log -1 --format=%cr <branch>` → how long ago the last commit
       was (if the branch exists locally).
   - If `git fetch` is "cheap", don't run it — work only on local refs
     (remind the dev to `git fetch` if they want fresh data from remotes).

   **State refreshed from the feature branch (only for in-progress):**
   For each in-progress task with `branch` populated, read TASK.md
   **from the feature branch** instead of the local copy on main.
   This ensures DoD, progress and log reflect the assignee's most
   recent work.

   - Determine the ref: use `origin/<branch>` (remote tracking) or
     `<branch>` if only present locally.
   - Derive the path of TASK.md in the repo:
     `.pi/tasks/in-progress/<task-dir>/TASK.md`
   - Read the file with:
     ```
     git show <ref>:.pi/tasks/in-progress/<task-dir>/TASK.md
     ```
   - If the command fails (branch doesn't have that path, ref doesn't exist),
     silently fall back to the on-disk local copy.
   - Use the branch-sourced content to compute:
     - DoD checked/total (count of `- [x]` vs `- [ ]` in the
       Definition of Done section).
     - `progress` from the frontmatter.
     - Latest entries of the `## Log`.
   - ⚠ **Do not run `git checkout`/`git switch`**: the local branch must
     never change. `git show <ref>:<path>` is read-only.

5. **Render the report**:

   ```markdown
   # 📊 Project Standup — <date>

   ## 🛠 In Progress (N)

   - **T-003** — Add web camera support  (4h, toto)
     branch: `feature/T-003-...` · 5 commits · last 3h ago
     DoD: ▰▰▰▱▱▱▱▱ 3/8
     ⚠ no commits in 3 days

   ## 👀 In Review (M)

   - **T-001** — Fix alarm broadcast  (2h, marco)
     PR: <URL if present in task> · in review for 1 day

   ## ✅ Closed last 7 days (K)

   - T-000 — Bootstrap team workflow (1h)

   ## 📥 Backlog (total: X, top 3)

   - T-004 — ... (3h)
   - T-005 — ... (unestimated ⚠)
   - T-006 — ... (1.5h)

   ## 🩺 Project health

   - Total in-progress hours: 6h
   - Total in-review hours: 2h
   - Tasks without estimate: 1 ⚠
   - Tasks stalled > 3d: 1 ⚠
   ```

6. **Final suggestions**:
   - If there are warnings, list concrete actions (e.g. "estimate T-005 by
     updating the `estimate` field in T-005's frontmatter").
   - If `--mine`, close with "your turn on T-003 ⚡".

No file or git mutations.
