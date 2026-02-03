import React, { useState, useEffect } from 'react';
import { X, UserPlus, Bed, Stethoscope, FileText, Calendar, Check, AlertCircle } from 'lucide-react';
import { useNotification } from './GlobalNotification';
import axios from 'axios';
import ICD10Picker from './ICD10Picker';

interface AdmissionWorkflowProps {
  patientId: string;
  patientName: string;
  tenantSlug: string;
  token: string;
  onClose: () => void;
  onSuccess: () => void;
}

const AdmissionWorkflow: React.FC<AdmissionWorkflowProps> = ({
  patientId,
  patientName,
  tenantSlug,
  token,
  onClose,
  onSuccess,
}) => {
  const { showSuccess, showError } = useNotification();
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState(1);
  const [doctors, setDoctors] = useState<any[]>([]);
  const [availableBeds, setAvailableBeds] = useState<any[]>([]);
  const [patients, setPatients] = useState<any[]>([]);
  const [admittedPatients, setAdmittedPatients] = useState<string[]>([]);
  const [selectedPatient, setSelectedPatient] = useState<any>(null);
  const [patientSearch, setPatientSearch] = useState('');
  const [formData, setFormData] = useState({
    admissionType: 'emergency',
    admissionSource: 'emergency_room',
    admittingProvider: '',
    admittingDiagnosis: '',
    admittingDiagnosisIcd10: '',
    ward: '',
    service: 'general_medicine',
    bedId: '',
    expectedLosDays: 3,
    isolationRequired: false,
    codeStatus: 'full_code',
    notes: '',
  });

  useEffect(() => {
    loadDoctors();
    loadAvailableBeds();
    loadPatients();
    loadAdmittedPatients();
  }, [formData.ward]);

  const loadPatients = async () => {
    try {
      const EHR_API_URL = process.env.REACT_APP_EHR_API_URL;
      const response = await axios.get(`${EHR_API_URL}/patients`, {
        headers: {
          'X-Tenant-ID': tenantSlug,
          'Authorization': `Bearer ${token}`
        },
        params: { limit: 100 }
      });
      setPatients(response.data?.patients || response.data || []);
    } catch (error) {
      console.error('Failed to load patients:', error);
    }
  };

  const loadAdmittedPatients = async () => {
    try {
      const EHR_API_URL = process.env.REACT_APP_EHR_API_URL;
      const response = await axios.get(`${EHR_API_URL}/beds/admissions`, {
        headers: {
          'X-Tenant-ID': tenantSlug,
          'Authorization': `Bearer ${token}`
        }
      });
      const admitted = (response.data || []).map((admission: any) => admission.patientId);
      setAdmittedPatients(admitted);
    } catch (error) {
      console.error('Failed to load admitted patients:', error);
    }
  };

  const loadDoctors = async () => {
    try {
      const EHR_API_URL = process.env.REACT_APP_EHR_API_URL;
      const response = await axios.get(`${EHR_API_URL}/users`, {
        headers: {
          'X-Tenant-ID': tenantSlug,
          'Authorization': `Bearer ${token}`
        },
        params: { role: 'doctor' }
      });
      setDoctors(response.data || []);
    } catch (error) {
      console.error('Failed to load doctors:', error);
    }
  };

  const loadAvailableBeds = async () => {
    try {
      const EHR_API_URL = process.env.REACT_APP_EHR_API_URL;
      const params: any = {};
      if (formData.ward) params.wardName = formData.ward;
      
      const response = await axios.get(`${EHR_API_URL}/beds/available`, {
        headers: {
          'X-Tenant-ID': tenantSlug,
          'Authorization': `Bearer ${token}`
        },
        params
      });
      setAvailableBeds(response.data || []);
    } catch (error) {
      console.error('Failed to load beds:', error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!selectedPatient || !formData.admittingProvider || !formData.admittingDiagnosis) {
      showError('Error', 'Please select a patient and fill in required fields');
      return;
    }

    try {
      setLoading(true);
      
      // Use direct axios call to avoid ehrApi.post function error
      const EHR_API_URL = process.env.REACT_APP_EHR_API_URL;
      const response = await axios.post(
        `${EHR_API_URL}/beds/admissions`,
        {
          patientId: selectedPatient?.id || patientId,
          ...formData,
        },
        {
          headers: {
            'X-Tenant-ID': tenantSlug,
            'Authorization': `Bearer ${token}`
          }
        }
      );
      
      showSuccess('Success', 'Patient admitted successfully');
      onSuccess?.();
      setTimeout(() => {
        window.location.href = `/ehr/${tenantSlug}/bed-management`;
      }, 2000);
    } catch (error: any) {
      console.error('Failed to admit patient:', error);
      showError('Error', error.response?.data?.message || 'Failed to admit patient');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-md flex items-center justify-center z-[100000] p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl my-8">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-600 to-cyan-700 px-4 sm:px-6 py-4 flex items-center justify-between rounded-t-2xl">
          <div className="flex items-center gap-3">
            <UserPlus className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
            <div>
              <h2 className="text-lg sm:text-xl font-bold text-white">Patient Admission</h2>
              <p className="text-xs sm:text-sm text-blue-100">{patientName}</p>
            </div>
          </div>
          <button onClick={onClose} className="text-white hover:text-blue-100">
            <X className="w-5 h-5 sm:w-6 sm:h-6" />
          </button>
        </div>

        {/* Progress Steps */}
        <div className="px-4 sm:px-6 py-4 bg-slate-50 border-b border-slate-200">
          <div className="flex items-center justify-between max-w-2xl mx-auto">
            {[
              { num: 1, label: 'Details', icon: FileText },
              { num: 2, label: 'Bed', icon: Bed },
              { num: 3, label: 'Review', icon: Check },
            ].map((s) => (
              <div key={s.num} className="flex items-center gap-2 sm:gap-4 flex-1">
                <div className={`flex items-center gap-2 flex-1`}>
                  <div className={`w-8 h-8 sm:w-10 sm:h-10 rounded-full flex items-center justify-center font-bold text-sm transition-all duration-200 ${
                    step >= s.num
                      ? 'bg-gradient-to-br from-blue-600 to-cyan-700 text-white shadow-lg'
                      : 'bg-slate-200 text-slate-500'
                  }`}>
                    {step > s.num ? <Check className="w-4 h-4 sm:w-5 sm:h-5" /> : s.num}
                  </div>
                  <span className={`hidden sm:block text-xs sm:text-sm font-medium ${step >= s.num ? 'text-slate-900' : 'text-slate-500'}`}>
                    {s.label}
                  </span>
                </div>
                {s.num < 3 && (
                  <div className={`hidden sm:block h-0.5 w-full ${step > s.num ? 'bg-blue-600' : 'bg-slate-200'}`}></div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Form Content */}
        <div className="p-4 sm:p-6">
          {step === 1 && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Select Patient <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  placeholder="Search patients..."
                  value={patientSearch}
                  onChange={(e) => setPatientSearch(e.target.value)}
                  className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm mb-2"
                />
                {patientSearch.length >= 2 && (
                  <div className="max-h-32 overflow-y-auto border border-slate-200 rounded-lg">
                    {patients
                      .filter(p => !admittedPatients.includes(p.id))
                      .filter(p => 
                        `${p.firstName} ${p.lastName}`.toLowerCase().includes(patientSearch.toLowerCase()) ||
                        p.medicalRecordNumber?.toLowerCase().includes(patientSearch.toLowerCase())
                      )
                      .sort((a, b) => `${a.firstName} ${a.lastName}`.localeCompare(`${b.firstName} ${b.lastName}`))
                      .slice(0, 10)
                    .map(patient => (
                      <button
                        key={patient.id}
                        type="button"
                        onClick={() => {
                          setSelectedPatient(patient);
                          setPatientSearch(`${patient.firstName} ${patient.lastName}`);
                        }}
                        className={`w-full text-left px-3 py-2 hover:bg-blue-50 border-b border-slate-100 last:border-b-0 ${
                          selectedPatient?.id === patient.id ? 'bg-blue-50' : ''
                        }`}
                      >
                        <div className="font-medium">{patient.firstName} {patient.lastName}</div>
                        <div className="text-xs text-slate-500">MRN: {patient.medicalRecordNumber}</div>
                      </button>
                    ))
                  }
                  </div>
                )}
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Admission Type <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={formData.admissionType}
                    onChange={(e) => setFormData({ ...formData, admissionType: e.target.value })}
                    className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm"
                    required
                  >
                    <option value="emergency">Emergency</option>
                    <option value="elective">Elective</option>
                    <option value="urgent">Urgent</option>
                    <option value="observation">Observation</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Admitting Provider <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={formData.admittingProvider}
                    onChange={(e) => setFormData({ ...formData, admittingProvider: e.target.value })}
                    className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm"
                    required
                  >
                    <option value="">-- Select Doctor --</option>
                    {doctors.map(doc => (
                      <option key={doc.id} value={doc.id}>
                        Dr. {doc.firstName} {doc.lastName} {doc.specialization ? `(${doc.specialization})` : ''}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Admitting Diagnosis <span className="text-red-500">*</span>
                </label>
                <textarea
                  value={formData.admittingDiagnosis}
                  onChange={(e) => setFormData({ ...formData, admittingDiagnosis: e.target.value })}
                  rows={2}
                  className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm"
                  placeholder="Primary diagnosis..."
                  required
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <ICD10Picker
                    value={formData.admittingDiagnosisIcd10}
                    onChange={(code, description) => {
                      setFormData({
                        ...formData,
                        admittingDiagnosisIcd10: code,
                        // Auto-fill diagnosis if empty
                        admittingDiagnosis: formData.admittingDiagnosis || description,
                      });
                    }}
                    token={token}
                    tenantSlug={tenantSlug}
                    label="ICD-10 Code"
                    placeholder="Search: heart failure, diabetes, pneumonia..."
                    required={false}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Service
                  </label>
                  <select
                    value={formData.service}
                    onChange={(e) => setFormData({ ...formData, service: e.target.value })}
                    className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm"
                  >
                    <option value="general_medicine">General Medicine</option>
                    <option value="surgery">Surgery</option>
                    <option value="pediatrics">Pediatrics</option>
                    <option value="cardiology">Cardiology</option>
                    <option value="icu">Intensive Care</option>
                  </select>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setStep(2)}
                className="w-full px-6 py-3 bg-gradient-to-r from-blue-600 to-cyan-700 text-white rounded-lg hover:from-blue-700 hover:to-cyan-800 transition-colors font-medium flex items-center justify-center gap-2"
              >
                <span>Continue to Bed Selection</span>
                <Check className="w-5 h-5" />
              </button>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4">
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
                <div className="flex items-center gap-2">
                  <AlertCircle className="w-5 h-5 text-blue-600" />
                  <p className="text-sm text-blue-900">
                    Select a bed for the patient. {availableBeds.length} bed(s) currently available.
                  </p>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Ward
                </label>
                <select
                  value={formData.ward}
                  onChange={(e) => setFormData({ ...formData, ward: e.target.value, bedId: '' })}
                  className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm"
                >
                  <option value="">All Wards</option>
                  <option value="Intensive Care Unit">ICU</option>
                  <option value="Medical Ward">Medical Ward</option>
                  <option value="Pediatrics">Pediatrics</option>
                  <option value="Maternity">Maternity</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Select Bed
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2 sm:gap-3 max-h-64 overflow-y-auto p-2 border border-slate-200 rounded-lg">
                  {availableBeds.map(bed => (
                    <button
                      key={bed.id}
                      type="button"
                      onClick={() => setFormData({ ...formData, bedId: bed.id, ward: bed.wardName })}
                      className={`p-3 sm:p-4 rounded-lg border-2 transition-all duration-200 ${
                        formData.bedId === bed.id
                          ? 'border-blue-600 bg-blue-50'
                          : 'border-slate-200 hover:border-blue-300 bg-white'
                      }`}
                    >
                      <div className="text-center">
                        <Bed className={`w-6 h-6 mx-auto mb-1 ${formData.bedId === bed.id ? 'text-blue-600' : 'text-slate-400'}`} />
                        <div className={`text-xs sm:text-sm font-bold ${formData.bedId === bed.id ? 'text-blue-900' : 'text-slate-700'}`}>
                          {bed.bedNumber}
                        </div>
                        <div className="text-[10px] sm:text-xs text-slate-500">{bed.roomNumber}</div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex flex-col-reverse sm:flex-row items-stretch gap-3">
                <button
                  type="button"
                  onClick={() => setStep(1)}
                  className="px-6 py-2.5 bg-slate-200 text-slate-700 rounded-lg hover:bg-slate-300 transition-colors font-medium text-sm"
                >
                  Back
                </button>
                <button
                  type="button"
                  onClick={() => setStep(3)}
                  className="flex-1 px-6 py-2.5 bg-gradient-to-r from-blue-600 to-cyan-700 text-white rounded-lg hover:from-blue-700 hover:to-cyan-800 transition-colors font-medium text-sm flex items-center justify-center gap-2"
                >
                  <span>Continue to Review</span>
                  <Check className="w-5 h-5" />
                </button>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-4">
              <div className="bg-green-50 border border-green-200 rounded-lg p-4 sm:p-6">
                <h3 className="font-bold text-slate-900 mb-4 flex items-center gap-2">
                  <Check className="w-5 h-5 text-green-600" />
                  Review Admission Details
                </h3>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-slate-500">Patient:</span>
                    <div className="font-semibold">
                      {selectedPatient ? `${selectedPatient.firstName} ${selectedPatient.lastName}` : patientName}
                    </div>
                  </div>
                  <div>
                    <span className="text-slate-500">Admission Type:</span>
                    <div className="font-semibold capitalize">{formData.admissionType}</div>
                  </div>
                  <div>
                    <span className="text-slate-500">Admitting Diagnosis:</span>
                    <div className="font-semibold">{formData.admittingDiagnosis}</div>
                  </div>
                  {formData.admittingDiagnosisIcd10 && (
                    <div>
                      <span className="text-slate-500">ICD-10:</span>
                      <div className="font-semibold">{formData.admittingDiagnosisIcd10}</div>
                    </div>
                  )}
                  <div>
                    <span className="text-slate-500">Service:</span>
                    <div className="font-semibold capitalize">{formData.service.replace('_', ' ')}</div>
                  </div>
                  {formData.bedId && (
                    <div>
                      <span className="text-slate-500">Bed:</span>
                      <div className="font-semibold">
                        {availableBeds.find(b => b.id === formData.bedId)?.bedNumber || 'Selected'}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <div className="flex flex-col-reverse sm:flex-row items-stretch gap-3">
                <button
                  type="button"
                  onClick={() => setStep(2)}
                  className="px-6 py-2.5 bg-slate-200 text-slate-700 rounded-lg hover:bg-slate-300 transition-colors font-medium text-sm"
                >
                  Back
                </button>
                <button
                  type="button"
                  onClick={handleSubmit}
                  disabled={loading}
                  className="flex-1 px-6 py-2.5 bg-gradient-to-r from-green-600 to-emerald-700 text-white rounded-lg hover:from-green-700 hover:to-emerald-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-medium text-sm flex items-center justify-center gap-2"
                >
                  {loading ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                      <span>Admitting...</span>
                    </>
                  ) : (
                    <>
                      <UserPlus className="w-5 h-5" />
                      <span>Admit Patient</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AdmissionWorkflow;

