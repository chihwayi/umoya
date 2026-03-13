# Sprint 05 Task 3 Evidence: Beta Rollout Controls and Build Execution

Date: 2026-03-13
Branch: `codex/mobile-sprint-05-store-ready-builds`

## Delivered
- Added beta-readiness script: `mobile-app/scripts/beta-rollout-check.mjs`
- Added build-manifest generator: `mobile-app/scripts/generate-build-manifest.mjs`
- Added npm scripts for strict checks, manifest generation, and CI-mode preview build commands.
- Added support contact visibility in diagnostics screen (in-app control requirement).
- Added store-readiness smoke checks to e2e smoke runner.
- Added release governance artifacts:
  - beta rollout checklist
  - release runbook + rollback plan
  - known issues register
  - build attempts evidence

## Build execution outcomes
- Android preview CI-mode command succeeded in queueing build.
  - Build URL: https://expo.dev/accounts/devoopzw/projects/medicore-mobile/builds/e65ce228-3b97-4797-ac41-c80a9329d4f4
- iOS preview CI-mode command blocked by missing non-interactive internal-distribution credentials.

## Validation
```bash
npm --prefix ./mobile-app run release:check
npm --prefix ./mobile-app run beta:check
npm --prefix ./mobile-app run lint
npm --prefix ./mobile-app run typecheck
npm --prefix ./mobile-app run test
npm --prefix ./mobile-app run doctor
npm --prefix ./mobile-app run test:e2e
cd mobile-app && npx expo config --type public
```

All above checks passed.
