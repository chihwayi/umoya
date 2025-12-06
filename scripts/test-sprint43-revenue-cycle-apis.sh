#!/bin/bash

# Sprint 43: Revenue Cycle Approval Workflow API Testing
# Tests all new approval workflow endpoints

set -e

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
BASE_URL="http://localhost:3013/api"
TENANT_SLUG="bulawayo-general"
DB_NAME="tenant_bulawayo_general"

# Test credentials
EMAIL="dr.smith@bulawayo-general.co.zw"
PASSWORD="Password1#"

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}  Sprint 43: Revenue Cycle API Tests${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

# Check if Docker is running
if ! docker ps | grep -q "medicore-postgres-master"; then
    echo -e "${RED}❌ Docker PostgreSQL container is not running${NC}"
    exit 1
fi

# Check if backend is running
if ! curl -s -f "${BASE_URL}/health" > /dev/null 2>&1; then
    echo -e "${YELLOW}⚠️  Backend health check failed. Trying to continue anyway...${NC}"
fi

# Login and get token
echo -e "${BLUE}🔐 Logging in...${NC}"
LOGIN_RESPONSE=$(curl -s -X POST "${BASE_URL}/auth/login" \
  -H "Content-Type: application/json" \
  -H "X-Tenant-ID: ${TENANT_SLUG}" \
  -d "{\"email\":\"${EMAIL}\",\"password\":\"${PASSWORD}\"}")

TOKEN=$(echo $LOGIN_RESPONSE | grep -o '"token":"[^"]*' | cut -d'"' -f4)

if [ -z "$TOKEN" ]; then
    echo -e "${RED}❌ Login failed${NC}"
    echo "Response: $LOGIN_RESPONSE"
    exit 1
fi

echo -e "${GREEN}✅ Login successful${NC}"
echo ""

# Get test data from database
echo -e "${BLUE}📊 Fetching test data from database...${NC}"

PATIENT_ID=$(docker exec medicore-postgres-master psql -U medicore -d ${DB_NAME} -t -c "SELECT id FROM patients LIMIT 1;" 2>&1 | tr -d ' \n' | head -1)
DOCTOR_ID=$(docker exec medicore-postgres-master psql -U medicore -d ${DB_NAME} -t -c "SELECT id FROM users WHERE role = 'doctor' LIMIT 1;" 2>&1 | tr -d ' \n' | head -1)
ADMISSION_ID=$(docker exec medicore-postgres-master psql -U medicore -d ${DB_NAME} -t -c "SELECT id FROM admissions WHERE admission_status = 'active' LIMIT 1;" 2>&1 | tr -d ' \n' | head -1)
CHARGE_CODE=$(docker exec medicore-postgres-master psql -U medicore -d ${DB_NAME} -t -c "SELECT charge_code FROM charge_master WHERE is_active = true LIMIT 1;" 2>&1 | tr -d ' \n' | head -1)

# Fallback UUIDs if database is empty
if [ -z "$PATIENT_ID" ] || [ ${#PATIENT_ID} -ne 36 ]; then
    PATIENT_ID="00000000-0000-0000-0000-000000000001"
    echo -e "${YELLOW}⚠️  Using fallback PATIENT_ID${NC}"
fi

if [ -z "$DOCTOR_ID" ] || [ ${#DOCTOR_ID} -ne 36 ]; then
    DOCTOR_ID="00000000-0000-0000-0000-000000000002"
    echo -e "${YELLOW}⚠️  Using fallback DOCTOR_ID${NC}"
fi

if [ -z "$CHARGE_CODE" ]; then
    CHARGE_CODE="CONSULT-NEW-PATIENT"
    echo -e "${YELLOW}⚠️  Using fallback CHARGE_CODE${NC}"
fi

echo -e "${GREEN}✅ Test data fetched:${NC}"
echo "  Patient ID: $PATIENT_ID"
echo "  Doctor ID: $DOCTOR_ID"
echo "  Admission ID: ${ADMISSION_ID:-'None (will create charge without admission)'}"
echo "  Charge Code: $CHARGE_CODE"
echo ""

# Test counter
PASSED=0
FAILED=0
TOTAL=0

# Test function
test_endpoint() {
    local name=$1
    local method=$2
    local url=$3
    local data=$4
    local expected_status=${5:-200}
    
    TOTAL=$((TOTAL + 1))
    
    echo -e "${BLUE}Testing: ${name}${NC}"
    echo "  ${method} ${url}"
    
    if [ -n "$data" ]; then
        RESPONSE=$(curl -s -w "\n%{http_code}" -X ${method} "${url}" \
          -H "Content-Type: application/json" \
          -H "X-Tenant-ID: ${TENANT_SLUG}" \
          -H "Authorization: Bearer ${TOKEN}" \
          -d "${data}")
    else
        RESPONSE=$(curl -s -w "\n%{http_code}" -X ${method} "${url}" \
          -H "Content-Type: application/json" \
          -H "X-Tenant-ID: ${TENANT_SLUG}" \
          -H "Authorization: Bearer ${TOKEN}")
    fi
    
    HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
    BODY=$(echo "$RESPONSE" | sed '$d')
    
    if [ "$HTTP_CODE" -eq "$expected_status" ]; then
        echo -e "${GREEN}  ✅ PASSED (HTTP $HTTP_CODE)${NC}"
        PASSED=$((PASSED + 1))
        return 0
    else
        echo -e "${RED}  ❌ FAILED (HTTP $HTTP_CODE, expected $expected_status)${NC}"
        echo "  Response: $BODY" | head -c 200
        echo ""
        FAILED=$((FAILED + 1))
        return 1
    fi
}

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}  Phase 1: Create Test Charge${NC}"
echo -e "${BLUE}========================================${NC}"

# Step 1: Create a test charge
if [ -n "$ADMISSION_ID" ] && [ ${#ADMISSION_ID} -eq 36 ]; then
    CHARGE_DATA="{
      \"patientId\": \"${PATIENT_ID}\",
      \"admissionId\": \"${ADMISSION_ID}\",
      \"chargeCode\": \"${CHARGE_CODE}\",
      \"chargeDescription\": \"Test Charge for API Testing\",
      \"quantity\": 1,
      \"unitPrice\": 100.00,
      \"serviceDate\": \"$(date +%Y-%m-%d)\",
      \"department\": \"General\",
      \"orderingProviderId\": \"${DOCTOR_ID}\",
      \"chargeStatus\": \"pending\"
    }"
else
    CHARGE_DATA="{
      \"patientId\": \"${PATIENT_ID}\",
      \"chargeCode\": \"${CHARGE_CODE}\",
      \"chargeDescription\": \"Test Charge for API Testing\",
      \"quantity\": 1,
      \"unitPrice\": 100.00,
      \"serviceDate\": \"$(date +%Y-%m-%d)\",
      \"department\": \"General\",
      \"orderingProviderId\": \"${DOCTOR_ID}\",
      \"chargeStatus\": \"pending\"
    }"
fi

test_endpoint "Create Test Charge" "POST" "${BASE_URL}/revenue-cycle/charges" "${CHARGE_DATA}" 201

# Extract charge ID from response
CHARGE_ID=$(echo "$BODY" | grep -o '"id":"[^"]*' | cut -d'"' -f4 || echo "")

if [ -z "$CHARGE_ID" ] || [ ${#CHARGE_ID} -ne 36 ]; then
    echo -e "${RED}❌ Failed to extract charge ID from response${NC}"
    echo "Response: $BODY"
    exit 1
fi

echo -e "${GREEN}✅ Created test charge: ${CHARGE_ID}${NC}"
echo ""

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}  Phase 2: Approval Workflow Tests${NC}"
echo -e "${BLUE}========================================${NC}"

# Test 1: Review Charge
test_endpoint "Review Charge" "PUT" "${BASE_URL}/revenue-cycle/charges/${CHARGE_ID}/review" '{"notes":"Reviewed for testing"}' 200

# Test 2: Approve Charge
test_endpoint "Approve Charge" "PUT" "${BASE_URL}/revenue-cycle/charges/${CHARGE_ID}/approve" '{"notes":"Approved for testing"}' 200

# Create another charge for rejection test
if [ -n "$ADMISSION_ID" ] && [ ${#ADMISSION_ID} -eq 36 ]; then
    CHARGE_DATA_REJECT="{
      \"patientId\": \"${PATIENT_ID}\",
      \"admissionId\": \"${ADMISSION_ID}\",
      \"chargeCode\": \"${CHARGE_CODE}\",
      \"chargeDescription\": \"Test Charge for Rejection\",
      \"quantity\": 1,
      \"unitPrice\": 50.00,
      \"serviceDate\": \"$(date +%Y-%m-%d)\",
      \"department\": \"General\",
      \"orderingProviderId\": \"${DOCTOR_ID}\",
      \"chargeStatus\": \"pending\"
    }"
else
    CHARGE_DATA_REJECT="{
      \"patientId\": \"${PATIENT_ID}\",
      \"chargeCode\": \"${CHARGE_CODE}\",
      \"chargeDescription\": \"Test Charge for Rejection\",
      \"quantity\": 1,
      \"unitPrice\": 50.00,
      \"serviceDate\": \"$(date +%Y-%m-%d)\",
      \"department\": \"General\",
      \"orderingProviderId\": \"${DOCTOR_ID}\",
      \"chargeStatus\": \"pending\"
    }"
fi

REJECT_RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "${BASE_URL}/revenue-cycle/charges" \
  -H "Content-Type: application/json" \
  -H "X-Tenant-ID: ${TENANT_SLUG}" \
  -H "Authorization: Bearer ${TOKEN}" \
  -d "${CHARGE_DATA_REJECT}")

REJECT_HTTP_CODE=$(echo "$REJECT_RESPONSE" | tail -n1)
REJECT_BODY=$(echo "$REJECT_RESPONSE" | sed '$d')
REJECT_CHARGE_ID=$(echo "$REJECT_BODY" | grep -o '"id":"[^"]*' | cut -d'"' -f4 || echo "")

if [ "$REJECT_HTTP_CODE" -eq 201 ] && [ -n "$REJECT_CHARGE_ID" ]; then
    echo -e "${GREEN}✅ Created charge for rejection test: ${REJECT_CHARGE_ID}${NC}"
    
    # Test 3: Reject Charge
    test_endpoint "Reject Charge" "PUT" "${BASE_URL}/revenue-cycle/charges/${REJECT_CHARGE_ID}/reject" '{"reason":"Duplicate charge"}' 200
else
    echo -e "${YELLOW}⚠️  Could not create charge for rejection test${NC}"
    FAILED=$((FAILED + 1))
fi

echo ""

# Test 4: Get Pending Charges
test_endpoint "Get Pending Charges" "GET" "${BASE_URL}/revenue-cycle/charges/pending-review?doctorId=${DOCTOR_ID}" "" 200

echo ""

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}  Phase 3: Bulk Approval Tests${NC}"
echo -e "${BLUE}========================================${NC}"

# Only test bulk approval if we have an admission
if [ -n "$ADMISSION_ID" ] && [ ${#ADMISSION_ID} -eq 36 ]; then
    # Create multiple pending charges for the admission
    echo -e "${BLUE}Creating test charges for bulk approval...${NC}"
    
    for i in {1..3}; do
        BULK_CHARGE_DATA="{
          \"patientId\": \"${PATIENT_ID}\",
          \"admissionId\": \"${ADMISSION_ID}\",
          \"chargeCode\": \"${CHARGE_CODE}\",
          \"chargeDescription\": \"Bulk Test Charge $i\",
          \"quantity\": 1,
          \"unitPrice\": $((i * 10)).00,
          \"serviceDate\": \"$(date +%Y-%m-%d)\",
          \"department\": \"General\",
          \"orderingProviderId\": \"${DOCTOR_ID}\",
          \"chargeStatus\": \"pending\"
        }"
        
        curl -s -X POST "${BASE_URL}/revenue-cycle/charges" \
          -H "Content-Type: application/json" \
          -H "X-Tenant-ID: ${TENANT_SLUG}" \
          -H "Authorization: Bearer ${TOKEN}" \
          -d "${BULK_CHARGE_DATA}" > /dev/null
    done
    
    echo -e "${GREEN}✅ Created 3 test charges for bulk approval${NC}"
    echo ""
    
    # Test 5: Bulk Approve
    test_endpoint "Bulk Approve Charges" "PUT" "${BASE_URL}/revenue-cycle/charges/admission/${ADMISSION_ID}/approve-all" '{"notes":"Bulk approved for testing"}' 200
else
    echo -e "${YELLOW}⚠️  Skipping bulk approval test (no admission ID)${NC}"
    FAILED=$((FAILED + 1))
fi

echo ""

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}  Phase 4: Notification Tests${NC}"
echo -e "${BLUE}========================================${NC}"

# Test 6: Get Notifications
test_endpoint "Get Notifications" "GET" "${BASE_URL}/revenue-cycle/notifications?status=unread" "" 200

# Extract notification ID if available
NOTIFICATION_RESPONSE=$(curl -s -X GET "${BASE_URL}/revenue-cycle/notifications?status=unread" \
  -H "Content-Type: application/json" \
  -H "X-Tenant-ID: ${TENANT_SLUG}" \
  -H "Authorization: Bearer ${TOKEN}")

NOTIFICATION_ID=$(echo "$NOTIFICATION_RESPONSE" | grep -o '"id":"[^"]*' | head -1 | cut -d'"' -f4 || echo "")

if [ -n "$NOTIFICATION_ID" ] && [ ${#NOTIFICATION_ID} -eq 36 ]; then
    echo -e "${GREEN}✅ Found notification: ${NOTIFICATION_ID}${NC}"
    
    # Test 7: Mark Notification as Read
    test_endpoint "Mark Notification as Read" "PUT" "${BASE_URL}/revenue-cycle/notifications/${NOTIFICATION_ID}/read" "" 200
else
    echo -e "${YELLOW}⚠️  No notifications found to test mark as read${NC}"
    FAILED=$((FAILED + 1))
fi

echo ""

# Test 8: Notify Accounts (if we have an admission with approved charges)
if [ -n "$ADMISSION_ID" ] && [ ${#ADMISSION_ID} -eq 36 ]; then
    test_endpoint "Notify Accounts" "POST" "${BASE_URL}/revenue-cycle/charges/notify-accounts/${ADMISSION_ID}" "" 201
else
    echo -e "${YELLOW}⚠️  Skipping notify accounts test (no admission ID)${NC}"
    FAILED=$((FAILED + 1))
fi

echo ""

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}  Phase 5: Existing Endpoints (Verify)${NC}"
echo -e "${BLUE}========================================${NC}"

# Test existing endpoints still work
test_endpoint "Get Charge Master" "GET" "${BASE_URL}/revenue-cycle/charge-master" "" 200
test_endpoint "Get Patient Charges" "GET" "${BASE_URL}/revenue-cycle/charges/patient/${PATIENT_ID}" "" 200

if [ -n "$ADMISSION_ID" ] && [ ${#ADMISSION_ID} -eq 36 ]; then
    test_endpoint "Review Charges for Admission" "GET" "${BASE_URL}/revenue-cycle/charges/review/admission/${ADMISSION_ID}" "" 200
fi

echo ""

# Summary
echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}  Test Summary${NC}"
echo -e "${BLUE}========================================${NC}"
echo -e "Total Tests: ${TOTAL}"
echo -e "${GREEN}Passed: ${PASSED}${NC}"
echo -e "${RED}Failed: ${FAILED}${NC}"
echo ""

if [ $FAILED -eq 0 ]; then
    echo -e "${GREEN}🎉 All endpoints are accessible!${NC}"
    exit 0
else
    echo -e "${RED}❌ Some endpoints failed. Please check the logs above.${NC}"
    exit 1
fi

