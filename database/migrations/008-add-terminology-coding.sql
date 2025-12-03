-- Migration 008: Add Terminology Coding (SNOMED, ICD-10, LOINC, CPT)
-- Date: December 3, 2025
-- Description: Add proper medical terminology coding to Sprints 21-25 tables

-- ==================== SPRINT 23: BED MANAGEMENT & ADT ====================

-- Admissions: Add ICD-10 and SNOMED for diagnoses
ALTER TABLE admissions
ADD COLUMN IF NOT EXISTS admitting_diagnosis_icd10 VARCHAR(10),
ADD COLUMN IF NOT EXISTS admitting_diagnosis_snomed VARCHAR(20),
ADD COLUMN IF NOT EXISTS admitting_diagnosis_term TEXT,
ADD COLUMN IF NOT EXISTS secondary_diagnoses JSONB DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS comorbidities_coded JSONB DEFAULT '[]'::jsonb;

COMMENT ON COLUMN admissions.admitting_diagnosis_icd10 IS 'ICD-10 code for primary admitting diagnosis';
COMMENT ON COLUMN admissions.admitting_diagnosis_snomed IS 'SNOMED CT code for admitting diagnosis';
COMMENT ON COLUMN admissions.secondary_diagnoses IS 'Array of secondary diagnoses with ICD-10 and SNOMED codes';

CREATE INDEX IF NOT EXISTS idx_admissions_icd10 ON admissions(admitting_diagnosis_icd10);
CREATE INDEX IF NOT EXISTS idx_admissions_snomed ON admissions(admitting_diagnosis_snomed);

-- Discharges: Add ICD-10, SNOMED, and DRG codes
ALTER TABLE discharges
ADD COLUMN IF NOT EXISTS discharge_diagnosis_icd10 VARCHAR(10),
ADD COLUMN IF NOT EXISTS discharge_diagnosis_snomed VARCHAR(20),
ADD COLUMN IF NOT EXISTS discharge_diagnosis_term TEXT,
ADD COLUMN IF NOT EXISTS secondary_diagnoses JSONB DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS drg_code VARCHAR(10),
ADD COLUMN IF NOT EXISTS drg_description TEXT,
ADD COLUMN IF NOT EXISTS drg_weight DECIMAL(5,2),
ADD COLUMN IF NOT EXISTS procedures_performed JSONB DEFAULT '[]'::jsonb;

COMMENT ON COLUMN discharges.discharge_diagnosis_icd10 IS 'ICD-10 code for primary discharge diagnosis - REQUIRED for billing';
COMMENT ON COLUMN discharges.drg_code IS 'Diagnosis Related Group code for reimbursement';
COMMENT ON COLUMN discharges.procedures_performed IS 'Array of procedures with CPT and SNOMED codes';

CREATE INDEX IF NOT EXISTS idx_discharges_icd10 ON discharges(discharge_diagnosis_icd10);
CREATE INDEX IF NOT EXISTS idx_discharges_snomed ON discharges(discharge_diagnosis_snomed);
CREATE INDEX IF NOT EXISTS idx_discharges_drg ON discharges(drg_code);

-- Patient Transfers: Add SNOMED for transfer reasons
ALTER TABLE patient_transfers
ADD COLUMN IF NOT EXISTS transfer_reason_snomed VARCHAR(20),
ADD COLUMN IF NOT EXISTS transfer_reason_term TEXT,
ADD COLUMN IF NOT EXISTS clinical_reason_snomed VARCHAR(20);

COMMENT ON COLUMN patient_transfers.transfer_reason_snomed IS 'SNOMED CT code for transfer reason';

-- ==================== SPRINT 24: EMERGENCY DEPARTMENT ====================

-- ED Visits: Add SNOMED for complaints and ICD-10 for diagnoses
ALTER TABLE ed_visits
ADD COLUMN IF NOT EXISTS chief_complaint_snomed VARCHAR(20),
ADD COLUMN IF NOT EXISTS chief_complaint_term TEXT,
ADD COLUMN IF NOT EXISTS presenting_symptoms_coded JSONB DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS discharge_diagnosis_icd10 VARCHAR(10),
ADD COLUMN IF NOT EXISTS discharge_diagnosis_snomed VARCHAR(20),
ADD COLUMN IF NOT EXISTS discharge_diagnosis_term TEXT,
ADD COLUMN IF NOT EXISTS secondary_diagnoses JSONB DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS procedures_performed JSONB DEFAULT '[]'::jsonb;

COMMENT ON COLUMN ed_visits.chief_complaint_snomed IS 'SNOMED CT code for chief complaint - enables CDSS';
COMMENT ON COLUMN ed_visits.discharge_diagnosis_icd10 IS 'ICD-10 code for discharge diagnosis - REQUIRED for ED billing';
COMMENT ON COLUMN ed_visits.presenting_symptoms_coded IS 'Array of symptoms with SNOMED codes';
COMMENT ON COLUMN ed_visits.procedures_performed IS 'Array of ED procedures with CPT and SNOMED codes';

CREATE INDEX IF NOT EXISTS idx_ed_visits_complaint_snomed ON ed_visits(chief_complaint_snomed);
CREATE INDEX IF NOT EXISTS idx_ed_visits_diagnosis_icd10 ON ed_visits(discharge_diagnosis_icd10);
CREATE INDEX IF NOT EXISTS idx_ed_visits_diagnosis_snomed ON ed_visits(discharge_diagnosis_snomed);

-- ED Triage: Add SNOMED for presenting complaints
ALTER TABLE ed_triage_assessments
ADD COLUMN IF NOT EXISTS presenting_complaint_snomed VARCHAR(20),
ADD COLUMN IF NOT EXISTS presenting_complaint_term TEXT,
ADD COLUMN IF NOT EXISTS symptoms_snomed_codes JSONB DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS medical_history_coded JSONB DEFAULT '[]'::jsonb;

COMMENT ON COLUMN ed_triage_assessments.presenting_complaint_snomed IS 'SNOMED CT code for triage complaint - critical for ESI algorithm';
COMMENT ON COLUMN ed_triage_assessments.symptoms_snomed_codes IS 'Array of presenting symptoms with SNOMED codes';

CREATE INDEX IF NOT EXISTS idx_ed_triage_complaint_snomed ON ed_triage_assessments(presenting_complaint_snomed);

-- ED Dispositions: Add ICD-10 for discharge diagnoses
ALTER TABLE ed_dispositions
ADD COLUMN IF NOT EXISTS discharge_diagnosis_icd10 VARCHAR(10),
ADD COLUMN IF NOT EXISTS discharge_diagnosis_snomed VARCHAR(20),
ADD COLUMN IF NOT EXISTS discharge_diagnosis_term TEXT,
ADD COLUMN IF NOT EXISTS secondary_diagnoses JSONB DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS procedures_coded JSONB DEFAULT '[]'::jsonb;

COMMENT ON COLUMN ed_dispositions.discharge_diagnosis_icd10 IS 'ICD-10 code for ED discharge - REQUIRED for billing';
COMMENT ON COLUMN ed_dispositions.procedures_coded IS 'ED procedures with CPT codes for billing';

CREATE INDEX IF NOT EXISTS idx_ed_dispositions_icd10 ON ed_dispositions(discharge_diagnosis_icd10);

-- ==================== SPRINT 25: CLINICAL PATHWAYS ====================

-- Clinical Pathways: Add SNOMED codes for conditions
ALTER TABLE clinical_pathways
ADD COLUMN IF NOT EXISTS condition_snomed_codes JSONB DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS target_diagnoses_icd10 JSONB DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS inclusion_criteria_snomed JSONB DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS exclusion_criteria_snomed JSONB DEFAULT '[]'::jsonb;

COMMENT ON COLUMN clinical_pathways.condition_snomed_codes IS 'SNOMED CT codes for pathway conditions';
COMMENT ON COLUMN clinical_pathways.target_diagnoses_icd10 IS 'ICD-10 codes for pathway enrollment criteria';

-- Pathway Steps: Add codes for procedures and orders
ALTER TABLE pathway_steps
ADD COLUMN IF NOT EXISTS procedure_snomed_code VARCHAR(20),
ADD COLUMN IF NOT EXISTS procedure_snomed_term TEXT,
ADD COLUMN IF NOT EXISTS procedure_cpt_code VARCHAR(10),
ADD COLUMN IF NOT EXISTS medication_rxnorm_codes JSONB DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS lab_loinc_codes JSONB DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS imaging_snomed_codes JSONB DEFAULT '[]'::jsonb;

COMMENT ON COLUMN pathway_steps.procedure_snomed_code IS 'SNOMED CT procedure code';
COMMENT ON COLUMN pathway_steps.medication_rxnorm_codes IS 'RxNorm codes for medications in pathway';
COMMENT ON COLUMN pathway_steps.lab_loinc_codes IS 'LOINC codes for lab tests in pathway';

-- Pathway Outcomes: Add LOINC for measurements
ALTER TABLE pathway_outcomes
ADD COLUMN IF NOT EXISTS outcome_loinc_code VARCHAR(20),
ADD COLUMN IF NOT EXISTS outcome_loinc_term TEXT,
ADD COLUMN IF NOT EXISTS outcome_snomed_code VARCHAR(20),
ADD COLUMN IF NOT EXISTS outcome_unit VARCHAR(50);

COMMENT ON COLUMN pathway_outcomes.outcome_loinc_code IS 'LOINC code for outcome measurement';

CREATE INDEX IF NOT EXISTS idx_pathway_outcomes_loinc ON pathway_outcomes(outcome_loinc_code);

-- ==================== SPRINT 22: IMMUNIZATION REGISTRY ====================

-- Vaccine Adverse Events: Add SNOMED for event types
ALTER TABLE vaccine_adverse_events
ADD COLUMN IF NOT EXISTS event_snomed_code VARCHAR(20),
ADD COLUMN IF NOT EXISTS event_snomed_term TEXT,
ADD COLUMN IF NOT EXISTS symptoms_snomed_codes JSONB DEFAULT '[]'::jsonb;

COMMENT ON COLUMN vaccine_adverse_events.event_snomed_code IS 'SNOMED CT code for adverse event type';
COMMENT ON COLUMN vaccine_adverse_events.symptoms_snomed_codes IS 'Array of symptoms with SNOMED codes for VAERS reporting';

CREATE INDEX IF NOT EXISTS idx_vaccine_adverse_events_snomed ON vaccine_adverse_events(event_snomed_code);

-- Immunization Schedules: Add SNOMED for contraindications
ALTER TABLE immunization_schedules
ADD COLUMN IF NOT EXISTS target_disease_snomed_codes JSONB DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS contraindications_snomed JSONB DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS precautions_snomed JSONB DEFAULT '[]'::jsonb;

COMMENT ON COLUMN immunization_schedules.target_disease_snomed_codes IS 'SNOMED CT codes for diseases prevented by vaccine';
COMMENT ON COLUMN immunization_schedules.contraindications_snomed IS 'SNOMED-coded contraindications for clinical decision support';

-- ==================== SPRINT 21: E-CONSENT ====================

-- Consent Templates: Add CPT and SNOMED for procedures
ALTER TABLE consent_templates
ADD COLUMN IF NOT EXISTS procedure_snomed_codes JSONB DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS procedure_cpt_codes JSONB DEFAULT '[]'::jsonb;

COMMENT ON COLUMN consent_templates.procedure_snomed_codes IS 'SNOMED CT procedure codes applicable to this consent';
COMMENT ON COLUMN consent_templates.procedure_cpt_codes IS 'CPT codes for procedures requiring this consent';

-- Patient Consents: Add procedure coding
ALTER TABLE patient_consents
ADD COLUMN IF NOT EXISTS procedure_snomed_code VARCHAR(20),
ADD COLUMN IF NOT EXISTS procedure_snomed_term TEXT,
ADD COLUMN IF NOT EXISTS procedure_cpt_code VARCHAR(10),
ADD COLUMN IF NOT EXISTS diagnosis_icd10 VARCHAR(10),
ADD COLUMN IF NOT EXISTS diagnosis_snomed VARCHAR(20);

COMMENT ON COLUMN patient_consents.procedure_snomed_code IS 'SNOMED CT code for procedure being consented';
COMMENT ON COLUMN patient_consents.diagnosis_icd10 IS 'ICD-10 diagnosis requiring consent';

CREATE INDEX IF NOT EXISTS idx_patient_consents_procedure_snomed ON patient_consents(procedure_snomed_code);
CREATE INDEX IF NOT EXISTS idx_patient_consents_diagnosis_icd10 ON patient_consents(diagnosis_icd10);

-- Add final comments
COMMENT ON SCHEMA public IS 'MediCore EHR Schema with complete terminology integration (SNOMED-CT, ICD-10, CVX, LOINC, CPT, RxNorm)';

