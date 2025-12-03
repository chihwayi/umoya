-- Sprint 23: Advanced Bed Management & ADT (Admission/Discharge/Transfer)
-- Date: December 3, 2025
-- Description: Real-time bed tracking, ADT workflows, and census management

-- Beds Table
CREATE TABLE IF NOT EXISTS beds (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bed_number VARCHAR(50) NOT NULL,
  room_number VARCHAR(50) NOT NULL,
  ward_name VARCHAR(100) NOT NULL,
  floor VARCHAR(50),
  building VARCHAR(100),
  bed_type VARCHAR(50) NOT NULL CHECK (bed_type IN (
    'icu',
    'general',
    'pediatric',
    'maternity',
    'isolation',
    'telemetry',
    'step_down',
    'observation'
  )),
  specialty VARCHAR(100),
  status VARCHAR(50) DEFAULT 'available' CHECK (status IN (
    'available',
    'occupied',
    'reserved',
    'blocked',
    'cleaning',
    'maintenance',
    'out_of_service'
  )),
  current_patient_id UUID REFERENCES patients(id),
  current_admission_id UUID,
  occupied_since TIMESTAMP WITH TIME ZONE,
  expected_discharge TIMESTAMP WITH TIME ZONE,
  has_equipment JSONB DEFAULT '[]'::jsonb, -- Ventilator, monitor, etc.
  features JSONB DEFAULT '[]'::jsonb, -- Window, bathroom, etc.
  is_isolation_capable BOOLEAN DEFAULT false,
  is_negative_pressure BOOLEAN DEFAULT false,
  last_cleaned_at TIMESTAMP WITH TIME ZONE,
  last_cleaned_by UUID REFERENCES users(id),
  maintenance_notes TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(bed_number, ward_name)
);

CREATE INDEX IF NOT EXISTS idx_beds_status ON beds(status);
CREATE INDEX IF NOT EXISTS idx_beds_ward ON beds(ward_name);
CREATE INDEX IF NOT EXISTS idx_beds_type ON beds(bed_type);
CREATE INDEX IF NOT EXISTS idx_beds_patient ON beds(current_patient_id);
CREATE INDEX IF NOT EXISTS idx_beds_floor ON beds(floor);

-- Admissions Table
CREATE TABLE IF NOT EXISTS admissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admission_number VARCHAR(50) UNIQUE NOT NULL,
  patient_id UUID NOT NULL REFERENCES patients(id),
  admission_date TIMESTAMP WITH TIME ZONE NOT NULL,
  admission_time TIMESTAMP WITH TIME ZONE NOT NULL,
  admission_type VARCHAR(50) NOT NULL CHECK (admission_type IN (
    'emergency',
    'elective',
    'urgent',
    'newborn',
    'maternity',
    'observation'
  )),
  admission_source VARCHAR(100), -- ER, clinic, transfer, etc.
  referring_facility VARCHAR(255),
  admitting_provider UUID REFERENCES users(id),
  admitting_diagnosis TEXT NOT NULL,
  admission_reason TEXT,
  initial_bed_id UUID REFERENCES beds(id),
  initial_ward VARCHAR(100),
  current_bed_id UUID REFERENCES beds(id),
  current_ward VARCHAR(100),
  service VARCHAR(100), -- Medical, surgical, pediatrics, etc.
  attending_provider UUID REFERENCES users(id),
  admission_status VARCHAR(50) DEFAULT 'active' CHECK (admission_status IN (
    'active',
    'discharged',
    'transferred_out',
    'deceased',
    'eloped',
    'cancelled'
  )),
  expected_los_days INTEGER, -- Length of stay
  isolation_required BOOLEAN DEFAULT false,
  isolation_type VARCHAR(100),
  code_status VARCHAR(50), -- Full code, DNR, etc.
  advance_directives TEXT,
  discharge_plan TEXT,
  estimated_discharge_date DATE,
  financial_class VARCHAR(100), -- Insurance, self-pay, etc.
  insurance_verified BOOLEAN DEFAULT false,
  insurance_authorization VARCHAR(100),
  notes TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_admissions_patient ON admissions(patient_id);
CREATE INDEX IF NOT EXISTS idx_admissions_status ON admissions(admission_status);
CREATE INDEX IF NOT EXISTS idx_admissions_date ON admissions(admission_date);
CREATE INDEX IF NOT EXISTS idx_admissions_ward ON admissions(current_ward);
CREATE INDEX IF NOT EXISTS idx_admissions_bed ON admissions(current_bed_id);
CREATE INDEX IF NOT EXISTS idx_admissions_provider ON admissions(attending_provider);
CREATE INDEX IF NOT EXISTS idx_admissions_number ON admissions(admission_number);

-- Discharges Table
CREATE TABLE IF NOT EXISTS discharges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admission_id UUID NOT NULL REFERENCES admissions(id),
  patient_id UUID NOT NULL REFERENCES patients(id),
  discharge_date TIMESTAMP WITH TIME ZONE NOT NULL,
  discharge_time TIMESTAMP WITH TIME ZONE NOT NULL,
  discharge_type VARCHAR(50) NOT NULL CHECK (discharge_type IN (
    'routine',
    'against_medical_advice',
    'transfer_to_facility',
    'home_health',
    'deceased',
    'hospice',
    'left_without_being_seen',
    'still_patient'
  )),
  discharge_disposition VARCHAR(100) NOT NULL, -- Home, SNF, rehab, etc.
  discharge_destination VARCHAR(255),
  discharge_diagnosis TEXT NOT NULL,
  discharge_condition VARCHAR(100), -- Improved, stable, worse
  discharge_provider UUID REFERENCES users(id),
  discharge_instructions TEXT,
  medications_prescribed TEXT,
  follow_up_appointments TEXT,
  follow_up_provider UUID REFERENCES users(id),
  follow_up_date DATE,
  restrictions TEXT,
  diet_instructions TEXT,
  activity_level TEXT,
  wound_care TEXT,
  home_health_ordered BOOLEAN DEFAULT false,
  dme_ordered BOOLEAN DEFAULT false, -- Durable medical equipment
  dme_details TEXT,
  transportation_arranged BOOLEAN DEFAULT false,
  patient_education_provided BOOLEAN DEFAULT false,
  discharge_summary_completed BOOLEAN DEFAULT false,
  discharge_summary_sent_date TIMESTAMP WITH TIME ZONE,
  length_of_stay_hours INTEGER,
  readmission_risk VARCHAR(50), -- Low, medium, high
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_discharges_admission ON discharges(admission_id);
CREATE INDEX IF NOT EXISTS idx_discharges_patient ON discharges(patient_id);
CREATE INDEX IF NOT EXISTS idx_discharges_date ON discharges(discharge_date);
CREATE INDEX IF NOT EXISTS idx_discharges_type ON discharges(discharge_type);

-- Transfers Table
CREATE TABLE IF NOT EXISTS patient_transfers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admission_id UUID NOT NULL REFERENCES admissions(id),
  patient_id UUID NOT NULL REFERENCES patients(id),
  transfer_date TIMESTAMP WITH TIME ZONE NOT NULL,
  transfer_time TIMESTAMP WITH TIME ZONE NOT NULL,
  transfer_type VARCHAR(50) NOT NULL CHECK (transfer_type IN (
    'internal_ward',
    'internal_bed',
    'external_facility',
    'icu_to_floor',
    'floor_to_icu',
    'service_change'
  )),
  from_bed_id UUID REFERENCES beds(id),
  from_ward VARCHAR(100),
  from_service VARCHAR(100),
  to_bed_id UUID REFERENCES beds(id),
  to_ward VARCHAR(100),
  to_service VARCHAR(100),
  to_facility VARCHAR(255), -- If external transfer
  transfer_reason TEXT NOT NULL,
  clinical_reason TEXT,
  accepting_provider UUID REFERENCES users(id),
  transferring_provider UUID REFERENCES users(id),
  patient_condition VARCHAR(100), -- At time of transfer
  mode_of_transport VARCHAR(100), -- Wheelchair, stretcher, ambulance
  equipment_needed TEXT,
  special_instructions TEXT,
  transfer_accepted BOOLEAN DEFAULT true,
  transfer_completed BOOLEAN DEFAULT false,
  transfer_completed_time TIMESTAMP WITH TIME ZONE,
  cancelled BOOLEAN DEFAULT false,
  cancellation_reason TEXT,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_patient_transfers_admission ON patient_transfers(admission_id);
CREATE INDEX IF NOT EXISTS idx_patient_transfers_patient ON patient_transfers(patient_id);
CREATE INDEX IF NOT EXISTS idx_patient_transfers_date ON patient_transfers(transfer_date);
CREATE INDEX IF NOT EXISTS idx_patient_transfers_from_bed ON patient_transfers(from_bed_id);
CREATE INDEX IF NOT EXISTS idx_patient_transfers_to_bed ON patient_transfers(to_bed_id);
CREATE INDEX IF NOT EXISTS idx_patient_transfers_type ON patient_transfers(transfer_type);

-- Bed Assignments Table (Historical tracking)
CREATE TABLE IF NOT EXISTS bed_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bed_id UUID NOT NULL REFERENCES beds(id),
  patient_id UUID NOT NULL REFERENCES patients(id),
  admission_id UUID REFERENCES admissions(id),
  assigned_date TIMESTAMP WITH TIME ZONE NOT NULL,
  assigned_time TIMESTAMP WITH TIME ZONE NOT NULL,
  assigned_by UUID REFERENCES users(id),
  released_date TIMESTAMP WITH TIME ZONE,
  released_time TIMESTAMP WITH TIME ZONE,
  released_by UUID REFERENCES users(id),
  assignment_reason VARCHAR(255),
  duration_hours INTEGER,
  is_active BOOLEAN DEFAULT true,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_bed_assignments_bed ON bed_assignments(bed_id);
CREATE INDEX IF NOT EXISTS idx_bed_assignments_patient ON bed_assignments(patient_id);
CREATE INDEX IF NOT EXISTS idx_bed_assignments_admission ON bed_assignments(admission_id);
CREATE INDEX IF NOT EXISTS idx_bed_assignments_active ON bed_assignments(is_active);
CREATE INDEX IF NOT EXISTS idx_bed_assignments_date ON bed_assignments(assigned_date);

-- Bed Status Log Table (Audit trail)
CREATE TABLE IF NOT EXISTS bed_status_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bed_id UUID NOT NULL REFERENCES beds(id),
  previous_status VARCHAR(50),
  new_status VARCHAR(50) NOT NULL,
  previous_patient_id UUID REFERENCES patients(id),
  new_patient_id UUID REFERENCES patients(id),
  changed_by UUID REFERENCES users(id),
  changed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  change_reason TEXT,
  notes TEXT
);

CREATE INDEX IF NOT EXISTS idx_bed_status_log_bed ON bed_status_log(bed_id);
CREATE INDEX IF NOT EXISTS idx_bed_status_log_date ON bed_status_log(changed_at);

-- Census Snapshots Table (Daily census tracking)
CREATE TABLE IF NOT EXISTS census_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  snapshot_date DATE NOT NULL,
  snapshot_time TIME NOT NULL DEFAULT '00:00',
  ward_name VARCHAR(100),
  total_beds INTEGER NOT NULL,
  occupied_beds INTEGER NOT NULL,
  available_beds INTEGER NOT NULL,
  reserved_beds INTEGER DEFAULT 0,
  blocked_beds INTEGER DEFAULT 0,
  cleaning_beds INTEGER DEFAULT 0,
  occupancy_rate DECIMAL(5,2),
  average_los DECIMAL(5,2),
  admissions_today INTEGER DEFAULT 0,
  discharges_today INTEGER DEFAULT 0,
  transfers_in_today INTEGER DEFAULT 0,
  transfers_out_today INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(snapshot_date, snapshot_time, ward_name)
);

CREATE INDEX IF NOT EXISTS idx_census_snapshots_date ON census_snapshots(snapshot_date);
CREATE INDEX IF NOT EXISTS idx_census_snapshots_ward ON census_snapshots(ward_name);

-- Insert sample wards and beds
INSERT INTO beds (bed_number, room_number, ward_name, floor, building, bed_type, status) VALUES
-- ICU
('ICU-01', 'ICU-101', 'Intensive Care Unit', '2', 'Main', 'icu', 'available'),
('ICU-02', 'ICU-102', 'Intensive Care Unit', '2', 'Main', 'icu', 'available'),
('ICU-03', 'ICU-103', 'Intensive Care Unit', '2', 'Main', 'icu', 'available'),
('ICU-04', 'ICU-104', 'Intensive Care Unit', '2', 'Main', 'icu', 'available'),

-- General Medical Ward
('MED-01', '201', 'Medical Ward', '3', 'Main', 'general', 'available'),
('MED-02', '201', 'Medical Ward', '3', 'Main', 'general', 'available'),
('MED-03', '202', 'Medical Ward', '3', 'Main', 'general', 'available'),
('MED-04', '202', 'Medical Ward', '3', 'Main', 'general', 'available'),
('MED-05', '203', 'Medical Ward', '3', 'Main', 'general', 'available'),
('MED-06', '203', 'Medical Ward', '3', 'Main', 'general', 'available'),

-- Pediatrics
('PED-01', 'P101', 'Pediatrics', '4', 'Main', 'pediatric', 'available'),
('PED-02', 'P102', 'Pediatrics', '4', 'Main', 'pediatric', 'available'),
('PED-03', 'P103', 'Pediatrics', '4', 'Main', 'pediatric', 'available'),

-- Maternity
('MAT-01', 'M101', 'Maternity', '5', 'Main', 'maternity', 'available'),
('MAT-02', 'M102', 'Maternity', '5', 'Main', 'maternity', 'available'),
('MAT-03', 'M103', 'Maternity', '5', 'Main', 'maternity', 'available');

-- Add comments
COMMENT ON TABLE beds IS 'Hospital bed inventory with real-time status';
COMMENT ON TABLE admissions IS 'Patient admission records with ADT tracking';
COMMENT ON TABLE discharges IS 'Patient discharge records and summaries';
COMMENT ON TABLE patient_transfers IS 'Internal and external patient transfers';
COMMENT ON TABLE bed_assignments IS 'Historical bed assignment tracking';
COMMENT ON TABLE bed_status_log IS 'Audit trail for bed status changes';
COMMENT ON TABLE census_snapshots IS 'Daily census snapshots for reporting';

