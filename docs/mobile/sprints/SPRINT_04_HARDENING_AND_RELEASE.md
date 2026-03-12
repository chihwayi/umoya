# Sprint 04: Hardening, Offline Rules, Release Readiness, and Mobile Signoff

## Objective

Turn the mobile app from feature-complete into release-ready.

This sprint closes the quality and operational gaps that usually break healthcare apps after pilot deployment.

## Duration

1 sprint

## Release-hardening themes

### Offline and sync boundaries

Define exactly what may work offline:

- cached tenant bootstrap
- cached auth session metadata only if secure re-entry rules allow it
- recently viewed patient-safe screens
- draft provider notes or drafts for forms only if encrypted and explicitly marked unsynced
- medication reminder schedules

Do not allow offline mutation for risky workflows without a clear conflict policy.

Examples:

- provider acknowledgement of critical items should be online-only unless an offline queue with conflict resolution is implemented
- bill payment should be online-only
- telemedicine should be online-only

### Security and device rules

Required:

- biometric unlock for returning sessions where supported
- secure token storage
- screenshot policy decision for PHI screens
- app inactivity timeout
- forced logout on token invalidation
- device token revoke on logout

### Performance

Targets:

- cold start under 3 seconds on a representative mid-range Android device
- primary list screens render without blocking spinners for more than 1 second on warm cache
- inbox and notification counts preload in background

### Observability

Track mobile-specific metrics:

- login success and failure by tenant
- tenant bootstrap completion rate
- push delivery/open rate
- medication reminder open rate
- escalation notification acknowledge latency
- crash-free sessions
- API error rate by screen

### Design conformance

Design conformance must be verified against `docs/mobile/design/medicore-mobile-v3.jsx` and `docs/mobile/design/v3 update description`.

Required checks:

- token usage only from mobile design tokens (no hardcoded random colors in feature screens)
- readable text contrast on dark surfaces for all cards, labels, badges, and form controls
- urgency visuals (critical, warning, routine) are visually distinct and pass accessibility checks
- role tabs and notification badges match the approved V3 interaction patterns
- all loading, empty, and error states preserve the same visual language

## Backend work required

If still missing after previous sprints, finish these here:

- push device token registration and revoke
- mobile notification preference endpoints
- minimum supported version endpoint
- provider mobile dashboard aggregate endpoint if still needed
- patient-safe payment status endpoint if bill payload is insufficient

Non-negotiable backend governance:

- if any new mobile backend feature requires schema changes, ship:
  - migration script
  - tenant provisioning update script
  - tenant repair script/path for pre-existing tenants

## End-to-end release checklist

### Provider E2E flows

- tenant boot -> provider login -> 2FA -> doctor home
- doctor escalation open -> acknowledge -> resolve
- nurse escalation send -> doctor sees push -> doctor acts
- secure message send and read
- HIV queue -> open patient -> action completes
- telemedicine consultation join
- post-visit draft review -> publish -> patient companion visibility update
- cross-module nurse recommendation execution reflected in doctor sync feed

### Patient E2E flows

- tenant boot -> patient login
- view dashboard summary
- open post-visit summary -> send companion question
- reminder fires -> mark medication taken
- request refill
- open bill -> pay
- open notification -> deep-link succeeds
- complete questionnaire and observe pending count decrease
- sign or decline a consent and verify status update
- open admission/ED status and confirm safe no-data behavior

### Negative flows

- expired token
- missing tenant header
- no network at launch with stored tenant
- no network during payment
- push permission denied
- unsupported payment method

## Evidence package

Release signoff requires an auditable evidence package with:

- doctor, nurse, and patient smoke test transcripts
- screenshots or short recordings for each main role flow
- API contract check logs for critical routes
- AI/CDSS behavior checks confirming advisory-only behavior and audit traces
- offline/reconnect test outputs for supported offline screens

## App store readiness

- icons and splash aligned to MediCore brand
- privacy policy and PHI disclosures ready
- notification permission copy reviewed
- iOS and Android build profiles defined
- crash reporting enabled
- support contact surfaced in-app

## Signoff criteria

The mobile app is ready only when:

- all planned sprint scope is delivered
- provider and patient E2E flows are green
- no P0 or P1 mobile bugs remain
- no hardcoded URLs remain in mobile runtime code
- tenant selection behaves exactly once per installed app data lifecycle
- push notifications work for provider critical items and patient reminders
- all build, lint, type, unit, and E2E gates are green
- design conformance checks are green for all role shells
- evidence package is stored under `reports/mobile/` for review

## Definition of done

```bash
npm run test --workspace=mobile-app
npm run lint --workspace=mobile-app
npm run typecheck --workspace=mobile-app
npx expo-doctor
npm run test --workspace=mobile-app
npm run test:e2e --workspace=mobile-app
git add .
git commit -m "mobile: sprint 04 release hardening"
```
