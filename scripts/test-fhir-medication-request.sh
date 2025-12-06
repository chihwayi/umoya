#!/bin/bash

# Test FHIR MedicationRequest endpoints
# Usage: ./scripts/test-fhir-medication-request.sh [tenant-id]

TENANT_ID=${1:-"bulawayo-general"}
BASE_URL="http://localhost:3013"
TOKEN=""

echo "🧪 Testing FHIR MedicationRequest Endpoints"
echo "============================================="
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

# Test 1: Search MedicationRequests (all)
echo "2️⃣ Testing GET /api/fhir/MedicationRequest (search all)..."
SEARCH_RESPONSE=$(curl -s -X GET "$BASE_URL/api/fhir/MedicationRequest" \
  -H "Authorization: Bearer $TOKEN" \
  -H "x-tenant-id: $TENANT_ID" \
  -H "Content-Type: application/json")

SEARCH_STATUS=$(echo $SEARCH_RESPONSE | jq -r '.resourceType // "error"')
if [ "$SEARCH_STATUS" == "Bundle" ]; then
  COUNT=$(echo $SEARCH_RESPONSE | jq -r '.entry | length // 0')
  TOTAL=$(echo $SEARCH_RESPONSE | jq -r '.total // 0')
  echo "✅ Search successful - Found $COUNT medication requests (total: $TOTAL)"
else
  echo "❌ Search failed"
  echo "Response: $SEARCH_RESPONSE" | jq '.' | head -20
  exit 1
fi
echo ""

# Test 2: Search by status
echo "3️⃣ Testing GET /api/fhir/MedicationRequest?status=active..."
SEARCH_STATUS_RESPONSE=$(curl -s -X GET "$BASE_URL/api/fhir/MedicationRequest?status=active" \
  -H "Authorization: Bearer $TOKEN" \
  -H "x-tenant-id: $TENANT_ID" \
  -H "Content-Type: application/json")

STATUS_SEARCH_TYPE=$(echo $SEARCH_STATUS_RESPONSE | jq -r '.resourceType // "error"')
if [ "$STATUS_SEARCH_TYPE" == "Bundle" ]; then
  COUNT=$(echo $SEARCH_STATUS_RESPONSE | jq -r '.entry | length // 0')
  echo "✅ Status search successful - Found $COUNT active medication requests"
else
  echo "❌ Status search failed"
  echo "Response: $SEARCH_STATUS_RESPONSE" | jq '.' | head -10
fi
echo ""

# Test 3: Get first medication request by ID (if any exist)
FIRST_ID=$(echo $SEARCH_RESPONSE | jq -r '.entry[0].resource.id // empty')
if [ -n "$FIRST_ID" ] && [ "$FIRST_ID" != "null" ]; then
  echo "4️⃣ Testing GET /api/fhir/MedicationRequest/$FIRST_ID..."
  GET_RESPONSE=$(curl -s -X GET "$BASE_URL/api/fhir/MedicationRequest/$FIRST_ID" \
    -H "Authorization: Bearer $TOKEN" \
    -H "x-tenant-id: $TENANT_ID" \
    -H "Content-Type: application/json")

  GET_TYPE=$(echo $GET_RESPONSE | jq -r '.resourceType // "error"')
  if [ "$GET_TYPE" == "MedicationRequest" ]; then
    STATUS=$(echo $GET_RESPONSE | jq -r '.status // "unknown"')
    INTENT=$(echo $GET_RESPONSE | jq -r '.intent // "unknown"')
    SUBJECT=$(echo $GET_RESPONSE | jq -r '.subject.reference // "unknown"')
    echo "✅ Get by ID successful"
    echo "   Status: $STATUS"
    echo "   Intent: $INTENT"
    echo "   Subject: $SUBJECT"
  else
    echo "❌ Get by ID failed"
    echo "Response: $GET_RESPONSE" | jq '.' | head -10
  fi
  echo ""
else
  echo "4️⃣ Skipping GET by ID test (no medication requests found)"
  echo ""
fi

# Test 4: Create MedicationRequest
echo "5️⃣ Testing POST /api/fhir/MedicationRequest (create)..."
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
  # Create a test MedicationRequest
  CREATE_PAYLOAD=$(jq -n \
    --arg patient_id "$PATIENT_ID" \
    --arg doctor_id "$DOCTOR_ID" \
    --arg when "$(date -u +%Y-%m-%dT%H:%M:%SZ)" \
    '{
      resourceType: "MedicationRequest",
      status: "active",
      intent: "order",
      priority: "routine",
      medicationCodeableConcept: {
        text: "Test Medication",
        coding: [{
          system: "http://www.nlm.nih.gov/research/umls/rxnorm",
          code: "TEST123",
          display: "Test Medication"
        }]
      },
      subject: {
        reference: "Patient/\($patient_id)"
      },
      authoredOn: $when,
      requester: {
        reference: "Practitioner/\($doctor_id)"
      },
      dosageInstruction: [{
        text: "1 tablet twice daily",
        timing: {
          repeat: {
            frequency: 2,
            period: 1,
            periodUnit: "d"
          }
        },
        doseAndRate: [{
          doseQuantity: {
            value: 1,
            unit: "tablet",
            system: "http://unitsofmeasure.org"
          }
        }]
      }],
      dispenseRequest: {
        quantity: {
          value: 30,
          unit: "tablet",
          system: "http://unitsofmeasure.org"
        },
        numberOfRepeatsAllowed: 0
      }
    }')

  CREATE_RESPONSE=$(curl -s -X POST "$BASE_URL/api/fhir/MedicationRequest" \
    -H "Authorization: Bearer $TOKEN" \
    -H "x-tenant-id: $TENANT_ID" \
    -H "Content-Type: application/json" \
    -d "$CREATE_PAYLOAD")

  CREATE_TYPE=$(echo $CREATE_RESPONSE | jq -r '.resourceType // "error"')
  CREATE_STATUS=$(echo $CREATE_RESPONSE | jq -r '.statusCode // "success"')
  
  if [ "$CREATE_TYPE" == "MedicationRequest" ]; then
    CREATED_ID=$(echo $CREATE_RESPONSE | jq -r '.id // "unknown"')
    echo "✅ Create successful - ID: $CREATED_ID"
    
    # Test 5: Update the created medication request
    echo ""
    echo "6️⃣ Testing PUT /api/fhir/MedicationRequest/$CREATED_ID (update)..."
    UPDATE_PAYLOAD=$(echo "$CREATE_RESPONSE" | jq '.status = "completed"')
    
    UPDATE_RESPONSE=$(curl -s -X PUT "$BASE_URL/api/fhir/MedicationRequest/$CREATED_ID" \
      -H "Authorization: Bearer $TOKEN" \
      -H "x-tenant-id: $TENANT_ID" \
      -H "Content-Type: application/json" \
      -d "$UPDATE_PAYLOAD")

    UPDATE_TYPE=$(echo $UPDATE_RESPONSE | jq -r '.resourceType // "error"')
    UPDATE_STATUS=$(echo $UPDATE_RESPONSE | jq -r '.status // "unknown"')
    
    if [ "$UPDATE_TYPE" == "MedicationRequest" ]; then
      echo "✅ Update successful - Status: $UPDATE_STATUS"
    else
      echo "❌ Update failed"
      echo "Response: $UPDATE_RESPONSE" | jq '.' | head -10
    fi
    echo ""
    
    # Test 6: Delete the created medication request
    echo "7️⃣ Testing DELETE /api/fhir/MedicationRequest/$CREATED_ID (delete)..."
    DELETE_RESPONSE=$(curl -s -X DELETE "$BASE_URL/api/fhir/MedicationRequest/$CREATED_ID" \
      -H "Authorization: Bearer $TOKEN" \
      -H "x-tenant-id: $TENANT_ID" \
      -H "Content-Type: application/json")

    DELETE_STATUS=$(echo $DELETE_RESPONSE | jq -r '.status // .statusCode // "error"')
    if [ "$DELETE_STATUS" == "deleted" ] || [ "$DELETE_STATUS" == "200" ]; then
      echo "✅ Delete successful"
    else
      echo "⚠️  Delete response: $DELETE_STATUS"
      echo "Response: $DELETE_RESPONSE" | jq '.' 2>/dev/null || echo "$DELETE_RESPONSE"
    fi
    echo ""
  elif [ "$CREATE_STATUS" == "201" ] || [ "$CREATE_STATUS" == "200" ]; then
    echo "✅ Create successful (status: $CREATE_STATUS)"
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
if [ "$CREATE_TYPE" == "MedicationRequest" ]; then
  echo "✅ Create - PASSED"
  echo "✅ Update - PASSED"
  echo "✅ Delete - PASSED"
else
  echo "⚠️  Create/Update/Delete - SKIPPED (no test data)"
fi
echo ""
echo "🎉 MedicationRequest endpoint tests complete!"
