# SNOMED CT / Snowstorm Issues - Problem Analysis & Solutions

## Executive Summary

**Problem**: SNOMED CT search returns `null` results even though import logs show a completed import on November 17, 2025.

**Root Cause**: Elasticsearch data was cleared to rebuild the search index, but Snowstorm uses Elasticsearch as its **primary storage**, not just a search index. This means all SNOMED CT data was lost when Elasticsearch was cleared.

**Impact**: 
- All SNOMED CT searches return 0 results
- Frontend SNOMED concept pickers show "No concepts found"
- Clinical documentation cannot use SNOMED CT coding

---

## Detailed Problem Analysis

### 1. The Paradox: Import Completed but No Data

**Evidence:**
```bash
# Import completion found in logs
✅ Completed RF2 SNAPSHOT import on branch MAIN in 1746 seconds. ID 3e82b205-ac0e-4eb4-b7cd-95ab92682572
   Date: November 17, 2025 at 07:35:32 UTC

# But search returns null
❌ curl "http://localhost:8080/browser/MAIN/concepts?term=pain&limit=1"
   Result: {"conceptId": null, "term": null}
```

**Why this happens:**
- The import completed **before** Elasticsearch was cleared (Nov 17)
- Elasticsearch was cleared on Nov 27 to rebuild the index
- **Snowstorm uses Elasticsearch as primary storage**, not just search
- When Elasticsearch was cleared, all SNOMED CT data was lost
- The import completion message is from the old import, not current data

### 2. Architecture Understanding: Snowstorm + Elasticsearch

**Critical Understanding:**
```
Snowstorm Architecture:
├── Elasticsearch (Primary Storage)
│   ├── Concepts
│   ├── Descriptions  
│   ├── Relationships
│   └── Reference Sets
└── PostgreSQL (Metadata only)
    └── Code system versions
    └── Import job tracking
```

**Key Point**: Snowstorm does **NOT** store SNOMED CT data in PostgreSQL. It uses Elasticsearch as its primary database. When Elasticsearch is cleared, all data is lost.

### 3. Why New Imports Aren't Processing

**Observation:**
- Import jobs are created successfully (HTTP 201)
- But no "Starting RF2 SNAPSHOT import" messages appear in recent logs
- No import activity detected

**Possible Causes:**

1. **Import Queue Issue**: Imports are processed asynchronously via ActiveMQ message queue. The queue might be:
   - Stuck or not processing
   - Failing silently
   - Waiting for resources

2. **Elasticsearch Not Ready**: If Elasticsearch isn't fully initialized, imports might fail silently

3. **File Path Issue**: The import file path might be incorrect or inaccessible

4. **Resource Constraints**: Snowstorm might be waiting for memory/resources

5. **Import Already Exists**: Snowstorm might detect existing data and skip import (but data is actually missing)

### 4. The Elasticsearch Clearing Mistake

**What We Did:**
```bash
rm -rf snowstorm/es-data/*
```

**What This Actually Did:**
- ✅ Cleared Elasticsearch indices (intended)
- ❌ **Deleted ALL SNOMED CT data** (unintended consequence)
- ❌ Lost 527,304 concepts that were imported on Nov 17

**Why This Happened:**
- We assumed Elasticsearch was just a search index
- In reality, Snowstorm uses Elasticsearch as its primary database
- Clearing Elasticsearch = deleting all SNOMED CT data

---

## Root Cause Summary

| Issue | Cause | Impact |
|-------|-------|--------|
| Search returns null | Elasticsearch data cleared | No SNOMED CT concepts available |
| Import completed but no data | Old import (Nov 17) before Elasticsearch was cleared | Misleading logs |
| New imports not processing | Import jobs created but not executing | Cannot rebuild data |
| Word order reversed | Code issue (fixed) | "blood pressur" → "pressur blood" |

---

## Solutions

### Solution 1: Force New Import (Recommended)

**Step 1: Verify Import Files Exist**
```bash
docker compose exec snowstorm ls -la /opt/snowstorm/import/SnomedCT_InternationalRF2_PRODUCTION_20251101T120000Z/Snapshot/
```

**Step 2: Trigger Import and Monitor**
```bash
# Trigger import
curl -X POST "http://localhost:8080/imports" \
  -H "Content-Type: application/json" \
  -d '{
    "branchPath": "MAIN",
    "createCodeSystemVersion": true,
    "type": "SNAPSHOT",
    "filePath": "/opt/snowstorm/import/SnomedCT_InternationalRF2_PRODUCTION_20251101T120000Z/Snapshot"
  }'

# Monitor in real-time
docker compose logs -f snowstorm | grep -i "import\|snapshot\|reading\|concepts read\|completed"
```

**Step 3: Wait for Completion**
- Expected time: 30-60 minutes
- Look for: "Completed RF2 SNAPSHOT import on branch MAIN"
- Then test: `curl "http://localhost:8080/browser/MAIN/concepts?term=pain&limit=1"`

### Solution 2: Check Why Imports Aren't Starting

**Diagnostic Steps:**

1. **Check Elasticsearch Health**
```bash
curl -s "http://localhost:9200/_cluster/health" | jq '.'
```

2. **Check Snowstorm Health**
```bash
curl -s "http://localhost:8080/actuator/health" | jq '.'
```

3. **Check for Import Errors**
```bash
docker compose logs snowstorm --tail 500 | grep -i "error\|exception\|failed" | tail -20
```

4. **Check ActiveMQ Queue**
```bash
docker compose logs snowstorm | grep -i "activemq\|queue\|jms" | tail -10
```

### Solution 3: Alternative - Use FULL Import Instead

If SNAPSHOT import isn't working, try FULL import (requires no existing content):

```bash
# First, ensure MAIN branch is empty
# Then trigger FULL import
curl -X POST "http://localhost:8080/imports" \
  -H "Content-Type: application/json" \
  -d '{
    "branchPath": "MAIN",
    "createCodeSystemVersion": true,
    "type": "FULL",
    "filePath": "/opt/snowstorm/import/SnomedCT_InternationalRF2_PRODUCTION_20251101T120000Z/Full"
  }'
```

**Note**: FULL import will fail if there's existing content. You may need to clear the MAIN branch first.

### Solution 4: Nuclear Option - Complete Reset

If nothing else works:

```bash
# 1. Stop services
docker compose stop snowstorm elasticsearch

# 2. Clear ALL data
rm -rf snowstorm/es-data/*
rm -rf snowstorm/data/*

# 3. Restart services
docker compose up -d elasticsearch
sleep 10
docker compose up -d snowstorm
sleep 30

# 4. Trigger fresh import
curl -X POST "http://localhost:8080/imports" \
  -H "Content-Type: application/json" \
  -d '{
    "branchPath": "MAIN",
    "createCodeSystemVersion": true,
    "type": "SNAPSHOT",
    "filePath": "/opt/snowstorm/import/SnomedCT_InternationalRF2_PRODUCTION_20251101T120000Z/Snapshot"
  }'
```

---

## Why Imports Might Not Be Processing

### Hypothesis 1: Import Queue Not Processing

**Symptoms:**
- Import job created (HTTP 201)
- No "Starting RF2 SNAPSHOT import" in logs
- No import activity

**Possible Fix:**
- Restart Snowstorm to clear queue
- Check ActiveMQ broker status
- Verify thread pool isn't exhausted

### Hypothesis 2: Elasticsearch Not Ready

**Symptoms:**
- Elasticsearch health check fails
- Import jobs created but fail silently

**Possible Fix:**
- Wait for Elasticsearch to be fully ready
- Check Elasticsearch cluster status
- Verify Elasticsearch has enough memory

### Hypothesis 3: File Path or Permissions Issue

**Symptoms:**
- Import job created but fails immediately
- No error messages

**Possible Fix:**
- Verify file path is correct
- Check file permissions in container
- Verify files are actually present

### Hypothesis 4: Resource Constraints

**Symptoms:**
- Import starts but hangs
- Memory errors in logs

**Possible Fix:**
- Increase Snowstorm memory (JAVA_OPTS)
- Increase Elasticsearch memory
- Check disk space

---

## Current Status

### What We Know:
- ✅ SNOMED CT files exist in `/opt/snowstorm/import/`
- ✅ Previous import completed on Nov 17 (but data was lost)
- ✅ Import jobs are being created (HTTP 201)
- ❌ Search returns null (no data in Elasticsearch)
- ❌ New imports not processing (no activity in logs)
- ✅ Code fixes applied (word order, filtering)

### What We Need:
- 🔍 Understand why imports aren't starting
- ⏳ Wait for import to complete (30-60 minutes)
- ✅ Verify search works after import

---

## Recommended Action Plan

### Immediate Actions:

1. **Verify Import Files**
   ```bash
   docker compose exec snowstorm ls -lh /opt/snowstorm/import/SnomedCT_InternationalRF2_PRODUCTION_20251101T120000Z/Snapshot/Terminology/
   ```

2. **Check Elasticsearch Status**
   ```bash
   curl -s "http://localhost:9200/_cluster/health" | jq '{status, number_of_nodes, active_primary_shards}'
   ```

3. **Trigger Import and Monitor**
   ```bash
   # Create import job
   curl -X POST "http://localhost:8080/imports" \
     -H "Content-Type: application/json" \
     -d '{
       "branchPath": "MAIN",
       "createCodeSystemVersion": true,
       "type": "SNAPSHOT",
       "filePath": "/opt/snowstorm/import/SnomedCT_InternationalRF2_PRODUCTION_20251101T120000Z/Snapshot"
     }'
   
   # Monitor (run in separate terminal)
   ./scripts/monitor-snomed-import.sh
   ```

4. **Wait and Verify**
   - Wait 30-60 minutes for import to complete
   - Test search: `curl "http://localhost:8080/browser/MAIN/concepts?term=pain&limit=1"`
   - Should return real concept IDs (not null)

### If Import Still Doesn't Start:

1. **Check for Silent Failures**
   ```bash
   docker compose logs snowstorm --tail 1000 | grep -i "error\|exception\|warn" | grep -i "import"
   ```

2. **Try Restarting Services**
   ```bash
   docker compose restart snowstorm elasticsearch
   sleep 30
   # Then trigger import again
   ```

3. **Check Resource Usage**
   ```bash
   docker stats medicore-snowstorm medicore-elasticsearch --no-stream
   ```

---

## Prevention for Future

### Key Learnings:

1. **Never Clear Elasticsearch Data for Snowstorm**
   - Elasticsearch IS the database, not just a search index
   - Clearing it = deleting all SNOMED CT data
   - If you need to rebuild, use Snowstorm's import API

2. **Monitor Import Status**
   - Use the monitoring scripts provided
   - Don't assume import completed just because job was created
   - Always verify with search test

3. **Backup Before Clearing**
   - If you must clear Elasticsearch, backup first
   - Or use Snowstorm's export functionality

4. **Understand Architecture**
   - Snowstorm = Elasticsearch (data) + PostgreSQL (metadata)
   - Import = Populating Elasticsearch from RF2 files
   - Search = Querying Elasticsearch

---

## Testing After Import Completes

Once import completes, verify with:

```bash
# Test 1: Simple search
curl -s "http://localhost:8080/browser/MAIN/concepts?term=pain&limit=3" | jq '.items[] | {conceptId, term: .pt.term}'

# Test 2: Multi-word search
curl -s "http://localhost:8080/browser/MAIN/concepts?term=blood%20pressure&limit=3" | jq '.items[] | {conceptId, term: .pt.term}'

# Test 3: Direct concept lookup (if you know an ID)
curl -s "http://localhost:8080/browser/MAIN/concepts/22253000" | jq '{conceptId, term: .pt.term}'
```

**Expected Results:**
- Real SNOMED CT concept IDs (6-18 digits, not starting with 9999)
- Relevant medical terms
- Not null

---

## Summary

**The Problem**: Elasticsearch was cleared, losing all SNOMED CT data. New imports aren't processing.

**The Solution**: 
1. Verify import files exist
2. Trigger new import
3. Monitor until completion (30-60 min)
4. Test search functionality

**The Fix**: Once import completes, search will work. The code improvements (word order, filtering) are already in place.

**Next Steps**: Run the monitoring script and wait for import to complete, then test search functionality.

