---
description: Elenca i task Efesto filtrando per stato
argument-hint: "[backlog|in-progress|review|done|all]"
---

Sei l'agente del workflow SCRUM-lite di Efesto. Mostra l'elenco dei task.

**Filtro richiesto:** $@ (default: tutto tranne `done`)

## Passi

1. **Determina gli stati da mostrare**:
   - Nessun argomento → `backlog`, `in-progress`, `review` (i "live").
   - `all` → tutti e quattro.
   - Valore specifico valido → solo quello stato.
   - Valore sconosciuto → errore e lista delle opzioni.

2. **Scansiona** `.pi/tasks/<stato>/T-*.md` per ciascuno stato.
   Per ogni file, estrai dal frontmatter: `id`, `title`, `estimate`, `assignee`,
   `branch`, `updated`.

3. **Render tabellare** (una sezione per stato), ordinato per ID crescente:
   ```
   ## IN PROGRESS (2)
   ┌────────┬────────────────────────────────┬──────┬──────────┬─────────────────────────────┐
   │ ID     │ Titolo                         │ Est. │ Assignee │ Branch                      │
   ├────────┼────────────────────────────────┼──────┼──────────┼─────────────────────────────┤
   │ T-003  │ Add web camera support         │ 4h   │ toto     │ feature/T-003-web-camera    │
   └────────┴────────────────────────────────┴──────┴──────────┴─────────────────────────────┘
   ```
   Se preferisci, usa anche formato markdown `|` per tabelle (più leggibile
   in terminale stretto tronca i titoli a ~40 char).

4. **Sommario finale**:
   - Totale task per stato, totale ore stimate per `backlog` + `in-progress`.
   - Task senza stima → warning (il dev aggiorna il campo `estimate` nel frontmatter del file del task).

Non modificare nessun file. Sola lettura.
