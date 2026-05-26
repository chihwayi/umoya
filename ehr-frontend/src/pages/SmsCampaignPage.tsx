import React, { useState, useEffect, useCallback } from 'react';
import { ehrApi as api } from '../services/api';
import { UssdMenuPreview } from '../components/UssdMenuPreview';

interface Campaign {
  id: string;
  name: string;
  status: string;
  total_recipients: number;
  sent_count: number;
  failed_count: number;
  language: string;
  scheduled_at: string | null;
  created_at: string;
}

const STATUS_COLOURS: Record<string, string> = {
  draft: '#6b7280', scheduled: '#d97706', sending: '#2563eb', sent: '#16a34a', failed: '#dc2626',
};

const LANGUAGE_LABELS: Record<string, string> = { en: 'English', sn: 'Shona', nd: 'Ndebele' };

const emptyForm = {
  name: '', messageTemplate: '', language: 'en' as 'en' | 'sn' | 'nd',
  audienceCriteria: { age_min: '', age_max: '', on_mmd: false, days_before_appointment: '' },
  scheduledAt: '',
};

interface Props { token: string; tenantSlug: string; }

export default function SmsCampaignPage({ token, tenantSlug }: Props) {
  const [tab, setTab] = useState<'campaigns' | 'create' | 'ussd'>('campaigns');
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [form, setForm] = useState({ ...emptyForm });
  const [submitting, setSubmitting] = useState(false);
  const [msg, setMsg] = useState('');
  const [preview, setPreview] = useState('');

  const loadCampaigns = useCallback(async () => {
    try {
      const data = await api.listSmsCampaigns(token, tenantSlug);
      setCampaigns(Array.isArray(data) ? data : []);
    } catch { setCampaigns([]); }
  }, [token, tenantSlug]);

  useEffect(() => {
    if (tab === 'campaigns') loadCampaigns();
  }, [tab, loadCampaigns]);

  function updatePreview(template: string, name = 'Alice') {
    setPreview(template.replace('{name}', name).replace('{clinic}', 'Newlands Clinic').replace('{date}', '2026-06-10'));
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setMsg('');
    try {
      const criteria: Record<string, any> = { on_mmd: form.audienceCriteria.on_mmd };
      if (form.audienceCriteria.age_min) criteria.age_min = parseInt(form.audienceCriteria.age_min);
      if (form.audienceCriteria.age_max) criteria.age_max = parseInt(form.audienceCriteria.age_max);
      if (form.audienceCriteria.days_before_appointment)
        criteria.days_before_appointment = parseInt(form.audienceCriteria.days_before_appointment);
      await api.createSmsCampaign({
        name: form.name,
        messageTemplate: form.messageTemplate,
        language: form.language,
        audienceCriteria: criteria,
        scheduledAt: form.scheduledAt || undefined,
      }, token, tenantSlug);
      setMsg(form.scheduledAt ? 'Campaign scheduled.' : 'Campaign created and dispatching.');
      setForm({ ...emptyForm });
      setTab('campaigns');
    } catch (err: any) {
      setMsg(err.message ?? 'Failed to create campaign.');
    } finally {
      setSubmitting(false);
    }
  }

  const tabStyle = (active: boolean): React.CSSProperties => ({
    padding: '8px 20px', border: 'none',
    borderBottom: active ? '2px solid #2563eb' : '2px solid transparent',
    background: 'none', cursor: 'pointer',
    fontWeight: active ? 600 : 400, color: active ? '#2563eb' : '#6b7280', fontSize: 14,
  });

  return (
    <div style={{ padding: 24, maxWidth: 1000 }}>
      <h2 style={{ margin: '0 0 20px' }}>SMS Campaigns & USSD Adherence Nudges</h2>

      <div style={{ borderBottom: '1px solid #e5e7eb', marginBottom: 24 }}>
        <button style={tabStyle(tab === 'campaigns')} onClick={() => setTab('campaigns')}>Campaigns</button>
        <button style={tabStyle(tab === 'create')} onClick={() => setTab('create')}>Create Campaign</button>
        <button style={tabStyle(tab === 'ussd')} onClick={() => setTab('ussd')}>USSD Menu</button>
      </div>

      {msg && (
        <div style={{ marginBottom: 16, padding: '10px 16px', borderRadius: 6, background: msg.includes('fail') || msg.includes('Failed') ? '#fef2f2' : '#f0fdf4', color: msg.includes('fail') || msg.includes('Failed') ? '#991b1b' : '#166534', border: `1px solid ${msg.includes('fail') || msg.includes('Failed') ? '#fecaca' : '#bbf7d0'}` }}>
          {msg}
        </div>
      )}

      {tab === 'campaigns' && (
        <>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
            <span style={{ fontSize: 14, color: '#6b7280' }}>{campaigns.length} campaign{campaigns.length !== 1 ? 's' : ''}</span>
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={loadCampaigns} style={{ padding: '7px 14px', border: '1px solid #d1d5db', borderRadius: 6, background: '#fff', cursor: 'pointer', fontSize: 13 }}>Refresh</button>
              <button onClick={() => setTab('create')} style={{ padding: '7px 14px', background: '#2563eb', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 13 }}>+ New Campaign</button>
            </div>
          </div>

          {campaigns.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 48, color: '#9ca3af' }}>No campaigns yet</div>
          ) : (
            <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 10, overflow: 'hidden' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ background: '#f9fafb' }}>
                    {['Name', 'Status', 'Language', 'Recipients', 'Sent', 'Failed', 'Scheduled', 'Created'].map(h => (
                      <th key={h} style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 600, color: '#374151', borderBottom: '1px solid #e5e7eb' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {campaigns.map(c => (
                    <tr key={c.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                      <td style={{ padding: '8px 12px', fontWeight: 500 }}>{c.name}</td>
                      <td style={{ padding: '8px 12px' }}>
                        <span style={{ padding: '2px 8px', borderRadius: 12, fontSize: 11, fontWeight: 600, background: (STATUS_COLOURS[c.status] ?? '#6b7280') + '22', color: STATUS_COLOURS[c.status] ?? '#6b7280' }}>
                          {c.status}
                        </span>
                      </td>
                      <td style={{ padding: '8px 12px' }}>{LANGUAGE_LABELS[c.language] ?? c.language}</td>
                      <td style={{ padding: '8px 12px' }}>{c.total_recipients}</td>
                      <td style={{ padding: '8px 12px', color: '#16a34a' }}>{c.sent_count}</td>
                      <td style={{ padding: '8px 12px', color: c.failed_count > 0 ? '#dc2626' : '#9ca3af' }}>{c.failed_count}</td>
                      <td style={{ padding: '8px 12px', color: '#6b7280' }}>{c.scheduled_at ? new Date(c.scheduled_at).toLocaleString() : '—'}</td>
                      <td style={{ padding: '8px 12px', color: '#9ca3af' }}>{new Date(c.created_at).toLocaleDateString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {tab === 'create' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24, maxWidth: 900 }}>
          <form onSubmit={handleCreate}>
            <div style={{ display: 'grid', gap: 14 }}>
              <div>
                <label style={{ display: 'block', fontSize: 12, marginBottom: 4, fontWeight: 500, color: '#374151' }}>Campaign Name</label>
                <input required value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  style={{ width: '100%', padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: 6, fontSize: 14, boxSizing: 'border-box' }} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 12, marginBottom: 4, fontWeight: 500, color: '#374151' }}>Message Template</label>
                <textarea required rows={4} value={form.messageTemplate}
                  onChange={e => { setForm(f => ({ ...f, messageTemplate: e.target.value })); updatePreview(e.target.value); }}
                  placeholder="Hello {name}, this is a reminder from {clinic}..."
                  style={{ width: '100%', padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: 6, fontSize: 13, boxSizing: 'border-box', resize: 'vertical', fontFamily: 'monospace' }} />
                <div style={{ fontSize: 11, color: '#6b7280', marginTop: 2 }}>Use {'{name}'} for patient name, {'{clinic}'} for clinic name</div>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 12, marginBottom: 4, fontWeight: 500, color: '#374151' }}>Language</label>
                <select value={form.language} onChange={e => setForm(f => ({ ...f, language: e.target.value as any }))}
                  style={{ width: '100%', padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: 6, fontSize: 14 }}>
                  <option value="en">English</option>
                  <option value="sn">Shona (ChiShona)</option>
                  <option value="nd">Ndebele (isiNdebele)</option>
                </select>
              </div>
              <fieldset style={{ border: '1px solid #e5e7eb', borderRadius: 6, padding: '12px 14px' }}>
                <legend style={{ fontSize: 12, fontWeight: 600, color: '#374151', padding: '0 4px' }}>Audience Filters</legend>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  <div>
                    <label style={{ display: 'block', fontSize: 11, marginBottom: 3, color: '#6b7280' }}>Min Age</label>
                    <input type="number" value={form.audienceCriteria.age_min} onChange={e => setForm(f => ({ ...f, audienceCriteria: { ...f.audienceCriteria, age_min: e.target.value } }))}
                      style={{ width: '100%', padding: '6px 10px', border: '1px solid #d1d5db', borderRadius: 4, fontSize: 13, boxSizing: 'border-box' }} />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: 11, marginBottom: 3, color: '#6b7280' }}>Max Age</label>
                    <input type="number" value={form.audienceCriteria.age_max} onChange={e => setForm(f => ({ ...f, audienceCriteria: { ...f.audienceCriteria, age_max: e.target.value } }))}
                      style={{ width: '100%', padding: '6px 10px', border: '1px solid #d1d5db', borderRadius: 4, fontSize: 13, boxSizing: 'border-box' }} />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: 11, marginBottom: 3, color: '#6b7280' }}>Days before appt</label>
                    <input type="number" value={form.audienceCriteria.days_before_appointment} onChange={e => setForm(f => ({ ...f, audienceCriteria: { ...f.audienceCriteria, days_before_appointment: e.target.value } }))}
                      placeholder="e.g. 3"
                      style={{ width: '100%', padding: '6px 10px', border: '1px solid #d1d5db', borderRadius: 4, fontSize: 13, boxSizing: 'border-box' }} />
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, paddingTop: 16 }}>
                    <input type="checkbox" id="on_mmd" checked={form.audienceCriteria.on_mmd} onChange={e => setForm(f => ({ ...f, audienceCriteria: { ...f.audienceCriteria, on_mmd: e.target.checked } }))} />
                    <label htmlFor="on_mmd" style={{ fontSize: 13, cursor: 'pointer' }}>On MMD only</label>
                  </div>
                </div>
              </fieldset>
              <div>
                <label style={{ display: 'block', fontSize: 12, marginBottom: 4, fontWeight: 500, color: '#374151' }}>Schedule Date/Time <span style={{ color: '#9ca3af', fontWeight: 400 }}>(leave blank to send now)</span></label>
                <input type="datetime-local" value={form.scheduledAt} onChange={e => setForm(f => ({ ...f, scheduledAt: e.target.value }))}
                  style={{ width: '100%', padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: 6, fontSize: 14, boxSizing: 'border-box' }} />
              </div>
            </div>
            <button type="submit" disabled={submitting} style={{ marginTop: 20, padding: '10px 24px', background: '#2563eb', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 14 }}>
              {submitting ? 'Creating…' : form.scheduledAt ? 'Schedule Campaign' : 'Send Now'}
            </button>
          </form>

          <div>
            <div style={{ fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 8 }}>Message Preview</div>
            <div style={{ background: '#1f2937', borderRadius: 10, padding: 20, minHeight: 120 }}>
              <div style={{ background: '#374151', borderRadius: 6, padding: '10px 14px', color: '#f9fafb', fontSize: 13, lineHeight: 1.6, fontFamily: 'monospace', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                {preview || <span style={{ color: '#9ca3af', fontStyle: 'italic' }}>Start typing your message to see preview...</span>}
              </div>
              {preview && <div style={{ marginTop: 8, fontSize: 11, color: '#9ca3af' }}>{preview.length} characters</div>}
            </div>

            <div style={{ marginTop: 20 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 8 }}>Quick Templates</div>
              {[
                { label: 'Daily ART Reminder', msg: 'Hello {name}, this is your daily ART medication reminder from {clinic}. Take your medication today and stay healthy!' },
                { label: 'Appointment Reminder', msg: 'Hi {name}, you have an upcoming appointment at {clinic}. Dial *123# to confirm or reschedule.' },
                { label: 'Refill Reminder', msg: 'Hi {name}, your medication refill is due soon. Dial *123# to request your refill or visit {clinic}.' },
              ].map(t => (
                <button key={t.label} onClick={() => { setForm(f => ({ ...f, messageTemplate: t.msg })); updatePreview(t.msg); }}
                  style={{ display: 'block', width: '100%', padding: '8px 12px', marginBottom: 6, border: '1px solid #e5e7eb', borderRadius: 6, background: '#fff', cursor: 'pointer', fontSize: 12, textAlign: 'left', color: '#374151' }}>
                  {t.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {tab === 'ussd' && (
        <div>
          <p style={{ fontSize: 14, color: '#6b7280', marginBottom: 16 }}>
            Patients dial <strong>*123#</strong> from any mobile phone (no internet required) to access self-service appointment confirmation, medication refill requests, lab results, and SMS opt-out.
          </p>
          <UssdMenuPreview />
          <div style={{ marginTop: 20, padding: 16, background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 8 }}>
            <div style={{ fontWeight: 600, fontSize: 13, color: '#92400e', marginBottom: 6 }}>Webhook Configuration</div>
            <div style={{ fontSize: 12, color: '#78350f' }}>
              Set Africa's Talking USSD callback URL to: <code style={{ background: '#fef3c7', padding: '2px 6px', borderRadius: 3 }}>https://your-domain/ussd/callback</code>
              <br />Include <code style={{ background: '#fef3c7', padding: '2px 6px', borderRadius: 3 }}>X-Tenant-ID</code> header with your clinic's tenant slug.
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
