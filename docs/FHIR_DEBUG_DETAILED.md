# FHIR Endpoint Debugging - Detailed Analysis

## 1. Test Script We're Running

**Script Location:** `/Users/devoop/Dev/personal/medicore/scripts/test-fhir-endpoints.sh`

**What it does:**
- Tests all FHIR R4 endpoints implemented in Sprint 44
- Base URL: `http://localhost:3013/api`
- Tenant: `bulawayo-general`
- User: `doctor@bulawayo-general.co.zw`

**Test Sequence:**
1. ✅ Login (PASSES - HTTP 200)
2. ✅ Fetch test patient ID from database (PASSES)
3. ✅ GET `/fhir/metadata` (PASSES - HTTP 200)
4. ❌ **GET `/fhir/Patient` (FAILS - HTTP 500)**
5. All subsequent tests fail because they depend on Patient search

**Current Status:**
```
Testing: GET /fhir/metadata (Capability Statement) ... ✅ PASSED (HTTP 200)
Testing: GET /fhir/Patient (Search all) ... ❌ FAILED (HTTP 500, expected 200)
Response: {"statusCode":500,"message":"Internal server error"}
```

---

## 2. Errors We're Getting

### Primary Error
- **Endpoint:** `GET /api/fhir/Patient`
- **HTTP Status:** `500 Internal Server Error`
- **Response Body:** `{"statusCode":500,"message":"Internal server error"}`

### Error Characteristics
1. **No detailed error logs** - Our extensive console.log statements are NOT appearing in logs
2. **Exception filter not catching** - The `AllExceptionsFilter` we added is not logging anything
3. **Controller method may not be reached** - No logs from `🎯 [FHIR Controller]` markers
4. **Service method may not be reached** - No logs from `🔍 [FHIR]` markers

### What This Suggests
The error is happening **BEFORE** the controller method is called, likely in:
- Route resolution
- Middleware (TenantMiddleware)
- Guard (JwtAuthGuard)
- Dependency injection
- Module initialization

---

## 3. Probable Culprits

### Culprit #1: Missing `tenantId` Parameter (HIGH PROBABILITY)
**Issue:** 
- `FhirController.searchPatients()` calls `fhirService.searchPatients(query, req.tenantDb)`
- But `FhirService.searchPatients()` signature is: `async searchPatients(query: any, tenantDb: DataSource)`
- The mapper methods (`PatientMapper.toFhir()`) expect `tenantId` as second parameter
- We're not passing `req.tenantId` to the service method

**Evidence:**
- In `fhir.service.ts` line 91: `async searchPatients(query: any, tenantDb: DataSource)` - only 2 params
- In `fhir.service.ts` line 178: `PatientMapper.toFhir(patient, 'bulawayo-general')` - hardcoded tenant
- In `fhir.controller.ts` line 34: `this.fhirService.searchPatients(query, req.tenantDb)` - missing tenantId

**Fix Needed:**
```typescript
// Controller
const result = await this.fhirService.searchPatients(query, req.tenantDb, req.tenantId);

// Service
async searchPatients(query: any, tenantDb: DataSource, tenantId: string) {
  // ...
  PatientMapper.toFhir(patient, tenantId);
}
```

### Culprit #2: TypeScript Compilation Error (MEDIUM PROBABILITY)
**Issue:**
- The service may not be compiling correctly
- Missing import for `Admission` entity (we fixed this, but container may have stale code)

**Evidence:**
- Earlier we saw: `error TS2552: Cannot find name 'Admission'`
- We added the import, but Docker container may need rebuild

**Fix Needed:**
- Full container rebuild: `docker-compose build ehr-service && docker-compose restart ehr-service`

### Culprit #3: Route Not Being Matched (LOW PROBABILITY)
**Issue:**
- Route `/api/fhir/Patient` might be conflicting with another route
- NestJS route ordering issue

**Evidence:**
- Logs show route is mapped: `Mapped {/api/fhir/Patient, GET} route`
- But controller method not being called

**Fix Needed:**
- Check route order in `fhir.controller.ts`
- Ensure `@Get('Patient')` comes before `@Get('Patient/:id')`

### Culprit #4: Middleware/Guard Error (MEDIUM PROBABILITY)
**Issue:**
- `TenantMiddleware` might be failing to set `req.tenantDb`
- `JwtAuthGuard` might be rejecting the request silently

**Evidence:**
- No logs from controller, suggesting request doesn't reach it
- Exception filter should catch guard errors, but it's not

**Fix Needed:**
- Add logging to `TenantMiddleware`
- Add logging to `JwtAuthGuard`

### Culprit #5: Dependency Injection Failure (LOW PROBABILITY)
**Issue:**
- `FhirService` might not be properly injected into `FhirController`
- `FhirValidatorService` might be causing DI issues

**Evidence:**
- Service loads when tested directly
- Controller loads when tested directly
- But together they might fail

**Fix Needed:**
- Check `ehr.module.ts` for proper provider registration

---

## 4. Debugging Steps Taken

1. ✅ Added comprehensive logging to `FhirService.searchPatients()`
2. ✅ Added comprehensive logging to `FhirController.searchPatients()`
3. ✅ Created global exception filter `AllExceptionsFilter`
4. ✅ Fixed TypeScript compilation errors (missing `Admission` import)
5. ✅ Fixed observation mapper type errors
6. ✅ Verified service and controller can be loaded individually

**Result:** Still getting 500 error with no logs appearing

---

## 5. Next Steps

### Immediate Actions:
1. **Fix tenantId parameter** - Update controller to pass `req.tenantId` to service
2. **Update service signature** - Add `tenantId: string` parameter
3. **Update all mapper calls** - Pass `tenantId` instead of hardcoded value
4. **Full container rebuild** - Ensure latest code is in container

### Verification:
1. Check if controller logs appear after fix
2. Check if service logs appear after fix
3. Check if exception filter catches any errors
4. Test endpoint again

---

## 6. Code Locations

- **Controller:** `services/ehr-service/src/controllers/fhir.controller.ts:25-44`
- **Service:** `services/ehr-service/src/services/fhir.service.ts:91-200`
- **Mapper:** `services/ehr-service/src/fhir/mappers/patient.mapper.ts`
- **Exception Filter:** `services/ehr-service/src/filters/http-exception.filter.ts`
- **Test Script:** `scripts/test-fhir-endpoints.sh`

---

## 7. Current Status Update

### ✅ Fixed Issues:
1. **RequestWithTenant Interface** - Simplified to properly extend Express Request
2. **TenantId Parameter** - Controller now passes `req.tenantId` to service
3. **Service Signature** - Updated to accept `tenantId: string` parameter
4. **Controller Registration** - Confirmed FhirController is registered and routes are mapped
5. **Route Mapping** - Confirmed `/api/fhir/Patient` route is mapped correctly

### ❌ Remaining Issue:
**Controller method not being called** - No logs from `🎯 [FHIR Controller]` markers appear, indicating:
- Error occurs BEFORE controller method execution
- Likely in middleware (`TenantMiddleware`) or guard (`JwtAuthGuard`)
- Exception filter not catching the error (suggests it's a silent failure or compilation issue)

### 🔍 Next Debugging Steps:
1. ✅ Add logging to `TenantMiddleware` - **DONE** (but no logs appearing)
2. ✅ Add logging to `JwtAuthGuard` - **DONE** (but no logs appearing)
3. ✅ Check if `req.tenantId` and `req.tenantDb` are being set correctly - **PENDING** (can't verify without logs)
4. ✅ Verify NestJS is properly handling the `RequestWithTenant` type - **PENDING**

### 🚨 Critical Discovery:
- **`/api/fhir/metadata` works** (returns 200) - doesn't use `RequestWithTenant`
- **`/api/fhir/Patient` fails** (returns 500) - uses `@Request() req: RequestWithTenant`
- **No logs from middleware, guard, or exception filter** - error happens before NestJS processes request
- **Routes are mapped correctly** - confirmed in logs

**Hypothesis:** The error is occurring during dependency injection or route parameter resolution when NestJS tries to inject `RequestWithTenant` into the controller method. This could be a TypeScript compilation issue or a runtime type mismatch.

