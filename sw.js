const CACHE_NAME = "sup-cache-v1";
const BASE = "/suptemiz-v2/";

const ASSETS = [
  BASE,
  BASE + "index.html",
  BASE + "manifest.webmanifest",
  BASE + "assets/css/styles.css",
  BASE + "assets/js/app.js",
  BASE + "assets/js/i18n.js",
  BASE + "assets/js/firebase-config.js",
  BASE + "assets/lang/ru.json",
  BASE + "assets/lang/tr.json",
  BASE + "assets/lang/en.json",
  BASE + "assets/icons/icon-192.png",
  BASE + "assets/icons/icon-512.png"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS))
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;

  event.respondWith(
    caches.match(event.request).then((cached) => cached || fetch(event.request))
  );
});
