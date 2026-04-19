const CACHE_NAME = 'medicore-lite-v1';
const OFFLINE_URLS = [
  '/',
  '/index.html',
  '/static/js/main.chunk.js',
  '/manifest.json',
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(OFFLINE_URLS))
  );
});

self.addEventListener('fetch', event => {
  // Network first for API calls; cache first for assets
  if (event.request.url.includes('/api/')) {
    event.respondWith(
      fetch(event.request).catch(() => {
        // Return cached response or offline indicator
        return new Response(JSON.stringify({ offline: true, cached: false }), {
          headers: { 'Content-Type': 'application/json' },
        });
      })
    );
  } else {
    event.respondWith(
      caches.match(event.request).then(cached => cached || fetch(event.request))
    );
  }
});

self.addEventListener('sync', event => {
  if (event.tag === 'medicore-offline-sync') {
    event.waitUntil(syncOfflineQueue());
  }
});

async function syncOfflineQueue() {
  // Simple check for pending items in IndexedDB
  // In a real implementation, we'd use a library like idb
  const db = await new Promise((resolve, reject) => {
    const req = indexedDB.open('medicore_offline', 1);
    req.onsuccess = e => resolve((e.target as any).result);
    req.onerror = e => reject((e.target as any).error);
  });

  const tx = (db as any).transaction('offline_queue', 'readonly');
  const store = tx.objectStore('offline_queue');
  const pendingItems = await new Promise<any[]>(resolve => {
    const req = store.getAll();
    req.onsuccess = () => resolve(req.result);
  });

  if (pendingItems.length === 0) return;

  try {
    const response = await fetch('/api/lite/sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ items: pendingItems }),
    });
    if (response.ok) {
      const rwTx = (db as any).transaction('offline_queue', 'readwrite');
      rwTx.objectStore('offline_queue').clear();
    }
  } catch (err) {
    console.error('Background sync failed', err);
  }
}
