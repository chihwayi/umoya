import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Calendar,
  CreditCard,
  Eye,
  EyeOff,
  LogOut,
  NotebookPen,
  Plus,
  RefreshCw,
  Search,
  Stethoscope,
  TestTube,
  X,
  ArrowLeft,
  Brain,
  BookOpen,
  Sparkles,
  Loader2,
} from 'lucide-react';
import { format } from 'date-fns';
import { ehrApi, cdssApi } from '../services/api';
import { useNotification } from '../components/GlobalNotification';
import { useConfirmation } from '../hooks/useConfirmation';
import ModalPortal from '../components/ModalPortal';
import SnomedConceptPicker, { SnomedConcept } from '../components/SnomedConceptPicker';
import { SmartFormsFloatingButton } from '../components/WHOSmartForms';
import { GuidelineResult } from '../types/guidelines';
import {
  buildSharedContextTags,
  getOphthalmologyCreateEncounterPrefill,
  getOphthalmologyEncounterDuplicateGuard,
} from '../services/doctorContextAdapter';

type OphthalmologyEncounter = {
  id: string;
  patient_id: string;
  patient_name?: string;
  patient_number?: string;
  encounter_date: string;
  encounter_type: string;
  ophthalmologist_name?: string;
  chief_complaint?: string;
  assessment?: string;
  plan?: string;
  payment_status?: string | null;
  fee_amount?: number | null;
  finance_transaction_id?: string | null;
};

type OphthalmologyEncounterDetail = {
  encounter: OphthalmologyEncounter & {
    phone?: string;
    date_of_birth?: string;
  };
  visualAcuity: any[];
  refraction: any[];
  slitLamp: any[];
  octStudies: any[];
  followUps: any[];
};

type OphthalmologyDashboardSummary = {
  encounterTotals?: {
    total_encounters?: string;
    comprehensive_exams?: string;
    follow_ups?: string;
    past_30_day_encounters?: string;
  };
  upcomingFollowUps?: any[];
  procedureSummary?: any[];
  visualAcuityTrend?: any[];
  financeSummary?: {
    awaiting_payment_encounters?: string;
    cleared_encounters?: string;
    total_encounters?: string;
  };
};

type ModalState =
  | { type: 'createEncounter' }
  | { type: 'visualAcuity'; encounterId: string }
  | { type: 'refraction'; encounterId: string }
  | { type: 'slitLamp'; encounterId: string }
  | { type: 'oct'; encounterId: string }
  | { type: 'followUp'; encounterId?: string; patientId?: string }
  | { type: 'procedure'; patientId: string; encounterId?: string }
  | null;

const ENCOUNTER_TYPE_LABELS: Record<string, string> = {
  comprehensive_exam: 'Comprehensive Exam',
  follow_up: 'Follow-Up',
  pre_op: 'Pre-Op',
  post_op: 'Post-Op',
  emergency: 'Emergency',
  other: 'Other',
};

interface OphthalmologyDashboardProps {
  embedded?: boolean;
}

const OphthalmologyDashboard: React.FC<OphthalmologyDashboardProps> = ({ embedded = false }) => {
  const { tenantSlug } = useParams<{ tenantSlug: string }>();
  const navigate = useNavigate();
  const { showError, showSuccess, showInfo } = useNotification();
  const { confirm, Dialog } = useConfirmation();

  const [currentUser, setCurrentUser] = useState<any>(null);
  const [encountersLoading, setEncountersLoading] = useState(false);
  const [encounters, setEncounters] = useState<OphthalmologyEncounter[]>([]);
  const [filters, setFilters] = useState<{ search: string; type: string | null }>({ search: '', type: null });
  const [selectedEncounterId, setSelectedEncounterId] = useState<string | null>(null);

  // CDSS Guideline Search State
  const [showGuidelineSearch, setShowGuidelineSearch] = useState(false);
  const [guidelineQuery, setGuidelineQuery] = useState('');
  const [guidelineResults, setGuidelineResults] = useState<GuidelineResult[]>([]);
  const [loadingGuidelines, setLoadingGuidelines] = useState(false);

  const [encounterDetail, setEncounterDetail] = useState<OphthalmologyEncounterDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [dashboardSummary, setDashboardSummary] = useState<OphthalmologyDashboardSummary | null>(null);
  const [modalState, setModalState] = useState<ModalState>(null);
  const [submitting, setSubmitting] = useState(false);
  const [chiefComplaintConcept, setChiefComplaintConcept] = useState<SnomedConcept | null>(null);
  const [assessmentConcept, setAssessmentConcept] = useState<SnomedConcept | null>(null);
  const [slitStructureConcept, setSlitStructureConcept] = useState<SnomedConcept | null>(null);
  const [slitObservationConcept, setSlitObservationConcept] = useState<SnomedConcept | null>(null);
  const [followUpReasonConcept, setFollowUpReasonConcept] = useState<SnomedConcept | null>(null);
  const [procedureConcept, setProcedureConcept] = useState<SnomedConcept | null>(null);
  const [createEncounterPatientContext, setCreateEncounterPatientContext] = useState<any | null>(null);
  const [loadingCreateEncounterContext, setLoadingCreateEncounterContext] = useState(false);
  const encounterDateInputRef = useRef<HTMLInputElement | null>(null);
  const ophthalmologistIdInputRef = useRef<HTMLInputElement | null>(null);
  const chiefComplaintInputRef = useRef<HTMLTextAreaElement | null>(null);
  const assessmentInputRef = useRef<HTMLTextAreaElement | null>(null);
  const planInputRef = useRef<HTMLTextAreaElement | null>(null);

  const token = useMemo(() => localStorage.getItem('ehr_token'), []);

  const resetSnomedSelections = () => {
    setChiefComplaintConcept(null);
    setAssessmentConcept(null);
    setSlitStructureConcept(null);
    setSlitObservationConcept(null);
    setFollowUpReasonConcept(null);
    setProcedureConcept(null);
  };

  useEffect(() => {
    if (!modalState) {
      resetSnomedSelections();
      setCreateEncounterPatientContext(null);
      setLoadingCreateEncounterContext(false);
    }
    if (modalState && modalState.type !== 'createEncounter') {
      setCreateEncounterPatientContext(null);
      setLoadingCreateEncounterContext(false);
    }
  }, [modalState]);

  const loadCreateEncounterPatientContext = useCallback(
    async (rawPatientId: string) => {
      if (!token || !tenantSlug) {
        showError('Session expired', 'Please sign in again.');
        return;
      }
      const patientId = String(rawPatientId || '').trim();
      if (!patientId) {
        setCreateEncounterPatientContext(null);
        return;
      }

      try {
        setLoadingCreateEncounterContext(true);
        const response = await ehrApi.getPatientContext(patientId, token!, tenantSlug!);
        const context = response.data || null;
        setCreateEncounterPatientContext(context);
        const prefill = getOphthalmologyCreateEncounterPrefill(context, currentUser?.id);

        if (encounterDateInputRef.current && !encounterDateInputRef.current.value) {
          encounterDateInputRef.current.value = prefill.encounterDateTime;
        }

        if (ophthalmologistIdInputRef.current && !ophthalmologistIdInputRef.current.value && prefill.ophthalmologistId) {
          ophthalmologistIdInputRef.current.value = prefill.ophthalmologistId;
        }

        if (chiefComplaintInputRef.current && !chiefComplaintInputRef.current.value && prefill.chiefComplaint) {
          chiefComplaintInputRef.current.value = prefill.chiefComplaint;
        }

        if (assessmentInputRef.current && !assessmentInputRef.current.value && prefill.assessment) {
          assessmentInputRef.current.value = prefill.assessment;
        }

        if (planInputRef.current && !planInputRef.current.value && prefill.plan) {
          planInputRef.current.value = prefill.plan;
        }
      } catch (error) {
        console.error('Failed to load patient context for ophthalmology encounter', error);
        setCreateEncounterPatientContext(null);
        showError('Unable to load patient context', 'Confirm patient ID or retry.');
      } finally {
        setLoadingCreateEncounterContext(false);
      }
    },
    [currentUser?.id, showError, tenantSlug, token],
  );

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

  const ensureAuth = useCallback(() => {
    if (!token || !tenantSlug) {
      showError('Session expired', 'Please sign in again.');
      navigate(`/ehr/${tenantSlug ?? ''}`);
      return false;
    }
    return true;
  }, [navigate, showError, tenantSlug, token]);

  const loadSummary = useCallback(async () => {
    if (!ensureAuth()) return;
    try {
      const response = await ehrApi.getOphthalmologyDashboardSummary(tenantSlug!, token!);
      setDashboardSummary(response.data);
    } catch (error) {
      console.error('Failed to load ophthalmology summary', error);
      showError('Unable to load ophthalmology insights', 'Please retry shortly.');
    }
  }, [ensureAuth, showError, tenantSlug, token]);

  const loadEncounters = useCallback(
    async (searchTerm: string = filters.search, typeFilter: string | null = filters.type) => {
      if (!ensureAuth()) return;
      setEncountersLoading(true);
      try {
        const params: Record<string, string> = {};
        if (searchTerm) params.search = searchTerm;
        if (typeFilter) params.encounter_type = typeFilter;
        const response = await ehrApi.getOphthalmologyEncounters(tenantSlug!, token!, params);
        setEncounters(Array.isArray(response.data?.encounters) ? response.data.encounters : []);
      } catch (error) {
        console.error('Failed to load ophthalmology encounters', error);
        showError('Unable to load ophthalmology encounters', 'Please try again.');
      } finally {
        setEncountersLoading(false);
      }
    },
    [ensureAuth, filters.search, filters.type, showError, tenantSlug, token],
  );

  const loadEncounterDetail = useCallback(
    async (encounterId: string) => {
      if (!ensureAuth()) return;
      setDetailLoading(true);
      try {
        const response = await ehrApi.getOphthalmologyEncounterDetail(tenantSlug!, token!, encounterId);
        setEncounterDetail(response.data);
      } catch (error) {
        console.error('Failed to load encounter detail', error);
        showError('Unable to load encounter details', 'Please retry.');
      } finally {
        setDetailLoading(false);
      }
    },
    [ensureAuth, showError, tenantSlug, token],
  );

  useEffect(() => {
    const userData = localStorage.getItem('ehr_user');
    if (userData) {
      setCurrentUser(JSON.parse(userData));
    } else {
      navigate(`/ehr/${tenantSlug ?? ''}`);
    }
  }, [navigate, tenantSlug]);

  useEffect(() => {
    const initialize = async () => {
      await Promise.all([loadSummary(), loadEncounters(filters.search, filters.type)]);
    };
    initialize();
  }, [filters.search, filters.type, loadEncounters, loadSummary]);

  const createEncounterContextTags = useMemo(
    () => buildSharedContextTags(createEncounterPatientContext),
    [createEncounterPatientContext],
  );

  const handleEncounterSelect = (encounterId: string) => {
    setSelectedEncounterId(encounterId);
    loadEncounterDetail(encounterId);
  };

  const handleLogout = () => {
    localStorage.removeItem('ehr_token');
    localStorage.removeItem('ehr_user');
    localStorage.removeItem('ehr_tenant');
    showInfo('Signed out', 'Have a great day!');
    navigate(`/ehr/${tenantSlug ?? ''}`);
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!modalState || !ensureAuth()) return;
    const formData = new FormData(event.currentTarget);
    setSubmitting(true);
    try {
      switch (modalState.type) {
        case 'createEncounter': {
          const duplicatePrompt = getOphthalmologyEncounterDuplicateGuard(createEncounterPatientContext, {
            encounterType: formData.get('encounter_type') as string | null,
            chiefComplaint: formData.get('chief_complaint') as string | null,
          });
          if (duplicatePrompt) {
            const shouldProceed = await confirm({
              title: duplicatePrompt.title,
              message: duplicatePrompt.message,
              type: 'warning',
              confirmText: duplicatePrompt.confirmText,
              cancelText: duplicatePrompt.cancelText,
            });
            if (!shouldProceed) {
              return;
            }
          }

          const payload = {
            patient_id: formData.get('patient_id'),
            encounter_date: formData.get('encounter_date'),
            encounter_type: formData.get('encounter_type') || 'comprehensive_exam',
            ophthalmologist_id: formData.get('ophthalmologist_id') || null,
            chief_complaint: formData.get('chief_complaint') || null,
            assessment: formData.get('assessment') || null,
            plan: formData.get('plan') || null,
            fee_amount: formData.get('fee_amount')
              ? Number(formData.get('fee_amount'))
              : null,
            chiefComplaintConcept: chiefComplaintConcept,
            assessmentConcept: assessmentConcept,
          };
          await ehrApi.createOphthalmologyEncounter(tenantSlug!, token!, payload);
          showSuccess(
            'Success','Encounter captured. Accounts will unlock the chart once payment is confirmed.',
          );
          await loadEncounters(filters.search, filters.type);
          await loadSummary();
          break;
        }
        case 'visualAcuity': {
          const payload = {
            eye: formData.get('eye'),
            distance_unaided: formData.get('distance_unaided') || null,
            distance_aided: formData.get('distance_aided') || null,
            near_unaided: formData.get('near_unaided') || null,
            near_aided: formData.get('near_aided') || null,
            pinhole: formData.get('pinhole') || null,
            notes: formData.get('notes') || null,
          };
          await ehrApi.addOphthalmologyVisualAcuity(tenantSlug!, token!, modalState.encounterId, payload);
          showSuccess('Visual acuity saved', 'Visual acuity entry captured.');
          if (selectedEncounterId) {
            await loadEncounterDetail(selectedEncounterId);
          }
          break;
        }
        case 'refraction': {
          const payload = {
            eye: formData.get('eye'),
            sphere: formData.get('sphere') ? Number(formData.get('sphere')) : null,
            cylinder: formData.get('cylinder') ? Number(formData.get('cylinder')) : null,
            axis: formData.get('axis') ? Number(formData.get('axis')) : null,
            add_power: formData.get('add_power') ? Number(formData.get('add_power')) : null,
            corrected_va: formData.get('corrected_va') || null,
            notes: formData.get('notes') || null,
          };
          await ehrApi.addOphthalmologyRefraction(tenantSlug!, token!, modalState.encounterId, payload);
          showSuccess('Refraction recorded', 'Refraction values saved successfully.');
          if (selectedEncounterId) {
            await loadEncounterDetail(selectedEncounterId);
          }
          break;
        }
        case 'slitLamp': {
          const payload = {
            structure: formData.get('structure'),
            observation: formData.get('observation'),
            severity: formData.get('severity') || null,
            structureConcept: slitStructureConcept,
            observationConcept: slitObservationConcept,
          };
          await ehrApi.addOphthalmologySlitLampFinding(tenantSlug!, token!, modalState.encounterId, payload);
          showSuccess('Slit-lamp finding saved', 'Anterior segment findings captured.');
          if (selectedEncounterId) {
            await loadEncounterDetail(selectedEncounterId);
          }
          break;
        }
        case 'oct': {
          const payload = {
            imaging_order_id: formData.get('imaging_order_id') || null,
            eye: formData.get('eye'),
            study_date: formData.get('study_date') || null,
            image_reference: formData.get('image_reference') || null,
            interpretation: formData.get('interpretation') || null,
          };
          await ehrApi.addOphthalmologyOctStudy(tenantSlug!, token!, modalState.encounterId, payload);
          showSuccess('OCT study linked', 'OCT imaging reference stored.');
          if (selectedEncounterId) {
            await loadEncounterDetail(selectedEncounterId);
          }
          break;
        }
        case 'followUp': {
          const payload = {
            patient_id: modalState.patientId || formData.get('patient_id'),
            scheduled_date: formData.get('scheduled_date'),
            reason: formData.get('reason') || null,
            priority: formData.get('priority') || 'routine',
            status: formData.get('status') || 'scheduled',
            related_encounter_id: modalState.encounterId || formData.get('related_encounter_id') || null,
            reasonConcept: followUpReasonConcept,
          };
          await ehrApi.scheduleOphthalmologyFollowUp(tenantSlug!, token!, payload);
          showSuccess('Follow-up scheduled', 'Patient follow-up added to queue.');
          await loadSummary();
          if (selectedEncounterId) {
            await loadEncounterDetail(selectedEncounterId);
          }
          break;
        }
        case 'procedure': {
          const payload = {
            patient_id: modalState.patientId,
            encounter_id: modalState.encounterId || formData.get('encounter_id') || null,
            procedure_name: formData.get('procedure_name'),
            procedure_date: formData.get('procedure_date'),
            eye: formData.get('eye') || null,
            outcome: formData.get('outcome') || null,
            complications: formData.get('complications') || null,
            surgeon_id: formData.get('surgeon_id') || null,
            procedureConcept,
          };
          await ehrApi.recordOphthalmologyProcedure(tenantSlug!, token!, payload);
          showSuccess('Procedure recorded', 'Ophthalmology procedure saved.');
          await loadSummary();
          break;
        }
        default:
          break;
      }
      setModalState(null);
    } catch (error) {
      console.error('Failed to submit ophthalmology form', error);
      showError('Action failed', 'Please verify the form and try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const summaryCards = useMemo(() => {
    const totals = dashboardSummary?.encounterTotals;
    const finance = dashboardSummary?.financeSummary;
    return [
      {
        title: 'Total Encounters',
        value: totals?.total_encounters ?? '0',
        icon: Eye,
        gradient: 'from-indigo-500 to-blue-500',
      },
      {
        title: 'Comprehensive Exams',
        value: totals?.comprehensive_exams ?? '0',
        icon: Stethoscope,
        gradient: 'from-emerald-500 to-teal-500',
      },
      {
        title: 'Follow-Ups',
        value: totals?.follow_ups ?? '0',
        icon: Calendar,
        gradient: 'from-amber-500 to-orange-500',
      },
      {
        title: 'Last 30 Days',
        value: totals?.past_30_day_encounters ?? '0',
        icon: RefreshCw,
        gradient: 'from-purple-500 to-fuchsia-500',
      },
      {
        title: 'Awaiting Payment',
        value: finance?.awaiting_payment_encounters ?? '0',
        icon: CreditCard,
        gradient: 'from-rose-500 to-amber-500',
      },
    ];
  }, [dashboardSummary]);

  const renderModal = () => {
    if (!modalState) return null;

    const closeModal = () => {
      if (!submitting) setModalState(null);
    };

    const renderHeader = (title: string, subtitle?: string) => (
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-xl font-semibold text-slate-900">{title}</h3>
          {subtitle && <p className="text-sm text-slate-500 mt-1">{subtitle}</p>}
        </div>
        <button onClick={closeModal} type="button" className="p-2 rounded-full bg-slate-100 hover:bg-slate-200">
          <X className="w-5 h-5 text-slate-600" />
        </button>
      </div>
    );

    const submitLabel = submitting ? 'Saving...' : 'Save';

    return (
      <ModalPortal>
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center px-4">
          <div className="w-full max-w-2xl bg-white rounded-2xl shadow-2xl p-6 max-h-[90vh] overflow-y-auto border border-slate-100">
            <form onSubmit={handleSubmit} className="space-y-4">
              {modalState.type === 'createEncounter' && (
                <>
                  {renderHeader('Create Ophthalmology Encounter', 'Capture visit reason and encounter context')}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Patient ID</label>
                      <input
                        name="patient_id"
                        required
                        className="w-full border rounded-lg px-3 py-2"
                        placeholder="UUID"
                        onBlur={(event) => loadCreateEncounterPatientContext(event.target.value)}
                      />
                      <p className="text-xs text-slate-500 mt-1">
                        Enter patient ID once to reuse profile and cross-module context.
                      </p>
                      {loadingCreateEncounterContext && (
                        <p className="text-xs text-indigo-600 mt-1">Loading shared context...</p>
                      )}
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Encounter Date & Time</label>
                      <input
                        type="datetime-local"
                        name="encounter_date"
                        ref={encounterDateInputRef}
                        required
                        className="w-full border rounded-lg px-3 py-2"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Encounter Type</label>
                      <select name="encounter_type" className="w-full border rounded-lg px-3 py-2">
                        <option value="comprehensive_exam">Comprehensive Exam</option>
                        <option value="follow_up">Follow-Up</option>
                        <option value="pre_op">Pre-Op</option>
                        <option value="post_op">Post-Op</option>
                        <option value="emergency">Emergency</option>
                        <option value="other">Other</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Ophthalmologist ID</label>
                      <input
                        name="ophthalmologist_id"
                        ref={ophthalmologistIdInputRef}
                        defaultValue={currentUser?.id || ''}
                        className="w-full border rounded-lg px-3 py-2"
                        placeholder="UUID"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Estimated Fee (USD)</label>
                      <input
                        type="number"
                        step="0.01"
                        name="fee_amount"
                        className="w-full border rounded-lg px-3 py-2"
                        placeholder="e.g. 65.00"
                      />
                      <p className="mt-1 text-xs text-slate-500">Leave blank to use the default specialist tariff.</p>
                    </div>
                  </div>
                  <div className="p-3 border border-amber-200 bg-amber-50 text-amber-800 text-sm rounded-lg flex gap-2">
                    <CreditCard className="w-4 h-4 mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="font-semibold">Finance-gated encounter</p>
                      <p>
                        The encounter stays read-only until Accounts confirms payment. Capture the estimated fee so billing
                        can reconcile quickly.
                      </p>
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Chief Complaint</label>
                    <textarea
                      name="chief_complaint"
                      ref={chiefComplaintInputRef}
                      rows={3}
                      className="w-full border rounded-lg px-3 py-2"
                      placeholder="Patient-reported symptoms, duration, associated features"
                    />
                {token && tenantSlug && (
                  <div className="mt-3">
                    <SnomedConceptPicker
                      value={chiefComplaintConcept}
                      onChange={setChiefComplaintConcept}
                      token={token!}
                      tenantSlug={tenantSlug!}
                      label="Chief complaint SNOMED concept"
                      helperText="Optional structured code to standardize presenting symptoms."
                      context="condition"
                    />
                  </div>
                )}
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Assessment & Plan</label>
                    <textarea
                      name="assessment"
                      ref={assessmentInputRef}
                      rows={3}
                      className="w-full border rounded-lg px-3 py-2 mb-3"
                      placeholder="Assessment summary"
                    />
                {token && tenantSlug && (
                  <div className="mt-3">
                    <SnomedConceptPicker
                      value={assessmentConcept}
                      onChange={setAssessmentConcept}
                      token={token!}
                      tenantSlug={tenantSlug!}
                      label="Assessment SNOMED concept"
                      helperText="Add a coded diagnosis to keep downstream reporting aligned."
                      context="condition"
                    />
                  </div>
                )}
                    <textarea
                      name="plan"
                      ref={planInputRef}
                      rows={3}
                      className="w-full border rounded-lg px-3 py-2"
                      placeholder="Management plan, medications, investigations"
                    />
                  </div>
                  {createEncounterPatientContext && (
                    <div className="rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-2 text-sm text-indigo-900">
                      Context loaded for
                      {' '}
                      <span className="font-semibold">
                        {createEncounterPatientContext?.patient?.fullName || 'patient'}
                      </span>
                      {createEncounterContextTags.length ? ` • ${createEncounterContextTags.join(' • ')}` : ''}.
                    </div>
                  )}
                </>
              )}

              {modalState.type === 'visualAcuity' && (
                <>
                  {renderHeader('Record Visual Acuity')}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Eye</label>
                      <select name="eye" required className="w-full border rounded-lg px-3 py-2">
                        <option value="OD">Right (OD)</option>
                        <option value="OS">Left (OS)</option>
                        <option value="OU">Both (OU)</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Distance Unaided</label>
                      <input name="distance_unaided" className="w-full border rounded-lg px-3 py-2" placeholder="e.g. 6/24" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Distance Aided</label>
                      <input name="distance_aided" className="w-full border rounded-lg px-3 py-2" placeholder="e.g. 6/18" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Near Unaided</label>
                      <input name="near_unaided" className="w-full border rounded-lg px-3 py-2" placeholder="e.g. N8" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Near Aided</label>
                      <input name="near_aided" className="w-full border rounded-lg px-3 py-2" placeholder="e.g. N6" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Pinhole</label>
                      <input name="pinhole" className="w-full border rounded-lg px-3 py-2" placeholder="e.g. 6/12" />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Notes</label>
                    <textarea
                      name="notes"
                      rows={3}
                      className="w-full border rounded-lg px-3 py-2"
                      placeholder="Symptoms, patient cooperation, vision aids used"
                    />
                  </div>
                </>
              )}

              {modalState.type === 'refraction' && (
                <>
                  {renderHeader('Record Refraction')}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Eye</label>
                      <select name="eye" required className="w-full border rounded-lg px-3 py-2">
                        <option value="OD">Right (OD)</option>
                        <option value="OS">Left (OS)</option>
                        <option value="OU">Both (OU)</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Sphere (D)</label>
                      <input type="number" step="0.25" name="sphere" className="w-full border rounded-lg px-3 py-2" placeholder="-1.50" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Cylinder (D)</label>
                      <input type="number" step="0.25" name="cylinder" className="w-full border rounded-lg px-3 py-2" placeholder="-0.75" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Axis (°)</label>
                      <input type="number" min={0} max={180} name="axis" className="w-full border rounded-lg px-3 py-2" placeholder="90" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Add Power (D)</label>
                      <input type="number" step="0.25" name="add_power" className="w-full border rounded-lg px-3 py-2" placeholder="+2.50" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Corrected VA</label>
                      <input name="corrected_va" className="w-full border rounded-lg px-3 py-2" placeholder="6/6" />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Notes</label>
                    <textarea
                      name="notes"
                      rows={3}
                      className="w-full border rounded-lg px-3 py-2"
                      placeholder="Refraction method, patient tolerance, trial frame vs phoropter"
                    />
                  </div>
                </>
              )}

              {modalState.type === 'slitLamp' && (
                <>
                  {renderHeader('Record Slit-Lamp Findings')}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Structure</label>
                      <input
                        name="structure"
                        required
                        className="w-full border rounded-lg px-3 py-2"
                        placeholder="e.g. Cornea, Conjunctiva, Lens"
                      />
                      {token && tenantSlug && (
                        <div className="mt-2">
                          <SnomedConceptPicker
                            value={slitStructureConcept}
                            onChange={setSlitStructureConcept}
                            token={token!}
                            tenantSlug={tenantSlug!}
                            label="Structure SNOMED concept"
                            helperText="Optional structured code for the anatomical structure examined."
                          context="anatomy"
                          />
                        </div>
                      )}
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Severity</label>
                      <input name="severity" className="w-full border rounded-lg px-3 py-2" placeholder="Mild / Moderate / Severe" />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Observation</label>
                    <textarea
                      name="observation"
                      required
                      rows={3}
                      className="w-full border rounded-lg px-3 py-2"
                      placeholder="Detail the findings, staining, infiltrates, cells/flare..."
                    />
                    {token && tenantSlug && (
                      <div className="mt-2">
                        <SnomedConceptPicker
                          value={slitObservationConcept}
                          onChange={setSlitObservationConcept}
                          token={token!}
                          tenantSlug={tenantSlug!}
                          label="Observation SNOMED concept"
                          helperText="Capture a coded description for analytics and interoperability."
                          context="observable"
                        />
                      </div>
                    )}
                  </div>
                </>
              )}

              {modalState.type === 'oct' && (
                <>
                  {renderHeader('Link OCT Study')}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Eye</label>
                      <select name="eye" required className="w-full border rounded-lg px-3 py-2">
                        <option value="OD">Right (OD)</option>
                        <option value="OS">Left (OS)</option>
                        <option value="OU">Both (OU)</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Study Date & Time</label>
                      <input type="datetime-local" name="study_date" className="w-full border rounded-lg px-3 py-2" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Imaging Order ID</label>
                      <input name="imaging_order_id" className="w-full border rounded-lg px-3 py-2" placeholder="Link to imaging order" />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Image Reference / URL</label>
                    <input name="image_reference" className="w-full border rounded-lg px-3 py-2" placeholder="URL or storage reference" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Interpretation</label>
                    <textarea
                      name="interpretation"
                      rows={3}
                      className="w-full border rounded-lg px-3 py-2"
                      placeholder="Macular thickness, RNFL analysis, pathology summary"
                    />
                  </div>
                </>
              )}

              {modalState.type === 'followUp' && (
                <>
                  {renderHeader('Schedule Follow-Up')}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {!modalState.patientId && (
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Patient ID</label>
                        <input name="patient_id" required className="w-full border rounded-lg px-3 py-2" placeholder="UUID" />
                      </div>
                    )}
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Scheduled Date & Time</label>
                      <input type="datetime-local" name="scheduled_date" required className="w-full border rounded-lg px-3 py-2" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Priority</label>
                      <select name="priority" className="w-full border rounded-lg px-3 py-2">
                        <option value="routine">Routine</option>
                        <option value="urgent">Urgent</option>
                        <option value="low">Low</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Status</label>
                      <select name="status" className="w-full border rounded-lg px-3 py-2">
                        <option value="scheduled">Scheduled</option>
                        <option value="completed">Completed</option>
                        <option value="cancelled">Cancelled</option>
                        <option value="no_show">No Show</option>
                      </select>
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Reason / Notes</label>
                    <textarea
                      name="reason"
                      rows={3}
                      className="w-full border rounded-lg px-3 py-2"
                      placeholder="Planned review, post-op check, diagnostic follow-up..."
                    />
                    {token && tenantSlug && (
                      <div className="mt-2">
                        <SnomedConceptPicker
                          value={followUpReasonConcept}
                          onChange={setFollowUpReasonConcept}
                          token={token!}
                          tenantSlug={tenantSlug!}
                          label="Follow-up reason SNOMED concept"
                          helperText="Optional — pick a coded reason to keep the follow-up queue structured."
                        context="condition"
                        />
                      </div>
                    )}
                  </div>
                  {!modalState.encounterId && (
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Related Encounter ID</label>
                      <input name="related_encounter_id" className="w-full border rounded-lg px-3 py-2" placeholder="UUID" />
                    </div>
                  )}
                </>
              )}

              {modalState.type === 'procedure' && (
                <>
                  {renderHeader('Record Ophthalmology Procedure')}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Procedure Name</label>
                      <input
                        name="procedure_name"
                        required
                        className="w-full border rounded-lg px-3 py-2"
                        placeholder="e.g. Cataract extraction"
                      />
                      {token && tenantSlug && (
                        <div className="mt-2">
                          <SnomedConceptPicker
                            value={procedureConcept}
                            onChange={setProcedureConcept}
                            token={token!}
                            tenantSlug={tenantSlug!}
                            label="Procedure SNOMED concept"
                            helperText="Save a coded intervention to power analytics and billing alignment."
                            context="procedure"
                          />
                        </div>
                      )}
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Procedure Date</label>
                      <input type="date" name="procedure_date" required className="w-full border rounded-lg px-3 py-2" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Eye</label>
                      <select name="eye" className="w-full border rounded-lg px-3 py-2">
                        <option value="">Select</option>
                        <option value="OD">Right (OD)</option>
                        <option value="OS">Left (OS)</option>
                        <option value="OU">Both (OU)</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Surgeon ID</label>
                      <input name="surgeon_id" className="w-full border rounded-lg px-3 py-2" placeholder="UUID" />
                    </div>
                    {!modalState.encounterId && (
                      <div className="md:col-span-2">
                        <label className="block text-sm font-medium text-slate-700 mb-1">Related Encounter ID</label>
                        <input name="encounter_id" className="w-full border rounded-lg px-3 py-2" placeholder="UUID" />
                      </div>
                    )}
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Outcome</label>
                    <textarea
                      name="outcome"
                      rows={3}
                      className="w-full border rounded-lg px-3 py-2"
                      placeholder="Visual outcome, complications, IOP, recovery plan"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Complications</label>
                    <textarea
                      name="complications"
                      rows={3}
                      className="w-full border rounded-lg px-3 py-2"
                      placeholder="Intraoperative/postoperative complications"
                    />
                  </div>
                </>
              )}

              <div className="flex justify-end gap-3 pt-4">
                <button
                  type="button"
                  className="px-4 py-2 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-100"
                  onClick={closeModal}
                  disabled={submitting}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-60"
                  disabled={submitting}
                >
                  {submitLabel}
                </button>
              </div>
            </form>
          </div>
        </div>
      </ModalPortal>
    );
  };

  const formatDateTime = (dateString?: string) => {
    if (!dateString) return '—';
    try {
      return format(new Date(dateString), 'PPp');
    } catch {
      return dateString;
    }
  };

  const formatDateOnly = (dateString?: string) => {
    if (!dateString) return '—';
    try {
      return format(new Date(dateString), 'PP');
    } catch {
      return dateString;
    }
  };

  const encounterLocked =
    encounterDetail?.encounter?.payment_status === 'awaiting_payment';
  const encounterFeeAmount =
    encounterDetail?.encounter?.fee_amount ??
    encounterDetail?.encounter?.fee_amount ??
    null;

  return (
    <div className={`${embedded ? '' : 'min-h-screen '}bg-slate-50`}>
      {!embedded && (
      <header className="bg-gradient-to-r from-sky-600 via-indigo-600 to-blue-600 border-b border-sky-400 shadow">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between gap-4 text-white">
          <div className="flex items-start gap-3">
            <button
              onClick={() => navigate(`/ehr/${tenantSlug}/doctor`)}
              className="p-2 rounded-full bg-white/10 hover:bg-white/20 transition"
              aria-label="Back to doctor dashboard"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
            <div>
              <h1 className="text-2xl font-semibold flex items-center gap-2">
                <Eye className="w-6 h-6" />
                Ophthalmology Care Hub
              </h1>
              <p className="text-sm text-white/80">
                Track ocular encounters, visual acuity trends, imaging, procedures, and follow-up cadence.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {currentUser && (
              <div className="text-right">
                <p className="text-sm font-medium">
                  {currentUser.firstName} {currentUser.lastName}
                </p>
                <p className="text-xs text-white/70 capitalize">{currentUser.role}</p>
              </div>
            )}
            <button
              onClick={handleLogout}
              className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-white/10 hover:bg-white/20 text-white transition"
            >
              <LogOut className="w-4 h-4" />
              Logout
            </button>
          </div>
        </div>
      </header>
      )}

      <main className="max-w-7xl mx-auto px-6 py-8 space-y-8">

        {/* AI Guideline Search Section */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <div className="p-2 bg-indigo-100 rounded-lg">
                <Brain className="w-5 h-5 text-indigo-600" />
              </div>
              <div>
                <h3 className="font-semibold text-slate-900">Clinical Guidelines & Protocols</h3>
                <p className="text-sm text-slate-500">AI-powered search for ophthalmic standards of care</p>
              </div>
            </div>
            <button
              onClick={() => setShowGuidelineSearch(true)}
              className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors shadow-sm"
            >
              <Sparkles className="w-4 h-4" />
              AI Guidelines
            </button>
          </div>
        </div>

        {/* AI Guideline Search Modal */}
        {showGuidelineSearch && (
          <ModalPortal>
            <div className="fixed inset-0 z-[100] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
              <div className="w-full max-w-4xl max-h-[85vh] bg-white rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-in fade-in zoom-in duration-200">
                <div className="p-4 border-b border-indigo-100 flex items-center justify-between bg-indigo-50/50">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-indigo-100 rounded-lg">
                      <BookOpen className="w-5 h-5 text-indigo-600" />
                    </div>
                    <div>
                      <h3 className="text-lg font-bold text-slate-900">Ophthalmology Clinical Guidelines</h3>
                      <p className="text-xs text-indigo-600 font-medium">Powered by AI • AAO/RCOphth Protocols</p>
                    </div>
                  </div>
                  <button 
                    onClick={() => setShowGuidelineSearch(false)}
                    className="p-2 hover:bg-slate-100 rounded-full text-slate-500 transition-colors"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <div className="p-4 border-b border-slate-100 bg-white">
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                      <input
                        type="text"
                        value={guidelineQuery}
                        onChange={(e) => setGuidelineQuery(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleGuidelineSearch()}
                        placeholder="Search guidelines (e.g., 'Glaucoma treatment', 'Diabetic retinopathy screening')..."
                        className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
                        autoFocus
                      />
                    </div>
                    <button
                      onClick={handleGuidelineSearch}
                      disabled={loadingGuidelines || !guidelineQuery.trim()}
                      className="px-6 py-2 bg-indigo-600 text-white font-medium rounded-xl hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 transition-all shadow-sm"
                    >
                      {loadingGuidelines ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          Searching...
                        </>
                      ) : (
                        <>
                          <Search className="w-4 h-4" />
                          Search
                        </>
                      )}
                    </button>
                  </div>
                </div>

                <div className="flex-1 overflow-y-auto p-4 bg-slate-50/50">
                  {loadingGuidelines ? (
                    <div className="flex flex-col items-center justify-center h-64 text-slate-500">
                      <Loader2 className="w-8 h-8 animate-spin text-indigo-600 mb-3" />
                      <p className="animate-pulse">Analyzing clinical protocols...</p>
                    </div>
                  ) : guidelineResults.length > 0 ? (
                    <div className="space-y-4">
                      {guidelineResults.map((result, idx) => (
                        <div key={idx} className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm hover:shadow-md transition-all hover:border-indigo-200 group">
                          <div className="flex items-start justify-between mb-3">
                            <div className="flex items-center gap-2">
                              <span className="w-6 h-6 rounded-full bg-indigo-50 text-indigo-600 flex items-center justify-center text-xs font-bold">
                                {idx + 1}
                              </span>
                              <h4 className="font-semibold text-slate-900 group-hover:text-indigo-700 transition-colors">
                                {result.source || 'Clinical Guideline'}
                              </h4>
                            </div>
                            {result.confidence && (
                              <span className={`text-xs font-medium px-2.5 py-1 rounded-full border ${
                                result.confidence > 0.8 ? 'bg-emerald-50 text-emerald-700 border-emerald-100' :
                                result.confidence > 0.5 ? 'bg-amber-50 text-amber-700 border-amber-100' :
                                'bg-red-50 text-red-700 border-red-100'
                              }`}>
                                {Math.round(result.confidence * 100)}% Match
                              </span>
                            )}
                          </div>
                          
                          <p className="text-slate-600 text-sm leading-relaxed whitespace-pre-wrap mb-4 pl-8">
                            {result.text}
                          </p>
                          
                          <div className="pl-8 space-y-3">
                            {result.recommendation && (
                              <div className="p-3 bg-indigo-50 border border-indigo-100 rounded-lg">
                                <h5 className="text-xs font-bold text-indigo-800 uppercase tracking-wide mb-1 flex items-center gap-1">
                                  <Sparkles className="w-3 h-3" />
                                  Recommendation
                                </h5>
                                <p className="text-sm text-indigo-900">{result.recommendation}</p>
                              </div>
                            )}

                            {result.url && (
                              <a 
                                href={result.url} 
                                target="_blank" 
                                rel="noopener noreferrer" 
                                className="inline-flex items-center text-xs text-slate-500 hover:text-indigo-600 font-medium hover:underline transition-colors"
                              >
                                <BookOpen className="w-3 h-3 mr-1.5" />
                                View Source Document
                              </a>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center h-64 text-slate-400">
                      <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mb-4">
                        <Brain className="w-8 h-8 text-slate-300" />
                      </div>
                      <p className="text-lg font-medium text-slate-600">No guidelines found</p>
                      <p className="text-sm">Try searching for specific ocular conditions or treatments</p>
                    </div>
                  )}
                </div>
                
                <div className="p-3 bg-slate-50 border-t border-slate-200 text-center">
                  <p className="text-xs text-slate-500">
                    AI-generated results. Always verify with official AAO/local protocols.
                  </p>
                </div>
              </div>
            </div>
          </ModalPortal>
        )}

        <section>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-4">
            {summaryCards.map((card) => (
              <div
                key={card.title}
                className={`rounded-2xl border-4 border-sky-400 bg-gradient-to-br from-sky-500 via-indigo-500 to-blue-600 shadow-lg p-5 flex items-center justify-between text-white`}
              >
                <div>
                  <p className="text-sm text-white/80">{card.title}</p>
                  <p className="text-3xl font-semibold mt-1">{card.value}</p>
                </div>
                <div className="p-3 rounded-xl bg-white/20">
                  <card.icon className="w-6 h-6" />
                </div>
              </div>
            ))}
          </div>

          <div className="mt-4 grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4">
              <div className="flex items-center justify-between mb-3">
                <h2 className="font-semibold text-slate-800 flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-indigo-600" />
                  Upcoming Follow-Ups
                </h2>
                <button
                  onClick={() => loadSummary()}
                  className="inline-flex items-center gap-1 text-xs text-indigo-600 hover:text-indigo-700"
                >
                  <RefreshCw className="w-3 h-3" />
                  Refresh
                </button>
              </div>
              <div className="space-y-3 max-h-48 overflow-y-auto pr-1">
                {(dashboardSummary?.upcomingFollowUps ?? []).map((followUp) => (
                  <div key={followUp.id} className="p-3 rounded-xl bg-slate-50 border border-slate-100">
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-medium text-slate-800">{followUp.patient_name ?? 'Patient'}</span>
                      <span className="text-xs text-slate-500">{formatDateTime(followUp.scheduled_date)}</span>
                    </div>
                    <p className="text-xs text-slate-500 mt-1">
                      Reason: {followUp.reason ?? '—'} | Priority: {followUp.priority ?? 'routine'}
                    </p>
                  </div>
                ))}
                {!dashboardSummary?.upcomingFollowUps?.length && (
                  <p className="text-sm text-slate-400">No follow-ups scheduled.</p>
                )}
              </div>
            </div>

            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4">
              <h2 className="font-semibold text-slate-800 flex items-center gap-2 mb-3">
                <TestTube className="w-4 h-4 text-emerald-600" />
                Recent Procedures (180 days)
              </h2>
              <div className="space-y-2">
                {(dashboardSummary?.procedureSummary ?? []).map((item) => (
                  <div key={`${item.procedure_name}-${item.eye}`} className="flex items-center justify-between text-sm">
                    <span className="text-slate-600">
                      {item.procedure_name} • {item.eye ?? '—'}
                    </span>
                    <span className="text-slate-900 font-medium">{item.count}</span>
                  </div>
                ))}
                {!dashboardSummary?.procedureSummary?.length && (
                  <p className="text-sm text-slate-400">No recent procedures recorded.</p>
                )}
              </div>
            </div>
          </div>
        </section>

        <section className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 bg-white border border-slate-200 rounded-2xl shadow-sm">
            <div className="p-4 border-b border-slate-100 flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold text-slate-900 flex items-center gap-2">
                  <NotebookPen className="w-5 h-5 text-indigo-600" />
                  Ophthalmology Encounters
                </h2>
                <p className="text-sm text-slate-500">Filter encounters to review exam data and visit summaries.</p>
              </div>
              <div className="flex items-center gap-2">
                <div className="relative">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    value={filters.search}
                    onChange={(event) => setFilters((prev) => ({ ...prev, search: event.target.value }))}
                    placeholder="Search patient name or number"
                    className="pl-9 pr-3 py-2 text-sm border border-slate-200 rounded-lg"
                  />
                </div>
                <select
                  value={filters.type ?? ''}
                  onChange={(event) => {
                    const value = event.target.value || null;
                    setFilters((prev) => ({ ...prev, type: value }));
                    loadEncounters(filters.search, value);
                  }}
                  className="border border-slate-200 rounded-lg px-3 py-2 text-sm"
                >
                  <option value="">All types</option>
                  <option value="comprehensive_exam">Comprehensive</option>
                  <option value="follow_up">Follow-Up</option>
                  <option value="pre_op">Pre-Op</option>
                  <option value="post_op">Post-Op</option>
                  <option value="emergency">Emergency</option>
                  <option value="other">Other</option>
                </select>
                <button
                  onClick={() => setModalState({ type: 'createEncounter' })}
                  className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 text-sm"
                >
                  <Plus className="w-4 h-4" />
                  New Encounter
                </button>
              </div>
            </div>

            <div className="overflow-hidden">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                    <th className="px-4 py-3">Patient</th>
                    <th className="px-4 py-3">Encounter</th>
                    <th className="px-4 py-3">Ophthalmologist</th>
                    <th className="px-4 py-3">Assessment</th>
                    <th className="px-4 py-3 w-32">Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {encountersLoading && (
                    <tr>
                      <td colSpan={5} className="px-4 py-6 text-center text-slate-400">
                        Loading ophthalmology encounters...
                      </td>
                    </tr>
                  )}
                  {!encountersLoading && encounters.length === 0 && (
                    <tr>
                      <td colSpan={5} className="px-4 py-6 text-center text-slate-400">
                        No ophthalmology encounters found.
                      </td>
                    </tr>
                  )}
                  {encounters.map((encounter) => {
                    const awaitingPayment = encounter.payment_status === 'awaiting_payment';
                    const fee =
                      encounter.fee_amount ?? null;
                    return (
                      <tr
                        key={encounter.id}
                        className={`hover:bg-indigo-50/50 cursor-pointer transition ${
                          selectedEncounterId === encounter.id ? 'bg-indigo-50/80' : ''
                        }`}
                        onClick={() => handleEncounterSelect(encounter.id)}
                      >
                        <td className="px-4 py-3">
                          <div className="font-medium text-slate-800">{encounter.patient_name ?? 'Unknown patient'}</div>
                          <div className="text-xs text-slate-400">{encounter.patient_number}</div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="text-slate-800">
                            {ENCOUNTER_TYPE_LABELS[encounter.encounter_type] ?? encounter.encounter_type}
                          </div>
                          <div className="text-xs text-slate-400">
                            {encounter.chief_complaint ?? 'No complaint recorded'}
                          </div>
                          <div className="mt-1 flex flex-wrap items-center gap-2 text-xs">
                            <span
                              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border ${
                                awaitingPayment
                                  ? 'bg-amber-100 text-amber-700 border-amber-200'
                                  : 'bg-emerald-100 text-emerald-700 border-emerald-200'
                              }`}
                            >
                              <CreditCard className="w-3 h-3" />
                              {String(encounter.payment_status || 'payment_confirmed').replace(/_/g, ' ')}
                            </span>
                            {fee !== null && !Number.isNaN(Number(fee)) && (
                              <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 border border-blue-200 font-medium">
                                ${Number(fee).toFixed(2)}
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-slate-600">
                          {encounter.ophthalmologist_name ?? 'Unassigned'}
                        </td>
                        <td className="px-4 py-3 text-slate-600 truncate max-w-xs">
                          {encounter.assessment ?? '—'}
                        </td>
                        <td className="px-4 py-3 text-slate-600">{formatDateTime(encounter.encounter_date)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          <aside className="bg-white border border-slate-200 rounded-2xl shadow-sm p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-slate-900 flex items-center gap-2">
                <Plus className="w-5 h-5 text-indigo-500" />
                Quick Actions
              </h2>
            </div>
            {encounterLocked && (
              <div className="p-3 border border-amber-200 bg-amber-50 text-amber-800 text-sm rounded-lg flex gap-2">
                <CreditCard className="w-4 h-4 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="font-semibold">Awaiting payment</p>
                  <p>
                    Accounts must confirm payment before charting can continue for this encounter.
                  </p>
                </div>
              </div>
            )}
            <div className="grid grid-cols-1 gap-3">
              <button
                onClick={() => setModalState({ type: 'createEncounter' })}
                className="p-4 rounded-xl border border-slate-200 hover:border-indigo-300 hover:bg-indigo-50/60 text-left"
              >
                <p className="text-sm font-semibold text-slate-800">Start new encounter</p>
                <p className="text-xs text-slate-500 mt-1">Document a new eye clinic visit.</p>
              </button>
              {selectedEncounterId && encounterDetail ? (
                <>
                  <button
                    onClick={() =>
                      !encounterLocked && setModalState({ type: 'visualAcuity', encounterId: selectedEncounterId })
                    }
                    disabled={encounterLocked}
                    className={`p-4 rounded-xl border border-slate-200 text-left ${
                      encounterLocked
                        ? 'opacity-50 cursor-not-allowed'
                        : 'hover:border-blue-300 hover:bg-blue-50/60'
                    }`}
                  >
                    <p className="text-sm font-semibold text-slate-800">Visual acuity</p>
                    <p className="text-xs text-slate-500 mt-1">Capture unaided/aided vision.</p>
                  </button>
                  <button
                    onClick={() =>
                      !encounterLocked && setModalState({ type: 'refraction', encounterId: selectedEncounterId })
                    }
                    disabled={encounterLocked}
                    className={`p-4 rounded-xl border border-slate-200 text-left ${
                      encounterLocked
                        ? 'opacity-50 cursor-not-allowed'
                        : 'hover:border-emerald-300 hover:bg-emerald-50/60'
                    }`}
                  >
                    <p className="text-sm font-semibold text-slate-800">Refraction</p>
                    <p className="text-xs text-slate-500 mt-1">Record sphere, cylinder, axis, add.</p>
                  </button>
                  <button
                    onClick={() =>
                      !encounterLocked && setModalState({ type: 'slitLamp', encounterId: selectedEncounterId })
                    }
                    disabled={encounterLocked}
                    className={`p-4 rounded-xl border border-slate-200 text-left ${
                      encounterLocked
                        ? 'opacity-50 cursor-not-allowed'
                        : 'hover:border-amber-300 hover:bg-amber-50/60'
                    }`}
                  >
                    <p className="text-sm font-semibold text-slate-800">Slit-lamp finding</p>
                    <p className="text-xs text-slate-500 mt-1">Document anterior/posterior segment.</p>
                  </button>
                  <button
                    onClick={() => !encounterLocked && setModalState({ type: 'oct', encounterId: selectedEncounterId })}
                    disabled={encounterLocked}
                    className={`p-4 rounded-xl border border-slate-200 text-left ${
                      encounterLocked
                        ? 'opacity-50 cursor-not-allowed'
                        : 'hover:border-purple-300 hover:bg-purple-50/60'
                    }`}
                  >
                    <p className="text-sm font-semibold text-slate-800">Link OCT imaging</p>
                    <p className="text-xs text-slate-500 mt-1">Attach macula/RNFL studies.</p>
                  </button>
                  <button
                    onClick={() =>
                      setModalState({
                        type: 'followUp',
                        encounterId: selectedEncounterId,
                        patientId: encounterDetail.encounter.patient_id,
                      })
                    }
                    className={`p-4 rounded-xl border border-slate-200 text-left ${
                      encounterLocked
                        ? 'opacity-50 cursor-not-allowed'
                        : 'hover:border-indigo-300 hover:bg-indigo-50/60'
                    }`}
                    disabled={encounterLocked}
                  >
                    <p className="text-sm font-semibold text-slate-800">Schedule follow-up</p>
                    <p className="text-xs text-slate-500 mt-1">Ensure continuity and monitoring.</p>
                  </button>
                  <button
                    onClick={() =>
                      setModalState({
                        type: 'procedure',
                        encounterId: selectedEncounterId,
                        patientId: encounterDetail.encounter.patient_id,
                      })
                    }
                    className={`p-4 rounded-xl border border-slate-200 text-left ${
                      encounterLocked
                        ? 'opacity-50 cursor-not-allowed'
                        : 'hover:border-rose-300 hover:bg-rose-50/60'
                    }`}
                    disabled={encounterLocked}
                  >
                    <p className="text-sm font-semibold text-slate-800">Record procedure</p>
                    <p className="text-xs text-slate-500 mt-1">Document surgeries, lasers, injections.</p>
                  </button>
                </>
              ) : (
                <div className="p-4 rounded-xl border border-dashed border-slate-200 text-center text-sm text-slate-400">
                  Select an encounter to unlock charting actions.
                </div>
              )}
            </div>
          </aside>
        </section>

        <section className="bg-white border border-slate-200 rounded-2xl shadow-sm p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-lg font-semibold text-slate-900">Encounter Detail</h2>
              <p className="text-sm text-slate-500">
                Detailed exam findings, investigations, and scheduled follow-ups.
              </p>
            </div>
          </div>

          {!selectedEncounterId && (
            <div className="flex flex-col items-center justify-center h-48 text-slate-400">
              <EyeOff className="w-10 h-10 mb-2" />
              <p>Select an ophthalmology encounter to view full details.</p>
            </div>
          )}

          {selectedEncounterId && detailLoading && (
            <div className="flex flex-col items-center justify-center h-48 text-slate-400">
              <RefreshCw className="w-10 h-10 mb-2 animate-spin" />
              <p>Loading encounter details...</p>
            </div>
          )}

          {selectedEncounterId && encounterDetail && !detailLoading && (
            <div className="space-y-6">
              {encounterLocked && (
                <div className="p-3 border border-amber-200 bg-amber-50 text-amber-800 text-sm rounded-lg flex gap-2">
                  <CreditCard className="w-4 h-4 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="font-semibold">Payment pending</p>
                    <p>
                      Clinical charting is locked until Accounts confirms payment for this encounter.
                      {encounterFeeAmount
                        ? ` Outstanding fee: $${Number(encounterFeeAmount).toFixed(2)}.`
                        : ''}
                    </p>
                    {encounterDetail.encounter.finance_transaction_id && (
                      <p className="text-xs text-amber-700 mt-1">
                        Finance reference:{' '}
                        <span className="font-mono">
                          {encounterDetail.encounter.finance_transaction_id}
                        </span>
                      </p>
                    )}
                  </div>
                </div>
              )}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-slate-50 border border-slate-200 rounded-xl p-4">
                <div>
                  <h3 className="text-sm font-semibold text-slate-700">Patient</h3>
                  <p className="text-slate-900 font-medium mt-1">
                    {encounterDetail.encounter.patient_name ?? 'Unknown'} ({encounterDetail.encounter.patient_number ?? '—'})
                  </p>
                  <p className="text-xs text-slate-500 mt-1">
                    DOB: {formatDateOnly(encounterDetail.encounter.date_of_birth)} • Phone: {encounterDetail.encounter.phone ?? '—'}
                  </p>
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-slate-700">Encounter Summary</h3>
                  <p className="text-slate-900 mt-1">
                    {ENCOUNTER_TYPE_LABELS[encounterDetail.encounter.encounter_type] ??
                      encounterDetail.encounter.encounter_type}
                  </p>
                  <p className="text-xs text-slate-500 mt-1">
                    Ophthalmologist: {encounterDetail.encounter.ophthalmologist_name ?? 'Unassigned'}
                  </p>
                  <p className="text-xs text-slate-500 mt-1">Date: {formatDateTime(encounterDetail.encounter.encounter_date)}</p>
                  <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
                    <span
                      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border ${
                        encounterLocked
                          ? 'bg-amber-100 text-amber-700 border-amber-200'
                          : 'bg-emerald-100 text-emerald-700 border-emerald-200'
                      }`}
                    >
                      <CreditCard className="w-3 h-3" />
                      {String(encounterDetail.encounter.payment_status || 'payment_confirmed').replace(/_/g, ' ')}
                    </span>
                    {encounterFeeAmount !== null && !Number.isNaN(Number(encounterFeeAmount)) && (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 border border-blue-200 font-medium">
                        ${Number(encounterFeeAmount).toFixed(2)}
                      </span>
                    )}
                  </div>
                </div>
                {encounterDetail.encounter.chief_complaint && (
                  <div className="md:col-span-2">
                    <h3 className="text-sm font-semibold text-slate-700">Chief Complaint</h3>
                    <p className="text-sm text-slate-600 mt-1">{encounterDetail.encounter.chief_complaint}</p>
                  </div>
                )}
                {encounterDetail.encounter.assessment && (
                  <div className="md:col-span-2">
                    <h3 className="text-sm font-semibold text-slate-700">Assessment & Plan</h3>
                    <p className="text-sm text-slate-600 mt-1 whitespace-pre-wrap">
                      {encounterDetail.encounter.assessment}
                    </p>
                    {encounterDetail.encounter.plan && (
                      <p className="text-xs text-slate-500 mt-2 whitespace-pre-wrap">
                        Plan: {encounterDetail.encounter.plan}
                      </p>
                    )}
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="border border-slate-200 rounded-xl p-4">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-sm font-semibold text-slate-700">Visual Acuity</h3>
                    <button
                      onClick={() =>
                        !encounterLocked && setModalState({ type: 'visualAcuity', encounterId: selectedEncounterId })
                      }
                      disabled={encounterLocked}
                      className="inline-flex items-center gap-1 text-xs px-2 py-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-100 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      Add
                    </button>
                  </div>
                  <div className="space-y-2">
                    {encounterDetail.visualAcuity?.length ? (
                      encounterDetail.visualAcuity.map((entry) => (
                        <div key={entry.id} className="text-sm text-slate-600 border border-slate-100 rounded-lg p-2">
                          <div className="flex items-center justify-between">
                            <span className="font-medium">{entry.eye}</span>
                            <span className="text-xs text-slate-400">{formatDateTime(entry.created_at)}</span>
                          </div>
                          <p className="text-xs text-slate-500 mt-1">
                            Distance: {entry.distance_aided ?? '—'} (aided) / {entry.distance_unaided ?? '—'} (unaided)
                          </p>
                          <p className="text-xs text-slate-500">
                            Near: {entry.near_aided ?? '—'} (aided) / {entry.near_unaided ?? '—'} (unaided)
                          </p>
                          {entry.pinhole && <p className="text-xs text-slate-500">Pinhole: {entry.pinhole}</p>}
                          {entry.notes && <p className="text-xs text-slate-400 mt-1">{entry.notes}</p>}
                        </div>
                      ))
                    ) : (
                      <p className="text-sm text-slate-400">No visual acuity data recorded.</p>
                    )}
                  </div>
                </div>

                <div className="border border-slate-200 rounded-xl p-4">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-sm font-semibold text-slate-700">Refraction</h3>
                    <button
                      onClick={() =>
                        !encounterLocked && setModalState({ type: 'refraction', encounterId: selectedEncounterId })
                      }
                      disabled={encounterLocked}
                      className="inline-flex items-center gap-1 text-xs px-2 py-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-100 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      Add
                    </button>
                  </div>
                  <div className="space-y-2">
                    {encounterDetail.refraction?.length ? (
                      encounterDetail.refraction.map((entry) => (
                        <div key={entry.id} className="text-sm text-slate-600 border border-slate-100 rounded-lg p-2">
                          <div className="flex items-center justify-between">
                            <span className="font-medium">{entry.eye}</span>
                            <span className="text-xs text-slate-400">{formatDateTime(entry.created_at)}</span>
                          </div>
                          <p className="text-xs text-slate-500 mt-1">
                            Sphere {entry.sphere ?? '—'} • Cylinder {entry.cylinder ?? '—'} @ {entry.axis ?? '—'}°
                          </p>
                          <p className="text-xs text-slate-500">Add: {entry.add_power ?? '—'} • Corrected VA: {entry.corrected_va ?? '—'}</p>
                          {entry.notes && <p className="text-xs text-slate-400 mt-1">{entry.notes}</p>}
                        </div>
                      ))
                    ) : (
                      <p className="text-sm text-slate-400">No refraction data recorded.</p>
                    )}
                  </div>
                </div>

                <div className="border border-slate-200 rounded-xl p-4">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-sm font-semibold text-slate-700">Slit-Lamp Findings</h3>
                    <button
                      onClick={() =>
                        !encounterLocked && setModalState({ type: 'slitLamp', encounterId: selectedEncounterId })
                      }
                      disabled={encounterLocked}
                      className="inline-flex items-center gap-1 text-xs px-2 py-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-100 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      Add
                    </button>
                  </div>
                  <div className="space-y-2 max-h-40 overflow-y-auto pr-1">
                    {encounterDetail.slitLamp?.length ? (
                      encounterDetail.slitLamp.map((entry) => (
                        <div key={entry.id} className="text-sm text-slate-600 border border-slate-100 rounded-lg p-2">
                          <div className="flex items-center justify-between">
                            <span className="font-medium">{entry.structure}</span>
                            <span className="text-xs text-slate-400">{formatDateTime(entry.created_at)}</span>
                          </div>
                          <p className="text-xs text-slate-500 mt-1">{entry.observation}</p>
                          {entry.severity && <p className="text-xs text-slate-400">Severity: {entry.severity}</p>}
                        </div>
                      ))
                    ) : (
                      <p className="text-sm text-slate-400">No slit-lamp findings recorded.</p>
                    )}
                  </div>
                </div>

                <div className="border border-slate-200 rounded-xl p-4">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-sm font-semibold text-slate-700">OCT Imaging</h3>
                    <button
                      onClick={() => !encounterLocked && setModalState({ type: 'oct', encounterId: selectedEncounterId })}
                      disabled={encounterLocked}
                      className="inline-flex items-center gap-1 text-xs px-2 py-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-100 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      Add
                    </button>
                  </div>
                  <div className="space-y-2">
                    {encounterDetail.octStudies?.length ? (
                      encounterDetail.octStudies.map((entry) => (
                        <div key={entry.id} className="text-sm text-slate-600 border border-slate-100 rounded-lg p-2">
                          <div className="flex items-center justify-between">
                            <span className="font-medium">{entry.eye}</span>
                            <span className="text-xs text-slate-400">{formatDateTime(entry.study_date)}</span>
                          </div>
                          <p className="text-xs text-slate-500 mt-1">
                            {entry.study_name ?? 'OCT study'} {entry.order_number ? `(${entry.order_number})` : ''}
                          </p>
                          {entry.interpretation && <p className="text-xs text-slate-400 mt-1">{entry.interpretation}</p>}
                          {entry.image_reference && (
                            <p className="text-xs text-indigo-500 mt-1 truncate">{entry.image_reference}</p>
                          )}
                        </div>
                      ))
                    ) : (
                      <p className="text-sm text-slate-400">No OCT studies linked.</p>
                    )}
                  </div>
                </div>
              </div>

              <div className="border border-slate-200 rounded-xl p-4">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-sm font-semibold text-slate-700">Follow-Ups</h3>
                  <button
                    onClick={() =>
                      !encounterLocked &&
                      setModalState({
                        type: 'followUp',
                        encounterId: selectedEncounterId,
                        patientId: encounterDetail.encounter.patient_id,
                      })
                    }
                    disabled={encounterLocked}
                    className="inline-flex items-center gap-1 text-xs px-2 py-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-100 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Schedule
                  </button>
                </div>
                <div className="space-y-2">
                  {encounterDetail.followUps?.length ? (
                    encounterDetail.followUps.map((followUp) => (
                      <div key={followUp.id} className="text-sm text-slate-600 border border-slate-100 rounded-lg p-2">
                        <div className="flex items-center justify-between">
                          <span className="font-medium capitalize">{followUp.status ?? 'scheduled'}</span>
                          <span className="text-xs text-slate-400">{formatDateTime(followUp.scheduled_date)}</span>
                        </div>
                        <p className="text-xs text-slate-500 mt-1">Reason: {followUp.reason ?? '—'}</p>
                        <p className="text-xs text-slate-500">Priority: {followUp.priority ?? 'routine'}</p>
                      </div>
                    ))
                  ) : (
                    <p className="text-sm text-slate-400">No follow-ups scheduled for this encounter.</p>
                  )}
                </div>
              </div>
            </div>
          )}
        </section>
      </main>

      {Dialog}
      {renderModal()}

      {/* WHO Smart Forms Floating Button */}
      {tenantSlug && token && (
        <SmartFormsFloatingButton
          token={token || ''}
          tenantSlug={tenantSlug}
          moduleFilter="clinical"
          position="bottom-right"
        />
      )}
    </div>
  );
};

export default OphthalmologyDashboard;
