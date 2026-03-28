import React, { useCallback, useEffect, useState } from 'react';
import { RefreshCw, ClipboardList } from 'lucide-react';
import { ehrApi } from '../services/api';

interface ModuleGeneralReportCardProps {
  moduleKey: string;
  title: string;
  tenantSlug: string;
  token: string;
  days?: number;
  accentClass?: string;
}

interface ModuleReportStat {
  key: string;
  label: string;
  value: number;
  tone?: 'info' | 'good' | 'warning' | 'critical';
  format?: 'currency';
}

const toneClasses: Record<string, string> = {
  info: 'border-cyan-200 bg-cyan-50 text-cyan-900',
  good: 'border-emerald-200 bg-emerald-50 text-emerald-900',
  warning: 'border-amber-200 bg-amber-50 text-amber-900',
  critical: 'border-red-200 bg-red-50 text-red-900',
};

const ModuleGeneralReportCard: React.FC<ModuleGeneralReportCardProps> = ({
  moduleKey,
  title,
  tenantSlug,
  token,
  days = 30,
  accentClass = 'from-slate-50 via-white to-slate-100',
}) => {
  const [loading, setLoading] = useState(false);
  const [report, setReport] = useState<any>(null);

  const loadReport = useCallback(async () => {
    if (!token || !tenantSlug) return;
    try {
      setLoading(true);
      const response = await ehrApi.getModuleGeneralReport(moduleKey, token, tenantSlug, days);
      setReport(response.data || null);
    } catch {
      setReport(null);
    } finally {
      setLoading(false);
    }
  }, [days, moduleKey, tenantSlug, token]);

  useEffect(() => {
    loadReport();
  }, [loadReport]);

  const formatStatValue = (stat: ModuleReportStat) => {
    if (stat.format === 'currency') {
      return `$${Number(stat.value || 0).toFixed(2)}`;
    }
    return Number(stat.value || 0).toLocaleString();
  };

  return (
    <section className={`rounded-2xl border border-slate-200 bg-gradient-to-r ${accentClass} p-4`}>
      <div className="mb-3 flex items-center justify-between gap-2">
        <h3 className="flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-slate-900">
          <ClipboardList className="h-4 w-4 text-slate-700" />
          {title} General Report ({days}d)
        </h3>
        <button
          type="button"
          onClick={loadReport}
          className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {!report?.available ? (
        <p className="text-sm text-slate-600">
          {report?.message || 'General report is unavailable for this module in the current tenant.'}
        </p>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-2 md:grid-cols-3 lg:grid-cols-6">
            {(report?.stats || []).slice(0, 6).map((stat: ModuleReportStat) => (
              <div
                key={`${moduleKey}-${stat.key}`}
                className={`rounded-lg border px-3 py-2 ${
                  toneClasses[String(stat.tone || 'info')] || toneClasses.info
                }`}
              >
                <p className="text-[11px] font-semibold uppercase tracking-wide opacity-80">{stat.label}</p>
                <p className="mt-1 text-lg font-bold">{formatStatValue(stat)}</p>
              </div>
            ))}
          </div>
          {Array.isArray(report?.recommendations) && report.recommendations.length > 0 && (
            <div className="mt-3 rounded-lg border border-slate-200 bg-white px-3 py-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-700">Recommendations</p>
              {report.recommendations.slice(0, 2).map((item: string, index: number) => (
                <p key={`${moduleKey}-recommendation-${index}`} className="mt-1 text-sm text-slate-700">
                  {item}
                </p>
              ))}
            </div>
          )}
        </>
      )}
    </section>
  );
};

export default ModuleGeneralReportCard;
