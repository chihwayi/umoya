import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Megaphone, Loader2, Plus, Send, Users, RefreshCw } from 'lucide-react';
import { useNotification } from '../components/GlobalNotification';
import { campaignApi, populationHealthApi } from '../services/api';

type TargetType = 'manual' | 'recall_list' | 'query';

const CampaignsDashboard: React.FC = () => {
  const { tenantSlug } = useParams<{ tenantSlug: string }>();
  const navigate = useNavigate();
  const { showError, showSuccess } = useNotification();
  const token = localStorage.getItem('ehr_token') || '';
  const currentUser = JSON.parse(localStorage.getItem('ehr_user') || '{}');

  const [loading, setLoading] = useState(true);
  const [campaigns, setCampaigns] = useState<any[]>([]);
  const [recallLists, setRecallLists] = useState<any[]>([]);

  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({
    name: '',
    channel: 'sms',
    targetType: 'recall_list' as TargetType,
    targetRefId: '',
    messageTemplate: 'Dear patient, this is a reminder from your clinic. Please contact us to schedule your follow-up.',
  });

  const load = async () => {
    try {
      setLoading(true);
      const [c, r] = await Promise.all([
        campaignApi.listCampaigns(token, tenantSlug || ''),
        populationHealthApi.getRecallLists(token, tenantSlug || ''),
      ]);
      setCampaigns(c.data || []);
      setRecallLists(r.data || []);
    } catch (e: any) {
      showError('Error', e?.response?.data?.message || 'Failed to load campaigns');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [tenantSlug]);

  const create = async () => {
    if (!form.name.trim() || !form.messageTemplate.trim()) {
      showError('Missing fields', 'Name and message are required.');
      return;
    }
    try {
      setCreating(true);
      const payload: any = {
        name: form.name.trim(),
        channel: form.channel,
        messageTemplate: form.messageTemplate,
        targetType: form.targetType,
      };
      if (form.targetType === 'recall_list') payload.targetRefId = form.targetRefId || null;
      const res = await campaignApi.createCampaign(payload, token, tenantSlug || '');
      showSuccess('Created', 'Campaign created.');
      setForm((p) => ({ ...p, name: '' }));
      await load();
      // Auto-select latest
      if (res.data?.id) {
        await campaignApi.prepareRecipients(res.data.id, {}, token, tenantSlug || '').catch(() => null);
      }
    } catch (e: any) {
      showError('Error', e?.response?.data?.message || 'Failed to create campaign');
    } finally {
      setCreating(false);
    }
  };

  const prepare = async (id: string) => {
    try {
      const res = await campaignApi.prepareRecipients(id, {}, token, tenantSlug || '');
      showSuccess('Prepared', `Queued ${res.data?.queued ?? 0} recipients.`);
    } catch (e: any) {
      showError('Error', e?.response?.data?.message || 'Failed to prepare recipients');
    }
  };

  const send = async (id: string) => {
    try {
      const res = await campaignApi.sendNow(id, token, tenantSlug || '');
      showSuccess('Sent', `Sent ${res.data?.sent ?? 0}, failed ${res.data?.failed ?? 0}, skipped ${res.data?.skipped ?? 0}.`);
      load();
    } catch (e: any) {
      showError('Error', e?.response?.data?.message || 'Failed to send campaign');
    }
  };

  const defaultBackPath = useMemo(
    () =>
      `/ehr/${tenantSlug}/${currentUser?.role === 'doctor' ? 'doctor' : currentUser?.role === 'nurse' ? 'nurse' : 'dashboard'}`,
    [tenantSlug, currentUser?.role],
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <Loader2 className="h-12 w-12 animate-spin text-fuchsia-600 mx-auto mb-4" />
          <p className="text-slate-600">Loading campaigns...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="bg-gradient-to-r from-fuchsia-700 to-rose-700 text-white shadow-lg">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button onClick={() => navigate(defaultBackPath)} className="p-2 hover:bg-white/10 rounded-lg transition-colors">
                <ArrowLeft className="w-5 h-5" />
              </button>
              <div>
                <h1 className="text-3xl font-bold flex items-center gap-3">
                  <Megaphone className="w-8 h-8" />
                  Recall Campaigns
                </h1>
                <p className="text-rose-100 mt-1">Bulk SMS/email campaigns for patient outreach</p>
              </div>
            </div>
            <button
              onClick={load}
              className="flex items-center gap-2 px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-xl transition-all font-semibold"
            >
              <RefreshCw className="w-4 h-4" />
              Refresh
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-8 pb-10">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-1 bg-white rounded-xl border border-slate-200 shadow-sm p-5">
            <h2 className="text-lg font-semibold text-slate-800 mb-4">New campaign</h2>
            <div className="space-y-3">
              <input
                value={form.name}
                onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                placeholder="Campaign name"
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
              />
              <select
                value={form.channel}
                onChange={(e) => setForm((p) => ({ ...p, channel: e.target.value }))}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
              >
                <option value="sms">sms</option>
                <option value="email">email</option>
              </select>
              <select
                value={form.targetType}
                onChange={(e) => setForm((p) => ({ ...p, targetType: e.target.value as TargetType }))}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
              >
                <option value="recall_list">recall_list</option>
                <option value="query">query</option>
                <option value="manual">manual</option>
              </select>

              {form.targetType === 'recall_list' && (
                <select
                  value={form.targetRefId}
                  onChange={(e) => setForm((p) => ({ ...p, targetRefId: e.target.value }))}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
                >
                  <option value="">Select recall list</option>
                  {recallLists.map((rl) => (
                    <option key={rl.id} value={rl.id}>
                      {rl.name}
                    </option>
                  ))}
                </select>
              )}

              <textarea
                value={form.messageTemplate}
                onChange={(e) => setForm((p) => ({ ...p, messageTemplate: e.target.value }))}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
                rows={6}
              />

              <button
                onClick={create}
                disabled={creating}
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-fuchsia-700 text-white hover:bg-fuchsia-800 disabled:opacity-50 font-semibold"
              >
                <Plus className="w-4 h-4" />
                Create
              </button>
              <p className="text-xs text-slate-500">
                Note: Email channel is stubbed; SMS uses existing gateway simulation.
              </p>
            </div>
          </div>

          <div className="lg:col-span-2 bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-slate-800">Campaigns</h2>
              <div className="text-sm text-slate-500 flex items-center gap-2">
                <Users className="w-4 h-4" />
                {campaigns.length} total
              </div>
            </div>
            <div className="p-5">
              {campaigns.length === 0 ? (
                <p className="text-sm text-slate-500">No campaigns yet.</p>
              ) : (
                <ul className="space-y-3">
                  {campaigns.map((c) => (
                    <li key={c.id} className="border border-slate-200 rounded-xl p-4">
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <p className="font-semibold text-slate-900">{c.name}</p>
                          <p className="text-sm text-slate-600 mt-1">
                            Status: <span className="font-medium">{c.status}</span> · Channel: {c.channel} · Target: {c.targetType}
                          </p>
                          <p className="text-xs text-slate-400 mt-2 line-clamp-2">{c.messageTemplate}</p>
                        </div>
                        <div className="flex flex-wrap gap-2 justify-end">
                          <button
                            onClick={() => prepare(c.id)}
                            className="px-3 py-1.5 rounded-lg bg-slate-100 text-slate-700 hover:bg-slate-200 text-sm font-semibold"
                          >
                            Prepare
                          </button>
                          <button
                            onClick={() => send(c.id)}
                            className="px-3 py-1.5 rounded-lg bg-emerald-50 text-emerald-700 hover:bg-emerald-100 text-sm font-semibold flex items-center gap-1"
                          >
                            <Send className="w-4 h-4" />
                            Send
                          </button>
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CampaignsDashboard;

