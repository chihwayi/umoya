# Sprint 01: Tenant Bootstrap, Authentication, and App Shell

## Objective

Deliver the first real app experience:

- splash
- first-time clinic selection
- persisted tenant bootstrap
- provider and patient login
- password-change and 2FA handling
- role-based shell navigation
- notification centre shell

## Duration

1 sprint

## User journeys

### First-time user

1. App opens to branded splash.
2. Tenant bootstrap checks local storage.
3. No stored tenant exists, so clinic selection opens.
4. User chooses clinic from list or enters subdomain/code.
5. Tenant is stored locally.
6. User proceeds to role-aware login.
7. On later launches, clinic selection is skipped completely.

### Returning user

1. App opens.
2. Stored tenant bootstrap loads.
3. User lands on role-specific login or quick re-entry path.
4. No tenant picker is shown again.

Production rule:

- tenant bootstrap must survive logout
- it must disappear only when app data is cleared or uninstall occurs

## Screens to build

- splash / boot resolver
- clinic selection
- clinic confirmation
- provider login
- patient login
- force password change
- 2FA code entry
- role landing shell
- global notification centre shell
- generic network/offline/error states

## Navigation shells required

Doctor tab shell:

- Rounds
- PostVisit
- Inbox
- Messages
- AI Assist

Nurse tab shell:

- Shift
- Vitals
- Messages

Patient tab shell:

- Home
- PostVisit
- Medications
- Bills
- My Health

## APIs to consume

Tenant:

- `GET /tenant-service/api/tenants/active`
- `GET /tenant-service/api/tenants/subdomain/:subdomain`

Provider auth:

- `POST /ehr-service/api/auth/login`
- `GET /ehr-service/api/auth/profile`
- `PUT /ehr-service/api/auth/change-password`
- `POST /ehr-service/api/auth/force-password-change`
- `POST /ehr-service/api/auth/2fa/setup`
- `POST /ehr-service/api/auth/2fa/verify`
- `POST /ehr-service/api/auth/2fa/disable`
- `POST /ehr-service/api/auth/2fa/complete-login`

Patient auth:

- `POST /ehr-service/api/patient-portal/register`
- `POST /ehr-service/api/patient-portal/login`
- `GET /ehr-service/api/patient-portal/profile`
- `PUT /ehr-service/api/patient-portal/profile`
- `POST /ehr-service/api/patient-portal/link-account`

Patient notification shell:

- `GET /ehr-service/api/patient-portal/notifications`
- `PUT /ehr-service/api/patient-portal/notifications/:id/read`
- `PUT /ehr-service/api/patient-portal/notifications/read-all`

## Tenant persistence contract

Persist this object:

```json
{
  "tenantId": "uuid",
  "subdomain": "clinic-a",
  "name": "Clinic A",
  "logoUrl": "https://...",
  "ehrApiBaseUrl": "https://domain/ehr-service/api",
  "tenantApiBaseUrl": "https://domain/tenant-service/api",
  "selectedAt": "2026-03-10T10:00:00.000Z"
}
```

Rules:

- store secrets separately from tenant metadata
- `X-Tenant-ID` comes from stored tenant context
- login/logout must not wipe clinic bootstrap
- cache clear or uninstall is the supported reset path

## UX constraints

- clinic picker must not feel like admin tooling
- search by clinic name and subdomain
- show logo and clinic name before login
- make tenant mismatch errors explicit
- show role-specific copy after login

## Test cases

- first launch with no tenant selected
- tenant persists across app restart
- logout returns to login for same tenant
- invalid tenant subdomain
- provider login success
- provider login requiring password change
- provider login requiring 2FA
- patient login success
- patient profile load success
- offline boot with stored tenant

## Acceptance criteria

- clinic selection occurs once and only once per installed app data lifecycle
- both provider and patient auth flows work
- role shell opens correctly after auth
- notification bell shell exists for all roles
- no URL is hardcoded in screen code
- all runtime URLs resolve from the single base env and stored tenant context

## Definition of done

```bash
npm run test --workspace=mobile-app
npm run lint --workspace=mobile-app
npm run typecheck --workspace=mobile-app
npx expo-doctor
npm run test --workspace=mobile-app
npm run test:e2e --workspace=mobile-app -- tenant-auth
git add .
git commit -m "mobile: sprint 01 tenant auth shell"
```
