#!/bin/bash

# Script to apply HIPAA audit logs schema to all existing tenant databases
# This ensures HIPAA compliance is enabled for all tenants

set -e

CONTAINER_NAME="medicore-postgres-master"
SCHEMA_FILE="database/schemas/add-hipaa-audit-logs.sql"

echo "🔒 Applying HIPAA audit logs schema to all tenant databases..."

# Get list of all tenant databases
TENANT_DBS=$(docker exec $CONTAINER_NAME psql -U medicore -d postgres -t -c "
  SELECT datname 
  FROM pg_database 
  WHERE datname LIKE 'tenant_%' OR datname LIKE 'clinic_%'
  ORDER BY datname;
")

if [ -z "$TENANT_DBS" ]; then
  echo "⚠️  No tenant databases found."
  exit 0
fi

# Count tenants
TENANT_COUNT=$(echo "$TENANT_DBS" | grep -v '^$' | wc -l | tr -d ' ')
echo "📦 Found $TENANT_COUNT tenant database(s)"

# Apply schema to each tenant
SUCCESS_COUNT=0
FAILED_COUNT=0

for DB in $TENANT_DBS; do
  DB=$(echo $DB | tr -d ' ')
  if [ -z "$DB" ]; then
    continue
  fi
  
  echo ""
  echo "📦 Applying to tenant: $DB"
  
  # Check if table already exists
  TABLE_EXISTS=$(docker exec $CONTAINER_NAME psql -U medicore -d "$DB" -t -c "
    SELECT EXISTS (
      SELECT FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name = 'hipaa_audit_logs'
    );
  " | tr -d ' ')
  
  if [ "$TABLE_EXISTS" = "t" ]; then
    echo "  ✓ HIPAA audit logs table already exists, skipping..."
    SUCCESS_COUNT=$((SUCCESS_COUNT + 1))
    continue
  fi
  
  # Apply schema
  if docker exec -i $CONTAINER_NAME psql -U medicore -d "$DB" < "$SCHEMA_FILE" > /dev/null 2>&1; then
    echo "  ✅ HIPAA audit logs schema applied successfully"
    SUCCESS_COUNT=$((SUCCESS_COUNT + 1))
  else
    echo "  ❌ Failed to apply HIPAA audit logs schema"
    FAILED_COUNT=$((FAILED_COUNT + 1))
  fi
done

echo ""
echo "✅ HIPAA audit logs schema applied to $SUCCESS_COUNT tenant database(s)"
if [ $FAILED_COUNT -gt 0 ]; then
  echo "⚠️  Failed to apply to $FAILED_COUNT tenant database(s)"
fi
echo ""
echo "🔒 HIPAA compliance schema provisioning complete!"


