# Tier 1 Features - Access Guide

**Quick Reference**: How to access Tier 1 critical features

---

## 🚨 **EMERGENCY DEPARTMENT**

### Access Methods:
1. **Direct URL**: `http://localhost:3014/ehr/{tenant}/emergency`
2. **Via Dashboard**: Login as nurse/doctor → Click "Emergency Dept" in Quick Actions

### Features:
- ED Metrics (census, wait times, boarding patients)
- ESI Triage Levels (1-5)
- Real-time ED tracking board
- Patient disposition tracking

---

## 🏥 **BED MANAGEMENT & ADT**

### Access Methods:
1. **Direct URL**: `http://localhost:3014/ehr/{tenant}/bed-management`
2. **Via Dashboard**: Login as nurse → Click "Bed Management" in Quick Actions

### Features:
- Real-time bed status across all wards
- Occupancy statistics
- Ward filters (ICU, Medical, Surgical, Pediatrics, Maternity)
- Admission, Discharge, Transfer (ADT) workflows

---

## 📋 **E-CONSENT MANAGEMENT**

### Requirements:
⚠️ **Must have an active appointment selected**

### Access:
1. Login as **doctor**
2. Navigate to doctor dashboard
3. Select an appointment (click appointment card)
4. Find **"Consents"** button (amber/orange, Shield icon)
5. Click to open consent library

### Features:
- Browse consent templates (treatment, surgery, research, HIPAA, etc.)
- Present consent to patient
- Capture e-signatures
- Version control and audit trails
- Multi-language support

---

## 💉 **IMMUNIZATION REGISTRY**

### Requirements:
⚠️ **Must have an active appointment selected**

### Access:
1. Login as **doctor**
2. Select an appointment
3. Find **"Immunizations"** button (green/emerald, Syringe icon)
4. Click to open immunization history

### Features:
- CDC vaccine schedules (19 standard vaccines)
- Patient immunization history
- Due/overdue vaccine tracking
- Record new vaccinations
- Adverse event reporting
- Vaccine inventory management

---

## 📊 **CLINICAL PATHWAYS & PROTOCOLS**

### Requirements:
⚠️ **Must have an active appointment selected**

### Access:
1. Login as **doctor**
2. Select an appointment
3. Find **"Pathways"** button (violet/purple, Route icon)
4. Click to open pathway management

### Features:
- 5 clinical pathways (Sepsis, Stroke, Pneumonia, DKA, CHF)
- Evidence-based protocol steps
- Enroll patients in pathways
- Track adherence and completion
- Step-by-step guidance
- Variance tracking

---

## 🔍 **TROUBLESHOOTING**

### "I don't see the Tier 1 buttons!"

**Checklist**:
1. ✅ Logged in as **doctor**? (Nurses can't access patient-specific features)
2. ✅ Have an **appointment scheduled for today**?
3. ✅ **Clicked on an appointment** to select it?
4. ✅ Appointment **not awaiting payment**?
5. ✅ In the **"Current Appointment" section**?

### Creating a Test Appointment:
```
1. Login as nurse
2. Go to "Today's Schedule"
3. Click "+" to schedule appointment
4. Select doctor, patient, date, time
5. Create appointment
6. Logout and login as doctor
7. Click the appointment card to select it
8. Scroll down to see Tier 1 buttons
```

---

## 📱 **PATIENT PORTAL ACCESS**

### Features Available to Patients:
1. **My Consents** - View and sign consent forms
2. **My Care Pathways** - Track treatment progress
3. **Immunizations** - View vaccination history and forecast
4. **Admission Status** - Check bed assignment and discharge date
5. **ED Visits** - Review ED visit history

### Patient Login:
- **URL**: `http://localhost:3015/{tenant}/dashboard`
- **Test Credentials**: `mkize@example.com` / `Password1#`

---

## ✅ **SUMMARY**

**Standalone Modules** (No appointment needed):
- ✅ Emergency Department
- ✅ Bed Management

**Patient-Specific Features** (Require active appointment):
- ⚠️ E-Consents
- ⚠️ Immunizations
- ⚠️ Clinical Pathways

---

**For more details**: See individual sprint documentation (sprint21-25)

