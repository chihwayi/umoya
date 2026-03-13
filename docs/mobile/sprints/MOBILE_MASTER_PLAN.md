# MediCore Mobile Master Plan

## 1. Source of truth

This mobile plan is anchored on the selected design prototypes:

- `docs/mobile/design/medicore-mobile-v3.jsx`
- `docs/mobile/design/medicore-mobile-app.jsx`
- `docs/mobile/design/v3 update description`
- `docs/mobile/sprints/MOBILE_ROLE_FEATURE_TRACEABILITY.md`
- `docs/mobile/MOBILE_TECH_STACK_AND_ENGINEERING_CONTRACT.md`

The build must match that design direction, not reinterpret it into a generic mobile app.

Brand source of truth:

- app logo asset: `medicore.png` at repo root
- web, admin, patient portal, and mobile must all use this same master logo
- do not introduce alternate icons or lettermark placeholders unless a dedicated app-icon export set is created from this file

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

## 8. Role capability baseline (must ship for v1)

Doctor mobile baseline:

- ward rounds list with urgency and patient vitals snapshot
- escalation inbox with SLA timer, acknowledgement, resolution, and source context
- post-visit signoff queue with summary review and publish actions
- post-visit audio session support (playback, transcript review, mobile contract/events consumption)
- secure messaging (threads, unread counts, reply, task conversion)
- telemedicine consultation list, join, meeting URL retrieval, end consultation
- AI/CDSS assist panel (advisory-only recommendations with guideline citation source)
- dictation entry for rapid documentation capture
- module launchpad cards for doctor-critical modules with mobile-first actions and deep-link fallback:
  - emergency
  - operating room
  - PACU
  - MAR
  - blood bank
  - sepsis
  - infection control
  - CDI
  - revenue cycle
  - population health
  - HIV
  - oncology
  - maternity

Nurse mobile baseline:

- shift dashboard from live nurse worklist state
- vitals capture and AI interpretation support
- escalation send flow (severity, doctor target, clinical finding, context payload)
- task completion and alert acknowledgement
- handoff finalize/review/share workflow
- secure messaging with patient and team context
- cross-module recommendation execution actions from nurse queue:
  - HIV
  - oncology
  - cardiology
  - ED
  - sepsis
  - blood bank
  - ophthalmology
  - telemedicine
  - lab
  - imaging
  - pharmacy

Patient mobile baseline:

- home summary and quick actions
- appointment booking, cancellation, and telemedicine join
- post-visit AI companion (summary, grounded Q&A, acknowledgements, thread history)
- prescriptions, reminders, adherence tracking, refill requests
- bills and payment with real integration status handling
- my health: labs, vitals, diabetes, cardiology, goals, care plans
- messaging and notifications with deep links
- patient control extensions required for operational completeness:
  - questionnaires and PRO schedules
  - consents
  - pathways
  - immunizations and forecast
  - admission status and ED visits
  - family access
  - records export (PDF/FHIR/JSON/CSV)
  - symptom checker

## 9. Scope boundaries (v1 vs v1.1)

v1 must include all role baselines above.

v1.1 can extend with richer analytics and specialty drilldowns that are not blocker workflows on mobile.

Boundary rule:

- when a feature is read-heavy and complex, mobile may open a scoped detail or read-only view and defer deep configuration to web
- no critical action may be deferred if it is required for immediate clinical safety or patient adherence

## 10. Cross-role end-to-end flows (required for signoff)

1. Nurse escalation to doctor closure:
   - nurse escalates from worklist
   - doctor receives inbox/push and acknowledges
   - doctor resolves with note/action
   - nurse sees updated status
2. Telemedicine to post-visit continuum:
   - consultation starts and ends
   - recording and post-visit session processed
   - doctor signs off and publishes
   - patient receives summary notification and companion follow-up
3. Medication adherence to financial continuity:
   - patient receives reminder
   - marks medication taken
   - submits refill request
   - receives bill/payment update and receipt state
4. Chronic care continuity:
   - patient updates vitals or PRO response
   - provider queue reflects follow-up signal
   - provider executes task and patient gets notification

## 11. AI/CDSS completeness contract

AI/CDSS is mandatory but advisory:

- no autonomous diagnosis or treatment execution without human confirmation
- every AI suggestion must show source context and confidence/traceability metadata where available
- every AI action entry must produce an auditable event (who accepted/overrode and when)

Role-level AI minimum:

- doctor: escalation support, post-visit drafting/signoff assist, guideline-assisted decisions, dictation assist
- nurse: triage/vitals interpretation assist, escalation recommendation assist, handoff assist
- patient: post-visit grounded Q&A, adherence coaching summaries, preventive reminder nudges

## 12. Sprint sequence

1. Sprint 00: foundation, architecture, API contract, notification backbone
2. Sprint 01: tenant bootstrap, auth, shell navigation, persistent clinic selection
3. Sprint 02: provider mobile workflows (doctor + nurse) including module launchpad
4. Sprint 03: patient mobile workflows and engagement-heavy reminders
5. Sprint 04: offline rules, performance, E2E, release hardening, signoff stabilization
6. Sprint 05: store-ready builds, crash reporting, release operations, and beta rollout

## 13. Mandatory delivery gate for every sprint

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

## 14. Non-negotiable release rules

- English only for v1
- iOS and Android from the same TypeScript codebase
- No hardcoded deployment URLs
- No tenant selector after first successful configuration unless app data is cleared
- No screen ships without loading, empty, error, and offline states
- No PHI stored outside approved secure or encrypted local storage
- No critical workflow ships without notification handling
- No sprint closes without updated QA notes and API contract references
- No backend schema change ships without a provisioning migration and tenant-safe repair path

## 15. Evidence pack required for sprint signoff

Each sprint must produce an evidence bundle in `reports/mobile/` (or equivalent) containing:

- role-based smoke checklist (doctor, nurse, patient)
- API contract verification list with endpoint responses
- mobile screenshots/video clips matching V3 design direction
- AI/CDSS safety checks (assistive behavior + audit trail)
- offline and reconnect behavior notes for impacted screens
- known limitations and defer list (explicitly marked for next sprint)
