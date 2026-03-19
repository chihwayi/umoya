/**
 * Sprint 96 — Radiology AI (DICOM + CXR/Retinal/Derm inference)
 * Tables: dicom_studies, radiology_ai_findings
 */
const BUNDLE_ID = 'sprint96_radiology_ai';

export async function provisionSprint96(ds: any): Promise<void> {
  const already = await ds.query(`SELECT id FROM tenant_schema_versions WHERE bundle_id=$1`, [BUNDLE_ID]).catch(() => []);
  if (already.length) return;

  await ds.query(`
    CREATE TABLE IF NOT EXISTS dicom_studies (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      patient_id UUID NOT NULL,
      imaging_order_id UUID,
      study_uid VARCHAR(200) NOT NULL UNIQUE,
      modality VARCHAR(20) NOT NULL,
      body_part VARCHAR(50),
      storage_key TEXT NOT NULL,
      file_size_bytes BIGINT DEFAULT 0,
      ai_analysis_requested BOOLEAN NOT NULL DEFAULT FALSE,
      ai_analysis_status VARCHAR(20) NOT NULL DEFAULT 'pending',
      acquired_at TIMESTAMPTZ,
      uploaded_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  await ds.query(`CREATE INDEX IF NOT EXISTS idx_dicom_patient ON dicom_studies(patient_id)`);
  await ds.query(`CREATE INDEX IF NOT EXISTS idx_dicom_status ON dicom_studies(ai_analysis_status)`);

  await ds.query(`
    CREATE TABLE IF NOT EXISTS radiology_ai_findings (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      study_id UUID NOT NULL,
      patient_id UUID NOT NULL,
      modality VARCHAR(20) NOT NULL,
      findings JSONB NOT NULL DEFAULT '[]',
      top_finding TEXT,
      overall_confidence FLOAT,
      heatmap_storage_key TEXT,
      model_version VARCHAR(50),
      radiologist_reviewed BOOLEAN NOT NULL DEFAULT FALSE,
      radiologist_notes TEXT,
      alerted BOOLEAN NOT NULL DEFAULT FALSE,
      analyzed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  await ds.query(`CREATE INDEX IF NOT EXISTS idx_rad_findings_study ON radiology_ai_findings(study_id)`);
  await ds.query(`CREATE INDEX IF NOT EXISTS idx_rad_findings_patient ON radiology_ai_findings(patient_id)`);
  await ds.query(`CREATE INDEX IF NOT EXISTS idx_rad_findings_alerted ON radiology_ai_findings(alerted) WHERE alerted=TRUE`);

  await ds.query(`INSERT INTO tenant_schema_versions(bundle_id,applied_at) VALUES($1,NOW())`, [BUNDLE_ID]);
}
