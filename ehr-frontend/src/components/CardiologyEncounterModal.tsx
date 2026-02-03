import React, { useEffect, useMemo, useState } from 'react';
import { format } from 'date-fns';
import { X, HeartPulse, Calendar, Search, CreditCard, BookOpen, CheckCircle, Loader2 } from 'lucide-react';
import ModalPortal from './ModalPortal';
import { ehrApi, cdssApi } from '../services/api';
import { useNotification } from './GlobalNotification';
import SnomedConceptPicker, { SnomedConcept } from './SnomedConceptPicker';

type CardiologyEncounterModalProps = {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  tenantSlug: string;
  currentUserId?: string;
};

type PatientSummary = {
  id: string;
  firstName: string;
  lastName: string;
  patientNumber: string;
  dateOfBirth?: string;
};

const CardiologyEncounterModal: React.FC<CardiologyEncounterModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  tenantSlug,
  currentUserId,
}) => {
  const { showError, showSuccess } = useNotification();
  const token = useMemo(() => localStorage.getItem('ehr_token'), []);

  const [patients, setPatients] = useState<PatientSummary[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedPatientId, setSelectedPatientId] = useState<string | null>(null);
  const [encounterDate, setEncounterDate] = useState(() => format(new Date(), 'yyyy-MM-dd'));
  const [encounterTime, setEncounterTime] = useState(() => format(new Date(), 'HH:mm'));
  const [encounterType, setEncounterType] = useState('clinic_visit');
  const [riskScore, setRiskScore] = useState('moderate');
  const [visitReason, setVisitReason] = useState('');
  const [symptoms, setSymptoms] = useState('');
  const [carePlan, setCarePlan] = useState('');
  const [followUpPlan, setFollowUpPlan] = useState('');
  const [bloodPressure, setBloodPressure] = useState('');
  const [heartRate, setHeartRate] = useState('');
  const [spo2, setSpo2] = useState('');
  const [diagnosticTests, setDiagnosticTests] = useState('');
  const [feeAmount, setFeeAmount] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [reasonConcept, setReasonConcept] = useState<SnomedConcept | null>(null);
  const [symptomConcepts, setSymptomConcepts] = useState<SnomedConcept[]>([]);
  const [diagnosticConcepts, setDiagnosticConcepts] = useState<SnomedConcept[]>([]);
  const [pendingSymptomConcept, setPendingSymptomConcept] = useState<SnomedConcept | null>(null);
  const [pendingDiagnosticConcept, setPendingDiagnosticConcept] = useState<SnomedConcept | null>(null);

  // CDSS Guideline Search State
  const [showGuidelineSearch, setShowGuidelineSearch] = useState(false);
  const [guidelineQuery, setGuidelineQuery] = useState('');
  const [guidelineResults, setGuidelineResults] = useState<any[]>([]);
  const [loadingGuidelines, setLoadingGuidelines] = useState(false);

  const handleGuidelineSearch = async () => {
    if (!guidelineQuery.trim()) return;
    setLoadingGuidelines(true);
    try {
      if (!token || !tenantSlug) {
        showError('Session Expired', 'Please login again.');
        return;
      }
      
      const response = await cdssApi.searchGuidelines(guidelineQuery, token, tenantSlug);
      if (response.data && response.data.citations) {
        setGuidelineResults(response.data.citations);
      } else {
        setGuidelineResults([]);
      }
    } catch (e) {
      console.error('Guideline search failed:', e);
      showError('Error', 'Failed to search guidelines');
    } finally {
      setLoadingGuidelines(false);
    }
  };

  const handleAddSymptomConcept = () => {
    if (!pendingSymptomConcept) return;
    setSymptomConcepts((prev) => {
      if (prev.some((concept) => concept.conceptId === pendingSymptomConcept.conceptId)) {
        return prev;
      }
      return [...prev, pendingSymptomConcept];
    });
    setPendingSymptomConcept(null);
  };

  const handleRemoveSymptomConcept = (conceptId: string) => {
    setSymptomConcepts((prev) => prev.filter((concept) => concept.conceptId !== conceptId));
  };

  const handleAddDiagnosticConcept = () => {
    if (!pendingDiagnosticConcept) return;
    setDiagnosticConcepts((prev) => {
      if (prev.some((concept) => concept.conceptId === pendingDiagnosticConcept.conceptId)) {
        return prev;
      }
      return [...prev, pendingDiagnosticConcept];
    });
    setPendingDiagnosticConcept(null);
  };

  const handleRemoveDiagnosticConcept = (conceptId: string) => {
    setDiagnosticConcepts((prev) => prev.filter((concept) => concept.conceptId !== conceptId));
  };

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const loadPatients = async () => {
      try {
        if (!tenantSlug || !token) return;
        const response = await ehrApi.getPatients(token, tenantSlug);
        const people = Array.isArray(response.data?.patients) ? response.data.patients : [];
        setPatients(
          people.map((patient: any) => ({
            id: patient.id,
            firstName: patient.firstName,
            lastName: patient.lastName,
            patientNumber: patient.patientNumber,
            dateOfBirth: patient.dateOfBirth,
          })),
        );
      } catch (error) {
        console.error('Failed to load patients for cardiology modal', error);
        showError('Unable to load patients', 'Please try again before creating a cardiology encounter.');
      }
    };

    loadPatients();
  }, [isOpen, tenantSlug, token, showError]);

  useEffect(() => {
    if (!isOpen) {
      setSearchTerm('');
      setSelectedPatientId(null);
      setEncounterDate(format(new Date(), 'yyyy-MM-dd'));
      setEncounterTime(format(new Date(), 'HH:mm'));
      setEncounterType('clinic_visit');
      setRiskScore('moderate');
      setVisitReason('');
      setSymptoms('');
      setCarePlan('');
      setFollowUpPlan('');
      setBloodPressure('');
      setHeartRate('');
      setSpo2('');
      setDiagnosticTests('');
      setFeeAmount('');
      setSubmitting(false);
      setReasonConcept(null);
      setSymptomConcepts([]);
      setDiagnosticConcepts([]);
      setPendingSymptomConcept(null);
      setPendingDiagnosticConcept(null);
    }
  }, [isOpen]);

  const filteredPatients = useMemo(() => {
    if (!searchTerm) return patients.slice(0, 25);
    const term = searchTerm.toLowerCase();
    return patients
      .filter(
        (patient) =>
          patient.firstName.toLowerCase().includes(term) ||
          patient.lastName.toLowerCase().includes(term) ||
          patient.patientNumber.toLowerCase().includes(term),
      )
      .slice(0, 25);
  }, [patients, searchTerm]);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!tenantSlug || !token) {
      showError('Session expired', 'Please sign in again to continue.');
      return;
    }
    if (!selectedPatientId) {
      showError('Select a patient', 'Choose a patient before saving the encounter.');
      return;
    }

    const encounterDateTime = new Date(`${encounterDate}T${encounterTime || '00:00'}:00`);
    if (Number.isNaN(encounterDateTime.getTime())) {
      showError('Invalid date/time', 'Provide a valid encounter date and time.');
      return;
    }

    const hemodynamics: Record<string, any> = {};
    if (bloodPressure) hemodynamics.blood_pressure = bloodPressure;
    if (heartRate) hemodynamics.heart_rate = Number(heartRate);
    if (spo2) hemodynamics.spo2 = Number(spo2);

    const diagnosticsArray = diagnosticTests
      ? diagnosticTests
          .split(',')
          .map((test) => test.trim())
          .filter(Boolean)
      : [];

    const derivedVisitReason =
      visitReason || reasonConcept?.preferredTerm || reasonConcept?.term || null;

    const payload: Record<string, any> = {
      patient_id: selectedPatientId,
      encounter_date: encounterDateTime.toISOString(),
      encounter_type: encounterType,
      cardiologist_id: currentUserId || null,
      visit_reason: derivedVisitReason,
      presenting_symptoms: symptoms || null,
      hemodynamics,
      diagnostic_tests: diagnosticsArray,
      care_plan: carePlan || null,
      follow_up_plan: followUpPlan || null,
      risk_score: riskScore || null,
    };

    if (reasonConcept) {
      payload.reason_concept = reasonConcept;
    }
    if (symptomConcepts.length > 0) {
      payload.symptom_concepts = symptomConcepts;
    }
    if (diagnosticConcepts.length > 0) {
      payload.diagnostic_concepts = diagnosticConcepts;
    }

    if (feeAmount) {
      const numericFee = Number(feeAmount);
      if (Number.isNaN(numericFee) || numericFee < 0) {
        showError('Invalid fee', 'Enter a valid fee amount or leave it blank.');
        return;
      }
      payload.fee_amount = numericFee;
    }

    setSubmitting(true);
    try {
      await ehrApi.createCardiologyEncounter(tenantSlug, token, payload);
      showSuccess('Cardiology encounter created', 'Finance has been notified when payment is required.');
      onSuccess();
      onClose();
    } catch (error: any) {
      console.error('Failed to create cardiology encounter', error);
      const message = error?.response?.data?.message || 'Unable to create cardiology encounter';
      showError('Encounter not saved', message);
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <ModalPortal>
      <div className="fixed inset-0 z-[5000] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
        <div className="w-full max-w-4xl rounded-3xl bg-gradient-to-br from-white to-slate-50 shadow-2xl border border-slate-200/60">
          <div className="flex items-center justify-between border-b border-slate-200/60 bg-gradient-to-r from-red-50 via-rose-50 to-amber-50 px-6 py-5">
            <div className="flex items-center gap-3">
              <div className="rounded-2xl bg-gradient-to-r from-red-500 to-rose-600 p-2 shadow text-white">
                <HeartPulse className="h-6 w-6" />
              </div>
              <div>
                <h2 className="text-xl font-semibold text-slate-900">New Cardiology Encounter</h2>
                <p className="text-sm text-slate-600">Capture cardiac assessment details and trigger finance gating</p>
              </div>
            </div>
            <button onClick={onClose} className="rounded-full p-2 hover:bg-white/70 transition" aria-label="Close">
              <X className="h-5 w-5 text-slate-600" />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="max-h-[75vh] overflow-y-auto px-6 py-6 space-y-6">
            <section className="rounded-2xl border border-slate-200/60 bg-white/80 p-5 shadow-sm">
              <h3 className="mb-4 text-sm font-semibold text-slate-700 flex items-center gap-2">
                <Search className="h-4 w-4 text-rose-500" />
                Select patient
              </h3>
              <div className="mb-4 flex items-center gap-3">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    value={searchTerm}
                    onChange={(event) => setSearchTerm(event.target.value)}
                    placeholder="Search by name or patient number"
                    className="w-full rounded-xl border border-slate-300 bg-white/70 py-2.5 pl-10 pr-3 text-sm focus:border-rose-400 focus:outline-none focus:ring-2 focus:ring-rose-100"
                  />
                </div>
              </div>
              <div className="grid max-h-48 grid-cols-1 gap-2 overflow-y-auto rounded-xl border border-slate-200/60 bg-white/70 p-2">
                {filteredPatients.length === 0 && (
                  <p className="px-3 py-2 text-sm text-slate-500">No patients found. Adjust your search.</p>
                )}
                {filteredPatients.map((patient) => {
                  const isSelected = patient.id === selectedPatientId;
                  return (
                    <button
                      type="button"
                      key={patient.id}
                      onClick={() => setSelectedPatientId(patient.id)}
                      className={`flex w-full items-center justify-between rounded-lg border px-3 py-2 text-left text-sm transition ${
                        isSelected
                          ? 'border-rose-400 bg-rose-50 text-rose-700'
                          : 'border-transparent bg-white hover:border-rose-200 hover:bg-rose-50/60'
                      }`}
                    >
                      <div>
                        <p className="font-semibold">{patient.firstName} {patient.lastName}</p>
                        <p className="text-xs text-slate-500">ID: {patient.patientNumber}</p>
                      </div>
                      {patient.dateOfBirth && (
                        <span className="text-xs text-slate-500">DOB: {format(new Date(patient.dateOfBirth), 'dd MMM yyyy')}</span>
                      )}
                    </button>
                  );
                })}
              </div>
            </section>

            {/* AI Guideline Search Section */}
            <section className="rounded-2xl border border-slate-200/60 bg-white/80 p-5 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                  <BookOpen className="h-4 w-4 text-rose-500" />
                  Cardiology Guidelines & Intelligence
                </h3>
                <button
                  type="button"
                  onClick={() => setShowGuidelineSearch(!showGuidelineSearch)}
                  className={`text-xs font-medium px-3 py-1.5 rounded-lg transition-colors border ${
                    showGuidelineSearch 
                      ? 'bg-rose-50 text-rose-700 border-rose-200' 
                      : 'bg-white text-slate-500 border-slate-200 hover:text-rose-600'
                  }`}
                >
                  {showGuidelineSearch ? 'Hide Guidelines' : 'Search Guidelines'}
                </button>
              </div>

              {showGuidelineSearch && (
                <div className="animate-in fade-in slide-in-from-top-2 duration-300">
                  <div className="flex gap-3 mb-4">
                    <div className="relative flex-1">
                      <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
                      <input
                        type="text"
                        value={guidelineQuery}
                        onChange={(e) => setGuidelineQuery(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleGuidelineSearch())}
                        placeholder="Search guidelines (e.g., 'Heart failure treatment', 'Atrial fibrillation management')..."
                        className="w-full pl-10 pr-4 py-2 bg-white border border-slate-200 rounded-lg text-sm text-slate-700 focus:ring-2 focus:ring-rose-500 focus:border-rose-500"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={handleGuidelineSearch}
                      disabled={loadingGuidelines || !guidelineQuery.trim()}
                      className="px-4 py-2 bg-rose-600 text-white rounded-lg text-sm font-medium hover:bg-rose-700 disabled:opacity-50 flex items-center gap-2"
                    >
                      {loadingGuidelines ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          Searching...
                        </>
                      ) : (
                        'Search'
                      )}
                    </button>
                  </div>

                  {guidelineResults.length > 0 && (
                    <div className="space-y-3 bg-rose-50/50 rounded-xl p-4 border border-rose-100">
                      <p className="text-xs font-bold text-rose-700 uppercase tracking-wider mb-2">Relevant Guidelines</p>
                      {guidelineResults.map((citation: any, idx: number) => (
                        <div key={`cardio-search-${idx}`} className="flex items-start gap-3 p-3 bg-white rounded-lg border border-rose-100 shadow-sm">
                          <CheckCircle className="w-5 h-5 text-emerald-500 mt-0.5 flex-shrink-0" />
                          <div className="space-y-1">
                            <p className="text-sm text-slate-700 leading-relaxed">
                              {typeof citation === 'string' ? citation : (citation.content || JSON.stringify(citation))}
                            </p>
                            {citation.source && (
                              <p className="text-xs text-slate-400 font-medium">Source: {citation.source}</p>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </section>

            <section className="rounded-2xl border border-slate-200/60 bg-white/80 p-5 shadow-sm">
              <div className="rounded-2xl border border-slate-200/60 bg-white/80 p-5 shadow-sm">
                <h3 className="mb-4 text-sm font-semibold text-slate-700 flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-rose-500" />
                  Encounter details
                </h3>
                <div className="space-y-3">
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Date
                      <input
                        type="date"
                        value={encounterDate}
                        onChange={(event) => setEncounterDate(event.target.value)}
                        className="mt-1 w-full rounded-lg border border-slate-300 bg-white/80 px-3 py-2 text-sm focus:border-rose-400 focus:outline-none focus:ring-2 focus:ring-rose-100"
                        required
                      />
                    </label>
                    <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Time
                      <input
                        type="time"
                        value={encounterTime}
                        onChange={(event) => setEncounterTime(event.target.value)}
                        className="mt-1 w-full rounded-lg border border-slate-300 bg-white/80 px-3 py-2 text-sm focus:border-rose-400 focus:outline-none focus:ring-2 focus:ring-rose-100"
                        required
                      />
                    </label>
                  </div>
                  <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Encounter type
                    <select
                      value={encounterType}
                      onChange={(event) => setEncounterType(event.target.value)}
                      className="mt-1 w-full rounded-lg border border-slate-300 bg-white/80 px-3 py-2 text-sm focus:border-rose-400 focus:outline-none focus:ring-2 focus:ring-rose-100"
                    >
                      <option value="clinic_visit">Clinic visit</option>
                      <option value="diagnostic_test">Diagnostic workup</option>
                      <option value="heart_failure_review">Heart failure review</option>
                      <option value="telecardiology">Telecardiology consult</option>
                      <option value="rehabilitation">Cardiac rehab follow-up</option>
                      <option value="other">Other</option>
                    </select>
                  </label>
                  <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Risk level
                    <select
                      value={riskScore}
                      onChange={(event) => setRiskScore(event.target.value)}
                      className="mt-1 w-full rounded-lg border border-slate-300 bg-white/80 px-3 py-2 text-sm focus:border-rose-400 focus:outline-none focus:ring-2 focus:ring-rose-100"
                    >
                      <option value="low">Low</option>
                      <option value="moderate">Moderate</option>
                      <option value="high">High</option>
                      <option value="critical">Critical</option>
                    </select>
                  </label>
                  {token && (
                    <div className="space-y-2">
                      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                        SNOMED CT Problem
                      </p>
                      <SnomedConceptPicker
                        value={reasonConcept}
                        onChange={(concept) => {
                          setReasonConcept(concept);
                          if (concept && !visitReason) {
                            setVisitReason(concept.preferredTerm || concept.term || '');
                          }
                        }}
                        token={token}
                        tenantSlug={tenantSlug}
                        label=""
                        placeholder="Search SNOMED CT (e.g., Angina pectoris)"
                        helperText="Adds a coded reason for this encounter"
                        required={false}
                      context="condition"
                      />
                    </div>
                  )}
                  <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Visit reason
                    <input
                      type="text"
                      value={visitReason}
                      onChange={(event) => setVisitReason(event.target.value)}
                      placeholder="E.g. chest pain review"
                      className="mt-1 w-full rounded-lg border border-slate-300 bg-white/80 px-3 py-2 text-sm focus:border-rose-400 focus:outline-none focus:ring-2 focus:ring-rose-100"
                    />
                  </label>
                  <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Presenting symptoms
                    <textarea
                      value={symptoms}
                      onChange={(event) => setSymptoms(event.target.value)}
                      rows={3}
                      className="mt-1 w-full rounded-lg border border-slate-300 bg-white/80 px-3 py-2 text-sm focus:border-rose-400 focus:outline-none focus:ring-2 focus:ring-rose-100"
                      placeholder="Summarize patient symptoms or ECG findings"
                    />
                  </label>
                  {token && (
                    <div className="space-y-2">
                      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                        SNOMED CT Symptoms
                      </p>
                      <div className="rounded-xl border border-slate-200/80 bg-white/70 p-3 space-y-3">
                        <SnomedConceptPicker
                          value={pendingSymptomConcept}
                          onChange={setPendingSymptomConcept}
                          token={token}
                          tenantSlug={tenantSlug}
                          label=""
                          placeholder="Search SNOMED CT (e.g., Chest pain)"
                          helperText="Add structured symptom codes"
                        context="symptom"
                        />
                        <div className="flex flex-wrap gap-2">
                          <button
                            type="button"
                            className="rounded-full bg-rose-600 px-3 py-1 text-xs font-semibold text-white disabled:opacity-50"
                            onClick={handleAddSymptomConcept}
                            disabled={!pendingSymptomConcept}
                          >
                            Add Symptom Concept
                          </button>
                          {symptomConcepts.length > 0 && (
                            <button
                              type="button"
                              className="rounded-full border border-rose-100 bg-white px-3 py-1 text-xs font-semibold text-rose-600 hover:bg-rose-50"
                              onClick={() => setSymptomConcepts([])}
                            >
                              Clear All
                            </button>
                          )}
                        </div>
                        {symptomConcepts.length > 0 && (
                          <div className="flex flex-wrap gap-2">
                            {symptomConcepts.map((concept) => (
                              <span
                                key={concept.conceptId}
                                className="flex items-center gap-1 rounded-full bg-rose-50 px-3 py-1 text-xs text-rose-700"
                              >
                                {concept.preferredTerm || concept.term}
                                <button
                                  type="button"
                                  className="text-rose-500 hover:text-rose-700"
                                  onClick={() => handleRemoveSymptomConcept(concept.conceptId)}
                                >
                                  ×
                                </button>
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <div className="rounded-2xl border border-slate-200/60 bg-white/80 p-5 shadow-sm">
                <h3 className="mb-4 text-sm font-semibold text-slate-700 flex items-center gap-2">
                  <HeartPulse className="h-4 w-4 text-rose-500" />
                  Hemodynamics & diagnostics
                </h3>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Blood pressure
                    <input
                      type="text"
                      value={bloodPressure}
                      onChange={(event) => setBloodPressure(event.target.value)}
                      placeholder="e.g. 130/82"
                      className="mt-1 w-full rounded-lg border border-slate-300 bg-white/80 px-3 py-2 text-sm focus:border-rose-400 focus:outline-none focus:ring-2 focus:ring-rose-100"
                    />
                  </label>
                  <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Heart rate
                    <input
                      type="number"
                      value={heartRate}
                      onChange={(event) => setHeartRate(event.target.value)}
                      placeholder="e.g. 78"
                      className="mt-1 w-full rounded-lg border border-slate-300 bg-white/80 px-3 py-2 text-sm focus:border-rose-400 focus:outline-none focus:ring-2 focus:ring-rose-100"
                    />
                  </label>
                  <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    SpO₂
                    <input
                      type="number"
                      value={spo2}
                      onChange={(event) => setSpo2(event.target.value)}
                      placeholder="e.g. 96"
                      className="mt-1 w-full rounded-lg border border-slate-300 bg-white/80 px-3 py-2 text-sm focus:border-rose-400 focus:outline-none focus:ring-2 focus:ring-rose-100"
                    />
                  </label>
                  <label className="text-xs font-semibold uppercase tracking-wide text-slate-500 sm:col-span-2">
                    Diagnostic tests requested
                    <input
                      type="text"
                      value={diagnosticTests}
                      onChange={(event) => setDiagnosticTests(event.target.value)}
                      placeholder="Comma separated e.g. Lipid panel, Troponin, ECG"
                      className="mt-1 w-full rounded-lg border border-slate-300 bg-white/80 px-3 py-2 text-sm focus:border-rose-400 focus:outline-none focus:ring-2 focus:ring-rose-100"
                    />
                  </label>
                </div>
                {token && (
                  <div className="mt-4 space-y-2">
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                      SNOMED CT Diagnostics
                    </p>
                    <div className="rounded-xl border border-slate-200/80 bg-white/70 p-3 space-y-3">
                      <SnomedConceptPicker
                        value={pendingDiagnosticConcept}
                        onChange={setPendingDiagnosticConcept}
                        token={token}
                        tenantSlug={tenantSlug}
                        label=""
                        placeholder="Search SNOMED CT (e.g., Echocardiography)"
                        helperText="Document ordered procedures with SNOMED CT"
                        context="procedure"
                      />
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          className="rounded-full bg-indigo-600 px-3 py-1 text-xs font-semibold text-white disabled:opacity-50"
                          onClick={handleAddDiagnosticConcept}
                          disabled={!pendingDiagnosticConcept}
                        >
                          Add Diagnostic Concept
                        </button>
                        {diagnosticConcepts.length > 0 && (
                          <button
                            type="button"
                            className="rounded-full border border-indigo-100 bg-white px-3 py-1 text-xs font-semibold text-indigo-600 hover:bg-indigo-50"
                            onClick={() => setDiagnosticConcepts([])}
                          >
                            Clear All
                          </button>
                        )}
                      </div>
                      {diagnosticConcepts.length > 0 && (
                        <div className="flex flex-wrap gap-2">
                          {diagnosticConcepts.map((concept) => (
                            <span
                              key={concept.conceptId}
                              className="flex items-center gap-1 rounded-full bg-indigo-50 px-3 py-1 text-xs text-indigo-700"
                            >
                              {concept.preferredTerm || concept.term}
                              <button
                                type="button"
                                className="text-indigo-500 hover:text-indigo-700"
                                onClick={() => handleRemoveDiagnosticConcept(concept.conceptId)}
                              >
                                ×
                              </button>
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )}
                <div className="mt-4 space-y-3">
                  <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Care plan
                    <textarea
                      value={carePlan}
                      onChange={(event) => setCarePlan(event.target.value)}
                      rows={3}
                      className="mt-1 w-full rounded-lg border border-slate-300 bg-white/80 px-3 py-2 text-sm focus:border-rose-400 focus:outline-none focus:ring-2 focus:ring-rose-100"
                      placeholder="Outline therapeutic steps, titrations, imaging follow-up"
                    />
                  </label>
                  <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Follow-up plan
                    <textarea
                      value={followUpPlan}
                      onChange={(event) => setFollowUpPlan(event.target.value)}
                      rows={2}
                      className="mt-1 w-full rounded-lg border border-slate-300 bg-white/80 px-3 py-2 text-sm focus:border-rose-400 focus:outline-none focus:ring-2 focus:ring-rose-100"
                      placeholder="Specify next clinical review or rehab milestone"
                    />
                  </label>
                </div>
              </div>
            </section>

            <section className="rounded-2xl border border-slate-200/60 bg-white/80 p-5 shadow-sm">
              <h3 className="mb-4 text-sm font-semibold text-slate-700 flex items-center gap-2">
                <CreditCard className="h-4 w-4 text-rose-500" />
                Finance gating
              </h3>
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Fee amount (optional)
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={feeAmount}
                    onChange={(event) => setFeeAmount(event.target.value)}
                    placeholder="Enter service fee"
                    className="mt-1 w-full rounded-lg border border-slate-300 bg-white/80 px-3 py-2 text-sm focus:border-rose-400 focus:outline-none focus:ring-2 focus:ring-rose-100"
                  />
                </label>
                <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-amber-700 text-xs leading-relaxed">
                  <p className="font-semibold">Finance workflow</p>
                  <p>
                    If a fee is captured the encounter will be locked until Accounts marks the payment as cleared. Clinicians will
                    see an "Awaiting Payment" banner throughout cardiology worklists.
                  </p>
                </div>
              </div>
            </section>

            <div className="flex items-center justify-end gap-3 pb-4">
              <button
                type="button"
                onClick={onClose}
                className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100"
                disabled={submitting}
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-red-500 to-rose-600 px-5 py-2 text-sm font-semibold text-white shadow hover:from-red-600 hover:to-rose-700 disabled:opacity-60"
              >
                <HeartPulse className="h-4 w-4" />
                {submitting ? 'Saving...' : 'Create Encounter'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </ModalPortal>
  );
};

export default CardiologyEncounterModal;
