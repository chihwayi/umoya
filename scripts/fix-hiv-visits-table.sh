#!/bin/bash

# Script to add missing columns to hiv_clinical_visits table in existing tenant databases

DB_USERNAME="${DB_USERNAME:-medicore}"
CONTAINER_NAME="medicore-postgres-master"

# Get list of tenant databases
echo "Fetching list of tenant databases..."
databases=$(docker exec $CONTAINER_NAME psql -U $DB_USERNAME -d postgres -t -c "SELECT datname FROM pg_database WHERE datname LIKE 'tenant_%' AND datname != 'tenant_master';")

if [ -z "$databases" ]; then
  echo "No tenant databases found."
  exit 1
fi

# Apply missing columns to each tenant database
for database in $databases; do
  database=$(echo $database | tr -d '[:space:]')
  echo ""
  echo "=========================================="
  echo "Fixing hiv_clinical_visits table in: $database"
  echo "=========================================="
  
  docker exec -i $CONTAINER_NAME psql -U $DB_USERNAME -d "$database" <<EOF
-- Add missing columns that are in the INSERT statement but may not exist in the table

-- Weight and Height (already have weight, height, height_cm, but need weight_kg)
ALTER TABLE hiv_clinical_visits ADD COLUMN IF NOT EXISTS weight_kg DECIMAL(5,2);

-- TB columns
ALTER TABLE hiv_clinical_visits ADD COLUMN IF NOT EXISTS tb_diagnosed BOOLEAN DEFAULT false;
ALTER TABLE hiv_clinical_visits ADD COLUMN IF NOT EXISTS tb_treatment_started BOOLEAN DEFAULT false;

-- Ensure visit_type uses the new column name (visit_type_new might be the old one)
-- If visit_type_new exists and has data, we should migrate it, but for now just ensure visit_type exists
-- The INSERT uses visit_type, so we'll keep that

EOF

  if [ $? -eq 0 ]; then
    echo "✓ Successfully fixed hiv_clinical_visits table in $database"
  else
    echo "✗ Failed to fix hiv_clinical_visits table in $database"
  fi
done

echo ""
echo "=========================================="
echo "Table fixes complete!"
echo "=========================================="

