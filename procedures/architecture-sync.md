# Procedura: Architecture Sync

> ⚠️ Questo **non** è un prompt template. È una procedura riutilizzabile,
> richiamata da altri prompt (`.pi/prompts/*.md`) quando serve allineare la
> documentazione di architettura del progetto con la codebase reale.
>
> Non esiste un comando `/architecture-sync`: la logica viene invocata
> inline da altri flussi (attualmente `/task-new`, in apertura del turno
> "Componenti coinvolti").

## Scopo

Mantenere allineata la documentazione di architettura (`docs/architecture.html`
e le sezioni collegate di `docs/project.md`) con i moduli realmente presenti
nella codebase. La procedura è **interattiva**: confronta codebase e doc,
segnala le differenze, fa domande mirate al dev, e solo alla fine aggiorna
la doc.

> ℹ️ `docs/architecture.png` **non** è più una fonte valida: è stato
> deprecato a favore del solo `docs/architecture.html`. Non leggerlo, non
> aggiornarlo, non rigenerarlo.

## 🔒 Git Safety Rule (nessuna eccezione)

Regola globale (AGENTS.md): l'agente non muta lo stato di git. Questa
procedura **non dichiara eccezioni**: puoi modificare file sotto `docs/`,
ma **non fai** `git add` / `git commit` / `git push`. Al termine proponi
al dev i comandi git da eseguire a mano.

⚠️ **Interazione con prompt chiamanti**: se questa procedura è invocata
da un prompt che ha una propria eccezione git (es. `/task-new` può
committare il file del task nel backlog), le modifiche a `docs/` fatte
qui **non rientrano** in quell'eccezione. Il prompt chiamante deve
proporre al dev i comandi git per i file sotto `docs/` **separatamente**
dal proprio commit, non accorparli.

Sono permesse le letture read-only (`git status`, `git diff`,
`git branch --show-current`, `git log`).

## Obiettivo

1. Ricavare dalla **codebase** l'elenco dei moduli/componenti effettivi.
2. Ricavare dalla **documentazione** (`docs/architecture.html` come fonte
   autorevole, più eventuali riferimenti in `docs/project.md`) l'elenco
   dei componenti attualmente documentati.
3. Calcolare il **diff**: moduli nuovi (in codebase ma non in doc) e
   moduli obsoleti (in doc ma non in codebase).
4. Intervistare il dev sulle differenze (non decidere da solo).
5. Applicare le modifiche concordate a `docs/architecture.html` (e, se
   serve, a `docs/project.md`).

## Passi

### 1. Contesto di lavoro

Esegui `git branch --show-current` e `git status --porcelain`. Avvisa il
dev se:
- Non è su `main` (non bloccare: solo nota informativa).
- Ci sono già modifiche non committate sotto `docs/` (potrebbero
  confondere il diff finale).

### 2. Scansione codebase — moduli effettivi

Considera "modulo/componente del progetto" ogni cartella di primo livello
del repo che rappresenta un servizio/app/area funzionale distinta.
Regole operative:

- Elenca le cartelle di primo livello del repo (`ls -1` nella root).
- **Escludi** sempre: `.git`, `.pi`, `node_modules`, `release`, `attic`,
  `docs`, `script`, `.racetab`, `.vscode`, `.github`, file dotfile
  singoli, e qualunque cartella che sia chiaramente solo
  support/tooling (es. `postgres-data` se presente).
- **Includi** cartelle che contengono almeno uno di questi indicatori:
  - `package.json` (app Node/TS),
  - `liquibase.yml` / `changelog*.xml` (schema DB),
  - `Dockerfile` o `docker-compose*.yml`,
  - `src/` con sorgenti chiaramente di un servizio.
- Per ogni cartella inclusa, ricava un **nome umano** (quello che
  comparirebbe in `<div class="label">` nel diagramma). Convenzione:
  mappa i nomi di cartella noti ai label già usati nel diagramma quando
  esistono (vedi passo 3); per le cartelle nuove usa uno slug leggibile
  (es. `mock-backend` → "Mock Backend").
- Oltre alle cartelle, considera elementi di infrastruttura che sono
  "moduli architetturali" anche se non sono cartelle del repo (es.
  reverse proxy Nginx, database PostgreSQL, backend esterno TT&T). Non
  inventarli: includili solo se trovi evidenza nella codebase
  (`config/`, `docker-compose`, `.env.example`, `AGENTS.md`) e marcali
  come *infra* nell'output del diff, così il dev sa che non sono cartelle.

Produci una **tabella interna** `codebase_modules` con, per ogni modulo:
`label`, `origine` (cartella path o "infra"), `evidenza` (file trovato).

### 3. Scansione documentazione — moduli attualmente documentati

Fonte autorevole: `docs/architecture.html`. Estrai tutti i label con:

```bash
grep -oE '<div class="label">[^<]+</div>' docs/architecture.html \
  | sed -E 's|<div class="label">([^<]+)</div>|\1|'
```

Opzionalmente, controlla se `docs/project.md` sezione "Componenti" cita
altri nomi (link, elenchi, immagini). Non considerare autorevole
`AGENTS.md` per la lista moduli: è un riferimento operativo, non il
diagramma.

Produci `doc_modules` (lista di label documentati).

### 4. Diff

Calcola:

- `nuovi_in_codebase` = moduli in `codebase_modules` la cui `label` (o
  un match ragionevole, case-insensitive) **non** è in `doc_modules`.
- `obsoleti_in_doc` = label in `doc_modules` che non trovano
  corrispondenza in `codebase_modules`.
- `match_ok` = label che compaiono in entrambi (mostrare solo come
  conteggio, non come elenco verboso).

Mostra il diff con un formato visuale compatto, esempio:

```
📐 Architettura — diff codebase ↔ docs/architecture.html

In codebase ma non in doc (nuovi)
  + e2e-server-tests        (cartella e2e-server-tests/ con package.json)
  + InfluxDB                 (infra: referenziato in config/…)

In doc ma non in codebase (obsoleti?)
  - Device Simulator         (nessuna cartella corrispondente)

Allineati: 8 moduli
```

Se `nuovi_in_codebase` e `obsoleti_in_doc` sono entrambi vuoti, stampa:

```
✅ Architettura allineata. Nessuna modifica necessaria.
```

…e termina la procedura qui senza toccare file.

### 5. Intervista sul diff (solo se ci sono differenze)

**Una domanda per turno.** Per ciascun elemento del diff, chiedi al dev
cosa fare. Non raggruppare tutto in un unico muro di testo.

Per ogni elemento in `nuovi_in_codebase`:
- «Aggiungo `<label>` al diagramma? (sì / no / rinomina in … / salta)»
- Se sì e il modulo è *infra* (non cartella), chiedi una breve
  descrizione / tech (es. "InfluxDB v2.7 – time-series").
- Chiedi almeno **una** relazione con gli altri moduli già presenti
  (es. "Server → InfluxDB (scrittura dati sonde)"), così il diagramma
  resta coerente e non compare un nodo isolato.

Per ogni elemento in `obsoleti_in_doc`:
- «Rimuovo `<label>` dal diagramma? (sì / no, è ancora vivo ma non ha
  cartella / rinomina in …)»
- Se "no", registra il motivo (andrà eventualmente in un commento HTML
  nel file).

Shortcut accettati: `skip`, `-`, `non so`, `dopo` → salta quell'elemento
senza toccarlo; `basta` / `stop` → interrompi e procedi con ciò che è
stato deciso fin qui.

### 6. Riepilogo e conferma

Prima di scrivere, mostra un piano sintetico:

```
Piano di aggiornamento docs/architecture.html
  + aggiungo nodo "InfluxDB"   (infra, "v2.7 time-series")
  + relazione   Server → InfluxDB   ("scrittura dati sonde MODBUS")
  - rimuovo nodo "Device Simulator"
  ~ rinomino   "Mock Backend" → "Mock TT&T Backend"
```

Chiedi conferma: «Procedo con queste modifiche? (sì / annulla / modifica)».

### 7. Applicazione delle modifiche

Se confermato:

1. Backup logico: prima di editare, leggi il file per intero e conserva
   in memoria la struttura (box, frecce/linee, stili CSS).
2. Per **aggiungere** un nodo in `docs/architecture.html`:
   - Trova una classe CSS coerente (`server`, `configurator`, `nvd`, …)
     o crea una nuova classe con un colore neutro se il tipo di modulo
     è nuovo (es. *infra-db* per database time-series).
   - Inserisci il blocco `<div class="box …"><div class="label">…</div>
     <div class="tech">…</div></div>` in posizione coerente rispetto
     alle relazioni dichiarate dal dev. Se non sei certo del layout,
     aggiungilo sotto gli altri nodi con un `top`/`left` ragionevole e
     segnala nel riepilogo finale che il posizionamento andrà rivisto.
   - Aggiungi anche le frecce/linee richieste (stesso stile di quelle
     esistenti), con i commenti HTML coerenti
     (`<!-- Server to InfluxDB -->`).
3. Per **rimuovere** un nodo: elimina sia il `<div class="box …">` sia
   tutte le linee/frecce che lo referenziano e i relativi commenti HTML.
4. Per **rinominare** un nodo: aggiorna solo il contenuto di
   `<div class="label">` (e i commenti HTML che usano quel nome). Non
   toccare classi CSS a meno che il dev lo abbia chiesto esplicitamente.
5. Se `docs/project.md` cita nominalmente i moduli modificati (sezione
   "Componenti" o elenchi), aggiorna anche quelle occorrenze. Non
   riscrivere testo non correlato.

Non toccare altri file sotto `docs/` salvo richiesta esplicita nel
riepilogo.

### 8. Output finale della procedura

Mostra al dev:

- Riepilogo delle modifiche effettivamente applicate (nodi aggiunti /
  rimossi / rinominati, relazioni nuove).
- Elenco dei file toccati.
- Eventuali **TODO residui** che l'agente non ha potuto risolvere (es.
  posizionamento `top`/`left` da rivedere a occhio nel browser).
- Comandi git **da eseguire a mano** (Git Safety Rule, nessuna
  eccezione qui):
  ```
  git status
  git diff docs/architecture.html
  git add docs/architecture.html docs/project.md   # se toccato
  git commit -m "docs(architecture): sync con codebase (+InfluxDB, -Device Simulator)"
  git push
  ```

Se l'utente ha annullato al passo 6, non scrivere nulla e termina la
procedura con un messaggio neutro («Nessuna modifica applicata»).

## Modalità silenziosa (auto)

Un prompt chiamante può invocare la procedura in **modalità silenziosa**
(es. `/task-new` la usa così: il dev sta creando un task, non vuole essere
interrotto da un'intervista sull'architettura). In questa modalità:

- **Niente intervista** (passo 5 saltato del tutto). Niente domanda di
  conferma (passo 6 saltato).
- **Niente output verboso** verso il dev: nessun diff stampato, nessun
  riepilogo intermedio.
- **Decisioni automatiche** (default conservativi):
  - `nuovi_in_codebase` → **aggiungi** ogni nodo al diagramma. Per il
    posizionamento e le relazioni, usa euristiche ragionevoli (vedi sotto)
    e annota con commento HTML `<!-- TODO: posizionamento da rivedere -->`
    così il dev può ritoccare a mano in seguito.
  - `obsoleti_in_doc` → **non rimuovere nulla**. Mantieni i nodi
    esistenti: cancellare automaticamente è troppo rischioso (potrebbero
    essere infra non rappresentate da cartelle). Limitati a ricordare
    questi nodi nell'output finale come segnalazione.
  - Nessun `rinomina` automatico.
- **Euristica di relazione per nodi nuovi**: se il modulo nuovo è una
  cartella con `package.json` o `Dockerfile` di tipo servizio, collegalo
  al `Server` con una freccia generica; se è *infra* (DB, message bus),
  collegalo come destinazione del `Server`. Non inventare relazioni con
  altri moduli specifici.
- **Output al chiamante**: un solo messaggio sintetico, una riga, del
  tipo:
  - `✅ Architettura allineata` (nessuna modifica),
  - `📐 Architettura aggiornata: +N nodi (M obsoleti segnalati)`
    (modifiche applicate), oppure
  - `⚠ Architecture-sync silenziosa fallita: <motivo>` (in caso di
    errore, non bloccare il flusso chiamante: il task viene creato
    ugualmente, e il dev sistema l'architettura a parte).
- **Git**: nessuna eccezione, come al solito. Se la procedura ha
  modificato `docs/architecture.html` / `docs/project.md`, lo segnala al
  prompt chiamante via il flag del Contratto di ritorno (sotto), che
  proporrà al dev i comandi git separatamente.

## Contratto di ritorno al prompt chiamante

Al termine della procedura (sia che abbia modificato file, sia che
tutto fosse già allineato, sia che l'utente abbia annullato), restituisci
al flusso chiamante:

1. La **lista corrente dei componenti del progetto** come risulta ora dal
   diagramma aggiornato (`codebase_modules` dopo eventuali decisioni di
   rename/skip del dev). Questo è il dato che il prompt chiamante userà
   nei turni successivi (es. in `/task-new`, per la scelta dei
   componenti impattati).
2. Un flag che indichi se `docs/architecture.html` e/o `docs/project.md`
   sono stati modificati, così il prompt chiamante sa che quei file non
   rientrano nella sua eventuale eccezione git e vanno proposti al dev
   separatamente.
