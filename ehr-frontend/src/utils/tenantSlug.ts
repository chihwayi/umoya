/**
 * Resolve the active tenant slug consistently across the EHR app.
 *
 * Historically some components read only `localStorage['ehr_tenant_slug']` and
 * silently no-op'd when it was absent (e.g. impersonation / deep-link entry
 * points that only populate the URL). That made nurse-worklist persistence
 * (start/complete/acknowledge) fail invisibly. This resolver mirrors the
 * fallback chain used elsewhere: explicit storage keys, then the `/ehr/:slug`
 * path segment.
 */
export function resolveTenantSlug(): string {
  const fromStorage =
    localStorage.getItem('ehr_tenant_slug') || localStorage.getItem('ehr_tenant');
  if (fromStorage) return fromStorage;

  const match =
    typeof window !== 'undefined'
      ? window.location.pathname.match(/\/ehr\/([^/]+)/)
      : null;
  return match ? decodeURIComponent(match[1]) : '';
}
