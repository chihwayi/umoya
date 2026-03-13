import * as Network from 'expo-network';

const ONLINE_ONLY_MUTATION_PATHS = [
  '/patient-portal/payments',
  '/patient-portal/appointments/request-with-payment',
  '/telemedicine/consultations/'
] as const;

type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | 'HEAD' | 'OPTIONS';

function normalizeMethod(method?: string): HttpMethod {
  return String(method || 'GET').toUpperCase() as HttpMethod;
}

function normalizePath(url?: string): string {
  const raw = String(url || '').trim();
  if (!raw) return '';

  if (raw.startsWith('http://') || raw.startsWith('https://')) {
    try {
      return new URL(raw).pathname || raw;
    } catch {
      return raw;
    }
  }

  return raw;
}

function isMutationMethod(method: HttpMethod): boolean {
  return method === 'POST' || method === 'PUT' || method === 'PATCH' || method === 'DELETE';
}

function isOnlineOnlyPath(path: string): boolean {
  return ONLINE_ONLY_MUTATION_PATHS.some((entry) => path.includes(entry));
}

export class OnlinePolicyError extends Error {
  readonly code = 'OFFLINE_POLICY_BLOCKED';
  readonly route: string;
  readonly reason: 'mutation' | 'online_only';

  constructor(route: string, reason: 'mutation' | 'online_only') {
    super('This action requires an internet connection.');
    this.name = 'OnlinePolicyError';
    this.route = route;
    this.reason = reason;
  }
}

export function isOnlinePolicyError(error: unknown): error is OnlinePolicyError {
  return Boolean(error) && typeof error === 'object' && (error as { code?: string }).code === 'OFFLINE_POLICY_BLOCKED';
}

export function getOnlinePolicyMessage(error: unknown): string {
  if (isOnlinePolicyError(error)) {
    if (error.reason === 'online_only') {
      return 'This action is online-only. Reconnect to continue.';
    }
    return 'You are offline. Reconnect before submitting updates.';
  }
  return 'Connection issue detected. Please retry once online.';
}

export async function ensureOnlineForPolicy(method?: string, url?: string): Promise<void> {
  const normalizedMethod = normalizeMethod(method);
  if (!isMutationMethod(normalizedMethod)) return;

  const path = normalizePath(url);
  if (!path) return;

  const networkState = await Network.getNetworkStateAsync();
  const isConnected = Boolean(networkState.isConnected);
  const internetReachable = networkState.isInternetReachable !== false;
  if (isConnected && internetReachable) return;

  if (isOnlineOnlyPath(path)) {
    throw new OnlinePolicyError(path, 'online_only');
  }

  throw new OnlinePolicyError(path, 'mutation');
}
