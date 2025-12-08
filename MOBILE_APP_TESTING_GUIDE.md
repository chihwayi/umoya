# Mobile App Testing Guide
## Testing All New Features

**Status:** App is building and will launch shortly on the emulator.

---

## 🚀 **Quick Start Testing**

### **1. Login & Navigation**
1. Login with your credentials
2. Select your tenant/clinic
3. Navigate to Doctor Dashboard

### **2. Test Clinical Documentation (Sprint 1)**

#### **A. Clinical Notes & SOAP Documentation**
- Navigate to: Patient Detail → Clinical Notes
- Test:
  - ✅ Enter Chief Complaint
  - ✅ Enter History of Present Illness (HPI)
  - ✅ Enter Physical Examination
  - ✅ Enter Assessment/Diagnosis
  - ✅ Enter Treatment Plan
  - ✅ Save draft
  - ✅ Save final notes

#### **B. Problem List Management**
- Navigate to: Patient Detail → Problems
- Test:
  - ✅ Add new problem
  - ✅ Edit existing problem
  - ✅ Mark problem as resolved
  - ✅ Delete problem
  - ✅ View active vs resolved problems

#### **C. Allergies Management**
- Navigate to: Patient Detail → Allergies
- Test:
  - ✅ Add new allergy (try common allergens)
  - ✅ Set severity (mild/moderate/severe)
  - ✅ Add reaction description
  - ✅ Edit allergy
  - ✅ Delete allergy
  - ✅ Verify critical allergy alerts

#### **D. Chart Review**
- Navigate to: Patient Detail → Chart Review
- Test:
  - ✅ View timeline of all records
  - ✅ Filter by type (notes, vitals, labs, prescriptions)
  - ✅ Navigate to record details

---

### **3. Test Visit Management (Sprint 2)**

- Navigate to: Schedule → Select Appointment → Visit Management
- Test:
  - ✅ Check-in patient
  - ✅ Start visit
  - ✅ Access quick actions (Notes, Problems, Allergies, Chart)
  - ✅ Complete visit
  - ✅ Verify status changes

---

### **4. Test Enhanced Prescriptions (Sprint 3)**

- Navigate to: Patient Detail → Prescription History
- Test:
  - ✅ View all prescriptions (active, completed, discontinued)
  - ✅ Filter by status
  - ✅ Check drug interactions (CDSS integration)
  - ✅ Modify prescription
  - ✅ Renew prescription
  - ✅ Discontinue prescription

---

### **5. Test Lab Results (Sprint 4)**

- Navigate to: Patient Detail → Lab Results Dashboard
- Test:
  - ✅ View lab results
  - ✅ Filter by time range (24h, 7d, 30d, all)
  - ✅ Filter by status (all, recent, critical)
  - ✅ View critical alerts banner
  - ✅ Check result details
  - ✅ Order new lab test

---

### **6. Test Clinical Alerts (Sprint 8)**

- Navigate to: Clinical Alerts (if added to navigation)
- Test:
  - ✅ View all alerts
  - ✅ Filter by type (critical, warning, info)
  - ✅ Acknowledge alerts
  - ✅ Navigate to related patient records

---

### **7. Test Document Management (Sprint 9)**

- Navigate to: Patient Detail → Documents
- Test:
  - ✅ View document list
  - ✅ View document metadata
  - ✅ Upload document (when camera ready)
  - ✅ Delete document
  - ✅ View document tags

---

### **8. Test Enhanced Patient Summary (Sprint 6)**

- Navigate to: Patient Detail
- Test:
  - ✅ View enhanced summary card
  - ✅ Check active problems count
  - ✅ Check allergies count (with critical indicator)
  - ✅ Check active medications count
  - ✅ View latest vitals
  - ✅ Use quick action buttons
  - ✅ Verify color-coded alerts

---

## 🎯 **Key Features to Verify**

### **UI/UX Checks**
- ✅ All screens load without errors
- ✅ Loading states display properly
- ✅ Empty states show helpful messages
- ✅ Error messages are user-friendly
- ✅ Navigation works smoothly
- ✅ Colors and icons display correctly
- ✅ Glassmorphism design is consistent

### **Functionality Checks**
- ✅ All CRUD operations work
- ✅ Filters work correctly
- ✅ Status updates reflect immediately
- ✅ Data persists after save
- ✅ Navigation between screens works
- ✅ Quick actions function properly

### **Integration Checks**
- ✅ API calls succeed
- ✅ Error handling works
- ✅ CDSS gateway responds (or falls back gracefully)
- ✅ Patient data loads correctly
- ✅ Appointment data syncs

---

## 🐛 **Common Issues & Solutions**

### **Issue: App won't start**
- **Solution:** Check Metro bundler is running (`curl http://localhost:8081/status`)
- **Solution:** Check emulator is running (`adb devices`)
- **Solution:** Restart Metro with cache reset

### **Issue: API calls failing**
- **Solution:** Verify backend is running on port 3013
- **Solution:** Check tenant slug is set correctly
- **Solution:** Verify auth token is valid

### **Issue: Navigation errors**
- **Solution:** Check all screens are registered in `DoctorNavigator.tsx`
- **Solution:** Verify route params are passed correctly

### **Issue: Styling issues**
- **Solution:** Check design system imports
- **Solution:** Verify colors/spacing constants

---

## 📋 **Testing Checklist**

### **Sprint 1: Clinical Documentation**
- [ ] Clinical Notes screen loads
- [ ] SOAP note fields work
- [ ] Save draft works
- [ ] Save final works
- [ ] Problem List screen loads
- [ ] Add/edit/delete problems works
- [ ] Resolve problem works
- [ ] Allergies screen loads
- [ ] Add/edit/delete allergies works
- [ ] Severity indicators work
- [ ] Chart Review screen loads
- [ ] Filters work
- [ ] Record navigation works

### **Sprint 2: Visit Management**
- [ ] Visit Management screen loads
- [ ] Check-in works
- [ ] Start visit works
- [ ] Complete visit works
- [ ] Quick actions work
- [ ] Status updates reflect

### **Sprint 3: Prescriptions**
- [ ] Prescription History screen loads
- [ ] Filters work
- [ ] Drug interaction check works
- [ ] Modify works
- [ ] Renew works
- [ ] Discontinue works

### **Sprint 4: Lab Results**
- [ ] Lab Results Dashboard loads
- [ ] Time range filters work
- [ ] Status filters work
- [ ] Critical alerts display
- [ ] Result details show

### **Sprint 5: CDSS**
- [ ] CDSS service exists
- [ ] Drug interaction check calls CDSS
- [ ] Graceful fallback works

### **Sprint 6: Quick Actions**
- [ ] Patient Summary Card displays
- [ ] Stats are accurate
- [ ] Quick actions work
- [ ] Alerts display correctly

### **Sprint 7: Offline**
- [ ] Offline service exists
- [ ] Ready for UI integration

### **Sprint 8: Alerts**
- [ ] Clinical Alerts screen loads
- [ ] Filters work
- [ ] Acknowledge works
- [ ] Navigation to related records works

### **Sprint 9: Documents**
- [ ] Document Management screen loads
- [ ] Document list displays
- [ ] Upload ready (camera integration pending)
- [ ] Delete works

### **Sprint 10: Navigation**
- [ ] Bottom Tab Navigator component exists
- [ ] Ready for integration

---

## 🎉 **Success Criteria**

✅ All screens load without crashes
✅ All CRUD operations work
✅ Navigation is smooth
✅ UI is consistent and beautiful
✅ Error handling works
✅ Loading states display
✅ Empty states are helpful
✅ No console errors
✅ No linting errors

---

## 📝 **Testing Notes**

Document any issues you find:
- Screen name
- Steps to reproduce
- Expected behavior
- Actual behavior
- Screenshots (if possible)

---

**Happy Testing! 🚀**

The app should be launching on your emulator now. All features are ready to test!

