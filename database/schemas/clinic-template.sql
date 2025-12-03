-- Template Database Schema for Individual Clinic Tenants
-- This schema is applied to each tenant's dedicated database

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Users table (clinic staff)
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    role VARCHAR(50) NOT NULL CHECK (role IN ('doctor', 'nurse', 'receptionist', 'admin', 'pharmacist')),
    license_number VARCHAR(100),
    specialization VARCHAR(100),
    phone VARCHAR(50),
    is_active BOOLEAN DEFAULT true,
    must_change_password BOOLEAN DEFAULT false,
    password_changed_at TIMESTAMP WITH TIME ZONE,
    last_login TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Patients table
CREATE TABLE patients (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    patient_number VARCHAR(50) UNIQUE NOT NULL,
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    date_of_birth DATE NOT NULL,
    gender VARCHAR(10) CHECK (gender IN ('male', 'female', 'other')),
    id_number VARCHAR(50) UNIQUE,
    phone VARCHAR(50),
    email VARCHAR(255),
    address TEXT,
    city VARCHAR(100),
    emergency_contact_name VARCHAR(200),
    emergency_contact_phone VARCHAR(50),
    medical_aid_name VARCHAR(100),
    medical_aid_number VARCHAR(100),
    medical_aid_plan VARCHAR(100),
    blood_type VARCHAR(5),
    allergies TEXT,
    chronic_conditions TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Appointments table
CREATE TABLE appointments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    patient_id UUID REFERENCES patients(id) ON DELETE CASCADE,
    doctor_id UUID REFERENCES users(id),
    appointment_date TIMESTAMP WITH TIME ZONE NOT NULL,
    duration_minutes INTEGER DEFAULT 30,
    appointment_type VARCHAR(100) NOT NULL,
    status VARCHAR(50) DEFAULT 'scheduled' CHECK (status IN ('awaiting_payment', 'scheduled', 'confirmed', 'in_progress', 'in-progress', 'completed', 'cancelled', 'no_show', 'no-show')),
    reason TEXT,
    notes TEXT,
    fee_amount NUMERIC(12,2),
    finance_transaction_id UUID,
    payment_status VARCHAR(50) DEFAULT 'awaiting_payment' CHECK (payment_status IN ('awaiting_payment','payment_confirmed','in_progress','completed','cancelled')),
    patient_instructions TEXT,
    priority_level VARCHAR(50) DEFAULT 'normal' CHECK (priority_level IN ('low', 'normal', 'high', 'urgent')),
    virtual_meeting_url VARCHAR(500),
    is_telehealth BOOLEAN DEFAULT false,
    check_in_time TIMESTAMP WITH TIME ZONE,
    actual_start_time TIMESTAMP WITH TIME ZONE,
    actual_end_time TIMESTAMP WITH TIME ZONE,
    wait_time_minutes INTEGER,
    recurring_pattern VARCHAR(100),
    parent_appointment_id UUID REFERENCES appointments(id),
    cancellation_reason TEXT,
    preparation_notes TEXT,
    estimated_cost DECIMAL(10,2),
    insurance_verified BOOLEAN DEFAULT false,
    reminder_sent_count INTEGER DEFAULT 0,
    last_reminder_sent TIMESTAMP WITH TIME ZONE,
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Medical records table
CREATE TABLE medical_records (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    patient_id UUID REFERENCES patients(id) ON DELETE CASCADE,
    appointment_id UUID REFERENCES appointments(id),
    doctor_id UUID REFERENCES users(id),
    visit_date TIMESTAMP WITH TIME ZONE NOT NULL,
    chief_complaint TEXT,
    history_present_illness TEXT,
    physical_examination TEXT,
    assessment TEXT,
    plan TEXT,
    vital_signs JSONB,
    diagnosis_codes TEXT[], -- ICD-10 codes
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Prescriptions table
CREATE TABLE prescriptions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    medical_record_id UUID REFERENCES medical_records(id) ON DELETE CASCADE,
    patient_id UUID REFERENCES patients(id) ON DELETE CASCADE,
    doctor_id UUID REFERENCES users(id),
    medication_name VARCHAR(255) NOT NULL,
    dosage VARCHAR(100) NOT NULL,
    frequency VARCHAR(100) NOT NULL,
    duration VARCHAR(100),
    quantity INTEGER,
    instructions TEXT,
    status VARCHAR(50) DEFAULT 'active' CHECK (status IN ('active', 'completed', 'cancelled')),
    prescribed_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Billing table
CREATE TABLE billing (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    patient_id UUID REFERENCES patients(id) ON DELETE CASCADE,
    appointment_id UUID REFERENCES appointments(id),
    invoice_number VARCHAR(100) UNIQUE NOT NULL,
    invoice_date DATE NOT NULL,
    due_date DATE,
    subtotal DECIMAL(10,2) NOT NULL,
    tax_amount DECIMAL(10,2) DEFAULT 0,
    discount_amount DECIMAL(10,2) DEFAULT 0,
    total_amount DECIMAL(10,2) NOT NULL,
    currency VARCHAR(3) DEFAULT 'USD',
    status VARCHAR(50) DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'overdue', 'cancelled')),
    payment_method VARCHAR(50),
    payment_date TIMESTAMP WITH TIME ZONE,
    diagnosis_codes TEXT[], -- ICD-10 diagnosis codes
    primary_diagnosis_code VARCHAR(50), -- Primary ICD-10 diagnosis code
    primary_diagnosis_description TEXT, -- Description of primary diagnosis
    notes TEXT,
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Billing items table
CREATE TABLE billing_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    billing_id UUID REFERENCES billing(id) ON DELETE CASCADE,
    description VARCHAR(255) NOT NULL,
    quantity INTEGER DEFAULT 1,
    unit_price DECIMAL(10,2) NOT NULL,
    total_price DECIMAL(10,2) NOT NULL,
    service_code VARCHAR(50), -- Medical aid service codes
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Medical aid claims table
CREATE TABLE medical_aid_claims (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    patient_id UUID REFERENCES patients(id) ON DELETE CASCADE,
    billing_id UUID REFERENCES billing(id),
    claim_number VARCHAR(100) UNIQUE NOT NULL,
    medical_aid_name VARCHAR(100) NOT NULL,
    member_number VARCHAR(100) NOT NULL,
    claim_amount DECIMAL(10,2) NOT NULL,
    approved_amount DECIMAL(10,2),
    status VARCHAR(50) DEFAULT 'submitted' CHECK (status IN ('draft', 'submitted', 'processing', 'approved', 'rejected', 'paid')),
    submission_date TIMESTAMP WITH TIME ZONE,
    response_date TIMESTAMP WITH TIME ZONE,
    rejection_reason TEXT,
    diagnosis_codes TEXT[], -- ICD-10 diagnosis codes
    primary_diagnosis_code VARCHAR(50), -- Primary ICD-10 diagnosis code
    primary_diagnosis_description TEXT, -- Description of primary diagnosis
    claim_data JSONB, -- Store claim details in structured format
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Laboratory results table
CREATE TABLE lab_results (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    patient_id UUID REFERENCES patients(id) ON DELETE CASCADE,
    medical_record_id UUID REFERENCES medical_records(id),
    test_name VARCHAR(255) NOT NULL,
    test_code VARCHAR(50),
    result_value VARCHAR(255),
    reference_range VARCHAR(100),
    unit VARCHAR(50),
    status VARCHAR(50) DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'cancelled')),
    test_date TIMESTAMP WITH TIME ZONE,
    result_date TIMESTAMP WITH TIME ZONE,
    lab_name VARCHAR(255),
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Audit log table
CREATE TABLE audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id),
    action VARCHAR(100) NOT NULL,
    table_name VARCHAR(100) NOT NULL,
    record_id UUID,
    old_values JSONB,
    new_values JSONB,
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Nursing tables
CREATE TABLE vitals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
    blood_pressure VARCHAR(20),
    heart_rate INTEGER,
    temperature DECIMAL(4,2),
    oxygen_saturation INTEGER,
    respiratory_rate INTEGER,
    weight DECIMAL(5,2),
    height DECIMAL(5,2),
    bmi DECIMAL(4,2),
    pain_level INTEGER CHECK (pain_level >= 0 AND pain_level <= 10),
    blood_glucose DECIMAL(5,2),
    notes TEXT,
    recorded_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    recorded_by UUID NOT NULL REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE triage_assessments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
    chief_complaint TEXT NOT NULL,
    onset TEXT,
    pain_score INTEGER CHECK (pain_score >= 0 AND pain_score <= 10),
    allergies TEXT,
    medications TEXT,
    history TEXT,
    observations TEXT,
    priority VARCHAR(20) NOT NULL CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
    severity_score INTEGER CHECK (severity_score >= 0 AND severity_score <= 10),
    recorded_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    recorded_by UUID NOT NULL REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE nursing_notes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
    note_type VARCHAR(50) NOT NULL CHECK (note_type IN ('general', 'assessment', 'intervention', 'evaluation')),
    content TEXT NOT NULL,
    vital_signs TEXT,
    medications TEXT,
    observations TEXT,
    interventions TEXT,
    outcomes TEXT,
    recorded_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    recorded_by UUID NOT NULL REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Orders table for doctor-nurse workflow
CREATE TABLE orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
    appointment_id UUID REFERENCES appointments(id) ON DELETE CASCADE,
    doctor_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    order_type VARCHAR(50) NOT NULL CHECK (order_type IN ('medication', 'procedure', 'lab_test', 'imaging', 'consultation', 'diet', 'activity')),
    order_name VARCHAR(255) NOT NULL,
    description TEXT,
    instructions TEXT NOT NULL,
    dosage VARCHAR(100),
    frequency VARCHAR(100),
    duration VARCHAR(100),
    priority VARCHAR(20) NOT NULL DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
    status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'authorized', 'in_progress', 'completed', 'cancelled', 'rejected')),
    snomed_concept_id VARCHAR(50),
    snomed_term TEXT,
    snomed_module_id VARCHAR(50),
    snomed_definition_status VARCHAR(50),
    external_codes JSONB DEFAULT '{}'::jsonb,
    authorized_by UUID REFERENCES users(id),
    authorized_at TIMESTAMP WITH TIME ZONE,
    executed_by UUID REFERENCES users(id),
    executed_at TIMESTAMP WITH TIME ZONE,
    execution_notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX idx_patients_patient_number ON patients(patient_number);
CREATE INDEX idx_patients_id_number ON patients(id_number);
CREATE INDEX idx_patients_name ON patients(last_name, first_name);
CREATE INDEX idx_appointments_patient_id ON appointments(patient_id);
CREATE INDEX idx_appointments_doctor_id ON appointments(doctor_id);
CREATE INDEX idx_appointments_date ON appointments(appointment_date);
CREATE INDEX idx_appointments_parent_id ON appointments(parent_appointment_id);
CREATE INDEX idx_appointments_priority ON appointments(priority_level);
CREATE INDEX idx_appointments_telehealth ON appointments(is_telehealth);
CREATE INDEX idx_appointments_created_by ON appointments(created_by);
CREATE INDEX idx_medical_records_patient_id ON medical_records(patient_id);
CREATE INDEX idx_medical_records_visit_date ON medical_records(visit_date);
CREATE INDEX idx_prescriptions_patient_id ON prescriptions(patient_id);
CREATE INDEX idx_billing_patient_id ON billing(patient_id);
CREATE INDEX idx_billing_invoice_number ON billing(invoice_number);
CREATE INDEX idx_claims_patient_id ON medical_aid_claims(patient_id);
CREATE INDEX idx_claims_claim_number ON medical_aid_claims(claim_number);
CREATE INDEX idx_claims_status ON medical_aid_claims(status);
CREATE INDEX idx_lab_results_patient_id ON lab_results(patient_id);
CREATE INDEX idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX idx_audit_logs_created_at ON audit_logs(created_at);

-- Nursing table indexes
CREATE INDEX idx_vitals_patient_id ON vitals(patient_id);
CREATE INDEX idx_vitals_recorded_at ON vitals(recorded_at);
CREATE INDEX idx_vitals_recorded_by ON vitals(recorded_by);
CREATE INDEX idx_triage_patient_id ON triage_assessments(patient_id);
CREATE INDEX idx_triage_priority ON triage_assessments(priority);
CREATE INDEX idx_triage_recorded_at ON triage_assessments(recorded_at);
CREATE INDEX idx_triage_recorded_by ON triage_assessments(recorded_by);
CREATE INDEX idx_nursing_notes_patient_id ON nursing_notes(patient_id);
CREATE INDEX idx_nursing_notes_note_type ON nursing_notes(note_type);
CREATE INDEX idx_nursing_notes_recorded_at ON nursing_notes(recorded_at);
CREATE INDEX idx_nursing_notes_recorded_by ON nursing_notes(recorded_by);

-- Orders table indexes
CREATE INDEX idx_orders_patient_id ON orders(patient_id);
CREATE INDEX idx_orders_appointment_id ON orders(appointment_id);
CREATE INDEX idx_orders_doctor_id ON orders(doctor_id);
CREATE INDEX idx_orders_status ON orders(status);
CREATE INDEX idx_orders_type ON orders(order_type);
CREATE INDEX idx_orders_authorized_by ON orders(authorized_by);
CREATE INDEX idx_orders_executed_by ON orders(executed_by);
CREATE INDEX idx_orders_created_at ON orders(created_at);
CREATE INDEX idx_orders_snomed_concept ON orders(snomed_concept_id);

-- Problems list (structured diagnoses)
CREATE TABLE IF NOT EXISTS problems (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
    code VARCHAR(50), -- Legacy field for backwards compatibility (stores SNOMED concept ID)
    code_system VARCHAR(50) NOT NULL DEFAULT 'SNOMED_CT',
    snomed_concept_id VARCHAR(50),
    snomed_term TEXT,
    snomed_module_id VARCHAR(50),
    snomed_definition_status VARCHAR(50),
    description TEXT NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active','resolved')),
    onset_date DATE,
    resolved_date DATE,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Allergies and adverse reactions
CREATE TABLE IF NOT EXISTS allergies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
    allergen VARCHAR(255) NOT NULL,
    allergen_snomed_code VARCHAR(50),
    allergen_snomed_term TEXT,
    allergen_snomed_module_id VARCHAR(50),
    reaction TEXT,
    reaction_snomed_code VARCHAR(50),
    reaction_snomed_term TEXT,
    severity VARCHAR(20) CHECK (severity IN ('mild','moderate','severe')),
    severity_snomed_code VARCHAR(50),
    severity_snomed_term TEXT,
    recorded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    recorded_by UUID REFERENCES users(id),
    verification_status VARCHAR(50),
    clinical_status VARCHAR(50)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_problems_patient_id ON problems(patient_id);
CREATE INDEX IF NOT EXISTS idx_problems_snomed_concept ON problems(snomed_concept_id);
CREATE INDEX IF NOT EXISTS idx_problems_status ON problems(status);
CREATE INDEX IF NOT EXISTS idx_allergies_patient_id ON allergies(patient_id);
CREATE INDEX IF NOT EXISTS idx_allergies_snomed_allergen ON allergies(allergen_snomed_code);
CREATE INDEX IF NOT EXISTS idx_allergies_reaction_snomed ON allergies(reaction_snomed_code);

-- Trigger to update updated_at timestamp
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_patients_updated_at BEFORE UPDATE ON patients
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_appointments_updated_at BEFORE UPDATE ON appointments
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_medical_records_updated_at BEFORE UPDATE ON medical_records
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_billing_updated_at BEFORE UPDATE ON billing
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_claims_updated_at BEFORE UPDATE ON medical_aid_claims
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Nursing table triggers
CREATE TRIGGER update_vitals_updated_at BEFORE UPDATE ON vitals
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_triage_assessments_updated_at BEFORE UPDATE ON triage_assessments
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_nursing_notes_updated_at BEFORE UPDATE ON nursing_notes
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_orders_updated_at BEFORE UPDATE ON orders
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_problems_updated_at BEFORE UPDATE ON problems
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Cardiology module
CREATE TABLE IF NOT EXISTS cardiology_encounters (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
    encounter_date TIMESTAMP WITH TIME ZONE NOT NULL,
    encounter_type VARCHAR(50) CHECK (encounter_type IN ('clinic_visit','diagnostic_test','heart_failure_review','telecardiology','rehabilitation','other')),
    cardiologist_id UUID REFERENCES users(id),
    visit_reason TEXT,
    reason_snomed_code VARCHAR(50),
    reason_snomed_term TEXT,
    reason_snomed_module_id VARCHAR(50),
    reason_snomed_definition_status VARCHAR(50),
    presenting_symptoms TEXT,
    symptom_snomed_codes JSONB DEFAULT '[]'::jsonb,
    hemodynamics JSONB DEFAULT '{}'::jsonb,
    diagnostic_tests JSONB DEFAULT '[]'::jsonb,
    diagnostic_snomed_codes JSONB DEFAULT '[]'::jsonb,
    care_plan TEXT,
    follow_up_plan TEXT,
    risk_score VARCHAR(20) CHECK (risk_score IN ('low','moderate','high','critical')),
    care_status VARCHAR(30) DEFAULT 'scheduled' CHECK (care_status IN ('awaiting_payment','scheduled','in_progress','completed','cancelled')),
    fee_amount NUMERIC(12,2),
    finance_transaction_id UUID,
    payment_status VARCHAR(50) DEFAULT 'awaiting_payment' CHECK (payment_status IN ('awaiting_payment','payment_confirmed','in_progress','completed','cancelled')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_cardiology_encounters_patient_id ON cardiology_encounters(patient_id);
CREATE INDEX IF NOT EXISTS idx_cardiology_encounters_date ON cardiology_encounters(encounter_date);
CREATE INDEX IF NOT EXISTS idx_cardiology_encounters_payment_status ON cardiology_encounters(payment_status);
CREATE INDEX IF NOT EXISTS idx_cardiology_encounters_care_status ON cardiology_encounters(care_status);
CREATE INDEX IF NOT EXISTS idx_cardiology_encounters_reason_snomed ON cardiology_encounters(reason_snomed_code);
CREATE INDEX IF NOT EXISTS idx_cardiology_encounters_risk_score ON cardiology_encounters(risk_score);-- Appointment Templates Table
CREATE TABLE IF NOT EXISTS appointment_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  type VARCHAR(100) NOT NULL,
  duration_minutes INTEGER NOT NULL DEFAULT 30,
  instructions TEXT,
  color VARCHAR(7) DEFAULT '#3B82F6',
  is_active BOOLEAN DEFAULT true,
  created_by UUID,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_appointment_templates_type ON appointment_templates(type);
CREATE INDEX IF NOT EXISTS idx_appointment_templates_active ON appointment_templates(is_active);

-- Trigger to update updated_at
CREATE OR REPLACE FUNCTION update_appointment_templates_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_appointment_templates_updated_at
  BEFORE UPDATE ON appointment_templates
  FOR EACH ROW
  EXECUTE FUNCTION update_appointment_templates_updated_at();

-- Appointment Resources (Rooms & Equipment)
CREATE TABLE IF NOT EXISTS appointment_resources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  type VARCHAR(50) NOT NULL CHECK (type IN ('room', 'equipment')),
  description TEXT,
  capacity INTEGER, -- For rooms: max occupancy
  location VARCHAR(255), -- For equipment: storage location
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_appointment_resources_type ON appointment_resources(type);
CREATE INDEX IF NOT EXISTS idx_appointment_resources_active ON appointment_resources(is_active);

-- Appointment Resource Bookings
CREATE TABLE IF NOT EXISTS appointment_resource_bookings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  appointment_id UUID NOT NULL REFERENCES appointments(id) ON DELETE CASCADE,
  resource_id UUID NOT NULL REFERENCES appointment_resources(id) ON DELETE CASCADE,
  booking_start TIMESTAMPTZ NOT NULL,
  booking_end TIMESTAMPTZ NOT NULL,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(appointment_id, resource_id, booking_start)
);

CREATE INDEX IF NOT EXISTS idx_appointment_resource_bookings_appointment ON appointment_resource_bookings(appointment_id);
CREATE INDEX IF NOT EXISTS idx_appointment_resource_bookings_resource ON appointment_resource_bookings(resource_id);
CREATE INDEX IF NOT EXISTS idx_appointment_resource_bookings_time ON appointment_resource_bookings(booking_start, booking_end);

-- Trigger to update updated_at
CREATE OR REPLACE FUNCTION update_appointment_resources_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_appointment_resources_updated_at
  BEFORE UPDATE ON appointment_resources
  FOR EACH ROW
  EXECUTE FUNCTION update_appointment_resources_updated_at();

CREATE TRIGGER trigger_appointment_resource_bookings_updated_at
  BEFORE UPDATE ON appointment_resource_bookings
  FOR EACH ROW
  EXECUTE FUNCTION update_appointment_resources_updated_at();


-- Clinical Note Templates Table
CREATE TABLE IF NOT EXISTS clinical_note_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  category VARCHAR(50) NOT NULL,
  content TEXT NOT NULL,
  variables JSONB DEFAULT '[]'::jsonb,
  specialty VARCHAR(100),
  is_default BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT true,
  usage_count INTEGER DEFAULT 0,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_clinical_note_templates_category ON clinical_note_templates(category);
CREATE INDEX IF NOT EXISTS idx_clinical_note_templates_is_active ON clinical_note_templates(is_active);
CREATE INDEX IF NOT EXISTS idx_clinical_note_templates_is_default ON clinical_note_templates(is_default);

-- Trigger to update updated_at for clinical_note_templates
CREATE OR REPLACE FUNCTION update_clinical_note_templates_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_clinical_note_templates_updated_at
  BEFORE UPDATE ON clinical_note_templates
  FOR EACH ROW
  EXECUTE FUNCTION update_clinical_note_templates_updated_at();

-- Indexes for billing diagnosis codes
CREATE INDEX IF NOT EXISTS idx_billing_primary_diagnosis_code ON billing(primary_diagnosis_code);

-- Indexes for medical_aid_claims diagnosis codes
CREATE INDEX IF NOT EXISTS idx_claims_primary_diagnosis_code ON medical_aid_claims(primary_diagnosis_code);
CREATE INDEX IF NOT EXISTS idx_claims_diagnosis_codes ON medical_aid_claims USING GIN(diagnosis_codes);
-- Add patient portal access fields to patients table
-- This allows patients to register and login to the portal

ALTER TABLE patients 
ADD COLUMN IF NOT EXISTS portal_password_hash VARCHAR(255),
ADD COLUMN IF NOT EXISTS portal_access_enabled BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS portal_registered_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS portal_last_login TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS portal_email_verified BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS portal_email_verification_token VARCHAR(255),
ADD COLUMN IF NOT EXISTS portal_password_reset_token VARCHAR(255),
ADD COLUMN IF NOT EXISTS portal_password_reset_expires TIMESTAMPTZ;

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_patients_portal_email ON patients(email) WHERE portal_access_enabled = true;
CREATE INDEX IF NOT EXISTS idx_patients_portal_verification_token ON patients(portal_email_verification_token) WHERE portal_email_verification_token IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_patients_portal_reset_token ON patients(portal_password_reset_token) WHERE portal_password_reset_token IS NOT NULL;

-- Add comments
COMMENT ON COLUMN patients.portal_password_hash IS 'Hashed password for patient portal access';
COMMENT ON COLUMN patients.portal_access_enabled IS 'Whether patient has portal access enabled';
COMMENT ON COLUMN patients.portal_registered_at IS 'When patient registered for portal access';
COMMENT ON COLUMN patients.portal_last_login IS 'Last portal login timestamp';
COMMENT ON COLUMN patients.portal_email_verified IS 'Whether patient email is verified';
COMMENT ON COLUMN patients.portal_email_verification_token IS 'Token for email verification';
COMMENT ON COLUMN patients.portal_password_reset_token IS 'Token for password reset';
COMMENT ON COLUMN patients.portal_password_reset_expires IS 'Password reset token expiration';

-- HIPAA Audit Logs Table
-- This table stores comprehensive audit logs for all PHI access and modifications
-- Required for HIPAA compliance (45 CFR §164.308(a)(1)(ii)(D) and §164.312(b))

CREATE TABLE IF NOT EXISTS hipaa_audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID,
  user_name VARCHAR(255),
  user_role VARCHAR(50),
  action VARCHAR(100) NOT NULL,
  resource_type VARCHAR(100) NOT NULL,
  resource_id UUID,
  patient_id UUID,
  ip_address INET,
  user_agent TEXT,
  session_id VARCHAR(255),
  outcome VARCHAR(20) NOT NULL CHECK (outcome IN ('success', 'failure', 'denied')),
  reason TEXT,
  data_accessed JSONB,
  old_values JSONB,
  new_values JSONB,
  metadata JSONB,
  risk_level VARCHAR(20) CHECK (risk_level IN ('low', 'medium', 'high', 'critical')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_hipaa_audit_logs_user_id ON hipaa_audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_hipaa_audit_logs_patient_id ON hipaa_audit_logs(patient_id);
CREATE INDEX IF NOT EXISTS idx_hipaa_audit_logs_action ON hipaa_audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_hipaa_audit_logs_resource_type ON hipaa_audit_logs(resource_type);
CREATE INDEX IF NOT EXISTS idx_hipaa_audit_logs_created_at ON hipaa_audit_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_hipaa_audit_logs_outcome ON hipaa_audit_logs(outcome);
CREATE INDEX IF NOT EXISTS idx_hipaa_audit_logs_risk_level ON hipaa_audit_logs(risk_level);
CREATE INDEX IF NOT EXISTS idx_hipaa_audit_logs_session_id ON hipaa_audit_logs(session_id);

-- Composite indexes for common queries
CREATE INDEX IF NOT EXISTS idx_hipaa_audit_logs_patient_created ON hipaa_audit_logs(patient_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_hipaa_audit_logs_user_created ON hipaa_audit_logs(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_hipaa_audit_logs_action_created ON hipaa_audit_logs(action, created_at DESC);

-- Comments for documentation
COMMENT ON TABLE hipaa_audit_logs IS 'HIPAA-compliant audit log for all PHI access and modifications';
COMMENT ON COLUMN hipaa_audit_logs.user_id IS 'ID of the user who performed the action';
COMMENT ON COLUMN hipaa_audit_logs.user_name IS 'Name of the user who performed the action';
COMMENT ON COLUMN hipaa_audit_logs.user_role IS 'Role of the user who performed the action';
COMMENT ON COLUMN hipaa_audit_logs.action IS 'Type of action performed (e.g., patient_view, patient_update)';
COMMENT ON COLUMN hipaa_audit_logs.resource_type IS 'Type of resource accessed (e.g., patient, medical_record)';
COMMENT ON COLUMN hipaa_audit_logs.resource_id IS 'ID of the resource accessed';
COMMENT ON COLUMN hipaa_audit_logs.patient_id IS 'ID of the patient whose PHI was accessed';
COMMENT ON COLUMN hipaa_audit_logs.ip_address IS 'IP address of the user';
COMMENT ON COLUMN hipaa_audit_logs.user_agent IS 'User agent string from the request';
COMMENT ON COLUMN hipaa_audit_logs.session_id IS 'Session ID for tracking user sessions';
COMMENT ON COLUMN hipaa_audit_logs.outcome IS 'Outcome of the action: success, failure, or denied';
COMMENT ON COLUMN hipaa_audit_logs.reason IS 'Reason for failure or denial';
COMMENT ON COLUMN hipaa_audit_logs.data_accessed IS 'JSON object containing fields accessed and record count';
COMMENT ON COLUMN hipaa_audit_logs.old_values IS 'Previous values for update operations';
COMMENT ON COLUMN hipaa_audit_logs.new_values IS 'New values for update operations';
COMMENT ON COLUMN hipaa_audit_logs.metadata IS 'Additional metadata about the action';
COMMENT ON COLUMN hipaa_audit_logs.risk_level IS 'Risk level: low, medium, high, or critical';
COMMENT ON COLUMN hipaa_audit_logs.created_at IS 'Timestamp when the action occurred';

-- Sprint 21: E-Consent Management System
-- Date: December 3, 2025
-- Description: Digital consent forms with e-signatures, version control, and audit trails

-- Consent Templates Table
CREATE TABLE IF NOT EXISTS consent_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_name VARCHAR(255) NOT NULL,
  template_code VARCHAR(100) NOT NULL UNIQUE,
  consent_type VARCHAR(50) NOT NULL CHECK (consent_type IN (
    'treatment',
    'surgery',
    'procedure',
    'research',
    'hipaa',
    'photography',
    'release_of_information',
    'financial',
    'telehealth',
    'vaccine',
    'anesthesia',
    'blood_transfusion',
    'general'
  )),
  version VARCHAR(20) NOT NULL,
  language_code VARCHAR(10) DEFAULT 'en',
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  required_fields JSONB DEFAULT '[]'::jsonb,
  signature_requirements JSONB NOT NULL DEFAULT '{
    "patient": true,
    "guardian": false,
    "witness": false,
    "provider": true
  }'::jsonb,
  validity_period_days INTEGER,
  is_active BOOLEAN DEFAULT true,
  is_default BOOLEAN DEFAULT false,
  specialty VARCHAR(100),
  procedure_codes JSONB DEFAULT '[]'::jsonb,
  notes TEXT,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  effective_date DATE NOT NULL,
  expiration_date DATE
);

CREATE INDEX IF NOT EXISTS idx_consent_templates_type ON consent_templates(consent_type);
CREATE INDEX IF NOT EXISTS idx_consent_templates_code ON consent_templates(template_code);
CREATE INDEX IF NOT EXISTS idx_consent_templates_active ON consent_templates(is_active);
CREATE INDEX IF NOT EXISTS idx_consent_templates_language ON consent_templates(language_code);
CREATE INDEX IF NOT EXISTS idx_consent_templates_specialty ON consent_templates(specialty);

-- Patient Consents Table
CREATE TABLE IF NOT EXISTS patient_consents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  consent_number VARCHAR(50) UNIQUE NOT NULL,
  patient_id UUID NOT NULL REFERENCES patients(id),
  template_id UUID REFERENCES consent_templates(id),
  template_version VARCHAR(20) NOT NULL,
  consent_type VARCHAR(50) NOT NULL,
  appointment_id UUID REFERENCES appointments(id),
  procedure_id UUID,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  filled_fields JSONB DEFAULT '{}'::jsonb,
  status VARCHAR(50) NOT NULL DEFAULT 'pending' CHECK (status IN (
    'pending',
    'signed',
    'declined',
    'expired',
    'revoked',
    'superseded'
  )),
  language_code VARCHAR(10) DEFAULT 'en',
  consent_date TIMESTAMP WITH TIME ZONE,
  valid_from TIMESTAMP WITH TIME ZONE,
  valid_until TIMESTAMP WITH TIME ZONE,
  location VARCHAR(255),
  ip_address INET,
  user_agent TEXT,
  presented_by UUID REFERENCES users(id),
  presented_at TIMESTAMP WITH TIME ZONE,
  signed_at TIMESTAMP WITH TIME ZONE,
  declined_at TIMESTAMP WITH TIME ZONE,
  decline_reason TEXT,
  revoked_at TIMESTAMP WITH TIME ZONE,
  revocation_reason TEXT,
  revoked_by UUID REFERENCES users(id),
  superseded_by UUID REFERENCES patient_consents(id),
  notes TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_patient_consents_patient ON patient_consents(patient_id);
CREATE INDEX IF NOT EXISTS idx_patient_consents_status ON patient_consents(status);
CREATE INDEX IF NOT EXISTS idx_patient_consents_type ON patient_consents(consent_type);
CREATE INDEX IF NOT EXISTS idx_patient_consents_date ON patient_consents(consent_date);
CREATE INDEX IF NOT EXISTS idx_patient_consents_appointment ON patient_consents(appointment_id);
CREATE INDEX IF NOT EXISTS idx_patient_consents_number ON patient_consents(consent_number);
CREATE INDEX IF NOT EXISTS idx_patient_consents_valid_until ON patient_consents(valid_until);

-- Consent Signatures Table
CREATE TABLE IF NOT EXISTS consent_signatures (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  consent_id UUID NOT NULL REFERENCES patient_consents(id) ON DELETE CASCADE,
  signer_role VARCHAR(50) NOT NULL CHECK (signer_role IN (
    'patient',
    'guardian',
    'witness',
    'provider',
    'legal_representative'
  )),
  signer_id UUID REFERENCES users(id),
  signer_name VARCHAR(255) NOT NULL,
  signer_relationship VARCHAR(100),
  signature_type VARCHAR(50) NOT NULL CHECK (signature_type IN (
    'electronic',
    'digital',
    'biometric',
    'typed'
  )),
  signature_data TEXT NOT NULL,
  signature_method VARCHAR(100),
  signed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  ip_address INET,
  geolocation JSONB,
  user_agent TEXT,
  device_info JSONB,
  verification_code VARCHAR(100),
  verified_at TIMESTAMP WITH TIME ZONE,
  is_valid BOOLEAN DEFAULT true,
  invalidated_reason TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_consent_signatures_consent ON consent_signatures(consent_id);
CREATE INDEX IF NOT EXISTS idx_consent_signatures_role ON consent_signatures(signer_role);
CREATE INDEX IF NOT EXISTS idx_consent_signatures_date ON consent_signatures(signed_at);
CREATE INDEX IF NOT EXISTS idx_consent_signatures_signer ON consent_signatures(signer_id);

-- Consent Audit Log Table
CREATE TABLE IF NOT EXISTS consent_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  consent_id UUID NOT NULL REFERENCES patient_consents(id) ON DELETE CASCADE,
  action VARCHAR(100) NOT NULL CHECK (action IN (
    'created',
    'presented',
    'viewed',
    'signed',
    'declined',
    'revoked',
    'expired',
    'superseded',
    'exported',
    'printed',
    'emailed',
    'modified'
  )),
  performed_by UUID REFERENCES users(id),
  performed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  ip_address INET,
  user_agent TEXT,
  details JSONB DEFAULT '{}'::jsonb,
  previous_state JSONB,
  new_state JSONB
);

CREATE INDEX IF NOT EXISTS idx_consent_audit_consent ON consent_audit_log(consent_id);
CREATE INDEX IF NOT EXISTS idx_consent_audit_action ON consent_audit_log(action);
CREATE INDEX IF NOT EXISTS idx_consent_audit_date ON consent_audit_log(performed_at);
CREATE INDEX IF NOT EXISTS idx_consent_audit_user ON consent_audit_log(performed_by);

-- Consent Reminders Table
CREATE TABLE IF NOT EXISTS consent_reminders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID NOT NULL REFERENCES patients(id),
  consent_type VARCHAR(50) NOT NULL,
  template_id UUID REFERENCES consent_templates(id),
  due_date DATE NOT NULL,
  reminder_reason VARCHAR(255),
  status VARCHAR(50) DEFAULT 'pending' CHECK (status IN (
    'pending',
    'sent',
    'completed',
    'cancelled'
  )),
  sent_at TIMESTAMP WITH TIME ZONE,
  completed_at TIMESTAMP WITH TIME ZONE,
  completed_consent_id UUID REFERENCES patient_consents(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_consent_reminders_patient ON consent_reminders(patient_id);
CREATE INDEX IF NOT EXISTS idx_consent_reminders_due_date ON consent_reminders(due_date);
CREATE INDEX IF NOT EXISTS idx_consent_reminders_status ON consent_reminders(status);

-- Insert default consent templates
INSERT INTO consent_templates (
  template_name, template_code, consent_type, version, language_code,
  title, content, signature_requirements, validity_period_days,
  is_active, is_default, effective_date
) VALUES
(
  'General Treatment Consent',
  'GENERAL_TREATMENT_V1',
  'treatment',
  '1.0',
  'en',
  'Consent for Medical Treatment',
  '<h2>Consent for Medical Treatment</h2>
<p>I, <strong>{{patient_name}}</strong>, hereby consent to medical treatment by the healthcare providers at <strong>{{facility_name}}</strong>.</p>

<h3>Understanding of Treatment</h3>
<p>I understand that:</p>
<ul>
<li>Medical treatment may include examinations, tests, and procedures deemed necessary by my healthcare provider</li>
<li>The nature and purpose of proposed treatments have been explained to me</li>
<li>I have been informed of potential risks, benefits, and alternatives</li>
<li>No guarantees have been made regarding the outcome of treatment</li>
</ul>

<h3>Authorization</h3>
<p>I authorize the healthcare team to:</p>
<ul>
<li>Perform necessary medical examinations and tests</li>
<li>Administer treatments as deemed medically appropriate</li>
<li>Share my medical information with other healthcare providers involved in my care</li>
</ul>

<h3>Patient Rights</h3>
<p>I understand that I have the right to:</p>
<ul>
<li>Ask questions about my treatment at any time</li>
<li>Refuse treatment or withdraw consent</li>
<li>Request a second opinion</li>
<li>Access my medical records</li>
</ul>

<p><strong>Date:</strong> {{consent_date}}</p>',
  '{"patient": true, "guardian": false, "witness": false, "provider": true}'::jsonb,
  365,
  true,
  true,
  CURRENT_DATE
),
(
  'HIPAA Privacy Practices',
  'HIPAA_PRIVACY_V1',
  'hipaa',
  '1.0',
  'en',
  'Acknowledgment of Receipt of Notice of Privacy Practices',
  '<h2>Acknowledgment of Receipt of Notice of Privacy Practices</h2>
<p>I, <strong>{{patient_name}}</strong>, acknowledge that I have received a copy of the Notice of Privacy Practices from <strong>{{facility_name}}</strong>.</p>

<h3>Understanding</h3>
<p>I understand that:</p>
<ul>
<li>The Notice describes how my health information may be used and disclosed</li>
<li>I have the right to review the Notice before signing this acknowledgment</li>
<li>The Notice may be changed and I may obtain a current copy by contacting the Privacy Officer</li>
<li>I have the right to request restrictions on the use of my health information</li>
</ul>

<p><strong>Date:</strong> {{consent_date}}</p>',
  '{"patient": true, "guardian": false, "witness": false, "provider": false}'::jsonb,
  NULL,
  true,
  true,
  CURRENT_DATE
),
(
  'Telehealth Consent',
  'TELEHEALTH_V1',
  'telehealth',
  '1.0',
  'en',
  'Consent for Telehealth Services',
  '<h2>Consent for Telehealth Services</h2>
<p>I, <strong>{{patient_name}}</strong>, consent to receive healthcare services via telehealth from <strong>{{facility_name}}</strong>.</p>

<h3>Understanding of Telehealth</h3>
<p>I understand that:</p>
<ul>
<li>Telehealth involves the use of electronic communications for medical consultations</li>
<li>The same standards of care apply as in-person visits</li>
<li>Technical difficulties may occur and alternative arrangements may be needed</li>
<li>My health information will be transmitted securely</li>
</ul>

<h3>Privacy and Security</h3>
<p>I understand that:</p>
<ul>
<li>Telehealth sessions may be recorded for quality assurance (with my permission)</li>
<li>I should ensure I am in a private location during the consultation</li>
<li>I am responsible for the security of my device and internet connection</li>
</ul>

<p><strong>Date:</strong> {{consent_date}}</p>',
  '{"patient": true, "guardian": false, "witness": false, "provider": true}'::jsonb,
  180,
  true,
  true,
  CURRENT_DATE
);

-- Add comment
COMMENT ON TABLE consent_templates IS 'Consent form templates with version control';
COMMENT ON TABLE patient_consents IS 'Patient consent records with signatures';
COMMENT ON TABLE consent_signatures IS 'Electronic signatures for consents';
COMMENT ON TABLE consent_audit_log IS 'Complete audit trail for consent actions';
COMMENT ON TABLE consent_reminders IS 'Reminders for pending or expiring consents';

