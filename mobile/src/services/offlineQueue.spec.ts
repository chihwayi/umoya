const mockMemory = new Map<string, string>();

jest.mock('@react-native-async-storage/async-storage', () => ({
  __esModule: true,
  default: {
    getItem: jest.fn(async (key: string) => mockMemory.get(key) ?? null),
    setItem: jest.fn(async (key: string, value: string) => {
      mockMemory.set(key, value);
    }),
    removeItem: jest.fn(async (key: string) => {
      mockMemory.delete(key);
    }),
    getAllKeys: jest.fn(async () => Array.from(mockMemory.keys())),
    multiRemove: jest.fn(async (keys: string[]) => {
      keys.forEach((key) => mockMemory.delete(key));
    }),
  },
}));

import { OfflineQueue } from './offlineQueue';

describe('OfflineQueue (S225 load-shedding hardening)', () => {
  beforeEach(async () => {
    mockMemory.clear();
  });

  const baseItem = {
    endpoint: '/vitals',
    method: 'POST' as const,
    body: { heartRate: 88 },
    label: 'Vitals for Kaylee',
  };

  it('assigns a stable clientOpId and retry metadata on enqueue', async () => {
    await OfflineQueue.enqueue(baseItem);
    const [item] = await OfflineQueue.loadAll();

    expect(item.clientOpId).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    expect(item.attempts).toBe(0);
    expect(item.nextAttemptAt).toBe(0);
  });

  it('serializes concurrent enqueues — no write is lost to the read-modify-write race', async () => {
    await Promise.all(
      Array.from({ length: 20 }, (_, i) =>
        OfflineQueue.enqueue({ ...baseItem, label: `write-${i}` }),
      ),
    );
    expect(await OfflineQueue.count()).toBe(20);
  });

  it('markAttempt applies exponential backoff and loadDue skips backed-off items', async () => {
    await OfflineQueue.enqueue(baseItem);
    const [item] = await OfflineQueue.loadAll();
    const now = 1_000_000;

    await OfflineQueue.markAttempt(item.id, 'HTTP 422', now);
    let [updated] = await OfflineQueue.loadAll();
    expect(updated.attempts).toBe(1);
    expect(updated.lastError).toBe('HTTP 422');
    expect(updated.nextAttemptAt).toBe(now + 30_000); // first backoff: 30s

    await OfflineQueue.markAttempt(item.id, undefined, now);
    [updated] = await OfflineQueue.loadAll();
    expect(updated.attempts).toBe(2);
    expect(updated.nextAttemptAt).toBe(now + 60_000); // doubles

    // Still due-listed once the window elapses; never dropped.
    expect(await OfflineQueue.loadDue(now)).toHaveLength(0);
    expect(await OfflineQueue.loadDue(now + 61_000)).toHaveLength(1);
    expect(await OfflineQueue.count()).toBe(1);
  });

  it('backoff is capped at 30 minutes no matter how many attempts', async () => {
    await OfflineQueue.enqueue(baseItem);
    const [item] = await OfflineQueue.loadAll();
    const now = 5_000_000;
    for (let i = 0; i < 20; i += 1) {
      await OfflineQueue.markAttempt(item.id, 'still failing', now);
    }
    const [updated] = await OfflineQueue.loadAll();
    expect(updated.nextAttemptAt - now).toBeLessThanOrEqual(30 * 60 * 1000);
  });

  it('upgrades pre-S225 queue items missing idempotency/retry fields', async () => {
    mockMemory.set(
      'offline_write_queue',
      JSON.stringify([{ id: 'legacy1', endpoint: '/vitals', method: 'POST', body: {}, queuedAt: 1, label: 'old' }]),
    );
    const [item] = await OfflineQueue.loadAll();
    expect(item.clientOpId).toBeTruthy();
    expect(item.attempts).toBe(0);
    expect(item.nextAttemptAt).toBe(0);
  });
});
