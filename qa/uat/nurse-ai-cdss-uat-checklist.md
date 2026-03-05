# Nurse AI/CDSS UAT Checklist

## Objective

Validate nurse-side AI/CDSS execution quality and operational outcomes after queue execution hardening.

## Preconditions

- Tenant seeded with active HIV and maternity records
- Nurse user with access to nurse dashboard and cross-module queue
- Doctor reviewer account for escalations
- API token available for UAT verification scripts

## Functional UAT

- [ ] Open `Cross-Module Escalations` and verify HIV + maternity items are visible.
- [ ] Execute HIV recommendation actions directly from queue:
  - [ ] `eac-followup`
  - [ ] `repeat-vl-plan`
  - [ ] `regimen-counseling`
  - [ ] `visit-recording`
  - [ ] `regimen-safety-warnings`
  - [ ] `tb-interaction-review`
  - [ ] `doctor-switch-review`
  - [ ] `pediatric-dose-check` or `pediatric-adherence`
  - [ ] `pmtct-linkage`
- [ ] Confirm completed actions show execution state in recommendation bundle.
- [ ] Re-run one already-completed action and verify idempotent response (no duplicate side-effect record).
- [ ] Verify doctor-facing follow-through artifacts are created/reused as expected (referral/alert state).

## Outcome Analytics UAT

- [ ] Call nurse outcome analytics endpoint:
  - `GET /nurse-worklist/analytics/outcomes?days=30`
- [ ] Validate non-empty response shape:
  - `crossModuleQueue`
  - `hivRecommendationExecution`
  - `maternityEscalationSla`
- [ ] Confirm KPI values move after executing queue actions during this session.

### Smoke Script

```bash
npx ts-node qa/tests/nurse-outcome-analytics-smoke.ts \
  --url "http://localhost:3013/nurse-worklist/analytics/outcomes" \
  --token "$EHR_QA_TOKEN" \
  --days 30
```

## Evidence Capture

- [ ] Export endpoint payload JSON after action execution
- [ ] Screenshot queue item before and after action execution
- [ ] Record any mismatch between UI action status and backend analytics counters
- [ ] Link all artifacts in release signoff record
