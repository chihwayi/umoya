import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  AlertCircle, AlertTriangle, Activity, Clock, User, Users,
  Stethoscope, Heart, ArrowLeft, RefreshCw, Filter, Search,
  TrendingUp, BarChart3, Bell, Menu, X, LogOut, Settings,
  UserCircle, ChevronDown, Plus, Eye
} from 'lucide-react';
import { ehrApi } from '../services/api';
import { useNotification } from '../components/GlobalNotification';
import EDTrackingBoard from '../components/EDTrackingBoard';

interface EDMetrics {
  current_census: number;
  average_wait_time_minutes: number | null;
  average_length_of_stay_minutes: number | null;
  lwbs_count: number;
  lwbs_rate: number;
  admission_rate: number;
  total_visits_today: number;
}

const EDDashboard: React.FC = () => {
  const { tenantSlug } = useParams<{ tenantSlug: string }>();
  const navigate = useNavigate();
  const { showError, showSuccess } = useNotification();
  
  const [user, setUser] = useState<any>(null);
  const [metrics, setMetrics] = useState<EDMetrics | null>(null);
  const [loading, setLoading] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    const userData = localStorage.getItem('ehr_user');
    if (userData) {
      setUser(JSON.parse(userData));
    } else {
      navigate(`/ehr/${tenantSlug}`);
    }
  }, [navigate, tenantSlug]);

  useEffect(() => {
    if (user) {
      fetchMetrics();
    }
  }, [user, refreshKey]);

  const fetchMetrics = async () => {
    try {
      const token = localStorage.getItem('ehr_token');
      if (!token || !tenantSlug) return;

      const response = await ehrApi.getEDMetrics(token, tenantSlug);
      setMetrics(response.data);
    } catch (error) {
      console.error('Failed to fetch ED metrics:', error);
    }
  };

  const handleRefresh = () => {
    setRefreshKey(prev => prev + 1);
    fetchMetrics();
    showSuccess('Refreshed', 'ED data updated');
  };

  const handleLogout = () => {
    localStorage.removeItem('ehr_token');
    localStorage.removeItem('ehr_user');
    localStorage.removeItem('ehr_tenant');
    navigate(`/ehr/${tenantSlug}`);
  };

  if (!user) return null;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-red-50 to-orange-50">
      {/* Mobile Sidebar Overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 bg-black/50 z-40 lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      {/* Sidebar */}
      <div className={`fixed left-0 top-0 h-full w-64 bg-gradient-to-b from-red-900 via-red-950 to-gray-900 border-r border-red-800/50 z-50 transform transition-transform lg:translate-x-0 ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="p-6">
          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-gradient-to-r from-red-500 to-orange-600 rounded-xl shadow-lg">
                <AlertCircle className="w-6 h-6 text-white" />
              </div>
              <div>
                <h2 className="font-bold text-white">Emergency Dept</h2>
                <p className="text-xs text-red-200">ED Operations</p>
              </div>
            </div>
            <button onClick={() => setSidebarOpen(false)} className="lg:hidden">
              <X className="w-5 h-5 text-slate-300" />
            </button>
          </div>

          {/* User Profile */}
          <div className="bg-gradient-to-r from-red-600/20 to-orange-600/20 backdrop-blur-sm border border-red-500/30 rounded-xl p-4 mb-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-r from-red-500 to-orange-600 rounded-full flex items-center justify-center">
                <User className="w-5 h-5 text-white" />
              </div>
              <div>
                <h3 className="font-semibold text-white">{user.firstName} {user.lastName}</h3>
                <p className="text-sm text-red-200 capitalize">{user.role}</p>
              </div>
            </div>
          </div>

          {/* Navigation */}
          <nav className="space-y-2">
            <button
              onClick={() => navigate(`/ehr/${tenantSlug}/${user.role === 'doctor' ? 'doctor' : user.role === 'nurse' ? 'nurse' : 'dashboard'}`)}
              className="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-slate-300 hover:bg-red-800/30 hover:text-white transition-all"
            >
              <ArrowLeft className="w-5 h-5" />
              <span>Back to Dashboard</span>
            </button>
            
            <button
              onClick={() => navigate(`/ehr/${tenantSlug}/bed-management`)}
              className="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-slate-300 hover:bg-red-800/30 hover:text-white transition-all"
            >
              <Activity className="w-5 h-5" />
              <span>Bed Management</span>
            </button>

            <button
              onClick={handleRefresh}
              className="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-slate-300 hover:bg-red-800/30 hover:text-white transition-all"
            >
              <RefreshCw className="w-5 h-5" />
              <span>Refresh Data</span>
            </button>
          </nav>

          {/* Bottom Actions */}
          <div className="absolute bottom-6 left-6 right-6 space-y-2">
            <button
              onClick={() => navigate(`/ehr/${tenantSlug}/profile`)}
              className="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-slate-300 hover:bg-red-800/30 hover:text-white transition-all"
            >
              <Settings className="w-5 h-5" />
              <span>Settings</span>
            </button>
            <button
              onClick={handleLogout}
              className="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-red-400 hover:bg-red-800/30 hover:text-red-300 transition-all"
            >
              <LogOut className="w-5 h-5" />
              <span>Logout</span>
            </button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="lg:ml-64">
        {/* Header */}
        <div className="bg-white/80 backdrop-blur-sm border-b border-slate-200/50 sticky top-0 z-30">
          <div className="px-4 sm:px-6 lg:px-8 py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <button
                  onClick={() => setSidebarOpen(true)}
                  className="lg:hidden p-2 hover:bg-slate-100 rounded-lg"
                >
                  <Menu className="w-6 h-6 text-slate-600" />
                </button>
                <div>
                  <h1 className="text-2xl sm:text-3xl font-bold bg-gradient-to-r from-red-600 to-orange-600 bg-clip-text text-transparent">
                    Emergency Department
                  </h1>
                  <p className="text-sm text-slate-600">Real-time ED Operations & Tracking</p>
                </div>
              </div>
              
              <div className="flex items-center gap-3">
                <button
                  onClick={handleRefresh}
                  className="p-2 hover:bg-red-50 rounded-lg transition-colors"
                  title="Refresh data"
                >
                  <RefreshCw className="w-5 h-5 text-red-600" />
                </button>
                <div className="relative">
                  <Bell className="w-6 h-6 text-slate-600" />
                  {metrics && metrics.current_census > 0 && (
                    <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-xs rounded-full flex items-center justify-center">
                      {metrics.current_census}
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ED Metrics Cards */}
        <div className="px-4 sm:px-6 lg:px-8 py-6">
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4 mb-6">
            {/* Current Census */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4">
              <div className="flex items-center justify-between mb-2">
                <Users className="w-5 h-5 text-red-600" />
                <span className="text-2xl font-bold text-slate-900">{metrics?.current_census || 0}</span>
              </div>
              <p className="text-xs text-slate-600 font-medium">Current Census</p>
            </div>

            {/* Avg Wait Time */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4">
              <div className="flex items-center justify-between mb-2">
                <Clock className="w-5 h-5 text-orange-600" />
                <span className="text-2xl font-bold text-slate-900">
                  {metrics?.average_wait_time_minutes ? Math.round(metrics.average_wait_time_minutes) : '-'}
                </span>
              </div>
              <p className="text-xs text-slate-600 font-medium">Avg Wait (min)</p>
            </div>

            {/* Avg LOS */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4">
              <div className="flex items-center justify-between mb-2">
                <Activity className="w-5 h-5 text-blue-600" />
                <span className="text-2xl font-bold text-slate-900">
                  {metrics?.average_length_of_stay_minutes ? Math.round(metrics.average_length_of_stay_minutes) : '-'}
                </span>
              </div>
              <p className="text-xs text-slate-600 font-medium">Avg LOS (min)</p>
            </div>

            {/* LWBS Count */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4">
              <div className="flex items-center justify-between mb-2">
                <AlertTriangle className="w-5 h-5 text-yellow-600" />
                <span className="text-2xl font-bold text-slate-900">{metrics?.lwbs_count || 0}</span>
              </div>
              <p className="text-xs text-slate-600 font-medium">LWBS Today</p>
            </div>

            {/* Admission Rate */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4">
              <div className="flex items-center justify-between mb-2">
                <TrendingUp className="w-5 h-5 text-green-600" />
                <span className="text-2xl font-bold text-slate-900">
                  {metrics?.admission_rate ? `${Math.round(metrics.admission_rate)}%` : '-'}
                </span>
              </div>
              <p className="text-xs text-slate-600 font-medium">Admission Rate</p>
            </div>

            {/* Total Visits */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4">
              <div className="flex items-center justify-between mb-2">
                <BarChart3 className="w-5 h-5 text-purple-600" />
                <span className="text-2xl font-bold text-slate-900">{metrics?.total_visits_today || 0}</span>
              </div>
              <p className="text-xs text-slate-600 font-medium">Visits Today</p>
            </div>
          </div>

          {/* ED Tracking Board */}
          <div className="bg-white rounded-2xl shadow-lg border border-slate-200 overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-200 bg-gradient-to-r from-red-50 to-orange-50">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-gradient-to-r from-red-600 to-orange-600 rounded-xl">
                    <AlertCircle className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <h2 className="text-lg font-bold text-slate-900">ED Tracking Board</h2>
                    <p className="text-sm text-slate-600">Real-time patient status</p>
                  </div>
                </div>
                <button
                  onClick={handleRefresh}
                  className="flex items-center gap-2 px-4 py-2 bg-white border border-red-200 text-red-700 rounded-lg hover:bg-red-50 transition-colors"
                >
                  <RefreshCw className="w-4 h-4" />
                  <span className="hidden sm:inline">Refresh</span>
                </button>
              </div>
            </div>

            <div className="p-6">
              <EDTrackingBoard
                tenantSlug={tenantSlug || ''}
                refreshTrigger={refreshKey}
              />
            </div>
          </div>

          {/* ESI Level Legend */}
          <div className="mt-6 bg-white rounded-xl shadow-sm border border-slate-200 p-6">
            <h3 className="text-sm font-bold text-slate-900 mb-4">ESI Triage Levels</h3>
            <div className="grid grid-cols-1 sm:grid-cols-5 gap-3">
              <div className="flex items-center gap-3 p-3 rounded-lg bg-red-50 border border-red-200">
                <div className="w-8 h-8 bg-red-600 rounded-full flex items-center justify-center text-white font-bold text-sm">
                  1
                </div>
                <div>
                  <p className="text-xs font-bold text-red-900">Critical</p>
                  <p className="text-xs text-red-700">Life-threatening</p>
                </div>
              </div>

              <div className="flex items-center gap-3 p-3 rounded-lg bg-orange-50 border border-orange-200">
                <div className="w-8 h-8 bg-orange-600 rounded-full flex items-center justify-center text-white font-bold text-sm">
                  2
                </div>
                <div>
                  <p className="text-xs font-bold text-orange-900">Emergent</p>
                  <p className="text-xs text-orange-700">High risk</p>
                </div>
              </div>

              <div className="flex items-center gap-3 p-3 rounded-lg bg-yellow-50 border border-yellow-200">
                <div className="w-8 h-8 bg-yellow-600 rounded-full flex items-center justify-center text-white font-bold text-sm">
                  3
                </div>
                <div>
                  <p className="text-xs font-bold text-yellow-900">Urgent</p>
                  <p className="text-xs text-yellow-700">Stable</p>
                </div>
              </div>

              <div className="flex items-center gap-3 p-3 rounded-lg bg-green-50 border border-green-200">
                <div className="w-8 h-8 bg-green-600 rounded-full flex items-center justify-center text-white font-bold text-sm">
                  4
                </div>
                <div>
                  <p className="text-xs font-bold text-green-900">Less Urgent</p>
                  <p className="text-xs text-green-700">Minor</p>
                </div>
              </div>

              <div className="flex items-center gap-3 p-3 rounded-lg bg-blue-50 border border-blue-200">
                <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center text-white font-bold text-sm">
                  5
                </div>
                <div>
                  <p className="text-xs font-bold text-blue-900">Non-Urgent</p>
                  <p className="text-xs text-blue-700">Routine</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default EDDashboard;

