import React, { useState, useEffect, useCallback } from 'react';
import { ehrApi as api } from '../services/api';

interface RdSession {
  id: string;
  session_name: string;
  valid_from: string;
  valid_until: string;
  allowed_views: string[];
  access_count: number;
  shareUrl: string;
}

const VIEW_OPTIONS = ['cascade', 'retention', 'pharmacovigilance'];

const emptyForm = {
  sessionName: '',
  validFrom: '',
  validUntil: '',
  allowedViews: [] as string[],
};

interface Props { token: string; tenantSlug: string; }

export default function ResearchDayPortal({ token, tenantSlug }: Props) {
  const [tab, setTab] = useState<'sessions' | 'create' | 'preview'>('sessions');
  const [sessions, setSessions] = useState<RdSession[]>([]);
  const [form, setForm] = useState({ ...emptyForm });
  const [creating, setCreating] = useState(false);
  const [newSession, setNewSession] = useState<RdSession | null>(null);
  const [previewToken, setPreviewToken] = useState('');
  const [previewView, setPreviewView] = useState('cascade');
  const [previewData, setPreviewData] = useState<any>(null);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [msg, setMsg] = useState('');

  const loadSessions = useCallback(async () => {
    try {
      const data = await api.listResearchDaySessions(token, tenantSlug);
      setSessions(Array.isArray(data) ? data : []);
    } catch {
      setSessions([]);
    }
  }, [token, tenantSlug]);

  useEffect(() => {
    if (tab === 'sessions') loadSessions();
  }, [tab, loadSessions]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (form.allowedViews.length === 0) { setMsg('Select at least one view.'); return; }
    setCreating(true);
    setMsg('');
    try {
      const session = await api.createResearchDaySession(form, token, tenantSlug);
      setNewSession(session);
      setTab('sessions');
    } catch (err: any) {
      setMsg(err.message ?? 'Failed');
    } finally {
      setCreating(false);
    }
  }

  async function handlePreview() {
    if (!previewToken) { setMsg('Enter a token.'); return; }
    setLoadingPreview(true);
    setMsg('');
    try {
      const data = await api.viewResearchDayDashboard(previewToken, previewView, tenantSlug);
      setPreviewData(data);
    } catch (err: any) {
      setMsg(err.message ?? 'Invalid token or view.');
      setPreviewData(null);
    } finally {
      setLoadingPreview(false);
    }
  }

  function toggleView(view: string) {
    setForm(f => ({
      ...f,
      allowedViews: f.allowedViews.includes(view)
        ? f.allowedViews.filter(v => v !== view)
        : [...f.allowedViews, view],
    }));
  }

  const tabStyle = (active: boolean): React.CSSProperties => ({
    padding: '8px 20px',
    border: 'none',
    borderBottom: active ? '2px solid #2563eb' : '2px solid transparent',
    background: 'none',
    cursor: 'pointer',
    fontWeight: active ? 600 : 400,
    color: active ? '#2563eb' : '#6b7280',
    fontSize: 14,
  });

  return (
    <div style={{ padding: 24, maxWidth: 900 }}>
      <h2 style={{ margin: '0 0 4px' }}>Research Day Portal</h2>
      <p style={{ margin: '0 0 20px', color: '#6b7280', fontSize: 14 }}>
        Create time-limited, token-gated sessions for external researchers — no login required.
      </p>

      <div style={{ borderBottom: '1px solid #e5e7eb', marginBottom: 24 }}>
        <button style={tabStyle(tab === 'sessions')} onClick={() => setTab('sessions')}>Sessions</button>
        <button style={tabStyle(tab === 'create')} onClick={() => setTab('create')}>Create Session</button>
        <button style={tabStyle(tab === 'preview')} onClick={() => setTab('preview')}>Preview / Test</button>
      </div>

      {msg && (
        <div style={{ marginBottom: 16, padding: '10px 16px', borderRadius: 6, background: '#fef2f2', color: '#991b1b', border: '1px solid #fecaca' }}>
          {msg}
        </div>
      )}

      {tab === 'sessions' && (
        <>
          {newSession && (
            <div style={{ marginBottom: 20, padding: 16, background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 8 }}>
              <div style={{ fontWeight: 600, color: '#166534', marginBottom: 8 }}>Session created: {newSession.session_name}</div>
              <div style={{ fontSize: 13, color: '#374151', marginBottom: 4 }}>Share URL:</div>
              <code style={{ fontSize: 12, background: '#dcfce7', padding: '4px 8px', borderRadius: 4, wordBreak: 'break-all' }}>
                {window.location.origin}{newSession.shareUrl}
              </code>
              <button onClick={() => { navigator.clipboard.writeText(window.location.origin + newSession.shareUrl); }} style={{ marginLeft: 10, padding: '4px 10px', fontSize: 12, border: '1px solid #16a34a', borderRadius: 4, background: '#fff', cursor: 'pointer', color: '#16a34a' }}>Copy</button>
            </div>
          )}

          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 12 }}>
            <button onClick={() => setTab('create')} style={{ padding: '8px 16px', background: '#2563eb', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 13 }}>+ New Session</button>
          </div>

          {sessions.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 48, color: '#9ca3af' }}>No sessions yet</div>
          ) : (
            <div style={{ display: 'grid', gap: 12 }}>
              {sessions.map(s => {
                const expired = new Date(s.valid_until) < new Date();
                return (
                  <div key={s.id} style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 10, padding: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div>
                      <div style={{ fontWeight: 600, marginBottom: 4 }}>{s.session_name}</div>
                      <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 6 }}>
                        {new Date(s.valid_from).toLocaleDateString()} – {new Date(s.valid_until).toLocaleDateString()}
                        {' · '}
                        {s.access_count} access{s.access_count !== 1 ? 'es' : ''}
                      </div>
                      <div style={{ display: 'flex', gap: 6 }}>
                        {s.allowed_views.map(v => (
                          <span key={v} style={{ padding: '2px 8px', borderRadius: 12, fontSize: 11, background: '#eff6ff', color: '#2563eb' }}>{v}</span>
                        ))}
                      </div>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 8 }}>
                      <span style={{ padding: '3px 10px', borderRadius: 12, fontSize: 12, fontWeight: 600, background: expired ? '#fef2f2' : '#f0fdf4', color: expired ? '#dc2626' : '#16a34a' }}>
                        {expired ? 'Expired' : 'Active'}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      {tab === 'create' && (
        <form onSubmit={handleCreate} style={{ maxWidth: 480 }}>
          <div style={{ display: 'grid', gap: 14 }}>
            <div>
              <label style={{ display: 'block', fontSize: 12, marginBottom: 4, color: '#374151', fontWeight: 500 }}>Session Name</label>
              <input
                required
                value={form.sessionName}
                onChange={e => setForm(f => ({ ...f, sessionName: e.target.value }))}
                placeholder="e.g. CROI 2026 Research Day"
                style={{ width: '100%', padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: 6, fontSize: 14, boxSizing: 'border-box' }}
              />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div>
                <label style={{ display: 'block', fontSize: 12, marginBottom: 4, color: '#374151', fontWeight: 500 }}>Valid From</label>
                <input
                  required type="datetime-local"
                  value={form.validFrom}
                  onChange={e => setForm(f => ({ ...f, validFrom: e.target.value }))}
                  style={{ width: '100%', padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: 6, fontSize: 14, boxSizing: 'border-box' }}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 12, marginBottom: 4, color: '#374151', fontWeight: 500 }}>Valid Until</label>
                <input
                  required type="datetime-local"
                  value={form.validUntil}
                  onChange={e => setForm(f => ({ ...f, validUntil: e.target.value }))}
                  style={{ width: '100%', padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: 6, fontSize: 14, boxSizing: 'border-box' }}
                />
              </div>
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 12, marginBottom: 8, color: '#374151', fontWeight: 500 }}>Allowed Views</label>
              <div style={{ display: 'flex', gap: 10 }}>
                {VIEW_OPTIONS.map(v => (
                  <label key={v} style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontSize: 14 }}>
                    <input
                      type="checkbox"
                      checked={form.allowedViews.includes(v)}
                      onChange={() => toggleView(v)}
                    />
                    {v.charAt(0).toUpperCase() + v.slice(1)}
                  </label>
                ))}
              </div>
            </div>
          </div>
          <button
            type="submit"
            disabled={creating}
            style={{ marginTop: 20, padding: '10px 24px', background: '#2563eb', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 14 }}
          >
            {creating ? 'Creating…' : 'Create Session'}
          </button>
        </form>
      )}

      {tab === 'preview' && (
        <div style={{ maxWidth: 560 }}>
          <p style={{ fontSize: 14, color: '#6b7280', marginBottom: 16 }}>
            Test a research day token by entering it below and selecting a view.
          </p>
          <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
            <input
              value={previewToken}
              onChange={e => setPreviewToken(e.target.value)}
              placeholder="Access token"
              style={{ flex: 1, padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: 6, fontSize: 13, minWidth: 200 }}
            />
            <select
              value={previewView}
              onChange={e => setPreviewView(e.target.value)}
              style={{ padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: 6, fontSize: 13 }}
            >
              {VIEW_OPTIONS.map(v => <option key={v} value={v}>{v}</option>)}
            </select>
            <button
              onClick={handlePreview}
              disabled={loadingPreview}
              style={{ padding: '8px 16px', background: '#2563eb', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 13 }}
            >
              {loadingPreview ? 'Loading…' : 'Preview'}
            </button>
          </div>

          {previewData && (
            <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 10, padding: 16 }}>
              <div style={{ fontWeight: 600, marginBottom: 8 }}>{previewData.sessionName}</div>
              <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 12 }}>
                Expires: {new Date(previewData.validUntil).toLocaleString()}
              </div>
              <pre style={{ fontSize: 11, background: '#f9fafb', padding: 12, borderRadius: 6, overflow: 'auto', maxHeight: 400 }}>
                {JSON.stringify(previewData.data, null, 2)}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
