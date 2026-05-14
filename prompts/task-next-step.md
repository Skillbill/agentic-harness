---
description: Advances the current task to the next phase of the inner cycle (discuss → plan → execute → verify)
---

You are the SCRUM-lite workflow assistant for this project. This command is the
**single facade** for a task's inner cycle. It determines where the task is
and invokes the appropriate skill.

**Output language**: any natural-language output you produce for the dev (summaries, descriptions, PR bodies, commit-message *prose*) MUST be in **$CONTENT_LANG**. Identifiers, file paths, branch names, commit prefixes (e.g. `feat(T-001/01):`) stay as the convention dictates.

## 🔒 Git Safety Rule
This command does not run git directly. Git exceptions are
declared by the individual skills that will be invoked.

## Inner cycle

```
discuss → plan → execute (N times) → verify → pr-open
```

Each phase produces artifacts in the task directory
(`.pi/tasks/in-progress/T-NNN-<slug>/`):

| Phase | Artifact | Completion condition |
|-------|----------|----------------------|
| discuss | `DISCUSS.md` | exists |
| plan | `PLAN.md` + `steps/*.md` | `PLAN.md` exists and `steps/` is not empty |
| execute | code + steps `done` | all steps in `steps/` are `done` |
| verify | `VERIFY.md` | `VERIFY.md` exists |
| pr-open | PR on GitHub | PR created, `status: review` |

## Steps

### 1. Identify the current task

Use the context injected by AH (`## 🎯 Current Task Context`).
If absent → STOP: "You're not on a feature branch. Use `/ah:task-start`
to take a task."

Extract: `ID`, `slug`, `branch`, `taskDir` (the task directory under
`.pi/tasks/in-progress/`).

Verify that `TASK.md` exists in the directory → otherwise STOP (task
corrupted).

### 2. Determine the current phase

Check artifacts in the task directory, **in order**:

```
1. DISCUSS.md doesn't exist?          → phase = discuss
2. PLAN.md doesn't exist?             → phase = plan
3. steps/ empty or absent?            → phase = plan
4. At least one step is not `done`?   → phase = execute
5. VERIFY.md doesn't exist?           → phase = verify
6. Everything present and complete    → phase = done (task ready for PR)
```

For check 4, scan `steps/*.md` (exclude `steps/archive/`):
read the `status:` frontmatter of each. If at least one is `todo`,
`doing`, `blocked` or `failed` → phase = execute.

### 3. Show state and phase

Before invoking the skill, show the dev a compact summary:

```
🔄 Task T-NNN — <title>
   current phase: <discuss|plan|execute|verify|done>
   artifacts:     DISCUSS ✅  PLAN ❌  steps 0/0  VERIFY ❌
```

Use ✅ if the file exists, ❌ if it doesn't. For steps show `done/total`
(e.g. `3/5`).

If phase = **done**:
> All phases are complete. Creating the PR.

### 4. Invoke the appropriate skill

Load the skill matching the phase determined in step 2 by using
`read` on the SKILL.md file:

| Phase | Skill file (relative to AH) |
|-------|----------------------------|
| discuss | `skills/ah-task-discuss/INSTRUCTIONS.md` |
| plan | `skills/ah-task-plan/INSTRUCTIONS.md` |
| execute | `skills/ah-task-execute/INSTRUCTIONS.md` |
| verify | `skills/ah-task-verify/INSTRUCTIONS.md` |
| done (pr-open) | `skills/ah-task-pr-open/INSTRUCTIONS.md` |

The absolute path of the AH directory is: `$EXT_DIR`.

Read the full INSTRUCTIONS.md file with `read`, then **execute the
contained instructions** as if they were your operational prompt for this turn.

### 5. Update project-status (mental)

At the end of skill execution, the skill's own final summary
is sufficient. Don't add any other output.
