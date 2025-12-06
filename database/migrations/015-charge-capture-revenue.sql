-- Migration 015: Charge Capture & Revenue Cycle Management
-- Date: December 4, 2025
-- Description: Adds comprehensive charge capture, DRG calculation, and revenue cycle management.

-- =====================================================================================================================
-- 1. charge_master Table
--    Hospital charge master (fee schedule)
-- =====================================================================================================================
CREATE TABLE IF NOT EXISTS charge_master (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Charge Details
  charge_code VARCHAR(50) UNIQUE NOT NULL,
  charge_description TEXT NOT NULL,
  
  -- Coding
  cpt_code VARCHAR(10),
  hcpcs_code VARCHAR(10),
  revenue_code VARCHAR(10),
  
  -- Pricing
  standard_charge DECIMAL(10, 2) NOT NULL,
  medicare_rate DECIMAL(10, 2),
  medicaid_rate DECIMAL(10, 2),
  
  -- Department
  department VARCHAR(100),
  service_category VARCHAR(100),
  
  -- Billing
  billable BOOLEAN DEFAULT true,
  
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_charge_master_code ON charge_master(charge_code);
CREATE INDEX IF NOT EXISTS idx_charge_master_cpt ON charge_master(cpt_code);
CREATE INDEX IF NOT EXISTS idx_charge_master_department ON charge_master(department);

-- =====================================================================================================================
-- 2. patient_charges Table
--    Individual charges posted to patient accounts
-- =====================================================================================================================
CREATE TABLE IF NOT EXISTS patient_charges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  patient_id UUID NOT NULL REFERENCES patients(id),
  admission_id UUID REFERENCES admissions(id),
  
  -- Charge Details
  charge_code VARCHAR(50) NOT NULL,
  charge_description TEXT NOT NULL,
  quantity DECIMAL(10, 2) DEFAULT 1,
  unit_price DECIMAL(10, 2) NOT NULL,
  total_charge DECIMAL(10, 2) GENERATED ALWAYS AS (quantity * unit_price) STORED,
  
  -- Service Date
  service_date DATE NOT NULL,
  
  -- Source (auto-captured)
  source_type VARCHAR(100), -- prescription, lab_order, surgical_case, etc.
  source_id UUID,
  
  -- Coding
  cpt_code VARCHAR(10),
  icd10_code VARCHAR(10),
  
  -- Department
  department VARCHAR(100),
  ordering_provider UUID REFERENCES users(id),
  
  -- Billing Status
  charge_status VARCHAR(50) DEFAULT 'pending' CHECK (charge_status IN 
    ('pending', 'reviewed', 'billed', 'paid', 'adjusted', 'written_off')),
  
  -- Capture Method
  capture_method VARCHAR(50) CHECK (capture_method IN ('automatic', 'manual', 'imported')),
  captured_by UUID REFERENCES users(id),
  captured_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_patient_charges_patient ON patient_charges(patient_id);
CREATE INDEX IF NOT EXISTS idx_patient_charges_admission ON patient_charges(admission_id);
CREATE INDEX IF NOT EXISTS idx_patient_charges_service_date ON patient_charges(service_date);
CREATE INDEX IF NOT EXISTS idx_patient_charges_status ON patient_charges(charge_status);

-- =====================================================================================================================
-- 3. drg_assignments Table
--    DRG (Diagnosis-Related Group) assignment for inpatient billing
-- =====================================================================================================================
CREATE TABLE IF NOT EXISTS drg_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  admission_id UUID NOT NULL REFERENCES admissions(id),
  patient_id UUID NOT NULL REFERENCES patients(id),
  
  -- DRG Details
  drg_code VARCHAR(10) NOT NULL,
  drg_description TEXT NOT NULL,
  drg_weight DECIMAL(6, 4),
  
  -- Principal Diagnosis
  principal_diagnosis_icd10 VARCHAR(10) NOT NULL,
  principal_diagnosis_description TEXT,
  
  -- Secondary Diagnoses
  secondary_diagnoses JSONB DEFAULT '[]'::jsonb, -- Array of {code, description}
  
  -- Procedures
  procedures JSONB DEFAULT '[]'::jsonb, -- Array of {code, description, date}
  
  -- Complications & Comorbidities
  has_cc BOOLEAN DEFAULT false, -- Complication/Comorbidity
  has_mcc BOOLEAN DEFAULT false, -- Major Complication/Comorbidity
  cc_mcc_list JSONB DEFAULT '[]'::jsonb,
  
  -- Severity & Mortality
  severity_of_illness VARCHAR(20) CHECK (severity_of_illness IN ('minor', 'moderate', 'major', 'extreme')),
  risk_of_mortality VARCHAR(20) CHECK (risk_of_mortality IN ('minor', 'moderate', 'major', 'extreme')),
  
  -- Payment
  base_rate DECIMAL(10, 2),
  calculated_payment DECIMAL(10, 2) GENERATED ALWAYS AS (base_rate * drg_weight) STORED,
  
  -- Assignment
  assigned_date DATE DEFAULT CURRENT_DATE,
  assigned_by UUID REFERENCES users(id),
  assignment_method VARCHAR(50) CHECK (assignment_method IN ('automatic', 'coder_assigned', 'cdi_assigned')),
  
  -- Status
  status VARCHAR(50) DEFAULT 'working' CHECK (status IN ('working', 'final', 'appealed', 'adjusted')),
  
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_drg_admission ON drg_assignments(admission_id);
CREATE INDEX IF NOT EXISTS idx_drg_patient ON drg_assignments(patient_id);
CREATE INDEX IF NOT EXISTS idx_drg_code ON drg_assignments(drg_code);

-- =====================================================================================================================
-- 4. missed_charges Table
--    Tracking of potentially missed charges for reconciliation
-- =====================================================================================================================
CREATE TABLE IF NOT EXISTS missed_charges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  patient_id UUID NOT NULL REFERENCES patients(id),
  admission_id UUID REFERENCES admissions(id),
  
  -- Potential Charge
  potential_charge_code VARCHAR(50),
  potential_charge_description TEXT,
  estimated_amount DECIMAL(10, 2),
  
  -- Source
  source_type VARCHAR(100) NOT NULL, -- prescription, lab_order, surgical_implant, etc.
  source_id UUID,
  service_date DATE NOT NULL,
  
  -- Detection
  detected_by VARCHAR(50) DEFAULT 'system' CHECK (detected_by IN ('system', 'auditor', 'cdi_specialist')),
  detected_date DATE DEFAULT CURRENT_DATE,
  
  -- Resolution
  status VARCHAR(50) DEFAULT 'pending' CHECK (status IN ('pending', 'added', 'not_billable', 'duplicate', 'ignored')),
  resolved_date DATE,
  resolved_by UUID REFERENCES users(id),
  resolution_notes TEXT,
  
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_missed_charges_patient ON missed_charges(patient_id);
CREATE INDEX IF NOT EXISTS idx_missed_charges_status ON missed_charges(status);
CREATE INDEX IF NOT EXISTS idx_missed_charges_service_date ON missed_charges(service_date);

-- =====================================================================================================================
-- 5. charge_capture_rules Table
--    Rules for automatic charge capture
-- =====================================================================================================================
CREATE TABLE IF NOT EXISTS charge_capture_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  rule_name VARCHAR(255) NOT NULL,
  rule_description TEXT,
  
  -- Trigger
  trigger_type VARCHAR(100) NOT NULL, -- prescription_created, lab_order_resulted, implant_tracked, etc.
  trigger_conditions JSONB,
  
  -- Action
  charge_code VARCHAR(50) NOT NULL,
  quantity_formula VARCHAR(255), -- e.g., "1", "days_count", "volume_ml / 100"
  
  -- Applicability
  department VARCHAR(100),
  active BOOLEAN DEFAULT true,
  
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_charge_rules_trigger ON charge_capture_rules(trigger_type);
CREATE INDEX IF NOT EXISTS idx_charge_rules_active ON charge_capture_rules(active);

-- Comments
COMMENT ON TABLE charge_master IS 'Hospital charge master (fee schedule) with CPT/HCPCS codes';
COMMENT ON TABLE patient_charges IS 'Individual charges posted to patient accounts with auto-capture tracking';
COMMENT ON TABLE drg_assignments IS 'DRG assignments for inpatient billing with CC/MCC tracking';
COMMENT ON TABLE missed_charges IS 'Potentially missed charges for reconciliation and recovery';
COMMENT ON TABLE charge_capture_rules IS 'Rules for automatic charge capture from clinical activities';

COMMENT ON COLUMN drg_assignments.drg_weight IS 'DRG weight for payment calculation (typically 0.5 to 5.0)';
COMMENT ON COLUMN drg_assignments.calculated_payment IS 'Base rate × DRG weight';




