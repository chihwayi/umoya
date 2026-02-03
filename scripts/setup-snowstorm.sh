#!/bin/bash

# Load environment variables
source "$(dirname "$0")/load-env.sh"

# Script to set up Snowstorm (SNOMED CT Terminology Server) for testing
# Usage: ./scripts/setup-snowstorm.sh

set -e

echo "🏔️  Setting up Snowstorm (SNOMED CT Terminology Server)"
echo "=========================================================="
echo ""

# Check if Snowstorm is already running
if docker ps | grep -q snowstorm; then
    echo "✅ Snowstorm is already running"
    docker ps | grep snowstorm
    exit 0
fi

echo "1. Starting Snowstorm container..."
docker run -d \
  --name snowstorm \
  -p 8080:8080 \
  -e JAVA_OPTS="-Xmx4g -Xms1g" \
  -e SPRING_PROFILES_ACTIVE=dev \
  ihtsdo/snowstorm:latest

echo "✅ Snowstorm container started"
echo ""
echo "2. Waiting for Snowstorm to initialize (this may take 2-5 minutes)..."
echo "   Checking health endpoint..."

for i in {1..60}; do
    if curl -s $SNOWSTORM_URL/health > /dev/null 2>&1; then
        echo "✅ Snowstorm is ready!"
        break
    fi
    echo "   Attempt $i/60 - Waiting..."
    sleep 5
done

echo ""
echo "3. Testing Snowstorm API..."
curl -s "$SNOWSTORM_URL/browser/MAIN/concepts?term=diabetes&limit=1" | jq '.' | head -20 || echo "⚠️  API not ready yet, but container is running"

echo ""
echo "📋 Next Steps:"
echo "1. View logs: docker logs -f snowstorm"
echo "2. Access API: $SNOWSTORM_URL"
echo "3. Test endpoint: curl $SNOWSTORM_URL/browser/MAIN/concepts?term=diabetes"
echo ""
echo "⚠️  Note: Snowstorm needs SNOMED CT RF2 files loaded for full functionality"
echo "   See: https://github.com/IHTSDO/snowstorm for loading instructions"

