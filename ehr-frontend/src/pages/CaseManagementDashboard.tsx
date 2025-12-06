import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Home, Calendar, AlertTriangle, CheckCircle, Loader2, ArrowLeft } from 'lucide-react';
import axios from 'axios';
import { useNotification } from '../components/GlobalNotification';

const ehrAxios = axios.create({ baseURL: 'http://localhost:3013/api' });

const CaseManagementDashboard: React.FC = () => {
  const { tenantSlug } = useParams<{ tenantSlug: string }>();
  const navigate = useNavigate();
  const { showError } = useNotification();
  const token = localStorage.getItem('ehr_token') || '';
  const [user, setUser] = useState<any>(null);

  const [pendingDischarges, setPendingDischarges] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const userData = localStorage.getItem('ehr_user');
    if (userData) {
      setUser(JSON.parse(userData));
    }
  }, []);

  useEffect(() => {
    loadPendingDischarges();
  }, []);

  const loadPendingDischarges = async () => {
    try {
      const response = await ehrAxios.get('/case-management/discharge-plans/pending', {
        headers: { 'X-Tenant-ID': tenantSlug, Authorization: `Bearer ${token}` },
      });
      setPendingDischarges(response.data || []);
    } catch (error) {
      showError('Error', 'Failed to load pending discharges');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-12 w-12 animate-spin text-teal-600 mx-auto" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <div className="bg-gradient-to-r from-teal-600 to-cyan-700 text-white shadow-lg">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button
                onClick={() => navigate(`/ehr/${tenantSlug}/${user?.role === 'doctor' ? 'doctor' : user?.role === 'nurse' ? 'nurse' : 'dashboard'}`)}
                className="p-2 hover:bg-white/10 rounded-lg transition-colors"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
              <div>
                <h1 className="text-3xl font-bold flex items-center gap-3">
                  <Home className="w-8 h-8" />
                  Case Management & Discharge Planning
                </h1>
                <p className="text-teal-100 mt-1">Care coordination & discharge readiness</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-8 pb-8">
        <h2 className="text-xl font-bold text-slate-900 mb-3">Pending Discharges ({pendingDischarges.length})</h2>
        {pendingDischarges.length === 0 ? (
          <div className="bg-white/80 backdrop-blur-sm rounded-xl border border-slate-200 p-12 text-center shadow-sm">
            <CheckCircle className="w-16 h-16 text-green-400 mx-auto mb-4" />
            <h3 className="text-xl font-bold text-slate-900 mb-2">No Pending Discharges</h3>
            <p className="text-slate-600">All patients have completed discharge plans</p>
          </div>
        ) : (
          <div className="space-y-3">
            {pendingDischarges.map((discharge) => (
              <div key={discharge.id} className="bg-white/80 backdrop-blur-sm rounded-xl border border-slate-200 shadow-sm p-5">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-bold text-slate-900">{discharge.first_name} {discharge.last_name}</h3>
                    <p className="text-sm text-slate-600">
                      {discharge.ward_name} - Bed {discharge.bed_number}
                    </p>
                    <p className="text-sm text-slate-700 mt-1">
                      <strong>Target Discharge:</strong> {new Date(discharge.target_discharge_date).toLocaleDateString()}
                    </p>
                  </div>
                  <span className="px-3 py-1 bg-teal-100 text-teal-800 rounded-full text-xs font-bold">
                    READY
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default CaseManagementDashboard;



