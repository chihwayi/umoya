-- Sprint A1: Post-Visit Audit Chain-of-Custody + Prompt/Model Audit
-- Date: 2026-03-06
-- Description:
--   1) Hardens HIPAA audit logs with append-only constraints and additional custody metadata
--   2) Adds prompt/model governance tables for grounded LLM auditability
--   3) Adds daily audit integrity snapshot table for tamper-detection workflows

CREATE EXTENSION IF NOT EXISTS pgcrypto;

ALTER TABLE IF EXISTS hipaa_audit_logs
  ADD COLUMN IF NOT EXISTS event_type VARCHAR(80),
  ADD COLUMN IF NOT EXISTS operation VARCHAR(20)
    CHECK (operation IN ('READ', 'WRITE', 'DELETE', 'EXPORT', 'PRINT', 'SHARE')),
  ADD COLUMN IF NOT EXISTS data_classification VARCHAR(20)
    CHECK (data_classification IN ('PHI', 'CLINICAL', 'BILLING', 'ADMIN')),
  ADD COLUMN IF NOT EXISTS request_id VARCHAR(120),
  ADD COLUMN IF NOT EXISTS ip_address_hash TEXT,
  ADD COLUMN IF NOT EXISTS changes_delta JSONB,
  ADD COLUMN IF NOT EXISTS immutable BOOLEAN NOT NULL DEFAULT TRUE;

UPDATE hipaa_audit_logs
SET immutable = TRUE
WHERE immutable IS DISTINCT FROM TRUE;

CREATE INDEX IF NOT EXISTS idx_hipaa_audit_event_type ON hipaa_audit_logs(event_type);
CREATE INDEX IF NOT EXISTS idx_hipaa_audit_operation ON hipaa_audit_logs(operation);
CREATE INDEX IF NOT EXISTS idx_hipaa_audit_data_classification ON hipaa_audit_logs(data_classification);
CREATE INDEX IF NOT EXISTS idx_hipaa_audit_request_id ON hipaa_audit_logs(request_id);

CREATE TABLE IF NOT EXISTS audit_integrity_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  audit_date DATE NOT NULL UNIQUE,
  event_count INTEGER NOT NULL DEFAULT 0,
  merkle_root_hash TEXT NOT NULL,
  chain_hash TEXT,
  generated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  generated_by UUID REFERENCES users(id) ON DELETE SET NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_audit_integrity_generated_at ON audit_integrity_log(generated_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_integrity_date ON audit_integrity_log(audit_date DESC);

CREATE TABLE IF NOT EXISTS model_registry (
  model_id TEXT PRIMARY KEY,
  model_name TEXT NOT NULL,
  model_version TEXT NOT NULL,
  provider TEXT NOT NULL DEFAULT 'local',
  status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'retired', 'testing')),
  sha256_hash TEXT,
  benchmark_scores JSONB NOT NULL DEFAULT '[]'::jsonb,
  deployed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  retired_at TIMESTAMP WITH TIME ZONE,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_model_registry_status ON model_registry(status);
CREATE INDEX IF NOT EXISTS idx_model_registry_model_name ON model_registry(model_name);
CREATE INDEX IF NOT EXISTS idx_model_registry_deployed_at ON model_registry(deployed_at DESC);

CREATE TABLE IF NOT EXISTS prompt_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  prompt_hash TEXT NOT NULL,
  template_version TEXT NOT NULL DEFAULT 'v1',
  model_id TEXT NOT NULL REFERENCES model_registry(model_id) ON DELETE RESTRICT,
  session_id UUID REFERENCES post_visit_sessions(id) ON DELETE SET NULL,
  patient_id UUID REFERENCES patients(id) ON DELETE SET NULL,
  encounter_id UUID,
  actor_id UUID REFERENCES users(id) ON DELETE SET NULL,
  actor_role VARCHAR(40),
  input_token_count INTEGER NOT NULL DEFAULT 0,
  output_token_count INTEGER NOT NULL DEFAULT 0,
  latency_ms INTEGER NOT NULL DEFAULT 0,
  safety_gate_triggered BOOLEAN NOT NULL DEFAULT FALSE,
  request_id VARCHAR(120),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_prompt_audit_prompt_hash ON prompt_audit_log(prompt_hash);
CREATE INDEX IF NOT EXISTS idx_prompt_audit_model_id ON prompt_audit_log(model_id);
CREATE INDEX IF NOT EXISTS idx_prompt_audit_patient_id ON prompt_audit_log(patient_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_prompt_audit_session_id ON prompt_audit_log(session_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_prompt_audit_created_at ON prompt_audit_log(created_at DESC);

CREATE OR REPLACE FUNCTION prevent_hipaa_audit_logs_mutation()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'hipaa_audit_logs is append-only and cannot be %', TG_OP;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_prevent_hipaa_audit_logs_update ON hipaa_audit_logs;
CREATE TRIGGER trg_prevent_hipaa_audit_logs_update
  BEFORE UPDATE ON hipaa_audit_logs
  FOR EACH ROW
  EXECUTE FUNCTION prevent_hipaa_audit_logs_mutation();

DROP TRIGGER IF EXISTS trg_prevent_hipaa_audit_logs_delete ON hipaa_audit_logs;
CREATE TRIGGER trg_prevent_hipaa_audit_logs_delete
  BEFORE DELETE ON hipaa_audit_logs
  FOR EACH ROW
  EXECUTE FUNCTION prevent_hipaa_audit_logs_mutation();

