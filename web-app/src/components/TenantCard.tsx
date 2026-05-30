import React, { useState } from 'react';
import { Tenant } from '../types';
import { ConfirmModal } from './Modal';

interface TenantCardProps {
  tenant: Tenant;
  onStatusChange: (id: string, status: string) => void;
  onDelete: (id: string) => void;
  onManageUsers: (tenant: Tenant) => void;
  onConfigureDhis2?: (tenant: Tenant) => void;
  isSelected?: boolean;
  onSelect?: (id: string) => void;
}

export const TenantCard: React.FC<TenantCardProps> = ({ tenant, onStatusChange, onDelete, onManageUsers, onConfigureDhis2, isSelected, onSelect }) => {
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showSuspendModal, setShowSuspendModal] = useState(false);
  const protocol = process.env.REACT_APP_PROTOCOL || window.location.protocol.replace(':', '') || 'https';

  const statusConfig: Record<string, { color: string; label: string }> = {
    active:    { color: '#00C896', label: 'Active' },
    pending:   { color: '#FF7A40', label: 'Pending' },
    suspended: { color: '#FF4D6A', label: 'Suspended' },
  };

  const tierConfig: Record<string, { color: string }> = {
    enterprise:   { color: '#A66CFF' },
    professional: { color: '#2B7FFF' },
    standard:     { color: '#00C896' },
  };

  const sc = statusConfig[tenant.status] || { color: '#5A78A0', label: tenant.status };
  const tc = tierConfig[tenant.subscriptionTier?.toLowerCase()] || { color: '#5A78A0' };

  const billingColor =
    tenant.billingSummary?.tone === 'critical' ? '#FF4D6A' :
    tenant.billingSummary?.tone === 'warning'  ? '#FF7A40' :
    tenant.billingSummary?.tone === 'expired'  ? '#5A78A0' :
    '#00C896';

  return (
    <>
      <div className="group flex flex-col rounded-2xl border border-white/[0.07] bg-[#0A1525]/90 transition-all duration-200 hover:-translate-y-0.5 hover:border-white/[0.14] hover:shadow-[0_20px_60px_rgba(0,0,0,0.4)] overflow-hidden">
        {/* Header */}
        <div className="p-5 border-b border-white/[0.05]">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-3">
              {onSelect && (
                <input
                  type="checkbox"
                  checked={isSelected || false}
                  onChange={() => onSelect(tenant.id)}
                  className="mt-2 h-4 w-4 rounded border-white/[0.3] bg-white/[0.05] text-[#0AA98A] focus:ring-[#0AA98A] cursor-pointer"
                />
              )}
              <div className="relative shrink-0">
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-white/[0.1] bg-[#0D1829] overflow-hidden">
                  {tenant.logoUrl ? (
                    <img src={tenant.logoUrl} alt={`${tenant.clinicName} logo`} className="h-full w-full object-cover" />
                  ) : (
                    <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ color: tc.color }}>
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                    </svg>
                  )}
                </div>
                <div className="absolute -bottom-1 -right-1 h-3.5 w-3.5 rounded-full border-2 border-[#080E1A]" style={{ background: sc.color }} />
              </div>

              <div className="min-w-0">
                <h3 className="font-bold text-white leading-tight group-hover:text-[#7DE8CA] transition-colors truncate">
                  {tenant.clinicName}
                </h3>
                <div className="flex items-center gap-1.5 mt-1">
                  <span className="text-xs text-[#5A78A0] font-mono truncate">{tenant.subdomain}.{process.env.REACT_APP_BASE_DOMAIN}</span>
                  <a href={`${protocol}://${tenant.subdomain}.${process.env.REACT_APP_BASE_DOMAIN}`} target="_blank" rel="noreferrer" className="text-[#3A5A7A] hover:text-[#2B7FFF] transition-colors shrink-0">
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                    </svg>
                  </a>
                </div>
                <div className="flex flex-wrap gap-1.5 mt-2">
                  <span className="rounded-full px-2 py-0.5 text-[10px] font-bold capitalize" style={{ background: tc.color + '15', color: tc.color, border: `1px solid ${tc.color}30` }}>
                    {tenant.subscriptionTier}
                  </span>
                  <span className="rounded-full px-2 py-0.5 text-[10px] font-bold capitalize bg-white/[0.08] text-[#8FA8CC] border border-white/[0.1]">
                    {tenant.deploymentMode ?? 'clinic'}
                  </span>
                  <span className="rounded-full px-2 py-0.5 text-[10px] font-bold" style={{ background: sc.color + '12', color: sc.color, border: `1px solid ${sc.color}25` }}>
                    {sc.label}
                  </span>
                </div>
              </div>
            </div>

            <div className="flex shrink-0 flex-col gap-1.5">
              {onConfigureDhis2 && (
                <button
                  onClick={() => onConfigureDhis2(tenant)}
                  className="p-1.5 rounded-lg text-[#4A6A8A] hover:text-[#00C896] hover:bg-[#00C896]/10 transition-colors"
                  title="DHIS2 Configuration"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16h6M5 4h14a2 2 0 012 2v12a2 2 0 01-2 2H5a2 2 0 01-2-2V6a2 2 0 012-2z" />
                  </svg>
                </button>
              )}
              <button
                onClick={() => onManageUsers(tenant)}
                className="p-1.5 rounded-lg text-[#4A6A8A] hover:text-[#2B7FFF] hover:bg-[#2B7FFF]/10 transition-colors"
                title="Manage Users"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z" />
                </svg>
              </button>
            </div>
          </div>
        </div>

        {/* Details */}
        <div className="flex-1 p-5 space-y-2.5">
          {[
            { icon: 'M3 8l7.89 4.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z', value: tenant.contactEmail },
            { icon: 'M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z', value: tenant.contactPhone },
            tenant.address ? { icon: 'M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z', value: `${tenant.address}, ${tenant.city}` } : null,
          ].filter(Boolean).map((row, i) => row && (
            <div key={i} className="flex items-center gap-2.5 text-sm">
              <svg className="w-3.5 h-3.5 shrink-0 text-[#3A5A7A]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={row.icon} />
              </svg>
              <span className="truncate text-[#8FA8CC] text-xs">{row.value}</span>
            </div>
          ))}

          <div className="flex items-center gap-2.5">
            <svg className="w-3.5 h-3.5 shrink-0 text-[#3A5A7A]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4" />
            </svg>
            <span className="font-mono text-[10px] text-[#3A5A7A] bg-white/[0.04] border border-white/[0.06] px-2 py-0.5 rounded-md">{tenant.databaseName}</span>
          </div>

          {tenant.billingSummary && (
            <div className="rounded-xl border p-3" style={{ borderColor: billingColor + '25', background: billingColor + '08' }}>
              <p className="text-xs font-bold" style={{ color: billingColor }}>{tenant.billingSummary.label}</p>
              <p className="mt-1 text-[11px] leading-4" style={{ color: billingColor + 'CC' }}>{tenant.billingSummary.message}</p>
              <div className="mt-2 flex flex-wrap gap-1.5 text-[10px]">
                {[
                  `Days left: ${tenant.billingSummary.daysRemaining ?? 'N/A'}`,
                  `Suspend in: ${tenant.billingSummary.daysUntilSuspension ?? 'N/A'}`,
                  `Modules: ${tenant.enabledModules?.length || 0}`,
                ].map((tag) => (
                  <span key={tag} className="rounded-full border border-white/[0.1] bg-white/[0.05] px-2 py-0.5 text-[#C5D5EE] font-semibold">{tag}</span>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer actions */}
        <div className="border-t border-white/[0.05] bg-[#080E1A]/40 px-4 py-3 flex gap-2">
          {tenant.status === 'pending' && (
            <button
              onClick={() => onStatusChange(tenant.id, 'active')}
              className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#00C896] to-[#00A87A] px-3 py-2 text-xs font-bold text-[#051119] transition hover:from-[#00D9A3]"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
              Activate
            </button>
          )}
          {tenant.status === 'active' && (
            <button
              onClick={() => setShowSuspendModal(true)}
              className="flex-1 flex items-center justify-center gap-2 rounded-xl border border-white/[0.08] bg-white/[0.04] px-3 py-2 text-xs font-semibold text-[#C5D5EE] transition hover:border-[#FF7A40]/40 hover:bg-[#FF7A40]/10 hover:text-[#FF7A40]"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 9v6m4-6v6m7-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
              Suspend
            </button>
          )}
          {tenant.status === 'suspended' && (
            <button
              onClick={() => onStatusChange(tenant.id, 'active')}
              className="flex-1 flex items-center justify-center gap-2 rounded-xl border border-[#00C896]/25 bg-[#00C896]/10 px-3 py-2 text-xs font-semibold text-[#6EE7C2] transition hover:bg-[#00C896]/20"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664zM21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
              Resume
            </button>
          )}
          <button
            onClick={() => setShowDeleteModal(true)}
            className="p-2 rounded-xl text-[#3A5A7A] hover:text-[#FF4D6A] hover:bg-[#FF4D6A]/10 transition-colors"
            title="Delete Tenant"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </button>
        </div>
      </div>

      <ConfirmModal
        isOpen={showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
        onConfirm={() => onDelete(tenant.id)}
        title="Delete Tenant"
        message={`Are you sure you want to delete "${tenant.clinicName}"? This action cannot be undone.`}
        confirmText="Delete"
        type="danger"
      />
      <ConfirmModal
        isOpen={showSuspendModal}
        onClose={() => setShowSuspendModal(false)}
        onConfirm={() => onStatusChange(tenant.id, 'suspended')}
        title="Suspend Tenant"
        message={`Suspend "${tenant.clinicName}"? Users won't be able to log in until reactivated.`}
        confirmText="Suspend"
        type="warning"
      />
    </>
  );
};
