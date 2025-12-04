-- Sprint 26: Operating Room Management
-- Date: December 4, 2025
-- Description: Complete OR management system for surgical hospitals

-- Operating Rooms Table
CREATE TABLE IF NOT EXISTS operating_rooms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_number VARCHAR(20) UNIQUE NOT NULL,
  room_name VARCHAR(100) NOT NULL,
  location VARCHAR(100),
  room_type VARCHAR(50) CHECK (room_type IN ('general', 'cardiac', 'ortho', 'neuro', 'vascular', 'minor_procedure')),
  status VARCHAR(20) DEFAULT 'available' CHECK (status IN ('available', 'occupied', 'cleaning', 'maintenance', 'offline')),
  has_laminar_flow BOOLEAN DEFAULT false,
  has_c_arm BOOLEAN DEFAULT false,
  has_microscope BOOLEAN DEFAULT false,
  has_robot BOOLEAN DEFAULT false,
  equipment_list JSONB DEFAULT '[]'::jsonb,
  capacity INTEGER DEFAULT 1,
  notes TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_operating_rooms_status ON operating_rooms(status);
CREATE INDEX IF NOT EXISTS idx_operating_rooms_type ON operating_rooms(room_type);
CREATE INDEX IF NOT EXISTS idx_operating_rooms_active ON operating_rooms(is_active);

-- Surgical Cases Table
CREATE TABLE IF NOT EXISTS surgical_cases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_number VARCHAR(50) UNIQUE NOT NULL,
  patient_id UUID NOT NULL REFERENCES patients(id),
  appointment_id UUID REFERENCES appointments(id),
  admission_id UUID REFERENCES admissions(id),
  operating_room_id UUID REFERENCES operating_rooms(id),
  
  -- Scheduling Info
  scheduled_date DATE NOT NULL,
  scheduled_start_time TIME NOT NULL,
  scheduled_end_time TIME NOT NULL,
  actual_start_time TIMESTAMP WITH TIME ZONE,
  actual_end_time TIMESTAMP WITH TIME ZONE,
  patient_in_room_time TIMESTAMP WITH TIME ZONE,
  patient_out_room_time TIMESTAMP WITH TIME ZONE,
  
  -- Procedure Info
  procedure_name TEXT NOT NULL,
  procedure_code_cpt VARCHAR(10),
  procedure_code_snomed VARCHAR(20),
  procedure_type VARCHAR(50) CHECK (procedure_type IN ('elective', 'urgent', 'emergent', 'trauma')),
  surgical_approach VARCHAR(50) CHECK (surgical_approach IN ('open', 'laparoscopic', 'robotic', 'endoscopic', 'minimally_invasive')),
  laterality VARCHAR(20) CHECK (laterality IN ('left', 'right', 'bilateral', 'not_applicable')),
  
  -- Diagnosis
  primary_diagnosis TEXT NOT NULL,
  primary_diagnosis_icd10 VARCHAR(10),
  primary_diagnosis_snomed VARCHAR(20),
  secondary_diagnoses JSONB DEFAULT '[]'::jsonb,
  
  -- Staff
  primary_surgeon_id UUID REFERENCES users(id),
  assistant_surgeon_id UUID REFERENCES users(id),
  anesthesiologist_id UUID REFERENCES users(id),
  scrub_nurse_id UUID REFERENCES users(id),
  circulating_nurse_id UUID REFERENCES users(id),
  additional_staff JSONB DEFAULT '[]'::jsonb,
  
  -- Status
  status VARCHAR(50) DEFAULT 'scheduled' CHECK (status IN (
    'scheduled', 'confirmed', 'patient_arrived', 'in_progress', 
    'completed', 'cancelled', 'postponed', 'no_show'
  )),
  case_priority INTEGER DEFAULT 3 CHECK (case_priority BETWEEN 1 AND 5),
  
  -- Documentation
  pre_op_diagnosis TEXT,
  post_op_diagnosis TEXT,
  findings TEXT,
  procedure_performed TEXT,
  complications TEXT,
  estimated_blood_loss INTEGER, -- in mL
  specimens_sent JSONB DEFAULT '[]'::jsonb,
  drains_placed JSONB DEFAULT '[]'::jsonb,
  implants_used JSONB DEFAULT '[]'::jsonb,
  
  -- Anesthesia
  anesthesia_type VARCHAR(50) CHECK (anesthesia_type IN ('general', 'regional', 'local', 'MAC', 'spinal', 'epidural')),
  anesthesia_start_time TIMESTAMP WITH TIME ZONE,
  anesthesia_end_time TIMESTAMP WITH TIME ZONE,
  
  -- Disposition
  disposition VARCHAR(50) CHECK (disposition IN ('pacu', 'icu', 'floor', 'home', 'observation')),
  
  -- Administrative
  consent_id UUID REFERENCES patient_consents(id),
  case_cancelled_reason TEXT,
  case_postponed_reason TEXT,
  notes TEXT,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_surgical_cases_patient ON surgical_cases(patient_id);
CREATE INDEX IF NOT EXISTS idx_surgical_cases_date ON surgical_cases(scheduled_date);
CREATE INDEX IF NOT EXISTS idx_surgical_cases_status ON surgical_cases(status);
CREATE INDEX IF NOT EXISTS idx_surgical_cases_surgeon ON surgical_cases(primary_surgeon_id);
CREATE INDEX IF NOT EXISTS idx_surgical_cases_or ON surgical_cases(operating_room_id);
CREATE INDEX IF NOT EXISTS idx_surgical_cases_procedure_cpt ON surgical_cases(procedure_code_cpt);
CREATE INDEX IF NOT EXISTS idx_surgical_cases_diagnosis_icd10 ON surgical_cases(primary_diagnosis_icd10);

-- Surgical Preference Cards
CREATE TABLE IF NOT EXISTS surgical_preference_cards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  surgeon_id UUID NOT NULL REFERENCES users(id),
  procedure_name VARCHAR(255) NOT NULL,
  procedure_code_cpt VARCHAR(10),
  
  -- Preferences
  preferred_or_type VARCHAR(50),
  preferred_position VARCHAR(50) CHECK (preferred_position IN ('supine', 'prone', 'lateral', 'lithotomy', 'trendelenburg', 'reverse_trendelenburg')),
  preferred_anesthesia VARCHAR(50),
  
  -- Equipment
  required_equipment JSONB DEFAULT '[]'::jsonb,
  preferred_instruments JSONB DEFAULT '[]'::jsonb,
  suture_preferences JSONB DEFAULT '[]'::jsonb,
  
  -- Supplies
  supply_list JSONB DEFAULT '[]'::jsonb,
  implant_options JSONB DEFAULT '[]'::jsonb,
  
  -- Staff
  preferred_scrub_tech VARCHAR(255),
  special_instructions TEXT,
  
  is_active BOOLEAN DEFAULT true,
  version INTEGER DEFAULT 1,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(surgeon_id, procedure_name, version)
);

CREATE INDEX IF NOT EXISTS idx_preference_cards_surgeon ON surgical_preference_cards(surgeon_id);
CREATE INDEX IF NOT EXISTS idx_preference_cards_procedure ON surgical_preference_cards(procedure_name);

-- OR Block Schedule / Block Time
CREATE TABLE IF NOT EXISTS or_block_schedule (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  operating_room_id UUID NOT NULL REFERENCES operating_rooms(id),
  surgeon_id UUID REFERENCES users(id),
  service_name VARCHAR(100),
  
  -- Schedule
  day_of_week INTEGER CHECK (day_of_week BETWEEN 0 AND 6),
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  effective_date DATE NOT NULL,
  expiration_date DATE,
  
  -- Block Type
  block_type VARCHAR(50) CHECK (block_type IN ('dedicated', 'shared', 'open', 'emergency_only')),
  is_recurring BOOLEAN DEFAULT true,
  
  notes TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_or_block_room ON or_block_schedule(operating_room_id);
CREATE INDEX IF NOT EXISTS idx_or_block_surgeon ON or_block_schedule(surgeon_id);
CREATE INDEX IF NOT EXISTS idx_or_block_dow ON or_block_schedule(day_of_week);

-- Implant Tracking
CREATE TABLE IF NOT EXISTS surgical_implants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  surgical_case_id UUID NOT NULL REFERENCES surgical_cases(id),
  
  -- Implant Info
  implant_name VARCHAR(255) NOT NULL,
  implant_type VARCHAR(100),
  manufacturer VARCHAR(255),
  catalog_number VARCHAR(100),
  lot_number VARCHAR(100),
  serial_number VARCHAR(100),
  expiration_date DATE,
  
  -- FDA
  udi VARCHAR(255), -- Unique Device Identifier
  udi_di VARCHAR(100), -- Device Identifier
  udi_pi VARCHAR(100), -- Production Identifier
  
  -- Billing
  charge_code VARCHAR(50),
  unit_cost DECIMAL(10, 2),
  billable BOOLEAN DEFAULT true,
  
  -- Documentation
  implanted_by UUID REFERENCES users(id),
  implanted_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  body_site VARCHAR(100),
  notes TEXT,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_implants_case ON surgical_implants(surgical_case_id);
CREATE INDEX IF NOT EXISTS idx_implants_udi ON surgical_implants(udi);
CREATE INDEX IF NOT EXISTS idx_implants_lot ON surgical_implants(lot_number);
CREATE INDEX IF NOT EXISTS idx_implants_serial ON surgical_implants(serial_number);

-- OR Supply Usage
CREATE TABLE IF NOT EXISTS or_supply_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  surgical_case_id UUID NOT NULL REFERENCES surgical_cases(id),
  
  supply_name VARCHAR(255) NOT NULL,
  supply_code VARCHAR(50),
  quantity_used INTEGER NOT NULL,
  unit_of_measure VARCHAR(20),
  unit_cost DECIMAL(10, 2),
  total_cost DECIMAL(10, 2),
  
  charged_to_patient BOOLEAN DEFAULT true,
  charge_code VARCHAR(50),
  
  recorded_by UUID REFERENCES users(id),
  recorded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_supply_usage_case ON or_supply_usage(surgical_case_id);

-- OR Turnover Tracking
CREATE TABLE IF NOT EXISTS or_turnover_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  operating_room_id UUID NOT NULL REFERENCES operating_rooms(id),
  surgical_case_id UUID REFERENCES surgical_cases(id),
  
  -- Times
  patient_out_time TIMESTAMP WITH TIME ZONE,
  cleaning_start_time TIMESTAMP WITH TIME ZONE,
  cleaning_end_time TIMESTAMP WITH TIME ZONE,
  next_patient_in_time TIMESTAMP WITH TIME ZONE,
  
  -- Turnover Time (minutes)
  turnover_minutes INTEGER,
  
  -- Delays
  delay_reason TEXT,
  delay_minutes INTEGER,
  
  -- Staff
  cleaned_by UUID REFERENCES users(id),
  verified_by UUID REFERENCES users(id),
  
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_turnover_room ON or_turnover_log(operating_room_id);
CREATE INDEX IF NOT EXISTS idx_turnover_case ON or_turnover_log(surgical_case_id);

-- Comments
COMMENT ON TABLE operating_rooms IS 'Operating room configuration and equipment tracking';
COMMENT ON TABLE surgical_cases IS 'Complete surgical case tracking from scheduling to completion';
COMMENT ON TABLE surgical_preference_cards IS 'Surgeon preferences for specific procedures';
COMMENT ON TABLE surgical_implants IS 'FDA-compliant implant tracking with UDI (Unique Device Identifier)';
COMMENT ON TABLE or_supply_usage IS 'Surgical supply usage and charge capture';
COMMENT ON TABLE or_block_schedule IS 'OR block time scheduling for surgeons/services';
COMMENT ON TABLE or_turnover_log IS 'OR efficiency tracking and turnover times';

COMMENT ON COLUMN surgical_cases.case_priority IS 'Priority 1=Emergent, 2=Urgent, 3=Routine, 4=Elective, 5=Optional';
COMMENT ON COLUMN surgical_implants.udi IS 'FDA Unique Device Identifier - REQUIRED for implantable devices';
COMMENT ON COLUMN surgical_cases.estimated_blood_loss IS 'Estimated blood loss in milliliters';
COMMENT ON COLUMN or_turnover_log.turnover_minutes IS 'Time from patient out to next patient in (target: <30 minutes)';

