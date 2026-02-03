#!/bin/bash

# Load environment variables
source "$(dirname "$0")/load-env.sh"

# Script to create ICD-10 mapping PostgreSQL schema in master database
# This should be run before importing ICD-10 mapping TSV files

DB_USERNAME="${DB_USERNAME:-medicore}"
DB_PASSWORD="${DB_PASSWORD:-medicore_password}"
DB_NAME="${DB_NAME:-medicore_master}"
CONTAINER_NAME="${POSTGRES_CONTAINER:-medicore-postgres-master}"

echo "📋 Creating ICD-10 mapping PostgreSQL schema in ${DB_NAME}..."
echo "   Using container: ${CONTAINER_NAME}"

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

docker exec -i "${CONTAINER_NAME}" psql -U "${DB_USERNAME}" -d "${DB_NAME}" <<EOF

-- Drop existing tables if they exist
DROP TABLE IF EXISTS icd10_mapping_metadata CASCADE;
DROP TABLE IF EXISTS snomed_icd10_mappings CASCADE;

-- ICD-10 Mapping table (shared across all tenants)
CREATE TABLE snomed_icd10_mappings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  concept_id VARCHAR(50) NOT NULL,
  concept_fsn TEXT,
  target_code VARCHAR(20) NOT NULL,
  target_display TEXT,
  map_group SMALLINT DEFAULT 1,
  map_priority SMALLINT DEFAULT 1,
  map_rule TEXT,
  map_advice TEXT,
  map_status VARCHAR(100),
  map_category_id VARCHAR(20),
  module_id VARCHAR(50),
  map_source VARCHAR(100),
  effective_time DATE,
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Metadata table
CREATE TABLE icd10_mapping_metadata (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  release_label VARCHAR(150) NOT NULL,
  effective_time DATE,
  source_zip TEXT,
  total_rows INTEGER,
  import_started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  import_completed_at TIMESTAMP WITH TIME ZONE,
  notes TEXT
);

-- Indexes for performance
CREATE UNIQUE INDEX idx_snomed_icd10_unique_map
  ON snomed_icd10_mappings (concept_id, target_code, map_group, map_priority);
CREATE INDEX idx_snomed_icd10_concept
  ON snomed_icd10_mappings (concept_id);
CREATE INDEX idx_snomed_icd10_target
  ON snomed_icd10_mappings (target_code);
CREATE INDEX idx_snomed_icd10_active_concept
  ON snomed_icd10_mappings (active, concept_id);
CREATE UNIQUE INDEX idx_icd10_mapping_metadata_release
  ON icd10_mapping_metadata (release_label);

EOF

if [ $? -eq 0 ]; then
  echo "✅ ICD-10 mapping schema created successfully!"
else
  echo "❌ Failed to create schema"
  exit 1
fi


