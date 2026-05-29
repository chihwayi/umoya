export const TENANT_TBA_BIRTH_BUNDLE_VERSION = '2026.04.17.1';

export const TENANT_TBA_BIRTH_STATEMENTS: string[] = [

  // ── TBA Register ───────────────────────────────────────────────────────────
  `CREATE TABLE IF NOT EXISTS tba_register (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    -- TBA identity
    tba_code TEXT NOT NULL UNIQUE,       -- district-assigned code (e.g. 'MAS-TBA-0042')
    full_name TEXT NOT NULL,
    sex TEXT NOT NULL DEFAULT 'female',
    date_of_birth DATE,
    phone TEXT,
    village TEXT NOT NULL,
    ward TEXT,
    district TEXT NOT NULL,
    -- Registration
    registration_date DATE NOT NULL DEFAULT CURRENT_DATE,
    registration_status TEXT NOT NULL DEFAULT 'active',  -- 'active' | 'suspended' | 'inactive' | 'deceased'
    -- Training
    trained BOOLEAN NOT NULL DEFAULT false,
    training_type TEXT,                  -- 'basic_TBA_training' | 'skilled_birth_attendant' | 'none'
    last_training_date DATE,
    training_institution TEXT,
    -- Supervision
    assigned_chw_id UUID,                -- CHW responsible for TBA supervision
    assigned_facility_id TEXT,           -- nearest facility for referrals
    supervising_midwife_id UUID,
    last_supervision_date DATE,
    supervision_score INTEGER,           -- 0-100, CDSS-computed
    supervision_risk TEXT,               -- 'low' | 'medium' | 'high' (CDSS)
    -- Activity stats (maintained by triggers/service)
    total_deliveries INTEGER NOT NULL DEFAULT 0,
    maternal_deaths INTEGER NOT NULL DEFAULT 0,
    neonatal_deaths INTEGER NOT NULL DEFAULT 0,
    referrals_made INTEGER NOT NULL DEFAULT 0,
    -- Audit
    registered_by UUID,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
  )`,

  `CREATE INDEX IF NOT EXISTS idx_tba_register_district ON tba_register(district)`,
  `CREATE INDEX IF NOT EXISTS idx_tba_register_status ON tba_register(registration_status)`,

  // ── Home Birth Records ──────────────────────────────────────────────────────
  `CREATE TABLE IF NOT EXISTS home_birth_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    -- Attendant
    tba_id UUID REFERENCES tba_register(id),
    attended_by_type TEXT NOT NULL,      -- 'tba' | 'relative' | 'alone' | 'other'
    attended_by_name TEXT,
    -- Mother
    mother_patient_id UUID,              -- if registered in Umoya
    mother_name TEXT NOT NULL,
    mother_phone TEXT,
    mother_village TEXT NOT NULL,
    mother_age_years INTEGER,
    mother_parity INTEGER,               -- number of previous deliveries
    antenatal_visits INTEGER NOT NULL DEFAULT 0,
    last_anc_date DATE,
    -- Birth
    birth_date DATE NOT NULL,
    birth_time TIME,
    birth_place_description TEXT,        -- 'home' | 'under_tree' | 'community_hall'
    gestational_age_weeks INTEGER,
    -- Baby
    baby_alive BOOLEAN NOT NULL DEFAULT true,
    baby_sex TEXT,                       -- 'male' | 'female' | 'unknown'
    birth_weight_kg DECIMAL(4,2),
    apgar_score INTEGER,
    birth_outcome TEXT NOT NULL,         -- 'live_birth' | 'fresh_stillbirth' | 'macerated_stillbirth'
    multiple_birth BOOLEAN NOT NULL DEFAULT false,
    multiple_birth_count INTEGER,
    -- Maternal status
    maternal_alive BOOLEAN NOT NULL DEFAULT true,
    maternal_complications JSONB DEFAULT '[]',  -- ['PPH','eclampsia','prolonged_labour','sepsis','tear']
    maternal_complication_outcome TEXT,
    -- Immediate care
    cord_cut_with TEXT,                  -- 'sterile_blade' | 'unsterile_blade' | 'string' | 'unknown'
    misoprostol_given BOOLEAN NOT NULL DEFAULT false,  -- for PPH prevention
    vitamin_k_given BOOLEAN NOT NULL DEFAULT false,
    eye_care_given BOOLEAN NOT NULL DEFAULT false,     -- tetracycline/chloramphenicol drops
    breastfeeding_initiated BOOLEAN,
    -- Referral
    referred BOOLEAN NOT NULL DEFAULT false,
    referral_reason TEXT,
    referral_facility TEXT,
    referral_outcome TEXT,               -- 'accepted' | 'arrived' | 'died_in_transit' | 'refused'
    -- CRVS notification
    crvs_notified BOOLEAN NOT NULL DEFAULT false,
    crvs_notification_date DATE,
    birth_certificate_number TEXT,
    -- CDSS risk assessment
    cdss_risk_level TEXT,                -- 'low' | 'moderate' | 'high'
    cdss_recommendation TEXT,
    cdss_confidence DECIMAL(4,3),
    -- Recording
    recorded_by UUID,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
  )`,

  `CREATE INDEX IF NOT EXISTS idx_home_births_tba ON home_birth_records(tba_id)`,
  `CREATE INDEX IF NOT EXISTS idx_home_births_date ON home_birth_records(birth_date)`,
  `CREATE INDEX IF NOT EXISTS idx_home_births_mother ON home_birth_records(mother_patient_id)`,
  `CREATE INDEX IF NOT EXISTS idx_home_births_crvs ON home_birth_records(crvs_notified)`,

];
