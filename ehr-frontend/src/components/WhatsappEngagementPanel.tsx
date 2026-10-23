import React, { useCallback, useEffect, useState } from 'react';
import { MessageCircle, Loader2, Send } from 'lucide-react';
import { ehrApi } from '../services/api';
import { useNotification } from './GlobalNotification';

type Props = {
  patientId: string;
  tenantSlug: string;
  token: string;
  phone: string;
};

interface WhatsappMessage {
  id: string;
  direction: 'outbound' | 'inbound';
  messageText: string;
  messageType: string | null;
  status: string;
  sentAt: string;
}

interface WhatsappConsent {
  optedIn: boolean;
  phoneNumber?: string;
}

const WhatsappEngagementPanel: React.FC<Props> = ({ patientId, tenantSlug, token, phone }) => {
  const { showError, showSuccess } = useNotification();
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [consent, setConsent] = useState<WhatsappConsent | null>(null);
  const [thread, setThread] = useState<WhatsappMessage[]>([]);
  const [showThread, setShowThread] = useState(false);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const consentRes = await ehrApi.getWhatsappConsent(patientId, token, tenantSlug);
      setConsent(consentRes.data);
    } catch (error) {
      showError('Error', 'Failed to load WhatsApp consent status');
    } finally {
      setLoading(false);
    }
  }, [patientId, token, tenantSlug, showError]);

  useEffect(() => {
    void load();
  }, [load]);

  const toggleConsent = async () => {
    try {
      setUpdating(true);
      const nextOptedIn = !consent?.optedIn;
      const res = await ehrApi.setWhatsappConsent(
        patientId,
        { phoneNumber: consent?.phoneNumber || phone, optedIn: nextOptedIn },
        token,
        tenantSlug
      );
      setConsent(res.data);
      showSuccess('Success', nextOptedIn ? 'Patient opted in to WhatsApp messages' : 'Patient opted out of WhatsApp messages');
    } catch (error) {
      showError('Error', 'Failed to update WhatsApp consent');
    } finally {
      setUpdating(false);
    }
  };

  const loadThread = async () => {
    try {
      setShowThread(true);
      const res = await ehrApi.getWhatsappThread(patientId, token, tenantSlug);
      setThread(res.data || []);
    } catch (error) {
      showError('Error', 'Failed to load WhatsApp message thread');
    }
  };

  if (loading) {
    return (
      <div className="bg-white/70 backdrop-blur-sm rounded-2xl border border-slate-200/50 p-6 flex items-center gap-2 text-slate-500">
        <Loader2 className="w-4 h-4 animate-spin" />
        Loading WhatsApp status...
      </div>
    );
  }

  return (
    <div className="bg-white/70 backdrop-blur-sm rounded-2xl border border-slate-200/50 p-6">
      <h2 className="text-lg font-semibold text-slate-800 mb-4 flex items-center gap-2">
        <MessageCircle className="w-5 h-5" />
        WhatsApp Engagement
      </h2>

      <div className="flex items-center justify-between mb-4">
        <div>
          <p className="text-sm font-medium text-slate-600">Consent status</p>
          <p className={`text-sm ${consent?.optedIn ? 'text-emerald-600' : 'text-slate-500'}`}>
            {consent?.optedIn ? 'Opted in — appointment, prescription, and lab notifications will be sent via WhatsApp' : 'Not opted in'}
          </p>
        </div>
        <button
          onClick={toggleConsent}
          disabled={updating}
          className={`px-4 py-2 rounded-lg text-white transition-colors disabled:opacity-50 ${
            consent?.optedIn ? 'bg-slate-500 hover:bg-slate-600' : 'bg-emerald-500 hover:bg-emerald-600'
          }`}
        >
          {updating ? 'Updating...' : consent?.optedIn ? 'Opt Out' : 'Opt In'}
        </button>
      </div>

      {!showThread ? (
        <button
          onClick={loadThread}
          className="flex items-center gap-2 text-sm text-emerald-600 hover:text-emerald-700"
        >
          <Send className="w-4 h-4" />
          View message thread
        </button>
      ) : (
        <div className="mt-2 border-t border-slate-200 pt-4 space-y-2 max-h-64 overflow-y-auto">
          {thread.length === 0 ? (
            <p className="text-sm text-slate-500">No WhatsApp messages yet.</p>
          ) : (
            thread.map((msg) => (
              <div
                key={msg.id}
                className={`p-2 rounded-lg text-sm max-w-[80%] ${
                  msg.direction === 'outbound'
                    ? 'bg-emerald-50 border border-emerald-200 ml-auto text-right'
                    : 'bg-slate-50 border border-slate-200'
                }`}
              >
                <p className="text-slate-800">{msg.messageText}</p>
                <p className="text-xs text-slate-400 mt-1">
                  {new Date(msg.sentAt).toLocaleString()} · {msg.status}
                </p>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
};

export default WhatsappEngagementPanel;
