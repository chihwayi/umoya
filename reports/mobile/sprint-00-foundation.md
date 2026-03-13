# Sprint 00 Foundation Evidence (Mobile)

Date: 2026-03-13

## Scope delivered

- Created isolated mobile app at `mobile-app/` (not in root npm workspaces).
- Implemented contract-aligned folder structure for app, design, tenant, auth, notifications, API, store, and tests.
- Added centralized runtime URL derivation from `EXPO_PUBLIC_SERVICE_BASE_URL`.
- Added tenant bootstrap storage/resolver and automatic `X-Tenant-ID` injection path.
- Added secure auth session storage service.
- Added push registration/unregistration + notification preferences service layer.
- Added baseline API wrappers for tenant and EHR auth flows.
- Added shared provider shell + base UI primitives with V3 token baseline.

## Key files

- `mobile-app/src/design/tokens.ts`
- `mobile-app/src/lib/config/runtime.ts`
- `mobile-app/src/lib/tenant/tenant-storage.ts`
- `mobile-app/src/lib/tenant/tenant-resolver.ts`
- `mobile-app/src/lib/auth/session-storage.ts`
- `mobile-app/src/lib/notifications/push-service.ts`
- `mobile-app/src/services/api/http.ts`
- `mobile-app/src/services/api/tenant.ts`
- `mobile-app/src/services/api/ehr.ts`

## Validation gates (required order)

Executed inside `mobile-app/`:

1. `npm run test` ✅
2. `npm run lint` ✅
3. `npm run typecheck` ✅
4. `npx expo-doctor` ✅ (17/17 checks passed)
5. `npm run test` ✅
6. `npm run test:e2e` ✅ (Sprint 00 smoke placeholder)

## Isolation confirmation

- Root `package.json` mobile scripts now call `npm --prefix ./mobile-app ...`.
- Root workspaces no longer include `mobile-app`.
- `mobile-app/package-lock.json` is local and independent.
