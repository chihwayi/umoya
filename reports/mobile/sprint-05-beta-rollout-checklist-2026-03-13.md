# Sprint 05 Beta Rollout Checklist (2026-03-13)

## Release gates
- [x] `release:check` passes
- [x] `beta:check` passes (non-strict)
- [x] lint/type/test/doctor/e2e gates pass
- [x] build manifests generated for Android and iOS preview
- [ ] strict env readiness (`beta:check:strict`) with production secrets

## Android preview rollout
- [x] EAS project linked (`@devoopzw/medicore-mobile`)
- [x] Update channel `preview` created
- [x] Preview build submitted to EAS Build queue
- [ ] Validate build install on QA devices
- [ ] Promote to Play internal testing ring
- [ ] Confirm crash-free launch and notification flows

## iOS preview rollout
- [x] EAS project linked (`@devoopzw/medicore-mobile`)
- [ ] Internal distribution credentials configured for non-interactive mode
- [ ] Preview build queued from CI mode
- [ ] TestFlight internal tester validation
- [ ] External tester release after internal signoff

## Go / No-Go decision
- Current state: **Conditional Go**
- Conditions to clear:
  1. Configure iOS internal distribution credentials in EAS (interactive once).
  2. Add production/staging env secrets on EAS dashboard.
  3. Execute strict readiness check and capture outputs.
