const CACHE_NAME = 'crewtime-v1';
const ASSETS_TO_CACHE = [
  './',
  './index.html',
  './style.css',
  './script.js',
  './assets/icons/logo.svg',
  './assets/fonts/inter.css',
  './assets/fontawesome/css/all.min.css',
  './assets/data/airports_tz.js',
  './assets/data/iata_icao.js',
  './assets/data/icao_info.js',
  './assets/fonts/Inter/inter-v20-cyrillic-400.woff2',
  './assets/fonts/Inter/inter-v20-cyrillic-500.woff2',
  './assets/fonts/Inter/inter-v20-cyrillic-600.woff2',
  './assets/fonts/Inter/inter-v20-cyrillic-700.woff2',
  './assets/fonts/Inter/inter-v20-cyrillic-ext-400.woff2',
  './assets/fonts/Inter/inter-v20-cyrillic-ext-500.woff2',
  './assets/fonts/Inter/inter-v20-cyrillic-ext-600.woff2',
  './assets/fonts/Inter/inter-v20-cyrillic-ext-700.woff2',
  './assets/fonts/Inter/inter-v20-latin-400.woff2',
  './assets/fonts/Inter/inter-v20-latin-500.woff2',
  './assets/fonts/Inter/inter-v20-latin-600.woff2',
  './assets/fonts/Inter/inter-v20-latin-700.woff2',
  './assets/fonts/Inter/inter-v20-latin-ext-400.woff2',
  './assets/fonts/Inter/inter-v20-latin-ext-500.woff2',
  './assets/fonts/Inter/inter-v20-latin-ext-600.woff2',
  './assets/fonts/Inter/inter-v20-latin-ext-700.woff2',
  './assets/fontawesome/webfonts/fa-brands-400.woff2',
  './assets/fontawesome/webfonts/fa-regular-400.woff2',
  './assets/fontawesome/webfonts/fa-solid-900.woff2',
  './assets/fontawesome/webfonts/fa-v4compatibility.woff2'
];

const API_URL = 'https://myapihelper.na4u.ru/';

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS_TO_CACHE);
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Не кешируем запросы к API
  if (url.origin === 'https://myapihelper.na4u.ru' || event.request.url.includes(API_URL)) {
    return;
  }

  event.respondWith(
    caches.match(event.request).then((response) => {
      return response || fetch(event.request).then((fetchResponse) => {
        // Опционально: можно кешировать новые ресурсы на лету, если нужно
        return fetchResponse;
      });
    })
  );
});
