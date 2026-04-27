# Efesto — Team Workflow (SCRUM-lite)

Workflow semplificato ispirato a SCRUM, pensato per un team che sviluppa Efesto
con l'agente **pi**. Nessuno sprint, nessun backlog grooming formale: solo task,
stime, branch, PR.

I **task** del progetto vivono sotto `.pi/tasks/` nel repo e sono versionati
con il codice. I **template**, le **procedure** e i **prompt** vivono
nell'estensione agentic-harness e vengono caricati da pi all'avvio.

## Ciclo di vita di un task

```
  backlog/ ──► in-progress/ ──► review/ ──► done/
      │              │              │           │
  /task-new     /task-start     /pr-open    /pr-merge
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

| Comando            | Scopo                                                     |
|--------------------|-----------------------------------------------------------|
| `/task-new`        | Crea un nuovo task nel backlog                            |
| `/task-list`       | Elenca i task filtrando per stato                         |
| `/task-start`      | Prende in carico un task e prepara branch di feature      |
| `/project-status`  | Progress bar del progetto + stato dei task in-progress    |
| `/pr-open`         | Verifica DoD e prepara descrizione PR                     |
| `/pr-review`       | Code review strutturata di una PR                         |
| `/pr-merge`        | Chiude il task dopo merge della PR                        |
| `/standup`         | Riepilogo stato progetto per daily async                  |

## File supporto

**Nell'estensione agentic-harness:**
- `templates/task.md` — scheletro di un task (usato da `/task-new`)
- `templates/pr.md` — scheletro descrizione PR (usato da `/pr-open`)
- `procedures/architecture-sync.md` — procedura di allineamento architettura
- `WORKFLOW.md` — questo file

**Nel repo del progetto:**
- `.pi/tasks/<stato>/T-NNN-slug.md` — i task effettivi

## Flusso tipico

```bash
# 1. Product owner / tech lead crea task nel backlog (su main)
/task-new "Add web camera support to configurator"
# dev edita a mano il file (stima in ore, contesto, DoD) e committa su main

# 2. Dev prende in carico il task (su main)
/task-start T-003
# l'agente propone:
#   git switch -c feature/T-003-web-camera-configurator
#   git mv .pi/tasks/backlog/T-003-*.md .pi/tasks/in-progress/
#   git add -A && git commit -m "chore(T-003): start task"
# il dev li esegue a mano

# 3. Lavoro di sviluppo sul branch
# ... codice, test ...
/project-status  # progress bar del progetto + stato task in-progress

# 4. Apertura PR (sul branch)
/pr-open
# l'agente verifica DoD, genera descrizione PR
# il dev esegue a mano: gh pr create ... (o via web)
# poi sposta il file in review/ e committa a mano

# 5. Review
/pr-review <PR-URL>

# 6. Merge (fatto a mano dal dev via web/gh), poi su main:
git switch main && git pull
/pr-merge T-003
# l'agente propone il git mv in done/ e il commit, il dev li esegue
```
