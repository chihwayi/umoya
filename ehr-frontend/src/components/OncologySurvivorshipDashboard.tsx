import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { CalendarHeart, ClipboardCheck, Leaf } from 'lucide-react';
import { ehrApi } from '../services/api';
import { useNotification } from './GlobalNotification';

type OncologySurvivorshipDashboardProps = {
  tenantSlug: string;
  token: string;
  caseId: string;
};

const OncologySurvivorshipDashboard: React.FC<OncologySurvivorshipDashboardProps> = ({ tenantSlug, token, caseId }) => {
  const { showError } = useNotification();
  const [plan, setPlan] = useState<any>(null);
  const [followUps, setFollowUps] = useState<any[]>([]);
  const [proTrends, setProTrends] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const loadSurvivorship = useCallback(async () => {
    setLoading(true);
    try {
      const [planResp, followResp, proResp] = await Promise.all([
        ehrApi.getOncologySurvivorshipPlan(tenantSlug, token, caseId),
        ehrApi.getOncologyUpcomingFollowUps(tenantSlug, token, caseId),
        ehrApi.getOncologyPROTrends(tenantSlug, token, caseId),
      ]);
      setPlan(planResp.data);
      setFollowUps(Array.isArray(followResp.data) ? followResp.data : []);
      setProTrends(Array.isArray(proResp.data) ? proResp.data : []);
    } catch (error) {
      console.error('Failed to load survivorship dashboard', error);
      showError('Unable to load survivorship dashboard', 'Please retry shortly.');
    } finally {
      setLoading(false);
    }
  }, [caseId, showError, tenantSlug, token]);

  useEffect(() => {
    loadSurvivorship();
  }, [loadSurvivorship]);

  const latestPro = useMemo(() => (proTrends.length ? proTrends[proTrends.length - 1] : null), [proTrends]);

  return (
    <div className="rounded-3xl border border-slate-200 bg-white shadow-sm">
      <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
        <div>
          <p className="text-base font-semibold text-slate-900 flex items-center gap-2">
            <CalendarHeart className="h-4 w-4 text-rose-500" />
            Survivorship Dashboard
          </p>
          <p className="text-xs text-slate-500">Plan summary, upcoming follow-ups, and PRO quality of life signal.</p>
        </div>
        <button
          onClick={loadSurvivorship}
          disabled={loading}
          className="rounded-full border border-slate-200 px-3 py-1 text-xs text-slate-600 hover:bg-slate-50 disabled:opacity-50"
        >
          {loading ? 'Refreshing…' : 'Refresh'}
        </button>
      </div>

      <div className="p-4 grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="rounded-2xl border border-slate-100 bg-gradient-to-br from-rose-50 to-white p-4">
          <p className="text-xs uppercase text-slate-500 flex items-center gap-1">
            <Leaf className="h-3 w-3 text-rose-500" />
            Plan Overview
          </p>
          {plan ? (
            <div className="mt-3 space-y-2 text-sm text-slate-700">
              <p>
                Completion:{' '}
                <span className="font-semibold">
                  {plan.treatment_completion_date
                    ? new Date(plan.treatment_completion_date).toLocaleDateString()
                    : 'Pending'}
                </span>
              </p>
              <p>
                Recurrence risk:{' '}
                <span className="font-semibold capitalize">{plan.recurrence_risk ?? 'Not captured'}</span>
              </p>
              <p className="text-xs text-slate-500">
                Long-term side effects:{' '}
                {(plan.long_term_side_effects ?? []).length ? plan.long_term_side_effects.join(', ') : 'None listed'}
              </p>
            </div>
          ) : (
            <p className="text-sm text-slate-400 mt-3">No survivorship plan documented.</p>
          )}
        </div>

        <div className="rounded-2xl border border-slate-100 bg-gradient-to-br from-sky-50 to-white p-4">
          <p className="text-xs uppercase text-slate-500 flex items-center gap-1">
            <ClipboardCheck className="h-3 w-3 text-sky-500" />
            Upcoming Follow-ups
          </p>
          <div className="mt-3 space-y-2 text-sm text-slate-700 max-h-40 overflow-y-auto">
            {followUps.length ? (
              followUps.map((item, index) => (
                <div key={`${item.dueDate}-${index}`} className="rounded-xl border border-slate-100 bg-white px-3 py-2">
                  <p className="font-semibold">
                    {item.tests?.length ? item.tests.join(', ') : 'Visit'} •{' '}
                    {new Date(item.dueDate).toLocaleDateString()}
                  </p>
                  {item.imaging?.length ? (
                    <p className="text-xs text-slate-500">Imaging: {item.imaging.join(', ')}</p>
                  ) : null}
                </div>
              ))
            ) : (
              <p className="text-sm text-slate-400">No upcoming follow-ups within 6 months.</p>
            )}
          </div>
        </div>

        <div className="rounded-2xl border border-slate-100 bg-gradient-to-br from-lime-50 to-white p-4">
          <p className="text-xs uppercase text-slate-500">Patient Reported Outcomes</p>
          {latestPro ? (
            <div className="mt-3 text-sm text-slate-700">
              <p className="font-semibold text-slate-900">{latestPro.assessment_type}</p>
              <p className="text-xs text-slate-500">
                {new Date(latestPro.assessment_date).toLocaleDateString()} • Score {latestPro.total_score ?? 'pending'}
              </p>
              {latestPro.domain_scores && (
                <div className="mt-2 space-y-1 text-xs text-slate-600">
                  {Object.entries(latestPro.domain_scores).map(([domain, score]) => (
                    <div key={domain} className="flex items-center justify-between">
                      <span>{domain}</span>
                      <span className="font-semibold">{score as string}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <p className="text-sm text-slate-400 mt-3">No PRO assessments recorded yet.</p>
          )}
        </div>
      </div>
    </div>
  );
};

export default OncologySurvivorshipDashboard;



