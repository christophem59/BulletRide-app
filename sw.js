// Incrémenter ce numéro à chaque changement du code de l'app force une
// invalidation propre de l'ancien cache (voir activate ci-dessous).
const CACHE_NAME = "bulletride-shell-v14";
const APP_SHELL = [
  "./",
  "./index.html",
  "./styles.css",
  "./app.js",
  "./manifest.json",
  "./icon-192.png?v=2",
  "./icon-512.png?v=2",
  "./favicon.png?v=2",
  "./moto.png?v=1",
  "./moto-ink.png?v=1",
  "./titre-ink.png?v=1",
  "./titre-cream.png?v=1",
];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL)));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))))
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;

  // Réseau d'abord : sert toujours la dernière version dès qu'il y a du
  // réseau, et met à jour le cache. Le cache ne sert qu'en secours (offline).
  event.respondWith(
    fetch(event.request)
      .then((resp) => {
        const copy = resp.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy)).catch(() => {});
        return resp;
      })
      .catch(() => caches.match(event.request).then((c) => c || caches.match("./index.html")))
  );
});
