# S02: context-needed in PLAN.md + skill deduplication — Research

**Date:** 2026-05-12

## Summary

S02 builds on S01's foundation (compact INDEX + `load_codebase_doc` tool) by making **per-task context selection explicit and parseable**. Today three of the four inner-cycle skills (`ah-task-discuss`, `ah-task-plan`, `ah-task-execute`) each carry an **identical** static `tipo-task → doc` lookup table; the fourth, `ah-task-verify`, does **not** carry that table (so the milestone roadmap line "deduplica delle 4 skill" is slightly off — it's three skills + `task-layout.md` §2 as the design-doc source). The work is two-faced: (1) introduce a parseable `context-needed:` declaration in `PLAN.md` written by `ah-task-plan`, so downstream phases consume it instead of re-deriving via a duplicated table; (2) strip the duplicated table from the three skills and rewrite their "load codebase docs" sections to instead read `PLAN.md`'s declaration (for `execute`) or fall through to LLM judgment over INDEX.md (for `discuss`, which runs *before* `plan` exists).

The recommended syntax is **YAML frontmatter at the top of `PLAN.md`** with a single `context-needed: [name1, name2, ...]` key, where each entry is a doc *stem* (no `.md`, matching `load_codebase_doc`'s `name` parameter regex `^[a-zA-Z0-9_-]+$`). This format is trivially parseable by S03's Inspector with any YAML library, doesn't pollute the human-readable body, and composes with future metadata. The slice does NOT touch `ah-task-verify` (no table to remove there) and does NOT touch `register-prompt.ts` or `context-inspector.ts` (S03's territory).

There is one structural asymmetry to call out for the planner: `ah-task-discuss` runs **before** `PLAN.md` exists, so it cannot consume `context-needed:` from a PLAN that hasn't been written. The cleanest fallback is to have `discuss` rely on the LLM choosing docs on-demand via `load_codebase_doc` against the already-injected INDEX (no table, no PLAN read) — this aligns with M001's Q1=C decision (on-demand selection).

## Recommendation

**Adopt YAML frontmatter for `context-needed:` in `PLAN.md`.** Concrete shape:

```yaml
---
context-needed:
  - CONVENZIONI
  - STRUTTURA
---

# Plan — T-NNN

> Ultimo aggiornamento: YYYY-MM-DD

## Strategia
...
```

- Entries are **stems** (no `.md`), so they match `load_codebase_doc({name})` 1:1 and avoid the "is it `STRUTTURA` or `STRUTTURA.md`?" ambiguity. The on-disk INDEX format is `<relPath>: <summary>` (e.g. `- STRUTTURA.md: …`); `ah-task-plan` strips `.md` when emitting the declaration.
- An **empty list** (`context-needed: []`) is legal and explicit ("this task plans without codebase context"). Different from omission, which S03 should treat as "declared = ∅" too — but the skill must always emit the key.
- S03 parses the frontmatter as the canonical `declared:` source.

**Skill changes:**

- `ah-task-plan` — delete the §3-codebase table (lines 112-129) and §3 instructions to load docs by table lookup. Replace with: "Read INDEX.md (already injected), pick the docs you need to *plan*, load them via `load_codebase_doc`, then write the chosen names into PLAN.md frontmatter as `context-needed:`." Keep §3-bis (load referenced code files) untouched. Update §8b (PLAN.md template) to show the frontmatter.
- `ah-task-execute` — delete the §4-codebase table (lines 136-160 includes table + "Usa questi documenti per …" prose). Replace with: "Read `PLAN.md` frontmatter → `context-needed: [...]`. For each entry, call `load_codebase_doc({name})`. Do not load any other codebase doc." Keep §4 (load TASK/PLAN/step) and §4-bis (load referenced code files) untouched. The "contraddizione → segui lo step" rule moves to a one-liner: "If a loaded doc contradicts the step, follow the step."
- `ah-task-discuss` — delete the §3 table (lines 85-99). Replace with: "INDEX.md is already injected. Identify the doc(s) you need to anchor gray-area questions to the codebase. Use `load_codebase_doc` to read them on demand. Do not pre-load by category." `PLAN.md` does not exist yet, so `context-needed` is *not* the source.
- `ah-task-verify` — **no changes** (no duplicated table there; the path→component table on lines 129-140 is a separate, unrelated mapping).
- `task-layout.md` §2 (lines 71-86) — the table at the design-doc level: rewrite §2.2 "Caricamento selettivo" to describe the new mechanism (INDEX + `load_codebase_doc` + `PLAN.md context-needed:`) and remove the static table. This keeps the contract doc and the skills in sync.

## Implementation Landscape

### Key Files

- `skills/ah-task-plan/INSTRUCTIONS.md` — §3-codebase (lines 112-129) holds the table; §8b (lines 280-308) defines the PLAN.md template. Both must change. Add a new bullet in §5 ("propose decomposition") prompting the LLM to also pick `context-needed:` names from INDEX. The skill becomes the **only** place that decides per-task context.
- `skills/ah-task-execute/INSTRUCTIONS.md` — §4-codebase (lines 136-164) holds the table + per-doc usage prose. Replace with "read PLAN.md frontmatter → loop `load_codebase_doc`." The "precedenza dello step sulla mappa" rule stays as a one-liner.
- `skills/ah-task-discuss/INSTRUCTIONS.md` — §3 (lines 85-103) holds the table. Replace with "use INDEX + `load_codebase_doc` on demand." Note `PLAN.md` is **not** consumed here.
- `skills/ah-task-verify/INSTRUCTIONS.md` — **untouched**. Confirm via grep: no `tipo di task`, no `CONVENZIONI.md / STRUTTURA.md` mapping.
- `task-layout.md` — §2.2 "Caricamento selettivo" (lines 71-86) holds the design-doc copy of the table. Rewrite to describe `context-needed:` + on-demand loading. §3.3 PLAN.md template (lines 171-194) needs the frontmatter added.
- `load-codebase-doc.ts:6` — `NAME_PATTERN = /^[a-zA-Z0-9_-]+$/` is the canonical name shape. `context-needed` entries MUST match this regex (S03 will likely validate too).
- `codebase-index.ts:64-77` — INDEX message format uses `- <relPath>: <summary>` with `.md` suffix. `ah-task-plan` strips `.md` to derive `context-needed` stems.

**No code changes** in this slice. Pure prompt / contract changes in markdown files. `index.ts`, `context-inspector.ts`, `register-prompt.ts` are out of scope.

### Build Order

1. **Lock the syntax decision first.** Write the frontmatter spec into `task-layout.md` §3.3 PLAN.md (template + parse rule + stem-not-filename rule + empty-list semantics). This unblocks both the skill rewrites and S03's parser. Without this, the three skill rewrites could drift on shape.
2. **Rewrite `ah-task-plan` second.** It's the *producer* of the new declaration. Until plan emits `context-needed:`, `execute` has nothing to consume. Update §3-codebase (delete table), §5 (add "pick context-needed names" sub-step), §8b (add frontmatter to template).
3. **Rewrite `ah-task-execute` third.** It's the primary *consumer*. Update §4-codebase (delete table, replace with PLAN frontmatter read + loop). The execute change validates that the plan output shape is usable.
4. **Rewrite `ah-task-discuss` fourth.** It has no PLAN to consume; just delete the table and lean on INDEX + on-demand loading. No coupling to plan output — order is convenience, not necessity.
5. **Update `task-layout.md` §2.2 last.** It's a design-doc; rewrite it to reflect the actual mechanism after the skills have settled. Doing it last avoids needing to revise it as the skill rewrites surface details.

The "first proof" is step 2 producing a PLAN.md with parseable frontmatter that an external command (`grep -A 5 'context-needed:' PLAN.md` or a small node one-liner) can read. That single artifact is the deliverable that unblocks S03.

### Verification Approach

- **No duplicated table:** `grep -RE 'Tipo di (task|step)' skills/` returns 0 matches. `grep -RE 'CONVENZIONI\.md.*STRUTTURA\.md' skills/` returns 0 matches (the path-prefix table in `verify` doesn't trip this — it uses `server/`, `hmi/`, not the codebase doc names).
- **`context-needed` in PLAN template:** `grep -q 'context-needed' skills/ah-task-plan/INSTRUCTIONS.md` and `grep -q 'context-needed' task-layout.md` both succeed.
- **End-to-end smoke (manual):** in a sandbox task directory, hand-run the plan skill's §8b template against a synthetic TASK.md, write a PLAN.md, then verify the frontmatter parses with a node one-liner: `node -e "const m = require('fs').readFileSync('PLAN.md','utf8'); console.log(m.match(/^---\\n([\\s\\S]*?)\\n---/)[1])"`. Confirm names match `^[a-zA-Z0-9_-]+$`.
- **Cross-skill consistency:** `grep -c 'load_codebase_doc' skills/ah-task-*/INSTRUCTIONS.md` shows each of the three rewritten skills references the tool at least once.

A scripted unit test is **possible** but probably overkill for prompt edits. Consider a small `tests/s02-plan-context-needed.test.mts` that takes a fixture PLAN.md, parses the frontmatter with a minimal YAML parser (or regex), and asserts the shape — useful as documentation for S03's parser too.

## Constraints

- `load_codebase_doc` name regex is **fixed** (`^[a-zA-Z0-9_-]+$`, no dots, no path seps). `context-needed` entries must conform.
- The slice **does not** change any TypeScript or hook code. S01 already installed the runtime; S02 is a prompts/docs slice. Resist scope creep into `register-prompt.ts` or `context-inspector.ts` (S03 will extend the latter for the `loaded` list).
- `ah-task-discuss` runs *before* `PLAN.md` exists. Don't fabricate a `context-needed:` source for it — accept that discuss uses INDEX + on-demand judgment, and that this asymmetry is by design (Q2=C puro: PLAN is authority **for-plan-and-after**, not for discuss).
- The worktree has no `package.json`/`node_modules`; if a verification test is added, it must run under `node --experimental-strip-types --test` (same posture as `tests/s01-load-on-demand.test.mts`).
- Italian-language prompts: keep the rewrites in Italian to match surrounding tone (`Carica selettivamente`, `Procedi con la pianificazione`, etc.). Do not introduce English-only headings.

## Common Pitfalls

- **Stem vs filename drift** — easy to write `context-needed: [CONVENZIONI.md]` by accident. Spec the stem rule explicitly in `task-layout.md` §3.3 with a worked example *and* a counter-example (`# wrong: CONVENZIONI.md  # right: CONVENZIONI`). Also make `ah-task-plan` §5 say "strip `.md` from INDEX entries when emitting context-needed."
- **Missing key vs empty list** — S03 will parse both. Make the skill always emit `context-needed:` (with `[]` if truly nothing). Empty omission risks ambiguity ("did the LLM forget?" vs "intentionally no context").
- **Re-run / replan semantics** — `ah-task-plan` already handles replan (archive non-done steps, continue numbering). The replan path must also rewrite `context-needed:` from scratch — completed steps shouldn't pin the context list. Add a one-liner to §7 ("Replan: also recompute context-needed from current TASK.md + DISCUSS.md state").
- **`ah-task-execute` reading PLAN before INDEX** — the skill must NOT also load by table heuristic when `context-needed: []`. Trust the declaration. If the LLM realizes mid-execute it needs more, the §4-bis "load referenced code files" loophole already covers ad-hoc code reads; if it needs *another codebase doc*, that's a planning gap → log in `## Log` and consider replan (don't silently load).
- **`task-layout.md` §2 keeps two stale tables** — the rewrite must remove §2.2 "Caricamento selettivo" entirely (or replace with a single sentence + pointer to PLAN.md's frontmatter). Leaving the table in the contract doc would re-seed the duplication in future skill rewrites.
- **Quoting the slice deliverable to S03** — S03 needs (a) the frontmatter format spec and (b) a known parse path. Make `task-layout.md` §3.3 the canonical spec so S03 doesn't have to read three skills to recover it.

## Open Risks

- **`ah-task-discuss` quality might dip.** Removing the table means the skill leans on LLM judgment over INDEX summaries. For pathological tasks (very short TASK.md, very dense codebase), the LLM may pick wrong docs. Mitigation: the skill instruction says "if unsure, load `ARCHITETTURA` + `CONVENZIONI` as safe default" — keep that fallback explicit in the rewritten §3.
- **S03 dependency on naming convention.** S03 will diff `declared` (stems from PLAN frontmatter) vs `loaded` (tool-use events for `load_codebase_doc`). The tool args also use stems (it accepts `name` without `.md`), so the comparison is direct. If S03 ever wanted to compare against on-disk paths (e.g. `STRUTTURA.md`), it'd need to re-append `.md`. Worth noting in the S03 → S04 boundary refresh.
- **Italian-vs-English keys.** `context-needed:` is English while surrounding doc names are Italian (`STRUTTURA`, `CRITICITA`). This is fine — the key is a machine-readable identifier, the values are data. But a future-Italian-purist might want `contesto-richiesto:`. Lock now: English `context-needed:`, document the choice in the spec.
- **Roadmap line mismatch.** "deduplica delle 4 skill" — only 3 skills actually carry the table; `ah-task-verify` doesn't. The slice deliverable verification should grep all four and confirm `verify` is clean, not silently skip it. Update the slice After-this in the roadmap or note the discrepancy in S02 SUMMARY.

## Sources

- M001 Roadmap & Context (preloaded in this turn) — confirms Q1=C, Q2=C puro, Q3=A and `context-needed:` as the per-task authority.
- S01 SUMMARY (preloaded) — confirms `load_codebase_doc` tool surface (`{name: string}`, regex `^[a-zA-Z0-9_-]+$`), INDEX.md format (`<relPath>: <summary>`), and that the Inspector at `context-inspector.ts:217-237` already captures tool_use events (S03 leverage point, not S02).
- `task-layout.md` §2 (lines 71-86) and §3.3 (lines 171-194) — the current contract doc, which needs co-evolution with the skill rewrites.
- `load-codebase-doc.ts:6,12-36` — canonical name regex and containment check (immutable input contract for `context-needed` values).
- `codebase-index.ts:64-77` — INDEX message format (`- <relPath>: <summary>`), confirming the stem-stripping requirement when emitting `context-needed`.
