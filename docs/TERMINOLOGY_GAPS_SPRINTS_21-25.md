# Terminology Coding Gaps: Sprints 21-25

**Date**: December 3, 2025  
**Status**: Analysis Complete - Enhancements Needed

---

## 🎯 **OVERVIEW**

During database provisioning for Sprints 21-25, several fields were created with TEXT data types that should be properly coded using:
- **SNOMED CT**: Clinical findings, procedures, body structures
- **ICD-10**: Diagnoses, conditions, causes of death
- **CVX**: Vaccine codes (already used ✅)
- **LOINC**: Lab tests and observations
- **CPT**: Procedures for billing

---

## ⚠️ **TERMINOLOGY GAPS IDENTIFIED**

### **SPRINT 21: E-CONSENT MANAGEMENT**

#### **Fields Needing Coding**:

**Table**: `consent_templates`
- ✅ `procedure_codes` JSONB - Generic field (needs structure)
  - **Should add**: CPT codes, SNOMED procedure codes
  - **Example**: `{"cpt": ["99213"], "snomed": ["387713003"]}`

**Table**: `patient_consents`
- ⚠️ `procedure_id` UUID - References undefined table
  - **Should add**: Link to procedures table with SNOMED codes
  - **Fix**: Create procedures table or link to existing

**Recommendation**: 
```sql
-- Add to consent_templates
ALTER TABLE consent_templates 
ADD COLUMN procedure_snomed_codes JSONB DEFAULT '[]'::jsonb,
ADD COLUMN procedure_cpt_codes JSONB DEFAULT '[]'::jsonb;

-- Add to patient_consents
ALTER TABLE patient_consents
ADD COLUMN procedure_snomed_code VARCHAR(20),
ADD COLUMN procedure_snomed_term TEXT,
ADD COLUMN procedure_cpt_code VARCHAR(10);
```

---

### **SPRINT 22: IMMUNIZATION REGISTRY**

#### **Current State**: ✅ **GOOD!**

**Table**: `immunizations`
- ✅ `vaccine_code` VARCHAR(20) - Using CVX codes (correct)
- ✅ CVX codes are the standard for vaccines

**Table**: `immunization_schedules`
- ✅ `vaccine_code` VARCHAR(20) - Using CVX codes (correct)

#### **Gaps Identified**:

**Table**: `vaccine_adverse_events`
- ⚠️ `event_type` VARCHAR(100) - Free text
  - **Should add**: SNOMED CT codes for adverse reactions
  - **Example**: Anaphylaxis (SNOMED: 39579001)

**Table**: `immunization_schedules`
- ⚠️ `contraindications` JSONB - Free text array
  - **Should add**: SNOMED CT codes for conditions
  - **Example**: Immunodeficiency (SNOMED: 234532001)

**Recommendation**:
```sql
-- Add to vaccine_adverse_events
ALTER TABLE vaccine_adverse_events
ADD COLUMN event_snomed_code VARCHAR(20),
ADD COLUMN event_snomed_term TEXT;

-- Restructure immunization_schedules.contraindications
-- From: ["severe allergy", "immunodeficiency"]
-- To: [
--   {"snomed_code": "420134006", "term": "Anaphylaxis"},
--   {"snomed_code": "234532001", "term": "Immunodeficiency"}
-- ]
```

---

### **SPRINT 23: BED MANAGEMENT & ADT**

#### **Critical Gaps** ⚠️⚠️:

**Table**: `admissions`
- ⚠️ `admitting_diagnosis` TEXT - **MUST have ICD-10**
  - **Should add**: ICD-10 code + SNOMED code
  - **Example**: "Acute MI" → ICD-10: I21.9, SNOMED: 57054005

- ⚠️ `admission_reason` TEXT - Free text
  - **Should add**: SNOMED CT reason codes

**Table**: `discharges`
- ⚠️ `discharge_diagnosis` TEXT - **MUST have ICD-10**
  - **Should add**: ICD-10 code + SNOMED code
  - **Critical for**: Billing, DRG assignment, reporting

- ⚠️ `discharge_condition` VARCHAR(100) - Free text
  - **Should add**: SNOMED CT codes for patient condition

**Table**: `patient_transfers`
- ⚠️ `transfer_reason` TEXT - Free text
  - **Should add**: SNOMED CT reason codes
  - **Example**: "Clinical deterioration" → SNOMED code

**Recommendation**:
```sql
-- Add to admissions table
ALTER TABLE admissions
ADD COLUMN admitting_diagnosis_icd10 VARCHAR(10),
ADD COLUMN admitting_diagnosis_snomed VARCHAR(20),
ADD COLUMN admitting_diagnosis_term TEXT,
ADD COLUMN secondary_diagnoses JSONB DEFAULT '[]'::jsonb;
-- Structure: [{"icd10": "I21.9", "snomed": "57054005", "term": "Acute MI"}]

-- Add to discharges table
ALTER TABLE discharges
ADD COLUMN discharge_diagnosis_icd10 VARCHAR(10),
ADD COLUMN discharge_diagnosis_snomed VARCHAR(20),
ADD COLUMN discharge_diagnosis_term TEXT,
ADD COLUMN secondary_diagnoses JSONB DEFAULT '[]'::jsonb,
ADD COLUMN drg_code VARCHAR(10), -- Diagnosis Related Group
ADD COLUMN drg_description TEXT;

-- Add to patient_transfers
ALTER TABLE patient_transfers
ADD COLUMN transfer_reason_snomed VARCHAR(20),
ADD COLUMN transfer_reason_term TEXT;
```

---

### **SPRINT 24: EMERGENCY DEPARTMENT MODULE**

#### **Critical Gaps** ⚠️⚠️⚠️:

**Table**: `ed_visits`
- ⚠️ `chief_complaint` TEXT - **SHOULD have SNOMED**
  - **Should add**: SNOMED CT codes for complaints
  - **Example**: "Chest pain" → SNOMED: 29857009

- ⚠️ `presenting_symptoms` TEXT - Free text
  - **Should add**: SNOMED CT symptom codes

- ⚠️ `discharge_diagnosis` TEXT - **MUST have ICD-10**
  - **Should add**: ICD-10 + SNOMED codes

**Table**: `ed_triage_assessments`
- ⚠️ `presenting_complaint` TEXT - Free text
  - **Should add**: SNOMED CT codes
  - **Critical for**: ESI decision support, trending

**Table**: `ed_dispositions`
- ⚠️ `discharge_diagnosis` TEXT - **MUST have ICD-10**
  - **Should add**: ICD-10 codes for billing and reporting

**Recommendation**:
```sql
-- Add to ed_visits table
ALTER TABLE ed_visits
ADD COLUMN chief_complaint_snomed VARCHAR(20),
ADD COLUMN chief_complaint_term TEXT,
ADD COLUMN presenting_symptoms_coded JSONB DEFAULT '[]'::jsonb,
ADD COLUMN discharge_diagnosis_icd10 VARCHAR(10),
ADD COLUMN discharge_diagnosis_snomed VARCHAR(20),
ADD COLUMN discharge_diagnosis_term TEXT,
ADD COLUMN secondary_diagnoses JSONB DEFAULT '[]'::jsonb;

-- Add to ed_triage_assessments
ALTER TABLE ed_triage_assessments
ADD COLUMN presenting_complaint_snomed VARCHAR(20),
ADD COLUMN presenting_complaint_term TEXT,
ADD COLUMN symptoms_coded JSONB DEFAULT '[]'::jsonb;

-- Add to ed_dispositions
ALTER TABLE ed_dispositions
ADD COLUMN discharge_diagnosis_icd10 VARCHAR(10),
ADD COLUMN discharge_diagnosis_snomed VARCHAR(20),
ADD COLUMN discharge_diagnosis_term TEXT,
ADD COLUMN secondary_diagnoses JSONB DEFAULT '[]'::jsonb;
```

---

### **SPRINT 25: CLINICAL PATHWAYS**

#### **Critical Gaps** ⚠️⚠️:

**Table**: `clinical_pathways`
- ✅ `condition_codes` JSONB - Has ICD-10 codes (good!)
- ⚠️ BUT: Should also add SNOMED codes for conditions
  - **Example**: CHF → ICD-10: I50.0, SNOMED: 42343007

**Table**: `pathway_steps`
- ⚠️ `step_type` - Generic categories
  - **Should add**: SNOMED procedure/intervention codes
  - **Example**: "Medication" step → SNOMED drug codes

- ⚠️ `order_sets` JSONB - Generic
  - **Should include**: SNOMED/LOINC codes for orders

**Table**: `pathway_outcomes`
- ⚠️ `outcome_measure` VARCHAR(255) - Free text
  - **Should add**: LOINC codes for measurements
  - **Example**: "Blood pressure" → LOINC: 85354-9

**Recommendation**:
```sql
-- Add to clinical_pathways
ALTER TABLE clinical_pathways
ADD COLUMN condition_snomed_codes JSONB DEFAULT '[]'::jsonb;
-- Structure: [{"snomed": "42343007", "term": "Heart failure"}]

-- Add to pathway_steps
ALTER TABLE pathway_steps
ADD COLUMN procedure_snomed_code VARCHAR(20),
ADD COLUMN procedure_snomed_term TEXT,
ADD COLUMN medication_rxnorm_codes JSONB DEFAULT '[]'::jsonb,
ADD COLUMN lab_loinc_codes JSONB DEFAULT '[]'::jsonb;

-- Add to pathway_outcomes
ALTER TABLE pathway_outcomes
ADD COLUMN outcome_loinc_code VARCHAR(20),
ADD COLUMN outcome_loinc_term TEXT,
ADD COLUMN outcome_snomed_code VARCHAR(20);
```

---

## 📊 **SUMMARY OF GAPS**

### **By Priority**:

#### **🔴 CRITICAL (Must Have)**:
1. **Admissions**: ICD-10 for admitting diagnosis
2. **Discharges**: ICD-10 for discharge diagnosis + DRG
3. **ED Visits**: ICD-10 for discharge diagnosis
4. **ED Dispositions**: ICD-10 for billing/reporting

#### **🟡 HIGH (Should Have)**:
1. **ED Visits**: SNOMED for chief complaints
2. **ED Triage**: SNOMED for presenting complaints
3. **Adverse Events**: SNOMED for event types
4. **Pathway Outcomes**: LOINC for measurements

#### **🟢 MEDIUM (Nice to Have)**:
1. **Consent Templates**: CPT/SNOMED for procedures
2. **Pathway Steps**: SNOMED for interventions
3. **Transfer Reasons**: SNOMED coding
4. **Immunization Contraindications**: SNOMED coding

---

## 🔧 **RECOMMENDED ENHANCEMENTS**

### **Migration 008: Add Terminology Coding**

Create comprehensive migration to add SNOMED/ICD-10 fields to all relevant tables:

```sql
-- Sprint 23 enhancements
ALTER TABLE admissions
ADD COLUMN admitting_diagnosis_icd10 VARCHAR(10),
ADD COLUMN admitting_diagnosis_snomed VARCHAR(20),
ADD COLUMN admitting_diagnosis_term TEXT,
ADD COLUMN secondary_diagnoses JSONB DEFAULT '[]'::jsonb,
ADD COLUMN comorbidities_coded JSONB DEFAULT '[]'::jsonb;

ALTER TABLE discharges
ADD COLUMN discharge_diagnosis_icd10 VARCHAR(10),
ADD COLUMN discharge_diagnosis_snomed VARCHAR(20),
ADD COLUMN discharge_diagnosis_term TEXT,
ADD COLUMN secondary_diagnoses JSONB DEFAULT '[]'::jsonb,
ADD COLUMN drg_code VARCHAR(10),
ADD COLUMN drg_description TEXT,
ADD COLUMN drg_weight DECIMAL(5,2);

-- Sprint 24 enhancements
ALTER TABLE ed_visits
ADD COLUMN chief_complaint_snomed VARCHAR(20),
ADD COLUMN chief_complaint_term TEXT,
ADD COLUMN presenting_symptoms_coded JSONB DEFAULT '[]'::jsonb,
ADD COLUMN discharge_diagnosis_icd10 VARCHAR(10),
ADD COLUMN discharge_diagnosis_snomed VARCHAR(20),
ADD COLUMN discharge_diagnosis_term TEXT;

ALTER TABLE ed_triage_assessments
ADD COLUMN presenting_complaint_snomed VARCHAR(20),
ADD COLUMN presenting_complaint_term TEXT,
ADD COLUMN symptoms_snomed_codes JSONB DEFAULT '[]'::jsonb;

ALTER TABLE ed_dispositions
ADD COLUMN discharge_diagnosis_icd10 VARCHAR(10),
ADD COLUMN discharge_diagnosis_snomed VARCHAR(20),
ADD COLUMN discharge_diagnosis_term TEXT,
ADD COLUMN procedures_performed JSONB DEFAULT '[]'::jsonb;
-- Structure: [{"cpt": "99285", "snomed": "...", "description": "ED visit level 5"}]

-- Sprint 25 enhancements
ALTER TABLE clinical_pathways
ADD COLUMN condition_snomed_codes JSONB DEFAULT '[]'::jsonb,
ADD COLUMN target_diagnoses_icd10 JSONB DEFAULT '[]'::jsonb;

ALTER TABLE pathway_steps
ADD COLUMN procedure_snomed_code VARCHAR(20),
ADD COLUMN procedure_cpt_code VARCHAR(10),
ADD COLUMN medication_rxnorm_codes JSONB DEFAULT '[]'::jsonb,
ADD COLUMN lab_loinc_codes JSONB DEFAULT '[]'::jsonb;

ALTER TABLE pathway_outcomes
ADD COLUMN outcome_loinc_code VARCHAR(20),
ADD COLUMN outcome_snomed_code VARCHAR(20);

-- Sprint 22 enhancements
ALTER TABLE vaccine_adverse_events
ADD COLUMN event_snomed_code VARCHAR(20),
ADD COLUMN event_snomed_term TEXT;

ALTER TABLE immunization_schedules
ADD COLUMN target_disease_snomed_codes JSONB DEFAULT '[]'::jsonb;
```

---

## 📋 **DETAILED FIELD ANALYSIS**

### **Sprint 23: Bed Management & ADT**

| Table | Field | Current | Needs | Priority |
|-------|-------|---------|-------|----------|
| `admissions` | `admitting_diagnosis` | TEXT | ICD-10 + SNOMED | 🔴 CRITICAL |
| `admissions` | `admission_reason` | TEXT | SNOMED | 🟡 HIGH |
| `discharges` | `discharge_diagnosis` | TEXT | ICD-10 + SNOMED + DRG | 🔴 CRITICAL |
| `discharges` | `discharge_condition` | VARCHAR(100) | SNOMED | 🟡 HIGH |
| `patient_transfers` | `transfer_reason` | TEXT | SNOMED | 🟢 MEDIUM |
| `patient_transfers` | `clinical_reason` | TEXT | SNOMED | 🟢 MEDIUM |

---

### **Sprint 24: Emergency Department**

| Table | Field | Current | Needs | Priority |
|-------|-------|---------|-------|----------|
| `ed_visits` | `chief_complaint` | TEXT | SNOMED | 🔴 CRITICAL |
| `ed_visits` | `presenting_symptoms` | TEXT | SNOMED | 🟡 HIGH |
| `ed_visits` | `discharge_diagnosis` | TEXT | ICD-10 + SNOMED | 🔴 CRITICAL |
| `ed_triage_assessments` | `presenting_complaint` | TEXT | SNOMED | 🔴 CRITICAL |
| `ed_triage_assessments` | `hpi` | TEXT | SNOMED (optional) | 🟢 MEDIUM |
| `ed_dispositions` | `discharge_diagnosis` | TEXT | ICD-10 + SNOMED | 🔴 CRITICAL |

---

### **Sprint 25: Clinical Pathways**

| Table | Field | Current | Needs | Priority |
|-------|-------|---------|-------|----------|
| `clinical_pathways` | `condition_codes` | JSONB (ICD-10) | Add SNOMED | 🟡 HIGH |
| `pathway_steps` | `step_type` | VARCHAR | SNOMED codes | 🟡 HIGH |
| `pathway_steps` | `order_sets` | JSONB | SNOMED/LOINC/RxNorm | 🟡 HIGH |
| `pathway_outcomes` | `outcome_measure` | VARCHAR | LOINC codes | 🟡 HIGH |

---

### **Sprint 22: Immunization Registry**

| Table | Field | Current | Needs | Priority |
|-------|-------|---------|-------|----------|
| `immunizations` | `vaccine_code` | VARCHAR (CVX) | ✅ Correct | ✅ DONE |
| `vaccine_adverse_events` | `event_type` | VARCHAR | SNOMED | 🟡 HIGH |
| `vaccine_adverse_events` | `event_description` | TEXT | SNOMED | 🟢 MEDIUM |
| `immunization_schedules` | `contraindications` | JSONB | SNOMED | 🟢 MEDIUM |

---

### **Sprint 21: E-Consent**

| Table | Field | Current | Needs | Priority |
|-------|-------|---------|-------|----------|
| `consent_templates` | `procedure_codes` | JSONB | CPT + SNOMED | 🟢 MEDIUM |
| `patient_consents` | `procedure_id` | UUID | Link to coded procedures | 🟢 MEDIUM |

---

## 🎯 **WHY THIS MATTERS**

### **Billing & Revenue Cycle**:
- ICD-10 codes **REQUIRED** for insurance claims
- CPT codes **REQUIRED** for procedure billing
- DRG codes **REQUIRED** for inpatient reimbursement
- Missing codes = Claims rejection

### **Clinical Decision Support**:
- SNOMED codes enable CDSS rules
- Coded data allows automated alerts
- Pattern recognition requires structured data

### **Public Health Reporting**:
- ICD-10 required for disease surveillance
- CVX codes for immunization reporting (already done ✅)
- Coded data enables automated reporting

### **Quality Measures**:
- Coded diagnoses required for quality metrics
- Pathway adherence tracking needs coded outcomes
- Performance measurement requires structured data

### **Interoperability**:
- FHIR resources require coded values
- HL7 messages need standardized codes
- EHR-to-EHR exchange requires terminology

---

## 🚀 **RECOMMENDED ACTION PLAN**

### **Phase 1: Critical Fixes** (1 week)
```sql
-- Migration 008: Add critical ICD-10 fields
ALTER TABLE admissions ADD COLUMN admitting_diagnosis_icd10 VARCHAR(10);
ALTER TABLE discharges ADD COLUMN discharge_diagnosis_icd10 VARCHAR(10);
ALTER TABLE discharges ADD COLUMN drg_code VARCHAR(10);
ALTER TABLE ed_visits ADD COLUMN discharge_diagnosis_icd10 VARCHAR(10);
ALTER TABLE ed_dispositions ADD COLUMN discharge_diagnosis_icd10 VARCHAR(10);
```

### **Phase 2: High Priority** (1-2 weeks)
```sql
-- Migration 009: Add SNOMED codes for clinical terms
ALTER TABLE ed_visits ADD COLUMN chief_complaint_snomed VARCHAR(20);
ALTER TABLE ed_triage_assessments ADD COLUMN presenting_complaint_snomed VARCHAR(20);
ALTER TABLE admissions ADD COLUMN admitting_diagnosis_snomed VARCHAR(20);
ALTER TABLE discharges ADD COLUMN discharge_diagnosis_snomed VARCHAR(20);
ALTER TABLE vaccine_adverse_events ADD COLUMN event_snomed_code VARCHAR(20);
```

### **Phase 3: Enhancements** (2-3 weeks)
```sql
-- Migration 010: Complete terminology integration
-- Add remaining SNOMED, LOINC, RxNorm fields
-- Restructure JSONB fields with proper coding
-- Add terminology lookup tables
```

---

## 💡 **BEST PRACTICES**

### **For Each Coded Field**:
```sql
-- Pattern to follow:
field_name TEXT, -- Human-readable description
field_name_code VARCHAR(20), -- The actual code
field_name_term TEXT, -- Official terminology term
field_name_system VARCHAR(20) -- Which terminology (SNOMED, ICD10, etc.)
```

### **For Multiple Codes** (JSONB):
```json
[
  {
    "system": "ICD-10",
    "code": "I21.9",
    "display": "Acute myocardial infarction",
    "primary": true
  },
  {
    "system": "SNOMED-CT",
    "code": "57054005",
    "display": "Acute myocardial infarction",
    "primary": false
  }
]
```

---

## ✅ **WHAT'S ALREADY GOOD**

### **Sprint 22 - Immunizations** ✅:
- Using CVX codes for vaccines (correct standard)
- CVX is the CDC standard for immunization
- No changes needed for vaccine coding

### **Existing MediCore Features** ✅:
- SNOMED integration already exists
- ICD-10 lookup available
- Terminology service operational
- Can leverage existing infrastructure

---

## 🎯 **IMMEDIATE RECOMMENDATION**

**Should I create Migration 008 now?**

```sql
-- Migration 008: Critical Terminology Fields
-- Adds ICD-10 and SNOMED codes to:
-- - Admissions (admitting diagnosis)
-- - Discharges (discharge diagnosis + DRG)
-- - ED Visits (chief complaint + discharge diagnosis)
-- - ED Triage (presenting complaint)
-- - ED Dispositions (discharge diagnosis)
```

**This would**:
- ✅ Enable proper billing
- ✅ Support quality reporting
- ✅ Enable CDSS features
- ✅ Meet regulatory requirements
- ✅ Support interoperability

**Time to implement**: 30 minutes  
**Impact**: HIGH - Critical for production use

---

**Should I proceed with creating and applying Migration 008?** 🚀

