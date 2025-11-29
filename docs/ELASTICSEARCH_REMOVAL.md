# Elasticsearch Removal Guide

## Current Status

✅ **PostgreSQL is now handling everything:**
- SNOMED CT search: PostgreSQL full-text search
- ICD-10 mappings: PostgreSQL queries
- No Elasticsearch needed!

## Analysis

### What Elasticsearch Was Used For

**Before:**
- Elasticsearch was used by Snowstorm for SNOMED CT search
- Required ~2-4GB RAM
- Complex setup and maintenance
- Unreliable search results

**Now:**
- PostgreSQL handles SNOMED CT search (full-text search)
- PostgreSQL handles ICD-10 mappings
- No Elasticsearch needed!

### Current Architecture

```
┌─────────────────────────────────────────┐
│         PostgreSQL (Master DB)         │
│                                         │
│  ✅ SNOMED CT Tables                    │
│  ✅ ICD-10 Mapping Tables               │
│  ✅ Full-text search indexes            │
│  ✅ Fast, reliable queries              │
└─────────────────────────────────────────┘
              ▲
              │
              │ (Primary - Always Used)
              │
    ┌─────────┴─────────┐
    │                   │
    ▼                   ▼
EHR Service      All Tenants
```

## Removal Options

### Option 1: Complete Removal (Recommended)

**Remove Elasticsearch and Snowstorm entirely:**

```yaml
# In docker-compose.yml, comment out or remove:
# - elasticsearch service
# - snowstorm service
# - Remove elasticsearch from ehr-service depends_on
```

**Benefits:**
- ✅ Simpler architecture
- ✅ Less memory usage (~4GB saved)
- ✅ Faster startup
- ✅ No maintenance overhead

**Risks:**
- ⚠️ No fallback if PostgreSQL fails (but PostgreSQL is very reliable)

### Option 2: Keep as Optional Fallback

**Keep Snowstorm/Elasticsearch but make them optional:**

```yaml
# Keep services but don't require them
# TerminologyService will use PostgreSQL first
# Falls back to Snowstorm only if PostgreSQL fails
```

**Benefits:**
- ✅ Fallback available
- ✅ Gradual migration path

**Drawbacks:**
- ⚠️ Still uses resources (~4GB RAM)
- ⚠️ Still requires maintenance

## Recommendation: **Complete Removal**

Since PostgreSQL is working perfectly and is more reliable than Snowstorm, we recommend **removing Elasticsearch and Snowstorm entirely**.

### Steps to Remove

1. **Update docker-compose.yml:**
   ```yaml
   # Comment out or remove:
   # - elasticsearch service
   # - snowstorm service
   ```

2. **Update ehr-service dependencies:**
   ```yaml
   ehr-service:
     depends_on:
       - postgres-master
       - cdss-service
       - minio
       # Remove: elasticsearch, snowstorm
   ```

3. **Remove environment variables:**
   ```yaml
   # Remove from ehr-service:
   # - SNOMED_BASE_URL (no longer needed)
   ```

4. **Clean up volumes (optional):**
   ```bash
   docker volume rm medicore_es-data
   rm -rf snowstorm/es-data
   ```

## Verification

After removal, verify:

```bash
# Check PostgreSQL SNOMED search works
curl "http://localhost:3013/api/terminology/snomed/search?term=diabetes&limit=10"

# Check ICD-10 mappings work
curl "http://localhost:3013/api/terminology/snomed/map/73211009/ICD10"
```

## Resource Savings

**Before (with Elasticsearch + Snowstorm):**
- Elasticsearch: ~2GB RAM
- Snowstorm: ~2GB RAM
- **Total: ~4GB RAM**

**After (PostgreSQL only):**
- PostgreSQL: Already running (no additional RAM)
- **Total: 0GB additional RAM**

**Savings: ~4GB RAM!**

## Summary

✅ **Elasticsearch is NOT needed anymore**  
✅ **PostgreSQL handles everything**  
✅ **Can safely remove Elasticsearch and Snowstorm**  
✅ **Simpler, faster, more reliable architecture**  

The system is now **100% PostgreSQL-based** for terminology services!


