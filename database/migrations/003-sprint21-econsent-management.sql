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

