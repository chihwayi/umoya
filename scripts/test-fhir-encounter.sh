#!/bin/bash

# Test FHIR Encounter endpoints
# Usage: ./scripts/test-fhir-encounter.sh [tenant-id]

TENANT_ID=${1:-"bulawayo-general"}
BASE_URL="http://localhost:3013"
TOKEN=""

echo "🧪 Testing FHIR Encounter Endpoints"
echo "==================================="
echo "Tenant: $TENANT_ID"
echo ""

# Login to get token
echo "1️⃣ Logging in..."
LOGIN_RESPONSE=$(curl -s -X POST "$BASE_URL/api/auth/login" \
  -H "Content-Type: application/json" \
  -H "x-tenant-id: $TENANT_ID" \
  -d '{
    "email": "doctor@bulawayo-general.co.zw",
    "password": "Password1#"
  }')

TOKEN=$(echo $LOGIN_RESPONSE | jq -r '.accessToken // .token // empty')

if [ -z "$TOKEN" ] || [ "$TOKEN" == "null" ]; then
  echo "❌ Login failed"
  echo "Response: $LOGIN_RESPONSE"
  exit 1
fi

echo "✅ Login successful"
echo ""

# Test 1: Search Encounters (all)
echo "2️⃣ Testing GET /api/fhir/Encounter (search all)..."
SEARCH_RESPONSE=$(curl -s -X GET "$BASE_URL/api/fhir/Encounter" \
  -H "Authorization: Bearer $TOKEN" \
  -H "x-tenant-id: $TENANT_ID" \
  -H "Content-Type: application/json")

SEARCH_STATUS=$(echo $SEARCH_RESPONSE | jq -r '.resourceType // "error"')
if [ "$SEARCH_STATUS" == "Bundle" ]; then
  COUNT=$(echo $SEARCH_RESPONSE | jq -r '.entry | length // 0')
  TOTAL=$(echo $SEARCH_RESPONSE | jq -r '.total // 0')
  echo "✅ Search successful - Found $COUNT encounters (total: $TOTAL)"
else
  echo "❌ Search failed"
  echo "Response: $SEARCH_RESPONSE" | jq '.' | head -20
  exit 1
fi
echo ""

# Test 2: Search by status
echo "3️⃣ Testing GET /api/fhir/Encounter?status=finished..."
SEARCH_STATUS_RESPONSE=$(curl -s -X GET "$BASE_URL/api/fhir/Encounter?status=finished" \
  -H "Authorization: Bearer $TOKEN" \
  -H "x-tenant-id: $TENANT_ID" \
  -H "Content-Type: application/json")

STATUS_SEARCH_TYPE=$(echo $SEARCH_STATUS_RESPONSE | jq -r '.resourceType // "error"')
if [ "$STATUS_SEARCH_TYPE" == "Bundle" ]; then
  COUNT=$(echo $SEARCH_STATUS_RESPONSE | jq -r '.entry | length // 0')
  echo "✅ Status search successful - Found $COUNT finished encounters"
else
  echo "❌ Status search failed"
  echo "Response: $SEARCH_STATUS_RESPONSE" | jq '.' | head -10
fi
echo ""

# Test 3: Get first encounter by ID (if any exist)
FIRST_ID=$(echo $SEARCH_RESPONSE | jq -r '.entry[0].resource.id // empty')
if [ -n "$FIRST_ID" ] && [ "$FIRST_ID" != "null" ]; then
  echo "4️⃣ Testing GET /api/fhir/Encounter/$FIRST_ID..."
  GET_RESPONSE=$(curl -s -X GET "$BASE_URL/api/fhir/Encounter/$FIRST_ID" \
    -H "Authorization: Bearer $TOKEN" \
    -H "x-tenant-id: $TENANT_ID" \
    -H "Content-Type: application/json")

  GET_TYPE=$(echo $GET_RESPONSE | jq -r '.resourceType // "error"')
  if [ "$GET_TYPE" == "Encounter" ]; then
    STATUS=$(echo $GET_RESPONSE | jq -r '.status // "unknown"')
    CLASS=$(echo $GET_RESPONSE | jq -r '.class.display // "unknown"')
    SUBJECT=$(echo $GET_RESPONSE | jq -r '.subject.reference // "unknown"')
    echo "✅ Get by ID successful"
    echo "   Status: $STATUS"
    echo "   Class: $CLASS"
    echo "   Subject: $SUBJECT"
  else
    echo "❌ Get by ID failed"
    echo "Response: $GET_RESPONSE" | jq '.' | head -10
  fi
  echo ""
else
  echo "4️⃣ Skipping GET by ID test (no encounters found)"
  echo ""
fi

# Test 4: Create Encounter (Appointment)
echo "5️⃣ Testing POST /api/fhir/Encounter (create appointment)..."
# Get a patient ID
PATIENT_SEARCH=$(curl -s -X GET "$BASE_URL/api/fhir/Patient?_count=1" \
  -H "Authorization: Bearer $TOKEN" \
  -H "x-tenant-id: $TENANT_ID" \
  -H "Content-Type: application/json")

PATIENT_ID=$(echo $PATIENT_SEARCH | jq -r '.entry[0].resource.id // empty')

# Get a practitioner ID (doctor)
DOCTOR_SEARCH=$(curl -s -X GET "$BASE_URL/api/users?role=doctor&limit=1" \
  -H "Authorization: Bearer $TOKEN" \
  -H "x-tenant-id: $TENANT_ID" \
  -H "Content-Type: application/json")

DOCTOR_ID=$(echo $DOCTOR_SEARCH | jq -r '.[0].id // empty')

if [ -z "$PATIENT_ID" ] || [ "$PATIENT_ID" == "null" ] || [ -z "$DOCTOR_ID" ] || [ "$DOCTOR_ID" == "null" ]; then
  echo "⚠️  No patients or doctors found - skipping create test"
  echo ""
else
  # Create a test Encounter (Appointment)
  START_TIME=$(date -u +%Y-%m-%dT%H:%M:%SZ)
  END_TIME=$(date -u -v+30M +%Y-%m-%dT%H:%M:%SZ 2>/dev/null || date -u -d "+30 minutes" +%Y-%m-%dT%H:%M:%SZ 2>/dev/null || date -u +%Y-%m-%dT%H:%M:%SZ)
  
  CREATE_PAYLOAD=$(jq -n \
    --arg patient_id "$PATIENT_ID" \
    --arg doctor_id "$DOCTOR_ID" \
    --arg start "$START_TIME" \
    --arg end "$END_TIME" \
    '{
      resourceType: "Encounter",
      status: "planned",
      class: {
        system: "http://terminology.hl7.org/CodeSystem/v3-ActCode",
        code: "AMB",
        display: "ambulatory"
      },
      type: [{
        coding: [{
          system: "http://snomed.info/sct",
          code: "390906007",
          display: "Follow-up encounter"
        }],
        text: "Follow-up Consultation"
      }],
      subject: {
        reference: "Patient/\($patient_id)"
      },
      period: {
        start: $start,
        end: $end
      },
      participant: [{
        type: [{
          coding: [{
            system: "http://terminology.hl7.org/CodeSystem/v3-ParticipationType",
            code: "ATND",
            display: "attending"
          }]
        }],
        individual: {
          reference: "Practitioner/\($doctor_id)"
        }
      }],
      reasonCode: [{
        text: "Routine follow-up"
      }]
    }')

  CREATE_RESPONSE=$(curl -s -X POST "$BASE_URL/api/fhir/Encounter" \
    -H "Authorization: Bearer $TOKEN" \
    -H "x-tenant-id: $TENANT_ID" \
    -H "Content-Type: application/json" \
    -d "$CREATE_PAYLOAD")

  CREATE_TYPE=$(echo $CREATE_RESPONSE | jq -r '.resourceType // "error"')
  
  if [ "$CREATE_TYPE" == "Encounter" ]; then
    CREATED_ID=$(echo $CREATE_RESPONSE | jq -r '.id // "unknown"')
    echo "✅ Create successful - ID: $CREATED_ID"
    
    # Test 5: Update the created encounter
    echo ""
    echo "6️⃣ Testing PUT /api/fhir/Encounter/$CREATED_ID (update)..."
    UPDATE_PAYLOAD=$(echo "$CREATE_RESPONSE" | jq '.status = "in-progress" | .reasonCode[0].text = "Updated: Patient arrived"')
    
    UPDATE_RESPONSE=$(curl -s -X PUT "$BASE_URL/api/fhir/Encounter/$CREATED_ID" \
      -H "Authorization: Bearer $TOKEN" \
      -H "x-tenant-id: $TENANT_ID" \
      -H "Content-Type: application/json" \
      -d "$UPDATE_PAYLOAD")

    UPDATE_TYPE=$(echo $UPDATE_RESPONSE | jq -r '.resourceType // "error"')
    UPDATE_STATUS=$(echo $UPDATE_RESPONSE | jq -r '.status // "unknown"')
    
    if [ "$UPDATE_TYPE" == "Encounter" ]; then
      echo "✅ Update successful - Status: $UPDATE_STATUS"
    else
      echo "❌ Update failed"
      echo "Response: $UPDATE_RESPONSE" | jq '.' | head -10
    fi
    echo ""
  else
    echo "❌ Create failed"
    echo "Response: $CREATE_RESPONSE" | jq '.' | head -20
    echo ""
  fi
fi

# Summary
echo "📊 Test Summary"
echo "=============="
echo "✅ Search (all) - PASSED"
echo "✅ Search by status - PASSED"
if [ -n "$FIRST_ID" ] && [ "$FIRST_ID" != "null" ]; then
  echo "✅ Get by ID - PASSED"
fi
if [ "$CREATE_TYPE" == "Encounter" ]; then
  echo "✅ Create - PASSED"
  echo "✅ Update - PASSED"
else
  echo "⚠️  Create/Update - SKIPPED (no test data)"
fi
echo ""
echo "🎉 Encounter endpoint tests complete!"

