# Sprint 7: Oncology Module Enhancements

## Overview

**Sprint Duration**: 4-6 weeks  
**Goal**: Enhance existing oncology module with precision medicine features, treatment response assessment, survivorship care, and advanced analytics.

**Priority**: High - Critical for comprehensive cancer care

---

## Phase 1: Imaging & Pathology Integration (Week 1-2)

### 1.1 Imaging Findings Integration ✅

#### Database Schema
- [ ] `oncology_imaging_findings` table
  - `oncology_case_id` (FK to oncology_cases)
  - `imaging_study_id` (FK to imaging_studies)
  - `imaging_date` (DATE)
  - `imaging_type` (VARCHAR) - CT, MRI, PET, X-ray, etc.
  - `modality` (VARCHAR)
  - `findings` (TEXT)
  - `tumor_size_cm` (DECIMAL)
  - `tumor_location` (TEXT)
  - `lymph_nodes_involved` (INTEGER)
  - `metastatic_sites` (TEXT[])
  - `recist_response` (ENUM: CR, PR, SD, PD, NE)
  - `recist_criteria_met` (BOOLEAN)
  - `radiologist_id` (FK to users)
  - Audit fields

#### TypeORM Entity
- [ ] `OncologyImagingFinding` entity
- [ ] Relationships to `OncologyCase` and `ImagingStudy`
- [ ] Enum for RECIST response

#### Service Methods
- [ ] `recordImagingFinding(tenantDb, caseId, payload, userId)`
- [ ] `getImagingFindings(tenantDb, caseId)`
- [ ] `getImagingTimeline(tenantDb, caseId)`
- [ ] `calculateRecistResponse(tenantDb, caseId, imagingId)`

#### API Endpoints
- [ ] `POST /oncology/cases/:id/imaging-findings` - Record imaging finding
- [ ] `GET /oncology/cases/:id/imaging-findings` - Get imaging findings
- [ ] `GET /oncology/cases/:id/imaging-findings/timeline` - Get imaging timeline
- [ ] `POST /oncology/imaging-findings/:id/calculate-recist` - Calculate RECIST

### 1.2 Pathology & Biomarkers Integration ✅

#### Database Schema
- [ ] `oncology_pathology` table
  - `oncology_case_id` (FK)
  - `pathology_report_id` (UUID, optional)
  - `specimen_date` (DATE)
  - `specimen_type` (VARCHAR)
  - `histology_type` (VARCHAR)
  - `histology_snomed_code` (VARCHAR)
  - `histology_snomed_term` (TEXT)
  - `grade` (VARCHAR) - Tumor grade
  - `stage_t`, `stage_n`, `stage_m` (VARCHAR)
  - `biomarkers` (JSONB) - ER, PR, HER2, PD-L1, MSI, TMB, etc.
  - `genetic_testing` (JSONB) - BRCA, Lynch, etc.
  - `notes` (TEXT)
  - `pathologist_id` (FK to users)
  - Audit fields

#### TypeORM Entity
- [ ] `OncologyPathology` entity
- [ ] JSONB fields for biomarkers and genetic testing
- [ ] Relationships to `OncologyCase`

#### Service Methods
- [ ] `recordPathology(tenantDb, caseId, payload, userId)`
- [ ] `getPathology(tenantDb, caseId)`
- [ ] `updateBiomarkers(tenantDb, pathologyId, biomarkers)`
- [ ] `getBiomarkerSummary(tenantDb, caseId)`

#### API Endpoints
- [ ] `POST /oncology/cases/:id/pathology` - Record pathology
- [ ] `GET /oncology/cases/:id/pathology` - Get pathology
- [ ] `PATCH /oncology/pathology/:id/biomarkers` - Update biomarkers
- [ ] `GET /oncology/cases/:id/biomarkers` - Get biomarker summary

### 1.3 Frontend Components ✅

#### Imaging Findings Interface
- [ ] **File**: `ehr-frontend/src/components/OncologyImagingFindings.tsx`
- [ ] Imaging findings list with timeline
- [ ] Add imaging finding modal
- [ ] RECIST response calculator
- [ ] Tumor size chart over time
- [ ] Link to imaging study viewer

#### Pathology Interface
- [ ] **File**: `ehr-frontend/src/components/OncologyPathology.tsx`
- [ ] Pathology report display
- [ ] Biomarker panel with visual indicators
- [ ] Genetic testing results display
- [ ] Add/edit pathology modal
- [ ] Biomarker update interface

---

## Phase 2: Treatment Response Assessment (Week 2-3)

### 2.1 RECIST Criteria Implementation ✅

#### Database Schema
- [ ] `oncology_response_assessment` table
  - `oncology_case_id` (FK)
  - `regimen_id` (FK, optional)
  - `assessment_date` (DATE)
  - `assessment_type` (ENUM: baseline, interim, end_of_treatment, follow_up)
  - `recist_response` (ENUM: CR, PR, SD, PD, NE)
  - `best_overall_response` (VARCHAR)
  - `target_lesions_count` (INTEGER)
  - `target_lesions_size_cm` (DECIMAL)
  - `non_target_lesions_status` (VARCHAR)
  - `new_lesions` (BOOLEAN)
  - `assessed_by` (FK to users)
  - `notes` (TEXT)
  - Audit fields

#### RECIST Calculation Logic
- [ ] **Complete Response (CR)**: Disappearance of all target lesions
- [ ] **Partial Response (PR)**: ≥30% decrease in sum of diameters
- [ ] **Stable Disease (SD)**: Neither PR nor PD criteria met
- [ ] **Progressive Disease (PD)**: ≥20% increase or new lesions
- [ ] **Not Evaluable (NE)**: Cannot be assessed

#### Service Methods
- [ ] `recordResponseAssessment(tenantDb, caseId, payload, userId)`
- [ ] `calculateRecist(tenantDb, caseId, baselineId, currentId)`
- [ ] `getResponseHistory(tenantDb, caseId)`
- [ ] `getBestOverallResponse(tenantDb, caseId)`
- [ ] `calculatePFS(tenantDb, caseId)` - Progression-free survival
- [ ] `calculateOS(tenantDb, caseId)` - Overall survival

#### API Endpoints
- [ ] `POST /oncology/cases/:id/response-assessments` - Record assessment
- [ ] `GET /oncology/cases/:id/response-assessments` - Get assessment history
- [ ] `POST /oncology/response-assessments/:id/calculate-recist` - Calculate RECIST
- [ ] `GET /oncology/cases/:id/best-response` - Get best overall response
- [ ] `GET /oncology/cases/:id/survival-metrics` - Get PFS/OS

### 2.2 Response Visualization ✅

#### Frontend Components
- [ ] **File**: `ehr-frontend/src/components/OncologyResponseAssessment.tsx`
- [ ] Response assessment timeline
- [ ] RECIST response chart (tumor size over time)
- [ ] Response categories visualization
- [ ] Best overall response display
- [ ] PFS/OS calculations display

---

## Phase 3: Survivorship Care Plans (Week 3-4)

### 3.1 Survivorship Schema ✅

#### Database Schema
- [ ] `oncology_survivorship_plans` table
  - `oncology_case_id` (FK)
  - `treatment_completion_date` (DATE)
  - `follow_up_schedule` (JSONB) - Structured follow-up plan
  - `surveillance_imaging_schedule` (JSONB) - Imaging follow-up plan
  - `long_term_side_effects` (TEXT[])
  - `recurrence_risk` (VARCHAR) - Low, moderate, high
  - `lifestyle_recommendations` (TEXT)
  - `created_by` (FK to users)
  - Audit fields

#### Follow-up Schedule JSONB Structure
```json
{
  "visits": [
    {
      "interval_months": 3,
      "duration_months": 24,
      "tests": ["CBC", "CMP", "Tumor markers"],
      "imaging": ["CT chest/abdomen/pelvis"]
    }
  ]
}
```

#### Service Methods
- [ ] `createSurvivorshipPlan(tenantDb, caseId, payload, userId)`
- [ ] `getSurvivorshipPlan(tenantDb, caseId)`
- [ ] `updateSurvivorshipPlan(tenantDb, planId, payload)`
- [ ] `getUpcomingFollowUps(tenantDb, caseId)`
- [ ] `generateSurvivorshipReport(tenantDb, caseId)`

#### API Endpoints
- [ ] `POST /oncology/cases/:id/survivorship-plan` - Create plan
- [ ] `GET /oncology/cases/:id/survivorship-plan` - Get plan
- [ ] `PATCH /oncology/survivorship-plans/:id` - Update plan
- [ ] `GET /oncology/cases/:id/follow-ups/upcoming` - Get upcoming follow-ups
- [ ] `GET /oncology/cases/:id/survivorship-report` - Generate report

### 3.2 Survivorship Dashboard ✅

#### Frontend Components
- [ ] **File**: `ehr-frontend/src/components/OncologySurvivorshipPlan.tsx`
- [ ] Survivorship plan display
- [ ] Follow-up schedule calendar
- [ ] Surveillance reminders
- [ ] Long-term side effect tracking
- [ ] Recurrence risk assessment
- [ ] Lifestyle recommendations

---

## Phase 4: Clinical Trials & Precision Medicine (Week 4-5)

### 4.1 Clinical Trials Integration ✅

#### Database Schema
- [ ] `oncology_clinical_trials` table
  - `oncology_case_id` (FK)
  - `trial_name` (VARCHAR)
  - `trial_id` (VARCHAR) - NCT number or internal ID
  - `trial_phase` (VARCHAR) - Phase I, II, III, IV
  - `enrollment_date` (DATE)
  - `enrollment_status` (ENUM: screening, enrolled, on_treatment, completed, withdrawn)
  - `protocol_compliance_percentage` (INTEGER)
  - `trial_endpoints` (JSONB) - Primary and secondary endpoints
  - `notes` (TEXT)
  - Audit fields

#### Service Methods
- [ ] `enrollInTrial(tenantDb, caseId, payload, userId)`
- [ ] `updateTrialStatus(tenantDb, trialId, status)`
- [ ] `trackProtocolCompliance(tenantDb, trialId, complianceData)`
- [ ] `getTrialHistory(tenantDb, caseId)`
- [ ] `getTrialEndpoints(tenantDb, trialId)`

#### API Endpoints
- [ ] `POST /oncology/cases/:id/clinical-trials` - Enroll in trial
- [ ] `GET /oncology/cases/:id/clinical-trials` - Get trial history
- [ ] `PATCH /oncology/clinical-trials/:id/status` - Update status
- [ ] `POST /oncology/clinical-trials/:id/compliance` - Track compliance
- [ ] `GET /oncology/clinical-trials/:id/endpoints` - Get endpoints

### 4.2 Patient-Reported Outcomes (PROs) ✅

#### Database Schema
- [ ] `oncology_patient_reported_outcomes` table
  - `oncology_case_id` (FK)
  - `assessment_date` (DATE)
  - `assessment_type` (ENUM: EORTC_QLQ_C30, FACT_G, symptom_tracking, functional_status, satisfaction)
  - `assessment_data` (JSONB) - Full assessment responses
  - `total_score` (DECIMAL)
  - `domain_scores` (JSONB) - Domain-specific scores
  - `completed_by_patient` (BOOLEAN)
  - Audit fields

#### Service Methods
- [ ] `recordPRO(tenantDb, caseId, payload, userId)`
- [ ] `getPROHistory(tenantDb, caseId, assessmentType)`
- [ ] `calculatePROScore(tenantDb, proId)` - Calculate scores
- [ ] `getPROTrends(tenantDb, caseId)` - Get trends over time

#### API Endpoints
- [ ] `POST /oncology/cases/:id/pros` - Record PRO
- [ ] `GET /oncology/cases/:id/pros` - Get PRO history
- [ ] `GET /oncology/cases/:id/pros/trends` - Get PRO trends
- [ ] `POST /oncology/pros/:id/calculate-scores` - Calculate scores

### 4.3 Genomic Data Storage ✅

#### Database Schema Enhancement
- [ ] Add `genomic_data` JSONB column to `oncology_pathology` table
  - Genetic mutations (BRCA1, BRCA2, TP53, etc.)
  - Tumor mutational burden (TMB)
  - Microsatellite instability (MSI) status
  - PD-L1 expression
  - Liquid biopsy results

#### Service Methods
- [ ] `recordGenomicData(tenantDb, pathologyId, genomicData)`
- [ ] `getGenomicSummary(tenantDb, caseId)`
- [ ] `matchTargetedTherapy(tenantDb, caseId)` - Match therapies based on biomarkers

#### API Endpoints
- [ ] `POST /oncology/pathology/:id/genomic-data` - Record genomic data
- [ ] `GET /oncology/cases/:id/genomic-summary` - Get genomic summary
- [ ] `GET /oncology/cases/:id/targeted-therapies` - Get matched therapies

### 4.4 Frontend Components ✅

#### Clinical Trials Interface
- [ ] **File**: `ehr-frontend/src/components/OncologyClinicalTrials.tsx`
- [ ] Trial enrollment form
- [ ] Trial status tracking
- [ ] Protocol compliance dashboard
- [ ] Trial endpoints display

#### PROs Interface
- [ ] **File**: `ehr-frontend/src/components/OncologyPROs.tsx`
- [ ] PRO assessment forms (EORTC QLQ-C30, FACT-G)
- [ ] PRO history and trends
- [ ] Quality of life charts
- [ ] Symptom tracking interface

#### Genomic Data Interface
- [ ] **File**: `ehr-frontend/src/components/OncologyGenomicData.tsx`
- [ ] Genomic data display
- [ ] Biomarker visualization
- [ ] Targeted therapy matching
- [ ] Genetic mutation panel

---

## Phase 5: Advanced Analytics & CDS (Week 5-6)

### 5.1 Advanced Dashboard Analytics ✅

#### New Dashboard Metrics
- [x] **Response Rates**:
  - Overall response rate (ORR)
  - Disease control rate (DCR)
  - Best overall response distribution

- [x] **Survival Metrics**:
  - Median PFS
  - Median OS
  - 1-year, 2-year, 5-year survival rates

- [x] **Biomarker Analytics**:
  - Biomarker distribution
  - Response rates by biomarker
  - Targeted therapy usage

- [x] **Trial Analytics**:
  - Trial enrollment rates
  - Protocol compliance rates
  - Endpoint achievement rates

#### Service Methods
- [x] `getResponseRates(tenantDb, filters)`
- [x] `getSurvivalMetrics(tenantDb, filters)`
- [x] `getBiomarkerAnalytics(tenantDb, filters)`
- [x] `getTrialAnalytics(tenantDb, filters)`

#### API Endpoints
- [x] `GET /oncology/analytics/response-rates` - Get response rates
- [x] `GET /oncology/analytics/survival` - Get survival metrics
- [x] `GET /oncology/analytics/biomarkers` - Get biomarker analytics
- [x] `GET /oncology/analytics/trials` - Get trial analytics

### 5.2 Enhanced CDS Rules ✅

#### Treatment Recommendations
- [x] **NCCN Guideline-Based Recommendations**:
  - Treatment recommendations based on cancer type and stage
  - Biomarker-driven therapy suggestions
  - Drug interaction alerts

- [x] **Response Monitoring**:
  - Alert on lack of response (SD/PD)
  - Suggest alternative regimens
  - Alert on progression

- [x] **Surveillance Reminders**:
  - Follow-up appointment reminders
  - Imaging due dates
  - Lab test due dates

- [x] **Toxicity Management**:
  - Alert on high-grade toxicities (Grade 3+)
  - Suggest dose modifications
  - Recommend supportive care

#### Service Methods
- [x] `generateTreatmentRecommendations(tenantDb, caseId)`
- [x] `checkResponseStatus(tenantDb, caseId)`
- [x] `generateSurveillanceReminders(tenantDb, caseId)`
- [x] `checkToxicityAlerts(tenantDb, caseId)`

#### API Endpoints
- [x] `GET /oncology/cases/:id/treatment-recommendations` - Get recommendations
- [x] `GET /oncology/cases/:id/surveillance-reminders` - Get reminders
- [x] `POST /oncology/cases/:id/check-alerts` - Check all alerts

### 5.3 Financial Toxicity Tracking ✅

#### Database Schema
- [x] Add financial fields to `oncology_infusion_sessions`:
  - `insurance_coverage_percentage` (DECIMAL)
  - `out_of_pocket_cost` (DECIMAL)
  - `financial_assistance_received` (BOOLEAN)
  - `financial_assistance_program` (VARCHAR)

- [x] `oncology_financial_toxicity` table:
  - `oncology_case_id` (FK)
  - `assessment_date` (DATE)
  - `total_cost_to_date` (DECIMAL)
  - `insurance_coverage_total` (DECIMAL)
  - `out_of_pocket_total` (DECIMAL)
  - `financial_assistance_total` (DECIMAL)
  - `financial_stress_score` (INTEGER) - 1-10 scale
  - `notes` (TEXT)

#### Service Methods
- [x] `trackFinancialToxicity(tenantDb, caseId, payload)`
- [x] `getFinancialSummary(tenantDb, caseId)`
- [x] `getFinancialAssistancePrograms(tenantDb, caseId)`

#### API Endpoints
- [x] `POST /oncology/cases/:id/financial-toxicity` - Record assessment
- [x] `GET /oncology/cases/:id/financial-summary` - Get summary
- [x] `GET /oncology/cases/:id/financial-assistance` - Get assistance programs

---

## Phase 6: UI/UX Enhancements (Week 6)

### 6.1 Timeline View ✅

- [x] **File**: `ehr-frontend/src/components/OncologyTimeline.tsx`
- [x] Visual timeline showing:
  - Diagnosis → Staging → Treatment → Response → Follow-up
- [x] Interactive milestones
- [x] Filter by event type
- [ ] Export timeline

### 6.2 Response Charts ✅

- [x] **File**: `ehr-frontend/src/components/OncologyResponseCharts.tsx`
- [x] Tumor size over time chart
- [x] RECIST response visualization
- [ ] PFS/OS Kaplan-Meier curves (if multiple patients) *(deferred)*
- [x] Response category distribution

### 6.3 Biomarker Dashboard ✅

- [x] **File**: `ehr-frontend/src/components/OncologyBiomarkerDashboard.tsx`
- [x] Visual representation of biomarker status
- [x] Targeted therapy matching display
- [x] Treatment recommendations based on biomarkers
- [x] Biomarker trends over time

### 6.4 Survivorship Dashboard ✅

- [x] **File**: `ehr-frontend/src/components/OncologySurvivorshipDashboard.tsx`
- [x] Follow-up schedule calendar
- [x] Surveillance reminders
- [x] Long-term side effect tracking
- [x] Quality of life metrics

---

## Success Criteria

### Must Have (MVP)
1. ✅ Imaging findings integration with RECIST
2. ✅ Pathology & biomarkers storage
3. ✅ Treatment response assessment
4. ✅ Basic survivorship plans
5. ✅ Enhanced dashboard analytics

### Should Have
1. Clinical trials integration
2. Patient-reported outcomes
3. Genomic data storage
4. Advanced CDS rules
5. Financial toxicity tracking

### Nice to Have
1. Kaplan-Meier survival curves
2. Advanced biomarker analytics
3. Trial endpoint tracking
4. Patient portal integration
5. Mobile app integration

---

## Dependencies

- ✅ Existing oncology module
- ✅ Imaging module
- ✅ Lab results module
- ✅ SNOMED CT integration
- ✅ CDSS service
- ✅ Appointments module

## Risks & Mitigation

1. **RECIST Calculation Complexity**
   - Risk: RECIST criteria can be complex
   - Mitigation: Start with basic calculations, iterate based on feedback

2. **Biomarker Data Standardization**
   - Risk: Different labs report biomarkers differently
   - Mitigation: Flexible JSONB storage, standardized display

3. **Survival Calculation Accuracy**
   - Risk: Survival calculations require accurate dates
   - Mitigation: Validate dates, handle edge cases

4. **PRO Assessment Complexity**
   - Risk: PRO assessments can be lengthy
   - Mitigation: Start with simple assessments, add complex ones later

---

## Next Steps

1. **Grooming Session**: Review and prioritize tasks
2. **Technical Design**: Finalize API contracts, database schemas
3. **Implementation**: Start with Phase 1 (Imaging & Pathology)
4. **Testing**: Unit tests, integration tests, user acceptance
5. **Deployment**: Staged rollout to production

---

**Sprint 7 Goal**: Transform oncology module into comprehensive precision medicine platform with treatment response assessment, survivorship care, and advanced analytics.


