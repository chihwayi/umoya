import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { LineChart, TrendingUp, Activity } from 'lucide-react';
import { ehrApi } from '../services/api';
import { useNotification } from './GlobalNotification';

type ResponseChartPoint = {
  date: string;
  value: number;
  recist?: string;
};

type OncologyResponseChartsProps = {
  tenantSlug: string;
  token: string;
  caseId: string;
};

const RESPONSE_COLORS: Record<string, string> = {
  CR: 'bg-emerald-500 text-emerald-900',
  PR: 'bg-sky-500 text-sky-900',
  SD: 'bg-amber-400 text-amber-900',
  PD: 'bg-rose-500 text-rose-900',
  NE: 'bg-slate-300 text-slate-700',
};

const OncologyResponseCharts: React.FC<OncologyResponseChartsProps> = ({ tenantSlug, token, caseId }) => {
  const { showError } = useNotification();
  const [assessments, setAssessments] = useState<any[]>([]);
  const [responseAnalytics, setResponseAnalytics] = useState<any>(null);
  const [survivalAnalytics, setSurvivalAnalytics] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const loadCharts = useCallback(async () => {
    setLoading(true);
    try {
      const [assessmentsResp, responseResp, survivalResp] = await Promise.all([
        ehrApi.getOncologyResponseAssessments(tenantSlug, token, caseId),
        ehrApi.getOncologyResponseAnalytics(tenantSlug, token, { caseId }),
        ehrApi.getOncologySurvivalAnalytics(tenantSlug, token, { caseId }),
      ]);
      setAssessments(Array.isArray(assessmentsResp.data) ? assessmentsResp.data : []);
      setResponseAnalytics(responseResp.data);
      setSurvivalAnalytics(survivalResp.data);
    } catch (error) {
      console.error('Failed loading response charts', error);
      showError('Unable to load response analytics', 'Please retry shortly.');
    } finally {
      setLoading(false);
    }
  }, [caseId, showError, tenantSlug, token]);

  useEffect(() => {
    loadCharts();
  }, [loadCharts]);

  const chartPoints: ResponseChartPoint[] = useMemo(() => {
    return assessments
      .filter((assessment) => assessment.assessment_date && assessment.target_lesions_size_cm !== null)
      .map((assessment) => ({
        date: assessment.assessment_date,
        value: Number(assessment.target_lesions_size_cm ?? 0),
        recist: assessment.recist_response,
      }))
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  }, [assessments]);

  const maxValue = Math.max(...chartPoints.map((point) => point.value), 0) || 1;

  return (
    <div className="rounded-3xl border border-slate-200 bg-white shadow-sm">
      <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
        <div>
          <p className="text-base font-semibold text-slate-900 flex items-center gap-2">
            <LineChart className="h-4 w-4 text-indigo-500" />
            Response Trajectory
          </p>
          <p className="text-xs text-slate-500">Tumor diameter trend with RECIST snapshots & survival estimates.</p>
        </div>
        <button
          onClick={loadCharts}
          disabled={loading}
          className="rounded-full border border-slate-200 px-3 py-1 text-xs text-slate-600 hover:bg-slate-50 disabled:opacity-50"
        >
          {loading ? 'Refreshing…' : 'Refresh'}
        </button>
      </div>

      <div className="p-4 space-y-4">
        <div className="relative h-48 border border-slate-100 rounded-2xl bg-gradient-to-b from-slate-50 to-white p-4">
          <div className="absolute inset-4 flex flex-col justify-between text-[10px] text-slate-400">
            {[0.25, 0.5, 0.75].map((ratio) => (
              <div key={ratio} className="flex items-center">
                <div className="w-full border-t border-dashed border-slate-200" />
              </div>
            ))}
          </div>
          <div className="relative h-full flex items-end gap-2">
            {chartPoints.length === 0 && (
              <div className="absolute inset-0 flex items-center justify-center text-sm text-slate-400">
                No tumor measurements captured yet.
              </div>
            )}
            {chartPoints.map((point) => {
              const height = Math.max(4, (point.value / maxValue) * 100);
              const badgeColor = point.recist ? RESPONSE_COLORS[point.recist] ?? 'bg-slate-200 text-slate-700' : '';
              return (
                <div key={point.date} className="flex flex-col items-center gap-2 w-12">
                  <div className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${badgeColor}`}>
                    {point.recist ?? 'NE'}
                  </div>
                  <div className="w-3 rounded-full bg-gradient-to-t from-indigo-400 to-indigo-600" style={{ height: `${height}%` }} />
                  <p className="text-[10px] text-slate-500 text-center">
                    {new Date(point.date).toLocaleDateString(undefined, { month: 'short', year: 'numeric' })}
                  </p>
                </div>
              );
            })}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4 text-slate-900">
            <p className="text-xs uppercase text-slate-500">Overall Response Rate</p>
            <p className="text-3xl font-semibold">
              {responseAnalytics?.overallResponseRate ? `${responseAnalytics.overallResponseRate}%` : '—'}
            </p>
            <p className="text-xs text-slate-500">
              Disease control {responseAnalytics?.diseaseControlRate ? `${responseAnalytics.diseaseControlRate}%` : '—'}
            </p>
          </div>
          <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
            <p className="text-xs uppercase text-slate-500 flex items-center gap-1">
              <TrendingUp className="h-3 w-3 text-emerald-500" />
              Median PFS
            </p>
            <p className="text-3xl font-semibold">
              {survivalAnalytics?.medianPfsMonths ? `${survivalAnalytics.medianPfsMonths} mo` : '—'}
            </p>
            <p className="text-xs text-slate-500">
              1-year survival {survivalAnalytics?.survivalRates ? `${survivalAnalytics.survivalRates.oneYear}%` : '—'}
            </p>
          </div>
          <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
            <p className="text-xs uppercase text-slate-500 flex items-center gap-1">
              <Activity className="h-3 w-3 text-rose-500" />
              Best Overall Response
            </p>
            {responseAnalytics?.bestOverallResponseDistribution?.length ? (
              <div className="space-y-1 mt-2">
                {responseAnalytics.bestOverallResponseDistribution.slice(0, 3).map((item: any) => (
                  <div key={item.best_overall_response} className="flex items-center justify-between text-sm">
                    <span>{item.best_overall_response}</span>
                    <span className="font-semibold">{item.count}</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-slate-500 mt-2">No RECIST summary yet.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default OncologyResponseCharts;



