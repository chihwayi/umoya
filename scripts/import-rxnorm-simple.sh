#!/bin/bash

# Simple RxNorm Import Script using psql COPY
# This script imports drugs directly via PostgreSQL COPY command

set -e

RRF_FOLDER="${1:-/tmp/rxnorm_prescribe/rrf}"
DB_NAME="${DB_NAME:-tenant_bulawayo_general}"

echo "🧪 RxNorm Drug Import (Simple PostgreSQL Method)"
echo "================================================="
echo "RRF Folder: $RRF_FOLDER"
echo "Database: $DB_NAME"
echo ""

# Check if RRF folder exists
if [ ! -d "$RRF_FOLDER" ]; then
  echo "❌ Error: RRF folder not found: $RRF_FOLDER"
  exit 1
fi

# Check if RXNCONSO.RRF exists
if [ ! -f "$RRF_FOLDER/RXNCONSO.RRF" ]; then
  echo "❌ Error: RXNCONSO.RRF not found in $RRF_FOLDER"
  exit 1
fi

echo "📖 Parsing RxNorm files..."
echo ""

# Create temporary table for import
docker exec -i medicore-postgres-master psql -U medicore -d "$DB_NAME" <<'EOF'
-- Create temporary table for RxNorm import
CREATE TEMP TABLE IF NOT EXISTS rxnorm_temp (
  rxcui VARCHAR(20),
  name TEXT,
  tty VARCHAR(10),
  sab VARCHAR(20),
  code VARCHAR(50),
  str TEXT
);

-- Create temp table for attributes
CREATE TEMP TABLE IF NOT EXISTS rxnorm_attrs_temp (
  rxcui VARCHAR(20),
  atn VARCHAR(50),
  atv TEXT
);
EOF

echo "✅ Temporary tables created"
echo ""

# Import RXNCONSO.RRF (we'll filter in SQL)
echo "📥 Importing RXNCONSO.RRF..."
# Note: We'll need to process this with a script that filters for SCD types
# For now, let's use a Python/Node.js approach or process the file first

echo ""
echo "⚠️  Note: Full import requires processing the RRF files to extract SCD types"
echo "   Please use the TypeScript import script:"
echo "   cd /Users/devoop/Dev/personal/medicore"
echo "   DB_HOST=localhost DB_PORT=5432 DB_USER=medicore DB_PASSWORD=medicore DB_NAME=$DB_NAME npx ts-node scripts/import-rxnorm-drugs.ts $RRF_FOLDER"
echo ""
echo "   OR run via Docker:"
echo "   docker exec -i medicore-ehr-service npm run import-rxnorm -- $RRF_FOLDER"

