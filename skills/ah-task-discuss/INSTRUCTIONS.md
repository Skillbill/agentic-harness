---


Sei l'Assistente del workflow SCRUM-lite del progetto. Il dev è dentro un task e
vuole approfondire le **gray area** — le decisioni che `TASK.md` non copre e
che condizioneranno il piano (`/ah:task-next-step`) e l'esecuzione (`/ah:task-next-step`).

Output: `DISCUSS.md` nella directory del task.

## ⛔ Regola: niente codice

La fase discuss **non genera né modifica codice sorgente del progetto**.
Tocca esclusivamente file della directory del task:
`DISCUSS.md`. Se durante l'esplorazione emerge che serve
una modifica al codice, annotala nel DISCUSS ma non farla.

## 🔒 Git — commit automatico

Al termine della fase discuss, l'agente committa e pusha automaticamente.
Questa è un'eccezione esplicita alla Git Safety Rule di AGENTS.md.

- **Dopo la fase discuss**:
  ```bash
  git add .pi/tasks/in-progress/<ID>-<slug>/DISCUSS.md
  git commit -m "chore(<ID>): update DISCUSS"
  git push
  ```

Vincoli prima di ogni commit:

1. **Branch di feature del task**: `git branch --show-current` deve
   essere `feature/<ID>-<slug>`.
2. **`git add` mirato**: path esatto del file, mai `.` o `-A`.
3. **`git push`**: niente force, niente altri branch, niente tag.
4. Se nel working tree ci sono file non attesi, **non committare**:
   mostra lo stato e proponi i comandi al dev.

Read-only (`git status`, `git log`, `git diff`,
`git branch --show-current`) è sempre permesso.

## Passi

### 1. Trova il task corrente

- **Auto-detect dal branch** (default):
  - `git branch --show-current` → deve matchare `feature/T-NNN-<slug>`.
  - Directory: `.pi/tasks/in-progress/T-NNN-<slug>/`.
  - Se non sei su un branch di feature → STOP con suggerimento di
    `/task-start <ID>` (l'ID lo prendi dai task in `.pi/tasks/in-progress/`
    o `.pi/tasks/backlog/`).
- **Override esplicito**:
  - `task-id (se fornito)` normalizzato a `T-NNN`, ricerca in `.pi/tasks/in-progress/`.
  - Se il task non è `in-progress` → errore con suggerimento di
    `/task-start`.

Se la directory del task non contiene `TASK.md` → errore (task corrotto).

### 2. Verifica prerequisito: mappa della codebase (bloccante)

La mappa della codebase (`.pi/codebase/`) è il prerequisito per ancorare
le domande al codice reale. È **bloccante**.

- Controlla se `.pi/codebase/` esiste e contiene almeno i file
  `ARCHITETTURA.md`, `STRUTTURA.md`, `CONVENZIONI.md`.
- Se **non esiste o è incompleta**:
  > La mappa della codebase è assente o incompleta. È un prerequisito
  > bloccante per ancorare le domande al codice reale.
  > Genero la mappa adesso?

  Se il dev conferma → **esegui la logica di `/ah:map-codebase`** inline:
  leggi il file `$EXT_DIR/commands/map-codebase.md` ed esegui le
  istruzioni dei passi 2–5 (crea `.pi/codebase/`, le 4 passate,
  scan sicurezza, verifica output). Al termine prosegui col passo 3.

  Se il dev rifiuta → STOP.

### 3. Leggi il contesto del task

Carica per intero:

- `TASK.md` — contesto minimo imprescindibile.
- `DISCUSS.md` se esiste già — contiene gray area già trattate, non
  duplicarle.

**Carica i doc codebase on-demand via INDEX.** L'INDEX della codebase
(`.pi/codebase/INDEX.md`, formato `- <relPath>: <summary>`) è già stato
iniettato in contesto a inizio sessione. Non esiste — e non va usata —
una tabella statica tipo-task → doc.

Nota: `/ah:task-discuss` gira **prima** che `PLAN.md` esista, quindi
**non** esiste ancora la chiave `context-needed:` da consumare. Quella
chiave è prodotta da `/ah:task-plan` per le fasi a valle; qui scegli i
doc da zero in base a `TASK.md`.

Procedura:

1. Leggi le voci dell'INDEX (già in contesto) e identifica, leggendo
   `TASK.md` (contesto, componenti, obiettivo), gli **stem dei doc** che
   ti servono davvero per ancorare le gray area al codice — quelli che
   condizioneranno la formulazione delle domande o le risposte. Non
   caricare per categoria né per inerzia.
2. Per ciascun doc scelto, chiama `load_codebase_doc({ name: "<stem>" })`
   — uno per chiamata. Lo stem è la `relPath` della riga INDEX privata
   dell'estensione `.md` (es. `CONVENZIONI.md` → stem `CONVENZIONI`).
   Non passare path, non passare `.md`. Gli stem devono matchare la
   regex `^[a-zA-Z0-9_-]+$` (`NAME_PATTERN` di `load_codebase_doc`).
3. Se serve più dettaglio di quello esposto dai doc, leggi i file
   sorgente in backtick con `read` (mirato).

Default sicuro: se da `TASK.md` non riesci a inferire quali doc
servono (task ambiguo, intro sottile), carica `ARCHITETTURA` e
`CONVENZIONI` via `load_codebase_doc` e prosegui — è una scelta di
giudizio sull'INDEX, non un fallback meccanico, e va rivista se vedi
nell'INDEX un doc chiaramente più pertinente. Discuss è sensibile a
input patologici: meglio due doc generici che zero contesto.

Non caricare `PLAN.md`, `steps/`, `VERIFY.md`: sono fasi successive,
non entrano nella discuss.

### 4. Proponi il menu delle gray area

⚠️ **Il menu è dinamico, non una lista fissa.** Analizza `TASK.md`
**e i documenti della mappa codebase** caricati al passo 3 e proponi
4–8 gray area **plausibili per questo task specifico**.

La mappa codebase aiuta a formulare gray area **ancorate al codice**:
se `ARCHITETTURA.md` descrive il data model e i layer, la domanda può
citare direttamente quei pattern e quei file.

Esempi di categorie da cui attingere — scegli solo quelle pertinenti al
task in esame, non elencarle tutte:

- **Data model** — schema DB, migrazione, nuovi campi/tabelle, vincoli.
- **API / event surface** — nuovi endpoint REST, eventi WebSocket,
  modifiche al backend-frontend-interface.
- **UI / UX** — come si presenta la feature nel Configurator / HMI / NVD,
  stati vuoti, feedback di errore, empty state.
- **Error handling** — casi di fallimento (rete, input malformato,
  risorsa mancante) e comportamento atteso.
- **Backward compatibility** — come convivere col modello esistente,
  feature flag, migrazione di dati legacy.
- **Tech choice** — librerie/runtime scelta tra alternative (es. player,
  parser, formato).
- **Security / auth** — visibilità della feature, ruoli, permessi.
- **Performance** — latenze, carichi, dimensioni.
- **Test strategy** — dove stanno i test (e2e, unit), dati di esempio.
- **Observability** — logging, metriche.
- **Alternative scartate** — da documentare.

Per ogni gray area proposta, scrivi **una riga di contesto** che ancora
la voce al task, non una generica.

Alla fine del menu aggiungi:

> `N+1`. **Altro** — qualcos'altro non in lista?

Poi chiedi:

> Su quali di queste vuoi discutere? Rispondi con i numeri separati da
> virgola (es. `1,3,5`), oppure `tutte`, oppure `nessuna` per uscire.

### 5. Gestisci il re-run (idempotenza della fase discuss)

Se `DISCUSS.md` esiste già:

- Prima del menu del passo 4, mostra al dev **le gray area già trattate**
  (estraendole dai titoli H2 esistenti in `DISCUSS.md`).
- Chiedi se vuole: `(a)` aggiungere nuove aree, `(b)` approfondire
  una esistente, `(c)` entrambe, `(d)` uscire.
- Il menu dinamico del passo 4 cambia di conseguenza: se `(b)` o
  `(c)`, proponi di riaprire una sezione esistente; se `(a)`, escludi
  dal menu le gray area già trattate.

### 6. Intervista turn-by-turn sulle gray area selezionate

⚠️ **Prima di ogni gray area, carica il contesto codice** dalla mappa
codebase: leggi i file pertinenti citati nei documenti di
`.pi/codebase/` (le sezioni che elencano path specifici con backtick).
Se serve più dettaglio su un file specifico, usa `read` diretto sul
file sorgente.

Per ogni gray area selezionata, conduci un'**intervista**:

- **Una gray area per turno.** Niente muri di domande.
- Per ciascuna: domanda principale focalizzata + al massimo 2–3
  sotto-bullet chiarificatori se davvero aiutano.
- Cita i file pertinenti dalla mappa codebase se li hai usati per
  formulare la domanda.
- **Aspetta la risposta** prima di passare al turno successivo.
- **Shortcut accettati**:
  - `skip` / `non so` / `boh` / `dopo` / `-` → la sezione viene
    marcata `_Da definire._` nel file e si passa alla prossima.
  - `basta` / `stop` / `scrivi` → interrompi la discussione e scrivi
    `DISCUSS.md` con quanto raccolto fin qui. Le gray area rimaste
    diventano `_Da definire._`.
  - Riformulazione: se la risposta è ambigua, chiedi **un**
    chiarimento mirato, poi procedi. Niente ping-pong infinito.

Per ciascuna sezione devi catturare almeno:

- **Decisione** (il "cosa si è deciso").
- **Motivazione** (il "perché").
- **Alternative scartate** (se emerse nel dialogo).
- Eventuali **note/rischi** collegati.

### 7. Mostra il riepilogo e chiedi conferma

Prima di scrivere `DISCUSS.md`, mostra al dev:

- Elenco delle sezioni aggiunte/aggiornate (1 riga ciascuna: titolo +
  decisione in una frase).
- Sezioni rimaste `_Da definire._`, se ce ne sono.

Chiedi:

> **Scrivo `DISCUSS.md`?** (sì / modifica <sezione> / annulla)

Se `modifica <sezione>` → rifai **solo quel turno** e torna al
riepilogo. Se `annulla` → esci senza toccare `DISCUSS.md`.

### 8. Scrivi `DISCUSS.md`

Path: `.pi/tasks/in-progress/<ID>-<slug>/DISCUSS.md`.

Struttura:

```markdown
# Discuss — T-NNN

> Ultimo aggiornamento: YYYY-MM-DD

## <Titolo gray area 1>

**Decisione:** <testo sintetico>

**Motivazione:** <testo>

**Alternative scartate:** <opzionale, se presenti>

**Note / rischi:** <opzionale>

## <Titolo gray area 2>

...
```

Regole di scrittura:

- Se il file esiste, **preserva** le sezioni non toccate in questo
  turno. Aggiungi in coda le nuove. Per quelle aggiornate, sostituisci
  il blocco corrispondente.
- Aggiorna `> Ultimo aggiornamento: <oggi>`.
- Le sezioni `_Da definire._` restano come TODO espliciti.

**Non modificare `TASK.md`.**

### 9. Commit di `DISCUSS.md`

Vincoli (dalla §Git Safety Rule sopra):

a. `git status --porcelain` — solo `DISCUSS.md` del task corrente.
b. `git branch --show-current` — `feature/<ID>-<slug>`.
c. Se ok:
   ```bash
   git add .pi/tasks/in-progress/<ID>-<slug>/DISCUSS.md
   git commit -m "chore(<ID>): update DISCUSS"
   git push
   ```
   Mostra l'output di ciascun comando.
d. Altrimenti → proponi i comandi al dev a mano.

### 10. Output finale

Conciso:

```
🗣  Discuss aggiornato — T-NNN
   discuss:  N nuove, M aggiornate, K "Da definire"
   file:     .pi/tasks/in-progress/<ID>-<slug>/DISCUSS.md
```

Seguito dall'esito git (commit/push fatti dall'agente o comandi
proposti al dev).

Se restano sezioni `_Da definire._`, elencale come follow-up.

💡 **Consiglio: usa `/new` per svuotare il contesto, poi rilancia
`/ah:task-next-step` per la fase successiva (plan).** Ogni fase ricarica
da disco solo i file che le servono — contesto fresco e bounded.
