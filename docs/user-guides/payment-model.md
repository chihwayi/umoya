# Pay-Per-Visit Payment Model

**Implementation Date**: December 3, 2025  
**Status**: ✅ Active  
**Migration**: 002-change-payment-default-to-awaiting.sql

---

## 📋 **OVERVIEW**

MediCore EHR uses a **Pay-Per-Visit** payment model where patients pay at each appointment visit, not at booking time.

---

## 💰 **APPOINTMENT LIFECYCLE**

### **1. BOOKING**
```
Patient schedules appointment
↓
Appointment created with:
- payment_status = 'awaiting_payment' ❌
- status = 'awaiting_payment'
- fee_amount = $20 (or configured amount)
```

### **2. ARRIVAL**
```
Patient arrives at clinic
↓
Nurse sees: "⚠️ Awaiting Payment" badge
↓
All features BLOCKED:
- ❌ Record Vitals
- ❌ Triage Assessment
- ❌ Nursing Notes
- ❌ View as clickable (redirects to payment)
```

### **3. PAYMENT**
```
Patient goes to Accounts/Finance
↓
Accounts confirms payment
↓
Status changes:
- payment_status = 'payment_confirmed' ✅
- status = 'scheduled' or 'confirmed'
```

### **4. SERVICE DELIVERY**
```
Nurse Dashboard refreshes
↓
All features UNLOCKED:
- ✅ Record Vitals
- ✅ Triage Assessment
- ✅ Nursing Notes
- ✅ Full appointment access
```

---

## 🆓 **HANDLING FREE APPOINTMENTS**

### **Method 1: Create as Free from Start (Automatic)**

**For Nurses** (when creating appointment):
```
1. Create appointment form
2. Set fee_amount = 0
3. System automatically sets:
   - payment_status = 'payment_confirmed' ✅
   - status = 'scheduled'
4. No payment required
```

**Result**: Appointment is immediately accessible, no payment blocking.

---

### **Method 2: Waive Fee After Creation (Manual)**

**For Accounts Staff** (after appointment created):

**Step 1: Find the Appointment**
```sql
SELECT id, patient_id, fee_amount, payment_status 
FROM appointments 
WHERE patient_id = '{patient_id}' 
  AND appointment_date = '2025-12-03'
  AND payment_status = 'awaiting_payment';
```

**Step 2: Record Fee Waiver**
```sql
INSERT INTO finance_transactions (
  transaction_number,
  transaction_type,
  related_entity_type,
  related_entity_id,
  patient_id,
  amount,
  payment_method,
  payment_status,
  notes
) VALUES (
  'TXN-' || TO_CHAR(NOW(), 'YYYYMMDD') || '-' || LPAD((SELECT COUNT(*) + 1 FROM finance_transactions)::text, 6, '0'),
  'waiver',
  'appointment',
  '{appointment_id}',
  '{patient_id}',
  0.00,
  'waiver',
  'completed',
  'Fee waived for [reason]'
);
```

**Step 3: Update Appointment**
```sql
UPDATE appointments 
SET 
  payment_status = 'payment_confirmed',
  status = 'scheduled'
WHERE id = '{appointment_id}';
```

**Result**: Appointment becomes accessible immediately.

---

### **Method 3: Direct Database Update (Emergency)**

**For Database Admins** (emergency only):
```sql
UPDATE appointments 
SET 
  payment_status = 'payment_confirmed',
  status = 'scheduled'
WHERE id = '{appointment_id}';
```

⚠️ **Warning**: This bypasses financial tracking. Use Method 2 for proper audit trail.

---

## 👥 **ROLE-BASED ACCESS**

### **Nurses**:
- ✅ Can see payment status badges
- ✅ Can create free appointments (fee_amount = 0)
- ❌ Cannot waive fees after creation
- ❌ Cannot modify payment_status directly

### **Accounts Staff**:
- ✅ Can record payments
- ✅ Can waive fees (with reason)
- ✅ Can modify payment_status
- ✅ Can generate financial reports

### **Doctors**:
- ✅ Can see payment status
- ❌ Cannot modify payment settings
- ❌ Cannot waive fees

---

## 🔄 **RECURRING APPOINTMENTS**

### **How It Works**:
Each appointment in a recurring series is treated independently:

```
Recurring Appointment Series:
- Appointment 1 (Dec 3): awaiting_payment → Patient pays → payment_confirmed
- Appointment 2 (Dec 10): awaiting_payment → Patient pays → payment_confirmed
- Appointment 3 (Dec 17): awaiting_payment → Patient pays → payment_confirmed
```

**Key Points**:
- ✅ Each visit requires separate payment
- ✅ Payment at one visit doesn't cover future visits
- ✅ Each appointment gets its own "Awaiting Payment" badge
- ✅ Patients pay as they come to each appointment

---

## 📊 **FINANCIAL REPORTING**

### **Payment Status Tracking**:
```sql
SELECT 
  payment_status,
  COUNT(*) as count,
  SUM(fee_amount) as total_amount
FROM appointments
WHERE appointment_date >= CURRENT_DATE - INTERVAL '30 days'
GROUP BY payment_status;
```

### **Waiver Tracking**:
```sql
SELECT 
  COUNT(*) as waived_appointments,
  SUM(amount) as total_waived
FROM finance_transactions
WHERE transaction_type = 'waiver'
  AND created_at >= CURRENT_DATE - INTERVAL '30 days';
```

---

## 🔧 **CONFIGURATION**

### **Database Default**:
```sql
ALTER TABLE appointments
ALTER COLUMN payment_status SET DEFAULT 'awaiting_payment';
```

### **Backend Logic** (`appointment.service.ts`):
```typescript
if (amount > 0) {
  paymentStatus = PAYMENT_STATUS.AWAITING_PAYMENT;
  status = 'awaiting_payment';
} else {
  paymentStatus = PAYMENT_STATUS.PAYMENT_CONFIRMED;
  status = 'scheduled';
}
```

---

## ✅ **BENEFITS**

1. **Cash Flow**: Payments collected before service delivery
2. **Reduced No-Shows**: Payment commitment increases attendance
3. **Clear Process**: Nurses know when services can be delivered
4. **Audit Trail**: All payments tracked in finance_transactions
5. **Flexibility**: Easy to waive fees when needed

---

## 📝 **BEST PRACTICES**

### **For Nurses**:
1. Always check payment badge before starting vitals
2. Create free appointments with fee_amount = 0 for exempt patients
3. Direct patients to Accounts if payment badge shows

### **For Accounts**:
1. Use Method 2 (fee waiver transaction) for proper tracking
2. Always include reason in waiver notes
3. Generate monthly waiver reports for management

### **For Admins**:
1. Monitor waiver rates monthly
2. Review high-waiver periods
3. Adjust policies as needed

---

**See Also**: 
- `docs/user-guides/appointments.md` - Appointment creation
- `docs/user-guides/billing-claims.md` - Financial management

