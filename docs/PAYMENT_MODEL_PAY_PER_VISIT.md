# Pay-Per-Visit Payment Model

**Implementation Date**: December 3, 2025  
**Status**: ✅ Active

---

## 📋 **OVERVIEW**

MediCore EHR now uses a **Pay-Per-Visit** payment model where patients pay at each appointment visit, not at booking time.

---

## 💰 **HOW IT WORKS**

### **Appointment Lifecycle**:

```
1. BOOKING
   Patient schedules appointment
   ↓
   Appointment created with:
   - payment_status = 'awaiting_payment' ❌
   - status = 'awaiting_payment'
   - fee_amount = $20 (or configured amount)
   
2. ARRIVAL
   Patient arrives at clinic
   ↓
   Nurse sees: "⚠️ Awaiting Payment" badge
   ↓
   All features BLOCKED:
   - ❌ Record Vitals
   - ❌ Triage Assessment
   - ❌ Nursing Notes
   - ❌ View as clickable (redirects to payment)
   
3. PAYMENT
   Patient goes to Accounts/Finance
   ↓
   Accounts confirms payment
   ↓
   Status changes:
   - payment_status = 'payment_confirmed' ✅
   - status = 'scheduled' or 'confirmed'
   
4. SERVICE DELIVERY
   Nurse Dashboard refreshes
   ↓
   All features UNLOCKED:
   - ✅ Record Vitals
   - ✅ Triage Assessment
   - ✅ Nursing Notes
   - ✅ Full patient care
```

---

## 🔁 **RECURRING APPOINTMENTS**

### **Each Visit Requires Payment**:

```
Patient books 4 weekly follow-ups at $20 each
↓
Week 1 (Jan 1):
  - Appointment created: awaiting_payment ❌
  - Patient arrives, pays $20
  - Status: payment_confirmed ✅
  - Services delivered
  
Week 2 (Jan 8):
  - Appointment status: awaiting_payment ❌ (NEW VISIT!)
  - Patient arrives, pays $20
  - Status: payment_confirmed ✅
  - Services delivered
  
Week 3 (Jan 15):
  - Appointment status: awaiting_payment ❌ (NEW VISIT!)
  - Patient arrives, pays $20
  - Status: payment_confirmed ✅
  - Services delivered
  
Week 4 (Jan 22):
  - Appointment status: awaiting_payment ❌ (NEW VISIT!)
  - Patient arrives, pays $20
  - Status: payment_confirmed ✅
  - Services delivered
```

**Important**: Each appointment is treated as a **separate transaction** requiring individual payment.

---

## 🎯 **FREE APPOINTMENTS & FEE WAIVERS**

### **⚠️ IMPORTANT: Role-Based Access**

**Who Can Do What**:

| Action | Receptionist/Scheduler | Nurse | Accounts/Finance | Admin |
|--------|----------------------|-------|------------------|-------|
| **Schedule appointment** | ✅ Yes | ✅ Yes | ✅ Yes | ✅ Yes |
| **Set fee amount** | ❌ No (auto $20) | ❌ No (auto $20) | ✅ Yes | ✅ Yes |
| **Waive/Free appointment** | ❌ No | ❌ **Cannot waive** | ✅ **Yes** | ✅ Yes |
| **Record payment** | ❌ No | ❌ **Cannot record** | ✅ **Yes** | ✅ Yes |
| **View payment status** | ✅ Yes | ✅ **Yes** | ✅ Yes | ✅ Yes |

---

### **FOR NURSES: What You Can See** 👩‍⚕️

#### **✅ What Nurses CAN Do**:

1. **Schedule Appointments**: 
   - Click "Schedule Appointment" button
   - Fill in patient, doctor, date/time
   - **Fee is automatically set to $20** (default)
   - Cannot change fee amount (not shown in form)

2. **See Payment Status**:
   - View "⚠️ Awaiting Payment" badge
   - See locked features until payment
   - View payment confirmation after Accounts processes

3. **Refer to Accounts**:
   - Direct patient to Accounts/Finance for payment
   - Or for free appointment requests

#### **❌ What Nurses CANNOT Do**:

1. **Cannot Create Free Appointments**:
   - No access to fee_amount field
   - Cannot set fee to $0
   - Cannot waive fees

2. **Cannot Record Payments**:
   - No access to Financial Management
   - Cannot mark appointments as paid
   - Cannot process fee waivers

3. **Cannot Override Payment Blocking**:
   - Features remain locked until Accounts confirms payment
   - Cannot bypass payment requirement

---

### **FOR ACCOUNTS/FINANCE STAFF: Full Control** 💰

#### **Method 1: Create as Free from Start** (Accounts Only)

```
Accounts schedules appointment
↓
Can manually set fee_amount = 0
↓
Backend automatically sets:
├─ payment_status = 'payment_confirmed' ✅
├─ status = 'scheduled' ✅
└─ No payment badge shown
↓
All features available immediately
No payment required
```

**Examples**:
- Insurance pre-authorized appointments
- Government-sponsored care
- Pre-approved charity cases
- Staff benefit appointments

---

#### **Method 2: Waive Fee After Creation** ⭐ **MOST COMMON!**

**Scenario**: Appointment already created with fee, but clinic decides to offer it free

```
EXISTING APPOINTMENT (Created by Nurse/Scheduler):
├─ payment_status = 'awaiting_payment' ❌
├─ fee_amount = $20.00
├─ Features BLOCKED
└─ Patient cannot be seen

PATIENT ARRIVES AND SITUATION ASSESSED:
├─ Patient cannot pay (indigent)
├─ OR Insurance approved (bill later)
├─ OR Staff family benefit
├─ OR VIP courtesy
├─ OR Emergency humanitarian care
├─ OR Health campaign (free screening)
↓
ACCOUNTS/FINANCE DECIDES TO WAIVE:
↓
Step 1: Go to Financial Management
Step 2: Find the patient's transaction
Step 3: Click "Record Payment"
Step 4: Enter:
        - Payment Method: "Complimentary" or "Waived"
        - Amount: $0.00 (or full amount with waiver)
        - Notes: "Charity case" / "Staff benefit" / "Insurance covered"
Step 5: Submit payment record
↓
SYSTEM AUTOMATICALLY UPDATES:
├─ Transaction: status = 'paid' ✅
├─ Appointment: payment_status = 'payment_confirmed' ✅
├─ Appointment: status = 'scheduled' ✅
└─ Dashboard refreshes automatically
↓
NURSE DASHBOARD UPDATES:
├─ ✅ Payment badge changes to "Payment Confirmed"
├─ ✅ ALL features unlock immediately
├─ ✅ Nurse can now record vitals, triage, notes
└─ ✅ Patient receives full care
```

---

### **WORKFLOW: Nurse → Accounts → Nurse**

```
👩‍⚕️ NURSE:
1. Sees patient with "⚠️ Awaiting Payment" badge
2. Assesses patient situation
3. Patient says: "I cannot afford to pay"
↓
4. Nurse directs patient to Accounts
5. Explains: "Accounts will assess your case"
↓

💰 ACCOUNTS:
6. Speaks with patient
7. Verifies indigence / emergency / special case
8. Gets supervisor approval (if required)
9. Opens Financial Management
10. Finds patient's appointment transaction
11. Clicks "Record Payment"
12. Enters:
    - Method: "Complimentary"
    - Amount: $0.00
    - Notes: "Charity case - Patient unemployed, no resources"
13. Submits payment
↓

👩‍⚕️ NURSE:
14. Dashboard automatically refreshes
15. Badge changes to: "✅ Payment Confirmed"
16. Features unlock (Vitals, Triage, Notes)
17. Nurse proceeds with patient care
18. Patient receives treatment
```

---

### **Common Use Cases for Fee Waivers** (Accounts Only):

#### **1. Charity / Indigent Patients**:
```
Poor patient arrives, cannot pay
├─ Clinic policy: Provide care regardless
├─ Accounts: Verifies indigence
├─ Accounts: Record payment $0.00
├─ Notes: "Charity case - Patient unable to pay"
└─ Result: ✅ Care provided, properly documented
```

#### **2. Insurance Pre-Authorization**:
```
Patient has insurance approval
├─ Insurance will pay later
├─ Accounts: Verifies authorization
├─ Accounts: Record payment $0.00
├─ Notes: "Insurance pre-authorized - Bill Aetna Policy #12345"
└─ Result: ✅ Patient seen, bill sent to insurance
```

#### **3. Staff & Family Benefits**:
```
Hospital staff family member
├─ Policy: Free care for staff families
├─ Accounts: Verifies staff relationship
├─ Accounts: Record payment $0.00
├─ Notes: "Staff benefit - Employee: Dr. Smith (Cardiology)"
└─ Result: ✅ Complimentary service documented
```

#### **4. VIP / Special Patients**:
```
Board member, donor, or special guest
├─ Administration approves waiver
├─ Accounts: Gets approval reference
├─ Accounts: Record payment $0.00
├─ Notes: "VIP - Approved by CEO (Ref: VIP-2025-001)"
└─ Result: ✅ Courtesy care tracked
```

#### **5. Health Campaigns / Promotions**:
```
Free health screening campaign
├─ All appointments marked for campaign
├─ Accounts: Batch record $0.00
├─ Notes: "World Diabetes Day free screening campaign"
└─ Result: ✅ Community service documented
```

#### **6. Medical Emergency / Humanitarian**:
```
Emergency patient, no ability to pay
├─ Life-saving care priority
├─ Patient treated immediately
├─ Accounts: Record payment $0.00 (post-care)
├─ Notes: "Emergency humanitarian care - MVA victim"
└─ Result: ✅ Care first, paperwork later
```

---

### **Financial Management Workflow** (Accounts Staff Only):

#### **Step-by-Step Process**:

1. **Navigate**: Financial Management → Transactions
2. **Search**: Find patient by name or appointment
3. **Review**: Verify appointment details and fee amount
4. **Authorize**: Confirm waiver approval (if required by policy)
5. **Record Payment**:
   - Click "Record Payment" button
   - Payment Method: Select "Complimentary" or "Waived"
   - Amount: Enter $0.00
   - Reference: Leave blank or enter approval reference
   - Notes: **REQUIRED** - Document reason for waiver
6. **Submit**: Click "Save Payment"
7. **Verify**: Check appointment status changed to "Payment Confirmed"
8. **Notify**: Inform nurse that patient is cleared

**Important Notes**:
- ✅ Always document reason in notes
- ✅ Get supervisor approval if required by policy
- ✅ Transaction remains in system for audit
- ✅ Financial reports track waivers separately
- ✅ Patient statement shows adjustment

---

### **Technical Implementation**:

**Backend Logic** (`finance.service.ts`):
```typescript
case 'appointments':
  await tenantDb.query(`
    UPDATE appointments
    SET payment_status = 'payment_confirmed',
        status = CASE
          WHEN status = 'awaiting_payment' THEN 'scheduled'
          ELSE status
        END,
        updated_at = NOW()
    WHERE id = $1
  `, [appointmentId]);
```

**What Happens**:
1. Payment recorded (even if $0.00)
2. Appointment `payment_status` → `'payment_confirmed'`
3. Appointment `status` → `'scheduled'` (if was awaiting_payment)
4. Frontend detects change
5. Payment badge updates
6. Features unlock automatically

---

### **Audit Trail & Reporting**:

#### **Transaction Record**:
```
Transaction ID: TX-12345
Patient: John Doe
Service: Consultation
Billed Amount: $20.00
Paid Amount: $0.00
Status: Paid (Waived)
Payment Method: Complimentary
Notes: "Charity case - Patient unemployed"
Recorded By: Accounts Staff (Jane Smith)
Date: 2025-12-03 10:30 AM
```

#### **Financial Reports Show**:
```
Revenue Summary:
├─ Total Billed: $20.00
├─ Cash Collected: $0.00
├─ Adjustments (Waivers): -$20.00
├─ Outstanding: $0.00
└─ Net Revenue Impact: $0.00

Waiver/Adjustment Report:
├─ Charity Cases: $150.00 (8 patients)
├─ Staff Benefits: $40.00 (2 patients)
├─ Insurance (Bill Later): $200.00 (10 patients)
├─ VIP Courtesy: $20.00 (1 patient)
└─ Total Waivers: $410.00
```

**Benefits**:
- ✅ Complete financial transparency
- ✅ Track charity care for grant applications
- ✅ Monitor staff benefit usage
- ✅ Accurate cost accounting
- ✅ Audit-ready documentation

---

### **Policy Recommendations**:

#### **Establish Clear Guidelines**:

1. **Who Can Approve Waivers**:
   - Charity cases: Social worker or Admin
   - Staff benefits: HR verification required
   - VIP: CEO/Board approval
   - Emergency: Any senior clinician

2. **Documentation Requirements**:
   - ✅ Reason must be documented
   - ✅ Approval reference (if applicable)
   - ✅ Supporting documents (insurance letter, etc.)

3. **Limits & Controls**:
   - Set monthly waiver limits per category
   - Require supervisor approval above threshold
   - Periodic review of waiver patterns

4. **Patient Communication**:
   - Inform patient of waiver
   - Provide documentation
   - Explain any future billing (insurance)

---

### **Method 3: Manual Override** (Admin/Technical Only):

**For System Administrators Only**:

```sql
-- Direct database update (use with caution)
UPDATE appointments 
SET payment_status = 'payment_confirmed',
    status = 'scheduled',
    updated_at = NOW()
WHERE id = '{appointment-id}';

-- Optional: Add note to financial transaction
UPDATE financial_transactions
SET notes = 'Administrative waiver - [REASON]'
WHERE source_reference_id = '{appointment-id}';
```

**When to Use**:
- System errors or bugs
- Bulk corrections needed
- Emergency override situations
- **NOT for normal operations** (use Method 2 instead)

---

## 🔒 **WHAT'S BLOCKED BEFORE PAYMENT**

### **Nurse Dashboard**:
- ❌ Record Vitals button (disabled/locked)
- ❌ Triage Assessment button (disabled/locked)
- ❌ Nursing Notes tab (shows payment message)
- ❌ Appointment actions (greyed out)
- ✅ View payment status (shows amount due)
- ✅ **Can refer patient to Accounts**

### **Doctor Dashboard**:
- ❌ Clinical documentation
- ❌ Prescriptions
- ❌ Lab orders
- ❌ Treatment plans
- ✅ View patient demographics
- ✅ View payment status

---

## 💳 **PAYMENT CONFIRMATION FLOW**

### **Accounts/Finance Staff**:

```
1. Patient pays at reception (or fee waived)
   ↓
2. Finance opens Financial Management
   ↓
3. Finds patient's transaction
   ↓
4. Marks as "Payment Received" (or $0.00 waived)
   ↓
5. System updates:
   - payment_status → 'payment_confirmed'
   - status → 'scheduled' or 'confirmed'
   ↓
6. Nurse Dashboard automatically refreshes
   ↓
7. Features unlock immediately
```

---

## 🔧 **TECHNICAL IMPLEMENTATION**

### **Database Default**:
```sql
ALTER TABLE appointments 
ALTER COLUMN payment_status SET DEFAULT 'awaiting_payment';
```

### **Backend Logic** (`appointment.service.ts`):
```typescript
// Lines 75-104
let paymentStatus = PAYMENT_STATUS.PAYMENT_CONFIRMED;
let status = 'scheduled';

if (amount > 0) {
  // Create financial transaction
  const transaction = await this.financeService.createTransaction(...);
  
  // Set to awaiting payment
  paymentStatus = PAYMENT_STATUS.AWAITING_PAYMENT;
  status = 'awaiting_payment';
  financeTransactionId = transaction.id;
}
```

### **Frontend Logic** (`NurseDashboard.tsx`):
```typescript
const awaitingPayment = appointment.paymentStatus === 'awaiting_payment';

if (awaitingPayment) {
  // Show payment badge
  // Disable all action buttons
  // Display payment message
  // Block feature access
}
```

---

## 📊 **STATISTICS & REPORTING**

### **Daily Revenue Tracking**:
```
Total Appointments: 50
├─ Awaiting Payment: 15 (30%) → $300 pending
├─ Payment Confirmed: 30 (60%) → $600 collected
└─ Completed: 5 (10%) → $100 reconciled
```

### **Payment Collection Rate**:
```
Monitor:
- % of appointments paid before service
- Average payment delay time
- Appointments cancelled due to non-payment
```

---

## ⚙️ **CONFIGURATION**

### **Default Consultation Fee**:
```env
# .env file
DEFAULT_CONSULTATION_FEE=20
```

### **Payment Options**:
```typescript
// Payment methods accepted
- Cash
- Mobile Money
- Credit/Debit Card
- Insurance
- Medical Aid
- Complimentary (Waived)
```

---

## 🎨 **USER INTERFACE**

### **Payment Badge Design**:
```
⚠️ Awaiting Payment: $20.00
[Lock icon] Payment required before service

[Go to Accounts/Finance]
```

### **Payment Confirmation Message**:
```
✅ Payment Confirmed
Ready for service delivery

[Record Vitals] [Triage Assessment] [Nursing Notes]
```

---

## 🚨 **EDGE CASES HANDLED**

### **1. Patient Leaves Without Paying**:
```
Appointment remains: awaiting_payment ❌
↓
After 24 hours: Auto-cancel (optional)
↓
Or: Accounts follow up for payment
```

### **2. Partial Payment**:
```
Patient pays $10 of $20
↓
payment_status: still 'awaiting_payment' ❌
↓
Must pay full amount to unlock (or Accounts waives balance)
```

### **3. Payment Reversal**:
```
Payment confirmed → Service delivered → Payment disputed
↓
Don't reverse appointment status
↓
Handle via refund process separately
```

### **4. Insurance Pre-Authorization**:
```
Insurance approved
↓
Accounts manually set: payment_status = 'payment_confirmed'
↓
No cash payment required
↓
Bill insurance later
```

---

## 📈 **BENEFITS**

### **For Clinic**:
- ✅ Guaranteed payment before service
- ✅ Reduced bad debt
- ✅ Clear revenue tracking
- ✅ Enforced payment policy
- ✅ Better cash flow
- ✅ Flexibility for charity cases

### **For Staff**:
- ✅ Clear payment status visibility
- ✅ No confusion about who's paid
- ✅ Protected from treating non-paying patients
- ✅ Accounts handles all payment issues
- ✅ Can provide free care when authorized

### **For Patients**:
- ✅ Know exact cost upfront
- ✅ Pay only when receiving service
- ✅ No surprise charges
- ✅ Clear payment expectations
- ✅ Charity care available for those in need

---

## 🔄 **MIGRATION NOTES**

### **Existing Appointments**:
- NOT automatically changed
- Keep current payment_status
- Only NEW appointments use new default

### **To Update Existing** (Optional):
```sql
UPDATE appointments 
SET payment_status = 'awaiting_payment', 
    status = 'awaiting_payment'
WHERE fee_amount > 0 
  AND payment_status = 'payment_confirmed' 
  AND finance_transaction_id IS NULL
  AND status = 'scheduled';
```

---

## 📞 **SUPPORT**

**Questions?**
- Check Financial Management documentation
- Contact System Administrator
- Review payment status in real-time

---

## ✅ **CHECKLIST FOR STAFF**

### **Receptionist/Scheduler**:
- [ ] Inform patient of appointment fee
- [ ] Explain payment required at visit
- [ ] Book appointment (auto-sets awaiting_payment)
- [ ] Cannot waive fees (refer to Accounts)

### **Nurse** 👩‍⚕️:
- [ ] Check payment badge on dashboard
- [ ] If awaiting payment: Direct to Accounts
- [ ] If payment confirmed: Proceed with care
- [ ] Record vitals, triage, nursing notes
- [ ] **Cannot waive fees or record payments**
- [ ] **Refer special cases to Accounts**

### **Accounts/Finance** 💰:
- [ ] Collect payment when patient arrives
- [ ] Issue receipt
- [ ] Confirm payment in system
- [ ] **Can waive fees for approved cases**
- [ ] **Document reason for waiver**
- [ ] Verify status changed to payment_confirmed
- [ ] Notify nurse that patient is cleared

### **Doctor**:
- [ ] Verify payment status before consultation
- [ ] If unpaid: Coordinate with Accounts
- [ ] If paid: Proceed with examination

---

**Status**: ✅ **Fully Operational**  
**Model**: **Pay-Per-Visit**  
**Default**: **Awaiting Payment**  
**Enforcement**: **Strict** (Features blocked until payment)  
**Flexibility**: **Accounts can waive fees for approved cases**
