-- Sprint 46: Nurse Copilot Persistence (Wave 6)
-- Adds tenant-scoped persistence tables for nurse task/alert state and handoff workflow lifecycle.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS nurse_copilot_task_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  task_id VARCHAR(120) NOT NULL,
  patient_id UUID REFERENCES patients(id) ON DELETE SET NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'completed' CHECK (status IN ('completed')),
  reason TEXT,
  context JSONB,
  source VARCHAR(50) NOT NULL DEFAULT 'nurse_worklist',
  completed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, task_id)
);

CREATE TABLE IF NOT EXISTS nurse_copilot_alert_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  alert_id VARCHAR(120) NOT NULL,
  patient_id UUID REFERENCES patients(id) ON DELETE SET NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'acknowledged' CHECK (status IN ('acknowledged')),
  reason TEXT,
  context JSONB,
  source VARCHAR(50) NOT NULL DEFAULT 'nurse_worklist',
  acknowledged_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, alert_id)
);

CREATE TABLE IF NOT EXISTS nurse_handoff_workflow_state (
  patient_id UUID PRIMARY KEY REFERENCES patients(id) ON DELETE CASCADE,
  status VARCHAR(20) NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'finalized', 'reviewed', 'shared')),
  finalized_by UUID REFERENCES users(id) ON DELETE SET NULL,
  finalized_at TIMESTAMP WITH TIME ZONE,
  finalized_summary_preview TEXT,
  finalize_reason TEXT,
  finalize_context JSONB,
  reviewed_by UUID REFERENCES users(id) ON DELETE SET NULL,
  reviewed_at TIMESTAMP WITH TIME ZONE,
  reviewer_name VARCHAR(255),
  reviewer_role VARCHAR(100),
  review_reason TEXT,
  review_context JSONB,
  shared_by UUID REFERENCES users(id) ON DELETE SET NULL,
  shared_at TIMESTAMP WITH TIME ZONE,
  share_channel VARCHAR(50),
  share_recipient VARCHAR(255),
  share_reason TEXT,
  share_context JSONB,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_nurse_task_events_user_status ON nurse_copilot_task_events(user_id, status);
CREATE INDEX IF NOT EXISTS idx_nurse_task_events_patient ON nurse_copilot_task_events(patient_id);
CREATE INDEX IF NOT EXISTS idx_nurse_task_events_completed_at ON nurse_copilot_task_events(completed_at DESC);

CREATE INDEX IF NOT EXISTS idx_nurse_alert_events_user_status ON nurse_copilot_alert_events(user_id, status);
CREATE INDEX IF NOT EXISTS idx_nurse_alert_events_patient ON nurse_copilot_alert_events(patient_id);
CREATE INDEX IF NOT EXISTS idx_nurse_alert_events_ack_at ON nurse_copilot_alert_events(acknowledged_at DESC);

CREATE INDEX IF NOT EXISTS idx_nurse_handoff_status ON nurse_handoff_workflow_state(status);
CREATE INDEX IF NOT EXISTS idx_nurse_handoff_finalized_at ON nurse_handoff_workflow_state(finalized_at DESC);
CREATE INDEX IF NOT EXISTS idx_nurse_handoff_shared_at ON nurse_handoff_workflow_state(shared_at DESC);

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS update_nurse_copilot_task_events_updated_at ON nurse_copilot_task_events;
CREATE TRIGGER update_nurse_copilot_task_events_updated_at
BEFORE UPDATE ON nurse_copilot_task_events
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_nurse_copilot_alert_events_updated_at ON nurse_copilot_alert_events;
CREATE TRIGGER update_nurse_copilot_alert_events_updated_at
BEFORE UPDATE ON nurse_copilot_alert_events
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_nurse_handoff_workflow_state_updated_at ON nurse_handoff_workflow_state;
CREATE TRIGGER update_nurse_handoff_workflow_state_updated_at
BEFORE UPDATE ON nurse_handoff_workflow_state
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();
