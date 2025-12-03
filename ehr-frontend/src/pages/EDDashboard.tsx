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
  const [patients, setPatients] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedPatient, setSelectedPatient] = useState<any>(null);
  const [registrationData, setRegistrationData] = useState({
    arrivalMode: 'walk_in',
    chiefComplaint: '',
    presentingSymptoms: '',
    allergies: '',
    currentMedications: '',
  });

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

  const searchPatients = async (term: string) => {
    if (term.length < 2) {
      setPatients([]);
      return;
    }
    
    try {
      const token = localStorage.getItem('ehr_token');
      const response = await ehrApi.get('/patients/search', token!, tenantSlug!, { query: term, limit: 10 });
      setPatients(response.data || []);
    } catch (error) {
      console.error('Failed to search patients:', error);
    }
  };

  const handleRegisterEDPatient = async () => {
    if (!selectedPatient) {
      showError('Error', 'Please select a patient');
      return;
    }
    if (!registrationData.chiefComplaint) {
      showError('Error', 'Chief complaint is required');
      return;
    }

    try {
      setLoading(true);
      const token = localStorage.getItem('ehr_token');
      
      await ehrApi.post('/ed/visits', {
        patientId: selectedPatient.id,
        arrivalMode: registrationData.arrivalMode,
        chiefComplaint: registrationData.chiefComplaint,
        presentingSymptoms: registrationData.presentingSymptoms,
        allergies: registrationData.allergies,
        currentMedications: registrationData.currentMedications,
      }, token!, tenantSlug!);

      showSuccess('Success', 'ED patient registered successfully');
      setShowRegisterModal(false);
      setSelectedPatient(null);
      setSearchTerm('');
      setRegistrationData({
        arrivalMode: 'walk_in',
        chiefComplaint: '',
        presentingSymptoms: '',
        allergies: '',
        currentMedications: '',
      });
      handleRefresh();
    } catch (error) {
      showError('Error', 'Failed to register ED patient');
    } finally {
      setLoading(false);
    }
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
            
            <div className="p-6 space-y-4">
              {/* Patient Search */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Search Patient *
                </label>
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => {
                    setSearchTerm(e.target.value);
                    searchPatients(e.target.value);
                  }}
                  placeholder="Search by name or patient number..."
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-red-500"
                />
                {patients.length > 0 && (
                  <div className="mt-2 border border-slate-200 rounded-lg max-h-40 overflow-y-auto">
                    {patients.map((patient) => (
                      <button
                        key={patient.id}
                        onClick={() => {
                          setSelectedPatient(patient);
                          setSearchTerm(`${patient.firstName} ${patient.lastName}`);
                          setPatients([]);
                        }}
                        className="w-full text-left px-3 py-2 hover:bg-indigo-50 transition"
                      >
                        <div className="font-medium">{patient.firstName} {patient.lastName}</div>
                        <div className="text-xs text-slate-500">{patient.patientNumber} • DOB: {patient.dateOfBirth}</div>
                      </button>
                    ))}
                  </div>
                )}
                {selectedPatient && (
                  <div className="mt-2 bg-green-50 border border-green-200 rounded-lg p-3">
                    <div className="font-medium text-green-900">✓ {selectedPatient.firstName} {selectedPatient.lastName}</div>
                    <div className="text-xs text-green-700">{selectedPatient.patientNumber}</div>
                  </div>
                )}
              </div>

              {/* Arrival Mode */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Arrival Mode *</label>
                <select
                  value={registrationData.arrivalMode}
                  onChange={(e) => setRegistrationData({ ...registrationData, arrivalMode: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-red-500"
                >
                  <option value="walk_in">Walk-in</option>
                  <option value="ambulance">Ambulance</option>
                  <option value="police">Police</option>
                  <option value="helicopter">Helicopter (Air Ambulance)</option>
                  <option value="transfer">Transfer from Another Facility</option>
                  <option value="other">Other</option>
                </select>
              </div>

              {/* Chief Complaint */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Chief Complaint *</label>
                <input
                  type="text"
                  value={registrationData.chiefComplaint}
                  onChange={(e) => setRegistrationData({ ...registrationData, chiefComplaint: e.target.value })}
                  placeholder="e.g., Chest pain, Difficulty breathing, Trauma..."
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-red-500"
                />
              </div>

              {/* Presenting Symptoms */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Presenting Symptoms</label>
                <textarea
                  value={registrationData.presentingSymptoms}
                  onChange={(e) => setRegistrationData({ ...registrationData, presentingSymptoms: e.target.value })}
                  rows={3}
                  placeholder="Brief description of symptoms..."
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-red-500"
                />
              </div>

              {/* Allergies */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Known Allergies</label>
                <input
                  type="text"
                  value={registrationData.allergies}
                  onChange={(e) => setRegistrationData({ ...registrationData, allergies: e.target.value })}
                  placeholder="e.g., Penicillin, Latex, None known"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-red-500"
                />
              </div>

              {/* Current Medications */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Current Medications</label>
                <textarea
                  value={registrationData.currentMedications}
                  onChange={(e) => setRegistrationData({ ...registrationData, currentMedications: e.target.value })}
                  rows={2}
                  placeholder="List current medications..."
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-red-500"
                />
              </div>

              <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                <h4 className="text-sm font-bold text-red-900 mb-2">🚨 After Registration</h4>
                <p className="text-xs text-red-800">
                  Patient will appear on ED Tracking Board with status "Waiting". 
                  A triage nurse should assign ESI level (1-5) and initial vitals.
                </p>
              </div>
            </div>

            <div className="flex gap-3 justify-end p-6 bg-slate-50 rounded-b-xl border-t border-slate-200">
              <button
                onClick={() => {
                  setShowRegisterModal(false);
                  setSelectedPatient(null);
                  setSearchTerm('');
                }}
                className="px-4 py-2 text-slate-700 hover:bg-slate-200 rounded-lg transition"
              >
                Cancel
              </button>
              <button
                onClick={handleRegisterEDPatient}
                disabled={loading}
                className="px-6 py-2 bg-gradient-to-r from-red-600 to-orange-600 text-white rounded-lg hover:shadow-lg transition font-medium disabled:opacity-50"
              >
                {loading ? 'Registering...' : 'Register Patient'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default EDDashboard;
