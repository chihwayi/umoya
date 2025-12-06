# Sprint 43: Backend Restart Required

## Issue
All PUT routes for Sprint 43 are returning 404, even though:
- ✅ Routes are correctly defined in TypeScript source
- ✅ Routes are compiled in JavaScript (`dist/controllers/revenue-cycle.controller.js`)
- ✅ Controller is registered in `ehr.module.ts`
- ✅ Backend has been restarted twice

## Root Cause
NestJS is not registering the PUT routes. Swagger docs show only GET/POST routes:
- ✅ `GET /api/revenue-cycle/charge-master`
- ✅ `POST /api/revenue-cycle/charge-master`
- ✅ `POST /api/revenue-cycle/charges`
- ✅ `GET /api/revenue-cycle/charges/patient/{patientId}`
- ✅ `GET /api/revenue-cycle/charges/review/admission/{admissionId}`
- ❌ `PUT /api/revenue-cycle/charges/:id/approve` - NOT REGISTERED
- ❌ `PUT /api/revenue-cycle/charges/:id/reject` - NOT REGISTERED
- ❌ `PUT /api/revenue-cycle/charges/:id/mark-reviewed` - NOT REGISTERED
- ❌ `PUT /api/revenue-cycle/charges/admission/:admissionId/approve-all` - NOT REGISTERED
- ❌ `GET /api/revenue-cycle/charges/pending-review` - NOT REGISTERED
- ❌ `POST /api/revenue-cycle/charges/notify-accounts/:admissionId` - NOT REGISTERED
- ❌ `GET /api/revenue-cycle/notifications` - NOT REGISTERED
- ❌ `PUT /api/revenue-cycle/notifications/:id/read` - NOT REGISTERED

## Solution
**Full Clean Rebuild Required:**

```bash
# 1. Stop the backend (Ctrl+C)

# 2. Clean build artifacts
cd services/ehr-service
rm -rf dist

# 3. Rebuild
npm run build

# 4. Restart
npm run dev
```

## Verification
After restart, verify routes are registered:
```bash
curl -s http://localhost:3013/api/docs-json | jq '.paths | keys[]' | grep "revenue-cycle" | grep -E "approve|reject|review|notifications"
```

Should show all 8 missing routes.

## Test Script
Once routes are registered, run:
```bash
bash scripts/test-sprint43-all-endpoints.sh
```

All 13 endpoints should return their expected status codes (201 for POST, 200 for PUT/GET).


