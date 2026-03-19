/**
 * Sprint 91 — MOHCC HIMIS Reporting + OpenMRS Migration
 * Tables: mohcc_report_submissions, openmrs_migration_logs
 */
const BUNDLE_ID = 'sprint91_himis_reporting';

export async function provisionSprint91(ds: any): Promise<void> {
  const already = await ds.query(
    `SELECT id FROM tenant_schema_versions WHERE bundle_id = $1`, [BUNDLE_ID]
  ).catch(() => []);
  if (already.length) return;

  await ds.query(`
    CREATE TABLE IF NOT EXISTS mohcc_report_submissions (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      report_type VARCHAR(50) NOT NULL,
      period_label VARCHAR(20) NOT NULL,
      facility_code VARCHAR(50),
      payload JSONB NOT NULL DEFAULT '{}',
      status VARCHAR(20) NOT NULL DEFAULT 'pending',
      response_code VARCHAR(10),
      response_message TEXT,
      submitted_by VARCHAR(100),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      submitted_at TIMESTAMPTZ
    )
  `);
  await ds.query(`CREATE INDEX IF NOT EXISTS idx_mohcc_subs_period ON mohcc_report_submissions(period_label)`);
  await ds.query(`CREATE INDEX IF NOT EXISTS idx_mohcc_subs_type ON mohcc_report_submissions(report_type)`);

  await ds.query(`
    CREATE TABLE IF NOT EXISTS openmrs_migration_logs (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      batch_id VARCHAR(100) NOT NULL,
      resource_type VARCHAR(50) NOT NULL,
      openmrs_uuid VARCHAR(100),
      medicore_id UUID,
      status VARCHAR(20) NOT NULL DEFAULT 'migrated',
      error_details TEXT,
      raw_record JSONB,
      migrated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  await ds.query(`CREATE INDEX IF NOT EXISTS idx_openmrs_batch ON openmrs_migration_logs(batch_id)`);
  await ds.query(`CREATE INDEX IF NOT EXISTS idx_openmrs_uuid ON openmrs_migration_logs(openmrs_uuid)`);

  await ds.query(
    `INSERT INTO tenant_schema_versions (bundle_id, applied_at) VALUES ($1, NOW())`, [BUNDLE_ID]
  );
}
