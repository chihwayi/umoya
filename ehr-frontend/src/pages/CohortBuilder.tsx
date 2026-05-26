import React, { useEffect, useState } from 'react';
import { ehrApi } from '../services/api';

const FIELD_OPTIONS = [
  { value: 'sex', label: 'Sex' },
  { value: 'age_min', label: 'Age (min)' },
  { value: 'age_max', label: 'Age (max)' },
  { value: 'district', label: 'District' },
  { value: 'province', label: 'Province' },
  { value: 'art_status', label: 'ART Status' },
  { value: 'regimen_line', label: 'Regimen Line' },
  { value: 'vl_max', label: 'Viral Load (max)' },
  { value: 'cd4_min', label: 'CD4 Count (min)' },
  { value: 'on_art_months_min', label: 'Months on ART (min)' },
  { value: 'has_oi_alert', label: 'Has Active OI Alert' },
  { value: 'is_stable', label: 'Is Stable Patient' },
];

interface Criterion { field: string; operator: string; value: string | number; }
interface SavedCohort { id: string; cohort_name: string; description?: string; last_run_count?: number; is_shared: boolean; }
interface Patient { id: string; full_name: string; date_of_birth: string; sex: string; district: string; art_status: string; }

interface Props { token: string; tenantSlug: string; }

export default function CohortBuilder({ token, tenantSlug }: Props) {
  const [conditions, setConditions] = useState<Criterion[]>([{ field: 'sex', operator: 'eq', value: '' }]);
  const [logic, setLogic] = useState<'AND' | 'OR'>('AND');
  const [results, setResults] = useState<Patient[]>([]);
  const [resultCount, setResultCount] = useState<number | null>(null);
  const [savedCohorts, setSavedCohorts] = useState<SavedCohort[]>([]);
  const [running, setRunning] = useState(false);
  const [saveName, setSaveName] = useState('');
  const [saveDesc, setSaveDesc] = useState('');
  const [saveShared, setSaveShared] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    loadSavedCohorts();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function loadSavedCohorts() {
    const { data } = await ehrApi.listCohorts(token, tenantSlug);
    setSavedCohorts(data || []);
  }

  function addCriterion() {
    setConditions(prev => [...prev, { field: 'sex', operator: 'eq', value: '' }]);
  }

  function removeCriterion(i: number) {
    setConditions(prev => prev.filter((_, idx) => idx !== i));
  }

  function updateCriterion(i: number, key: keyof Criterion, val: string) {
    setConditions(prev => prev.map((c, idx) => idx === i ? { ...c, [key]: val } : c));
  }

  async function runCohort() {
    setRunning(true);
    setError('');
    try {
      const { data } = await ehrApi.runCohort({ conditions, logic }, token, tenantSlug);
      setResults(data.patients || []);
      setResultCount(data.count);
    } catch (e: any) {
      setError(e?.response?.data?.message || 'Error running cohort');
    }
    setRunning(false);
  }

  async function saveCohort() {
    if (!saveName) return;
    setSaving(true);
    await ehrApi.saveCohort({ cohortName: saveName, description: saveDesc, criteria: { conditions, logic }, isShared: saveShared }, token, tenantSlug);
    setSaving(false);
    setSaveName('');
    setSaveDesc('');
    loadSavedCohorts();
  }

  async function runSaved(id: string) {
    setRunning(true);
    const { data } = await ehrApi.runSavedCohort(id, token, tenantSlug);
    setResults(data.patients || []);
    setResultCount(data.count);
    setRunning(false);
  }

  function exportCsv() {
    const headers = ['ID', 'Name', 'DOB', 'Sex', 'District', 'ART Status'];
    const rows = results.map(p => [p.id, p.full_name, p.date_of_birth?.slice(0, 10), p.sex, p.district, p.art_status]);
    const csv = [headers, ...rows].map(r => r.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'cohort-export.csv';
    a.click();
  }

  return (
    <div style={{ padding: 24 }}>
      <h2 style={{ margin: '0 0 20px', fontSize: 22 }}>Cohort Builder</h2>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 280px', gap: 24 }}>
        {/* Builder */}
        <div>
          <div style={{ background: '#fff', borderRadius: 8, padding: 20, border: '1px solid #e5e7eb', marginBottom: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h3 style={{ margin: 0, fontSize: 16 }}>Criteria</h3>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <span style={{ fontSize: 13, color: '#374151' }}>Logic:</span>
                {(['AND', 'OR'] as const).map(l => (
                  <button key={l} onClick={() => setLogic(l)}
                    style={{ padding: '4px 12px', borderRadius: 4, border: '1px solid #d1d5db', cursor: 'pointer',
                      background: logic === l ? '#6366f1' : '#fff', color: logic === l ? '#fff' : '#374151', fontWeight: 600 }}>
                    {l}
                  </button>
                ))}
              </div>
            </div>

            {conditions.map((c, i) => (
              <div key={i} style={{ display: 'flex', gap: 8, marginBottom: 10, alignItems: 'center' }}>
                {i > 0 && <span style={{ width: 32, textAlign: 'center', fontSize: 12, color: '#6b7280', fontWeight: 600 }}>{logic}</span>}
                {i === 0 && <span style={{ width: 32 }} />}
                <select value={c.field} onChange={e => updateCriterion(i, 'field', e.target.value)}
                  style={{ padding: '7px 10px', borderRadius: 6, border: '1px solid #d1d5db', flex: 1 }}>
                  {FIELD_OPTIONS.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
                </select>
                <input value={String(c.value)} onChange={e => updateCriterion(i, 'value', e.target.value)}
                  placeholder="value"
                  style={{ padding: '7px 10px', borderRadius: 6, border: '1px solid #d1d5db', flex: 1 }} />
                <button onClick={() => removeCriterion(i)} disabled={conditions.length === 1}
                  style={{ padding: '7px 10px', borderRadius: 6, border: '1px solid #fee2e2', background: '#fff', color: '#ef4444', cursor: 'pointer' }}>✕</button>
              </div>
            ))}

            <button onClick={addCriterion}
              style={{ padding: '6px 14px', borderRadius: 6, border: '1px dashed #d1d5db', background: '#f9fafb', cursor: 'pointer', fontSize: 13, color: '#374151' }}>
              + Add Criterion
            </button>
          </div>

          {error && <p style={{ color: '#ef4444', fontSize: 13 }}>{error}</p>}

          <div style={{ display: 'flex', gap: 10, marginBottom: 16 }}>
            <button onClick={runCohort} disabled={running}
              style={{ padding: '9px 20px', borderRadius: 6, background: '#6366f1', color: '#fff', border: 'none', cursor: 'pointer', fontWeight: 600 }}>
              {running ? 'Running…' : 'Run Cohort'}
            </button>
            {resultCount !== null && (
              <button onClick={exportCsv}
                style={{ padding: '9px 20px', borderRadius: 6, background: '#fff', color: '#374151', border: '1px solid #d1d5db', cursor: 'pointer' }}>
                Export CSV ({resultCount})
              </button>
            )}
          </div>

          {resultCount !== null && (
            <div style={{ background: '#fff', borderRadius: 8, padding: 20, border: '1px solid #e5e7eb', marginBottom: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <h4 style={{ margin: 0 }}>{resultCount} patients match</h4>
              </div>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead><tr style={{ background: '#f9fafb' }}>
                  {['Name', 'DOB', 'Sex', 'District', 'ART Status'].map(h => (
                    <th key={h} style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 600, color: '#374151', borderBottom: '1px solid #e5e7eb' }}>{h}</th>
                  ))}
                </tr></thead>
                <tbody>
                  {results.slice(0, 50).map(p => (
                    <tr key={p.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                      <td style={{ padding: '8px 12px' }}>{p.full_name}</td>
                      <td style={{ padding: '8px 12px', color: '#6b7280' }}>{p.date_of_birth?.slice(0, 10)}</td>
                      <td style={{ padding: '8px 12px' }}>{p.sex}</td>
                      <td style={{ padding: '8px 12px', color: '#6b7280' }}>{p.district}</td>
                      <td style={{ padding: '8px 12px' }}>{p.art_status}</td>
                    </tr>
                  ))}
                  {results.length > 50 && (
                    <tr><td colSpan={5} style={{ padding: 10, textAlign: 'center', color: '#9ca3af', fontSize: 12 }}>
                      Showing 50 of {resultCount} — export CSV for full list
                    </td></tr>
                  )}
                </tbody>
              </table>
            </div>
          )}

          {/* Save cohort */}
          <div style={{ background: '#f9fafb', borderRadius: 8, padding: 16, border: '1px solid #e5e7eb' }}>
            <h4 style={{ margin: '0 0 12px' }}>Save Cohort Definition</h4>
            <div style={{ display: 'flex', gap: 8 }}>
              <input value={saveName} onChange={e => setSaveName(e.target.value)}
                placeholder="Cohort name *"
                style={{ flex: 2, padding: '7px 10px', borderRadius: 6, border: '1px solid #d1d5db' }} />
              <input value={saveDesc} onChange={e => setSaveDesc(e.target.value)}
                placeholder="Description"
                style={{ flex: 3, padding: '7px 10px', borderRadius: 6, border: '1px solid #d1d5db' }} />
              <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, whiteSpace: 'nowrap' }}>
                <input type="checkbox" checked={saveShared} onChange={e => setSaveShared(e.target.checked)} />
                Shared
              </label>
              <button onClick={saveCohort} disabled={saving || !saveName}
                style={{ padding: '7px 16px', borderRadius: 6, background: '#10b981', color: '#fff', border: 'none', cursor: 'pointer', fontWeight: 600, whiteSpace: 'nowrap' }}>
                {saving ? 'Saving…' : 'Save'}
              </button>
            </div>
          </div>
        </div>

        {/* Saved cohorts sidebar */}
        <div>
          <h4 style={{ margin: '0 0 12px', fontSize: 15 }}>Saved Cohorts</h4>
          {savedCohorts.length === 0 ? (
            <p style={{ color: '#9ca3af', fontSize: 13 }}>No saved cohorts yet.</p>
          ) : (
            savedCohorts.map(c => (
              <div key={c.id} style={{ background: '#fff', borderRadius: 8, padding: 12, border: '1px solid #e5e7eb', marginBottom: 8 }}>
                <div style={{ fontWeight: 600, fontSize: 14 }}>{c.cohort_name}</div>
                {c.description && <div style={{ fontSize: 12, color: '#6b7280', marginTop: 2 }}>{c.description}</div>}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 }}>
                  <span style={{ fontSize: 11, color: '#9ca3af' }}>
                    {c.last_run_count != null ? `${c.last_run_count} patients` : 'Not run yet'}
                    {c.is_shared && ' · Shared'}
                  </span>
                  <button onClick={() => runSaved(c.id)}
                    style={{ padding: '4px 12px', borderRadius: 4, background: '#6366f1', color: '#fff', border: 'none', cursor: 'pointer', fontSize: 12 }}>
                    Run
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
