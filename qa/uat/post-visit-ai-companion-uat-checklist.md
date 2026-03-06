# Post-Visit AI Companion UAT Checklist

## Objective
Validate sprint-4 post-visit companion behavior end-to-end:
- doctor-approved summary/checklist publication,
- patient companion messaging grounded on approved artifacts only,
- urgent-message escalation detection, routing, and resolution.

## Environment Prerequisites

1. Tenant repaired/provisioned with post-visit sprint bundles already applied.
2. At least one doctor-reviewed post-visit session is available and publishable.
3. Tokens available:
   - `EHR_QA_TOKEN` (doctor/nurse/admin)
   - `EHR_QA_PATIENT_TOKEN` (patient mapped to the target post-visit session)
4. Session ID available:
   - `POST_VISIT_QA_SESSION_ID`

## Acceptance Checklist

### Doctor Signoff and Publish
- [ ] `GET /post-visit/sessions/:id` returns expected session context.
- [ ] `GET /post-visit/sessions/:id/draft` returns draft artifacts.
- [ ] `POST /post-visit/sessions/:id/publish` succeeds and session status is `published`.

### Patient Companion Summary + Messaging
- [ ] `GET /patient-portal/post-visit/sessions/:id/summary` returns approved plain-language summary.
- [ ] `GET /patient-portal/post-visit/sessions/:id/messages` returns message list with no draft leakage.
- [ ] `POST /patient-portal/post-visit/sessions/:id/messages` returns patient + assistant messages.
- [ ] `POST /patient-portal/post-visit/sessions/:id/acknowledgements` records teach-back/adherence events.

### Escalation Detection + Routing
- [ ] Urgent symptom message creates escalation event with `severity`, `routeTarget`, and SLA fields.
- [ ] `GET /post-visit/escalations` shows the new escalation in clinician queue.
- [ ] Channel delivery metadata is present (`metadata.channel_delivery`) and traceable.
- [ ] `POST /post-visit/escalations/:id/resolve` updates escalation to `resolved` (or `dismissed` for false positives).

### Dashboard Visibility
- [ ] Doctor dashboard includes post-visit escalation queue panel and allows resolve/dismiss.
- [ ] Nurse cross-module area includes post-visit escalation queue panel and allows resolve/dismiss.
- [ ] Direct companion route works from both entry points:
  - `/ehr/:tenantSlug/patient/post-visit`
  - `/ehr/:tenantSlug/post-visit/companion`
- [ ] Doctor and nurse quick-action cards open the post-visit companion route.
- [ ] Companion chat supports keyboard submit (`Enter`) and auto-scrolls to latest response.

## Smoke Commands

### 1) Session + draft smoke
```bash
npx ts-node qa/tests/post-visit-session-smoke.ts \
  --baseUrl "http://localhost:3013" \
  --tenant "$EHR_QA_TENANT" \
  --token "$EHR_QA_TOKEN" \
  --sessionId "$POST_VISIT_QA_SESSION_ID" \
  --evidence "qa/tests/test-results/post-visit-session-latest.json"
```

### 2) Doctor signoff + execution smoke
```bash
npx ts-node qa/tests/post-visit-doctor-signoff-and-execution-smoke.ts \
  --baseUrl "http://localhost:3013" \
  --tenant "$EHR_QA_TENANT" \
  --token "$EHR_QA_TOKEN" \
  --sessionId "$POST_VISIT_QA_SESSION_ID" \
  --publish \
  --execute \
  --evidence "qa/tests/test-results/post-visit-doctor-signoff-latest.json"
```

### 3) Companion escalation smoke
```bash
npx ts-node qa/tests/post-visit-companion-escalation-smoke.ts \
  --baseUrl "http://localhost:3013" \
  --tenant "$EHR_QA_TENANT" \
  --patientToken "$EHR_QA_PATIENT_TOKEN" \
  --clinicianToken "$EHR_QA_TOKEN" \
  --sessionId "$POST_VISIT_QA_SESSION_ID" \
  --resolve \
  --evidence "qa/tests/test-results/post-visit-companion-escalation-latest.json"
```

## Pass/Fail Criteria
- **PASS**: all checklist sections pass and no P0/P1 defects remain.
- **CONDITIONAL PASS**: non-critical defects accepted with owner and remediation ETA.
- **FAIL**: any grounding, escalation routing, or safety response path fails.
