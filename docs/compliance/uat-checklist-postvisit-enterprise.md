# UAT Checklist – Post-Visit AI & Enterprise Hardening

**Release gate:** Go-live checklist must pass with no P0/P1 defects.

## Pre-release

- [ ] Red-team adversarial suite passes in CI (>=50 tests).
- [ ] Backend tests pass: `npm --workspace @medicore/ehr-service run test`.
- [ ] Backend build passes: `npm --workspace @medicore/ehr-service run build`.
- [ ] Secret rotation check passes: `node scripts/check-secret-rotation.js`.
- [ ] SOC2/HIPAA evidence report generated: `node scripts/soc2-hipaa-evidence-report.js`.
- [ ] New migrations apply cleanly on fresh DB.

## Doctor workflow

- [ ] Create post-visit session from appointment/consultation.
- [ ] Regenerate draft artifacts; review visit summary and recommendation bundle.
- [ ] Approve/reject draft artifacts; edit when required.
- [ ] Publish session (with all gates: diarization, citations, SOAP, medication high-risk where applicable).
- [ ] Generate and sign admin documents (referral/sick note/RTW); mark as dispatched.
- [ ] List and review trial matches; record consider/defer/exclude/enroll.
- [ ] View FHIR sync log for session.
- [ ] Create peer consult request; respond with de-identified summary.
- [ ] Voice command: APPROVE_SUMMARY, SIGN_AND_PUBLISH (with confirm).
- [ ] Pre-visit brief: fetch for appointment; job generates briefs for upcoming appointments.

## Patient companion & safety

- [ ] Patient receives summary and checklist after publish.
- [ ] Companion Q&A uses grounded answers and prior memory (topic persistence).
- [ ] Escalation classification and routing (symptom keywords / confidence).
- [ ] Intra-visit alerts (allergy/medication/vitals) surface in doctor workspace.

## Billing & admin

- [ ] Billing intelligence returns suggestions; doctor can approve/reject.
- [ ] Billing and admin doc actions appear in audit.

## No P0/P1 open

- [ ] No unmitigated PHI leakage (trial matcher, peer consult, logs).
- [ ] No release-blocking red-team failures.
- [ ] No critical security or data-loss bugs in post-visit path.

---

*Sign-off: _________________ Date: _________*
