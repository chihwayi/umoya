import React, { useCallback, useEffect, useState } from 'react';
import { AlertTriangle, BellRing, Brain, Loader2 } from 'lucide-react';
import { ehrApi } from '../services/api';
import { useNotification } from './GlobalNotification';

type OncologyIntelligencePanelProps = {
  tenantSlug: string;
  token: string;
  caseId?: string | null;
};

const badgeColors: Record<string, string> = {
  info: 'bg-sky-500/10 text-sky-200 border border-sky-700/40',
  warning: 'bg-amber-500/10 text-amber-200 border border-amber-700/40',
  critical: 'bg-rose-500/10 text-rose-200 border border-rose-700/40',
};

const OncologyIntelligencePanel: React.FC<OncologyIntelligencePanelProps> = ({ tenantSlug, token, caseId }) => {
  const { showError } = useNotification();
  const [loading, setLoading] = useState(false);
  const [intelligence, setIntelligence] = useState<any>(null);

  const hasCase = Boolean(caseId && tenantSlug && token);

  const loadIntelligence = useCallback(async () => {
    if (!hasCase) return;
    setLoading(true);
    try {
      const response = await ehrApi.checkOncologyCaseAlerts(tenantSlug!, token!, caseId!, {
        includeRecommendations: true,
        includeSurveillance: true,
        includeToxicity: true,
      });
      setIntelligence(response.data);
    } catch (error) {
      console.error('Failed to load oncology intelligence', error);
      showError('Unable to load care guidance', 'Please retry shortly.');
    } finally {
      setLoading(false);
    }
  }, [caseId, hasCase, showError, tenantSlug, token]);

  useEffect(() => {
    loadIntelligence();
  }, [loadIntelligence]);

  const recommendations = intelligence?.recommendations?.recommendations ?? [];
  const responseAlerts = intelligence?.responseStatus?.alerts ?? [];
  const toxicityAlerts = intelligence?.toxicityAlerts ?? [];
  const upcomingFollowUps = intelligence?.surveillance?.upcoming ?? [];
  const overdueFollowUps = intelligence?.surveillance?.overdue ?? [];

  return (
    <div className="rounded-3xl border border-slate-800 bg-gradient-to-b from-slate-950 to-slate-900/80 text-slate-100 shadow-lg shadow-purple-900/20">
      <div className="flex items-center justify-between p-4 border-b border-slate-800/70">
        <div className="flex items-center gap-3">
          <Brain size={20} className="text-purple-300" />
          <div>
            <p className="text-lg font-semibold">Clinical Intelligence</p>
            <p className="text-xs text-slate-400">Live care recommendations, surveillance reminders, and alerts.</p>
          </div>
        </div>
        {loading ? (
          <Loader2 className="h-4 w-4 animate-spin text-slate-400" />
        ) : (
          <button
            disabled={!hasCase}
            onClick={loadIntelligence}
            className="text-xs uppercase tracking-wide text-purple-200 hover:text-purple-100"
          >
            Refresh
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4">
        <div className="rounded-2xl border border-slate-800/70 p-4 bg-slate-900/60 space-y-3">
          <p className="text-sm text-slate-400 uppercase tracking-wide flex items-center gap-2">
            <AlertTriangle size={14} className="text-amber-300" />
            Response & Toxicity Alerts
          </p>
          {[...responseAlerts, ...toxicityAlerts].length === 0 && (
            <p className="text-sm text-slate-500">No active alerts.</p>
          )}
          {[...responseAlerts, ...toxicityAlerts].map((alert: any, index: number) => (
            <div
              key={`${alert?.message ?? 'alert'}-${index}`}
              className={`rounded-2xl p-3 text-sm ${badgeColors[alert.severity || 'warning'] ?? badgeColors.warning}`}
            >
              {alert.message}
            </div>
          ))}
        </div>

        <div className="rounded-2xl border border-slate-800/70 p-4 bg-slate-900/60">
          <p className="text-sm text-slate-400 uppercase tracking-wide flex items-center gap-2">
            <BellRing size={14} className="text-emerald-300" />
            Surveillance Reminders
          </p>
          <div className="space-y-2 text-sm mt-3">
            {upcomingFollowUps.length ? (
              upcomingFollowUps.slice(0, 5).map((item: any, index: number) => (
                <div
                  key={`${item.dueDate}-${index}`}
                  className="flex items-center justify-between rounded-xl border border-slate-800 px-3 py-2"
                >
                  <div>
                    <p className="text-slate-200">
                      {item.tests?.length ? item.tests.join(', ') : 'Follow-up visit'}
                    </p>
                    <p className="text-xs text-slate-500">
                      {new Date(item.dueDate).toLocaleDateString()} • every {item.intervalMonths} mo
                    </p>
                  </div>
                  <span className="text-emerald-300 text-xs">Upcoming</span>
                </div>
              ))
            ) : (
              <p className="text-slate-500 text-sm">No upcoming follow-ups within 6 months.</p>
            )}
          </div>
          {overdueFollowUps.length > 0 && (
            <div className="mt-3 text-xs text-amber-200">
              Overdue: {overdueFollowUps.length} • prioritize earliest dated events.
            </div>
          )}
        </div>

        <div className="rounded-2xl border border-slate-800/70 p-4 bg-slate-900/60 space-y-2">
          <p className="text-sm text-slate-400 uppercase tracking-wide">Treatment Recommendations</p>
          {recommendations.length ? (
            recommendations.map((rec: any, index: number) => (
              <div
                key={`${rec.title}-${index}`}
                className="rounded-2xl border border-slate-800 px-3 py-2 text-sm bg-slate-950/50"
              >
                <p className="font-semibold text-slate-100">{rec.title}</p>
                <p className="text-slate-400 text-xs mt-1">{rec.rationale}</p>
              </div>
            ))
          ) : (
            <p className="text-sm text-slate-500">No new recommendations at this time.</p>
          )}
        </div>
      </div>
    </div>
  );
};

export default OncologyIntelligencePanel;


