import React, { useState } from 'react';
import { Activity, Save, User, X, AlertCircle, Plus } from 'lucide-react';
import { ehrApi } from '../services/api';
import { useNotification } from './GlobalNotification';
import SnomedConceptPicker, { SnomedConcept } from './SnomedConceptPicker';

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
    colposcopyResult: '',
    biopsyRequired: false,
    biopsyResult: '',
    treatmentProvided: '',
    treatmentDate: '',
    nextScreeningDate: '',
    notes: ''
  });
  const [screeningMethodConcept, setScreeningMethodConcept] = useState<SnomedConcept | null>(null);
  const [screeningResultConcept, setScreeningResultConcept] = useState<SnomedConcept | null>(null);
  const [viaResultConcepts, setViaResultConcepts] = useState<SnomedConcept[]>([]);
  const [pendingViaResultConcept, setPendingViaResultConcept] = useState<SnomedConcept | null>(null);
  const [papResultConcepts, setPapResultConcepts] = useState<SnomedConcept[]>([]);
  const [pendingPapResultConcept, setPendingPapResultConcept] = useState<SnomedConcept | null>(null);
  const [hpvResultConcepts, setHpvResultConcepts] = useState<SnomedConcept[]>([]);
  const [pendingHpvResultConcept, setPendingHpvResultConcept] = useState<SnomedConcept | null>(null);
  const [colposcopyResultConcepts, setColposcopyResultConcepts] = useState<SnomedConcept[]>([]);
  const [pendingColposcopyResultConcept, setPendingColposcopyResultConcept] = useState<SnomedConcept | null>(null);
  const [biopsyResultConcept, setBiopsyResultConcept] = useState<SnomedConcept | null>(null);
  const [treatmentProvidedConcepts, setTreatmentProvidedConcepts] = useState<SnomedConcept[]>([]);
  const [pendingTreatmentProvidedConcept, setPendingTreatmentProvidedConcept] = useState<SnomedConcept | null>(null);

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
        colposcopyResult: form.screeningMethod === 'colposcopy' ? form.colposcopyResult : null,
        biopsyRequired: form.biopsyRequired,
        biopsyResult: form.biopsyResult || null,
        treatmentProvided: form.treatmentProvided || null,
        treatmentDate: form.treatmentDate || null,
        nextScreeningDate: form.nextScreeningDate || null,
        screenedBy: currentUser.id,
        notes: form.notes,
        // SNOMED fields
        screening_method_snomed: screeningMethodConcept,
        screening_result_snomed: screeningResultConcept,
        via_result_snomed: viaResultConcepts,
        pap_result_snomed: papResultConcepts,
        hpv_result_snomed: hpvResultConcepts,
        colposcopy_result_snomed: colposcopyResultConcepts,
        biopsy_result_snomed: biopsyResultConcept,
        treatment_provided_snomed: treatmentProvidedConcepts,
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
        colposcopyResult: '',
        biopsyRequired: false,
        biopsyResult: '',
        treatmentProvided: '',
        treatmentDate: '',
        nextScreeningDate: '',
        notes: ''
      });
      setScreeningMethodConcept(null);
      setScreeningResultConcept(null);
      setViaResultConcepts([]);
      setPendingViaResultConcept(null);
      setPapResultConcepts([]);
      setPendingPapResultConcept(null);
      setHpvResultConcepts([]);
      setPendingHpvResultConcept(null);
      setColposcopyResultConcepts([]);
      setPendingColposcopyResultConcept(null);
      setBiopsyResultConcept(null);
      setTreatmentProvidedConcepts([]);
      setPendingTreatmentProvidedConcept(null);
    } catch (error: any) {
      showError('Error', error.response?.data?.message || 'Failed to record screening');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="glass-gradient rounded-2xl p-6 border border-pink-200/50 bg-gradient-to-r from-pink-500/20 to-rose-500/20">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="p-4 bg-gradient-to-br from-pink-500 to-rose-600 rounded-xl shadow-lg">
              <Activity className="w-8 h-8 text-white" />
            </div>
            <div>
              <h2 className="text-3xl font-bold bg-gradient-to-r from-pink-600 to-rose-600 bg-clip-text text-transparent mb-2">Cervical Cancer Screening</h2>
              <p className="text-slate-700 font-medium">Screen patients for cervical cancer</p>
            </div>
          </div>
        </div>
      </div>

      {/* Patient Search */}
      <div className="glass-card rounded-xl p-6">
        <h3 className="text-xl font-bold mb-5 flex items-center gap-3">
          <div className="p-2 bg-gradient-to-br from-pink-500 to-rose-600 rounded-lg">
            <User className="w-5 h-5 text-white" />
          </div>
          <span>Select Patient</span>
        </h3>
        <div className="flex gap-3">
          <input
            type="text"
            placeholder="Search by name or patient number..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && searchPatients()}
            className="glass-input flex-1 px-4 py-3 rounded-xl text-slate-800 placeholder:text-slate-400"
          />
          <button
            onClick={searchPatients}
            disabled={loading || !searchTerm.trim()}
            className="glass-button px-6 py-3 text-white rounded-xl disabled:opacity-50 font-semibold shadow-lg"
            style={{ background: 'rgba(219, 39, 119, 0.8)', backdropFilter: 'blur(10px)' }}
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
                  className="glass-card w-full p-4 text-left rounded-xl transition-all hover:scale-[1.02]"
                >
                  <div className="font-bold text-slate-900 text-lg">{patient.firstName} {patient.lastName}</div>
                  <div className="text-sm text-slate-600 mt-1">ID: {patient.patientNumber} {patient.gender && `• ${patient.gender}`}</div>
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
        <div className="glass-card rounded-xl p-6">
          <h3 className="text-xl font-bold mb-6 flex items-center gap-3">
            <div className="w-1 h-6 bg-gradient-to-b from-pink-500 to-rose-500 rounded-full"></div>
            <span>Screening Details</span>
          </h3>
          
          <div className="space-y-5">
            <div className="glass-section rounded-xl p-4">
              <label className="block text-base font-bold text-slate-800 mb-3">Screening Date</label>
              <input
                type="date"
                value={form.screeningDate}
                onChange={(e) => setForm({ ...form, screeningDate: e.target.value })}
                className="glass-input w-full px-4 py-3 rounded-xl text-slate-800"
              />
            </div>

            <div className="glass-section rounded-xl p-4">
              <label className="block text-base font-bold text-slate-800 mb-3">Screening Method</label>
              <select
                value={form.screeningMethod}
                onChange={(e) => setForm({ ...form, screeningMethod: e.target.value })}
                className="glass-input w-full px-4 py-3 rounded-xl text-slate-800"
              >
                <option value="via">VIA (Visual Inspection with Acetic Acid)</option>
                <option value="pap_smear">Pap Smear</option>
                <option value="hpv_test">HPV Test</option>
                <option value="colposcopy">Colposcopy</option>
              </select>
              <div className="mt-2">
                <SnomedConceptPicker
                  value={screeningMethodConcept}
                  onChange={setScreeningMethodConcept}
                  token={localStorage.getItem('ehr_token') || ''}
                  tenantSlug={tenantSlug}
                  label="SNOMED CT Method (Optional)"
                  placeholder="Search for screening method concept..."
                  context="procedure"
                  helperText="Select SNOMED CT concept for structured coding"
                />
              </div>
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
                <div className="mt-2">
                  <SnomedConceptPicker
                    value={pendingViaResultConcept}
                    onChange={setPendingViaResultConcept}
                    token={localStorage.getItem('ehr_token') || ''}
                    tenantSlug={tenantSlug}
                    label="SNOMED CT VIA Results (Optional)"
                    placeholder="Search for finding concept..."
                    context="finding"
                    helperText="Add SNOMED CT concepts for structured coding"
                  />
                  {pendingViaResultConcept && (
                    <button
                      type="button"
                      onClick={() => {
                        setViaResultConcepts([...viaResultConcepts, pendingViaResultConcept]);
                        setPendingViaResultConcept(null);
                      }}
                      className="mt-2 px-3 py-1.5 bg-pink-600 text-white rounded-lg hover:bg-pink-700 transition-colors text-sm font-medium flex items-center gap-1"
                    >
                      <Plus className="w-3 h-3" />
                      Add Concept
                    </button>
                  )}
                  {viaResultConcepts.length > 0 && (
                    <div className="mt-2 space-y-1">
                      {viaResultConcepts.map((concept, idx) => (
                        <div key={idx} className="flex items-center justify-between bg-slate-50 px-3 py-2 rounded-lg">
                          <span className="text-sm text-slate-700">
                            <span className="font-medium">{concept.term}</span>
                            <span className="text-xs text-slate-500 ml-2">({concept.conceptId})</span>
                          </span>
                          <button
                            type="button"
                            onClick={() => setViaResultConcepts(viaResultConcepts.filter((_, i) => i !== idx))}
                            className="text-red-600 hover:text-red-700"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
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
                <div className="mt-2">
                  <SnomedConceptPicker
                    value={pendingPapResultConcept}
                    onChange={setPendingPapResultConcept}
                    token={localStorage.getItem('ehr_token') || ''}
                    tenantSlug={tenantSlug}
                    label="SNOMED CT Pap Results (Optional)"
                    placeholder="Search for finding concept..."
                    context="finding"
                    helperText="Add SNOMED CT concepts for structured coding"
                  />
                  {pendingPapResultConcept && (
                    <button
                      type="button"
                      onClick={() => {
                        setPapResultConcepts([...papResultConcepts, pendingPapResultConcept]);
                        setPendingPapResultConcept(null);
                      }}
                      className="mt-2 px-3 py-1.5 bg-pink-600 text-white rounded-lg hover:bg-pink-700 transition-colors text-sm font-medium flex items-center gap-1"
                    >
                      <Plus className="w-3 h-3" />
                      Add Concept
                    </button>
                  )}
                  {papResultConcepts.length > 0 && (
                    <div className="mt-2 space-y-1">
                      {papResultConcepts.map((concept, idx) => (
                        <div key={idx} className="flex items-center justify-between bg-slate-50 px-3 py-2 rounded-lg">
                          <span className="text-sm text-slate-700">
                            <span className="font-medium">{concept.term}</span>
                            <span className="text-xs text-slate-500 ml-2">({concept.conceptId})</span>
                          </span>
                          <button
                            type="button"
                            onClick={() => setPapResultConcepts(papResultConcepts.filter((_, i) => i !== idx))}
                            className="text-red-600 hover:text-red-700"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
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
                <div className="mt-2">
                  <SnomedConceptPicker
                    value={pendingHpvResultConcept}
                    onChange={setPendingHpvResultConcept}
                    token={localStorage.getItem('ehr_token') || ''}
                    tenantSlug={tenantSlug}
                    label="SNOMED CT HPV Results (Optional)"
                    placeholder="Search for finding concept..."
                    context="finding"
                    helperText="Add SNOMED CT concepts for structured coding"
                  />
                  {pendingHpvResultConcept && (
                    <button
                      type="button"
                      onClick={() => {
                        setHpvResultConcepts([...hpvResultConcepts, pendingHpvResultConcept]);
                        setPendingHpvResultConcept(null);
                      }}
                      className="mt-2 px-3 py-1.5 bg-pink-600 text-white rounded-lg hover:bg-pink-700 transition-colors text-sm font-medium flex items-center gap-1"
                    >
                      <Plus className="w-3 h-3" />
                      Add Concept
                    </button>
                  )}
                  {hpvResultConcepts.length > 0 && (
                    <div className="mt-2 space-y-1">
                      {hpvResultConcepts.map((concept, idx) => (
                        <div key={idx} className="flex items-center justify-between bg-slate-50 px-3 py-2 rounded-lg">
                          <span className="text-sm text-slate-700">
                            <span className="font-medium">{concept.term}</span>
                            <span className="text-xs text-slate-500 ml-2">({concept.conceptId})</span>
                          </span>
                          <button
                            type="button"
                            onClick={() => setHpvResultConcepts(hpvResultConcepts.filter((_, i) => i !== idx))}
                            className="text-red-600 hover:text-red-700"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {form.screeningMethod === 'colposcopy' && (
              <div>
                <label className="block text-sm font-medium mb-2">Colposcopy Result</label>
                <input
                  type="text"
                  value={form.colposcopyResult}
                  onChange={(e) => setForm({ ...form, colposcopyResult: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                  placeholder="Enter colposcopy findings..."
                />
                <div className="mt-2">
                  <SnomedConceptPicker
                    value={pendingColposcopyResultConcept}
                    onChange={setPendingColposcopyResultConcept}
                    token={localStorage.getItem('ehr_token') || ''}
                    tenantSlug={tenantSlug}
                    label="SNOMED CT Colposcopy Results (Optional)"
                    placeholder="Search for finding concept..."
                    context="finding"
                    helperText="Add SNOMED CT concepts for structured coding"
                  />
                  {pendingColposcopyResultConcept && (
                    <button
                      type="button"
                      onClick={() => {
                        setColposcopyResultConcepts([...colposcopyResultConcepts, pendingColposcopyResultConcept]);
                        setPendingColposcopyResultConcept(null);
                      }}
                      className="mt-2 px-3 py-1.5 bg-pink-600 text-white rounded-lg hover:bg-pink-700 transition-colors text-sm font-medium flex items-center gap-1"
                    >
                      <Plus className="w-3 h-3" />
                      Add Concept
                    </button>
                  )}
                  {colposcopyResultConcepts.length > 0 && (
                    <div className="mt-2 space-y-1">
                      {colposcopyResultConcepts.map((concept, idx) => (
                        <div key={idx} className="flex items-center justify-between bg-slate-50 px-3 py-2 rounded-lg">
                          <span className="text-sm text-slate-700">
                            <span className="font-medium">{concept.term}</span>
                            <span className="text-xs text-slate-500 ml-2">({concept.conceptId})</span>
                          </span>
                          <button
                            type="button"
                            onClick={() => setColposcopyResultConcepts(colposcopyResultConcepts.filter((_, i) => i !== idx))}
                            className="text-red-600 hover:text-red-700"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
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
              <div className="mt-2">
                <SnomedConceptPicker
                  value={screeningResultConcept}
                  onChange={setScreeningResultConcept}
                  token={localStorage.getItem('ehr_token') || ''}
                  tenantSlug={tenantSlug}
                  label="SNOMED CT Result (Optional)"
                  placeholder="Search for finding concept..."
                  context="finding"
                  helperText="Select SNOMED CT concept for structured coding"
                />
              </div>
            </div>

            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="biopsyRequired"
                checked={form.biopsyRequired}
                onChange={(e) => setForm({ ...form, biopsyRequired: e.target.checked })}
                className="w-4 h-4 text-pink-600 rounded focus:ring-pink-500"
              />
              <label htmlFor="biopsyRequired" className="text-sm font-medium">Biopsy Required</label>
            </div>

            {form.biopsyRequired && (
              <div>
                <label className="block text-sm font-medium mb-2">Biopsy Result</label>
                <input
                  type="text"
                  value={form.biopsyResult}
                  onChange={(e) => setForm({ ...form, biopsyResult: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                  placeholder="Enter biopsy result..."
                />
                <div className="mt-2">
                  <SnomedConceptPicker
                    value={biopsyResultConcept}
                    onChange={setBiopsyResultConcept}
                    token={localStorage.getItem('ehr_token') || ''}
                    tenantSlug={tenantSlug}
                    label="SNOMED CT Biopsy Result (Optional)"
                    placeholder="Search for finding concept..."
                    context="finding"
                    helperText="Select SNOMED CT concept for structured coding"
                  />
                </div>
              </div>
            )}

            <div>
              <label className="block text-sm font-medium mb-2">Treatment Provided</label>
              <textarea
                value={form.treatmentProvided}
                onChange={(e) => setForm({ ...form, treatmentProvided: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                rows={2}
                placeholder="Enter treatment details..."
              />
              <div className="mt-2">
                <SnomedConceptPicker
                  value={pendingTreatmentProvidedConcept}
                  onChange={setPendingTreatmentProvidedConcept}
                  token={localStorage.getItem('ehr_token') || ''}
                  tenantSlug={tenantSlug}
                  label="SNOMED CT Treatment (Optional)"
                  placeholder="Search for procedure concept..."
                  context="procedure"
                  helperText="Add SNOMED CT concepts for structured coding"
                />
                {pendingTreatmentProvidedConcept && (
                  <button
                    type="button"
                    onClick={() => {
                      setTreatmentProvidedConcepts([...treatmentProvidedConcepts, pendingTreatmentProvidedConcept]);
                      setPendingTreatmentProvidedConcept(null);
                    }}
                    className="mt-2 px-3 py-1.5 bg-pink-600 text-white rounded-lg hover:bg-pink-700 transition-colors text-sm font-medium flex items-center gap-1"
                  >
                    <Plus className="w-3 h-3" />
                    Add Concept
                  </button>
                )}
                {treatmentProvidedConcepts.length > 0 && (
                  <div className="mt-2 space-y-1">
                    {treatmentProvidedConcepts.map((concept, idx) => (
                      <div key={idx} className="flex items-center justify-between bg-slate-50 px-3 py-2 rounded-lg">
                        <span className="text-sm text-slate-700">
                          <span className="font-medium">{concept.term}</span>
                          <span className="text-xs text-slate-500 ml-2">({concept.conceptId})</span>
                        </span>
                        <button
                          type="button"
                          onClick={() => setTreatmentProvidedConcepts(treatmentProvidedConcepts.filter((_, i) => i !== idx))}
                          className="text-red-600 hover:text-red-700"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-2">Treatment Date</label>
                <input
                  type="date"
                  value={form.treatmentDate}
                  onChange={(e) => setForm({ ...form, treatmentDate: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Next Screening Date</label>
                <input
                  type="date"
                  value={form.nextScreeningDate}
                  onChange={(e) => setForm({ ...form, nextScreeningDate: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                />
              </div>
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
              className="glass-button w-full px-6 py-4 text-white rounded-xl disabled:opacity-50 flex items-center justify-center gap-2 font-bold text-lg shadow-lg"
              style={{ background: 'rgba(219, 39, 119, 0.8)', backdropFilter: 'blur(10px)' }}
            >
              <Save className="w-6 h-6" />
              {loading ? 'Recording...' : 'Record Screening'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default CervicalCancerScreeningComponent;
