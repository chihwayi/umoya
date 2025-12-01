import React, { useState, useEffect } from 'react';
import { AlertCircle, AlertTriangle, X, CheckCircle, Eye, TrendingUp } from 'lucide-react';
import { ehrApi } from '../services/api';

interface ProAlert {
  id: string;
  patient_id: string;
  patient_questionnaire_id: string;
  alert_severity: 'low' | 'medium' | 'high' | 'critical';
  alert_message: string;
  score_value: number;
  status: 'active' | 'acknowledged' | 'resolved' | 'dismissed';
  created_at: string;
  questionnaire_code?: string;
  questionnaire_name?: string;
  completed_at?: string;
  total_score?: number;
}

interface ProAlertsProps {
  patientId: string;
  tenantSlug: string;
  token: string;
  onAlertClick?: (alert: ProAlert) => void;
  className?: string;
}

const ProAlerts: React.FC<ProAlertsProps> = ({
  patientId,
  tenantSlug,
  token,
  onAlertClick,
  className = '',
}) => {
  const [alerts, setAlerts] = useState<ProAlert[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (patientId) {
      loadAlerts();
    }
  }, [patientId]);

  const loadAlerts = async () => {
    try {
      setLoading(true);
      const response = await ehrApi.getPatientProAlerts(patientId, token, tenantSlug, 'active');
      setAlerts(response.data || []);
    } catch (error) {
      console.error('Failed to load PRO alerts:', error);
      setAlerts([]);
    } finally {
      setLoading(false);
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical':
        return 'bg-red-100 text-red-800 border-red-300';
      case 'high':
        return 'bg-orange-100 text-orange-800 border-orange-300';
      case 'medium':
        return 'bg-yellow-100 text-yellow-800 border-yellow-300';
      case 'low':
        return 'bg-blue-100 text-blue-800 border-blue-300';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-300';
    }
  };

  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case 'critical':
        return <AlertCircle className="w-5 h-5 text-red-600" />;
      case 'high':
        return <AlertTriangle className="w-5 h-5 text-orange-600" />;
      default:
        return <AlertCircle className="w-4 h-4 text-yellow-600" />;
    }
  };

  if (loading) {
    return (
      <div className={`bg-white rounded-xl shadow-sm border border-slate-200 p-4 ${className}`}>
        <p className="text-sm text-slate-500">Loading PRO alerts...</p>
      </div>
    );
  }

  if (alerts.length === 0) {
    return null;
  }

  return (
    <div className={`bg-gradient-to-r from-red-50 to-orange-50 border-2 border-red-300 rounded-xl shadow-lg ${className}`}>
      <div className="p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-5 h-5 text-red-600" />
            <h3 className="text-base font-bold text-red-900">PRO Alerts</h3>
            <span className="px-2 py-1 rounded-full bg-red-200 text-red-800 text-xs font-semibold">
              {alerts.length}
            </span>
          </div>
        </div>

        <div className="space-y-3">
          {alerts.map((alert) => (
            <div
              key={alert.id}
              className={`p-3 rounded-lg border-l-4 cursor-pointer hover:shadow-md transition-shadow ${
                alert.alert_severity === 'critical'
                  ? 'bg-red-100 border-red-500'
                  : alert.alert_severity === 'high'
                  ? 'bg-orange-100 border-orange-500'
                  : alert.alert_severity === 'medium'
                  ? 'bg-yellow-100 border-yellow-500'
                  : 'bg-blue-100 border-blue-500'
              }`}
              onClick={() => onAlertClick?.(alert)}
            >
              <div className="flex items-start gap-3">
                <div className="mt-0.5">
                  {getSeverityIcon(alert.alert_severity)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <h4 className={`font-semibold text-sm ${
                      alert.alert_severity === 'critical' ? 'text-red-900' :
                      alert.alert_severity === 'high' ? 'text-orange-900' :
                      alert.alert_severity === 'medium' ? 'text-yellow-900' :
                      'text-blue-900'
                    }`}>
                      {alert.questionnaire_name || alert.questionnaire_code || 'Questionnaire'}
                    </h4>
                    <span className={`px-2 py-0.5 rounded-full text-xs font-semibold border ${getSeverityColor(alert.alert_severity)}`}>
                      {alert.alert_severity.toUpperCase()}
                    </span>
                  </div>
                  <p className={`text-sm mt-1 ${
                    alert.alert_severity === 'critical' ? 'text-red-800' :
                    alert.alert_severity === 'high' ? 'text-orange-800' :
                    alert.alert_severity === 'medium' ? 'text-yellow-800' :
                    'text-blue-800'
                  }`}>
                    {alert.alert_message}
                  </p>
                  {alert.score_value !== null && alert.score_value !== undefined && (
                    <div className="flex items-center gap-2 mt-2">
                      <TrendingUp className="w-3 h-3 text-slate-600" />
                      <span className="text-xs font-semibold text-slate-700">
                        Score: {alert.score_value}
                      </span>
                      {alert.completed_at && (
                        <span className="text-xs text-slate-500">
                          • {new Date(alert.completed_at).toLocaleDateString()}
                        </span>
                      )}
                    </div>
                  )}
                </div>
                {onAlertClick && (
                  <Eye className="w-4 h-4 text-slate-600 flex-shrink-0 mt-1" />
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default ProAlerts;

