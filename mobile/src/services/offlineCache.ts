import AsyncStorage from '@react-native-async-storage/async-storage';

const PREFIX = 'offline_cache_';
const TTL_MS = 6 * 60 * 60 * 1000; // 6 hours — cover a full ward shift

export interface CacheEntry<T = unknown> {
  data: T;
  savedAt: number; // epoch ms
}

function cacheKey(url: string): string {
  return PREFIX + url;
}

export const OfflineCache = {
  async save(url: string, data: unknown): Promise<void> {
    try {
      const entry: CacheEntry = { data, savedAt: Date.now() };
      await AsyncStorage.setItem(cacheKey(url), JSON.stringify(entry));
    } catch {
      // AsyncStorage full — non-fatal, just don't cache
    }
  },

  async load<T = unknown>(url: string): Promise<CacheEntry<T> | null> {
    try {
      const raw = await AsyncStorage.getItem(cacheKey(url));
      if (!raw) return null;
      const entry = JSON.parse(raw) as CacheEntry<T>;
      if (Date.now() - entry.savedAt > TTL_MS) {
        await AsyncStorage.removeItem(cacheKey(url));
        return null;
      }
      return entry;
    } catch {
      return null;
    }
  },

  async clearAll(): Promise<void> {
    try {
      const keys = await AsyncStorage.getAllKeys();
      const toRemove = (keys as string[]).filter((k) => k.startsWith(PREFIX));
      if (toRemove.length > 0) await AsyncStorage.multiRemove(toRemove);
    } catch {
      // best effort
    }
  },
};
