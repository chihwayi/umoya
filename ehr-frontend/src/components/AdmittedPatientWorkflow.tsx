import React, { useState, useEffect } from 'react';
import {
  User, Bed, Activity, FileText, Pill, TestTube, Calendar,
  Heart, ArrowRightLeft, LogOut, AlertTriangle, CheckCircle,
  Clock, MessageSquare, Plus, TrendingUp, X
} from 'lucide-react';
import { useNotification } from './GlobalNotification';
import { formatDateToDDMMYYYY } from '../utils/dateFormatting';
import ICD10Picker from './ICD10Picker';
import { ehrAxios } from '../services/api';

interface AdmittedPatientWorkflowProps {
  admission: any;
  tenantSlug: string;
  token: string;
  onUpdate: () => void;
  onClose: () => void;
}

const AdmittedPatientWorkflow: React.FC<AdmittedPatientWorkflowProps> = ({
  admission,
  tenantSlug,
  token,
  onUpdate,
  onClose,
}) => {
  const { showError, showSuccess } = useNotification();
  const [activeTab, setActiveTab] = useState('overview');
  const [vitals, setVitals] = useState<any[]>([]);
  const [notes, setNotes] = useState<any[]>([]);
  const [progressNotes, setProgressNotes] = useState<any[]>([]);
  const [prescriptions, setPrescriptions] = useState<any[]>([]);
  const [labOrders, setLabOrders] = useState<any[]>([]);
  const [imagingOrders, setImagingOrders] = useState<any[]>([]);
  const [showDischargeModal, setShowDischargeModal] = useState(false);
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [showVitalsModal, setShowVitalsModal] = useState(false);
  const [showProgressNoteModal, setShowProgressNoteModal] = useState(false);
  const [showPrescriptionModal, setShowPrescriptionModal] = useState(false);
  const [showLabOrderModal, setShowLabOrderModal] = useState(false);
  const [showImagingOrderModal, setShowImagingOrderModal] = useState(false);
  
  // Discharge form
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
  
  // Transfer form
  const [transferData, setTransferData] = useState({
    transferDate: new Date().toISOString().split('T')[0],
    transferTime: new Date().toTimeString().slice(0, 5),
    toWard: '',
    toBed: '',
    transferReason: '',
    transferType: 'internal',
  });
  
  // Vitals form
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
    if (admission) {
      loadVitals();
      loadNotes();
      // Don't load progress notes, prescriptions, labs, imaging on mount
      // They'll show empty states with helpful messages
    }
    
    // Lock body scroll when modal opens
    document.body.style.overflow = 'hidden';
    
    return () => {
      // Restore body scroll when modal closes
      document.body.style.overflow = 'unset';
    };
  }, [admission]);

  const loadVitals = async () => {
    try {
      const response = await ehrAxios.get(`/vitals/patient/${admission.patient_id}`, {
        headers: { 'X-Tenant-ID': tenantSlug, 'Authorization': `Bearer ${token}` }
      });
      setVitals(response.data || []);
    } catch (error) {
      console.error('Failed to load vitals:', error);
    }
  };

  const loadNotes = async () => {
    try {
      const response = await ehrAxios.get(`/nursing-notes/patient/${admission.patient_id}`, {
        headers: { 'X-Tenant-ID': tenantSlug, 'Authorization': `Bearer ${token}` }
      });
      setNotes(response.data || []);
    } catch (error) {
      console.error('Failed to load notes:', error);
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

  const loadProgressNotes = async () => {
    try {
      const response = await ehrAxios.get(`/medical-records/patient/${admission.patient_id}`, {
        headers: { 'X-Tenant-ID': tenantSlug, Authorization: `Bearer ${token}` },
        params: { type: 'progress_note' },
      });
      setProgressNotes(response.data || []);
    } catch (error) {
      // Silently fail - endpoint may not exist yet
      setProgressNotes([]);
    }
  };

  const loadPrescriptions = async () => {
    try {
      const response = await ehrAxios.get(`/prescriptions/patient/${admission.patient_id}`, {
        headers: { 'X-Tenant-ID': tenantSlug, Authorization: `Bearer ${token}` },
      });
      setPrescriptions(response.data || []);
    } catch (error) {
      // Silently fail - endpoint may not exist yet
      setPrescriptions([]);
    }
  };

  const loadLabOrders = async () => {
    try {
      const response = await ehrAxios.get(`/lab-orders/patient/${admission.patient_id}`, {
        headers: { 'X-Tenant-ID': tenantSlug, Authorization: `Bearer ${token}` },
      });
      setLabOrders(response.data || []);
    } catch (error) {
      // Silently fail - endpoint may not exist yet
      setLabOrders([]);
    }
  };

  const loadImagingOrders = async () => {
    try {
      const response = await ehrAxios.get(`/imaging/orders/patient/${admission.patient_id}`, {
        headers: { 'X-Tenant-ID': tenantSlug, Authorization: `Bearer ${token}` },
      });
      setImagingOrders(response.data || []);
    } catch (error) {
      // Silently fail - endpoint may not exist yet
      setImagingOrders([]);
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
      setShowDischargeModal(false);
      onUpdate();
      onClose();
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
      showSuccess('Success', `Patient transferred to ${transferData.toWard} - Bed ${transferData.toBed}`);
      setShowTransferModal(false);
      onUpdate();
      onClose();
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

  return (
    <div className="flex flex-col h-full bg-slate-50 overflow-hidden">
      {/* Header - Fixed */}
      <div className="flex-shrink-0 bg-gradient-to-r from-indigo-600 to-purple-600 text-white p-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold mb-2">Admitted Patient Management</h2>
            <p className="text-indigo-100">
              {admission.patient_first_name} {admission.patient_last_name} - {admission.admission_number}
            </p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-white/20 rounded-lg transition">
            <X className="w-6 h-6" />
          </button>
        </div>
        
        {/* Quick Stats */}
        <div className="grid grid-cols-4 gap-4 mt-6">
          <div className="bg-white/10 backdrop-blur-sm rounded-lg p-3">
            <div className="text-indigo-200 text-sm mb-1">Days Admitted</div>
            <div className="text-2xl font-bold">{getDaysAdmitted()}</div>
          </div>
          <div className="bg-white/10 backdrop-blur-sm rounded-lg p-3">
            <div className="text-indigo-200 text-sm mb-1">Current Bed</div>
            <div className="text-xl font-bold">{admission.bed_number || 'Unassigned'}</div>
          </div>
          <div className="bg-white/10 backdrop-blur-sm rounded-lg p-3">
            <div className="text-indigo-200 text-sm mb-1">Ward</div>
            <div className="text-xl font-bold">{admission.ward_name || 'N/A'}</div>
          </div>
          <div className="bg-white/10 backdrop-blur-sm rounded-lg p-3">
            <div className="text-indigo-200 text-sm mb-1">Status</div>
            <div className="text-xl font-bold capitalize">{admission.admission_status}</div>
          </div>
        </div>
      </div>

      {/* Action Buttons - Fixed */}
      <div className="flex-shrink-0 bg-white border-b border-slate-200 p-4">
        <div className="flex gap-3 flex-wrap">
          <button
            onClick={() => showError('Info', 'Use the Progress Notes tab to review or click the + button in that tab. For now, you can add notes through the main appointment workflow.')}
            className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-indigo-500 to-purple-600 text-white rounded-lg hover:shadow-lg transition font-medium"
          >
            <FileText className="w-4 h-4" />
            Progress Note
          </button>
          
          <button
            onClick={() => showError('Info', 'Use the Medications tab to review prescriptions. To prescribe new medications, use the main doctor dashboard appointment workflow.')}
            className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-green-500 to-emerald-600 text-white rounded-lg hover:shadow-lg transition font-medium"
          >
            <Pill className="w-4 h-4" />
            Prescribe Med
          </button>
          
          <button
            onClick={() => showError('Info', 'Use the Labs tab to review orders. To order new labs, use the main doctor dashboard appointment workflow.')}
            className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-blue-500 to-cyan-600 text-white rounded-lg hover:shadow-lg transition font-medium"
          >
            <TestTube className="w-4 h-4" />
            Order Labs
          </button>
          
          <button
            onClick={() => showError('Info', 'Use the Imaging tab to review orders. To order new imaging, use the main doctor dashboard appointment workflow.')}
            className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-teal-500 to-cyan-600 text-white rounded-lg hover:shadow-lg transition font-medium"
          >
            <Activity className="w-4 h-4" />
            Order Imaging
          </button>
          
          <button
            onClick={() => setShowVitalsModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-orange-500 to-amber-600 text-white rounded-lg hover:shadow-lg transition"
          >
            <Heart className="w-4 h-4" />
            View/Record Vitals
          </button>
          
          <button
            onClick={() => setShowTransferModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-yellow-500 to-amber-600 text-white rounded-lg hover:shadow-lg transition"
          >
            <ArrowRightLeft className="w-4 h-4" />
            Transfer
          </button>
          
          <button
            onClick={() => setShowDischargeModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-red-500 to-rose-600 text-white rounded-lg hover:shadow-lg transition font-medium"
          >
            <LogOut className="w-4 h-4" />
            Discharge
          </button>
        </div>
      </div>

      {/* Tabs - Fixed */}
      <div className="flex-shrink-0 bg-white border-b border-slate-200 px-6">
        <div className="flex gap-6">
          {['overview', 'progress', 'medications', 'labs', 'imaging', 'vitals', 'nursing'].map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`py-3 px-4 border-b-2 transition ${
                activeTab === tab
                  ? 'border-indigo-600 text-indigo-600 font-semibold'
                  : 'border-transparent text-slate-600 hover:text-slate-900'
              }`}
            >
              {tab === 'progress' ? 'Progress Notes' : 
               tab === 'medications' ? 'Medications' :
               tab === 'labs' ? 'Labs' :
               tab === 'imaging' ? 'Imaging' :
               tab === 'vitals' ? 'Vitals' :
               tab === 'nursing' ? 'Nursing Notes' :
               tab.charAt(0).toUpperCase() + tab.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Content - Scrollable */}
      <div className="flex-1 overflow-y-auto p-6 min-h-0">
        {activeTab === 'overview' && (
          <div className="space-y-6">
            {/* Admission Details */}
            <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
              <h3 className="text-lg font-bold text-slate-900 mb-4">Admission Details</h3>
              <div className="grid grid-cols-2 gap-4">
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
                <h3 className="text-lg font-bold text-slate-900">Latest Vitals</h3>
                <button
                  onClick={() => setShowVitalsModal(true)}
                  className="text-sm text-indigo-600 hover:text-indigo-800 font-medium"
                >
                  + Record New
                </button>
              </div>
              {vitals.length > 0 ? (
                <div className="grid grid-cols-3 gap-4">
                  <div className="bg-red-50 rounded-lg p-3">
                    <div className="text-xs text-red-600 mb-1">Temperature</div>
                    <div className="text-xl font-bold text-red-700">{vitals[0].temperature || 'N/A'}°C</div>
                  </div>
                  <div className="bg-blue-50 rounded-lg p-3">
                    <div className="text-xs text-blue-600 mb-1">Blood Pressure</div>
                    <div className="text-xl font-bold text-blue-700">{vitals[0].systolic || 'N/A'}/{vitals[0].diastolic || 'N/A'}</div>
                  </div>
                  <div className="bg-green-50 rounded-lg p-3">
                    <div className="text-xs text-green-600 mb-1">Heart Rate</div>
                    <div className="text-xl font-bold text-green-700">{vitals[0].heartRate || 'N/A'} bpm</div>
                  </div>
                </div>
              ) : (
                <p className="text-slate-500 text-sm">No vitals recorded yet</p>
              )}
            </div>
          </div>
        )}

        {activeTab === 'vitals' && (
          <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
            <h3 className="text-lg font-bold text-slate-900 mb-4">Vitals History</h3>
            {vitals.length > 0 ? (
              <div className="space-y-3">
                {vitals.map((vital: any, index: number) => (
                  <div key={index} className="border-l-4 border-indigo-500 pl-4 py-2">
                    <div className="flex justify-between items-start mb-2">
                      <div className="text-sm text-slate-600">{formatDateToDDMMYYYY(vital.recorded_at)}</div>
                      <div className="text-xs text-slate-500">by {vital.recorded_by_name}</div>
                    </div>
                    <div className="grid grid-cols-4 gap-3 text-sm">
                      <div><span className="text-slate-600">Temp:</span> <span className="font-medium">{vital.temperature}°C</span></div>
                      <div><span className="text-slate-600">BP:</span> <span className="font-medium">{vital.systolic}/{vital.diastolic}</span></div>
                      <div><span className="text-slate-600">HR:</span> <span className="font-medium">{vital.heartRate} bpm</span></div>
                      <div><span className="text-slate-600">SpO2:</span> <span className="font-medium">{vital.oxygenSaturation}%</span></div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-slate-500 text-center py-8">No vitals recorded</p>
            )}
          </div>
        )}

        {activeTab === 'progress' && (
          <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
            <h3 className="text-lg font-bold text-slate-900 mb-4">Doctor Progress Notes</h3>
            <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-8 text-center">
              <FileText className="w-16 h-16 text-indigo-400 mx-auto mb-4" />
              <p className="text-indigo-900 font-medium mb-2">Treatment Documentation</p>
              <p className="text-indigo-700 text-sm mb-4">
                To write progress notes, prescribe medications, and order tests for this patient, 
                use the <strong>Doctor Dashboard</strong> appointment workflow.
              </p>
              <div className="bg-white rounded-lg p-4 border border-indigo-300 text-left">
                <p className="text-sm text-slate-700 mb-2"><strong>How to treat this patient:</strong></p>
                <ol className="text-sm text-slate-600 space-y-1 list-decimal list-inside">
                  <li>Go to Doctor Dashboard</li>
                  <li>Find patient in Today's Schedule or Patient Queue</li>
                  <li>Click appointment to open full treatment panel</li>
                  <li>Use "Current Appointment" section for all orders</li>
                </ol>
              </div>
              <p className="text-xs text-indigo-600 mt-4">
                💡 This Bed Management view is for quick patient summary and discharge/transfer workflows
              </p>
            </div>
          </div>
        )}

        {activeTab === 'medications' && (
          <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
            <h3 className="text-lg font-bold text-slate-900 mb-4">Medications & Prescriptions</h3>
            <div className="bg-green-50 border border-green-200 rounded-lg p-8 text-center">
              <Pill className="w-16 h-16 text-green-400 mx-auto mb-4" />
              <p className="text-green-900 font-medium mb-2">Prescription Management</p>
              <p className="text-green-700 text-sm mb-4">
                To prescribe medications for this admitted patient, use the main <strong>Doctor Dashboard</strong>.
              </p>
              <div className="text-xs text-green-600">
                💡 Prescription history will appear here once orders are placed through the main workflow
              </div>
            </div>
          </div>
        )}

        {activeTab === 'labs' && (
          <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
            <h3 className="text-lg font-bold text-slate-900 mb-4">Lab Orders & Results</h3>
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-8 text-center">
              <TestTube className="w-16 h-16 text-blue-400 mx-auto mb-4" />
              <p className="text-blue-900 font-medium mb-2">Laboratory Management</p>
              <p className="text-blue-700 text-sm mb-4">
                To order lab tests for this patient, use the main <strong>Doctor Dashboard</strong>.
              </p>
              <div className="text-xs text-blue-600">
                💡 Lab orders and results will appear here once tests are ordered through the main workflow
              </div>
            </div>
          </div>
        )}

        {activeTab === 'imaging' && (
          <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
            <h3 className="text-lg font-bold text-slate-900 mb-4">Imaging Orders & Reports</h3>
            <div className="bg-teal-50 border border-teal-200 rounded-lg p-8 text-center">
              <Activity className="w-16 h-16 text-teal-400 mx-auto mb-4" />
              <p className="text-teal-900 font-medium mb-2">Radiology Management</p>
              <p className="text-teal-700 text-sm mb-4">
                To order imaging studies for this patient, use the main <strong>Doctor Dashboard</strong>.
              </p>
              <div className="text-xs text-teal-600">
                💡 Imaging orders and reports will appear here once studies are ordered through the main workflow
              </div>
            </div>
          </div>
        )}

        {activeTab === 'nursing' && (
          <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
            <h3 className="text-lg font-bold text-slate-900 mb-4">Nursing Notes</h3>
            {notes.length > 0 ? (
              <div className="space-y-4">
                {notes.map((note: any, index: number) => (
                  <div key={index} className="bg-slate-50 rounded-lg p-4 border border-slate-200">
                    <div className="flex justify-between items-start mb-2">
                      <div className="font-medium text-slate-900">{note.note_type || 'General Note'}</div>
                      <div className="text-xs text-slate-500">{formatDateToDDMMYYYY(note.created_at)}</div>
                    </div>
                    <p className="text-slate-700 text-sm">{note.note_content}</p>
                    <div className="text-xs text-slate-500 mt-2">by {note.nurse_name}</div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-slate-500 text-center py-8">No nursing notes yet</p>
            )}
          </div>
        )}

        {activeTab === 'overview' && progressNotes.length === 0 && (
          <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-4 mt-4">
            <p className="text-indigo-900 font-medium">👨‍⚕️ Doctor Actions:</p>
            <p className="text-indigo-700 text-sm mt-2">
              Start managing this patient by adding a <strong>Progress Note</strong>, ordering <strong>Labs</strong>, 
              prescribing <strong>Medications</strong>, or reviewing <strong>Vitals</strong>.
            </p>
          </div>
        )}
      </div>

      {/* Discharge Modal */}
      {showDischargeModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="bg-gradient-to-r from-red-500 to-rose-600 text-white p-6">
              <h3 className="text-xl font-bold">Discharge Patient</h3>
              <p className="text-red-100 mt-1">{admission.patient_first_name} {admission.patient_last_name}</p>
            </div>
            
            <div className="p-6 space-y-4">
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
                  <ICD10Picker
                    value={dischargeData.dischargeDiagnosisICD10}
                    onChange={(code, description) => {
                      setDischargeData({
                        ...dischargeData,
                        dischargeDiagnosisICD10: code,
                        // Auto-fill diagnosis if empty
                        dischargeDiagnosis: dischargeData.dischargeDiagnosis || description,
                      });
                    }}
                    token={token}
                    tenantSlug={tenantSlug}
                    label="ICD-10 Code (for billing/reporting)"
                    placeholder="Search: gastroenteritis, pneumonia, MI..."
                    required={true}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    SNOMED CT Code
                    <span className="text-xs text-slate-500 ml-2">(for clinical documentation)</span>
                  </label>
                  <input
                    type="text"
                    value={dischargeData.dischargeDiagnosisSNOMED}
                    onChange={(e) => setDischargeData({ ...dischargeData, dischargeDiagnosisSNOMED: e.target.value })}
                    placeholder="e.g., 25374005 (Gastroenteritis)"
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
                  placeholder="Follow up with primary care in 1 week, return if symptoms worsen..."
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

            <div className="flex gap-3 justify-end p-6 bg-slate-50 rounded-b-xl">
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

      {/* Transfer Modal */}
      {showTransferModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full">
            <div className="bg-gradient-to-r from-yellow-500 to-amber-600 text-white p-6">
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
                  placeholder="Reason for transfer (e.g., needs higher level of care, step-down from ICU...)"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-yellow-500"
                />
              </div>
            </div>

            <div className="flex gap-3 justify-end p-6 bg-slate-50 rounded-b-xl">
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

      {/* Record Vitals Modal */}
      {showVitalsModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full">
            <div className="bg-gradient-to-r from-blue-500 to-cyan-600 text-white p-6">
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
    </div>
  );
};

export default AdmittedPatientWorkflow;

