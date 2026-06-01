import React from 'react';

interface DoctorSyncMetricsProps {
  /** DoctorOutcomeAnalyticsSnapshot from the dashboard (may be null while loading). */
  analytics: any | null;
  /** Doctor sync summary counts. */
  summary: {
    total: number;
    pending: number;
    acknowledged: number;
    doctorReviewRecommended: number;
    accounts: number;
  };
}

/**
 * The detailed analytics surface for the Doctor Synchronization Panel — the 11 KPI
 * cards plus the specialty-queue and top-actions drilldowns. Extracted from
 * DoctorDashboard so it can be collapsed behind a toggle without fragile inline
 * JSX nesting.
 */
const DoctorSyncMetrics: React.FC<DoctorSyncMetricsProps> = ({ analytics, summary }) => (
  <div className="space-y-5">
    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 2xl:grid-cols-8 gap-3">
      <div className="rounded-xl border border-blue-200/70 bg-gradient-to-br from-blue-50 via-white to-cyan-100/80 px-4 py-3">
        <p className="text-xs font-semibold text-slate-500">Doctor Queue Total</p>
        <p className="text-2xl font-bold text-slate-900">
          {analytics?.doctorQueue?.totalItems ?? summary.total}
        </p>
      </div>
      <div className="rounded-xl border border-amber-200/70 bg-gradient-to-br from-amber-50 via-white to-orange-100/80 px-4 py-3">
        <p className="text-xs font-semibold text-slate-500">Pending</p>
        <p className="text-2xl font-bold text-slate-900">
          {summary.pending}
        </p>
      </div>
      <div className="rounded-xl border border-emerald-200/70 bg-gradient-to-br from-emerald-50 via-white to-teal-100/80 px-4 py-3">
        <p className="text-xs font-semibold text-slate-500">Acknowledged</p>
        <p className="text-2xl font-bold text-slate-900">
          {summary.acknowledged}
        </p>
      </div>
      <div className="rounded-xl border border-rose-200/70 bg-gradient-to-br from-rose-50 via-white to-red-100/80 px-4 py-3">
        <p className="text-xs font-semibold text-slate-500">Pending &gt;24h</p>
        <p className="text-2xl font-bold text-slate-900">
          {analytics?.doctorQueue?.pendingOlderThan24h ?? 0}
        </p>
      </div>
      <div className="rounded-xl border border-orange-200/70 bg-gradient-to-br from-orange-50 via-white to-amber-100/80 px-4 py-3">
        <p className="text-xs font-semibold text-slate-500">Doctor Review Flags</p>
        <p className="text-2xl font-bold text-slate-900">
          {summary.doctorReviewRecommended}
        </p>
      </div>
      <div className="rounded-xl border border-indigo-200/70 bg-gradient-to-br from-indigo-50 via-white to-blue-100/80 px-4 py-3">
        <p className="text-xs font-semibold text-slate-500">Executed Recommendations</p>
        <p className="text-2xl font-bold text-slate-900">
          {analytics?.recommendationExecution?.executedActionsTotal ?? 0}
        </p>
      </div>
      <div className="rounded-xl border border-violet-200/70 bg-gradient-to-br from-violet-50 via-white to-purple-100/80 px-4 py-3">
        <p className="text-xs font-semibold text-slate-500">Reuse/Idempotent</p>
        <p className="text-2xl font-bold text-slate-900">
          {analytics?.recommendationExecution?.reusedOrIdempotentTotal ?? 0}
        </p>
      </div>
      <div className="rounded-xl border border-cyan-200/70 bg-gradient-to-br from-cyan-50 via-white to-sky-100/80 px-4 py-3">
        <p className="text-xs font-semibold text-slate-500">Accounts Sync Pending</p>
        <p className="text-2xl font-bold text-slate-900">
          {analytics?.accountsSync?.pendingItems ?? summary.accounts}
        </p>
      </div>
      <div className="rounded-xl border border-blue-200/70 bg-gradient-to-br from-blue-50 via-white to-indigo-100/80 px-4 py-3">
        <p className="text-xs font-semibold text-slate-500">CDSS Coverage</p>
        <p className="text-2xl font-bold text-slate-900">
          {analytics?.cdssAdoption?.executionCoveragePercent ?? 0}%
        </p>
      </div>
      <div className="rounded-xl border border-purple-200/70 bg-gradient-to-br from-purple-50 via-white to-fuchsia-100/80 px-4 py-3">
        <p className="text-xs font-semibold text-slate-500">Avg Time To Action</p>
        <p className="text-2xl font-bold text-slate-900">
          {analytics?.cdssAdoption?.averageTimeToExecutionHours ?? 0}h
        </p>
      </div>
      <div className="rounded-xl border border-rose-200/70 bg-gradient-to-br from-rose-50 via-white to-pink-100/80 px-4 py-3">
        <p className="text-xs font-semibold text-slate-500">Overrides Logged</p>
        <p className="text-2xl font-bold text-slate-900">
          {analytics?.cdssAdoption?.overrideActionsTotal ?? 0}
        </p>
      </div>
    </div>

    <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
      <div className="rounded-xl border border-indigo-200/70 bg-gradient-to-br from-indigo-50 via-white to-blue-100/70 px-4 py-3">
        <p className="text-xs font-semibold text-slate-500 mb-2">Specialty Queue Drilldown</p>
        <div className="space-y-2">
          {(analytics?.doctorQueue?.moduleDrilldown || []).slice(0, 8).map((moduleRow: any) => (
            <div
              key={`doctor-module-${moduleRow.module}`}
              className="flex items-center justify-between rounded-lg border border-indigo-100/80 bg-white/70 px-3 py-2"
            >
              <div>
                <p className="text-sm font-semibold text-slate-800 capitalize">{moduleRow.module}</p>
                <p className="text-xs text-slate-500">
                  {moduleRow.pendingItems} pending • {moduleRow.acknowledgedItems} acknowledged • {moduleRow.completedItems} completed
                </p>
              </div>
              <div className="text-right">
                <p className="text-sm font-bold text-slate-900">{moduleRow.totalItems}</p>
                <p className="text-xs text-slate-500">{moduleRow.executedActionsTotal} actions</p>
              </div>
            </div>
          ))}
          {(analytics?.doctorQueue?.moduleDrilldown || []).length === 0 && (
            <p className="text-xs text-slate-500">No specialty drilldown data available for this window.</p>
          )}
        </div>
      </div>
      <div className="rounded-xl border border-violet-200/70 bg-gradient-to-br from-violet-50 via-white to-purple-100/70 px-4 py-3">
        <p className="text-xs font-semibold text-slate-500 mb-2">Top Executed Doctor Actions</p>
        <div className="space-y-2">
          {(analytics?.recommendationExecution?.topActions || []).slice(0, 6).map((row: any) => (
            <div
              key={`doctor-action-${row.actionId}`}
              className="flex items-center justify-between rounded-lg border border-violet-100/80 bg-white/70 px-3 py-2"
            >
              <p className="text-sm text-slate-700">{row.actionId.replace(/-/g, ' ')}</p>
              <span className="text-sm font-bold text-slate-900">{row.count}</span>
            </div>
          ))}
          {(analytics?.recommendationExecution?.topActions || []).length === 0 && (
            <p className="text-xs text-slate-500">No executed doctor actions yet in this analytics window.</p>
          )}
        </div>
      </div>
    </div>
  </div>
);

export default DoctorSyncMetrics;
