-- Migration 014: Infection Control & Hospital Epidemiology
-- Date: December 4, 2025
-- Description: Adds comprehensive infection surveillance, HAI tracking, antimicrobial stewardship, and outbreak detection.

-- =====================================================================================================================
-- 1. infection_surveillance Table
--    Hospital-acquired infection (HAI) tracking and surveillance
-- =====================================================================================================================
CREATE TABLE IF NOT EXISTS infection_surveillance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  patient_id UUID NOT NULL REFERENCES patients(id),
  admission_id UUID REFERENCES admissions(id),
  
  -- Infection Details
  infection_type VARCHAR(100) NOT NULL CHECK (infection_type IN (
    'CAUTI', 'CLABSI', 'SSI', 'VAP', 'CDI', 'MRSA', 'VRE', 'CRE', 'Other'
  )),
  infection_site VARCHAR(100),
  infection_date DATE NOT NULL,
  
  -- Classification
  onset_type VARCHAR(50) CHECK (onset_type IN ('community_acquired', 'hospital_acquired', 'healthcare_associated')),
  days_since_admission INTEGER,
  
  -- Microbiology
  organism VARCHAR(255),
  culture_source VARCHAR(100),
  culture_date DATE,
  antibiotic_resistance JSONB DEFAULT '[]'::jsonb, -- List of resistant antibiotics
  
  -- Risk Factors
  risk_factors JSONB DEFAULT '[]'::jsonb, -- Central line, catheter, ventilator, surgery, etc.
  device_associated BOOLEAN DEFAULT false,
  device_type VARCHAR(100),
  
  -- ICD-10 Coding
  infection_icd10 VARCHAR(10),
  
  -- Severity
  severity VARCHAR(50) CHECK (severity IN ('mild', 'moderate', 'severe', 'sepsis', 'septic_shock')),
  
  -- Outcome
  resolved BOOLEAN DEFAULT false,
  resolution_date DATE,
  outcome VARCHAR(50) CHECK (outcome IN ('resolved', 'ongoing', 'transferred', 'deceased')),
  
  -- Reporting
  reported_to_cdc BOOLEAN DEFAULT false,
  reported_date DATE,
  
  -- Investigation
  investigated BOOLEAN DEFAULT false,
  investigation_notes TEXT,
  root_cause TEXT,
  
  -- Detected By
  detected_by UUID REFERENCES users(id),
  detected_date DATE DEFAULT CURRENT_DATE,
  
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_infection_patient ON infection_surveillance(patient_id);
CREATE INDEX IF NOT EXISTS idx_infection_type ON infection_surveillance(infection_type);
CREATE INDEX IF NOT EXISTS idx_infection_date ON infection_surveillance(infection_date);
CREATE INDEX IF NOT EXISTS idx_infection_onset ON infection_surveillance(onset_type);

-- =====================================================================================================================
-- 2. isolation_precautions Table
--    Isolation tracking for infectious patients
-- =====================================================================================================================
CREATE TABLE IF NOT EXISTS isolation_precautions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  patient_id UUID NOT NULL REFERENCES patients(id),
  admission_id UUID REFERENCES admissions(id),
  
  -- Isolation Type
  isolation_type VARCHAR(50) NOT NULL CHECK (isolation_type IN (
    'standard', 'contact', 'droplet', 'airborne', 'contact_plus', 'protective'
  )),
  
  -- Reason
  reason TEXT NOT NULL,
  organism VARCHAR(255),
  infection_icd10 VARCHAR(10),
  
  -- Timing
  start_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  end_date TIMESTAMP WITH TIME ZONE,
  
  -- Location
  room_number VARCHAR(50),
  bed_number VARCHAR(50),
  
  -- PPE Requirements
  ppe_required JSONB DEFAULT '[]'::jsonb, -- Gown, gloves, mask, N95, eye protection, etc.
  
  -- Status
  status VARCHAR(50) DEFAULT 'active' CHECK (status IN ('active', 'discontinued', 'transferred')),
  
  -- Orders
  ordered_by UUID NOT NULL REFERENCES users(id),
  discontinued_by UUID REFERENCES users(id),
  discontinuation_reason TEXT,
  
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_isolation_patient ON isolation_precautions(patient_id);
CREATE INDEX IF NOT EXISTS idx_isolation_type ON isolation_precautions(isolation_type);
CREATE INDEX IF NOT EXISTS idx_isolation_status ON isolation_precautions(status);

-- =====================================================================================================================
-- 3. antimicrobial_stewardship Table
--    Antibiotic usage tracking and stewardship
-- =====================================================================================================================
CREATE TABLE IF NOT EXISTS antimicrobial_stewardship (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  patient_id UUID NOT NULL REFERENCES patients(id),
  prescription_id UUID REFERENCES prescriptions(id),
  
  -- Antibiotic Details
  antibiotic_name VARCHAR(255) NOT NULL,
  antibiotic_class VARCHAR(100),
  dose VARCHAR(100),
  route VARCHAR(50),
  frequency VARCHAR(100),
  
  -- Indication
  indication TEXT NOT NULL,
  indication_icd10 VARCHAR(10),
  empiric_or_targeted VARCHAR(50) CHECK (empiric_or_targeted IN ('empiric', 'targeted', 'prophylactic')),
  
  -- Culture Data
  culture_sent BOOLEAN DEFAULT false,
  culture_source VARCHAR(100),
  culture_result TEXT,
  organism_identified VARCHAR(255),
  sensitivity_profile JSONB,
  
  -- Duration
  start_date DATE NOT NULL,
  planned_duration_days INTEGER,
  actual_stop_date DATE,
  total_days_given INTEGER,
  
  -- Stewardship Review
  review_required BOOLEAN DEFAULT false,
  review_date DATE,
  reviewed_by UUID REFERENCES users(id),
  stewardship_recommendation TEXT,
  recommendation_followed BOOLEAN,
  
  -- Appropriateness
  appropriate_indication BOOLEAN,
  appropriate_dose BOOLEAN,
  appropriate_duration BOOLEAN,
  de_escalation_opportunity BOOLEAN DEFAULT false,
  de_escalation_notes TEXT,
  
  -- Prescriber
  prescribed_by UUID NOT NULL REFERENCES users(id),
  
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_antimicrobial_patient ON antimicrobial_stewardship(patient_id);
CREATE INDEX IF NOT EXISTS idx_antimicrobial_antibiotic ON antimicrobial_stewardship(antibiotic_name);
CREATE INDEX IF NOT EXISTS idx_antimicrobial_start_date ON antimicrobial_stewardship(start_date);

-- =====================================================================================================================
-- 4. outbreak_alerts Table
--    Outbreak detection and alert management
-- =====================================================================================================================
CREATE TABLE IF NOT EXISTS outbreak_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Outbreak Details
  outbreak_name VARCHAR(255) NOT NULL,
  organism VARCHAR(255),
  infection_type VARCHAR(100),
  
  -- Detection
  detection_date DATE NOT NULL,
  detection_method VARCHAR(100), -- Automated threshold, manual report, etc.
  
  -- Scope
  ward_location VARCHAR(100),
  affected_patient_count INTEGER DEFAULT 0,
  staff_affected_count INTEGER DEFAULT 0,
  
  -- Status
  alert_level VARCHAR(50) CHECK (alert_level IN ('watch', 'alert', 'outbreak', 'resolved')),
  status VARCHAR(50) DEFAULT 'active' CHECK (status IN ('active', 'monitoring', 'contained', 'resolved')),
  
  -- Investigation
  investigation_started BOOLEAN DEFAULT false,
  investigation_lead UUID REFERENCES users(id),
  root_cause TEXT,
  
  -- Interventions
  interventions_implemented JSONB DEFAULT '[]'::jsonb,
  
  -- Resolution
  resolved_date DATE,
  lessons_learned TEXT,
  
  -- Reporting
  reported_to_health_department BOOLEAN DEFAULT false,
  report_date DATE,
  
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_outbreak_date ON outbreak_alerts(detection_date);
CREATE INDEX IF NOT EXISTS idx_outbreak_status ON outbreak_alerts(status);
CREATE INDEX IF NOT EXISTS idx_outbreak_level ON outbreak_alerts(alert_level);

-- =====================================================================================================================
-- 5. hand_hygiene_compliance Table
--    Hand hygiene monitoring and compliance tracking
-- =====================================================================================================================
CREATE TABLE IF NOT EXISTS hand_hygiene_compliance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Observation
  observation_date DATE NOT NULL,
  observation_time TIME NOT NULL,
  location VARCHAR(100) NOT NULL,
  
  -- Staff
  staff_id UUID REFERENCES users(id),
  staff_role VARCHAR(50), -- Doctor, Nurse, etc.
  
  -- Opportunity (WHO 5 Moments)
  opportunity_type VARCHAR(50) CHECK (opportunity_type IN (
    'before_patient_contact',
    'before_aseptic_procedure',
    'after_body_fluid_exposure',
    'after_patient_contact',
    'after_patient_surroundings'
  )),
  
  -- Compliance
  hand_hygiene_performed BOOLEAN NOT NULL,
  method_used VARCHAR(50) CHECK (method_used IN ('soap_and_water', 'alcohol_rub', 'none')),
  
  -- Observer
  observed_by UUID REFERENCES users(id),
  
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_hand_hygiene_date ON hand_hygiene_compliance(observation_date);
CREATE INDEX IF NOT EXISTS idx_hand_hygiene_staff ON hand_hygiene_compliance(staff_id);
CREATE INDEX IF NOT EXISTS idx_hand_hygiene_compliance ON hand_hygiene_compliance(hand_hygiene_performed);

-- Comments for documentation
COMMENT ON TABLE infection_surveillance IS 'Hospital-acquired infection tracking and surveillance';
COMMENT ON TABLE isolation_precautions IS 'Isolation tracking for infectious patients with PPE requirements';
COMMENT ON TABLE antimicrobial_stewardship IS 'Antibiotic usage tracking and stewardship program';
COMMENT ON TABLE outbreak_alerts IS 'Outbreak detection and management';
COMMENT ON TABLE hand_hygiene_compliance IS 'Hand hygiene monitoring and compliance tracking (WHO 5 Moments)';

COMMENT ON COLUMN infection_surveillance.infection_type IS 'CAUTI=Catheter-associated UTI, CLABSI=Central line-associated BSI, SSI=Surgical site infection, VAP=Ventilator-associated pneumonia, CDI=C. difficile infection';
COMMENT ON COLUMN isolation_precautions.isolation_type IS 'Standard, Contact (MRSA, VRE, CDI), Droplet (flu, COVID), Airborne (TB, measles), Protective (neutropenic)';




