#!/bin/bash

# Comprehensive Pharmacy Module Test Script
# This script tests all aspects of the pharmacy management system

set -e

echo "🧪 Pharmacy Module Comprehensive Test Suite"
echo "=========================================="
echo ""

# Configuration
EHR_API_URL="${EHR_API_URL:-http://localhost:3013/api}"
TENANT_SLUG="${TENANT_SLUG:-bulawayo-general}"
TEST_USER_EMAIL="${TEST_USER_EMAIL:-admin@bulawayo-general.co.zw}"
TEST_USER_PASSWORD="${TEST_USER_PASSWORD:-Password1#}"

echo "📍 Configuration:"
echo "   API URL: $EHR_API_URL"
echo "   Tenant: $TENANT_SLUG"
echo "   Test User: $TEST_USER_EMAIL"
echo ""

# Step 1: Get authentication token
echo "🔐 Step 1: Authenticating..."
LOGIN_RESPONSE=$(curl -s -X POST "$EHR_API_URL/auth/login" \
  -H "Content-Type: application/json" \
  -H "X-Tenant-ID: $TENANT_SLUG" \
  -d "{\"email\":\"$TEST_USER_EMAIL\",\"password\":\"$TEST_USER_PASSWORD\"}")

TOKEN=$(echo $LOGIN_RESPONSE | jq -r '.accessToken // .token // .access_token // empty')

if [ -z "$TOKEN" ] || [ "$TOKEN" = "null" ]; then
  echo "❌ Failed to get authentication token"
  echo "   Response: $LOGIN_RESPONSE"
  exit 1
fi

echo "✅ Authentication successful"
echo ""

# Export token for TypeScript script
export TEST_TOKEN="$TOKEN"
export EHR_API_URL="$EHR_API_URL"
export TENANT_SLUG="$TENANT_SLUG"

# Step 2: Run TypeScript test script
echo "🧪 Step 2: Running comprehensive tests..."
echo ""

if command -v ts-node &> /dev/null; then
  ts-node scripts/test-pharmacy-module.ts
elif command -v npx &> /dev/null; then
  npx ts-node scripts/test-pharmacy-module.ts
else
  echo "❌ ts-node not found. Please install it: npm install -g ts-node"
  exit 1
fi

echo ""
echo "✅ Test suite completed!"

