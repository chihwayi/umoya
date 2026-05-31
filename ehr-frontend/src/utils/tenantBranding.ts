export interface TenantBranding {
  clinicName?: string;
  logoUrl?: string;
  primaryColor?: string;
}

const HEX_RE = /^#[0-9a-fA-F]{6}$/;

/** Lighten a hex colour by `amt` (0-1) for a derived hover shade. */
const lighten = (hex: string, amt = 0.15): string => {
  if (!HEX_RE.test(hex)) return hex;
  const n = parseInt(hex.slice(1), 16);
  const r = Math.min(255, Math.round(((n >> 16) & 255) + 255 * amt));
  const g = Math.min(255, Math.round(((n >> 8) & 255) + 255 * amt));
  const b = Math.min(255, Math.round((n & 255) + 255 * amt));
  return `#${((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1)}`;
};

/** Apply the tenant brand colour as the EHR theme accent (validated hex only). */
export const applyTenantTheme = (primaryColor?: string | null): void => {
  if (typeof document === 'undefined') return;
  const body = document.body;
  if (primaryColor && HEX_RE.test(primaryColor)) {
    body.style.setProperty('--ehr-accent', primaryColor);
    body.style.setProperty('--ehr-accent-hover', lighten(primaryColor));
  } else {
    body.style.removeProperty('--ehr-accent');
    body.style.removeProperty('--ehr-accent-hover');
  }
};

export const clearTenantTheme = (): void => {
  if (typeof document === 'undefined') return;
  document.body.style.removeProperty('--ehr-accent');
  document.body.style.removeProperty('--ehr-accent-hover');
};

const TENANT_NAME_KEY = 'ehr_tenant_name';
const tenantBrandKey = (tenantSlug: string) => `ehr_tenant_brand:${tenantSlug}`;

const isBrowser = () => typeof window !== 'undefined';

export const formatTenantDisplayName = (tenantSlug?: string | null, clinicName?: string | null): string => {
  const cleanClinicName = clinicName?.trim();
  if (cleanClinicName) return cleanClinicName;

  const cleanSlug = tenantSlug?.trim();
  if (!cleanSlug) return 'Clinic Workspace';

  return cleanSlug
    .split('-')
    .filter(Boolean)
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(' ');
};

export const getBrandInitials = (displayName?: string | null): string => {
  const cleanName = displayName?.trim();
  if (!cleanName) return 'MC';

  const parts = cleanName.split(/\s+/).filter(Boolean);
  if (parts.length === 0) return 'MC';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();

  return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
};

export const readCachedTenantBranding = (tenantSlug?: string | null): TenantBranding | null => {
  if (!isBrowser()) return null;
  if (!tenantSlug) {
    const fallbackName = localStorage.getItem(TENANT_NAME_KEY);
    return fallbackName ? { clinicName: fallbackName } : null;
  }

  try {
    const raw = localStorage.getItem(tenantBrandKey(tenantSlug));
    if (raw) {
      const parsed = JSON.parse(raw) as TenantBranding;
      return {
        clinicName: parsed?.clinicName || undefined,
        logoUrl: parsed?.logoUrl || undefined,
        primaryColor: parsed?.primaryColor || undefined,
      };
    }
  } catch {}

  return null;
};

export const cacheTenantBranding = (tenantSlug: string, branding: TenantBranding): void => {
  if (!isBrowser() || !tenantSlug) return;

  const payload: TenantBranding = {
    clinicName: branding.clinicName?.trim() || undefined,
    logoUrl: branding.logoUrl?.trim() || undefined,
    primaryColor: branding.primaryColor?.trim() || undefined,
  };

  try {
    localStorage.setItem(tenantBrandKey(tenantSlug), JSON.stringify(payload));
    if (payload.clinicName) {
      localStorage.setItem(TENANT_NAME_KEY, payload.clinicName);
    }
  } catch {}
};
