import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import {
  AlertCircle, AlertTriangle, Clock, User, Users,
  ArrowLeft, RefreshCw, TrendingUp, Ambulance, X,
  Brain, Search, BookOpen, Sparkles, Loader2
} from 'lucide-react';
import { ehrApi, cdssApi } from '../services/api';
import { useNotification } from '../components/GlobalNotification';
import EDTrackingBoard from '../components/EDTrackingBoard';
import SnomedConceptPicker, { SnomedConcept } from '../components/SnomedConceptPicker';
import ModalPortal from '../components/ModalPortal';
import { GuidelineResult } from '../types/guidelines';
import GuidelineCitationCard from '../components/GuidelineCitationCard';
import { useConfirmation } from '../hooks/useConfirmation';
import {
  buildSharedContextTags,
  getEdRegistrationDuplicateGuard,
  getEdRegistrationPrefill,
} from '../services/doctorContextAdapter';

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
  const location = useLocation();
  const { showError, showSuccess } = useNotification();
  const { confirm, Dialog } = useConfirmation();
  const isEmbedded = location.pathname.includes('/doctor/emergency');
  
  const [user, setUser] = useState<any>(null);
  const [metrics, setMetrics] = useState<EDMetrics | null>(null);
  const [loading, setLoading] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [showRegisterModal, setShowRegisterModal] = useState(false);
  const [patients, setPatients] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedPatient, setSelectedPatient] = useState<any>(null);
  const [selectedPatientContext, setSelectedPatientContext] = useState<any | null>(null);
  const [loadingPatientContext, setLoadingPatientContext] = useState(false);
  const [registrationData, setRegistrationData] = useState({
    arrivalMode: 'walk_in',
    chiefComplaint: '',
    chiefComplaintSnomed: null as SnomedConcept | null,
    presentingSymptoms: '',
    allergies: '',
    currentMedications: '',
  });

  // CDSS Guideline Search State
  const [showGuidelineSearch, setShowGuidelineSearch] = useState(false);
  const [guidelineQuery, setGuidelineQuery] = useState('');
  const [guidelineResults, setGuidelineResults] = useState<GuidelineResult[]>([]);
  const [loadingGuidelines, setLoadingGuidelines] = useState(false);

  const handleGuidelineSearch = async () => {
    if (!guidelineQuery.trim()) return;
    setLoadingGuidelines(true);
    try {
      const token = localStorage.getItem('ehr_token');
      if (!token || !tenantSlug) {
        showError('Session Expired', 'Please login again.');
        return;
      }
      
      const response = await cdssApi.searchGuidelines(guidelineQuery, token, tenantSlug);
      if (response.data && response.data.citations) {
        setGuidelineResults(response.data.citations);
      } else {
        setGuidelineResults([]);
      }
    } catch (e) {
      console.error('Guideline search failed:', e);
      showError('Error', 'Failed to search guidelines');
    } finally {
      setLoadingGuidelines(false);
    }
  };

  useEffect(() => {
    const userData = localStorage.getItem('ehr_user');
    if (userData) {
      setUser(JSON.parse(userData));
    } else {
      navigate(`/ehr/${tenantSlug}`);
    }
  }, [navigate, tenantSlug]);

  const fetchMetrics = useCallback(async () => {
    try {
      const token = localStorage.getItem('ehr_token');
      if (!token || !tenantSlug) return;

      const response = await ehrApi.getEDMetrics(token, tenantSlug);
      setMetrics(response.data);
    } catch (error) {
      console.error('Failed to fetch ED metrics:', error);
    }
  }, [tenantSlug]);

  const handleRefresh = () => {
    setRefreshKey(prev => prev + 1);
    fetchMetrics();
    showSuccess('Refreshed', 'ED data updated');
  };

  useEffect(() => {
    if (user) {
      fetchMetrics();
    }
  }, [fetchMetrics, refreshKey, user]);

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

  const applyPatientContextPrefill = useCallback((context: any) => {
    const prefill = getEdRegistrationPrefill(context);
    setRegistrationData((prev) => ({
      ...prev,
      chiefComplaint: prev.chiefComplaint || prefill.chiefComplaint || '',
      presentingSymptoms: prev.presentingSymptoms || prefill.presentingSymptoms || '',
      allergies: prev.allergies || prefill.allergies || '',
      currentMedications: prev.currentMedications || prefill.currentMedications || '',
    }));
  }, []);

  const loadSelectedPatientContext = useCallback(
    async (patientId: string) => {
      const token = localStorage.getItem('ehr_token');
      if (!token || !tenantSlug) return;

      try {
        setLoadingPatientContext(true);
        const response = await ehrApi.getPatientContext(patientId, token, tenantSlug);
        const context = response.data || null;
        setSelectedPatientContext(context);
        applyPatientContextPrefill(context);
      } catch (error) {
        console.error('Failed to load ED registration patient context:', error);
        setSelectedPatientContext(null);
      } finally {
        setLoadingPatientContext(false);
      }
    },
    [applyPatientContextPrefill, tenantSlug],
  );

  useEffect(() => {
    if (!showRegisterModal || !selectedPatient?.id) {
      setSelectedPatientContext(null);
      setLoadingPatientContext(false);
      return;
    }
    loadSelectedPatientContext(selectedPatient.id);
  }, [loadSelectedPatientContext, selectedPatient?.id, showRegisterModal]);

  const selectedPatientContextTags = useMemo(
    () => buildSharedContextTags(selectedPatientContext),
    [selectedPatientContext],
  );

  const handleRegisterEDPatient = async () => {
    if (!selectedPatient) {
      showError('Error', 'Please select a patient');
      return;
    }
    if (!registrationData.chiefComplaint) {
      showError('Error', 'Chief complaint is required');
      return;
    }

    const duplicatePrompt = getEdRegistrationDuplicateGuard(selectedPatientContext, {
      chiefComplaint: registrationData.chiefComplaint,
    });
    if (duplicatePrompt) {
      const shouldProceed = await confirm({
        title: duplicatePrompt.title,
        message: duplicatePrompt.message,
        type: 'warning',
        confirmText: duplicatePrompt.confirmText,
        cancelText: duplicatePrompt.cancelText,
      });
      if (!shouldProceed) {
        return;
      }
    }

    try {
      setLoading(true);
      const token = localStorage.getItem('ehr_token');
      
      await ehrApi.post('/ed/visits', {
        patientId: selectedPatient.id,
        arrivalMode: registrationData.arrivalMode,
        chiefComplaint: registrationData.chiefComplaint,
        chiefComplaintSnomed: registrationData.chiefComplaintSnomed?.conceptId || null,
        chiefComplaintTerm: registrationData.chiefComplaintSnomed?.term || null,
        presentingSymptoms: registrationData.presentingSymptoms,
        allergies: registrationData.allergies,
        currentMedications: registrationData.currentMedications,
      }, token!, tenantSlug!);

      showSuccess('Success', 'ED patient registered successfully');
      setShowRegisterModal(false);
      setSelectedPatient(null);
      setSelectedPatientContext(null);
      setSearchTerm('');
      setRegistrationData({
        arrivalMode: 'walk_in',
        chiefComplaint: '',
        chiefComplaintSnomed: null,
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
    <div className={isEmbedded ? 'bg-transparent' : 'min-h-screen bg-slate-50'}>
      {/* Header */}
      {!isEmbedded && (
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
      )}

      {/* Statistics Cards */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-8 pb-8">
        {isEmbedded && (
          <div className="mb-4 flex flex-wrap items-center justify-end gap-2">
            <button
              onClick={() => setShowRegisterModal(true)}
              className="px-4 py-2 rounded-lg bg-gradient-to-r from-red-600 to-orange-600 text-white text-sm font-medium shadow-sm hover:shadow-md transition-all flex items-center gap-2"
            >
              <User className="w-4 h-4" />
              Register Patient
            </button>
            <button
              onClick={handleRefresh}
              className="px-3 py-2 rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 transition-colors"
            >
              <RefreshCw className="w-5 h-5" />
            </button>
          </div>
        )}
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
        
        {/* AI Guideline Search Section */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm mb-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <div className="p-2 bg-red-100 rounded-lg">
                <Brain className="w-5 h-5 text-red-600" />
              </div>
              <div>
                <h3 className="font-semibold text-slate-900">Emergency Protocols & Guidelines</h3>
                <p className="text-sm text-slate-500">AI-powered search for trauma, toxicology, and acute care standards</p>
              </div>
            </div>
            <button
              onClick={() => setShowGuidelineSearch(!showGuidelineSearch)}
              className="text-sm text-red-600 font-medium hover:text-red-700"
            >
              {showGuidelineSearch ? 'Hide Search' : 'Search Protocols'}
            </button>
          </div>

          {showGuidelineSearch && (
            <div className="space-y-4 animate-in slide-in-from-top-2 duration-200">
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
                  <input
                    type="text"
                    value={guidelineQuery}
                    onChange={(e) => setGuidelineQuery(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleGuidelineSearch()}
                    placeholder="Search e.g. 'STEMI protocol', 'Sepsis bundle', 'Stroke pathway'..."
                    className="w-full pl-9 pr-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
                  />
                </div>
                <button
                  onClick={handleGuidelineSearch}
                  disabled={loadingGuidelines || !guidelineQuery.trim()}
                  className="px-4 py-2 bg-red-600 text-white rounded-lg font-medium hover:bg-red-700 disabled:opacity-50 transition-colors"
                >
                  {loadingGuidelines ? 'Searching...' : 'Search'}
                </button>
              </div>

              {guidelineResults.length > 0 && (
                <div className="grid gap-3">
                  {guidelineResults.slice(0, 2).map((result, idx) => (
                    <div key={idx} className="p-4 bg-slate-50 rounded-lg border border-slate-200">
                      <div className="flex items-start gap-3">
                        <BookOpen className="w-5 h-5 text-red-600 mt-1 shrink-0" />
                        <div>
                          <h4 className="font-medium text-slate-900">{result.source}</h4>
                          <p className="text-sm text-slate-600 mt-1 leading-relaxed">{result.text}</p>
                          {result.url && (
                            <a
                              href={result.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-block mt-2 text-xs text-red-600 hover:underline"
                            >
                              View Source
                            </a>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

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
                    {loadingPatientContext && (
                      <div className="mt-2 text-xs text-emerald-700">Loading shared patient context...</div>
                    )}
                    {selectedPatientContextTags.length > 0 && (
                      <div className="mt-2 text-xs text-emerald-700">
                        Context: {selectedPatientContextTags.join(' • ')}
                      </div>
                    )}
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

              {/* Chief Complaint SNOMED (Optional) */}
              <div>
                <SnomedConceptPicker
                  value={registrationData.chiefComplaintSnomed}
                  onChange={(concept) => setRegistrationData({ ...registrationData, chiefComplaintSnomed: concept })}
                  token={localStorage.getItem('ehr_token') || ''}
                  tenantSlug={tenantSlug!}
                  label="Chief Complaint SNOMED Code (Optional)"
                  placeholder="Search for SNOMED code..."
                  helperText="Enables clinical decision support and alerts"
                  context="symptom"
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
      {Dialog}
      {/* AI Guideline Search Modal */}
      {showGuidelineSearch && (
        <ModalPortal>
          <div className="fixed inset-0 z-[100] bg-black/70 backdrop-blur-md flex items-center justify-center p-4">
          <div className="w-full max-w-4xl max-h-[85vh] overflow-hidden bg-gradient-to-br from-white to-slate-50 rounded-3xl shadow-2xl border border-slate-200/50 flex flex-col">
            <div className="sticky top-0 bg-gradient-to-r from-blue-600 to-indigo-700 px-6 py-5 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-white/20 rounded-xl">
                  <BookOpen className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-white">AI Clinical Guidelines</h3>
                  <p className="text-sm text-blue-100">Evidence-based emergency protocols & guidelines</p>
                </div>
              </div>
              <button onClick={() => setShowGuidelineSearch(false)} className="p-2 rounded-lg hover:bg-white/20 text-white transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-6 overflow-hidden flex flex-col h-full">
              <div className="flex gap-2 mb-6 shrink-0">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                  <input
                    type="text"
                    value={guidelineQuery}
                    onChange={(e) => setGuidelineQuery(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleGuidelineSearch()}
                    placeholder="Search for emergency protocols (e.g., 'Stroke protocol', 'Sepsis', 'Trauma')..."
                    className="w-full pl-10 pr-4 py-3 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent shadow-sm"
                    autoFocus
                  />
                </div>
                <button
                  onClick={handleGuidelineSearch}
                  disabled={loadingGuidelines || !guidelineQuery.trim()}
                  className="px-6 py-3 bg-gradient-to-r from-blue-600 to-indigo-700 text-white font-semibold rounded-xl hover:shadow-lg hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  {loadingGuidelines ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      Searching...
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-5 h-5" />
                      Search
                    </>
                  )}
                </button>
              </div>

              <div className="flex-1 overflow-y-auto min-h-0 pr-2 custom-scrollbar">
                {loadingGuidelines ? (
                  <div className="flex flex-col items-center justify-center h-48 text-slate-500">
                    <Loader2 className="w-10 h-10 animate-spin text-blue-600 mb-3" />
                    <p>Analyzing clinical guidelines...</p>
                  </div>
                ) : guidelineResults.length > 0 ? (
                  <div className="space-y-4">
                    {guidelineResults.map((result, index) => (
                      <GuidelineCitationCard key={index} result={result} index={index} />
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-12 text-slate-500">
                    <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
                      <BookOpen className="w-8 h-8 text-slate-400" />
                    </div>
                    <p className="text-lg font-medium text-slate-700">No guidelines found</p>
                    <p className="text-sm">Try searching for a specific condition, procedure, or medication.</p>
                  </div>
                )}
              </div>
              
              <div className="mt-4 pt-4 border-t border-slate-200 text-xs text-slate-500 text-center shrink-0">
                AI-assisted results should be verified against official hospital protocols.
              </div>
            </div>
          </div>
          </div>
        </ModalPortal>
      )}
    </div>
  );
};

export default EDDashboard;
