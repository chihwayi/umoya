/**
 * Sprint 92 — Bidirectional FHIR (Inbound)
 * Table: fhir_ingestion_logs
 */
const BUNDLE_ID = 'sprint92_fhir_inbound';

export async function provisionSprint92(ds: any): Promise<void> {
  const already = await ds.query(
    `SELECT id FROM tenant_schema_versions WHERE bundle_id = $1`, [BUNDLE_ID]
  ).catch(() => []);
  if (already.length) return;

  await ds.query(`
    CREATE TABLE IF NOT EXISTS fhir_ingestion_logs (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      source_system VARCHAR(100) NOT NULL,
      bundle_id VARCHAR(200),
      received_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      resources_received INTEGER NOT NULL DEFAULT 0,
      resources_imported INTEGER NOT NULL DEFAULT 0,
      conflicts_detected INTEGER NOT NULL DEFAULT 0,
      conflicts_resolved INTEGER NOT NULL DEFAULT 0,
      status VARCHAR(20) NOT NULL DEFAULT 'pending',
      error_details JSONB
    )
  `);
  await ds.query(`CREATE INDEX IF NOT EXISTS idx_fhir_ingestion_source ON fhir_ingestion_logs(source_system)`);
  await ds.query(`CREATE INDEX IF NOT EXISTS idx_fhir_ingestion_status ON fhir_ingestion_logs(status)`);

  await ds.query(
    `INSERT INTO tenant_schema_versions (bundle_id, applied_at) VALUES ($1, NOW())`, [BUNDLE_ID]
  );
}
