import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { v4 as uuidv4 } from 'uuid';

/**
 * Consumes a super-admin impersonation token and establishes a tenant staff
 * session, then routes to the role dashboard.
 *
 * The token arrives in the URL *fragment* (#token=...) — fragments are never
 * sent to servers (no access logs / referrer leakage). It is short-lived
 * (15 min) and carries an `impersonation` claim; an on-screen banner flag is
 * stored so the EHR shows the session is an admin impersonation.
 */
const roleRoute = (slug: string, role: string): string => {
  switch (role) {
    case 'doctor': return `/ehr/${slug}/doctor`;
    case 'radiologist': return `/ehr/${slug}/radiologist`;
    case 'lab_tech':
    case 'lab_technician': return `/ehr/${slug}/lab`;
    case 'nurse':
    case 'nurse_accounts': return `/ehr/${slug}/nurse`;
    default: return `/ehr/${slug}/dashboard`;
  }
};

const ImpersonationLanding: React.FC = () => {
  const { tenantSlug } = useParams<{ tenantSlug: string }>();
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!tenantSlug) { setError('Missing tenant'); return; }
    try {
      // Token is in the URL fragment: #token=...
      const frag = window.location.hash.replace(/^#/, '');
      const params = new URLSearchParams(frag);
      const token = params.get('token');
      if (!token) { setError('No impersonation token provided'); return; }

      const payload = JSON.parse(atob(token.split('.')[1]));
      if (payload.exp && payload.exp < Date.now() / 1000) {
        setError('This impersonation link has expired. Generate a new one from the admin panel.');
        return;
      }

      const user = {
        id: payload.sub,
        email: payload.email,
        role: payload.role,
        firstName: payload.firstName,
        lastName: payload.lastName,
        tenantId: payload.tenantId,
        sessionTimeoutMinutes: payload.sessionTimeoutMinutes || 15,
      };

      localStorage.setItem('ehr_token', token);
      localStorage.setItem('ehr_user', JSON.stringify(user));
      localStorage.setItem('ehr_tenant', tenantSlug);
      localStorage.setItem('ehr_tenant_slug', tenantSlug);
      localStorage.setItem('ehr_session_timeout_minutes', String(user.sessionTimeoutMinutes));
      localStorage.setItem('ehr_session_id', uuidv4());
      // Flag so the workspace can show an "impersonation" banner.
      localStorage.setItem('ehr_impersonation', JSON.stringify({
        active: true,
        by: payload.impersonatorEmail || payload.impersonatedBy || 'super-admin',
        at: new Date().toISOString(),
      }));

      // Strip the token from the URL before navigating away.
      window.history.replaceState({}, '', window.location.pathname);
      navigate(roleRoute(tenantSlug, user.role), { replace: true });
    } catch (e) {
      setError('Invalid impersonation token');
    }
  }, [tenantSlug, navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#080E1A] text-[#E8F0FF] px-4">
      <div className="text-center max-w-md">
        {error ? (
          <>
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-rose-500/15 border border-rose-500/30">
              <svg className="h-7 w-7 text-rose-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v2m0 4h.01M12 3l9 16H3L12 3z" />
              </svg>
            </div>
            <p className="text-sm font-semibold text-rose-300">{error}</p>
          </>
        ) : (
          <>
            <div className="relative mx-auto mb-4 h-12 w-12">
              <div className="absolute inset-0 animate-spin rounded-full border-2 border-transparent border-t-[#0AA98A]" />
            </div>
            <p className="text-sm text-[#7A92B8]">Establishing impersonation session…</p>
          </>
        )}
      </div>
    </div>
  );
};

export default ImpersonationLanding;
