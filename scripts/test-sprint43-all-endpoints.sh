#!/bin/bash

# Sprint 43: Comprehensive API Endpoint Testing
# Tests EVERY endpoint individually with detailed results

set -e

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Configuration
BASE_URL="http://localhost:3013/api"
TENANT_SLUG="bulawayo-general"
DB_NAME="tenant_bulawayo_general"

# Test credentials
EMAIL="dr.smith@bulawayo-general.co.zw"
PASSWORD="Password1#"

echo -e "${CYAN}╔════════════════════════════════════════════════════════════╗${NC}"
echo -e "${CYAN}║  Sprint 43: Revenue Cycle - Complete API Endpoint Tests  ║${NC}"
echo -e "${CYAN}╚════════════════════════════════════════════════════════════╝${NC}"
echo ""

# Check if Docker is running
if ! docker ps | grep -q "medicore-postgres-master"; then
    echo -e "${RED}❌ Docker PostgreSQL container is not running${NC}"
    exit 1
fi

# Login and get token
echo -e "${BLUE}🔐 Step 1: Logging in...${NC}"
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
echo -e "${BLUE}📊 Step 2: Fetching test data from database...${NC}"

PATIENT_ID=$(docker exec medicore-postgres-master psql -U medicore -d ${DB_NAME} -t -c "SELECT id FROM patients LIMIT 1;" 2>&1 | tr -d ' \n' | head -1)
DOCTOR_ID=$(docker exec medicore-postgres-master psql -U medicore -d ${DB_NAME} -t -c "SELECT id FROM users WHERE role = 'doctor' LIMIT 1;" 2>&1 | tr -d ' \n' | head -1)
ADMISSION_ID=$(docker exec medicore-postgres-master psql -U medicore -d ${DB_NAME} -t -c "SELECT id FROM admissions WHERE admission_status = 'active' LIMIT 1;" 2>&1 | tr -d ' \n' | head -1)
CHARGE_CODE=$(docker exec medicore-postgres-master psql -U medicore -d ${DB_NAME} -t -c "SELECT charge_code FROM charge_master WHERE is_active = true LIMIT 1;" 2>&1 | tr -d ' \n' | head -1)

# Validate UUIDs
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

echo -e "${GREEN}✅ Test data ready:${NC}"
echo "  Patient ID: $PATIENT_ID"
echo "  Doctor ID: $DOCTOR_ID"
echo "  Admission ID: ${ADMISSION_ID:-'None'}"
echo "  Charge Code: $CHARGE_CODE"
echo ""

# Test counters
TOTAL=0
PASSED=0
FAILED=0
FAILED_ENDPOINTS=()

# Test function with detailed output
test_endpoint_detailed() {
    local name=$1
    local method=$2
    local url=$3
    local data=$4
    local expected_status=$5
    
    TOTAL=$((TOTAL + 1))
    
    echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${BLUE}Test #${TOTAL}: ${name}${NC}"
    echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "Method: ${YELLOW}${method}${NC}"
    echo -e "URL: ${YELLOW}${url}${NC}"
    if [ -n "$data" ]; then
        echo -e "Body: ${YELLOW}${data}${NC}"
    fi
    echo -e "Expected: ${YELLOW}HTTP ${expected_status}${NC}"
    echo ""
    
    if [ -n "$data" ]; then
        RESPONSE=$(curl -s -w "\n%{http_code}" -X ${method} "${url}" \
          -H "Content-Type: application/json" \
          -H "X-Tenant-ID: ${TENANT_SLUG}" \
          -H "Authorization: Bearer ${TOKEN}" \
          -d "${data}" 2>&1)
    else
        RESPONSE=$(curl -s -w "\n%{http_code}" -X ${method} "${url}" \
          -H "Content-Type: application/json" \
          -H "X-Tenant-ID: ${TENANT_SLUG}" \
          -H "Authorization: Bearer ${TOKEN}" 2>&1)
    fi
    
    HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
    BODY=$(echo "$RESPONSE" | sed '$d')
    
    if [ "$HTTP_CODE" -eq "$expected_status" ]; then
        echo -e "${GREEN}✅ PASSED - HTTP ${HTTP_CODE}${NC}"
        if [ -n "$BODY" ] && [ "$BODY" != "null" ]; then
            echo -e "${GREEN}Response: ${BODY}${NC}" | head -c 200
            echo ""
        fi
        PASSED=$((PASSED + 1))
        return 0
    else
        echo -e "${RED}❌ FAILED - HTTP ${HTTP_CODE} (expected ${expected_status})${NC}"
        echo -e "${RED}Response: ${BODY}${NC}" | head -c 300
        echo ""
        FAILED=$((FAILED + 1))
        FAILED_ENDPOINTS+=("${name} (${method} ${url})")
        return 1
    fi
}

echo -e "${CYAN}╔════════════════════════════════════════════════════════════╗${NC}"
echo -e "${CYAN}║  PHASE 1: Create Test Charges                            ║${NC}"
echo -e "${CYAN}╚════════════════════════════════════════════════════════════╝${NC}"
echo ""

# Create test charge 1 (for review/approve)
if [ -n "$ADMISSION_ID" ] && [ ${#ADMISSION_ID} -eq 36 ]; then
    CHARGE_DATA_1="{\"patientId\":\"${PATIENT_ID}\",\"admissionId\":\"${ADMISSION_ID}\",\"chargeCode\":\"${CHARGE_CODE}\",\"chargeDescription\":\"Test Charge 1 - For Review\",\"quantity\":1,\"unitPrice\":100.00,\"serviceDate\":\"$(date +%Y-%m-%d)\",\"department\":\"General\",\"orderingProviderId\":\"${DOCTOR_ID}\",\"chargeStatus\":\"pending\"}"
else
    CHARGE_DATA_1="{\"patientId\":\"${PATIENT_ID}\",\"chargeCode\":\"${CHARGE_CODE}\",\"chargeDescription\":\"Test Charge 1 - For Review\",\"quantity\":1,\"unitPrice\":100.00,\"serviceDate\":\"$(date +%Y-%m-%d)\",\"department\":\"General\",\"orderingProviderId\":\"${DOCTOR_ID}\",\"chargeStatus\":\"pending\"}"
fi

test_endpoint_detailed "1. Create Test Charge (for review)" "POST" "${BASE_URL}/revenue-cycle/charges" "${CHARGE_DATA_1}" 201

CHARGE_ID_1=$(echo "$BODY" | grep -o '"id":"[^"]*' | cut -d'"' -f4 || echo "")
if [ -z "$CHARGE_ID_1" ] || [ ${#CHARGE_ID_1} -ne 36 ]; then
    echo -e "${RED}❌ Failed to extract charge ID${NC}"
    exit 1
fi
echo -e "${GREEN}   Charge ID: ${CHARGE_ID_1}${NC}"
echo ""

# Create test charge 2 (for rejection)
if [ -n "$ADMISSION_ID" ] && [ ${#ADMISSION_ID} -eq 36 ]; then
    CHARGE_DATA_2="{\"patientId\":\"${PATIENT_ID}\",\"admissionId\":\"${ADMISSION_ID}\",\"chargeCode\":\"${CHARGE_CODE}\",\"chargeDescription\":\"Test Charge 2 - For Rejection\",\"quantity\":1,\"unitPrice\":50.00,\"serviceDate\":\"$(date +%Y-%m-%d)\",\"department\":\"General\",\"orderingProviderId\":\"${DOCTOR_ID}\",\"chargeStatus\":\"pending\"}"
else
    CHARGE_DATA_2="{\"patientId\":\"${PATIENT_ID}\",\"chargeCode\":\"${CHARGE_CODE}\",\"chargeDescription\":\"Test Charge 2 - For Rejection\",\"quantity\":1,\"unitPrice\":50.00,\"serviceDate\":\"$(date +%Y-%m-%d)\",\"department\":\"General\",\"orderingProviderId\":\"${DOCTOR_ID}\",\"chargeStatus\":\"pending\"}"
fi

test_endpoint_detailed "2. Create Test Charge (for rejection)" "POST" "${BASE_URL}/revenue-cycle/charges" "${CHARGE_DATA_2}" 201

CHARGE_ID_2=$(echo "$BODY" | grep -o '"id":"[^"]*' | cut -d'"' -f4 || echo "")
if [ -n "$CHARGE_ID_2" ] && [ ${#CHARGE_ID_2} -eq 36 ]; then
    echo -e "${GREEN}   Charge ID: ${CHARGE_ID_2}${NC}"
fi
echo ""

# Create test charges for bulk approval (if we have admission)
if [ -n "$ADMISSION_ID" ] && [ ${#ADMISSION_ID} -eq 36 ]; then
    echo -e "${BLUE}Creating 3 charges for bulk approval test...${NC}"
    for i in {1..3}; do
        BULK_CHARGE_DATA="{\"patientId\":\"${PATIENT_ID}\",\"admissionId\":\"${ADMISSION_ID}\",\"chargeCode\":\"${CHARGE_CODE}\",\"chargeDescription\":\"Bulk Test Charge $i\",\"quantity\":1,\"unitPrice\":$((i * 10)).00,\"serviceDate\":\"$(date +%Y-%m-%d)\",\"department\":\"General\",\"orderingProviderId\":\"${DOCTOR_ID}\",\"chargeStatus\":\"pending\"}"
        curl -s -X POST "${BASE_URL}/revenue-cycle/charges" \
          -H "Content-Type: application/json" \
          -H "X-Tenant-ID: ${TENANT_SLUG}" \
          -H "Authorization: Bearer ${TOKEN}" \
          -d "${BULK_CHARGE_DATA}" > /dev/null
    done
    echo -e "${GREEN}✅ Created 3 charges for bulk approval${NC}"
    echo ""
fi

echo -e "${CYAN}╔════════════════════════════════════════════════════════════╗${NC}"
echo -e "${CYAN}║  PHASE 2: Approval Workflow Endpoints                    ║${NC}"
echo -e "${CYAN}╚════════════════════════════════════════════════════════════╝${NC}"
echo ""

# Test 3: Review Charge
test_endpoint_detailed "3. Review Charge" "PUT" "${BASE_URL}/revenue-cycle/charges/${CHARGE_ID_1}/mark-reviewed" '{"notes":"Reviewed for testing"}' 200
echo ""

# Test 4: Approve Charge
test_endpoint_detailed "4. Approve Charge" "PUT" "${BASE_URL}/revenue-cycle/charges/${CHARGE_ID_1}/approve" '{"notes":"Approved for testing"}' 200
echo ""

# Test 5: Reject Charge
if [ -n "$CHARGE_ID_2" ] && [ ${#CHARGE_ID_2} -eq 36 ]; then
    test_endpoint_detailed "5. Reject Charge" "PUT" "${BASE_URL}/revenue-cycle/charges/${CHARGE_ID_2}/reject" '{"reason":"Duplicate charge - testing rejection"}' 200
    echo ""
else
    echo -e "${YELLOW}⚠️  Skipping reject test (no charge ID)${NC}"
    FAILED=$((FAILED + 1))
    TOTAL=$((TOTAL + 1))
    echo ""
fi

# Test 6: Get Pending Charges
test_endpoint_detailed "6. Get Pending Charges for Doctor" "GET" "${BASE_URL}/revenue-cycle/charges/pending-review?doctorId=${DOCTOR_ID}" "" 200
echo ""

echo -e "${CYAN}╔════════════════════════════════════════════════════════════╗${NC}"
echo -e "${CYAN}║  PHASE 3: Bulk Approval Endpoint                          ║${NC}"
echo -e "${CYAN}╚════════════════════════════════════════════════════════════╝${NC}"
echo ""

# Test 7: Bulk Approve
if [ -n "$ADMISSION_ID" ] && [ ${#ADMISSION_ID} -eq 36 ]; then
    test_endpoint_detailed "7. Bulk Approve All Charges for Admission" "PUT" "${BASE_URL}/revenue-cycle/charges/admission/${ADMISSION_ID}/approve-all" '{"notes":"Bulk approved for testing"}' 200
    echo ""
else
    echo -e "${YELLOW}⚠️  Skipping bulk approve test (no admission ID)${NC}"
    FAILED=$((FAILED + 1))
    TOTAL=$((TOTAL + 1))
    echo ""
fi

echo -e "${CYAN}╔════════════════════════════════════════════════════════════╗${NC}"
echo -e "${CYAN}║  PHASE 4: Notification Endpoints                         ║${NC}"
echo -e "${CYAN}╚════════════════════════════════════════════════════════════╝${NC}"
echo ""

# Test 8: Get Notifications
test_endpoint_detailed "8. Get Charge Notifications" "GET" "${BASE_URL}/revenue-cycle/notifications?status=unread" "" 200

# Extract notification ID
NOTIFICATION_RESPONSE=$(curl -s -X GET "${BASE_URL}/revenue-cycle/notifications?status=unread" \
  -H "Content-Type: application/json" \
  -H "X-Tenant-ID: ${TENANT_SLUG}" \
  -H "Authorization: Bearer ${TOKEN}")

NOTIFICATION_ID=$(echo "$NOTIFICATION_RESPONSE" | grep -o '"id":"[^"]*' | head -1 | cut -d'"' -f4 || echo "")
echo ""

# Test 9: Mark Notification as Read
if [ -n "$NOTIFICATION_ID" ] && [ ${#NOTIFICATION_ID} -eq 36 ]; then
    echo -e "${GREEN}   Found notification ID: ${NOTIFICATION_ID}${NC}"
    test_endpoint_detailed "9. Mark Notification as Read" "PUT" "${BASE_URL}/revenue-cycle/notifications/${NOTIFICATION_ID}/read" "" 200
    echo ""
else
    echo -e "${YELLOW}⚠️  Skipping mark as read test (no notification ID)${NC}"
    FAILED=$((FAILED + 1))
    TOTAL=$((TOTAL + 1))
    echo ""
fi

# Test 10: Notify Accounts
if [ -n "$ADMISSION_ID" ] && [ ${#ADMISSION_ID} -eq 36 ]; then
    test_endpoint_detailed "10. Notify Accounts Department" "POST" "${BASE_URL}/revenue-cycle/charges/notify-accounts/${ADMISSION_ID}" "" 201
    echo ""
else
    echo -e "${YELLOW}⚠️  Skipping notify accounts test (no admission ID)${NC}"
    FAILED=$((FAILED + 1))
    TOTAL=$((TOTAL + 1))
    echo ""
fi

echo -e "${CYAN}╔════════════════════════════════════════════════════════════╗${NC}"
echo -e "${CYAN}║  PHASE 5: Existing Endpoints (Verification)              ║${NC}"
echo -e "${CYAN}╚════════════════════════════════════════════════════════════╝${NC}"
echo ""

# Test 11: Get Charge Master
test_endpoint_detailed "11. Get Charge Master" "GET" "${BASE_URL}/revenue-cycle/charge-master" "" 200
echo ""

# Test 12: Get Patient Charges
test_endpoint_detailed "12. Get Patient Charges" "GET" "${BASE_URL}/revenue-cycle/charges/patient/${PATIENT_ID}" "" 200
echo ""

# Test 13: Review Charges for Admission
if [ -n "$ADMISSION_ID" ] && [ ${#ADMISSION_ID} -eq 36 ]; then
    test_endpoint_detailed "13. Review Charges for Admission" "GET" "${BASE_URL}/revenue-cycle/charges/review/admission/${ADMISSION_ID}" "" 200
    echo ""
else
    echo -e "${YELLOW}⚠️  Skipping review charges for admission test (no admission ID)${NC}"
    FAILED=$((FAILED + 1))
    TOTAL=$((TOTAL + 1))
    echo ""
fi

# Final Summary
echo -e "${CYAN}╔════════════════════════════════════════════════════════════╗${NC}"
echo -e "${CYAN}║  FINAL TEST SUMMARY                                        ║${NC}"
echo -e "${CYAN}╚════════════════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "Total Tests Run: ${TOTAL}"
echo -e "${GREEN}✅ Passed: ${PASSED}${NC}"
echo -e "${RED}❌ Failed: ${FAILED}${NC}"
echo ""

if [ $FAILED -gt 0 ]; then
    echo -e "${RED}Failed Endpoints:${NC}"
    for endpoint in "${FAILED_ENDPOINTS[@]}"; do
        echo -e "${RED}  - ${endpoint}${NC}"
    done
    echo ""
fi

if [ $FAILED -eq 0 ]; then
    echo -e "${GREEN}╔════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${GREEN}║  🎉 ALL ENDPOINTS PASSED - 100% SUCCESS! 🎉              ║${NC}"
    echo -e "${GREEN}╚════════════════════════════════════════════════════════════╝${NC}"
    exit 0
else
    echo -e "${RED}╔════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${RED}║  ❌ SOME ENDPOINTS FAILED - Please check errors above     ║${NC}"
    echo -e "${RED}╚════════════════════════════════════════════════════════════╝${NC}"
    exit 1
fi

