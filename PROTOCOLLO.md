# Protocollo Desk Buddy ↔ app

Questo documento descrive come l'app sul telefono e il Desk Buddy (ESP32-S3) si parlano.
Non si parlano mai direttamente: **si scambiano messaggi lasciandoli nel database** Firebase Realtime Database.

```
 Telefono (app)  ── scrive impostazioni ──▶  DATABASE  ◀── legge impostazioni ──  Buddy
                 ◀── legge stato ─────────             ── scrive stato ───────▶
```

- Indirizzo del database: `https://deskbuddy-50b8e-default-rtdb.europe-west1.firebasedatabase.app`
  (si trova anche in `config.js`)
- Si usano solo le **API REST** (normali richieste HTTPS), niente librerie Firebase.

---

## 1. Dove stanno i dati

Ogni buddy ha il suo percorso:

```
/buddy/<codice>/<nome>/impostazioni   ← lo scrive l'app, lo legge il buddy
/buddy/<codice>/<nome>/stato          ← lo scrive il buddy, lo legge l'app
/buddy/<codice>/<nome>/partita        ← lo scrive l'app durante un gioco, lo legge il buddy   (sezione 8)
/buddy/<codice>/<nome>/partitaStato   ← lo scrive il buddy per dire "sono pronto a giocare" (sezione 8)
```

- `<codice>` è il codice segreto, `<nome>` il nome del buddy: gli stessi inseriti nel portale **DeskBuddy-Setup**.
- Maiuscole e minuscole contano: `Pippo` e `pippo` sono due buddy diversi.
- Non possono contenere i caratteri `. $ # [ ] /` (Firebase non li accetta nei percorsi). Massimo 64 caratteri.
- Nell'indirizzo vanno "codificati" (URL-encoding): per esempio lo spazio diventa `%20`.

Per leggere o scrivere un percorso si aggiunge `.json` alla fine:

```
https://deskbuddy-50b8e-default-rtdb.europe-west1.firebasedatabase.app/buddy/<codice>/<nome>/impostazioni.json
```

---

## 2. `impostazioni` (scritte dall'app)

L'app le scrive **sempre tutte insieme** (richiesta `PUT`, che sostituisce tutto), ogni volta che cambi qualcosa.

```json
{
  "stile": 3,
  "colore": "#FF4FA3",
  "sveglia": {
    "attiva": true,
    "ora": 7,
    "minuto": 30,
    "giorni": [true, true, true, true, true, false, false]
  },
  "promemoriaMinuti": 45,
  "citta": "Torino",
  "funzioni": {
    "pomodoro": true,
    "promemoria": true,
    "meteo": true,
    "contoAllaRovescia": false,
    "respiro": true,
    "tiPenso": true,
    "giochi": true,
    "foto": true,
    "oraDoro": true,
    "sfida": false,
    "diario": true,
    "delusa": true
  },
  "versione": 1794776259675
}
```

| Campo | Tipo | Valori | Significato |
|---|---|---|---|
| `stile` | numero intero | 0–7 | 0 classici · 1 ovali · 2 tondi · 3 gatto · 4 assonnati · 5 diaframma · 6 cuore · 7 stella |
| `colore` | testo | `"#RRGGBB"` (sempre maiuscolo) | colore degli occhi |
| `sveglia.attiva` | vero/falso | `true` / `false` | sveglia accesa o spenta (è anche l'interruttore della Sveglia nella pagina App) |
| `sveglia.ora` | numero intero | 0–23 | ora (formato 24 ore) |
| `sveglia.minuto` | numero intero | 0–59 | minuti |
| `sveglia.giorni` | lista di 7 vero/falso | posizione 0 = **lunedì** … 6 = **domenica** | giorni in cui suona. Tutti `false` = non suona mai |
| `promemoriaMinuti` | numero intero | 5–240 (l'app usa passi di 5) | ogni quanti minuti fare il promemoria. Resta salvato anche quando il promemoria è spento. Vedi nota sotto per lo `0` |
| `citta` | testo | massimo 60 caratteri, può essere `""` | città del meteo. `""` = nessuna città |
| `funzioni` | oggetto di vero/falso | vedi tabella sotto | quali funzioni del buddy sono accese |
| `versione` | numero intero | millisecondi dal 1/1/1970 | "numero di serie" della modifica: cambia ogni volta |

### L'oggetto `funzioni`

Un interruttore acceso/spento per ogni funzione (`true` = accesa, `false` = spenta).

| Chiave | Funzione |
|---|---|
| `pomodoro` | Pomodoro |
| `promemoria` | Promemoria (i minuti sono in `promemoriaMinuti`) |
| `meteo` | Meteo (la città è in `citta`) |
| `contoAllaRovescia` | Conto alla rovescia |
| `respiro` | Respiro |
| `tiPenso` | Ti penso |
| `giochi` | Giochi (nell'app ha una voce sua nel menu in basso) |
| `foto` | Fotografia: **interruttore generale** del gruppo |
| `oraDoro` | Fotografia → Ora d'oro e ora blu |
| `sfida` | Fotografia → Sfida del giorno |
| `diario` | Fotografia → Diario delle uscite |
| `delusa` | Fotografia → Faccia delusa dopo tanti giorni senza foto |

Regole:

- **La Sveglia non è dentro `funzioni`**: il suo interruttore è il già esistente `sveglia.attiva`.
- **Fotografia è un gruppo**: una sotto-funzione (`oraDoro`, `sfida`, `diario`, `delusa`) è attiva solo se
  sono `true` **sia** lei **sia** `foto`. Quando `foto` è `false` l'app conserva i valori delle sotto-funzioni
  (così riaccendendo `foto` tornano come prima), ma il buddy deve considerarle tutte spente.
- **Promemoria**: l'interruttore è `funzioni.promemoria`. Il promemoria suona solo se `funzioni.promemoria` è `true`
  **e** `promemoriaMinuti` è almeno 5. Per compatibilità con il vecchio protocollo, `promemoriaMinuti: 0` vuol dire
  ancora "spento" (l'app, se lo trova, lo mostra come interruttore spento e propone 30 minuti).
- **Buddy e app vecchi**: se `funzioni` manca del tutto, o manca una sua voce, quella funzione va considerata **accesa**.
- Una funzione spenta resta visibile (in grigio) nella pagina App, così si può riaccendere in qualsiasi momento.

**Attenzione per il codice del buddy**

- `versione` è un numero grande (13 cifre), **non ci sta in un `int` a 32 bit**. Sull'ESP32 usa `int64_t` / `uint64_t`
  (con ArduinoJson: `doc["versione"].as<int64_t>()`), oppure trattalo come testo da ricopiare così com'è.
  Il buddy non deve fare calcoli con la versione: deve solo **ricopiarla** nello stato.
- Attenzione al giorno della settimana: in C (`struct tm`, `tm_wday`) la domenica è 0 e il lunedì è 1.
  Qui invece la posizione 0 è **lunedì**. Conversione: `indice = (tm_wday + 6) % 7`.
- Se il percorso `impostazioni` non esiste ancora (risposta `null`), il buddy usa i suoi valori iniziali.
- Se un campo manca o ha un valore strano, il buddy usa il suo valore iniziale per quel campo.

---

## 3. `stato` (scritto dal buddy)

Il buddy scrive qui quello che **sta usando davvero**, la `versione` che ha applicato e quando si è fatto sentire.

```json
{
  "stile": 3,
  "colore": "#FF4FA3",
  "sveglia": { "attiva": true, "ora": 7, "minuto": 30, "giorni": [true, true, true, true, true, false, false] },
  "promemoriaMinuti": 45,
  "citta": "Torino",
  "funzioni": { "pomodoro": true, "promemoria": true, "meteo": true, "contoAllaRovescia": false, "respiro": true, "tiPenso": true, "giochi": true, "foto": true, "oraDoro": true, "sfida": false, "diario": true, "delusa": true },
  "versione": 1794776259675,
  "ultimoContatto": { ".sv": "timestamp" }
}
```

- Stessi campi delle impostazioni, con i valori **effettivamente in uso**.
- `funzioni`: i valori **reali** del buddy, tutte e 12 le chiavi (anche quelle che ha ricevuto mancanti e ha considerato accese).
  Le sotto-funzioni della Fotografia si scrivono con il loro valore così com'è, anche quando `foto` è `false`.
- `versione`: la versione delle impostazioni applicate (ricopiata). Se il buddy non ha mai ricevuto impostazioni, `0`.
- `ultimoContatto`: l'ora in millisecondi. **Consiglio:** scrivi letteralmente `{".sv": "timestamp"}`:
  Firebase la sostituisce da solo con l'ora esatta del server. Così non serve che l'orologio del buddy sia giusto.

---

## 4. Cosa fa il buddy, passo per passo

1. **All'accensione** (dopo il Wi-Fi): legge `impostazioni`, le applica, scrive `stato` (completo).
2. **Ogni 10 secondi** circa: legge `impostazioni`.
   Se `versione` è diversa da quella che sta usando → applica i nuovi valori → scrive `stato` (completo).
3. **Ogni 60 secondi**: aggiorna solo `ultimoContatto` (serve all'app per dire "visto l'ultima volta: X fa"):
   ```
   PATCH .../stato.json      corpo: {"ultimoContatto": {".sv": "timestamp"}}
   ```

Richieste HTTPS di esempio (`<base>` = indirizzo del database + `/buddy/<codice>/<nome>`):

```
GET   <base>/impostazioni.json               → risposta: il JSON delle impostazioni, oppure null
PUT   <base>/stato.json        corpo: {...}  → sostituisce tutto lo stato
PATCH <base>/stato.json        corpo: {...}  → cambia solo i campi indicati
```

Suggerimenti:
- Per risparmiare dati si può leggere solo la versione: `GET <base>/impostazioni/versione.json`,
  e scaricare tutto solo quando cambia.
- Il certificato HTTPS di Firebase è di Google: con `WiFiClientSecure` usa il bundle di certificati
  dell'ESP32 (`setCACertBundle`) oppure, solo per le prove, `setInsecure()`.

---

## 5. Cosa fa l'app

- Scrive `impostazioni` complete, con una nuova `versione`, ogni volta che cambi qualcosa
  (aspetta 0,7 secondi dall'ultimo tocco, così trascinando il colore non manda 50 messaggi).
- Legge `stato` ogni 15 secondi (ogni 4 secondi quando aspetta il buddy).
- Mostra:
  - **"In attesa del buddy"** finché `stato.versione` ≠ `impostazioni.versione`;
  - **"Applicato ✓"** quando sono uguali;
  - **"visto l'ultima volta: X fa"** da `stato.ultimoContatto`;
  - pallino verde accanto al nome se l'ultimo contatto è di meno di 3 minuti fa;
  - in Impostazioni → Stato del buddy, le funzioni che il buddy ha **davvero** spente (da `stato.funzioni`).
- Nella pagina **App** ogni funzione ha il suo interruttore: cambiarlo scrive le impostazioni complete come sempre.
- **Giochi**: vedi la sezione 8.
- Gli strumenti di prova ("simula buddy") ricopiano anche `funzioni` nello stato, e possono scrivere delle
  impostazioni "vecchie" senza `funzioni` per provare che l'app le mostri tutte accese.
- Se il telefono non ha rete, la modifica resta salvata sul telefono e viene inviata appena possibile.

---

## 6. Proposte di miglioramento (NON ancora applicate)

Queste non sono nel protocollo: te le propongo, decidi tu. Se ne approvi qualcuna aggiorno app e documento.

1. **Fuso orario** — campo `fusoOrario` nelle impostazioni (es. `"CET-1CEST,M3.5.0,M10.5.0/3"`, il formato che l'ESP32 capisce con `setenv("TZ", ...)`).
   *Perché:* il buddy prende l'ora da internet in UTC; senza fuso orario la sveglia suonerebbe un'ora o due prima. Si può anche fissare nel codice del buddy se resterà sempre in Italia.
2. **Errori dal buddy** — campo `errore` nello stato (es. `"citta_non_trovata"`), che l'app mostra.
   *Perché:* oggi se scrivi "Torinoo" il buddy non trova il meteo e tu non lo sai.
3. **Versione del firmware** — campo `firmware` nello stato (es. `"1.2.0"`).
   *Perché:* quando aggiornerai il codice del buddy, l'app potrà sapere cosa supporta.
4. **Nome sempre minuscolo** — l'app e il buddy trasformano il nome in minuscolo prima di usarlo.
   *Perché:* evita il caso "ho scritto Pippo nel portale e pippo nell'app, e non si parlano". Va fatto in entrambi, insieme.
5. **Validazione nel database** — vedi sotto e `regole-firebase-proposte.json`.

---

## 7. Regole di sicurezza del database

### Come funziona la sicurezza oggi (da sapere)

- Chi conosce **codice e nome** può leggere e cambiare le impostazioni di quel buddy. Non c'è password o account:
  **il codice segreto è la chiave di casa**.
- Se le regole danno accesso solo a `/buddy/<codice>/` (e non a `/buddy/` intero), nessuno può vedere l'elenco dei codici:
  per entrare bisogna indovinarlo. Quindi **il codice deve essere lungo e casuale** (almeno 12 caratteri, lettere e numeri a caso).
  Un codice tipo `1234` o `pippo` si indovina in pochi minuti.
- Le regole attuali (per come le hai descritte) **non controllano cosa viene scritto**: chiunque abbia un codice qualsiasi
  può scriverci dentro dati di qualunque forma e dimensione, anche creando codici nuovi a piacere.

### Cosa propongo

Il file `regole-firebase-proposte.json` aggiunge:
- **niente accesso** fuori da `/buddy/<codice>/` (né lettura né scrittura della radice o di `/buddy`);
- **codice di almeno 8 caratteri** (abbassalo o alzalo in base a cosa accetta il portale);
- **controllo di ogni campo** (tipo e valori ammessi, come nella tabella sopra);
- **niente campi extra** (`$altro: false`): non si possono riempire i dati di spazzatura;
- `ultimoContatto` non può essere nel futuro.

Per applicarle: console Firebase → Realtime Database → **Regole** → incolla il contenuto del file → **Pubblica**.
Prima prova con il **Simulatore regole** (Rules Playground) nella stessa pagina: una scrittura dell'app deve passare,
una con `"stile": 9` deve essere rifiutata.

> Nota: se aggiungi i campi delle proposte 1–3, vanno aggiunti anche alle regole, altrimenti verranno rifiutati.
>
> **Importante (novembre 2026):** il file delle regole ora include anche `funzioni`, `partita` e `partitaStato`. Se avevi già pubblicato
> la versione precedente delle regole, ripubblica quella nuova: la vecchia rifiuterebbe ogni scrittura con `funzioni`
> (per via di `$altro: false`) e l'app resterebbe su "Non inviato".

### Limiti che restano

- Il codice viaggia nell'indirizzo delle richieste (in HTTPS, quindi cifrato in rete), ma resta nei link che condividi:
  **non mandare il link di configurazione in chat di gruppo**.
- La protezione "vera" (account, Firebase Authentication) è più complessa da gestire sull'ESP32. Per un oggetto personale
  un codice lungo e casuale + queste regole è un compromesso ragionevole.

---

## 8. Giochi: `partita` e `partitaStato`

Prima versione: **Tris**, **Forza 4**, **Dado**.

**Chi fa cosa**
- Il **telefono** mostra il tabellone, controlla le mosse e **decide anche le mosse del buddy**
  (Tris: imbattibile in "difficile", con errori casuali in "facile"; Forza 4: due livelli).
- Il **buddy** non conosce il tabellone: mostra solo le **reazioni** che gli chiede l'app
  (pensa, esulta, broncio, pareggio, "tocca a te") e, nel Dado, l'animazione e il risultato.

### `partita` (scritto dall'app)

L'app la scrive tutta insieme (`PUT`) a ogni cambiamento.

```json
{
  "id": "pm3x8k2ab12",
  "gioco": "tris",
  "stato": "in_corso",
  "turno": "buddy",
  "ultimaMossa": { "chi": "giocatore", "posizione": 4 },
  "esito": null,
  "reazione": "pensa",
  "manche": 1,
  "passo": 7,
  "difficolta": "difficile",
  "dado": null,
  "aggiornato": { ".sv": "timestamp" }
}
```

| Campo | Valori | Significato |
|---|---|---|
| `id` | testo (max 40) | identifica la partita. Cambia ogni volta che si apre un gioco |
| `gioco` | `tris` · `forza4` · `dado` | il gioco. In futuro: `dama`, `battaglia`, `moneta`, `palla8`, `indovinaChi` |
| `stato` | `attesa` · `in_corso` · `finita` | `attesa` = l'app sta chiamando il buddy · `in_corso` = si gioca · `finita` = il buddy torna normale |
| `turno` | `giocatore` · `buddy` · assente | di chi è il turno. Assente nel Dado, a manche finita e a partita finita |
| `ultimaMossa` | `{ "chi", "posizione" }` · assente | `chi` = `giocatore` o `buddy`. `posizione`: Tris = casella 0–8 (da sinistra a destra, dall'alto in basso); Forza 4 = colonna 0–6 (da sinistra) |
| `esito` | `vinto` · `perso` · `pari` · assente | risultato della manche **dal punto di vista di chi gioca col telefono** (`vinto` = ha vinto la persona, quindi il buddy ha perso) |
| `reazione` | `pensa` · `tocca_a_te` · `esulta` · `broncio` · `pareggio` · `dado` · `nessuna` | cosa deve mostrare il buddy adesso |
| `manche` | numero da 1 | quale partita della serie ("Nuova partita" la aumenta di 1, con lo stesso `id`) |
| `passo` | numero | aumenta a **ogni** scrittura: se cambia, c'è qualcosa di nuovo (anche se la `reazione` è la stessa di prima) |
| `difficolta` | `facile` · `difficile` · assente | solo per i giochi con livelli. Il buddy può usarla per scegliere quanto "vantarsi" |
| `dado` | `{ "valore": 1–6, "lancio": n }` · assente | solo nel Dado: risultato e numero del lancio (cambia anche se esce lo stesso numero) |
| `aggiornato` | millisecondi (ora del server) | ultima scrittura dell'app |

I campi "assenti" non sono scritti (Firebase non salva i `null`): il buddy deve trattare un campo mancante come "niente".

Le reazioni:
- `pensa` → il buddy "riflette" (è il suo turno: l'app sceglie la mossa dopo circa 1–1,5 secondi);
- `tocca_a_te` → invita la persona a giocare;
- `esulta` → il buddy ha vinto · `broncio` → il buddy ha perso · `pareggio` → pari;
- `dado` → animazione del dado, poi mostra `dado.valore`. L'app mostra il risultato dopo circa 1,4 secondi:
  un'animazione del buddy di 1–1,5 secondi resta in sincronia;
- `nessuna` → niente di particolare (è quella usata con `stato: finita`).

### `partitaStato` (scritto dal buddy)

```json
{ "id": "pm3x8k2ab12", "pronto": true, "aggiornato": { ".sv": "timestamp" } }
```

| Campo | Valori | Significato |
|---|---|---|
| `id` | testo | l'`id` della partita a cui risponde (ricopiato da `partita.id`) |
| `pronto` | vero/falso | `true` = sono in modalità partita · `false` = sono uscito |
| `aggiornato` | millisecondi | quando ha scritto |

### Come si svolge

1. Tocchi un gioco nell'app → l'app scrive `partita` con un `id` nuovo e `stato: "attesa"`
   e mostra: *"Sto chiamando <nome>… se va a batteria, toccalo per svegliarlo"*, con il pulsante **Gioca senza buddy**.
2. Il buddy vede `stato: "attesa"` con un `id` nuovo → entra in modalità partita →
   scrive `partitaStato` `{ id, pronto: true }`.
3. L'app controlla `partitaStato` ogni 1,5 secondi: quando trova lo stesso `id` con `pronto: true`, si comincia (`stato: "in_corso"`).
4. Durante il gioco l'app scrive `partita` a ogni mossa; il buddy mostra la `reazione` ogni volta che `passo` cambia.
5. La partita finisce (`stato: "finita"`, `reazione: "nessuna"`) quando:
   - si esce dal gioco (‹ Giochi o un'altra voce del menu);
   - l'app viene chiusa o messa da parte;
   - passano **2 minuti senza mosse**.
   Il buddy torna normale e scrive `partitaStato` `{ id, pronto: false }`.
6. **Gioca senza buddy**: l'app scrive subito `stato: "finita"` (così un buddy che si sveglia dopo non entra in partita)
   e poi non scrive più niente fino alla fine di quel gioco.

**Per il codice del buddy**
- Quando non gioca, leggere `GET <base>/partita/stato.json` ogni pochi secondi (es. 3–5) basta e costa poco;
  in modalità partita leggere `partita` ogni ~0,5–1 secondo. Per risparmiare batteria si può usare lo streaming
  di Firebase (`Accept: text/event-stream`), ma non è obbligatorio.
- Entrare in partita solo se `stato` è `attesa` o `in_corso` **e** `aggiornato` è di meno di 2 minuti fa:
  così una partita vecchia rimasta nel database non lo "blocca".
- **Sicurezza:** se in modalità partita `aggiornato` diventa più vecchio di 2 minuti e mezzo (per esempio il telefono
  si è spento senza poter scrivere "finita"), il buddy esce da solo dalla partita.
- Se la funzione `funzioni.giochi` è `false`, il buddy ignora le partite.
