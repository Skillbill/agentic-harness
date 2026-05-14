---
feature: AH OTA update
status: approved
created: 2026-05-14
updated: 2026-05-14
---

# REQUIREMENTS — Aggiornamento OTA dell'estensione AH per PI

## Contesto

`agentic-harness` (AH) è un'estensione di [`@earendil-works/pi-coding-agent`](https://www.npmjs.com/package/@earendil-works/pi-coding-agent) (PI). Oggi l'estensione viene installata manualmente clonando/copiando il sorgente nella directory delle estensioni di PI, e gli aggiornamenti richiedono un intervento esplicito del dev.

Questa feature introduce una distribuzione "ufficiale" di AH come **Pi Package** installabile via `pi install git:...`, e un meccanismo OTA (over-the-air) che, all'avvio di un ambiente PI con AH installata, verifica la presenza di una nuova versione e — previa conferma del dev — la applica e ricarica l'estensione.

Obiettivo macro: ridurre l'attrito di adozione e di aggiornamento di AH, mantenendo il controllo del dev sulle modifiche applicate al proprio ambiente.

## Requisiti

### R-0001 — Installazione via `pi install`

AH è un'estensione di PI e può essere installata con il comando `pi install`.

**Decisioni**:
- **Canale**: Git (GitHub) — install via `pi install git:github.com/Skillbill/agentic-harness[@<ref>]`. Nessun publish su npm in v1.
- **Identità**: `name = "@skillbill/agentic-harness"` in `package.json` (scoped sull'organizzazione Skillbill).
- **Layout PI**: convention dirs — `extensions/index.ts` (entry), `prompts/` (slash commands), `skills/` (skills). Helper TS in `lib/` esclusi dalle convention dirs e raggiunti via import relativi.
- **Manifest PI**: il campo `pi` di `package.json` punta esplicitamente a `extensions/index.ts`, `skills`, `prompts` (cintura di sicurezza: l'auto-discovery non promuove i file `.ts` in `lib/` a estensioni separate).
- **Peer dependencies**: `@earendil-works/pi-coding-agent` e `typebox` (entrambe fornite da PI, non bundlate da AH — vedi `docs/packages.md` di PI).

### R-0002 — Check OTA all'avvio e aggiornamento on-demand

Quando un ambiente PI con AH installata parte, viene fatto un check OTA di aggiornamento di AH.

- Se è presente una nuova versione, AH **propone** l'aggiornamento al dev (dialog `ctx.ui.confirm`).
- In caso di risposta positiva, AH effettua l'aggiornamento (`pi update --extension git:github.com/Skillbill/agentic-harness`) e invoca il **reload** dell'estensione (`ctx.reload()`).
- In caso di risposta negativa, lo startup prosegue normalmente con la versione installata.

**Decisioni**:
- **Hook**: `pi.on("session_start", …)` con guard `event.reason === "startup"` (non `"reload"` né `"new"`/`"resume"`/`"fork"`).
- **Sorgente versione disponibile**: GitHub Releases API (`GET https://api.github.com/repos/Skillbill/agentic-harness/releases/latest`). Anonimo (no token), `User-Agent: agentic-harness-ota/<current>`.
- **Frequenza del check**: cache con TTL 6h in `~/.pi/agent/.cache/agentic-harness-ota.json`. Bilancia rate-limit GitHub (60 req/h unauth) e tempestività.
- **Comportamento offline / errori di rete**: silenzio totale. Mai bloccare lo startup, mai mostrare errori all'utente — il check è best-effort.
- **Granularità del reload**: PI espone `ctx.reload()` su `ExtensionContext`. Equivalente a `/reload`. Trattato come *terminal* nell'handler (chiamato e `return` subito).
- **Breaking changes**: in v1 non viene mostrato il changelog. Iterazione successiva: mostrare `body` della GitHub Release nel `ctx.ui.confirm`.
- **Pinned installs**: se l'utente è su `@vX.Y.Z` pinnato, `pi update` salta (per docs PI). AH propone comunque l'update; se l'utente accetta, l'errore di `pi update` viene mostrato come notify. Documentato.

## Fuori scope (per ora)

- Auto-update silenzioso senza conferma del dev.
- Rollback automatico a versione precedente.
- Distribuzione di estensioni di terze parti diverse da AH.
- Pinning di versione configurabile lato AH (`pi install` già lo supporta nativamente con `@<ref>`).
- Publish su npm registry (cambia il canale ma non i requisiti R-0001/R-0002 — può essere una iterazione successiva).
- Lettura di `~/.pi/agent/settings.json` per nascondere il prompt agli utenti con install pinnato.

## Vincoli di progetto

- Rispetto della **Git Safety Rule** (`CLAUDE.md`): l'aggiornamento OTA non implica operazioni git nel repo del dev; agisce esclusivamente sulla directory di installazione del pacchetto PI.
- Compatibilità con i contratti autoritativi esistenti (`WORKFLOW.md`, `task-layout.md`): l'aggiornamento non deve invalidare task in corso (cartelle `tasks/T-NNN-*` del consumer).
- L'estensione resta caricata da PI tramite il `default export` di `extensions/index.ts`.

## Decisioni risolte (storicizzate dalle open questions originali)

1. *PI offre già primitive per `pi install` e per il reload di un'estensione?* → **Sì**. `pi install`/`pi update` documentati in `docs/packages.md` di PI v0.74.0 (npm, git, https, local paths). Reload via `ctx.reload()` documentato in `docs/extensions.md` § `ctx.reload()`. Nessuna modifica upstream necessaria.
2. *Il check OTA gira dentro `index.ts` o come hook dedicato?* → **Hook `session_start`** con guard `event.reason === "startup"`. Fire-and-forget per non bloccare il factory async.
3. *La proposta di aggiornamento passa per `pi.sendUserMessage` o per un canale UI dedicato?* → **Canale UI**: `ctx.ui.confirm(title, message)` (modale TUI). `pi.sendUserMessage` è asincrono e finirebbe come input dell'agent — sbagliato per una conferma sincrona.
