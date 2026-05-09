// SupTemiz Service Worker
// ИСПРАВЛЕНО: фильтрация URL с неподдерживаемыми схемами (chrome-extension, moz-extension и т.д.)
// которые нельзя класть в Cache API и которые вызывали TypeError на строке put()

const CACHE_NAME = "suptemiz-v2";

// Только эти схемы можно кэшировать
const CACHEABLE_SCHEMES = ["http:", "https:"];

function isCacheable(url) {
  try {
    const { protocol } = new URL(url);
    return CACHEABLE_SCHEMES.includes(protocol);
  } catch {
    return false;
  }
}

// Список ресурсов для предварительного кэширования
const PRECACHE_URLS = [
  "/suptemiz-v2/",
  "/suptemiz-v2/index.html",
  "/suptemiz-v2/admin.html",
  "/suptemiz-v2/assets/css/admin.css",
  "/suptemiz-v2/assets/js/app.js",
  "/suptemiz-v2/assets/js/admin.js",
  "/suptemiz-v2/assets/js/firebase-config.js",
  "/suptemiz-v2/assets/js/i18n.js",
];

// ─── Install ─────────────────────────────────────────────────────────────────
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      // Кэшируем только кэшируемые URL
      const cacheableUrls = PRECACHE_URLS.filter(isCacheable);
      return cache.addAll(cacheableUrls);
    })
  );
  self.skipWaiting();
});

// ─── Activate ─────────────────────────────────────────────────────────────────
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// ─── Fetch ────────────────────────────────────────────────────────────────────
self.addEventListener("fetch", (event) => {
  const { request } = event;

  // Пропускаем не-GET и некэшируемые схемы (chrome-extension:// и т.д.)
  if (request.method !== "GET" || !isCacheable(request.url)) return;

  // Пропускаем Firebase и внешние API — они должны всегда идти в сеть
  const url = new URL(request.url);
  const bypassHosts = [
    "firestore.googleapis.com",
    "firebase.googleapis.com",
    "www.gstatic.com",
    "api.telegram.org",
    "wa.me",
  ];
  if (bypassHosts.some((h) => url.hostname.includes(h))) return;

  // Стратегия: Network first, fallback to cache
  event.respondWith(
    fetch(request)
      .then((response) => {
        // Кэшируем только валидные ответы с кэшируемыми URL
        if (response && response.status === 200 && isCacheable(request.url)) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(request, clone).catch((err) => {
              // Молча игнорируем ошибки кэширования (например, opaque responses)
              console.warn("[SW] cache.put failed:", err.message);
            });
          });
        }
        return response;
      })
      .catch(() => caches.match(request))
  );
});
