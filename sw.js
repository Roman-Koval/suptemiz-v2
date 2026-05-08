const CACHE_NAME = "suptemiz-v2-cache-v1";

const OFFLINE_URLS = [
  "/suptemiz-v2/",
  "/suptemiz-v2/index.html",
  "/suptemiz-v2/admin.html",
  "/suptemiz-v2/assets/css/styles.css",
  "/suptemiz-v2/assets/js/app.js",
  "/suptemiz-v2/assets/js/admin.js",
  "/suptemiz-v2/assets/js/firebase-config.js",
  "/suptemiz-v2/manifest.webmanifest"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(OFFLINE_URLS))
  );
  self.skipWaiting();
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
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  event.respondWith(
    caches.match(request).then((cached) => {
      const networkFetch = fetch(request)
        .then((response) => {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
          return response;
        })
        .catch(() => cached || Promise.reject());

      return cached || networkFetch;
    })
  );
});
