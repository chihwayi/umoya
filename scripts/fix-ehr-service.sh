#!/bin/bash

# Load environment variables
source "$(dirname "$0")/load-env.sh"

echo "=================================="
echo "🔧 EHR Service Complete Fix Script"
echo "=================================="
echo ""

cd /Users/devoop/Dev/personal/medicore

echo "Step 1: Stop and remove old container..."
docker stop medicore-ehr-service 2>/dev/null || true
docker rm medicore-ehr-service 2>/dev/null || true

echo "Step 2: Remove old image..."
docker rmi $(docker images | grep ehr-service | awk '{print $3}') 2>/dev/null || true

echo "Step 3: Clean local files..."
rm -rf ./services/ehr-service/dist
rm -rf ./services/ehr-service/node_modules/.cache
rm -rf ./services/ehr-service/tsconfig.tsbuildinfo

echo "Step 4: Rebuild with NO cache..."
docker compose build --no-cache --pull ehr-service

echo "Step 5: Start the service..."
docker compose up -d ehr-service

echo ""
echo "Waiting 5 seconds for service to start..."
sleep 5

echo ""
echo "=================================="
echo "📋 Service Logs:"
echo "=================================="
docker logs medicore-ehr-service --tail 30

echo ""
echo "=================================="
echo "✅ Check Status:"
echo "=================================="
docker ps | grep ehr-service

echo ""
echo "If you see '🏥 MediCore EHR Service running on port 3013' above, it's working!"
echo "🌐 API Documentation: $API_BASE_URL/docs"

