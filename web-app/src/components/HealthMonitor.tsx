import React, { useState, useEffect } from 'react';

interface HealthStatus {
  tenantId: string;
  tenantName: string;
  databaseStatus: 'healthy' | 'unhealthy' | 'unknown';
  connectionTime: number;
  lastChecked: Date;
  error?: string;
}

interface SystemHealth {
  totalTenants: number;
  healthy: number;
  unhealthy: number;
  unknown: number;
  lastCheck: number | null;
  averageConnectionTime: number;
}

export const HealthMonitor: React.FC = () => {
  const [systemHealth, setSystemHealth] = useState<SystemHealth | null>(null);
  const [tenantHealth, setTenantHealth] = useState<HealthStatus[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadHealthData();
    const interval = setInterval(loadHealthData, 30000); // Refresh every 30 seconds
    return () => clearInterval(interval);
  }, []);

  const loadHealthData = async () => {
    try {
      // Real API integration would go here
      const mockSystemHealth: SystemHealth = {
        totalTenants: 0,
        healthy: 0,
        unhealthy: 0,
        unknown: 0,
        lastCheck: Date.now(),
        averageConnectionTime: 0
      };

      const mockTenantHealth: HealthStatus[] = [];

      setSystemHealth(mockSystemHealth);
      setTenantHealth(mockTenantHealth);
    } catch (error) {
      console.error('Failed to load health data:', error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'healthy': return 'text-emerald-700 bg-emerald-50 border border-emerald-200';
      case 'unhealthy': return 'text-red-700 bg-red-50 border border-red-200';
      case 'unknown': return 'text-slate-600 bg-slate-50 border border-slate-200';
      default: return 'text-slate-600 bg-slate-50 border border-slate-200';
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-slate-800"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-bold text-slate-800">System Health</h2>
        <div className="text-sm text-slate-500 flex items-center">
          <span className="w-2 h-2 bg-emerald-500 rounded-full mr-2 animate-pulse"></span>
          Live Monitoring
        </div>
      </div>

      {/* System Health Overview */}
      {systemHealth && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-white p-6 rounded-lg border border-slate-200 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-slate-500">Total Tenants</p>
                <p className="text-2xl font-bold text-slate-900 mt-1">{systemHealth.totalTenants}</p>
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
                <p className="text-sm font-medium text-slate-500">Healthy</p>
                <p className="text-2xl font-bold text-slate-900 mt-1">{systemHealth.healthy}</p>
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
                <p className="text-sm font-medium text-slate-500">Issues</p>
                <p className="text-2xl font-bold text-slate-900 mt-1">{systemHealth.unhealthy}</p>
              </div>
              <div className="p-3 bg-red-50 rounded-md">
                <svg className="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
            </div>
          </div>

          <div className="bg-white p-6 rounded-lg border border-slate-200 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-slate-500">Avg Response</p>
                <p className="text-2xl font-bold text-slate-900 mt-1">{systemHealth.averageConnectionTime}ms</p>
              </div>
              <div className="p-3 bg-indigo-50 rounded-md">
                <svg className="w-6 h-6 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tenant Health Details */}
      <div className="bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 bg-slate-50">
          <h3 className="text-sm font-semibold text-slate-900 uppercase tracking-wider">Tenant Health Status</h3>
        </div>
        
        {tenantHealth.length > 0 ? (
          <div className="divide-y divide-slate-200">
            {tenantHealth.map((tenant) => (
              <div key={tenant.tenantId} className="p-6 hover:bg-slate-50 transition-colors">
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <h4 className="text-sm font-bold text-slate-900">{tenant.tenantName}</h4>
                    <div className="flex items-center mt-1 space-x-4">
                      <span className="text-xs text-slate-500 flex items-center">
                        <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        Checked: {tenant.lastChecked.toLocaleTimeString()}
                      </span>
                      {tenant.error && (
                        <span className="text-xs text-red-600 flex items-center">
                          <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                          </svg>
                          {tenant.error}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center space-x-6">
                    <div className="text-right">
                      <p className="text-xs text-slate-500 mb-1">Latency</p>
                      <p className="text-sm font-medium text-slate-900">{tenant.connectionTime}ms</p>
                    </div>
                    <div>
                      <span className={`px-3 py-1 rounded-full text-xs font-semibold ${getStatusColor(tenant.databaseStatus)}`}>
                        {tenant.databaseStatus.toUpperCase()}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="p-12 text-center">
            <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4 border border-slate-200">
              <svg className="w-8 h-8 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h3 className="text-sm font-medium text-slate-900">No health data available</h3>
            <p className="text-sm text-slate-500 mt-1">System monitoring is active but no tenant data has been collected yet.</p>
          </div>
        )}
      </div>
    </div>
  );
};
