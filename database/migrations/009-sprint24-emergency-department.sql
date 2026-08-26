-- Sprint 24: Emergency Department Module
-- Date: December 3, 2025
-- Description: ESI triage, ED tracking board, and emergency workflows

-- ED Visits Table
CREATE TABLE IF NOT EXISTS ed_visits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ed_visit_number VARCHAR(50) UNIQUE NOT NULL,
  patient_id UUID NOT NULL REFERENCES patients(id),
  arrival_date TIMESTAMP WITH TIME ZONE NOT NULL,
  arrival_time TIMESTAMP WITH TIME ZONE NOT NULL,
  arrival_mode VARCHAR(50) NOT NULL CHECK (arrival_mode IN (
    'ambulance',
    'walk_in',
    'police',
    'helicopter',
    'private_vehicle',
    'wheelchair',
    'other'
  )),
  chief_complaint TEXT NOT NULL,
  presenting_symptoms TEXT,
  triage_level INTEGER CHECK (triage_level BETWEEN 1 AND 5), -- ESI 1-5
  triage_acuity VARCHAR(50), -- Immediate, emergent, urgent, less urgent, non-urgent
  triage_completed_at TIMESTAMP WITH TIME ZONE,
  triage_completed_by UUID REFERENCES users(id),
  vital_signs JSONB,
  allergies TEXT,
  current_medications TEXT,
  last_meal_time TIMESTAMP WITH TIME ZONE,
  tetanus_status VARCHAR(50),
  bed_assigned VARCHAR(50),
  room_assigned VARCHAR(50),
  attending_provider UUID REFERENCES users(id),
  primary_nurse UUID REFERENCES users(id),
  ed_status VARCHAR(50) DEFAULT 'waiting' CHECK (ed_status IN (
    'waiting',
    'triage',
    'in_treatment',
    'pending_results',
    'pending_admission',
    'ready_for_discharge',
    'discharged',
    'admitted',
    'transferred',
    'left_without_being_seen',
    'deceased'
  )),
  fast_track BOOLEAN DEFAULT false,
  trauma_activation BOOLEAN DEFAULT false,
  trauma_level VARCHAR(20), -- Level 1, 2, 3
  code_stroke BOOLEAN DEFAULT false,
  code_stemi BOOLEAN DEFAULT false,
  code_sepsis BOOLEAN DEFAULT false,
  isolation_required BOOLEAN DEFAULT false,
  isolation_precautions VARCHAR(100),
  time_to_provider INTEGER, -- Minutes from arrival
  time_to_treatment INTEGER, -- Minutes from arrival
  total_ed_time INTEGER, -- Minutes (door to disposition)
  disposition VARCHAR(100), -- Admitted, discharged, transferred, LWBS, etc.
  disposition_time TIMESTAMP WITH TIME ZONE,
  discharge_diagnosis TEXT,
  discharge_instructions TEXT,
  follow_up_instructions TEXT,
  left_ama BOOLEAN DEFAULT false, -- Against medical advice
  return_precautions TEXT,
  prescriptions_given TEXT,
  referrals TEXT,
  notes TEXT,
  quality_flags JSONB DEFAULT '[]'::jsonb, -- Door-to-provider time, etc.
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ed_visits_patient ON ed_visits(patient_id);
CREATE INDEX IF NOT EXISTS idx_ed_visits_arrival ON ed_visits(arrival_date);
CREATE INDEX IF NOT EXISTS idx_ed_visits_triage_level ON ed_visits(triage_level);
CREATE INDEX IF NOT EXISTS idx_ed_visits_status ON ed_visits(ed_status);
CREATE INDEX IF NOT EXISTS idx_ed_visits_provider ON ed_visits(attending_provider);
CREATE INDEX IF NOT EXISTS idx_ed_visits_number ON ed_visits(ed_visit_number);

-- ED Triage Assessments Table (ESI Protocol)
CREATE TABLE IF NOT EXISTS ed_triage_assessments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ed_visit_id UUID NOT NULL REFERENCES ed_visits(id),
  patient_id UUID NOT NULL REFERENCES patients(id),
  triage_date TIMESTAMP WITH TIME ZONE NOT NULL,
  triaged_by UUID NOT NULL REFERENCES users(id),
  
  -- ESI Algorithm
  esi_level INTEGER NOT NULL CHECK (esi_level BETWEEN 1 AND 5),
  requires_immediate_lifesaving BOOLEAN DEFAULT false, -- ESI 1
  high_risk_situation BOOLEAN DEFAULT false, -- ESI 2
  confused_lethargic_disoriented BOOLEAN DEFAULT false, -- ESI 2
  severe_pain_distress BOOLEAN DEFAULT false, -- ESI 2
  expected_resources INTEGER, -- Number of resources needed (ESI 3-5)
  vital_signs_abnormal BOOLEAN DEFAULT false,
  
  -- Vital Signs
  temperature DECIMAL(4,1),
  heart_rate INTEGER,
  respiratory_rate INTEGER,
  blood_pressure_systolic INTEGER,
  blood_pressure_diastolic INTEGER,
  oxygen_saturation INTEGER,
  pain_scale INTEGER CHECK (pain_scale BETWEEN 0 AND 10),
  gcs_score INTEGER CHECK (gcs_score BETWEEN 3 AND 15), -- Glasgow Coma Scale
  
  -- Assessment
  presenting_complaint TEXT NOT NULL,
  hpi TEXT, -- History of present illness
  allergies TEXT,
  current_medications TEXT,
  medical_history TEXT,
  last_tetanus DATE,
  pregnancy_status VARCHAR(50),
  last_menstrual_period DATE,
  
  -- Decision factors
  airway_patent BOOLEAN,
  breathing_adequate BOOLEAN,
  circulation_stable BOOLEAN,
  neurological_intact BOOLEAN,
  anticipated_resources TEXT,
  rationale TEXT,
  
  -- Actions
  immediate_interventions TEXT,
  orders_placed TEXT,
  reassessment_required BOOLEAN DEFAULT false,
  reassessment_interval INTEGER, -- Minutes
  
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ed_triage_visit ON ed_triage_assessments(ed_visit_id);
CREATE INDEX IF NOT EXISTS idx_ed_triage_patient ON ed_triage_assessments(patient_id);
CREATE INDEX IF NOT EXISTS idx_ed_triage_level ON ed_triage_assessments(esi_level);
CREATE INDEX IF NOT EXISTS idx_ed_triage_date ON ed_triage_assessments(triage_date);

-- ED Tracking Board (Real-time status)
CREATE TABLE IF NOT EXISTS ed_tracking (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ed_visit_id UUID NOT NULL REFERENCES ed_visits(id),
  patient_id UUID NOT NULL REFERENCES patients(id),
  current_location VARCHAR(100) NOT NULL, -- Triage, Room 1, Imaging, etc.
  current_status VARCHAR(50) NOT NULL,
  status_since TIMESTAMP WITH TIME ZONE NOT NULL,
  responsible_provider UUID REFERENCES users(id),
  responsible_nurse UUID REFERENCES users(id),
  pending_actions JSONB DEFAULT '[]'::jsonb, -- Labs, imaging, consults
  completed_actions JSONB DEFAULT '[]'::jsonb,
  alerts JSONB DEFAULT '[]'::jsonb, -- Critical results, delays
  last_updated TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_by UUID REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_ed_tracking_visit ON ed_tracking(ed_visit_id);
CREATE INDEX IF NOT EXISTS idx_ed_tracking_patient ON ed_tracking(patient_id);
CREATE INDEX IF NOT EXISTS idx_ed_tracking_status ON ed_tracking(current_status);
CREATE INDEX IF NOT EXISTS idx_ed_tracking_location ON ed_tracking(current_location);

-- ED Dispositions Table
CREATE TABLE IF NOT EXISTS ed_dispositions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ed_visit_id UUID NOT NULL REFERENCES ed_visits(id),
  patient_id UUID NOT NULL REFERENCES patients(id),
  disposition_date TIMESTAMP WITH TIME ZONE NOT NULL,
  disposition_type VARCHAR(100) NOT NULL CHECK (disposition_type IN (
    'discharge_home',
    'admit_to_ward',
    'admit_to_icu',
    'transfer_to_facility',
    'observation',
    'left_ama',
    'left_without_being_seen',
    'deceased',
    'psychiatric_admission'
  )),
  admitting_service VARCHAR(100),
  admitting_provider UUID REFERENCES users(id),
  admission_bed_id UUID REFERENCES beds(id),
  transfer_facility VARCHAR(255),
  discharge_diagnosis TEXT,
  discharge_medications TEXT,
  discharge_instructions TEXT,
  follow_up_required BOOLEAN DEFAULT false,
  follow_up_timeframe VARCHAR(100),
  follow_up_provider VARCHAR(255),
  prescriptions_provided TEXT,
  referrals_given TEXT,
  patient_education_provided BOOLEAN DEFAULT false,
  transportation_arranged BOOLEAN DEFAULT false,
  decided_by UUID REFERENCES users(id),
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ed_dispositions_visit ON ed_dispositions(ed_visit_id);
CREATE INDEX IF NOT EXISTS idx_ed_dispositions_patient ON ed_dispositions(patient_id);
CREATE INDEX IF NOT EXISTS idx_ed_dispositions_type ON ed_dispositions(disposition_type);
CREATE INDEX IF NOT EXISTS idx_ed_dispositions_date ON ed_dispositions(disposition_date);

-- ED Metrics Table
CREATE TABLE IF NOT EXISTS ed_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  metric_date DATE NOT NULL,
  shift VARCHAR(20), -- Day, evening, night
  total_visits INTEGER DEFAULT 0,
  esi_level_1 INTEGER DEFAULT 0,
  esi_level_2 INTEGER DEFAULT 0,
  esi_level_3 INTEGER DEFAULT 0,
  esi_level_4 INTEGER DEFAULT 0,
  esi_level_5 INTEGER DEFAULT 0,
  average_door_to_provider_time INTEGER,
  average_door_to_disposition_time INTEGER,
  average_los_discharged INTEGER,
  average_los_admitted INTEGER,
  admissions INTEGER DEFAULT 0,
  discharges INTEGER DEFAULT 0,
  transfers_out INTEGER DEFAULT 0,
  lwbs INTEGER DEFAULT 0, -- Left without being seen
  ama INTEGER DEFAULT 0, -- Against medical advice
  trauma_activations INTEGER DEFAULT 0,
  code_strokes INTEGER DEFAULT 0,
  code_stemis INTEGER DEFAULT 0,
  fast_track_visits INTEGER DEFAULT 0,
  occupancy_rate DECIMAL(5,2),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(metric_date, shift)
);

CREATE INDEX IF NOT EXISTS idx_ed_metrics_date ON ed_metrics(metric_date);

-- Add comments
COMMENT ON TABLE ed_visits IS 'Emergency department visit records';
COMMENT ON TABLE ed_triage_assessments IS 'ESI triage assessments with vital signs';
COMMENT ON TABLE ed_tracking IS 'Real-time ED tracking board data';
COMMENT ON TABLE ed_dispositions IS 'ED disposition and discharge planning';
COMMENT ON TABLE ed_metrics IS 'ED performance metrics and quality measures';

