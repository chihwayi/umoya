#!/bin/bash

# Load environment variables
source "$(dirname "$0")/load-env.sh"

# Script to create ICD-10 mapping PostgreSQL schema
# This uses the schema definition from database/schemas/icd10-terminology.sql

DB_USERNAME="${DB_USERNAME:-postgres}"
DB_PASSWORD="${DB_PASSWORD:-postgres}"
DB_NAME="${DB_NAME:-medicore}"
CONTAINER_NAME="${POSTGRES_CONTAINER:-medicore-postgres-master}"
SCHEMA_FILE="$(dirname "$0")/../database/schemas/icd10-terminology.sql"

echo "📋 Creating ICD-10 mapping PostgreSQL schema in ${DB_NAME}..."
echo "   Using container: ${CONTAINER_NAME}"
echo "   Schema file: ${SCHEMA_FILE}"

# Check if container exists
if ! docker ps -a --format '{{.Names}}' | grep -q "^${CONTAINER_NAME}$"; then
  echo "❌ Error: PostgreSQL container '${CONTAINER_NAME}' not found"
  echo "   Make sure PostgreSQL is running: docker-compose up -d postgres-master"
  exit 1
fi

# Check if container is running
if ! docker ps --format '{{.Names}}' | grep -q "^${CONTAINER_NAME}$"; then
  echo "❌ Error: PostgreSQL container '${CONTAINER_NAME}' is not running"
  echo "   Start it with: docker-compose up -d postgres-master"
  exit 1
fi

# Execute the schema SQL
cat "${SCHEMA_FILE}" | docker exec -i "${CONTAINER_NAME}" psql -U "${DB_USERNAME}" -d "${DB_NAME}"

if [ $? -eq 0 ]; then
  echo "✅ ICD-10 mapping schema created successfully!"
else
  echo "❌ Failed to create schema"
  exit 1
fi
