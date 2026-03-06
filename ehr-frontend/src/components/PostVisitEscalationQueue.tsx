import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertTriangle, RefreshCw, Clock, CheckCircle2, PhoneCall } from 'lucide-react';
import { ehrApi } from '../services/api';
import { useNotification } from './GlobalNotification';

interface PostVisitEscalationItem {
  id: string;
  status: 'open' | 'acknowledged' | 'resolved' | 'dismissed';
  severity: 'low' | 'moderate' | 'high' | 'critical';
  routeTarget: 'emergency' | 'doctor' | 'nurse';
  signalText?: string | null;
  detectedAt: string;
  slaDueAt?: string | null;
  patient?: {
    firstName?: string | null;
    lastName?: string | null;
    patientNumber?: string | null;
  };
}

interface PostVisitEscalationQueueProps {
  tenantSlug: string;
  token: string;
  defaultRouteTarget?: 'doctor' | 'nurse';
  compact?: boolean;
}

const STATUS_OPTIONS: Array<'open' | 'acknowledged' | 'resolved' | 'dismissed'> = [
  'open',
  'acknowledged',
  'resolved',
  'dismissed',
];

const SEVERITY_OPTIONS: Array<'all' | 'moderate' | 'high' | 'critical'> = [
  'all',
  'moderate',
  'high',
  'critical',
];

export default function PostVisitEscalationQueue({
  tenantSlug,
  token,
  defaultRouteTarget,
  compact = false,
}: PostVisitEscalationQueueProps) {
  const { showError, showSuccess } = useNotification();
  const [loading, setLoading] = useState(false);
  const [resolvingId, setResolvingId] = useState<string | null>(null);
  const [items, setItems] = useState<PostVisitEscalationItem[]>([]);
  const [summary, setSummary] = useState<{ total: number; openCount: number; highPriorityOpenCount: number }>({
    total: 0,
    openCount: 0,
    highPriorityOpenCount: 0,
  });
  const [statusFilter, setStatusFilter] = useState<'open' | 'acknowledged' | 'resolved' | 'dismissed'>('open');
  const [severityFilter, setSeverityFilter] = useState<'all' | 'moderate' | 'high' | 'critical'>('all');

  const handleStatusFilterChange = useCallback((value: string) => {
    if (STATUS_OPTIONS.includes(value as 'open' | 'acknowledged' | 'resolved' | 'dismissed')) {
      setStatusFilter(value as 'open' | 'acknowledged' | 'resolved' | 'dismissed');
    }
  }, []);

  const handleSeverityFilterChange = useCallback((value: string) => {
    if (SEVERITY_OPTIONS.includes(value as 'all' | 'moderate' | 'high' | 'critical')) {
      setSeverityFilter(value as 'all' | 'moderate' | 'high' | 'critical');
    }
  }, []);

  const loadEscalations = useCallback(async () => {
    if (!tenantSlug || !token) {
      return;
    }
    try {
      setLoading(true);
      const filters = {
        status: statusFilter,
        severity: severityFilter === 'all' ? undefined : severityFilter,
        routeTarget: defaultRouteTarget,
        limit: compact ? 8 : 30,
      };
      const response = await ehrApi.getPostVisitEscalations(token, tenantSlug, filters);
      setItems(response.data?.escalations || []);
      setSummary(
        response.data?.summary || {
          total: 0,
          openCount: 0,
          highPriorityOpenCount: 0,
        },
      );
    } catch (error) {
      showError('Escalation queue failed', 'Unable to load post-visit escalation events.');
    } finally {
      setLoading(false);
    }
  }, [compact, defaultRouteTarget, severityFilter, showError, statusFilter, tenantSlug, token]);

  useEffect(() => {
    loadEscalations();
  }, [loadEscalations]);

  const resolveEscalation = useCallback(
    async (item: PostVisitEscalationItem, status: 'resolved' | 'dismissed') => {
      if (!tenantSlug || !token) {
        return;
      }
      try {
        setResolvingId(item.id);
        await ehrApi.resolvePostVisitEscalation(
          item.id,
          { status, resolutionNote: status === 'resolved' ? 'Resolved from escalation queue panel.' : 'Dismissed from escalation queue panel.' },
          token,
          tenantSlug,
        );
        showSuccess('Escalation updated', `Escalation marked as ${status}.`);
        await loadEscalations();
      } catch (error) {
        showError('Escalation update failed', 'Could not update escalation status.');
      } finally {
        setResolvingId(null);
      }
    },
    [loadEscalations, showError, showSuccess, tenantSlug, token],
  );

  const severityClass = useMemo(
    () => ({
      low: 'bg-slate-100 text-slate-700 border-slate-200',
      moderate: 'bg-amber-100 text-amber-700 border-amber-200',
      high: 'bg-orange-100 text-orange-700 border-orange-200',
      critical: 'bg-rose-100 text-rose-700 border-rose-200',
    }),
    [],
  );

  return (
    <section className="rounded-2xl border border-rose-200 bg-gradient-to-br from-white to-rose-50 p-4 sm:p-5">
      <div className="flex flex-wrap items-center gap-3 justify-between mb-4">
        <div className="flex items-center gap-2">
          <AlertTriangle className="w-5 h-5 text-rose-600" />
          <div>
            <h3 className="text-sm sm:text-base font-bold text-slate-900">Post-Visit Escalation Queue</h3>
            <p className="text-xs text-slate-500">Companion safety signals with SLA routing</p>
          </div>
        </div>
        <button
          type="button"
          onClick={loadEscalations}
          className="px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-50 flex items-center gap-1"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      <div className="grid grid-cols-3 gap-2 mb-3">
        <div className="rounded-lg border border-slate-200 bg-white px-3 py-2">
          <p className="text-[11px] uppercase tracking-wide text-slate-500">Total</p>
          <p className="text-lg font-bold text-slate-900">{summary.total}</p>
        </div>
        <div className="rounded-lg border border-slate-200 bg-white px-3 py-2">
          <p className="text-[11px] uppercase tracking-wide text-slate-500">Open</p>
          <p className="text-lg font-bold text-slate-900">{summary.openCount}</p>
        </div>
        <div className="rounded-lg border border-slate-200 bg-white px-3 py-2">
          <p className="text-[11px] uppercase tracking-wide text-slate-500">High/Critical</p>
          <p className="text-lg font-bold text-rose-700">{summary.highPriorityOpenCount}</p>
        </div>
      </div>

      <div className="flex flex-wrap gap-2 mb-4">
        <select
          value={statusFilter}
          onChange={(event) => handleStatusFilterChange(event.target.value)}
          className="px-2 py-1.5 text-xs rounded-lg border border-slate-200 bg-white"
        >
          <option value="open">Open</option>
          <option value="acknowledged">Acknowledged</option>
          <option value="resolved">Resolved</option>
          <option value="dismissed">Dismissed</option>
        </select>
        <select
          value={severityFilter}
          onChange={(event) => handleSeverityFilterChange(event.target.value)}
          className="px-2 py-1.5 text-xs rounded-lg border border-slate-200 bg-white"
        >
          <option value="all">All severities</option>
          <option value="moderate">Moderate</option>
          <option value="high">High</option>
          <option value="critical">Critical</option>
        </select>
      </div>

      <div className="space-y-2">
        {loading && <p className="text-sm text-slate-600">Loading post-visit escalations…</p>}
        {!loading && items.length === 0 && (
          <p className="text-sm text-slate-500">No matching post-visit escalations.</p>
        )}
        {items.map((item) => (
          <article key={item.id} className="rounded-xl border border-slate-200 bg-white p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className={`px-2 py-0.5 rounded-full border text-[11px] font-semibold ${severityClass[item.severity]}`}>
                  {item.severity.toUpperCase()}
                </span>
                <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                  Route: {item.routeTarget}
                </span>
              </div>
              <span className="text-[11px] text-slate-500">{new Date(item.detectedAt).toLocaleString()}</span>
            </div>
            <p className="mt-2 text-sm text-slate-800">
              {item.signalText || 'Companion escalation event captured.'}
            </p>
            <p className="mt-1 text-xs text-slate-500">
              Patient: {item.patient?.firstName || 'Unknown'} {item.patient?.lastName || ''} {item.patient?.patientNumber ? `(${item.patient.patientNumber})` : ''}
            </p>
            {item.slaDueAt && (
              <p className="mt-1 text-xs text-slate-500 flex items-center gap-1">
                <Clock className="w-3 h-3" />
                SLA due {new Date(item.slaDueAt).toLocaleString()}
              </p>
            )}
            {item.status === 'open' || item.status === 'acknowledged' ? (
              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={resolvingId === item.id}
                  onClick={() => resolveEscalation(item, 'resolved')}
                  className="px-2.5 py-1.5 rounded-lg bg-emerald-600 text-white text-xs font-semibold hover:bg-emerald-700 disabled:opacity-60 flex items-center gap-1"
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  Resolve
                </button>
                <button
                  type="button"
                  disabled={resolvingId === item.id}
                  onClick={() => resolveEscalation(item, 'dismissed')}
                  className="px-2.5 py-1.5 rounded-lg border border-slate-300 text-slate-700 text-xs font-semibold hover:bg-slate-50 disabled:opacity-60"
                >
                  Dismiss
                </button>
                {item.routeTarget === 'emergency' && (
                  <span className="px-2.5 py-1.5 rounded-lg bg-rose-100 text-rose-700 text-xs font-semibold flex items-center gap-1">
                    <PhoneCall className="w-3.5 h-3.5" />
                    Emergency path
                  </span>
                )}
              </div>
            ) : (
              <p className="mt-2 text-xs text-slate-500">Status: {item.status}</p>
            )}
          </article>
        ))}
      </div>
    </section>
  );
}
