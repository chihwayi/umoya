#!/bin/bash

# FHIR Endpoints Test Script
# Tests all FHIR R4 endpoints implemented in Sprint 44

set -e

BASE_URL="http://localhost:3013/api"
TENANT_SLUG="bulawayo-general"
EMAIL="doctor@bulawayo-general.co.zw"
PASSWORD="Password1#"

echo "🧪 Testing FHIR R4 Endpoints"
echo "================================"
echo ""

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

PASSED=0
FAILED=0

# Function to test endpoint
test_endpoint() {
    local method=$1
    local endpoint=$2
    local description=$3
    local expected_status=$4
    local data=$5
    
    echo -n "Testing: $description ... "
    
    if [ "$method" = "GET" ]; then
        response=$(curl -s -w "\n%{http_code}" -X GET \
            "$BASE_URL$endpoint" \
            -H "Content-Type: application/json" \
            -H "X-Tenant-ID: $TENANT_SLUG" \
            -H "Authorization: Bearer $TOKEN" 2>&1)
    elif [ "$method" = "POST" ]; then
        response=$(curl -s -w "\n%{http_code}" -X POST \
            "$BASE_URL$endpoint" \
            -H "Content-Type: application/json" \
            -H "X-Tenant-ID: $TENANT_SLUG" \
            -H "Authorization: Bearer $TOKEN" \
            -d "$data" 2>&1)
    elif [ "$method" = "PUT" ]; then
        response=$(curl -s -w "\n%{http_code}" -X PUT \
            "$BASE_URL$endpoint" \
            -H "Content-Type: application/json" \
            -H "X-Tenant-ID: $TENANT_SLUG" \
            -H "Authorization: Bearer $TOKEN" \
            -d "$data" 2>&1)
    fi
    
    http_code=$(echo "$response" | tail -n1)
    body=$(echo "$response" | sed '$d')
    
    if [ "$http_code" = "$expected_status" ]; then
        echo -e "${GREEN}✅ PASSED${NC} (HTTP $http_code)"
        PASSED=$((PASSED + 1))
        return 0
    else
        echo -e "${RED}❌ FAILED${NC} (HTTP $http_code, expected $expected_status)"
        echo "Response: $body" | head -c 200
        echo ""
        FAILED=$((FAILED + 1))
        return 1
    fi
}

# Step 1: Login
echo "🔐 Step 1: Logging in..."
LOGIN_RESPONSE=$(curl -s -X POST "$BASE_URL/auth/login" \
    -H "Content-Type: application/json" \
    -H "X-Tenant-ID: $TENANT_SLUG" \
    -d "{\"email\":\"$EMAIL\",\"password\":\"$PASSWORD\"}")

TOKEN=$(echo "$LOGIN_RESPONSE" | grep -o '"token":"[^"]*' | cut -d'"' -f4)

if [ -z "$TOKEN" ]; then
    echo -e "${RED}❌ Login failed${NC}"
    echo "Response: $LOGIN_RESPONSE"
    exit 1
fi

echo -e "${GREEN}✅ Login successful${NC}"
echo ""

# Step 2: Get a real patient ID from database
echo "📋 Step 2: Fetching test patient ID..."
PATIENT_ID=$(docker exec medicore-postgres-master psql -U medicore -d tenant_bulawayo_general -t -c "SELECT id FROM patients WHERE is_active = true LIMIT 1;" | tr -d '[:space:]')

if [ -z "$PATIENT_ID" ]; then
    echo -e "${YELLOW}⚠️  No active patients found. Creating test patient...${NC}"
    # We'll create one via FHIR API
    PATIENT_ID=""
else
    echo -e "${GREEN}✅ Found patient: $PATIENT_ID${NC}"
fi
echo ""

# Step 3: Test FHIR Endpoints
echo "🧪 Step 3: Testing FHIR Endpoints"
echo "================================"
echo ""

# Test 1: Capability Statement
test_endpoint "GET" "/fhir/metadata" "GET /fhir/metadata (Capability Statement)" "200"

# Test 2: Search Patients
test_endpoint "GET" "/fhir/Patient" "GET /fhir/Patient (Search all)" "200"

# Test 3: Search Patients by name
test_endpoint "GET" "/fhir/Patient?name=John" "GET /fhir/Patient?name=John (Search by name)" "200"

# Test 4: Search Patients with pagination
test_endpoint "GET" "/fhir/Patient?_page=1&_count=10" "GET /fhir/Patient?_page=1&_count=10 (Pagination)" "200"

# Test 5: Get Patient by ID (if we have one)
if [ -n "$PATIENT_ID" ]; then
    test_endpoint "GET" "/fhir/Patient/$PATIENT_ID" "GET /fhir/Patient/:id (Get by ID)" "200"
else
    echo -e "${YELLOW}⚠️  Skipping GET /fhir/Patient/:id (no patient ID)${NC}"
fi

# Test 6: Create Patient
FHIR_PATIENT='{
  "resourceType": "Patient",
  "name": [{
    "family": "Doe",
    "given": ["John", "Test"],
    "use": "official"
  }],
  "gender": "male",
  "birthDate": "1990-01-15",
  "telecom": [{
    "system": "phone",
    "value": "+263771234567",
    "use": "mobile"
  }],
  "address": [{
    "use": "home",
    "line": ["123 Test Street"],
    "city": "Bulawayo",
    "country": "ZW"
  }]
}'

CREATE_RESPONSE=$(curl -s -w "\n%{http_code}" -X POST \
    "$BASE_URL/fhir/Patient" \
    -H "Content-Type: application/json" \
    -H "X-Tenant-ID: $TENANT_SLUG" \
    -H "Authorization: Bearer $TOKEN" \
    -d "$FHIR_PATIENT" 2>&1)

CREATE_HTTP_CODE=$(echo "$CREATE_RESPONSE" | tail -n1)
CREATE_BODY=$(echo "$CREATE_RESPONSE" | sed '$d')

if [ "$CREATE_HTTP_CODE" = "201" ] || [ "$CREATE_HTTP_CODE" = "200" ]; then
    echo -e "Testing: POST /fhir/Patient (Create Patient) ... ${GREEN}✅ PASSED${NC} (HTTP $CREATE_HTTP_CODE)"
    PASSED=$((PASSED + 1))
    # Extract patient ID from response
    CREATED_PATIENT_ID=$(echo "$CREATE_BODY" | grep -o '"id":"[^"]*' | head -1 | cut -d'"' -f4)
    if [ -n "$CREATED_PATIENT_ID" ]; then
        PATIENT_ID="$CREATED_PATIENT_ID"
        echo "  Created Patient ID: $PATIENT_ID"
    fi
else
    echo -e "Testing: POST /fhir/Patient (Create Patient) ... ${RED}❌ FAILED${NC} (HTTP $CREATE_HTTP_CODE, expected 201)"
    echo "Response: $CREATE_BODY" | head -c 200
    echo ""
    FAILED=$((FAILED + 1))
fi

# Test 7: Update Patient (if we have a patient ID)
if [ -n "$PATIENT_ID" ]; then
    UPDATE_PATIENT='{
      "resourceType": "Patient",
      "id": "'$PATIENT_ID'",
      "name": [{
        "family": "Doe",
        "given": ["John", "Updated"],
        "use": "official"
      }],
      "gender": "male",
      "birthDate": "1990-01-15",
      "telecom": [{
        "system": "phone",
        "value": "+263771234568",
        "use": "mobile"
      }]
    }'
    
    test_endpoint "PUT" "/fhir/Patient/$PATIENT_ID" "PUT /fhir/Patient/:id (Update Patient)" "200" "$UPDATE_PATIENT"
else
    echo -e "${YELLOW}⚠️  Skipping PUT /fhir/Patient/:id (no patient ID)${NC}"
fi

# Test 8: Search Observations
test_endpoint "GET" "/fhir/Observation" "GET /fhir/Observation (Search all)" "200"

# Test 9: Search Observations by patient
if [ -n "$PATIENT_ID" ]; then
    test_endpoint "GET" "/fhir/Observation?patient=Patient/$PATIENT_ID" "GET /fhir/Observation?patient=Patient/:id" "200"
else
    echo -e "${YELLOW}⚠️  Skipping GET /fhir/Observation?patient=... (no patient ID)${NC}"
fi

# Test 10: Search Observations by date
test_endpoint "GET" "/fhir/Observation?date=ge2024-01-01" "GET /fhir/Observation?date=ge2024-01-01 (Date range)" "200"

# Test 11: Search Encounters
test_endpoint "GET" "/fhir/Encounter" "GET /fhir/Encounter (Search all)" "200"

# Test 12: Search Encounters by patient
if [ -n "$PATIENT_ID" ]; then
    test_endpoint "GET" "/fhir/Encounter?patient=Patient/$PATIENT_ID" "GET /fhir/Encounter?patient=Patient/:id" "200"
else
    echo -e "${YELLOW}⚠️  Skipping GET /fhir/Encounter?patient=... (no patient ID)${NC}"
fi

# Test 13: Search Encounters by status
test_endpoint "GET" "/fhir/Encounter?status=in-progress" "GET /fhir/Encounter?status=in-progress" "200"

# Test 14: Search Encounters by date
test_endpoint "GET" "/fhir/Encounter?date=ge2024-01-01" "GET /fhir/Encounter?date=ge2024-01-01 (Date range)" "200"

# Summary
echo ""
echo "================================"
echo "📊 Test Summary"
echo "================================"
echo -e "${GREEN}✅ Passed: $PASSED${NC}"
echo -e "${RED}❌ Failed: $FAILED${NC}"
echo "Total: $((PASSED + FAILED))"
echo ""

if [ $FAILED -eq 0 ]; then
    echo -e "${GREEN}🎉 All FHIR endpoint tests passed!${NC}"
    exit 0
else
    echo -e "${RED}⚠️  Some tests failed. Please review the output above.${NC}"
    exit 1
fi

