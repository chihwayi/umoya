/**
 * R1 / FX-001 (Class D) red→green: provisioning health is queryable.
 *
 * R0 found bundle.apply.failed is fire-and-forget (logger.log only) and no
 * endpoint reports whether a tenant is fully versioned — tenants can sit
 * half-provisioned silently. getTenantSchemaHealth diffs the manifest against
 * tenant_schema_versions. Red: method absent. Green: pending detected.
 */
import { DatabaseProvisioningService } from './database-provisioning.service';

describe('R1 FX-001 provisioning health (red→green)', () => {
  const svc = new DatabaseProvisioningService({} as any);

  it('reports pending bundles for an unversioned tenant', async () => {
    const db: any = { async query() { return []; } };
    const health = await svc.getTenantSchemaHealth(db);
    expect(health.ok).toBe(false);
    expect(health.pendingCount).toBeGreaterThan(0);
    expect(health.pending[0]).toHaveProperty('id');
  });

  it('reports ok when every manifest bundle is stamped at current version', async () => {
    const manifest = svc.getProvisioningBundlesManifest();
    const db: any = {
      async query() {
        return manifest.map((m: any) => ({ bundle_id: m.id, version: m.version }));
      },
    };
    const health = await svc.getTenantSchemaHealth(db);
    expect(health.ok).toBe(true);
    expect(health.pendingCount).toBe(0);
  });

  it('flags a stale version stamp as pending', async () => {
    const manifest = svc.getProvisioningBundlesManifest();
    const db: any = {
      async query() {
        return manifest.map((m: any, i: number) => ({
          bundle_id: m.id,
          version: i === 0 ? '0.0.0-stale' : m.version,
        }));
      },
    };
    const health = await svc.getTenantSchemaHealth(db);
    expect(health.ok).toBe(false);
    expect(health.pending.map((p: any) => p.id)).toContain(manifest[0].id);
  });
});
