import React, { useState } from 'react';
import { Activity, Save, User, X, AlertCircle } from 'lucide-react';
import { ehrApi } from '../services/api';
import { useNotification } from './GlobalNotification';

interface CervicalCancerScreeningComponentProps {
  tenantSlug: string;
}

const CervicalCancerScreeningComponent: React.FC<CervicalCancerScreeningComponentProps> = ({ tenantSlug }) => {
  const { showSuccess, showError } = useNotification();
  const [selectedPatient, setSelectedPatient] = useState<any>(null);
  const [patients, setPatients] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(false);

  const [form, setForm] = useState({
    screeningDate: new Date().toISOString().split('T')[0],
    screeningMethod: 'via',
    screeningResult: '',
    viaResult: '',
    papResult: '',
    hpvResult: '',
    notes: ''
  });

  const searchPatients = async () => {
    if (!searchTerm.trim()) {
      setPatients([]);
      return;
    }
    
    try {
      const token = localStorage.getItem('ehr_token');
      if (!token) return;
      
      setLoading(true);
      const response = await ehrApi.searchPatients(searchTerm, token, tenantSlug);
      setPatients(response.data || []);
    } catch (error) {
      showError('Error', 'Failed to search patients');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async () => {
    if (!selectedPatient) {
      showError('Error', 'Please select a patient');
      return;
    }

    // Validate gender - cervical cancer screening only for females
    const gender = selectedPatient.gender?.toLowerCase();
    if (gender === 'male') {
      showError('Invalid Selection', 'Cervical cancer screening is only available for female patients. Please select a female patient.');
      setSelectedPatient(null);
      return;
    }

    try {
      const token = localStorage.getItem('ehr_token');
      const currentUser = JSON.parse(localStorage.getItem('ehr_user') || '{}');
      
      if (!token) return;

      setLoading(true);
      await ehrApi.createCervicalCancerScreening({
        patientId: selectedPatient.id,
        screeningDate: form.screeningDate,
        screeningMethod: form.screeningMethod,
        screeningResult: form.screeningResult || null,
        viaResult: form.screeningMethod === 'via' ? form.viaResult : null,
        papResult: form.screeningMethod === 'pap_smear' ? form.papResult : null,
        hpvResult: form.screeningMethod === 'hpv_test' ? form.hpvResult : null,
        screenedBy: currentUser.id,
        notes: form.notes
      }, token, tenantSlug);

      showSuccess('Success', 'Cervical cancer screening recorded');
      
      // Clear form
      setForm({
        screeningDate: new Date().toISOString().split('T')[0],
        screeningMethod: 'via',
        screeningResult: '',
        viaResult: '',
        papResult: '',
        hpvResult: '',
        notes: ''
      });
    } catch (error: any) {
      showError('Error', error.response?.data?.message || 'Failed to record screening');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-gradient-to-r from-pink-600 to-rose-700 rounded-2xl shadow-lg p-6 text-white">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold mb-2">Cervical Cancer Screening</h2>
            <p className="text-pink-100">Screen patients for cervical cancer</p>
          </div>
          <Activity className="w-12 h-12 opacity-80" />
        </div>
      </div>

      {/* Patient Search */}
      <div className="bg-white rounded-xl shadow-lg p-6 border border-slate-200">
        <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <User className="w-5 h-5 text-pink-600" />
          Select Patient
        </h3>
        <div className="flex gap-3">
          <input
            type="text"
            placeholder="Search by name or patient number..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && searchPatients()}
            className="flex-1 px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-pink-500"
          />
          <button
            onClick={searchPatients}
            disabled={loading || !searchTerm.trim()}
            className="px-6 py-2 bg-pink-600 text-white rounded-lg hover:bg-pink-700 disabled:opacity-50"
          >
            {loading ? 'Searching...' : 'Search'}
          </button>
        </div>

        {patients.length > 0 && (
          <div className="mt-4 space-y-2">
            {patients
              .filter((patient) => {
                // Only show female patients for cervical cancer screening
                const gender = patient.gender?.toLowerCase();
                return gender === 'female' || gender === 'other' || !gender;
              })
              .map((patient) => (
                <button
                  key={patient.id}
                  onClick={() => {
                    // Double-check gender before selection
                    const gender = patient.gender?.toLowerCase();
                    if (gender === 'male') {
                      showError('Invalid Selection', 'Cervical cancer screening is only available for female patients.');
                      return;
                    }
                    setSelectedPatient(patient);
                    setPatients([]);
                    setSearchTerm(`${patient.firstName} ${patient.lastName}`);
                  }}
                  className="w-full p-3 text-left border border-slate-200 rounded-lg hover:bg-pink-50"
                >
                  <div className="font-semibold">{patient.firstName} {patient.lastName}</div>
                  <div className="text-sm text-slate-600">ID: {patient.patientNumber} {patient.gender && `• ${patient.gender}`}</div>
                </button>
              ))}
            {patients.some((p) => p.gender?.toLowerCase() === 'male') && (
              <div className="mt-2 p-3 bg-amber-50 border border-amber-200 rounded-lg flex items-start gap-2">
                <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                <div className="text-sm text-amber-800">
                  <strong>Note:</strong> Male patients are not shown. Cervical cancer screening is only available for female patients.
                </div>
              </div>
            )}
          </div>
        )}

        {selectedPatient && (
          <div className={`mt-4 p-4 rounded-lg border-2 ${
            selectedPatient.gender?.toLowerCase() === 'male' 
              ? 'bg-red-50 border-red-300' 
              : 'bg-pink-50 border-pink-200'
          }`}>
            {selectedPatient.gender?.toLowerCase() === 'male' ? (
              <div className="flex items-start gap-3">
                <AlertCircle className="w-6 h-6 text-red-600 flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <div className="font-semibold text-red-900 mb-1">{selectedPatient.firstName} {selectedPatient.lastName}</div>
                  <div className="text-sm text-red-700 mb-2">ID: {selectedPatient.patientNumber} • Gender: {selectedPatient.gender}</div>
                  <div className="text-sm font-medium text-red-800 bg-red-100 p-2 rounded">
                    ⚠️ Cervical cancer screening is not available for male patients. Please select a female patient.
                  </div>
                </div>
                <button onClick={() => setSelectedPatient(null)} className="text-red-600 hover:text-red-800">
                  <X className="w-5 h-5" />
                </button>
              </div>
            ) : (
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-semibold">{selectedPatient.firstName} {selectedPatient.lastName}</div>
                  <div className="text-sm text-pink-700">ID: {selectedPatient.patientNumber} {selectedPatient.gender && `• ${selectedPatient.gender}`}</div>
                </div>
                <button onClick={() => setSelectedPatient(null)} className="text-pink-600">
                  <X className="w-5 h-5" />
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Screening Form */}
      {selectedPatient && selectedPatient.gender?.toLowerCase() !== 'male' && (
        <div className="bg-white rounded-xl shadow-lg p-6 border border-slate-200">
          <h3 className="text-lg font-semibold mb-4">Screening Details</h3>
          
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-2">Screening Date</label>
              <input
                type="date"
                value={form.screeningDate}
                onChange={(e) => setForm({ ...form, screeningDate: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Screening Method</label>
              <select
                value={form.screeningMethod}
                onChange={(e) => setForm({ ...form, screeningMethod: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg"
              >
                <option value="via">VIA (Visual Inspection with Acetic Acid)</option>
                <option value="pap_smear">Pap Smear</option>
                <option value="hpv_test">HPV Test</option>
                <option value="colposcopy">Colposcopy</option>
              </select>
            </div>

            {form.screeningMethod === 'via' && (
              <div>
                <label className="block text-sm font-medium mb-2">VIA Result</label>
                <select
                  value={form.viaResult}
                  onChange={(e) => setForm({ ...form, viaResult: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                >
                  <option value="">Select result...</option>
                  <option value="normal">Normal</option>
                  <option value="abnormal">Abnormal</option>
                  <option value="suspicious">Suspicious</option>
                </select>
              </div>
            )}

            {form.screeningMethod === 'pap_smear' && (
              <div>
                <label className="block text-sm font-medium mb-2">Pap Smear Result</label>
                <select
                  value={form.papResult}
                  onChange={(e) => setForm({ ...form, papResult: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                >
                  <option value="">Select result...</option>
                  <option value="normal">Normal</option>
                  <option value="ascus">ASCUS</option>
                  <option value="lsil">LSIL</option>
                  <option value="hsil">HSIL</option>
                  <option value="cancer">Cancer</option>
                </select>
              </div>
            )}

            {form.screeningMethod === 'hpv_test' && (
              <div>
                <label className="block text-sm font-medium mb-2">HPV Test Result</label>
                <select
                  value={form.hpvResult}
                  onChange={(e) => setForm({ ...form, hpvResult: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                >
                  <option value="">Select result...</option>
                  <option value="negative">Negative</option>
                  <option value="positive">Positive</option>
                  <option value="positive_hr">Positive (High Risk)</option>
                </select>
              </div>
            )}

            <div>
              <label className="block text-sm font-medium mb-2">Overall Screening Result</label>
              <select
                value={form.screeningResult}
                onChange={(e) => setForm({ ...form, screeningResult: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg"
              >
                <option value="">Select result...</option>
                <option value="normal">Normal</option>
                <option value="abnormal">Abnormal</option>
                <option value="positive">Positive</option>
                <option value="suspicious">Suspicious</option>
                <option value="pending">Pending</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Notes</label>
              <textarea
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                rows={3}
                placeholder="Additional notes..."
              />
            </div>

            <button
              onClick={handleSubmit}
              disabled={loading}
              className="w-full px-6 py-3 bg-pink-600 text-white rounded-lg hover:bg-pink-700 disabled:opacity-50 flex items-center justify-center gap-2 font-semibold"
            >
              <Save className="w-5 h-5" />
              {loading ? 'Recording...' : 'Record Screening'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default CervicalCancerScreeningComponent;

