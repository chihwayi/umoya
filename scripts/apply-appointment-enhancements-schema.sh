#!/bin/bash

# Script to apply appointment enhancements schema to existing tenant databases
# This includes: appointment_templates, appointment_resources, appointment_resource_bookings

set -e

CONTAINER_NAME="${CONTAINER_NAME:-medicore-postgres-master}"
DB_USERNAME="${DB_USERNAME:-medicore}"
MASTER_DB="${MASTER_DB:-medicore_master}"

echo "🔧 Applying Appointment Enhancements Schema to Existing Tenants"
echo "================================================================"

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

  # Apply appointment templates schema
  if [ -f "$SCHEMA_DIR/appointment-templates.sql" ]; then
    echo "  ✓ Applying appointment_templates schema..."
    if docker exec -i $CONTAINER_NAME psql -U $DB_USERNAME -d "$database" < "$SCHEMA_DIR/appointment-templates.sql" 2>&1 | grep -q "ERROR"; then
      echo "    ⚠️  Templates schema may already exist or error occurred"
    else
      echo "    ✅ Templates schema applied"
    fi
  else
    echo "    ⚠️  Schema file not found: $SCHEMA_DIR/appointment-templates.sql"
  fi

  # Apply appointment resources schema
  if [ -f "$SCHEMA_DIR/appointment-resources.sql" ]; then
    echo "  ✓ Applying appointment_resources schema..."
    if docker exec -i $CONTAINER_NAME psql -U $DB_USERNAME -d "$database" < "$SCHEMA_DIR/appointment-resources.sql" 2>&1 | grep -q "ERROR"; then
      echo "    ⚠️  Resources schema may already exist or error occurred"
    else
      echo "    ✅ Resources schema applied"
    fi
  else
    echo "    ⚠️  Schema file not found: $SCHEMA_DIR/appointment-resources.sql"
  fi

  echo "  ✅ Completed: $database"
  echo ""
done

echo "✅ Appointment enhancements schema applied to all tenant databases!"
echo ""
echo "📋 Next Steps:"
echo "   1. Verify schema was applied: docker exec $CONTAINER_NAME psql -U $DB_USERNAME -d <tenant_db> -c '\\dt appointment_*'"
echo "   2. Test appointment templates: Create a template via UI"
echo "   3. Test resource scheduling: Add rooms/equipment and book them"

