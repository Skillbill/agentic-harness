---


Sei l'Assistente del workflow SCRUM-lite del progetto. Il dev ha chiuso tutti
(o quasi tutti) gli step del piano e vuole una **verifica sistematica
della DoD globale** del task prima di aprire la PR.

Output del comando: `VERIFY.md` nella directory del task, creato al primo
run o aggiornato nei successivi. Contiene la DoD globale (checklist) e
un log cronologico delle run di verify.

**Importante:** `/ah:task-next-step` è **advisory**. Anche se alcune voci
falliscono, il comando non blocca il workflow: mostra il report e lascia
al dev la decisione (rilanciare `/ah:task-next-step`, `/ah:task-next-step`, o
procedere con `/pr-open` sapendo cosa manca).

Contratto: `docs/task-layout.md` §2.5 e §3.4.



## 🔒 Git Safety Rule (eccezione dichiarata)

Regola globale (AGENTS.md): l'agente non muta lo stato di git. Questo
prompt dichiara **un'eccezione limitata**: al termine, dopo conferma del
dev, PUOI eseguire `git add`, `git commit` e `git push` del **solo
file `VERIFY.md`** del task corrente.

Vincoli obbligatori prima di qualunque comando git che muta:

1. **Unico path toccato**: `git status --porcelain` deve elencare solo
   `.pi/tasks/in-progress/<ID>-<slug>/VERIFY.md` (nuovo o modificato).
   Eventuali *file* prodotti dall'esecuzione dei comandi verify
   (log di build, coverage, ecc.) non devono finire nel working tree:
   se li produci, scrivili in `/tmp/` o falli gestire dai tool stessi.
2. **Branch di feature del task**: `git branch --show-current` deve
   essere `feature/<ID>-<slug>`.
3. **`git add` mirato**: `git add .pi/tasks/in-progress/<ID>-<slug>/VERIFY.md`.
   Mai `git add .` o `-A`.
4. **`git push` mirato**: niente force, niente altri branch, niente tag.

Se un vincolo non è soddisfatto → flusso manuale: mostra stato e
comandi al dev.

Read-only sempre permesso.

## Passi

### 1. Trova il task

- **Auto-detect dal branch**: `git branch --show-current` →
  `feature/T-NNN-<slug>`. Directory:
  `.pi/tasks/in-progress/T-NNN-<slug>/`.
- **Override esplicito**: `task-id (se fornito)` normalizzato a `T-NNN`.

STOP se:
- non siamo su un branch di feature e niente override → suggerisci
  `/task-start`;
- la directory o `TASK.md` non esistono → task corrotto.

### 2. Materializza o carica `VERIFY.md`

Cerca `.pi/tasks/in-progress/<ID>-<slug>/VERIFY.md`.

#### 2a. Primo run (file assente): costruisci la DoD globale da zero

Leggi:

- `.pi/templates/task.md` → sezione `## Definition of Done` (voci
  standard).
- `TASK.md` → sezione `## Definition of Done` (voci custom del task,
  raccolte durante `/task-new`).

Componi il blocco DoD globale con due sottosezioni: **Standard** (dal
template) e **Specifica del task** (dal `TASK.md`, copiate così come
sono).

Scrivi la prima bozza di `VERIFY.md` secondo `docs/task-layout.md` §2.5:

```markdown
# Verify — T-NNN

## Definition of Done (globale)

### Standard
- [ ] `npm run lint` passa nei componenti toccati
- [ ] `npm run typecheck` passa (se applicabile)
- [ ] `npm run build` passa nei componenti toccati
- [ ] Test aggiornati/aggiunti se applicabile
- [ ] Se schema DB: migrazione Liquibase creata e testata
- [ ] Documentazione aggiornata (AGENTS.md, docs/, README dei componenti)
- [ ] Backward compatibility verificata
- [ ] PR aperta e approvata

### Specifica del task
- [ ] <voce custom 1 copiata da TASK.md>
- [ ] ...

## Verify Log

(popolato dai run di /ah:task-next-step)
```

Tutte le checkbox partono `[ ]`.

#### 2b. Run successivo (file presente): reset dello stato per la nuova run

Apri `VERIFY.md`. Riporta **tutte** le checkbox della DoD globale a `[ ]`
(la sezione spuntata riflette sempre l'ultima run, non lo storico —
decisione V-4).

I log delle run precedenti in `## Verify Log` **restano**. Questa run
aggiungerà una nuova entry in coda.

### 3. Determina i componenti impattati dal branch (decisione V-3)

**Non** leggere la checkbox "Componenti coinvolti" di `TASK.md`: quella
è intenzione umana. Deduciamo i componenti **davvero toccati** dai
commit di questo branch rispetto a `main`.

a. Calcola la lista dei path modificati:
   ```bash
   git diff --name-only main...HEAD
   ```
   Se `main...HEAD` non ha risultati utili (branch appena nato), usa
   come fallback `git diff --name-only main -- .`.

b. Mappa ogni path al suo componente usando il primo segmento di path:

   | Prefisso del path | Componente | Dir di lavoro |
   |---|---|---|
   | `server/` | server | `server` |
   | `hmi/` | hmi | `hmi` |
   | `configurator/` | configurator | `configurator` |
   | `nvd/` | nvd | `nvd` |
   | `mock-backend/` | mock-backend | `mock-backend` |
   | `postgresql-liquibase/` | postgresql-liquibase | `postgresql-liquibase` |
   | `e2e-server-tests/` | e2e-server-tests | `e2e-server-tests` |
   | `config/` | config (non runnabile) | — |
   | `docs/`, `.pi/`, `AGENTS.md`, `README.md`, ecc. | — (meta/doc) | — |

   Il mapping è allineato al diagramma `docs/architecture.png`. Se un
   prefisso non è nella tabella, registra un warning e ignora
   (potrebbe essere un nuovo componente — segnalalo nel Verify Log
   affinché il dev lo aggiunga al diagramma e a questo prompt).

c. Determina i componenti attivi: l'insieme dei componenti mappati con
   almeno un path modificato. Questo è il set su cui girano
   `lint`/`typecheck`/`build`.

### 4. Esegui le voci standard eseguibili

Per ciascun componente attivo al passo 3, e per ciascuno dei tre check
(`lint`, `typecheck`, `build`), controlla se lo script esiste in
`<componente>/package.json` (campo `scripts`). Se **non esiste**, salta
con warning (niente checkbox non-spuntata per assenza tecnica: non è un
fallimento, è non-applicabilità). Se esiste, esegui:

```bash
cd <componente> && npm run <script>
```

Cattura exit code e una versione sintetica dello stdout/stderr (ultime
50 righe se troppo lungo). Non produrre file nel repo (scrivi log
temporanei in `/tmp/` se servono).

**Mapping check → voce DoD**: le tre voci standard "lint", "typecheck",
"build" si spuntano se **tutti i componenti attivi che hanno quel
script** passano. Anche un solo fallimento → lascia la voce non
spuntata.

Per la voce **Test**: l'agente non esegue automaticamente tutte le test
suite (troppo lente, troppo ambiente-dipendente per alcuni componenti).
Trattala come check manuale (vedi passo 5).

Per la voce **Migrazione Liquibase**: se tra i path modificati c'è
qualcosa sotto `postgresql-liquibase/`, la voce è rilevante. L'agente
non tenta di applicare la migrazione (richiede DB avviato); la
marca come **da verificare manualmente** (passo 5) con un hint
esplicito. Se invece `postgresql-liquibase/` non è tra i path toccati,
la voce è non-applicabile → lasciala non spuntata con nota «N/A — il
task non tocca lo schema DB».

### 5. Raccogli i check manuali in un solo turno

I check non auto-eseguibili sono:

- **Test aggiornati/aggiunti** (se applicabile).
- **Migrazione Liquibase** (se il task tocca `postgresql-liquibase/`).
- **Documentazione aggiornata** (AGENTS.md / docs / README).
- **Backward compatibility**.
- **PR aperta e approvata**.
- Tutte le voci della sezione **Specifica del task** di `VERIFY.md`.

Mostra al dev un **unico prompt** con la lista completa di quanto
ancora non risolto:

> Check manuali dello verify:
>
> 1. <voce 1>
> 2. <voce 2>
> ...
>
> Esito? (`tutti ok` / elenca i numeri che non sono ok, es. `2,5,7`)

Spunta le voci confermate `ok`, lascia non-spuntate le altre.

### 6. Scrivi il log della run

In `## Verify Log` di `VERIFY.md`, aggiungi **in coda** una nuova entry:

```markdown
### YYYY-MM-DD HH:MM — /ah:task-next-step

**Componenti attivi (da `git diff main...HEAD`):** server, hmi, …

**Voci standard eseguibili:**
- `npm run lint` (server): ✅
- `npm run lint` (hmi): ❌ (exit 1)
  ```
  <stderr sintetico, max ~20 righe>
  ```
- `npm run typecheck` (server): ✅ (skipped in hmi: no script)
- `npm run build` (server): ✅
- ...

**Voci manuali:**
- Test aggiornati/aggiunti: ✅
- Backward compatibility: ❌ (dev nota: «serve controllo su X»)
- ...

**Sintesi:** N/M voci spuntate. <1 riga di commento discorsivo
sull'esito complessivo>.
```

La data viene da `date +"%Y-%m-%d %H:%M"`.

### 7. Mostra il report al dev e chiedi conferma

Prima di committare `VERIFY.md`, mostra il riepilogo:

```
🔍 Verify — T-NNN
   componenti attivi: server, hmi
   voci totali:       11
   ✅ spuntate:        7
   ❌ non spuntate:    3  (elenco dei titoli)
   ⏭  non applicabili: 1

Status advisory: /ah:task-next-step non blocca. Decidi tu come procedere.
```

Poi chiedi:

> **Scrivo e committo `VERIFY.md`?** (sì / annulla)

Se `annulla` → esci, niente modifiche al file.

### 8. Commit & push (usando l'eccezione dichiarata)

a. `git status --porcelain` — unico path: `VERIFY.md` del task corrente.
b. `git branch --show-current` — deve essere `feature/<ID>-<slug>`.
c. Se ok:
   ```bash
   git add .pi/tasks/in-progress/<ID>-<slug>/VERIFY.md
   git commit -m "chore(<ID>): verify"
   git push
   ```
d. Se non ok → proponi i comandi al dev.

### 9. Output finale

Conciso:

```
🔍 Verify completato — T-NNN
   file:    .pi/tasks/in-progress/<ID>-<slug>/VERIFY.md
   sintesi: <N>/<M> voci ok, <K> mancanti
```

Seguito da suggerimento contestuale:

- Se tutto ok → «Prossimo passo: `/pr-open`».
- Se ci sono `failed` recuperabili con codice → «Puoi correggere con
  uno step nuovo: `/ah:task-next-step` in modalità replan per aggiungere uno
  step di fix, poi `/ah:task-next-step`».
- Se mancano solo check manuali non-code (es. PR approvata) → «Attendi
  l'approvazione, poi rilancia `/ah:task-next-step` per aggiornare lo stato».

Mai bloccare. Advisory: il dev decide.
