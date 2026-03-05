import React, { useEffect, useState } from 'react';
import { AlertTriangle, BellRing, Brain, Loader2, Search, BookOpen, CheckCircle, Sparkles } from 'lucide-react';
import { ehrApi, cdssApi } from '../services/api';
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
  const { showError, showSuccess } = useNotification();
  const [loading, setLoading] = useState(false);
  const [intelligence, setIntelligence] = useState<any>(null);
  const [protocolBundle, setProtocolBundle] = useState<any>(null);
  const [executingActionId, setExecutingActionId] = useState<string | null>(null);
  const [doctorOutcomeAnalytics, setDoctorOutcomeAnalytics] = useState<any>(null);
  const [drilldownFilters, setDrilldownFilters] = useState({
    caseId: caseId || '',
    status: 'all',
    days: 30,
    dateFrom: '',
    dateTo: '',
  });
  const [appliedFilters, setAppliedFilters] = useState({
    caseId: caseId || '',
    status: 'all',
    days: 30,
    dateFrom: '',
    dateTo: '',
  });
  
  // CDSS Guideline Search State
  const [showGuidelineSearch, setShowGuidelineSearch] = useState(false);
  const [guidelineQuery, setGuidelineQuery] = useState('');
  const [guidelineResults, setGuidelineResults] = useState<any[]>([]);
  const [loadingGuidelines, setLoadingGuidelines] = useState(false);

  const effectiveCaseId = String(appliedFilters.caseId || caseId || '').trim();
  const hasCase = Boolean(effectiveCaseId && tenantSlug && token);

  useEffect(() => {
    setDrilldownFilters((prev) => ({
      ...prev,
      caseId: caseId || '',
    }));
    setAppliedFilters((prev) => ({
      ...prev,
      caseId: caseId || '',
    }));
  }, [caseId]);

  const loadIntelligence = async (
    filters: {
      caseId: string;
      status: string;
      days: number;
      dateFrom: string;
      dateTo: string;
    } = appliedFilters,
  ) => {
    const targetCaseId = String(filters.caseId || caseId || '').trim();
    if (!targetCaseId || !tenantSlug || !token) {
      setIntelligence(null);
      setProtocolBundle(null);
      setDoctorOutcomeAnalytics(null);
      return;
    }
    setLoading(true);
    try {
      const [alertResponse, bundleResponse, doctorAnalyticsResponse] = await Promise.all([
        ehrApi.checkOncologyCaseAlerts(tenantSlug!, token!, targetCaseId, {
          includeRecommendations: true,
          includeSurveillance: true,
          includeToxicity: true,
        }),
        ehrApi.getOncologyProtocolBundle(tenantSlug!, token!, targetCaseId),
        ehrApi.getDoctorOutcomeAnalytics(filters.days, token!, tenantSlug!, {
          module: 'oncology',
          status: filters.status !== 'all' ? filters.status : undefined,
          caseId: targetCaseId || undefined,
          dateFrom: filters.dateFrom || undefined,
          dateTo: filters.dateTo || undefined,
        }),
      ]);
      setIntelligence(alertResponse.data);
      setProtocolBundle(bundleResponse.data?.protocolBundle || null);
      setDoctorOutcomeAnalytics(doctorAnalyticsResponse.data || null);
    } catch (error) {
      console.error('Failed to load oncology intelligence', error);
      showError('Unable to load care guidance', 'Please retry shortly.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadIntelligence(appliedFilters);
  }, [appliedFilters, caseId, tenantSlug, token]);

  const handleGuidelineSearch = async () => {
    if (!guidelineQuery.trim()) return;
    setLoadingGuidelines(true);
    try {
      if (!token || !tenantSlug) {
        showError('Session Expired', 'Please login again.');
        return;
      }
      
      const response = await cdssApi.searchGuidelines(guidelineQuery, token, tenantSlug);
      if (response.data && response.data.citations) {
        setGuidelineResults(response.data.citations);
      } else {
        setGuidelineResults([]);
      }
    } catch (e) {
      console.error('Guideline search failed:', e);
      showError('Error', 'Failed to search guidelines');
    } finally {
      setLoadingGuidelines(false);
    }
  };

  const recommendations = intelligence?.recommendations?.recommendations ?? [];
  const responseAlerts = intelligence?.responseStatus?.alerts ?? [];
  const toxicityAlerts = intelligence?.toxicityAlerts ?? [];
  const upcomingFollowUps = intelligence?.surveillance?.upcoming ?? [];
  const overdueFollowUps = intelligence?.surveillance?.overdue ?? [];
  const protocolItems = Array.isArray(protocolBundle?.items) ? protocolBundle.items : [];
  const filteredProtocolItems = protocolItems.filter((item: any) => {
    const executionStatus = String(item?.execution_status || '').toLowerCase();
    if (appliedFilters.status === 'completed') {
      return executionStatus === 'completed';
    }
    if (appliedFilters.status === 'pending') {
      return executionStatus !== 'completed';
    }
    if (appliedFilters.status === 'acknowledged') {
      return executionStatus !== 'completed';
    }
    return true;
  });
  const oncologyQueueDrilldown = (doctorOutcomeAnalytics?.doctorQueue?.moduleDrilldown || []).find(
    (row: any) => String(row?.module || '').toLowerCase() === 'oncology',
  );
  const oncologyTopActions = (doctorOutcomeAnalytics?.recommendationExecution?.topActions || []).filter(
    (row: any) =>
      String(row?.actionId || '').includes('oncology') ||
      String(row?.actionId || '').includes('prechemo') ||
      String(row?.actionId || '').includes('dose-adjustment') ||
      String(row?.actionId || '').includes('tumor-board'),
  );

  const handleExecuteProtocolAction = async (actionItem: any) => {
    if (!caseId || !actionItem?.id) {
      return;
    }
    try {
      setExecutingActionId(String(actionItem.id));
      await ehrApi.executeOncologyProtocolBundleAction(
        tenantSlug,
        token,
        caseId,
        String(actionItem.id),
        {
          actionPayload: actionItem?.action_payload || {},
        },
      );
      showSuccess(
        'Protocol action executed',
        actionItem?.title
          ? `${actionItem.title} has been recorded in the oncology workflow.`
          : 'Protocol action execution completed.',
      );
      await loadIntelligence();
    } catch (error: any) {
      console.error('Failed to execute oncology protocol action', error);
      showError(
        'Unable to execute protocol action',
        error?.response?.data?.message || 'Please retry.',
      );
    } finally {
      setExecutingActionId(null);
    }
  };

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
        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowGuidelineSearch(!showGuidelineSearch)}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors border ${
              showGuidelineSearch 
                ? 'bg-purple-500/20 text-purple-200 border-purple-500/30' 
                : 'bg-slate-800/50 text-slate-400 border-slate-700 hover:text-purple-200 hover:border-purple-500/30'
            }`}
          >
            <Search size={14} />
            {showGuidelineSearch ? 'Hide Search' : 'Search Guidelines'}
          </button>
          
          {loading ? (
            <Loader2 className="h-4 w-4 animate-spin text-slate-400" />
          ) : (
            <button
              disabled={!hasCase}
              onClick={() => loadIntelligence(appliedFilters)}
              className="text-xs uppercase tracking-wide text-purple-200 hover:text-purple-100"
            >
              Refresh
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-3 p-4 border-b border-slate-800/70 bg-slate-950/40">
        <div className="rounded-xl border border-slate-800 bg-slate-900/70 px-3 py-2">
          <p className="text-xs uppercase tracking-wide text-slate-400">Protocol Pending</p>
          <p className="text-xl font-bold text-slate-100">{protocolBundle?.pending_count ?? 0}</p>
        </div>
        <div className="rounded-xl border border-slate-800 bg-slate-900/70 px-3 py-2">
          <p className="text-xs uppercase tracking-wide text-slate-400">Protocol Applied</p>
          <p className="text-xl font-bold text-slate-100">{protocolBundle?.applied_count ?? 0}</p>
        </div>
        <div className="rounded-xl border border-slate-800 bg-slate-900/70 px-3 py-2">
          <p className="text-xs uppercase tracking-wide text-slate-400">Doctor Queue ({appliedFilters.days}d)</p>
          <p className="text-xl font-bold text-slate-100">{doctorOutcomeAnalytics?.doctorQueue?.totalItems ?? 0}</p>
        </div>
        <div className="rounded-xl border border-slate-800 bg-slate-900/70 px-3 py-2">
          <p className="text-xs uppercase tracking-wide text-slate-400">Doctor Actions ({appliedFilters.days}d)</p>
          <p className="text-xl font-bold text-slate-100">
            {doctorOutcomeAnalytics?.recommendationExecution?.executedActionsTotal ?? 0}
          </p>
        </div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-5 gap-3 px-4 pb-4 border-b border-slate-800/70 bg-slate-950/20">
        <div className="md:col-span-2">
          <p className="text-xs uppercase tracking-wide text-slate-400 mb-1">Case ID</p>
          <input
            type="text"
            value={drilldownFilters.caseId}
            onChange={(e) => setDrilldownFilters((prev) => ({ ...prev, caseId: e.target.value }))}
            placeholder="oncology case id"
            className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-purple-500"
          />
        </div>
        <div>
          <p className="text-xs uppercase tracking-wide text-slate-400 mb-1">Status</p>
          <select
            value={drilldownFilters.status}
            onChange={(e) => setDrilldownFilters((prev) => ({ ...prev, status: e.target.value }))}
            className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-purple-500"
          >
            <option value="all">All</option>
            <option value="pending">Pending</option>
            <option value="acknowledged">Acknowledged</option>
            <option value="completed">Completed</option>
          </select>
        </div>
        <div>
          <p className="text-xs uppercase tracking-wide text-slate-400 mb-1">Window (days)</p>
          <select
            value={drilldownFilters.days}
            onChange={(e) => setDrilldownFilters((prev) => ({ ...prev, days: Number(e.target.value) || 30 }))}
            className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-purple-500"
          >
            <option value={7}>7</option>
            <option value={14}>14</option>
            <option value={30}>30</option>
            <option value={90}>90</option>
          </select>
        </div>
        <div className="flex items-end">
          <button
            type="button"
            onClick={() => {
              const nextFilters = { ...drilldownFilters };
              const hasChanged = JSON.stringify(nextFilters) !== JSON.stringify(appliedFilters);
              setAppliedFilters(nextFilters);
              if (!hasChanged) {
                loadIntelligence(nextFilters);
              }
            }}
            disabled={loading || !String(drilldownFilters.caseId || caseId || '').trim()}
            className="w-full rounded-lg bg-purple-600 px-3 py-2 text-sm font-semibold text-white hover:bg-purple-700 disabled:opacity-60"
          >
            Apply Filters
          </button>
        </div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 px-4 pb-4 border-b border-slate-800/70 bg-slate-950/10">
        <div>
          <p className="text-xs uppercase tracking-wide text-slate-400 mb-1">Date From</p>
          <input
            type="date"
            value={drilldownFilters.dateFrom}
            onChange={(e) => setDrilldownFilters((prev) => ({ ...prev, dateFrom: e.target.value }))}
            className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-purple-500"
          />
        </div>
        <div>
          <p className="text-xs uppercase tracking-wide text-slate-400 mb-1">Date To</p>
          <input
            type="date"
            value={drilldownFilters.dateTo}
            onChange={(e) => setDrilldownFilters((prev) => ({ ...prev, dateTo: e.target.value }))}
            className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-purple-500"
          />
        </div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 px-4 pb-4 border-b border-slate-800/70 bg-slate-950/20">
        <div className="rounded-xl border border-slate-800 bg-slate-900/60 px-3 py-2">
          <p className="text-xs uppercase tracking-wide text-slate-400">Oncology Queue Drilldown</p>
          {oncologyQueueDrilldown ? (
            <p className="text-sm text-slate-200 mt-1">
              {oncologyQueueDrilldown.pendingItems} pending, {oncologyQueueDrilldown.acknowledgedItems} acknowledged,{' '}
              {oncologyQueueDrilldown.completedItems} completed ({oncologyQueueDrilldown.executedActionsTotal} actions)
            </p>
          ) : (
            <p className="text-xs text-slate-500 mt-1">No oncology-specific queue drilldown in the current window.</p>
          )}
        </div>
        <div className="rounded-xl border border-slate-800 bg-slate-900/60 px-3 py-2">
          <p className="text-xs uppercase tracking-wide text-slate-400">Top Oncology Actions (30d)</p>
          {oncologyTopActions.length ? (
            <p className="text-sm text-slate-200 mt-1">
              {oncologyTopActions.slice(0, 3).map((row: any) => `${String(row.actionId).replace(/-/g, ' ')} (${row.count})`).join(' • ')}
            </p>
          ) : (
            <p className="text-xs text-slate-500 mt-1">No oncology-specific action frequency yet.</p>
          )}
        </div>
      </div>
      
      {showGuidelineSearch && (
        <div className="p-4 border-b border-slate-800/70 bg-slate-900/50">
          <div className="flex gap-3 mb-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
              <input
                type="text"
                value={guidelineQuery}
                onChange={(e) => setGuidelineQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleGuidelineSearch()}
                placeholder="Search oncology guidelines (e.g. 'metastatic breast cancer protocols', 'immunotherapy side effects')..."
                className="w-full pl-10 pr-4 py-2 bg-slate-950 border border-slate-700 rounded-lg text-sm text-slate-200 focus:ring-2 focus:ring-purple-500 focus:border-purple-500 placeholder-slate-500"
              />
            </div>
            <button
              onClick={handleGuidelineSearch}
              disabled={loadingGuidelines || !guidelineQuery.trim()}
              className="px-6 py-2 bg-purple-600 text-white rounded-lg text-sm font-medium hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {loadingGuidelines ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Searching...
                </>
              ) : (
                'Search'
              )}
            </button>
          </div>

          {guidelineResults.length > 0 && (
            <div className="space-y-3 bg-slate-950/50 rounded-lg p-4 border border-slate-800">
              <div className="flex items-center gap-2 mb-2">
                <Sparkles className="w-4 h-4 text-purple-400" />
                <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Relevant Guidelines & Evidence</p>
              </div>
              {guidelineResults.map((citation: any, idx: number) => (
                <div key={`onco-search-${idx}`} className="flex items-start gap-3 p-3 bg-slate-900 rounded border border-slate-800/60 shadow-sm">
                  <CheckCircle className="w-5 h-5 text-emerald-500 mt-0.5 flex-shrink-0" />
                  <div className="space-y-1">
                    <p className="text-sm text-slate-300 leading-relaxed">
                      {typeof citation === 'string' ? citation : (citation.content || JSON.stringify(citation))}
                    </p>
                    {citation.source && (
                      <p className="text-xs text-slate-500 font-medium">Source: {citation.source}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

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
          <p className="text-sm text-slate-400 uppercase tracking-wide">Protocol Automation Bundle</p>
          {protocolBundle?.summary && (
            <p className="text-xs text-slate-500">{protocolBundle.summary}</p>
          )}
          {filteredProtocolItems.length ? (
            filteredProtocolItems.slice(0, 5).map((item: any, index: number) => {
              const isDone = String(item?.execution_status || '').toLowerCase() === 'completed';
              const isExecuting = executingActionId === String(item?.id || '');
              return (
                <div
                  key={`${item.id || item.title}-${index}`}
                  className="rounded-2xl border border-slate-800 px-3 py-2 text-sm bg-slate-950/50"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold text-slate-100">{item.title}</p>
                      <p className="text-slate-400 text-xs mt-1">{item.rationale || item.description}</p>
                    </div>
                    <button
                      type="button"
                      disabled={isDone || isExecuting}
                      onClick={() => handleExecuteProtocolAction(item)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap ${
                        isDone
                          ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                          : 'bg-purple-600 text-white hover:bg-purple-700 disabled:opacity-60'
                      }`}
                    >
                      {isDone ? 'Applied' : isExecuting ? 'Applying...' : 'Apply'}
                    </button>
                  </div>
                </div>
              );
            })
          ) : (
            <p className="text-sm text-slate-500">No protocol automation actions match the current filters.</p>
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
