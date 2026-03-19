/**
 * Sprint 95 — IoT / Wearables Integration
 * Tables: iot_device_registrations, iot_data_ingestions
 */
const BUNDLE_ID = 'sprint95_iot_wearables';

export async function provisionSprint95(ds: any): Promise<void> {
  const already = await ds.query(
    `SELECT id FROM tenant_schema_versions WHERE bundle_id = $1`, [BUNDLE_ID]
  ).catch(() => []);
  if (already.length) return;

  await ds.query(`
    CREATE TABLE IF NOT EXISTS iot_device_registrations (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      patient_id UUID NOT NULL,
      device_type VARCHAR(50) NOT NULL,
      device_name VARCHAR(100),
      manufacturer VARCHAR(100),
      model VARCHAR(100),
      serial_number VARCHAR(100),
      oauth_token_encrypted TEXT,
      webhook_url TEXT,
      status VARCHAR(20) NOT NULL DEFAULT 'active',
      last_sync_at TIMESTAMPTZ,
      registered_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  await ds.query(`CREATE INDEX IF NOT EXISTS idx_iot_device_patient ON iot_device_registrations(patient_id)`);
  await ds.query(`CREATE INDEX IF NOT EXISTS idx_iot_device_status ON iot_device_registrations(status)`);

  await ds.query(`
    CREATE TABLE IF NOT EXISTS iot_data_ingestions (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      patient_id UUID NOT NULL,
      device_id UUID NOT NULL,
      measurement_type VARCHAR(100) NOT NULL,
      value NUMERIC(12,4) NOT NULL,
      unit VARCHAR(20),
      measured_at TIMESTAMPTZ NOT NULL,
      ingested_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      fhir_observation_id VARCHAR(200),
      ai_processed BOOLEAN NOT NULL DEFAULT FALSE,
      alert_triggered BOOLEAN NOT NULL DEFAULT FALSE
    )
  `);
  await ds.query(`CREATE INDEX IF NOT EXISTS idx_iot_data_patient ON iot_data_ingestions(patient_id)`);
  await ds.query(`CREATE INDEX IF NOT EXISTS idx_iot_data_device ON iot_data_ingestions(device_id)`);
  await ds.query(`CREATE INDEX IF NOT EXISTS idx_iot_data_type ON iot_data_ingestions(measurement_type)`);
  await ds.query(`CREATE INDEX IF NOT EXISTS idx_iot_data_alert ON iot_data_ingestions(alert_triggered) WHERE alert_triggered = TRUE`);

  await ds.query(
    `INSERT INTO tenant_schema_versions (bundle_id, applied_at) VALUES ($1, NOW())`, [BUNDLE_ID]
  );
}
