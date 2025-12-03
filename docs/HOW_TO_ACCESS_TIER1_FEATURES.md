# How to Access Tier 1 Features 🎯

**Quick Guide**: Where to find each Tier 1 feature

---

## 🚨 **EMERGENCY DEPARTMENT**

### Direct Access:
**URL**: http://localhost:3014/ehr/bulawayo-general/emergency

### OR Via Navigation:
1. Login as **nurse** or **doctor**
2. If nurse: Click **"Emergency Dept"** in Quick Actions (red/orange card)
3. Full-screen ED tracking board loads

**What You'll See**:
- ED Metrics cards (census, wait times, etc.)
- ED Tracking Board (empty until visits created)
- ESI Level legend
- Real-time status

---

## 🏥 **BED MANAGEMENT**

### Direct Access:
**URL**: http://localhost:3014/ehr/bulawayo-general/bed-management

### OR Via Navigation:
1. Login as **nurse**
2. Click **"Bed Management"** in Quick Actions (blue/cyan card)
3. Full bed status board loads

**What You'll See**:
- Occupancy statistics (46 beds, all available)
- Ward filters (ICU, Medical, Surgical, Pediatrics, Maternity)
- Bed status board (grid of all beds)
- Status legend
- "Admit Patient" button

---

## 📋 **E-CONSENTS** (Patient Feature)

### Requirements:
⚠️ **MUST have an active appointment to see this feature!**

### How to Access:
1. Login as **doctor**: `dr.ndlovu@bulawayo-general.co.zw`
2. Go to doctor dashboard: http://localhost:3014/ehr/bulawayo-general/doctor
3. **You MUST have an appointment scheduled for today**
4. Click on the appointment card to make it the "current appointment"
5. Scroll down to the patient action buttons
6. Look for the **amber/orange "Consents" button** with Shield icon

**If you don't see it**:
- ❌ No appointment scheduled → **Create an appointment first!**
- ❌ Appointment not selected → **Click on an appointment card**
- ❌ Payment pending → Buttons may be disabled

**Button Location**: Under "Current Appointment" section, alongside:
- Prescriptions
- Order Labs
- Order Imaging
- Care Plans
- Referrals
- Documents
- Questionnaires
- **→ Consents** ← (Tier 1)
- **→ Immunizations** ← (Tier 1)
- **→ Pathways** ← (Tier 1)

---

## 💉 **IMMUNIZATIONS** (Patient Feature)

### Same as Consents:
1. Login as **doctor**
2. Must have appointment
3. Click appointment to select it
4. Find the **green/emerald "Immunizations" button** with Syringe icon
5. Click to open immunization history

**What You'll See**:
- Patient immunization schedule (19 CDC vaccines)
- Due/overdue vaccines
- Record new vaccination
- Adverse event reporting

---

## 📊 **CLINICAL PATHWAYS** (Patient Feature)

### Same as Consents:
1. Login as **doctor**
2. Must have appointment
3. Click appointment to select it
4. Find the **violet/purple "Pathways" button** with Route icon
5. Click to open pathway management

**What You'll See**:
- 5 clinical pathways (Sepsis, Stroke, Pneumonia, DKA, CHF)
- 32 total protocol steps
- Enroll patient in pathway
- Track adherence
- Step-by-step protocols

---

## 🔍 **TROUBLESHOOTING**

### "I don't see the Consents/Immunizations/Pathways buttons!"

**Checklist**:
1. ✅ Are you logged in as a **doctor**?
   - Nurses can't access these (patient-specific features)
   
2. ✅ Do you have an **appointment scheduled for today**?
   - Go to "Today's Schedule" tab
   - Should see appointment cards
   - If none: Create an appointment first!

3. ✅ Have you **clicked on an appointment** to make it current?
   - Click any appointment card
   - Look for green checkmark or "Current" indicator
   - Buttons appear in the section below

4. ✅ Is the appointment **not awaiting payment**?
   - Payment-pending appointments disable these buttons
   - Check if you see a "Waiting for Payment" badge

5. ✅ Are you in the **"Current Appointment" section**?
   - This section only appears when appointment is selected
   - Scroll down below the appointment card
   - Look for vitals, prescriptions, labs section

---

## 🎯 **QUICK TEST GUIDE**

### To Test Tier 1 Patient Features:

**Step 1: Create Test Appointment**
```
1. Login as nurse: http://localhost:3014/ehr/bulawayo-general/nurse
2. Click "Today's Schedule"
3. Click "+" to schedule appointment
4. Select doctor: Dr. Ndlovu
5. Select patient
6. Select today's date
7. Select time slot
8. Create appointment
```

**Step 2: Login as Doctor**
```
1. Logout nurse
2. Login as doctor: dr.ndlovu@bulawayo-general.co.zw
3. Go to doctor dashboard
```

**Step 3: Select Appointment**
```
1. You should see the appointment you just created
2. Click on the appointment card
3. It becomes the "current appointment"
```

**Step 4: Access Tier 1 Features**
```
1. Scroll down below appointment card
2. You'll see a row of colorful buttons
3. Find and click:
   - 🟡 "Consents" (amber/orange)
   - 🟢 "Immunizations" (green)
   - 🟣 "Pathways" (violet/purple)
```

---

## 📱 **ALTERNATIVE: TEST NEW DASHBOARDS FIRST**

If you don't want to create appointments yet:

### Test Emergency Department:
```
Direct URL: http://localhost:3014/ehr/bulawayo-general/emergency
Login: nurse or doctor
See: ED tracking board (empty state)
```

### Test Bed Management:
```
Direct URL: http://localhost:3014/ehr/bulawayo-general/bed-management
Login: nurse or doctor
See: 46 beds across 5 wards (all available)
```

These work **WITHOUT needing appointments**!

---

## ✅ **SUMMARY**

**Separate Modules** (Work anytime):
- ✅ Emergency Dept - Direct URL or Quick Action
- ✅ Bed Management - Direct URL or Quick Action

**Patient Features** (Need appointment):
- ⚠️ Consents - Requires current appointment
- ⚠️ Immunizations - Requires current appointment
- ⚠️ Pathways - Requires current appointment

---

**Next**: Create a test appointment, then you'll see all the buttons! 🚀

