# Sprint 43: Frontend-Backend API Connections

**Status**: ✅ **FULLY CONNECTED**

All frontend components are properly wired to the backend APIs with correct endpoints, headers, and payloads.

---

## API Connections Summary

### 1. **AddChargeModal Component**

#### API Calls:
- ✅ `GET /revenue-cycle/charge-master` - Load charge master items
- ✅ `GET /patients` - Load patients list (if not pre-filled)
- ✅ `GET /admissions/patient/:patientId` - Load active admissions
- ✅ `POST /revenue-cycle/charges` - Create new charge

#### Request Headers:
```typescript
headers: { 
  'X-Tenant-ID': tenantSlug, 
  'Authorization': `Bearer ${token}` 
}
```

#### Payload Structure:
```typescript
{
  patientId: string,
  admissionId: string | null,
  chargeCode: string,
  chargeDescription: string,
  quantity: number,
  unitPrice: number,
  serviceDate: string,
  department: string,
  cptCode: string | null,
  icd10Code: string | null,
  orderingProviderId: string,
  chargeStatus: 'pending',
  captureMethod: 'manual',
  notes: string | null
}
```

---

### 2. **ChargeReviewModal Component**

#### API Calls:
- ✅ `GET /revenue-cycle/charges/review/admission/:admissionId` - Get charges for admission
- ✅ `GET /revenue-cycle/charges/patient/:patientId` - Get charges for patient
- ✅ `GET /revenue-cycle/charges/pending-review?doctorId=:id` - Get pending charges for doctor
- ✅ `PUT /revenue-cycle/charges/:id/mark-reviewed` - Mark charge as reviewed
- ✅ `PUT /revenue-cycle/charges/:id/approve` - Approve charge
- ✅ `PUT /revenue-cycle/charges/:id/reject` - Reject charge
- ✅ `PUT /revenue-cycle/charges/admission/:admissionId/approve-all` - Bulk approve

#### Request Headers:
```typescript
headers: { 
  'X-Tenant-ID': tenantSlug, 
  'Authorization': `Bearer ${token}` 
}
```

#### Payload Examples:

**Review/Approve:**
```typescript
{ notes: string | null }
```

**Reject:**
```typescript
{ reason: string }
```

**Bulk Approve:**
```typescript
{ notes: string | null }
```

---

### 3. **RevenueCycleDashboard Component**

#### API Calls:
- ✅ `GET /revenue-cycle/charge-master?department=:dept` - Load charge master (filtered)
- ✅ `GET /revenue-cycle/charges/pending-review?doctorId=:id` - Load pending charges

#### Request Headers:
```typescript
headers: { 
  'X-Tenant-ID': tenantSlug, 
  'Authorization': `Bearer ${token}` 
}
```

---

## Complete API Endpoint Mapping

| Frontend Action | Backend Endpoint | Method | Status |
|----------------|------------------|--------|--------|
| Load charge master | `/revenue-cycle/charge-master` | GET | ✅ Connected |
| Load patients | `/patients` | GET | ✅ Connected |
| Load admissions | `/admissions/patient/:id` | GET | ✅ Connected |
| Create charge | `/revenue-cycle/charges` | POST | ✅ Connected |
| Get pending charges | `/revenue-cycle/charges/pending-review` | GET | ✅ Connected |
| Get admission charges | `/revenue-cycle/charges/review/admission/:id` | GET | ✅ Connected |
| Get patient charges | `/revenue-cycle/charges/patient/:id` | GET | ✅ Connected |
| Review charge | `/revenue-cycle/charges/:id/mark-reviewed` | PUT | ✅ Connected |
| Approve charge | `/revenue-cycle/charges/:id/approve` | PUT | ✅ Connected |
| Reject charge | `/revenue-cycle/charges/:id/reject` | PUT | ✅ Connected |
| Bulk approve | `/revenue-cycle/charges/admission/:id/approve-all` | PUT | ✅ Connected |

---

## Authentication & Authorization

All API calls include:
- ✅ **Tenant ID**: `X-Tenant-ID` header
- ✅ **JWT Token**: `Authorization: Bearer <token>` header
- ✅ **User Context**: Current user ID from localStorage

---

## Error Handling

All components include:
- ✅ Try-catch blocks for API calls
- ✅ Error notifications via `useNotification` hook
- ✅ Loading states during API calls
- ✅ Graceful fallbacks for missing data

---

## Response Handling

### AddChargeModal:
- ✅ Success: Shows success notification, closes modal, refreshes pending charges
- ✅ Error: Shows error notification with message

### ChargeReviewModal:
- ✅ Success: Shows success notification, refreshes charge list
- ✅ Error: Shows error notification with message
- ✅ Handles different response structures (with/without `charges` wrapper)

### RevenueCycleDashboard:
- ✅ Success: Updates charge master and pending charges lists
- ✅ Error: Shows error notification, maintains existing data

---

## Data Flow

### Adding a Charge:
```
User fills form → handleSubmit() → POST /revenue-cycle/charges 
→ Backend creates charge → Success notification → Modal closes 
→ loadPendingCharges() → GET /revenue-cycle/charges/pending-review 
→ Dashboard updates
```

### Reviewing Charges:
```
User opens modal → loadCharges() → GET /revenue-cycle/charges/pending-review 
→ Display charges → User clicks action → PUT /revenue-cycle/charges/:id/:action 
→ Backend updates → Success notification → loadCharges() → List refreshes
```

### Bulk Approval:
```
User clicks "Approve All" → PUT /revenue-cycle/charges/admission/:id/approve-all 
→ Backend approves all → Success notification → loadCharges() → List refreshes
```

---

## Status: ✅ **FULLY INTEGRATED**

All frontend components are:
- ✅ Connected to correct backend endpoints
- ✅ Using proper authentication headers
- ✅ Sending correct payload structures
- ✅ Handling responses appropriately
- ✅ Showing proper error messages
- ✅ Updating UI on success

**Ready for end-to-end testing!**


