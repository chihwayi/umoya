#!/bin/bash

# Script to apply Health Records Export schema to existing tenant databases
# This applies the sprint13_6_health_records_export bundle

DB_USERNAME="${DB_USERNAME:-medicore}"
DB_PASSWORD="${DB_PASSWORD:-medicore_password}"
DB_HOST="${DB_HOST:-localhost}"
DB_PORT="${DB_PORT:-5432}"
CONTAINER_NAME="${CONTAINER_NAME:-medicore-postgres-master}"

echo "=========================================="
echo "Applying Health Records Export Schema"
echo "=========================================="
echo ""

# Check if running in Docker or locally
if docker ps | grep -q "$CONTAINER_NAME"; then
  echo "✅ Found Docker container: $CONTAINER_NAME"
  USE_DOCKER=true
else
  echo "⚠️  Docker container not found, using local PostgreSQL"
  USE_DOCKER=false
fi

# Get list of tenant databases
echo ""
echo "Fetching list of tenant databases..."
if [ "$USE_DOCKER" = true ]; then
  databases=$(docker exec $CONTAINER_NAME psql -U $DB_USERNAME -d postgres -t -c "SELECT datname FROM pg_database WHERE datname LIKE 'clinic_%' OR datname LIKE 'tenant_%';" 2>/dev/null | grep -v "postgres\|template\|master" | tr -d '[:space:]' | grep -v '^$')
else
  databases=$(psql -h $DB_HOST -p $DB_PORT -U $DB_USERNAME -d postgres -t -c "SELECT datname FROM pg_database WHERE datname LIKE 'clinic_%' OR datname LIKE 'tenant_%';" 2>/dev/null | grep -v "postgres\|template\|master" | tr -d '[:space:]' | grep -v '^$')
fi

if [ -z "$databases" ]; then
  echo "❌ No tenant databases found."
  exit 1
fi

echo "Found $(echo "$databases" | wc -l | tr -d ' ') tenant database(s)"
echo ""

# SQL statements for health records export schema
SQL_STATEMENTS="
-- ===========================================
-- Health Records Export Schema (Sprint 13.6)
-- ===========================================

-- Patient Data Exports Audit Table
CREATE TABLE IF NOT EXISTS patient_data_exports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  export_type VARCHAR(50) NOT NULL CHECK (export_type IN ('pdf', 'fhir', 'json', 'csv', 'complete_pdf')),
  format VARCHAR(20) NOT NULL,
  date_range_start DATE,
  date_range_end DATE,
  file_path VARCHAR(500),
  file_url TEXT,
  file_size_bytes INTEGER,
  record_count INTEGER,
  status VARCHAR(50) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  error_message TEXT,
  requested_by UUID NOT NULL,
  requested_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  completed_at TIMESTAMP WITH TIME ZONE,
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_patient_data_exports_patient_id ON patient_data_exports(patient_id);
CREATE INDEX IF NOT EXISTS idx_patient_data_exports_export_type ON patient_data_exports(export_type);
CREATE INDEX IF NOT EXISTS idx_patient_data_exports_status ON patient_data_exports(status);
CREATE INDEX IF NOT EXISTS idx_patient_data_exports_requested_at ON patient_data_exports(requested_at);
CREATE INDEX IF NOT EXISTS idx_patient_data_exports_requested_by ON patient_data_exports(requested_by);

-- Record schema version
INSERT INTO tenant_schema_versions (bundle_id, version, applied_at, applied_by, notes)
VALUES ('sprint13_6_health_records_export', '2025.12.30', NOW(), 'system', 'Health Records Export & Portability')
ON CONFLICT (bundle_id) DO UPDATE
SET version = EXCLUDED.version,
    applied_at = NOW(),
    applied_by = EXCLUDED.applied_by,
    notes = EXCLUDED.notes;
"

# Apply schema to each tenant database
success_count=0
error_count=0

for database in $databases; do
  database=$(echo $database | tr -d '[:space:]')
  if [ -z "$database" ]; then
    continue
  fi

  echo "=========================================="
  echo "Applying schema to: $database"
  echo "=========================================="
  
  if [ "$USE_DOCKER" = true ]; then
    if docker exec -i $CONTAINER_NAME psql -U $DB_USERNAME -d "$database" <<EOF
$SQL_STATEMENTS
EOF
    then
      echo "✅ Successfully applied schema to $database"
      ((success_count++))
    else
      echo "❌ Failed to apply schema to $database"
      ((error_count++))
    fi
  else
    export PGPASSWORD=$DB_PASSWORD
    if psql -h $DB_HOST -p $DB_PORT -U $DB_USERNAME -d "$database" <<EOF
$SQL_STATEMENTS
EOF
    then
      echo "✅ Successfully applied schema to $database"
      ((success_count++))
    else
      echo "❌ Failed to apply schema to $database"
      ((error_count++))
    fi
    unset PGPASSWORD
  fi
  echo ""
done

echo "=========================================="
echo "Summary"
echo "=========================================="
echo "✅ Successfully applied: $success_count database(s)"
echo "❌ Failed: $error_count database(s)"
echo ""

if [ $error_count -eq 0 ]; then
  echo "🎉 All tenant databases updated successfully!"
  exit 0
else
  echo "⚠️  Some databases failed to update. Please check the errors above."
  exit 1
fi

