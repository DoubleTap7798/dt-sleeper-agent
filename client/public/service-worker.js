// DT Sleeper Agent Service Worker
const CACHE_NAME = 'dt-sleeper-v1';
const STATIC_ASSETS = [
  '/',
  '/manifest.json',
  '/icon-192.png',
  '/icon-512.png',
  '/favicon.png'
];

// Install event - cache static assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS);
    })
  );
  self.skipWaiting();
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name !== CACHE_NAME)
          .map((name) => caches.delete(name))
      );
    })
  );
  self.clients.claim();
});

// Fetch event - network first with SPA navigation fallback
self.addEventListener('fetch', (event) => {
  const request = event.request;
  
  // Skip non-GET requests
  if (request.method !== 'GET') return;
  
  // Skip API requests - always fetch from network
  if (request.url.includes('/api/')) return;
  
  // Handle navigation requests (SPA routes) - serve index.html
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .catch(() => {
          return caches.match('/');
        })
    );
    return;
  }
  
  // For other requests - network first, fallback to cache
  event.respondWith(
    fetch(request)
      .then((response) => {
        // Don't cache non-success responses
        if (!response || response.status !== 200) {
          return response;
        }
        
        // Clone the response before caching
        const responseClone = response.clone();
        caches.open(CACHE_NAME).then((cache) => {
          cache.put(request, responseClone);
        });
        return response;
      })
      .catch(() => {
        // Fallback to cache if network fails
        return caches.match(request).then((cachedResponse) => {
          // For navigation requests that weren't caught above, return index
          if (!cachedResponse && request.destination === 'document') {
            return caches.match('/');
          }
          return cachedResponse;
        });
      })
  );
});
