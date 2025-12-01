-- HIPAA Audit Logs Table
-- This table stores comprehensive audit logs for all PHI access and modifications
-- Required for HIPAA compliance (45 CFR §164.308(a)(1)(ii)(D) and §164.312(b))

CREATE TABLE IF NOT EXISTS hipaa_audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID,
  user_name VARCHAR(255),
  user_role VARCHAR(50),
  action VARCHAR(100) NOT NULL,
  resource_type VARCHAR(100) NOT NULL,
  resource_id UUID,
  patient_id UUID,
  ip_address INET,
  user_agent TEXT,
  session_id VARCHAR(255),
  outcome VARCHAR(20) NOT NULL CHECK (outcome IN ('success', 'failure', 'denied')),
  reason TEXT,
  data_accessed JSONB,
  old_values JSONB,
  new_values JSONB,
  metadata JSONB,
  risk_level VARCHAR(20) CHECK (risk_level IN ('low', 'medium', 'high', 'critical')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_hipaa_audit_logs_user_id ON hipaa_audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_hipaa_audit_logs_patient_id ON hipaa_audit_logs(patient_id);
CREATE INDEX IF NOT EXISTS idx_hipaa_audit_logs_action ON hipaa_audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_hipaa_audit_logs_resource_type ON hipaa_audit_logs(resource_type);
CREATE INDEX IF NOT EXISTS idx_hipaa_audit_logs_created_at ON hipaa_audit_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_hipaa_audit_logs_outcome ON hipaa_audit_logs(outcome);
CREATE INDEX IF NOT EXISTS idx_hipaa_audit_logs_risk_level ON hipaa_audit_logs(risk_level);
CREATE INDEX IF NOT EXISTS idx_hipaa_audit_logs_session_id ON hipaa_audit_logs(session_id);

-- Composite indexes for common queries
CREATE INDEX IF NOT EXISTS idx_hipaa_audit_logs_patient_created ON hipaa_audit_logs(patient_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_hipaa_audit_logs_user_created ON hipaa_audit_logs(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_hipaa_audit_logs_action_created ON hipaa_audit_logs(action, created_at DESC);

-- Comments for documentation
COMMENT ON TABLE hipaa_audit_logs IS 'HIPAA-compliant audit log for all PHI access and modifications';
COMMENT ON COLUMN hipaa_audit_logs.user_id IS 'ID of the user who performed the action';
COMMENT ON COLUMN hipaa_audit_logs.user_name IS 'Name of the user who performed the action';
COMMENT ON COLUMN hipaa_audit_logs.user_role IS 'Role of the user who performed the action';
COMMENT ON COLUMN hipaa_audit_logs.action IS 'Type of action performed (e.g., patient_view, patient_update)';
COMMENT ON COLUMN hipaa_audit_logs.resource_type IS 'Type of resource accessed (e.g., patient, medical_record)';
COMMENT ON COLUMN hipaa_audit_logs.resource_id IS 'ID of the resource accessed';
COMMENT ON COLUMN hipaa_audit_logs.patient_id IS 'ID of the patient whose PHI was accessed';
COMMENT ON COLUMN hipaa_audit_logs.ip_address IS 'IP address of the user';
COMMENT ON COLUMN hipaa_audit_logs.user_agent IS 'User agent string from the request';
COMMENT ON COLUMN hipaa_audit_logs.session_id IS 'Session ID for tracking user sessions';
COMMENT ON COLUMN hipaa_audit_logs.outcome IS 'Outcome of the action: success, failure, or denied';
COMMENT ON COLUMN hipaa_audit_logs.reason IS 'Reason for failure or denial';
COMMENT ON COLUMN hipaa_audit_logs.data_accessed IS 'JSON object containing fields accessed and record count';
COMMENT ON COLUMN hipaa_audit_logs.old_values IS 'Previous values for update operations';
COMMENT ON COLUMN hipaa_audit_logs.new_values IS 'New values for update operations';
COMMENT ON COLUMN hipaa_audit_logs.metadata IS 'Additional metadata about the action';
COMMENT ON COLUMN hipaa_audit_logs.risk_level IS 'Risk level: low, medium, high, or critical';
COMMENT ON COLUMN hipaa_audit_logs.created_at IS 'Timestamp when the action occurred';


