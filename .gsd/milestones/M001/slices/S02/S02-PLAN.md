# S02: context-needed in PLAN.md + deduplica delle 4 skill

**Goal:** Make per-task context selection explicit and parseable: ah-task-plan emits a `context-needed: [...]` YAML frontmatter in `PLAN.md` listing the codebase docs the task needs, downstream skills consume that declaration (or fall back to INDEX + on-demand judgment when PLAN does not yet exist), and the duplicated `tipo-task → doc` table is removed from skills and the design doc. Pure prompt/contract changes — no TypeScript or hook code touched.
**Demo:** Un task reale viene pianificato da task-plan: il PLAN.md risultante contiene un blocco context-needed: [convenzioni, struttura]; le fasi successive (discuss/execute/verify) caricano esattamente quei doc — niente di più, niente di meno; un grep nelle 4 skill non trova più la tabella tipo-task→doc duplicata.

## Must-Haves

- A planned task produces a `PLAN.md` whose frontmatter contains a parseable `context-needed: [name1, name2]` list (stems, no `.md`), `grep -RE 'Tipo di (task|step)' skills/` returns 0 matches, `grep -RE 'CONVENZIONI\.md.*STRUTTURA\.md' skills/` returns 0 matches, each of ah-task-{plan,execute,discuss} references `load_codebase_doc`, and `task-layout.md` §3.3 documents the frontmatter spec with stem-vs-filename guidance and empty-list semantics.

## Proof Level

- This slice proves: contract

## Integration Closure

S02 closes the producer/consumer loop introduced by S01: `ah-task-plan` becomes the sole producer of the per-task context declaration (`context-needed:` in `PLAN.md` frontmatter), `ah-task-execute` becomes the sole consumer (loops `load_codebase_doc` over the declared stems), and `task-layout.md` §3.3 is the canonical spec. S03 (Inspector declared-vs-loaded diff) reads the same frontmatter as its `declared:` source — no new wiring added in this slice, only the contract.

## Verification

- No new runtime signals. The slice's verifiability rests on (a) frontmatter parseability via a node test (`tests/s02-plan-context-needed.test.mts`) and (b) cross-skill grep audits. The existing Inspector at `context-inspector.ts:217-237` already captures `tool_use` events for `load_codebase_doc` — S03 will read those plus the `context-needed:` frontmatter.

## Tasks

- [ ] **T01: Lock context-needed frontmatter spec in task-layout.md (§3.3 + §2.2 rewrite)** `est:45m`
  Make `task-layout.md` the canonical spec for the new per-task context mechanism. Rewrite §2.2 'Caricamento selettivo' to describe INDEX + load_codebase_doc + PLAN.md frontmatter (removing the static tipo-task table) and extend §3.3 'PLAN.md' template to show the `context-needed:` YAML frontmatter at the top of the file, with stem-vs-filename rule, an empty-list example, and a counter-example. Italian-language prose to match surrounding tone; key name stays English (`context-needed:`). No other sections of task-layout.md are touched.
  - Files: `task-layout.md`
  - Verify: grep -q 'context-needed' task-layout.md && grep -q 'context-needed: \[\]' task-layout.md && ! grep -E 'Tipo di lavoro \| Documenti caricati' task-layout.md >/dev/null && grep -q 'load_codebase_doc' task-layout.md && grep -cE '^## ' task-layout.md

- [ ] **T02: Rewrite ah-task-plan to emit context-needed in PLAN.md frontmatter** `est:1h`
  `ah-task-plan` becomes the sole producer of `context-needed:`. Delete the static tipo-task→doc table in §3-codebase (lines 112-129) plus the 'Usa questi documenti per:' usage prose. Replace with instructions to (a) consult the already-injected `.pi/codebase/INDEX.md`, (b) pick the doc stems needed to plan, (c) call `load_codebase_doc({name})` for each, (d) write the chosen stem list into PLAN.md frontmatter as `context-needed:`. Strip `.md` from INDEX entries when emitting. Always emit the key (`context-needed: []` if truly no codebase context is needed). Update §8b 'PLAN.md' template to show the YAML frontmatter block at the top. Add a one-liner in §5 ('propose decomposition') reminding the LLM to also pick context-needed names. Add a replan rule in §7: replan recomputes context-needed from current TASK.md + DISCUSS.md state. Keep §3-bis (load referenced code files) untouched. Keep the safe-default fallback (load `ARCHITETTURA` + `CONVENZIONI` when type unclear) but rephrase it to operate on the LLM's discretion over INDEX, not the deleted table.
  - Files: `skills/ah-task-plan/INSTRUCTIONS.md`
  - Verify: ! grep -E 'Tipo di task' skills/ah-task-plan/INSTRUCTIONS.md >/dev/null && ! grep -E 'CONVENZIONI\.md.*STRUTTURA\.md' skills/ah-task-plan/INSTRUCTIONS.md >/dev/null && grep -q 'context-needed' skills/ah-task-plan/INSTRUCTIONS.md && grep -q 'load_codebase_doc' skills/ah-task-plan/INSTRUCTIONS.md && grep -q 'INDEX.md' skills/ah-task-plan/INSTRUCTIONS.md

- [ ] **T03: Rewrite ah-task-execute to consume context-needed from PLAN.md frontmatter** `est:45m`
  `ah-task-execute` becomes the sole consumer of `context-needed:`. Delete the static tipo-step→doc table in §4-codebase (lines 136-164) plus the per-doc 'Usa questi documenti durante l'implementazione per:' prose. Replace with: 'Read `PLAN.md` frontmatter `context-needed: [...]`. For each stem in the list, call `load_codebase_doc({name})`. Do not load other codebase docs by category heuristic — trust the declaration.' Keep §4 (load TASK/DISCUSS/PLAN/step file) untouched as the entry point. Keep §4-bis (ad-hoc code-file reads) untouched as the explicit loophole for code files referenced in `## Execute`. Compact the 'piano ha precedenza sulla mappa globale' rule into a one-liner: 'If a loaded codebase doc contradicts `## Execute`, follow `## Execute` and log the contradiction in `## Log`.' If at execute time the step appears to need another codebase doc, the skill logs that gap in `## Log` and proposes replan rather than silently loading.
  - Files: `skills/ah-task-execute/INSTRUCTIONS.md`
  - Verify: ! grep -E 'Tipo di step' skills/ah-task-execute/INSTRUCTIONS.md >/dev/null && ! grep -E 'CONVENZIONI\.md.*STRUTTURA\.md' skills/ah-task-execute/INSTRUCTIONS.md >/dev/null && grep -q 'context-needed' skills/ah-task-execute/INSTRUCTIONS.md && grep -q 'load_codebase_doc' skills/ah-task-execute/INSTRUCTIONS.md && grep -q 'PLAN.md' skills/ah-task-execute/INSTRUCTIONS.md

- [ ] **T04: Rewrite ah-task-discuss to remove duplicated table (INDEX + on-demand)** `est:30m`
  `ah-task-discuss` runs BEFORE `PLAN.md` exists, so it does NOT consume `context-needed:`. Delete the static table in §3 (lines 85-99) and replace with: 'INDEX.md is already injected at session start. Identify the doc stems needed to anchor gray-area questions to the codebase. Use `load_codebase_doc({name})` to read them on demand. Do not pre-load by category.' Keep the safe-default fallback ('if unsure, load `ARCHITETTURA` + `CONVENZIONI`') explicit, since discuss-quality is sensitive to weak LLM judgment on pathological inputs. Preserve §3 lead-in (TASK.md, DISCUSS.md) and the 'Non caricare PLAN.md, steps/, VERIFY.md' rule. The skill must NOT mention `context-needed:` as its source — by design (Q2=C puro) the PLAN frontmatter is for-plan-and-after only.
  - Files: `skills/ah-task-discuss/INSTRUCTIONS.md`
  - Verify: ! grep -E 'Tipo di task' skills/ah-task-discuss/INSTRUCTIONS.md >/dev/null && ! grep -E 'CONVENZIONI\.md.*STRUTTURA\.md' skills/ah-task-discuss/INSTRUCTIONS.md >/dev/null && grep -q 'load_codebase_doc' skills/ah-task-discuss/INSTRUCTIONS.md && grep -q 'INDEX.md' skills/ah-task-discuss/INSTRUCTIONS.md

- [ ] **T05: Add S02 verification test for PLAN.md frontmatter shape + cross-skill grep audit** `est:45m`
  Add `tests/s02-plan-context-needed.test.mts` that asserts two things: (1) given a fixture `PLAN.md` with `context-needed: [CONVENZIONI, STRUTTURA]` YAML frontmatter, a minimal parser (regex `/^---\n([\s\S]*?)\n---/` + line scan) extracts the two stems and each matches `^[a-zA-Z0-9_-]+$`; (2) an empty list `context-needed: []` parses to a zero-length array. The test runs via `node --experimental-strip-types --test` (same posture as `tests/s01-load-on-demand.test.mts`) — no package.json or external deps. The test doubles as documentation for the S03 parser. It does NOT import the skill files; it only exercises a stand-alone parser against in-memory fixtures (no filesystem writes outside the test's own temp scratch if needed). Slice closeout verifies: this test passes AND `grep -RE 'Tipo di (task|step)' skills/` returns 0 across all four skills AND each of the three rewritten skills (plan/execute/discuss) references `load_codebase_doc` AND ah-task-verify is untouched (sanity-grep for an unchanged sentinel string like 'Verify finale del task' to confirm).
  - Files: `tests/s02-plan-context-needed.test.mts`
  - Verify: node --experimental-strip-types --test tests/s02-plan-context-needed.test.mts 2>&1 | grep -E '# pass [1-9]' && [ "$(grep -RE 'Tipo di (task|step)' skills/ | wc -l)" = '0' ] && [ "$(grep -RE 'CONVENZIONI\.md.*STRUTTURA\.md' skills/ | wc -l)" = '0' ] && grep -q 'load_codebase_doc' skills/ah-task-plan/INSTRUCTIONS.md && grep -q 'load_codebase_doc' skills/ah-task-execute/INSTRUCTIONS.md && grep -q 'load_codebase_doc' skills/ah-task-discuss/INSTRUCTIONS.md

## Files Likely Touched

- task-layout.md
- skills/ah-task-plan/INSTRUCTIONS.md
- skills/ah-task-execute/INSTRUCTIONS.md
- skills/ah-task-discuss/INSTRUCTIONS.md
- tests/s02-plan-context-needed.test.mts
