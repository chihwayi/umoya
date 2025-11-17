## QA & Clinical Validation Plan

### Goals
- Prove the MediCore platform can reliably execute the 10 priority clinical workflows that sales and clinical partners expect in Sprint 4.
- Ensure every workflow is reproducible with defined fixtures, pre/post conditions, and measurable acceptance criteria.
- Provide automation-ready specs so we can plug Playwright/Postman suites and nightly regression jobs into CI.

### Environments
| Environment | Purpose | Notes |
|-------------|---------|-------|
| `qa-shared` | collaborative manual validation | seeded with full specialty bundles |
| `qa-automation` | clean tenant for nightly runs | rebuilt via `scripts/provisioning-smoke-test.ts --keepDb` |
| `qa-local` | developer laptops | uses `.env.qa.local` + seed fixtures |

### Scenario Matrix

| ID | Workflow | Modules | Entry data | Expected assertions |
|----|----------|---------|------------|---------------------|
| S1 | Triage → Prescription → Nursing Note | Triage, Orders, Pharmacy, Nursing | adult patient with allergies | CDSS insights fire, prescription SNOMED stored, nursing observations saved |
| S2 | Maternity ANC → Ultrasound → Delivery → Postnatal | Maternity | gravida 2 para 1 | risk flags persisted, ultrasound SNOMED arrays, delivery outcomes recorded |
| S3 | Oncology case lifecycle | Oncology | stage II breast cancer | case/regimen/adverse events aggregated on dashboard |
| S4 | Cardiology encounter with diagnostics + follow-up SLA | Cardiology | chest pain patient | encounter SNOMED metrics show on dashboard, SLA alerts recorded |
| S5 | Lab order + critical alert | Lab, Critical Alerts | abnormal potassium | critical alert queued + acknowledgement workflow |
| S6 | Imaging order → report → sign-off | Imaging | CT abdomen | imaging report templates applied, CDSS guidance shown |
| S7 | CDSS hook surfacing (triage/prescription) | CDSS | mental health complaint | risk + diagnosis returned, insights attached to payload |
| S8 | Tenant provisioning regression | Tenant Service | new tenant slug | bundles applied, schema version table populated, smoke test passes |
| S9 | HIV monthly return + reporting extract | HIV, Reporting | month with varied visits | API returns form with data, export artifact generated |
| S10 | QA automation harness sanity | QA harness | scenario fixtures | fixtures load, Playwright/HTTP tests execute with exit 0 |

### Scenario Details

Each section includes: fixtures, API/UI path, automation plan, validation.

#### S1: Triage → Prescription → Nursing Note
- **Preconditions**: patient `QA-TRIAGE-001`, doctor `qa.doctor@medi-core.local`, allergies `Penicillin`.
- **Flow**: record triage assessment with SNOMED-coded chief complaint → prescribe medication (expect CDSS drug interaction check) → add nursing note with SNOMED observations.
- **Validation**:
  - `triage_assessments` row contains `cdssInsights` object.
  - `prescriptions.medication_name_snomed_code` populated; `prescriptionService.create` returns insights.
  - `nursing_notes.observations_snomed` JSON array length matches selections.
- **Automation**: Playwright API route hitting `/triage`, `/prescriptions`, `/nursing-notes`; refer to `qa/tests/run-scenarios.ts` stub.

#### S2: Maternity Continuum
- **Fixtures**: patient `QA-MAT-ANC-01`, enrollment seeded via `qa/fixtures/scenarios.json`.
- **Steps**: create ANC visit with SNOMED-coded complications → add ultrasound scan → delivery → postnatal visit with newborn complications.
- **Checks**:
  - `maternity_enrollments.current_pregnancy_complications_snomed` JSON includes concepts.
  - `ultrasound_scans.findings_snomed` contains ultrasound anomalies.
  - Dashboard widget reflects new maternal risk badges (manual vs UI screenshot).

#### S3: Oncology Case Lifecycle
- **Fixtures**: oncology case `QA-ONC-001`.
- **Flow**: create case, attach regimen, log infusion session, record adverse event with SNOMED concept.
- **Assertions**:
  - `oncology_cases.primary_diagnosis_snomed_term` non-null.
  - Dashboard aggregates (`topDiagnosesSnomed`, `adverseEventSnomedSummary`) update within 1 refresh.
- **Automation**: use GraphQL? No – REST `POST /oncology/cases`, `POST /oncology/regimens`, etc.

#### S4: Cardiology Encounter + SLA
- Steps: record encounter with SNOMED symptoms, order diagnostics, change `care_status` to test SLA tracker.
- Validate `cardiology_encounters.symptom_snomed_codes` array; dashboards show risk badges.

#### S5: Lab Critical Alert
- Seed lab order `QA-LAB-CRIT`.
- Steps: submit result with critical potassium value; ensure `critical_result_alerts` row created, acknowledgement endpoint works.
- Automation: script posts `/lab-orders/:id/submit-results`, then `/critical-alerts/:id/acknowledge`.

#### S6: Imaging Order → Report
- Place imaging order, assign radiologist, compose report using template, sign.
- Validate CDSS insights (new addition) exist on order response.

#### S7: CDSS Surfacing
- Use mental health SNOMED concept (`197480006 - Anxiety disorder`).
- Expect `riskAssessment` + `diagnosisAssist` outputs.
- Validate UI card exposures (triage/prescription modals).

#### S8: Tenant Provisioning Regression
- Run `npm run provision:smoke` (alias to new script) nightly.
- Validate bundle log events and `tenant_schema_versions` state.

#### S9: HIV Monthly Return
- Use fixtures to create visits; run `/hiv/monthly-return`.
- Validate JSON matches fortunes; ensures QA portal can export.

#### S10: Automation Harness
- `qa/tests/run-scenarios.ts` iterates fixtures and ensures all prerequisites exist (currently logs warnings; future to integrate HTTP tests).

### Fixtures
- Located under `qa/fixtures/scenarios.json`.
- Contains patient IDs, required users, SNOMED concept sets, data seeds for each scenario.
- `qa/README.md` explains seeding instructions.

### Automation Plans
- **CLI scripts**: `scripts/run-tenant-upgrades.ts`, `scripts/provisioning-smoke-test.ts`.
- **Future**: Playwright suite (UI) + Supertest/Postman collection (API) referencing scenario IDs.
- Each scenario entry contains:
  - `automation.type`: `api`, `ui`, or `hybrid`.
  - `automation.owner`: team contact.
  - `status`: `pending`, `partial`, `complete`.

### Reporting & Sign-off
- After each run:
  - Export JSON from automation harness.
  - Attach manual evidence (screenshots, Postman test results) to QA spreadsheet.
  - Use `qa/tests/run-scenarios.ts --report report.json` (future) for summary ingestion.

### Next Steps
1. Flesh out API automation harness (add real HTTP calls, handle auth).
2. Wire Playwright into CI with seeded QA tenant and stub accounts.
3. Add ICD-10 mapping tests (coming next sprint item) once feature lands.


