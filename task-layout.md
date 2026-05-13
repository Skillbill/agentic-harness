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

## 1. Layout directory del task

Un task = una **cartella** `T-NNN-slug/` che contiene più file.
La cartella si sposta tra gli stati esattamente come faceva il file.

```
.pi/tasks/
├── backlog/
│   └── T-NNN-slug/
│       └── TASK.md                 ← creato da /task-new
├── in-progress/
│   └── T-NNN-slug/
│       ├── TASK.md
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

## 2. Mappa della codebase (`.pi/codebase/`) — prerequisito di progetto

La mappa della codebase è una risorsa **di progetto** (non del singolo
task), prodotta da `/ah:map-codebase`. Contiene 7 documenti strutturati
che descrivono aspetti trasversali dell'intero progetto:

| Documento | Contenuto |
|---|---|
| `STACK.md` | Linguaggi, runtime, framework, dipendenze, configurazione |
| `INTEGRAZIONI.md` | API esterne, database, provider auth, webhook |
| `ARCHITETTURA.md` | Pattern, layer, flusso dati, astrazioni, entry point |
| `STRUTTURA.md` | Layout directory, posizioni chiave, dove aggiungere codice |
| `CONVENZIONI.md` | Stile codice, naming, pattern, gestione errori |
| `TESTING.md` | Framework test, struttura, mocking, coverage |
| `CRITICITA.md` | Debito tecnico, bug noti, sicurezza, performance |

### Prerequisito bloccante

La mappa è **obbligatoria** per le fasi `discuss`, `plan` e `execute`.
Se `.pi/codebase/` non esiste o è incompleta quando una fase la richiede,
l'agente **propone di generarla inline** eseguendo la logica di
`/ah:map-codebase`. Se il dev rifiuta, la fase si ferma.

### Caricamento selettivo

Le fasi non caricano tutti i 7 documenti: la selezione è **per-task**
ed è dichiarata nel frontmatter YAML `context-needed:` in cima a
`PLAN.md` (vedi §3.3). `PLAN.md` è l'autorità: discuss/execute/verify
caricano via `load_codebase_doc` esattamente i doc elencati lì —
niente di più, niente di meno. La lista può essere vuota
(`context-needed: []`) per task che non hanno bisogno di contesto
codebase.

Quando `PLAN.md` non esiste ancora (tipicamente durante `/task-discuss`,
o per il primo `/task-plan`), la fase ricade sull'**INDEX**
(`.pi/codebase/INDEX.md`) — un elenco compatto `<path>: <summary>` —
e usa il proprio giudizio per chiamare `load_codebase_doc` solo sui
documenti pertinenti. Non esiste più una tabella statica tipo-task →
documento: la scelta è esplicita per ogni task.

### Aggiornamento

La mappa viene aggiornata:
- **Manualmente** dal dev con `/ah:map-codebase` (tipicamente dopo
  cambiamenti significativi alla codebase).
- **Automaticamente** da `/ah:task-done` alla chiusura di un task
  (rigenera la mappa per riflettere le modifiche introdotte).

### CODEMAP.md — deprecata

> ⚠️ **`CODEMAP.md` (per-task) è deprecata.** I task esistenti che la
> contengono possono mantenerla come riferimento storico, ma le fasi
> del ciclo interno non la generano più, non la aggiornano e non la
> richiedono come prerequisito. Il contesto codice è fornito
> interamente dalla mappa codebase di progetto (`.pi/codebase/`).

---

## 3. File del task

### 3.1 `TASK.md` — la scheda (sempre presente)

Contiene il frontmatter (identità del task) e le sezioni narrative di alto
livello. È il file che vedi per "sapere di che si tratta".

**Frontmatter**:

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

**Sezioni del corpo** (versione snella, post-semplificazione di
`/ah:task-new`):

- `## Contesto` — prosa breve: perché il task esiste.
- `## Obiettivo` — prosa breve: cosa va fatto, scope.
- `## Definition of Done` — voci standard (lint/typecheck/build/test/PR)
  copiate dal template. La DoD "umana" specifica del task, se serve, va
  aggiunta dal dev a mano oppure emergerà in `/ah:task-discuss` /
  `/ah:task-plan`. La fase di verify la legge e la materializza in
  `VERIFY.md`.
- `## Log` (note macro del dev, non collegate ai singoli step).

Le sezioni `## Componenti coinvolti` e `## Note tecniche` **non sono più
parte del template**: `/ah:task-new` non le chiede. Se per un task
specifico il dev vuole tracciarle, può aggiungerle a mano — nessun altro
comando AH le legge come obbligatorie.

### 3.2 `DISCUSS.md` — output della fase discuss (opzionale)

Creato/esteso da `/task-discuss`. Formalizza le domande e risposte
emerse *oltre* l'intervista di `/task-new`, tipicamente:

- Gray area: scelte di UX / comportamento in caso di errore / formati dati.
- Decisioni architetturali discusse e motivate.
- Impatti su data model, API surface, WebSocket events.
- Alternative valutate e scartate.

Struttura:

```markdown
# Discuss — T-NNN

> Ultimo aggiornamento: YYYY-MM-DD

## <Titolo gray area 1>

**Decisione:** ...
**Motivazione:** ...
**Alternative scartate:** ...
**Note / rischi:** ...
```

### 3.3 `PLAN.md` — indice del piano (creato da `/task-plan`)

`PLAN.md` **non contiene il dettaglio degli step**: è un indice ordinato,
più gli aspetti trasversali al piano. In cima a `PLAN.md` vive un blocco
YAML frontmatter con la chiave `context-needed:` che dichiara quali
documenti di `.pi/codebase/` le fasi successive devono caricare via
`load_codebase_doc`.

**Regole della chiave `context-needed:`**

- Valore: lista YAML di **stem** dei file sotto `.pi/codebase/`, cioè
  il nome senza estensione `.md`.
- Ogni stem deve matchare la regex `^[a-zA-Z0-9_-]+$` (la stessa
  applicata da `load_codebase_doc`).
- La lista vuota (`context-needed: []`) è **legale e significativa**:
  indica un task che non necessita di contesto codebase (es. modifiche
  a documenti di processo, pulizia di file di prompt).
- Tutti i comandi che emettono `PLAN.md` (a partire da `/task-plan`)
  **devono** scrivere la chiave, anche se vuota. Parser e fasi
  downstream tollerano l'assenza della chiave per retro-compatibilità,
  ma il template ufficiale la richiede sempre.

```markdown
---
context-needed: [CONVENZIONI, STRUTTURA]
---

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

**Esempio: lista vuota.**

```yaml
---
context-needed: []
---
```

Significa: "Le fasi successive non devono caricare alcun doc da
`.pi/codebase/`." È il valore corretto per task che toccano solo
file di processo (es. template, prompt, doc di design).

**Contro-esempio: estensioni e percorsi sono vietati.**

```yaml
# SBAGLIATO — include l'estensione .md
context-needed: [CONVENZIONI.md, STRUTTURA.md]

# SBAGLIATO — include un percorso
context-needed: [.pi/codebase/CONVENZIONI]

# GIUSTO — solo lo stem
context-needed: [CONVENZIONI, STRUTTURA]
```

Lo stem corrisponde alla parte di `relPath` in `INDEX.md` privata
dell'estensione `.md`: una riga `- CONVENZIONI.md: …` nell'INDEX
diventa lo stem `CONVENZIONI` in `context-needed:`.

### 3.4 `steps/NN-<slug>.md` — un file per step

Ogni step è un **commit atomico** (vedi §5). Il filename ha prefisso
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

**File coinvolti** (dalla mappa codebase):
- Da modificare: `path/a.ts`, `path/b.ts`
- Da creare: `path/nuovo.ts`

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

### 3.5 `VERIFY.md` — DoD globale del task e log della verifica

Creato alla prima esecuzione di `/task-verify`. Contiene **la DoD
globale** del task e il log dei comandi di verifica eseguiti.

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
(Copiata/adattata dalla sezione DoD di TASK.md)
- [ ] ...

## Verify Log

### YYYY-MM-DD HH:MM — /task-verify
- `npm run lint` (server): ✅
- ...
```

---

## 4. Ciclo interno `discuss → plan → execute → verify`

Tutte le fasi richiedono `.pi/codebase/` come prerequisito bloccante
(vedi §2). Se la mappa manca, le fasi propongono di generarla inline.

Tutti e quattro i comandi **auto-detectano il task corrente** dal branch
git (`git branch --show-current` che matchi `feature/T-NNN-*`).

### 4.1 `/task-discuss`

- Input: `TASK.md`, mappa codebase (`.pi/codebase/`), eventuale
  `DISCUSS.md` preesistente.
- Output: `DISCUSS.md` creato o esteso con nuove sezioni.
- Comportamento: carica la mappa codebase pertinente al tipo di task,
  poi conduce un'intervista strutturata sulle gray area. Le domande
  sono ancorate al codice reale grazie ai documenti della mappa.

### 4.2 `/task-plan`

- Input: `TASK.md` + mappa codebase + `DISCUSS.md`.
- Output:
  - `PLAN.md` creato con indice degli step, strategia, rischi.
  - `steps/NN-<slug>.md` per ciascuno step identificato.
- Comportamento: carica la mappa codebase, propone una scomposizione
  in step atomici ancorati ai file reali, chiede conferma, genera i
  file.

### 4.3 `/task-execute`

- Input: `PLAN.md` + `steps/` + mappa codebase.
- Output: codice reale nel repo + aggiornamenti del file step corrente.
- Comportamento:
  1. Trova il primo step `todo` (o `doing` se interrotto).
  2. Carica mappa codebase pertinente allo step.
  3. Mini-plan → approvazione dev → implementazione → verify locale.
  4. Se OK, commit atomico.
  5. **Fermata obbligatoria.** Un solo step per invocazione.

### 4.4 `/task-verify`

- Input: `TASK.md` + tutti gli step + `VERIFY.md` (se esiste).
- Output: `VERIFY.md` aggiornato.
- Comportamento: esegue le voci della DoD globale, logga l'output.
  **Advisory:** non blocca la chiusura del task.

---

## 5. Convenzioni commit

| Tipo | Formato | Uso |
|---|---|---|
| Step | `feat(T-NNN/NN): <titolo step>` | Generato da `/task-execute` |
| Discuss | `chore(T-NNN): update DISCUSS` | Al termine di `/task-discuss` |
| Plan | `chore(T-NNN): plan` · `chore(T-NNN): replan` | Al termine di `/task-plan` |
| Verify | `chore(T-NNN): verify` | Al termine di `/task-verify` |
| Stato task | `chore(T-NNN): start task` · `chore(T-NNN): to review` · `chore(T-NNN): done` | Transizioni di stato |
| Backlog | `chore(T-NNN): add task to backlog` | `/task-new` |
| Mappa codebase | `docs: mappa della codebase` | `/map-codebase` e `/task-done` |

---

## 6. Regole operative chiave

- **Serie stretta degli step.** Nessun grafo, nessuna parallelizzazione.
- **Uno step = un commit.** Se lo step è troppo grande, spezzalo.
- **Fermata obbligatoria di `/task-execute`.** L'agente non concatena step.
- **DoD advisory.** `/task-verify` non è un gate.
- **Nessun file del task viene mai cancellato.** Replan: step obsoleti
  vanno in `steps/archive/`.
- **Mappa codebase obbligatoria.** Le fasi discuss/plan/execute la
  richiedono e la generano inline se manca.
- **Mappa aggiornata alla chiusura.** `/task-done` rigenera la mappa
  per riflettere le modifiche del task.

---

## 7. Cosa resta fuori scope (volutamente)

- Milestone, roadmap, versioning (fuori scope esplicito del dev).
- Sub-agent orchestration / wave execution (non disponibile in pi).
- Esecuzione automatica di più step in sequenza senza fermate.
- DoD come gate bloccante.
