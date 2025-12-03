import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import {
  ArrowLeft, Activity, FileText, Heart, ArrowRightLeft, LogOut,
  User, Bed, Calendar, Clock, Pill, TestTube
} from 'lucide-react';
import axios from 'axios';
import { useNotification } from '../components/GlobalNotification';
import { formatDateToDDMMYYYY } from '../utils/dateFormatting';

const ehrAxios = axios.create({ baseURL: 'http://localhost:3013/api' });

const AdmittedPatientPage: React.FC = () => {
  const { tenantSlug } = useParams<{ tenantSlug: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const { showError, showSuccess } = useNotification();
  
  const admission = location.state?.admission;
  const token = localStorage.getItem('ehr_token') || '';
  
  const [activeTab, setActiveTab] = useState('overview');
  const [vitals, setVitals] = useState<any[]>([]);
  const [notes, setNotes] = useState<any[]>([]);
  const [showDischargeModal, setShowDischargeModal] = useState(false);
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [showVitalsModal, setShowVitalsModal] = useState(false);
  
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
          <div className="flex gap-3 flex-wrap">
            <button
              onClick={() => setShowVitalsModal(true)}
              className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-blue-500 to-cyan-600 text-white rounded-lg hover:shadow-lg transition font-medium"
            >
              <Heart className="w-4 h-4" />
              Record Vitals
            </button>
            
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
            
            <div className="ml-auto text-sm text-slate-600 flex items-center gap-2 bg-slate-100 px-4 py-2 rounded-lg">
              <FileText className="w-4 h-4" />
              For full treatment options, use the Doctor Dashboard
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white border-b border-slate-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex gap-6 overflow-x-auto">
            {['overview', 'vitals', 'nursing'].map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`py-4 px-4 border-b-2 transition whitespace-nowrap ${
                  activeTab === tab
                    ? 'border-indigo-600 text-indigo-600 font-semibold'
                    : 'border-transparent text-slate-600 hover:text-slate-900'
                }`}
              >
                {tab === 'overview' ? 'Overview' : 
                 tab === 'vitals' ? 'Vitals History' :
                 'Nursing Notes'}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {activeTab === 'overview' && (
          <div className="space-y-6">
            {/* Admission Details */}
            <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
              <h3 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
                <Bed className="w-5 h-5 text-indigo-600" />
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
            <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                  <Heart className="w-5 h-5 text-red-600" />
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
                  <div className="bg-red-50 rounded-lg p-4">
                    <div className="text-xs text-red-600 mb-1">Temperature</div>
                    <div className="text-2xl font-bold text-red-700">{vitals[0].temperature || 'N/A'}°C</div>
                  </div>
                  <div className="bg-blue-50 rounded-lg p-4">
                    <div className="text-xs text-blue-600 mb-1">Blood Pressure</div>
                    <div className="text-2xl font-bold text-blue-700">{vitals[0].systolic || 'N/A'}/{vitals[0].diastolic || 'N/A'}</div>
                  </div>
                  <div className="bg-green-50 rounded-lg p-4">
                    <div className="text-xs text-green-600 mb-1">Heart Rate</div>
                    <div className="text-2xl font-bold text-green-700">{vitals[0].heartRate || 'N/A'} bpm</div>
                  </div>
                  <div className="bg-purple-50 rounded-lg p-4">
                    <div className="text-xs text-purple-600 mb-1">Resp. Rate</div>
                    <div className="text-2xl font-bold text-purple-700">{vitals[0].respiratoryRate || 'N/A'} /min</div>
                  </div>
                  <div className="bg-cyan-50 rounded-lg p-4">
                    <div className="text-xs text-cyan-600 mb-1">SpO2</div>
                    <div className="text-2xl font-bold text-cyan-700">{vitals[0].oxygenSaturation || 'N/A'}%</div>
                  </div>
                  <div className="bg-slate-50 rounded-lg p-4">
                    <div className="text-xs text-slate-600 mb-1">Recorded</div>
                    <div className="text-sm font-medium text-slate-700">{vitals[0].recorded_at ? formatDateToDDMMYYYY(vitals[0].recorded_at) : 'N/A'}</div>
                  </div>
                </div>
              ) : (
                <p className="text-slate-500 text-center py-8">No vitals recorded yet</p>
              )}
            </div>

            {/* Treatment Info Card */}
            <div className="bg-gradient-to-br from-indigo-50 to-purple-50 border border-indigo-200 rounded-lg p-6">
              <h3 className="text-lg font-bold text-indigo-900 mb-3">📋 Complete Treatment Workflow</h3>
              <p className="text-indigo-700 mb-4">
                For full patient treatment (progress notes, prescriptions, lab orders, imaging), use the <strong>Doctor Dashboard</strong>:
              </p>
              <ol className="text-sm text-indigo-800 space-y-2 list-decimal list-inside bg-white rounded-lg p-4">
                <li>Go to Doctor Dashboard</li>
                <li>Find patient in Today's Schedule or Patient Queue</li>
                <li>Click appointment card to open "Current Appointment" section</li>
                <li>Use action buttons to prescribe, order tests, write notes</li>
              </ol>
              <button
                onClick={() => navigate(`/ehr/${tenantSlug}/doctor`)}
                className="mt-4 w-full px-4 py-3 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-lg hover:shadow-lg transition font-medium"
              >
                Go to Doctor Dashboard →
              </button>
            </div>
          </div>
        )}

        {activeTab === 'vitals' && (
          <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
            <h3 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
              <Activity className="w-5 h-5 text-blue-600" />
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
          <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
            <h3 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
              <FileText className="w-5 h-5 text-green-600" />
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
    </div>
  );
};

export default AdmittedPatientPage;

