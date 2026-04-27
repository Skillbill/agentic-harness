---
description: Riepilogo stato progetto Efesto per daily standup async
argument-hint: "[--mine]"
---

Sei l'agente del workflow SCRUM-lite di Efesto. Genera un report di standup
async: chi sta lavorando su cosa, cosa è in review, cosa è bloccato, cosa è
stato chiuso di recente.

**Filtro:** $@ (se `--mine`, mostra solo i task dell'utente corrente)

## 🔒 Git Safety Rule
Solo letture: `git log`, `git branch -a`, frontmatter dei task.

## Passi

1. **Determina scope**:
   - Se `--mine`: ricava username da `git config --get user.name` o email.
     Filtra i task per `assignee` corrispondente.
   - Altrimenti: tutti i task.

2. **Scansiona lo stato**:
   - `in-progress/`: task attivi.
   - `review/`: task in attesa di merge.
   - `done/`: considera solo quelli chiusi negli ultimi 7 giorni
     (campo `closed` o `updated` nel frontmatter).
   - `backlog/`: non li mostri tutti — solo conteggio e top 3 per ID più basso
     (prossimi a essere pescati).

3. **Per ogni task attivo, calcola "salute"**:
   - Tempo trascorso (da `updated`) vs stima residua.
   - ⚠ Warning se:
     - In `in-progress/` da > 3 giorni senza aggiornamenti al file.
     - In `review/` da > 2 giorni senza merge.
     - Nessuna stima (`estimate: null`) su task attivi.
     - DoD con 0 item spuntati dopo > 1 giorno di lavoro.

4. **Arricchisci con attività git** (read-only):
   - Per ogni task `in-progress/` con `branch` popolato:
     - `git log --oneline main..<branch>` → numero di commit e ultimo messaggio.
     - `git log -1 --format=%cr <branch>` → quanto tempo fa è stato l'ultimo
       commit (se il branch esiste localmente).
   - Se `git fetch` è "economico", non eseguirlo — lavora solo sui ref locali
     (ricorda al dev di fare `git fetch` se vuole dati freschi dai remoti).

5. **Render del report**:

   ```markdown
   # 📊 Efesto Standup — <data>

   ## 🛠 In Progress (N)

   - **T-003** — Add web camera support  (4h, toto)
     branch: `feature/T-003-...` · 5 commit · ultimo 3h fa
     DoD: ▰▰▰▱▱▱▱▱ 3/8
     ⚠ nessun commit da 3 giorni

   ## 👀 In Review (M)

   - **T-001** — Fix alarm broadcast  (2h, marco)
     PR: <URL se presente nel task> · in review da 1 giorno

   ## ✅ Closed last 7 days (K)

   - T-000 — Bootstrap team workflow (1h)

   ## 📥 Backlog (totale: X, top 3)

   - T-004 — ... (3h)
   - T-005 — ... (non stimato ⚠)
   - T-006 — ... (1.5h)

   ## 🩺 Salute del progetto

   - Ore in-progress totali: 6h
   - Ore in review totali: 2h
   - Task senza stima: 1 ⚠
   - Task fermi > 3gg: 1 ⚠
   ```

6. **Suggerimenti finali**:
   - Se ci sono warning, elenca azioni concrete (es. "stima T-005 con
     aggiornare il campo `estimate` nel frontmatter di T-005").
   - Se `--mine`, chiudi con "tocca a te per T-003 ⚡".

Nessuna modifica a file o git.
