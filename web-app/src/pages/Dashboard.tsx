import React, { useState, useEffect } from 'react';
import { Tenant, CreateTenantRequest } from '../types';
import { tenantAPI, authAPI } from '../services/api';
import { TenantCard } from '../components/TenantCard';
import { CreateTenantModal } from '../components/CreateTenantModal';
import { TenantDetailsModal } from '../components/TenantDetailsModal';
import { SystemOverview } from '../components/SystemOverview';
import { HealthMonitor } from '../components/HealthMonitor';
import { AuditLogs } from '../components/AuditLogs';
import { SecurityPanel } from '../components/SecurityPanel';

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
  const [currentView, setCurrentView] = useState<'overview' | 'tenants' | 'health' | 'audit' | 'security'>('overview');
  const [sidebarOpen, setSidebarOpen] = useState(false);

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
    try {
      await tenantAPI.deleteTenant(id);
      loadTenants();
    } catch (err) {
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
    { id: 'overview', label: 'Overview', icon: '📊', color: 'from-blue-500 to-blue-600' },
    { id: 'tenants', label: 'Tenants', icon: '🏥', color: 'from-green-500 to-green-600' },
    { id: 'health', label: 'Health', icon: '💚', color: 'from-emerald-500 to-emerald-600' },
    { id: 'audit', label: 'Audit', icon: '📋', color: 'from-purple-500 to-purple-600' },
    { id: 'security', label: 'Security', icon: '🔐', color: 'from-red-500 to-red-600' },
  ];

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 flex items-center justify-center">
        <div className="text-center">
          <div className="relative">
            <div className="animate-spin rounded-full h-16 w-16 border-4 border-blue-200 border-t-blue-600 mx-auto"></div>
            <div className="absolute inset-0 rounded-full h-16 w-16 border-4 border-transparent border-r-blue-400 animate-pulse mx-auto"></div>
          </div>
          <p className="mt-6 text-slate-600 font-medium">Loading MediCore Dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50">
      {/* Mobile Sidebar Overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="fixed inset-0 bg-black bg-opacity-50 backdrop-blur-sm" onClick={() => setSidebarOpen(false)}></div>
        </div>
      )}

      {/* Header */}
      <header className="bg-white/80 backdrop-blur-xl shadow-lg border-b border-white/20 sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <div className="flex items-center space-x-4">
              <button 
                onClick={() => setSidebarOpen(!sidebarOpen)}
                className="lg:hidden p-2 rounded-xl bg-gradient-to-r from-blue-500 to-blue-600 text-white shadow-lg hover:shadow-xl transition-all duration-200"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              </button>
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 bg-gradient-to-r from-blue-500 to-indigo-600 rounded-xl flex items-center justify-center shadow-lg">
                  <span className="text-white font-bold text-lg">M</span>
                </div>
                <div>
                  <h1 className="text-2xl font-bold bg-gradient-to-r from-slate-800 to-slate-600 bg-clip-text text-transparent">
                    MediCore
                  </h1>
                  <span className="text-xs text-slate-500 font-medium">Admin Portal</span>
                </div>
              </div>
            </div>
            <div className="flex items-center space-x-4">
              <div className="hidden sm:flex items-center space-x-3">
                <div className="w-8 h-8 bg-gradient-to-r from-emerald-400 to-emerald-500 rounded-full flex items-center justify-center">
                  <span className="text-white text-sm font-bold">SA</span>
                </div>
                <div className="text-right">
                  <p className="text-sm font-medium text-slate-700">Super Admin</p>
                  <p className="text-xs text-slate-500">admin@medicore.co.zw</p>
                </div>
              </div>
              <button 
                onClick={handleLogout}
                className="bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white px-4 py-2 rounded-xl text-sm font-medium transition-all duration-200 shadow-lg hover:shadow-xl transform hover:-translate-y-0.5"
              >
                <span className="hidden sm:inline">Logout</span>
                <svg className="w-4 h-4 sm:hidden" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      </header>

      <div className="flex">
        {/* Sidebar */}
        <aside className={`fixed inset-y-0 left-0 z-50 w-64 bg-white/90 backdrop-blur-xl shadow-2xl transform transition-transform duration-300 ease-in-out lg:translate-x-0 lg:static lg:inset-0 ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}>
          <div className="flex flex-col h-full pt-20 lg:pt-4">
            <div className="flex-1 px-4 py-6 space-y-2">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => {
                    setCurrentView(tab.id as any);
                    setSidebarOpen(false);
                  }}
                  className={`w-full flex items-center space-x-3 px-4 py-3 rounded-xl font-medium text-sm transition-all duration-200 group ${
                    currentView === tab.id
                      ? `bg-gradient-to-r ${tab.color} text-white shadow-lg transform scale-105`
                      : 'text-slate-600 hover:bg-slate-100 hover:text-slate-800'
                  }`}
                >
                  <span className="text-xl">{tab.icon}</span>
                  <span className="font-semibold">{tab.label}</span>
                  {currentView === tab.id && (
                    <div className="ml-auto w-2 h-2 bg-white rounded-full animate-pulse"></div>
                  )}
                </button>
              ))}
            </div>
            <div className="p-4 border-t border-slate-200">
              <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl p-4">
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 bg-gradient-to-r from-blue-500 to-indigo-600 rounded-lg flex items-center justify-center">
                    <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                    </svg>
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-slate-800">System Status</p>
                    <p className="text-xs text-slate-600">All systems operational</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </aside>

        {/* Main Content */}
        <main className="flex-1 lg:ml-0">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            {currentView === 'overview' && <SystemOverview />}
            {currentView === 'health' && <HealthMonitor />}
            {currentView === 'audit' && <AuditLogs />}
            {currentView === 'security' && <SecurityPanel />}
            
            {currentView === 'tenants' && (
              <div className="space-y-8">
                {/* Quick Stats */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                  <div className="bg-white/80 backdrop-blur-sm p-6 rounded-2xl shadow-xl border border-white/20 hover:shadow-2xl transition-all duration-300 transform hover:-translate-y-1">
                    <div className="flex items-center">
                      <div className="flex-shrink-0">
                        <div className="w-12 h-12 bg-gradient-to-r from-blue-500 to-blue-600 rounded-xl flex items-center justify-center shadow-lg">
                          <span className="text-white text-lg">🏥</span>
                        </div>
                      </div>
                      <div className="ml-4">
                        <p className="text-sm font-medium text-slate-600">Total Tenants</p>
                        <p className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-blue-800 bg-clip-text text-transparent">
                          {tenants.length}
                        </p>
                      </div>
                    </div>
                  </div>
                  
                  <div className="bg-white/80 backdrop-blur-sm p-6 rounded-2xl shadow-xl border border-white/20 hover:shadow-2xl transition-all duration-300 transform hover:-translate-y-1">
                    <div className="flex items-center">
                      <div className="flex-shrink-0">
                        <div className="w-12 h-12 bg-gradient-to-r from-emerald-500 to-emerald-600 rounded-xl flex items-center justify-center shadow-lg">
                          <span className="text-white text-lg">✅</span>
                        </div>
                      </div>
                      <div className="ml-4">
                        <p className="text-sm font-medium text-slate-600">Active</p>
                        <p className="text-3xl font-bold bg-gradient-to-r from-emerald-600 to-emerald-800 bg-clip-text text-transparent">
                          {tenants.filter(t => t.status === 'active').length}
                        </p>
                      </div>
                    </div>
                  </div>
                  
                  <div className="bg-white/80 backdrop-blur-sm p-6 rounded-2xl shadow-xl border border-white/20 hover:shadow-2xl transition-all duration-300 transform hover:-translate-y-1">
                    <div className="flex items-center">
                      <div className="flex-shrink-0">
                        <div className="w-12 h-12 bg-gradient-to-r from-amber-500 to-amber-600 rounded-xl flex items-center justify-center shadow-lg">
                          <span className="text-white text-lg">⏳</span>
                        </div>
                      </div>
                      <div className="ml-4">
                        <p className="text-sm font-medium text-slate-600">Pending</p>
                        <p className="text-3xl font-bold bg-gradient-to-r from-amber-600 to-amber-800 bg-clip-text text-transparent">
                          {tenants.filter(t => t.status === 'pending').length}
                        </p>
                      </div>
                    </div>
                  </div>
                  
                  <div className="bg-white/80 backdrop-blur-sm p-6 rounded-2xl shadow-xl border border-white/20 hover:shadow-2xl transition-all duration-300 transform hover:-translate-y-1">
                    <div className="flex items-center">
                      <div className="flex-shrink-0">
                        <div className="w-12 h-12 bg-gradient-to-r from-purple-500 to-purple-600 rounded-xl flex items-center justify-center shadow-lg">
                          <span className="text-white text-lg">💼</span>
                        </div>
                      </div>
                      <div className="ml-4">
                        <p className="text-sm font-medium text-slate-600">Enterprise</p>
                        <p className="text-3xl font-bold bg-gradient-to-r from-purple-600 to-purple-800 bg-clip-text text-transparent">
                          {tenants.filter(t => t.subscriptionTier === 'enterprise').length}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center space-y-4 sm:space-y-0">
                  <h2 className="text-2xl font-bold text-slate-800">Tenant Management</h2>
                  <button
                    onClick={() => setCreateModalOpen(true)}
                    className="bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white px-6 py-3 rounded-xl font-medium transition-all duration-200 shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 flex items-center space-x-2"
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
                  <div className="text-center py-16">
                    <div className="w-24 h-24 bg-gradient-to-r from-slate-200 to-slate-300 rounded-full flex items-center justify-center mx-auto mb-6">
                      <span className="text-4xl">🏥</span>
                    </div>
                    <h3 className="text-xl font-semibold text-slate-700 mb-2">No tenants found</h3>
                    <p className="text-slate-500 mb-6">Create your first tenant to get started with MediCore.</p>
                    <button
                      onClick={() => setCreateModalOpen(true)}
                      className="bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white px-6 py-3 rounded-xl font-medium transition-all duration-200 shadow-lg hover:shadow-xl"
                    >
                      Create First Tenant
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