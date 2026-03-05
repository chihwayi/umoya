# Doctor Cross-Module AI/CDSS UAT Checklist

## Objective
Validate closed-loop nurse → doctor → accounts execution quality for high-priority AI/CDSS bundles:
- HIV
- Oncology
- Cardiology
- Emergency Department (ED)
- Sepsis
- Blood bank / transfusion safety

## Environment Provisioning (Required Before UAT)

1. Repair/provision tenant schema (tenant-service admin endpoint):
   - `POST /admin/tenants/:id/repair`
2. Confirm required cross-module tables exist in tenant DB:
   - `nurse_cross_module_workflow_state`
   - `hiv_care_enrollments`
   - `oncology_cases`
   - `cardiology_encounters`
   - `ed_visits`
   - `sepsis_bundles`
   - `patient_charges` and/or claims/billing workflow tables used by accounts handoff
3. Confirm users exist for all workflow roles:
   - Nurse
   - Doctor
   - Accounts/admin reviewer
4. Seed at least one active UAT patient journey for each module so queue items are generated.

Note: this UAT hardening pass introduces no new DB migration files, but requires tenant repair/provisioning to ensure all previously delivered schemas are applied.

## Locked Acceptance Criteria

### Cross-Module Queue
- [ ] `GET /nurse-worklist/cross-module-feed` returns active items for all target modules (HIV, oncology, cardiology, ED, sepsis).
- [ ] `GET /nurse-worklist/cross-module-feed` returns active items for all target modules (HIV, oncology, cardiology, ED, sepsis, blood_bank).
- [ ] Every target module item contains `metadata.recommendation_bundle.items` with executable actions.

### Execution Integrity
- [ ] One action executes successfully per target module from queue context.
- [ ] Action execution updates persisted workflow action state (`action_executions`) and returns operation metadata.
- [ ] Replaying an already completed action is idempotent (no duplicate side effects).

### Doctor Sync
- [ ] `GET /nurse-worklist/analytics/doctor-outcomes` contains:
  - [ ] `doctorQueue`
  - [ ] `accountsSync`
  - [ ] `recommendationExecution`
  - [ ] `cdssAdoption`
- [ ] Doctor queue metrics reflect the executed module actions.

### Accounts Handoff
- [ ] Accounts-related workflow items appear where expected in doctor sync scope.
- [ ] Accounts sync pending/completed status changes are visible in analytics after action execution.

### Evidence
- [ ] API evidence JSON archived for each run.
- [ ] UI screenshots captured before/after action execution for each module.
- [ ] Defects mapped to run report with severity and owner.

## Execution Commands

### 1) Doctor cross-module smoke + evidence
```bash
npx ts-node qa/tests/doctor-cross-module-sync-smoke.ts \
  --baseUrl "http://localhost:3013" \
  --tenant "$EHR_QA_TENANT" \
  --token "$EHR_QA_TOKEN" \
  --days 30 \
  --modules "hiv,oncology,cardiology,ed,sepsis,blood_bank" \
  --execute \
  --evidence "qa/tests/test-results/doctor-cross-module-sync-latest.json"
```

### 2) Nurse outcomes regression smoke
```bash
npx ts-node qa/tests/nurse-outcome-analytics-smoke.ts \
  --url "http://localhost:3013/nurse-worklist/analytics/outcomes" \
  --token "$EHR_QA_TOKEN" \
  --days 30
```

## Pass/Fail Decision
- **PASS**: all locked acceptance criteria are checked and no critical defects remain open.
- **CONDITIONAL PASS**: non-critical defects exist with approved remediation plan and target date.
- **FAIL**: any required module flow fails execution/idempotency/analytics consistency, or provisioning gaps block validation.
