import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Users, CheckCircle, XCircle, AlertTriangle, ArrowLeft } from 'lucide-react';
import { ncidApi } from '../services/api';
import { useNotification } from '../components/GlobalNotification';

const NcidDeduplicationPage: React.FC = () => {
  const { tenantSlug } = useParams<{ tenantSlug: string }>();
  const navigate = useNavigate();
  const { showError } = useNotification();
  const [flags, setFlags] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const token = typeof window !== 'undefined' ? localStorage.getItem('ehr_token') || '' : '';
  const resolvedBy =
    typeof window !== 'undefined'
      ? JSON.parse(localStorage.getItem('ehr_user') || '{}')?.id || ''
      : '';

  const load = useCallback(async () => {
    if (!tenantSlug || !token) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const res = await ncidApi.getPendingDuplicates(tenantSlug, token);
      const list = res.data;
      setFlags(Array.isArray(list) ? list : []);
    } catch {
      showError('NCID', 'Failed to load duplicate flags');
      setFlags([]);
    } finally {
      setLoading(false);
    }
  }, [showError, tenantSlug, token]);

  useEffect(() => {
    void load();
  }, [load]);

  const resolve = async (
    flagId: string,
    status: 'confirmed_duplicate' | 'confirmed_different' | 'merged' | 'dismissed',
  ) => {
    if (!tenantSlug || !token) return;
    if (!resolvedBy) {
      showError('NCID', 'Missing user id — log in again');
      return;
    }
    try {
      await ncidApi.resolveDuplicate(tenantSlug, token, flagId, {
        status,
        resolvedBy,
      });
      await load();
    } catch {
      showError('NCID', 'Could not resolve duplicate flag');
    }
  };

  const scoreOf = (flag: any) => {
    const n = Number(flag.matchScore);
    return Number.isFinite(n) ? n : 0;
  };

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <button
        type="button"
        onClick={() => navigate(tenantSlug ? `/ehr/${tenantSlug}/dashboard` : '/')}
        className="flex items-center gap-2 text-slate-600 hover:text-slate-900 mb-4 text-sm"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to dashboard
      </button>

      <div className="flex items-center gap-3 mb-6">
        <Users className="w-7 h-7 text-emerald-600" />
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Patient Deduplication</h1>
          <p className="text-sm text-slate-500">Review and resolve potential duplicate patient records</p>
        </div>
      </div>

      {loading && <p className="text-slate-500">Loading...</p>}

      {!loading && flags.length === 0 && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-6 text-center">
          <CheckCircle className="w-10 h-10 text-emerald-500 mx-auto mb-2" />
          <p className="text-emerald-900 font-medium">No pending duplicate flags</p>
        </div>
      )}

      <div className="space-y-4">
        {!loading &&
          flags.map(flag => (
            <div
              key={flag.id}
              className="bg-white/90 backdrop-blur-sm border border-slate-200 rounded-2xl p-4 shadow-sm"
            >
              <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <AlertTriangle
                      className={`w-5 h-5 shrink-0 ${scoreOf(flag) >= 0.85 ? 'text-red-500' : 'text-amber-500'}`}
                    />
                    <span className="font-semibold text-slate-800">
                      Match Score: {(scoreOf(flag) * 100).toFixed(0)}%
                    </span>
                    <span
                      className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                        flag.cdssRecommendation === 'merge'
                          ? 'bg-red-100 text-red-800'
                          : flag.cdssRecommendation === 'manual_review'
                            ? 'bg-amber-100 text-amber-800'
                            : 'bg-slate-100 text-slate-700'
                      }`}
                    >
                      CDSS: {flag.cdssRecommendation ?? '—'}
                    </span>
                  </div>
                  <p className="text-sm text-slate-500 mt-1">
                    Patient A:{' '}
                    <code className="bg-slate-100 px-1 rounded text-xs">{flag.patientIdA?.slice(0, 8)}...</code>
                    {' vs '}
                    Patient B:{' '}
                    <code className="bg-slate-100 px-1 rounded text-xs">{flag.patientIdB?.slice(0, 8)}...</code>
                  </p>
                  <p className="text-xs text-slate-400 mt-1">
                    Matched on:{' '}
                    {(Array.isArray(flag.matchFields) ? flag.matchFields : [])
                      .map((x: unknown) => (typeof x === 'string' ? x : JSON.stringify(x)))
                      .join(', ')}
                  </p>
                  {flag.cdssReasoning && (
                    <p className="text-sm text-slate-600 mt-2 italic">{flag.cdssReasoning}</p>
                  )}
                </div>
                <div className="flex flex-wrap gap-2 sm:ml-4 sm:justify-end">
                  <button
                    type="button"
                    onClick={() => void resolve(flag.id, 'confirmed_duplicate')}
                    className="flex items-center gap-1 bg-red-600 text-white text-xs px-3 py-1.5 rounded-lg hover:bg-red-700"
                  >
                    <XCircle className="w-3 h-3" /> Duplicate
                  </button>
                  <button
                    type="button"
                    onClick={() => void resolve(flag.id, 'confirmed_different')}
                    className="flex items-center gap-1 bg-emerald-600 text-white text-xs px-3 py-1.5 rounded-lg hover:bg-emerald-700"
                  >
                    <CheckCircle className="w-3 h-3" /> Different
                  </button>
                  <button
                    type="button"
                    onClick={() => void resolve(flag.id, 'dismissed')}
                    className="text-xs text-slate-600 px-2 py-1.5 border border-slate-200 rounded-lg hover:bg-slate-50"
                  >
                    Dismiss
                  </button>
                </div>
              </div>
            </div>
          ))}
      </div>
    </div>
  );
};

export default NcidDeduplicationPage;
