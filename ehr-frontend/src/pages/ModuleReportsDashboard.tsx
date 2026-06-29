import React, { useState, useCallback, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { ehrAxios } from '../services/api';
import {
  Activity, Droplets, Scan, Filter, Smile, Plane, HardHat,
  RefreshCw, FileText, ChevronRight,
} from 'lucide-react';

interface ModuleDef { key: string; label: string; icon: string }

const ICONS: Record<string, React.ReactNode> = {
  activity: <Activity size={20} className="text-teal-400" />,
  droplets: <Droplets size={20} className="text-red-400" />,
  scan: <Scan size={20} className="text-blue-400" />,
  filter: <Filter size={20} className="text-purple-400" />,
  smile: <Smile size={20} className="text-yellow-400" />,
  plane: <Plane size={20} className="text-sky-400" />,
  'hard-hat': <HardHat size={20} className="text-orange-400" />,
};

const authHeaders = (token: string | null, tenantId: string) => ({
  Authorization: `Bearer ${token}`,
  'x-tenant-id': tenantId,
});

function formatKey(key: string): string {
  return key.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

function formatValue(val: any): string {
  if (val === null || val === undefined) return '—';
  if (typeof val === 'number') return Number.isInteger(val) ? val.toLocaleString() : val.toFixed(2);
  if (typeof val === 'string' && val.includes('T')) {
    try { return new Date(val).toLocaleDateString(); } catch { /* ignore */ }
  }
  return String(val);
}

export default function ModuleReportsDashboard() {
  const { tenantSlug } = useParams<{ tenantSlug: string }>();
  const token = localStorage.getItem('ehr_token');
  const tenantId = tenantSlug ?? '';

  const [modules, setModules] = useState<ModuleDef[]>([]);
  const [selectedModule, setSelectedModule] = useState<string | null>(null);
  const [period, setPeriod] = useState(() => new Date().toISOString().slice(0, 7).replace('-', ''));
  const [report, setReport] = useState<Record<string, any> | null>(null);
  const [loading, setLoading] = useState(false);

  const hdrs = useCallback(() => authHeaders(token, tenantId), [token, tenantId]);

  useEffect(() => {
    ehrAxios.get(`/tenants/${tenantId}/module-reports`, { headers: hdrs() })
      .then(r => setModules(r.data ?? []))
      .catch(() => { /* ignore */ });
  }, [tenantId, hdrs]);

  const loadReport = useCallback(async () => {
    if (!selectedModule) return;
    setLoading(true);
    setReport(null);
    try {
      const res = await ehrAxios.get(
        `/tenants/${tenantId}/module-reports/${selectedModule}?period=${period}`,
        { headers: hdrs() },
      );
      setReport(res.data);
    } catch { /* handled silently */ }
    setLoading(false);
  }, [tenantId, selectedModule, period, hdrs]);

  useEffect(() => {
    if (selectedModule) loadReport();
  }, [selectedModule, period, loadReport]);

  const reportEntries = report
    ? Object.entries(report).filter(([k]) => !['module', 'period', 'generated_at', 'by_modality', 'by_access_type'].includes(k))
    : [];
  const arrayEntries = report
    ? Object.entries(report).filter(([k, v]) => Array.isArray(v))
    : [];

  return (
    <div className="min-h-screen bg-gray-900 text-gray-100 p-6">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center gap-3 mb-6">
          <FileText size={24} className="text-teal-400" />
          <h1 className="text-2xl font-bold text-white">Module Reports</h1>
        </div>

        {/* Module grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-7 gap-3 mb-6">
          {modules.map(m => (
            <button
              key={m.key}
              onClick={() => setSelectedModule(m.key === selectedModule ? null : m.key)}
              className={`flex flex-col items-center gap-2 p-3 rounded-lg border transition-colors text-center ${
                selectedModule === m.key
                  ? 'border-teal-500 bg-teal-900/30 text-white'
                  : 'border-gray-700 bg-gray-800 text-gray-400 hover:border-gray-500 hover:text-gray-200'
              }`}
            >
              {ICONS[m.icon] ?? <Activity size={20} />}
              <span className="text-xs font-medium leading-tight">{m.label}</span>
            </button>
          ))}
        </div>

        {selectedModule && (
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
              onClick={loadReport}
              className="flex items-center gap-1 bg-teal-600 hover:bg-teal-500 text-white px-3 py-2 rounded text-sm"
            >
              <RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> Refresh
            </button>
          </div>
        )}

        {loading && <div className="text-gray-400 text-sm">Loading report…</div>}

        {report && !loading && (
          <div className="space-y-4">
            <div className="flex items-center gap-3 mb-2">
              {ICONS[modules.find(m => m.key === report.module)?.icon ?? ''] ?? <FileText size={20} className="text-teal-400" />}
              <h2 className="text-lg font-semibold text-white">
                {modules.find(m => m.key === report.module)?.label ?? report.module} Report
              </h2>
              <span className="text-sm text-gray-400">— {report.period}</span>
            </div>

            {/* KPI cards */}
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
              {reportEntries.map(([key, value]) => (
                <div key={key} className="bg-gray-800 rounded-lg p-4">
                  <div className="text-xs text-gray-400 mb-1">{formatKey(key)}</div>
                  <div className="text-xl font-bold text-white">{formatValue(value)}</div>
                </div>
              ))}
            </div>

            {/* Array breakdown tables */}
            {arrayEntries.map(([key, rows]) => (
              <div key={key} className="bg-gray-800 rounded-lg p-4">
                <h3 className="text-sm font-semibold text-gray-300 mb-3 flex items-center gap-2">
                  <ChevronRight size={14} className="text-teal-400" /> {formatKey(key)}
                </h3>
                {(rows as any[]).length === 0 ? (
                  <p className="text-gray-500 text-xs">No data</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-gray-400 text-xs border-b border-gray-700">
                          {Object.keys((rows as any[])[0]).map(k => (
                            <th key={k} className="text-left py-2 pr-4">{formatKey(k)}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {(rows as any[]).map((row, i) => (
                          <tr key={i} className="border-b border-gray-700/50">
                            {Object.values(row).map((v, j) => (
                              <td key={j} className="py-2 pr-4 text-gray-200">{formatValue(v)}</td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            ))}

            <div className="text-xs text-gray-500">Generated: {new Date(report.generated_at).toLocaleString()}</div>
          </div>
        )}

        {!selectedModule && modules.length > 0 && (
          <div className="text-center text-gray-500 py-16">
            Select a module above to view its period report
          </div>
        )}
      </div>
    </div>
  );
}
