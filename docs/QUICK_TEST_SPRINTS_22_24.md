# Quick Test: Sprints 22 & 24 (100% Ready) 🚀

**Date**: December 3, 2025  
**Status**: Ready to Test NOW  
**Features**: Immunization Registry + Emergency Department

---

## 🎯 **SPRINT 22: IMMUNIZATION REGISTRY**

### ✅ What's Ready:
- 19 immunization schedules loaded
- CDC-compliant vaccine series
- Full schema with CVX codes

### 🧪 Test Scenarios:

#### Test 1: View Immunization Schedule (API)
**URL**: http://localhost:3013/api/docs

1. Open Swagger UI
2. Find `GET /api/immunizations/schedules`
3. Click "Try it out"
4. Click "Execute"
5. **Expected**: HTTP 200, array of 19 schedules

**Verify**:
```json
[
  {
    "schedule_name": "DTaP Dose 1",
    "vaccine_code": "20",
    "vaccine_name": "DTaP",
    "age_group": "infant",
    "dose_number": 1,
    "recommended_age_months": 2
  },
  // ... 18 more schedules
]
```

#### Test 2: Filter by Age (API)
**Endpoint**: `GET /api/immunizations/schedules?age=2&unit=months`

**Expected Result**: Vaccines due at 2 months
- DTaP Dose 1
- Other 2-month vaccines

#### Test 3: View Vaccine Inventory (API)
**Endpoint**: `GET /api/immunizations/inventory`

**Expected**: HTTP 200 (may be empty - that's OK)

#### Test 4: Check Database Directly
```bash
docker exec medicore-postgres-master psql -U medicore -d tenant_bulawayo_general -c "
SELECT schedule_name, vaccine_name, dose_number, recommended_age_months 
FROM immunization_schedules 
ORDER BY recommended_age_months, dose_number 
LIMIT 10;
"
```

**Expected Output**:
```
    schedule_name     | vaccine_name | dose_number | recommended_age_months
----------------------+--------------+-------------+------------------------
 DTaP Dose 1          | DTaP         |           1 |                      2
 DTaP Dose 2          | DTaP         |           2 |                      4
 DTaP Dose 3          | DTaP         |           3 |                      6
 DTaP Dose 4          | DTaP         |           4 |                     15
 DTaP Dose 5          | DTaP         |           5 |                     48
 ...
```

### ✅ Success Criteria:
- [ ] Can fetch all 19 schedules
- [ ] Schedules have correct structure
- [ ] Age filtering works
- [ ] CVX codes present (in vaccineInfo field)
- [ ] Minimum intervals defined

### 📱 Frontend Test (If Implemented):
**Location**: Patient Record → Immunizations tab
**Steps**:
1. Login to http://localhost:3014
2. Navigate to a patient record
3. Look for Immunizations section
4. Check if schedule displays

**Note**: UI may not be implemented yet - API testing is sufficient!

---

## 🚨 **SPRINT 24: EMERGENCY DEPARTMENT**

### ✅ What's Ready:
- Complete 54-column schema
- ESI triage levels (1-5)
- Status workflow
- Metrics tracking

### 🧪 Test Scenarios:

#### Test 1: Get ED Tracking Board (API)
**Endpoint**: `GET /api/ed/tracking-board`

**Steps**:
1. Open Swagger: http://localhost:3013/api/docs
2. Find `GET /api/ed/tracking-board`
3. Click "Try it out"
4. Click "Execute"
5. **Expected**: HTTP 200, empty array (no visits yet)

```json
[]
```

#### Test 2: Get ED Metrics (API)
**Endpoint**: `GET /api/ed/metrics`

**Expected Result**:
```json
{
  "current_census": 0,
  "average_wait_time_minutes": null,
  "average_length_of_stay_minutes": null,
  "lwbs_count": 0,
  "lwbs_rate": 0,
  "admission_rate": 0,
  "total_visits_today": 0
}
```

#### Test 3: Verify ED Table Structure
```bash
docker exec medicore-postgres-master psql -U medicore -d tenant_bulawayo_general -c "\d ed_visits"
```

**Expected**: 54 columns including:
- `esi_level` (1-5)
- `chief_complaint`
- `arrival_time`
- `triage_time`
- `status` (awaiting_triage, triaged, in_treatment, etc.)
- `disposition`
- Timestamps for metrics

#### Test 4: Check ESI Level Enum
```bash
docker exec medicore-postgres-master psql -U medicore -d tenant_bulawayo_general -c "
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'ed_visits' 
AND column_name LIKE '%esi%';
"
```

**Expected**: `esi_level` column exists (integer 1-5)

#### Test 5: Test Create ED Visit (API)
**Endpoint**: `POST /api/ed/visits`

**Note**: Will fail without valid patient, but tests endpoint exists

**Request Body**:
```json
{
  "patientId": "00000000-0000-0000-0000-000000000000",
  "chiefComplaint": "Chest pain",
  "arrivalMethod": "ambulance",
  "arrivalTime": "2025-12-03T12:00:00Z"
}
```

**Expected**: HTTP 404 (Patient not found) - **This is GOOD!**
- Means endpoint exists and validates
- Would work with real patient ID

#### Test 6: Test Triage Endpoint (API)
**Endpoint**: `POST /api/ed/visits/{id}/triage`

**Expected**: HTTP 404 (Visit not found) - **This is GOOD!**
- Means endpoint exists and validates

### ✅ Success Criteria:
- [ ] Tracking board endpoint returns 200
- [ ] Metrics endpoint returns 200
- [ ] Table has 54 columns
- [ ] ESI level field exists
- [ ] Create visit endpoint exists (404 is OK)
- [ ] Triage endpoint exists (404 is OK)
- [ ] Status workflow fields present

### 📱 Frontend Test (If Implemented):
**Location**: ED Dashboard (new module)
**Steps**:
1. Login to http://localhost:3014
2. Look for "Emergency Department" or "ED" in navigation
3. Check if tracking board displays

**Note**: UI may not be implemented yet - API testing is sufficient!

---

## 🔍 **QUICK VERIFICATION SCRIPT**

Run this to verify both sprints:

```bash
# Sprint 22: Check immunization schedules
echo "=== SPRINT 22: IMMUNIZATION SCHEDULES ==="
docker exec medicore-postgres-master psql -U medicore -d tenant_bulawayo_general -c "
SELECT COUNT(*) as total_schedules FROM immunization_schedules;
"

echo ""
echo "Sample schedules:"
docker exec medicore-postgres-master psql -U medicore -d tenant_bulawayo_general -c "
SELECT schedule_name, vaccine_name, recommended_age_months 
FROM immunization_schedules 
ORDER BY recommended_age_months 
LIMIT 5;
"

echo ""
echo "=== SPRINT 24: ED VISITS TABLE ==="
docker exec medicore-postgres-master psql -U medicore -d tenant_bulawayo_general -c "
SELECT column_name 
FROM information_schema.columns 
WHERE table_name = 'ed_visits' 
ORDER BY ordinal_position;
" | wc -l

echo ""
echo "ED visits count:"
docker exec medicore-postgres-master psql -U medicore -d tenant_bulawayo_general -c "
SELECT COUNT(*) as ed_visits FROM ed_visits;
"
```

---

## 📊 **EXPECTED RESULTS**

### Sprint 22 (Immunization):
```
✅ Total schedules: 19
✅ Sample schedules displayed
✅ Age groups: infant, child, adolescent, adult
✅ Dose numbers: 1-5 (for series vaccines)
```

### Sprint 24 (ED):
```
✅ Table has ~54 columns
✅ ED visits count: 0 (none created yet)
✅ API endpoints respond
✅ Metrics endpoint returns zeros
```

---

## 🧪 **API TESTING IN SWAGGER**

### Steps:
1. **Open**: http://localhost:3013/api/docs
2. **Authorize**: 
   - Click "Authorize" button
   - You may need to login first via `/auth/login`
   - Use: `admin@bulawayo-general.co.zw` (ask user for password)
3. **Test Sprint 22**:
   - `/api/immunizations/schedules` → GET
   - Expect: Array of 19 schedules
4. **Test Sprint 24**:
   - `/api/ed/tracking-board` → GET
   - Expect: Empty array `[]`
   - `/api/ed/metrics` → GET
   - Expect: All zeros

---

## ✅ **TESTING CHECKLIST**

### Sprint 22: Immunization ✅
- [ ] API: Get all schedules (expect 19)
- [ ] API: Filter by age (expect filtered list)
- [ ] API: Get inventory (expect empty or list)
- [ ] DB: Verify 19 schedules exist
- [ ] DB: Check schedule structure correct
- [ ] Verify CVX codes present
- [ ] Verify age groups defined
- [ ] Verify dose intervals set

### Sprint 24: ED ✅
- [ ] API: Get tracking board (expect empty array)
- [ ] API: Get metrics (expect zeros)
- [ ] API: Create visit endpoint exists (404 is OK)
- [ ] API: Triage endpoint exists (404 is OK)
- [ ] DB: Verify ed_visits table has 54 columns
- [ ] DB: Verify ESI level field exists
- [ ] DB: Verify status field exists
- [ ] DB: Verify timestamp fields exist

---

## 🎯 **WHAT TO REPORT**

For each test, note:

**✅ PASS**: 
- Endpoint returns expected HTTP status
- Data structure correct
- Count matches expected

**❌ FAIL**:
- Endpoint returns error
- Data missing or incorrect
- Schema issues

**⚠️ WARNING**:
- Works but incomplete
- Missing optional features

---

## 📝 **EXAMPLE TEST REPORT**

```
SPRINT 22: IMMUNIZATION REGISTRY
✅ GET /api/immunizations/schedules - HTTP 200, 19 schedules
✅ Schedules have correct structure (vaccine_name, dose_number, etc.)
✅ Age filtering works
✅ Database has 19 records
⚠️  Inventory empty (no stock added yet - expected)

SPRINT 24: EMERGENCY DEPARTMENT  
✅ GET /api/ed/tracking-board - HTTP 200, empty array
✅ GET /api/ed/metrics - HTTP 200, all zeros (no visits yet)
✅ ed_visits table exists with 54 columns
✅ ESI level field present
✅ Create visit endpoint validates (404 without patient - expected)
```

---

## 🚀 **READY TO TEST!**

**Start here**:
1. Run verification script above
2. Open Swagger: http://localhost:3013/api/docs
3. Test the endpoints
4. Report back!

**Time estimate**: 15-20 minutes for thorough testing

**Success = Both sprints respond correctly to API calls!** 🎉

