-- Migration 037: Post-Visit AI Companion Executable Recommendation Actions (Sprint 3)
-- Date: March 5, 2026
-- Description:
--   Adds idempotent execution persistence for recommendation bundle actions.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS post_visit_action_executions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES post_visit_sessions(id) ON DELETE CASCADE,
  recommendation_id VARCHAR(120) NOT NULL,
  action_key VARCHAR(160) NOT NULL,
  action_type VARCHAR(60) NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'executed' CHECK (status IN ('executed','failed','skipped')),
  execution_note TEXT,
  result_resource_type VARCHAR(80),
  result_resource_id VARCHAR(120),
  result_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  error_message TEXT,
  executed_by UUID REFERENCES users(id) ON DELETE SET NULL,
  executed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  source VARCHAR(80) NOT NULL DEFAULT 'post_visit_execute',
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  UNIQUE(session_id, recommendation_id, action_key)
);

CREATE INDEX IF NOT EXISTS idx_post_visit_action_executions_session
  ON post_visit_action_executions(session_id, recommendation_id);
CREATE INDEX IF NOT EXISTS idx_post_visit_action_executions_status
  ON post_visit_action_executions(status, executed_at DESC);

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS update_post_visit_action_executions_updated_at ON post_visit_action_executions;
CREATE TRIGGER update_post_visit_action_executions_updated_at
BEFORE UPDATE ON post_visit_action_executions
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();
