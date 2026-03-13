import React, { useMemo, useState } from 'react';
import { UploadCloud, RefreshCw, FileBarChart2 } from 'lucide-react';
import { ehrApi } from '../services/api';
import { useNotification } from './GlobalNotification';
import ModuleGeneralReportCard from './ModuleGeneralReportCard';

interface HivReportsPanelProps {
  tenantSlug: string;
  token: string;
}

const HivReportsPanel: React.FC<HivReportsPanelProps> = ({ tenantSlug, token }) => {
  const { showError, showSuccess } = useNotification();
  const today = new Date();
  const [year, setYear] = useState<number>(today.getFullYear());
  const [month, setMonth] = useState<number>(today.getMonth() + 1);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);

  const period = useMemo(() => `${year}${String(month).padStart(2, '0')}`, [month, year]);

  const periodWindow = useMemo(() => {
    const start = new Date(Date.UTC(year, month - 1, 1));
    const end = new Date(Date.UTC(year, month, 0));
    return {
      periodStart: start.toISOString().slice(0, 10),
      periodEnd: end.toISOString().slice(0, 10),
    };
  }, [month, year]);

  const runDhis2Report = async () => {
    if (!tenantSlug || !token) return;
    try {
      setLoading(true);
      const response = await ehrApi.sendDhis2AggregateReport(
        {
          profile: 'hiv_monthly',
          period,
          periodStart: periodWindow.periodStart,
          periodEnd: periodWindow.periodEnd,
        },
        token,
        tenantSlug,
      );
      setResult(response.data || null);
      if (String(response.data?.status || '').toUpperCase() === 'SUCCESS') {
        showSuccess('DHIS2 sync completed', `HIV monthly aggregate report sent for ${period}.`);
      } else {
        showError('DHIS2 sync not completed', response.data?.message || 'Unable to submit HIV aggregate report.');
      }
    } catch (error: any) {
      showError('DHIS2 sync failed', error?.response?.data?.message || error?.message || 'Failed to send HIV aggregate report');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <ModuleGeneralReportCard
        moduleKey="hiv"
        title="HIV Program"
        tenantSlug={tenantSlug}
        token={token}
        accentClass="from-red-50 via-white to-orange-50"
      />

      <section className="rounded-2xl border border-red-200 bg-gradient-to-r from-red-50 via-white to-orange-50 p-4">
        <div className="mb-3 flex items-center justify-between gap-2">
          <h3 className="flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-red-900">
            <FileBarChart2 className="h-4 w-4 text-red-700" />
            DHIS2 HIV Aggregate Reporting
          </h3>
          <button
            type="button"
            onClick={runDhis2Report}
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-lg bg-red-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-red-800 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <UploadCloud className="h-3.5 w-3.5" />}
            Send To DHIS2
          </button>
        </div>

        <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
          <div>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-600">Year</label>
            <input
              type="number"
              value={year}
              onChange={(e) => setYear(Number(e.target.value || today.getFullYear()))}
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900"
              min={2000}
              max={2100}
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-600">Month</label>
            <select
              value={month}
              onChange={(e) => setMonth(Number(e.target.value))}
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900"
            >
              {Array.from({ length: 12 }).map((_, index) => (
                <option key={`hiv-report-month-${index + 1}`} value={index + 1}>
                  {new Date(2026, index, 1).toLocaleString('en-US', { month: 'long' })}
                </option>
              ))}
            </select>
          </div>
          <div className="rounded-lg border border-slate-200 bg-white px-3 py-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Period</p>
            <p className="mt-1 text-sm font-bold text-slate-900">{period}</p>
          </div>
          <div className="rounded-lg border border-slate-200 bg-white px-3 py-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Window</p>
            <p className="mt-1 text-sm font-bold text-slate-900">
              {periodWindow.periodStart} to {periodWindow.periodEnd}
            </p>
          </div>
        </div>

        {result && (
          <div className="mt-3 rounded-lg border border-slate-200 bg-white px-3 py-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-700">
              Last DHIS2 Response ({String(result?.status || 'UNKNOWN').toUpperCase()})
            </p>
            <div className="mt-2 grid grid-cols-2 gap-2 md:grid-cols-5">
              <div className="rounded-md border border-slate-200 bg-slate-50 px-2 py-1.5">
                <p className="text-[11px] text-slate-500">Imported</p>
                <p className="text-sm font-bold text-slate-900">{Number(result?.imported || 0)}</p>
              </div>
              <div className="rounded-md border border-slate-200 bg-slate-50 px-2 py-1.5">
                <p className="text-[11px] text-slate-500">Updated</p>
                <p className="text-sm font-bold text-slate-900">{Number(result?.updated || 0)}</p>
              </div>
              <div className="rounded-md border border-slate-200 bg-slate-50 px-2 py-1.5">
                <p className="text-[11px] text-slate-500">Ignored</p>
                <p className="text-sm font-bold text-slate-900">{Number(result?.ignored || 0)}</p>
              </div>
              <div className="rounded-md border border-slate-200 bg-slate-50 px-2 py-1.5">
                <p className="text-[11px] text-slate-500">Data Values</p>
                <p className="text-sm font-bold text-slate-900">{Number(result?.dataValues || 0)}</p>
              </div>
              <div className="rounded-md border border-slate-200 bg-slate-50 px-2 py-1.5">
                <p className="text-[11px] text-slate-500">Profile</p>
                <p className="text-sm font-bold text-slate-900">{String(result?.profile || 'hiv_monthly')}</p>
              </div>
            </div>
            {result?.message && <p className="mt-2 text-sm text-slate-700">{String(result.message)}</p>}
          </div>
        )}
      </section>
    </div>
  );
};

export default HivReportsPanel;
