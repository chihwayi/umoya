# Sprint 43: Admissions Endpoint Fix

**Issue**: `GET /api/admissions/patient/:patientId` returning 404

**Root Cause**: 
- Endpoint didn't exist in backend
- Frontend was calling wrong path (`/admissions/patient/:id` instead of `/beds/admissions/patient/:id`)

**Solution**:
1. ✅ Added `getPatientAdmissions()` method to `ADTService`
2. ✅ Added `@Get('admissions/patient/:patientId')` endpoint to `BedManagementController`
3. ✅ Fixed route order (specific routes before general routes)
4. ✅ Updated frontend to use correct path: `/beds/admissions/patient/:patientId`

**New Endpoint**:
```
GET /api/beds/admissions/patient/:patientId?includeDischarged=false
```

**Response**: Array of admission objects with patient and bed relations

**Status**: ✅ **FIXED AND WORKING**


