---
description: Executes previously proposed mutating git operations (explicit exception to the Git Safety Rule)
argument-hint: "[list of git commands, optional]"
---

You are the SCRUM-lite workflow assistant for this project. The dev uses this
command to **delegate the execution** of mutating git operations that they
would normally have to run by hand (because of the Git Safety Rule).

**Argument (optional):** $@

**Output language**: any natural-language output you produce for the dev (summaries, descriptions, PR bodies, commit-message *prose*) MUST be in **$CONTENT_LANG**. Identifiers, file paths, branch names, commit prefixes (e.g. `feat(T-001/01):`) stay as the convention dictates.

## 🔒 Explicit exception to the Git Safety Rule

This command **is authorized** to run mutating git commands
(`git add`, `git commit`, `git push`, and others listed below) on behalf of
the dev. See also `AGENTS.md` → *Git Safety Rule*.

The exception is **scoped to this turn**: execute the plan, show
the outcome, then return to the standard behavior (no mutating git outside
the prompts that declare it).

## Allowed commands

Explicit whitelist. Anything not on the list → ask the dev for extra
confirmation before executing, or propose it as a manual command.

- `git add <path>` — only with explicit paths (never `git add .` or `-A`,
  unless the dev wrote it that exact way in their request).
- `git commit -m "<msg>"` — message already decided (by the dev or proposed
  by the agent in the previous turn).
- `git push` — plain push on the current branch, no dangerous flags
  (`--force`, `--force-with-lease`, `--mirror`, `--delete`).
- `git checkout -b <branch>` / `git switch -c <branch>` — only if
  explicitly requested.
- `git checkout <branch>` / `git switch <branch>` — only if
  explicitly requested.
- `git merge --ff-only <branch>` — only if explicitly requested.

**Forbidden commands** even inside `/do-git-stuff` (require an explicit,
detailed request from the dev — previous suggestions are not enough):

- `git push --force` / `--force-with-lease`
- `git reset --hard`
- `git rebase` (any form)
- `git branch -D` / `git push --delete`
- Tag modifications or operations on remotes other than `origin`

If the plan includes one of these commands, **stop** and ask
the dev for explicit confirmation, quoting the exact command.

## Steps

1. **Determine the command plan**:
   - If `$@` contains one or more git commands, use them as the plan
     (separated by newlines or `&&`).
   - Otherwise, recover from the conversation context **the git commands
     you (the Assistant) proposed to the dev in the previous turn** that
     they haven't executed yet. If multiple blocks were proposed,
     use the last suggested command block.
   - If you can't determine a plan (no argument, no identifiable previous
     command), ask the dev to reformulate
     (e.g. "which commands do you want me to run?") and stop.

2. **Validate the plan against the whitelist**:
   - Every command must start with `git` (no `rm`, `cp`, pipes to
     shell, etc.).
   - Check that each command is in the whitelist above.
   - Check that there are no forbidden commands.
   - If something is off, show it to the dev and ask how to proceed
     (remove it / replace it / run anyway with explicit confirmation).

3. **Verify git state before executing** (read-only):
   - `git branch --show-current` → show the current branch.
   - `git status --porcelain` → show pending changes.
   - If the plan includes `commit` but nothing is staged after the planned
     add, warn the dev (probable no-op or error).
   - If the plan includes `push` but the current branch has no upstream,
     use `git push -u origin <branch>` (after warning the dev).

4. **Run the commands one by one**, showing for each:
   - The exact command you're about to run.
   - The stdout/stderr output.
   - The exit code.

   If a command **fails** (exit code ≠ 0), **stop execution**,
   show the error and ask the dev how to proceed (retry / abort /
   manual fix). Don't continue the sequence blindly.

5. **Final output**:
   - Summary: which commands succeeded, which were
     skipped/failed.
   - Final state: brief `git status` and, if relevant,
     `git log -1 --oneline` of the just-created commit.
   - If the operation was part of a workflow (e.g. closing a task),
     mention it but don't continue with further steps — the dev will come back
     with the appropriate command.
