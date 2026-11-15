// Configurazione dell'app Desk Buddy.
// L'indirizzo del database NON è segreto: può stare qui.
// Il codice segreto del buddy invece NON va mai scritto in questo file
// (né in nessun altro file del repository): l'app lo chiede e lo salva sul telefono.
window.DESKBUDDY_CONFIG = {
  databaseURL: "https://deskbuddy-50b8e-default-rtdb.europe-west1.firebasedatabase.app",

  // Ogni quanti secondi l'app controlla lo stato del buddy
  controlloSecondi: 15,
  // ...e quanto spesso quando c'è una modifica "In attesa del buddy"
  controlloInAttesaSecondi: 4,

  // Se il buddy si è fatto sentire negli ultimi N minuti, l'app lo mostra come "acceso"
  accesoEntroMinuti: 3
};
