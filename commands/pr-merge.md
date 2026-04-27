---
description: Chiudi un task dopo il merge della PR
argument-hint: "<task-id>"
---

Sei l'agente del workflow SCRUM-lite del progetto. La PR è stata mergiata (dal
dev, via web/gh). Ora chiudiamo il task: spostiamo il file in `done/` e
aggiorniamo il frontmatter.

**Task da chiudere:** $@

## 🔒 Git Safety Rule
NON eseguire `git mv`, `git add`, `git commit`, `git push`, `git branch -d`.
Proponi i comandi; il dev li esegue.

## Passi

1. **Verifica preconditions** (read-only):
   - `$1` deve essere un ID valido. Se manca, errore.
   - `git branch --show-current` deve essere `main` (o branch base). Se no,
     avvisa: il task si chiude da `main`, dopo `git pull`.
   - `git status --porcelain` → pulito. Se no, avvisa.
   - Suggerisci (non eseguire): `git fetch && git pull --ff-only` per essere
     sicuri di avere il merge della PR in locale.

2. **Trova il file del task**:
   - Atteso in `.pi/tasks/review/T-NNN-*.md`.
   - Se è ancora in `in-progress/` → avvisa: probabilmente il `/pr-open` non è
     stato completato. Chiedi se proseguire comunque dallo stato corrente.
   - Se già in `done/` → avvisa, nessuna azione.

3. **Verifica che il merge ci sia davvero**:
   - Controlla con `git log --oneline --grep="T-NNN"` su `main` per vedere i
     commit relativi al task.
   - Cerca anche eventuali merge commit che referenziano il branch
     `feature/T-NNN-*`.
   - Se non trovi traccia, chiedi conferma al dev (potrebbe essere squash-merge
     con messaggio diverso).

4. **Aggiorna il frontmatter del task** (via `edit`):
   - `status: done`
   - `updated: <oggi>` (YYYY-MM-DD)
   - Aggiungi un campo `closed: <oggi>` se non presente.

5. **Spunta la DoD**:
   - Marca `[x] PR approvata` e qualunque altro item rimasto.

6. **Aggiungi una entry in "Log"**:
   - `YYYY-MM-DD: merged via PR #<n> (se noto), closed.`

7. **Proponi i comandi git al dev**:
   ```
   Task T-003 pronto per chiusura. Esegui:

     # 1. Sposta il file in done/
     git mv .pi/tasks/review/T-003-*.md .pi/tasks/done/

     # 2. Committa la chiusura
     git add -A
     git commit -m "chore(T-003): close task"
     git push

     # 3. (Opzionale) cancella il branch di feature locale e remoto
     git branch -d feature/T-003-add-web-camera-support
     git push origin --delete feature/T-003-add-web-camera-support
   ```

8. **Output finale**:
   - Riepilogo: ID, titolo, stima vs durata reale (da `created` a oggi).
   - Link al commit/merge se trovato.
   - Suggerisci `/standup` per vedere lo stato aggiornato del progetto.
