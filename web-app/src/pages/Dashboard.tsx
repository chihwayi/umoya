import React, { useState, useEffect, useCallback } from 'react';
import { Tenant, CreateTenantRequest } from '../types';
import { tenantAPI, authAPI } from '../services/api';
import { TenantCard } from '../components/TenantCard';
import { CreateTenantModal } from '../components/CreateTenantModal';
import { TenantDetailsModal } from '../components/TenantDetailsModal';
import { SystemOverview } from '../components/SystemOverview';
import { HealthMonitor } from '../components/HealthMonitor';
import { AuditLogs } from '../components/AuditLogs';
import { SecurityPanel } from '../components/SecurityPanel';
import { BackupManager } from '../components/BackupManager';
import { TerminologyImport } from '../components/TerminologyImport';
import { CdssAdmin } from '../components/CdssAdmin';
import { DemoAccessRequestsPanel } from '../components/DemoAccessRequestsPanel';
import { useNotification } from '../contexts/NotificationContext';

interface DashboardProps {
  onLogout: () => void;
}

export const Dashboard: React.FC<DashboardProps> = ({ onLogout }) => {
  const { success, error: notifyError } = useNotification();
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [loading, setLoading] = useState(true);
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [createLoading, setCreateLoading] = useState(false);
  const [error, setError] = useState('');
  const [selectedTenant, setSelectedTenant] = useState<Tenant | null>(null);
  const [detailsModalOpen, setDetailsModalOpen] = useState(false);
  const [currentView, setCurrentView] = useState<'overview' | 'tenants' | 'requests' | 'health' | 'audit' | 'security' | 'backups' | 'terminology' | 'cdss'>('overview');
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const loadTenants = useCallback(async () => {
    try {
      const data = await tenantAPI.getAllTenants();
      if (Array.isArray(data)) {
        setTenants(data);
        setSelectedTenant((current) => {
          if (!current) return current;
          return data.find((tenant) => tenant.id === current.id) || current;
        });
      } else {
        console.warn('Expected array of tenants but received:', data);
        setTenants([]);
      }
    } catch (err) {
      console.error('Failed to load tenants:', err);
      setError('Failed to load tenants');
      notifyError('Error', 'Failed to load tenants list');
      setTenants([]);
    } finally {
      setLoading(false);
    }
  }, [notifyError]);

  useEffect(() => {
    loadTenants();
  }, [loadTenants]);

  const handleCreateTenant = async (data: CreateTenantRequest) => {
    setCreateLoading(true);
    try {
      await tenantAPI.createTenant(data);
      setCreateModalOpen(false);
      success('Success', 'Tenant created successfully');
      loadTenants();
    } catch (err: any) {
      console.error('Failed to create tenant:', err);
      const errorMessage = err.response?.data?.message || 'Failed to create tenant';
      setError(Array.isArray(errorMessage) ? errorMessage.join(', ') : errorMessage);
      notifyError('Creation Failed', Array.isArray(errorMessage) ? errorMessage.join(', ') : errorMessage);
    } finally {
      setCreateLoading(false);
    }
  };

  const handleStatusChange = async (id: string, status: string) => {
    try {
      await tenantAPI.updateTenantStatus(id, status);
      success('Success', `Tenant status updated to ${status}`);
      loadTenants();
    } catch (err) {
      notifyError('Update Failed', 'Failed to update tenant status');
      setError('Failed to update tenant status');
    }
  };

  const handleDeleteTenant = async (id: string) => {
    try {
      await tenantAPI.deleteTenant(id);
      success('Success', 'Tenant deleted successfully');
      loadTenants();
    } catch (err) {
      notifyError('Deletion Failed', 'Failed to delete tenant');
      setError('Failed to delete tenant');
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

  const tabs = [
    { 
      id: 'overview', 
      label: 'Overview', 
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
        </svg>
      )
    },
    { 
      id: 'cdss', 
      label: 'CDSS Admin', 
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 1.567-3 3.5S10.343 15 12 15s3-1.567 3-3.5S13.657 8 12 8z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.4 15a7.5 7.5 0 10-14.8 0M12 17v4" />
        </svg>
      )
    },
    { 
      id: 'tenants', 
      label: 'Tenants', 
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
        </svg>
      )
    },
    {
      id: 'requests',
      label: 'Demo Requests',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-4 4v-4z" />
        </svg>
      )
    },
    { 
      id: 'terminology', 
      label: 'Terminology', 
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
        </svg>
      )
    },
    { 
      id: 'health', 
      label: 'Health', 
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      )
    },
    { 
      id: 'audit', 
      label: 'Audit', 
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
        </svg>
      )
    },
    { 
      id: 'security', 
      label: 'Security', 
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
        </svg>
      )
    },
    { 
      id: 'backups', 
      label: 'Backups', 
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4" />
        </svg>
      )
    },
  ];

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-slate-800 mx-auto"></div>
          <p className="mt-4 text-slate-600 font-medium">Loading MediCore Dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Mobile Sidebar Overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="fixed inset-0 bg-slate-900 bg-opacity-50 backdrop-blur-sm" onClick={() => setSidebarOpen(false)}></div>
        </div>
      )}

      {/* Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-4">
              <button 
                onClick={() => setSidebarOpen(!sidebarOpen)}
                className="lg:hidden p-2 rounded-md text-slate-500 hover:text-slate-700 hover:bg-slate-100 transition-colors"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              </button>
              <div className="flex items-center space-x-3">
                <div className="rounded-xl border border-slate-200 bg-white p-1.5 shadow-sm">
                  <img src="/medicore.png" alt="MediCore logo" className="h-8 w-auto rounded-lg" />
                </div>
                <div>
                  <h1 className="text-lg font-bold text-slate-800 tracking-tight">
                    MediCore
                  </h1>
                </div>
              </div>
            </div>
            <div className="flex items-center space-x-4">
              <div className="hidden sm:flex items-center space-x-3 px-3 py-1 bg-slate-100 rounded-md">
                <div className="w-6 h-6 bg-slate-300 rounded-full flex items-center justify-center">
                  <span className="text-slate-600 text-xs font-bold">SA</span>
                </div>
                <div className="text-right">
                  <p className="text-sm font-medium text-slate-700">Super Admin</p>
                </div>
              </div>
              <button 
                onClick={handleLogout}
                className="text-slate-500 hover:text-slate-700 p-2 rounded-md hover:bg-slate-100 transition-colors"
                title="Logout"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      </header>

      <div className="flex">
        {/* Sidebar */}
        <aside className={`fixed inset-y-0 left-0 z-50 w-64 bg-slate-900 text-white transform transition-transform duration-300 ease-in-out lg:translate-x-0 lg:static lg:inset-0 ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}>
          <div className="flex flex-col h-full pt-20 lg:pt-6">
            <div className="flex-1 px-3 space-y-1">
              <div className="px-3 mb-6">
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Menu</p>
              </div>
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => {
                    setCurrentView(tab.id as any);
                    setSidebarOpen(false);
                  }}
                  className={`w-full flex items-center space-x-3 px-3 py-2 rounded-md font-medium text-sm transition-colors ${
                    currentView === tab.id
                      ? 'bg-slate-800 text-white border-l-4 border-blue-500'
                      : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                  }`}
                >
                  <span className="text-lg opacity-75">{tab.icon}</span>
                  <span>{tab.label}</span>
                </button>
              ))}
            </div>
            <div className="p-4 border-t border-slate-800">
              <div className="bg-slate-800 rounded-md p-4">
                <div className="flex items-center space-x-3">
                  <div className="flex-shrink-0">
                    <span className="relative flex h-3 w-3">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
                    </span>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-white">System Status</p>
                    <p className="text-xs text-slate-400">All systems operational</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </aside>

        {/* Main Content */}
        <main className="flex-1 min-w-0 lg:ml-0 bg-slate-50 min-h-[calc(100vh-4rem)]">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            {currentView === 'overview' && <SystemOverview />}
            {currentView === 'health' && <HealthMonitor />}
            {currentView === 'audit' && <AuditLogs />}
            {currentView === 'security' && <SecurityPanel />}
            {currentView === 'backups' && <BackupManager />}
            {currentView === 'terminology' && <TerminologyImport />}
            {currentView === 'cdss' && <CdssAdmin />}
            {currentView === 'requests' && <DemoAccessRequestsPanel />}
            
            {currentView === 'tenants' && (
              <div className="space-y-6">
                {/* Quick Stats */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  <div className="bg-white p-6 rounded-lg border border-slate-200 shadow-sm">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-slate-500">Total Tenants</p>
                        <p className="text-2xl font-semibold text-slate-900 mt-1">
                          {tenants.length}
                        </p>
                      </div>
                      <div className="p-3 bg-blue-50 rounded-md">
                        <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                        </svg>
                      </div>
                    </div>
                  </div>
                  
                  <div className="bg-white p-6 rounded-lg border border-slate-200 shadow-sm">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-slate-500">Active</p>
                        <p className="text-2xl font-semibold text-slate-900 mt-1">
                          {tenants.filter(t => t.status === 'active').length}
                        </p>
                      </div>
                      <div className="p-3 bg-emerald-50 rounded-md">
                        <svg className="w-6 h-6 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                      </div>
                    </div>
                  </div>
                  
                  <div className="bg-white p-6 rounded-lg border border-slate-200 shadow-sm">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-slate-500">Pending</p>
                        <p className="text-2xl font-semibold text-slate-900 mt-1">
                          {tenants.filter(t => t.status === 'pending').length}
                        </p>
                      </div>
                      <div className="p-3 bg-amber-50 rounded-md">
                        <svg className="w-6 h-6 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                      </div>
                    </div>
                  </div>
                  
                  <div className="bg-white p-6 rounded-lg border border-slate-200 shadow-sm">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-slate-500">Enterprise</p>
                        <p className="text-2xl font-semibold text-slate-900 mt-1">
                          {tenants.filter(t => t.subscriptionTier === 'enterprise').length}
                        </p>
                      </div>
                      <div className="p-3 bg-purple-50 rounded-md">
                        <svg className="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                        </svg>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center space-y-4 sm:space-y-0 pb-2 border-b border-slate-200">
                  <h2 className="text-xl font-bold text-slate-800">Tenant Management</h2>
                  <button
                    onClick={() => setCreateModalOpen(true)}
                    className="bg-slate-900 hover:bg-slate-800 text-white px-4 py-2 rounded-md font-medium transition-colors shadow-sm flex items-center space-x-2"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                    <span>Create Tenant</span>
                  </button>
                </div>

                {/* Error Message */}
                {error && (
                  <div className="bg-red-50 border border-red-200 text-red-700 px-6 py-4 rounded-xl shadow-lg">
                    <div className="flex items-center space-x-2">
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <span>{error}</span>
                    </div>
                  </div>
                )}

                {/* Tenants Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
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
                  <div className="text-center py-16 bg-white rounded-lg border border-dashed border-slate-300">
                    <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4">
                      <svg className="w-8 h-8 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                      </svg>
                    </div>
                    <h3 className="text-lg font-medium text-slate-900 mb-1">No tenants found</h3>
                    <p className="text-slate-500 mb-6">Create your first tenant to get started with MediCore.</p>
                    <button
                      onClick={() => setCreateModalOpen(true)}
                      className="bg-slate-900 hover:bg-slate-800 text-white px-4 py-2 rounded-md font-medium transition-colors shadow-sm inline-flex items-center space-x-2"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                      </svg>
                      <span>Create First Tenant</span>
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </main>
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
