import React, { useState, useEffect, useCallback } from 'react';
import { Tenant, CreateTenantRequest } from '../types';
import { tenantAPI, authAPI } from '../services/api';
import { TenantCard } from '../components/TenantCard';
import { CreateTenantModal } from '../components/CreateTenantModal';
import { TenantDetailsModal } from '../components/TenantDetailsModal';
import { ErrorBoundary } from '../components/ErrorBoundary';
import { SystemOverview } from '../components/SystemOverview';
import { HealthMonitor } from '../components/HealthMonitor';
import { AuditLogs } from '../components/AuditLogs';
import { SecurityPanel } from '../components/SecurityPanel';
import { BackupManager } from '../components/BackupManager';
import { TerminologyImport } from '../components/TerminologyImport';
import { CdssAdmin } from '../components/CdssAdmin';
import { DemoAccessRequestsPanel } from '../components/DemoAccessRequestsPanel';
import { DatabaseDriftPanel } from '../components/DatabaseDriftPanel';
import { RolloutDashboard } from '../components/RolloutDashboard';
import { DataMigrationPanel } from '../components/DataMigrationPanel';
import { BaaRegistryPage } from './BaaRegistryPage';
import { useNotification } from '../contexts/NotificationContext';

interface DashboardProps {
  onLogout: () => void;
}

const NAV_ITEMS = [
  {
    id: 'overview',
    label: 'Overview',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
      </svg>
    ),
    accent: '#0AA98A',
  },
  {
    id: 'cdss',
    label: 'CDSS & AI',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
      </svg>
    ),
    accent: '#0AA98A',
  },
  {
    id: 'tenants',
    label: 'Tenants',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
      </svg>
    ),
    accent: '#3B9EFF',
  },
  {
    id: 'requests',
    label: 'Demo Requests',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-4 4v-4z" />
      </svg>
    ),
    accent: '#E8614D',
  },
  {
    id: 'terminology',
    label: 'Terminology',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
      </svg>
    ),
    accent: '#3B9EFF',
  },
  {
    id: 'health',
    label: 'Health Monitor',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
    accent: '#0AA98A',
  },
  {
    id: 'audit',
    label: 'Audit Logs',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
      </svg>
    ),
    accent: '#E8614D',
  },
  {
    id: 'security',
    label: 'Security',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
      </svg>
    ),
    accent: '#3B9EFF',
  },
  {
    id: 'backups',
    label: 'Backups',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4" />
      </svg>
    ),
    accent: '#E8614D',
  },
  {
    id: 'db-drift',
    label: 'DB Integrity',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4" />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4" />
      </svg>
    ),
    accent: '#A66CFF',
  },
  {
    id: 'rollout',
    label: 'Rollout',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
          d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
      </svg>
    ),
    accent: '#0AA98A',
  },
  {
    id: 'baa-registry',
    label: 'BAA Registry',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4M12 3l7 4v5c0 5-3 8-7 9-4-1-7-4-7-9V7l7-4z" />
      </svg>
    ),
    accent: '#0AA98A',
  },
  {
    id: 'data-migration',
    label: 'Data Migration',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M12 12v9m0-9l-3 3m3-3l3 3" />
      </svg>
    ),
    accent: '#3B9EFF',
  },
] as const;

type ViewId = typeof NAV_ITEMS[number]['id'];

export const Dashboard: React.FC<DashboardProps> = ({ onLogout }) => {
  const { success, error: notifyError } = useNotification();
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [loading, setLoading] = useState(true);
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [createLoading, setCreateLoading] = useState(false);
  const [error, setError] = useState('');
  const [selectedTenant, setSelectedTenant] = useState<Tenant | null>(null);
  const [detailsModalOpen, setDetailsModalOpen] = useState(false);
  const [detailsFocusSection, setDetailsFocusSection] = useState<'default' | 'dhis2'>('default');
  const [currentView, setCurrentView] = useState<ViewId>('overview');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [selectedTenantIds, setSelectedTenantIds] = useState<Set<string>>(new Set());
  const [bulkLoading, setBulkLoading] = useState(false);

  const loadTenants = useCallback(async () => {
    try {
      const data = await tenantAPI.getAllTenants();
      if (Array.isArray(data)) {
        setTenants(data);
        setSelectedTenant((current) => {
          if (!current) return current;
          return data.find((t) => t.id === current.id) || current;
        });
      } else {
        setTenants([]);
      }
    } catch (err) {
      setError('Failed to load tenants');
      notifyError('Error', 'Failed to load tenants list');
      setTenants([]);
    } finally {
      setLoading(false);
    }
  }, [notifyError]);

  useEffect(() => { loadTenants(); }, [loadTenants]);

  const handleCreateTenant = async (data: CreateTenantRequest) => {
    setCreateLoading(true);
    try {
      await tenantAPI.createTenant(data);
      setCreateModalOpen(false);
      success('Success', 'Tenant created successfully');
      loadTenants();
    } catch (err: any) {
      const msg = err.response?.data?.message || 'Failed to create tenant';
      setError(Array.isArray(msg) ? msg.join(', ') : msg);
      notifyError('Creation Failed', Array.isArray(msg) ? msg.join(', ') : msg);
    } finally {
      setCreateLoading(false);
    }
  };

  const handleStatusChange = async (id: string, status: string) => {
    try {
      await tenantAPI.updateTenantStatus(id, status);
      success('Success', `Tenant status updated to ${status}`);
      loadTenants();
    } catch {
      notifyError('Update Failed', 'Failed to update tenant status');
    }
  };

  const handleDeleteTenant = async (id: string) => {
    try {
      await tenantAPI.deleteTenant(id);
      if (selectedTenant?.id === id) {
        setDetailsModalOpen(false);
        setSelectedTenant(null);
      }
      success('Success', 'Tenant deleted successfully');
      loadTenants();
    } catch {
      notifyError('Deletion Failed', 'Failed to delete tenant');
    }
  };

  const handleManageUsers = (tenant: Tenant) => {
    setSelectedTenant(tenant);
    setDetailsFocusSection('default');
    setDetailsModalOpen(true);
  };

  const handleConfigureDhis2 = (tenant: Tenant) => {
    setSelectedTenant(tenant);
    setDetailsFocusSection('dhis2');
    setDetailsModalOpen(true);
  };

  const toggleTenantSelect = (id: string) => {
    setSelectedTenantIds(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const handleBulkSuspend = async () => {
    if (!selectedTenantIds.size) return;
    setBulkLoading(true);
    try {
      await Promise.all([...selectedTenantIds].map(id => tenantAPI.updateTenantStatus(id, 'suspended')));
      setSelectedTenantIds(new Set());
      loadTenants();
      success('Bulk suspend', `${selectedTenantIds.size} tenants suspended`);
    } catch {
      notifyError('Bulk Error', 'Some tenants could not be suspended');
    } finally {
      setBulkLoading(false);
    }
  };

  const handleBulkExportCsv = () => {
    const selected = tenants.filter(t => selectedTenantIds.has(t.id));
    const rows = [
      ['Name', 'Subdomain', 'Status', 'Tier', 'Mode', 'Email', 'Created'].join(','),
      ...selected.map(t => [
        `"${t.clinicName}"`, t.subdomain, t.status, t.subscriptionTier,
        t.subscriptionMode, t.contactEmail, t.createdAt
      ].join(','))
    ];
    const blob = new Blob([rows.join('\n')], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'tenants.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#080E1A] flex items-center justify-center">
        <div className="text-center">
          <div className="relative mx-auto mb-4 h-14 w-14">
            <div className="absolute inset-0 animate-spin rounded-full border-2 border-transparent border-t-[#0AA98A]" />
            <div className="absolute inset-2 animate-spin rounded-full border-2 border-transparent border-t-[#3B9EFF]" style={{ animationDirection: 'reverse', animationDuration: '0.7s' }} />
          </div>
          <p className="text-sm font-medium text-[#7A9AB8]">Loading Umoya Control Plane...</p>
        </div>
      </div>
    );
  }

  const activeItem = NAV_ITEMS.find((n) => n.id === currentView);

  return (
    <div className="min-h-screen bg-[#080E1A] text-[#E8F0FF]">
      {/* Ambient orbs */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute top-[-8rem] left-1/2 -translate-x-1/2 h-[28rem] w-[28rem] rounded-full bg-[#0AA98A]/[0.05] blur-3xl" />
        <div className="absolute bottom-0 right-0 h-[20rem] w-[20rem] rounded-full bg-[#3B9EFF]/[0.05] blur-3xl" />
      </div>

      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* ── HEADER ── */}
      <header className="sticky top-0 z-30 border-b border-white/[0.06] bg-[#080E1A]/85 backdrop-blur-2xl">
        <div className="flex items-center justify-between px-4 py-3 sm:px-6 lg:px-8">
          <div className="flex items-center gap-4">
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="lg:hidden p-2 rounded-xl text-[#7A9AB8] hover:text-white hover:bg-white/[0.08] transition-colors"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
            <div className="flex items-center gap-3">
              <img src="/umoya-dark.png" alt="Umoya" className="h-8 w-auto" style={{ mixBlendMode: 'screen' }} />
              <div className="leading-none">
                <div className="text-[10px] font-bold uppercase tracking-[0.3em] text-[#4A6A8A]">Umoya</div>
                <div className="text-sm font-bold text-white">Control Plane</div>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="hidden sm:flex items-center gap-2.5 rounded-xl border border-white/[0.08] bg-white/[0.04] px-3 py-2">
              <div className="flex h-7 w-7 items-center justify-center rounded-full bg-[#0AA98A]/15 border border-[#0AA98A]/25">
                <span className="text-[10px] font-bold text-[#0AA98A]">SA</span>
              </div>
              <div>
                <p className="text-xs font-bold text-white leading-none">Super Admin</p>
                <p className="text-[10px] text-[#5A78A0] mt-0.5">admin@umoya.health</p>
              </div>
            </div>
            <div className="flex items-center gap-1.5 rounded-xl border border-[#0AA98A]/20 bg-[#0AA98A]/[0.07] px-2.5 py-1.5">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#0AA98A]" />
              <span className="text-[10px] font-bold text-[#0AA98A]">Live</span>
            </div>
            <button
              onClick={onLogout}
              className="p-2 rounded-xl text-[#7A9AB8] hover:text-white hover:bg-white/[0.08] transition-colors"
              title="Logout"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
            </button>
          </div>
        </div>
      </header>

      <div className="relative flex">
        {/* ── SIDEBAR ── */}
        <aside className={`fixed inset-y-0 left-0 z-50 w-60 bg-[#060C16]/98 border-r border-white/[0.06] transform transition-transform duration-300 ease-in-out lg:translate-x-0 lg:static lg:inset-0 ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
          <div className="flex flex-col h-full pt-[4.5rem] lg:pt-6">
            <div className="px-3 mb-4">
              <p className="px-3 text-[10px] font-bold uppercase tracking-[0.28em] text-[#3A5A7A]">Navigation</p>
            </div>
            <nav className="flex-1 px-3 space-y-0.5 overflow-y-auto">
              {NAV_ITEMS.map((item) => {
                const isActive = currentView === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => { setCurrentView(item.id); setSidebarOpen(false); }}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
                      isActive
                        ? 'bg-white/[0.07] text-white border-l-2'
                        : 'text-[#7A9AB8] hover:bg-white/[0.04] hover:text-white border-l-2 border-transparent'
                    }`}
                    style={isActive ? { borderLeftColor: item.accent } : undefined}
                  >
                    <span style={isActive ? { color: item.accent } : undefined}>{item.icon}</span>
                    <span>{item.label}</span>
                    {isActive && (
                      <span className="ml-auto h-1.5 w-1.5 rounded-full" style={{ background: item.accent }} />
                    )}
                  </button>
                );
              })}
            </nav>

            <div className="p-4 border-t border-white/[0.06]">
              <div className="rounded-2xl border border-[#0AA98A]/20 bg-[#0AA98A]/[0.06] p-3">
                <div className="flex items-center gap-2.5">
                  <span className="relative flex h-2.5 w-2.5 shrink-0">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#0AA98A] opacity-60" />
                    <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-[#0AA98A]" />
                  </span>
                  <div>
                    <p className="text-xs font-bold text-white">All systems operational</p>
                    <p className="text-[10px] text-[#4A7A5A] mt-0.5">{tenants.filter(t => t.status === 'active').length} active tenants</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </aside>

        {/* ── MAIN CONTENT ── */}
        <main className="flex-1 min-w-0 min-h-[calc(100vh-3.5rem)]">
          {/* Page header strip */}
          <div className="border-b border-white/[0.05] bg-[#080E1A]/50 px-4 py-4 sm:px-6 lg:px-8">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <span style={{ color: activeItem?.accent || '#0AA98A' }}>{activeItem?.icon}</span>
                <div>
                  <h1 className="text-base font-bold text-white">{activeItem?.label}</h1>
                  <p className="text-xs text-[#5A78A0]">Umoya platform administration</p>
                </div>
              </div>
              {currentView === 'tenants' && (
                <button
                  onClick={() => setCreateModalOpen(true)}
                  className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-[#0AA98A] to-[#00A87A] px-4 py-2 text-sm font-bold text-[#040A10] transition hover:from-[#00D9A3]"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  New Tenant
                </button>
              )}
            </div>
          </div>

          <div className="px-4 py-6 sm:px-6 lg:px-8">
            {error && (
              <div className="mb-4 flex items-center gap-3 rounded-2xl border border-red-500/20 bg-red-500/[0.08] px-4 py-3 text-sm text-red-300">
                <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                {error}
              </div>
            )}

            {currentView === 'overview' && <ErrorBoundary><SystemOverview tenants={tenants} /></ErrorBoundary>}
            {currentView === 'health' && <ErrorBoundary><HealthMonitor /></ErrorBoundary>}
            {currentView === 'audit' && <ErrorBoundary><AuditLogs /></ErrorBoundary>}
            {currentView === 'security' && <ErrorBoundary><SecurityPanel /></ErrorBoundary>}
            {currentView === 'backups' && <ErrorBoundary><BackupManager /></ErrorBoundary>}
            {currentView === 'terminology' && <ErrorBoundary><TerminologyImport /></ErrorBoundary>}
            {currentView === 'cdss' && <ErrorBoundary><CdssAdmin /></ErrorBoundary>}
            {currentView === 'requests' && <ErrorBoundary><DemoAccessRequestsPanel /></ErrorBoundary>}
            {currentView === 'db-drift' && <ErrorBoundary><DatabaseDriftPanel /></ErrorBoundary>}
            {currentView === 'rollout' && <ErrorBoundary><RolloutDashboard /></ErrorBoundary>}
            {currentView === 'baa-registry' && <ErrorBoundary><BaaRegistryPage /></ErrorBoundary>}
            {currentView === 'data-migration' && <ErrorBoundary><DataMigrationPanel tenants={tenants} /></ErrorBoundary>}

            {currentView === 'tenants' && (
              <div className="space-y-6">
                {/* Stats row */}
                <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                  {[
                    { label: 'Total Tenants', value: tenants.length, color: '#3B9EFF', icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" /></svg> },
                    { label: 'Active', value: tenants.filter(t => t.status === 'active').length, color: '#0AA98A', icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg> },
                    { label: 'Pending', value: tenants.filter(t => t.status === 'pending').length, color: '#E8614D', icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg> },
                    { label: 'Enterprise', value: tenants.filter(t => t.subscriptionTier === 'enterprise').length, color: '#A66CFF', icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg> },
                  ].map((stat) => (
                    <div key={stat.label} className="rounded-2xl border border-white/[0.07] bg-[#0A1525]/80 p-4">
                      <div className="flex items-center justify-between mb-3">
                        <span className="text-xs font-semibold text-[#7A9AB8]">{stat.label}</span>
                        <div className="flex h-8 w-8 items-center justify-center rounded-xl" style={{ background: `${stat.color}15`, border: `1px solid ${stat.color}30` }}>
                          <span style={{ color: stat.color }}>{stat.icon}</span>
                        </div>
                      </div>
                      <div className="text-2xl font-black text-white">{stat.value}</div>
                      <div className="mt-2 h-1 rounded-full bg-white/[0.07]">
                        <div className="h-full rounded-full transition-all" style={{ width: tenants.length ? `${(stat.value / tenants.length) * 100}%` : '0%', background: stat.color }} />
                      </div>
                    </div>
                  ))}
                </div>

                {/* Bulk action bar */}
                {selectedTenantIds.size > 0 && (
                  <div className="mb-4 flex items-center gap-3 rounded-2xl border border-[#3B9EFF]/20 bg-[#3B9EFF]/[0.06] px-4 py-3">
                    <span className="text-sm font-semibold text-[#3B9EFF]">{selectedTenantIds.size} selected</span>
                    <button onClick={() => setSelectedTenantIds(new Set())} className="text-xs text-[#5A78A0] hover:text-white transition">Clear</button>
                    <div className="ml-auto flex gap-2">
                      <button onClick={handleBulkExportCsv} className="px-3 py-1.5 text-xs font-semibold rounded-xl bg-white/[0.07] text-white hover:bg-white/[0.12] transition">
                        Export CSV
                      </button>
                      <button onClick={handleBulkSuspend} disabled={bulkLoading} className="px-3 py-1.5 text-xs font-semibold rounded-xl bg-red-500/20 text-red-300 hover:bg-red-500/30 transition disabled:opacity-50">
                        {bulkLoading ? 'Suspending…' : 'Suspend All'}
                      </button>
                    </div>
                  </div>
                )}

                {/* Tenants grid */}
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
                  {tenants.map((tenant) => (
                    <TenantCard
                      key={tenant.id}
                      tenant={tenant}
                      onStatusChange={handleStatusChange}
                      onDelete={handleDeleteTenant}
                      onManageUsers={handleManageUsers}
                      onConfigureDhis2={handleConfigureDhis2}
                      isSelected={selectedTenantIds.has(tenant.id)}
                      onSelect={toggleTenantSelect}
                    />
                  ))}
                </div>

                {tenants.length === 0 && (
                  <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-white/[0.1] bg-white/[0.02] py-16 text-center">
                    <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl border border-white/[0.1] bg-white/[0.04]">
                      <svg className="w-7 h-7 text-[#4A6A8A]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                      </svg>
                    </div>
                    <h3 className="text-base font-bold text-white mb-1">No tenants yet</h3>
                    <p className="text-sm text-[#5A78A0] mb-5">Create your first clinic tenant to get started.</p>
                    <button
                      onClick={() => setCreateModalOpen(true)}
                      className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-[#0AA98A] to-[#00A87A] px-5 py-2.5 text-sm font-bold text-[#040A10]"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                      </svg>
                      Create First Tenant
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </main>
      </div>

      <CreateTenantModal
        isOpen={createModalOpen}
        onClose={() => setCreateModalOpen(false)}
        onSubmit={handleCreateTenant}
        loading={createLoading}
      />

      <TenantDetailsModal
        tenant={selectedTenant}
        isOpen={detailsModalOpen}
        focusSection={detailsFocusSection}
        onClose={() => { setDetailsModalOpen(false); setSelectedTenant(null); setDetailsFocusSection('default'); }}
        onUpdate={loadTenants}
      />
    </div>
  );
};
