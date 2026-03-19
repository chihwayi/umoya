/**
 * Sprint 100 — Clinical Trial Matching
 * Table: trial_matches
 */
const BUNDLE_ID = 'sprint100_trial_matching';

export async function provisionSprint100(ds: any): Promise<void> {
  const already = await ds.query(`SELECT id FROM tenant_schema_versions WHERE bundle_id=$1`, [BUNDLE_ID]).catch(() => []);
  if (already.length) return;

  await ds.query(`
    CREATE TABLE IF NOT EXISTS trial_matches (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      patient_id UUID NOT NULL,
      nct_id VARCHAR(20) NOT NULL,
      trial_title TEXT NOT NULL,
      phase VARCHAR(20),
      condition VARCHAR(200) NOT NULL,
      eligibility_score FLOAT NOT NULL DEFAULT 0,
      inclusion_met JSONB NOT NULL DEFAULT '[]',
      exclusion_flags JSONB NOT NULL DEFAULT '[]',
      sponsor VARCHAR(200),
      locations JSONB NOT NULL DEFAULT '[]',
      status VARCHAR(20) NOT NULL DEFAULT 'matched',
      contact_email VARCHAR(200),
      matched_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE(patient_id, nct_id)
    )
  `);
  await ds.query(`CREATE INDEX IF NOT EXISTS idx_trial_patient ON trial_matches(patient_id)`);
  await ds.query(`CREATE INDEX IF NOT EXISTS idx_trial_condition ON trial_matches(condition)`);
  await ds.query(`CREATE INDEX IF NOT EXISTS idx_trial_status ON trial_matches(status)`);

  await ds.query(`INSERT INTO tenant_schema_versions(bundle_id,applied_at) VALUES($1,NOW())`, [BUNDLE_ID]);
}
