# MediCore Mobile Reference

**Last updated:** 2026-03-28
**Status:** Feature-complete — Sprint 124 + 125 delivered. Zero TypeScript errors. Zero mock data.
**Platform:** React Native + Expo — single codebase for iOS and Android.
**Location:** `mobile/`

---

## 1. What Is Built

### Role Coverage

| Role | Screens | Status |
|---|---|---|
| Doctor | Rounds, PostVisit, Escalations, Messages, AI/CDSS Tools, Imaging Reports (sub), Med Rec (sub) | ✅ Complete |
| Nurse | Shift Worklist, Vitals Entry, Messages | ✅ Complete |
| Patient | Home, Appointments, Post-Visit AI Chat, Medications, Bills, Health Records, Telemedicine | ✅ Complete |

### Feature Summary

**Doctor**
- Ward round patient list with SLA timers, bed/ward, admission diagnosis
- Bedside vitals with trend sparklines + CDSS deterioration risk
- AI CDSS tools: drug interactions, differential diagnosis, dosing, lab interpretation, guideline search, risk scoring
- Text imaging reports with AI pre-read (radiologist impression highlighted)
- Medication reconciliation — per-drug decisions (Continue/Hold/Discontinue/Modify) + AI reconciliation check
- Escalations inbox with priority filtering and acknowledgement
- Messaging with threading

**Nurse**
- Shift worklist — task cards with overdue detection, completion via real API
- Triage queue — ESI levels, wait times, AI-powered SBAR generation, fall risk assessment
- Vitals entry form — multi-parameter, validated, CDSS insights on submission
- Messaging

**Patient**
- Home dashboard — upcoming appointment, active meds, recent labs, AI care gaps, post-visit summary
- Appointments — upcoming list, cancel, book request (type selector + date + notes)
- Post-visit AI chat — real `PatientAiService` with session persistence, history load on open
- Medications + adherence tracking + refill requests
- Billing — estimates, payment history, EcoCash/OneMoney mobile money payments
- Health records — conditions, allergies, vitals history with sparklines, care gap cards
- Telemedicine — Daily.co video sessions, quality reporting, satisfaction survey

---

## 2. Tech Stack

### Core Platform
- **React Native 0.83.2 + Expo ~55** — iOS + Android from one codebase
- **TypeScript** — strict mode, zero `any` except at service boundaries
- **Expo Router / React Navigation** — tab + stack navigation per role

### State & Data
- **Zustand** — auth store, cross-screen UI state (tenant, role, user, JWT)
- **Axios** — all API calls through `mobile/src/services/api.ts` with JWT + X-Tenant-ID interceptors
- **expo-secure-store** — encrypted on-device storage for JWT, role, user, tenant

### Key Libraries
| Library | Use |
|---|---|
| `react-native-safe-area-context` | Inset-aware layouts |
| `expo-local-authentication` | Biometric unlock |
| `expo-notifications` | Push + local reminders |
| `react-native-webview` | Daily.co telemedicine |
| `@react-navigation/bottom-tabs` | Tab navigators per role |
| `react-native-svg` | Sparkline micro-charts |

### Design System
- Tokens in `mobile/src/design/tokens.ts` — `C` (colors), `FONT`, `RADIUS`, `SHADOW`
- Font families: `FONT.ui` (400), `FONT.uiMd` (500), `FONT.uiSb` (600), `FONT.uiBd` (700), `FONT.uiBk` (800)
- Icons: `mobile/src/design/icons.ts` — named glyphs only, never guess names
- Shared UI: `mobile/src/components/ui/` — `Icon`, `Badge`, `AiBadge`, `AiPulse`, `Card`, `Dot`, `SectionHeader`, `ScreenHeader`, `SlaTimer`, `Sparkline`

---

## 3. Architecture Rules

**Non-negotiable:**
- Screens never call `fetch`/`axios` directly — all API access goes through `mobile/src/services/*`
- No hardcoded colors in screens — use tokens from `design/tokens.ts`
- No hardcoded URLs — `baseURL` comes from `EXPO_PUBLIC_API_BASE` via `mobile/src/config/env.ts`
- CDSS results always have an abstained fallback — never show fake data on failure
- `Card` component style prop is `StyleProp<ViewStyle>` — array styles are allowed

**File structure:**
```
mobile/src/
├── components/
│   ├── doctor/       ← Doctor screens
│   ├── nurse/        ← Nurse screens
│   ├── patient/      ← Patient screens
│   ├── shared/       ← NotificationCentre, LoginScreen, TenantSelectScreen
│   └── ui/           ← Design system components
├── services/         ← API service modules (one per domain)
├── stores/           ← Zustand stores
├── navigation/       ← RootNavigator.tsx (all tabs + stacks)
├── design/           ← tokens.ts, icons.ts
└── config/           ← env.ts
```

---

## 4. API Wiring — Backend Contract

All mobile API calls go to the EHR service. Auth is JWT Bearer + `X-Tenant-ID` header.

### Mobile Service → EHR Endpoint Map

| Service file | Key endpoints | EHR controller |
|---|---|---|
| `appointments.ts` | `GET /patient-portal/appointments`, `POST /patient-portal/appointments/request` | `PatientPortalController` |
| `cdss.ts` | `POST /governed/json` (all AI surfaces) | `GovernedController` |
| `imaging.ts` | `GET /imaging/orders/patient/:id`, `GET /imaging/reports/:id` | `ImagingController` |
| `nurseWorklist.ts` | `GET /nurse-worklist/state`, `PATCH /nurse-worklist/tasks/:id/complete` | `NurseWorklistController` |
| `patientAi.ts` | `POST /patient-ai/adherence/chat`, `GET /patient-ai/adherence/patient/:id` | `PatientAiController` |
| `prescriptions.ts` | `GET /prescriptions/patient/:id` | `PrescriptionsController` |
| `vitals.ts` | `GET /vitals/patient/:id`, `POST /vitals` | `VitalsController` |
| `labOrders.ts` | `GET /lab-orders/patient/:id/results` | `LabOrdersController` |
| `telemedicine.ts` | `GET /telemedicine/consultations/:id/token` | `TelemedicineController` |
| `escalations.ts` | `GET /critical-alerts/pending` | `CriticalAlertsController` |
| `messages.ts` | `GET /messages/inbox`, `POST /messages` | `MessagesController` |
| `billing.ts` + `payments.ts` | `GET /billing/bills`, `POST /payments/ecocash` | `BillingController`, `PaymentsController` |
| `patientProfile.ts` | `GET /patient-portal/profile`, `GET /patients/:id/history/medical` | `PatientPortalController` |
| `postVisit.ts` | `GET /post-visit/sessions` | `PostVisitController` |

### Governed JSON Hub (`POST /governed/json`)

All CDSS AI calls use this single endpoint. Route by `surface` field:

| Surface | Mobile method | CDSS backend |
|---|---|---|
| `sbar_generation` | `CdssService.generateSBAR()` | `/nursing/sbar` |
| `fall_risk_assessment` | `CdssService.assessFallRisk()` | `/nursing/fall-risk` |
| `medication_reconciliation` | `CdssService.reconcileMedications()` | `/medication/reconciliation` |
| `dose_calculator` | `CdssService.dosing()` | `/dosing/recommend` |
| `clinical_risk_score` | `CdssService.riskScore()` | `/risk/calculate` |
| `diagnosis_mobile` | `CdssService.diagnosisSuggest()` | `/diagnosis/suggest` |
| `lab_interpretation_mobile` | `CdssService.interpretLab()` | `/labs/interpret` |
| `nurse_shift_summary` | `CdssService.getAiShiftSummary()` | `/nursing/sbar` (handoff) |

Response always: `{ result: {...} }` or `{ abstained: true }` — never throws.

---

## 5. Environment Configuration

`mobile/.env` (copy from `mobile/.env.example`):

```env
EXPO_PUBLIC_API_BASE=https://your-medicore-instance.com
```

Derived automatically in `mobile/src/config/env.ts`:
- `API_BASE_URL` — base for all HTTP calls
- `WS_BASE_URL` — WebSocket base (wss://)
- `TENANT_DISCOVERY_URL` — for tenant selection screen

Android emulator: `127.0.0.1` is automatically remapped to `10.0.2.2`.

---

## 6. Auth Flow

```
App launch → useAuthStore.hydrate() → check SecureStore
  → JWT present → route to role tab navigator (doctor/nurse/patient)
  → JWT absent → TenantSelectScreen → LoginScreen
```

**LoginScreen supports:**
- Staff: email + password → `POST /auth/login`
- Patient: OTP flow → `POST /patient-portal/auth/send-otp` + verify
- Patient: PIN entry (returning users)
- Biometric fallback (Face ID / fingerprint via `expo-local-authentication`)

**Security features:**
- Inactivity lock (AppState listener in `utils/security.ts`)
- HIPAA privacy overlay on background
- JWT auto-cleared on 401 response

---

## 7. Before App Store Submission

| Item | Action |
|---|---|
| EAS project ID | Run `eas init` → fills `mobile/app.json` `extra.eas.projectId` |
| `google-services.json` | Download from Firebase console → place in `mobile/` |
| App icon + splash | Replace assets in `mobile/assets/` |
| iOS signing | Apple Developer account → Provisioning Profile + cert |
| Android signing | Google Play Console → upload key |
| Physical device test | `npx expo run:ios` / `npx expo run:android` |

Bundle IDs (already configured in `app.json`):
- iOS: `com.medicore.clinical`
- Android: `com.medicore.clinical`

---

## 8. AI/CDSS Safety Contract

- No automatic diagnosis or treatment commit without explicit clinician action
- All AI results show confidence or abstention state — never silent failure
- `abstained: true` response → show "AI unavailable — review manually" message
- SBAR and fall risk outputs are assistive — doctor/nurse must confirm before acting
- Patient AI chat is grounded in visit data — no general medical advice

---

## 9. Definition of Done (Mobile)

A mobile feature is **done** when:
- [ ] `npx tsc --noEmit` — zero errors in `mobile/`
- [ ] Service module calls a real EHR endpoint (no hardcoded/mock data)
- [ ] Loading, empty, and error states all handled
- [ ] `abstained: true` CDSS responses handled gracefully
- [ ] Token style uses `fontFamily: FONT.uiBd` etc. — no spread syntax
- [ ] Icon name verified against `mobile/src/design/icons.ts`
- [ ] Works on both iOS and Android layouts (safe area insets applied)
