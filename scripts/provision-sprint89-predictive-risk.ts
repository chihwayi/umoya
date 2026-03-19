/**
 * Sprint 89 — Predictive Deterioration & Readmission
 * Tables: deterioration_predictions, readmission_predictions
 */
const BUNDLE_ID = 'sprint89_predictive_risk';

export async function provisionSprint89(ds: any): Promise<void> {
  const already = await ds.query(
    `SELECT id FROM tenant_schema_versions WHERE bundle_id = $1`, [BUNDLE_ID]
  ).catch(() => []);
  if (already.length) return;

  await ds.query(`
    CREATE TABLE IF NOT EXISTS deterioration_predictions (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      patient_id UUID NOT NULL,
      admission_id UUID,
      prediction_time TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      deterioration_score NUMERIC(5,2) NOT NULL DEFAULT 0,
      predicted_event_type VARCHAR(50),
      predicted_timeframe_hours INTEGER,
      feature_contributions JSONB NOT NULL DEFAULT '{}',
      triggered_alert BOOLEAN NOT NULL DEFAULT FALSE,
      model_used VARCHAR(50) DEFAULT 'MEWS',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  await ds.query(`CREATE INDEX IF NOT EXISTS idx_det_pred_patient ON deterioration_predictions(patient_id)`);
  await ds.query(`CREATE INDEX IF NOT EXISTS idx_det_pred_alert ON deterioration_predictions(triggered_alert) WHERE triggered_alert = TRUE`);

  await ds.query(`
    CREATE TABLE IF NOT EXISTS readmission_predictions (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      patient_id UUID NOT NULL,
      discharge_id UUID,
      prediction_date DATE NOT NULL,
      readmission_30day_risk NUMERIC(5,4) NOT NULL DEFAULT 0,
      risk_category VARCHAR(20) NOT NULL DEFAULT 'low',
      key_risk_factors JSONB NOT NULL DEFAULT '[]',
      recommended_followup_interval INTEGER,
      prediction_model VARCHAR(50) DEFAULT 'LACE+',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  await ds.query(`CREATE INDEX IF NOT EXISTS idx_readm_pred_patient ON readmission_predictions(patient_id)`);

  await ds.query(
    `INSERT INTO tenant_schema_versions (bundle_id, applied_at) VALUES ($1, NOW())`, [BUNDLE_ID]
  );
}
