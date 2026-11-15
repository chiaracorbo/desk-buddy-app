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
  "versione": 1794776259675
}
```

| Campo | Tipo | Valori | Significato |
|---|---|---|---|
| `stile` | numero intero | 0–7 | 0 classici · 1 ovali · 2 tondi · 3 gatto · 4 assonnati · 5 diaframma · 6 cuore · 7 stella |
| `colore` | testo | `"#RRGGBB"` (sempre maiuscolo) | colore degli occhi |
| `sveglia.attiva` | vero/falso | `true` / `false` | sveglia accesa o spenta |
| `sveglia.ora` | numero intero | 0–23 | ora (formato 24 ore) |
| `sveglia.minuto` | numero intero | 0–59 | minuti |
| `sveglia.giorni` | lista di 7 vero/falso | posizione 0 = **lunedì** … 6 = **domenica** | giorni in cui suona. Tutti `false` = non suona mai |
| `promemoriaMinuti` | numero intero | 0–240 (l'app usa passi di 5) | ogni quanti minuti fare il promemoria. **0 = spento** |
| `citta` | testo | massimo 60 caratteri, può essere `""` | città del meteo. `""` = nessuna città |
| `versione` | numero intero | millisecondi dal 1/1/1970 | "numero di serie" della modifica: cambia ogni volta |

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
  "versione": 1794776259675,
  "ultimoContatto": { ".sv": "timestamp" }
}
```

- Stessi campi delle impostazioni, con i valori **effettivamente in uso**.
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
  - pallino verde accanto al nome se l'ultimo contatto è di meno di 3 minuti fa.
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

### Limiti che restano

- Il codice viaggia nell'indirizzo delle richieste (in HTTPS, quindi cifrato in rete), ma resta nei link che condividi:
  **non mandare il link di configurazione in chat di gruppo**.
- La protezione "vera" (account, Firebase Authentication) è più complessa da gestire sull'ESP32. Per un oggetto personale
  un codice lungo e casuale + queste regole è un compromesso ragionevole.
