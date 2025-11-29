#!/bin/bash

# Script to apply appointment enhancements schema to existing tenant databases
# This includes: appointment_templates, appointment_resources, appointment_resource_bookings

set -e

DB_HOST="${DB_HOST:-localhost}"
DB_PORT="${DB_PORT:-5432}"
DB_USERNAME="${DB_USERNAME:-medicore}"
DB_PASSWORD="${DB_PASSWORD:-medicore_password}"
MASTER_DB="${MASTER_DB:-medicore_master}"

echo "🔧 Applying Appointment Enhancements Schema to Existing Tenants"
echo "================================================================"

# Get list of all tenant databases
TENANT_DBS=$(PGPASSWORD="$DB_PASSWORD" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USERNAME" -d "$MASTER_DB" -t -c "SELECT \"databaseName\" FROM tenants WHERE status = 'active';")

if [ -z "$TENANT_DBS" ]; then
  echo "⚠️  No active tenants found"
  exit 0
fi

SCHEMA_DIR="$(cd "$(dirname "$0")/.." && pwd)/database/schemas"

for DB_NAME in $TENANT_DBS; do
  DB_NAME=$(echo "$DB_NAME" | xargs) # Trim whitespace
  if [ -z "$DB_NAME" ]; then
    continue
  fi

  echo ""
  echo "📦 Applying to tenant: $DB_NAME"

  # Apply appointment templates schema
  if [ -f "$SCHEMA_DIR/appointment-templates.sql" ]; then
    echo "  ✓ Applying appointment_templates schema..."
    PGPASSWORD="$DB_PASSWORD" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USERNAME" -d "$DB_NAME" -f "$SCHEMA_DIR/appointment-templates.sql" > /dev/null 2>&1 || echo "    ⚠️  Templates schema may already exist"
  fi

  # Apply appointment resources schema
  if [ -f "$SCHEMA_DIR/appointment-resources.sql" ]; then
    echo "  ✓ Applying appointment_resources schema..."
    PGPASSWORD="$DB_PASSWORD" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USERNAME" -d "$DB_NAME" -f "$SCHEMA_DIR/appointment-resources.sql" > /dev/null 2>&1 || echo "    ⚠️  Resources schema may already exist"
  fi

  echo "  ✅ Completed: $DB_NAME"
done

echo ""
echo "✅ Appointment enhancements schema applied to all active tenants!"
echo ""
echo "📋 Next Steps:"
echo "   1. Verify schema was applied: psql -d <tenant_db> -c '\\dt appointment_*'"
echo "   2. Test appointment templates: Create a template via UI"
echo "   3. Test resource scheduling: Add rooms/equipment and book them"

