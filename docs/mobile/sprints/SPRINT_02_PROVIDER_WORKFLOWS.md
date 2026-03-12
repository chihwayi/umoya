# Sprint 02: Provider Workflows, Escalations, Messaging, and Ward Speed

## Objective

Bring the doctor and nurse parts of the V3 design to life using actual MediCore workflows.

This sprint should make the provider app feel clinically useful, not decorative.

## Duration

1 to 2 sprints depending on staffing

## Design scope to match

Doctor:

- Ward Rounds
- PostVisit AI signoff
- Escalation Inbox
- Secure Messages
- AI Assist
- Dictation entry point
- Provider module launchpad for doctor-critical modules:
  - Emergency Department
  - Operating Room
  - PACU
  - MAR
  - Blood Bank
  - Sepsis
  - Infection Control
  - CDI
  - Revenue Cycle
  - Population Health
  - HIV
  - Oncology
  - Maternity

Nurse:

- Shift dashboard
- vitals capture
- escalation send sheet
- secure messages
- task and alert acknowledgement
- handoff review/finalize/share
- cross-module recommendation execution queue

## Priority workflow groups

### Doctor escalation inbox

Required behavior:

- severity badge
- SLA countdown
- vitals snapshot at escalation time
- AI/CDSS suggestion panel
- acknowledge and resolve actions
- patient context deep-link

Primary APIs:

- `GET /ehr-service/api/nurse-worklist/doctor-sync-feed`
- `POST /ehr-service/api/nurse-worklist/cross-module/workflow`
- `POST /ehr-service/api/nurse-worklist/alerts/:alertId/acknowledge`
- `POST /ehr-service/api/nurse-worklist/tasks/:taskId/complete`

Mobile-specific backend improvement recommended:

- add a mobile-optimized provider inbox aggregate endpoint if the current feed is too chatty
- include unread counts, SLA minutes remaining, and patient summary fields in one payload

### Nurse escalation send flow

Required behavior:

- escalate button on task/triage rows
- severity selector
- doctor selector
- finding/note input
- confirmation state that SLA started

Primary APIs:

- `GET /ehr-service/api/nurse-worklist/state`
- `POST /ehr-service/api/nurse-worklist/cross-module/workflow`
- `GET /ehr-service/api/nurse-worklist/analytics/doctor-outcomes`

Where HIV queue actions are involved:

- `GET /ehr-service/api/hiv/cohort-worklist`
- `POST /ehr-service/api/nurse-worklist/cross-module/hiv-recommendation-action`

### Nurse cross-module execution coverage

Required behavior:

- nurse can execute specialist recommendations without leaving nurse shell
- each execution captures actor, module, patient context, and destination routing
- action status reflects immediately in doctor sync feed

Primary APIs:

- `POST /ehr-service/api/nurse-worklist/cross-module/oncology-recommendation-action`
- `POST /ehr-service/api/nurse-worklist/cross-module/cardiology-recommendation-action`
- `POST /ehr-service/api/nurse-worklist/cross-module/ed-recommendation-action`
- `POST /ehr-service/api/nurse-worklist/cross-module/sepsis-recommendation-action`
- `POST /ehr-service/api/nurse-worklist/cross-module/blood-bank-recommendation-action`
- `POST /ehr-service/api/nurse-worklist/cross-module/ophthalmology-recommendation-action`
- `POST /ehr-service/api/nurse-worklist/cross-module/telemedicine-recommendation-action`
- `POST /ehr-service/api/nurse-worklist/cross-module/lab-recommendation-action`
- `POST /ehr-service/api/nurse-worklist/cross-module/imaging-recommendation-action`
- `POST /ehr-service/api/nurse-worklist/cross-module/pharmacy-recommendation-action`

### Secure messaging

Required behavior:

- inbox
- unread counters
- thread list by priority/type
- thread detail
- compose new message
- patient context attachment to a thread

Primary APIs:

- `GET /ehr-service/api/messages/inbox`
- `GET /ehr-service/api/messages/threads`
- `GET /ehr-service/api/messages/threads/:id`
- `POST /ehr-service/api/messages`
- `POST /ehr-service/api/messages/threads`
- `POST /ehr-service/api/messages/:id/reply`
- `PUT /ehr-service/api/messages/:id/read`
- `GET /ehr-service/api/messages/unread-count`

### Ward rounds and HIV workflow

The doctor home cannot just be navigation chrome. It must open on useful clinical work.

Required behavior:

- patient cards with urgency
- ward-round queue
- pending post-visit signoffs
- HIV cohort next-best-action queue
- deep-link into regimen, EAC, and follow-up work

Primary APIs:

- `GET /ehr-service/api/hiv/cohort-worklist`
- `GET /ehr-service/api/hiv/enrollments`
- `GET /ehr-service/api/hiv/enrollments/:enrollmentId`
- `GET /ehr-service/api/hiv/visits/enrollment/:enrollmentId`
- `POST /ehr-service/api/hiv/visits`
- `POST /ehr-service/api/hiv/eac/sessions`
- `POST /ehr-service/api/hiv/arv-change-requests`
- `GET /ehr-service/api/hiv/arv-change-requests`
- `PATCH /ehr-service/api/hiv/arv-change-requests/:requestId/approve`
- `PATCH /ehr-service/api/hiv/arv-change-requests/:requestId/reject`
- `POST /ehr-service/api/hiv/regimen-change/precheck`

### PostVisit and telemedicine hooks

Doctor workflows should include:

- post-visit pending signoff count
- telemedicine consultation access
- dictation entry point

Primary APIs:

- `GET /ehr-service/api/post-visit/sessions`
- `GET /ehr-service/api/post-visit/sessions/:id`
- `GET /ehr-service/api/post-visit/sessions/:id/mobile-contract`
- `GET /ehr-service/api/post-visit/sessions/:id/mobile-events`
- `GET /ehr-service/api/post-visit/sessions/:id/recording-url`
- `GET /ehr-service/api/post-visit/sessions/:id/draft`
- `POST /ehr-service/api/post-visit/sessions/:id/transcribe`
- `POST /ehr-service/api/post-visit/sessions/:id/review`
- `POST /ehr-service/api/post-visit/sessions/:id/publish`
- `GET /ehr-service/api/telemedicine/consultations`
- `GET /ehr-service/api/telemedicine/consultations/:id`
- `POST /ehr-service/api/telemedicine/consultations/:id/join`
- `GET /ehr-service/api/telemedicine/consultations/:id/meeting-url`
- `POST /ehr-service/api/telemedicine/consultations/:id/end`
- `GET /ehr-service/api/telemedicine/monitoring/alerts`

## Backend work required in this sprint

If these are missing or not optimized enough, add them now:

- provider push event generation for escalation, message, handoff, and critical result
- mobile-friendly aggregate ward dashboard endpoint
- compact patient summary payload for ward cards
- push unread counters for message inbox and escalation inbox
- provider shell endpoint for module launchpad cards (counts + urgency) if current endpoints are too fragmented

## UI constraints

- urgent items must show live visual urgency
- unread counts must appear in tabs and headers
- no provider screen should require three or more nested taps to reach action
- AI suggestions must be visually distinct and clearly advisory
- dictation and AI assist should be reachable from doctor context, not buried in settings
- critical module launchpad cards must show badge counts and route to focused mobile actions

## Test cases

- doctor sees active escalations with correct counts
- acknowledgement updates queue state
- nurse escalation send creates workflow state and triggers notification
- provider inbox unread count updates after reading a thread
- HIV cohort worklist loads and filters correctly
- ARV approval flow works
- telemedicine join flow opens meeting metadata
- nurse executes cross-module recommendation action and doctor sees update
- doctor completes post-visit review and publish from mobile without web fallback
- module launchpad cards show live counts for at least ED, sepsis, blood bank, and population health

## Acceptance criteria

- doctor and nurse tabs match the selected design intent
- escalation inbox is backed by real queue data
- secure messaging is functional, not mocked
- HIV worklist is visible on mobile and actionable
- push notification categories exist for provider critical events
- nurse cross-module execution actions are operational for all listed module categories
- post-visit mobile contract/events are consumed for session cards and queue updates
- module launchpad exists and routes into mobile-first provider workflows

## Definition of done

```bash
npm run test --workspace=mobile-app
npm run lint --workspace=mobile-app
npm run typecheck --workspace=mobile-app
npx expo-doctor
npm run test --workspace=mobile-app
npm run test:e2e --workspace=mobile-app -- provider-workflows
git add .
git commit -m "mobile: sprint 02 provider workflows"
```
