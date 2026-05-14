---


You are the SCRUM-lite workflow assistant for this project. The dev has closed all
(or almost all) the steps of the plan and wants a **systematic verification
of the global DoD** of the task before opening the PR.

Command output: `VERIFY.md` in the task directory, created at the first
run or updated in subsequent ones. It contains the global DoD (checklist) and
a chronological log of the verify runs.

**Important:** `/ah:task-next-step` is **advisory**. Even if some items
fail, the command does not block the workflow: it shows the report and leaves
the decision to the dev (re-run `/ah:task-next-step`, `/ah:task-next-step`, or
proceed with `/pr-open` knowing what is missing).

Contract: `docs/task-layout.md` §2.5 and §3.4.

> **Output language**: the VERIFY.md content you generate MUST be written in **$CONTENT_LANG**. Identifiers, paths, and frontmatter keys stay English/ASCII.

## 🔒 Git Safety Rule (declared exception)

Global rule (AGENTS.md): the agent does not mutate git state. This
prompt declares **a limited exception**: at the end, after dev confirmation,
you CAN execute `git add`, `git commit` and `git push` of the **single
file `VERIFY.md`** of the current task.

Mandatory constraints before any mutating git command:

1. **Single path touched**: `git status --porcelain` must list only
   `.pi/tasks/in-progress/<ID>-<slug>/VERIFY.md` (new or modified).
   Any *files* produced by the execution of the verify commands
   (build logs, coverage, etc.) must not end up in the working tree:
   if you produce them, write them in `/tmp/` or let the tools themselves manage them.
2. **Task feature branch**: `git branch --show-current` must
   be `feature/<ID>-<slug>`.
3. **Targeted `git add`**: `git add .pi/tasks/in-progress/<ID>-<slug>/VERIFY.md`.
   Never `git add .` or `-A`.
4. **Targeted `git push`**: no force, no other branches, no tags.

If a constraint is not satisfied → manual flow: show state and
commands to the dev.

Read-only always permitted.

## Steps

### 1. Find the task

- **Auto-detect from the branch**: `git branch --show-current` →
  `feature/T-NNN-<slug>`. Directory:
  `.pi/tasks/in-progress/T-NNN-<slug>/`.
- **Explicit override**: `task-id (if provided)` normalized to `T-NNN`.

STOP if:
- we are not on a feature branch and there is no override → suggest
  `/task-start`;
- the directory or `TASK.md` do not exist → corrupted task.

### 2. Materialize or load `VERIFY.md`

Look for `.pi/tasks/in-progress/<ID>-<slug>/VERIFY.md`.

#### 2a. First run (file absent): build the global DoD from scratch

Read:

- `.pi/templates/task.md` → `## Definition of Done` section (standard
  items).
- `TASK.md` → `## Definition of Done` section (task-custom items,
  gathered during `/task-new`) and frontmatter (specifically the
  `implements:` list — see below).
- `<consumerRoot>/.pi/REQUIREMENTS.md` if it exists and `implements:`
  is non-empty — read only the R-NNNN entries declared in `implements:`.

Compose the global DoD block with three subsections: **Standard** (from
the template), **Task-specific** (from `TASK.md`, copied as-is), and
**Requirements** (advisory R-NNNN checklist — see below; omit the
subsection entirely if `implements:` is empty or REQUIREMENTS.md is
absent).

Write the first draft of `VERIFY.md` according to `docs/task-layout.md` §2.5:

```markdown
# Verify — T-NNN

## Definition of Done (global)

### Standard
- [ ] `npm run lint` passes in the touched components
- [ ] `npm run typecheck` passes (if applicable)
- [ ] `npm run build` passes in the touched components
- [ ] Tests updated/added if applicable
- [ ] If DB schema: Liquibase migration created and tested
- [ ] Documentation updated (AGENTS.md, docs/, component READMEs)
- [ ] Backward compatibility verified
- [ ] PR opened and approved

### Task-specific
- [ ] <custom item 1 copied from TASK.md>
- [ ] ...

### Requirements

<!-- One advisory line per R-NNNN declared in TASK.md `implements:`.
Omit this whole subsection if `implements:` is empty or
.pi/REQUIREMENTS.md is absent. The dev marks each line manually; it is
NOT a gate (DoD is advisory). -->

- [ ] R-NNNN — <title>: still satisfied after this task?
- [ ] R-NNNN — <title>: still satisfied after this task?

## Context audit

<!-- populated by step 6.5 -->

## Verify Log

(populated by runs of /ah:task-next-step)
```

All checkboxes start `[ ]`.

#### 2b. Subsequent run (file present): reset state for the new run

Open `VERIFY.md`. Bring **all** the global DoD checkboxes back to `[ ]`
— including the **Requirements** subsection lines, if present. The
checked section always reflects the latest run, not history (decision
V-4).

If `TASK.md`'s `implements:` list has grown since the last run (e.g.
discuss added a new R-NNNN link), append the new advisory lines to the
**Requirements** subsection. If it has shrunk, leave the now-orphan
lines in place but flag them in the run log — manual removal is the
dev's call (consistent with the "tolerant, never destructive" stance).

The logs of previous runs in `## Verify Log` **remain**. This run
will add a new entry at the end.

### 2.5 Context audit (section)

The `## Context audit` section of `VERIFY.md` mirrors the most recent
`tasks/<T-NNN>/context-audit.json` produced by the Context Inspector and
is exposed by the command `ah:ctx-audit <T-NNN>`. Like the DoD global
checkboxes, it is **reset on each run** (decision V-4 parity): no history
is accumulated — the block always reflects the most recent execution
of `/ah:task-next-step`. It contains declared / loaded / delta_token /
synthetic label (`on-budget` / `over-load` / `under-load` /
`under-declared` / `no-audit`) and, when present, an `errors:` sub-block
with the recorded anomalies (e.g. PLAN.md not parsable, malformed
`context-needed` entry). If the Inspector has not yet recorded any
`tool_call` for this task, the section explicitly shows
"Context audit not available — Inspector did not record load_codebase_doc
calls for this task" instead of breaking the flow.

### 3. Determine the components impacted by the branch (decision V-3)

**Do not** read the "Involved components" checkbox of `TASK.md`: that
is human intention. We deduce the components **actually touched** from
the commits of this branch with respect to `main`.

a. Compute the list of modified paths:
   ```bash
   git diff --name-only main...HEAD
   ```
   If `main...HEAD` has no useful results (newly born branch), use
   as fallback `git diff --name-only main -- .`.

b. Map each path to its component using the first path segment:

   | Path prefix | Component | Working dir |
   |---|---|---|
   | `server/` | server | `server` |
   | `hmi/` | hmi | `hmi` |
   | `configurator/` | configurator | `configurator` |
   | `nvd/` | nvd | `nvd` |
   | `mock-backend/` | mock-backend | `mock-backend` |
   | `postgresql-liquibase/` | postgresql-liquibase | `postgresql-liquibase` |
   | `e2e-server-tests/` | e2e-server-tests | `e2e-server-tests` |
   | `config/` | config (not runnable) | — |
   | `docs/`, `.pi/`, `AGENTS.md`, `README.md`, etc. | — (meta/doc) | — |

   The mapping is aligned with the `docs/architecture.png` diagram. If a
   prefix is not in the table, record a warning and ignore
   (it could be a new component — flag it in the Verify Log
   so the dev adds it to the diagram and to this prompt).

c. Determine the active components: the set of mapped components with
   at least one modified path. This is the set on which
   `lint`/`typecheck`/`build` run.

### 4. Run the executable standard items

For each active component at step 3, and for each of the three checks
(`lint`, `typecheck`, `build`), check whether the script exists in
`<component>/package.json` (`scripts` field). If **it does not exist**, skip
with warning (no unchecked checkbox for technical absence: it is not a
failure, it is non-applicability). If it exists, run:

```bash
cd <component> && npm run <script>
```

Capture exit code and a synthetic version of stdout/stderr (last
50 lines if too long). Do not produce files in the repo (write
temporary logs in `/tmp/` if needed).

**Mapping check → DoD item**: the three standard items "lint", "typecheck",
"build" are checked if **all active components that have that
script** pass. Even a single failure → leave the item unchecked.

For the **Tests** item: the agent does not automatically run all the test
suites (too slow, too environment-dependent for some components).
Treat it as a manual check (see step 5).

For the **Liquibase migration** item: if among the modified paths there is
something under `postgresql-liquibase/`, the item is relevant. The agent
does not attempt to apply the migration (requires DB running); it
marks it as **to be verified manually** (step 5) with an
explicit hint. If instead `postgresql-liquibase/` is not among the touched paths,
the item is non-applicable → leave it unchecked with a note "N/A — the
task does not touch the DB schema".

### 5. Collect the manual checks in a single turn

The non auto-executable checks are:

- **Tests updated/added** (if applicable).
- **Liquibase migration** (if the task touches `postgresql-liquibase/`).
- **Documentation updated** (AGENTS.md / docs / README).
- **Backward compatibility**.
- **PR opened and approved**.
- All items of the **Task-specific** section of `VERIFY.md`.
- All items of the **Requirements** section of `VERIFY.md` (if
  present): each R-NNNN line is an advisory question to the dev —
  "after this task lands, is this requirement still satisfied?". The
  dev answers per id.

Show the dev a **single prompt** with the complete list of what is
still unresolved:

> Manual verify checks:
>
> 1. <item 1>
> 2. <item 2>
> ...
>
> Outcome? (`all ok` / list the numbers that are not ok, e.g. `2,5,7`)

Check the items confirmed `ok`, leave the others unchecked.

### 6. Write the run log

In `## Verify Log` of `VERIFY.md`, append a new entry **at the end**:

```markdown
### YYYY-MM-DD HH:MM — /ah:task-next-step

**Active components (from `git diff main...HEAD`):** server, hmi, …

**Executable standard items:**
- `npm run lint` (server): ✅
- `npm run lint` (hmi): ❌ (exit 1)
  ```
  <synthetic stderr, max ~20 lines>
  ```
- `npm run typecheck` (server): ✅ (skipped in hmi: no script)
- `npm run build` (server): ✅
- ...

**Manual items:**
- Tests updated/added: ✅
- Backward compatibility: ❌ (dev note: "check on X is needed")
- ...

**Summary:** N/M items checked. <1 line of discursive comment
on the overall outcome>.
```

The date comes from `date +"%Y-%m-%d %H:%M"`.

### 6.5 Materialize the `## Context audit` section

Invoke `ah:ctx-audit <T-NNN>` to obtain the rendered markdown of
the most recent `context-audit.json` of the task. If the command is not
available in this pi context, read the JSON directly from
`.pi/context-inspector/<most-recent-session>/tasks/<T-NNN>/context-audit.json`
and apply the pure renderer `renderContextAuditMarkdown` of
`context-audit.ts`.

- **First run** (section just created by §2a): insert the rendered
  block **below** the `## Context audit` heading, replacing the
  placeholder `<!-- populated by step 6.5 -->`.
- **Subsequent run**: **REPLACE** the body of the `## Context audit`
  section with the new rendered block. Do not append history
  — same semantics as the DoD checkbox reset (decision
  V-4 parity). The `## Verify Log` remains chronological; `## Context audit`
  does not.

If the Inspector has not recorded any `tool_call` for the task, the
renderer emits the explicit line "Context audit not available —
Inspector did not record load_codebase_doc calls for this task":
insert it anyway, do not skip the section.

The only path that remains touched is
`.pi/tasks/in-progress/<ID>-<slug>/VERIFY.md` — no new files in the
working tree, in line with the §Git Safety Rule.

### 7. Show the report to the dev and ask for confirmation

Before committing `VERIFY.md`, show the summary:

```
🔍 Verify — T-NNN
   active components: server, hmi
   total items:       11
   ✅ checked:         7
   ❌ unchecked:       3  (list of titles)
   ⏭  non-applicable: 1

Status advisory: /ah:task-next-step does not block. You decide how to proceed.
```

Then ask:

> **Shall I write and commit `VERIFY.md`?** (yes / cancel)

If `cancel` → exit, no changes to the file.

### 8. Commit & push (using the declared exception)

a. `git status --porcelain` — single path: `VERIFY.md` of the current task.
b. `git branch --show-current` — must be `feature/<ID>-<slug>`.
c. If ok:
   ```bash
   git add .pi/tasks/in-progress/<ID>-<slug>/VERIFY.md
   git commit -m "chore(<ID>): verify"
   git push
   ```
d. If not ok → propose the commands to the dev.

### 9. Final output

Concise:

```
🔍 Verify completed — T-NNN
   file:    .pi/tasks/in-progress/<ID>-<slug>/VERIFY.md
   summary: <N>/<M> items ok, <K> missing
```

Followed by contextual suggestion:

- If all ok → "Next step: `/pr-open`".
- If there are `failed` items recoverable with code → "You can correct with
  a new step: `/ah:task-next-step` in replan mode to add a
  fix step, then `/ah:task-next-step`".
- If only non-code manual checks are missing (e.g. PR approved) → "Wait
  for approval, then re-run `/ah:task-next-step` to update the state".

Never block. Advisory: the dev decides.

💡 **Tip: use `/new` to clear the context before the next
command.** Each phase reloads from disk only the files it needs —
fresh and bounded context.
