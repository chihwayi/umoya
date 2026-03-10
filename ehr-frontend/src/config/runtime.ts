const trim = (value?: string | null): string => String(value || '').trim();

const stripTrailingSlash = (value: string): string => value.replace(/\/+$/, '');

const ensureLeadingSlash = (value?: string | null): string => {
  const normalized = trim(value);
  if (!normalized) return '/';
  return normalized.startsWith('/') ? normalized : `/${normalized}`;
};

const joinUrl = (base: string, path: string): string => `${stripTrailingSlash(base)}${ensureLeadingSlash(path)}`;

const browserOrigin = (): string => {
  if (typeof window === 'undefined' || !window.location?.origin) {
    return '';
  }
  return window.location.origin;
};

const resolveUrl = (explicitValue: string | undefined, inheritedBase: string | undefined, inheritedPath: string): string => {
  const explicit = trim(explicitValue);
  if (explicit) return explicit;

  const base = trim(inheritedBase) || browserOrigin();
  if (!base) return '';

  return joinUrl(base, inheritedPath);
};

export const runtimeUrls = {
  tenantApi: resolveUrl(
    process.env.REACT_APP_TENANT_API_URL || process.env.REACT_APP_API_URL,
    process.env.REACT_APP_API_BASE_URL,
    process.env.REACT_APP_TENANT_API_PATH || '/tenant-service/api',
  ),
  ehrApi: resolveUrl(
    process.env.REACT_APP_EHR_API_URL,
    process.env.REACT_APP_API_BASE_URL,
    process.env.REACT_APP_EHR_API_PATH || '/ehr-service/api',
  ),
  cdssApi: resolveUrl(
    process.env.REACT_APP_CDSS_API_URL,
    process.env.REACT_APP_API_BASE_URL,
    process.env.REACT_APP_CDSS_API_PATH || '/cdss-service',
  ),
};

export const getSocketOriginFromApiUrl = (apiUrl: string): string => {
  const normalized = trim(apiUrl);
  if (!normalized) {
    return browserOrigin();
  }

  try {
    return new URL(normalized, browserOrigin() || undefined).origin;
  } catch {
    return stripTrailingSlash(normalized)
      .replace(/\/api\/?$/i, '')
      .replace(/\/ehr-service$/i, '');
  }
};
