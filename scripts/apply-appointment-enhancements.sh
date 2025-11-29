#!/bin/bash

# Script to apply appointment enhancements (doctor availability) tables to existing tenant databases
# This script should be run after the database-provisioning.service.ts has been updated

DB_USERNAME="${DB_USERNAME:-medicore}"
DB_PASSWORD="${DB_PASSWORD:-medicore}"
CONTAINER_NAME="medicore-postgres-master"

# Get list of tenant databases
echo "📋 Fetching list of tenant databases..."
databases=$(docker exec $CONTAINER_NAME psql -U $DB_USERNAME -d postgres -t -c "SELECT datname FROM pg_database WHERE datname LIKE 'clinic_%' OR datname LIKE 'tenant_%' AND datname != 'tenant_master';")

if [ -z "$databases" ]; then
  echo "❌ No tenant databases found."
  exit 1
fi

# Apply schema to each tenant database
for database in $databases; do
  database=$(echo $database | tr -d '[:space:]')
  echo ""
  echo "=========================================="
  echo "Applying appointment enhancements to: $database"
  echo "=========================================="
  
  docker exec -i $CONTAINER_NAME psql -U $DB_USERNAME -d "$database" <<EOF
-- ===========================================
-- Appointment Enhancements - Doctor Availability
-- ===========================================

CREATE TABLE IF NOT EXISTS doctor_availability (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  doctor_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  start_date DATE NOT NULL,
  end_date DATE,
  start_time TIME,
  end_time TIME,
  is_all_day BOOLEAN DEFAULT false,
  is_unavailable BOOLEAN DEFAULT true,
  reason VARCHAR(255),
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_by UUID REFERENCES users(id),
  updated_by UUID REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_doctor_availability_doctor_id ON doctor_availability(doctor_id);
CREATE INDEX IF NOT EXISTS idx_doctor_availability_dates ON doctor_availability(start_date, end_date);
CREATE INDEX IF NOT EXISTS idx_doctor_availability_is_unavailable ON doctor_availability(is_unavailable);

-- Create trigger function if it doesn't exist
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS \$\$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
\$\$ LANGUAGE plpgsql;

-- Create trigger if it doesn't exist
DROP TRIGGER IF EXISTS update_doctor_availability_updated_at ON doctor_availability;
CREATE TRIGGER update_doctor_availability_updated_at 
  BEFORE UPDATE ON doctor_availability
  FOR EACH ROW 
  EXECUTE FUNCTION update_updated_at_column();

EOF

  if [ $? -eq 0 ]; then
    echo "✅ Successfully applied appointment enhancements to $database"
  else
    echo "❌ Failed to apply appointment enhancements to $database"
  fi
done

echo ""
echo "🎉 Appointment enhancements schema application completed!"

