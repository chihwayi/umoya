## QA & Clinical Validation Toolkit

This folder holds the artifacts that power Sprint 4 QA sign-off.

### Structure
```
qa/
├── README.md                 ← you are here
├── fixtures/
│   └── scenarios.json        ← canonical workflow scenario data
└── tests/
    ├── run-scenarios.ts                 ← script that enumerates scenarios & prerequisites
    └── nurse-outcome-analytics-smoke.ts ← smoke validator for nurse AI/CDSS outcome endpoint
└── uat/
    └── nurse-ai-cdss-uat-checklist.md   ← nurse AI/CDSS UAT execution checklist
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

### Oncology doctor protocol automation checks
Key endpoints for oncology AI/CDSS protocol execution and doctor workflow analytics:
- `GET /oncology/cases/:id/protocol-bundle` → returns executable oncology doctor protocol bundle
- `POST /oncology/cases/:id/protocol-bundle/actions/:actionId/execute` → executes one protocol action and persists workflow context
- `GET /nurse-worklist/analytics/doctor-outcomes` → shared doctor outcome analytics across oncology/HIV/maternity workflows
  - Includes specialty drilldowns via `doctorQueue.moduleDrilldown` and action-frequency drilldowns via `recommendationExecution.topActions`
  - Supports drilldown query params: `module`, `status`, `caseId`, `dateFrom`, `dateTo`, `days`

### Seeding data
1. Provision a fresh tenant with all bundles:
   ```
   npx ts-node scripts/provisioning-smoke-test.ts --bundles core snomed hiv_testing --keepDb
   ```
2. Load fixture patients/users using the admin API or SQL snippets embedded in the scenario file.
3. Log into the QA UI with the seeded accounts (see scenario fixture `actors` array).

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
