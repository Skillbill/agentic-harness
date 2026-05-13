# M001: Consolidamento harness + calibrazione contesto LLM

**Vision:** Le 4 skill del ciclo interno (discuss/plan/execute/verify) sono consolidate senza duplicazioni e la selezione di contesto è on-demand: il LLM riceve un INDEX compatto e carica esplicitamente solo i doc dichiarati nel PLAN.md, con il Context Inspector che osserva dichiarato vs effettivo e produce un report di fine-task in VERIFY.md.

## Success Criteria

- Le 4 skill non duplicano più la tabella tipo-task→doc — esiste una sola fonte (il PLAN.md prodotto da task-plan).
- L'injection forzata della codebase map in index.ts:119-159 è rimossa: il prompt iniziale contiene solo .pi/codebase/INDEX.md (o equivalente compatto).
- Un task reale completato end-to-end produce un PLAN.md che contiene context-needed: [...] deciso da task-plan.
- Lo stesso task produce in VERIFY.md una sezione 'Context audit' con dichiarato vs effettivo + delta token, leggibile a colpo d'occhio.
- Le 4 skill girano sul task senza ri-leggere doc già caricati e senza caricare doc non in context-needed.

## Slices

- [ ] **S01: INDEX + load on-demand (foundation)** `risk:high` `depends:[]`
  > After this: In una sessione PI reale, il prompt iniziale non contiene più .pi/codebase/*.md interi; il LLM invoca /ah:load-codebase-doc convenzioni e riceve il contenuto di convenzioni.md; le 4 skill esistenti riescono comunque a procedere usando il nuovo meccanismo.

- [ ] **S02: context-needed in PLAN.md + deduplica delle 4 skill** `risk:medium` `depends:[S01]`
  > After this: Un task reale viene pianificato da task-plan: il PLAN.md risultante contiene un blocco context-needed: [convenzioni, struttura]; le fasi successive (discuss/execute/verify) caricano esattamente quei doc — niente di più, niente di meno; un grep nelle 4 skill non trova più la tabella tipo-task→doc duplicata.

- [ ] **S03: Inspector: dichiarato vs effettivo** `risk:low` `depends:[S01,S02]`
  > After this: Dopo l'esecuzione di un task reale, /ah:ctx-stats riporta: declared: [a, b, c], loaded: [a, b], delta_token: <numero>, e segnala l'over/under-load qualitativo (es. 'loaded ⊊ declared').

- [ ] **S04: Report fine-task 'Context audit' in VERIFY.md** `risk:low` `depends:[S03]`
  > After this: Un task completato end-to-end produce un VERIFY.md la cui sezione 'Context audit' mostra in formato tabellare/lista declared, loaded, delta_token, e una sintesi ('on-budget' / 'over-load' / 'under-load') ricavata dal confronto.

## Boundary Map

### S01 → S02

Produces:
- `.pi/codebase/INDEX.md` con formato `<path>: <one-line summary>` (parseabile)
- Slash-command/tool `load-codebase-doc(name)` registrato nell'estensione e invocabile dal LLM
- Hook `before_agent_start` riformulato: non inietta più `.pi/codebase/*.md` interi

Consumes:
- nothing (slice di foundation)

### S01 → S03

Produces:
- Eventi `load-codebase-doc(name)` emessi a runtime dal command/tool, intercettabili da hook esistenti dell'Inspector (`before_provider_request` o `message_end`)

Consumes:
- nothing (lato S01)

### S02 → S03

Produces:
- Blocco `context-needed: [doc-a, doc-b]` nel `PLAN.md` con sintassi parseabile (YAML list o frontmatter dedicato — decisione di S02)
- Le 4 skill non contengono più la tabella tipo-task→doc

Consumes:
- `INDEX.md` (da S01) per derivare i nomi validi dei doc
- `load-codebase-doc` (da S01) come unico meccanismo di accesso ai doc

### S03 → S04

Produces:
- `summary.json` con campi `declared: [...]`, `loaded: [...]`, `delta_token: <n>`
- `requests.ndjson` con eventi `load-codebase-doc` taggati per task

Consumes:
- `context-needed` dal PLAN.md (da S02) come fonte del `declared`
- Eventi `load-codebase-doc` (da S01) come fonte del `loaded`
