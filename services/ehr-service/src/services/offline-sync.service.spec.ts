import { OfflineSyncService } from './offline-sync.service';

/**
 * S223 — offline / load-shedding resilience.
 *
 * Models the failure modes of intermittent power and connectivity: replayed
 * batches after a lost response, partial batch failures, hostile payload keys,
 * and concurrent edits resolved through the conflict resolver — and asserts
 * the sync queue stays durable (every op leaves a log row) and idempotent
 * (nothing is applied twice).
 */
describe('OfflineSyncService (load-shedding resilience)', () => {
  const makeDs = (options?: {
    existingSyncedLog?: any;
    serverRow?: any;
  }) => {
    const savedLogs: any[] = [];
    const queries: Array<{ sql: string; params: any[] }> = [];
    const repository = {
      findOne: jest.fn(async () => options?.existingSyncedLog ?? null),
      create: jest.fn((entry: any) => entry),
      save: jest.fn(async (entry: any) => {
        savedLogs.push(entry);
        return entry;
      }),
      find: jest.fn(async () => []),
    };
    const ds = {
      query: jest.fn(async (sql: string, params: any[] = []) => {
        queries.push({ sql, params });
        if (/^SELECT \* FROM \w+ WHERE id =/.test(sql)) {
          return options?.serverRow ? [options.serverRow] : [];
        }
        if (/INSERT INTO/.test(sql) && /RETURNING id/.test(sql)) {
          return [{ id: 'new-row-1' }];
        }
        return [];
      }),
      getRepository: jest.fn(() => repository),
    };
    return { ds, repository, savedLogs, queries };
  };

  const makeService = (ds: any, conflictResolver?: any) => {
    const tenantService = { getTenantDatabase: jest.fn(async () => ds) };
    return new OfflineSyncService(tenantService as any, conflictResolver);
  };

  const createOp = (overrides: Partial<any> = {}) => ({
    clientId: 'device-1',
    operationType: 'create' as const,
    entityType: 'vitals',
    payload: { patient_id: 'p-1', heart_rate: 88 },
    clientTimestamp: '2026-06-10T08:00:00.000Z',
    ...overrides,
  });

  it('applies a create and writes a durable sync-log row', async () => {
    const { ds, savedLogs } = makeDs();
    const service = makeService(ds);

    const result = await service.processBatch('clinic-a', [createOp()]);

    expect(result.results[0]).toMatchObject({ status: 'synced', id: 'new-row-1' });
    expect(savedLogs).toHaveLength(1);
    expect(savedLogs[0]).toMatchObject({ syncStatus: 'synced', entityType: 'vitals' });
  });

  it('replays of an already-synced op are idempotent — not applied or re-logged', async () => {
    const { ds, savedLogs, queries } = makeDs({
      existingSyncedLog: { entityId: 'row-9', syncStatus: 'synced' },
    });
    const service = makeService(ds);

    // Device resent the same batch after losing the response to load shedding.
    const result = await service.processBatch('clinic-a', [createOp()]);

    expect(result.results[0]).toMatchObject({ status: 'already_synced', id: 'row-9' });
    expect(queries.filter((q) => /INSERT INTO vitals/.test(q.sql))).toHaveLength(0);
    expect(savedLogs).toHaveLength(0);
  });

  it('rejects hostile payload field names but still logs the failure', async () => {
    const { ds, savedLogs, queries } = makeDs();
    const service = makeService(ds);

    const result = await service.processBatch('clinic-a', [
      createOp({ payload: { 'heart_rate, status) VALUES (1,1); DROP TABLE vitals;--': 1 } }),
    ]);

    expect(result.results[0].status).toBe('failed');
    expect(result.results[0].error).toMatch(/Invalid field name/);
    expect(queries.filter((q) => /INSERT INTO vitals/.test(q.sql))).toHaveLength(0);
    expect(savedLogs[0]).toMatchObject({ syncStatus: 'failed' });
  });

  it('keeps processing the rest of the batch when one op fails (partial-batch durability)', async () => {
    const { ds, savedLogs } = makeDs();
    const service = makeService(ds);

    const result = await service.processBatch('clinic-a', [
      createOp({ entityType: 'unknown_thing', clientTimestamp: '2026-06-10T08:00:00.000Z' }),
      createOp({ clientTimestamp: '2026-06-10T08:01:00.000Z' }),
    ]);

    expect(result.processed).toBe(2);
    expect(result.results[0].status).toBe('failed');
    expect(result.results[1].status).toBe('synced');
    expect(savedLogs).toHaveLength(2);
  });

  it('applies a plain update when the server row is older than the client edit', async () => {
    const { ds, queries } = makeDs({
      serverRow: { id: 'v-1', updated_at: '2026-06-10T07:00:00.000Z', patient_id: 'p-1' },
    });
    const service = makeService(ds, { resolveConflict: jest.fn() });

    const result = await service.processBatch('clinic-a', [
      createOp({
        operationType: 'update',
        entityId: 'v-1',
        payload: { heart_rate: 91 },
        clientTimestamp: '2026-06-10T08:00:00.000Z',
      }),
    ]);

    expect(result.results[0]).toMatchObject({ status: 'synced', id: 'v-1' });
    expect(queries.some((q) => /UPDATE vitals SET heart_rate/.test(q.sql))).toBe(true);
  });

  it('routes a stale update through the conflict resolver and surfaces queued safety review', async () => {
    const { ds, savedLogs, queries } = makeDs({
      serverRow: { id: 'v-1', updated_at: '2026-06-10T09:00:00.000Z', patient_id: 'p-1' },
    });
    const conflictResolver = {
      resolveConflict: jest.fn(async () => ({
        resolution: 'queued_for_review',
        merged: null,
        queuedConflictIds: ['q-1'],
      })),
    };
    const service = makeService(ds, conflictResolver);

    const result = await service.processBatch('clinic-a', [
      createOp({
        operationType: 'update',
        entityId: 'v-1',
        payload: { heart_rate: 91 },
        clientTimestamp: '2026-06-10T08:00:00.000Z', // older than the server row
      }),
    ]);

    expect(conflictResolver.resolveConflict).toHaveBeenCalledWith(
      'vitals',
      'v-1',
      expect.objectContaining({ heart_rate: 91 }),
      expect.objectContaining({ id: 'v-1' }),
      ds,
      'p-1',
    );
    expect(result.results[0].status).toBe('conflict');
    expect(result.results[0].details).toMatchObject({
      resolution: 'queued_for_review',
      queuedConflictIds: ['q-1'],
    });
    // The blind overwrite must NOT have happened.
    expect(queries.some((q) => /UPDATE vitals SET heart_rate/.test(q.sql))).toBe(false);
    expect(savedLogs[0]).toMatchObject({ syncStatus: 'conflict' });
  });

  it('applies the merged result when the resolver merges a stale update', async () => {
    const { ds, queries } = makeDs({
      serverRow: { id: 'v-1', updated_at: '2026-06-10T09:00:00.000Z', patient_id: 'p-1' },
    });
    const conflictResolver = {
      resolveConflict: jest.fn(async () => ({
        resolution: 'merge',
        merged: { id: 'v-1', heart_rate: 95, updated_at: '2026-06-10T09:00:00.000Z' },
      })),
    };
    const service = makeService(ds, conflictResolver);

    const result = await service.processBatch('clinic-a', [
      createOp({
        operationType: 'update',
        entityId: 'v-1',
        payload: { heart_rate: 91 },
        clientTimestamp: '2026-06-10T08:00:00.000Z',
      }),
    ]);

    expect(result.results[0]).toMatchObject({ status: 'synced', id: 'v-1' });
    const mergeUpdate = queries.find((q) => /UPDATE vitals SET heart_rate/.test(q.sql));
    expect(mergeUpdate).toBeDefined();
    expect(mergeUpdate!.params[0]).toBe(95); // merged (server-resolved) value, not the blind client value
  });
});
