export const TENANT_NTD_DEPTH_BUNDLE_VERSION = '2026.04.17.1';

export const TENANT_NTD_DEPTH_STATEMENTS: string[] = [

  // ── Leprosy Cases ──────────────────────────────────────────────────────────
  `CREATE TABLE IF NOT EXISTS leprosy_cases (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_id UUID NOT NULL,
    registered_by UUID NOT NULL,
    registration_date DATE NOT NULL DEFAULT CURRENT_DATE,
    -- WHO Classification
    classification TEXT NOT NULL,        -- 'PB' (paucibacillary, 1-5 lesions) | 'MB' (multibacillary, 6+ lesions or BL/LL)
    ridley_jopling_type TEXT,            -- 'TT' | 'BT' | 'BB' | 'BL' | 'LL' | 'pure_neural'
    -- Bacilloscopy
    bacteriological_index DECIMAL(3,1), -- 0-6 Ridley scale
    skin_smear_sites INTEGER,
    -- Disability grading (WHO 0/1/2)
    right_eye_grade INTEGER,             -- 0 = no impairment; 1 = impairment, VA>6/60; 2 = severe, VA<=6/60 or lagophthalmos
    left_eye_grade INTEGER,
    right_hand_grade INTEGER,            -- 0 = no anaesthesia; 1 = anaesthesia; 2 = visible deformity/damage
    left_hand_grade INTEGER,
    right_foot_grade INTEGER,
    left_foot_grade INTEGER,
    max_disability_grade INTEGER,        -- derived: max of all 6 sites
    -- Nerve Function Impairment
    nfi_present BOOLEAN NOT NULL DEFAULT false,
    nfi_nerves_affected JSONB DEFAULT '[]',  -- ['ulnar_right','common_peroneal_left','facial_right']
    nfi_motor_loss BOOLEAN NOT NULL DEFAULT false,
    nfi_sensory_loss BOOLEAN NOT NULL DEFAULT false,
    -- MDT Treatment
    mdt_regimen TEXT NOT NULL,           -- 'PB_6months' | 'MB_12months'
    mdt_start_date DATE,
    mdt_expected_completion DATE,        -- start + 6 or 12 months
    mdt_completed_date DATE,
    rft_date DATE,                       -- Release From Treatment
    monthly_supervised_doses INTEGER NOT NULL DEFAULT 0,   -- rifampicin+clofazimine (MB) or rifampicin (PB) at clinic
    self_administered_doses INTEGER NOT NULL DEFAULT 0,    -- dapsone ± clofazimine daily at home
    doses_missed INTEGER NOT NULL DEFAULT 0,
    -- Lepra Reactions
    reaction_type TEXT,                  -- 'type_1_reversal' | 'type_2_eni' | 'none'
    reaction_start_date DATE,
    reaction_treatment TEXT,             -- 'prednisolone' | 'thalidomide_males_only' | 'nsaid'
    reaction_dose TEXT,
    -- Contact screening
    household_contacts_screened INTEGER NOT NULL DEFAULT 0,
    -- Outcome
    outcome TEXT,                        -- 'completed_treatment' | 'defaulted' | 'transferred_out' | 'died' | 'under_treatment'
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
  )`,

  `CREATE INDEX IF NOT EXISTS idx_leprosy_patient ON leprosy_cases(patient_id)`,
  `CREATE INDEX IF NOT EXISTS idx_leprosy_classification ON leprosy_cases(classification)`,
  `CREATE INDEX IF NOT EXISTS idx_leprosy_outcome ON leprosy_cases(outcome)`,

  // ── Onchocerciasis Cases ───────────────────────────────────────────────────
  `CREATE TABLE IF NOT EXISTS onchocerciasis_cases (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_id UUID NOT NULL,
    registered_by UUID NOT NULL,
    registration_date DATE NOT NULL DEFAULT CURRENT_DATE,
    -- Diagnosis
    ov16_serology TEXT,                  -- 'positive' | 'negative' | 'pending'
    ov16_test_date DATE,
    skin_snip_result TEXT,               -- 'positive' | 'negative' | 'pending'
    skin_snip_sites TEXT,                -- 'iliac_crest_bilateral' | 'scapular'
    microfilaria_per_mg_skin DECIMAL(8,2),
    -- Clinical
    ocular_involvement BOOLEAN NOT NULL DEFAULT false,
    ocular_findings TEXT,                -- 'punctate_keratitis' | 'sclerosing_keratitis' | 'chorioretinopathy' | 'optic_atrophy'
    visual_acuity_right TEXT,
    visual_acuity_left TEXT,
    skin_disease TEXT,                   -- 'sowda' | 'lichenified' | 'depigmented_leopard' | 'pruritus_only'
    nodule_count INTEGER,
    -- MDA (Mass Drug Administration)
    ivermectin_dose_mg DECIMAL(5,2),
    mda_round INTEGER,
    last_ivermectin_date DATE,
    ivermectin_administered_by TEXT,     -- 'facility' | 'community_directed_distributor'
    adverse_reactions JSONB DEFAULT '[]', -- [{reaction, severity, date}]
    -- Programme
    cdti_village TEXT,                   -- Community-Directed Treatment with Ivermectin
    espen_programme TEXT,                -- 'APOC' | 'ESPEN' | 'national'
    -- Outcome
    follow_up_required BOOLEAN NOT NULL DEFAULT true,
    outcome TEXT,                        -- 'under_mda' | 'ocular_stabilised' | 'blind' | 'transferred'
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
  )`,

  `CREATE INDEX IF NOT EXISTS idx_oncho_patient ON onchocerciasis_cases(patient_id)`,
  `CREATE INDEX IF NOT EXISTS idx_oncho_mda_round ON onchocerciasis_cases(mda_round)`,

  // ── Filariasis Cases ───────────────────────────────────────────────────────
  `CREATE TABLE IF NOT EXISTS filariasis_cases (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_id UUID NOT NULL,
    registered_by UUID NOT NULL,
    registration_date DATE NOT NULL DEFAULT CURRENT_DATE,
    -- Disease type
    disease_type TEXT NOT NULL,          -- 'lymphatic_wuchereria' | 'lymphatic_brugia' | 'loiasis'
    -- Diagnosis
    mf_count_per_ml INTEGER,             -- microfilaria count per mL blood (crucial for Loa loa safety)
    mf_test_method TEXT,                 -- 'thick_blood_film' | 'filtration' | 'Og4C3_antigen'
    mf_test_date DATE,
    antigen_card_test TEXT,              -- 'positive' | 'negative' (for Wuchereria bancrofti)
    -- Clinical (Lymphatic Filariasis)
    lymphoedema_stage INTEGER,           -- 0-7 Dreyer staging: 0=none, 1=reversible swelling, 7=mossy foot
    lymphoedema_sites JSONB DEFAULT '[]', -- ['left_leg','right_leg','left_arm','scrotum','breast']
    hydrocele BOOLEAN NOT NULL DEFAULT false,
    hydrocele_side TEXT,                 -- 'left' | 'right' | 'bilateral'
    acute_adenolymphangitis_episodes INTEGER NOT NULL DEFAULT 0,
    -- Clinical (Loiasis specific)
    calabar_swelling BOOLEAN NOT NULL DEFAULT false,
    subconjunctival_worm BOOLEAN NOT NULL DEFAULT false,
    loa_loa_mf_count INTEGER,            -- separate field — safety threshold for ivermectin/DEC
    -- MDA / Treatment
    dec_dose_mg DECIMAL(6,2),            -- diethylcarbamazine — CONTRAINDICATED in loiasis if MF >8000
    albendazole_dose_mg DECIMAL(6,2),
    ivermectin_dose_mg DECIMAL(6,2),
    mda_round INTEGER,
    last_treatment_date DATE,
    treatment_safe BOOLEAN,              -- CDSS-computed safety flag
    treatment_contraindication TEXT,     -- free text if unsafe
    -- Morbidity Management
    lymphoedema_hygiene_education BOOLEAN NOT NULL DEFAULT false,
    hydrocelectomy_referral BOOLEAN NOT NULL DEFAULT false,
    -- Programme
    espen_programme TEXT,
    -- Outcome
    outcome TEXT,                        -- 'under_mda' | 'lymphoedema_managed' | 'hydrocele_operated' | 'transferred'
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
  )`,

  `CREATE INDEX IF NOT EXISTS idx_filariasis_patient ON filariasis_cases(patient_id)`,
  `CREATE INDEX IF NOT EXISTS idx_filariasis_type ON filariasis_cases(disease_type)`,

];
