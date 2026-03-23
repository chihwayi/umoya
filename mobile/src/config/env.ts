import { Platform } from 'react-native';

/**
 * MediCore Mobile — Unified Environment Config
 *
 * Set EXPO_PUBLIC_API_BASE in the active environment.
 * Everything else is derived from that single value.
 */

const androidEmulatorHost = '10.0.2.2';
const internalDockerHosts = new Set(['ehr-service', 'tenant-service', 'host.docker.internal']);

function ensureUrlProtocol(value: string): string {
  const trimmed = value.trim().replace(/\/$/, '');
  return /^[a-zA-Z][a-zA-Z\d+\-.]*:\/\//.test(trimmed)
    ? trimmed
    : `http://${trimmed}`;
}

function requireEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(
      `${name} is required. Set it in mobile/.env for local development or in your build environment.`
    );
  }
  return value;
}

const rawBase = ensureUrlProtocol(requireEnv('EXPO_PUBLIC_API_BASE'));

function replaceDevLoopbackHost(url: URL): URL {
  if (
    Platform.OS === 'android' &&
    (url.hostname === 'localhost' || url.hostname === '127.0.0.1')
  ) {
    url.hostname = androidEmulatorHost;
  }
  return url;
}

function normalizeUrl(input: string): URL {
  return replaceDevLoopbackHost(new URL(input));
}

export function normalizeRuntimeBaseUrl(input: string): string {
  return normalizeUrl(input).toString().replace(/\/$/, '');
}

export function ensureApiBaseUrl(input: string): string {
  const url = normalizeUrl(input);
  return url.pathname.endsWith('/api')
    ? url.toString().replace(/\/$/, '')
    : `${url.toString().replace(/\/$/, '')}/api`;
}

export function ensurePublicApiBaseUrl(input: string): string {
  const candidate = normalizeUrl(input);
  const discoveryBase = normalizeUrl(rawBase);

  if (internalDockerHosts.has(candidate.hostname)) {
    candidate.protocol = discoveryBase.protocol;
    candidate.hostname = discoveryBase.hostname;
  }

  return ensureApiBaseUrl(candidate.toString());
}

/** Full REST base URL used by the axios client */
export const API_BASE_URL = normalizeRuntimeBaseUrl(rawBase);

/** WebSocket base — same host, protocol swapped */
export const WS_BASE_URL = API_BASE_URL
  .replace(/^https:\/\//, 'wss://')
  .replace(/^http:\/\//, 'ws://');

/** Tenant discovery (pre-auth, no tenant slug) */
export const TENANT_DISCOVERY_URL = `${ensureApiBaseUrl(API_BASE_URL)}/tenants`;
