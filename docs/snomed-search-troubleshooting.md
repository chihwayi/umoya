# SNOMED CT Search Troubleshooting

## Current Issue

Searches for "pain" and "blood pressure" are returning 0 concepts because:

1. **Elasticsearch index was cleared** - When we cleared Elasticsearch to rebuild the index, we lost the search index
2. **Import is queued but not processing** - The import job was created (HTTP 201) but may not be actively processing
3. **Word order issue** - Fixed: "blood pressur" was being reversed to "pressur blood" (now fixed in code)

## Solutions

### Option 1: Wait for Import to Complete (Recommended)

The import job was created and should be processing. Monitor it:

```bash
# Watch for import activity
docker compose logs -f snowstorm | grep -i "import\|snapshot\|reading\|concepts read\|completed"

# The import will show messages like:
# - "Starting RF2 SNAPSHOT import"
# - "Reading concepts"
# - "527304 concepts read"
# - "Completed RF2 SNAPSHOT import"
```

**Expected time**: 30-60 minutes for full import

### Option 2: Check Import Status

Check if the import is actually running:

```bash
# Check Snowstorm logs for any import activity
docker compose logs snowstorm --tail 500 | grep -i "import"

# Check if there are any errors
docker compose logs snowstorm --tail 500 | grep -i "error\|exception"
```

### Option 3: Re-trigger Import (If Not Running)

If the import isn't running, trigger it again:

```bash
curl -X POST "http://localhost:8080/imports" \
  -H "Content-Type: application/json" \
  -d '{
    "branchPath": "MAIN",
    "createCodeSystemVersion": true,
    "type": "SNAPSHOT",
    "filePath": "/opt/snowstorm/import/SnomedCT_InternationalRF2_PRODUCTION_20251101T120000Z/Snapshot"
  }'
```

### Option 4: Use FULL Import Instead

If SNAPSHOT import isn't working, try FULL import (but this requires no existing content):

```bash
# First, you might need to clear the MAIN branch
# Then use FULL import:
curl -X POST "http://localhost:8080/imports" \
  -H "Content-Type: application/json" \
  -d '{
    "branchPath": "MAIN",
    "createCodeSystemVersion": true,
    "type": "FULL",
    "filePath": "/opt/snowstorm/import/SnomedCT_InternationalRF2_PRODUCTION_20251101T120000Z/Full"
  }'
```

## Code Fixes Applied

1. **Word order preservation**: Fixed the issue where "blood pressur" was being reversed to "pressur blood"
2. **Reversed word order handling**: Added mappings to handle reversed word order
3. **Better term mappings**: Added more specific mappings for common search terms

## Testing After Import Completes

Once the import completes, test with:

```bash
# Test "pain" search
curl -s "http://localhost:8080/browser/MAIN/concepts?term=pain&limit=5" | jq '.items[] | {conceptId, term: .pt.term}'

# Test "blood pressure" search  
curl -s "http://localhost:8080/browser/MAIN/concepts?term=blood%20pressure&limit=5" | jq '.items[] | {conceptId, term: .pt.term}'
```

You should see real SNOMED CT concept IDs (not starting with 9999).

## Current Status

- ✅ EHR service rebuilt with word order fixes
- ✅ Import job created (HTTP 201)
- ⏳ Waiting for import to process and rebuild Elasticsearch index
- ⚠️ Search will return 0 results until import completes




