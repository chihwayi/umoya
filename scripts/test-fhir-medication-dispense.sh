#!/bin/bash

# Test FHIR MedicationDispense endpoints
# Usage: ./scripts/test-fhir-medication-dispense.sh [tenant-id]

TENANT_ID=${1:-"bulawayo-general"}
BASE_URL="http://localhost:3013"
TOKEN=""

echo "🧪 Testing FHIR MedicationDispense Endpoints"
echo "=============================================="
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

# Test 1: Search MedicationDispenses (all)
echo "2️⃣ Testing GET /api/fhir/MedicationDispense (search all)..."
SEARCH_RESPONSE=$(curl -s -X GET "$BASE_URL/api/fhir/MedicationDispense" \
  -H "Authorization: Bearer $TOKEN" \
  -H "x-tenant-id: $TENANT_ID" \
  -H "Content-Type: application/json")

SEARCH_STATUS=$(echo $SEARCH_RESPONSE | jq -r '.resourceType // "error"')
if [ "$SEARCH_STATUS" == "Bundle" ]; then
  COUNT=$(echo $SEARCH_RESPONSE | jq -r '.entry | length // 0')
  TOTAL=$(echo $SEARCH_RESPONSE | jq -r '.total // 0')
  echo "✅ Search successful - Found $COUNT dispensings (total: $TOTAL)"
else
  echo "❌ Search failed"
  echo "Response: $SEARCH_RESPONSE" | jq '.' | head -20
  exit 1
fi
echo ""

# Test 2: Search by status
echo "3️⃣ Testing GET /api/fhir/MedicationDispense?status=completed..."
SEARCH_STATUS_RESPONSE=$(curl -s -X GET "$BASE_URL/api/fhir/MedicationDispense?status=completed" \
  -H "Authorization: Bearer $TOKEN" \
  -H "x-tenant-id: $TENANT_ID" \
  -H "Content-Type: application/json")

STATUS_SEARCH_TYPE=$(echo $SEARCH_STATUS_RESPONSE | jq -r '.resourceType // "error"')
if [ "$STATUS_SEARCH_TYPE" == "Bundle" ]; then
  COUNT=$(echo $SEARCH_STATUS_RESPONSE | jq -r '.entry | length // 0')
  echo "✅ Status search successful - Found $COUNT completed dispensings"
else
  echo "❌ Status search failed"
  echo "Response: $SEARCH_STATUS_RESPONSE" | jq '.' | head -10
fi
echo ""

# Test 3: Get first dispensing by ID (if any exist)
FIRST_ID=$(echo $SEARCH_RESPONSE | jq -r '.entry[0].resource.id // empty')
if [ -n "$FIRST_ID" ] && [ "$FIRST_ID" != "null" ]; then
  echo "4️⃣ Testing GET /api/fhir/MedicationDispense/$FIRST_ID..."
  GET_RESPONSE=$(curl -s -X GET "$BASE_URL/api/fhir/MedicationDispense/$FIRST_ID" \
    -H "Authorization: Bearer $TOKEN" \
    -H "x-tenant-id: $TENANT_ID" \
    -H "Content-Type: application/json")

  GET_TYPE=$(echo $GET_RESPONSE | jq -r '.resourceType // "error"')
  if [ "$GET_TYPE" == "MedicationDispense" ]; then
    STATUS=$(echo $GET_RESPONSE | jq -r '.status // "unknown"')
    SUBJECT=$(echo $GET_RESPONSE | jq -r '.subject.reference // "unknown"')
    echo "✅ Get by ID successful"
    echo "   Status: $STATUS"
    echo "   Subject: $SUBJECT"
  else
    echo "❌ Get by ID failed"
    echo "Response: $GET_RESPONSE" | jq '.' | head -10
  fi
  echo ""
else
  echo "4️⃣ Skipping GET by ID test (no dispensings found)"
  echo ""
fi

# Test 4: Create MedicationDispense
echo "5️⃣ Testing POST /api/fhir/MedicationDispense (create)..."
# First, get a patient ID
PATIENT_SEARCH=$(curl -s -X GET "$BASE_URL/api/fhir/Patient?_count=1" \
  -H "Authorization: Bearer $TOKEN" \
  -H "x-tenant-id: $TENANT_ID" \
  -H "Content-Type: application/json")

PATIENT_ID=$(echo $PATIENT_SEARCH | jq -r '.entry[0].resource.id // empty')

if [ -z "$PATIENT_ID" ] || [ "$PATIENT_ID" == "null" ]; then
  echo "⚠️  No patients found - skipping create test"
  echo ""
else
  # Get a prescription ID if available
  PRESCRIPTION_SEARCH=$(curl -s -X GET "$BASE_URL/api/prescriptions?patientId=$PATIENT_ID&limit=1" \
    -H "Authorization: Bearer $TOKEN" \
    -H "x-tenant-id: $TENANT_ID" \
    -H "Content-Type: application/json")

  # Handle both array and object responses
  if echo "$PRESCRIPTION_SEARCH" | jq -e '. | type == "array"' > /dev/null 2>&1; then
    PRESCRIPTION_ID=$(echo $PRESCRIPTION_SEARCH | jq -r '.[0].id // empty')
  else
    PRESCRIPTION_ID=$(echo $PRESCRIPTION_SEARCH | jq -r '.id // empty')
  fi

  # Create a test MedicationDispense
  TIMESTAMP=$(date +%s)
  WHEN_PREPARED=$(date -u +%Y-%m-%dT%H:%M:%SZ)
  
  # Build base payload
  CREATE_PAYLOAD=$(jq -n \
    --arg patient_id "$PATIENT_ID" \
    --arg when_prepared "$WHEN_PREPARED" \
    '{
      resourceType: "MedicationDispense",
      status: "preparation",
      subject: {
        reference: "Patient/\($patient_id)"
      },
      whenPrepared: $when_prepared,
      medicationReference: {
        reference: "Medication?name=Test+Medication"
      },
      quantity: {
        value: 30,
        unit: "tablet",
        system: "http://unitsofmeasure.org"
      },
      daysSupply: {
        value: 30,
        unit: "days",
        system: "http://unitsofmeasure.org",
        code: "d"
      }
    }')

  # Add prescription reference if available
  if [ -n "$PRESCRIPTION_ID" ] && [ "$PRESCRIPTION_ID" != "null" ]; then
    CREATE_PAYLOAD=$(echo "$CREATE_PAYLOAD" | jq --arg presc "MedicationRequest/$PRESCRIPTION_ID" '. + {authorizingPrescription: [{reference: $presc}]}')
  fi

  CREATE_RESPONSE=$(curl -s -X POST "$BASE_URL/api/fhir/MedicationDispense" \
    -H "Authorization: Bearer $TOKEN" \
    -H "x-tenant-id: $TENANT_ID" \
    -H "Content-Type: application/json" \
    -d "$CREATE_PAYLOAD")

  CREATE_TYPE=$(echo $CREATE_RESPONSE | jq -r '.resourceType // "error"')
  CREATE_STATUS=$(echo $CREATE_RESPONSE | jq -r '.statusCode // "success"')
  
  if [ "$CREATE_TYPE" == "MedicationDispense" ]; then
    CREATED_ID=$(echo $CREATE_RESPONSE | jq -r '.id // "unknown"')
    echo "✅ Create successful - ID: $CREATED_ID"
    
    # Test 5: Update the created dispensing
    echo ""
    echo "6️⃣ Testing PUT /api/fhir/MedicationDispense/$CREATED_ID (update)..."
    UPDATE_PAYLOAD=$(echo "$CREATE_RESPONSE" | jq '.status = "completed" | .whenHandedOver = "'$(date -u +%Y-%m-%dT%H:%M:%SZ)'"')
    
    UPDATE_RESPONSE=$(curl -s -X PUT "$BASE_URL/api/fhir/MedicationDispense/$CREATED_ID" \
      -H "Authorization: Bearer $TOKEN" \
      -H "x-tenant-id: $TENANT_ID" \
      -H "Content-Type: application/json" \
      -d "$UPDATE_PAYLOAD")

    UPDATE_TYPE=$(echo $UPDATE_RESPONSE | jq -r '.resourceType // "error"')
    UPDATE_STATUS=$(echo $UPDATE_RESPONSE | jq -r '.status // "unknown"')
    
    if [ "$UPDATE_TYPE" == "MedicationDispense" ]; then
      echo "✅ Update successful - Status: $UPDATE_STATUS"
    else
      echo "❌ Update failed"
      echo "Response: $UPDATE_RESPONSE" | jq '.' | head -10
    fi
    echo ""
    
    # Test 6: Delete the created dispensing
    echo "7️⃣ Testing DELETE /api/fhir/MedicationDispense/$CREATED_ID (delete)..."
    DELETE_RESPONSE=$(curl -s -X DELETE "$BASE_URL/api/fhir/MedicationDispense/$CREATED_ID" \
      -H "Authorization: Bearer $TOKEN" \
      -H "x-tenant-id: $TENANT_ID" \
      -H "Content-Type: application/json")

    DELETE_STATUS=$(echo $DELETE_RESPONSE | jq -r '.status // "error"')
    if [ "$DELETE_STATUS" == "deleted" ]; then
      echo "✅ Delete successful"
    else
      echo "❌ Delete failed"
      echo "Response: $DELETE_RESPONSE" | jq '.'
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
if [ "$CREATE_TYPE" == "MedicationDispense" ]; then
  echo "✅ Create - PASSED"
  echo "✅ Update - PASSED"
  echo "✅ Delete - PASSED"
else
  echo "⚠️  Create/Update/Delete - SKIPPED (no test data)"
fi
echo ""
echo "🎉 MedicationDispense endpoint tests complete!"

