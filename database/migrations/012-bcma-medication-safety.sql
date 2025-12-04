-- Migration 012: BCMA (Barcode Medication Administration)
-- Date: December 4, 2025
-- Description: Adds barcode medication administration safety system with 5 Rights verification and complete audit trail.

-- =====================================================================================================================
-- 1. medication_administration_records (MAR) Table
--    Complete medication administration documentation with barcode verification
-- =====================================================================================================================
CREATE TABLE IF NOT EXISTS medication_administration_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  prescription_id UUID NOT NULL REFERENCES prescriptions(id),
  patient_id UUID NOT NULL REFERENCES patients(id),
  
  -- Medication Details
  medication_name VARCHAR(255) NOT NULL,
  medication_barcode VARCHAR(100),
  dose VARCHAR(100) NOT NULL,
  unit VARCHAR(50) NOT NULL,
  route VARCHAR(50) NOT NULL,
  
  -- 5 Rights Verification
  right_patient_verified BOOLEAN DEFAULT false,
  right_medication_verified BOOLEAN DEFAULT false,
  right_dose_verified BOOLEAN DEFAULT false,
  right_route_verified BOOLEAN DEFAULT false,
  right_time_verified BOOLEAN DEFAULT false,
  
  -- Barcode Scans
  patient_wristband_scanned BOOLEAN DEFAULT false,
  patient_barcode VARCHAR(100),
  medication_barcode_scanned BOOLEAN DEFAULT false,
  scan_timestamp TIMESTAMP WITH TIME ZONE,
  
  -- Scheduled vs Actual
  scheduled_time TIMESTAMP WITH TIME ZONE NOT NULL,
  actual_administration_time TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  administration_status VARCHAR(50) NOT NULL DEFAULT 'pending' CHECK (administration_status IN 
    ('pending', 'administered', 'refused', 'omitted', 'held', 'not_available')),
  
  -- Administration Details
  administered_by UUID NOT NULL REFERENCES users(id),
  witnessed_by UUID REFERENCES users(id),
  administration_site VARCHAR(100), -- For injections
  
  -- Patient Response
  patient_response TEXT,
  adverse_reaction BOOLEAN DEFAULT false,
  adverse_reaction_details TEXT,
  
  -- Refusal/Omission
  refusal_reason TEXT,
  omission_reason TEXT,
  
  -- Documentation
  notes TEXT,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_mar_prescription ON medication_administration_records(prescription_id);
CREATE INDEX IF NOT EXISTS idx_mar_patient ON medication_administration_records(patient_id);
CREATE INDEX IF NOT EXISTS idx_mar_scheduled_time ON medication_administration_records(scheduled_time);
CREATE INDEX IF NOT EXISTS idx_mar_status ON medication_administration_records(administration_status);
CREATE INDEX IF NOT EXISTS idx_mar_administered_by ON medication_administration_records(administered_by);

-- =====================================================================================================================
-- 2. medication_barcode_master Table
--    Master list of medication barcodes for verification
-- =====================================================================================================================
CREATE TABLE IF NOT EXISTS medication_barcode_master (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  medication_name VARCHAR(255) NOT NULL,
  generic_name VARCHAR(255),
  brand_name VARCHAR(255),
  barcode VARCHAR(100) NOT NULL UNIQUE,
  ndc_code VARCHAR(20), -- National Drug Code
  strength VARCHAR(100),
  unit VARCHAR(50),
  form VARCHAR(100), -- Tablet, Capsule, Injection, etc.
  route VARCHAR(50),
  manufacturer VARCHAR(255),
  is_high_alert BOOLEAN DEFAULT false,
  is_controlled BOOLEAN DEFAULT false,
  
  -- Safety Information
  look_alike_sound_alike JSONB DEFAULT '[]'::jsonb, -- LASA drugs
  contraindications TEXT,
  allergies_to_check JSONB DEFAULT '[]'::jsonb,
  
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_med_barcode_code ON medication_barcode_master(barcode);
CREATE INDEX IF NOT EXISTS idx_med_barcode_name ON medication_barcode_master(medication_name);
CREATE INDEX IF NOT EXISTS idx_med_barcode_high_alert ON medication_barcode_master(is_high_alert);

-- =====================================================================================================================
-- 3. patient_wristbands Table
--    Patient identification wristbands with barcodes
-- =====================================================================================================================
CREATE TABLE IF NOT EXISTS patient_wristbands (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID NOT NULL REFERENCES patients(id),
  admission_id UUID REFERENCES admissions(id),
  
  barcode VARCHAR(100) NOT NULL UNIQUE,
  wristband_type VARCHAR(50) DEFAULT 'standard' CHECK (wristband_type IN 
    ('standard', 'allergy', 'fall_risk', 'dnr', 'isolation')),
  
  -- Verification
  issued_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  issued_by UUID REFERENCES users(id),
  expires_at TIMESTAMP WITH TIME ZONE,
  
  is_active BOOLEAN DEFAULT true,
  deactivated_at TIMESTAMP WITH TIME ZONE,
  deactivated_by UUID REFERENCES users(id),
  deactivation_reason TEXT,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_wristband_patient ON patient_wristbands(patient_id);
CREATE INDEX IF NOT EXISTS idx_wristband_barcode ON patient_wristbands(barcode);
CREATE INDEX IF NOT EXISTS idx_wristband_active ON patient_wristbands(is_active);

-- =====================================================================================================================
-- 4. medication_alerts Table
--    Real-time alerts for medication safety (allergies, interactions, contraindications)
-- =====================================================================================================================
CREATE TABLE IF NOT EXISTS medication_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID NOT NULL REFERENCES patients(id),
  prescription_id UUID REFERENCES prescriptions(id),
  mar_id UUID REFERENCES medication_administration_records(id),
  
  alert_type VARCHAR(50) NOT NULL CHECK (alert_type IN 
    ('allergy', 'interaction', 'duplicate_therapy', 'high_alert', 'dose_range', 'contraindication', 'renal_dosing', 'hepatic_dosing')),
  severity VARCHAR(20) NOT NULL CHECK (severity IN ('low', 'moderate', 'high', 'critical')),
  
  alert_message TEXT NOT NULL,
  alert_details JSONB,
  
  -- Response
  acknowledged BOOLEAN DEFAULT false,
  acknowledged_by UUID REFERENCES users(id),
  acknowledged_at TIMESTAMP WITH TIME ZONE,
  override_reason TEXT,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_med_alert_patient ON medication_alerts(patient_id);
CREATE INDEX IF NOT EXISTS idx_med_alert_prescription ON medication_alerts(prescription_id);
CREATE INDEX IF NOT EXISTS idx_med_alert_severity ON medication_alerts(severity);
CREATE INDEX IF NOT EXISTS idx_med_alert_acknowledged ON medication_alerts(acknowledged);

-- =====================================================================================================================
-- 5. bcma_audit_log Table
--    Complete audit trail for all BCMA activities
-- =====================================================================================================================
CREATE TABLE IF NOT EXISTS bcma_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mar_id UUID REFERENCES medication_administration_records(id),
  
  action VARCHAR(100) NOT NULL, -- scan_patient, scan_medication, administer, refuse, etc.
  action_timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  user_id UUID NOT NULL REFERENCES users(id),
  patient_id UUID REFERENCES patients(id),
  
  -- Scan Details
  barcode_scanned VARCHAR(100),
  scan_result VARCHAR(50), -- success, mismatch, invalid, etc.
  
  -- Context
  ip_address VARCHAR(50),
  device_id VARCHAR(100),
  location VARCHAR(100),
  
  details JSONB,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_bcma_audit_mar ON bcma_audit_log(mar_id);
CREATE INDEX IF NOT EXISTS idx_bcma_audit_user ON bcma_audit_log(user_id);
CREATE INDEX IF NOT EXISTS idx_bcma_audit_timestamp ON bcma_audit_log(action_timestamp);
CREATE INDEX IF NOT EXISTS idx_bcma_audit_action ON bcma_audit_log(action);

-- Comments for documentation
COMMENT ON TABLE medication_administration_records IS 'Complete medication administration documentation with 5 Rights verification';
COMMENT ON TABLE medication_barcode_master IS 'Master list of medication barcodes for verification';
COMMENT ON TABLE patient_wristbands IS 'Patient identification wristbands with barcodes';
COMMENT ON TABLE medication_alerts IS 'Real-time medication safety alerts';
COMMENT ON TABLE bcma_audit_log IS 'Complete audit trail for all BCMA activities';

COMMENT ON COLUMN medication_administration_records.right_patient_verified IS 'Verified correct patient via barcode scan';
COMMENT ON COLUMN medication_administration_records.right_medication_verified IS 'Verified correct medication via barcode scan';
COMMENT ON COLUMN medication_barcode_master.is_high_alert IS 'High-alert medications require double-check';

