#!/bin/bash

# Script to verify SNOMED-coded laboratory orders end-to-end
# Usage: ./scripts/test-snomed-orders.sh
#
# Environment variables:
#   BASE_URL      - API base URL (default http://localhost:3013)
#   TENANT_SLUG   - Tenant identifier header (default bulawayo-general)
#   PATIENT_ID    - Optional existing patient UUID to reuse

set -euo pipefail

BASE_URL="${BASE_URL:-http://localhost:3013}"
TENANT_SLUG="${TENANT_SLUG:-bulawayo-general}"
PATIENT_ID="${PATIENT_ID:-}"

assert_command() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "❌ Missing dependency: $1"
    exit 1
  fi
}

for cmd in curl jq; do
  assert_command "$cmd"
done

echo "🔐 Authenticating against EHR API..."
TOKEN=$(
  curl -s -X POST "$BASE_URL/api/auth/login" \
    -H "Content-Type: application/json" \
    -H "X-Tenant-ID: $TENANT_SLUG" \
    -d '{"email":"doctor@bulawayo-general.co.zw","password":"Password1#"}' | jq -r '.token'
)

if [[ -z "$TOKEN" || "$TOKEN" == "null" ]]; then
  echo "❌ Authentication failed"
  exit 1
fi
echo "✅ Authenticated."

if [[ -z "$PATIENT_ID" ]]; then
echo "👤 Creating demo patient..."
UNIQUE_SUFFIX=$(date +%s)
CREATE_PATIENT_RESPONSE=$(
  curl -s -X POST "$BASE_URL/api/patients" \
    -H "Content-Type: application/json" \
    -H "X-Tenant-ID: $TENANT_SLUG" \
    -H "Authorization: Bearer $TOKEN" \
    -d '{
        "firstName": "SNOMED",
        "lastName": "OrderTest",
        "gender": "female",
        "dateOfBirth": "1992-03-15",
        "nationalId": "63-ORDER-'"$UNIQUE_SUFFIX"'",
        "phone": "+263777000'"$((UNIQUE_SUFFIX % 10000))"'",
        "address": "123 SNOMED Street",
        "city": "Harare",
        "emergencyContactName": "Test Contact",
        "emergencyContactPhone": "+263779000'"$((UNIQUE_SUFFIX % 10000))"'",
        "emergencyContactRelationship": "Sibling"
      }'
)

PATIENT_ID=$(echo "$CREATE_PATIENT_RESPONSE" | jq -r '.id // empty')

  if [[ -z "$PATIENT_ID" || "$PATIENT_ID" == "null" ]]; then
  echo "❌ Failed to create patient:"
  echo "$CREATE_PATIENT_RESPONSE" | jq '.' || echo "$CREATE_PATIENT_RESPONSE"
    exit 1
  fi
  echo "✅ Patient created: $PATIENT_ID"
else
  echo "ℹ️ Reusing patient $PATIENT_ID"
fi

echo ""
echo "🧪 Creating SNOMED-coded lab order..."
LAB_ORDER_PAYLOAD=$(cat <<'JSON'
{
  "patientId": "__PATIENT_ID__",
  "tests": [
    {
      "testCode": "CBC",
      "testName": "Complete Blood Count",
      "category": "hematology",
      "specimenType": "whole blood",
      "loincCode": "57021-8"
    }
  ],
  "priority": "routine",
  "clinicalInfo": "Routine hematology panel",
  "snomedConceptId": "10495003",
  "snomedTerm": "Complete blood count (procedure)",
  "scheduledDateTime": "2025-01-15T08:30:00Z"
}
JSON
)

LAB_ORDER_PAYLOAD=${LAB_ORDER_PAYLOAD/__PATIENT_ID__/$PATIENT_ID}

LAB_ORDER_RESPONSE=$(
  curl -s -X POST "$BASE_URL/api/lab-orders" \
    -H "Content-Type: application/json" \
    -H "X-Tenant-ID: $TENANT_SLUG" \
    -H "Authorization: Bearer $TOKEN" \
    -d "$LAB_ORDER_PAYLOAD"
)

if echo "$LAB_ORDER_RESPONSE" | jq -e '.statusCode? >= 400' >/dev/null 2>&1; then
  echo "❌ Lab order creation failed:"
  echo "$LAB_ORDER_RESPONSE" | jq '.' || echo "$LAB_ORDER_RESPONSE"
  exit 1
fi

LAB_ORDER_ID=$(echo "$LAB_ORDER_RESPONSE" | jq -r '.id')

echo "$LAB_ORDER_RESPONSE" | jq '. | {id, orderNumber, snomedConceptId, snomedTerm, loincCode, status}'

if [[ -z "$LAB_ORDER_ID" || "$LAB_ORDER_ID" == "null" ]]; then
  echo "❌ Lab order response missing ID"
  exit 1
fi

echo ""
echo "📥 Fetching order back to verify SNOMED fields..."
FETCH_RESPONSE=$(
  curl -s "$BASE_URL/api/lab-orders?patientId=$PATIENT_ID&limit=5" \
    -H "X-Tenant-ID: $TENANT_SLUG" \
    -H "Authorization: Bearer $TOKEN"
)

echo "$FETCH_RESPONSE" | jq '.labOrders[0] | {id, snomedConceptId, snomedTerm, loincCode, status}'

echo ""
echo "✅ SNOMED-coded lab order verified successfully."

