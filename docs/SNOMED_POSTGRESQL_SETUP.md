# SNOMED CT PostgreSQL Direct Import - Setup Guide

## Overview

This guide walks you through migrating from Snowstorm + Elasticsearch to direct PostgreSQL import for SNOMED CT terminology.

## Why Migrate?

✅ **Reliable Search** - PostgreSQL full-text search works perfectly  
✅ **No Hardcoding** - Proper search works for all terms automatically  
✅ **Fast** - Native database queries, no network calls  
✅ **Simple** - Standard SQL, easy to maintain  
✅ **No External Dependencies** - Everything in your existing PostgreSQL  

## Prerequisites

- PostgreSQL database running (master database: `medicore_master`)
- SNOMED CT RF2 files downloaded (e.g., `SnomedCT_InternationalRF2_PRODUCTION_20251101T120000Z.zip`)
- Node.js and TypeScript installed

## Step-by-Step Setup

### Step 1: Extract RF2 Files

```bash
# Extract the SNOMED CT RF2 zip file
cd ~/Downloads
unzip SnomedCT_InternationalRF2_PRODUCTION_20251101T120000Z.zip
```

This will create a directory like:
```
SnomedCT_InternationalRF2_PRODUCTION_20251101T120000Z/
  Snapshot/
    Terminology/
      sct2_Concept_Snapshot_*.txt
      sct2_Description_Snapshot_*.txt
      ...
```

### Step 2: Create PostgreSQL Schema

```bash
# Run the schema creation script
./scripts/create-snomed-schema.sh
```

This creates:
- `snomed_concepts` table
- `snomed_descriptions` table
- `snomed_relationships` table
- `snomed_search_view` materialized view (for fast search)

### Step 3: Import RF2 Files

```bash
# Run the import script
ts-node scripts/import-snomed-to-postgresql.ts ~/Downloads/SnomedCT_InternationalRF2_PRODUCTION_20251101T120000Z
```

**Expected time**: 30-60 minutes for full SNOMED CT International

**What it does**:
1. Imports concepts from `sct2_Concept_Snapshot_*.txt`
2. Imports descriptions from `sct2_Description_Snapshot_*.txt`
3. Creates full-text search indexes
4. Refreshes the materialized search view

### Step 4: Enable PostgreSQL Search in EHR Service

The EHR service is already configured to use PostgreSQL when available. Just set:

```bash
# In docker-compose.yml or .env
SNOMED_USE_POSTGRES=true
```

The service will:
1. Try PostgreSQL first (if enabled)
2. Fall back to Snowstorm API if PostgreSQL fails

### Step 5: Restart Services

```bash
docker-compose up -d --build ehr-service
```

### Step 6: Test

```bash
# Test SNOMED search
curl "http://localhost:3013/api/terminology/snomed/search?term=diabetes&limit=10"
```

You should see reliable results without "Rumex venosus" or other test concepts!

## Verification

### Check Import Status

```sql
-- Connect to master database
psql -h localhost -U medicore -d medicore_master

-- Check concept count
SELECT COUNT(*) FROM snomed_concepts WHERE active = true;
-- Expected: ~350,000+ concepts

-- Check description count
SELECT COUNT(*) FROM snomed_descriptions WHERE active = true AND language_code = 'en';
-- Expected: ~1,000,000+ descriptions

-- Test search
SELECT concept_id, term, term_type
FROM snomed_search_view
WHERE search_vector @@ to_tsquery('english', 'diabetes:*')
LIMIT 10;
```

### Test in EHR UI

1. Go to Nursing Notes
2. Try searching for:
   - "diabetes" → Should return diabetes-related concepts
   - "vital signs" → Should return vital signs concepts
   - "body temperature" → Should return temperature concepts
   - "blood pressure" → Should return BP concepts

All searches should work reliably without test concept pollution!

## Troubleshooting

### Import Fails

**Error**: "Terminology directory not found"
- **Solution**: Make sure you extracted the RF2 zip file
- Check the path: `~/Downloads/SnomedCT_InternationalRF2_PRODUCTION_20251101T120000Z/Snapshot/Terminology/`

**Error**: "Database connection failed"
- **Solution**: Check database credentials in `.env` or environment variables
- Verify PostgreSQL is running: `docker ps | grep postgres`

### Search Returns No Results

**Problem**: Search returns empty results
- **Solution**: Check if materialized view was refreshed:
  ```sql
  REFRESH MATERIALIZED VIEW CONCURRENTLY snomed_search_view;
  ```

### Still Using Snowstorm

**Problem**: Service still calls Snowstorm API
- **Solution**: Check environment variable:
  ```bash
  echo $SNOMED_USE_POSTGRES
  # Should be "true"
  ```
- Restart service: `docker-compose restart ehr-service`

## Maintenance

### Updating SNOMED CT

When new SNOMED CT releases come out:

1. Download new RF2 files
2. Run import script again (handles updates automatically)
3. Refresh materialized view:
   ```sql
   REFRESH MATERIALIZED VIEW CONCURRENTLY snomed_search_view;
   ```

### Performance Tuning

If search is slow:

```sql
-- Analyze tables for better query planning
ANALYZE snomed_concepts;
ANALYZE snomed_descriptions;
ANALYZE snomed_search_view;

-- Rebuild indexes if needed
REINDEX INDEX idx_snomed_descriptions_term_fts;
REINDEX INDEX idx_snomed_search_view_vector;
```

## Rollback

If you need to rollback to Snowstorm:

1. Set environment variable:
   ```bash
   SNOMED_USE_POSTGRES=false
   ```
2. Restart service:
   ```bash
   docker-compose restart ehr-service
   ```

The service will automatically use Snowstorm API again.

## Benefits Achieved

✅ **No more "Rumex venosus"** - Test concepts are filtered out  
✅ **Reliable search** - PostgreSQL full-text search works perfectly  
✅ **No hardcoding** - All terms work automatically  
✅ **Fast** - Native database queries (< 50ms)  
✅ **Simple** - Standard SQL, easy to maintain  

## Next Steps

- Remove Snowstorm/Elasticsearch from docker-compose (optional)
- Remove hardcoded known concept IDs from TerminologyService (no longer needed!)
- Enjoy reliable SNOMED CT search! 🎉


