# MediCore Mobile App (Sprint 00 Foundation)

## Smart folder arrangement

- `src/app/`: Expo Router route tree only
- `src/features/provider/`: doctor+nurse feature modules (Sprint 02)
- `src/features/patient/`: patient feature modules (Sprint 03)
- `src/features/shared/`: shared UI and providers
- `src/design/`: design tokens + theme primitives
- `src/lib/config/`: runtime env and service URL derivation
- `src/lib/tenant/`: tenant bootstrap storage/resolution
- `src/lib/auth/`: secure auth/session management
- `src/lib/notifications/`: push/local notification lifecycle
- `src/services/api/`: all HTTP clients and endpoint wrappers
- `src/store/`: Zustand workflow stores
- `src/test/`: unit/integration tests

## Contract guardrails

- No screen may call `fetch`/`axios` directly.
- All tenant-scoped requests must include `X-Tenant-ID`.
- All sensitive tokens stay in SecureStore.
- All non-secret local state may use MMKV.

## Sprint 05 build profiles and release versioning

- EAS profiles are defined in `eas.json`:
  - `development`: internal dev client
  - `preview`: internal beta build track
  - `production`: store release track
- Versioning strategy:
  - app semantic version comes from `mobile-app/package.json` by default
  - optional override via `MEDICORE_APP_VERSION`
  - iOS build number via `MEDICORE_IOS_BUILD_NUMBER` (integer string)
  - Android version code via `MEDICORE_ANDROID_VERSION_CODE` (integer)
- Validate release inputs before build:

```bash
npm run release:check
```

- Preview build commands:

```bash
npm run build:android:preview
npm run build:ios:preview
```

## Sprint 05 crash reporting baseline

- Dependency: `@sentry/react-native`
- Runtime env keys:
  - `EXPO_PUBLIC_SENTRY_DSN`
  - `EXPO_PUBLIC_RELEASE_CHANNEL`
  - `EXPO_PUBLIC_RELEASE_ENV`
  - `EXPO_PUBLIC_SENTRY_TRACE_RATE`
- Crash reporting initializes in root layout and only sends sanitized metadata (no PHI payloads).

## Branding baseline

- App icon and splash icon come from MediCore branding assets under `mobile-app/assets/`.
- Tenant logo slot is available in auth screens and role top bars (falls back to MediCore logo when tenant logo is missing).
