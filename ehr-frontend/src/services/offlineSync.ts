const DB_NAME = 'MediCoreOffline';
const DB_VERSION = 2;

const STORES = [
  'vitals',
  'appointments',
  'hivClinicalVisits',
  'hivCounsellingSessions',
  'gbvAssessments',
  'disclosureRecords',
  'alhivTransitionAssessments',
  'counsellorSessions',
  'pendingMutations',
] as const;

type StoreName = typeof STORES[number];

const ENTITY_TO_STORE: Record<string, StoreName> = {
  vitals: 'vitals',
  appointments: 'appointments',
  hiv_clinical_visits: 'hivClinicalVisits',
  hiv_counselling_sessions: 'hivCounsellingSessions',
  gbv_assessments: 'gbvAssessments',
  hiv_disclosure_records: 'disclosureRecords',
  alhiv_transition_assessments: 'alhivTransitionAssessments',
  counsellor_sessions: 'counsellorSessions',
};

let _db: IDBDatabase | null = null;

function openDb(): Promise<IDBDatabase> {
  if (_db) return Promise.resolve(_db);
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = (e) => {
      const db = (e.target as IDBOpenDBRequest).result;
      for (const name of STORES) {
        if (!db.objectStoreNames.contains(name)) {
          if (name === 'pendingMutations') {
            db.createObjectStore(name, { autoIncrement: true, keyPath: 'localId' });
          } else {
            db.createObjectStore(name, { keyPath: 'id' });
          }
        }
      }
    };
    req.onsuccess = (e) => {
      _db = (e.target as IDBOpenDBRequest).result;
      resolve(_db);
    };
    req.onerror = () => reject(req.error);
  });
}

function idbPut(db: IDBDatabase, storeName: StoreName, record: unknown): Promise<void> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readwrite');
    const req = tx.objectStore(storeName).put(record);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

function idbGetAll(db: IDBDatabase, storeName: StoreName): Promise<any[]> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readonly');
    const req = tx.objectStore(storeName).getAll();
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function idbDelete(db: IDBDatabase, storeName: StoreName, key: IDBValidKey): Promise<void> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readwrite');
    const req = tx.objectStore(storeName).delete(key);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

export async function offlineWrite(
  entityType: string,
  record: Record<string, unknown>,
): Promise<void> {
  const storeName = ENTITY_TO_STORE[entityType];
  if (!storeName) throw new Error(`Unknown offline entity: ${entityType}`);

  const db = await openDb();
  await idbPut(db, storeName, { ...record, _offlinePendingSync: true });
  await idbPut(db, 'pendingMutations', {
    entityType,
    entityId: record['id'],
    payload: record,
    timestamp: new Date().toISOString(),
    status: 'pending',
  });
}

export async function getPendingMutations(): Promise<any[]> {
  const db = await openDb();
  const all = await idbGetAll(db, 'pendingMutations');
  return all.filter((m) => m.status === 'pending');
}

export async function syncPendingMutations(apiBase: string, token: string): Promise<void> {
  const db = await openDb();
  const pending = await idbGetAll(db, 'pendingMutations');

  for (const mutation of pending) {
    if (mutation.status !== 'pending') continue;
    try {
      const res = await fetch(`${apiBase}/sync/${mutation.entityType}/${mutation.entityId}`, {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ payload: mutation.payload, clientUpdatedAt: mutation.timestamp }),
      });

      if (res.ok) {
        await idbDelete(db, 'pendingMutations', mutation.localId);
      } else if (res.status === 409) {
        const conflict = await res.json();
        const storeName = ENTITY_TO_STORE[mutation.entityType];
        if (storeName && conflict.merged) {
          await idbPut(db, storeName, conflict.merged);
        }
        await idbDelete(db, 'pendingMutations', mutation.localId);
      }
    } catch {
      // leave as pending — retry on next sync
    }
  }
}

export async function clearSyncedMutations(): Promise<void> {
  const db = await openDb();
  const all = await idbGetAll(db, 'pendingMutations');
  for (const m of all) {
    if (m.status !== 'pending') {
      await idbDelete(db, 'pendingMutations', m.localId);
    }
  }
}
