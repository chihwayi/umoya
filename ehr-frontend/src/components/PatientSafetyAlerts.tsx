import React, { useState, useMemo } from 'react';
import {
  AlertTriangle, Heart, Shield, Droplets, Activity,
  Bell, X, CheckCircle, Clock, User, Pill
} from 'lucide-react';
import { SafetyAlert, SafetyAlertCounts } from '../hooks/useSafetyAlerts';

interface PatientSafetyAlertsProps {
  /** Alerts from the shared useSafetyAlerts source of truth (already ack-applied). */
  alerts: SafetyAlert[];
  /** Aggregate counts from the same source — keeps stats in sync with the bell badge. */
  counts: SafetyAlertCounts;
  onAcknowledge: (alertId: string) => void | Promise<void>;
  onDismiss: (alertId: string) => void;
  loading?: boolean;
}

const PatientSafetyAlerts: React.FC<PatientSafetyAlertsProps> = ({
  alerts,
  counts,
  onAcknowledge,
  onDismiss,
}) => {
  const [filterSeverity, setFilterSeverity] = useState<'all' | 'low' | 'medium' | 'high' | 'critical'>('all');
  const [filterType, setFilterType] = useState<'all' | 'allergy' | 'fall_risk' | 'isolation' | 'critical_vitals' | 'medication' | 'lab' | 'general' | 'escalation'>('all');
  const [showAcknowledged, setShowAcknowledged] = useState(false);
  const [expandedAlerts, setExpandedAlerts] = useState<Set<string>>(new Set());

  const filteredAlerts = useMemo(() => {
    const filtered = alerts.filter((alert) => {
      const matchesSeverity = filterSeverity === 'all' || alert.severity === filterSeverity;
      const matchesType = filterType === 'all' || alert.alertType === filterType;
      const matchesAcknowledged = showAcknowledged || !alert.acknowledgedAt;
      return matchesSeverity && matchesType && matchesAcknowledged;
    });

    const severityOrder = { critical: 4, high: 3, medium: 2, low: 1 } as const;
    filtered.sort((a, b) => {
      const severityComparison = severityOrder[b.severity] - severityOrder[a.severity];
      if (severityComparison !== 0) return severityComparison;
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
    return filtered;
  }, [alerts, filterSeverity, filterType, showAcknowledged]);

  const getAlertIcon = (alertType: string) => {
    switch (alertType) {
      case 'allergy': return <AlertTriangle className="w-5 h-5" />;
      case 'fall_risk': return <Shield className="w-5 h-5" />;
      case 'isolation': return <Droplets className="w-5 h-5" />;
      case 'critical_vitals': return <Heart className="w-5 h-5" />;
      case 'medication': return <Pill className="w-5 h-5" />;
      case 'lab': return <Activity className="w-5 h-5" />;
      case 'escalation': return <Bell className="w-5 h-5" />;
      default: return <Bell className="w-5 h-5" />;
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical': return 'bg-red-100 text-red-800 border-red-200';
      case 'high': return 'bg-orange-100 text-orange-800 border-orange-200';
      case 'medium': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'low': return 'bg-blue-100 text-blue-800 border-blue-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const toggleAlertExpansion = (alertId: string) => {
    setExpandedAlerts((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(alertId)) newSet.delete(alertId);
      else newSet.add(alertId);
      return newSet;
    });
  };

  return (
    <div className="space-y-6">
      {/* Header with Stats */}
      <div className="bg-gradient-to-br from-white to-slate-50 rounded-2xl shadow-lg border border-slate-200/50 p-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-gradient-to-r from-red-500 to-orange-600 rounded-xl">
              <Bell className="w-6 h-6 text-white" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-slate-900">Patient Safety Alerts</h2>
              <p className="text-slate-600">Critical alerts and safety notifications</p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-sm text-slate-600">Last Updated</p>
            <p className="text-lg font-semibold text-slate-900">
              {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </p>
          </div>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <div className="bg-white rounded-lg p-4 border border-slate-200">
            <div className="flex items-center gap-2 mb-2">
              <Bell className="w-4 h-4 text-blue-600" />
              <span className="text-sm font-semibold text-slate-700">Total</span>
            </div>
            <p className="text-2xl font-bold text-slate-900">{counts.total}</p>
          </div>
          <div className="bg-white rounded-lg p-4 border border-slate-200">
            <div className="flex items-center gap-2 mb-2">
              <Activity className="w-4 h-4 text-yellow-600" />
              <span className="text-sm font-semibold text-slate-700">Active</span>
            </div>
            <p className="text-2xl font-bold text-yellow-600">{counts.active}</p>
          </div>
          <div className="bg-white rounded-lg p-4 border border-slate-200">
            <div className="flex items-center gap-2 mb-2">
              <AlertTriangle className="w-4 h-4 text-red-600" />
              <span className="text-sm font-semibold text-slate-700">Critical</span>
            </div>
            <p className="text-2xl font-bold text-red-600">{counts.critical}</p>
          </div>
          <div className="bg-white rounded-lg p-4 border border-slate-200">
            <div className="flex items-center gap-2 mb-2">
              <Heart className="w-4 h-4 text-orange-600" />
              <span className="text-sm font-semibold text-slate-700">High</span>
            </div>
            <p className="text-2xl font-bold text-orange-600">{counts.high}</p>
          </div>
          <div className="bg-white rounded-lg p-4 border border-slate-200">
            <div className="flex items-center gap-2 mb-2">
              <CheckCircle className="w-4 h-4 text-green-600" />
              <span className="text-sm font-semibold text-slate-700">Acknowledged</span>
            </div>
            <p className="text-2xl font-bold text-green-600">{counts.acknowledged}</p>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-2xl shadow-lg border border-slate-200/50 p-6">
        <div className="flex flex-col sm:flex-row gap-4 mb-4">
          <div className="flex-1">
            <label className="block text-sm font-semibold text-slate-700 mb-2">Filter by Severity</label>
            <select
              value={filterSeverity}
              onChange={(e) => setFilterSeverity(e.target.value as any)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
            >
              <option value="all">All Severities</option>
              <option value="critical">Critical</option>
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
            </select>
          </div>
          <div className="flex-1">
            <label className="block text-sm font-semibold text-slate-700 mb-2">Filter by Type</label>
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value as any)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
            >
              <option value="all">All Types</option>
              <option value="allergy">Allergies</option>
              <option value="fall_risk">Fall Risk</option>
              <option value="isolation">Isolation</option>
              <option value="critical_vitals">Critical Vitals</option>
              <option value="medication">Medication</option>
              <option value="lab">Lab Results</option>
              <option value="escalation">Clinical Escalations</option>
              <option value="general">General</option>
            </select>
          </div>
          <div className="flex items-end">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={showAcknowledged}
                onChange={(e) => setShowAcknowledged(e.target.checked)}
                className="rounded border-slate-300 text-red-600 focus:ring-red-500"
              />
              <span className="text-sm text-slate-700">Show acknowledged</span>
            </label>
          </div>
        </div>
      </div>

      {/* Alert List */}
      <div className="space-y-4">
        {filteredAlerts.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-2xl shadow-lg border border-slate-200/50">
            <Bell className="w-16 h-16 text-slate-300 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-slate-600 mb-2">No Alerts Found</h3>
            <p className="text-slate-500">No alerts match your current filters.</p>
          </div>
        ) : (
          filteredAlerts.map((alert) => (
            <div
              key={alert.id}
              onClick={() => toggleAlertExpansion(alert.id)}
              className={`bg-white rounded-xl border-2 transition-all duration-200 hover:shadow-lg cursor-pointer ${
                alert.severity === 'critical' ? 'border-red-200 bg-red-50/30' :
                alert.severity === 'high' ? 'border-orange-200 bg-orange-50/30' :
                alert.severity === 'medium' ? 'border-yellow-200 bg-yellow-50/30' :
                'border-slate-200 hover:border-blue-200'
              }`}
            >
              <div className="p-6">
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-4 flex-1">
                    <div className={`p-2 rounded-lg ${
                      alert.severity === 'critical' ? 'bg-red-100 text-red-600' :
                      alert.severity === 'high' ? 'bg-orange-100 text-orange-600' :
                      alert.severity === 'medium' ? 'bg-yellow-100 text-yellow-600' :
                      'bg-blue-100 text-blue-600'
                    }`}>
                      {getAlertIcon(alert.alertType)}
                    </div>

                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="text-lg font-semibold text-slate-900">{alert.title}</h3>
                        <span className={`px-2 py-1 rounded-full text-xs font-semibold border ${getSeverityColor(alert.severity)}`}>
                          {alert.severity.toUpperCase()}
                        </span>
                        {alert.requiresAction && !alert.acknowledgedAt && (
                          <span className="px-2 py-1 rounded-full text-xs font-semibold bg-red-100 text-red-800 border border-red-200">
                            ACTION REQUIRED
                          </span>
                        )}
                        {alert.acknowledgedAt && (
                          <span className="px-2 py-1 rounded-full text-xs font-semibold bg-green-100 text-green-800 border border-green-200">
                            ACKNOWLEDGED
                          </span>
                        )}
                      </div>

                      <p className="text-slate-600 mb-3">{alert.description}</p>

                      {alert.details && (
                        <p className="text-sm text-slate-500 mb-3">{alert.details}</p>
                      )}

                      {alert.actionRequired && (
                        <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mb-3">
                          <p className="text-sm font-semibold text-amber-800 mb-1">Action Required:</p>
                          <p className="text-sm text-amber-700">{alert.actionRequired}</p>
                        </div>
                      )}

                      <div className="flex items-center gap-6 text-sm text-slate-500">
                        {alert.patientId !== 'system' && (
                          <div className="flex items-center gap-1">
                            <User className="w-4 h-4" />
                            <span>{alert.patientName}</span>
                            {alert.patientRoom && <span>• {alert.patientRoom}</span>}
                          </div>
                        )}
                        <div className="flex items-center gap-1">
                          <Clock className="w-4 h-4" />
                          <span>{new Date(alert.createdAt).toLocaleString()}</span>
                        </div>
                        {alert.acknowledgedAt && (
                          <div className="flex items-center gap-1 text-green-600">
                            <CheckCircle className="w-4 h-4" />
                            <span>Acknowledged {new Date(alert.acknowledgedAt).toLocaleTimeString()}</span>
                          </div>
                        )}
                      </div>
                    </div>

                      {expandedAlerts.has(alert.id) && (
                        <div className="mt-3 text-xs text-slate-600 space-y-0.5">
                          {(alert.whyShown || alert.whyNow) && (
                            <>
                              {alert.whyShown && (
                                <p><span className="font-semibold">Why shown:</span> {alert.whyShown}</p>
                              )}
                              {alert.whyNow && (
                                <p><span className="font-semibold">Why now:</span> {alert.whyNow}</p>
                              )}
                            </>
                          )}
                          {(alert.trustSummary?.backingType ||
                            alert.trustSummary?.reviewState ||
                            alert.trustSummary?.classifierStage ||
                            alert.trustSummary?.evidenceCount != null) && (
                            <div className="flex flex-wrap gap-x-3 gap-y-1 pt-1 text-[11px] text-slate-500">
                              {alert.trustSummary?.backingType && <span>{alert.trustSummary.backingType}</span>}
                              {alert.trustSummary?.reviewState && <span>{alert.trustSummary.reviewState}</span>}
                              {alert.trustSummary?.classifierStage && <span>Stage: {alert.trustSummary.classifierStage}</span>}
                              {alert.trustSummary?.evidenceCount != null && (
                                <span>{alert.trustSummary.evidenceCount} evidence signal{alert.trustSummary.evidenceCount === 1 ? '' : 's'}</span>
                              )}
                            </div>
                          )}
                        </div>
                      )}
                  </div>

                  <div className="flex items-center gap-2 ml-4">
                    {!alert.acknowledgedAt && (
                      <button
                        onClick={(e) => { e.stopPropagation(); onAcknowledge(alert.id); }}
                        className="px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-all duration-200 font-semibold text-sm flex items-center gap-1"
                      >
                        <CheckCircle className="w-4 h-4" />
                        Acknowledge
                      </button>
                    )}

                    <button
                      onClick={(e) => { e.stopPropagation(); onDismiss(alert.id); }}
                      className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-all duration-200"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default PatientSafetyAlerts;
