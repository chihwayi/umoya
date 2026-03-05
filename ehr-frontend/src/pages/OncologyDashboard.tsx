import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Activity,
  AlertTriangle,
  Calendar,
  ClipboardList,
  FlaskConical,
  Layers,
  LogOut,
  Microscope,
  Plus,
  RefreshCw,
  Stethoscope,
  CreditCard,
  Users2,
  X,
  Zap,
  ArrowLeft,
  Brain,
  BookOpen,
  Search,
} from 'lucide-react';
import { format } from 'date-fns';
import { ehrApi, cdssApi } from '../services/api';
import { useNotification } from '../components/GlobalNotification';
import ModalPortal from '../components/ModalPortal';
import OncologyResponseAssessment from '../components/OncologyResponseAssessment';
import OncologySurvivorshipPlan from '../components/OncologySurvivorshipPlan';
import OncologyClinicalTrials from '../components/OncologyClinicalTrials';
import OncologyPROs from '../components/OncologyPROs';
import OncologyGenomicData from '../components/OncologyGenomicData';
import OncologyAnalyticsPanel from '../components/OncologyAnalyticsPanel';
import OncologyIntelligencePanel from '../components/OncologyIntelligencePanel';
import OncologyFinancialToxicity from '../components/OncologyFinancialToxicity';
import OncologyTimeline from '../components/OncologyTimeline';
import OncologyResponseCharts from '../components/OncologyResponseCharts';
import OncologyBiomarkerDashboard from '../components/OncologyBiomarkerDashboard';
import OncologySurvivorshipDashboard from '../components/OncologySurvivorshipDashboard';
import SnomedConceptPicker, { SnomedConcept } from '../components/SnomedConceptPicker';
import { SmartFormsFloatingButton } from '../components/WHOSmartForms';
import { GuidelineResult } from '../types/guidelines';

type OncologyCase = {
  id: string;
  patient_id: string;
  patient_name?: string;
  patient_number?: string;
  primary_diagnosis: string;
  primary_diagnosis_snomed_code?: string | null;
  primary_diagnosis_snomed_term?: string | null;
  diagnosis_date?: string;
  overall_stage?: string;
  stage_at_diagnosis?: string;
  oncologist_name?: string;
  oncologist_id?: string | null;
  status: string;
  updated_at?: string;
  active_regimens?: number;
  active_adverse_events?: number;
};

type OncologyCaseDetail = {
  case: OncologyCase & {
    care_plan?: string;
    primary_site?: string;
    histology?: string;
  };
  stagingEntries: any[];
  regimens: any[];
  infusionSessions: any[];
  adverseEvents: any[];
  tumorBoardRecommendations: any[];
};

type OncologyDashboardSummary = {
  caseTotals?: {
    total_cases?: string;
    active_cases?: string;
    in_remission?: string;
    follow_up_cases?: string;
    deceased_cases?: string;
  };
  statusBreakdown?: Array<{ status: string; count: string }>;
  upcomingInfusions?: any[];
  adverseEventSummary?: any[];
  financeSummary?: {
    awaiting_payment_sessions?: string;
    cleared_sessions?: string;
    total_sessions?: string;
  };
  diagnosisDistribution?: Array<{ term: string; concept_id?: string | null; count: number }>;
  regimenMix?: Array<{ term: string; concept_id?: string | null; count: number }>;
  snomedAdverseEvents?: Array<{ term: string; concept_id?: string | null; grade?: string | null; count: number }>;
};

type ModalState =
  | { type: 'createCase' }
  | { type: 'addStaging'; caseId: string }
  | { type: 'addRegimen'; caseId: string }
  | { type: 'addInfusion'; regimenId: string }
  | { type: 'addAdverseEvent'; caseId: string }
  | { type: 'createTumorBoard' }
  | { type: 'addTumorRecommendation'; meetingId: string }
  | null;

const STATUS_BADGE: Record<string, string> = {
  active: 'bg-emerald-100 text-emerald-700',
  in_remission: 'bg-blue-100 text-blue-700',
  follow_up: 'bg-amber-100 text-amber-700',
  completed_therapy: 'bg-slate-100 text-slate-700',
  deceased: 'bg-rose-100 text-rose-700',
  transferred_out: 'bg-purple-100 text-purple-700',
};

const OncologyDashboard: React.FC = () => {
  const { tenantSlug } = useParams<{ tenantSlug: string }>();
  const navigate = useNavigate();
  const { showError, showSuccess, showInfo } = useNotification();

  const [currentUser, setCurrentUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [casesLoading, setCasesLoading] = useState(false);
  const [cases, setCases] = useState<OncologyCase[]>([]);
  const [filters, setFilters] = useState<{ status: string | null }>({ status: 'active' });
  const [selectedCaseId, setSelectedCaseId] = useState<string | null>(null);
  const [caseDetail, setCaseDetail] = useState<OncologyCaseDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [dashboardSummary, setDashboardSummary] = useState<OncologyDashboardSummary | null>(null);
  const [modalState, setModalState] = useState<ModalState>(null);
  const [submitting, setSubmitting] = useState(false);
  const [tumorBoardMeetings, setTumorBoardMeetings] = useState<any[]>([]);

  // CDSS Guideline Search State
  const [showGuidelineSearch, setShowGuidelineSearch] = useState(false);
  const [guidelineQuery, setGuidelineQuery] = useState('');
  const [guidelineResults, setGuidelineResults] = useState<GuidelineResult[]>([]);
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

  const token = useMemo(() => {
    if (typeof window === 'undefined') {
      return null;
    }
    return localStorage.getItem('ehr_token');
  }, []);
  const [primaryDiagnosisConcept, setPrimaryDiagnosisConcept] = useState<SnomedConcept | null>(null);
  const [regimenConcept, setRegimenConcept] = useState<SnomedConcept | null>(null);
  const [adverseEventConcept, setAdverseEventConcept] = useState<SnomedConcept | null>(null);
  const [createCasePatientContext, setCreateCasePatientContext] = useState<any | null>(null);
  const [loadingCreateCasePatientContext, setLoadingCreateCasePatientContext] = useState(false);
  const primaryDiagnosisInputRef = useRef<HTMLInputElement | null>(null);
  const diagnosisDateInputRef = useRef<HTMLInputElement | null>(null);
  const oncologistIdInputRef = useRef<HTMLInputElement | null>(null);
  const carePlanInputRef = useRef<HTMLTextAreaElement | null>(null);
  const regimenNameInputRef = useRef<HTMLInputElement | null>(null);
  const adverseEventInputRef = useRef<HTMLInputElement | null>(null);

  const ensureAuth = useCallback(() => {
    if (!token || !tenantSlug) {
      showError('Session expired', 'Please log in again to continue.');
      navigate(`/ehr/${tenantSlug ?? ''}`);
      return false;
    }
    return true;
  }, [navigate, showError, tenantSlug, token]);

  const loadSummary = useCallback(async () => {
    if (!ensureAuth()) return;
    try {
      const response = await ehrApi.getOncologyDashboardSummary(tenantSlug!, token!);
      const data = response.data || {};
      const normalizeDistribution = (array: any[]): Array<{ term: string; concept_id?: string | null; count: number }> =>
        Array.isArray(array)
          ? array
              .map((item: any) => ({
                term: item?.term ?? 'Unlabeled concept',
                concept_id: item?.concept_id ?? null,
                count: Number(item?.count ?? 0),
              }))
              .filter((item) => item.count > 0)
          : [];
      const diagnosisDistribution = normalizeDistribution(data.diagnosisDistribution);
      const regimenMix = normalizeDistribution(data.regimenMix);
      const snomedAdverseEvents = Array.isArray(data.snomedAdverseEvents)
        ? data.snomedAdverseEvents
            .map((item: any) => ({
              term: item?.term ?? 'Adverse event',
              concept_id: item?.concept_id ?? null,
              grade: item?.grade ?? null,
              count: Number(item?.count ?? 0),
            }))
            .filter((item: { count: number; }) => item.count > 0)
        : [];

      setDashboardSummary({
        ...data,
        diagnosisDistribution,
        regimenMix,
        snomedAdverseEvents,
      });
    } catch (error) {
      console.error('Failed to load oncology summary', error);
      showError('Unable to load dashboard insights', 'Please try again later.');
    }
  }, [ensureAuth, showError, tenantSlug, token]);

  const loadTumorBoardMeetings = useCallback(async () => {
    if (!ensureAuth()) return;
    try {
      const response = await ehrApi.getTumorBoardMeetings(tenantSlug!, token!);
      setTumorBoardMeetings(Array.isArray(response.data?.meetings) ? response.data.meetings : []);
    } catch (error) {
      console.error('Failed to load tumor board meetings', error);
      showError('Unable to load tumor board meetings', 'Tumor board features may be limited.');
    }
  }, [ensureAuth, showError, tenantSlug, token]);

  const loadCases = useCallback(
    async (statusFilter: string | null = filters.status) => {
      if (!ensureAuth()) return;
      setCasesLoading(true);
      try {
        const params = statusFilter ? { status: statusFilter } : {};
        const response = await ehrApi.getOncologyCases(tenantSlug!, token!, params);
        setCases(Array.isArray(response.data?.cases) ? response.data.cases : []);
      } catch (error) {
        console.error('Failed to load oncology cases', error);
        showError('Unable to load oncology cases', 'Please retry shortly.');
      } finally {
        setCasesLoading(false);
      }
    },
    [ensureAuth, filters.status, showError, tenantSlug, token],
  );

  const loadCaseDetail = useCallback(
    async (caseId: string) => {
      if (!ensureAuth()) return;
      setDetailLoading(true);
      try {
        const response = await ehrApi.getOncologyCaseDetail(tenantSlug!, token!, caseId);
        setCaseDetail(response.data);
      } catch (error) {
        console.error('Failed to load oncology case detail', error);
        showError('Unable to load case details', 'Please try again.');
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
    if (!modalState) {
      setPrimaryDiagnosisConcept(null);
      setRegimenConcept(null);
      setAdverseEventConcept(null);
      setCreateCasePatientContext(null);
      setLoadingCreateCasePatientContext(false);
    }
    if (modalState && modalState.type !== 'createCase') {
      setCreateCasePatientContext(null);
      setLoadingCreateCasePatientContext(false);
    }
  }, [modalState]);

  const loadCreateCasePatientContext = useCallback(
    async (rawPatientId: string) => {
      if (!ensureAuth()) return;
      const patientId = String(rawPatientId || '').trim();
      if (!patientId) {
        setCreateCasePatientContext(null);
        return;
      }

      try {
        setLoadingCreateCasePatientContext(true);
        const response = await ehrApi.getPatientContext(patientId, token!, tenantSlug!);
        const context = response.data || null;
        setCreateCasePatientContext(context);

        const suggestedDiagnosisDate =
          context?.modules?.oncology?.latestCase?.diagnosis_date ||
          context?.modules?.hiv?.latestEnrollment?.date_confirmed_positive ||
          '';
        if (diagnosisDateInputRef.current && !diagnosisDateInputRef.current.value && suggestedDiagnosisDate) {
          diagnosisDateInputRef.current.value = String(suggestedDiagnosisDate).slice(0, 10);
        }

        if (oncologistIdInputRef.current && !oncologistIdInputRef.current.value && currentUser?.id) {
          oncologistIdInputRef.current.value = currentUser.id;
        }

        if (carePlanInputRef.current && !carePlanInputRef.current.value) {
          const lines: string[] = [];
          const hivEnrollment = context?.modules?.hiv?.latestEnrollment;
          const maternityEnrollment = context?.modules?.maternity?.latestEnrollment;
          const oncologyCase = context?.modules?.oncology?.latestCase;
          const latestVitals = context?.latestVitals;

          if (hivEnrollment?.enrollment_number) {
            lines.push(
              `HIV: ${hivEnrollment.enrollment_status || 'unknown'} enrollment ${hivEnrollment.enrollment_number}`,
            );
          }
          if (maternityEnrollment?.enrollment_number) {
            lines.push(
              `Maternity: ${maternityEnrollment.enrollment_status || 'unknown'} enrollment ${maternityEnrollment.enrollment_number}`,
            );
          }
          if (oncologyCase?.id) {
            lines.push(`Previous oncology case: ${oncologyCase.id} (${oncologyCase.status || 'unknown'})`);
          }
          if (latestVitals?.recordedAt) {
            lines.push(`Latest vitals captured: ${String(latestVitals.recordedAt).slice(0, 10)}`);
          }

          if (lines.length) {
            carePlanInputRef.current.value = `Auto context summary:\n- ${lines.join('\n- ')}`;
          }
        }
      } catch (error) {
        console.error('Failed to load patient context for oncology case creation', error);
        setCreateCasePatientContext(null);
        showError('Unable to load patient context', 'Confirm patient ID or retry.');
      } finally {
        setLoadingCreateCasePatientContext(false);
      }
    },
    [currentUser?.id, ensureAuth, showError, tenantSlug, token],
  );

  useEffect(() => {
    const initialize = async () => {
      setLoading(true);
      await Promise.all([loadSummary(), loadCases(filters.status), loadTumorBoardMeetings()]);
      setLoading(false);
    };
    initialize();
  }, [filters.status, loadCases, loadSummary, loadTumorBoardMeetings]);

  const handleCaseSelect = (caseId: string) => {
    setSelectedCaseId(caseId);
    loadCaseDetail(caseId);
  };

  const handleLogout = () => {
    localStorage.removeItem('ehr_token');
    localStorage.removeItem('ehr_user');
    localStorage.removeItem('ehr_tenant');
    showInfo('Logged out', 'Hope to see you soon.');
    navigate(`/ehr/${tenantSlug ?? ''}`);
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!modalState || !ensureAuth()) return;
    const formData = new FormData(event.currentTarget);
    setSubmitting(true);
    try {
      switch (modalState.type) {
        case 'createCase': {
          const payload: any = {
            patient_id: formData.get('patient_id'),
            primary_diagnosis: formData.get('primary_diagnosis'),
            staging_system: formData.get('staging_system') || null,
            overall_stage: formData.get('overall_stage') || null,
            stage_at_diagnosis: formData.get('stage_at_diagnosis') || null,
            diagnosis_date: formData.get('diagnosis_date') || null,
            primary_site: formData.get('primary_site') || null,
            histology: formData.get('histology') || null,
            oncologist_id: formData.get('oncologist_id') || null,
            status: formData.get('status') || 'active',
            care_plan: formData.get('care_plan') || null,
          };
          if (primaryDiagnosisConcept) {
            payload.primary_diagnosis_concept = primaryDiagnosisConcept;
          }
          await ehrApi.createOncologyCase(tenantSlug!, token!, payload);
          showSuccess('Oncology case created', 'Case has been added to the registry.');
          await loadCases(filters.status);
          await loadSummary();
          break;
        }
        case 'addStaging': {
          const payload = {
            staging_system: formData.get('staging_system'),
            t_stage: formData.get('t_stage') || null,
            n_stage: formData.get('n_stage') || null,
            m_stage: formData.get('m_stage') || null,
            overall_stage: formData.get('overall_stage') || null,
            stage_date: formData.get('stage_date'),
            performance_status: formData.get('performance_status') || null,
            notes: formData.get('notes') || null,
          };
          await ehrApi.addOncologyStagingEntry(tenantSlug!, token!, modalState.caseId, payload);
          showSuccess('Staging entry saved', 'Staging record has been added.');
          if (selectedCaseId) {
            await loadCaseDetail(selectedCaseId);
          }
          break;
        }
        case 'addRegimen': {
          const payload: any = {
            regimen_name: formData.get('regimen_name'),
            line_of_therapy: formData.get('line_of_therapy') || null,
            intent: formData.get('intent') || null,
            cycles_planned: formData.get('cycles_planned') ? Number(formData.get('cycles_planned')) : null,
            start_date: formData.get('start_date') || null,
            end_date: formData.get('end_date') || null,
            status: formData.get('status') || 'planned',
            regimen_details: formData.get('regimen_details')
              ? JSON.parse(formData.get('regimen_details') as string)
              : null,
          };
          if (regimenConcept) {
            payload.regimen_concept = regimenConcept;
          }
          await ehrApi.createOncologyRegimen(tenantSlug!, token!, modalState.caseId, payload);
          showSuccess('Regimen created', 'Therapy regimen has been recorded.');
          if (selectedCaseId) {
            await loadCaseDetail(selectedCaseId);
          }
          break;
        }
        case 'addInfusion': {
          const payload = {
            cycle_number: formData.get('cycle_number') ? Number(formData.get('cycle_number')) : null,
            session_date: formData.get('session_date'),
            location: formData.get('location') || null,
            vitals: formData.get('vitals') ? JSON.parse(formData.get('vitals') as string) : null,
            drugs_administered: formData.get('drugs_administered')
              ? JSON.parse(formData.get('drugs_administered') as string)
              : null,
            premedications: formData.get('premedications')
              ? JSON.parse(formData.get('premedications') as string)
              : null,
            toxicities: formData.get('toxicities')
              ? JSON.parse(formData.get('toxicities') as string)
              : null,
            status: formData.get('status') || 'scheduled',
            notes: formData.get('notes') || null,
            fee_amount: formData.get('fee_amount')
              ? Number(formData.get('fee_amount'))
              : null,
          };
          await ehrApi.createOncologyInfusionSession(tenantSlug!, token!, modalState.regimenId, payload);
          showSuccess(
            'Infusion Session Recorded',
            'Accounts will unlock the session once payment is confirmed.'
          );
          if (selectedCaseId) {
            await loadCaseDetail(selectedCaseId);
          }
          break;
        }
        case 'addAdverseEvent': {
          const payload: any = {
            regimen_id: formData.get('regimen_id') || null,
            event_date: formData.get('event_date'),
            event_type: formData.get('event_type'),
            grade: formData.get('grade') || null,
            related_to: formData.get('related_to') || null,
            action_taken: formData.get('action_taken') || null,
            outcome: formData.get('outcome') || null,
            resolved_date: formData.get('resolved_date') || null,
            notes: formData.get('notes') || null,
          };
          if (adverseEventConcept) {
            payload.event_concept = adverseEventConcept;
          }
          await ehrApi.recordOncologyAdverseEvent(tenantSlug!, token!, modalState.caseId, payload);
          showSuccess('Adverse event recorded', 'Event has been captured.');
          if (selectedCaseId) {
            await loadCaseDetail(selectedCaseId);
          }
          break;
        }
        case 'createTumorBoard': {
          const payload = {
            meeting_date: formData.get('meeting_date'),
            facilitator: formData.get('facilitator') || null,
            location: formData.get('location') || null,
            agenda: formData.get('agenda') || null,
          };
          await ehrApi.createTumorBoardMeeting(tenantSlug!, token!, payload);
          showSuccess('Tumor board meeting scheduled', 'Meeting has been added.');
          await loadSummary();
          await loadTumorBoardMeetings();
          break;
        }
        case 'addTumorRecommendation': {
          const meetingId = formData.get('meeting_id');
          if (!meetingId) {
            showError('Missing meeting', 'Please choose a tumor board meeting.');
            setSubmitting(false);
            return;
          }
          const payload = {
            oncology_case_id: formData.get('oncology_case_id'),
            recommendation: formData.get('recommendation'),
            follow_up_actions: formData.get('follow_up_actions') || null,
            responsible_team: formData.get('responsible_team') || null,
            due_date: formData.get('due_date') || null,
            status: formData.get('status') || 'pending',
          };
          await ehrApi.addTumorBoardRecommendation(tenantSlug!, token!, meetingId as string, payload);
          showSuccess('Tumor board recommendation added', 'Recommendation saved.');
          if (selectedCaseId) {
            await loadCaseDetail(selectedCaseId);
          }
          break;
        }
        default:
          break;
      }
      setModalState(null);
    } catch (error) {
      console.error('Failed to submit oncology form', error);
      showError('Operation failed', 'Please check your input and try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const summaryCards = useMemo(() => {
    const totals = dashboardSummary?.caseTotals;
    const finance = dashboardSummary?.financeSummary;
    return [
      {
        title: 'Total Cases',
        value: totals?.total_cases ?? '0',
        icon: Stethoscope,
        gradient: 'from-blue-500 to-indigo-500',
      },
      {
        title: 'Active Therapy',
        value: totals?.active_cases ?? '0',
        icon: Activity,
        gradient: 'from-emerald-500 to-teal-500',
      },
      {
        title: 'In Remission',
        value: totals?.in_remission ?? '0',
        icon: Users2,
        gradient: 'from-purple-500 to-fuchsia-500',
      },
      {
        title: 'Follow-up',
        value: totals?.follow_up_cases ?? '0',
        icon: RefreshCw,
        gradient: 'from-amber-500 to-orange-500',
      },
      {
        title: 'Awaiting Payment',
        value: finance?.awaiting_payment_sessions ?? '0',
        icon: CreditCard,
        gradient: 'from-rose-500 to-amber-500',
      },
    ];
  }, [dashboardSummary]);

  const renderModal = () => {
    if (!modalState) return null;

    const closeModal = () => {
      if (!submitting) {
        setModalState(null);
      }
    };

    const renderHeader = (title: string, subtitle?: string) => (
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-xl font-semibold text-slate-900">{title}</h3>
          {subtitle && <p className="text-sm text-slate-500 mt-1">{subtitle}</p>}
        </div>
        <button
          type="button"
          className="p-2 rounded-full bg-slate-100 hover:bg-slate-200"
          onClick={closeModal}
        >
          <X className="w-5 h-5 text-slate-600" />
        </button>
      </div>
    );

    const submitLabel = submitting ? 'Saving...' : 'Save';

    const renderJsonHint = (label: string) => (
      <p className="text-xs text-slate-400 mt-1">
        {label} (provide valid JSON, e.g. <code>[&#123;&quot;drug&quot;:&quot;cisplatin&quot;&#125;]</code>)
      </p>
    );

    return (
      <ModalPortal>
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center px-4">
          <div className="w-full max-w-3xl bg-white rounded-2xl shadow-2xl p-6 max-h-[90vh] overflow-y-auto border border-slate-100">
            <form onSubmit={handleSubmit} className="space-y-4">
              {modalState.type === 'createCase' && (
                <>
                  {renderHeader('Create Oncology Case', 'Register a new oncology patient record')}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Patient ID</label>
                      <input
                        name="patient_id"
                        required
                        className="w-full border rounded-lg px-3 py-2"
                        placeholder="UUID"
                        onBlur={(event) => loadCreateCasePatientContext(event.target.value)}
                      />
                      <p className="text-xs text-slate-500 mt-1">
                        Enter patient ID once. Existing profile/HIV/maternity context will auto-fill where possible.
                      </p>
                      {loadingCreateCasePatientContext && (
                        <p className="text-xs text-indigo-600 mt-1">Loading reusable patient context...</p>
                      )}
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Primary Diagnosis</label>
                      {token && (
                        <div className="mb-2">
                          <SnomedConceptPicker
                            value={primaryDiagnosisConcept}
                            onChange={(concept) => {
                              setPrimaryDiagnosisConcept(concept);
                              if (concept && primaryDiagnosisInputRef.current) {
                                primaryDiagnosisInputRef.current.value =
                                  concept.preferredTerm || concept.term || '';
                              }
                            }}
                            token={token}
                            tenantSlug={tenantSlug!}
                            label=""
                            placeholder="Search SNOMED CT (e.g., Invasive ductal carcinoma)"
                            helperText="Adds a coded primary diagnosis"
                            context="condition"
                          />
                        </div>
                      )}
                      <input
                        name="primary_diagnosis"
                        required
                        ref={primaryDiagnosisInputRef}
                        className="w-full border rounded-lg px-3 py-2"
                        placeholder="e.g. Breast carcinoma"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Diagnosis Date</label>
                      <input
                        type="date"
                        name="diagnosis_date"
                        ref={diagnosisDateInputRef}
                        className="w-full border rounded-lg px-3 py-2"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Staging System</label>
                      <input
                        name="staging_system"
                        className="w-full border rounded-lg px-3 py-2"
                        placeholder="e.g. AJCC 8th"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Overall Stage</label>
                      <input
                        name="overall_stage"
                        className="w-full border rounded-lg px-3 py-2"
                        placeholder="e.g. Stage IIIB"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Stage at Diagnosis</label>
                      <input
                        name="stage_at_diagnosis"
                        className="w-full border rounded-lg px-3 py-2"
                        placeholder="Stage III"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Primary Site</label>
                      <input name="primary_site" className="w-full border rounded-lg px-3 py-2" placeholder="Organ/site" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Histology</label>
                      <input name="histology" className="w-full border rounded-lg px-3 py-2" placeholder="Histology type" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Oncologist ID</label>
                      <input
                        name="oncologist_id"
                        ref={oncologistIdInputRef}
                        defaultValue={currentUser?.id || ''}
                        className="w-full border rounded-lg px-3 py-2"
                        placeholder="UUID"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Status</label>
                      <select name="status" className="w-full border rounded-lg px-3 py-2">
                        <option value="active">Active</option>
                        <option value="in_remission">In Remission</option>
                        <option value="completed_therapy">Completed Therapy</option>
                        <option value="follow_up">Follow-up</option>
                        <option value="deceased">Deceased</option>
                        <option value="transferred_out">Transferred Out</option>
                      </select>
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Care Plan / Notes</label>
                    <textarea
                      name="care_plan"
                      ref={carePlanInputRef}
                      rows={4}
                      className="w-full border rounded-lg px-3 py-2"
                      placeholder="Outline the high-level care plan, goals, genetics, molecular markers..."
                    />
                  </div>
                  {createCasePatientContext && (
                    <div className="rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-2 text-sm text-indigo-900">
                      Context loaded for{' '}
                      <span className="font-semibold">
                        {createCasePatientContext?.patient?.fullName || 'patient'}
                      </span>
                      {createCasePatientContext?.modules?.hiv?.latestEnrollment?.enrollment_number
                        ? ` • HIV ${createCasePatientContext.modules.hiv.latestEnrollment.enrollment_number}`
                        : ''}
                      {createCasePatientContext?.modules?.maternity?.latestEnrollment?.enrollment_number
                        ? ` • Maternity ${createCasePatientContext.modules.maternity.latestEnrollment.enrollment_number}`
                        : ''}
                      {createCasePatientContext?.latestVitals?.recordedAt
                        ? ` • Vitals ${String(createCasePatientContext.latestVitals.recordedAt).slice(0, 10)}`
                        : ''}.
                    </div>
                  )}
                </>
              )}

              {modalState.type === 'addStaging' && (
                <>
                  {renderHeader('Record Staging Assessment')}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Staging System</label>
                      <input name="staging_system" required className="w-full border rounded-lg px-3 py-2" placeholder="e.g. AJCC 8th" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Stage Date</label>
                      <input type="date" name="stage_date" required className="w-full border rounded-lg px-3 py-2" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">T Stage</label>
                      <input name="t_stage" className="w-full border rounded-lg px-3 py-2" placeholder="e.g. T3" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">N Stage</label>
                      <input name="n_stage" className="w-full border rounded-lg px-3 py-2" placeholder="e.g. N1" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">M Stage</label>
                      <input name="m_stage" className="w-full border rounded-lg px-3 py-2" placeholder="e.g. M0" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Overall Stage</label>
                      <input name="overall_stage" className="w-full border rounded-lg px-3 py-2" placeholder="Stage IIIB" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Performance Status</label>
                      <input name="performance_status" className="w-full border rounded-lg px-3 py-2" placeholder="e.g. ECOG 1" />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Notes</label>
                    <textarea
                      name="notes"
                      rows={3}
                      className="w-full border rounded-lg px-3 py-2"
                      placeholder="Document staging rationale, imaging findings, biomarkers..."
                    />
                  </div>
                </>
              )}

              {modalState.type === 'addRegimen' && (
                <>
                  {renderHeader('Create Systemic Therapy Regimen')}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Regimen Name</label>
                      {token && (
                        <div className="mb-2">
                          <SnomedConceptPicker
                            value={regimenConcept}
                            onChange={(concept) => {
                              setRegimenConcept(concept);
                              if (concept && regimenNameInputRef.current) {
                                regimenNameInputRef.current.value =
                                  concept.preferredTerm || concept.term || '';
                              }
                            }}
                            token={token}
                            tenantSlug={tenantSlug!}
                            label=""
                            placeholder="Search SNOMED CT (e.g., Chemotherapy regimen)"
                            helperText="Optional SNOMED coding for regimen"
                            context="procedure"
                          />
                        </div>
                      )}
                      <input
                        name="regimen_name"
                        required
                        ref={regimenNameInputRef}
                        className="w-full border rounded-lg px-3 py-2"
                        placeholder="e.g. FOLFOX"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Line of Therapy</label>
                      <input name="line_of_therapy" className="w-full border rounded-lg px-3 py-2" placeholder="e.g. 1st line" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Intent</label>
                      <select name="intent" className="w-full border rounded-lg px-3 py-2">
                        <option value="">Select intent</option>
                        <option value="curative">Curative</option>
                        <option value="adjuvant">Adjuvant</option>
                        <option value="neoadjuvant">Neoadjuvant</option>
                        <option value="palliative">Palliative</option>
                        <option value="maintenance">Maintenance</option>
                        <option value="other">Other</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Cycles Planned</label>
                      <input type="number" name="cycles_planned" className="w-full border rounded-lg px-3 py-2" min={1} />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Start Date</label>
                      <input type="date" name="start_date" className="w-full border rounded-lg px-3 py-2" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">End Date</label>
                      <input type="date" name="end_date" className="w-full border rounded-lg px-3 py-2" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Status</label>
                      <select name="status" className="w-full border rounded-lg px-3 py-2">
                        <option value="planned">Planned</option>
                        <option value="active">Active</option>
                        <option value="completed">Completed</option>
                        <option value="paused">Paused</option>
                        <option value="cancelled">Cancelled</option>
                      </select>
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Regimen Details (JSON)</label>
                    <textarea
                      name="regimen_details"
                      rows={3}
                      className="w-full border rounded-lg px-3 py-2 font-mono text-sm"
                      placeholder='e.g. [{"drug":"Oxaliplatin","dose":"85mg/m2","day":1}]'
                    />
                    {renderJsonHint('Drugs, scheduling, supportive care')}
                  </div>
                </>
              )}

              {modalState.type === 'addInfusion' && (
                <>
                  {renderHeader('Add Infusion Session')}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Cycle Number</label>
                      <input type="number" name="cycle_number" className="w-full border rounded-lg px-3 py-2" min={1} />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Session Date & Time</label>
                      <input type="datetime-local" name="session_date" required className="w-full border rounded-lg px-3 py-2" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Location</label>
                      <input name="location" className="w-full border rounded-lg px-3 py-2" placeholder="e.g. Day chemo suite" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Status</label>
                      <select name="status" className="w-full border rounded-lg px-3 py-2">
                        <option value="scheduled">Scheduled</option>
                        <option value="in_progress">In Progress</option>
                        <option value="completed">Completed</option>
                        <option value="cancelled">Cancelled</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Estimated Fee (USD)</label>
                      <input
                        type="number"
                        step="0.01"
                        name="fee_amount"
                        className="w-full border rounded-lg px-3 py-2"
                        placeholder="e.g. 120.00"
                      />
                      <p className="mt-1 text-xs text-slate-500">
                        Leave blank to use the default infusion tariff.
                      </p>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Vitals (JSON)</label>
                      <textarea
                        name="vitals"
                        rows={2}
                        className="w-full border rounded-lg px-3 py-2 font-mono text-sm"
                        placeholder='{"bp":"120/70","pulse":78}'
                      />
                      {renderJsonHint('Pre infusion vitals, weight, labs')}
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Drugs Administered (JSON)</label>
                      <textarea
                        name="drugs_administered"
                        rows={2}
                        className="w-full border rounded-lg px-3 py-2 font-mono text-sm"
                        placeholder='[{"drug":"Paclitaxel","dose":"175mg/m2","route":"IV"}]'
                      />
                      {renderJsonHint('Doses, dilutions, infusion durations')}
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Premedications (JSON)</label>
                      <textarea
                        name="premedications"
                        rows={2}
                        className="w-full border rounded-lg px-3 py-2 font-mono text-sm"
                        placeholder='[{"drug":"Dexamethasone","dose":"12mg"}]'
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Toxicities (JSON)</label>
                      <textarea
                        name="toxicities"
                        rows={2}
                        className="w-full border rounded-lg px-3 py-2 font-mono text-sm"
                        placeholder='[{"toxicity":"Nausea","grade":"2"}]'
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Notes</label>
                    <textarea
                      name="notes"
                      rows={3}
                      className="w-full border rounded-lg px-3 py-2"
                      placeholder="Document infusion tolerance, delays, hydration, patient education..."
                    />
                  </div>
                  <div className="mt-4 p-3 border border-amber-200 bg-amber-50 text-amber-800 text-sm rounded-lg flex gap-2">
                    <CreditCard className="w-4 h-4 mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="font-semibold">Finance clearance required</p>
                      <p>
                        Infusion sessions remain locked in the oncology worklist until Accounts confirms payment. Capture the estimated session fee so billing can reconcile quickly.
                      </p>
                    </div>
                  </div>
                </>
              )}

              {modalState.type === 'addAdverseEvent' && (
                <>
                  {renderHeader('Capture Adverse Event')}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Event Date & Time</label>
                      <input type="datetime-local" name="event_date" required className="w-full border rounded-lg px-3 py-2" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Regimen ID (optional)</label>
                      <input name="regimen_id" className="w-full border rounded-lg px-3 py-2" placeholder="UUID" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Event Type</label>
                      {token && (
                        <div className="mb-2">
                          <SnomedConceptPicker
                            value={adverseEventConcept}
                            onChange={(concept) => {
                              setAdverseEventConcept(concept);
                              if (concept && adverseEventInputRef.current) {
                                adverseEventInputRef.current.value =
                                  concept.preferredTerm || concept.term || '';
                              }
                            }}
                            token={token}
                            tenantSlug={tenantSlug!}
                            label=""
                            placeholder="Search SNOMED CT (e.g., Neutropenic sepsis)"
                            helperText="Capture structured adverse event codes"
                            context="condition"
                          />
                        </div>
                      )}
                      <input
                        name="event_type"
                        required
                        ref={adverseEventInputRef}
                        className="w-full border rounded-lg px-3 py-2"
                        placeholder="e.g. Febrile neutropenia"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Grade</label>
                      <input name="grade" className="w-full border rounded-lg px-3 py-2" placeholder="e.g. CTCAE Grade 3" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Related To</label>
                      <input name="related_to" className="w-full border rounded-lg px-3 py-2" placeholder="Drug, procedure..." />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Resolved Date</label>
                      <input type="date" name="resolved_date" className="w-full border rounded-lg px-3 py-2" />
                    </div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Action Taken</label>
                      <textarea
                        name="action_taken"
                        rows={3}
                        className="w-full border rounded-lg px-3 py-2"
                        placeholder="Dose reduction, growth factor, admission..."
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Outcome</label>
                      <textarea
                        name="outcome"
                        rows={3}
                        className="w-full border rounded-lg px-3 py-2"
                        placeholder="Resolved, ongoing, new baseline..."
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Notes</label>
                    <textarea
                      name="notes"
                      rows={3}
                      className="w-full border rounded-lg px-3 py-2"
                      placeholder="Narrative, supportive measures, monitoring plan..."
                    />
                  </div>
                </>
              )}

              {modalState.type === 'createTumorBoard' && (
                <>
                  {renderHeader('Schedule Tumor Board Meeting')}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Meeting Date & Time</label>
                      <input type="datetime-local" name="meeting_date" required className="w-full border rounded-lg px-3 py-2" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Facilitator User ID</label>
                      <input name="facilitator" className="w-full border rounded-lg px-3 py-2" placeholder="UUID" />
                    </div>
                    <div className="md:col-span-2">
                      <label className="block text-sm font-medium text-slate-700 mb-1">Location / Modality</label>
                      <input
                        name="location"
                        className="w-full border rounded-lg px-3 py-2"
                        placeholder="e.g. MDT Room 3 / Teams"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Agenda</label>
                    <textarea
                      name="agenda"
                      rows={3}
                      className="w-full border rounded-lg px-3 py-2"
                      placeholder="List cases to discuss, objectives, documentation expectations..."
                    />
                  </div>
                </>
              )}

              {modalState.type === 'addTumorRecommendation' && (
                <>
                  {renderHeader('Add Tumor Board Recommendation')}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Tumor Board Meeting</label>
                      <select name="meeting_id" required className="w-full border rounded-lg px-3 py-2">
                        <option value="">Select meeting</option>
                        {tumorBoardMeetings.map((meeting) => (
                          <option key={meeting.id} value={meeting.id}>
                            {formatDateTime(meeting.meeting_date)} • {meeting.location ?? 'Meeting'}
                          </option>
                        ))}
                      </select>
                      {!tumorBoardMeetings.length && (
                        <p className="text-xs text-amber-500 mt-1">
                          No meetings available. Create a tumor board meeting first.
                        </p>
                      )}
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Oncology Case ID</label>
                      <input name="oncology_case_id" required className="w-full border rounded-lg px-3 py-2" placeholder="UUID" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Due Date</label>
                      <input type="date" name="due_date" className="w-full border rounded-lg px-3 py-2" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Responsible Team</label>
                      <input
                        name="responsible_team"
                        className="w-full border rounded-lg px-3 py-2"
                        placeholder="Surgical oncology, radiation, supportive care..."
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Status</label>
                      <select name="status" className="w-full border rounded-lg px-3 py-2">
                        <option value="pending">Pending</option>
                        <option value="in_progress">In Progress</option>
                        <option value="completed">Completed</option>
                        <option value="declined">Declined</option>
                      </select>
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Recommendation</label>
                    <textarea
                      name="recommendation"
                      required
                      rows={3}
                      className="w-full border rounded-lg px-3 py-2"
                      placeholder="Multidisciplinary recommendation summary"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Follow-up Actions</label>
                    <textarea
                      name="follow_up_actions"
                      rows={3}
                      className="w-full border rounded-lg px-3 py-2"
                      placeholder="Orders, consults, imaging, genomic tests..."
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
                  className="px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-60"
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

  const renderStatusBadge = (status: string) => {
    const classes = STATUS_BADGE[status] ?? 'bg-slate-100 text-slate-700';
    return (
      <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium ${classes}`}>
        <span className="w-1.5 h-1.5 rounded-full bg-current" />
        {status.replace(/_/g, ' ')}
      </span>
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

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-gradient-to-r from-purple-700 via-fuchsia-600 to-rose-500 border-b border-fuchsia-400 shadow">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between text-white">
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
                <FlaskConical className="w-6 h-6" />
                Oncology Navigator
              </h1>
              <p className="text-sm text-white/80">
                Tumor registry, systemic therapy, infusion workflows, and adverse event tracking
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

      <main className="max-w-7xl mx-auto px-6 py-8 space-y-8">
        {/* AI Guideline Search - Oncology Context */}
        <div className="bg-white rounded-2xl border border-fuchsia-100 shadow-sm overflow-hidden">
          <div 
            className="p-4 bg-fuchsia-50/50 border-b border-fuchsia-100 flex items-center justify-between cursor-pointer"
            onClick={() => setShowGuidelineSearch(!showGuidelineSearch)}
          >
            <div className="flex items-center gap-2">
              <div className="p-2 bg-fuchsia-100 rounded-lg">
                <Brain className="w-5 h-5 text-fuchsia-600" />
              </div>
              <div>
                <h2 className="font-semibold text-slate-800">Oncology Clinical Guidelines (NCCN/ASCO)</h2>
                <p className="text-xs text-slate-500">AI-powered search for treatment protocols and staging criteria</p>
              </div>
            </div>
            <button className="text-fuchsia-600 hover:bg-fuchsia-100 p-2 rounded-full transition-colors">
              {showGuidelineSearch ? <BookOpen className="w-5 h-5" /> : <Search className="w-5 h-5" />}
            </button>
          </div>
          
          {showGuidelineSearch && (
            <div className="p-4 bg-white animate-in slide-in-from-top-2 duration-200">
              <div className="flex gap-2 mb-4">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input
                    type="text"
                    value={guidelineQuery}
                    onChange={(e) => setGuidelineQuery(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleGuidelineSearch()}
                    placeholder="Search guidelines (e.g., 'Breast cancer adjuvant therapy', 'Lung cancer immunotherapy protocols')..."
                    className="w-full pl-9 pr-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-fuchsia-500"
                  />
                </div>
                <button
                  onClick={handleGuidelineSearch}
                  disabled={loadingGuidelines || !guidelineQuery.trim()}
                  className="px-4 py-2 bg-fuchsia-600 text-white rounded-lg hover:bg-fuchsia-700 disabled:opacity-50 flex items-center gap-2 font-medium transition-colors"
                >
                  {loadingGuidelines ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      <span>Searching...</span>
                    </>
                  ) : (
                    <>
                      <Search className="w-4 h-4" />
                      <span>Find Guidelines</span>
                    </>
                  )}
                </button>
              </div>

              {guidelineResults.length > 0 && (
                <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-2">
                  <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Relevant Citations</h3>
                  {guidelineResults.map((result, idx) => (
                    <div key={idx} className="p-3 bg-slate-50 rounded-lg border border-slate-200 hover:border-fuchsia-200 transition-colors">
                      <div className="flex items-start justify-between mb-2">
                          <h4 className="font-semibold text-slate-900 leading-tight text-sm">{result.source || 'Clinical Guideline'}</h4>
                          {result.confidence && (
                            <span className={`text-xs font-medium px-2 py-0.5 rounded-full border ${
                              result.confidence > 0.8 ? 'bg-emerald-50 text-emerald-700 border-emerald-100' :
                              result.confidence > 0.5 ? 'bg-yellow-50 text-yellow-700 border-yellow-100' :
                              'bg-red-50 text-red-700 border-red-100'
                            }`}>
                              {Math.round(result.confidence * 100)}%
                            </span>
                          )}
                      </div>
                      <p className="text-sm text-slate-700 leading-relaxed mb-2 whitespace-pre-wrap">
                        {result.text}
                      </p>
                      
                      {result.recommendation && (
                        <div className="mb-2 p-2 bg-fuchsia-50 border border-fuchsia-100 rounded-md">
                          <h5 className="text-xs font-bold text-fuchsia-800 uppercase tracking-wide mb-1">Recommendation</h5>
                          <p className="text-sm text-fuchsia-900">{result.recommendation}</p>
                        </div>
                      )}

                      {result.url && (
                         <div className="mt-2">
                            <a href={result.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center text-xs text-fuchsia-600 hover:text-fuchsia-700 font-medium hover:underline">
                              <BookOpen className="w-3 h-3 mr-1" /> View Source
                            </a>
                         </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        <section>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-4">
            {summaryCards.map((card) => (
              <div
                key={card.title}
                className={`rounded-2xl border-4 border-fuchsia-400 bg-gradient-to-br from-purple-600 via-fuchsia-600 to-rose-500 shadow-lg p-5 flex items-center justify-between text-white`}
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
                  <Layers className="w-4 h-4 text-blue-600" />
                  Status Breakdown
                </h2>
                <button
                  onClick={() => loadSummary()}
                  className="inline-flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700"
                >
                  <RefreshCw className="w-3 h-3" />
                  Refresh
                </button>
              </div>
              <dl className="space-y-2">
                {(dashboardSummary?.statusBreakdown ?? []).map((item) => (
                  <div key={item.status} className="flex items-center justify-between text-sm">
                    <dt className="capitalize text-slate-600">{item.status.replace(/_/g, ' ')}</dt>
                    <dd className="font-medium text-slate-900">{item.count}</dd>
                  </div>
                ))}
                {!dashboardSummary?.statusBreakdown?.length && (
                  <p className="text-sm text-slate-400">No oncology cases found.</p>
                )}
              </dl>
            </div>
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4">
              <h2 className="font-semibold text-slate-800 flex items-center gap-2 mb-3">
                <Microscope className="w-4 h-4 text-emerald-600" />
                Upcoming Infusions (14 days)
              </h2>
              <div className="space-y-3 max-h-48 overflow-y-auto pr-1">
                {(dashboardSummary?.upcomingInfusions ?? []).map((session) => (
                  <div key={session.id} className="p-3 rounded-xl bg-slate-50 border border-slate-100">
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-medium text-slate-800">{session.regimen_name}</span>
                      <span className="text-xs text-slate-500">{formatDateTime(session.session_date)}</span>
                    </div>
                    <p className="text-sm text-slate-600 mt-1 flex items-center gap-2">
                      <span className="font-medium">{session.patient_name}</span>
                      <span className="text-xs text-slate-400">Cycle {session.cycle_number ?? '—'}</span>
                    </p>
                  </div>
                ))}
                {!dashboardSummary?.upcomingInfusions?.length && (
                  <p className="text-sm text-slate-400">No upcoming infusion sessions scheduled.</p>
                )}
              </div>
            </div>
          </div>
        </section>

        <section className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-4">
            <h3 className="font-semibold text-slate-900 flex items-center gap-2 mb-3">
              <Stethoscope className="w-4 h-4 text-rose-600" />
              Top SNOMED Diagnoses
            </h3>
            <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
              {(dashboardSummary?.diagnosisDistribution ?? []).map((item, index) => (
                <div key={`${item.concept_id ?? item.term}-${index}`} className="flex items-center justify-between text-sm">
                  <div>
                    <p className="font-medium text-slate-800">{item.term}</p>
                    <p className="text-xs text-slate-400">{item.concept_id ?? 'Uncoded'}</p>
                  </div>
                  <span className="inline-flex items-center justify-center rounded-full bg-rose-50 px-3 py-1 text-xs font-semibold text-rose-700 border border-rose-100">
                    {item.count}
                  </span>
                </div>
              ))}
              {!dashboardSummary?.diagnosisDistribution?.length && (
                <p className="text-sm text-slate-400">SNOMED-coded diagnoses will appear here once captured.</p>
              )}
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-4">
            <h3 className="font-semibold text-slate-900 flex items-center gap-2 mb-3">
              <Activity className="w-4 h-4 text-emerald-600" />
              Regimen Mix (SNOMED)
            </h3>
            <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
              {(dashboardSummary?.regimenMix ?? []).map((item, index) => (
                <div key={`${item.concept_id ?? item.term}-${index}`} className="flex items-center justify-between text-sm">
                  <div>
                    <p className="font-medium text-slate-800">{item.term}</p>
                    <p className="text-xs text-slate-400">{item.concept_id ?? 'Uncoded'}</p>
                  </div>
                  <span className="inline-flex items-center justify-center rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700 border border-emerald-100">
                    {item.count}
                  </span>
                </div>
              ))}
              {!dashboardSummary?.regimenMix?.length && (
                <p className="text-sm text-slate-400">Capture SNOMED-coded regimens to populate this panel.</p>
              )}
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-4">
            <h3 className="font-semibold text-slate-900 flex items-center gap-2 mb-3">
              <AlertTriangle className="w-4 h-4 text-amber-600" />
              SNOMED Adverse Events
            </h3>
            <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
              {(dashboardSummary?.snomedAdverseEvents ?? []).map((item, index) => (
                <div key={`${item.concept_id ?? item.term}-${item.grade}-${index}`} className="p-3 rounded-xl border border-amber-100 bg-amber-50">
                  <div className="flex items-center justify-between text-sm text-amber-800">
                    <span className="font-medium">{item.term}</span>
                    <span className="text-xs">Grade {item.grade ?? '—'}</span>
                  </div>
                  <p className="text-xs text-amber-700 mt-1">
                    {item.count} occurrence{item.count === 1 ? '' : 's'} in last 6 months · {item.concept_id ?? 'Uncoded'}
                  </p>
                </div>
              ))}
              {!dashboardSummary?.snomedAdverseEvents?.length && (
                <p className="text-sm text-slate-400">SNOMED-coded adverse events will be summarized here.</p>
              )}
            </div>
          </div>
        </section>

        <section className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 bg-white border border-slate-200 rounded-2xl shadow-sm">
            <div className="p-4 border-b border-slate-100 flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold text-slate-900 flex items-center gap-2">
                  <ClipboardList className="w-5 h-5 text-indigo-600" />
                  Oncology Cases
                </h2>
                <p className="text-sm text-slate-500">Select a case to inspect staging, regimens, AEs, and tumor board notes.</p>
              </div>
              <div className="flex items-center gap-2">
                <select
                  value={filters.status ?? ''}
                  onChange={(event) => {
                    const value = event.target.value;
                    const next = value === '' ? null : value;
                    setFilters({ status: next });
                    loadCases(next);
                  }}
                  className="border border-slate-200 rounded-lg px-3 py-2 text-sm"
                >
                  <option value="">All statuses</option>
                  <option value="active">Active</option>
                  <option value="in_remission">In Remission</option>
                  <option value="completed_therapy">Completed Therapy</option>
                  <option value="follow_up">Follow-up</option>
                  <option value="deceased">Deceased</option>
                  <option value="transferred_out">Transferred Out</option>
                </select>
                <button
                  onClick={() => loadCases(filters.status)}
                  className="inline-flex items-center gap-1 text-sm px-3 py-2 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-100"
                >
                  <RefreshCw className="w-4 h-4" />
                  Refresh
                </button>
                <button
                  onClick={() => setModalState({ type: 'createCase' })}
                  className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700"
                >
                  <Plus className="w-4 h-4" />
                  New Case
                </button>
              </div>
            </div>

            <div className="overflow-hidden">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                    <th className="px-4 py-3">Patient</th>
                    <th className="px-4 py-3">Diagnosis</th>
                    <th className="px-4 py-3">Stage</th>
                    <th className="px-4 py-3">Regimens</th>
                    <th className="px-4 py-3">Adverse Events</th>
                    <th className="px-4 py-3 w-32">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {casesLoading && (
                    <tr>
                      <td colSpan={6} className="px-4 py-6 text-center text-slate-400">
                        Loading oncology cases...
                      </td>
                    </tr>
                  )}
                  {!casesLoading && cases.length === 0 && (
                    <tr>
                      <td colSpan={6} className="px-4 py-6 text-center text-slate-400">
                        No oncology cases available. Create one to get started.
                      </td>
                    </tr>
                  )}
                  {cases.map((caseRow) => (
                    <tr
                      key={caseRow.id}
                      className={`hover:bg-blue-50/50 cursor-pointer transition ${
                        selectedCaseId === caseRow.id ? 'bg-blue-50/80' : ''
                      }`}
                      onClick={() => handleCaseSelect(caseRow.id)}
                    >
                      <td className="px-4 py-3">
                        <div className="font-medium text-slate-800">{caseRow.patient_name ?? 'Unknown patient'}</div>
                        <div className="text-xs text-slate-400">{caseRow.patient_number}</div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="text-slate-800">{caseRow.primary_diagnosis}</div>
                        <div className="text-xs text-slate-400">{formatDateOnly(caseRow.diagnosis_date)}</div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="text-slate-700">{caseRow.overall_stage ?? '—'}</div>
                        <div className="text-xs text-slate-400">
                          {caseRow.stage_at_diagnosis ? `At dx: ${caseRow.stage_at_diagnosis}` : 'No baseline stage'}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-slate-600">{caseRow.active_regimens ?? 0}</td>
                      <td className="px-4 py-3 text-slate-600">{caseRow.active_adverse_events ?? 0}</td>
                      <td className="px-4 py-3">{renderStatusBadge(caseRow.status)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <aside className="bg-white border border-slate-200 rounded-2xl shadow-sm p-4 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-slate-900 flex items-center gap-2">
                <Zap className="w-5 h-5 text-amber-500" />
                Tumor Board Worklist
              </h2>
              <button
                onClick={() => setModalState({ type: 'createTumorBoard' })}
                className="inline-flex items-center gap-1 text-sm px-3 py-1.5 rounded-lg bg-slate-900 text-white hover:bg-slate-800"
              >
                <Plus className="w-4 h-4" />
                Meeting
              </button>
            </div>
            <div className="space-y-3 max-h-64 overflow-y-auto pr-1">
              {(dashboardSummary?.adverseEventSummary ?? []).map((item) => (
                <div key={`${item.event_type}-${item.grade}`} className="p-3 rounded-xl bg-rose-50 border border-rose-100">
                  <div className="flex items-center justify-between text-sm text-rose-700">
                    <span className="font-medium capitalize">{item.event_type || 'Adverse event'}</span>
                    <span className="text-xs">Grade {item.grade ?? '—'}</span>
                  </div>
                  <p className="text-xs text-rose-600 mt-1 flex items-center gap-1">
                    <AlertTriangle className="w-3 h-3" />
                    {item.count} occurrence(s) in last 90 days
                  </p>
                </div>
              ))}
              {!dashboardSummary?.adverseEventSummary?.length && (
                <p className="text-sm text-slate-400">Recent adverse events will surface here for quick safety monitoring.</p>
              )}
            </div>
            <div className="border border-dashed border-slate-200 rounded-xl p-4 text-center">
              <p className="text-sm text-slate-500">
                Need to document a recommendation? Add it from the tumor board summary after selecting a case.
              </p>
            </div>
          </aside>

          {tenantSlug && token && (
            <div className="lg:col-span-3">
              <OncologyAnalyticsPanel
                tenantSlug={tenantSlug as string}
                token={token as string}
                caseContext={
                  selectedCaseId && caseDetail
                    ? {
                        primary_diagnosis: caseDetail.case.primary_diagnosis,
                        overall_stage: caseDetail.case.overall_stage,
                        oncologist_id: (caseDetail.case as any).oncologist_id ?? null,
                      }
                    : undefined
                }
              />
            </div>
          )}
        </section>

        <section className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 bg-white border border-slate-200 rounded-2xl shadow-sm p-5">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-lg font-semibold text-slate-900">Case Detail</h2>
                <p className="text-sm text-slate-500">
                  Detailed staging, regimen, infusion, adverse event, and tumor board history.
                </p>
              </div>
              {selectedCaseId && (
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setModalState({ type: 'addStaging', caseId: selectedCaseId })}
                    className="inline-flex items-center gap-1 px-3 py-2 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-100 text-sm"
                  >
                    <Plus className="w-4 h-4" />
                    Staging
                  </button>
                  <button
                    onClick={() => setModalState({ type: 'addRegimen', caseId: selectedCaseId })}
                    className="inline-flex items-center gap-1 px-3 py-2 rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 text-sm"
                  >
                    <Plus className="w-4 h-4" />
                    Regimen
                  </button>
                  <button
                    onClick={() => setModalState({ type: 'addAdverseEvent', caseId: selectedCaseId })}
                    className="inline-flex items-center gap-1 px-3 py-2 rounded-lg bg-rose-500 text-white hover:bg-rose-600 text-sm"
                  >
                    <AlertTriangle className="w-4 h-4" />
                    Adverse Event
                  </button>
                </div>
              )}
            </div>

            {!selectedCaseId && (
              <div className="flex flex-col items-center justify-center h-48 text-slate-400">
                <Stethoscope className="w-10 h-10 mb-2" />
                <p>Select an oncology case to view details.</p>
              </div>
            )}

            {selectedCaseId && detailLoading && (
              <div className="flex flex-col items-center justify-center h-48 text-slate-400">
                <RefreshCw className="w-10 h-10 mb-2 animate-spin" />
                <p>Loading case details...</p>
              </div>
            )}

            {selectedCaseId && !detailLoading && caseDetail && (
              <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-slate-50 border border-slate-200 rounded-xl p-4">
                  <div>
                    <h3 className="text-sm font-semibold text-slate-700">Diagnosis</h3>
                    <p className="text-slate-900 font-medium mt-1">{caseDetail.case.primary_diagnosis}</p>
                    {caseDetail.case.primary_diagnosis_snomed_term && (
                      <p className="text-xs text-rose-600 mt-1">
                        SNOMED: {caseDetail.case.primary_diagnosis_snomed_term}
                        {caseDetail.case.primary_diagnosis_snomed_code
                          ? ` (${caseDetail.case.primary_diagnosis_snomed_code})`
                          : ''}
                      </p>
                    )}
                    <p className="text-xs text-slate-400 mt-1">
                      Oncologist: {caseDetail.case.oncologist_name ?? 'Unassigned'}
                    </p>
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-slate-700">Staging Snapshot</h3>
                    <p className="text-slate-900 mt-1">
                      Overall: {caseDetail.case.overall_stage ?? '—'}{' '}
                      {caseDetail.case.stage_at_diagnosis ? (
                        <span className="text-xs text-slate-500"> (At DX: {caseDetail.case.stage_at_diagnosis})</span>
                      ) : null}
                    </p>
                    <p className="text-xs text-slate-500 mt-1">
                      Primary Site: {caseDetail.case.primary_site ?? '—'} | Histology: {caseDetail.case.histology ?? '—'}
                    </p>
                  </div>
                  <div className="md:col-span-2">
                    <h3 className="text-sm font-semibold text-slate-700">Care Plan</h3>
                    <p className="text-sm text-slate-600 mt-1 whitespace-pre-wrap">
                      {caseDetail.case.care_plan ?? 'No care plan documented yet.'}
                    </p>
                  </div>
                </div>

                {tenantSlug && token && caseDetail && selectedCaseId && (
                  <>
                    <OncologyTimeline
                      tenantSlug={tenantSlug as string}
                      token={token as string}
                      caseId={selectedCaseId}
                      caseDetail={caseDetail}
                    />
                    <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
                      <div className="xl:col-span-2">
                        <OncologyResponseCharts tenantSlug={tenantSlug as string} token={token as string} caseId={selectedCaseId} />
                      </div>
                      <OncologySurvivorshipDashboard tenantSlug={tenantSlug as string} token={token as string} caseId={selectedCaseId} />
                    </div>
                    <OncologyBiomarkerDashboard tenantSlug={tenantSlug as string} token={token as string} caseId={selectedCaseId} />
                  </>
                )}

                <div>
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-sm font-semibold text-slate-700 uppercase tracking-wide">Staging Timeline</h3>
                  </div>
                  <div className="space-y-3">
                    {caseDetail.stagingEntries?.length ? (
                      caseDetail.stagingEntries.map((entry) => (
                        <div key={entry.id} className="p-3 border border-slate-200 rounded-xl">
                          <div className="flex items-center justify-between text-sm">
                            <div className="font-medium text-slate-800">{entry.staging_system}</div>
                            <div className="text-xs text-slate-400">{formatDateOnly(entry.stage_date)}</div>
                          </div>
                          <p className="text-sm text-slate-600 mt-1">
                            T{entry.t_stage ?? '—'} N{entry.n_stage ?? '—'} M{entry.m_stage ?? '—'} | Overall:{' '}
                            {entry.overall_stage ?? '—'}
                          </p>
                          {entry.performance_status && (
                            <p className="text-xs text-slate-500 mt-1">Performance status: {entry.performance_status}</p>
                          )}
                          {entry.notes && <p className="text-xs text-slate-500 mt-1">{entry.notes}</p>}
                        </div>
                      ))
                    ) : (
                      <p className="text-sm text-slate-400">No staging records yet. Add the first staging assessment.</p>
                    )}
                  </div>
                </div>

                {tenantSlug && token && selectedCaseId && (
                  <div className="border border-slate-200 rounded-2xl p-4 bg-slate-50">
                    <OncologyResponseAssessment
                      tenantSlug={tenantSlug as string}
                      token={token as string}
                      caseId={selectedCaseId}
                      regimens={caseDetail.regimens}
                    />
                  </div>
                )}

                {tenantSlug && token && selectedCaseId && (
                  <div className="border border-slate-200 rounded-2xl p-4 bg-white shadow-sm">
                    <OncologySurvivorshipPlan
                      tenantSlug={tenantSlug as string}
                      token={token as string}
                      caseId={selectedCaseId}
                    />
                  </div>
                )}

                <div>
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-sm font-semibold text-slate-700 uppercase tracking-wide">Regimens & Infusions</h3>
                  </div>
                  <div className="space-y-3">
                    {caseDetail.regimens?.length ? (
                      caseDetail.regimens.map((regimen) => (
                        <div key={regimen.id} className="border border-slate-200 rounded-xl">
                          <div className="p-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
                            <div>
                              <p className="font-medium text-slate-800">{regimen.regimen_name}</p>
                              {regimen.regimen_snomed_term && (
                                <p className="text-[11px] text-indigo-600">
                                  SNOMED: {regimen.regimen_snomed_term}
                                  {regimen.regimen_snomed_code ? ` (${regimen.regimen_snomed_code})` : ''}
                                </p>
                              )}
                              <p className="text-xs text-slate-500">
                                {regimen.intent ? `${regimen.intent} • ` : ''}
                                Cycles planned: {regimen.cycles_planned ?? '—'}
                              </p>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="text-xs text-slate-500">
                                {regimen.upcoming_sessions ?? 0} upcoming / {regimen.completed_sessions ?? 0} completed
                              </span>
                              <button
                                onClick={() => setModalState({ type: 'addInfusion', regimenId: regimen.id })}
                                className="inline-flex items-center gap-1 text-xs px-3 py-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-100"
                              >
                                <Plus className="w-3.5 h-3.5" />
                                Infusion
                              </button>
                            </div>
                          </div>
                          <div className="p-3 space-y-2 max-h-40 overflow-y-auto">
                            {caseDetail.infusionSessions
                              ?.filter((session) => session.regimen_id === regimen.id)
                              .map((session) => {
                                const awaitingPayment = session.payment_status === 'awaiting_payment';
                                const rawFee =
                                  session.fee_amount ??
                                  session.feeAmount ??
                                  session.estimated_fee ??
                                  session.estimatedFee ??
                                  null;
                                const sessionFee =
                                  rawFee !== null && rawFee !== undefined && !Number.isNaN(Number(rawFee))
                                    ? Number(rawFee)
                                    : null;

                                return (
                                  <div
                                    key={session.id}
                                    className="flex flex-col gap-2 border border-slate-200 rounded-lg p-3 bg-white"
                                  >
                                    <div className="flex items-start justify-between gap-3">
                                      <div>
                                        <p className="font-medium text-slate-700">
                                          Cycle {session.cycle_number ?? '—'} • {formatDateTime(session.session_date)}
                                        </p>
                                        {session.notes && (
                                          <p className="text-xs text-slate-500 truncate max-w-sm">{session.notes}</p>
                                        )}
                                      </div>
                                      <div className="flex flex-wrap gap-2 justify-end">
                                        <span className="px-2 py-1 text-xs font-semibold rounded-full bg-slate-100 text-slate-600 border border-slate-200">
                                          {String(session.status || 'scheduled').replace(/_/g, ' ')}
                                        </span>
                                        <span
                                          className={`px-2 py-1 text-xs font-semibold rounded-full border ${
                                            awaitingPayment
                                              ? 'bg-amber-100 text-amber-700 border-amber-200'
                                              : 'bg-emerald-100 text-emerald-700 border-emerald-200'
                                          }`}
                                        >
                                          {String(session.payment_status || 'payment_confirmed').replace(/_/g, ' ')}
                                        </span>
                                        {sessionFee !== null && (
                                          <span className="px-2 py-1 text-xs font-semibold rounded-full bg-blue-100 text-blue-700 border border-blue-200">
                                            ${sessionFee.toFixed(2)}
                                          </span>
                                        )}
                                      </div>
                                    </div>
                                    {awaitingPayment && (
                                      <div className="flex items-start gap-2 p-2 rounded-lg border border-amber-200 bg-amber-50 text-amber-800 text-xs">
                                        <CreditCard className="w-4 h-4 mt-0.5 flex-shrink-0" />
                                        <div>
                                          <p className="font-semibold">Awaiting payment confirmation</p>
                                          <p>
                                            Accounts must confirm payment before this infusion session can proceed in the
                                            oncology worklist.
                                          </p>
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                );
                              })}
                            {!caseDetail.infusionSessions?.some((session) => session.regimen_id === regimen.id) && (
                              <p className="text-xs text-slate-400">No infusion sessions recorded for this regimen.</p>
                            )}
                          </div>
                        </div>
                      ))
                    ) : (
                      <p className="text-sm text-slate-400">
                        No regimens documented yet. Add systemic therapy, targeted therapy, or radiation plans.
                      </p>
                    )}
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-sm font-semibold text-slate-700 uppercase tracking-wide">Adverse Events</h3>
                  </div>
                  <div className="space-y-3">
                    {caseDetail.adverseEvents?.length ? (
                      caseDetail.adverseEvents.map((event) => (
                        <div key={event.id} className="p-3 border border-rose-100 bg-rose-50 rounded-xl">
                          <div className="flex items-center justify-between text-sm text-rose-700">
                            <span className="font-medium capitalize">{event.event_type}</span>
                            <span className="text-xs">{formatDateTime(event.event_date)}</span>
                          </div>
                          {event.event_snomed_term && (
                            <p className="text-[11px] text-rose-700">
                              SNOMED: {event.event_snomed_term}
                              {event.event_snomed_code ? ` (${event.event_snomed_code})` : ''}
                            </p>
                          )}
                          <p className="text-xs text-rose-600 mt-1">
                            Grade {event.grade ?? '—'} • Outcome: {event.outcome ?? '—'}
                          </p>
                          {event.action_taken && (
                            <p className="text-xs text-rose-600 mt-1">Action: {event.action_taken}</p>
                          )}
                          {event.notes && <p className="text-xs text-rose-600 mt-1">{event.notes}</p>}
                        </div>
                      ))
                    ) : (
                      <p className="text-sm text-slate-400">
                        No adverse events recorded yet. Capture toxicities, medication reactions, and hospitalisations here.
                      </p>
                    )}
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-sm font-semibold text-slate-700 uppercase tracking-wide">Tumor Board Recommendations</h3>
                    <button
                      onClick={() =>
                        setModalState({
                          type: 'addTumorRecommendation',
                          meetingId: tumorBoardMeetings[0]?.id ?? '',
                        })
                      }
                      className="inline-flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-100"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      Recommendation
                    </button>
                  </div>
                  <div className="space-y-3">
                    {caseDetail.tumorBoardRecommendations?.length ? (
                      caseDetail.tumorBoardRecommendations.map((recommendation) => (
                        <div key={recommendation.id} className="p-3 border border-slate-200 rounded-xl">
                          <div className="flex items-center justify-between text-sm">
                            <div className="font-medium text-slate-800">{recommendation.recommendation}</div>
                            <span className="text-xs text-slate-500">
                              {formatDateOnly(recommendation.meeting_date)} • {recommendation.status}
                            </span>
                          </div>
                          {recommendation.follow_up_actions && (
                            <p className="text-xs text-slate-500 mt-1">
                              Actions: {recommendation.follow_up_actions}
                            </p>
                          )}
                          {recommendation.due_date && (
                            <p className="text-xs text-slate-400 mt-1">
                              Due: {formatDateOnly(recommendation.due_date)}
                            </p>
                          )}
                        </div>
                      ))
                    ) : (
                      <p className="text-sm text-slate-400">
                        No tumor board recommendations yet. Document multidisciplinary decisions to drive follow-up.
                      </p>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>

          <aside className="bg-white border border-slate-200 rounded-2xl shadow-sm p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-slate-900 flex items-center gap-2">
                <Calendar className="w-5 h-5 text-indigo-500" />
                Quick Actions
              </h2>
            </div>
            <div className="grid grid-cols-1 gap-3">
              <button
                onClick={() => setModalState({ type: 'createCase' })}
                className="p-4 rounded-xl border border-slate-200 hover:border-blue-300 hover:bg-blue-50/60 text-left"
              >
                <p className="text-sm font-semibold text-slate-800">Register new oncology case</p>
                <p className="text-xs text-slate-500 mt-1">Capture diagnosis, staging system, and care intent.</p>
              </button>
              {selectedCaseId ? (
                <>
                  <button
                    onClick={() => setModalState({ type: 'addRegimen', caseId: selectedCaseId })}
                    className="p-4 rounded-xl border border-slate-200 hover:border-emerald-300 hover:bg-emerald-50/60 text-left"
                  >
                    <p className="text-sm font-semibold text-slate-800">Plan systemic therapy</p>
                    <p className="text-xs text-slate-500 mt-1">Document regimens, lines of therapy, cycle intent.</p>
                  </button>
                  <button
                    onClick={() => setModalState({ type: 'addAdverseEvent', caseId: selectedCaseId })}
                    className="p-4 rounded-xl border border-slate-200 hover:border-rose-300 hover:bg-rose-50/60 text-left"
                  >
                    <p className="text-sm font-semibold text-slate-800">Record toxicity/adverse event</p>
                    <p className="text-xs text-slate-500 mt-1">Track CTCAE grade, management, outcomes.</p>
                  </button>
                </>
              ) : (
                <div className="p-4 rounded-xl border border-dashed border-slate-200 text-center text-sm text-slate-400">
                  Select a case to unlock regimen and AE quick actions.
                </div>
              )}
            </div>
          </aside>

          {tenantSlug && token && selectedCaseId && (
            <section className="xl:col-span-3 grid grid-cols-1 xl:grid-cols-3 gap-6">
              <div className="xl:col-span-2 space-y-6">
                <div className="border border-slate-200 rounded-2xl p-4 bg-white shadow-sm">
                  <OncologyClinicalTrials tenantSlug={tenantSlug as string} token={token as string} caseId={selectedCaseId} />
                </div>
                <div className="border border-slate-200 rounded-2xl p-4 bg-white shadow-sm">
                  <OncologyPROs tenantSlug={tenantSlug as string} token={token as string} caseId={selectedCaseId} />
                </div>
              </div>
              <div className="space-y-6">
                <div className="border border-slate-200 rounded-2xl p-4 bg-white shadow-sm">
                  <OncologyGenomicData tenantSlug={tenantSlug as string} token={token as string} caseId={selectedCaseId} />
                </div>
                <OncologyIntelligencePanel tenantSlug={tenantSlug as string} token={token as string} caseId={selectedCaseId} />
                <OncologyFinancialToxicity tenantSlug={tenantSlug as string} token={token as string} caseId={selectedCaseId} />
              </div>
            </section>
          )}
        </section>
      </main>

      {renderModal()}

      {/* WHO Smart Forms Floating Button */}
      {tenantSlug && token && (
        <SmartFormsFloatingButton
          token={token}
          tenantSlug={tenantSlug}
          moduleFilter="clinical"
          position="bottom-right"
        />
      )}
    </div>
  );
};

export default OncologyDashboard;
