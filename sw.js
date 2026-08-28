const CACHE_NAME = 'vehicle-monitor-v20260828_ultra_v7';

// Install: Pre-cache static shell & skip waiting immediately
self.addEventListener('install', (event) => {
  self.skipWaiting();
});

// Activate: Purge ALL old caches immediately & claim clients
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          console.log('[SW] Purging old cache version:', key);
          return caches.delete(key);
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch: Network-First strategy (always serve fresh updates immediately)
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Bypass cache completely for Firebase, APIs, or non-GET
  if (url.origin.includes('firebaseio.com') || url.origin.includes('firebasedatabase.app') || event.request.method !== 'GET') {
    return;
  }

  // Network-First: Always try network first to ensure mobile phones get live updates
  event.respondWith(
    fetch(event.request)
      .then((networkResponse) => {
        if (networkResponse && networkResponse.status === 200 && event.request.method === 'GET') {
          const responseToCache = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, responseToCache));
        }
        return networkResponse;
      })
      .catch(() => {
        // Fallback to cache ONLY if device is totally offline
        return caches.match(event.request);
      })
  );
});
