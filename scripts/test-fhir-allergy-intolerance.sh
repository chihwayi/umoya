#!/bin/bash

# Test FHIR AllergyIntolerance endpoints
TENANT_ID=${1:-bulawayo-general}
BASE_URL="http://localhost:3013/api/fhir"
TOKEN=""

echo "🧪 Testing FHIR AllergyIntolerance Endpoints"
echo "=============================================="

# Login
echo ""
echo "1️⃣ Logging in..."
LOGIN_RESPONSE=$(curl -s -X POST "http://localhost:3013/api/auth/login" \
  -H "Content-Type: application/json" \
  -H "x-tenant-id: $TENANT_ID" \
  -d '{"email": "doctor@bulawayo-general.co.zw", "password": "Password1#"}')

TOKEN=$(echo $LOGIN_RESPONSE | jq -r '.accessToken // .token')

if [ "$TOKEN" == "null" ] || [ -z "$TOKEN" ]; then
  echo "❌ Login failed"
  echo $LOGIN_RESPONSE | jq .
  exit 1
fi

echo "✅ Login successful"

# Get a patient ID first
echo ""
echo "2️⃣ Getting a patient ID..."
PATIENT_RESPONSE=$(curl -s -X GET "$BASE_URL/Patient" \
  -H "Authorization: Bearer $TOKEN" \
  -H "x-tenant-id: $TENANT_ID" \
  -H "Content-Type: application/json")

PATIENT_ID=$(echo $PATIENT_RESPONSE | jq -r '.entry[0].resource.id // empty')

if [ -z "$PATIENT_ID" ]; then
  echo "❌ No patient found"
  exit 1
fi

echo "✅ Found patient: $PATIENT_ID"

# Test Search
echo ""
echo "3️⃣ Testing GET /api/fhir/AllergyIntolerance (search)..."
SEARCH_RESPONSE=$(curl -s -X GET "$BASE_URL/AllergyIntolerance?patient=$PATIENT_ID" \
  -H "Authorization: Bearer $TOKEN" \
  -H "x-tenant-id: $TENANT_ID" \
  -H "Content-Type: application/json")

SEARCH_STATUS=$(echo $SEARCH_RESPONSE | jq -r '.resourceType // "error"')

if [ "$SEARCH_STATUS" == "Bundle" ]; then
  COUNT=$(echo $SEARCH_RESPONSE | jq '.entry | length')
  echo "✅ Search successful - Found $COUNT allergies"
else
  echo "❌ Search failed"
  echo $SEARCH_RESPONSE | jq .
  exit 1
fi

# Test Create
echo ""
echo "4️⃣ Testing POST /api/fhir/AllergyIntolerance (create)..."
CREATE_PAYLOAD=$(cat <<EOF
{
  "resourceType": "AllergyIntolerance",
  "clinicalStatus": {
    "coding": [{
      "system": "http://terminology.hl7.org/CodeSystem/allergyintolerance-clinical",
      "code": "active",
      "display": "Active"
    }]
  },
  "verificationStatus": {
    "coding": [{
      "system": "http://terminology.hl7.org/CodeSystem/allergyintolerance-verification",
      "code": "confirmed",
      "display": "Confirmed"
    }]
  },
  "type": "allergy",
  "category": ["medication"],
  "criticality": "high",
  "code": {
    "coding": [{
      "system": "http://snomed.info/sct",
      "code": "762952008",
      "display": "Penicillin"
    }],
    "text": "Penicillin"
  },
  "patient": {
    "reference": "Patient/$PATIENT_ID"
  },
  "reaction": [{
    "manifestation": [{
      "coding": [{
        "system": "http://snomed.info/sct",
        "code": "271807003",
        "display": "Rash"
      }],
      "text": "Rash"
    }],
    "severity": "severe"
  }]
}
EOF
)

CREATE_RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "$BASE_URL/AllergyIntolerance" \
  -H "Authorization: Bearer $TOKEN" \
  -H "x-tenant-id: $TENANT_ID" \
  -H "Content-Type: application/json" \
  -d "$CREATE_PAYLOAD")

HTTP_CODE=$(echo "$CREATE_RESPONSE" | tail -n1)
CREATE_BODY=$(echo "$CREATE_RESPONSE" | sed '$d')

if [ "$HTTP_CODE" == "201" ]; then
  ALLERGY_ID=$(echo $CREATE_BODY | jq -r '.id // empty')
  echo "✅ Create successful - ID: $ALLERGY_ID"
else
  echo "❌ Create failed - HTTP $HTTP_CODE"
  echo $CREATE_BODY | jq .
  exit 1
fi

# Test Get
echo ""
echo "5️⃣ Testing GET /api/fhir/AllergyIntolerance/$ALLERGY_ID (get by ID)..."
GET_RESPONSE=$(curl -s -w "\n%{http_code}" -X GET "$BASE_URL/AllergyIntolerance/$ALLERGY_ID" \
  -H "Authorization: Bearer $TOKEN" \
  -H "x-tenant-id: $TENANT_ID" \
  -H "Content-Type: application/json")

HTTP_CODE=$(echo "$GET_RESPONSE" | tail -n1)
GET_BODY=$(echo "$GET_RESPONSE" | sed '$d')

if [ "$HTTP_CODE" == "200" ]; then
  ALLERGEN=$(echo $GET_BODY | jq -r '.code.text // "N/A"')
  echo "✅ Get successful - Allergen: $ALLERGEN"
else
  echo "❌ Get failed - HTTP $HTTP_CODE"
  echo $GET_BODY | jq .
  exit 1
fi

# Test Update
echo ""
echo "6️⃣ Testing PUT /api/fhir/AllergyIntolerance/$ALLERGY_ID (update)..."
UPDATE_PAYLOAD=$(echo $CREATE_BODY | jq '.criticality = "moderate"')

UPDATE_RESPONSE=$(curl -s -w "\n%{http_code}" -X PUT "$BASE_URL/AllergyIntolerance/$ALLERGY_ID" \
  -H "Authorization: Bearer $TOKEN" \
  -H "x-tenant-id: $TENANT_ID" \
  -H "Content-Type: application/json" \
  -d "$UPDATE_PAYLOAD")

HTTP_CODE=$(echo "$UPDATE_RESPONSE" | tail -n1)
UPDATE_BODY=$(echo "$UPDATE_RESPONSE" | sed '$d')

if [ "$HTTP_CODE" == "200" ]; then
  CRITICALITY=$(echo $UPDATE_BODY | jq -r '.criticality // "N/A"')
  echo "✅ Update successful - Criticality: $CRITICALITY"
else
  echo "❌ Update failed - HTTP $HTTP_CODE"
  echo $UPDATE_BODY | jq .
  exit 1
fi

# Test Delete
echo ""
echo "7️⃣ Testing DELETE /api/fhir/AllergyIntolerance/$ALLERGY_ID (delete)..."
DELETE_RESPONSE=$(curl -s -w "\n%{http_code}" -X DELETE "$BASE_URL/AllergyIntolerance/$ALLERGY_ID" \
  -H "Authorization: Bearer $TOKEN" \
  -H "x-tenant-id: $TENANT_ID" \
  -H "Content-Type: application/json")

HTTP_CODE=$(echo "$DELETE_RESPONSE" | tail -n1)
DELETE_BODY=$(echo "$DELETE_RESPONSE" | sed '$d')

if [ "$HTTP_CODE" == "200" ]; then
  echo "✅ Delete successful"
else
  echo "❌ Delete failed - HTTP $HTTP_CODE"
  echo $DELETE_BODY | jq .
  exit 1
fi

echo ""
echo "📊 Test Summary"
echo "=============="
echo "✅ Search - PASSED"
echo "✅ Create - PASSED"
echo "✅ Get by ID - PASSED"
echo "✅ Update - PASSED"
echo "✅ Delete - PASSED"
echo ""
echo "🎉 AllergyIntolerance endpoint tests complete!"

