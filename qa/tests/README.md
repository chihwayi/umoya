# MediCore QA Test Suite

## Playwright Test Suite

This directory contains the Playwright test suite for MediCore EHR system, covering the top 5 priority scenarios.

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

