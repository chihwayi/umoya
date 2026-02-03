import React, { useState, useEffect } from 'react';
import { X, Activity, Clock, Syringe, AlertCircle, TrendingUp, Plus } from 'lucide-react';
import { useNotification } from './GlobalNotification';
import { ehrAxios } from '../services/api';

interface AnesthesiaRecordModalProps {
  surgicalCase: any;
  tenantSlug: string;
  token: string;
  onClose: () => void;
}

const AnesthesiaRecordModal: React.FC<AnesthesiaRecordModalProps> = ({
  surgicalCase,
  tenantSlug,
  token,
  onClose,
}) => {
  const { showError, showSuccess } = useNotification();
  const [recordId, setRecordId] = useState<string | null>(null);
  const [vitals, setVitals] = useState<any[]>([]);
  const [medications, setMedications] = useState<any[]>([]);
  const [events, setEvents] = useState<any[]>([]);
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
    severity: 'minor',
  });

  useEffect(() => {
    loadAnesthesiaRecord();
  }, []);

  useEffect(() => {
    if (recordId) {
      const interval = setInterval(() => {
        loadVitals();
      }, 30000); // Refresh every 30 seconds
      return () => clearInterval(interval);
    }
  }, [recordId]);

  const loadAnesthesiaRecord = async () => {
    try {
      const caseId = surgicalCase.id || surgicalCase.caseid;
      const response = await ehrAxios.get(`/anesthesia/record/case/${caseId}`, {
        headers: { 'X-Tenant-ID': tenantSlug, Authorization: `Bearer ${token}` },
      });
      setRecordId(response.data.id);
      setMedications(response.data.medicationsAdministered || []);
      setEvents(response.data.intraopEvents || []);
      await loadVitals(response.data.id);
    } catch (error: any) {
      if (error.response?.status === 404) {
        // No record yet, that's okay
      } else {
        showError('Error', 'Failed to load anesthesia record');
      }
    }
  };

  const loadVitals = async (id?: string) => {
    const vitalsRecordId = id || recordId;
    if (!vitalsRecordId) return;

    try {
      const response = await ehrAxios.get(`/anesthesia/record/${vitalsRecordId}/vitals`, {
        headers: { 'X-Tenant-ID': tenantSlug, Authorization: `Bearer ${token}` },
      });
      setVitals(response.data);
    } catch (error) {
      // Silent fail for vitals
    }
  };

  const handleRecordVitals = async () => {
    if (!recordId) {
      showError('Error', 'No active anesthesia record');
      return;
    }

    try {
      const vitalsPayload = {
        heartRate: vitalsData.heartRate ? parseInt(vitalsData.heartRate) : null,
        bloodPressureSystolic: vitalsData.bloodPressureSystolic ? parseInt(vitalsData.bloodPressureSystolic) : null,
        bloodPressureDiastolic: vitalsData.bloodPressureDiastolic ? parseInt(vitalsData.bloodPressureDiastolic) : null,
        spo2: vitalsData.spo2 ? parseInt(vitalsData.spo2) : null,
        etco2: vitalsData.etco2 ? parseInt(vitalsData.etco2) : null,
        temperature: vitalsData.temperature ? parseFloat(vitalsData.temperature) : null,
      };

      await ehrAxios.post(`/anesthesia/record/${recordId}/vitals`, vitalsPayload, {
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
      await loadVitals();
    } catch (error: any) {
      showError('Error', error.response?.data?.message || 'Failed to record vitals');
    }
  };

  const handleRecordMedication = async () => {
    if (!recordId) {
      showError('Error', 'No active anesthesia record');
      return;
    }

    if (!medData.medication || !medData.dose) {
      showError('Error', 'Please enter medication and dose');
      return;
    }

    try {
      await ehrAxios.post(`/anesthesia/record/${recordId}/medication`, medData, {
        headers: { 'X-Tenant-ID': tenantSlug, Authorization: `Bearer ${token}` },
      });

      showSuccess('Success', 'Medication recorded');
      setShowMedForm(false);
      setMedData({ medication: '', dose: '', unit: 'mg', route: 'IV' });
      await loadAnesthesiaRecord();
    } catch (error: any) {
      showError('Error', error.response?.data?.message || 'Failed to record medication');
    }
  };

  const handleRecordEvent = async () => {
    if (!recordId) {
      showError('Error', 'No active anesthesia record');
      return;
    }

    if (!eventData.description) {
      showError('Error', 'Please enter event description');
      return;
    }

    try {
      await ehrAxios.post(`/anesthesia/record/${recordId}/event`, eventData, {
        headers: { 'X-Tenant-ID': tenantSlug, Authorization: `Bearer ${token}` },
      });

      showSuccess('Success', 'Event recorded');
      setShowEventForm(false);
      setEventData({ description: '', severity: 'minor' });
      await loadAnesthesiaRecord();
    } catch (error: any) {
      showError('Error', error.response?.data?.message || 'Failed to record event');
    }
  };

  const quickMeds = [
    { name: 'Propofol', dose: '200', unit: 'mg' },
    { name: 'Fentanyl', dose: '100', unit: 'mcg' },
    { name: 'Rocuronium', dose: '50', unit: 'mg' },
    { name: 'Atropine', dose: '0.5', unit: 'mg' },
    { name: 'Ephedrine', dose: '10', unit: 'mg' },
    { name: 'Glycopyrrolate', dose: '0.2', unit: 'mg' },
  ];

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-6xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="bg-gradient-to-r from-purple-600 to-violet-600 text-white p-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold flex items-center gap-2">
                <Activity className="w-6 h-6 animate-pulse" />
                Intraoperative Anesthesia Record
              </h2>
              <p className="text-purple-100 mt-1">
                {surgicalCase.patient_first_name} {surgicalCase.patient_last_name} - Real-time monitoring
              </p>
            </div>
            <button onClick={onClose} className="p-2 hover:bg-white/20 rounded-lg transition">
              <X className="w-6 h-6" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          <div className="space-y-6">
            {/* Vitals Chart */}
            <div className="bg-slate-50 rounded-xl border-2 border-slate-200 overflow-hidden">
              <div className="bg-gradient-to-r from-indigo-500 to-purple-500 text-white p-4">
                <div className="flex items-center justify-between">
                  <h3 className="font-bold flex items-center gap-2">
                    <TrendingUp className="w-5 h-5" />
                    Vital Signs (Every 5 Minutes)
                  </h3>
                  <button
                    onClick={() => setShowVitalsForm(!showVitalsForm)}
                    className="px-4 py-2 bg-white/20 hover:bg-white/30 rounded-lg text-sm font-semibold transition"
                  >
                    {showVitalsForm ? 'Hide Form' : '+ Record Vitals'}
                  </button>
                </div>
              </div>

              {showVitalsForm && (
                <div className="p-4 bg-indigo-50 border-b border-indigo-200">
                  <div className="grid grid-cols-6 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">HR</label>
                      <input
                        type="number"
                        value={vitalsData.heartRate}
                        onChange={(e) => setVitalsData({ ...vitalsData, heartRate: e.target.value })}
                        placeholder="75"
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">SBP</label>
                      <input
                        type="number"
                        value={vitalsData.bloodPressureSystolic}
                        onChange={(e) => setVitalsData({ ...vitalsData, bloodPressureSystolic: e.target.value })}
                        placeholder="120"
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">DBP</label>
                      <input
                        type="number"
                        value={vitalsData.bloodPressureDiastolic}
                        onChange={(e) => setVitalsData({ ...vitalsData, bloodPressureDiastolic: e.target.value })}
                        placeholder="80"
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">SpO2</label>
                      <input
                        type="number"
                        value={vitalsData.spo2}
                        onChange={(e) => setVitalsData({ ...vitalsData, spo2: e.target.value })}
                        placeholder="98"
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">EtCO2</label>
                      <input
                        type="number"
                        value={vitalsData.etco2}
                        onChange={(e) => setVitalsData({ ...vitalsData, etco2: e.target.value })}
                        placeholder="35"
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
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
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                      />
                    </div>
                  </div>
                  <button
                    onClick={handleRecordVitals}
                    className="mt-3 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 text-sm font-semibold"
                  >
                    Save Vitals
                  </button>
                </div>
              )}

              <div className="p-4">
                {vitals.length === 0 ? (
                  <div className="text-center py-8 text-slate-500">
                    <Clock className="w-12 h-12 mx-auto mb-2 opacity-50" />
                    <p>No vitals recorded yet</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-slate-200">
                          <th className="text-left py-2 px-3 font-semibold text-slate-700">Time</th>
                          <th className="text-center py-2 px-3 font-semibold text-slate-700">HR</th>
                          <th className="text-center py-2 px-3 font-semibold text-slate-700">BP</th>
                          <th className="text-center py-2 px-3 font-semibold text-slate-700">SpO2</th>
                          <th className="text-center py-2 px-3 font-semibold text-slate-700">EtCO2</th>
                          <th className="text-center py-2 px-3 font-semibold text-slate-700">Temp</th>
                        </tr>
                      </thead>
                      <tbody>
                        {vitals.slice(-10).reverse().map((vital, idx) => (
                          <tr key={idx} className="border-b border-slate-100">
                            <td className="py-2 px-3">{new Date(vital.chartTime).toLocaleTimeString()}</td>
                            <td className="text-center py-2 px-3">{vital.heartRate || '-'}</td>
                            <td className="text-center py-2 px-3">
                              {vital.bloodPressureSystolic && vital.bloodPressureDiastolic
                                ? `${vital.bloodPressureSystolic}/${vital.bloodPressureDiastolic}`
                                : '-'}
                            </td>
                            <td className="text-center py-2 px-3">{vital.spo2 ? `${vital.spo2}%` : '-'}</td>
                            <td className="text-center py-2 px-3">{vital.etco2 || '-'}</td>
                            <td className="text-center py-2 px-3">{vital.temperature ? `${vital.temperature}°C` : '-'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>

            {/* Quick Medications */}
            <div>
              <h3 className="font-bold text-slate-900 mb-3 flex items-center gap-2">
                <Syringe className="w-5 h-5 text-purple-600" />
                Quick Medications
              </h3>
              <div className="grid grid-cols-3 gap-2">
                {quickMeds.map((med) => (
                  <button
                    key={med.name}
                    onClick={() => {
                      setMedData({ medication: med.name, dose: med.dose, unit: med.unit, route: 'IV' });
                      setShowMedForm(true);
                    }}
                    className="px-4 py-2 bg-purple-100 hover:bg-purple-200 text-purple-700 rounded-lg text-sm font-semibold transition"
                  >
                    {med.name}
                  </button>
                ))}
              </div>
              <button
                onClick={() => setShowMedForm(!showMedForm)}
                className="mt-2 text-sm text-purple-600 hover:text-purple-700 font-semibold"
              >
                + Custom Medication
              </button>

              {showMedForm && (
                <div className="mt-3 bg-purple-50 rounded-xl p-4 border border-purple-200">
                  <div className="grid grid-cols-4 gap-3">
                    <div className="col-span-2">
                      <label className="block text-sm font-semibold text-slate-700 mb-1">Medication</label>
                      <input
                        type="text"
                        value={medData.medication}
                        onChange={(e) => setMedData({ ...medData, medication: e.target.value })}
                        placeholder="e.g., Fentanyl"
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-slate-700 mb-1">Dose</label>
                      <input
                        type="text"
                        value={medData.dose}
                        onChange={(e) => setMedData({ ...medData, dose: e.target.value })}
                        placeholder="100"
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-slate-700 mb-1">Unit</label>
                      <select
                        value={medData.unit}
                        onChange={(e) => setMedData({ ...medData, unit: e.target.value })}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                      >
                        <option value="mg">mg</option>
                        <option value="mcg">mcg</option>
                        <option value="g">g</option>
                        <option value="mL">mL</option>
                        <option value="units">units</option>
                      </select>
                    </div>
                  </div>
                  <button
                    onClick={handleRecordMedication}
                    className="mt-3 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 text-sm font-semibold"
                  >
                    Record Medication
                  </button>
                </div>
              )}

              {/* Recent Medications */}
              {medications.length > 0 && (
                <div className="mt-4 space-y-2">
                  <p className="text-sm font-semibold text-slate-700">Recent Medications:</p>
                  {medications.slice(-5).reverse().map((med: any, idx: number) => (
                    <div key={idx} className="flex items-center gap-2 text-sm text-slate-600">
                      <span className="font-mono text-xs bg-slate-200 px-2 py-0.5 rounded">
                        {med.time ? new Date(med.time).toLocaleTimeString() : 'Time not set'}
                      </span>
                      <span className="font-semibold">{med.medication}</span>
                      <span>{med.dose}{med.unit}</span>
                      <span className="text-slate-400">{med.route}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Events */}
            <div>
              <h3 className="font-bold text-slate-900 mb-3 flex items-center gap-2">
                <AlertCircle className="w-5 h-5 text-orange-600" />
                Intraoperative Events
              </h3>
              <button
                onClick={() => setShowEventForm(!showEventForm)}
                className="mb-3 px-4 py-2 bg-orange-100 hover:bg-orange-200 text-orange-700 rounded-lg text-sm font-semibold transition flex items-center gap-2"
              >
                <Plus className="w-4 h-4" />
                Record Event
              </button>

              {showEventForm && (
                <div className="mb-4 bg-orange-50 rounded-xl p-4 border border-orange-200">
                  <textarea
                    value={eventData.description}
                    onChange={(e) => setEventData({ ...eventData, description: e.target.value })}
                    placeholder="Describe the event..."
                    rows={3}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm mb-3"
                  />
                  <button
                    onClick={handleRecordEvent}
                    className="px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 text-sm font-semibold"
                  >
                    Save Event
                  </button>
                </div>
              )}

              {events.length === 0 ? (
                <p className="text-sm text-slate-500">No events recorded</p>
              ) : (
                <div className="space-y-2">
                  {events.slice(-5).reverse().map((event: any, idx: number) => (
                    <div key={idx} className="flex items-start gap-2 bg-slate-100 rounded-lg p-3">
                      <span className="font-mono text-xs bg-slate-200 px-2 py-1 rounded flex-shrink-0">
                        {event.time ? new Date(event.time).toLocaleTimeString() : 'Time not set'}
                      </span>
                      <p className="text-sm text-slate-700">{event.description}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="bg-slate-50 px-6 py-4 flex items-center justify-end gap-3 border-t border-slate-200">
          <button
            onClick={onClose}
            className="px-6 py-2 bg-slate-200 text-slate-700 rounded-xl hover:bg-slate-300 transition-colors font-semibold"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default AnesthesiaRecordModal;
