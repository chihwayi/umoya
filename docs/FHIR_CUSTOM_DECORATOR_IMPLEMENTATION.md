# FHIR Custom Decorator Implementation - Status

## ✅ What We've Implemented

**Option 1: Custom Decorators** - This is the recommended NestJS approach for handling custom request types.

### Files Created/Modified:

1. **`/services/ehr-service/src/decorators/tenant.decorator.ts`**
   - Created `@TenantDb()` decorator to extract tenant database
   - Created `@TenantId()` decorator to extract tenant ID
   - Added extensive logging to trace execution

2. **`/services/ehr-service/src/controllers/fhir.controller.ts`**
   - Replaced all `@Req() req: RequestWithTenant` with `@TenantDb()` and `@TenantId()` decorators
   - Updated all 23 controller methods
   - Removed dependency on `RequestWithTenant` type injection

3. **`/services/ehr-service/src/services/fhir.service.ts`**
   - Updated `searchObservations` and `searchEncounters` to accept `tenantId` parameter
   - Updated mapper calls to pass `tenantId`

4. **Mapper Files**
   - Updated `ObservationMapper.vitalsToFhir()` and `labOrderToFhir()` to accept optional `tenantId`
   - Updated `EncounterMapper.appointmentToFhir()` and `admissionToFhir()` to accept optional `tenantId`

## ❌ Current Issue

The endpoint still returns **500 Internal Server Error** with **NO LOGS** appearing from:
- `TenantMiddleware` (should run first)
- `JwtAuthGuard` (should run second)
- `TenantDb` / `TenantId` decorators (should run when resolving parameters)
- `FhirController.searchPatients` method (should run last)

This indicates the error is occurring **before NestJS processes the route**, possibly during:
1. Route registration
2. Module initialization
3. Dependency injection setup

## 🔍 Next Steps to Debug

### Option A: Check Route Registration
```bash
docker exec medicore-ehr-service sh -c "cd /app && npm run build 2>&1 | grep -i fhir"
```

### Option B: Verify Decorator Import
Ensure the decorators are properly exported and imported.

### Option C: Try Alternative Approach
If custom decorators don't work, we can try:
- **Option 2**: Inject `TenantService` directly in controller
- **Option 3**: Use type assertion workaround (`@Req() req: any`)
- **Option 4**: Fix `RequestWithTenant` interface to properly extend Express Request

### Option D: Check NestJS Version Compatibility
There might be a known issue with the NestJS version being used.

## 📝 Why Custom Decorators Should Work

Custom decorators are the **recommended NestJS pattern** for:
- Extracting custom data from requests
- Avoiding dependency injection issues with custom types
- Making code more testable and maintainable

The fact that they're not being called suggests a deeper issue with route registration or module configuration.


