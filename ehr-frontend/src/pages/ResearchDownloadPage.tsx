import React, { useState } from 'react';

const API_BASE = (import.meta as any).env?.VITE_API_URL ?? '';

interface QueryMeta {
  name: string;
  ethics_reference: string;
  institution: string;
  principal_investigator: string;
  permitted_fields: string[];
}

interface CohortSummary {
  total_records: number;
  period_start?: string;
  period_end?: string;
  suppressed?: boolean;
  reason?: string;
}

interface DatasetResult {
  records: any[];
  cohort_summary: CohortSummary;
  query: QueryMeta;
}

interface DictionaryField {
  name: string;
  type: string;
  description: string;
  values?: string[];
}

type Step = 'token' | 'preview' | 'dictionary';

function formatBytes(bytes: number): string {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

export default function ResearchDownloadPage() {
  const [tokenInput, setTokenInput] = useState('');
  const [queryId, setQueryId] = useState('');
  const [step, setStep] = useState<Step>('token');
  const [result, setResult] = useState<DatasetResult | null>(null);
  const [dictionary, setDictionary] = useState<DictionaryField[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [downloading, setDownloading] = useState<'csv' | 'json' | null>(null);

  const baseUrl = `${API_BASE}/api/research/portal/query/${queryId}`;

  async function accessDataset() {
    const trimmed = tokenInput.trim();
    if (!trimmed) { setError('Please enter a research access token'); return; }
    const parts = trimmed.split('?query=');
    const token = parts[0];
    const qid = parts[1] ?? queryId;
    if (!qid) { setError('Please also enter the Query ID (from the URL provided to you)'); return; }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/api/research/portal/query/${qid}?token=${encodeURIComponent(token)}`);
      if (!res.ok) {
        const body = await res.json().catch(() => ({ message: res.statusText }));
        throw new Error(body.message ?? 'Access denied');
      }
      const data: DatasetResult = await res.json();
      setResult(data);
      setQueryId(qid);
      setTokenInput(token);
      setStep('preview');
    } catch (e: any) {
      setError(e.message ?? 'Failed to access dataset');
    } finally {
      setLoading(false);
    }
  }

  async function downloadCsv() {
    setDownloading('csv');
    try {
      const res = await fetch(`${baseUrl}/csv?token=${encodeURIComponent(tokenInput)}`);
      if (!res.ok) throw new Error('Download failed');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `research-dataset-${queryId}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e: any) {
      setError(e.message ?? 'CSV download failed');
    } finally {
      setDownloading(null);
    }
  }

  async function downloadJson() {
    setDownloading('json');
    try {
      if (!result) return;
      const json = JSON.stringify(result, null, 2);
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `research-dataset-${queryId}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e: any) {
      setError(e.message ?? 'JSON download failed');
    } finally {
      setDownloading(null);
    }
  }

  async function loadDictionary() {
    setLoading(true);
    try {
      const res = await fetch(`${baseUrl}/data-dictionary?token=${encodeURIComponent(tokenInput)}`);
      const data = await res.json();
      setDictionary(data.fields ?? []);
      setStep('dictionary');
    } catch (e: any) {
      setError(e.message ?? 'Failed to load data dictionary');
    } finally {
      setLoading(false);
    }
  }

  const estimatedCsvBytes = result ? JSON.stringify(result.records).length * 0.7 : 0;
  const estimatedJsonBytes = result ? JSON.stringify(result.records, null, 2).length : 0;

  return (
    <div style={{
      minHeight: '100vh', background: '#f8fafc', display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontFamily: 'Inter, -apple-system, sans-serif', padding: 24,
    }}>
      <div style={{ width: '100%', maxWidth: 600 }}>
        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
            <div style={{ background: '#1d4ed8', borderRadius: 8, width: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <span style={{ color: '#fff', fontSize: 18, fontWeight: 700 }}>U</span>
            </div>
            <span style={{ fontSize: 20, fontWeight: 700, color: '#0f172a' }}>UMOYA</span>
          </div>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: '#0f172a' }}>Research Data Portal</h1>
          <p style={{ margin: '6px 0 0', color: '#64748b', fontSize: 14 }}>Secure, de-identified clinical data exports</p>
        </div>

        {error && (
          <div style={{ background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: 8, padding: '12px 16px', marginBottom: 16, color: '#dc2626', fontSize: 14 }}>
            {error}
            <button onClick={() => setError(null)} style={{ float: 'right', background: 'none', border: 'none', cursor: 'pointer', color: '#dc2626', fontSize: 16, lineHeight: 1 }}>✕</button>
          </div>
        )}

        {step === 'token' && (
          <div style={{ background: '#fff', borderRadius: 12, boxShadow: '0 1px 8px rgba(0,0,0,0.08)', padding: 28 }}>
            <p style={{ margin: '0 0 16px', fontSize: 14, color: '#374151' }}>
              Enter your research access token (provided by the facility medical director):
            </p>
            <div style={{ marginBottom: 12 }}>
              <input
                value={tokenInput}
                onChange={e => setTokenInput(e.target.value)}
                placeholder="rpt_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
                style={{ width: '100%', border: '1px solid #d1d5db', borderRadius: 8, padding: '10px 14px', fontSize: 14, boxSizing: 'border-box', fontFamily: 'monospace' }}
              />
            </div>
            <div style={{ marginBottom: 20 }}>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 4 }}>Query ID</label>
              <input
                value={queryId}
                onChange={e => setQueryId(e.target.value)}
                placeholder="qry_xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                style={{ width: '100%', border: '1px solid #d1d5db', borderRadius: 8, padding: '10px 14px', fontSize: 14, boxSizing: 'border-box', fontFamily: 'monospace' }}
              />
              <p style={{ margin: '4px 0 0', fontSize: 12, color: '#94a3b8' }}>Both the token and query ID are provided by the data custodian.</p>
            </div>
            <button
              onClick={accessDataset}
              disabled={loading}
              style={{ width: '100%', background: loading ? '#94a3b8' : '#1d4ed8', color: '#fff', border: 'none', borderRadius: 8, padding: '11px', cursor: loading ? 'default' : 'pointer', fontSize: 15, fontWeight: 600 }}
            >
              {loading ? 'Validating…' : 'Access Dataset'}
            </button>
          </div>
        )}

        {step === 'preview' && result && (
          <div style={{ background: '#fff', borderRadius: 12, boxShadow: '0 1px 8px rgba(0,0,0,0.08)', padding: 28 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
              <div style={{ background: '#dcfce7', borderRadius: 999, width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15 }}>✅</div>
              <div>
                <p style={{ margin: 0, fontWeight: 700, fontSize: 15, color: '#0f172a' }}>Token valid</p>
              </div>
            </div>

            <div style={{ borderTop: '1px solid #f1f5f9', paddingTop: 16, marginBottom: 16 }}>
              <h2 style={{ margin: '0 0 6px', fontSize: 17, fontWeight: 700, color: '#0f172a' }}>{result.query.name}</h2>
              <p style={{ margin: '0 0 4px', fontSize: 13, color: '#475569' }}>
                Ethics: <strong>{result.query.ethics_reference}</strong>
              </p>
              <p style={{ margin: 0, fontSize: 13, color: '#475569' }}>
                PI: {result.query.principal_investigator} · {result.query.institution}
              </p>
            </div>

            {result.cohort_summary.suppressed ? (
              <div style={{ background: '#fffbeb', border: '1px solid #fcd34d', borderRadius: 8, padding: '12px 14px', marginBottom: 16, color: '#92400e', fontSize: 14 }}>
                ⚠ Cohort suppressed: {result.cohort_summary.reason}
              </div>
            ) : (
              <div style={{ background: '#f8fafc', borderRadius: 8, padding: '14px 16px', marginBottom: 16 }}>
                <p style={{ margin: '0 0 4px', fontWeight: 600, color: '#0f172a', fontSize: 14 }}>Cohort Summary</p>
                <p style={{ margin: '0 0 2px', fontSize: 13, color: '#475569' }}>
                  <strong>{result.cohort_summary.total_records.toLocaleString()}</strong> de-identified patient records
                </p>
                {(result.cohort_summary.period_start || result.cohort_summary.period_end) && (
                  <p style={{ margin: '0 0 2px', fontSize: 13, color: '#475569' }}>
                    Period: {result.cohort_summary.period_start} to {result.cohort_summary.period_end}
                  </p>
                )}
                <p style={{ margin: '4px 0 0', fontSize: 13, color: '#475569' }}>
                  Fields: {result.query.permitted_fields.join(', ')}
                </p>
              </div>
            )}

            <div style={{ background: '#f0f9ff', border: '1px solid #bae6fd', borderRadius: 8, padding: '12px 14px', marginBottom: 20, fontSize: 13, color: '#0c4a6e' }}>
              <p style={{ margin: '0 0 4px', fontWeight: 700 }}>De-identification: HIPAA Safe Harbor</p>
              <p style={{ margin: '0 0 2px' }}>• 18 identifying fields removed (name, DOB, national ID, phone, address, facility)</p>
              <p style={{ margin: '0 0 2px' }}>• Dates shifted by a consistent random offset per patient (intervals preserved)</p>
              <p style={{ margin: 0 }}>• Location generalised to district level</p>
            </div>

            {!result.cohort_summary.suppressed && (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
                <button
                  onClick={downloadCsv}
                  disabled={downloading !== null}
                  style={{ background: downloading === 'csv' ? '#94a3b8' : '#059669', color: '#fff', border: 'none', borderRadius: 8, padding: '11px', cursor: downloading ? 'default' : 'pointer', fontSize: 14, fontWeight: 600 }}
                >
                  {downloading === 'csv' ? 'Downloading…' : `⬇ CSV (${formatBytes(estimatedCsvBytes)})`}
                </button>
                <button
                  onClick={downloadJson}
                  disabled={downloading !== null}
                  style={{ background: downloading === 'json' ? '#94a3b8' : '#1d4ed8', color: '#fff', border: 'none', borderRadius: 8, padding: '11px', cursor: downloading ? 'default' : 'pointer', fontSize: 14, fontWeight: 600 }}
                >
                  {downloading === 'json' ? 'Downloading…' : `⬇ JSON (${formatBytes(estimatedJsonBytes)})`}
                </button>
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <button
                onClick={loadDictionary}
                disabled={loading}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#1d4ed8', fontSize: 13, fontWeight: 600, textDecoration: 'underline' }}
              >
                View Field Descriptions (Data Dictionary)
              </button>
              <button
                onClick={() => { setStep('token'); setResult(null); setTokenInput(''); setQueryId(''); }}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', fontSize: 13 }}
              >
                Use different token
              </button>
            </div>

            <p style={{ margin: '16px 0 0', fontSize: 11, color: '#94a3b8', borderTop: '1px solid #f1f5f9', paddingTop: 12 }}>
              Terms of use: Data may not be re-identified. Any attempt to re-identify individuals is prohibited under the Zimbabwe Data Protection Act 2021.
              Please cite: <em>Umoya EHR, de-identified clinical data export, {new Date().getFullYear()}</em>.
            </p>
          </div>
        )}

        {step === 'dictionary' && dictionary && (
          <div style={{ background: '#fff', borderRadius: 12, boxShadow: '0 1px 8px rgba(0,0,0,0.08)', padding: 28 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: '#0f172a' }}>Data Dictionary</h2>
              <button onClick={() => setStep('preview')}
                style={{ background: '#f1f5f9', border: 'none', borderRadius: 6, padding: '6px 14px', cursor: 'pointer', color: '#334155', fontSize: 13 }}>
                ← Back
              </button>
            </div>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ background: '#f8fafc' }}>
                  {['Field', 'Type', 'Description'].map(h => (
                    <th key={h} style={{ padding: '9px 12px', textAlign: 'left', borderBottom: '2px solid #e2e8f0', fontWeight: 600, color: '#475569' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {dictionary.map((f, i) => (
                  <tr key={i} style={{ borderBottom: '1px solid #f1f5f9' }}>
                    <td style={{ padding: '9px 12px', fontFamily: 'monospace', color: '#1d4ed8', fontWeight: 600 }}>{f.name}</td>
                    <td style={{ padding: '9px 12px', color: '#64748b' }}>{f.type}</td>
                    <td style={{ padding: '9px 12px', color: '#334155' }}>
                      {f.description}
                      {f.values && <span style={{ color: '#94a3b8', fontSize: 12 }}> [{f.values.join(', ')}]</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
