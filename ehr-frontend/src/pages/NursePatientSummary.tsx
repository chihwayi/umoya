import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft, User, Calendar, Clock, FileText, Heart, Activity, 
  Stethoscope, Pill, AlertTriangle, ChevronRight, Calendar as CalendarIcon,
  Thermometer, Droplets, Eye, Activity as ActivityIcon
} from 'lucide-react';
import { useNotification } from '../components/GlobalNotification.tsx';
import { ehrApi } from '../services/api.ts';
import { formatDateTimeToDDMMYYYYHHMM, formatDateToDDMMYYYY } from '../utils/dateFormatting';

interface Patient {
  id: string;
  patientNumber: string;
  firstName: string;
  lastName: string;
  dateOfBirth: string;
  gender: string;
  phone: string;
  email?: string;
  address: string;
  city: string;
  emergencyContactName: string;
  emergencyContactPhone: string;
  medicalAidName?: string;
  medicalAidNumber?: string;
  bloodType?: string;
  allergies?: string;
  chronicConditions?: string;
  age: number;
}

interface Appointment {
  id: string;
  appointmentDate: string;
  appointmentType: string;
  status: string;
  reason?: string;
  notes?: string;
  doctor: {
    id: string;
    firstName: string;
    lastName: string;
  };
  vitals?: any;
}

interface PatientVitals {
  id: string;
  bloodPressure: string;
  heartRate: number;
  temperature: number;
  oxygenSaturation: number;
  respiratoryRate: number;
  weight: number;
  height: number;
  bmi: number;
  painLevel: number;
  bloodGlucose: number;
  notes: string;
  recordedAt: string;
  recordedBy: string;
}

interface NursingNote {
  id: string;
  noteType: string;
  content: string;
  vitalSigns?: string;
  medications?: string;
  observations?: string;
  interventions?: string;
  outcomes?: string;
  recordedAt: string;
  recordedBy: string;
}

interface TriageAssessment {
  id: string;
  chiefComplaint: string;
  priority: string;
  painScore: number;
  severityScore: number;
  recordedAt: string;
  recordedBy: string;
}

interface VisitSummary {
  date: string;
  appointment: Appointment;
  vitals?: PatientVitals;
  nursingNotes: NursingNote[];
  triageAssessment?: TriageAssessment;
}

const NursePatientSummary: React.FC = () => {
  const { tenantSlug, patientId } = useParams<{ tenantSlug: string; patientId: string }>();
  const navigate = useNavigate();
  const { showError } = useNotification();
  
  const [patient, setPatient] = useState<Patient | null>(null);
  const [visitSummaries, setVisitSummaries] = useState<VisitSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'overview' | 'visits' | 'notes' | 'vitals'>('overview');
  
  // Pagination and filtering states
  const [vitalsPage, setVitalsPage] = useState(1);
  const [notesPage, setNotesPage] = useState(1);
  const [vitalsPerPage] = useState(5);
  const [notesPerPage] = useState(10);
  const [vitalsSearchTerm, setVitalsSearchTerm] = useState('');
  const [notesSearchTerm, setNotesSearchTerm] = useState('');
  const [vitalsSortBy, setVitalsSortBy] = useState<'date' | 'type'>('date');
  const [notesSortBy, setNotesSortBy] = useState<'date' | 'type'>('date');
  const [vitalsSortOrder, setVitalsSortOrder] = useState<'asc' | 'desc'>('desc');
  const [notesSortOrder, setNotesSortOrder] = useState<'asc' | 'desc'>('desc');

  useEffect(() => {
    if (patientId) {
      fetchPatientDetails();
      fetchPatientHistory();
    }
  }, [patientId]);

  const fetchPatientDetails = async () => {
    try {
      const token = localStorage.getItem('ehr_token');
      if (!token) return;

      const response = await ehrApi.getPatientById(patientId!, token, tenantSlug!);
      const patientData = response.data;
      
      // Calculate age
      const today = new Date();
      const birthDate = new Date(patientData.dateOfBirth);
      let age = today.getFullYear() - birthDate.getFullYear();
      const monthDiff = today.getMonth() - birthDate.getMonth();
      
      if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
        age--;
      }
      
      setPatient({ ...patientData, age });
    } catch (error) {
      console.error('Error fetching patient details:', error);
      showError('Error', 'Failed to fetch patient details');
    }
  };

  const fetchPatientHistory = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('ehr_token');
      if (!token) return;

      // Fetch appointments
      const appointmentsResponse = await ehrApi.getAppointments(token, tenantSlug!);
      const allAppointments = appointmentsResponse.data.appointments || [];
      const patientAppointments = allAppointments.filter(
        (apt: any) => apt.patient.id === patientId
      );
      
      console.log('🔍 NursePatientSummary - All appointments:', allAppointments.length);
      console.log('🔍 NursePatientSummary - Patient appointments:', patientAppointments.length);

      // Fetch vitals for the patient
      let allVitals: any[] = [];
      try {
        const vitalsResponse = await ehrApi.getVitals(patientId!, token, tenantSlug!);
        allVitals = vitalsResponse.data.vitals || [];
      } catch (error) {
        console.log('No vitals found for patient:', error);
        allVitals = [];
      }

      // Fetch nursing notes
      let nursingNotes: any[] = [];
      try {
        const notesResponse = await ehrApi.getNursingNotes(patientId!, token, tenantSlug!);
        console.log('🔍 NursePatientSummary - Nursing notes response:', notesResponse);
        nursingNotes = notesResponse.data.notes || [];
        console.log('🔍 NursePatientSummary - Nursing notes extracted:', nursingNotes);
      } catch (error) {
        console.log('No nursing notes found for patient:', error);
        nursingNotes = [];
      }

      // Fetch triage assessments
      let triageAssessments: any[] = [];
      try {
        const triageResponse = await ehrApi.getTriageAssessments(patientId!, token, tenantSlug!);
        console.log('🔍 NursePatientSummary - Triage response:', triageResponse);
        triageAssessments = triageResponse.data.triageAssessments || [];
        console.log('🔍 NursePatientSummary - Triage extracted:', triageAssessments);
      } catch (error) {
        console.log('No triage assessments found for patient:', error);
        triageAssessments = [];
      }

      // Group data by visit date
      const visitMap = new Map<string, VisitSummary>();
      
      patientAppointments.forEach((apt: any) => {
        const visitDate = new Date(apt.appointmentDate).toDateString();
        if (!visitMap.has(visitDate)) {
          visitMap.set(visitDate, {
            date: visitDate,
            appointment: apt,
            nursingNotes: [],
            vitals: undefined,
            triageAssessment: undefined
          });
        }
      });

      // Add nursing notes to visits
      nursingNotes.forEach((note: any) => {
        const noteDate = new Date(note.recordedAt).toDateString();
        if (visitMap.has(noteDate)) {
          visitMap.get(noteDate)!.nursingNotes.push(note);
        }
      });

      // Add triage assessments to visits
      triageAssessments.forEach((triage: any) => {
        const triageDate = new Date(triage.recordedAt).toDateString();
        if (visitMap.has(triageDate)) {
          visitMap.get(triageDate)!.triageAssessment = triage;
        }
      });

      // Add vitals to visits (match by date)
      allVitals.forEach((vital: any) => {
        const vitalDate = new Date(vital.recordedAt).toDateString();
        if (visitMap.has(vitalDate)) {
          visitMap.get(vitalDate)!.vitals = vital;
        }
      });

      // Sort visits by date (most recent first)
      const sortedVisits = Array.from(visitMap.values()).sort((a, b) => 
        new Date(b.date).getTime() - new Date(a.date).getTime()
      );

      console.log('🔍 NursePatientSummary - Vitals found:', allVitals.length);
      console.log('🔍 NursePatientSummary - Nursing notes found:', nursingNotes.length);
      console.log('🔍 NursePatientSummary - Triage assessments found:', triageAssessments.length);
      console.log('🔍 NursePatientSummary - Visit summaries created:', sortedVisits.length);

      setVisitSummaries(sortedVisits);
    } catch (error) {
      console.error('Error fetching patient history:', error);
      showError('Error', 'Failed to fetch patient history');
    } finally {
      setLoading(false);
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'urgent': return 'bg-red-100 text-red-800 border-red-200';
      case 'high': return 'bg-orange-100 text-orange-800 border-orange-200';
      case 'normal': return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'low': return 'bg-green-100 text-green-800 border-green-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'bg-green-100 text-green-800 border-green-200';
      case 'in-progress': return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'confirmed': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'scheduled': return 'bg-gray-100 text-gray-800 border-gray-200';
      case 'cancelled': return 'bg-red-100 text-red-800 border-red-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getNoteTypeIcon = (type: string) => {
    switch (type) {
      case 'assessment': return <Stethoscope className="w-4 h-4" />;
      case 'intervention': return <Activity className="w-4 h-4" />;
      case 'evaluation': return <Heart className="w-4 h-4" />;
      default: return <FileText className="w-4 h-4" />;
    }
  };

  const getNoteTypeColor = (type: string) => {
    switch (type) {
      case 'assessment': return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'intervention': return 'bg-green-100 text-green-800 border-green-200';
      case 'evaluation': return 'bg-purple-100 text-purple-800 border-purple-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  // Helper functions for filtering and pagination
  const getFilteredAndSortedVitals = () => {
    let vitals = visitSummaries.filter(visit => visit.vitals);
    
    // Sort vitals
    vitals.sort((a, b) => {
      let comparison = 0;
      if (vitalsSortBy === 'date') {
        comparison = new Date(a.date).getTime() - new Date(b.date).getTime();
      }
      return vitalsSortOrder === 'asc' ? comparison : -comparison;
    });
    
    return vitals;
  };

  const getFilteredAndSortedNotes = () => {
    let allNotes = visitSummaries.flatMap(visit => 
      visit.nursingNotes.map(note => ({ ...note, visitDate: visit.date }))
    );
    
    // Filter by search term
    if (notesSearchTerm) {
      allNotes = allNotes.filter(note => 
        note.content.toLowerCase().includes(notesSearchTerm.toLowerCase()) ||
        note.noteType.toLowerCase().includes(notesSearchTerm.toLowerCase()) ||
        (note.observations && note.observations.toLowerCase().includes(notesSearchTerm.toLowerCase())) ||
        (note.interventions && note.interventions.toLowerCase().includes(notesSearchTerm.toLowerCase()))
      );
    }
    
    // Sort notes
    allNotes.sort((a, b) => {
      let comparison = 0;
      if (notesSortBy === 'date') {
        comparison = new Date(a.recordedAt).getTime() - new Date(b.recordedAt).getTime();
      } else if (notesSortBy === 'type') {
        comparison = a.noteType.localeCompare(b.noteType);
      }
      return notesSortOrder === 'asc' ? comparison : -comparison;
    });
    
    return allNotes;
  };

  const getPaginatedVitals = () => {
    const filteredVitals = getFilteredAndSortedVitals();
    const startIndex = (vitalsPage - 1) * vitalsPerPage;
    const endIndex = startIndex + vitalsPerPage;
    return {
      data: filteredVitals.slice(startIndex, endIndex),
      total: filteredVitals.length,
      totalPages: Math.ceil(filteredVitals.length / vitalsPerPage)
    };
  };

  const getPaginatedNotes = () => {
    const filteredNotes = getFilteredAndSortedNotes();
    const startIndex = (notesPage - 1) * notesPerPage;
    const endIndex = startIndex + notesPerPage;
    return {
      data: filteredNotes.slice(startIndex, endIndex),
      total: filteredNotes.length,
      totalPages: Math.ceil(filteredNotes.length / notesPerPage)
    };
  };

  // Reset pagination when switching tabs
  useEffect(() => {
    setVitalsPage(1);
    setNotesPage(1);
    setVitalsSearchTerm('');
    setNotesSearchTerm('');
  }, [activeTab]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-4 border-pink-500 border-t-transparent mx-auto mb-4"></div>
          <p className="text-slate-600">Loading patient summary...</p>
        </div>
      </div>
    );
  }

  if (!patient) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 flex items-center justify-center">
        <div className="text-center">
          <User className="w-16 h-16 text-slate-400 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-slate-600 mb-2">Patient Not Found</h2>
          <p className="text-slate-500 mb-4">The requested patient could not be found.</p>
          <button
            onClick={() => navigate(`/ehr/${tenantSlug}/nurse`)}
            className="px-6 py-3 bg-gradient-to-r from-pink-500 to-rose-600 text-white rounded-xl hover:from-pink-600 hover:to-rose-700 transition-all duration-200 font-semibold"
          >
            Back to Dashboard
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50">
      {/* Header */}
      <div className="bg-white/80 backdrop-blur-sm shadow-lg border-b border-slate-200/50 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-20">
            <div className="flex items-center gap-4">
              <button
                onClick={() => navigate(`/ehr/${tenantSlug}/nurse`)}
                className="p-2 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-all duration-200"
              >
                <ArrowLeft className="w-6 h-6" />
              </button>
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-gradient-to-br from-pink-500 to-rose-600 rounded-xl flex items-center justify-center text-white font-bold text-lg">
                  {patient.firstName.charAt(0)}{patient.lastName.charAt(0)}
                </div>
                <div>
                  <h1 className="text-2xl font-bold text-slate-900">
                    {patient.firstName} {patient.lastName}
                  </h1>
                  <p className="text-slate-600">Patient ID: {patient.patientNumber}</p>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <div className="text-right">
                <p className="text-sm text-slate-600">Age: {patient.age} years</p>
                <p className="text-sm text-slate-600 capitalize">{patient.gender}</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Navigation Tabs */}
        <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-lg border border-slate-200/50 mb-8">
          <div className="flex border-b border-slate-200/50">
            {[
              { id: 'overview', label: 'Overview', icon: User },
              { id: 'visits', label: 'Visit History', icon: Calendar },
              { id: 'notes', label: 'Nursing Notes', icon: FileText },
              { id: 'vitals', label: 'Vital Signs', icon: Heart }
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`flex-1 flex items-center justify-center gap-2 px-6 py-4 font-semibold transition-all duration-200 ${
                  activeTab === tab.id
                    ? 'text-pink-600 border-b-2 border-pink-500 bg-pink-50/50'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50/50'
                }`}
              >
                <tab.icon className="w-5 h-5" />
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Content */}
        <div className="space-y-8">
          {activeTab === 'overview' && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              {/* Patient Info */}
              <div className="lg:col-span-2 space-y-6">
                <div className="bg-gradient-to-br from-white to-slate-50 rounded-2xl shadow-lg border border-slate-200/50 p-8">
                  <h3 className="text-xl font-bold text-slate-900 mb-6 flex items-center gap-3">
                    <User className="w-6 h-6 text-pink-600" />
                    Personal Information
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <label className="block text-sm font-semibold text-slate-700 mb-2">Contact Information</label>
                      <div className="space-y-2">
                        <p className="text-slate-600">📞 {patient.phone}</p>
                        {patient.email && <p className="text-slate-600">✉️ {patient.email}</p>}
                        <p className="text-slate-600">📍 {patient.address}, {patient.city}</p>
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-slate-700 mb-2">Emergency Contact</label>
                      <div className="space-y-2">
                        <p className="text-slate-600">👤 {patient.emergencyContactName}</p>
                        <p className="text-slate-600">📞 {patient.emergencyContactPhone}</p>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="bg-gradient-to-br from-white to-slate-50 rounded-2xl shadow-lg border border-slate-200/50 p-8">
                  <h3 className="text-xl font-bold text-slate-900 mb-6 flex items-center gap-3">
                    <Heart className="w-6 h-6 text-pink-600" />
                    Medical Information
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {patient.allergies && (
                      <div>
                        <label className="block text-sm font-semibold text-slate-700 mb-2 flex items-center gap-2">
                          <AlertTriangle className="w-4 h-4 text-amber-500" />
                          Allergies
                        </label>
                        <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg">
                          <p className="text-slate-800">{patient.allergies}</p>
                        </div>
                      </div>
                    )}
                    {patient.chronicConditions && (
                      <div>
                        <label className="block text-sm font-semibold text-slate-700 mb-2">Chronic Conditions</label>
                        <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg">
                          <p className="text-slate-800">{patient.chronicConditions}</p>
                        </div>
                      </div>
                    )}
                    {patient.bloodType && (
                      <div>
                        <label className="block text-sm font-semibold text-slate-700 mb-2">Blood Type</label>
                        <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                          <p className="text-slate-800 font-semibold">{patient.bloodType}</p>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Quick Stats */}
              <div className="space-y-6">
                <div className="bg-gradient-to-br from-white to-slate-50 rounded-2xl shadow-lg border border-slate-200/50 p-6">
                  <h3 className="text-lg font-bold text-slate-900 mb-4">Visit Summary</h3>
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <span className="text-slate-600">Total Visits</span>
                      <span className="font-semibold text-slate-900">{visitSummaries.length}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-600">Last Visit</span>
                      <span className="font-semibold text-slate-900">
                        {visitSummaries.length > 0 ? formatDateToDDMMYYYY(visitSummaries[0].date) : 'N/A'}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="bg-gradient-to-br from-white to-slate-50 rounded-2xl shadow-lg border border-slate-200/50 p-6">
                  <h3 className="text-lg font-bold text-slate-900 mb-4">Quick Actions</h3>
                  <div className="space-y-3">
                    <button
                      onClick={() => setActiveTab('visits')}
                      className="w-full flex items-center gap-3 p-3 bg-pink-50 hover:bg-pink-100 rounded-lg transition-all duration-200 text-left"
                    >
                      <Calendar className="w-5 h-5 text-pink-600" />
                      <span className="font-semibold text-slate-900">View Visit History</span>
                    </button>
                    <button
                      onClick={() => setActiveTab('notes')}
                      className="w-full flex items-center gap-3 p-3 bg-blue-50 hover:bg-blue-100 rounded-lg transition-all duration-200 text-left"
                    >
                      <FileText className="w-5 h-5 text-blue-600" />
                      <span className="font-semibold text-slate-900">View Nursing Notes</span>
                    </button>
                    <button
                      onClick={() => setActiveTab('vitals')}
                      className="w-full flex items-center gap-3 p-3 bg-green-50 hover:bg-green-100 rounded-lg transition-all duration-200 text-left"
                    >
                      <Heart className="w-5 h-5 text-green-600" />
                      <span className="font-semibold text-slate-900">View Vital Signs</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'visits' && (
            <div className="space-y-6">
              <div className="bg-gradient-to-br from-white to-slate-50 rounded-2xl shadow-lg border border-slate-200/50 p-8">
                <h3 className="text-xl font-bold text-slate-900 mb-6 flex items-center gap-3">
                  <Calendar className="w-6 h-6 text-pink-600" />
                  Visit History
                </h3>
                {visitSummaries.length === 0 ? (
                  <div className="text-center py-12">
                    <Calendar className="w-16 h-16 text-slate-300 mx-auto mb-4" />
                    <h4 className="text-lg font-semibold text-slate-600 mb-2">No Visits Found</h4>
                    <p className="text-slate-500">This patient has no recorded visits yet.</p>
                  </div>
                ) : (
                  <div className="space-y-6">
                    {visitSummaries.map((visit, index) => (
                      <div key={index} className="bg-white rounded-xl p-6 border border-slate-200 hover:shadow-md transition-all duration-200">
                        <div className="flex items-start justify-between mb-4">
                          <div className="flex items-center gap-4">
                            <div className="w-12 h-12 bg-gradient-to-br from-pink-500 to-rose-600 rounded-xl flex items-center justify-center text-white font-bold">
                              {new Date(visit.date).getDate()}
                            </div>
                            <div>
                              <h4 className="text-lg font-semibold text-slate-900">
                                {formatDateToDDMMYYYY(visit.date)}
                              </h4>
                              <p className="text-slate-600">
                                {visit.appointment.appointmentType} • Dr. {visit.appointment.doctor.firstName} {visit.appointment.doctor.lastName}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className={`px-3 py-1 rounded-full text-xs font-semibold border ${getStatusColor(visit.appointment.status)}`}>
                              {visit.appointment.status}
                            </span>
                          </div>
                        </div>

                        {visit.appointment.reason && (
                          <div className="mb-4">
                            <label className="block text-sm font-semibold text-slate-700 mb-2">Reason for Visit</label>
                            <p className="text-slate-600">{visit.appointment.reason}</p>
                          </div>
                        )}

                        {visit.triageAssessment && (
                          <div className="mb-4 p-4 bg-orange-50 border border-orange-200 rounded-lg">
                            <h5 className="font-semibold text-slate-900 mb-2 flex items-center gap-2">
                              <Activity className="w-4 h-4 text-orange-600" />
                              Triage Assessment
                            </h5>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                              <div>
                                <span className="font-semibold text-slate-700">Chief Complaint:</span>
                                <p className="text-slate-600">{visit.triageAssessment.chiefComplaint}</p>
                              </div>
                              <div>
                                <span className="font-semibold text-slate-700">Priority:</span>
                                <span className={`ml-2 px-2 py-1 rounded-full text-xs font-semibold ${getPriorityColor(visit.triageAssessment.priority)}`}>
                                  {visit.triageAssessment.priority}
                                </span>
                              </div>
                              <div>
                                <span className="font-semibold text-slate-700">Pain Score:</span>
                                <p className="text-slate-600">{visit.triageAssessment.painScore}/10</p>
                              </div>
                            </div>
                          </div>
                        )}

                        {visit.nursingNotes.length > 0 && (
                          <div className="mb-4">
                            <h5 className="font-semibold text-slate-900 mb-3 flex items-center gap-2">
                              <FileText className="w-4 h-4 text-blue-600" />
                              Nursing Notes ({visit.nursingNotes.length})
                            </h5>
                            <div className="space-y-3">
                              {visit.nursingNotes.map((note) => (
                                <div key={note.id} className="bg-slate-50 rounded-lg p-4">
                                  <div className="flex items-center gap-2 mb-2">
                                    <div className={`p-1 rounded ${getNoteTypeColor(note.noteType)}`}>
                                      {getNoteTypeIcon(note.noteType)}
                                    </div>
                                    <span className="text-sm font-semibold text-slate-700 capitalize">{note.noteType}</span>
                                    <span className="text-xs text-slate-500">
                                      {formatDateTimeToDDMMYYYYHHMM(note.recordedAt)}
                                    </span>
                                  </div>
                                  <p className="text-slate-600 text-sm">{note.content}</p>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {visit.appointment.notes && (
                          <div className="mb-4">
                            <h5 className="font-semibold text-slate-900 mb-2">Doctor's Notes</h5>
                            <p className="text-slate-600">{visit.appointment.notes}</p>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === 'notes' && (
            <div className="space-y-6">
              <div className="bg-gradient-to-br from-white to-slate-50 rounded-2xl shadow-lg border border-slate-200/50 p-8">
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-xl font-bold text-slate-900 flex items-center gap-3">
                    <FileText className="w-6 h-6 text-pink-600" />
                    All Nursing Notes
                  </h3>
                  <div className="text-sm text-slate-600">
                    {getPaginatedNotes().total} notes found
                  </div>
                </div>

                {/* Controls */}
                <div className="flex flex-col sm:flex-row gap-4 mb-6">
                  <div className="flex-1">
                    <input
                      type="text"
                      placeholder="Search notes..."
                      value={notesSearchTerm}
                      onChange={(e) => setNotesSearchTerm(e.target.value)}
                      className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-pink-500 focus:border-transparent"
                    />
                  </div>
                  <div className="flex gap-2">
                    <select
                      value={notesSortBy}
                      onChange={(e) => setNotesSortBy(e.target.value as 'date' | 'type')}
                      className="px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-pink-500 focus:border-transparent"
                    >
                      <option value="date">Sort by Date</option>
                      <option value="type">Sort by Type</option>
                    </select>
                    <button
                      onClick={() => setNotesSortOrder(notesSortOrder === 'asc' ? 'desc' : 'asc')}
                      className="px-3 py-2 border border-slate-300 rounded-lg hover:bg-slate-50 focus:ring-2 focus:ring-pink-500 focus:border-transparent"
                    >
                      {notesSortOrder === 'asc' ? '↑' : '↓'}
                    </button>
                  </div>
                </div>

                {getPaginatedNotes().total === 0 ? (
                  <div className="text-center py-12">
                    <FileText className="w-16 h-16 text-slate-300 mx-auto mb-4" />
                    <h4 className="text-lg font-semibold text-slate-600 mb-2">No Nursing Notes</h4>
                    <p className="text-slate-500">No nursing notes have been recorded for this patient.</p>
                  </div>
                ) : (
                  <div className="space-y-6">
                    {getPaginatedNotes().data.map((note) => (
                      <div key={note.id} className="bg-white rounded-xl p-6 border border-slate-200 hover:shadow-md transition-all duration-200">
                        <div className="flex items-start justify-between mb-4">
                          <div className="flex items-center gap-3">
                            <div className={`p-2 rounded-xl border ${getNoteTypeColor(note.noteType)}`}>
                              {getNoteTypeIcon(note.noteType)}
                            </div>
                            <div>
                              <h4 className="text-lg font-semibold text-slate-900 capitalize">{note.noteType} Note</h4>
                              <p className="text-sm text-slate-600">
                                {formatDateTimeToDDMMYYYYHHMM(note.recordedAt)}
                              </p>
                              {note.visitDate && (
                                <p className="text-xs text-slate-500">
                                  Visit: {formatDateToDDMMYYYY(note.visitDate)}
                                </p>
                              )}
                            </div>
                          </div>
                        </div>

                        <div className="space-y-4">
                          {note.content && (
                            <div>
                              <h5 className="text-sm font-semibold text-slate-700 mb-2">Content</h5>
                              <p className="text-slate-600">{note.content}</p>
                            </div>
                          )}

                          {note.observations && (
                            <div>
                              <h5 className="text-sm font-semibold text-slate-700 mb-2">Observations</h5>
                              <p className="text-slate-600">{note.observations}</p>
                            </div>
                          )}

                          {note.interventions && (
                            <div>
                              <h5 className="text-sm font-semibold text-slate-700 mb-2">Interventions</h5>
                              <p className="text-slate-600">{note.interventions}</p>
                            </div>
                          )}

                          {note.outcomes && (
                            <div>
                              <h5 className="text-sm font-semibold text-slate-700 mb-2">Outcomes</h5>
                              <p className="text-slate-600">{note.outcomes}</p>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Pagination */}
                {getPaginatedNotes().totalPages > 1 && (
                  <div className="flex items-center justify-between mt-8 pt-6 border-t border-slate-200">
                    <div className="text-sm text-slate-600">
                      Showing {((notesPage - 1) * notesPerPage) + 1} to {Math.min(notesPage * notesPerPage, getPaginatedNotes().total)} of {getPaginatedNotes().total} notes
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setNotesPage(Math.max(1, notesPage - 1))}
                        disabled={notesPage === 1}
                        className="px-3 py-2 border border-slate-300 rounded-lg hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        Previous
                      </button>
                      {Array.from({ length: getPaginatedNotes().totalPages }, (_, i) => i + 1).map(page => (
                        <button
                          key={page}
                          onClick={() => setNotesPage(page)}
                          className={`px-3 py-2 border rounded-lg ${
                            page === notesPage
                              ? 'bg-pink-500 text-white border-pink-500'
                              : 'border-slate-300 hover:bg-slate-50'
                          }`}
                        >
                          {page}
                        </button>
                      ))}
                      <button
                        onClick={() => setNotesPage(Math.min(getPaginatedNotes().totalPages, notesPage + 1))}
                        disabled={notesPage === getPaginatedNotes().totalPages}
                        className="px-3 py-2 border border-slate-300 rounded-lg hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        Next
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === 'vitals' && (
            <div className="space-y-6">
              <div className="bg-gradient-to-br from-white to-slate-50 rounded-2xl shadow-lg border border-slate-200/50 p-8">
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-xl font-bold text-slate-900 flex items-center gap-3">
                    <Heart className="w-6 h-6 text-pink-600" />
                    Vital Signs History
                  </h3>
                  <div className="text-sm text-slate-600">
                    {getPaginatedVitals().total} records found
                  </div>
                </div>

                {/* Controls */}
                <div className="flex flex-col sm:flex-row gap-4 mb-6">
                  <div className="flex-1">
                    <input
                      type="text"
                      placeholder="Search vitals..."
                      value={vitalsSearchTerm}
                      onChange={(e) => setVitalsSearchTerm(e.target.value)}
                      className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-pink-500 focus:border-transparent"
                    />
                  </div>
                  <div className="flex gap-2">
                    <select
                      value={vitalsSortBy}
                      onChange={(e) => setVitalsSortBy(e.target.value as 'date' | 'type')}
                      className="px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-pink-500 focus:border-transparent"
                    >
                      <option value="date">Sort by Date</option>
                    </select>
                    <button
                      onClick={() => setVitalsSortOrder(vitalsSortOrder === 'asc' ? 'desc' : 'asc')}
                      className="px-3 py-2 border border-slate-300 rounded-lg hover:bg-slate-50 focus:ring-2 focus:ring-pink-500 focus:border-transparent"
                    >
                      {vitalsSortOrder === 'asc' ? '↑' : '↓'}
                    </button>
                  </div>
                </div>

                {getPaginatedVitals().total === 0 ? (
                  <div className="text-center py-12">
                    <Heart className="w-16 h-16 text-slate-300 mx-auto mb-4" />
                    <h4 className="text-lg font-semibold text-slate-600 mb-2">No Vital Signs Recorded</h4>
                    <p className="text-slate-500">No vital signs have been recorded for this patient yet.</p>
                  </div>
                ) : (
                  <div className="space-y-6">
                    {getPaginatedVitals().data.map((visit, index) => (
                        <div key={index} className="bg-white rounded-xl p-6 border border-slate-200 hover:shadow-md transition-all duration-200">
                          <div className="flex items-start justify-between mb-4">
                            <div className="flex items-center gap-4">
                              <div className="w-12 h-12 bg-gradient-to-br from-green-500 to-emerald-600 rounded-xl flex items-center justify-center text-white font-bold">
                                {new Date(visit.date).getDate()}
                              </div>
                              <div>
                                <h4 className="text-lg font-semibold text-slate-900">
                                  {formatDateToDDMMYYYY(visit.date)}
                                </h4>
                                <p className="text-slate-600">
                                  {formatDateTimeToDDMMYYYYHHMM(visit.vitals!.recordedAt)}
                                </p>
                              </div>
                            </div>
                            <div className="text-right">
                              <p className="text-sm text-slate-600">Recorded by</p>
                              <p className="font-semibold text-slate-900">{visit.vitals!.recordedBy}</p>
                            </div>
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                            {/* Blood Pressure */}
                            <div className="bg-red-50 rounded-lg p-4 border border-red-200">
                              <div className="flex items-center gap-2 mb-2">
                                <Droplets className="w-5 h-5 text-red-600" />
                                <h5 className="font-semibold text-red-800">Blood Pressure</h5>
                              </div>
                              <p className="text-2xl font-bold text-red-900">{visit.vitals!.bloodPressure}</p>
                              <p className="text-sm text-red-700">mmHg</p>
                            </div>

                            {/* Heart Rate */}
                            <div className="bg-pink-50 rounded-lg p-4 border border-pink-200">
                              <div className="flex items-center gap-2 mb-2">
                                <Activity className="w-5 h-5 text-pink-600" />
                                <h5 className="font-semibold text-pink-800">Heart Rate</h5>
                              </div>
                              <p className="text-2xl font-bold text-pink-900">{visit.vitals!.heartRate}</p>
                              <p className="text-sm text-pink-700">bpm</p>
                            </div>

                            {/* Temperature */}
                            <div className="bg-orange-50 rounded-lg p-4 border border-orange-200">
                              <div className="flex items-center gap-2 mb-2">
                                <Thermometer className="w-5 h-5 text-orange-600" />
                                <h5 className="font-semibold text-orange-800">Temperature</h5>
                              </div>
                              <p className="text-2xl font-bold text-orange-900">{visit.vitals!.temperature}°C</p>
                              <p className="text-sm text-orange-700">Celsius</p>
                            </div>

                            {/* Oxygen Saturation */}
                            <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
                              <div className="flex items-center gap-2 mb-2">
                                <Eye className="w-5 h-5 text-blue-600" />
                                <h5 className="font-semibold text-blue-800">Oxygen Sat</h5>
                              </div>
                              <p className="text-2xl font-bold text-blue-900">{visit.vitals!.oxygenSaturation}%</p>
                              <p className="text-sm text-blue-700">SpO2</p>
                            </div>

                            {/* Respiratory Rate */}
                            <div className="bg-cyan-50 rounded-lg p-4 border border-cyan-200">
                              <div className="flex items-center gap-2 mb-2">
                                <ActivityIcon className="w-5 h-5 text-cyan-600" />
                                <h5 className="font-semibold text-cyan-800">Respiratory Rate</h5>
                              </div>
                              <p className="text-2xl font-bold text-cyan-900">{visit.vitals!.respiratoryRate}</p>
                              <p className="text-sm text-cyan-700">breaths/min</p>
                            </div>

                            {/* Weight */}
                            <div className="bg-purple-50 rounded-lg p-4 border border-purple-200">
                              <div className="flex items-center gap-2 mb-2">
                                <Activity className="w-5 h-5 text-purple-600" />
                                <h5 className="font-semibold text-purple-800">Weight</h5>
                              </div>
                              <p className="text-2xl font-bold text-purple-900">{visit.vitals!.weight}</p>
                              <p className="text-sm text-purple-700">kg</p>
                            </div>

                            {/* Height */}
                            <div className="bg-indigo-50 rounded-lg p-4 border border-indigo-200">
                              <div className="flex items-center gap-2 mb-2">
                                <Activity className="w-5 h-5 text-indigo-600" />
                                <h5 className="font-semibold text-indigo-800">Height</h5>
                              </div>
                              <p className="text-2xl font-bold text-indigo-900">{visit.vitals!.height}</p>
                              <p className="text-sm text-indigo-700">cm</p>
                            </div>

                            {/* BMI */}
                            <div className="bg-emerald-50 rounded-lg p-4 border border-emerald-200">
                              <div className="flex items-center gap-2 mb-2">
                                <Activity className="w-5 h-5 text-emerald-600" />
                                <h5 className="font-semibold text-emerald-800">BMI</h5>
                              </div>
                              <p className="text-2xl font-bold text-emerald-900">{visit.vitals!.bmi}</p>
                              <p className="text-sm text-emerald-700">kg/m²</p>
                            </div>
                          </div>

                          {/* Additional Vitals */}
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
                            {/* Pain Level */}
                            <div className="bg-amber-50 rounded-lg p-4 border border-amber-200">
                              <div className="flex items-center gap-2 mb-2">
                                <AlertTriangle className="w-5 h-5 text-amber-600" />
                                <h5 className="font-semibold text-amber-800">Pain Level</h5>
                              </div>
                              <div className="flex items-center gap-2">
                                <div className="flex-1 bg-amber-200 rounded-full h-2">
                                  <div 
                                    className="bg-amber-600 h-2 rounded-full transition-all duration-300"
                                    style={{ width: `${(visit.vitals!.painLevel / 10) * 100}%` }}
                                  ></div>
                                </div>
                                <span className="text-xl font-bold text-amber-900">{visit.vitals!.painLevel}/10</span>
                              </div>
                            </div>

                            {/* Blood Glucose */}
                            <div className="bg-rose-50 rounded-lg p-4 border border-rose-200">
                              <div className="flex items-center gap-2 mb-2">
                                <Droplets className="w-5 h-5 text-rose-600" />
                                <h5 className="font-semibold text-rose-800">Blood Glucose</h5>
                              </div>
                              <p className="text-2xl font-bold text-rose-900">{visit.vitals!.bloodGlucose}</p>
                              <p className="text-sm text-rose-700">mg/dL</p>
                            </div>
                          </div>

                          {/* Notes */}
                          {visit.vitals!.notes && (
                            <div className="mt-6 p-4 bg-slate-50 rounded-lg border border-slate-200">
                              <h5 className="font-semibold text-slate-800 mb-2">Notes</h5>
                              <p className="text-slate-700">{visit.vitals!.notes}</p>
                            </div>
                          )}
                        </div>
                      ))}
                  </div>
                )}

                {/* Pagination */}
                {getPaginatedVitals().totalPages > 1 && (
                  <div className="flex items-center justify-between mt-8 pt-6 border-t border-slate-200">
                    <div className="text-sm text-slate-600">
                      Showing {((vitalsPage - 1) * vitalsPerPage) + 1} to {Math.min(vitalsPage * vitalsPerPage, getPaginatedVitals().total)} of {getPaginatedVitals().total} records
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setVitalsPage(Math.max(1, vitalsPage - 1))}
                        disabled={vitalsPage === 1}
                        className="px-3 py-2 border border-slate-300 rounded-lg hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        Previous
                      </button>
                      {Array.from({ length: getPaginatedVitals().totalPages }, (_, i) => i + 1).map(page => (
                        <button
                          key={page}
                          onClick={() => setVitalsPage(page)}
                          className={`px-3 py-2 border rounded-lg ${
                            page === vitalsPage
                              ? 'bg-pink-500 text-white border-pink-500'
                              : 'border-slate-300 hover:bg-slate-50'
                          }`}
                        >
                          {page}
                        </button>
                      ))}
                      <button
                        onClick={() => setVitalsPage(Math.min(getPaginatedVitals().totalPages, vitalsPage + 1))}
                        disabled={vitalsPage === getPaginatedVitals().totalPages}
                        className="px-3 py-2 border border-slate-300 rounded-lg hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        Next
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default NursePatientSummary;
