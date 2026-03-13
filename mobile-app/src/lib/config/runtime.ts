const DEFAULT_SERVICE_BASE_URL = 'http://localhost:3000';

export type RuntimeConfig = {
  serviceBaseUrl: string;
  tenantServiceBaseUrl: string;
  ehrServiceBaseUrl: string;
  sessionInactivityTimeoutMs: number;
};

export function normalizeBaseUrl(value: string): string {
  return value.replace(/\/+$/, '');
}

export function getRuntimeConfig(): RuntimeConfig {
  const serviceBaseUrl = normalizeBaseUrl(process.env.EXPO_PUBLIC_SERVICE_BASE_URL || DEFAULT_SERVICE_BASE_URL);
  const inactivityTimeoutMinutes = Number(process.env.EXPO_PUBLIC_SESSION_TIMEOUT_MINUTES || 15);
  const sessionInactivityTimeoutMs =
    Number.isFinite(inactivityTimeoutMinutes) && inactivityTimeoutMinutes > 0
      ? inactivityTimeoutMinutes * 60_000
      : 15 * 60_000;

  return {
    serviceBaseUrl,
    tenantServiceBaseUrl: `${serviceBaseUrl}/tenant-service/api`,
    ehrServiceBaseUrl: `${serviceBaseUrl}/ehr-service/api`,
    sessionInactivityTimeoutMs
  };
}
