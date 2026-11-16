# Desk Buddy — app

Webapp per controllare il Desk Buddy (ESP32-S3 con schermo AMOLED rotondo 466×466) dal telefono:
occhi (stile e colore) e funzioni del buddy (accese/spente, con sveglia, promemoria e città del meteo).

**Link dell'app:** https://chiaracorbo.github.io/desk-buddy-app/
(funziona dopo aver attivato GitHub Pages, vedi sotto)

---

## Come si usa

1. Apri il link dal telefono.
2. La prima volta l'app chiede **nome del buddy** e **codice segreto**: gli stessi inseriti nel portale DeskBuddy-Setup.
   Restano salvati solo sul telefono.
3. Cambia quello che vuoi: ogni modifica viene salvata subito.
   - **In attesa del buddy** → la modifica è salvata, il buddy non l'ha ancora presa (per esempio è spento).
   - **Applicato ✓** → il buddy la sta usando.
4. Il menu in basso ha quattro voci:
   - **Occhi**: stile e colore;
   - **App**: le funzioni del buddy, ognuna con il suo interruttore. Toccando Sveglia, Promemoria o Meteo
     si aprono le loro impostazioni. Fotografia ha un interruttore generale e quattro sotto-interruttori;
   - **Giochi**: Tris, Forza 4, Dado, Dama e Battaglia navale da fare col buddy (si apre anche dalla scheda Giochi nella pagina App).
     Il telefono tiene il tabellone; il buddy fa le sue reazioni. Se il buddy non risponde, c'è **Gioca senza buddy**;
   - **Impostazioni** (⚙︎): nome, codice e stato del buddy.

### Aggiungerla alla schermata Home

- **iPhone (Safari):** tasto Condividi → *Aggiungi alla schermata Home*.
- **Android (Chrome):** menu ⋮ → *Installa app* (o *Aggiungi a schermata Home*).

Su iPhone l'app installata ha una memoria separata da Safari: al primo avvio dall'icona potrebbe chiedere di nuovo nome e codice.
Puoi incollare il link di configurazione (sotto) nel campo apposito.

### Link di configurazione (evita di scrivere nome e codice a mano)

Compila questo link sostituendo le parti in MAIUSCOLO:

```
https://chiaracorbo.github.io/desk-buddy-app/#nome=NOME-DEL-BUDDY&codice=IL-TUO-CODICE
```

- Se il nome contiene spazi, scrivili come `%20` (es. `Pippo%20Blu`).
- Aprendo il link l'app salva nome e codice e **li toglie subito dall'indirizzo**.
- La parte dopo `#` non viene mai inviata a GitHub. Però il link contiene il codice: **non condividerlo**.
- Non scrivere mai il tuo codice vero in questo file o in altri file del repository: il repository è pubblico.

---

## Provare l'app prima che il buddy sia pronto

C'è un pannello nascosto che finge di essere il buddy:

1. Apri **Impostazioni** (⚙︎ nel menu in basso), scorri in fondo e **tocca 5 volte** la scritta "Desk Buddy · versione …".
2. Compare **Strumenti di prova**:
   - **Simula buddy acceso**: ogni modifica diventa "Applicato ✓" dopo 3 secondi;
   - **Simula buddy: applica adesso**: scrive lo stato una volta;
   - **Simula buddy visto 2 ore fa**: per vedere come appare un buddy spento da tempo;
   - **Cancella lo stato**: come se il buddy non si fosse mai collegato;
   - **Simula impostazioni vecchie**: scrive impostazioni senza `funzioni` (come un'app vecchia): l'app deve mostrare
     tutte le funzioni accese e il promemoria spento.
   - con **Simula buddy acceso**, quando apri un gioco il buddy finto risponde "pronto" dopo 2 secondi.
     Nella schermata della partita compare anche **Prova: simula buddy pronto** e una riga che dice cosa riceve il buddy.

Scrivono davvero nel database (in `/buddy/<codice>/<nome>/stato`), esattamente come farà il buddy.
Usa pure un nome di prova (es. `prova`) per non toccare quello vero.

---

## Attivare GitHub Pages (una volta sola)

1. Su GitHub apri il repository → **Settings** → **Pages** (nel menu a sinistra).
2. In *Build and deployment* → *Source* scegli **Deploy from a branch**.
3. In *Branch* scegli **main** e cartella **/ (root)** → **Save**.
4. Dopo 1–2 minuti l'app è su https://chiaracorbo.github.io/desk-buddy-app/

Il sito è pubblicato dal ramo `main`: ogni modifica caricata su `main` diventa visibile sul link
entro 1–2 minuti, senza altri passaggi.

---

## File del progetto

| File | Cosa contiene |
|---|---|
| `index.html` | Tutta l'app: struttura, stile (colori e misure nelle variabili in cima, sezione `:root`) e funzionamento |
| `config.js` | Indirizzo del database e ogni quanto controllare il buddy |
| `manifest.webmanifest`, `sw.js`, `icons/` | Servono per installarla sulla schermata Home e farla aprire anche senza rete |
| `PROTOCOLLO.md` | Come app e buddy si scambiano i dati: da usare per scrivere il codice del buddy |
| `regole-firebase-proposte.json` | Regole di sicurezza proposte per il database (da incollare nella console Firebase) |

### Cambiare lo stile

Apri `index.html`: in cima, nella sezione `:root`, ci sono tutti i colori (`--bg`, `--surface`, `--text`…)
e le misure (`--radius`, `--tap` = altezza dei pulsanti, `--preview` = grandezza dell'anteprima…).
`--accent` viene sostituito automaticamente dal colore degli occhi scelto.

Dopo aver cambiato i file, in `sw.js` aumenta il numero in `const CACHE = "deskbuddy-v4"` (es. `v5`):
così i telefoni scaricano la versione nuova.
