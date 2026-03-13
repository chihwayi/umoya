# Sprint 05 Known Issues (2026-03-13)

1. iOS preview CI build cannot run fully non-interactive until internal distribution credentials are provisioned in EAS.
- Impact: iOS preview build submission from CI-mode command fails.
- Mitigation: run one-time interactive credential setup (`eas build -p ios --profile preview`) and store credentials in Expo.

2. EAS dashboard env variables are not yet configured for preview/production secrets.
- Impact: beta strict readiness check would fail in strict mode.
- Mitigation: set `EXPO_PUBLIC_SENTRY_DSN`, `EXPO_PUBLIC_SUPPORT_EMAIL`, `EXPO_PUBLIC_SUPPORT_PHONE`, and release env/channel values in EAS env.

3. Sentry Expo plugin shows warning when org/project env is not set locally.
- Impact: non-blocking warning in local doctor/config output.
- Mitigation: provide `EXPO_PUBLIC_SENTRY_ORG` and `EXPO_PUBLIC_SENTRY_PROJECT` in EAS/local env for clean setup.
