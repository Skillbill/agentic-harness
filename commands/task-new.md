---
description: Crea un nuovo task nel backlog Efesto (SCRUM-lite)
argument-hint: "<titolo del task>"
---

Sei l'agente del workflow SCRUM-lite di Efesto. Devi creare un nuovo task nel
backlog a partire dal titolo fornito dall'utente, **intervistandolo** per
compilare la scheda in modo completo — niente placeholder lasciati vuoti.

**Titolo fornito:** $@

## 🔒 Git Safety Rule (eccezione dichiarata)

Regola globale (AGENTS.md): l'agente non muta lo stato di git. Questo
prompt dichiara **un'eccezione limitata**: al passo finale PUOI eseguire
`git add`, `git commit` e `git push` — ma **esclusivamente** per il file
del task appena creato nel backlog.

Vincoli obbligatori prima di eseguire qualunque comando git che muta:

1. **Unico file toccato**: verifica con `git status --porcelain` che l'unica
   modifica nel working tree sia `.pi/tasks/backlog/<ID>-<slug>.md`
   (file nuovo, status `??` o `A`). Se ci sono altre modifiche (staged o
   non-staged, in qualunque path), **non fare commit/push**: mostra lo
   stato all'utente e proponi i comandi manualmente, spiegando perché
   non puoi procedere in automatico.

   ⚠️ In particolare, eventuali modifiche a `docs/architecture.html` /
   `docs/efesto.md` introdotte dalla procedura di architecture-sync
   (vedi Turno C) **non** rientrano nell'eccezione e vanno proposte al
   dev come commit separato — mai accorpate al commit del task.
2. **Branch `main`**: conferma con `git branch --show-current` di essere
   su `main`. Se non lo sei, niente commit/push automatici — proponi i
   comandi al dev.
3. **`git add` mirato**: usa sempre il path esatto del file
   (`git add .pi/tasks/backlog/<ID>-<slug>.md`), mai `git add .` o
   `git add -A`.
4. **`git push` mirato**: `git push` pusha solo il commit appena creato
   sul branch corrente (`main`). Non fare push di altri branch, non
   fare force-push, non toccare tag.

Se uno qualunque di questi vincoli non è soddisfatto, ricadi nel
comportamento standard: proponi i comandi all'utente e lui li esegue a
mano.

Operazioni read-only (`git status`, `git log`, `git diff`,
`git branch --show-current`) sono sempre permesse.

## Passi

1. **Verifica contesto git** (read-only):
   - Esegui `git branch --show-current` per sapere su che branch sei.
   - Se NON sei su `main`, avvisa l'utente: il task dovrebbe nascere su `main`
     per essere visibile a tutto il team. Chiedi conferma prima di procedere.

2. **Determina il prossimo ID task**:
   - Scansiona `.pi/tasks/{backlog,in-progress,review,done}/` per tutti i file
     che matchano `T-NNN-*.md`.
   - Estrai il numero più alto e incrementa di 1.
   - Formatta come `T-001`, `T-002`, ecc. (zero-padding a 3 cifre).

3. **Genera lo slug** dal titolo:
   - lowercase, spazi → trattini, rimuovi caratteri non alfanumerici tranne `-`.
   - Tronca a ~50 caratteri.
   - Esempio: "Add web camera support" → `add-web-camera-support`

4. **Intervista l'utente passo-passo** (obbligatorio, sequenziale):

   Leggi prima il template `$EXT_DIR/templates/task.md` per conoscere le sezioni.
   Poi conduci un'**intervista turn-by-turn**: una domanda (focalizzata) per
   turno, aspetta la risposta dell'utente, poi passa alla successiva.

   ⚠️ **Regole dell'intervista** — valgono per tutti i turni:
   - **Una sola sezione per turno.** Niente muri di 6 domande in blocco.
   - **Poni la domanda principale e al massimo 2–3 sotto-domande chiarificatrici**
     come bullet, solo se servono davvero a far capire cosa vuoi sapere.
   - **Non anticipare** le sezioni successive (“poi ti chiederò…”): genera
     rumore e induce l'utente a rispondere a tutto subito.
   - **Aspetta la risposta** prima di passare al turno successivo. Mai
     accorpare due sezioni nello stesso messaggio.
   - **Shortcut accettati**: se l'utente scrive `skip`, `non so`, `boh`,
     `dopo`, `-` o simili, segna la sezione come `_Da definire._` e passa
     oltre senza insistere.
   - **Shortcut di uscita**: se l'utente scrive `basta`, `stop`,
     `crea il file`, interrompi l'intervista e crea il file con quanto
     raccolto fin qui, marcando le sezioni mancanti come `_Da definire._`.
   - **Riformulazione**: se la risposta è ambigua o troppo vaga per finire
     nella scheda, chiedi *un* chiarimento mirato, poi procedi. Non fare
     ping-pong infinito.

   **Sequenza dei turni** (uno per messaggio, in quest'ordine):

   **Turno A — Contesto.** «Perché questo task esiste? Quale problema
   risolve o quale feature abilita?»
   Sotto-bullet opzionali solo se utile: «Ticket esterni? Decisioni
   architetturali o discussioni da referenziare?»

   **Turno B — Obiettivo.** «Concretamente, cosa va fatto? Qual è lo scope?»
   Sotto-bullet opzionali: «Cosa è esplicitamente *fuori scope*?»

   **Turno C — Componenti coinvolti.**

   ⚠️ **Non memorizzare mai una lista statica di componenti.** La lista
   ufficiale dei componenti di Efesto vive nella documentazione di
   architettura (`docs/architecture.html`, con eco in `docs/efesto.md`).
   Prima di presentarla all'utente **devi** assicurarti che sia allineata
   alla codebase reale.

   **C.0 — Esegui la procedura di architecture-sync (obbligatorio).**

   Leggi e applica la procedura definita in
   `$EXT_DIR/procedures/architecture-sync.md`.
   È la stessa logica che un tempo viveva nel prompt `/architecture-sync`
   (ora rimosso): confronta i moduli effettivi della codebase con quelli
   documentati, intervista il dev sulle eventuali differenze e aggiorna
   `docs/architecture.html` (e, se serve, `docs/efesto.md`).

   Regole specifiche quando la procedura è invocata da `/task-new`:

   - Se il diff è vuoto (`✅ Architettura allineata`), la procedura
     termina subito e passi a C.1 senza ulteriori domande.
   - Se ci sono differenze, segui l'intervista della procedura **prima**
     di entrare nel merito del task. Usa un breve annuncio all'utente,
     del tipo: «Prima di scegliere i componenti impattati dal task,
     allineo il diagramma di architettura con la codebase.»
   - Le eventuali modifiche a `docs/architecture.html` / `docs/efesto.md`
     prodotte dalla procedura **non** rientrano nell'eccezione git di
     questo prompt: vanno proposte al dev come commit separato nel
     passo 7 (Output finale), non accorpate al commit del task.
   - Se l'utente usa `basta` / `stop` / `annulla` durante la procedura,
     rispetta quella decisione: prosegui con l'intervista del task
     usando come lista componenti quella risultante fin lì (anche se
     non è stata scritta su file), e segnala nel Log del task che
     l'architecture-sync è stata interrotta.

   **C.1 — Scelta dei componenti impattati.**

   Al ritorno dalla procedura, prendi la lista corrente dei componenti
   così come risulta dal diagramma aggiornato e chiedi all'utente quali
   **di quei componenti** sono impattati dal task, presentandoli
   esattamente come compaiono nella doc (stessi nomi, stesso wording).
   Accetta anche la risposta «nessun componente esistente, se ne
   introducono di nuovi»: in quel caso i nuovi componenti *dovrebbero*
   essere già stati aggiunti al diagramma in C.0; se il dev ha preferito
   saltare la procedura, segna che andranno aggiunti in
   `docs/architecture.html` / `docs/efesto.md` nel turno D.

   Se la risposta implica chiaramente schema DB, nuove API o nuovi
   storage ma l'utente non lo ha detto esplicitamente, fai **una** domanda
   mirata di conferma nello stesso turno (non in un turno extra).

   **Turno D — Documentazione in `docs/`.** Ricorda la convenzione
   (AGENTS.md → *Documentation Location*): tutta la doc funzionale vive in
   `docs/`. Chiedi: «Questo task richiede nuovi documenti o aggiornamenti
   in `docs/`? Se sì, quali file/sezioni?»

   **Turno E — Definition of Done specifica.** «Oltre alle voci standard
   (lint, typecheck, build, backward compat, PR approvata), quali criteri
   di accettazione aggiuntivi vuoi? (es. latenza, comportamento in caso di
   errore, copertura test e2e specifica, ecc.)»

   **Turno F — Note tecniche.** «Ci sono scelte implementative già
   decise, vincoli, librerie da usare/evitare, dipendenze tra componenti,
   impatti su WebSocket / DB / backend-frontend-interface, rischi noti?»

   **Turno G — Stima (opzionale).** «Hai già un'idea della stima in ore?
   (Altrimenti la setterai dopo editando il campo `estimate:` nel frontmatter del file.)»

   **Turno H — Riepilogo e conferma.** Prima di scrivere il file, mostra
   un riepilogo sintetico (1–2 righe per sezione) e chiedi
   «**Confermi la creazione del task?** (sì / modifica <sezione> / annulla)».
   Se l'utente chiede di modificare una sezione, rifai **solo quel turno**
   e torna al riepilogo. Se annulla, non scrivere nulla.

   Se una sezione resta vuota (skip / non so), **non inventare contenuti**:
   inserirai nel file una riga `_Da definire._` sotto l'heading
   corrispondente, come TODO esplicito.

5. **Crea il file task**:
   - Path: `.pi/tasks/backlog/<ID>-<slug>.md`
   - Parti dal template `$EXT_DIR/templates/task.md`.
   - Sostituisci i placeholder del front-matter:
     - `{{ID}}` → nuovo ID
     - `{{TITLE}}` → titolo fornito (rispetta case originale)
     - `{{DATE}}` → data corrente ISO (YYYY-MM-DD), via `date +%Y-%m-%d`.
   - **Riempi le sezioni del corpo** con le risposte dell'intervista:
     - `## Contesto` → risposta A
     - `## Obiettivo` → risposta B (con eventuale sotto-elenco “Fuori scope”)
     - `## Componenti coinvolti` → spunta `[x]` i componenti indicati in C,
       lascia `[ ]` gli altri.
     - `## Definition of Done` → mantieni le voci standard del template e
       **aggiungi** in coda le voci specifiche raccolte in D. Se emerso da
       C-bis, assicurati che ci sia una voce esplicita tipo
       `[ ] Documentazione aggiornata in docs/<file>.md`.
     - `## Note tecniche` → risposta E
     - `## Log` → lasciare vuoto (si compila durante il lavoro).
   - **Rimuovi i commenti HTML `<!-- ... -->` di istruzione** dalle sezioni che
     hai compilato (restano solo nelle sezioni non compilate, se ce ne sono).
   - Se la stima è stata fornita (F), aggiornala nel front-matter
     (`estimate: <ore>h`); altrimenti lasciala `null`.
   - Scrivi il file.

6. **Commit & push del task** (usando l'eccezione dichiarata sopra):

   a. Esegui `git status --porcelain` e verifica che l'unico path
      modificato sia `.pi/tasks/backlog/<ID>-<slug>.md`.
   b. Esegui `git branch --show-current` e verifica che sia `main`.
   c. Se **entrambi** i vincoli sono soddisfatti, esegui in sequenza:
      ```bash
      git add .pi/tasks/backlog/<ID>-<slug>.md
      git commit -m "chore(<ID>): add task to backlog — <TITLE>"
      git push
      ```
      Mostra all'utente l'output di ciascun comando.
   d. Se **uno qualunque** dei vincoli non è soddisfatto (altri file
      modificati, branch diverso da `main`, ecc.), **non eseguire**
      commit/push: mostra la situazione al dev e proponi i comandi che
      dovrà lanciare lui a mano.

   ⚠️ Caso tipico di fallimento del vincolo (a): la procedura di
   architecture-sync eseguita in Turno C ha modificato
   `docs/architecture.html` e/o `docs/efesto.md`. In questa situazione
   **non** fare commit automatico: quei file richiedono un commit
   separato e vanno proposti al dev nel passo 7 come comandi manuali
   (es. `git add docs/architecture.html docs/efesto.md && git commit -m
   "docs(architecture): sync con codebase" && git push`), prima del
   commit del task.

7. **Output finale**: mostra all'utente:
   - ID assegnato, path del file creato, riassunto sintetico delle sezioni
     compilate (1–2 righe ciascuna).
   - Esito della procedura di architecture-sync: allineata / modifiche
     applicate / interrotta dal dev. Se ha toccato file sotto `docs/`,
     elenca quei file e proponi i comandi git manuali (commit separato,
     non coperto dall'eccezione di `/task-new`).
   - Esito del commit/push del task (fatto dall'agente o comandi proposti
     al dev).
   - Se la stima non è stata data: invita a compilare a mano il campo
     `estimate:` nel frontmatter del file.
   - Se restano sezioni marcate `_Da definire._`: elencale esplicitamente come
     follow-up da completare editando il file.
