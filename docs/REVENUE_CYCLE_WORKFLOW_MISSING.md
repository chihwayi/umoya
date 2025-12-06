# Revenue Cycle Workflow - What's Missing

## Current State vs. Required Workflow

### ✅ **What EXISTS (Backend APIs)**

1. **Charge Master** - List of billable services ✅
   - `GET /revenue-cycle/charge-master` - View available charges
   - `POST /revenue-cycle/charge-master` - Create new charge items

2. **Patient Charges** - Capture charges ✅
   - `POST /revenue-cycle/charges` - Add charge to patient
   - `GET /revenue-cycle/charges/patient/:patientId` - Get patient charges
   - `GET /revenue-cycle/charges/review/admission/:admissionId` - Review charges for admission

3. **Billing** - Create invoices ✅
   - `POST /billing/bills` - Create bill from charges
   - `GET /billing/bills` - View bills

### ❌ **What's MISSING (Frontend UI & Workflow)**

## Missing Features

### 1. **Add Charge to Patient** ❌
**Current**: Doctor can only VIEW charge master, cannot add charges to patients
**Needed**: 
- Modal/form to add charge to a specific patient
- Select patient → Select charge from master → Add quantity → Save
- Should link to admission if patient is admitted

### 2. **Review Charges for Patient/Admission** ❌
**Current**: No UI to review charges for a specific patient
**Needed**:
- View all charges for a patient
- Filter by admission
- Show charge status (pending, reviewed, approved)
- Show total charges

### 3. **Approve Charges** ❌
**Current**: No approval workflow
**Needed**:
- Doctor can approve/reject individual charges
- Bulk approve all charges for an admission
- Add notes/comments on charges
- Update charge status to "reviewed" or "approved"

### 4. **Charge Review Before Discharge** ❌
**Current**: Discharge workflow doesn't include charge review
**Needed**:
- When doctor initiates discharge, show charge review screen
- List all pending charges
- Doctor must review/approve before discharge can proceed
- Integration with discharge workflow

### 5. **Notify Accounts Department** ❌
**Current**: No notification system
**Needed**:
- When charges are approved, notify accounts department
- Show approved charges in accounts dashboard
- Accounts can create invoice from approved charges
- Status tracking: pending → reviewed → approved → billed

### 6. **Auto-Capture Integration** ❌
**Current**: No auto-capture from procedures
**Needed**:
- When doctor completes surgery → auto-capture surgical charge
- When lab order is completed → auto-capture lab charge
- When imaging is completed → auto-capture imaging charge
- Doctor can review and adjust auto-captured charges

---

## Complete Workflow (What Should Happen)

### **Scenario: Doctor Performs Appendectomy**

#### **Step 1: During Surgery**
- Doctor performs appendectomy in OR Dashboard
- System should auto-capture: `SURG-APPENDECTOMY` ($2,500)
- System should auto-capture: `ANES-GENERAL` ($800)
- System should auto-capture: `INPT-OR-TIME` ($800/hour)

#### **Step 2: After Surgery (If Auto-Capture Failed)**
- Doctor goes to Revenue Cycle Dashboard
- Clicks "Add Charge" button
- Selects patient from list (or from current admission)
- Searches charge master for "Appendectomy"
- Selects `SURG-APPENDECTOMY`
- Adds quantity: 1
- Saves → Charge added with status "pending"

#### **Step 3: Before Discharge**
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

#### **Step 4: After Discharge**
- Accounts Department receives notification
- Accounts opens patient in Billing Dashboard
- Sees approved charges for discharged patient
- Creates invoice from approved charges
- Sends bill to patient/insurance

---

## Where Should These Features Be?

### **Option 1: Revenue Cycle Dashboard (Recommended)**
Add tabs/sections:
- **Tab 1: Charge Master** (current - view available charges)
- **Tab 2: My Patient Charges** (NEW - charges for doctor's patients)
- **Tab 3: Pending Review** (NEW - charges awaiting approval)
- **Tab 4: Add Charge** (NEW - form to add charge to patient)

### **Option 2: Patient Detail Page**
Add "Charges" tab to patient detail:
- View all charges for patient
- Add new charge
- Approve/reject charges
- Link to admission charges

### **Option 3: Discharge Workflow Integration**
When discharging:
- Show charge review modal
- List all charges
- Require approval before discharge
- Auto-notify accounts

### **Option 4: Doctor Dashboard Integration**
Add widget/card:
- "Pending Charge Reviews" (count)
- Click to review charges
- Quick approve/reject

---

## Recommended Implementation

### **Phase 1: Add Charge Functionality**
1. Add "Add Charge" button in Revenue Cycle Dashboard
2. Create modal to:
   - Search/select patient
   - Search/select charge from master
   - Enter quantity
   - Link to admission (if admitted)
   - Save charge

### **Phase 2: Patient Charge Review**
1. Add "My Patient Charges" section
2. Show charges for doctor's patients
3. Filter by:
   - Patient
   - Admission
   - Status (pending, reviewed, approved)
   - Date range

### **Phase 3: Charge Approval**
1. Add approve/reject buttons on each charge
2. Add bulk approve for admission
3. Update charge status
4. Add notes/comments

### **Phase 4: Discharge Integration**
1. Add charge review step to discharge workflow
2. Require charge approval before discharge
3. Show charge summary in discharge modal

### **Phase 5: Accounts Notification**
1. When charges approved → create notification
2. Show in Accounts Dashboard
3. Accounts can create invoice from approved charges

---

## Database Schema (Already Exists)

The `patient_charges` table already has:
- `charge_status`: 'pending', 'reviewed', 'billed', 'paid', 'adjusted', 'written_off'
- `captured_by`: User who added charge
- `captured_at`: When charge was added
- `admission_id`: Link to admission

**We just need to add:**
- `reviewed_by`: Doctor who reviewed
- `reviewed_at`: When reviewed
- `approved_by`: Doctor who approved
- `approved_at`: When approved
- `approval_notes`: Comments from doctor

---

## API Endpoints Needed

### **Already Exist:**
- ✅ `POST /revenue-cycle/charges` - Add charge
- ✅ `GET /revenue-cycle/charges/patient/:patientId` - Get charges
- ✅ `GET /revenue-cycle/charges/review/admission/:admissionId` - Review charges

### **Need to Add:**
- ❌ `PUT /revenue-cycle/charges/:id/approve` - Approve charge
- ❌ `PUT /revenue-cycle/charges/:id/reject` - Reject charge
- ❌ `PUT /revenue-cycle/charges/admission/:admissionId/approve-all` - Bulk approve
- ❌ `POST /revenue-cycle/charges/:id/notes` - Add review notes
- ❌ `GET /revenue-cycle/charges/pending-review` - Get pending charges for doctor
- ❌ `POST /revenue-cycle/charges/notify-accounts/:admissionId` - Notify accounts

---

## Summary

**Current State:**
- ✅ Backend APIs exist for charge capture
- ✅ Charge master is populated
- ❌ No UI to add charges to patients
- ❌ No UI to review charges
- ❌ No approval workflow
- ❌ No discharge integration
- ❌ No accounts notification

**What's Needed:**
1. **Add Charge UI** - Form to add charge to patient
2. **Charge Review UI** - View and manage patient charges
3. **Approval Workflow** - Approve/reject charges
4. **Discharge Integration** - Charge review before discharge
5. **Accounts Notification** - Notify when charges approved

**The workflow exists in the backend, but the frontend UI is missing!**

---

*Last Updated: December 5, 2025*


