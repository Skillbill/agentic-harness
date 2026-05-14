---
description: Esegue operazioni git mutanti proposte in precedenza (eccezione esplicita alla Git Safety Rule)
argument-hint: "[lista di comandi git, opzionale]"
---

Sei l'Assistente del workflow SCRUM-lite del progetto. Il dev usa questo
comando per **delegarti l'esecuzione** di operazioni git mutanti che
normalmente dovrebbe eseguire lui a mano (per via della Git Safety Rule).

**Argomento (opzionale):** $@

## 🔒 Eccezione esplicita alla Git Safety Rule

Questo comando **è autorizzato** a eseguire comandi git mutanti
(`git add`, `git commit`, `git push`, e altri elencati sotto) al posto
del dev. Vedi anche `AGENTS.md` → *Git Safety Rule*.

L'eccezione è **circoscritta a questo turno**: esegui il piano, mostra
l'esito, poi torna al comportamento standard (niente git mutante fuori
dai prompt che lo dichiarano).

## Comandi consentiti

Whitelist esplicita. Tutto ciò che non è in lista → chiedi conferma extra
al dev prima di eseguire, o proponilo come comando manuale.

- `git add <path>` — solo con path espliciti (mai `git add .` o `-A`,
  a meno che il dev lo abbia scritto esattamente così nella sua richiesta).
- `git commit -m "<msg>"` — messaggio già deciso (dal dev o proposto
  dall'agente nel turno precedente).
- `git push` — push semplice sul branch corrente, senza flag pericolosi
  (`--force`, `--force-with-lease`, `--mirror`, `--delete`).
- `git checkout -b <branch>` / `git switch -c <branch>` — solo se
  esplicitamente richiesto.
- `git checkout <branch>` / `git switch <branch>` — solo se
  esplicitamente richiesto.
- `git merge --ff-only <branch>` — solo se esplicitamente richiesto.

**Comandi vietati** anche dentro `/do-git-stuff` (richiedono richiesta
esplicita e circostanziata dal dev, non bastano i suggerimenti
precedenti):

- `git push --force` / `--force-with-lease`
- `git reset --hard`
- `git rebase` (qualunque forma)
- `git branch -D` / `git push --delete`
- Modifica di tag o operazioni su remote diversi da `origin`

Se il piano include uno di questi comandi, **fermati** e chiedi
conferma esplicita al dev citando il comando esatto.

## Passi

1. **Determina il piano di comandi**:
   - Se `$@` contiene uno o più comandi git, usali come piano
     (separati da newline o `&&`).
   - Altrimenti, recupera dal contesto della conversazione **i comandi
     git che hai (Assistente) proposto al dev nel turno precedente** e
     che lui non ha ancora eseguito. Se sono stati proposti più blocchi,
     usa l'ultimo blocco di comandi suggerito.
   - Se non riesci a determinare un piano (nessun argomento, nessun
     comando precedente identificabile), chiedi al dev di riformulare
     (es. «quali comandi vuoi che esegua?») e fermati.

2. **Valida il piano contro la whitelist**:
   - Ogni comando deve iniziare con `git` (niente `rm`, `cp`, pipe verso
     shell, ecc.).
   - Controlla che ogni comando sia nella whitelist sopra.
   - Controlla che non ci siano comandi vietati.
   - Se c'è qualcosa che non va, mostralo al dev e chiedi cosa fare
     (rimuoverlo / sostituirlo / eseguire comunque con conferma esplicita).

3. **Verifica stato git prima di eseguire** (read-only):
   - `git branch --show-current` → mostra il branch corrente.
   - `git status --porcelain` → mostra le modifiche in corso.
   - Se il piano include `commit` ma non c'è nulla in staging dopo l'add
     previsto, avvisa il dev (probabile no-op o errore).
   - Se il piano include `push` ma il branch corrente non ha un upstream,
     usa `git push -u origin <branch>` (dopo aver avvisato il dev).

4. **Esegui i comandi uno a uno**, mostrando per ciascuno:
   - Il comando esatto che stai per eseguire.
   - L'output di stdout/stderr.
   - Il codice di uscita.

   Se un comando **fallisce** (exit code ≠ 0), **ferma l'esecuzione**,
   mostra l'errore e chiedi al dev come procedere (riprova / annulla /
   fix manuale). Non continuare la sequenza a occhi chiusi.

5. **Output finale**:
   - Riassunto: quali comandi sono stati eseguiti con successo, quali
     saltati/falliti.
   - Stato finale: `git status` breve e, se rilevante,
     `git log -1 --oneline` del commit appena creato.
   - Se l'operazione faceva parte di un workflow (es. chiusura task),
     ricordalo ma non proseguire con altri passi — il dev tornerà con
     il comando appropriato.
