"# Sprint 25: Clinical Pathways & Protocols

## Overview
Evidence-based clinical pathways and protocols system with pathway builder, compliance tracking, variance analysis, and outcome measurement. Implements standardized care pathways for common conditions to improve quality, reduce variation, and optimize outcomes.

## Goals
- Clinical pathway builder tool
- Evidence-based protocol library
- Pathway compliance tracking
- Deviation/variance management
- Automated pathway activation
- Real-time decision support during pathway execution
- Outcome measurement and reporting
- Multi-disciplinary pathway support
- Integration with existing workflows (orders, documentation)
- Pathway version control

## Priority: ⭐⭐⭐ CRITICAL
**Estimated Effort**: 2-3 weeks

---

## Database Schema

### Clinical Pathways Table
```sql
CREATE TABLE clinical_pathways (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pathway_code VARCHAR(100) NOT NULL UNIQUE,
  pathway_name VARCHAR(255) NOT NULL,
  pathway_version VARCHAR(20) NOT NULL,
  pathway_type VARCHAR(100) CHECK (pathway_type IN (
    'disease_specific',
    'procedure_based',
    'symptom_based',
    'prevention',
    'chronic_disease_management',
    'acute_care',
    'post_operative',
    'rehabilitation'
  )),
  clinical_domain VARCHAR(100), -- Cardiology, Oncology, etc.
  indication TEXT NOT NULL,
  target_population TEXT,
  inclusion_criteria JSONB NOT NULL,
  exclusion_criteria JSONB,
  evidence_level VARCHAR(50) CHECK (evidence_level IN (
    'level_1', -- Systematic review/meta-analysis
    'level_2', -- RCT
    'level_3', -- Cohort study
    'level_4', -- Case series
    'level_5', -- Expert opinion
    'guideline' -- Clinical practice guideline
  )),
  evidence_source TEXT, -- Citation/reference
  guideline_reference TEXT,
  pathway_definition JSONB NOT NULL, -- Complete pathway structure
  /* Pathway structure:
  {
    "phases": [{
      "phase_id": "1",
      "phase_name": "Initial Assessment",
      "duration_hours": 4,
      "steps": [{
        "step_id": "1.1",
        "step_name": "Vital signs",
        "step_type": "assessment",
        "required": true,
        "timing": "immediate",
        "responsible_role": "nurse",
        "completion_criteria": {...}
      }],
      "decision_points": [{
        "decision_id": "d1",
        "question": "Troponin elevated?",
        "options": ["yes", "no"],
        "actions": {...}
      }]
    }],
    "milestones": [...],
    "outcomes": [...]
  }
  */
  expected_duration_hours INTEGER,
  pathway_goals JSONB, -- Array of clinical goals
  quality_indicators JSONB, -- Measures to track
  auto_activation_rules JSONB, -- Conditions for automatic activation
  required_roles JSONB, -- Roles involved in pathway
  default_order_sets JSONB, -- Order sets to use
  documentation_templates JSONB, -- Note templates
  patient_education_materials JSONB,
  cost_estimates JSONB,
  status VARCHAR(50) DEFAULT 'draft' CHECK (status IN (
    'draft',
    'review',
    'active',
    'inactive',
    'archived',
    'superseded'
  )),
  effective_date DATE NOT NULL,
  expiration_date DATE,
  created_by UUID REFERENCES users(id),
  approved_by UUID REFERENCES users(id),
  approved_at TIMESTAMP WITH TIME ZONE,
  usage_count INTEGER DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_clinical_pathways_code ON clinical_pathways(pathway_code);
CREATE INDEX idx_clinical_pathways_type ON clinical_pathways(pathway_type);
CREATE INDEX idx_clinical_pathways_domain ON clinical_pathways(clinical_domain);
CREATE INDEX idx_clinical_pathways_status ON clinical_pathways(status);
```

### Patient Pathways Table
```sql
CREATE TABLE patient_pathways (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID NOT NULL REFERENCES patients(id),
  pathway_id UUID NOT NULL REFERENCES clinical_pathways(id),
  admission_id UUID REFERENCES patient_admissions(id),
  encounter_id UUID, -- Reference to encounter/visit
  pathway_code VARCHAR(100) NOT NULL,
  pathway_name VARCHAR(255) NOT NULL,
  pathway_version VARCHAR(20) NOT NULL,
  activation_type VARCHAR(50) CHECK (activation_type IN (
    'automatic',
    'manual',
    'recommended'
  )),
  activated_by UUID REFERENCES users(id),
  activated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  activation_reason TEXT,
  eligibility_checked BOOLEAN DEFAULT false,
  eligibility_met BOOLEAN DEFAULT true,
  eligibility_notes TEXT,
  current_phase VARCHAR(100),
  current_phase_started_at TIMESTAMP WITH TIME ZONE,
  current_step VARCHAR(100),
  status VARCHAR(50) DEFAULT 'active' CHECK (status IN (
    'active',
    'on_hold',
    'completed',
    'discontinued',
    'deviated',
    'failed'
  )),
  completion_percentage NUMERIC(5,2) DEFAULT 0.00,
  expected_completion_date TIMESTAMP WITH TIME ZONE,
  actual_completion_date TIMESTAMP WITH TIME ZONE,
  total_duration_hours NUMERIC(10,2),
  on_track BOOLEAN DEFAULT true,
  delayed_reason TEXT,
  primary_provider_id UUID REFERENCES users(id),
  care_team JSONB, -- Array of team member IDs
  pathway_data JSONB DEFAULT '{}'::jsonb, -- Runtime data
  outcomes_met JSONB, -- Track outcome achievement
  variances_count INTEGER DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_patient_pathways_patient ON patient_pathways(patient_id);
CREATE INDEX idx_patient_pathways_pathway ON patient_pathways(pathway_id);
CREATE INDEX idx_patient_pathways_status ON patient_pathways(status);
CREATE INDEX idx_patient_pathways_activated_at ON patient_pathways(activated_at);
CREATE INDEX idx_patient_pathways_admission ON patient_pathways(admission_id);
```

### Pathway Executions Table
```sql
CREATE TABLE pathway_executions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_pathway_id UUID NOT NULL REFERENCES patient_pathways(id) ON DELETE CASCADE,
  patient_id UUID NOT NULL REFERENCES patients(id),
  phase_id VARCHAR(100) NOT NULL,
  phase_name VARCHAR(255) NOT NULL,
  step_id VARCHAR(100) NOT NULL,
  step_name VARCHAR(255) NOT NULL,
  step_type VARCHAR(50), -- Assessment, intervention, medication, etc.
  step_status VARCHAR(50) DEFAULT 'pending' CHECK (step_status IN (
    'pending',
    'in_progress',
    'completed',
    'skipped',
    'failed',
    'not_applicable'
  )),
  scheduled_time TIMESTAMP WITH TIME ZONE,
  started_at TIMESTAMP WITH TIME ZONE,
  completed_at TIMESTAMP WITH TIME ZONE,
  completed_by UUID REFERENCES users(id),
  duration_minutes INTEGER,
  is_deviation BOOLEAN DEFAULT false,
  deviation_reason TEXT,
  completion_notes TEXT,
  linked_order_id UUID, -- Link to actual order
  linked_assessment_id UUID, -- Link to assessment
  linked_documentation_id UUID, -- Link to note
  outcome_value TEXT,
  meets_criteria BOOLEAN,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_pathway_executions_patient_pathway ON pathway_executions(patient_pathway_id);
CREATE INDEX idx_pathway_executions_patient ON pathway_executions(patient_id);
CREATE INDEX idx_pathway_executions_status ON pathway_executions(step_status);
CREATE INDEX idx_pathway_executions_completed_at ON pathway_executions(completed_at);
```

### Pathway Variances Table
```sql
CREATE TABLE pathway_variances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_pathway_id UUID NOT NULL REFERENCES patient_pathways(id) ON DELETE CASCADE,
  patient_id UUID NOT NULL REFERENCES patients(id),
  variance_type VARCHAR(50) CHECK (variance_type IN (
    'step_skipped',
    'step_delayed',
    'step_modified',
    'additional_step',
    'order_changed',
    'timing_deviation',
    'sequence_change',
    'pathway_discontinued',
    'other'
  )),
  phase_id VARCHAR(100),
  step_id VARCHAR(100),
  step_name VARCHAR(255),
  variance_category VARCHAR(50) CHECK (variance_category IN (
    'patient_condition',
    'patient_preference',
    'clinical_judgment',
    'resource_unavailability',
    'system_issue',
    'protocol_issue',
    'complication',
    'other'
  )),
  variance_description TEXT NOT NULL,
  clinical_justification TEXT,
  impact_assessment VARCHAR(50) CHECK (impact_assessment IN (
    'none',
    'minor',
    'moderate',
    'major',
    'critical'
  )),
  corrective_action TEXT,
  documented_by UUID NOT NULL REFERENCES users(id),
  documented_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  reviewed_by UUID REFERENCES users(id),
  reviewed_at TIMESTAMP WITH TIME ZONE,
  review_notes TEXT,
  is_preventable BOOLEAN,
  requires_intervention BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_pathway_variances_patient_pathway ON pathway_variances(patient_pathway_id);
CREATE INDEX idx_pathway_variances_patient ON pathway_variances(patient_id);
CREATE INDEX idx_pathway_variances_type ON pathway_variances(variance_type);
CREATE INDEX idx_pathway_variances_category ON pathway_variances(variance_category);
CREATE INDEX idx_pathway_variances_documented_at ON pathway_variances(documented_at);
```

### Pathway Outcomes Table
```sql
CREATE TABLE pathway_outcomes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_pathway_id UUID NOT NULL REFERENCES patient_pathways(id) ON DELETE CASCADE,
  patient_id UUID NOT NULL REFERENCES patients(id),
  outcome_type VARCHAR(100) CHECK (outcome_type IN (
    'clinical',
    'quality',
    'safety',
    'efficiency',
    'cost',
    'patient_satisfaction',
    'functional_status'
  )),
  outcome_measure VARCHAR(255) NOT NULL,
  outcome_definition TEXT,
  target_value VARCHAR(100),
  actual_value VARCHAR(100),
  measurement_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  measured_by UUID REFERENCES users(id),
  outcome_met BOOLEAN,
  variance_from_target VARCHAR(100),
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_pathway_outcomes_patient_pathway ON pathway_outcomes(patient_pathway_id);
CREATE INDEX idx_pathway_outcomes_patient ON pathway_outcomes(patient_id);
CREATE INDEX idx_pathway_outcomes_type ON pathway_outcomes(outcome_type);
CREATE INDEX idx_pathway_outcomes_met ON pathway_outcomes(outcome_met);
```

### Pathway Templates Table
```sql
CREATE TABLE pathway_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_name VARCHAR(255) NOT NULL,
  template_category VARCHAR(100),
  condition VARCHAR(255) NOT NULL,
  template_structure JSONB NOT NULL, -- Reusable pathway template
  is_predefined BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT true,
  usage_count INTEGER DEFAULT 0,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_pathway_templates_category ON pathway_templates(template_category);
CREATE INDEX idx_pathway_templates_condition ON pathway_templates(condition);
```

---

## Backend Services

### ClinicalPathwayService
**Location:** `services/ehr-service/src/services/clinical-pathway.service.ts`

**Key Methods:**
- `createPathway(pathwayData, tenantDb)` - Create clinical pathway
- `getPathways(filters, tenantDb)` - Get pathway list
- `getPathwayById(id, tenantDb)` - Get pathway details
- `updatePathway(id, updates, tenantDb)` - Update pathway
- `activatePathway(id, tenantDb)` - Activate pathway version
- `deactivatePathway(id, tenantDb)` - Deactivate pathway
- `getPathwayVersions(pathwayCode, tenantDb)` - Get version history
- `duplicatePathway(id, tenantDb)` - Clone pathway
- `validatePathway(pathwayDefinition)` - Validate pathway structure
- `recommendPathways(patientId, diagnosis, tenantDb)` - Recommend pathways

### PatientPathwayService
**Location:** `services/ehr-service/src/services/patient-pathway.service.ts`

**Key Methods:**
- `activatePathway(patientId, pathwayId, activation Data, tenantDb)` - Activate for patient
- `getPatientPathways(patientId, filters, tenantDb)` - Get patient pathways
- `getPathwayProgress(patientPathwayId, tenantDb)` - Get progress details
- `updatePathwayProgress(patientPathwayId, updates, tenantDb)` - Update progress
- `completePhase(patientPathwayId, phaseId, tenantDb)` - Complete phase
- `advanceToNextStep(patientPathwayId, tenantDb)` - Move to next step
- `holdPathway(patientPathwayId, reason, tenantDb)` - Put pathway on hold
- `resumePathway(patientPathwayId, tenantDb)` - Resume pathway
- `discontinuePathway(patientPathwayId, reason, tenantDb)` - Discontinue
- `checkEligibility(patientId, pathwayId, tenantDb)` - Check eligibility
- `calculateCompletion(patientPathwayId, tenantDb)` - Calculate progress %

### PathwayExecutionService
**Location:** `services/ehr-service/src/services/pathway-execution.service.ts`

**Key Methods:**
- `executeStep(patientPathwayId, stepId, tenantDb)` - Execute pathway step
- `completeStep(executionId, completionData, tenantDb)` - Complete step
- `skipStep(executionId, reason, tenantDb)` - Skip step (variance)
- `getStepStatus(patientPathwayId, stepId, tenantDb)` - Get step status
- `getPendingSteps(patientPathwayId, tenantDb)` - Get pending steps
- `getOverdueSteps(patientPathwayId, tenantDb)` - Get overdue steps
- `linkOrderToStep(executionId, orderId, tenantDb)` - Link order
- `evaluateDecisionPoint(patientPathwayId, decisionId, answer, tenantDb)` - Evaluate decision

### PathwayVarianceService
**Location:** `services/ehr-service/src/services/pathway-variance.service.ts`

**Key Methods:**
- `recordVariance(varianceData, tenantDb)` - Record variance
- `getVariances(patientPathwayId, tenantDb)` - Get pathway variances
- `analyzeVariances(pathwayId, dateRange, tenantDb)` - Analyze patterns
- `reviewVariance(varianceId, reviewData, tenantDb)` - Review variance
- `getVarianceReport(filters, tenantDb)` - Generate variance report

### PathwayOutcomeService
**Location:** `services/ehr-service/src/services/pathway-outcome.service.ts`

**Key Methods:**
- `recordOutcome(outcomeData, tenantDb)` - Record outcome measurement
- `getOutcomes(patientPathwayId, tenantDb)` - Get pathway outcomes
- `calculateOutcomeRates(pathwayId, dateRange, tenantDb)` - Calculate rates
- `compareOutcomes(pathwayIds, tenantDb)` - Compare pathway outcomes
- `generateOutcomeReport(pathwayId, dateRange, tenantDb)` - Generate report

---

## API Endpoints

### Clinical Pathways
- `POST /clinical-pathways` - Create pathway
- `GET /clinical-pathways` - List pathways
- `GET /clinical-pathways/:id` - Get pathway details
- `PUT /clinical-pathways/:id` - Update pathway
- `POST /clinical-pathways/:id/activate` - Activate pathway
- `POST /clinical-pathways/:id/deactivate` - Deactivate pathway
- `GET /clinical-pathways/:id/versions` - Get versions
- `POST /clinical-pathways/:id/duplicate` - Clone pathway
- `POST /clinical-pathways/recommend` - Recommend pathways

### Patient Pathways
- `POST /patient-pathways/activate` - Activate pathway for patient
- `GET /patient-pathways/patient/:patientId` - Get patient pathways
- `GET /patient-pathways/:id` - Get pathway progress
- `PUT /patient-pathways/:id` - Update pathway
- `POST /patient-pathways/:id/complete-phase` - Complete phase
- `POST /patient-pathways/:id/advance` - Advance to next step
- `POST /patient-pathways/:id/hold` - Hold pathway
- `POST /patient-pathways/:id/resume` - Resume pathway
- `POST /patient-pathways/:id/discontinue` - Discontinue pathway
- `GET /patient-pathways/:id/eligibility` - Check eligibility

### Pathway Execution
- `POST /pathway-execution/execute-step` - Execute step
- `POST /pathway-execution/:id/complete` - Complete step
- `POST /pathway-execution/:id/skip` - Skip step
- `GET /pathway-execution/pending/:patientPathwayId` - Get pending steps
- `GET /pathway-execution/overdue/:patientPathwayId` - Get overdue steps
- `POST /pathway-execution/decision-point` - Evaluate decision

### Pathway Variances
- `POST /pathway-variances` - Record variance
- `GET /pathway-variances/:patientPathwayId` - Get variances
- `POST /pathway-variances/:id/review` - Review variance
- `GET /pathway-variances/analyze/:pathwayId` - Analyze patterns
- `GET /pathway-variances/report` - Generate report

### Pathway Outcomes
- `POST /pathway-outcomes` - Record outcome
- `GET /pathway-outcomes/:patientPathwayId` - Get outcomes
- `GET /pathway-outcomes/rates/:pathwayId` - Calculate rates
- `GET /pathway-outcomes/compare` - Compare outcomes
- `GET /pathway-outcomes/report/:pathwayId` - Generate report

---

## Frontend Components

### PathwayBuilder Component
**Location:** `ehr-frontend/src/components/PathwayBuilder.tsx`

**Features:**
- Visual pathway designer
- Drag-and-drop phases/steps
- Decision point configuration
- Timeline view
- Validation
- Preview mode
- Template import

### PathwayLibrary Component
**Location:** `ehr-frontend/src/components/PathwayLibrary.tsx`

**Features:**
- Browse pathways
- Filter by domain/type
- Search pathways
- View pathway details
- Activate/deactivate
- Usage statistics
- Version comparison

### PatientPathwayView Component
**Location:** `ehr-frontend/src/components/PatientPathwayView.tsx`

**Features:**
- Active pathway display
- Progress visualization
- Current phase/step
- Timeline view
- Pending tasks
- Variances list
- Quick actions

### PathwayProgressTracker Component
**Location:** `ehr-frontend/src/components/PathwayProgressTracker.tsx`

**Features:**
- Progress bar
- Phase milestones
- Completion checklist
- Overdue alerts
- Variance indicators
- On-track status

### VarianceReporting Component
**Location:** `ehr-frontend/src/components/VarianceReporting.tsx`

**Features:**
- Record variance
- Variance categorization
- Impact assessment
- Justification entry
- Variance analytics
- Trend analysis

### PathwayOutcomesDashboard Component
**Location:** `ehr-frontend/src/components/PathwayOutcomesDashboard.tsx`

**Features:**
- Outcome metrics
- Target vs actual
- Compliance rates
- Variance statistics
- Comparative analysis
- Export reports

---

## Pre-Built Clinical Pathways

### Acute Care Pathways
1. **Sepsis Management Pathway**
   - Early recognition and screening
   - Sepsis bundle (3-hour and 6-hour)
   - Antibiotic administration
   - Fluid resuscitation
   - Source control

2. **Stroke Pathway**
   - Rapid assessment (NIHSS)
   - CT/imaging
   - tPA decision and administration
   - Neuro monitoring
   - Early rehabilitation

3. **Acute Coronary Syndrome/STEMI**
   - ECG and troponin
   - Antiplatelet therapy
   - Cath lab activation
   - PCI or fibrinolysis
   - Post-MI care

4. **Acute Asthma Exacerbation**
   - Severity assessment
   - Bronchodilator therapy
   - Corticosteroids
   - Response monitoring

5. **Pneumonia Management**
   - CAP-specific antibiotics
   - Oxygenation
   - Hydration
   - Early mobilization

### Surgical Pathways
6. **Enhanced Recovery After Surgery (ERAS)**
   - Pre-operative optimization
   - Intra-operative protocol
   - Early feeding and mobilization
   - Pain management

7. **Hip/Knee Replacement**
   - Pre-surgical education
   - Standardized anesthesia
   - Mobilization protocol
   - PT/OT milestones

### Chronic Disease Management
8. **Heart Failure Management**
   - Daily weights
   - Medication optimization
   - Fluid management
   - Self-care education

9. **Diabetes Management**
   - Glycemic control
   - Complication screening
   - Education
   - Lifestyle modification

10. **COPD Management**
    - Medication adherence
    - Pulmonary rehabilitation
    - Action plan for exacerbations

---

## Testing Checklist

### Pathway Management
- [ ] Create clinical pathway
- [ ] Add phases and steps
- [ ] Configure decision points
- [ ] Set milestones
- [ ] Define outcomes
- [ ] Validate pathway structure
- [ ] Activate pathway
- [ ] Version control workflow

### Patient Pathway Activation
- [ ] Check patient eligibility
- [ ] Activate pathway for patient
- [ ] View pathway progress
- [ ] Execute steps
- [ ] Complete phase
- [ ] Advance to next step
- [ ] Hold pathway
- [ ] Resume pathway
- [ ] Discontinue pathway

### Pathway Execution
- [ ] View pending steps
- [ ] Execute step
- [ ] Complete step with notes
- [ ] Skip step (variance)
- [ ] Link order to step
- [ ] Evaluate decision point
- [ ] Automatic step progression

### Variance Management
- [ ] Record variance
- [ ] Categorize variance
- [ ] Add justification
- [ ] Review variance
- [ ] Analyze variance patterns
- [ ] Generate variance report

### Outcome Tracking
- [ ] Record outcome measurement
- [ ] Compare to target
- [ ] Calculate compliance rate
- [ ] Compare pathways
- [ ] Generate outcome report

---

## ⚠️ **CRITICAL IMPLEMENTATION GUIDELINES**

### **Database Provisioning**
- ✅ **Create provisioning bundle**: `sprint25_clinical_pathways`
- ✅ **Provisioning script**: `scripts/provision-sprint25-pathways.ts`
- ✅ **Seed pathways**: Include 10 essential clinical pathways
- ✅ **Pathway validation**: JSON schema validation

### **Integration Requirements**
- ✅ **Order integration**: Link pathway steps to orders
- ✅ **Documentation integration**: Link to clinical notes
- ✅ **Care plan integration**: Sync with existing care plans
- ✅ **Workflow engine**: Integrate with Sprint 16 workflow engine

### **Quality Assurance**
- ✅ **Evidence-based**: All pathways must have evidence references
- ✅ **Peer review**: Pathways require approval before activation
- ✅ **Version control**: Maintain pathway versions
- ✅ **Audit compliance**: Track all pathway activities

---

## Estimated Effort: 2-3 weeks

### Week 1
- Database schema
- Pathway builder tool
- Basic pathway execution

### Week 2
- Patient pathway activation
- Step execution and tracking
- Variance management

### Week 3
- Outcome tracking
- Reporting and analytics
- Pre-built pathways
- Testing and documentation

---

**Last Updated**: December 2, 2025  
**Priority**: CRITICAL ⭐⭐⭐  
**Status**: Ready for implementation

