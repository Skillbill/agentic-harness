---
description: Prendi in carico un task Efesto, crea il branch di feature e pusha
argument-hint: "<task-id>"
---

Sei l'agente del workflow SCRUM-lite di Efesto. Il dev vuole prendere in carico
un task: aggiorni il frontmatter, sposti il file in `in-progress/`, committi su
`main`, crei il branch di feature e lo pushi sul remote.

**Task da avviare:** $@

## 🔒 Eccezione esplicita alla Git Safety Rule

Questo comando **è autorizzato** a eseguire operazioni git mutanti —
limitatamente ai comandi elencati qui sotto. Fuori da questo scope vale la
regola globale (no commit/push/branch/checkout). Vedi anche `AGENTS.md` →
*Git Safety Rule*.

## Passi

1. **Normalizza l'ID e trova il task**:
   - Normalizza `$1` a `T-NNN` (es. `T001`, `t1`, `1` → `T-001`).
   - Se manca, errore.
   - Cerca il file in `.pi/tasks/backlog/<ID>-*.md`.
   - Se è già in `in-progress/` → avvisa ed esci (già avviato).
   - Se è in `review/` o `done/` → errore (workflow violato).
   - Se non esiste da nessuna parte → errore.

2. **Verifica preconditions** (read-only, e **bloccanti**):
   - `git branch --show-current` deve essere `main`. Se no → STOP: mostra
     «Sei su `<branch>`. Fai prima `git switch main && git pull`, poi rilancia
     `/task-start`».
   - `git status --porcelain` deve essere **vuoto**. Se no → STOP: mostra
     «Working tree non pulito. Committa o stasha prima di avviare il task».
   - Se una di queste fallisce, NON procedere oltre.

3. **Verifica stima (bloccante)**:
   - Leggi il frontmatter. Se `estimate` è `null` o assente, **chiedi al dev
     la stima in ore**: «Il task T-NNN non è stimato. Dammi la stima in ore
     (es. `4h`) oppure scrivi `annulla` per fermarti».
   - Aspetta la risposta. Se `annulla` → esci senza toccare nulla.
   - Se ricevi un valore (es. `4h`, `2.5h`, `8`), normalizzalo a `<N>h` e
     usalo nel passo successivo.

4. **Determina username** per `assignee`:
   - `git config --get user.email`: prendi la parte prima di `@`, lowercase
     → es. `paolo.infante@skillbill.it` → `paolo.infante`.
   - Fallback: `git config --get user.name` lowercase, spazi → `.`.

5. **Costruisci il nome del branch**:
   - `feature/<ID>-<slug>` (slug = stesso suffisso del filename del task).

6. **Esegui il workflow git** (in ordine, fermandoti al primo errore):

   a. **Aggiorna il frontmatter del task** (con `edit`) mentre è ancora in
      `backlog/`:
      - `status: in-progress`
      - `estimate: <N>h` (solo se era null ed è stata raccolta al passo 3)
      - `assignee: <username>`
      - `branch: feature/<ID>-<slug>`
      - `updated: <YYYY-MM-DD>` (oggi, via `date +%Y-%m-%d`)

   b. **Sposta il file** con `git mv` da `backlog/` a `in-progress/`.

   c. **Commit su `main`**:
      ```
      git add -A
      git commit -m "chore(<ID>): start task — <title>"
      ```

   d. **Pusha `main`** (lo stato del task deve essere visibile al team):
      ```
      git push
      ```
      Se il push fallisce per `non-fast-forward`, STOP: avvisa il dev che
      `main` è avanzato sul remote e va riallineato manualmente (`git pull
      --rebase`) prima di ripartire; ripristina il file nel `backlog/` se
      necessario.

   e. **Crea e pusha il branch di feature**:
      ```
      git switch -c feature/<ID>-<slug>
      git push -u origin feature/<ID>-<slug>
      ```

7. **Output finale — conciso**:

   Stampa *solo* questo blocco, niente tabelle di preconditions né
   ripetizione dei comandi:

   ```
   ▶ T-<ID> avviato — <title>
     stima: <N>h · assignee: <username>
     branch: feature/<ID>-<slug> (pushed)
     file:   .pi/tasks/in-progress/<ID>-<slug>.md
   ```

   Se qualcosa è andato storto a metà strada, mostra invece un riepilogo
   chiaro dello stato (cosa è stato fatto, cosa no, come recuperare).
