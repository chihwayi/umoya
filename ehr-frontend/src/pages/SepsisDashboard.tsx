import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { AlertTriangle, Activity, Clock, TrendingUp, Loader2, ArrowLeft, Brain, BookOpen, Search, CheckCircle, ClipboardList } from 'lucide-react';
import { cdssApi, ehrAxios } from '../services/api';
import { useNotification } from '../components/GlobalNotification';
import ModuleGeneralReportCard from '../components/ModuleGeneralReportCard';

interface SepsisDashboardProps {
  embedded?: boolean;
}

const SepsisDashboard: React.FC<SepsisDashboardProps> = ({ embedded = false }) => {
  const { tenantSlug } = useParams<{ tenantSlug: string }>();
  const navigate = useNavigate();
  const { showError, showSuccess } = useNotification();
  const token = localStorage.getItem('ehr_token') || '';
  const [user, setUser] = useState<any>(null);

  useEffect(() => {
    const userData = localStorage.getItem('ehr_user');
    if (userData) {
      setUser(JSON.parse(userData));
    }
  }, []);

  const [alerts, setAlerts] = useState<any[]>([]);
  const [compliance, setCompliance] = useState<any>(null);
  const [bundleWorklist, setBundleWorklist] = useState<any[]>([]);
  const [operationalBrief, setOperationalBrief] = useState<any>(null);
  const [actionBundleId, setActionBundleId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [worklistFocus, setWorklistFocus] = useState<'all' | 'critical' | 'three-hour' | 'repeat-lactate' | 'antibiotics' | 'documentation'>('all');
  const [includeCompleted, setIncludeCompleted] = useState(false);

  // CDSS Guideline Search State
  const [showGuidelineSearch, setShowGuidelineSearch] = useState(false);
  const [guidelineQuery, setGuidelineQuery] = useState('');
  const [guidelineResults, setGuidelineResults] = useState<any[]>([]);
  const [loadingGuidelines, setLoadingGuidelines] = useState(false);

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

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 30000);
    return () => clearInterval(interval);
  }, [worklistFocus, includeCompleted]);

  const loadData = async () => {
    try {
      const [alertsRes, complianceRes, worklistRes, briefRes] = await Promise.all([
        ehrAxios.get('/sepsis/alerts', {
          headers: { 'X-Tenant-ID': tenantSlug, Authorization: `Bearer ${token}` },
        }),
        ehrAxios.get('/sepsis/compliance', {
          headers: { 'X-Tenant-ID': tenantSlug, Authorization: `Bearer ${token}` },
        }),
        ehrAxios.get('/sepsis/bundles/worklist', {
          params: { includeCompleted, focus: worklistFocus, limit: 50 },
          headers: { 'X-Tenant-ID': tenantSlug, Authorization: `Bearer ${token}` },
        }).catch(() => ({ data: [] })),
        ehrAxios.get('/sepsis/operational-brief', {
          params: { includeCompleted, limit: 80 },
          headers: { 'X-Tenant-ID': tenantSlug, Authorization: `Bearer ${token}` },
        }).catch(() => ({ data: null })),
      ]);
      setAlerts(alertsRes.data || []);
      setCompliance(complianceRes.data);
      const fallbackBundles = Array.isArray(complianceRes.data?.bundles) ? complianceRes.data.bundles : [];
      setBundleWorklist(Array.isArray(worklistRes.data) && worklistRes.data.length > 0 ? worklistRes.data : fallbackBundles);
      setOperationalBrief(briefRes?.data || null);
    } catch (error) {
      showError('Error', 'Failed to load sepsis data');
    } finally {
      setLoading(false);
    }
  };

  const getRiskTone = (riskLevel?: string) => {
    switch (String(riskLevel || '').toLowerCase()) {
      case 'critical':
        return 'bg-red-100 text-red-800 border-red-300';
      case 'high':
        return 'bg-orange-100 text-orange-800 border-orange-300';
      case 'moderate':
        return 'bg-amber-100 text-amber-800 border-amber-300';
      default:
        return 'bg-green-100 text-green-800 border-green-300';
    }
  };

  const formatTimeRemaining = (minutes?: number | null) => {
    if (minutes === null || minutes === undefined) return 'Window unknown';
    if (minutes < 0) return `${Math.abs(minutes)}m overdue`;
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    return `${h}h ${m}m remaining`;
  };

  const getOpenBundleForAlert = (alert: any) => {
    const patientId = alert?.patient_id || alert?.patientId;
    return bundleWorklist.find((bundle) => bundle.patient_id === patientId);
  };

  const handleStartBundleFromAlert = async (alert: any) => {
    const patientId = alert?.patient_id || alert?.patientId;
    const admissionId = alert?.admission_id || alert?.admissionId || null;
    const screeningId = alert?.id;
    if (!patientId || !screeningId) {
      showError('Missing context', 'Unable to start sepsis bundle: patient or screening data missing.');
      return;
    }

    try {
      setActionBundleId(`start-${screeningId}`);
      await ehrAxios.post(
        '/sepsis/bundles',
        {
          patientId,
          admissionId,
          sepsisScreeningId: screeningId,
        },
        { headers: { 'X-Tenant-ID': tenantSlug, Authorization: `Bearer ${token}` } },
      );
      showSuccess('Bundle started', 'Sepsis bundle initiated from active alert.');
      loadData();
    } catch (error: any) {
      showError('Error', error.response?.data?.message || 'Failed to start sepsis bundle');
    } finally {
      setActionBundleId(null);
    }
  };

  const handleMarkBundleElement = async (bundleId: string, element: string, label: string) => {
    try {
      setActionBundleId(bundleId);
      await ehrAxios.put(
        `/sepsis/bundles/${bundleId}/element`,
        { element, value: true },
        { headers: { 'X-Tenant-ID': tenantSlug, Authorization: `Bearer ${token}` } },
      );
      showSuccess('Bundle updated', `${label} documented for this sepsis bundle.`);
      loadData();
    } catch (error: any) {
      showError('Error', error.response?.data?.message || `Failed to update ${label.toLowerCase()}`);
    } finally {
      setActionBundleId(null);
    }
  };

  const handleDocumentBundleNote = async (bundle: any) => {
    const existingNote = String(bundle?.notes || '').trim();
    const note = window.prompt(
      'Document sepsis bundle clinical note (assessment/escalation rationale):',
      existingNote,
    );
    if (note === null) return;
    try {
      setActionBundleId(bundle.id);
      await ehrAxios.put(
        `/sepsis/bundles/${bundle.id}/notes`,
        { notes: note.trim() },
        { headers: { 'X-Tenant-ID': tenantSlug, Authorization: `Bearer ${token}` } },
      );
      showSuccess('Bundle note updated', 'Clinical sepsis note saved.');
      loadData();
    } catch (error: any) {
      showError('Error', error.response?.data?.message || 'Failed to save sepsis note');
    } finally {
      setActionBundleId(null);
    }
  };

  if (loading) {
    return (
      <div className={`flex items-center justify-center ${embedded ? 'py-12' : 'min-h-screen'}`}>
        <Loader2 className="h-12 w-12 animate-spin text-red-600 mx-auto" />
      </div>
    );
  }

  const riskSummary = bundleWorklist.reduce(
    (acc, bundle) => {
      const risk = String(bundle?.risk_level || '').toLowerCase();
      if (risk === 'critical') acc.critical += 1;
      else if (risk === 'high') acc.high += 1;
      else if (risk === 'moderate') acc.moderate += 1;
      else acc.low += 1;
      return acc;
    },
    { critical: 0, high: 0, moderate: 0, low: 0 },
  );

  return (
    <div className={embedded ? '' : 'min-h-screen bg-slate-50'}>
      {!embedded && (
        <div className="bg-gradient-to-r from-orange-600 to-red-700 text-white shadow-lg">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <button
                  onClick={() => navigate(`/ehr/${tenantSlug}/${user?.role === 'doctor' ? 'doctor' : user?.role === 'nurse' ? 'nurse' : 'dashboard'}`)}
                  className="p-2 hover:bg-white/10 rounded-lg transition-colors"
                >
                  <ArrowLeft className="w-5 h-5" />
                </button>
                <div>
                  <h1 className="text-3xl font-bold flex items-center gap-3">
                    <AlertTriangle className="w-8 h-8" />
                    Sepsis Management & SEP-1 Bundle
                  </h1>
                  <p className="text-orange-100 mt-1">Early detection & bundle compliance</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className={`max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 ${embedded ? 'pb-4' : 'pt-8 pb-8'}`}>
      <div className="mb-6">
        <ModuleGeneralReportCard
          moduleKey="sepsis"
          title="Sepsis"
          tenantSlug={tenantSlug || ''}
          token={token}
          accentClass="from-orange-50 via-white to-red-50"
        />
      </div>
      {compliance && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div className="bg-white/80 backdrop-blur-sm rounded-xl p-5 border border-slate-200">
            <p className="text-sm text-slate-600 mb-1">Total Bundles</p>
            <p className="text-4xl font-bold text-red-600">{compliance.total_bundles || 0}</p>
          </div>
          <div className="bg-white/80 backdrop-blur-sm rounded-xl p-5 border border-slate-200">
            <p className="text-sm text-slate-600 mb-1">3-Hour Compliance</p>
            <p className="text-4xl font-bold text-orange-600">
              {compliance.total_bundles > 0 ? Math.round((compliance.three_hour_compliant / compliance.total_bundles) * 100) : 0}%
            </p>
          </div>
          <div className="bg-white/80 backdrop-blur-sm rounded-xl p-5 border border-slate-200">
            <p className="text-sm text-slate-600 mb-1">Overall Compliance</p>
            <p className="text-4xl font-bold text-green-600">
              {compliance.total_bundles > 0 ? Math.round((compliance.overall_compliant / compliance.total_bundles) * 100) : 0}%
            </p>
          </div>
        </div>
      )}

      <div className="mb-6 rounded-xl border border-orange-200 bg-gradient-to-r from-orange-50 to-red-50 p-4">
        <div className="flex flex-wrap items-center gap-2">
          {[
            { key: 'all', label: 'All Bundles' },
            { key: 'critical', label: 'Critical / High' },
            { key: 'three-hour', label: '3h Incomplete' },
            { key: 'antibiotics', label: 'Antibiotic Timing' },
            { key: 'repeat-lactate', label: 'Repeat Lactate Overdue' },
            { key: 'documentation', label: 'Documentation Gaps' },
          ].map((filterOption) => (
            <button
              key={filterOption.key}
              onClick={() => setWorklistFocus(filterOption.key as typeof worklistFocus)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                worklistFocus === filterOption.key
                  ? 'bg-orange-700 text-white'
                  : 'bg-white text-orange-700 border border-orange-200 hover:bg-orange-50'
              }`}
            >
              {filterOption.label}
            </button>
          ))}
          <label className="ml-auto flex items-center gap-2 text-xs font-semibold text-orange-800">
            <input
              type="checkbox"
              checked={includeCompleted}
              onChange={(e) => setIncludeCompleted(e.target.checked)}
            />
            Include completed
          </label>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mb-6">
        <div className="rounded-xl border border-red-200 bg-red-50 p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-red-700">Critical Risk</p>
          <p className="mt-2 text-3xl font-bold text-red-700">{riskSummary.critical}</p>
        </div>
        <div className="rounded-xl border border-orange-200 bg-orange-50 p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-orange-700">High Risk</p>
          <p className="mt-2 text-3xl font-bold text-orange-700">{riskSummary.high}</p>
        </div>
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-amber-700">Moderate Risk</p>
          <p className="mt-2 text-3xl font-bold text-amber-700">{riskSummary.moderate}</p>
        </div>
        <div className="rounded-xl border border-green-200 bg-green-50 p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-green-700">Low Risk</p>
          <p className="mt-2 text-3xl font-bold text-green-700">{riskSummary.low}</p>
        </div>
      </div>

      <section className="mb-6 rounded-xl border border-orange-200 bg-gradient-to-r from-orange-50 via-white to-red-50 p-4">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
          <h3 className="text-sm font-bold uppercase tracking-wide text-orange-900 flex items-center gap-2">
            <ClipboardList className="w-4 h-4 text-orange-700" />
            Sepsis Operational Brief
          </h3>
          <button
            type="button"
            onClick={loadData}
            className="px-3 py-1.5 rounded-lg bg-orange-700 text-white text-xs font-semibold hover:bg-orange-800"
          >
            Refresh Brief
          </button>
        </div>

        {!operationalBrief ? (
          <p className="text-sm text-slate-600">Operational brief not available.</p>
        ) : (
          <div className="space-y-3">
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
              <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2">
                <p className="text-xs uppercase font-semibold text-red-700">Alerts (24h)</p>
                <p className="text-2xl font-bold text-red-900">{operationalBrief.summary?.totalAlerts24h ?? 0}</p>
              </div>
              <div className="rounded-lg border border-orange-200 bg-orange-50 px-3 py-2">
                <p className="text-xs uppercase font-semibold text-orange-700">Alerts Without Bundle</p>
                <p className="text-2xl font-bold text-orange-900">{operationalBrief.summary?.alertsWithoutBundle ?? 0}</p>
              </div>
              <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2">
                <p className="text-xs uppercase font-semibold text-rose-700">Overdue 3h</p>
                <p className="text-2xl font-bold text-rose-900">{operationalBrief.summary?.overdueThreeHour ?? 0}</p>
              </div>
              <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2">
                <p className="text-xs uppercase font-semibold text-amber-700">Severe Signals</p>
                <p className="text-2xl font-bold text-amber-900">{operationalBrief.summary?.severeSignals ?? 0}</p>
              </div>
              <div className="rounded-lg border border-violet-200 bg-violet-50 px-3 py-2">
                <p className="text-xs uppercase font-semibold text-violet-700">Repeat Lactate Overdue</p>
                <p className="text-2xl font-bold text-violet-900">{operationalBrief.summary?.repeatLactateOverdue ?? 0}</p>
              </div>
              <div className="rounded-lg border border-cyan-200 bg-cyan-50 px-3 py-2">
                <p className="text-xs uppercase font-semibold text-cyan-700">CDSS Coverage</p>
                <p className="text-2xl font-bold text-cyan-900">{operationalBrief.summary?.cdssCoveragePercent ?? 100}%</p>
              </div>
            </div>

            <div className="flex flex-wrap gap-2 text-xs font-semibold">
              <span className="rounded-full bg-red-100 text-red-700 px-2 py-1 border border-red-200">
                Antibiotics delay &gt;60m: {operationalBrief.summary?.antibioticsDelayOver60 ?? 0}
              </span>
              <span className="rounded-full bg-orange-100 text-orange-700 px-2 py-1 border border-orange-200">
                Cultures after antibiotics: {operationalBrief.summary?.culturesAfterAntibiotics ?? 0}
              </span>
              <span className="rounded-full bg-indigo-100 text-indigo-700 px-2 py-1 border border-indigo-200">
                Severe w/o hemodynamic plan: {operationalBrief.summary?.severeWithoutHemodynamicPlan ?? 0}
              </span>
              <span className="rounded-full bg-slate-100 text-slate-700 px-2 py-1 border border-slate-200">
                Missing notes: {operationalBrief.summary?.missingBundleNotes ?? 0}
              </span>
            </div>

            {Array.isArray(operationalBrief.highPriorityQueue) && operationalBrief.highPriorityQueue.length > 0 && (
              <div className="rounded-lg border border-slate-200 bg-white px-3 py-2">
                <p className="text-xs uppercase font-semibold text-slate-700 mb-2">High Priority Queue</p>
                <div className="space-y-2">
                  {operationalBrief.highPriorityQueue.slice(0, 5).map((item: any) => (
                    <article key={`sepsis-priority-${item.id}`} className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-2">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="text-sm font-semibold text-slate-900">{item.patientName}</p>
                        <span className={`rounded-full border px-2 py-0.5 text-xs font-semibold ${getRiskTone(item.riskLevel)}`}>
                          {String(item.riskLevel || 'low').toUpperCase()}
                        </span>
                      </div>
                      <p className="text-xs text-slate-600 mt-1">
                        Ward {item.wardName || 'Unassigned'} · Lactate {item.lactateValue ?? '—'} · 3h window {formatTimeRemaining(item.threeHourRemainingMinutes)}
                      </p>
                      {Array.isArray(item.cdssFlags) && item.cdssFlags.length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-1">
                          {item.cdssFlags.slice(0, 3).map((flag: string, idx: number) => (
                            <span
                              key={`sepsis-brief-flag-${item.id}-${idx}`}
                              className="rounded-full border border-rose-200 bg-rose-100 px-2 py-0.5 text-[11px] font-semibold text-rose-700"
                            >
                              {flag}
                            </span>
                          ))}
                        </div>
                      )}
                    </article>
                  ))}
                </div>
              </div>
            )}

            {Array.isArray(operationalBrief.recommendations) && operationalBrief.recommendations.length > 0 && (
              <div className="rounded-lg border border-cyan-200 bg-cyan-50 px-3 py-2">
                <p className="text-xs uppercase font-semibold text-cyan-800 mb-1">Recommended Actions</p>
                <div className="space-y-1">
                  {operationalBrief.recommendations.slice(0, 5).map((recommendation: string, idx: number) => (
                    <p key={`sepsis-recommendation-${idx}`} className="text-sm text-cyan-900">
                      {recommendation}
                    </p>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </section>

      {/* AI Guideline Search Section */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm mb-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-red-100 rounded-lg">
              <Brain className="w-5 h-5 text-red-600" />
            </div>
            <div>
              <h3 className="font-semibold text-slate-900">Sepsis Protocols & Guidelines</h3>
              <p className="text-sm text-slate-500">AI-powered search for SEP-1 and resuscitation standards</p>
            </div>
          </div>
          <button
            onClick={() => setShowGuidelineSearch(!showGuidelineSearch)}
            className="text-sm text-red-600 font-medium hover:text-red-700"
          >
            {showGuidelineSearch ? 'Hide Search' : 'Search Protocols'}
          </button>
        </div>

        {showGuidelineSearch && (
          <div className="space-y-4 animate-in slide-in-from-top-2 duration-200">
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  value={guidelineQuery}
                  onChange={(e) => setGuidelineQuery(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleGuidelineSearch()}
                  placeholder="Search e.g. '3-hour bundle', 'Fluid resuscitation', 'Antibiotic timing'..."
                  className="w-full pl-9 pr-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
                />
              </div>
              <button
                onClick={handleGuidelineSearch}
                disabled={loadingGuidelines || !guidelineQuery.trim()}
                className="px-4 py-2 bg-red-600 text-white rounded-lg font-medium hover:bg-red-700 disabled:opacity-50 transition-colors"
              >
                {loadingGuidelines ? 'Searching...' : 'Search'}
              </button>
            </div>

            {guidelineResults.length > 0 && (
              <div className="grid gap-3">
                {guidelineResults.slice(0, 2).map((result, idx) => (
                  <div key={idx} className="p-4 bg-slate-50 rounded-lg border border-slate-200">
                    <div className="flex items-start gap-3">
                      <BookOpen className="w-5 h-5 text-red-600 mt-1 shrink-0" />
                      <div>
                        <h4 className="font-medium text-slate-900">{result.source}</h4>
                        <p className="text-sm text-slate-600 mt-1 leading-relaxed">{result.text}</p>
                        {result.url && (
                          <a
                            href={result.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-block mt-2 text-xs text-red-600 hover:underline"
                          >
                            View Source
                          </a>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      <h2 className="text-xl font-bold text-slate-900 mb-3">Sepsis Alerts (Last 24h)</h2>
      {alerts.length === 0 ? (
        <div className="bg-white/80 backdrop-blur-sm rounded-xl border border-slate-200 p-12 text-center">
          <Activity className="w-16 h-16 text-green-400 mx-auto mb-4" />
          <h3 className="text-xl font-bold text-slate-900 mb-2">No Active Sepsis Alerts</h3>
          <p className="text-slate-600">All patients screened negative</p>
        </div>
      ) : (
        <div className="space-y-3">
          {alerts.map((alert) => (
            <div key={alert.id} className="bg-white/80 backdrop-blur-sm rounded-xl border-2 border-red-300 shadow-lg p-5">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-bold text-slate-900">{alert.first_name} {alert.last_name}</h3>
                <div className="flex items-center gap-2">
                  {getOpenBundleForAlert(alert) ? (
                    <span className="px-3 py-1 bg-green-100 text-green-800 rounded-full text-xs font-bold">
                      BUNDLE ACTIVE
                    </span>
                  ) : (
                    <button
                      type="button"
                      onClick={() => handleStartBundleFromAlert(alert)}
                      disabled={actionBundleId === `start-${alert.id}`}
                      className="px-3 py-1.5 rounded-lg bg-red-600 text-white text-xs font-semibold hover:bg-red-700 disabled:opacity-60"
                    >
                      {actionBundleId === `start-${alert.id}` ? 'Starting...' : 'Start Bundle'}
                    </button>
                  )}
                  <span className="px-3 py-1 bg-red-100 text-red-800 rounded-full text-xs font-bold animate-pulse">
                    SEPSIS SUSPECTED
                  </span>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div><strong>Location:</strong> {alert.ward_name} - Bed {alert.bed_number}</div>
                <div><strong>qSOFA:</strong> {alert.qsofa_score}/3</div>
                <div><strong>SIRS:</strong> {alert.sirs_score}/4</div>
                <div><strong>Lactate:</strong> {alert.lactate} mmol/L</div>
              </div>
            </div>
          ))}
        </div>
        )}

      {/* Bundle Worklist */}
      <div className="mt-6">
        <h2 className="text-xl font-bold text-slate-900 mb-3">SEP-1 Bundle Worklist</h2>
        {bundleWorklist.length === 0 ? (
          <div className="rounded-xl border border-slate-200 bg-white p-8 text-center">
            <CheckCircle className="mx-auto mb-3 h-10 w-10 text-green-500" />
            <p className="text-sm font-semibold text-slate-800">No open bundle worklist items</p>
            <p className="text-xs text-slate-500 mt-1">All active bundles are compliant for the selected window.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {bundleWorklist.map((bundle: any) => {
              const showRepeatLactateAction = Boolean(bundle?.severe_signal) || Number(bundle?.lactate_value || 0) >= 2;
              const quickActions = [
                { key: 'lactate_measured', label: 'Lactate', done: Boolean(bundle?.lactate_measured), show: true },
                { key: 'blood_cultures_drawn', label: 'Cultures', done: Boolean(bundle?.blood_cultures_drawn), show: true },
                {
                  key: 'broad_spectrum_antibiotics_given',
                  label: 'Antibiotics',
                  done: Boolean(bundle?.broad_spectrum_antibiotics_given),
                  show: true,
                },
                { key: 'fluid_bolus_given', label: 'Fluids', done: Boolean(bundle?.fluid_bolus_given), show: true },
                { key: 'vasopressors_initiated', label: 'Vasopressors', done: Boolean(bundle?.vasopressors_initiated), show: true },
                {
                  key: 'repeat_lactate_measured',
                  label: 'Repeat Lactate',
                  done: Boolean(bundle?.repeat_lactate_measured),
                  show: showRepeatLactateAction,
                },
              ];

              return (
                <div key={bundle.id} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-base font-bold text-slate-900">
                          {(bundle?.first_name || 'Unknown')} {(bundle?.last_name || 'Patient')}
                        </h3>
                        {bundle?.patient_number && (
                          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-600">
                            {bundle.patient_number}
                          </span>
                        )}
                        <span className={`rounded-full border px-2.5 py-0.5 text-xs font-semibold ${getRiskTone(bundle?.risk_level)}`}>
                          {(bundle?.risk_level || 'low').toUpperCase()} RISK
                        </span>
                      </div>
                      <p className="mt-1 text-xs text-slate-600">
                        Ward: {bundle?.ward_name || 'Unassigned'} · Lactate: {bundle?.lactate_value ?? '—'} mmol/L · 3h window:{' '}
                        {formatTimeRemaining(bundle?.three_hour_remaining_minutes)}
                      </p>
                      <p className="mt-1 text-xs text-slate-500">
                        Antibiotics delay:{' '}
                        {bundle?.antibiotics_delay_minutes === null || bundle?.antibiotics_delay_minutes === undefined
                          ? 'Unknown'
                          : `${bundle.antibiotics_delay_minutes}m`}
                        {' · '}
                        Repeat lactate:{' '}
                        {bundle?.repeat_lactate_required
                          ? bundle?.repeat_lactate_measured
                            ? 'Documented'
                            : bundle?.repeat_lactate_overdue
                            ? 'Overdue'
                            : 'Pending'
                          : 'Not required'}
                      </p>
                      <div className="mt-2 flex flex-wrap gap-2 text-[11px]">
                        {Boolean(bundle?.three_hour_bundle_complete) ? (
                          <span className="rounded-full bg-green-100 px-2 py-1 font-semibold text-green-700">3h complete</span>
                        ) : (
                          <span className="rounded-full bg-amber-100 px-2 py-1 font-semibold text-amber-700">3h pending</span>
                        )}
                        {Boolean(bundle?.six_hour_bundle_complete) ? (
                          <span className="rounded-full bg-green-100 px-2 py-1 font-semibold text-green-700">6h complete</span>
                        ) : (
                          <span className="rounded-full bg-orange-100 px-2 py-1 font-semibold text-orange-700">6h pending</span>
                        )}
                        {Boolean(bundle?.overall_compliance) ? (
                          <span className="rounded-full bg-green-100 px-2 py-1 font-semibold text-green-700">Overall compliant</span>
                        ) : (
                          <span className="rounded-full bg-red-100 px-2 py-1 font-semibold text-red-700">Intervention pending</span>
                        )}
                      </div>
                      {Array.isArray(bundle?.cdss_flags) && bundle.cdss_flags.length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-1">
                          {bundle.cdss_flags.slice(0, 4).map((flag: string, idx: number) => (
                            <span
                              key={`${bundle.id}-flag-${idx}`}
                              className="rounded-full border border-violet-200 bg-violet-100 px-2 py-0.5 text-[11px] font-semibold text-violet-700"
                            >
                              {flag}
                            </span>
                          ))}
                        </div>
                      )}
                      {Array.isArray(bundle?.recommended_actions) && bundle.recommended_actions.length > 0 && (
                        <div className="mt-2 space-y-1">
                          {bundle.recommended_actions.slice(0, 2).map((action: string, idx: number) => (
                            <p key={`${bundle.id}-rec-${idx}`} className="text-xs text-slate-600">
                              • {action}
                            </p>
                          ))}
                        </div>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-2 lg:max-w-[40%] lg:justify-end">
                      {quickActions
                        .filter((action) => action.show)
                        .map((action) => (
                          <button
                            key={`${bundle.id}-${action.key}`}
                            type="button"
                            onClick={() => handleMarkBundleElement(bundle.id, action.key, action.label)}
                            disabled={actionBundleId === bundle.id || action.done}
                            className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
                              action.done
                                ? 'bg-green-100 text-green-700'
                                : 'bg-slate-100 text-slate-700 hover:bg-slate-200 disabled:opacity-60'
                            }`}
                          >
                            {action.done ? `${action.label} done` : `Mark ${action.label}`}
                          </button>
                        ))}
                      <button
                        type="button"
                        onClick={() => handleDocumentBundleNote(bundle)}
                        disabled={actionBundleId === bundle.id}
                        className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
                      >
                        {actionBundleId === bundle.id ? 'Saving...' : 'Document Note'}
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Bundle Timeline Panel (K4) */}
      {bundleWorklist.length > 0 && (
        <div className="mt-6">
          <h2 className="text-xl font-bold text-slate-900 mb-3">SEP-1 Bundle Timeline</h2>
          <div className="space-y-3">
            {bundleWorklist.slice(0, 10).map((bundle: any) => {
              const elements = [
                { key: 'lactate_measured', label: 'Lactate', time: bundle.lactate_measured_at },
                { key: 'blood_cultures_drawn', label: 'Blood Cultures', time: bundle.blood_cultures_drawn_at },
                { key: 'broad_spectrum_antibiotics_given', label: 'Antibiotics', time: bundle.antibiotics_given_at },
                { key: 'fluid_bolus_given', label: 'Fluid Bolus', time: bundle.fluid_bolus_given_at },
                { key: 'vasopressors_initiated', label: 'Vasopressors', time: bundle.vasopressors_initiated_at },
                { key: 'repeat_lactate_measured', label: 'Repeat Lactate', time: bundle.repeat_lactate_time },
              ];
              const completed = elements.filter(e => bundle[e.key] === true).length;
              const total = elements.length;

              return (
                <div
                  key={bundle.id}
                  className="bg-white/80 backdrop-blur-sm rounded-xl border border-slate-200 p-5"
                >
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <p className="font-bold text-slate-900">Bundle #{String(bundle.id).slice(0, 8)}</p>
                      <p className="text-xs text-slate-500">
                        Onset: {bundle.sepsis_onset_time ? new Date(bundle.sepsis_onset_time).toLocaleString() : '—'}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      {bundle.three_hour_bundle_complete && (
                        <span className="px-3 py-1 bg-green-100 text-green-800 rounded-full text-xs font-bold">3h COMPLETE</span>
                      )}
                      <span className={`px-3 py-1 rounded-full text-xs font-bold ${
                        completed === total ? 'bg-green-100 text-green-800' :
                        completed >= 3 ? 'bg-amber-100 text-amber-800' : 'bg-red-100 text-red-800'
                      }`}>
                        {completed}/{total} elements
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    {elements.map((el) => {
                      const done = bundle[el.key] === true;
                      return (
                        <div key={el.key} className="flex-1">
                          <div className={`h-2 rounded-full ${done ? 'bg-green-500' : 'bg-slate-200'}`} />
                          <p className={`text-[10px] mt-1 text-center ${done ? 'text-green-700 font-semibold' : 'text-slate-400'}`}>
                            {el.label}
                          </p>
                          {el.time && (
                            <p className="text-[9px] text-center text-slate-400">
                              {new Date(el.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </p>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      </div>
    </div>
  );
};

export default SepsisDashboard;
