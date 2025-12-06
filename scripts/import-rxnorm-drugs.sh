#!/bin/bash

# RxNorm Drug Import Script (Shell wrapper)
# 
# This script imports drugs from RxNorm "Current Prescribable Content" subset
# into the medicore drugs table.
# 
# Usage:
#   bash scripts/import-rxnorm-drugs.sh [path-to-rxnorm-rrf-folder]
# 
# Example:
#   bash scripts/import-rxnorm-drugs.sh /tmp/rxnorm_prescribe/rrf

set -e

RRF_FOLDER="${1:-/tmp/rxnorm_prescribe/rrf}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

echo "🧪 RxNorm Drug Import Script"
echo "============================"
echo "RRF Folder: $RRF_FOLDER"
echo ""

# Check if RRF folder exists
if [ ! -d "$RRF_FOLDER" ]; then
  echo "❌ Error: RRF folder not found: $RRF_FOLDER"
  echo ""
  echo "Usage: bash scripts/import-rxnorm-drugs.sh [path-to-rrf-folder]"
  echo ""
  echo "Example:"
  echo "  bash scripts/import-rxnorm-drugs.sh ~/Downloads/RxNorm_weekly_prescribe_12032025/rrf"
  exit 1
fi

# Check if RXNCONSO.RRF exists
if [ ! -f "$RRF_FOLDER/RXNCONSO.RRF" ]; then
  echo "❌ Error: RXNCONSO.RRF not found in $RRF_FOLDER"
  exit 1
fi

echo "✅ RRF files found"
echo ""

# Check if we're in Docker or local
if [ -f "$PROJECT_ROOT/docker-compose.yml" ]; then
  echo "🐳 Running import via Docker..."
  
  # Copy RRF files to a location accessible by Docker
  TEMP_DIR="/tmp/rxnorm_import_$$"
  mkdir -p "$TEMP_DIR"
  cp "$RRF_FOLDER"/*.RRF "$TEMP_DIR/" 2>/dev/null || true
  
  # Run import via Node.js directly in Docker container
  docker exec -i medicore-postgres-master psql -U medicore -d tenant_bulawayo_general <<EOF
-- Import will be done via Node.js script
SELECT 'Ready for import' as status;
EOF

  # For now, we'll use a Python/Node.js script that can run in the container
  # Or we can use a simpler approach with psql COPY
  echo "📝 Note: Full import requires Node.js/TypeScript runtime"
  echo "   Please run: cd $PROJECT_ROOT && npx ts-node scripts/import-rxnorm-drugs.ts $RRF_FOLDER"
  
else
  echo "💻 Running import locally..."
  cd "$PROJECT_ROOT"
  
  # Try to run with ts-node
  if command -v npx &> /dev/null; then
    echo "Running: npx ts-node scripts/import-rxnorm-drugs.ts $RRF_FOLDER"
    npx ts-node scripts/import-rxnorm-drugs.ts "$RRF_FOLDER"
  elif command -v ts-node &> /dev/null; then
    echo "Running: ts-node scripts/import-rxnorm-drugs.ts $RRF_FOLDER"
    ts-node scripts/import-rxnorm-drugs.ts "$RRF_FOLDER"
  else
    echo "❌ Error: ts-node not found. Please install:"
    echo "   npm install -g ts-node typescript"
    echo "   OR"
    echo "   npm install --save-dev ts-node typescript"
    exit 1
  fi
fi

echo ""
echo "✅ Import script completed!"

