export const TENANT_ONE_HEALTH_PACTR_BUNDLE_VERSION = '2026.04.13.1';

export const TENANT_ONE_HEALTH_PACTR_STATEMENTS: string[] = [
  `CREATE TABLE IF NOT EXISTS animal_exposures (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_id UUID NOT NULL,
    recorded_by UUID,
    recorded_date DATE NOT NULL DEFAULT CURRENT_DATE,
    animal_type TEXT NOT NULL,
    exposure_type TEXT NOT NULL,
    exposure_date DATE,
    exposure_location TEXT,
    animal_ill BOOLEAN,
    animal_vaccinated BOOLEAN,
    rabies_pep_started BOOLEAN NOT NULL DEFAULT false,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`,
  `CREATE INDEX IF NOT EXISTS idx_animal_exp_patient ON animal_exposures(patient_id)`,
  `CREATE INDEX IF NOT EXISTS idx_animal_exp_type ON animal_exposures(animal_type)`,
  `CREATE INDEX IF NOT EXISTS idx_animal_exp_date ON animal_exposures(exposure_date)`,

  `CREATE TABLE IF NOT EXISTS one_health_reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_id UUID NOT NULL,
    animal_exposure_id UUID,
    reported_by UUID,
    suspected_zoonosis TEXT NOT NULL,
    icd11_code TEXT,
    report_date DATE NOT NULL DEFAULT CURRENT_DATE,
    clinical_summary TEXT,
    lab_evidence JSONB DEFAULT '{}'::jsonb,
    submitted_to_vet_authority BOOLEAN NOT NULL DEFAULT false,
    vet_authority_reference TEXT,
    submitted_at TIMESTAMPTZ,
    outcome TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`,
  `CREATE INDEX IF NOT EXISTS idx_one_health_patient ON one_health_reports(patient_id)`,
  `CREATE INDEX IF NOT EXISTS idx_one_health_zoonosis ON one_health_reports(suspected_zoonosis)`,
  `CREATE INDEX IF NOT EXISTS idx_one_health_submitted ON one_health_reports(submitted_to_vet_authority)`,

  `ALTER TABLE trial_matches
    ADD COLUMN IF NOT EXISTS registry TEXT NOT NULL DEFAULT 'clinicaltrials_gov',
    ADD COLUMN IF NOT EXISTS registry_id TEXT`,
  `CREATE INDEX IF NOT EXISTS idx_trial_match_registry ON trial_matches(registry)`,
];
