import React, { useState, useEffect } from 'react';
import { SystemStats, Tenant } from '../types';
import { analyticsAPI } from '../services/api';

interface SystemOverviewProps {
  tenants?: Tenant[];
}

export const SystemOverview: React.FC<SystemOverviewProps> = ({ tenants = [] }) => {
  const [stats, setStats] = useState<SystemStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    analyticsAPI.getSystemOverview()
      .then(setStats)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const activeCount = tenants.filter(t => t.status === 'active').length;
  const pendingCount = tenants.filter(t => t.status === 'pending').length;
  const enterpriseCount = tenants.filter(t => t.subscriptionTier === 'enterprise').length;
  const activationRate = tenants.length > 0 ? Math.round((activeCount / tenants.length) * 100) : 0;

  const aiInsights = [
    activationRate >= 80
      ? { type: 'positive', text: `Strong activation rate at ${activationRate}% — platform adoption is healthy.` }
      : { type: 'warning', text: `Activation rate is ${activationRate}%. Consider following up with ${pendingCount} pending tenant${pendingCount !== 1 ? 's' : ''}.` },
    enterpriseCount > 0
      ? { type: 'positive', text: `${enterpriseCount} enterprise tenant${enterpriseCount !== 1 ? 's' : ''} active — focus on retention and module expansion.` }
      : { type: 'info', text: 'No enterprise tenants yet. Target larger clinics and specialist practices for upgrade.' },
    pendingCount > 0
      ? { type: 'action', text: `${pendingCount} tenant${pendingCount !== 1 ? 's' : ''} pending activation — review and approve from the Tenants section.` }
      : { type: 'positive', text: 'All submitted tenants have been reviewed. No pending activations.' },
    { type: 'info', text: 'SNOMED CT and ICD-10 data freshness affects CDSS quality — check Terminology section regularly.' },
  ];

  const statCards = [
    {
      label: 'Total Tenants',
      value: stats?.totalTenants ?? tenants.length,
      color: '#2B7FFF',
      sub: 'Registered clinics',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
        </svg>
      ),
    },
    {
      label: 'Active Tenants',
      value: stats?.activeTenants ?? activeCount,
      color: '#00C896',
      sub: 'Operational clinics',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
    },
    {
      label: 'Total Users',
      value: stats?.totalUsers ?? '—',
      color: '#A66CFF',
      sub: 'Across all tenants',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z" />
        </svg>
      ),
    },
    {
      label: 'Activation Rate',
      value: `${stats?.activationRate ?? activationRate}%`,
      color: '#FF7A40',
      sub: 'Active / total ratio',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
        </svg>
      ),
    },
  ];

  return (
    <div className="space-y-5">
      {/* AI Platform Intelligence */}
      <div className="rounded-2xl border border-[#00C896]/20 bg-gradient-to-br from-[#00C896]/[0.06] to-[#2B7FFF]/[0.04] p-5">
        <div className="flex items-center gap-2.5 mb-4">
          <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-[#00C896]/15 border border-[#00C896]/25">
            <svg className="w-4 h-4 text-[#00C896]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
            </svg>
          </div>
          <div>
            <h3 className="text-sm font-bold text-white">AI Platform Intelligence</h3>
            <p className="text-[11px] text-[#4A7A5A]">Auto-generated insights from live platform data</p>
          </div>
          <span className="ml-auto flex items-center gap-1.5 rounded-full border border-[#00C896]/25 bg-[#00C896]/10 px-2.5 py-1 text-[10px] font-bold text-[#00C896]">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#00C896]" />
            Live
          </span>
        </div>
        <div className="grid gap-2.5 sm:grid-cols-2">
          {aiInsights.map((insight, i) => {
            const colors = {
              positive: { border: '#00C896', bg: '#00C896', text: '#6EE7C2', dot: '#00C896' },
              warning: { border: '#FF7A40', bg: '#FF7A40', text: '#FFBD9A', dot: '#FF7A40' },
              action: { border: '#2B7FFF', bg: '#2B7FFF', text: '#93C5FD', dot: '#2B7FFF' },
              info: { border: 'rgba(255,255,255,0.1)', bg: 'rgba(255,255,255,0.06)', text: '#8FA8CC', dot: '#5A78A0' },
            };
            const c = colors[insight.type as keyof typeof colors] || colors.info;
            return (
              <div key={i} className="flex items-start gap-2.5 rounded-xl border px-3 py-2.5" style={{ borderColor: c.border + '30', background: c.bg + '10' }}>
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: c.dot }} />
                <p className="text-xs leading-5" style={{ color: c.text }}>{insight.text}</p>
              </div>
            );
          })}
        </div>
      </div>

      {/* Stats grid */}
      {loading ? (
        <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
          {[1,2,3,4].map(i => (
            <div key={i} className="h-24 animate-pulse rounded-2xl bg-white/[0.04] border border-white/[0.06]" />
          ))}
        </div>
      ) : (
        <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
          {statCards.map((card) => (
            <div key={card.label} className="rounded-2xl border border-white/[0.07] bg-[#0A1525]/80 p-4">
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs text-[#7A9AB8]">{card.label}</p>
                <div className="flex h-8 w-8 items-center justify-center rounded-xl" style={{ background: `${card.color}15`, border: `1px solid ${card.color}30` }}>
                  <span style={{ color: card.color }}>{card.icon}</span>
                </div>
              </div>
              <p className="text-2xl font-black text-white">{card.value}</p>
              <p className="mt-1 text-[11px] text-[#4A6A8A]">{card.sub}</p>
            </div>
          ))}
        </div>
      )}

      {/* Subscription tiers */}
      {stats?.tenantsByTier && stats.tenantsByTier.length > 0 && (
        <div className="rounded-2xl border border-white/[0.07] bg-[#0A1525]/80 p-5">
          <h3 className="text-sm font-bold text-white mb-4">Tenants by Subscription Tier</h3>
          <div className="grid grid-cols-3 gap-3">
            {stats.tenantsByTier.map((tier) => {
              const tierColors: Record<string, string> = { enterprise: '#A66CFF', professional: '#2B7FFF', standard: '#00C896' };
              const color = tierColors[tier.tier?.toLowerCase()] || '#00C896';
              return (
                <div key={tier.tier} className="rounded-xl border border-white/[0.06] bg-white/[0.03] p-4 text-center">
                  <div className="text-2xl font-black text-white">{tier.count}</div>
                  <div className="mt-1 text-xs capitalize font-semibold" style={{ color }}>{tier.tier}</div>
                  <div className="mt-2 h-1 rounded-full bg-white/[0.07]">
                    <div className="h-full rounded-full" style={{ width: stats.totalTenants ? `${(tier.count / stats.totalTenants) * 100}%` : '0%', background: color }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Recent signups */}
      <div className="rounded-2xl border border-white/[0.07] bg-[#0A1525]/80 p-5">
        <h3 className="text-sm font-bold text-white mb-4">Recent Signups</h3>
        {loading ? (
          <div className="space-y-2">
            {[1,2,3].map(i => <div key={i} className="h-12 animate-pulse rounded-xl bg-white/[0.04]" />)}
          </div>
        ) : stats?.recentSignups && stats.recentSignups.length > 0 ? (
          <div className="space-y-2">
            {stats.recentSignups.map((tenant) => {
              const statusColors: Record<string, { bg: string; text: string }> = {
                active: { bg: '#00C896', text: '#6EE7C2' },
                pending: { bg: '#FF7A40', text: '#FFBD9A' },
                suspended: { bg: '#FF4D6A', text: '#FFB3BE' },
              };
              const sc = statusColors[tenant.status] || statusColors.pending;
              return (
                <div key={tenant.id} className="flex items-center justify-between rounded-xl border border-white/[0.06] bg-white/[0.03] px-4 py-3">
                  <div>
                    <p className="text-sm font-semibold text-white">{tenant.clinicName}</p>
                    <p className="text-xs text-[#5A78A0]">{tenant.subscriptionTier} · {new Date(tenant.createdAt).toLocaleDateString()}</p>
                  </div>
                  <span className="rounded-full px-2.5 py-1 text-[10px] font-bold capitalize" style={{ background: sc.bg + '15', color: sc.text, border: `1px solid ${sc.bg}30` }}>
                    {tenant.status}
                  </span>
                </div>
              );
            })}
          </div>
        ) : (
          <p className="text-center py-6 text-sm text-[#5A78A0]">No recent signups</p>
        )}
      </div>

      {/* Platform standards reminder */}
      <div className="rounded-2xl border border-[#2B7FFF]/20 bg-[#2B7FFF]/[0.05] p-4">
        <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-[#4A7AAA] mb-2">Active Platform Standards</p>
        <div className="flex flex-wrap gap-2">
          {['FHIR R4', 'SNOMED CT', 'ICD-10', 'RxNorm', 'DHIS2', 'LOINC', 'HIPAA-aware', 'HL7'].map((s) => (
            <span key={s} className="rounded-lg border border-[#2B7FFF]/20 bg-[#2B7FFF]/10 px-2.5 py-1 text-[10px] font-bold text-[#6A9AC8]">{s}</span>
          ))}
        </div>
      </div>
    </div>
  );
};
