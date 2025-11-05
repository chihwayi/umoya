#!/bin/bash

# Script to add viral load monitoring columns to hiv_eac_sessions table
# Per WHO guidelines, VL testing should be done during EAC sessions

DB_USERNAME="${DB_USERNAME:-medicore}"
DB_PASSWORD="${DB_PASSWORD:-medicore_password}"
CONTAINER_NAME="medicore-postgres-master"

# Get list of tenant databases
echo "Fetching list of tenant databases..."
databases=$(docker exec $CONTAINER_NAME psql -U $DB_USERNAME -d postgres -t -c "SELECT datname FROM pg_database WHERE datname LIKE 'tenant_%' AND datname != 'tenant_master';")

if [ -z "$databases" ]; then
  echo "No tenant databases found."
  exit 1
fi

echo "Adding viral load monitoring columns to EAC sessions table..."

for database in $databases; do
  database=$(echo $database | tr -d '[:space:]')
  if [ -z "$database" ]; then
    continue
  fi
  
  echo "Processing tenant database: $database"
  
  docker exec -i $CONTAINER_NAME psql -U $DB_USERNAME -d "$database" <<EOF
    -- Add viral load monitoring columns
    ALTER TABLE hiv_eac_sessions 
    ADD COLUMN IF NOT EXISTS viral_load DECIMAL(10,2),
    ADD COLUMN IF NOT EXISTS viral_load_unit VARCHAR(10) DEFAULT 'copies/mL',
    ADD COLUMN IF NOT EXISTS viral_load_test_date DATE,
    ADD COLUMN IF NOT EXISTS viral_load_suppressed BOOLEAN,
    ADD COLUMN IF NOT EXISTS viral_load_improved BOOLEAN DEFAULT false;
    
    -- Update existing records to have default unit
    UPDATE hiv_eac_sessions 
    SET viral_load_unit = 'copies/mL' 
    WHERE viral_load_unit IS NULL;
EOF

  if [ $? -eq 0 ]; then
    echo "✅ Successfully updated $database"
  else
    echo "❌ Failed to update $database"
  fi
done

echo "✨ Done! Viral load monitoring columns added to all tenant databases."

