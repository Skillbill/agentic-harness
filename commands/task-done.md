---
description: Chiude un task (PR mergiata) spostandolo in done/ e committando su main
argument-hint: "<task-id>"
---

Sei l'agente del workflow SCRUM-lite del progetto. Il dev ha visto la PR
mergiata su `main` e vuole chiudere il task: lo sposti da `review/` (o
direttamente da `in-progress/` se non è passato per la review) a `done/`,
aggiorni il front-matter e committi su `main`.

**Task da chiudere:** $@

## 🔒 Eccezione esplicita alla Git Safety Rule

Questo comando **è autorizzato** a eseguire operazioni git mutanti, solo:

- `git mv` del file del task da `review/` (o `in-progress/`) a `done/`
- `git add` del file del task
- `git commit -m "chore(<ID>): mark task as done"`
- `git push`

Niente branch, niente altri file, niente `--force`. Vedi `AGENTS.md` →
*Git Safety Rule*.

## Passi

1. **Normalizza l'ID e trova il task**:
   - Normalizza `$1` a `T-NNN` (es. `T001`, `t1`, `1` → `T-001`).
   - Se manca → errore: «Uso: `/task-done <task-id>`».
   - Cerca il file in quest'ordine di priorità:
     1. `.pi/tasks/review/<ID>-*.md` → percorso "normale" (post-PR).
     2. `.pi/tasks/in-progress/<ID>-*.md` → accettato con warning
        ("task chiuso senza passare dallo stato review").
     3. `.pi/tasks/done/<ID>-*.md` → STOP: già chiuso, niente da fare.
     4. `.pi/tasks/backlog/<ID>-*.md` → errore (workflow violato:
        «non puoi chiudere un task che non è mai stato avviato»).
     5. Non trovato da nessuna parte → errore con elenco degli ID esistenti.

2. **Verifica preconditions** (bloccanti):
   - `git branch --show-current` deve essere `main`. Se no → STOP:
     «Per chiudere il task serve essere su `main`. Fai
     `git switch main && git pull`, poi rilancia `/task-done <ID>`.»
   - `git status --porcelain` deve essere pulito **per il file del task**.
     Altri file modificati/untracked non bloccano (ma il comando farà
     `git add` SOLO sul file del task).

3. **Verifica che la PR sia davvero mergiata** (best-effort, non bloccante):
   - Leggi il campo `branch:` dal front-matter del task.
   - Se `gh` CLI è disponibile (`command -v gh`), prova:
     `gh pr list --state merged --head <branch> --json number,mergedAt --limit 1`
     e mostra il risultato al dev.
   - Se la PR non risulta mergiata (o `gh` non c'è), **non bloccare**: chiedi
     conferma esplicita al dev con: «Non riesco a verificare che la PR sia
     mergiata. Confermi di aver mergiato e di voler chiudere il task?
     [sì/no]». Se `no` → esci senza toccare nulla.

4. **Calcola completion rate della DoD** (informativo):
   - Leggi la sezione `## Definition of Done` del task.
   - Conta checkbox `- [x]` vs totale.
   - Serve solo per l'output finale; non blocca se non è 100%.

5. **Aggiorna il front-matter del task** (via `edit`) mentre il file è
   ancora in `review/` (o `in-progress/`):
   - `status: done`
   - `progress: 100` (se la chiave esiste, o aggiungila sotto `estimate:`)
   - `updated: <YYYY-MM-DD>` (oggi, via `date +%Y-%m-%d`)

6. **Sposta il file** con `git mv` da `review/` (o `in-progress/`) a `done/`,
   preservando il filename.

7. **Commit e push su `main`** (SOLO il file del task):

   ```
   git add <vecchio-path> <nuovo-path>   # copre il rename
   git commit -m "chore(<ID>): mark task as done"
   git push
   ```

   Se il push fallisce per `non-fast-forward`:
   - NON fare `git pull --rebase` in automatico.
   - Avvisa il dev: «`main` è avanzato sul remote. Esegui `git pull --rebase`
     a mano, poi rilancia `/task-done`.»

8. **Output finale — conciso** (4 righe):

   ```
   ✅ <ID> chiuso — <title>
      DoD: <N_checked>/<N_total> spuntate
      file: .pi/tasks/done/<ID>-<slug>.md
      commit: <short-sha> su main (pushed)
   ```

   Se DoD < 100% aggiungi UNA riga di warning opzionale:
   ```
      ⚠ Alcune voci DoD non sono spuntate — review il file se intenzionale.
   ```

   Niente tabelle, niente next steps, niente ripetizione dei comandi.

## Note operative

- **`/task-done` non elimina il branch di feature**: è responsabilità del dev
  (tipicamente GitHub lo fa auto-delete al merge). Se resta locale:
  `git branch -d feature/<ID>-*`.
- **Se il task era saltato dallo stato review** (chiuso direttamente da
  in-progress), va bene: succede per task piccoli o hotfix. Il comando
  aggiunge una riga al log del task con nota
  `skipped review (closed directly from in-progress)`.
- **DoD incompleta**: il comando NON blocca. È responsabilità del dev (e del
  reviewer della PR) decidere se le voci non spuntate sono accettabili
  (es. `N/A per Python`) o se il task va riaperto.
