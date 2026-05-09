const CACHE_NAME = "suptemiz-v2";

// Файлы для кэширования — только те, которые реально существуют
const PRECACHE_URLS = [
  "./",
  "./index.html",
  "./assets/css/styles.css",
  "./assets/js/i18n.js",
  "./assets/js/app.js",
  "./assets/js/firebase-config.js",
  "./assets/lang/ru.json",
  "./assets/lang/tr.json",
  "./assets/lang/en.json",
  "./manifest.webmanifest",
  "./icons/icon-192.png",
  "./icons/icon-512.png"
];

// Установка SW — кэшируем по одному, пропускаем отсутствующие файлы
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(async (cache) => {
      const results = await Promise.allSettled(
        PRECACHE_URLS.map((url) =>
          cache.add(url).catch((err) => {
            console.warn(`[SW] Не удалось закэшировать: ${url}`, err);
          })
        )
      );
      const failed = results.filter((r) => r.status === "rejected");
      if (failed.length) {
        console.warn(`[SW] ${failed.length} файлов не закэшировано`);
      }
    })
  );
  // Активируем сразу, не ждём закрытия старых вкладок
  self.skipWaiting();
});

// Активация — удаляем старые кэши
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key !== CACHE_NAME)
          .map((key) => {
            console.log(`[SW] Удаляем старый кэш: ${key}`);
            return caches.delete(key);
          })
      )
    ).then(() => self.clients.claim())
  );
});

// Fetch — стратегия: сначала сеть, fallback на кэш
self.addEventListener("fetch", (event) => {
  // Игнорируем не-GET запросы и запросы к Firebase/Telegram/внешним сервисам
  if (event.request.method !== "GET") return;

  const url = new URL(event.request.url);
  const isExternal =
    url.hostname.includes("firebase") ||
    url.hostname.includes("googleapis") ||
    url.hostname.includes("gstatic") ||
    url.hostname.includes("api.telegram.org");

  if (isExternal) return;

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        // Сохраняем успешный ответ в кэш
        if (response && response.status === 200 && response.type === "basic") {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
        }
        return response;
      })
      .catch(() => {
        // Офлайн — отдаём из кэша
        return caches.match(event.request).then((cached) => {
          if (cached) return cached;
          // Для навигационных запросов — fallback на index.html
          if (event.request.mode === "navigate") {
            return caches.match("./index.html");
          }
          return new Response("Нет подключения к сети", {
            status: 503,
            statusText: "Service Unavailable"
          });
        });
      })
  );
});
