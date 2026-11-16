// Service worker: permette all'app di aprirsi anche senza rete
// e di essere installata sulla schermata Home.
// Quando cambi i file dell'app, aumenta questo numero:
const CACHE = "deskbuddy-v2";
const FILE = [
  "./", "./index.html", "./config.js", "./manifest.webmanifest",
  "./icons/icon.svg", "./icons/icon-192.png", "./icons/icon-512.png",
  "./icons/icon-maskable-512.png", "./icons/apple-touch-icon.png"
];

self.addEventListener("install", e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(FILE)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", e => {
  const url = new URL(e.request.url);
  // Le richieste al database (Firebase) non passano mai dalla cache.
  if (e.request.method !== "GET" || url.origin !== self.location.origin) return;
  // Prima la rete (così prendi sempre l'ultima versione), se manca la rete usa la copia salvata.
  e.respondWith(
    fetch(e.request)
      .then(r => {
        if (r.ok) { const copia = r.clone(); caches.open(CACHE).then(c => c.put(e.request, copia)); }
        return r;
      })
      .catch(() => caches.match(e.request, { ignoreSearch: true }).then(r => r || caches.match("./index.html")))
  );
});
