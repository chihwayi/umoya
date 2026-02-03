import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Bed, Activity, TrendingUp, Clock, AlertCircle, Loader2, ArrowLeft } from 'lucide-react';
import { useNotification } from '../components/GlobalNotification';
import { ehrAxios } from '../services/api';
import AldreteScoreModal from '../components/AldreteScoreModal';

const PACUDashboard: React.FC = () => {
  const { tenantSlug } = useParams<{ tenantSlug: string }>();
  const navigate = useNavigate();
  const { showError } = useNotification();
  const token = localStorage.getItem('ehr_token') || '';

  const [user, setUser] = useState<any>(null);
  const [pacuPatients, setPacuPatients] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const userData = localStorage.getItem('ehr_user');
    if (userData) {
      setUser(JSON.parse(userData));
    }
  }, []);

  useEffect(() => {
    loadPACUPatients();
    const interval = setInterval(loadPACUPatients, 30000); // Refresh every 30s
    return () => clearInterval(interval);
  }, []);

  const loadPACUPatients = async () => {
    try {
      const response = await ehrAxios.get('/anesthesia/pacu/active', {
        headers: { 'X-Tenant-ID': tenantSlug, Authorization: `Bearer ${token}` },
      });
      setPacuPatients(response.data || []);
    } catch (error) {
      showError('Error', 'Failed to load PACU patients');
    } finally {
      setLoading(false);
    }
  };

  const getAldreteColor = (score: number) => {
    if (score >= 9) return 'bg-green-100 text-green-800 border-green-300';
    if (score >= 7) return 'bg-yellow-100 text-yellow-800 border-yellow-300';
    return 'bg-red-100 text-red-800 border-red-300';
  };

  const getPainColor = (score: number) => {
    if (score <= 3) return 'text-green-600';
    if (score <= 6) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getTimeInPACU = (arrivalTime: string) => {
    const arrival = new Date(arrivalTime);
    const now = new Date();
    const diffMinutes = Math.floor((now.getTime() - arrival.getTime()) / (1000 * 60));
    return `${diffMinutes} min`;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <Loader2 className="h-12 w-12 animate-spin text-purple-600 mx-auto mb-4" />
          <p className="text-slate-600">Loading PACU...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <div className="bg-gradient-to-r from-purple-600 to-violet-700 text-white shadow-lg">
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
                  <Bed className="w-8 h-8" />
                  PACU Dashboard
                </h1>
                <p className="text-purple-100 mt-1">Post-Anesthesia Care Unit monitoring</p>
              </div>
            </div>
            <div className="bg-white/10 backdrop-blur-sm rounded-xl px-6 py-3">
              <div className="text-center">
                <p className="text-2xl font-bold">{pacuPatients.length}</p>
                <p className="text-sm text-purple-100">Active Patients</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-8 pb-8">
        {/* PACU Beds */}
        {pacuPatients.length === 0 ? (
        <div className="bg-white/80 backdrop-blur-sm rounded-xl border border-slate-200 p-12 text-center shadow-sm">
          <Bed className="w-16 h-16 text-slate-400 mx-auto mb-4" />
          <h3 className="text-xl font-bold text-slate-900 mb-2">No Patients in PACU</h3>
          <p className="text-slate-600">All post-operative patients have been discharged</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {pacuPatients.map((patient) => (
            <div
              key={patient.id}
              className="bg-white/80 backdrop-blur-sm rounded-2xl border-2 border-slate-200 shadow-lg hover:shadow-xl transition-all overflow-hidden"
            >
              {/* Patient Header */}
              <div className={`p-5 ${
                patient.aldreteScoreDischarge >= 9
                  ? 'bg-gradient-to-br from-green-50 to-emerald-50 border-b-2 border-green-200'
                  : patient.aldreteScoreDischarge >= 7
                  ? 'bg-gradient-to-br from-yellow-50 to-amber-50 border-b-2 border-yellow-200'
                  : 'bg-gradient-to-br from-red-50 to-rose-50 border-b-2 border-red-200'
              }`}>
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h3 className="text-xl font-bold text-slate-900">
                      {patient.patient?.firstName} {patient.patient?.lastName}
                    </h3>
                    <p className="text-slate-600 text-sm">PACU Bed</p>
                  </div>
                  <div className={`px-3 py-1 rounded-full text-xs font-bold border-2 ${
                    patient.dischargeCriteriaMet
                      ? 'bg-green-100 text-green-800 border-green-300'
                      : 'bg-yellow-100 text-yellow-800 border-yellow-300'
                  }`}>
                    {patient.dischargeCriteriaMet ? 'READY' : 'MONITORING'}
                  </div>
                </div>

                {/* Stats */}
                <div className="grid grid-cols-3 gap-3">
                  <div className="text-center">
                    <p className="text-xs text-slate-600 mb-1">Aldrete Score</p>
                    <p className={`text-2xl font-bold ${
                      patient.aldreteScoreDischarge >= 9 ? 'text-green-600' :
                      patient.aldreteScoreDischarge >= 7 ? 'text-yellow-600' : 'text-red-600'
                    }`}>
                      {patient.aldreteScoreDischarge || patient.aldreteScoreAdmission || '-'}/10
                    </p>
                  </div>
                  <div className="text-center">
                    <p className="text-xs text-slate-600 mb-1">Pain Score</p>
                    <p className={`text-2xl font-bold ${getPainColor(patient.painScoreDischarge || patient.painScoreAdmission || 0)}`}>
                      {patient.painScoreDischarge || patient.painScoreAdmission || '-'}/10
                    </p>
                  </div>
                  <div className="text-center">
                    <p className="text-xs text-slate-600 mb-1">Time in PACU</p>
                    <p className="text-2xl font-bold text-purple-600">
                      {getTimeInPACU(patient.arrivalTime)}
                    </p>
                  </div>
                </div>
              </div>

              {/* Patient Details */}
              <div className="p-5 space-y-3">
                <div className="flex items-center gap-2 text-sm text-slate-700">
                  <Activity className="w-4 h-4 text-purple-600" />
                  <span className="font-semibold">Procedure:</span>
                  <span>Post-op from OR</span>
                </div>
                <div className="flex items-center gap-2 text-sm text-slate-700">
                  <Clock className="w-4 h-4 text-purple-600" />
                  <span className="font-semibold">Arrived:</span>
                  <span>{new Date(patient.arrivalTime).toLocaleTimeString()}</span>
                </div>
                {patient.pacuNurse && (
                  <div className="flex items-center gap-2 text-sm text-slate-700">
                    <span className="font-semibold">PACU Nurse:</span>
                    <span>{patient.pacuNurse.firstName} {patient.pacuNurse.lastName}</span>
                  </div>
                )}

                {/* Action Buttons */}
                <div className="grid grid-cols-3 gap-2 mt-4">
                  <button className="px-3 py-2 bg-indigo-100 hover:bg-indigo-200 text-indigo-700 rounded-lg text-sm font-semibold transition">
                    Vitals
                  </button>
                  <button className="px-3 py-2 bg-purple-100 hover:bg-purple-200 text-purple-700 rounded-lg text-sm font-semibold transition">
                    Pain Meds
                  </button>
                  {patient.dischargeCriteriaMet ? (
                    <button className="px-3 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm font-semibold transition">
                      Discharge
                    </button>
                  ) : (
                    <button className="px-3 py-2 bg-slate-200 text-slate-500 rounded-lg text-sm font-semibold cursor-not-allowed">
                      Not Ready
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
        )}
      </div>
    </div>
  );
};

export default PACUDashboard;
