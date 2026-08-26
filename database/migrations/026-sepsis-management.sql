-- Migration 022: Sepsis Management & SEP-1 Bundle
-- Date: December 4, 2025
-- Description: Adds sepsis screening, SEP-1 bundle tracking, and outcomes monitoring.

-- =====================================================================================================================
-- 1. sepsis_screenings Table
--    Sepsis screening (qSOFA, SIRS criteria)
-- =====================================================================================================================
CREATE TABLE IF NOT EXISTS sepsis_screenings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  patient_id UUID NOT NULL REFERENCES patients(id),
  admission_id UUID REFERENCES admissions(id),
  
  -- Screening Time
  screening_datetime TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  screening_location VARCHAR(100), -- ED, ICU, Floor
  
  -- qSOFA Score (Quick Sequential Organ Failure Assessment)
  qsofa_altered_mental_status BOOLEAN DEFAULT false,
  qsofa_systolic_bp_low BOOLEAN DEFAULT false, -- SBP ≤100
  qsofa_respiratory_rate_high BOOLEAN DEFAULT false, -- RR ≥22
  qsofa_score INTEGER CHECK (qsofa_score BETWEEN 0 AND 3),
  
  -- SIRS Criteria (Systemic Inflammatory Response Syndrome)
  sirs_temp_abnormal BOOLEAN DEFAULT false, -- <36°C or >38°C
  sirs_heart_rate_high BOOLEAN DEFAULT false, -- >90
  sirs_respiratory_rate_high BOOLEAN DEFAULT false, -- >20
  sirs_wbc_abnormal BOOLEAN DEFAULT false, -- <4K or >12K
  sirs_score INTEGER CHECK (sirs_score BETWEEN 0 AND 4),
  
  -- Vitals at Screening
  temperature DECIMAL(4, 2),
  heart_rate INTEGER,
  respiratory_rate INTEGER,
  systolic_bp INTEGER,
  oxygen_saturation INTEGER,
  
  -- Lab Values
  wbc_count DECIMAL(5, 2),
  lactate DECIMAL(4, 2),
  
  -- Risk Assessment
  sepsis_suspected BOOLEAN DEFAULT false,
  severe_sepsis BOOLEAN DEFAULT false,
  septic_shock BOOLEAN DEFAULT false,
  
  -- Actions
  sepsis_alert_triggered BOOLEAN DEFAULT false,
  sepsis_bundle_initiated BOOLEAN DEFAULT false,
  
  -- Screened By
  screened_by UUID NOT NULL REFERENCES users(id),
  
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sepsis_screening_patient ON sepsis_screenings(patient_id);
CREATE INDEX IF NOT EXISTS idx_sepsis_screening_datetime ON sepsis_screenings(screening_datetime);
CREATE INDEX IF NOT EXISTS idx_sepsis_screening_suspected ON sepsis_screenings(sepsis_suspected);

-- =====================================================================================================================
-- 2. sepsis_bundles Table
--    SEP-1 bundle compliance tracking (CMS core measure)
-- =====================================================================================================================
CREATE TABLE IF NOT EXISTS sepsis_bundles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  patient_id UUID NOT NULL REFERENCES patients(id),
  admission_id UUID REFERENCES admissions(id),
  sepsis_screening_id UUID REFERENCES sepsis_screenings(id),
  
  -- Bundle Start (Time Zero)
  bundle_start_time TIMESTAMP WITH TIME ZONE NOT NULL,
  
  -- 3-Hour Bundle Elements
  lactate_measured BOOLEAN DEFAULT false,
  lactate_measurement_time TIMESTAMP WITH TIME ZONE,
  lactate_value DECIMAL(4, 2),
  
  blood_cultures_drawn BOOLEAN DEFAULT false,
  blood_cultures_time TIMESTAMP WITH TIME ZONE,
  
  broad_spectrum_antibiotics_given BOOLEAN DEFAULT false,
  antibiotics_time TIMESTAMP WITH TIME ZONE,
  antibiotic_name VARCHAR(255),
  
  fluid_bolus_given BOOLEAN DEFAULT false,
  fluid_bolus_time TIMESTAMP WITH TIME ZONE,
  fluid_volume_ml INTEGER,
  
  -- 6-Hour Bundle Elements (if hypotension or lactate >4)
  vasopressors_initiated BOOLEAN DEFAULT false,
  vasopressors_time TIMESTAMP WITH TIME ZONE,
  vasopressor_name VARCHAR(255),
  
  repeat_lactate_measured BOOLEAN DEFAULT false,
  repeat_lactate_time TIMESTAMP WITH TIME ZONE,
  repeat_lactate_value DECIMAL(4, 2),
  
  -- Compliance
  three_hour_bundle_complete BOOLEAN DEFAULT false,
  three_hour_compliance_time TIMESTAMP WITH TIME ZONE,
  
  six_hour_bundle_complete BOOLEAN DEFAULT false,
  six_hour_compliance_time TIMESTAMP WITH TIME ZONE,
  
  overall_compliance BOOLEAN DEFAULT false,
  
  -- Outcome
  patient_outcome VARCHAR(50) CHECK (patient_outcome IN ('improved', 'stable', 'deteriorated', 'deceased', 'transferred')),
  outcome_date DATE,
  
  -- Bundle Coordinator
  managed_by UUID REFERENCES users(id),
  
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sepsis_bundle_patient ON sepsis_bundles(patient_id);
CREATE INDEX IF NOT EXISTS idx_sepsis_bundle_start ON sepsis_bundles(bundle_start_time);
CREATE INDEX IF NOT EXISTS idx_sepsis_bundle_compliance ON sepsis_bundles(overall_compliance);

-- Comments
COMMENT ON TABLE sepsis_screenings IS 'Sepsis screening using qSOFA and SIRS criteria';
COMMENT ON TABLE sepsis_bundles IS 'SEP-1 bundle tracking for CMS core measure compliance';

COMMENT ON COLUMN sepsis_screenings.qsofa_score IS 'qSOFA ≥2 indicates increased risk of mortality';
COMMENT ON COLUMN sepsis_bundles.bundle_start_time IS 'Time zero for bundle - when sepsis first recognized';
COMMENT ON COLUMN sepsis_bundles.three_hour_bundle_complete IS 'Lactate, blood cultures, antibiotics, and fluids within 3 hours';




