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
      // Real API integration would go here
      const mockLogs: AuditLog[] = [];

      setLogs(mockLogs);
      setTotalPages(0);
    } catch (error) {
      console.error('Failed to load audit logs:', error);
    } finally {
      setLoading(false);
    }
  };

  const getActionColor = (action: string) => {
    switch (action) {
      case 'login': return 'text-blue-700 bg-blue-50 border border-blue-200';
      case 'create': return 'text-emerald-700 bg-emerald-50 border border-emerald-200';
      case 'update': return 'text-amber-700 bg-amber-50 border border-amber-200';
      case 'delete': return 'text-red-700 bg-red-50 border border-red-200';
      case 'tenant_activate': return 'text-emerald-700 bg-emerald-50 border border-emerald-200';
      case 'tenant_suspend': return 'text-red-700 bg-red-50 border border-red-200';
      case 'user_create': return 'text-blue-700 bg-blue-50 border border-blue-200';
      default: return 'text-slate-600 bg-slate-50 border border-slate-200';
    }
  };

  const formatAction = (action: string) => {
    return action.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
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
        <h2 className="text-xl font-bold text-slate-800">Audit Logs</h2>
        <div className="flex space-x-2">
          <button className="px-3 py-1.5 text-sm font-medium text-slate-600 bg-white border border-slate-300 rounded-md hover:bg-slate-50">
            Export CSV
          </button>
          <button className="px-3 py-1.5 text-sm font-medium text-slate-600 bg-white border border-slate-300 rounded-md hover:bg-slate-50">
            Filter
          </button>
        </div>
      </div>

      <div className="bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden">
        <div className="flex justify-between items-center px-6 py-4 border-b border-slate-200 bg-slate-50">
          <h3 className="text-sm font-semibold text-slate-900 uppercase tracking-wider">System Activity</h3>
          <div className="text-xs text-slate-500">
            Page {page} of {totalPages || 1}
          </div>
        </div>

        {logs.length > 0 ? (
          <div className="divide-y divide-slate-200">
            {logs.map((log) => (
              <div key={log.id} className="p-6 hover:bg-slate-50 transition-colors">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center space-x-3 mb-2">
                      <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium border ${getActionColor(log.action)}`}>
                        {formatAction(log.action)}
                      </span>
                      <span className="font-medium text-slate-900">{log.resource}</span>
                      {log.resourceId && (
                        <span className="text-xs font-mono text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded">
                          {log.resourceId}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center text-sm text-slate-600">
                      <span className="font-medium text-slate-800 mr-1">
                        {log.user.firstName} {log.user.lastName}
                      </span>
                      <span className="text-slate-400 mx-1">•</span>
                      <span>{log.user.email}</span>
                      {log.ipAddress && (
                        <>
                          <span className="text-slate-400 mx-1">•</span>
                          <span className="font-mono text-xs">{log.ipAddress}</span>
                        </>
                      )}
                    </div>
                  </div>
                  <div className="text-sm text-slate-500 whitespace-nowrap ml-6">
                    {log.createdAt.toLocaleString()}
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="p-16 text-center">
            <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4 border border-slate-200">
              <svg className="w-8 h-8 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <h3 className="text-sm font-medium text-slate-900">No audit logs found</h3>
            <p className="text-sm text-slate-500 mt-1">Activity will appear here once actions are performed in the system.</p>
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="px-6 py-4 border-t border-slate-200 bg-slate-50 flex justify-center space-x-2">
            <button
              onClick={() => setPage(Math.max(1, page - 1))}
              disabled={page === 1}
              className="px-3 py-1 text-sm border border-slate-300 rounded-md bg-white text-slate-600 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Previous
            </button>
            <span className="px-3 py-1 text-sm font-medium text-slate-600 flex items-center">
              {page} / {totalPages}
            </span>
            <button
              onClick={() => setPage(Math.min(totalPages, page + 1))}
              disabled={page === totalPages}
              className="px-3 py-1 text-sm border border-slate-300 rounded-md bg-white text-slate-600 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Next
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
