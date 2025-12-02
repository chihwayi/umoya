# Sprint 22: Immunization Registry Integration

## Overview
Comprehensive immunization management system with integration to national/regional immunization registries, vaccine inventory tracking, schedule management, and public health reporting. Supports CDC, WHO, and Zimbabwe-specific immunization protocols.

## Goals
- Complete immunization history management
- Vaccine schedule management (pediatric & adult)
- Contraindication checking and screening
- Vaccine inventory management
- Adverse event tracking
- Integration with national/regional registries
- Public health reporting (IIS, ImmPort, DHIS2)
- Forecasting and reminders
- VIS (Vaccine Information Statement) distribution

## Priority: ⭐⭐⭐ CRITICAL
**Estimated Effort**: 2-3 weeks

---

## Database Schema

### Immunizations Table
```sql
CREATE TABLE immunizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID NOT NULL REFERENCES patients(id),
  vaccine_id UUID REFERENCES vaccines(id),
  vaccine_code VARCHAR(50) NOT NULL, -- CVX code
  vaccine_name VARCHAR(255) NOT NULL,
  vaccine_manufacturer VARCHAR(255),
  lot_number VARCHAR(100),
  expiration_date DATE,
  administration_date DATE NOT NULL,
  administration_time TIME,
  administered_by UUID REFERENCES users(id),
  ordering_provider UUID REFERENCES users(id),
  site VARCHAR(100), -- Injection site
  route VARCHAR(50) CHECK (route IN (
    'intramuscular',
    'subcutaneous',
    'oral',
    'intradermal',
    'intranasal',
    'other'
  )),
  dosage VARCHAR(50),
  dose_number INTEGER, -- 1st, 2nd, 3rd dose
  series_complete BOOLEAN DEFAULT false,
  vaccine_series VARCHAR(100), -- e.g., "DTaP series"
  funding_source VARCHAR(100) CHECK (funding_source IN (
    'private',
    'public',
    'vfc', -- Vaccines for Children
    'insurance',
    'other'
  )),
  location VARCHAR(255), -- Facility name
  location_address JSONB,
  vis_given BOOLEAN DEFAULT false, -- Vaccine Information Statement
  vis_version DATE,
  vis_publication_date DATE,
  administered_amount NUMERIC(10,2),
  administered_amount_unit VARCHAR(20),
  refusal_reason TEXT, -- If vaccine was refused
  status VARCHAR(50) DEFAULT 'completed' CHECK (status IN (
    'completed',
    'refused',
    'not_administered',
    'error',
    'pending'
  )),
  completion_status VARCHAR(50) CHECK (completion_status IN (
    'completed',
    'partially_completed',
    'not_administered'
  )),
  registry_reported BOOLEAN DEFAULT false,
  registry_report_date TIMESTAMP WITH TIME ZONE,
  registry_response JSONB,
  notes TEXT,
  reaction TEXT, -- Immediate reaction
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_immunizations_patient ON immunizations(patient_id);
CREATE INDEX idx_immunizations_vaccine ON immunizations(vaccine_id);
CREATE INDEX idx_immunizations_date ON immunizations(administration_date);
CREATE INDEX idx_immunizations_status ON immunizations(status);
CREATE INDEX idx_immunizations_registry_reported ON immunizations(registry_reported);
```

### Vaccines Table (Master Catalog)
```sql
CREATE TABLE vaccines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cvx_code VARCHAR(10) NOT NULL UNIQUE, -- CDC CVX code
  vaccine_name VARCHAR(255) NOT NULL,
  vaccine_short_name VARCHAR(100),
  vaccine_description TEXT,
  vaccine_status VARCHAR(20) DEFAULT 'active' CHECK (vaccine_status IN (
    'active',
    'inactive',
    'pending'
  )),
  vaccine_type VARCHAR(100), -- Live attenuated, inactivated, etc.
  target_diseases JSONB NOT NULL, -- Array of diseases
  vaccine_group VARCHAR(100), -- DTaP, MMR, etc.
  manufacturer VARCHAR(255),
  ndc_codes JSONB DEFAULT '[]'::jsonb, -- National Drug Codes
  cpt_codes JSONB DEFAULT '[]'::jsonb, -- For billing
  recommended_schedule JSONB, -- {min_age, max_age, dose_intervals}
  contraindications JSONB DEFAULT '[]'::jsonb,
  precautions JSONB DEFAULT '[]'::jsonb,
  route_of_administration VARCHAR(50),
  standard_dosage VARCHAR(50),
  number_of_doses INTEGER,
  vis_publication_date DATE,
  vis_url TEXT,
  is_combination BOOLEAN DEFAULT false,
  combination_vaccines JSONB, -- If combination, list component vaccines
  is_live BOOLEAN DEFAULT false,
  minimum_age_months INTEGER,
  maximum_age_months INTEGER,
  storage_requirements TEXT,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_vaccines_cvx ON vaccines(cvx_code);
CREATE INDEX idx_vaccines_status ON vaccines(vaccine_status);
CREATE INDEX idx_vaccines_group ON vaccines(vaccine_group);
```

### Vaccine Inventory Table
```sql
CREATE TABLE vaccine_inventory (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vaccine_id UUID NOT NULL REFERENCES vaccines(id),
  lot_number VARCHAR(100) NOT NULL,
  manufacturer VARCHAR(255) NOT NULL,
  ndc_code VARCHAR(50),
  quantity_received INTEGER NOT NULL,
  quantity_remaining INTEGER NOT NULL,
  quantity_wasted INTEGER DEFAULT 0,
  wastage_reason TEXT,
  unit_cost NUMERIC(10,2),
  total_cost NUMERIC(10,2),
  funding_source VARCHAR(100),
  expiration_date DATE NOT NULL,
  received_date DATE NOT NULL,
  received_by UUID REFERENCES users(id),
  storage_location VARCHAR(255),
  storage_temperature_min NUMERIC(5,2),
  storage_temperature_max NUMERIC(5,2),
  vfc_eligible BOOLEAN DEFAULT false, -- Vaccines for Children eligible
  status VARCHAR(50) DEFAULT 'active' CHECK (status IN (
    'active',
    'expired',
    'recalled',
    'wasted',
    'depleted'
  )),
  recall_status VARCHAR(50),
  recall_date DATE,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(lot_number, manufacturer, ndc_code)
);

CREATE INDEX idx_vaccine_inventory_vaccine ON vaccine_inventory(vaccine_id);
CREATE INDEX idx_vaccine_inventory_lot ON vaccine_inventory(lot_number);
CREATE INDEX idx_vaccine_inventory_expiration ON vaccine_inventory(expiration_date);
CREATE INDEX idx_vaccine_inventory_status ON vaccine_inventory(status);
```

### Immunization Schedules Table
```sql
CREATE TABLE immunization_schedules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  schedule_name VARCHAR(255) NOT NULL,
  schedule_type VARCHAR(50) CHECK (schedule_type IN (
    'pediatric',
    'adult',
    'catch_up',
    'pregnancy',
    'travel',
    'high_risk'
  )),
  country_code VARCHAR(10) DEFAULT 'ZW',
  schedule_version VARCHAR(20) NOT NULL,
  effective_date DATE NOT NULL,
  is_active BOOLEAN DEFAULT true,
  schedule_data JSONB NOT NULL, -- Complete schedule definition
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_immunization_schedules_type ON immunization_schedules(schedule_type);
CREATE INDEX idx_immunization_schedules_active ON immunization_schedules(is_active);
```

### Immunization Forecasts Table
```sql
CREATE TABLE immunization_forecasts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID NOT NULL REFERENCES patients(id),
  vaccine_id UUID REFERENCES vaccines(id),
  vaccine_code VARCHAR(50) NOT NULL,
  vaccine_name VARCHAR(255) NOT NULL,
  dose_number INTEGER,
  forecast_status VARCHAR(50) CHECK (forecast_status IN (
    'due',
    'overdue',
    'upcoming',
    'not_complete',
    'complete',
    'contraindicated',
    'immune',
    'not_recommended'
  )),
  earliest_date DATE, -- Earliest date vaccine can be given
  recommended_date DATE, -- Recommended date
  overdue_date DATE, -- Date when overdue
  reason TEXT, -- Reason for forecast status
  priority VARCHAR(20) DEFAULT 'routine' CHECK (priority IN (
    'routine',
    'catch_up',
    'high_priority',
    'due_soon'
  )),
  contraindications JSONB,
  forecast_date DATE NOT NULL DEFAULT CURRENT_DATE,
  expires_date DATE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_immunization_forecasts_patient ON immunization_forecasts(patient_id);
CREATE INDEX idx_immunization_forecasts_status ON immunization_forecasts(forecast_status);
CREATE INDEX idx_immunization_forecasts_date ON immunization_forecasts(recommended_date);
```

### Adverse Events Table
```sql
CREATE TABLE vaccine_adverse_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID NOT NULL REFERENCES patients(id),
  immunization_id UUID REFERENCES immunizations(id),
  vaccine_code VARCHAR(50) NOT NULL,
  vaccine_name VARCHAR(255) NOT NULL,
  event_date DATE NOT NULL,
  event_time TIME,
  onset_interval INTEGER, -- Minutes/hours after administration
  onset_interval_unit VARCHAR(20) DEFAULT 'hours',
  event_type VARCHAR(100) CHECK (event_type IN (
    'local_reaction',
    'systemic_reaction',
    'allergic_reaction',
    'anaphylaxis',
    'fever',
    'seizure',
    'other'
  )),
  severity VARCHAR(50) CHECK (severity IN (
    'mild',
    'moderate',
    'severe',
    'life_threatening',
    'death'
  )),
  description TEXT NOT NULL,
  symptoms JSONB, -- Array of symptoms
  treatment_given TEXT,
  outcome VARCHAR(100) CHECK (outcome IN (
    'recovered',
    'recovering',
    'not_recovered',
    'permanent_damage',
    'death',
    'unknown'
  )),
  hospitalized BOOLEAN DEFAULT false,
  emergency_visit BOOLEAN DEFAULT false,
  reported_to_vaers BOOLEAN DEFAULT false, -- Vaccine Adverse Event Reporting System
  vaers_report_id VARCHAR(100),
  vaers_report_date DATE,
  reported_by UUID REFERENCES users(id),
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_adverse_events_patient ON vaccine_adverse_events(patient_id);
CREATE INDEX idx_adverse_events_immunization ON vaccine_adverse_events(immunization_id);
CREATE INDEX idx_adverse_events_date ON vaccine_adverse_events(event_date);
CREATE INDEX idx_adverse_events_severity ON vaccine_adverse_events(severity);
```

### Registry Submissions Table
```sql
CREATE TABLE immunization_registry_submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID NOT NULL REFERENCES patients(id),
  immunization_id UUID REFERENCES immunizations(id),
  registry_name VARCHAR(100) NOT NULL, -- 'IIS', 'DHIS2', 'Zimbabwe Registry'
  submission_type VARCHAR(50) CHECK (submission_type IN (
    'new_immunization',
    'update_immunization',
    'patient_registration',
    'forecast_request',
    'history_query'
  )),
  submission_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  request_payload JSONB,
  response_status VARCHAR(50) CHECK (response_status IN (
    'success',
    'partial_success',
    'failed',
    'pending',
    'error'
  )),
  response_payload JSONB,
  error_message TEXT,
  retry_count INTEGER DEFAULT 0,
  last_retry_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_registry_submissions_patient ON immunization_registry_submissions(patient_id);
CREATE INDEX idx_registry_submissions_status ON immunization_registry_submissions(response_status);
CREATE INDEX idx_registry_submissions_date ON immunization_registry_submissions(submission_date);
```

---

## Backend Services

### ImmunizationService
**Location:** `services/ehr-service/src/services/immunization.service.ts`

**Key Methods:**
- `recordImmunization(immunizationData, tenantDb)` - Record administered vaccine
- `getPatientImmunizations(patientId, tenantDb)` - Get immunization history
- `getImmunizationById(id, tenantDb)` - Get immunization details
- `updateImmunization(id, updates, tenantDb)` - Update immunization record
- `deleteImmunization(id, tenantDb)` - Soft delete immunization
- `recordRefusal(refusalData, tenantDb)` - Record vaccine refusal
- `generateImmunizationCard(patientId, tenantDb)` - Generate immunization card
- `exportImmunizationHistory(patientId, format, tenantDb)` - Export history

### VaccineService
**Location:** `services/ehr-service/src/services/vaccine.service.ts`

**Key Methods:**
- `getVaccineCatalog(filters, tenantDb)` - Get vaccine catalog
- `getVaccineById(id, tenantDb)` - Get vaccine details
- `searchVaccines(query, tenantDb)` - Search by name/CVX code
- `getVaccineByCV XCode(cvx, tenantDb)` - Get vaccine by CVX code
- `getVaccineContraindications(vaccineId, patientId, tenantDb)` - Check contraindications
- `getVaccineInformation(vaccineId, tenantDb)` - Get VIS and details
- `seedDefaultVaccines(tenantDb)` - Seed standard vaccine catalog

### VaccineInventoryService
**Location:** `services/ehr-service/src/services/vaccine-inventory.service.ts`

**Key Methods:**
- `addInventory(inventoryData, tenantDb)` - Add vaccine stock
- `getInventory(filters, tenantDb)` - Get inventory list
- `updateInventory(id, updates, tenantDb)` - Update inventory
- `recordAdministration(immunizationId, tenantDb)` - Deduct from inventory
- `recordWastage(lotNumber, quantity, reason, tenantDb)` - Record wastage
- `getExpiringVaccines(daysThreshold, tenantDb)` - Get expiring stock
- `getLowStockVaccines(threshold, tenantDb)` - Get low stock alerts
- `recallVaccine(lotNumber, reason, tenantDb)` - Mark as recalled

### ImmunizationForecastService
**Location:** `services/ehr-service/src/services/immunization-forecast.service.ts`

**Key Methods:**
- `generateForecast(patientId, tenantDb)` - Generate immunization forecast
- `getForecast(patientId, tenantDb)` - Get current forecast
- `checkDueVaccines(patientId, tenantDb)` - Check due/overdue vaccines
- `getNextDueVaccine(patientId, tenantDb)` - Get next vaccine due
- `updateForecast(patientId, tenantDb)` - Recalculate forecast
- `getCatchUpSchedule(patientId, tenantDb)` - Generate catch-up plan

### ImmunizationRegistryService
**Location:** `services/ehr-service/src/services/immunization-registry.service.ts`

**Key Methods:**
- `submitToRegistry(immunizationId, registryName, tenantDb)` - Submit to registry
- `registerPatient(patientId, registryName, tenantDb)` - Register patient
- `queryRegistry(patientId, registryName, tenantDb)` - Query patient history
- `requestForecast(patientId, registryName, tenantDb)` - Request forecast from registry
- `updateRegistryRecord(immunizationId, registryName, tenantDb)` - Update record
- `batchSubmit(immunizationIds, registryName, tenantDb)` - Batch submission
- `getSubmissionStatus(submissionId, tenantDb)` - Get submission status

### AdverseEventService
**Location:** `services/ehr-service/src/services/adverse-event.service.ts`

**Key Methods:**
- `recordAdverseEvent(eventData, tenantDb)` - Record adverse event
- `getPatientAdverseEvents(patientId, tenantDb)` - Get patient events
- `getVaccineAdverseEvents(vaccineId, tenantDb)` - Get vaccine-specific events
- `submitToVAERS(eventId, tenantDb)` - Submit to VAERS
- `getVAERSStatus(eventId, tenantDb)` - Get VAERS submission status
- `generateAdverseEventReport(filters, tenantDb)` - Generate report

---

## API Endpoints

### Immunizations
- `POST /immunizations` - Record immunization
- `GET /immunizations` - List immunizations
- `GET /immunizations/patient/:patientId` - Get patient immunizations
- `GET /immunizations/:id` - Get immunization details
- `PUT /immunizations/:id` - Update immunization
- `DELETE /immunizations/:id` - Delete immunization
- `POST /immunizations/refusal` - Record refusal
- `GET /immunizations/patient/:patientId/card` - Generate immunization card
- `GET /immunizations/patient/:patientId/export` - Export history

### Vaccines
- `GET /vaccines` - Get vaccine catalog
- `GET /vaccines/:id` - Get vaccine details
- `GET /vaccines/cvx/:code` - Get vaccine by CVX code
- `GET /vaccines/search` - Search vaccines
- `GET /vaccines/:id/contraindications/:patientId` - Check contraindications
- `GET /vaccines/:id/information` - Get VIS and details
- `POST /vaccines/seed` - Seed default vaccines

### Vaccine Inventory
- `POST /vaccine-inventory` - Add inventory
- `GET /vaccine-inventory` - Get inventory list
- `PUT /vaccine-inventory/:id` - Update inventory
- `POST /vaccine-inventory/wastage` - Record wastage
- `GET /vaccine-inventory/expiring` - Get expiring vaccines
- `GET /vaccine-inventory/low-stock` - Get low stock alerts
- `POST /vaccine-inventory/recall` - Recall vaccine lot

### Immunization Forecasts
- `POST /immunization-forecasts/generate/:patientId` - Generate forecast
- `GET /immunization-forecasts/patient/:patientId` - Get patient forecast
- `GET /immunization-forecasts/due/:patientId` - Check due vaccines
- `GET /immunization-forecasts/next-due/:patientId` - Get next due vaccine
- `POST /immunization-forecasts/catch-up/:patientId` - Generate catch-up plan

### Registry Integration
- `POST /immunization-registry/submit` - Submit to registry
- `POST /immunization-registry/register-patient` - Register patient
- `POST /immunization-registry/query` - Query registry
- `POST /immunization-registry/forecast-request` - Request forecast
- `POST /immunization-registry/batch-submit` - Batch submission
- `GET /immunization-registry/status/:submissionId` - Get submission status

### Adverse Events
- `POST /adverse-events` - Record adverse event
- `GET /adverse-events/patient/:patientId` - Get patient events
- `GET /adverse-events/vaccine/:vaccineId` - Get vaccine events
- `POST /adverse-events/:id/vaers-submit` - Submit to VAERS
- `GET /adverse-events/report` - Generate report

---

## Frontend Components

### ImmunizationForm Component
**Location:** `ehr-frontend/src/components/ImmunizationForm.tsx`

**Features:**
- Vaccine search and selection
- Dose number tracking
- Lot number and expiration date
- Administration site and route
- VIS distribution tracking
- Contraindication checking
- Inventory selection
- Immediate reaction recording

### ImmunizationHistory Component
**Location:** `ehr-frontend/src/components/ImmunizationHistory.tsx`

**Features:**
- Chronological immunization list
- Filter by vaccine type
- Dose series completion status
- VIS given status
- Export immunization card
- Print history
- Registry submission status

### VaccineForecast Component
**Location:** `ehr-frontend/src/components/VaccineForecast.tsx`

**Features:**
- Due and upcoming vaccines display
- Overdue vaccine alerts
- Earliest/recommended dates
- Catch-up schedule view
- Contraindication warnings
- Quick immunization record button

### VaccineInventory Component
**Location:** `ehr-frontend/src/components/VaccineInventory.tsx`

**Features:**
- Current stock levels
- Expiration alerts
- Low stock warnings
- Lot number tracking
- Wastage recording
- Recall management
- Inventory reports

### ImmunizationCard Component
**Location:** `ehr-frontend/src/components/ImmunizationCard.tsx`

**Features:**
- Generate printable immunization card
- WHO/CDC format options
- QR code with immunization data
- Multi-language support
- Export as PDF

### AdverseEventForm Component
**Location:** `ehr-frontend/src/components/AdverseEventForm.tsx`

**Features:**
- Event details capture
- Symptom checkboxes
- Severity assessment
- Treatment documentation
- VAERS submission
- Follow-up tracking

---

## Registry Integration

### Supported Registries
1. **IIS (Immunization Information Systems)** - US state registries
2. **DHIS2** - District Health Information System
3. **Zimbabwe National Immunization Registry**
4. **WHO Immunization Data System**

### Integration Protocol
- **HL7 v2.5.1 VXU messages** for immunization reporting
- **HL7 v2.5.1 QBP/RSP messages** for queries
- **REST API** fallback
- **Batch file submission** for offline scenarios

---

## Standard Vaccine Catalogs

### Pediatric Vaccines (Zimbabwe Schedule)
- BCG (Tuberculosis)
- OPV (Polio)
- DTP (Diphtheria, Tetanus, Pertussis)
- Hep B (Hepatitis B)
- Hib (Haemophilus influenzae type b)
- PCV (Pneumococcal)
- Rotavirus
- Measles
- Vitamin A

### Adult Vaccines
- Td/Tdap (Tetanus, Diphtheria)
- Influenza
- Pneumococcal
- Hepatitis B
- COVID-19
- HPV (Human Papillomavirus)

### Travel Vaccines
- Yellow Fever
- Typhoid
- Cholera
- Rabies
- Meningococcal

---

## Testing Checklist

### Immunization Recording
- [ ] Record pediatric immunization
- [ ] Record adult immunization
- [ ] Record combination vaccine
- [ ] Select from inventory
- [ ] Check contraindications
- [ ] Record VIS given
- [ ] Record immediate reaction
- [ ] Record vaccine refusal

### Immunization History
- [ ] View patient immunization history
- [ ] Filter by vaccine type
- [ ] Check series completion
- [ ] Export immunization card
- [ ] Print history report

### Vaccine Forecasting
- [ ] Generate forecast for child
- [ ] Generate forecast for adult
- [ ] View due vaccines
- [ ] View overdue vaccines
- [ ] Generate catch-up schedule
- [ ] Check contraindications

### Inventory Management
- [ ] Add vaccine inventory
- [ ] Record vaccine administration (inventory deduction)
- [ ] Record vaccine wastage
- [ ] View expiring vaccines
- [ ] View low stock alerts
- [ ] Recall vaccine lot

### Registry Integration
- [ ] Submit immunization to registry
- [ ] Register patient with registry
- [ ] Query patient history from registry
- [ ] Request forecast from registry
- [ ] Batch submit immunizations
- [ ] Check submission status

### Adverse Events
- [ ] Record adverse event
- [ ] Link to immunization
- [ ] Document treatment
- [ ] Submit to VAERS
- [ ] Generate adverse event report

---

## ⚠️ **CRITICAL IMPLEMENTATION GUIDELINES**

### **Database Provisioning**
- ✅ **Create provisioning bundle**: `sprint22_immunization_registry`
- ✅ **Provisioning script**: `scripts/provision-sprint22-immunization.ts`
- ✅ **Seed vaccines**: Include CVX code mapping and standard vaccines
- ✅ **Seed schedules**: Zimbabwe pediatric and adult schedules

### **Compliance Requirements**
- ✅ **CVX code compliance**: Use official CDC CVX codes
- ✅ **VIS distribution**: Track VIS publication dates
- ✅ **Adverse event reporting**: VAERS submission capability
- ✅ **Registry reporting**: HL7 v2.5.1 VXU message format

### **Data Standards**
- ✅ **CVX codes**: CDC Clinical Vaccinations Code
- ✅ **MVX codes**: Vaccine manufacturer codes
- ✅ **CPT codes**: For billing
- ✅ **NDC codes**: National Drug Codes
- ✅ **ICD-10 codes**: For adverse events

---

## Estimated Effort: 2-3 weeks

### Week 1
- Database schema and vaccine catalog
- Core immunization recording
- Basic inventory management

### Week 2
- Forecast engine
- Registry integration (HL7 VXU)
- Adverse event tracking

### Week 3
- Frontend components
- Testing and validation
- Documentation

---

**Last Updated**: December 2, 2025  
**Priority**: CRITICAL ⭐⭐⭐  
**Status**: Ready for implementation

