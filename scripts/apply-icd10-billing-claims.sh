#!/bin/bash

# Script to apply ICD-10 diagnosis codes to billing and medical aid claims tables
# This adds diagnosis code columns to existing tenant databases

set -e

CONTAINER_NAME="${CONTAINER_NAME:-medicore-postgres-master}"
DB_USERNAME="${DB_USERNAME:-medicore}"

echo "🔧 Applying ICD-10 Diagnosis Codes to Billing & Claims Tables"
echo "=============================================================="

# Check if Docker container is running
if ! docker ps | grep -q "$CONTAINER_NAME"; then
  echo "❌ Error: PostgreSQL container '$CONTAINER_NAME' is not running"
  echo "   Please start it with: docker-compose up -d postgres-master"
  exit 1
fi

# Get list of all tenant databases
echo "📋 Fetching list of tenant databases..."
databases=$(docker exec $CONTAINER_NAME psql -U $DB_USERNAME -d postgres -t -c "SELECT datname FROM pg_database WHERE (datname LIKE 'clinic_%' OR datname LIKE 'tenant_%') AND datname != 'tenant_master' AND datname != 'postgres' AND datname != 'template0' AND datname != 'template1';")

if [ -z "$databases" ]; then
  echo "⚠️  No tenant databases found"
  exit 0
fi

SCHEMA_DIR="$(cd "$(dirname "$0")/.." && pwd)/database/schemas"

# Count databases
db_count=$(echo "$databases" | grep -v '^$' | wc -l | xargs)
echo "📊 Found $db_count tenant database(s)"
echo ""

for database in $databases; do
  database=$(echo "$database" | xargs) # Trim whitespace
  if [ -z "$database" ]; then
    continue
  fi

  echo "📦 Applying to tenant: $database"

  # Apply ICD-10 schema
  if [ -f "$SCHEMA_DIR/add-icd10-to-billing-claims.sql" ]; then
    echo "  ✓ Adding ICD-10 diagnosis codes to billing and claims tables..."
    if docker exec -i $CONTAINER_NAME psql -U $DB_USERNAME -d "$database" < "$SCHEMA_DIR/add-icd10-to-billing-claims.sql" 2>&1 | grep -q "ERROR"; then
      echo "    ⚠️  Schema may already exist or error occurred"
    else
      echo "    ✅ ICD-10 columns added successfully"
    fi
  else
    echo "    ⚠️  Schema file not found: $SCHEMA_DIR/add-icd10-to-billing-claims.sql"
  fi

  echo "  ✅ Completed: $database"
  echo ""
done

echo "✅ ICD-10 diagnosis codes applied to all tenant databases!"
echo ""
echo "📋 Next Steps:"
echo "   1. Verify columns were added: docker exec $CONTAINER_NAME psql -U $DB_USERNAME -d <tenant_db> -c '\\d billing'"
echo "   2. Verify claims table: docker exec $CONTAINER_NAME psql -U $DB_USERNAME -d <tenant_db> -c '\\d medical_aid_claims'"


