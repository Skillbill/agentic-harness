# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this repo is

`agentic-harness` (AH) is a TypeScript **Pi Package** for `pi` (`@earendil-works/pi-coding-agent`). It loads at pi startup and bolts a SCRUM-lite task workflow onto pi by registering commands, tools, and context-injection hooks.

AH is distributed as a Pi Package via git: users install it with

```
pi install git:github.com/Skillbill/agentic-harness          # tracks main
pi install git:github.com/Skillbill/agentic-harness@v0.1.0   # pinned
```

`package.json` declares the `pi` manifest (extensions / skills / prompts paths) plus peer dependencies on `@earendil-works/pi-coding-agent` and `typebox`. AH ships as source: pi loads `.ts` files directly via `jiti`, no build step required. The only runtime `node_modules/` entry typically resolved is `typebox` (used by `load-codebase-doc.ts`); peer deps come from PI itself.

## Architecture (the parts that span files)

`extensions/index.ts` is the single entry point (per the convention path declared in `package.json#pi.extensions`). Its `default export` receives `pi: ExtensionAPI` and wires three categories of behavior:

1. **Commands** — every `.md` file under `prompts/` becomes a slash command `/ah:<basename>`. `lib/register-prompt.ts` parses the file's YAML frontmatter (`description`, `argument-hint`), substitutes `$@`, `$1`, and `$EXT_DIR` in the body, then calls `pi.sendUserMessage` so the prompt body runs as if the user typed it. The body **is** the spec for the command — there is no separate handler logic. `$EXT_DIR` resolves to the **repo root** (`dirname(__dirname)` of `extensions/index.ts`), not to `extensions/` itself — prompts use it to locate sibling dirs like `prompts/`, `skills/`, `templates/`.

2. **Tools** — `lib/load-codebase-doc.ts` registers `load_codebase_doc({ name })`, a path-safe reader scoped to `.pi/codebase/*.md`. The `^[a-zA-Z0-9_-]+$` name regex and the `resolve()` + prefix check together prevent traversal; this contract is mirrored (duplicated, deliberately — see comment in `lib/context-inspector.ts`) in the inspector module. **Do not** loosen it.

3. **Context injection** — two `before_agent_start` handlers run per LLM turn. The first injects `.pi/codebase/INDEX.md` (or builds an equivalent index via `lib/codebase-index.ts` if INDEX.md is missing) **once per session**, cached in closure. The second re-detects the current task on every turn (so branch switches are picked up mid-session) and injects a `current-task-context` block with the `TASK.md` frontmatter. Both messages use `display: false` — they're invisible to the user but consume tokens; see the dated note in `extensions/index.ts` for the rationale on what was *removed* from this injection.

> **Note on update notification**: AH does **not** implement a custom OTA check. PI v0.74.0 natively displays a `Package Updates Available` banner at startup when a package in settings has a newer git ref / npm version upstream; the user runs `pi update` (or the package-specific form) on demand. See R-0002 in `REQUIREMENTS.md` for the decision rationale (v0.5.0 dropped a custom OTA module after observing the native banner already covered the use case).

`lib/check-pi-compat.ts` runs at `session_start` (before `migrateConsumer`) and compares the `VERSION` constant exported by PI against `peerDependencies["@earendil-works/pi-coding-agent"]` in AH's `package.json`. On a real mismatch it emits a **triple warning** — `console.warn`, `ctx.ui.notify('warning')`, and a persistent `pi.sendMessage({ display: true })` — then returns. Never throws, never blocks: AH keeps loading commands/tools/hooks regardless. The matcher (`satisfies()`) handles `X.Y.Z`, `^X.Y.Z`, `~X.Y.Z`, `>=X.Y.Z`; anything more exotic returns `null` and the check is skipped with a single diagnostic `console.warn` (so a future change to the range string doesn't silently bypass the check). See R-0004 in `REQUIREMENTS.md`. **Implication for releases**: bump `peerDependencies` before tagging whenever AH starts using API from a newer PI — the check only protects users if that field is honest.

`lib/context-inspector.ts` is a self-contained observability module: it taps `before_provider_request` / `after_provider_response` / `message_end` and writes per-session NDJSON logs under `.pi/context-inspector/<timestamp>_<sid>/`. It must remain non-mutating — its provider-request handler always returns `undefined`.

`lib/codebase-cache.ts` defines the **doc → file-pattern map** used by `/ah:map-codebase` to decide which of the 7 thematic codebase docs (`STACK`, `INTEGRAZIONI`, `ARCHITETTURA`, `STRUTTURA`, `CONVENZIONI`, `TESTING`, `CRITICITA`) is stale after a diff. Two entries are "special": `STRUTTURA.md` regenerates on any add/delete (topology trigger), and `CRITICITA.md` is broad with a content filter for TODO/FIXME markers. Editing `PATTERN_MAP` directly changes what map-codebase regenerates incrementally.

### Directory layout

```
package.json            — Pi Package manifest (pi.extensions/skills/prompts, peerDeps)
extensions/
  index.ts              — single entry point (factory function)
lib/                    — helpers imported by extensions/index.ts; NOT auto-loaded as extensions
  register-prompt.ts
  load-codebase-doc.ts
  context-inspector.ts
  codebase-cache.ts, codebase-index.ts
  plan-context.ts/.js, context-audit.ts/.js
prompts/*.md            — registered as /ah:* commands
skills/ah-task-*/INSTRUCTIONS.md — inner-cycle skills
templates/, procedures/ — referenced by prompts via $EXT_DIR
```

## How to release a new version

1. **Aggiorna `CHANGELOG.md`**: sposta i bullet da `## [Unreleased]` a una nuova sezione `## [X.Y.Z] — YYYY-MM-DD`. Includi la sotto-sezione `Migration` (anche solo "Nessuna azione richiesta." se è il caso). Aggiungi il reference-link `[X.Y.Z]: …compare/v(X.Y.Z-1)...vX.Y.Z` in coda al file.
2. Bump `version` in `package.json` (semver).
3. Se la release richiede step di compatibilità lato consumer automatizzabili, aggiungi `lib/migrations/v<MAJOR>_<MINOR>_<PATCH>.ts` e registralo in `lib/migrations/index.ts` (vedi § Consumer migration).
4. Commit + push su `main`.
5. Crea un **annotated git tag** `vX.Y.Z` e pushalo (`git push origin vX.Y.Z`).
6. La GitHub Action `.github/workflows/release.yml` triggera sul tag, estrae la sezione `[X.Y.Z]` dal CHANGELOG via `awk` POSIX e crea automaticamente la GitHub Release con quel body. Non c'è bisogno di intervento manuale sulla UI.

At next pi startup, users with an **unpinned** git install (`pi install git:github.com/Skillbill/agentic-harness` or with `-l`) will see PI's native `Package Updates Available` banner pointing at this package. They then run `pi update` (global) or `pi update --extension git:github.com/Skillbill/agentic-harness` (precise) to pull the new ref. Users with a **pinned** install (`@vX.Y.Z`) are skipped by `pi update` — to upgrade, they re-`pi install` with the new ref.

Dopo il `pi update`, alla prima sessione PI con la nuova versione di AH, il framework di consumer migration (vedi § Consumer migration) applica automaticamente eventuali step di compatibilità sul progetto consumer.

## Install scopes

AH can be installed at either scope (PI v0.74.0 supports both natively, no AH code involved):

- **Global**: `pi install git:github.com/Skillbill/agentic-harness` — written to `~/.pi/agent/settings.json`.
- **Project-local**: `pi install -l git:github.com/Skillbill/agentic-harness` — written to `<cwd>/.pi/settings.json`, committable to share with the team. PI auto-installs project packages on startup if missing.

Add `@vX.Y.Z` to pin the version (recommended for CI / reproducible team setups).

## Consumer migration

Quando un progetto consumer aggiorna AH (es. v0.6.0 → v0.7.0 via `pi update`), AH applica automaticamente eventuali step di compatibilità sul progetto al successivo `session_start` di PI. Questo evita che il consumer si trovi out-of-sync con convenzioni / file layout / frontmatter modificati dalla nuova versione di AH. Codificato in R-0003 di `REQUIREMENTS.md`.

**Architettura** (`extensions/index.ts` chiama `migrateConsumer` dentro l'handler `session_start`):

- **Marker**: `<consumerRoot>/.pi/ah-version`, plain text con `X.Y.Z` (o JSON `{"version":"x.y.z"}` — entrambi i formati accettati in lettura). Assente = prima installazione. Scritto da AH dopo ogni step di migration riuscito.
- **Runner**: `lib/migrate-consumer.ts` legge la propria versione installata dal `package.json` adiacente, legge il marker, calcola le pending (`marker < target ≤ installed` in ordine semver) e le esegue una alla volta facendo checkpoint del marker dopo ogni successo.
- **Registry**: `lib/migrations/index.ts` esporta `MIGRATIONS: readonly ConsumerMigration[]` (vedi `lib/migrations/types.ts` per il contratto). Lista vuota a v0.6.0; la prima entry arriverà con v0.7.0.

**Invarianti**:
- **Idempotenza** obbligatoria: ogni `apply` deve essere safe da rieseguire (es. `mkdirSync(..., { recursive: true })`, rename solo se source esiste e target no).
- **No git mutations**: la Git Safety Rule vale anche dentro le migration. Possono mutare file in `.pi/` o nel working tree, ma `git add/commit/push/checkout` restano del dev.
- **Failure non-blocking**: se una migration fallisce, AH logga l'errore, lascia il marker all'ultimo step riuscito e continua a caricarsi. Il dev sistema e rilancia la sessione.

**Per aggiungere una migration**:
1. Crea `lib/migrations/v<MAJOR>_<MINOR>_<PATCH>.ts` con `export const migration: ConsumerMigration = { version, description, apply }`.
2. Importa e aggiungi all'array di `lib/migrations/index.ts` mantenendo l'ordine semver.
3. Documenta lo step nella sezione `Migration` della versione corrispondente in `CHANGELOG.md`.

## Authoritative contracts — read before changing prompts

- **`WORKFLOW.md`** — task lifecycle (`backlog → in-progress → review → done`), branch/commit conventions, the full `/ah:*` command table, and the Git Safety Rule.
- **`task-layout.md`** — directory layout of a task (`T-NNN-slug/` with `TASK.md` + optional `DISCUSS.md`, `PLAN.md`, `steps/NN-*.md`, `VERIFY.md`), the `discuss → plan → execute → verify` inner cycle contract, and the `context-needed:` frontmatter spec for `PLAN.md` (YAML list of bare stems, regex `^[a-zA-Z0-9_-]+$`, empty list `[]` is legal and meaningful).

If you change either of these, the prompts under `prompts/` and the skills under `skills/` likely need matching updates — they reference these contracts by behavior, not by import.

## 🔒 Git Safety Rule — scope

> **Heads up to whoever is reading this CLAUDE.md while editing the AH repo itself**: la Git Safety Rule **non ti riguarda**. Vincola l'**agente che gira in un progetto consumer** quando AH è caricata lì — cioè i prompt sotto `prompts/` (eseguiti via `pi.sendUserMessage`) e il codice delle consumer-migration (eseguito al `session_start` di PI nel consumer). Quando invece stai lavorando su questo repo (`Skillbill/agentic-harness`) come dev di AH, le operazioni git mutanti (`add` / `commit` / `push` / branch / PR) sono normali — su richiesta dell'utente.

La regola autoritativa, con elenco dei comandi vietati, l'eccezione `/ah:task-new`, e l'override "committa tu" / "push it", vive in **`WORKFLOW.md` § Git Safety Rule**. Quel file è caricato come contesto dai prompt di AH dentro i consumer; questo `CLAUDE.md` no.

Implicazione per le **consumer migration** (`lib/migrations/v*.ts`): quando girano nel consumer mutano `<consumerRoot>/.pi/...` o il working tree del consumer, ma **non** eseguono `git add` / `commit` / `push` / `checkout`. Vedi R-0003.

## Inner-cycle skills

`skills/ah-task-{discuss,plan,execute,verify,pr-open}` mirror the inner-cycle phases. They are invoked indirectly: the dev runs `/ah:task-next-step`, which auto-detects the task from the branch (`feature/T-NNN-*`) and advances one phase. Key invariants enforced by the prompts:

- **One step = one commit** during `execute`. `/ah:task-next-step` must stop after a single step — never chain.
- **`.pi/codebase/` is a blocking prerequisite** for discuss/plan/execute. If missing, propose generating it inline via the map-codebase logic; if the dev refuses, halt the phase.
- **`PLAN.md` is the authority** for what codebase docs get loaded: only docs listed in its `context-needed:` frontmatter, loaded via `load_codebase_doc`. Empty list means "no codebase context for this task" — that is correct, not a bug.
- **DoD in `VERIFY.md` is advisory**, not a gate.
- **Step files are never deleted on replan** — they move to `steps/archive/`.

## Conventions when editing this repo

- Prompts under `prompts/` and `skills/` are in **Italian**. Match the existing voice when editing them; new prompts should also be in Italian unless the user requests otherwise.
- Commit message format for AH itself follows the same `feat(T-NNN/NN): …` / `chore(T-NNN): …` patterns documented in `task-layout.md:373-381` when you're operating inside the task cycle. For ad-hoc commits to this extension's own code, no specific format is enforced.
- `.pi/codebase/.cache.json` is gitignored; the 7 thematic docs under `.pi/codebase/` are versioned in the consumer project, not here.
