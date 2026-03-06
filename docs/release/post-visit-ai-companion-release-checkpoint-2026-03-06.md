# Post-Visit AI Companion Release Checkpoint (2026-03-06)

## Scope
Sprint 4-6 hardening checkpoint for Post-Visit AI Companion:
- doctor signoff/publish workflow,
- patient companion messaging + escalation routing,
- FHIR projection export and versioned mobile contract/event endpoints,
- QA smoke automation for full doctor→patient→queue loop.

## Mandatory Gates

### Backend Contract Gates
- [x] `GET /post-visit/sessions/:id/fhir` returns `exportVersion = post-visit-fhir-r4.v1`.
- [x] `GET /post-visit/sessions/:id/mobile-contract?version=v1` returns `contractVersion = post-visit-mobile.v1`.
- [x] `GET /post-visit/sessions/:id/mobile-events?version=v1` returns `contractVersion = post-visit-mobile-events.v1`.
- [x] Unsupported mobile contract versions are rejected with `4xx`.

### Clinical Safety Gates
- [x] Patient companion cannot access draft/unreviewed artifacts.
- [x] Urgent symptom messages generate escalation events with severity/route target.
- [x] Clinician queue resolution path closes escalation with audit trace.
- [x] Escalation metadata includes notification-channel delivery outcomes.
- [x] Grounded LLM outputs use citation allow-list only; invalid/ungrounded outputs fall back to deterministic answers.

### QA Automation Gates
- [x] `qa/tests/post-visit-session-smoke.ts` passes.
- [x] `qa/tests/post-visit-doctor-signoff-and-execution-smoke.ts` passes.
- [x] `qa/tests/post-visit-companion-escalation-smoke.ts` passes.
- [x] `qa/tests/post-visit-fhir-mobile-contract-smoke.ts` passes.
- [x] `qa/tests/post-visit-end-to-end-journey-smoke.ts` passes.

## Evidence Artifacts
- `qa/tests/test-results/post-visit-session-latest.json`
- `qa/tests/test-results/post-visit-doctor-signoff-latest.json`
- `qa/tests/test-results/post-visit-companion-escalation-latest.json`
- `qa/tests/test-results/post-visit-fhir-mobile-latest.json`
- `qa/tests/test-results/post-visit-end-to-end-latest.json`

## Validation Notes
- Tenant repair provisioning executed on March 6, 2026 via `POST /api/admin/tenants/repair-all` (`count = 3`).
- Companion escalation routing SQL type mismatch fixed (`routeEscalationToWorkflow` explicit `varchar` casts).
- Companion notification schema resilience added with runtime `patient_notifications` auto-provisioning.
- QA smoke evidence refreshed on March 6, 2026 between `20:41Z` and `20:42Z`.

## Release Decision
- **Ready to release**: all gates checked, no P0/P1 defects.
- **Conditional hold**: any contract drift or escalation safety regression.
