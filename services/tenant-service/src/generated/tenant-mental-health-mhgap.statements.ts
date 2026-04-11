export const TENANT_MENTAL_HEALTH_MHGAP_BUNDLE_VERSION = '2026.04.11.14';

export const TENANT_MENTAL_HEALTH_MHGAP_STATEMENTS = (): string[] => [
  `ALTER TABLE mental_health_screenings
     ADD COLUMN IF NOT EXISTS language_code VARCHAR(5) NOT NULL DEFAULT 'en'`,
  `ALTER TABLE mental_health_screenings
     ADD COLUMN IF NOT EXISTS referred BOOLEAN NOT NULL DEFAULT false`,
  `CREATE TABLE IF NOT EXISTS mental_health_care_plans (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      patient_id UUID NOT NULL,
      diagnosis_icd10 VARCHAR(10),
      diagnosis_name VARCHAR(100),
      care_level VARCHAR(20),
      assigned_chw_id UUID,
      assigned_provider UUID,
      goals TEXT[],
      interventions TEXT[],
      medication VARCHAR(100),
      review_date DATE,
      status VARCHAR(20) NOT NULL DEFAULT 'active',
      created_by UUID,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
    )`,
  `CREATE INDEX IF NOT EXISTS idx_mh_care_plans_patient ON mental_health_care_plans(patient_id)`,
  `CREATE INDEX IF NOT EXISTS idx_mh_care_plans_status ON mental_health_care_plans(status)`,
  `CREATE TABLE IF NOT EXISTS mental_health_followups (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      care_plan_id UUID,
      patient_id UUID NOT NULL,
      followup_date DATE NOT NULL,
      conducted_by UUID,
      status VARCHAR(20),
      symptom_change VARCHAR(20),
      medication_adherent BOOLEAN,
      safety_concern BOOLEAN NOT NULL DEFAULT false,
      notes TEXT,
      next_followup_date DATE,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
    )`,
  `CREATE INDEX IF NOT EXISTS idx_mh_followups_patient ON mental_health_followups(patient_id)`,
  `CREATE INDEX IF NOT EXISTS idx_mh_followups_care_plan ON mental_health_followups(care_plan_id)`,
  `CREATE INDEX IF NOT EXISTS idx_mh_followups_safety ON mental_health_followups(safety_concern)`,
];
