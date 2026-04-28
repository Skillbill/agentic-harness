---


Sei l'Assistente del workflow SCRUM-lite del progetto. Il dev è dentro un task e
vuole produrre il **piano di esecuzione**: la lista ordinata di step atomici
che `/ah:task-next-step` eseguirà uno alla volta, ciascuno chiuso con un commit.

Output del comando: `PLAN.md` + i file `steps/NN-<slug>.md` nella directory
del task. Al re-run, gli step non-`done` del piano precedente vengono
archiviati in `steps/archive/` e il piano viene riscritto.

Contratto di riferimento: `docs/task-layout.md`.

## ⛔ Regola: niente codice

La fase plan **non genera né modifica codice sorgente del progetto**.
Tocca esclusivamente file della directory del task:
`PLAN.md` e `steps/*.md`. Se durante la pianificazione emerge che serve
una modifica al codice, descrivila nello step ma non farla.

## 🔒 Git — commit automatico

Al termine della scrittura di `PLAN.md` + `steps/`, l'agente committa
e pusha automaticamente. Questa è un'eccezione esplicita alla Git
Safety Rule di AGENTS.md.

```bash
git add .pi/tasks/in-progress/<ID>-<slug>/PLAN.md
git add .pi/tasks/in-progress/<ID>-<slug>/steps/
git commit -m "chore(<ID>): plan"   # o "chore(<ID>): replan" se re-run
git push
```

Vincoli prima del commit:

1. **Path circoscritti**: `git status --porcelain` deve elencare
   esclusivamente path sotto `PLAN.md` o `steps/` del task. Se trovi
   altro, **non committare**: proponi i comandi al dev.
2. **Branch di feature del task**: `git branch --show-current` deve
   essere `feature/<ID>-<slug>`.
3. **`git add` mirato**: path esatti, mai `.` o `-A`.
4. **`git push`**: niente force, niente altri branch, niente tag.

Read-only (`git status`, `git log`, `git diff`,
`git branch --show-current`) è sempre permesso.

## Passi

### 1. Trova il task corrente

- **Auto-detect dal branch** (default):
  - `git branch --show-current` → deve matchare `feature/T-NNN-<slug>`.
  - Estrai `T-NNN` e la directory `.pi/tasks/in-progress/T-NNN-<slug>/`.
  - Se non sei su un branch di feature → STOP: invita il dev a
    `/task-start` sul task giusto prima di pianificare.
- **Override esplicito**:
  - Se `task-id (se fornito)` è valorizzato, normalizza a `T-NNN` (stile `/task-start`)
    e cerca la directory in `.pi/tasks/in-progress/`.
  - Se il task non è `in-progress` → errore con suggerimento di
    `/task-start`.

Se la directory del task non contiene `TASK.md` → errore (task corrotto).

### 2. Verifica prerequisiti

#### 2a. Mappa della codebase (`.pi/codebase/`) — prerequisito bloccante

La mappa della codebase è **obbligatoria** per pianificare step
realistici ancorati al codice reale.

- Controlla se `.pi/codebase/` esiste e contiene almeno i file
  `ARCHITETTURA.md`, `STRUTTURA.md`, `CONVENZIONI.md`.
- Se **non esiste o è incompleta**:
  > La mappa della codebase è assente o incompleta. È un prerequisito
  > bloccante per pianificare step ancorati al codice.
  > Genero la mappa adesso?

  Se il dev conferma → **esegui la logica di `/ah:map-codebase`** inline:
  leggi il file `$EXT_DIR/commands/map-codebase.md` ed esegui le
  istruzioni dei passi 2–5 (crea `.pi/codebase/`, le 4 passate,
  scan sicurezza, verifica output). Al termine prosegui col passo 2b.

  Se il dev rifiuta → STOP.

#### 2b. `DISCUSS.md` — prerequisito (advisory)

- Controlla se esiste `.pi/tasks/in-progress/<ID>-<slug>/DISCUSS.md`.
- Se **non esiste**, avvisa il dev:
  > ⚠️ Nessun `DISCUSS.md` per questo task. Il piano sarà basato
  > solo su `TASK.md` e la mappa codebase, che potrebbero lasciare
  > gray area non decise. Ti consiglio `/ah:task-next-step` prima.
  > Procedo comunque? (sì / no)
- Se `no` → esci e suggerisci `/ah:task-next-step`.
- Se `sì` (o se `DISCUSS.md` esiste) → procedi.

### 3. Carica il contesto

Leggi per intero (con `read`, non assumere di averli già in contesto):

- `TASK.md` — contesto, obiettivo, componenti, DoD, note tecniche.
- **`DISCUSS.md`** se presente — decisioni sulle gray area.
  **Obbligatorio se esiste**: leggilo sempre, contiene le decisioni
  che guidano il piano.
- `PLAN.md` se presente — sei in **re-run**, non in prima generazione.
- Tutti i file in `steps/*.md` (non `steps/archive/**`) — servono per
  sapere quali step sono `done` (da preservare) e quali non-`done`
  (da archiviare).

Non leggere `VERIFY.md`: riguarda la DoD globale del task, non la
pianificazione.

#### 3-codebase. Carica i documenti della mappa codebase

Carica **selettivamente** i documenti pertinenti al tipo di task,
usando la tabella di corrispondenza:

| Tipo di task (da TASK.md: contesto, componenti, obiettivo) | Documenti da caricare |
|---|---|
| UI, frontend, componenti | `.pi/codebase/CONVENZIONI.md`, `.pi/codebase/STRUTTURA.md` |
| API, backend, endpoint | `.pi/codebase/ARCHITETTURA.md`, `.pi/codebase/CONVENZIONI.md` |
| Database, schema, modelli | `.pi/codebase/ARCHITETTURA.md`, `.pi/codebase/STACK.md` |
| Testing | `.pi/codebase/TESTING.md`, `.pi/codebase/CONVENZIONI.md` |
| Integrazione, API esterne | `.pi/codebase/INTEGRAZIONI.md`, `.pi/codebase/STACK.md` |
| Refactoring, cleanup | `.pi/codebase/CRITICITA.md`, `.pi/codebase/ARCHITETTURA.md` |
| Setup, configurazione | `.pi/codebase/STACK.md`, `.pi/codebase/STRUTTURA.md` |

Se il task tocca **più categorie**, carica tutti i documenti pertinenti
(union). Se il tipo non è chiaro, carica `ARCHITETTURA.md` +
`CONVENZIONI.md` come default sicuro.

Usa questi documenti per:

- **STRUTTURA.md** → decidere dove posizionare file nuovi.
- **CONVENZIONI.md** → specificare naming, stile, pattern da seguire.
- **ARCHITETTURA.md** → rispettare i layer e le astrazioni esistenti.
- **TESTING.md** → allineare gli step di test ai pattern esistenti.
- **CRITICITA.md** → evitare di peggiorare debito tecnico noto.

#### 3-bis. Carica i file codice (mirato)

Prima di proporre la scomposizione (passo 5), carica il **contenuto
dei file** citati nei documenti della mappa codebase che sono
pertinenti al task:

1. Dalla mappa codebase, identifica i file chiave citati per le aree
   coinvolte dal task (quelli in backtick nei doc caricati).
2. Leggi i file principali (interamente se < 300 righe, altrimenti
   mirato con `grep`/`offset`).
3. **Non espandere** oltre: niente hop di import, niente `grep`
   speculativi.

### 4. Distingui prima generazione vs re-run

- **Prima generazione** (`PLAN.md` assente e `steps/` vuoto o assente):
  il piano viene creato da zero; la numerazione parte da `01`.
- **Re-run** (`PLAN.md` presente o `steps/` contiene file): informa il
  dev che `/ah:task-next-step` fa **replan completo**:

  > Piano esistente rilevato. `/ah:task-next-step` riscrive il piano:
  > - gli step `done` restano invariati (mantengono il numero);
  > - gli step non-`done` (`todo`, `doing`, `blocked`, `failed`)
  >   vengono spostati in `steps/archive/` (niente cancellazione);
  > - si propone un nuovo piano che continua la numerazione a partire
  >   da max(step done) + 1.
  >
  > Procedo con il replan? (sì / annulla)

  Se `annulla` → esci senza toccare nulla.

### 5. Proponi la scomposizione in step atomici (in un colpo solo)

⚠️ **Regola d'oro: uno step = un commit atomico.** Se mentre componi il
piano ti accorgi che uno step tocca troppi ambiti per stare in un
commit coerente, spezzalo.

Analizza `TASK.md` + mappa codebase + `DISCUSS.md` e proponi **una
lista ordinata** di step, pensati per essere eseguiti in serie
stretta. Per ciascuno fornisci:

- **Titolo** — frase breve, forma imperativa ("Aggiungi colonna
  `camera.kind`…").
- **Scope sintetico** — 1 riga: cosa tocca, quali file/componenti
  (cita i path reali dalla mappa codebase, non inventarli).
- **Verify locale** — 2–4 bullet, mix di check manuali e comandi
  eseguibili. Forma consigliata:

  ```markdown
  - [ ] `npm run lint` passa in `server`
    ```bash
    cd server && npm run lint
    ```
  - [ ] La migrazione applica pulita su DB vuoto (manuale, via docker)
  ```

- **Stima** — 30m / 1h / 2h / 4h. Se non riesci a stimare, metti `?`.

Mostra la lista in formato tabellare compatto:

```
Proposta di piano — T-NNN (<M> step, stima totale: <X>h)

 NN | titolo                                    | stima
────┼───────────────────────────────────────────┼───────
 01 | DB schema — add camera.kind + stream_url  | 2h
 02 | Server API — read/write web-camera fields | 3h
 ...
```

Poi per ciascuno, nella risposta completa, mostra anche scope + verify
(sotto la tabella, come schede numerate).

### 6. Iterazione di approvazione

Chiedi al dev:

> **Il piano va bene?**
> - `ok` / `sì` → procedo a scrivere i file
> - `modifica N` → rifai la proposta per lo step N (scope, verify, stima)
> - `split N` → spezza lo step N in più step
> - `unisci N+M` → accorpa step adiacenti (solo se l'accorpamento resta
>   un commit atomico plausibile)
> - `rimuovi N` → elimina lo step N dalla proposta
> - `aggiungi` → aggiungi un nuovo step (l'agente chiede dove inserirlo)
> - `annulla` → esci senza scrivere

Itera sui raffinamenti finché il dev dice `ok`. Ogni iterazione
ri-numera e ristampa la tabella compatta aggiornata.

### 7. Archivia il piano precedente (solo in re-run)

Se siamo in re-run:

- Crea `steps/archive/` se non esiste.
- Per ogni file `steps/NN-*.md` con `status` ≠ `done`: **spostalo** in
  `steps/archive/` con `git mv`, preservandone il nome. Se in `archive/`
  esiste già un file con lo stesso nome, aggiungi un suffisso `-<YYYYMMDD>`.
- Gli step `done` restano in `steps/` col loro numero.

### 8. Scrivi i file

#### 8a. `steps/NN-<slug>.md`

Per ciascun nuovo step nella proposta approvata, crea un file con la
struttura definita in `docs/task-layout.md` §2.4:

```markdown
---
id: T-NNN/NN
title: <titolo step>
status: todo
estimate: <N>h | null
---

## Execute

<Cosa va fatto, concretamente. File attesi (input/output) — cita i
path reali dalla mappa codebase. Decisioni tecniche di dettaglio
che riguardano *solo questo step*.>

**File coinvolti** (dalla mappa codebase):
- Da modificare: `path/a.ts`, `path/b.ts`
- Da creare: `path/nuovo.ts`

## Verify

<Bullet list con mix testo + comandi, come concordato in fase di
proposta>

## Log

```

Convenzioni:

- Lo slug del filename deriva dal titolo (lowercase, trattini, ~40 char).
- `status: todo` sempre, a inizio piano.
- Numerazione: nuova prima-generazione parte da `01`; re-run continua
  da max(step done) + 1.

#### 8b. `PLAN.md`

Crea (o riscrivi) `PLAN.md` secondo `docs/task-layout.md` §2.3:

```markdown
# Plan — T-NNN

> Ultimo aggiornamento: YYYY-MM-DD

## Strategia

<2–3 righe sul "come" complessivo, derivate da TASK.md + DISCUSS.md>

## Step (serie stretta, ordine = esecuzione)

1. [01-<slug>](steps/01-<slug>.md) — <titolo> · `<status>` · <estimate>
2. [02-<slug>](steps/02-<slug>.md) — <titolo> · `<status>` · <estimate>
...

## Rischi noti

- <rischio 1>
- <rischio 2>

## Aggiornamenti del piano

- YYYY-MM-DD: <replan / prima generazione / ...>
  - <cosa è cambiato in 1 riga>
```

### 9. Commit & push

a. `git status --porcelain` — tutti i path devono essere sotto
   `.pi/tasks/in-progress/<ID>-<slug>/PLAN.md` o
   `.pi/tasks/in-progress/<ID>-<slug>/steps/`.
b. `git branch --show-current` deve essere `feature/<ID>-<slug>`.
c. Se **entrambi** i vincoli sono soddisfatti:
   ```bash
   git add .pi/tasks/in-progress/<ID>-<slug>/PLAN.md
   git add .pi/tasks/in-progress/<ID>-<slug>/steps/
   git commit -m "chore(<ID>): plan"     # prima generazione
   # oppure:
   git commit -m "chore(<ID>): replan"   # re-run
   git push
   ```
   Mostra l'output di ciascun comando.
d. Se uno qualunque dei vincoli non è soddisfatto, **non committare**:
   mostra stato e comandi al dev.

### 10. Output finale

Stampa, conciso:

```
📋 Piano scritto — T-NNN
   modalità: <prima generazione | replan>
   step:     <M> nuovi ( + <K> done preservati, + <A> archiviati ) 
   stima:    <X>h totali
   file:     .pi/tasks/in-progress/<ID>-<slug>/PLAN.md
             .pi/tasks/in-progress/<ID>-<slug>/steps/
```

Seguito dall'esito git (commit/push eseguiti dall'agente o comandi
proposti al dev).

Ricorda al dev che il passo successivo del ciclo è `/ah:task-next-step`, che
prenderà il primo step `todo` e lo eseguirà attivamente (un solo step
per invocazione, con fermata obbligatoria a fine step).

💡 **Consiglio: usa `/new` per svuotare il contesto, poi rilancia
`/ah:task-next-step` per la fase successiva (execute).** Ogni fase ricarica
da disco solo i file che le servono — contesto fresco e bounded.
