import React, { useState, useEffect, useCallback } from 'react';
import { ehrApi as api } from '../services/api';

interface AdverseEvent {
  id: string;
  patient_id: string;
  suspect_drug: string;
  event_description: string;
  event_severity: string;
  event_outcome: string;
  causality: string;
  reported_by: string;
  report_date: string;
  vigibase_exported: boolean;
}

const SEVERITY_COLOURS: Record<string, string> = {
  mild: '#16a34a',
  moderate: '#d97706',
  severe: '#dc2626',
  fatal: '#7c3aed',
};

const CAUSALITY_LABELS: Record<string, string> = {
  certain: 'Certain',
  probable: 'Probable',
  possible: 'Possible',
  unlikely: 'Unlikely',
  unclassifiable: 'Unclassifiable',
};

const emptyForm = {
  patientId: '',
  suspectDrug: '',
  eventDescription: '',
  eventSeverity: 'moderate',
  eventOutcome: 'recovered',
  causality: 'possible',
};

interface Props { token: string; tenantSlug: string; }

export default function PharmacovigilancePage({ token, tenantSlug }: Props) {
  const [events, setEvents] = useState<AdverseEvent[]>([]);
  const [tab, setTab] = useState<'unreported' | 'report'>('unreported');
  const [form, setForm] = useState({ ...emptyForm });
  const [submitting, setSubmitting] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [exportResult, setExportResult] = useState<{ exported: number } | null>(null);
  const [msg, setMsg] = useState('');

  const loadUnreported = useCallback(async () => {
    try {
      const data = await api.getUnreportedAdverseEvents(token, tenantSlug);
      setEvents(Array.isArray(data) ? data : []);
    } catch {
      setEvents([]);
    }
  }, [token, tenantSlug]);

  useEffect(() => {
    if (tab === 'unreported') loadUnreported();
  }, [tab, loadUnreported]);

  async function handleReport(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setMsg('');
    try {
      await api.reportAdverseEvent(form, token, tenantSlug);
      setMsg('Adverse event reported successfully.');
      setForm({ ...emptyForm });
      setTab('unreported');
    } catch (err: any) {
      setMsg(err.message ?? 'Failed to report event.');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleExport() {
    setExporting(true);
    try {
      const result = await api.exportVigibase(token, tenantSlug);
      setExportResult(result);
      loadUnreported();
    } catch {
      setMsg('Export failed.');
    } finally {
      setExporting(false);
    }
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
    <div style={{ padding: 24, maxWidth: 1000 }}>
      <h2 style={{ margin: '0 0 20px' }}>Pharmacovigilance — ART Adverse Events</h2>

      <div style={{ borderBottom: '1px solid #e5e7eb', marginBottom: 24 }}>
        <button style={tabStyle(tab === 'unreported')} onClick={() => setTab('unreported')}>Unreported Events</button>
        <button style={tabStyle(tab === 'report')} onClick={() => setTab('report')}>Report New Event</button>
      </div>

      {msg && (
        <div style={{ marginBottom: 16, padding: '10px 16px', borderRadius: 6, background: msg.includes('success') ? '#f0fdf4' : '#fef2f2', color: msg.includes('success') ? '#166534' : '#991b1b', border: `1px solid ${msg.includes('success') ? '#bbf7d0' : '#fecaca'}` }}>
          {msg}
        </div>
      )}

      {tab === 'unreported' && (
        <>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <span style={{ fontSize: 14, color: '#6b7280' }}>{events.length} event{events.length !== 1 ? 's' : ''} pending VigiBase export</span>
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={loadUnreported} style={{ padding: '7px 14px', border: '1px solid #d1d5db', borderRadius: 6, background: '#fff', cursor: 'pointer', fontSize: 13 }}>Refresh</button>
              <button
                onClick={handleExport}
                disabled={exporting || events.length === 0}
                style={{ padding: '7px 14px', background: '#2563eb', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 13 }}
              >
                {exporting ? 'Exporting…' : 'Export to VigiBase'}
              </button>
            </div>
          </div>

          {exportResult && (
            <div style={{ marginBottom: 16, padding: '10px 16px', background: '#f0fdf4', borderRadius: 6, border: '1px solid #bbf7d0', color: '#166534' }}>
              Exported {exportResult.exported} event{exportResult.exported !== 1 ? 's' : ''} to VigiBase successfully.
            </div>
          )}

          {events.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 48, color: '#9ca3af' }}>No pending events</div>
          ) : (
            <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 10, overflow: 'hidden' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ background: '#f9fafb' }}>
                    {['Patient', 'Suspect Drug', 'Severity', 'Outcome', 'Causality', 'Report Date'].map(h => (
                      <th key={h} style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 600, color: '#374151', borderBottom: '1px solid #e5e7eb' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {events.map(ev => (
                    <tr key={ev.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                      <td style={{ padding: '8px 12px', fontFamily: 'monospace', fontSize: 11 }}>{ev.patient_id?.slice(0, 8)}…</td>
                      <td style={{ padding: '8px 12px', fontWeight: 500 }}>{ev.suspect_drug}</td>
                      <td style={{ padding: '8px 12px' }}>
                        <span style={{ padding: '2px 8px', borderRadius: 12, fontSize: 11, fontWeight: 600, background: (SEVERITY_COLOURS[ev.event_severity] ?? '#6b7280') + '22', color: SEVERITY_COLOURS[ev.event_severity] ?? '#6b7280' }}>
                          {ev.event_severity}
                        </span>
                      </td>
                      <td style={{ padding: '8px 12px' }}>{ev.event_outcome}</td>
                      <td style={{ padding: '8px 12px', color: '#6b7280' }}>{CAUSALITY_LABELS[ev.causality] ?? ev.causality}</td>
                      <td style={{ padding: '8px 12px', color: '#6b7280' }}>{ev.report_date?.slice(0, 10)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {tab === 'report' && (
        <form onSubmit={handleReport} style={{ maxWidth: 540 }}>
          <div style={{ display: 'grid', gap: 14 }}>
            {[
              { label: 'Patient ID (UUID)', key: 'patientId', type: 'text', required: true },
              { label: 'Suspect Drug', key: 'suspectDrug', type: 'text', required: true },
            ].map(({ label, key, type, required }) => (
              <div key={key}>
                <label style={{ display: 'block', fontSize: 12, marginBottom: 4, color: '#374151', fontWeight: 500 }}>{label}</label>
                <input
                  type={type}
                  required={required}
                  value={(form as any)[key]}
                  onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
                  style={{ width: '100%', padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: 6, fontSize: 14, boxSizing: 'border-box' }}
                />
              </div>
            ))}
            <div>
              <label style={{ display: 'block', fontSize: 12, marginBottom: 4, color: '#374151', fontWeight: 500 }}>Event Description</label>
              <textarea
                value={form.eventDescription}
                onChange={e => setForm(f => ({ ...f, eventDescription: e.target.value }))}
                rows={3}
                style={{ width: '100%', padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: 6, fontSize: 14, boxSizing: 'border-box', resize: 'vertical' }}
              />
            </div>
            {[
              { label: 'Severity', key: 'eventSeverity', options: ['mild', 'moderate', 'severe', 'fatal'] },
              { label: 'Outcome', key: 'eventOutcome', options: ['recovered', 'recovering', 'not recovered', 'fatal', 'unknown'] },
              { label: 'Causality', key: 'causality', options: ['certain', 'probable', 'possible', 'unlikely', 'unclassifiable'] },
            ].map(({ label, key, options }) => (
              <div key={key}>
                <label style={{ display: 'block', fontSize: 12, marginBottom: 4, color: '#374151', fontWeight: 500 }}>{label}</label>
                <select
                  value={(form as any)[key]}
                  onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
                  style={{ width: '100%', padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: 6, fontSize: 14 }}
                >
                  {options.map(o => <option key={o} value={o}>{o.charAt(0).toUpperCase() + o.slice(1)}</option>)}
                </select>
              </div>
            ))}
          </div>
          <button
            type="submit"
            disabled={submitting}
            style={{ marginTop: 20, padding: '10px 24px', background: '#2563eb', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 14 }}
          >
            {submitting ? 'Submitting…' : 'Report Adverse Event'}
          </button>
        </form>
      )}
    </div>
  );
}
