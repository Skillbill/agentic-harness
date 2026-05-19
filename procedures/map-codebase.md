---
description: Analyzes the codebase and produces 8 structured documents in .pi/codebase/ (7 thematic + INDEX.md)
argument-hint: "[optional: specific area to map, e.g. 'server' or 'configurator']"
---

You are the SCRUM-lite workflow assistant for this project. The dev wants to
**map the codebase** to produce structured reference documents that
later phases (plan, execute, verify) will use as context.

**Output language**: every `.pi/codebase/*.md` file you create or rewrite MUST be written in **$CONTENT_LANG**. Filenames stay as defined by AH (English). Only the natural-language content honors this preference.

Output: a `.pi/codebase/` folder with 8 Markdown documents (7 thematic + a machine-parsable `INDEX.md`).

## Purpose

Analyze the existing codebase and produce a structured map in 7
thematic documents plus an `INDEX.md`, each focused on
a different aspect of the system. These documents are **consumed** by
later commands:

| Phase/task type                        | Documents loaded                            |
|----------------------------------------|---------------------------------------------|
| UI, frontend, components               | CONVENTIONS.md, STRUCTURE.md                |
| API, backend, endpoints                | ARCHITECTURE.md, CONVENTIONS.md             |
| Database, schema, models               | ARCHITECTURE.md, STACK.md                   |
| Testing                                | TESTING.md, CONVENTIONS.md                  |
| Integration, external APIs             | INTEGRATIONS.md, STACK.md                   |
| Refactoring, cleanup                   | TECHNICAL_DEBT.md, ARCHITECTURE.md          |
| Setup, configuration                   | STACK.md, STRUCTURE.md                      |

## ⛔ Rule: no project code

This command **does not generate or modify project source code**.
It touches files only under `.pi/codebase/`.

## 🔒 Git Safety Rule (no exception)

Global rule (AGENTS.md): the agent does not mutate git state. This
command **declares no exceptions**. At the end, propose to the dev the
git commands to run by hand.

## When to use it

**Use map-codebase for:**
- Brownfield projects before initializing tasks (understand existing code)
- Updating the map after significant changes
- Onboarding on an unknown codebase
- Before a major refactoring (understand current state)

**Skip map-codebase for:**
- Projects just bootstrapped with `/ah:project-bootstrap` and not yet
  carrying any source code commits — re-running map-codebase before
  that point generates empty `STRUCTURE.md` / `INTEGRATIONS.md` /
  `TESTING.md` / `TECHNICAL_DEBT.md` and adds no value. The
  intent-based `STACK.md` / `ARCHITECTURE.md` / `CONVENTIONS.md`
  produced by bootstrap remain the source of truth until real code
  arrives.
- Trivial codebases (< 5 files)

## Forbidden files

**NEVER read the contents of these files (even if they exist):**

- `.env`, `.env.*`, `*.env` — environment variables with secrets
- `credentials.*`, `secrets.*`, `*secret*`, `*credential*`
- `*.pem`, `*.key`, `*.p12`, `*.pfx`, `*.jks`
- `id_rsa*`, `id_ed25519*`, `id_dsa*`
- `.npmrc`, `.pypirc`, `.netrc`
- `serviceAccountKey.json`, `*-credentials.json`

If you encounter them, note only their **existence** (e.g. "`.env`
file present — contains environment configuration"). Never quote their
content, not even partially.

## Steps

### 1. Determine what is stale (provenance cache)

This step decides **which thematic docs to rewrite**. Never delete
files — updates always happen via `write` (overwrite),
docs outside the stale set stay intact. The provenance cache lives
in `.pi/codebase/.cache.json` (gitignored) and records, for each doc,
the HEAD commit corresponding to the last regeneration.

#### 1a. Filesystem state

Check:
- Does `.pi/codebase/` exist?
- Does `.pi/codebase/.cache.json` exist?

**Three scenarios:**

1. **Map absent** (`.pi/codebase/` does not exist): full-blank scenario.
   Define `stale_docs = {STACK.md, INTEGRATIONS.md, ARCHITECTURE.md,
   STRUCTURE.md, CONVENTIONS.md, TESTING.md, TECHNICAL_DEBT.md}` (all 7).
   Go to step 2.

   **Sub-case: bootstrap-state map**. If `.pi/codebase/` *does* exist
   and contains docs whose frontmatter declares `source: intent`
   (written by `/ah:project-bootstrap` from project intent rather
   than from source code), do **not** mark those intent-based docs as
   stale. Only `STRUCTURE.md`, `INTEGRATIONS.md`, `TESTING.md`,
   `TECHNICAL_DEBT.md` enter `stale_docs` on this run — the others
   are *augmented*, not replaced. When rewriting `STACK.md`,
   `ARCHITECTURE.md`, or `CONVENTIONS.md` later (after their stems
   appear in `stale_docs` due to real code changes), preserve every
   block wrapped in `<!-- intent:keep --> … <!-- /intent:keep -->`
   HTML comment markers verbatim and add observations from the code
   under a new `## Observed state` section appended at the end of the
   doc. The frontmatter `source:` field flips from `intent` to
   `intent+observed` once observed content has been added.

2. **Map present but cache absent**: the map was created before
   the cache was introduced, or `.cache.json` was deleted.
   Ask the dev:

   > `.pi/codebase/` exists but `.cache.json` is absent. What do you prefer?
   > 1. **Calibrate** — assume current HEAD as baseline, write the cache
   >    WITHOUT touching the docs (risk: docs may be stale but
   >    will be considered fresh until the next change)
   > 2. **Full rewrite** — rewrite all 7 docs and initialize the cache
   > 3. **Skip** — exit without changes

   - "Calibrate": `stale_docs = {}`, skip straight to step 6 after
     writing the cache with HEAD for all 7 docs.
   - "Full rewrite": `stale_docs = {all 7}`, go to step 2.
   - "Skip": exit.

3. **Map + cache both present**: use the helper to compute the
   stale set (step 1b).

#### 1b. Helper invocation

Run this bash block to get the stale set:

```bash
node --experimental-strip-types -e '
import("./codebase-cache.ts").then(({ readCache, diffSinceCachedCommit, decideStaleDocs }) => {
  const fs = require("node:fs");
  const { execSync } = require("node:child_process");
  const cache = readCache(".pi/codebase/.cache.json");
  if (!cache) { console.error("CACHE_INVALID"); process.exit(2); }
  const head = execSync("git rev-parse HEAD", { encoding: "utf-8" }).trim();
  // Use the OLDEST cached commit as baseline so no doc is missed if
  // some docs were updated more recently than others.
  const commits = Object.values(cache.docs).map(d => d.commit);
  const baseline = commits.length ? commits[0] : head;
  // Detect topology change (added/deleted files between baseline and HEAD).
  let topologyChanged = false;
  try {
    const out = execSync(`git diff --diff-filter=AD --name-only ${baseline}..HEAD`, { encoding: "utf-8" });
    topologyChanged = out.trim().length > 0;
  } catch {}
  const changed = diffSinceCachedCommit(baseline, ".");
  const stale = [...decideStaleDocs(changed, undefined, { topologyChanged })];
  console.log(JSON.stringify({ head, baseline, changedCount: changed.length, topologyChanged, stale }, null, 2));
}).catch(e => { console.error("HELPER_ERROR", e?.message ?? e); process.exit(3); });
'
```

**Fallback if the invocation fails** (non-zero exit, `HELPER_ERROR`,
`CACHE_INVALID`, or `node --experimental-strip-types` not
available):
- Show the full error to the dev.
- **Don't automatically proceed** with a full regeneration.
- Ask: "Helper unavailable. Proceed with full rewrite (rewrite
  all 7 docs + reinitialize cache)? Yes/No".
- If "Yes": `stale_docs = {all 7}`, go to step 2.
- If "No": exit.

#### 1c. Present the stale set and wait for confirmation

With the helper output, show the dev:

```
🗺️  Cache check — .pi/codebase/

  Baseline:  <baseline commit>
  HEAD:      <head>
  Changed files (filtered): <changedCount>
  Topology changed: <true/false>

  Stale docs (to rewrite):
    - STACK.md
    - TESTING.md
  Fresh docs (not touched):
    - INTEGRATIONS.md, ARCHITECTURE.md, STRUCTURE.md, CONVENTIONS.md, TECHNICAL_DEBT.md
```

**Three possible outcomes:**

- **`stale` empty** (no-op): show "✅ Cache consistent with HEAD: nothing
  to update". Update the `updatedAt` field of each doc
  in cache anyway (step 4b) and go to step 6 (output verification). Skip
  step 2 (the structure already exists) and step 3 (no passes).

- **`stale` non-empty**: ask the dev

  > Rewrite only stale docs (Yes), skip entirely (No), or force
  > full rewrite of all 7 (Force)?

  - "Yes": `stale_docs = <set returned by helper>`, go to step 2.
  - "No": exit without changes.
  - "Force": `stale_docs = {all 7}`, go to step 2.

From here on, `stale_docs` is authoritative: **never write a doc
outside this set**.

### 2. Create the structure

```bash
mkdir -p .pi/codebase
```

(idempotent: if the folder already exists, `mkdir -p` does nothing —
existing files stay intact).

The 8 expected documents:
- `STACK.md` (technology stack)
- `INTEGRATIONS.md` (external services and APIs)
- `ARCHITECTURE.md` (patterns, layers, data flow)
- `STRUCTURE.md` (directory layout, where to put new code)
- `CONVENTIONS.md` (code style, naming, patterns)
- `TESTING.md` (frameworks, patterns, coverage)
- `TECHNICAL_DEBT.md` (technical debt, known bugs, fragile areas)
- `INDEX.md` (path + 1-line summary per doc, machine-parsed by the extension)

### 3. Sequential mapping — 4 passes (only for stale docs)

Run the 4 passes in sequence, each with focused exploration.
**For each doc to write, check `stale_docs` first: if the doc
is NOT in `stale_docs`, skip its writing entirely and the
associated re-exploration.** A pass may therefore produce no
file (e.g. if `stale_docs` contains neither `CONVENTIONS.md` nor `TESTING.md`,
Pass 3 is skipped entirely).

If `$@` contains a specific area (e.g. "server"), limit exploration
to that subfolder but still produce all documents in
`stale_docs` (non-relevant sections → "Not applicable to this area").

**General guidelines for exploration:**

- Use `bash` with `find`, `rg`, `ls`, `head` to orient yourself.
- Read key files with `read` (max 300 lines per file, use offset/limit).
- **Always include paths** with backticks: `` `server/lib/db/camera.ts` ``.
- **Be prescriptive**: "Use camelCase for functions" is useful.
  "Some functions use camelCase" is not.
- **Write the current state**, never what was or what you'd like.
- Current date: `date +%Y-%m-%d`.

#### Pass 1: Technology stack

Explore:
- `package.json` / `requirements.txt` / `pyproject.toml` in each component
- Configuration files (`tsconfig.json`, `.eslintrc*`, `vite.config.*`, etc.)
- `.nvmrc`, `.python-version`, `Dockerfile`

Write (only if in `stale_docs` set):
- `.pi/codebase/STACK.md` — Languages, runtime, frameworks, dependencies, configuration
- `.pi/codebase/INTEGRATIONS.md` — External APIs, databases, auth providers, webhooks

Use the templates at the bottom of this document.

#### Pass 2: Architecture

Explore:
- Directory structure (`find . -type d -maxdepth 3`)
- Entry points (`*/index.ts`, `*/app.ts`, `*/main.tsx`, etc.)
- Import patterns to understand the layers

Write (only if in `stale_docs` set):
- `.pi/codebase/ARCHITECTURE.md` — Patterns, layers, data flow, abstractions, entry points
- `.pi/codebase/STRUCTURE.md` — Directory layout, key locations, where to add new code

#### Pass 3: Quality

Explore:
- Linting/formatting configuration (`.eslintrc*`, `.prettierrc*`, `eslint.config.*`)
- Test files (`*.test.*`, `*.spec.*`)
- CI configuration if present

Write (only if in `stale_docs` set):
- `.pi/codebase/CONVENTIONS.md` — Code style, naming, patterns, error handling
- `.pi/codebase/TESTING.md` — Frameworks, test structure, mocking, coverage

#### Pass 4: Technical debt

Explore:
- `TODO` / `FIXME` / `HACK` / `XXX` comments
- Large files (potential complexity)
- Stubs / empty returns
- Obsolete dependencies

Write (only if in `stale_docs` set):
- `.pi/codebase/TECHNICAL_DEBT.md` — Technical debt, known bugs, security, performance, fragile areas

### 4. Generate INDEX.md

If `stale_docs` is empty (pure no-op) you can skip this step —
the existing `INDEX.md` is consistent. Otherwise regenerate
`.pi/codebase/INDEX.md` enumerating **all** `.md` files present in
`.pi/codebase/` (both the newly rewritten ones and those left
intact).

**Format of each line:**

```
<relPath>: <one-line summary ≤ 120 chars>
```

where:
- `<relPath>` is the file path relative to `.pi/codebase/` (e.g. `STACK.md`).
- `<one-line summary>` is the first `# ` heading of the document, or,
  if absent, the first non-empty body line; truncated at 120 characters.

Each line **must** match the regex:

```
^[A-Za-z0-9_\-\./]+\.md: .{1,120}$
```

Example (illustrative):

```
STACK.md: Technology Stack
INTEGRATIONS.md: External Integrations
ARCHITECTURE.md: Architecture
STRUCTURE.md: Codebase Structure
CONVENTIONS.md: Code Conventions
TESTING.md: Testing Patterns
TECHNICAL_DEBT.md: Codebase Technical Debt
```

The extension that consumes these documents **prefers an `INDEX.md`
present on disk** over its own in-memory lazy fallback:
regenerating `INDEX.md` after changes to the thematic documents is therefore
**recommended but not mandatory** — if absent, the extension rebuilds
the index on the fly.

### 4b. Update `.pi/codebase/.cache.json`

For each doc **touched in this execution** (i.e. each element of
`stale_docs` that was actually written), update the
corresponding entry in the cache. Untouched docs keep their
previous entries — do not overwrite them.

Run:

```bash
node --experimental-strip-types -e '
import("./codebase-cache.ts").then(({ readCache, writeCache }) => {
  const { execSync } = require("node:child_process");
  const cachePath = ".pi/codebase/.cache.json";
  const head = execSync("git rev-parse HEAD", { encoding: "utf-8" }).trim();
  const now = new Date().toISOString();
  const touched = process.argv.slice(1); // list of touched docs passed via argv
  const state = readCache(cachePath) ?? { docs: {} };
  for (const doc of touched) {
    state.docs[doc] = { commit: head, updatedAt: now };
  }
  writeCache(cachePath, state);
  console.log("cache updated:", JSON.stringify(state.docs, null, 2));
});
' -- STACK.md TESTING.md   # ← replace with the list of docs actually touched
```

**Special case "Calibrate"** (scenario 2 of step 1a): pass all 7
docs as argv, even if you didn't rewrite them — you are initializing the
cache.

**Special case "no-op"** (`stale_docs` empty at step 1c): do not
modify the `commit` fields, but update only `updatedAt` to reflect
the latest check. In practice:

```bash
node --experimental-strip-types -e '
import("./codebase-cache.ts").then(({ readCache, writeCache }) => {
  const cachePath = ".pi/codebase/.cache.json";
  const state = readCache(cachePath);
  if (!state) process.exit(0);
  const now = new Date().toISOString();
  for (const d of Object.keys(state.docs)) state.docs[d].updatedAt = now;
  writeCache(cachePath, state);
});
'
```

### 5. Pre-commit security scan

```bash
grep -rE '(sk-[a-zA-Z0-9]{20,}|ghp_[a-zA-Z0-9]{36}|AKIA[A-Z0-9]{16}|xox[baprs]-|-----BEGIN.*PRIVATE KEY|eyJ[a-zA-Z0-9_-]+\.eyJ)' .pi/codebase/*.md 2>/dev/null && echo "⚠️ SECRETS FOUND" || echo "✅ No secrets detected"
```

If secrets are found → STOP, show the matches, ask the dev for confirmation before
proceeding.

### 6. Verify output

```bash
ls -la .pi/codebase/
wc -l .pi/codebase/*.md
```

Check:
- All 8 documents exist (7 thematic + `INDEX.md`)
- No thematic document is empty (each should have > 20 lines)
- `INDEX.md` has exactly one line per other `.md` and each line
  matches `^[A-Za-z0-9_\-\./]+\.md: .{1,120}$`

**Verify cache:**

```bash
test -f .pi/codebase/.cache.json && node -e '
const s = JSON.parse(require("node:fs").readFileSync(".pi/codebase/.cache.json","utf-8"));
const docs = Object.keys(s.docs);
console.log("cache docs:", docs.join(", "));
const missing = ["STACK.md","INTEGRATIONS.md","ARCHITECTURE.md","STRUCTURE.md","CONVENTIONS.md","TESTING.md","TECHNICAL_DEBT.md"].filter(d => !s.docs[d]);
if (missing.length) { console.error("⚠️ Incomplete cache — missing:", missing.join(", ")); process.exit(1); }
console.log("✅ Cache contains all 7 docs");
' || echo "⚠️ .cache.json not written (expected only in 'Skip' scenario)"
```

A partial cache (e.g. 5/7 docs) is acceptable only after incremental
updates on a pre-existing map; a greenfield or
"Full rewrite" scenario must produce a complete cache (7/7).

### 7. Final output

```
🗺️  Codebase map complete.

Created under .pi/codebase/:
- STACK.md ([N] lines) — Technology stack and dependencies
- ARCHITECTURE.md ([N] lines) — System design and patterns
- STRUCTURE.md ([N] lines) — Directory layout and organization
- CONVENTIONS.md ([N] lines) — Code style and patterns
- TESTING.md ([N] lines) — Test structure and practices
- INTEGRATIONS.md ([N] lines) — External services and APIs
- TECHNICAL_DEBT.md ([N] lines) — Technical debt and known issues
- INDEX.md ([N] lines) — Machine-parsable index (path + summary per doc)

Suggested git commands:
  git add .pi/codebase/
  git commit -m "docs: codebase map"
  git push
```

---

## Document templates

### STACK.md

```markdown
# Technology Stack

**Analysis date:** [YYYY-MM-DD]

## Languages

**Primary:**
- [Language] [Version] — [Where used]

**Secondary:**
- [Language] [Version] — [Where used]

## Runtime

**Environment:**
- [Runtime] [Version]

**Package manager:**
- [Manager] [Version]
- Lockfile: [present/absent]

## Frameworks

**Core:**
- [Framework] [Version] — [Purpose]

**Testing:**
- [Framework] [Version] — [Purpose]

**Build/Dev:**
- [Tool] [Version] — [Purpose]

## Key dependencies

**Critical:**
- [Package] [Version] — [Why it matters]

**Infrastructure:**
- [Package] [Version] — [Purpose]

## Configuration

**Environment:**
- [How it's configured]
- [Required key configs]

**Build:**
- [Build configuration files]

## Platform requirements

**Development:**
- [Requirements]

**Production:**
- [Deploy targets]

---

*Stack analysis: [date]*
```

### INTEGRATIONS.md

```markdown
# External Integrations

**Analysis date:** [YYYY-MM-DD]

## APIs and External Services

**[Category]:**
- [Service] — [What it's used for]
  - SDK/Client: [package]
  - Auth: [env variable name]

## Data Storage

**Database:**
- [Type/Provider]
  - Connection: [env variable]
  - Client: [ORM/client]

**File storage:**
- [Service or "Local filesystem only"]

**Cache:**
- [Service or "None"]

## Authentication and Identity

**Auth provider:**
- [Service or "Custom"]
  - Implementation: [approach]

## Monitoring and Observability

**Error tracking:**
- [Service or "None"]

**Logs:**
- [Approach]

## CI/CD and Deploy

**Hosting:**
- [Platform]

**CI pipeline:**
- [Service or "None"]

## Environment Configuration

**Required env variables:**
- [List of critical variables]

**Secrets location:**
- [Where secrets are stored]

## Webhooks and Callbacks

**Inbound:**
- [Endpoint or "None"]

**Outbound:**
- [Endpoint or "None"]

---

*Integrations audit: [date]*
```

### ARCHITECTURE.md

```markdown
<!-- updated: [YYYY-MM-DD] -->
# Architecture

**Analysis date:** [YYYY-MM-DD]

## System overview

```text
┌─────────────────────────────────────────────────────────────┐
│                      [Upper Layer Name]                      │
├──────────────────┬──────────────────┬───────────────────────┤
│   [Component A]  │   [Component B]  │    [Component C]      │
│  `[path/a]`      │  `[path/b]`      │   `[path/c]`          │
└────────┬─────────┴────────┬─────────┴──────────┬────────────┘
         │                  │                     │
         ▼                  ▼                     ▼
┌─────────────────────────────────────────────────────────────┐
│                    [Middle Layer Name]                       │
│         `[path/layer]`                                       │
└─────────────────────────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────────────────────────┐
│  [Store / Output / External]                                 │
│  `[path/store]`                                              │
└─────────────────────────────────────────────────────────────┘
```

## Component Responsibilities

| Component | Responsibility | Files |
|-----------|----------------|-------|
| [Name] | [What it owns] | `[path]` |

## Pattern Overview

**Global:** [Pattern name]

**Key characteristics:**
- [Characteristic 1]
- [Characteristic 2]

## Layers

**[Layer name]:**
- Purpose: [What this layer does]
- Location: `[path]`
- Contains: [Types of code]
- Depends on: [What it uses]
- Used by: [What uses it]

## Data Flow

### Main request path

1. [Step 1 — entry point] (`[file:line]`)
2. [Step 2 — processing] (`[file:line]`)
3. [Step 3 — output/response] (`[file:line]`)

**State management:**
- [How state is managed]

## Key Abstractions

**[Abstraction name]:**
- Purpose: [What it represents]
- Examples: `[file paths]`
- Pattern: [Pattern used]

## Entry Points

**[Entry point]:**
- Location: `[path]`
- Trigger: [What invokes it]
- Responsibility: [What it does]

## Architectural Constraints

- **Threading:** [Threading model]
- **Global state:** [Singletons or mutable shared state]
- **Circular imports:** [Known circular dependency chains]

## Anti-Patterns

### [Anti-pattern name]

**What happens:** [The incorrect pattern observed]
**Why it's wrong:** [The problem it causes]
**Do this instead:** [The correct pattern with file reference]

## Error Handling

**Strategy:** [Approach]

**Patterns:**
- [Pattern 1]
- [Pattern 2]

## Cross-Cutting Concerns

**Logging:** [Approach]
**Validation:** [Approach]
**Authentication:** [Approach]

---

*Architecture analysis: [date]*
```

### STRUCTURE.md

```markdown
# Codebase Structure

**Analysis date:** [YYYY-MM-DD]

## Directory Layout

```
[project-root]/
├── [dir]/          # [Purpose]
├── [dir]/          # [Purpose]
└── [file]          # [Purpose]
```

## Directory Purposes

**[Directory name]:**
- Purpose: [What it contains]
- Contains: [Types of files]
- Key files: `[important files]`

## Key File Locations

**Entry points:**
- `[path]`: [Purpose]

**Configuration:**
- `[path]`: [Purpose]

**Core logic:**
- `[path]`: [Purpose]

**Tests:**
- `[path]`: [Purpose]

## Naming Conventions

**Files:**
- [Pattern]: [Example]

**Directories:**
- [Pattern]: [Example]

## Where to Add New Code

**New feature:**
- Main code: `[path]`
- Tests: `[path]`

**New component/module:**
- Implementation: `[path]`

**Utilities:**
- Shared helpers: `[path]`

## Special Directories

**[Directory]:**
- Purpose: [What it contains]
- Generated: [Yes/No]
- Committed: [Yes/No]

---

*Structure analysis: [date]*
```

### CONVENTIONS.md

```markdown
# Code Conventions

**Analysis date:** [YYYY-MM-DD]

## Naming Patterns

**Files:**
- [Observed pattern]

**Functions:**
- [Observed pattern]

**Variables:**
- [Observed pattern]

**Types:**
- [Observed pattern]

## Code Style

**Formatting:**
- [Tool used]
- [Key settings]

**Linting:**
- [Tool used]
- [Key rules]

## Import Organization

**Order:**
1. [First group]
2. [Second group]
3. [Third group]

**Path aliases:**
- [Aliases used]

## Error Handling

**Patterns:**
- [How errors are handled]

## Logging

**Framework:** [Tool or "console"]

**Patterns:**
- [When and how to log]

## Comments

**When to comment:**
- [Observed guidelines]

**JSDoc/TSDoc:**
- [Usage patterns]

## Function Design

**Size:** [Guidelines]

**Parameters:** [Patterns]

**Return values:** [Patterns]

## Module Design

**Exports:** [Patterns]

**Barrel files:** [Usage]

---

*Conventions analysis: [date]*
```

### TESTING.md

```markdown
# Testing Patterns

**Analysis date:** [YYYY-MM-DD]

## Test Frameworks

**Runner:**
- [Framework] [Version]
- Config: `[config file]`

**Assertion library:**
- [Library]

**Run commands:**
```bash
[command]              # Run all tests
[command]              # Watch mode
[command]              # Coverage
```

## Test File Organization

**Location:**
- [Pattern: co-located or separate]

**Naming:**
- [Pattern]

**Structure:**
```
[Directory pattern]
```

## Test Structure

**Suite organization:**
```typescript
[Actual pattern from the codebase]
```

**Patterns:**
- [Setup pattern]
- [Teardown pattern]
- [Assertion pattern]

## Mocking

**Framework:** [Tool]

**Patterns:**
```typescript
[Actual mocking pattern from the codebase]
```

**What to mock:**
- [Guidelines]

**What NOT to mock:**
- [Guidelines]

## Fixtures and Factories

**Test data:**
```typescript
[Pattern from the codebase]
```

**Location:**
- [Where fixtures live]

## Coverage

**Requirements:** [Target or "Not enforced"]

**Viewing coverage:**
```bash
[command]
```

## Test Types

**Unit tests:**
- [Scope and approach]

**Integration tests:**
- [Scope and approach]

**E2E tests:**
- [Framework or "Not used"]

## Common Patterns

**Async tests:**
```typescript
[Pattern]
```

**Error tests:**
```typescript
[Pattern]
```

---

*Testing analysis: [date]*
```

### TECHNICAL_DEBT.md

```markdown
# Codebase Technical Debt

**Analysis date:** [YYYY-MM-DD]

## Technical Debt

**[Area/Component]:**
- Issue: [What the shortcut/workaround is]
- Files: `[file paths]`
- Impact: [What breaks or degrades]
- Fix approach: [How to resolve]

## Known Bugs

**[Bug description]:**
- Symptoms: [What happens]
- Files: `[file paths]`
- Trigger: [How to reproduce]
- Workaround: [If present]

## Security Considerations

**[Area]:**
- Risk: [What could go wrong]
- Files: `[file paths]`
- Current mitigation: [What's in place]
- Recommendations: [What should be added]

## Performance Bottlenecks

**[Slow operation]:**
- Issue: [What's slow]
- Files: `[file paths]`
- Cause: [Why it's slow]
- Improvement path: [How to speed it up]

## Fragile Areas

**[Component/Module]:**
- Files: `[file paths]`
- Why fragile: [What makes it easy to break]
- Safe modification: [How to change it safely]
- Test coverage: [Gaps]

## Scalability Limits

**[Resource/System]:**
- Current capacity: [Numbers]
- Limit: [Where it breaks]
- Scaling path: [How to scale up]

## At-Risk Dependencies

**[Package]:**
- Risk: [What's wrong]
- Impact: [What breaks]
- Migration plan: [Alternative]

## Missing Critical Features

**[Functional gap]:**
- Issue: [What's missing]
- Blocks: [What can't be done]

## Test Coverage Gaps

**[Untested area]:**
- What's not tested: [Specific functionality]
- Files: `[file paths]`
- Risk: [What could break silently]
- Priority: [High/Medium/Low]

---

*Technical debt audit: [date]*
```
