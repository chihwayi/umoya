import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  FileText, Save, X, Plus, Search, Filter, Clock, User,
  AlertTriangle, CheckCircle, Activity, Heart, Stethoscope, Eye, Brain, FileCode, BookOpen
} from 'lucide-react';
import { ehrApi, clinicalTemplateApi } from '../services/api';
import { useNotification } from '../components/GlobalNotification';
import { formatDateTimeToDDMMYYYYHHMM } from '../utils/dateFormatting';
import SnomedConceptPicker, { SnomedConcept } from './SnomedConceptPicker';
import { AiOutputWrapper } from './AiOutputWrapper';
import ClinicalTemplateLibrary from './ClinicalTemplateLibrary';
import { GuidelineSearchPanel } from './GuidelineSearchPanel';

interface Patient {
  id: string;
  patientNumber: string;
  firstName: string;
  lastName: string;
  dateOfBirth: string;
  gender: string;
}

interface NursingNote {
  id: string;
  patientId: string;
  noteType: string;
  content: string;
  vitalSigns?: string;
  medications?: string;
  observations: string;
  interventions: string;
  outcomes: string;
  recordedAt: string;
  recordedBy: string;
  recordedByName: string;
}

interface NursingNotesProps {
  patient?: Patient;
  appointments?: any[];
  onClose?: () => void;
  onSave?: () => void;
  preset?: 'care_plans' | 'medications';
  copilotDraft?: string;
  copilotProvenance?: string[];
  copilotDraftPatientId?: string;
}

const NursingNotes: React.FC<NursingNotesProps> = ({
  patient,
  appointments = [],
  onClose,
  onSave,
  preset,
  copilotDraft,
  copilotProvenance = [],
  copilotDraftPatientId,
}) => {
  const { showSuccess, showError } = useNotification();
  const navigate = useNavigate();
  const { tenantSlug } = useParams<{ tenantSlug: string }>();
  const [notes, setNotes] = useState<NursingNote[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState('all');
  const [showNewNote, setShowNewNote] = useState(false);
  const [showGuidelineSearch, setShowGuidelineSearch] = useState(false);

  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(patient || null);
  const [allNotes, setAllNotes] = useState<NursingNote[]>([]);
  const [patientSearchTerm, setPatientSearchTerm] = useState('');
  const [showPatientDropdown, setShowPatientDropdown] = useState(false);
  const [filteredPatients, setFilteredPatients] = useState<Patient[]>([]);

  const [newNote, setNewNote] = useState({
    noteType: 'general',
    content: '',
    vitalSigns: '',
    medications: '',
    observations: '',
    interventions: '',
    outcomes: '',
    patientId: ''
  });
  const [observationsConcepts, setObservationsConcepts] = useState<SnomedConcept[]>([]);
  const [pendingObservationConcept, setPendingObservationConcept] = useState<SnomedConcept | null>(null);
  const [interventionsConcepts, setInterventionsConcepts] = useState<SnomedConcept[]>([]);
  const [pendingInterventionConcept, setPendingInterventionConcept] = useState<SnomedConcept | null>(null);
  const [outcomesConcepts, setOutcomesConcepts] = useState<SnomedConcept[]>([]);
  const [pendingOutcomeConcept, setPendingOutcomeConcept] = useState<SnomedConcept | null>(null);
  const [cdssInsights, setCdssInsights] = useState<any | null>(null);
  const [showTemplateLibrary, setShowTemplateLibrary] = useState(false);
  const [lastAppliedCopilotDraft, setLastAppliedCopilotDraft] = useState('');

  // Apply preset behaviors
  useEffect(() => {
    if (!preset) return;
    if (preset === 'medications') {
      setShowNewNote(true);
      setNewNote(prev => ({ ...prev, noteType: 'intervention' }));
    }
    if (preset === 'care_plans') {
      setShowNewNote(true);
      setNewNote(prev => ({ ...prev, noteType: 'evaluation' }));
    }
  }, [preset]);

  useEffect(() => {
    if (selectedPatient) {
      fetchNursingNotes();
    } else {
      // If no specific patient, fetch all recent notes
      fetchAllNotes();
    }
  }, [selectedPatient]);

  useEffect(() => {
    setCdssInsights(null);
  }, [selectedPatient?.id]);

  useEffect(() => {
    if (!copilotDraft || !copilotDraft.trim()) {
      return;
    }

    if (copilotDraftPatientId && selectedPatient?.id && selectedPatient.id !== copilotDraftPatientId) {
      return;
    }

    const draftKey = `${copilotDraftPatientId || 'any'}:${copilotDraft}`;
    if (lastAppliedCopilotDraft === draftKey) {
      return;
    }

    setShowNewNote(true);
    setNewNote((prev) => ({
      ...prev,
      patientId: prev.patientId || selectedPatient?.id || copilotDraftPatientId || '',
      content:
        prev.content.trim().length > 0
          ? `${prev.content}\n\n---\nAI Draft Suggestion:\n${copilotDraft}`
          : copilotDraft,
    }));
    setLastAppliedCopilotDraft(draftKey);
  }, [copilotDraft, copilotDraftPatientId, selectedPatient?.id, lastAppliedCopilotDraft]);

  // Filter patients based on search term
  useEffect(() => {
    if (patientSearchTerm.trim() === '') {
      setFilteredPatients(appointments.map(apt => apt.patient));
    } else {
      const filtered = appointments
        .map(apt => apt.patient)
        .filter(patient =>
          `${patient.firstName} ${patient.lastName}`.toLowerCase().includes(patientSearchTerm.toLowerCase()) ||
          patient.patientNumber.toLowerCase().includes(patientSearchTerm.toLowerCase())
        );
      setFilteredPatients(filtered);
    }
  }, [patientSearchTerm, appointments]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (showPatientDropdown) {
        setShowPatientDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showPatientDropdown]);

  const fetchAllNotes = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('ehr_token');
      const tenantSlug = localStorage.getItem('ehr_tenant_slug');
      
      if (!token || !tenantSlug) return;

      // Fetch notes for all patients with appointments today
      const allNotesPromises = appointments.map(async (apt) => {
        try {
          const response = await ehrApi.getNursingNotes(apt.patient.id, token, tenantSlug);
          return response.data.nursingNotes || [];
        } catch {
          return [];
        }
      });

      const allNotesResults = await Promise.all(allNotesPromises);
      const flattenedNotes = allNotesResults.flat();
      
      // Sort by most recent first
      const sortedNotes = flattenedNotes.sort((a, b) => 
        new Date(b.recordedAt).getTime() - new Date(a.recordedAt).getTime()
      );
      
      setAllNotes(sortedNotes);
    } catch {
      showError('Error', 'Failed to load notes');
    } finally {
      setLoading(false);
    }
  };

  const fetchNursingNotes = async () => {
    if (!selectedPatient) return;
    
    try {
      setLoading(true);
      const token = localStorage.getItem('ehr_token');
      const tenantSlug = localStorage.getItem('ehr_tenant_slug');
      
      if (!token || !tenantSlug) return;

      const response = await ehrApi.getNursingNotes(selectedPatient.id, token, tenantSlug);
      setNotes(response.data.notes || []);
    } catch {
      showError('Error', 'Failed to fetch nursing notes');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveNote = async () => {
    const patientId = selectedPatient?.id || newNote.patientId;
    
    if (!patientId) {
      showError('Error', 'No patient selected');
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

      const noteData = {
        patientId: patientId,
        noteType: newNote.noteType,
        content: newNote.content,
        vitalSigns: newNote.vitalSigns,
        medications: newNote.medications,
        observations: newNote.observations,
        observations_snomed: observationsConcepts,
        interventions: newNote.interventions,
        interventions_snomed: interventionsConcepts,
        outcomes: newNote.outcomes,
        outcomes_snomed: outcomesConcepts,
        recordedAt: new Date().toISOString(),
        recordedBy: JSON.parse(localStorage.getItem('ehr_user') || '{}').id
      };

      const response = await ehrApi.recordNursingNote(noteData, token, tenantSlug);
      const insights = response.data?.cdssInsights ?? response.data?.cdss_insights ?? null;
      showSuccess('Success', 'Nursing note saved successfully');
      setCdssInsights(insights);
      setShowNewNote(false);
      setNewNote({
        noteType: 'general',
        content: '',
        vitalSigns: '',
        medications: '',
        observations: '',
        interventions: '',
        outcomes: '',
        patientId: ''
      });
      setObservationsConcepts([]);
      setPendingObservationConcept(null);
      setInterventionsConcepts([]);
      setPendingInterventionConcept(null);
      setOutcomesConcepts([]);
      setPendingOutcomeConcept(null);
      
      // Refresh notes based on current view
      if (selectedPatient) {
        fetchNursingNotes();
      } else {
        fetchAllNotes();
      }
      onSave?.();
    } catch {
      showError('Error', 'Failed to save nursing note');
    } finally {
      setLoading(false);
    }
  };

  const getNoteTypeColor = (type: string) => {
    switch (type) {
      case 'assessment': return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'intervention': return 'bg-green-100 text-green-800 border-green-200';
      case 'evaluation': return 'bg-purple-100 text-purple-800 border-purple-200';
      case 'general': return 'bg-gray-100 text-gray-800 border-gray-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getNoteTypeIcon = (type: string) => {
    switch (type) {
      case 'assessment': return <Stethoscope className="w-4 h-4" />;
      case 'intervention': return <Activity className="w-4 h-4" />;
      case 'evaluation': return <CheckCircle className="w-4 h-4" />;
      default: return <FileText className="w-4 h-4" />;
    }
  };

  const filteredNotes = notes.filter(note => {
    const matchesSearch = note.content.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         note.observations.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         note.interventions.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesType = filterType === 'all' || note.noteType === filterType;
    return matchesSearch && matchesType;
  });

  const renderContent = () => {
    if (selectedPatient) {
      // Single patient nursing notes
      return (
        <div className="space-y-6">
          {/* Patient Header */}
          <div className="w-full bg-gradient-to-r from-pink-50 to-rose-50 rounded-lg sm:rounded-xl p-3 sm:p-4 lg:p-6 border border-pink-200/50">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-4">
              <div className="flex items-center gap-3 sm:gap-4 min-w-0 flex-1">
                <div className="w-12 h-12 sm:w-14 sm:h-14 lg:w-16 lg:h-16 bg-gradient-to-br from-pink-500 to-rose-600 rounded-lg sm:rounded-xl flex items-center justify-center text-white font-bold text-base sm:text-lg lg:text-xl flex-shrink-0">
                  {selectedPatient.firstName.charAt(0)}{selectedPatient.lastName.charAt(0)}
                </div>
                <div className="min-w-0">
                  <h3 className="text-base sm:text-lg lg:text-xl font-bold text-slate-900 truncate">
                    {selectedPatient.firstName} {selectedPatient.lastName}
                  </h3>
                  <p className="text-xs sm:text-sm text-slate-600 truncate">ID: {selectedPatient.patientNumber}</p>
                </div>
              </div>
              <div className="flex items-center gap-2 sm:gap-3 w-full sm:w-auto">
                <button
                  onClick={() => navigate(`/ehr/${tenantSlug}/nurse/patients/${selectedPatient.id}`)}
                  className="flex-1 sm:flex-none flex items-center justify-center gap-1 sm:gap-2 px-2 sm:px-3 lg:px-4 py-2 bg-gradient-to-r from-purple-500 to-indigo-600 text-white rounded-lg hover:from-purple-600 hover:to-indigo-700 transition-all duration-200 font-semibold text-xs sm:text-sm"
                >
                  <Eye className="w-3 h-3 sm:w-4 sm:h-4" />
                  <span className="hidden sm:inline">View Patient Summary</span>
                  <span className="sm:hidden">View</span>
                </button>
                <button
                  onClick={() => setSelectedPatient(null)}
                  className="flex-1 sm:flex-none flex items-center justify-center gap-1 sm:gap-2 px-2 sm:px-3 lg:px-4 py-2 bg-white rounded-lg border border-slate-200 hover:border-pink-300 hover:shadow-md transition-all duration-200 text-xs sm:text-sm"
                >
                  <X className="w-3 h-3 sm:w-4 sm:h-4" />
                  <span className="hidden sm:inline">Back to All Patients</span>
                  <span className="sm:hidden">Back</span>
                </button>
              </div>
            </div>
          </div>

          {/* New Note Form */}
          {showNewNote && (
            <div className="w-full bg-gradient-to-br from-white to-slate-50 rounded-lg sm:rounded-xl lg:rounded-2xl shadow-lg border border-slate-200/50 p-3 sm:p-5 lg:p-8">
              <div className="flex items-center gap-3 mb-6">
                <div className="p-2 bg-gradient-to-r from-pink-500 to-rose-600 rounded-xl">
                  <Plus className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h4 className="text-lg font-bold text-slate-900">
                    {newNote.noteType === 'general' ? 'Quick Note' : 'Comprehensive Clinical Note'}
                  </h4>
                  <p className="text-sm text-slate-600">
                    {newNote.noteType === 'general' 
                      ? `Simple note for ${selectedPatient?.firstName} ${selectedPatient?.lastName}` 
                      : `Detailed documentation for ${selectedPatient?.firstName} ${selectedPatient?.lastName}`
                    }
                  </p>
                </div>
              </div>
              {copilotDraft && (
                <div className="mb-6 rounded-xl border border-emerald-200 bg-emerald-50/80 p-3">
                  <p className="text-xs font-semibold text-emerald-900 mb-2">AI Draft Bound To Editor</p>
                  <div className="flex flex-wrap gap-2">
                    <span className="inline-flex items-center px-2 py-1 rounded-full text-[11px] font-semibold bg-white border border-emerald-200 text-emerald-800">
                      Source: CDSS Notes Draft
                    </span>
                    {copilotProvenance.slice(0, 3).map((item, idx) => (
                      <span
                        key={`copilot-prov-${idx}`}
                        className="inline-flex items-center px-2 py-1 rounded-full text-[11px] font-semibold bg-white border border-emerald-200 text-emerald-800"
                      >
                        {String(item)}
                      </span>
                    ))}
                  </div>
                </div>
              )}

            <div className="space-y-6">
              {/* AI Guidelines Search */}
              <div className="bg-indigo-50/50 rounded-xl border border-indigo-100 p-4">
                <button
                  onClick={() => setShowGuidelineSearch(!showGuidelineSearch)}
                  className="flex items-center gap-2 text-indigo-700 font-semibold text-sm mb-3 hover:text-indigo-800 transition-colors"
                >
                  <Brain className="w-4 h-4" />
                  AI Clinical Guidelines Support
                </button>

                {showGuidelineSearch && (
                  <div className="animate-in slide-in-from-top-2">
                    <GuidelineSearchPanel
                      searchFn={(q) => {
                        const token = localStorage.getItem('ehr_token');
                        const tenantSlug = localStorage.getItem('ehr_tenant_slug');
                        return ehrApi.searchGuidelines(q, token || '', tenantSlug || '');
                      }}
                      contextLabel="Nursing"
                      className=""
                    />
                  </div>
                )}
              </div>

                {newNote.noteType === 'general' ? (
                  // Simple form for quick notes
                  <>
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <label className="block text-sm font-semibold text-slate-700">Quick Note</label>
                        <button
                          type="button"
                          onClick={() => setShowTemplateLibrary(true)}
                          className="px-3 py-1.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors text-sm font-medium flex items-center gap-2"
                        >
                          <FileCode className="w-4 h-4" />
                          Templates
                        </button>
                      </div>
                      <textarea
                        value={newNote.content}
                        onChange={(e) => setNewNote(prev => ({ ...prev, content: e.target.value }))}
                        className="w-full max-w-full px-3 sm:px-4 py-2 sm:py-3 border border-slate-300 rounded-lg sm:rounded-xl focus:ring-2 focus:ring-pink-500 focus:border-transparent resize-none text-sm sm:text-base"
                        rows={6}
                        placeholder="Enter your quick observation note here..."
                      />
                    </div>
                  </>
                ) : (
                  // Comprehensive form for detailed notes
                  <>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div>
                        <label className="block text-sm font-semibold text-slate-700 mb-2">Note Type</label>
                        <select
                          value={newNote.noteType}
                          onChange={(e) => setNewNote(prev => ({ ...prev, noteType: e.target.value }))}
                          className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-pink-500 focus:border-transparent"
                        >
                          <option value="general">General</option>
                          <option value="assessment">Assessment</option>
                          <option value="intervention">Intervention</option>
                          <option value="evaluation">Evaluation</option>
                        </select>
                      </div>
                    </div>

                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <label className="block text-sm font-semibold text-slate-700">Note Content</label>
                        <button
                          type="button"
                          onClick={() => setShowTemplateLibrary(true)}
                          className="px-3 py-1.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors text-sm font-medium flex items-center gap-2"
                        >
                          <FileCode className="w-4 h-4" />
                          Templates
                        </button>
                      </div>
                      <textarea
                        value={newNote.content}
                        onChange={(e) => setNewNote(prev => ({ ...prev, content: e.target.value }))}
                        className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-pink-500 focus:border-transparent resize-none"
                        rows={4}
                        placeholder="Enter nursing note content..."
                      />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div>
                        <label className="block text-sm font-semibold text-slate-700 mb-2">Vital Signs</label>
                        <textarea
                          value={newNote.vitalSigns}
                          onChange={(e) => setNewNote(prev => ({ ...prev, vitalSigns: e.target.value }))}
                          className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-pink-500 focus:border-transparent resize-none"
                          rows={2}
                          placeholder="Record vital signs..."
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-semibold text-slate-700 mb-2">Medications</label>
                        <textarea
                          value={newNote.medications}
                          onChange={(e) => setNewNote(prev => ({ ...prev, medications: e.target.value }))}
                          className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-pink-500 focus:border-transparent resize-none"
                          rows={2}
                          placeholder={preset === 'medications' ? 'e.g., Paracetamol 1g PO q8h x5 days' : 'Record medications...'}
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-semibold text-slate-700 mb-2">Observations</label>
                      <textarea
                        value={newNote.observations}
                        onChange={(e) => setNewNote(prev => ({ ...prev, observations: e.target.value }))}
                        className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-pink-500 focus:border-transparent resize-none"
                        rows={3}
                        placeholder="Record patient observations..."
                      />
                      <div className="mt-2">
                        <SnomedConceptPicker
                          value={pendingObservationConcept}
                          onChange={setPendingObservationConcept}
                          token={localStorage.getItem('ehr_token') || ''}
                          tenantSlug={localStorage.getItem('ehr_tenant_slug') || ''}
                          label="SNOMED CT Observations (Optional)"
                          placeholder="Try: 'body temperature', 'blood pressure', 'heart rate', 'pain', 'wound', 'consciousness'..."
                          context="observable"
                          helperText="Search for specific observations. Examples: 'body temperature', 'blood pressure measurement', 'heart rate', 'respiratory rate', 'pain', 'wound', 'skin condition', 'consciousness level'."
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

                    <div>
                      <label className="block text-sm font-semibold text-slate-700 mb-2">Interventions</label>
                      <textarea
                        value={newNote.interventions}
                        onChange={(e) => setNewNote(prev => ({ ...prev, interventions: e.target.value }))}
                        className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-pink-500 focus:border-transparent resize-none"
                        rows={3}
                        placeholder="Record nursing interventions..."
                      />
                      <div className="mt-2">
                        <SnomedConceptPicker
                          value={pendingInterventionConcept}
                          onChange={setPendingInterventionConcept}
                          token={localStorage.getItem('ehr_token') || ''}
                          tenantSlug={localStorage.getItem('ehr_tenant_slug') || ''}
                          label="SNOMED CT Interventions (Optional)"
                          placeholder="Try: 'wound dressing', 'medication administration', 'patient education', 'monitoring'..."
                          context="procedure"
                          helperText="Search for specific interventions. Examples: 'wound dressing', 'medication administration', 'patient education', 'vital signs monitoring', 'positioning', 'catheter care'."
                        />
                        {pendingInterventionConcept && (
                          <button
                            type="button"
                            onClick={() => {
                              setInterventionsConcepts([...interventionsConcepts, pendingInterventionConcept]);
                              setPendingInterventionConcept(null);
                            }}
                            className="mt-2 px-3 py-1.5 bg-pink-600 text-white rounded-lg hover:bg-pink-700 transition-colors text-sm font-medium flex items-center gap-1"
                          >
                            <Plus className="w-3 h-3" />
                            Add Concept
                          </button>
                        )}
                        {interventionsConcepts.length > 0 && (
                          <div className="mt-2 space-y-1">
                            {interventionsConcepts.map((concept, idx) => (
                              <div key={idx} className="flex items-center justify-between bg-slate-50 px-3 py-2 rounded-lg">
                                <span className="text-sm text-slate-700">
                                  <span className="font-medium">{concept.term}</span>
                                  <span className="text-xs text-slate-500 ml-2">({concept.conceptId})</span>
                                </span>
                                <button
                                  type="button"
                                  onClick={() => setInterventionsConcepts(interventionsConcepts.filter((_, i) => i !== idx))}
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

                    <div>
                      <label className="block text-sm font-semibold text-slate-700 mb-2">Outcomes</label>
                      <textarea
                        value={newNote.outcomes}
                        onChange={(e) => setNewNote(prev => ({ ...prev, outcomes: e.target.value }))}
                        className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-pink-500 focus:border-transparent resize-none"
                        rows={3}
                        placeholder="Record patient outcomes..."
                      />
                      <div className="mt-2">
                        <SnomedConceptPicker
                          value={pendingOutcomeConcept}
                          onChange={setPendingOutcomeConcept}
                          token={localStorage.getItem('ehr_token') || ''}
                          tenantSlug={localStorage.getItem('ehr_tenant_slug') || ''}
                          label="SNOMED CT Outcomes (Optional)"
                          placeholder="Try: 'improved', 'stable', 'resolved', 'healing', 'recovery'..."
                          context="condition"
                          helperText="Search for patient outcomes. Examples: 'improved', 'stable condition', 'resolved', 'healing', 'recovery', 'deteriorated', 'no change'."
                        />
                        {pendingOutcomeConcept && (
                          <button
                            type="button"
                            onClick={() => {
                              setOutcomesConcepts([...outcomesConcepts, pendingOutcomeConcept]);
                              setPendingOutcomeConcept(null);
                            }}
                            className="mt-2 px-3 py-1.5 bg-pink-600 text-white rounded-lg hover:bg-pink-700 transition-colors text-sm font-medium flex items-center gap-1"
                          >
                            <Plus className="w-3 h-3" />
                            Add Concept
                          </button>
                        )}
                        {outcomesConcepts.length > 0 && (
                          <div className="mt-2 space-y-1">
                            {outcomesConcepts.map((concept, idx) => (
                              <div key={idx} className="flex items-center justify-between bg-slate-50 px-3 py-2 rounded-lg">
                                <span className="text-sm text-slate-700">
                                  <span className="font-medium">{concept.term}</span>
                                  <span className="text-xs text-slate-500 ml-2">({concept.conceptId})</span>
                                </span>
                                <button
                                  type="button"
                                  onClick={() => setOutcomesConcepts(outcomesConcepts.filter((_, i) => i !== idx))}
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
                  </>
                )}
              </div>

              <div className="flex items-center justify-end gap-4 pt-6 border-t border-slate-200 mt-6">
                <button
                  onClick={() => setShowNewNote(false)}
                  className="px-6 py-3 border border-slate-300 text-slate-700 rounded-xl hover:bg-slate-50 transition-all duration-200 font-semibold"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveNote}
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
                      Save Note
                    </>
                  )}
                </button>
              </div>
            </div>
          )}

          {/* Notes List */}
          <div className="space-y-4">
            {filteredNotes.map((note) => (
              <div key={note.id} className="w-full bg-gradient-to-r from-white to-slate-50 rounded-lg sm:rounded-xl p-3 sm:p-4 lg:p-6 border border-slate-200/50 hover:shadow-md transition-all duration-200">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-xl border ${getNoteTypeColor(note.noteType)}`}>
                      {getNoteTypeIcon(note.noteType)}
                    </div>
                    <div>
                      <h4 className="text-lg font-bold text-slate-900 capitalize">{note.noteType} Note</h4>
                      <p className="text-sm text-slate-600">
                        {formatDateTimeToDDMMYYYYHHMM(note.recordedAt)} • {note.recordedByName}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  {note.content && (
                    <div>
                      <h5 className="text-sm font-semibold text-slate-700 mb-2">Content</h5>
                      <p className="text-slate-600">{note.content}</p>
                    </div>
                  )}

                  {note.vitalSigns && (
                    <div>
                      <h5 className="text-sm font-semibold text-slate-700 mb-2">Vital Signs</h5>
                      <p className="text-slate-600">{note.vitalSigns}</p>
                    </div>
                  )}

                  {note.medications && (
                    <div>
                      <h5 className="text-sm font-semibold text-slate-700 mb-2">Medications</h5>
                      <p className="text-slate-600">{note.medications}</p>
                    </div>
                  )}

                  {note.observations && (
                    <div>
                      <h5 className="text-sm font-semibold text-slate-700 mb-2">Observations</h5>
                      <p className="text-slate-600">{note.observations}</p>
                    </div>
                  )}

                  {note.interventions && (
                    <div>
                      <h5 className="text-sm font-semibold text-slate-700 mb-2">Interventions</h5>
                      <p className="text-slate-600">{note.interventions}</p>
                    </div>
                  )}

                  {note.outcomes && (
                    <div>
                      <h5 className="text-sm font-semibold text-slate-700 mb-2">Outcomes</h5>
                      <p className="text-slate-600">{note.outcomes}</p>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>

          {!showNewNote && (
            <div className="flex justify-center">
              <button
                onClick={() => setShowNewNote(true)}
                className="px-6 py-3 bg-gradient-to-r from-pink-500 to-rose-600 text-white rounded-xl hover:from-pink-600 hover:to-rose-700 transition-all duration-200 font-semibold flex items-center gap-2"
              >
                <Plus className="w-4 h-4" />
                Add New Note
              </button>
            </div>
          )}
        </div>
      );
    } else {
      // Nursing notes overview for all patients
      return (
        <div className="space-y-6">
          <div className="bg-gradient-to-br from-white to-slate-50 rounded-2xl shadow-lg border border-slate-200/50 p-8">
            <div className="flex items-center gap-3 mb-6">
              <div className="p-2 bg-gradient-to-r from-pink-500 to-rose-600 rounded-xl">
                <FileText className="w-6 h-6 text-white" />
              </div>
              <h3 className="text-xl font-bold text-slate-900">Nursing Notes</h3>
            </div>
            
            <div className="space-y-6">
              {/* Today's Patients */}
              <div>
                <h4 className="text-lg font-semibold text-slate-900 mb-4">Today's Patients</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {appointments.map((apt) => (
                    <div 
                      key={apt.id}
                      className="bg-white rounded-xl p-4 border border-slate-200 hover:border-pink-300 hover:shadow-md transition-all duration-200 group"
                    >
                      <div className="flex items-center gap-3 mb-3">
                        <div className="w-10 h-10 bg-gradient-to-br from-pink-500 to-rose-600 rounded-lg flex items-center justify-center text-white font-semibold text-sm group-hover:scale-105 transition-transform">
                          {apt.patient.firstName.charAt(0)}{apt.patient.lastName.charAt(0)}
                        </div>
                        <div className="flex-1">
                          <h5 className="font-semibold text-slate-900 group-hover:text-pink-600 transition-colors">
                            {apt.patient.firstName} {apt.patient.lastName}
                          </h5>
                          <p className="text-sm text-slate-600">
                            {new Date(apt.appointmentDate).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </p>
                        </div>
                      </div>
                      
                      {/* Action Buttons */}
                      <div className="space-y-2">
                        <div className="flex gap-2">
                          <button
                            onClick={() => {
                              setSelectedPatient(apt.patient);
                              setShowNewNote(true);
                              setNewNote(prev => ({ 
                                ...prev, 
                                patientId: apt.patient.id,
                                noteType: 'general'
                              }));
                            }}
                            className="flex-1 px-3 py-2 bg-gradient-to-r from-pink-500 to-rose-600 text-white rounded-lg hover:from-pink-600 hover:to-rose-700 transition-all duration-200 text-sm font-semibold flex items-center justify-center gap-1"
                          >
                            <FileText className="w-4 h-4" />
                            Quick Note
                          </button>
                          <button
                            onClick={() => {
                              setSelectedPatient(apt.patient);
                              setShowNewNote(true);
                              setNewNote(prev => ({ 
                                ...prev, 
                                patientId: apt.patient.id,
                                noteType: 'assessment'
                              }));
                            }}
                            className="flex-1 px-3 py-2 bg-gradient-to-r from-blue-500 to-cyan-600 text-white rounded-lg hover:from-blue-600 hover:to-cyan-700 transition-all duration-200 text-sm font-semibold flex items-center justify-center gap-1"
                          >
                            <Stethoscope className="w-4 h-4" />
                            Comprehensive
                          </button>
                        </div>
                        <button
                          onClick={() => navigate(`/ehr/${tenantSlug}/nurse/patients/${apt.patient.id}`)}
                          className="w-full px-3 py-2 bg-gradient-to-r from-purple-500 to-indigo-600 text-white rounded-lg hover:from-purple-600 hover:to-indigo-700 transition-all duration-200 text-sm font-semibold flex items-center justify-center gap-1"
                        >
                          <Eye className="w-4 h-4" />
                          View Patient Summary
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Recent Notes */}
              {allNotes.length > 0 && (
                <div>
                  <h4 className="text-lg font-semibold text-slate-900 mb-4">Recent Nursing Notes</h4>
                  <div className="space-y-3">
                    {allNotes.slice(0, 5).map((note) => (
                      <div key={note.id} className="bg-white rounded-lg p-4 border border-slate-200">
                        <div className="flex items-start gap-3">
                          <div className="p-2 bg-slate-100 rounded-lg">
                            {getNoteTypeIcon(note.noteType)}
                          </div>
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="font-semibold text-slate-900">
                                Patient ID: {note.patientId}
                              </span>
                              <span className="text-xs bg-slate-100 text-slate-600 px-2 py-1 rounded-full">
                                {note.noteType}
                              </span>
                            </div>
                            <p className="text-sm text-slate-600 line-clamp-2">{note.content}</p>
                            <p className="text-xs text-slate-500 mt-2">
                              {formatDateTimeToDDMMYYYYHHMM(note.recordedAt)}
                            </p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Quick Actions */}
              <div className="bg-gradient-to-r from-pink-50 to-rose-50 rounded-xl p-6 border border-pink-200/50">
                <h4 className="text-lg font-semibold text-slate-900 mb-4">Quick Actions</h4>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <button
                    onClick={() => setShowNewNote(true)}
                    className="flex items-center gap-3 p-4 bg-white rounded-lg border border-slate-200 hover:border-pink-300 hover:shadow-md transition-all duration-200"
                  >
                    <div className="p-2 bg-pink-100 rounded-lg">
                      <Plus className="w-5 h-5 text-pink-600" />
                    </div>
                    <div className="text-left">
                      <h5 className="font-semibold text-slate-900">General Note</h5>
                      <p className="text-sm text-slate-600">Create a general note (select patient first)</p>
                    </div>
                  </button>
                  
                  <button
                    onClick={() => { setShowNewNote(true); setNewNote(prev => ({ ...prev, noteType: 'assessment' })); }}
                    className="flex items-center gap-3 p-4 bg-white rounded-lg border border-slate-200 hover:border-pink-300 hover:shadow-md transition-all duration-200"
                  >
                    <div className="p-2 bg-blue-100 rounded-lg">
                      <Stethoscope className="w-5 h-5 text-blue-600" />
                    </div>
                    <div className="text-left">
                      <h5 className="font-semibold text-slate-900">Assessment</h5>
                      <p className="text-sm text-slate-600">Record patient assessment (select patient first)</p>
                    </div>
                  </button>
                  
                  <button
                    onClick={() => { setShowNewNote(true); setNewNote(prev => ({ ...prev, noteType: 'intervention' })); }}
                    className="flex items-center gap-3 p-4 bg-white rounded-lg border border-slate-200 hover:border-pink-300 hover:shadow-md transition-all duration-200"
                  >
                    <div className="p-2 bg-green-100 rounded-lg">
                      <Activity className="w-5 h-5 text-green-600" />
                    </div>
                    <div className="text-left">
                      <h5 className="font-semibold text-slate-900">Intervention</h5>
                      <p className="text-sm text-slate-600">Record care provided (select patient first)</p>
                    </div>
                  </button>
                </div>
              </div>

              {/* New Note Form for General Notes */}
              {showNewNote && !selectedPatient && (
                <div className="bg-gradient-to-br from-white to-slate-50 rounded-2xl shadow-lg border border-slate-200/50 p-8">
                  <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-gradient-to-r from-pink-500 to-rose-600 rounded-xl">
                        <Plus className="w-5 h-5 text-white" />
                      </div>
                      <div>
                        <h4 className="text-lg font-bold text-slate-900">Quick Note</h4>
                        <p className="text-sm text-slate-600">Simple note for quick observations</p>
                      </div>
                    </div>
                    <button
                      onClick={() => setShowNewNote(false)}
                      className="p-2 text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-all duration-200"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>

                  <div className="text-center py-12">
                    <div className="w-16 h-16 bg-gradient-to-r from-pink-100 to-rose-100 rounded-full flex items-center justify-center mx-auto mb-4">
                      <User className="w-8 h-8 text-pink-600" />
                    </div>
                    <h3 className="text-lg font-semibold text-slate-900 mb-2">Select a Patient First</h3>
                    <p className="text-slate-600 mb-6">Choose a patient from "Today's Patients" above to create a note</p>
                    <div className="flex justify-center gap-4">
                      <button
                        onClick={() => setShowNewNote(false)}
                        className="px-6 py-3 border border-slate-300 text-slate-700 rounded-xl hover:bg-slate-50 transition-all duration-200 font-semibold"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      );
    }
  };

  return (
    <div className="w-full max-w-full space-y-4 sm:space-y-6 overflow-x-hidden">
      {cdssInsights && (
        <AiOutputWrapper
          label="Nursing CDSS Insights"
          confidence={cdssInsights?.confidence}
          abstained={cdssInsights?.abstained}
          abstain_reason={cdssInsights?.abstain_reason}
          citations={cdssInsights?.citations}
          className="w-full"
        >
          <div className="space-y-2 sm:space-y-3">
            <p className="text-xs text-slate-500">Based on the most recent nursing note.</p>

            {Array.isArray(cdssInsights?.recommendations) && cdssInsights.recommendations.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-slate-600 mb-1">Recommendations</p>
                <ul className="text-xs text-slate-600 space-y-1 list-disc list-inside">
                  {(cdssInsights.recommendations as string[]).map((rec, idx) => (
                    <li key={`rec-${idx}`}>{rec}</li>
                  ))}
                </ul>
              </div>
            )}

            {Array.isArray(cdssInsights?.alerts) && cdssInsights.alerts.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-amber-600 mb-1">Alerts</p>
                <ul className="text-xs text-amber-700 space-y-1 list-disc list-inside">
                  {(cdssInsights.alerts as string[]).map((alert, idx) => (
                    <li key={`alert-${idx}`}>{alert}</li>
                  ))}
                </ul>
              </div>
            )}

            {Array.isArray(cdssInsights?.diagnosis?.suggested_diagnoses) && cdssInsights.diagnosis.suggested_diagnoses.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-slate-600 mb-1">Likely Diagnoses</p>
                <ul className="text-xs text-slate-600 space-y-1 list-disc list-inside">
                  {cdssInsights.diagnosis.suggested_diagnoses.slice(0, 3).map((diag: any, idx: number) => (
                    <li key={`diag-${idx}`}>
                      {diag.diagnosis || diag.condition}
                      {diag.probability && ` (${Math.round(diag.probability * 100)}%)`}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {Array.isArray(cdssInsights?.careGaps?.gaps) && cdssInsights.careGaps.gaps.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-amber-600 mb-1">Care Gaps</p>
                <ul className="text-xs text-slate-600 space-y-1 list-disc list-inside">
                  {cdssInsights.careGaps.gaps.slice(0, 3).map((gap: any, idx: number) => (
                    <li key={`gap-${idx}`}>{gap?.description || gap}</li>
                  ))}
                </ul>
              </div>
            )}

            {Array.isArray(cdssInsights?.recommendedInterventions) && cdssInsights.recommendedInterventions.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-slate-600 mb-1">Documented Interventions</p>
                <p className="text-xs text-slate-500">
                  {cdssInsights.recommendedInterventions.join(' · ')}
                </p>
              </div>
            )}
          </div>
        </AiOutputWrapper>
      )}

      {renderContent()}
      
      {patient && onClose && (
        <div className="flex items-center justify-end gap-4 pt-6 border-t border-slate-200">
          <button
            onClick={onClose}
            className="px-6 py-3 border border-slate-300 text-slate-700 rounded-xl hover:bg-slate-50 transition-all duration-200 font-semibold"
          >
            Close
          </button>
        </div>
      )}

      {/* Template Library Modal */}
      {showTemplateLibrary && (
        <ClinicalTemplateLibrary
          open={showTemplateLibrary}
          tenantSlug={tenantSlug || localStorage.getItem('ehr_tenant') || localStorage.getItem('ehr_tenant_slug') || ''}
          token={localStorage.getItem('ehr_token') || ''}
          onClose={() => setShowTemplateLibrary(false)}
          onSelect={async (template) => {
            try {
              const token = localStorage.getItem('ehr_token') || '';
              const tenantSlugValue = tenantSlug || localStorage.getItem('ehr_tenant') || localStorage.getItem('ehr_tenant_slug') || '';
              
              if (!token || !tenantSlugValue) {
                showError('Error', 'Authentication required');
                return;
              }

              // Get patient context for variable substitution
              const patientName = selectedPatient 
                ? `${selectedPatient.firstName} ${selectedPatient.lastName}`
                : 'Patient';
              
              const patientAge = selectedPatient?.dateOfBirth
                ? Math.floor((new Date().getTime() - new Date(selectedPatient.dateOfBirth).getTime()) / (1000 * 60 * 60 * 24 * 365.25))
                : undefined;

              const userData = localStorage.getItem('ehr_user');
              const currentUser = userData ? JSON.parse(userData) : null;
              const providerName = currentUser ? `${currentUser.firstName} ${currentUser.lastName}` : 'Provider';

              // Apply template with context variables
              const variables: Record<string, string> = {
                patientName: patientName,
                patientAge: patientAge?.toString() || '',
                patientGender: selectedPatient?.gender || '',
                date: new Date().toLocaleDateString(),
                providerName: providerName,
                observations: newNote.observations || '',
                interventions: newNote.interventions || '',
                outcomes: newNote.outcomes || '',
              };

              const response = await clinicalTemplateApi.applyTemplate(template.id, variables, token, tenantSlugValue);
              
              // Append template content to notes (or replace if empty)
              const templateContent = typeof response === 'string' ? response : (response.data?.content || response.data || response);
              if (newNote.content.trim()) {
                setNewNote(prev => ({ ...prev, content: prev.content + '\n\n' + templateContent }));
              } else {
                setNewNote(prev => ({ ...prev, content: templateContent }));
              }
              
              setShowTemplateLibrary(false);
              showSuccess('Success', 'Template applied successfully');
            } catch (error: any) {
              showError('Error', error?.response?.data?.message || 'Failed to apply template');
            }
          }}
        />
      )}
    </div>
  );
};

export default NursingNotes;
