import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  ArrowLeft, User, Calendar,
  Heart, Activity, AlertCircle, FileText, Clock,
  Pill,
  Brain, BookOpen, Search, Sparkles, X, Loader2, ArrowRight, Edit
} from 'lucide-react';
import { ehrApi, cdssApi, chartApi } from '../services/api';
import { useNotification } from '../components/GlobalNotification';
import { formatDateToDDMMYYYY, formatDateTimeToDDMMYYYYHHMM } from '../utils/dateFormatting';
import { GuidelineResult } from '../types/guidelines';
import ModalPortal from '../components/ModalPortal';
import ProblemListModal from '../components/ProblemListModal';
import AllergiesModal from '../components/AllergiesModal';
import VoiceInput from '../components/VoiceInput';

interface Patient {
  id: string;
  patientNumber: string;
  firstName: string;
  lastName: string;
  dateOfBirth: string;
  gender: string;
  phone: string;
  email: string;
  address: string;
  city: string;
  bloodType: string;
  allergies: string;
  chronicConditions: string;
  emergencyContactName: string;
  emergencyContactPhone: string;
  medicalAidName: string;
  medicalAidNumber: string;
  medicalAidPlan: string;
}

interface Appointment {
  id: string;
  appointmentDate: string;
  durationMinutes: number;
  appointmentType: string;
  status: string;
  reason: string;
  notes: string;
  doctor: {
    id: string;
    firstName: string;
    lastName: string;
  };
}

const DoctorPatientDetail: React.FC = () => {
  const { tenantSlug, patientId } = useParams<{ tenantSlug: string; patientId: string }>();
  const navigate = useNavigate();
  const { showError } = useNotification();
  
  const [patient, setPatient] = useState<Patient | null>(null);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'overview' | 'appointments' | 'medical-history'>('overview');

  // AI/RAG State
  const [showGuidelineSearch, setShowGuidelineSearch] = useState(false);
  const [guidelineQuery, setGuidelineQuery] = useState('');
  const [loadingGuidelines, setLoadingGuidelines] = useState(false);
  const [guidelineResults, setGuidelineResults] = useState<GuidelineResult[]>([]);
  const [loadingAiSnapshot, setLoadingAiSnapshot] = useState(false);
  const [aiRiskResult, setAiRiskResult] = useState<any | null>(null);
  const [aiDiagnosisResult, setAiDiagnosisResult] = useState<any | null>(null);
  const [aiSnapshotAt, setAiSnapshotAt] = useState<string | null>(null);
  const [ewsScores, setEwsScores] = useState<any[] | null>(null);

  // Medical History State
  const [problems, setProblems] = useState<any[]>([]);
  const [allergiesList, setAllergiesList] = useState<any[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [showProblemsModal, setShowProblemsModal] = useState(false);
  const [showAllergiesModal, setShowAllergiesModal] = useState(false);
  const [latestVitals, setLatestVitals] = useState<any>(null);

  useEffect(() => {
    if (patientId) {
      fetchPatientDetails();
      fetchPatientAppointments();
      fetchLatestVitals();
    }
  }, [patientId]);

  useEffect(() => {
    if (activeTab === 'medical-history' && patientId) {
      fetchMedicalHistory();
    }
  }, [activeTab, patientId]);

  const fetchLatestVitals = async () => {
    try {
      const token = localStorage.getItem('ehr_token');
      if (!token || !tenantSlug || !patientId) return;

      const response = await ehrApi.getVitals(patientId, token, tenantSlug, { limit: 1 });
      if (response.data && response.data.latest) {
        setLatestVitals(response.data.latest);
      } else if (Array.isArray(response.data) && response.data.length > 0) {
        setLatestVitals(response.data[0]);
      }
    } catch (error) {
      console.error('Error fetching vitals:', error);
    }
  };

  const fetchMedicalHistory = async () => {
    try {
      const token = localStorage.getItem('ehr_token');
      if (!token || !patientId) return;

      setLoadingHistory(true);
      const [problemsRes, allergiesRes] = await Promise.all([
        chartApi.getProblems(patientId, token, tenantSlug!),
        chartApi.getAllergies(patientId, token, tenantSlug!)
      ]);

      setProblems(Array.isArray(problemsRes.data) ? problemsRes.data : []);
      setAllergiesList(Array.isArray(allergiesRes.data) ? allergiesRes.data : []);
    } catch (error) {
      console.error('Error fetching medical history:', error);
      showError('Error', 'Failed to fetch medical history');
    } finally {
      setLoadingHistory(false);
    }
  };

  const fetchPatientDetails = async () => {
    try {
      const token = localStorage.getItem('ehr_token');
      if (!token) return;

      const response = await ehrApi.getPatientById(patientId!, token, tenantSlug!);
      setPatient(response.data);
    } catch (error) {
      console.error('Error fetching patient details:', error);
      showError('Error', 'Failed to fetch patient details');
    }
  };

  const fetchPatientAppointments = async () => {
    try {
      const token = localStorage.getItem('ehr_token');
      if (!token) return;

      // Get current user to filter appointments by doctor
      const userData = localStorage.getItem('ehr_user');
      const currentUser = userData ? JSON.parse(userData) : null;
      
      if (!currentUser) return;

      // Fetch appointments for the last 30 days
      const endDate = new Date();
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - 30);

      const response = await ehrApi.getAppointments(token, tenantSlug!, {
        date: endDate.toISOString().split('T')[0]
      });

      // Filter appointments for this patient and current doctor
      const patientAppointments = response.data.appointments.filter(
        (apt: any) => 
          apt.patient.id === patientId && 
          apt.doctor.id === currentUser.id
      );

      setAppointments(patientAppointments);
    } catch (error) {
      console.error('Error fetching patient appointments:', error);
      showError('Error', 'Failed to fetch patient appointments');
    } finally {
      setLoading(false);
    }
  };

  const handleGuidelineSearch = async () => {
    if (!guidelineQuery.trim()) return;
    
    setLoadingGuidelines(true);
    try {
      const token = localStorage.getItem('ehr_token');
      if (!token || !tenantSlug) {
         showError('Session Expired', 'Please login again.');
         return;
      }

      let searchContext = "";
      
      // Enhance with patient context
      if (patient) {
        const patientContext = [];
        if (patient.dateOfBirth) {
             const age = calculateAge(patient.dateOfBirth);
             patientContext.push(`${age}yo`);
        }
        if (patient.gender) patientContext.push(patient.gender);
        
        if (patientContext.length > 0) {
          searchContext += `Patient: ${patientContext.join(', ')}. `;
        }

        // Add chronic conditions and allergies to context
        if (patient.chronicConditions) {
          searchContext += `Conditions: ${patient.chronicConditions}. `;
        }
        if (patient.allergies) {
           searchContext += `Allergies: ${patient.allergies}. `;
        }
      }

      // Enhance with vitals if available
      if (latestVitals) {
        const vitalsContext = [];
        if (latestVitals.bloodPressure) vitalsContext.push(`BP ${latestVitals.bloodPressure}`);
        if (latestVitals.heartRate) vitalsContext.push(`HR ${latestVitals.heartRate}`);
        if (latestVitals.temperature) vitalsContext.push(`Temp ${latestVitals.temperature}`);
        if (latestVitals.oxygenSaturation) vitalsContext.push(`SpO2 ${latestVitals.oxygenSaturation}%`);
        
        if (vitalsContext.length > 0) {
          searchContext += `Vitals: ${vitalsContext.join(', ')}. `;
        }
      }

      const finalQuery = searchContext ? `${searchContext} Query: ${guidelineQuery}` : guidelineQuery;

      const response = await cdssApi.searchGuidelines(finalQuery, token, tenantSlug);
      if (response.data && response.data.citations) {
        setGuidelineResults(response.data.citations);
      } else {
        setGuidelineResults([]);
      }
    } catch (error) {
      console.error('Error searching guidelines:', error);
      showError('Error', 'Failed to search guidelines');
    } finally {
      setLoadingGuidelines(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'scheduled': return 'bg-blue-100 text-blue-800';
      case 'confirmed': return 'bg-green-100 text-green-800';
      case 'in-progress': return 'bg-yellow-100 text-yellow-800';
      case 'completed': return 'bg-gray-100 text-gray-800';
      case 'cancelled': return 'bg-red-100 text-red-800';
      case 'no-show': return 'bg-orange-100 text-orange-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'scheduled': return <Clock className="w-4 h-4" />;
      case 'confirmed': return <Calendar className="w-4 h-4" />;
      case 'in-progress': return <Activity className="w-4 h-4" />;
      case 'completed': return <FileText className="w-4 h-4" />;
      case 'cancelled': return <AlertCircle className="w-4 h-4" />;
      case 'no-show': return <AlertCircle className="w-4 h-4" />;
      default: return <Clock className="w-4 h-4" />;
    }
  };

  const calculateAge = (dateOfBirth: string) => {
    const today = new Date();
    const birthDate = new Date(dateOfBirth);
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }
    
    return age;
  };

  const splitTerms = (value?: string): string[] => {
    if (!value || typeof value !== 'string') return [];
    return value
      .split(/[;,]/)
      .map((item) => item.trim())
      .filter(Boolean);
  };

  const runDoctorAiSnapshot = async () => {
    try {
      const token = localStorage.getItem('ehr_token');
      if (!token || !tenantSlug || !patient || !patientId) {
        showError('Session Expired', 'Please login again.');
        return;
      }

      setLoadingAiSnapshot(true);

      const age = calculateAge(patient.dateOfBirth);
      const problemTerms = problems.length
        ? problems
            .map((problem) => problem?.snomedTerm || problem?.description || problem?.code)
            .filter(Boolean)
        : splitTerms(patient.chronicConditions);

      const allergyTerms = allergiesList.length
        ? allergiesList
            .map((allergy) => allergy?.allergenSnomedTerm || allergy?.allergen)
            .filter(Boolean)
        : splitTerms(patient.allergies);

      const appointmentContext = appointments
        .slice(0, 2)
        .map((appointment) => appointment?.reason)
        .filter(Boolean);

      const symptoms = Array.from(
        new Set<string>([
          ...problemTerms.map((item: string) => String(item).trim()),
          ...appointmentContext.map((item: string) => String(item).trim()),
          ...splitTerms(guidelineQuery),
        ].filter(Boolean)),
      ).slice(0, 8);

      const vitalsPayload = latestVitals
        ? {
            bloodPressure: latestVitals.bloodPressure || latestVitals.blood_pressure,
            systolicBp: latestVitals.systolicBp || latestVitals.systolic_bp,
            diastolicBp: latestVitals.diastolicBp || latestVitals.diastolic_bp,
            heartRate: latestVitals.heartRate || latestVitals.heart_rate,
            respiratoryRate: latestVitals.respiratoryRate || latestVitals.respiratory_rate,
            temperature: latestVitals.temperature,
            oxygenSaturation: latestVitals.oxygenSaturation || latestVitals.oxygen_saturation,
          }
        : undefined;

      const riskPayload = {
        patientId,
        age,
        gender: patient.gender,
        vitals: vitalsPayload,
        medicalHistory: {
          chronicConditions: splitTerms(patient.chronicConditions),
          allergies: allergyTerms,
          activeProblems: problemTerms,
        },
        diagnoses: problemTerms,
        medications: [],
      };

      const diagnosisPayload = {
        symptoms: symptoms.length > 0 ? symptoms : ['clinical review required'],
        age,
        gender: patient.gender,
        vitals: vitalsPayload,
        patientId,
        medicalHistory: {
          chronicConditions: splitTerms(patient.chronicConditions),
          allergies: allergyTerms,
        },
      };

      const [riskResponse, diagnosisResponse] = await Promise.all([
        cdssApi.getRiskAssessment(riskPayload, token, tenantSlug),
        cdssApi.getDiagnosisSuggestions(diagnosisPayload, token, tenantSlug),
      ]);

      setAiRiskResult(riskResponse?.data || null);
      setAiDiagnosisResult(diagnosisResponse?.data || null);
      setAiSnapshotAt(new Date().toISOString());

      // Load NEWS2 / early warning scores for this patient
      try {
        const ewsResponse = await ehrApi.listEarlyWarningScoresForPatient(patientId, token, tenantSlug, 10);
        setEwsScores(Array.isArray(ewsResponse.data) ? ewsResponse.data : null);
      } catch (ewsError) {
        console.warn('Failed to load early warning scores:', ewsError);
        setEwsScores(null);
      }
    } catch (error) {
      console.error('Error running doctor AI snapshot:', error);
      showError('AI Error', 'Failed to run doctor AI snapshot');
    } finally {
      setLoadingAiSnapshot(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-slate-600">Loading patient details...</p>
        </div>
      </div>
    );
  }

  if (!patient) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 flex items-center justify-center">
        <div className="text-center">
          <User className="w-16 h-16 text-slate-400 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-slate-900 mb-2">Patient Not Found</h2>
          <p className="text-slate-600 mb-4">The patient you're looking for doesn't exist or you don't have access.</p>
          <button
            onClick={() => navigate(`/ehr/${tenantSlug}/doctor`)}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            Back to Dashboard
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50">
      {/* Header */}
      <div className="bg-white/80 backdrop-blur-sm shadow-lg border-b border-slate-200/50 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-20">
            <div className="flex items-center gap-6">
              <button
                onClick={() => navigate(`/ehr/${tenantSlug}/doctor`)}
                className="p-3 hover:bg-slate-100 rounded-xl transition-all duration-200 group"
              >
                <ArrowLeft className="w-5 h-5 text-slate-600 group-hover:text-slate-900 transition-colors" />
              </button>
              <div className="flex items-center gap-4">
                <div className="p-3 bg-gradient-to-r from-blue-500 to-indigo-600 rounded-2xl shadow-lg">
                  <User className="w-7 h-7 text-white" />
                </div>
                <div>
                  <h1 className="text-2xl font-bold text-slate-900">
                    {patient.firstName} {patient.lastName}
                  </h1>
                  <p className="text-slate-600 font-medium">Patient ID: {patient.patientNumber}</p>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <button
                onClick={() => setShowGuidelineSearch(!showGuidelineSearch)}
                className={`flex items-center space-x-2 px-4 py-2 rounded-full border transition-all duration-200 ${
                  showGuidelineSearch 
                    ? 'bg-purple-100 text-purple-700 border-purple-200 ring-2 ring-purple-100' 
                    : 'bg-white text-slate-600 border-slate-200 hover:border-purple-200 hover:text-purple-600'
                }`}
              >
                <Sparkles className="w-4 h-4" />
                <span className="text-sm font-semibold">AI Assistant</span>
              </button>
              <span className="px-4 py-2 bg-gradient-to-r from-blue-100 to-cyan-100 text-blue-800 rounded-full text-sm font-semibold border border-blue-200">
                {calculateAge(patient.dateOfBirth)} years old
              </span>
              <span className="px-4 py-2 bg-gradient-to-r from-slate-100 to-gray-100 text-slate-800 rounded-full text-sm font-semibold border border-slate-200">
                {patient.gender}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="bg-white/80 backdrop-blur-sm border-b border-slate-200/50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <nav className="flex space-x-8">
            <button
              onClick={() => setActiveTab('overview')}
              className={`py-4 px-1 border-b-2 font-semibold text-sm transition-all duration-200 ${
                activeTab === 'overview'
                  ? 'border-indigo-500 text-indigo-600'
                  : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
              }`}
            >
              <User className="w-4 h-4 inline mr-2" />
              Overview
            </button>
            <button
              onClick={() => setActiveTab('appointments')}
              className={`py-4 px-1 border-b-2 font-semibold text-sm transition-all duration-200 ${
                activeTab === 'appointments'
                  ? 'border-indigo-500 text-indigo-600'
                  : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
              }`}
            >
              <Calendar className="w-4 h-4 inline mr-2" />
              Appointments
            </button>
            <button
              onClick={() => setActiveTab('medical-history')}
              className={`py-4 px-1 border-b-2 font-semibold text-sm transition-all duration-200 ${
                activeTab === 'medical-history'
                  ? 'border-indigo-500 text-indigo-600'
                  : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
              }`}
            >
              <FileText className="w-4 h-4 inline mr-2" />
              Medical History
            </button>
          </nav>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {activeTab === 'overview' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Patient Information */}
            <div className="lg:col-span-2 space-y-8">
              <div className="bg-gradient-to-br from-white to-slate-50 rounded-2xl shadow-lg border border-slate-200/50 p-4">
                <div className="flex items-center gap-3 mb-2">
                  <h4 className="text-sm font-bold text-slate-900">Voice Input (L5)</h4>
                  <span className="text-xs text-slate-500">Dictate or use voice commands during consultation</span>
                </div>
                <VoiceInput
                  tenantSlug={tenantSlug || ''}
                  mode="continuous"
                  onTranscript={() => {}}
                  onCommand={(cmd) => {
                    if (cmd.type === 'add_note') { /* integrate */ }
                  }}
                />
              </div>
              <div className="bg-gradient-to-br from-white to-slate-50 rounded-2xl shadow-lg border border-slate-200/50 p-8">
                <div className="flex items-center gap-3 mb-6">
                  <div className="p-2 bg-gradient-to-r from-blue-500 to-indigo-600 rounded-xl">
                    <User className="w-5 h-5 text-white" />
                  </div>
                  <h3 className="text-xl font-bold text-slate-900">Personal Information</h3>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="p-4 bg-white/50 rounded-xl border border-slate-200/50">
                    <label className="text-sm font-semibold text-slate-600 mb-2 block">Date of Birth</label>
                    <p className="text-slate-900 font-medium">{formatDateToDDMMYYYY(patient.dateOfBirth)}</p>
                  </div>
                  <div className="p-4 bg-white/50 rounded-xl border border-slate-200/50">
                    <label className="text-sm font-semibold text-slate-600 mb-2 block">Gender</label>
                    <p className="text-slate-900 font-medium capitalize">{patient.gender}</p>
                  </div>
                  <div className="p-4 bg-white/50 rounded-xl border border-slate-200/50">
                    <label className="text-sm font-semibold text-slate-600 mb-2 block">Phone</label>
                    <p className="text-slate-900 font-medium">{patient.phone || 'Not provided'}</p>
                  </div>
                  <div className="p-4 bg-white/50 rounded-xl border border-slate-200/50">
                    <label className="text-sm font-semibold text-slate-600 mb-2 block">Email</label>
                    <p className="text-slate-900 font-medium">{patient.email || 'Not provided'}</p>
                  </div>
                  <div className="md:col-span-2 p-4 bg-white/50 rounded-xl border border-slate-200/50">
                    <label className="text-sm font-semibold text-slate-600 mb-2 block">Address</label>
                    <p className="text-slate-900 font-medium">{patient.address || 'Not provided'}</p>
                  </div>
                </div>
              </div>

              <div className="bg-gradient-to-br from-white to-slate-50 rounded-2xl shadow-lg border border-slate-200/50 p-8">
                <div className="flex items-center gap-3 mb-6">
                  <div className="p-2 bg-gradient-to-r from-red-500 to-pink-600 rounded-xl">
                    <Heart className="w-5 h-5 text-white" />
                  </div>
                  <h3 className="text-xl font-bold text-slate-900">Medical Information</h3>
                </div>
                <div className="space-y-6">
                  <div className="p-4 bg-white/50 rounded-xl border border-slate-200/50">
                    <label className="text-sm font-semibold text-slate-600 mb-2 block">Blood Type</label>
                    <p className="text-slate-900 font-medium">{patient.bloodType || 'Not specified'}</p>
                  </div>
                  <div className="p-4 bg-white/50 rounded-xl border border-slate-200/50">
                    <label className="text-sm font-semibold text-slate-600 mb-2 block">Allergies</label>
                    <p className="text-slate-900 font-medium">{patient.allergies || 'None known'}</p>
                  </div>
                  <div className="p-4 bg-white/50 rounded-xl border border-slate-200/50">
                    <label className="text-sm font-semibold text-slate-600 mb-2 block">Chronic Conditions</label>
                    <p className="text-slate-900 font-medium">{patient.chronicConditions || 'None'}</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Emergency Contact & Medical Aid */}
            <div className="space-y-8">
              <div className="bg-gradient-to-br from-white to-slate-50 rounded-2xl shadow-lg border border-slate-200/50 p-8">
                <div className="flex items-center gap-3 mb-6">
                  <div className="p-2 bg-gradient-to-r from-orange-500 to-red-600 rounded-xl">
                    <AlertCircle className="w-5 h-5 text-white" />
                  </div>
                  <h3 className="text-xl font-bold text-slate-900">Emergency Contact</h3>
                </div>
                <div className="space-y-4">
                  <div className="p-4 bg-white/50 rounded-xl border border-slate-200/50">
                    <label className="text-sm font-semibold text-slate-600 mb-2 block">Name</label>
                    <p className="text-slate-900 font-medium">{patient.emergencyContactName || 'Not provided'}</p>
                  </div>
                  <div className="p-4 bg-white/50 rounded-xl border border-slate-200/50">
                    <label className="text-sm font-semibold text-slate-600 mb-2 block">Phone</label>
                    <p className="text-slate-900 font-medium">{patient.emergencyContactPhone || 'Not provided'}</p>
                  </div>
                </div>
              </div>

              <div className="bg-gradient-to-br from-white to-slate-50 rounded-2xl shadow-lg border border-slate-200/50 p-8">
                <div className="flex items-center gap-3 mb-6">
                  <div className="p-2 bg-gradient-to-r from-green-500 to-emerald-600 rounded-xl">
                    <Pill className="w-5 h-5 text-white" />
                  </div>
                  <h3 className="text-xl font-bold text-slate-900">Medical Aid</h3>
                </div>
                <div className="space-y-4">
                  <div className="p-4 bg-white/50 rounded-xl border border-slate-200/50">
                    <label className="text-sm font-semibold text-slate-600 mb-2 block">Provider</label>
                    <p className="text-slate-900 font-medium">{patient.medicalAidName || 'Not provided'}</p>
                  </div>
                  <div className="p-4 bg-white/50 rounded-xl border border-slate-200/50">
                    <label className="text-sm font-semibold text-slate-600 mb-2 block">Number</label>
                    <p className="text-slate-900 font-medium">{patient.medicalAidNumber || 'Not provided'}</p>
                  </div>
                  <div className="p-4 bg-white/50 rounded-xl border border-slate-200/50">
                    <label className="text-sm font-semibold text-slate-600 mb-2 block">Plan</label>
                    <p className="text-slate-900 font-medium">{patient.medicalAidPlan || 'Not provided'}</p>
                  </div>
                </div>
              </div>

              <div className="bg-gradient-to-br from-white to-red-50 rounded-2xl shadow-lg border border-rose-200/70 p-8">
                <div className="flex items-center gap-3 mb-6">
                  <div className="p-2 bg-gradient-to-r from-red-600 to-rose-600 rounded-xl">
                    <Activity className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-rose-900">Early Warning (NEWS2)</h3>
                    <p className="text-xs text-rose-800">
                      Latest deterioration scores from vitals. Higher scores indicate higher risk.
                    </p>
                  </div>
                </div>
                {ewsScores && ewsScores.length > 0 ? (
                  <div className="space-y-3">
                    {ewsScores.slice(0, 5).map((score) => {
                      const level = String(score.riskLevel || 'low').toLowerCase();
                      const pillColor =
                        level === 'high'
                          ? 'bg-red-100 text-red-800 border-red-200'
                          : level === 'medium'
                            ? 'bg-amber-100 text-amber-800 border-amber-200'
                            : level === 'low_medium'
                              ? 'bg-yellow-100 text-yellow-800 border-yellow-200'
                              : 'bg-emerald-100 text-emerald-800 border-emerald-200';
                      const label =
                        level === 'high'
                          ? 'High'
                          : level === 'medium'
                            ? 'Medium'
                            : level === 'low_medium'
                              ? 'Low–Medium'
                              : 'Low';
                      return (
                        <div
                          key={score.id}
                          className="flex items-center justify-between gap-3 rounded-xl border border-rose-100 bg-white/70 px-3 py-2"
                        >
                          <div>
                            <p className="text-sm font-semibold text-slate-900">
                              NEWS2 score {score.totalScore}
                            </p>
                            <p className="text-[11px] text-slate-600">
                              {score.calculatedAt ? formatDateToDDMMYYYY(score.calculatedAt) : 'Recently calculated'}
                            </p>
                          </div>
                          <span className={`px-3 py-1 rounded-full text-[11px] font-semibold border ${pillColor}`}>
                            {label}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-sm text-rose-900">
                    No NEWS2 scores recorded yet. Record vitals and run AI snapshot to calculate risk.
                  </p>
                )}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'appointments' && (
          <div className="bg-white rounded-xl shadow-sm border border-slate-200">
            <div className="p-6 border-b border-slate-200">
              <h3 className="text-lg font-semibold text-slate-900">Recent Appointments</h3>
              <p className="text-sm text-slate-600">Appointments with this patient</p>
            </div>
            <div className="p-6">
              {appointments.length === 0 ? (
                <div className="text-center py-8">
                  <Calendar className="w-12 h-12 text-slate-400 mx-auto mb-4" />
                  <p className="text-slate-500">No appointments found</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {appointments.map((appointment) => (
                    <div key={appointment.id} className="border border-slate-200 rounded-lg p-4 hover:bg-slate-50 transition-colors">
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-2">
                            <h4 className="font-semibold text-slate-900">{appointment.appointmentType}</h4>
                            <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(appointment.status)}`}>
                              {getStatusIcon(appointment.status)}
                              {appointment.status}
                            </span>
                          </div>
                          <p className="text-sm text-slate-600 mb-1">
                            {formatDateTimeToDDMMYYYYHHMM(appointment.appointmentDate)}
                          </p>
                          <p className="text-sm text-slate-600">{appointment.reason}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-sm text-slate-500">Duration: {appointment.durationMinutes} min</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'medical-history' && (
          <div className="space-y-6">
            {/* Problems Section */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-indigo-100 rounded-lg">
                    <Activity className="w-5 h-5 text-indigo-600" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-slate-900">Problem List</h3>
                    <p className="text-sm text-slate-500">Active and resolved conditions</p>
                  </div>
                </div>
                <button
                  onClick={() => setShowProblemsModal(true)}
                  className="px-4 py-2 bg-indigo-50 text-indigo-700 rounded-lg hover:bg-indigo-100 transition-colors text-sm font-semibold flex items-center gap-2"
                >
                  <Edit className="w-4 h-4" /> Manage Problems
                </button>
              </div>

              {loadingHistory ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="w-8 h-8 text-indigo-500 animate-spin" />
                </div>
              ) : problems.length === 0 ? (
                <div className="text-center py-8 bg-slate-50 rounded-xl border border-dashed border-slate-200">
                  <Activity className="w-8 h-8 text-slate-400 mx-auto mb-2" />
                  <p className="text-slate-500">No problems recorded</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {problems.map((problem, index) => (
                    <div key={index} className="flex items-start justify-between p-4 bg-slate-50 rounded-xl border border-slate-100">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <h4 className="font-semibold text-slate-900">
                            {problem.snomedTerm || problem.description || problem.code}
                          </h4>
                          <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                            problem.status === 'active' 
                              ? 'bg-green-100 text-green-700' 
                              : 'bg-slate-200 text-slate-600'
                          }`}>
                            {problem.status}
                          </span>
                        </div>
                        {problem.onsetDate && (
                          <p className="text-sm text-slate-500">Onset: {formatDateToDDMMYYYY(problem.onsetDate)}</p>
                        )}
                        {problem.notes && (
                          <p className="text-sm text-slate-600 mt-2 bg-white p-2 rounded border border-slate-100">
                            {problem.notes}
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Allergies Section */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-rose-100 rounded-lg">
                    <AlertCircle className="w-5 h-5 text-rose-600" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-slate-900">Allergies</h3>
                    <p className="text-sm text-slate-500">Adverse reactions and intolerances</p>
                  </div>
                </div>
                <button
                  onClick={() => setShowAllergiesModal(true)}
                  className="px-4 py-2 bg-rose-50 text-rose-700 rounded-lg hover:bg-rose-100 transition-colors text-sm font-semibold flex items-center gap-2"
                >
                  <Edit className="w-4 h-4" /> Manage Allergies
                </button>
              </div>

              {loadingHistory ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="w-8 h-8 text-rose-500 animate-spin" />
                </div>
              ) : allergiesList.length === 0 ? (
                <div className="text-center py-8 bg-slate-50 rounded-xl border border-dashed border-slate-200">
                  <AlertCircle className="w-8 h-8 text-slate-400 mx-auto mb-2" />
                  <p className="text-slate-500">No allergies recorded</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {allergiesList.map((allergy, index) => (
                    <div key={index} className="flex items-start justify-between p-4 bg-slate-50 rounded-xl border border-slate-100">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <h4 className="font-semibold text-slate-900">
                            {allergy.allergenSnomedTerm || allergy.allergen || 'Unknown Allergen'}
                          </h4>
                          <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                            allergy.severity === 'severe' ? 'bg-red-100 text-red-700' :
                            allergy.severity === 'moderate' ? 'bg-orange-100 text-orange-700' :
                            'bg-blue-100 text-blue-700'
                          }`}>
                            {allergy.severity || 'mild'}
                          </span>
                        </div>
                        {(allergy.reactionSnomedTerm || allergy.reaction) && (
                          <p className="text-sm text-slate-600">
                            Reaction: {allergy.reactionSnomedTerm || allergy.reaction}
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* AI Guideline Search Modal */}
      {showGuidelineSearch && (
        <ModalPortal>
          <div className="fixed inset-0 z-[100] bg-black/70 backdrop-blur-md flex items-center justify-center p-4">
            <div className="w-full max-w-4xl max-h-[85vh] overflow-hidden bg-gradient-to-br from-white to-blue-50 rounded-3xl shadow-2xl border border-blue-200/50 flex flex-col animate-in fade-in zoom-in duration-200">
              <div className="sticky top-0 bg-gradient-to-r from-blue-600 to-indigo-700 px-6 py-5 flex items-center justify-between shrink-0">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-white/20 rounded-xl">
                    <BookOpen className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-white">Clinical Guidelines</h3>
                    <p className="text-sm text-blue-100">AI-powered medical protocols & research</p>
                  </div>
                </div>
                <button 
                  onClick={() => setShowGuidelineSearch(false)} 
                  className="p-2 rounded-lg hover:bg-white/20 text-white transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="p-6 overflow-y-auto flex-1 custom-scrollbar">
                <div className="flex gap-2 mb-6">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-blue-400" />
                    <input
                      type="text"
                      value={guidelineQuery}
                      onChange={(e) => setGuidelineQuery(e.target.value)}
                      onKeyPress={(e) => e.key === 'Enter' && handleGuidelineSearch()}
                      placeholder="Search for clinical guidelines, drug interactions, or treatment protocols..."
                      className="w-full pl-10 pr-4 py-3 bg-white border border-blue-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none shadow-sm text-slate-700 placeholder:text-slate-400"
                    />
                  </div>
                  <button
                    onClick={handleGuidelineSearch}
                    disabled={loadingGuidelines}
                    className="px-6 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl font-medium hover:from-blue-700 hover:to-indigo-700 transition-all shadow-md hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                  >
                    {loadingGuidelines ? (
                      <Loader2 className="w-5 h-5 animate-spin" />
                    ) : (
                      <>
                        <Sparkles className="w-5 h-5" />
                        <span>Search</span>
                      </>
                    )}
                  </button>
                </div>

                <div className="mb-6 bg-white border border-indigo-100 rounded-2xl p-5 shadow-sm">
                  <div className="flex items-center justify-between gap-3 mb-4">
                    <div>
                      <h4 className="text-base font-bold text-slate-900">Doctor CDSS Snapshot</h4>
                      <p className="text-xs text-slate-500">
                        Risk stratification + diagnosis support from current patient context
                      </p>
                    </div>
                    <button
                      onClick={runDoctorAiSnapshot}
                      disabled={loadingAiSnapshot}
                      className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-semibold hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                    >
                      {loadingAiSnapshot ? <Loader2 className="w-4 h-4 animate-spin" /> : <Brain className="w-4 h-4" />}
                      <span>{loadingAiSnapshot ? 'Analyzing...' : 'Run Snapshot'}</span>
                    </button>
                  </div>

                  {aiSnapshotAt && (
                    <p className="text-xs text-slate-500 mb-4">
                      Last analyzed: {formatDateTimeToDDMMYYYYHHMM(aiSnapshotAt)}
                    </p>
                  )}

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="border border-slate-200 rounded-xl p-4 bg-slate-50">
                      <div className="flex items-center justify-between mb-2">
                        <h5 className="text-sm font-semibold text-slate-800">Risk Insight</h5>
                        {aiRiskResult?.risk_level && (
                          <span className="text-xs px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 capitalize">
                            {String(aiRiskResult.risk_level).replace('_', ' ')}
                          </span>
                        )}
                      </div>
                      {typeof aiRiskResult?.overall_score === 'number' && (
                        <p className="text-xs text-slate-600 mb-2">Score: {aiRiskResult.overall_score.toFixed(1)}</p>
                      )}
                      {Array.isArray(aiRiskResult?.recommendations) && aiRiskResult.recommendations.length > 0 ? (
                        <ul className="space-y-1 text-xs text-slate-700">
                          {aiRiskResult.recommendations.slice(0, 3).map((item: any, idx: number) => (
                            <li key={`risk-rec-${idx}`}>
                              - {typeof item === 'string' ? item : item?.recommendation || 'Recommendation available'}
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <p className="text-xs text-slate-500">Run snapshot to load risk recommendations.</p>
                      )}
                    </div>

                    <div className="border border-slate-200 rounded-xl p-4 bg-slate-50">
                      <div className="flex items-center justify-between mb-2">
                        <h5 className="text-sm font-semibold text-slate-800">Diagnosis Assist</h5>
                        {aiDiagnosisResult?.abstained === true && (
                          <span className="text-xs px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">
                            Abstained
                          </span>
                        )}
                      </div>
                      {aiDiagnosisResult?.abstained === true && (
                        <p className="text-xs text-amber-700 mb-2">
                          Reason: {aiDiagnosisResult?.abstain_reason || 'unspecified'}
                        </p>
                      )}
                      {Array.isArray(aiDiagnosisResult?.suggested_diagnoses) && aiDiagnosisResult.suggested_diagnoses.length > 0 ? (
                        <ul className="space-y-1 text-xs text-slate-700">
                          {aiDiagnosisResult.suggested_diagnoses.slice(0, 3).map((item: any, idx: number) => (
                            <li key={`diag-${idx}`}>
                              - {item?.diagnosis || item?.name || 'Possible diagnosis'}
                              {typeof item?.probability === 'number' ? ` (${Math.round(item.probability * 100)}%)` : ''}
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <p className="text-xs text-slate-500">Run snapshot to load differential suggestions.</p>
                      )}
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  {guidelineResults.length > 0 ? (
                    guidelineResults.map((result, index) => (
                      <div key={index} className="bg-white border border-blue-100 rounded-xl p-5 shadow-sm hover:shadow-md transition-all duration-200 group">
                        <div className="flex items-start justify-between mb-3">
                          <h4 className="text-base font-bold text-slate-800 flex items-center gap-2 group-hover:text-blue-700 transition-colors">
                            <BookOpen className="w-4 h-4 text-blue-500" />
                            {result.source || 'Clinical Guideline'}
                          </h4>
                          {result.confidence && (
                            <span className={`text-xs font-bold px-2 py-1 rounded-lg border ${
                              result.confidence > 0.8 ? 'bg-green-50 text-green-700 border-green-200' :
                              result.confidence > 0.5 ? 'bg-yellow-50 text-yellow-700 border-yellow-200' :
                              'bg-red-50 text-red-700 border-red-200'
                            }`}>
                              {Math.round(result.confidence * 100)}% Confidence
                            </span>
                          )}
                        </div>
                        
                        <p className="text-slate-600 mb-4 leading-relaxed text-sm">{result.text}</p>
                        
                        {result.recommendation && (
                          <div className="p-4 bg-blue-50 border border-blue-100 rounded-xl mb-4">
                            <strong className="flex items-center gap-2 text-blue-800 mb-2 text-sm">
                              <Sparkles className="w-4 h-4 text-blue-600" />
                              Recommendation
                            </strong>
                            <p className="text-blue-900 text-sm">{result.recommendation}</p>
                          </div>
                        )}

                        {result.url && (
                          <a 
                            href={result.url} 
                            target="_blank" 
                            rel="noopener noreferrer" 
                            className="inline-flex items-center text-sm font-medium text-blue-600 hover:text-blue-800 hover:underline"
                          >
                            View Source Document <ArrowRight className="w-4 h-4 ml-1" />
                          </a>
                        )}
                      </div>
                    ))
                  ) : (
                    !loadingGuidelines && (
                      <div className="text-center py-12 bg-white/50 rounded-2xl border border-dashed border-slate-300">
                        <div className="bg-blue-50 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                          <Brain className="w-8 h-8 text-blue-500" />
                        </div>
                        <h3 className="text-lg font-semibold text-slate-900 mb-2">AI Clinical Assistant</h3>
                        <p className="text-slate-500 max-w-md mx-auto">
                          Search for guidelines, protocols, and medical research to assist with your diagnosis and treatment planning.
                        </p>
                      </div>
                    )
                  )}
                </div>
              </div>
            </div>
          </div>
        </ModalPortal>
      )}
      {/* Problems Modal */}
      <ProblemListModal
        open={showProblemsModal}
        onClose={() => setShowProblemsModal(false)}
        onSaved={() => {
          fetchMedicalHistory();
        }}
        appointment={{ patient: { id: patientId } }}
        tenantSlug={tenantSlug!}
        token={localStorage.getItem('ehr_token') || ''}
      />

      {/* Allergies Modal */}
      <AllergiesModal
        open={showAllergiesModal}
        onClose={() => setShowAllergiesModal(false)}
        onSaved={() => {
          fetchMedicalHistory();
        }}
        patientId={patientId}
        tenantSlug={tenantSlug!}
        token={localStorage.getItem('ehr_token') || ''}
      />
    </div>
  );
};

export default DoctorPatientDetail;
