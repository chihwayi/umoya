# SNOMED CT: Which API Do You Need?

## Direct Answer

**For FULLY CONFIGURED SNOMED CT with REAL DATA in PRODUCTION:**

✅ **YOU NEED: SNOWSTORM (Self-hosted)**

---

## Why Snowstorm?

### For Production SaaS Platform:
1. **No Rate Limits** - Public APIs have rate limits that won't work for production
2. **Full Control** - You manage uptime and performance
3. **Complete Functionality** - All SNOMED CT features available
4. **Scalability** - Can handle high volume from multiple tenants
5. **Reliability** - No dependency on external services

### What Snowstorm Requires:
1. **SNOMED CT RF2 Files** (Required)
   - Register at https://www.snomed.org/
   - Download SNOMED CT RF2 release files
   - Files are large (2-5 GB compressed)
   - May require SNOMED International membership (check your country)

2. **Infrastructure**
   - Docker or Java runtime
   - 4GB+ RAM
   - Storage for RF2 files
   - 30+ minutes initial load time

---

## Current Setup (For Testing)

**Currently Configured:** SNOMED CT Browser Public API
- URL: `https://browser.ihtsdotools.org/snowstorm/snomed-ct`
- Good for: Testing and development
- Limitations: Rate limits, not for production

---

## Migration Path

### Phase 1: Development (Now)
- ✅ Using public API
- ✅ Testing endpoints
- ✅ Validating implementation

### Phase 2: Pre-Production
- [ ] Obtain SNOMED CT RF2 files
- [ ] Set up Snowstorm
- [ ] Load RF2 files
- [ ] Test with real data

### Phase 3: Production
- [ ] Switch to Snowstorm
- [ ] Monitor performance
- [ ] Set up backups

---

## Cost Breakdown

### SNOMED CT License
- **Member Countries:** Usually FREE
- **Non-Member:** May require license fee
- **Check:** https://www.snomed.org/implementers

### Infrastructure (Snowstorm)
- **Compute:** $50-200/month
- **Storage:** $10-50/month
- **Total:** ~$60-250/month

### Public API
- **Cost:** FREE
- **Suitable for:** Testing only

---

## Recommendation

**For MediCore EHR SaaS Platform:**

1. **Now (Development):** Continue with public API ✅
2. **Pre-Production:** Set up Snowstorm
3. **Production:** Use Snowstorm exclusively

**Why:** As a SaaS platform with multiple tenants, you'll need:
- High volume capacity
- No rate limits
- Full control
- Reliability

---

## Next Steps

1. **For Testing:** Current setup is fine (public API configured)
2. **For Production:** 
   - Register at SNOMED International
   - Download RF2 files
   - Set up Snowstorm
   - Update `SNOMED_BASE_URL` to point to Snowstorm

---

## Summary

**Question:** Which do I need for fully configured SNOMED CT with real data?

**Answer:** **SNOWSTORM** (self-hosted)

**Why:** Production SaaS platforms need full control, no rate limits, and reliability.

**Current:** Using public API for testing (good for now, not for production).

