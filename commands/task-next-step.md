---
description: Avanza il task corrente alla prossima fase del ciclo interno (discuss → plan → execute → verify)
---

Sei l'Assistente del workflow SCRUM-lite del progetto. Questo comando è la
**facciata unica** del ciclo interno di un task. Determina a che punto
è il task e invoca la skill appropriata.

## 🔒 Git Safety Rule
Questo comando non esegue git direttamente. Le eccezioni git sono
dichiarate nelle singole skill che verranno invocate.

## Ciclo interno

```
discuss → plan → execute (N volte) → verify
```

Ogni fase produce artefatti nella directory del task
(`.pi/tasks/in-progress/T-NNN-<slug>/`):

| Fase | Artefatto | Condizione di completamento |
|------|-----------|-----------------------------|
| discuss | `CODEMAP.md` + `DISCUSS.md` | entrambi esistono |
| plan | `PLAN.md` + `steps/*.md` | `PLAN.md` esiste e `steps/` non è vuoto |
| execute | codice + step `done` | tutti gli step in `steps/` sono `done` |
| verify | `VERIFY.md` | `VERIFY.md` esiste |

## Passi

### 1. Identifica il task corrente

Usa il contesto iniettato da AH (`## 🎯 Current Task Context`).
Se non c'è → STOP: «Non sei su un branch di feature. Usa `/ah:task-start`
per prendere in carico un task.»

Estrai: `ID`, `slug`, `branch`, `taskDir` (la directory del task sotto
`.pi/tasks/in-progress/`).

Verifica che `TASK.md` esista nella directory → altrimenti STOP (task
corrotto).

### 2. Determina la fase corrente

Controlla gli artefatti nella directory del task, **in ordine**:

```
1. CODEMAP.md non esiste?          → fase = discuss
2. DISCUSS.md non esiste?          → fase = discuss
3. PLAN.md non esiste?             → fase = plan
4. steps/ vuoto o assente?         → fase = plan
5. Almeno uno step non è `done`?   → fase = execute
6. VERIFY.md non esiste?           → fase = verify
7. Tutto presente e completo       → fase = done (task pronto per PR)
```

Per il check al punto 5, scansiona `steps/*.md` (escludi `steps/archive/`):
leggi il frontmatter `status:` di ciascuno. Se almeno uno è `todo`,
`doing`, `blocked` o `failed` → fase = execute.

### 3. Mostra lo stato e la fase

Prima di invocare la skill, mostra al dev un riepilogo compatto:

```
🔄 Task T-NNN — <titolo>
   fase corrente: <discuss|plan|execute|verify|done>
   artefatti:     CODEMAP ✅  DISCUSS ✅  PLAN ❌  steps 0/0  VERIFY ❌
```

Usa ✅ se il file esiste, ❌ se non esiste. Per steps mostra `done/totale`
(es. `3/5`).

Se fase = **done**:
> Tutte le fasi sono completate. Prossimo passo: `/ah:pr-open`.

STOP.

### 4. Invoca la skill appropriata

Carica la skill corrispondente alla fase determinata al passo 2 usando
`read` sul file SKILL.md:

| Fase | Skill file (relativo a AH) |
|------|---------------------------|
| discuss | `skills/ah-task-discuss/INSTRUCTIONS.md` |
| plan | `skills/ah-task-plan/INSTRUCTIONS.md` |
| execute | `skills/ah-task-execute/INSTRUCTIONS.md` |
| verify | `skills/ah-task-verify/INSTRUCTIONS.md` |

Il path assoluto della directory AH è: `$EXT_DIR`.

Leggi il file INSTRUCTIONS.md completo con `read`, poi **esegui le istruzioni
contenute** come se fossero il tuo prompt operativo per questo turno.

### 5. Aggiorna project-status (mentale)

Alla fine dell'esecuzione della skill, il riepilogo finale della skill
stessa è sufficiente. Non aggiungere altro output.
