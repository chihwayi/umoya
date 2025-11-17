import React, { useMemo, useState } from 'react';
import { Stethoscope, Save, User, AlertTriangle, CheckCircle, X } from 'lucide-react';
import { ehrApi } from '../services/api';
import { useNotification } from './GlobalNotification';
import SnomedConceptPicker, { SnomedConcept } from './SnomedConceptPicker';

interface TBScreeningComponentProps {
  tenantSlug: string;
}

const TBScreeningComponent: React.FC<TBScreeningComponentProps> = ({ tenantSlug }) => {
  const { showSuccess, showError } = useNotification();
  const [selectedPatient, setSelectedPatient] = useState<any>(null);
  const [patients, setPatients] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(false);

  const [form, setForm] = useState({
    screeningDate: new Date().toISOString().split('T')[0],
    screeningType: 'symptom_screen',
    symptomCough: false,
    symptomFever: false,
    symptomNightSweats: false,
    symptomWeightLoss: false,
    symptomDurationWeeks: '',
    screeningResult: '',
    notes: ''
  });
  const snomedToken = useMemo(() => localStorage.getItem('ehr_token') || '', []);
  const snomedReady = Boolean(snomedToken && tenantSlug);
  const [screeningReasonConcept, setScreeningReasonConcept] = useState<SnomedConcept | null>(null);
  const [screeningResultConcept, setScreeningResultConcept] = useState<SnomedConcept | null>(null);
  const [pendingSymptomConcept, setPendingSymptomConcept] = useState<SnomedConcept | null>(null);
  const [symptomConcepts, setSymptomConcepts] = useState<SnomedConcept[]>([]);
  const [diagnosisConcept, setDiagnosisConcept] = useState<SnomedConcept | null>(null);
  const [treatmentConcept, setTreatmentConcept] = useState<SnomedConcept | null>(null);

  const addSymptomConcept = () => {
    if (
      pendingSymptomConcept &&
      !symptomConcepts.some((concept) => concept.conceptId === pendingSymptomConcept.conceptId)
    ) {
      setSymptomConcepts((prev) => [...prev, pendingSymptomConcept]);
    }
    setPendingSymptomConcept(null);
  };

  const removeSymptomConcept = (conceptId: string) => {
    setSymptomConcepts((prev) => prev.filter((concept) => concept.conceptId !== conceptId));
  };

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

    try {
      const token = localStorage.getItem('ehr_token');
      const currentUser = JSON.parse(localStorage.getItem('ehr_user') || '{}');
      
      if (!token) return;

      setLoading(true);
      await ehrApi.createTbScreening({
        patientId: selectedPatient.id,
        screeningDate: form.screeningDate,
        screeningType: form.screeningType,
        screeningResult: form.screeningResult || null,
        screeningReasonConcept,
        screeningResultConcept,
        symptoms: {
          cough: form.symptomCough,
          fever: form.symptomFever,
          nightSweats: form.symptomNightSweats,
          weightLoss: form.symptomWeightLoss
        },
        symptomConcepts,
        diagnosisConcept,
        treatmentConcept,
        symptomDurationWeeks: form.symptomDurationWeeks ? parseInt(form.symptomDurationWeeks) : null,
        screenedBy: currentUser.id,
        notes: form.notes
      }, token, tenantSlug);

      showSuccess('Success', 'TB screening recorded');
      
      // Clear form
      setForm({
        screeningDate: new Date().toISOString().split('T')[0],
        screeningType: 'symptom_screen',
        symptomCough: false,
        symptomFever: false,
        symptomNightSweats: false,
        symptomWeightLoss: false,
        symptomDurationWeeks: '',
        screeningResult: '',
        notes: ''
      });
      setScreeningReasonConcept(null);
      setScreeningResultConcept(null);
      setPendingSymptomConcept(null);
      setSymptomConcepts([]);
      setDiagnosisConcept(null);
      setTreatmentConcept(null);
    } catch (error: any) {
      showError('Error', error.response?.data?.message || 'Failed to record screening');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-gradient-to-r from-amber-600 to-orange-700 rounded-2xl shadow-lg p-6 text-white">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold mb-2">TB Screening</h2>
            <p className="text-amber-100">Screen patients for tuberculosis</p>
          </div>
          <Stethoscope className="w-12 h-12 opacity-80" />
        </div>
      </div>

      {/* Patient Search */}
      <div className="bg-white rounded-xl shadow-lg p-6 border border-slate-200">
        <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <User className="w-5 h-5 text-amber-600" />
          Select Patient
        </h3>
        <div className="flex gap-3">
          <input
            type="text"
            placeholder="Search by name or patient number..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && searchPatients()}
            className="flex-1 px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-amber-500"
          />
          <button
            onClick={searchPatients}
            disabled={loading || !searchTerm.trim()}
            className="px-6 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700 disabled:opacity-50"
          >
            {loading ? 'Searching...' : 'Search'}
          </button>
        </div>

        {patients.length > 0 && (
          <div className="mt-4 space-y-2">
            {patients.map((patient) => (
              <button
                key={patient.id}
                onClick={() => {
                  setSelectedPatient(patient);
                  setPatients([]);
                  setSearchTerm(`${patient.firstName} ${patient.lastName}`);
                }}
                className="w-full p-3 text-left border border-slate-200 rounded-lg hover:bg-amber-50"
              >
                <div className="font-semibold">{patient.firstName} {patient.lastName}</div>
                <div className="text-sm text-slate-600">ID: {patient.patientNumber}</div>
              </button>
            ))}
          </div>
        )}

        {selectedPatient && (
          <div className="mt-4 p-4 bg-amber-50 border border-amber-200 rounded-lg">
            <div className="flex items-center justify-between">
              <div>
                <div className="font-semibold">{selectedPatient.firstName} {selectedPatient.lastName}</div>
                <div className="text-sm text-amber-700">ID: {selectedPatient.patientNumber}</div>
              </div>
              <button onClick={() => setSelectedPatient(null)} className="text-amber-600">
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Screening Form */}
      {selectedPatient && (
        <div className="bg-white rounded-xl shadow-lg p-6 border border-slate-200">
          <h3 className="text-lg font-semibold mb-4">TB Symptom Screening</h3>
          
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
              <label className="block text-sm font-medium mb-2">TB Symptoms</label>
              <div className="space-y-2">
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={form.symptomCough}
                    onChange={(e) => setForm({ ...form, symptomCough: e.target.checked })}
                    className="rounded"
                  />
                  <span>Cough (≥2 weeks)</span>
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={form.symptomFever}
                    onChange={(e) => setForm({ ...form, symptomFever: e.target.checked })}
                    className="rounded"
                  />
                  <span>Fever</span>
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={form.symptomNightSweats}
                    onChange={(e) => setForm({ ...form, symptomNightSweats: e.target.checked })}
                    className="rounded"
                  />
                  <span>Night Sweats</span>
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={form.symptomWeightLoss}
                    onChange={(e) => setForm({ ...form, symptomWeightLoss: e.target.checked })}
                    className="rounded"
                  />
                  <span>Weight Loss</span>
                </label>
              </div>
            </div>

            {(form.symptomCough || form.symptomFever || form.symptomNightSweats || form.symptomWeightLoss) && (
              <div>
                <label className="block text-sm font-medium mb-2">Symptom Duration (weeks)</label>
                <input
                  type="number"
                  value={form.symptomDurationWeeks}
                  onChange={(e) => setForm({ ...form, symptomDurationWeeks: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                  placeholder="Duration in weeks"
                />
              </div>
            )}

            <div>
              <label className="block text-sm font-medium mb-2">Screening Result</label>
              <select
                value={form.screeningResult}
                onChange={(e) => setForm({ ...form, screeningResult: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg"
              >
                <option value="">Select result...</option>
                <option value="negative">Negative</option>
                <option value="positive">Positive</option>
                <option value="pending">Pending</option>
              </select>
            </div>

            {snomedReady && (
              <div className="rounded-2xl border border-amber-200 bg-amber-50/40 p-4 space-y-4">
                <p className="text-sm font-semibold text-amber-900">SNOMED Structured Fields</p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <SnomedConceptPicker
                    value={screeningReasonConcept}
                    onChange={setScreeningReasonConcept}
                    token={snomedToken}
                    tenantSlug={tenantSlug}
                    label="Screening reason concept"
                    placeholder="Search SNOMED CT (e.g., TB symptom screen)"
                  context="procedure"
                  />
                  <SnomedConceptPicker
                    value={screeningResultConcept}
                    onChange={setScreeningResultConcept}
                    token={snomedToken}
                    tenantSlug={tenantSlug}
                    label="Screening result concept"
                    placeholder="Search SNOMED CT (e.g., Pulmonary tuberculosis confirmed)"
                  context="condition"
                  />
                  <div className="space-y-2">
                    <SnomedConceptPicker
                      value={pendingSymptomConcept}
                      onChange={setPendingSymptomConcept}
                      token={snomedToken}
                      tenantSlug={tenantSlug}
                      label="Symptom concept"
                      placeholder="Search SNOMED CT (e.g., Night sweats)"
                  context="condition"
                    />
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        className="rounded-full bg-amber-600 px-3 py-1 text-xs font-semibold text-white disabled:opacity-40"
                        onClick={addSymptomConcept}
                        disabled={!pendingSymptomConcept}
                      >
                        Add symptom
                      </button>
                      {symptomConcepts.length > 0 && (
                        <button
                          type="button"
                          className="rounded-full border border-amber-200 px-3 py-1 text-xs font-semibold text-amber-800"
                          onClick={() => setSymptomConcepts([])}
                        >
                          Clear all
                        </button>
                      )}
                    </div>
                    {symptomConcepts.length > 0 && (
                      <div className="flex flex-wrap gap-2">
                        {symptomConcepts.map((concept) => (
                          <span
                            key={concept.conceptId}
                            className="flex items-center gap-1 rounded-full bg-white px-3 py-1 text-xs text-amber-900 shadow-sm"
                          >
                            {concept.preferredTerm || concept.term}
                            <button
                              type="button"
                              className="text-amber-600 hover:text-amber-800"
                              onClick={() => removeSymptomConcept(concept.conceptId)}
                            >
                              ×
                            </button>
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                  <SnomedConceptPicker
                    value={diagnosisConcept}
                    onChange={setDiagnosisConcept}
                    token={snomedToken}
                    tenantSlug={tenantSlug}
                    label="Diagnosis concept"
                    placeholder="Search SNOMED CT (e.g., Pulmonary tuberculosis)"
                  context="condition"
                  />
                  <SnomedConceptPicker
                    value={treatmentConcept}
                    onChange={setTreatmentConcept}
                    token={snomedToken}
                    tenantSlug={tenantSlug}
                    label="Treatment concept"
                    placeholder="Search SNOMED CT (e.g., Isoniazid preventive therapy)"
                  context="procedure"
                  />
                </div>
              </div>
            )}

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
              className="w-full px-6 py-3 bg-amber-600 text-white rounded-lg hover:bg-amber-700 disabled:opacity-50 flex items-center justify-center gap-2 font-semibold"
            >
              <Save className="w-5 h-5" />
              {loading ? 'Recording...' : 'Record TB Screening'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default TBScreeningComponent;

