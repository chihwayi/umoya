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

## Backend work required

If still missing after previous sprints, finish these here:

- push device token registration and revoke
- mobile notification preference endpoints
- minimum supported version endpoint
- provider mobile dashboard aggregate endpoint if still needed
- patient-safe payment status endpoint if bill payload is insufficient

## End-to-end release checklist

### Provider E2E flows

- tenant boot -> provider login -> 2FA -> doctor home
- doctor escalation open -> acknowledge -> resolve
- nurse escalation send -> doctor sees push -> doctor acts
- secure message send and read
- HIV queue -> open patient -> action completes
- telemedicine consultation join

### Patient E2E flows

- tenant boot -> patient login
- view dashboard summary
- open post-visit summary -> send companion question
- reminder fires -> mark medication taken
- request refill
- open bill -> pay
- open notification -> deep-link succeeds

### Negative flows

- expired token
- missing tenant header
- no network at launch with stored tenant
- no network during payment
- push permission denied
- unsupported payment method

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
