#!/bin/bash

# Load environment variables
source "$(dirname "$0")/load-env.sh"

# Script to create SNOMED CT PostgreSQL schema in master database
# This should be run before importing SNOMED CT RF2 files

DB_USERNAME="${DB_USERNAME:-medicore}"
DB_PASSWORD="${DB_PASSWORD:-medicore_password}"
DB_NAME="${DB_NAME:-medicore_master}"
CONTAINER_NAME="${POSTGRES_CONTAINER:-medicore-postgres-master}"

echo "📋 Creating SNOMED CT PostgreSQL schema in ${DB_NAME}..."
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
DROP TABLE IF EXISTS snomed_relationships CASCADE;
DROP TABLE IF EXISTS snomed_descriptions CASCADE;
DROP TABLE IF EXISTS snomed_concepts CASCADE;
DROP MATERIALIZED VIEW IF EXISTS snomed_search_view CASCADE;

-- Core SNOMED CT Concept table
CREATE TABLE snomed_concepts (
  concept_id VARCHAR(18) PRIMARY KEY,
  effective_time DATE NOT NULL,
  active BOOLEAN NOT NULL,
  module_id VARCHAR(18) NOT NULL,
  definition_status_id VARCHAR(18) NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

-- SNOMED CT Description table (terms/synonyms)
CREATE TABLE snomed_descriptions (
  description_id VARCHAR(18) PRIMARY KEY,
  effective_time DATE NOT NULL,
  active BOOLEAN NOT NULL,
  module_id VARCHAR(18) NOT NULL,
  concept_id VARCHAR(18) NOT NULL,
  language_code VARCHAR(2) NOT NULL DEFAULT 'en',
  type_id VARCHAR(18) NOT NULL,
  term TEXT NOT NULL,
  case_significance_id VARCHAR(18) NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  FOREIGN KEY (concept_id) REFERENCES snomed_concepts(concept_id) ON DELETE CASCADE
);

-- SNOMED CT Relationship table (hierarchies)
CREATE TABLE snomed_relationships (
  relationship_id VARCHAR(18) PRIMARY KEY,
  effective_time DATE NOT NULL,
  active BOOLEAN NOT NULL,
  module_id VARCHAR(18) NOT NULL,
  source_id VARCHAR(18) NOT NULL,
  destination_id VARCHAR(18) NOT NULL,
  relationship_group INTEGER NOT NULL,
  type_id VARCHAR(18) NOT NULL,
  characteristic_type_id VARCHAR(18) NOT NULL,
  modifier_id VARCHAR(18) NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  FOREIGN KEY (source_id) REFERENCES snomed_concepts(concept_id) ON DELETE CASCADE,
  FOREIGN KEY (destination_id) REFERENCES snomed_concepts(concept_id) ON DELETE CASCADE
);

-- Indexes for performance
CREATE INDEX idx_snomed_concepts_active ON snomed_concepts(active) WHERE active = true;
CREATE INDEX idx_snomed_descriptions_concept_id ON snomed_descriptions(concept_id);
CREATE INDEX idx_snomed_descriptions_active ON snomed_descriptions(active) WHERE active = true;
CREATE INDEX idx_snomed_descriptions_language ON snomed_descriptions(language_code) WHERE language_code = 'en';
CREATE INDEX idx_snomed_descriptions_type_id ON snomed_descriptions(type_id);
CREATE INDEX idx_snomed_relationships_source ON snomed_relationships(source_id);
CREATE INDEX idx_snomed_relationships_destination ON snomed_relationships(destination_id);
CREATE INDEX idx_snomed_relationships_active ON snomed_relationships(active) WHERE active = true;

-- Full-text search index on descriptions
CREATE INDEX idx_snomed_descriptions_term_fts ON snomed_descriptions USING gin(to_tsvector('english', term));

-- Materialized view for fast search (will be populated after import)
CREATE MATERIALIZED VIEW snomed_search_view AS
SELECT 
  c.concept_id,
  c.active,
  d.description_id,
  d.term,
  d.type_id,
  CASE 
    WHEN d.type_id = '900000000000003001' THEN 'FSN'
    WHEN d.type_id = '900000000000013009' THEN 'Synonym'
    ELSE 'Other'
  END as term_type,
  to_tsvector('english', d.term) as search_vector
FROM snomed_concepts c
JOIN snomed_descriptions d ON c.concept_id = d.concept_id
WHERE c.active = true 
  AND d.active = true 
  AND d.language_code = 'en'
  AND NOT c.concept_id LIKE '999%'; -- Filter out test concepts

-- Index on materialized view
CREATE INDEX idx_snomed_search_view_vector ON snomed_search_view USING gin(search_vector);
CREATE INDEX idx_snomed_search_view_term ON snomed_search_view(term);
CREATE INDEX idx_snomed_search_view_concept_id ON snomed_search_view(concept_id);

EOF

if [ $? -eq 0 ]; then
  echo "✅ SNOMED CT schema created successfully!"
else
  echo "❌ Failed to create schema"
  exit 1
fi

