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

### R-0002 — ~~Check OTA all'avvio e aggiornamento on-demand~~ → DECLINATO in v0.5.0

> **Stato**: declinato. Implementato in v0.1.0 (PR #1) + v0.2.0 (PR #2) + v0.3.0 (PR #3 fix), poi rimosso in v0.5.0.
>
> **Rationale**: PI v0.74.0 mostra **nativamente** un banner `Package Updates Available` allo startup quando un pacchetto installato ha un nuovo ref upstream — vedi screenshot in PR del cleanup. L'OTA custom di AH duplicava questa notifica con UX leggermente più ricca (modal interattivo, `ctx.reload()` automatico) ma:
>
> - aggiungeva ~280 righe tra modulo OTA, install-info, version-reader, cache I/O e dialog;
> - introduceva edge case di manutenzione (cache stale, network errors, `pi update` flag invalidi, install-path detection, pinning detection);
> - mostrava il prompt **in concorrenza** col banner PI nativo, creando rumore visivo;
> - dipendeva da `ctx.reload()` con behaviour subtle (terminal, perde state in-memory) e dal subprocess `pi update`.
>
> **Decisione**: rimosso tutto il codice OTA. AH delega completamente al meccanismo nativo di PI. L'utente lancia `pi update` (o `pi update --extension git:...`) quando vuole, da terminale, fuori dalla sessione pi.
>
> **Conseguenze per l'utente**:
> - Su unpinned install: PI mostra il banner; un comando manuale aggiorna il pacchetto. Niente reload automatico — l'utente riavvia `pi` per ricaricare il nuovo codice.
> - Su pinned install (`@vX.Y.Z`): PI segue la sua semantica standard (`pi update` salta i pinned). Per upgradare: `pi install` con il nuovo ref.
>
> Vedi `CLAUDE.md` § *How to release a new version* e § *Install scopes* per il flow operativo aggiornato.

## Fuori scope

- Distribuzione di estensioni di terze parti diverse da AH.
- Publish su npm registry (cambia il canale ma non il requisito R-0001 — può essere una iterazione successiva).

## Vincoli di progetto

- Rispetto della **Git Safety Rule** (`CLAUDE.md`): l'estensione non muta git state nel repo del dev.
- Compatibilità con i contratti autoritativi esistenti (`WORKFLOW.md`, `task-layout.md`).
- L'estensione resta caricata da PI tramite il `default export` di `extensions/index.ts`.

## Decisioni storicizzate

1. *PI offre già primitive per `pi install` e per il reload di un'estensione?* → **Sì**. `pi install`/`pi update` documentati in `docs/packages.md` di PI v0.74.0 (npm, git, https, local paths). Reload via `ctx.reload()` o riavvio sessione.
2. *Il check OTA gira dentro `index.ts` o come hook dedicato?* → **N/A**: R-0002 declinato in v0.5.0. PI ha un banner nativo `Package Updates Available` che copre il caso d'uso senza codice custom.
3. *La proposta di aggiornamento passa per `pi.sendUserMessage` o per un canale UI dedicato?* → **N/A**: R-0002 declinato. Nessun prompt custom: l'utente vede il banner PI e lancia `pi update` manualmente.

## Storia dei rilasci

- **v0.1.0** (PR #1): Pi Package distribuibile (R-0001) + OTA custom completo (R-0002).
- **v0.2.0** (PR #2): scope detection (project-local vs global) + pinning detection per OTA.
- **v0.3.0** (PR #3): fix `pi update -l` (l'opzione non esiste lato PI).
- **v0.4.0**: test release per validare il flow OTA end-to-end (nessun cambiamento di codice).
- **v0.5.0**: cleanup — OTA custom rimosso dopo aver osservato il banner nativo di PI. R-0001 invariato.
