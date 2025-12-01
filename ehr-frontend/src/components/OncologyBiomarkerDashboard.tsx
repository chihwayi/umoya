import React, { useCallback, useEffect, useState } from 'react';
import { Dna, Target, Pill, Sparkles } from 'lucide-react';
import { ehrApi } from '../services/api';
import { useNotification } from './GlobalNotification';

type OncologyBiomarkerDashboardProps = {
  tenantSlug: string;
  token: string;
  caseId: string;
};

const OncologyBiomarkerDashboard: React.FC<OncologyBiomarkerDashboardProps> = ({ tenantSlug, token, caseId }) => {
  const { showError } = useNotification();
  const [analytics, setAnalytics] = useState<any>(null);
  const [genomicSummary, setGenomicSummary] = useState<any[]>([]);
  const [therapies, setTherapies] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const loadBiomarkers = useCallback(async () => {
    setLoading(true);
    try {
      const [analyticsResp, genomicResp, therapiesResp] = await Promise.all([
        ehrApi.getOncologyBiomarkerAnalytics(tenantSlug, token, { caseId }),
        ehrApi.getOncologyGenomicSummary(tenantSlug, token, caseId),
        ehrApi.getOncologyTargetedTherapies(tenantSlug, token, caseId),
      ]);
      setAnalytics(analyticsResp.data);
      setGenomicSummary(Array.isArray(genomicResp.data) ? genomicResp.data : []);
      setTherapies(Array.isArray(therapiesResp.data) ? therapiesResp.data : []);
    } catch (error) {
      console.error('Failed to load biomarker analytics', error);
      showError('Unable to load biomarker dashboard', 'Please retry shortly.');
    } finally {
      setLoading(false);
    }
  }, [caseId, showError, tenantSlug, token]);

  useEffect(() => {
    loadBiomarkers();
  }, [loadBiomarkers]);

  return (
    <div className="rounded-3xl border border-slate-200 bg-white shadow-sm">
      <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
        <div>
          <p className="text-base font-semibold text-slate-900 flex items-center gap-2">
            <Dna className="h-4 w-4 text-fuchsia-500" />
            Biomarker Intelligence
          </p>
          <p className="text-xs text-slate-500">Top biomarkers, genomic signals, and therapy matches.</p>
        </div>
        <button
          onClick={loadBiomarkers}
          disabled={loading}
          className="rounded-full border border-slate-200 px-3 py-1 text-xs text-slate-600 hover:bg-slate-50 disabled:opacity-50"
        >
          {loading ? 'Refreshing…' : 'Refresh'}
        </button>
      </div>

      <div className="p-4 grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="rounded-2xl border border-slate-100 bg-gradient-to-br from-fuchsia-50 to-white p-4">
          <p className="text-xs uppercase text-slate-500 flex items-center gap-1">
            <Target className="h-3 w-3 text-fuchsia-500" />
            Top Biomarkers
          </p>
          <div className="mt-3 space-y-2 text-sm text-slate-700">
            {analytics?.topBiomarkers?.length ? (
              analytics.topBiomarkers.map((item: any) => (
                <div key={item.marker} className="flex items-center justify-between">
                  <span>{item.marker}</span>
                  <span className="font-semibold">{item.count}</span>
                </div>
              ))
            ) : (
              <p className="text-slate-400 text-sm">No biomarkers captured yet.</p>
            )}
          </div>
        </div>

        <div className="rounded-2xl border border-slate-100 bg-gradient-to-br from-blue-50 to-white p-4">
          <p className="text-xs uppercase text-slate-500 flex items-center gap-1">
            <Sparkles className="h-3 w-3 text-blue-500" />
            Genomic Signals
          </p>
          <div className="mt-3 space-y-2 text-sm text-slate-700">
            {analytics?.genomicSignals?.length ? (
              analytics.genomicSignals.map((item: any) => (
                <div key={item.marker} className="flex items-center justify-between">
                  <span>{item.marker}</span>
                  <span className="font-semibold">{item.count}</span>
                </div>
              ))
            ) : (
              <p className="text-slate-400 text-sm">No genomic data recorded.</p>
            )}
          </div>
        </div>

        <div className="rounded-2xl border border-slate-100 bg-gradient-to-br from-emerald-50 to-white p-4">
          <p className="text-xs uppercase text-slate-500 flex items-center gap-1">
            <Pill className="h-3 w-3 text-emerald-500" />
            Matched Therapies
          </p>
          <div className="mt-3 space-y-2 text-sm text-slate-700">
            {therapies.length ? (
              therapies.map((therapy, index) => (
                <div key={`${therapy.therapy}-${index}`} className="border border-emerald-100 rounded-xl p-2 bg-white/70">
                  <p className="font-semibold text-emerald-700">{therapy.therapy}</p>
                  <p className="text-xs text-slate-500">{therapy.rationale}</p>
                </div>
              ))
            ) : (
              <p className="text-slate-400 text-sm">No targeted therapy suggestions yet.</p>
            )}
          </div>
        </div>
      </div>

      <div className="px-4 pb-4">
        <p className="text-xs uppercase text-slate-500 mb-2">Latest genomic entries</p>
        <div className="space-y-2">
          {genomicSummary.length ? (
            genomicSummary.slice(0, 3).map((entry) => (
              <div key={entry.id} className="rounded-2xl border border-slate-100 bg-slate-50 px-3 py-2 text-sm text-slate-700">
                <p className="font-semibold text-slate-900">{entry.histology_type ?? 'Pathology entry'}</p>
                <p className="text-xs text-slate-500">
                  Specimen {entry.specimen_date ? new Date(entry.specimen_date).toLocaleDateString() : 'N/A'}
                </p>
                {entry.biomarkers && (
                  <p className="text-xs text-slate-600 mt-1">
                    Biomarkers: {Object.keys(entry.biomarkers).slice(0, 4).join(', ') || '—'}
                  </p>
                )}
              </div>
            ))
          ) : (
            <p className="text-sm text-slate-400">No genomic records captured.</p>
          )}
        </div>
      </div>
    </div>
  );
};

export default OncologyBiomarkerDashboard;



