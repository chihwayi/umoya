/**
 * Sprint 97 — Real-Time Critical Alert Delivery
 * Table: clinical_alert_deliveries
 * Also adds fcm_token + on_call columns to users
 */
const BUNDLE_ID = 'sprint97_alert_delivery';

export async function provisionSprint97(ds: any): Promise<void> {
  const already = await ds.query(`SELECT id FROM tenant_schema_versions WHERE bundle_id=$1`, [BUNDLE_ID]).catch(() => []);
  if (already.length) return;

  await ds.query(`
    CREATE TABLE IF NOT EXISTS clinical_alert_deliveries (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      alert_type VARCHAR(50) NOT NULL,
      source_entity_id UUID NOT NULL,
      patient_id UUID NOT NULL,
      recipient_user_id UUID NOT NULL,
      recipient_role VARCHAR(30),
      severity VARCHAR(20) NOT NULL,
      message TEXT NOT NULL,
      payload JSONB NOT NULL DEFAULT '{}',
      websocket_sent BOOLEAN NOT NULL DEFAULT FALSE,
      fcm_sent BOOLEAN NOT NULL DEFAULT FALSE,
      sms_sent BOOLEAN NOT NULL DEFAULT FALSE,
      acknowledged BOOLEAN NOT NULL DEFAULT FALSE,
      acknowledged_at TIMESTAMPTZ,
      acknowledged_by UUID,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  await ds.query(`CREATE INDEX IF NOT EXISTS idx_alert_del_recipient ON clinical_alert_deliveries(recipient_user_id)`);
  await ds.query(`CREATE INDEX IF NOT EXISTS idx_alert_del_patient ON clinical_alert_deliveries(patient_id)`);
  await ds.query(`CREATE INDEX IF NOT EXISTS idx_alert_del_ack ON clinical_alert_deliveries(acknowledged) WHERE acknowledged=FALSE`);

  await ds.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS fcm_token TEXT`);
  await ds.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS on_call BOOLEAN NOT NULL DEFAULT FALSE`);
  await ds.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS phone VARCHAR(20)`);

  await ds.query(`INSERT INTO tenant_schema_versions(bundle_id,applied_at) VALUES($1,NOW())`, [BUNDLE_ID]);
}
