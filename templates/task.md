---
id: {{ID}}
title: {{TITLE}}
status: backlog
estimate: null
progress: null
assignee: null
branch: null
created: {{DATE}}
updated: {{DATE}}
---

## Contesto

<!-- Perché questo task esiste? Quale problema risolve? Quale feature abilita?
     Referenziare ticket esterni, discussioni, decisioni architetturali. -->

## Obiettivo

<!-- Descrizione concreta di cosa va fatto. Scope chiaro. -->

## Componenti coinvolti

<!-- Checkare quelli impattati: -->
- [ ] server
- [ ] hmi
- [ ] configurator
- [ ] nvd
- [ ] mock-backend
- [ ] postgresql-liquibase (schema)
- [ ] e2e-server-tests
- [ ] config/

## Definition of Done

- [ ] Implementazione completa
- [ ] `npm run lint` passa nei componenti toccati
- [ ] `npm run typecheck` passa (se applicabile: server, configurator, nvd, e2e-server-tests)
- [ ] `npm run build` passa nei componenti toccati
- [ ] Test aggiornati/aggiunti se applicabile (e2e-server-tests, hmi, ecc.)
- [ ] Se schema DB: migrazione Liquibase creata e testata
- [ ] Documentazione aggiornata (AGENTS.md, README dei componenti, config/)
- [ ] Backward compatibility verificata (vincolo di progetto)
- [ ] PR aperta e approvata

## Note tecniche

<!-- Scelte implementative, trade-off, dipendenze tra componenti, punti di
     attenzione su WebSocket, DB, backend-frontend-interface, ecc. -->

## Log

<!-- Il dev aggiunge qui note durante il lavoro. -->
