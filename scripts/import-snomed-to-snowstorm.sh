#!/bin/bash

# Script to import SNOMED CT RF2 files into Snowstorm
# This script clears existing test data and imports the full SNOMED CT dataset

SNOMED_BASE_URL="${SNOMED_BASE_URL:-http://localhost:8080}"
IMPORT_DIR="/opt/snowstorm/import/SnomedCT_InternationalRF2_PRODUCTION_20251101T120000Z"

echo "🔍 Checking Snowstorm availability..."
if ! curl -s -f "${SNOMED_BASE_URL}/actuator/health" > /dev/null; then
  echo "❌ Snowstorm is not available at ${SNOMED_BASE_URL}"
  exit 1
fi

echo "✅ Snowstorm is running"

echo ""
echo "📦 Checking for SNOMED CT files..."
if [ ! -d "snowstorm/import/SnomedCT_InternationalRF2_PRODUCTION_20251101T120000Z" ]; then
  echo "❌ SNOMED CT files not found in snowstorm/import/"
  exit 1
fi

echo "✅ SNOMED CT files found"

echo ""
echo "⚠️  IMPORTANT: This will import SNOMED CT data into Snowstorm."
echo "   The import process may take 30-60 minutes."
echo "   Existing test data on MAIN branch will be replaced."
echo ""
read -p "Continue? (y/N) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
  echo "Import cancelled."
  exit 0
fi

echo ""
echo "🔄 Starting SNOMED CT import..."

# For Snowstorm, we need to import SNAPSHOT first, then FULL
# But since there's existing test data, we'll try SNAPSHOT which should work

echo ""
echo "📥 Step 1: Importing SNAPSHOT (this may take 20-30 minutes)..."
SNAPSHOT_RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "${SNOMED_BASE_URL}/imports" \
  -H "Content-Type: application/json" \
  -d "{
    \"branchPath\": \"MAIN\",
    \"createCodeSystemVersion\": true,
    \"type\": \"SNAPSHOT\",
    \"filePath\": \"${IMPORT_DIR}/Snapshot\"
  }")

HTTP_CODE=$(echo "$SNAPSHOT_RESPONSE" | tail -1)
RESPONSE_BODY=$(echo "$SNAPSHOT_RESPONSE" | head -n -1)

echo "HTTP Status: $HTTP_CODE"
echo "Response: $RESPONSE_BODY"

if [ "$HTTP_CODE" != "201" ] && [ "$HTTP_CODE" != "200" ]; then
  if echo "$RESPONSE_BODY" | grep -q "error"; then
    echo "❌ SNAPSHOT import failed: $RESPONSE_BODY"
    echo ""
    echo "💡 Tip: If you see 'existing content' error, you may need to:"
    echo "   1. Stop Snowstorm"
    echo "   2. Delete Elasticsearch indices"
    echo "   3. Restart Snowstorm"
    echo "   4. Run this script again"
    exit 1
  fi
fi

echo ""
echo "✅ SNAPSHOT import job created!"
echo ""
echo "📊 The import is running in the background."
echo "   Monitor progress with:"
echo "   docker compose logs -f snowstorm | grep -i import"
echo ""
echo "⏳ This will take 30-60 minutes. You can check if it's complete by:"
echo "   curl -s '${SNOMED_BASE_URL}/browser/MAIN/concepts?term=vital%20signs&limit=1' | jq '.items[0].conceptId'"
echo ""
echo "   When complete, you should see a real SNOMED CT concept ID (not starting with 9999)"
