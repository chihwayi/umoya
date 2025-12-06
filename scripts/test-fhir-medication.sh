#!/bin/bash

# Test FHIR Medication endpoints
# Usage: ./scripts/test-fhir-medication.sh [tenant-id]

TENANT_ID=${1:-"bulawayo-general"}
BASE_URL="http://localhost:3013"
TOKEN=""

echo "🧪 Testing FHIR Medication Endpoints"
echo "======================================"
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

# Test 1: Search Medications (all active)
echo "2️⃣ Testing GET /fhir/Medication (search all)..."
SEARCH_RESPONSE=$(curl -s -X GET "$BASE_URL/fhir/Medication" \
  -H "Authorization: Bearer $TOKEN" \
  -H "x-tenant-id: $TENANT_ID" \
  -H "Content-Type: application/json")

SEARCH_STATUS=$(echo $SEARCH_RESPONSE | jq -r '.resourceType // "error"')
if [ "$SEARCH_STATUS" == "Bundle" ]; then
  COUNT=$(echo $SEARCH_RESPONSE | jq -r '.entry | length // 0')
  echo "✅ Search successful - Found $COUNT medications"
else
  echo "❌ Search failed"
  echo "Response: $SEARCH_RESPONSE" | jq '.' | head -20
  exit 1
fi
echo ""

# Test 2: Search by code (RxNorm)
echo "3️⃣ Testing GET /fhir/Medication?code=... (search by RxNorm code)..."
# Get first medication's RxNorm code
FIRST_MED=$(echo $SEARCH_RESPONSE | jq -r '.entry[0].resource.code.coding[]? | select(.system | contains("rxnorm")) | .code' | head -1)
if [ -n "$FIRST_MED" ] && [ "$FIRST_MED" != "null" ]; then
  CODE_SEARCH=$(curl -s -X GET "$BASE_URL/fhir/Medication?code=$FIRST_MED" \
    -H "Authorization: Bearer $TOKEN" \
    -H "x-tenant-id: $TENANT_ID")
  CODE_COUNT=$(echo $CODE_SEARCH | jq -r '.entry | length // 0')
  echo "✅ Code search successful - Found $CODE_COUNT medication(s) with code $FIRST_MED"
else
  echo "⚠️  No RxNorm code found in first medication, skipping code search"
fi
echo ""

# Test 3: Search by status
echo "4️⃣ Testing GET /fhir/Medication?status=active..."
STATUS_SEARCH=$(curl -s -X GET "$BASE_URL/fhir/Medication?status=active" \
  -H "Authorization: Bearer $TOKEN" \
  -H "x-tenant-id: $TENANT_ID")
STATUS_COUNT=$(echo $STATUS_SEARCH | jq -r '.entry | length // 0')
echo "✅ Status search successful - Found $STATUS_COUNT active medications"
echo ""

# Test 4: Get Medication by ID
echo "5️⃣ Testing GET /fhir/Medication/:id..."
FIRST_ID=$(echo $SEARCH_RESPONSE | jq -r '.entry[0].resource.id // empty' | head -1)
if [ -n "$FIRST_ID" ] && [ "$FIRST_ID" != "null" ]; then
  GET_RESPONSE=$(curl -s -X GET "$BASE_URL/fhir/Medication/$FIRST_ID" \
    -H "Authorization: Bearer $TOKEN" \
    -H "x-tenant-id: $TENANT_ID")
  GET_TYPE=$(echo $GET_RESPONSE | jq -r '.resourceType // "error"')
  if [ "$GET_TYPE" == "Medication" ]; then
    GET_NAME=$(echo $GET_RESPONSE | jq -r '.code.text // "Unknown"')
    echo "✅ Get by ID successful - Medication: $GET_NAME"
  else
    echo "❌ Get by ID failed"
    echo "Response: $GET_RESPONSE" | jq '.' | head -10
  fi
else
  echo "⚠️  No medication ID found, skipping get by ID test"
fi
echo ""

# Test 5: Search by name
echo "6️⃣ Testing GET /fhir/Medication?name=... (search by name)..."
NAME_SEARCH=$(curl -s -X GET "$BASE_URL/fhir/Medication?name=aspirin" \
  -H "Authorization: Bearer $TOKEN" \
  -H "x-tenant-id: $TENANT_ID")
NAME_COUNT=$(echo $NAME_SEARCH | jq -r '.entry | length // 0')
echo "✅ Name search successful - Found $NAME_COUNT medication(s) matching 'aspirin'"
echo ""

# Test 6: Create Medication
echo "7️⃣ Testing POST /fhir/Medication (create)..."
CREATE_MEDICATION='{
  "resourceType": "Medication",
  "code": {
    "coding": [
      {
        "system": "http://www.nlm.nih.gov/research/umls/rxnorm",
        "code": "999999",
        "display": "Test Medication"
      }
    ],
    "text": "Test Medication"
  },
  "status": "active",
  "form": {
    "coding": [
      {
        "system": "http://terminology.hl7.org/CodeSystem/v3-orderableDrugForm",
        "code": "TAB",
        "display": "Tablet"
      }
    ],
    "text": "Tablet"
  },
  "ingredient": [
    {
      "itemCodeableConcept": {
        "text": "Test Ingredient"
      },
      "isActive": true
    }
  ]
}'

CREATE_RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "$BASE_URL/fhir/Medication" \
  -H "Authorization: Bearer $TOKEN" \
  -H "x-tenant-id: $TENANT_ID" \
  -H "Content-Type: application/json" \
  -d "$CREATE_MEDICATION")

HTTP_CODE=$(echo "$CREATE_RESPONSE" | tail -1)
CREATE_BODY=$(echo "$CREATE_RESPONSE" | head -n -1)

if [ "$HTTP_CODE" == "201" ]; then
  CREATED_ID=$(echo $CREATE_BODY | jq -r '.id // empty')
  echo "✅ Create successful - Medication ID: $CREATED_ID"
  
  # Test 7: Update Medication
  echo ""
  echo "8️⃣ Testing PUT /fhir/Medication/:id (update)..."
  UPDATE_MEDICATION=$(echo $CREATE_BODY | jq '.code.text = "Updated Test Medication"')
  UPDATE_RESPONSE=$(curl -s -w "\n%{http_code}" -X PUT "$BASE_URL/fhir/Medication/$CREATED_ID" \
    -H "Authorization: Bearer $TOKEN" \
    -H "x-tenant-id: $TENANT_ID" \
    -H "Content-Type: application/json" \
    -d "$UPDATE_MEDICATION")
  
  UPDATE_HTTP_CODE=$(echo "$UPDATE_RESPONSE" | tail -1)
  UPDATE_BODY=$(echo "$UPDATE_RESPONSE" | head -n -1)
  
  if [ "$UPDATE_HTTP_CODE" == "200" ]; then
    UPDATED_NAME=$(echo $UPDATE_BODY | jq -r '.code.text // "Unknown"')
    echo "✅ Update successful - Updated name: $UPDATED_NAME"
    
    # Test 8: Delete Medication
    echo ""
    echo "9️⃣ Testing DELETE /fhir/Medication/:id (delete)..."
    DELETE_RESPONSE=$(curl -s -w "\n%{http_code}" -X DELETE "$BASE_URL/fhir/Medication/$CREATED_ID" \
      -H "Authorization: Bearer $TOKEN" \
      -H "x-tenant-id: $TENANT_ID")
    
    DELETE_HTTP_CODE=$(echo "$DELETE_RESPONSE" | tail -1)
    if [ "$DELETE_HTTP_CODE" == "200" ]; then
      echo "✅ Delete successful"
    else
      echo "❌ Delete failed - HTTP $DELETE_HTTP_CODE"
    fi
  else
    echo "❌ Update failed - HTTP $UPDATE_HTTP_CODE"
  fi
else
  echo "❌ Create failed - HTTP $HTTP_CODE"
  echo "Response: $CREATE_BODY" | jq '.' | head -10
fi

echo ""
echo "======================================"
echo "✅ FHIR Medication Endpoint Tests Complete!"
echo ""

