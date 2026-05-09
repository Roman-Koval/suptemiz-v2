const CACHE_NAME = "sup-cache-v1";
const ASSETS = [
  "/",
  "/index.html",
  "/manifest.webmanifest",
  "/assets/css/styles.css",
  "/assets/js/app.js",
  "/assets/js/i18n.js",
  "/assets/lang/ru.json",
  "/assets/lang/tr.json",
  "/assets/lang/en.json",
  "/assets/icons/icon-192.png",
  "/assets/icons/icon-512.png"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS))
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key !== CACHE_NAME)
          .map((key) => caches.delete(key))
      )
    )
  );
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;

  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached;
      return fetch(event.request);
    })
  );
});
