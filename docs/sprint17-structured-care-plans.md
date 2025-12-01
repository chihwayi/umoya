# Sprint 17: Structured Care Plans

## Overview
Structured care plans with templates, goals, measurable outcomes, and progress tracking. Essential for chronic disease management and care coordination.

## Goals
- Standardize care delivery through templates
- Track care plan goals and outcomes
- Improve care coordination
- Monitor patient progress
- Support chronic disease management

---

## Database Schema

### Care Plan Templates Table
```sql
CREATE TABLE care_plan_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  description TEXT,
  category VARCHAR(50) NOT NULL CHECK (category IN (
    'chronic_disease',
    'post_surgery',
    'preventive_care',
    'mental_health',
    'maternity',
    'pediatric',
    'geriatric',
    'rehabilitation',
    'palliative',
    'general'
  )),
  condition_code VARCHAR(50), -- SNOMED/ICD-10 code
  condition_name VARCHAR(255),
  template_data JSONB NOT NULL, -- Complete care plan structure
  is_default BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT true,
  usage_count INTEGER DEFAULT 0,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_care_plan_templates_category ON care_plan_templates(category);
CREATE INDEX idx_care_plan_templates_condition ON care_plan_templates(condition_code);
CREATE INDEX idx_care_plan_templates_is_active ON care_plan_templates(is_active);
```

### Care Plans Table
```sql
CREATE TABLE care_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  template_id UUID REFERENCES care_plan_templates(id),
  name VARCHAR(255) NOT NULL,
  description TEXT,
  category VARCHAR(50) NOT NULL,
  status VARCHAR(50) NOT NULL DEFAULT 'active' CHECK (status IN (
    'draft',
    'active',
    'on_hold',
    'completed',
    'cancelled'
  )),
  start_date DATE NOT NULL,
  end_date DATE,
  target_completion_date DATE,
  primary_provider_id UUID REFERENCES users(id),
  care_team JSONB DEFAULT '[]'::jsonb, -- Array of user IDs
  diagnosis_codes TEXT[], -- Related diagnoses
  notes TEXT,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_care_plans_patient_id ON care_plans(patient_id);
CREATE INDEX idx_care_plans_status ON care_plans(status);
CREATE INDEX idx_care_plans_primary_provider ON care_plans(primary_provider_id);
CREATE INDEX idx_care_plans_start_date ON care_plans(start_date);
```

### Care Plan Goals Table
```sql
CREATE TABLE care_plan_goals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  care_plan_id UUID NOT NULL REFERENCES care_plans(id) ON DELETE CASCADE,
  goal_number INTEGER NOT NULL,
  goal_text TEXT NOT NULL,
  goal_type VARCHAR(50) NOT NULL CHECK (goal_type IN (
    'clinical',
    'functional',
    'behavioral',
    'quality_of_life',
    'symptom_management',
    'preventive',
    'education'
  )),
  target_value VARCHAR(255), -- e.g., "HbA1c < 7%", "Weight loss 10kg"
  current_value VARCHAR(255),
  measurement_unit VARCHAR(50),
  target_date DATE,
  status VARCHAR(50) NOT NULL DEFAULT 'in_progress' CHECK (status IN (
    'not_started',
    'in_progress',
    'achieved',
    'partially_achieved',
    'not_achieved',
    'on_hold'
  )),
  priority VARCHAR(20) DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_care_plan_goals_care_plan_id ON care_plan_goals(care_plan_id);
CREATE INDEX idx_care_plan_goals_status ON care_plan_goals(status);
CREATE INDEX idx_care_plan_goals_target_date ON care_plan_goals(target_date);
```

### Care Plan Interventions Table
```sql
CREATE TABLE care_plan_interventions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  care_plan_id UUID NOT NULL REFERENCES care_plans(id) ON DELETE CASCADE,
  goal_id UUID REFERENCES care_plan_goals(id) ON DELETE CASCADE,
  intervention_number INTEGER NOT NULL,
  intervention_text TEXT NOT NULL,
  intervention_type VARCHAR(50) NOT NULL CHECK (intervention_type IN (
    'medication',
    'therapy',
    'education',
    'lifestyle',
    'monitoring',
    'referral',
    'procedure',
    'counseling',
    'other'
  )),
  frequency VARCHAR(100),
  duration VARCHAR(100),
  responsible_role VARCHAR(50), -- 'doctor', 'nurse', 'patient', etc.
  assigned_to UUID REFERENCES users(id),
  status VARCHAR(50) NOT NULL DEFAULT 'pending' CHECK (status IN (
    'pending',
    'in_progress',
    'completed',
    'cancelled',
    'on_hold'
  )),
  start_date DATE,
  end_date DATE,
  completion_date DATE,
  outcome_notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_care_plan_interventions_care_plan_id ON care_plan_interventions(care_plan_id);
CREATE INDEX idx_care_plan_interventions_goal_id ON care_plan_interventions(goal_id);
CREATE INDEX idx_care_plan_interventions_status ON care_plan_interventions(status);
CREATE INDEX idx_care_plan_interventions_assigned_to ON care_plan_interventions(assigned_to);
```

### Care Plan Progress Log Table
```sql
CREATE TABLE care_plan_progress_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  care_plan_id UUID NOT NULL REFERENCES care_plans(id) ON DELETE CASCADE,
  goal_id UUID REFERENCES care_plan_goals(id) ON DELETE CASCADE,
  intervention_id UUID REFERENCES care_plan_interventions(id) ON DELETE CASCADE,
  progress_date DATE NOT NULL,
  progress_type VARCHAR(50) NOT NULL CHECK (progress_type IN (
    'goal_update',
    'intervention_completed',
    'milestone_reached',
    'status_change',
    'note'
  )),
  current_value VARCHAR(255),
  progress_percentage INTEGER CHECK (progress_percentage >= 0 AND progress_percentage <= 100),
  notes TEXT,
  recorded_by UUID REFERENCES users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_care_plan_progress_care_plan_id ON care_plan_progress_log(care_plan_id);
CREATE INDEX idx_care_plan_progress_goal_id ON care_plan_progress_log(goal_id);
CREATE INDEX idx_care_plan_progress_date ON care_plan_progress_log(progress_date);
```

### Care Plan Outcomes Table
```sql
CREATE TABLE care_plan_outcomes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  care_plan_id UUID NOT NULL REFERENCES care_plans(id) ON DELETE CASCADE,
  outcome_date DATE NOT NULL,
  outcome_type VARCHAR(50) NOT NULL CHECK (outcome_type IN (
    'clinical_improvement',
    'symptom_reduction',
    'functional_improvement',
    'goal_achieved',
    'no_change',
    'deterioration',
    'complication'
  )),
  measurement_value VARCHAR(255),
  measurement_unit VARCHAR(50),
  baseline_value VARCHAR(255),
  improvement_percentage DECIMAL(5,2),
  notes TEXT,
  assessed_by UUID REFERENCES users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_care_plan_outcomes_care_plan_id ON care_plan_outcomes(care_plan_id);
CREATE INDEX idx_care_plan_outcomes_date ON care_plan_outcomes(outcome_date);
```

---

## Backend Services

### CarePlanService
**Location:** `services/ehr-service/src/services/care-plan.service.ts`

**Key Methods:**
- `createCarePlan(patientId, planData, tenantDb)` - Create care plan
- `updateCarePlan(planId, updates, tenantDb)` - Update care plan
- `getCarePlans(patientId, filters, tenantDb)` - Get patient care plans
- `getCarePlanById(planId, tenantDb)` - Get care plan details
- `addGoal(planId, goalData, tenantDb)` - Add goal to care plan
- `updateGoal(goalId, updates, tenantDb)` - Update goal
- `addIntervention(planId, interventionData, tenantDb)` - Add intervention
- `updateIntervention(interventionId, updates, tenantDb)` - Update intervention
- `recordProgress(planId, progressData, tenantDb)` - Record progress
- `getCarePlanProgress(planId, tenantDb)` - Get progress history
- `assessOutcome(planId, outcomeData, tenantDb)` - Assess outcome
- `completeCarePlan(planId, tenantDb)` - Complete care plan

### CarePlanTemplateService
**Location:** `services/ehr-service/src/services/care-plan-template.service.ts`

**Key Methods:**
- `createTemplate(templateData, tenantDb)` - Create template
- `getTemplates(category, tenantDb)` - Get templates
- `getTemplateById(templateId, tenantDb)` - Get template details
- `applyTemplate(templateId, patientId, customizations, tenantDb)` - Create care plan from template
- `updateTemplate(templateId, updates, tenantDb)` - Update template

---

## API Endpoints

### Care Plan Management
- `POST /care-plans` - Create care plan
- `GET /care-plans` - List care plans (with filters)
- `GET /care-plans/:id` - Get care plan details
- `PUT /care-plans/:id` - Update care plan
- `DELETE /care-plans/:id` - Delete care plan
- `POST /care-plans/:id/complete` - Complete care plan
- `POST /care-plans/:id/activate` - Activate care plan
- `POST /care-plans/:id/hold` - Put care plan on hold

### Care Plan Goals
- `POST /care-plans/:id/goals` - Add goal
- `PUT /care-plans/goals/:goalId` - Update goal
- `DELETE /care-plans/goals/:goalId` - Delete goal
- `POST /care-plans/goals/:goalId/achieve` - Mark goal as achieved

### Care Plan Interventions
- `POST /care-plans/:id/interventions` - Add intervention
- `PUT /care-plans/interventions/:interventionId` - Update intervention
- `DELETE /care-plans/interventions/:interventionId` - Delete intervention
- `POST /care-plans/interventions/:interventionId/complete` - Complete intervention

### Care Plan Progress
- `POST /care-plans/:id/progress` - Record progress
- `GET /care-plans/:id/progress` - Get progress history
- `POST /care-plans/:id/outcomes` - Assess outcome
- `GET /care-plans/:id/outcomes` - Get outcomes

### Care Plan Templates
- `GET /care-plans/templates` - Get templates
- `GET /care-plans/templates/:id` - Get template details
- `POST /care-plans/templates` - Create template
- `PUT /care-plans/templates/:id` - Update template
- `POST /care-plans/templates/:id/apply` - Apply template to patient

---

## Frontend Components

### CarePlanBuilder Component
**Location:** `ehr-frontend/src/components/CarePlanBuilder.tsx`

**Features:**
- Create/edit care plan
- Add/remove goals
- Add/remove interventions
- Set target dates
- Assign care team
- Link to diagnoses

### CarePlanViewer Component
**Location:** `ehr-frontend/src/components/CarePlanViewer.tsx`

**Features:**
- View care plan details
- Progress visualization
- Goal status indicators
- Intervention tracking
- Outcome history
- Timeline view

### CarePlanTemplates Component
**Location:** `ehr-frontend/src/components/CarePlanTemplates.tsx`

**Features:**
- Browse templates by category
- Preview template structure
- Apply template to patient
- Create custom templates

### CarePlanProgress Component
**Location:** `ehr-frontend/src/components/CarePlanProgress.tsx`

**Features:**
- Record progress updates
- Update goal values
- Mark interventions complete
- Add progress notes
- View progress charts

---

## Default Care Plan Templates

1. **Diabetes Management Plan**
   - Goals: HbA1c < 7%, Weight management, Blood pressure control
   - Interventions: Medication adherence, Diet counseling, Exercise program, Glucose monitoring

2. **Hypertension Care Plan**
   - Goals: BP < 140/90, Medication adherence, Lifestyle changes
   - Interventions: Medication, Diet modification, Exercise, Regular monitoring

3. **Post-Surgery Recovery Plan**
   - Goals: Wound healing, Pain management, Mobility restoration
   - Interventions: Wound care, Pain medication, Physical therapy, Follow-up visits

4. **Mental Health Care Plan**
   - Goals: Symptom reduction, Medication adherence, Therapy attendance
   - Interventions: Medication, Counseling, Support groups, Regular monitoring

---

## Integration Points

- **Problem Service** - Link to diagnoses
- **Prescription Service** - Link interventions to medications
- **Appointment Service** - Schedule follow-ups
- **Notification Service** - Alert care team
- **Task Service** - Create tasks for interventions
- **Vitals Service** - Track goal measurements

---

## Testing Checklist

- [ ] Create care plan from template
- [ ] Create custom care plan
- [ ] Add/update goals
- [ ] Add/update interventions
- [ ] Record progress
- [ ] Assess outcomes
- [ ] Complete care plan
- [ ] View care plan history
- [ ] Care team assignment
- [ ] Progress visualization


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

## Estimated Effort: 5-7 weeks

