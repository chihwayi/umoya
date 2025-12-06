#!/bin/bash

# Configuration
BASE_URL="http://localhost:3013/api"
TENANT_ID="bulawayo-general"
ADMIN_EMAIL="admin@bulawayo-general.co.zw"
ADMIN_PASSWORD="Password1#"

echo "🧪 Testing FHIR Condition Endpoints"
echo "===================================="

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

echo -e "\n🧪 Step 3: Testing FHIR Condition Endpoints"
echo "=============================================="

# Test 1: GET /fhir/Condition (Search all)
echo -n "Testing: GET /fhir/Condition (Search all) ... "
RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" -X GET "$BASE_URL/fhir/Condition" \
  -H "X-Tenant-ID: $TENANT_ID" \
  -H "Authorization: Bearer $ACCESS_TOKEN")
if [ "$RESPONSE" == "200" ]; then
  echo -e "\033[0;32m✅ PASSED\033[0m (HTTP 200)"
else
  echo -e "\033[0;31m❌ FAILED\033[0m (HTTP $RESPONSE, expected 200)"
  curl -s -X GET "$BASE_URL/fhir/Condition" -H "X-Tenant-ID: $TENANT_ID" -H "Authorization: Bearer $ACCESS_TOKEN"
fi

# Test 2: GET /fhir/Condition?patient=Patient/:id
echo -n "Testing: GET /fhir/Condition?patient=Patient/$PATIENT_ID ... "
RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" -X GET "$BASE_URL/fhir/Condition?patient=Patient/$PATIENT_ID" \
  -H "X-Tenant-ID: $TENANT_ID" \
  -H "Authorization: Bearer $ACCESS_TOKEN")
if [ "$RESPONSE" == "200" ]; then
  echo -e "\033[0;32m✅ PASSED\033[0m (HTTP 200)"
else
  echo -e "\033[0;31m❌ FAILED\033[0m (HTTP $RESPONSE, expected 200)"
  curl -s -X GET "$BASE_URL/fhir/Condition?patient=Patient/$PATIENT_ID" -H "X-Tenant-ID: $TENANT_ID" -H "Authorization: Bearer $ACCESS_TOKEN"
fi

# Test 3: GET /fhir/Condition?clinical-status=active
echo -n "Testing: GET /fhir/Condition?clinical-status=active ... "
RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" -X GET "$BASE_URL/fhir/Condition?clinical-status=active" \
  -H "X-Tenant-ID: $TENANT_ID" \
  -H "Authorization: Bearer $ACCESS_TOKEN")
if [ "$RESPONSE" == "200" ]; then
  echo -e "\033[0;32m✅ PASSED\033[0m (HTTP 200)"
else
  echo -e "\033[0;31m❌ FAILED\033[0m (HTTP $RESPONSE, expected 200)"
  curl -s -X GET "$BASE_URL/fhir/Condition?clinical-status=active" -H "X-Tenant-ID: $TENANT_ID" -H "Authorization: Bearer $ACCESS_TOKEN"
fi

# Test 4: POST /fhir/Condition (Create)
echo -n "Testing: POST /fhir/Condition (Create) ... "
CREATE_PAYLOAD='{
  "resourceType": "Condition",
  "clinicalStatus": {
    "coding": [
      {
        "system": "http://terminology.hl7.org/CodeSystem/condition-clinical",
        "code": "active",
        "display": "Active"
      }
    ]
  },
  "verificationStatus": {
    "coding": [
      {
        "system": "http://terminology.hl7.org/CodeSystem/condition-ver-status",
        "code": "confirmed",
        "display": "Confirmed"
      }
    ]
  },
  "category": [
    {
      "coding": [
        {
          "system": "http://terminology.hl7.org/CodeSystem/condition-category",
          "code": "problem-list-item",
          "display": "Problem List Item"
        }
      ],
      "text": "Problem List Item"
    }
  ],
  "code": {
    "coding": [
      {
        "system": "http://snomed.info/sct",
        "code": "44054006",
        "display": "Diabetes mellitus type 2"
      }
    ],
    "text": "Diabetes mellitus type 2"
  },
  "subject": {
    "reference": "Patient/'"$PATIENT_ID"'"
  },
  "onsetDateTime": "2024-01-15T00:00:00Z",
  "severity": {
    "coding": [
      {
        "system": "http://snomed.info/sct",
        "code": "6736007",
        "display": "Moderate"
      }
    ],
    "text": "Moderate"
  },
  "note": [
    {
      "text": "Patient diagnosed with Type 2 Diabetes. Currently managed with diet and medication."
    }
  ]
}'
CREATE_RESPONSE=$(curl -s -X POST "$BASE_URL/fhir/Condition" \
  -H "X-Tenant-ID: $TENANT_ID" \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d "$CREATE_PAYLOAD")
CREATE_STATUS=$(echo "$CREATE_RESPONSE" | jq -r '.statusCode')
if [ "$CREATE_STATUS" == "null" ] || [ "$CREATE_STATUS" == "201" ]; then
  CONDITION_ID=$(echo "$CREATE_RESPONSE" | jq -r '.id')
  echo -e "\033[0;32m✅ PASSED\033[0m (HTTP 201)"
  echo "  Created Condition ID: $CONDITION_ID"
else
  echo -e "\033[0;31m❌ FAILED\033[0m (HTTP $CREATE_STATUS, expected 201)"
  echo "Response: $CREATE_RESPONSE"
fi

# Test 5: GET /fhir/Condition/:id (Get by ID)
if [ -n "$CONDITION_ID" ]; then
  echo -n "Testing: GET /fhir/Condition/$CONDITION_ID (Get by ID) ... "
  RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" -X GET "$BASE_URL/fhir/Condition/$CONDITION_ID" \
    -H "X-Tenant-ID: $TENANT_ID" \
    -H "Authorization: Bearer $ACCESS_TOKEN")
  if [ "$RESPONSE" == "200" ]; then
    echo -e "\033[0;32m✅ PASSED\033[0m (HTTP 200)"
  else
    echo -e "\033[0;31m❌ FAILED\033[0m (HTTP $RESPONSE, expected 200)"
    curl -s -X GET "$BASE_URL/fhir/Condition/$CONDITION_ID" -H "X-Tenant-ID: $TENANT_ID" -H "Authorization: Bearer $ACCESS_TOKEN"
  fi
else
  echo "Skipping GET by ID test as Condition ID was not obtained from creation."
fi

# Test 6: PUT /fhir/Condition/:id (Update)
if [ -n "$CONDITION_ID" ]; then
  echo -n "Testing: PUT /fhir/Condition/$CONDITION_ID (Update) ... "
  UPDATE_PAYLOAD='{
    "resourceType": "Condition",
    "id": "'"$CONDITION_ID"'",
    "clinicalStatus": {
      "coding": [
        {
          "system": "http://terminology.hl7.org/CodeSystem/condition-clinical",
          "code": "resolved",
          "display": "Resolved"
        }
      ]
    },
    "verificationStatus": {
      "coding": [
        {
          "system": "http://terminology.hl7.org/CodeSystem/condition-ver-status",
          "code": "confirmed",
          "display": "Confirmed"
        }
      ]
    },
    "category": [
      {
        "coding": [
          {
            "system": "http://terminology.hl7.org/CodeSystem/condition-category",
            "code": "problem-list-item",
            "display": "Problem List Item"
          }
        ],
        "text": "Problem List Item"
      }
    ],
    "code": {
      "coding": [
        {
          "system": "http://snomed.info/sct",
          "code": "44054006",
          "display": "Diabetes mellitus type 2"
        }
      ],
      "text": "Diabetes mellitus type 2"
    },
    "subject": {
      "reference": "Patient/'"$PATIENT_ID"'"
    },
    "onsetDateTime": "2024-01-15T00:00:00Z",
    "abatementDateTime": "2025-12-06T00:00:00Z",
    "severity": {
      "coding": [
        {
          "system": "http://snomed.info/sct",
          "code": "6736007",
          "display": "Moderate"
        }
      ],
      "text": "Moderate"
    },
    "note": [
      {
        "text": "Patient diagnosed with Type 2 Diabetes. Condition resolved after treatment."
      }
    ]
  }'
  UPDATE_RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" -X PUT "$BASE_URL/fhir/Condition/$CONDITION_ID" \
    -H "X-Tenant-ID: $TENANT_ID" \
    -H "Authorization: Bearer $ACCESS_TOKEN" \
    -H "Content-Type: application/json" \
    -d "$UPDATE_PAYLOAD")
  if [ "$UPDATE_RESPONSE" == "200" ]; then
    echo -e "\033[0;32m✅ PASSED\033[0m (HTTP 200)"
  else
    echo -e "\033[0;31m❌ FAILED\033[0m (HTTP $UPDATE_RESPONSE, expected 200)"
    curl -s -X PUT "$BASE_URL/fhir/Condition/$CONDITION_ID" -H "X-Tenant-ID: $TENANT_ID" -H "Authorization: Bearer $ACCESS_TOKEN" -H "Content-Type: application/json" -d "$UPDATE_PAYLOAD"
  fi
else
  echo "Skipping PUT test as Condition ID was not obtained from creation."
fi

echo -e "\n✅ All Condition endpoint tests completed!"

