#!/bin/bash

# Script to check SNOMED CT import status

SNOMED_BASE_URL="${SNOMED_BASE_URL:-http://localhost:8080}"

echo "🔍 Checking SNOMED CT Import Status..."
echo ""

# Check if Snowstorm is running
if ! curl -s -f "${SNOMED_BASE_URL}/actuator/health" > /dev/null 2>&1; then
  echo "❌ Snowstorm is not running"
  exit 1
fi

echo "✅ Snowstorm is running"
echo ""

# Check if we can query concepts (indicates import is at least partially complete)
echo "📊 Testing SNOMED CT search..."
TEST_RESULT=$(curl -s "${SNOMED_BASE_URL}/browser/MAIN/concepts?term=diabetes&limit=1" 2>/dev/null)

if echo "$TEST_RESULT" | grep -q "conceptId"; then
  CONCEPT_COUNT=$(echo "$TEST_RESULT" | python3 -c "import sys, json; data=json.load(sys.stdin); print(data.get('total', 0))" 2>/dev/null || echo "unknown")
  echo "✅ SNOMED CT data is available!"
  echo "   Total concepts: ${CONCEPT_COUNT}"
  
  # Check for test data
  FIRST_CONCEPT_ID=$(echo "$TEST_RESULT" | python3 -c "import sys, json; data=json.load(sys.stdin); items=data.get('items', []); print(items[0].get('conceptId', '') if items else '')" 2>/dev/null || echo "")
  if [ -n "$FIRST_CONCEPT_ID" ] && [[ "$FIRST_CONCEPT_ID" == 9999* ]]; then
    echo "   ⚠️  WARNING: Test data detected (concept IDs starting with 9999)"
    echo "   Import may not be complete or may have failed"
  else
    echo "   ✅ Real SNOMED CT data detected"
  fi
else
  echo "⏳ SNOMED CT import is still in progress or not started"
  echo "   No concepts available yet"
fi

echo ""
echo "📋 Recent Snowstorm logs:"
docker-compose logs snowstorm 2>&1 | grep -i "import\|error\|completed" | tail -10

echo ""
echo "💡 To monitor import progress:"
echo "   docker-compose logs -f snowstorm | grep -i import"
