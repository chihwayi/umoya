// Simple IndexedDB wrapper for offline queue
const DB_NAME = 'medicore_offline';
const STORE_NAME = 'offline_queue';

async function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = e => (e.target as IDBOpenDBRequest).result.createObjectStore(STORE_NAME, { keyPath: 'localEntityId' });
    req.onsuccess = e => resolve((e.target as IDBOpenDBRequest).result);
    req.onerror = e => reject((e.target as IDBOpenDBRequest).error);
  });
}

export async function queueOfflineOperation(item: {
  localEntityId: string;
  operationType: string;
  entityType: string;
  payload: object;
}): Promise<void> {
  const db = await openDB();
  const tx = db.transaction(STORE_NAME, 'readwrite');
  tx.objectStore(STORE_NAME).put({ ...item, createdOfflineAt: new Date().toISOString() });
}

export async function getQueuedCount(): Promise<number> {
  const db = await openDB();
  return new Promise(resolve => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const req = tx.objectStore(STORE_NAME).count();
    req.onsuccess = () => resolve(req.result);
  });
}

export async function triggerBackgroundSync(): Promise<void> {
  if ('serviceWorker' in navigator && 'SyncManager' in window) {
    const reg = await navigator.serviceWorker.ready;
    await (reg as any).sync.register('medicore-offline-sync');
  }
}
