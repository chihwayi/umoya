import React, { useEffect, useState } from 'react';
import { FileText, X, Save, Calendar, Clock, User, Stethoscope, Brain, Activity, BookOpen, Search, CheckCircle, Sparkles, Plus, Trash2 } from 'lucide-react';
import ModalPortal from './ModalPortal';
import { useNotification } from './GlobalNotification';
import { ehrApi, cdssApi } from '../services/api';
import { formatDateToDDMMYYYY } from '../utils/dateFormatting';
import { ClinicalNotesWithSmartForms } from './ClinicalNotes/ClinicalNotesWithSmartForms';
import SnomedConceptPicker, { SnomedConcept } from './SnomedConceptPicker';

interface Appointment {
  id: string;
  patient: { 
    id: string; 
    firstName: string; 
    lastName: string; 
    patientNumber: string;
    dateOfBirth?: string;
    gender?: string;
  };
  appointmentDate: string;
  appointmentType: string;
  notes: string;
}

interface ClinicalNotesModalProps {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  appointment: Appointment;
  tenantSlug: string;
  token: string;
  searchContext?: string;
}

const ClinicalNotesModal: React.FC<ClinicalNotesModalProps> = ({ open, onClose, onSaved, appointment, tenantSlug, token, searchContext }) => {
  const { showSuccess, showError } = useNotification();
  const [loading, setLoading] = useState(false);
  const [chiefComplaint, setChiefComplaint] = useState('');
  const [historyOfPresentIllness, setHistoryOfPresentIllness] = useState('');
  const [physicalExam, setPhysicalExam] = useState('');
  const [assessment, setAssessment] = useState('');
  const [additionalNotes, setAdditionalNotes] = useState('');
  const [diagnosisSuggestions, setDiagnosisSuggestions] = useState<any>(null);
  const [loadingDiagnosis, setLoadingDiagnosis] = useState(false);
  const [clinicalGuidelines, setClinicalGuidelines] = useState<any>(null);
  const [loadingGuidelines, setLoadingGuidelines] = useState(false);
  const [showSmartForms, setShowSmartForms] = useState(false);
  const [guidelineQuery, setGuidelineQuery] = useState('');
  const [guidelineResults, setGuidelineResults] = useState<any[]>([]);
  const [loadingGuidelineSearch, setLoadingGuidelineSearch] = useState(false);
  const [showGuidelineSearch, setShowGuidelineSearch] = useState(false);
  const [codedDiagnoses, setCodedDiagnoses] = useState<SnomedConcept[]>([]);

  const handleGuidelineSearch = async () => {
    if (!guidelineQuery.trim()) return;
    setLoadingGuidelineSearch(true);
    try {
      if (!token || !tenantSlug) {
        showError('Session Expired', 'Please login again.');
        return;
      }
      
      // Use provided context or default to general clinical guidelines
      const context = searchContext || "Clinical guidelines, medical protocols";
      const finalQuery = `${context}: ${guidelineQuery}`;
      
      const response = await cdssApi.searchGuidelines(finalQuery, token, tenantSlug);
      if (response.data && response.data.citations) {
        setGuidelineResults(response.data.citations);
      } else {
        setGuidelineResults([]);
      }
    } catch (e) {
      console.error('Guideline search failed:', e);
      showError('Error', 'Failed to search guidelines');
    } finally {
      setLoadingGuidelineSearch(false);
    }
  };

  useEffect(() => {
    if (!open) return;
    try {
      if (appointment.notes) {
        try {
          const parsed = JSON.parse(appointment.notes);
          const cd = parsed?.clinicalDocumentation || {};
          setChiefComplaint(cd.chiefComplaint || '');
          setHistoryOfPresentIllness(cd.historyOfPresentIllness || '');
          setPhysicalExam(cd.physicalExamination || '');
          setAssessment(cd.clinicalAssessment || '');
          setAdditionalNotes(cd.additionalNotes || parsed?.notes || '');
          setCodedDiagnoses(cd.codedDiagnoses || []);
        } catch {
          setAdditionalNotes(appointment.notes || '');
          setCodedDiagnoses([]);
        }
      } else {
        setChiefComplaint('');
        setHistoryOfPresentIllness('');
        setPhysicalExam('');
        setAssessment('');
        setAdditionalNotes('');
        setCodedDiagnoses([]);
      }
    } catch (e) {
      // ignore load errors
    }
  }, [open, appointment.id]);

  const handleSave = async () => {
    try {
      setLoading(true);
      let payload: any = {};
      try {
        payload = appointment.notes ? JSON.parse(appointment.notes) : {};
      } catch {
        payload = {};
      }
      payload.notes = additionalNotes;
      payload.clinicalDocumentation = {
        chiefComplaint,
        historyOfPresentIllness,
        physicalExamination: physicalExam,
        clinicalAssessment: assessment,
        additionalNotes,
      };

      await ehrApi.updateAppointment(appointment.id, { notes: JSON.stringify(payload) }, token, tenantSlug);
      showSuccess('Saved', 'Clinical notes saved');
      onSaved();
    } catch (error: any) {
      const raw = error?.response?.data;
      const msg = (raw && (raw.message || raw.error || raw.errors)) ? (raw.message || raw.error || raw.errors) : raw;
      const text = typeof msg === 'string' ? msg : JSON.stringify(msg || 'Failed to save clinical notes');
      showError('Error', text);
    } finally {
      setLoading(false);
    }
  };

  if (!open) return null;

  return (
    <ModalPortal>
      <div className="fixed inset-0 bg-black/60 backdrop-blur-md flex items-center justify-center z-[100000] p-4 animate-in fade-in duration-300">
        <div className="glass-modal rounded-3xl shadow-2xl w-full max-w-5xl max-h-[95vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-300">
          <div className="sticky top-0 glass-gradient border-b border-white/20 px-8 py-6 rounded-t-3xl z-10">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl shadow-lg">
                  <FileText className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h3 className="text-2xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">Clinical Notes</h3>
                  <div className="flex items-center gap-4 text-sm text-slate-600 mt-2">
                    <div className="flex items-center gap-2 glass-section px-3 py-1 rounded-lg"><User className="w-4 h-4" /><span className="font-medium">{appointment.patient.firstName} {appointment.patient.lastName}</span></div>
                    <div className="flex items-center gap-2 glass-section px-3 py-1 rounded-lg"><Calendar className="w-4 h-4" /><span className="font-medium">{formatDateToDDMMYYYY(appointment.appointmentDate)}</span></div>
                    <div className="flex items-center gap-2 glass-section px-3 py-1 rounded-lg"><Clock className="w-4 h-4" /><span className="font-medium">{new Date(appointment.appointmentDate).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span></div>
                  </div>
                </div>
              </div>
              <button onClick={onClose} className="glass-button-secondary p-3 rounded-xl transition-all hover:scale-110"><X className="w-5 h-5 text-slate-600" /></button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-8 space-y-6 scrollbar-hide">
            {/* WHO Smart Forms Integration */}
            {!showSmartForms && (
              <div className="glass-gradient rounded-xl p-6 border border-indigo-200/50">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="p-2 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-lg">
                      <Activity className="w-5 h-5 text-white" />
                    </div>
                    <div>
                      <h4 className="font-bold text-slate-900 text-lg">Use WHO Smart Forms</h4>
                      <p className="text-sm text-slate-600 mt-1">Standardized clinical documentation forms</p>
                    </div>
                  </div>
                  <button
                    onClick={() => setShowSmartForms(true)}
                    className="glass-button px-6 py-3 text-white rounded-xl text-sm font-semibold shadow-lg"
                  >
                    Use WHO Forms
                  </button>
                </div>
              </div>
            )}

            {showSmartForms && (
              <div className="glass-card rounded-xl p-6 border border-indigo-200/50">
                <div className="flex items-center justify-between mb-4">
                  <h4 className="font-semibold text-slate-900">WHO Smart Forms</h4>
                  <button
                    onClick={() => setShowSmartForms(false)}
                    className="text-sm text-slate-600 hover:text-slate-900"
                  >
                    ← Use Standard Form
                  </button>
                </div>
                <ClinicalNotesWithSmartForms
                  patientId={appointment.patient.id}
                  patientName={`${appointment.patient.firstName} ${appointment.patient.lastName}`}
                  appointmentId={appointment.id}
                  tenantSlug={tenantSlug}
                  token={token}
                  onSuccess={() => {
                    onSaved();
                    onClose();
                  }}
                  onClose={() => setShowSmartForms(false)}
                />
              </div>
            )}

            {!showSmartForms && (
              <>
            <div className="glass-section rounded-xl p-6">
              <div className="flex items-center justify-between mb-4">
                <label className="block text-base font-bold text-slate-800">Chief Complaint</label>
                {chiefComplaint && chiefComplaint.length > 10 && (
                  <button
                    onClick={async () => {
                      setLoadingDiagnosis(true);
                      try {
                        const patientAge = appointment.patient.dateOfBirth
                          ? Math.floor((new Date().getTime() - new Date(appointment.patient.dateOfBirth).getTime()) / (1000 * 60 * 60 * 24 * 365.25))
                          : undefined;
                        
                        const result = await ehrApi.getDiagnosisSuggestions({
                          symptoms: [chiefComplaint, historyOfPresentIllness].filter(Boolean),
                          age: patientAge,
                          gender: appointment.patient.gender,
                        }, token, tenantSlug);
                        
                        const suggestionsData = result.data || result;
                        if (suggestionsData.suggested_diagnoses && suggestionsData.suggested_diagnoses.length > 0) {
                          setDiagnosisSuggestions(suggestionsData);
                        } else if (suggestionsData.differentialDiagnoses && suggestionsData.differentialDiagnoses.length > 0) {
                          setDiagnosisSuggestions({
                            suggested_diagnoses: suggestionsData.differentialDiagnoses.map((d: any) => ({
                              diagnosis: d.condition || d.diagnosis || 'Unknown',
                              probability: d.probability || 0.5,
                              confidence: d.confidence || 'moderate',
                              matching_symptoms: d.matching_symptoms || []
                            }))
                          });
                        }
                      } catch (error) {
                        console.error('Failed to get diagnosis suggestions:', error);
                        showError('Error', 'Failed to get diagnostic suggestions');
                      } finally {
                        setLoadingDiagnosis(false);
                      }
                    }}
                    disabled={loadingDiagnosis}
                    className="px-3 py-1 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-xs font-medium disabled:opacity-50 flex items-center gap-1"
                  >
                    <Brain className="w-3 h-3" />
                    {loadingDiagnosis ? 'Analyzing...' : 'Diagnostic Assistant'}
                  </button>
                )}
              </div>
              <textarea 
                value={chiefComplaint} 
                onChange={(e) => {
                  setChiefComplaint(e.target.value);
                  setDiagnosisSuggestions(null);
                }} 
                rows={3} 
                className="glass-input w-full rounded-xl px-4 py-3 text-slate-800 placeholder:text-slate-400 resize-none mt-2" 
                placeholder="Patient's main concern or reason for visit..."
              />
              {diagnosisSuggestions && diagnosisSuggestions.suggested_diagnoses && diagnosisSuggestions.suggested_diagnoses.length > 0 && (
                <div className="mt-3 p-4 bg-blue-50 rounded-xl border border-blue-200">
                  <h4 className="font-semibold text-blue-900 mb-3 flex items-center gap-2 text-sm">
                    <Stethoscope className="w-4 h-4" />
                    Differential Diagnosis Suggestions
                  </h4>
                  <div className="space-y-2">
                    {diagnosisSuggestions.suggested_diagnoses.slice(0, 5).map((diag: any, idx: number) => (
                      <div key={idx} className="bg-white rounded-lg p-3 border border-blue-200">
                        <div className="flex items-center justify-between">
                          <span className="font-medium text-slate-900 text-sm">{diag.diagnosis || diag.condition || 'Unknown'}</span>
                          <span className={`text-xs px-2 py-1 rounded-full ${
                            diag.confidence === 'high' ? 'bg-green-100 text-green-700' :
                            diag.confidence === 'moderate' ? 'bg-yellow-100 text-yellow-700' :
                            'bg-gray-100 text-gray-700'
                          }`}>
                            {((diag.probability || 0) * 100).toFixed(0)}% confidence
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
            <div className="glass-section rounded-xl p-6">
              <label className="block text-base font-bold text-slate-800 mb-3">History of Present Illness</label>
              <textarea value={historyOfPresentIllness} onChange={(e) => setHistoryOfPresentIllness(e.target.value)} rows={4} className="glass-input w-full rounded-xl px-4 py-3 text-slate-800 placeholder:text-slate-400 resize-none" />
            </div>
            <div className="glass-section rounded-xl p-6">
              <label className="block text-base font-bold text-slate-800 mb-3">Physical Examination</label>
              <textarea value={physicalExam} onChange={(e) => setPhysicalExam(e.target.value)} rows={4} className="glass-input w-full rounded-xl px-4 py-3 text-slate-800 placeholder:text-slate-400 resize-none" />
            </div>
            <div className="glass-section rounded-xl p-6">
              <div className="flex items-center justify-between mb-3">
                <label className="block text-base font-bold text-slate-800">Clinical Assessment / Diagnosis</label>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setShowGuidelineSearch(!showGuidelineSearch)}
                    className={`px-3 py-1.5 rounded-lg transition-colors text-xs font-medium flex items-center gap-1 ${
                      showGuidelineSearch 
                        ? 'bg-indigo-100 text-indigo-700' 
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    <Search className="w-3 h-3" />
                    {showGuidelineSearch ? 'Hide Search' : 'Search Guidelines'}
                  </button>
                  {assessment && assessment.length > 3 && (
                    <button
                      onClick={async () => {
                        setLoadingGuidelines(true);
                        try {
                          const patientAge = appointment.patient.dateOfBirth
                            ? Math.floor((new Date().getTime() - new Date(appointment.patient.dateOfBirth).getTime()) / (1000 * 60 * 60 * 24 * 365.25))
                            : undefined;
                          
                          const result = await ehrApi.getClinicalGuidelines(
                            assessment,
                            {
                              age: patientAge,
                              gender: appointment.patient.gender,
                            },
                            token,
                            tenantSlug
                          );
                          setClinicalGuidelines(result.data);
                        } catch (error) {
                          console.error('Failed to fetch guidelines:', error);
                          showError('Error', 'Failed to fetch clinical guidelines');
                        } finally {
                          setLoadingGuidelines(false);
                        }
                      }}
                      disabled={loadingGuidelines}
                      className="px-3 py-1.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors text-xs font-medium disabled:opacity-50 flex items-center gap-1"
                    >
                      <FileText className="w-3 h-3" />
                      {loadingGuidelines ? 'Loading...' : 'Get Guidelines'}
                    </button>
                  )}
                </div>
              </div>

              {/* SNOMED CT Coded Diagnoses */}
              <div className="mb-4 space-y-3">
                <label className="text-sm font-semibold text-slate-600">Structured Diagnoses (SNOMED CT)</label>
                <div className="space-y-2">
                  {codedDiagnoses.map((concept, idx) => (
                    <div key={concept.conceptId} className="flex items-center justify-between bg-white p-3 rounded-xl border border-slate-200 shadow-sm">
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-indigo-100 rounded-lg text-indigo-600">
                          <Activity className="w-4 h-4" />
                        </div>
                        <div>
                          <p className="font-medium text-slate-900">{concept.preferredTerm || concept.term}</p>
                          <p className="text-xs text-slate-500">SNOMED ID: {concept.conceptId}</p>
                        </div>
                      </div>
                      <button
                        onClick={() => {
                          const newDiagnoses = [...codedDiagnoses];
                          newDiagnoses.splice(idx, 1);
                          setCodedDiagnoses(newDiagnoses);
                        }}
                        className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                  
                  <div className="bg-slate-50/50 p-1 rounded-xl border border-dashed border-slate-300">
                    <SnomedConceptPicker
                      value={null}
                      onChange={(concept) => {
                        if (concept) {
                          // Prevent duplicates
                          if (!codedDiagnoses.some(d => d.conceptId === concept.conceptId)) {
                            const newDiagnoses = [...codedDiagnoses, concept];
                            setCodedDiagnoses(newDiagnoses);
                            
                            // Auto-append to assessment text if empty or not containing the term
                            if (!assessment.includes(concept.term)) {
                              setAssessment(prev => prev ? `${prev}\nDiagnosis: ${concept.term}` : `Diagnosis: ${concept.term}`);
                            }
                          }
                        }
                      }}
                      token={token}
                      tenantSlug={tenantSlug}
                      placeholder="Add Diagnosis (Search SNOMED CT)..."
                      context="finding" // or condition
                    />
                  </div>
                </div>
              </div>
              
              {showGuidelineSearch && (
                <div className="mb-4 p-4 bg-slate-50 rounded-xl border border-slate-200 animate-in slide-in-from-top-2">
                  <div className="flex gap-2 mb-3">
                    <div className="relative flex-1">
                      <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
                      <input
                        type="text"
                        value={guidelineQuery}
                        onChange={(e) => setGuidelineQuery(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleGuidelineSearch()}
                        placeholder="Search for clinical guidelines (e.g., 'Sepsis protocol')"
                        className="w-full pl-9 pr-4 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                      />
                    </div>
                    <button
                      onClick={handleGuidelineSearch}
                      disabled={loadingGuidelineSearch || !guidelineQuery.trim()}
                      className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 flex items-center gap-2"
                    >
                      {loadingGuidelineSearch ? <div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : 'Search'}
                    </button>
                  </div>

                  {guidelineResults.length > 0 && (
                    <div className="space-y-3 max-h-60 overflow-y-auto pr-1 custom-scrollbar">
                      {guidelineResults.map((result, idx) => (
                        <div key={idx} className="bg-white p-3 rounded-lg border border-slate-200 shadow-sm text-sm">
                           <div className="flex items-start gap-2">
                            <BookOpen className="w-4 h-4 text-indigo-600 mt-0.5 flex-shrink-0" />
                            <div className="flex-1">
                              <div className="flex items-center justify-between mb-1">
                                <span className="font-semibold text-slate-700">{result.source || 'Clinical Guideline'}</span>
                                {result.confidence && (
                                  <span className={`text-xs font-medium px-2 py-0.5 rounded-full border ${
                                    result.confidence > 0.8 ? 'bg-green-50 text-green-700 border-green-100' :
                                    result.confidence > 0.5 ? 'bg-yellow-50 text-yellow-700 border-yellow-100' :
                                    'bg-red-50 text-red-700 border-red-100'
                                  }`}>
                                    {Math.round(result.confidence * 100)}%
                                  </span>
                                )}
                              </div>
                              <p className="text-slate-800 mb-1">
                                {result.text}
                              </p>
                              {result.recommendation && (
                                <div className="mt-2 p-2 bg-indigo-50 border border-indigo-100 rounded text-xs text-indigo-800">
                                  <strong>Recommendation:</strong> {result.recommendation}
                                </div>
                              )}
                              {result.url && (
                                <a 
                                  href={result.url} 
                                  target="_blank" 
                                  rel="noopener noreferrer"
                                  className="text-xs text-indigo-600 hover:underline mt-1 inline-block"
                                >
                                  View Source
                                </a>
                              )}
                            </div>
                           </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
              <textarea 
                value={assessment} 
                onChange={(e) => {
                  setAssessment(e.target.value);
                  setClinicalGuidelines(null);
                }} 
                rows={3} 
                className="glass-input w-full rounded-xl px-4 py-3 text-slate-800 placeholder:text-slate-400 resize-none mt-2"
                placeholder="Enter diagnosis or clinical assessment..."
              />
              {clinicalGuidelines && (
                <div className="mt-3 p-4 bg-indigo-50 rounded-xl border border-indigo-200">
                  <h4 className="font-semibold text-indigo-900 mb-2 flex items-center gap-2 text-sm">
                    <FileText className="w-4 h-4" />
                    Clinical Guidelines ({clinicalGuidelines.evidence_level || 'standard'} evidence)
                  </h4>
                  <div className="space-y-2 mt-2">
                    <p className="text-sm font-medium text-slate-900">Recommendations:</p>
                    <ul className="space-y-1 text-sm text-slate-700">
                      {clinicalGuidelines.recommendations?.slice(0, 5).map((rec: string, idx: number) => (
                        <li key={idx} className="flex items-start gap-2">
                          <span className="text-indigo-600 mt-1">•</span>
                          <span>{rec}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              )}
            </div>
            <div className="glass-section rounded-xl p-6">
              <label className="block text-base font-bold text-slate-800 mb-3">Additional Notes</label>
              <textarea value={additionalNotes} onChange={(e) => setAdditionalNotes(e.target.value)} rows={4} className="glass-input w-full rounded-xl px-4 py-3 text-slate-800 placeholder:text-slate-400 resize-none" />
            </div>
            </>
            )}
          </div>

          <div className="sticky bottom-0 glass-gradient border-t border-white/20 px-8 py-5 rounded-b-3xl">
            <div className="flex gap-4">
              <button onClick={onClose} className="glass-button-secondary flex-1 px-6 py-3 text-slate-700 rounded-xl font-semibold">Cancel</button>
              <button onClick={handleSave} disabled={loading} className="glass-button flex-1 px-6 py-3 text-white rounded-xl font-semibold shadow-lg disabled:opacity-50 flex items-center justify-center gap-2">
                <Save className="w-5 h-5" />
                {loading ? 'Saving...' : 'Save Clinical Notes'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </ModalPortal>
  );
};

export default ClinicalNotesModal;


