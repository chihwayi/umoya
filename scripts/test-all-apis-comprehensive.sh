#!/bin/bash

# Comprehensive API Testing Script
# Tests all dashboard endpoints with proper authentication

echo "🧪 Comprehensive API Testing for All Dashboards"
echo "================================================"
echo ""

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Login and get token
echo "📝 Step 1: Logging in..."
LOGIN_RESPONSE=$(curl -s -X POST http://localhost:3013/api/auth/login \
  -H "Content-Type: application/json" \
  -H "X-Tenant-ID: bulawayo-general" \
  -d '{"email":"dr.smith@bulawayo-general.co.zw","password":"Password1#"}')

TOKEN=$(echo $LOGIN_RESPONSE | grep -o '"token":"[^"]*' | cut -d'"' -f4)

if [ -z "$TOKEN" ]; then
  echo -e "${RED}❌ Login failed!${NC}"
  echo "$LOGIN_RESPONSE"
  exit 1
fi

echo -e "${GREEN}✅ Login successful${NC}"
echo ""

# Test function
test_endpoint() {
  local name=$1
  local method=$2
  local url=$3
  local data=$4
  
  echo -n "Testing $name... "
  
  if [ "$method" = "GET" ]; then
    RESPONSE=$(curl -s -w "\n%{http_code}" -H "Authorization: Bearer $TOKEN" -H "X-Tenant-ID: bulawayo-general" "$url")
  else
    RESPONSE=$(curl -s -w "\n%{http_code}" -X $method -H "Authorization: Bearer $TOKEN" -H "X-Tenant-ID: bulawayo-general" -H "Content-Type: application/json" -d "$data" "$url")
  fi
  
  HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
  BODY=$(echo "$RESPONSE" | sed '$d')
  
  if [ "$HTTP_CODE" = "200" ] || [ "$HTTP_CODE" = "201" ]; then
    echo -e "${GREEN}✅ OK (${HTTP_CODE})${NC}"
    return 0
  elif [ "$HTTP_CODE" = "404" ]; then
    echo -e "${RED}❌ NOT FOUND (404)${NC}"
    return 1
  elif [ "$HTTP_CODE" = "400" ]; then
    echo -e "${YELLOW}⚠️  BAD REQUEST (400) - Route exists but validation failed${NC}"
    return 0
  else
    echo -e "${YELLOW}⚠️  HTTP ${HTTP_CODE}${NC}"
    return 1
  fi
}

# Test all endpoints
echo "📊 Step 2: Testing All Dashboard Endpoints"
echo "-------------------------------------------"
echo ""

FAILED=0
PASSED=0

# Get real IDs from database
PATIENT_ID=$(docker exec medicore-postgres-master psql -U medicore -d tenant_bulawayo_general -t -c "SELECT id FROM patients LIMIT 1;" 2>&1 | tr -d ' \n' | head -1)
PHYSICIAN_ID=$(docker exec medicore-postgres-master psql -U medicore -d tenant_bulawayo_general -t -c "SELECT id FROM users WHERE role = 'doctor' LIMIT 1;" 2>&1 | tr -d ' \n' | head -1)

# Use default UUIDs if database query fails
if [ -z "$PATIENT_ID" ] || [ "$PATIENT_ID" = "" ]; then
  PATIENT_ID="00000000-0000-0000-0000-000000000000"
fi
if [ -z "$PHYSICIAN_ID" ] || [ "$PHYSICIAN_ID" = "" ]; then
  PHYSICIAN_ID="00000000-0000-0000-0000-000000000000"
fi

# PACU Dashboard
echo "🏥 PACU Dashboard"
test_endpoint "PACU Active Patients" "GET" "http://localhost:3013/api/anesthesia/pacu/active" && ((PASSED++)) || ((FAILED++))
echo ""

# OR Dashboard
echo "🏥 Operating Room Dashboard"
test_endpoint "OR Availability" "GET" "http://localhost:3013/api/operating-room/availability" && ((PASSED++)) || ((FAILED++))
test_endpoint "OR Metrics" "GET" "http://localhost:3013/api/operating-room/metrics" && ((PASSED++)) || ((FAILED++))
echo ""

# MAR Dashboard
echo "💊 MAR Dashboard"
test_endpoint "MAR by Patient" "GET" "http://localhost:3013/api/bcma/mar/patient/$PATIENT_ID?date=2025-12-05" && ((PASSED++)) || ((FAILED++))
echo ""

# Blood Bank Dashboard
echo "🩸 Blood Bank Dashboard"
test_endpoint "Blood Inventory" "GET" "http://localhost:3013/api/blood-bank/inventory" && ((PASSED++)) || ((FAILED++))
test_endpoint "Inventory Stats" "GET" "http://localhost:3013/api/blood-bank/inventory/stats" && ((PASSED++)) || ((FAILED++))
test_endpoint "Active Transfusions" "GET" "http://localhost:3013/api/blood-bank/transfusions/active" && ((PASSED++)) || ((FAILED++))
echo ""

# Infection Control Dashboard
echo "🦠 Infection Control Dashboard"
test_endpoint "Infections by Date" "GET" "http://localhost:3013/api/infection-control/infections?startDate=2024-01-01&endDate=2024-12-31" && ((PASSED++)) || ((FAILED++))
test_endpoint "HAI Metrics" "GET" "http://localhost:3013/api/infection-control/metrics/hai" && ((PASSED++)) || ((FAILED++))
test_endpoint "Active Isolations" "GET" "http://localhost:3013/api/infection-control/isolation/active" && ((PASSED++)) || ((FAILED++))
echo ""

# Sepsis Dashboard
echo "🚨 Sepsis Dashboard"
test_endpoint "Sepsis Alerts" "GET" "http://localhost:3013/api/sepsis/alerts" && ((PASSED++)) || ((FAILED++))
test_endpoint "Bundle Compliance" "GET" "http://localhost:3013/api/sepsis/compliance?startDate=2024-01-01&endDate=2024-12-31" && ((PASSED++)) || ((FAILED++))
echo ""

# Revenue Cycle Dashboard
echo "💰 Revenue Cycle Dashboard"
test_endpoint "Charge Master" "GET" "http://localhost:3013/api/revenue-cycle/charge-master" && ((PASSED++)) || ((FAILED++))
echo ""

# CDI Dashboard
echo "📋 CDI Dashboard"
test_endpoint "CDI Metrics" "GET" "http://localhost:3013/api/cdi/metrics?startDate=2024-01-01&endDate=2024-12-31" && ((PASSED++)) || ((FAILED++))
test_endpoint "Open Queries" "GET" "http://localhost:3013/api/cdi/queries/physician/$PHYSICIAN_ID" && ((PASSED++)) || ((FAILED++))
echo ""

# Summary
echo "================================================"
echo "📊 Test Summary"
echo "================================================"
echo -e "${GREEN}✅ Passed: $PASSED${NC}"
echo -e "${RED}❌ Failed: $FAILED${NC}"
echo ""

if [ $FAILED -eq 0 ]; then
  echo -e "${GREEN}🎉 All endpoints are accessible!${NC}"
  exit 0
else
  echo -e "${RED}⚠️  Some endpoints are returning 404. The backend may need a restart.${NC}"
  echo ""
  echo "To restart the backend:"
  echo "  cd services/ehr-service"
  echo "  npm run dev"
  exit 1
fi


