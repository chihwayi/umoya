import { of, lastValueFrom } from 'rxjs';
import { IdempotencyInterceptor } from './idempotency.interceptor';

describe('IdempotencyInterceptor (S225 offline replay)', () => {
  const makeContext = (request: any) =>
    ({ switchToHttp: () => ({ getRequest: () => request }) }) as any;

  const makeNext = (body: any) => {
    const handle = jest.fn(() => of(body));
    return { handle } as any;
  };

  const makeDb = (existing?: any) => {
    const queries: Array<{ sql: string; params: any[] }> = [];
    return {
      queries,
      query: jest.fn(async (sql: string, params: any[] = []) => {
        queries.push({ sql, params });
        if (/SELECT response FROM idempotency_keys/.test(sql)) {
          return existing ? [existing] : [];
        }
        return [];
      }),
    };
  };

  it('passes through untouched when there is no X-Client-Op-Id header', async () => {
    const interceptor = new IdempotencyInterceptor();
    const db = makeDb();
    const next = makeNext({ ok: true });

    const result = await lastValueFrom(
      interceptor.intercept(makeContext({ method: 'POST', headers: {}, tenantDb: db }), next),
    );

    expect(result).toEqual({ ok: true });
    expect(db.query).not.toHaveBeenCalled();
  });

  it('executes the first attempt and stores the response under the op id', async () => {
    const interceptor = new IdempotencyInterceptor();
    const db = makeDb();
    const next = makeNext({ id: 'vital-1' });

    const result = await lastValueFrom(
      interceptor.intercept(
        makeContext({ method: 'POST', url: '/vitals', headers: { 'x-client-op-id': 'op-123' }, tenantDb: db }),
        next,
      ),
    );

    expect(result).toEqual({ id: 'vital-1' });
    expect(next.handle).toHaveBeenCalledTimes(1);
    const insert = db.queries.find((q) => /INSERT INTO idempotency_keys/.test(q.sql));
    expect(insert).toBeDefined();
    expect(insert!.params[0]).toBe('op-123');
    expect(insert!.params[3]).toBe(JSON.stringify({ id: 'vital-1' }));
  });

  it('replays the stored response without re-executing the handler', async () => {
    const interceptor = new IdempotencyInterceptor();
    const db = makeDb({ response: { id: 'vital-1', replayed: true } });
    const next = makeNext({ id: 'would-be-duplicate' });

    const result = await lastValueFrom(
      interceptor.intercept(
        makeContext({ method: 'POST', url: '/vitals', headers: { 'x-client-op-id': 'op-123' }, tenantDb: db }),
        next,
      ),
    );

    expect(result).toEqual({ id: 'vital-1', replayed: true });
    expect(next.handle).not.toHaveBeenCalled();
  });

  it('falls back to normal execution when the idempotency table is missing (old tenant)', async () => {
    const interceptor = new IdempotencyInterceptor();
    const db = {
      query: jest.fn(async () => {
        throw new Error('relation "idempotency_keys" does not exist');
      }),
    };
    const next = makeNext({ ok: true });

    const result = await lastValueFrom(
      interceptor.intercept(
        makeContext({ method: 'POST', url: '/vitals', headers: { 'x-client-op-id': 'op-1' }, tenantDb: db }),
        next,
      ),
    );

    expect(result).toEqual({ ok: true });
    expect(next.handle).toHaveBeenCalledTimes(1);
  });

  it('ignores GET requests even with the header present', async () => {
    const interceptor = new IdempotencyInterceptor();
    const db = makeDb();
    const next = makeNext({ list: [] });

    const result = await lastValueFrom(
      interceptor.intercept(
        makeContext({ method: 'GET', url: '/vitals', headers: { 'x-client-op-id': 'op-9' }, tenantDb: db }),
        next,
      ),
    );

    expect(result).toEqual({ list: [] });
    expect(db.query).not.toHaveBeenCalled();
  });
});
