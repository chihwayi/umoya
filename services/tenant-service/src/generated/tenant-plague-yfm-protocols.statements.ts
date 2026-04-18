export const TENANT_PLAGUE_YFM_BUNDLE_VERSION = '2026.04.17.1';

export const TENANT_PLAGUE_YFM_STATEMENTS: string[] = [

  // ── Plague Cases ───────────────────────────────────────────────────────────
  `CREATE TABLE IF NOT EXISTS plague_cases (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_id UUID NOT NULL,
    reported_by UUID NOT NULL,
    -- Clinical form
    form TEXT NOT NULL,                  -- 'bubonic' | 'septicaemic' | 'pneumonic' | 'meningeal'
    -- Exposure history
    flea_exposure BOOLEAN NOT NULL DEFAULT false,
    rodent_contact BOOLEAN NOT NULL DEFAULT false,
    pneumonic_contact BOOLEAN NOT NULL DEFAULT false,  -- person-to-person pneumonic exposure
    travel_endemic_area BOOLEAN NOT NULL DEFAULT false,
    travel_country TEXT,
    onset_date DATE,
    date_reported DATE NOT NULL DEFAULT CURRENT_DATE,
    -- Bubonic specific
    bubo_location TEXT,                  -- 'inguinal' | 'axillary' | 'cervical' | 'multiple'
    bubo_size_cm DECIMAL(4,1),
    -- Lab
    specimen_type TEXT,                  -- 'blood' | 'bubo_aspirate' | 'sputum' | 'csf'
    lab_culture_result TEXT,             -- 'positive' | 'negative' | 'pending'
    lab_pcr_result TEXT,
    lab_result_date DATE,
    -- Treatment
    gentamicin_started_at TIMESTAMP,
    doxycycline_started_at TIMESTAMP,
    ciprofloxacin_started_at TIMESTAMP,
    treatment_response TEXT,             -- 'improving' | 'stable' | 'deteriorating'
    -- Prophylaxis
    contacts_notified INTEGER NOT NULL DEFAULT 0,
    prophylaxis_given JSONB DEFAULT '[]', -- [{contact_name, drug, dose, started_at}]
    -- IHR Notification
    notified_district BOOLEAN NOT NULL DEFAULT false,
    notified_national BOOLEAN NOT NULL DEFAULT false,
    notified_who BOOLEAN NOT NULL DEFAULT false,
    notified_at TIMESTAMP,
    -- Classification + Outcome
    classification TEXT NOT NULL DEFAULT 'suspected',  -- 'suspected' | 'probable' | 'confirmed'
    outcome TEXT,                        -- 'recovered' | 'died' | 'transferred' | 'under_care'
    outcome_date DATE,
    case_fatality BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
  )`,

  `CREATE INDEX IF NOT EXISTS idx_plague_cases_patient ON plague_cases(patient_id)`,
  `CREATE INDEX IF NOT EXISTS idx_plague_cases_form ON plague_cases(form)`,
  `CREATE INDEX IF NOT EXISTS idx_plague_cases_date ON plague_cases(date_reported)`,
  `CREATE INDEX IF NOT EXISTS idx_plague_cases_classification ON plague_cases(classification)`,

  // ── Yellow Fever Cases ─────────────────────────────────────────────────────
  `CREATE TABLE IF NOT EXISTS yellow_fever_cases (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_id UUID NOT NULL,
    reported_by UUID NOT NULL,
    -- Vaccination
    vaccination_status TEXT NOT NULL,    -- 'vaccinated' | 'unvaccinated' | 'unknown'
    last_vaccine_date DATE,
    icvp_number TEXT,                    -- International Certificate of Vaccination
    -- Exposure
    travel_history JSONB DEFAULT '[]',   -- [{country, city, date_from, date_to}]
    mosquito_exposure_area TEXT,         -- forest/savannah/urban
    onset_date DATE,
    date_reported DATE NOT NULL DEFAULT CURRENT_DATE,
    -- Clinical phases
    phase TEXT NOT NULL DEFAULT 'infection',  -- 'infection' | 'remission' | 'intoxication'
    jaundice_onset DATE,
    haemorrhage BOOLEAN NOT NULL DEFAULT false,
    haemorrhage_sites JSONB DEFAULT '[]', -- ['GI', 'skin', 'mucosa', 'IV_sites']
    renal_failure BOOLEAN NOT NULL DEFAULT false,
    hepatic_failure BOOLEAN NOT NULL DEFAULT false,
    -- Lab
    bilirubin_umol_l DECIMAL(6,2),
    alt_u_l DECIMAL(6,2),
    ast_u_l DECIMAL(6,2),
    creatinine_umol_l DECIMAL(6,2),
    platelet_count INTEGER,
    igm_result TEXT,                     -- 'positive' | 'negative' | 'pending'
    pcr_result TEXT,
    lab_result_date DATE,
    -- IHR Notification
    notified_district BOOLEAN NOT NULL DEFAULT false,
    notified_who BOOLEAN NOT NULL DEFAULT false,
    who_notified_at TIMESTAMP,
    who_event_id TEXT,
    -- Classification + Outcome
    classification TEXT NOT NULL DEFAULT 'suspected',
    who_severity_score TEXT,             -- 'mild' | 'moderate' | 'severe' | 'fatal'
    outcome TEXT,
    outcome_date DATE,
    case_fatality BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
  )`,

  `CREATE INDEX IF NOT EXISTS idx_yf_cases_patient ON yellow_fever_cases(patient_id)`,
  `CREATE INDEX IF NOT EXISTS idx_yf_cases_date ON yellow_fever_cases(date_reported)`,
  `CREATE INDEX IF NOT EXISTS idx_yf_cases_classification ON yellow_fever_cases(classification)`,

  // ── Meningitis Cases ───────────────────────────────────────────────────────
  `CREATE TABLE IF NOT EXISTS meningitis_cases (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_id UUID NOT NULL,
    reported_by UUID NOT NULL,
    -- Pathogen
    pathogen_suspected TEXT NOT NULL,    -- 'neisseria_meningitidis' | 'streptococcus_pneumoniae' | 'haemophilus_influenzae' | 'listeria' | 'tuberculous' | 'viral' | 'unknown'
    serogroup TEXT,                      -- for N. meningitidis: 'A' | 'B' | 'C' | 'W135' | 'X' | 'Y'
    onset_date DATE,
    date_reported DATE NOT NULL DEFAULT CURRENT_DATE,
    -- Clinical
    fever BOOLEAN NOT NULL DEFAULT true,
    neck_stiffness BOOLEAN NOT NULL DEFAULT false,
    photophobia BOOLEAN NOT NULL DEFAULT false,
    altered_consciousness BOOLEAN NOT NULL DEFAULT false,
    gcs_score INT,
    rash_type TEXT,                      -- 'petechial' | 'purpuric' | 'maculopapular' | 'none'
    rash_distribution TEXT,
    kernig_sign BOOLEAN NOT NULL DEFAULT false,
    brudzinski_sign BOOLEAN NOT NULL DEFAULT false,
    seizures BOOLEAN NOT NULL DEFAULT false,
    -- CSF Results
    csf_collected BOOLEAN NOT NULL DEFAULT false,
    csf_collection_date DATE,
    csf_appearance TEXT,                 -- 'clear' | 'turbid' | 'bloody' | 'xanthochromic'
    csf_wbc_per_mm3 INTEGER,
    csf_predominant_cell TEXT,           -- 'neutrophils' | 'lymphocytes' | 'mixed'
    csf_protein_g_l DECIMAL(5,2),
    csf_glucose_mmol_l DECIMAL(5,2),
    csf_blood_glucose_ratio DECIMAL(4,2),
    csf_gram_stain TEXT,
    csf_culture TEXT,                    -- 'positive' | 'negative' | 'pending'
    csf_pcr TEXT,
    csf_result JSONB DEFAULT '{}',       -- full structured result object
    -- Treatment
    antibiotic_given TEXT,               -- 'ceftriaxone' | 'penicillin' | 'ampicillin' | 'chloramphenicol'
    antibiotic_start_datetime TIMESTAMP,
    steroid_given BOOLEAN NOT NULL DEFAULT false,
    steroid_drug TEXT,                   -- 'dexamethasone'
    -- Contacts Chemoprophylaxis
    vaccination_status TEXT,
    chemoprophylaxis_given JSONB DEFAULT '[]',  -- [{contact_name, drug, dose, given_at}]
    contacts_notified INTEGER NOT NULL DEFAULT 0,
    -- Sequelae
    hearing_test_done BOOLEAN NOT NULL DEFAULT false,
    hearing_test_result TEXT,            -- 'normal' | 'mild_loss' | 'moderate_loss' | 'severe_loss' | 'deaf'
    neurological_sequelae JSONB DEFAULT '[]',  -- ['cognitive_impairment', 'motor_deficit', 'vision_loss']
    -- IHR
    notified_district BOOLEAN NOT NULL DEFAULT false,
    notified_national BOOLEAN NOT NULL DEFAULT false,
    notified_at TIMESTAMP,
    -- Classification + Outcome
    classification TEXT NOT NULL DEFAULT 'suspected',
    outcome TEXT,
    outcome_date DATE,
    case_fatality BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
  )`,

  `CREATE INDEX IF NOT EXISTS idx_meningitis_cases_patient ON meningitis_cases(patient_id)`,
  `CREATE INDEX IF NOT EXISTS idx_meningitis_cases_pathogen ON meningitis_cases(pathogen_suspected)`,
  `CREATE INDEX IF NOT EXISTS idx_meningitis_cases_date ON meningitis_cases(date_reported)`,

];
