/**
 * MediCore Mobile — Unified Environment Config
 *
 * Only ONE variable changes between environments:
 *   EXPO_PUBLIC_API_BASE=https://api.medicore.app   (production)
 *   EXPO_PUBLIC_API_BASE=https://api-staging.medicore.app  (staging)
 *   EXPO_PUBLIC_API_BASE=http://localhost:3000       (development)
 *
 * Everything else is derived. No other env var needs to change on deployment.
 */

const rawBase = (process.env.EXPO_PUBLIC_API_BASE ?? 'http://localhost:3000').replace(/\/$/, '');

/** Full REST base URL used by the axios client */
export const API_BASE_URL = rawBase;

/** WebSocket base — same host, protocol swapped */
export const WS_BASE_URL = rawBase
  .replace(/^https:\/\//, 'wss://')
  .replace(/^http:\/\//, 'ws://');

/** Tenant discovery (pre-auth, no tenant slug) */
export const TENANT_DISCOVERY_URL = `${API_BASE_URL}/tenants`;
