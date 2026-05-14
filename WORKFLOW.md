# Team Workflow (SCRUM-lite)

Streamlined workflow inspired by SCRUM, designed for a team that develops the
project with the **pi** agent. No sprints, no formal backlog grooming: just
tasks, estimates, branches, PRs.

Project **tasks** live under `.pi/tasks/` in the repo and are versioned with
the code. **Templates**, **procedures**, and **prompts** live in the
agentic-harness extension and are loaded by pi at startup.

## Task lifecycle

```
  backlog/ ──► in-progress/ ──► review/ ──► done/
      │              │              │           │
  /task-new     /task-start     /pr-open    /task-done
```

- `backlog/` — task created and (optionally) estimated, not yet picked up
- `in-progress/` — a dev is working on branch `feature/T-NNN-slug`
- `review/` — PR opened on GitHub/GitLab, awaiting review/merge
- `done/` — PR merged, task closed

## Conventions

- **Task ID**: `T-001`, `T-002`, … assigned auto-incrementally by `/task-new`
- **Estimate**: in hours (e.g. `4h`, `1.5h`). Optional but recommended.
- **Branch**: `feature/T-NNN-slug-kebab-case` (e.g. `feature/T-003-web-camera-configurator`)
- **Commits on `main`**: only via PR merge. The task file representing the
  backlog/in-progress state lives on `main`.
- **Feature work**: happens on a branch. The task file is moved from
  `backlog/` to `in-progress/` by `/task-start` and committed on the feature
  branch.

## 🔒 Git Safety Rule (global rule for the agent)

**The agent NEVER runs git operations that mutate repository state.**

Operations **forbidden** to the agent (the dev always runs these by hand):
- `git checkout -b`, `git switch -c`, `git branch`
- `git add`, `git commit`, `git commit --amend`
- `git push`, `git pull`, `git fetch` (unless explicitly requested)
- `git merge`, `git rebase`, `git cherry-pick`, `git reset`
- `gh pr create`, `gh pr merge`, `glab mr create`, etc.
- any command that modifies working tree, index, refs, or remote

Operations **allowed** (read-only, for orientation):
- `git status`, `git log`, `git diff`, `git show`
- `git branch --show-current`, `git branch -a`, `git remote -v`
- `git config --get ...`

**Exception**: the dev may explicitly ask the agent to run a specific git
command (e.g. "you commit it"). Only in that case does the agent run it.

The prompt templates in the agentic-harness extension all follow this rule:
they propose git commands but do not run them.

## Available commands

All AH commands are prefixed with `ah:`.

| Command              | Purpose                                                   |
|----------------------|-----------------------------------------------------------|
| `/ah:task-new`       | Create a new task in the backlog                          |
| `/ah:task-start`     | Pick up a task and prepare the feature branch             |
| `/ah:task-next-step` | Advance the current task to the next inner-cycle phase (discuss → plan → execute → verify) |
| `/ah:task-done`      | Close a task after its PR is merged                       |
| `/ah:project-status` | Project progress bar + status of in-progress tasks        |
| `/ah:pr-open`        | Verify DoD and prepare PR description                     |
| `/ah:standup`        | Project status summary for async daily                    |
| `/ah:map-codebase`   | Analyze the codebase and produce 7 structured docs in `.pi/codebase/` |
| `/ah:do-git-stuff`   | Run mutating git commands delegated by the dev            |

### Codebase map (recommended prerequisite)

`/ah:map-codebase` analyzes the entire codebase and produces 7 structured
documents in `.pi/codebase/`:

| Document | Content |
|---|---|
| `STACK.md` | Languages, runtime, frameworks, dependencies |
| `INTEGRATIONS.md` | External APIs, databases, auth providers |
| `ARCHITECTURE.md` | Patterns, layers, data flow, entry points |
| `STRUCTURE.md` | Directory layout, where to add new code |
| `CONVENTIONS.md` | Code style, naming, patterns |
| `TESTING.md` | Test framework, structure, mocking |
| `TECHNICAL_DEBT.md` | Technical debt, known bugs, fragile areas |

These documents are **consumed** automatically by the `plan` and `execute`
phases of the inner cycle, to give the agent global context on project
architecture, conventions, and patterns.

The map is **recommended but non-blocking**: the phases work without it,
just with less context.

### Inner cycle of the task (skills, invoked by `/ah:task-next-step`)

```
discuss → plan → execute (N times) → verify
```

| Phase   | Skill           | Artifacts produced                       |
|---------|-----------------|------------------------------------------|
| discuss | `ah-task-discuss`  | `DISCUSS.md`                          |
| plan    | `ah-task-plan`     | `PLAN.md` + `steps/*.md`              |
| execute | `ah-task-execute`  | code + updated steps                  |
| verify  | `ah-task-verify`   | `VERIFY.md`                           |

## Support files

**In the agentic-harness extension:**
- `commands/` — prompt templates for `/ah:*` commands
- `skills/` — inner-cycle skills (discuss, plan, execute, verify)
- `templates/task.md` — task skeleton (used by `/ah:task-new`)
- `templates/pr.md` — PR description skeleton (used by `/ah:pr-open`)
- `task-layout.md` — task directory layout contract
- `WORKFLOW.md` — this file

**In the project repo:**
- `.pi/tasks/<state>/T-NNN-slug/TASK.md` — the actual tasks (directory layout)

## Typical flow

```bash
# 1. Product owner / tech lead creates the task in the backlog (on main)
/ah:task-new "Add web camera support to configurator"
# the dev manually edits the file (hour estimate, context, DoD) and commits to main

# 2. Dev picks up the task (on main)
/ah:task-start T-003
# the agent proposes:
#   git switch -c feature/T-003-web-camera-configurator
#   git mv .pi/tasks/backlog/T-003-*.md .pi/tasks/in-progress/
#   git add -A && git commit -m "chore(T-003): start task"
# the dev runs them by hand

# 3. Development work on the branch — inner cycle
/ah:task-next-step   # discuss phase: generates DISCUSS
/ah:task-next-step   # plan phase: generates PLAN + steps/
/ah:task-next-step   # execute phase: runs step 1, atomic commit
/ah:task-next-step   # execute phase: runs step 2, ...
/ah:task-next-step   # verify phase: checks global DoD
/ah:project-status   # project progress bar

# 4. Open PR (on the branch)
/ah:pr-open
# the agent verifies the DoD, generates the PR description
# the dev runs by hand: gh pr create ... (or via web)
# then moves the file to review/ and commits by hand

# 5. Merge (done manually by the dev via web/gh), then on main:
git switch main && git pull
/ah:task-done T-003
# the agent proposes the git mv to done/ and the commit; the dev runs them
# (or the dev launches /ah:do-git-stuff to have the agent run them)
```

## FAQ

**Do I have to add `.pi/git/` to my project `.gitignore`?**
No. PI v0.74.0 clones Pi Packages installed via `pi install git:...` there
and drops a self-managed `.gitignore` (`*\n!.gitignore`) inside `.pi/git/`
which ignores all cloned content. You only track that one file
(`git add .pi/git/.gitignore` once) and `git status` stays clean. Nothing
to add to the root `.gitignore`.

**I see the `Package Updates Available` banner even though there's no new AH release — why?**
On **unpinned** installs (e.g. `pi install git:github.com/Skillbill/agentic-harness` without `@vX.Y.Z`), PI compares the **git commit** of the local clone in `.pi/git/...` against HEAD of the default branch on origin, *not* `package.json#version`. So **every commit on AH's `main`** triggers the banner, even if it's just a doc fix that doesn't bump the semver version. Three paths:

1. **`pi update`** aligns the local clone to HEAD of `main` — banner gone until the next upstream commit.
2. **Pin to a tag** by re-installing with `pi install -l git:github.com/Skillbill/agentic-harness@vX.Y.Z`: on pinned installs PI only shows the banner for new tags, not new commits.
3. **Ignore it**: the banner is informational, nothing is blocked.

Related implication for the consumer migration framework (R-0003): migrations fire on AH's `package.json#version`, so doc-only commits that don't bump the version do **not** trigger any migration even after `pi update`. This is consistent — the semver version is the contract.
