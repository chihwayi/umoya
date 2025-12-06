#!/bin/bash

# Test script to verify all dashboard APIs are working
# Usage: ./scripts/test-all-dashboard-apis.sh

BASE_URL="http://localhost:3013/api"
TENANT="bulawayo-general"
EMAIL="dr.smith@bulawayo-general.co.zw"
PASSWORD="Password1#"

echo "🧪 Testing All Dashboard APIs"
echo "================================"
echo ""

# Step 1: Login and get token
echo "📝 Step 1: Logging in..."
LOGIN_RESPONSE=$(curl -s -X POST "$BASE_URL/auth/login" \
  -H "Content-Type: application/json" \
  -H "X-Tenant-ID: $TENANT" \
  -d "{\"email\":\"$EMAIL\",\"password\":\"$PASSWORD\"}")

TOKEN=$(echo $LOGIN_RESPONSE | grep -o '"accessToken":"[^"]*' | cut -d'"' -f4)

if [ -z "$TOKEN" ]; then
  echo "❌ Login failed!"
  echo "Response: $LOGIN_RESPONSE"
  exit 1
fi

echo "✅ Login successful"
echo ""

# Test function
test_endpoint() {
  local name=$1
  local method=$2
  local endpoint=$3
  local data=$4
  
  echo "🔍 Testing: $name"
  echo "   $method $endpoint"
  
  if [ "$method" = "GET" ]; then
    RESPONSE=$(curl -s -w "\n%{http_code}" -X GET "$BASE_URL$endpoint" \
      -H "Authorization: Bearer $TOKEN" \
      -H "X-Tenant-ID: $TENANT")
  else
    RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "$BASE_URL$endpoint" \
      -H "Authorization: Bearer $TOKEN" \
      -H "X-Tenant-ID: $TENANT" \
      -H "Content-Type: application/json" \
      -d "$data")
  fi
  
  HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
  BODY=$(echo "$RESPONSE" | sed '$d')
  
  if [ "$HTTP_CODE" = "200" ] || [ "$HTTP_CODE" = "201" ]; then
    echo "   ✅ Status: $HTTP_CODE"
  else
    echo "   ❌ Status: $HTTP_CODE"
    echo "   Response: $BODY"
  fi
  echo ""
}

# ==================== PACU DASHBOARD ====================
echo "🏥 PACU Dashboard APIs"
echo "----------------------"
test_endpoint "Get Active PACU Patients" "GET" "/anesthesia/pacu/active"

# ==================== OR DASHBOARD ====================
echo "🏥 Operating Room Dashboard APIs"
echo "---------------------------------"
test_endpoint "Get OR Availability" "GET" "/operating-room/availability?date=$(date +%Y-%m-%d)"
test_endpoint "Get OR Metrics" "GET" "/operating-room/metrics?startDate=$(date -d '30 days ago' +%Y-%m-%d)&endDate=$(date +%Y-%m-%d)"

# ==================== MAR DASHBOARD ====================
echo "🏥 MAR (BCMA) Dashboard APIs"
echo "-----------------------------"
# First get a patient ID from admissions
ADMISSIONS=$(curl -s -X GET "$BASE_URL/beds/admissions" \
  -H "Authorization: Bearer $TOKEN" \
  -H "X-Tenant-ID: $TENANT")

PATIENT_ID=$(echo $ADMISSIONS | grep -o '"patientId":"[^"]*' | head -1 | cut -d'"' -f4)

if [ ! -z "$PATIENT_ID" ]; then
  test_endpoint "Get Patient MAR" "GET" "/bcma/mar/patient/$PATIENT_ID"
else
  echo "⚠️  No admitted patients found, skipping MAR test"
  echo ""
fi

# ==================== BLOOD BANK DASHBOARD ====================
echo "🏥 Blood Bank Dashboard APIs"
echo "----------------------------"
test_endpoint "Get Blood Inventory" "GET" "/blood-bank/inventory"
test_endpoint "Get Inventory Stats" "GET" "/blood-bank/inventory/stats"
test_endpoint "Get Active Transfusions" "GET" "/blood-bank/transfusions/active"

# ==================== INFECTION CONTROL DASHBOARD ====================
echo "🏥 Infection Control Dashboard APIs"
echo "-----------------------------------"
START_DATE=$(date -d '30 days ago' +%Y-%m-%d)
END_DATE=$(date +%Y-%m-%d)
test_endpoint "Get Infections" "GET" "/infection-control/infections?startDate=$START_DATE&endDate=$END_DATE"
test_endpoint "Get HAI Metrics" "GET" "/infection-control/metrics/hai?startDate=$START_DATE&endDate=$END_DATE"
test_endpoint "Get Active Isolations" "GET" "/infection-control/isolation/active"

# ==================== SEPSIS DASHBOARD ====================
echo "🏥 Sepsis Dashboard APIs"
echo "-----------------------"
test_endpoint "Get Sepsis Alerts" "GET" "/sepsis/alerts"
test_endpoint "Get Bundle Compliance" "GET" "/sepsis/compliance?startDate=$START_DATE&endDate=$END_DATE"

# ==================== REVENUE CYCLE DASHBOARD ====================
echo "🏥 Revenue Cycle Dashboard APIs"
echo "-------------------------------"
test_endpoint "Get Charge Master" "GET" "/revenue-cycle/charge-master"

# ==================== CDI DASHBOARD ====================
echo "🏥 CDI Dashboard APIs"
echo "--------------------"
# Get current user ID from token (we'll use a placeholder for now)
USER_ID="test-user-id"
test_endpoint "Get CDI Metrics" "GET" "/cdi/metrics?startDate=$START_DATE&endDate=$END_DATE"
test_endpoint "Get Physician Queries" "GET" "/cdi/queries/physician/$USER_ID"

echo ""
echo "✅ API Testing Complete!"
echo "================================"




