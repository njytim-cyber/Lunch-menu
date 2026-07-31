const CACHE = 'weekly-meals-v3';
const ASSETS = [
  '/', '/index.html',
  '/styles/main.css', '/styles/tokens.css', '/styles/base.css',
  '/styles/layout.css', '/styles/components.css',
  '/data/dishes.json', '/icons/sprite.svg',
  '/js/main.js', '/favicon.svg',
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE)
      // addAll is atomic — one 404 would abort the whole install, so add
      // individually and tolerate misses.
      .then(c => Promise.allSettled(ASSETS.map(a => c.add(a))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// Network-first so a deploy is picked up promptly; cache is the offline fallback.
self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  if (new URL(e.request.url).origin !== self.location.origin) return;

  e.respondWith(
    fetch(e.request)
      .then(res => {
        const copy = res.clone();
        caches.open(CACHE).then(c => c.put(e.request, copy));
        return res;
      })
      .catch(() => caches.match(e.request).then(r => r ?? caches.match('/index.html')))
  );
});
