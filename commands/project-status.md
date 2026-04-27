---
description: Progress bar del progetto e stato dei task in lavorazione
---

Sei l'agente del workflow SCRUM-lite di Efesto. Produci un report **conciso**
e **visuale** dello stato del progetto. Niente testo esplicativo, niente
suggerimenti, niente next steps.

## 🔒 Git Safety Rule
Solo letture. Nessuna modifica a file o git.

## Passi

1. **Scansiona `.pi/tasks/{backlog,in-progress,review,done}/T-*.md`**.
   Per ogni file estrai dal frontmatter: `id`, `title`, `status`, `estimate`,
   `assignee`, `branch`.

2. **Calcola avanzamento progetto**:
   - `total   = backlog + in-progress + review + done`
   - `closed  = done`
   - `active  = in-progress + review`
   - `pct_done = round(closed / total * 100)`  (0 se `total == 0`)

3. **Per ogni task in `in-progress/`**, calcola la % di DoD:
   - Leggi la sezione `## Definition of Done` del file.
   - Conta le checkbox `- [x]` e `- [ ]`.
   - `pct = round(checked / total_items * 100)` (0 se nessuna checkbox).

4. **Render** — usa esattamente questo formato, nient'altro:

   ```
   📊 Efesto — <oggi YYYY-MM-DD>

   Progetto  [██████░░░░░░░░░░░░░░]  30%   (3/10 done · 2 active · 5 backlog)

   In progress
     T-003  ███████░░░░░░  58%  Add web camera support            (toto, 4h)
     T-007  ██░░░░░░░░░░░  15%  Refactor cctv module              (marco, 6h)

   In review
     T-001  Fix alarm broadcast                                   (marco, 2h)
   ```

   Regole di rendering:
   - Progress bar del progetto: **20 caratteri** (`█` pieni, `░` vuoti).
   - Progress bar per task in-progress: **13 caratteri** (`█` / `░`).
   - Titolo troncato a 40 caratteri con `…` se eccede.
   - Assignee/estimate tra parentesi; se mancano mostra `-`.
   - Sezione "In review" senza barra: solo ID, titolo, (assignee, stima).
   - **Omettere** sezioni vuote (se nessun in-progress, non stampare il blocco
     "In progress"; idem review).
   - Se `total == 0`, stampa solo: `📊 Efesto — <oggi>  (nessun task)`.
   - **NON** aggiungere altro output: niente consigli, niente "next steps",
     niente leggenda, niente spiegazioni. Solo il blocco qui sopra.
