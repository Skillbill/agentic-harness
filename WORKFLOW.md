# Team Workflow (SCRUM-lite)

Workflow semplificato ispirato a SCRUM, pensato per un team che sviluppa il progetto
con l'agente **pi**. Nessuno sprint, nessun backlog grooming formale: solo task,
stime, branch, PR.

I **task** del progetto vivono sotto `.pi/tasks/` nel repo e sono versionati
con il codice. I **template**, le **procedure** e i **prompt** vivono
nell'estensione agentic-harness e vengono caricati da pi all'avvio.

## Ciclo di vita di un task

```
  backlog/ ──► in-progress/ ──► review/ ──► done/
      │              │              │           │
  /task-new     /task-start     /pr-open    /task-done
```

- `backlog/` — task creato e (opzionalmente) stimato, non ancora preso in carico
- `in-progress/` — un dev sta lavorando sul branch `feature/T-NNN-slug`
- `review/` — PR aperta su GitHub/GitLab, in attesa di review/merge
- `done/` — PR mergiata, task chiuso

## Convenzioni

- **ID task**: `T-001`, `T-002`, … assegnati auto-incrementalmente da `/task-new`
- **Stima**: in ore (es. `4h`, `1.5h`). Campo opzionale ma consigliato.
- **Branch**: `feature/T-NNN-slug-kebab-case` (es. `feature/T-003-web-camera-configurator`)
- **Commit su `main`**: solo via merge di PR. Il file del task che rappresenta
  lo stato del backlog/in-progress vive su `main`.
- **Lavoro di feature**: avviene su branch. Il file del task viene spostato da
  `backlog/` a `in-progress/` da `/task-start` e committato sul branch di feature.

## 🔒 Git Safety Rule (regola globale per l'agente)

**L'agente NON esegue mai operazioni git che mutano lo stato del repository.**

Operazioni **vietate** all'agente (le esegue sempre il dev a mano):
- `git checkout -b`, `git switch -c`, `git branch`
- `git add`, `git commit`, `git commit --amend`
- `git push`, `git pull`, `git fetch` (salvo esplicita richiesta)
- `git merge`, `git rebase`, `git cherry-pick`, `git reset`
- `gh pr create`, `gh pr merge`, `glab mr create`, ecc.
- qualunque comando che modifica working tree, index, refs o remoto

Operazioni **permesse** (read-only, per orientarsi):
- `git status`, `git log`, `git diff`, `git show`
- `git branch --show-current`, `git branch -a`, `git remote -v`
- `git config --get ...`

**Eccezione**: il dev può chiedere esplicitamente all'agente di eseguire un
comando git specifico (es. "committa tu"). Solo in quel caso l'agente esegue.

I prompt template nell'estensione agentic-harness seguono tutti questa regola:
propongono i comandi git ma non li lanciano.

## Comandi disponibili

Tutti i comandi AH hanno prefisso `ah:`.

| Comando              | Scopo                                                     |
|----------------------|-----------------------------------------------------------|
| `/ah:task-new`       | Crea un nuovo task nel backlog                            |
| `/ah:task-start`     | Prende in carico un task e prepara branch di feature      |
| `/ah:task-next-step` | Avanza il task corrente alla prossima fase del ciclo interno (discuss → plan → execute → verify) |
| `/ah:task-done`      | Chiude un task dopo il merge della PR                     |
| `/ah:project-status` | Progress bar del progetto + stato dei task in-progress    |
| `/ah:pr-open`        | Verifica DoD e prepara descrizione PR                     |
| `/ah:standup`        | Riepilogo stato progetto per daily async                  |
| `/ah:map-codebase`   | Analizza la codebase e produce 7 doc strutturati in `.pi/codebase/` |
| `/ah:do-git-stuff`   | Esegue comandi git mutanti delegati dal dev               |

### Mappa della codebase (prerequisito consigliato)

`/ah:map-codebase` analizza l'intera codebase e produce 7 documenti
strutturati in `.pi/codebase/`:

| Documento | Contenuto |
|---|---|
| `STACK.md` | Linguaggi, runtime, framework, dipendenze |
| `INTEGRAZIONI.md` | API esterne, database, provider auth |
| `ARCHITETTURA.md` | Pattern, layer, flusso dati, entry point |
| `STRUTTURA.md` | Layout directory, dove aggiungere codice nuovo |
| `CONVENZIONI.md` | Stile codice, naming, pattern |
| `TESTING.md` | Framework test, struttura, mocking |
| `CRITICITA.md` | Debito tecnico, bug noti, aree fragili |

Questi documenti vengono **consumati** automaticamente dalle fasi `plan`
e `execute` del ciclo interno, per dare all'agente contesto globale
su architettura, convenzioni e pattern del progetto.

La mappa è **consigliata ma non bloccante**: le fasi funzionano anche
senza, ma con meno contesto.

### Ciclo interno del task (skill, invocate da `/ah:task-next-step`)

```
discuss → plan → execute (N volte) → verify
```

| Fase    | Skill           | Artefatti prodotti                      |
|---------|-----------------|------------------------------------------|
| discuss | `ah-task-discuss`  | `DISCUSS.md`                             |
| plan    | `ah-task-plan`     | `PLAN.md` + `steps/*.md`                |
| execute | `ah-task-execute`  | codice + step aggiornati                |
| verify  | `ah-task-verify`   | `VERIFY.md`                             |

## File supporto

**Nell'estensione agentic-harness:**
- `commands/` — prompt template dei comandi `/ah:*`
- `skills/` — skill del ciclo interno (discuss, plan, execute, verify)
- `templates/task.md` — scheletro di un task (usato da `/ah:task-new`)
- `templates/pr.md` — scheletro descrizione PR (usato da `/ah:pr-open`)
- `task-layout.md` — contratto del layout directory dei task
- `WORKFLOW.md` — questo file

**Nel repo del progetto:**
- `.pi/tasks/<stato>/T-NNN-slug/TASK.md` — i task effettivi (directory layout)

## Flusso tipico

```bash
# 1. Product owner / tech lead crea task nel backlog (su main)
/ah:task-new "Add web camera support to configurator"
# dev edita a mano il file (stima in ore, contesto, DoD) e committa su main

# 2. Dev prende in carico il task (su main)
/ah:task-start T-003
# l'agente propone:
#   git switch -c feature/T-003-web-camera-configurator
#   git mv .pi/tasks/backlog/T-003-*.md .pi/tasks/in-progress/
#   git add -A && git commit -m "chore(T-003): start task"
# il dev li esegue a mano

# 3. Lavoro di sviluppo sul branch — ciclo interno
/ah:task-next-step   # fase discuss: genera DISCUSS
/ah:task-next-step   # fase plan: genera PLAN + steps/
/ah:task-next-step   # fase execute: esegue step 1, commit atomico
/ah:task-next-step   # fase execute: esegue step 2, ...
/ah:task-next-step   # fase verify: verifica DoD globale
/ah:project-status   # progress bar del progetto

# 4. Apertura PR (sul branch)
/ah:pr-open
# l'agente verifica DoD, genera descrizione PR
# il dev esegue a mano: gh pr create ... (o via web)
# poi sposta il file in review/ e committa a mano

# 5. Merge (fatto a mano dal dev via web/gh), poi su main:
git switch main && git pull
/ah:task-done T-003
# l'agente propone il git mv in done/ e il commit, il dev li esegue
# (o il dev lancia /ah:do-git-stuff per farli eseguire all'agente)
```

## FAQ

**Devo aggiungere `.pi/git/` al `.gitignore` del progetto?**
No. PI v0.74.0 clona lì i Pi Package installati via `pi install git:...` e piazza da solo un `.gitignore` self-managed (`*\n!.gitignore`) dentro `.pi/git/` che ignora tutto il contenuto cloned. Tracci solo quel file (`git add .pi/git/.gitignore` una tantum) e `git status` resta pulito. Niente da aggiungere al `.gitignore` root.
