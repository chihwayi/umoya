const DEFAULT_SERVICE_BASE_URL = 'http://localhost:3000';

export type RuntimeConfig = {
  serviceBaseUrl: string;
  tenantServiceBaseUrl: string;
  ehrServiceBaseUrl: string;
};

export function normalizeBaseUrl(value: string): string {
  return value.replace(/\/+$/, '');
}

export function getRuntimeConfig(): RuntimeConfig {
  const serviceBaseUrl = normalizeBaseUrl(process.env.EXPO_PUBLIC_SERVICE_BASE_URL || DEFAULT_SERVICE_BASE_URL);

  return {
    serviceBaseUrl,
    tenantServiceBaseUrl: `${serviceBaseUrl}/tenant-service/api`,
    ehrServiceBaseUrl: `${serviceBaseUrl}/ehr-service/api`
  };
}
