/* JOKER STORE APP V1 — offline notice only, never serve stale store data.
 * Static/logo is not aggressively cached; all normal pages and Supabase
 * queries always use the network. Shop/orders/admin remain live. */
'use strict';
const OFFLINE_CACHE = 'joker-pwa-offline-v1';
const OFFLINE_URL = new URL('./offline.html', self.registration.scope).href;
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(OFFLINE_CACHE).then(cache => cache.add(OFFLINE_URL))
      .then(() => self.skipWaiting())
  );
});
self.addEventListener('activate', event => {
  event.waitUntil(Promise.all([
    caches.keys().then(keys => Promise.all(keys.filter(key => key.startsWith('joker-pwa-offline-') && key !== OFFLINE_CACHE).map(key => caches.delete(key)))),
    self.clients.claim()
  ]));
});
self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET' || request.mode !== 'navigate') return;
  // Network first; keep all HTML, games, pricing, orders, auth online/fresh.
  event.respondWith(fetch(request).catch(() => caches.match(OFFLINE_URL)));
});
