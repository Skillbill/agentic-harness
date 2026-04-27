# Task Layout & Inner Cycle

> **Stato:** proposta approvata, implementazione in corso.
> **Audience:** dev del progetto e agenti (pi / PI extensions / prompt templates).
> **Scope:** definisce la struttura su disco di un task e il ciclo interno
> `discuss → plan → execute → verify`. Non riguarda milestone, release,
> roadmap di versione: quelli sono fuori scope.

Questo documento è il **contratto di riferimento** per tutti i prompt
template e le extension di pi che operano sui task. Se cambi qualcosa qui,
i prompt in `.pi/prompts/` e le convenzioni in `AGENTS.md` vanno aggiornati
di conseguenza.

---

## 1. Cambio rispetto al layout precedente

Prima: un task = un file singolo `T-NNN-slug.md` in
`.pi/tasks/{backlog,in-progress,review,done}/`.

Ora: un task = una **cartella** `T-NNN-slug/` che contiene più file.
La cartella si sposta tra gli stati esattamente come faceva il file.

```
.pi/tasks/
├── backlog/
│   └── T-NNN-slug/
│       └── TASK.md                 ← creato da /task-new
├── in-progress/
│   └── T-NNN-slug/
│       ├── TASK.md
│       ├── CODEMAP.md              ← creato/rigenerato da /task-codemap
│       ├── DISCUSS.md              ← creato/esteso da /task-discuss
│       ├── PLAN.md                 ← creato da /task-plan (indice step)
│       ├── steps/
│       │   ├── 01-*.md
│       │   ├── 02-*.md
│       │   └── ...                 ← file step, uno per step
│       └── VERIFY.md               ← DoD globale + Verify Log, gestito da /task-verify
├── review/
│   └── T-NNN-slug/   (stessa struttura)
└── done/
    └── T-NNN-slug/   (stessa struttura, archivio)
```

**Criterio di identificazione:** un task è una *directory* il cui nome
matcha `T-NNN-<slug>/` e che contiene almeno `TASK.md`. Tutti i tool che
scansionano i task devono cercare directory, non file.

---

## 2. File del task

### 2.1 `TASK.md` — la scheda (sempre presente)

Contiene il frontmatter (identità del task) e le sezioni narrative di alto
livello. È il file che vedi per "sapere di che si tratta".

**Frontmatter** (invariato rispetto al layout precedente):

```yaml
---
id: T-NNN
title: <titolo umano>
status: backlog | in-progress | review | done
estimate: <N>h | null
assignee: <username> | null
branch: feature/T-NNN-<slug> | null
created: YYYY-MM-DD
updated: YYYY-MM-DD
---
```

**Sezioni del corpo** (invariate rispetto al template esistente):

- `## Contesto`
- `## Obiettivo` (con eventuale *Fuori scope*)
- `## Componenti coinvolti` (checkbox, lista da `docs/architecture.png`)
- `## Definition of Done` — **qui resta solo la DoD "umana" raccolta
  nell'intervista di `/task-new`** (criteri di accettazione specifici del
  task). Le voci tecniche standard (lint, typecheck, build, backward
  compat, PR) sono delegate a `VERIFY.md` e non duplicate qui.
- `## Note tecniche`
- `## Log` (note macro del dev, non collegate ai singoli step)

### 2.2 `CODEMAP.md` — mappa del codice pertinente al task

La `CODEMAP.md` è l'**inventario ragionato** dei punti del codice
rilevanti per questo task specifico. Serve a dare alle fasi
`/task-discuss`, `/task-plan` e `/task-execute` un contesto mirato
sul codice reale senza leggere il repo in cieco ogni volta.

**Generata automaticamente** da `/task-discuss` alla prima
esecuzione: prima di entrare nelle gray area, l'agente fa una breve
intervista sugli argomenti pertinenti al task ed esplora i
componenti checkati in `TASK.md`, producendo la mappa. Non esiste
un comando pubblico dedicato: il mapping è un prerequisito
interno di `/task-discuss`.

**Aggiornata** a ogni `/task-execute` che chiude uno step con
successo: l'agente, dopo il commit dello step, aggiorna in modo
incrementale la mappa per riflettere i file nuovi/rinominati/cancellati
dallo step.

**Rigenerata** esplicitamente da un nuovo `/task-discuss` quando il
dev lo ritiene necessario (es. replan profondo, task ripreso dopo
tempo): `/task-discuss` rileva mappe stantie e propone la
rigenerazione in modalità advisory (mai bloccante) prima di
entrare nelle gray area.

#### Struttura

Organizzata **per argomento/concern**, non per componente. Gli
argomenti sono derivati dal task specifico (dal titolo, contesto,
obiettivo, componenti coinvolti di `TASK.md`), non da una
tassonomia generale.

```markdown
# Codemap — T-NNN

> Ultimo aggiornamento: YYYY-MM-DD (snapshot a <commit sha>)

## Argomenti

1. [Camera data model](#camera-data-model)
2. [Stream playback in NVD](#stream-playback-in-nvd)
3. ...

## Camera data model

Come il sistema modella una telecamera (DB, server, API).

### Primary
- `postgresql-liquibase/changelog/cameras.yaml` — schema tabella camera, vincoli.
- `server/lib/db/camera.ts` — accesso DB, tipi TS.
- `server/lib/cctv.ts` — logica di dominio camera lato server.

### Related
- `server/lib/configurator-api/cameras.ts` — endpoint REST CRUD.
- `configurator/src/features/cameras/CameraForm.tsx` — form del configuratore.
- `hmi/src/modules/cctv/` — consumer lato HMI.

### Notes
- Oggi il modello assume sempre camera "fisica" (host/port obbligatori).
- Nessuna enum di tipo camera: è implicita dal fatto che tutti i campi
  sono valorizzati.

## Stream playback in NVD

...
```

#### Vincoli dimensionali (obbligatori)

- **Max 8–10 argomenti** per mappa. Se ne servono di più, il task è
  probabilmente troppo grande e va spezzato.
- **Per argomento**: max **5 Primary** + **8 Related**. Soft cap:
  l'agente può sforare se documenta il perché nelle `Notes`.
- **Formato per-file**: solo `path + 1 riga di commento`. Niente
  snippet di codice, niente descrizioni lunghe. Il dettaglio lo
  prenderà chi leggerà il file.
- **Riga di intestazione** con data e commit sha: permette ai
  consumer di capire quanto è fresca la mappa.

#### Regola d'uso per i consumer (discuss / plan / execute)

Quando una di queste fasi ha bisogno di contesto codice su un
argomento X:

1. Apri `CODEMAP.md` e trova la sezione che copre X.
2. **Leggi tutti i file elencati in `Primary`** (interamente se < 300
   righe, altrimenti mirato con grep/offset).
3. **Leggi i file in `Related`** solo se la domanda/decisione dipende
   da loro. In caso di dubbio, leggi.
4. **Non espandere** oltre ciò che la mappa dichiara (niente hop di
   import automatici, niente `grep` speculativi). Se durante il
   lavoro l'agente scopre che alla mappa manca qualcosa, lo annota e
   propone al dev di rigenerarla con `/task-codemap` al prossimo
   passaggio utile — non la modifica di nascosto.
5. Se per un argomento `CODEMAP.md` non ha una sezione dedicata, è
   un **segnale di mappa incompleta**: l'agente lo segnala al dev e
   suggerisce `/task-codemap` prima di procedere.

### 2.3 `DISCUSS.md` — output della fase discuss (opzionale)

Creato/esteso da `/task-discuss`. Formalizza le domande e risposte
emerse *oltre* l'intervista di `/task-new`, tipicamente:

- Gray area: scelte di UX / comportamento in caso di errore / formati dati.
- Decisioni architetturali discusse e motivate.
- Impatti su data model, API surface, WebSocket events.
- Alternative valutate e scartate.

Struttura libera, ma consigliata per sezioni:

```markdown
# Discuss — T-NNN

## Gray areas

### <domanda 1>
**Decisione:** ...
**Motivazione:** ...

## Data model impact
...

## API / Event surface
...

## Error handling
...

## Alternative scartate
...
```

### 2.4 `PLAN.md` — indice del piano (creato da `/task-plan`)

`PLAN.md` **non contiene il dettaglio degli step**: è un indice ordinato,
più gli aspetti trasversali al piano.

```markdown
# Plan — T-NNN

## Strategia

Una o due righe sul "come" complessivo, derivate da TASK.md + DISCUSS.md.

## Step (serie stretta, ordine = esecuzione)

1. [01-db-schema-camera-kind](steps/01-db-schema-camera-kind.md) — DB schema: add camera.kind + stream_url · `todo` · 2h
2. [02-server-api-web-camera](steps/02-server-api-web-camera.md) — Server API per web-camera · `todo` · 3h
3. ...

## Rischi noti
...

## Aggiornamenti del piano
- YYYY-MM-DD: ...
```

### 2.5 `steps/NN-<slug>.md` — un file per step

Ogni step è un **commit atomico** (vedi §4). Il filename ha prefisso
numerico che determina l'ordine (serie stretta).

```markdown
---
id: T-NNN/NN
title: <titolo step>
status: todo | doing | done | blocked | failed
estimate: <N>h | null
---

## Execute

Cosa va fatto, concretamente. File che verranno creati/modificati. Decisioni
tecniche di dettaglio che riguardano *solo questo step*.

## Verify

Criteri di done **locali** allo step, idealmente eseguibili:

- [ ] `npm run lint` nei componenti toccati
- [ ] <check specifico>
- [ ] <comando verificabile>

## Log

(compilato da /task-execute durante il lavoro: comandi eseguiti, errori,
note di recupero)
```

**Stati dello step:**

| Stato | Significato |
|---|---|
| `todo` | non ancora iniziato |
| `doing` | `/task-execute` sta lavorando su questo step |
| `done` | execute + verify locali OK, commit atomico eseguito |
| `blocked` | bloccato da vincolo esterno, il dev deve intervenire |
| `failed` | verify fallito, richiede revisione del piano o dello step |

### 2.6 `VERIFY.md` — DoD globale del task e log della verifica

Creato alla prima esecuzione di `/task-verify` (o a mano, in anticipo).
Contiene **la DoD globale** del task — cioè le voci tecniche standard e
quelle specifiche riassunte dal `TASK.md` — e il log dei comandi di
verifica eseguiti.

```markdown
# Verify — T-NNN

## Definition of Done (globale)

### Standard
- [ ] `npm run lint` passa nei componenti toccati
- [ ] `npm run typecheck` passa (se applicabile: server, configurator, nvd, e2e-server-tests)
- [ ] `npm run build` passa nei componenti toccati
- [ ] Test aggiornati/aggiunti se applicabile
- [ ] Se schema DB: migrazione Liquibase creata e testata
- [ ] Documentazione aggiornata (AGENTS.md, docs/, README dei componenti)
- [ ] Backward compatibility verificata
- [ ] PR aperta e approvata

### Specifica del task
(Copiata/adattata dalla sezione DoD di TASK.md)
- [ ] Test e2e dedicato che crea una web-camera e verifica che appaia in HMI/NVD
- [ ] ...

## Verify Log

### YYYY-MM-DD HH:MM — /task-verify
- `npm run lint` (server): ✅
- `npm run lint` (hmi): ❌ output ...
- ...
```

La DoD globale **non è bloccante**: `/task-verify` è *advisory*, segnala
cosa manca ma non impedisce la chiusura del task (vedi §5).

---

## 3. Ciclo interno `discuss → plan → execute → verify`

La fase `/task-discuss` genera automaticamente la `CODEMAP.md` alla
prima esecuzione (vedi §2.2). Le fasi successive presumono che la
mappa esista e falliscono in modo chiaro (o suggeriscono
`/task-discuss`) se non la trovano.

Tutti e quattro i comandi **auto-detectano il task corrente** dal branch
git (`git branch --show-current` che matchi `feature/T-NNN-*`). L'override
esplicito `/task-xyz T-NNN` è permesso per casi particolari.

### 3.1 `/task-discuss`

- Input: `TASK.md` (scheda), `CODEMAP.md` se esiste, eventuale
  `DISCUSS.md` preesistente.
- Output: `CODEMAP.md` (se mancava o è stata rigenerata) +
  `DISCUSS.md` creato o esteso con nuove sezioni.
- Comportamento in due fasi:
  1. **Fase codemap (solo al primo run o su rigenerazione
     esplicita).** Intervista leggera al dev («quali argomenti
     vedi?») partendo dal task, poi esplorazione **mirata** del
     codice dei soli componenti checkati `[x]` in
     `TASK.md → ## Componenti coinvolti`, secondo i vincoli di
     §2.2 (cap dimensionali, 1 riga per file, Primary/Related).
     Scrive `CODEMAP.md` e committa **separatamente** con
     `chore(<ID>): codemap` (o `update CODEMAP` se rigenerazione).
     Se durante l'esplorazione emerge che un componente non
     checkato è rilevante, l'agente propone al dev di spuntarlo in
     `TASK.md` e interrompe (non tocca `TASK.md` da solo).
  2. **Fase discuss (sempre).** Intervista strutturata sulle gray
     area. Prima di ciascuna domanda che richiede contesto codice,
     carica il **pertinente + collegato** dalla `CODEMAP.md`
     (regola d'uso in §2.2). Riprende da dove si era interrotto se
     `DISCUSS.md` esiste già. Scrive `DISCUSS.md` e committa con
     `chore(<ID>): update DISCUSS`.
- Rigenerazione della mappa: al run successivo, se `CODEMAP.md`
  sembra stantia (data molto vecchia o molti commit dopo), avvisa
  il dev in advisory e offre rigenerazione. Mai bloccare.
- Non modifica `TASK.md`.

### 3.2 `/task-plan`

- Input: `TASK.md` + `CODEMAP.md` + `DISCUSS.md`.
- Output:
  - `PLAN.md` creato con indice degli step, strategia, rischi.
  - `steps/NN-<slug>.md` per ciascuno step identificato, tutti con
    `status: todo`.
- Comportamento: intervista per scomporre il lavoro in step atomici,
  ciascuno eseguibile come singolo commit. Prima di proporre la
  scomposizione, carica dalla `CODEMAP.md` gli argomenti pertinenti
  al task (regola d'uso in §2.2) per ancorare gli step a file reali.
  Propone una scomposizione, chiede conferma/modifica, genera i file.
- Re-run: se `PLAN.md` esiste già, `/task-plan` propone di
  **estendere** (aggiungere step) o di **rifare** il piano (marcando
  i vecchi step come `blocked` e spostandoli in `steps/archive/`, mai
  cancellati).
- Commit atteso: `chore(T-NNN): plan` (un solo commit per creazione
  iniziale, commit successivi per update del piano).

### 3.3 `/task-execute`

- Input: `PLAN.md` + `steps/` + `CODEMAP.md`.
- Output: codice reale nel repo + aggiornamenti del file step
  corrente + aggiornamento incrementale di `CODEMAP.md` a fine step.
- Comportamento:
  1. Trova il primo step con `status: todo` (o `doing`, se interrotto).
  2. Mette lo step in `status: doing`.
  3. Prima del mini-plan di implementazione, carica dalla
     `CODEMAP.md` gli argomenti pertinenti allo step (regola d'uso
     in §2.2): legge `Primary + Related` dei concern coinvolti.
  4. **Genera codice** per eseguire la sezione `## Execute` dello step.
  5. Logga comandi e decisioni in `## Log` dello step.
  6. Esegue i check della sezione `## Verify` dello step. Se
     falliscono, stato → `failed`, ferma tutto, chiede al dev.
  7. Se tutto OK, stato → `done`, propone commit atomico con formato
     `feat(T-NNN/NN): <titolo step>`.
  8. **Aggiorna `CODEMAP.md` in modo incrementale**: registra i file
     creati/rinominati/cancellati da questo step, aggiornando le
     sezioni di `Primary`/`Related` pertinenti. Rispetta i cap
     dimensionali; se l'aggiornamento richiede una ristrutturazione
     ampia, **non** riscrive tutto ma segnala al dev che conviene
     rigenerare con `/task-codemap`. L'aggiornamento entra nello
     stesso commit dello step.
  9. **Fermata obbligatoria.** Chiede conferma esplicita prima di
     procedere allo step successivo. Non esiste (per ora) una
     modalità "esegui tutto di seguito". Un eventuale `--yolo` è
     opt-in e sarà introdotto solo se si dimostra necessario.
- Sicurezza git: le modifiche al codice sono dell'agente; il commit
  finale rientra nell'eccezione della Git Safety Rule per
  `/task-execute` (da dichiarare nell'header del prompt, come fatto
  per `/task-start`).

### 3.4 `/task-verify`

- Input: `TASK.md` + tutti gli step in `done` + `VERIFY.md` (se esiste).
- Output: `VERIFY.md` aggiornato (DoD + Verify Log).
- Comportamento: esegue in ordine le voci della DoD globale, logga
  l'output, spunta ciò che passa, lascia non-spuntato ciò che fallisce.
  **Advisory:** segnala le voci fallite ma non blocca la chiusura del
  task. Il dev decide se tornare in execute/plan o procedere con
  `/pr-open`.

---

## 4. Convenzioni commit

Con il nuovo layout, i commit diventano più granulari e tipizzati.

| Tipo | Formato | Uso |
|---|---|---|
| Step | `feat(T-NNN/NN): <titolo step>` | Generato da `/task-execute` a fine step |
| Discuss | `chore(T-NNN): update DISCUSS` | Al termine di `/task-discuss` |
| Plan | `chore(T-NNN): plan` · `chore(T-NNN): replan` | Al termine di `/task-plan` |
| Verify | `chore(T-NNN): verify` | Al termine di `/task-verify` |
| Stato task | `chore(T-NNN): start task` · `chore(T-NNN): to review` · `chore(T-NNN): done` | Transizioni di stato del task (cartella) |
| Backlog | `chore(T-NNN): add task to backlog` | `/task-new` |

I commit di step (`feat(T-NNN/NN): …`) sono gli unici che portano codice
reale. Tutti gli altri toccano solo `.pi/tasks/`.

---

## 5. Regole operative chiave

- **Serie stretta degli step.** Nessun grafo, nessuna parallelizzazione.
  L'ordine è dato dal prefisso numerico del filename (`01-`, `02-`, ...).
- **Uno step = un commit.** Se durante execute si scopre che lo step è
  troppo grande, va **spezzato in più step** aggiornando il piano
  (`/task-plan` re-run), non committato come blob.
- **Fermata obbligatoria di `/task-execute`.** L'agente non concatena
  step. Ogni step ha fermata esplicita per conferma dev.
- **DoD advisory.** `/task-verify` non è un gate. Produce diagnosi, non
  permessi.
- **Nessun file del task viene mai cancellato.** Replan: step obsoleti
  vanno in `steps/archive/` con status `blocked`.

---

## 6. Migrazione dal layout precedente

I task esistenti (T-001, T-002) nati come file singolo vanno migrati una
tantum:

- `T-001-aggiunta-lettura-sonda-modbus.md` →
  `T-001-aggiunta-lettura-sonda-modbus/TASK.md`
- `T-002-web-camera.md` →
  `T-002-web-camera/TASK.md`

`DISCUSS.md`, `PLAN.md`, `steps/`, `VERIFY.md` **non** vengono creati
automaticamente: nascono quando il comando corrispondente viene invocato
per la prima volta.

Commit di migrazione: `chore(tasks): migrate to directory layout`.

---

## 7. Impatto sui comandi esistenti

I prompt template attuali presumono il layout "file singolo" e vanno
aggiornati di conseguenza. L'aggiornamento è **pianificato** e verrà
fatto dopo aver scritto questo contratto. Fino ad allora, il layout
effettivo sul disco resta quello vecchio; non ci sono regressioni in
corso.

Comandi impattati (solo aggiornamento di pathing, non di semantica):

- `/task-new` — crea la cartella invece del file.
- `/task-start` — `git mv` della cartella tra gli stati.
- `/task-list` — scansiona directory, non file.
- `/pr-open`, `/pr-merge` — restano in gran parte invariati.
- `/do-git-stuff` — invariato (già generico).

Comandi **nuovi** da introdurre (in quest'ordine):

1. `/task-discuss` (include la generazione automatica di `CODEMAP.md`
   al primo run, come prerequisito interno)
2. `/task-plan`
3. `/task-execute` (aggiorna incrementalmente `CODEMAP.md` a fine
   step)
4. `/task-verify`

---

## 8. Cosa resta fuori scope (volutamente)

- Milestone, roadmap, versioning (fuori scope esplicito del dev).
- Sub-agent orchestration / wave execution (non disponibile in pi,
  non richiesto).
- Esecuzione automatica di più step in sequenza senza fermate.
- DoD come gate bloccante.

Questi punti potranno essere rivalutati in futuro se emergerà un bisogno
concreto. Oggi non lo sono.
