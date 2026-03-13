import { MMKV } from 'react-native-mmkv';
import type { DehydratedState } from '@tanstack/react-query';

const QUERY_CACHE_KEY = 'query_cache_snapshot_v1';
const MAX_SNAPSHOT_BYTES = 1_200_000;
const memoryStore = new Map<string, string>();

type PersistedQueryCacheSnapshot = {
  savedAt: number;
  state: DehydratedState;
};

function createStorage() {
  try {
    return new MMKV({ id: 'medicore-mobile-cache' });
  } catch {
    return null;
  }
}

const storage = createStorage();

function getItem(key: string): string | undefined {
  if (storage) {
    return storage.getString(key);
  }
  return memoryStore.get(key);
}

function setItem(key: string, value: string): void {
  if (storage) {
    storage.set(key, value);
    return;
  }
  memoryStore.set(key, value);
}

function deleteItem(key: string): void {
  if (storage) {
    storage.delete(key);
    return;
  }
  memoryStore.delete(key);
}

export function loadPersistedQueryCache(): PersistedQueryCacheSnapshot | null {
  const raw = getItem(QUERY_CACHE_KEY);
  if (!raw) return null;

  try {
    return JSON.parse(raw) as PersistedQueryCacheSnapshot;
  } catch {
    deleteItem(QUERY_CACHE_KEY);
    return null;
  }
}

export function savePersistedQueryCache(snapshot: PersistedQueryCacheSnapshot): boolean {
  const raw = JSON.stringify(snapshot);
  if (raw.length > MAX_SNAPSHOT_BYTES) {
    return false;
  }

  setItem(QUERY_CACHE_KEY, raw);
  return true;
}

export function clearPersistedQueryCache(): void {
  deleteItem(QUERY_CACHE_KEY);
}
