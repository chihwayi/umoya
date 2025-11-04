# Enhanced HIV Clinical Visit Schema Design

Based on Zimbabwe National HIV Guidelines and WHO/PEPFAR standards.

## Visit Types (from Form Section 2)
- A: Present self (Conventional Care) - Full clinical visit
- B: Sent Care Giver/Treatment Supporter - Drug pickup only
- C: Visit made at another clinic - External visit record
- D: Community ART Refill Group member (CARG) - Group pickup
- E: Group Facility Pick-up - Group pickup at facility
- F: Individual Pick-up from Pharmacy - Drug refill only
- G: Individual Pick-up via Mobile Outreach - Mobile service

## Data Points to Capture

### Core Visit Information
1. Visit number (sequential)
2. Visit type (A-G)
3. Visit date
4. Provider ID (doctor/nurse)

### Vital Signs & Measurements
5. Weight (kg)
6. Height (cm) - for children <15 years
7. Blood Pressure
8. BMI (calculated)

### Reproductive Health
9. Pregnancy/Lactating Status (P/L/NPL/N/A)
10. Date of 1st ANC booking
11. Delivery date
12. Family Planning Status (multiple: A/O/P/J/M/Z/C/T/L)

### Clinical Status
13. Functional Status (W/A/B)
14. WHO Clinical Stage (1-4)
15. Opportunistic Infections & Other Problems (multiple codes)

### TB Status
16. TB Screening (Y/S/ON/N)
17. TB Investigation Result (1-5)
18. TB Diagnosis date
19. TB Treatment started

### TPT (Tuberculosis Preventive Therapy)
20. IPT Eligibility (Y/N)
21. TPT Status (II/CI/RI/IS/HPI/IC/INI/NE/N/A)
22. Reason for not starting/stopping TPT
23. TPT Quantity dispensed
24. TPT % Adherence

### Prophylaxis
25. Cotrimoxazole quantity dispensed
26. Cotrimoxazole % Adherence
27. Fluconazole quantity prescribed
28. Fluconazole quantity dispensed

### ARV Status & Regimens
29. ARV Status (1=No ARV, 2=Start, 2b=Start after re-test, 3=Continue, 4=Change, 5=Stop, 6=Restart, 7=PMTCT)
30. ARV Reason (for starting/not starting/changing/stopping)
31. ARV Regimen code (1a-1j, 2a-2l, 3a, 4a-4k, 5a-5i, 6a)
32. ARV Medicine details
33. ARV Quantity prescribed
34. ARV Quantity dispensed
35. ARV % Adherence

### Lab Results
36. CD4 count
37. CD4 %
38. CD4 test date
39. Viral Load
40. Viral Load unit (copies/mL)
41. Viral Load test date
42. Viral Load suppressed (boolean)
43. ALT (Alanine Transaminase)
44. Creatinine
45. Other diagnostics tests

### Adverse Events
46. Adverse Events Status (a-l for different medications)

### Referrals & Follow-up
47. Referred To (P/T/F/D/H/O)
48. Next Review date
49. Visit Status (E/OT/L/D/LO)
50. Follow-up Status (Tx/Miss/LTFU/TO/D/OO/O)

### Clinical Notes
51. Visit notes
52. Clinician initials
53. Pharmacy dispenser initials

## Role-Based Permissions

### Nurse Permissions:
- ✅ Create visits (all types)
- ✅ Enter vital signs
- ✅ Record drug pickups (types B, D, E, F, G)
- ✅ Enter adherence data
- ✅ Record prophylaxis dispensed
- ✅ Update visit status
- ❌ Change ARV regimen (requires doctor approval)
- ❌ Change ARV status (Start/Change/Stop - requires doctor)
- ❌ Modify lab results (read-only)
- ❌ Change TPT status (can record, doctor must approve changes)

### Doctor Permissions:
- ✅ All nurse permissions
- ✅ Change ARV regimen
- ✅ Change ARV status (Start/Change/Stop/Restart)
- ✅ Modify lab results
- ✅ Change TPT status
- ✅ Approve regimen changes initiated by nurses
- ✅ Set WHO stage
- ✅ Diagnose OIs and other problems

## Smart Form Logic

1. **Visit Type Detection**: Form adapts based on visit type
   - Drug pickup (B, D, E, F, G): Show only drug-related fields
   - Clinical visit (A, C): Show full form

2. **Previous Visit Data**: Auto-populate from last visit
   - Current regimen
   - Last CD4/VL
   - Current prophylaxis status

3. **Validation Rules**:
   - Cannot change regimen without doctor approval
   - Cannot stop ARV without reason
   - TPT eligibility check based on TB status
   - Pregnancy status required for female patients

4. **CDSS Integration**:
   - Suggest regimen changes based on clinical status
   - Alert on treatment failure indicators
   - Recommend lab tests based on time since last test

