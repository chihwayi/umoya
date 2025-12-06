#!/bin/bash

# Test script for FHIR MedicationRequest endpoints
# Usage: bash scripts/test-fhir-medication-request.sh

set -e

BASE_URL="http://localhost:3013/api"
TENANT_ID="bulawayo-general"

echo "🧪 Testing FHIR MedicationRequest Endpoints"
echo "============================================"
echo ""

# Step 1: Login
echo "🔐 Step 1: Logging in..."
LOGIN_RESPONSE=$(curl -s -X POST "$BASE_URL/auth/login" \
  -H "Content-Type: application/json" \
  -H "X-Tenant-ID: $TENANT_ID" \
  -d '{
    "email": "doctor@bulawayo-general.co.zw",
    "password": "Password1#"
  }')

TOKEN=$(echo $LOGIN_RESPONSE | grep -o '"token":"[^"]*' | cut -d'"' -f4)

if [ -z "$TOKEN" ]; then
  echo "❌ Login failed"
  exit 1
fi

echo "✅ Login successful"
echo ""

# Step 2: Get a patient ID
echo "📋 Step 2: Fetching test patient ID..."
PATIENT_RESPONSE=$(curl -s -X GET "$BASE_URL/patients?limit=1" \
  -H "Content-Type: application/json" \
  -H "X-Tenant-ID: $TENANT_ID" \
  -H "Authorization: Bearer $TOKEN")

PATIENT_ID=$(echo $PATIENT_RESPONSE | grep -o '"id":"[^"]*' | head -1 | cut -d'"' -f4)

if [ -z "$PATIENT_ID" ]; then
  echo "❌ No patient found"
  exit 1
fi

echo "✅ Found patient: $PATIENT_ID"
echo ""

# Step 3: Get a prescriber ID (doctor)
echo "📋 Step 3: Fetching prescriber ID..."
PRESCRIBER_RESPONSE=$(curl -s -X GET "$BASE_URL/users?role=doctor&limit=1" \
  -H "Content-Type: application/json" \
  -H "X-Tenant-ID: $TENANT_ID" \
  -H "Authorization: Bearer $TOKEN")

PRESCRIBER_ID=$(echo $PRESCRIBER_RESPONSE | grep -o '"id":"[^"]*' | head -1 | cut -d'"' -f4)

if [ -z "$PRESCRIBER_ID" ]; then
  echo "❌ No prescriber found"
  exit 1
fi

echo "✅ Found prescriber: $PRESCRIBER_ID"
echo ""

# Step 4: Test endpoints
echo "🧪 Step 4: Testing FHIR MedicationRequest Endpoints"
echo "===================================================="
echo ""

# Test 1: Search all medication requests
echo -n "Testing: GET /fhir/MedicationRequest (Search all) ... "
RESPONSE=$(curl -s -w "\n%{http_code}" -X GET "$BASE_URL/fhir/MedicationRequest" \
  -H "Content-Type: application/json" \
  -H "X-Tenant-ID: $TENANT_ID" \
  -H "Authorization: Bearer $TOKEN")

HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
BODY=$(echo "$RESPONSE" | sed '$d')

if [ "$HTTP_CODE" -eq 200 ]; then
  echo "✅ PASSED (HTTP $HTTP_CODE)"
else
  echo "❌ FAILED (HTTP $HTTP_CODE, expected 200)"
  echo "Response: $BODY"
fi
echo ""

# Test 2: Search by patient
echo -n "Testing: GET /fhir/MedicationRequest?patient=Patient/$PATIENT_ID ... "
RESPONSE=$(curl -s -w "\n%{http_code}" -X GET "$BASE_URL/fhir/MedicationRequest?patient=Patient/$PATIENT_ID" \
  -H "Content-Type: application/json" \
  -H "X-Tenant-ID: $TENANT_ID" \
  -H "Authorization: Bearer $TOKEN")

HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
BODY=$(echo "$RESPONSE" | sed '$d')

if [ "$HTTP_CODE" -eq 200 ]; then
  echo "✅ PASSED (HTTP $HTTP_CODE)"
else
  echo "❌ FAILED (HTTP $HTTP_CODE, expected 200)"
  echo "Response: $BODY"
fi
echo ""

# Test 3: Search by status
echo -n "Testing: GET /fhir/MedicationRequest?status=active ... "
RESPONSE=$(curl -s -w "\n%{http_code}" -X GET "$BASE_URL/fhir/MedicationRequest?status=active" \
  -H "Content-Type: application/json" \
  -H "X-Tenant-ID: $TENANT_ID" \
  -H "Authorization: Bearer $TOKEN")

HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
BODY=$(echo "$RESPONSE" | sed '$d')

if [ "$HTTP_CODE" -eq 200 ]; then
  echo "✅ PASSED (HTTP $HTTP_CODE)"
else
  echo "❌ FAILED (HTTP $HTTP_CODE, expected 200)"
  echo "Response: $BODY"
fi
echo ""

# Test 4: Create medication request
echo -n "Testing: POST /fhir/MedicationRequest (Create) ... "
CREATE_PAYLOAD=$(cat <<EOF
{
  "resourceType": "MedicationRequest",
  "status": "active",
  "intent": "order",
  "priority": "routine",
  "medicationCodeableConcept": {
    "coding": [{
      "system": "http://www.nlm.nih.gov/research/umls/rxnorm",
      "code": "860975",
      "display": "Paracetamol 500 MG Oral Tablet"
    }],
    "text": "Paracetamol 500mg tablet"
  },
  "subject": {
    "reference": "Patient/$PATIENT_ID"
  },
  "requester": {
    "reference": "Practitioner/$PRESCRIBER_ID"
  },
  "authoredOn": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "dosageInstruction": [{
    "text": "Take 1 tablet twice daily with food",
    "timing": {
      "repeat": {
        "frequency": 2,
        "period": 1,
        "periodUnit": "d"
      }
    },
    "route": {
      "coding": [{
        "system": "http://snomed.info/sct",
        "code": "26643006",
        "display": "oral"
      }],
      "text": "oral"
    },
    "doseAndRate": [{
      "doseQuantity": {
        "value": 1,
        "unit": "tablet",
        "system": "http://unitsofmeasure.org"
      }
    }]
  }],
  "dispenseRequest": {
    "quantity": {
      "value": 20,
      "unit": "tablet"
    },
    "numberOfRepeatsAllowed": 1,
    "expectedSupplyDuration": {
      "value": 10,
      "unit": "days",
      "system": "http://unitsofmeasure.org",
      "code": "d"
    }
  },
  "reasonCode": [{
    "text": "Pain management"
  }]
}
EOF
)

RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "$BASE_URL/fhir/MedicationRequest" \
  -H "Content-Type: application/json" \
  -H "X-Tenant-ID: $TENANT_ID" \
  -H "Authorization: Bearer $TOKEN" \
  -d "$CREATE_PAYLOAD")

HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
BODY=$(echo "$RESPONSE" | sed '$d')

if [ "$HTTP_CODE" -eq 201 ]; then
  echo "✅ PASSED (HTTP $HTTP_CODE)"
  MEDICATION_REQUEST_ID=$(echo "$BODY" | grep -o '"id":"[^"]*' | head -1 | cut -d'"' -f4)
  echo "  Created MedicationRequest ID: $MEDICATION_REQUEST_ID"
else
  echo "❌ FAILED (HTTP $HTTP_CODE, expected 201)"
  echo "Response: $BODY"
  exit 1
fi
echo ""

# Test 5: Get by ID
if [ ! -z "$MEDICATION_REQUEST_ID" ]; then
  echo -n "Testing: GET /fhir/MedicationRequest/$MEDICATION_REQUEST_ID (Get by ID) ... "
  RESPONSE=$(curl -s -w "\n%{http_code}" -X GET "$BASE_URL/fhir/MedicationRequest/$MEDICATION_REQUEST_ID" \
    -H "Content-Type: application/json" \
    -H "X-Tenant-ID: $TENANT_ID" \
    -H "Authorization: Bearer $TOKEN")

  HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
  BODY=$(echo "$RESPONSE" | sed '$d')

  if [ "$HTTP_CODE" -eq 200 ]; then
    echo "✅ PASSED (HTTP $HTTP_CODE)"
  else
    echo "❌ FAILED (HTTP $HTTP_CODE, expected 200)"
    echo "Response: $BODY"
  fi
  echo ""

  # Test 6: Update medication request
  echo -n "Testing: PUT /fhir/MedicationRequest/$MEDICATION_REQUEST_ID (Update) ... "
  UPDATE_PAYLOAD=$(cat <<EOF
{
  "resourceType": "MedicationRequest",
  "id": "$MEDICATION_REQUEST_ID",
  "status": "active",
  "intent": "order",
  "priority": "routine",
  "medicationCodeableConcept": {
    "coding": [{
      "system": "http://www.nlm.nih.gov/research/umls/rxnorm",
      "code": "860975",
      "display": "Paracetamol 500 MG Oral Tablet"
    }],
    "text": "Paracetamol 500mg tablet"
  },
  "subject": {
    "reference": "Patient/$PATIENT_ID"
  },
  "requester": {
    "reference": "Practitioner/$PRESCRIBER_ID"
  },
  "authoredOn": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "dosageInstruction": [{
    "text": "Take 2 tablets twice daily with food",
    "timing": {
      "repeat": {
        "frequency": 2,
        "period": 1,
        "periodUnit": "d"
      }
    },
    "route": {
      "coding": [{
        "system": "http://snomed.info/sct",
        "code": "26643006",
        "display": "oral"
      }],
      "text": "oral"
    },
    "doseAndRate": [{
      "doseQuantity": {
        "value": 2,
        "unit": "tablet",
        "system": "http://unitsofmeasure.org"
      }
    }]
  }],
  "dispenseRequest": {
    "quantity": {
      "value": 40,
      "unit": "tablet"
    },
    "numberOfRepeatsAllowed": 1
  }
}
EOF
)

  RESPONSE=$(curl -s -w "\n%{http_code}" -X PUT "$BASE_URL/fhir/MedicationRequest/$MEDICATION_REQUEST_ID" \
    -H "Content-Type: application/json" \
    -H "X-Tenant-ID: $TENANT_ID" \
    -H "Authorization: Bearer $TOKEN" \
    -d "$UPDATE_PAYLOAD")

  HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
  BODY=$(echo "$RESPONSE" | sed '$d')

  if [ "$HTTP_CODE" -eq 200 ]; then
    echo "✅ PASSED (HTTP $HTTP_CODE)"
  else
    echo "❌ FAILED (HTTP $HTTP_CODE, expected 200)"
    echo "Response: $BODY"
  fi
  echo ""

  # Test 7: Delete (cancel) medication request
  echo -n "Testing: DELETE /fhir/MedicationRequest/$MEDICATION_REQUEST_ID (Cancel) ... "
  RESPONSE=$(curl -s -w "\n%{http_code}" -X DELETE "$BASE_URL/fhir/MedicationRequest/$MEDICATION_REQUEST_ID" \
    -H "Content-Type: application/json" \
    -H "X-Tenant-ID: $TENANT_ID" \
    -H "Authorization: Bearer $TOKEN")

  HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
  BODY=$(echo "$RESPONSE" | sed '$d')

  if [ "$HTTP_CODE" -eq 200 ]; then
    echo "✅ PASSED (HTTP $HTTP_CODE)"
    STATUS=$(echo "$BODY" | grep -o '"status":"[^"]*' | head -1 | cut -d'"' -f4)
    echo "  Status changed to: $STATUS"
  else
    echo "❌ FAILED (HTTP $HTTP_CODE, expected 200)"
    echo "Response: $BODY"
  fi
  echo ""
fi

echo "✅ All MedicationRequest endpoint tests completed!"
echo ""

