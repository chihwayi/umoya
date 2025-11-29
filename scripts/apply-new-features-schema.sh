#!/bin/bash

# Script to apply new features schema (HIPAA audit logs, quality measures) to tenant databases

DB_USERNAME="${DB_USERNAME:-medicore}"
DB_PASSWORD="${DB_PASSWORD:-medicore_password}"
CONTAINER_NAME="medicore-postgres-master"
TENANT_DB="${1:-clinic_bulawayo-general_db}"

echo "=========================================="
echo "Applying new features schema to: $TENANT_DB"
echo "=========================================="

docker exec -i $CONTAINER_NAME psql -U $DB_USERNAME -d "$TENANT_DB" <<EOF

-- HIPAA-compliant audit logging table
CREATE TABLE IF NOT EXISTS hipaa_audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    user_name VARCHAR(255),
    user_role VARCHAR(50),
    action VARCHAR(100) NOT NULL,
    resource_type VARCHAR(100) NOT NULL,
    resource_id UUID,
    patient_id UUID REFERENCES patients(id) ON DELETE SET NULL,
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

-- HIPAA audit log indexes
CREATE INDEX IF NOT EXISTS idx_hipaa_audit_user_id ON hipaa_audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_hipaa_audit_patient_id ON hipaa_audit_logs(patient_id);
CREATE INDEX IF NOT EXISTS idx_hipaa_audit_action ON hipaa_audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_hipaa_audit_resource_type ON hipaa_audit_logs(resource_type);
CREATE INDEX IF NOT EXISTS idx_hipaa_audit_outcome ON hipaa_audit_logs(outcome);
CREATE INDEX IF NOT EXISTS idx_hipaa_audit_risk_level ON hipaa_audit_logs(risk_level);
CREATE INDEX IF NOT EXISTS idx_hipaa_audit_created_at ON hipaa_audit_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_hipaa_audit_session_id ON hipaa_audit_logs(session_id);
CREATE INDEX IF NOT EXISTS idx_hipaa_audit_user_patient ON hipaa_audit_logs(user_id, patient_id);
CREATE INDEX IF NOT EXISTS idx_hipaa_audit_date_range ON hipaa_audit_logs(created_at, patient_id);

-- Quality Measures Results Table
CREATE TABLE IF NOT EXISTS quality_measure_results (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    measure_id VARCHAR(100) NOT NULL,
    measure_name TEXT NOT NULL,
    period_start DATE NOT NULL,
    period_end DATE NOT NULL,
    denominator INTEGER NOT NULL DEFAULT 0,
    numerator INTEGER NOT NULL DEFAULT 0,
    exclusions INTEGER NOT NULL DEFAULT 0,
    rate DECIMAL(5,2) NOT NULL,
    benchmark DECIMAL(5,2),
    status VARCHAR(20) CHECK (status IN ('met', 'not_met', 'partial')),
    numerator_patients TEXT[],
    denominator_patients TEXT[],
    exclusion_patients TEXT[],
    calculated_by UUID REFERENCES users(id) ON DELETE SET NULL,
    calculated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Quality measure indexes
CREATE INDEX IF NOT EXISTS idx_quality_measure_id ON quality_measure_results(measure_id);
CREATE INDEX IF NOT EXISTS idx_quality_measure_period ON quality_measure_results(period_start, period_end);
CREATE INDEX IF NOT EXISTS idx_quality_measure_status ON quality_measure_results(status);
CREATE INDEX IF NOT EXISTS idx_quality_measure_calculated_at ON quality_measure_results(calculated_at);

EOF

if [ $? -eq 0 ]; then
    echo "✅ Schema applied successfully to $TENANT_DB"
else
    echo "❌ Failed to apply schema to $TENANT_DB"
    exit 1
fi


