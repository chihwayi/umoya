# Sprint 02 Evidence: Provider Workflows and Live API Wiring

Date: 2026-03-13

## Implemented scope

- Replaced placeholder provider tabs with live API-backed workflows while preserving V3 template style (dark clinical surfaces, token-only colors, consistent state panels).
- Added provider workflow API layer in `mobile-app/src/services/api/provider.ts` for:
  - nurse worklist state/feed/sync
  - nurse workflow/task/alert actions
  - provider messaging inbox/threads/read/send/reply
  - post-visit sessions/mobile contract/mobile events/review/publish
  - telemedicine consultations/join/end/meeting-url
  - HIV cohort worklist read endpoint for doctor rounds context.
- Added provider hooks for query/mutation orchestration:
  - `useProviderWorkflows`
  - `useProviderMessaging`
  - `usePostVisit`
  - `useTelemedicine`
- Added reusable provider UI primitives matching template direction:
  - `ProviderHero`
  - `MetricGrid`
  - `StatusPill`
  - `WorkflowFeedCard`
  - `MessageCard`
  - `SectionHeader`
- Added shared provider utilities for status/time rendering (`format.ts`).

## Screen wiring completed

- Doctor
  - `/doctor/rounds`: telemedicine queue + join/end actions + HIV cohort snapshot.
  - `/doctor/inbox`: doctor synchronization feed with acknowledge/complete actions.
  - `/doctor/messages`: secure messaging inbox/thread/reply/compose.
  - `/doctor/postvisit`: session queue + mobile contract/events view + quick review/publish actions.
  - `/doctor/ai-assist`: advisory CDSS hints sourced from live doctor feed and post-visit readiness.
- Nurse
  - `/nurse/shift`: cross-module feed with acknowledge/complete actions.
  - `/nurse/vitals`: task/alert action controls (`complete`, `acknowledge`) + state tracking.
  - `/nurse/messages`: secure messaging inbox/thread/reply/compose.

## Key files

- `mobile-app/src/services/api/provider.ts`
- `mobile-app/src/features/provider/hooks/useProviderWorkflows.ts`
- `mobile-app/src/features/provider/hooks/useProviderMessaging.ts`
- `mobile-app/src/features/provider/hooks/usePostVisit.ts`
- `mobile-app/src/features/provider/hooks/useTelemedicine.ts`
- `mobile-app/src/features/provider/screens/ProviderMessagesScreen.tsx`
- `mobile-app/src/features/provider/ui/*.tsx`
- `mobile-app/src/features/provider/utils/format.ts`
- `mobile-app/src/app/doctor/rounds.tsx`
- `mobile-app/src/app/doctor/inbox.tsx`
- `mobile-app/src/app/doctor/messages.tsx`
- `mobile-app/src/app/doctor/postvisit.tsx`
- `mobile-app/src/app/doctor/ai-assist.tsx`
- `mobile-app/src/app/nurse/shift.tsx`
- `mobile-app/src/app/nurse/vitals.tsx`
- `mobile-app/src/app/nurse/messages.tsx`

## Validation gates

Executed inside `mobile-app/`:

1. `npm run test` ✅
2. `npm run lint` ✅
3. `npm run typecheck` ✅
4. `npx expo-doctor` ✅ (17/17)
5. `npm run test` ✅
6. `npm run test:e2e` ✅ (Sprint 00 placeholder smoke)

## Notes

- E2E remains placeholder until dedicated provider workflow suites (Maestro/Detox) are added in later Sprint 02 increments.
- Publish may still be blocked by backend doctor-gate checks (required artifact review/citation/safety gates), which is expected and preserved.
