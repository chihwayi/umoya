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
      // Mock data for now - replace with actual API calls
      const mockSystemHealth: SystemHealth = {
        totalTenants: 4,
        healthy: 3,
        unhealthy: 1,
        unknown: 0,
        lastCheck: Date.now(),
        averageConnectionTime: 45
      };

      const mockTenantHealth: HealthStatus[] = [
        {
          tenantId: '1',
          tenantName: 'Bulawayo General Clinic',
          databaseStatus: 'healthy',
          connectionTime: 32,
          lastChecked: new Date()
        },
        {
          tenantId: '2',
          tenantName: 'Harare Medical Center',
          databaseStatus: 'healthy',
          connectionTime: 28,
          lastChecked: new Date()
        },
        {
          tenantId: '3',
          tenantName: 'City Health',
          databaseStatus: 'unhealthy',
          connectionTime: 150,
          lastChecked: new Date(),
          error: 'Connection timeout'
        },
        {
          tenantId: '4',
          tenantName: 'Dr. Mukamuri Clinic',
          databaseStatus: 'healthy',
          connectionTime: 41,
          lastChecked: new Date()
        }
      ];

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
      case 'healthy': return 'text-green-600 bg-green-100';
      case 'unhealthy': return 'text-red-600 bg-red-100';
      case 'unknown': return 'text-gray-600 bg-gray-100';
      default: return 'text-gray-600 bg-gray-100';
    }
  };

  if (loading) {
    return <div className="p-4">Loading health data...</div>;
  }

  return (
    <div className="space-y-6">
      {/* System Health Overview */}
      {systemHealth && (
        <div className="bg-white p-6 rounded-lg shadow">
          <h3 className="text-lg font-semibold mb-4">System Health Overview</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600">{systemHealth.totalTenants}</div>
              <div className="text-sm text-gray-600">Total Tenants</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600">{systemHealth.healthy}</div>
              <div className="text-sm text-gray-600">Healthy</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-red-600">{systemHealth.unhealthy}</div>
              <div className="text-sm text-gray-600">Unhealthy</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600">{systemHealth.averageConnectionTime}ms</div>
              <div className="text-sm text-gray-600">Avg Response</div>
            </div>
          </div>
        </div>
      )}

      {/* Tenant Health Details */}
      <div className="bg-white p-6 rounded-lg shadow">
        <h3 className="text-lg font-semibold mb-4">Tenant Health Status</h3>
        <div className="space-y-3">
          {tenantHealth.map((tenant) => (
            <div key={tenant.tenantId} className="flex items-center justify-between p-3 border rounded-lg">
              <div className="flex-1">
                <div className="font-medium">{tenant.tenantName}</div>
                <div className="text-sm text-gray-600">
                  Last checked: {tenant.lastChecked.toLocaleTimeString()}
                </div>
                {tenant.error && (
                  <div className="text-sm text-red-600">Error: {tenant.error}</div>
                )}
              </div>
              <div className="flex items-center space-x-3">
                <div className="text-sm text-gray-600">{tenant.connectionTime}ms</div>
                <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(tenant.databaseStatus)}`}>
                  {tenant.databaseStatus}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};