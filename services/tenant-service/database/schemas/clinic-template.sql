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

-- Indexes for performance
CREATE INDEX idx_patients_patient_number ON patients(patient_number);
CREATE INDEX idx_patients_id_number ON patients(id_number);
CREATE INDEX idx_patients_name ON patients(last_name, first_name);
CREATE INDEX idx_appointments_patient_id ON appointments(patient_id);
CREATE INDEX idx_appointments_doctor_id ON appointments(doctor_id);
CREATE INDEX idx_appointments_date ON appointments(appointment_date);
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
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();-- Sprint 21: E-Consent Management System
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


-- Sprint 21 E-Consent tables added above
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

-- Sprint 25: Clinical Pathways & Protocols
-- Date: December 3, 2025
-- Description: Evidence-based care pathways with adherence tracking and quality measurement

-- Clinical Pathways Table
CREATE TABLE IF NOT EXISTS clinical_pathways (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pathway_code VARCHAR(100) NOT NULL UNIQUE,
  pathway_name VARCHAR(255) NOT NULL,
  pathway_version VARCHAR(20) NOT NULL,
  condition VARCHAR(255) NOT NULL, -- CHF, Pneumonia, Stroke, etc.
  condition_codes JSONB DEFAULT '[]'::jsonb, -- ICD-10 codes
  specialty VARCHAR(100),
  evidence_level VARCHAR(20), -- Grade A, B, C
  guideline_source VARCHAR(255), -- AHA, ACC, WHO, etc.
  guideline_url TEXT,
  pathway_type VARCHAR(50) CHECK (pathway_type IN (
    'diagnostic',
    'treatment',
    'prevention',
    'management',
    'discharge'
  )),
  target_population TEXT,
  inclusion_criteria TEXT,
  exclusion_criteria TEXT,
  pathway_duration_days INTEGER,
  expected_outcomes TEXT,
  description TEXT,
  objectives TEXT,
  is_active BOOLEAN DEFAULT true,
  is_default BOOLEAN DEFAULT false,
  effective_date DATE NOT NULL,
  review_date DATE,
  last_reviewed_by UUID REFERENCES users(id),
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_clinical_pathways_code ON clinical_pathways(pathway_code);
CREATE INDEX IF NOT EXISTS idx_clinical_pathways_condition ON clinical_pathways(condition);
CREATE INDEX IF NOT EXISTS idx_clinical_pathways_specialty ON clinical_pathways(specialty);
CREATE INDEX IF NOT EXISTS idx_clinical_pathways_active ON clinical_pathways(is_active);

-- Pathway Steps Table
CREATE TABLE IF NOT EXISTS pathway_steps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pathway_id UUID NOT NULL REFERENCES clinical_pathways(id) ON DELETE CASCADE,
  step_number INTEGER NOT NULL,
  step_name VARCHAR(255) NOT NULL,
  step_type VARCHAR(50) CHECK (step_type IN (
    'assessment',
    'diagnostic_test',
    'medication',
    'procedure',
    'consultation',
    'education',
    'monitoring',
    'decision_point'
  )),
  timing VARCHAR(100), -- Day 1, Hour 0-6, etc.
  timing_from_start_hours INTEGER,
  description TEXT,
  instructions TEXT,
  required_actions JSONB DEFAULT '[]'::jsonb,
  decision_criteria TEXT,
  decision_branches JSONB, -- If decision point
  is_required BOOLEAN DEFAULT true,
  is_parallel BOOLEAN DEFAULT false, -- Can be done simultaneously
  depends_on_step INTEGER, -- Must complete this step first
  expected_duration_minutes INTEGER,
  documentation_required TEXT,
  quality_measure BOOLEAN DEFAULT false,
  order_sets JSONB DEFAULT '[]'::jsonb, -- Pre-configured orders
  alerts JSONB DEFAULT '[]'::jsonb, -- Warnings if not completed on time
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pathway_steps_pathway ON pathway_steps(pathway_id);
CREATE INDEX IF NOT EXISTS idx_pathway_steps_number ON pathway_steps(step_number);
CREATE INDEX IF NOT EXISTS idx_pathway_steps_type ON pathway_steps(step_type);

-- Pathway Enrollments Table
CREATE TABLE IF NOT EXISTS pathway_enrollments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  enrollment_number VARCHAR(50) UNIQUE NOT NULL,
  patient_id UUID NOT NULL REFERENCES patients(id),
  pathway_id UUID NOT NULL REFERENCES clinical_pathways(id),
  admission_id UUID REFERENCES admissions(id),
  enrolled_date TIMESTAMP WITH TIME ZONE NOT NULL,
  enrolled_by UUID NOT NULL REFERENCES users(id),
  start_date TIMESTAMP WITH TIME ZONE NOT NULL,
  expected_end_date TIMESTAMP WITH TIME ZONE,
  actual_end_date TIMESTAMP WITH TIME ZONE,
  enrollment_status VARCHAR(50) DEFAULT 'active' CHECK (enrollment_status IN (
    'active',
    'completed',
    'discontinued',
    'suspended',
    'transferred'
  )),
  discontinuation_reason TEXT,
  discontinued_date TIMESTAMP WITH TIME ZONE,
  discontinued_by UUID REFERENCES users(id),
  primary_provider UUID REFERENCES users(id),
  coordinator UUID REFERENCES users(id),
  current_step INTEGER,
  completion_percentage DECIMAL(5,2),
  adherence_score DECIMAL(5,2), -- 0-100
  variance_count INTEGER DEFAULT 0,
  outcomes JSONB DEFAULT '{}'::jsonb,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pathway_enrollments_patient ON pathway_enrollments(patient_id);
CREATE INDEX IF NOT EXISTS idx_pathway_enrollments_pathway ON pathway_enrollments(pathway_id);
CREATE INDEX IF NOT EXISTS idx_pathway_enrollments_status ON pathway_enrollments(enrollment_status);
CREATE INDEX IF NOT EXISTS idx_pathway_enrollments_admission ON pathway_enrollments(admission_id);
CREATE INDEX IF NOT EXISTS idx_pathway_enrollments_date ON pathway_enrollments(enrolled_date);

-- Pathway Adherence Table
CREATE TABLE IF NOT EXISTS pathway_adherence (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  enrollment_id UUID NOT NULL REFERENCES pathway_enrollments(id) ON DELETE CASCADE,
  step_id UUID NOT NULL REFERENCES pathway_steps(id),
  patient_id UUID NOT NULL REFERENCES patients(id),
  due_date TIMESTAMP WITH TIME ZONE,
  completed_date TIMESTAMP WITH TIME ZONE,
  completed_by UUID REFERENCES users(id),
  status VARCHAR(50) DEFAULT 'pending' CHECK (status IN (
    'pending',
    'completed',
    'overdue',
    'skipped',
    'not_applicable'
  )),
  on_time BOOLEAN,
  delay_hours INTEGER,
  completion_notes TEXT,
  variance_documented BOOLEAN DEFAULT false,
  variance_id UUID,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pathway_adherence_enrollment ON pathway_adherence(enrollment_id);
CREATE INDEX IF NOT EXISTS idx_pathway_adherence_step ON pathway_adherence(step_id);
CREATE INDEX IF NOT EXISTS idx_pathway_adherence_patient ON pathway_adherence(patient_id);
CREATE INDEX IF NOT EXISTS idx_pathway_adherence_status ON pathway_adherence(status);
CREATE INDEX IF NOT EXISTS idx_pathway_adherence_due_date ON pathway_adherence(due_date);

-- Pathway Variances Table
CREATE TABLE IF NOT EXISTS pathway_variances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  enrollment_id UUID NOT NULL REFERENCES pathway_enrollments(id) ON DELETE CASCADE,
  step_id UUID REFERENCES pathway_steps(id),
  patient_id UUID NOT NULL REFERENCES patients(id),
  variance_date TIMESTAMP WITH TIME ZONE NOT NULL,
  variance_type VARCHAR(50) NOT NULL CHECK (variance_type IN (
    'omission',
    'delay',
    'modification',
    'substitution',
    'addition',
    'contraindication'
  )),
  variance_category VARCHAR(100), -- Clinical, operational, patient-related
  description TEXT NOT NULL,
  rationale TEXT NOT NULL,
  clinical_justification TEXT,
  documented_by UUID NOT NULL REFERENCES users(id),
  approved_by UUID REFERENCES users(id),
  impact_on_outcome VARCHAR(50), -- None, minor, moderate, significant
  corrective_action TEXT,
  requires_review BOOLEAN DEFAULT false,
  reviewed_by UUID REFERENCES users(id),
  review_notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pathway_variances_enrollment ON pathway_variances(enrollment_id);
CREATE INDEX IF NOT EXISTS idx_pathway_variances_patient ON pathway_variances(patient_id);
CREATE INDEX IF NOT EXISTS idx_pathway_variances_type ON pathway_variances(variance_type);
CREATE INDEX IF NOT EXISTS idx_pathway_variances_date ON pathway_variances(variance_date);

-- Pathway Outcomes Table
CREATE TABLE IF NOT EXISTS pathway_outcomes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  enrollment_id UUID NOT NULL REFERENCES pathway_enrollments(id) ON DELETE CASCADE,
  patient_id UUID NOT NULL REFERENCES patients(id),
  outcome_date TIMESTAMP WITH TIME ZONE NOT NULL,
  outcome_type VARCHAR(100) NOT NULL, -- Clinical, functional, quality of life
  outcome_measure VARCHAR(255) NOT NULL,
  baseline_value VARCHAR(100),
  target_value VARCHAR(100),
  actual_value VARCHAR(100),
  measurement_date DATE,
  goal_achieved BOOLEAN,
  documented_by UUID REFERENCES users(id),
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pathway_outcomes_enrollment ON pathway_outcomes(enrollment_id);
CREATE INDEX IF NOT EXISTS idx_pathway_outcomes_patient ON pathway_outcomes(patient_id);
CREATE INDEX IF NOT EXISTS idx_pathway_outcomes_type ON pathway_outcomes(outcome_type);
CREATE INDEX IF NOT EXISTS idx_pathway_outcomes_date ON pathway_outcomes(outcome_date);

-- Insert sample clinical pathways
INSERT INTO clinical_pathways (
  pathway_code, pathway_name, pathway_version, condition,
  condition_codes, specialty, evidence_level, guideline_source,
  pathway_type, target_population, effective_date
) VALUES
(
  'CHF_MGMT_V1',
  'Congestive Heart Failure Management',
  '1.0',
  'Congestive Heart Failure',
  '["I50.0", "I50.1", "I50.9"]'::jsonb,
  'cardiology',
  'A',
  'AHA/ACC Heart Failure Guidelines',
  'management',
  'Adult patients with diagnosed CHF',
  CURRENT_DATE
),
(
  'STROKE_ACUTE_V1',
  'Acute Ischemic Stroke Pathway',
  '1.0',
  'Acute Ischemic Stroke',
  '["I63.0", "I63.9"]'::jsonb,
  'neurology',
  'A',
  'AHA/ASA Stroke Guidelines',
  'treatment',
  'Adults presenting within 4.5 hours of symptom onset',
  CURRENT_DATE
),
(
  'PNEUMONIA_CAP_V1',
  'Community-Acquired Pneumonia Protocol',
  '1.0',
  'Community-Acquired Pneumonia',
  '["J18.9", "J15.9"]'::jsonb,
  'pulmonology',
  'A',
  'IDSA/ATS CAP Guidelines',
  'treatment',
  'Adult inpatients with CAP',
  CURRENT_DATE
),
(
  'DKA_MGMT_V1',
  'Diabetic Ketoacidosis Management',
  '1.0',
  'Diabetic Ketoacidosis',
  '["E10.10", "E11.10"]'::jsonb,
  'endocrinology',
  'A',
  'ADA DKA Guidelines',
  'treatment',
  'Patients with DKA',
  CURRENT_DATE
),
(
  'SEPSIS_V1',
  'Severe Sepsis & Septic Shock Protocol',
  '1.0',
  'Sepsis',
  '["A41.9", "R65.20", "R65.21"]'::jsonb,
  'emergency_medicine',
  'A',
  'Surviving Sepsis Campaign',
  'treatment',
  'Patients with suspected or confirmed sepsis',
  CURRENT_DATE
);

-- Add comments
COMMENT ON TABLE clinical_pathways IS 'Evidence-based clinical pathway definitions';
COMMENT ON TABLE pathway_steps IS 'Step-by-step protocol actions';
COMMENT ON TABLE pathway_enrollments IS 'Patient pathway enrollment tracking';
COMMENT ON TABLE pathway_adherence IS 'Adherence to pathway steps';
COMMENT ON TABLE pathway_variances IS 'Documented deviations from pathway';
COMMENT ON TABLE pathway_outcomes IS 'Clinical outcomes measurement';

