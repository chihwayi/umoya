# Sprint 127: Patient Journey Parity

## Goal

Close the patient-facing journey gaps between the web platform and the mobile app without adding unnecessary workflow complexity.

## Guardrails

- No hard-coded URLs. Use existing env/config-backed clients only.
- No database changes unless absolutely necessary.
- If a DB change becomes necessary, update provisioning first and run tenant repair for current tenants.

## Problems We Are Fixing

1. Mobile patient login is wired to OTP endpoints that are not implemented in this repo.
2. Mobile patient post-visit screens call clinician-only endpoints instead of patient-portal endpoints.
3. Mobile patient documents use a route that does not exist.
4. Mobile patient health screens still rely on several staff-oriented contracts instead of patient-safe portal contracts.
5. The web repo still carries an orphaned patient registration implementation that drifted away from the live create-patient flow.
6. Mobile patient telemedicine still relies on clinician telemedicine endpoints and can incorrectly try to end the full consultation from the patient device.
7. Mobile patient unread messaging indicators still rely on staff messaging routes instead of patient-portal messaging contracts.
8. The patient home bell exposes unread state but there is no patient inbox screen to actually open those messages in-app.

## Scope

### Backend

- Add patient-portal endpoints for:
  - conditions
  - allergies
  - documents
  - patient telemedicine consultation list
  - patient telemedicine consultation detail
  - patient telemedicine meeting token
  - patient telemedicine room status
  - patient telemedicine satisfaction capture

### Mobile

- Rewire patient login to `POST /patient-portal/login`
- Normalize patient auth payloads into the mobile auth store
- Rewire patient post-visit summary and chat to patient-portal post-visit endpoints
- Rewire patient documents to patient-portal documents
- Rewire patient conditions and allergies to patient-portal endpoints
- Rewire patient prescriptions, bills, labs, vitals, and appointment cancel flows to patient-safe contracts where already available
 - Rewire patient telemedicine to patient-portal telemedicine contracts
 - Remove patient-side use of the global consultation completion endpoint
 - Rewire patient unread message count to patient-portal messaging
 - Add a patient inbox screen reachable from the home bell without adding more bottom-tab clutter

### Web

- Collapse the stale `PatientRegistrationForm` implementation onto the live `CreatePatientModal` flow so the repo has one registration source of truth

## Verification

- `npm run mobile:lint`
- `npm run mobile:typecheck`
- `npm run build -w @medicore/ehr-service`
- `npm test -w @medicore/ehr-service -- --runInBand`
- `npm run build -w medicore-ehr-frontend`

## Completion Notes

- Completed patient login migration from unimplemented OTP endpoints to the real patient-portal login contract.
- Completed patient-safe rewiring for post-visit, documents, conditions, allergies, bills, prescriptions, labs, vitals, and appointment cancellation.
- Completed patient-safe telemedicine rewiring and removed the patient-side full-consultation end call.
- Completed patient unread messaging rewiring to patient-portal messaging data.
- Completed a patient inbox screen and stack navigation so unread home-bell state now opens a real secure messaging flow.
- Completed registration drift cleanup by making `PatientRegistrationForm` resolve to the live `CreatePatientModal` implementation.
- No database changes were required in this sprint, so provisioning and tenant repair were not needed.
- `npm run mobile:doctor` remains environment-sensitive and was not used as the release gate for this sprint.

## Done When

- Patient login works against the implemented patient-portal auth contract
- Patient post-visit no longer depends on clinician-only routes
- Patient documents no longer call a nonexistent path
- Mobile patient health flows use patient-safe APIs for the contracts added in this sprint
- The web registration codebase no longer carries a stale parallel registration implementation
- Patient telemedicine no longer depends on clinician-only routes for the patient experience
- Patient unread message state no longer depends on staff messaging routes
- Patient unread message affordances open a working in-app inbox instead of a dead end
