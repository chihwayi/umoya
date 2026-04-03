import React, { useState, useCallback } from 'react';
import { driftAPI } from '../services/api';

interface ColumnDrift {
  tableName: string;
  missingColumns: string[];
}

interface DriftReport {
  ok: boolean;
  checkedAt: string;
  tableCount: number;
  missingTableCount: number;
  missingColumnTableCount: number;
  missingTables: string[];
  tablesWithMissingColumns: ColumnDrift[];
}

interface TenantDriftResult {
  tenantId: string;
  tenantName: string;
  databaseName: string;
  drift: DriftReport | null;
  error?: string;
  // present after auto-repair
  attempts?: number;
  before?: DriftReport;
  after?: DriftReport;
  resolved?: boolean;
}

type TenantState = TenantDriftResult & {
  status: 'idle' | 'scanning' | 'repairing' | 'done';
  expanded: boolean;
};

const ACCENT = '#00C896';
const WARN = '#FF7A40';
const ERR = '#FF4D4D';
const BLUE = '#2B7FFF';

function DriftBadge({ report }: { report: DriftReport | null }) {
  if (!report) return <span className="text-xs px-2 py-0.5 rounded-full bg-red-500/20 text-red-400 font-semibold">Error</span>;
  if (report.ok) return <span className="text-xs px-2 py-0.5 rounded-full font-semibold" style={{ background: `${ACCENT}18`, color: ACCENT }}>Clean</span>;
  const total = report.missingTableCount + report.missingColumnTableCount;
  return (
    <span className="text-xs px-2 py-0.5 rounded-full font-semibold" style={{ background: `${WARN}18`, color: WARN }}>
      {total} drift{total !== 1 ? 's' : ''}
    </span>
  );
}

function DriftDetail({ drift }: { drift: DriftReport }) {
  if (drift.ok) {
    return <p className="text-xs text-[#00C896] mt-2">All {drift.tableCount} tables match entity definitions.</p>;
  }
  return (
    <div className="mt-2 space-y-2">
      {drift.missingTables.length > 0 && (
        <div className="rounded-xl border border-red-500/20 bg-red-500/[0.06] p-3">
          <p className="text-xs font-semibold text-red-400 mb-1">Missing tables ({drift.missingTables.length})</p>
          <div className="flex flex-wrap gap-1">
            {drift.missingTables.map((t) => (
              <code key={t} className="text-[10px] bg-red-500/10 text-red-300 px-1.5 py-0.5 rounded">{t}</code>
            ))}
          </div>
        </div>
      )}
      {drift.tablesWithMissingColumns.map((entry) => (
        <div key={entry.tableName} className="rounded-xl border border-orange-500/20 bg-orange-500/[0.06] p-3">
          <p className="text-xs font-semibold text-orange-400 mb-1">{entry.tableName} — {entry.missingColumns.length} missing column{entry.missingColumns.length !== 1 ? 's' : ''}</p>
          <div className="flex flex-wrap gap-1">
            {entry.missingColumns.map((c) => (
              <code key={c} className="text-[10px] bg-orange-500/10 text-orange-300 px-1.5 py-0.5 rounded">{c}</code>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function RepairResult({ state }: { state: TenantState }) {
  if (state.attempts === undefined || state.before === undefined || state.after === undefined) return null;

  if (state.attempts === 0) {
    return <p className="text-xs mt-2" style={{ color: ACCENT }}>Already clean — no repair needed.</p>;
  }

  return (
    <div className="mt-2 rounded-xl border p-3 space-y-2" style={{ borderColor: state.resolved ? `${ACCENT}30` : `${ERR}30`, background: state.resolved ? `${ACCENT}08` : `${ERR}08` }}>
      <div className="flex items-center gap-2">
        {state.resolved ? (
          <svg className="w-4 h-4 shrink-0" style={{ color: ACCENT }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        ) : (
          <svg className="w-4 h-4 shrink-0" style={{ color: ERR }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        )}
        <p className="text-xs font-semibold" style={{ color: state.resolved ? ACCENT : ERR }}>
          {state.resolved
            ? `Resolved after ${state.attempts} repair attempt${state.attempts !== 1 ? 's' : ''}`
            : `Still drifted after ${state.attempts} repair attempt${state.attempts !== 1 ? 's' : ''} — manual investigation needed`}
        </p>
      </div>
      {!state.resolved && state.after && <DriftDetail drift={state.after} />}
      {!state.resolved && (
        <div className="rounded-lg border border-yellow-500/20 bg-yellow-500/[0.06] p-2 mt-1">
          <p className="text-[10px] text-yellow-400 font-semibold mb-0.5">Suggested next steps</p>
          <ul className="text-[10px] text-yellow-300 space-y-0.5 list-disc list-inside">
            <li>Re-run <code className="bg-yellow-500/10 px-1 rounded">generate:tenant-provisioning-alignment</code> and rebuild</li>
            <li>Check for entity/column name mismatches in the entity file</li>
            <li>Inspect the provisioning bundle for conflicting DDL</li>
            <li>SSH into the DB and confirm the column type/constraint isn't blocking the ALTER</li>
          </ul>
        </div>
      )}
    </div>
  );
}

export function DatabaseDriftPanel() {
  const [tenants, setTenants] = useState<TenantState[]>([]);
  const [summary, setSummary] = useState<{ total: number; clean: number; drifted: number; failed: number } | null>(null);
  const [globalStatus, setGlobalStatus] = useState<'idle' | 'scanning' | 'repairing' | 'done'>('idle');
  const [lastScan, setLastScan] = useState<string | null>(null);

  const setSingleTenantStatus = useCallback((tenantId: string, patch: Partial<TenantState>) => {
    setTenants((prev) => prev.map((t) => (t.tenantId === tenantId ? { ...t, ...patch } : t)));
  }, []);

  const handleScanAll = useCallback(async () => {
    setGlobalStatus('scanning');
    try {
      const data = await driftAPI.scanAll();
      setSummary(data.summary);
      setLastScan(new Date().toLocaleTimeString());
      setTenants(
        (data.tenants ?? []).map((t: TenantDriftResult) => ({
          ...t,
          status: 'done',
          expanded: t.drift ? !t.drift.ok : false,
        })),
      );
    } catch {
      setSummary(null);
    } finally {
      setGlobalStatus('done');
    }
  }, []);

  const handleScanOne = useCallback(async (tenantId: string) => {
    setSingleTenantStatus(tenantId, { status: 'scanning' });
    try {
      const data = await driftAPI.scanTenant(tenantId);
      setSingleTenantStatus(tenantId, { ...data, status: 'done', expanded: data.drift ? !data.drift.ok : false });
    } catch (err: any) {
      setSingleTenantStatus(tenantId, { status: 'done', error: err?.message || 'Scan failed' });
    }
  }, [setSingleTenantStatus]);

  const handleAutoRepairOne = useCallback(async (tenantId: string) => {
    setSingleTenantStatus(tenantId, { status: 'repairing', expanded: true });
    try {
      const data = await driftAPI.autoRepairTenant(tenantId);
      setSingleTenantStatus(tenantId, { ...data, drift: data.after, status: 'done', expanded: true });
      // Update summary counters
      setSummary((prev) => {
        if (!prev) return prev;
        if (data.resolved && data.before && !data.before.ok) {
          return { ...prev, drifted: Math.max(0, prev.drifted - 1), clean: prev.clean + 1 };
        }
        return prev;
      });
    } catch (err: any) {
      setSingleTenantStatus(tenantId, { status: 'done', error: err?.message || 'Repair failed' });
    }
  }, [setSingleTenantStatus]);

  const handleRepairAll = useCallback(async () => {
    setGlobalStatus('repairing');
    try {
      const data = await driftAPI.repairAll();
      setLastScan(new Date().toLocaleTimeString());
      setSummary(data.summary
        ? { total: data.summary.total, clean: data.summary.resolved + data.summary.skipped, drifted: data.summary.persists, failed: 0 }
        : null,
      );
      setTenants(
        (data.tenants ?? []).map((t: any) => ({
          ...t,
          drift: t.after ?? t.drift ?? null,
          status: 'done',
          expanded: t.resolved === false,
        })),
      );
    } catch {
      // keep existing state
    } finally {
      setGlobalStatus('done');
    }
  }, []);

  const isGlobalBusy = globalStatus === 'scanning' || globalStatus === 'repairing';

  return (
    <div className="space-y-4">
      {/* Header card */}
      <div className="rounded-2xl border border-white/[0.07] bg-[#0A1525]/80 p-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-base font-bold text-white">DB Schema Integrity</h2>
            <p className="text-xs text-[#5A78A0] mt-0.5">
              Compares each tenant's live database against TypeORM entity definitions.
              {lastScan && <span className="text-[#3A5A7A] ml-2">Last scan: {lastScan}</span>}
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={handleScanAll}
              disabled={isGlobalBusy}
              className="inline-flex items-center gap-2 rounded-xl border border-white/[0.1] bg-white/[0.04] px-4 py-2 text-sm font-semibold text-white hover:bg-white/[0.08] disabled:opacity-50 disabled:cursor-not-allowed transition"
            >
              {globalStatus === 'scanning' ? (
                <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" /></svg>
              ) : (
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
              )}
              Scan All
            </button>
            {summary && summary.drifted > 0 && (
              <button
                onClick={handleRepairAll}
                disabled={isGlobalBusy}
                className="inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-bold text-[#051119] disabled:opacity-50 disabled:cursor-not-allowed transition"
                style={{ background: isGlobalBusy ? '#666' : `linear-gradient(135deg, ${WARN}, #e05a20)` }}
              >
                {globalStatus === 'repairing' ? (
                  <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" /></svg>
                ) : (
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" /></svg>
                )}
                Repair All Drifted
              </button>
            )}
          </div>
        </div>

        {/* Summary bar */}
        {summary && (
          <div className="mt-4 grid grid-cols-3 gap-3 sm:grid-cols-4">
            {[
              { label: 'Total', value: summary.total, color: BLUE },
              { label: 'Clean', value: summary.clean, color: ACCENT },
              { label: 'Drifted', value: summary.drifted, color: WARN },
              { label: 'Errors', value: summary.failed, color: ERR },
            ].map((s) => (
              <div key={s.label} className="rounded-xl border border-white/[0.05] bg-white/[0.02] p-3 text-center">
                <div className="text-xl font-black" style={{ color: s.color }}>{s.value}</div>
                <div className="text-[10px] font-semibold text-[#4A6A8A] mt-0.5">{s.label}</div>
              </div>
            ))}
          </div>
        )}

        {/* Empty state */}
        {tenants.length === 0 && globalStatus !== 'scanning' && (
          <div className="mt-4 flex flex-col items-center justify-center rounded-xl border border-dashed border-white/[0.08] bg-white/[0.02] py-10 text-center">
            <svg className="w-8 h-8 text-[#3A5A7A] mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <p className="text-sm font-medium text-[#5A78A0]">No scan results yet</p>
            <p className="text-xs text-[#3A5A7A] mt-1">Click <strong className="text-white">Scan All</strong> to check all tenant databases</p>
          </div>
        )}
      </div>

      {/* Per-tenant rows */}
      {tenants.length > 0 && (
        <div className="space-y-2">
          {tenants.map((t) => {
            const isBusy = t.status === 'scanning' || t.status === 'repairing';
            const drifted = t.drift && !t.drift.ok;
            const hasError = Boolean(t.error);

            return (
              <div
                key={t.tenantId}
                className="rounded-2xl border bg-[#0A1525]/80 transition-all"
                style={{ borderColor: hasError ? `${ERR}25` : drifted ? `${WARN}25` : `${ACCENT}18` }}
              >
                <div className="flex items-center gap-3 px-4 py-3">
                  {/* Status icon */}
                  <div
                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl"
                    style={{
                      background: hasError ? `${ERR}15` : drifted ? `${WARN}15` : `${ACCENT}15`,
                      border: `1px solid ${hasError ? ERR : drifted ? WARN : ACCENT}30`,
                    }}
                  >
                    {isBusy ? (
                      <svg className="w-4 h-4 animate-spin" style={{ color: BLUE }} fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" /></svg>
                    ) : hasError ? (
                      <svg className="w-4 h-4" style={{ color: ERR }} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                    ) : drifted ? (
                      <svg className="w-4 h-4" style={{ color: WARN }} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" /></svg>
                    ) : (
                      <svg className="w-4 h-4" style={{ color: ACCENT }} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                    )}
                  </div>

                  {/* Name + db */}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-white truncate">{t.tenantName}</p>
                    <p className="text-[10px] text-[#4A6A8A] truncate font-mono">{t.databaseName}</p>
                  </div>

                  {/* Status badge + table count */}
                  <div className="hidden sm:flex items-center gap-2 shrink-0">
                    {t.drift && (
                      <span className="text-[10px] text-[#4A6A8A]">{t.drift.tableCount} tables</span>
                    )}
                    {t.status !== 'idle' && <DriftBadge report={t.drift ?? null} />}
                    {t.status === 'scanning' && <span className="text-[10px] text-[#4A6A8A]">Scanning…</span>}
                    {t.status === 'repairing' && <span className="text-[10px]" style={{ color: WARN }}>Repairing…</span>}
                  </div>

                  {/* Action buttons */}
                  <div className="flex items-center gap-1.5 shrink-0 ml-2">
                    <button
                      onClick={() => handleScanOne(t.tenantId)}
                      disabled={isBusy}
                      className="rounded-lg border border-white/[0.08] bg-white/[0.03] px-2.5 py-1.5 text-[11px] font-semibold text-[#7A9AB8] hover:text-white hover:bg-white/[0.07] disabled:opacity-40 disabled:cursor-not-allowed transition"
                    >
                      Scan
                    </button>
                    {(t.drift && !t.drift.ok || t.status === 'idle') && (
                      <button
                        onClick={() => handleAutoRepairOne(t.tenantId)}
                        disabled={isBusy}
                        className="rounded-lg px-2.5 py-1.5 text-[11px] font-bold text-[#051119] disabled:opacity-40 disabled:cursor-not-allowed transition"
                        style={{ background: isBusy ? '#555' : `linear-gradient(135deg, ${WARN}, #e05a20)` }}
                      >
                        Auto-Repair
                      </button>
                    )}
                    {(t.drift || t.before) && (
                      <button
                        onClick={() => setSingleTenantStatus(t.tenantId, { expanded: !t.expanded })}
                        className="rounded-lg border border-white/[0.08] bg-white/[0.03] p-1.5 text-[#5A78A0] hover:text-white hover:bg-white/[0.07] transition"
                      >
                        <svg className={`w-3.5 h-3.5 transition-transform ${t.expanded ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                      </button>
                    )}
                  </div>
                </div>

                {/* Expanded detail */}
                {t.expanded && (
                  <div className="border-t border-white/[0.05] px-4 py-3">
                    {t.error && (
                      <div className="flex items-start gap-2 rounded-xl border border-red-500/20 bg-red-500/[0.06] p-3">
                        <svg className="w-4 h-4 shrink-0 mt-0.5" style={{ color: ERR }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <p className="text-xs text-red-300 font-mono break-all">{t.error}</p>
                      </div>
                    )}
                    {t.drift && !t.before && <DriftDetail drift={t.drift} />}
                    {t.before && <RepairResult state={t} />}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
