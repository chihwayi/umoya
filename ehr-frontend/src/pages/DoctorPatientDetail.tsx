import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  ArrowLeft, User, Calendar, Phone, Mail, MapPin, 
  Heart, Activity, AlertCircle, FileText, Clock,
  ChevronLeft, ChevronRight, Stethoscope, Pill, TestTube,
  Brain, BookOpen, Search, Sparkles, X, Loader2, ArrowRight
} from 'lucide-react';
import { ehrApi, cdssApi } from '../services/api';
import { useNotification } from '../components/GlobalNotification';
import { formatDateToDDMMYYYY, formatDateTimeToDDMMYYYYHHMM } from '../utils/dateFormatting';
import { GuidelineResult } from '../types/guidelines';
import ModalPortal from '../components/ModalPortal';

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

  useEffect(() => {
    if (patientId) {
      fetchPatientDetails();
      fetchPatientAppointments();
    }
  }, [patientId]);

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

      const response = await cdssApi.searchGuidelines(guidelineQuery, token, tenantSlug);
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
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
            <h3 className="text-lg font-semibold text-slate-900 mb-4">Medical History</h3>
            <div className="text-center py-8">
              <FileText className="w-12 h-12 text-slate-400 mx-auto mb-4" />
              <p className="text-slate-500">Medical history feature coming soon</p>
            </div>
          </div>
        )}
      </div>

      {/* AI Guideline Assistant Sidebar */}
      {showGuidelineSearch && (
        <div className="fixed inset-y-0 right-0 w-96 bg-white shadow-2xl transform transition-transform duration-300 ease-in-out z-50 border-l border-slate-200 flex flex-col">
          <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-gradient-to-r from-purple-50 to-white">
            <div className="flex items-center gap-2 text-purple-700">
              <Sparkles className="w-5 h-5" />
              <h3 className="font-semibold">Clinical Intelligence</h3>
            </div>
            <button 
              onClick={() => setShowGuidelineSearch(false)}
              className="p-1 hover:bg-slate-100 rounded-full text-slate-400 hover:text-slate-600 transition-colors"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>
          
          <div className="p-4 flex-1 overflow-y-auto bg-slate-50/50">
            <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 mb-6">
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Search Guidelines & Protocols
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={guidelineQuery}
                  onChange={(e) => setGuidelineQuery(e.target.value)}
                  placeholder="e.g. hypertension treatment..."
                  className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  onKeyPress={(e) => e.key === 'Enter' && handleGuidelineSearch()}
                />
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
              </div>
              <button
                onClick={handleGuidelineSearch}
                disabled={loadingGuidelines}
                className="mt-3 w-full bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {loadingGuidelines ? (
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <>
                    <BookOpen className="w-4 h-4" />
                    <span>Search Guidelines</span>
                  </>
                )}
              </button>
            </div>

            <div className="space-y-4">
              {guidelineResults.map((result, index) => (
                <div key={index} className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 hover:shadow-md transition-shadow">
                  <div className="flex items-start gap-3">
                    <div className="p-2 bg-purple-50 rounded-lg shrink-0">
                      <BookOpen className="w-4 h-4 text-purple-600" />
                    </div>
                    <div>
                      <h4 className="text-sm font-semibold text-slate-900 mb-1">
                        {result.source || 'Clinical Guideline'}
                      </h4>
                      <p className="text-sm text-slate-600 leading-relaxed">
                        {result.text}
                      </p>
                      {result.url && (
                        <a 
                          href={result.url} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="text-xs text-purple-600 hover:underline mt-2 inline-block"
                        >
                          View Source
                        </a>
                      )}
                    </div>
                  </div>
                </div>
              ))}
              
              {guidelineResults.length === 0 && !loadingGuidelines && guidelineQuery && (
                 <div className="text-center py-8 text-slate-500">
                   <p>No guidelines found for your search.</p>
                 </div>
              )}
            </div>
          </div>
        </div>
      )}
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
    </div>
  );
};

export default DoctorPatientDetail;
