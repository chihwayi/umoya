/**
 * Sprint 93 — Multilingual Patient Education
 * Table: patient_education_materials
 */
const BUNDLE_ID = 'sprint93_multilingual_education';

export async function provisionSprint93(ds: any): Promise<void> {
  const already = await ds.query(
    `SELECT id FROM tenant_schema_versions WHERE bundle_id = $1`, [BUNDLE_ID]
  ).catch(() => []);
  if (already.length) return;

  await ds.query(`
    CREATE TABLE IF NOT EXISTS patient_education_materials (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      patient_id UUID NOT NULL,
      encounter_id UUID,
      topic VARCHAR(200) NOT NULL,
      language VARCHAR(10) NOT NULL DEFAULT 'en',
      reading_level INTEGER NOT NULL DEFAULT 6,
      content TEXT NOT NULL DEFAULT '',
      content_html TEXT,
      pdf_storage_key VARCHAR(500),
      ai_generated BOOLEAN NOT NULL DEFAULT FALSE,
      delivery_method VARCHAR(20),
      delivered_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  await ds.query(`CREATE INDEX IF NOT EXISTS idx_edu_patient ON patient_education_materials(patient_id)`);
  await ds.query(`CREATE INDEX IF NOT EXISTS idx_edu_language ON patient_education_materials(language)`);

  await ds.query(
    `INSERT INTO tenant_schema_versions (bundle_id, applied_at) VALUES ($1, NOW())`, [BUNDLE_ID]
  );
}
