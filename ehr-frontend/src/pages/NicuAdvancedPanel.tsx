import React, { useEffect, useState } from 'react';
import { Zap, AlertTriangle, FlaskConical, Baby, CheckSquare } from 'lucide-react';
import { api } from '../services/api';

type Drug = {
  drug_code: string; drug_name: string; category: string;
  dose_mg_per_kg: number; frequency: string; route: string;
  monitoring_required?: string; min_ga_weeks?: number;
};

const SCREENING_TYPES = [
  { key: 'nbs_heel_prick', label: 'NBS Heel Prick' },
  { key: 'hearing_oae', label: 'Hearing (OAE)' },
  { key: 'cchd_pulse_ox', label: 'CCHD Pulse Ox' },
  { key: 'rop_referral', label: 'ROP Referral' },
  { key: 'metabolic_screen', label: 'Metabolic Screen' },
];

const RESULT_STATUSES = ['pass', 'refer', 'inconclusive', 'not_done', 'awaiting'];

const statusColor = (s: string) =>
  s === 'pass' ? '#1B6B3A' : s === 'refer' ? '#C62828' : s === 'inconclusive' ? '#E8614D' : '#7A9CBC';

export default function NicuAdvancedPanel({ admissionId, patientId }: { admissionId: string; patientId: string }) {
  const [tab, setTab] = useState<'drugs' | 'pn' | 'screening' | 'nas'>('drugs');

  // Drug dosing
  const [formulary, setFormulary]       = useState<Drug[]>([]);
  const [selectedDrug, setSelectedDrug] = useState<Drug | null>(null);
  const [weight, setWeight]             = useState('');
  const [drugResult, setDrugResult]     = useState<any>(null);
  const [drugOrders, setDrugOrders]     = useState<any[]>([]);
  const [drugLoading, setDrugLoading]   = useState(false);

  // PN
  const [pnWeight, setPnWeight]       = useState('');
  const [postnatalDay, setPostnatalDay] = useState('');
  const [gaWeeks, setGaWeeks]         = useState('');
  const [pnResult, setPnResult]       = useState<any>(null);
  const [pnHistory, setPnHistory]     = useState<any[]>([]);
  const [pnLoading, setPnLoading]     = useState(false);

  // Screening
  const [screenType, setScreenType]       = useState('nbs_heel_prick');
  const [screenStatus, setScreenStatus]   = useState('pass');
  const [screenNotes, setScreenNotes]     = useState('');
  const [screenResults, setScreenResults] = useState<any[]>([]);
  const [screenAlert, setScreenAlert]     = useState<string | null>(null);
  const [screenLoading, setScreenLoading] = useState(false);

  // NAS
  const [nasScore, setNasScore]   = useState('');
  const [nasItems, setNasItems]   = useState<Record<string, boolean>>({});
  const [nasResult, setNasResult] = useState<any>(null);
  const [nasHistory, setNasHistory] = useState<any[]>([]);
  const [nasLoading, setNasLoading] = useState(false);

  useEffect(() => {
    api.get('/nicu/advanced/formulary').then((r: any) => setFormulary(r.data ?? r)).catch(() => {});
    if (admissionId) {
      api.get(`/nicu/advanced/drug-orders/${admissionId}`).then((r: any) => setDrugOrders(r.data ?? r)).catch(() => {});
      api.get(`/nicu/advanced/pn-prescription/${admissionId}`).then((r: any) => setPnHistory(r.data ?? r)).catch(() => {});
      api.get(`/nicu/advanced/screening/${admissionId}`).then((r: any) => setScreenResults(r.data ?? r)).catch(() => {});
      api.get(`/nicu/advanced/nas-score/${admissionId}`).then((r: any) => setNasHistory(r.data ?? r)).catch(() => {});
    }
  }, [admissionId]);

  const orderDrug = async () => {
    if (!selectedDrug || !weight || !admissionId) return;
    setDrugLoading(true);
    try {
      const r: any = await api.post('/nicu/advanced/drug-orders', {
        admissionId, drugCode: selectedDrug.drug_code, weightKg: parseFloat(weight),
      });
      const res = r.data ?? r;
      setDrugResult(res);
      setDrugOrders(prev => [res, ...prev]);
    } finally { setDrugLoading(false); }
  };

  const prescribePN = async () => {
    if (!pnWeight || !postnatalDay || !gaWeeks || !admissionId) return;
    setPnLoading(true);
    try {
      const r: any = await api.post('/nicu/advanced/pn-prescription', {
        admissionId, weightKg: parseFloat(pnWeight),
        postnatalDay: parseInt(postnatalDay, 10),
        gestationalAgeWeeks: parseInt(gaWeeks, 10),
      });
      const res = r.data ?? r;
      setPnResult(res);
      setPnHistory(prev => [res, ...prev]);
    } finally { setPnLoading(false); }
  };

  const recordScreening = async () => {
    if (!admissionId || !patientId) return;
    setScreenLoading(true);
    try {
      const r: any = await api.post('/nicu/advanced/screening', {
        admissionId, patientId, screeningType: screenType,
        resultStatus: screenStatus, notes: screenNotes || undefined,
      });
      const res = r.data ?? r;
      setScreenAlert(res.cdss_alert ?? null);
      setScreenResults(prev => [res, ...prev]);
      setScreenNotes('');
    } finally { setScreenLoading(false); }
  };

  const submitNasScore = async () => {
    if (!admissionId || !nasScore) return;
    setNasLoading(true);
    try {
      const r: any = await api.post('/nicu/advanced/nas-score', {
        admissionId, scoreItems: nasItems, totalScore: parseInt(nasScore, 10),
      });
      const res = r.data ?? r;
      setNasResult(res);
      setNasHistory(prev => [res, ...prev]);
      setNasScore('');
      setNasItems({});
    } finally { setNasLoading(false); }
  };

  const tabs = [
    { key: 'drugs', label: 'Drug Dosing', icon: <Zap size={14} /> },
    { key: 'pn', label: 'PN Calculator', icon: <FlaskConical size={14} /> },
    { key: 'screening', label: 'Screening', icon: <CheckSquare size={14} /> },
    { key: 'nas', label: 'NAS Score', icon: <Baby size={14} /> },
  ] as const;

  return (
    <div style={{ fontFamily: 'Inter, sans-serif', color: '#1C2B3A' }}>
      {/* Tabs */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 20, borderBottom: '1px solid #E8EFF6', paddingBottom: 0 }}>
        {tabs.map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '8px 14px', border: 'none', cursor: 'pointer',
              borderBottom: tab === t.key ? '2px solid #1B6B3A' : '2px solid transparent',
              background: 'none',
              color: tab === t.key ? '#1B6B3A' : '#7A9CBC',
              fontWeight: tab === t.key ? 600 : 400, fontSize: 13,
            }}
          >
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      {/* Drug Dosing Tab */}
      {tab === 'drugs' && (
        <div>
          <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 14 }}>Weight-Based Drug Dosing Calculator</h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 16 }}>
            <div>
              <label style={{ fontSize: 12, color: '#7A9CBC', display: 'block', marginBottom: 4 }}>Weight (kg)</label>
              <input
                type="number" step="0.01" value={weight}
                onChange={e => setWeight(e.target.value)}
                placeholder="e.g. 1.25"
                style={{ width: '100%', padding: '8px 12px', border: '1px solid #E8EFF6', borderRadius: 8, fontSize: 14, boxSizing: 'border-box' }}
              />
            </div>
            <div>
              <label style={{ fontSize: 12, color: '#7A9CBC', display: 'block', marginBottom: 4 }}>Select Drug</label>
              <select
                value={selectedDrug?.drug_code ?? ''}
                onChange={e => setSelectedDrug(formulary.find(d => d.drug_code === e.target.value) ?? null)}
                style={{ width: '100%', padding: '8px 12px', border: '1px solid #E8EFF6', borderRadius: 8, fontSize: 13, boxSizing: 'border-box' }}
              >
                <option value="">-- choose --</option>
                {formulary.map(d => (
                  <option key={d.drug_code} value={d.drug_code}>{d.drug_name}</option>
                ))}
              </select>
            </div>
          </div>

          {selectedDrug && (
            <div style={{ background: '#F0F7F4', borderRadius: 8, padding: '10px 14px', marginBottom: 12, fontSize: 13 }}>
              <strong>{selectedDrug.drug_name}</strong> — {selectedDrug.dose_mg_per_kg} mg/kg · {selectedDrug.frequency} · {selectedDrug.route}
              {selectedDrug.min_ga_weeks && <span style={{ color: '#7A9CBC', marginLeft: 8 }}>Min GA: {selectedDrug.min_ga_weeks}w</span>}
            </div>
          )}

          <button
            onClick={orderDrug} disabled={drugLoading || !selectedDrug || !weight}
            style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#1B6B3A', color: '#fff', border: 'none', borderRadius: 20, padding: '10px 20px', cursor: 'pointer', fontWeight: 600, fontSize: 14, marginBottom: 16 }}
          >
            <Zap size={14} /> {drugLoading ? 'Calculating…' : 'Calculate & Order'}
          </button>

          {drugResult && (
            <div style={{ background: '#F0F7F4', borderRadius: 10, padding: 16, marginBottom: 20, border: '1px solid #1B6B3A22' }}>
              <div style={{ fontSize: 12, color: '#7A9CBC', marginBottom: 4 }}>Recommended Dose</div>
              <div style={{ fontSize: 32, fontWeight: 800, color: '#1B6B3A', marginBottom: 8 }}>{drugResult.recommended_dose_mg} mg</div>
              {(drugResult.cdss_alerts ?? []).map((a: string, i: number) => (
                <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 6, marginBottom: 6, color: a.includes('EXCEEDS') ? '#C62828' : '#E8614D', fontSize: 13 }}>
                  <AlertTriangle size={14} style={{ marginTop: 2, flexShrink: 0 }} />
                  <span>{a}</span>
                </div>
              ))}
            </div>
          )}

          {drugOrders.length > 0 && (
            <div>
              <div style={{ fontSize: 13, fontWeight: 600, color: '#7A9CBC', marginBottom: 8 }}>Recent Orders</div>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                <thead>
                  <tr style={{ background: '#F5F8FB' }}>
                    {['Drug', 'Weight', 'Calculated Dose', 'Route', 'Time'].map(h => (
                      <th key={h} style={{ textAlign: 'left', padding: '6px 10px', color: '#7A9CBC', fontWeight: 600 }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {drugOrders.slice(0, 8).map((o: any) => (
                    <tr key={o.id} style={{ borderBottom: '1px solid #F0F4F8' }}>
                      <td style={{ padding: '6px 10px' }}>{o.drug_name ?? o.drug_code}</td>
                      <td style={{ padding: '6px 10px' }}>{o.weight_kg} kg</td>
                      <td style={{ padding: '6px 10px', color: o.exceeds_max ? '#C62828' : '#1B6B3A', fontWeight: 600 }}>
                        {o.dose_calculated_mg ? parseFloat(o.dose_calculated_mg).toFixed(3) : '—'} mg
                        {o.exceeds_max && ' ⚠ MAX'}
                        {o.near_toxicity && ' ⚠ TOX'}
                      </td>
                      <td style={{ padding: '6px 10px' }}>{o.route}</td>
                      <td style={{ padding: '6px 10px', color: '#7A9CBC' }}>{o.ordered_at ? new Date(o.ordered_at).toLocaleString() : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* PN Calculator Tab */}
      {tab === 'pn' && (
        <div>
          <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 14 }}>Neonatal Parenteral Nutrition Calculator</h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 14, marginBottom: 16 }}>
            {[
              { label: 'Weight (kg)', value: pnWeight, set: setPnWeight, placeholder: 'e.g. 1.10' },
              { label: 'Postnatal Day', value: postnatalDay, set: setPostnatalDay, placeholder: 'e.g. 2' },
              { label: 'Gestational Age (weeks)', value: gaWeeks, set: setGaWeeks, placeholder: 'e.g. 28' },
            ].map(f => (
              <div key={f.label}>
                <label style={{ fontSize: 12, color: '#7A9CBC', display: 'block', marginBottom: 4 }}>{f.label}</label>
                <input
                  type="number" value={f.value} onChange={e => f.set(e.target.value)} placeholder={f.placeholder}
                  style={{ width: '100%', padding: '8px 12px', border: '1px solid #E8EFF6', borderRadius: 8, fontSize: 14, boxSizing: 'border-box' }}
                />
              </div>
            ))}
          </div>

          <button
            onClick={prescribePN} disabled={pnLoading || !pnWeight || !postnatalDay || !gaWeeks}
            style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#1B6B3A', color: '#fff', border: 'none', borderRadius: 20, padding: '10px 20px', cursor: 'pointer', fontWeight: 600, fontSize: 14, marginBottom: 16 }}
          >
            <FlaskConical size={14} /> {pnLoading ? 'Calculating…' : 'Generate PN Prescription'}
          </button>

          {pnResult && (
            <div style={{ background: '#F0F7F4', borderRadius: 10, padding: 16, marginBottom: 20, border: '1px solid #1B6B3A22' }}>
              <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 10, color: '#1B6B3A' }}>
                {pnResult.total_kcal_per_kg_per_day} kcal/kg/day total
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 10 }}>
                {[
                  { label: 'Fluid', val: `${pnResult.fluid_ml_per_kg_per_day} ml/kg/d`, abs: `${pnResult.absolute_targets?.total_fluid_ml_per_day} ml/d` },
                  { label: 'Amino Acids', val: `${pnResult.amino_acid_g_per_kg_per_day} g/kg/d`, abs: `${pnResult.absolute_targets?.amino_acid_ml_per_day_at_10pct} ml (10%) /d` },
                  { label: 'Lipid', val: `${pnResult.lipid_g_per_kg_per_day} g/kg/d`, abs: `${pnResult.absolute_targets?.lipid_ml_per_day_at_20pct} ml (20%) /d` },
                  { label: 'Glucose', val: `${pnResult.glucose_g_per_kg_per_day} g/kg/d`, abs: '' },
                ].map(item => (
                  <div key={item.label} style={{ background: '#fff', borderRadius: 8, padding: '10px 12px', border: '1px solid #E8EFF6' }}>
                    <div style={{ fontSize: 11, color: '#7A9CBC', marginBottom: 3 }}>{item.label}</div>
                    <div style={{ fontSize: 15, fontWeight: 700 }}>{item.val}</div>
                    {item.abs && <div style={{ fontSize: 11, color: '#7A9CBC' }}>{item.abs}</div>}
                  </div>
                ))}
              </div>
              <div style={{ marginTop: 10, display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
                {[
                  { label: 'Sodium', val: `${pnResult.sodium_mmol_per_kg_per_day} mmol/kg/d` },
                  { label: 'Potassium (GIR)', val: `${pnResult.potassium_gir_mg_per_kg_per_min} mg/kg/min` },
                  { label: 'Calcium', val: `${pnResult.calcium_mmol_per_kg_per_day} mmol/kg/d` },
                ].map(item => (
                  <div key={item.label} style={{ background: '#fff', borderRadius: 8, padding: '10px 12px', border: '1px solid #E8EFF6' }}>
                    <div style={{ fontSize: 11, color: '#7A9CBC', marginBottom: 3 }}>{item.label}</div>
                    <div style={{ fontSize: 14, fontWeight: 600 }}>{item.val}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {pnHistory.length > 0 && (
            <div>
              <div style={{ fontSize: 13, fontWeight: 600, color: '#7A9CBC', marginBottom: 8 }}>PN History</div>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                <thead>
                  <tr style={{ background: '#F5F8FB' }}>
                    {['Date', 'Day', 'Weight', 'Fluid ml/kg/d', 'AA g/kg/d', 'Lipid g/kg/d', 'kcal/kg/d'].map(h => (
                      <th key={h} style={{ textAlign: 'left', padding: '6px 10px', color: '#7A9CBC', fontWeight: 600 }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {pnHistory.slice(0, 7).map((p: any) => (
                    <tr key={p.id} style={{ borderBottom: '1px solid #F0F4F8' }}>
                      <td style={{ padding: '6px 10px' }}>{p.prescription_date}</td>
                      <td style={{ padding: '6px 10px' }}>D{p.postnatal_day}</td>
                      <td style={{ padding: '6px 10px' }}>{p.weight_kg} kg</td>
                      <td style={{ padding: '6px 10px' }}>{p.fluid_ml_per_kg_per_day}</td>
                      <td style={{ padding: '6px 10px' }}>{p.amino_acid_g_per_kg_per_day}</td>
                      <td style={{ padding: '6px 10px' }}>{p.lipid_g_per_kg_per_day}</td>
                      <td style={{ padding: '6px 10px', fontWeight: 600, color: '#1B6B3A' }}>{p.total_kcal_per_kg_per_day}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Screening Tab */}
      {tab === 'screening' && (
        <div>
          <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 14 }}>Newborn Screening Register</h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 12 }}>
            <div>
              <label style={{ fontSize: 12, color: '#7A9CBC', display: 'block', marginBottom: 4 }}>Screening Type</label>
              <select
                value={screenType} onChange={e => setScreenType(e.target.value)}
                style={{ width: '100%', padding: '8px 12px', border: '1px solid #E8EFF6', borderRadius: 8, fontSize: 13, boxSizing: 'border-box' }}
              >
                {SCREENING_TYPES.map(s => <option key={s.key} value={s.key}>{s.label}</option>)}
              </select>
            </div>
            <div>
              <label style={{ fontSize: 12, color: '#7A9CBC', display: 'block', marginBottom: 4 }}>Result</label>
              <select
                value={screenStatus} onChange={e => setScreenStatus(e.target.value)}
                style={{ width: '100%', padding: '8px 12px', border: '1px solid #E8EFF6', borderRadius: 8, fontSize: 13, boxSizing: 'border-box' }}
              >
                {RESULT_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
          </div>
          <textarea
            value={screenNotes} onChange={e => setScreenNotes(e.target.value)}
            placeholder="Notes (optional)"
            rows={2}
            style={{ width: '100%', padding: '8px 12px', border: '1px solid #E8EFF6', borderRadius: 8, fontSize: 13, boxSizing: 'border-box', marginBottom: 12, resize: 'vertical' }}
          />
          <button
            onClick={recordScreening} disabled={screenLoading}
            style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#1B6B3A', color: '#fff', border: 'none', borderRadius: 20, padding: '10px 20px', cursor: 'pointer', fontWeight: 600, fontSize: 14, marginBottom: 14 }}
          >
            <CheckSquare size={14} /> {screenLoading ? 'Recording…' : 'Record Screening Result'}
          </button>

          {screenAlert && (
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, background: '#FFF0F0', border: '1px solid #C62828', borderRadius: 8, padding: '10px 14px', marginBottom: 16, color: '#C62828', fontSize: 13 }}>
              <AlertTriangle size={16} style={{ marginTop: 1, flexShrink: 0 }} />
              <span>{screenAlert}</span>
            </div>
          )}

          {screenResults.length > 0 && (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead>
                <tr style={{ background: '#F5F8FB' }}>
                  {['Screening', 'Result', 'Follow-up', 'Date', 'Notes'].map(h => (
                    <th key={h} style={{ textAlign: 'left', padding: '6px 10px', color: '#7A9CBC', fontWeight: 600 }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {screenResults.map((r: any) => (
                  <tr key={r.id} style={{ borderBottom: '1px solid #F0F4F8' }}>
                    <td style={{ padding: '6px 10px' }}>{SCREENING_TYPES.find(s => s.key === r.screening_type)?.label ?? r.screening_type}</td>
                    <td style={{ padding: '6px 10px' }}>
                      <span style={{ background: statusColor(r.result_status) + '22', color: statusColor(r.result_status), borderRadius: 10, padding: '2px 8px', fontWeight: 600 }}>
                        {r.result_status}
                      </span>
                    </td>
                    <td style={{ padding: '6px 10px', color: r.followup_required ? '#C62828' : '#1B6B3A' }}>
                      {r.followup_required ? 'Required' : 'None'}
                    </td>
                    <td style={{ padding: '6px 10px', color: '#7A9CBC' }}>{r.performed_at ? new Date(r.performed_at).toLocaleDateString() : '—'}</td>
                    <td style={{ padding: '6px 10px' }}>{r.notes ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* NAS Score Tab */}
      {tab === 'nas' && (
        <div>
          <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 14 }}>NAS / Modified Finnegan Score</h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 16, marginBottom: 16 }}>
            <div>
              <label style={{ fontSize: 12, color: '#7A9CBC', display: 'block', marginBottom: 4 }}>Total Score (0–44)</label>
              <input
                type="number" min={0} max={44} value={nasScore}
                onChange={e => setNasScore(e.target.value)}
                style={{ width: '100%', padding: '8px 12px', border: '1px solid #E8EFF6', borderRadius: 8, fontSize: 20, fontWeight: 700, textAlign: 'center', boxSizing: 'border-box' }}
              />
              <div style={{ fontSize: 11, color: '#7A9CBC', marginTop: 4 }}>
                ≥8: treatment · ≥12: escalation
              </div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}>
              {nasScore && (
                <div style={{
                  padding: '10px 16px', borderRadius: 10, textAlign: 'center', fontWeight: 700, fontSize: 14,
                  background: parseInt(nasScore, 10) >= 12 ? '#FFF0F0' : parseInt(nasScore, 10) >= 8 ? '#FFF8F0' : '#F0F7F4',
                  color: parseInt(nasScore, 10) >= 12 ? '#C62828' : parseInt(nasScore, 10) >= 8 ? '#E8614D' : '#1B6B3A',
                  border: `1px solid ${parseInt(nasScore, 10) >= 12 ? '#C62828' : parseInt(nasScore, 10) >= 8 ? '#E8614D' : '#1B6B3A'}44`,
                }}>
                  {parseInt(nasScore, 10) >= 12 ? 'ESCALATION REQUIRED'
                    : parseInt(nasScore, 10) >= 8 ? 'TREATMENT REQUIRED'
                    : parseInt(nasScore, 10) >= 4 ? 'Supportive Care'
                    : 'No Treatment'}
                </div>
              )}
            </div>
          </div>

          <button
            onClick={submitNasScore} disabled={nasLoading || !nasScore}
            style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#1B6B3A', color: '#fff', border: 'none', borderRadius: 20, padding: '10px 20px', cursor: 'pointer', fontWeight: 600, fontSize: 14, marginBottom: 14 }}
          >
            <Baby size={14} /> {nasLoading ? 'Saving…' : 'Record NAS Score'}
          </button>

          {nasResult?.cdss_alert && (
            <div style={{
              display: 'flex', alignItems: 'flex-start', gap: 8,
              background: nasResult.treatment_escalation_needed ? '#FFF0F0' : '#FFF8F0',
              border: `1px solid ${nasResult.treatment_escalation_needed ? '#C62828' : '#E8614D'}`,
              borderRadius: 8, padding: '10px 14px', marginBottom: 16, fontSize: 13,
              color: nasResult.treatment_escalation_needed ? '#C62828' : '#E8614D',
            }}>
              <AlertTriangle size={16} style={{ marginTop: 1, flexShrink: 0 }} />
              <span>{nasResult.cdss_alert}</span>
            </div>
          )}

          {nasHistory.length > 0 && (
            <div>
              <div style={{ fontSize: 13, fontWeight: 600, color: '#7A9CBC', marginBottom: 8 }}>NAS Trend</div>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                <thead>
                  <tr style={{ background: '#F5F8FB' }}>
                    {['Time', 'Score', 'Treatment', 'Escalation'].map(h => (
                      <th key={h} style={{ textAlign: 'left', padding: '6px 10px', color: '#7A9CBC', fontWeight: 600 }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {nasHistory.map((n: any) => (
                    <tr key={n.id} style={{ borderBottom: '1px solid #F0F4F8' }}>
                      <td style={{ padding: '6px 10px', color: '#7A9CBC' }}>{new Date(n.scored_at).toLocaleString()}</td>
                      <td style={{ padding: '6px 10px', fontWeight: 700, color: n.treatment_escalation_needed ? '#C62828' : n.requires_treatment ? '#E8614D' : '#1B6B3A', fontSize: 16 }}>{n.total_score}</td>
                      <td style={{ padding: '6px 10px' }}>{n.requires_treatment ? <span style={{ color: '#E8614D' }}>Yes</span> : <span style={{ color: '#1B6B3A' }}>No</span>}</td>
                      <td style={{ padding: '6px 10px' }}>{n.treatment_escalation_needed ? <span style={{ color: '#C62828', fontWeight: 700 }}>ESCALATE</span> : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
