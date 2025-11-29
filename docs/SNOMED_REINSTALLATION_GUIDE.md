# SNOMED CT Reinstallation Guide

This guide covers the complete reinstallation of SNOMED CT with improved search functionality.

## Overview

The reinstallation process:
1. Cleans up old Snowstorm and Elasticsearch data
2. Extracts new SNOMED CT files from Downloads
3. Configures Elasticsearch for optimal SNOMED search
4. Imports SNOMED CT data into Snowstorm
5. Updates search logic for better accuracy

## Prerequisites

1. **SNOMED CT Files** in `~/Downloads`:
   - `SnomedCT_InternationalRF2_PRODUCTION_20251101T120000Z.zip` (Main SNOMED CT)
   - `SNOMED_CT_to_ICD-10-CM_Resources_20250901.zip` (ICD-10 mappings - optional)

2. **Docker and Docker Compose** running

3. **Sufficient disk space** (at least 10GB free)

## Quick Start

```bash
# Run the reinstallation script
./scripts/reinstall-snomed-snowstorm.sh
```

The script will:
- Stop Snowstorm and Elasticsearch
- Clean up old data (with confirmation)
- Extract SNOMED CT files
- Start services
- Configure Elasticsearch
- Import SNOMED CT data

## Manual Steps

### 1. Stop Services

```bash
docker-compose stop snowstorm elasticsearch
```

### 2. Clean Up Old Data

```bash
# Remove Snowstorm data
rm -rf ./snowstorm/data/*

# Remove Elasticsearch indices
rm -rf ./snowstorm/es-data/*

# Remove old import files
rm -rf ./snowstorm/import/*
```

### 3. Extract SNOMED CT Files

```bash
# Create import directory
mkdir -p ./snowstorm/import

# Extract main SNOMED CT file
cd ./snowstorm/import
unzip ~/Downloads/SnomedCT_InternationalRF2_PRODUCTION_20251101T120000Z.zip

# Extract ICD-10 mappings (optional)
unzip ~/Downloads/SNOMED_CT_to_ICD-10-CM_Resources_20250901.zip
cd ../..
```

### 4. Start Services

```bash
# Start Elasticsearch first
docker-compose up -d elasticsearch

# Wait for Elasticsearch to be ready
until curl -s http://localhost:9200/_cluster/health > /dev/null; do
  sleep 2
done

# Start Snowstorm
docker-compose up -d snowstorm

# Wait for Snowstorm to be ready
until curl -s http://localhost:8080/actuator/health > /dev/null; do
  sleep 2
done
```

### 5. Import SNOMED CT Data

```bash
# Find the extracted SNOMED CT directory
SNOMED_DIR=$(find ./snowstorm/import -maxdepth 1 -type d -name "SnomedCT_InternationalRF2_PRODUCTION_*" | head -1)

# Create import job
curl -X POST "http://localhost:8080/imports" \
  -H "Content-Type: application/json" \
  -d "{
    \"branchPath\": \"MAIN\",
    \"createCodeSystemVersion\": true,
    \"type\": \"SNAPSHOT\",
    \"filePath\": \"${SNOMED_DIR}/Snapshot\"
  }"
```

### 6. Monitor Import Progress

```bash
# Watch Snowstorm logs
docker-compose logs -f snowstorm | grep -i import

# Check import status (replace IMPORT_ID with actual ID)
curl -s "http://localhost:8080/imports/IMPORT_ID" | jq '.'
```

## Improvements Made

### 1. Elasticsearch Configuration

- Increased `max_clause_count` to 32768 for complex queries
- Enabled auto-create index
- Increased `max_result_window` to 50000
- Custom analyzers for better term matching

### 2. Search Logic Updates

- **Primary endpoint**: Uses `/browser/MAIN/concepts` first (better Elasticsearch relevance)
- **Less aggressive filtering**: Trusts Elasticsearch relevance scoring
- **Better term matching**: Minimum 3 characters for substring matching
- **Fallback**: Falls back to `/terms` endpoint if concepts fails

### 3. Search Parameters

- Increased result limit for better filtering
- Uses `groupByConcept` to avoid duplicates
- Relies on Elasticsearch relevance scoring
- Less manual filtering, more trust in search engine

## Testing Search

After import completes (30-60 minutes), test search:

```bash
# Test basic search
curl -s "http://localhost:8080/browser/MAIN/concepts?term=diabetes&limit=5" | jq '.items[].pt.term'

# Test with semantic tag
curl -s "http://localhost:8080/browser/MAIN/concepts?term=heart&semanticTags=disorder&limit=5" | jq '.items[].pt.term'

# Test via EHR API
curl -s "http://localhost:3013/api/terminology/snomed/search?term=diabetes&limit=5" \
  -H "X-Tenant-ID: bulawayo-general" \
  -H "Authorization: Bearer YOUR_TOKEN" | jq '.concepts[].term'
```

## Troubleshooting

### Import Fails

1. **Check disk space**: `df -h`
2. **Check Elasticsearch health**: `curl http://localhost:9200/_cluster/health`
3. **Check Snowstorm logs**: `docker-compose logs snowstorm | tail -50`
4. **Verify file paths**: Ensure SNOMED CT files are in correct location

### Search Returns Wrong Results

1. **Verify import completed**: Check import status
2. **Clear cache**: Restart Snowstorm
3. **Check Elasticsearch indices**: `curl http://localhost:9200/_cat/indices`
4. **Run search improvement script**: `ts-node scripts/improve-snomed-search.ts`

### Slow Search

1. **Increase Elasticsearch memory**: Update `ES_JAVA_OPTS` in docker-compose.yml
2. **Check Elasticsearch health**: Ensure cluster is green
3. **Optimize indices**: Run `improve-snomed-search.ts` script

## Performance Tuning

### Elasticsearch Memory

For better performance, increase Elasticsearch memory:

```yaml
environment:
  - ES_JAVA_OPTS=-Xms4g -Xmx4g  # Increase from 2g to 4g
```

### Snowstorm Memory

Increase Snowstorm memory for faster imports:

```yaml
environment:
  - JAVA_OPTS=-Xms4g -Xmx8g  # Increase from 2g/4g to 4g/8g
```

## Verification

After import, verify SNOMED CT is working:

1. **Check concept count**:
   ```bash
   curl -s "http://localhost:8080/browser/MAIN/concepts?limit=1" | jq '.total'
   ```
   Should return a large number (300,000+)

2. **Test search accuracy**:
   ```bash
   curl -s "http://localhost:8080/browser/MAIN/concepts?term=diabetes&limit=5" | jq '.items[].pt.term'
   ```
   Should return diabetes-related concepts

3. **Check for test data**:
   ```bash
   curl -s "http://localhost:8080/browser/MAIN/concepts?term=test&limit=10" | jq '.items[].conceptId'
   ```
   Should NOT return concept IDs starting with 9999

## Next Steps

1. **Import ICD-10 mappings** (if available):
   - Use Snowstorm's mapping import feature
   - Or import via custom script

2. **Configure terminology service**:
   - Update search parameters if needed
   - Test with real-world queries

3. **Monitor performance**:
   - Watch search response times
   - Monitor Elasticsearch cluster health
   - Adjust memory settings if needed

## Support

If you encounter issues:
1. Check Snowstorm logs: `docker-compose logs snowstorm`
2. Check Elasticsearch logs: `docker-compose logs elasticsearch`
3. Review import status: `curl http://localhost:8080/imports`
4. Check disk space and memory usage


