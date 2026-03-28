# Sprint 05 Release Runbook (2026-03-13)

## Preconditions
1. Branch merged and CI mobile-quality-gates green.
2. EAS env variables configured per environment.
3. iOS/Android credentials configured in Expo account.

## Build steps
1. `npm --prefix ./mobile-app run release:check`
2. `npm --prefix ./mobile-app run beta:check:strict`
3. `npm --prefix ./mobile-app run build:manifest:android:preview`
4. `npm --prefix ./mobile-app run build:manifest:ios:preview`
5. `npm --prefix ./mobile-app run build:android:preview:ci`
6. `npm --prefix ./mobile-app run build:ios:preview:ci`

## Rollback plan
- Android:
  1. Halt promotion in Play Console (do not move from internal/closed track).
  2. Revert to previous approved build version in rollout track.
  3. Pin API compatibility flags server-side if needed.
- iOS:
  1. Expire problematic TestFlight build.
  2. Keep previous stable build as active test candidate.
  3. Re-submit patched build with incremented iOS build number.

## Operational monitoring
- Confirm Sentry receives startup breadcrumbs and API error events.
- Verify no PHI in crash payloads (sanitized keys only).
- Verify support contact visible in diagnostics screen.

## Signoff owners
- Mobile engineering owner
- Clinical operations signoff owner
- Platform operations owner
