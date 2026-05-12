---
description: Crea un nuovo task nel backlog (SCRUM-lite)
argument-hint: "<argomento del task>"
---

Sei l'agente del workflow SCRUM-lite del progetto. Devi creare un nuovo task
nel backlog a partire dall'argomento fornito dall'utente.

**Argomento fornito:** $@

L'unico obiettivo dell'intervista è chiarire **di cosa parla il task** —
contesto (perché esiste) e obiettivo (cosa va fatto). Tutto il resto
(componenti coinvolti, DoD specifica, note tecniche, stima) **non si
chiede**: il dev compilerà a mano dopo se serve, oppure ne riparleremo in
`/ah:task-discuss` / `/ah:task-plan`.

## 🔒 Git Safety Rule (eccezione dichiarata)

Regola globale (AGENTS.md): l'agente non muta lo stato di git. Questo
prompt dichiara **un'eccezione limitata**: al passo finale PUOI eseguire
`git add`, `git commit` e `git push` — ma **esclusivamente** per il file
del task appena creato nel backlog.

Vincoli obbligatori prima di eseguire qualunque comando git che muta:

1. **Unico file toccato dall'eccezione**: l'unico path che puoi mettere in
   `git add` è `.pi/tasks/backlog/<ID>-<slug>/TASK.md`. Verifica con
   `git status --porcelain` prima del commit. Se nel working tree ci sono
   altre modifiche non correlate (staged o non-staged), **non fare commit
   automatico**: mostra lo stato al dev e proponi i comandi a mano.

   ⚠️ Eventuali modifiche a `docs/architecture.html` / `docs/project.md`
   prodotte dalla procedura di architecture-sync silenziosa **non**
   rientrano in questa eccezione: vanno proposte al dev come commit
   separato (vedi passo 5).
2. **Branch `main`**: conferma con `git branch --show-current`. Se non sei
   su `main`, niente commit/push automatici — proponi i comandi al dev.
3. **`git add` mirato**: usa il path esatto del file, mai `git add .` o
   `git add -A`.
4. **`git push` mirato**: pusha solo il commit appena creato sul branch
   corrente. Niente force-push, niente tag, niente altri branch.

Operazioni read-only (`git status`, `git log`, `git diff`,
`git branch --show-current`) sono sempre permesse.

## Passi

### 1. Verifica contesto git (read-only)

- `git branch --show-current`. Se NON sei su `main`, avvisa il dev (un'unica
  riga, non un blocco): «Sei su `<branch>`, il task dovrebbe nascere su
  `main`. Procedo comunque? (sì/no)». Se "no", esci.

### 2. Determina ID e slug

- **ID**: scansiona `.pi/tasks/{backlog,in-progress,review,done}/` per le
  cartelle che matchano `T-NNN-*`. Prendi il numero più alto + 1.
  Formatta `T-NNN` (zero-padding a 3 cifre).
- **Slug**: dall'argomento fornito → lowercase, spazi → `-`, rimuovi
  caratteri non alfanumerici tranne `-`, tronca a ~50 caratteri.

Non li mostrare ancora al dev: l'ID definitivo lo darai nell'output finale,
così l'intervista resta pulita.

### 3. Intervista — loop libero, una domanda alla volta

⚠️ **Niente turni rigidi, niente checklist di sezioni.** Hai un solo
obiettivo: capire **perché** questo task esiste e **cosa concretamente** va
fatto, abbastanza bene da scrivere un breve paragrafo di Contesto e uno di
Obiettivo nel TASK.md. Tipicamente bastano 1–3 domande in totale.

Regole del loop:

- **Una domanda per messaggio**, focalizzata. Niente muri di domande in
  blocco.
- **Aspetta la risposta** prima di chiederne un'altra.
- Se l'argomento iniziale `$@` è già abbastanza chiaro (es. il dev ha
  scritto un titolo descrittivo + 2 righe di spiegazione), **non fare
  nessuna domanda**: passa direttamente al passo 4.
- Se manca il "perché", chiedilo. Se manca il "cosa", chiedilo. Se manca
  entrambi, chiedi prima il "cosa" (più concreto), poi al massimo il
  "perché" se non emerge naturalmente dalla risposta.
- **Non chiedere** componenti coinvolti, DoD aggiuntiva, note tecniche,
  stima, dipendenze, rischi. Non sono affari di `/task-new`.
- **Shortcut di uscita**: se il dev scrive `basta`, `stop`, `crea il
  task`, `ok vai`, interrompi subito il loop e procedi al passo 4 con
  quello che hai. Non insistere mai.
- **Niente turno di riepilogo + conferma**. Quando ritieni di avere abbastanza
  per scrivere Contesto + Obiettivo, **passa direttamente al passo 4** —
  l'output finale (passo 6) farà da implicita "conferma a posteriori".

### 4. Architecture-sync silenziosa (background, non blocca)

Prima di scrivere il file, esegui la procedura
`$EXT_DIR/procedures/architecture-sync.md` in **modalità silenziosa**
(vedi sezione omonima di quella procedura).

Concretamente:

- Niente domande al dev su nodi nuovi/obsoleti.
- Aggiungi automaticamente al diagramma i moduli nuovi rilevati nella
  codebase (con TODO HTML per il posizionamento).
- Non rimuovere nodi obsoleti automaticamente.
- Output verso il dev: una sola riga sintetica nell'output finale del
  passo 6 (es. `📐 Architettura: allineata` o
  `📐 Architettura: +1 nodo (TODO posizionamento)`).
- Se la procedura fallisce per qualunque motivo, **non bloccare il task**:
  segnala l'errore in una riga e prosegui.

Se la procedura ha modificato `docs/architecture.html` o `docs/project.md`,
ricordati per il passo 6 che quei file vanno proposti al dev come commit
separato (non rientrano nell'eccezione git di questo prompt).

### 5. Crea il file task

Layout (vedi `task-layout.md` §1): ogni task è una **directory**
`.pi/tasks/backlog/<ID>-<slug>/` contenente almeno `TASK.md`.

- Crea la cartella `.pi/tasks/backlog/<ID>-<slug>/`.
- Path del file: `.pi/tasks/backlog/<ID>-<slug>/TASK.md`.
- Parti dal template `$EXT_DIR/templates/task.md` (versione snella: solo
  Contesto, Obiettivo, Definition of Done standard, Log).
- Sostituisci i placeholder del front-matter:
  - `{{ID}}` → nuovo ID
  - `{{TITLE}}` → titolo derivato dall'argomento del dev. Se l'argomento è
    già una frase-titolo (≤ 80 caratteri, capitalized o tipico stile
    titolo), usalo così com'è. Altrimenti sintetizza un titolo di 5–10
    parole che riassuma il task.
  - `{{DATE}}` → `date +%Y-%m-%d`.
- Riempi le sezioni del corpo con quanto raccolto nell'intervista:
  - `## Contesto` → 2–5 righe di prosa che spiegano perché il task esiste
    (problema, motivazione, eventuali link/decisioni se emersi).
  - `## Obiettivo` → 2–5 righe che descrivono concretamente cosa va fatto
    (scope). Niente bullet point a meno che il dev abbia esplicitamente
    elencato sotto-obiettivi.
- **Niente** `_Da definire._`, niente sezioni vuote, niente placeholder.
  Se davvero un punto non è chiaro nemmeno dopo l'intervista (es. il dev
  ha scritto "boh" ovunque), scrivi una frase onesta tipo «Da chiarire in
  fase di discuss.» direttamente nella prosa, senza inventarti contenuti.
- **Rimuovi i commenti HTML `<!-- ... -->` di istruzione** dalle sezioni
  che hai compilato.
- Lascia `estimate: null` nel front-matter (la stima non si chiede in
  `/task-new`).
- Lascia la sezione `## Log` vuota (si compila durante il lavoro).

Scrivi il file.

### 6. Commit & push del task (usando l'eccezione)

a. `git status --porcelain`: verifica che gli unici path modificati siano
   `.pi/tasks/backlog/<ID>-<slug>/TASK.md` (e la directory contenitore).
   Eventuali modifiche a `docs/architecture.html` / `docs/project.md`
   prodotte al passo 4 NON rientrano qui: se ci sono, **non fare commit
   automatico** del task — proponi al dev i comandi a mano per entrambi
   i commit (prima docs, poi task), separati.
b. `git branch --show-current`: deve essere `main`.
c. Se i vincoli sono soddisfatti, esegui in sequenza:
   ```bash
   git add .pi/tasks/backlog/<ID>-<slug>/TASK.md
   git commit -m "chore(<ID>): add task to backlog — <TITLE>"
   git push
   ```
   Mostra l'output di ciascun comando.
d. Se uno dei vincoli non è soddisfatto, **non eseguire** commit/push:
   mostra la situazione e proponi i comandi che il dev lancerà a mano.

### 7. Output finale (conciso)

Quattro righe, niente di più:

```
✅ <ID> creato — <TITLE>
   file: .pi/tasks/backlog/<ID>-<slug>/TASK.md
   📐 Architettura: <riga di esito dalla sync silenziosa>
   commit: <short-sha> su main (pushed) | comandi proposti al dev
```

Se la sync silenziosa ha toccato file sotto `docs/`, aggiungi UNA riga
extra coi comandi git da eseguire a mano per il commit separato:

```
   ⚠ docs/ aggiornato dalla sync — commit separato:
     git add docs/architecture.html docs/project.md && git commit -m "docs(architecture): sync con codebase" && git push
```

Niente next steps, niente checklist, niente «ora fai task-start». Il dev
sa cosa fare.
