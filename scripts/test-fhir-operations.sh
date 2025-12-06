#!/bin/bash

# Test FHIR Operations (Batch, Transaction, History, Validate, Patient everything)
TENANT_ID=${1:-bulawayo-general}
BASE_URL="http://localhost:3013/api/fhir"
TOKEN=""

echo "🧪 Testing FHIR Operations"
echo "=========================="

# Login
echo ""
echo "1️⃣ Logging in..."
LOGIN_RESPONSE=$(curl -s -X POST "http://localhost:3013/api/auth/login" \
  -H "Content-Type: application/json" \
  -H "x-tenant-id: $TENANT_ID" \
  -d '{"email": "doctor@bulawayo-general.co.zw", "password": "Password1#"}')

TOKEN=$(echo $LOGIN_RESPONSE | jq -r '.accessToken // .token')

if [ "$TOKEN" == "null" ] || [ -z "$TOKEN" ]; then
  echo "❌ Login failed"
  echo $LOGIN_RESPONSE | jq .
  exit 1
fi

echo "✅ Login successful"

# Get a patient ID first
echo ""
echo "2️⃣ Getting a patient ID..."
PATIENT_RESPONSE=$(curl -s -X GET "$BASE_URL/Patient" \
  -H "Authorization: Bearer $TOKEN" \
  -H "x-tenant-id: $TENANT_ID" \
  -H "Content-Type: application/json")

PATIENT_ID=$(echo $PATIENT_RESPONSE | jq -r '.entry[0].resource.id // empty')

if [ -z "$PATIENT_ID" ]; then
  echo "❌ No patient found"
  exit 1
fi

echo "✅ Found patient: $PATIENT_ID"

# Test Patient everything
echo ""
echo "3️⃣ Testing GET /api/fhir/Patient/$PATIENT_ID/everything..."
EVERYTHING_RESPONSE=$(curl -s -w "\n%{http_code}" -X GET "$BASE_URL/Patient/$PATIENT_ID/everything" \
  -H "Authorization: Bearer $TOKEN" \
  -H "x-tenant-id: $TENANT_ID" \
  -H "Content-Type: application/json")

HTTP_CODE=$(echo "$EVERYTHING_RESPONSE" | tail -n1)
EVERYTHING_BODY=$(echo "$EVERYTHING_RESPONSE" | sed '$d')

if [ "$HTTP_CODE" == "200" ]; then
  TOTAL=$(echo $EVERYTHING_BODY | jq -r '.total // 0')
  echo "✅ Patient everything successful - Found $TOTAL resources"
else
  echo "❌ Patient everything failed - HTTP $HTTP_CODE"
  echo $EVERYTHING_BODY | jq .
  exit 1
fi

# Test $validate
echo ""
echo "4️⃣ Testing POST /api/fhir/\$validate..."
VALIDATE_PAYLOAD=$(cat <<EOF
{
  "resourceType": "Patient",
  "id": "test-patient",
  "name": [{
    "use": "official",
    "family": "Test",
    "given": ["Patient"]
  }],
  "gender": "male",
  "birthDate": "1990-01-01"
}
EOF
)

VALIDATE_RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "$BASE_URL/\$validate" \
  -H "Authorization: Bearer $TOKEN" \
  -H "x-tenant-id: $TENANT_ID" \
  -H "Content-Type: application/json" \
  -d "$VALIDATE_PAYLOAD")

HTTP_CODE=$(echo "$VALIDATE_RESPONSE" | tail -n1)
VALIDATE_BODY=$(echo "$VALIDATE_RESPONSE" | sed '$d')

if [ "$HTTP_CODE" == "200" ]; then
  SEVERITY=$(echo $VALIDATE_BODY | jq -r '.issue[0].severity // "N/A"')
  echo "✅ \$validate successful - Severity: $SEVERITY"
else
  echo "❌ \$validate failed - HTTP $HTTP_CODE"
  echo $VALIDATE_BODY | jq .
  exit 1
fi

# Test $batch
echo ""
echo "5️⃣ Testing POST /api/fhir/\$batch..."
BATCH_PAYLOAD=$(cat <<EOF
{
  "resourceType": "Bundle",
  "type": "batch",
  "entry": [
    {
      "request": {
        "method": "GET",
        "url": "Patient/$PATIENT_ID"
      }
    },
    {
      "request": {
        "method": "GET",
        "url": "Observation?patient=$PATIENT_ID&_count=5"
      }
    }
  ]
}
EOF
)

BATCH_RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "$BASE_URL/\$batch" \
  -H "Authorization: Bearer $TOKEN" \
  -H "x-tenant-id: $TENANT_ID" \
  -H "Content-Type: application/json" \
  -d "$BATCH_PAYLOAD")

HTTP_CODE=$(echo "$BATCH_RESPONSE" | tail -n1)
BATCH_BODY=$(echo "$BATCH_RESPONSE" | sed '$d')

if [ "$HTTP_CODE" == "200" ]; then
  ENTRY_COUNT=$(echo $BATCH_BODY | jq '.entry | length')
  echo "✅ \$batch successful - Processed $ENTRY_COUNT entries"
else
  echo "❌ \$batch failed - HTTP $HTTP_CODE"
  echo $BATCH_BODY | jq .
  exit 1
fi

# Test $transaction
echo ""
echo "6️⃣ Testing POST /api/fhir/\$transaction..."
# Create a simple observation in transaction
TRANSACTION_PAYLOAD=$(cat <<EOF
{
  "resourceType": "Bundle",
  "type": "transaction",
  "entry": [
    {
      "request": {
        "method": "GET",
        "url": "Patient/$PATIENT_ID"
      }
    }
  ]
}
EOF
)

TRANSACTION_RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "$BASE_URL/\$transaction" \
  -H "Authorization: Bearer $TOKEN" \
  -H "x-tenant-id: $TENANT_ID" \
  -H "Content-Type: application/json" \
  -d "$TRANSACTION_PAYLOAD")

HTTP_CODE=$(echo "$TRANSACTION_RESPONSE" | tail -n1)
TRANSACTION_BODY=$(echo "$TRANSACTION_RESPONSE" | sed '$d')

if [ "$HTTP_CODE" == "200" ]; then
  ENTRY_COUNT=$(echo $TRANSACTION_BODY | jq '.entry | length')
  echo "✅ \$transaction successful - Processed $ENTRY_COUNT entries"
else
  echo "❌ \$transaction failed - HTTP $HTTP_CODE"
  echo $TRANSACTION_BODY | jq .
  exit 1
fi

# Test $history
echo ""
echo "7️⃣ Testing GET /api/fhir/Patient/$PATIENT_ID/_history..."
HISTORY_RESPONSE=$(curl -s -w "\n%{http_code}" -X GET "$BASE_URL/Patient/$PATIENT_ID/_history" \
  -H "Authorization: Bearer $TOKEN" \
  -H "x-tenant-id: $TENANT_ID" \
  -H "Content-Type: application/json")

HTTP_CODE=$(echo "$HISTORY_RESPONSE" | tail -n1)
HISTORY_BODY=$(echo "$HISTORY_RESPONSE" | sed '$d')

if [ "$HTTP_CODE" == "200" ]; then
  TOTAL=$(echo $HISTORY_BODY | jq -r '.total // 0')
  echo "✅ \$history successful - Found $TOTAL history entries"
else
  echo "❌ \$history failed - HTTP $HTTP_CODE"
  echo $HISTORY_BODY | jq .
  exit 1
fi

echo ""
echo "📊 Test Summary"
echo "=============="
echo "✅ Patient everything - PASSED"
echo "✅ \$validate - PASSED"
echo "✅ \$batch - PASSED"
echo "✅ \$transaction - PASSED"
echo "✅ \$history - PASSED"
echo ""
echo "🎉 FHIR Operations tests complete!"

