# Sprint 43: Revenue Cycle Workflow - Summary

**Date**: December 5, 2025  
**Status**: Planning Complete, Ready for Implementation

---

## ✅ Completed

### 1. Database Provisioning
- ✅ **Migration 028 Applied** - Revenue Cycle Approval Workflow
  - Added `reviewed_by`, `reviewed_at` columns
  - Added `approved_by`, `approved_at` columns
  - Added `approval_notes`, `rejection_reason` columns
  - Updated `charge_status` constraint to include 'approved' and 'rejected'
  - Created `charge_approval_notifications` table
  - Created indexes for approval queries

### 2. Specialist Module Analysis
Analyzed all specialist modules for charge capture workflows:

**Cardiology Dashboard:**
- ✅ Tracks `payment_status` and `finance_transaction_id`
- ✅ Shows finance summary (revenue, outstanding fees)
- ❌ **Missing:** UI to add charges for cath lab procedures
- ❌ **Missing:** UI to notify finance when procedure completed

**Oncology Dashboard:**
- ✅ Tracks `financeSummary` with awaiting payment sessions
- ❌ **Missing:** UI to add charges for infusion sessions
- ❌ **Missing:** UI to notify finance when infusion completed

**Ophthalmology Dashboard:**
- ✅ Tracks `payment_status` and `finance_transaction_id`
- ❌ **Missing:** UI to add charges for procedures
- ❌ **Missing:** UI to notify finance when procedure completed

**Operating Room Dashboard:**
- ✅ Tracks surgical cases
- ❌ **Missing:** UI to add charges for surgery
- ❌ **Missing:** UI to notify finance when surgery completed

**Lab Dashboard:**
- ✅ Tracks `payment_status` for lab orders
- ❌ **Missing:** UI to add charges when lab order completed
- ❌ **Missing:** UI to notify finance

**Conclusion:** All specialist modules track payment status but **none have UI for doctors to add charges or notify finance**.

---

## 📋 Sprint 43 Scope

### Core Features
1. **Add Charge Functionality**
   - Doctor can add charges to patients
   - Search/select patient
   - Search/select charge from master
   - Enter quantity
   - Link to admission

2. **Charge Review Screen**
   - View all charges for patient/admission
   - Filter by patient, admission, status, date
   - Show charge details and totals
   - Approve/reject buttons

3. **Approval Workflow**
   - Approve individual charges
   - Reject charges with reason
   - Bulk approve for admission
   - Add review notes

4. **Discharge Integration**
   - Charge review required before discharge
   - Show pending charges in discharge modal
   - Block discharge until charges reviewed
   - Charge summary display

5. **Accounts Notification**
   - Notify accounts when charges approved
   - Show notifications in Accounts Dashboard
   - Link to create invoice
   - Mark notifications as read

6. **Specialist Module Integration**
   - Add charge capture to Cardiology Dashboard
   - Add charge capture to Oncology Dashboard
   - Add charge capture to Ophthalmology Dashboard
   - Add charge capture to OR Dashboard
   - Auto-capture for Lab Dashboard (if configured)

---

## 🎯 Real-World Workflow (After Implementation)

### Scenario: Doctor Performs Appendectomy

**Step 1: During Surgery**
- Doctor performs appendectomy in OR Dashboard
- System auto-captures: `SURG-APPENDECTOMY` ($2,500)
- System auto-captures: `ANES-GENERAL` ($800)
- System auto-captures: `INPT-OR-TIME` ($800/hour)

**Step 2: After Surgery (If Auto-Capture Failed)**
- Doctor goes to Revenue Cycle Dashboard
- Clicks "Add Charge" button
- Selects patient from list
- Searches charge master for "Appendectomy"
- Selects `SURG-APPENDECTOMY`
- Adds quantity: 1
- Saves → Charge added with status "pending"

**Step 3: Before Discharge**
- Doctor initiates discharge in Bed Management Dashboard
- System shows "Charge Review Required" modal
- Lists all charges for admission:
  - ✅ Surgery: Appendectomy - $2,500 (pending)
  - ✅ Anesthesia: General - $800 (pending)
  - ✅ OR Time: 2 hours - $1,600 (pending)
  - ✅ Room Charge: 3 days - $1,500 (pending)
- Doctor reviews each charge
- Doctor clicks "Approve All" or approves individually
- Charges status changes to "approved"
- System notifies Accounts Department
- Discharge can proceed

**Step 4: After Discharge**
- Accounts Department receives notification
- Accounts opens patient in Billing Dashboard
- Sees approved charges for discharged patient
- Creates invoice from approved charges
- Sends bill to patient/insurance

---

## 📊 Implementation Plan

### Phase 1: Core Charge Management (Days 1-3)
- Add Charge Modal
- Charge Review Screen
- Revenue Cycle Dashboard Updates

### Phase 2: Approval Workflow (Days 4-5)
- Approve/Reject Functionality
- Bulk Approval
- Backend API Endpoints

### Phase 3: Discharge Integration (Days 6-7)
- Discharge Charge Review
- Charge Summary
- Block discharge until reviewed

### Phase 4: Accounts Notification (Days 8-9)
- Notification System
- Accounts Dashboard Integration
- Backend Notification Endpoints

### Phase 5: Specialist Module Integration (Days 10-12)
- Cardiology Dashboard integration
- Oncology Dashboard integration
- Ophthalmology Dashboard integration
- OR Dashboard integration
- Lab Dashboard integration

**Total Estimated Duration:** 11-14 days (2-3 weeks)

---

## 🔧 Technical Requirements

### Backend APIs Needed
- ✅ `POST /revenue-cycle/charges` (existing)
- ✅ `GET /revenue-cycle/charges/patient/:patientId` (existing)
- ✅ `GET /revenue-cycle/charges/review/admission/:admissionId` (existing)
- ⏳ `PUT /revenue-cycle/charges/:id/approve` (new)
- ⏳ `PUT /revenue-cycle/charges/:id/reject` (new)
- ⏳ `PUT /revenue-cycle/charges/admission/:admissionId/approve-all` (new)
- ⏳ `GET /revenue-cycle/charges/pending-review` (new)
- ⏳ `POST /revenue-cycle/charges/notify-accounts/:admissionId` (new)
- ⏳ `GET /revenue-cycle/notifications` (new)
- ⏳ `PUT /revenue-cycle/notifications/:id/read` (new)

### Frontend Components Needed
- ⏳ `AddChargeModal.tsx`
- ⏳ `ChargeReviewModal.tsx`
- ⏳ `ChargeApprovalModal.tsx`
- ⏳ `ChargeList.tsx`
- ⏳ `ChargeSummaryCard.tsx`
- ⏳ `DischargeChargeReview.tsx`

### Modified Components
- ⏳ `RevenueCycleDashboard.tsx` - Add tabs
- ⏳ `BedManagementDashboard.tsx` - Add charge review
- ⏳ `CardiologyDashboard.tsx` - Add charge capture
- ⏳ `OncologyDashboard.tsx` - Add charge capture
- ⏳ `OphthalmologyDashboard.tsx` - Add charge capture
- ⏳ `ORDashboard.tsx` - Add charge capture
- ⏳ `AccountsDashboard.tsx` - Show notifications

---

## 📄 Documentation

- ✅ **Sprint 43 Document:** `docs/SPRINT_43_REVENUE_CYCLE_WORKFLOW.md`
  - Complete sprint plan
  - User stories
  - Technical requirements
  - Implementation phases
  - Testing requirements
  - Success criteria

- ✅ **Workflow Missing Document:** `docs/REVENUE_CYCLE_WORKFLOW_MISSING.md`
  - Current state analysis
  - Missing features
  - Workflow gaps

- ✅ **This Summary:** `docs/SPRINT_43_SUMMARY.md`

---

## ✅ Next Steps

1. **Review Sprint 43 Document** - `docs/SPRINT_43_REVENUE_CYCLE_WORKFLOW.md`
2. **Assign Development Tasks** - Break down into tickets
3. **Start Phase 1** - Core Charge Management
4. **Iterate Through Phases** - Follow implementation plan
5. **Test & Deploy** - Complete testing before production

---

## 🎉 Success Criteria

When Sprint 43 is complete:
- ✅ Doctors can add charges to patients
- ✅ Doctors can review charges for patients/admissions
- ✅ Doctors can approve/reject charges
- ✅ Charge review is required before discharge
- ✅ Accounts department receives notifications when charges approved
- ✅ Accounts can create invoices from approved charges
- ✅ Specialist modules have charge capture buttons
- ✅ All charges are tracked and auditable

---

*Last Updated: December 5, 2025*


