// S287 — Clinician Network platform bundle: default-panel seed regression spec.
// Uses a recording mock DB (no live Postgres); the live apply + click-through
// are covered manually in the PR description.
import { DatabaseProvisioningService } from './database-provisioning.service';

const EXPECTED_PANELS = [
  'General Practice',
  'Internal Medicine',
  'Paediatrics',
  'Obstetrics & Gynaecology',
  'General Surgery',
  'Dermatology',
];

describe('clinician_network_platform bundle (S287 seed)', () => {
  it('seeds the six default open panels idempotently', async () => {
    const service = new DatabaseProvisioningService({} as any);
    const bundles = (service as any).getProvisioningBundles();
    const platform = bundles.find((b: any) => b.id === 'clinician_network_platform');
    expect(platform).toBeDefined();
    expect(platform.version).toBe('2026.11.14.1');
    expect(platform.tasks?.length).toBeGreaterThan(0);

    const statements: string[] = platform.statements();
    expect(statements.join('\n')).toContain('uq_cn_panels_name');

    const queries: Array<{ sql: string; params: any[] }> = [];
    const mockDb = { query: jest.fn(async (sql: string, params: any[]) => {
      queries.push({ sql, params: params ?? [] });
      return [];
    }) };
    for (const task of platform.tasks) {
      await task(mockDb);
    }

    expect(queries).toHaveLength(EXPECTED_PANELS.length);
    const names = queries.map((q) => q.params[0]);
    expect(names).toEqual(EXPECTED_PANELS);
    for (const q of queries) {
      expect(q.sql).toContain("ON CONFLICT (name) DO NOTHING");
      expect(q.sql).toContain("'open'");
      expect(q.params[2]).toEqual(expect.any(String));
    }
  });
});
