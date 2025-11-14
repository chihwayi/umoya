#!/bin/bash

# Script to manually test SNOMED CT Terminology endpoints
# Usage: ./scripts/test-snomed-endpoints.sh

set -e

TENANT_SLUG="${TENANT_SLUG:-bulawayo-general}"
BASE_URL="http://localhost:3013"
TENANT_ID="bulawayo-general"

echo "🧪 Testing SNOMED CT Terminology Endpoints"
echo "=========================================="
echo ""

# Get authentication token
echo "1. Authenticating..."
TOKEN=$(curl -s -X POST "$BASE_URL/api/auth/login" \
  -H "Content-Type: application/json" \
  -H "X-Tenant-ID: $TENANT_ID" \
  -d '{"email":"doctor@bulawayo-general.co.zw","password":"Password1#"}' | jq -r '.token')

if [ "$TOKEN" == "null" ] || [ -z "$TOKEN" ]; then
    echo "❌ Authentication failed!"
    exit 1
fi

echo "✅ Authenticated successfully"
echo ""

# Test 1: Search Concepts
echo "2. Testing Search Concepts Endpoint..."
echo "   GET /api/terminology/snomed/search?term=diabetes"
SEARCH_RESULT=$(curl -s -X GET "$BASE_URL/api/terminology/snomed/search?term=diabetes&limit=5" \
  -H "Authorization: Bearer $TOKEN" \
  -H "X-Tenant-ID: $TENANT_ID")

echo "$SEARCH_RESULT" | jq '.' || echo "$SEARCH_RESULT"
echo ""

# Test 2: Validate Concept (using a common SNOMED CT code)
echo "3. Testing Validate Concept Endpoint..."
echo "   GET /api/terminology/snomed/validate/73211009"
VALIDATE_RESULT=$(curl -s -X GET "$BASE_URL/api/terminology/snomed/validate/73211009" \
  -H "Authorization: Bearer $TOKEN" \
  -H "X-Tenant-ID: $TENANT_ID")

echo "$VALIDATE_RESULT" | jq '.' || echo "$VALIDATE_RESULT"
echo ""

# Test 3: Get Concept Details
echo "4. Testing Get Concept Details Endpoint..."
echo "   GET /api/terminology/snomed/concepts/73211009/details"
DETAILS_RESULT=$(curl -s -X GET "$BASE_URL/api/terminology/snomed/concepts/73211009/details" \
  -H "Authorization: Bearer $TOKEN" \
  -H "X-Tenant-ID: $TENANT_ID")

echo "$DETAILS_RESULT" | jq '.' || echo "$DETAILS_RESULT"
echo ""

# Test 4: Map Concept
echo "5. Testing Map Concept Endpoint..."
echo "   GET /api/terminology/snomed/map/73211009/ICD10"
MAP_RESULT=$(curl -s -X GET "$BASE_URL/api/terminology/snomed/map/73211009/ICD10" \
  -H "Authorization: Bearer $TOKEN" \
  -H "X-Tenant-ID: $TENANT_ID")

echo "$MAP_RESULT" | jq '.' || echo "$MAP_RESULT"
echo ""

# Test 5: Error Handling - Invalid concept ID
echo "6. Testing Error Handling..."
echo "   GET /api/terminology/snomed/validate/invalid"
ERROR_RESULT=$(curl -s -X GET "$BASE_URL/api/terminology/snomed/validate/invalid" \
  -H "Authorization: Bearer $TOKEN" \
  -H "X-Tenant-ID: $TENANT_ID")

echo "$ERROR_RESULT" | jq '.' || echo "$ERROR_RESULT"
echo ""

# Test 6: Error Handling - Short search term
echo "7. Testing Error Handling - Short Search Term..."
echo "   GET /api/terminology/snomed/search?term=a"
SHORT_SEARCH=$(curl -s -X GET "$BASE_URL/api/terminology/snomed/search?term=a" \
  -H "Authorization: Bearer $TOKEN" \
  -H "X-Tenant-ID: $TENANT_ID")

echo "$SHORT_SEARCH" | jq '.' || echo "$SHORT_SEARCH"
echo ""

echo "✅ Endpoint testing complete!"
echo ""
echo "📊 Summary:"
echo "   - Search endpoint: Tested"
echo "   - Validate endpoint: Tested"
echo "   - Details endpoint: Tested"
echo "   - Map endpoint: Tested"
echo "   - Error handling: Tested"

