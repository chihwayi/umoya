# Nurse AI/CDSS Release Checkpoint (2026-03-05)

## Scope Locked

- Cross-module nurse escalation workflow (maternity, HIV, nursing handoff/medication follow-up)
- Executable HIV recommendation bundles from nurse queue
  - `eac-followup`
  - `repeat-vl-plan`
  - `regimen-counseling`
  - `visit-recording` (prefilled nurse intake draft)
  - `regimen-safety-warnings`
  - `tb-interaction-review`
  - `doctor-switch-review`
  - `pediatric-dose-check` / `pediatric-adherence`
  - `pmtct-linkage`
- Recommendation execution state persistence and replay/idempotency protection
- CI hardening for `@medicore/ehr-service` Jest runtime env bootstrap

## Checkpoint Commits

- `4904d9e` Complete HIV nurse queue executable bundle actions
- `53fe6b0` Harden ehr-service jest env bootstrap for CI

## Release Governance

- Cross-functional signoff sheet:
  - `docs/release/nurse-ai-cdss-cross-functional-signoff-2026-03-05.md`

## Verification Summary

- `npm test -w @medicore/ehr-service` passed under CI-like env
- Targeted nurse queue tests passed:
  - `src/services/nurse-worklist.service.spec.ts`
- `npm run build -w @medicore/ehr-service` passed
- `npm run build -w medicore-ehr-frontend` passed with current project build profile

## Known Follow-Up (Post-Checkpoint)

- Frontend global lint debt remains outside this checkpoint scope.
- CI now reports changed-file frontend lint debt in non-blocking mode (`npm run lint:changed`).
- Continue with nurse outcome analytics/UAT hardening and release evidence consolidation.
