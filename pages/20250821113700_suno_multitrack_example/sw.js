// Service Worker for Audio Caching
const CACHE_NAME = 'audio-cache-v1';
const AUDIO_CACHE_NAME = 'audio-files-v1';

// Install event - create caches
self.addEventListener('install', (event) => {
  console.log('Service Worker installing...');
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('Cache opened');
      return cache;
    })
  );
});

// Fetch event - handle audio file requests
self.addEventListener('fetch', (event) => {
  // Only handle audio file requests
  if (event.request.url.includes('.wav') || event.request.url.includes('.mp3')) {
    event.respondWith(
      caches.open(AUDIO_CACHE_NAME).then((cache) => {
        return cache.match(event.request).then((response) => {
          if (response) {
            console.log('Audio cache hit:', event.request.url);
            return response;
          }

          // Cache miss - fetch from network and cache
          return fetch(event.request).then((networkResponse) => {
            if (networkResponse.status === 200) {
              console.log('Caching audio file:', event.request.url);
              cache.put(event.request, networkResponse.clone());
            }
            return networkResponse;
          }).catch(() => {
            // Network failed - return cached version if available
            return cache.match(event.request);
          });
        });
      })
    );
  }
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  console.log('Service Worker activating...');
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME && cacheName !== AUDIO_CACHE_NAME) {
            console.log('Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
});
