import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Activity, Bed, Users, TrendingUp, BarChart3, RefreshCw,
  Filter, Search, ArrowLeft, Menu, X, LogOut, Settings,
  User, AlertCircle, CheckCircle, Clock, Building
} from 'lucide-react';
import { ehrApi } from '../services/api';
import { useNotification } from '../components/GlobalNotification';
import BedManagementBoard from '../components/BedManagementBoard';
import AdmissionWorkflow from '../components/AdmissionWorkflow';

interface BedOccupancyStats {
  total_beds: number;
  occupied: number;
  available: number;
  cleaning: number;
  maintenance: number;
  occupancy_rate: number;
}

interface Ward {
  ward_name: string;
  total_beds: number;
  occupied: number;
  available: number;
}

const BedManagementDashboard: React.FC = () => {
  const { tenantSlug } = useParams<{ tenantSlug: string }>();
  const navigate = useNavigate();
  const { showError, showSuccess } = useNotification();
  
  const [user, setUser] = useState<any>(null);
  const [occupancyStats, setOccupancyStats] = useState<BedOccupancyStats | null>(null);
  const [wards, setWards] = useState<Ward[]>([]);
  const [selectedWard, setSelectedWard] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [showAdmissionWorkflow, setShowAdmissionWorkflow] = useState(false);

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
      fetchOccupancyStats();
    }
  }, [user, selectedWard, refreshKey]);

  const fetchOccupancyStats = async () => {
    try {
      const token = localStorage.getItem('ehr_token');
      if (!token || !tenantSlug) return;

      const response = await ehrApi.getBedOccupancy(selectedWard, token, tenantSlug);
      setOccupancyStats(response.data);
    } catch (error) {
      console.error('Failed to fetch occupancy stats:', error);
    }
  };

  const handleRefresh = () => {
    setRefreshKey(prev => prev + 1);
    fetchOccupancyStats();
    showSuccess('Refreshed', 'Bed data updated');
  };

  const handleLogout = () => {
    localStorage.removeItem('ehr_token');
    localStorage.removeItem('ehr_user');
    localStorage.removeItem('ehr_tenant');
    navigate(`/ehr/${tenantSlug}`);
  };

  if (!user) return null;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-cyan-50">
      {/* Mobile Sidebar Overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 bg-black/50 z-40 lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      {/* Sidebar */}
      <div className={`fixed left-0 top-0 h-full w-64 bg-gradient-to-b from-blue-900 via-blue-950 to-gray-900 border-r border-blue-800/50 z-50 transform transition-transform lg:translate-x-0 ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="p-6">
          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-gradient-to-r from-blue-500 to-cyan-600 rounded-xl shadow-lg">
                <Activity className="w-6 h-6 text-white" />
              </div>
              <div>
                <h2 className="font-bold text-white">Bed Management</h2>
                <p className="text-xs text-blue-200">ADT Operations</p>
              </div>
            </div>
            <button onClick={() => setSidebarOpen(false)} className="lg:hidden">
              <X className="w-5 h-5 text-slate-300" />
            </button>
          </div>

          {/* User Profile */}
          <div className="bg-gradient-to-r from-blue-600/20 to-cyan-600/20 backdrop-blur-sm border border-blue-500/30 rounded-xl p-4 mb-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-r from-blue-500 to-cyan-600 rounded-full flex items-center justify-center">
                <User className="w-5 h-5 text-white" />
              </div>
              <div>
                <h3 className="font-semibold text-white">{user.firstName} {user.lastName}</h3>
                <p className="text-sm text-blue-200 capitalize">{user.role}</p>
              </div>
            </div>
          </div>

          {/* Navigation */}
          <nav className="space-y-2">
            <button
              onClick={() => navigate(`/ehr/${tenantSlug}/${user.role === 'doctor' ? 'doctor' : user.role === 'nurse' ? 'nurse' : 'dashboard'}`)}
              className="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-slate-300 hover:bg-blue-800/30 hover:text-white transition-all"
            >
              <ArrowLeft className="w-5 h-5" />
              <span>Back to Dashboard</span>
            </button>
            
            <button
              onClick={() => navigate(`/ehr/${tenantSlug}/emergency`)}
              className="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-slate-300 hover:bg-blue-800/30 hover:text-white transition-all"
            >
              <AlertCircle className="w-5 h-5" />
              <span>Emergency Dept</span>
            </button>

            <button
              onClick={handleRefresh}
              className="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-slate-300 hover:bg-blue-800/30 hover:text-white transition-all"
            >
              <RefreshCw className="w-5 h-5" />
              <span>Refresh Data</span>
            </button>

            <button
              onClick={() => setShowAdmissionWorkflow(true)}
              className="w-full flex items-center gap-3 px-4 py-3 rounded-lg bg-gradient-to-r from-blue-600 to-cyan-600 text-white hover:from-blue-700 hover:to-cyan-700 transition-all shadow-lg"
            >
              <Users className="w-5 h-5" />
              <span>Admit Patient</span>
            </button>
          </nav>

          {/* Bottom Actions */}
          <div className="absolute bottom-6 left-6 right-6 space-y-2">
            <button
              onClick={() => navigate(`/ehr/${tenantSlug}/profile`)}
              className="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-slate-300 hover:bg-blue-800/30 hover:text-white transition-all"
            >
              <Settings className="w-5 h-5" />
              <span>Settings</span>
            </button>
            <button
              onClick={handleLogout}
              className="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-blue-400 hover:bg-blue-800/30 hover:text-blue-300 transition-all"
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
                  <h1 className="text-2xl sm:text-3xl font-bold bg-gradient-to-r from-blue-600 to-cyan-600 bg-clip-text text-transparent">
                    Bed Management & ADT
                  </h1>
                  <p className="text-sm text-slate-600">Hospital-wide bed status & patient flow</p>
                </div>
              </div>
              
              <div className="flex items-center gap-3">
                <button
                  onClick={handleRefresh}
                  className="p-2 hover:bg-blue-50 rounded-lg transition-colors"
                  title="Refresh data"
                >
                  <RefreshCw className="w-5 h-5 text-blue-600" />
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Occupancy Stats */}
        <div className="px-4 sm:px-6 lg:px-8 py-6">
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-4 mb-6">
            {/* Total Beds */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4">
              <div className="flex items-center justify-between mb-2">
                <Activity className="w-5 h-5 text-blue-600" />
                <span className="text-2xl font-bold text-slate-900">{occupancyStats?.total_beds || 46}</span>
              </div>
              <p className="text-xs text-slate-600 font-medium">Total Beds</p>
            </div>

            {/* Occupied */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4">
              <div className="flex items-center justify-between mb-2">
                <Users className="w-5 h-5 text-red-600" />
                <span className="text-2xl font-bold text-slate-900">{occupancyStats?.occupied || 0}</span>
              </div>
              <p className="text-xs text-slate-600 font-medium">Occupied</p>
            </div>

            {/* Available */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4">
              <div className="flex items-center justify-between mb-2">
                <CheckCircle className="w-5 h-5 text-green-600" />
                <span className="text-2xl font-bold text-slate-900">{occupancyStats?.available || 46}</span>
              </div>
              <p className="text-xs text-slate-600 font-medium">Available</p>
            </div>

            {/* Cleaning */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4">
              <div className="flex items-center justify-between mb-2">
                <Clock className="w-5 h-5 text-yellow-600" />
                <span className="text-2xl font-bold text-slate-900">{occupancyStats?.cleaning || 0}</span>
              </div>
              <p className="text-xs text-slate-600 font-medium">Cleaning</p>
            </div>

            {/* Occupancy Rate */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4">
              <div className="flex items-center justify-between mb-2">
                <TrendingUp className="w-5 h-5 text-purple-600" />
                <span className="text-2xl font-bold text-slate-900">
                  {occupancyStats?.occupancy_rate ? `${Math.round(occupancyStats.occupancy_rate)}%` : '0%'}
                </span>
              </div>
              <p className="text-xs text-slate-600 font-medium">Occupancy</p>
            </div>
          </div>

          {/* Ward Filter */}
          <div className="mb-6 flex flex-wrap items-center gap-3">
            <button
              onClick={() => setSelectedWard(null)}
              className={`px-4 py-2 rounded-lg font-medium transition-all ${
                selectedWard === null
                  ? 'bg-gradient-to-r from-blue-600 to-cyan-600 text-white shadow-lg'
                  : 'bg-white text-slate-700 border border-slate-200 hover:border-blue-300'
              }`}
            >
              All Wards
            </button>
            <button
              onClick={() => setSelectedWard('Intensive Care Unit')}
              className={`px-4 py-2 rounded-lg font-medium transition-all ${
                selectedWard === 'Intensive Care Unit'
                  ? 'bg-gradient-to-r from-red-600 to-pink-600 text-white shadow-lg'
                  : 'bg-white text-slate-700 border border-slate-200 hover:border-red-300'
              }`}
            >
              ICU (10)
            </button>
            <button
              onClick={() => setSelectedWard('Medical Ward')}
              className={`px-4 py-2 rounded-lg font-medium transition-all ${
                selectedWard === 'Medical Ward'
                  ? 'bg-gradient-to-r from-green-600 to-emerald-600 text-white shadow-lg'
                  : 'bg-white text-slate-700 border border-slate-200 hover:border-green-300'
              }`}
            >
              Medical (15)
            </button>
            <button
              onClick={() => setSelectedWard('Surgical Ward')}
              className={`px-4 py-2 rounded-lg font-medium transition-all ${
                selectedWard === 'Surgical Ward'
                  ? 'bg-gradient-to-r from-purple-600 to-violet-600 text-white shadow-lg'
                  : 'bg-white text-slate-700 border border-slate-200 hover:border-purple-300'
              }`}
            >
              Surgical (15)
            </button>
            <button
              onClick={() => setSelectedWard('Pediatrics')}
              className={`px-4 py-2 rounded-lg font-medium transition-all ${
                selectedWard === 'Pediatrics'
                  ? 'bg-gradient-to-r from-yellow-600 to-orange-600 text-white shadow-lg'
                  : 'bg-white text-slate-700 border border-slate-200 hover:border-yellow-300'
              }`}
            >
              Pediatrics (3)
            </button>
            <button
              onClick={() => setSelectedWard('Maternity')}
              className={`px-4 py-2 rounded-lg font-medium transition-all ${
                selectedWard === 'Maternity'
                  ? 'bg-gradient-to-r from-pink-600 to-rose-600 text-white shadow-lg'
                  : 'bg-white text-slate-700 border border-slate-200 hover:border-pink-300'
              }`}
            >
              Maternity (3)
            </button>
          </div>

          {/* Bed Status Board */}
          <div className="bg-white rounded-2xl shadow-lg border border-slate-200 overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-200 bg-gradient-to-r from-blue-50 to-cyan-50">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-gradient-to-r from-blue-600 to-cyan-600 rounded-xl">
                    <Activity className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <h2 className="text-lg font-bold text-slate-900">
                      {selectedWard || 'All Wards'} - Bed Status
                    </h2>
                    <p className="text-sm text-slate-600">Real-time bed availability</p>
                  </div>
                </div>
                <button
                  onClick={() => setShowAdmissionWorkflow(true)}
                  className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-blue-600 to-cyan-600 text-white rounded-lg hover:from-blue-700 hover:to-cyan-700 transition-colors shadow-lg"
                >
                  <Users className="w-4 h-4" />
                  <span className="hidden sm:inline">Admit Patient</span>
                </button>
              </div>
            </div>

            <div className="p-6">
              <BedManagementBoard
                tenantSlug={tenantSlug || ''}
                selectedWard={selectedWard}
                refreshTrigger={refreshKey}
              />
            </div>
          </div>

          {/* Status Legend */}
          <div className="mt-6 bg-white rounded-xl shadow-sm border border-slate-200 p-6">
            <h3 className="text-sm font-bold text-slate-900 mb-4">Bed Status Legend</h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
              <div className="flex items-center gap-2 p-2 rounded-lg bg-green-50 border border-green-200">
                <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                <span className="text-xs font-medium text-green-900">Available</span>
              </div>

              <div className="flex items-center gap-2 p-2 rounded-lg bg-blue-50 border border-blue-200">
                <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
                <span className="text-xs font-medium text-blue-900">Occupied</span>
              </div>

              <div className="flex items-center gap-2 p-2 rounded-lg bg-purple-50 border border-purple-200">
                <div className="w-3 h-3 bg-purple-500 rounded-full"></div>
                <span className="text-xs font-medium text-purple-900">Reserved</span>
              </div>

              <div className="flex items-center gap-2 p-2 rounded-lg bg-yellow-50 border border-yellow-200">
                <div className="w-3 h-3 bg-yellow-500 rounded-full"></div>
                <span className="text-xs font-medium text-yellow-900">Cleaning</span>
              </div>

              <div className="flex items-center gap-2 p-2 rounded-lg bg-orange-50 border border-orange-200">
                <div className="w-3 h-3 bg-orange-500 rounded-full"></div>
                <span className="text-xs font-medium text-orange-900">Maintenance</span>
              </div>

              <div className="flex items-center gap-2 p-2 rounded-lg bg-gray-50 border border-gray-200">
                <div className="w-3 h-3 bg-gray-500 rounded-full"></div>
                <span className="text-xs font-medium text-gray-900">Blocked</span>
              </div>

              <div className="flex items-center gap-2 p-2 rounded-lg bg-red-50 border border-red-200">
                <div className="w-3 h-3 bg-red-500 rounded-full"></div>
                <span className="text-xs font-medium text-red-900">Out of Service</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Admission Workflow Modal */}
      {showAdmissionWorkflow && (
        <AdmissionWorkflow
          tenantSlug={tenantSlug || ''}
          onClose={() => {
            setShowAdmissionWorkflow(false);
            handleRefresh();
          }}
        />
      )}
    </div>
  );
};

export default BedManagementDashboard;

