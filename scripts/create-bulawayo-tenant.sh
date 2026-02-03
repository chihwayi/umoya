#!/bin/bash

# Load environment variables
source "$(dirname "$0")/load-env.sh"

# Script to create bulawayo-general tenant
# Usage: ./scripts/create-bulawayo-tenant.sh

set -e

DB_HOST="${DB_HOST:-localhost}"
DB_PORT="${DB_PORT:-5432}"
DB_USER="${DB_USERNAME:-medicore}"
DB_PASSWORD="${DB_PASSWORD:-medicore_password}"
MASTER_DB="${MASTER_DB:-medicore_master}"

echo "🏥 Creating bulawayo-general tenant..."

# Try Docker first
if docker ps | grep -q postgres; then
  echo "📦 Using Docker PostgreSQL..."
  docker exec -i medicore-postgres-master psql -U $DB_USER -d $MASTER_DB < scripts/create-bulawayo-tenant.sql
  echo "✅ Tenant created via Docker"
# Try local PostgreSQL
elif command -v psql &> /dev/null; then
  echo "💻 Using local PostgreSQL..."
  PGPASSWORD=$DB_PASSWORD psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $MASTER_DB -f scripts/create-bulawayo-tenant.sql
  echo "✅ Tenant created via local PostgreSQL"
else
  echo "❌ Cannot find PostgreSQL. Please run the SQL script manually:"
  echo "   psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $MASTER_DB -f scripts/create-bulawayo-tenant.sql"
  echo ""
  echo "Or if using Docker:"
  echo "   docker exec -i medicore-postgres-master psql -U $DB_USER -d $MASTER_DB < scripts/create-bulawayo-tenant.sql"
  exit 1
fi



