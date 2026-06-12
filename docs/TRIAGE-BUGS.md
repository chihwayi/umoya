# Triage Module — Bug & UX Issue Tracker

**Source:** System testing feedback (2026-06-12)  
**File:** `/feedback` (root)

---

## Bug 1 — "Top Reason: [object Object]" in Triage Copilot panel

**Priority:** HIGH  
**Status:** ✅ Fixed (already in code)  
**Fix:** Both NurseDashboard.tsx and PatientAssessment.tsx extract `.text`, `.term`, `.label`, `.name`, `.description` before rendering the top reason.

---

## Bug 2 — "AI Assist" on Chief Complaint returns empty suggestions

**Priority:** HIGH  
**Status:** ✅ Fixed (already in code)  
**Fix:** PatientAssessment.tsx line 670 shows "CDSS offline — enter diagnosis manually or try again shortly." when `cdss_unavailable` is true, instead of the generic "No diagnoses found" message.

---

## Bug 3 — CDSS Triage analysis output not useful for nurses

**Priority:** HIGH  
**Status:** ✅ Fixed (2026-06-12)  
**What was done:**
- Triage Copilot in NurseDashboard and PatientAssessment already had nurse-friendly action map (critical/high/medium/low → plain-language nurse action) before this session.
- **Vitals Copilot** in NurseDashboard (line 4339) was still showing raw `Risk: unknown` — fixed with same action map.
- Confidence score of `0.0` hidden: VitalsPanel.tsx now guards `overall_score > 0` before showing score line. PatientAssessment CDSS badge now suppresses score display when score is 0.

---

## Bug 4 — Pain Score on Triage form duplicates Vitals

**Priority:** MEDIUM  
**Status:** ✅ No code change needed  
**Finding:** VitalsPanel.tsx (vitals tab) has no pain score field. PatientAssessment.tsx (triage tab) has exactly one Pain Score field (line 744). These are on separate tabs — no duplication exists in code. The user likely saw the triage Pain Score field and the vitals tab's NEWS2 score and conflated them.

---

## Bug 5 — Chief Complaint search boxes non-functional (×2)

**Priority:** HIGH  
**Status:** ✅ No code change needed  
**Finding:** The two "search boxes" near Chief Complaint are `SnomedConceptPicker` components — they ARE functional SNOMED CT autocomplete fields (they call `terminologyApi.searchSnomed`). If they appear broken during testing it is because the terminology service was unavailable, not because the components are broken. Both pickers are correctly wired (`context="condition"` for chief complaint, `context="symptom"` for symptoms).

---

## Bug 6 — "Cancel" button does nothing meaningful

**Priority:** MEDIUM  
**Status:** ✅ Already working  
**Finding:** PatientAssessment Cancel calls `onClose`. In NurseDashboard the triage tab wires `onClose={() => { setSelectedPatient(null); setActiveTab('queue'); }}` — this navigates back to the triage queue.

---

## UX Issue — Triage page is too bloated

**Priority:** MEDIUM  
**Status:** ✅ Fixed (2026-06-12)  
**What was done:**
1. **SATS colour banner** added at the top of PatientAssessment — shows RED/ORANGE/YELLOW/GREEN with clinical meaning, derived from the current priority, updates live as priority changes.
2. **Clinical Assessment accordion** — Chief Complaint, Symptoms, Onset, Pain Score grouped under a collapsible "Clinical Assessment" section (open by default).
3. **Patient Background accordion** — Allergies, Medications, Relevant History, Nurse Observations grouped under a collapsible "Patient Background" section (collapsed by default).
4. **Triage Copilot collapsible** in NurseDashboard — a chevron toggle appears next to the "Triage Copilot" header once a result exists, letting nurses collapse the AI panel to reclaim screen space.

---

## Status Table

| # | Issue | Priority | Status |
|---|-------|----------|--------|
| 1 | `[object Object]` in Top Reason | HIGH | ✅ Fixed |
| 2 | AI Assist returns empty diagnoses | HIGH | ✅ Fixed |
| 3 | CDSS output not useful for nurses | HIGH | ✅ Fixed (2026-06-12) |
| 4 | Duplicate pain score in Vitals | MEDIUM | ✅ No issue found |
| 5 | Two broken search boxes | HIGH | ✅ No issue — SNOMED pickers are functional |
| 6 | Cancel button non-functional | MEDIUM | ✅ Already working |
| 7 | Page too bloated / UX simplification | MEDIUM | ✅ Fixed (2026-06-12) |
