import React, { useEffect, useMemo, useState } from 'react';
import { tenantAPI } from '../services/api';
import type { ReadinessStatus, RolloutReadiness } from '../types';

const STATUS_STYLES: Record<ReadinessStatus, string> = {
  ready: 'bg-green-100 text-green-800 border-green-200',
  needs_attention: 'bg-yellow-100 text-yellow-800 border-yellow-200',
  blocked: 'bg-red-100 text-red-800 border-red-200',
  not_configured: 'bg-gray-100 text-gray-500 border-gray-200',
};

const STATUS_LABELS: Record<ReadinessStatus, string> = {
  ready: 'Ready',
  needs_attention: 'Needs attention',
  blocked: 'Blocked',
  not_configured: 'Not configured',
};

function StatusBadge({ status }: { status: ReadinessStatus }) {
  return (
    <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[10px] font-bold ${STATUS_STYLES[status]}`}>
      {STATUS_LABELS[status]}
    </span>
  );
}

export function RolloutDashboard() {
  const [data, setData] = useState<RolloutReadiness[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);

  useEffect(() => {
    tenantAPI.getRolloutReadiness()
      .then(setData)
      .catch((err) => setError(err.message || 'Failed to load rollout readiness'))
      .finally(() => setLoading(false));
  }, []);

  const summary = useMemo(() => {
    return {
      ready: data.filter((tenant) => tenant.overallStatus === 'ready').length,
      needsAttention: data.filter((tenant) => tenant.overallStatus === 'needs_attention').length,
      blocked: data.filter((tenant) => tenant.overallStatus === 'blocked').length,
      total: data.length,
    };
  }, [data]);

  if (loading) {
    return (
      <div className="rounded-2xl border border-white/[0.07] bg-[#0A1525]/80 p-8 text-center">
        <div className="relative mx-auto mb-4 h-12 w-12">
          <div className="absolute inset-0 animate-spin rounded-full border-2 border-transparent border-t-[#00C896]" />
          <div className="absolute inset-2 animate-spin rounded-full border-2 border-transparent border-t-[#2B7FFF]" style={{ animationDirection: 'reverse', animationDuration: '0.7s' }} />
        </div>
        <p className="text-sm font-medium text-[#7A9AB8]">Loading rollout readiness...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-2xl border border-red-500/20 bg-red-500/[0.08] p-5">
        <p className="text-sm font-bold text-red-300">Unable to load rollout readiness</p>
        <p className="mt-1 text-xs text-red-200/80">{error}</p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="rounded-2xl border border-[#00C896]/20 bg-gradient-to-br from-[#00C896]/[0.06] to-[#2B7FFF]/[0.04] p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-[#4A7A5A]">Implementation Readiness</p>
            <h2 className="mt-1 text-xl font-black text-white">Rollout Control View</h2>
            <p className="mt-1 text-sm text-[#7A9AB8]">
              Tenant-level readiness only. No patient or clinical record data is shown here.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:min-w-[26rem]">
            {[
              { label: 'Total', value: summary.total, color: '#2B7FFF' },
              { label: 'Ready', value: summary.ready, color: '#00C896' },
              { label: 'Attention', value: summary.needsAttention, color: '#FFB020' },
              { label: 'Blocked', value: summary.blocked, color: '#FF4D6A' },
            ].map((item) => (
              <div key={item.label} className="rounded-xl border border-white/[0.07] bg-white/[0.04] p-3">
                <p className="text-[10px] font-semibold text-[#7A9AB8]">{item.label}</p>
                <p className="mt-1 text-2xl font-black text-white" style={{ color: item.color }}>{item.value}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-white/[0.07] bg-[#0A1525]/80">
        {data.length === 0 ? (
          <div className="p-10 text-center">
            <p className="text-sm font-bold text-white">No tenants found</p>
            <p className="mt-1 text-xs text-[#7A9AB8]">Rollout readiness will appear after tenants are created.</p>
          </div>
        ) : (
          <div className="divide-y divide-white/[0.06]">
            {data.map((tenant) => {
              const isExpanded = expanded === tenant.tenantId;
              return (
                <div key={tenant.tenantId}>
                  <button
                    type="button"
                    onClick={() => setExpanded(isExpanded ? null : tenant.tenantId)}
                    className="grid w-full gap-3 px-4 py-4 text-left transition hover:bg-white/[0.03] md:grid-cols-[1.5fr_0.8fr_0.6fr_0.7fr_auto] md:items-center"
                  >
                    <div>
                      <p className="font-bold text-white">{tenant.clinicName}</p>
                      <p className="mt-1 text-[11px] font-mono text-[#5A78A0]">{tenant.tenantId}</p>
                    </div>
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#4A6A8A]">Mode</p>
                      <p className="mt-1 text-sm capitalize text-[#C5D5EE]">{tenant.deploymentMode}</p>
                    </div>
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#4A6A8A]">Country</p>
                      <p className="mt-1 text-sm text-[#C5D5EE]">{tenant.countryCode ?? 'Not set'}</p>
                    </div>
                    <StatusBadge status={tenant.overallStatus} />
                    <span className="text-xs font-semibold text-[#7A9AB8]">{isExpanded ? 'Hide' : 'View checks'}</span>
                  </button>

                  {isExpanded && (
                    <div className="border-t border-white/[0.05] bg-[#080E1A]/45 px-4 py-4">
                      <div className="grid gap-2 md:grid-cols-2">
                        {tenant.checks.map((check) => (
                          <div key={check.label} className="rounded-xl border border-white/[0.06] bg-white/[0.03] p-3">
                            <div className="flex items-start justify-between gap-3">
                              <div>
                                <p className="text-sm font-bold text-white">{check.label}</p>
                                {check.detail && <p className="mt-1 text-xs text-[#7A9AB8]">{check.detail}</p>}
                              </div>
                              <StatusBadge status={check.status} />
                            </div>
                          </div>
                        ))}
                      </div>
                      <p className="mt-3 text-[11px] text-[#4A6A8A]">
                        Last updated {new Date(tenant.lastUpdated).toLocaleString()}
                      </p>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
