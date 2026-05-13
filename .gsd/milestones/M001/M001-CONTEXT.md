---
id: M001
status: active
updated: 2026-05-12
---

# M001: Consolidamento harness + calibrazione contesto LLM

## Vision

Agentic Harness (AH) è un'**estensione di PI.dev** (`@mariozechner/pi-coding-agent`) — solo skills + commands, niente CLI standalone — che fa girare un workflow SCRUM-lite (metafora di alto livello, niente cerimonie rigide) per sviluppo software con **agenti LLM e umani che convivono** sullo stesso repo. L'umano interviene per verificare e correggere il codice prodotto dagli agenti (HITL on-demand). Vincolo non negoziabile: **economia del contesto** spedito al LLM va calibrata al massimo, con qualità preservata.

## Scope confermato per M001

### In scope

1. **Consolidare le 4 skill del ciclo interno** (`ah-task-discuss`, `ah-task-plan`, `ah-task-execute`, `ah-task-verify`) — tutte e quattro, alzando robustezza e qualità degli output (`DISCUSS.md`, `PLAN.md` + `steps/*.md`, `VERIFY.md`). Eliminare la tabella duplicata `tipo task → doc da caricare` oggi presente in 3 skill.
2. **Calibrazione contesto al LLM — selezione on-demand, misurazione granulare, intervento differito.** Tre assi:
   - **Selezione on-demand (Q1=C):** rimuovere l'iniezione forzata della codebase map intera (`index.ts:119-159`); introdurre un `INDEX.md` compatto (path + 1-line summary per ogni doc in `.pi/codebase/`) e un meccanismo `load-codebase-doc(name)` che il LLM invoca esplicitamente.
   - **Sorgente unica per-task (Q2=C puro):** `task-plan` produce `context-needed: [...]` nel `PLAN.md`. Le altre skill (`discuss`/`execute`/`verify`) leggono solo da lì. Niente frontmatter `context-hint` in `TASK.md`. Granularità per-fase resta gestita dalle skill stesse.
   - **Inspector osservatore + decisore separato (Q3=A):** Context Inspector logga `dichiarato` (da PLAN) vs `effettivo` (chiamate `load-codebase-doc` registrate). Nessun intervento in-flight nel prompt. Un report di fine-task — ospitato in `task-verify` o nel summary — confronta i due e segnala over/under-load. Misurazione e decisione restano disaccoppiate.
3. **Human-in-the-loop esplicito** — verifiche e interventi umani al codice non frizionati. Niente coordinamento multi-agente concorrente.

### Out of scope / deferred

- Coordinamento multi-agente in parallelo (lock, ownership, branch policy).
- Cerimonie SCRUM rigide (sprint, retro, ruoli PO/SM).
- Target numerico di riduzione token — direzione qualitativa, non KPI.
- Intervento in-flight dell'Inspector (warning/block durante il run). Rivalutabile in una milestone futura dopo aver raccolto dati con la versione osservatore.
- Pipeline di eventi/politiche pluggabili per l'Inspector (over-engineering finché non ci sono ≥2 politiche concrete da supportare).

## Stato corrente del codice (osservato)

- TypeScript, entry `index.ts`, registra commands `ah:*` e Context Inspector.
- Hook usati: `session_start`, `before_agent_start`, `before_provider_request`, `after_provider_response`, `message_end`, `turn_end`.
- `index.ts:119-159`: codebase map (`.pi/codebase/*.md`) iniettata **intera, una volta a sessione**. Commento esplicito (linee 110-115) prevede già "task-scoped context selection on top of it" — direzione confermata da Q1=C.
- `index.ts:162-191`: task corrente (da `feature/T-NNN-*` branch) iniettato a ogni turno con frontmatter di `TASK.md`. Resta com'è; il body del task non viene iniettato e questo va bene (lo legge la skill).
- `context-inspector.ts`: osservatorio puro. Logga `requests.ndjson`, `usage.ndjson`, `summary.json`. Comandi `/ah:ctx-stats|open|tail`. `before_provider_request` ritorna sempre `undefined`. Coerente con Q3=A — va esteso, non snaturato.
- 4 skill condividono lo scheletro: auto-detect task, check `.pi/codebase/`, **tabella duplicata** `tipo task → doc da caricare` (UI/API/DB/Testing/Integrazione/Refactor/Setup). Da rimuovere: la selezione vive nel PLAN, non in una tabella ripetuta.

## Decisioni chiave (riferimento veloce)

| ID | Tema | Scelta |
|---|---|---|
| D-Q1 | Dove vive la selezione contesto | **C** — `INDEX.md` + `load-codebase-doc(name)` on-demand |
| D-Q2 | Cosa determina il per-task | **C puro** — `PLAN.md` autorità unica, niente frontmatter in TASK.md |
| D-Q3 | Evoluzione Inspector | **A** — osservatore + decisore separato a fine-task, nessun intervento in-flight |

Coerenza incrociata: Q1 produce gli eventi `load-codebase-doc`, Q2 produce la baseline `context-needed`, Q3 li confronta a posteriori. Nessuna decisione accoppia misurazione a decisione.

## Successo

- Le 4 skill non duplicano più la tabella tipo-task→doc.
- L'injection forzata della codebase map in `index.ts` è rimossa o ridotta al solo `INDEX.md`.
- `PLAN.md` contiene `context-needed: [...]` deciso da `task-plan`.
- Un task eseguito end-to-end produce in `VERIFY.md` (o nel summary) un report `dichiarato vs effettivo` con delta token leggibile.
- Le 4 skill girano su un task reale senza dover ri-leggere doc già caricati né caricare doc non in `context-needed`.
