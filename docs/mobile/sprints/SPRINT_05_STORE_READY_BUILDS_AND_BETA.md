# Sprint 05: Store-Ready Builds, Crash Reporting, and Beta Rollout

## Objective

Ship production-distribution readiness for mobile with:

- signed iOS/Android release builds
- crash reporting and release observability
- controlled beta rollout process

This sprint starts after Sprint 04 functional hardening is green.

## Duration

1 sprint

## Scope

### 1. Store-ready build pipeline

Required outputs:

- Android:
  - internal QA APK
  - Play production AAB
- iOS:
  - TestFlight build (IPA via EAS)

Required implementation:

- define `eas.json` profiles for `development`, `preview`, and `production`
- ensure app identifiers, display names, and icons are final
- lock release versioning strategy:
  - semantic app version (`major.minor.patch`)
  - platform build numbers (`android.versionCode`, `ios.buildNumber`)
- verify environment mapping by profile:
  - dev -> non-prod services
  - preview -> staging/pre-prod
  - production -> live domain

### 2. Crash reporting and runtime diagnostics

Required capabilities:

- crash capture enabled for both Android and iOS
- release + environment tags attached to every crash
- role and tenant context captured without leaking PHI
- app-start and screen-level breadcrumb coverage

Guardrails:

- no patient identifiers, note text, audio, transcript content, or message body in crash payloads
- no secrets in logs or breadcrumb metadata
- all crash metadata sanitized before emit

Preferred baseline implementation:

- Sentry (`sentry-expo`) for crash and release health
- route/screen breadcrumb integration via Expo Router listeners
- minimal custom diagnostic events through existing `trackMobileEvent` path

### 3. Beta rollout operations

Required rollout tracks:

- iOS TestFlight:
  - internal testers first
  - external testers after internal signoff
- Android:
  - internal testing track first
  - closed testing ring before production

Required controls:

- written go/no-go checklist
- rollback plan per platform
- known issues register
- support escalation contact in-app and in release notes

### 4. Release governance artifacts

Produce and store in `reports/mobile/`:

- build manifest:
  - app version
  - build number/versionCode
  - commit SHA
  - build profile
- crash reporting validation log:
  - synthetic crash test result (non-production builds only)
  - captured event IDs
  - dashboard screenshot references
- beta rollout checklist and signoff log

## CI/CD gates (must pass)

```bash
npm --prefix ./mobile-app run lint
npm --prefix ./mobile-app run typecheck
npm --prefix ./mobile-app run test
npm --prefix ./mobile-app run doctor
npm --prefix ./mobile-app run test:e2e
```

Plus build verification:

- `eas build --platform android --profile preview`
- `eas build --platform ios --profile preview`

## Security and compliance constraints

- keep HIPAA/SOC2 logging posture: minimum necessary metadata only
- verify screenshot protection policy remains active for PHI screens
- verify secure token storage rules are unchanged
- confirm forced logout and token invalidation still work in release builds

## Signoff criteria

Sprint 05 closes only when:

- release builds are generated successfully for both platforms
- crash reporting is live and validated with sanitized context
- beta rollout playbook is documented and trialed
- CI gates stay green after release instrumentation changes
- evidence pack is complete in `reports/mobile/`

## Definition of done

```bash
npm --prefix ./mobile-app run lint
npm --prefix ./mobile-app run typecheck
npm --prefix ./mobile-app run test
npm --prefix ./mobile-app run doctor
npm --prefix ./mobile-app run test:e2e
git add .
git commit -m "mobile: sprint 05 store release and beta readiness"
```
