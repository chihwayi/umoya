#!/bin/bash

# Script to apply billing and claims enhancements to existing tenant databases
# This updates the medical_aid_claims table structure to match the current schema

DB_USERNAME="${DB_USERNAME:-medicore}"
DB_PASSWORD="${DB_PASSWORD:-medicore}"
CONTAINER_NAME="medicore-postgres-master"

# Get list of tenant databases
echo "📋 Fetching list of tenant databases..."
databases=$(docker exec $CONTAINER_NAME psql -U $DB_USERNAME -d postgres -t -c "SELECT datname FROM pg_database WHERE datname LIKE 'tenant_%' OR datname LIKE 'clinic_%' AND datname != 'medicore_master';")

if [ -z "$databases" ]; then
  echo "❌ No tenant databases found."
  exit 1
fi

# Apply schema to each tenant database
for database in $databases; do
  database=$(echo $database | tr -d '[:space:]')
  echo ""
  echo "=========================================="
  echo "Applying billing & claims enhancements to: $database"
  echo "=========================================="
  
  docker exec -i $CONTAINER_NAME psql -U $DB_USERNAME -d "$database" <<'SQL_EOF'
-- Update medical_aid_claims table structure
DO \$\$ 
BEGIN
  -- Add billing_id if it doesn't exist
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'medical_aid_claims' AND column_name = 'billing_id') THEN
    ALTER TABLE medical_aid_claims ADD COLUMN billing_id UUID REFERENCES billing(id) ON DELETE SET NULL;
    CREATE INDEX IF NOT EXISTS idx_claims_billing_id ON medical_aid_claims(billing_id);
  END IF;

  -- Rename medical_aid_number to member_number if it exists
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'medical_aid_claims' AND column_name = 'medical_aid_number') THEN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'medical_aid_claims' AND column_name = 'member_number') THEN
      ALTER TABLE medical_aid_claims RENAME COLUMN medical_aid_number TO member_number;
    END IF;
  END IF;

  -- Add member_number if it doesn't exist
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'medical_aid_claims' AND column_name = 'member_number') THEN
    ALTER TABLE medical_aid_claims ADD COLUMN member_number VARCHAR(100);
  END IF;

  -- Add approved_amount if it doesn't exist
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'medical_aid_claims' AND column_name = 'approved_amount') THEN
    ALTER TABLE medical_aid_claims ADD COLUMN approved_amount DECIMAL(10,2);
  END IF;

  -- Add rejection_reason if it doesn't exist
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'medical_aid_claims' AND column_name = 'rejection_reason') THEN
    ALTER TABLE medical_aid_claims ADD COLUMN rejection_reason TEXT;
  END IF;

  -- Add claim_data if it doesn't exist
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'medical_aid_claims' AND column_name = 'claim_data') THEN
    ALTER TABLE medical_aid_claims ADD COLUMN claim_data JSONB;
  END IF;

  -- Update submission_date and response_date to TIMESTAMP WITH TIME ZONE if they're DATE
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'medical_aid_claims' AND column_name = 'submission_date' AND data_type = 'date') THEN
    ALTER TABLE medical_aid_claims ALTER COLUMN submission_date TYPE TIMESTAMP WITH TIME ZONE USING submission_date::TIMESTAMP WITH TIME ZONE;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'medical_aid_claims' AND column_name = 'response_date' AND data_type = 'date') THEN
    ALTER TABLE medical_aid_claims ALTER COLUMN response_date TYPE TIMESTAMP WITH TIME ZONE USING response_date::TIMESTAMP WITH TIME ZONE;
  END IF;

  -- Remove appointment_id if it exists (replaced by billing_id)
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'medical_aid_claims' AND column_name = 'appointment_id') THEN
    ALTER TABLE medical_aid_claims DROP COLUMN IF EXISTS appointment_id;
  END IF;

  -- Remove response_notes if it exists (replaced by rejection_reason)
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'medical_aid_claims' AND column_name = 'response_notes') THEN
    ALTER TABLE medical_aid_claims DROP COLUMN IF EXISTS response_notes;
  END IF;

  -- Update status constraint to include new statuses
  ALTER TABLE medical_aid_claims DROP CONSTRAINT IF EXISTS medical_aid_claims_status_check;
  ALTER TABLE medical_aid_claims ADD CONSTRAINT medical_aid_claims_status_check 
    CHECK (status IN ('draft', 'submitted', 'processing', 'approved', 'rejected', 'paid'));

  -- Update default status
  ALTER TABLE medical_aid_claims ALTER COLUMN status SET DEFAULT 'draft';

  -- Make created_by nullable if it's not already
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'medical_aid_claims' AND column_name = 'created_by' AND is_nullable = 'NO') THEN
    ALTER TABLE medical_aid_claims ALTER COLUMN created_by DROP NOT NULL;
  END IF;

  -- Make submission_date nullable if it's not already
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'medical_aid_claims' AND column_name = 'submission_date' AND is_nullable = 'NO') THEN
    ALTER TABLE medical_aid_claims ALTER COLUMN submission_date DROP NOT NULL;
  END IF;
END \$\$;
SQL_EOF

  if [ $? -eq 0 ]; then
    echo "✅ Successfully applied billing & claims enhancements to $database"
  else
    echo "❌ Failed to apply billing & claims enhancements to $database"
    exit 1
  fi
done

echo ""
echo "🎉 Billing & Claims enhancements schema application completed!"

