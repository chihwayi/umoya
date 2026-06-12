import React, { useState, useEffect, useCallback } from 'react';
import { AlertTriangle, Plus, Activity, Heart, Thermometer, Clock, CheckCircle, RefreshCw } from 'lucide-react';
import { ehrApi } from '../services/api';
import { useNotification } from './GlobalNotification';

interface PartographEntry {
  id: string;
  entry_time: string;
  hours_in_labor: number | null;
  cervical_dilation: number | null;
  fetal_head_station: number | null;
  fetal_heart_rate: number | null;
  contractions_per_10min: number | null;
  contraction_duration_secs: number | null;
  maternal_bp_systolic: number | null;
  maternal_bp_diastolic: number | null;
  maternal_pulse: number | null;
  maternal_temp: number | null;
  liquor: string | null;
  moulding: number | null;
  oxytocin_units: number | null;
  drugs_given: string | null;
  alert_flags: Array<{ code: string; severity: 'warning' | 'critical'; message: string }>;
  notes: string | null;
}

interface PartographChartProps {
  deliveryId: string;
  tenantSlug: string;
  token: string;
}

const GRID_HOURS = 12;
const DILATION_MAX = 10;
const SVG_W = 600;
const SVG_H = 280;
const PAD_L = 36;
const PAD_R = 16;
const PAD_T = 16;
const PAD_B = 32;
const PLOT_W = SVG_W - PAD_L - PAD_R;
const PLOT_H = SVG_H - PAD_T - PAD_B;

function hourToX(h: number) {
  return PAD_L + (h / GRID_HOURS) * PLOT_W;
}
function dilationToY(d: number) {
  return PAD_T + PLOT_H - (d / DILATION_MAX) * PLOT_H;
}
function stationToY(s: number) {
  // station -5..+5 mapped onto same plot height, lower half
  return PAD_T + PLOT_H / 2 - (s / 5) * (PLOT_H / 2);
}

const LIQUOR_LABELS: Record<string, string> = { C: 'Clear', M: 'Meconium', B: 'Blood', A: 'Absent', D: 'Dry' };
const MOULDING_LABELS = ['None (0)', 'Apposable (1)', 'Overlapping reducible (2)', 'Overlapping fixed (3)'];

const EMPTY_FORM = {
  cervical_dilation: '',
  fetal_head_station: '',
  fetal_heart_rate: '',
  contractions_per_10min: '',
  contraction_duration_secs: '',
  maternal_bp_systolic: '',
  maternal_bp_diastolic: '',
  maternal_pulse: '',
  maternal_temp: '',
  urine_output_ml: '',
  liquor: '',
  moulding: '',
  oxytocin_units: '',
  drugs_given: '',
  notes: '',
};

export default function PartographChart({ deliveryId, tenantSlug, token }: PartographChartProps) {
  const { showSuccess, showError } = useNotification();
  const [entries, setEntries] = useState<PartographEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ ...EMPTY_FORM });

  const load = useCallback(async () => {
    if (!deliveryId) return;
    setLoading(true);
    try {
      const res = await ehrApi.getPartographData(tenantSlug, token, deliveryId);
      setEntries(res.data.entries || []);
    } catch {
      // table may not yet exist on older tenants — show empty gracefully
    } finally {
      setLoading(false);
    }
  }, [deliveryId, tenantSlug, token]);

  useEffect(() => { load(); }, [load]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const payload: any = { delivery_id: deliveryId };
      Object.entries(form).forEach(([k, v]) => {
        if (v !== '' && v !== null) payload[k] = isNaN(Number(v)) ? v : Number(v);
      });
      const res = await ehrApi.recordPartographEntry(tenantSlug, token, payload);
      const newAlerts: any[] = res.data.alerts || [];
      const critical = newAlerts.filter((a) => a.severity === 'critical');
      if (critical.length > 0) {
        showError('⚠️ Critical Alert', critical.map((a) => a.message).join(' | '));
      } else if (newAlerts.length > 0) {
        showError('Warning', newAlerts.map((a) => a.message).join(' | '));
      } else {
        showSuccess('Saved', 'Partograph entry recorded.');
      }
      setForm({ ...EMPTY_FORM });
      setShowForm(false);
      load();
    } catch (e: any) {
      showError('Error', e?.response?.data?.message || 'Failed to save entry');
    } finally {
      setSaving(false);
    }
  };

  // Build SVG cervicogram path
  const dilationPoints = entries
    .filter((e) => e.hours_in_labor != null && e.cervical_dilation != null)
    .map((e) => ({ x: hourToX(e.hours_in_labor!), y: dilationToY(e.cervical_dilation!) }));

  const descentPoints = entries
    .filter((e) => e.hours_in_labor != null && e.fetal_head_station != null)
    .map((e) => ({ x: hourToX(e.hours_in_labor!), y: stationToY(e.fetal_head_station!) }));

  const toPath = (pts: { x: number; y: number }[]) =>
    pts.length < 2 ? '' : pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');

  // Alert line: WHO action line = dilation starts at 3cm active phase, progress < 1cm/hr
  const actionLinePoints = [
    { x: hourToX(0), y: dilationToY(4) },
    { x: hourToX(4), y: dilationToY(4) },
    { x: hourToX(8), y: dilationToY(8) },
    { x: hourToX(GRID_HOURS), y: dilationToY(10) },
  ];

  const alertLinePoints = [
    { x: hourToX(2), y: dilationToY(4) },
    { x: hourToX(6), y: dilationToY(8) },
    { x: hourToX(GRID_HOURS - 2), y: dilationToY(10) },
  ];

  const allAlerts = entries.flatMap((e) => e.alert_flags || []);
  const criticalAlerts = allAlerts.filter((a) => a.severity === 'critical');
  const warningAlerts = allAlerts.filter((a) => a.severity === 'warning');

  const latestEntry = entries[entries.length - 1] ?? null;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-gradient-to-br from-pink-500 to-rose-600 rounded-xl">
            <Activity className="w-5 h-5 text-white" />
          </div>
          <div>
            <h3 className="text-base font-bold text-slate-900">Digital Partograph</h3>
            <p className="text-xs text-slate-500">WHO labor progress monitoring</p>
          </div>
        </div>
        <div className="flex gap-2">
          <button onClick={load} className="p-2 rounded-lg border border-slate-200 hover:bg-slate-50 transition-colors" title="Refresh">
            <RefreshCw className={`w-4 h-4 text-slate-500 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <button
            onClick={() => setShowForm(!showForm)}
            className="flex items-center gap-1 px-3 py-1.5 bg-pink-600 text-white rounded-lg hover:bg-pink-700 transition-colors text-sm font-semibold"
          >
            <Plus className="w-4 h-4" />
            Add Entry
          </button>
        </div>
      </div>

      {/* Active alerts */}
      {criticalAlerts.length > 0 && (
        <div className="rounded-xl bg-red-50 border border-red-300 p-3 space-y-1">
          {criticalAlerts.map((a, i) => (
            <div key={i} className="flex items-start gap-2 text-sm text-red-800">
              <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0 text-red-600" />
              <span className="font-semibold">{a.message}</span>
            </div>
          ))}
        </div>
      )}
      {warningAlerts.length > 0 && criticalAlerts.length === 0 && (
        <div className="rounded-xl bg-amber-50 border border-amber-300 p-3 space-y-1">
          {warningAlerts.slice(0, 3).map((a, i) => (
            <div key={i} className="flex items-start gap-2 text-sm text-amber-800">
              <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0 text-amber-500" />
              <span>{a.message}</span>
            </div>
          ))}
        </div>
      )}

      {/* Cervicogram SVG */}
      <div className="bg-white rounded-2xl border border-slate-200 p-4 overflow-x-auto">
        <p className="text-xs font-semibold text-slate-500 mb-2 uppercase tracking-wide">Cervicogram & Descent</p>
        <svg viewBox={`0 0 ${SVG_W} ${SVG_H}`} className="w-full min-w-[360px]" style={{ maxHeight: 300 }}>
          {/* Grid */}
          {Array.from({ length: GRID_HOURS + 1 }).map((_, i) => (
            <g key={`h${i}`}>
              <line x1={hourToX(i)} y1={PAD_T} x2={hourToX(i)} y2={PAD_T + PLOT_H} stroke="#e2e8f0" strokeWidth={i % 2 === 0 ? 1.2 : 0.6} />
              {i % 2 === 0 && <text x={hourToX(i)} y={PAD_T + PLOT_H + 14} textAnchor="middle" fontSize={9} fill="#94a3b8">{i}h</text>}
            </g>
          ))}
          {Array.from({ length: DILATION_MAX + 1 }).map((_, i) => (
            <g key={`d${i}`}>
              <line x1={PAD_L} y1={dilationToY(i)} x2={SVG_W - PAD_R} y2={dilationToY(i)} stroke="#e2e8f0" strokeWidth={i % 2 === 0 ? 1 : 0.5} />
              {i % 2 === 0 && <text x={PAD_L - 4} y={dilationToY(i) + 3} textAnchor="end" fontSize={8} fill="#94a3b8">{i}</text>}
            </g>
          ))}
          {/* Midline label */}
          <text x={PAD_L - 4} y={stationToY(0) + 3} textAnchor="end" fontSize={7} fill="#cbd5e1">0</text>

          {/* Alert line (red dashed) */}
          <path d={toPath(alertLinePoints)} fill="none" stroke="#ef4444" strokeWidth={1.5} strokeDasharray="5,3" opacity={0.7} />
          {/* Action line (orange dashed) */}
          <path d={toPath(actionLinePoints)} fill="none" stroke="#f97316" strokeWidth={1} strokeDasharray="3,3" opacity={0.5} />

          {/* Descent line (blue) */}
          {descentPoints.length > 1 && (
            <path d={toPath(descentPoints)} fill="none" stroke="#6366f1" strokeWidth={2} strokeLinejoin="round" />
          )}
          {descentPoints.map((p, i) => (
            <circle key={`ds${i}`} cx={p.x} cy={p.y} r={3} fill="#6366f1" />
          ))}

          {/* Cervical dilation (pink) */}
          {dilationPoints.length > 1 && (
            <path d={toPath(dilationPoints)} fill="none" stroke="#ec4899" strokeWidth={2.5} strokeLinejoin="round" />
          )}
          {dilationPoints.map((p, i) => (
            <circle key={`di${i}`} cx={p.x} cy={p.y} r={4} fill="#ec4899" />
          ))}

          {/* Legend */}
          <circle cx={PAD_L + 8} cy={PAD_T + 4} r={4} fill="#ec4899" />
          <text x={PAD_L + 16} y={PAD_T + 8} fontSize={8} fill="#64748b">Cervical dilation (cm)</text>
          <circle cx={PAD_L + 130} cy={PAD_T + 4} r={3} fill="#6366f1" />
          <text x={PAD_L + 138} y={PAD_T + 8} fontSize={8} fill="#64748b">Head station</text>
          <line x1={PAD_L + 210} y1={PAD_T + 4} x2={PAD_L + 224} y2={PAD_T + 4} stroke="#f97316" strokeWidth={1} strokeDasharray="3,2" />
          <text x={PAD_L + 228} y={PAD_T + 8} fontSize={8} fill="#64748b">Action</text>
          <line x1={PAD_L + 265} y1={PAD_T + 4} x2={PAD_L + 279} y2={PAD_T + 4} stroke="#ef4444" strokeWidth={1.5} strokeDasharray="5,3" />
          <text x={PAD_L + 283} y={PAD_T + 8} fontSize={8} fill="#64748b">Alert</text>
        </svg>
      </div>

      {/* Latest vitals strip */}
      {latestEntry && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { icon: Heart, label: 'FHR', value: latestEntry.fetal_heart_rate ? `${latestEntry.fetal_heart_rate} bpm` : '—', danger: latestEntry.fetal_heart_rate != null && (latestEntry.fetal_heart_rate < 100 || latestEntry.fetal_heart_rate > 180) },
            { icon: Activity, label: 'BP', value: latestEntry.maternal_bp_systolic ? `${latestEntry.maternal_bp_systolic}/${latestEntry.maternal_bp_diastolic}` : '—', danger: (latestEntry.maternal_bp_systolic ?? 0) >= 160 },
            { icon: Thermometer, label: 'Temp', value: latestEntry.maternal_temp ? `${latestEntry.maternal_temp}°C` : '—', danger: (latestEntry.maternal_temp ?? 0) > 38 },
            { icon: Clock, label: 'Contractions', value: latestEntry.contractions_per_10min != null ? `${latestEntry.contractions_per_10min}/10min` : '—', danger: false },
          ].map(({ icon: Icon, label, value, danger }) => (
            <div key={label} className={`rounded-xl border p-3 flex items-center gap-3 ${danger ? 'bg-red-50 border-red-200' : 'bg-slate-50 border-slate-200'}`}>
              <Icon className={`w-4 h-4 ${danger ? 'text-red-500' : 'text-slate-400'}`} />
              <div>
                <p className="text-xs text-slate-500">{label}</p>
                <p className={`text-sm font-bold ${danger ? 'text-red-700' : 'text-slate-800'}`}>{value}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Entry form */}
      {showForm && (
        <div className="bg-white rounded-2xl border border-slate-200 p-5 space-y-4">
          <h4 className="text-sm font-bold text-slate-900">New Partograph Entry</h4>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-sm">
            {[
              { key: 'cervical_dilation', label: 'Cervical dilation (cm)', type: 'number', min: 0, max: 10, step: 0.5 },
              { key: 'fetal_head_station', label: 'Head station (−5 to +5)', type: 'number', min: -5, max: 5 },
              { key: 'fetal_heart_rate', label: 'FHR (bpm)', type: 'number' },
              { key: 'contractions_per_10min', label: 'Contractions / 10 min', type: 'number', min: 0, max: 5 },
              { key: 'contraction_duration_secs', label: 'Contraction duration (s)', type: 'number' },
              { key: 'maternal_bp_systolic', label: 'BP systolic', type: 'number' },
              { key: 'maternal_bp_diastolic', label: 'BP diastolic', type: 'number' },
              { key: 'maternal_pulse', label: 'Maternal pulse', type: 'number' },
              { key: 'maternal_temp', label: 'Temperature (°C)', type: 'number', step: 0.1 },
              { key: 'urine_output_ml', label: 'Urine output (mL)', type: 'number' },
              { key: 'oxytocin_units', label: 'Oxytocin (units)', type: 'number', step: 0.5 },
            ].map(({ key, label, ...inputProps }) => (
              <div key={key}>
                <label className="block text-xs text-slate-600 mb-1">{label}</label>
                <input
                  {...inputProps}
                  value={(form as any)[key]}
                  onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
                  className="w-full px-2 py-1.5 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-pink-500 focus:border-transparent"
                />
              </div>
            ))}

            <div>
              <label className="block text-xs text-slate-600 mb-1">Liquor</label>
              <select
                value={form.liquor}
                onChange={(e) => setForm((f) => ({ ...f, liquor: e.target.value }))}
                className="w-full px-2 py-1.5 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-pink-500"
              >
                <option value="">—</option>
                {Object.entries(LIQUOR_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </div>

            <div>
              <label className="block text-xs text-slate-600 mb-1">Moulding</label>
              <select
                value={form.moulding}
                onChange={(e) => setForm((f) => ({ ...f, moulding: e.target.value }))}
                className="w-full px-2 py-1.5 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-pink-500"
              >
                <option value="">—</option>
                {MOULDING_LABELS.map((l, i) => <option key={i} value={i}>{l}</option>)}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-slate-600 mb-1">Drugs given</label>
              <input
                type="text"
                value={form.drugs_given}
                onChange={(e) => setForm((f) => ({ ...f, drugs_given: e.target.value }))}
                placeholder="e.g. Oxytocin 5U, Pethidine 50mg"
                className="w-full px-2 py-1.5 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-pink-500"
              />
            </div>
            <div>
              <label className="block text-xs text-slate-600 mb-1">Notes</label>
              <input
                type="text"
                value={form.notes}
                onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                className="w-full px-2 py-1.5 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-pink-500"
              />
            </div>
          </div>

          <div className="flex gap-3 pt-1">
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex items-center gap-2 px-4 py-2 bg-pink-600 text-white rounded-xl text-sm font-semibold hover:bg-pink-700 disabled:opacity-50 transition-colors"
            >
              {saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
              Save Entry
            </button>
            <button onClick={() => { setShowForm(false); setForm({ ...EMPTY_FORM }); }} className="px-4 py-2 border border-slate-300 text-slate-700 rounded-xl text-sm hover:bg-slate-50 transition-colors">
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Entry table */}
      {entries.length > 0 && (
        <div className="overflow-x-auto rounded-xl border border-slate-200">
          <table className="w-full text-xs">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                {['Time', 'Hrs', 'Dilation', 'Station', 'FHR', 'Ctx/10m', 'BP', 'Pulse', 'Temp', 'Liquor', 'Moulding', 'Alerts'].map((h) => (
                  <th key={h} className="px-2 py-2 text-left font-semibold text-slate-600 whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {entries.map((e) => {
                const hasCritical = e.alert_flags?.some((a) => a.severity === 'critical');
                return (
                  <tr key={e.id} className={hasCritical ? 'bg-red-50' : 'hover:bg-slate-50'}>
                    <td className="px-2 py-1.5 whitespace-nowrap">{new Date(e.entry_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</td>
                    <td className="px-2 py-1.5">{e.hours_in_labor?.toFixed(1) ?? '—'}</td>
                    <td className="px-2 py-1.5 font-semibold text-pink-700">{e.cervical_dilation != null ? `${e.cervical_dilation} cm` : '—'}</td>
                    <td className="px-2 py-1.5">{e.fetal_head_station != null ? (e.fetal_head_station > 0 ? `+${e.fetal_head_station}` : String(e.fetal_head_station)) : '—'}</td>
                    <td className={`px-2 py-1.5 font-semibold ${e.fetal_heart_rate != null && (e.fetal_heart_rate < 100 || e.fetal_heart_rate > 180) ? 'text-red-700' : ''}`}>
                      {e.fetal_heart_rate ?? '—'}
                    </td>
                    <td className="px-2 py-1.5">{e.contractions_per_10min ?? '—'}</td>
                    <td className="px-2 py-1.5 whitespace-nowrap">
                      {e.maternal_bp_systolic ? `${e.maternal_bp_systolic}/${e.maternal_bp_diastolic}` : '—'}
                    </td>
                    <td className="px-2 py-1.5">{e.maternal_pulse ?? '—'}</td>
                    <td className="px-2 py-1.5">{e.maternal_temp != null ? `${e.maternal_temp}°` : '—'}</td>
                    <td className="px-2 py-1.5">
                      {e.liquor ? (
                        <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${e.liquor === 'M' ? 'bg-amber-100 text-amber-800' : e.liquor === 'B' ? 'bg-red-100 text-red-800' : 'bg-slate-100 text-slate-700'}`}>
                          {LIQUOR_LABELS[e.liquor] ?? e.liquor}
                        </span>
                      ) : '—'}
                    </td>
                    <td className="px-2 py-1.5">{e.moulding != null ? e.moulding : '—'}</td>
                    <td className="px-2 py-1.5">
                      {e.alert_flags?.length > 0 ? (
                        <div className="flex gap-1 flex-wrap">
                          {e.alert_flags.map((a, i) => (
                            <span key={i} title={a.message} className={`w-2 h-2 rounded-full inline-block ${a.severity === 'critical' ? 'bg-red-500' : 'bg-amber-400'}`} />
                          ))}
                        </div>
                      ) : <CheckCircle className="w-3 h-3 text-green-500" />}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {entries.length === 0 && !loading && (
        <div className="text-center py-8 text-slate-500 text-sm">
          No partograph entries yet. Add the first entry when active labor begins.
        </div>
      )}
    </div>
  );
}
