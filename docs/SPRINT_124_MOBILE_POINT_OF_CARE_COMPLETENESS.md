# Sprint 124 — Mobile Point-of-Care Completeness

**Created:** 2026-03-27
**Branch:** `feat/sprint-124-mobile-poc`
**Scope:** Mobile app only (`mobile/src/`)
**Priority:** P1 — Clinical workflow completeness
**Rationale:** Mobile app covers the core data-viewing loop but is missing the point-of-care *action* features that clinicians and patients need when away from a desktop. This sprint draws a deliberate boundary: heavy complex workflows (DICOM, pharmacy ops, claims, specialty dashboards) stay on the web. Mobile gets the 8 features clinicians actually need in the ward.

---

## Feature Inventory & Traceability Matrix

| # | Feature | Role | New / Modify | Files Touched | API Endpoint(s) | CDSS Surface |
|---|---------|------|--------------|---------------|-----------------|--------------|
| F1 | Patient Appointments Screen | Patient | **New** | `PatientAppointmentsScreen.tsx`, `PatientNavigator.tsx` | `GET /patient-portal/appointments`, `POST /patient-portal/appointments/request`, `PUT /appointments/:id/status` | — |
| F2 | Post-Visit AI Chat (real) | Patient | **Modify** | `PatientPostVisitScreen.tsx` | `POST /patient-ai/adherence/chat`, `GET /patient-ai/adherence/patient/:id` | — |
| F3 | Nurse Triage Queue | Nurse | **Modify** | `NurseShiftScreen.tsx` | `GET /nurse-worklist/state` (`.triage` array) | — |
| F4 | Nurse Task List | Nurse | **Modify** | `NurseShiftScreen.tsx` | `GET /nurse-worklist/state` (`.tasks` array), `PATCH /nurse-worklist/tasks/:id/complete` | — |
| F5 | Nurse SBAR Generation | Nurse | **New** | `NurseShiftScreen.tsx` (sheet), `cdss.ts` | `POST /governed/json` | `sbar_generation` |
| F6 | Nurse Fall Risk Assessment | Nurse | **New** | `NurseShiftScreen.tsx` (inline per patient), `cdss.ts` | `POST /governed/json` | `fall_risk_assessment` |
| F7 | Doctor Imaging Report Viewer | Doctor | **New** | `DoctorImagingReportScreen.tsx`, `imaging.ts` (service), `DoctorRoundsScreen.tsx` (link) | `GET /imaging/orders/patient/:id`, `GET /imaging/reports/:reportId` | — |
| F8 | Doctor Medication Reconciliation | Doctor | **New** | `DoctorMedRecScreen.tsx`, `cdss.ts`, `DoctorRoundsScreen.tsx` (link) | `GET /prescriptions/patient/:id`, `POST /governed/json` | `medication_reconciliation` |

---

## F1 — Patient Appointments Screen

### Purpose
Patients need to see upcoming appointments and request bookings from their phone — a primary patient-facing action that is entirely absent from mobile today.

### Service Layer
`AppointmentsService` already exists at `mobile/src/services/appointments.ts` with:
- `upcoming(patientId?)` — GET `/patient-portal/appointments?status=scheduled,confirmed&limit=5`
- `book(dto)` — POST `/patient-portal/appointments/request`
- `cancel(id)` — PUT `/appointments/:id/status` → `{ status: 'cancelled' }`

No changes needed to the service.

### New File: `mobile/src/components/patient/PatientAppointmentsScreen.tsx`

**State:**
```ts
appointments: ApiAppointment[]        // loaded on mount
loading: boolean
showBookSheet: boolean                // bottom sheet to request appointment
bookForm: { date: string; type: string; notes: string }
bookLoading: boolean
```

**On mount:** `AppointmentsService.upcoming()` → populate appointments. Catch → `[]`.

**UI Sections:**
1. **Upcoming list** — each card shows: doctor name, specialty, date+time, status badge (colour-coded), location/telemedicine indicator, `[Cancel]` action for scheduled/confirmed.
2. **"Request Appointment" FAB** → opens bottom sheet with: appointment type selector (Consultation / Follow-up / Telemedicine), preferred date picker (date input), optional notes field, `[Submit Request]` button → calls `AppointmentsService.book(dto)` → success snackbar → closes sheet → refreshes list.
3. **Empty state** — "No upcoming appointments — tap + to request one."

**Navigator change:** Add `PatientAppointmentsScreen` tab to `PatientNavigator.tsx` (tab icon: `calendar`).

### Acceptance Criteria
- [ ] Upcoming appointments render with correct status colour
- [ ] Cancel updates status immediately in list (optimistic)
- [ ] Book sheet submits and list refreshes
- [ ] Empty state renders when no appointments
- [ ] TypeScript compiles with zero errors

---

## F2 — Post-Visit AI Chat (Real API)

### Purpose
`PatientPostVisitScreen.tsx` currently contains a large `AI_RESPONSES` map and a `getAiResponse()` keyword matcher that returns hardcoded NSTEMI-specific text — completely disconnected from the actual patient's visit data. This must be replaced with real calls to the PostVisit AI service.

### Service Available
`PatientAiService` at `mobile/src/services/patientAi.ts`:
- `chat(dto: AdherenceChatDto)` — POST `/patient-ai/adherence/chat` — returns `AiChatMessage { role, content, citations?, sessionId? }`
- `chatHistory(patientId, sessionId?)` — GET `/patient-ai/adherence/patient/:id` — returns message history

### Modify: `mobile/src/components/patient/PatientPostVisitScreen.tsx`

**Remove entirely:**
- `AI_RESPONSES` constant (lines 80–88)
- `getAiResponse()` function (lines 90–99)

**Add state:**
```ts
chatSessionId: string | undefined    // persisted per selected visit
chatLoading: boolean
```

**Load chat history on visit select:** Call `PatientAiService.chatHistory(user.id, sessionId)` → map to `ChatMessage[]` → set as initial messages.

**Replace `handleSend`:** Instead of `getAiResponse(text)`, call:
```ts
PatientAiService.chat({
  patientId: user.id,
  message: text,
  sessionId: chatSessionId,
  context: {
    medications: selectedVisit.diagnoses.map(d => ({ name: d.name, dose: '' })),
  },
})
```
On response: append `{ role: 'ai', text: res.content, ... }` to messages. Store `res.sessionId` as `chatSessionId`. On error: append fallback message `"I'm not available right now — please try again shortly."` (no hardcoded clinical content).

**Suggested questions:** Keep as UI prompts (they just pre-fill the text input) — they are UX affordances, not answers.

### Acceptance Criteria
- [ ] Zero hardcoded clinical response text remains
- [ ] AI reply comes from `/patient-ai/adherence/chat`
- [ ] Session persists per visit selection
- [ ] Chat history loads on revisit
- [ ] Network error shows graceful fallback message

---

## F3 — Nurse Triage Queue

### Purpose
Nurses in ED/OPD triage patients on the floor using their device. The `NurseWorklistService.state()` already returns a `.triage: TriageEntry[]` array — it just has no UI.

### Modify: `mobile/src/components/nurse/NurseShiftScreen.tsx`

**Existing state** (`aiSummary`, `doctors`) already loaded. **Add to existing load:**
```ts
const ws = await NurseWorklistService.state();
setTasks(ws.tasks ?? []);
setTriage(ws.triage ?? []);
```

**Add `triage` tab** to the existing tab bar (Shift / Vitals / Triage / Tasks).

**Triage Tab UI:**
- `FlatList` of `TriageEntry` cards sorted by `esiLevel ASC` (most critical first)
- Each card: patient name, chief complaint, ESI level badge (1=red/Resuscitation, 2=orange/Emergent, 3=yellow/Urgent, 4=green/Less Urgent, 5=blue/Non-Urgent), wait time
- ESI colour map: `{ 1: C.red, 2: C.orange, 3: C.yellow, 4: C.green, 5: C.blue }`
- Empty state: "No triage entries"

### Acceptance Criteria
- [ ] Triage tab renders ESI-sorted patient list
- [ ] ESI badge colour matches severity
- [ ] Empty state shows when no entries

---

## F4 — Nurse Task List

### Purpose
Nurses carry their device through the ward and need to see and complete tasks without going to a desktop. `NurseWorklistService.state().tasks` returns `NurseWorklistTask[]` — needs a UI with mark-complete action.

### Modify: `mobile/src/components/nurse/NurseShiftScreen.tsx`

**Add `tasks` tab** (Shift / Vitals / Triage / **Tasks**).

**Task Tab UI:**
- Sort tasks: URGENT → HIGH → MED → LOW
- Each card: priority badge, patient name + bed, task description, due time, `[Complete]` button
- `[Complete]` → optimistic update (remove from list or grey out) + call `PATCH /nurse-worklist/tasks/:id/complete` (add method to `NurseWorklistService`)
- Overdue tasks (dueTime < now) highlighted with `C.red` border

**Add to `NurseWorklistService`:**
```ts
completeTask: (id: string) =>
  api.patch(`/nurse-worklist/tasks/${id}/complete`, {}).then(r => r.data),
```

### Acceptance Criteria
- [ ] Tasks sorted by priority
- [ ] Overdue tasks visually highlighted
- [ ] Complete action removes task from list optimistically
- [ ] API PATCH fires on complete
- [ ] Empty state: "All tasks complete ✓"

---

## F5 — Nurse SBAR Generation

### Purpose
SBAR (Situation–Background–Assessment–Recommendation) handoff notes are written at the bedside during shift handover or escalation. This is a prime point-of-care AI use case: one tap, AI generates a structured handoff note for a specific patient.

### CDSS Endpoint
Web uses: `POST /governed/json` with surface `sbar` (or `sbar_generation`):
```json
{
  "surface": "sbar_generation",
  "payload": {
    "admission_diagnosis": "...",
    "current_vitals": { "sbp": 140, "hr": 88, ... },
    "current_medications": ["Metformin 500mg", ...],
    "patient_age": 54,
    "active_concerns": []
  }
}
```
Returns: `{ result: { sbar: { S: "...", B: "...", A: "...", R: "..." } }, abstained: boolean }`

### Add to `mobile/src/services/cdss.ts`
```ts
generateSBAR: async (params: {
  patientId: string;
  admissionDiagnosis: string;
  currentVitals: Record<string, number>;
  medications: string[];
  patientAge: number;
}) => { ... } // → { S: string; B: string; A: string; R: string } | null
```

### Modify: `mobile/src/components/nurse/NurseShiftScreen.tsx`

**Trigger:** Each patient card in the Shift tab gets a `[SBAR]` icon button.
**On tap:** Show a bottom sheet (modal) with:
- Title: "SBAR Handoff — [Patient Name]"
- Loading spinner while CDSS call in flight
- Result displays 4 labelled sections: **S**ituation / **B**ackground / **A**ssessment / **R**ecommendation
- `[Copy to Clipboard]` button
- If abstained/error: "SBAR unavailable — complete manually"

### Acceptance Criteria
- [ ] SBAR button visible per patient in worklist
- [ ] Sheet shows loading then S/B/A/R result
- [ ] Copy to clipboard works
- [ ] Abstained case shows graceful fallback
- [ ] Zero mock data

---

## F6 — Nurse Fall Risk Assessment

### Purpose
Fall risk is assessed in the patient's room. A nurse with a tablet needs a quick AI risk score before mobilising a patient. Triggered per patient, not a bulk operation.

### CDSS Endpoint
Web uses: `POST /governed/json` with surface `fall_risk_assessment`:
```json
{
  "surface": "fall_risk_assessment",
  "payload": {
    "age": 78,
    "diagnoses": ["Hip fracture", "Type 2 DM"],
    "medications": ["Furosemide", "Warfarin"],
    "gait": "impaired",
    "mental_status": "confused"
  }
}
```
Returns: `{ result: { risk_level: 'HIGH'|'MODERATE'|'LOW', score: number, factors: string[], interventions: string[] }, abstained: boolean }`

### Add to `mobile/src/services/cdss.ts`
```ts
assessFallRisk: async (params: {
  patientId: string;
  age: number;
  diagnoses: string[];
  medications: string[];
  gait: 'normal' | 'weak' | 'impaired';
  mentalStatus: 'oriented' | 'forgetful' | 'confused';
}) => { ... } // → { riskLevel: string; score: number; factors: string[]; interventions: string[] } | null
```

### Modify: `mobile/src/components/nurse/NurseShiftScreen.tsx`

**Trigger:** Each patient card in the Shift tab gets a `[Fall Risk]` icon button alongside `[SBAR]`.
**On tap:** Bottom sheet with:
- Risk level badge: HIGH (red) / MODERATE (amber) / LOW (green) + numeric score
- Risk factors list
- Recommended interventions list
- If abstained: "Fall risk assessment unavailable"

Inputs (gait, mental status) drawn from the patient's latest vitals/notes — default to `'normal'` / `'oriented'` if not available.

### Acceptance Criteria
- [ ] Fall Risk button visible per patient
- [ ] Sheet shows risk level badge + score + factors + interventions
- [ ] HIGH risk highlighted in red
- [ ] Abstained case gracefully handled

---

## F7 — Doctor Imaging Report Viewer (Text, No DICOM)

### Purpose
Doctors reviewing results at the bedside need to read radiology reports. Full DICOM belongs on the desktop. Mobile shows only the text report (radiologist's findings and impression).

### New Service: `mobile/src/services/imaging.ts`
```ts
export const ImagingService = {
  /** Orders for a patient — latest first */
  ordersForPatient: (patientId: string) =>
    api.get<ApiImagingOrder[]>(`/imaging/orders/patient/${patientId}`).then(r => r.data).catch(() => []),

  /** Final text report for a study */
  getReport: (reportId: string) =>
    api.get<ApiImagingReport>(`/imaging/reports/${reportId}`).then(r => r.data),
};

export interface ApiImagingOrder {
  id: string;
  studyType?: string;
  modality?: string;
  requestedAt?: string;
  status?: string;
  reportId?: string;           // present when report is available
  aiReviewSummary?: string;    // AI pre-read summary if available
}

export interface ApiImagingReport {
  id: string;
  findings?: string;
  impression?: string;
  radiologistName?: string;
  reportedAt?: string;
  aiSummary?: string;
}
```

### New Screen: `mobile/src/components/doctor/DoctorImagingReportScreen.tsx`

**Props:** `{ patientId: string; patientName: string }` (passed via route params)

**On mount:** `ImagingService.ordersForPatient(patientId)` → list of orders. Filter to those with `reportId` present (completed studies).

**UI:**
1. **Order list** — each row: modality badge, study type, date, status. Tap row if `reportId` present → load report.
2. **Report view** — shows:
   - **Findings** section (full text)
   - **Impression** section (highlighted, this is what matters)
   - Radiologist name + date
   - AI Pre-read card (if `aiSummary` present) with `AiPulse` indicator
3. **Orders with no report yet** show "Awaiting report" badge.
4. Empty state: "No imaging orders for this patient."

**Link from `DoctorRoundsScreen.tsx`:** Add `[Imaging]` button to each patient detail card that navigates to `DoctorImagingReportScreen` with `{ patientId, patientName }`.

### Acceptance Criteria
- [ ] Orders list renders with status badges
- [ ] Tapping a completed order loads and displays text report
- [ ] Findings and Impression clearly separated
- [ ] AI summary card visible when present
- [ ] Orders awaiting report show correct label
- [ ] Navigate back to rounds without state loss

---

## F8 — Doctor Medication Reconciliation

### Purpose
On admission, doctors reconcile medications from home with what is being prescribed in hospital — checking for duplicates, omissions, and dangerous combinations. This is done at the bedside or admission office, making it a prime mobile use case.

### Flow
1. Load patient's current active prescriptions via `GET /prescriptions/patient/:id`
2. Allow doctor to mark each med as: `Continue` / `Hold` / `Discontinue` / `Modify`
3. Run AI reconciliation check via `/governed/json` surface `medication_reconciliation`
4. Display AI findings: duplicates, interactions, omission alerts

### Add to `mobile/src/services/cdss.ts`
```ts
reconcileMedications: async (params: {
  patientId: string;
  homeMeds: string[];
  hospitalMeds: string[];
  diagnoses: string[];
}) => { ... }
// Returns: { duplicates: string[]; interactions: string[]; omissions: string[]; recommendations: string[] } | null
```

### New Screen: `mobile/src/components/doctor/DoctorMedRecScreen.tsx`

**State:**
```ts
meds: ApiPrescription[]
decisions: Record<string, 'continue'|'hold'|'discontinue'|'modify'>
aiResult: { duplicates: string[]; interactions: string[]; omissions: string[]; recommendations: string[] } | null
aiLoading: boolean
```

**On mount:** Load prescriptions for patient. Each med initialised as `'continue'` in decisions.

**UI sections:**
1. **Medication list** — each row: medication name + dose + frequency + route. Decision toggle: Continue (green) / Hold (amber) / Discontinue (red) / Modify (blue).
2. **[Run AI Reconciliation Check]** button — calls `CdssService.reconcileMedications()` with home meds vs active hospital meds.
3. **AI Results card** (when result available):
   - Duplicates: highlighted list
   - Interactions: flagged pairs
   - Omissions: meds likely needed but missing
   - Recommendations: ordered action list
4. Abstained fallback: "AI check unavailable — reconcile manually per protocol."

**Link from `DoctorRoundsScreen.tsx`:** Add `[Med Rec]` button to each patient detail card, navigating to `DoctorMedRecScreen` with `{ patientId, patientName }`.

### Acceptance Criteria
- [ ] Prescription list loads with correct med details
- [ ] Decision toggles persist in local state
- [ ] AI reconciliation fires and displays structured result
- [ ] Duplicates and interactions clearly flagged
- [ ] Abstained fallback shows without crashing
- [ ] Navigate back to rounds without state loss

---

## Implementation Order

Execute in this sequence to minimise merge conflicts:

```
Step 1: CdssService additions (F5, F6, F8) — cdss.ts only
Step 2: New service files (F7: imaging.ts, F4: NurseWorklistService.completeTask)
Step 3: New screens (F1, F7, F8)
Step 4: PatientNavigator — add F1 tab
Step 5: NurseShiftScreen — add F3, F4, F5, F6
Step 6: PatientPostVisitScreen — replace hardcoded AI (F2)
Step 7: DoctorRoundsScreen — add F7, F8 navigation buttons
Step 8: TypeScript compile check — zero errors
```

---

## API Endpoints Reference

| Endpoint | Method | Used By |
|----------|--------|---------|
| `/patient-portal/appointments` | GET | F1 |
| `/patient-portal/appointments/request` | POST | F1 |
| `/appointments/:id/status` | PUT | F1 |
| `/patient-ai/adherence/chat` | POST | F2 |
| `/patient-ai/adherence/patient/:id` | GET | F2 |
| `/nurse-worklist/state` | GET | F3, F4 |
| `/nurse-worklist/tasks/:id/complete` | PATCH | F4 |
| `/governed/json` (surface: `sbar_generation`) | POST | F5 |
| `/governed/json` (surface: `fall_risk_assessment`) | POST | F6 |
| `/imaging/orders/patient/:id` | GET | F7 |
| `/imaging/reports/:reportId` | GET | F7 |
| `/prescriptions/patient/:id` | GET | F8 |
| `/governed/json` (surface: `medication_reconciliation`) | POST | F8 |

---

## File Change Summary

### New Files
| File | Purpose |
|------|---------|
| `mobile/src/components/patient/PatientAppointmentsScreen.tsx` | F1 |
| `mobile/src/components/doctor/DoctorImagingReportScreen.tsx` | F7 |
| `mobile/src/components/doctor/DoctorMedRecScreen.tsx` | F8 |
| `mobile/src/services/imaging.ts` | F7 service layer |

### Modified Files
| File | Changes |
|------|---------|
| `mobile/src/services/cdss.ts` | Add `generateSBAR`, `assessFallRisk`, `reconcileMedications` |
| `mobile/src/services/nurseWorklist.ts` | Add `completeTask` |
| `mobile/src/components/patient/PatientPostVisitScreen.tsx` | Remove hardcoded AI, wire `PatientAiService` |
| `mobile/src/components/nurse/NurseShiftScreen.tsx` | Add Triage tab, Tasks tab, SBAR sheet, Fall Risk sheet |
| `mobile/src/components/doctor/DoctorRoundsScreen.tsx` | Add Imaging and Med Rec navigation buttons |
| `mobile/src/navigation/PatientNavigator.tsx` | Add Appointments tab |

---

## Validation Checklist

### F1 Patient Appointments
- [ ] Screen exists and navigable from patient tab bar
- [ ] Upcoming appointments load from real API
- [ ] Cancel action calls correct endpoint
- [ ] Book request sheet submits and refreshes list
- [ ] Empty state renders

### F2 Post-Visit AI Chat (Real)
- [ ] `AI_RESPONSES` and `getAiResponse` completely removed from codebase
- [ ] All AI responses come from `/patient-ai/adherence/chat`
- [ ] Session ID maintained across messages in same visit
- [ ] Chat history loads on return to screen
- [ ] No hardcoded clinical text anywhere in file

### F3 Nurse Triage Queue
- [ ] Triage tab present in nurse shift screen
- [ ] ESI Level 1 appears at top (most critical)
- [ ] Colour coding correct per ESI level
- [ ] Data from `NurseWorklistService.state().triage`

### F4 Nurse Task List
- [ ] Tasks tab present in nurse shift screen
- [ ] Tasks sorted URGENT → HIGH → MED → LOW
- [ ] Overdue tasks have red border
- [ ] Complete action fires PATCH and removes from list
- [ ] Empty state when all tasks done

### F5 Nurse SBAR
- [ ] SBAR button present on each patient card
- [ ] Bottom sheet shows S/B/A/R sections from CDSS
- [ ] Copy to clipboard functional
- [ ] Abstained fallback message shows

### F6 Nurse Fall Risk
- [ ] Fall Risk button present on each patient card
- [ ] Sheet shows risk level + score + factors + interventions
- [ ] HIGH level badge is red
- [ ] Abstained gracefully handled

### F7 Doctor Imaging Report
- [ ] DoctorImagingReportScreen navigable from Rounds
- [ ] Orders list with status badges
- [ ] Tapping completed order shows findings + impression text
- [ ] AI pre-read card visible when available
- [ ] No DICOM rendered (text only)

### F8 Doctor Medication Reconciliation
- [ ] DoctorMedRecScreen navigable from Rounds
- [ ] Prescriptions load for patient
- [ ] Continue/Hold/Discontinue/Modify toggles work
- [ ] AI reconciliation fires and shows duplicates/interactions/omissions
- [ ] Abstained fallback shows

### Cross-Cutting
- [ ] `npx tsc --noEmit` passes with zero errors
- [ ] No hardcoded URLs (all via `api` service)
- [ ] No mock data in any new or modified file
- [ ] All API failures caught → empty/null fallback (no crash)
- [ ] All CDSS calls return `null` on abstain/error (safe)

---

## Definition of Done

Sprint 124 is complete when:
1. All 8 features are navigable and functional in Expo dev build
2. Zero TypeScript errors
3. All 35 validation checkboxes above are ticked
4. No mock data remains in any touched file
5. `git log` shows atomic, descriptive commits per feature group
