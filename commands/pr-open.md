---
description: Verifica DoD del task corrente e prepara la descrizione della PR
argument-hint: "[task-id]"
---

Sei l'agente del workflow SCRUM-lite del progetto. Il dev ha finito il lavoro sul
branch di feature e vuole aprire una PR. Tu verifichi la DoD e generi la
descrizione; lui apre la PR a mano.

**Task:** $@ (opzionale — deriva dal branch se vuoto)

## 🔒 Git Safety Rule
NON eseguire `gh pr create`, `git push`, `git mv`, commit. Solo letture.

## Passi

1. **Identifica task e branch**:
   - Da `$1` o da `git branch --show-current` (deve matchare `feature/T-NNN-*`).
   - Il file del task dovrebbe essere in `in-progress/`.

2. **Verifica preconditions**:
   - Branch ≠ `main`. Se `main`, errore.
   - `git status --porcelain` → pulito. Se no, avvisa di committare prima.
   - `git log --oneline main..HEAD` → deve esserci almeno 1 commit.

3. **DoD audit** (il cuore del comando):
   - Leggi la checklist DoD dal task.
   - Per ciascun item spuntabile automaticamente, prova a verificarlo:
     - **Lint**: esegui `npm run lint` SOLO nei componenti indicati in
       "Componenti coinvolti". Report pass/fail per ciascuno.
     - **Typecheck**: idem con `npm run typecheck` dove applicabile
       (server, e2e-server-tests).
     - **Build**: `npm run build` nei componenti frontend toccati.
     - **Test**: `npm test` dove c'è (hmi, e2e-server-tests).
     - **Migrazione DB**: se `postgresql-liquibase/` è spuntato, verifica che
       ci siano cambi in quella cartella con `git diff --stat main...HEAD`.
   - Per item manuali (documentazione, backward compat), chiedi conferma al dev.
   - **Se qualcosa fallisce**: mostra output, NON bloccare ma avvisa chiaramente
     che la PR non dovrebbe essere aperta finché non è verde.

4. **Aggiorna la DoD nel file del task** (via `edit`):
   - Spunta `[x]` gli item verificati con successo.
   - Lascia `[ ]` quelli falliti o non verificabili automaticamente.

5. **Genera la descrizione PR**:
   - Leggi `$EXT_DIR/templates/pr.md`.
   - Compila sostituendo `{{TITLE}}` e `{{ID}}`.
   - Per "Cosa cambia" e "Componenti toccati": deduci da `git diff --stat main...HEAD`
     e dal contenuto del task.
   - Salva in `.pi/tasks/in-progress/<ID>-*.pr.md` (file temporaneo, gitignored
     suggerito — vedi nota sotto) OPPURE stampa direttamente in output e basta.
   - **Approccio raccomandato**: stampa la descrizione markdown in chat, pronta
     da copia-incollare nella PR web.

6. **Istruzioni finali al dev**:
   ```
   DoD: 7/8 verificati ✓ (manca: "Documentazione aggiornata")

   Per aprire la PR:

     # 1. Assicurati che il branch sia pushato e aggiornato
     git push

     # 2. Apri la PR (via gh CLI o web UI)
     gh pr create \
       --base main \
       --head feature/T-003-add-web-camera-support \
       --title "T-003: Add web camera support" \
       --body-file <(cat <<'EOF'
   <...descrizione generata...>
   EOF
   )

     # 3. Dopo aver aperto la PR, sposta il task in review/:
     git mv .pi/tasks/in-progress/T-003-*.md .pi/tasks/review/
     # aggiorna status: review nel frontmatter (puoi chiedermelo)
     git add -A
     git commit -m "chore(T-003): move to review"
     git push
   ```

7. **Offri**: "Vuoi che aggiorni ora `status: review` nel frontmatter del task?"
   Se sì → `edit` sul file. Il dev poi fa `git mv` e commit.
