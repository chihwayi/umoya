import React, { useState, useEffect } from 'react';
import { AlertCircle, AlertTriangle, X, CheckCircle, Eye, TrendingUp, MessageSquare, Send } from 'lucide-react';
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
  const [replyTarget, setReplyTarget] = useState<ProAlert | null>(null);
  const [replyText, setReplyText] = useState('');
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (patientId) loadAlerts();
  }, [patientId]);

  const loadAlerts = async () => {
    try {
      setLoading(true);
      const response = await ehrApi.getPatientProAlerts(patientId, token, tenantSlug, 'active');
      setAlerts(response.data || []);
    } catch {
      setAlerts([]);
    } finally {
      setLoading(false);
    }
  };

  const markReviewed = async (alert: ProAlert, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await ehrApi.updateProAlertStatus(alert.id, 'acknowledged', token, tenantSlug);
      setAlerts((prev) => prev.filter((a) => a.id !== alert.id));
    } catch (err: any) {
      console.error('Failed to mark alert reviewed', err);
    }
  };

  const sendReply = async () => {
    if (!replyTarget || !replyText.trim()) return;
    setSending(true);
    try {
      await ehrApi.addProClinicianFeedback(replyTarget.patient_questionnaire_id, replyText.trim(), token, tenantSlug);
      setAlerts((prev) => prev.filter((a) => a.id !== replyTarget.id));
      setReplyTarget(null);
      setReplyText('');
    } catch (err: any) {
      console.error('Failed to send reply', err);
    } finally {
      setSending(false);
    }
  };

  const severityBorder = (s: string) =>
    s === 'critical' ? 'border-red-500' : s === 'high' ? 'border-orange-500' : s === 'medium' ? 'border-yellow-500' : 'border-blue-500';

  const severityBg = (s: string) =>
    s === 'critical' ? 'bg-red-100' : s === 'high' ? 'bg-orange-100' : s === 'medium' ? 'bg-yellow-100' : 'bg-blue-100';

  const severityText = (s: string) =>
    s === 'critical' ? 'text-red-900' : s === 'high' ? 'text-orange-900' : s === 'medium' ? 'text-yellow-900' : 'text-blue-900';

  if (loading) return (
    <div className={`bg-white rounded-xl shadow-sm border border-slate-200 p-4 ${className}`}>
      <p className="text-sm text-slate-500">Loading PRO alerts...</p>
    </div>
  );

  if (alerts.length === 0) return null;

  return (
    <>
      <div className={`bg-gradient-to-r from-red-50 to-orange-50 border-2 border-red-300 rounded-xl shadow-lg ${className}`}>
        <div className="p-4">
          <div className="flex items-center gap-2 mb-3">
            <AlertCircle className="w-5 h-5 text-red-600" />
            <h3 className="text-base font-bold text-red-900">PRO Alerts</h3>
            <span className="px-2 py-1 rounded-full bg-red-200 text-red-800 text-xs font-semibold">{alerts.length}</span>
          </div>

          <div className="space-y-3">
            {alerts.map((alert) => (
              <div
                key={alert.id}
                className={`p-3 rounded-lg border-l-4 ${severityBg(alert.alert_severity)} ${severityBorder(alert.alert_severity)}`}
              >
                <div className="flex items-start gap-3">
                  <div className="mt-0.5">
                    {alert.alert_severity === 'critical' || alert.alert_severity === 'high'
                      ? <AlertTriangle className={`w-5 h-5 ${alert.alert_severity === 'critical' ? 'text-red-600' : 'text-orange-600'}`} />
                      : <AlertCircle className="w-4 h-4 text-yellow-600" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h4 className={`font-semibold text-sm ${severityText(alert.alert_severity)}`}>
                        {alert.questionnaire_name ?? alert.questionnaire_code ?? 'Questionnaire'}
                      </h4>
                      <span className={`px-2 py-0.5 rounded-full text-xs font-semibold uppercase ${severityBg(alert.alert_severity)} ${severityText(alert.alert_severity)} border border-current`}>
                        {alert.alert_severity}
                      </span>
                    </div>
                    <p className={`text-sm ${severityText(alert.alert_severity)}`}>{alert.alert_message}</p>
                    {alert.score_value != null && (
                      <div className="flex items-center gap-2 mt-2">
                        <TrendingUp className="w-3 h-3 text-slate-600" />
                        <span className="text-xs font-semibold text-slate-700">Score: {alert.score_value}</span>
                        {alert.completed_at && (
                          <span className="text-xs text-slate-500">• {new Date(alert.completed_at).toLocaleDateString()}</span>
                        )}
                      </div>
                    )}
                    <div className="flex gap-2 mt-3">
                      <button
                        onClick={() => { setReplyTarget(alert); setReplyText(''); }}
                        className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-white border border-slate-300 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition"
                      >
                        <MessageSquare className="w-3 h-3" />
                        Reply to Patient
                      </button>
                      <button
                        onClick={(e) => markReviewed(alert, e)}
                        className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-white border border-slate-300 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition"
                      >
                        <CheckCircle className="w-3 h-3" />
                        Mark Reviewed
                      </button>
                      {onAlertClick && (
                        <button
                          onClick={() => onAlertClick(alert)}
                          className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-white border border-slate-300 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition"
                        >
                          <Eye className="w-3 h-3" />
                          View
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Reply modal */}
      {replyTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-bold text-slate-900">Reply to Patient</h3>
              <button onClick={() => setReplyTarget(null)} className="p-1 rounded-lg hover:bg-slate-100">
                <X className="w-4 h-4 text-slate-500" />
              </button>
            </div>
            <p className="text-xs text-slate-500 mb-3">
              This message will be visible to the patient in their MediCore app, and they will receive an SMS notification.
            </p>
            <div className="mb-2">
              <span className="text-xs font-semibold text-slate-700">Re: </span>
              <span className="text-xs text-slate-600">
                {replyTarget.questionnaire_name ?? replyTarget.questionnaire_code} — Score {replyTarget.score_value}
              </span>
            </div>
            <textarea
              className="w-full border border-slate-300 rounded-xl p-3 text-sm text-slate-800 resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
              rows={4}
              placeholder="Write your message to the patient..."
              value={replyText}
              onChange={(e) => setReplyText(e.target.value)}
              maxLength={500}
            />
            <p className="text-right text-xs text-slate-400 mt-1">{replyText.length}/500</p>
            <div className="flex gap-3 mt-4">
              <button
                onClick={() => setReplyTarget(null)}
                className="flex-1 py-2.5 rounded-xl border border-slate-300 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                onClick={sendReply}
                disabled={sending || !replyText.trim()}
                className="flex-1 py-2.5 rounded-xl bg-blue-600 text-sm font-bold text-white hover:bg-blue-700 disabled:opacity-50 flex items-center justify-center gap-2"
              >
                <Send className="w-4 h-4" />
                {sending ? 'Sending...' : 'Send'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default ProAlerts;
