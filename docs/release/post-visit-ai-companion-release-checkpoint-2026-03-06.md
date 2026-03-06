# Post-Visit AI Companion Release Checkpoint (2026-03-06)

## Scope
Sprint 4-6 hardening checkpoint for Post-Visit AI Companion:
- doctor signoff/publish workflow,
- patient companion messaging + escalation routing,
- FHIR projection export and versioned mobile contract/event endpoints,
- QA smoke automation for full doctor→patient→queue loop.

## Mandatory Gates

### Backend Contract Gates
- [ ] `GET /post-visit/sessions/:id/fhir` returns `exportVersion = post-visit-fhir-r4.v1`.
- [ ] `GET /post-visit/sessions/:id/mobile-contract?version=v1` returns `contractVersion = post-visit-mobile.v1`.
- [ ] `GET /post-visit/sessions/:id/mobile-events?version=v1` returns `contractVersion = post-visit-mobile-events.v1`.
- [ ] Unsupported mobile contract versions are rejected with `4xx`.

### Clinical Safety Gates
- [ ] Patient companion cannot access draft/unreviewed artifacts.
- [ ] Urgent symptom messages generate escalation events with severity/route target.
- [ ] Clinician queue resolution path closes escalation with audit trace.
- [ ] Escalation metadata includes notification-channel delivery outcomes.

### QA Automation Gates
- [ ] `qa/tests/post-visit-session-smoke.ts` passes.
- [ ] `qa/tests/post-visit-doctor-signoff-and-execution-smoke.ts` passes.
- [ ] `qa/tests/post-visit-companion-escalation-smoke.ts` passes.
- [ ] `qa/tests/post-visit-fhir-mobile-contract-smoke.ts` passes.
- [ ] `qa/tests/post-visit-end-to-end-journey-smoke.ts` passes.

## Evidence Artifacts
- `qa/tests/test-results/post-visit-session-latest.json`
- `qa/tests/test-results/post-visit-doctor-signoff-latest.json`
- `qa/tests/test-results/post-visit-companion-escalation-latest.json`
- `qa/tests/test-results/post-visit-fhir-mobile-latest.json`
- `qa/tests/test-results/post-visit-end-to-end-latest.json`

## Release Decision
- **Ready to release**: all gates checked, no P0/P1 defects.
- **Conditional hold**: any contract drift or escalation safety regression.
