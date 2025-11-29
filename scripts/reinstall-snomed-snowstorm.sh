#!/bin/bash

# Comprehensive SNOMED CT and Snowstorm Reinstallation Script
# This script cleans up old data and reinstalls with improved search configuration

set -e

SNOMED_BASE_URL="${SNOMED_BASE_URL:-http://localhost:8080}"
ELASTICSEARCH_URL="${ELASTICSEARCH_URL:-http://localhost:9200}"
DOWNLOADS_DIR="$HOME/Downloads"
SNOMED_MAIN_FILE="SnomedCT_InternationalRF2_PRODUCTION_20251101T120000Z.zip"
SNOMED_ICD10_FILE="SNOMED_CT_to_ICD-10-CM_Resources_20250901.zip"
SNOMED_IMPORT_DIR="./snowstorm/import"
SNOMED_DATA_DIR="./snowstorm/data"
ES_DATA_DIR="./snowstorm/es-data"

echo "=========================================="
echo "SNOMED CT & Snowstorm Reinstallation"
echo "=========================================="
echo ""

# Step 1: Stop services
echo "🛑 Step 1: Stopping Snowstorm and Elasticsearch..."
docker-compose stop snowstorm elasticsearch 2>/dev/null || true
echo "✅ Services stopped"
echo ""

# Step 2: Clean up old data
echo "🧹 Step 2: Cleaning up old SNOMED CT data..."
echo "   This will remove:"
echo "   - Snowstorm data directory"
echo "   - Elasticsearch indices"
echo "   - Old import files"
echo ""
read -p "   Continue with cleanup? (y/N) " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
  echo "   Removing Snowstorm data..."
  rm -rf "${SNOMED_DATA_DIR}"/* 2>/dev/null || true
  echo "   ✅ Snowstorm data cleaned"
  
  echo "   Removing Elasticsearch data..."
  rm -rf "${ES_DATA_DIR}"/* 2>/dev/null || true
  echo "   ✅ Elasticsearch data cleaned"
  
  echo "   Removing old import files..."
  rm -rf "${SNOMED_IMPORT_DIR}"/* 2>/dev/null || true
  echo "   ✅ Old import files removed"
else
  echo "   ⚠️  Skipping cleanup - using existing data"
fi
echo ""

# Step 3: Verify source files
echo "📦 Step 3: Verifying source files..."
if [ ! -f "${DOWNLOADS_DIR}/${SNOMED_MAIN_FILE}" ]; then
  echo "   ❌ Main SNOMED CT file not found: ${DOWNLOADS_DIR}/${SNOMED_MAIN_FILE}"
  exit 1
fi
echo "   ✅ Found: ${SNOMED_MAIN_FILE}"

if [ ! -f "${DOWNLOADS_DIR}/${SNOMED_ICD10_FILE}" ]; then
  echo "   ⚠️  ICD-10 mapping file not found: ${DOWNLOADS_DIR}/${SNOMED_ICD10_FILE}"
  echo "   Continuing without ICD-10 mappings..."
else
  echo "   ✅ Found: ${SNOMED_ICD10_FILE}"
fi
echo ""

# Step 4: Extract SNOMED CT files
echo "📂 Step 4: Extracting SNOMED CT files..."
mkdir -p "${SNOMED_IMPORT_DIR}"

echo "   Extracting main SNOMED CT file (this may take a few minutes)..."
cd "${SNOMED_IMPORT_DIR}"
unzip -q "${DOWNLOADS_DIR}/${SNOMED_MAIN_FILE}" -d . 2>/dev/null || {
  echo "   ❌ Failed to extract main file"
  exit 1
}
echo "   ✅ Main SNOMED CT file extracted"

# Find the extracted directory
SNOMED_DIR=$(find . -maxdepth 1 -type d -name "SnomedCT_InternationalRF2_PRODUCTION_*" | head -1)
if [ -z "$SNOMED_DIR" ]; then
  echo "   ❌ Could not find extracted SNOMED CT directory"
  exit 1
fi
echo "   Found SNOMED CT directory: ${SNOMED_DIR}"

# Extract ICD-10 mapping if available
if [ -f "${DOWNLOADS_DIR}/${SNOMED_ICD10_FILE}" ]; then
  echo "   Extracting ICD-10 mapping file..."
  unzip -q "${DOWNLOADS_DIR}/${SNOMED_ICD10_FILE}" -d . 2>/dev/null || {
    echo "   ⚠️  Failed to extract ICD-10 mapping (non-critical)"
  }
  echo "   ✅ ICD-10 mapping extracted"
fi

cd - > /dev/null
echo ""

# Step 5: Start Elasticsearch with proper configuration
echo "🚀 Step 5: Starting Elasticsearch..."
docker-compose up -d elasticsearch

echo "   Waiting for Elasticsearch to be ready..."
for i in {1..30}; do
  if curl -s -f "${ELASTICSEARCH_URL}/_cluster/health" > /dev/null 2>&1; then
    echo "   ✅ Elasticsearch is ready"
    break
  fi
  if [ $i -eq 30 ]; then
    echo "   ❌ Elasticsearch failed to start"
    exit 1
  fi
  sleep 2
done
echo ""

# Step 6: Configure Elasticsearch for better SNOMED search
echo "⚙️  Step 6: Configuring Elasticsearch for improved SNOMED search..."
curl -s -X PUT "${ELASTICSEARCH_URL}/_cluster/settings" \
  -H "Content-Type: application/json" \
  -d '{
    "persistent": {
      "action.auto_create_index": "true"
    }
  }' > /dev/null

# Create custom analyzer for better SNOMED term matching
curl -s -X PUT "${ELASTICSEARCH_URL}/_template/snomed_terms" \
  -H "Content-Type: application/json" \
  -d '{
    "index_patterns": ["snomed*"],
    "settings": {
      "analysis": {
        "analyzer": {
          "snomed_term_analyzer": {
            "type": "custom",
            "tokenizer": "standard",
            "filter": [
              "lowercase",
              "asciifolding",
              "snomed_term_filter"
            ]
          }
        },
        "filter": {
          "snomed_term_filter": {
            "type": "word_delimiter",
            "preserve_original": true,
            "split_on_numerics": false
          }
        }
      }
    }
  }' > /dev/null

echo "   ✅ Elasticsearch configured"
echo ""

# Step 7: Start Snowstorm
echo "🚀 Step 7: Starting Snowstorm..."
docker-compose up -d snowstorm

echo "   Waiting for Snowstorm to be ready..."
for i in {1..60}; do
  if curl -s -f "${SNOMED_BASE_URL}/actuator/health" > /dev/null 2>&1; then
    echo "   ✅ Snowstorm is ready"
    break
  fi
  if [ $i -eq 60 ]; then
    echo "   ❌ Snowstorm failed to start"
    docker-compose logs snowstorm | tail -20
    exit 1
  fi
  sleep 2
done
echo ""

# Step 8: Import SNOMED CT data
echo "📥 Step 8: Importing SNOMED CT data..."
echo "   This will take 30-60 minutes. Please be patient."
echo ""

# Determine which import type to use (Snapshot or Full)
SNOMED_SNAPSHOT_PATH="${SNOMED_IMPORT_DIR}/${SNOMED_DIR}/Snapshot"
SNOMED_FULL_PATH="${SNOMED_IMPORT_DIR}/${SNOMED_DIR}/Full"
IMPORT_TYPE=""
IMPORT_PATH=""

if [ -d "${SNOMED_SNAPSHOT_PATH}" ]; then
  IMPORT_TYPE="SNAPSHOT"
  IMPORT_PATH="${SNOMED_SNAPSHOT_PATH}"
  echo "   Using SNAPSHOT import (faster, recommended for initial import)"
elif [ -d "${SNOMED_FULL_PATH}" ]; then
  IMPORT_TYPE="FULL"
  IMPORT_PATH="${SNOMED_FULL_PATH}"
  echo "   Using FULL import (complete, takes longer)"
else
  echo "   ❌ SNOMED CT directory structure not recognized"
  echo "   Expected: ${SNOMED_SNAPSHOT_PATH} or ${SNOMED_FULL_PATH}"
  exit 1
fi

echo "   Creating import job for ${IMPORT_TYPE}..."
# Convert relative path to absolute path inside container
IMPORT_PATH_ABS="/opt/snowstorm/import/$(basename ${SNOMED_DIR})/$(basename ${IMPORT_PATH})"
echo "   Using path: ${IMPORT_PATH_ABS}"

IMPORT_RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "${SNOMED_BASE_URL}/imports" \
  -H "Content-Type: application/json" \
  -d "{
    \"branchPath\": \"MAIN\",
    \"createCodeSystemVersion\": true,
    \"type\": \"${IMPORT_TYPE}\",
    \"filePath\": \"${IMPORT_PATH_ABS}\"
  }")

HTTP_CODE=$(echo "$IMPORT_RESPONSE" | tail -1)
RESPONSE_BODY=$(echo "$IMPORT_RESPONSE" | head -n -1)

if [ "$HTTP_CODE" != "201" ] && [ "$HTTP_CODE" != "200" ]; then
  echo "   ❌ Import job creation failed"
  echo "   HTTP Status: $HTTP_CODE"
  echo "   Response: $RESPONSE_BODY"
  exit 1
fi

IMPORT_ID=$(echo "$RESPONSE_BODY" | grep -o '"id":"[^"]*' | cut -d'"' -f4 || echo "")
if [ -z "$IMPORT_ID" ]; then
  echo "   ⚠️  Could not extract import ID, but job may have been created"
  echo "   Response: $RESPONSE_BODY"
else
  echo "   ✅ Import job created: ${IMPORT_ID}"
fi

echo ""
echo "=========================================="
echo "✅ Reinstallation Complete!"
echo "=========================================="
echo ""
echo "📊 Monitor import progress:"
echo "   docker-compose logs -f snowstorm | grep -i import"
echo ""
echo "🔍 Check import status:"
echo "   curl -s '${SNOMED_BASE_URL}/imports/${IMPORT_ID}' | jq '.'"
echo ""
echo "🧪 Test search (after import completes):"
echo "   curl -s '${SNOMED_BASE_URL}/browser/MAIN/concepts?term=diabetes&limit=5' | jq '.items[].pt.term'"
echo ""
echo "⏳ Import typically takes 30-60 minutes."
echo "   You can check if it's complete by running the test command above."
echo ""

