#!/bin/bash

# Script to exercise SNOMED-coded clinical endpoints (problems + allergies)
# Usage: ./scripts/test-snomed-clinical.sh
#
# Requirements:
#   - jq installed on host
#   - MediCore Docker stack running (ehr-service reachable on localhost:3013)
#   - Default doctor user (doctor@bulawayo-general.co.zw / Password1#)

set -euo pipefail

TENANT_SLUG="${TENANT_SLUG:-bulawayo-general}"
BASE_URL="${BASE_URL:-http://localhost:3013}"
EMAIL="${EHR_EMAIL:-doctor@bulawayo-general.co.zw}"
PASSWORD="${EHR_PASSWORD:-Password1#}"

if ! command -v jq >/dev/null 2>&1; then
  echo "❌ jq is required. Please install jq to continue."
  exit 1
fi

echo "🔐 Authenticating against EHR API..."
TOKEN=$(curl -s -X POST "$BASE_URL/api/auth/login" \
  -H "Content-Type: application/json" \
  -H "X-Tenant-ID: $TENANT_SLUG" \
  -d "{\"email\":\"$EMAIL\",\"password\":\"$PASSWORD\"}" | jq -r '.token')

if [ -z "$TOKEN" ] || [ "$TOKEN" == "null" ]; then
  echo "❌ Authentication failed. Check credentials and tenant slug."
  exit 1
fi
echo "✅ Authenticated."

PATIENT_ID="${PATIENT_ID:-}"

if [ -z "$PATIENT_ID" ] || [ "$PATIENT_ID" == "null" ]; then
  echo "🩺 Fetching a patient record (override with PATIENT_ID env var)..."
  PATIENT_ID=$(curl -s "$BASE_URL/api/patients?limit=1" \
    -H "X-Tenant-ID: $TENANT_SLUG" \
    -H "Authorization: Bearer $TOKEN" | jq -r '.data[0].id')
fi

if [ -z "$PATIENT_ID" ] || [ "$PATIENT_ID" == "null" ]; then
  echo "⚠️  No patient found. Attempting to create a demo patient..."
  PATIENT_PAYLOAD=$(cat <<'JSON'
{
  "firstName": "SNOMED",
  "lastName": "Demo",
  "dateOfBirth": "1990-01-01",
  "gender": "female",
  "nationalId": "63-000000-X-00",
  "phone": "+263771000000",
  "email": "snomed.demo@example.com",
  "address": "123 Terminology Lane",
  "city": "Harare",
  "emergencyContactName": "Terminology Contact",
  "emergencyContactPhone": "+263772000000",
  "emergencyContactRelationship": "Spouse",
  "medicalAidProvider": "None",
  "medicalAidNumber": "N/A",
  "medicalHistory": "None recorded",
  "allergies": "None reported"
}
JSON
)
  PATIENT_RESPONSE=$(curl -s -X POST "$BASE_URL/api/patients" \
    -H "Content-Type: application/json" \
    -H "X-Tenant-ID: $TENANT_SLUG" \
    -H "Authorization: Bearer $TOKEN" \
    -d "$PATIENT_PAYLOAD")
  PATIENT_ID=$(echo "$PATIENT_RESPONSE" | jq -r '.id // empty')
fi

if [ -z "$PATIENT_ID" ] || [ "$PATIENT_ID" == "null" ]; then
  echo "❌ Unable to obtain a patient ID. Provide one via PATIENT_ID env var."
  echo "Server response:"
  echo "$PATIENT_RESPONSE"
  exit 1
fi

echo "👤 Using patient ID: $PATIENT_ID"

echo ""
echo "📝 Updating SNOMED-coded problem list..."
PROBLEMS_PAYLOAD=$(cat <<'JSON'
{
  "problems": [
    {
      "conceptId": "44054006",
      "term": "Diabetes mellitus type 2 (disorder)",
      "status": "active",
      "onsetDate": "2024-01-10"
    },
    {
      "conceptId": "195967001",
      "term": "Asthma (disorder)",
      "status": "active"
    }
  ]
}
JSON
)

PROBLEM_UPDATE=$(curl -s -X PUT "$BASE_URL/api/problems/patient/$PATIENT_ID" \
  -H "Content-Type: application/json" \
  -H "X-Tenant-ID: $TENANT_SLUG" \
  -H "Authorization: Bearer $TOKEN" \
  -d "$PROBLEMS_PAYLOAD")

if echo "$PROBLEM_UPDATE" | jq -e '.statusCode? >= 400' >/dev/null 2>&1; then
  echo "❌ Problem update failed:"
  echo "$PROBLEM_UPDATE" | jq '.' || echo "$PROBLEM_UPDATE"
  exit 1
fi

echo "$PROBLEM_UPDATE" | jq '.' || echo "$PROBLEM_UPDATE"

echo ""
echo "📖 Current problem list:"
PROBLEM_LIST=$(curl -s "$BASE_URL/api/problems/patient/$PATIENT_ID" \
  -H "X-Tenant-ID: $TENANT_SLUG" \
  -H "Authorization: Bearer $TOKEN")

if echo "$PROBLEM_LIST" | jq -e '.statusCode? >= 400' >/dev/null 2>&1; then
  echo "❌ Failed to fetch problem list:"
  echo "$PROBLEM_LIST" | jq '.' || echo "$PROBLEM_LIST"
  exit 1
fi

echo "$PROBLEM_LIST" | jq '.' || echo "$PROBLEM_LIST"

echo ""
echo "⚕️ Updating SNOMED-coded allergy list..."
ALLERGIES_PAYLOAD=$(cat <<'JSON'
{
  "allergies": [
    {
      "allergenSnomedConceptId": "387406002",
      "allergenTerm": "Penicillin",
      "reactionSnomedConceptId": "39579001",
      "reactionTerm": "Anaphylaxis",
      "severity": "severe"
    },
    {
      "allergenSnomedConceptId": "227493005",
      "allergenTerm": "Peanut",
      "severity": "moderate"
    }
  ]
}
JSON
)

ALLERGY_UPDATE=$(curl -s -X PUT "$BASE_URL/api/allergies/patient/$PATIENT_ID" \
  -H "Content-Type: application/json" \
  -H "X-Tenant-ID: $TENANT_SLUG" \
  -H "Authorization: Bearer $TOKEN" \
  -d "$ALLERGIES_PAYLOAD")

if echo "$ALLERGY_UPDATE" | jq -e '.statusCode? >= 400' >/dev/null 2>&1; then
  echo "❌ Allergy update failed:"
  echo "$ALLERGY_UPDATE" | jq '.' || echo "$ALLERGY_UPDATE"
  exit 1
fi

echo "$ALLERGY_UPDATE" | jq '.' || echo "$ALLERGY_UPDATE"

echo ""
echo "📋 Current allergy list:"
ALLERGY_LIST=$(curl -s "$BASE_URL/api/allergies/patient/$PATIENT_ID" \
  -H "X-Tenant-ID: $TENANT_SLUG" \
  -H "Authorization: Bearer $TOKEN")

if echo "$ALLERGY_LIST" | jq -e '.statusCode? >= 400' >/dev/null 2>&1; then
  echo "❌ Failed to fetch allergy list:"
  echo "$ALLERGY_LIST" | jq '.' || echo "$ALLERGY_LIST"
  exit 1
fi

echo "$ALLERGY_LIST" | jq '.' || echo "$ALLERGY_LIST"

echo ""
echo "🎉 SNOMED-coded problems and allergies updated successfully."

