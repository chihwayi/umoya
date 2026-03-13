# Sprint 01 Evidence: Tenant Bootstrap, Auth, and Role Shell

Date: 2026-03-13

## Implemented scope

- Boot resolver route (`/`) now checks stored tenant then stored session and routes accordingly.
- First-time clinic selection flow:
  - `/clinic/select`
  - `/clinic/confirm`
- Role-aware auth landing:
  - `/auth`
  - `/auth/provider-login`
  - `/auth/patient-login`
  - `/auth/two-factor`
  - `/auth/force-password-change`
- Role shell navigation:
  - Doctor tabs: `Rounds`, `PostVisit`, `Inbox`, `Messages`, `AI Assist`
  - Nurse tabs: `Shift`, `Vitals`, `Messages`
  - Patient tabs: `Home`, `PostVisit`, `Medications`, `Bills`, `My Health`
- Global notification centre shell route: `/notifications`.
- Shared state panels for loading/empty/error/offline styling consistency.
- EHR API client updates for:
  - provider 2FA completion payload (`tempToken`)
  - force password change with temporary auth token header.

## Key files

- `mobile-app/src/app/index.tsx`
- `mobile-app/src/app/clinic/select.tsx`
- `mobile-app/src/app/clinic/confirm.tsx`
- `mobile-app/src/app/auth/*.tsx`
- `mobile-app/src/app/doctor/*`
- `mobile-app/src/app/nurse/*`
- `mobile-app/src/app/patient/*`
- `mobile-app/src/app/notifications.tsx`
- `mobile-app/src/features/shared/ui/StatePanel.tsx`
- `mobile-app/src/services/api/ehr.ts`

## Validation gates (required order)

Executed inside `mobile-app/`:

1. `npm run test` ✅
2. `npm run lint` ✅
3. `npm run typecheck` ✅
4. `npx expo-doctor` ✅ (17/17)
5. `npm run test` ✅
6. `npm run test:e2e` ✅ (placeholder smoke)

## Notes

- `test:e2e` remains placeholder until Sprint 02/03 workflow E2E suites are added.
- Shell tabs are live; deep workflow data wiring lands in subsequent sprints.
