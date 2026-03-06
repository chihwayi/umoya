# MediCore QA Test Suite

## Playwright Test Suite

This directory contains Playwright and API smoke coverage for MediCore EHR.

## Prerequisites

1. **Install Dependencies**:
   ```bash
   cd qa/tests
   npm install
   npx playwright install chromium
   ```

2. **Environment Variables**:
   ```bash
   export EHR_API_URL=http://localhost:3001/api
   export EHR_QA_TENANT=bulawayo-general
   export EHR_QA_TOKEN=your-auth-token
   ```

3. **EHR Service Running**:
   Ensure the EHR service is running on port 3001 (or update `EHR_API_URL`)

4. **Tenant Provisioned/Repaired**:
   Ensure the QA tenant has current schema bundles applied. If needed, run tenant repair:
   - `POST /admin/tenants/:id/repair`

## Running Tests

### Run All Tests
```bash
npm test
```

### Run Specific Scenario
```bash
npm run test:s1  # Triage → Prescription → Nursing Note
npm run test:s3  # Oncology Case Lifecycle
npm run test:s4  # Cardiology Encounter + SLA
npm run test:s5  # Lab Order + Critical Alert
npm run test:s7  # CDSS Hook Validation
```

### Run Nurse/Doctor API Smoke Checks
```bash
npm run smoke:nurse:outcomes
npm run smoke:doctor:cross-module
npm run smoke:post-visit:session
npm run smoke:post-visit:doctor
npm run smoke:post-visit:companion
npm run smoke:post-visit:fhir-mobile
npm run smoke:post-visit:e2e
```

Override runtime params using env or direct `npx ts-node` flags.

### Run with UI Mode
```bash
npm run test:ui
```

### Run in Debug Mode
```bash
npm run test:debug
```

### Run in Headed Mode (see browser)
```bash
npm run test:headed
```

## Test Scenarios

### S1: Triage → Prescription → Nursing Note
- Tests SNOMED coding in triage assessments
- Verifies CDSS insights for prescriptions
- Validates nursing note SNOMED arrays

### S3: Oncology Case Lifecycle
- Creates oncology case with SNOMED diagnosis
- Assigns regimen to case
- Records adverse events with SNOMED codes
- Verifies dashboard aggregates

### S4: Cardiology Encounter + SLA
- Creates encounter with SNOMED symptoms
- Updates care status
- Verifies dashboard SNOMED metrics

### S5: Lab Order + Critical Alert
- Creates lab order
- Submits critical results
- Acknowledges critical alerts

### S7: CDSS Hook Validation
- Tests mental health triage pathway
- Verifies CDSS insights for anxiety
- Checks drug interaction warnings

### API smoke: Nurse outcomes
- Validates `/nurse-worklist/analytics/outcomes` response contract
- Guards key numeric metrics used in nurse UAT cards

### API smoke: Doctor cross-module sync
- Validates module presence in `/nurse-worklist/cross-module-feed`
- Optionally executes bundle actions for HIV/oncology/cardiology/ED/sepsis/blood_bank
- Validates `/nurse-worklist/analytics/doctor-outcomes` response contract
- Writes evidence JSON under `qa/tests/test-results/`

### API smoke: Post-visit FHIR/mobile contracts
- Validates `/post-visit/sessions/:id/fhir` contract and resource bundle
- Validates versioned mobile payload contract (`/mobile-contract?version=v1`)
- Validates versioned mobile event contract (`/mobile-events?version=v1`)

### API smoke: Post-visit end-to-end journey
- Runs doctor session retrieval, optional publish, optional recommendation execute
- Runs patient companion message to trigger escalation
- Verifies clinician queue visibility and optional resolution
- Re-validates FHIR/mobile contracts inside the same journey

## Test Reports

After running tests, view the HTML report:
```bash
npm run report
```

Reports are also saved to:
- `test-results/results.json` - JSON format
- `playwright-report/` - HTML report

## CI/CD Integration

To run in CI:
```bash
npx playwright test --reporter=json --output=test-results/
```

## Troubleshooting

1. **Tests fail with connection errors**:
   - Verify EHR service is running
   - Check `EHR_API_URL` is correct
   - Ensure tenant exists and is active

2. **Authentication errors**:
   - Verify `EHR_QA_TOKEN` is valid
   - Check token hasn't expired

3. **Patient not found**:
   - Tests create patients automatically
   - If issues persist, check database connectivity
