import AsyncStorage from '@react-native-async-storage/async-storage';

const QUEUE_KEY = 'offline_write_queue';

export type HttpMethod = 'POST' | 'PATCH';

export interface QueuedWrite {
  id: string;
  endpoint: string;
  method: HttpMethod;
  body: unknown;
  queuedAt: number;
  label: string;
}

function randomId(): string {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}

type QueueListener = () => void;
const listeners = new Set<QueueListener>();

function notify() {
  for (const l of listeners) l();
}

export const OfflineQueue = {
  subscribe(listener: QueueListener): () => void {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },

  async loadAll(): Promise<QueuedWrite[]> {
    try {
      const raw = await AsyncStorage.getItem(QUEUE_KEY);
      return raw ? (JSON.parse(raw) as QueuedWrite[]) : [];
    } catch {
      return [];
    }
  },

  async enqueue(item: Omit<QueuedWrite, 'id' | 'queuedAt'>): Promise<void> {
    const queue = await OfflineQueue.loadAll();
    queue.push({ ...item, id: randomId(), queuedAt: Date.now() });
    await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
    notify();
  },

  async remove(id: string): Promise<void> {
    const queue = await OfflineQueue.loadAll();
    const updated = queue.filter((item) => item.id !== id);
    await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(updated));
    notify();
  },

  async clearAll(): Promise<void> {
    await AsyncStorage.removeItem(QUEUE_KEY);
    notify();
  },

  async count(): Promise<number> {
    const queue = await OfflineQueue.loadAll();
    return queue.length;
  },
};

