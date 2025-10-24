import React, { useState, useEffect } from 'react';

interface AuditLog {
  id: string;
  user: {
    firstName: string;
    lastName: string;
    email: string;
  };
  action: string;
  resource: string;
  resourceId?: string;
  ipAddress?: string;
  createdAt: Date;
}

export const AuditLogs: React.FC = () => {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  useEffect(() => {
    loadAuditLogs();
  }, [page]);

  const loadAuditLogs = async () => {
    try {
      // Mock data for now - replace with actual API calls
      const mockLogs: AuditLog[] = [
        {
          id: '1',
          user: { firstName: 'Super', lastName: 'Admin', email: 'admin@medicore.co.zw' },
          action: 'login',
          resource: 'auth',
          ipAddress: '192.168.1.100',
          createdAt: new Date(Date.now() - 5 * 60 * 1000)
        },
        {
          id: '2',
          user: { firstName: 'Super', lastName: 'Admin', email: 'admin@medicore.co.zw' },
          action: 'user_create',
          resource: 'tenant_users',
          resourceId: 'bulawayo-general',
          ipAddress: '192.168.1.100',
          createdAt: new Date(Date.now() - 15 * 60 * 1000)
        },
        {
          id: '3',
          user: { firstName: 'Super', lastName: 'Admin', email: 'admin@medicore.co.zw' },
          action: 'tenant_activate',
          resource: 'tenants',
          resourceId: 'harare-medical',
          ipAddress: '192.168.1.100',
          createdAt: new Date(Date.now() - 30 * 60 * 1000)
        },
        {
          id: '4',
          user: { firstName: 'Super', lastName: 'Admin', email: 'admin@medicore.co.zw' },
          action: 'create',
          resource: 'tenants',
          resourceId: 'city-health',
          ipAddress: '192.168.1.100',
          createdAt: new Date(Date.now() - 60 * 60 * 1000)
        }
      ];

      setLogs(mockLogs);
      setTotalPages(3);
    } catch (error) {
      console.error('Failed to load audit logs:', error);
    } finally {
      setLoading(false);
    }
  };

  const getActionColor = (action: string) => {
    switch (action) {
      case 'login': return 'text-blue-600 bg-blue-100';
      case 'create': return 'text-green-600 bg-green-100';
      case 'update': return 'text-yellow-600 bg-yellow-100';
      case 'delete': return 'text-red-600 bg-red-100';
      case 'tenant_activate': return 'text-green-600 bg-green-100';
      case 'tenant_suspend': return 'text-red-600 bg-red-100';
      case 'user_create': return 'text-blue-600 bg-blue-100';
      default: return 'text-gray-600 bg-gray-100';
    }
  };

  const formatAction = (action: string) => {
    return action.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
  };

  if (loading) {
    return <div className="p-4">Loading audit logs...</div>;
  }

  return (
    <div className="bg-white p-6 rounded-lg shadow">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-semibold">Audit Logs</h3>
        <div className="text-sm text-gray-600">
          Page {page} of {totalPages}
        </div>
      </div>

      <div className="space-y-3">
        {logs.map((log) => (
          <div key={log.id} className="flex items-center justify-between p-3 border rounded-lg">
            <div className="flex-1">
              <div className="flex items-center space-x-2">
                <span className={`px-2 py-1 rounded-full text-xs font-medium ${getActionColor(log.action)}`}>
                  {formatAction(log.action)}
                </span>
                <span className="font-medium">{log.resource}</span>
                {log.resourceId && (
                  <span className="text-sm text-gray-600">({log.resourceId})</span>
                )}
              </div>
              <div className="text-sm text-gray-600 mt-1">
                by {log.user.firstName} {log.user.lastName} ({log.user.email})
                {log.ipAddress && ` from ${log.ipAddress}`}
              </div>
            </div>
            <div className="text-sm text-gray-500">
              {log.createdAt.toLocaleString()}
            </div>
          </div>
        ))}
      </div>

      {/* Pagination */}
      <div className="flex justify-center space-x-2 mt-4">
        <button
          onClick={() => setPage(Math.max(1, page - 1))}
          disabled={page === 1}
          className="px-3 py-1 border rounded disabled:opacity-50"
        >
          Previous
        </button>
        <span className="px-3 py-1">
          {page} / {totalPages}
        </span>
        <button
          onClick={() => setPage(Math.min(totalPages, page + 1))}
          disabled={page === totalPages}
          className="px-3 py-1 border rounded disabled:opacity-50"
        >
          Next
        </button>
      </div>
    </div>
  );
};