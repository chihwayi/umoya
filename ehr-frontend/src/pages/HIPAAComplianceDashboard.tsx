import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Shield, Eye, AlertTriangle, FileText, Download, Filter, Search,
  TrendingUp, Users, Activity, Clock, CheckCircle, XCircle, AlertCircle,
  BarChart3, Calendar, ArrowLeft, RefreshCw, Lock, Database, Server
} from 'lucide-react';
import { ehrApi } from '../services/api';
import { useNotification } from '../components/GlobalNotification';

const HIPAAComplianceDashboard: React.FC = () => {
  const { tenantSlug } = useParams<{ tenantSlug: string }>();
  const navigate = useNavigate();
  const { showError, showSuccess } = useNotification();
  const token = localStorage.getItem('ehr_token') || '';

  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'overview' | 'logs' | 'breaches' | 'reports' | 'users' | 'sessions'>('overview');

  // Overview Stats
  const [stats, setStats] = useState({
    totalAccesses: 0,
    todayAccesses: 0,
    highRiskActions: 0,
    potentialBreaches: 0,
    uniqueUsers: 0,
    uniquePatients: 0,
    failedLogins: 0,
    activeSessions: 0,
    dataExports: 0,
    policyViolations: 0,
  });

  // Audit Logs
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [logsLoading, setLogsLoading] = useState(false);
  const [logsTotal, setLogsTotal] = useState(0);
  const [logsPage, setLogsPage] = useState(1);
  const [logsLimit] = useState(50);

  // Filters
  const [filters, setFilters] = useState({
    userId: '',
    patientId: '',
    action: '',
    resourceType: '',
    outcome: '' as 'success' | 'failure' | 'denied' | '',
    riskLevel: '' as 'low' | 'medium' | 'high' | 'critical' | '',
    startDate: '',
    endDate: '',
  });

  // Breaches
  const [breaches, setBreaches] = useState<any[]>([]);
  const [breachesLoading, setBreachesLoading] = useState(false);

  // Summary
  const [summary, setSummary] = useState<any>(null);
  const [summaryLoading, setSummaryLoading] = useState(false);

  // User Access Analysis
  const [userAccessAnalysis, setUserAccessAnalysis] = useState<any[]>([]);
  const [userAccessLoading, setUserAccessLoading] = useState(false);

  // Active Sessions
  const [activeSessions, setActiveSessions] = useState<any[]>([]);
  const [sessionsLoading, setSessionsLoading] = useState(false);

  useEffect(() => {
    if (activeTab === 'overview') {
      loadOverviewStats();
      loadSummary();
    } else if (activeTab === 'logs') {
      loadAuditLogs();
    } else if (activeTab === 'breaches') {
      loadBreaches();
    } else if (activeTab === 'users') {
      loadUserAccessAnalysis();
    } else if (activeTab === 'sessions') {
      loadActiveSessions();
    }
  }, [activeTab, filters, logsPage]);

  const loadUserAccessAnalysis = async () => {
    try {
      setUserAccessLoading(true);
      


      const endDate = new Date();
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - 30);

      const response = await ehrApi.getAuditSummary(
        token,
        tenantSlug || '',
        startDate.toISOString(),
        endDate.toISOString()
      );
      
      if (response.data?.byUser) {
        setUserAccessAnalysis(response.data.byUser);
      }
    } catch (error: any) {
      console.error('Failed to load user access analysis:', error);
    } finally {
      setUserAccessLoading(false);
    }
  };

  const loadActiveSessions = async () => {
    try {
      setSessionsLoading(true);
      
      // Check if method exists (frontend cache issue)
      if (!ehrApi.getAuditLogs || typeof ehrApi.getAuditLogs !== 'function') {
        console.warn('getAuditLogs method not available - frontend may need rebuild');
        setSessionsLoading(false);
        return;
      }

      // Get recent logs with session IDs
      const response = await ehrApi.getAuditLogs(token, tenantSlug || '', {
        limit: 1000,
        startDate: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(), // Last 24 hours
      });

      // Group by session ID
      const sessionMap = new Map();
      (response.data.logs || []).forEach((log: any) => {
        if (log.sessionId) {
          if (!sessionMap.has(log.sessionId)) {
            sessionMap.set(log.sessionId, {
              sessionId: log.sessionId,
              userId: log.userId,
              userName: log.userName,
              userRole: log.userRole,
              ipAddress: log.ipAddress,
              firstAccess: log.createdAt,
              lastAccess: log.createdAt,
              accessCount: 0,
              riskLevel: log.riskLevel || 'low',
            });
          }
          const session = sessionMap.get(log.sessionId);
          session.accessCount++;
          if (new Date(log.createdAt) > new Date(session.lastAccess)) {
            session.lastAccess = log.createdAt;
          }
          if (['high', 'critical'].includes(log.riskLevel)) {
            session.riskLevel = log.riskLevel;
          }
        }
      });

      setActiveSessions(Array.from(sessionMap.values()));
    } catch (error: any) {
      console.error('Failed to load active sessions:', error);
    } finally {
      setSessionsLoading(false);
    }
  };

  const loadOverviewStats = async () => {
    try {
      setLoading(true);
      


      const endDate = new Date();
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - 30); // Last 30 days

      const [logsRes, summaryRes] = await Promise.all([
        ehrApi.getAuditLogs(token, tenantSlug || '', {
          startDate: startDate.toISOString(),
          endDate: endDate.toISOString(),
          limit: 1000,
        }),
        ehrApi.getAuditSummary(token, tenantSlug || '', startDate.toISOString(), endDate.toISOString()),
      ]);

      const logs = logsRes.data.logs || [];
      const today = new Date().toDateString();
      const todayLogs = logs.filter((log: any) => new Date(log.createdAt).toDateString() === today);
      const failedLogins = logs.filter((log: any) => log.action === 'login_failed' || log.outcome === 'failure').length;
      const dataExports = logs.filter((log: any) => log.action === 'data_export' || log.action === 'export_data').length;
      const policyViolations = logs.filter((log: any) => log.outcome === 'denied' || log.riskLevel === 'critical').length;

      setStats({
        totalAccesses: logsRes.data.total || 0,
        todayAccesses: todayLogs.length,
        highRiskActions: logs.filter((log: any) => ['high', 'critical'].includes(log.riskLevel)).length,
        potentialBreaches: 0, // Will be loaded separately
        uniqueUsers: new Set(logs.map((log: any) => log.userId)).size,
        uniquePatients: new Set(logs.map((log: any) => log.patientId).filter(Boolean)).size,
        failedLogins,
        activeSessions: new Set(logs.filter((log: any) => log.sessionId).map((log: any) => log.sessionId)).size,
        dataExports,
        policyViolations,
      });

      // Load breaches count
      try {
        if (ehrApi.detectBreaches && typeof ehrApi.detectBreaches === 'function') {
          const breachesRes = await ehrApi.detectBreaches(token, tenantSlug || '', 30);
          setStats(prev => ({ ...prev, potentialBreaches: breachesRes.data?.breaches?.length || breachesRes.data?.length || 0 }));
        }
      } catch (err) {
        console.error('Failed to load breaches:', err);
      }
    } catch (error: any) {
      console.error('Failed to load overview stats:', error);
      showError('Error', 'Failed to load compliance statistics');
    } finally {
      setLoading(false);
    }
  };

  const loadSummary = async () => {
    try {
      setSummaryLoading(true);
      


      const endDate = new Date();
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - 30);

      const response = await ehrApi.getAuditSummary(
        token,
        tenantSlug || '',
        startDate.toISOString(),
        endDate.toISOString()
      );
      setSummary(response.data);
    } catch (error: any) {
      console.error('Failed to load summary:', error);
    } finally {
      setSummaryLoading(false);
    }
  };

  const loadAuditLogs = async () => {
    try {
      setLogsLoading(true);
      


      const params: any = {
        limit: logsLimit,
        offset: (logsPage - 1) * logsLimit,
      };

      if (filters.userId) params.userId = filters.userId;
      if (filters.patientId) params.patientId = filters.patientId;
      if (filters.action) params.action = filters.action;
      if (filters.resourceType) params.resourceType = filters.resourceType;
      if (filters.outcome) params.outcome = filters.outcome;
      if (filters.riskLevel) params.riskLevel = filters.riskLevel;
      if (filters.startDate) params.startDate = new Date(filters.startDate).toISOString();
      if (filters.endDate) params.endDate = new Date(filters.endDate).toISOString();

      const response = await ehrApi.getAuditLogs(token, tenantSlug || '', params);
      setAuditLogs(response.data.logs || []);
      setLogsTotal(response.data.total || 0);
    } catch (error: any) {
      console.error('Failed to load audit logs:', error);
      showError('Error', 'Failed to load audit logs');
    } finally {
      setLogsLoading(false);
    }
  };

  const loadBreaches = async () => {
    try {
      setBreachesLoading(true);
      


      const response = await ehrApi.detectBreaches(token, tenantSlug || '', 30);
      setBreaches(response.data?.breaches || response.data || []);
    } catch (error: any) {
      console.error('Failed to load breaches:', error);
      showError('Error', 'Failed to load breach detection results');
    } finally {
      setBreachesLoading(false);
    }
  };

  const exportLogs = async () => {
    try {


      const params: any = { limit: 10000 };
      if (filters.startDate) params.startDate = new Date(filters.startDate).toISOString();
      if (filters.endDate) params.endDate = new Date(filters.endDate).toISOString();

      const response = await ehrApi.getAuditLogs(token, tenantSlug || '', params);
      const logs = response.data.logs || [];

      // Convert to CSV
      const headers = ['Timestamp', 'User', 'Role', 'Action', 'Resource Type', 'Patient ID', 'Outcome', 'Risk Level', 'IP Address'];
      const rows = logs.map((log: any) => [
        new Date(log.createdAt).toISOString(),
        log.userName || 'Unknown',
        log.userRole || 'Unknown',
        log.action,
        log.resourceType,
        log.patientId || 'N/A',
        log.outcome,
        log.riskLevel || 'low',
        log.ipAddress || 'N/A',
      ]);

      const csv = [headers, ...rows].map(row => row.join(',')).join('\n');
      const blob = new Blob([csv], { type: 'text/csv' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `hipaa-audit-logs-${new Date().toISOString().split('T')[0]}.csv`;
      a.click();
      window.URL.revokeObjectURL(url);

      showSuccess('Export Complete', 'Audit logs exported successfully');
    } catch (error: any) {
      showError('Export Failed', 'Failed to export audit logs');
    }
  };

  const getRiskColor = (riskLevel: string) => {
    switch (riskLevel) {
      case 'critical': return 'bg-red-100 text-red-800 border-red-300';
      case 'high': return 'bg-orange-100 text-orange-800 border-orange-300';
      case 'medium': return 'bg-yellow-100 text-yellow-800 border-yellow-300';
      default: return 'bg-green-100 text-green-800 border-green-300';
    }
  };

  const getOutcomeIcon = (outcome: string) => {
    switch (outcome) {
      case 'success': return <CheckCircle className="w-4 h-4 text-green-600" />;
      case 'failure': return <XCircle className="w-4 h-4 text-red-600" />;
      case 'denied': return <AlertCircle className="w-4 h-4 text-orange-600" />;
      default: return <Clock className="w-4 h-4 text-gray-600" />;
    }
  };

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <div className="bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 text-white shadow-lg">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button
                onClick={() => navigate(`/ehr/${tenantSlug}/dashboard`)}
                className="p-2 hover:bg-white/10 rounded-lg transition-colors"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
              <div>
                <h1 className="text-3xl font-bold flex items-center gap-3">
                  <Shield className="w-8 h-8" />
                  HIPAA Compliance Dashboard
                </h1>
                <p className="text-indigo-100 mt-1">Audit logs, breach detection & compliance reporting</p>
              </div>
            </div>
            <button
              onClick={exportLogs}
              className="flex items-center gap-2 px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-xl transition-all shadow-lg hover:shadow-xl font-semibold text-sm"
            >
              <Download className="w-4 h-4" />
              Export Logs
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-8 pb-8">
        {/* Tabs */}
        <div className="flex border-b border-slate-200 mb-6 overflow-x-auto">
          <button
            onClick={() => setActiveTab('overview')}
            className={`py-3 px-6 text-sm font-medium whitespace-nowrap ${
              activeTab === 'overview'
                ? 'border-b-2 border-indigo-600 text-indigo-700'
                : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            Overview
          </button>
          <button
            onClick={() => setActiveTab('logs')}
            className={`py-3 px-6 text-sm font-medium whitespace-nowrap ${
              activeTab === 'logs'
                ? 'border-b-2 border-indigo-600 text-indigo-700'
                : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            Audit Logs
          </button>
          <button
            onClick={() => setActiveTab('breaches')}
            className={`py-3 px-6 text-sm font-medium whitespace-nowrap ${
              activeTab === 'breaches'
                ? 'border-b-2 border-indigo-600 text-indigo-700'
                : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            Breach Detection
            {stats.potentialBreaches > 0 && (
              <span className="ml-2 px-2 py-0.5 bg-red-100 text-red-800 rounded-full text-xs font-bold">
                {stats.potentialBreaches}
              </span>
            )}
          </button>
          <button
            onClick={() => setActiveTab('users')}
            className={`py-3 px-6 text-sm font-medium whitespace-nowrap ${
              activeTab === 'users'
                ? 'border-b-2 border-indigo-600 text-indigo-700'
                : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            User Access Analysis
          </button>
          <button
            onClick={() => setActiveTab('sessions')}
            className={`py-3 px-6 text-sm font-medium whitespace-nowrap ${
              activeTab === 'sessions'
                ? 'border-b-2 border-indigo-600 text-indigo-700'
                : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            Active Sessions
            {stats.activeSessions > 0 && (
              <span className="ml-2 px-2 py-0.5 bg-blue-100 text-blue-800 rounded-full text-xs font-bold">
                {stats.activeSessions}
              </span>
            )}
          </button>
          <button
            onClick={() => setActiveTab('reports')}
            className={`py-3 px-6 text-sm font-medium whitespace-nowrap ${
              activeTab === 'reports'
                ? 'border-b-2 border-indigo-600 text-indigo-700'
                : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            Compliance Reports
          </button>
        </div>

        {/* Overview Tab */}
        {activeTab === 'overview' && (
          <div className="space-y-6">
            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-slate-600 text-sm">Total PHI Accesses</p>
                    <p className="text-3xl font-bold text-slate-900 mt-2">{stats.totalAccesses.toLocaleString()}</p>
                    <p className="text-xs text-slate-500 mt-1">Last 30 days</p>
                  </div>
                  <Eye className="w-12 h-12 text-indigo-600" />
                </div>
              </div>

              <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-slate-600 text-sm">Today's Accesses</p>
                    <p className="text-3xl font-bold text-slate-900 mt-2">{stats.todayAccesses.toLocaleString()}</p>
                    <p className="text-xs text-slate-500 mt-1">Since midnight</p>
                  </div>
                  <Activity className="w-12 h-12 text-blue-600" />
                </div>
              </div>

              <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-slate-600 text-sm">High-Risk Actions</p>
                    <p className="text-3xl font-bold text-slate-900 mt-2">{stats.highRiskActions.toLocaleString()}</p>
                    <p className="text-xs text-slate-500 mt-1">Last 30 days</p>
                  </div>
                  <AlertTriangle className="w-12 h-12 text-orange-600" />
                </div>
              </div>

              <div className="bg-white rounded-xl shadow-sm border border-red-200 p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-slate-600 text-sm">Potential Breaches</p>
                    <p className="text-3xl font-bold text-red-600 mt-2">{stats.potentialBreaches}</p>
                    <p className="text-xs text-slate-500 mt-1">Requires review</p>
                  </div>
                  <Shield className="w-12 h-12 text-red-600" />
                </div>
              </div>

              <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-slate-600 text-sm">Active Users</p>
                    <p className="text-3xl font-bold text-slate-900 mt-2">{stats.uniqueUsers}</p>
                    <p className="text-xs text-slate-500 mt-1">Accessed PHI</p>
                  </div>
                  <Users className="w-12 h-12 text-green-600" />
                </div>
              </div>

              <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-slate-600 text-sm">Patients Accessed</p>
                    <p className="text-3xl font-bold text-slate-900 mt-2">{stats.uniquePatients}</p>
                    <p className="text-xs text-slate-500 mt-1">Unique patients</p>
                  </div>
                  <FileText className="w-12 h-12 text-purple-600" />
                </div>
              </div>

              <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-slate-600 text-sm">Failed Logins</p>
                    <p className="text-3xl font-bold text-slate-900 mt-2">{stats.failedLogins}</p>
                    <p className="text-xs text-slate-500 mt-1">Last 30 days</p>
                  </div>
                  <Lock className="w-12 h-12 text-red-600" />
                </div>
              </div>

              <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-slate-600 text-sm">Data Exports</p>
                    <p className="text-3xl font-bold text-slate-900 mt-2">{stats.dataExports}</p>
                    <p className="text-xs text-slate-500 mt-1">Last 30 days</p>
                  </div>
                  <Download className="w-12 h-12 text-orange-600" />
                </div>
              </div>

              <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-slate-600 text-sm">Active Sessions</p>
                    <p className="text-3xl font-bold text-slate-900 mt-2">{stats.activeSessions}</p>
                    <p className="text-xs text-slate-500 mt-1">Current</p>
                  </div>
                  <Activity className="w-12 h-12 text-blue-600" />
                </div>
              </div>

              <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-slate-600 text-sm">Policy Violations</p>
                    <p className="text-3xl font-bold text-red-600 mt-2">{stats.policyViolations}</p>
                    <p className="text-xs text-slate-500 mt-1">Last 30 days</p>
                  </div>
                  <AlertCircle className="w-12 h-12 text-red-600" />
                </div>
              </div>
            </div>

            {/* Summary Charts */}
            {summary && (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
                  <h3 className="text-lg font-bold text-slate-900 mb-4">Access by User</h3>
                  <div className="space-y-3">
                    {summary.byUser?.slice(0, 10).map((user: any, idx: number) => (
                      <div key={idx} className="flex items-center justify-between">
                        <span className="text-slate-700">{user.userName || 'Unknown'}</span>
                        <span className="font-semibold text-slate-900">{user.count}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
                  <h3 className="text-lg font-bold text-slate-900 mb-4">Access by Action Type</h3>
                  <div className="space-y-3">
                    {summary.byAction?.slice(0, 10).map((action: any, idx: number) => (
                      <div key={idx} className="flex items-center justify-between">
                        <span className="text-slate-700">{action.action}</span>
                        <span className="font-semibold text-slate-900">{action.count}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Recent High-Risk Activities */}
            {summary && summary.recentAccess && summary.recentAccess.length > 0 && (
              <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
                <h3 className="text-lg font-bold text-slate-900 mb-4">Recent High-Risk Activities</h3>
                <div className="space-y-2">
                  {summary.recentAccess
                    .filter((log: any) => ['high', 'critical'].includes(log.riskLevel))
                    .slice(0, 10)
                    .map((log: any, idx: number) => (
                      <div key={idx} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                        <div className="flex items-center gap-3">
                          {getOutcomeIcon(log.outcome)}
                          <div>
                            <p className="text-sm font-medium text-slate-900">{log.action}</p>
                            <p className="text-xs text-slate-500">
                              {log.userName} • {new Date(log.createdAt).toLocaleString()}
                            </p>
                          </div>
                        </div>
                        <span className={`px-2 py-1 rounded text-xs font-semibold border ${getRiskColor(log.riskLevel)}`}>
                          {log.riskLevel}
                        </span>
                      </div>
                    ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Audit Logs Tab */}
        {activeTab === 'logs' && (
          <div className="space-y-6">
            {/* Filters */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold text-slate-900">Filters</h3>
                <button
                  onClick={() => {
                    setFilters({
                      userId: '',
                      patientId: '',
                      action: '',
                      resourceType: '',
                      outcome: '',
                      riskLevel: '',
                      startDate: '',
                      endDate: '',
                    });
                    setLogsPage(1);
                  }}
                  className="text-sm text-slate-600 hover:text-slate-900"
                >
                  Clear All
                </button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <input
                  type="date"
                  value={filters.startDate}
                  onChange={(e) => setFilters({ ...filters, startDate: e.target.value })}
                  className="px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                  placeholder="Start Date"
                />
                <input
                  type="date"
                  value={filters.endDate}
                  onChange={(e) => setFilters({ ...filters, endDate: e.target.value })}
                  className="px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                  placeholder="End Date"
                />
                <select
                  value={filters.riskLevel}
                  onChange={(e) => setFilters({ ...filters, riskLevel: e.target.value as any })}
                  className="px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="">All Risk Levels</option>
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                  <option value="critical">Critical</option>
                </select>
                <select
                  value={filters.outcome}
                  onChange={(e) => setFilters({ ...filters, outcome: e.target.value as any })}
                  className="px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="">All Outcomes</option>
                  <option value="success">Success</option>
                  <option value="failure">Failure</option>
                  <option value="denied">Denied</option>
                </select>
              </div>
            </div>

            {/* Logs Table */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-slate-50 border-b border-slate-200">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-slate-700 uppercase">Timestamp</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-slate-700 uppercase">User</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-slate-700 uppercase">Action</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-slate-700 uppercase">Resource</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-slate-700 uppercase">Patient</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-slate-700 uppercase">Outcome</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-slate-700 uppercase">Risk</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {logsLoading ? (
                      <tr>
                        <td colSpan={7} className="px-4 py-8 text-center text-slate-500">
                          <Activity className="w-6 h-6 animate-spin mx-auto mb-2" />
                          Loading audit logs...
                        </td>
                      </tr>
                    ) : auditLogs.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="px-4 py-8 text-center text-slate-500">
                          No audit logs found
                        </td>
                      </tr>
                    ) : (
                      auditLogs.map((log, idx) => (
                        <tr key={idx} className="hover:bg-slate-50">
                          <td className="px-4 py-3 text-sm text-slate-600">
                            {new Date(log.createdAt).toLocaleString()}
                          </td>
                          <td className="px-4 py-3 text-sm text-slate-900">
                            {log.userName || 'Unknown'}
                            {log.userRole && (
                              <span className="text-xs text-slate-500 ml-1">({log.userRole})</span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-sm text-slate-900">{log.action}</td>
                          <td className="px-4 py-3 text-sm text-slate-600">{log.resourceType}</td>
                          <td className="px-4 py-3 text-sm text-slate-600">
                            {log.patientId ? log.patientId.substring(0, 8) + '...' : 'N/A'}
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              {getOutcomeIcon(log.outcome)}
                              <span className="text-sm text-slate-700 capitalize">{log.outcome}</span>
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <span className={`px-2 py-1 rounded text-xs font-semibold border ${getRiskColor(log.riskLevel || 'low')}`}>
                              {log.riskLevel || 'low'}
                            </span>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
              {/* Pagination */}
              {logsTotal > logsLimit && (
                <div className="px-4 py-3 border-t border-slate-200 flex items-center justify-between">
                  <span className="text-sm text-slate-600">
                    Showing {(logsPage - 1) * logsLimit + 1} to {Math.min(logsPage * logsLimit, logsTotal)} of {logsTotal}
                  </span>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setLogsPage(p => Math.max(1, p - 1))}
                      disabled={logsPage === 1}
                      className="px-3 py-1 border border-slate-300 rounded text-sm disabled:opacity-50"
                    >
                      Previous
                    </button>
                    <button
                      onClick={() => setLogsPage(p => p + 1)}
                      disabled={logsPage * logsLimit >= logsTotal}
                      className="px-3 py-1 border border-slate-300 rounded text-sm disabled:opacity-50"
                    >
                      Next
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Breaches Tab */}
        {activeTab === 'breaches' && (
          <div className="space-y-6">
            {breachesLoading ? (
              <div className="text-center py-12">
                <Activity className="w-12 h-12 animate-spin mx-auto mb-4 text-indigo-600" />
                <p className="text-slate-600">Loading breach detection results...</p>
              </div>
            ) : breaches.length === 0 ? (
              <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-12 text-center">
                <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
                <h3 className="text-xl font-bold text-slate-900 mb-2">No Breaches Detected</h3>
                <p className="text-slate-600">No potential HIPAA breaches found in the last 30 days.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {breaches.map((breach, idx) => (
                  <div key={idx} className="bg-white rounded-xl shadow-sm border border-red-200 p-6">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <AlertTriangle className="w-5 h-5 text-red-600" />
                          <h3 className="font-bold text-slate-900">{breach.type}</h3>
                          <span className="px-2 py-1 bg-red-100 text-red-800 rounded text-xs font-semibold">
                            {breach.severity}
                          </span>
                        </div>
                        <p className="text-slate-600 mb-2">{breach.description}</p>
                        <div className="text-sm text-slate-500">
                          <p>Detected: {new Date(breach.detectedAt).toLocaleString()}</p>
                          {breach.userId && <p>User: {breach.userName || breach.userId}</p>}
                          {breach.patientId && <p>Patient: {breach.patientId.substring(0, 8)}...</p>}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* User Access Analysis Tab */}
        {activeTab === 'users' && (
          <div className="space-y-6">
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
              <h3 className="text-lg font-bold text-slate-900 mb-4">User Access Analysis</h3>
              {userAccessLoading ? (
                <div className="text-center py-12">
                  <Activity className="w-12 h-12 animate-spin mx-auto mb-4 text-indigo-600" />
                  <p className="text-slate-600">Loading user access data...</p>
                </div>
              ) : userAccessAnalysis.length === 0 ? (
                <div className="text-center py-12 text-slate-500">
                  <Users className="w-16 h-16 mx-auto mb-4 text-slate-400" />
                  <p>No user access data available</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-slate-50 border-b border-slate-200">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-slate-700 uppercase">User</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-slate-700 uppercase">Role</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-slate-700 uppercase">Access Count</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-slate-700 uppercase">Risk Level</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                      {userAccessAnalysis.map((user: any, idx: number) => (
                        <tr key={idx} className="hover:bg-slate-50">
                          <td className="px-4 py-3 text-sm text-slate-900">{user.user_name || 'Unknown'}</td>
                          <td className="px-4 py-3 text-sm text-slate-600 capitalize">{user.user_role || 'N/A'}</td>
                          <td className="px-4 py-3 text-sm text-slate-900 font-semibold">{user.access_count || 0}</td>
                          <td className="px-4 py-3">
                            <span className={`px-2 py-1 rounded text-xs font-semibold border ${
                              user.access_count > 1000 ? getRiskColor('high') :
                              user.access_count > 500 ? getRiskColor('medium') :
                              getRiskColor('low')
                            }`}>
                              {user.access_count > 1000 ? 'High' : user.access_count > 500 ? 'Medium' : 'Low'}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Active Sessions Tab */}
        {activeTab === 'sessions' && (
          <div className="space-y-6">
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
              <h3 className="text-lg font-bold text-slate-900 mb-4">Active Sessions (Last 24 Hours)</h3>
              {sessionsLoading ? (
                <div className="text-center py-12">
                  <Activity className="w-12 h-12 animate-spin mx-auto mb-4 text-indigo-600" />
                  <p className="text-slate-600">Loading session data...</p>
                </div>
              ) : activeSessions.length === 0 ? (
                <div className="text-center py-12 text-slate-500">
                  <Clock className="w-16 h-16 mx-auto mb-4 text-slate-400" />
                  <p>No active sessions found</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-slate-50 border-b border-slate-200">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-slate-700 uppercase">User</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-slate-700 uppercase">Role</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-slate-700 uppercase">IP Address</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-slate-700 uppercase">First Access</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-slate-700 uppercase">Last Access</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-slate-700 uppercase">Access Count</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-slate-700 uppercase">Risk</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                      {activeSessions.map((session: any, idx: number) => (
                        <tr key={idx} className="hover:bg-slate-50">
                          <td className="px-4 py-3 text-sm text-slate-900">{session.userName || 'Unknown'}</td>
                          <td className="px-4 py-3 text-sm text-slate-600 capitalize">{session.userRole || 'N/A'}</td>
                          <td className="px-4 py-3 text-sm text-slate-600 font-mono">{session.ipAddress || 'N/A'}</td>
                          <td className="px-4 py-3 text-sm text-slate-600">{new Date(session.firstAccess).toLocaleString()}</td>
                          <td className="px-4 py-3 text-sm text-slate-600">{new Date(session.lastAccess).toLocaleString()}</td>
                          <td className="px-4 py-3 text-sm text-slate-900 font-semibold">{session.accessCount}</td>
                          <td className="px-4 py-3">
                            <span className={`px-2 py-1 rounded text-xs font-semibold border ${getRiskColor(session.riskLevel)}`}>
                              {session.riskLevel}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Reports Tab */}
        {activeTab === 'reports' && (
          <div className="space-y-6">
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
              <h3 className="text-lg font-bold text-slate-900 mb-4">Compliance Reports</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <button
                  onClick={exportLogs}
                  className="flex items-center gap-3 p-4 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors text-left"
                >
                  <Download className="w-5 h-5 text-indigo-600" />
                  <div>
                    <p className="font-semibold text-slate-900">Export Audit Logs</p>
                    <p className="text-sm text-slate-600">Download CSV of all audit logs</p>
                  </div>
                </button>
                <div className="flex items-center gap-3 p-4 border border-slate-200 rounded-lg bg-slate-50 text-left">
                  <FileText className="w-5 h-5 text-slate-400" />
                  <div>
                    <p className="font-semibold text-slate-500">Compliance Report</p>
                    <p className="text-sm text-slate-400">Coming soon</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 p-4 border border-slate-200 rounded-lg bg-slate-50 text-left">
                  <BarChart3 className="w-5 h-5 text-slate-400" />
                  <div>
                    <p className="font-semibold text-slate-500">Monthly Summary</p>
                    <p className="text-sm text-slate-400">Coming soon</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 p-4 border border-slate-200 rounded-lg bg-slate-50 text-left">
                  <Shield className="w-5 h-5 text-slate-400" />
                  <div>
                    <p className="font-semibold text-slate-500">HIPAA Audit Report</p>
                    <p className="text-sm text-slate-400">Coming soon</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default HIPAAComplianceDashboard;

