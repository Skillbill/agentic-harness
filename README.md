# agentic-harness (AH)

> A SCRUM-lite task workflow for **[pi](https://www.npmjs.com/package/@earendil-works/pi-coding-agent)** (`@earendil-works/pi-coding-agent`).
> Slash commands, keyboard shortcuts, an inner cycle (`discuss → plan → execute → verify`) and project-level codebase awareness — all loaded as a Pi Package.

[![License: PolyForm-NC 1.0.0](https://img.shields.io/badge/license-PolyForm--NC--1.0.0-blue.svg)](LICENSE)
[![Pi Package](https://img.shields.io/badge/pi--package-extension-orange)](https://www.npmjs.com/package/@earendil-works/pi-coding-agent)

---

## What it is

`agentic-harness` is a Pi Package that bolts a structured task lifecycle onto pi.
It is not a code-generation engine on its own — it gives pi a vocabulary
(`/ah:task-new`, `/ah:project-status`, …), an inner cycle to walk through, and a
sense of where files live in the consumer project (`.pi/tasks/`, `.pi/codebase/`,
`.pi/REQUIREMENTS.md`).

It exists because *unstructured* pair-programming with an agent works for a
while, then drifts. AH keeps the drift in check by codifying:

- A **task lifecycle** — `backlog → in-progress → review → done`, with one
  feature branch per task, one commit per step, one PR per task.
- An **inner cycle** for every task — `discuss` (ambiguity), `plan` (steps),
  `execute` (one commit each), `verify` (DoD check).
- A **codebase map** in `.pi/codebase/` — 7 thematic docs the inner-cycle
  phases consult on demand instead of replaying the entire repo every turn.
- A **requirements layer** in `.pi/REQUIREMENTS.md` — the *why* behind tasks,
  loaded as context by `discuss` / `plan` / `verify`.

---

## Install

AH is distributed via git, installed by pi itself.

```bash
# Global install (default), tracks main
pi install git:github.com/Skillbill/agentic-harness

# Project-local install, committable so the team shares the same AH
pi install -l git:github.com/Skillbill/agentic-harness

# Pin a specific tag (recommended for CI / reproducible setups)
pi install git:github.com/Skillbill/agentic-harness@v0.17.1
```

After install, pi auto-loads AH at session start. You'll see a few advisory
lines in the console (compat check, content language, …) and then the new
`/ah:*` commands appear in the slash palette.

**Requires** pi `^0.75.0`. On older or newer PI lines AH still loads but emits
a warning banner.

---

## Slash commands at a glance

| Command              | Purpose                                                                |
|----------------------|------------------------------------------------------------------------|
| `/ah:task-new`       | Create a task in the backlog (interview → `TASK.md`).                   |
| `/ah:task-start`     | Pick up a backlog task, create `feature/T-NNN-*`, move to `in-progress`. |
| `/ah:task-next-step` | Advance the inner cycle by one phase (`discuss → plan → execute → verify`). |
| `/ah:task-done`      | Close after PR merge — move to `done/`, regenerate codebase map.        |
| `/ah:project-status` | Project progress bar + per-task status (sorted backlog, recent closures).|
| `/ah:pr-open`        | Verify DoD and prepare PR description.                                  |
| `/ah:do-git-stuff`   | Run mutating git commands the dev delegates explicitly.                 |
| `/ah:help`           | Overlay with version, shortcuts, docs, full command list.               |

The full list (auto-discovered, including `/ah:ctx-*` context-inspector helpers)
shows up inside `/ah:help`.

---

## Keyboard shortcuts

| Key      | Action                                                          |
|----------|-----------------------------------------------------------------|
| `alt+p`  | Popup: tasks in `in-progress/` (cycle ↑/↓, ESC closes).         |
| `alt+k`  | Popup: backlog tasks, sorted by priority desc.                  |
| `alt+c`  | Popup: recently closed tasks.                                   |
| `alt+s`  | Branch switcher (default branch + in-progress task branches).   |
| `alt+h`  | Open `/ah:help` overlay.                                        |

Shortcuts are registered through PI's `pi.registerShortcut` API and don't
collide with PI's built-in editor bindings.

---

## How it fits together

A typical task flow:

```
/ah:task-new "fix the modbus scale bug"   # interview, writes .pi/tasks/backlog/T-NNN-*/TASK.md
/ah:task-start T-NNN                       # checkout feature branch, move to in-progress
/ah:task-next-step                         # → discuss (gray areas → DISCUSS.md)
/ah:task-next-step                         # → plan    (steps → PLAN.md + steps/*.md)
/ah:task-next-step                         # → execute (one step → one commit)
…repeat execute until plan is done…
/ah:task-next-step                         # → verify  (DoD check → VERIFY.md)
/ah:pr-open                                # PR description ready
/ah:task-done                              # after merge: move to done/, regen codebase map
```

The four task phases load context surgically. `PLAN.md` declares
`context-needed: [ARCHITECTURE, CONVENTIONS, …]` in its frontmatter, and only
those docs from `.pi/codebase/` are loaded per turn — the agent never replays
the whole map.

---

## Repository layout

```
extensions/index.ts        — Pi Package entry point
prompts/*.md               — auto-registered as /ah:* slash commands
skills/ah-task-*/          — inner-cycle skills (discuss / plan / execute / verify / pr-open)
procedures/*.md            — inline sub-procedures referenced via $EXT_DIR (not slash commands)
lib/*.ts                   — helpers (codebase index, popups, migrations, …)
lib/migrations/v*.ts       — consumer-side migrations (idempotent, run at session_start)
templates/                 — task/PR/requirements skeletons
```

Architectural detail lives in:

- [`CLAUDE.md`](CLAUDE.md) — architecture notes (entry point, context injection, tools, contracts).
- [`WORKFLOW.md`](WORKFLOW.md) — task lifecycle, commit conventions, Git Safety Rule.
- [`task-layout.md`](task-layout.md) — directory layout of a task, frontmatter spec.
- [`REQUIREMENTS.md`](REQUIREMENTS.md) — AH's own product requirements (`R-NNNN`).
- [`CHANGELOG.md`](CHANGELOG.md) — Keep a Changelog 1.1.0 format, every release documented.

---

## Updates and consumer migrations

AH follows [Semantic Versioning](https://semver.org/spec/v2.0.0.html) and ships
through annotated git tags (`vX.Y.Z`) plus a GitHub Release auto-generated by
`.github/workflows/release.yml`.

When a consumer project upgrades AH (`pi update`), the next session start runs
the consumer-migration framework: it compares the marker `.pi/ah-version` with
the installed AH version and applies any pending steps. Migrations are
idempotent and never push.

When the only change after the migration is the marker file itself and the
consumer is on `main` / `master`, AH **auto-commits** the bump locally as
`chore: bump AH consumer marker to vX.Y.Z`. Any other state (feature branch,
real migrations that touched files, other WIP) leaves the change for the dev
to review.

See [R-0003](REQUIREMENTS.md#r-0003) and [R-0013](REQUIREMENTS.md#r-0013) for
the contract.

---

## License

Released under **[PolyForm Noncommercial 1.0.0](LICENSE)**.

- **Free to use, modify, and redistribute** for any non-commercial purpose:
  personal use, research, education, charity, hobby projects, government
  non-commercial use.
- **Commercial use requires a separate license** from Skillbill.

This is a *source-available* license, not OSI-approved "open source" — the OSI
definition requires unrestricted commercial use. For most use cases it works
the same; if you plan to integrate AH into a commercial product, get in touch.

---

## Contributing

Bug reports, feature requests, and pull requests welcome — open an issue on
[github.com/Skillbill/agentic-harness](https://github.com/Skillbill/agentic-harness).

Contributions imply acceptance of the PolyForm Noncommercial license for the
contributed code; if you contribute, your changes are licensed back to
Skillbill (the licensor) under the same terms so that downstream non-commercial
users keep the same rights.

When editing prompts, skills, or top-level docs, keep the text **English-only**.
The natural language of agent-generated content inside the consumer project is
controlled by `.pi/ah-config.json#contentLanguage` (R-0005), not by the prompts
themselves.
