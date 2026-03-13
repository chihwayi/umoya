# Sprint 05 Known Issues (2026-03-13)

1. iOS preview build is blocked by Apple account team membership.
- Impact: both non-interactive and interactive credential setup cannot complete iOS preview build.
- Evidence: Apple login + 2FA succeeded, then EAS returned: "You have no team associated with your Apple account."
- Mitigation: enroll the Apple ID into a paid Apple Developer Program team (or use a team-linked Apple ID), then rerun `eas build -p ios --profile preview`.

2. EAS preview/production env variables now configured, but DSN is placeholder.
- Impact: crash events route may be invalid until real DSN value is set.
- Mitigation: replace `EXPO_PUBLIC_SENTRY_DSN` placeholder with actual Sentry DSN for preview/production.

3. Sentry Expo plugin shows warning when org/project env is not set locally.
- Impact: non-blocking warning in local doctor/config output.
- Mitigation: provide `EXPO_PUBLIC_SENTRY_ORG` and `EXPO_PUBLIC_SENTRY_PROJECT` in EAS/local env for clean setup.
