import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  AlertCircle, AlertTriangle, Activity, Clock, User, Users,
  Heart, ArrowLeft, RefreshCw, TrendingUp, BarChart3, Ambulance, X
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
  const [refreshKey, setRefreshKey] = useState(0);
  const [showRegisterModal, setShowRegisterModal] = useState(false);

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

  if (!user) return null;

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <div className="bg-gradient-to-r from-red-600 to-orange-700 text-white shadow-lg">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button
                onClick={() => navigate(`/ehr/${tenantSlug}/${user.role === 'doctor' ? 'doctor' : user.role === 'nurse' ? 'nurse' : 'dashboard'}`)}
                className="p-2 hover:bg-white/10 rounded-lg transition-colors"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
              <div>
                <h1 className="text-3xl font-bold flex items-center gap-3">
                  <AlertCircle className="w-8 h-8" />
                  Emergency Department
                </h1>
                <p className="text-red-100 mt-1">Real-time ED tracking, triage, and patient flow management</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowRegisterModal(true)}
                className="px-4 py-2 bg-white/10 hover:bg-white/20 rounded-lg transition-colors text-sm font-medium flex items-center gap-2"
              >
                <User className="w-4 h-4" />
                Register Patient
              </button>
              <button
                onClick={handleRefresh}
                className="p-2 bg-white/10 hover:bg-white/20 rounded-lg transition-colors"
              >
                <RefreshCw className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Statistics Cards */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 -mt-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <div className="bg-white rounded-xl shadow-lg p-4 border-l-4 border-blue-500">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-600">Current Census</p>
                <p className="text-2xl font-bold text-slate-900">{metrics?.current_census || 0}</p>
              </div>
              <Users className="w-8 h-8 text-blue-500" />
            </div>
          </div>
          <div className="bg-white rounded-xl shadow-lg p-4 border-l-4 border-orange-500">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-600">Avg Wait Time</p>
                <p className="text-2xl font-bold text-slate-900">
                  {metrics?.average_wait_time_minutes ? `${Math.round(metrics.average_wait_time_minutes)}m` : 'N/A'}
                </p>
              </div>
              <Clock className="w-8 h-8 text-orange-500" />
            </div>
          </div>
          <div className="bg-white rounded-xl shadow-lg p-4 border-l-4 border-red-500">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-600">LWBS Rate</p>
                <p className="text-2xl font-bold text-red-600">
                  {metrics?.lwbs_rate ? `${(metrics.lwbs_rate * 100).toFixed(1)}%` : '0%'}
                </p>
              </div>
              <AlertTriangle className="w-8 h-8 text-red-500" />
            </div>
          </div>
          <div className="bg-white rounded-xl shadow-lg p-4 border-l-4 border-emerald-500">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-600">Admission Rate</p>
                <p className="text-2xl font-bold text-emerald-600">
                  {metrics?.admission_rate ? `${(metrics.admission_rate * 100).toFixed(1)}%` : '0%'}
                </p>
              </div>
              <TrendingUp className="w-8 h-8 text-emerald-500" />
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <EDTrackingBoard 
          tenantSlug={tenantSlug!} 
          token={localStorage.getItem('ehr_token')!}
          onRefresh={handleRefresh}
        />
      </div>

      {/* Register ED Patient Modal */}
      {showRegisterModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-gradient-to-r from-red-600 to-orange-600 text-white p-6 rounded-t-xl z-10">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-2xl font-bold flex items-center gap-2">
                    <Ambulance className="w-6 h-6" />
                    Register ED Patient
                  </h3>
                  <p className="text-red-100 mt-1">Emergency Department Arrival</p>
                </div>
                <button
                  onClick={() => setShowRegisterModal(false)}
                  className="p-2 hover:bg-white/20 rounded-lg transition"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>
            
            <div className="p-6">
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
                <h4 className="text-sm font-bold text-yellow-900 mb-2">🚧 ED Registration Module - Coming Soon</h4>
                <p className="text-sm text-yellow-800 mb-3">
                  The full ED patient registration and triage workflow is currently under development.
                </p>
                <div className="text-xs text-yellow-700 space-y-1">
                  <p><strong>Planned Features:</strong></p>
                  <ul className="list-disc list-inside ml-2 space-y-1">
                    <li>Patient search and quick registration</li>
                    <li>Chief complaint and arrival mode capture</li>
                    <li>ESI (Emergency Severity Index) triage levels 1-5</li>
                    <li>Vital signs at arrival</li>
                    <li>Automatic placement on ED tracking board</li>
                    <li>Nurse-led triage workflow</li>
                  </ul>
                </div>
              </div>

              <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-4">
                <h4 className="text-sm font-bold text-indigo-900 mb-2">📋 Current Workflow (Temporary)</h4>
                <p className="text-sm text-indigo-800 mb-3">
                  Until the full ED module is complete, you can test with seed data:
                </p>
                <ol className="text-xs text-indigo-700 space-y-2 list-decimal list-inside ml-2">
                  <li>Use the seed data patients already in the system</li>
                  <li>View them on the ED Tracking Board below</li>
                  <li>Click patients to see their ED visit details</li>
                  <li>Update status as they move through ED workflow</li>
                </ol>
                <p className="text-xs text-indigo-600 mt-3 font-medium">
                  Expected completion: Sprint 24 Phase 2 (Frontend UI)
                </p>
              </div>
            </div>

            <div className="flex gap-3 justify-end p-6 bg-slate-50 rounded-b-xl border-t border-slate-200">
              <button
                onClick={() => setShowRegisterModal(false)}
                className="px-6 py-2 bg-slate-200 text-slate-700 rounded-lg hover:bg-slate-300 transition"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default EDDashboard;
