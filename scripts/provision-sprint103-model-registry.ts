/**
 * Sprint 103 — Autonomous Learning Loop / Model Registry
 * Table: model_registry
 */
const BUNDLE_ID = 'sprint103_model_registry';

export async function provisionSprint103(ds: any): Promise<void> {
  const already = await ds.query(
    `SELECT id FROM tenant_schema_versions WHERE bundle_id=$1`, [BUNDLE_ID]
  ).catch(() => []);
  if (already.length) return;

  await ds.query(`
    CREATE TABLE IF NOT EXISTS model_registry (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      model_name VARCHAR(50) NOT NULL,
      version VARCHAR(20) NOT NULL,
      round_id UUID,
      status VARCHAR(20) NOT NULL DEFAULT 'staging',
      minio_path TEXT NOT NULL,
      auc_roc FLOAT,
      brier_score FLOAT,
      sample_count INTEGER NOT NULL DEFAULT 0,
      tenant_count INTEGER NOT NULL DEFAULT 0,
      model_hash VARCHAR(64),
      feature_names JSONB NOT NULL DEFAULT '[]',
      framework VARCHAR(20) NOT NULL DEFAULT 'sklearn',
      promoted_at TIMESTAMPTZ,
      retired_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  await ds.query(`CREATE INDEX IF NOT EXISTS idx_model_reg_name_status ON model_registry(model_name, status)`);
  await ds.query(`CREATE UNIQUE INDEX IF NOT EXISTS idx_model_reg_production ON model_registry(model_name) WHERE status='production'`);

  await ds.query(
    `INSERT INTO tenant_schema_versions(bundle_id, applied_at) VALUES($1, NOW())`, [BUNDLE_ID]
  );
}
