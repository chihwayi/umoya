import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { Bed, Clock, Activity, AlertCircle, CheckCircle, Loader2, Heart } from 'lucide-react';
import axios from 'axios';
import { useNotification } from '../components/GlobalNotification';
import AldreteScoreModal from '../components/AldreteScoreModal';

const ehrAxios = axios.create({ baseURL: 'http://localhost:3013/api' });

const PACUDashboard: React.FC = () => {
  const { tenantSlug } = useParams<{ tenantSlug: string }>();
  const { showError, showSuccess } = useNotification();
  const token = localStorage.getItem('ehr_token') || '';

  const [pacuPatients, setPacuPatients] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedPatient, setSelectedPatient] = useState<any>(null);
  const [showAldreteModal, setShowAldreteModal] = useState(false);

  useEffect(() => {
    loadPACUPatients();
    const interval = setInterval(loadPACUPatients, 30000); // Refresh every 30 seconds
    return () => clearInterval(interval);
  }, []);

  const loadPACUPatients = async () => {
    try {
      const response = await ehrAxios.get('/anesthesia/pacu/active', {
        headers: { 'X-Tenant-ID': tenantSlug, Authorization: `Bearer ${token}` },
      });
      setPacuPatients(response.data || []);
    } catch (error: any) {
      if (error.response?.status !== 404) {
        showError('Error', 'Failed to load PACU patients');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleDischargePACU = async (pacuRecordId: string) => {
    const dischargedTo = prompt('Discharge to: (floor/icu/stepdown/home)');
    if (!dischargedTo) return;

    try {
      await ehrAxios.post(`/anesthesia/pacu/${pacuRecordId}/discharge`, 
        { dischargedTo },
        { headers: { 'X-Tenant-ID': tenantSlug, Authorization: `Bearer ${token}` } }
      );
      showSuccess('Success', 'Patient discharged from PACU');
      loadPACUPatients();
    } catch (error: any) {
      showError('Error', error.response?.data?.message || 'Failed to discharge patient');
    }
  };

  const getTimeInPACU = (arrivalTime: string) => {
    const arrival = new Date(arrivalTime);
    const now = new Date();
    const minutes = Math.floor((now.getTime() - arrival.getTime()) / (1000 * 60));
    return `${minutes} min`;
  };

  const getAldreteColor = (score: number | null) => {
    if (!score) return 'bg-slate-100 text-slate-800';
    if (score >= 9) return 'bg-green-100 text-green-800';
    if (score >= 7) return 'bg-yellow-100 text-yellow-800';
    return 'bg-red-100 text-red-800';
  };

  const getPainColor = (score: number | null) => {
    if (!score) return 'text-slate-500';
    if (score <= 3) return 'text-green-600';
    if (score <= 6) return 'text-yellow-600';
    return 'text-red-600';
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
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-violet-50 to-pink-50 p-6">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-slate-900 flex items-center gap-3">
          <div className="w-12 h-12 bg-gradient-to-br from-purple-500 to-violet-600 rounded-xl flex items-center justify-center shadow-lg">
            <Bed className="w-7 h-7 text-white" />
          </div>
          PACU Dashboard
        </h1>
        <p className="text-slate-600 mt-1">Post-Anesthesia Care Unit</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-white/80 backdrop-blur-sm rounded-xl p-4 border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-600 mb-1">Active Patients</p>
              <p className="text-3xl font-bold text-slate-900">{pacuPatients.length}</p>
            </div>
            <div className="w-12 h-12 bg-purple-100 rounded-xl flex items-center justify-center">
              <Activity className="w-6 h-6 text-purple-600" />
            </div>
          </div>
        </div>

        <div className="bg-white/80 backdrop-blur-sm rounded-xl p-4 border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-600 mb-1">Ready for Discharge</p>
              <p className="text-3xl font-bold text-green-600">
                {pacuPatients.filter(p => p.aldrete_score_discharge >= 9).length}
              </p>
            </div>
            <div className="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center">
              <CheckCircle className="w-6 h-6 text-green-600" />
            </div>
          </div>
        </div>

        <div className="bg-white/80 backdrop-blur-sm rounded-xl p-4 border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-600 mb-1">Monitoring</p>
              <p className="text-3xl font-bold text-yellow-600">
                {pacuPatients.filter(p => !p.aldrete_score_discharge || p.aldrete_score_discharge < 9).length}
              </p>
            </div>
            <div className="w-12 h-12 bg-yellow-100 rounded-xl flex items-center justify-center">
              <AlertCircle className="w-6 h-6 text-yellow-600" />
            </div>
          </div>
        </div>

        <div className="bg-white/80 backdrop-blur-sm rounded-xl p-4 border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-600 mb-1">Avg Stay</p>
              <p className="text-3xl font-bold text-purple-600">
                {pacuPatients.length > 0
                  ? Math.round(
                      pacuPatients.reduce((sum, p) => {
                        const mins = (new Date().getTime() - new Date(p.arrival_time).getTime()) / (1000 * 60);
                        return sum + mins;
                      }, 0) / pacuPatients.length
                    )
                  : 0}
                <span className="text-lg text-slate-600">min</span>
              </p>
            </div>
            <div className="w-12 h-12 bg-purple-100 rounded-xl flex items-center justify-center">
              <Clock className="w-6 h-6 text-purple-600" />
            </div>
          </div>
        </div>
      </div>

      {/* PACU Beds */}
      {pacuPatients.length === 0 ? (
        <div className="bg-white/80 backdrop-blur-sm rounded-xl border border-slate-200 p-12 text-center shadow-sm">
          <Bed className="w-16 h-16 text-slate-400 mx-auto mb-4" />
          <h3 className="text-xl font-bold text-slate-900 mb-2">No Patients in PACU</h3>
          <p className="text-slate-600">All recovered and discharged</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {pacuPatients.map((patient) => (
            <div
              key={patient.id}
              className="bg-white/80 backdrop-blur-sm rounded-xl border-2 border-slate-200 shadow-lg hover:shadow-xl transition-all overflow-hidden"
            >
              {/* Header */}
              <div className={`p-4 ${
                patient.discharge_criteria_met
                  ? 'bg-gradient-to-r from-green-500 to-emerald-500'
                  : 'bg-gradient-to-r from-purple-500 to-violet-500'
              }`}>
                <div className="flex items-center justify-between text-white">
                  <div>
                    <h3 className="text-lg font-bold">
                      {patient.patient?.firstName} {patient.patient?.lastName}
                    </h3>
                    <p className="text-sm opacity-90">MRN: {patient.patient?.medicalRecordNumber}</p>
                  </div>
                  {patient.discharge_criteria_met && (
                    <CheckCircle className="w-6 h-6" />
                  )}
                </div>
              </div>

              {/* Body */}
              <div className="p-4 space-y-3">
                {/* Aldrete Score */}
                <div className="flex items-center justify-between">
                  <span className="text-sm text-slate-600">Aldrete Score:</span>
                  <span className={`px-3 py-1 rounded-full text-sm font-bold ${getAldreteColor(patient.aldrete_score_discharge)}`}>
                    {patient.aldrete_score_discharge || patient.aldrete_score_admission || 0}/10
                  </span>
                </div>

                {/* Pain Score */}
                <div className="flex items-center justify-between">
                  <span className="text-sm text-slate-600">Pain Score:</span>
                  <span className={`text-lg font-bold ${getPainColor(patient.pain_score_discharge || patient.pain_score_admission)}`}>
                    {patient.pain_score_discharge || patient.pain_score_admission || 0}/10
                  </span>
                </div>

                {/* Time in PACU */}
                <div className="flex items-center justify-between">
                  <span className="text-sm text-slate-600">Time in PACU:</span>
                  <span className="text-sm font-bold text-slate-900">{getTimeInPACU(patient.arrival_time)}</span>
                </div>

                {/* Actions */}
                <div className="grid grid-cols-2 gap-2 pt-2">
                  <button
                    onClick={() => {
                      setSelectedPatient(patient);
                      setShowAldreteModal(true);
                    }}
                    className="px-3 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors text-sm font-semibold"
                  >
                    Update Score
                  </button>
                  {patient.discharge_criteria_met ? (
                    <button
                      onClick={() => handleDischargePACU(patient.id)}
                      className="px-3 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-sm font-semibold"
                    >
                      Discharge
                    </button>
                  ) : (
                    <button
                      disabled
                      className="px-3 py-2 bg-slate-200 text-slate-500 rounded-lg text-sm font-semibold cursor-not-allowed"
                    >
                      Not Ready
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Aldrete Score Modal */}
      {showAldreteModal && selectedPatient && (
        <AldreteScoreModal
          pacuRecordId={selectedPatient.id}
          currentScore={selectedPatient.aldrete_score_discharge || selectedPatient.aldrete_score_admission || 0}
          tenantSlug={tenantSlug || ''}
          token={token}
          onSuccess={() => {
            setShowAldreteModal(false);
            loadPACUPatients();
            showSuccess('Success', 'Aldrete score updated');
          }}
          onClose={() => setShowAldreteModal(false)}
        />
      )}
    </div>
  );
};

export default PACUDashboard;

