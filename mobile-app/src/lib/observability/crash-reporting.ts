import * as Sentry from '@sentry/react-native';

type CrashContext = {
  role?: string;
  tenant?: string;
  route?: string;
};

const SAFE_KEYS = new Set([
  'event',
  'screen',
  'route',
  'status',
  'method',
  'code',
  'reason',
  'role',
  'tenant',
  'online',
  'channel',
  'environment'
]);

let crashReportingEnabled = false;
let initialized = false;

function sanitizePrimitive(value: unknown): string | number | boolean {
  if (typeof value === 'string') {
    return value.slice(0, 160);
  }
  if (typeof value === 'number' || typeof value === 'boolean') {
    return value;
  }
  return String(value).slice(0, 160);
}

function sanitizePayload(payload?: Record<string, unknown>): Record<string, string | number | boolean> {
  if (!payload) return {};
  const safe: Record<string, string | number | boolean> = {};

  for (const [key, value] of Object.entries(payload)) {
    if (!SAFE_KEYS.has(key)) continue;
    if (value == null) continue;
    safe[key] = sanitizePrimitive(value);
  }

  return safe;
}

function normalizeRoute(url: string): string {
  const route = url.split('?')[0] || '';
  return route.replace(/[0-9a-f]{8,}/gi, ':id').slice(0, 160);
}

export function initCrashReporting(): void {
  if (initialized) return;
  initialized = true;

  const dsn = process.env.EXPO_PUBLIC_SENTRY_DSN;
  if (!dsn) {
    crashReportingEnabled = false;
    console.info('[mobile-crash] disabled (missing EXPO_PUBLIC_SENTRY_DSN)');
    return;
  }

  const environment = process.env.EXPO_PUBLIC_RELEASE_ENV || (__DEV__ ? 'development' : 'production');
  const channel = process.env.EXPO_PUBLIC_RELEASE_CHANNEL || environment;
  const tracesSampleRate = Number(process.env.EXPO_PUBLIC_SENTRY_TRACE_RATE || '0.1');

  Sentry.init({
    dsn,
    enabled: true,
    environment,
    tracesSampleRate: Number.isFinite(tracesSampleRate) ? tracesSampleRate : 0.1,
    beforeSend(event) {
      // Explicitly remove user/request fields to avoid PHI leakage.
      event.user = undefined;
      event.request = undefined;
      event.contexts = undefined;
      if (event.extra && typeof event.extra === 'object') {
        event.extra = sanitizePayload(event.extra as Record<string, unknown>);
      }
      if (Array.isArray(event.breadcrumbs)) {
        event.breadcrumbs = event.breadcrumbs.map((item) => ({
          ...item,
          data: sanitizePayload((item.data || {}) as Record<string, unknown>)
        }));
      }
      return event;
    },
    initialScope: {
      tags: {
        channel
      }
    }
  });

  crashReportingEnabled = true;
  console.info('[mobile-crash] enabled', { environment, channel });
}

export function setCrashContext(context: CrashContext): void {
  if (!crashReportingEnabled) return;

  if (context.role) Sentry.setTag('role', context.role);
  if (context.tenant) Sentry.setTag('tenant', context.tenant);
  if (context.route) Sentry.setTag('route', context.route);
}

export function addCrashBreadcrumb(event: string, payload?: Record<string, unknown>): void {
  if (!crashReportingEnabled) return;
  Sentry.addBreadcrumb({
    category: 'mobile-event',
    level: 'info',
    message: event,
    data: sanitizePayload(payload)
  });
}

export function captureCrashException(error: unknown, payload?: Record<string, unknown>): void {
  if (!crashReportingEnabled) return;
  Sentry.withScope((scope) => {
    scope.setExtras(sanitizePayload(payload));
    Sentry.captureException(error);
  });
}

export function captureApiFailure(payload: { method: string; url: string; status: number; code?: string }): void {
  if (!crashReportingEnabled) return;

  const safe = sanitizePayload({
    event: 'api.failure',
    method: payload.method,
    route: normalizeRoute(payload.url),
    status: payload.status,
    code: payload.code || 'unknown'
  });

  Sentry.withScope((scope) => {
    scope.setLevel('warning');
    scope.setExtras(safe);
    Sentry.captureMessage('Mobile API failure');
  });
}
