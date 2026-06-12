# Triage Module — Bug & UX Issue Tracker

**Source:** System testing feedback (2026-06-12)  
**File:** `/feedback` (root)

---

## Bug 1 — "Top Reason: [object Object]" in Triage Copilot panel

**Priority:** HIGH  
**Symptom:** The Triage Copilot result panel shows `Top Reason: [object Object]` instead of a readable string.  
**Cause:** The CDSS response returns an object for the top reason field, and the frontend renders it directly without extracting the `.text` or `.term` property.  
**Fix:** In the triage copilot component, extract the string value before rendering:
```ts
// Before
topReason

// After
typeof topReason === 'object' ? topReason?.text || topReason?.term || JSON.stringify(topReason) : topReason
```
**Files to change:** Triage copilot result component (frontend)

---

## Bug 2 — "AI Assist" on Chief Complaint returns empty suggestions

**Priority:** HIGH  
**Symptom:** Clicking AI Assist on Chief Complaint shows "No diagnoses found. Try providing more detailed symptoms."  
**Root cause (from console):**
- `suggested_diagnoses: []` — CDSS service is unavailable (`cdss_unavailable: true`)
- Local fallback is also returning empty because the only symptom sent was `["Follow-up consultation"]` — this is a single vague term and the local rule engine finds no matches
**Fix options:**
1. When CDSS is unavailable and local fallback returns empty, show a generic message: "CDSS offline — enter diagnosis manually or try again shortly" instead of "No diagnoses found"
2. Ensure the chief complaint text is properly split into individual symptom tokens before sending to the CDSS API

---

## Bug 3 — CDSS Triage analysis output not useful for nurses

**Priority:** HIGH  
**Symptom:** The Triage Copilot panel shows technical output ("Risk: critical", "Escalation suggested: consider urgent provider review...") without actionable clinical guidance in plain language.  
**Fix:** Translate CDSS risk levels to nurse-friendly actions:
- `critical` → "⚠️ Call doctor NOW — do not leave patient unattended"
- `high` → "Fetch senior nurse or doctor within 10 minutes"
- `medium` → "Monitor every 30 minutes; escalate if deteriorates"
- `low` → "Routine care; reassess in 1 hour"

Confidence score of `0.0` also needs to be hidden from the nurse-facing view (show only in debug/admin mode).

---

## Bug 4 — Pain Score on Triage form duplicates Vitals

**Priority:** MEDIUM  
**Symptom:** "Pain Score (0-10)" appears on the Triage Assessment form AND also in the Vitals recording section.  
**Fix:** Remove pain score from the Vitals section. Pain score belongs on the Triage/Assessment form only. Vitals should contain: BP, HR, RR, Temperature, SpO2, Weight, Height, Blood Glucose.

---

## Bug 5 — Chief Complaint search boxes non-functional (×2)

**Priority:** HIGH  
**Symptom:** There are two search boxes near "Chief Complaint":
1. A search box at the top of the Chief Complaint section — does nothing when typed in
2. A search box to the right of "Chief Complaint" label — also does nothing

**Fix:** Remove both non-functional search boxes. Replace with a single SNOMED-powered autocomplete on the Chief Complaint field (which likely already exists elsewhere on the form).

---

## Bug 6 — "Cancel" button does nothing meaningful

**Priority:** MEDIUM  
**Symptom:** The Cancel button on the triage form does not navigate away or clear the form.  
**Fix:** Cancel should either:
- Route back to the patient list / triage queue
- Clear the form and show a confirmation prompt if data has been entered

---

## UX Issue — Triage page is too bloated

**Priority:** MEDIUM  
**Feedback:** "The triage page is so bloated — anything that seems like a repetition needs to go and make the page simple yet powerful."

**Suggested simplifications:**
1. Remove duplicate pain score (see Bug 4)
2. Remove duplicate/non-functional search boxes (see Bug 5)
3. Group fields into logical accordion sections: **Patient Vitals**, **Clinical Assessment**, **Triage Decision** — collapsed by default, expanded on click
4. Move the Triage Copilot AI panel into a collapsible sidebar so it doesn't crowd the main form
5. Show SATS colour category prominently (RED/ORANGE/YELLOW/GREEN) at the top of the form once vitals are entered

---

## Status Table

| # | Issue | Priority | Status |
|---|-------|----------|--------|
| 1 | `[object Object]` in Top Reason | HIGH | ⬜ Open |
| 2 | AI Assist returns empty diagnoses | HIGH | ⬜ Open |
| 3 | CDSS output not useful for nurses | HIGH | ⬜ Open |
| 4 | Duplicate pain score in Vitals | MEDIUM | ⬜ Open |
| 5 | Two broken search boxes | HIGH | ⬜ Open |
| 6 | Cancel button non-functional | MEDIUM | ⬜ Open |
| 7 | Page too bloated / UX simplification | MEDIUM | ⬜ Open |
