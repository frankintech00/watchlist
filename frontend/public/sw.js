// Minimal service worker — satisfies PWA installability requirements.
// No complex caching: all requests pass straight through to the network.
// Watchlist runs on a local network so offline support is not needed.

const CACHE_NAME = 'watchlist-v1'

self.addEventListener('install', (event) => {
  // Activate immediately without waiting for existing clients to close
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  // Take control of all open clients immediately
  event.waitUntil(clients.claim())
})

self.addEventListener('fetch', (event) => {
  // Pass every request straight to the network
  event.respondWith(fetch(event.request))
})
