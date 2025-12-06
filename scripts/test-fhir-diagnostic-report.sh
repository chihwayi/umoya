#!/bin/bash

# Configuration
BASE_URL="http://localhost:3013/api"
TENANT_ID="bulawayo-general"
ADMIN_EMAIL="admin@bulawayo-general.co.zw"
ADMIN_PASSWORD="Password1#"

echo "🧪 Testing FHIR DiagnosticReport Endpoints"
echo "============================================"

# Step 1: Log in to get a token
echo -e "\n🔐 Step 1: Logging in..."
LOGIN_RESPONSE=$(curl -s -X POST "$BASE_URL/auth/login" \
  -H "Content-Type: application/json" \
  -H "X-Tenant-ID: $TENANT_ID" \
  -d "{
    \"email\": \"$ADMIN_EMAIL\",
    \"password\": \"$ADMIN_PASSWORD\"
  }")

ACCESS_TOKEN=$(echo "$LOGIN_RESPONSE" | jq -r '.token // .accessToken')

if [ "$ACCESS_TOKEN" == "null" ] || [ -z "$ACCESS_TOKEN" ]; then
  echo -e "❌ Login failed"
  echo "$LOGIN_RESPONSE"
  exit 1
else
  echo -e "✅ Login successful"
fi

# Step 2: Fetch a test patient ID
echo -e "\n📋 Step 2: Fetching test patient ID..."
PATIENT_ID=$(curl -s -X GET "$BASE_URL/patients?limit=1" \
  -H "X-Tenant-ID: $TENANT_ID" \
  -H "Authorization: Bearer $ACCESS_TOKEN" | jq -r '.patients[0].id')

if [ "$PATIENT_ID" == "null" ]; then
  echo -e "❌ No patients found. Please create a patient first."
  exit 1
else
  echo -e "✅ Found patient: $PATIENT_ID"
fi

# Step 3: Fetch a provider ID (doctor)
echo -e "\n📋 Step 3: Fetching provider ID..."
USERS_RESPONSE=$(curl -s -X GET "$BASE_URL/users?role=doctor&limit=1" \
  -H "X-Tenant-ID: $TENANT_ID" \
  -H "Authorization: Bearer $ACCESS_TOKEN")
PROVIDER_ID=$(echo "$USERS_RESPONSE" | jq -r 'if type == "array" then .[0].id else .users[0].id // .data[0].id // .[0].id end')

if [ "$PROVIDER_ID" == "null" ] || [ -z "$PROVIDER_ID" ]; then
  # Try alternative: use the patient's doctor or admin user
  PROVIDER_ID=$(echo "$USERS_RESPONSE" | jq -r 'if type == "array" then .[0].id else .[0].id end')
  if [ "$PROVIDER_ID" == "null" ] || [ -z "$PROVIDER_ID" ]; then
    echo -e "⚠️  No doctors found, using admin user ID from login..."
    PROVIDER_ID=$(echo "$LOGIN_RESPONSE" | jq -r '.user.id')
  fi
fi

if [ "$PROVIDER_ID" == "null" ] || [ -z "$PROVIDER_ID" ]; then
  echo -e "❌ Could not find provider ID"
  exit 1
else
  echo -e "✅ Found provider: $PROVIDER_ID"
fi

echo -e "\n🧪 Step 4: Testing FHIR DiagnosticReport Endpoints"
echo "===================================================="

# Test 1: GET /fhir/DiagnosticReport (Search all)
echo -n "Testing: GET /fhir/DiagnosticReport (Search all) ... "
RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" -X GET "$BASE_URL/fhir/DiagnosticReport" \
  -H "X-Tenant-ID: $TENANT_ID" \
  -H "Authorization: Bearer $ACCESS_TOKEN")
if [ "$RESPONSE" == "200" ]; then
  echo -e "\033[0;32m✅ PASSED\033[0m (HTTP 200)"
else
  echo -e "\033[0;31m❌ FAILED\033[0m (HTTP $RESPONSE, expected 200)"
  curl -s -X GET "$BASE_URL/fhir/DiagnosticReport" -H "X-Tenant-ID: $TENANT_ID" -H "Authorization: Bearer $ACCESS_TOKEN"
fi

# Test 2: GET /fhir/DiagnosticReport?patient=Patient/:id
echo -n "Testing: GET /fhir/DiagnosticReport?patient=Patient/$PATIENT_ID ... "
RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" -X GET "$BASE_URL/fhir/DiagnosticReport?patient=Patient/$PATIENT_ID" \
  -H "X-Tenant-ID: $TENANT_ID" \
  -H "Authorization: Bearer $ACCESS_TOKEN")
if [ "$RESPONSE" == "200" ]; then
  echo -e "\033[0;32m✅ PASSED\033[0m (HTTP 200)"
else
  echo -e "\033[0;31m❌ FAILED\033[0m (HTTP $RESPONSE, expected 200)"
  curl -s -X GET "$BASE_URL/fhir/DiagnosticReport?patient=Patient/$PATIENT_ID" -H "X-Tenant-ID: $TENANT_ID" -H "Authorization: Bearer $ACCESS_TOKEN"
fi

# Test 3: GET /fhir/DiagnosticReport?status=final
echo -n "Testing: GET /fhir/DiagnosticReport?status=final ... "
RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" -X GET "$BASE_URL/fhir/DiagnosticReport?status=final" \
  -H "X-Tenant-ID: $TENANT_ID" \
  -H "Authorization: Bearer $ACCESS_TOKEN")
if [ "$RESPONSE" == "200" ]; then
  echo -e "\033[0;32m✅ PASSED\033[0m (HTTP 200)"
else
  echo -e "\033[0;31m❌ FAILED\033[0m (HTTP $RESPONSE, expected 200)"
  curl -s -X GET "$BASE_URL/fhir/DiagnosticReport?status=final" -H "X-Tenant-ID: $TENANT_ID" -H "Authorization: Bearer $ACCESS_TOKEN"
fi

# Test 4: POST /fhir/DiagnosticReport (Create)
echo -n "Testing: POST /fhir/DiagnosticReport (Create) ... "
CREATE_PAYLOAD='{
  "resourceType": "DiagnosticReport",
  "status": "final",
  "category": [
    {
      "coding": [
        {
          "system": "http://terminology.hl7.org/CodeSystem/v2-0074",
          "code": "CH",
          "display": "Chemistry"
        }
      ],
      "text": "Chemistry"
    }
  ],
  "code": {
    "coding": [
      {
        "system": "http://loinc.org",
        "code": "24356-8",
        "display": "Comprehensive Metabolic Panel"
      }
    ],
    "text": "Comprehensive Metabolic Panel"
  },
  "subject": {
    "reference": "Patient/'"$PATIENT_ID"'"
  },
  "effectiveDateTime": "2025-12-06T10:00:00Z",
  "issued": "2025-12-06T11:00:00Z",
  "performer": [
    {
      "reference": "Practitioner/'"$PROVIDER_ID"'"
    }
  ],
  "conclusion": "All values within normal limits",
  "conclusionCode": [
    {
      "text": "Normal"
    }
  ],
  "note": [
    {
      "text": "Routine screening test"
    }
  ]
}'
CREATE_RESPONSE=$(curl -s -X POST "$BASE_URL/fhir/DiagnosticReport" \
  -H "X-Tenant-ID: $TENANT_ID" \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d "$CREATE_PAYLOAD")
CREATE_STATUS=$(echo "$CREATE_RESPONSE" | jq -r '.statusCode')
if [ "$CREATE_STATUS" == "null" ] || [ "$CREATE_STATUS" == "201" ]; then
  DIAG_REPORT_ID=$(echo "$CREATE_RESPONSE" | jq -r '.id')
  echo -e "\033[0;32m✅ PASSED\033[0m (HTTP 201)"
  echo "  Created DiagnosticReport ID: $DIAG_REPORT_ID"
else
  echo -e "\033[0;31m❌ FAILED\033[0m (HTTP $CREATE_STATUS, expected 201)"
  echo "Response: $CREATE_RESPONSE"
fi

# Test 5: GET /fhir/DiagnosticReport/:id (Get by ID)
if [ -n "$DIAG_REPORT_ID" ]; then
  echo -n "Testing: GET /fhir/DiagnosticReport/$DIAG_REPORT_ID (Get by ID) ... "
  RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" -X GET "$BASE_URL/fhir/DiagnosticReport/$DIAG_REPORT_ID" \
    -H "X-Tenant-ID: $TENANT_ID" \
    -H "Authorization: Bearer $ACCESS_TOKEN")
  if [ "$RESPONSE" == "200" ]; then
    echo -e "\033[0;32m✅ PASSED\033[0m (HTTP 200)"
  else
    echo -e "\033[0;31m❌ FAILED\033[0m (HTTP $RESPONSE, expected 200)"
    curl -s -X GET "$BASE_URL/fhir/DiagnosticReport/$DIAG_REPORT_ID" -H "X-Tenant-ID: $TENANT_ID" -H "Authorization: Bearer $ACCESS_TOKEN"
  fi
else
  echo "Skipping GET by ID test as DiagnosticReport ID was not obtained from creation."
fi

# Test 6: PUT /fhir/DiagnosticReport/:id (Update)
if [ -n "$DIAG_REPORT_ID" ]; then
  echo -n "Testing: PUT /fhir/DiagnosticReport/$DIAG_REPORT_ID (Update) ... "
  UPDATE_PAYLOAD='{
    "resourceType": "DiagnosticReport",
    "id": "'"$DIAG_REPORT_ID"'",
    "status": "final",
    "category": [
      {
        "coding": [
          {
            "system": "http://terminology.hl7.org/CodeSystem/v2-0074",
            "code": "CH",
            "display": "Chemistry"
          }
        ],
        "text": "Chemistry"
      }
    ],
    "code": {
      "coding": [
        {
          "system": "http://loinc.org",
          "code": "24356-8",
          "display": "Comprehensive Metabolic Panel"
        }
      ],
      "text": "Comprehensive Metabolic Panel"
    },
    "subject": {
      "reference": "Patient/'"$PATIENT_ID"'"
    },
    "effectiveDateTime": "2025-12-06T10:00:00Z",
    "issued": "2025-12-06T11:30:00Z",
    "performer": [
      {
        "reference": "Practitioner/'"$PROVIDER_ID"'"
      }
    ],
    "conclusion": "All values within normal limits. Updated interpretation.",
    "conclusionCode": [
      {
        "text": "Normal - Updated"
      }
    ],
    "note": [
      {
        "text": "Routine screening test - reviewed and updated"
      }
    ]
  }'
  UPDATE_RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" -X PUT "$BASE_URL/fhir/DiagnosticReport/$DIAG_REPORT_ID" \
    -H "X-Tenant-ID: $TENANT_ID" \
    -H "Authorization: Bearer $ACCESS_TOKEN" \
    -H "Content-Type: application/json" \
    -d "$UPDATE_PAYLOAD")
  if [ "$UPDATE_RESPONSE" == "200" ]; then
    echo -e "\033[0;32m✅ PASSED\033[0m (HTTP 200)"
  else
    echo -e "\033[0;31m❌ FAILED\033[0m (HTTP $UPDATE_RESPONSE, expected 200)"
    curl -s -X PUT "$BASE_URL/fhir/DiagnosticReport/$DIAG_REPORT_ID" -H "X-Tenant-ID: $TENANT_ID" -H "Authorization: Bearer $ACCESS_TOKEN" -H "Content-Type: application/json" -d "$UPDATE_PAYLOAD"
  fi
else
  echo "Skipping PUT test as DiagnosticReport ID was not obtained from creation."
fi

echo -e "\n✅ All DiagnosticReport endpoint tests completed!"

