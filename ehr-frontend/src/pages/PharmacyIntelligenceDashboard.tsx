import React, { useState, useCallback, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { ehrAxios } from '../services/api';
import {
  Pill, AlertTriangle, CheckCircle, TrendingDown, RefreshCw,
  ShieldAlert, PackageX, BarChart2,
} from 'lucide-react';

type ReportTab = 'formulary' | 'waste' | 'ams';

const authHeaders = (token: string | null, tenantId: string) => ({
  Authorization: `Bearer ${token}`,
  'x-tenant-id': tenantId,
});

export default function PharmacyIntelligenceDashboard() {
  const { tenantSlug } = useParams<{ tenantSlug: string }>();
  const token = localStorage.getItem('ehr_token');
  const tenantId = tenantSlug ?? '';

  const [tab, setTab] = useState<ReportTab>('formulary');
  const [period, setPeriod] = useState(() => new Date().toISOString().slice(0, 7).replace('-', ''));
  const [formulary, setFormulary] = useState<any>(null);
  const [waste, setWaste] = useState<any>(null);
  const [ams, setAms] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const hdrs = useCallback(() => authHeaders(token, tenantId), [token, tenantId]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      if (tab === 'formulary') {
        const r = await ehrAxios.get(`/pharmacy/reports/formulary-adherence?period=${period}`, { headers: hdrs() });
        setFormulary(r.data);
      } else if (tab === 'waste') {
        const r = await ehrAxios.get(`/pharmacy/reports/drug-waste?period=${period}`, { headers: hdrs() });
        setWaste(r.data);
      } else {
        const r = await ehrAxios.get(`/pharmacy/reports/ams?period=${period}`, { headers: hdrs() });
        setAms(r.data);
      }
    } catch { /* handled silently */ }
    setLoading(false);
  }, [tab, period, hdrs]);

  useEffect(() => { load(); }, [tab, period, load]);

  const TabBtn = ({ k, label }: { k: ReportTab; label: string }) => (
    <button
      onClick={() => setTab(k)}
      className={`px-4 py-2 rounded-t-lg text-sm font-medium border-b-2 transition-colors ${
        tab === k ? 'border-teal-400 text-teal-300 bg-gray-800' : 'border-transparent text-gray-400 hover:text-gray-200'
      }`}
    >
      {label}
    </button>
  );

  return (
    <div className="min-h-screen bg-gray-900 text-gray-100 p-6">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center gap-3 mb-6">
          <Pill size={24} className="text-teal-400" />
          <h1 className="text-2xl font-bold text-white">Pharmacy Intelligence</h1>
        </div>

        <div className="flex gap-1 border-b border-gray-700 mb-6">
          <TabBtn k="formulary" label="Formulary Adherence" />
          <TabBtn k="waste" label="Drug Waste" />
          <TabBtn k="ams" label="Antimicrobial Stewardship" />
        </div>

        <div className="flex items-end gap-4 mb-6">
          <div>
            <label className="text-xs text-gray-400 block mb-1">Period (YYYYMM)</label>
            <input
              value={period}
              onChange={e => setPeriod(e.target.value)}
              className="bg-gray-800 border border-gray-600 rounded px-3 py-1 text-sm w-28"
              maxLength={6}
            />
          </div>
          <button
            onClick={load}
            className="flex items-center gap-1 bg-teal-600 hover:bg-teal-500 text-white px-3 py-2 rounded text-sm"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> Refresh
          </button>
        </div>

        {loading && <div className="text-gray-400 text-sm">Loading…</div>}

        {/* Formulary Adherence */}
        {tab === 'formulary' && formulary && !loading && (
          <div className="space-y-6">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[
                { label: 'Total Prescriptions', val: formulary.total_prescriptions, icon: <Pill size={18} className="text-teal-400" /> },
                { label: 'Formulary', val: formulary.formulary_prescriptions, icon: <CheckCircle size={18} className="text-green-400" /> },
                { label: 'Adherence Rate', val: formulary.adherence_rate_pct + '%', icon: <CheckCircle size={18} className="text-teal-400" /> },
                { label: 'Off-Formulary', val: formulary.off_formulary_count, icon: <AlertTriangle size={18} className="text-red-400" /> },
              ].map(c => (
                <div key={c.label} className="bg-gray-800 rounded-lg p-4 flex items-center gap-3">
                  {c.icon}
                  <div>
                    <div className="text-xs text-gray-400">{c.label}</div>
                    <div className="text-xl font-bold text-white">{c.val?.toLocaleString?.() ?? c.val}</div>
                  </div>
                </div>
              ))}
            </div>
            {formulary.top_off_formulary_drugs?.length > 0 && (
              <div className="bg-gray-800 rounded-lg p-4">
                <h3 className="text-sm font-semibold text-gray-300 mb-3">Top Off-Formulary Drugs</h3>
                <div className="space-y-2">
                  {formulary.top_off_formulary_drugs.map((d: any) => (
                    <div key={d.drug_name} className="flex justify-between text-sm">
                      <span className="text-gray-300">{d.drug_name}</span>
                      <span className="text-red-400 font-bold">{d.n}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {formulary.prescriber_outliers?.length > 0 && (
              <div className="bg-gray-800 rounded-lg p-4">
                <h3 className="text-sm font-semibold text-gray-300 mb-3">Prescribers with Highest Off-Formulary Rate</h3>
                <table className="w-full text-sm">
                  <thead><tr className="text-gray-400 text-xs border-b border-gray-700">
                    <th className="text-left py-2 pr-4">Prescriber ID</th>
                    <th className="text-right py-2 pr-4">Total Rx</th>
                    <th className="text-right py-2">Off-Formulary</th>
                  </tr></thead>
                  <tbody>
                    {formulary.prescriber_outliers.map((p: any) => (
                      <tr key={p.prescriber_id} className="border-b border-gray-700/50">
                        <td className="py-2 pr-4 text-gray-300 font-mono text-xs">{p.prescriber_id?.slice(0,8)}…</td>
                        <td className="py-2 pr-4 text-right text-gray-200">{p.total}</td>
                        <td className="py-2 text-right text-red-400 font-bold">{p.off_formulary}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Drug Waste */}
        {tab === 'waste' && waste && !loading && (
          <div className="space-y-6">
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              {[
                { label: 'Expired Units', val: waste.expired_units, icon: <PackageX size={18} className="text-red-400" /> },
                { label: 'Expired Value (USD)', val: '$' + Number(waste.expired_value).toFixed(2), icon: <TrendingDown size={18} className="text-red-400" /> },
                { label: 'Returned Units', val: waste.returned_units, icon: <AlertTriangle size={18} className="text-yellow-400" /> },
                { label: 'Damaged Units', val: waste.damaged_units, icon: <AlertTriangle size={18} className="text-orange-400" /> },
                { label: 'Inventory Value', val: '$' + Number(waste.total_inventory_value).toLocaleString(), icon: <Pill size={18} className="text-teal-400" /> },
              ].map(c => (
                <div key={c.label} className="bg-gray-800 rounded-lg p-4 flex items-center gap-3">
                  {c.icon}
                  <div>
                    <div className="text-xs text-gray-400">{c.label}</div>
                    <div className="text-xl font-bold text-white">{c.val}</div>
                  </div>
                </div>
              ))}
            </div>
            {waste.near_expiry_items?.length > 0 && (
              <div className="bg-gray-800 rounded-lg p-4">
                <h3 className="text-sm font-semibold text-gray-300 mb-3 flex items-center gap-2">
                  <AlertTriangle size={14} className="text-yellow-400" /> Near-Expiry Items (≤90 days)
                </h3>
                <table className="w-full text-sm">
                  <thead><tr className="text-gray-400 text-xs border-b border-gray-700">
                    <th className="text-left py-2 pr-4">Drug</th>
                    <th className="text-right py-2 pr-4">Qty</th>
                    <th className="text-right py-2">Expiry</th>
                  </tr></thead>
                  <tbody>
                    {waste.near_expiry_items.map((item: any, i: number) => (
                      <tr key={i} className="border-b border-gray-700/50">
                        <td className="py-2 pr-4 text-gray-200">{item.drug_name}</td>
                        <td className="py-2 pr-4 text-right text-gray-200">{item.quantity}</td>
                        <td className="py-2 text-right text-yellow-400">{item.expiry_date?.slice(0,10)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* AMS */}
        {tab === 'ams' && ams && !loading && (
          <div className="space-y-6">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[
                { label: 'Antibiotic Prescriptions', val: ams.total_antibiotic_prescriptions, icon: <ShieldAlert size={18} className="text-red-400" /> },
                { label: 'Restricted Antibiotics', val: ams.restricted_antibiotic_prescriptions, icon: <AlertTriangle size={18} className="text-orange-400" /> },
                { label: 'Cultures Collected', val: ams.cultures_collected, icon: <CheckCircle size={18} className="text-teal-400" /> },
                { label: 'IV Rate', val: ams.iv_rate_pct + '%', icon: <Pill size={18} className="text-blue-400" /> },
                { label: 'Total DDD', val: ams.total_ddd?.toFixed(1), icon: <BarChart2 size={18} className="text-purple-400" /> },
                { label: 'Patients on Antibiotics', val: ams.patients_on_antibiotics, icon: <ShieldAlert size={18} className="text-yellow-400" /> },
              ].map(c => (
                <div key={c.label} className="bg-gray-800 rounded-lg p-4 flex items-center gap-3">
                  {c.icon}
                  <div>
                    <div className="text-xs text-gray-400">{c.label}</div>
                    <div className="text-xl font-bold text-white">{c.val?.toLocaleString?.() ?? c.val ?? '—'}</div>
                  </div>
                </div>
              ))}
            </div>
            {ams.by_antibiotic_class?.length > 0 && (
              <div className="bg-gray-800 rounded-lg p-4">
                <h3 className="text-sm font-semibold text-gray-300 mb-3">Prescriptions by Antibiotic Class</h3>
                <div className="space-y-2">
                  {ams.by_antibiotic_class.map((c: any) => {
                    const maxN = Math.max(...ams.by_antibiotic_class.map((x: any) => x.n), 1);
                    return (
                      <div key={c.drug_class} className="flex items-center gap-3">
                        <div className="w-32 text-xs text-gray-300 truncate">{c.drug_class}</div>
                        <div className="flex-1 bg-gray-700 rounded-full h-2">
                          <div className="bg-red-500 h-2 rounded-full" style={{ width: `${(c.n / maxN) * 100}%` }} />
                        </div>
                        <div className="text-xs text-gray-400 w-10 text-right">{c.n}</div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
