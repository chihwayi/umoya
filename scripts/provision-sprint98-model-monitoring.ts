/**
 * Sprint 98 — AI Model Drift & Fairness Monitoring
 * Tables: model_performance_metrics, model_fairness_reports
 */
const BUNDLE_ID = 'sprint98_model_monitoring';

export async function provisionSprint98(ds: any): Promise<void> {
  const already = await ds.query(`SELECT id FROM tenant_schema_versions WHERE bundle_id=$1`, [BUNDLE_ID]).catch(() => []);
  if (already.length) return;

  await ds.query(`
    CREATE TABLE IF NOT EXISTS model_performance_metrics (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      model_name VARCHAR(50) NOT NULL,
      evaluation_period VARCHAR(10) NOT NULL,
      sample_count INTEGER NOT NULL DEFAULT 0,
      auc_roc FLOAT,
      brier_score FLOAT,
      sensitivity FLOAT,
      specificity FLOAT,
      ppv FLOAT,
      calibration_data JSONB,
      drift_detected BOOLEAN NOT NULL DEFAULT FALSE,
      baseline_auc FLOAT,
      computed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  await ds.query(`CREATE INDEX IF NOT EXISTS idx_mpf_model_period ON model_performance_metrics(model_name, evaluation_period)`);
  await ds.query(`CREATE INDEX IF NOT EXISTS idx_mpf_drift ON model_performance_metrics(drift_detected) WHERE drift_detected=TRUE`);

  await ds.query(`
    CREATE TABLE IF NOT EXISTS model_fairness_reports (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      model_name VARCHAR(50) NOT NULL,
      evaluation_period VARCHAR(10) NOT NULL,
      dimension VARCHAR(30) NOT NULL,
      group_metrics JSONB NOT NULL DEFAULT '{}',
      max_disparity FLOAT,
      fairness_flag BOOLEAN NOT NULL DEFAULT FALSE,
      computed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  await ds.query(`CREATE INDEX IF NOT EXISTS idx_mfr_model ON model_fairness_reports(model_name, evaluation_period)`);
  await ds.query(`CREATE INDEX IF NOT EXISTS idx_mfr_flag ON model_fairness_reports(fairness_flag) WHERE fairness_flag=TRUE`);

  await ds.query(`INSERT INTO tenant_schema_versions(bundle_id,applied_at) VALUES($1,NOW())`, [BUNDLE_ID]);
}
