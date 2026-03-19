/**
 * Sprint 94 — Offline Sync PWA
 * Table: sync_queue_logs
 */
const BUNDLE_ID = 'sprint94_offline_sync';

export async function provisionSprint94(ds: any): Promise<void> {
  const already = await ds.query(
    `SELECT id FROM tenant_schema_versions WHERE bundle_id = $1`, [BUNDLE_ID]
  ).catch(() => []);
  if (already.length) return;

  await ds.query(`
    CREATE TABLE IF NOT EXISTS sync_queue_logs (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      client_id VARCHAR(100) NOT NULL,
      operation_type VARCHAR(20) NOT NULL,
      entity_type VARCHAR(50) NOT NULL,
      entity_id UUID,
      payload JSONB NOT NULL DEFAULT '{}',
      client_timestamp TIMESTAMPTZ NOT NULL,
      server_timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      sync_status VARCHAR(20) NOT NULL DEFAULT 'pending',
      conflict_details JSONB
    )
  `);
  await ds.query(`CREATE INDEX IF NOT EXISTS idx_sync_client ON sync_queue_logs(client_id)`);
  await ds.query(`CREATE INDEX IF NOT EXISTS idx_sync_status ON sync_queue_logs(sync_status)`);
  await ds.query(`CREATE INDEX IF NOT EXISTS idx_sync_entity ON sync_queue_logs(entity_type, entity_id)`);

  await ds.query(
    `INSERT INTO tenant_schema_versions (bundle_id, applied_at) VALUES ($1, NOW())`, [BUNDLE_ID]
  );
}
