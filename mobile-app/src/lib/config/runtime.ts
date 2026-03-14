import { NativeModules, Platform } from 'react-native';

const DEFAULT_SERVICE_PORT = '3000';
const DEFAULT_SERVICE_BASE_URL = `http://localhost:${DEFAULT_SERVICE_PORT}`;

export type RuntimeConfig = {
  serviceBaseUrl: string;
  tenantServiceBaseUrl: string;
  ehrServiceBaseUrl: string;
  sessionInactivityTimeoutMs: number;
};

let hasLoggedRuntimeConfig = false;

export function normalizeBaseUrl(value: string): string {
  return value.replace(/\/+$/, '');
}

function readMetroHost(): string | null {
  const scriptURL = (NativeModules as { SourceCode?: { scriptURL?: string } })?.SourceCode?.scriptURL;
  if (!scriptURL) return null;

  try {
    const parsed = new URL(scriptURL);
    return parsed.hostname || null;
  } catch {
    return null;
  }
}

function resolveDefaultServiceBaseUrl(): string {
  const explicit = process.env.EXPO_PUBLIC_SERVICE_BASE_URL;
  if (explicit) return normalizeBaseUrl(explicit);

  // Emulator-first defaults for stable local development without manual env tweaks.
  if (Platform.OS === 'android') {
    return `http://10.0.2.2:${DEFAULT_SERVICE_PORT}`;
  }

  if (Platform.OS === 'ios') {
    return DEFAULT_SERVICE_BASE_URL;
  }

  const metroHost = readMetroHost();
  if (metroHost && metroHost !== 'localhost' && metroHost !== '127.0.0.1') {
    return `http://${metroHost}:${DEFAULT_SERVICE_PORT}`;
  }

  return DEFAULT_SERVICE_BASE_URL;
}

export function getRuntimeConfig(): RuntimeConfig {
  const serviceBaseUrl = resolveDefaultServiceBaseUrl();
  const inactivityTimeoutMinutes = Number(process.env.EXPO_PUBLIC_SESSION_TIMEOUT_MINUTES || 15);
  const sessionInactivityTimeoutMs =
    Number.isFinite(inactivityTimeoutMinutes) && inactivityTimeoutMinutes > 0
      ? inactivityTimeoutMinutes * 60_000
      : 15 * 60_000;

  const config = {
    serviceBaseUrl,
    tenantServiceBaseUrl: `${serviceBaseUrl}/tenant-service/api`,
    ehrServiceBaseUrl: `${serviceBaseUrl}/ehr-service/api`,
    sessionInactivityTimeoutMs
  };

  if (__DEV__ && !hasLoggedRuntimeConfig) {
    hasLoggedRuntimeConfig = true;
    console.info('[mobile-runtime] resolved config', config);
  }

  return config;
}
