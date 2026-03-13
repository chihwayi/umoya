# Sprint 04 Evidence: Release Hardening and Operational Safety

Date: 2026-03-13

## Implemented scope

- Added session invalidation handling and centralized 401 response hardening:
  - EHR API response interceptor now tracks API errors and triggers auth invalidation on non-login 401 responses.
- Added inactivity timeout protection in root layout:
  - app background duration is tracked and active sessions are logged out after timeout.
  - timeout controlled by `EXPO_PUBLIC_SESSION_TIMEOUT_MINUTES` (default 15).
- Added biometric re-entry guard for returning active sessions where device biometrics are enrolled.
- Added PHI screenshot policy by route:
  - auth/clinic public flows allow capture.
  - role routes enforce screen capture blocking.
- Added logout control in all role tab headers:
  - doctor, nurse, patient shells now have a consistent `Logout` action.
- Added push registration integration on login and unregister integration on logout:
  - provider and patient logins attempt device push registration.
  - logout revokes push token best-effort.
- Added mobile observability event buffer/logging for hardening metrics.
- Replaced notifications placeholder with role-aware notification center:
  - patient notifications + mark read/all read actions.
  - provider inbox/unread visibility.
- Upgraded `test:e2e` smoke script from placeholder to deterministic scenario checks for:
  - tenant/auth shell
  - provider workflows
  - patient workflows
  - release hardening files

## Key files

- `mobile-app/src/services/api/http.ts`
- `mobile-app/src/lib/auth/invalidation.ts`
- `mobile-app/src/lib/auth/logout.ts`
- `mobile-app/src/lib/config/runtime.ts`
- `mobile-app/src/lib/observability/mobile-metrics.ts`
- `mobile-app/src/app/_layout.tsx`
- `mobile-app/src/lib/security/device-security.ts`
- `mobile-app/src/app/index.tsx`
- `mobile-app/src/app/notifications.tsx`
- `mobile-app/src/features/shared/ui/LogoutButton.tsx`
- `mobile-app/src/app/doctor/_layout.tsx`
- `mobile-app/src/app/nurse/_layout.tsx`
- `mobile-app/src/app/patient/_layout.tsx`
- `mobile-app/src/app/auth/provider-login.tsx`
- `mobile-app/src/app/auth/patient-login.tsx`
- `mobile-app/src/app/clinic/select.tsx`
- `mobile-app/src/app/clinic/confirm.tsx`
- `mobile-app/scripts/e2e-smoke.mjs`
- `mobile-app/app.json`

## Validation gates

Executed inside `mobile-app/`:

1. `npm run test` ✅
2. `npm run lint` ✅
3. `npm run typecheck` ✅
4. `npx expo-doctor` ✅
5. `npm run test` ✅
6. `npm run test:e2e -- release-hardening` ✅
