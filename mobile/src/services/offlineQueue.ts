import AsyncStorage from '@react-native-async-storage/async-storage';

const QUEUE_KEY = 'offline_write_queue';

/** Backoff: 30s, 1m, 2m, 4m … capped at 30m. Items are never dropped. */
const BASE_BACKOFF_MS = 30 * 1000;
const MAX_BACKOFF_MS = 30 * 60 * 1000;

export type HttpMethod = 'POST' | 'PATCH';

export interface QueuedWrite {
  id: string;
  /** S225: stable idempotency key sent as X-Client-Op-Id on every replay. */
  clientOpId: string;
  endpoint: string;
  method: HttpMethod;
  body: unknown;
  queuedAt: number;
  label: string;
  /** S225 retry metadata — a failing item backs off instead of blocking the queue. */
  attempts: number;
  lastError?: string;
  nextAttemptAt: number;
}

function randomId(): string {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}

/** RFC4122-shaped v4 id without a crypto dependency — uniqueness, not secrecy. */
function uuidLike(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

type QueueListener = () => void;
const listeners = new Set<QueueListener>();

function notify() {
  for (const l of listeners) l();
}

// S225: serialize all read-modify-write mutations — concurrent enqueues from
// different screens previously raced on the single AsyncStorage key and could
// silently drop writes.
let mutationChain: Promise<unknown> = Promise.resolve();
function withQueueLock<T>(fn: () => Promise<T>): Promise<T> {
  const next = mutationChain.then(fn, fn);
  mutationChain = next.catch(() => undefined);
  return next;
}

function upgrade(item: any): QueuedWrite {
  // Items queued by the pre-S225 client lack the idempotency/retry fields.
  return {
    clientOpId: item.clientOpId ?? uuidLike(),
    attempts: item.attempts ?? 0,
    nextAttemptAt: item.nextAttemptAt ?? 0,
    ...item,
  };
}

async function readQueue(): Promise<QueuedWrite[]> {
  try {
    const raw = await AsyncStorage.getItem(QUEUE_KEY);
    return raw ? (JSON.parse(raw) as any[]).map(upgrade) : [];
  } catch {
    return [];
  }
}

async function writeQueue(queue: QueuedWrite[]): Promise<void> {
  await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
}

export const OfflineQueue = {
  subscribe(listener: QueueListener): () => void {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },

  async loadAll(): Promise<QueuedWrite[]> {
    return readQueue();
  },

  /** Items whose backoff window has elapsed (what a drain should attempt now). */
  async loadDue(now = Date.now()): Promise<QueuedWrite[]> {
    const queue = await readQueue();
    return queue.filter((item) => (item.nextAttemptAt ?? 0) <= now);
  },

  async enqueue(item: Omit<QueuedWrite, 'id' | 'queuedAt' | 'clientOpId' | 'attempts' | 'nextAttemptAt'>): Promise<void> {
    await withQueueLock(async () => {
      const queue = await readQueue();
      queue.push({
        ...item,
        id: randomId(),
        clientOpId: uuidLike(),
        queuedAt: Date.now(),
        attempts: 0,
        nextAttemptAt: 0,
      });
      await writeQueue(queue);
    });
    notify();
  },

  /** Record a failed replay: bump attempts and push the next attempt out. */
  async markAttempt(id: string, error?: string, now = Date.now()): Promise<void> {
    await withQueueLock(async () => {
      const queue = await readQueue();
      const item = queue.find((entry) => entry.id === id);
      if (!item) return;
      item.attempts = (item.attempts ?? 0) + 1;
      item.lastError = error ? String(error).slice(0, 300) : item.lastError;
      const backoff = Math.min(BASE_BACKOFF_MS * 2 ** Math.min(item.attempts - 1, 10), MAX_BACKOFF_MS);
      item.nextAttemptAt = now + backoff;
      await writeQueue(queue);
    });
    notify();
  },

  async remove(id: string): Promise<void> {
    await withQueueLock(async () => {
      const queue = await readQueue();
      await writeQueue(queue.filter((item) => item.id !== id));
    });
    notify();
  },

  async clearAll(): Promise<void> {
    await withQueueLock(async () => {
      await AsyncStorage.removeItem(QUEUE_KEY);
    });
    notify();
  },

  async count(): Promise<number> {
    const queue = await readQueue();
    return queue.length;
  },
};
