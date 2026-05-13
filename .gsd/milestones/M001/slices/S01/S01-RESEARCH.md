# S01: INDEX + load on-demand (foundation) — Research

**Date:** 2026-05-12

## Summary

Slice di foundation: rimuovere l'iniezione forzata dell'intera codebase map in `index.ts:119-159` e sostituirla con (a) iniezione di un solo `.pi/codebase/INDEX.md` compatto (path + 1-line summary), e (b) un meccanismo `load-codebase-doc(name)` invocabile a runtime dal LLM per ottenere il contenuto integrale di un singolo doc. La pi extension API supporta nativamente entrambe le primitive (`pi.registerTool`, message injection da `before_agent_start`), e il Context Inspector già loggando `before_provider_request` può intercettare le invocazioni come eventi.

Lavoro confinato a 3 file dell'estensione (`index.ts`, `context-inspector.ts`, `commands/map-codebase.md` — più un possibile nuovo tool-module). Nessuna modifica alle skill esistenti in questa slice: le 4 skill continueranno a leggere `.pi/codebase/CONVENZIONI.md` ecc. via `read` (dialogano col filesystem, non con la map iniettata). La rimozione della tabella `tipo-task → doc` e l'introduzione di `context-needed` nel `PLAN.md` arrivano in S02.

Rischio principale: senza la map intera pre-iniettata, le skill che oggi presumono il contenuto già in contesto potrebbero degradare. Mitigazione: nell'iniezione iniziale spedire l'INDEX con un'istruzione esplicita ("se ti serve `<nome>.md`, chiama `load_codebase_doc`"), e mantenere il fallback `read` che le skill già usano.

## Recommendation

**Implementare `load-codebase-doc` come tool (`pi.registerTool`), non come slash command.**

Tre ragioni:

1. **Il brief richiede invocazione esplicita del LLM.** Un `pi.registerCommand` è guidato dall'utente (richiede `/ah:load-codebase-doc`); un `pi.registerTool` è callable autonomamente dall'agente nel flusso decisionale del turno.
2. **Inspector lo intercetta senza nuova infrastruttura.** `context-inspector.ts:302-310` già conta tool dichiarati nel payload; estenderlo per loggare le tool-call effettive (`message_end` ispeziona `content` con `t === "tool_use"`, vedi `context-inspector.ts:227`) è banale. Questo soddisfa la `Boundary Map` S01→S03 senza inventare un canale eventi parallelo.
3. **Schema strutturato + result tipizzato.** Un tool ha parametri validati (typebox) e ritorna `content` integrato nel turno successivo come tool_result. Niente parsing manuale, niente edge-case di "il LLM ha scritto un comando malformato".

Il command `/ah:load-codebase-doc <name>` può essere aggiunto come scorciatoia per il dev, ma il path autoritativo è il tool.

**Generazione di `INDEX.md`**: estendere `commands/map-codebase.md` per produrre `INDEX.md` come 8° artifact (oltre ai 7 attuali), con formato `<path>: <one-line summary>`. In assenza di INDEX, fallback a generazione lazy alla prima `before_agent_start` (scan `.pi/codebase/*.md`, estrarre primo paragrafo o frontmatter). Decisione finale in fase plan; la ricerca preferisce la generazione lazy perché elimina la dipendenza ordinata "prima map-codebase, poi tutto".

## Implementation Landscape

### Key Files

- `index.ts:62-67` — extension factory entry point. Qui va registrato il nuovo tool `load_codebase_doc` (insieme alla registrazione esistente del Context Inspector). I `commandsDir` loop a `index.ts:69-73` resta com'è — i comandi `.md` continuano a funzionare.
- `index.ts:109-159` — **bloccante**: il blocco `pi.on("before_agent_start", ...)` che inietta `.pi/codebase/*.md` intero. Da sostituire con un'iniezione che spedisce solo l'INDEX.md (o un INDEX generato in-memory) e include nel messaggio un'istruzione operativa: *"Per leggere il contenuto integrale di un doc, chiama il tool `load_codebase_doc({ name })`."*
- `index.ts:16-32` — `collectMarkdownFiles` resta utile come helper per generare l'INDEX lazy se `.pi/codebase/INDEX.md` non esiste su disco.
- `context-inspector.ts:294-325` — il `before_provider_request` hook va esteso (in S03, non S01) per estrarre dal payload le tool-call con `name === "load_codebase_doc"` e contarle separatamente. **S01 produce gli eventi**, S03 li consuma. In S01 basta verificare che le invocazioni del tool compaiano già in `requests.ndjson` via il branch `tools` esistente (linee 302-310).
- `context-inspector.ts:217-237` — `analyzePayload.perMessage` già rileva `tool_use` / `tool_result`. Niente da cambiare in S01: gli eventi `load-codebase-doc` saranno visibili nel log richieste senza modifiche.
- `commands/map-codebase.md:97-104` — l'elenco dei 7 doc attesi. In S01 si aggiunge `INDEX.md` come 8° artifact, con istruzione di generazione (path + 1-line summary derivato dal primo `## ` o frontmatter di ciascun doc).
- `register-prompt.ts` — non tocca questa slice.
- `skills/ah-task-{plan,discuss,execute}/INSTRUCTIONS.md` — **NON modificarle in S01**. La rimozione della tabella `tipo-task → doc` è S02. In S01 le skill continuano a usare `read .pi/codebase/CONVENZIONI.md` direttamente — il loro path non passa per il tool. Verificato leggendo le 3 istruzioni: usano `read` esplicito (es. `ah-task-plan/INSTRUCTIONS.md:98`).
- `skills/ah-task-verify/INSTRUCTIONS.md` — confermo: questa skill **non** ha la tabella `tipo-task → doc` (smentisce parzialmente il framing del CONTEXT che parla di "4 skill"; in realtà la tabella è duplicata in 3 skill, non 4. Annotare per S02.)

### Build Order

Costruire in questo ordine, ciascun passo testabile in isolamento:

1. **Generazione INDEX.md (lazy, in-memory)** — sostituire il body del `before_agent_start` a `index.ts:119-159`: invece di concatenare `f.content` per ogni file (riga 139), produrre l'INDEX come `relPath: <one-line summary>` per file, dove la summary è il primo header `#` non-titolo o la prima riga non vuota del body. Iniettare un messaggio `<2KB invece dei ~20-100KB attuali. **Primo proof**: la sessione parte, l'INDEX appare nei log dell'Inspector come payload upload ridotto.

2. **Tool `load_codebase_doc(name)`** — modulo nuovo (es. `load-codebase-doc.ts`) registrato da `index.ts`. Parametri: `{ name: string }` (typebox `Type.Object`). Logica: risolvere `name` → path sicuro sotto `.pi/codebase/` (rifiutare `..`, path absolute, simboli fuori da `[a-zA-Z0-9_-]`), leggere il file, ritornare `content: [{ type: "text", text: <file body> }]`. Errore esplicito se non esiste. **Test**: chiamata diretta da una sessione interactive — l'LLM riceve il file integrale come tool_result.

3. **INDEX.md persistito (opzionale, in `map-codebase.md`)** — aggiungere passaggio finale a `commands/map-codebase.md` che scrive `.pi/codebase/INDEX.md` derivato dai 7 doc appena generati. Se presente su disco, il punto 1 lo preferisce alla generazione lazy. Beneficio: l'INDEX riflette esattamente la mappa al momento della sua generazione (non drift). Costo: un solo file in più.

4. **Smoke test end-to-end** — far girare una skill esistente (es. `ah:task-plan`) su un task reale: deve completare leggendo i doc o via `load_codebase_doc` (preferito) o via `read` diretto sui path `.pi/codebase/*.md` (fallback). Verificare in `requests.ndjson` che il payload del primo turno non contenga più i body dei doc.

L'ordine 1→2 è obbligato: senza 1, l'INDEX non esiste e il LLM non sa cosa caricare. 3 è incrementale. 4 è il gate.

### Verification Approach

- **Statico**: `git diff` deve mostrare cambiamenti circoscritti a `index.ts`, `context-inspector.ts` (eventuale), il nuovo `load-codebase-doc.ts`, e `commands/map-codebase.md`. Nessuna modifica a `skills/*/INSTRUCTIONS.md`.
- **Build**: `npm run build` (o equivalente) sull'estensione passa senza errori TypeScript.
- **Runtime smoke**:
  - Sessione pi reale con `.pi/codebase/` popolato. Avvio: nel log di sessione comparire `[agentic-harness] codebase-index: injecting N entries (~K tokens)` con `K` di ordine di grandezza < 500 invece di > 5000.
  - Comando manuale al LLM: "leggi il contenuto di CONVENZIONI usando il tool". Il LLM chiama `load_codebase_doc({ name: "CONVENZIONI" })` e riceve il body.
  - `cat .pi/context-inspector/<sid>/requests.ndjson | jq '.breakdown.parts.tools.count'` mostra il tool registrato; `jq '.breakdown.parts.messages.byRole'` mostra `user` ridotto.
- **Sentinella per S03**: una `tool_use` con `name=load_codebase_doc` deve apparire in `requests.ndjson` come elemento del `perMessage[].content[]` con `hasToolCalls: true`. Se non appare, l'iniezione iniziale non sta convincendo il LLM a usare il tool e va rivisto il wording del prompt iniziale.

## Don't Hand-Roll

| Problem | Existing Solution | Why Use It |
|---------|------------------|------------|
| Tool registration e schema validation | `pi.registerTool` + `typebox`/`StringEnum` (`@earendil-works/pi-coding-agent`) | API documentata, validazione gratis, integrazione UI/log automatica. Vedi `docs/extensions.md:1217-1265`. |
| Message injection a livello di prompt | return `{ message: { customType, content, display: false } }` da `before_agent_start` | Già usato in `index.ts:152-158` per la map; identico pattern per l'INDEX. |
| Logging tool-call per Inspector | `before_provider_request` payload analysis già scandisce `tools` (`context-inspector.ts:302-310`) | Nessuna nuova infra: gli eventi `load-codebase-doc` finiscono in `requests.ndjson` gratis. |
| Markdown collection ricorsiva | `collectMarkdownFiles` in `index.ts:16-32` | Già scritto, già testato. Riusare per generare INDEX lazy. |

## Constraints

- **API surface = `@mariozechner/pi-coding-agent`** (vedi `import` in `index.ts:1`). Non `@earendil-works/pi-coding-agent`. La sintassi degli hook e di `registerTool` è la stessa (i due package sono allineati), ma se in fase plan emerge che una primitiva esiste solo su `@earendil-works`, va segnalato.
- **Cwd convention**: l'estensione usa `process.cwd()` come root del progetto consumer (`index.ts:124`). `.pi/codebase/` è relativo a questo cwd. Il tool deve fare la stessa cosa per consistenza.
- **Path safety**: `load_codebase_doc({ name })` riceve input dal LLM. Il `name` va sanificato a `[a-zA-Z0-9_-]+` e risolto come `join(cwd, ".pi", "codebase", name + ".md")` con `path.resolve()` + check che il risultato sia ancora sotto `<cwd>/.pi/codebase/`. Senza questa guardia, `name = "../../etc/passwd"` legge file arbitrari.
- **Iniezione one-shot per sessione**: il pattern esistente (`codebaseContextInjected` chiusura in `index.ts:116`) va preservato. L'INDEX si inietta una sola volta; le `load_codebase_doc` accadono on-demand nei turni successivi.
- **Backward compat**: progetti consumer (Efesto) che oggi assumono la map intera nel prompt iniziale possono degradare. La istruzione operativa nell'INDEX deve essere abbastanza esplicita da indurre il LLM a chiamare il tool quando serve.

## Common Pitfalls

- **INDEX troppo verboso = non risolve nulla.** Se l'INDEX include più di 1 riga di summary per file, riemerge il problema originale a scala minore. Target: **una sola riga ≤ 120 char per file**. Se 7 doc → INDEX < 1KB ≈ 250 token.
- **Il LLM ignora il tool e tenta `read`.** Probabile failure mode finché il prompt operativo nell'INDEX non è esplicito. Mitigazione: includere nel `promptSnippet` del tool un'istruzione tipo *"Use load_codebase_doc to fetch a full codebase document before generic file reads on .pi/codebase/*.md"*. Se persiste, una guideline nel `promptGuidelines` del tool (docs/extensions.md:1714).
- **Doppio caricamento (INDEX + read).** Se il LLM chiama `load_codebase_doc(CONVENZIONI)` e poi una skill fa `read .pi/codebase/CONVENZIONI.md`, il doc è in contesto due volte. S03 lo rileverà come "loaded ⊋ declared" — non blocker per S01 ma da annotare.
- **Generazione lazy non deterministica.** Se diverse sessioni vedono `.pi/codebase/` in stati diversi, l'INDEX in-memory varia. In sé non è un problema (è uno snapshot del cwd corrente), ma può confondere il debug. Preferire INDEX su disco quando possibile (passo 3 della build order).
- **Verify skill outlier.** La 4ª skill (`ah-task-verify`) **non** carica doc della map (`context-inspector.ts` confirms: nessuna tabella `tipo-task → doc` in `skills/ah-task-verify/INSTRUCTIONS.md`). Il CONTEXT M001 dice "4 skill duplicano la tabella" ma il dato osservato è "3 skill". Annotare per S02 — non cambia S01.

## Open Risks

- **Modello/provider che non supporta tool calling pulito** (es. modelli local-only via Ollama in pi). Se l'estensione viene usata con un provider senza tool-use, `load_codebase_doc` non è invocabile e l'INDEX da solo non basta. Fallback: il LLM può comunque chiamare `read` direttamente sui path `.pi/codebase/<name>.md` listati nell'INDEX. Da chiarire in plan se serve un branch di fallback esplicito.
- **Naming del tool**: `load_codebase_doc` (snake_case) vs `loadCodebaseDoc` vs `loadDoc`. Le convenzioni dei tool built-in (`read`, `bash`, `edit`) sono lowercase semplice. Proposta: `load_codebase_doc`. Decisione in plan.
- **Posizionamento di INDEX.md**: dentro `.pi/codebase/INDEX.md` (insieme ai 7 doc) o sotto `.pi/codebase/.meta/INDEX.md` (separato). La prima è più scopribile; la seconda evita di "inquinare" la lista dei doc semantici. Proposta: la prima, per semplicità. Decisione in plan.

## Sources

- pi-coding-agent extension API (`pi.registerTool`, `before_agent_start`, payload shape): `/home/toto/.nvm/versions/node/v22.20.0/lib/node_modules/@earendil-works/pi-coding-agent/docs/extensions.md` (linee 466-501, 1211-1320, 1660-1820).
- Existing codebase map injection: `index.ts:109-159` (questo worktree).
- Existing Context Inspector payload analysis: `context-inspector.ts:164-283`, `context-inspector.ts:294-325`.
- Existing duplicated table in skills: `skills/ah-task-plan/INSTRUCTIONS.md:115-129`, `skills/ah-task-discuss/INSTRUCTIONS.md:85-99`, `skills/ah-task-execute/INSTRUCTIONS.md:138-152`.
- map-codebase command structure: `commands/map-codebase.md:97-104`.
