import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import {
  ArrowLeft, Activity, FileText, Heart, ArrowRightLeft, LogOut,
  User, Bed, Calendar, Clock, Pill, TestTube
} from 'lucide-react';
import axios from 'axios';
import { useNotification } from '../components/GlobalNotification';
import { formatDateToDDMMYYYY } from '../utils/dateFormatting';
import ClinicalNotesModal from '../components/ClinicalNotesModal';
import PrescriptionsModal from '../components/PrescriptionsModal';
import LabOrdersModal from '../components/LabOrdersModal';

const ehrAxios = axios.create({ baseURL: 'http://localhost:3013/api' });

const AdmittedPatientPage: React.FC = () => {
  const { tenantSlug } = useParams<{ tenantSlug: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const { showError, showSuccess } = useNotification();
  
  const admission = location.state?.admission;
  const token = localStorage.getItem('ehr_token') || '';
  const currentUser = JSON.parse(localStorage.getItem('ehr_user') || '{}');
  const isDoctor = currentUser?.role === 'doctor';
  const isNurse = currentUser?.role === 'nurse';
  
  // Create a pseudo-appointment object for modals that expect appointment
  const pseudoAppointment = admission ? {
    id: admission.id,
    appointmentId: admission.id,
    patientId: admission.patient_id,
    patient: {
      id: admission.patient_id,
      firstName: admission.patient_first_name,
      lastName: admission.patient_last_name,
      patientNumber: admission.admission_number || 'N/A',
    },
    appointmentDate: admission.admission_date || new Date().toISOString(),
    appointmentType: 'inpatient',
    doctorId: admission.attending_provider,
    paymentStatus: 'paid', // Inpatients are billed at discharge, not per visit
    notes: '',
  } : null;
  
  const [activeTab, setActiveTab] = useState('overview');
  const [vitals, setVitals] = useState<any[]>([]);
  const [notes, setNotes] = useState<any[]>([]);
  const [showDischargeModal, setShowDischargeModal] = useState(false);
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [showVitalsModal, setShowVitalsModal] = useState(false);
  const [showProgressNoteModal, setShowProgressNoteModal] = useState(false);
  const [showPrescriptionModal, setShowPrescriptionModal] = useState(false);
  const [showLabOrderModal, setShowLabOrderModal] = useState(false);
  const [showNursingNoteModal, setShowNursingNoteModal] = useState(false);
  const [nursingNoteData, setNursingNoteData] = useState({
    noteType: 'general',
    noteContent: '',
  });
  
  // Forms
  const [dischargeData, setDischargeData] = useState({
    dischargeDate: new Date().toISOString().split('T')[0],
    dischargeTime: new Date().toTimeString().slice(0, 5),
    dischargeDiagnosis: '',
    dischargeDiagnosisICD10: '',
    dischargeDiagnosisSNOMED: '',
    dischargeType: 'home',
    dischargeInstructions: '',
    followUpInstructions: '',
    prescriptionsGiven: false,
  });
  
  const [transferData, setTransferData] = useState({
    transferDate: new Date().toISOString().split('T')[0],
    transferTime: new Date().toTimeString().slice(0, 5),
    toWard: '',
    toBed: '',
    transferReason: '',
    transferType: 'internal',
  });
  
  const [vitalsData, setVitalsData] = useState({
    temperature: '',
    systolic: '',
    diastolic: '',
    heartRate: '',
    respiratoryRate: '',
    oxygenSaturation: '',
    notes: '',
  });
  
  const [availableBeds, setAvailableBeds] = useState<any[]>([]);

  useEffect(() => {
    if (!admission) {
      navigate(`/ehr/${tenantSlug}/bed-management`);
      return;
    }
    loadVitals();
    loadNotes();
  }, [admission]);

  const loadVitals = async () => {
    try {
      const response = await ehrAxios.get(`/vitals/patient/${admission.patient_id}`, {
        headers: { 'X-Tenant-ID': tenantSlug, Authorization: `Bearer ${token}` },
      });
      setVitals(response.data || []);
    } catch (error) {
      console.error('Failed to load vitals:', error);
      setVitals([]);
    }
  };

  const loadNotes = async () => {
    try {
      const response = await ehrAxios.get(`/nursing-notes/patient/${admission.patient_id}`, {
        headers: { 'X-Tenant-ID': tenantSlug, Authorization: `Bearer ${token}` },
      });
      setNotes(response.data || []);
    } catch (error) {
      console.error('Failed to load notes:', error);
      setNotes([]);
    }
  };

  const loadAvailableBeds = async (ward: string) => {
    try {
      const response = await ehrAxios.get('/beds/available', {
        headers: { 'X-Tenant-ID': tenantSlug, Authorization: `Bearer ${token}` },
        params: { wardName: ward },
      });
      setAvailableBeds(response.data || []);
    } catch (error) {
      showError('Error', 'Failed to load available beds');
    }
  };

  const handleRecordVitals = async () => {
    try {
      await ehrAxios.post(`/vitals/patient/${admission.patient_id}`, {
        ...vitalsData,
        recordedAt: new Date().toISOString(),
      }, {
        headers: { 'X-Tenant-ID': tenantSlug, Authorization: `Bearer ${token}` },
      });
      
      showSuccess('Success', 'Vitals recorded successfully');
      setShowVitalsModal(false);
      loadVitals();
      setVitalsData({
        temperature: '',
        systolic: '',
        diastolic: '',
        heartRate: '',
        respiratoryRate: '',
        oxygenSaturation: '',
        notes: '',
      });
    } catch (error) {
      showError('Error', 'Failed to record vitals');
    }
  };

  const handleDischarge = async () => {
    if (!dischargeData.dischargeDiagnosis) {
      showError('Error', 'Discharge diagnosis is required');
      return;
    }

    try {
      await ehrAxios.post(`/beds/admissions/${admission.id}/discharge`, dischargeData, {
        headers: { 'X-Tenant-ID': tenantSlug, Authorization: `Bearer ${token}` },
      });
      showSuccess('Success', `Patient discharged successfully to ${dischargeData.dischargeType}`);
      navigate(`/ehr/${tenantSlug}/bed-management`);
    } catch (error) {
      showError('Error', 'Failed to discharge patient');
    }
  };

  const handleTransfer = async () => {
    if (!transferData.toWard || !transferData.toBed) {
      showError('Error', 'Destination ward and bed are required');
      return;
    }

    try {
      await ehrAxios.post(`/beds/admissions/${admission.id}/transfer`, transferData, {
        headers: { 'X-Tenant-ID': tenantSlug, Authorization: `Bearer ${token}` },
      });
      showSuccess('Success', `Patient transferred to ${transferData.toWard}`);
      navigate(`/ehr/${tenantSlug}/bed-management`);
    } catch (error) {
      showError('Error', 'Failed to transfer patient');
    }
  };

  const getDaysAdmitted = () => {
    if (!admission || !admission.admission_date) return 0;
    const admitDate = new Date(admission.admission_date);
    const today = new Date();
    const diff = Math.floor((today.getTime() - admitDate.getTime()) / (1000 * 60 * 60 * 24));
    return isNaN(diff) ? 0 : Math.max(0, diff);
  };

  if (!admission) {
    return null;
  }

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header with Back Button */}
      <div className="bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-lg">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button
                onClick={() => navigate(`/ehr/${tenantSlug}/bed-management`)}
                className="p-2 hover:bg-white/20 rounded-lg transition flex items-center gap-2"
              >
                <ArrowLeft className="w-5 h-5" />
                <span className="hidden sm:inline">Back to Bed Management</span>
              </button>
              <div className="h-8 w-px bg-white/30"></div>
              <div>
                <h1 className="text-2xl font-bold">Admitted Patient Management</h1>
                <p className="text-indigo-100 mt-1">
                  {admission.patient_first_name} {admission.patient_last_name} - {admission.admission_number}
                </p>
              </div>
            </div>
          </div>
          
          {/* Quick Stats */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-6">
            <div className="bg-white/10 backdrop-blur-sm rounded-lg p-4">
              <div className="text-indigo-200 text-sm mb-1">Days Admitted</div>
              <div className="text-3xl font-bold">{getDaysAdmitted()}</div>
            </div>
            <div className="bg-white/10 backdrop-blur-sm rounded-lg p-4">
              <div className="text-indigo-200 text-sm mb-1">Current Bed</div>
              <div className="text-2xl font-bold">{admission.bed_number || 'Unassigned'}</div>
            </div>
            <div className="bg-white/10 backdrop-blur-sm rounded-lg p-4">
              <div className="text-indigo-200 text-sm mb-1">Ward</div>
              <div className="text-2xl font-bold">{admission.ward_name || 'N/A'}</div>
            </div>
            <div className="bg-white/10 backdrop-blur-sm rounded-lg p-4">
              <div className="text-indigo-200 text-sm mb-1">Status</div>
              <div className="text-2xl font-bold capitalize">{admission.admission_status}</div>
            </div>
          </div>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="bg-white border-b border-slate-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="space-y-3">
            {/* Treatment Actions - Role-based */}
            <div>
              <div className="text-xs font-semibold text-slate-500 uppercase mb-2">
                {isDoctor ? 'Daily Rounds & Treatment' : 'Nursing Care'}
              </div>
              <div className="flex gap-2 flex-wrap">
                {/* Doctor-only actions */}
                {isDoctor && (
                  <>
                    <button
                      onClick={() => setShowProgressNoteModal(true)}
                      className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-indigo-500 to-purple-600 text-white rounded-lg hover:shadow-lg transition font-medium"
                    >
                      <FileText className="w-4 h-4" />
                      Progress Note
                    </button>
                    
                    <button
                      onClick={() => setShowPrescriptionModal(true)}
                      className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-green-500 to-emerald-600 text-white rounded-lg hover:shadow-lg transition font-medium"
                    >
                      <Pill className="w-4 h-4" />
                      Prescribe Meds
                    </button>
                    
                    <button
                      onClick={() => setShowLabOrderModal(true)}
                      className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-orange-500 to-red-600 text-white rounded-lg hover:shadow-lg transition font-medium"
                    >
                      <TestTube className="w-4 h-4" />
                      Order Labs
                    </button>
                  </>
                )}
                
                {/* Shared actions - Both doctor and nurse */}
                <button
                  onClick={() => setShowVitalsModal(true)}
                  className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-blue-500 to-cyan-600 text-white rounded-lg hover:shadow-lg transition font-medium"
                >
                  <Heart className="w-4 h-4" />
                  Record Vitals
                </button>
                
                {/* Nurse-specific actions */}
                {isNurse && (
                  <button
                    onClick={() => setShowNursingNoteModal(true)}
                    className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-teal-500 to-cyan-600 text-white rounded-lg hover:shadow-lg transition font-medium"
                  >
                    <FileText className="w-4 h-4" />
                    Add Nursing Note
                  </button>
                )}
              </div>
            </div>

            {/* ADT Actions - Doctor only */}
            {isDoctor && (
              <div>
                <div className="text-xs font-semibold text-slate-500 uppercase mb-2">ADT (Admission/Discharge/Transfer)</div>
                <div className="flex gap-2 flex-wrap">
                  <button
                    onClick={() => setShowTransferModal(true)}
                    className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-yellow-500 to-amber-600 text-white rounded-lg hover:shadow-lg transition font-medium"
                  >
                    <ArrowRightLeft className="w-4 h-4" />
                    Transfer Patient
                  </button>
                  
                  <button
                    onClick={() => setShowDischargeModal(true)}
                    className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-red-500 to-rose-600 text-white rounded-lg hover:shadow-lg transition font-medium"
                  >
                    <LogOut className="w-4 h-4" />
                    Discharge Patient
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Tabs - Glassy Design with Icons */}
      <div className="bg-gradient-to-r from-slate-50 to-indigo-50 border-b border-indigo-100 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex gap-3 overflow-x-auto">
            <button
              onClick={() => setActiveTab('overview')}
              className={`flex items-center gap-2 px-6 py-3 rounded-xl transition-all duration-300 whitespace-nowrap font-medium ${
                activeTab === 'overview'
                  ? 'bg-gradient-to-br from-indigo-500 to-purple-600 text-white shadow-lg scale-105'
                  : 'bg-white/60 backdrop-blur-sm text-slate-700 hover:bg-white/80 hover:shadow-md'
              }`}
            >
              <Bed className={`w-5 h-5 ${activeTab === 'overview' ? 'text-white' : 'text-indigo-600'}`} />
              <span>Overview</span>
            </button>
            
            <button
              onClick={() => setActiveTab('vitals')}
              className={`flex items-center gap-2 px-6 py-3 rounded-xl transition-all duration-300 whitespace-nowrap font-medium ${
                activeTab === 'vitals'
                  ? 'bg-gradient-to-br from-blue-500 to-cyan-600 text-white shadow-lg scale-105'
                  : 'bg-white/60 backdrop-blur-sm text-slate-700 hover:bg-white/80 hover:shadow-md'
              }`}
            >
              <Heart className={`w-5 h-5 ${activeTab === 'vitals' ? 'text-white' : 'text-blue-600'}`} />
              <span>Vitals History</span>
              {vitals.length > 0 && (
                <span className={`ml-1 px-2 py-0.5 rounded-full text-xs ${
                  activeTab === 'vitals' ? 'bg-white/20' : 'bg-blue-100 text-blue-700'
                }`}>
                  {vitals.length}
                </span>
              )}
            </button>
            
            <button
              onClick={() => setActiveTab('nursing')}
              className={`flex items-center gap-2 px-6 py-3 rounded-xl transition-all duration-300 whitespace-nowrap font-medium ${
                activeTab === 'nursing'
                  ? 'bg-gradient-to-br from-green-500 to-emerald-600 text-white shadow-lg scale-105'
                  : 'bg-white/60 backdrop-blur-sm text-slate-700 hover:bg-white/80 hover:shadow-md'
              }`}
            >
              <FileText className={`w-5 h-5 ${activeTab === 'nursing' ? 'text-white' : 'text-green-600'}`} />
              <span>Nursing Notes</span>
              {notes.length > 0 && (
                <span className={`ml-1 px-2 py-0.5 rounded-full text-xs ${
                  activeTab === 'nursing' ? 'bg-white/20' : 'bg-green-100 text-green-700'
                }`}>
                  {notes.length}
                </span>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 bg-gradient-to-br from-slate-50 via-blue-50 to-purple-50 min-h-screen">
        {activeTab === 'overview' && (
          <div className="space-y-6">
            {/* Admission Details */}
            <div className="bg-white/80 backdrop-blur-xl rounded-2xl shadow-xl border border-white/20 p-6 hover:shadow-2xl transition-all duration-300">
              <h3 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
                <div className="p-2 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-lg">
                  <Bed className="w-5 h-5 text-white" />
                </div>
                Admission Details
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <div>
                  <div className="text-sm text-slate-600 mb-1">Admission Date</div>
                  <div className="font-medium">{formatDateToDDMMYYYY(admission.admission_date)}</div>
                </div>
                <div>
                  <div className="text-sm text-slate-600 mb-1">Admission Type</div>
                  <div className="font-medium capitalize">{admission.admission_type}</div>
                </div>
                <div>
                  <div className="text-sm text-slate-600 mb-1">Primary Diagnosis</div>
                  <div className="font-medium">{admission.primary_diagnosis || 'Not specified'}</div>
                </div>
                <div>
                  <div className="text-sm text-slate-600 mb-1">Est. Discharge</div>
                  <div className="font-medium">
                    {admission.estimated_discharge_date ? formatDateToDDMMYYYY(admission.estimated_discharge_date) : 'TBD'}
                  </div>
                </div>
                <div>
                  <div className="text-sm text-slate-600 mb-1">Admission Reason</div>
                  <div className="font-medium">{admission.admission_reason || 'Not specified'}</div>
                </div>
                <div>
                  <div className="text-sm text-slate-600 mb-1">Length of Stay</div>
                  <div className="font-medium">{getDaysAdmitted()} days</div>
                </div>
              </div>
            </div>

            {/* Latest Vitals */}
            <div className="bg-white/80 backdrop-blur-xl rounded-2xl shadow-xl border border-white/20 p-6 hover:shadow-2xl transition-all duration-300">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                  <div className="p-2 bg-gradient-to-br from-red-500 to-rose-600 rounded-lg">
                    <Heart className="w-5 h-5 text-white" />
                  </div>
                  Latest Vitals
                </h3>
                <button
                  onClick={() => setShowVitalsModal(true)}
                  className="text-sm px-4 py-2 bg-gradient-to-r from-blue-500 to-cyan-600 text-white rounded-lg hover:shadow-lg transition font-medium"
                >
                  + Record New
                </button>
              </div>
              {vitals.length > 0 ? (
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
                  <div className="relative overflow-hidden rounded-xl shadow-lg">
                    <div className="absolute inset-0 bg-gradient-to-br from-red-500 to-rose-600"></div>
                    <div className="relative p-4">
                      <div className="text-xs text-white/90 mb-1">Temperature</div>
                      <div className="text-2xl font-bold text-white">{vitals[0].temperature || 'N/A'}°C</div>
                    </div>
                  </div>
                  <div className="relative overflow-hidden rounded-xl shadow-lg">
                    <div className="absolute inset-0 bg-gradient-to-br from-blue-500 to-cyan-600"></div>
                    <div className="relative p-4">
                      <div className="text-xs text-white/90 mb-1">Blood Pressure</div>
                      <div className="text-2xl font-bold text-white">{vitals[0].systolic || 'N/A'}/{vitals[0].diastolic || 'N/A'}</div>
                    </div>
                  </div>
                  <div className="relative overflow-hidden rounded-xl shadow-lg">
                    <div className="absolute inset-0 bg-gradient-to-br from-green-500 to-emerald-600"></div>
                    <div className="relative p-4">
                      <div className="text-xs text-white/90 mb-1">Heart Rate</div>
                      <div className="text-2xl font-bold text-white">{vitals[0].heartRate || 'N/A'} bpm</div>
                    </div>
                  </div>
                  <div className="relative overflow-hidden rounded-xl shadow-lg">
                    <div className="absolute inset-0 bg-gradient-to-br from-purple-500 to-violet-600"></div>
                    <div className="relative p-4">
                      <div className="text-xs text-white/90 mb-1">Resp. Rate</div>
                      <div className="text-2xl font-bold text-white">{vitals[0].respiratoryRate || 'N/A'} /min</div>
                    </div>
                  </div>
                  <div className="relative overflow-hidden rounded-xl shadow-lg">
                    <div className="absolute inset-0 bg-gradient-to-br from-cyan-500 to-blue-500"></div>
                    <div className="relative p-4">
                      <div className="text-xs text-white/90 mb-1">SpO2</div>
                      <div className="text-2xl font-bold text-white">{vitals[0].oxygenSaturation || 'N/A'}%</div>
                    </div>
                  </div>
                  <div className="relative overflow-hidden rounded-xl shadow-lg">
                    <div className="absolute inset-0 bg-gradient-to-br from-slate-600 to-slate-700"></div>
                    <div className="relative p-4">
                      <div className="text-xs text-white/90 mb-1">Recorded</div>
                      <div className="text-sm font-medium text-white">{vitals[0].recorded_at ? formatDateToDDMMYYYY(vitals[0].recorded_at) : 'N/A'}</div>
                    </div>
                  </div>
                </div>
              ) : (
                <p className="text-slate-500 text-center py-8">No vitals recorded yet</p>
              )}
            </div>

          </div>
        )}

        {activeTab === 'vitals' && (
          <div className="bg-white/80 backdrop-blur-xl rounded-2xl shadow-xl border border-white/20 p-6 hover:shadow-2xl transition-all duration-300">
            <h3 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
              <div className="p-2 bg-gradient-to-br from-blue-500 to-cyan-600 rounded-lg">
                <Activity className="w-5 h-5 text-white" />
              </div>
              Vitals History
            </h3>
            {vitals.length > 0 ? (
              <div className="space-y-3">
                {vitals.map((vital: any, index: number) => (
                  <div key={index} className="border-l-4 border-indigo-500 bg-indigo-50 rounded-r-lg pl-4 py-3">
                    <div className="flex justify-between items-start mb-2">
                      <div className="text-sm font-medium text-slate-900">{formatDateToDDMMYYYY(vital.recorded_at)}</div>
                      <div className="text-xs text-slate-500">by {vital.recorded_by_name}</div>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                      <div><span className="text-slate-600">Temp:</span> <span className="font-medium">{vital.temperature}°C</span></div>
                      <div><span className="text-slate-600">BP:</span> <span className="font-medium">{vital.systolic}/{vital.diastolic}</span></div>
                      <div><span className="text-slate-600">HR:</span> <span className="font-medium">{vital.heartRate} bpm</span></div>
                      <div><span className="text-slate-600">SpO2:</span> <span className="font-medium">{vital.oxygenSaturation}%</span></div>
                    </div>
                    {vital.notes && (
                      <div className="text-xs text-slate-600 mt-2 italic">{vital.notes}</div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-12">
                <Activity className="w-16 h-16 text-slate-300 mx-auto mb-4" />
                <p className="text-slate-500">No vitals recorded yet</p>
                <button
                  onClick={() => setShowVitalsModal(true)}
                  className="mt-4 px-6 py-2 bg-gradient-to-r from-blue-500 to-cyan-600 text-white rounded-lg hover:shadow-lg transition font-medium"
                >
                  Record First Vitals
                </button>
              </div>
            )}
          </div>
        )}

        {activeTab === 'nursing' && (
          <div className="bg-white/80 backdrop-blur-xl rounded-2xl shadow-xl border border-white/20 p-6 hover:shadow-2xl transition-all duration-300">
            <h3 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
              <div className="p-2 bg-gradient-to-br from-green-500 to-emerald-600 rounded-lg">
                <FileText className="w-5 h-5 text-white" />
              </div>
              Nursing Notes
            </h3>
            {notes.length > 0 ? (
              <div className="space-y-4">
                {notes.map((note: any, index: number) => (
                  <div key={index} className="bg-green-50 rounded-lg p-4 border border-green-200">
                    <div className="flex justify-between items-start mb-2">
                      <div className="font-medium text-green-900">{note.note_type || 'General Note'}</div>
                      <div className="text-xs text-green-600">{formatDateToDDMMYYYY(note.created_at)}</div>
                    </div>
                    <p className="text-slate-700 text-sm whitespace-pre-wrap">{note.note_content}</p>
                    <div className="text-xs text-green-600 mt-2">by {note.nurse_name}</div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-12">
                <FileText className="w-16 h-16 text-slate-300 mx-auto mb-4" />
                <p className="text-slate-500">No nursing notes yet</p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Modals remain the same... */}
      {/* I'll include the discharge, transfer, and vitals modals from AdmittedPatientWorkflow */}
      
      {/* Record Vitals Modal */}
      {showVitalsModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full">
            <div className="bg-gradient-to-r from-blue-500 to-cyan-600 text-white p-6 rounded-t-xl">
              <h3 className="text-xl font-bold">Record Vitals</h3>
              <p className="text-blue-100 mt-1">{admission.patient_first_name} {admission.patient_last_name}</p>
            </div>
            
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Temperature (°C)</label>
                  <input
                    type="number"
                    step="0.1"
                    value={vitalsData.temperature}
                    onChange={(e) => setVitalsData({ ...vitalsData, temperature: e.target.value })}
                    placeholder="36.5"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Heart Rate (bpm)</label>
                  <input
                    type="number"
                    value={vitalsData.heartRate}
                    onChange={(e) => setVitalsData({ ...vitalsData, heartRate: e.target.value })}
                    placeholder="72"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Systolic BP</label>
                  <input
                    type="number"
                    value={vitalsData.systolic}
                    onChange={(e) => setVitalsData({ ...vitalsData, systolic: e.target.value })}
                    placeholder="120"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Diastolic BP</label>
                  <input
                    type="number"
                    value={vitalsData.diastolic}
                    onChange={(e) => setVitalsData({ ...vitalsData, diastolic: e.target.value })}
                    placeholder="80"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Respiratory Rate</label>
                  <input
                    type="number"
                    value={vitalsData.respiratoryRate}
                    onChange={(e) => setVitalsData({ ...vitalsData, respiratoryRate: e.target.value })}
                    placeholder="16"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">SpO2 (%)</label>
                  <input
                    type="number"
                    value={vitalsData.oxygenSaturation}
                    onChange={(e) => setVitalsData({ ...vitalsData, oxygenSaturation: e.target.value })}
                    placeholder="98"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Notes</label>
                <textarea
                  value={vitalsData.notes}
                  onChange={(e) => setVitalsData({ ...vitalsData, notes: e.target.value })}
                  rows={2}
                  placeholder="Any observations..."
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            <div className="flex gap-3 justify-end p-6 bg-slate-50 rounded-b-xl">
              <button
                onClick={() => setShowVitalsModal(false)}
                className="px-4 py-2 text-slate-700 hover:bg-slate-200 rounded-lg transition"
              >
                Cancel
              </button>
              <button
                onClick={handleRecordVitals}
                className="px-6 py-2 bg-gradient-to-r from-blue-500 to-cyan-600 text-white rounded-lg hover:shadow-lg transition"
              >
                Record Vitals
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Discharge Modal - Simplified, full version in AdmittedPatientWorkflow */}
      {showDischargeModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full my-8">
            <div className="bg-gradient-to-r from-red-500 to-rose-600 text-white p-6 rounded-t-xl">
              <h3 className="text-xl font-bold">Discharge Patient</h3>
              <p className="text-red-100 mt-1">{admission.patient_first_name} {admission.patient_last_name}</p>
            </div>
            
            <div className="p-6 space-y-4 max-h-[60vh] overflow-y-auto">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Discharge Date *</label>
                  <input
                    type="date"
                    value={dischargeData.dischargeDate}
                    onChange={(e) => setDischargeData({ ...dischargeData, dischargeDate: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-red-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Discharge Time *</label>
                  <input
                    type="time"
                    value={dischargeData.dischargeTime}
                    onChange={(e) => setDischargeData({ ...dischargeData, dischargeTime: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-red-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Discharge Diagnosis *</label>
                <input
                  type="text"
                  value={dischargeData.dischargeDiagnosis}
                  onChange={(e) => setDischargeData({ ...dischargeData, dischargeDiagnosis: e.target.value })}
                  placeholder="e.g., Acute Gastroenteritis, resolved"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-red-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    ICD-10 Code
                    <span className="text-xs text-slate-500 ml-2">(for billing)</span>
                  </label>
                  <input
                    type="text"
                    value={dischargeData.dischargeDiagnosisICD10}
                    onChange={(e) => setDischargeData({ ...dischargeData, dischargeDiagnosisICD10: e.target.value })}
                    placeholder="e.g., A09"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-red-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    SNOMED CT Code
                    <span className="text-xs text-slate-500 ml-2">(clinical)</span>
                  </label>
                  <input
                    type="text"
                    value={dischargeData.dischargeDiagnosisSNOMED}
                    onChange={(e) => setDischargeData({ ...dischargeData, dischargeDiagnosisSNOMED: e.target.value })}
                    placeholder="e.g., 25374005"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-red-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Discharge Destination *</label>
                <select
                  value={dischargeData.dischargeType}
                  onChange={(e) => setDischargeData({ ...dischargeData, dischargeType: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-red-500"
                >
                  <option value="home">Home</option>
                  <option value="home_health">Home with Home Health</option>
                  <option value="snf">Skilled Nursing Facility</option>
                  <option value="rehab">Rehabilitation Facility</option>
                  <option value="hospice">Hospice</option>
                  <option value="deceased">Deceased</option>
                  <option value="ama">Against Medical Advice (AMA)</option>
                  <option value="transfer">Transfer to Another Hospital</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Discharge Instructions</label>
                <textarea
                  value={dischargeData.dischargeInstructions}
                  onChange={(e) => setDischargeData({ ...dischargeData, dischargeInstructions: e.target.value })}
                  rows={3}
                  placeholder="Diet, activity restrictions, wound care, etc."
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-red-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Follow-up Instructions</label>
                <textarea
                  value={dischargeData.followUpInstructions}
                  onChange={(e) => setDischargeData({ ...dischargeData, followUpInstructions: e.target.value })}
                  rows={2}
                  placeholder="Follow up with primary care in 1 week..."
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-red-500"
                />
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="prescriptionsGiven"
                  checked={dischargeData.prescriptionsGiven}
                  onChange={(e) => setDischargeData({ ...dischargeData, prescriptionsGiven: e.target.checked })}
                  className="w-4 h-4 text-red-600 rounded"
                />
                <label htmlFor="prescriptionsGiven" className="text-sm text-slate-700">
                  Discharge prescriptions provided
                </label>
              </div>
            </div>

            <div className="flex gap-3 justify-end p-6 bg-slate-50 rounded-b-xl border-t border-slate-200">
              <button
                onClick={() => setShowDischargeModal(false)}
                className="px-4 py-2 text-slate-700 hover:bg-slate-200 rounded-lg transition"
              >
                Cancel
              </button>
              <button
                onClick={handleDischarge}
                className="px-6 py-2 bg-gradient-to-r from-red-500 to-rose-600 text-white rounded-lg hover:shadow-lg transition"
              >
                Discharge Patient
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Transfer Modal - Similar structure */}
      {showTransferModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full">
            <div className="bg-gradient-to-r from-yellow-500 to-amber-600 text-white p-6 rounded-t-xl">
              <h3 className="text-xl font-bold">Transfer Patient</h3>
              <p className="text-yellow-100 mt-1">{admission.patient_first_name} {admission.patient_last_name}</p>
            </div>
            
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Transfer Date *</label>
                  <input
                    type="date"
                    value={transferData.transferDate}
                    onChange={(e) => setTransferData({ ...transferData, transferDate: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-yellow-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Transfer Time *</label>
                  <input
                    type="time"
                    value={transferData.transferTime}
                    onChange={(e) => setTransferData({ ...transferData, transferTime: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-yellow-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Destination Ward *</label>
                <select
                  value={transferData.toWard}
                  onChange={(e) => {
                    setTransferData({ ...transferData, toWard: e.target.value, toBed: '' });
                    loadAvailableBeds(e.target.value);
                  }}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-yellow-500"
                >
                  <option value="">Select Ward</option>
                  <option value="ICU">ICU</option>
                  <option value="Medical Ward">Medical Ward</option>
                  <option value="Surgical Ward">Surgical Ward</option>
                  <option value="Pediatrics">Pediatrics</option>
                  <option value="Maternity">Maternity</option>
                </select>
              </div>

              {transferData.toWard && (
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Destination Bed *</label>
                  <select
                    value={transferData.toBed}
                    onChange={(e) => setTransferData({ ...transferData, toBed: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-yellow-500"
                  >
                    <option value="">Select Bed</option>
                    {availableBeds.map((bed: any) => (
                      <option key={bed.id} value={bed.id}>
                        {bed.bed_number} - {bed.room_number} ({bed.bed_type})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Transfer Reason *</label>
                <textarea
                  value={transferData.transferReason}
                  onChange={(e) => setTransferData({ ...transferData, transferReason: e.target.value })}
                  rows={3}
                  placeholder="Reason for transfer..."
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-yellow-500"
                />
              </div>
            </div>

            <div className="flex gap-3 justify-end p-6 bg-slate-50 rounded-b-xl border-t border-slate-200">
              <button
                onClick={() => setShowTransferModal(false)}
                className="px-4 py-2 text-slate-700 hover:bg-slate-200 rounded-lg transition"
              >
                Cancel
              </button>
              <button
                onClick={handleTransfer}
                className="px-6 py-2 bg-gradient-to-r from-yellow-500 to-amber-600 text-white rounded-lg hover:shadow-lg transition"
              >
                Transfer Patient
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Progress Note Modal */}
      {showProgressNoteModal && pseudoAppointment && (
        <ClinicalNotesModal
          open={true}
          onClose={() => setShowProgressNoteModal(false)}
          onSaved={() => {
            setShowProgressNoteModal(false);
            showSuccess('Success', 'Progress note saved');
          }}
          appointment={pseudoAppointment as any}
          tenantSlug={tenantSlug!}
          token={token}
        />
      )}

      {/* Prescription Modal */}
      {showPrescriptionModal && pseudoAppointment && (
        <PrescriptionsModal
          open={true}
          onClose={() => setShowPrescriptionModal(false)}
          onSaved={() => {
            setShowPrescriptionModal(false);
            showSuccess('Success', 'Prescription created');
          }}
          appointment={pseudoAppointment as any}
          tenantSlug={tenantSlug!}
          token={token}
        />
      )}

      {/* Lab Order Modal */}
      {showLabOrderModal && pseudoAppointment && (
        <LabOrdersModal
          open={true}
          onClose={() => setShowLabOrderModal(false)}
          onSaved={() => {
            setShowLabOrderModal(false);
            showSuccess('Success', 'Lab order created');
          }}
          appointment={pseudoAppointment as any}
          tenantSlug={tenantSlug!}
          token={token}
        />
      )}

      {/* Nursing Note Modal */}
      {showNursingNoteModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full">
            <div className="bg-gradient-to-r from-teal-500 to-cyan-600 text-white p-6 rounded-t-xl">
              <h3 className="text-xl font-bold">Add Nursing Note</h3>
              <p className="text-teal-100 mt-1">{admission.patient_first_name} {admission.patient_last_name}</p>
            </div>
            
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Note Type *</label>
                <select
                  value={nursingNoteData.noteType}
                  onChange={(e) => setNursingNoteData({ ...nursingNoteData, noteType: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500"
                >
                  <option value="general">General Note</option>
                  <option value="assessment">Nursing Assessment</option>
                  <option value="intervention">Intervention</option>
                  <option value="medication">Medication Administration</option>
                  <option value="wound_care">Wound Care</option>
                  <option value="patient_education">Patient Education</option>
                  <option value="discharge_planning">Discharge Planning</option>
                  <option value="fall_risk">Fall Risk Assessment</option>
                  <option value="pain_assessment">Pain Assessment</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Note Content *</label>
                <textarea
                  value={nursingNoteData.noteContent}
                  onChange={(e) => setNursingNoteData({ ...nursingNoteData, noteContent: e.target.value })}
                  rows={8}
                  placeholder="Document nursing observations, interventions, patient response..."
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500"
                />
              </div>

              <div className="bg-teal-50 border border-teal-200 rounded-lg p-4">
                <h4 className="text-sm font-semibold text-teal-900 mb-2">💡 Nursing Documentation Tips</h4>
                <ul className="text-xs text-teal-800 space-y-1 list-disc list-inside">
                  <li>Use objective, factual language</li>
                  <li>Include time-specific observations</li>
                  <li>Document patient responses to interventions</li>
                  <li>Note any changes in condition</li>
                  <li>Record patient/family education provided</li>
                </ul>
              </div>
            </div>

            <div className="flex gap-3 justify-end p-6 bg-slate-50 rounded-b-xl border-t border-slate-200">
              <button
                onClick={() => {
                  setShowNursingNoteModal(false);
                  setNursingNoteData({ noteType: 'general', noteContent: '' });
                }}
                className="px-4 py-2 text-slate-700 hover:bg-slate-200 rounded-lg transition"
              >
                Cancel
              </button>
              <button
                onClick={async () => {
                  if (!nursingNoteData.noteContent.trim()) {
                    showError('Error', 'Note content is required');
                    return;
                  }
                  
                  try {
                    await ehrAxios.post(`/nursing-notes`, {
                      patientId: admission.patient_id,
                      appointmentId: null,
                      noteType: nursingNoteData.noteType,
                      noteContent: nursingNoteData.noteContent,
                    }, {
                      headers: { 'X-Tenant-ID': tenantSlug, Authorization: `Bearer ${token}` },
                    });
                    
                    showSuccess('Success', 'Nursing note saved');
                    setShowNursingNoteModal(false);
                    setNursingNoteData({ noteType: 'general', noteContent: '' });
                    loadNotes();
                  } catch (error) {
                    showError('Error', 'Failed to save nursing note');
                  }
                }}
                className="px-6 py-2 bg-gradient-to-r from-teal-500 to-cyan-600 text-white rounded-lg hover:shadow-lg transition"
              >
                Save Note
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdmittedPatientPage;

