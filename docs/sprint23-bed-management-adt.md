# Sprint 23: Advanced Bed Management & ADT

## Overview
Comprehensive bed management and Admission/Discharge/Transfer (ADT) system for inpatient care. Includes real-time bed tracking, occupancy management, patient flow optimization, census reporting, and HL7 ADT message generation for interfacing with other hospital systems.

## Goals
- Real-time bed occupancy tracking
- ADT workflow automation (Admit, Discharge, Transfer)
- Bed assignment and management
- Ward/unit management
- Patient flow optimization
- Census reporting (daily, shift-based)
- Bed turnover tracking
- Housekeeping integration
- HL7 ADT message generation (A01-A45)
- Bed reservation and blocking
- Discharge planning

## Priority: ⭐⭐⭐ CRITICAL
**Estimated Effort**: 3-4 weeks

---

## Database Schema

### Hospital Units Table
```sql
CREATE TABLE hospital_units (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  unit_code VARCHAR(50) NOT NULL UNIQUE,
  unit_name VARCHAR(255) NOT NULL,
  unit_type VARCHAR(100) CHECK (unit_type IN (
    'general_ward',
    'icu',
    'nicu',
    'picu',
    'surgical',
    'medical',
    'pediatric',
    'maternity',
    'emergency',
    'isolation',
    'psychiatric',
    'rehabilitation',
    'oncology',
    'cardiology',
    'other'
  )),
  building VARCHAR(100),
  floor INTEGER,
  wing VARCHAR(50),
  capacity INTEGER NOT NULL,
  status VARCHAR(50) DEFAULT 'active' CHECK (status IN (
    'active',
    'inactive',
    'closed',
    'under_maintenance'
  )),
  specialty VARCHAR(100),
  gender_restriction VARCHAR(20) CHECK (gender_restriction IN (
    'male',
    'female',
    'mixed',
    'none'
  )),
  age_restriction VARCHAR(50), -- 'adult', 'pediatric', 'neonatal', 'all'
  isolation_capable BOOLEAN DEFAULT false,
  nurse_station_location VARCHAR(100),
  head_nurse_id UUID REFERENCES users(id),
  contact_phone VARCHAR(50),
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_hospital_units_type ON hospital_units(unit_type);
CREATE INDEX idx_hospital_units_status ON hospital_units(status);
CREATE INDEX idx_hospital_units_code ON hospital_units(unit_code);
```

### Hospital Beds Table
```sql
CREATE TABLE hospital_beds (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bed_number VARCHAR(50) NOT NULL,
  unit_id UUID NOT NULL REFERENCES hospital_units(id),
  room_number VARCHAR(50),
  bed_type VARCHAR(100) CHECK (bed_type IN (
    'standard',
    'icu',
    'telemetry',
    'isolation',
    'bariatric',
    'pediatric',
    'neonatal_incubator',
    'psychiatric',
    'maternity',
    'observation'
  )),
  bed_status VARCHAR(50) DEFAULT 'available' CHECK (bed_status IN (
    'available',
    'occupied',
    'blocked',
    'housekeeping',
    'maintenance',
    'reserved',
    'contaminated'
  )),
  occupancy_status VARCHAR(50),
  bed_features JSONB DEFAULT '[]'::jsonb, -- ['oxygen', 'cardiac_monitor', 'ventilator']
  is_isolation BOOLEAN DEFAULT false,
  is_private BOOLEAN DEFAULT false,
  has_oxygen BOOLEAN DEFAULT false,
  has_monitor BOOLEAN DEFAULT false,
  has_ventilator BOOLEAN DEFAULT false,
  gender_restriction VARCHAR(20),
  location_description VARCHAR(255),
  last_occupied_at TIMESTAMP WITH TIME ZONE,
  last_cleaned_at TIMESTAMP WITH TIME ZONE,
  cleaned_by UUID REFERENCES users(id),
  blocked_reason TEXT,
  blocked_until TIMESTAMP WITH TIME ZONE,
  blocked_by UUID REFERENCES users(id),
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(unit_id, bed_number)
);

CREATE INDEX idx_hospital_beds_unit ON hospital_beds(unit_id);
CREATE INDEX idx_hospital_beds_status ON hospital_beds(bed_status);
CREATE INDEX idx_hospital_beds_number ON hospital_beds(bed_number);
CREATE INDEX idx_hospital_beds_type ON hospital_beds(bed_type);
```

### Patient Admissions Table
```sql
CREATE TABLE patient_admissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admission_number VARCHAR(50) UNIQUE NOT NULL,
  patient_id UUID NOT NULL REFERENCES patients(id),
  visit_number VARCHAR(50),
  admission_type VARCHAR(50) CHECK (admission_type IN (
    'emergency',
    'elective',
    'urgent',
    'routine',
    'observation',
    'maternity',
    'day_surgery',
    'transfer_in'
  )),
  admission_source VARCHAR(100) CHECK (admission_source IN (
    'emergency_department',
    'outpatient_clinic',
    'physician_referral',
    'transfer_from_facility',
    'direct_admission',
    'birth',
    'other'
  )),
  admission_date TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  admission_time TIME,
  admitting_provider_id UUID NOT NULL REFERENCES users(id),
  attending_provider_id UUID REFERENCES users(id),
  chief_complaint TEXT,
  primary_diagnosis TEXT,
  diagnosis_codes JSONB DEFAULT '[]'::jsonb, -- ICD-10 codes
  admission_notes TEXT,
  bed_id UUID REFERENCES hospital_beds(id),
  unit_id UUID REFERENCES hospital_units(id),
  service_type VARCHAR(100), -- Medical, Surgical, Pediatrics, etc.
  patient_class VARCHAR(50) CHECK (patient_class IN (
    'inpatient',
    'outpatient',
    'emergency',
    'observation',
    'day_surgery',
    'recurring'
  )),
  expected_los_days INTEGER, -- Expected Length of Stay
  financial_class VARCHAR(100), -- Insurance type
  insurance_plan VARCHAR(255),
  authorization_number VARCHAR(100),
  status VARCHAR(50) DEFAULT 'active' CHECK (status IN (
    'active',
    'pending_admission',
    'discharged',
    'transferred_out',
    'deceased',
    'cancelled'
  )),
  discharge_date TIMESTAMP WITH TIME ZONE,
  discharge_time TIME,
  discharge_type VARCHAR(50),
  discharge_disposition VARCHAR(100),
  discharge_provider_id UUID REFERENCES users(id),
  discharge_notes TEXT,
  total_los_hours NUMERIC(10,2),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_patient_admissions_patient ON patient_admissions(patient_id);
CREATE INDEX idx_patient_admissions_admission_number ON patient_admissions(admission_number);
CREATE INDEX idx_patient_admissions_status ON patient_admissions(status);
CREATE INDEX idx_patient_admissions_date ON patient_admissions(admission_date);
CREATE INDEX idx_patient_admissions_bed ON patient_admissions(bed_id);
CREATE INDEX idx_patient_admissions_unit ON patient_admissions(unit_id);
```

### Bed Assignments Table
```sql
CREATE TABLE bed_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admission_id UUID NOT NULL REFERENCES patient_admissions(id),
  patient_id UUID NOT NULL REFERENCES patients(id),
  bed_id UUID NOT NULL REFERENCES hospital_beds(id),
  unit_id UUID NOT NULL REFERENCES hospital_units(id),
  assignment_type VARCHAR(50) CHECK (assignment_type IN (
    'initial',
    'transfer',
    'return',
    'upgrade',
    'downgrade'
  )),
  assigned_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  assigned_by UUID REFERENCES users(id),
  released_at TIMESTAMP WITH TIME ZONE,
  released_by UUID REFERENCES users(id),
  release_reason TEXT,
  is_current BOOLEAN DEFAULT true,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_bed_assignments_admission ON bed_assignments(admission_id);
CREATE INDEX idx_bed_assignments_patient ON bed_assignments(patient_id);
CREATE INDEX idx_bed_assignments_bed ON bed_assignments(bed_id);
CREATE INDEX idx_bed_assignments_current ON bed_assignments(is_current);
```

### Patient Transfers Table
```sql
CREATE TABLE patient_transfers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admission_id UUID NOT NULL REFERENCES patient_admissions(id),
  patient_id UUID NOT NULL REFERENCES patients(id),
  transfer_type VARCHAR(50) CHECK (transfer_type IN (
    'internal', -- Within facility
    'external', -- To another facility
    'unit_to_unit',
    'bed_to_bed',
    'upgrade',
    'downgrade'
  )),
  from_unit_id UUID REFERENCES hospital_units(id),
  from_bed_id UUID REFERENCES hospital_beds(id),
  to_unit_id UUID REFERENCES hospital_units(id),
  to_bed_id UUID REFERENCES hospital_beds(id),
  to_facility VARCHAR(255), -- If external transfer
  transfer_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  transfer_time TIME,
  initiated_by UUID REFERENCES users(id),
  approved_by UUID REFERENCES users(id),
  transfer_reason TEXT NOT NULL,
  clinical_justification TEXT,
  patient_condition VARCHAR(100) CHECK (patient_condition IN (
    'stable',
    'critical',
    'unstable',
    'improving',
    'deteriorating'
  )),
  transfer_mode VARCHAR(50), -- Wheelchair, stretcher, walking, etc.
  equipment_transferred JSONB, -- IV pumps, monitors, etc.
  handoff_completed BOOLEAN DEFAULT false,
  handoff_completed_at TIMESTAMP WITH TIME ZONE,
  handoff_notes TEXT,
  status VARCHAR(50) DEFAULT 'pending' CHECK (status IN (
    'pending',
    'approved',
    'in_progress',
    'completed',
    'cancelled',
    'rejected'
  )),
  cancelled_reason TEXT,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_patient_transfers_admission ON patient_transfers(admission_id);
CREATE INDEX idx_patient_transfers_patient ON patient_transfers(patient_id);
CREATE INDEX idx_patient_transfers_date ON patient_transfers(transfer_date);
CREATE INDEX idx_patient_transfers_status ON patient_transfers(status);
```

### Discharges Table
```sql
CREATE TABLE patient_discharges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admission_id UUID NOT NULL REFERENCES patient_admissions(id) ON DELETE CASCADE,
  patient_id UUID NOT NULL REFERENCES patients(id),
  discharge_date TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  discharge_time TIME,
  discharge_type VARCHAR(50) CHECK (discharge_type IN (
    'routine',
    'against_medical_advice', -- AMA
    'transfer',
    'death',
    'left_without_being_seen', -- LWBS
    'elopement'
  )),
  discharge_disposition VARCHAR(100) CHECK (discharge_disposition IN (
    'home',
    'home_with_services',
    'skilled_nursing_facility',
    'rehabilitation_facility',
    'hospice',
    'another_hospital',
    'deceased',
    'left_ama',
    'psychiatric_facility',
    'other'
  )),
  discharge_provider_id UUID NOT NULL REFERENCES users(id),
  discharge_diagnosis TEXT,
  discharge_medications JSONB,
  discharge_instructions TEXT,
  follow_up_instructions TEXT,
  follow_up_date DATE,
  follow_up_provider_id UUID REFERENCES users(id),
  patient_education_provided BOOLEAN DEFAULT false,
  patient_understood BOOLEAN DEFAULT false,
  transportation_arranged BOOLEAN DEFAULT false,
  transportation_type VARCHAR(50),
  discharge_summary_completed BOOLEAN DEFAULT false,
  discharge_summary_sent_to JSONB, -- Array of provider IDs/facilities
  actual_los_hours NUMERIC(10,2),
  readmission_risk VARCHAR(50) CHECK (readmission_risk IN (
    'low',
    'medium',
    'high'
  )),
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_patient_discharges_admission ON patient_discharges(admission_id);
CREATE INDEX idx_patient_discharges_patient ON patient_discharges(patient_id);
CREATE INDEX idx_patient_discharges_date ON patient_discharges(discharge_date);
CREATE INDEX idx_patient_discharges_type ON patient_discharges(discharge_type);
```

### Bed Reservations Table
```sql
CREATE TABLE bed_reservations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bed_id UUID NOT NULL REFERENCES hospital_beds(id),
  patient_id UUID REFERENCES patients(id),
  reserved_for VARCHAR(255), -- Patient name or service
  reservation_type VARCHAR(50) CHECK (reservation_type IN (
    'scheduled_admission',
    'scheduled_surgery',
    'transfer',
    'emergency_hold',
    'other'
  )),
  reserved_from TIMESTAMP WITH TIME ZONE NOT NULL,
  reserved_until TIMESTAMP WITH TIME ZONE NOT NULL,
  reserved_by UUID NOT NULL REFERENCES users(id),
  reason TEXT,
  status VARCHAR(50) DEFAULT 'active' CHECK (status IN (
    'active',
    'used',
    'expired',
    'cancelled'
  )),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_bed_reservations_bed ON bed_reservations(bed_id);
CREATE INDEX idx_bed_reservations_patient ON bed_reservations(patient_id);
CREATE INDEX idx_bed_reservations_dates ON bed_reservations(reserved_from, reserved_until);
CREATE INDEX idx_bed_reservations_status ON bed_reservations(status);
```

### ADT Event Log Table
```sql
CREATE TABLE adt_event_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type VARCHAR(10) NOT NULL, -- A01, A02, A03, etc. (HL7 ADT codes)
  event_code VARCHAR(50) NOT NULL,
  event_description VARCHAR(255) NOT NULL,
  patient_id UUID NOT NULL REFERENCES patients(id),
  admission_id UUID REFERENCES patient_admissions(id),
  event_datetime TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  triggered_by UUID REFERENCES users(id),
  hl7_message TEXT, -- Generated HL7 message
  hl7_message_sent BOOLEAN DEFAULT false,
  hl7_message_sent_at TIMESTAMP WITH TIME ZONE,
  hl7_response TEXT,
  event_data JSONB NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_adt_event_log_patient ON adt_event_log(patient_id);
CREATE INDEX idx_adt_event_log_admission ON adt_event_log(admission_id);
CREATE INDEX idx_adt_event_log_type ON adt_event_log(event_type);
CREATE INDEX idx_adt_event_log_datetime ON adt_event_log(event_datetime);
```

### Census Reports Table
```sql
CREATE TABLE census_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  report_date DATE NOT NULL,
  report_time TIME,
  report_type VARCHAR(50) CHECK (report_type IN (
    'daily_census',
    'shift_census',
    'midnight_census',
    'unit_census'
  )),
  unit_id UUID REFERENCES hospital_units(id),
  total_beds INTEGER NOT NULL,
  occupied_beds INTEGER NOT NULL,
  available_beds INTEGER NOT NULL,
  blocked_beds INTEGER DEFAULT 0,
  reserved_beds INTEGER DEFAULT 0,
  occupancy_rate NUMERIC(5,2),
  admissions_count INTEGER DEFAULT 0,
  discharges_count INTEGER DEFAULT 0,
  transfers_in_count INTEGER DEFAULT 0,
  transfers_out_count INTEGER DEFAULT 0,
  patient_details JSONB, -- Snapshot of patients at time of census
  generated_by UUID REFERENCES users(id),
  generated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(report_date, report_time, unit_id)
);

CREATE INDEX idx_census_reports_date ON census_reports(report_date);
CREATE INDEX idx_census_reports_unit ON census_reports(unit_id);
CREATE INDEX idx_census_reports_type ON census_reports(report_type);
```

---

## Backend Services

### BedManagementService
**Location:** `services/ehr-service/src/services/bed-management.service.ts`

**Key Methods:**
- `getAllBeds(filters, tenantDb)` - Get bed list with filters
- `getBedById(id, tenantDb)` - Get bed details
- `getBedAvailability(unitId, tenantDb)` - Get available beds
- `updateBedStatus(bedId, status, reason, tenantDb)` - Update bed status
- `blockBed(bedId, reason, until, tenantDb)` - Block bed
- `unblockBed(bedId, tenantDb)` - Unblock bed
- `findSuitableBed(requirements, tenantDb)` - Find bed matching criteria
- `getBedOccupancyHistory(bedId, dateRange, tenantDb)` - Get bed history
- `reserveBed(bedId, reservationData, tenantDb)` - Reserve bed
- `releaseReservation(reservationId, tenantDb)` - Release reservation

### AdmissionService
**Location:** `services/ehr-service/src/services/admission.service.ts`

**Key Methods:**
- `admitPatient(admissionData, tenantDb)` - Admit patient
- `getAdmission(admissionId, tenantDb)` - Get admission details
- `getActiveAdmissions(filters, tenantDb)` - Get active admissions
- `getPatientAdmissions(patientId, tenantDb)` - Get patient admission history
- `updateAdmission(admissionId, updates, tenantDb)` - Update admission
- `cancelAdmission(admissionId, reason, tenantDb)` - Cancel admission
- `getAdmissionsByUnit(unitId, tenantDb)` - Get unit admissions

### TransferService
**Location:** `services/ehr-service/src/services/transfer.service.ts`

**Key Methods:**
- `initiateTransfer(transferData, tenantDb)` - Initiate transfer
- `approveTransfer(transferId, approvedBy, tenantDb)` - Approve transfer
- `completeTransfer(transferId, tenantDb)` - Complete transfer
- `cancelTransfer(transferId, reason, tenantDb)` - Cancel transfer
- `getPendingTransfers(tenantDb)` - Get pending transfers
- `getTransferHistory(patientId, tenantDb)` - Get transfer history

### DischargeService
**Location:** `services/ehr-service/src/services/discharge.service.ts`

**Key Methods:**
- `dischargePatient(dischargeData, tenantDb)` - Discharge patient
- `getDischarge(dischargeId, tenantDb)` - Get discharge details
- `updateDischarge(dischargeId, updates, tenantDb)` - Update discharge info
- `generateDischargeSummary(admissionId, tenantDb)` - Generate summary
- `getPendingDischarges(tenantDb)` - Get pending discharges
- `getDischargesByDate(date, tenantDb)` - Get discharges by date

### CensusService
**Location:** `services/ehr-service/src/services/census.service.ts`

**Key Methods:**
- `generateCensus(date, time, unitId, tenantDb)` - Generate census report
- `getCurrentCensus(unitId, tenantDb)` - Get real-time census
- `getCensusHistory(dateRange, unitId, tenantDb)` - Get census history
- `calculateOccupancyRate(unitId, tenantDb)` - Calculate occupancy
- `getDailyStatistics(date, tenantDb)` - Get daily ADT statistics

### ADTMessageService
**Location:** `services/ehr-service/src/services/adt-message.service.ts`

**Key Methods:**
- `generateADTMessage(eventType, eventData, tenantDb)` - Generate HL7 ADT
- `sendADTMessage(messageId, destination, tenantDb)` - Send ADT message
- `logADTEvent(eventType, eventData, tenantDb)` - Log ADT event
- `getADTHistory(patientId, tenantDb)` - Get patient ADT history
- `generateA01Message(admission, tenantDb)` - Admit/visit notification
- `generateA02Message(transfer, tenantDb)` - Transfer notification
- `generateA03Message(discharge, tenantDb)` - Discharge notification
- `generateA08Message(update, tenantDb)` - Update patient information

---

## API Endpoints

### Bed Management
- `GET /beds` - Get bed list
- `GET /beds/:id` - Get bed details
- `GET /beds/available` - Get available beds
- `PUT /beds/:id/status` - Update bed status
- `POST /beds/:id/block` - Block bed
- `POST /beds/:id/unblock` - Unblock bed
- `POST /beds/find-suitable` - Find suitable bed
- `GET /beds/:id/history` - Get bed history
- `POST /beds/reserve` - Reserve bed
- `DELETE /bed-reservations/:id` - Cancel reservation

### Admissions
- `POST /admissions` - Admit patient
- `GET /admissions/:id` - Get admission details
- `GET /admissions` - Get admissions (with filters)
- `GET /admissions/patient/:patientId` - Get patient admissions
- `PUT /admissions/:id` - Update admission
- `POST /admissions/:id/cancel` - Cancel admission
- `GET /admissions/unit/:unitId` - Get unit admissions

### Transfers
- `POST /transfers` - Initiate transfer
- `POST /transfers/:id/approve` - Approve transfer
- `POST /transfers/:id/complete` - Complete transfer
- `POST /transfers/:id/cancel` - Cancel transfer
- `GET /transfers/pending` - Get pending transfers
- `GET /transfers/patient/:patientId` - Get transfer history

### Discharges
- `POST /discharges` - Discharge patient
- `GET /discharges/:id` - Get discharge details
- `PUT /discharges/:id` - Update discharge
- `GET /discharges/discharge-summary/:admissionId` - Generate summary
- `GET /discharges/pending` - Get pending discharges
- `GET /discharges/by-date/:date` - Get discharges by date

### Census & Reports
- `POST /census/generate` - Generate census report
- `GET /census/current` - Get current census
- `GET /census/history` - Get census history
- `GET /census/occupancy/:unitId` - Get occupancy rate
- `GET /census/daily-stats/:date` - Get daily statistics

### Hospital Units
- `GET /units` - Get all units
- `GET /units/:id` - Get unit details
- `GET /units/:id/beds` - Get unit beds
- `GET /units/:id/census` - Get unit census

### ADT Events
- `GET /adt-events/patient/:patientId` - Get patient ADT history
- `POST /adt-events/send` - Send ADT message
- `GET /adt-events/log` - Get ADT event log

---

## Frontend Components

### BedBoard Component
**Location:** `ehr-frontend/src/components/BedBoard.tsx`

**Features:**
- Real-time bed occupancy dashboard
- Unit/ward filter
- Bed status color coding
- Patient name on occupied beds
- Quick actions (transfer, discharge)
- Search and filters
- Bed availability summary

### AdmissionForm Component
**Location:** `ehr-frontend/src/components/AdmissionForm.tsx`

**Features:**
- Patient selection/search
- Admission type and source
- Bed assignment
- Provider assignment
- Diagnosis entry
- Expected LOS
- Insurance/financial class

### TransferForm Component
**Location:** `ehr-frontend/src/components/TransferForm.tsx`

**Features:**
- Transfer reason
- Destination unit/bed selection
- Clinical justification
- Handoff checklist
- Equipment transfer list
- Approval workflow

### DischargeForm Component
**Location:** `ehr-frontend/src/components/DischargeForm.tsx`

**Features:**
- Discharge type selection
- Discharge disposition
- Discharge instructions
- Medication reconciliation
- Follow-up scheduling
- Patient education checklist
- Transportation arrangement

### CensusReport Component
**Location:** `ehr-frontend/src/components/CensusReport.tsx`

**Features:**
- Daily/shift census display
- Occupancy rate visualization
- ADT statistics (admissions, discharges, transfers)
- Unit-level breakdown
- Historical trends
- Export functionality

### PatientFlowDashboard Component
**Location:** `ehr-frontend/src/components/PatientFlowDashboard.tsx`

**Features:**
- Real-time patient flow
- Pending admissions
- Pending discharges
- Pending transfers
- ED holding patients
- Length of stay tracking
- Bottleneck identification

---

## HL7 ADT Messages

### Standard ADT Events
- **A01**: Admit/visit notification
- **A02**: Transfer a patient
- **A03**: Discharge/end visit
- **A04**: Register a patient
- **A05**: Pre-admit a patient
- **A06**: Change an outpatient to an inpatient
- **A07**: Change an inpatient to an outpatient
- **A08**: Update patient information
- **A11**: Cancel admit/visit notification
- **A12**: Cancel transfer
- **A13**: Cancel discharge/end visit
- **A21**: Patient goes on leave of absence
- **A22**: Patient returns from leave of absence

---

## Testing Checklist

### Bed Management
- [ ] View bed board
- [ ] Filter by unit
- [ ] Update bed status
- [ ] Block bed with reason
- [ ] Unblock bed
- [ ] Reserve bed
- [ ] Cancel reservation
- [ ] Find suitable bed by criteria

### Admissions
- [ ] Admit emergency patient
- [ ] Admit elective patient
- [ ] Assign bed during admission
- [ ] Update admission details
- [ ] Cancel admission
- [ ] View admission history

### Transfers
- [ ] Initiate unit-to-unit transfer
- [ ] Initiate bed-to-bed transfer
- [ ] Approve transfer
- [ ] Complete transfer with handoff
- [ ] Cancel pending transfer
- [ ] View transfer history

### Discharges
- [ ] Routine discharge
- [ ] AMA discharge
- [ ] Discharge with instructions
- [ ] Schedule follow-up
- [ ] Generate discharge summary
- [ ] Mark bed for housekeeping

### Census & Reporting
- [ ] Generate daily census
- [ ] Generate shift census
- [ ] View occupancy rate
- [ ] View ADT statistics
- [ ] Export census report

### ADT Messages
- [ ] Generate A01 (admission) message
- [ ] Generate A02 (transfer) message
- [ ] Generate A03 (discharge) message
- [ ] View ADT event log
- [ ] Verify HL7 message format

---

## ⚠️ **CRITICAL IMPLEMENTATION GUIDELINES**

### **Database Provisioning**
- ✅ **Create provisioning bundle**: `sprint23_bed_management_adt`
- ✅ **Provisioning script**: `scripts/provision-sprint23-bed-adt.ts`
- ✅ **Seed hospital units and beds** for Bulawayo General
- ✅ **Configure HL7 destinations** for ADT messages

### **HL7 Integration**
- ✅ **HL7 v2.5.1 format** for ADT messages
- ✅ **MSH, EVN, PID, PV1 segments** minimum
- ✅ **Message validation** before sending
- ✅ **Acknowledgment handling** (ACK/NACK)

### **Workflow Requirements**
- ✅ **Real-time updates**: Use WebSocket for live bed board
- ✅ **Access control**: Bed management roles
- ✅ **Audit all ADT events**
- ✅ **Housekeeping integration**: Notify cleaning status

---

## Estimated Effort: 3-4 weeks

### Week 1
- Database schema
- Core bed management
- Admission workflow

### Week 2
- Transfer workflows
- Discharge workflows
- Bed assignment logic

### Week 3
- Census reporting
- HL7 ADT message generation
- Integration testing

### Week 4
- Frontend components
- Real-time updates
- Testing and polish

---

**Last Updated**: December 2, 2025  
**Priority**: CRITICAL ⭐⭐⭐  
**Status**: Ready for implementation

