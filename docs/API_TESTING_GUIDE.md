# API Testing Guide for All Dashboard Modules

## Overview
This guide provides instructions for testing all API endpoints used by the 8 new dashboard modules.

## Prerequisites
- Backend service running on `http://localhost:3013`
- Frontend service running on `http://localhost:3014`
- Login credentials: `dr.smith@bulawayo-general.co.zw` / `Password1#`
- Tenant: `bulawayo-general`

## Test Script
Run the automated test script:
```bash
cd /Users/devoop/Dev/personal/medicore
node scripts/test-all-dashboard-apis.js
```

## Manual Testing Checklist

### 1. PACU Dashboard (`/pacu`)
**Endpoint:** `GET /api/anesthesia/pacu/active`
- ✅ Should return array of active PACU patients
- ✅ Should include patient details, Aldrete scores
- ✅ Should handle empty results gracefully

### 2. Operating Room Dashboard (`/operating-room`)
**Endpoints:**
- `GET /api/operating-room/availability?date=YYYY-MM-DD`
  - ✅ Should return OR availability for the date
  - ✅ Should include scheduled cases per OR
  
- `GET /api/operating-room/metrics?startDate=YYYY-MM-DD&endDate=YYYY-MM-DD`
  - ✅ Should return OR utilization metrics
  - ✅ Should include case counts, durations, room utilization

### 3. MAR (BCMA) Dashboard (`/mar`)
**Endpoints:**
- `GET /api/beds/admissions`
  - ✅ Should return list of admitted patients
  
- `GET /api/bcma/mar/patient/:patientId`
  - ✅ Should return MAR list for patient
  - ✅ Should include scheduled medications for today
  - ✅ Should handle missing patient gracefully

### 4. Blood Bank Dashboard (`/blood-bank`)
**Endpoints:**
- `GET /api/blood-bank/inventory`
  - ✅ Should return blood inventory
  - ✅ Should support filters (componentType, bloodGroup, status)
  
- `GET /api/blood-bank/inventory/stats`
  - ✅ Should return inventory statistics
  - ✅ Should group by component type and blood group
  
- `GET /api/blood-bank/transfusions/active`
  - ✅ Should return active transfusions
  - ✅ Should include patient and vitals information

### 5. Infection Control Dashboard (`/infection-control`)
**Endpoints:**
- `GET /api/infection-control/infections?startDate=YYYY-MM-DD&endDate=YYYY-MM-DD`
  - ✅ Should return infections in date range
  - ✅ Should default to last 30 days if no dates provided
  
- `GET /api/infection-control/metrics/hai?startDate=YYYY-MM-DD&endDate=YYYY-MM-DD`
  - ✅ Should return HAI metrics
  - ✅ Should include total HAI, by type, device-associated
  
- `GET /api/infection-control/isolation/active`
  - ✅ Should return active isolation precautions
  - ✅ Should include patient, room, isolation type, PPE requirements

### 6. Sepsis Dashboard (`/sepsis`)
**Endpoints:**
- `GET /api/sepsis/alerts`
  - ✅ Should return sepsis alerts from last 24 hours
  - ✅ Should include patient details, screening results
  
- `GET /api/sepsis/compliance?startDate=YYYY-MM-DD&endDate=YYYY-MM-DD`
  - ✅ Should return bundle compliance metrics
  - ✅ Should include 3-hour and overall compliance rates

### 7. Revenue Cycle Dashboard (`/revenue-cycle`)
**Endpoints:**
- `GET /api/revenue-cycle/charge-master`
  - ✅ Should return charge master items
  - ✅ Should support department filter
  - ✅ Should only return active items

### 8. CDI Dashboard (`/cdi`)
**Endpoints:**
- `GET /api/cdi/metrics?startDate=YYYY-MM-DD&endDate=YYYY-MM-DD`
  - ✅ Should return CDI metrics
  - ✅ Should include query counts, answered queries, DRG changes
  
- `GET /api/cdi/queries/physician/:physicianId`
  - ✅ Should return open queries for physician
  - ✅ Should include patient details
  - ✅ Should handle invalid physician ID gracefully

## Expected Response Formats

### Success Response
```json
{
  "data": [...],
  "status": 200
}
```

### Error Response
```json
{
  "message": "Error description",
  "statusCode": 400/404/500
}
```

## Common Issues & Fixes

### 404 Not Found
- **Cause:** Route not registered in controller
- **Fix:** Check `ehr.module.ts` to ensure controller is registered
- **Fix:** Verify route path matches frontend call

### 401 Unauthorized
- **Cause:** Missing or invalid JWT token
- **Fix:** Ensure `Authorization: Bearer <token>` header is present
- **Fix:** Verify token is not expired

### 500 Internal Server Error
- **Cause:** Service method error or missing database table
- **Fix:** Check backend logs for detailed error
- **Fix:** Verify database migrations are applied
- **Fix:** Check service method implementation

### Empty Results
- **Cause:** No data in database
- **Fix:** This is expected for new modules - seed data may be needed
- **Fix:** Verify database tables exist and have correct schema

## Database Verification

Verify all tables exist:
```sql
-- Check Phase 1 tables
SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'public' 
AND (
  table_name LIKE '%operating%' OR
  table_name LIKE '%surgical%' OR
  table_name LIKE '%anesthesia%' OR
  table_name LIKE '%pacu%' OR
  table_name LIKE '%medication_administration%' OR
  table_name LIKE '%blood%' OR
  table_name LIKE '%infection%' OR
  table_name LIKE '%sepsis%' OR
  table_name LIKE '%charge%' OR
  table_name LIKE '%cdi%'
)
ORDER BY table_name;
```

## Testing in Browser

1. Login to frontend: `http://localhost:3014`
2. Navigate to each dashboard:
   - `/ehr/bulawayo-general/pacu`
   - `/ehr/bulawayo-general/operating-room`
   - `/ehr/bulawayo-general/mar`
   - `/ehr/bulawayo-general/blood-bank`
   - `/ehr/bulawayo-general/infection-control`
   - `/ehr/bulawayo-general/sepsis`
   - `/ehr/bulawayo-general/revenue-cycle`
   - `/ehr/bulawayo-general/cdi`
3. Open browser DevTools → Network tab
4. Check for:
   - ✅ 200/201 status codes
   - ❌ 404/500 errors
   - ⚠️  Empty responses (may be expected if no data)

## Next Steps After Testing

1. **Fix any 404 errors:**
   - Verify controller routes match frontend calls
   - Check route order (specific routes before parameterized)

2. **Fix any 500 errors:**
   - Check service method implementations
   - Verify database tables exist
   - Check for syntax errors in services

3. **Add seed data:**
   - Create seed scripts for testing
   - Populate sample data for each module

4. **Document any known issues:**
   - Create issues list
   - Prioritize fixes




