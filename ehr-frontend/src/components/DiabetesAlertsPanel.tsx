import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertTriangle, CheckCheck, Filter, Loader2, Shield, RefreshCw } from 'lucide-react';
import { diabetesApi } from '../services/api';
import { useNotification } from './GlobalNotification';

type DiabetesAlertsPanelProps = {
  tenantSlug: string;
  token: string;
  registryId?: string;
  onChange?: (alerts: any[]) => void;
};

const severityColors: Record<string, string> = {
  critical: 'bg-rose-100 text-rose-700 border-rose-200',
  high: 'bg-amber-100 text-amber-700 border-amber-200',
  medium: 'bg-indigo-100 text-indigo-700 border-indigo-200',
  low: 'bg-slate-100 text-slate-600 border-slate-200',
};

const DiabetesAlertsPanel: React.FC<DiabetesAlertsPanelProps> = ({ tenantSlug, token, registryId, onChange }) => {
  const { showError, showSuccess } = useNotification();
  const [alerts, setAlerts] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [severityFilter, setSeverityFilter] = useState<'all' | 'critical' | 'high' | 'medium' | 'low'>('all');

  const fetchAlerts = useCallback(async () => {
    if (!registryId || !tenantSlug || !token) return;
    setLoading(true);
    try {
      const response = await diabetesApi.getAlerts(registryId, token, tenantSlug);
      const list = Array.isArray(response.data) ? response.data : [];
      setAlerts(list);
      onChange?.(list);
    } catch (error) {
      console.error('Failed to load diabetes alerts', error);
      showError('Unable to load alerts', 'Please retry shortly.');
    } finally {
      setLoading(false);
    }
  }, [registryId, tenantSlug, token, onChange, showError]);

  useEffect(() => {
    fetchAlerts();
  }, [fetchAlerts]);

  const handleAction = async (
    alertId: string,
    action: 'ack' | 'resolve',
  ) => {
    setBusyId(alertId);
    try {
      if (action === 'ack') {
        await diabetesApi.acknowledgeAlert(alertId, token, tenantSlug, {});
        showSuccess('Alert acknowledged', 'Alert has been marked as acknowledged.');
      } else {
        await diabetesApi.resolveAlert(alertId, token, tenantSlug, {});
        showSuccess('Alert resolved', 'Alert has been resolved.');
      }
      await fetchAlerts();
    } catch (error) {
      console.error('Failed to update alert', error);
      showError('Unable to update alert', 'Please retry shortly.');
    } finally {
      setBusyId(null);
    }
  };

  const filteredAlerts = useMemo(() => {
    if (severityFilter === 'all') {
      return alerts;
    }
    return alerts.filter((alert) => alert.alert_severity === severityFilter);
  }, [alerts, severityFilter]);

  if (!registryId) {
    return (
      <div className="rounded-3xl border border-dashed border-slate-200 p-6 text-center text-slate-400">
        Select a registry to monitor diabetes alerts.
      </div>
    );
  }

  return (
    <div className="rounded-3xl border border-slate-100 bg-white shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-6 py-4">
        <div>
          <p className="text-xs uppercase tracking-[0.35em] text-slate-400">CDS safety net</p>
          <h3 className="text-xl font-semibold text-slate-900">Active alerts</h3>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 rounded-full border border-slate-200 px-3 py-1 text-xs text-slate-600">
            <Filter className="h-3.5 w-3.5" />
            <select
              value={severityFilter}
              onChange={(event) => setSeverityFilter(event.target.value as typeof severityFilter)}
              className="bg-transparent text-xs text-slate-600 focus:outline-none"
            >
              <option value="all">All severities</option>
              <option value="critical">Critical</option>
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
            </select>
          </div>
          <button
            onClick={fetchAlerts}
            disabled={loading}
            className="inline-flex items-center gap-1 rounded-full border border-slate-200 px-3 py-1 text-xs text-slate-600 hover:bg-slate-100 disabled:opacity-50"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </div>

      <div className="p-6 space-y-3">
        {loading && (
          <div className="flex items-center justify-center rounded-2xl border border-slate-100 bg-white py-4 text-slate-500">
            <Loader2 className="h-4 w-4 animate-spin mr-2" />
            Loading alerts...
          </div>
        )}
        {!loading && filteredAlerts.length === 0 && (
          <div className="rounded-2xl border border-dashed border-slate-200 p-4 text-center text-sm text-slate-500">
            {alerts.length === 0 ? 'No active alerts. Keep up the great care!' : 'No alerts for this severity.'}
          </div>
        )}
        {!loading &&
          filteredAlerts.map((alert) => (
            <div
              key={alert.id}
              className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 rounded-2xl border border-slate-100 bg-white px-4 py-3 shadow-sm"
            >
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-slate-50 text-slate-600">
                  <AlertTriangle className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-slate-900">
                    {alert.alert_message ?? 'Diabetes alert'}
                  </p>
                  <p className="text-xs text-slate-500">
                    {alert.alert_type?.replace('_', ' ')} • {new Date(alert.created_at).toLocaleString()}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span
                  className={`inline-flex items-center gap-1 rounded-full border px-3 py-1 text-xs font-semibold ${
                    severityColors[alert.alert_severity] ?? 'bg-slate-100 text-slate-600 border-slate-200'
                  }`}
                >
                  <Shield className="h-3.5 w-3.5" />
                  {alert.alert_severity}
                </span>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleAction(alert.id, 'ack')}
                    disabled={busyId === alert.id}
                    className="rounded-full border border-slate-200 px-3 py-1 text-xs text-slate-600 hover:bg-slate-100 disabled:opacity-50"
                  >
                    Ack
                  </button>
                  <button
                    onClick={() => handleAction(alert.id, 'resolve')}
                    disabled={busyId === alert.id}
                    className="inline-flex items-center gap-1 rounded-full bg-slate-900 px-3 py-1 text-xs font-semibold text-white shadow hover:bg-slate-800 disabled:opacity-50"
                  >
                    {busyId === alert.id && <Loader2 className="h-3 w-3 animate-spin" />}
                    Resolve
                  </button>
                </div>
              </div>
            </div>
          ))}
      </div>
    </div>
  );
};

export default DiabetesAlertsPanel;


