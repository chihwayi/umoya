import React, { useState, useEffect, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { ehrAxios } from '../services/api';

interface ResearchQuery {
  id: string;
  name: string;
  description?: string;
  ethics_reference: string;
  institution: string;
  principal_investigator: string;
  permitted_fields: string[];
  cohort_definition: any;
  status: string;
  created_at: string;
  tokens_issued: number;
  tokens_active: number;
  tokens_expired: number;
}

interface AuditEntry {
  accessed_at: string;
  query_name: string;
  ethics_reference: string;
  institution: string;
  researcher_email: string;
  token_used: string;
  record_count: number;
  export_format: string;
}

const PERMITTED_FIELD_OPTIONS = [
  'icd10_codes', 'lab_results', 'medications', 'vital_signs',
  'encounter_type', 'district', 'province',
];

const VALID_HOURS_OPTIONS = [24, 48, 72, 168];
const MAX_USES_OPTIONS = [1, 3, 5, 10];

export default function ResearchPortalAdmin() {
  const { tenantSlug } = useParams<{ tenantSlug: string }>();
  const token = localStorage.getItem('ehr_token');
  const hdrs = { Authorization: `Bearer ${token}`, 'x-tenant-id': tenantSlug ?? '' };

  const [tab, setTab] = useState<'queries' | 'audit'>('queries');
  const [queries, setQueries] = useState<ResearchQuery[]>([]);
  const [audit, setAudit] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [showNewQueryModal, setShowNewQueryModal] = useState(false);
  const [showTokenModal, setShowTokenModal] = useState<string | null>(null);
  const [newTokenResult, setNewTokenResult] = useState<{ token: string; expires_at: string } | null>(null);

  const [queryForm, setQueryForm] = useState({
    name: '',
    description: '',
    ethics_reference: '',
    institution: '',
    principal_investigator: '',
    permitted_fields: [] as string[],
    conditions: '',
    sex: '',
    period_start: '',
    period_end: '',
    min_records: '10',
  });

  const [tokenForm, setTokenForm] = useState({
    researcher_email: '',
    valid_hours: 72,
    max_uses: 3,
  });

  const loadQueries = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data } = await ehrAxios.get(`/tenants/${tenantSlug}/research/portal/queries`, { headers: hdrs });
      setQueries(Array.isArray(data) ? data : []);
    } catch (e: any) {
      setError(e.response?.data?.message ?? e.message ?? 'Failed to load queries');
    } finally {
      setLoading(false);
    }
  }, [tenantSlug, token]);

  const loadAudit = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data } = await ehrAxios.get(`/tenants/${tenantSlug}/research/portal/audit`, { headers: hdrs });
      setAudit(Array.isArray(data) ? data : []);
    } catch (e: any) {
      setError(e.response?.data?.message ?? e.message ?? 'Failed to load audit');
    } finally {
      setLoading(false);
    }
  }, [tenantSlug, token]);

  useEffect(() => {
    if (tab === 'queries') loadQueries();
    else loadAudit();
  }, [tab, loadQueries, loadAudit]);

  async function submitNewQuery() {
    if (!queryForm.name || !queryForm.ethics_reference || !queryForm.institution || !queryForm.principal_investigator) {
      setError('Name, ethics reference, institution and PI are required');
      return;
    }
    try {
      await ehrAxios.post(
        `/tenants/${tenantSlug}/research/portal/queries`,
        {
          name: queryForm.name,
          description: queryForm.description || undefined,
          ethics_reference: queryForm.ethics_reference,
          institution: queryForm.institution,
          principal_investigator: queryForm.principal_investigator,
          permitted_fields: queryForm.permitted_fields,
          cohort_definition: {
            conditions: queryForm.conditions ? queryForm.conditions.split(',').map(s => s.trim()) : undefined,
            sex: queryForm.sex || undefined,
            period_start: queryForm.period_start || undefined,
            period_end: queryForm.period_end || undefined,
            min_records: parseInt(queryForm.min_records) || 10,
          },
        },
        { headers: hdrs },
      );
      setShowNewQueryModal(false);
      setQueryForm({
        name: '', description: '', ethics_reference: '', institution: '',
        principal_investigator: '', permitted_fields: [], conditions: '',
        sex: '', period_start: '', period_end: '', min_records: '10',
      });
      loadQueries();
    } catch (e: any) {
      setError(e.response?.data?.message ?? e.message ?? 'Failed to create query');
    }
  }

  async function submitIssueToken(queryId: string) {
    if (!tokenForm.researcher_email) {
      setError('Researcher email is required');
      return;
    }
    try {
      const q = queries.find(q => q.id === queryId);
      const { data } = await ehrAxios.post(
        `/tenants/${tenantSlug}/research/portal/tokens`,
        {
          query_id: queryId,
          researcher_email: tokenForm.researcher_email,
          valid_hours: tokenForm.valid_hours,
          max_uses: tokenForm.max_uses,
          ethics_ref: q?.ethics_reference,
        },
        { headers: hdrs },
      );
      setNewTokenResult(data);
      setTokenForm({ researcher_email: '', valid_hours: 72, max_uses: 3 });
    } catch (e: any) {
      setError(e.response?.data?.message ?? e.message ?? 'Failed to issue token');
    }
  }

  const togglePermittedField = (field: string) => {
    setQueryForm(f => ({
      ...f,
      permitted_fields: f.permitted_fields.includes(field)
        ? f.permitted_fields.filter(x => x !== field)
        : [...f.permitted_fields, field],
    }));
  };

  return (
    <div style={{ padding: '24px', fontFamily: 'Inter, sans-serif', maxWidth: 960, margin: '0 auto' }}>
      <div style={{ marginBottom: 24 }}>
        <h2 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: '#0f172a' }}>
          Research Data Portal
        </h2>
        <p style={{ margin: '4px 0 0', color: '#64748b', fontSize: 14 }}>
          Manage de-identified research exports — HIPAA Safe Harbor + Zimbabwe CDPA compliant
        </p>
      </div>

      {error && (
        <div style={{ background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: 8, padding: '12px 16px', marginBottom: 16, color: '#dc2626', fontSize: 14 }}>
          {error}
          <button onClick={() => setError(null)} style={{ float: 'right', background: 'none', border: 'none', cursor: 'pointer', color: '#dc2626' }}>✕</button>
        </div>
      )}

      <div style={{ display: 'flex', gap: 8, marginBottom: 20, borderBottom: '1px solid #e2e8f0' }}>
        {(['queries', 'audit'] as const).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            style={{
              padding: '8px 18px', border: 'none', background: 'none', cursor: 'pointer',
              fontSize: 14, fontWeight: 600,
              color: tab === t ? '#1d4ed8' : '#64748b',
              borderBottom: tab === t ? '2px solid #1d4ed8' : '2px solid transparent',
            }}
          >
            {t === 'queries' ? 'Active Queries' : 'Access Audit'}
          </button>
        ))}
      </div>

      {tab === 'queries' && (
        <>
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 16 }}>
            <button
              onClick={() => setShowNewQueryModal(true)}
              style={{ background: '#1d4ed8', color: '#fff', border: 'none', borderRadius: 8, padding: '8px 18px', cursor: 'pointer', fontSize: 14, fontWeight: 600 }}
            >
              + New Research Query
            </button>
          </div>

          {loading && <p style={{ color: '#64748b', textAlign: 'center' }}>Loading queries…</p>}

          {queries.length === 0 && !loading && (
            <div style={{ textAlign: 'center', padding: 48, color: '#94a3b8' }}>
              <p style={{ fontSize: 16 }}>No research queries yet.</p>
              <p style={{ fontSize: 13 }}>Create one to enable de-identified data exports for researchers.</p>
            </div>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {queries.map(q => (
              <div key={q.id} style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 10, padding: '18px 20px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <p style={{ margin: 0, fontWeight: 700, fontSize: 15, color: '#0f172a' }}>{q.name}</p>
                    <p style={{ margin: '2px 0 0', fontSize: 13, color: '#64748b' }}>
                      Ethics: <strong>{q.ethics_reference}</strong> · PI: {q.principal_investigator} · {q.institution}
                    </p>
                  </div>
                  <button
                    onClick={() => { setShowTokenModal(q.id); setNewTokenResult(null); }}
                    style={{ background: '#f0fdf4', color: '#166534', border: '1px solid #86efac', borderRadius: 6, padding: '6px 14px', cursor: 'pointer', fontSize: 13, fontWeight: 600, whiteSpace: 'nowrap' }}
                  >
                    Issue Token
                  </button>
                </div>
                <div style={{ marginTop: 10, display: 'flex', gap: 16, fontSize: 13, color: '#475569' }}>
                  <span>Tokens issued: <strong>{q.tokens_issued ?? 0}</strong></span>
                  <span>Active: <strong style={{ color: '#16a34a' }}>{q.tokens_active ?? 0}</strong></span>
                  <span>Expired: <strong style={{ color: '#dc2626' }}>{q.tokens_expired ?? 0}</strong></span>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {tab === 'audit' && (
        <>
          {loading && <p style={{ color: '#64748b', textAlign: 'center' }}>Loading audit log…</p>}
          {audit.length === 0 && !loading && (
            <p style={{ textAlign: 'center', color: '#94a3b8' }}>No access events recorded yet.</p>
          )}
          {audit.length > 0 && (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ background: '#f8fafc', color: '#475569' }}>
                    {['Date / Time', 'Query', 'Researcher', 'Records', 'Format'].map(h => (
                      <th key={h} style={{ padding: '10px 12px', textAlign: 'left', borderBottom: '1px solid #e2e8f0', fontWeight: 600 }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {audit.map((a, i) => (
                    <tr key={i} style={{ borderBottom: '1px solid #f1f5f9' }}>
                      <td style={{ padding: '10px 12px', color: '#334155' }}>{new Date(a.accessed_at).toLocaleString()}</td>
                      <td style={{ padding: '10px 12px' }}>
                        <div style={{ fontWeight: 600, color: '#0f172a' }}>{a.query_name}</div>
                        <div style={{ color: '#94a3b8', fontSize: 12 }}>{a.ethics_reference}</div>
                      </td>
                      <td style={{ padding: '10px 12px', color: '#334155' }}>{a.researcher_email}</td>
                      <td style={{ padding: '10px 12px', color: '#334155' }}>{a.record_count.toLocaleString()}</td>
                      <td style={{ padding: '10px 12px' }}>
                        <span style={{ background: a.export_format === 'csv' ? '#ecfdf5' : '#eff6ff', color: a.export_format === 'csv' ? '#166534' : '#1d4ed8', borderRadius: 4, padding: '2px 8px', fontSize: 12, fontWeight: 600 }}>
                          {a.export_format.toUpperCase()}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {/* New Query Modal */}
      {showNewQueryModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: '#fff', borderRadius: 12, padding: 28, width: 580, maxHeight: '90vh', overflowY: 'auto' }}>
            <h3 style={{ margin: '0 0 20px', fontSize: 18, fontWeight: 700 }}>New Research Query</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {[
                { label: 'Query Name *', key: 'name' },
                { label: 'Ethics Reference *', key: 'ethics_reference', placeholder: 'e.g. MRCZ/B/2401' },
                { label: 'Institution *', key: 'institution' },
                { label: 'Principal Investigator *', key: 'principal_investigator' },
                { label: 'Description', key: 'description' },
              ].map(f => (
                <div key={f.key}>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 4 }}>{f.label}</label>
                  <input
                    value={(queryForm as any)[f.key]}
                    onChange={e => setQueryForm(prev => ({ ...prev, [f.key]: e.target.value }))}
                    placeholder={(f as any).placeholder ?? ''}
                    style={{ width: '100%', border: '1px solid #d1d5db', borderRadius: 6, padding: '8px 10px', fontSize: 14, boxSizing: 'border-box' }}
                  />
                </div>
              ))}
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 6 }}>Permitted Fields</label>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  {PERMITTED_FIELD_OPTIONS.map(f => (
                    <button
                      key={f}
                      onClick={() => togglePermittedField(f)}
                      style={{
                        padding: '4px 12px', borderRadius: 6, cursor: 'pointer', fontSize: 13,
                        background: queryForm.permitted_fields.includes(f) ? '#1d4ed8' : '#f1f5f9',
                        color: queryForm.permitted_fields.includes(f) ? '#fff' : '#475569',
                        border: '1px solid ' + (queryForm.permitted_fields.includes(f) ? '#1d4ed8' : '#e2e8f0'),
                      }}
                    >
                      {queryForm.permitted_fields.includes(f) ? '✓ ' : ''}{f}
                    </button>
                  ))}
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 4 }}>ICD-10 Conditions (comma-separated)</label>
                  <input value={queryForm.conditions} onChange={e => setQueryForm(f => ({ ...f, conditions: e.target.value }))}
                    placeholder="e.g. E10, B20" style={{ width: '100%', border: '1px solid #d1d5db', borderRadius: 6, padding: '8px 10px', fontSize: 14, boxSizing: 'border-box' }} />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 4 }}>Sex</label>
                  <select value={queryForm.sex} onChange={e => setQueryForm(f => ({ ...f, sex: e.target.value }))}
                    style={{ width: '100%', border: '1px solid #d1d5db', borderRadius: 6, padding: '8px 10px', fontSize: 14 }}>
                    <option value="">All</option>
                    <option value="M">Male</option>
                    <option value="F">Female</option>
                  </select>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 4 }}>Period Start</label>
                  <input type="date" value={queryForm.period_start} onChange={e => setQueryForm(f => ({ ...f, period_start: e.target.value }))}
                    style={{ width: '100%', border: '1px solid #d1d5db', borderRadius: 6, padding: '8px 10px', fontSize: 14, boxSizing: 'border-box' }} />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 4 }}>Period End</label>
                  <input type="date" value={queryForm.period_end} onChange={e => setQueryForm(f => ({ ...f, period_end: e.target.value }))}
                    style={{ width: '100%', border: '1px solid #d1d5db', borderRadius: 6, padding: '8px 10px', fontSize: 14, boxSizing: 'border-box' }} />
                </div>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 4 }}>Min Records (suppress if below — re-id risk)</label>
                <input type="number" value={queryForm.min_records} onChange={e => setQueryForm(f => ({ ...f, min_records: e.target.value }))}
                  style={{ width: 120, border: '1px solid #d1d5db', borderRadius: 6, padding: '8px 10px', fontSize: 14 }} />
              </div>
            </div>
            <div style={{ display: 'flex', gap: 10, marginTop: 20, justifyContent: 'flex-end' }}>
              <button onClick={() => setShowNewQueryModal(false)}
                style={{ background: '#f1f5f9', color: '#334155', border: 'none', borderRadius: 8, padding: '8px 18px', cursor: 'pointer', fontSize: 14 }}>
                Cancel
              </button>
              <button onClick={submitNewQuery}
                style={{ background: '#1d4ed8', color: '#fff', border: 'none', borderRadius: 8, padding: '8px 18px', cursor: 'pointer', fontSize: 14, fontWeight: 600 }}>
                Create Query
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Issue Token Modal */}
      {showTokenModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: '#fff', borderRadius: 12, padding: 28, width: 480 }}>
            {newTokenResult ? (
              <>
                <h3 style={{ margin: '0 0 12px', fontSize: 17, fontWeight: 700, color: '#166534' }}>Token Issued Successfully</h3>
                <p style={{ margin: '0 0 8px', fontSize: 13, color: '#374151' }}>Share this token with the researcher. <strong>It will not be shown again.</strong></p>
                <div style={{ background: '#f0fdf4', border: '1px solid #86efac', borderRadius: 8, padding: '12px 14px', fontFamily: 'monospace', fontSize: 13, wordBreak: 'break-all', marginBottom: 12 }}>
                  {newTokenResult.token}
                </div>
                <p style={{ margin: '0 0 16px', fontSize: 12, color: '#64748b' }}>Expires: {new Date(newTokenResult.expires_at).toLocaleString()}</p>
                <button onClick={() => { setShowTokenModal(null); setNewTokenResult(null); loadQueries(); }}
                  style={{ background: '#1d4ed8', color: '#fff', border: 'none', borderRadius: 8, padding: '8px 18px', cursor: 'pointer', fontSize: 14, fontWeight: 600 }}>
                  Done
                </button>
              </>
            ) : (
              <>
                <h3 style={{ margin: '0 0 20px', fontSize: 17, fontWeight: 700 }}>Issue Research Portal Token</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                  <div>
                    <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 4 }}>Researcher Email *</label>
                    <input
                      type="email" value={tokenForm.researcher_email}
                      onChange={e => setTokenForm(f => ({ ...f, researcher_email: e.target.value }))}
                      placeholder="researcher@institution.ac.zw"
                      style={{ width: '100%', border: '1px solid #d1d5db', borderRadius: 6, padding: '8px 10px', fontSize: 14, boxSizing: 'border-box' }} />
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                    <div>
                      <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 4 }}>Valid For</label>
                      <select value={tokenForm.valid_hours} onChange={e => setTokenForm(f => ({ ...f, valid_hours: parseInt(e.target.value) }))}
                        style={{ width: '100%', border: '1px solid #d1d5db', borderRadius: 6, padding: '8px 10px', fontSize: 14 }}>
                        {VALID_HOURS_OPTIONS.map(h => (
                          <option key={h} value={h}>{h < 24 ? `${h}h` : `${h / 24} day${h / 24 > 1 ? 's' : ''}`}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 4 }}>Max Uses</label>
                      <select value={tokenForm.max_uses} onChange={e => setTokenForm(f => ({ ...f, max_uses: parseInt(e.target.value) }))}
                        style={{ width: '100%', border: '1px solid #d1d5db', borderRadius: 6, padding: '8px 10px', fontSize: 14 }}>
                        {MAX_USES_OPTIONS.map(u => <option key={u} value={u}>{u}</option>)}
                      </select>
                    </div>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 10, marginTop: 20, justifyContent: 'flex-end' }}>
                  <button onClick={() => setShowTokenModal(null)}
                    style={{ background: '#f1f5f9', color: '#334155', border: 'none', borderRadius: 8, padding: '8px 18px', cursor: 'pointer', fontSize: 14 }}>
                    Cancel
                  </button>
                  <button onClick={() => submitIssueToken(showTokenModal)}
                    style={{ background: '#166534', color: '#fff', border: 'none', borderRadius: 8, padding: '8px 18px', cursor: 'pointer', fontSize: 14, fontWeight: 600 }}>
                    Generate Token
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
