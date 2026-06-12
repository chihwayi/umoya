/* Umoya offline app-shell service worker (S225).
 *
 * Strategy:
 *  - App shell (/, /index.html, manifest) precached at install.
 *  - Hashed build assets (/static/...) cache-first with background fill — after
 *    one online visit the SPA boots fully offline through load shedding.
 *  - Navigations network-first, falling back to the cached shell offline.
 *  - API calls network-first with a JSON { offline: true } fallback so the app
 *    layer (offlineQueue/offlineCache) can react instead of crashing.
 *
 * NOTE: the previous sw.js contained TypeScript syntax (`as any`) in a .js
 * file — a parse error — and was never registered, so web offline support was
 * effectively zero. This worker is plain JS and is registered in src/index.tsx.
 */
const CACHE_NAME = 'umoya-shell-v2';
const SHELL_URLS = ['/', '/index.html', '/manifest.json'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(SHELL_URLS)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

function isApiRequest(url) {
  return url.pathname.startsWith('/api/');
}

function isStaticAsset(url) {
  return (
    url.pathname.startsWith('/static/') ||
    /\.(js|css|png|jpg|jpeg|svg|ico|woff2?)$/.test(url.pathname)
  );
}

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return; // writes go through the app-level queue

  const url = new URL(request.url);

  if (isApiRequest(url)) {
    event.respondWith(
      fetch(request).catch(
        () =>
          new Response(JSON.stringify({ offline: true, cached: false }), {
            status: 503,
            headers: { 'Content-Type': 'application/json' },
          })
      )
    );
    return;
  }

  if (request.mode === 'navigate') {
    // Network-first navigation; offline falls back to the cached shell.
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put('/index.html', copy));
          return response;
        })
        .catch(() => caches.match('/index.html').then((cached) => cached || caches.match('/')))
    );
    return;
  }

  if (url.origin === self.location.origin && isStaticAsset(url)) {
    // Cache-first for hashed build assets: filenames change per build, so a
    // cached asset is always the correct version for the cached shell.
    event.respondWith(
      caches.match(request).then(
        (cached) =>
          cached ||
          fetch(request).then((response) => {
            if (response.ok) {
              const copy = response.clone();
              caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
            }
            return response;
          })
      )
    );
    return;
  }

  // Everything else: network with cache fallback.
  event.respondWith(fetch(request).catch(() => caches.match(request)));
});
