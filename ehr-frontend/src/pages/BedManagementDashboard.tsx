import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Activity, Bed, Users, TrendingUp, BarChart3, RefreshCw,
  ArrowLeft, AlertCircle, CheckCircle, Clock, Building
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

const BedManagementDashboard: React.FC = () => {
  const { tenantSlug } = useParams<{ tenantSlug: string }>();
  const navigate = useNavigate();
  const { showError, showSuccess } = useNotification();
  
  const [user, setUser] = useState<any>(null);
  const [token, setToken] = useState<string | null>(null);
  const [occupancyStats, setOccupancyStats] = useState<BedOccupancyStats | null>(null);
  const [selectedWard, setSelectedWard] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [showAdmissionWorkflow, setShowAdmissionWorkflow] = useState(false);

  useEffect(() => {
    const userData = localStorage.getItem('ehr_user');
    const authToken = localStorage.getItem('ehr_token');
    if (userData && authToken) {
      setUser(JSON.parse(userData));
      setToken(authToken);
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
      if (!token || !tenantSlug) return;

      const response = await ehrApi.get('/beds/occupancy', token, tenantSlug, selectedWard ? { ward: selectedWard } : {});
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

  if (!user) return null;

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <div className="bg-gradient-to-r from-indigo-600 to-blue-700 text-white shadow-lg">
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
                  <Bed className="w-8 h-8" />
                  Bed Management & ADT
                </h1>
                <p className="text-indigo-100 mt-1">Real-time bed tracking, admissions, discharges & transfers</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowAdmissionWorkflow(true)}
                className="px-4 py-2 bg-white/10 hover:bg-white/20 rounded-lg transition-colors text-sm font-medium"
              >
                New Admission
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

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {token && (
          <BedManagementBoard 
            tenantSlug={tenantSlug!} 
            token={token}
          />
        )}
      </div>

      {/* Admission Workflow Modal */}
      {showAdmissionWorkflow && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-slate-200 p-4 flex items-center justify-between z-10">
              <h2 className="text-xl font-bold text-slate-900">New Patient Admission</h2>
              <button
                onClick={() => setShowAdmissionWorkflow(false)}
                className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
              >
                <Activity className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6">
              {token && (
                <AdmissionWorkflow 
                  tenantSlug={tenantSlug!}
                  token={token}
                  onClose={() => {
                    setShowAdmissionWorkflow(false);
                    handleRefresh();
                  }}
                />
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default BedManagementDashboard;
