---
description: Analizza la codebase e produce 8 documenti strutturati in .pi/codebase/ (7 tematici + INDEX.md)
argument-hint: "[opzionale: area specifica da mappare, es. 'server' o 'configurator']"
---

Sei l'Assistente del workflow SCRUM-lite del progetto. Il dev vuole
**mappare la codebase** per produrre documenti di riferimento strutturati
che le fasi successive (plan, execute, verify) useranno come contesto.

Output: cartella `.pi/codebase/` con 8 documenti Markdown (7 tematici + un `INDEX.md` machine-parsabile).

## Scopo

Analizzare la codebase esistente e produrre una mappa strutturata in 7
documenti tematici più un `INDEX.md` di indice, ciascuno focalizzato su
un aspetto diverso del sistema. Questi documenti sono **consumati** dai
comandi successivi:

| Tipo di fase/task                      | Documenti caricati                          |
|----------------------------------------|---------------------------------------------|
| UI, frontend, componenti               | CONVENZIONI.md, STRUTTURA.md                |
| API, backend, endpoint                 | ARCHITETTURA.md, CONVENZIONI.md             |
| Database, schema, modelli              | ARCHITETTURA.md, STACK.md                   |
| Testing                                | TESTING.md, CONVENZIONI.md                  |
| Integrazione, API esterne              | INTEGRAZIONI.md, STACK.md                   |
| Refactoring, cleanup                   | CRITICITA.md, ARCHITETTURA.md               |
| Setup, configurazione                  | STACK.md, STRUTTURA.md                      |

## ⛔ Regola: niente codice di progetto

Questo comando **non genera né modifica codice sorgente del progetto**.
Tocca esclusivamente file sotto `.pi/codebase/`.

## 🔒 Git Safety Rule (nessuna eccezione)

Regola globale (AGENTS.md): l'agente non muta lo stato di git. Questo
comando **non dichiara eccezioni**. Al termine proponi al dev i comandi
git da eseguire a mano.

## Quando usarlo

**Usa map-codebase per:**
- Progetti brownfield prima di inizializzare i task (capire il codice esistente)
- Aggiornare la mappa dopo cambiamenti significativi
- Onboarding su una codebase sconosciuta
- Prima di un refactoring importante (capire lo stato corrente)

**Salta map-codebase per:**
- Progetti greenfield senza codice (niente da mappare)
- Codebase banali (< 5 file)

## File vietati

**Non leggere MAI il contenuto di questi file (anche se esistono):**

- `.env`, `.env.*`, `*.env` — variabili d'ambiente con segreti
- `credentials.*`, `secrets.*`, `*secret*`, `*credential*`
- `*.pem`, `*.key`, `*.p12`, `*.pfx`, `*.jks`
- `id_rsa*`, `id_ed25519*`, `id_dsa*`
- `.npmrc`, `.pypirc`, `.netrc`
- `serviceAccountKey.json`, `*-credentials.json`

Se li incontri, nota solo la loro **esistenza** (es. «file `.env`
presente — contiene configurazione dell'ambiente»). Mai citarne il
contenuto, neanche parzialmente.

## Passi

### 1. Determina cosa è stale (cache di provenienza)

Questo passo decide **quali doc tematici riscrivere**. Mai cancellare
file — gli aggiornamenti avvengono sempre via `write` (sovrascrittura),
i doc fuori dal set stale restano intatti. La cache di provenienza vive
in `.pi/codebase/.cache.json` (gitignored) e registra, per ciascun doc,
il commit HEAD a cui corrisponde l'ultima rigenerazione.

#### 1a. Stato del filesystem

Controlla:
- `.pi/codebase/` esiste?
- `.pi/codebase/.cache.json` esiste?

**Tre scenari:**

1. **Mappa assente** (`.pi/codebase/` non esiste): scenario greenfield.
   Definisci `stale_docs = {STACK.md, INTEGRAZIONI.md, ARCHITETTURA.md,
   STRUTTURA.md, CONVENZIONI.md, TESTING.md, CRITICITA.md}` (tutti e 7).
   Vai al passo 2.

2. **Mappa presente ma cache assente**: la mappa è stata creata prima
   dell'introduzione della cache, o `.cache.json` è stato cancellato.
   Chiedi al dev:

   > `.pi/codebase/` esiste ma `.cache.json` è assente. Cosa preferisci?
   > 1. **Calibra** — assumi HEAD attuale come baseline, scrivi la cache
   >    SENZA toccare i doc (rischio: i doc potrebbero essere stale ma
   >    saranno considerati fresh fino al prossimo cambio)
   > 2. **Full rewrite** — riscrivi tutti e 7 i doc e inizializza la cache
   > 3. **Salta** — esci senza modifiche

   - "Calibra": `stale_docs = {}`, salta direttamente al passo 6 dopo
     aver scritto la cache con HEAD per tutti e 7 i doc.
   - "Full rewrite": `stale_docs = {tutti i 7}`, vai al passo 2.
   - "Salta": esci.

3. **Mappa + cache entrambe presenti**: usa l'helper per calcolare il
   set stale (passo 1b).

#### 1b. Invocazione dell'helper

Esegui questo blocco da bash per ottenere il set stale:

```bash
node --experimental-strip-types -e '
import("./codebase-cache.ts").then(({ readCache, diffSinceCachedCommit, decideStaleDocs }) => {
  const fs = require("node:fs");
  const { execSync } = require("node:child_process");
  const cache = readCache(".pi/codebase/.cache.json");
  if (!cache) { console.error("CACHE_INVALID"); process.exit(2); }
  const head = execSync("git rev-parse HEAD", { encoding: "utf-8" }).trim();
  // Use the OLDEST cached commit as baseline so no doc is missed if
  // some docs were updated more recently than others.
  const commits = Object.values(cache.docs).map(d => d.commit);
  const baseline = commits.length ? commits[0] : head;
  // Detect topology change (added/deleted files between baseline and HEAD).
  let topologyChanged = false;
  try {
    const out = execSync(`git diff --diff-filter=AD --name-only ${baseline}..HEAD`, { encoding: "utf-8" });
    topologyChanged = out.trim().length > 0;
  } catch {}
  const changed = diffSinceCachedCommit(baseline, ".");
  const stale = [...decideStaleDocs(changed, undefined, { topologyChanged })];
  console.log(JSON.stringify({ head, baseline, changedCount: changed.length, topologyChanged, stale }, null, 2));
}).catch(e => { console.error("HELPER_ERROR", e?.message ?? e); process.exit(3); });
'
```

**Fallback se l'invocazione fallisce** (exit non-zero, `HELPER_ERROR`,
`CACHE_INVALID`, oppure `node --experimental-strip-types` non
disponibile):
- Mostra l'errore completo al dev.
- **Non procedere automaticamente** a rigenerazione full.
- Chiedi: «Helper non disponibile. Procedo con full rewrite (riscrivo
  tutti e 7 i doc + reinizializzo cache)? Sì/No».
- Se "Sì": `stale_docs = {tutti i 7}`, vai al passo 2.
- Se "No": esci.

#### 1c. Presenta il set stale e attendi conferma

Con l'output del helper, mostra al dev:

```
🗺️  Cache check — .pi/codebase/

  Baseline:  <commit baseline>
  HEAD:      <head>
  Changed files (filtrati): <changedCount>
  Topology changed: <true/false>

  Doc stale (da riscrivere):
    - STACK.md
    - TESTING.md
  Doc fresh (non toccati):
    - INTEGRAZIONI.md, ARCHITETTURA.md, STRUTTURA.md, CONVENZIONI.md, CRITICITA.md
```

**Tre esiti possibili:**

- **`stale` vuoto** (no-op): mostra «✅ Cache coerente con HEAD: niente
  da aggiornare». Aggiorna comunque il campo `updatedAt` di ciascun doc
  in cache (passo 4b) e vai al passo 6 (verifica output). Salta il
  passo 2 (la struttura esiste già) e il passo 3 (nessuna passata).

- **`stale` non vuoto**: chiedi al dev

  > Riscrivo solo i doc stale (Sì), salto del tutto (No), oppure forzo
  > full rewrite di tutti e 7 (Forza)?

  - "Sì": `stale_docs = <set restituito dal helper>`, vai al passo 2.
  - "No": esci senza modifiche.
  - "Forza": `stale_docs = {tutti i 7}`, vai al passo 2.

Da qui in poi, `stale_docs` è autoritativo: **non scrivere mai un doc
fuori da questo set**.

### 2. Crea la struttura

```bash
mkdir -p .pi/codebase
```

(idempotente: se la cartella esiste già, `mkdir -p` non fa nulla — i
file esistenti restano intatti).

Gli 8 documenti attesi:
- `STACK.md` (stack tecnologico)
- `INTEGRAZIONI.md` (servizi esterni e API)
- `ARCHITETTURA.md` (pattern, layer, flusso dati)
- `STRUTTURA.md` (layout directory, dove mettere il codice nuovo)
- `CONVENZIONI.md` (stile codice, naming, pattern)
- `TESTING.md` (framework, pattern, coverage)
- `CRITICITA.md` (debito tecnico, bug noti, aree fragili)
- `INDEX.md` (path + 1-line summary per doc, machine-parsed by the extension)

### 3. Mapping sequenziale — 4 passate (solo per i doc stale)

Esegui le 4 passate in sequenza, ciascuna con esplorazione mirata.
**Per ciascun doc da scrivere, controlla prima `stale_docs`: se il doc
NON è in `stale_docs`, salta del tutto la sua scrittura e la
ri-esplorazione associata.** Una passata può quindi non produrre alcun
file (es. se in `stale_docs` non c'è né `CONVENZIONI.md` né `TESTING.md`,
la Passata 3 è interamente skip).

Se `$@` contiene un'area specifica (es. "server"), limita l'esplorazione
a quella sottocartella ma produci comunque tutti i documenti in
`stale_docs` (sezioni non pertinenti → «Non applicabile a quest'area»).

**Linee guida generali per l'esplorazione:**

- Usa `bash` con `find`, `rg`, `ls`, `head` per orientarti.
- Leggi i file chiave con `read` (max 300 righe per file, usa offset/limit).
- **Includi sempre i path** con backtick: `` `server/lib/db/camera.ts` ``.
- **Sii prescrittivo**: «Usa camelCase per le funzioni» è utile.
  «Alcune funzioni usano camelCase» non lo è.
- **Scrivi lo stato attuale**, mai ciò che era o ciò che vorresti.
- Data corrente: `date +%Y-%m-%d`.

#### Passata 1: Stack tecnologico

Esplora:
- `package.json` / `requirements.txt` / `pyproject.toml` in ogni componente
- File di configurazione (`tsconfig.json`, `.eslintrc*`, `vite.config.*`, ecc.)
- `.nvmrc`, `.python-version`, `Dockerfile`

Scrivi (solo se nel set `stale_docs`):
- `.pi/codebase/STACK.md` — Linguaggi, runtime, framework, dipendenze, configurazione
- `.pi/codebase/INTEGRAZIONI.md` — API esterne, database, provider auth, webhook

Usa i template in fondo a questo documento.

#### Passata 2: Architettura

Esplora:
- Struttura directory (`find . -type d -maxdepth 3`)
- Entry point (`*/index.ts`, `*/app.ts`, `*/main.tsx`, ecc.)
- Pattern di import per capire i layer

Scrivi (solo se nel set `stale_docs`):
- `.pi/codebase/ARCHITETTURA.md` — Pattern, layer, flusso dati, astrazioni, entry point
- `.pi/codebase/STRUTTURA.md` — Layout directory, posizioni chiave, dove aggiungere codice nuovo

#### Passata 3: Qualità

Esplora:
- Configurazione linting/formatting (`.eslintrc*`, `.prettierrc*`, `eslint.config.*`)
- File di test (`*.test.*`, `*.spec.*`)
- Configurazione CI se presente

Scrivi (solo se nel set `stale_docs`):
- `.pi/codebase/CONVENZIONI.md` — Stile codice, naming, pattern, gestione errori
- `.pi/codebase/TESTING.md` — Framework, struttura test, mocking, coverage

#### Passata 4: Criticità

Esplora:
- Commenti `TODO` / `FIXME` / `HACK` / `XXX`
- File grandi (potenziale complessità)
- Stubs / return vuoti
- Dipendenze obsolete

Scrivi (solo se nel set `stale_docs`):
- `.pi/codebase/CRITICITA.md` — Debito tecnico, bug noti, sicurezza, performance, aree fragili

### 4. Genera INDEX.md

Se `stale_docs` è vuoto (no-op puro) puoi saltare questo passo —
`INDEX.md` esistente è coerente. Altrimenti rigenera
`.pi/codebase/INDEX.md` enumerando **tutti** i `.md` presenti in
`.pi/codebase/` (sia quelli appena riscritti, sia quelli rimasti
intatti).

**Formato di ogni riga:**

```
<relPath>: <one-line summary ≤ 120 char>
```

dove:
- `<relPath>` è il path del file relativo a `.pi/codebase/` (es. `STACK.md`).
- `<one-line summary>` è la prima intestazione `# ` del documento, oppure,
  se assente, la prima riga di corpo non vuota; tagliata a 120 caratteri.

Ogni riga **deve** matchare la regex:

```
^[A-Za-z0-9_\-\./]+\.md: .{1,120}$
```

Esempio (illustrativo):

```
STACK.md: Stack Tecnologico
INTEGRAZIONI.md: Integrazioni Esterne
ARCHITETTURA.md: Architettura
STRUTTURA.md: Struttura della Codebase
CONVENZIONI.md: Convenzioni di Codice
TESTING.md: Pattern di Testing
CRITICITA.md: Criticità della Codebase
```

L'estensione che consuma questi documenti **preferisce un `INDEX.md`
presente su disco** rispetto al proprio fallback in-memory lazy:
rigenerare `INDEX.md` dopo modifiche ai documenti tematici è quindi
**raccomandato ma non obbligatorio** — in assenza, l'estensione ricostruisce
l'indice al volo.

### 4b. Aggiorna `.pi/codebase/.cache.json`

Per ogni doc **toccato in questa esecuzione** (cioè ogni elemento di
`stale_docs` che è stato effettivamente scritto), aggiorna la voce
corrispondente nella cache. I doc non toccati conservano le loro
voci precedenti — non sovrascriverle.

Esegui:

```bash
node --experimental-strip-types -e '
import("./codebase-cache.ts").then(({ readCache, writeCache }) => {
  const { execSync } = require("node:child_process");
  const cachePath = ".pi/codebase/.cache.json";
  const head = execSync("git rev-parse HEAD", { encoding: "utf-8" }).trim();
  const now = new Date().toISOString();
  const touched = process.argv.slice(1); // lista doc toccati passata via argv
  const state = readCache(cachePath) ?? { docs: {} };
  for (const doc of touched) {
    state.docs[doc] = { commit: head, updatedAt: now };
  }
  writeCache(cachePath, state);
  console.log("cache updated:", JSON.stringify(state.docs, null, 2));
});
' -- STACK.md TESTING.md   # ← sostituisci con la lista dei doc effettivamente toccati
```

**Caso speciale "Calibra"** (scenario 2 del passo 1a): passa tutti e 7
i doc come argv, anche se non li hai riscritti — stai inizializzando la
cache.

**Caso speciale "no-op"** (`stale_docs` vuoto al passo 1c): non
modificare i campi `commit`, ma aggiorna solo `updatedAt` per riflettere
l'ultimo check. In pratica:

```bash
node --experimental-strip-types -e '
import("./codebase-cache.ts").then(({ readCache, writeCache }) => {
  const cachePath = ".pi/codebase/.cache.json";
  const state = readCache(cachePath);
  if (!state) process.exit(0);
  const now = new Date().toISOString();
  for (const d of Object.keys(state.docs)) state.docs[d].updatedAt = now;
  writeCache(cachePath, state);
});
'
```

### 5. Scan di sicurezza pre-commit

```bash
grep -rE '(sk-[a-zA-Z0-9]{20,}|ghp_[a-zA-Z0-9]{36}|AKIA[A-Z0-9]{16}|xox[baprs]-|-----BEGIN.*PRIVATE KEY|eyJ[a-zA-Z0-9_-]+\.eyJ)' .pi/codebase/*.md 2>/dev/null && echo "⚠️ SEGRETI TROVATI" || echo "✅ Nessun segreto rilevato"
```

Se trovati segreti → STOP, mostra i match, chiedi conferma al dev prima
di proseguire.

### 6. Verifica output

```bash
ls -la .pi/codebase/
wc -l .pi/codebase/*.md
```

Verifica:
- Tutti gli 8 documenti esistono (7 tematici + `INDEX.md`)
- Nessun documento tematico vuoto (ciascuno dovrebbe avere > 20 righe)
- `INDEX.md` ha esattamente una riga per ciascun altro `.md` e ogni riga
  matcha `^[A-Za-z0-9_\-\./]+\.md: .{1,120}$`

**Verifica cache:**

```bash
test -f .pi/codebase/.cache.json && node -e '
const s = JSON.parse(require("node:fs").readFileSync(".pi/codebase/.cache.json","utf-8"));
const docs = Object.keys(s.docs);
console.log("cache docs:", docs.join(", "));
const missing = ["STACK.md","INTEGRAZIONI.md","ARCHITETTURA.md","STRUTTURA.md","CONVENZIONI.md","TESTING.md","CRITICITA.md"].filter(d => !s.docs[d]);
if (missing.length) { console.error("⚠️ Cache incompleta — manca:", missing.join(", ")); process.exit(1); }
console.log("✅ Cache contiene tutti e 7 i doc");
' || echo "⚠️ .cache.json non scritto (atteso solo in scenario 'Salta')"
```

Una cache parziale (es. 5/7 doc) è accettabile solo dopo update
incrementali su una mappa pre-esistente; uno scenario greenfield o
"Full rewrite" deve produrre cache completa (7/7).

### 7. Output finale

```
🗺️  Mappa della codebase completata.

Creati in .pi/codebase/:
- STACK.md ([N] righe) — Stack tecnologico e dipendenze
- ARCHITETTURA.md ([N] righe) — Design del sistema e pattern
- STRUTTURA.md ([N] righe) — Layout directory e organizzazione
- CONVENZIONI.md ([N] righe) — Stile codice e pattern
- TESTING.md ([N] righe) — Struttura test e pratiche
- INTEGRAZIONI.md ([N] righe) — Servizi esterni e API
- CRITICITA.md ([N] righe) — Debito tecnico e problemi noti
- INDEX.md ([N] righe) — Indice machine-parsabile (path + summary per doc)

Comandi git suggeriti:
  git add .pi/codebase/
  git commit -m "docs: mappa della codebase"
  git push
```

---

## Template dei documenti

### STACK.md

```markdown
# Stack Tecnologico

**Data analisi:** [YYYY-MM-DD]

## Linguaggi

**Principali:**
- [Linguaggio] [Versione] — [Dove usato]

**Secondari:**
- [Linguaggio] [Versione] — [Dove usato]

## Runtime

**Ambiente:**
- [Runtime] [Versione]

**Package manager:**
- [Manager] [Versione]
- Lockfile: [presente/assente]

## Framework

**Core:**
- [Framework] [Versione] — [Scopo]

**Testing:**
- [Framework] [Versione] — [Scopo]

**Build/Dev:**
- [Tool] [Versione] — [Scopo]

## Dipendenze chiave

**Critiche:**
- [Pacchetto] [Versione] — [Perché è importante]

**Infrastruttura:**
- [Pacchetto] [Versione] — [Scopo]

## Configurazione

**Ambiente:**
- [Come viene configurato]
- [Config chiave richieste]

**Build:**
- [File di configurazione build]

## Requisiti piattaforma

**Sviluppo:**
- [Requisiti]

**Produzione:**
- [Target di deploy]

---

*Analisi stack: [data]*
```

### INTEGRAZIONI.md

```markdown
# Integrazioni Esterne

**Data analisi:** [YYYY-MM-DD]

## API e Servizi Esterni

**[Categoria]:**
- [Servizio] — [A cosa serve]
  - SDK/Client: [pacchetto]
  - Auth: [nome variabile env]

## Storage Dati

**Database:**
- [Tipo/Provider]
  - Connessione: [variabile env]
  - Client: [ORM/client]

**File storage:**
- [Servizio o "Solo filesystem locale"]

**Cache:**
- [Servizio o "Nessuna"]

## Autenticazione e Identità

**Provider auth:**
- [Servizio o "Custom"]
  - Implementazione: [approccio]

## Monitoraggio e Osservabilità

**Error tracking:**
- [Servizio o "Nessuno"]

**Log:**
- [Approccio]

## CI/CD e Deploy

**Hosting:**
- [Piattaforma]

**Pipeline CI:**
- [Servizio o "Nessuna"]

## Configurazione Ambiente

**Variabili env richieste:**
- [Elenco variabili critiche]

**Posizione segreti:**
- [Dove sono conservati i segreti]

## Webhook e Callback

**In entrata:**
- [Endpoint o "Nessuno"]

**In uscita:**
- [Endpoint o "Nessuno"]

---

*Audit integrazioni: [data]*
```

### ARCHITETTURA.md

```markdown
<!-- aggiornato: [YYYY-MM-DD] -->
# Architettura

**Data analisi:** [YYYY-MM-DD]

## Panoramica del sistema

```text
┌─────────────────────────────────────────────────────────────┐
│                      [Nome Layer Superiore]                  │
├──────────────────┬──────────────────┬───────────────────────┤
│   [Componente A] │   [Componente B] │    [Componente C]     │
│  `[path/a]`      │  `[path/b]`      │   `[path/c]`          │
└────────┬─────────┴────────┬─────────┴──────────┬────────────┘
         │                  │                     │
         ▼                  ▼                     ▼
┌─────────────────────────────────────────────────────────────┐
│                    [Nome Layer Intermedio]                   │
│         `[path/layer]`                                       │
└─────────────────────────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────────────────────────┐
│  [Store / Output / Esterno]                                  │
│  `[path/store]`                                              │
└─────────────────────────────────────────────────────────────┘
```

## Responsabilità dei Componenti

| Componente | Responsabilità | File |
|------------|---------------|------|
| [Nome] | [Cosa possiede] | `[path]` |

## Panoramica dei Pattern

**Globale:** [Nome pattern]

**Caratteristiche chiave:**
- [Caratteristica 1]
- [Caratteristica 2]

## Layer

**[Nome layer]:**
- Scopo: [Cosa fa questo layer]
- Posizione: `[path]`
- Contiene: [Tipi di codice]
- Dipende da: [Cosa usa]
- Usato da: [Cosa lo usa]

## Flusso Dati

### Percorso richiesta principale

1. [Step 1 — entry point] (`[file:riga]`)
2. [Step 2 — elaborazione] (`[file:riga]`)
3. [Step 3 — output/risposta] (`[file:riga]`)

**Gestione stato:**
- [Come viene gestito lo stato]

## Astrazioni Chiave

**[Nome astrazione]:**
- Scopo: [Cosa rappresenta]
- Esempi: `[path dei file]`
- Pattern: [Pattern usato]

## Entry Point

**[Entry point]:**
- Posizione: `[path]`
- Trigger: [Cosa lo invoca]
- Responsabilità: [Cosa fa]

## Vincoli Architetturali

- **Threading:** [Modello di threading]
- **Stato globale:** [Singleton o stato condiviso mutabile]
- **Import circolari:** [Catene di dipendenze circolari note]

## Anti-Pattern

### [Nome anti-pattern]

**Cosa succede:** [Il pattern scorretto osservato]
**Perché è sbagliato:** [Il problema che causa]
**Fai così invece:** [Il pattern corretto con riferimento file]

## Gestione Errori

**Strategia:** [Approccio]

**Pattern:**
- [Pattern 1]
- [Pattern 2]

## Aspetti Trasversali

**Logging:** [Approccio]
**Validazione:** [Approccio]
**Autenticazione:** [Approccio]

---

*Analisi architettura: [data]*
```

### STRUTTURA.md

```markdown
# Struttura della Codebase

**Data analisi:** [YYYY-MM-DD]

## Layout Directory

```
[root-progetto]/
├── [dir]/          # [Scopo]
├── [dir]/          # [Scopo]
└── [file]          # [Scopo]
```

## Scopo delle Directory

**[Nome directory]:**
- Scopo: [Cosa contiene]
- Contiene: [Tipi di file]
- File chiave: `[file importanti]`

## Posizioni Chiave dei File

**Entry point:**
- `[path]`: [Scopo]

**Configurazione:**
- `[path]`: [Scopo]

**Logica core:**
- `[path]`: [Scopo]

**Test:**
- `[path]`: [Scopo]

## Convenzioni di Naming

**File:**
- [Pattern]: [Esempio]

**Directory:**
- [Pattern]: [Esempio]

## Dove Aggiungere Codice Nuovo

**Nuova feature:**
- Codice principale: `[path]`
- Test: `[path]`

**Nuovo componente/modulo:**
- Implementazione: `[path]`

**Utility:**
- Helper condivisi: `[path]`

## Directory Speciali

**[Directory]:**
- Scopo: [Cosa contiene]
- Generata: [Sì/No]
- Committata: [Sì/No]

---

*Analisi struttura: [data]*
```

### CONVENZIONI.md

```markdown
# Convenzioni di Codice

**Data analisi:** [YYYY-MM-DD]

## Pattern di Naming

**File:**
- [Pattern osservato]

**Funzioni:**
- [Pattern osservato]

**Variabili:**
- [Pattern osservato]

**Tipi:**
- [Pattern osservato]

## Stile Codice

**Formattazione:**
- [Tool usato]
- [Impostazioni chiave]

**Linting:**
- [Tool usato]
- [Regole chiave]

## Organizzazione Import

**Ordine:**
1. [Primo gruppo]
2. [Secondo gruppo]
3. [Terzo gruppo]

**Alias di path:**
- [Alias usati]

## Gestione Errori

**Pattern:**
- [Come vengono gestiti gli errori]

## Logging

**Framework:** [Tool o "console"]

**Pattern:**
- [Quando e come loggare]

## Commenti

**Quando commentare:**
- [Linee guida osservate]

**JSDoc/TSDoc:**
- [Pattern di utilizzo]

## Design delle Funzioni

**Dimensione:** [Linee guida]

**Parametri:** [Pattern]

**Valori di ritorno:** [Pattern]

## Design dei Moduli

**Export:** [Pattern]

**Barrel file:** [Utilizzo]

---

*Analisi convenzioni: [data]*
```

### TESTING.md

```markdown
# Pattern di Testing

**Data analisi:** [YYYY-MM-DD]

## Framework di Test

**Runner:**
- [Framework] [Versione]
- Config: `[file di config]`

**Libreria di asserzione:**
- [Libreria]

**Comandi di esecuzione:**
```bash
[comando]              # Esegui tutti i test
[comando]              # Watch mode
[comando]              # Coverage
```

## Organizzazione File di Test

**Posizione:**
- [Pattern: co-locati o separati]

**Naming:**
- [Pattern]

**Struttura:**
```
[Pattern directory]
```

## Struttura dei Test

**Organizzazione suite:**
```typescript
[Pattern reale dalla codebase]
```

**Pattern:**
- [Pattern di setup]
- [Pattern di teardown]
- [Pattern di asserzione]

## Mocking

**Framework:** [Tool]

**Pattern:**
```typescript
[Pattern di mocking reale dalla codebase]
```

**Cosa mockare:**
- [Linee guida]

**Cosa NON mockare:**
- [Linee guida]

## Fixture e Factory

**Dati di test:**
```typescript
[Pattern dalla codebase]
```

**Posizione:**
- [Dove vivono le fixture]

## Coverage

**Requisiti:** [Target o "Non imposto"]

**Vedere la coverage:**
```bash
[comando]
```

## Tipi di Test

**Test unitari:**
- [Scope e approccio]

**Test di integrazione:**
- [Scope e approccio]

**Test E2E:**
- [Framework o "Non usati"]

## Pattern Comuni

**Test asincroni:**
```typescript
[Pattern]
```

**Test di errore:**
```typescript
[Pattern]
```

---

*Analisi testing: [data]*
```

### CRITICITA.md

```markdown
# Criticità della Codebase

**Data analisi:** [YYYY-MM-DD]

## Debito Tecnico

**[Area/Componente]:**
- Problema: [Qual è la scorciatoia/workaround]
- File: `[path dei file]`
- Impatto: [Cosa si rompe o degrada]
- Approccio di fix: [Come risolvere]

## Bug Noti

**[Descrizione bug]:**
- Sintomi: [Cosa succede]
- File: `[path dei file]`
- Trigger: [Come riprodurre]
- Workaround: [Se presente]

## Considerazioni di Sicurezza

**[Area]:**
- Rischio: [Cosa potrebbe andare storto]
- File: `[path dei file]`
- Mitigazione attuale: [Cosa c'è in piedi]
- Raccomandazioni: [Cosa andrebbe aggiunto]

## Colli di Bottiglia sulle Performance

**[Operazione lenta]:**
- Problema: [Cosa è lento]
- File: `[path dei file]`
- Causa: [Perché è lento]
- Percorso di miglioramento: [Come velocizzare]

## Aree Fragili

**[Componente/Modulo]:**
- File: `[path dei file]`
- Perché fragile: [Cosa lo rende facile da rompere]
- Modifica sicura: [Come cambiare in sicurezza]
- Copertura test: [Lacune]

## Limiti di Scalabilità

**[Risorsa/Sistema]:**
- Capacità attuale: [Numeri]
- Limite: [Dove si rompe]
- Percorso di scaling: [Come aumentare]

## Dipendenze a Rischio

**[Pacchetto]:**
- Rischio: [Cosa c'è che non va]
- Impatto: [Cosa si rompe]
- Piano di migrazione: [Alternativa]

## Feature Critiche Mancanti

**[Gap funzionale]:**
- Problema: [Cosa manca]
- Blocca: [Cosa non si può fare]

## Lacune nella Copertura Test

**[Area non testata]:**
- Cosa non è testato: [Funzionalità specifica]
- File: `[path dei file]`
- Rischio: [Cosa potrebbe rompersi di nascosto]
- Priorità: [Alta/Media/Bassa]

---

*Audit criticità: [data]*
```
