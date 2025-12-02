# Sprint 21: E-Consent Management

## Overview
Digital consent management system with electronic signatures, version control, and comprehensive audit trails. This module replaces paper consent forms with secure, legally compliant digital alternatives.

## Goals
- Enable digital consent form creation and management
- Support electronic signature capture
- Maintain version control for consent forms
- Provide comprehensive audit trails
- Support multiple consent types (treatment, research, HIPAA, etc.)
- Multi-language support
- Legal compliance (HIPAA, local regulations)
- Integration with patient records and appointments

## Priority: ⭐⭐⭐ CRITICAL
**Estimated Effort**: 2-3 weeks

---

## Database Schema

### Consent Templates Table
```sql
CREATE TABLE consent_templates (
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
  content TEXT NOT NULL, -- Rich text HTML
  required_fields JSONB DEFAULT '[]'::jsonb, -- Dynamic fields to fill
  signature_requirements JSONB NOT NULL DEFAULT '{
    "patient": true,
    "guardian": false,
    "witness": false,
    "provider": true
  }'::jsonb,
  validity_period_days INTEGER, -- NULL = indefinite
  is_active BOOLEAN DEFAULT true,
  is_default BOOLEAN DEFAULT false,
  specialty VARCHAR(100),
  procedure_codes JSONB DEFAULT '[]'::jsonb, -- Applicable CPT codes
  notes TEXT,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  effective_date DATE NOT NULL,
  expiration_date DATE
);

CREATE INDEX idx_consent_templates_type ON consent_templates(consent_type);
CREATE INDEX idx_consent_templates_code ON consent_templates(template_code);
CREATE INDEX idx_consent_templates_active ON consent_templates(is_active);
CREATE INDEX idx_consent_templates_language ON consent_templates(language_code);
```

### Patient Consents Table
```sql
CREATE TABLE patient_consents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  consent_number VARCHAR(50) UNIQUE NOT NULL,
  patient_id UUID NOT NULL REFERENCES patients(id),
  template_id UUID REFERENCES consent_templates(id),
  template_version VARCHAR(20) NOT NULL,
  consent_type VARCHAR(50) NOT NULL,
  appointment_id UUID REFERENCES appointments(id),
  procedure_id UUID, -- Reference to procedure/surgery if applicable
  title TEXT NOT NULL,
  content TEXT NOT NULL, -- Snapshot of template content at time of signing
  filled_fields JSONB DEFAULT '{}'::jsonb, -- Values for dynamic fields
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

CREATE INDEX idx_patient_consents_patient ON patient_consents(patient_id);
CREATE INDEX idx_patient_consents_status ON patient_consents(status);
CREATE INDEX idx_patient_consents_type ON patient_consents(consent_type);
CREATE INDEX idx_patient_consents_date ON patient_consents(consent_date);
CREATE INDEX idx_patient_consents_appointment ON patient_consents(appointment_id);
CREATE INDEX idx_patient_consents_number ON patient_consents(consent_number);
```

### Consent Signatures Table
```sql
CREATE TABLE consent_signatures (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  consent_id UUID NOT NULL REFERENCES patient_consents(id) ON DELETE CASCADE,
  signer_role VARCHAR(50) NOT NULL CHECK (signer_role IN (
    'patient',
    'guardian',
    'witness',
    'provider',
    'legal_representative'
  )),
  signer_id UUID REFERENCES users(id), -- NULL if patient/guardian
  signer_name VARCHAR(255) NOT NULL,
  signer_relationship VARCHAR(100), -- For guardians/representatives
  signature_type VARCHAR(50) NOT NULL CHECK (signature_type IN (
    'electronic', -- Mouse/touch signature
    'digital', -- Digital certificate
    'biometric', -- Fingerprint/face
    'typed' -- Typed name with checkbox
  )),
  signature_data TEXT NOT NULL, -- Base64 encoded signature image or hash
  signature_method VARCHAR(100), -- Device/method used
  signed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  ip_address INET,
  geolocation JSONB, -- {lat, lon, accuracy}
  user_agent TEXT,
  device_info JSONB,
  verification_code VARCHAR(100), -- For 2FA/SMS verification
  verified_at TIMESTAMP WITH TIME ZONE,
  is_valid BOOLEAN DEFAULT true,
  invalidated_reason TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_consent_signatures_consent ON consent_signatures(consent_id);
CREATE INDEX idx_consent_signatures_role ON consent_signatures(signer_role);
CREATE INDEX idx_consent_signatures_date ON consent_signatures(signed_at);
```

### Consent Audit Log Table
```sql
CREATE TABLE consent_audit_log (
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

CREATE INDEX idx_consent_audit_consent ON consent_audit_log(consent_id);
CREATE INDEX idx_consent_audit_action ON consent_audit_log(action);
CREATE INDEX idx_consent_audit_date ON consent_audit_log(performed_at);
```

### Consent Reminders Table
```sql
CREATE TABLE consent_reminders (
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

CREATE INDEX idx_consent_reminders_patient ON consent_reminders(patient_id);
CREATE INDEX idx_consent_reminders_due_date ON consent_reminders(due_date);
CREATE INDEX idx_consent_reminders_status ON consent_reminders(status);
```

---

## Backend Services

### ConsentTemplateService
**Location:** `services/ehr-service/src/services/consent-template.service.ts`

**Key Methods:**
- `createTemplate(templateData, tenantDb)` - Create consent template
- `getTemplates(filters, tenantDb)` - Get templates by type/specialty
- `getTemplateById(id, tenantDb)` - Get template details
- `updateTemplate(id, updates, tenantDb)` - Update template
- `activateTemplate(id, tenantDb)` - Activate template version
- `deactivateTemplate(id, tenantDb)` - Deactivate template
- `getTemplateVersions(templateCode, tenantDb)` - Get version history
- `duplicateTemplate(id, tenantDb)` - Clone template
- `previewTemplate(id, sampleData, tenantDb)` - Preview with sample data

### PatientConsentService
**Location:** `services/ehr-service/src/services/patient-consent.service.ts`

**Key Methods:**
- `createConsent(consentData, tenantDb)` - Create consent from template
- `getPatientConsents(patientId, filters, tenantDb)` - Get patient consents
- `getConsentById(id, tenantDb)` - Get consent details with signatures
- `presentConsent(id, presentedBy, tenantDb)` - Mark as presented to patient
- `signConsent(id, signatureData, tenantDb)` - Add signature to consent
- `declineConsent(id, reason, tenantDb)` - Record consent decline
- `revokeConsent(id, reason, revokedBy, tenantDb)` - Revoke consent
- `checkConsentValidity(id, tenantDb)` - Check if consent is valid
- `getActiveConsents(patientId, consentType, tenantDb)` - Get valid consents
- `exportConsent(id, format, tenantDb)` - Export as PDF/JSON
- `sendConsentReminder(patientId, consentType, tenantDb)` - Send reminder
- `getConsentHistory(patientId, tenantDb)` - Get all consents with audit trail

### ConsentSignatureService
**Location:** `services/ehr-service/src/services/consent-signature.service.ts`

**Key Methods:**
- `captureSignature(signatureData, tenantDb)` - Capture electronic signature
- `validateSignature(signatureId, tenantDb)` - Validate signature
- `verifySignature(signatureId, verificationCode, tenantDb)` - 2FA verification
- `getSignatures(consentId, tenantDb)` - Get all signatures for consent
- `invalidateSignature(id, reason, tenantDb)` - Invalidate signature
- `generateSignatureImage(signatureData)` - Generate signature image

---

## API Endpoints

### Consent Templates
- `POST /consent-templates` - Create template
- `GET /consent-templates` - List templates (with filters)
- `GET /consent-templates/:id` - Get template details
- `PUT /consent-templates/:id` - Update template
- `POST /consent-templates/:id/activate` - Activate template
- `POST /consent-templates/:id/deactivate` - Deactivate template
- `GET /consent-templates/:id/versions` - Get version history
- `POST /consent-templates/:id/duplicate` - Clone template
- `POST /consent-templates/:id/preview` - Preview with sample data

### Patient Consents
- `POST /consents` - Create consent from template
- `GET /consents` - List consents (with filters)
- `GET /consents/patient/:patientId` - Get patient consents
- `GET /consents/:id` - Get consent details
- `POST /consents/:id/present` - Mark as presented
- `POST /consents/:id/sign` - Add signature
- `POST /consents/:id/decline` - Decline consent
- `POST /consents/:id/revoke` - Revoke consent
- `GET /consents/:id/validity` - Check validity
- `GET /consents/:id/export` - Export as PDF/JSON
- `GET /consents/:id/history` - Get audit trail
- `POST /consents/:id/email` - Email to patient
- `POST /consents/:id/print` - Generate print version

### Consent Signatures
- `POST /consents/:id/signatures` - Capture signature
- `GET /consents/:id/signatures` - Get signatures
- `POST /signatures/:id/verify` - Verify signature with 2FA
- `POST /signatures/:id/invalidate` - Invalidate signature

### Consent Reminders
- `GET /consent-reminders` - Get pending reminders
- `POST /consent-reminders` - Create reminder
- `POST /consent-reminders/:id/send` - Send reminder

---

## Frontend Components

### ConsentTemplateBuilder Component
**Location:** `ehr-frontend/src/components/ConsentTemplateBuilder.tsx`

**Features:**
- Rich text editor for consent content
- Dynamic field insertion (patient name, date, procedure, etc.)
- Signature requirement configuration
- Version management
- Multi-language support
- Preview mode
- Template categorization

### ConsentLibrary Component
**Location:** `ehr-frontend/src/components/ConsentLibrary.tsx`

**Features:**
- Browse consent templates
- Filter by type, specialty, language
- Search templates
- Template details view
- Version history
- Activate/deactivate templates
- Duplicate templates

### ConsentForm Component
**Location:** `ehr-frontend/src/components/ConsentForm.tsx`

**Features:**
- Display consent content
- Fill dynamic fields
- Electronic signature pad
- Multiple signature capture (patient, witness, provider)
- Signature verification (2FA optional)
- Review and submit
- Decline with reason
- Save draft
- Print/export options

### PatientConsentList Component
**Location:** `ehr-frontend/src/components/PatientConsentList.tsx`

**Features:**
- List patient consents
- Filter by status, type, date
- Status indicators (active, expired, revoked)
- Quick actions (view, revoke, export)
- Consent validity warnings
- Missing consent alerts

### ConsentViewer Component
**Location:** `ehr-frontend/src/components/ConsentViewer.tsx`

**Features:**
- Display consent details
- View all signatures
- Audit trail display
- Export as PDF
- Revoke consent
- Email consent copy
- Print consent

### SignaturePad Component
**Location:** `ehr-frontend/src/components/SignaturePad.tsx`

**Features:**
- Canvas-based signature capture
- Touch/mouse support
- Clear and retry
- Signature preview
- Save signature image
- Multiple signature types (draw, type, upload)

---

## Integration Points

- **Appointments**: Auto-present consents before appointments
- **Procedures**: Require consent before surgical procedures
- **Admissions**: Collect admission consents
- **Patient Portal**: Patients can sign consents remotely
- **Telemedicine**: Digital consent for telehealth
- **Notifications**: Reminder notifications for pending consents
- **Documents**: Link signed consents to patient documents
- **Audit Service**: Complete audit trail logging
- **Reporting**: Consent compliance reports

---

## Consent Types to Implement

### Essential Consents
1. **General Treatment Consent**: Basic treatment authorization
2. **Surgical/Procedure Consent**: Specific procedure authorization
3. **Anesthesia Consent**: Anesthesia administration
4. **HIPAA Consent**: Privacy practices acknowledgment
5. **Financial Consent**: Payment responsibility
6. **Release of Information**: Medical records release
7. **Telehealth Consent**: Virtual care agreement
8. **Research Consent**: Clinical trial participation
9. **Photography/Media Consent**: Images/video use
10. **Blood Transfusion Consent**: Blood product administration
11. **Vaccine Consent**: Immunization authorization
12. **DNR/Advance Directives**: End-of-life care decisions

---

## Legal & Compliance Requirements

### HIPAA Compliance
- Complete audit trails
- Secure signature storage
- Access controls
- Encryption at rest/transit

### Legal Validity
- Date/time stamps
- IP address logging
- Signer identity verification
- Signature capture method documentation
- Version control and tracking

### Retention Requirements
- Minimum retention periods by consent type
- Secure archival
- Deletion policies

---

## Testing Checklist

### Template Management
- [ ] Create consent template
- [ ] Edit template content
- [ ] Add dynamic fields
- [ ] Configure signature requirements
- [ ] Create multiple language versions
- [ ] Activate/deactivate templates
- [ ] Version control workflow
- [ ] Duplicate template
- [ ] Preview with sample data

### Consent Workflow
- [ ] Create consent from template
- [ ] Present consent to patient
- [ ] Fill dynamic fields
- [ ] Capture patient signature
- [ ] Capture witness signature
- [ ] Capture provider signature
- [ ] Submit completed consent
- [ ] Decline consent with reason
- [ ] View consent details
- [ ] Export consent as PDF

### Signature Capture
- [ ] Draw signature with mouse
- [ ] Touch signature on tablet
- [ ] Typed signature
- [ ] Upload signature image
- [ ] Verify signature with 2FA
- [ ] Clear and retry signature

### Consent Management
- [ ] View patient consent history
- [ ] Check consent validity
- [ ] Revoke active consent
- [ ] Send consent reminders
- [ ] Email consent to patient
- [ ] Print consent
- [ ] Export consent data

### Integration Testing
- [ ] Auto-present before appointment
- [ ] Link to surgical procedure
- [ ] Patient portal signing
- [ ] Telehealth consent capture
- [ ] Audit trail logging

---

## ⚠️ **CRITICAL IMPLEMENTATION GUIDELINES**

### **Database Provisioning**
- ✅ **ALWAYS provision database changes**
- ✅ **Execute on bulawayo-general tenant**
- ✅ **Use provisioning bundle**: Add `sprint21_econsent` to `database-provisioning.service.ts`
- ✅ **Create provisioning script**: `scripts/provision-sprint21-econsent.ts`

### **UI/UX Standards**
- ✅ **Follow existing component patterns**
- ✅ **Use consistent styling** (Tailwind CSS)
- ✅ **Polish all interfaces**
- ⚠️ **NEVER use default JavaScript alerts**
- ✅ **Mobile-responsive signature pad**
- ✅ **Accessibility compliance** (508/WCAG)

### **Security Requirements**
- ✅ **Encrypt signature data**
- ✅ **Audit all actions**
- ✅ **Secure signature storage**
- ✅ **Validate signature integrity**
- ✅ **Role-based access control**

### **Legal Compliance**
- ✅ **Maintain complete audit trails**
- ✅ **Version control all templates**
- ✅ **Timestamp all signatures**
- ✅ **Log IP addresses and devices**
- ✅ **Support revocation workflow**

---

## Estimated Effort: 2-3 weeks

### Week 1
- Database schema and backend services
- Template management API and UI
- Basic consent workflow

### Week 2
- Signature capture functionality
- Patient consent management
- Integration with appointments/procedures

### Week 3
- Testing and polish
- Documentation
- Multi-language support
- Reporting

---

**Last Updated**: December 2, 2025  
**Priority**: CRITICAL ⭐⭐⭐  
**Status**: Ready for implementation

