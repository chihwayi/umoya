export const TENANT_MATERNAL_MORTALITY_EMONC_BUNDLE_VERSION = '2026.04.18.1';

export const TENANT_MATERNAL_MORTALITY_EMONC_STATEMENTS: string[] = [
  `CREATE TABLE IF NOT EXISTS maternal_deaths (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_id UUID NOT NULL,
    facility_id UUID,
    reported_by UUID NOT NULL,
    death_date DATE NOT NULL,
    age_at_death INT,
    gestational_age_weeks INT,
    death_category TEXT NOT NULL DEFAULT 'undetermined',
    primary_cause TEXT,
    icd10_primary TEXT,
    contributing_causes JSONB DEFAULT '[]'::jsonb,
    delay_1_recognition BOOLEAN,
    delay_2_reaching BOOLEAN,
    delay_3_care BOOLEAN,
    delay_notes TEXT,
    avoidable BOOLEAN,
    avoidability_factors JSONB DEFAULT '[]'::jsonb,
    referred_from TEXT,
    mode_of_admission TEXT,
    is_near_miss BOOLEAN NOT NULL DEFAULT false,
    notification_sent BOOLEAN NOT NULL DEFAULT false,
    notification_sent_at TIMESTAMPTZ,
    review_status TEXT NOT NULL DEFAULT 'pending',
    district_submission_ref TEXT,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`,
  `CREATE INDEX IF NOT EXISTS idx_maternal_deaths_patient ON maternal_deaths(patient_id)`,
  `CREATE INDEX IF NOT EXISTS idx_maternal_deaths_date ON maternal_deaths(death_date)`,
  `CREATE INDEX IF NOT EXISTS idx_maternal_deaths_category ON maternal_deaths(death_category)`,
  `CREATE INDEX IF NOT EXISTS idx_maternal_deaths_review ON maternal_deaths(review_status)`,

  `CREATE TABLE IF NOT EXISTS maternal_death_reviews (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    maternal_death_id UUID NOT NULL,
    reviewed_by UUID NOT NULL,
    review_date DATE NOT NULL DEFAULT CURRENT_DATE,
    review_team JSONB DEFAULT '[]'::jsonb,
    timeline_summary TEXT,
    standard_of_care TEXT,
    recommendations JSONB DEFAULT '[]'::jsonb,
    action_plan_agreed BOOLEAN NOT NULL DEFAULT false,
    follow_up_date DATE,
    review_complete BOOLEAN NOT NULL DEFAULT false,
    submitted_to_district BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`,
  `ALTER TABLE maternal_death_reviews ADD COLUMN IF NOT EXISTS maternal_death_id UUID`,
  `ALTER TABLE maternal_death_reviews ADD COLUMN IF NOT EXISTS reviewed_by UUID`,
  `ALTER TABLE maternal_death_reviews ADD COLUMN IF NOT EXISTS review_date DATE DEFAULT CURRENT_DATE`,
  `ALTER TABLE maternal_death_reviews ADD COLUMN IF NOT EXISTS review_team JSONB DEFAULT '[]'::jsonb`,
  `ALTER TABLE maternal_death_reviews ADD COLUMN IF NOT EXISTS timeline_summary TEXT`,
  `ALTER TABLE maternal_death_reviews ADD COLUMN IF NOT EXISTS standard_of_care TEXT`,
  `ALTER TABLE maternal_death_reviews ADD COLUMN IF NOT EXISTS recommendations JSONB DEFAULT '[]'::jsonb`,
  `ALTER TABLE maternal_death_reviews ADD COLUMN IF NOT EXISTS action_plan_agreed BOOLEAN NOT NULL DEFAULT false`,
  `ALTER TABLE maternal_death_reviews ADD COLUMN IF NOT EXISTS follow_up_date DATE`,
  `ALTER TABLE maternal_death_reviews ADD COLUMN IF NOT EXISTS review_complete BOOLEAN NOT NULL DEFAULT false`,
  `ALTER TABLE maternal_death_reviews ADD COLUMN IF NOT EXISTS submitted_to_district BOOLEAN NOT NULL DEFAULT false`,
  `DO $$
  BEGIN
    IF EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_name = 'maternal_death_reviews' AND column_name = 'recorded_by'
    ) THEN
      UPDATE maternal_death_reviews
      SET reviewed_by = COALESCE(reviewed_by, recorded_by)
      WHERE reviewed_by IS NULL;
    END IF;

    IF EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_name = 'maternal_death_reviews' AND column_name = 'committee_review_date'
    ) THEN
      UPDATE maternal_death_reviews
      SET review_date = COALESCE(review_date, committee_review_date, CURRENT_DATE)
      WHERE review_date IS NULL;
    END IF;

    IF EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_name = 'maternal_death_reviews' AND column_name = 'committee_notes'
    ) THEN
      UPDATE maternal_death_reviews
      SET timeline_summary = COALESCE(timeline_summary, committee_notes)
      WHERE timeline_summary IS NULL;
    END IF;

    IF EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_name = 'maternal_death_reviews' AND column_name = 'submitted_to_moh'
    ) THEN
      UPDATE maternal_death_reviews
      SET submitted_to_district = COALESCE(submitted_to_district, submitted_to_moh, false)
      WHERE submitted_to_district IS DISTINCT FROM COALESCE(submitted_to_moh, false);
    END IF;
  END $$`,
  `CREATE INDEX IF NOT EXISTS idx_mdr_death_id ON maternal_death_reviews(maternal_death_id)`,
  `CREATE INDEX IF NOT EXISTS idx_mdr_reviewed_by ON maternal_death_reviews(reviewed_by)`,

  `CREATE TABLE IF NOT EXISTS emonc_signals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    facility_id UUID,
    recorded_by UUID NOT NULL,
    assessment_date DATE NOT NULL DEFAULT CURRENT_DATE,
    assessment_period_months INT NOT NULL DEFAULT 3,
    sf1_parenteral_antibiotics TEXT NOT NULL DEFAULT 'unknown',
    sf2_parenteral_oxytocics TEXT NOT NULL DEFAULT 'unknown',
    sf3_parenteral_anticonvulsants TEXT NOT NULL DEFAULT 'unknown',
    sf4_manual_removal_placenta TEXT NOT NULL DEFAULT 'unknown',
    sf5_removal_retained_products TEXT NOT NULL DEFAULT 'unknown',
    sf6_neonatal_resuscitation TEXT NOT NULL DEFAULT 'unknown',
    sf7_assisted_vaginal_delivery TEXT NOT NULL DEFAULT 'unknown',
    sf8_caesarean_section TEXT NOT NULL DEFAULT 'unknown',
    sf9_blood_transfusion TEXT NOT NULL DEFAULT 'unknown',
    emonc_classification TEXT,
    barriers JSONB DEFAULT '{}'::jsonb,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`,
  `CREATE INDEX IF NOT EXISTS idx_emonc_facility ON emonc_signals(facility_id)`,
  `CREATE INDEX IF NOT EXISTS idx_emonc_date ON emonc_signals(assessment_date)`,
];
