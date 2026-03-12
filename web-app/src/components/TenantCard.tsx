import React, { useState } from 'react';
import { Tenant } from '../types';
import { ConfirmModal } from './Modal';

interface TenantCardProps {
  tenant: Tenant;
  onStatusChange: (id: string, status: string) => void;
  onDelete: (id: string) => void;
  onManageUsers: (tenant: Tenant) => void;
  onConfigureDhis2?: (tenant: Tenant) => void;
}

export const TenantCard: React.FC<TenantCardProps> = ({ tenant, onStatusChange, onDelete, onManageUsers, onConfigureDhis2 }) => {
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showSuspendModal, setShowSuspendModal] = useState(false);
  const protocol = process.env.REACT_APP_PROTOCOL || window.location.protocol.replace(':', '') || 'https';
  
  const getStatusStyle = (status: string) => {
    switch (status) {
      case 'active': return { bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200', dot: 'bg-emerald-500' };
      case 'pending': return { bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200', dot: 'bg-amber-500' };
      case 'suspended': return { bg: 'bg-red-50', text: 'text-red-700', border: 'border-red-200', dot: 'bg-red-500' };
      default: return { bg: 'bg-slate-50', text: 'text-slate-700', border: 'border-slate-200', dot: 'bg-slate-500' };
    }
  };

  const getTierStyle = (tier: string) => {
    switch (tier) {
      case 'enterprise': return { bg: 'bg-indigo-50', text: 'text-indigo-700', border: 'border-indigo-200', icon: 'text-indigo-600' };
      case 'professional': return { bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-200', icon: 'text-blue-600' };
      default: return { bg: 'bg-slate-50', text: 'text-slate-700', border: 'border-slate-200', icon: 'text-slate-600' };
    }
  };

  const statusStyle = getStatusStyle(tenant.status);
  const tierStyle = getTierStyle(tenant.subscriptionTier);
  const billingToneStyle =
    tenant.billingSummary?.tone === 'warning'
      ? 'bg-amber-50 text-amber-700 border-amber-200'
      : tenant.billingSummary?.tone === 'critical'
      ? 'bg-red-50 text-red-700 border-red-200'
      : tenant.billingSummary?.tone === 'expired'
      ? 'bg-slate-100 text-slate-700 border-slate-300'
      : 'bg-emerald-50 text-emerald-700 border-emerald-200';

  return (
    <>
      <div className="group bg-white border border-slate-200 rounded-xl overflow-hidden hover:shadow-lg hover:border-slate-300 transition-all duration-300 flex flex-col h-full">
        {/* Card Header with Logo and Status */}
        <div className="p-5 border-b border-slate-50">
          <div className="flex justify-between items-start">
            <div className="flex items-start space-x-4">
              <div className="relative">
                <div className="w-16 h-16 bg-slate-50 rounded-xl border border-slate-100 flex items-center justify-center overflow-hidden shadow-sm group-hover:shadow-md transition-shadow">
                  {tenant.logoUrl ? (
                    <img src={tenant.logoUrl} alt={`${tenant.clinicName} logo`} className="w-full h-full object-cover" />
                  ) : (
                    <svg className={`w-8 h-8 ${tierStyle.icon}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                    </svg>
                  )}
                </div>
                <div className={`absolute -bottom-1 -right-1 w-4 h-4 rounded-full border-2 border-white ${statusStyle.dot}`}></div>
              </div>
              <div>
                <h3 className="text-lg font-bold text-slate-900 leading-tight group-hover:text-blue-600 transition-colors">
                  {tenant.clinicName}
                </h3>
                <div className="flex items-center space-x-2 mt-1">
                  <span className="text-sm text-slate-500 font-medium">{tenant.subdomain}.{process.env.REACT_APP_BASE_DOMAIN}</span>
                  <a href={`${protocol}://${tenant.subdomain}.${process.env.REACT_APP_BASE_DOMAIN}`} target="_blank" rel="noreferrer" className="text-slate-400 hover:text-blue-500 transition-colors">
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                    </svg>
                  </a>
                </div>
                <div className="flex gap-2 mt-2">
                  <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium ${tierStyle.bg} ${tierStyle.text} border ${tierStyle.border} capitalize`}>
                    {tenant.subscriptionTier}
                  </span>
                  <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium border capitalize ${billingToneStyle}`}>
                    {tenant.subscriptionMode} · {tenant.subscriptionState}
                  </span>
                </div>
              </div>
            </div>
            
            <div className="flex flex-col gap-2">
              {onConfigureDhis2 && (
                <button
                  onClick={() => onConfigureDhis2(tenant)}
                  className="p-2 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors"
                  title="DHIS2 Configuration"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16h6M5 4h14a2 2 0 012 2v12a2 2 0 01-2 2H5a2 2 0 01-2-2V6a2 2 0 012-2z" />
                  </svg>
                </button>
              )}
              <button 
                onClick={() => onManageUsers(tenant)}
                className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                title="Manage Users"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      
        {/* Card Details */}
        <div className="p-5 space-y-3 bg-white flex-grow">
          <div className="flex items-center space-x-3 text-sm text-slate-600">
            <div className="w-8 flex justify-center">
              <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 4.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
            </div>
            <span className="truncate flex-1" title={tenant.contactEmail}>{tenant.contactEmail}</span>
          </div>
          
          <div className="flex items-center space-x-3 text-sm text-slate-600">
            <div className="w-8 flex justify-center">
              <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
              </svg>
            </div>
            <span>{tenant.contactPhone}</span>
          </div>
          
          {tenant.address && (
            <div className="flex items-center space-x-3 text-sm text-slate-600">
              <div className="w-8 flex justify-center">
                <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </div>
              <span className="truncate flex-1">{tenant.address}, {tenant.city}</span>
            </div>
          )}
          
          <div className="flex items-center space-x-3 text-sm text-slate-600">
            <div className="w-8 flex justify-center">
              <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4" />
              </svg>
            </div>
            <span className="truncate font-mono text-xs bg-slate-100 px-2 py-0.5 rounded text-slate-500">{tenant.databaseName}</span>
          </div>

          {tenant.billingSummary && (
            <div className={`rounded-xl border px-3 py-3 text-sm ${billingToneStyle}`}>
              <p className="font-semibold">{tenant.billingSummary.label}</p>
              <p className="mt-1 text-xs leading-5">{tenant.billingSummary.message}</p>
              <div className="mt-2 flex flex-wrap gap-2 text-[11px]">
                <span className="rounded-full border border-slate-300 bg-white px-2 py-0.5 text-slate-900 font-semibold">
                  Days left: {tenant.billingSummary.daysRemaining ?? 'N/A'}
                </span>
                <span className="rounded-full border border-slate-300 bg-white px-2 py-0.5 text-slate-900 font-semibold">
                  Suspend in: {tenant.billingSummary.daysUntilSuspension ?? 'N/A'}
                </span>
                <span className="rounded-full border border-slate-300 bg-white px-2 py-0.5 text-slate-900 font-semibold">
                  Modules: {tenant.enabledModules?.length || 0}
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Action Footer */}
        <div className="bg-slate-50 px-5 py-3 border-t border-slate-100 flex gap-2">
          {tenant.status === 'pending' ? (
            <button
              onClick={() => onStatusChange(tenant.id, 'active')}
              className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-2 rounded-lg text-sm font-medium transition-colors shadow-sm flex items-center justify-center space-x-2"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              <span>Activate</span>
            </button>
          ) : tenant.status === 'active' ? (
            <button
              onClick={() => setShowSuspendModal(true)}
              className="flex-1 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 px-3 py-2 rounded-lg text-sm font-medium transition-colors flex items-center justify-center space-x-2"
            >
              <svg className="w-4 h-4 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 9v6m4-6v6m7-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span>Suspend</span>
            </button>
          ) : (
            <button
              onClick={() => onStatusChange(tenant.id, 'active')}
              className="flex-1 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 px-3 py-2 rounded-lg text-sm font-medium transition-colors flex items-center justify-center space-x-2"
            >
              <svg className="w-4 h-4 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span>Resume</span>
            </button>
          )}
          
          <button
            onClick={() => setShowDeleteModal(true)}
            className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
            title="Delete Tenant"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </button>
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      <ConfirmModal
        isOpen={showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
        onConfirm={() => onDelete(tenant.id)}
        title="Delete Tenant"
        message={`Are you sure you want to delete "${tenant.clinicName}"? This action cannot be undone and will permanently remove all data.`}
        confirmText="Delete"
        type="danger"
      />

      {/* Suspend Confirmation Modal */}
      <ConfirmModal
        isOpen={showSuspendModal}
        onClose={() => setShowSuspendModal(false)}
        onConfirm={() => onStatusChange(tenant.id, 'suspended')}
        title="Suspend Tenant"
        message={`Are you sure you want to suspend "${tenant.clinicName}"? Users will not be able to access the system until reactivated.`}
        confirmText="Suspend"
        type="warning"
      />
    </>
  );
};
