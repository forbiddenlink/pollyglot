// Service Worker for PollyGlot PWA
const CACHE_NAME = 'pollyglot-v2';
const urlsToCache = [
  '/',
  '/index.html',
  '/index.css',
  '/script.js',
  '/assets/parrot-192.png',
  '/assets/parrot-512.png',
  '/manifest.json',
  '/about',
  '/contact',
  '/privacy-policy'
];

// Install event - cache assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE_NAME);
      await Promise.all(
        urlsToCache.map(async (url) => {
          try {
            await cache.add(url);
          } catch (error) {
            console.warn('SW cache add failed for:', url, error);
          }
        })
      );
      await self.skipWaiting();
    })()
  );
});

// Fetch event - serve from cache when offline
self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request)
      .then((response) => {
        // Cache hit - return response
        if (response) {
          return response;
        }
        return fetch(event.request);
      }
    )
  );
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  const cacheWhitelist = [CACHE_NAME];
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheWhitelist.indexOf(cacheName) === -1) {
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});
