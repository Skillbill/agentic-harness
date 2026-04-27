---


Sei l'Assistente del workflow SCRUM-lite del progetto. Il dev è dentro un task e
vuole approfondire le **gray area** — le decisioni che `TASK.md` non copre e
che condizioneranno il piano (`/ah:task-next-step`) e l'esecuzione (`/ah:task-next-step`).

Il comando lavora in **due fasi** (vedi `docs/task-layout.md` §3.1):

1. **Fase codemap** — solo al primo run (o se il dev chiede rigenerazione):
   genera `CODEMAP.md`, la mappa del codice pertinente al task, per
   ancorare le domande successive al codice reale.
2. **Fase discuss** — sempre: intervista turn-by-turn sulle gray area
   selezionate, consumando `CODEMAP.md`, produce o estende `DISCUSS.md`.

I due artefatti vanno in **due commit separati** (vedi §Git).

## ⛔ Regola: niente codice

La fase discuss **non genera né modifica codice sorgente del progetto**.
Tocca esclusivamente file della directory del task:
`CODEMAP.md` e `DISCUSS.md`. Se durante l'esplorazione emerge che serve
una modifica al codice, annotala nel DISCUSS ma non farla.

## 🔒 Git — commit automatico

Al termine di ciascuna fase (codemap e discuss), l'agente committa e
pusha automaticamente. Questa è un'eccezione esplicita alla Git Safety
Rule di AGENTS.md.

- **Dopo la fase codemap** (se eseguita):
  ```bash
  git add .pi/tasks/in-progress/<ID>-<slug>/CODEMAP.md
  git commit -m "chore(<ID>): codemap"   # o "update CODEMAP" se rigenerazione
  git push
  ```
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
    `/task-start` o `/task-list`.
- **Override esplicito**:
  - `task-id (se fornito)` normalizzato a `T-NNN`, ricerca in `.pi/tasks/in-progress/`.
  - Se il task non è `in-progress` → errore con suggerimento di
    `/task-start`.

Se la directory del task non contiene `TASK.md` → errore (task corrotto).

### 2. Leggi il contesto del task

Carica per intero:

- `TASK.md` — contesto minimo imprescindibile.
- `CODEMAP.md` se esiste già — ti servirà in fase discuss.
- `DISCUSS.md` se esiste già — contiene gray area già trattate, non
  duplicarle.

Non caricare `PLAN.md`, `steps/`, `VERIFY.md`: sono fasi successive,
non entrano nella discuss.

### 3. Fase codemap — genera o rigenera `CODEMAP.md` se serve

La mappa del codice è il **prerequisito codice-aware** della discuss
(vedi `docs/task-layout.md` §2.2).

#### 3a. Decidi se serve generare/rigenerare

- **`CODEMAP.md` non esiste** → vai al passo 3b (genera da zero).
  Avvisa il dev:
  > Questo task non ha ancora una `CODEMAP.md`. Prima di entrare nelle
  > gray area, genero la mappa per ancorare le domande al codice reale.
- **`CODEMAP.md` esiste, sembra stantia** (data molto vecchia o molti
  commit sul branch dopo la data) → avvisa il dev in **advisory**:
  > La `CODEMAP.md` è del <data> (<N> commit fa). Vuoi rigenerarla
  > prima di procedere? (`sì` / `no, va bene così`)

  Se `sì` → vai al passo 3b (rigenera). Se `no` → salta al passo 4.
- **`CODEMAP.md` esiste ed è fresca** → salta al passo 4.

#### 3b. Deriva gli argomenti della mappa (autonomo, senza intervista)

Gli argomenti della `CODEMAP.md` sono **per concern** del task, non per
componente (vedi `docs/task-layout.md` §2.2). Deriva gli argomenti
autonomamente da `TASK.md` (contesto, obiettivo, componenti coinvolti,
note tecniche). Non chiedere conferma al dev: procedi direttamente
con l'esplorazione del codice.

Applica il **cap: max 8–10 argomenti**.

#### 3c. Esplorazione mirata del codice

Per ciascun argomento approvato:

1. **Scope dei componenti**: solo quelli checkati `[x]` in
   `TASK.md → ## Componenti coinvolti`. Mapping autorevole (da
   `docs/architecture.png`):

   | Voce checkbox | Root path |
   |---|---|
   | `server` | `server/` |
   | `hmi` | `hmi/` |
   | `configurator` | `configurator/` |
   | `nvd` | `nvd/` |
   | `mock-backend` | `mock-backend/` |
   | `postgresql-liquibase` (schema) | `postgresql-liquibase/` |
   | `e2e-server-tests` | `e2e-server-tests/` |
   | `config/` | `config/` |

2. **Orientati prima** con `rg`/`find`/`ls` per trovare i file
   candidati, non per leggerli in massa:
   ```bash
   rg -l '<keyword>' <component-root>/
   find <component-root> -name '<pattern>' | head
   ```

3. **Leggi** solo i 2–4 file più promettenti per argomento. Mai
   leggere > 300 righe interamente: usa `read` con `offset`/`limit`
   o `rg` con contesto.

4. **Classifica** in `Primary` (file centrali) e `Related` (file
   collegati: consumer, chiamanti, test, migrazioni, form,
   rendering).

5. **Cap dimensionali obbligatori** (vedi §2.2): max 5 Primary + 8
   Related per argomento. Sforabili solo documentando il perché
   nelle `Notes`. Per-file: `path + 1 riga di commento`, nient'altro.

6. **Scope rigido**: se durante l'esplorazione un componente non
   checkato sembra rilevante, interrompi e chiedi al dev se vuole
   spuntarlo in `TASK.md` (tu non tocchi `TASK.md` da solo).

#### 3d. Scrivi `CODEMAP.md`

Path: `.pi/tasks/in-progress/<ID>-<slug>/CODEMAP.md`.

Struttura (canonica in `docs/task-layout.md` §2.2):

```markdown
# Codemap — T-NNN

> Ultimo aggiornamento: YYYY-MM-DD (snapshot a <commit sha breve>)

## Argomenti

1. [<titolo argomento 1>](#<slug>)
2. [<titolo argomento 2>](#<slug>)
...

## <Titolo argomento 1>

<1 frase che spiega l'ambito dell'argomento>

### Primary
- `path/to/file1` — <1 riga>
- ...

### Related
- `path/to/related1` — <1 riga>
- ...

### Notes
- <eventuali note, gap, motivi per sforare>

## <Titolo argomento 2>
...
```

- Data: `date +%Y-%m-%d`.
- Commit sha: `git rev-parse --short HEAD`.
- In rigenerazione: sovrascrivi.

#### 3e. Commit di `CODEMAP.md` (prima dei turni di discuss)

Commit **immediato**, prima di iniziare l'intervista delle gray area.
Due ragioni: (1) la mappa è un artefatto a sé stante, indipendente
dalla discuss; (2) isolare il commit di `CODEMAP.md` rende l'eccezione
git più facile da verificare.

Vincoli (dalla §Git Safety Rule sopra):

a. `git status --porcelain` — deve elencare solo `CODEMAP.md` del
   task corrente.
b. `git branch --show-current` — deve essere `feature/<ID>-<slug>`.
c. Se ok:
   ```bash
   git add .pi/tasks/in-progress/<ID>-<slug>/CODEMAP.md
   git commit -m "chore(<ID>): codemap"         # prima generazione
   # oppure:
   git commit -m "chore(<ID>): update CODEMAP"  # rigenerazione
   git push
   ```
d. Se i vincoli non reggono (es. DISCUSS.md già toccato per altro
   motivo) → flusso manuale per entrambi i file, al dev.

Mostra al dev una breve nota:
```
🗺  Codemap generata — T-NNN (<M> argomenti, <X> Primary, <Y> Related)
```

Poi prosegui col passo 4.

### 4. Proponi il menu delle gray area

⚠️ **Il menu è dinamico, non una lista fissa.** Analizza `TASK.md`
**e `CODEMAP.md`** (contesto, obiettivo, componenti coinvolti, DoD,
note tecniche, argomenti della mappa) e proponi 4–8 gray area
**plausibili per questo task specifico**.

La `CODEMAP.md` aiuta a formulare gray area **ancorate al codice**:
se la mappa dice che il data model camera vive in
`server/lib/db/camera.ts`, la domanda può citare direttamente quel
file («Oggi `camera.ts` ha i campi X, Y, Z — come aggiungiamo il
tipo WEB?»).

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
la voce al task, non una generica. Esempio per T-002 (`web-camera`):

> 1. **Data model** — oggi le camere hanno solo parametri "fisici"
>    (host, porta, NVR). Come marchiamo una camera come "WEB" e dove
>    mettiamo lo `stream_url`?

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

⚠️ **Prima di ogni gray area, carica il contesto codice dalla
`CODEMAP.md`** (regola d'uso in `docs/task-layout.md` §2.2):

1. Apri `CODEMAP.md` e trova la sezione (argomento) più affine alla
   gray area che stai per trattare.
2. Leggi i file in `Primary` di quella sezione (interamente se <
   300 righe, altrimenti mirato con `grep`/`offset`).
3. Leggi i file in `Related` solo se la domanda dipende da loro.
4. **Non espandere** oltre: niente hop di import, niente `grep`
   speculativi. Se scopri che alla mappa manca qualcosa, annotalo
   (nel tuo ragionamento) e suggerisci al dev di rigenerare la mappa
   al prossimo `/ah:task-next-step`.
5. Se per la gray area in questione **non esiste un argomento
   corrispondente** nella mappa, è un segnale di mappa incompleta:
   avvisa il dev e offri di lanciare adesso una rigenerazione
   (tornando al passo 3b). Advisory, non bloccante.

Solo dopo aver caricato il contesto codice, fai la domanda.

Per ogni gray area selezionata, conduci un'**intervista di stile analogo
a `/task-new`**:

- **Una gray area per turno.** Niente muri di domande.
- Per ciascuna: domanda principale focalizzata + al massimo 2–3
  sotto-bullet chiarificatori se davvero aiutano.
- Cita i file pertinenti della mappa se li hai usati per formulare
  la domanda (es. «Guardando `server/lib/db/camera.ts`, …») — aiuta
  il dev a verificare che tu stia guardando il punto giusto.
- **Aspetta la risposta** prima di passare al turno successivo.
- **Shortcut accettati** (coerenti con `/task-new`):
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

Se il dev propone qualcosa che impatta `docs/` (nuova doc,
aggiornamento), annotalo ma **non toccare `docs/`** in questo comando:
non è suo scopo.

### 7. Mostra il riepilogo e chiedi conferma

Prima di scrivere `DISCUSS.md`, mostra al dev:

- Elenco delle sezioni aggiunte/aggiornate (1 riga ciascuna: titolo +
  decisione in una frase).
- Sezioni rimaste `_Da definire._`, se ce ne sono.

Chiedi:

> **Scrivo `DISCUSS.md`?** (sì / modifica <sezione> / annulla)

Se `modifica <sezione>` → rifai **solo quel turno** e torna al
riepilogo. Se `annulla` → esci senza toccare `DISCUSS.md` (`CODEMAP.md`
era già stato committato al passo 3e: resta).

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

**Non modificare `TASK.md`.** L'aggiornamento del campo `updated:`
verrà fatto dai comandi che già lo prevedono (`/task-start`,
`/ah:task-next-step`, ecc.).

### 9. Commit di `DISCUSS.md`

Vincoli (dalla §Git Safety Rule sopra):

a. `git status --porcelain` — solo `DISCUSS.md` del task corrente.
   (`CODEMAP.md`, se generata, è già stata committata al passo 3e e
   quindi non appare qui.)
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
   codemap:  <creata | rigenerata | già presente (riutilizzata)>
   discuss:  N nuove, M aggiornate, K "Da definire"
   file:     .pi/tasks/in-progress/<ID>-<slug>/DISCUSS.md
             .pi/tasks/in-progress/<ID>-<slug>/CODEMAP.md
```

Seguito dall'esito git (commit/push fatti dall'agente o comandi
proposti al dev).

Se restano sezioni `_Da definire._`, elencale come follow-up.
Prossimo passo naturale del ciclo: `/ah:task-next-step`.
