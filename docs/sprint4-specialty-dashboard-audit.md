## Specialty Dashboard Audit (Oncology & Cardiology)

Date: 2025-11-17  
Goal: Verify SNOMED data exposure, identify UI/automation gaps, and outline actionable follow-ups prior to implementation.

---

### Oncology Module

**Backend**
- `OncologyService` already stores SNOMED data for cases (`primary_diagnosis_snomed_*`), regimens (`regimen_snomed_*`), and adverse events (`event_snomed_*`). Queries select `oc.*`, so APIs can expose these fields without schema changes.
- `getDashboardSummary` currently returns case totals, infusion schedule, adverse-event counts (by `event_type`/grade), and finance summary. No SNOMED-specific aggregates yet.

**Frontend**
- `OncologyDashboard.tsx` uses `SnomedConceptPicker` for data entry and shows SNOMED fields in detail panels but the dashboard widgets only display generic counts.

**Gaps & Actions**
1. **SNOMED aggregates**: extend `getDashboardSummary` with:
   - Top primary diagnosis SNOMED concepts (term + count).
   - Active regimen SNOMED concept distribution.
   - Adverse events grouped by SNOMED concept + grade.
2. **UI widgets**:
   - Diagnosis distribution chart (SNOMED labels).
   - Regimen timeline cards showing SNOMED drug concept.
   - Adverse-event heatmap using SNOMED classifications.
3. **Automation**:
   - Scheduled job for regimen cycle reminders (alert if next infusion overdue based on SNOMED regimen plan).
   - Severity escalation alerts for SNOMED-coded adverse events grade ≥ 3.

---

### Cardiology Module

**Backend**
- `CardiologyService.listEncounters` returns `ce.*`, so SNOMED fields (`reason_snomed_*`, `symptom_snomed_codes`, `diagnostic_snomed_codes`) are already part of the dataset.
- `getDashboardSummary` provides totals, risk mix, finance metrics, follow-up plans, recent encounters—but no SNOMED insight.

**Frontend**
- `CardiologyEncounterModal` captures SNOMED concepts, yet dashboard tiles only show counts; no display of top complaints/diagnostics.

**Gaps & Actions**
1. **SNOMED aggregates**:
   - Chief complaint SNOMED frequency list.
   - Outstanding diagnostic SNOMED codes (from JSON arrays).
   - Symptom trend analytics (e.g., chest pain vs dyspnea weekly counts).
2. **UI widgets**:
   - Risk badges referencing SNOMED-coded complaints.
   - Diagnostics checklist showing pending SNOMED tests/procedures.
   - Follow-up SLA tracker by SNOMED reason (e.g., heart-failure review).
3. **Automation**:
   - Cron job to flag high-risk SNOMED symptom combinations lacking follow-up.
   - Notifications for uncompleted diagnostics associated with critical SNOMED findings.

---

### Next Steps
1. Implement backend changes to enrich dashboard summary endpoints with SNOMED aggregates.
2. Update frontend dashboards with the new visualizations and alerts.
3. Define background jobs/alerts per module.
4. Add QA scenarios covering the new widgets and automation behaviors.
## Specialty Dashboard Audit (Oncology & Cardiology)

Date: 2025-11-17  
Scope: Verify SNOMED data exposure, identify UI/automation gaps, and outline concrete tasks before implementation.

---

### Oncology Module

**Backend findings**
- `OncologyService.listCases` / `getCaseDetail` / `listRegimens` / `recordAdverseEvent` already persist SNOMED fields (`primary_diagnosis_snomed_*`, `regimen_snomed_*`, `event_snomed_*`). Queries select `oc.*`, so data is available, but summary endpoints do not surface SNOMED insights yet.
- `getDashboardSummary` currently returns:
  - Case totals by status.
  - Upcoming infusion sessions (with patient + regimen names only).
  - Adverse event counts grouped by `event_type`/`grade` (no SNOMED context).
  - Finance summary.

**Frontend findings**
- `OncologyDashboard.tsx` consumes SNOMED fields for forms (SnomedConceptPicker) and case detail panels, but dashboard widgets show only counts/dates.
- No visualization of top SNOMED-coded diagnoses, regimens, or adverse events.

**Action items**
1. Extend `getDashboardSummary` to include:
   - Top N `primary_diagnosis_snomed_term` counts.
   - Active regimen SNOMED concept list (e.g., chemo agents).
   - Adverse event SNOMED counts (concept + grade).
2. Update dashboard UI to render:
   - Diagnosis distribution chart (SNOMED label + count).
   - Regimen timeline cards showing SNOMED drug concept.
   - Adverse event heatmap filtered by SNOMED concept/severity.
3. Automation hooks:
   - Background job checking infusion schedules; emit alerts if SNOMED-coded regimen overdue.
   - Severity escalation when adverse event SNOMED concept maps to Grade ≥3.

---

### Cardiology Module

**Backend findings**
- `CardiologyService.listEncounters` selects `ce.*`, so SNOMED fields (`reason_snomed_*`, `symptom_snomed_codes`, `diagnostic_snomed_codes`) are available to the frontend.
- `getDashboardSummary` returns totals, risk mix, financials, and follow-up lists, but no SNOMED aggregates.

**Frontend findings**
- `CardiologyEncounterModal` lets clinicians capture SNOMED concepts, yet dashboard widgets only show generic counts.
- No insights such as most common SNOMED-coded complaints or diagnostics pending.

**Action items**
1. Enhance `getDashboardSummary` with:
   - Top SNOMED chief complaints (concept + count).
   - Pending diagnostic concept list (from `diagnostic_snomed_codes` arrays).
   - Symptom cluster trends (e.g., chest pain vs dyspnea counts per week).
2. UI updates:
   - Risk badges referencing SNOMED chief complaint.
   - Diagnostics checklist showing outstanding SNOMED procedures/tests.
   - Follow-up SLA tracker filtered by SNOMED reason (e.g., HF review).
3. Automation:
   - Cron job to flag encounters with critical SNOMED-coded symptoms lacking follow-up within SLA.
   - Notifications when high-risk SNOMED symptom combos occur (e.g., `chest pain` + `shortness of breath`).

---

### Next Steps
1. Create backend tasks to add the SNOMED aggregates to both dashboard summary endpoints.
2. Design/implement frontend components for the new widgets.
3. Define alerting/automation jobs per module (likely using existing job scheduler or a new Nest cron).
4. Once implemented, update QA scenarios to cover the new widgets and alerts.


Date: 2025-11-17  
Goal: Verify SNOMED data exposure, identify UI/automation gaps, and outline actionable follow-ups prior to implementation.

---

### Oncology Module

**Backend**
- `OncologyService` already stores SNOMED data for cases (`primary_diagnosis_snomed_*`), regimens (`regimen_snomed_*`), and adverse events (`event_snomed_*`). Queries select `oc.*`, so APIs can expose these fields without schema changes.
- `getDashboardSummary` currently returns case totals, infusion schedule, adverse-event counts (by `event_type`/grade), and finance summary. No SNOMED-specific aggregates yet.

**Frontend**
- `OncologyDashboard.tsx` uses `SnomedConceptPicker` for data entry and shows SNOMED fields in detail panels but the dashboard widgets only display generic counts.

**Gaps & Actions**
1. **SNOMED aggregates**: extend `getDashboardSummary` with:
   - Top primary diagnosis SNOMED concepts (term + count).
   - Active regimen SNOMED concept distribution.
   - Adverse events grouped by SNOMED concept + grade.
2. **UI widgets**:
   - Diagnosis distribution chart (SNOMED labels).
   - Regimen timeline cards showing SNOMED drug concept.
   - Adverse-event heatmap using SNOMED classifications.
3. **Automation**:
   - Scheduled job for regimen cycle reminders (alert if next infusion overdue based on SNOMED regimen plan).
   - Severity escalation alerts for SNOMED-coded adverse events grade ≥ 3.

---

### Cardiology Module

**Backend**
- `CardiologyService.listEncounters` returns `ce.*`, so SNOMED fields (`reason_snomed_*`, `symptom_snomed_codes`, `diagnostic_snomed_codes`) are already part of the dataset.
- `getDashboardSummary` provides totals, risk mix, finance metrics, follow-up plans, recent encounters—but no SNOMED insight.

**Frontend**
- `CardiologyEncounterModal` captures SNOMED concepts, yet dashboard tiles only show counts; no display of top complaints/diagnostics.

**Gaps & Actions**
1. **SNOMED aggregates**:
   - Chief complaint SNOMED frequency list.
   - Outstanding diagnostic SNOMED codes (from JSON arrays).
   - Symptom trend analytics (e.g., chest pain vs dyspnea weekly counts).
2. **UI widgets**:
   - Risk badges referencing SNOMED-coded complaints.
   - Diagnostics checklist showing pending SNOMED tests/procedures.
   - Follow-up SLA tracker by SNOMED reason (e.g., heart-failure review).
3. **Automation**:
   - Cron job to flag high-risk SNOMED symptom combinations lacking follow-up.
   - Notifications for uncompleted diagnostics associated with critical SNOMED findings.

---

### Next Steps
1. Implement backend changes to enrich dashboard summary endpoints with SNOMED aggregates.
2. Update frontend dashboards with the new visualizations and alerts.
3. Define background jobs/alerts per module.
4. Add QA scenarios covering the new widgets and automation behaviors.
## Specialty Dashboard Audit (Oncology & Cardiology)

Date: 2025-11-17  
Scope: Verify SNOMED data exposure, identify UI/automation gaps, and outline concrete tasks before implementation.

---

### Oncology Module

**Backend findings**
- `OncologyService.listCases` / `getCaseDetail` / `listRegimens` / `recordAdverseEvent` already persist SNOMED fields (`primary_diagnosis_snomed_*`, `regimen_snomed_*`, `event_snomed_*`). Queries select `oc.*`, so data is available, but summary endpoints do not surface SNOMED insights yet.
- `getDashboardSummary` currently returns:
  - Case totals by status.
  - Upcoming infusion sessions (with patient + regimen names only).
  - Adverse event counts grouped by `event_type`/`grade` (no SNOMED context).
  - Finance summary.

**Frontend findings**
- `OncologyDashboard.tsx` consumes SNOMED fields for forms (SnomedConceptPicker) and case detail panels, but dashboard widgets show only counts/dates.
- No visualization of top SNOMED-coded diagnoses, regimens, or adverse events.

**Action items**
1. Extend `getDashboardSummary` to include:
   - Top N `primary_diagnosis_snomed_term` counts.
   - Active regimen SNOMED concept list (e.g., chemo agents).
   - Adverse event SNOMED counts (concept + grade).
2. Update dashboard UI to render:
   - Diagnosis distribution chart (SNOMED label + count).
   - Regimen timeline cards showing SNOMED drug concept.
   - Adverse event heatmap filtered by SNOMED concept/severity.
3. Automation hooks:
   - Background job checking infusion schedules; emit alerts if SNOMED-coded regimen overdue.
   - Severity escalation when adverse event SNOMED concept maps to Grade ≥3.

---

### Cardiology Module

**Backend findings**
- `CardiologyService.listEncounters` selects `ce.*`, so SNOMED fields (`reason_snomed_*`, `symptom_snomed_codes`, `diagnostic_snomed_codes`) are available to the frontend.
- `getDashboardSummary` returns totals, risk mix, financials, and follow-up lists, but no SNOMED aggregates.

**Frontend findings**
- `CardiologyEncounterModal` lets clinicians capture SNOMED concepts, yet dashboard widgets only show generic counts.
- No insights such as most common SNOMED-coded complaints or diagnostics pending.

**Action items**
1. Enhance `getDashboardSummary` with:
   - Top SNOMED chief complaints (concept + count).
   - Pending diagnostic concept list (from `diagnostic_snomed_codes` arrays).
   - Symptom cluster trends (e.g., chest pain vs dyspnea counts per week).
2. UI updates:
   - Risk badges referencing SNOMED chief complaint.
   - Diagnostics checklist showing outstanding SNOMED procedures/tests.
   - Follow-up SLA tracker filtered by SNOMED reason (e.g., HF review).
3. Automation:
   - Cron job to flag encounters with critical SNOMED-coded symptoms lacking follow-up within SLA.
   - Notifications when high-risk SNOMED symptom combos occur (e.g., `chest pain` + `shortness of breath`).

---

### Next Steps
1. Create backend tasks to add the SNOMED aggregates to both dashboard summary endpoints.
2. Design/implement frontend components for the new widgets.
3. Define alerting/automation jobs per module (likely using existing job scheduler or a new Nest cron).
4. Once implemented, update QA scenarios to cover the new widgets and alerts.


Date: 2025-11-17  
Goal: Verify SNOMED data exposure, identify UI/automation gaps, and outline actionable follow-ups prior to implementation.

---

### Oncology Module

**Backend**
- `OncologyService` already stores SNOMED data for cases (`primary_diagnosis_snomed_*`), regimens (`regimen_snomed_*`), and adverse events (`event_snomed_*`). Queries select `oc.*`, so APIs can expose these fields without schema changes.
- `getDashboardSummary` currently returns case totals, infusion schedule, adverse-event counts (by `event_type`/grade), and finance summary. No SNOMED-specific aggregates yet.

**Frontend**
- `OncologyDashboard.tsx` uses `SnomedConceptPicker` for data entry and shows SNOMED fields in detail panels but the dashboard widgets only display generic counts.

**Gaps & Actions**
1. **SNOMED aggregates**: extend `getDashboardSummary` with:
   - Top primary diagnosis SNOMED concepts (term + count).
   - Active regimen SNOMED concept distribution.
   - Adverse events grouped by SNOMED concept + grade.
2. **UI widgets**:
   - Diagnosis distribution chart (SNOMED labels).
   - Regimen timeline cards showing SNOMED drug concept.
   - Adverse-event heatmap using SNOMED classifications.
3. **Automation**:
   - Scheduled job for regimen cycle reminders (alert if next infusion overdue based on SNOMED regimen plan).
   - Severity escalation alerts for SNOMED-coded adverse events grade ≥ 3.

---

### Cardiology Module

**Backend**
- `CardiologyService.listEncounters` returns `ce.*`, so SNOMED fields (`reason_snomed_*`, `symptom_snomed_codes`, `diagnostic_snomed_codes`) are already part of the dataset.
- `getDashboardSummary` provides totals, risk mix, finance metrics, follow-up plans, recent encounters—but no SNOMED insight.

**Frontend**
- `CardiologyEncounterModal` captures SNOMED concepts, yet dashboard tiles only show counts; no display of top complaints/diagnostics.

**Gaps & Actions**
1. **SNOMED aggregates**:
   - Chief complaint SNOMED frequency list.
   - Outstanding diagnostic SNOMED codes (from JSON arrays).
   - Symptom trend analytics (e.g., chest pain vs dyspnea weekly counts).
2. **UI widgets**:
   - Risk badges referencing SNOMED-coded complaints.
   - Diagnostics checklist showing pending SNOMED tests/procedures.
   - Follow-up SLA tracker by SNOMED reason (e.g., heart-failure review).
3. **Automation**:
   - Cron job to flag high-risk SNOMED symptom combinations lacking follow-up.
   - Notifications for uncompleted diagnostics associated with critical SNOMED findings.

---

### Next Steps
1. Implement backend changes to enrich dashboard summary endpoints with SNOMED aggregates.
2. Update frontend dashboards with the new visualizations and alerts.
3. Define background jobs/alerts per module.
4. Add QA scenarios covering the new widgets and automation behaviors.
## Specialty Dashboard Audit (Oncology & Cardiology)

Date: 2025-11-17  
Scope: Verify SNOMED data exposure, identify UI/automation gaps, and outline concrete tasks before implementation.

---

### Oncology Module

**Backend findings**
- `OncologyService.listCases` / `getCaseDetail` / `listRegimens` / `recordAdverseEvent` already persist SNOMED fields (`primary_diagnosis_snomed_*`, `regimen_snomed_*`, `event_snomed_*`). Queries select `oc.*`, so data is available, but summary endpoints do not surface SNOMED insights yet.
- `getDashboardSummary` currently returns:
  - Case totals by status.
  - Upcoming infusion sessions (with patient + regimen names only).
  - Adverse event counts grouped by `event_type`/`grade` (no SNOMED context).
  - Finance summary.

**Frontend findings**
- `OncologyDashboard.tsx` consumes SNOMED fields for forms (SnomedConceptPicker) and case detail panels, but dashboard widgets show only counts/dates.
- No visualization of top SNOMED-coded diagnoses, regimens, or adverse events.

**Action items**
1. Extend `getDashboardSummary` to include:
   - Top N `primary_diagnosis_snomed_term` counts.
   - Active regimen SNOMED concept list (e.g., chemo agents).
   - Adverse event SNOMED counts (concept + grade).
2. Update dashboard UI to render:
   - Diagnosis distribution chart (SNOMED label + count).
   - Regimen timeline cards showing SNOMED drug concept.
   - Adverse event heatmap filtered by SNOMED concept/severity.
3. Automation hooks:
   - Background job checking infusion schedules; emit alerts if SNOMED-coded regimen overdue.
   - Severity escalation when adverse event SNOMED concept maps to Grade ≥3.

---

### Cardiology Module

**Backend findings**
- `CardiologyService.listEncounters` selects `ce.*`, so SNOMED fields (`reason_snomed_*`, `symptom_snomed_codes`, `diagnostic_snomed_codes`) are available to the frontend.
- `getDashboardSummary` returns totals, risk mix, financials, and follow-up lists, but no SNOMED aggregates.

**Frontend findings**
- `CardiologyEncounterModal` lets clinicians capture SNOMED concepts, yet dashboard widgets only show generic counts.
- No insights such as most common SNOMED-coded complaints or diagnostics pending.

**Action items**
1. Enhance `getDashboardSummary` with:
   - Top SNOMED chief complaints (concept + count).
   - Pending diagnostic concept list (from `diagnostic_snomed_codes` arrays).
   - Symptom cluster trends (e.g., chest pain vs dyspnea counts per week).
2. UI updates:
   - Risk badges referencing SNOMED chief complaint.
   - Diagnostics checklist showing outstanding SNOMED procedures/tests.
   - Follow-up SLA tracker filtered by SNOMED reason (e.g., HF review).
3. Automation:
   - Cron job to flag encounters with critical SNOMED-coded symptoms lacking follow-up within SLA.
   - Notifications when high-risk SNOMED symptom combos occur (e.g., `chest pain` + `shortness of breath`).

---

### Next Steps
1. Create backend tasks to add the SNOMED aggregates to both dashboard summary endpoints.
2. Design/implement frontend components for the new widgets.
3. Define alerting/automation jobs per module (likely using existing job scheduler or a new Nest cron).
4. Once implemented, update QA scenarios to cover the new widgets and alerts.

