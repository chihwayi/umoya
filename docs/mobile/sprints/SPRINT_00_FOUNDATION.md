# Sprint 00: Mobile Foundation, Architecture, and Contract Lock

## Objective

Stand up the mobile project correctly before feature work starts. This sprint exists to prevent drift, rework, and backend/frontend mismatch.

## Duration

1 sprint

## Output

- working Expo React Native app scaffold under `mobile-app/`
- shared design system matching `docs/mobile/design/medicore-mobile-v3.jsx`
- centralized runtime config with one base server env
- tenant bootstrap library
- API client structure
- push notification backbone
- testing and linting pipeline
- release discipline documented in repo scripts

## Core technical decisions

- Expo + React Native + TypeScript
- Expo Router
- Metro
- TanStack Query
- Zustand
- SecureStore + MMKV
- React Hook Form + Zod for forms
- native stack navigation only through Expo Router patterns

## Mandatory project setup

Create these at minimum:

- `mobile-app/package.json`
- `mobile-app/app.json`
- `mobile-app/babel.config.js`
- `mobile-app/tsconfig.json`
- `mobile-app/src/design/tokens.ts`
- `mobile-app/src/design/theme.ts`
- `mobile-app/src/lib/config/runtime.ts`
- `mobile-app/src/lib/tenant/tenant-storage.ts`
- `mobile-app/src/lib/tenant/tenant-resolver.ts`
- `mobile-app/src/lib/auth/`
- `mobile-app/src/lib/notifications/`
- `mobile-app/src/services/api/http.ts`
- `mobile-app/src/services/api/ehr.ts`
- `mobile-app/src/services/api/tenant.ts`
- `mobile-app/src/test/`

## Design-system tasks

Implement the selected V3 look as reusable tokens and primitives:

- app background, surfaces, card shells, dividers
- badge system
- role accent colors
- urgency states
- screen headers
- AI gradient badge
- timer pulse animation
- notification chips
- list rows with unread, severity, and status states

Do not start feature screens before these primitives exist.

## Runtime configuration tasks

Build one runtime resolver using:

```env
EXPO_PUBLIC_SERVICE_BASE_URL=https://your-domain.com
```

That resolver must derive:

- tenant base URL
- EHR base URL
- shared websocket or push config if later needed

No screen or service module should build URLs manually.

## Tenant bootstrap tasks

Implement a dedicated bootstrap service that:

- calls `GET /tenant-service/api/tenants/active`
- resolves a single tenant by subdomain when needed with `GET /tenant-service/api/tenants/subdomain/:subdomain`
- saves the selected tenant payload locally
- exposes `getStoredTenant()`, `setStoredTenant()`, and `clearStoredTenant()`
- injects `X-Tenant-ID` on every tenant-scoped request

## API contract tasks

Lock the first mobile API map now.

Tenant service routes:

- `GET /tenant-service/api/tenants/active`
- `GET /tenant-service/api/tenants/subdomain/:subdomain`

Provider auth routes:

- `POST /ehr-service/api/auth/login`
- `GET /ehr-service/api/auth/profile`
- `PUT /ehr-service/api/auth/change-password`
- `POST /ehr-service/api/auth/force-password-change`
- `POST /ehr-service/api/auth/2fa/complete-login`

Patient auth routes:

- `POST /ehr-service/api/patient-portal/register`
- `POST /ehr-service/api/patient-portal/login`
- `GET /ehr-service/api/patient-portal/profile`
- `PUT /ehr-service/api/patient-portal/profile`
- `POST /ehr-service/api/patient-portal/link-account`

Notification routes already available:

- `GET /ehr-service/api/patient-portal/notifications`
- `POST /ehr-service/api/notifications/appointment-reminder`
- `POST /ehr-service/api/notifications/prescription-ready`
- `POST /ehr-service/api/notifications/lab-results-ready`
- `POST /ehr-service/api/notifications/payment-reminder`

## Backend tasks required in this sprint

These are the only new backend items that should be added in Sprint 00 if absent:

- mobile device push token registration endpoint
- mobile device token revoke endpoint on logout
- notification preference endpoint for patient and provider categories
- mobile app version metadata endpoint for minimum-supported-version enforcement

Recommended additions:

- `POST /ehr-service/api/mobile/devices/register`
- `POST /ehr-service/api/mobile/devices/unregister`
- `GET /ehr-service/api/mobile/preferences/notifications`
- `PUT /ehr-service/api/mobile/preferences/notifications`
- `GET /ehr-service/api/mobile/version`

## QA and automation setup

Add scripts for:

- `npm run lint --workspace=mobile-app`
- `npm run typecheck --workspace=mobile-app`
- `npm run test --workspace=mobile-app`
- `npm run test:e2e --workspace=mobile-app`

Set up:

- Jest or Vitest for unit tests
- React Native Testing Library
- Detox or Maestro for mobile E2E
- Expo Doctor in CI

## Acceptance criteria

- app runs on iOS simulator and Android emulator
- theme matches V3 token direction
- one base env drives all service URLs
- tenant bootstrap library persists clinic choice successfully
- API layer injects `Authorization` and `X-Tenant-ID`
- push token lifecycle contract is defined
- tests and lint scripts exist and run

## Definition of done

Run this exact order:

```bash
npm run test --workspace=mobile-app
npm run lint --workspace=mobile-app
npm run typecheck --workspace=mobile-app
npx expo-doctor
npm run test --workspace=mobile-app
npm run test:e2e --workspace=mobile-app
git add .
git commit -m "mobile: sprint 00 foundation"
```
