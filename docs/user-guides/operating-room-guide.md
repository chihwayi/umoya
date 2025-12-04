# 🏥 Operating Room Management - User Guide

**Module:** Operating Room Management  
**Version:** 1.0  
**Date:** December 4, 2025

---

## 📋 Overview

The Operating Room Management module enables complete surgical workflow from scheduling to completion, including FDA-compliant implant tracking.

---

## 🚀 Getting Started

### **Accessing the OR Dashboard**

1. Login to MediCore EHR
2. From main dashboard, click **"Operating Room"** card
3. OR Dashboard opens showing today's schedule

**URL:** `/ehr/{tenant}/operating-room`

**Access:** Doctors, Nurses, Administrators

---

## 📅 Scheduling a Surgery

### **Step 1: Open Schedule Modal**
- Click **"Schedule Surgery"** button (top right)

### **Step 2: Select Patient**
- Search patient by name or MRN
- Select from dropdown

### **Step 3: Set Date & Time**
- Choose surgery date
- Set start time (e.g., 08:00)
- Set end time (e.g., 10:00)
- System checks OR availability

### **Step 4: Select Operating Room**
- Choose from available ORs
- See room type (General, Cardiac, Ortho, etc.)

### **Step 5: Enter Procedure Details**
- **Procedure Name:** e.g., "Laparoscopic Cholecystectomy"
- **CPT Code:** e.g., 47562 (optional)
- **Surgical Approach:** Open, Laparoscopic, Robotic, etc.

### **Step 6: Enter Diagnosis**
- Click ICD-10 search field
- Type diagnosis: e.g., "cholecystitis"
- Select from 74,772 searchable codes
- Example: K81.0 - Acute cholecystitis
- ✅ Auto-fills diagnosis field

### **Step 7: Assign Surgical Team**
- **Primary Surgeon:** Required
- **Anesthesiologist:** Optional (can assign later)

### **Step 8: Set Priority & Type**
- **Type:** Elective, Urgent, Emergent, Trauma
- **Priority:** 1 (Emergent) to 5 (Optional)
- **Anesthesia Type:** General, Regional, Spinal, etc.

### **Step 9: Laterality (if applicable)**
- For joint/limb procedures
- Select: Left, Right, or Bilateral

### **Step 10: Schedule**
- Review pre-scheduling checklist
- Click **"Schedule Surgery"**
- ✅ Case appears on OR board

---

## 🏥 Day of Surgery Workflow

### **View OR Schedule**
- OR Dashboard shows all scheduled cases
- Toggle between **Board View** (timeline) and **List View**
- Color-coded status:
  - 🔵 Blue = Scheduled
  - 🟣 Purple = Patient arrived
  - 🟠 Orange = In progress (LIVE)
  - 🟢 Green = Completed
  - 🔴 Red = Cancelled

### **Start Surgical Case**
1. Click on scheduled case
2. Case detail modal opens
3. Verify patient, procedure, team
4. Click **"Start Case"**
5. ✅ Status changes to "In Progress"
6. ✅ Actual start time recorded
7. ✅ OR status updated

---

## 📝 Intraoperative Documentation

### **During Surgery:**
1. Click **"Document Procedure"** button
2. Documentation form expands

### **Required Fields:**
- **Findings:** Intraoperative findings
- **Procedure Performed:** What was done

### **Optional Fields:**
- **Post-Op Diagnosis:** Final diagnosis
- **Estimated Blood Loss:** In mL
- **Complications:** Any issues encountered
- **Specimens Sent:** Click "+ Add Specimen"
- **Drains Placed:** Click "+ Add Drain"

### **Save Documentation:**
- Click **"Save Documentation"**
- ✅ Saved to case record
- Can update multiple times during surgery

---

## 🏷️ Tracking Implants (FDA Compliance)

### **When to Track:**
- Any implantable device used
- Prosthetics, meshes, screws, plates, etc.

### **How to Track:**
1. Click **"Track Implant"** button
2. Implant tracking modal opens

### **Required Information:**
- **Implant Name:** e.g., "Titanium Hip Prosthesis"
- **At least ONE identifier:**
  - UDI (Unique Device Identifier) - scan barcode
  - Lot Number - e.g., LOT123456
  - Serial Number - e.g., SN789012

### **Additional Information:**
- Manufacturer
- Catalog number
- Expiration date
- Unit cost (for billing)
- Body site (e.g., "Right hip")

### **FDA Compliance:**
- ✅ UDI enables recall tracking
- ✅ Lot number for batch recalls
- ✅ Serial number for individual device tracking
- ✅ Automatic charge capture

### **Track Implant:**
- Click **"Track Implant"**
- ✅ Saved to database
- ✅ Charge posted to patient account
- ✅ FDA compliance maintained

---

## ✅ Completing a Surgical Case

### **Before Completing:**
- Ensure documentation is complete
- Required: Findings + Procedure Performed

### **Complete Case:**
1. Click **"Complete Case"** button
2. System checks documentation
3. If incomplete, prompts to document
4. Saves all documentation
5. ✅ Status changes to "Completed"
6. ✅ Actual end time recorded
7. ✅ OR released for cleaning
8. ✅ Case closed

---

## ❌ Cancelling a Surgical Case

### **How to Cancel:**
1. Open case detail
2. Click **"Cancel Case"** button
3. Enter cancellation reason
4. Click confirm
5. ✅ Status changes to "Cancelled"
6. ✅ OR released
7. ✅ Reason documented

### **Common Reasons:**
- Patient condition changed
- Equipment unavailable
- Surgeon unavailable
- Patient declined
- Emergency case took priority

---

## 📊 OR Metrics (Today's View)

### **Dashboard Metrics:**
- **Total Cases:** All scheduled cases today
- **Completed:** Successfully finished
- **In Progress:** Currently ongoing
- **Avg Duration:** Average case length in minutes

### **OR Utilization:**
- Rooms utilized
- Turnover times
- Efficiency metrics

---

## 🎯 Best Practices

### **Scheduling:**
- ✅ Schedule at least 24 hours in advance
- ✅ Verify consent obtained
- ✅ Confirm pre-op assessment done
- ✅ Check lab work completed
- ✅ Verify NPO status

### **Documentation:**
- ✅ Document findings in real-time
- ✅ Be specific and detailed
- ✅ Record all implants immediately
- ✅ Note any complications
- ✅ Complete documentation before finishing

### **Implant Tracking:**
- ✅ Track ALL implantable devices
- ✅ Scan UDI barcode when possible
- ✅ Double-check lot and serial numbers
- ✅ Verify expiration dates
- ✅ Document body site clearly

### **Safety:**
- ✅ Verify correct patient
- ✅ Verify correct procedure
- ✅ Verify correct site (laterality)
- ✅ Time-out before incision
- ✅ Count instruments/sponges

---

## 🔍 Searching & Filtering

### **Find a Case:**
- Use date selector to view specific date
- Toggle between Board and List view
- Click case to open details

### **View Options:**
- **Board View:** Visual timeline (recommended)
- **List View:** Traditional list format

---

## ❓ Troubleshooting

### **Issue: "OR not available at requested time"**
**Solution:** Another case is scheduled. Choose different time or OR.

### **Issue: "Cannot complete case without documentation"**
**Solution:** Click "Document Procedure" and fill required fields (Findings + Procedure Performed).

### **Issue: "Implant not saving"**
**Solution:** Ensure at least one identifier (UDI, Lot, or Serial) is entered.

---

## 📞 Support

For technical support or questions:
- Contact IT Help Desk
- Email: support@medicore.co.zw
- Phone: +263 XXX XXXX

---

## 🎓 Training Resources

### **Video Tutorials:**
- Scheduling a Surgery (5 min)
- Intraoperative Documentation (10 min)
- Implant Tracking (5 min)

### **Quick Reference:**
- OR Status Colors
- Case Priority Levels
- Anesthesia Types
- Surgical Approaches

---

**Version:** 1.0  
**Last Updated:** December 4, 2025  
**Module:** Operating Room Management

