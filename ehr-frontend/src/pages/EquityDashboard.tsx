import React, { useState, useCallback, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { ehrAxios } from '../services/api';
import {
  Users, BarChart2, RefreshCw, AlertTriangle, CheckCircle, Globe,
} from 'lucide-react';

type Dimension = 'sex' | 'age_band' | 'location' | 'insurance';

const KPIS = [
  { value: 'hiv_on_art', label: 'HIV on ART' },
  { value: 'tb_treatment_success', label: 'TB Treatment Success' },
  { value: 'hypertension_controlled', label: 'HTN Controlled' },
  { value: 'diabetes_controlled', label: 'DM Controlled' },
  { value: 'anc_coverage', label: 'ANC Coverage' },
  { value: 'delivery_facility', label: 'Facility Delivery' },
  { value: 'vaccination_coverage', label: 'Vaccination' },
  { value: 'nutrition_sam_recovery', label: 'SAM Recovery' },
];

const DIMS: { value: Dimension; label: string }[] = [
  { value: 'sex', label: 'Sex' },
  { value: 'age_band', label: 'Age Band' },
  { value: 'location', label: 'Location' },
  { value: 'insurance', label: 'Insurance' },
];

interface DisaggResult {
  kpi: string;
  dimension: string;
  period: string;
  data: { dval: string; numerator: number; denominator: number; rate: number | null }[];
  equity_ratio: number | null;
  equity_gap: string | null;
}

const authHeaders = (token: string | null, tenantId: string) => ({
  Authorization: `Bearer ${token}`,
  'x-tenant-id': tenantId,
});

function ratePct(r: number | null) {
  if (r == null) return '—';
  return (r * 100).toFixed(1) + '%';
}

function equityColor(ratio: number | null) {
  if (ratio === null) return 'text-gray-400';
  if (ratio >= 0.9) return 'text-teal-400';
  if (ratio >= 0.75) return 'text-yellow-400';
  return 'text-red-400';
}

export default function EquityDashboard() {
  const { tenantSlug } = useParams<{ tenantSlug: string }>();
  const token = localStorage.getItem('ehr_token');
  const tenantId = tenantSlug ?? '';

  const [period, setPeriod] = useState(() => new Date().toISOString().slice(0, 7).replace('-', ''));
  const [kpi, setKpi] = useState('hiv_on_art');
  const [dimension, setDimension] = useState<Dimension>('sex');
  const [result, setResult] = useState<DisaggResult | null>(null);
  const [summary, setSummary] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const hdrs = useCallback(() => authHeaders(token, tenantId), [token, tenantId]);

  const runDisaggregate = useCallback(async () => {
    setLoading(true);
    try {
      const res = await ehrAxios.get(
        `/tenants/${tenantId}/equity/disaggregate?kpi=${kpi}&dimension=${dimension}&period=${period}`,
        { headers: hdrs() },
      );
      setResult(res.data);
    } catch { /* handled silently */ }
    setLoading(false);
  }, [tenantId, kpi, dimension, period, hdrs]);

  const loadSummary = useCallback(async () => {
    try {
      const res = await ehrAxios.get(`/tenants/${tenantId}/equity/summary?period=${period}`, { headers: hdrs() });
      setSummary(res.data ?? []);
    } catch { /* handled silently */ }
  }, [tenantId, period, hdrs]);

  useEffect(() => {
    loadSummary();
  }, [period, loadSummary]);

  const maxRate = result
    ? Math.max(...result.data.map(d => d.rate ?? 0), 0.01)
    : 1;

  return (
    <div className="min-h-screen bg-gray-900 text-gray-100 p-6">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center gap-3 mb-6">
          <Users size={24} className="text-teal-400" />
          <h1 className="text-2xl font-bold text-white">Equity Analytics</h1>
        </div>

        {/* Controls */}
        <div className="bg-gray-800 rounded-lg p-4 mb-6 flex flex-wrap items-end gap-4">
          <div>
            <label className="text-xs text-gray-400 block mb-1">Period (YYYYMM)</label>
            <input
              value={period}
              onChange={e => setPeriod(e.target.value)}
              className="bg-gray-700 border border-gray-600 rounded px-3 py-1 text-sm w-28"
              maxLength={6}
            />
          </div>
          <div>
            <label className="text-xs text-gray-400 block mb-1">KPI</label>
            <select
              value={kpi}
              onChange={e => setKpi(e.target.value)}
              className="bg-gray-700 border border-gray-600 rounded px-3 py-1 text-sm"
            >
              {KPIS.map(k => <option key={k.value} value={k.value}>{k.label}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs text-gray-400 block mb-1">Disaggregate By</label>
            <div className="flex gap-2">
              {DIMS.map(d => (
                <button
                  key={d.value}
                  onClick={() => setDimension(d.value)}
                  className={`px-3 py-1 rounded text-sm transition-colors ${
                    dimension === d.value
                      ? 'bg-teal-600 text-white'
                      : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                  }`}
                >
                  {d.label}
                </button>
              ))}
            </div>
          </div>
          <button
            onClick={runDisaggregate}
            disabled={loading}
            className="flex items-center gap-1 bg-teal-600 hover:bg-teal-500 text-white px-4 py-2 rounded text-sm disabled:opacity-50"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            Analyse
          </button>
        </div>

        {/* Disaggregation result */}
        {result && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
            <div className="lg:col-span-2 bg-gray-800 rounded-lg p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold text-gray-300">
                  {KPIS.find(k => k.value === result.kpi)?.label ?? result.kpi} by {result.dimension}
                </h3>
                <span className={`text-sm font-bold ${equityColor(result.equity_ratio)}`}>
                  Equity ratio: {result.equity_ratio != null ? result.equity_ratio.toFixed(3) : '—'}
                </span>
              </div>
              {result.data.length === 0 && (
                <p className="text-gray-500 text-sm">No data for this period/KPI combination.</p>
              )}
              <div className="space-y-3">
                {result.data.map(row => (
                  <div key={row.dval} className="flex items-center gap-3">
                    <div className="w-24 text-xs text-gray-300 truncate">{row.dval ?? '—'}</div>
                    <div className="flex-1 bg-gray-700 rounded-full h-3">
                      <div
                        className={`h-3 rounded-full ${
                          row.rate != null && row.rate === Math.max(...result.data.map(d => d.rate ?? 0))
                            ? 'bg-teal-500'
                            : row.rate != null && row.rate === Math.min(...result.data.filter(d => d.rate != null).map(d => d.rate as number))
                              ? 'bg-red-500'
                              : 'bg-blue-500'
                        }`}
                        style={{ width: `${((row.rate ?? 0) / maxRate) * 100}%` }}
                      />
                    </div>
                    <div className="w-16 text-right text-xs text-gray-300">{ratePct(row.rate)}</div>
                    <div className="w-24 text-right text-xs text-gray-500">{row.numerator}/{row.denominator}</div>
                  </div>
                ))}
              </div>
              {result.equity_gap && (
                <p className="mt-3 text-xs text-yellow-400 flex items-center gap-1">
                  <AlertTriangle size={12} /> {result.equity_gap}
                </p>
              )}
            </div>

            <div className="bg-gray-800 rounded-lg p-4">
              <h3 className="text-sm font-semibold text-gray-300 mb-3 flex items-center gap-2">
                <BarChart2 size={16} className="text-teal-400" /> Equity Interpretation
              </h3>
              <div className="space-y-3 text-sm">
                <div className="flex items-start gap-2">
                  <CheckCircle size={14} className="text-teal-400 mt-0.5" />
                  <div>
                    <div className="text-gray-200 font-medium">Equity Ratio ≥ 0.90</div>
                    <div className="text-gray-400 text-xs">Equitable — worst group &ge; 90% of best</div>
                  </div>
                </div>
                <div className="flex items-start gap-2">
                  <AlertTriangle size={14} className="text-yellow-400 mt-0.5" />
                  <div>
                    <div className="text-gray-200 font-medium">0.75 – 0.89</div>
                    <div className="text-gray-400 text-xs">Moderate inequity — investigate barriers</div>
                  </div>
                </div>
                <div className="flex items-start gap-2">
                  <AlertTriangle size={14} className="text-red-400 mt-0.5" />
                  <div>
                    <div className="text-gray-200 font-medium">&lt; 0.75</div>
                    <div className="text-gray-400 text-xs">High inequity — targeted intervention needed</div>
                  </div>
                </div>
              </div>
              <div className="mt-4 pt-4 border-t border-gray-700">
                <div className="text-xs text-gray-400 mb-1">Current Score</div>
                <div className={`text-3xl font-bold ${equityColor(result.equity_ratio)}`}>
                  {result.equity_ratio != null ? (result.equity_ratio * 100).toFixed(1) + '%' : '—'}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Summary across all cached KPIs */}
        {summary.length > 0 && (
          <div className="bg-gray-800 rounded-lg p-4">
            <h3 className="text-sm font-semibold text-gray-300 mb-3 flex items-center gap-2">
              <Globe size={16} className="text-teal-400" /> Equity Summary — {period}
            </h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-gray-400 text-xs border-b border-gray-700">
                    <th className="text-left py-2 pr-4">KPI</th>
                    <th className="text-left py-2 pr-4">Dimension</th>
                    <th className="text-right py-2 pr-4">Equity Ratio</th>
                    <th className="text-left py-2">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {summary.map((row: any) => (
                    <tr key={`${row.kpi}-${row.dimension}`} className="border-b border-gray-700/50">
                      <td className="py-2 pr-4 text-gray-200">{KPIS.find(k => k.value === row.kpi)?.label ?? row.kpi}</td>
                      <td className="py-2 pr-4 text-gray-400">{row.dimension}</td>
                      <td className={`py-2 pr-4 text-right font-bold ${equityColor(row.equity_ratio)}`}>
                        {row.equity_ratio != null ? row.equity_ratio.toFixed(3) : '—'}
                      </td>
                      <td className="py-2">
                        {row.equity_ratio == null ? <span className="text-gray-500 text-xs">No data</span>
                          : row.equity_ratio >= 0.9 ? <span className="text-teal-400 text-xs">Equitable</span>
                            : row.equity_ratio >= 0.75 ? <span className="text-yellow-400 text-xs">Monitor</span>
                              : <span className="text-red-400 text-xs font-semibold">Action needed</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
