import React, { useState, useEffect } from 'react';
import { Tenant, CreateTenantRequest } from '../types';
import { tenantAPI, authAPI } from '../services/api';
import { TenantCard } from '../components/TenantCard';
import { CreateTenantModal } from '../components/CreateTenantModal';
import { TenantDetailsModal } from '../components/TenantDetailsModal';
import { SystemOverview } from '../components/SystemOverview';

interface DashboardProps {
  onLogout: () => void;
}

export const Dashboard: React.FC<DashboardProps> = ({ onLogout }) => {
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [loading, setLoading] = useState(true);
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [createLoading, setCreateLoading] = useState(false);
  const [error, setError] = useState('');
  const [selectedTenant, setSelectedTenant] = useState<Tenant | null>(null);
  const [detailsModalOpen, setDetailsModalOpen] = useState(false);
  const [currentView, setCurrentView] = useState<'overview' | 'tenants'>('overview');

  useEffect(() => {
    loadTenants();
  }, []);

  const loadTenants = async () => {
    try {
      const data = await tenantAPI.getAllTenants();
      setTenants(data);
    } catch (err) {
      setError('Failed to load tenants');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateTenant = async (data: CreateTenantRequest) => {
    setCreateLoading(true);
    try {
      await tenantAPI.createTenant(data);
      setCreateModalOpen(false);
      loadTenants();
    } catch (err) {
      setError('Failed to create tenant');
    } finally {
      setCreateLoading(false);
    }
  };

  const handleStatusChange = async (id: string, status: string) => {
    try {
      await tenantAPI.updateTenantStatus(id, status);
      loadTenants();
    } catch (err) {
      setError('Failed to update tenant status');
    }
  };

  const handleDeleteTenant = async (id: string) => {
    if (window.confirm('Are you sure you want to delete this tenant? This action cannot be undone.')) {
      try {
        await tenantAPI.deleteTenant(id);
        loadTenants();
      } catch (err) {
        setError('Failed to delete tenant');
      }
    }
  };

  const handleLogout = () => {
    authAPI.logout();
    onLogout();
  };

  const handleManageUsers = (tenant: Tenant) => {
    setSelectedTenant(tenant);
    setDetailsModalOpen(true);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-lg">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-6">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">🏥 MediCore</h1>
              <p className="text-sm text-gray-600">Tenant Management Portal</p>
            </div>
            <div className="flex items-center space-x-4">
              <span className="text-sm text-gray-600">Super Admin</span>
              <button
                onClick={handleLogout}
                className="text-sm text-red-600 hover:text-red-800"
              >
                Logout
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <div className="bg-white border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <nav className="flex space-x-8 py-4">
            <button
              onClick={() => setCurrentView('overview')}
              className={`px-3 py-2 text-sm font-medium rounded-md ${
                currentView === 'overview'
                  ? 'bg-blue-100 text-blue-700'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              📊 System Overview
            </button>
            <button
              onClick={() => setCurrentView('tenants')}
              className={`px-3 py-2 text-sm font-medium rounded-md ${
                currentView === 'tenants'
                  ? 'bg-blue-100 text-blue-700'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              🏥 Tenant Management
            </button>
          </nav>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        {currentView === 'overview' && <SystemOverview />}
        
        {currentView === 'tenants' && (
          <>
            {/* Quick Stats */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
              <div className="bg-white overflow-hidden shadow rounded-lg">
                <div className="p-5">
                  <div className="flex items-center">
                    <div className="flex-shrink-0">
                      <div className="text-2xl">🏥</div>
                    </div>
                    <div className="ml-5 w-0 flex-1">
                      <dl>
                        <dt className="text-sm font-medium text-gray-500 truncate">Total Tenants</dt>
                        <dd className="text-lg font-medium text-gray-900">{tenants.length}</dd>
                      </dl>
                    </div>
                  </div>
                </div>
              </div>

              <div className="bg-white overflow-hidden shadow rounded-lg">
                <div className="p-5">
                  <div className="flex items-center">
                    <div className="flex-shrink-0">
                      <div className="text-2xl">✅</div>
                    </div>
                    <div className="ml-5 w-0 flex-1">
                      <dl>
                        <dt className="text-sm font-medium text-gray-500 truncate">Active</dt>
                        <dd className="text-lg font-medium text-gray-900">
                          {tenants.filter(t => t.status === 'active').length}
                        </dd>
                      </dl>
                    </div>
                  </div>
                </div>
              </div>

              <div className="bg-white overflow-hidden shadow rounded-lg">
                <div className="p-5">
                  <div className="flex items-center">
                    <div className="flex-shrink-0">
                      <div className="text-2xl">⏳</div>
                    </div>
                    <div className="ml-5 w-0 flex-1">
                      <dl>
                        <dt className="text-sm font-medium text-gray-500 truncate">Pending</dt>
                        <dd className="text-lg font-medium text-gray-900">
                          {tenants.filter(t => t.status === 'pending').length}
                        </dd>
                      </dl>
                    </div>
                  </div>
                </div>
              </div>

              <div className="bg-white overflow-hidden shadow rounded-lg">
                <div className="p-5">
                  <div className="flex items-center">
                    <div className="flex-shrink-0">
                      <div className="text-2xl">💼</div>
                    </div>
                    <div className="ml-5 w-0 flex-1">
                      <dl>
                        <dt className="text-sm font-medium text-gray-500 truncate">Enterprise</dt>
                        <dd className="text-lg font-medium text-gray-900">
                          {tenants.filter(t => t.subscriptionTier === 'enterprise').length}
                        </dd>
                      </dl>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-lg font-medium text-gray-900">Tenants</h2>
              <button
                onClick={() => setCreateModalOpen(true)}
                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700"
              >
                + Create Tenant
              </button>
            </div>

            {/* Error Message */}
            {error && (
              <div className="mb-4 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
                {error}
              </div>
            )}

            {/* Tenants Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {tenants.map((tenant) => (
                <TenantCard
                  key={tenant.id}
                  tenant={tenant}
                  onStatusChange={handleStatusChange}
                  onDelete={handleDeleteTenant}
                  onManageUsers={handleManageUsers}
                />
              ))}
            </div>

            {tenants.length === 0 && (
              <div className="text-center py-12">
                <div className="text-gray-500">No tenants found. Create your first tenant to get started.</div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Create Tenant Modal */}
      <CreateTenantModal
        isOpen={createModalOpen}
        onClose={() => setCreateModalOpen(false)}
        onSubmit={handleCreateTenant}
        loading={createLoading}
      />

      {/* Tenant Details Modal */}
      <TenantDetailsModal
        tenant={selectedTenant}
        isOpen={detailsModalOpen}
        onClose={() => {
          setDetailsModalOpen(false);
          setSelectedTenant(null);
        }}
        onUpdate={loadTenants}
      />
    </div>
  );
};