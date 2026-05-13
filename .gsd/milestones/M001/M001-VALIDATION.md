---
verdict: needs-attention
remediation_round: 0
---

# Milestone Validation: M001

## Success Criteria Checklist
## Reviewer A — Requirements Coverage

| Requirement | Status | Evidence |
|---|---|---|
| **R1: Consolidate 4 skills (discuss/plan/execute/verify); remove duplicated tipo-task→doc table** | COVERED | S02 SUMMARY: T02 rewrites `ah-task-plan`, T03 rewrites `ah-task-execute`, T04 rewrites `ah-task-discuss`; cross-skill grep `Tipo di (task\|step)` → 0 hits, `CONVENZIONI\.md.*STRUTTURA\.md` → 0 hits. ah-task-verify extended in S04 T03 with §2.5 + step 6.5. |
| **R2a: Selezione on-demand — INDEX.md + load_codebase_doc; forced injection rimossa** | COVERED | S01 SUMMARY: `codebase-index.ts` + `load-codebase-doc.ts` added; `index.ts` first `before_agent_start` injects only INDEX (≤500 tokens, customType `project-codebase-index`); `/ah:map-codebase` emits INDEX.md; 3/3 tests pass. |
| **R2b: Sorgente unica per-task — `context-needed:` in PLAN.md, consumato da execute** | COVERED | S02 SUMMARY: YAML frontmatter contract prodotto solo da `ah-task-plan`, consumato solo da `ah-task-execute`; discuss esclusa (Q2=C puro); parser test 2/2. |
| **R2c: Inspector osservatore + decisore separato (Q3=A)** | COVERED | S03 SUMMARY: `context-audit.ts` accumulator; Inspector listeners observer-only; `summary.json.context[taskId]` + `tasks/<T-NNN>/context-audit.json`; `/ah:ctx-stats` "Context audit" block; 15/15 tests pass. |
| **R3: Human-in-the-loop esplicito** | COVERED | S04 SUMMARY: `## Context audit` in `VERIFY.md`; `ah:ctx-audit <T-NNN>` pi command; §2.5 + step 6.5 in `ah-task-verify/INSTRUCTIONS.md`. |
| **Success-1: 4 skills no longer duplicate tipo-task→doc table** | COVERED | S02 cross-skill audit: 0 hits. |
| **Success-2: Forced codebase-map injection in index.ts removed** | COVERED | S01 T02: hook rewritten to inject only INDEX.md or fallback ≤500 token; log renamed. |
| **Success-3: PLAN.md contains `context-needed: [...]` decided by task-plan** | COVERED | S02 T02 + parser test (non-empty and empty list). |
| **Success-4: VERIFY.md contains `dichiarato vs effettivo` + delta token** | COVERED | S03 persiste declared/loaded/deltaToken/label; S04 renderer in `## Context audit` + `ah:ctx-audit`. |
| **Success-5: 4 skills run on real task without re-reading / loading off-list docs** | PARTIAL | Contract proven by unit tests + grep audits + execute "log gaps & propose replan" rule. S02 Known Limitations: no end-to-end pipeline run recorded inside the milestone — deferred to closeout demo. |

**Reviewer A verdict: NEEDS-ATTENTION** (Success-5 lacks recorded live-session evidence).

## Slice Delivery Audit
All four slices closed with `verification_result: passed` and have both SUMMARY.md and UAT.md artifacts under `.gsd/milestones/M001/slices/`:

- **S01** (INDEX + load on-demand foundation): SUMMARY + UAT present. Verification: 3/3 tests, 4 task verification commands green. No outstanding follow-ups blocking; known limitation: typebox transitive dep self-heals via symlink.
- **S02** (Skill dedup + context-needed in PLAN.md): SUMMARY + UAT present. Verification: cross-skill grep audits (0 hits for duplicated table), 2/2 parser tests. Known Limitation explicitly: no live PI end-to-end run within the slice.
- **S03** (Inspector audit declared vs loaded): SUMMARY + UAT present. Verification: 15/15 tests across `context-audit` + `inspector-wire` suites. Per-task `context-audit.json` + `summary.json.context` shape exercised.
- **S04** (VERIFY.md Context audit section + ah:ctx-audit command): SUMMARY + UAT present. Verification: 25/25 tests (gsd_exec id 2db64129) + 5 wiring greps (gsd_exec id e5f049e1). §2.5 + step 6.5 inserted into `skills/ah-task-verify/INSTRUCTIONS.md`.

No slice has a `flag` assessment or missing artifact. The gap surfaced by reviewers A and C is consistent: no slice records a recorded live PI session driving discuss→plan→execute→verify with Inspector capture against a real task — multiple slice UATs (S01, S02, S04 step 5–7) explicitly defer the live smoke to the milestone closeout demo without persisting a transcript.

## Cross-Slice Integration
## Reviewer B — Cross-Slice Integration

| Boundary | Producer Evidence | Consumer Evidence | Status |
|---|---|---|---|
| **S01 → S02** (INDEX.md format, `load_codebase_doc` tool, `before_agent_start` rewired) | S01: `codebase-index.ts` + `load-codebase-doc.ts` registered via `pi.registerTool`; `index.ts` injects only INDEX; `commands/map-codebase.md` emits INDEX.md as 8th artifact with regex `^[A-Za-z0-9_\-\./]+\.md: .{1,120}$` | S02: `ah-task-plan` rewritten to consult `.pi/codebase/INDEX.md` + call `load_codebase_doc({name})` per stem; stems use same `^[a-zA-Z0-9_-]+$` regex as `load-codebase-doc.ts` NAME_PATTERN | OK |
| **S01 → S03** (`load_codebase_doc` events visible to Inspector) | S01: tool registered via `pi.registerTool` emits standard `tool_use`/`tool_result`; observability_surfaces notes Inspector at `context-inspector.ts:217-237` auto-captures | S03: `context-inspector.ts` wires `pi.on('tool_call')` + `pi.on('tool_result')` listeners; populates `loaded:` from these; `tests/s03-inspector-wire.test.mts` e2e exercises wiring | OK |
| **S02 → S03** (`context-needed:` YAML frontmatter in PLAN.md; dedup tipo-task table) | S02: `task-layout.md §3.3` defines contract; `ah-task-plan` sole producer; `tests/s02-plan-context-needed.test.mts` is reference parser; cross-skill grep confirms 0 hits | S03: T01 extracted parser into shared `plan-context.{ts,js}` exporting `parseContextNeeded` + `NAME_PATTERN`; S02 test repointed; Inspector uses parser to populate `declared:` | OK |
| **S03 → S04** (summary.json.context + tasks/<T-NNN>/context-audit.json with declared/loaded/delta_token) | S03: `context-audit.ts` accumulator; per-task JSON writer; `summary.json.context` keyed by taskId under `.pi/context-inspector/<ts>_<sid>/`; `/ah:ctx-stats` displays it | S04: `renderContextAuditMarkdown(audit)` consumes serialised `ContextAudit`; `findLatestAuditForTask` locates per-task JSON; `ah:ctx-audit` renders it; `tests/s04-ctx-audit-cmd.test.mts` exercises happy path | OK |

Reinforcing notes:
- S02 producer regex equals S01 NAME_PATTERN — symmetric contract.
- S03 fused S02's inline parser into shared `plan-context.{ts,js}` (true dedup, not re-derivation).
- S04 reuses S03's `context-audit.{ts,js}` by adding renderer there, preserving no-cross-module-deps invariant.
- S04 `requires` transitively names S01 + S02 + S03 — full chain acknowledged.

**Reviewer B verdict: PASS** (every boundary contract has producer + consumer artefacts).

## Requirement Coverage
## Reviewer C — Acceptance Criteria & Verification

### Acceptance Criteria
- [x] Le 4 skill non duplicano più la tabella tipo-task→doc — esiste una sola fonte (il PLAN.md prodotto da task-plan). | Evidence: S02-SUMMARY.md / S02-UAT.md step 5 (cross-skill grep `Tipo di (task|step)` → 0 hits; `CONVENZIONI\.md.*STRUTTURA\.md` → 0 hits).
- [x] L'injection forzata della codebase map in `index.ts:119-159` è rimossa. | Evidence: S01-SUMMARY.md T02 + S01-UAT step 2 (`! grep -qE 'sections\.push\(.+f\.content' index.ts`, customType `project-codebase-index`, INDEX-only injection).
- [x] Un task reale completato end-to-end produce un PLAN.md che contiene `context-needed: [...]` deciso da task-plan. | Evidence: S02-SUMMARY.md (ah-task-plan §8b template; parser test 2/2). Live end-to-end exercise deferred to S04-UAT step 5–7 closeout demo (not recorded).
- [x] Lo stesso task produce in VERIFY.md una sezione 'Context audit' con dichiarato vs effettivo + delta token. | Evidence: S04-SUMMARY.md T01–T03 (`renderContextAuditMarkdown`, `ah:ctx-audit`, §2.5 + step 6.5); S04-UAT steps 4–7.
- [x] Le 4 skill girano sul task senza ri-leggere doc già caricati e senza caricare doc non in `context-needed`. | Evidence: S02-SUMMARY.md (execute sole consumer, gaps → replan, no silent auto-load). Caveat: proven by prompt-contract greps + parser tests, not by recorded live session.

### Verification Classes

| Class | Planned Check | Evidence | Verdict |
|---|---|---|---|
| Contract | INDEX.md format, context-needed parseable, requests.ndjson load-codebase-doc events, summary.json declared/loaded | S01 test 3/3 (INDEX entries + load_codebase_doc literal + traversal rejects); S02 test 2/2 (frontmatter parser); S03 tests 9/9 + inspector-wire (asserts `summary.json.context[<T-NNN>]` + `tasks/<T-NNN>/context-audit.json`); INDEX regex `^[A-Za-z0-9_\-\./]+\.md: .{1,120}$` in `commands/map-codebase.md` | PASS |
| Integration | PI session with discuss → plan → execute → verify with on-demand loading + Inspector capture | S04-UAT step 5–7 documents demo + REPLACE semantics, but no recorded transcript of a real harness session driving all four skills. S04 verification used `gsd_exec` 2db64129 (25/25 tests) + e5f049e1 (5 greps) — no live PI evidence. S01-UAT and S02-UAT explicitly list "live PI session" under Not Proven | NEEDS-ATTENTION |
| Operational | N/A | Roadmap declares N/A; all slice SUMMARYs report Operational Readiness: None | PASS (N/A) |
| UAT | Human reads VERIFY.md and within 30s sees over/under-load status without log diving | S04-SUMMARY T01 (renderer with leading `Label:` line + signed `delta_token` + one-line synthesis covering 5 labels — on-budget/over-load/under-load/divergent/no-declaration); 8/8 renderer cases green; S04-UAT step 6 asserts placement between DoD and Verify Log | PASS |

**Reviewer C verdict: NEEDS-ATTENTION** — Contract, Operational, UAT classes covered; Integration class lacks recorded live PI session driving the full chain.

## Verification Class Compliance
| Class | Planned Check | Evidence | Verdict |
|---|---|---|---|
| Contract | Struttura INDEX.md (path + 1-line summary), formato context-needed parseabile, requests.ndjson contiene eventi load-codebase-doc, summary.json espone declared/loaded | S01 test `tests/s01-load-on-demand.test.mts` 3/3; S02 test `tests/s02-plan-context-needed.test.mts` 2/2; S03 tests `tests/s03-context-audit.test.mts` 9/9 + `tests/s03-inspector-wire.test.mts`; INDEX regex `^[A-Za-z0-9_\-\./]+\.md: .{1,120}$` documented in `commands/map-codebase.md`; per-task `context-audit.json` + `summary.json.context[<T-NNN>]` shape exercised | PASS |
| Integration | Sessione PI reale con un task reale: le 4 skill girano in sequenza (discuss → plan → execute → verify) con load on-demand attivo e Inspector che registra entrambi gli stream | S04-UAT step 5–7 descrive il demo manuale e la semantica REPLACE, ma nessun transcript recorded di una vera sessione harness viene salvato sotto `.gsd/milestones/M001/`. S04 verification ha eseguito gsd_exec 2db64129 (25/25 test) ed e5f049e1 (5 grep), nessuna evidenza live-PI. S01-UAT e S02-UAT elencano esplicitamente "live PI session" tra i Not Proven, deferring al milestone closeout | NEEDS-ATTENTION |
| Operational | N/A — nessun servizio long-running, nessun supervisor, nessun reconnect | Roadmap dichiara N/A; tutti i SUMMARY di slice riportano `Operational Readiness: None` | PASS (N/A) |
| UAT | L'umano apre il VERIFY.md prodotto a fine task e capisce in <30s se il task è in over/under-load, senza leggere i log | S04-SUMMARY.md T01: renderer emette `Label:` leading + `delta_token` con segno + synthesis one-line coprendo i 5 label (on-budget/over-load/under-load/divergent/no-declaration); 8/8 renderer test green; S04-UAT step 6 verifica posizionamento del blocco tra DoD e Verify Log; `ah:ctx-audit <T-NNN>` espone l'audit via `ctx.ui.notify` | PASS |


## Verdict Rationale
Reviewers A and C converged on the same gap: every Success Criterion and every Boundary contract is backed by passing unit tests, prompt-contract greps, and producer/consumer SUMMARY artefacts, but no slice persists a recorded live PI session driving discuss → plan → execute → verify with Inspector capture against a real task. Reviewer B confirmed all 4 inter-slice boundaries are honoured. The missing live-integration transcript is the sole defect; contract-level proof and renderer/UAT evidence are complete, so the milestone is `needs-attention` (not `needs-remediation`): the gap can be closed by running the S04-UAT step 5–7 closeout demo and attaching the resulting VERIFY.md + Inspector session directory as evidence, rather than by re-planning slices.
