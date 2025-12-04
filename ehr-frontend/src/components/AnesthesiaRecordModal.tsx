import React, { useState, useEffect } from 'react';
import { X, Activity, Clock, Syringe, Droplet, AlertCircle, Plus, TrendingUp } from 'lucide-react';
import axios from 'axios';
import { useNotification } from './GlobalNotification';

const ehrAxios = axios.create({ baseURL: 'http://localhost:3013/api' });

interface AnesthesiaRecordModalProps {
  surgicalCase: any;
  tenantSlug: string;
  token: string;
  onUpdate: () => void;
  onClose: () => void;
}

const AnesthesiaRecordModal: React.FC<AnesthesiaRecordModalProps> = ({
  surgicalCase,
  tenantSlug,
  token,
  onUpdate,
  onClose,
}) => {
  const { showError, showSuccess } = useNotification();
  const [recordId, setRecordId] = useState<string | null>(null);
  const [vitals, setVitals] = useState<any[]>([]);
  const [medications, setMedications] = useState<any[]>([]);
  const [events, setEvents] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [showVitalsForm, setShowVitalsForm] = useState(false);
  const [showMedForm, setShowMedForm] = useState(false);
  const [showEventForm, setShowEventForm] = useState(false);

  const [vitalsData, setVitalsData] = useState({
    heartRate: '',
    bloodPressureSystolic: '',
    bloodPressureDiastolic: '',
    spo2: '',
    etco2: '',
    temperature: '',
  });

  const [medData, setMedData] = useState({
    medication: '',
    dose: '',
    unit: 'mg',
    route: 'IV',
  });

  const [eventData, setEventData] = useState({
    description: '',
    severity: 'normal',
  });

  const [fluids, setFluids] = useState({
    crystalloids: 0,
    colloids: 0,
    ebl: 0,
  });

  useEffect(() => {
    loadAnesthesiaRecord();
  }, []);

  const loadAnesthesiaRecord = async () => {
    try {
      const caseId = surgicalCase.id || surgicalCase.caseid;
      const response = await ehrAxios.get(`/anesthesia/record/case/${caseId}`, {
        headers: { 'X-Tenant-ID': tenantSlug, Authorization: `Bearer ${token}` },
      });
      
      setRecordId(response.data.id);
      setMedications(response.data.medicationsAdministered || []);
      setEvents(response.data.intraopEvents || []);
      setFluids({
        crystalloids: response.data.crystalloidsMl || 0,
        colloids: response.data.colloidsMl || 0,
        ebl: response.data.estimatedBloodLoss || 0,
      });

      // Load vitals
      const vitalsResponse = await ehrAxios.get(`/anesthesia/record/${response.data.id}/vitals`, {
        headers: { 'X-Tenant-ID': tenantSlug, Authorization: `Bearer ${token}` },
      });
      setVitals(vitalsResponse.data || []);
    } catch (error: any) {
      if (error.response?.status === 404) {
        // No record yet, that's ok
      }
    }
  };

  const handleStartRecord = async () => {
    try {
      setLoading(true);
      const response = await ehrAxios.post('/anesthesia/record/start', {
        surgicalCaseId: surgicalCase.id || surgicalCase.caseid,
        patientId: surgicalCase.patient_id || surgicalCase.patientid,
        anesthesiaType: 'general',
      }, {
        headers: { 'X-Tenant-ID': tenantSlug, Authorization: `Bearer ${token}` },
      });
      
      setRecordId(response.data.id);
      showSuccess('Success', 'Anesthesia record started');
    } catch (error: any) {
      showError('Error', error.response?.data?.message || 'Failed to start record');
    } finally {
      setLoading(false);
    }
  };

  const handleRecordVitals = async () => {
    if (!recordId) return;

    try {
      await ehrAxios.post(`/anesthesia/record/${recordId}/vitals`, {
        heartRate: vitalsData.heartRate ? parseInt(vitalsData.heartRate) : null,
        bloodPressureSystolic: vitalsData.bloodPressureSystolic ? parseInt(vitalsData.bloodPressureSystolic) : null,
        bloodPressureDiastolic: vitalsData.bloodPressureDiastolic ? parseInt(vitalsData.bloodPressureDiastolic) : null,
        spo2: vitalsData.spo2 ? parseInt(vitalsData.spo2) : null,
        etco2: vitalsData.etco2 ? parseInt(vitalsData.etco2) : null,
        temperature: vitalsData.temperature ? parseFloat(vitalsData.temperature) : null,
      }, {
        headers: { 'X-Tenant-ID': tenantSlug, Authorization: `Bearer ${token}` },
      });

      showSuccess('Success', 'Vitals recorded');
      setShowVitalsForm(false);
      setVitalsData({
        heartRate: '',
        bloodPressureSystolic: '',
        bloodPressureDiastolic: '',
        spo2: '',
        etco2: '',
        temperature: '',
      });
      loadAnesthesiaRecord();
    } catch (error: any) {
      showError('Error', error.response?.data?.message || 'Failed to record vitals');
    }
  };

  const handleRecordMedication = async (quickMed?: { medication: string; dose: string; unit: string }) => {
    if (!recordId) return;

    const med = quickMed || medData;

    try {
      await ehrAxios.post(`/anesthesia/record/${recordId}/medication`, {
        medication: med.medication,
        dose: med.dose,
        unit: med.unit,
        route: medData.route,
      }, {
        headers: { 'X-Tenant-ID': tenantSlug, Authorization: `Bearer ${token}` },
      });

      showSuccess('Success', `${med.medication} recorded`);
      setShowMedForm(false);
      setMedData({ medication: '', dose: '', unit: 'mg', route: 'IV' });
      loadAnesthesiaRecord();
    } catch (error: any) {
      showError('Error', error.response?.data?.message || 'Failed to record medication');
    }
  };

  const handleRecordEvent = async () => {
    if (!recordId) return;

    try {
      await ehrAxios.post(`/anesthesia/record/${recordId}/event`, {
        description: eventData.description,
        severity: eventData.severity,
      }, {
        headers: { 'X-Tenant-ID': tenantSlug, Authorization: `Bearer ${token}` },
      });

      showSuccess('Success', 'Event recorded');
      setShowEventForm(false);
      setEventData({ description: '', severity: 'normal' });
      loadAnesthesiaRecord();
    } catch (error: any) {
      showError('Error', error.response?.data?.message || 'Failed to record event');
    }
  };

  const handleCompleteAnesthesia = async () => {
    if (!recordId) return;

    try {
      await ehrAxios.post(`/anesthesia/record/${recordId}/complete`, {}, {
        headers: { 'X-Tenant-ID': tenantSlug, Authorization: `Bearer ${token}` },
      });

      showSuccess('Success', 'Anesthesia completed');
      onUpdate();
      onClose();
    } catch (error: any) {
      showError('Error', error.response?.data?.message || 'Failed to complete anesthesia');
    }
  };

  const quickMeds = [
    { medication: 'Fentanyl', dose: '100', unit: 'mcg' },
    { medication: 'Propofol', dose: '200', unit: 'mg' },
    { medication: 'Rocuronium', dose: '50', unit: 'mg' },
    { medication: 'Atropine', dose: '0.5', unit: 'mg' },
    { medication: 'Ephedrine', dose: '10', unit: 'mg' },
    { medication: 'Glycopyrrolate', dose: '0.2', unit: 'mg' },
  ];

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-6xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="bg-gradient-to-r from-purple-600 to-violet-600 text-white p-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold flex items-center gap-2">
                <Activity className="w-6 h-6" />
                Intraoperative Anesthesia Record
              </h2>
              <p className="text-purple-100 mt-1">
                {surgicalCase.patient_first_name} {surgicalCase.patient_last_name} - {surgicalCase.procedure_name}
              </p>
            </div>
            <button onClick={onClose} className="p-2 hover:bg-white/20 rounded-lg transition">
              <X className="w-6 h-6" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {!recordId ? (
            <div className="text-center py-12">
              <Activity className="w-16 h-16 text-purple-500 mx-auto mb-4" />
              <h3 className="text-xl font-bold text-slate-900 mb-2">Start Anesthesia Record</h3>
              <p className="text-slate-600 mb-4">Click below to begin intraoperative documentation</p>
              <button
                onClick={handleStartRecord}
                disabled={loading}
                className="px-8 py-3 bg-gradient-to-r from-purple-600 to-violet-600 text-white rounded-xl hover:from-purple-700 hover:to-violet-700 transition-all font-semibold"
              >
                {loading ? 'Starting...' : 'Start Anesthesia Record'}
              </button>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Vitals Chart */}
              <div className="bg-slate-50 rounded-xl p-4 border border-slate-200">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-bold text-slate-900 flex items-center gap-2">
                    <TrendingUp className="w-5 h-5 text-purple-600" />
                    Vitals Timeline
                  </h3>
                  <button
                    onClick={() => setShowVitalsForm(!showVitalsForm)}
                    className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors text-sm font-semibold flex items-center gap-1"
                  >
                    <Plus className="w-4 h-4" />
                    Record Vitals
                  </button>
                </div>

                {showVitalsForm && (
                  <div className="bg-white rounded-lg p-4 mb-3 border border-purple-200">
                    <div className="grid grid-cols-6 gap-3 mb-3">
                      <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-1">HR</label>
                        <input
                          type="number"
                          value={vitalsData.heartRate}
                          onChange={(e) => setVitalsData({ ...vitalsData, heartRate: e.target.value })}
                          placeholder="75"
                          className="w-full px-2 py-1 border border-slate-300 rounded text-sm"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-1">SBP</label>
                        <input
                          type="number"
                          value={vitalsData.bloodPressureSystolic}
                          onChange={(e) => setVitalsData({ ...vitalsData, bloodPressureSystolic: e.target.value })}
                          placeholder="120"
                          className="w-full px-2 py-1 border border-slate-300 rounded text-sm"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-1">DBP</label>
                        <input
                          type="number"
                          value={vitalsData.bloodPressureDiastolic}
                          onChange={(e) => setVitalsData({ ...vitalsData, bloodPressureDiastolic: e.target.value })}
                          placeholder="80"
                          className="w-full px-2 py-1 border border-slate-300 rounded text-sm"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-1">SpO2</label>
                        <input
                          type="number"
                          value={vitalsData.spo2}
                          onChange={(e) => setVitalsData({ ...vitalsData, spo2: e.target.value })}
                          placeholder="98"
                          className="w-full px-2 py-1 border border-slate-300 rounded text-sm"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-1">EtCO2</label>
                        <input
                          type="number"
                          value={vitalsData.etco2}
                          onChange={(e) => setVitalsData({ ...vitalsData, etco2: e.target.value })}
                          placeholder="35"
                          className="w-full px-2 py-1 border border-slate-300 rounded text-sm"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-1">Temp</label>
                        <input
                          type="number"
                          step="0.1"
                          value={vitalsData.temperature}
                          onChange={(e) => setVitalsData({ ...vitalsData, temperature: e.target.value })}
                          placeholder="36.5"
                          className="w-full px-2 py-1 border border-slate-300 rounded text-sm"
                        />
                      </div>
                    </div>
                    <button
                      onClick={handleRecordVitals}
                      className="w-full px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors text-sm font-semibold"
                    >
                      Save Vitals
                    </button>
                  </div>
                )}

                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-slate-200">
                        <th className="text-left py-2 px-2 text-slate-600">Time</th>
                        <th className="text-left py-2 px-2 text-slate-600">HR</th>
                        <th className="text-left py-2 px-2 text-slate-600">BP</th>
                        <th className="text-left py-2 px-2 text-slate-600">SpO2</th>
                        <th className="text-left py-2 px-2 text-slate-600">EtCO2</th>
                        <th className="text-left py-2 px-2 text-slate-600">Temp</th>
                      </tr>
                    </thead>
                    <tbody>
                      {vitals.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="text-center py-4 text-slate-500">
                            No vitals recorded yet
                          </td>
                        </tr>
                      ) : (
                        vitals.map((v, idx) => (
                          <tr key={idx} className="border-b border-slate-100">
                            <td className="py-2 px-2 font-medium">{new Date(v.chartTime).toLocaleTimeString()}</td>
                            <td className="py-2 px-2">{v.heartRate || '-'}</td>
                            <td className="py-2 px-2">
                              {v.bloodPressureSystolic && v.bloodPressureDiastolic
                                ? `${v.bloodPressureSystolic}/${v.bloodPressureDiastolic}`
                                : '-'}
                            </td>
                            <td className="py-2 px-2">{v.spo2 ? `${v.spo2}%` : '-'}</td>
                            <td className="py-2 px-2">{v.etco2 || '-'}</td>
                            <td className="py-2 px-2">{v.temperature ? `${v.temperature}°C` : '-'}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Quick Medications */}
              <div>
                <h3 className="font-bold text-slate-900 mb-3 flex items-center gap-2">
                  <Syringe className="w-5 h-5 text-purple-600" />
                  Quick Medications
                </h3>
                <div className="grid grid-cols-3 gap-2 mb-3">
                  {quickMeds.map((med) => (
                    <button
                      key={med.medication}
                      onClick={() => handleRecordMedication(med)}
                      className="px-4 py-2 bg-purple-100 text-purple-700 rounded-lg hover:bg-purple-200 transition-colors text-sm font-semibold"
                    >
                      {med.medication} {med.dose}{med.unit}
                    </button>
                  ))}
                </div>
                <button
                  onClick={() => setShowMedForm(!showMedForm)}
                  className="w-full px-4 py-2 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 transition-colors text-sm font-semibold"
                >
                  + Custom Medication
                </button>

                {showMedForm && (
                  <div className="mt-3 bg-white rounded-lg p-4 border border-slate-200">
                    <div className="grid grid-cols-4 gap-3 mb-3">
                      <input
                        type="text"
                        value={medData.medication}
                        onChange={(e) => setMedData({ ...medData, medication: e.target.value })}
                        placeholder="Medication"
                        className="col-span-2 px-3 py-2 border border-slate-300 rounded-lg text-sm"
                      />
                      <input
                        type="text"
                        value={medData.dose}
                        onChange={(e) => setMedData({ ...medData, dose: e.target.value })}
                        placeholder="Dose"
                        className="px-3 py-2 border border-slate-300 rounded-lg text-sm"
                      />
                      <select
                        value={medData.unit}
                        onChange={(e) => setMedData({ ...medData, unit: e.target.value })}
                        className="px-3 py-2 border border-slate-300 rounded-lg text-sm"
                      >
                        <option value="mg">mg</option>
                        <option value="mcg">mcg</option>
                        <option value="mL">mL</option>
                        <option value="units">units</option>
                      </select>
                    </div>
                    <button
                      onClick={() => handleRecordMedication()}
                      className="w-full px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors text-sm font-semibold"
                    >
                      Record Medication
                    </button>
                  </div>
                )}

                {medications.length > 0 && (
                  <div className="mt-3 space-y-2">
                    <p className="text-sm font-semibold text-slate-700">Recent Medications:</p>
                    {medications.slice(-5).reverse().map((med, idx) => (
                      <div key={idx} className="text-sm text-slate-600 flex items-center gap-2">
                        <Clock className="w-3 h-3" />
                        <span className="font-medium">{new Date(med.time).toLocaleTimeString()}</span>
                        <span>- {med.medication} {med.dose}{med.unit} {med.route}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Fluid Balance */}
              <div>
                <h3 className="font-bold text-slate-900 mb-3 flex items-center gap-2">
                  <Droplet className="w-5 h-5 text-blue-600" />
                  Fluid Balance
                </h3>
                <div className="grid grid-cols-3 gap-4">
                  <div className="bg-blue-50 rounded-lg p-3">
                    <p className="text-sm text-slate-600">Crystalloids</p>
                    <p className="text-2xl font-bold text-blue-600">{fluids.crystalloids} mL</p>
                  </div>
                  <div className="bg-purple-50 rounded-lg p-3">
                    <p className="text-sm text-slate-600">Colloids</p>
                    <p className="text-2xl font-bold text-purple-600">{fluids.colloids} mL</p>
                  </div>
                  <div className="bg-red-50 rounded-lg p-3">
                    <p className="text-sm text-slate-600">Blood Loss</p>
                    <p className="text-2xl font-bold text-red-600">{fluids.ebl} mL</p>
                  </div>
                </div>
              </div>

              {/* Events */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-bold text-slate-900 flex items-center gap-2">
                    <AlertCircle className="w-5 h-5 text-orange-600" />
                    Events
                  </h3>
                  <button
                    onClick={() => setShowEventForm(!showEventForm)}
                    className="px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors text-sm font-semibold"
                  >
                    + Add Event
                  </button>
                </div>

                {showEventForm && (
                  <div className="mb-3 bg-white rounded-lg p-4 border border-slate-200">
                    <textarea
                      value={eventData.description}
                      onChange={(e) => setEventData({ ...eventData, description: e.target.value })}
                      placeholder="Describe the event..."
                      rows={2}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm mb-2"
                    />
                    <button
                      onClick={handleRecordEvent}
                      className="w-full px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors text-sm font-semibold"
                    >
                      Record Event
                    </button>
                  </div>
                )}

                {events.length > 0 ? (
                  <div className="space-y-2">
                    {events.reverse().map((event, idx) => (
                      <div key={idx} className="bg-slate-50 rounded-lg p-3 border border-slate-200">
                        <div className="flex items-center gap-2 text-sm">
                          <Clock className="w-3 h-3 text-slate-500" />
                          <span className="font-medium">{new Date(event.time).toLocaleTimeString()}</span>
                          <span className="text-slate-600">- {event.description}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-slate-500">No events recorded</p>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        {recordId && (
          <div className="bg-slate-50 px-6 py-4 flex items-center justify-end gap-3 border-t border-slate-200">
            <button
              onClick={onClose}
              className="px-6 py-2 bg-slate-200 text-slate-700 rounded-xl hover:bg-slate-300 transition-colors font-semibold"
            >
              Close
            </button>
            <button
              onClick={handleCompleteAnesthesia}
              className="px-6 py-2 bg-gradient-to-r from-green-600 to-emerald-600 text-white rounded-xl hover:from-green-700 hover:to-emerald-700 transition-all font-semibold"
            >
              Complete Anesthesia
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default AnesthesiaRecordModal;

