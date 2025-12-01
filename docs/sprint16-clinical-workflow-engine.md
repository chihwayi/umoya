# Sprint 16: Clinical Workflow Engine

## Overview
Automated clinical workflows that streamline care processes and reduce manual work. This system will allow clinics to define custom workflows that automatically trigger actions based on events (e.g., "When patient checks in → auto-assign to triage → notify nurse").

## Goals
- Automate repetitive clinical processes
- Improve care coordination
- Reduce manual work for staff
- Ensure consistent care delivery
- Track workflow execution and outcomes

---

## Database Schema

### Workflow Definitions Table
```sql
CREATE TABLE clinical_workflows (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  description TEXT,
  trigger_event VARCHAR(100) NOT NULL CHECK (trigger_event IN (
    'patient_check_in',
    'appointment_scheduled',
    'appointment_started',
    'appointment_completed',
    'lab_result_received',
    'vitals_recorded',
    'prescription_created',
    'triage_completed',
    'referral_created',
    'custom'
  )),
  trigger_conditions JSONB, -- Conditions that must be met (e.g., {"priority": "urgent"})
  is_active BOOLEAN DEFAULT true,
  priority INTEGER DEFAULT 0, -- Execution order when multiple workflows match
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_workflows_trigger_event ON clinical_workflows(trigger_event);
CREATE INDEX idx_workflows_is_active ON clinical_workflows(is_active);
```

### Workflow Steps Table
```sql
CREATE TABLE workflow_steps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workflow_id UUID NOT NULL REFERENCES clinical_workflows(id) ON DELETE CASCADE,
  step_order INTEGER NOT NULL, -- Execution order within workflow
  step_type VARCHAR(50) NOT NULL CHECK (step_type IN (
    'assign_role',
    'send_notification',
    'create_task',
    'update_status',
    'create_order',
    'assign_appointment',
    'send_message',
    'execute_script',
    'wait',
    'condition'
  )),
  step_config JSONB NOT NULL, -- Step-specific configuration
  conditions JSONB, -- Conditions for step execution
  timeout_minutes INTEGER, -- Timeout for step completion
  retry_count INTEGER DEFAULT 0,
  is_required BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_workflow_steps_workflow_id ON workflow_steps(workflow_id);
CREATE INDEX idx_workflow_steps_order ON workflow_steps(workflow_id, step_order);
```

### Workflow Executions Table
```sql
CREATE TABLE workflow_executions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workflow_id UUID NOT NULL REFERENCES clinical_workflows(id),
  trigger_event VARCHAR(100) NOT NULL,
  trigger_entity_type VARCHAR(50) NOT NULL, -- 'appointment', 'patient', 'lab_order', etc.
  trigger_entity_id UUID NOT NULL,
  patient_id UUID REFERENCES patients(id),
  status VARCHAR(50) NOT NULL DEFAULT 'pending' CHECK (status IN (
    'pending',
    'running',
    'completed',
    'failed',
    'cancelled',
    'timeout'
  )),
  started_at TIMESTAMP WITH TIME ZONE,
  completed_at TIMESTAMP WITH TIME ZONE,
  error_message TEXT,
  execution_data JSONB, -- Context data passed through workflow
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_workflow_executions_workflow_id ON workflow_executions(workflow_id);
CREATE INDEX idx_workflow_executions_trigger ON workflow_executions(trigger_entity_type, trigger_entity_id);
CREATE INDEX idx_workflow_executions_patient_id ON workflow_executions(patient_id);
CREATE INDEX idx_workflow_executions_status ON workflow_executions(status);
CREATE INDEX idx_workflow_executions_created_at ON workflow_executions(created_at);
```

### Workflow Step Executions Table
```sql
CREATE TABLE workflow_step_executions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  execution_id UUID NOT NULL REFERENCES workflow_executions(id) ON DELETE CASCADE,
  step_id UUID NOT NULL REFERENCES workflow_steps(id),
  step_order INTEGER NOT NULL,
  status VARCHAR(50) NOT NULL DEFAULT 'pending' CHECK (status IN (
    'pending',
    'running',
    'completed',
    'failed',
    'skipped',
    'timeout'
  )),
  started_at TIMESTAMP WITH TIME ZONE,
  completed_at TIMESTAMP WITH TIME ZONE,
  result_data JSONB, -- Step execution results
  error_message TEXT,
  retry_count INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_step_executions_execution_id ON workflow_step_executions(execution_id);
CREATE INDEX idx_step_executions_step_id ON workflow_step_executions(step_id);
CREATE INDEX idx_step_executions_status ON workflow_step_executions(status);
```

### Workflow Templates Table
```sql
CREATE TABLE workflow_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  description TEXT,
  category VARCHAR(50), -- 'triage', 'appointment', 'lab', 'discharge', etc.
  template_data JSONB NOT NULL, -- Complete workflow definition
  is_default BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT true,
  usage_count INTEGER DEFAULT 0,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_workflow_templates_category ON workflow_templates(category);
CREATE INDEX idx_workflow_templates_is_active ON workflow_templates(is_active);
```

---

## Backend Services

### ClinicalWorkflowService
**Location:** `services/ehr-service/src/services/clinical-workflow.service.ts`

**Key Methods:**
- `createWorkflow(workflowData, tenantDb)` - Create new workflow
- `updateWorkflow(workflowId, updates, tenantDb)` - Update workflow
- `deleteWorkflow(workflowId, tenantDb)` - Delete workflow
- `getWorkflows(filters, tenantDb)` - List workflows
- `getWorkflowById(workflowId, tenantDb)` - Get workflow details
- `executeWorkflow(triggerEvent, triggerData, tenantDb)` - Execute workflow
- `getWorkflowExecutions(filters, tenantDb)` - Get execution history
- `createWorkflowFromTemplate(templateId, tenantDb)` - Create workflow from template
- `getWorkflowTemplates(category, tenantDb)` - Get workflow templates
- `pauseWorkflow(workflowId, tenantDb)` - Pause workflow execution
- `resumeWorkflow(workflowId, tenantDb)` - Resume workflow execution

**Workflow Step Types Implementation:**
- `assignRole` - Assign patient/appointment to specific role
- `sendNotification` - Send notification to users
- `createTask` - Create task for user
- `updateStatus` - Update entity status
- `createOrder` - Create lab/imaging order
- `assignAppointment` - Auto-assign appointment
- `sendMessage` - Send secure message
- `wait` - Wait for condition or time
- `condition` - Conditional branching

---

## API Endpoints

### Workflow Management
- `POST /workflows` - Create workflow
- `GET /workflows` - List workflows (with filters)
- `GET /workflows/:id` - Get workflow details
- `PUT /workflows/:id` - Update workflow
- `DELETE /workflows/:id` - Delete workflow
- `POST /workflows/:id/activate` - Activate workflow
- `POST /workflows/:id/deactivate` - Deactivate workflow
- `POST /workflows/:id/duplicate` - Duplicate workflow

### Workflow Execution
- `POST /workflows/execute` - Manually trigger workflow
- `GET /workflows/executions` - Get execution history
- `GET /workflows/executions/:id` - Get execution details
- `POST /workflows/executions/:id/cancel` - Cancel execution
- `GET /workflows/executions/:id/steps` - Get step execution details

### Workflow Templates
- `GET /workflows/templates` - Get workflow templates
- `GET /workflows/templates/:id` - Get template details
- `POST /workflows/templates/:id/apply` - Create workflow from template
- `POST /workflows/templates` - Create custom template

### Workflow Analytics
- `GET /workflows/analytics` - Get workflow analytics
- `GET /workflows/:id/analytics` - Get workflow-specific analytics

---

## Frontend Components

### WorkflowBuilder Component
**Location:** `ehr-frontend/src/components/WorkflowBuilder.tsx`

**Features:**
- Visual workflow designer (drag-and-drop)
- Step configuration forms
- Condition builder
- Workflow testing/preview
- Workflow templates library

### WorkflowList Component
**Location:** `ehr-frontend/src/components/WorkflowList.tsx`

**Features:**
- List all workflows
- Filter by trigger event, status
- Activate/deactivate workflows
- View execution history
- Duplicate workflows

### WorkflowExecutionViewer Component
**Location:** `ehr-frontend/src/components/WorkflowExecutionViewer.tsx`

**Features:**
- View execution timeline
- Step-by-step execution status
- Error details
- Retry failed steps
- Cancel execution

### WorkflowTemplates Component
**Location:** `ehr-frontend/src/components/WorkflowTemplates.tsx`

**Features:**
- Browse workflow templates
- Preview template steps
- Apply template to create workflow
- Create custom templates

---

## Default Workflow Templates

1. **Patient Check-In Workflow**
   - Trigger: `patient_check_in`
   - Steps:
     1. Assign to triage queue
     2. Notify nurse
     3. Create vitals task
     4. Update appointment status

2. **Urgent Appointment Workflow**
   - Trigger: `appointment_scheduled` (priority: urgent)
   - Steps:
     1. Notify doctor immediately
     2. Create preparation task
     3. Reserve resources
     4. Send patient reminder

3. **Lab Result Received Workflow**
   - Trigger: `lab_result_received` (status: critical)
   - Steps:
     1. Alert doctor
     2. Create review task
     3. Notify patient (if configured)
     4. Update patient record

4. **Discharge Workflow**
   - Trigger: `appointment_completed` (type: discharge)
   - Steps:
     1. Generate discharge summary
     2. Create follow-up appointment
     3. Send discharge instructions
     4. Update patient status

---

## Integration Points

- **Appointment Service** - Trigger on appointment events
- **Triage Service** - Trigger on triage completion
- **Lab Service** - Trigger on lab result received
- **Notification Service** - Send notifications
- **Task Service** - Create tasks
- **Order Service** - Create orders

---

## Testing Checklist

- [x] Create workflow from template (UI works, needs end-to-end test)
- [ ] Create custom workflow (WorkflowBuilder exists, needs full test)
- [x] Test workflow execution (Manual test execution working)
- [ ] Test conditional steps (Logic exists, needs test)
- [ ] Test workflow timeout (Logic exists, needs test)
- [ ] Test error handling (Error handling exists, needs test)
- [ ] Test workflow deactivation (Activate/deactivate works, needs test)
- [x] Test execution history (Viewer works, needs full test)
- [ ] Test workflow analytics (Not implemented yet)

## Current Implementation Status (Dec 2, 2025)

### ✅ Completed
- Database schema provisioned on `bulawayo-general`
- Backend service (`ClinicalWorkflowService`) implemented
- Core API endpoints working
- Frontend components: `WorkflowList`, `WorkflowBuilder`, `WorkflowExecutionViewer`
- Workflow templates seeded (4 default templates)
- Integration with Appointment, Vitals, HL7, Prescription, Triage services
- Modern `ConfirmDialog` component created (replaced JavaScript alerts)

### ❌ Missing Features
- Workflow Analytics endpoints (`GET /workflows/analytics`, `GET /workflows/:id/analytics`)
- Cancel execution functionality (endpoint exists, needs testing)
- Retry failed steps functionality
- Create custom template endpoint (`POST /workflows/templates`)
- Workflow preview mode in builder

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

## Estimated Effort: 4-6 weeks

