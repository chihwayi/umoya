-- Sprint 22: Immunization Registry Integration
-- Date: December 3, 2025
-- Description: Vaccine administration tracking with public health registry integration

-- Immunizations Table
CREATE TABLE IF NOT EXISTS immunizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  immunization_number VARCHAR(50) UNIQUE NOT NULL,
  patient_id UUID NOT NULL REFERENCES patients(id),
  vaccine_code VARCHAR(20) NOT NULL, -- CVX code
  vaccine_name VARCHAR(255) NOT NULL,
  manufacturer VARCHAR(100),
  lot_number VARCHAR(50),
  expiration_date DATE,
  administration_date DATE NOT NULL,
  administration_time TIME,
  dose_number INTEGER,
  dose_quantity DECIMAL(10,2),
  dose_unit VARCHAR(20),
  route VARCHAR(50), -- IM, SC, PO, etc.
  site VARCHAR(100), -- Left deltoid, etc.
  administered_by UUID REFERENCES users(id),
  ordering_provider UUID REFERENCES users(id),
  appointment_id UUID REFERENCES appointments(id),
  vis_date DATE, -- Vaccine Information Statement date
  vis_presented BOOLEAN DEFAULT false,
  funding_source VARCHAR(100), -- Public, private, etc.
  completion_status VARCHAR(50) DEFAULT 'completed' CHECK (completion_status IN (
    'completed',
    'not_administered',
    'partially_administered',
    'entered_in_error'
  )),
  status_reason TEXT,
  notes TEXT,
  reaction_observed BOOLEAN DEFAULT false,
  reaction_details TEXT,
  reported_to_vaers BOOLEAN DEFAULT false,
  vaers_report_id VARCHAR(50),
  registry_submitted BOOLEAN DEFAULT false,
  registry_submission_date TIMESTAMP WITH TIME ZONE,
  registry_response TEXT,
  historical BOOLEAN DEFAULT false, -- Imported from other records
  historical_source VARCHAR(255),
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_immunizations_patient ON immunizations(patient_id);
CREATE INDEX IF NOT EXISTS idx_immunizations_vaccine ON immunizations(vaccine_code);
CREATE INDEX IF NOT EXISTS idx_immunizations_date ON immunizations(administration_date);
CREATE INDEX IF NOT EXISTS idx_immunizations_administered_by ON immunizations(administered_by);
CREATE INDEX IF NOT EXISTS idx_immunizations_registry ON immunizations(registry_submitted);
CREATE INDEX IF NOT EXISTS idx_immunizations_number ON immunizations(immunization_number);

-- Vaccine Inventory Table
CREATE TABLE IF NOT EXISTS vaccine_inventory (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vaccine_code VARCHAR(20) NOT NULL,
  vaccine_name VARCHAR(255) NOT NULL,
  manufacturer VARCHAR(100),
  lot_number VARCHAR(50) NOT NULL,
  expiration_date DATE NOT NULL,
  quantity_received INTEGER NOT NULL,
  quantity_remaining INTEGER NOT NULL,
  quantity_administered INTEGER DEFAULT 0,
  quantity_wasted INTEGER DEFAULT 0,
  storage_location VARCHAR(100),
  storage_temperature_min DECIMAL(5,2),
  storage_temperature_max DECIMAL(5,2),
  current_temperature DECIMAL(5,2),
  temperature_alert BOOLEAN DEFAULT false,
  received_date DATE NOT NULL,
  received_by UUID REFERENCES users(id),
  funding_source VARCHAR(100),
  cost_per_dose DECIMAL(10,2),
  ndc_code VARCHAR(20),
  status VARCHAR(50) DEFAULT 'active' CHECK (status IN (
    'active',
    'expired',
    'recalled',
    'depleted',
    'quarantined'
  )),
  recall_information TEXT,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(lot_number, vaccine_code)
);

CREATE INDEX IF NOT EXISTS idx_vaccine_inventory_code ON vaccine_inventory(vaccine_code);
CREATE INDEX IF NOT EXISTS idx_vaccine_inventory_lot ON vaccine_inventory(lot_number);
CREATE INDEX IF NOT EXISTS idx_vaccine_inventory_expiration ON vaccine_inventory(expiration_date);
CREATE INDEX IF NOT EXISTS idx_vaccine_inventory_status ON vaccine_inventory(status);

-- Immunization Schedules Table (CDC recommendations)
CREATE TABLE IF NOT EXISTS immunization_schedules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  schedule_name VARCHAR(255) NOT NULL,
  vaccine_code VARCHAR(20) NOT NULL,
  vaccine_name VARCHAR(255) NOT NULL,
  age_group VARCHAR(50) NOT NULL, -- infant, child, adolescent, adult
  minimum_age_months INTEGER,
  maximum_age_months INTEGER,
  dose_number INTEGER NOT NULL,
  recommended_age_months INTEGER,
  minimum_interval_days INTEGER, -- From previous dose
  is_required BOOLEAN DEFAULT true,
  schedule_type VARCHAR(50) DEFAULT 'routine' CHECK (schedule_type IN (
    'routine',
    'catch_up',
    'risk_based',
    'travel'
  )),
  contraindications JSONB DEFAULT '[]'::jsonb,
  precautions JSONB DEFAULT '[]'::jsonb,
  notes TEXT,
  cdc_schedule_version VARCHAR(20),
  effective_date DATE NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_immunization_schedules_vaccine ON immunization_schedules(vaccine_code);
CREATE INDEX IF NOT EXISTS idx_immunization_schedules_age ON immunization_schedules(age_group);
CREATE INDEX IF NOT EXISTS idx_immunization_schedules_active ON immunization_schedules(is_active);

-- Vaccine Adverse Events Table (VAERS)
CREATE TABLE IF NOT EXISTS vaccine_adverse_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  immunization_id UUID NOT NULL REFERENCES immunizations(id),
  patient_id UUID NOT NULL REFERENCES patients(id),
  event_date DATE NOT NULL,
  onset_interval VARCHAR(50), -- Hours/days after vaccination
  event_description TEXT NOT NULL,
  severity VARCHAR(50) NOT NULL CHECK (severity IN (
    'mild',
    'moderate',
    'severe',
    'life_threatening',
    'death'
  )),
  event_type VARCHAR(100), -- Fever, rash, allergic reaction, etc.
  treatment_required BOOLEAN DEFAULT false,
  treatment_details TEXT,
  hospitalization_required BOOLEAN DEFAULT false,
  hospitalization_details TEXT,
  outcome VARCHAR(100), -- Recovered, ongoing, permanent, death
  reported_by UUID REFERENCES users(id),
  reported_to_vaers BOOLEAN DEFAULT false,
  vaers_report_id VARCHAR(50),
  vaers_submission_date TIMESTAMP WITH TIME ZONE,
  vaers_response TEXT,
  followup_required BOOLEAN DEFAULT false,
  followup_notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_vaccine_adverse_events_immunization ON vaccine_adverse_events(immunization_id);
CREATE INDEX IF NOT EXISTS idx_vaccine_adverse_events_patient ON vaccine_adverse_events(patient_id);
CREATE INDEX IF NOT EXISTS idx_vaccine_adverse_events_severity ON vaccine_adverse_events(severity);
CREATE INDEX IF NOT EXISTS idx_vaccine_adverse_events_vaers ON vaccine_adverse_events(reported_to_vaers);

-- Registry Submissions Table
CREATE TABLE IF NOT EXISTS immunization_registry_submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  immunization_id UUID NOT NULL REFERENCES immunizations(id),
  patient_id UUID NOT NULL REFERENCES patients(id),
  registry_name VARCHAR(100) NOT NULL, -- State registry name
  submission_type VARCHAR(50) NOT NULL CHECK (submission_type IN (
    'new',
    'update',
    'delete',
    'historical'
  )),
  hl7_message TEXT, -- HL7 v2.5.1 VXU message
  submission_date TIMESTAMP WITH TIME ZONE NOT NULL,
  submission_status VARCHAR(50) DEFAULT 'pending' CHECK (submission_status IN (
    'pending',
    'sent',
    'acknowledged',
    'rejected',
    'error'
  )),
  acknowledgment_date TIMESTAMP WITH TIME ZONE,
  acknowledgment_message TEXT,
  error_details TEXT,
  retry_count INTEGER DEFAULT 0,
  next_retry_at TIMESTAMP WITH TIME ZONE,
  submitted_by UUID REFERENCES users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_registry_submissions_immunization ON immunization_registry_submissions(immunization_id);
CREATE INDEX IF NOT EXISTS idx_registry_submissions_patient ON immunization_registry_submissions(patient_id);
CREATE INDEX IF NOT EXISTS idx_registry_submissions_status ON immunization_registry_submissions(submission_status);
CREATE INDEX IF NOT EXISTS idx_registry_submissions_date ON immunization_registry_submissions(submission_date);

-- Patient Immunization Forecasts Table
CREATE TABLE IF NOT EXISTS immunization_forecasts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID NOT NULL REFERENCES patients(id),
  vaccine_code VARCHAR(20) NOT NULL,
  vaccine_name VARCHAR(255) NOT NULL,
  dose_number INTEGER NOT NULL,
  forecast_status VARCHAR(50) NOT NULL CHECK (forecast_status IN (
    'due',
    'overdue',
    'upcoming',
    'contraindicated',
    'immune',
    'complete'
  )),
  earliest_date DATE,
  recommended_date DATE,
  overdue_date DATE,
  reasoning TEXT,
  schedule_used VARCHAR(100),
  last_calculated TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_immunization_forecasts_patient ON immunization_forecasts(patient_id);
CREATE INDEX IF NOT EXISTS idx_immunization_forecasts_status ON immunization_forecasts(forecast_status);
CREATE INDEX IF NOT EXISTS idx_immunization_forecasts_due_date ON immunization_forecasts(recommended_date);

-- Insert default CDC immunization schedule (subset - key vaccines)
INSERT INTO immunization_schedules (
  schedule_name, vaccine_code, vaccine_name, age_group,
  minimum_age_months, recommended_age_months, dose_number,
  minimum_interval_days, schedule_type, cdc_schedule_version, effective_date
) VALUES
-- DTaP Series
('DTaP Dose 1', '20', 'DTaP', 'infant', 2, 2, 1, 0, 'routine', '2025', '2025-01-01'),
('DTaP Dose 2', '20', 'DTaP', 'infant', 4, 4, 2, 28, 'routine', '2025', '2025-01-01'),
('DTaP Dose 3', '20', 'DTaP', 'infant', 6, 6, 3, 28, 'routine', '2025', '2025-01-01'),
('DTaP Dose 4', '20', 'DTaP', 'child', 15, 15, 4, 180, 'routine', '2025', '2025-01-01'),
('DTaP Dose 5', '20', 'DTaP', 'child', 48, 48, 5, 180, 'routine', '2025', '2025-01-01'),

-- MMR Series
('MMR Dose 1', '03', 'MMR', 'child', 12, 12, 1, 0, 'routine', '2025', '2025-01-01'),
('MMR Dose 2', '03', 'MMR', 'child', 48, 48, 2, 84, 'routine', '2025', '2025-01-01'),

-- Hepatitis B Series
('Hep B Dose 1', '08', 'Hepatitis B', 'infant', 0, 0, 1, 0, 'routine', '2025', '2025-01-01'),
('Hep B Dose 2', '08', 'Hepatitis B', 'infant', 1, 1, 2, 28, 'routine', '2025', '2025-01-01'),
('Hep B Dose 3', '08', 'Hepatitis B', 'infant', 6, 6, 3, 56, 'routine', '2025', '2025-01-01'),

-- Polio Series
('IPV Dose 1', '10', 'Polio', 'infant', 2, 2, 1, 0, 'routine', '2025', '2025-01-01'),
('IPV Dose 2', '10', 'Polio', 'infant', 4, 4, 2, 28, 'routine', '2025', '2025-01-01'),
('IPV Dose 3', '10', 'Polio', 'infant', 6, 6, 3, 28, 'routine', '2025', '2025-01-01'),
('IPV Dose 4', '10', 'Polio', 'child', 48, 48, 4, 180, 'routine', '2025', '2025-01-01'),

-- COVID-19
('COVID-19 Dose 1', '213', 'COVID-19', 'adult', 0, 0, 1, 0, 'routine', '2025', '2025-01-01'),
('COVID-19 Dose 2', '213', 'COVID-19', 'adult', 0, 0, 2, 21, 'routine', '2025', '2025-01-01'),

-- Influenza (Annual)
('Influenza Annual', '141', 'Influenza', 'infant', 6, 6, 1, 365, 'routine', '2025', '2025-01-01'),

-- HPV Series
('HPV Dose 1', '137', 'HPV', 'adolescent', 132, 132, 1, 0, 'routine', '2025', '2025-01-01'),
('HPV Dose 2', '137', 'HPV', 'adolescent', 138, 138, 2, 168, 'routine', '2025', '2025-01-01');

-- Add comments
COMMENT ON TABLE immunizations IS 'Vaccine administration records with registry integration';
COMMENT ON TABLE vaccine_inventory IS 'Vaccine stock management with temperature monitoring';
COMMENT ON TABLE immunization_schedules IS 'CDC immunization schedules and recommendations';
COMMENT ON TABLE vaccine_adverse_events IS 'VAERS adverse event tracking';
COMMENT ON TABLE immunization_registry_submissions IS 'Public health registry submission log';
COMMENT ON TABLE immunization_forecasts IS 'Patient-specific vaccine due dates and recommendations';

