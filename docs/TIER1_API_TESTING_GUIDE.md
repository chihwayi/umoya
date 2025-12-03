# Tier 1 API Testing Guide - Swagger UI 🧪

**Date**: December 3, 2025  
**Testing Method**: Swagger UI (Interactive API Documentation)  
**URL**: http://localhost:3013/api/docs

---

## 🚀 **QUICK START**

### Step 1: Open Swagger UI
Navigate to: **http://localhost:3013/api/docs**

### Step 2: Authenticate
1. Look for the **"Authorize" button** (usually top right with a lock icon 🔒)
2. You'll need a JWT token
3. Two options to get token:
   - **Option A**: Login via UI first at http://localhost:3014
   - **Option B**: Use Swagger's `/auth/login` endpoint

### Step 3: Get JWT Token via Swagger
1. Find `POST /api/auth/login` endpoint
2. Click "Try it out"
3. Set `X-Tenant-ID` header: `bulawayo-general`
4. Use Request body:
```json
{
  "email": "admin@bulawayo-general.co.zw",
  "password": "[ASK USER FOR PASSWORD]"
}
```
or
```json
{
  "email": "dr.ndlovu@bulawayo-general.co.zw",
  "password": "[ASK USER FOR PASSWORD]"
}
```

5. Click **Execute**
6. Copy the `token` or `access_token` from the response
7. Click **Authorize** button and paste token as: `Bearer [your-token]`

---

## 📋 **SPRINT 21: E-CONSENT MANAGEMENT**

### Available Users:
- admin@bulawayo-general.co.zw (role: admin)
- dr.ndlovu@bulawayo-general.co.zw (role: doctor)
- nurse.chipo@bulawayo-general.co.zw (role: nurse)

### Endpoints to Test:

#### 1. **GET /api/consents/templates**
**Purpose**: Fetch all consent templates  
**Headers**: `X-Tenant-ID: bulawayo-general`  
**Expected Result**: Array of 3 consent templates
- General Treatment Consent
- HIPAA Privacy Practices
- Telehealth Consent

**Test Steps**:
1. Find endpoint in Swagger
2. Click "Try it out"
3. Click "Execute"
4. Verify HTTP 200
5. Check response has 3 templates

#### 2. **GET /api/consents/templates/{id}**
**Purpose**: Fetch single consent template  
**Test Steps**:
1. Copy an `id` from previous response
2. Paste into `{id}` parameter
3. Execute
4. Verify HTTP 200
5. Check detailed template info returned

#### 3. **POST /api/consents/templates**
**Purpose**: Create new consent template  
**Request Body**:
```json
{
  "templateName": "COVID-19 Vaccination Consent",
  "templateCode": "COVID_VAX_001",
  "consentType": "treatment",
  "version": "1.0",
  "title": "COVID-19 Vaccination Consent Form",
  "content": "I hereby consent to receive the COVID-19 vaccine...",
  "effectiveDate": "2025-12-03",
  "signatureRequirements": {
    "patient": true,
    "witness": false,
    "guardian": false,
    "provider": true
  }
}
```
**Expected**: HTTP 201, new template created

#### 4. **POST /api/consents** (Create Patient Consent)
**Purpose**: Create consent for specific patient  
**Note**: Requires valid `patientId`
**Request Body**:
```json
{
  "patientId": "[GET FROM EXISTING PATIENT]",
  "templateId": "[GET FROM TEMPLATES]",
  "appointmentId": "[OPTIONAL]"
}
```
**Expected**: HTTP 201 or 404 (if patient doesn't exist - that's OK)

#### 5. **GET /api/consents/patient/{patientId}**
**Purpose**: Get all consents for a patient  
**Expected**: HTTP 200 (may be empty array)

---

## 💉 **SPRINT 22: IMMUNIZATION REGISTRY**

### Endpoints to Test:

#### 1. **GET /api/immunizations/schedules**
**Purpose**: Get all immunization schedules  
**Expected**: HTTP 200, array of 19 schedules
- DTaP series (5 doses)
- MMR, Varicella, etc.

**Verify**:
- schedules have `vaccine_name`
- schedules have `age_group`
- schedules have `dose_number`
- schedules have `recommended_age_months`

#### 2. **GET /api/immunizations/schedules?age=2&unit=months**
**Purpose**: Get vaccines due at 2 months  
**Expected**: HTTP 200, filtered list
- Should include DTaP Dose 1
- Should include other 2-month vaccines

#### 3. **GET /api/immunizations/schedules?age=12&unit=months**
**Purpose**: Get vaccines due at 12 months  
**Expected**: HTTP 200, filtered list
- Should include MMR
- Should include Varicella

#### 4. **GET /api/immunizations/inventory**
**Purpose**: Get vaccine inventory  
**Expected**: HTTP 200 (may be empty - that's OK)

#### 5. **POST /api/immunizations**
**Purpose**: Record vaccination  
**Request Body**:
```json
{
  "patientId": "[VALID PATIENT ID]",
  "vaccineCode": "90371",
  "vaccineInfo": {
    "cvxCode": "116",
    "vaccineName": "Rotavirus"
  },
  "lotNumber": "ABC123",
  "administrationSite": "left_arm",
  "doseVolume": "0.5",
  "administrationRoute": "intramuscular"
}
```
**Expected**: HTTP 201 (with valid patient) or 404 (without - that's OK)

#### 6. **POST /api/immunizations/{id}/adverse-event**
**Purpose**: Report adverse event  
**Note**: Requires existing immunization ID
**Expected**: HTTP 201 or 404

---

## 🏥 **SPRINT 23: BED MANAGEMENT & ADT**

### Endpoints to Test:

#### 1. **GET /api/beds**
**Purpose**: Get all beds  
**Expected**: HTTP 200, array of 16 beds

**Verify**:
- Beds have `ward_name`
- Beds have `bed_number`
- Beds have `status` (available/occupied/needs_cleaning)
- Beds have `bed_type`

**Expected Wards**:
- Intensive Care Unit (4 beds)
- Medical Ward (6 beds)
- Pediatrics (3 beds)
- Maternity (3 beds)

#### 2. **GET /api/beds/available**
**Purpose**: Get only available beds  
**Expected**: HTTP 200, filtered list
- All should have `status: "available"`

#### 3. **GET /api/beds?wardName=Intensive Care Unit**
**Purpose**: Filter beds by ward  
**Expected**: HTTP 200, 4 ICU beds

#### 4. **GET /api/beds/wards**
**Purpose**: Get list of wards  
**Expected**: HTTP 200, array of ward names
- "Intensive Care Unit"
- "Medical Ward"
- "Pediatrics"
- "Maternity"

#### 5. **GET /api/beds/occupancy**
**Purpose**: Get occupancy statistics  
**Expected**: HTTP 200, statistics object
```json
{
  "total_beds": 16,
  "occupied": 0,
  "available": 16,
  "occupancy_rate": 0
}
```

#### 6. **GET /api/beds/occupancy?wardName=Medical Ward**
**Purpose**: Get ward-specific occupancy  
**Expected**: HTTP 200, Medical Ward stats

#### 7. **POST /api/beds/{id}/assign**
**Purpose**: Assign bed to patient  
**Request Body**:
```json
{
  "patientId": "[VALID PATIENT ID]",
  "assignedBy": "[PROVIDER ID]",
  "reason": "Admission for pneumonia"
}
```
**Expected**: HTTP 200 (with valid IDs) or 404

#### 8. **POST /api/beds/{id}/release**
**Purpose**: Release bed  
**Request Body**:
```json
{
  "reason": "Patient discharged home"
}
```
**Expected**: HTTP 200

#### 9. **POST /api/beds/{id}/cleaned**
**Purpose**: Mark bed as cleaned  
**Expected**: HTTP 200

#### 10. **GET /api/beds/admissions**
**Purpose**: Get active admissions  
**Expected**: HTTP 200 (may be empty)

#### 11. **GET /api/beds/census**
**Purpose**: Get census snapshot  
**Expected**: HTTP 200, census data

#### 12. **POST /api/beds/admissions**
**Purpose**: Admit patient  
**Request Body**:
```json
{
  "patientId": "[VALID PATIENT ID]",
  "bedId": "[BED ID]",
  "admissionType": "emergency",
  "admittingDiagnosis": "Pneumonia",
  "admittedBy": "[PROVIDER ID]"
}
```
**Expected**: HTTP 201 or 404

---

## 🚨 **SPRINT 24: EMERGENCY DEPARTMENT**

### Endpoints to Test:

#### 1. **GET /api/ed/tracking-board**
**Purpose**: Get ED tracking board (all active visits)  
**Expected**: HTTP 200, array (may be empty)

**Should Show**:
- Patient info
- ESI level
- Status
- Wait times

#### 2. **GET /api/ed/metrics**
**Purpose**: Get ED performance metrics  
**Expected**: HTTP 200, metrics object
```json
{
  "current_census": 0,
  "average_wait_time_minutes": 0,
  "average_length_of_stay_minutes": 0,
  "lwbs_count": 0,
  "admission_rate": 0
}
```

#### 3. **POST /api/ed/visits**
**Purpose**: Create new ED visit  
**Request Body**:
```json
{
  "patientId": "[VALID PATIENT ID]",
  "chiefComplaint": "Chest pain",
  "arrivalMethod": "ambulance",
  "arrivalTime": "2025-12-03T10:30:00Z"
}
```
**Expected**: HTTP 201 or 404

#### 4. **POST /api/ed/visits/{id}/triage**
**Purpose**: Perform triage assessment  
**Request Body**:
```json
{
  "esiLevel": 2,
  "chiefComplaint": "Chest pain radiating to left arm",
  "vitalSigns": {
    "bloodPressure": "180/110",
    "heartRate": 120,
    "respiratoryRate": 22,
    "temperature": 37.2,
    "oxygenSaturation": 95
  },
  "triageNotes": "Patient appears in distress"
}
```
**Expected**: HTTP 200

#### 5. **POST /api/ed/visits/{id}/status**
**Purpose**: Update visit status  
**Request Body**:
```json
{
  "status": "in_treatment",
  "notes": "Patient seen by Dr. Smith"
}
```
**Expected**: HTTP 200

---

## 📋 **SPRINT 25: CLINICAL PATHWAYS**

### Endpoints to Test:

#### 1. **GET /api/clinical-pathways**
**Purpose**: Get all clinical pathways  
**Expected**: HTTP 200, array of 5 pathways

**Verify Pathways Exist**:
- Congestive Heart Failure Management
- Acute Ischemic Stroke Pathway
- Community-Acquired Pneumonia Protocol
- Diabetic Ketoacidosis Management
- Severe Sepsis & Septic Shock Protocol

**Check Each Has**:
- `pathway_name`
- `pathway_code`
- `condition`
- `condition_codes` (ICD-10)
- `evidence_level`

#### 2. **GET /api/clinical-pathways/{id}**
**Purpose**: Get single pathway with steps  
**Expected**: HTTP 200

**⚠️ CRITICAL CHECK**:
- Does response include `steps` array?
- Are there any steps (should be 5-10 per pathway)?
- **If 0 steps**: Database issue confirmed!

#### 3. **GET /api/clinical-pathways?condition=sepsis**
**Purpose**: Filter pathways by condition  
**Expected**: HTTP 200, filtered list
- Should return Sepsis protocol

#### 4. **GET /api/clinical-pathways?specialty=cardiology**
**Purpose**: Filter by specialty  
**Expected**: HTTP 200
- Should return CHF pathway

#### 5. **POST /api/clinical-pathways/enroll**
**Purpose**: Enroll patient in pathway  
**Request Body**:
```json
{
  "patientId": "[VALID PATIENT ID]",
  "pathwayId": "[PATHWAY ID]",
  "enrolledBy": "[PROVIDER ID]",
  "enrollmentReason": "Patient meets sepsis-3 criteria"
}
```
**Expected**: HTTP 201 or 404

#### 6. **GET /api/clinical-pathways/patient/{patientId}/enrollments**
**Purpose**: Get patient's pathway enrollments  
**Expected**: HTTP 200 (may be empty)

#### 7. **POST /api/clinical-pathways/enrollments/{id}/adherence**
**Purpose**: Mark pathway step complete  
**Request Body**:
```json
{
  "stepId": "[STEP ID]",
  "completed": true,
  "completionNotes": "Blood cultures obtained",
  "completedBy": "[PROVIDER ID]"
}
```
**Expected**: HTTP 200

---

## ✅ **TESTING CHECKLIST**

### Sprint 21: E-Consent
- [ ] Can list consent templates (3 expected)
- [ ] Can get single template
- [ ] Can create new template
- [ ] Templates have correct schema
- [ ] SNOMED/CPT code fields present

### Sprint 22: Immunization
- [ ] Can list schedules (19 expected)
- [ ] Can filter by age
- [ ] Schedules have CVX codes
- [ ] Can record vaccination (with patient)
- [ ] Can report adverse events

### Sprint 23: Bed/ADT
- [ ] Can list all beds (16 expected)
- [ ] Can filter by ward
- [ ] Can get available beds
- [ ] Can get occupancy stats
- [ ] Can assign/release beds
- [ ] Can admit patients
- [ ] Can get census

### Sprint 24: ED
- [ ] Can get tracking board
- [ ] Can get metrics
- [ ] Can create ED visit
- [ ] Can triage patients
- [ ] Can update status
- [ ] ESI levels work

### Sprint 25: Pathways
- [ ] Can list pathways (5 expected)
- [ ] Can get single pathway
- [ ] ⚠️ **CRITICAL**: Check if pathways have steps!
- [ ] Can filter by condition
- [ ] Can enroll patients
- [ ] Can track adherence

---

## 🐛 **WHAT TO REPORT**

For each endpoint, note:
1. ✅ **PASS**: Returns expected HTTP status
2. ✅ **PASS**: Returns expected data structure
3. ❌ **FAIL**: Returns error (note error message)
4. ⚠️ **WARN**: Works but missing data (e.g., empty steps)

---

## 📊 **EXPECTED RESULTS SUMMARY**

| Sprint | Tables | Schema | API | Default Data |
|--------|--------|--------|-----|--------------|
| **21: E-Consent** | ✅ | ✅ | ? | ⚠️ 3/7 |
| **22: Immunization** | ✅ | ✅ | ? | ✅ 19/19 |
| **23: Bed/ADT** | ✅ | ✅ | ? | ⚠️ 16/40 |
| **24: ED** | ✅ | ✅ | ? | ✅ Ready |
| **25: Pathways** | ✅ | ✅ | ? | ❌ 0 steps |

---

## 🚀 **NEXT STEPS AFTER API TESTING**

1. **Document Results**: Note which endpoints work/fail
2. **Fix Database Issues**: 
   - Add pathway steps (CRITICAL)
   - Add missing beds (optional)
   - Add consent templates (optional)
3. **Re-test**: Verify fixes work
4. **UI Testing**: Test frontend integration

---

**Start here**: http://localhost:3013/api/docs

**Good luck!** 🍀 Report back with results!

