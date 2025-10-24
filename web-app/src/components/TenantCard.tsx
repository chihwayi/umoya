import React, { useState } from 'react';
import { Tenant } from '../types';
import { ConfirmModal } from './Modal';

interface TenantCardProps {
  tenant: Tenant;
  onStatusChange: (id: string, status: string) => void;
  onDelete: (id: string) => void;
  onManageUsers: (tenant: Tenant) => void;
}

export const TenantCard: React.FC<TenantCardProps> = ({ tenant, onStatusChange, onDelete, onManageUsers }) => {
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showSuspendModal, setShowSuspendModal] = useState(false);
  const getStatusStyle = (status: string) => {
    switch (status) {
      case 'active': return { bg: 'bg-gradient-to-r from-emerald-100 to-emerald-200', text: 'text-emerald-800', icon: '✅' };
      case 'pending': return { bg: 'bg-gradient-to-r from-amber-100 to-amber-200', text: 'text-amber-800', icon: '⏳' };
      case 'suspended': return { bg: 'bg-gradient-to-r from-red-100 to-red-200', text: 'text-red-800', icon: '⛔' };
      default: return { bg: 'bg-gradient-to-r from-slate-100 to-slate-200', text: 'text-slate-800', icon: '❓' };
    }
  };

  const getTierStyle = (tier: string) => {
    switch (tier) {
      case 'enterprise': return { bg: 'bg-gradient-to-r from-purple-100 to-purple-200', text: 'text-purple-800', icon: '👑' };
      case 'professional': return { bg: 'bg-gradient-to-r from-blue-100 to-blue-200', text: 'text-blue-800', icon: '💼' };
      default: return { bg: 'bg-gradient-to-r from-slate-100 to-slate-200', text: 'text-slate-800', icon: '📦' };
    }
  };

  const statusStyle = getStatusStyle(tenant.status);
  const tierStyle = getTierStyle(tenant.subscriptionTier);

  return (
    <>
      <div className="bg-white/80 backdrop-blur-sm overflow-hidden shadow-xl rounded-2xl border border-white/20 hover:shadow-2xl transition-all duration-300 transform hover:-translate-y-1">
        <div className="p-6">
          <div className="flex items-start justify-between mb-4">
            <div className="flex items-center space-x-3">
              <div className="w-12 h-12 bg-gradient-to-r from-blue-500 to-indigo-600 rounded-xl flex items-center justify-center shadow-lg">
                <span className="text-white font-bold text-lg">🏥</span>
              </div>
              <div>
                <h3 className="text-lg font-bold text-slate-800">
                  {tenant.clinicName}
                </h3>
                <p className="text-sm text-slate-500">{tenant.subdomain}.medicore.co.zw</p>
              </div>
            </div>
            <div className="flex flex-col space-y-2">
              <span className={`inline-flex items-center px-3 py-1 rounded-xl text-xs font-semibold ${statusStyle.bg} ${statusStyle.text} shadow-sm`}>
                <span className="mr-1">{statusStyle.icon}</span>
                {tenant.status}
              </span>
              <span className={`inline-flex items-center px-3 py-1 rounded-xl text-xs font-semibold ${tierStyle.bg} ${tierStyle.text} shadow-sm`}>
                <span className="mr-1">{tierStyle.icon}</span>
                {tenant.subscriptionTier}
              </span>
            </div>
          </div>
        
          <div className="space-y-3 mb-6">
            <div className="flex items-center space-x-2 text-sm text-slate-600">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 4.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
              <span>{tenant.contactEmail}</span>
            </div>
            <div className="flex items-center space-x-2 text-sm text-slate-600">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
              </svg>
              <span>{tenant.contactPhone}</span>
            </div>
            {tenant.address && (
              <div className="flex items-center space-x-2 text-sm text-slate-600">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                <span>{tenant.address}, {tenant.city}</span>
              </div>
            )}
            <div className="flex items-center space-x-2 text-sm text-slate-600">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3a4 4 0 118 0v4m-4 6v6m-4-6h8m-8 0a4 4 0 00-4 4v2a4 4 0 004 4h8a4 4 0 004-4v-2a4 4 0 00-4-4" />
              </svg>
              <span>{tenant.databaseName}</span>
            </div>
            <div className="flex items-center space-x-2 text-sm text-slate-600">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3a4 4 0 118 0v4m-4 6v6m-4-6h8m-8 0a4 4 0 00-4 4v2a4 4 0 004 4h8a4 4 0 004-4v-2a4 4 0 00-4-4" />
              </svg>
              <span>Created {new Date(tenant.createdAt).toLocaleDateString()}</span>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            {tenant.status === 'pending' && (
              <button
                onClick={() => onStatusChange(tenant.id, 'active')}
                className="flex-1 bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 text-white px-4 py-2 rounded-xl text-sm font-medium transition-all duration-200 shadow-lg hover:shadow-xl flex items-center justify-center space-x-2"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                <span>Activate</span>
              </button>
            )}
            {tenant.status === 'active' && (
              <button
                onClick={() => setShowSuspendModal(true)}
                className="flex-1 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white px-4 py-2 rounded-xl text-sm font-medium transition-all duration-200 shadow-lg hover:shadow-xl flex items-center justify-center space-x-2"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 9v6m4-6v6m7-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span>Suspend</span>
              </button>
            )}
            <button
              onClick={() => onManageUsers(tenant)}
              className="flex-1 bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white px-4 py-2 rounded-xl text-sm font-medium transition-all duration-200 shadow-lg hover:shadow-xl flex items-center justify-center space-x-2"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z" />
              </svg>
              <span>Users</span>
            </button>
            <button
              onClick={() => setShowDeleteModal(true)}
              className="bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white px-4 py-2 rounded-xl text-sm font-medium transition-all duration-200 shadow-lg hover:shadow-xl flex items-center justify-center"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </button>
          </div>
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