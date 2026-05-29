#!/bin/bash

# Load environment variables
source "$(dirname "$0")/load-env.sh"
set -euo pipefail

# -----------------------------------------------------------------------------
# Import SNOMED CT RF2 data into the local Snowstorm instance.
#
# Prerequisites:
#   1. Download an official SNOMED CT RF2 release (zip) from SNOMED International.
#   2. Extract the zip into ./snowstorm/import (keep the directory structure).
#   3. Start the Snowstorm container (`docker-compose up -d snowstorm`).
#
# Usage:
#   ./scripts/import-snomed-rf2.sh
# -----------------------------------------------------------------------------

SNOWSTORM_CONTAINER=${SNOWSTORM_CONTAINER:-umoya-snowstorm}
IMPORT_PATH="/opt/snowstorm/import"

if ! docker ps --format '{{.Names}}' | grep -q "^${SNOWSTORM_CONTAINER}$"; then
  echo "❌ Snowstorm container \"${SNOWSTORM_CONTAINER}\" is not running."
  echo "   Run: docker-compose up -d snowstorm"
  exit 1
fi

echo "🚀 Triggering SNOMED CT RF2 import..."
IMPORT_RESPONSE=$(docker exec "${SNOWSTORM_CONTAINER}" curl -s -X POST "$SNOWSTORM_URL/imports" \
  -H "Content-Type: application/json" \
  -d '{
        "importType": "FULL",
        "branchPath": "MAIN",
        "createCodeSystem": true,
        "codeSystemShortName": "SNOMEDCT",
        "contentType": "SNAPSHOT",
        "files": []
      }')

echo "${IMPORT_RESPONSE}"
echo ""
echo "✅ Import request submitted. Monitor progress with:"
echo "   docker exec ${SNOWSTORM_CONTAINER} curl -s $SNOWSTORM_URL/imports | jq '.'"
echo ""
echo "ℹ️  Ensure the RF2 files are extracted under ./snowstorm/import prior to running this script."


