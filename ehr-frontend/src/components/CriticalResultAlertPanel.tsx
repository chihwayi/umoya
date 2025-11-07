import React, { useState, useEffect } from 'react';
import { AlertTriangle, CheckCircle, Clock, AlertOctagon, User, ChevronRight, X } from 'lucide-react';
import { ehrApi } from '../services/api';
import { useNotification } from './GlobalNotification';
import { formatDateTimeToDDMMYYYYHHMM } from '../utils/dateFormatting';

interface CriticalAlert {
  id: string;
  patient_name: string;
  patient_number: string;
  component_name: string;
  result_value: string;
  critical_range: string;
  severity: 'critical' | 'panic';
  alert_status: 'pending' | 'acknowledged' | 'escalated';
  alerted_at: string;
  acknowledged_at?: string;
  acknowledged_by_name?: string;
  acknowledgment_notes?: string;
  minutes_pending?: number;
  gender?: string;
  date_of_birth?: string;
}

interface CriticalResultAlertPanelProps {
  tenantSlug: string;
  token: string;
  showAllAlerts?: boolean; // If false, only show user's assigned alerts
}

export default function CriticalResultAlertPanel({
  tenantSlug,
  token,
  showAllAlerts = false,
}: CriticalResultAlertPanelProps) {
  const [alerts, setAlerts] = useState<CriticalAlert[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedAlert, setSelectedAlert] = useState<CriticalAlert | null>(null);
  const [showAcknowledgeModal, setShowAcknowledgeModal] = useState(false);
  const [acknowledgmentNotes, setAcknowledgmentNotes] = useState('');
  const [stats, setStats] = useState<any>(null);
  const [filter, setFilter] = useState<'all' | 'pending' | 'acknowledged'>('pending');
  const { showSuccess, showError } = useNotification();

  useEffect(() => {
    loadAlerts();
    loadStats();
    
    // Poll for new alerts every 30 seconds
    const interval = setInterval(() => {
      loadAlerts();
      loadStats();
    }, 30000);

    return () => clearInterval(interval);
  }, [filter, showAllAlerts]);

  const loadAlerts = async () => {
    try {
      setLoading(true);
      let response;

      if (filter === 'pending') {
        if (showAllAlerts) {
          response = await ehrApi.getLabCriticalAlerts(tenantSlug, token, { status: 'pending' });
        } else {
          response = await ehrApi.getMyLabCriticalAlerts(tenantSlug, token);
        }
      } else {
        response = await ehrApi.getLabCriticalAlerts(tenantSlug, token, { 
          status: filter === 'all' ? undefined : filter 
        });
      }

      setAlerts(response.data.alerts || []);
    } catch (error) {
      console.error('Failed to load critical alerts:', error);
      showError('Failed to load critical alerts');
    } finally {
      setLoading(false);
    }
  };

  const loadStats = async () => {
    try {
      const response = await ehrApi.getLabCriticalAlertStats(tenantSlug, token);
      setStats(response.data);
    } catch (error) {
      console.error('Failed to load alert stats:', error);
    }
  };

  const handleAcknowledge = async (alert: CriticalAlert) => {
    setSelectedAlert(alert);
    setShowAcknowledgeModal(true);
  };

  const confirmAcknowledge = async () => {
    if (!selectedAlert) return;

    try {
      await ehrApi.acknowledgeLabCriticalAlert(tenantSlug, token, selectedAlert.id, {
        acknowledgment_notes: acknowledgmentNotes,
      });

      showSuccess('Critical alert acknowledged successfully');
      setShowAcknowledgeModal(false);
      setAcknowledgmentNotes('');
      setSelectedAlert(null);
      loadAlerts();
      loadStats();
    } catch (error) {
      console.error('Failed to acknowledge alert:', error);
      showError('Failed to acknowledge alert');
    }
  };

  const handleEscalate = async (alert: CriticalAlert) => {
    // In a real implementation, you'd select a supervisor to escalate to
    try {
      // For now, escalate to any admin/doctor (system will auto-select)
      await ehrApi.escalateLabCriticalAlert(tenantSlug, token, alert.id, {
        escalate_to: 'supervisor', // The backend will find an appropriate supervisor
      });

      showSuccess('Alert escalated to supervisor');
      loadAlerts();
      loadStats();
    } catch (error) {
      console.error('Failed to escalate alert:', error);
      showError('Failed to escalate alert');
    }
  };

  const getSeverityStyles = (severity: string) => {
    if (severity === 'panic') {
      return 'bg-red-100 border-red-500 text-red-900';
    }
    return 'bg-orange-100 border-orange-500 text-orange-900';
  };

  const getSeverityIcon = (severity: string) => {
    if (severity === 'panic') {
      return <AlertOctagon className="w-6 h-6 text-red-600" />;
    }
    return <AlertTriangle className="w-6 h-6 text-orange-600" />;
  };

  const getStatusBadge = (status: string) => {
    const styles = {
      pending: 'bg-yellow-100 text-yellow-800 border-yellow-300',
      acknowledged: 'bg-green-100 text-green-800 border-green-300',
      escalated: 'bg-red-100 text-red-800 border-red-300',
    };

    return (
      <span className={`px-2 py-1 rounded-full text-xs border ${styles[status as keyof typeof styles] || styles.pending}`}>
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </span>
    );
  };

  const pendingCount = alerts.filter((a) => a.alert_status === 'pending').length;
  const urgentCount = alerts.filter((a) => a.severity === 'panic' && a.alert_status === 'pending').length;

  return (
    <div className="space-y-4">
      {/* Header with Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg shadow p-4 border-l-4 border-yellow-500">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Pending Alerts</p>
              <p className="text-2xl font-bold text-yellow-700">{stats?.pending_count || 0}</p>
            </div>
            <Clock className="w-8 h-8 text-yellow-500" />
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-4 border-l-4 border-red-500">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Panic Values</p>
              <p className="text-2xl font-bold text-red-700">{stats?.panic_count || 0}</p>
            </div>
            <AlertOctagon className="w-8 h-8 text-red-500" />
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-4 border-l-4 border-green-500">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Acknowledged</p>
              <p className="text-2xl font-bold text-green-700">{stats?.acknowledged_count || 0}</p>
            </div>
            <CheckCircle className="w-8 h-8 text-green-500" />
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-4 border-l-4 border-orange-500">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Overdue (>30min)</p>
              <p className="text-2xl font-bold text-orange-700">{stats?.overdue_count || 0}</p>
            </div>
            <AlertTriangle className="w-8 h-8 text-orange-500" />
          </div>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="bg-white rounded-lg shadow p-4">
        <div className="flex space-x-2 mb-4">
          <button
            onClick={() => setFilter('pending')}
            className={`px-4 py-2 rounded-lg ${
              filter === 'pending'
                ? 'bg-yellow-500 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            Pending ({pendingCount})
          </button>
          <button
            onClick={() => setFilter('acknowledged')}
            className={`px-4 py-2 rounded-lg ${
              filter === 'acknowledged'
                ? 'bg-green-500 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            Acknowledged
          </button>
          <button
            onClick={() => setFilter('all')}
            className={`px-4 py-2 rounded-lg ${
              filter === 'all'
                ? 'bg-blue-500 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            All Alerts
          </button>
        </div>

        {/* Alerts List */}
        <div className="space-y-3">
          {loading && (
            <div className="text-center py-8 text-gray-500">Loading alerts...</div>
          )}

          {!loading && alerts.length === 0 && (
            <div className="text-center py-8 text-gray-500">
              <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-2" />
              <p>No {filter !== 'all' ? filter : ''} critical alerts</p>
            </div>
          )}

          {!loading && alerts.map((alert) => (
            <div
              key={alert.id}
              className={`border-2 rounded-lg p-4 ${getSeverityStyles(alert.severity)} transition-all hover:shadow-lg`}
            >
              <div className="flex items-start justify-between">
                <div className="flex items-start space-x-3 flex-1">
                  {getSeverityIcon(alert.severity)}
                  
                  <div className="flex-1">
                    <div className="flex items-center space-x-3 mb-2">
                      <h4 className="font-semibold text-lg">
                        {alert.patient_name} ({alert.patient_number})
                      </h4>
                      {getStatusBadge(alert.alert_status)}
                      <span className="text-xs text-gray-600">
                        {formatDateTimeToDDMMYYYYHHMM(alert.alerted_at)}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-3 text-sm">
                      <div>
                        <span className="font-medium">Test:</span> {alert.component_name}
                      </div>
                      <div>
                        <span className="font-medium">Result:</span>{' '}
                        <span className="font-bold text-lg">{alert.result_value}</span>
                      </div>
                      <div>
                        <span className="font-medium">Critical Range:</span> {alert.critical_range}
                      </div>
                      <div>
                        <span className="font-medium">Severity:</span>{' '}
                        <span className={`font-bold ${alert.severity === 'panic' ? 'text-red-700' : 'text-orange-700'}`}>
                          {alert.severity.toUpperCase()}
                        </span>
                      </div>
                      {alert.minutes_pending !== undefined && alert.alert_status === 'pending' && (
                        <div>
                          <span className="font-medium">Time Pending:</span>{' '}
                          <span className={alert.minutes_pending > 30 ? 'text-red-700 font-bold' : ''}>
                            {Math.floor(alert.minutes_pending)} minutes
                          </span>
                        </div>
                      )}
                      {alert.acknowledged_at && (
                        <>
                          <div>
                            <span className="font-medium">Acknowledged By:</span> {alert.acknowledged_by_name}
                          </div>
                          <div>
                            <span className="font-medium">Acknowledged At:</span>{' '}
                            {formatDateTimeToDDMMYYYYHHMM(alert.acknowledged_at)}
                          </div>
                        </>
                      )}
                    </div>

                    {alert.acknowledgment_notes && (
                      <div className="mt-3 p-2 bg-white bg-opacity-50 rounded border border-current">
                        <p className="text-sm">
                          <span className="font-medium">Notes:</span> {alert.acknowledgment_notes}
                        </p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="flex flex-col space-y-2 ml-4">
                  {alert.alert_status === 'pending' && (
                    <>
                      <button
                        onClick={() => handleAcknowledge(alert)}
                        className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 flex items-center space-x-2"
                      >
                        <CheckCircle className="w-4 h-4" />
                        <span>Acknowledge</span>
                      </button>
                      
                      {alert.minutes_pending && alert.minutes_pending > 15 && (
                        <button
                          onClick={() => handleEscalate(alert)}
                          className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 flex items-center space-x-2"
                        >
                          <AlertTriangle className="w-4 h-4" />
                          <span>Escalate</span>
                        </button>
                      )}
                    </>
                  )}
                </div>
              </div>

              {/* Urgent Indicator for Panic Values */}
              {alert.severity === 'panic' && alert.alert_status === 'pending' && (
                <div className="mt-3 bg-red-700 text-white p-2 rounded-lg flex items-center space-x-2 animate-pulse">
                  <AlertOctagon className="w-5 h-5" />
                  <span className="font-bold">PANIC VALUE - IMMEDIATE ACTION REQUIRED</span>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Acknowledge Modal */}
      {showAcknowledgeModal && selectedAlert && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-bold text-gray-900">Acknowledge Critical Alert</h3>
              <button
                onClick={() => {
                  setShowAcknowledgeModal(false);
                  setAcknowledgmentNotes('');
                  setSelectedAlert(null);
                }}
                className="text-gray-500 hover:text-gray-700"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            {/* Alert Summary */}
            <div className={`p-4 rounded-lg mb-4 ${getSeverityStyles(selectedAlert.severity)}`}>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <span className="font-medium">Patient:</span> {selectedAlert.patient_name}
                </div>
                <div>
                  <span className="font-medium">Patient #:</span> {selectedAlert.patient_number}
                </div>
                <div>
                  <span className="font-medium">Test:</span> {selectedAlert.component_name}
                </div>
                <div>
                  <span className="font-medium">Result:</span>{' '}
                  <span className="font-bold text-lg">{selectedAlert.result_value}</span>
                </div>
                <div>
                  <span className="font-medium">Critical Range:</span> {selectedAlert.critical_range}
                </div>
                <div>
                  <span className="font-medium">Severity:</span>{' '}
                  <span className="font-bold">{selectedAlert.severity.toUpperCase()}</span>
                </div>
              </div>
            </div>

            {/* Acknowledgment Notes */}
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Acknowledgment Notes <span className="text-red-500">*</span>
              </label>
              <textarea
                value={acknowledgmentNotes}
                onChange={(e) => setAcknowledgmentNotes(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                rows={4}
                placeholder="Document your clinical assessment and actions taken (e.g., 'Patient reviewed, repeat test ordered, treatment initiated')"
              />
              <p className="text-xs text-gray-500 mt-1">
                Required: Document that you have reviewed this critical result and taken appropriate action
              </p>
            </div>

            {/* Clinical Guidelines */}
            <div className="mb-6 p-3 bg-blue-50 rounded-lg border border-blue-200">
              <h4 className="font-medium text-blue-900 mb-2">Clinical Reminder:</h4>
              <ul className="text-sm text-blue-800 space-y-1">
                <li>• Verify the result with the lab if unexpected</li>
                <li>• Assess patient's current clinical status</li>
                <li>• Initiate appropriate treatment if indicated</li>
                <li>• Document all actions taken in the medical record</li>
                <li>• Consider repeat testing if clinically appropriate</li>
              </ul>
            </div>

            {/* Actions */}
            <div className="flex justify-end space-x-3">
              <button
                onClick={() => {
                  setShowAcknowledgeModal(false);
                  setAcknowledgmentNotes('');
                  setSelectedAlert(null);
                }}
                className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={confirmAcknowledge}
                disabled={!acknowledgmentNotes.trim()}
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-300 disabled:cursor-not-allowed flex items-center space-x-2"
              >
                <CheckCircle className="w-5 h-5" />
                <span>Confirm Acknowledgment</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Auto-refresh indicator */}
      <div className="text-center text-xs text-gray-500">
        <Clock className="w-3 h-3 inline mr-1" />
        Auto-refreshing every 30 seconds
      </div>
    </div>
  );
}

