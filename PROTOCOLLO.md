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
  "promemoriaIntervallo": true,
  "promemoriaTesto": "Bevi un po' d'acqua",
  "acquaObiettivo": 8,
  "postiVolo": [
    { "id": "spiaggia", "nome": "Spiaggia", "lat": 42.76, "lon": 10.88 },
    { "id": "collina", "nome": "Collina", "lat": 42.81, "lon": 11.15 }
  ],
  "droni": [
    { "id": "avata360", "nome": "AVATA", "verde": 6, "giallo": 8 },
    { "id": "air3s", "nome": "AIR 3S", "verde": 7, "giallo": 9.5 }
  ],
  "promemoriaOrari": [
    { "id": "m3x9k2ab", "attivo": true, "ora": 8, "minuto": 15, "data": null,
      "giorni": [true, true, true, true, true, false, false], "testo": "Prendi la medicina" },
    { "id": "m3x9p7cd", "attivo": true, "ora": 17, "minuto": 30, "data": "2026-11-20",
      "giorni": [false, false, false, false, false, false, false], "testo": "Chiama la nonna" }
  ],
  "dateDallApp": true,
  "dateImportanti": [
    { "id": "m3xa1b2c", "nome": "Compleanno di Ale", "giorno": 3, "mese": 12, "anno": 0 },
    { "id": "m3xa9d8e", "nome": "Viaggio a Parigi", "giorno": 14, "mese": 2, "anno": 2027 }
  ],
  "citta": "Torino",
  "lat": 42.76,
  "lon": 11.11,
  "luogo": "Grosseto",
  "animazioneMeteo": 2,
  "funzioni": {
    "pomodoro": true,
    "promemoria": true,
    "meteo": true,
    "radar": true,
    "timer": true,
    "contoAllaRovescia": false,
    "respiro": true,
    "tiPenso": true,
    "giochi": true,
    "foto": true,
    "oraDoro": true,
    "sfida": false,
    "diario": true,
    "delusa": true,
    "acqua": true,
    "iss": true,
    "droni": true
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
| `promemoriaIntervallo` | vero/falso | `true` / `false` · se manca: `true` | promemoria **«bevi»** ogni tot minuti acceso o spento. Nell'app sta nella scheda **Acqua** |
| `acquaObiettivo` | numero intero | 1–20 · se manca: `8` | bicchieri d'acqua al giorno da raggiungere |
| `postiVolo` | lista di oggetti | da 0 a 6 · può mancare (= nessuno) | Meteo droni: i tuoi posti. Vedi "Meteo droni" sotto |
| `droni` | lista di oggetti | da 1 a 2 | Meteo droni: i tuoi droni con le soglie di vento |
| `promemoriaTesto` | testo | massimo 40 caratteri · solo caratteri semplici (vedi sotto) | messaggio del promemoria a intervalli. Se manca: `"Bevi un po' d'acqua"` |
| `promemoriaOrari` | lista di oggetti | da 0 a 10 elementi · può mancare (= nessuno) | promemoria a un orario: vedi "I promemoria a orario" sotto |
| `dateDallApp` | vero/falso | se manca: `false` | `true` = le date del conto alla rovescia le decide l'app (`dateImportanti`). Vedi "Le date importanti" sotto |
| `dateImportanti` | lista di oggetti | da 0 a 10 elementi · può mancare (= nessuna) | date del conto alla rovescia |
| `citta` | testo | massimo 60 caratteri, può essere `""` | città del meteo. `""` = nessuna città |
| `lat`, `lon` | numeri con 2 decimali | lat −90…90, lon −180…180 · possono mancare | posizione del telefono per il meteo, **arrotondata** (circa 1 km) |
| `luogo` | testo | massimo 80 caratteri · può mancare | nome del luogo da mostrare (es. `"Grosseto"`), trovato dalle coordinate |
| `animazioneMeteo` | numero intero | `0` · `1` · `2` | come si vede il meteo sugli occhi: 0 niente · 1 leggero (piccola icona in alto) · 2 completo (gocce, nuvole, occhiali da sole, sciarpa). Se manca: `1` |
| `funzioni` | oggetto di vero/falso | vedi tabella sotto | quali funzioni del buddy sono accese |
| `versione` | numero intero | millisecondi dal 1/1/1970 | "numero di serie" della modifica: cambia ogni volta |

### I promemoria a orario

Ogni elemento di `promemoriaOrari`:

| Campo | Tipo | Valori | Significato |
|---|---|---|---|
| `id` | testo | 1–16 lettere minuscole e cifre | identificativo, non cambia quando lo modifichi |
| `attivo` | vero/falso | | acceso o spento (interruttore nella riga) |
| `ora`, `minuto` | numeri interi | 0–23, 0–59 | quando suona |
| `data` | testo oppure `null` | `"AAAA-MM-GG"` | se c'è: suona **una volta sola** quel giorno. Se è `null` (o manca): si ripete nei `giorni` |
| `giorni` | lista di 7 vero/falso | posizione 0 = **lunedì** … 6 = **domenica** | usati solo se `data` è `null` |
| `testo` | testo | massimo 40 caratteri · solo caratteri semplici | l'etichetta da mostrare sul buddy |

Regole:

- Un promemoria a orario suona solo se `funzioni.promemoria` è `true` **e** il suo `attivo` è `true`.
- **Dalla tappa 16** il promemoria a intervalli è il promemoria **«bevi»** e nell'app sta nella scheda **Acqua**:
  suona se `promemoriaIntervallo` è `true`, `funzioni.acqua` non è `false` **e** `promemoriaMinuti` è almeno 5.
  `funzioni.promemoria` vale **solo** per i promemoria a orario.
- **Attenzione a `null` in Firebase**: Firebase non salva i valori `null`, quindi quando la data non c'è
  il buddy **non trova proprio** il campo `data`. Campo mancante = `null` = ripetizione nei giorni.
- Anche la lista, se è vuota, in Firebase **non c'è**: campo mancante = nessun promemoria a orario.
- Firebase può restituire la lista come oggetto con chiavi `"0"`, `"1"`… invece che come lista: vanno bene tutte e due.
- I promemoria "una volta sola" già passati restano nella lista (l'app li mostra in grigio come "Scaduto")
  finché non li elimini: il buddy deve semplicemente ignorarli. Il buddy **non** modifica le impostazioni.
- Data e ora sono quelle **locali** (l'ora di casa), non UTC.
- **Testi** (tutti i testi scritti dall'utente: `promemoriaTesto`, `testo`, i `nome` delle date, dei posti e dei droni):
  dalla tappa 16 l'app scrive i caratteri ASCII semplici (codici 32–126) **più** `à è é ì ò ù ç ñ °`, che il buddy sa disegnare.
  Le **emoji vengono tolte**; le altre lettere con segni (`È`, `á`, `ü`…) diventano la lettera semplice (`E`, `a`, `u`).
  Il testo è in UTF-8. Per sicurezza il buddy può comunque saltare i caratteri che non sa disegnare.
  (Le app vecchie scrivevano `e'` al posto di `è`: quei testi restano così finché non li riscrivi.)

### Le date importanti (conto alla rovescia)

Ogni elemento di `dateImportanti`:

| Campo | Tipo | Valori | Significato |
|---|---|---|---|
| `id` | testo | 1–16 lettere minuscole e cifre | identificativo, non cambia quando la modifichi |
| `nome` | testo | massimo 30 caratteri · solo caratteri semplici (stessa regola dei promemoria) | es. `"Compleanno di Ale"` |
| `giorno` | numero intero | 1–31 (valido per quel mese) | |
| `mese` | numero intero | 1–12 | 1 = gennaio |
| `anno` | numero intero | `0` oppure l'anno (es. `2027`) | `0` = **ogni anno**; un anno = **una volta sola** |

Regole:

- **Chi decide le date.** Il buddy ha delle date di partenza scritte nel suo codice.
  - Se `dateDallApp` **manca o è `false`**: il buddy usa le **sue** date di partenza e ignora `dateImportanti`.
  - Se `dateDallApp` è `true`: il buddy usa **solo** `dateImportanti`. Se la lista manca, vuol dire **nessuna data**
    (Firebase non salva le liste vuote, per questo serve `dateDallApp`: senza, "ho cancellato tutto" e "non ho mai mandato niente" sarebbero uguali).
- Il buddy scrive **sempre** in `stato.dateImportanti` le date che sta usando, anche quelle di partenza.
  L'app, finché non ha mai mandato date, mostra proprio quelle: alla prima modifica le copia, ci applica la modifica
  e da lì in poi manda `dateDallApp: true`. Così non si riparte da zero.
- Le date "una volta" già passate restano in lista (l'app le mostra come "Passata") finché non le elimini: il buddy le ignora.
- Il 29 febbraio "ogni anno": negli anni non bisestili vale il 28 febbraio.
- Il giorno conta a mezzanotte (ora locale): "oggi" = 0 giorni, "domani" = 1.
- Il conto alla rovescia funziona solo se `funzioni.contoAllaRovescia` è `true`.

### Acqua

- `acquaObiettivo`: quanti bicchieri al giorno (1–20, se manca `8`).
- Il conteggio dei bicchieri lo tiene il **buddy**: lo scrive nello stato come `acquaOggi` (numero intero, da 0 in su,
  si azzera a mezzanotte). L'app lo mostra come "5 di 8 oggi" con un bicchiere che si riempie.
- Interruttore della funzione: `funzioni.acqua` (il buddy lo legge dalla tappa 16.2; se manca è acceso).
- Il promemoria «bevi» usa `promemoriaIntervallo`, `promemoriaMinuti` e `promemoriaTesto` (vedi sopra).

### Stazione Spaziale (ISS)

- Interruttore: `funzioni.iss` (dalla tappa 16.2; se manca è acceso). Avvisa quando la Stazione Spaziale passa sopra casa.
- Usa la **posizione del meteo**: `lat`/`lon` se ci sono, altrimenti `citta` (stessa regola del meteo).

### Meteo droni

Interruttore: `funzioni.droni`. In alto nell'app c'è sempre l'avviso "Non sostituisce D-Flight e l'app del drone".

Ogni elemento di `postiVolo` (massimo 6, **in ordine**: è l'ordine delle pagine sul buddy):

| Campo | Tipo | Valori | Significato |
|---|---|---|---|
| `id` | testo | 1–16 lettere minuscole e cifre, unico | ricavato dal nome quando aggiungi il posto (es. `"spiaggia"`, `"grosseto2"`). Non cambia se lo rinomini |
| `nome` | testo | massimo 24 caratteri | il nome da mostrare |
| `lat`, `lon` | numeri con 2 decimali | lat −90…90, lon −180…180 | posizione arrotondata (circa 1 km) |

Ogni elemento di `droni` (da 1 a 2):

| Campo | Tipo | Valori | Significato |
|---|---|---|---|
| `id` | testo | 1–16 lettere minuscole e cifre, unico | es. `"avata360"` |
| `nome` | testo | massimo 8 caratteri | la scritta nel cerchio |
| `verde` | numero | 1–20 m/s, minore di `giallo` | fino a questo vento si vola |
| `giallo` | numero | 1–20 m/s, maggiore di `verde` | fino a questo vento è al limite; sopra non si vola |

Valori di partenza (anche per il pulsante **Ripristina**): `{ "avata360", "AVATA", 6, 8 }` e `{ "air3s", "AIR 3S", 7, 9.5 }`.

**Il semaforo** (stesse regole sul buddy e nel dettaglio ora per ora dell'app), con i dati orari di Open-Meteo
(`wind_speed_120m`, `wind_gusts_10m`, `precipitation_probability`, `precipitation`, `temperature_2m`, `visibility`,
`wind_speed_unit=ms`, `timezone=Europe/Rome`):

- vento di riferimento = il **più alto** tra `wind_speed_120m` e `wind_gusts_10m`;
- **ROSSO** se vento > `giallo`, oppure pioggia > 0,2 mm, oppure probabilità di pioggia ≥ 60%, oppure visibilità < 1000 m,
  oppure temperatura < −10 °C o > 40 °C;
- **GIALLO** se non è rosso e: vento > `verde`, oppure probabilità di pioggia tra 30% e 59%, oppure temperatura < 5 °C;
- **VERDE** altrimenti.
- Un valore che manca (es. `visibility` a `null`) non fa scattare la sua regola.

Esempio di richiesta: `https://api.open-meteo.com/v1/forecast?latitude=42.76&longitude=10.88&hourly=wind_speed_120m,wind_gusts_10m,precipitation_probability,precipitation,temperature_2m,visibility&wind_speed_unit=ms&timezone=Europe%2FRome&forecast_days=4`

Liste in Firebase: l'app e il buddy accettano `postiVolo` e `droni` sia come lista `[...]` sia come oggetto `{"0": …, "1": …}`.
Una lista vuota in Firebase **non c'è**: `postiVolo` mancante = nessun posto. `droni` c'è sempre (almeno uno).

### Il luogo del meteo

- **Se ci sono `lat` e `lon` validi** (tutti e due numeri, nei limiti), il buddy usa **quelli** per il meteo.
- **Altrimenti** usa `citta`, come prima.
- `luogo` serve solo da mostrare (sul buddy, se vuoi): non va usato per cercare il meteo.
- L'app scrive `lat`, `lon` e `luogo` quando premi **Usa la mia posizione**, e li **toglie** (non li scrive più)
  quando salvi una città o premi **Togli la posizione**.
- Con le coordinate si può chiedere il meteo direttamente, per esempio a Open-Meteo
  (gratuito, senza chiave): `https://api.open-meteo.com/v1/forecast?latitude=42.76&longitude=11.11&current=weather_code,temperature_2m`.
- Privacy: l'app arrotonda sempre a 2 decimali **prima** di salvare o mandare le coordinate a qualunque servizio.
  Il nome del luogo lo chiede a BigDataCloud (servizio gratuito senza chiave per le app nel browser) e, se non risponde,
  a Nominatim di OpenStreetMap.

### L'oggetto `funzioni`

Un interruttore acceso/spento per ogni funzione (`true` = accesa, `false` = spenta).

| Chiave | Funzione |
|---|---|
| `pomodoro` | Pomodoro |
| `promemoria` | Promemoria a orario (`promemoriaOrari`) |
| `meteo` | Meteo (la città è in `citta`) |
| `radar` | Radar aerei: mostra gli aerei che passano sopra casa |
| `timer` | Timer da cucina sul buddy |
| `contoAllaRovescia` | Conto alla rovescia (le date sono in `dateImportanti`) |
| `respiro` | Respiro |
| `tiPenso` | Ti penso |
| `giochi` | Giochi (nell'app ha una voce sua nel menu in basso) |
| `foto` | Fotografia: **interruttore generale** del gruppo |
| `oraDoro` | Fotografia → Ora d'oro e ora blu |
| `sfida` | Fotografia → Sfida del giorno |
| `diario` | Fotografia → Diario delle uscite |
| `delusa` | Fotografia → Faccia delusa dopo tanti giorni senza foto |
| `acqua` | Acqua: bicchieri e promemoria «bevi» (dalla tappa 16.2) |
| `iss` | Stazione Spaziale: avvisa quando passa sopra casa (dalla tappa 16.2) |
| `droni` | Meteo droni |

Nella pagina App le schede sono nello stesso ordine delle pagine del buddy: Meteo, Meteo droni, Conto alla rovescia, Acqua,
Timer, Fotografia, ISS, Radar, Giochi, poi Pomodoro, Promemoria, Sveglia, Respiro, Ti penso.

Regole:

- **La Sveglia non è dentro `funzioni`**: il suo interruttore è il già esistente `sveglia.attiva`.
- **Fotografia è un gruppo**: una sotto-funzione (`oraDoro`, `sfida`, `diario`, `delusa`) è attiva solo se
  sono `true` **sia** lei **sia** `foto`. Quando `foto` è `false` l'app conserva i valori delle sotto-funzioni
  (così riaccendendo `foto` tornano come prima), ma il buddy deve considerarle tutte spente.
- **Promemoria**: `funzioni.promemoria` vale per i promemoria a orario. Il promemoria a intervalli («bevi») suona solo se
  `funzioni.acqua` non è `false`, `promemoriaIntervallo` non è `false` **e** `promemoriaMinuti` è almeno 5. Per compatibilità con il vecchio protocollo, `promemoriaMinuti: 0` vuol dire
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
  "promemoriaIntervallo": true,
  "promemoriaTesto": "Bevi un po' d'acqua",
  "acquaObiettivo": 8,
  "acquaOggi": 5,
  "postiVolo": [ { "id": "spiaggia", "nome": "Spiaggia", "lat": 42.76, "lon": 10.88 } ],
  "droni": [ { "id": "avata360", "nome": "AVATA", "verde": 6, "giallo": 8 }, { "id": "air3s", "nome": "AIR 3S", "verde": 7, "giallo": 9.5 } ],
  "promemoriaOrari": [
    { "id": "m3x9k2ab", "attivo": true, "ora": 8, "minuto": 15, "giorni": [true, true, true, true, true, false, false], "testo": "Prendi la medicina" }
  ],
  "dateDallApp": true,
  "dateImportanti": [ { "id": "m3xa1b2c", "nome": "Compleanno di Ale", "giorno": 3, "mese": 12, "anno": 0 } ],
  "citta": "Torino",
  "lat": 42.76, "lon": 11.11, "luogo": "Grosseto", "animazioneMeteo": 2,
  "funzioni": { "pomodoro": true, "promemoria": true, "meteo": true, "radar": true, "timer": true, "contoAllaRovescia": false, "respiro": true, "tiPenso": true, "giochi": true, "foto": true, "oraDoro": true, "sfida": false, "diario": true, "delusa": true, "acqua": true, "iss": true, "droni": true },
  "versione": 1794776259675,
  "ultimoContatto": { ".sv": "timestamp" }
}
```

- Stessi campi delle impostazioni, con i valori **effettivamente in uso**.
- `lat`, `lon`, `luogo`, `animazioneMeteo`: quelli **realmente in uso**. Se il buddy sta usando la città
  (nessuna posizione), non scrive `lat`, `lon` e `luogo`.
- `promemoriaIntervallo`, `promemoriaTesto`, `promemoriaOrari`: l'interruttore, il messaggio e l'elenco dei promemoria a orario **realmente in uso**
  (se il buddy ne tiene meno di 10, scrive solo quelli che usa).
- `dateImportanti`: le date **realmente in uso**: quelle dell'app oppure, se `dateDallApp` non è `true`, le date di partenza
  del buddy (con un `id` qualsiasi di lettere minuscole e cifre, es. `"natale"`). `dateDallApp`: ricopiato dalle impostazioni.
- `acquaObiettivo`: l'obiettivo in uso. `acquaOggi`: i bicchieri bevuti oggi, contati dal buddy (solo nello stato).
- `postiVolo`, `droni`: quelli **realmente in uso**. `postiVolo` lo scrive **solo se c'è almeno un posto**
  (Firebase non salva le liste vuote); `droni` lo scrive **sempre**. Come le altre impostazioni, finché il buddy
  non li ha confermati l'app mostra "In attesa".
- `funzioni`: i valori **reali** del buddy, tutte e 17 le chiavi (anche quelle che ha ricevuto mancanti e ha considerato accese).
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
> **Importante (novembre 2026):** il file delle regole ora include anche `funzioni`, `partita`, `partitaStato`
> e i campi del meteo (`lat`, `lon`, `luogo`, `animazioneMeteo`), `radar`, `timer`, `dateDallApp`, `dateImportanti`, `promemoriaIntervallo`, `promemoriaTesto`, `promemoriaOrari` e, dalla tappa 16, `acqua`, `iss`, `droni`,
> `acquaObiettivo`, `acquaOggi`, `postiVolo` e `droni`. Se avevi già pubblicato
> la versione precedente delle regole, ripubblica quella nuova: la vecchia rifiuterebbe ogni scrittura con `funzioni`
> (per via di `$altro: false`) e l'app resterebbe su "Non inviato".

### Limiti che restano

- Il codice viaggia nell'indirizzo delle richieste (in HTTPS, quindi cifrato in rete), ma resta nei link che condividi:
  **non mandare il link di configurazione in chat di gruppo**.
- La protezione "vera" (account, Firebase Authentication) è più complessa da gestire sull'ESP32. Per un oggetto personale
  un codice lungo e casuale + queste regole è un compromesso ragionevole.

---

## 8. Giochi: `partita` e `partitaStato`

Giochi disponibili: **Tris**, **Forza 4**, **Dado**, **Dama** (italiana), **Battaglia navale**.

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
| `gioco` | `tris` · `forza4` · `dado` · `dama` · `battaglia` | il gioco. In futuro: `moneta`, `palla8`, `indovinaChi` |
| `stato` | `attesa` · `in_corso` · `finita` | `attesa` = l'app sta chiamando il buddy · `in_corso` = si gioca · `finita` = il buddy torna normale |
| `turno` | `giocatore` · `buddy` · assente | di chi è il turno. Assente nel Dado, mentre si dispongono le navi (Battaglia), a manche finita e a partita finita |
| `ultimaMossa` | oggetto · assente | vedi "L'ultima mossa" sotto |
| `esito` | `vinto` · `perso` · `pari` · assente | risultato della manche **dal punto di vista di chi gioca col telefono** (`vinto` = ha vinto la persona, quindi il buddy ha perso) |
| `reazione` | vedi elenco sotto | cosa deve mostrare il buddy adesso |
| `manche` | numero da 1 | quale partita della serie ("Nuova partita" la aumenta di 1, con lo stesso `id`) |
| `passo` | numero | aumenta a **ogni** scrittura: se cambia, c'è qualcosa di nuovo (anche se la `reazione` è la stessa di prima) |
| `difficolta` | `facile` · `difficile` · assente | solo per i giochi con livelli. Il buddy può usarla per scegliere quanto "vantarsi" |
| `dado` | `{ "valore": 1–6, "lancio": n }` · assente | solo nel Dado: risultato e numero del lancio (cambia anche se esce lo stesso numero) |
| `aggiornato` | millisecondi (ora del server) | ultima scrittura dell'app |

I campi "assenti" non sono scritti (Firebase non salva i `null`): il buddy deve trattare un campo mancante come "niente".

### L'ultima mossa

`ultimaMossa` ha sempre `chi` (`giocatore` o `buddy`) e `posizione`; alcuni giochi aggiungono altri campi.

| Gioco | Campi | Significato |
|---|---|---|
| Tris | `posizione` 0–8 | casella, da sinistra a destra e dall'alto in basso |
| Forza 4 | `posizione` 0–6 | colonna, da sinistra |
| Dama | `da` 0–63, `posizione` 0–63, `prese` 0–12 | casella di partenza e di arrivo (riga × 8 + colonna, riga 0 = in alto, dal lato del buddy) e quanti pezzi sono stati mangiati |
| Battaglia navale | `posizione` 0–99, `risultato` | casella colpita (riga × 10 + colonna, A1 = 0 in alto a sinistra) e `acqua` · `colpito` · `affondato` |

### Le reazioni

**In tutti i giochi**
- `pensa` → il buddy "riflette" (è il suo turno: l'app sceglie la mossa dopo circa 1–1,5 secondi);
- `tocca_a_te` → invita la persona a giocare;
- `esulta` → il buddy ha vinto · `broncio` → il buddy ha perso · `pareggio` → pari (a fine manche, con `esito`);
- `nessuna` → niente di particolare (è quella usata con `stato: finita` e mentre si dispongono le navi).

**Dado**
- `dado` → animazione del dado, poi mostra `dado.valore`. L'app mostra il risultato dopo circa 1,4 secondi:
  un'animazione del buddy di 1–1,5 secondi resta in sincronia.

**Dama**
- `mangiato` → la persona ha appena mangiato una o più pedine del buddy (dispiaciuto). Con `turno: buddy`.
- `sorrisetto` → il buddy ha appena mangiato. Con `turno: giocatore`.
- `dama` → il buddy ha appena fatto dama (entusiasmo). Vince su `sorrisetto` se succedono insieme.

**Battaglia navale**
- Quando la persona spara al buddy (`ultimaMossa.chi = giocatore`, poi `turno: buddy`):
  `colpito` (sorpreso, dolorante) · `affondato` (disperato) · `acqua` (sollevato, sorrisetto).
- Quando il buddy spara alla persona (`ultimaMossa.chi = buddy`, poi `turno: giocatore`):
  `esulta` se ha colpito o affondato · `broncio_leggero` se ha fatto acqua.
- Nota: `esulta` compare sia qui sia a fine partita. Per capire se ha vinto la partita, il buddy guarda `esito`
  (se è `perso`, cioè la persona ha perso, ha vinto lui).

Dopo una reazione speciale (`mangiato`, `colpito`…) non arrivano `pensa` o `tocca_a_te` separati: di chi è il turno lo dice `turno`.
Quando una mossa chiude la manche, la reazione è quella di fine partita (`esulta`, `broncio`, `pareggio`).

### Regole dei giochi (le applica il telefono)

- **Dama italiana**: 8×8, si gioca sulle caselle scure, 12 pedine a testa. Le pedine vanno avanti di un passo e
  mangiano solo in avanti; **la pedina non può mangiare la dama**. La dama va di un passo in ogni direzione.
  Presa obbligatoria, con le priorità: più pezzi → con la dama → più dame → la dama presa per prima.
  Prese multiple in sequenza; una pedina che arriva in fondo diventa dama e si ferma.
  Perde chi non può più muovere. Pari dopo 40 mosse a testa solo di dame, senza prese (regola dell'app).
- **Battaglia navale**: 10×10, flotta 5 · 4 · 3 · 3 · 2 (le navi non si sovrappongono, possono toccarsi).
  Un colpo a testa, a turno. Prima si dispongono le navi (`turno` assente, `reazione: nessuna`), poi si gioca.
  Le navi del buddy le dispone il telefono di nascosto.

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
