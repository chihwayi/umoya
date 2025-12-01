#!/bin/bash

# Script to verify chronic disease management tables exist in all tenant databases
# These tables should already exist from Sprint 6, but this script verifies and reports

set -e

DB_USERNAME="${DB_USERNAME:-medicore}"
DB_PASSWORD="${DB_PASSWORD:-medicore_password}"
CONTAINER_NAME="${CONTAINER_NAME:-medicore-postgres-master}"

echo "🔍 Verifying Chronic Disease Management Tables..."
echo "================================================"

# Get list of tenant databases
echo "Fetching list of tenant databases..."
databases=$(docker exec $CONTAINER_NAME psql -U $DB_USERNAME -d postgres -t -c "SELECT datname FROM pg_database WHERE datname LIKE 'clinic_%' OR datname LIKE 'tenant_%';" | tr -d ' ' | grep -v '^$')

if [ -z "$databases" ]; then
  echo "No tenant databases found."
  exit 1
fi

echo ""
echo "Found tenant databases:"
echo "$databases"
echo ""

# Check each database
for database in $databases; do
  database=$(echo $database | tr -d '[:space:]')
  if [ -z "$database" ]; then
    continue
  fi
  
  echo "=========================================="
  echo "Checking: $database"
  echo "=========================================="
  
  # Check diabetes tables
  diabetes_registry=$(docker exec $CONTAINER_NAME psql -U $DB_USERNAME -d "$database" -t -c "SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'diabetes_registry');" 2>&1 | tr -d ' ' | grep -q 't' && echo "✅" || echo "❌")
  glucose_monitoring=$(docker exec $CONTAINER_NAME psql -U $DB_USERNAME -d "$database" -t -c "SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'glucose_monitoring');" 2>&1 | tr -d ' ' | grep -q 't' && echo "✅" || echo "❌")
  diabetes_care_bundle=$(docker exec $CONTAINER_NAME psql -U $DB_USERNAME -d "$database" -t -c "SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'diabetes_care_bundle');" 2>&1 | tr -d ' ' | grep -q 't' && echo "✅" || echo "❌")
  
  # Check cardiology tables
  cardiology_encounters=$(docker exec $CONTAINER_NAME psql -U $DB_USERNAME -d "$database" -t -c "SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'cardiology_encounters');" 2>&1 | tr -d ' ' | grep -q 't' && echo "✅" || echo "❌")
  
  echo "  diabetes_registry: $diabetes_registry"
  echo "  glucose_monitoring: $glucose_monitoring"
  echo "  diabetes_care_bundle: $diabetes_care_bundle"
  echo "  cardiology_encounters: $cardiology_encounters"
  echo ""
done

echo "✅ Verification complete!"
echo ""
echo "Note: If any tables are missing, they will be automatically created"
echo "      when the tenant schema is reprovisioned via the provisioning service."

