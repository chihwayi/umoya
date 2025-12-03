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

## 🎯 **FREE APPOINTMENTS**

### **No Payment Required**:

```
Appointment with fee_amount = 0 or NULL
↓
payment_status = 'payment_confirmed' ✅ (automatically)
status = 'scheduled' ✅
↓
No payment blocking
All features available immediately
```

**Examples**:
- Follow-up visits included in package
- Insurance-covered appointments
- Government-sponsored care
- Charity/pro-bono cases

---

## 🔒 **WHAT'S BLOCKED BEFORE PAYMENT**

### **Nurse Dashboard**:
- ❌ Record Vitals button (disabled/locked)
- ❌ Triage Assessment button (disabled/locked)
- ❌ Nursing Notes tab (shows payment message)
- ❌ Appointment actions (greyed out)
- ✅ View payment status (shows amount due)
- ✅ Redirect to Accounts/Finance

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
1. Patient pays at reception
   ↓
2. Finance opens Financial Management
   ↓
3. Finds patient's transaction
   ↓
4. Marks as "Payment Received"
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
Must pay full amount to unlock
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
Manually set: payment_status = 'payment_confirmed'
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

### **For Staff**:
- ✅ Clear payment status visibility
- ✅ No confusion about who's paid
- ✅ Protected from treating non-paying patients
- ✅ Accounts handles all payment issues

### **For Patients**:
- ✅ Know exact cost upfront
- ✅ Pay only when receiving service
- ✅ No surprise charges
- ✅ Clear payment expectations

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

### **Accounts/Finance**:
- [ ] Collect payment when patient arrives
- [ ] Issue receipt
- [ ] Confirm payment in system
- [ ] Verify status changed to payment_confirmed

### **Nurse**:
- [ ] Check payment badge on dashboard
- [ ] If awaiting payment: Direct to Accounts
- [ ] If payment confirmed: Proceed with care
- [ ] Record vitals, triage, nursing notes

### **Doctor**:
- [ ] Verify payment status before consultation
- [ ] If unpaid: Coordinate with Accounts
- [ ] If paid: Proceed with examination

---

**Status**: ✅ **Fully Operational**  
**Model**: **Pay-Per-Visit**  
**Default**: **Awaiting Payment**  
**Enforcement**: **Strict** (Features blocked until payment)

