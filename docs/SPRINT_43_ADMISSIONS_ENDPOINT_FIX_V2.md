# Sprint 43: Admissions Endpoint Fix (V2)

**Issue**: Frontend still calling `/api/admissions/patient/:patientId` (404 error)

**Root Cause**: 
- Browser caching old JavaScript bundle
- Component was using direct axios call instead of API service method

**Solution**:
1. ✅ Added `getPatientAdmissions()` method to `ehrApi` service (`api.ts`)
2. ✅ Updated `AddChargeModal` to use `ehrApi.getPatientAdmissions()` instead of direct axios call
3. ✅ Added proper import for `ehrApi` in `AddChargeModal.tsx`

**Changes Made**:
- `ehr-frontend/src/services/api.ts`: Added `getPatientAdmissions()` method
- `ehr-frontend/src/components/AddChargeModal.tsx`: 
  - Added `import { ehrApi } from '../services/api'`
  - Updated `loadAdmissions()` to use `ehrApi.getPatientAdmissions()`

**Backend Endpoint** (already working):
```
GET /api/beds/admissions/patient/:patientId?includeDischarged=false
```

**Frontend Usage**:
```typescript
const response = await ehrApi.getPatientAdmissions(patientId, token, tenantSlug, false);
```

**Next Steps for User**:
1. **Hard refresh browser**: `Ctrl+Shift+R` (Windows/Linux) or `Cmd+Shift+R` (Mac)
2. Or clear browser cache
3. The frontend dev server should auto-rebuild, but if not, restart it

**Status**: ✅ **CODE FIXED - BROWSER CACHE NEEDS CLEARING**


