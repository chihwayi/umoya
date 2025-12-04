import React, { useState, useEffect } from 'react';
import { X, Calendar, Clock, User, Activity, AlertTriangle } from 'lucide-react';
import axios from 'axios';
import { useNotification } from './GlobalNotification';
import ICD10Picker from './ICD10Picker';

const ehrAxios = axios.create({ baseURL: 'http://localhost:3013/api' });

interface ScheduleSurgeryModalProps {
  tenantSlug: string;
  token: string;
  onSuccess: () => void;
  onClose: () => void;
}

const ScheduleSurgeryModal: React.FC<ScheduleSurgeryModalProps> = ({
  tenantSlug,
  token,
  onSuccess,
  onClose,
}) => {
  const { showError, showSuccess } = useNotification();
  const [loading, setLoading] = useState(false);
  const [operatingRooms, setOperatingRooms] = useState<any[]>([]);
  const [surgeons, setSurgeons] = useState<any[]>([]);
  const [patients, setPatients] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState('');

  const [formData, setFormData] = useState({
    patientId: '',
    operatingRoomId: '',
    scheduledDate: new Date().toISOString().split('T')[0],
    scheduledStartTime: '08:00',
    scheduledEndTime: '10:00',
    procedureName: '',
    procedureCodeCpt: '',
    procedureType: 'elective',
    surgicalApproach: '',
    laterality: 'not_applicable',
    primaryDiagnosis: '',
    primaryDiagnosisIcd10: '',
    primarySurgeonId: '',
    anesthesiologistId: '',
    anesthesiaType: 'general',
    casePriority: 3,
    notes: '',
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      // Load ORs
      const orResponse = await ehrAxios.get('/operating-room/rooms', {
        params: { isActive: true },
        headers: { 'X-Tenant-ID': tenantSlug, Authorization: `Bearer ${token}` },
      });
      setOperatingRooms(orResponse.data || []);

      // Load surgeons (doctors)
      const usersResponse = await ehrAxios.get('/users', {
        params: { role: 'doctor' },
        headers: { 'X-Tenant-ID': tenantSlug, Authorization: `Bearer ${token}` },
      });
      setSurgeons(usersResponse.data?.users || []);

      // Load patients
      const patientsResponse = await ehrAxios.get('/patients', {
        params: { limit: 100 },
        headers: { 'X-Tenant-ID': tenantSlug, Authorization: `Bearer ${token}` },
      });
      setPatients(patientsResponse.data || []);
    } catch (error) {
      console.error('Failed to load data:', error);
    }
  };

  const handleSchedule = async () => {
    // Validation
    if (!formData.patientId) {
      showError('Error', 'Please select a patient');
      return;
    }
    if (!formData.operatingRoomId) {
      showError('Error', 'Please select an operating room');
      return;
    }
    if (!formData.procedureName) {
      showError('Error', 'Please enter procedure name');
      return;
    }
    if (!formData.primaryDiagnosis) {
      showError('Error', 'Please enter primary diagnosis');
      return;
    }
    if (!formData.primarySurgeonId) {
      showError('Error', 'Please select primary surgeon');
      return;
    }

    try {
      setLoading(true);

      await ehrAxios.post('/operating-room/cases', formData, {
        headers: { 'X-Tenant-ID': tenantSlug, Authorization: `Bearer ${token}` },
      });

      showSuccess('Success', 'Surgery scheduled successfully');
      onSuccess();
    } catch (error: any) {
      console.error('Failed to schedule surgery:', error);
      showError('Error', error.response?.data?.message || 'Failed to schedule surgery');
    } finally {
      setLoading(false);
    }
  };

  const filteredPatients = patients.filter((p) => {
    if (!searchTerm) return true;
    const search = searchTerm.toLowerCase();
    const fullName = `${p.firstName} ${p.lastName}`.toLowerCase();
    return fullName.includes(search) || p.medicalRecordNumber?.includes(search);
  });

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="bg-gradient-to-r from-indigo-600 to-purple-600 text-white p-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold flex items-center gap-2">
                <Calendar className="w-6 h-6" />
                Schedule Surgery
              </h2>
              <p className="text-indigo-100 mt-1">Plan a surgical procedure</p>
            </div>
            <button onClick={onClose} className="p-2 hover:bg-white/20 rounded-lg transition">
              <X className="w-6 h-6" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          <div className="space-y-6">
            {/* Patient Selection */}
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">
                Patient <span className="text-red-600">*</span>
              </label>
              <input
                type="text"
                placeholder="Search patient by name or MRN..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full px-4 py-2 border border-slate-300 rounded-xl mb-2 focus:ring-2 focus:ring-indigo-500"
              />
              <select
                value={formData.patientId}
                onChange={(e) => setFormData({ ...formData, patientId: e.target.value })}
                className="w-full px-4 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500"
              >
                <option value="">Select patient...</option>
                {filteredPatients.slice(0, 50).map((patient) => (
                  <option key={patient.id} value={patient.id}>
                    {patient.firstName} {patient.lastName} - MRN: {patient.medicalRecordNumber}
                  </option>
                ))}
              </select>
            </div>

            {/* Date & Time */}
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">
                  Date <span className="text-red-600">*</span>
                </label>
                <input
                  type="date"
                  value={formData.scheduledDate}
                  onChange={(e) => setFormData({ ...formData, scheduledDate: e.target.value })}
                  className="w-full px-4 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">
                  Start Time <span className="text-red-600">*</span>
                </label>
                <input
                  type="time"
                  value={formData.scheduledStartTime}
                  onChange={(e) => setFormData({ ...formData, scheduledStartTime: e.target.value })}
                  className="w-full px-4 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">
                  End Time <span className="text-red-600">*</span>
                </label>
                <input
                  type="time"
                  value={formData.scheduledEndTime}
                  onChange={(e) => setFormData({ ...formData, scheduledEndTime: e.target.value })}
                  className="w-full px-4 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            </div>

            {/* Operating Room */}
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">
                Operating Room <span className="text-red-600">*</span>
              </label>
              <select
                value={formData.operatingRoomId}
                onChange={(e) => setFormData({ ...formData, operatingRoomId: e.target.value })}
                className="w-full px-4 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500"
              >
                <option value="">Select OR...</option>
                {operatingRooms.map((or) => (
                  <option key={or.id} value={or.id}>
                    {or.roomNumber} - {or.roomName} ({or.roomType})
                  </option>
                ))}
              </select>
            </div>

            {/* Procedure */}
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <label className="block text-sm font-semibold text-slate-700 mb-2">
                  Procedure Name <span className="text-red-600">*</span>
                </label>
                <input
                  type="text"
                  value={formData.procedureName}
                  onChange={(e) => setFormData({ ...formData, procedureName: e.target.value })}
                  placeholder="e.g., Laparoscopic Cholecystectomy"
                  className="w-full px-4 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">
                  CPT Code
                </label>
                <input
                  type="text"
                  value={formData.procedureCodeCpt}
                  onChange={(e) => setFormData({ ...formData, procedureCodeCpt: e.target.value })}
                  placeholder="e.g., 47562"
                  className="w-full px-4 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">
                  Surgical Approach
                </label>
                <select
                  value={formData.surgicalApproach}
                  onChange={(e) => setFormData({ ...formData, surgicalApproach: e.target.value })}
                  className="w-full px-4 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="">Select approach...</option>
                  <option value="open">Open</option>
                  <option value="laparoscopic">Laparoscopic</option>
                  <option value="robotic">Robotic</option>
                  <option value="endoscopic">Endoscopic</option>
                  <option value="minimally_invasive">Minimally Invasive</option>
                </select>
              </div>
            </div>

            {/* Diagnosis - Using ICD10Picker */}
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <ICD10Picker
                  value={formData.primaryDiagnosisIcd10}
                  onChange={(code, description) => {
                    setFormData({
                      ...formData,
                      primaryDiagnosisIcd10: code,
                      primaryDiagnosis: description,
                    });
                  }}
                  token={token}
                  tenantSlug={tenantSlug}
                  label="Primary Diagnosis"
                  placeholder="Search: appendicitis, cholecystitis, hernia..."
                  required={true}
                />
              </div>
            </div>

            {/* Staff */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">
                  Primary Surgeon <span className="text-red-600">*</span>
                </label>
                <select
                  value={formData.primarySurgeonId}
                  onChange={(e) => setFormData({ ...formData, primarySurgeonId: e.target.value })}
                  className="w-full px-4 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="">Select surgeon...</option>
                  {surgeons.map((surgeon) => (
                    <option key={surgeon.id} value={surgeon.id}>
                      Dr. {surgeon.firstName} {surgeon.lastName}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">
                  Anesthesiologist
                </label>
                <select
                  value={formData.anesthesiologistId}
                  onChange={(e) => setFormData({ ...formData, anesthesiologistId: e.target.value })}
                  className="w-full px-4 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="">Select anesthesiologist...</option>
                  {surgeons.map((surgeon) => (
                    <option key={surgeon.id} value={surgeon.id}>
                      Dr. {surgeon.firstName} {surgeon.lastName}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Type & Priority */}
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">
                  Procedure Type
                </label>
                <select
                  value={formData.procedureType}
                  onChange={(e) => setFormData({ ...formData, procedureType: e.target.value })}
                  className="w-full px-4 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="elective">Elective</option>
                  <option value="urgent">Urgent</option>
                  <option value="emergent">Emergent</option>
                  <option value="trauma">Trauma</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">
                  Priority
                </label>
                <select
                  value={formData.casePriority}
                  onChange={(e) => setFormData({ ...formData, casePriority: parseInt(e.target.value) })}
                  className="w-full px-4 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="1">1 - Emergent</option>
                  <option value="2">2 - Urgent</option>
                  <option value="3">3 - Routine</option>
                  <option value="4">4 - Elective</option>
                  <option value="5">5 - Optional</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">
                  Anesthesia Type
                </label>
                <select
                  value={formData.anesthesiaType}
                  onChange={(e) => setFormData({ ...formData, anesthesiaType: e.target.value })}
                  className="w-full px-4 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="general">General</option>
                  <option value="regional">Regional</option>
                  <option value="spinal">Spinal</option>
                  <option value="epidural">Epidural</option>
                  <option value="local">Local</option>
                  <option value="MAC">MAC (Monitored Anesthesia Care)</option>
                </select>
              </div>
            </div>

            {/* Laterality */}
            {(formData.procedureName.toLowerCase().includes('knee') ||
              formData.procedureName.toLowerCase().includes('hip') ||
              formData.procedureName.toLowerCase().includes('shoulder') ||
              formData.procedureName.toLowerCase().includes('hand') ||
              formData.procedureName.toLowerCase().includes('foot')) && (
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">
                  Laterality <span className="text-red-600">*</span>
                </label>
                <div className="flex gap-4">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      value="left"
                      checked={formData.laterality === 'left'}
                      onChange={(e) => setFormData({ ...formData, laterality: e.target.value })}
                      className="w-4 h-4 text-indigo-600"
                    />
                    <span className="text-slate-700">Left</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      value="right"
                      checked={formData.laterality === 'right'}
                      onChange={(e) => setFormData({ ...formData, laterality: e.target.value })}
                      className="w-4 h-4 text-indigo-600"
                    />
                    <span className="text-slate-700">Right</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      value="bilateral"
                      checked={formData.laterality === 'bilateral'}
                      onChange={(e) => setFormData({ ...formData, laterality: e.target.value })}
                      className="w-4 h-4 text-indigo-600"
                    />
                    <span className="text-slate-700">Bilateral</span>
                  </label>
                </div>
              </div>
            )}

            {/* Notes */}
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">
                Special Instructions / Notes
              </label>
              <textarea
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                placeholder="Any special requirements or instructions..."
                rows={3}
                className="w-full px-4 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            {/* Warning */}
            <div className="bg-amber-50 border border-amber-300 rounded-xl p-4">
              <div className="flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                <div className="text-sm text-amber-800">
                  <p className="font-semibold mb-1">Pre-Scheduling Checklist:</p>
                  <ul className="list-disc list-inside space-y-1">
                    <li>Surgical consent obtained</li>
                    <li>Pre-operative assessment completed</li>
                    <li>Lab work reviewed</li>
                    <li>NPO status confirmed</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="bg-slate-50 px-6 py-4 flex items-center justify-end gap-3 border-t border-slate-200">
          <button
            onClick={onClose}
            className="px-6 py-2 bg-slate-200 text-slate-700 rounded-xl hover:bg-slate-300 transition-colors font-semibold"
          >
            Cancel
          </button>
          <button
            onClick={handleSchedule}
            disabled={loading}
            className="px-6 py-2 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-xl hover:from-indigo-700 hover:to-purple-700 transition-all font-semibold disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {loading ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                Scheduling...
              </>
            ) : (
              <>
                <Calendar className="w-4 h-4" />
                Schedule Surgery
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ScheduleSurgeryModal;

