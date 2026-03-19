/**
 * Sprint 90 — Federated Learning Infrastructure
 * Tables: fl_rounds, fl_participation_logs
 */
const BUNDLE_ID = 'sprint90_federated_learning';

export async function provisionSprint90(ds: any): Promise<void> {
  const already = await ds.query(
    `SELECT id FROM tenant_schema_versions WHERE bundle_id = $1`, [BUNDLE_ID]
  ).catch(() => []);
  if (already.length) return;

  await ds.query(`
    CREATE TABLE IF NOT EXISTS fl_rounds (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      round_number INTEGER NOT NULL,
      global_model_version VARCHAR(100) NOT NULL,
      model_type VARCHAR(50) NOT NULL,
      participating_tenants JSONB NOT NULL DEFAULT '[]',
      aggregated_metrics JSONB NOT NULL DEFAULT '{}',
      model_weights_ref TEXT,
      status VARCHAR(20) NOT NULL DEFAULT 'pending',
      initiated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      completed_at TIMESTAMPTZ
    )
  `);
  await ds.query(`CREATE INDEX IF NOT EXISTS idx_fl_rounds_type ON fl_rounds(model_type)`);

  await ds.query(`
    CREATE TABLE IF NOT EXISTS fl_participation_logs (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      round_id UUID NOT NULL,
      tenant_subdomain VARCHAR(100) NOT NULL,
      local_model_metrics JSONB NOT NULL DEFAULT '{}',
      sample_count INTEGER NOT NULL DEFAULT 0,
      gradient_norm NUMERIC(10,6),
      privacy_epsilon NUMERIC(10,6),
      status VARCHAR(20) NOT NULL DEFAULT 'submitted',
      submitted_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  await ds.query(`CREATE INDEX IF NOT EXISTS idx_fl_logs_round ON fl_participation_logs(round_id)`);
  await ds.query(`CREATE INDEX IF NOT EXISTS idx_fl_logs_tenant ON fl_participation_logs(tenant_subdomain)`);

  await ds.query(
    `INSERT INTO tenant_schema_versions (bundle_id, applied_at) VALUES ($1, NOW())`, [BUNDLE_ID]
  );
}
