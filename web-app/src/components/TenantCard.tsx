import React from 'react';
import { Tenant } from '../types';

interface TenantCardProps {
  tenant: Tenant;
  onStatusChange: (id: string, status: string) => void;
  onDelete: (id: string) => void;
  onManageUsers: (tenant: Tenant) => void;
}

export const TenantCard: React.FC<TenantCardProps> = ({ tenant, onStatusChange, onDelete, onManageUsers }) => {
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'bg-green-100 text-green-800';
      case 'pending': return 'bg-yellow-100 text-yellow-800';
      case 'suspended': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getTierColor = (tier: string) => {
    switch (tier) {
      case 'enterprise': return 'bg-purple-100 text-purple-800';
      case 'professional': return 'bg-blue-100 text-blue-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="bg-white overflow-hidden shadow rounded-lg">
      <div className="px-4 py-5 sm:p-6">
        <div className="flex items-center justify-between">
          <h3 className="text-lg leading-6 font-medium text-gray-900">
            {tenant.clinicName}
          </h3>
          <div className="flex space-x-2">
            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(tenant.status)}`}>
              {tenant.status}
            </span>
            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getTierColor(tenant.subscriptionTier)}`}>
              {tenant.subscriptionTier}
            </span>
          </div>
        </div>
        
        <div className="mt-4 space-y-2">
          <p className="text-sm text-gray-600">
            <strong>Subdomain:</strong> {tenant.subdomain}.medicore.co.zw
          </p>
          <p className="text-sm text-gray-600">
            <strong>Email:</strong> {tenant.contactEmail}
          </p>
          <p className="text-sm text-gray-600">
            <strong>Phone:</strong> {tenant.contactPhone}
          </p>
          {tenant.address && (
            <p className="text-sm text-gray-600">
              <strong>Address:</strong> {tenant.address}, {tenant.city}
            </p>
          )}
          <p className="text-sm text-gray-600">
            <strong>Database:</strong> {tenant.databaseName}
          </p>
          <p className="text-sm text-gray-600">
            <strong>Created:</strong> {new Date(tenant.createdAt).toLocaleDateString()}
          </p>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          {tenant.status === 'pending' && (
            <button
              onClick={() => onStatusChange(tenant.id, 'active')}
              className="inline-flex items-center px-3 py-1 border border-transparent text-xs font-medium rounded text-white bg-green-600 hover:bg-green-700"
            >
              Activate
            </button>
          )}
          {tenant.status === 'active' && (
            <button
              onClick={() => onStatusChange(tenant.id, 'suspended')}
              className="inline-flex items-center px-3 py-1 border border-transparent text-xs font-medium rounded text-white bg-yellow-600 hover:bg-yellow-700"
            >
              Suspend
            </button>
          )}
          <button
            onClick={() => onManageUsers(tenant)}
            className="inline-flex items-center px-3 py-1 border border-transparent text-xs font-medium rounded text-white bg-blue-600 hover:bg-blue-700"
          >
            Manage Users
          </button>
          <button
            onClick={() => onDelete(tenant.id)}
            className="inline-flex items-center px-3 py-1 border border-transparent text-xs font-medium rounded text-white bg-red-600 hover:bg-red-700"
          >
            Delete
          </button>
        </div>
      </div>
    </div>
  );
};