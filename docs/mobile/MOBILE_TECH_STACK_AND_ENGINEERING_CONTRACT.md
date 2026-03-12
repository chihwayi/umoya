# Mobile Tech Stack and Engineering Contract

## 1. Purpose

This document is the implementation contract for MediCore mobile development.

Goal:

- one codebase for iOS and Android
- healthcare-safe behavior
- role-complete workflows for doctor, nurse, and patient
- predictable delivery quality

This contract is mandatory for all mobile sprint work.

## 2. Approved stack

### Core platform

- React Native with Expo
- TypeScript only
- Expo Router

Why:

- fastest reliable cross-platform delivery
- simple native build/release path
- strong navigation patterns for role-based shells

### State and data

- TanStack Query for all server state
- Zustand for lightweight cross-screen local workflow state
- React local state for screen-local UI state

Why:

- clean separation between server cache and UI workflow state
- less boilerplate than Redux for this scope

### Storage

- `expo-secure-store` for secrets and sensitive auth/session metadata
- MMKV for non-secret persisted app state

Why:

- secure handling of sensitive data
- high performance for normal UI/session persistence

### Notifications and media

- `expo-notifications` for push and local reminders
- `expo-av`, `expo-file-system`, camera/document modules only where feature scope requires

Why:

- supports escalation, adherence, billing, and follow-up reminders
- enables PostVisit audio and controlled media flows

### Forms and validation

- React Hook Form
- Zod

Why:

- strict and reusable runtime validation for clinical/financial forms

### Test and quality

- Jest + React Native Testing Library
- Detox or Maestro for E2E
- Expo Doctor in CI

Why:

- stable test pyramid with platform health checks

## 3. Architecture rules

Use this baseline structure in `mobile-app/`:

- `src/app/` route definitions (Expo Router)
- `src/features/provider/` doctor and nurse features
- `src/features/patient/` patient features
- `src/features/shared/` shared UI/logic
- `src/services/api/` API clients and endpoint wrappers
- `src/lib/tenant/` tenant bootstrap and context
- `src/lib/auth/` auth/session management
- `src/lib/notifications/` push and local reminder orchestration
- `src/design/` tokens, theme, primitives
- `src/store/` Zustand stores

Non-negotiable:

- screens never call `fetch`/`axios` directly
- screens never build raw URLs
- all API access goes through `src/services/api/*`

## 4. Runtime and tenant contract

Use one deployment base env:

```env
EXPO_PUBLIC_SERVICE_BASE_URL=https://your-domain.com
```

Derived centrally:

- `${EXPO_PUBLIC_SERVICE_BASE_URL}/tenant-service/api`
- `${EXPO_PUBLIC_SERVICE_BASE_URL}/ehr-service/api`

Tenant bootstrap:

- first launch uses `GET /tenant-service/api/tenants/active`
- optional lookup by `GET /tenant-service/api/tenants/subdomain/:subdomain`
- persist `tenant_bootstrap` locally
- inject `X-Tenant-ID` automatically in tenant-scoped calls

Production behavior:

- no visible tenant switch control for normal users
- tenant is reset only by app data clear/uninstall or controlled admin reset flow

## 5. Auth and session contract

Provider auth routes:

- `/ehr-service/api/auth/*`

Patient auth routes:

- `/ehr-service/api/patient-portal/*`

Rules:

- tokens and sensitive session data only in secure storage
- tenant bootstrap survives logout
- logout revokes push device token
- token invalidation forces logout and re-auth

## 6. Design system contract

Source design:

- `docs/mobile/design/medicore-mobile-v3.jsx`
- `docs/mobile/design/v3 update description`

Rules:

- no hardcoded ad-hoc colors in feature screens
- use tokens from `src/design/tokens.ts`
- preserve dark clinical surfaces and readable text contrast
- enforce consistent urgency states (critical/warning/routine)
- loading/empty/error states must follow the same visual language

## 7. AI/CDSS safety contract

AI/CDSS must be assistive, not autonomous.

Rules:

- no automatic diagnosis/treatment commit without human action
- show recommendation provenance/citation context where available
- log acceptance/override actions with actor and timestamp
- role-specific AI:
  - doctor: escalation and post-visit decision support
  - nurse: vitals/triage/escalation support
  - patient: grounded post-visit guidance and adherence nudges

## 8. Offline and sync policy

Allowed offline:

- tenant bootstrap cache
- non-sensitive UI/session state cache
- selected patient-safe read views
- encrypted draft data where explicitly allowed
- local medication reminder scheduling

Online-only flows:

- critical escalation acknowledgement/resolution unless conflict-safe queue exists
- payments
- telemedicine sessions

## 9. Performance and observability budgets

Performance targets:

- cold start under 3s on representative mid-range Android device
- warm list render without long blocking spinners
- unread counters preloaded in background

Observed metrics:

- login success/failure by tenant
- tenant bootstrap completion
- push delivery/open
- reminder engagement
- escalation acknowledge latency
- crash-free sessions
- API error rate by screen

## 10. Testing and CI gates

Every sprint must pass:

```bash
npm run test --workspace=mobile-app
npm run lint --workspace=mobile-app
npm run typecheck --workspace=mobile-app
npx expo-doctor
npm run test --workspace=mobile-app
npm run test:e2e --workspace=mobile-app
```

No green pipeline, no merge.

## 11. Database and provisioning governance

If mobile feature work needs backend schema changes:

- include migration script
- include provisioning update for new tenants
- include repair path/script for existing tenants

No schema change is considered done without all three.

## 12. Delivery governance

Definition of ready for any story:

- route/API contract identified
- role impact identified (doctor/nurse/patient)
- design state and acceptance states defined
- error/offline behavior defined

Definition of done for any story:

- implementation complete
- tests updated and passing
- lint/typecheck/Expo Doctor passing
- evidence captured in `reports/mobile/`
- docs updated if API/scope changed

## 13. Traceability

Use this matrix during implementation and signoff:

- `docs/mobile/sprints/MOBILE_ROLE_FEATURE_TRACEABILITY.md`

Use sprint plans for execution details:

- `docs/mobile/sprints/MOBILE_MASTER_PLAN.md`
- `docs/mobile/sprints/SPRINT_00_FOUNDATION.md`
- `docs/mobile/sprints/SPRINT_01_TENANT_AUTH_AND_SHELL.md`
- `docs/mobile/sprints/SPRINT_02_PROVIDER_WORKFLOWS.md`
- `docs/mobile/sprints/SPRINT_03_PATIENT_WORKFLOWS.md`
- `docs/mobile/sprints/SPRINT_04_HARDENING_AND_RELEASE.md`
