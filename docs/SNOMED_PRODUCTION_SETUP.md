# SNOMED CT Production Setup Guide

## Quick Answer

**For Production with Real Data:** You need **SNOWSTORM** (self-hosted)

---

## Why Snowstorm for Production?

1. **No Rate Limits** - Critical for production SaaS platform
2. **Full Control** - You manage the infrastructure
3. **Complete Functionality** - All SNOMED CT features available
4. **Performance** - Optimized for your use case
5. **Reliability** - No dependency on external services

---

## Step-by-Step: Setting Up Snowstorm

### Step 1: Get SNOMED CT RF2 Files

1. **Register at SNOMED International**
   - Go to https://www.snomed.org/
   - Click "Become a Member" or "Request Access"
   - Complete registration process
   - Note: Some countries have free access (check your country's status)

2. **Download SNOMED CT RF2 Files**
   - Login to SNOMED CT member portal
   - Navigate to Downloads section
   - Download latest SNOMED CT International release
   - Files will be in RF2 format (tab-delimited)
   - Total size: ~2-5 GB (compressed)

### Step 2: Set Up Snowstorm

```bash
# Option A: Using Docker (Recommended)
docker run -d \
  --name snowstorm \
  -p 8080:8080 \
  -e JAVA_OPTS="-Xmx4g -Xms1g" \
  -v /path/to/rf2/files:/rf2 \
  ihtsdo/snowstorm:latest

# Option B: Using GitHub (More control)
git clone https://github.com/IHTSDO/snowstorm.git
cd snowstorm
# Follow setup instructions in README
```

### Step 3: Load SNOMED CT RF2 Files

```bash
# Using Snowstorm API
curl -X POST "http://localhost:8080/imports" \
  -H "Content-Type: application/json" \
  -d '{
    "branchPath": "MAIN",
    "createCodeSystemVersion": true,
    "type": "SNAPSHOT"
  }'

# Then upload RF2 files
# (See Snowstorm documentation for full import process)
```

### Step 4: Configure MediCore

```bash
# Update docker-compose.yml or .env
SNOMED_BASE_URL=http://snowstorm:8080
SNOMED_USE_CACHE=true

# Restart EHR service
docker-compose restart ehr-service
```

---

## Alternative: SNOMED CT Browser Public API (Testing Only)

**Current Configuration:** Using public API for testing

```yaml
# docker-compose.yml
SNOMED_BASE_URL=https://browser.ihtsdotools.org/snowstorm/snomed-ct
```

**Limitations:**
- ⚠️ Rate limits (not suitable for production)
- ⚠️ Dependent on external service
- ⚠️ Limited functionality
- ✅ Good for testing and development

---

## Production Checklist

- [ ] Obtain SNOMED CT RF2 files from SNOMED International
- [ ] Set up Snowstorm server
- [ ] Load RF2 files into Snowstorm
- [ ] Configure `SNOMED_BASE_URL` to point to Snowstorm
- [ ] Test endpoints with real data
- [ ] Monitor performance
- [ ] Set up backups for Snowstorm data
- [ ] Configure caching strategy

---

## Cost Considerations

### SNOMED CT License
- **Member Countries:** Usually free
- **Non-Member Countries:** May require license fee
- **Check:** https://www.snomed.org/implementers

### Infrastructure Costs
- **Snowstorm Server:** 
  - Compute: ~$50-200/month (depending on size)
  - Storage: ~$10-50/month (for RF2 files)
  - Total: ~$60-250/month

### Public API
- **Cost:** Free (but has limitations)
- **Suitable for:** Testing only

---

## Recommendation for MediCore

**For Production:** Use **Snowstorm** with your own RF2 files
- You're building a SaaS platform
- You need reliability and performance
- Rate limits on public API won't work
- You have multiple tenants (higher volume)

**For Development:** Current setup (public API) is fine
- Good for testing
- No infrastructure needed
- Can switch to Snowstorm later

---

## Migration Path

1. **Now:** Using public API (configured)
2. **Development:** Continue with public API
3. **Pre-Production:** Set up Snowstorm
4. **Production:** Use Snowstorm exclusively

---

## Support Resources

- **Snowstorm GitHub:** https://github.com/IHTSDO/snowstorm
- **SNOMED International:** https://www.snomed.org/
- **SNOMED CT Documentation:** https://docs.snomed.org/
- **Implementation Guides:** https://implementation.snomed.org/

