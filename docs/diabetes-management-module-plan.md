# Diabetes Management Module - Comprehensive Research & Integration Plan

## Executive Summary

This document provides a comprehensive research-based plan for implementing a diabetes management module in MediCore EHR, aligned with WHO guidelines, clinical decision support (CDS) best practices, and integration with leading diabetes monitoring tools. It also includes a detailed review and improvement recommendations for the existing oncology module.

---

## Part 1: WHO & Clinical Decision Support Research

### 1.1 WHO Diabetes Management Guidelines (2024-2025)

#### Core Principles
1. **Individualized Care Plans**: Tailor treatment based on patient age, comorbidities, lifestyle, and preferences
2. **Holistic Approach**: Integrate lifestyle modifications, pharmacological interventions, and regular monitoring
3. **Patient-Centered Care**: Empower patients with education and self-management tools
4. **Prevention Focus**: Emphasize complication prevention through regular screening

#### Key WHO Recommendations

**For Type 2 Diabetes:**
- **HbA1c Targets**: 
  - General: <7% (53 mmol/mol)
  - Individualized: <6.5% for newly diagnosed, <8% for elderly/complex cases
- **Blood Pressure**: <130/80 mmHg for most patients
- **Lipid Management**: LDL-C <2.6 mmol/L (100 mg/dL), or <1.8 mmol/L for high-risk patients
- **Weight Management**: 5-10% weight loss for overweight/obese patients

**For Type 1 Diabetes:**
- **HbA1c Target**: <7% (53 mmol/mol) for most adults
- **Time in Range (TIR)**: >70% of readings between 70-180 mg/dL
- **Time Below Range**: <4% below 70 mg/dL
- **Time Above Range**: <25% above 180 mg/dL

**For Gestational Diabetes (2025 WHO Guidelines):**
- **Fasting Glucose**: <5.3 mmol/L (95 mg/dL)
- **1-hour Postprandial**: <7.8 mmol/L (140 mg/dL)
- **2-hour Postprandial**: <6.7 mmol/L (120 mg/dL)
- Specialized monitoring during pregnancy with multidisciplinary care

### 1.2 Clinical Decision Support (CDS) Requirements

#### Essential CDS Alerts & Reminders

1. **Overdue Screening Alerts**
   - Annual eye exam (retinopathy screening)
   - Annual foot exam (neuropathy screening)
   - Annual urine albumin-to-creatinine ratio (nephropathy screening)
   - Annual lipid profile
   - Annual comprehensive metabolic panel

2. **Abnormal Value Alerts**
   - HbA1c >8% (consider medication adjustment)
   - HbA1c >9% (urgent intervention needed)
   - Blood glucose <70 mg/dL (hypoglycemia alert)
   - Blood glucose >250 mg/dL (hyperglycemia alert)
   - Blood pressure >140/90 mmHg
   - eGFR <60 mL/min/1.73m² (CKD stage 3+)
   - Urine ACR >30 mg/g (microalbuminuria)

3. **Medication Management Alerts**
   - Drug-drug interactions (especially with metformin, sulfonylureas, insulin)
   - Renal function considerations (e.g., metformin contraindicated if eGFR <30)
   - Medication adherence tracking
   - Insulin dose adjustment recommendations

4. **Care Bundle Compliance**
   - **Diabetes Care Bundle** (WHO/ADA recommended):
     - HbA1c checked in last 6 months
     - Blood pressure checked in last 3 months
     - Lipid profile checked in last 12 months
     - Foot exam in last 12 months
     - Eye exam in last 12 months
     - Urine ACR checked in last 12 months
     - Diabetes education documented
     - Medication review completed

### 1.3 Essential Data to Capture

#### Patient Demographics & History
- **Demographics**: Age, gender, ethnicity, family history of diabetes
- **Diabetes Type**: Type 1, Type 2, Gestational, LADA, MODY, Secondary
- **Duration**: Years since diagnosis
- **Comorbidities**: Hypertension, dyslipidemia, cardiovascular disease, CKD, retinopathy, neuropathy, nephropathy
- **Family History**: First-degree relatives with diabetes, age at diagnosis

#### Clinical Assessments
- **Glycemic Control**:
  - HbA1c (target: every 3-6 months)
  - Fasting plasma glucose
  - Postprandial glucose
  - Random glucose
  - Time in Range (TIR) from CGM
  - Glucose variability metrics

- **Blood Pressure**: 
  - Systolic and diastolic
  - Orthostatic BP (if indicated)
  - Home BP monitoring data

- **Lipid Profile**:
  - Total cholesterol
  - LDL-C
  - HDL-C
  - Triglycerides
  - Non-HDL cholesterol

- **Renal Function**:
  - Serum creatinine
  - eGFR
  - Urine albumin-to-creatinine ratio (ACR)
  - Urine microalbumin

- **Body Composition**:
  - Weight
  - BMI
  - Waist circumference
  - Body fat percentage (if available)

#### Complication Screening
- **Retinopathy**:
  - Last eye exam date
  - Retinopathy grade (none, mild, moderate, severe, proliferative)
  - Diabetic macular edema (yes/no)
  - Treatment received (laser, injections, surgery)

- **Neuropathy**:
  - Last foot exam date
  - Monofilament test results
  - Vibration perception threshold
  - Ankle-brachial index (ABI)
  - Foot ulcer history
  - Amputation history

- **Nephropathy**:
  - Urine ACR results
  - eGFR trend
  - CKD stage
  - Dialysis status
  - Transplant status

- **Cardiovascular**:
  - ECG results
  - Stress test results
  - Cardiac catheterization results
  - History of MI, stroke, PAD

#### Medication Management
- **Current Medications**:
  - Oral hypoglycemic agents (metformin, sulfonylureas, DPP-4 inhibitors, SGLT2 inhibitors, GLP-1 agonists, etc.)
  - Insulin (type, regimen, doses)
  - Antihypertensive medications
  - Lipid-lowering medications
  - Antiplatelet therapy (aspirin, clopidogrel)

- **Medication History**:
  - Past medications and reasons for discontinuation
  - Adverse reactions
  - Medication adherence percentage
  - Insulin pump settings (if applicable)

#### Lifestyle Factors
- **Diet**:
  - Dietary patterns (Mediterranean, DASH, low-carb, etc.)
  - Carbohydrate counting proficiency
  - Meal timing
  - Alcohol consumption

- **Physical Activity**:
  - Exercise type and frequency
  - Exercise duration
  - Exercise intensity
  - Barriers to exercise

- **Smoking Status**: Current, former, never
- **Sleep**: Sleep duration, sleep quality, sleep apnea screening

#### Patient Education & Self-Management
- **Education Sessions**: Dates, topics covered, completion status
- **Self-Monitoring**: Blood glucose monitoring frequency, CGM usage
- **Self-Management Skills**: 
  - Hypoglycemia recognition and treatment
  - Hyperglycemia management
  - Sick day management
  - Foot care knowledge

---

## Part 2: Leading Diabetes Management & Monitoring Tools

### 2.1 Continuous Glucose Monitoring (CGM) Systems

#### Dexcom G7
- **Features**: Real-time glucose readings, predictive alerts, 10-day sensor life
- **Integration**: Dexcom Share API, Nightscout compatibility
- **Data Points**: Glucose values every 5 minutes, trends, alerts
- **EHR Integration**: REST API, FHIR R4 support

#### FreeStyle Libre 2/3 (Abbott)
- **Features**: Flash glucose monitoring, 14-day sensor life, optional alarms
- **Integration**: LibreView platform, API access
- **Data Points**: Glucose readings, trends, time in range
- **EHR Integration**: LibreView API, HL7 integration

#### Medtronic Guardian Connect
- **Features**: Real-time CGM, SmartGuard technology, predictive alerts
- **Integration**: CareLink platform
- **Data Points**: Continuous glucose data, trends, alerts
- **EHR Integration**: CareLink API

### 2.2 Insulin Delivery Systems

#### Insulin Pumps
- **Tandem t:slim X2**: Hybrid closed-loop system, Basal-IQ, Control-IQ
- **Omnipod 5**: Tubeless pump, automated insulin delivery
- **Medtronic MiniMed 780G**: Advanced hybrid closed-loop
- **Integration**: Pump data can be exported via manufacturer APIs

#### Smart Insulin Pens
- **InPen (Medtronic)**: Bluetooth-enabled pen, dose tracking
- **NovoPen 6/NovoPen Echo Plus**: Dose memory, connectivity
- **Integration**: Mobile apps with API access

### 2.3 Mobile Applications & Platforms

#### mySugr
- **Features**: Blood glucose logging, meal tracking, medication reminders, HbA1c estimation
- **Integration**: mySugr API, Apple HealthKit, Google Fit
- **EHR Integration**: FHIR-based data exchange

#### Glucose Buddy
- **Features**: Glucose tracking, carb counting, insulin logging, exercise tracking
- **Integration**: Apple HealthKit, Google Fit, Dexcom, FreeStyle Libre
- **EHR Integration**: HealthKit/Google Fit → EHR

#### Glooko
- **Features**: Unified platform aggregating data from 200+ devices
- **Integration**: Dexcom, FreeStyle Libre, insulin pumps, blood glucose meters
- **EHR Integration**: Glooko API, Epic MyChart integration, Cerner integration

#### OneDrop
- **Features**: Glucose tracking, AI-powered insights, coaching
- **Integration**: Apple HealthKit, Google Fit
- **EHR Integration**: Via HealthKit/Google Fit

### 2.4 Telemedicine Platforms

#### Teladoc Health
- **Features**: Virtual consultations with endocrinologists, remote monitoring
- **Integration**: EHR integration via API
- **Use Case**: Remote diabetes management, especially for rural patients

#### MDLIVE
- **Features**: Virtual endocrinology consultations
- **Integration**: EHR integration available
- **Use Case**: Access to specialists without travel

### 2.5 Analytics & Population Health Tools

#### Glytec
- **Features**: Insulin dosing algorithms, glycemic control analytics, population health dashboards
- **Integration**: EHR integration via API, Epic, Cerner, Allscripts
- **Use Case**: Hospital-based insulin management, population health

#### Dario Health
- **Features**: Digital therapeutics, behavioral coaching, medication adherence
- **Integration**: API for EHR integration
- **Use Case**: Patient engagement, self-management support

---

## Part 3: Diabetes Module Integration Plan

### 3.1 Database Schema Design

#### Core Tables

```sql
-- Diabetes Registry
CREATE TABLE diabetes_registry (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  diabetes_type VARCHAR(50) NOT NULL CHECK (diabetes_type IN ('type1', 'type2', 'gestational', 'lada', 'mody', 'secondary', 'prediabetes')),
  diabetes_type_snomed_code VARCHAR(50),
  diabetes_type_snomed_term TEXT,
  diagnosis_date DATE NOT NULL,
  age_at_diagnosis INTEGER,
  family_history BOOLEAN DEFAULT false,
  family_history_details TEXT,
  status VARCHAR(50) DEFAULT 'active' CHECK (status IN ('active', 'resolved', 'in_remission', 'deceased')),
  primary_care_provider_id UUID REFERENCES users(id),
  endocrinologist_id UUID REFERENCES users(id),
  diabetes_educator_id UUID REFERENCES users(id),
  care_plan TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(patient_id)
);

-- Diabetes Care Bundle Tracking
CREATE TABLE diabetes_care_bundle (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  diabetes_registry_id UUID NOT NULL REFERENCES diabetes_registry(id) ON DELETE CASCADE,
  bundle_date DATE NOT NULL,
  hba1c_checked BOOLEAN DEFAULT false,
  hba1c_value DECIMAL(5,2),
  hba1c_date DATE,
  blood_pressure_checked BOOLEAN DEFAULT false,
  systolic_bp INTEGER,
  diastolic_bp INTEGER,
  bp_date DATE,
  lipid_profile_checked BOOLEAN DEFAULT false,
  lipid_profile_date DATE,
  foot_exam_checked BOOLEAN DEFAULT false,
  foot_exam_date DATE,
  foot_exam_result TEXT,
  eye_exam_checked BOOLEAN DEFAULT false,
  eye_exam_date DATE,
  eye_exam_result TEXT,
  urine_acr_checked BOOLEAN DEFAULT false,
  urine_acr_value DECIMAL(10,2),
  urine_acr_date DATE,
  diabetes_education_documented BOOLEAN DEFAULT false,
  education_date DATE,
  medication_review_completed BOOLEAN DEFAULT false,
  medication_review_date DATE,
  bundle_completion_percentage INTEGER CHECK (bundle_completion_percentage >= 0 AND bundle_completion_percentage <= 100),
  reviewed_by UUID REFERENCES users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Glucose Monitoring Data
CREATE TABLE glucose_monitoring (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  diabetes_registry_id UUID NOT NULL REFERENCES diabetes_registry(id) ON DELETE CASCADE,
  patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  monitoring_type VARCHAR(50) NOT NULL CHECK (monitoring_type IN ('self_monitoring', 'cgm', 'flash', 'lab')),
  device_type VARCHAR(100),
  device_id VARCHAR(255),
  glucose_value DECIMAL(5,2) NOT NULL,
  glucose_unit VARCHAR(10) DEFAULT 'mg/dL' CHECK (glucose_unit IN ('mg/dL', 'mmol/L')),
  reading_type VARCHAR(50) CHECK (reading_type IN ('fasting', 'pre_meal', 'post_meal', 'random', 'bedtime', 'overnight')),
  meal_context TEXT,
  insulin_dose DECIMAL(8,2),
  insulin_type VARCHAR(100),
  carbohydrates_grams DECIMAL(6,2),
  exercise_minutes INTEGER,
  stress_level INTEGER CHECK (stress_level >= 1 AND stress_level <= 10),
  notes TEXT,
  recorded_at TIMESTAMP WITH TIME ZONE NOT NULL,
  recorded_by UUID REFERENCES users(id),
  device_synced_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- CGM Summary Data
CREATE TABLE cgm_summary (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  diabetes_registry_id UUID NOT NULL REFERENCES diabetes_registry(id) ON DELETE CASCADE,
  patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  summary_date DATE NOT NULL,
  time_in_range_70_180 DECIMAL(5,2),
  time_above_range_180 DECIMAL(5,2),
  time_below_range_70 DECIMAL(5,2),
  time_below_range_54 DECIMAL(5,2),
  average_glucose DECIMAL(5,2),
  glucose_variability DECIMAL(5,2),
  total_readings INTEGER,
  device_type VARCHAR(100),
  device_id VARCHAR(255),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(diabetes_registry_id, summary_date)
);

-- Diabetes Medications
CREATE TABLE diabetes_medications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  diabetes_registry_id UUID NOT NULL REFERENCES diabetes_registry(id) ON DELETE CASCADE,
  patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  medication_name VARCHAR(255) NOT NULL,
  medication_type VARCHAR(50) NOT NULL CHECK (medication_type IN ('oral', 'injectable', 'insulin', 'combination')),
  medication_category VARCHAR(100) CHECK (medication_category IN ('metformin', 'sulfonylurea', 'dpp4_inhibitor', 'sglt2_inhibitor', 'glp1_agonist', 'insulin_basal', 'insulin_bolus', 'insulin_premixed', 'thiazolidinedione', 'alpha_glucosidase_inhibitor', 'meglitinide', 'other')),
  medication_snomed_code VARCHAR(50),
  medication_snomed_term TEXT,
  dosage VARCHAR(100) NOT NULL,
  frequency VARCHAR(100) NOT NULL,
  route VARCHAR(50) CHECK (route IN ('oral', 'subcutaneous', 'intramuscular', 'intravenous')),
  start_date DATE NOT NULL,
  end_date DATE,
  status VARCHAR(50) DEFAULT 'active' CHECK (status IN ('active', 'discontinued', 'on_hold', 'completed')),
  reason_for_discontinuation TEXT,
  adherence_percentage INTEGER CHECK (adherence_percentage >= 0 AND adherence_percentage <= 100),
  prescribed_by UUID REFERENCES users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Insulin Regimens
CREATE TABLE insulin_regimens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  diabetes_registry_id UUID NOT NULL REFERENCES diabetes_registry(id) ON DELETE CASCADE,
  patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  regimen_type VARCHAR(50) NOT NULL CHECK (regimen_type IN ('basal_only', 'basal_bolus', 'premixed', 'pump', 'other')),
  basal_insulin_type VARCHAR(100),
  basal_dose DECIMAL(8,2),
  basal_frequency VARCHAR(100),
  bolus_insulin_type VARCHAR(100),
  bolus_ratio DECIMAL(5,2),
  correction_factor DECIMAL(5,2),
  target_glucose DECIMAL(5,2),
  carb_ratio DECIMAL(5,2),
  pump_settings JSONB,
  start_date DATE NOT NULL,
  end_date DATE,
  status VARCHAR(50) DEFAULT 'active' CHECK (status IN ('active', 'discontinued', 'on_hold')),
  notes TEXT,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Complication Screening
CREATE TABLE diabetes_complication_screening (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  diabetes_registry_id UUID NOT NULL REFERENCES diabetes_registry(id) ON DELETE CASCADE,
  patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  screening_type VARCHAR(50) NOT NULL CHECK (screening_type IN ('retinopathy', 'neuropathy', 'nephropathy', 'cardiovascular', 'foot_ulcer')),
  screening_date DATE NOT NULL,
  screening_result TEXT,
  screening_result_snomed_code VARCHAR(50),
  screening_result_snomed_term TEXT,
  severity_grade VARCHAR(50),
  findings TEXT,
  treatment_recommended BOOLEAN DEFAULT false,
  treatment_plan TEXT,
  next_screening_due_date DATE,
  performed_by UUID REFERENCES users(id),
  reviewed_by UUID REFERENCES users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Diabetes Education Sessions
CREATE TABLE diabetes_education_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  diabetes_registry_id UUID NOT NULL REFERENCES diabetes_registry(id) ON DELETE CASCADE,
  patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  session_date DATE NOT NULL,
  session_type VARCHAR(50) CHECK (session_type IN ('individual', 'group', 'online', 'phone')),
  topics_covered TEXT[],
  educator_id UUID REFERENCES users(id),
  patient_attendance BOOLEAN DEFAULT true,
  completion_status VARCHAR(50) DEFAULT 'completed' CHECK (completion_status IN ('completed', 'partial', 'missed', 'rescheduled')),
  assessment_score INTEGER CHECK (assessment_score >= 0 AND assessment_score <= 100),
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Diabetes Alerts & Reminders
CREATE TABLE diabetes_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  diabetes_registry_id UUID NOT NULL REFERENCES diabetes_registry(id) ON DELETE CASCADE,
  patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  alert_type VARCHAR(50) NOT NULL CHECK (alert_type IN ('overdue_screening', 'abnormal_value', 'medication_adherence', 'hypoglycemia', 'hyperglycemia', 'care_bundle_incomplete')),
  alert_severity VARCHAR(50) NOT NULL CHECK (alert_severity IN ('low', 'medium', 'high', 'critical')),
  alert_message TEXT NOT NULL,
  related_metric VARCHAR(100),
  related_value DECIMAL(10,2),
  related_date DATE,
  acknowledged BOOLEAN DEFAULT false,
  acknowledged_by UUID REFERENCES users(id),
  acknowledged_at TIMESTAMP WITH TIME ZONE,
  resolved BOOLEAN DEFAULT false,
  resolved_by UUID REFERENCES users(id),
  resolved_at TIMESTAMP WITH TIME ZONE,
  resolution_notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Device Integration Log
CREATE TABLE diabetes_device_integration (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  diabetes_registry_id UUID NOT NULL REFERENCES diabetes_registry(id) ON DELETE CASCADE,
  patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  device_type VARCHAR(100) NOT NULL CHECK (device_type IN ('cgm', 'insulin_pump', 'glucose_meter', 'smart_pen', 'fitness_tracker')),
  device_brand VARCHAR(100),
  device_model VARCHAR(100),
  device_serial_number VARCHAR(255),
  device_id VARCHAR(255),
  integration_type VARCHAR(50) CHECK (integration_type IN ('api', 'hl7', 'fhir', 'manual', 'healthkit', 'google_fit')),
  integration_status VARCHAR(50) DEFAULT 'active' CHECK (integration_status IN ('active', 'inactive', 'error', 'pending')),
  last_sync_at TIMESTAMP WITH TIME ZONE,
  sync_frequency VARCHAR(50),
  api_credentials_encrypted TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

### 3.2 API Integration Points

#### CGM Integration
1. **Dexcom Share API**
   - Endpoint: `https://share2.dexcom.com/ShareWebServices/Services/`
   - Authentication: Username/password or OAuth
   - Data: Real-time glucose values, trends, alerts
   - Frequency: Every 5 minutes

2. **FreeStyle LibreView API**
   - Endpoint: `https://api.libreview.io/`
   - Authentication: OAuth 2.0
   - Data: Flash glucose readings, trends, time in range
   - Frequency: On-demand or scheduled sync

3. **Glooko API**
   - Endpoint: `https://api.glooko.com/`
   - Authentication: OAuth 2.0
   - Data: Aggregated data from multiple devices
   - Frequency: Real-time or batch sync

#### Insulin Pump Integration
1. **Tandem t:connect API**
   - Data: Insulin delivery, pump settings, CGM data
   - Integration: Via t:connect platform

2. **Omnipod DASH API**
   - Data: Insulin delivery, pod status
   - Integration: Via Omnipod platform

#### Mobile App Integration
1. **Apple HealthKit**
   - Data: Glucose readings, insulin doses, medications, exercise
   - Integration: Native iOS HealthKit framework

2. **Google Fit**
   - Data: Glucose readings, insulin doses, medications, exercise
   - Integration: Google Fit API

3. **mySugr API**
   - Endpoint: `https://api.mysugr.com/`
   - Authentication: OAuth 2.0
   - Data: Glucose logs, meals, medications, HbA1c estimates

### 3.3 Clinical Decision Support Rules

#### Alert Rules (CDS)

```typescript
// Example CDS Rules (pseudo-code)

// Overdue Screening Alert
if (daysSinceLastEyeExam > 365) {
  createAlert({
    type: 'overdue_screening',
    severity: 'medium',
    message: 'Annual eye exam overdue. Schedule retinopathy screening.',
    diabetes_registry_id: registry.id
  });
}

// Abnormal HbA1c Alert
if (latestHbA1c > 9.0) {
  createAlert({
    type: 'abnormal_value',
    severity: 'high',
    message: `HbA1c is ${latestHbA1c}%. Consider medication adjustment or intensification.`,
    related_metric: 'hba1c',
    related_value: latestHbA1c
  });
}

// Hypoglycemia Alert
if (latestGlucose < 70) {
  createAlert({
    type: 'hypoglycemia',
    severity: 'critical',
    message: `Blood glucose is ${latestGlucose} mg/dL. Patient may need immediate treatment.`,
    related_metric: 'glucose',
    related_value: latestGlucose
  });
}

// Care Bundle Incomplete Alert
if (careBundleCompletion < 80) {
  createAlert({
    type: 'care_bundle_incomplete',
    severity: 'medium',
    message: `Diabetes care bundle is only ${careBundleCompletion}% complete. Review missing components.`,
    related_metric: 'care_bundle_completion',
    related_value: careBundleCompletion
  });
}

// Medication Adherence Alert
if (medicationAdherence < 80) {
  createAlert({
    type: 'medication_adherence',
    severity: 'medium',
    message: `Medication adherence is ${medicationAdherence}%. Review barriers to adherence.`,
    related_metric: 'adherence',
    related_value: medicationAdherence
  });
}
```

### 3.4 Frontend Components

#### Diabetes Dashboard
- **Overview Cards**: 
  - Latest HbA1c with trend
  - Time in Range (if CGM available)
  - Care Bundle Completion %
  - Active Alerts Count
  - Next Screening Due

- **Glucose Trends Chart**: 
  - Line chart showing glucose over time
  - Color-coded zones (hypo, target, hyper)
  - Meal markers
  - Insulin dose markers

- **Care Bundle Checklist**: 
  - Visual checklist of required screenings
  - Due dates and completion status
  - Quick action buttons to schedule/record

- **Medication List**: 
  - Current diabetes medications
  - Doses and frequencies
  - Adherence tracking
  - Quick add/edit

- **Recent Glucose Readings**: 
  - Table of recent SMBG or CGM readings
  - Filter by date range
  - Export functionality

#### Glucose Monitoring Interface
- **Manual Entry Form**: 
  - Glucose value
  - Reading type (fasting, pre-meal, post-meal, etc.)
  - Meal context
  - Insulin dose (if applicable)
  - Notes

- **CGM Integration Status**: 
  - Connected device info
  - Last sync time
  - Sync button
  - Device settings

- **Glucose Log View**: 
  - Calendar view
  - List view
  - Chart view
  - Export to PDF/CSV

#### Care Bundle Interface
- **Checklist View**: 
  - Each bundle component with status
  - Due dates
  - Last completed date
  - Quick record buttons

- **Detail View**: 
  - Full details of each screening
  - Results and findings
  - Treatment recommendations
  - Next due date

#### Alerts & Reminders Panel
- **Active Alerts**: 
  - Sorted by severity
  - Acknowledge/resolve actions
  - Filter by type

- **Upcoming Reminders**: 
  - Screening due dates
  - Medication refills
  - Follow-up appointments

### 3.5 Integration with Existing EHR Modules

#### Vitals Integration
- Link glucose readings from `vitals` table to diabetes registry
- Auto-populate diabetes dashboard with latest vitals
- Alert on abnormal glucose values in vitals

#### Lab Results Integration
- Link HbA1c, lipid profile, urine ACR from `lab_results` table
- Auto-populate care bundle when lab results are available
- Alert on abnormal lab values

#### Prescriptions Integration
- Link diabetes medications from `prescriptions` table
- Track medication adherence
- Alert on medication interactions

#### Appointments Integration
- Schedule diabetes-related appointments (eye exam, foot exam, etc.)
- Link appointments to care bundle components
- Remind patients of upcoming screenings

#### Medical Records Integration
- Link complication screening results to medical records
- Store diabetes education materials
- Document patient education sessions

---

## Part 4: Oncology Module Review & Improvements

### 4.1 Current Oncology Module Strengths

1. **Comprehensive Case Management**: 
   - Primary diagnosis with SNOMED CT coding
   - Staging system support (TNM, AJCC)
   - Case status tracking

2. **Regimen Management**: 
   - Multiple regimens per case
   - Line of therapy tracking
   - Regimen details (JSONB for flexibility)

3. **Infusion Session Tracking**: 
   - Cycle number tracking
   - Vitals and toxicities
   - Payment integration

4. **Adverse Event Management**: 
   - CTCAE grade tracking
   - SNOMED CT coding for events
   - Resolution tracking

5. **Tumor Board Integration**: 
   - Meeting management
   - Recommendations tracking
   - Follow-up actions

6. **Dashboard Analytics**: 
   - Case totals and status breakdown
   - Upcoming infusions
   - SNOMED-coded diagnosis/regimen distribution

### 4.2 Identified Gaps & Improvements Needed

#### 4.2.1 Missing Critical Features

1. **Imaging Integration**
   - **Current**: No direct link to imaging studies
   - **Needed**: 
     - Link imaging orders/results to oncology cases
     - Store imaging findings (tumor size, response assessment)
     - RECIST criteria tracking
     - Imaging timeline view

2. **Pathology Integration**
   - **Current**: Histology stored as text only
   - **Needed**:
     - Link pathology reports to cases
     - Store biomarker results (ER, PR, HER2, PD-L1, MSI, etc.)
     - Genetic testing results (BRCA, Lynch syndrome, etc.)
     - Tumor mutational burden (TMB)
     - Microsatellite instability (MSI) status

3. **Treatment Response Assessment**
   - **Current**: No structured response tracking
   - **Needed**:
     - RECIST 1.1 criteria implementation
     - Response categories (CR, PR, SD, PD)
     - Best overall response tracking
     - Progression-free survival (PFS) calculation
     - Overall survival (OS) tracking

4. **Survivorship Care Plans**
   - **Current**: No survivorship module
   - **Needed**:
     - Post-treatment follow-up schedules
     - Surveillance imaging schedules
     - Long-term side effect monitoring
     - Quality of life assessments
     - Recurrence risk stratification

5. **Clinical Trials Integration**
   - **Current**: No trial tracking
   - **Needed**:
     - Trial enrollment status
     - Protocol compliance tracking
     - Adverse event reporting (CTCAE)
     - Data collection for trial endpoints

6. **Genomic/Precision Medicine**
   - **Current**: No genomic data storage
   - **Needed**:
     - Genetic mutation database
     - Targeted therapy matching
     - Pharmacogenomics data
     - Liquid biopsy results

7. **Patient-Reported Outcomes (PROs)**
   - **Current**: No PRO tracking
   - **Needed**:
     - Quality of life questionnaires (EORTC QLQ-C30, FACT-G)
     - Symptom tracking
     - Functional status assessments
     - Patient satisfaction surveys

8. **Financial Toxicity Tracking**
   - **Current**: Basic payment tracking
   - **Needed**:
     - Cost of care tracking
     - Insurance coverage details
     - Financial assistance programs
     - Out-of-pocket cost estimates

#### 4.2.2 Data Model Enhancements

```sql
-- Imaging Findings for Oncology
CREATE TABLE oncology_imaging_findings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  oncology_case_id UUID NOT NULL REFERENCES oncology_cases(id) ON DELETE CASCADE,
  imaging_study_id UUID REFERENCES imaging_studies(id),
  imaging_date DATE NOT NULL,
  imaging_type VARCHAR(100) NOT NULL,
  modality VARCHAR(50),
  findings TEXT,
  tumor_size_cm DECIMAL(5,2),
  tumor_location TEXT,
  lymph_nodes_involved INTEGER,
  metastatic_sites TEXT[],
  recist_response VARCHAR(50) CHECK (recist_response IN ('CR', 'PR', 'SD', 'PD', 'NE')),
  recist_criteria_met BOOLEAN,
  radiologist_id UUID REFERENCES users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Pathology & Biomarkers
CREATE TABLE oncology_pathology (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  oncology_case_id UUID NOT NULL REFERENCES oncology_cases(id) ON DELETE CASCADE,
  pathology_report_id UUID,
  specimen_date DATE NOT NULL,
  specimen_type VARCHAR(100),
  histology_type VARCHAR(255),
  histology_snomed_code VARCHAR(50),
  histology_snomed_term TEXT,
  grade VARCHAR(50),
  stage_t VARCHAR(10),
  stage_n VARCHAR(10),
  stage_m VARCHAR(10),
  biomarkers JSONB DEFAULT '{}'::jsonb, -- ER, PR, HER2, PD-L1, MSI, TMB, etc.
  genetic_testing JSONB DEFAULT '{}'::jsonb, -- BRCA, Lynch, etc.
  notes TEXT,
  pathologist_id UUID REFERENCES users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Treatment Response Assessment
CREATE TABLE oncology_response_assessment (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  oncology_case_id UUID NOT NULL REFERENCES oncology_cases(id) ON DELETE CASCADE,
  regimen_id UUID REFERENCES oncology_regimens(id),
  assessment_date DATE NOT NULL,
  assessment_type VARCHAR(50) CHECK (assessment_type IN ('baseline', 'interim', 'end_of_treatment', 'follow_up')),
  recist_response VARCHAR(50) CHECK (recist_response IN ('CR', 'PR', 'SD', 'PD', 'NE')),
  best_overall_response VARCHAR(50),
  target_lesions_count INTEGER,
  target_lesions_size_cm DECIMAL(5,2),
  non_target_lesions_status VARCHAR(50),
  new_lesions BOOLEAN,
  assessed_by UUID REFERENCES users(id),
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Survivorship Care Plans
CREATE TABLE oncology_survivorship_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  oncology_case_id UUID NOT NULL REFERENCES oncology_cases(id) ON DELETE CASCADE,
  treatment_completion_date DATE,
  follow_up_schedule JSONB DEFAULT '{}'::jsonb,
  surveillance_imaging_schedule JSONB DEFAULT '{}'::jsonb,
  long_term_side_effects TEXT[],
  recurrence_risk VARCHAR(50),
  lifestyle_recommendations TEXT,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Clinical Trials
CREATE TABLE oncology_clinical_trials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  oncology_case_id UUID NOT NULL REFERENCES oncology_cases(id) ON DELETE CASCADE,
  trial_name VARCHAR(255) NOT NULL,
  trial_id VARCHAR(100),
  trial_phase VARCHAR(50),
  enrollment_date DATE,
  enrollment_status VARCHAR(50) CHECK (enrollment_status IN ('screening', 'enrolled', 'on_treatment', 'completed', 'withdrawn')),
  protocol_compliance_percentage INTEGER,
  trial_endpoints JSONB DEFAULT '{}'::jsonb,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Patient-Reported Outcomes
CREATE TABLE oncology_patient_reported_outcomes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  oncology_case_id UUID NOT NULL REFERENCES oncology_cases(id) ON DELETE CASCADE,
  assessment_date DATE NOT NULL,
  assessment_type VARCHAR(100) CHECK (assessment_type IN ('EORTC_QLQ_C30', 'FACT_G', 'symptom_tracking', 'functional_status', 'satisfaction')),
  assessment_data JSONB NOT NULL,
  total_score DECIMAL(6,2),
  domain_scores JSONB,
  completed_by_patient BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

#### 4.2.3 UI/UX Improvements

1. **Timeline View**
   - Visual timeline showing diagnosis → staging → treatment → response → follow-up
   - Interactive milestones
   - Filter by event type

2. **Response Charts**
   - Tumor size over time
   - RECIST response visualization
   - PFS/OS Kaplan-Meier curves (if multiple patients)

3. **Biomarker Dashboard**
   - Visual representation of biomarker status
   - Targeted therapy matching
   - Treatment recommendations based on biomarkers

4. **Survivorship Dashboard**
   - Follow-up schedule calendar
   - Surveillance reminders
   - Long-term side effect tracking

5. **Financial Dashboard**
   - Cost of care breakdown
   - Insurance coverage visualization
   - Financial assistance tracking

#### 4.2.4 CDS Enhancements

1. **Treatment Recommendations**
   - NCCN guideline-based recommendations
   - Biomarker-driven therapy suggestions
   - Drug interaction alerts

2. **Response Monitoring**
   - Alert on lack of response (SD/PD)
   - Suggest alternative regimens
   - Alert on progression

3. **Surveillance Reminders**
   - Follow-up appointment reminders
   - Imaging due dates
   - Lab test due dates

4. **Toxicity Management**
   - Alert on high-grade toxicities
   - Suggest dose modifications
   - Recommend supportive care

---

## Part 5: Implementation Roadmap

### Phase 1: Diabetes Module Foundation (Weeks 1-4)
- [ ] Database schema creation
- [ ] Basic CRUD APIs for diabetes registry
- [ ] Manual glucose entry interface
- [ ] Basic care bundle tracking
- [ ] Simple alerts (overdue screenings)

### Phase 2: CGM Integration (Weeks 5-8)
- [ ] Dexcom Share API integration
- [ ] FreeStyle Libre integration
- [ ] Glooko integration (optional)
- [ ] CGM data visualization
- [ ] Time in Range calculations

### Phase 3: Advanced Features (Weeks 9-12)
- [ ] Insulin regimen management
- [ ] Medication adherence tracking
- [ ] Advanced CDS rules
- [ ] Care bundle completion tracking
- [ ] Patient education module

### Phase 4: Oncology Enhancements (Weeks 13-16)
- [ ] Imaging findings integration
- [ ] Pathology & biomarkers module
- [ ] Treatment response assessment
- [ ] RECIST criteria implementation
- [ ] Survivorship care plans

### Phase 5: Advanced Oncology Features (Weeks 17-20)
- [ ] Clinical trials integration
- [ ] Patient-reported outcomes
- [ ] Genomic data storage
- [ ] Financial toxicity tracking
- [ ] Advanced analytics dashboards

---

## Part 6: Success Metrics

### Diabetes Module
- **Care Bundle Completion Rate**: Target >80%
- **HbA1c Control Rate**: Target >70% of patients with HbA1c <8%
- **Screening Compliance**: Target >90% annual screening completion
- **CGM Adoption**: Track % of patients with CGM integration
- **Alert Response Time**: Average time to acknowledge/resolve alerts

### Oncology Module
- **Response Assessment Completion**: Target >90% of regimens with response assessments
- **Biomarker Documentation**: Target >95% of cases with biomarker data
- **Survivorship Plan Creation**: Target >80% of completed treatments
- **Trial Enrollment Tracking**: Track % of eligible patients enrolled
- **PRO Completion Rate**: Target >70% of patients completing PROs

---

## Conclusion

This comprehensive plan provides a roadmap for implementing a world-class diabetes management module and enhancing the existing oncology module. The diabetes module will integrate with leading monitoring tools, provide clinical decision support aligned with WHO guidelines, and enable comprehensive care bundle tracking. The oncology enhancements will add critical features for precision medicine, treatment response assessment, and survivorship care.

Both modules will leverage SNOMED CT coding for interoperability, integrate with existing EHR components, and provide actionable insights through clinical decision support systems.



