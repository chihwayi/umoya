-- Migration 011: Anesthesia Module
-- Date: December 4, 2025
-- Description: Adds comprehensive anesthesia documentation from pre-op assessment through PACU discharge, including ASA billing.

-- =====================================================================================================================
-- 1. pre_anesthesia_assessments Table
--    Pre-operative anesthesia evaluation and planning
-- =====================================================================================================================
CREATE TABLE IF NOT EXISTS pre_anesthesia_assessments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  surgical_case_id UUID NOT NULL REFERENCES surgical_cases(id),
  patient_id UUID NOT NULL REFERENCES patients(id),
  
  -- ASA Physical Status Classification
  asa_status VARCHAR(10) CHECK (asa_status IN ('I', 'II', 'III', 'IV', 'V', 'VI', 'E')),
  asa_modifier VARCHAR(10), -- E = Emergency
  
  -- Airway Assessment
  mallampati_score INTEGER CHECK (mallampati_score BETWEEN 1 AND 4),
  mouth_opening VARCHAR(20),
  neck_mobility VARCHAR(50),
  thyromental_distance VARCHAR(20),
  dentition VARCHAR(100),
  airway_risk VARCHAR(20) CHECK (airway_risk IN ('low', 'moderate', 'high')),
  
  -- Cardiovascular
  cardiac_history TEXT,
  cardiac_exam_findings TEXT,
  ecg_findings TEXT,
  recent_ecg_date DATE,
  
  -- Respiratory
  respiratory_history TEXT,
  respiratory_exam_findings TEXT,
  chest_xray_findings TEXT,
  recent_cxr_date DATE,
  
  -- Lab Values
  hemoglobin DECIMAL(4, 1),
  platelet_count INTEGER,
  inr DECIMAL(3, 2),
  creatinine DECIMAL(4, 2),
  glucose INTEGER,
  recent_labs_date DATE,
  
  -- Allergies & Medications
  drug_allergies JSONB DEFAULT '[]'::jsonb,
  current_medications JSONB DEFAULT '[]'::jsonb,
  last_oral_intake TIMESTAMP WITH TIME ZONE,
  npo_status BOOLEAN DEFAULT false,
  
  -- Anesthesia Plan
  planned_anesthesia_type VARCHAR(50) CHECK (planned_anesthesia_type IN 
    ('general', 'regional', 'spinal', 'epidural', 'MAC', 'local', 'combined')),
  planned_airway VARCHAR(50) CHECK (planned_airway IN 
    ('ETT', 'LMA', 'spontaneous', 'mask', 'nasal_cannula')),
  special_considerations TEXT,
  
  -- Risk Assessment
  anesthesia_risk VARCHAR(20) CHECK (anesthesia_risk IN ('low', 'moderate', 'high', 'very_high')),
  risk_factors TEXT,
  
  -- Comorbidities (ICD-10 codes)
  comorbidities JSONB DEFAULT '[]'::jsonb, -- Array of {code, description}
  
  -- Consent
  anesthesia_consent_obtained BOOLEAN DEFAULT false,
  consent_obtained_by UUID REFERENCES users(id),
  consent_obtained_at TIMESTAMP WITH TIME ZONE,
  
  -- Assessment
  assessed_by UUID NOT NULL REFERENCES users(id),
  assessed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_preanesthesia_case ON pre_anesthesia_assessments(surgical_case_id);
CREATE INDEX IF NOT EXISTS idx_preanesthesia_patient ON pre_anesthesia_assessments(patient_id);
CREATE INDEX IF NOT EXISTS idx_preanesthesia_assessor ON pre_anesthesia_assessments(assessed_by);

-- =====================================================================================================================
-- 2. anesthesia_records Table
--    Intraoperative anesthesia documentation
-- =====================================================================================================================
CREATE TABLE IF NOT EXISTS anesthesia_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  surgical_case_id UUID NOT NULL REFERENCES surgical_cases(id),
  patient_id UUID NOT NULL REFERENCES patients(id),
  
  -- Times
  anesthesia_start_time TIMESTAMP WITH TIME ZONE NOT NULL,
  anesthesia_end_time TIMESTAMP WITH TIME ZONE,
  surgery_start_time TIMESTAMP WITH TIME ZONE,
  surgery_end_time TIMESTAMP WITH TIME ZONE,
  
  -- Anesthesia Type
  anesthesia_type VARCHAR(50) NOT NULL,
  airway_management VARCHAR(50),
  ett_size VARCHAR(10),
  ett_depth VARCHAR(10),
  
  -- Induction
  induction_medications JSONB DEFAULT '[]'::jsonb,
  induction_notes TEXT,
  
  -- Maintenance
  maintenance_technique VARCHAR(50) CHECK (maintenance_technique IN 
    ('inhalational', 'TIVA', 'balanced', 'regional')),
  maintenance_agents JSONB DEFAULT '[]'::jsonb,
  
  -- Monitoring
  monitors_used JSONB DEFAULT '["ECG", "NIBP", "SpO2", "EtCO2", "Temp"]'::jsonb,
  
  -- Medications Given (detailed)
  medications_administered JSONB DEFAULT '[]'::jsonb,
  /* Format: [{
    time: "10:30",
    medication: "Fentanyl",
    dose: "100",
    unit: "mcg",
    route: "IV",
    givenBy: "userId"
  }] */
  
  -- Fluids
  crystalloids_ml INTEGER DEFAULT 0,
  colloids_ml INTEGER DEFAULT 0,
  blood_products JSONB DEFAULT '[]'::jsonb,
  
  -- Blood Loss & Output
  estimated_blood_loss INTEGER, -- mL
  urine_output INTEGER, -- mL
  drain_output INTEGER, -- mL
  
  -- Ventilation
  ventilation_mode VARCHAR(50),
  fio2 DECIMAL(3, 2),
  tidal_volume INTEGER,
  respiratory_rate INTEGER,
  peep INTEGER,
  
  -- Events & Complications
  intraop_events JSONB DEFAULT '[]'::jsonb,
  complications TEXT,
  
  -- Emergence
  emergence_time TIMESTAMP WITH TIME ZONE,
  extubation_time TIMESTAMP WITH TIME ZONE,
  emergence_medications JSONB DEFAULT '[]'::jsonb,
  emergence_notes TEXT,
  
  -- Staff
  anesthesiologist_id UUID NOT NULL REFERENCES users(id),
  crna_id UUID REFERENCES users(id), -- Certified Registered Nurse Anesthetist
  
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_anesthesia_record_case ON anesthesia_records(surgical_case_id);
CREATE INDEX IF NOT EXISTS idx_anesthesia_record_patient ON anesthesia_records(patient_id);
CREATE INDEX IF NOT EXISTS idx_anesthesia_record_provider ON anesthesia_records(anesthesiologist_id);

-- =====================================================================================================================
-- 3. anesthesia_vitals Table
--    Real-time vitals charting during anesthesia (every 5 minutes)
-- =====================================================================================================================
CREATE TABLE IF NOT EXISTS anesthesia_vitals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  anesthesia_record_id UUID NOT NULL REFERENCES anesthesia_records(id) ON DELETE CASCADE,
  
  chart_time TIMESTAMP WITH TIME ZONE NOT NULL,
  
  -- Cardiovascular
  heart_rate INTEGER,
  blood_pressure_systolic INTEGER,
  blood_pressure_diastolic INTEGER,
  blood_pressure_mean INTEGER,
  
  -- Respiratory
  respiratory_rate INTEGER,
  spo2 INTEGER, -- SpO2 percentage
  etco2 INTEGER, -- End-tidal CO2
  
  -- Temperature
  temperature DECIMAL(4, 2),
  
  -- Anesthesia Depth
  bis_value INTEGER, -- Bispectral Index (0-100)
  mac DECIMAL(3, 2), -- Minimum Alveolar Concentration
  
  -- Notes
  notes TEXT,
  
  recorded_by UUID REFERENCES users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  UNIQUE(anesthesia_record_id, chart_time)
);

CREATE INDEX IF NOT EXISTS idx_anesthesia_vitals_record ON anesthesia_vitals(anesthesia_record_id);
CREATE INDEX IF NOT EXISTS idx_anesthesia_vitals_time ON anesthesia_vitals(chart_time);

-- =====================================================================================================================
-- 4. pacu_records Table
--    Post-anesthesia care unit documentation with Aldrete scoring
-- =====================================================================================================================
CREATE TABLE IF NOT EXISTS pacu_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  surgical_case_id UUID NOT NULL REFERENCES surgical_cases(id),
  patient_id UUID NOT NULL REFERENCES patients(id),
  anesthesia_record_id UUID REFERENCES anesthesia_records(id),
  
  -- Arrival
  arrival_time TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  arrival_from VARCHAR(50) DEFAULT 'OR',
  
  -- Aldrete Score (0-10, ≥9 for discharge)
  aldrete_score_admission INTEGER CHECK (aldrete_score_admission BETWEEN 0 AND 10),
  aldrete_score_discharge INTEGER CHECK (aldrete_score_discharge BETWEEN 0 AND 10),
  
  /* Aldrete Components (each 0-2):
     - Activity (muscle movement)
     - Respiration
     - Circulation (BP)
     - Consciousness
     - O2 Saturation
  */
  aldrete_components JSONB,
  
  -- Pain Assessment
  pain_score_admission INTEGER CHECK (pain_score_admission BETWEEN 0 AND 10),
  pain_score_discharge INTEGER CHECK (pain_score_discharge BETWEEN 0 AND 10),
  pain_management JSONB DEFAULT '[]'::jsonb,
  
  -- Nausea/Vomiting
  ponv_score INTEGER CHECK (ponv_score BETWEEN 0 AND 3), -- Post-op nausea/vomiting
  antiemetics_given JSONB DEFAULT '[]'::jsonb,
  
  -- Complications
  complications TEXT,
  interventions JSONB DEFAULT '[]'::jsonb,
  
  -- Discharge
  discharge_time TIMESTAMP WITH TIME ZONE,
  discharged_to VARCHAR(50) CHECK (discharged_to IN ('floor', 'icu', 'stepdown', 'home', 'observation')),
  discharge_criteria_met BOOLEAN DEFAULT false,
  
  -- Staff
  pacu_nurse_id UUID REFERENCES users(id),
  discharge_approved_by UUID REFERENCES users(id),
  
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pacu_case ON pacu_records(surgical_case_id);
CREATE INDEX IF NOT EXISTS idx_pacu_patient ON pacu_records(patient_id);
CREATE INDEX IF NOT EXISTS idx_pacu_nurse ON pacu_records(pacu_nurse_id);

-- =====================================================================================================================
-- 5. anesthesia_billing Table
--    Anesthesia billing with ASA base units and time units
-- =====================================================================================================================
CREATE TABLE IF NOT EXISTS anesthesia_billing (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  surgical_case_id UUID NOT NULL REFERENCES surgical_cases(id),
  anesthesia_record_id UUID REFERENCES anesthesia_records(id),
  
  -- Billing Codes
  base_units INTEGER NOT NULL, -- ASA base units for procedure
  time_units DECIMAL(4, 2) NOT NULL, -- 15-minute increments
  modifying_units INTEGER DEFAULT 0, -- Physical status, emergency, etc.
  total_units DECIMAL(5, 2) GENERATED ALWAYS AS (base_units + time_units + modifying_units) STORED,
  
  -- CPT Codes
  anesthesia_cpt_code VARCHAR(10),
  modifiers VARCHAR(20), -- e.g., "P3, 23" (Physical status 3, Unusual anesthesia)
  
  -- Time Calculations
  anesthesia_start TIMESTAMP WITH TIME ZONE NOT NULL,
  anesthesia_end TIMESTAMP WITH TIME ZONE NOT NULL,
  total_minutes INTEGER GENERATED ALWAYS AS (
    EXTRACT(EPOCH FROM (anesthesia_end - anesthesia_start))/60
  ) STORED,
  
  -- Additional Services
  additional_procedures JSONB DEFAULT '[]'::jsonb, -- Central lines, arterial lines, etc.
  
  -- Billing
  conversion_factor DECIMAL(8, 2) DEFAULT 22.00, -- $ per unit
  total_charge DECIMAL(10, 2) GENERATED ALWAYS AS (
    (base_units + time_units + modifying_units) * conversion_factor
  ) STORED,
  
  billed_at TIMESTAMP WITH TIME ZONE,
  billed_by UUID REFERENCES users(id),
  
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_anesthesia_billing_case ON anesthesia_billing(surgical_case_id);

-- Comments for documentation
COMMENT ON TABLE pre_anesthesia_assessments IS 'Pre-operative anesthesia evaluation and planning';
COMMENT ON TABLE anesthesia_records IS 'Intraoperative anesthesia documentation';
COMMENT ON TABLE anesthesia_vitals IS 'Real-time vitals charting during anesthesia (every 5 minutes)';
COMMENT ON TABLE pacu_records IS 'Post-anesthesia care unit documentation with Aldrete scoring';
COMMENT ON TABLE anesthesia_billing IS 'Anesthesia billing with ASA base units and time units';

COMMENT ON COLUMN pre_anesthesia_assessments.asa_status IS 'ASA Physical Status: I=Normal, II=Mild systemic disease, III=Severe systemic disease, IV=Severe systemic disease that is constant threat to life, V=Moribund, VI=Brain dead, E=Emergency modifier';
COMMENT ON COLUMN pacu_records.aldrete_score_discharge IS 'Aldrete Score ≥9 required for PACU discharge';

