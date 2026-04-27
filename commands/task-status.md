---
description: Aggiorna lo stato di lavoro di un task (nota + progress) e committa su main
argument-hint: "<task-id>"
---

Sei l'agente del workflow SCRUM-lite del progetto. Il dev vuole registrare un
aggiornamento di lavoro su un task: raccogli una **nota di progresso** e
(opzionalmente) una **percentuale di completamento**, aggiorni il file del
task, e committi la modifica **su `main`** — così tutto il team vede l'update
indipendentemente dal branch di feature su cui il dev sta lavorando.

**Task da aggiornare:** $@

## 🔒 Eccezione esplicita alla Git Safety Rule

Questo comando **è autorizzato** a eseguire operazioni git mutanti, ma solo
ed esclusivamente:

- `git add <file del task>`
- `git commit -m "chore(<ID>): progress update"`
- `git push`

Il comando **non crea branch, non fa checkout, non tocca file diversi dal
task**. Se per qualsiasi motivo servisse fare altro, STOP e chiedi al dev.
Vedi anche `AGENTS.md` → *Git Safety Rule*.

## Passi

1. **Normalizza l'ID e trova il task**:
   - Normalizza `$1` a `T-NNN` (es. `T001`, `t1`, `1` → `T-001`).
   - Se manca, errore: «Uso: `/task-status <task-id>`».
   - Cerca il file in `.pi/tasks/{backlog,in-progress,review,done}/<ID>-*.md`.
     Accetta qualsiasi cartella: l'update funziona in tutte le fasi del ciclo.
   - Se non trovato → errore con l'elenco degli ID esistenti.

2. **Verifica preconditions** (bloccanti):
   - `git branch --show-current` deve essere `main`. Se no → STOP con:
     «Per registrare il progress su `main` serve essere su `main`. Fai
     `git switch main && git pull`, poi rilancia `/task-status <ID>`.»
   - `git status --porcelain` deve essere pulito **per quanto riguarda il
     file del task**. Se il file del task risulta già modificato localmente,
     avvisa e chiedi se proseguire (potrebbe essere un progress dimenticato).
     Altri file modificati/untracked non bloccano.

3. **Raccogli l'input dall'utente** (turn-by-turn, una domanda per volta):

   **Turno 1 — Nota di progresso** *(obbligatoria)*:
   «Scrivi la nota di progresso per `<ID>` (cosa hai fatto da ieri/dall'ultimo
   update, decisioni prese, blocchi incontrati). Testo libero, multi-riga OK.
   Scrivi `annulla` per fermarti.»

   Se l'utente risponde `annulla` → esci senza toccare nulla.
   Se la nota è vuota o solo whitespace → richiedi il contenuto.

   **Turno 2 — Progress %** *(opzionale)*:
   «Progress attuale in percentuale? (`0`–`100`, oppure `skip` per lasciare
   invariato). Valore corrente nel file: `<valore_attuale_o_null>`.»

   Accetta: un intero 0–100, oppure `skip` / vuoto / `-`.
   Rifiuta valori fuori range o non numerici.

4. **Determina metadati dell'update**:
   - Data di oggi (`YYYY-MM-DD`) via `date +%Y-%m-%d`.
   - Username compatto da `git config --get user.email` (parte prima di `@`,
     lowercase). Fallback: `git config --get user.name`.

5. **Aggiorna il file del task** (via `edit`):

   a. **Front-matter**:
      - `updated: <YYYY-MM-DD>` → sempre.
      - `progress: <N>` → solo se l'utente ha fornito un valore al turno 2.
        Se la chiave `progress:` non esiste ancora nel file (task creato con
        vecchio template), **aggiungila** subito sotto `estimate:`.

   b. **Sezione `## Log`**:
      Appendi in coda un blocco nel formato:

      ```
      ### <YYYY-MM-DD> — <username>
      <nota raccolta al turno 1, preservando le newline>
      ```

      Se la sezione `## Log` non esiste nel file (file vecchio/malformato),
      creala in fondo.
      Se nella sezione ci sono SOLO commenti HTML di istruzione
      (`<!-- ... -->`) rimuovili — sono placeholder.

6. **Commit e push su `main`** (SOLO il file del task):

   ```
   git add <path del task>
   git commit -m "chore(<ID>): progress update"
   git push
   ```

   Se il push fallisce per `non-fast-forward`:
   - NON fare `git pull --rebase` in automatico.
   - Avvisa il dev: «`main` è avanzato sul remote. Esegui `git pull --rebase`
     a mano, verifica che non ci siano conflitti, poi rilancia `/task-status`.»
   - Non ripristinare il file — la modifica locale rimane, il dev può
     decidere se tenerla o fare `git reset`.

7. **Output finale — conciso**:

   ```
   📝 <ID> — progress update registrato
      nota: "<prima riga della nota>..."
      progress: <valore nuovo o "invariato">
      commit: <short-sha> su main (pushed)
   ```

   Niente tabelle o ripetizione dei comandi git: è un update di routine,
   deve essere veloce da leggere.

## Note operative

- **Il comando funziona anche se il dev è su un branch di feature**: i passi
  git lavorano solo sul file del task, che vive in `.pi/tasks/` (cartella
  presente sia su main che sui branch). Il check al passo 2 forza comunque
  `main` perché è il posto giusto in cui registrare lo stato per il team.
- **Non cambia `status:`**: i passaggi di stato (backlog → in-progress →
  review → done) sono responsabilità degli altri comandi del workflow
  (`/task-start`, `/pr-open`, `/pr-merge`).
- **Non tocca il branch di feature**: se il dev vuole che la nota sia
  visibile anche nel branch, farà un `git merge main` o `git rebase main`
  quando lo riterrà opportuno.
