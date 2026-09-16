import { create } from 'zustand';

export type PendingDeepLink =
  | { type: 'intake'; tenantSlug: string; token: string }
  | { type: 'survey'; tenantSlug: string; token: string };

interface DeepLinkState {
  pending: PendingDeepLink | null;
  setPending: (link: PendingDeepLink) => void;
  clear: () => void;
}

/**
 * Pre-visit intake and post-visit satisfaction-survey links are meant to be
 * opened straight from an SMS/email before the recipient has picked a
 * clinic or logged in — the token itself is the credential (see
 * pre-visit-intake.controller.ts / csat.controller.ts). RootNavigator's
 * top level renders an entirely different component tree per auth state
 * (TenantSelectScreen vs LoginScreen vs the role router), so a link can't
 * be resolved via React Navigation's declarative `linking` config alone;
 * this store lets App.tsx's imperative Linking listener hand the parsed
 * link to RootNavigator, which renders the target screen directly ahead
 * of the normal tenant/login gate.
 */
export const useDeepLinkStore = create<DeepLinkState>((set) => ({
  pending: null,
  setPending: (link) => set({ pending: link }),
  clear: () => set({ pending: null }),
}));

/**
 * Matches the links the backend actually sends via SMS/email:
 * `https://<tenantSubdomain>.umoya.app/intake/<token>` and
 * `.../survey/<token>` (see createAndSendForm() in
 * pre-visit-intake.service.ts and csat.service.ts) — the tenant lives in
 * the hostname's leftmost label, not the path. The same shape also works
 * for a custom-scheme `umoya://<tenantSubdomain>.umoya.app/intake/<token>`
 * link, e.g. for QR codes, since the WHATWG URL parser treats both the
 * same way.
 */
export function parseDeepLinkUrl(url: string): PendingDeepLink | null {
  try {
    const parsed = new URL(url);
    const tenantSlug = parsed.hostname.split('.')[0];
    const segments = parsed.pathname.split('/').filter(Boolean);
    const kind = segments[0];
    const token = segments[1];
    if (!tenantSlug || (kind !== 'intake' && kind !== 'survey') || !token) return null;
    return { type: kind, tenantSlug, token };
  } catch {
    return null;
  }
}
