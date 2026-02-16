import React, { useMemo, useState, useEffect } from 'react';
import {
  X, Save, ClipboardList, AlertTriangle, Activity, Heart,
  Thermometer, Droplets, Stethoscope, Calendar, Edit2, Brain, Plus, CheckCircle, Search, History, ChevronDown, ChevronUp
} from 'lucide-react';
import { formatDateTimeToDDMMYYYYHHMM } from '../utils/dateFormatting';
import { useNotification } from '../components/GlobalNotification';
import * as Api from '../services/api';
import AllergiesModal from './AllergiesModal';
import ModalPortal from './ModalPortal';
import SnomedConceptPicker, { SnomedConcept } from './SnomedConceptPicker';
import Icd10Suggestions from './Icd10Suggestions';

interface Patient {
  id: string;
  patientNumber: string;
  firstName: string;
  lastName: string;
  dateOfBirth: string;
  gender: string;
}

interface AppointmentLite {
  id: string;
  appointmentDate: string;
  appointmentType: string;
  reason: string;
  status: string;
  patient: Patient;
  paymentStatus?: string;
  financeTransactionId?: string | null;
  feeAmount?: number | null;
}

interface PatientAssessmentProps {
  patient?: Patient;
  appointments?: AppointmentLite[];
  onClose?: () => void;
  onSave?: () => void;
}

const PatientAssessment: React.FC<PatientAssessmentProps> = ({ patient, appointments = [], onClose, onSave }) => {
  const { showSuccess, showError } = useNotification();

  const [chiefComplaint, setChiefComplaint] = useState('');
  const [chiefComplaintConcept, setChiefComplaintConcept] = useState<SnomedConcept | null>(null);
  const [symptoms, setSymptoms] = useState('');
  const [symptomsConcepts, setSymptomsConcepts] = useState<SnomedConcept[]>([]);
  const [pendingSymptomConcept, setPendingSymptomConcept] = useState<SnomedConcept | null>(null);
  const [onset, setOnset] = useState('');
  const [painScore, setPainScore] = useState<number>(0);
  const [allergies, setAllergies] = useState('');
  const [medications, setMedications] = useState('');
  const [medicationConcepts, setMedicationConcepts] = useState<SnomedConcept[]>([]);
  const [pendingMedicationConcept, setPendingMedicationConcept] = useState<SnomedConcept | null>(null);
  const [history, setHistory] = useState('');
  const [historyConcepts, setHistoryConcepts] = useState<SnomedConcept[]>([]);
  const [pendingHistoryConcept, setPendingHistoryConcept] = useState<SnomedConcept | null>(null);
  const [observations, setObservations] = useState('');
  const [observationsConcepts, setObservationsConcepts] = useState<SnomedConcept[]>([]);
  const [pendingObservationConcept, setPendingObservationConcept] = useState<SnomedConcept | null>(null);
  const [priority, setPriority] = useState<'urgent' | 'high' | 'normal' | 'low'>('normal');
  const [loading, setLoading] = useState(false);
  const [showAllergiesModal, setShowAllergiesModal] = useState(false);
  const [structuredAllergies, setStructuredAllergies] = useState<any[]>([]);
  const [diagnosisSuggestions, setDiagnosisSuggestions] = useState<any>(null);
  const [loadingDiagnosis, setLoadingDiagnosis] = useState(false);
  const [cdssInsights, setCdssInsights] = useState<any | null>(null);
  const [guidelineQuery, setGuidelineQuery] = useState('');
  const [guidelineResults, setGuidelineResults] = useState<any[]>([]);
  const [guidelineAnalysis, setGuidelineAnalysis] = useState<string | null>(null);
  const [loadingGuidelines, setLoadingGuidelines] = useState(false);
  const [triageCopilotLoading, setTriageCopilotLoading] = useState(false);
  const [triageCopilotResult, setTriageCopilotResult] = useState<any | null>(null);
  const [recentVitals, setRecentVitals] = useState<any>(null);
  const [triageHistory, setTriageHistory] = useState<any[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [selectedHistory, setSelectedHistory] = useState<any | null>(null);

  const formatAnalysisText = (text: string) => {
    if (!text) return null;
    return text.split(/(\*\*.*?\*\*)/g).map((part, i) => {
      if (part.startsWith('**') && part.endsWith('**')) {
        return <strong key={i} className="font-bold text-slate-900">{part.slice(2, -2)}</strong>;
      }
      return <span key={i}>{part}</span>;
    });
  };

  // Load triage history when patient changes
  useEffect(() => {
    if (patient?.id) {
      const loadHistory = async () => {
        try {
          const token = localStorage.getItem('ehr_token');
          const tenantSlug = localStorage.getItem('ehr_tenant_slug');
          if (!token || !tenantSlug) return;
          
          const response = await Api.ehrApi.getTriageAssessments(patient.id, token, tenantSlug);
          if (response.data && response.data.assessments) {
            setTriageHistory(response.data.assessments);
          } else if (Array.isArray(response.data)) {
            setTriageHistory(response.data);
          } else {
            setTriageHistory([]);
          }
        } catch (e) {
          console.error('Failed to load triage history:', e);
        }
      };
      loadHistory();
    } else {
      setTriageHistory([]);
    }
  }, [patient?.id]);

  useEffect(() => {
    const loadVitals = async () => {
      if (!patient?.id) return;
      try {
        const token = localStorage.getItem('ehr_token');
        const tenantSlug = localStorage.getItem('ehr_tenant_slug');
        if (!token || !tenantSlug) return;
        const response = await Api.ehrApi.getVitals(patient.id, token, tenantSlug, { trend: true, limit: 1 });
        if (response.data && response.data.latest) {
          setRecentVitals(response.data.latest);
        } else if (response.data && response.data.vitals && response.data.vitals.length > 0) {
           // Fallback if trend=false or structure differs
           setRecentVitals(response.data.vitals[0]);
        } else {
          setRecentVitals(null);
        }
      } catch (e) {
        console.error('Failed to load recent vitals', e);
      }
    };
    loadVitals();
  }, [patient?.id]);

  const handleGuidelineSearch = async () => {
    if (!guidelineQuery.trim()) return;
    setLoadingGuidelines(true);
    try {
      const token = localStorage.getItem('ehr_token');
      const tenantSlug = localStorage.getItem('ehr_tenant_slug');
      if (!token || !tenantSlug) {
        showError('Error', 'Session expired. Please login again.');
        return;
      }
      
      let searchContext = "Triage protocols, clinical guidelines";
      
      // Enhance with patient context
      if (patient) {
        const patientContext = [];
        if (patient.dateOfBirth) {
            const age = Math.floor((new Date().getTime() - new Date(patient.dateOfBirth).getTime()) / (1000 * 60 * 60 * 24 * 365.25));
            patientContext.push(`${age}yo`);
        }
        if (patient.gender) patientContext.push(patient.gender);
        if (patientContext.length > 0) {
          searchContext += `. Patient: ${patientContext.join(', ')}`;
        }
      }

      // Enhance with current triage data
      if (chiefComplaint) searchContext += `. CC: ${chiefComplaint}`;
      if (chiefComplaintConcept) searchContext += ` (SNOMED: ${chiefComplaintConcept.term})`;
      if (observations) searchContext += `. Obs: ${observations}`;

      const finalQuery = `${searchContext}: ${guidelineQuery}`;
      
      const response = await Api.ehrApi.searchGuidelines(finalQuery, token, tenantSlug);
      if (response.data) {
        setGuidelineResults(response.data.citations || []);
        setGuidelineAnalysis(response.data.analysis || null);
      } else {
        setGuidelineResults([]);
        setGuidelineAnalysis(null);
      }
    } catch (e) {
      console.error('Guideline search failed:', e);
      showError('Error', 'Failed to search guidelines');
    } finally {
      setLoadingGuidelines(false);
    }
  };

  useEffect(() => {
    setCdssInsights(null);
  }, [patient?.id]);

  const handleTriageCopilot = async () => {
    if (!patient) {
      showError('Error', 'No patient selected');
      return;
    }
    try {
      setTriageCopilotLoading(true);
      const token = localStorage.getItem('ehr_token');
      const tenantSlug = localStorage.getItem('ehr_tenant_slug');
      if (!token || !tenantSlug) {
        showError('Error', 'Authentication required');
        return;
      }

      const patientAge = patient.dateOfBirth
        ? Math.floor((new Date().getTime() - new Date(patient.dateOfBirth).getTime()) / (1000 * 60 * 60 * 24 * 365.25))
        : undefined;

      const response = await Api.ehrApi.analyzeTriageCopilot(
        {
          patientId: patient.id,
          age: patientAge,
          gender: patient.gender,
          chiefComplaint,
          symptoms: [chiefComplaint, symptoms].filter(Boolean),
          vitals: recentVitals || undefined,
          conditions: history ? [history] : [],
        },
        token,
        tenantSlug
      );
      setTriageCopilotResult(response.data || null);

      const suggested = response.data?.suggestedTriageLevel;
      if (suggested && ['urgent', 'high', 'normal', 'low'].includes(suggested)) {
        setPriority(suggested as 'urgent' | 'high' | 'normal' | 'low');
      }
      showSuccess('Copilot Ready', 'Review suggestion before final save.');
    } catch (error) {
      console.error('Triage copilot failed', error);
      showError('Error', 'Failed to analyze triage context');
    } finally {
      setTriageCopilotLoading(false);
    }
  };

  // Load existing allergies from structured table when patient is selected
  useEffect(() => {
    if (!patient?.id) return;
    
    const loadAllergies = async () => {
      try {
        const token = localStorage.getItem('ehr_token');
        const tenantSlug = localStorage.getItem('ehr_tenant_slug');
        if (!token || !tenantSlug) return;

        const response = await Api.chartApi.getAllergies(patient.id, token, tenantSlug);
        const existingAllergies = response.data || [];
        setStructuredAllergies(existingAllergies);

        // Format allergies for display in text field
        if (existingAllergies.length > 0) {
          const formatted = existingAllergies.map((a: any) => {
            let str = a.allergen;
            if (a.reaction) str += ` (${a.reaction})`;
            if (a.severity) str += ` - ${a.severity}`;
            return str;
          }).join(', ');
          setAllergies(formatted);
        } else {
          setAllergies('');
        }
      } catch (e) {
        console.error('Failed to load allergies:', e);
        // Don't set error - just leave allergies field empty
      }
    };

    loadAllergies();
  }, [patient?.id]);

  const severityScore = useMemo(() => {
    let score = 0;
    // Simple heuristic: higher pain and urgent priority raise score
    score += painScore;
    score += priority === 'urgent' ? 5 : priority === 'high' ? 3 : priority === 'normal' ? 1 : 0;
    // Onset text heuristic
    if (onset.toLowerCase().includes('sudden')) score += 2;
    return Math.min(10, score);
  }, [painScore, priority, onset]);

  const handleSave = async () => {
    if (!patient) {
      showError('Error', 'No patient selected for triage');
      return;
    }
    try {
      setLoading(true);
      const token = localStorage.getItem('ehr_token');
      const tenantSlug = localStorage.getItem('ehr_tenant_slug');
      
      if (!token || !tenantSlug) {
        showError('Error', 'Authentication required');
        return;
      }

      const triagePayload = {
        patientId: patient.id,
        chiefComplaint,
        chief_complaint_snomed: chiefComplaintConcept,
        symptoms,
        symptoms_snomed: symptomsConcepts,
        onset,
        painScore,
        allergies,
        medications,
        medications_snomed: medicationConcepts,
        history,
        history_snomed: historyConcepts,
        observations,
        observations_snomed: observationsConcepts,
        priority,
        severityScore,
        recordedAt: new Date().toISOString(),
        recordedBy: JSON.parse(localStorage.getItem('ehr_user') || '{}').id,
      };

      const response = await Api.ehrApi.recordTriageAssessment(triagePayload, token, tenantSlug);
      setCdssInsights(response.data?.cdssInsights ?? null);
      showSuccess('Saved', 'Triage assessment recorded');
      onSave?.();
    } catch (e) {
      console.error(e);
      showError('Error', 'Failed to save triage assessment');
    } finally {
      setLoading(false);
    }
  };

  // If used as a full-page panel without a bound patient, show guidance
  if (!patient) {
    return (
      <div className="bg-gradient-to-br from-white to-slate-50 rounded-2xl shadow-lg border border-slate-200/50 p-8">
        <div className="flex items-center gap-3 mb-6">
          <div className="p-2 bg-gradient-to-r from-orange-500 to-yellow-600 rounded-xl">
            <ClipboardList className="w-6 h-6 text-white" />
          </div>
          <h3 className="text-xl font-bold text-slate-900">Triage Assessment</h3>
        </div>
        <div className="text-center py-10">
          <ClipboardList className="w-16 h-16 text-slate-400 mx-auto mb-4" />
          <p className="text-slate-600">Select a patient from the queue to start a triage assessment.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Patient Header */}
      <div className="bg-gradient-to-r from-pink-50 to-rose-50 rounded-xl p-6 border border-pink-200/50">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 bg-gradient-to-br from-pink-500 to-rose-600 rounded-xl flex items-center justify-center text-white font-bold text-xl">
            {patient.firstName.charAt(0)}{patient.lastName.charAt(0)}
          </div>
          <div className="flex-1">
            <h3 className="text-xl font-bold text-slate-900">
              {patient.firstName} {patient.lastName}
            </h3>
            <p className="text-slate-600">ID: {patient.patientNumber}</p>
          </div>
          <div className="hidden md:flex items-center gap-6 text-sm text-slate-600">
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4" />
              <span>Recent: {recentVitals ? formatDateTimeToDDMMYYYYHHMM(recentVitals.recordedAt) : 'N/A'}</span>
            </div>
            <div className="flex items-center gap-2">
              <Stethoscope className="w-4 h-4" />
              <span>{appointments[0]?.appointmentType || '—'}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Triage History Section */}
      {triageHistory.length > 0 && (
        <div className="bg-white rounded-xl p-4 border border-slate-200">
          <button 
            onClick={() => setShowHistory(!showHistory)}
            className="flex items-center justify-between w-full text-left"
          >
            <div className="flex items-center gap-2 text-slate-700 font-semibold">
              <History className="w-5 h-5 text-slate-500" />
              <span>Previous Triage Assessments ({triageHistory.length})</span>
            </div>
            {showHistory ? <ChevronUp className="w-5 h-5 text-slate-400" /> : <ChevronDown className="w-5 h-5 text-slate-400" />}
          </button>
          
          {showHistory && (
            <div className="mt-4 space-y-3">
              {triageHistory.map((assessment, idx) => (
                <div 
                  key={assessment.id || idx} 
                  className="p-3 bg-slate-50 rounded-lg border border-slate-100 text-sm hover:bg-slate-100 transition-colors cursor-pointer"
                  onClick={() => setSelectedHistory(assessment)}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-semibold text-slate-700 flex items-center gap-2">
                      {new Date(assessment.recordedAt).toLocaleDateString()} at {new Date(assessment.recordedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      <span className="text-xs font-normal text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full border border-blue-100">
                        View Details
                      </span>
                    </span>
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium capitalize ${
                      assessment.priority === 'urgent' ? 'bg-red-100 text-red-700' :
                      assessment.priority === 'high' ? 'bg-orange-100 text-orange-700' :
                      'bg-blue-100 text-blue-700'
                    }`}>
                      {assessment.priority}
                    </span>
                  </div>
                  <div className="space-y-1 text-slate-600">
                    <p><span className="font-medium text-slate-700">CC:</span> {assessment.chiefComplaint}</p>
                    {assessment.painScore > 0 && <p><span className="font-medium text-slate-700">Pain:</span> {assessment.painScore}/10</p>}
                    {assessment.vitals && (
                      <p className="text-xs text-slate-500">
                        BP: {assessment.vitals.bloodPressure || '-'}, HR: {assessment.vitals.heartRate || '-'}, Temp: {assessment.vitals.temperature || '-'}°C
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {cdssInsights && (
        <div className="p-6 bg-white rounded-2xl border border-indigo-200/80 shadow-sm space-y-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl">
              <Brain className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-slate-900">CDSS Insights</h3>
              <p className="text-sm text-slate-500">
                Recommendations generated automatically from triage data. Review before making clinical decisions.
              </p>
            </div>
          </div>

          {cdssInsights.risk && (
            <div className="rounded-xl border border-slate-200 p-4 bg-slate-50 space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold text-slate-800">Risk Assessment</p>
                <span className="inline-flex items-center gap-2 text-xs font-semibold px-3 py-1 rounded-full bg-slate-900 text-white capitalize">
                  {cdssInsights.risk.risk_level || 'unknown'} · Score {cdssInsights.risk.overall_score ?? '—'}
                </span>
              </div>
              {Array.isArray(cdssInsights.risk.factors) && cdssInsights.risk.factors.length > 0 && (
                <ul className="text-sm text-slate-600 space-y-1 list-disc list-inside">
                  {cdssInsights.risk.factors.slice(0, 4).map((factor: any, idx: number) => (
                    <li key={`factor-${idx}`}>{factor?.description || factor}</li>
                  ))}
                </ul>
              )}
              {Array.isArray(cdssInsights.risk.recommendations) && cdssInsights.risk.recommendations.length > 0 && (
                <div className="text-xs text-slate-500">
                  <span className="font-semibold text-slate-600">Recommendations:</span>{' '}
                  {cdssInsights.risk.recommendations.slice(0, 3).join(' · ')}
                </div>
              )}
              {/* Guideline Citations */}
              {cdssInsights.risk.guideline_citations && cdssInsights.risk.guideline_citations.length > 0 && (
                <div className="mt-3 pt-3 border-t border-indigo-100">
                  <p className="text-xs font-semibold text-slate-600 mb-1 flex items-center gap-1">
                    <CheckCircle className="w-3 h-3 text-emerald-500" />
                    Evidence & Guidelines
                  </p>
                  <ul className="text-[10px] text-slate-500 space-y-1.5">
                    {cdssInsights.risk.guideline_citations.slice(0, 2).map((citation: string, idx: number) => (
                      <li key={`cite-${idx}`} className="bg-slate-50 p-1.5 rounded border border-slate-100 italic leading-tight">
                        "{citation.length > 120 ? citation.substring(0, 120) + '...' : citation}"
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}

          {cdssInsights.diagnosis && (
            <div className="rounded-xl border border-slate-200 p-4 bg-white space-y-2">
              <p className="text-sm font-semibold text-slate-800">Likely Diagnoses</p>
              <div className="grid gap-2">
                {Array.isArray(cdssInsights.diagnosis.suggested_diagnoses) &&
                  cdssInsights.diagnosis.suggested_diagnoses.slice(0, 3).map((diag: any, idx: number) => (
                    <div
                      key={`diag-${idx}`}
                      className="flex items-center justify-between text-sm py-2 px-3 rounded-lg border border-slate-100 bg-slate-50"
                    >
                      <div>
                        <p className="font-medium text-slate-800">{diag.diagnosis || diag.condition}</p>
                        {diag.matching_symptoms && (
                          <p className="text-xs text-slate-500">
                            Matches: {Array.isArray(diag.matching_symptoms) ? diag.matching_symptoms.join(', ') : diag.matching_symptoms}
                          </p>
                        )}
                      </div>
                      <span className="text-xs font-semibold text-slate-500">
                        {(diag.probability ? Math.round(diag.probability * 100) : 0)}%
                      </span>
                    </div>
                  ))}
              </div>
              {Array.isArray(cdssInsights.diagnosis.recommendedTests) && cdssInsights.diagnosis.recommendedTests.length > 0 && (
                <div className="text-xs text-slate-500">
                  <span className="font-semibold text-slate-600">Suggested tests:</span>{' '}
                  {cdssInsights.diagnosis.recommendedTests.slice(0, 3).join(', ')}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Guideline Search Section */}
      <div className="p-6 bg-white rounded-2xl border border-indigo-200/80 shadow-sm space-y-4">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl">
            <Search className="w-5 h-5 text-white" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-slate-900">Guideline Search</h3>
            <p className="text-sm text-slate-500">
              Search clinical guidelines and protocols using AI-powered search.
            </p>
          </div>
        </div>

        <div className="flex gap-2">
          <input
            type="text"
            value={guidelineQuery}
            onChange={(e) => setGuidelineQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleGuidelineSearch()}
            placeholder="e.g. hypertension treatment guidelines"
            className="flex-1 px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
          />
          <button
            onClick={handleGuidelineSearch}
            disabled={loadingGuidelines || !guidelineQuery.trim()}
            className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {loadingGuidelines ? 'Searching...' : 'Search'}
          </button>
        </div>

        {guidelineAnalysis && (
          <div className="mt-4 p-4 bg-indigo-50/50 rounded-xl border border-indigo-100">
            <h4 className="text-sm font-semibold text-indigo-900 mb-2 flex items-center gap-2">
              <Brain className="w-4 h-4" />
              AI Clinical Analysis
            </h4>
            <div className="text-sm text-slate-700 leading-relaxed whitespace-pre-wrap">
              {formatAnalysisText(guidelineAnalysis)}
            </div>
          </div>
        )}

        {guidelineResults.length > 0 && (
          <div className="space-y-3 mt-4">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Evidence Sources</p>
            {guidelineResults.map((citation: any, idx: number) => (
              <div key={`search-res-${idx}`} className="p-3 bg-slate-50 rounded-lg border border-slate-100 text-sm text-slate-600">
                {/* Handle both string and object citations if necessary */}
                {typeof citation === 'string' ? citation : (citation.content || JSON.stringify(citation))}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Triage Form */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <div className="p-6 bg-white/70 rounded-2xl border border-slate-200/60 shadow-sm">
            <div className="flex items-center justify-between mb-2">
              <label className="block text-sm font-semibold text-slate-700">Chief Complaint</label>
              {chiefComplaint && chiefComplaint.length > 10 && (
                <button
                  onClick={async () => {
                    setLoadingDiagnosis(true);
                    try {
                      const token = localStorage.getItem('ehr_token');
                      const tenantSlug = localStorage.getItem('ehr_tenant_slug');
                      if (!token || !tenantSlug || !patient) return;
                      
                      const patientAge = patient.dateOfBirth
                        ? Math.floor((new Date().getTime() - new Date(patient.dateOfBirth).getTime()) / (1000 * 60 * 60 * 24 * 365.25))
                        : undefined;
                      
                      const symptomsArray = [
                        chiefComplaint, 
                        chiefComplaintConcept?.term, 
                        onset,
                        ...observationsConcepts.map(c => c.term)
                      ];
                      const uniqueSymptoms = Array.from(new Set(symptomsArray.filter((s): s is string => !!s)));
                      console.log('🔍 Sending symptoms to API:', uniqueSymptoms);
                      
                      const result = await Api.ehrApi.getDiagnosisSuggestions({
                        symptoms: uniqueSymptoms,
                        age: patientAge,
                        gender: patient.gender,
                      }, token, tenantSlug);
                      
                      console.log('🔍 Diagnosis suggestions full response:', result);
                      console.log('🔍 Diagnosis suggestions data:', result.data);
                      
                      // Handle response - it might be nested
                      const suggestionsData = result.data || result;
                      
                      console.log('🔍 Processed suggestionsData:', suggestionsData);
                      
                      // Ensure proper structure
                      if (suggestionsData.suggested_diagnoses && suggestionsData.suggested_diagnoses.length > 0) {
                        console.log('✅ Using suggested_diagnoses format');
                        setDiagnosisSuggestions(suggestionsData);
                      } else if (suggestionsData.differentialDiagnoses && Array.isArray(suggestionsData.differentialDiagnoses)) {
                        console.log('⚠️ Using fallback differentialDiagnoses format, count:', suggestionsData.differentialDiagnoses.length);
                        // Handle fallback format - even if empty, create structure
                        const convertedDiagnoses = suggestionsData.differentialDiagnoses.map((d: any) => ({
                          diagnosis: d.condition || d.diagnosis || 'Unknown',
                          probability: d.probability || 0.5,
                          confidence: d.confidence || 'moderate',
                          matching_symptoms: d.matching_symptoms || []
                        }));
                        setDiagnosisSuggestions({
                          suggested_diagnoses: convertedDiagnoses,
                          recommended_tests: suggestionsData.recommendedTests || suggestionsData.recommended_tests || [],
                          red_flags: []
                        });
                      } else {
                        console.warn('⚠️ Unexpected response format:', suggestionsData);
                        // Still show the structure even if empty
                        setDiagnosisSuggestions({
                          suggested_diagnoses: [],
                          recommended_tests: suggestionsData.recommendedTests || suggestionsData.recommended_tests || [],
                          red_flags: [],
                          error: 'No diagnoses found. The symptom matching might need adjustment.'
                        });
                      }
                    } catch (error) {
                      console.error('Failed to get diagnosis suggestions:', error);
                    } finally {
                      setLoadingDiagnosis(false);
                    }
                  }}
                  disabled={loadingDiagnosis}
                  className="px-3 py-1 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-xs font-medium disabled:opacity-50 flex items-center gap-1"
                >
                  <Brain className="w-3 h-3" />
                  {loadingDiagnosis ? 'Analyzing...' : 'AI Assist'}
                </button>
              )}
            </div>
            <textarea
              value={chiefComplaint}
              onChange={(e) => {
                setChiefComplaint(e.target.value);
                setDiagnosisSuggestions(null);
              }}
              className="w-full px-3 py-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-pink-500 focus:border-transparent resize-none"
              rows={3}
              placeholder="Patient's primary concern in their own words"
            />
            <div className="mt-2">
              <SnomedConceptPicker
                value={chiefComplaintConcept}
                onChange={setChiefComplaintConcept}
                token={localStorage.getItem('ehr_token') || ''}
                tenantSlug={localStorage.getItem('ehr_tenant_slug') || ''}
                label="SNOMED CT Code (Optional)"
                placeholder="Search for SNOMED concept..."
                context="condition"
                helperText="Select a SNOMED CT concept to code the chief complaint"
              />
            </div>
            
            {chiefComplaintConcept && (
              <Icd10Suggestions
                snomedConceptId={chiefComplaintConcept.conceptId}
                token={localStorage.getItem('ehr_token') || ''}
                tenantSlug={localStorage.getItem('ehr_tenant_slug') || ''}
                className="mt-3"
              />
            )}
            
            {diagnosisSuggestions && (
              <div className="mt-3 p-3 bg-blue-50 rounded-lg border border-blue-200">
                <h5 className="text-xs font-semibold text-blue-900 mb-2 flex items-center gap-1">
                  <Brain className="w-3 h-3" />
                  Suggested Diagnoses
                </h5>
                {diagnosisSuggestions.suggested_diagnoses && diagnosisSuggestions.suggested_diagnoses.length > 0 ? (
                  <>
                    <div className="space-y-2">
                      {diagnosisSuggestions.suggested_diagnoses.slice(0, 5).map((diag: any, idx: number) => (
                        <div key={idx} className="text-xs bg-white rounded p-2 border border-blue-200">
                          <div className="flex items-center justify-between">
                            <span className="font-medium text-slate-900">{diag.diagnosis || diag.condition || 'Unknown'}</span>
                            <span className={`ml-2 px-1.5 py-0.5 rounded text-xs ${
                              (diag.confidence === 'high') ? 'bg-green-100 text-green-700' :
                              (diag.confidence === 'moderate') ? 'bg-yellow-100 text-yellow-700' :
                              'bg-gray-100 text-gray-700'
                            }`}>
                              {((diag.probability || diag.percentage || 0) * 100).toFixed(0)}%
                            </span>
                          </div>
                          {diag.matching_symptoms && diag.matching_symptoms.length > 0 && (
                            <p className="text-xs text-slate-600 mt-1">Matches: {diag.matching_symptoms.join(', ')}</p>
                          )}
                        </div>
                      ))}
                    </div>
                    {diagnosisSuggestions.recommended_tests && diagnosisSuggestions.recommended_tests.length > 0 && (
                      <div className="mt-2 pt-2 border-t border-blue-200">
                        <p className="text-xs font-medium text-blue-900 mb-1">Recommended Tests:</p>
                        <ul className="text-xs text-blue-700 space-y-0.5">
                          {diagnosisSuggestions.recommended_tests.slice(0, 5).map((test: string, idx: number) => (
                            <li key={idx}>• {test}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {diagnosisSuggestions.red_flags && diagnosisSuggestions.red_flags.length > 0 && (
                      <div className="mt-2 pt-2 border-t border-red-200 bg-red-50 rounded p-2">
                        <p className="text-xs font-semibold text-red-900 mb-1">⚠️ Red Flags:</p>
                        <ul className="text-xs text-red-700 space-y-0.5">
                          {diagnosisSuggestions.red_flags.slice(0, 3).map((flag: string, idx: number) => (
                            <li key={idx}>• {flag}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </>
                ) : (
                  <p className="text-xs text-slate-600">No diagnoses found. Try providing more detailed symptoms.</p>
                )}
              </div>
            )}
          </div>

          <div className="p-6 bg-white/70 rounded-2xl border border-slate-200/60 shadow-sm">
            <label className="block text-sm font-semibold text-slate-700 mb-2">Symptoms</label>
            <textarea
              value={symptoms}
              onChange={(e) => setSymptoms(e.target.value)}
              className="w-full px-3 py-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-pink-500 focus:border-transparent resize-none"
              rows={3}
              placeholder="List specific symptoms (e.g. fever, cough, headache)"
            />
            <div className="mt-2">
              <SnomedConceptPicker
                value={pendingSymptomConcept}
                onChange={setPendingSymptomConcept}
                token={localStorage.getItem('ehr_token') || ''}
                tenantSlug={localStorage.getItem('ehr_tenant_slug') || ''}
                label="SNOMED CT Symptoms (Optional)"
                placeholder="Search for symptom concept..."
                context="symptom"
                helperText="Select a SNOMED CT concept to code the patient's symptoms"
              />
              {pendingSymptomConcept && (
                <button
                  type="button"
                  onClick={() => {
                    setSymptomsConcepts([...symptomsConcepts, pendingSymptomConcept]);
                    setPendingSymptomConcept(null);
                  }}
                  className="mt-2 px-3 py-1.5 bg-pink-600 text-white rounded-lg hover:bg-pink-700 transition-colors text-sm font-medium flex items-center gap-1"
                >
                  <Plus className="w-3 h-3" />
                  Add Symptom
                </button>
              )}
              {symptomsConcepts.length > 0 && (
                <div className="mt-2 space-y-1">
                  {symptomsConcepts.map((concept, idx) => (
                    <div key={idx} className="flex items-center justify-between bg-slate-50 px-3 py-2 rounded-lg">
                      <span className="text-sm text-slate-700">
                        <span className="font-medium">{concept.term}</span>
                        <span className="text-xs text-slate-500 ml-2">({concept.conceptId})</span>
                      </span>
                      <button
                        type="button"
                        onClick={() => setSymptomsConcepts(symptomsConcepts.filter((_, i) => i !== idx))}
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

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="p-6 bg-white/70 rounded-2xl border border-slate-200/60 shadow-sm">
              <label className="block text-sm font-semibold text-slate-700 mb-2">Onset and Course</label>
              <input
                value={onset}
                onChange={(e) => setOnset(e.target.value)}
                className="w-full px-3 py-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-pink-500 focus:border-transparent"
                placeholder="e.g., Sudden onset 2 hours ago"
              />
            </div>
            <div className="p-6 bg-white/70 rounded-2xl border border-slate-200/60 shadow-sm">
              <label className="block text-sm font-semibold text-slate-700 mb-2">Pain Score (0-10)</label>
              <input
                type="number"
                min={0}
                max={10}
                value={painScore}
                onChange={(e) => setPainScore(Number(e.target.value))}
                className="w-full px-3 py-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-pink-500 focus:border-transparent"
                placeholder="0 (no pain) to 10 (worst pain)"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="p-6 bg-white/70 rounded-2xl border border-slate-200/60 shadow-sm">
              <div className="flex items-center justify-between mb-2">
                <label className="block text-sm font-semibold text-slate-700">Allergies</label>
                <button
                  onClick={() => setShowAllergiesModal(true)}
                  className="flex items-center gap-1 text-xs px-2 py-1 bg-rose-50 text-rose-700 rounded-lg hover:bg-rose-100 transition-colors"
                  title="Manage structured allergies"
                >
                  <Edit2 className="w-3 h-3" />
                  Manage
                </button>
              </div>
              {structuredAllergies.length > 0 && (
                <div className="mb-2 space-y-1">
                  {structuredAllergies.slice(0, 3).map((a: any, idx: number) => (
                    <div key={idx} className="text-xs flex items-center gap-2">
                      <AlertTriangle className="w-3 h-3 text-rose-600" />
                      <span className="font-medium text-slate-700">{a.allergen}</span>
                      {a.severity && (
                        <span className={`px-1.5 py-0.5 rounded text-xs ${
                          a.severity === 'severe' ? 'bg-red-100 text-red-700' :
                          a.severity === 'moderate' ? 'bg-orange-100 text-orange-700' :
                          'bg-yellow-100 text-yellow-700'
                        }`}>
                          {a.severity}
                        </span>
                      )}
                    </div>
                  ))}
                  {structuredAllergies.length > 3 && (
                    <div className="text-xs text-slate-500">+{structuredAllergies.length - 3} more</div>
                  )}
                </div>
              )}
              <textarea
                value={allergies}
                onChange={(e) => setAllergies(e.target.value)}
                className="w-full px-3 py-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-pink-500 focus:border-transparent resize-none"
                rows={3}
                placeholder="Quick note: Allergies are managed via 'Manage' button. Type here for temporary notes during triage."
              />
              <p className="text-xs text-slate-500 mt-1">Note: Use "Manage" button to add/edit structured allergies</p>
            </div>
            <div className="p-6 bg-white/70 rounded-2xl border border-slate-200/60 shadow-sm">
              <label className="block text-sm font-semibold text-slate-700 mb-2">Current Medications</label>
              <textarea
                value={medications}
                onChange={(e) => setMedications(e.target.value)}
                className="w-full px-3 py-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-pink-500 focus:border-transparent resize-none"
                rows={3}
                placeholder="List active medications"
              />
              <div className="mt-2">
                <SnomedConceptPicker
                  value={pendingMedicationConcept}
                  onChange={setPendingMedicationConcept}
                  token={localStorage.getItem('ehr_token') || ''}
                  tenantSlug={localStorage.getItem('ehr_tenant_slug') || ''}
                  label="SNOMED CT Medications (Optional)"
                  placeholder="Search medications..."
                  context="medication"
                  helperText="Code active medications"
                />
                {pendingMedicationConcept && (
                  <button
                    type="button"
                    onClick={() => {
                      setMedicationConcepts([...medicationConcepts, pendingMedicationConcept]);
                      setPendingMedicationConcept(null);
                    }}
                    className="mt-2 px-3 py-1.5 bg-pink-600 text-white rounded-lg hover:bg-pink-700 transition-colors text-sm font-medium flex items-center gap-1"
                  >
                    <Plus className="w-3 h-3" />
                    Add Medication
                  </button>
                )}
                {medicationConcepts.length > 0 && (
                  <div className="mt-2 space-y-1">
                    {medicationConcepts.map((concept, idx) => (
                      <div key={idx} className="flex items-center justify-between bg-slate-50 px-3 py-2 rounded-lg">
                        <span className="text-sm text-slate-700">
                          <span className="font-medium">{concept.term}</span>
                          <span className="text-xs text-slate-500 ml-2">({concept.conceptId})</span>
                        </span>
                        <button
                          type="button"
                          onClick={() => setMedicationConcepts(medicationConcepts.filter((_, i) => i !== idx))}
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
          </div>

          <div className="p-6 bg-white/70 rounded-2xl border border-slate-200/60 shadow-sm">
            <label className="block text-sm font-semibold text-slate-700 mb-2">Relevant History</label>
            <textarea
              value={history}
              onChange={(e) => setHistory(e.target.value)}
              className="w-full px-3 py-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-pink-500 focus:border-transparent resize-none"
              rows={3}
              placeholder="Brief past medical/surgical history relevant to the visit"
            />
            <div className="mt-2">
              <SnomedConceptPicker
                value={pendingHistoryConcept}
                onChange={setPendingHistoryConcept}
                token={localStorage.getItem('ehr_token') || ''}
                tenantSlug={localStorage.getItem('ehr_tenant_slug') || ''}
                label="SNOMED CT History (Optional)"
                placeholder="Search conditions/procedures..."
                ecl="<< 404684003 OR << 71388002" // Clinical finding OR Procedure
                helperText="Code past conditions or procedures"
              />
              {pendingHistoryConcept && (
                <button
                  type="button"
                  onClick={() => {
                    setHistoryConcepts([...historyConcepts, pendingHistoryConcept]);
                    setPendingHistoryConcept(null);
                  }}
                  className="mt-2 px-3 py-1.5 bg-pink-600 text-white rounded-lg hover:bg-pink-700 transition-colors text-sm font-medium flex items-center gap-1"
                >
                  <Plus className="w-3 h-3" />
                  Add History Concept
                </button>
              )}
              {historyConcepts.length > 0 && (
                <div className="mt-2 space-y-1">
                  {historyConcepts.map((concept, idx) => (
                    <div key={idx} className="flex items-center justify-between bg-slate-50 px-3 py-2 rounded-lg">
                      <span className="text-sm text-slate-700">
                        <span className="font-medium">{concept.term}</span>
                        <span className="text-xs text-slate-500 ml-2">({concept.conceptId})</span>
                      </span>
                      <button
                        type="button"
                        onClick={() => setHistoryConcepts(historyConcepts.filter((_, i) => i !== idx))}
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

          <div className="p-6 bg-white/70 rounded-2xl border border-slate-200/60 shadow-sm">
            <label className="block text-sm font-semibold text-slate-700 mb-2">Nurse Observations</label>
            <textarea
              value={observations}
              onChange={(e) => setObservations(e.target.value)}
              className="w-full px-3 py-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-pink-500 focus:border-transparent resize-none"
              rows={4}
              placeholder="General appearance, orientation, distress, etc."
            />
            <div className="mt-2">
              <SnomedConceptPicker
                value={pendingObservationConcept}
                onChange={setPendingObservationConcept}
                token={localStorage.getItem('ehr_token') || ''}
                tenantSlug={localStorage.getItem('ehr_tenant_slug') || ''}
                label="SNOMED CT Observations (Optional)"
                placeholder="Search for observation concept..."
                context="condition"
                helperText="Add SNOMED CT concepts for structured coding"
              />
              {pendingObservationConcept && (
                <button
                  type="button"
                  onClick={() => {
                    setObservationsConcepts([...observationsConcepts, pendingObservationConcept]);
                    setPendingObservationConcept(null);
                  }}
                  className="mt-2 px-3 py-1.5 bg-pink-600 text-white rounded-lg hover:bg-pink-700 transition-colors text-sm font-medium flex items-center gap-1"
                >
                  <Plus className="w-3 h-3" />
                  Add Concept
                </button>
              )}
              {observationsConcepts.length > 0 && (
                <div className="mt-2 space-y-1">
                  {observationsConcepts.map((concept, idx) => (
                    <div key={idx} className="flex items-center justify-between bg-slate-50 px-3 py-2 rounded-lg">
                      <span className="text-sm text-slate-700">
                        <span className="font-medium">{concept.term}</span>
                        <span className="text-xs text-slate-500 ml-2">({concept.conceptId})</span>
                      </span>
                      <button
                        type="button"
                        onClick={() => setObservationsConcepts(observationsConcepts.filter((_, i) => i !== idx))}
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
        </div>

        {/* Right rail */}
        <div className="space-y-6">
          {/* Guideline Search Card */}
          <div className="p-6 bg-gradient-to-br from-white to-slate-50 rounded-2xl border border-slate-200/60 shadow-sm">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 bg-gradient-to-r from-blue-500 to-indigo-600 rounded-xl">
                <Brain className="w-5 h-5 text-white" />
              </div>
              <h4 className="text-sm font-bold text-slate-900">Clinical Guidelines</h4>
            </div>
            
            <div className="flex gap-2 mb-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  value={guidelineQuery}
                  onChange={(e) => setGuidelineQuery(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleGuidelineSearch()}
                  placeholder="Search protocols..."
                  className="w-full pl-9 pr-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              <button
                onClick={handleGuidelineSearch}
                disabled={loadingGuidelines || !guidelineQuery.trim()}
                className="px-3 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
              >
                {loadingGuidelines ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : 'Go'}
              </button>
            </div>

            {guidelineResults.length > 0 && (
              <div className="space-y-2 max-h-60 overflow-y-auto custom-scrollbar">
                {guidelineResults.map((citation: any, idx: number) => (
                  <div key={idx} className="bg-white p-2 rounded border border-slate-200 text-xs">
                    <div className="flex items-start gap-2">
                      <CheckCircle className="w-3 h-3 text-green-500 mt-0.5 flex-shrink-0" />
                      <div>
                        <p className="text-slate-800 leading-tight">
                          {typeof citation === 'string' ? citation : (citation.content || JSON.stringify(citation))}
                        </p>
                        {citation.source && (
                          <span className="text-[10px] text-slate-400 mt-1 block">
                            Src: {citation.source}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="p-6 bg-gradient-to-br from-white to-slate-50 rounded-2xl border border-slate-200/60 shadow-sm">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 bg-gradient-to-r from-orange-500 to-yellow-600 rounded-xl">
                <AlertTriangle className="w-5 h-5 text-white" />
              </div>
              <h4 className="text-sm font-bold text-slate-900">Priority</h4>
            </div>
            <button
              type="button"
              onClick={handleTriageCopilot}
              disabled={triageCopilotLoading}
              className="w-full mb-3 px-3 py-2 rounded-lg bg-amber-600 text-white text-sm font-semibold hover:bg-amber-700 disabled:opacity-50"
            >
              {triageCopilotLoading ? 'Analyzing...' : 'Analyze + Apply Copilot Priority'}
            </button>
            {triageCopilotResult && (
              <div className="mb-3 rounded-lg bg-amber-50 border border-amber-200 p-2 text-xs text-amber-900">
                <p><strong>Risk:</strong> {triageCopilotResult.riskLevel || 'unknown'}</p>
                <p><strong>Suggested:</strong> {triageCopilotResult.suggestedTriageLevel || 'n/a'}</p>
              </div>
            )}
            <div className="grid grid-cols-2 gap-3">
              {(['urgent','high','normal','low'] as const).map((p) => (
                <button
                  key={p}
                  onClick={() => setPriority(p)}
                  className={`px-3 py-2 rounded-xl border text-sm font-semibold transition-all ${
                    priority === p
                      ? 'bg-gradient-to-r from-pink-500 to-rose-600 text-white border-transparent'
                      : 'border-slate-300 hover:bg-white'
                  }`}
                >
                  {p.charAt(0).toUpperCase() + p.slice(1)}
                </button>
              ))}
            </div>
          </div>

          <div className="p-6 bg-gradient-to-br from-white to-slate-50 rounded-2xl border border-slate-200/60 shadow-sm">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 bg-gradient-to-r from-indigo-500 to-purple-600 rounded-xl">
                <Activity className="w-5 h-5 text-white" />
              </div>
              <h4 className="text-sm font-bold text-slate-900">Severity Score</h4>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-3xl font-bold text-indigo-600">{severityScore}</span>
              <span className="text-slate-600">/ 10</span>
            </div>
            <p className="text-xs text-slate-500 mt-2">Calculated from pain, priority and onset hints.</p>
          </div>

          {appointments.length > 0 && (
            <div className="p-6 bg-gradient-to-br from-white to-slate-50 rounded-2xl border border-slate-200/60 shadow-sm">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2 bg-gradient-to-r from-slate-500 to-slate-700 rounded-xl">
                  <Calendar className="w-5 h-5 text-white" />
                </div>
                <h4 className="text-sm font-bold text-slate-900">Current Appointment</h4>
              </div>
              <div className="text-sm text-slate-700">
                <div className="font-semibold">{appointments[0].appointmentType}</div>
                <div className="text-slate-600">{formatDateTimeToDDMMYYYYHHMM(appointments[0].appointmentDate)}</div>
                <div className="text-slate-500">Reason: {appointments[0].reason || '—'}</div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Footer actions */}
      {patient && (
        <div className="flex items-center justify-end gap-4 pt-6 border-t border-slate-200">
          <button
            onClick={onClose}
            className="px-6 py-3 border border-slate-300 text-slate-700 rounded-xl hover:bg-slate-50 transition-all duration-200 font-semibold"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={loading}
            className="px-6 py-3 bg-gradient-to-r from-pink-500 to-rose-600 text-white rounded-xl hover:from-pink-600 hover:to-rose-700 transition-all duration-200 font-semibold disabled:opacity-50 flex items-center gap-2"
          >
            {loading ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                Saving...
              </>
            ) : (
              <>
                <Save className="w-4 h-4" />
                Save Assessment
              </>
            )}
          </button>
        </div>
      )}

      {/* Allergies Modal */}
      {showAllergiesModal && patient && (
        <AllergiesModal
          open={showAllergiesModal}
          onClose={() => setShowAllergiesModal(false)}
          onSaved={() => {
            // Reload allergies after save
            const loadAllergies = async () => {
              try {
                const token = localStorage.getItem('ehr_token');
                const tenantSlug = localStorage.getItem('ehr_tenant_slug');
                if (!token || !tenantSlug) return;

                const response = await Api.chartApi.getAllergies(patient.id, token, tenantSlug);
                const existingAllergies = response.data || [];
                setStructuredAllergies(existingAllergies);

                // Format allergies for display in text field
                if (existingAllergies.length > 0) {
                  const formatted = existingAllergies.map((a: any) => {
                    let str = a.allergen;
                    if (a.reaction) str += ` (${a.reaction})`;
                    if (a.severity) str += ` - ${a.severity}`;
                    return str;
                  }).join(', ');
                  setAllergies(formatted);
                } else {
                  setAllergies('');
                }
              } catch (e) {
                console.error('Failed to reload allergies:', e);
              }
            };
            loadAllergies();
          }}
          patientId={patient.id}
          tenantSlug={localStorage.getItem('ehr_tenant_slug') || ''}
          token={localStorage.getItem('ehr_token') || ''}
        />
      )}

      {selectedHistory && (
        <ModalPortal>
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
              <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                <div className="flex items-center gap-4">
                  <div className={`p-3 rounded-xl ${
                    selectedHistory.priority === 'urgent' ? 'bg-red-100 text-red-600' :
                    selectedHistory.priority === 'high' ? 'bg-orange-100 text-orange-600' :
                    'bg-blue-100 text-blue-600'
                  }`}>
                    <Activity className="w-6 h-6" />
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-slate-900">Triage Assessment Details</h2>
                    <p className="text-sm text-slate-500">
                      Recorded on {new Date(selectedHistory.recordedAt).toLocaleDateString()} at {new Date(selectedHistory.recordedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setSelectedHistory(null)}
                  className="p-2 hover:bg-slate-200 rounded-full transition-colors text-slate-500 hover:text-slate-700"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              <div className="p-6 overflow-y-auto space-y-8">
                {/* Vitals Section */}
                {selectedHistory.vitals && (
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="p-4 bg-slate-50 rounded-xl border border-slate-100">
                      <div className="flex items-center gap-2 mb-2 text-slate-500">
                        <Activity className="w-4 h-4" />
                        <span className="text-xs font-semibold uppercase">Blood Pressure</span>
                      </div>
                      <p className="text-lg font-bold text-slate-900">{selectedHistory.vitals.bloodPressure || '—'}</p>
                    </div>
                    <div className="p-4 bg-slate-50 rounded-xl border border-slate-100">
                      <div className="flex items-center gap-2 mb-2 text-slate-500">
                        <Heart className="w-4 h-4" />
                        <span className="text-xs font-semibold uppercase">Heart Rate</span>
                      </div>
                      <p className="text-lg font-bold text-slate-900">{selectedHistory.vitals.heartRate ? `${selectedHistory.vitals.heartRate} bpm` : '—'}</p>
                    </div>
                    <div className="p-4 bg-slate-50 rounded-xl border border-slate-100">
                      <div className="flex items-center gap-2 mb-2 text-slate-500">
                        <Thermometer className="w-4 h-4" />
                        <span className="text-xs font-semibold uppercase">Temperature</span>
                      </div>
                      <p className="text-lg font-bold text-slate-900">{selectedHistory.vitals.temperature ? `${selectedHistory.vitals.temperature}°C` : '—'}</p>
                    </div>
                    <div className="p-4 bg-slate-50 rounded-xl border border-slate-100">
                      <div className="flex items-center gap-2 mb-2 text-slate-500">
                        <Droplets className="w-4 h-4" />
                        <span className="text-xs font-semibold uppercase">O2 Saturation</span>
                      </div>
                      <p className="text-lg font-bold text-slate-900">{selectedHistory.vitals.oxygenSaturation ? `${selectedHistory.vitals.oxygenSaturation}%` : '—'}</p>
                    </div>
                  </div>
                )}

                {/* Main Content Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div className="space-y-6">
                    <div>
                      <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider mb-3">Chief Complaint</h3>
                      <div className="p-4 bg-white border border-slate-200 rounded-xl">
                        <p className="text-slate-800">{selectedHistory.chiefComplaint}</p>
                        {selectedHistory.chief_complaint_snomed && (
                           <div className="mt-2 flex items-center gap-2 text-xs text-indigo-600 bg-indigo-50 px-2 py-1 rounded w-fit">
                             <span className="font-semibold">SNOMED:</span>
                             {selectedHistory.chief_complaint_snomed.term}
                           </div>
                        )}
                      </div>
                    </div>

                    <div>
                      <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider mb-3">Symptoms</h3>
                      <div className="p-4 bg-white border border-slate-200 rounded-xl">
                        <p className="text-slate-800 whitespace-pre-wrap">{selectedHistory.symptoms || 'None recorded'}</p>
                        {selectedHistory.symptoms_snomed && selectedHistory.symptoms_snomed.length > 0 && (
                          <div className="mt-3 flex flex-wrap gap-2">
                            {selectedHistory.symptoms_snomed.map((s: any, idx: number) => (
                              <span key={idx} className="px-2 py-1 bg-slate-100 text-slate-600 rounded text-xs border border-slate-200">
                                {s.term}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                    
                    <div>
                      <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider mb-3">Pain Assessment</h3>
                      <div className="flex items-center gap-4 p-4 bg-white border border-slate-200 rounded-xl">
                         <div className={`text-2xl font-bold ${
                           selectedHistory.painScore >= 7 ? 'text-red-600' :
                           selectedHistory.painScore >= 4 ? 'text-orange-500' :
                           'text-green-600'
                         }`}>
                           {selectedHistory.painScore}/10
                         </div>
                         <div className="h-2 flex-1 bg-slate-100 rounded-full overflow-hidden">
                           <div 
                             className={`h-full ${
                               selectedHistory.painScore >= 7 ? 'bg-red-500' :
                               selectedHistory.painScore >= 4 ? 'bg-orange-500' :
                               'bg-green-500'
                             }`}
                             style={{ width: `${selectedHistory.painScore * 10}%` }}
                           />
                         </div>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-6">
                    <div>
                      <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider mb-3">Clinical History</h3>
                      <div className="p-4 bg-white border border-slate-200 rounded-xl space-y-4">
                        <div>
                          <span className="text-xs font-semibold text-slate-500 uppercase block mb-1">Onset</span>
                          <p className="text-slate-800">{selectedHistory.onset || 'Not specified'}</p>
                        </div>
                        <div>
                          <span className="text-xs font-semibold text-slate-500 uppercase block mb-1">Medical History</span>
                          <p className="text-slate-800 whitespace-pre-wrap">{selectedHistory.history || 'None recorded'}</p>
                          {selectedHistory.history_snomed && selectedHistory.history_snomed.length > 0 && (
                            <div className="mt-2 flex flex-wrap gap-2">
                              {selectedHistory.history_snomed.map((h: any, idx: number) => (
                                <span key={idx} className="px-2 py-1 bg-slate-100 text-slate-600 rounded text-xs border border-slate-200">
                                  {h.term}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    <div>
                      <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider mb-3">Medications & Allergies</h3>
                      <div className="p-4 bg-white border border-slate-200 rounded-xl space-y-4">
                        <div>
                          <span className="text-xs font-semibold text-slate-500 uppercase block mb-1">Current Medications</span>
                          <p className="text-slate-800 whitespace-pre-wrap">{selectedHistory.medications || 'None recorded'}</p>
                        </div>
                        <div>
                          <span className="text-xs font-semibold text-slate-500 uppercase block mb-1">Allergies</span>
                          <p className="text-slate-800 whitespace-pre-wrap">{selectedHistory.allergies || 'No known allergies'}</p>
                        </div>
                      </div>
                    </div>

                    {selectedHistory.observations && (
                      <div>
                        <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider mb-3">Nurse Observations</h3>
                        <div className="p-4 bg-white border border-slate-200 rounded-xl">
                          <p className="text-slate-800 whitespace-pre-wrap">{selectedHistory.observations}</p>
                          {selectedHistory.observations_snomed && selectedHistory.observations_snomed.length > 0 && (
                            <div className="mt-2 flex flex-wrap gap-2">
                              {selectedHistory.observations_snomed.map((o: any, idx: number) => (
                                <span key={idx} className="px-2 py-1 bg-slate-100 text-slate-600 rounded text-xs border border-slate-200">
                                  {o.term}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
                
                {selectedHistory.cdssInsights && (
                   <div className="mt-6 pt-6 border-t border-slate-100">
                     <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider mb-3 flex items-center gap-2">
                       <Brain className="w-4 h-4 text-purple-600" />
                       CDSS Insights (Archived)
                     </h3>
                     <div className="p-4 bg-purple-50/50 border border-purple-100 rounded-xl text-sm text-slate-700">
                        {/* Render simple view of archived CDSS data */}
                        <pre className="whitespace-pre-wrap font-sans overflow-x-auto">{JSON.stringify(selectedHistory.cdssInsights, null, 2)}</pre>
                     </div>
                   </div>
                )}
              </div>
              
              <div className="p-4 border-t border-slate-100 bg-slate-50 flex justify-end">
                <button
                  onClick={() => setSelectedHistory(null)}
                  className="px-6 py-2 bg-slate-900 text-white rounded-lg hover:bg-slate-800 transition-colors font-medium"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </ModalPortal>
      )}

    </div>
  );
};

export default PatientAssessment;
