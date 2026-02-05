#!/bin/bash

# Load environment variables
source "$(dirname "$0")/load-env.sh"

echo "🔄 Force SNOMED Import - Final Attempt"
echo "======================================"

# Stop and restart services
echo "1. Restarting services..."
docker-compose stop snowstorm elasticsearch
sleep 5
docker-compose up -d elasticsearch
sleep 15
docker-compose up -d snowstorm
sleep 30

# Check health
echo "2. Checking service health..."
ES_STATUS=$(curl -s "$ELASTICSEARCH_URL/_cluster/health" | jq -r '.status')
SNOW_STATUS=$(curl -s "$SNOWSTORM_URL/actuator/health" | jq -r '.status')

echo "   Elasticsearch: $ES_STATUS"
echo "   Snowstorm: $SNOW_STATUS"

if [ "$ES_STATUS" != "green" ] || [ "$SNOW_STATUS" != "UP" ]; then
    echo "❌ Services not ready. Exiting."
    exit 1
fi

# Try FULL import (works better on empty systems)
echo "3. Triggering FULL import..."
IMPORT_RESPONSE=$(curl -s -X POST "$SNOWSTORM_URL/imports" \
  -H "Content-Type: application/json" \
  -d '{
    "branchPath": "MAIN",
    "createCodeSystemVersion": false,
    "type": "FULL",
    "filePath": "/opt/snowstorm/import/SnomedCT_InternationalRF2_PRODUCTION_20251101T120000Z/Full"
  }' \
  -w "%{http_code}")

echo "   Import response: $IMPORT_RESPONSE"

# Monitor for 2 minutes
echo "4. Monitoring for import activity..."
for i in {1..8}; do
    echo "   Check $i/8 ($(date '+%H:%M:%S'))"
    
    # Look for import activity
    IMPORT_LOGS=$(docker-compose logs snowstorm --since 30s 2>/dev/null | grep -i "import\|snapshot\|reading\|concepts" | tail -3)
    if [ ! -z "$IMPORT_LOGS" ]; then
        echo "✅ Import activity detected!"
        echo "$IMPORT_LOGS"
        echo ""
        echo "🎯 Import is running! Use ./monitor-snomed.sh to continue monitoring."
        exit 0
    fi
    
    # Test search
    SEARCH_TEST=$(curl -s "$SNOWSTORM_URL/browser/MAIN/concepts?term=pain&limit=1" 2>/dev/null)
    if echo "$SEARCH_TEST" | grep -q '"conceptId":[0-9]'; then
        echo "🎉 SNOMED data is available! Import completed!"
        echo "Search result: $SEARCH_TEST"
        exit 0
    fi
    
    sleep 15
done

echo "⚠️  No import activity detected after 2 minutes."
echo "   This might be normal - imports can take time to start."
echo "   Continue monitoring with: ./monitor-snomed.sh"
