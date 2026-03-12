# Mobile Role Feature Traceability Matrix

## Purpose

This matrix links mobile sprint scope to real MediCore capabilities so doctor, nurse, and patient flows are complete and auditable.

Use this during sprint planning and signoff to prevent missing critical role workflows.

## Doctor scope matrix

| Capability | Route/API anchor | Sprint | Priority |
| --- | --- | --- | --- |
| Ward rounds list with urgency | `/ehr/:tenantSlug/doctor` web flow, provider aggregate APIs | 02 | P0 |
| Escalation inbox + SLA + acknowledge/resolve | `GET /nurse-worklist/doctor-sync-feed`, `POST /nurse-worklist/cross-module/workflow` | 02 | P0 |
| Secure messages + unread count | `GET /messages/inbox`, `GET /messages/unread-count`, threads/reply/read APIs | 02 | P0 |
| PostVisit signoff queue | `GET /post-visit/sessions`, `POST /post-visit/sessions/:id/review`, `POST /post-visit/sessions/:id/publish` | 02 | P0 |
| PostVisit audio and transcript support | `GET /post-visit/sessions/:id/recording-url`, `POST /post-visit/sessions/:id/transcribe` | 02 | P0 |
| Telemedicine consultation join/end | `GET /telemedicine/consultations`, `POST /telemedicine/consultations/:id/join`, `POST /telemedicine/consultations/:id/end` | 02 | P0 |
| AI/CDSS assist panel | CDSS query flows + post-visit recommendation routes | 02 | P1 |
| Dictation entry | PostVisit transcription and draft workflow routes | 02 | P1 |
| Module launchpad cards (ED, OR, PACU, MAR, Blood Bank, Sepsis, Infection, CDI, Revenue, Population, HIV, Oncology, Maternity) | Existing doctor module routes in web app with mobile action cards | 02 | P1 |

## Nurse scope matrix

| Capability | Route/API anchor | Sprint | Priority |
| --- | --- | --- | --- |
| Shift dashboard state | `GET /nurse-worklist/state` | 02 | P0 |
| Cross-module feed | `GET /nurse-worklist/cross-module-feed` | 02 | P0 |
| Escalation send flow | `POST /nurse-worklist/cross-module/workflow` | 02 | P0 |
| Alert acknowledgement | `POST /nurse-worklist/alerts/:alertId/acknowledge` | 02 | P0 |
| Task completion | `POST /nurse-worklist/tasks/:taskId/complete` | 02 | P0 |
| Handoff finalize/review/share | `POST /nurse-worklist/handoff/:patientId/finalize`, `.../review`, `.../share` | 02 | P0 |
| Secure messaging | Provider messaging routes under `/messages` | 02 | P0 |
| Cross-module recommendation execution | `POST /nurse-worklist/cross-module/*-recommendation-action` routes | 02 | P1 |
| Vitals capture with AI interpretation | nurse vitals workflow + escalation linkage | 02 | P1 |

## Patient scope matrix

| Capability | Route/API anchor | Sprint | Priority |
| --- | --- | --- | --- |
| Home summary and quick actions | `GET /patient-portal/dashboard/summary` | 03 | P0 |
| Appointments and telemedicine join | `GET /patient-portal/appointments`, request/cancel + telemedicine consultation routes | 03 | P0 |
| PostVisit AI companion | `/patient-portal/post-visit/sessions/*` | 03 | P0 |
| Medications, reminders, adherence, refill | `/patient-portal/prescriptions*`, reminders, adherence, refill routes | 03 | P0 |
| Bills and payments | `GET /patient-portal/bills`, `POST /patient-portal/payments` | 03 | P0 |
| Messaging and notifications | `/patient-portal/messages*`, `/patient-portal/notifications*` | 03 | P0 |
| My Health (labs, vitals, diabetes, cardiology, goals, care plans) | `/patient-portal/lab-results`, `/vitals`, `/diabetes/*`, `/cardiology/*`, `/goals*`, `/care-plans*` | 03 | P1 |
| Questionnaires and PRO schedules | `/patient-portal/questionnaires/*` | 03 | P1 |
| Consents and pathways | `/patient-portal/consents*`, `/patient-portal/pathways*` | 03 | P1 |
| Immunizations and forecast | `/patient-portal/immunizations*` | 03 | P1 |
| Admission and ED status | `/patient-portal/admission/*`, `/patient-portal/ed-visits*` | 03 | P1 |
| Family access controls | `/patient-portal/family-access*` | 03 | P1 |
| Record exports | `/patient-portal/export/pdf`, `/export/fhir`, `/export/json`, `/export/csv` | 03 | P1 |

## AI/CDSS traceability

| Role | AI/CDSS capability | Required proof for signoff |
| --- | --- | --- |
| Doctor | Escalation recommendation support and post-visit AI review/signoff support | Recommendation rendered as advisory, doctor action audited, no auto-commit |
| Nurse | Vitals/triage assistance and escalation assistance | Nurse confirmation required before escalation/task mutation |
| Patient | Grounded post-visit Q&A and adherence nudges | Questions answered from approved summary context with traceable source |

## Signoff checklist

- Every P0 capability is demoed and has smoke evidence.
- Any missing P1 capability has a dated deferred ticket and owner.
- No mobile-critical API route is undocumented in sprint files.
- Any schema change has migration + provisioning + tenant repair coverage.
