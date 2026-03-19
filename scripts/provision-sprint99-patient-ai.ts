/**
 * Sprint 99 — Patient Conversational AI
 * Tables: symptom_checker_sessions, adherence_chat_logs
 */
const BUNDLE_ID = 'sprint99_patient_ai';

export async function provisionSprint99(ds: any): Promise<void> {
  const already = await ds.query(`SELECT id FROM tenant_schema_versions WHERE bundle_id=$1`, [BUNDLE_ID]).catch(() => []);
  if (already.length) return;

  await ds.query(`
    CREATE TABLE IF NOT EXISTS symptom_checker_sessions (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      patient_id UUID NOT NULL,
      reported_symptoms JSONB NOT NULL DEFAULT '[]',
      duration_days INTEGER,
      severity VARCHAR(20),
      differential JSONB NOT NULL DEFAULT '[]',
      triage_level VARCHAR(20),
      recommended_action TEXT,
      escalated_to_encounter BOOLEAN NOT NULL DEFAULT FALSE,
      encounter_id UUID,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  await ds.query(`CREATE INDEX IF NOT EXISTS idx_symptom_patient ON symptom_checker_sessions(patient_id)`);
  await ds.query(`CREATE INDEX IF NOT EXISTS idx_symptom_triage ON symptom_checker_sessions(triage_level)`);

  await ds.query(`
    CREATE TABLE IF NOT EXISTS adherence_chat_logs (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      patient_id UUID NOT NULL,
      session_id UUID NOT NULL,
      message_role VARCHAR(10) NOT NULL,
      message TEXT NOT NULL,
      intent VARCHAR(30),
      medications_discussed JSONB NOT NULL DEFAULT '[]',
      adherence_concern_flagged BOOLEAN NOT NULL DEFAULT FALSE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  await ds.query(`CREATE INDEX IF NOT EXISTS idx_adherence_patient ON adherence_chat_logs(patient_id)`);
  await ds.query(`CREATE INDEX IF NOT EXISTS idx_adherence_session ON adherence_chat_logs(session_id)`);

  await ds.query(`INSERT INTO tenant_schema_versions(bundle_id,applied_at) VALUES($1,NOW())`, [BUNDLE_ID]);
}
