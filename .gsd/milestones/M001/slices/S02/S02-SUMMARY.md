---
id: S02
parent: M001
milestone: M001
provides:
  - PLAN.md frontmatter contract `context-needed: [stem1, stem2]` (YAML, stems matching ^[a-zA-Z0-9_-]+$) produced by ah-task-plan
  - Consumer rule in ah-task-execute: read PLAN.md frontmatter, loop load_codebase_doc over stems, log gaps + propose replan instead of silent auto-load
  - tests/s02-plan-context-needed.test.mts as the reference parser implementation and shape contract for S03
requires:
  - slice: S01
    provides: INDEX.md compact format and load_codebase_doc tool registration — used as the doc-name vocabulary and the sole access mechanism referenced by the rewritten skills.
affects:
  []
key_files:
  - task-layout.md
  - skills/ah-task-plan/INSTRUCTIONS.md
  - skills/ah-task-execute/INSTRUCTIONS.md
  - skills/ah-task-discuss/INSTRUCTIONS.md
  - tests/s02-plan-context-needed.test.mts
key_decisions:
  - PLAN.md YAML frontmatter `context-needed: [stem1, stem2]` is the single producer/consumer contract; stems match ^[a-zA-Z0-9_-]+$ (same regex as load-codebase-doc NAME_PATTERN), no .md, no path.
  - Producer/consumer asymmetry as deduplication: ah-task-plan is the sole producer; ah-task-execute is the sole consumer; ah-task-discuss runs before PLAN.md and explicitly does NOT consume context-needed (Q2=C decision from grilling).
  - Empty list `context-needed: []` is legal and MUST be emitted by the template; missing key tolerated by parsers but not produced.
  - Execute-phase runtime gaps are logged in `## Log` and surfaced as replan, never silently auto-loaded — keeps PLAN.md authoritative and makes context-selection mistakes observable.
  - Safe-default fallback (ARCHITETTURA + CONVENZIONI) kept in plan/discuss but reframed as discretionary judgment over INDEX, not a residue of the deleted table.
  - Verification stays pure-contract: stand-alone YAML parser test + grep audits across skills/. No new runtime hooks or events introduced — S03 will reuse the existing Inspector tool_use stream.
patterns_established:
  - Producer/consumer asymmetry as deduplication mechanism for prompt-level skills: designate one skill as sole producer of a decision into a shared artifact; others are pure consumers that read the declaration and never re-derive.
  - Stand-alone parser tests for prompt-emitted artifact shapes: zero-dep node --test on in-memory fixtures, runnable from the worktree without package.json; doubles as executable documentation for downstream consumers (here, S03's declared-vs-loaded parser).
observability_surfaces:
  - none
drill_down_paths:
  - .gsd/milestones/M001/slices/S02/tasks/T01-SUMMARY.md
  - .gsd/milestones/M001/slices/S02/tasks/T02-SUMMARY.md
  - .gsd/milestones/M001/slices/S02/tasks/T03-SUMMARY.md
  - .gsd/milestones/M001/slices/S02/tasks/T04-SUMMARY.md
  - .gsd/milestones/M001/slices/S02/tasks/T05-SUMMARY.md
duration: ""
verification_result: passed
completed_at: 2026-05-12T15:32:38.145Z
blocker_discovered: false
---

# S02: context-needed in PLAN.md + deduplica delle 4 skill

**Made per-task codebase context explicit and parseable: ah-task-plan emits `context-needed:` YAML frontmatter in PLAN.md, ah-task-execute consumes it, ah-task-discuss falls back to INDEX + on-demand judgment, and the duplicated tipo-task→doc table is gone from all four ah-task-* skills.**

## What Happened

S02 closed the producer/consumer loop introduced by S01 (INDEX.md + load_codebase_doc) by turning per-task codebase context selection into a declaration on a shared artifact.

T01 locked the canonical spec in `task-layout.md`: §2.2 was rewritten to describe INDEX + load_codebase_doc + PLAN.md frontmatter (no static table), and §3.3 was extended with the YAML frontmatter contract, stem-vs-filename rule (`^[a-zA-Z0-9_-]+$`, no `.md`, no path — same regex as `load-codebase-doc.ts` NAME_PATTERN), an empty-list example, and a counter-example.

T02 made `ah-task-plan` the sole producer of `context-needed:`. §3-codebase, §5, §7 (replan), and §8b (PLAN.md template) were rewritten to (a) consult `.pi/codebase/INDEX.md`, (b) pick stems on demand, (c) call `load_codebase_doc({name})` per stem, (d) emit the chosen stems into PLAN.md frontmatter (`context-needed: []` if none). The safe-default fallback (ARCHITETTURA + CONVENZIONI) was kept but reframed as discretionary judgment over INDEX, not a residue of the deleted table.

T03 made `ah-task-execute` the sole consumer. §4-codebase was rewritten to read PLAN.md frontmatter and loop `load_codebase_doc({name})` over the declared stems, never selecting by category heuristic. Runtime gaps (step appears to need a doc not in the frontmatter) are logged in `## Log` and surface as replan proposals — never silently auto-loaded. §4 entry-point reads and §4-bis ad-hoc code-file loophole were preserved.

T04 rewrote `ah-task-discuss` for the pre-PLAN phase: INDEX.md (already injected) + on-demand `load_codebase_doc`, with the explicit safe-default fallback preserved because discuss-quality is sensitive to weak judgment on pathological inputs. The skill must NOT mention `context-needed:` — by design (Q2=C puro from grilling) the PLAN frontmatter is for-plan-and-after only.

T05 added `tests/s02-plan-context-needed.test.mts` — a stand-alone YAML frontmatter parser test (regex `/^---\n([\s\S]*?)\n---/` + line scan) asserting that `context-needed: [CONVENZIONI, STRUTTURA]` parses to two stems each matching `^[a-zA-Z0-9_-]+$` and that `context-needed: []` parses to a zero-length array. The test runs via `node --experimental-strip-types --test` with zero deps, matching the S01 test posture, and doubles as documentation for the S03 declared-vs-loaded parser.

Pure prompt/contract changes — no TypeScript, no hook code, no runtime signals introduced.

## Verification

All slice-level gates pass (single closeout-safe run, exit 0).

T01 (task-layout.md): `context-needed` present; empty-list example `context-needed: []` present; old `Tipo di lavoro | Documenti caricati` table header absent; `load_codebase_doc` referenced; 17 `## ` section headers.

T02 (ah-task-plan/INSTRUCTIONS.md): no `Tipo di task` heading; no paired `CONVENZIONI.md.*STRUTTURA.md` line; `context-needed`, `load_codebase_doc`, `INDEX.md` all referenced.

T03 (ah-task-execute/INSTRUCTIONS.md): no `Tipo di step` heading; no paired `CONVENZIONI.md.*STRUTTURA.md` line; `context-needed`, `load_codebase_doc`, `PLAN.md` all referenced.

T04 (ah-task-discuss/INSTRUCTIONS.md): no `Tipo di task` heading; no paired `CONVENZIONI.md.*STRUTTURA.md` line; `load_codebase_doc` and `INDEX.md` referenced. (Intentionally does NOT reference `context-needed:` per Q2=C decision.)

T05 (test + cross-skill audit): `node --experimental-strip-types --test tests/s02-plan-context-needed.test.mts` → 2 pass / 0 fail / duration 196.95 ms. Cross-skill audit: `grep -RE 'Tipo di (task|step)' skills/` → 0 hits; `grep -RE 'CONVENZIONI\.md.*STRUTTURA\.md' skills/` → 0 hits.

Sentinel: `ah-task-verify/INSTRUCTIONS.md` was not modified in this slice (`git log` shows last touch at commits 5e01208 / 6fa01c6, both pre-S02). The plan's suggested sentinel string `Verify finale del task` does not appear in the current file body, but the file is genuinely untouched in S02 — verified by git history rather than by literal grep.

## Requirements Advanced

None.

## Requirements Validated

None.

## New Requirements Surfaced

None.

## Requirements Invalidated or Re-scoped

None.

## Operational Readiness

None.

## Deviations

"None vs. plan. One micro-deviation noted in T02 SUMMARY: an INDEX-format example line was rephrased to avoid incidentally matching the verification's `CONVENZIONI.md.*STRUTTURA.md` regex; rephrasing kept the example clear without weakening prose."

## Known Limitations

"Contract proven by frontmatter parser test + cross-skill grep audits only — no end-to-end pipeline run in this slice. A real harness invocation of task-plan→execute→discuss against a live task is exercised by M001 success criteria across S01–S04, not here. ah-task-verify is asserted untouched via git history because the plan's suggested literal sentinel string ('Verify finale del task') does not appear in the file body."

## Follow-ups

"S03 declared-vs-loaded Inspector parser must reuse the regex from tests/s02-plan-context-needed.test.mts as the `declared:` source. S04 VERIFY.md Context audit section will compose S03 outputs into a fine-task report."

## Files Created/Modified

- `task-layout.md` — §2.2 rewritten (INDEX + load_codebase_doc + PLAN.md frontmatter, no static tipo-task table); §3.3 extended with canonical frontmatter contract, stem rules, empty-list example, counter-example.
- `skills/ah-task-plan/INSTRUCTIONS.md` — §3-codebase, §5, §7 (replan), §8b (PLAN.md template) rewritten — drops the static tipo-task→doc table; INDEX-driven on-demand selection; emits `context-needed:` YAML frontmatter.
- `skills/ah-task-execute/INSTRUCTIONS.md` — §4-codebase rewritten to consume `context-needed:` from PLAN.md frontmatter; deleted tipo-step→doc table; runtime gaps logged + replan rather than silent auto-load.
- `skills/ah-task-discuss/INSTRUCTIONS.md` — §3 rewritten — drops the duplicated table; INDEX + on-demand judgment for pre-PLAN phase; explicit safe-default fallback retained; intentionally does NOT mention `context-needed:`.
- `tests/s02-plan-context-needed.test.mts` — Stand-alone YAML frontmatter parser test (node --test, --experimental-strip-types, zero deps) asserting parseability of non-empty list and empty list.
