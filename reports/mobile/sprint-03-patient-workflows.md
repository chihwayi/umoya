# Sprint 03 Evidence: Patient Workflows and Engagement Flows

Date: 2026-03-13

## Implemented scope

- Replaced all patient placeholder tabs with live API-backed workflows aligned to the V3 mobile template style.
- Added patient API wrapper layer in `mobile-app/src/services/api/patient.ts` covering:
  - dashboard summary, appointments, notifications, messages
  - post-visit companion sessions/summary/lab trends/annotated summary/Q&A/messages/acknowledgements
  - medications, reminders, adherence logs/summary, refill requests
  - bills and payment requests
  - my-health data domains (labs, vitals, diabetes, cardiology, goals, care plans)
  - continuity modules (questionnaires, consents, pathways, immunizations, admission/ED, family access, exports)
- Added patient hooks and UI primitives under `mobile-app/src/features/patient/`.

## Screen wiring completed

- `/patient/home`
- `/patient/postvisit`
- `/patient/medications`
- `/patient/bills`
- `/patient/my-health`

## Key files

- `mobile-app/src/services/api/patient.ts`
- `mobile-app/src/features/patient/hooks/*.ts`
- `mobile-app/src/features/patient/ui/*.tsx`
- `mobile-app/src/features/patient/utils/format.ts`
- `mobile-app/src/app/patient/home.tsx`
- `mobile-app/src/app/patient/postvisit.tsx`
- `mobile-app/src/app/patient/medications.tsx`
- `mobile-app/src/app/patient/bills.tsx`
- `mobile-app/src/app/patient/my-health.tsx`

## Validation gates

Executed inside `mobile-app/`:

1. `npm run test` ✅
2. `npm run lint` ✅
3. `npm run typecheck` ✅
4. `npx expo-doctor` ✅
5. `npm run test` ✅
6. `npm run test:e2e -- patient-workflows` ✅
