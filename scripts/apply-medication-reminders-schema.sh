#!/bin/bash

# Apply medication reminders schema to all tenant databases

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
SCHEMA_FILE="$PROJECT_ROOT/database/schemas/medication-reminders.sql"

# Database connection details
DB_HOST="${DB_HOST:-localhost}"
DB_PORT="${DB_PORT:-5432}"
DB_USER="${DB_USER:-postgres}"
DB_PASSWORD="${DB_PASSWORD:-postgres}"
MASTER_DB="${MASTER_DB:-medicore_master}"

echo "🏥 Applying medication reminders schema to all tenant databases..."

# Get all tenant database names
TENANT_DBS=$(PGPASSWORD="$DB_PASSWORD" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$MASTER_DB" -t -c "SELECT database_name FROM tenants WHERE status = 'active';" | tr -d ' ')

if [ -z "$TENANT_DBS" ]; then
    echo "❌ No active tenant databases found"
    exit 1
fi

SUCCESS_COUNT=0
ERROR_COUNT=0

for db_name in $TENANT_DBS; do
    if [ -n "$db_name" ]; then
        echo "📋 Applying to database: $db_name"
        
        if PGPASSWORD="$DB_PASSWORD" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$db_name" -f "$SCHEMA_FILE" > /dev/null 2>&1; then
            echo "✅ Successfully applied to $db_name"
            ((SUCCESS_COUNT++))
        else
            echo "❌ Failed to apply to $db_name"
            ((ERROR_COUNT++))
        fi
    fi
done

echo ""
echo "📊 Summary:"
echo "✅ Successful: $SUCCESS_COUNT databases"
echo "❌ Failed: $ERROR_COUNT databases"

if [ $ERROR_COUNT -eq 0 ]; then
    echo "🎉 All tenant databases updated successfully!"
    exit 0
else
    echo "⚠️  Some databases failed to update"
    exit 1
fi