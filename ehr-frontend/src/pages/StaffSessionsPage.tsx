import React, { useCallback, useEffect, useState } from 'react';
import { ArrowLeft, RefreshCw, ShieldOff } from 'lucide-react';
import { useNavigate, useParams } from 'react-router-dom';
import { ehrApi } from '../services/api';
import { useNotification } from '../components/GlobalNotification';

interface StaffSession {
  jwt_jti: string;
  ip_address?: string | null;
  mfa_verified: boolean;
  created_at: string;
  last_activity: string;
  expires_at: string;
  revoked: boolean;
}

const StaffSessionsPage: React.FC = () => {
  const { tenantSlug } = useParams<{ tenantSlug: string }>();
  const navigate = useNavigate();
  const { showError, showSuccess } = useNotification();
  const [sessions, setSessions] = useState<StaffSession[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const token = localStorage.getItem('ehr_token') || '';
    if (!tenantSlug || !token) return;
    try {
      setLoading(true);
      const response = await ehrApi.getStaffSessions(token, tenantSlug);
      setSessions(response.data || []);
    } catch (err: any) {
      showError('Unable to load sessions', err?.response?.data?.message || 'Please try again.');
    } finally {
      setLoading(false);
    }
  }, [showError, tenantSlug]);

  useEffect(() => {
    load();
  }, [load]);

  const revoke = async (jti: string) => {
    const token = localStorage.getItem('ehr_token') || '';
    if (!tenantSlug || !token) return;
    try {
      await ehrApi.revokeStaffSession(token, tenantSlug, jti);
      showSuccess('Session revoked', 'The selected session was revoked.');
      load();
    } catch (err: any) {
      showError('Revoke failed', err?.response?.data?.message || 'Please try again.');
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 p-4 text-slate-900 md:p-6">
      <div className="mx-auto max-w-6xl space-y-5">
        <header className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={() => navigate(`/ehr/${tenantSlug}/dashboard`)} className="rounded-lg border border-slate-200 bg-white p-2 text-slate-600 shadow-sm" title="Back">
              <ArrowLeft className="h-5 w-5" />
            </button>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Security</p>
              <h1 className="text-2xl font-bold text-slate-950">Active Sessions</h1>
            </div>
          </div>
          <button onClick={load} className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm">
            <RefreshCw className="h-4 w-4" /> Refresh
          </button>
        </header>

        <section className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
          {loading ? (
            <div className="p-8 text-sm text-slate-500">Loading sessions...</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-100 text-sm">
                <thead className="bg-slate-50 text-left text-xs uppercase tracking-[0.12em] text-slate-500">
                  <tr>
                    {['Created', 'Last activity', 'Expires', 'MFA', 'IP address', 'Status', ''].map((head) => (
                      <th key={head} className="px-4 py-3 font-semibold">{head}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {sessions.map((session) => (
                    <tr key={session.jwt_jti}>
                      <td className="px-4 py-3">{new Date(session.created_at).toLocaleString()}</td>
                      <td className="px-4 py-3">{new Date(session.last_activity).toLocaleString()}</td>
                      <td className="px-4 py-3">{new Date(session.expires_at).toLocaleString()}</td>
                      <td className="px-4 py-3">{session.mfa_verified ? 'Verified' : 'Pending'}</td>
                      <td className="px-4 py-3">{session.ip_address || '-'}</td>
                      <td className="px-4 py-3">{session.revoked ? 'Revoked' : 'Active'}</td>
                      <td className="px-4 py-3 text-right">
                        {!session.revoked && (
                          <button onClick={() => revoke(session.jwt_jti)} className="inline-flex items-center gap-2 rounded-lg bg-rose-600 px-3 py-2 text-xs font-bold text-white">
                            <ShieldOff className="h-4 w-4" /> Revoke
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </div>
  );
};

export default StaffSessionsPage;
