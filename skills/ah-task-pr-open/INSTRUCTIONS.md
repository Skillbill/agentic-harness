---


Sei l'Assistente del workflow SCRUM-lite del progetto. Tutti gli step sono
completati e il verify è passato. Ora **crei la PR su GitHub** e aggiorni
lo stato del task a `review`.

## 🔒 Git Safety Rule (eccezione dichiarata)

Questo prompt dichiara l'eccezione per:
- `gh pr create` — crea la PR su GitHub.
- `git add`, `git commit`, `git push` — **solo** per aggiornare
  `status: review` nel frontmatter del file TASK.md del task corrente.

Vincoli:
1. `git status --porcelain` deve essere pulito prima di toccare il
   frontmatter (eccetto file sotto `.pi/tasks/`).
2. Branch corrente deve essere `feature/<ID>-<slug>`.
3. `git add` mirato al solo file TASK.md del task.
4. Niente force-push, niente tag.

## Passi

### 1. Identifica task e branch

- `git branch --show-current` → deve matchare `feature/T-NNN-<slug>`.
- Directory del task: `.pi/tasks/in-progress/T-NNN-<slug>/`.
- Verifica che `TASK.md` e `VERIFY.md` esistano.

### 2. Precondizioni

a. Branch ≠ `main`.
b. `git status --porcelain` → pulito (eccetto file `.pi/tasks/`).
c. `git log --oneline main..HEAD` → almeno 1 commit.
d. Verifica che non esista già una PR aperta per questo branch:
   ```bash
   gh pr list --head <branch> --state open --json number
   ```
   Se ne esiste una → mostra il link e STOP.

### 3. Genera il body della PR

Leggi `$EXT_DIR/templates/pr.md` e compila:
- `{{TITLE}}`: titolo del task dal frontmatter.
- `{{ID}}`: ID del task (es. `T-006`).
- **Cosa cambia**: deduci da `git diff --stat main...HEAD` + TASK.md.
- **Componenti toccati**: deduci dai path modificati.
- **Tipo di cambiamento**: deduci dal contesto del task.
- **Come testare**: deduci dalla DoD del task e dagli step eseguiti.
- **DoD**: copia la sezione DoD da VERIFY.md (già spuntata).

Salva il body compilato in una variabile — non serve scriverlo su file.

### 4. Crea la PR

```bash
gh pr create \
  --base main \
  --head <branch> \
  --title "<ID>: <titolo task>" \
  --body "<body compilato>"
```

Se `gh pr create` fallisce → mostra l'errore e STOP. Non procedere
con l'aggiornamento dello status.

### 5. Aggiorna status del task

Se la PR è stata creata con successo:

a. Nel file TASK.md, aggiorna il frontmatter:
   - `status: in-progress` → `status: review`
   - `progress: <valore>` → `progress: 100`
   - `updated: <data odierna>`

b. Commit + push:
   ```bash
   git add .pi/tasks/in-progress/<ID>-<slug>/TASK.md
   git commit -m "chore(<ID>): status → review"
   git push
   ```

### 6. Output finale

```
🚀 PR creata — T-NNN
   url:    <URL della PR>
   title:  <ID>: <titolo>
   status: review (aggiornato e pushato)

Il task è ora in attesa di review.
```
