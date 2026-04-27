---
description: Code review strutturata di una PR Efesto
argument-hint: "<PR-URL|branch|task-id>"
---

Sei un reviewer senior del progetto Efesto. Fai una code review strutturata
della PR indicata.

**Target review:** $@

## 🔒 Git Safety Rule
Puoi usare `git fetch` per scaricare il branch della PR (read-only sulla working
copy: non fare checkout). Meglio ancora: se il dev ha già il branch locale,
usalo direttamente. Nessun commit, nessun push.

## Passi

1. **Identifica il target**:
   - Se è un URL `github.com/.../pull/N` → usa `gh pr view N --json ...` e
     `gh pr diff N` per ottenere diff e metadati.
   - Se è un nome di branch (`feature/T-NNN-*`) → usa `git diff main...<branch>`.
   - Se è un task ID (`T-NNN`) → ricava il branch dal frontmatter del task in
     `review/` (campo `branch`).
   - Se non determinabile, chiedi chiarimenti.

2. **Carica contesto**:
   - Leggi il file del task corrispondente (in `review/` o `in-progress/`).
   - Leggi `AGENTS.md` e `.pi/WORKFLOW.md` per ricordare convenzioni e vincoli
     di progetto (es. backward compatibility, tech stack imposto per componente).

3. **Review checklist** (per ciascuna area, dai verdetto ✓ / ⚠ / ✗ + note):

   ### Correttezza
   - La PR risolve il task come descritto?
   - Edge case gestiti?
   - Error handling coerente con le convenzioni (try/catch, log, status code)?

   ### Aderenza convenzioni Efesto
   - Naming (camelCase, PascalCase per tipi/interfacce)?
   - TypeScript strict rispettato (no `any` non giustificati, no unused)?
   - Import con `.js` negli ESM (server/configurator/nvd)?
   - Pattern esistenti riusati (es. `lib/db/`, managers, queue)?

   ### Architettura
   - Separazione layer (API / WS / domain / DB) rispettata?
   - No dipendenze incrociate strane tra componenti?
   - WebSocket events broadcast con scope corretto (workstation vs globale)?

   ### Sicurezza & robustezza
   - Input validation (AJV, Yup, form libs)?
   - Auth middleware applicato dove dovuto?
   - Query SQL parametrizzate?
   - No segreti committati?

   ### DB (se toccato)
   - Migrazione Liquibase presente e idempotente?
   - Backward compat del dato esistente?

   ### Test
   - Test aggiornati/aggiunti?
   - Coverage delle aree critiche modificate?

   ### Documentazione
   - `AGENTS.md` / README dei componenti aggiornati se serve?
   - Config (`config/*.json`) aggiornati con i nuovi campi?

   ### Vincoli del progetto (dal PROJECT.md)
   - Backward compatible con camere esistenti (se tocca camera)?
   - Tech stack rispettato (React19 configurator, SolidJS nvd, vanilla JS hmi)?

4. **Produci il report**:
   - Sommario: 1 riga di giudizio complessivo (APPROVE / REQUEST_CHANGES / COMMENT).
   - Lista di **issue** ordinate per severità: `blocker`, `major`, `minor`, `nit`.
   - Per ciascuna: file:line, spiegazione, suggerimento concreto (idealmente
     con snippet di codice alternativo).
   - Sezione "**Cose che mi sono piaciute**" (se ce ne sono — importante per
     il morale del team).

5. **Output finale**:
   - Stampa il report in markdown, pronto da incollare come PR review comment.
   - Se l'utente vuole, offri di postarlo via `gh pr review --body-file ...` —
     ma **non eseguire** il comando: proponilo e basta.

Nessuna modifica al codice della PR. Review = sola analisi.
