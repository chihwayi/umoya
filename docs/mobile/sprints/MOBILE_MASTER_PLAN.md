# MediCore Mobile Master Plan

## 1. Source of truth

This mobile plan is anchored on the selected design prototypes:

- `docs/mobile/design/medicore-mobile-v3.jsx`
- `docs/mobile/design/medicore-mobile-app.jsx`
- `docs/mobile/design/v3 update description`

The build must match that design direction, not reinterpret it into a generic mobile app.

## 2. Product direction

The mobile app should ship from one TypeScript codebase and build for both iOS and Android.

Recommended stack:

- React Native with Expo
- Expo Router for role-based navigation
- Metro as the default bundler
- TypeScript only
- TanStack Query for server state
- Zustand for lightweight local workflow state
- `expo-secure-store` for secrets and tenant bootstrap state
- MMKV for fast non-secret persisted UI/session state
- `expo-notifications` for push and scheduled local reminders
- `expo-av`, `expo-file-system`, and camera/document modules only where the sprint explicitly requires them

This is the simplest modern path. It keeps Metro, reduces native setup friction, and supports iOS and Android cleanly.

## 3. Design contract

The implementation must preserve the selected visual system:

- Background: `#080E1A`
- Surface: `#0E1829`
- Cards: `#121F33`
- Border: `#1E3050`
- Accent teal: `#00C896`
- Accent blue: `#2B7FFF`
- Accent amber: `#FFB020`
- Accent red: `#FF4D6A`
- Accent purple: `#A66CFF`
- Accent orange: `#FF7A40`
- Primary text: `#E8F0FF`
- Secondary text: `#7A92B8`
- Muted text: `#4A6080`

Typography and interaction:

- Headline/display font: Sora
- Mono/status font: JetBrains Mono
- Strong rounded cards and pills
- Pulsing urgency states for critical items
- Gradient AI affordances
- Dense but readable clinical cards
- No white default screens
- No generic Material fallback look

## 4. App structure

Use one repository package, for example `mobile-app/`, with one shared design system and three role shells:

- doctor
- nurse
- patient

Recommended folder model:

- `mobile-app/src/app/` for Expo Router routes
- `mobile-app/src/features/provider/`
- `mobile-app/src/features/patient/`
- `mobile-app/src/features/shared/`
- `mobile-app/src/services/api/`
- `mobile-app/src/store/`
- `mobile-app/src/design/`
- `mobile-app/src/lib/notifications/`
- `mobile-app/src/lib/tenant/`

## 5. Tenant and environment strategy

The mobile app must not require code edits after server deployment.

Use one deployment base env:

```env
EXPO_PUBLIC_SERVICE_BASE_URL=https://your-domain.com
```

Derive service URLs in one place:

- tenant service: `${EXPO_PUBLIC_SERVICE_BASE_URL}/tenant-service/api`
- EHR service: `${EXPO_PUBLIC_SERVICE_BASE_URL}/ehr-service/api`

Do not repeat full URLs across screens or feature modules.

Tenant resolution strategy:

1. On first app launch, call `GET /tenant-service/api/tenants/active`.
2. Allow clinic resolution by:
   - tenant list
   - clinic code / subdomain search
   - optional QR or magic link later
3. Confirm tenant using `GET /tenant-service/api/tenants/subdomain/:subdomain` when needed.
4. Persist a `tenant_bootstrap` record locally with:
   - `tenantId`
   - `subdomain`
   - `name`
   - `logoUrl`
   - `ehrApiBaseUrl`
   - `tenantApiBaseUrl`
   - `selectedAt`
5. From then on, skip tenant selection entirely.
6. Show tenant selection again only when app data is cleared or the stored tenant bootstrap record is missing.

Production rule:

- Do not show a visible "switch clinic" control in normal patient/provider settings.
- If clinic switching is ever needed later, add an admin-only reset flow. It is not part of the first mobile release.

## 6. Auth model

Provider auth uses EHR auth routes:

- `POST /ehr-service/api/auth/login`
- `GET /ehr-service/api/auth/profile`
- `PUT /ehr-service/api/auth/change-password`
- `POST /ehr-service/api/auth/force-password-change`
- `POST /ehr-service/api/auth/2fa/setup`
- `POST /ehr-service/api/auth/2fa/verify`
- `POST /ehr-service/api/auth/2fa/disable`
- `POST /ehr-service/api/auth/2fa/complete-login`

Patient auth uses patient portal routes:

- `POST /ehr-service/api/patient-portal/register`
- `POST /ehr-service/api/patient-portal/login`
- `GET /ehr-service/api/patient-portal/verify-email`
- `POST /ehr-service/api/patient-portal/forgot-password`
- `POST /ehr-service/api/patient-portal/reset-password`
- `GET /ehr-service/api/patient-portal/profile`
- `PUT /ehr-service/api/patient-portal/profile`
- `POST /ehr-service/api/patient-portal/link-account`

## 7. Notification strategy

The app should be notification-heavy, especially for patients, but still structured.

Notification classes:

- Provider critical: escalation, abnormal vitals, critical lab/imaging, urgent handoff
- Provider operational: secure message, post-visit signoff pending, telemedicine start, order follow-up
- Patient clinical: medication due, refill due, appointment reminder, lab result ready, care plan reminder
- Patient financial: bill ready, payment reminder, claim update, receipt issued
- Patient engagement: doctor update, post-visit AI message, questionnaire due

Delivery model:

- Push notifications for immediate actions
- Local scheduled reminders for medication adherence
- In-app notification centre for full history
- Existing SMS backend can remain fallback for appointment, prescription, lab, and payment reminders

Existing backend support already present:

- `GET /ehr-service/api/patient-portal/notifications`
- `PUT /ehr-service/api/patient-portal/notifications/:id/read`
- `PUT /ehr-service/api/patient-portal/notifications/read-all`
- `DELETE /ehr-service/api/patient-portal/notifications/:id`
- `POST /ehr-service/api/notifications/appointment-reminder`
- `POST /ehr-service/api/notifications/prescription-ready`
- `POST /ehr-service/api/notifications/lab-results-ready`
- `POST /ehr-service/api/notifications/payment-reminder`

Backend gap to close during mobile delivery:

- add device push token registration
- add push preference management
- add provider push event fanout for escalation, message, handoff, and critical-result categories

## 8. Mobile modules by role

Doctor:

- ward rounds
- post-visit signoff
- escalation inbox
- secure messaging
- AI assist / CDSS
- dictation

Nurse:

- shift dashboard
- vitals capture
- escalation send flow
- secure messaging
- handoff/task closure

Patient:

- home
- post-visit AI companion
- medications and adherence
- bills and mobile payment
- my health
- notifications

## 9. Sprint sequence

1. Sprint 00: foundation, architecture, API contract, notification backbone
2. Sprint 01: tenant bootstrap, auth, shell navigation, persistent clinic selection
3. Sprint 02: provider mobile workflows
4. Sprint 03: patient mobile workflows and heavy reminders
5. Sprint 04: offline rules, performance, E2E, release hardening, store readiness

## 10. Mandatory delivery gate for every sprint

Every sprint must end in this exact order:

1. Implement the sprint scope.
2. Run unit and integration tests.
3. Run lint, typecheck, and platform health checks.
4. Run tests again, including the impacted E2E/regression flow.
5. Commit only after the above is green.

Required command pattern once `mobile-app/` exists:

```bash
npm run test --workspace=mobile-app
npm run lint --workspace=mobile-app
npm run typecheck --workspace=mobile-app
npx expo-doctor
npm run test --workspace=mobile-app
npm run test:e2e --workspace=mobile-app
git add .
git commit -m "mobile: <sprint scope>"
```

No sprint is complete if any of those checks are red.

## 11. Non-negotiable release rules

- English only for v1
- iOS and Android from the same TypeScript codebase
- No hardcoded deployment URLs
- No tenant selector after first successful configuration unless app data is cleared
- No screen ships without loading, empty, error, and offline states
- No PHI stored outside approved secure or encrypted local storage
- No critical workflow ships without notification handling
- No sprint closes without updated QA notes and API contract references
