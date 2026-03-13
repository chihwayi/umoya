# Sprint 05 Task 2 Evidence: Crash Reporting + Tenant Branding Slot

Date: 2026-03-13
Branch: `codex/mobile-sprint-05-store-ready-builds`

## Delivered
- Added Sentry crash reporting baseline integration (`@sentry/react-native`).
- Added PHI-safe crash metadata pipeline:
  - allowlisted keys only
  - no user/request/context payload forwarding
  - API failure capture for `5xx` and network errors
- Added tenant-logo slot component and mounted it in:
  - auth entry/login screens
  - doctor/nurse/patient top bars
- Added diagnostics visibility for crash reporting configuration.

## Key files
- `mobile-app/src/lib/observability/crash-reporting.ts`
- `mobile-app/src/lib/observability/mobile-metrics.ts`
- `mobile-app/src/services/api/http.ts`
- `mobile-app/src/app/_layout.tsx`
- `mobile-app/src/features/shared/ui/TenantLogoSlot.tsx`
- `mobile-app/src/app/auth/index.tsx`
- `mobile-app/src/app/auth/provider-login.tsx`
- `mobile-app/src/app/auth/patient-login.tsx`
- `mobile-app/src/app/doctor/_layout.tsx`
- `mobile-app/src/app/nurse/_layout.tsx`
- `mobile-app/src/app/patient/_layout.tsx`
- `mobile-app/src/app/diagnostics.tsx`

## Validation
```bash
npm --prefix ./mobile-app run release:check
npm --prefix ./mobile-app run lint
npm --prefix ./mobile-app run typecheck
npm --prefix ./mobile-app run test
npm --prefix ./mobile-app run doctor
npm --prefix ./mobile-app run test:e2e
cd mobile-app && npx expo config --type public
```

Result: all checks green.

## Notes
- Sentry plugin reports a non-blocking warning if org/project env is not provided in local runs.
- Runtime DSN remains controlled by `EXPO_PUBLIC_SENTRY_DSN`; when absent, crash reporting is disabled safely.
