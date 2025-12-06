# Sprint 43: Revenue Cycle Workflow - Doctor Charge Capture & Approval

**Sprint Date**: December 5, 2025  
**Status**: Planning  
**Priority**: High  
**Estimated Duration**: 1-2 weeks

---

## Overview

This sprint implements the complete revenue cycle workflow for doctors, enabling them to capture charges, review patient charges, approve charges before discharge, and notify the accounts department. This addresses the critical gap where doctors currently have no UI to add charges or manage the charge approval workflow.

---

## Problem Statement

Currently, the system has:
- ✅ Backend APIs for charge capture (`POST /revenue-cycle/charges`)
- ✅ Charge master with billable services
- ✅ Database schema for patient charges
- ❌ **No UI for doctors to add charges to patients**
- ❌ **No UI for doctors to review patient charges**
- ❌ **No approval workflow for charges**
- ❌ **No integration with discharge workflow**
- ❌ **No notification system for accounts department**

**Real-world scenario that fails:**
1. Doctor performs appendectomy
2. System should auto-capture charges (surgery, anesthesia, OR time)
3. If auto-capture fails, doctor has **no way to add charges**
4. Before discharge, doctor should review charges
5. Doctor should approve charges
6. Accounts should be notified to create invoice
7. **Currently, none of steps 3-6 are possible**

---

## Current State Analysis

### Specialist Modules Payment Tracking

**Cardiology Dashboard:**
- ✅ Tracks `payment_status` and `finance_transaction_id`
- ✅ Shows finance summary (revenue captured, outstanding fees)
- ❌ **No UI to add charges for cath lab procedures**
- ❌ **No UI to notify finance when procedure completed**

**Oncology Dashboard:**
- ✅ Tracks `financeSummary` with awaiting payment sessions
- ❌ **No UI to add charges for infusion sessions**
- ❌ **No UI to notify finance when infusion completed**

**Ophthalmology Dashboard:**
- ✅ Tracks `payment_status` and `finance_transaction_id`
- ❌ **No UI to add charges for procedures**
- ❌ **No UI to notify finance when procedure completed**

**Lab Dashboard:**
- ✅ Tracks `payment_status` for lab orders
- ❌ **No UI to add charges when lab order completed**
- ❌ **No UI to notify finance**

**Operating Room Dashboard:**
- ✅ Tracks surgical cases
- ❌ **No UI to add charges for surgery**
- ❌ **No UI to notify finance when surgery completed**

**Conclusion:** All specialist modules track payment status but **none have UI for doctors to add charges or notify finance**.

---

## Sprint Goals

1. **Add Charge Functionality** - Doctors can add charges to patients
2. **Charge Review Screen** - Doctors can view and manage patient charges
3. **Approval Workflow** - Doctors can approve/reject charges
4. **Discharge Integration** - Charge review required before discharge
5. **Accounts Notification** - Accounts notified when charges approved
6. **Specialist Module Integration** - Add charge capture to specialist workflows

---

## User Stories

### Story 1: Add Charge to Patient
**As a** doctor  
**I want to** add a charge to a patient's record  
**So that** I can capture billable services that weren't auto-captured

**Acceptance Criteria:**
- [ ] Doctor can access "Add Charge" from Revenue Cycle Dashboard
- [ ] Doctor can search/select patient
- [ ] Doctor can search/select charge from charge master
- [ ] Doctor can enter quantity
- [ ] Doctor can link charge to admission (if patient is admitted)
- [ ] Charge is saved with status "pending"
- [ ] Charge appears in patient's charge list

### Story 2: Review Patient Charges
**As a** doctor  
**I want to** review all charges for my patients  
**So that** I can verify charges are correct before billing

**Acceptance Criteria:**
- [ ] Doctor can view all charges for a patient
- [ ] Charges can be filtered by:
  - Patient
  - Admission
  - Status (pending, reviewed, approved)
  - Date range
- [ ] Doctor can see charge details (code, description, quantity, price, total)
- [ ] Doctor can see charge status
- [ ] Doctor can see who captured the charge and when

### Story 3: Approve/Reject Charges
**As a** doctor  
**I want to** approve or reject charges  
**So that** only verified charges are sent to accounts

**Acceptance Criteria:**
- [ ] Doctor can approve individual charges
- [ ] Doctor can reject charges with reason
- [ ] Doctor can bulk approve all charges for an admission
- [ ] Doctor can add review notes
- [ ] Charge status updates to "approved" or "rejected"
- [ ] Approved charges are ready for billing

### Story 4: Charge Review Before Discharge
**As a** doctor  
**I want to** review charges before discharging a patient  
**So that** all charges are captured and approved before billing

**Acceptance Criteria:**
- [ ] When doctor initiates discharge, charge review modal appears
- [ ] Modal shows all pending charges for admission
- [ ] Doctor must review charges before discharge can proceed
- [ ] Doctor can approve/reject charges from discharge modal
- [ ] Discharge is blocked until charges are reviewed
- [ ] Charge summary is shown in discharge workflow

### Story 5: Notify Accounts Department
**As a** system  
**I want to** notify accounts when charges are approved  
**So that** accounts can create invoices promptly

**Acceptance Criteria:**
- [ ] When charges are approved, notification is created
- [ ] Notification appears in Accounts Dashboard
- [ ] Notification shows patient, admission, charge count, total amount
- [ ] Accounts can click notification to view approved charges
- [ ] Accounts can create invoice from approved charges
- [ ] Notification status updates when read/processed

### Story 6: Specialist Module Charge Capture
**As a** doctor in a specialist module  
**I want to** add charges when completing procedures  
**So that** charges are captured immediately

**Acceptance Criteria:**
- [ ] Cardiology: Add charge button when completing cath lab procedure
- [ ] Oncology: Add charge button when completing infusion session
- [ ] Ophthalmology: Add charge button when completing procedure
- [ ] OR: Add charge button when completing surgery
- [ ] Lab: Auto-capture charge when lab order completed (if configured)
- [ ] Charge is linked to procedure/session

---

## Technical Requirements

### Database Changes

**Migration 028** (Already Applied):
- ✅ Added `reviewed_by`, `reviewed_at` to `patient_charges`
- ✅ Added `approved_by`, `approved_at` to `patient_charges`
- ✅ Added `approval_notes`, `rejection_reason` to `patient_charges`
- ✅ Updated `charge_status` to include 'approved' and 'rejected'
- ✅ Created `charge_approval_notifications` table

### Backend API Endpoints

**Existing (No Changes Needed):**
- ✅ `POST /revenue-cycle/charges` - Add charge
- ✅ `GET /revenue-cycle/charges/patient/:patientId` - Get patient charges
- ✅ `GET /revenue-cycle/charges/review/admission/:admissionId` - Review charges

**New Endpoints Required:**
- [ ] `PUT /revenue-cycle/charges/:id/approve` - Approve charge
- [ ] `PUT /revenue-cycle/charges/:id/reject` - Reject charge
- [ ] `PUT /revenue-cycle/charges/admission/:admissionId/approve-all` - Bulk approve
- [ ] `POST /revenue-cycle/charges/:id/notes` - Add review notes
- [ ] `GET /revenue-cycle/charges/pending-review` - Get pending charges for doctor
- [ ] `POST /revenue-cycle/charges/notify-accounts/:admissionId` - Notify accounts
- [ ] `GET /revenue-cycle/notifications` - Get notifications for accounts
- [ ] `PUT /revenue-cycle/notifications/:id/read` - Mark notification as read

### Frontend Components

**New Components:**
- [ ] `AddChargeModal.tsx` - Form to add charge to patient
- [ ] `ChargeReviewModal.tsx` - Review charges for patient/admission
- [ ] `ChargeApprovalModal.tsx` - Approve/reject charges
- [ ] `ChargeList.tsx` - Display list of charges
- [ ] `ChargeSummaryCard.tsx` - Show charge totals
- [ ] `DischargeChargeReview.tsx` - Charge review in discharge workflow

**Modified Components:**
- [ ] `RevenueCycleDashboard.tsx` - Add tabs for charge management
- [ ] `BedManagementDashboard.tsx` - Add charge review to discharge workflow
- [ ] `CardiologyDashboard.tsx` - Add charge capture button
- [ ] `OncologyDashboard.tsx` - Add charge capture button
- [ ] `OphthalmologyDashboard.tsx` - Add charge capture button
- [ ] `ORDashboard.tsx` - Add charge capture button
- [ ] `AccountsDashboard.tsx` - Show charge approval notifications

### Service Methods

**RevenueCycleService:**
- [ ] `approveCharge(chargeId, userId, notes)` - Approve charge
- [ ] `rejectCharge(chargeId, userId, reason)` - Reject charge
- [ ] `approveAllChargesForAdmission(admissionId, userId)` - Bulk approve
- [ ] `getPendingChargesForDoctor(doctorId)` - Get pending charges
- [ ] `notifyAccounts(admissionId, userId)` - Create notification
- [ ] `getChargeNotifications(accountUserId)` - Get notifications
- [ ] `markNotificationRead(notificationId, userId)` - Mark as read

---

## Implementation Plan

### Phase 1: Core Charge Management (Days 1-3)

1. **Add Charge Modal**
   - Create `AddChargeModal.tsx`
   - Patient search/selection
   - Charge master search/selection
   - Quantity input
   - Admission linking
   - Save to backend

2. **Charge Review Screen**
   - Create `ChargeReviewModal.tsx`
   - Display charges for patient/admission
   - Filtering and sorting
   - Charge details display

3. **Revenue Cycle Dashboard Updates**
   - Add tabs: "Charge Master", "Add Charge", "My Patient Charges", "Pending Review"
   - Integrate Add Charge Modal
   - Integrate Charge Review Modal

### Phase 2: Approval Workflow (Days 4-5)

1. **Approve/Reject Functionality**
   - Create `ChargeApprovalModal.tsx`
   - Approve individual charges
   - Reject with reason
   - Add review notes
   - Update charge status

2. **Bulk Approval**
   - Add "Approve All" button
   - Bulk approve for admission
   - Confirmation modal

3. **Backend API Endpoints**
   - Implement approve/reject endpoints
   - Update charge status
   - Store approval metadata

### Phase 3: Discharge Integration (Days 6-7)

1. **Discharge Charge Review**
   - Create `DischargeChargeReview.tsx`
   - Integrate into discharge workflow
   - Show pending charges
   - Require review before discharge
   - Block discharge if charges not reviewed

2. **Charge Summary**
   - Display charge totals
   - Show charge breakdown
   - Highlight pending charges

### Phase 4: Accounts Notification (Days 8-9)

1. **Notification System**
   - Create notification when charges approved
   - Store in `charge_approval_notifications` table
   - Link to admission and patient

2. **Accounts Dashboard Integration**
   - Show notifications in Accounts Dashboard
   - Display charge summary
   - Link to create invoice
   - Mark notifications as read

3. **Backend Notification Endpoints**
   - Create notification on approval
   - Get notifications for accounts
   - Mark as read

### Phase 5: Specialist Module Integration (Days 10-12)

1. **Cardiology Dashboard**
   - Add "Add Charge" button when completing cath lab procedure
   - Link charge to encounter
   - Auto-populate charge from procedure type

2. **Oncology Dashboard**
   - Add "Add Charge" button when completing infusion session
   - Link charge to infusion session
   - Auto-populate charge from regimen

3. **Ophthalmology Dashboard**
   - Add "Add Charge" button when completing procedure
   - Link charge to encounter
   - Auto-populate charge from procedure type

4. **Operating Room Dashboard**
   - Add "Add Charge" button when completing surgery
   - Link charge to surgical case
   - Auto-populate charge from procedure

5. **Lab Dashboard**
   - Auto-capture charge when lab order completed (if configured)
   - Link charge to lab order
   - Auto-populate charge from test

---

## Database Schema

### patient_charges (Updated)
```sql
-- New columns added in Migration 028:
reviewed_by UUID REFERENCES users(id)
reviewed_at TIMESTAMP WITH TIME ZONE
approved_by UUID REFERENCES users(id)
approved_at TIMESTAMP WITH TIME ZONE
approval_notes TEXT
rejection_reason TEXT

-- Updated charge_status:
charge_status VARCHAR(50) CHECK (charge_status IN 
  ('pending', 'reviewed', 'approved', 'rejected', 'billed', 'paid', 'adjusted', 'written_off'))
```

### charge_approval_notifications (New)
```sql
CREATE TABLE charge_approval_notifications (
  id UUID PRIMARY KEY,
  admission_id UUID REFERENCES admissions(id),
  patient_id UUID NOT NULL REFERENCES patients(id),
  notification_type VARCHAR(50) DEFAULT 'charge_approved',
  notification_status VARCHAR(50) DEFAULT 'unread',
  total_charges_count INTEGER DEFAULT 0,
  total_charges_amount DECIMAL(10, 2) DEFAULT 0,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  read_by UUID REFERENCES users(id),
  read_at TIMESTAMP WITH TIME ZONE,
  notes TEXT,
  metadata JSONB DEFAULT '{}'::jsonb
);
```

---

## API Specifications

### Approve Charge
```typescript
PUT /api/revenue-cycle/charges/:id/approve
Body: {
  notes?: string
}
Response: {
  id: string,
  charge_status: 'approved',
  approved_by: string,
  approved_at: string
}
```

### Reject Charge
```typescript
PUT /api/revenue-cycle/charges/:id/reject
Body: {
  reason: string
}
Response: {
  id: string,
  charge_status: 'rejected',
  rejection_reason: string
}
```

### Bulk Approve
```typescript
PUT /api/revenue-cycle/charges/admission/:admissionId/approve-all
Body: {
  notes?: string
}
Response: {
  approved_count: number,
  charges: PatientCharge[]
}
```

### Get Pending Charges
```typescript
GET /api/revenue-cycle/charges/pending-review?doctorId=xxx
Response: {
  charges: PatientCharge[],
  total: number
}
```

### Notify Accounts
```typescript
POST /api/revenue-cycle/charges/notify-accounts/:admissionId
Response: {
  notification_id: string,
  message: string
}
```

### Get Notifications
```typescript
GET /api/revenue-cycle/notifications?status=unread
Response: {
  notifications: ChargeApprovalNotification[],
  total: number
}
```

---

## UI/UX Design

### Revenue Cycle Dashboard Tabs

**Tab 1: Charge Master** (Existing)
- View available charges
- Filter by department
- View pricing

**Tab 2: Add Charge** (New)
- Patient search/select
- Charge master search/select
- Quantity input
- Admission linking
- Save button

**Tab 3: My Patient Charges** (New)
- List of charges for doctor's patients
- Filter by patient, admission, status, date
- View charge details
- Approve/reject buttons
- Bulk actions

**Tab 4: Pending Review** (New)
- Charges awaiting approval
- Group by patient/admission
- Quick approve/reject
- Charge summary

### Discharge Workflow Integration

**Discharge Modal Steps:**
1. Patient Information
2. Discharge Details
3. **Charge Review** (New - Required)
   - List all pending charges
   - Show totals
   - Approve/reject buttons
   - Notes field
4. Discharge Summary
5. Confirm Discharge

### Specialist Module Integration

**Cardiology Dashboard:**
- When completing cath lab procedure:
  - Show "Add Charge" button
  - Modal with pre-filled procedure charge
  - Link to encounter

**Oncology Dashboard:**
- When completing infusion session:
  - Show "Add Charge" button
  - Modal with pre-filled infusion charge
  - Link to session

**Ophthalmology Dashboard:**
- When completing procedure:
  - Show "Add Charge" button
  - Modal with pre-filled procedure charge
  - Link to encounter

**Operating Room Dashboard:**
- When completing surgery:
  - Show "Add Charge" button
  - Modal with pre-filled surgical charge
  - Link to surgical case

---

## Testing Requirements

### Unit Tests
- [ ] Charge approval service methods
- [ ] Charge rejection service methods
- [ ] Bulk approval logic
- [ ] Notification creation
- [ ] Charge status updates

### Integration Tests
- [ ] Add charge workflow
- [ ] Charge review workflow
- [ ] Approval workflow
- [ ] Discharge integration
- [ ] Accounts notification

### E2E Tests
- [ ] Doctor adds charge to patient
- [ ] Doctor reviews charges before discharge
- [ ] Doctor approves charges
- [ ] Accounts receives notification
- [ ] Accounts creates invoice from approved charges

### Manual Testing Scenarios
1. **Appendectomy Workflow:**
   - Doctor performs surgery
   - Doctor adds charges (surgery, anesthesia, OR time)
   - Doctor reviews charges before discharge
   - Doctor approves charges
   - Accounts receives notification
   - Accounts creates invoice

2. **Cath Lab Workflow:**
   - Doctor completes cath lab procedure
   - Doctor adds charge from Cardiology Dashboard
   - Charge appears in Revenue Cycle Dashboard
   - Doctor reviews and approves
   - Accounts notified

3. **Infusion Session Workflow:**
   - Doctor completes infusion session
   - Doctor adds charge from Oncology Dashboard
   - Charge appears in Revenue Cycle Dashboard
   - Doctor reviews and approves
   - Accounts notified

---

## Success Criteria

1. ✅ Doctors can add charges to patients
2. ✅ Doctors can review charges for patients/admissions
3. ✅ Doctors can approve/reject charges
4. ✅ Charge review is required before discharge
5. ✅ Accounts department receives notifications when charges approved
6. ✅ Accounts can create invoices from approved charges
7. ✅ Specialist modules have charge capture buttons
8. ✅ All charges are tracked and auditable

---

## Dependencies

- ✅ Database migration 028 (already applied)
- ✅ Charge master populated
- ✅ Revenue Cycle backend APIs (existing)
- ⏳ Frontend components (to be built)
- ⏳ Backend approval endpoints (to be built)
- ⏳ Notification system (to be built)

---

## Risks & Mitigation

**Risk 1: Doctors forget to add charges**
- **Mitigation:** Auto-capture where possible, reminders in discharge workflow

**Risk 2: Charge review delays discharge**
- **Mitigation:** Quick approve/reject buttons, bulk approval, clear UI

**Risk 3: Accounts overwhelmed with notifications**
- **Mitigation:** Group notifications by admission, batch processing

**Risk 4: Charge data inconsistency**
- **Mitigation:** Validation rules, audit trail, status tracking

---

## Future Enhancements

1. **Auto-Capture Rules:**
   - Configure auto-capture for common procedures
   - Link procedures to charge codes
   - Automatic charge creation

2. **Charge Templates:**
   - Pre-configured charge sets for common procedures
   - Quick add multiple charges

3. **Charge Analytics:**
   - Revenue by department
   - Charge capture rate
   - Approval time metrics

4. **Mobile Support:**
   - Add charges from mobile
   - Quick approval on mobile

---

## Documentation

- [ ] API documentation for new endpoints
- [ ] User guide for doctors
- [ ] User guide for accounts
- [ ] Charge capture workflow diagram
- [ ] Approval workflow diagram

---

## Sprint Checklist

### Backend
- [ ] Create approve charge endpoint
- [ ] Create reject charge endpoint
- [ ] Create bulk approve endpoint
- [ ] Create get pending charges endpoint
- [ ] Create notify accounts endpoint
- [ ] Create get notifications endpoint
- [ ] Create mark notification read endpoint
- [ ] Update RevenueCycleService with approval methods
- [ ] Add notification service methods
- [ ] Write unit tests
- [ ] Write integration tests

### Frontend
- [ ] Create AddChargeModal component
- [ ] Create ChargeReviewModal component
- [ ] Create ChargeApprovalModal component
- [ ] Create ChargeList component
- [ ] Create ChargeSummaryCard component
- [ ] Create DischargeChargeReview component
- [ ] Update RevenueCycleDashboard with tabs
- [ ] Integrate charge review into discharge workflow
- [ ] Add charge capture to Cardiology Dashboard
- [ ] Add charge capture to Oncology Dashboard
- [ ] Add charge capture to Ophthalmology Dashboard
- [ ] Add charge capture to OR Dashboard
- [ ] Update Accounts Dashboard with notifications
- [ ] Write component tests
- [ ] Write E2E tests

### Database
- [x] Migration 028 applied
- [x] charge_approval_notifications table created
- [ ] Verify indexes created
- [ ] Verify constraints added

### Testing
- [ ] Unit tests passing
- [ ] Integration tests passing
- [ ] E2E tests passing
- [ ] Manual testing completed
- [ ] User acceptance testing

### Documentation
- [ ] API documentation updated
- [ ] User guides created
- [ ] Workflow diagrams created
- [ ] Sprint summary document

---

## Estimated Effort

- **Backend Development:** 3-4 days
- **Frontend Development:** 5-6 days
- **Testing:** 2-3 days
- **Documentation:** 1 day
- **Total:** 11-14 days (2-3 weeks)

---

## Notes

- This sprint addresses a critical gap in the revenue cycle workflow
- The approval workflow ensures charges are verified before billing
- Integration with discharge workflow prevents lost revenue
- Specialist module integration ensures charges are captured at point of service
- Notification system ensures accounts department is promptly notified

---

*Last Updated: December 5, 2025*


