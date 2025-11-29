# How to Check SNOMED CT Import Status

## Quick Check Script

Run the automated check script:

```bash
./scripts/check-snomed-import-status.sh
```

This will check:
1. ✅ Import completion messages in logs
2. 📊 Recent import activity
3. 🔍 Search functionality (tests if import worked)
4. 📋 Summary of current status

## Manual Checks

### Method 1: Check Logs for Import Completion

```bash
# Look for completion message
docker compose logs snowstorm | grep -i "completed.*RF2.*import"

# You should see something like:
# "Completed RF2 SNAPSHOT import on branch MAIN in 1746 seconds"
```

### Method 2: Check for Import Activity

```bash
# Watch for import activity in real-time
docker compose logs -f snowstorm | grep -i "import\|snapshot\|reading\|concepts read"

# You'll see messages like:
# - "Starting RF2 SNAPSHOT import"
# - "Reading concepts"
# - "527304 concepts read from sct2_Concept_Snapshot_INT_20251101.txt"
# - "Completed RF2 SNAPSHOT import"
```

### Method 3: Test Search Functionality

The best way to know if import is complete is to test if search works:

```bash
# Test "pain" search
curl -s "http://localhost:8080/browser/MAIN/concepts?term=pain&limit=3" | jq '.items[] | {conceptId, term: .pt.term}'

# Test "blood pressure" search
curl -s "http://localhost:8080/browser/MAIN/concepts?term=blood%20pressure&limit=3" | jq '.items[] | {conceptId, term: .pt.term}'
```

**If you see real SNOMED CT concept IDs (not starting with 9999), the import is complete!**

### Method 4: Check Import Job Status

```bash
# Check if import job was created (HTTP 201 means success)
curl -s -X POST "http://localhost:8080/imports" \
  -H "Content-Type: application/json" \
  -d '{
    "branchPath": "MAIN",
    "createCodeSystemVersion": true,
    "type": "SNAPSHOT",
    "filePath": "/opt/snowstorm/import/SnomedCT_InternationalRF2_PRODUCTION_20251101T120000Z/Snapshot"
  }' | jq '.'
```

If you get HTTP 201, the import job was created and should be processing.

## Import Timeline

A typical SNOMED CT import takes:
- **30-60 minutes** for a full SNAPSHOT import
- You'll see progress messages as it reads files:
  - Concepts (500K+ concepts)
  - Descriptions (1.6M+ descriptions)
  - Relationships (3.5M+ relationships)
  - Reference sets (millions of members)

## Signs Import is Complete

✅ **Import is complete when:**
1. You see "Completed RF2 SNAPSHOT import" in logs
2. Search returns real SNOMED CT concepts (IDs not starting with 9999)
3. No more "Reading..." messages in logs

❌ **Import is NOT complete when:**
1. Search returns 0 results
2. Search returns test data (concept IDs starting with 9999)
3. No "Completed" message in logs

## Current Status

Based on the check script:
- ✅ Previous import completed on Nov 17, 2025
- ⚠️ Elasticsearch index was cleared (needs rebuild)
- ⏳ New import job created (HTTP 201) - should be processing
- ❌ Search currently returns 0 results (waiting for import)

## Next Steps

1. **Monitor the import**: Run `./scripts/check-snomed-import-status.sh` periodically
2. **Watch logs**: `docker compose logs -f snowstorm | grep -i import`
3. **Wait 30-60 minutes** for import to complete
4. **Test search** once you see "Completed" message




