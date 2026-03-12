# Sprint 03: Patient Workflows, Heavy Notifications, Adherence, and Payments

## Objective

Deliver the patient half of the V3 design as a serious companion app:

- home
- post-visit AI
- medications
- bills and payment
- my health
- notifications

This sprint should make the app useful every day, not only on clinic days.

## Duration

1 to 2 sprints depending on payment and reminder complexity

## Core patient modules

### Home

Required content:

- greeting and next appointment
- post-visit AI summary card
- medication reminder strip
- quick actions for appointment, telemedicine, bills, symptom check
- unread notifications badge

Primary APIs:

- `GET /ehr-service/api/patient-portal/dashboard/summary`
- `GET /ehr-service/api/patient-portal/appointments`
- `GET /ehr-service/api/patient-portal/notifications`

### PostVisit AI companion

Required behavior:

- list published sessions
- open approved summary
- ask grounded follow-up questions
- see companion chat history
- record acknowledgement events

Primary APIs:

- `GET /ehr-service/api/patient-portal/post-visit/sessions`
- `GET /ehr-service/api/patient-portal/post-visit/sessions/:id/summary`
- `GET /ehr-service/api/patient-portal/post-visit/sessions/:id/lab-trends`
- `GET /ehr-service/api/patient-portal/post-visit/sessions/:id/recording-url`
- `GET /ehr-service/api/patient-portal/post-visit/sessions/:id/summary/annotated`
- `POST /ehr-service/api/patient-portal/post-visit/sessions/:id/ask-section`
- `GET /ehr-service/api/patient-portal/post-visit/sessions/:id/messages`
- `POST /ehr-service/api/patient-portal/post-visit/sessions/:id/messages`
- `POST /ehr-service/api/patient-portal/post-visit/sessions/:id/acknowledgements`

### Medications and adherence

Required behavior:

- prescription list
- medication card with reminder toggle
- 7-day adherence grid
- mark-as-taken action
- refill request flow
- adherence summary

Primary APIs:

- `GET /ehr-service/api/patient-portal/prescriptions`
- `POST /ehr-service/api/patient-portal/prescriptions/:prescriptionId/refill-request`
- `GET /ehr-service/api/patient-portal/prescriptions/refill-requests`
- `POST /ehr-service/api/patient-portal/prescriptions/:prescriptionId/reminders`
- `GET /ehr-service/api/patient-portal/prescriptions/reminders`
- `PUT /ehr-service/api/patient-portal/prescriptions/reminders/:reminderId`
- `DELETE /ehr-service/api/patient-portal/prescriptions/reminders/:reminderId`
- `POST /ehr-service/api/patient-portal/prescriptions/:prescriptionId/adherence`
- `GET /ehr-service/api/patient-portal/prescriptions/adherence/summary`
- `GET /ehr-service/api/patient-portal/prescriptions/adherence/logs`

### Bills and mobile payment

Required behavior:

- bills list
- line-item drilldown
- medical aid claim status where available
- payment method choice
- review and confirm steps
- payment receipt state

Primary APIs:

- `GET /ehr-service/api/patient-portal/bills`
- `POST /ehr-service/api/patient-portal/payments`
- `POST /ehr-service/api/patient-portal/appointments/request-with-payment`

Revenue visibility extension:

- if patient-facing claim status is needed beyond existing bill payload, add a patient-safe bill/claim summary endpoint rather than exposing raw claim internals

### My Health

Required behavior:

- lab results
- vitals history
- diabetes and cardiology views where applicable
- goals and care plans

Primary APIs:

- `GET /ehr-service/api/patient-portal/lab-results`
- `GET /ehr-service/api/patient-portal/vitals`
- `POST /ehr-service/api/patient-portal/vitals/submit`
- `GET /ehr-service/api/patient-portal/diabetes/registry`
- `GET /ehr-service/api/patient-portal/diabetes/glucose-history`
- `GET /ehr-service/api/patient-portal/diabetes/care-plan`
- `GET /ehr-service/api/patient-portal/diabetes/medications`
- `GET /ehr-service/api/patient-portal/cardiology/encounters`
- `GET /ehr-service/api/patient-portal/cardiology/blood-pressure-trends`
- `GET /ehr-service/api/patient-portal/goals`
- `POST /ehr-service/api/patient-portal/goals`
- `GET /ehr-service/api/patient-portal/care-plans`

### Care continuity and patient control modules

Required behavior:

- questionnaires and PRO follow-ups are visible and submittable
- patient can manage consents and view pathway progress
- immunization records and due forecast are visible
- current admission and ED visit status can be reviewed
- family/caregiver access can be granted/revoked
- patient can export records in supported formats

Primary APIs:

- `GET /ehr-service/api/patient-portal/questionnaires/available`
- `GET /ehr-service/api/patient-portal/questionnaires/pending`
- `GET /ehr-service/api/patient-portal/questionnaires/history`
- `GET /ehr-service/api/patient-portal/questionnaires/schedules`
- `GET /ehr-service/api/patient-portal/questionnaires/:questionnaireId`
- `POST /ehr-service/api/patient-portal/questionnaires/:questionnaireId/submit`
- `GET /ehr-service/api/patient-portal/consents`
- `POST /ehr-service/api/patient-portal/consents/:id/sign`
- `POST /ehr-service/api/patient-portal/consents/:id/decline`
- `GET /ehr-service/api/patient-portal/pathways`
- `GET /ehr-service/api/patient-portal/pathways/:enrollmentId/progress`
- `GET /ehr-service/api/patient-portal/immunizations`
- `GET /ehr-service/api/patient-portal/immunizations/forecast`
- `GET /ehr-service/api/patient-portal/admission/current`
- `GET /ehr-service/api/patient-portal/admission/history`
- `GET /ehr-service/api/patient-portal/ed-visits`
- `GET /ehr-service/api/patient-portal/family-access`
- `POST /ehr-service/api/patient-portal/family-access`
- `DELETE /ehr-service/api/patient-portal/family-access/:id`
- `POST /ehr-service/api/patient-portal/export/pdf`
- `GET /ehr-service/api/patient-portal/export/fhir`
- `GET /ehr-service/api/patient-portal/export/json`
- `GET /ehr-service/api/patient-portal/export/csv`

### Messaging and notifications

Required behavior:

- notification centre with categories
- deep-links to medications, bills, appointment, post-visit, and messages
- patient-staff messaging

Primary APIs:

- `GET /ehr-service/api/patient-portal/messages`
- `GET /ehr-service/api/patient-portal/messages/:id`
- `POST /ehr-service/api/patient-portal/messages`
- `PUT /ehr-service/api/patient-portal/messages/:id/read`
- `PUT /ehr-service/api/patient-portal/messages/read-all`
- `GET /ehr-service/api/patient-portal/notifications`
- `PUT /ehr-service/api/patient-portal/notifications/:id/read`
- `PUT /ehr-service/api/patient-portal/notifications/read-all`

## Notification rules

Patient notifications should be heavy but useful.

Must ship with these categories:

- medication due
- refill due
- appointment reminder
- telemedicine upcoming
- bill due
- payment receipt
- lab result ready
- doctor message
- post-visit AI update
- questionnaire due
- consent action required
- care pathway milestone due

Delivery behavior:

- scheduled local reminders for medication times
- push notifications for clinic-driven events
- SMS fallback through existing backend reminders for appointments, prescriptions, labs, and payments

## Payment rules

The UI should match the chosen design:

- EcoCash
- OneMoney
- Card
- Bank transfer

Backend note:

- if the current payment route does not yet support all methods end-to-end, keep the UI labels but only enable live methods that are truly integrated
- unsupported payment rails must show as "coming soon" rather than fake success

## Test cases

- patient sees dashboard summary and quick actions
- post-visit summary opens and grounded Q&A works
- reminder toggle persists
- adherence mark-as-taken logs correctly
- refill request submits
- bill payment flow completes or fails with clear feedback
- notification deep-links route correctly
- patient messaging send/read works
- questionnaire completion updates pending count
- consent sign or decline action is persisted
- immunization forecast loads and empty state is meaningful
- admission or ED status view loads safely when there is no active encounter
- export request returns file payload and audit trail entry

## Acceptance criteria

- all major patient tabs from the chosen design are real
- medication reminders and adherence are operational
- payment flow is real for enabled methods
- notifications drive daily engagement
- post-visit AI companion is fully integrated
- care continuity modules (questionnaires, consents, pathways, immunizations, admission/ED, family access, export) are operational

## Definition of done

```bash
npm run test --workspace=mobile-app
npm run lint --workspace=mobile-app
npm run typecheck --workspace=mobile-app
npx expo-doctor
npm run test --workspace=mobile-app
npm run test:e2e --workspace=mobile-app -- patient-workflows
git add .
git commit -m "mobile: sprint 03 patient workflows"
```
