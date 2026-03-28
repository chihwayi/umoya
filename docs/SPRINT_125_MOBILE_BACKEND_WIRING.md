# Sprint 125 — Mobile Backend Wiring

**Branch:** `feat/ai-first-maturity-sprints-112-116`
**Created:** 2026-03-27
**Owner:** Engineering
**Status:** Ready to implement

---

## Purpose

Sprint 124 built all 8 mobile point-of-care screens. This sprint wires those screens to real backend endpoints by fixing the 7 confirmed gaps discovered by a systematic cross-reference of `mobile/src/services/` against `services/ehr-service/src/controllers/`.

All changes are **backend-only** (EHR service) except where a mobile-side field name fix is cheaper.

---

## Gap Inventory & Root Cause

### G1 — `POST /governed/json` routing hub is missing

**Impact:** Every CDSS surface called from mobile 404s.

Mobile `cdss.ts` calls `POST /governed/json` with a `surface` field for all governed AI decisions:

| Surface key | Mobile method | Required CDSS backend |
|---|---|---|
| `sbar_generation` | `generateSBAR()` | `POST /cdss/nursing/sbar` (EHR proxies to CDSS) |
| `fall_risk_assessment` | `assessFallRisk()` | `POST /cdss/nursing/fall-risk` |
| `medication_reconciliation` | `reconcileMedications()` | `POST /cdss/medication/reconciliation` |
| `dose_calculator` | `dosing()` | `POST /cdss/dosing` → CDSS `/dosing/recommend` |
| `clinical_risk_score` | `riskScore()` | `POST /cdss/risk-score` → CDSS `/risk/calculate` |
| `diagnosis_mobile` | `diagnosisSuggest()` | `POST /cdss/diagnosis` → CDSS `/diagnosis/suggest` |
| `lab_interpretation_mobile` | `interpretLab()` | `POST /cdss/lab-interpretation` → CDSS `/labs/interpret` |
| `nurse_shift_summary` | `getAiShiftSummary()` | `POST /cdss/shift-summary` → CDSS `/nursing/sbar` |

**Fix:** Add `GovernedController` in EHR service — `POST /governed/json` — that switches on `surface` and delegates to the appropriate `CdssService` method, returning `{ result, abstained }`.

---

### G2 — HTTP method mismatch on nurse task completion

**Impact:** Tapping "complete" on a nurse task silently fails (405 Method Not Allowed).

| Side | Path | Method |
|---|---|---|
| Mobile | `/nurse-worklist/tasks/:id/complete` | **PATCH** |
| Backend | `/nurse-worklist/tasks/:taskId/complete` | **POST** |

**Fix:** Add `@Patch('tasks/:taskId/complete')` decorator alongside the existing `@Post` in `NurseWorklistController`. One line change.

---

### G3 — `GET /staff/doctors/available` route missing

**Impact:** Doctor escalation panel in `NurseShiftScreen` always returns empty.

Only `GET /patient-portal/appointments/available-doctors` exists (returns appointment booking list, not staff availability). No `GET /staff/doctors/available` exists.

**Fix:** Add route in `UserController` (or new `StaffController`) that queries `users` table for active doctors with `role = 'doctor'`, returning `[{ id, name, role, specialty, available: true }]`.

---

### G4 — `POST /knowledge/search` route missing

**Impact:** Guideline search in `DoctorAIScreen` always returns empty.

CDSS FastAPI has `POST /guidelines/search`. EHR knowledge controller only has document CRUD. No proxy for `POST /knowledge/search` exists.

**Fix:** Add `@Post('knowledge/search')` to `CdssController` (or new `KnowledgeController`) that calls `this.cdssService.searchGuidelines(query, top_k, context, tenantId, tenantDb)` and returns `{ results }`.

---

### G5 — Imaging orders missing `reportId` field

**Impact:** `DoctorImagingReportScreen` shows all orders as "Pending" even when reports exist — tap to view report does nothing.

`getPatientOrders()` in `imaging.service.ts` runs:
```sql
SELECT io.* FROM imaging_orders io ... WHERE io.patient_id = $1
```
It does not JOIN to `imaging_studies` or `imaging_reports`. The mobile app checks `order.reportId` to determine if a report is available.

**DB relationship chain:**
```
imaging_orders.id → imaging_studies.imaging_order_id → imaging_reports.imaging_study_id
```

**Fix:** Update `getPatientOrders()` to LEFT JOIN studies and reports, select `r.id as report_id`, and include `reportId` in the returned objects.

---

### G6 — Imaging report response field names don't match mobile interface

**Impact:** `DoctorImagingReportScreen` report detail view shows blank radiologist name, blank date, no AI summary.

| Mobile expects | Backend returns | Source |
|---|---|---|
| `radiologistName` | `signed_by_name` | `getReportById()` SQL alias |
| `reportedAt` | `signed_at` or `created_at` | `imaging_reports` columns |
| `aiSummary` | not present | No column in `imaging_reports` |

**Fix:** Update `getReportById()` in `imaging.service.ts` to alias fields explicitly:
- `signed_by_name` → `radiologistName`
- `COALESCE(r.signed_at, r.created_at)` → `reportedAt`
- `r.ai_review_summary` (if exists) OR `NULL` → `aiSummary`

---

### G7 — Patient portal appointments response shape mismatch

**Impact:** `PatientAppointmentsScreen` shows "Your Doctor" for every appointment and `isTelemedicine` badge never appears.

`getPatientAppointments()` returns a nested `doctor` object and uses `isTelehealth`:
```js
{ doctor: { firstName, lastName, specialization }, isTelehealth: true }
```

Mobile `ApiAppointment` interface expects flat fields:
```ts
{ doctorName: string, doctorSpecialty: string, isTelemedicine: boolean }
```

**Fix:** Update the `.map()` in `getPatientAppointments()` to add flat aliases:
- `doctorName: apt.doctor_first_name + ' ' + apt.doctor_last_name`
- `doctorSpecialty: apt.doctor_specialization`
- `isTelemedicine: apt.isTelehealth`

---

## Files to Change

| # | File | Change type |
|---|---|---|
| G1 | `ehr-service/src/controllers/governed.controller.ts` | **New file** |
| G1 | `ehr-service/src/app.module.ts` | Register GovernedController |
| G2 | `ehr-service/src/controllers/nurse-worklist.controller.ts` | Add `@Patch` decorator |
| G3 | `ehr-service/src/controllers/user.controller.ts` | Add `GET /staff/doctors/available` |
| G4 | `ehr-service/src/controllers/cdss.controller.ts` | Add `POST /knowledge/search` |
| G5 | `ehr-service/src/services/imaging.service.ts` | Update `getPatientOrders()` SQL |
| G6 | `ehr-service/src/services/imaging.service.ts` | Update `getReportById()` aliases |
| G7 | `ehr-service/src/services/patient-portal.service.ts` | Flatten appointment response |

---

## Implementation Steps

### Step 1 — G7: Flatten appointments response (fastest win, zero deps)

In `patient-portal.service.ts` `getPatientAppointments()` `.map()`, add:
```ts
doctorName: apt.doctor_id
  ? `${apt.doctor_first_name ?? ''} ${apt.doctor_last_name ?? ''}`.trim() || null
  : null,
doctorSpecialty: apt.doctor_specialization ?? null,
isTelemedicine: !!(apt.isTelehealth || apt.is_telehealth),
```

### Step 2 — G6: Fix imaging report field aliases

In `imaging.service.ts` `getReportById()` SQL, change aliases:
```sql
signed_u.first_name || ' ' || signed_u.last_name as "radiologistName",
COALESCE(r.signed_at, r.created_at) as "reportedAt",
r.ai_review_summary as "aiSummary"
```
And in the return value use `report[0]` as-is (aliases map directly).

### Step 3 — G5: Add reportId to imaging orders query

In `imaging.service.ts` `getPatientOrders()`, change the SQL to:
```sql
SELECT
  io.*,
  st.study_name,
  m.modality_name,
  m.modality_code,
  u.first_name || ' ' || u.last_name as ordering_provider_name,
  r.id as report_id
FROM imaging_orders io
INNER JOIN imaging_study_types st ON st.id = io.study_type_id
INNER JOIN imaging_modalities m ON m.id = st.modality_id
INNER JOIN users u ON u.id = io.ordering_provider
LEFT JOIN imaging_studies s ON s.imaging_order_id = io.id
LEFT JOIN imaging_reports r ON r.imaging_study_id = s.id
WHERE io.patient_id = $1
ORDER BY io.ordered_at DESC
```
Map `report_id` → `reportId` in the returned objects.

### Step 4 — G2: Add PATCH method to nurse task completion

In `nurse-worklist.controller.ts`, add `@Patch` alongside existing `@Post`:
```ts
@Post('tasks/:taskId/complete')
@Patch('tasks/:taskId/complete')
```

### Step 5 — G3: Add `GET /staff/doctors/available`

In `user.controller.ts` (or whichever controller handles `/staff` routes), add:
```ts
@Get('staff/doctors/available')
@UseGuards(JwtAuthGuard)
async getAvailableDoctors(@Req() req: RequestWithTenant) {
  return this.userService.getAvailableDoctors(req.tenantDb);
}
```
Add `getAvailableDoctors(tenantDb)` to `user.service.ts`:
```ts
async getAvailableDoctors(tenantDb: DataSource) {
  const rows = await tenantDb.query(`
    SELECT id, first_name || ' ' || last_name as name, role, specialization as specialty
    FROM users
    WHERE role = 'doctor' AND is_active = true
    ORDER BY first_name
  `);
  return rows.map(r => ({ ...r, available: true }));
}
```

### Step 6 — G4: Add `POST /knowledge/search` proxy

In `cdss.controller.ts`, add:
```ts
@Post('knowledge/search')
@UseGuards(JwtAuthGuard)
async knowledgeSearch(@Body() body: { query: string; top_k?: number }, @Request() req: RequestWithTenant) {
  const results = await this.cdssService.searchGuidelines(
    body.query,
    body.top_k ?? 5,
    { module: 'mobile_guidelines' },
    req.tenantId,
    req.tenantDb,
  );
  return { results, abstained: !results || results.length === 0 };
}
```

### Step 7 — G1: Add `POST /governed/json` routing hub

Create `ehr-service/src/controllers/governed.controller.ts`:
```ts
@Controller('governed')
@UseGuards(JwtAuthGuard)
export class GovernedController {
  constructor(private readonly cdssService: CdssService) {}

  @Post('json')
  async govJson(@Body() body: { surface: string; task?: string; payload: any; governance?: any }, @Request() req: RequestWithTenant) {
    const { surface, payload } = body;
    const tenantId = req.tenantId;
    const tenantDb = req.tenantDb;

    switch (surface) {
      case 'sbar_generation':
        return { result: await this.cdssService.generateSBAR(payload, tenantId) };
      case 'fall_risk_assessment':
        return { result: await this.cdssService.assessFallRisk(payload, tenantId) };
      case 'medication_reconciliation':
        return { result: await this.cdssService.reconcileMedications(payload, tenantId) };
      case 'dose_calculator':
        return { result: await this.cdssService.calculateDose(payload, tenantId, tenantDb) };
      case 'clinical_risk_score':
        return { result: await this.cdssService.calculateRiskScore(payload, tenantId, tenantDb) };
      case 'diagnosis_mobile':
        return { result: await this.cdssService.suggestDiagnosis(payload, tenantId, tenantDb) };
      case 'lab_interpretation_mobile':
        return { result: await this.cdssService.interpretLabResult(payload, tenantId, tenantDb) };
      case 'nurse_shift_summary':
        return { result: await this.cdssService.generateNurseShiftSummary(payload, tenantId, tenantDb) };
      default:
        return { abstained: true, reason: `Unknown surface: ${surface}` };
    }
  }
}
```
Register in `app.module.ts` controllers array.

### Step 8 — Verify CDSS service has all required methods

Confirm `cdss.service.ts` exposes the methods called in Step 7:
- `generateSBAR` ✅ (line ~4323)
- `assessFallRisk` ✅ (line ~4328)
- `reconcileMedications` ✅ (line ~4339)
- `calculateDose` — verify or add proxy to CDSS `/dosing/recommend`
- `calculateRiskScore` — verify or add proxy to CDSS `/risk/calculate`
- `suggestDiagnosis` — verify or add proxy to CDSS `/diagnosis/suggest`
- `interpretLabResult` — verify or add proxy to CDSS `/labs/interpret`
- `generateNurseShiftSummary` — verify or add proxy to CDSS `/nursing/sbar` with ward context

### Step 9 — TypeScript compile check

```bash
cd services/ehr-service && npx tsc --noEmit
```
Fix any errors before committing.

---

## Traceability Matrix

| Mobile Screen | Mobile Service | Gap Fixed | Backend File |
|---|---|---|---|
| `NurseShiftScreen` SBAR modal | `CdssService.generateSBAR()` | G1 | `governed.controller.ts` |
| `NurseShiftScreen` Fall Risk modal | `CdssService.assessFallRisk()` | G1 | `governed.controller.ts` |
| `DoctorMedRecScreen` AI check | `CdssService.reconcileMedications()` | G1 | `governed.controller.ts` |
| `DoctorAIScreen` dosing | `CdssService.dosing()` | G1 | `governed.controller.ts` |
| `DoctorAIScreen` risk score | `CdssService.riskScore()` | G1 | `governed.controller.ts` |
| `DoctorAIScreen` diagnosis | `CdssService.diagnosisSuggest()` | G1 | `governed.controller.ts` |
| `DoctorAIScreen` lab | `CdssService.interpretLab()` | G1 | `governed.controller.ts` |
| `NurseShiftScreen` task complete | `NurseWorklistService.completeTask()` | G2 | `nurse-worklist.controller.ts` |
| `DoctorEscalationScreen` doctors | `CdssService.getAvailableDoctors()` | G3 | `user.controller.ts` |
| `DoctorAIScreen` guidelines | `CdssService.guidelineSearch()` | G4 | `cdss.controller.ts` |
| `DoctorImagingReportScreen` list | `ImagingService.ordersForPatient()` | G5 | `imaging.service.ts` |
| `DoctorImagingReportScreen` detail | `ImagingService.getReport()` | G6 | `imaging.service.ts` |
| `PatientAppointmentsScreen` | `AppointmentsService.upcoming()` | G7 | `patient-portal.service.ts` |

---

## Acceptance Criteria

- [ ] `POST /governed/json` with `surface='sbar_generation'` returns `{ result: { sbar: {S,B,A,R} } }` or `{ abstained: true }`
- [ ] `POST /governed/json` with `surface='fall_risk_assessment'` returns fall risk result or abstained
- [ ] `POST /governed/json` with `surface='medication_reconciliation'` returns med rec result or abstained
- [ ] `POST /governed/json` with `surface='dose_calculator'` returns dosing result or abstained
- [ ] `POST /governed/json` with `surface='diagnosis_mobile'` returns differentials or abstained
- [ ] `POST /governed/json` with `surface='lab_interpretation_mobile'` returns interpretation or abstained
- [ ] `POST /governed/json` with `surface='nurse_shift_summary'` returns summary or abstained
- [ ] `PATCH /nurse-worklist/tasks/:id/complete` returns `{ success: true }` (405 gone)
- [ ] `GET /staff/doctors/available` returns array of `{ id, name, role, specialty, available }`
- [ ] `POST /knowledge/search` returns `{ results: [...] }` (proxied to CDSS)
- [ ] `GET /imaging/orders/patient/:id` response objects include `reportId` (string | null)
- [ ] `GET /imaging/reports/:id` response includes `radiologistName`, `reportedAt`, `aiSummary` (nullable)
- [ ] `GET /patient-portal/appointments` response includes `doctorName`, `doctorSpecialty`, `isTelemedicine`
- [ ] EHR service TypeScript compiles with zero errors (`npx tsc --noEmit`)

---

## Definition of Done

All 14 acceptance criteria pass. EHR service compiles clean. The 8 Sprint 124 mobile screens that call these endpoints no longer receive 404/405 responses and display real data.
