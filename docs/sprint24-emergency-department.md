# Sprint 24: Emergency Department (ED) Module

## Overview
Comprehensive Emergency Department management system with ESI triage, ED tracking board, patient flow optimization, fast track, resuscitation workflows, ED-specific order sets, and performance metrics. Designed for high-volume emergency care with real-time patient tracking and decision support.

## Goals
- ESI (Emergency Severity Index) triage system
- ED patient tracking board
- Real-time patient flow management
- Fast track for minor injuries
- Resuscitation bay management
- ED-specific order sets and protocols
- Door-to-doc time tracking
- ED bed management
- Disposition planning
- ED performance metrics (throughput, LOS, LWBS)
- Ambulance/EMS integration
- Disaster mode support

## Priority: ⭐⭐⭐ CRITICAL
**Estimated Effort**: 4-5 weeks

---

## Database Schema

### ED Patients Table
```sql
CREATE TABLE ed_patients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID NOT NULL REFERENCES patients(id),
  visit_number VARCHAR(50) UNIQUE NOT NULL,
  arrival_date TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  arrival_mode VARCHAR(50) CHECK (arrival_mode IN (
    'walk_in',
    'ambulance',
    'police',
    'helicopter',
    'private_vehicle',
    'wheelchair',
    'stretcher',
    'other'
  )),
  ambulance_service VARCHAR(255),
  ems_provider_name VARCHAR(255),
    ems_report_received BOOLEAN DEFAULT false,
  chief_complaint TEXT NOT NULL,
  presenting_problem TEXT,
  triage_level INTEGER CHECK (triage_level BETWEEN 1 AND 5), -- ESI 1-5
  triage_category VARCHAR(50),
  triage_time TIMESTAMP WITH TIME ZONE,
  triaged_by UUID REFERENCES users(id),
  registration_time TIMESTAMP WITH TIME ZONE,
  registered_by UUID REFERENCES users(id),
  ed_location VARCHAR(100), -- Current ED location
  ed_bay VARCHAR(50), -- Bay/room number
  ed_zone VARCHAR(50) CHECK (ed_zone IN (
    'triage',
    'waiting_room',
    'fast_track',
    'main_ed',
    'resuscitation',
    'observation',
    'psychiatric_hold',
    'isolation',
    'decontamination'
  )),
  initial_vitals JSONB,
  assigned_provider UUID REFERENCES users(id),
  assigned_nurse UUID REFERENCES users(id),
  provider_seen_time TIMESTAMP WITH TIME ZONE,
  door_to_provider_minutes INTEGER,
  status VARCHAR(50) DEFAULT 'registered' CHECK (status IN (
    'registered',
    'triaged',
    'waiting',
    'in_treatment',
    'awaiting_results',
    'ready_for_disposition',
    'admitted',
    'discharged',
    'left_without_being_seen', -- LWBS
    'left_ama', -- Against Medical Advice
    'transferred',
    'deceased',
    'eloped'
  )),
  acuity VARCHAR(50) CHECK (acuity IN (
    'immediate', -- ESI 1
    'emergent', -- ESI 2
    'urgent', -- ESI 3
    'less_urgent', -- ESI 4
    'non_urgent' -- ESI 5
  )),
  isolation_required BOOLEAN DEFAULT false,
  isolation_type VARCHAR(100),
  trauma_activation BOOLEAN DEFAULT false,
  trauma_level VARCHAR(20), -- Level 1, 2, 3
  stroke_alert BOOLEAN DEFAULT false,
  stemi_alert BOOLEAN DEFAULT false,
  sepsis_alert BOOLEAN DEFAULT false,
  disposition VARCHAR(100),
  disposition_time TIMESTAMP WITH TIME ZONE,
  total_ed_time_minutes INTEGER,
  waiting_time_minutes INTEGER,
  treatment_time_minutes INTEGER,
  discharge_time TIMESTAMP WITH TIME ZONE,
  discharge_instructions TEXT,
  follow_up_instructions TEXT,
  return_precautions TEXT,
  fast_track_eligible BOOLEAN DEFAULT false,
  consultation_requested BOOLEAN DEFAULT false,
  consultations JSONB, -- Array of consultation requests
  medications_given JSONB,
  procedures_performed JSONB,
  notes TEXT,
  flags JSONB DEFAULT '[]'::jsonb, -- Alert flags
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_ed_patients_patient ON ed_patients(patient_id);
CREATE INDEX idx_ed_patients_visit_number ON ed_patients(visit_number);
CREATE INDEX idx_ed_patients_arrival ON ed_patients(arrival_date);
CREATE INDEX idx_ed_patients_status ON ed_patients(status);
CREATE INDEX idx_ed_patients_triage ON ed_patients(triage_level);
CREATE INDEX idx_ed_patients_zone ON ed_patients(ed_zone);
CREATE INDEX idx_ed_patients_provider ON ed_patients(assigned_provider);
```

### ED Triage Assessments Table
```sql
CREATE TABLE ed_triage_assessments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ed_patient_id UUID NOT NULL REFERENCES ed_patients(id) ON DELETE CASCADE,
  patient_id UUID NOT NULL REFERENCES patients(id),
  triage_datetime TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  triaged_by UUID NOT NULL REFERENCES users(id),
  chief_complaint TEXT NOT NULL,
  presenting_symptoms JSONB, -- Array of symptoms
  pain_score INTEGER CHECK (pain_score BETWEEN 0 AND 10),
  pain_location VARCHAR(255),
  vital_signs JSONB NOT NULL, -- {bp, hr, rr, temp, spo2, gcs}
  esi_level INTEGER CHECK (esi_level BETWEEN 1 AND 5),
  esi_discriminators JSONB, -- Factors determining ESI level
  resource_needs_count INTEGER, -- Number of resources predicted
  danger_zone_check JSONB, -- Life/limb threat assessment
  high_risk_situations JSONB, -- High-risk indicators
  allergies TEXT,
  current_medications TEXT,
  medical_history_summary TEXT,
  last_menstrual_period DATE,
  pregnancy_status VARCHAR(50),
  immunization_status TEXT,
  tetanus_status TEXT,
  isolation_screening JSONB,
  infection_risk_screening JSONB,
  fall_risk_score INTEGER,
  suicide_risk_assessment JSONB,
  violence_risk_assessment JSONB,
  special_needs TEXT, -- Language, disability, etc.
  next_of_kin_notified BOOLEAN DEFAULT false,
  patient_valuables_secured BOOLEAN DEFAULT false,
  triage_notes TEXT,
  re_triage_required BOOLEAN DEFAULT false,
  re_triage_time TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_ed_triage_ed_patient ON ed_triage_assessments(ed_patient_id);
CREATE INDEX idx_ed_triage_patient ON ed_triage_assessments(patient_id);
CREATE INDEX idx_ed_triage_level ON ed_triage_assessments(esi_level);
CREATE INDEX idx_ed_triage_datetime ON ed_triage_assessments(triage_datetime);
```

### ED Tracking Board Events Table
```sql
CREATE TABLE ed_tracking_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ed_patient_id UUID NOT NULL REFERENCES ed_patients(id) ON DELETE CASCADE,
  event_type VARCHAR(100) CHECK (event_type IN (
    'arrival',
    'registration',
    'triage_start',
    'triage_complete',
    'moved_to_waiting',
    'bed_assigned',
    'provider_notified',
    'provider_started',
    'orders_placed',
    'labs_drawn',
    'imaging_ordered',
    'imaging_completed',
    'results_available',
    'consultation_requested',
    'consultant_arrived',
    'disposition_decided',
    'admission_order',
    'discharge_order',
    'patient_left',
    'transferred',
    'deceased'
  )),
  event_datetime TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  event_user UUID REFERENCES users(id),
  from_location VARCHAR(100),
  to_location VARCHAR(100),
  details TEXT,
  duration_minutes INTEGER,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_ed_tracking_events_patient ON ed_tracking_events(ed_patient_id);
CREATE INDEX idx_ed_tracking_events_type ON ed_tracking_events(event_type);
CREATE INDEX idx_ed_tracking_events_datetime ON ed_tracking_events(event_datetime);
```

### ED Order Sets Table
```sql
CREATE TABLE ed_order_sets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_set_name VARCHAR(255) NOT NULL,
  order_set_code VARCHAR(50) UNIQUE NOT NULL,
  indication VARCHAR(255) NOT NULL,
  category VARCHAR(100) CHECK (category IN (
    'chest_pain',
    'abdominal_pain',
    'trauma',
    'stroke',
    'sepsis',
    'pediatric_fever',
    'respiratory_distress',
    'allergic_reaction',
    'overdose',
    'psychiatric',
    'general'
  )),
  esi_levels JSONB, -- Array of applicable ESI levels
  orders JSONB NOT NULL, -- Complete order set definition
  is_active BOOLEAN DEFAULT true,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_ed_order_sets_category ON ed_order_sets(category);
CREATE INDEX idx_ed_order_sets_active ON ed_order_sets(is_active);
```

### ED Consultations Table
```sql
CREATE TABLE ed_consultations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ed_patient_id UUID NOT NULL REFERENCES ed_patients(id),
  consultation_specialty VARCHAR(100) NOT NULL,
  consulting_service VARCHAR(100),
  requested_by UUID NOT NULL REFERENCES users(id),
  requested_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  urgency VARCHAR(50) CHECK (urgency IN (
    'emergent',
    'urgent',
    'routine'
  )),
  reason TEXT NOT NULL,
  clinical_question TEXT,
  assigned_to UUID REFERENCES users(id),
  accepted_at TIMESTAMP WITH TIME ZONE,
  consultant_arrived_at TIMESTAMP WITH TIME ZONE,
  consultation_started_at TIMESTAMP WITH TIME ZONE,
  consultation_completed_at TIMESTAMP WITH TIME ZONE,
  response_time_minutes INTEGER,
  consultation_notes TEXT,
  recommendations TEXT,
  disposition_recommendation VARCHAR(100),
  status VARCHAR(50) DEFAULT 'pending' CHECK (status IN (
    'pending',
    'accepted',
    'declined',
    'in_progress',
    'completed',
    'cancelled'
  )),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_ed_consultations_patient ON ed_consultations(ed_patient_id);
CREATE INDEX idx_ed_consultations_specialty ON ed_consultations(consultation_specialty);
CREATE INDEX idx_ed_consultations_status ON ed_consultations(status);
CREATE INDEX idx_ed_consultations_requested_at ON ed_consultations(requested_at);
```

### ED Disposition Plans Table
```sql
CREATE TABLE ed_disposition_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ed_patient_id UUID NOT NULL REFERENCES ed_patients(id),
  patient_id UUID NOT NULL REFERENCES patients(id),
  disposition_type VARCHAR(100) CHECK (disposition_type IN (
    'discharge_home',
    'admit_general_ward',
    'admit_icu',
    'admit_observation',
    'transfer_to_facility',
    'psychiatric_admission',
    'ama', -- Against Medical Advice
    'lwbs', -- Left Without Being Seen
    'deceased',
    'elopement'
  )),
  decision_time TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  decided_by UUID NOT NULL REFERENCES users(id),
  admission_service VARCHAR(100),
  admission_provider UUID REFERENCES users(id),
  bed_request_time TIMESTAMP WITH TIME ZONE,
  bed_assigned BOOLEAN DEFAULT false,
  bed_assignment_time TIMESTAMP WITH TIME ZONE,
  target_unit VARCHAR(100),
  discharge_diagnosis TEXT,
  discharge_medications JSONB,
  discharge_instructions TEXT,
  prescriptions_written BOOLEAN DEFAULT false,
  patient_education_completed BOOLEAN DEFAULT false,
  follow_up_scheduled BOOLEAN DEFAULT false,
  follow_up_date DATE,
  follow_up_provider VARCHAR(255),
  transportation_arranged BOOLEAN DEFAULT false,
  referrals_made JSONB,
  work_school_note_provided BOOLEAN DEFAULT false,
  disposition_notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_ed_disposition_patient ON ed_disposition_plans(ed_patient_id);
CREATE INDEX idx_ed_disposition_type ON ed_disposition_plans(disposition_type);
CREATE INDEX idx_ed_disposition_decision_time ON ed_disposition_plans(decision_time);
```

### ED Metrics Table
```sql
CREATE TABLE ed_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  metric_date DATE NOT NULL,
  metric_hour INTEGER CHECK (metric_hour BETWEEN 0 AND 23),
  total_arrivals INTEGER DEFAULT 0,
  total_admissions INTEGER DEFAULT 0,
  total_discharges INTEGER DEFAULT 0,
  lwbs_count INTEGER DEFAULT 0, -- Left Without Being Seen
  ama_count INTEGER DEFAULT 0, -- Against Medical Advice
  avg_door_to_provider_minutes NUMERIC(10,2),
  avg_ed_los_minutes NUMERIC(10,2), -- Length of Stay
  avg_waiting_time_minutes NUMERIC(10,2),
  avg_treatment_time_minutes NUMERIC(10,2),
  esi1_count INTEGER DEFAULT 0,
  esi2_count INTEGER DEFAULT 0,
  esi3_count INTEGER DEFAULT 0,
  esi4_count INTEGER DEFAULT 0,
  esi5_count INTEGER DEFAULT 0,
  trauma_activations INTEGER DEFAULT 0,
  stroke_alerts INTEGER DEFAULT 0,
  stemi_alerts INTEGER DEFAULT 0,
  sepsis_alerts INTEGER DEFAULT 0,
  consultations_requested INTEGER DEFAULT 0,
  patients_waiting INTEGER DEFAULT 0,
  patients_in_treatment INTEGER DEFAULT 0,
  bed_occupancy_rate NUMERIC(5,2),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(metric_date, metric_hour)
);

CREATE INDEX idx_ed_metrics_date ON ed_metrics(metric_date);
CREATE INDEX idx_ed_metrics_hour ON ed_metrics(metric_hour);
```

---

## Backend Services

### EDPatientService
**Location:** `services/ehr-service/src/services/ed-patient.service.ts`

**Key Methods:**
- `registerEDPatient(patientData, tenantDb)` - Register ED patient
- `getEDPatients(filters, tenantDb)` - Get ED patient list
- `getEDPatientById(id, tenantDb)` - Get ED patient details
- `updateEDPatient(id, updates, tenantDb)` - Update ED patient
- `assignBed(edPatientId, bedNumber, tenantDb)` - Assign ED bay/bed
- `assignProvider(edPatientId, providerId, tenantDb)` - Assign provider
- `updateStatus(edPatientId, status, tenantDb)` - Update patient status
- `getTrackingBoardData(tenantDb)` - Get tracking board data
- `calculateWaitTime(edPatientId, tenantDb)` - Calculate waiting time
- `flagPatient(edPatientId, flagType, reason, tenantDb)` - Add alert flag

### EDTriageService
**Location:** `services/ehr-service/src/services/ed-triage.service.ts`

**Key Methods:**
- `performTriage(triageData, tenantDb)` - Perform triage assessment
- `calculateESI(vitalSigns, symptoms, history, tenantDb)` - Calculate ESI level
- `getTriageAssessment(edPatientId, tenantDb)` - Get triage details
- `updateTriageLevel(edPatientId, newLevel, reason, tenantDb)` - Re-triage
- `checkDangerZone(symptoms, vitals, tenantDb)` - Life threat check
- `estimateResourceNeeds(symptoms, chiefComplaint, tenantDb)` - Predict resources
- `screenForIsolation(symptoms, history, tenantDb)` - Infection screening

### EDTrackingService
**Location:** `services/ehr-service/src/services/ed-tracking.service.ts`

**Key Methods:**
- `logEvent(edPatientId, eventType, details, tenantDb)` - Log tracking event
- `getPatientTimeline(edPatientId, tenantDb)` - Get event timeline
- `calculateDoorToProvider(edPatientId, tenantDb)` - Calculate door-to-doc
- `calculateTotalEDTime(edPatientId, tenantDb)` - Calculate total LOS
- `getPatientsByZone(zone, tenantDb)` - Get patients by zone
- `getWaitingPatients(tenantDb)` - Get waiting room patients

### EDOrderSetService
**Location:** `services/ehr-service/src/services/ed-order-set.service.ts`

**Key Methods:**
- `getOrderSets(category, tenantDb)` - Get order sets
- `getOrderSetById(id, tenantDb)` - Get order set details
- `applyOrderSet(edPatientId, orderSetId, tenantDb)` - Apply order set
- `createOrderSet(orderSetData, tenantDb)` - Create custom order set
- `getRecommendedOrderSets(chiefComplaint, esiLevel, tenantDb)` - Get recommendations

### EDConsultationService
**Location:** `services/ehr-service/src/services/ed-consultation.service.ts`

**Key Methods:**
- `requestConsultation(consultData, tenantDb)` - Request consultation
- `acceptConsultation(consultId, consultantId, tenantDb)` - Accept consult
- `completeConsultation(consultId, notes, recommendations, tenantDb)` - Complete
- `getPendingConsultations(specialty, tenantDb)` - Get pending consults
- `getConsultationsByPatient(edPatientId, tenantDb)` - Get patient consults
- `calculateResponseTime(consultId, tenantDb)` - Calculate response time

### EDDispositionService
**Location:** `services/ehr-service/src/services/ed-disposition.service.ts`

**Key Methods:**
- `createDispositionPlan(dispositionData, tenantDb)` - Create disposition
- `getDispositionPlan(edPatientId, tenantDb)` - Get disposition details
- `updateDispositionPlan(id, updates, tenantDb)` - Update disposition
- `requestBed(edPatientId, targetUnit, tenantDb)` - Request inpatient bed
- `generateDischargeInstructions(edPatientId, tenantDb)` - Generate instructions
- `scheduleFollowUp(edPatientId, followUpData, tenantDb)` - Schedule follow-up

### EDMetricsService
**Location:** `services/ehr-service/src/services/ed-metrics.service.ts`

**Key Methods:**
- `calculateMetrics(date, hour, tenantDb)` - Calculate hourly metrics
- `getDailyMetrics(date, tenantDb)` - Get daily metrics
- `getMetricsRange(startDate, endDate, tenantDb)` - Get date range
- `calculateDoorToProviderAverage(date, tenantDb)` - Calculate average
- `calculateLOSAverage(date, tenantDb)` - Calculate LOS average
- `getLWBSRate(dateRange, tenantDb)` - Calculate LWBS rate
- `getAdmissionRate(dateRange, tenantDb)` - Calculate admission rate

---

## API Endpoints

### ED Patients
- `POST /ed/patients` - Register ED patient
- `GET /ed/patients` - Get ED patient list
- `GET /ed/patients/:id` - Get ED patient details
- `PUT /ed/patients/:id` - Update ED patient
- `POST /ed/patients/:id/assign-bed` - Assign bed
- `POST /ed/patients/:id/assign-provider` - Assign provider
- `PUT /ed/patients/:id/status` - Update status
- `GET /ed/tracking-board` - Get tracking board data
- `POST /ed/patients/:id/flag` - Add alert flag

### ED Triage
- `POST /ed/triage` - Perform triage
- `GET /ed/triage/:edPatientId` - Get triage assessment
- `PUT /ed/triage/:id` - Update triage
- `POST /ed/triage/calculate-esi` - Calculate ESI level
- `POST /ed/triage/danger-zone-check` - Check life threats

### ED Tracking
- `POST /ed/tracking/event` - Log tracking event
- `GET /ed/tracking/patient/:edPatientId` - Get patient timeline
- `GET /ed/tracking/zone/:zone` - Get patients by zone
- `GET /ed/tracking/waiting` - Get waiting patients

### ED Order Sets
- `GET /ed/order-sets` - Get order sets
- `GET /ed/order-sets/:id` - Get order set details
- `POST /ed/order-sets/apply` - Apply order set
- `GET /ed/order-sets/recommended` - Get recommendations

### ED Consultations
- `POST /ed/consultations` - Request consultation
- `POST /ed/consultations/:id/accept` - Accept consultation
- `POST /ed/consultations/:id/complete` - Complete consultation
- `GET /ed/consultations/pending` - Get pending consultations
- `GET /ed/consultations/patient/:edPatientId` - Get patient consultations

### ED Disposition
- `POST /ed/disposition` - Create disposition plan
- `GET /ed/disposition/:edPatientId` - Get disposition
- `PUT /ed/disposition/:id` - Update disposition
- `POST /ed/disposition/request-bed` - Request inpatient bed
- `POST /ed/disposition/discharge-instructions` - Generate instructions

### ED Metrics
- `GET /ed/metrics/daily/:date` - Get daily metrics
- `GET /ed/metrics/hourly/:date/:hour` - Get hourly metrics
- `GET /ed/metrics/range` - Get date range metrics
- `GET /ed/metrics/dashboard` - Get real-time dashboard

---

## Frontend Components

### EDTrackingBoard Component
**Location:** `ehr-frontend/src/components/EDTrackingBoard.tsx`

**Features:**
- Real-time patient grid
- Color-coded by ESI level
- Status indicators
- Time since arrival
- Door-to-provider timer
- Zone filtering
- Quick actions
- Auto-refresh

### EDTriageForm Component
**Location:** `ehr-frontend/src/components/EDTriageForm.tsx`

**Features:**
- Chief complaint entry
- Vital signs input
- ESI calculator
- Danger zone assessment
- Resource needs estimation
- Isolation screening
- Quick triage mode

### EDPatientCard Component
**Location:** `ehr-frontend/src/components/EDPatientCard.tsx`

**Features:**
- Patient summary
- Current status
- Assigned provider/nurse
- Triage level
- Waiting time
- Active orders
- Alerts/flags

### EDDispositionPlanner Component
**Location:** `ehr-frontend/src/components/EDDispositionPlanner.tsx`

**Features:**
- Disposition type selection
- Discharge instructions
- Admission request
- Bed request status
- Follow-up scheduling
- Prescription printing

### EDMetricsDashboard Component
**Location:** `ehr-frontend/src/components/EDMetricsDashboard.tsx`

**Features:**
- Real-time metrics
- Door-to-provider time
- Average LOS
- LWBS rate
- Bed occupancy
- Hourly arrival trends
- ESI distribution

---

## ESI (Emergency Severity Index) Implementation

### ESI Level Definitions
- **Level 1**: Immediate life-threatening condition
- **Level 2**: High-risk situation, confusion/lethargy, severe pain
- **Level 3**: Moderate acuity, 2+ resources needed
- **Level 4**: Low acuity, 1 resource needed
- **Level 5**: No resources needed

### ESI Algorithm
1. Does patient require immediate life-saving intervention? → ESI 1
2. High-risk situation or severe pain/distress? → ESI 2
3. How many resources does patient need?
   - 0 resources → ESI 5
   - 1 resource → ESI 4
   - ≥2 resources → Assess vital signs
     - Abnormal vitals → ESI 3
     - Normal vitals → ESI 3

---

## Testing Checklist

### Patient Registration & Triage
- [ ] Register walk-in patient
- [ ] Register ambulance arrival
- [ ] Perform ESI triage
- [ ] Calculate ESI level automatically
- [ ] Re-triage patient
- [ ] Screen for isolation
- [ ] Assign to zone (fast track, main ED, resus)

### Tracking Board
- [ ] View all ED patients
- [ ] Filter by zone
- [ ] Filter by ESI level
- [ ] Sort by waiting time
- [ ] View patient details
- [ ] Assign provider
- [ ] Update patient status
- [ ] View alerts/flags

### Clinical Workflow
- [ ] Apply ED order set
- [ ] Request consultation
- [ ] Track lab/imaging results
- [ ] Document procedure
- [ ] Update clinical notes

### Disposition
- [ ] Create discharge disposition
- [ ] Generate discharge instructions
- [ ] Request inpatient admission
- [ ] Request ICU bed
- [ ] Track bed assignment
- [ ] Complete discharge

### Metrics & Reporting
- [ ] View real-time dashboard
- [ ] Calculate door-to-provider time
- [ ] Calculate average LOS
- [ ] View ESI distribution
- [ ] Export daily metrics

---

## ⚠️ **CRITICAL IMPLEMENTATION GUIDELINES**

### **Database Provisioning**
- ✅ **Create provisioning bundle**: `sprint24_emergency_department`
- ✅ **Provisioning script**: `scripts/provision-sprint24-ed.ts`
- ✅ **Seed ED order sets**: Chest pain, trauma, sepsis protocols
- ✅ **Configure ED zones and bays**

### **Performance Requirements**
- ✅ **Real-time updates**: WebSocket for tracking board
- ✅ **Sub-second response**: Critical for ED workflows
- ✅ **Auto-refresh**: Tracking board updates every 30 seconds

### **Clinical Safety**
- ✅ **ESI validation**: Ensure accurate triage
- ✅ **Critical alerts**: Immediate notification for ESI 1-2
- ✅ **Timeout warnings**: Alert for patients waiting too long

---

## Estimated Effort: 4-5 weeks

### Week 1
- Database schema
- ED patient registration
- ESI triage system

### Week 2
- Tracking board
- Patient flow management
- Event logging

### Week 3
- Consultations
- Disposition planning
- Order sets

### Week 4
- Metrics and reporting
- Frontend components
- Integration testing

### Week 5
- Performance optimization
- Real-time features
- Testing and polish

---

**Last Updated**: December 2, 2025  
**Priority**: CRITICAL ⭐⭐⭐  
**Status**: Ready for implementation

