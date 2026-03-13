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
