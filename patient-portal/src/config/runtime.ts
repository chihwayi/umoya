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

const resolveUrl = (): string => {
  const explicit = trim(process.env.REACT_APP_EHR_API_URL);
  if (explicit) return explicit;

  const base = trim(process.env.REACT_APP_API_BASE_URL) || browserOrigin();
  if (!base) return '';

  return joinUrl(base, process.env.REACT_APP_EHR_API_PATH || '/ehr-service/api');
};

export const runtimeUrls = {
  ehrApi: resolveUrl(),
};
