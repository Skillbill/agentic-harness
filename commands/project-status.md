---
description: Progress bar del progetto e stato dei task in lavorazione
---

Sei l'agente del workflow SCRUM-lite del progetto. Produci un report **conciso**
e **visuale** dello stato del progetto. Niente testo esplicativo, niente
suggerimenti, niente next steps.

## 🔒 Git Safety Rule
Solo letture. Nessuna modifica a file o git.

## Passi

1. **Scansiona `.pi/tasks/{backlog,in-progress,review,done}/T-*/TASK.md`**.
   Per ogni file estrai dal frontmatter: `id`, `title`, `status`, `estimate`,
   `assignee`, `branch`.

2. **Calcola avanzamento progetto**:
   - `total   = backlog + in-progress + review + done`
   - `closed  = done`
   - `active  = in-progress + review`
   - `pct_done = round(closed / total * 100)`  (0 se `total == 0`)

3. **Per ogni task in `in-progress/`**, determina % e fase:

   **Solo per il current task** (quello sul branch git corrente) esegui
   l'ispezione completa:

   a. **% di DoD**:
      - Leggi la sezione `## Definition of Done` del TASK.md.
      - Conta le checkbox `- [x]` e `- [ ]`.
      - `pct = round(checked / total_items * 100)` (0 se nessuna checkbox).

   b. **Fase del ciclo interno** — controlla gli artefatti nella directory
      del task (`.pi/tasks/in-progress/T-NNN-<slug>/`):
      - `DISCUSS.md` non esiste → `discuss`
      - `PLAN.md` non esiste → `plan`
      - `steps/` vuoto o assente → `plan`
      - Almeno uno step non è `done` → `execute` (mostra `done/totale`)
      - `VERIFY.md` non esiste → `verify`
      - Tutto completo → `✔ ready`

   **Per gli altri task in-progress** (non current): fidati del frontmatter.
   - `pct` = campo `progress` dal frontmatter (se `null` o assente → `0`).
   - Fase = non ispezionare artefatti; mostra `[-]` (stato non verificato).

4. **Render** — usa esattamente questo formato, nient'altro:

   ```
   📊 Project — <oggi YYYY-MM-DD>        🎯 T-003 Add web camera support

   Progetto  [██████░░░░░░░░░░░░░░]  30%   (3/10 done · 2 active · 5 backlog)

   In progress
   ▶ T-003  ███████░░░░░░  58%  Add web camera support            (toto, 4h)  [execute 3/5]
     T-007  ██░░░░░░░░░░░  15%  Refactor cctv module              (marco, 6h) [discuss]

   In review
     T-001  Fix alarm broadcast                                   (marco, 2h)

   Backlog
     T-010  Integrate thermal cameras                             (-, -)
     T-011  DTS module setup                                      (-, 8h)
   ```

   Regole di rendering:
   - **Current task**: rileva il task corrente dal branch git (`feature/T-NNN-…`).
     Se trovato, mostralo nell'header dopo la data: `🎯 T-NNN <titolo>`.
     Nel blocco "In progress", il task corrente ha il prefisso `▶` invece di ` `.
     Se non c'è un task corrente (non su branch feature/), ometti `🎯` dall'header.
   - Progress bar del progetto: **20 caratteri** (`█` pieni, `░` vuoti).
   - Progress bar per task in-progress: **13 caratteri** (`█` / `░`).
   - Titolo troncato a 40 caratteri con `…` se eccede.
   - Assignee/estimate tra parentesi; se mancano mostra `-`.
   - **Fase ciclo interno**: per ogni task in-progress, mostra la fase tra
     parentesi quadre dopo `(assignee, stima)`. Formato: `[discuss]`,
     `[plan]`, `[execute N/M]` (step done/totale), `[verify]`, `[✔ ready]`.
   - Sezione "In review" senza barra: solo ID, titolo, (assignee, stima).
   - **Sezione "Backlog"**: elenca tutti i task in `backlog/` senza barra
     di progresso. Formato: solo ID, titolo troncato, (assignee, stima).
   - **Omettere** sezioni vuote (se nessun in-progress, non stampare il blocco
     "In progress"; idem review, idem backlog).
   - Se `total == 0`, stampa solo: `📊 Project — <oggi>  (nessun task)`.
   - **NON** aggiungere altro output: niente consigli, niente "next steps",
     niente leggenda, niente spiegazioni. Solo il blocco qui sopra.
