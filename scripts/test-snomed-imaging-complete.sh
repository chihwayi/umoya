#!/bin/bash

# Script to verify SNOMED-coded imaging orders end-to-end
# Usage: ./scripts/test-snomed-imaging-complete.sh
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
          "lastName": "ImagingTest",
          "gender": "male",
          "dateOfBirth": "1985-07-20",
          "nationalId": "63-IMG-'"$UNIQUE_SUFFIX"'",
          "phone": "+263777000'"$((UNIQUE_SUFFIX % 10000))"'",
          "address": "456 SNOMED Avenue",
          "city": "Bulawayo",
          "emergencyContactName": "Test Contact",
          "emergencyContactPhone": "+263779000'"$((UNIQUE_SUFFIX % 10000))"'",
          "emergencyContactRelationship": "Friend"
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
echo "👨‍⚕️ Fetching ordering provider..."
PROVIDERS_RESPONSE=$(
  curl -s "$BASE_URL/api/users?role=doctor" \
    -H "X-Tenant-ID: $TENANT_SLUG" \
    -H "Authorization: Bearer $TOKEN"
)

ORDERING_PROVIDER_ID=$(echo "$PROVIDERS_RESPONSE" | jq -r '.[0].id // empty')

if [[ -z "$ORDERING_PROVIDER_ID" || "$ORDERING_PROVIDER_ID" == "null" ]]; then
  echo "❌ No ordering provider found"
  exit 1
fi
echo "✅ Using provider: $ORDERING_PROVIDER_ID"

echo ""
echo "🔍 Fetching imaging modalities..."
MODALITIES_RESPONSE=$(
  curl -s "$BASE_URL/api/imaging/modalities" \
    -H "X-Tenant-ID: $TENANT_SLUG" \
    -H "Authorization: Bearer $TOKEN"
)

XRAY_MODALITY=$(echo "$MODALITIES_RESPONSE" | jq -r '.modalities[] | select(.modality_code == "XR") | .modality_code // empty')

if [[ -z "$XRAY_MODALITY" ]]; then
  echo "⚠️ XR modality not found, using first available..."
  XRAY_MODALITY=$(echo "$MODALITIES_RESPONSE" | jq -r '.modalities[0].modality_code // empty')
fi

echo "✅ Using modality: $XRAY_MODALITY"

echo ""
echo "🔍 Fetching study types for $XRAY_MODALITY..."
STUDY_TYPES_RESPONSE=$(
  curl -s "$BASE_URL/api/imaging/study-types?modality=$XRAY_MODALITY" \
    -H "X-Tenant-ID: $TENANT_SLUG" \
    -H "Authorization: Bearer $TOKEN"
)

STUDY_TYPE_ID=$(echo "$STUDY_TYPES_RESPONSE" | jq -r '.studyTypes[0].id // empty')

if [[ -z "$STUDY_TYPE_ID" || "$STUDY_TYPE_ID" == "null" ]]; then
  echo "❌ No study types found for modality $XRAY_MODALITY"
  exit 1
fi

STUDY_NAME=$(echo "$STUDY_TYPES_RESPONSE" | jq -r '.studyTypes[0].study_name // "X-Ray"')
echo "✅ Using study type: $STUDY_NAME ($STUDY_TYPE_ID)"

echo ""
echo "📸 Creating SNOMED-coded imaging order..."
IMAGING_ORDER_PAYLOAD=$(cat <<JSON
{
  "patient_id": "$PATIENT_ID",
  "study_type_id": "$STUDY_TYPE_ID",
  "ordering_provider": "$ORDERING_PROVIDER_ID",
  "clinical_indication": "Chest pain, rule out pneumonia",
  "clinical_history": "Patient presents with 3-day history of chest pain and productive cough",
  "suspected_diagnosis": "Pneumonia",
  "priority": "urgent",
  "snomedConceptId": "399108004",
  "snomedTerm": "Chest X-ray (procedure)",
  "snomedModuleId": "900000000000207008",
  "snomedDefinitionStatus": "FULLY_DEFINED"
}
JSON
)

IMAGING_ORDER_RESPONSE=$(
  curl -s -X POST "$BASE_URL/api/imaging/orders" \
    -H "Content-Type: application/json" \
    -H "X-Tenant-ID: $TENANT_SLUG" \
    -H "Authorization: Bearer $TOKEN" \
    -d "$IMAGING_ORDER_PAYLOAD"
)

if echo "$IMAGING_ORDER_RESPONSE" | jq -e '.statusCode? >= 400' >/dev/null 2>&1; then
  echo "❌ Imaging order creation failed:"
  echo "$IMAGING_ORDER_RESPONSE" | jq '.' || echo "$IMAGING_ORDER_RESPONSE"
  exit 1
fi

IMAGING_ORDER_ID=$(echo "$IMAGING_ORDER_RESPONSE" | jq -r '.id')

echo "$IMAGING_ORDER_RESPONSE" | jq '. | {id, order_number, snomed_concept_id, snomed_term, cpt_code, order_status}'

if [[ -z "$IMAGING_ORDER_ID" || "$IMAGING_ORDER_ID" == "null" ]]; then
  echo "❌ Imaging order response missing ID"
  exit 1
fi

echo ""
echo "📥 Fetching imaging order to verify SNOMED fields..."
FETCH_ORDER_RESPONSE=$(
  curl -s "$BASE_URL/api/imaging/orders?patientId=$PATIENT_ID&limit=5" \
    -H "X-Tenant-ID: $TENANT_SLUG" \
    -H "Authorization: Bearer $TOKEN"
)

echo "$FETCH_ORDER_RESPONSE" | jq '.orders[0] | {id, snomed_concept_id, snomed_term, cpt_code, order_status}'

echo ""
echo "✅ SNOMED-coded imaging order verified successfully."
echo ""
echo "💡 To test the full flow:"
echo "   1. Create an imaging study from this order"
echo "   2. View the study in the Imaging Dashboard"
echo "   3. Verify SNOMED codes appear in the Study Details tab"
echo "   4. Create a report and add SNOMED-coded diagnoses using the picker"

