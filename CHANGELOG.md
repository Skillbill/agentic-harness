# Changelog

Tutti i cambiamenti rilevanti di `@skillbill/agentic-harness` sono documentati in questo file.

Il formato è basato su [Keep a Changelog 1.1.0](https://keepachangelog.com/en/1.1.0/), e il progetto aderisce a [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

In aggiunta alle sezioni standard di Keep a Changelog (`Added`, `Changed`, `Deprecated`, `Removed`, `Fixed`, `Security`), ogni rilascio può includere una sezione **`Migration`** che descrive gli step di compatibilità che un progetto consumer deve applicare quando aggiorna AH a quella versione. Quando una migration è automatizzabile, AH la applica al `session_start` successivo via il framework di consumer migration (vedi R-0003 in `REQUIREMENTS.md`); il bullet `Migration` qui sotto serve da documentazione human-readable.

## [Unreleased]

### Added
- `CHANGELOG.md` in formato Keep a Changelog 1.1.0, popolato retroattivamente da v0.1.0 a v0.6.0.
- Framework di consumer migration: `lib/migrate-consumer.ts` (runner) + `lib/migrations/{index,types}.ts` (registry). Marker `<consumerRoot>/.pi/ah-version` per tracciare l'ultima versione di AH applicata al progetto. Lista migration inizialmente vuota — v0.6.0 è baseline.
- GitHub Action `.github/workflows/release.yml`: al push di un tag `vX.Y.Z` estrae la sezione corrispondente del CHANGELOG via `awk` POSIX e crea la GitHub Release con quel body (zero deps esterne, `gh` CLI preinstallato sui runner).
- Nuova sezione `Consumer migration` in `CLAUDE.md` e requisito **R-0003** in `REQUIREMENTS.md`.

### Changed
- Sezione `How to release a new version` in `CLAUDE.md` allineata al nuovo flow (aggiorna CHANGELOG → bump → tag → la Action crea la release).
- Hook `session_start` in `extensions/index.ts` invoca `migrateConsumer(pi, cwd)` prima del log di startup.

### Migration
- Nessuna azione richiesta. Questa versione introduce il framework di migration ma la lista iniziale è vuota: al primo `session_start` dopo l'upgrade, AH si limita a scrivere il marker `.pi/ah-version` nel consumer.

## [0.6.0] — 2026-05-14

### Changed
- Test release per verificare l'interazione col banner nativo `Package Updates Available` di PI v0.74.0 in una catena di rilasci consecutivi (nessun cambiamento di codice).

### Migration
- Nessuna azione richiesta.

## [0.5.0] — 2026-05-14

### Removed
- OTA custom: rimossi `lib/ota-update.ts`, `lib/install-info.ts`, `lib/version.ts` (~280 righe). AH delega completamente al banner nativo di PI v0.74.0 (`Package Updates Available`) e al comando manuale `pi update`. Decisione documentata in R-0002 (declinato) di `REQUIREMENTS.md`.

### Changed
- Riscritte le sezioni OTA-related di `CLAUDE.md` e `REQUIREMENTS.md` per riflettere il nuovo flow basato sul banner nativo (PR #4).

### Migration
- Nessuna mutazione automatica sul filesystem del consumer.
- Se in precedenza avevi configurato un AH pinnato a `v0.4.0` o inferiore, sappi che `pi update` salta i pinned: per upgradare ri-esegui `pi install git:github.com/Skillbill/agentic-harness@v0.5.0` (o ref successivo).

## [0.4.0] — 2026-05-14

### Changed
- Test release end-to-end del flow OTA custom (nessuna modifica di codice).

### Migration
- Nessuna azione richiesta.

## [0.3.0] — 2026-05-14

### Fixed
- (PR #3) Rimosso il flag non supportato `-l` dall'invocazione di `pi update` nel modulo OTA custom: PI non espone quell'opzione.

### Migration
- Nessuna azione richiesta.

## [0.2.0] — 2026-05-14

### Added
- (PR #2) Scope detection (project-local vs global) e pinning detection nel flow OTA, leggendo le settings PI per decidere se proporre l'update.

### Migration
- Nessuna azione richiesta.

## [0.1.0] — 2026-05-14

### Added
- (PR #1) Distribuzione di AH come **Pi Package** installabile via `pi install git:github.com/Skillbill/agentic-harness[@<ref>]` (R-0001).
- Manifest `pi` in `package.json` con entry `extensions/index.ts`, convention dirs `prompts/` e `skills/`, helper TS isolati in `lib/`.
- OTA custom completo: check GitHub Releases all'avvio, modal di accept, `ctx.reload()` automatico dopo `pi update` (R-0002, poi rimosso in v0.5.0).
- Peer dependencies su `@earendil-works/pi-coding-agent` e `typebox` (entrambe fornite da PI).

### Migration
- Nessuna azione richiesta — prima release pubblica.

[Unreleased]: https://github.com/Skillbill/agentic-harness/compare/v0.6.0...HEAD
[0.6.0]: https://github.com/Skillbill/agentic-harness/compare/v0.5.0...v0.6.0
[0.5.0]: https://github.com/Skillbill/agentic-harness/compare/v0.4.0...v0.5.0
[0.4.0]: https://github.com/Skillbill/agentic-harness/compare/v0.3.0...v0.4.0
[0.3.0]: https://github.com/Skillbill/agentic-harness/compare/v0.2.0...v0.3.0
[0.2.0]: https://github.com/Skillbill/agentic-harness/compare/v0.1.0...v0.2.0
[0.1.0]: https://github.com/Skillbill/agentic-harness/releases/tag/v0.1.0
