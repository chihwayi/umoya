/**
 * R1 / FX-003 (O-002) red→green: terminal vs transient sync failures.
 *
 * Audit evidence: a genuinely malformed payload (unknown entity, unsafe
 * identifiers, invalid data) gets status 'failed' and is retried forever,
 * blocking/hogging the queue; drift-500s (now fixed by FX-001/002) were
 * indistinguishable from real poison. After the fix:
 * - validation-class errors → status 'rejected' (terminal, never retried);
 * - transient errors (DB down, unknown) → status 'failed' (retry).
 * Red: everything non-conflict is 'failed'. Green: classification.
 */
import { OfflineSyncService } from './offline-sync.service';

function fakeDs(behavior: (sql: string) => any) {
  return {
    getRepository: () => ({
      findOne: async () => null,
      create: (x: any) => x,
      save: async (x: any) => x,
    }),
    async query(sql: string, _p: any[]) {
      return behavior(sql);
    },
  } as any;
}

describe('R1 FX-003 sync terminal classification (red→green)', () => {
  const svc = new OfflineSyncService({} as any);

  const op = (over: any = {}) => ({
    clientId: 'c1',
    operationType: 'create',
    entityType: 'vitals',
    payload: { patient_id: 'p1' },
    clientTimestamp: new Date().toISOString(),
    ...over,
  });

  it('rejects unknown entity types terminally', async () => {
    const ds = fakeDs(() => []);
    const res = await svc.processBatch(ds, [op({ entityType: 'nope' })]);
    expect(res.results[0].status).toBe('rejected');
  });

  it('rejects unsafe payload identifiers terminally', async () => {
    const ds = fakeDs(() => []);
    const res = await svc.processBatch(ds, [
      op({ payload: { 'x; DROP TABLE vitals; --': 1 } }),
    ]);
    expect(res.results[0].status).toBe('rejected');
  });

  it('keeps transient DB errors retryable', async () => {
    const ds = fakeDs(() => {
      throw new Error('connection terminated');
    });
    const res = await svc.processBatch(ds, [op()]);
    expect(res.results[0].status).toBe('failed');
  });

  it('still syncs valid ops', async () => {
    const ds = fakeDs(() => [{ id: 'v1' }]);
    const res = await svc.processBatch(ds, [op()]);
    expect(res.results[0].status).toBe('synced');
  });
});
