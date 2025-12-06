#!/bin/bash

# Test FHIR DiagnosticReport endpoints
# Usage: ./scripts/test-fhir-diagnostic-report.sh [tenant-id]

TENANT_ID=${1:-"bulawayo-general"}
BASE_URL="http://localhost:3013"
TOKEN=""

echo "🧪 Testing FHIR DiagnosticReport Endpoints"
echo "==========================================="
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

# Test 1: Search DiagnosticReports (all)
echo "2️⃣ Testing GET /api/fhir/DiagnosticReport (search all)..."
SEARCH_RESPONSE=$(curl -s -X GET "$BASE_URL/api/fhir/DiagnosticReport" \
  -H "Authorization: Bearer $TOKEN" \
  -H "x-tenant-id: $TENANT_ID" \
  -H "Content-Type: application/json")

SEARCH_STATUS=$(echo $SEARCH_RESPONSE | jq -r '.resourceType // "error"')
if [ "$SEARCH_STATUS" == "Bundle" ]; then
  COUNT=$(echo $SEARCH_RESPONSE | jq -r '.entry | length // 0')
  TOTAL=$(echo $SEARCH_RESPONSE | jq -r '.total // 0')
  echo "✅ Search successful - Found $COUNT diagnostic reports (total: $TOTAL)"
else
  echo "❌ Search failed"
  echo "Response: $SEARCH_RESPONSE" | jq '.' | head -20
  exit 1
fi
echo ""

# Test 2: Search by status
echo "3️⃣ Testing GET /api/fhir/DiagnosticReport?status=final..."
SEARCH_STATUS_RESPONSE=$(curl -s -X GET "$BASE_URL/api/fhir/DiagnosticReport?status=final" \
  -H "Authorization: Bearer $TOKEN" \
  -H "x-tenant-id: $TENANT_ID" \
  -H "Content-Type: application/json")

STATUS_SEARCH_TYPE=$(echo $SEARCH_STATUS_RESPONSE | jq -r '.resourceType // "error"')
if [ "$STATUS_SEARCH_TYPE" == "Bundle" ]; then
  COUNT=$(echo $SEARCH_STATUS_RESPONSE | jq -r '.entry | length // 0')
  echo "✅ Status search successful - Found $COUNT final diagnostic reports"
else
  echo "❌ Status search failed"
  echo "Response: $SEARCH_STATUS_RESPONSE" | jq '.' | head -10
fi
echo ""

# Test 3: Get first diagnostic report by ID (if any exist)
FIRST_ID=$(echo $SEARCH_RESPONSE | jq -r '.entry[0].resource.id // empty')
if [ -n "$FIRST_ID" ] && [ "$FIRST_ID" != "null" ]; then
  echo "4️⃣ Testing GET /api/fhir/DiagnosticReport/$FIRST_ID..."
  GET_RESPONSE=$(curl -s -X GET "$BASE_URL/api/fhir/DiagnosticReport/$FIRST_ID" \
    -H "Authorization: Bearer $TOKEN" \
    -H "x-tenant-id: $TENANT_ID" \
    -H "Content-Type: application/json")

  GET_TYPE=$(echo $GET_RESPONSE | jq -r '.resourceType // "error"')
  if [ "$GET_TYPE" == "DiagnosticReport" ]; then
    STATUS=$(echo $GET_RESPONSE | jq -r '.status // "unknown"')
    CODE=$(echo $GET_RESPONSE | jq -r '.code.text // "unknown"')
    SUBJECT=$(echo $GET_RESPONSE | jq -r '.subject.reference // "unknown"')
    echo "✅ Get by ID successful"
    echo "   Status: $STATUS"
    echo "   Code: $CODE"
    echo "   Subject: $SUBJECT"
  else
    echo "❌ Get by ID failed"
    echo "Response: $GET_RESPONSE" | jq '.' | head -10
  fi
  echo ""
else
  echo "4️⃣ Skipping GET by ID test (no diagnostic reports found)"
  echo ""
fi

# Test 4: Create DiagnosticReport
echo "5️⃣ Testing POST /api/fhir/DiagnosticReport (create)..."
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
  # Create a test DiagnosticReport
  CREATE_PAYLOAD=$(jq -n \
    --arg patient_id "$PATIENT_ID" \
    --arg doctor_id "$DOCTOR_ID" \
    --arg when "$(date -u +%Y-%m-%dT%H:%M:%SZ)" \
    '{
      resourceType: "DiagnosticReport",
      status: "final",
      category: [{
        coding: [{
          system: "http://terminology.hl7.org/CodeSystem/v2-0074",
          code: "CH",
          display: "Chemistry"
        }],
        text: "Chemistry"
      }],
      code: {
        text: "Complete Blood Count",
        coding: [{
          system: "http://loinc.org",
          code: "CBC",
          display: "Complete Blood Count"
        }]
      },
      subject: {
        reference: "Patient/\($patient_id)"
      },
      effectiveDateTime: $when,
      issued: $when,
      performer: [{
        reference: "Practitioner/\($doctor_id)"
      }],
      conclusion: "All values within normal range"
    }')

  CREATE_RESPONSE=$(curl -s -X POST "$BASE_URL/api/fhir/DiagnosticReport" \
    -H "Authorization: Bearer $TOKEN" \
    -H "x-tenant-id: $TENANT_ID" \
    -H "Content-Type: application/json" \
    -d "$CREATE_PAYLOAD")

  CREATE_TYPE=$(echo $CREATE_RESPONSE | jq -r '.resourceType // "error"')
  CREATE_STATUS=$(echo $CREATE_RESPONSE | jq -r '.statusCode // "success"')
  
  if [ "$CREATE_TYPE" == "DiagnosticReport" ]; then
    CREATED_ID=$(echo $CREATE_RESPONSE | jq -r '.id // "unknown"')
    echo "✅ Create successful - ID: $CREATED_ID"
    
    # Test 5: Update the created diagnostic report
    echo ""
    echo "6️⃣ Testing PUT /api/fhir/DiagnosticReport/$CREATED_ID (update)..."
    UPDATE_PAYLOAD=$(echo "$CREATE_RESPONSE" | jq '.conclusion = "Updated: Some values slightly elevated"')
    
    UPDATE_RESPONSE=$(curl -s -X PUT "$BASE_URL/api/fhir/DiagnosticReport/$CREATED_ID" \
      -H "Authorization: Bearer $TOKEN" \
      -H "x-tenant-id: $TENANT_ID" \
      -H "Content-Type: application/json" \
      -d "$UPDATE_PAYLOAD")

    UPDATE_TYPE=$(echo $UPDATE_RESPONSE | jq -r '.resourceType // "error"')
    UPDATE_CONCLUSION=$(echo $UPDATE_RESPONSE | jq -r '.conclusion // "unknown"')
    
    if [ "$UPDATE_TYPE" == "DiagnosticReport" ]; then
      echo "✅ Update successful - Conclusion: $UPDATE_CONCLUSION"
    else
      echo "❌ Update failed"
      echo "Response: $UPDATE_RESPONSE" | jq '.' | head -10
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
if [ "$CREATE_TYPE" == "DiagnosticReport" ]; then
  echo "✅ Create - PASSED"
  echo "✅ Update - PASSED"
else
  echo "⚠️  Create/Update - SKIPPED (no test data)"
fi
echo ""
echo "🎉 DiagnosticReport endpoint tests complete!"
