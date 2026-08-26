import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { pharmacyApi } from '../services/api';
import { useNotification } from './GlobalNotification';
import { AlertTriangle, CheckCircle, RefreshCw, XCircle } from 'lucide-react';

interface PharmacyAlert {
  id: string;
  alert_type: string;
  severity: 'low' | 'medium' | 'high' | 'critical' | string;
  message: string;
  inventory_id?: string | null;
  resolved: boolean;
  resolved_at?: string | null;
  resolved_by?: string | null;
  notes?: string | null;
  created_at: string;
}

const SEVERITY_STYLES: Record<string, string> = {
  critical: 'bg-red-100 text-red-700 border-red-300',
  high: 'bg-orange-100 text-orange-700 border-orange-300',
  medium: 'bg-amber-100 text-amber-700 border-amber-300',
  low: 'bg-slate-100 text-slate-600 border-slate-300',
};

const PharmacyAlerts: React.FC = () => {
  const { tenantSlug } = useParams<{ tenantSlug: string }>();
  const { showSuccess, showError } = useNotification();
  const token = React.useMemo(() => (typeof window === 'undefined' ? '' : localStorage.getItem('ehr_token') || ''), []);

  const [alerts, setAlerts] = useState<PharmacyAlert[]>([]);
  const [loading, setLoading] = useState(true);
  const [severityFilter, setSeverityFilter] = useState<string>('');
  const [showResolved, setShowResolved] = useState(false);
  const [resolvingId, setResolvingId] = useState<string | null>(null);

  useEffect(() => {
    loadAlerts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [severityFilter, showResolved]);

  const loadAlerts = async () => {
    try {
      setLoading(true);
      const response = await pharmacyApi.listAlerts(token, tenantSlug!, {
        severity: severityFilter || undefined,
        resolved: showResolved ? undefined : false,
        limit: 100,
      });
      setAlerts(response.data?.alerts || []);
    } catch (error: any) {
      console.error('Failed to load pharmacy alerts:', error);
      showError('Failed to load alerts', error.response?.data?.message || 'Please try again');
    } finally {
      setLoading(false);
    }
  };

  const handleResolve = async (alert: PharmacyAlert) => {
    try {
      setResolvingId(alert.id);
      await pharmacyApi.updateAlert(alert.id, { resolved: true }, token, tenantSlug!);
      showSuccess('Alert resolved', 'The alert has been marked as resolved.');
      await loadAlerts();
    } catch (error: any) {
      showError('Failed to resolve alert', error.response?.data?.message || 'Please try again');
    } finally {
      setResolvingId(null);
    }
  };

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-200">
      <div className="p-6 border-b border-slate-200 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <AlertTriangle className="w-5 h-5 text-amber-500" />
          <h3 className="text-lg font-semibold text-slate-900">Pharmacy Alerts</h3>
        </div>
        <div className="flex items-center gap-3">
          <select
            value={severityFilter}
            onChange={(e) => setSeverityFilter(e.target.value)}
            className="text-sm border border-slate-300 rounded-lg px-3 py-2"
          >
            <option value="">All severities</option>
            <option value="critical">Critical</option>
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
          </select>
          <label className="flex items-center gap-2 text-sm text-slate-600">
            <input
              type="checkbox"
              checked={showResolved}
              onChange={(e) => setShowResolved(e.target.checked)}
            />
            Show resolved
          </label>
          <button
            onClick={loadAlerts}
            className="flex items-center gap-1 text-sm text-slate-600 hover:text-slate-900 border border-slate-300 rounded-lg px-3 py-2"
          >
            <RefreshCw className="w-4 h-4" /> Refresh
          </button>
        </div>
      </div>

      {loading ? (
        <div className="p-12 text-center text-slate-500">Loading alerts...</div>
      ) : alerts.length === 0 ? (
        <div className="p-12 text-center">
          <CheckCircle className="w-12 h-12 text-emerald-400 mx-auto mb-3" />
          <p className="text-slate-500">No {showResolved ? '' : 'unresolved '}alerts.</p>
        </div>
      ) : (
        <div className="divide-y divide-slate-100">
          {alerts.map((alert) => (
            <div key={alert.id} className="p-5 flex items-start justify-between gap-4">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <span
                    className={`text-xs font-semibold uppercase px-2 py-0.5 rounded border ${SEVERITY_STYLES[alert.severity] || SEVERITY_STYLES.low}`}
                  >
                    {alert.severity}
                  </span>
                  <span className="text-xs text-slate-400 uppercase">{alert.alert_type?.replace(/_/g, ' ')}</span>
                  {alert.resolved && (
                    <span className="text-xs font-semibold text-emerald-600 flex items-center gap-1">
                      <CheckCircle className="w-3 h-3" /> Resolved
                    </span>
                  )}
                </div>
                <p className="text-sm text-slate-800">{alert.message}</p>
                <p className="text-xs text-slate-400 mt-1">{new Date(alert.created_at).toLocaleString()}</p>
              </div>
              {!alert.resolved && (
                <button
                  onClick={() => handleResolve(alert)}
                  disabled={resolvingId === alert.id}
                  className="shrink-0 flex items-center gap-1 text-sm font-medium text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-lg px-3 py-1.5 disabled:opacity-50"
                >
                  {resolvingId === alert.id ? (
                    <XCircle className="w-4 h-4 animate-spin" />
                  ) : (
                    <CheckCircle className="w-4 h-4" />
                  )}
                  Resolve
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default PharmacyAlerts;
