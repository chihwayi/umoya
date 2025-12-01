# Sprint 18: Referral Management System

## Overview
Complete referral workflow system for managing patient referrals from creation to closure. Includes referral templates, status tracking, and communication.

## Goals
- Streamline referral process
- Track referral status
- Improve care coordination
- Reduce referral delays
- Ensure referral completion

---

## Database Schema

### Referrals Table
```sql
CREATE TABLE referrals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  referring_provider_id UUID NOT NULL REFERENCES users(id),
  referring_facility_name VARCHAR(255),
  referred_to_provider_id UUID REFERENCES users(id), -- If internal
  referred_to_facility_name VARCHAR(255) NOT NULL,
  referred_to_facility_address TEXT,
  referred_to_facility_phone VARCHAR(50),
  referred_to_facility_email VARCHAR(255),
  referral_type VARCHAR(50) NOT NULL CHECK (referral_type IN (
    'specialist',
    'laboratory',
    'imaging',
    'surgery',
    'hospitalization',
    'therapy',
    'mental_health',
    'dental',
    'ophthalmology',
    'cardiology',
    'oncology',
    'other'
  )),
  specialty VARCHAR(100), -- e.g., 'Cardiology', 'Orthopedics'
  priority VARCHAR(20) NOT NULL DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
  urgency VARCHAR(20) CHECK (urgency IN ('routine', 'urgent', 'emergent')),
  reason TEXT NOT NULL,
  clinical_summary TEXT,
  relevant_history TEXT,
  current_medications TEXT,
  allergies TEXT,
  diagnostic_tests_ordered TEXT,
  requested_services TEXT, -- What services are requested
  referral_date DATE NOT NULL,
  requested_appointment_date DATE,
  status VARCHAR(50) NOT NULL DEFAULT 'pending' CHECK (status IN (
    'draft',
    'pending',
    'sent',
    'acknowledged',
    'scheduled',
    'in_progress',
    'completed',
    'cancelled',
    'rejected',
    'expired'
  )),
  external_referral_id VARCHAR(255), -- Reference from external system
  response_received_date DATE,
  appointment_scheduled_date DATE,
  appointment_completed_date DATE,
  response_notes TEXT,
  outcome_summary TEXT,
  cancellation_reason TEXT,
  rejection_reason TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_referrals_patient_id ON referrals(patient_id);
CREATE INDEX idx_referrals_referring_provider ON referrals(referring_provider_id);
CREATE INDEX idx_referrals_referred_to_provider ON referrals(referred_to_provider_id);
CREATE INDEX idx_referrals_status ON referrals(status);
CREATE INDEX idx_referrals_type ON referrals(referral_type);
CREATE INDEX idx_referrals_referral_date ON referrals(referral_date);
```

### Referral Attachments Table
```sql
CREATE TABLE referral_attachments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  referral_id UUID NOT NULL REFERENCES referrals(id) ON DELETE CASCADE,
  document_type VARCHAR(50) NOT NULL CHECK (document_type IN (
    'clinical_note',
    'lab_result',
    'imaging_result',
    'prescription',
    'medical_record',
    'other'
  )),
  document_name VARCHAR(255) NOT NULL,
  file_path VARCHAR(500),
  file_url TEXT,
  file_size INTEGER,
  mime_type VARCHAR(100),
  description TEXT,
  uploaded_by UUID REFERENCES users(id),
  uploaded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_referral_attachments_referral_id ON referral_attachments(referral_id);
```

### Referral Status History Table
```sql
CREATE TABLE referral_status_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  referral_id UUID NOT NULL REFERENCES referrals(id) ON DELETE CASCADE,
  old_status VARCHAR(50),
  new_status VARCHAR(50) NOT NULL,
  change_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  changed_by UUID REFERENCES users(id),
  notes TEXT,
  metadata JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_referral_status_history_referral_id ON referral_status_history(referral_id);
CREATE INDEX idx_referral_status_history_change_date ON referral_status_history(change_date);
```

### Referral Templates Table
```sql
CREATE TABLE referral_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  referral_type VARCHAR(50) NOT NULL,
  specialty VARCHAR(100),
  template_data JSONB NOT NULL, -- Default fields, required information
  is_default BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT true,
  usage_count INTEGER DEFAULT 0,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_referral_templates_type ON referral_templates(referral_type);
CREATE INDEX idx_referral_templates_specialty ON referral_templates(specialty);
```

### Referral Facilities Table (Directory)
```sql
CREATE TABLE referral_facilities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  facility_name VARCHAR(255) NOT NULL,
  facility_type VARCHAR(50) CHECK (facility_type IN (
    'hospital',
    'clinic',
    'specialist_practice',
    'laboratory',
    'imaging_center',
    'therapy_center',
    'other'
  )),
  specialties TEXT[], -- Array of specialties
  address TEXT,
  city VARCHAR(100),
  phone VARCHAR(50),
  email VARCHAR(255),
  website VARCHAR(255),
  contact_person VARCHAR(255),
  referral_process TEXT, -- How to refer to this facility
  required_documents TEXT[], -- Documents typically required
  average_wait_time_days INTEGER,
  accepts_insurance BOOLEAN DEFAULT true,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_referral_facilities_type ON referral_facilities(facility_type);
CREATE INDEX idx_referral_facilities_specialties ON referral_facilities USING GIN(specialties);
```

---

## Backend Services

### ReferralService
**Location:** `services/ehr-service/src/services/referral.service.ts`

**Key Methods:**
- `createReferral(patientId, referralData, tenantDb)` - Create referral
- `updateReferral(referralId, updates, tenantDb)` - Update referral
- `getReferrals(filters, tenantDb)` - List referrals
- `getReferralById(referralId, tenantDb)` - Get referral details
- `sendReferral(referralId, method, tenantDb)` - Send referral (email/fax/API)
- `updateReferralStatus(referralId, status, notes, tenantDb)` - Update status
- `acknowledgeReferral(referralId, responseData, tenantDb)` - Acknowledge receipt
- `scheduleAppointment(referralId, appointmentData, tenantDb)` - Schedule appointment
- `completeReferral(referralId, outcomeData, tenantDb)` - Complete referral
- `cancelReferral(referralId, reason, tenantDb)` - Cancel referral
- `getReferralStatusHistory(referralId, tenantDb)` - Get status history
- `addAttachment(referralId, attachmentData, tenantDb)` - Add attachment
- `getReferralAttachments(referralId, tenantDb)` - Get attachments

### ReferralTemplateService
**Location:** `services/ehr-service/src/services/referral-template.service.ts`

**Key Methods:**
- `createTemplate(templateData, tenantDb)` - Create template
- `getTemplates(referralType, tenantDb)` - Get templates
- `applyTemplate(templateId, patientId, customizations, tenantDb)` - Create referral from template

### ReferralFacilityService
**Location:** `services/ehr-service/src/services/referral-facility.service.ts`

**Key Methods:**
- `addFacility(facilityData, tenantDb)` - Add facility to directory
- `getFacilities(filters, tenantDb)` - Get facilities
- `searchFacilities(query, specialty, tenantDb)` - Search facilities
- `updateFacility(facilityId, updates, tenantDb)` - Update facility

---

## API Endpoints

### Referral Management
- `POST /referrals` - Create referral
- `GET /referrals` - List referrals (with filters)
- `GET /referrals/:id` - Get referral details
- `PUT /referrals/:id` - Update referral
- `DELETE /referrals/:id` - Delete referral
- `POST /referrals/:id/send` - Send referral
- `POST /referrals/:id/acknowledge` - Acknowledge referral
- `POST /referrals/:id/schedule` - Schedule appointment
- `POST /referrals/:id/complete` - Complete referral
- `POST /referrals/:id/cancel` - Cancel referral
- `GET /referrals/:id/status-history` - Get status history

### Referral Attachments
- `POST /referrals/:id/attachments` - Add attachment
- `GET /referrals/:id/attachments` - Get attachments
- `DELETE /referrals/:id/attachments/:attachmentId` - Delete attachment

### Referral Templates
- `GET /referrals/templates` - Get templates
- `GET /referrals/templates/:id` - Get template details
- `POST /referrals/templates` - Create template
- `PUT /referrals/templates/:id` - Update template
- `POST /referrals/templates/:id/apply` - Apply template

### Referral Facilities
- `GET /referrals/facilities` - Get facilities directory
- `POST /referrals/facilities` - Add facility
- `PUT /referrals/facilities/:id` - Update facility
- `GET /referrals/facilities/search` - Search facilities

### Referral Analytics
- `GET /referrals/analytics` - Get referral analytics
- `GET /referrals/analytics/by-type` - Analytics by referral type
- `GET /referrals/analytics/by-status` - Analytics by status

---

## Frontend Components

### ReferralForm Component
**Location:** `ehr-frontend/src/components/ReferralForm.tsx`

**Features:**
- Create/edit referral
- Select referral type
- Choose facility/provider
- Add clinical summary
- Attach documents
- Set priority/urgency
- Request appointment date

### ReferralList Component
**Location:** `ehr-frontend/src/components/ReferralList.tsx`

**Features:**
- List all referrals
- Filter by status, type, provider
- Search referrals
- View referral details
- Quick actions (send, cancel, complete)
- Status indicators

### ReferralViewer Component
**Location:** `ehr-frontend/src/components/ReferralViewer.tsx`

**Features:**
- View referral details
- Status timeline
- Attachments viewer
- Response notes
- Outcome summary
- Related appointments

### ReferralTemplates Component
**Location:** `ehr-frontend/src/components/ReferralTemplates.tsx`

**Features:**
- Browse templates by type
- Preview template
- Apply template
- Create custom templates

### ReferralFacilityDirectory Component
**Location:** `ehr-frontend/src/components/ReferralFacilityDirectory.tsx`

**Features:**
- Browse facilities
- Search by specialty/location
- View facility details
- Add new facilities
- Edit facility information

---

## Referral Workflow States

1. **Draft** - Being created, not yet sent
2. **Pending** - Created, ready to send
3. **Sent** - Referral sent to facility
4. **Acknowledged** - Facility received and acknowledged
5. **Scheduled** - Appointment scheduled
6. **In Progress** - Patient seen, awaiting results
7. **Completed** - Referral completed, response received
8. **Cancelled** - Referral cancelled
9. **Rejected** - Facility rejected referral
10. **Expired** - Referral expired (no response)

---

## Integration Points

- **Appointment Service** - Schedule follow-up appointments
- **Email Service** - Send referral via email
- **Notification Service** - Notify providers of status changes
- **Document Service** - Attach clinical documents
- **Patient Service** - Link to patient records

---

## Testing Checklist

- [ ] Create referral
- [ ] Send referral (email/fax)
- [ ] Acknowledge referral
- [ ] Schedule appointment
- [ ] Complete referral
- [ ] Cancel referral
- [ ] Add attachments
- [ ] View status history
- [ ] Use referral templates
- [ ] Search facilities
- [ ] Referral analytics



---

---

## ⚠️ **CRITICAL IMPLEMENTATION GUIDELINES**

### **Database Provisioning**
- ✅ **ALWAYS provision database changes** - If database schema is modified, MUST provision it
- ✅ **Execute on bulawayo-general tenant** - All database changes MUST be tested on `bulawayo-general` tenant
- ✅ **Use provisioning bundle** - Add to `database-provisioning.service.ts` as a new bundle
- ✅ **Create provisioning script** - Create script in `scripts/` folder to apply to specific tenant

### **UI/UX Standards**
- ✅ **Follow existing component patterns** - Match UI/UX of existing components (DoctorDashboard, PatientPortal, etc.)
- ✅ **Use consistent styling** - Follow Tailwind CSS patterns already established
- ✅ **Polish all interfaces** - Ensure professional, modern UI matching existing quality
- ⚠️ **NEVER use default JavaScript alerts** - Always use modern UI components (ConfirmDialog, GlobalNotification) instead of `alert()`, `confirm()`, or `window.alert()`

### **Feature Completeness**
- ✅ **Complete feature sets** - If doctor feature needs nurse/patient features, implement ALL together
- ✅ **Do not move forward** - Complete all related features before moving to next item
- ✅ **Test end-to-end** - Test complete workflows across all user roles

### **Implementation Order**
1. Database schema → Provision → Test on bulawayo-general
2. Backend services → API endpoints
3. Frontend components (all roles if needed) → Polish UI/UX
4. Integration testing → End-to-end workflows
5. Documentation update


---

## Estimated Effort: 3-4 weeks

