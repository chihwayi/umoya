import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Activity, BarChart3, LineChart, RefreshCw } from 'lucide-react';
import { ehrApi } from '../services/api';
import { useNotification } from './GlobalNotification';

type CaseContext = {
  primary_diagnosis?: string | null;
  overall_stage?: string | null;
  oncologist_id?: string | null;
};

type OncologyAnalyticsPanelProps = {
  tenantSlug: string;
  token: string;
  caseContext?: CaseContext;
};

const AnalyticsCard: React.FC<{ title: string; value: string | number; subLabel?: string }> = ({
  title,
  value,
  subLabel,
}) => (
  <div className="flex flex-col rounded-2xl bg-slate-900/60 border border-slate-800 p-4 gap-1 text-slate-100 shadow-inner">
    <span className="text-sm uppercase tracking-wide text-slate-400">{title}</span>
    <span className="text-3xl font-semibold">{value}</span>
    {subLabel && <span className="text-xs text-slate-400">{subLabel}</span>}
  </div>
);

const OncologyAnalyticsPanel: React.FC<OncologyAnalyticsPanelProps> = ({ tenantSlug, token, caseContext }) => {
  const { showError } = useNotification();
  const [loading, setLoading] = useState(false);
  const [responseAnalytics, setResponseAnalytics] = useState<any>(null);
  const [survivalAnalytics, setSurvivalAnalytics] = useState<any>(null);
  const [biomarkerAnalytics, setBiomarkerAnalytics] = useState<any>(null);
  const [trialAnalytics, setTrialAnalytics] = useState<any>(null);

  const analyticsFilters = useMemo(() => {
    if (!caseContext) return {};
    return {
      cancerType: caseContext.primary_diagnosis ?? undefined,
      stage: caseContext.overall_stage ?? undefined,
      oncologistId: caseContext.oncologist_id ?? undefined,
    };
  }, [caseContext]);

  const loadAnalytics = useCallback(async () => {
    if (!tenantSlug || !token) return;
    setLoading(true);
    try {
      const [responseRates, survival, biomarkers, trials] = await Promise.all([
        ehrApi.getOncologyResponseAnalytics(tenantSlug, token, analyticsFilters),
        ehrApi.getOncologySurvivalAnalytics(tenantSlug, token, analyticsFilters),
        ehrApi.getOncologyBiomarkerAnalytics(tenantSlug, token, analyticsFilters),
        ehrApi.getOncologyTrialAnalytics(tenantSlug, token, analyticsFilters),
      ]);
      setResponseAnalytics(responseRates.data);
      setSurvivalAnalytics(survival.data);
      setBiomarkerAnalytics(biomarkers.data);
      setTrialAnalytics(trials.data);
    } catch (error) {
      console.error('Failed to load oncology analytics', error);
      showError('Unable to load oncology analytics', 'Please retry shortly.');
    } finally {
      setLoading(false);
    }
  }, [analyticsFilters, showError, tenantSlug, token]);

  useEffect(() => {
    loadAnalytics();
  }, [loadAnalytics]);

  return (
    <div className="rounded-3xl border border-slate-800 bg-gradient-to-b from-slate-950 to-slate-900/70 text-slate-100 shadow-lg shadow-emerald-900/10">
      <div className="flex items-center justify-between p-4 border-b border-slate-800/80">
        <div className="flex items-center gap-3">
          <BarChart3 className="text-emerald-400" size={20} />
          <div>
            <p className="text-lg font-semibold">Precision Analytics Snapshot</p>
            <p className="text-xs text-slate-400">
              Filtered by diagnosis/stage to keep the insights clinically relevant.
            </p>
          </div>
        </div>
        <button
          onClick={loadAnalytics}
          className="inline-flex items-center gap-1 text-xs uppercase tracking-wide text-emerald-300 hover:text-emerald-100 transition"
          disabled={loading}
        >
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      <div className="p-4 grid grid-cols-1 md:grid-cols-4 gap-4">
        <AnalyticsCard
          title="Overall Response Rate"
          value={responseAnalytics?.overallResponseRate ? `${responseAnalytics.overallResponseRate}%` : '—'}
          subLabel={`${responseAnalytics?.totalAssessments ?? 0} assessments`}
        />
        <AnalyticsCard
          title="Disease Control Rate"
          value={responseAnalytics?.diseaseControlRate ? `${responseAnalytics.diseaseControlRate}%` : '—'}
          subLabel={responseAnalytics?.newLesionRate ? `${responseAnalytics.newLesionRate}% new lesions` : undefined}
        />
        <AnalyticsCard
          title="Median PFS"
          value={
            survivalAnalytics?.medianPfsMonths ? `${survivalAnalytics.medianPfsMonths} mo` : survivalAnalytics ? 'N/A' : '—'
          }
          subLabel={
            survivalAnalytics?.survivalRates
              ? `1y survival ${survivalAnalytics.survivalRates.oneYear}%`
              : undefined
          }
        />
        <AnalyticsCard
          title="Active Trials"
          value={trialAnalytics?.trialCount ?? '—'}
          subLabel={
            trialAnalytics?.averageCompliance
              ? `Avg compliance ${trialAnalytics.averageCompliance}%`
              : 'Track enrollment momentum'
          }
        />
      </div>

      <div className="px-4 pb-4 grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="rounded-2xl border border-slate-800/70 p-4 bg-slate-900/60">
          <div className="flex items-center gap-2 mb-3 text-sm font-semibold text-slate-200">
            <Activity size={16} className="text-emerald-400" />
            Response Distribution
          </div>
          <div className="space-y-2 text-sm">
            {Array.isArray(responseAnalytics?.responseDistribution) && responseAnalytics.responseDistribution.length > 0 ? (
              responseAnalytics.responseDistribution.map((row: any) => (
                <div key={row.recist_response} className="flex items-center justify-between text-slate-300">
                  <span>{row.recist_response}</span>
                  <span className="font-semibold">{row.count}</span>
                </div>
              ))
            ) : (
              <p className="text-slate-500 text-sm">No RECIST data available.</p>
            )}
          </div>
        </div>

        <div className="rounded-2xl border border-slate-800/70 p-4 bg-slate-900/60">
          <div className="flex items-center gap-2 mb-3 text-sm font-semibold text-slate-200">
            <LineChart size={16} className="text-sky-400" />
            Top Biomarkers
          </div>
          <div className="space-y-2 text-sm">
            {Array.isArray(biomarkerAnalytics?.topBiomarkers) && biomarkerAnalytics.topBiomarkers.length > 0 ? (
              biomarkerAnalytics.topBiomarkers.map((item: any) => (
                <div key={item.marker} className="flex items-center justify-between text-slate-300">
                  <span>{item.marker}</span>
                  <span className="font-semibold">{item.count}</span>
                </div>
              ))
            ) : (
              <p className="text-slate-500 text-sm">No biomarker signals surfaced.</p>
            )}
          </div>
          <div className="mt-4 text-xs text-slate-500">
            {biomarkerAnalytics?.genomicSignals?.length
              ? `${biomarkerAnalytics.genomicSignals.length} genomic calls flagged`
              : 'Genomic signals pending'}
          </div>
        </div>

        <div className="rounded-2xl border border-slate-800/70 p-4 bg-slate-900/60">
          <div className="flex items-center gap-2 mb-3 text-sm font-semibold text-slate-200">
            <BarChart3 size={16} className="text-purple-400" />
            Trial Status Mix
          </div>
          <div className="space-y-2 text-sm">
            {trialAnalytics?.statusBreakdown
              ? Object.entries(trialAnalytics.statusBreakdown).map(([status, count]) => (
                  <div key={status} className="flex items-center justify-between text-slate-300">
                    <span className="capitalize">{status.replace('_', ' ')}</span>
                    <span className="font-semibold">{count as number}</span>
                  </div>
                ))
              : (
                <p className="text-slate-500 text-sm">No trial data recorded.</p>
                )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default OncologyAnalyticsPanel;


