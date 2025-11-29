# Sprint 6: Diabetes Management Module

## Overview

**Sprint Duration**: 4-6 weeks  
**Goal**: Implement comprehensive diabetes management module aligned with WHO guidelines, integrating CGM devices and providing clinical decision support for diabetes care.

**Priority**: High - Critical for chronic disease management

---

## Phase 1: Database Schema & Core Infrastructure (Week 1-2)

-### 1.1 Database Schema Creation ✅

#### Core Tables
- [x] `diabetes_registry` - Main diabetes patient registry
  - Patient ID, diabetes type (Type 1, Type 2, Gestational, etc.)
  - Diagnosis date, age at diagnosis
  - Family history, primary care provider, endocrinologist
  - SNOMED coding for diabetes type
  - Status tracking (active, resolved, in remission)

- [x] `diabetes_care_bundle` - WHO/ADA care bundle tracking
  - Bundle date, completion percentage
  - HbA1c checked/date/value
  - Blood pressure checked/date/values
  - Lipid profile checked/date
  - Foot exam checked/date/result
  - Eye exam checked/date/result
  - Urine ACR checked/date/value
  - Diabetes education documented/date
  - Medication review completed/date

- [x] `glucose_monitoring` - Blood glucose readings
  - Monitoring type (self-monitoring, CGM, flash, lab)
  - Device type and ID
  - Glucose value and unit (mg/dL or mmol/L)
  - Reading type (fasting, pre-meal, post-meal, random, bedtime)
  - Meal context, insulin dose, carbohydrates
  - Exercise minutes, stress level
  - Recorded timestamp and device sync time

- [x] `cgm_summary` - CGM aggregated data
  - Summary date
  - Time in Range (70-180 mg/dL)
  - Time above range (>180 mg/dL)
  - Time below range (<70 mg/dL, <54 mg/dL)
  - Average glucose, glucose variability
  - Total readings, device info

- [x] `diabetes_medications` - Diabetes-specific medications
  - Medication name, type (oral, injectable, insulin, combination)
  - Medication category (metformin, sulfonylurea, DPP-4, SGLT2, GLP-1, etc.)
  - SNOMED coding
  - Dosage, frequency, route
  - Start/end dates, status
  - Adherence percentage
  - Prescribed by

- [x] `insulin_regimens` - Insulin therapy management
  - Regimen type (basal only, basal-bolus, premixed, pump, other)
  - Basal insulin type and dose
  - Bolus insulin type and ratios
  - Correction factor, target glucose
  - Carb ratio
  - Pump settings (JSONB)
  - Start/end dates, status

- [x] `diabetes_complication_screening` - Complication tracking
  - Screening type (retinopathy, neuropathy, nephropathy, cardiovascular, foot ulcer)
  - Screening date and result
  - SNOMED coding for findings
  - Severity grade
  - Treatment recommendations
  - Next screening due date
  - Performed by, reviewed by

- [x] `diabetes_education_sessions` - Patient education tracking
  - Session date and type (individual, group, online, phone)
  - Topics covered (array)
  - Educator ID
  - Patient attendance and completion status
  - Assessment score
  - Notes

- [x] `diabetes_alerts` - CDS alerts and reminders
  - Alert type (overdue screening, abnormal value, medication adherence, hypoglycemia, hyperglycemia, care bundle incomplete)
  - Alert severity (low, medium, high, critical)
  - Alert message
  - Related metric, value, date
  - Acknowledgment and resolution tracking

- [x] `diabetes_device_integration` - Device connection management
  - Device type (CGM, insulin pump, glucose meter, smart pen, fitness tracker)
  - Device brand, model, serial number
  - Integration type (API, HL7, FHIR, manual, HealthKit, Google Fit)
  - Integration status (active, inactive, error, pending)
  - Last sync time, sync frequency
  - Encrypted API credentials

#### Indexes & Constraints
- [x] Foreign key constraints to patients and users
- [x] Indexes on patient_id, diabetes_registry_id, dates
- [x] Unique constraints where appropriate
- [x] Check constraints for enums and ranges

### 1.2 TypeORM Entities ✅

- [x] `DiabetesRegistry` entity
- [x] `DiabetesCareBundle` entity
- [x] `GlucoseMonitoring` entity
- [x] `CgmSummary` entity
- [x] `DiabetesMedication` entity
- [x] `InsulinRegimen` entity
- [x] `DiabetesComplicationScreening` entity
- [x] `DiabetesEducationSession` entity
- [x] `DiabetesAlert` entity
- [x] `DiabetesDeviceIntegration` entity

### 1.3 DTOs & Validation ✅

- [x] `CreateDiabetesRegistryDto`
- [x] `UpdateDiabetesRegistryDto`
- [x] `CreateCareBundleDto`
- [x] `CreateGlucoseMonitoringDto`
- [x] `CreateCgmSummaryDto`
- [x] `CreateDiabetesMedicationDto`
- [x] `CreateInsulinRegimenDto`
- [x] `CreateComplicationScreeningDto`
- [x] `CreateEducationSessionDto`
- [x] `CreateDeviceIntegrationDto`

---

## Phase 2: Backend Services & APIs (Week 2-3)

### 2.1 Diabetes Service ✅

**File**: `services/ehr-service/src/services/diabetes.service.ts`

#### Core Methods
- [ ] `createRegistry(tenantDb, payload, userId)` - Create diabetes registry entry
- [ ] `getRegistry(tenantDb, patientId)` - Get patient's diabetes registry
- [ ] `updateRegistry(tenantDb, registryId, payload)` - Update registry
- [ ] `listRegistries(tenantDb, filters)` - List all registries with filters

#### Care Bundle Methods
- [ ] `createCareBundle(tenantDb, registryId, payload, userId)` - Record care bundle
- [ ] `getLatestCareBundle(tenantDb, registryId)` - Get most recent bundle
- [ ] `getCareBundleHistory(tenantDb, registryId)` - Get bundle history
- [ ] `calculateBundleCompletion(tenantDb, registryId)` - Calculate completion %

#### Glucose Monitoring Methods
- [ ] `recordGlucose(tenantDb, registryId, payload, userId)` - Manual glucose entry
- [ ] `getGlucoseHistory(tenantDb, registryId, dateRange)` - Get glucose readings
- [ ] `getGlucoseTrends(tenantDb, registryId, period)` - Calculate trends
- [ ] `syncCgmData(tenantDb, registryId, deviceId, data)` - Sync CGM data

#### CGM Summary Methods
- [ ] `calculateCgmSummary(tenantDb, registryId, date)` - Calculate daily CGM summary
- [ ] `getCgmSummaryHistory(tenantDb, registryId, dateRange)` - Get summary history
- [ ] `getTimeInRange(tenantDb, registryId, period)` - Calculate TIR metrics

#### Medication Methods
- [ ] `addMedication(tenantDb, registryId, payload, userId)` - Add diabetes medication
- [ ] `updateMedication(tenantDb, medicationId, payload)` - Update medication
- [ ] `listMedications(tenantDb, registryId)` - List all medications
- [ ] `trackAdherence(tenantDb, medicationId, adherenceData)` - Track adherence

#### Insulin Regimen Methods
- [ ] `createInsulinRegimen(tenantDb, registryId, payload, userId)` - Create regimen
- [ ] `updateInsulinRegimen(tenantDb, regimenId, payload)` - Update regimen
- [ ] `getActiveRegimen(tenantDb, registryId)` - Get current active regimen
- [ ] `calculateInsulinDose(tenantDb, registryId, glucose, carbs)` - Dose calculator

#### Complication Screening Methods
- [ ] `recordScreening(tenantDb, registryId, payload, userId)` - Record screening
- [ ] `getScreeningHistory(tenantDb, registryId, screeningType)` - Get history
- [ ] `getUpcomingScreenings(tenantDb, registryId)` - Get due screenings
- [ ] `checkScreeningDue(tenantDb, registryId)` - Check if screenings overdue

#### Education Methods
- [ ] `recordEducationSession(tenantDb, registryId, payload, userId)` - Record session
- [ ] `getEducationHistory(tenantDb, registryId)` - Get education history
- [ ] `checkEducationDue(tenantDb, registryId)` - Check if education needed

#### Alert Methods
- [ ] `generateAlerts(tenantDb, registryId)` - Generate all alerts
- [ ] `acknowledgeAlert(tenantDb, alertId, userId)` - Acknowledge alert
- [ ] `resolveAlert(tenantDb, alertId, userId, notes)` - Resolve alert
- [ ] `getActiveAlerts(tenantDb, registryId)` - Get active alerts

#### Dashboard Methods
- [ ] `getDashboardSummary(tenantDb, filters)` - Get dashboard data
  - Total registries
  - Active registries by type
  - Care bundle completion rates
  - Average HbA1c by type
  - Alert counts by severity
  - Upcoming screenings

### 2.2 Clinical Decision Support (CDS) Rules ✅

**File**: `services/ehr-service/src/services/diabetes-cds.service.ts`

#### Alert Rules
- [ ] **Overdue Screening Alerts**:
  - Eye exam overdue (>365 days)
  - Foot exam overdue (>365 days)
  - Urine ACR overdue (>365 days)
  - Lipid profile overdue (>365 days)

- [ ] **Abnormal Value Alerts**:
  - HbA1c >9% (high severity)
  - HbA1c >8% (medium severity)
  - Blood glucose <70 mg/dL (critical - hypoglycemia)
  - Blood glucose >250 mg/dL (high - hyperglycemia)
  - Blood pressure >140/90 mmHg (medium)
  - eGFR <60 (medium - CKD stage 3+)
  - Urine ACR >30 mg/g (medium - microalbuminuria)

- [ ] **Medication Alerts**:
  - Medication adherence <80% (medium)
  - Metformin with eGFR <30 (critical - contraindicated)
  - Drug-drug interactions (high)

- [ ] **Care Bundle Alerts**:
  - Care bundle completion <80% (medium)
  - Missing critical components (high)

- [ ] **CGM Alerts**:
  - Time below range >4% (high)
  - Time above range >25% (medium)
  - Glucose variability high (medium)

### 2.3 Device Integration Service ✅

**File**: `services/ehr-service/src/services/diabetes-device-integration.service.ts`

#### CGM Integration
- [ ] **Dexcom Share API Integration**:
  - OAuth authentication
  - Real-time glucose data sync
  - Trend data retrieval
  - Alert configuration

- [ ] **FreeStyle Libre Integration**:
  - LibreView API integration
  - Flash glucose data sync
  - Time in range calculations

- [ ] **Glooko Integration** (Optional):
  - Unified platform integration
  - Multi-device data aggregation

#### Insulin Pump Integration
- [ ] **Tandem t:connect API**:
  - Insulin delivery data
  - Pump settings sync
  - CGM data integration

- [ ] **Omnipod DASH API**:
  - Pod status monitoring
  - Insulin delivery tracking

#### Mobile App Integration
- [ ] **Apple HealthKit Integration**:
  - Glucose readings import
  - Insulin doses import
  - Exercise data import

- [ ] **Google Fit Integration**:
  - Glucose readings import
  - Insulin doses import
  - Exercise data import

- [ ] **mySugr API Integration**:
  - Data export from mySugr
  - HbA1c estimates

### 2.4 Diabetes Controller ✅

**File**: `services/ehr-service/src/controllers/diabetes.controller.ts`

#### Registry Endpoints
- [ ] `POST /diabetes/registry` - Create diabetes registry
- [ ] `GET /diabetes/registry/:patientId` - Get patient's registry
- [ ] `PATCH /diabetes/registry/:id` - Update registry
- [ ] `GET /diabetes/registry` - List all registries (with filters)

#### Care Bundle Endpoints
- [ ] `POST /diabetes/registry/:id/care-bundle` - Record care bundle
- [ ] `GET /diabetes/registry/:id/care-bundle/latest` - Get latest bundle
- [ ] `GET /diabetes/registry/:id/care-bundle/history` - Get bundle history

#### Glucose Monitoring Endpoints
- [ ] `POST /diabetes/registry/:id/glucose` - Record glucose reading
- [ ] `GET /diabetes/registry/:id/glucose` - Get glucose history
- [ ] `GET /diabetes/registry/:id/glucose/trends` - Get glucose trends
- [ ] `POST /diabetes/registry/:id/glucose/sync-cgm` - Sync CGM data

#### CGM Summary Endpoints
- [ ] `GET /diabetes/registry/:id/cgm-summary` - Get CGM summary
- [ ] `GET /diabetes/registry/:id/cgm-summary/history` - Get summary history
- [ ] `GET /diabetes/registry/:id/cgm-summary/time-in-range` - Get TIR metrics

#### Medication Endpoints
- [ ] `POST /diabetes/registry/:id/medications` - Add medication
- [ ] `PATCH /diabetes/medications/:id` - Update medication
- [ ] `GET /diabetes/registry/:id/medications` - List medications
- [ ] `POST /diabetes/medications/:id/adherence` - Track adherence

#### Insulin Regimen Endpoints
- [ ] `POST /diabetes/registry/:id/insulin-regimens` - Create regimen
- [ ] `PATCH /diabetes/insulin-regimens/:id` - Update regimen
- [ ] `GET /diabetes/registry/:id/insulin-regimens/active` - Get active regimen
- [ ] `POST /diabetes/insulin-regimens/:id/calculate-dose` - Calculate dose

#### Complication Screening Endpoints
- [ ] `POST /diabetes/registry/:id/screenings` - Record screening
- [ ] `GET /diabetes/registry/:id/screenings` - Get screening history
- [ ] `GET /diabetes/registry/:id/screenings/upcoming` - Get due screenings

#### Education Endpoints
- [ ] `POST /diabetes/registry/:id/education` - Record education session
- [ ] `GET /diabetes/registry/:id/education` - Get education history

#### Alert Endpoints
- [ ] `GET /diabetes/registry/:id/alerts` - Get active alerts
- [ ] `POST /diabetes/alerts/:id/acknowledge` - Acknowledge alert
- [ ] `POST /diabetes/alerts/:id/resolve` - Resolve alert
- [ ] `POST /diabetes/registry/:id/alerts/generate` - Generate alerts

#### Device Integration Endpoints
- [ ] `POST /diabetes/registry/:id/devices` - Connect device
- [ ] `GET /diabetes/registry/:id/devices` - List connected devices
- [ ] `PATCH /diabetes/devices/:id` - Update device settings
- [ ] `POST /diabetes/devices/:id/sync` - Manual sync
- [ ] `DELETE /diabetes/devices/:id` - Disconnect device

#### Dashboard Endpoints
- [ ] `GET /diabetes/dashboard/summary` - Get dashboard summary
- [ ] `GET /diabetes/dashboard/patients` - Get patient list with metrics

---

## Phase 3: Frontend Components (Week 3-4)

### 3.1 Diabetes Dashboard ✅

**File**: `ehr-frontend/src/pages/DiabetesDashboard.tsx`

#### Overview Cards
- [ ] Latest HbA1c with trend indicator
- [ ] Time in Range (if CGM available)
- [ ] Care Bundle Completion %
- [ ] Active Alerts Count
- [ ] Next Screening Due

#### Glucose Trends Chart
- [ ] Line chart showing glucose over time
- [ ] Color-coded zones (hypo <70, target 70-180, hyper >180)
- [ ] Meal markers
- [ ] Insulin dose markers
- [ ] Date range selector (7 days, 14 days, 30 days, 90 days, custom)

#### Care Bundle Checklist
- [ ] Visual checklist of required screenings
- [ ] Due dates and completion status
- [ ] Quick action buttons to schedule/record
- [ ] Completion percentage indicator

#### Medication List
- [ ] Current diabetes medications
- [ ] Doses and frequencies
- [ ] Adherence tracking with visual indicators
- [ ] Quick add/edit buttons

#### Recent Glucose Readings
- [ ] Table of recent SMBG or CGM readings
- [ ] Filter by date range
- [ ] Export functionality (PDF/CSV)
- [ ] Quick add reading button

#### Alerts Panel
- [ ] Active alerts sorted by severity
- [ ] Acknowledge/resolve actions
- [ ] Filter by alert type
- [ ] Alert history

### 3.2 Glucose Monitoring Interface ✅

**File**: `ehr-frontend/src/components/DiabetesGlucoseMonitoring.tsx`

#### Manual Entry Form
- [ ] Glucose value input
- [ ] Reading type selector (fasting, pre-meal, post-meal, random, bedtime)
- [ ] Meal context (optional)
- [ ] Insulin dose (optional)
- [ ] Carbohydrates (optional)
- [ ] Exercise minutes (optional)
- [ ] Stress level (1-10 scale)
- [ ] Notes field

#### CGM Integration Status
- [ ] Connected device info display
- [ ] Last sync time
- [ ] Manual sync button
- [ ] Device settings link
- [ ] Disconnect device option

#### Glucose Log View
- [ ] Calendar view
- [ ] List view with filters
- [ ] Chart view with trends
- [ ] Export to PDF/CSV

### 3.3 Care Bundle Interface ✅

**File**: `ehr-frontend/src/components/DiabetesCareBundle.tsx`

#### Checklist View
- [ ] Each bundle component with status
- [ ] Due dates highlighted
- [ ] Last completed date
- [ ] Quick record buttons
- [ ] Completion percentage

#### Detail View
- [ ] Full details of each screening
- [ ] Results and findings
- [ ] Treatment recommendations
- [ ] Next due date
- [ ] SNOMED coding display

### 3.4 Medication Management Interface ✅

**File**: `ehr-frontend/src/components/DiabetesMedications.tsx`

#### Current Medications
- [ ] List of active medications
- [ ] Dosage and frequency display
- [ ] Adherence percentage
- [ ] Quick edit buttons

#### Add/Edit Medication Modal
- [ ] Medication name with SNOMED picker
- [ ] Medication type selector
- [ ] Dosage and frequency inputs
- [ ] Start date picker
- [ ] End date picker (optional)
- [ ] Prescribed by selector

#### Adherence Tracking
- [ ] Adherence percentage display
- [ ] Adherence history chart
- [ ] Missed doses tracking
- [ ] Adherence notes

### 3.5 Insulin Regimen Interface ✅

**File**: `ehr-frontend/src/components/DiabetesInsulinRegimen.tsx`

#### Regimen Display
- [ ] Current active regimen
- [ ] Regimen type display
- [ ] Basal insulin details
- [ ] Bolus insulin details
- [ ] Correction factor and target glucose
- [ ] Carb ratio

#### Dose Calculator
- [ ] Current glucose input
- [ ] Target glucose display
- [ ] Carbohydrates input
- [ ] Calculated bolus dose
- [ ] Correction dose (if needed)
- [ ] Total recommended dose

### 3.6 Device Integration Interface ✅

**File**: `ehr-frontend/src/components/DiabetesDeviceIntegration.tsx`

#### Device List
- [ ] Connected devices display
- [ ] Device status indicators
- [ ] Last sync time
- [ ] Sync frequency

#### Add Device Modal
- [ ] Device type selector
- [ ] Device brand/model selector
- [ ] Integration type selector
- [ ] API credentials input (encrypted)
- [ ] Sync frequency configuration

#### Device Settings
- [ ] Sync frequency adjustment
- [ ] Alert configuration
- [ ] Data retention settings

---

## Phase 4: Integration & Testing (Week 4-5)

### 4.1 Integration with Existing Modules ✅

- [ ] **Vitals Integration**:
  - Link glucose readings from vitals table
  - Auto-populate diabetes dashboard
  - Alert on abnormal glucose in vitals

- [ ] **Lab Results Integration**:
  - Link HbA1c, lipid profile, urine ACR from lab_results
  - Auto-populate care bundle
  - Alert on abnormal lab values

- [ ] **Prescriptions Integration**:
  - Link diabetes medications from prescriptions
  - Track medication adherence
  - Alert on medication interactions

- [ ] **Appointments Integration**:
  - Schedule diabetes-related appointments
  - Link appointments to care bundle components
  - Remind patients of upcoming screenings

- [ ] **Medical Records Integration**:
  - Link complication screening results
  - Store diabetes education materials
  - Document patient education sessions

### 4.2 Device Integration Testing ✅

- [ ] **Dexcom Integration Testing**:
  - OAuth flow testing
  - Data sync testing
  - Error handling

- [ ] **FreeStyle Libre Integration Testing**:
  - API authentication
  - Data retrieval
  - Error handling

- [ ] **HealthKit/Google Fit Testing**:
  - Data import testing
  - Permission handling
  - Error scenarios

### 4.3 CDS Rules Testing ✅

- [ ] **Alert Generation Testing**:
  - Overdue screening alerts
  - Abnormal value alerts
  - Medication alerts
  - Care bundle alerts

- [ ] **Alert Acknowledgment Testing**:
  - Acknowledge workflow
  - Resolution workflow
  - Alert history

### 4.4 End-to-End Testing ✅

- [ ] **Patient Journey Testing**:
  - Register diabetes patient
  - Record care bundle
  - Enter glucose readings
  - Add medications
  - Record screenings
  - Generate alerts

- [ ] **Device Integration Testing**:
  - Connect CGM device
  - Sync data
  - View CGM summary
  - Generate alerts from CGM data

---

## Phase 5: Documentation & Training (Week 5-6)

### 5.1 API Documentation ✅

- [ ] Swagger/OpenAPI documentation
- [ ] Endpoint descriptions
- [ ] Request/response examples
- [ ] Error codes and handling

### 5.2 User Documentation ✅

- [ ] Diabetes module user guide
- [ ] Device integration guide
- [ ] Care bundle documentation
- [ ] Alert system documentation

### 5.3 Training Materials ✅

- [ ] Video tutorials
- [ ] Step-by-step guides
- [ ] FAQ document
- [ ] Troubleshooting guide

---

## Success Criteria

### Must Have (MVP)
1. ✅ Diabetes registry creation and management
2. ✅ Care bundle tracking with completion %
3. ✅ Manual glucose entry and history
4. ✅ Basic CDS alerts (overdue screenings, abnormal values)
5. ✅ Medication management
6. ✅ Dashboard with key metrics

### Should Have
1. CGM integration (at least one device)
2. Time in Range calculations
3. Insulin regimen management
4. Complication screening tracking
5. Education session tracking

### Nice to Have
1. Multiple CGM device integrations
2. Insulin pump integration
3. Advanced analytics
4. Patient portal integration
5. Mobile app integration

---

## Dependencies

- ✅ Multi-tenant architecture
- ✅ SNOMED CT integration
- ✅ CDSS service
- ✅ Vitals module
- ✅ Lab results module
- ✅ Prescriptions module
- ✅ Appointments module

## Risks & Mitigation

1. **Device API Changes**
   - Risk: CGM device APIs may change
   - Mitigation: Abstract device integration layer, version API calls

2. **Data Volume**
   - Risk: CGM data can be large (288 readings/day)
   - Mitigation: Aggregate data, use CGM summary tables, implement pagination

3. **CDS Rule Complexity**
   - Risk: Complex alert rules may have false positives
   - Mitigation: Start with simple rules, iterate based on feedback

4. **Integration Complexity**
   - Risk: Multiple device integrations can be complex
   - Mitigation: Start with one device (Dexcom), add others incrementally

---

## Next Steps

1. **Grooming Session**: Review and prioritize tasks
2. **Technical Design**: Finalize API contracts, database schemas
3. **Implementation**: Start with Phase 1 (Database Schema)
4. **Testing**: Unit tests, integration tests, user acceptance
5. **Deployment**: Staged rollout to production

---

**Sprint 6 Goal**: Enable comprehensive diabetes management with WHO-aligned care bundles, CGM integration, and clinical decision support.


