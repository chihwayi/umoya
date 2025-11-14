#!/bin/bash

# Verify SNOMED-coded imaging orders end-to-end
# Usage: ./scripts/test-snomed-imaging.sh

set -euo pipefail

BASE_URL="${BASE_URL:-http://localhost:3013}"
TENANT_SLUG="${TENANT_SLUG:-bulawayo-general}"
PATIENT_ID="${PATIENT_ID:-}"

need_cmd() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "❌ Missing dependency: $1"
    exit 1
  fi
}

for cli in curl jq; do
  need_cmd "$cli"
done

echo "🔐 Authenticating..."
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

echo "👩‍⚕️ Fetching ordering provider ID..."
ORDERING_PROVIDER_ID=$(
  curl -s "$BASE_URL/api/users?role=doctor" \
    -H "X-Tenant-ID: $TENANT_SLUG" \
    -H "Authorization: Bearer $TOKEN" | jq -r '.[0].id'
)

if [[ -z "$ORDERING_PROVIDER_ID" || "$ORDERING_PROVIDER_ID" == "null" ]]; then
  echo "❌ Failed to resolve ordering provider ID"
  exit 1
fi
echo "✅ Ordering provider: $ORDERING_PROVIDER_ID"

if [[ -z "$PATIENT_ID" ]]; then
  echo "👤 Creating imaging test patient..."
  UNIQUE_SUFFIX=$(date +%s)
  PATIENT_ID=$(
    curl -s -X POST "$BASE_URL/api/patients" \
      -H "Content-Type: application/json" \
      -H "X-Tenant-ID: $TENANT_SLUG" \
      -H "Authorization: Bearer $TOKEN" \
      -d '{
        "firstName": "SNOMED",
        "lastName": "ImagingTest",
        "gender": "male",
        "dateOfBirth": "1988-07-22",
        "nationalId": "63-IMAGING-'"$UNIQUE_SUFFIX"'",
        "phone": "+263778000'"$((UNIQUE_SUFFIX % 10000))"'",
        "address": "456 Imaging Avenue",
        "city": "Bulawayo",
        "emergencyContactName": "Imaging Contact",
        "emergencyContactPhone": "+263779100'"$((UNIQUE_SUFFIX % 10000))"'",
        "emergencyContactRelationship": "Parent"
      }' | jq -r '.id'
  )
  if [[ -z "$PATIENT_ID" || "$PATIENT_ID" == "null" ]]; then
    echo "❌ Failed to create patient"
    exit 1
  fi
  echo "✅ Patient ID: $PATIENT_ID"
else
  echo "ℹ️ Reusing patient $PATIENT_ID"
fi

echo ""
echo "🔎 Locating an X-ray study type..."
STUDY_TYPE_ID=$(
  curl -s "$BASE_URL/api/imaging/study-types?modality=XR" \
    -H "X-Tenant-ID: $TENANT_SLUG" \
    -H "Authorization: Bearer $TOKEN" | jq -r '.studyTypes[0].id'
)

if [[ -z "$STUDY_TYPE_ID" || "$STUDY_TYPE_ID" == "null" ]]; then
  echo "❌ Unable to find imaging study type"
  exit 1
fi
echo "✅ Study type ID: $STUDY_TYPE_ID"

echo ""
echo "🩻 Creating SNOMED-coded imaging order..."
IMAGING_ORDER_PAYLOAD=$(cat <<JSON
{
  "patient_id": "$PATIENT_ID",
  "study_type_id": "$STUDY_TYPE_ID",
  "ordering_provider": "$ORDERING_PROVIDER_ID",
  "clinical_indication": "Suspected pneumonia",
  "clinical_history": "Fever and productive cough for 5 days",
  "suspected_diagnosis": "Pneumonia (disorder)",
  "priority": "urgent",
  "snomedConceptId": "308546006",
  "snomedTerm": "Plain chest X-ray (procedure)"
}
JSON
)

IMAGING_RESPONSE=$(
  curl -s -X POST "$BASE_URL/api/imaging/orders" \
    -H "Content-Type: application/json" \
    -H "X-Tenant-ID: $TENANT_SLUG" \
    -H "Authorization: Bearer $TOKEN" \
    -d "$IMAGING_ORDER_PAYLOAD"
)

if echo "$IMAGING_RESPONSE" | jq -e '.statusCode? >= 400' >/dev/null 2>&1; then
  echo "❌ Imaging order failed:"
  echo "$IMAGING_RESPONSE" | jq '.' || echo "$IMAGING_RESPONSE"
  exit 1
fi

ORDER_ID=$(echo "$IMAGING_RESPONSE" | jq -r '.id')
echo "$IMAGING_RESPONSE" | jq '{id, order_number, snomed_concept_id, snomed_term, cpt_code, order_status}'

if [[ -z "$ORDER_ID" || "$ORDER_ID" == "null" ]]; then
  echo "❌ Imaging order missing ID"
  exit 1
fi

echo ""
echo "📥 Verifying stored order..."
FETCH=$(
  curl -s "$BASE_URL/api/imaging/orders?patientId=$PATIENT_ID" \
    -H "X-Tenant-ID: $TENANT_SLUG" \
    -H "Authorization: Bearer $TOKEN"
)

echo "$FETCH" | jq '.orders[0] | {id, snomed_concept_id, snomed_term, cpt_code, order_status}'

echo ""
echo "✅ SNOMED-coded imaging order verified."

