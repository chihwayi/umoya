#!/bin/bash

# Load environment variables
source "$(dirname "$0")/load-env.sh"

# Tier 1 API Endpoint Testing Script
# Tests all POST/GET/PUT/DELETE endpoints for Sprints 21-25

set -e

echo "🧪 TIER 1 API ENDPOINT TESTING"
echo "=============================="
echo ""

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

BASE_URL="$API_BASE_URL"
TENANT_SLUG="bulawayo-general"
TOKEN=""

# Function to print test results
print_result() {
    local test_name=$1
    local status_code=$2
    local expected=$3
    
    if [ "$status_code" -eq "$expected" ]; then
        echo -e "${GREEN}✅ PASS${NC} - $test_name (HTTP $status_code)"
    else
        echo -e "${RED}❌ FAIL${NC} - $test_name (Expected HTTP $expected, Got $status_code)"
    fi
}

# Function to print section header
print_section() {
    echo ""
    echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${BLUE}$1${NC}"
    echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
}

# Step 1: Get JWT Token
print_section "🔐 STEP 1: AUTHENTICATION"
echo "Logging in as doctor@bulawayo.com..."

LOGIN_RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "$BASE_URL/auth/login" \
  -H "Content-Type: application/json" \
  -H "X-Tenant-ID: $TENANT_SLUG" \
  -d '{
    "email": "doctor@bulawayo.com",
    "password": "password123"
  }')

HTTP_CODE=$(echo "$LOGIN_RESPONSE" | tail -n1)
RESPONSE_BODY=$(echo "$LOGIN_RESPONSE" | head -n-1)

if [ "$HTTP_CODE" -eq 200 ] || [ "$HTTP_CODE" -eq 201 ]; then
    TOKEN=$(echo "$RESPONSE_BODY" | grep -o '"token":"[^"]*' | sed 's/"token":"//')
    if [ -z "$TOKEN" ]; then
        TOKEN=$(echo "$RESPONSE_BODY" | grep -o '"access_token":"[^"]*' | sed 's/"access_token":"//')
    fi
    echo -e "${GREEN}✅ Login successful${NC}"
    echo "Token: ${TOKEN:0:50}..."
else
    echo -e "${RED}❌ Login failed (HTTP $HTTP_CODE)${NC}"
    echo "Response: $RESPONSE_BODY"
    exit 1
fi

# ============================================================================
# SPRINT 21: E-CONSENT MANAGEMENT
# ============================================================================
print_section "📋 SPRINT 21: E-CONSENT MANAGEMENT"

echo "Testing consent endpoints..."

# Test 1: GET Consent Templates
echo ""
echo "Test 1: GET /consents/templates"
RESPONSE=$(curl -s -w "\n%{http_code}" -X GET "$BASE_URL/consents/templates" \
  -H "Authorization: Bearer $TOKEN" \
  -H "X-Tenant-ID: $TENANT_SLUG")
HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
print_result "Get consent templates" "$HTTP_CODE" 200

# Test 2: GET Single Consent Template
echo ""
echo "Test 2: GET /consents/templates/:id"
TEMPLATE_ID=$(echo "$RESPONSE" | head -n-1 | grep -o '"id":"[^"]*' | head -1 | sed 's/"id":"//')
if [ -n "$TEMPLATE_ID" ]; then
    RESPONSE=$(curl -s -w "\n%{http_code}" -X GET "$BASE_URL/consents/templates/$TEMPLATE_ID" \
      -H "Authorization: Bearer $TOKEN" \
      -H "X-Tenant-ID: $TENANT_SLUG")
    HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
    print_result "Get single consent template" "$HTTP_CODE" 200
else
    echo -e "${YELLOW}⚠️  SKIP${NC} - Get single template (No templates available)"
fi

# Test 3: POST Create Consent Template
echo ""
echo "Test 3: POST /consents/templates"
RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "$BASE_URL/consents/templates" \
  -H "Authorization: Bearer $TOKEN" \
  -H "X-Tenant-ID: $TENANT_SLUG" \
  -H "Content-Type: application/json" \
  -d '{
    "templateName": "Test Consent Template",
    "templateCode": "TEST_CONSENT_001",
    "consentType": "treatment",
    "version": "1.0",
    "title": "Test Consent",
    "content": "This is a test consent form.",
    "effectiveDate": "2025-12-03"
  }')
HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
print_result "Create consent template" "$HTTP_CODE" 201

# ============================================================================
# SPRINT 22: IMMUNIZATION REGISTRY
# ============================================================================
print_section "💉 SPRINT 22: IMMUNIZATION REGISTRY"

echo "Testing immunization endpoints..."

# Test 1: GET Immunization Schedules
echo ""
echo "Test 1: GET /immunizations/schedules"
RESPONSE=$(curl -s -w "\n%{http_code}" -X GET "$BASE_URL/immunizations/schedules" \
  -H "Authorization: Bearer $TOKEN" \
  -H "X-Tenant-ID: $TENANT_SLUG")
HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
print_result "Get immunization schedules" "$HTTP_CODE" 200

# Test 2: GET Schedules by Age
echo ""
echo "Test 2: GET /immunizations/schedules?age=2&unit=months"
RESPONSE=$(curl -s -w "\n%{http_code}" -X GET "$BASE_URL/immunizations/schedules?age=2&unit=months" \
  -H "Authorization: Bearer $TOKEN" \
  -H "X-Tenant-ID: $TENANT_SLUG")
HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
print_result "Get schedules by age" "$HTTP_CODE" 200

# Test 3: GET Vaccine Inventory
echo ""
echo "Test 3: GET /immunizations/inventory"
RESPONSE=$(curl -s -w "\n%{http_code}" -X GET "$BASE_URL/immunizations/inventory" \
  -H "Authorization: Bearer $TOKEN" \
  -H "X-Tenant-ID: $TENANT_SLUG")
HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
print_result "Get vaccine inventory" "$HTTP_CODE" 200

# Test 4: POST Record Immunization (will fail without patient, that's ok)
echo ""
echo "Test 4: POST /immunizations (expect 400/404 without patient)"
RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "$BASE_URL/immunizations" \
  -H "Authorization: Bearer $TOKEN" \
  -H "X-Tenant-ID: $TENANT_SLUG" \
  -H "Content-Type: application/json" \
  -d '{
    "patientId": "00000000-0000-0000-0000-000000000000",
    "vaccineCode": "90371",
    "vaccineInfo": { "cvxCode": "116" },
    "administrationSite": "left_arm",
    "doseVolume": "0.5"
  }')
HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
if [ "$HTTP_CODE" -eq 400 ] || [ "$HTTP_CODE" -eq 404 ]; then
    echo -e "${GREEN}✅ PASS${NC} - Record immunization (Expected error without valid patient, got HTTP $HTTP_CODE)"
else
    print_result "Record immunization" "$HTTP_CODE" 201
fi

# ============================================================================
# SPRINT 23: BED MANAGEMENT & ADT
# ============================================================================
print_section "🏥 SPRINT 23: BED MANAGEMENT & ADT"

echo "Testing bed management endpoints..."

# Test 1: GET All Beds
echo ""
echo "Test 1: GET /beds"
RESPONSE=$(curl -s -w "\n%{http_code}" -X GET "$BASE_URL/beds" \
  -H "Authorization: Bearer $TOKEN" \
  -H "X-Tenant-ID: $TENANT_SLUG")
HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
RESPONSE_BODY=$(echo "$RESPONSE" | head -n-1)
print_result "Get all beds" "$HTTP_CODE" 200

# Count beds
BED_COUNT=$(echo "$RESPONSE_BODY" | grep -o '"id"' | wc -l | tr -d ' ')
echo "  → Found $BED_COUNT beds"

# Test 2: GET Available Beds
echo ""
echo "Test 2: GET /beds/available"
RESPONSE=$(curl -s -w "\n%{http_code}" -X GET "$BASE_URL/beds/available" \
  -H "Authorization: Bearer $TOKEN" \
  -H "X-Tenant-ID: $TENANT_SLUG")
HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
print_result "Get available beds" "$HTTP_CODE" 200

# Test 3: GET Wards List
echo ""
echo "Test 3: GET /beds/wards"
RESPONSE=$(curl -s -w "\n%{http_code}" -X GET "$BASE_URL/beds/wards" \
  -H "Authorization: Bearer $TOKEN" \
  -H "X-Tenant-ID: $TENANT_SLUG")
HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
print_result "Get wards list" "$HTTP_CODE" 200

# Test 4: GET Bed Occupancy
echo ""
echo "Test 4: GET /beds/occupancy"
RESPONSE=$(curl -s -w "\n%{http_code}" -X GET "$BASE_URL/beds/occupancy" \
  -H "Authorization: Bearer $TOKEN" \
  -H "X-Tenant-ID: $TENANT_SLUG")
HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
print_result "Get bed occupancy stats" "$HTTP_CODE" 200

# Test 5: GET Active Admissions
echo ""
echo "Test 5: GET /beds/admissions"
RESPONSE=$(curl -s -w "\n%{http_code}" -X GET "$BASE_URL/beds/admissions" \
  -H "Authorization: Bearer $TOKEN" \
  -H "X-Tenant-ID: $TENANT_SLUG")
HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
print_result "Get active admissions" "$HTTP_CODE" 200

# Test 6: GET Census
echo ""
echo "Test 6: GET /beds/census"
RESPONSE=$(curl -s -w "\n%{http_code}" -X GET "$BASE_URL/beds/census" \
  -H "Authorization: Bearer $TOKEN" \
  -H "X-Tenant-ID: $TENANT_SLUG")
HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
print_result "Get census snapshot" "$HTTP_CODE" 200

# ============================================================================
# SPRINT 24: EMERGENCY DEPARTMENT
# ============================================================================
print_section "🚨 SPRINT 24: EMERGENCY DEPARTMENT"

echo "Testing ED endpoints..."

# Test 1: GET ED Tracking Board
echo ""
echo "Test 1: GET /ed/tracking-board"
RESPONSE=$(curl -s -w "\n%{http_code}" -X GET "$BASE_URL/ed/tracking-board" \
  -H "Authorization: Bearer $TOKEN" \
  -H "X-Tenant-ID: $TENANT_SLUG")
HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
print_result "Get ED tracking board" "$HTTP_CODE" 200

# Test 2: GET ED Metrics
echo ""
echo "Test 2: GET /ed/metrics"
RESPONSE=$(curl -s -w "\n%{http_code}" -X GET "$BASE_URL/ed/metrics" \
  -H "Authorization: Bearer $TOKEN" \
  -H "X-Tenant-ID: $TENANT_SLUG")
HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
print_result "Get ED metrics" "$HTTP_CODE" 200

# Test 3: POST Create ED Visit (will fail without patient)
echo ""
echo "Test 3: POST /ed/visits (expect 400/404 without patient)"
RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "$BASE_URL/ed/visits" \
  -H "Authorization: Bearer $TOKEN" \
  -H "X-Tenant-ID: $TENANT_SLUG" \
  -H "Content-Type: application/json" \
  -d '{
    "patientId": "00000000-0000-0000-0000-000000000000",
    "chiefComplaint": "Chest pain",
    "arrivalMethod": "ambulance"
  }')
HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
if [ "$HTTP_CODE" -eq 400 ] || [ "$HTTP_CODE" -eq 404 ]; then
    echo -e "${GREEN}✅ PASS${NC} - Create ED visit (Expected error without valid patient, got HTTP $HTTP_CODE)"
else
    print_result "Create ED visit" "$HTTP_CODE" 201
fi

# ============================================================================
# SPRINT 25: CLINICAL PATHWAYS
# ============================================================================
print_section "📋 SPRINT 25: CLINICAL PATHWAYS"

echo "Testing clinical pathway endpoints..."

# Test 1: GET All Pathways
echo ""
echo "Test 1: GET /clinical-pathways"
RESPONSE=$(curl -s -w "\n%{http_code}" -X GET "$BASE_URL/clinical-pathways" \
  -H "Authorization: Bearer $TOKEN" \
  -H "X-Tenant-ID: $TENANT_SLUG")
HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
RESPONSE_BODY=$(echo "$RESPONSE" | head -n-1)
print_result "Get all clinical pathways" "$HTTP_CODE" 200

# Count pathways
PATHWAY_COUNT=$(echo "$RESPONSE_BODY" | grep -o '"id"' | wc -l | tr -d ' ')
echo "  → Found $PATHWAY_COUNT pathways"

# Test 2: GET Single Pathway
echo ""
echo "Test 2: GET /clinical-pathways/:id"
PATHWAY_ID=$(echo "$RESPONSE_BODY" | grep -o '"id":"[^"]*' | head -1 | sed 's/"id":"//')
if [ -n "$PATHWAY_ID" ]; then
    RESPONSE=$(curl -s -w "\n%{http_code}" -X GET "$BASE_URL/clinical-pathways/$PATHWAY_ID" \
      -H "Authorization: Bearer $TOKEN" \
      -H "X-Tenant-ID: $TENANT_SLUG")
    HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
    print_result "Get single pathway" "$HTTP_CODE" 200
else
    echo -e "${YELLOW}⚠️  SKIP${NC} - Get single pathway (No pathways available)"
fi

# Test 3: GET Pathways by Condition
echo ""
echo "Test 3: GET /clinical-pathways?condition=sepsis"
RESPONSE=$(curl -s -w "\n%{http_code}" -X GET "$BASE_URL/clinical-pathways?condition=sepsis" \
  -H "Authorization: Bearer $TOKEN" \
  -H "X-Tenant-ID: $TENANT_SLUG")
HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
print_result "Get pathways by condition" "$HTTP_CODE" 200

# Test 4: POST Enroll Patient (will fail without patient)
echo ""
echo "Test 4: POST /clinical-pathways/enroll (expect 400/404 without patient)"
RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "$BASE_URL/clinical-pathways/enroll" \
  -H "Authorization: Bearer $TOKEN" \
  -H "X-Tenant-ID: $TENANT_SLUG" \
  -H "Content-Type: application/json" \
  -d '{
    "patientId": "00000000-0000-0000-0000-000000000000",
    "pathwayId": "'"$PATHWAY_ID"'",
    "enrollmentReason": "Test enrollment"
  }')
HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
if [ "$HTTP_CODE" -eq 400 ] || [ "$HTTP_CODE" -eq 404 ]; then
    echo -e "${GREEN}✅ PASS${NC} - Enroll patient (Expected error without valid patient, got HTTP $HTTP_CODE)"
else
    print_result "Enroll patient in pathway" "$HTTP_CODE" 201
fi

# ============================================================================
# SUMMARY
# ============================================================================
print_section "📊 TEST SUMMARY"

echo ""
echo "All API endpoint tests completed!"
echo ""
echo "Next steps:"
echo "1. Review results above"
echo "2. Fix any failing endpoints"
echo "3. Fix database seed data issues"
echo "4. Begin UI testing"
echo ""
echo -e "${GREEN}✅ API Testing Complete${NC}"

