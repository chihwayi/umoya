## QA & Clinical Validation Toolkit

This folder holds the artifacts that power Sprint 4 QA sign-off.

### Structure
```
qa/
├── README.md                 ← you are here
├── fixtures/
│   └── scenarios.json        ← canonical workflow scenario data
├── templates/
│   └── run-report.md         ← standardized QA run reporting template
├── tests/
    ├── run-scenarios.ts                      ← script that enumerates scenarios & prerequisites
    ├── nurse-outcome-analytics-smoke.ts      ← smoke validator for nurse AI/CDSS outcomes endpoint
    ├── doctor-cross-module-sync-smoke.ts     ← smoke validator/executor for nurse→doctor bundle loop
    ├── post-visit-session-smoke.ts           ← validates post-visit session + draft endpoints
    ├── post-visit-doctor-signoff-and-execution-smoke.ts ← validates doctor signoff/publish/execution flow
    ├── post-visit-companion-escalation-smoke.ts ← validates patient companion escalation routing
    ├── post-visit-fhir-mobile-contract-smoke.ts ← validates post-visit FHIR + mobile v1 contracts
    └── post-visit-end-to-end-journey-smoke.ts ← validates full doctor→patient→queue→resolve post-visit loop
└── uat/
    ├── nurse-ai-cdss-uat-checklist.md             ← nurse AI/CDSS UAT execution checklist
    ├── doctor-cross-module-ai-cdss-uat-checklist.md ← doctor AI/CDSS UAT execution checklist
    ├── doctor-cross-module-automation-matrix.md   ← module/action evidence matrix
    └── post-visit-ai-companion-uat-checklist.md   ← post-visit companion + safety UAT checklist
```

### Prerequisites
- Node 18+
- `npm install` at repo root (provides axios, ts-node if needed)
- Access to QA tenant(s) plus an API token (`EHR_QA_TOKEN`) and tenant slug (`EHR_QA_TENANT`)

### Running the scenario enumerator
```
npx ts-node qa/tests/run-scenarios.ts --tenant qa-shared --token $EHR_QA_TOKEN
```

What it does today:
- Loads `fixtures/scenarios.json`
- Validates required env/config values
- Prints a checklist for each scenario, including endpoints and data dependencies
- (Future) will exercise real API flows and assert DB state

### Running nurse outcome analytics smoke check
```
npx ts-node qa/tests/nurse-outcome-analytics-smoke.ts \
  --url "http://localhost:3013/nurse-worklist/analytics/outcomes" \
  --token "$EHR_QA_TOKEN" \
  --days 30
```

What it validates:
- Endpoint availability and auth wiring
- Response shape for `crossModuleQueue`, `hivRecommendationExecution`, and `maternityEscalationSla`
- Numeric metric fields required for UAT outcome tracking

### Running doctor cross-module queue smoke check
```
npx ts-node qa/tests/doctor-cross-module-sync-smoke.ts \
  --baseUrl "http://localhost:3013" \
  --tenant "$EHR_QA_TENANT" \
  --token "$EHR_QA_TOKEN" \
  --modules "hiv,oncology,cardiology,ed,sepsis,blood_bank" \
  --days 30 \
  --execute \
  --evidence "qa/tests/test-results/doctor-cross-module-sync-latest.json"
```

What it validates:
- Cross-module feed presence for requested modules
- Recommendation bundle action discoverability
- Optional one-click action execution against module endpoints
- Doctor outcomes analytics shape: `doctorQueue`, `accountsSync`, `recommendationExecution`, `cdssAdoption`
- Evidence export for UAT traceability

### Running post-visit session smoke check
```
npx ts-node qa/tests/post-visit-session-smoke.ts \
  --baseUrl "http://localhost:3013" \
  --tenant "$EHR_QA_TENANT" \
  --token "$EHR_QA_TOKEN" \
  --sessionId "$POST_VISIT_QA_SESSION_ID" \
  --evidence "qa/tests/test-results/post-visit-session-latest.json"
```

What it validates:
- Session retrieval via `GET /post-visit/sessions/:id`
- Draft artifact availability via `GET /post-visit/sessions/:id/draft`

### Running post-visit doctor signoff/execution smoke check
```
npx ts-node qa/tests/post-visit-doctor-signoff-and-execution-smoke.ts \
  --baseUrl "http://localhost:3013" \
  --tenant "$EHR_QA_TENANT" \
  --token "$EHR_QA_TOKEN" \
  --sessionId "$POST_VISIT_QA_SESSION_ID" \
  --publish \
  --execute \
  --evidence "qa/tests/test-results/post-visit-doctor-signoff-latest.json"
```

What it validates:
- Doctor signoff endpoint pathing and response shape
- Optional recommendation execution from post-visit bundle

### Running post-visit companion escalation smoke check
```
npx ts-node qa/tests/post-visit-companion-escalation-smoke.ts \
  --baseUrl "http://localhost:3013" \
  --tenant "$EHR_QA_TENANT" \
  --patientToken "$EHR_QA_PATIENT_TOKEN" \
  --clinicianToken "$EHR_QA_TOKEN" \
  --sessionId "$POST_VISIT_QA_SESSION_ID" \
  --resolve \
  --evidence "qa/tests/test-results/post-visit-companion-escalation-latest.json"
```

What it validates:
- Companion summary/messages availability from patient portal APIs
- Escalation event creation and clinician queue visibility
- Optional escalation resolution workflow

### Running post-visit FHIR + mobile contract smoke check
```
npx ts-node qa/tests/post-visit-fhir-mobile-contract-smoke.ts \
  --baseUrl "http://localhost:3013" \
  --tenant "$EHR_QA_TENANT" \
  --token "$EHR_QA_TOKEN" \
  --sessionId "$POST_VISIT_QA_SESSION_ID" \
  --version "v1" \
  --evidence "qa/tests/test-results/post-visit-fhir-mobile-latest.json"
```

What it validates:
- `GET /post-visit/sessions/:id/fhir` contract (`post-visit-fhir-r4.v1`)
- `GET /post-visit/sessions/:id/mobile-contract?version=v1` payload contract
- `GET /post-visit/sessions/:id/mobile-events?version=v1` event-feed contract

### Running post-visit end-to-end journey smoke check
```
npx ts-node qa/tests/post-visit-end-to-end-journey-smoke.ts \
  --baseUrl "http://localhost:3013" \
  --tenant "$EHR_QA_TENANT" \
  --clinicianToken "$EHR_QA_TOKEN" \
  --patientToken "$EHR_QA_PATIENT_TOKEN" \
  --sessionId "$POST_VISIT_QA_SESSION_ID" \
  --publish \
  --execute \
  --resolve \
  --evidence "qa/tests/test-results/post-visit-end-to-end-latest.json"
```

What it validates:
- Doctor session/draft retrieval and optional publish
- Recommendation execution from doctor post-visit bundle
- Patient companion message with safety escalation trigger
- Clinician queue visibility and optional escalation resolution
- Sprint 5 contracts inside same flow (`/fhir`, `/mobile-contract`, `/mobile-events`)

### Oncology doctor protocol automation checks
Key endpoints for oncology AI/CDSS protocol execution and doctor workflow analytics:
- `GET /oncology/cases/:id/protocol-bundle` → returns executable oncology doctor protocol bundle
- `POST /oncology/cases/:id/protocol-bundle/actions/:actionId/execute` → executes one protocol action and persists workflow context
- `GET /nurse-worklist/analytics/doctor-outcomes` → shared doctor outcome analytics across oncology/HIV/maternity workflows
  - Includes specialty drilldowns via `doctorQueue.moduleDrilldown` and action-frequency drilldowns via `recommendationExecution.topActions`
  - Supports drilldown query params: `module`, `status`, `caseId`, `dateFrom`, `dateTo`, `days`

### Capture Once, Reuse Everywhere checks
Shared patient context endpoint for cross-module prefill and no-repeat entry workflows:
- `GET /patients/:id/context` → returns reusable registration + latest module context:
  - `patient` demographics and contacts
  - `latestVitals`
  - `modules.hiv.latestEnrollment` and `modules.hiv.latestClinicalVisit`
  - `modules.maternity.latestEnrollment/latestAncVisit/latestPostnatalVisit/latestDelivery`
  - `modules.oncology.latestCase` and `modules.oncology.activeCaseCount`
  - `modules.cardiology.latestEncounter`
  - `modules.ophthalmology.latestEncounter`
  - `modules.ed.latestVisit`
  - `modules.sepsis.latestScreening/latestBundle`
  - `modules.bloodBank.latestTransfusion/activeTransfusionCount`

Frontend reuse points now wired:
- HIV clinical visit modal auto-prefill (only empty fields are hydrated; nurse edits are not overwritten).
- Oncology create-case modal patient context lookup on patient ID blur (auto-seeds diagnosis/care-plan hints and provider ID).
- Maternity enrollment modal reuses latest maternity history (parity/risk context + prior LMP hints).
- Ophthalmology create-encounter modal reuses cross-module context (provider/patient summary and smart note seeding).
- Blood bank dashboard reuses patient context on active transfusions (blood type/vitals/linked episodes) to reduce duplicate entry.

### CI lint policy (frontend)
- CI now enforces **blocking strict lint** for changed frontend files via:
  - `npm run lint:changed:strict`
- This keeps delivery stable while legacy repo-wide lint debt is reduced incrementally.
- Full strict lint build can be run locally with:
  - `npm --workspace medicore-ehr-frontend run build:strict-lint`

### Seeding data
1. Provision a fresh tenant with all bundles:
   ```
   npx ts-node scripts/provisioning-smoke-test.ts --bundles core snomed hiv_testing --keepDb
   ```
2. If tenant existed before latest sprint updates, run tenant repair/provision:
   ```
   POST /admin/tenants/:id/repair
   ```
3. Confirm required module tables exist before running smoke/UAT:
   - `nurse_cross_module_workflow_state`
   - `hiv_care_enrollments`
   - `oncology_cases`
   - `cardiology_encounters`
   - `ed_visits`
   - `sepsis_bundles`
4. Load fixture patients/users using the admin API or SQL snippets embedded in the scenario file.
5. Log into the QA UI with the seeded accounts (see scenario fixture `actors` array).

### Adding new scenarios
1. Duplicate an entry inside `fixtures/scenarios.json`.
2. Provide metadata: `modules`, `steps`, `expected`, `automation`.
3. Run the script; it will automatically include the new entry.

### Troubleshooting
- If the script reports missing prerequisites, consult the `prerequisites` section in each scenario and seed the referenced patient/appointment IDs.
- To inspect drift before testing, run `npx ts-node scripts/schema-drift-detector.ts --connection <tenant-url>`.

### Contact
- QA lead: qa@medicore.health
- Automation channel: `#qa-automation`

### Release Signoff References
- `docs/release/nurse-ai-cdss-release-checkpoint-2026-03-05.md`
- `docs/release/nurse-ai-cdss-cross-functional-signoff-2026-03-05.md`
- `docs/release/post-visit-ai-companion-release-checkpoint-2026-03-06.md`
- `docs/release/post-visit-ai-companion-cross-functional-signoff-2026-03-06.md`
