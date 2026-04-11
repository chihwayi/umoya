import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import {
  Users, Calendar, Activity, Heart, Thermometer, Droplets, 
  Stethoscope, FileText, Clock, AlertTriangle, CheckCircle,
  Search, RefreshCw, Bell, User, LogOut,
  BarChart3, TestTube, ClipboardList, 
  ChevronDown, Settings, Shield, UserCircle, Menu, X, Package,
  CreditCard, Lock, FolderOpen, Target, LayoutDashboard, Leaf,
  Bed, AlertCircle, BookOpen, Loader2, Sparkles, ArrowDown, Brain
} from 'lucide-react';
import { cdssApi, ehrApi, tenantApi } from '../services/api';
import ModalPortal from '../components/ModalPortal';
import CreatePatientModal from '../components/CreatePatientModal';
import CreateAppointmentModal from '../components/CreateAppointmentModal';
import { useNotification } from '../components/GlobalNotification';
import { formatDateToDDMMYYYY, formatDateTimeToDDMMYYYYHHMM } from '../utils/dateFormatting';
import VitalsPanel from '../components/VitalsPanel';
import TriageQueue from '../components/TriageQueue';
import PatientAssessment from '../components/PatientAssessment';
import NursingNotes from '../components/NursingNotes';
import { NursingIntelligencePanel } from '../components/NursingIntelligencePanel';
import TaskManagement from '../components/TaskManagement';
import PatientSafetyAlerts from '../components/PatientSafetyAlerts';
import HIVNursePanel from '../components/HIVNursePanel';
import HIVTestingComponent from '../components/HIVTestingComponent';
import { HIVTestingWithSmartForms, HIVWorkflowIntegration } from '../components/HIV';
import HIVPatientManagement from '../components/HIVPatientManagement';
import { TBScreeningWithSmartForms } from '../components/TB';
import { MaternityWithSmartForms } from '../components/Maternity';
import CervicalCancerScreeningComponent from '../components/CervicalCancerScreeningComponent';
import HIVQualityMetricsChart from '../components/HIVQualityMetricsChart';
import HIVStockManagement from '../components/HIVStockManagement';
import HivReportsPanel from '../components/HivReportsPanel';
import MaternityDashboard from '../components/MaternityDashboard';
import MentalHealthDashboard from '../components/MentalHealthDashboard';
import CervicalCancerDashboard from '../components/CervicalCancerDashboard';
import FamilyPlanningDashboard from '../components/FamilyPlanningDashboard';
import HypertensionDashboard from '../components/HypertensionDashboard';
import TraditionalMedicineDashboard from '../components/TraditionalMedicineDashboard';
import SharedDocumentsList from '../components/SharedDocumentsList';
import PatientCarePlansView from '../components/PatientCarePlansView';
import LabResultsViewer from '../components/LabResultsViewer';
import NurseCrossModuleEscalations, { NurseCrossModuleFeedItem } from '../components/NurseCrossModuleEscalations';
import { ProactiveAlertBell } from '../components/ProactiveAlertBell';
import PostVisitEscalationQueue from '../components/PostVisitEscalationQueue';
import { GuidelineSearchPanel } from '../components/GuidelineSearchPanel';
import { GuidelineRecommendationCard } from '../components/GuidelineRecommendationCard';
import {
  cacheTenantBranding,
  formatTenantDisplayName,
  getBrandInitials,
  readCachedTenantBranding,
} from '../utils/tenantBranding';
import {
  hasModuleAccess,
  notifyTenantSubscriptionStatus,
  getBillingToneClasses,
} from '../utils/tenantSubscription';

interface Patient {
  id: string;
  patientNumber: string;
  firstName: string;
  lastName: string;
  dateOfBirth: string;
  gender: string;
  phone: string;
  email: string;
  bloodType: string;
  allergies: string;
  chronicConditions: string;
  age?: number;
}

interface Appointment {
  id: string;
  appointmentDate: string;
  durationMinutes: number;
  appointmentType: string;
  status: string;
  reason: string;
  notes: string;
  priorityLevel: string;
  patient: Patient;
  doctor: {
    id: string;
    firstName: string;
    lastName: string;
  };
  paymentStatus?: string;
  financeTransactionId?: string | null;
  feeAmount?: number | null;
  vitals?: {
    bloodPressure: string;
    heartRate: number;
    temperature: number;
    oxygenSaturation: number;
    respiratoryRate: number;
    weight: number;
    height: number;
    bmi: number;
    recordedAt: string;
    recordedBy: string;
  };
}

interface HandoffWorkflowState {
  patientId: string | null;
  status: 'draft' | 'finalized' | 'shared';
  finalized: boolean;
  finalizedAt: string | null;
  finalizedBy: string | null;
  reviewed: boolean;
  reviewedAt: string | null;
  reviewedBy: string | null;
  shared: boolean;
  sharedAt: string | null;
  sharedBy: string | null;
}

interface NurseOutcomeAnalyticsSnapshot {
  generatedAt?: string;
  window?: {
    days?: number;
    since?: string;
    until?: string;
  };
  crossModuleQueue?: {
    totalItems?: number;
    activeItems?: number;
    completedItems?: number;
    completionRatePercent?: number;
    acknowledgementOrCompletionRatePercent?: number;
    pendingOlderThan24h?: number;
    averageActiveAgeHours?: number;
  };
  hivRecommendationExecution?: {
    executedActionsTotal?: number;
    reusedOrIdempotentTotal?: number;
    visitPrepDraftsCreated?: number;
    actionsPerQueueItem?: number;
    executedByAction?: Record<string, number>;
  };
  oncologyRecommendationExecution?: {
    executedActionsTotal?: number;
    reusedOrIdempotentTotal?: number;
    actionsPerQueueItem?: number;
    executedByAction?: Record<string, number>;
  };
  maternityEscalationSla?: {
    unresolvedTasks?: number;
    criticalUnresolved?: number;
    dueSoon?: number;
    breached?: number;
    averageOpenAgeHours?: number;
    oldestOpenAgeHours?: number;
  };
}

interface PostVisitTrialMemoryAnalyticsSnapshot {
  generatedAt?: string;
  trialFunnel?: {
    total?: number;
    enrolled?: number;
    staleProposed?: number;
    staleDeferred?: number;
  };
  companionMemory?: {
    total?: number;
    active?: number;
    retired?: number;
  };
  trialDecisionSla?: {
    breachedEscalations?: number;
    openEscalations?: number;
  };
}

interface PostVisitTrialSlaAccountabilitySnapshot {
  generatedAt?: string;
  summary?: {
    totalEscalations?: number;
    openEscalations?: number;
    breachedOpenEscalations?: number;
    resolvedWithinSlaPercent?: number;
    cliniciansWithAssignments?: number;
  };
  items?: Array<{
    clinician?: {
      id?: string | null;
      firstName?: string | null;
      lastName?: string | null;
      role?: string | null;
    };
    openCount?: number;
    breachedOpenCount?: number;
    resolvedWithinSlaPercent?: number;
  }>;
}

const formatCurrency = (value?: number | null) => {
  if (value === null || value === undefined) return null;
  const numeric = Number(value);
  if (Number.isNaN(numeric)) return null;
  return `$${numeric.toFixed(2)}`;
};

const buildFinanceDetails = (appointment: Appointment) => {
  const details: string[] = [];
  const formattedFee = formatCurrency(appointment.feeAmount ?? null);
  if (formattedFee) {
    details.push(`Fee amount: ${formattedFee}`);
  }
  if (appointment.financeTransactionId) {
    details.push(`Finance reference: ${appointment.financeTransactionId}`);
  }
  return details.join(' • ');
};

const NurseDashboard: React.FC = () => {
  const { tenantSlug } = useParams<{ tenantSlug: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const { showSuccess, showError, showWarning } = useNotification();

  const [tenantInfo, setTenantInfo] = useState<any>(() => {
    const cachedBranding = readCachedTenantBranding(tenantSlug);
    return cachedBranding ? { clinicName: cachedBranding.clinicName, logoUrl: cachedBranding.logoUrl } : null;
  });
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [mhQuickTools, setMhQuickTools] = useState<Array<{ id: string; name: string; languages: string[] }>>([]);
  const [mhQuickTool, setMhQuickTool] = useState('PHQ9');
  const [mhQuickLanguage, setMhQuickLanguage] = useState('en');
  const [mhQuickScore, setMhQuickScore] = useState('');
  const [mhQuickResult, setMhQuickResult] = useState<any | null>(null);
  const [mhQuickSafetyPlan, setMhQuickSafetyPlan] = useState<any | null>(null);
  const [showMentalHealthModal, setShowMentalHealthModal] = useState(false);
  const [mentalHealthInitialTab, setMentalHealthInitialTab] = useState<'overview' | 'screening' | 'mhgap' | 'careplans' | 'followups' | 'crisis' | 'safeplan' | 'meds'>('careplans');
  const [activeTab, setActiveTab] = useState<'dashboard' | 'tasks' | 'cross-module' | 'alerts' | 'copilot-metrics' | 'calendar' | 'patients' | 'queue' | 'orders' | 'notes' | 'testing' | 'hiv-patients' | 'tb-screening' | 'cervical-cancer' | 'quality-metrics' | 'stock-management' | 'ltfu' | 'hiv-reports' | 'who-workflow' | 'maternity' | 'triage' | 'vitals' | 'cervical-screening' | 'family-planning' | 'hypertension' | 'traditional-medicine'>('dashboard');
  const [activeSection, setActiveSection] = useState<'main' | 'hiv' | 'maternity' | 'women-health' | 'ncd'>('main');
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [filteredPatients, setFilteredPatients] = useState<Patient[]>([]);
  const [patientSearchTerm, setPatientSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const patientsPerPage = 12;
  const [notesPreset, setNotesPreset] = useState<'care_plans' | 'medications' | undefined>(undefined);
  const [loading, setLoading] = useState(false);
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
  const [showVitalsModal, setShowVitalsModal] = useState(false);
  const [showAssessmentModal, setShowAssessmentModal] = useState(false);
  const [showCreatePatientModal, setShowCreatePatientModal] = useState(false);
  const [showCreateAppointmentModal, setShowCreateAppointmentModal] = useState(false);
  const [showUserDropdown, setShowUserDropdown] = useState(false);
  const [calendarView, setCalendarView] = useState<'day' | 'week' | 'month'>('day');
  const [calendarDate, setCalendarDate] = useState<Date>(new Date());
  const [draggingAppointmentId, setDraggingAppointmentId] = useState<string | null>(null);
  const [authorizedOrders, setAuthorizedOrders] = useState<any[]>([]);
  const [taskCounts, setTaskCounts] = useState({ pending: 0, inProgress: 0, overdue: 0 });
  const [alertCounts, setAlertCounts] = useState({ active: 0, critical: 0, high: 0 });
  const [crossModuleItems, setCrossModuleItems] = useState<NurseCrossModuleFeedItem[]>([]);
  const [crossModuleSummary, setCrossModuleSummary] = useState({
    total: 0,
    critical: 0,
    high: 0,
    maternity: 0,
    hiv: 0,
    oncology: 0,
    nursing: 0,
    handoff: 0,
    medication: 0,
  });
  const [crossModuleLoading, setCrossModuleLoading] = useState(false);
  const [acknowledgingCrossModuleTaskId, setAcknowledgingCrossModuleTaskId] = useState<string | null>(null);
  const [updatingCrossModuleWorkflowItemId, setUpdatingCrossModuleWorkflowItemId] = useState<string | null>(null);
  const [executingRecommendationActionKey, setExecutingRecommendationActionKey] = useState<string | null>(null);
  const [showExecuteOrderModal, setShowExecuteOrderModal] = useState(false);
  const [executingOrderId, setExecutingOrderId] = useState<string | null>(null);
  const [executionNotes, setExecutionNotes] = useState<string>('');
  const [showHivModal, setShowHivModal] = useState(false);
  const [currentAppointment] = useState<Appointment | null>(null);
  const [showHivTestingModal, setShowHivTestingModal] = useState(false);
  const [qualityMetrics, setQualityMetrics] = useState<any>(null);
  const [ltfuPatients, setLtfuPatients] = useState<any[]>([]);
  const [nurseCopilotKpis, setNurseCopilotKpis] = useState<any | null>(null);
  const [nurseCopilotKpisLoading, setNurseCopilotKpisLoading] = useState(false);
  const [nurseOutcomeAnalytics, setNurseOutcomeAnalytics] = useState<NurseOutcomeAnalyticsSnapshot | null>(null);
  const [nurseOutcomeAnalyticsLoading, setNurseOutcomeAnalyticsLoading] = useState(false);
  const [postVisitTrialAnalytics, setPostVisitTrialAnalytics] = useState<PostVisitTrialMemoryAnalyticsSnapshot | null>(null);
  const [postVisitTrialAnalyticsLoading, setPostVisitTrialAnalyticsLoading] = useState(false);
  const [postVisitTrialSlaAccountability, setPostVisitTrialSlaAccountability] = useState<PostVisitTrialSlaAccountabilitySnapshot | null>(null);
  const [postVisitTrialSlaAccountabilityLoading, setPostVisitTrialSlaAccountabilityLoading] = useState(false);
  const [postVisitTrialAuditExportLoading, setPostVisitTrialAuditExportLoading] = useState(false);
  const [showSharedDocumentsModal, setShowSharedDocumentsModal] = useState(false);
  const [sharedDocumentsCount, setSharedDocumentsCount] = useState(0);
  const [showCarePlansModal, setShowCarePlansModal] = useState(false);
  const [carePlansPatientId, setCarePlansPatientId] = useState<string | null>(null);
  const [carePlansPatientName, setCarePlansPatientName] = useState<string>('');
  
  const [showLabResultsModal, setShowLabResultsModal] = useState(false);
  const [labResultsPatientId, setLabResultsPatientId] = useState<string | null>(null);
  const [labResultsPatientName, setLabResultsPatientName] = useState<string>('');
  const [showVitalsHistoryModal, setShowVitalsHistoryModal] = useState(false);
  const [vitalsHistoryPatientId, setVitalsHistoryPatientId] = useState<string | null>(null);
  const [vitalsHistoryPatientName, setVitalsHistoryPatientName] = useState<string | null>(null);
  const [vitalsHistory, setVitalsHistory] = useState<any[]>([]);
  const [vitalsHistoryLoading, setVitalsHistoryLoading] = useState(false);
  const [ltfuDays, setLtfuDays] = useState(90);
  const [calendarAppointments, setCalendarAppointments] = useState<Appointment[]>([]);
  const [calendarLoading, setCalendarLoading] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);

  // Server-scoped acknowledged alerts
  const [acknowledgedAlertIds, setAcknowledgedAlertIds] = useState<Set<string>>(new Set());

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    const loadWorklistState = async () => {
      try {
        const token = localStorage.getItem('ehr_token');
        const activeTenant = resolveTenantSlug();
        if (!token || !activeTenant) return;
        const response = await ehrApi.getNurseWorklistState(token, activeTenant);
        setAcknowledgedAlertIds(new Set<string>(response.data?.acknowledgedAlertIds || []));
      } catch {
      }
    };
    loadWorklistState();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tenantSlug, currentUser?.id]);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    loadCrossModuleFeed();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tenantSlug, currentUser?.id]);

  const handleAlertAcknowledge = (alertId: string) => {
    setAcknowledgedAlertIds(prev => {
      const newSet = new Set(prev);
      newSet.add(alertId);
      return newSet;
    });
  };

  const loadNurseOutcomeAnalytics = async (days = 30) => {
    try {
      setNurseOutcomeAnalyticsLoading(true);
      const token = localStorage.getItem('ehr_token');
      const activeTenant = resolveTenantSlug();
      if (!token || !activeTenant) {
        setNurseOutcomeAnalytics(null);
        return;
      }

      const response = await ehrApi.getNurseOutcomeAnalytics(days, token, activeTenant);
      setNurseOutcomeAnalytics(response.data || null);
    } catch {
      setNurseOutcomeAnalytics(null);
    } finally {
      setNurseOutcomeAnalyticsLoading(false);
    }
  };

  const loadPostVisitTrialAnalytics = async (days = 30) => {
    try {
      setPostVisitTrialAnalyticsLoading(true);
      const token = localStorage.getItem('ehr_token');
      const activeTenant = resolveTenantSlug();
      if (!token || !activeTenant) {
        setPostVisitTrialAnalytics(null);
        return;
      }
      const response = await ehrApi.getPostVisitTrialMemoryAnalytics(token, activeTenant, {
        days,
        routeTarget: 'nurse',
      });
      setPostVisitTrialAnalytics((response.data || null) as PostVisitTrialMemoryAnalyticsSnapshot | null);
    } catch {
      setPostVisitTrialAnalytics(null);
    } finally {
      setPostVisitTrialAnalyticsLoading(false);
    }
  };

  const loadPostVisitTrialSlaAccountability = async (days = 30) => {
    try {
      setPostVisitTrialSlaAccountabilityLoading(true);
      const token = localStorage.getItem('ehr_token');
      const activeTenant = resolveTenantSlug();
      if (!token || !activeTenant) {
        setPostVisitTrialSlaAccountability(null);
        return;
      }
      const response = await ehrApi.getPostVisitTrialSlaAccountability(token, activeTenant, {
        days,
        routeTarget: 'nurse',
        limit: 8,
      });
      setPostVisitTrialSlaAccountability((response.data || null) as PostVisitTrialSlaAccountabilitySnapshot | null);
    } catch {
      setPostVisitTrialSlaAccountability(null);
    } finally {
      setPostVisitTrialSlaAccountabilityLoading(false);
    }
  };

  const exportPostVisitTrialAudit = async () => {
    try {
      setPostVisitTrialAuditExportLoading(true);
      const token = localStorage.getItem('ehr_token');
      const activeTenant = resolveTenantSlug();
      if (!token || !activeTenant) {
        showError('Audit export', 'You must be signed in to export trial audit data.');
        return;
      }
      const response = await ehrApi.exportPostVisitTrialMemoryAudit(token, activeTenant, {
        days: 30,
        format: 'csv',
        routeTarget: 'nurse',
        limit: 2000,
      });
      const csv = String(response.data?.csv || '').trim();
      if (!csv) {
        showError('Audit export', 'No trial audit data available for export.');
        return;
      }
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `nurse-trial-sla-audit-${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      showSuccess('Audit export ready', 'Downloaded trial SLA accountability audit CSV.');
    } catch {
      showError('Audit export', 'Unable to export trial SLA accountability audit.');
    } finally {
      setPostVisitTrialAuditExportLoading(false);
    }
  };

  const loadCrossModuleFeed = async () => {
    try {
      setCrossModuleLoading(true);
      const token = localStorage.getItem('ehr_token');
      const activeTenant = resolveTenantSlug();
      if (!token || !activeTenant) {
        setCrossModuleItems([]);
        setCrossModuleSummary({ total: 0, critical: 0, high: 0, maternity: 0, hiv: 0, oncology: 0, nursing: 0, handoff: 0, medication: 0 });
        return;
      }

      const response = await ehrApi.getNurseCrossModuleFeed(token, activeTenant);
      setCrossModuleItems(response.data?.items || []);
      setCrossModuleSummary(
        response.data?.summary || { total: 0, critical: 0, high: 0, maternity: 0, hiv: 0, oncology: 0, nursing: 0, handoff: 0, medication: 0 },
      );
      await Promise.all([
        loadNurseOutcomeAnalytics(30),
        loadPostVisitTrialAnalytics(30),
        loadPostVisitTrialSlaAccountability(30),
      ]);
    } catch {
      setCrossModuleItems([]);
      setCrossModuleSummary({ total: 0, critical: 0, high: 0, maternity: 0, hiv: 0, oncology: 0, nursing: 0, handoff: 0, medication: 0 });
    } finally {
      setCrossModuleLoading(false);
    }
  };

  const handleOpenCrossModuleWorkflow = (item: NurseCrossModuleFeedItem) => {
    if (item.module === 'maternity') {
      setActiveSection('maternity');
      setActiveTab('maternity');
      showSuccess(
        'Opened maternity workflow',
        item.enrollment_number
          ? `Review enrollment ${item.enrollment_number} in the maternity workspace.`
          : 'Review the maternity workspace for the selected escalation.',
      );
      return;
    }

    if (item.module === 'oncology') {
      navigate(`/ehr/${tenantSlug}/oncology`);
      showSuccess(
        'Opened oncology workflow',
        item.patient_name
          ? `Review oncology workflow context for ${item.patient_name}.`
          : 'Review oncology workflow context for the selected escalation.',
      );
      return;
    }

    if (item.module === 'nursing') {
      setActiveSection('main');
      if (item.item_type === 'medication_administration_followup') {
        navigate(`/ehr/${tenantSlug}/mar`);
        showSuccess('Opened medication workflow', 'Review the MAR workspace and resolve the medication follow-up item.');
        return;
      }

      setActiveTab('notes');
      showSuccess('Opened handoff workflow', 'Review the nursing handoff workflow and close the remaining follow-through steps.');
      return;
    }

    if (item.module === 'lab') {
      setActiveSection('main');
      setActiveTab('orders');
      showSuccess(
        'Opened lab workflow',
        item.patient_name
          ? `Review lab workflow and critical result context for ${item.patient_name}.`
          : 'Review lab workflow context for the selected escalation.',
      );
      return;
    }

    if (item.module === 'imaging') {
      setActiveSection('main');
      setActiveTab('orders');
      showSuccess(
        'Opened radiology workflow',
        item.patient_name
          ? `Review radiology follow-up context for ${item.patient_name} and execute queue actions.`
          : 'Review radiology follow-up context and execute queue actions.',
      );
      return;
    }

    setActiveSection('hiv');
    setActiveTab('hiv-patients');
    showSuccess(
      'Opened HIV workflow',
      item.enrollment_number
        ? `Review HIV enrollment ${item.enrollment_number} in the HIV workspace.`
        : 'Review the HIV workspace for the selected escalation.',
    );
  };

  const handleAcknowledgeCrossModuleMaternityTask = async (item: NurseCrossModuleFeedItem) => {
    const taskId = item.next_route?.taskId;
    const token = localStorage.getItem('ehr_token');
    const activeTenant = resolveTenantSlug();

    if (!taskId || !token || !activeTenant) {
      showError('Unable to acknowledge task', 'Missing task, session, or tenant context.');
      return;
    }

    try {
      setAcknowledgingCrossModuleTaskId(item.id);
      await ehrApi.updateMaternityCareTaskStatus(activeTenant, token, taskId, {
        status: 'acknowledged',
        note: 'Acknowledged from nurse cross-module escalation queue.',
      });
      showSuccess('Escalation acknowledged', 'The shared maternity task is now marked as acknowledged.');
      await loadCrossModuleFeed();
    } catch {
      showError('Unable to acknowledge task', 'Please retry the maternity escalation acknowledgement.');
    } finally {
      setAcknowledgingCrossModuleTaskId(null);
    }
  };

  const handleUpdateCrossModuleWorkflowStatus = async (
    item: NurseCrossModuleFeedItem,
    status: 'acknowledged' | 'completed',
  ) => {
    const token = localStorage.getItem('ehr_token');
    const activeTenant = resolveTenantSlug();

    if (!token || !activeTenant) {
      showError('Unable to update workflow', 'Missing session or tenant context.');
      return;
    }

    try {
      setUpdatingCrossModuleWorkflowItemId(item.id);
      await ehrApi.updateNurseCrossModuleWorkflow(
        {
          itemId: item.id,
          module: item.module,
          itemType: item.item_type,
          sourceRecordId: item.source_record_id || null,
          patientId: item.patient_id || null,
          enrollmentId: item.enrollment_id || null,
          status,
          note:
            status === 'completed'
              ? 'Completed from nurse cross-module escalation queue.'
              : 'Acknowledged from nurse cross-module escalation queue.',
          context: {
            moduleStatus: item.module_status || item.workflow_status,
            doctorSyncStatus: item.doctor_sync_status || null,
          },
          destinationRole: item.destination_role || null,
          destinationService: item.destination_service || null,
          destinationSpecialty: item.destination_specialty || null,
          destinationUserId: item.destination_user_id || null,
          destinationFacilityId: item.destination_facility_id || null,
          destinationFacilityName: item.destination_facility_name || null,
        },
        token,
        activeTenant,
      );
      showSuccess(
        status === 'completed' ? 'Workflow completed' : 'Workflow acknowledged',
        item.patient_name
          ? `${item.patient_name}'s ${item.title.toLowerCase()} is now ${status}.`
          : `Cross-module workflow item is now ${status}.`,
      );
      await loadCrossModuleFeed();
    } catch {
      showError('Unable to update workflow', 'Please retry the cross-module workflow update.');
    } finally {
      setUpdatingCrossModuleWorkflowItemId(null);
    }
  };

  const handleExecuteRecommendationAction = async (
    item: NurseCrossModuleFeedItem,
    recommendationItem: Record<string, any>,
  ) => {
    const token = localStorage.getItem('ehr_token');
    const activeTenant = resolveTenantSlug();

    if (!token || !activeTenant) {
      showError('Unable to apply action', 'Missing session or tenant context.');
      return;
    }

    if (item.module === 'hiv' && !item.enrollment_id) {
      showError('Unable to apply HIV action', 'Missing enrollment context.');
      return;
    }

    const actionKey = `${item.id}:${String(recommendationItem?.id || recommendationItem?.title || 'action')}`;

    try {
      setExecutingRecommendationActionKey(actionKey);

      if (item.module === 'hiv') {
        await ehrApi.executeHivNurseRecommendationAction(
          {
            itemId: item.id,
            itemType: item.item_type,
            sourceRecordId: item.source_record_id || null,
            patientId: item.patient_id || null,
            enrollmentId: item.enrollment_id || null,
            actionId: String(recommendationItem?.id || ''),
            actionType: recommendationItem?.type || null,
            actionTitle: recommendationItem?.title || null,
            actionPayload: recommendationItem?.action_payload || null,
            destinationRole: item.destination_role || null,
            destinationService: item.destination_service || null,
            destinationSpecialty: item.destination_specialty || null,
            destinationUserId: item.destination_user_id || null,
            destinationUserName: item.destination_user_name || null,
            destinationFacilityId: item.destination_facility_id || null,
            destinationFacilityName: item.destination_facility_name || null,
          },
          token,
          activeTenant,
        );
      } else if (item.module === 'oncology') {
        await ehrApi.executeOncologyNurseRecommendationAction(
          {
            itemId: item.id,
            itemType: item.item_type,
            sourceRecordId: item.source_record_id || null,
            patientId: item.patient_id || null,
            caseId: item.metadata?.oncology_case_id || recommendationItem?.action_payload?.case_id || null,
            actionId: String(recommendationItem?.id || ''),
            actionType: recommendationItem?.type || null,
            actionTitle: recommendationItem?.title || null,
            actionPayload: recommendationItem?.action_payload || null,
            destinationRole: item.destination_role || null,
            destinationService: item.destination_service || null,
            destinationSpecialty: item.destination_specialty || null,
            destinationUserId: item.destination_user_id || null,
            destinationUserName: item.destination_user_name || null,
            destinationFacilityId: item.destination_facility_id || null,
            destinationFacilityName: item.destination_facility_name || null,
          },
          token,
          activeTenant,
        );
      } else if (item.module === 'cardiology') {
        await ehrApi.executeCardiologyNurseRecommendationAction(
          {
            itemId: item.id,
            itemType: item.item_type,
            sourceRecordId: item.source_record_id || null,
            patientId: item.patient_id || null,
            encounterId:
              item.metadata?.encounter_id ||
              recommendationItem?.action_payload?.encounter_id ||
              item.source_record_id ||
              null,
            actionId: String(recommendationItem?.id || ''),
            actionType: recommendationItem?.type || null,
            actionTitle: recommendationItem?.title || null,
            actionPayload: recommendationItem?.action_payload || null,
            destinationRole: item.destination_role || null,
            destinationService: item.destination_service || null,
            destinationSpecialty: item.destination_specialty || null,
            destinationUserId: item.destination_user_id || null,
            destinationUserName: item.destination_user_name || null,
            destinationFacilityId: item.destination_facility_id || null,
            destinationFacilityName: item.destination_facility_name || null,
          },
          token,
          activeTenant,
        );
      } else if (item.module === 'ed') {
        await ehrApi.executeEdNurseRecommendationAction(
          {
            itemId: item.id,
            itemType: item.item_type,
            sourceRecordId: item.source_record_id || null,
            patientId: item.patient_id || null,
            visitId:
              item.metadata?.ed_visit_id ||
              recommendationItem?.action_payload?.visit_id ||
              item.source_record_id ||
              null,
            actionId: String(recommendationItem?.id || ''),
            actionType: recommendationItem?.type || null,
            actionTitle: recommendationItem?.title || null,
            actionPayload: recommendationItem?.action_payload || null,
            destinationRole: item.destination_role || null,
            destinationService: item.destination_service || null,
            destinationSpecialty: item.destination_specialty || null,
            destinationUserId: item.destination_user_id || null,
            destinationUserName: item.destination_user_name || null,
            destinationFacilityId: item.destination_facility_id || null,
            destinationFacilityName: item.destination_facility_name || null,
          },
          token,
          activeTenant,
        );
      } else if (item.module === 'sepsis') {
        await ehrApi.executeSepsisNurseRecommendationAction(
          {
            itemId: item.id,
            itemType: item.item_type,
            sourceRecordId: item.source_record_id || null,
            patientId: item.patient_id || null,
            bundleId:
              item.metadata?.sepsis_bundle_id ||
              recommendationItem?.action_payload?.bundle_id ||
              item.source_record_id ||
              null,
            actionId: String(recommendationItem?.id || ''),
            actionType: recommendationItem?.type || null,
            actionTitle: recommendationItem?.title || null,
            actionPayload: recommendationItem?.action_payload || null,
            destinationRole: item.destination_role || null,
            destinationService: item.destination_service || null,
            destinationSpecialty: item.destination_specialty || null,
            destinationUserId: item.destination_user_id || null,
            destinationUserName: item.destination_user_name || null,
            destinationFacilityId: item.destination_facility_id || null,
            destinationFacilityName: item.destination_facility_name || null,
          },
          token,
          activeTenant,
        );
      } else if (item.module === 'blood_bank') {
        await ehrApi.executeBloodBankNurseRecommendationAction(
          {
            itemId: item.id,
            itemType: item.item_type,
            sourceRecordId: item.source_record_id || null,
            patientId: item.patient_id || null,
            transfusionId:
              item.metadata?.transfusion_id ||
              recommendationItem?.action_payload?.transfusion_id ||
              item.source_record_id ||
              null,
            actionId: String(recommendationItem?.id || ''),
            actionType: recommendationItem?.type || null,
            actionTitle: recommendationItem?.title || null,
            actionPayload: recommendationItem?.action_payload || null,
            destinationRole: item.destination_role || null,
            destinationService: item.destination_service || null,
            destinationSpecialty: item.destination_specialty || null,
            destinationUserId: item.destination_user_id || null,
            destinationUserName: item.destination_user_name || null,
            destinationFacilityId: item.destination_facility_id || null,
            destinationFacilityName: item.destination_facility_name || null,
          },
          token,
          activeTenant,
        );
      } else if (item.module === 'ophthalmology') {
        await ehrApi.executeOphthalmologyNurseRecommendationAction(
          {
            itemId: item.id,
            itemType: item.item_type,
            sourceRecordId: item.source_record_id || null,
            patientId: item.patient_id || null,
            encounterId:
              item.metadata?.encounter_id ||
              recommendationItem?.action_payload?.encounter_id ||
              item.source_record_id ||
              null,
            actionId: String(recommendationItem?.id || ''),
            actionType: recommendationItem?.type || null,
            actionTitle: recommendationItem?.title || null,
            actionPayload: recommendationItem?.action_payload || null,
            destinationRole: item.destination_role || null,
            destinationService: item.destination_service || null,
            destinationSpecialty: item.destination_specialty || null,
            destinationUserId: item.destination_user_id || null,
            destinationUserName: item.destination_user_name || null,
            destinationFacilityId: item.destination_facility_id || null,
            destinationFacilityName: item.destination_facility_name || null,
          },
          token,
          activeTenant,
        );
      } else if (item.module === 'telemedicine') {
        await ehrApi.executeTelemedicineNurseRecommendationAction(
          {
            itemId: item.id,
            itemType: item.item_type,
            sourceRecordId: item.source_record_id || null,
            patientId: item.patient_id || null,
            consultationId:
              item.metadata?.consultation_id ||
              recommendationItem?.action_payload?.consultation_id ||
              item.source_record_id ||
              null,
            actionId: String(recommendationItem?.id || ''),
            actionType: recommendationItem?.type || null,
            actionTitle: recommendationItem?.title || null,
            actionPayload: recommendationItem?.action_payload || null,
            destinationRole: item.destination_role || null,
            destinationService: item.destination_service || null,
            destinationSpecialty: item.destination_specialty || null,
            destinationUserId: item.destination_user_id || null,
            destinationUserName: item.destination_user_name || null,
            destinationFacilityId: item.destination_facility_id || null,
            destinationFacilityName: item.destination_facility_name || null,
          },
          token,
          activeTenant,
        );
      } else if (item.module === 'lab') {
        await ehrApi.executeLabNurseRecommendationAction(
          {
            itemId: item.id,
            itemType: item.item_type,
            sourceRecordId: item.source_record_id || null,
            patientId: item.patient_id || null,
            alertId:
              item.metadata?.alert_id ||
              recommendationItem?.action_payload?.alert_id ||
              item.source_record_id ||
              null,
            actionId: String(recommendationItem?.id || ''),
            actionType: recommendationItem?.type || null,
            actionTitle: recommendationItem?.title || null,
            actionPayload: recommendationItem?.action_payload || null,
            destinationRole: item.destination_role || null,
            destinationService: item.destination_service || null,
            destinationSpecialty: item.destination_specialty || null,
            destinationUserId: item.destination_user_id || null,
            destinationUserName: item.destination_user_name || null,
            destinationFacilityId: item.destination_facility_id || null,
            destinationFacilityName: item.destination_facility_name || null,
          },
          token,
          activeTenant,
        );
      } else if (item.module === 'imaging') {
        await ehrApi.executeImagingNurseRecommendationAction(
          {
            itemId: item.id,
            itemType: item.item_type,
            sourceRecordId: item.source_record_id || null,
            patientId: item.patient_id || null,
            reportId:
              item.metadata?.imaging_report_id ||
              recommendationItem?.action_payload?.report_id ||
              item.source_record_id ||
              null,
            actionId: String(recommendationItem?.id || ''),
            actionType: recommendationItem?.type || null,
            actionTitle: recommendationItem?.title || null,
            actionPayload: recommendationItem?.action_payload || null,
            destinationRole: item.destination_role || null,
            destinationService: item.destination_service || null,
            destinationSpecialty: item.destination_specialty || null,
            destinationUserId: item.destination_user_id || null,
            destinationUserName: item.destination_user_name || null,
            destinationFacilityId: item.destination_facility_id || null,
            destinationFacilityName: item.destination_facility_name || null,
          },
          token,
          activeTenant,
        );
      } else if (item.module === 'pharmacy') {
        await ehrApi.executePharmacyNurseRecommendationAction(
          {
            itemId: item.id,
            itemType: item.item_type,
            sourceRecordId: item.source_record_id || null,
            patientId: item.patient_id || null,
            prescriptionId:
              item.metadata?.prescription_id ||
              recommendationItem?.action_payload?.prescription_id ||
              item.source_record_id ||
              null,
            actionId: String(recommendationItem?.id || ''),
            actionType: recommendationItem?.type || null,
            actionTitle: recommendationItem?.title || null,
            actionPayload: recommendationItem?.action_payload || null,
            destinationRole: item.destination_role || null,
            destinationService: item.destination_service || null,
            destinationSpecialty: item.destination_specialty || null,
            destinationUserId: item.destination_user_id || null,
            destinationUserName: item.destination_user_name || null,
            destinationFacilityId: item.destination_facility_id || null,
            destinationFacilityName: item.destination_facility_name || null,
          },
          token,
          activeTenant,
        );
      } else {
        showError('Unable to apply action', 'This queue action is not executable for the selected module.');
        return;
      }

      showSuccess(
        `${String(item.module || 'workflow').replace(/_/g, ' ')} recommendation applied`,
        recommendationItem?.title
          ? `${recommendationItem.title} was applied from the nurse queue.`
          : 'The recommendation action was applied.',
      );
      await loadCrossModuleFeed();
    } catch (error: any) {
      showError(
        `Unable to apply ${String(item.module || 'workflow').replace(/_/g, ' ')} action`,
        error?.response?.data?.message || 'Please retry the recommendation action.',
      );
    } finally {
      setExecutingRecommendationActionKey(null);
    }
  };

  // Sidebar Navigation Helper
  const getSidebarNavigation = () => {
    return [
      { 
        icon: Stethoscope, 
        label: 'Main Dashboard', 
        desc: 'Core nursing tasks & patient queue', 
        section: 'main' as const,
        tab: 'dashboard',
        color: 'from-emerald-500 to-teal-500',
        children: [
          { label: 'Dashboard', tab: 'dashboard', icon: LayoutDashboard },
          { label: 'My Tasks', tab: 'tasks', icon: Activity },
          { label: 'Cross-Module', tab: 'cross-module', icon: Sparkles },
          { label: 'Safety Alerts', tab: 'alerts', icon: Bell },
          { label: 'Copilot KPIs', tab: 'copilot-metrics', icon: BarChart3 },
          { label: 'Today\'s Schedule', tab: 'calendar', icon: Calendar },
          { label: 'Patients', tab: 'patients', icon: Users },
          { label: 'Patient Queue', tab: 'queue', icon: Activity },
          { label: 'Orders & Procedures', tab: 'orders', icon: ClipboardList },
          { label: 'Nursing Notes', tab: 'notes', icon: FileText },
        ]
      },
      { 
        icon: Activity, 
        label: 'HIV/AIDS Program', 
        desc: 'Testing, treatment & care', 
        section: 'hiv' as const,
        tab: 'testing',
        color: 'from-red-500 to-orange-500',
        children: [
          { label: 'HIV Testing', tab: 'testing', icon: TestTube },
          { label: 'Patients on Care', tab: 'hiv-patients', icon: Users },
          { label: 'TB Screening', tab: 'tb-screening', icon: Stethoscope },
          { label: 'Cervical Cancer', tab: 'cervical-cancer', icon: Activity },
          { label: 'Quality Metrics', tab: 'quality-metrics', icon: BarChart3 },
          { label: 'Stock Management', tab: 'stock-management', icon: Package },
          { label: 'LTFU Management', tab: 'ltfu', icon: Clock },
          { label: 'Reports & DHIS2', tab: 'hiv-reports', icon: FileText },
          { label: 'Guided WHO Workflow', tab: 'who-workflow', icon: Activity },
        ]
      },
      {
        icon: Heart,
        label: 'Maternity & Obstetrics',
        desc: 'Prenatal & postnatal care',
        section: 'maternity' as const,
        tab: 'maternity',
        color: 'from-pink-500 to-rose-500',
        children: [
          { label: 'Maternity Workspace', tab: 'maternity', icon: Heart },
        ]
      },
      {
        icon: Stethoscope,
        label: "Women's Health",
        desc: 'Cervical cancer & family planning',
        section: 'women-health' as const,
        tab: 'cervical-screening',
        color: 'from-purple-500 to-violet-500',
        children: [
          { label: 'Cervical Cancer Screening', tab: 'cervical-screening', icon: Stethoscope },
          { label: 'Family Planning', tab: 'family-planning', icon: Heart },
        ],
      },
      {
        icon: Activity,
        label: 'NCD / Hypertension',
        desc: 'HTN register, BP trends, WHO PEN step therapy',
        section: 'ncd' as const,
        tab: 'hypertension',
        color: 'from-blue-500 to-cyan-500',
        children: [
          { label: 'Hypertension Register', tab: 'hypertension', icon: Activity },
          { label: 'Traditional Medicine', tab: 'traditional-medicine', icon: Leaf },
        ],
      },
    ].filter((item) => {
      if (item.section === 'hiv') return hasModuleAccess(tenantInfo, 'hiv');
      if (item.section === 'maternity') return hasModuleAccess(tenantInfo, 'maternity');
      return true;
    });
  };

  // AI Guideline Search State
  const [showGuidelineSearch, setShowGuidelineSearch] = useState(false);
  const [triageCopilotLoading, setTriageCopilotLoading] = useState(false);
  const [vitalsCopilotLoading, setVitalsCopilotLoading] = useState(false);
  const [notesCopilotLoading, setNotesCopilotLoading] = useState(false);
  const [handoffCopilotLoading, setHandoffCopilotLoading] = useState(false);
  const [triageCopilotResult, setTriageCopilotResult] = useState<any | null>(null);
  const [triageSuggestedPriority, setTriageSuggestedPriority] = useState<'urgent' | 'high' | 'normal' | 'low' | null>(null);
  const [vitalsCopilotResult, setVitalsCopilotResult] = useState<any | null>(null);
  const [notesCopilotDraft, setNotesCopilotDraft] = useState<string>('');
  const [notesCopilotProvenance, setNotesCopilotProvenance] = useState<string[]>([]);
  const [handoffCopilotSummary, setHandoffCopilotSummary] = useState<string>('');
  const [handoffCopilotMeta, setHandoffCopilotMeta] = useState<any | null>(null);
  const [copilotDecisionNote, setCopilotDecisionNote] = useState('');
  const [handoffWorkflowLoading, setHandoffWorkflowLoading] = useState(false);
  const [handoffActionLoading, setHandoffActionLoading] = useState(false);
  const [handoffRecipient, setHandoffRecipient] = useState('Next Shift Nurse');
  const [handoffReviewNote, setHandoffReviewNote] = useState('');
  const [handoffWorkflow, setHandoffWorkflow] = useState<HandoffWorkflowState>({
    patientId: null,
    status: 'draft',
    finalized: false,
    finalizedAt: null,
    finalizedBy: null,
    reviewed: false,
    reviewedAt: null,
    reviewedBy: null,
    shared: false,
    sharedAt: null,
    sharedBy: null,
  });
  const resolveTenantSlug = () =>
    tenantSlug || localStorage.getItem('ehr_tenant_slug') || localStorage.getItem('ehr_tenant') || '';

  const notifyPaymentBlocked = (appointment: Appointment, context: string) => {
    const financeDetails = buildFinanceDetails(appointment);
    const detailSuffix = financeDetails ? ` ${financeDetails}` : '';
    showError(
      'Awaiting payment',
      `${context}. Accounts must confirm payment before continuing.${detailSuffix}`
    );
  };

  const isNurseAccountsUser = () => {
    return currentUser?.role === 'nurse_accounts';
  };

  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [paymentAppointment, setPaymentAppointment] = useState<Appointment | null>(null);
  const [paymentForm, setPaymentForm] = useState({
    amount: '',
    paymentMethod: 'cash',
    paymentReference: '',
    gatewayReference: '',
    note: '',
  });
  const [paymentSubmitting, setPaymentSubmitting] = useState(false);

  const openPaymentForAppointment = (appointment: Appointment) => {
    setPaymentAppointment(appointment);
    setPaymentForm({
      amount: appointment.feeAmount != null ? String(appointment.feeAmount) : '',
      paymentMethod: 'cash',
      paymentReference: '',
      gatewayReference: '',
      note: '',
    });
    setShowPaymentModal(true);
  };

  const submitPayment = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!paymentAppointment || !paymentAppointment.financeTransactionId) {
      showError('Payment Error', 'No finance transaction is linked to this appointment.');
      return;
    }

    const token = localStorage.getItem('ehr_token');
    const activeTenant = resolveTenantSlug();
    if (!token || !activeTenant) {
      showError('Payment Error', 'Missing authentication or tenant information.');
      return;
    }

    try {
      setPaymentSubmitting(true);
      await ehrApi.recordFinancialPayment(activeTenant, token, paymentAppointment.financeTransactionId, {
        amount: Number(paymentForm.amount),
        paymentMethod: paymentForm.paymentMethod,
        paymentReference: paymentForm.paymentReference || undefined,
        gatewayReference: paymentForm.gatewayReference || undefined,
        note: paymentForm.note || undefined,
      });

      showSuccess('Payment Recorded', 'The payment has been captured successfully.');
      setShowPaymentModal(false);
      setPaymentAppointment(null);
      await fetchTodayAppointments();
    } catch (error: any) {
      showError(
        'Payment Error',
        error.response?.data?.message || 'Failed to record payment. Please try again or contact Accounts.',
      );
    } finally {
      setPaymentSubmitting(false);
    }
  };

  // Calculate task counts from appointments directly
  const calculateTaskCountsFromAppointments = useCallback((appointments: any[]) => {
    if (!Array.isArray(appointments)) {
      setTaskCounts({ pending: 0, inProgress: 0, overdue: 0 });
      return;
    }

    let pending = 0;
    let inProgress = 0;
    let overdue = 0;

    appointments.forEach((apt) => {
      // Only create tasks for appointments that need nursing care
      if (apt.status === 'scheduled' || apt.status === 'confirmed') {
        // Only create vital signs task if vitals haven't been recorded yet
        if (!apt.vitals) {
          pending++;
        }
      }

      if (apt.status === 'in-progress' || apt.status === 'in_progress') {
        inProgress++;
      }
    });

    setTaskCounts({ pending, inProgress, overdue });
  }, []);

  // Calculate alert counts from appointments directly
  const calculateAlertCountsFromAppointments = useCallback((appointments: any[]) => {
    if (!Array.isArray(appointments)) {
      setAlertCounts({ active: 0, critical: 0, high: 0 });
      return;
    }

    let active = 0;
    let critical = 0;
    let high = 0;

    appointments.forEach((apt) => {
      // Only create alerts based on actual patient data
      if (apt.patient.allergies && apt.patient.allergies.length > 0) {
        active++;
        high++;
      }

      // Fall risk alerts based on actual age
      if (apt.patient.age && apt.patient.age > 65) {
        active++;
        high++;
      }

      // Critical vitals alerts based on actual vitals data
      if (apt.vitals) {
        const vitals = apt.vitals;
        
        // Check for critical blood pressure
        if (vitals.bloodPressure) {
          const bpValues = vitals.bloodPressure.split('/');
          if (bpValues.length === 2) {
            const systolic = parseInt(bpValues[0]);
            const diastolic = parseInt(bpValues[1]);
            
            if (systolic >= 180 || diastolic >= 110) {
              active++;
              critical++;
            }
          }
        }

        // Check for abnormal heart rate
        if (vitals.heartRate && (vitals.heartRate > 120 || vitals.heartRate < 50)) {
          active++;
          high++;
        }

        // Check for abnormal temperature
        if (vitals.temperature && (vitals.temperature > 38.5 || vitals.temperature < 35)) {
          active++;
          high++;
        }

        // Check for low oxygen saturation
        if (vitals.oxygenSaturation && vitals.oxygenSaturation < 90) {
          active++;
          critical++;
        }
      }
    });

    setAlertCounts({ active, critical, high });
  }, []);

  // Calculate task counts (for component callbacks)
  const calculateTaskCounts = useCallback((tasks: any[]) => {
    if (!Array.isArray(tasks)) {
      setTaskCounts({ pending: 0, inProgress: 0, overdue: 0 });
      return;
    }
    
    const pending = tasks.filter(task => task.status === 'pending').length;
    const inProgress = tasks.filter(task => task.status === 'in_progress').length;
    const overdue = tasks.filter(task => task.status === 'overdue').length;
    setTaskCounts({ pending, inProgress, overdue });
  }, []);

  useEffect(() => {
    const user = JSON.parse(localStorage.getItem('ehr_user') || '{}');
    setCurrentUser(user);
  }, []);

  // Calculate counts immediately when appointments are loaded
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (appointments.length > 0) {
      calculateTaskCountsFromAppointments(appointments);
      calculateAlertCountsFromAppointments(appointments);
    } else {
      setTaskCounts({ pending: 0, inProgress: 0, overdue: 0 });
      setAlertCounts({ active: 0, critical: 0, high: 0 });
    }
  }, [appointments, calculateTaskCountsFromAppointments, calculateAlertCountsFromAppointments]);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (currentUser) {
      fetchTodayAppointments();
      fetchPatients();
      fetchAuthorizedOrders();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser, tenantSlug]);

  // Close dropdowns when clicking outside
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (showUserDropdown) {
        const target = event.target as Element;
        if (!target.closest('[data-dropdown="user"]')) {
          setShowUserDropdown(false);
        }
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showUserDropdown]);

  // Load shared documents count
  useEffect(() => {
    const loadSharedCount = async () => {
      const token = localStorage.getItem('ehr_token');
      if (!token || !tenantSlug) return;
      
      try {
        const response = await ehrApi.getSharedDocuments(token, tenantSlug);
        setSharedDocumentsCount(response.data?.length || 0);
      } catch {
      }
    };

    if (tenantSlug) {
      loadSharedCount();
      // Refresh count every 2 minutes
      const interval = setInterval(loadSharedCount, 120000);
      return () => clearInterval(interval);
    }
  }, [tenantSlug]);

  // Fetch tenant info
  useEffect(() => {
    if (!tenantSlug) return;
    const cachedBranding = readCachedTenantBranding(tenantSlug);
    if (cachedBranding) {
      setTenantInfo((prev: any) => ({
        ...(prev || {}),
        clinicName: prev?.clinicName || cachedBranding.clinicName,
        logoUrl: prev?.logoUrl || cachedBranding.logoUrl,
      }));
    }
  }, [tenantSlug]);

  useEffect(() => {
    const fetchTenantInfo = async () => {
        try {
          const response = await tenantApi.getTenantBySlug(tenantSlug!);
          if (response.data) {
            setTenantInfo(response.data);
            cacheTenantBranding(tenantSlug!, {
              clinicName: response.data.clinicName,
              logoUrl: response.data.logoUrl,
            });
          }
        } catch {
        }
      };

    if (tenantSlug) {
      fetchTenantInfo();
    }
  }, [tenantSlug]);

  // Filter patients based on search term
  useEffect(() => {
    if (patientSearchTerm.trim() === '') {
      setFilteredPatients(patients);
    } else {
      const filtered = patients.filter(patient =>
        `${patient.firstName} ${patient.lastName}`.toLowerCase().includes(patientSearchTerm.toLowerCase()) ||
        patient.patientNumber.toLowerCase().includes(patientSearchTerm.toLowerCase()) ||
        patient.email?.toLowerCase().includes(patientSearchTerm.toLowerCase())
      );
      setFilteredPatients(filtered);
    }
    setCurrentPage(1); // Reset to first page when searching
  }, [patientSearchTerm, patients]);

  // Sync active tab with route suffix
  useEffect(() => {
    const path = location.pathname;
    if (path.includes('/nurse/queue')) setActiveTab('queue');
    else if (path.includes('/nurse/vitals')) setActiveTab('vitals');
    else if (path.includes('/nurse/triage')) setActiveTab('triage');
    else if (path.includes('/nurse/notes')) { setActiveTab('notes'); setNotesPreset(undefined); }
    else if (path.includes('/nurse/care-plans')) { setActiveTab('notes'); setNotesPreset('care_plans'); }
    else if (path.includes('/nurse/medications')) { setActiveTab('notes'); setNotesPreset('medications'); }
    else setActiveTab('dashboard'); // Default to dashboard if no match
  }, [location.pathname]);

  // Load Quality Metrics and LTFU when in HIV section
  useEffect(() => {
    if (activeSection === 'hiv' && (activeTab === 'quality-metrics' || activeTab === 'ltfu' || activeTab === 'hiv-reports')) {
      const token = localStorage.getItem('ehr_token');
      if (!token || !tenantSlug) return;

      const loadMetrics = async () => {
        try {
          if (activeTab === 'quality-metrics') {
            const metricsRes = await ehrApi.getQualityMetrics(token, tenantSlug);
            setQualityMetrics(metricsRes.data);
          }
          if (activeTab === 'ltfu') {
            const ltfuRes = await ehrApi.getLTFUPatients(ltfuDays, token, tenantSlug);
            setLtfuPatients(ltfuRes.data.patients || []);
          }
        } catch {
        }
      };

      loadMetrics();
    }
  }, [activeSection, activeTab, tenantSlug, ltfuDays]);

  useEffect(() => {
    if (activeTab !== 'copilot-metrics') {
      return;
    }
    const token = localStorage.getItem('ehr_token');
    const activeTenant = resolveTenantSlug();
    if (!token || !activeTenant) {
      return;
    }
    const loadKpis = async () => {
      try {
        setNurseCopilotKpisLoading(true);
        const [res] = await Promise.all([
          ehrApi.getNurseCopilotKpis(token, activeTenant),
          loadNurseOutcomeAnalytics(30),
        ]);
        setNurseCopilotKpis(res.data || null);
      } catch {
      } finally {
        setNurseCopilotKpisLoading(false);
      }
    };
    loadKpis();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab]);

  const fetchAuthorizedOrders = async () => {
    try {
      const token = localStorage.getItem('ehr_token');
      const activeTenant = resolveTenantSlug();
      if (!token || !activeTenant) {
        return;
      }

      const response = await ehrApi.getAuthorizedOrders(token, activeTenant);
      setAuthorizedOrders(response.data.orders || []);
    } catch (error: any) {
      // Handle 500 error gracefully - likely means no orders exist yet
      if (error?.response?.status === 500) {
        setAuthorizedOrders([]);
      } else {
        setAuthorizedOrders([]);
      }
    }
  };

  const fetchVitalsForAppointments = async (appointments: Appointment[]) => {
    try {
      const token = localStorage.getItem('ehr_token');
      const activeTenant = resolveTenantSlug();
      if (!token || !activeTenant) {
        return appointments;
      }

      const appointmentsWithVitals = await Promise.all(
        appointments.map(async (appointment) => {
          try {
            const vitalsResponse = await ehrApi.getVitals(appointment.patient.id, token, activeTenant);
            const vitals = vitalsResponse.data.vitals || [];
            
            // Get the most recent vitals
            const latestVitals = vitals.length > 0 ? vitals[0] : null;
            
            return {
              ...appointment,
              vitals: latestVitals
            };
          } catch (error) {
            return {
              ...appointment,
              vitals: null
            };
          }
        })
      );

      return appointmentsWithVitals;
    } catch {
      return appointments;
    }
  };

  const fetchTodayAppointments = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('ehr_token');
      const activeTenant = resolveTenantSlug();
      if (!token || !activeTenant) {
        return;
      }

      const today = new Date();
      // Use local date instead of UTC to ensure we fetch for the correct day in the user's timezone
      const year = today.getFullYear();
      const month = String(today.getMonth() + 1).padStart(2, '0');
      const day = String(today.getDate()).padStart(2, '0');
      const todayString = `${year}-${month}-${day}`;
      
      const response = await ehrApi.getAppointments(token, activeTenant, { date: todayString });

      // Show ALL appointments for today - nurses need to see everything
      let allAppointments = response.data.appointments || [];
      
      // If no appointments for today, let's also check yesterday and day before
      if (allAppointments.length === 0) {
        try {
          const getLocalDateString = (date: Date) => {
            const year = date.getFullYear();
            const month = String(date.getMonth() + 1).padStart(2, '0');
            const day = String(date.getDate()).padStart(2, '0');
            return `${year}-${month}-${day}`;
          };

          const yesterday = new Date(today);
          yesterday.setDate(yesterday.getDate() - 1);
          const yesterdayString = getLocalDateString(yesterday);
          
          const dayBefore = new Date(today);
          dayBefore.setDate(dayBefore.getDate() - 2);
          const dayBeforeString = getLocalDateString(dayBefore);
          
          // Fetch appointments for yesterday and day before
          const [yesterdayResponse, dayBeforeResponse] = await Promise.all([
            ehrApi.getAppointments(token, activeTenant, { date: yesterdayString }),
            ehrApi.getAppointments(token, activeTenant, { date: dayBeforeString }),
          ]);
          
          const recentAppointments = [
            ...(yesterdayResponse.data.appointments || []),
            ...(dayBeforeResponse.data.appointments || [])
          ];
          
          // Fetch vitals for recent appointments
          const appointmentsWithVitals = await fetchVitalsForAppointments(recentAppointments);
          setAppointments(appointmentsWithVitals);
        } catch {
          // Fetch vitals for today's appointments as fallback
          const appointmentsWithVitals = await fetchVitalsForAppointments(allAppointments);
          setAppointments(appointmentsWithVitals);
        }
      } else {
        // Fetch vitals for today's appointments
        const appointmentsWithVitals = await fetchVitalsForAppointments(allAppointments);
        setAppointments(appointmentsWithVitals);
      }
    } catch {
      showError('Error', 'Failed to fetch appointments');
    } finally {
      setLoading(false);
    }
  };

  const getQueueStats = () => {
    // Show all appointments for nurses, even those awaiting payment
    const waiting = appointments.filter(apt => apt.status === 'scheduled' || apt.status === 'confirmed').length;
    const inProgress = appointments.filter(apt => apt.status === 'in-progress').length;
    const completed = appointments.filter(apt => apt.status === 'completed').length;
    const urgent = appointments.filter(apt => apt.priorityLevel === 'urgent' || apt.priorityLevel === 'high').length;
    const vitalsRecorded = appointments.filter(apt => apt.vitals !== null && apt.vitals !== undefined).length;
    const awaitingPayment = appointments.filter(apt => apt.paymentStatus === 'awaiting_payment').length;

    return { waiting, inProgress, completed, urgent, vitalsRecorded, awaitingPayment };
  };

  const getDashboardGridActions = () => {
    return [
      { icon: Activity, label: 'My Tasks', desc: 'Epic-style task management', color: 'from-indigo-500 to-purple-600', action: () => setActiveTab('tasks') },
      {
        icon: Sparkles,
        label: 'Cross-Module Escalations',
        desc: 'Shared maternity and HIV follow-up queue',
        color: 'from-violet-500 to-indigo-600',
        action: () => setActiveTab('cross-module'),
        badge: crossModuleSummary.total > 0 ? crossModuleSummary.total : undefined,
      },
      {
        icon: BookOpen,
        label: 'Post-Visit Companion',
        desc: 'Open patient-safe summary and escalation chat view',
        color: 'from-cyan-600 to-blue-700',
        action: () => navigate(`/ehr/${tenantSlug}/patient/post-visit`),
      },
      { icon: Calendar, label: 'Today\'s Schedule', desc: 'View today\'s appointments', color: 'from-blue-500 to-cyan-500', action: () => setActiveTab('calendar') },
      { icon: AlertCircle, label: 'Emergency Dept', desc: 'ED tracking board & triage', color: 'from-red-500 to-orange-600', action: () => navigate(`/ehr/${tenantSlug}/emergency`) },
      { icon: Bed, label: 'Bed Management', desc: 'Hospital-wide bed status & ADT', color: 'from-blue-600 to-cyan-600', action: () => navigate(`/ehr/${tenantSlug}/bed-management`) },
      { icon: Activity, label: 'Operating Room', desc: 'OR scheduling & surgical cases', color: 'from-indigo-600 to-purple-600', action: () => navigate(`/ehr/${tenantSlug}/operating-room`) },
      { icon: Bed, label: 'PACU', desc: 'Post-anesthesia care unit', color: 'from-purple-600 to-violet-600', action: () => navigate(`/ehr/${tenantSlug}/pacu`) },
      { icon: Package, label: 'MAR (BCMA)', desc: 'Barcode medication administration', color: 'from-cyan-600 to-blue-600', action: () => navigate(`/ehr/${tenantSlug}/mar`) },
      { icon: Droplets, label: 'Blood Bank', desc: 'Blood inventory & transfusions', color: 'from-red-600 to-rose-600', action: () => navigate(`/ehr/${tenantSlug}/blood-bank`) },
      { icon: AlertTriangle, label: 'Sepsis Management', desc: 'SEP-1 bundle & screening', color: 'from-orange-600 to-red-600', action: () => navigate(`/ehr/${tenantSlug}/sepsis`) },
      { icon: Shield, label: 'Infection Control', desc: 'HAI surveillance & isolation', color: 'from-green-600 to-emerald-600', action: () => navigate(`/ehr/${tenantSlug}/infection-control`) },
      { icon: Users, label: 'Patients', desc: 'Browse & schedule', color: 'from-blue-500 to-cyan-500', action: () => setActiveTab('patients') },
      { icon: Users, label: 'Patient Queue', desc: 'Manage patient flow', color: 'from-indigo-500 to-purple-500', action: () => setActiveTab('queue') },
      { icon: Heart, label: 'Vitals Recording', desc: 'Record patient vitals', color: 'from-red-500 to-pink-500', action: () => setActiveTab('vitals') },
      { 
        icon: ClipboardList, 
        label: 'Triage Assessment', 
        desc: 'Patient assessment', 
        color: 'from-orange-500 to-yellow-500', 
        action: () => {
          if (selectedPatient) {
            setActiveTab('triage');
          } else {
            setActiveTab('queue');
            showSuccess('Select Patient', 'Please select a patient from the queue to start triage.');
          }
        }
      },
      { icon: FileText, label: 'Nursing Notes', desc: 'Document care provided', color: 'from-green-500 to-emerald-500', action: () => setActiveTab('notes') },
      { icon: TestTube, label: 'HIV Testing', desc: 'Perform HIV test', color: 'from-emerald-600 to-teal-700', action: () => setShowHivTestingModal(true) },
      { icon: FolderOpen, label: 'Shared Documents', desc: 'View shared patient documents', color: 'from-violet-500 to-purple-600', action: () => setShowSharedDocumentsModal(true), badge: sharedDocumentsCount > 0 ? sharedDocumentsCount : undefined },
    ].filter((action) => {
      if (action.label === 'Emergency Dept') return hasModuleAccess(tenantInfo, 'emergency');
      if (action.label === 'Operating Room') return hasModuleAccess(tenantInfo, 'operating_room');
      if (action.label === 'Blood Bank') return hasModuleAccess(tenantInfo, 'blood_bank');
      if (action.label === 'Sepsis Management') return hasModuleAccess(tenantInfo, 'emergency');
      if (action.label === 'Infection Control') return hasModuleAccess(tenantInfo, 'infection_control');
      if (action.label === 'HIV Testing') return hasModuleAccess(tenantInfo, 'hiv');
      return true;
    });
  };

  const queueStats = getQueueStats();
  const outcomeQueue = nurseOutcomeAnalytics?.crossModuleQueue;
  const outcomeExecution = nurseOutcomeAnalytics?.hivRecommendationExecution;
  const outcomeMaternity = nurseOutcomeAnalytics?.maternityEscalationSla;
  const outcomeWindowDays = nurseOutcomeAnalytics?.window?.days ?? 30;

  const quickStats = [
    { label: 'Patients Waiting', value: queueStats.waiting.toString(), icon: Clock, color: 'text-blue-600' },
    { label: 'In Progress', value: queueStats.inProgress.toString(), icon: Activity, color: 'text-yellow-600' },
    { label: 'Vitals Recorded', value: queueStats.vitalsRecorded.toString(), icon: Heart, color: 'text-purple-600' },
    { label: 'Urgent Cases', value: queueStats.urgent.toString(), icon: AlertTriangle, color: 'text-red-600' },
    { label: 'Completed Today', value: queueStats.completed.toString(), icon: CheckCircle, color: 'text-green-600' },
    { label: 'Awaiting Payment', value: queueStats.awaitingPayment.toString(), icon: CreditCard, color: 'text-amber-600' },
    { label: 'Cross-Module', value: crossModuleSummary.total.toString(), icon: Sparkles, color: 'text-indigo-600' },
  ];
  const billingSummary = tenantInfo?.billingSummary;
  const billingTone = getBillingToneClasses(billingSummary);
  const tenantDisplayName = formatTenantDisplayName(tenantSlug, tenantInfo?.clinicName);
  const tenantInitials = getBrandInitials(tenantDisplayName);
  const subscriptionMiniLabel = (() => {
    if (!billingSummary) return null;
    const days = billingSummary.daysUntilSuspension ?? billingSummary.daysRemaining;
    const ends = billingSummary.accessEndsAt
      ? new Date(billingSummary.accessEndsAt).toLocaleDateString('en-GB')
      : null;
    if (days !== null && days !== undefined && ends) return `${days}d · ends ${ends}`;
    if (days !== null && days !== undefined) return `${days}d remaining`;
    if (ends) return `ends ${ends}`;
    return null;
  })();

  useEffect(() => {
    notifyTenantSubscriptionStatus(tenantInfo, { showWarning, showError });
  }, [tenantInfo, showWarning, showError]);

  useEffect(() => {
    const loadMentalHealthQuickTools = async () => {
      try {
        const response = await cdssApi.listMhScreeningTools();
        const tools = Array.isArray(response?.tools) ? response.tools : [];
        setMhQuickTools(tools);
        if (tools.length > 0) {
          setMhQuickTool((current) => (tools.some((tool: any) => tool.id === current) ? current : tools[0].id));
          const selected = tools.find((tool: any) => tool.id === mhQuickTool) || tools[0];
          setMhQuickLanguage((current) =>
            selected?.languages?.includes(current) ? current : selected?.languages?.[0] || 'en',
          );
        }
      } catch {
        // Non-blocking quick access helper
      }
    };
    void loadMentalHealthQuickTools();
  }, []);

  useEffect(() => {
    const selectedTool = mhQuickTools.find((tool) => tool.id === mhQuickTool);
    if (selectedTool && !selectedTool.languages.includes(mhQuickLanguage)) {
      setMhQuickLanguage(selectedTool.languages[0] || 'en');
    }
  }, [mhQuickLanguage, mhQuickTool, mhQuickTools]);

  const handleExecuteOrder = (orderId: string) => {
    setExecutingOrderId(orderId);
    setExecutionNotes('');
    setShowExecuteOrderModal(true);
  };

  const confirmExecuteOrder = async () => {
    if (!executingOrderId) return;
    try {
      const token = localStorage.getItem('ehr_token');
      if (!token) return;
      await ehrApi.executeOrder(executingOrderId, executionNotes || '', token, tenantSlug!);
      setShowExecuteOrderModal(false);
      setExecutingOrderId(null);
      setExecutionNotes('');
      showSuccess('Success', 'Order executed successfully');
      fetchAuthorizedOrders();
    } catch {
      showError('Error', 'Failed to execute order');
    }
  };


  const getSelectedPatientLatestVitals = () => {
    if (!selectedPatient) {
      return null;
    }
    const patientApt = appointments.find(a => a.patient.id === selectedPatient.id && a.vitals);
    return patientApt?.vitals || null;
  };

  const handleTriageCopilotAnalyze = async (targetPatient?: Patient, sourceAppointment?: Appointment) => {
    try {
      const token = localStorage.getItem('ehr_token');
      const activeTenant = resolveTenantSlug();
      let patientContext = targetPatient || selectedPatient;
      if (!token || !activeTenant || !patientContext) {
        showError('Missing context', 'Select a patient and ensure session is active.');
        return;
      }

      if ((!patientContext.dateOfBirth || !patientContext.gender) && patientContext.id) {
        try {
          const enrichedResponse = await ehrApi.getPatientById(patientContext.id, token, activeTenant);
          if (enrichedResponse?.data) {
            patientContext = {
              ...patientContext,
              dateOfBirth: enrichedResponse.data.dateOfBirth || patientContext.dateOfBirth,
              gender: enrichedResponse.data.gender || patientContext.gender,
            };
          }
        } catch (e) {
        }
      }

      const derivedAge =
        typeof patientContext.age === 'number' && !Number.isNaN(patientContext.age)
          ? patientContext.age
          : patientContext.dateOfBirth
          ? (() => {
              const dob = new Date(patientContext.dateOfBirth);
              if (Number.isNaN(dob.getTime())) {
                return undefined;
              }
              const diffMs = new Date().getTime() - dob.getTime();
              if (!Number.isFinite(diffMs) || diffMs <= 0) {
                return undefined;
              }
              return Math.floor(diffMs / (1000 * 60 * 60 * 24 * 365.25));
            })()
          : undefined;

      const normalizedGender =
        typeof patientContext.gender === 'string' && patientContext.gender.trim().length > 0
          ? patientContext.gender
          : undefined;
      const patientContextId = patientContext.id;

      setTriageCopilotLoading(true);
      const vitals = sourceAppointment?.vitals || getSelectedPatientLatestVitals();
      const response = await ehrApi.analyzeTriageCopilot(
        {
          patientId: patientContextId,
          age: derivedAge,
          gender: normalizedGender,
          chiefComplaint: sourceAppointment?.reason || appointments.find(a => a.patient.id === patientContextId)?.reason || '',
          symptoms: appointments
            .filter(a => a.patient.id === patientContextId)
            .map(a => a.reason)
            .filter((r) => typeof r === 'string' && r.trim().length > 0),
          vitals,
          allergies: patientContext.allergies,
          chronicConditions: patientContext.chronicConditions,
        },
        token,
        activeTenant
      );
      setTriageCopilotResult(response.data || null);
      if (response.data?.suggestedTriageLevel) {
        const level = String(response.data.suggestedTriageLevel).toLowerCase();
        let mapped: 'urgent' | 'high' | 'normal' | 'low' | null = null;
        if (level.includes('resuscitation') || level.includes('emergency') || level === 'immediate') {
          mapped = 'urgent';
        } else if (level.includes('semi-urgent') || level.includes('semiurgent') || level === 'semi_urgent') {
          mapped = 'high';
        } else if (level.includes('non-urgent') || level.includes('nonurgent') || level === 'non_urgent') {
          mapped = 'normal';
        } else if (['urgent', 'high', 'normal', 'low'].includes(level)) {
          mapped = level as 'urgent' | 'high' | 'normal' | 'low';
        }
        setTriageSuggestedPriority(mapped);
      }
      showSuccess('Triage Copilot Ready', 'Review and confirm suggestions before applying clinically.');
    } catch {
      showError('Triage Copilot Error', 'Unable to analyze triage context right now.');
    } finally {
      setTriageCopilotLoading(false);
    }
  };

  const handleQueueTriageCopilotAnalyze = async (appointment: Appointment) => {
    setSelectedPatient(appointment.patient);
    setActiveTab('triage');
    await handleTriageCopilotAnalyze(appointment.patient, appointment);
  };

  const handleVitalsCopilotInterpret = async () => {
    try {
      const token = localStorage.getItem('ehr_token');
      const activeTenant = resolveTenantSlug();
      const vitals = getSelectedPatientLatestVitals();
      if (!token || !activeTenant || !selectedPatient || !vitals) {
        showError('Missing vitals', 'Select a patient with recorded vitals first.');
        return;
      }

      setVitalsCopilotLoading(true);
      const response = await ehrApi.interpretVitalsCopilot(
        {
          patientId: selectedPatient.id,
          age: selectedPatient.age,
          gender: selectedPatient.gender,
          vitals,
          conditions: selectedPatient.chronicConditions
            ? selectedPatient.chronicConditions.split(',').map((c: string) => c.trim()).filter(Boolean)
            : [],
          allergies: selectedPatient.allergies
            ? selectedPatient.allergies.split(',').map((a: string) => a.trim()).filter(Boolean)
            : [],
        },
        token,
        activeTenant
      );
      setVitalsCopilotResult(response.data || null);
      showSuccess('Vitals Copilot Ready', 'Interpretation generated. Confirm clinically before action.');
    } catch {
      showError('Vitals Copilot Error', 'Unable to interpret vitals right now.');
    } finally {
      setVitalsCopilotLoading(false);
    }
  };

  const handleGenerateNursingDraft = async () => {
    try {
      const token = localStorage.getItem('ehr_token');
      const activeTenant = resolveTenantSlug();
      if (!token || !activeTenant || !selectedPatient) {
        showError('Missing context', 'Select a patient first.');
        return;
      }

      setNotesCopilotLoading(true);
      const relatedAppointments = appointments.filter(a => a.patient.id === selectedPatient.id);
      const response = await ehrApi.generateNurseNoteDraft(
        {
          patientId: selectedPatient.id,
          age: selectedPatient.age,
          gender: selectedPatient.gender,
          chiefComplaint: relatedAppointments[0]?.reason || '',
          observations: relatedAppointments[0]?.notes || '',
          previousNotes: relatedAppointments.map(a => a.notes).filter(Boolean),
          vitals: getSelectedPatientLatestVitals(),
        },
        token,
        activeTenant
      );

      setNotesCopilotDraft(response.data?.draft || '');
      setNotesCopilotProvenance(
        Array.isArray(response.data?.provenance)
          ? response.data.provenance.map((item: any) => String(item)).filter(Boolean)
          : [],
      );
      if (response.data?.draft) {
        showSuccess('Draft Generated', 'Review and edit before saving to chart.');
      } else {
        showError('No Draft', 'No draft could be generated with the available context.');
      }
    } catch {
      showError('Draft Error', 'Unable to generate nursing draft right now.');
    } finally {
      setNotesCopilotLoading(false);
    }
  };

  const handleGenerateHandoff = async () => {
    try {
      const token = localStorage.getItem('ehr_token');
      const activeTenant = resolveTenantSlug();
      if (!token || !activeTenant || !selectedPatient) {
        showError('Missing context', 'Select a patient first.');
        return;
      }

      setHandoffCopilotLoading(true);
      const patientAppointments = appointments.filter(a => a.patient.id === selectedPatient.id);
      const response = await ehrApi.generateNurseHandoffSummary(
        {
          patientId: selectedPatient.id,
          age: selectedPatient.age,
          gender: selectedPatient.gender,
          shiftNotes: patientAppointments.map(a => a.notes).filter(Boolean),
          pendingTasks: [`Pending tasks: ${taskCounts.pending}`, `In progress tasks: ${taskCounts.inProgress}`],
          alerts: [`Active alerts: ${alertCounts.active}`, `Critical alerts: ${alertCounts.critical}`],
          vitals: getSelectedPatientLatestVitals(),
        },
        token,
        activeTenant
      );

      setHandoffCopilotSummary(response.data?.summary || '');
      setHandoffCopilotMeta(response.data || null);
      if (response.data?.summary) {
        showSuccess('Handoff Summary Ready', 'Review before sharing with next shift.');
      } else {
        showError('No Summary', 'No handoff summary was generated.');
      }
    } catch {
      showError('Handoff Error', 'Unable to generate handoff summary right now.');
    } finally {
      setHandoffCopilotLoading(false);
    }
  };

  const loadHandoffWorkflowState = async (patientId: string) => {
    try {
      setHandoffWorkflowLoading(true);
      const token = localStorage.getItem('ehr_token');
      const activeTenant = resolveTenantSlug();
      if (!token || !activeTenant) return;
      const response = await ehrApi.getNurseHandoffState(patientId, token, activeTenant);
      const data = response.data || {};
      setHandoffWorkflow({
        patientId,
        status: data.status || 'draft',
        finalized: !!data.finalized,
        finalizedAt: data.finalizedAt || null,
        finalizedBy: data.finalizedBy || null,
        reviewed: !!data.reviewed,
        reviewedAt: data.reviewedAt || null,
        reviewedBy: data.reviewedBy || null,
        shared: !!data.shared,
        sharedAt: data.sharedAt || null,
        sharedBy: data.sharedBy || null,
      });
    } catch {
    } finally {
      setHandoffWorkflowLoading(false);
    }
  };

  const handleFinalizeHandoffWorkflow = async () => {
    if (!selectedPatient || !handoffCopilotSummary) {
      showError('Missing handoff', 'Generate handoff summary before finalizing.');
      return;
    }
    try {
      setHandoffActionLoading(true);
      const token = localStorage.getItem('ehr_token');
      const activeTenant = resolveTenantSlug();
      if (!token || !activeTenant) {
        showError('Session expired', 'Please log in again.');
        return;
      }

      await ehrApi.finalizeNurseHandoff(
        selectedPatient.id,
        {
          summary: handoffCopilotSummary,
          reason: handoffReviewNote || undefined,
          context: { source: 'nurse_dashboard_handoff' },
        },
        token,
        activeTenant,
      );

      showSuccess('Handoff Finalized', 'Summary is now finalized for shift handover.');
      await loadHandoffWorkflowState(selectedPatient.id);
    } catch {
      showError('Finalize Failed', 'Could not finalize handoff summary.');
    } finally {
      setHandoffActionLoading(false);
    }
  };

  const handleConfirmHandoffReview = async () => {
    if (!selectedPatient) return;
    try {
      setHandoffActionLoading(true);
      const token = localStorage.getItem('ehr_token');
      const activeTenant = resolveTenantSlug();
      if (!token || !activeTenant) {
        showError('Session expired', 'Please log in again.');
        return;
      }

      await ehrApi.confirmNurseHandoffReview(
        selectedPatient.id,
        {
          reviewerName: currentUser?.fullName || `${currentUser?.firstName || ''} ${currentUser?.lastName || ''}`.trim() || currentUser?.email,
          reviewerRole: currentUser?.role || 'nurse',
          reason: handoffReviewNote || undefined,
          context: { source: 'nurse_dashboard_handoff' },
        },
        token,
        activeTenant,
      );

      showSuccess('Reviewer Confirmed', 'Reviewer confirmation has been recorded.');
      await loadHandoffWorkflowState(selectedPatient.id);
    } catch {
      showError('Review Failed', 'Could not record reviewer confirmation.');
    } finally {
      setHandoffActionLoading(false);
    }
  };

  const handleShareHandoffWorkflow = async () => {
    if (!selectedPatient || !handoffCopilotSummary) {
      showError('Missing handoff', 'Generate handoff summary before sharing.');
      return;
    }
    try {
      setHandoffActionLoading(true);
      const token = localStorage.getItem('ehr_token');
      const activeTenant = resolveTenantSlug();
      if (!token || !activeTenant) {
        showError('Session expired', 'Please log in again.');
        return;
      }

      await ehrApi.shareNurseHandoff(
        selectedPatient.id,
        {
          channel: 'in_app',
          recipient: handoffRecipient || 'next_shift',
          reason: handoffReviewNote || undefined,
          context: { source: 'nurse_dashboard_handoff', summary: handoffCopilotSummary.slice(0, 240) },
        },
        token,
        activeTenant,
      );

      showSuccess('Handoff Shared', `Handoff marked as shared to ${handoffRecipient || 'next shift'}.`);
      await loadHandoffWorkflowState(selectedPatient.id);
    } catch {
      showError('Share Failed', 'Could not share handoff summary.');
    } finally {
      setHandoffActionLoading(false);
    }
  };

  useEffect(() => {
    if (!selectedPatient?.id) {
      setHandoffWorkflow({
        patientId: null,
        status: 'draft',
        finalized: false,
        finalizedAt: null,
        finalizedBy: null,
        reviewed: false,
        reviewedAt: null,
        reviewedBy: null,
        shared: false,
        sharedAt: null,
        sharedBy: null,
      });
      return;
    }
    loadHandoffWorkflowState(selectedPatient.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedPatient?.id]);

  const handleCopilotDecision = async (
    copilotType: 'triage' | 'vitals' | 'notes' | 'handoff',
    decision: 'accept' | 'modify' | 'reject',
    recommendationSummary: string,
  ) => {
    try {
      const token = localStorage.getItem('ehr_token');
      const activeTenant = resolveTenantSlug();
      if (!token || !activeTenant) {
        showError('Session expired', 'Please log in again.');
        return;
      }

      await ehrApi.recordCopilotAction(
        {
          copilotType,
          decision,
          reason: copilotDecisionNote || undefined,
          patientId: selectedPatient?.id,
          recommendationSummary,
        },
        token,
        activeTenant,
      );

      showSuccess('Decision Captured', `${copilotType} suggestion marked as ${decision}.`);
      if (decision === 'accept') {
        setCopilotDecisionNote('');
      }
    } catch {
      showError('Audit Error', 'Could not record copilot decision.');
    }
  };

  const handleLogout = () => {
    try {
      window.dispatchEvent(new Event('ehr-logout'));
      // Clear all stored data
      localStorage.removeItem('ehr_token');
      localStorage.removeItem('ehr_user');
      const tenantSlug = localStorage.getItem('ehr_tenant_slug') || localStorage.getItem('ehr_tenant') || '';
      localStorage.removeItem('ehr_tenant');
      localStorage.removeItem('ehr_tenant_slug');
      
      // Show success notification
      showSuccess('Logged Out', 'You have been successfully logged out');
      
      // Redirect to tenant landing
      setTimeout(() => {
        if (tenantSlug) {
          navigate(`/ehr/${tenantSlug}`);
        } else {
          navigate('/ehr');
        }
      }, 1000);
    } catch {
      showError('Logout Error', 'There was an issue logging out. Please try again.');
    }
  };

  const handleRecordVitals = (appointment: Appointment) => {
    if (appointment.paymentStatus === 'awaiting_payment' && !isNurseAccountsUser()) {
      notifyPaymentBlocked(appointment, 'Vitals cannot be recorded while payment is pending');
      return;
    }
    setSelectedPatient(appointment.patient);
    setShowVitalsModal(true);
  };

  const handleTriageAssessment = (appointment: Appointment) => {
    if (appointment.paymentStatus === 'awaiting_payment' && !isNurseAccountsUser()) {
      notifyPaymentBlocked(appointment, 'Triage assessment is locked until payment is confirmed');
      return;
    }
    setSelectedPatient(appointment.patient);
    setActiveTab('triage');
    // setShowAssessmentModal(true); // Switch to tab view instead of modal for better history visibility
  };

  const openVitalsHistory = async (patientId: string, patientName: string) => {
    try {
      setVitalsHistoryPatientId(patientId);
      setVitalsHistoryPatientName(patientName);
      setShowVitalsHistoryModal(true);
      setVitalsHistoryLoading(true);

      const token = localStorage.getItem('ehr_token');
      const activeTenant = resolveTenantSlug();
      if (!token || !activeTenant) {
        showError('Error', 'Missing authentication or tenant information for vitals history.');
        setVitalsHistory([]);
        return;
      }

      const response = await ehrApi.getVitals(patientId, token, activeTenant);
      const vitals = response.data.vitals || [];
      vitals.sort(
        (a: any, b: any) =>
          new Date(b.recordedAt || b.recorded_at).getTime() -
          new Date(a.recordedAt || a.recorded_at).getTime(),
      );
      setVitalsHistory(vitals);
    } catch {
      showError('Error', 'Failed to load vitals history.');
      setVitalsHistory([]);
    } finally {
      setVitalsHistoryLoading(false);
    }
  };

  const fetchPatients = async () => {
    try {
      const token = localStorage.getItem('ehr_token');
      const activeTenant = resolveTenantSlug();
      if (!token || !activeTenant) {
        return;
      }
      const resp = await ehrApi.getPatients(token, activeTenant);
      setPatients(resp.data.patients || []);
    } catch {
    }
  };

  // Pagination helpers
  const getPaginatedPatients = () => {
    const startIndex = (currentPage - 1) * patientsPerPage;
    const endIndex = startIndex + patientsPerPage;
    return filteredPatients.slice(startIndex, endIndex);
  };

  const getTotalPages = () => {
    return Math.ceil(filteredPatients.length / patientsPerPage);
  };

  const getUpcomingAppointmentsForPatient = (patientId: string) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    return appointments.filter(apt => {
      if (apt.patient.id !== patientId) return false;
      const appointmentDate = new Date(apt.appointmentDate);
      appointmentDate.setHours(0, 0, 0, 0);
      return appointmentDate >= today && (
        apt.status === 'scheduled' ||
        apt.status === 'confirmed' ||
        apt.status === 'in-progress' ||
        apt.status === 'in_progress'
      );
    });
  };

  const hasScheduledAppointments = (patientId: string) => {
    return getUpcomingAppointmentsForPatient(patientId).length > 0;
  };

  const getAwaitingPaymentAppointment = (patientId: string) => {
    return getUpcomingAppointmentsForPatient(patientId).find(
      apt => apt.paymentStatus === 'awaiting_payment'
    );
  };

  const handleVitalsForScheduledPatient = (patient: Patient) => {
    const upcomingAppointments = getUpcomingAppointmentsForPatient(patient.id);

    if (upcomingAppointments.length === 0) {
      showError('No Scheduled Appointments', 'This patient has no scheduled appointments. Vitals can only be recorded for patients with appointments.');
      return;
    }

    const awaitingAppointment = upcomingAppointments.find(apt => apt.paymentStatus === 'awaiting_payment');
    if (awaitingAppointment && !isNurseAccountsUser()) {
      notifyPaymentBlocked(awaitingAppointment, 'Vitals cannot be recorded until payment is confirmed');
      return;
    }

    setSelectedPatient(patient);
    setShowVitalsModal(true);
  };

  // Calendar helper functions
  const getWeekDates = (date: Date) => {
    const startOfWeek = new Date(date);
    startOfWeek.setDate(date.getDate() - date.getDay());
    const dates = [];
    for (let i = 0; i < 7; i++) {
      const day = new Date(startOfWeek);
      day.setDate(startOfWeek.getDate() + i);
      dates.push(day);
    }
    return dates;
  };

  const getMonthDates = (date: Date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const firstDay = new Date(year, month, 1);
    const startDate = new Date(firstDay);
    startDate.setDate(startDate.getDate() - firstDay.getDay());
    
    const dates = [];
    for (let i = 0; i < 42; i++) { // 6 weeks * 7 days
      const day = new Date(startDate);
      day.setDate(startDate.getDate() + i);
      dates.push(day);
    }
    return dates;
  };

  const getAppointmentsForDate = (date: Date, appointmentsList: Appointment[] = appointments) => {
    // Normalize dates to compare only year, month, day (ignore time and timezone)
    const normalizeDate = (d: Date) => {
      const normalized = new Date(d);
      normalized.setHours(0, 0, 0, 0);
      return normalized;
    };
    
    const targetDate = normalizeDate(date);
    const targetDateStr = `${targetDate.getFullYear()}-${String(targetDate.getMonth() + 1).padStart(2, '0')}-${String(targetDate.getDate()).padStart(2, '0')}`;
    
    return appointmentsList.filter(apt => {
      const aptDate = new Date(apt.appointmentDate);
      const normalizedAptDate = normalizeDate(aptDate);
      const aptDateStr = `${normalizedAptDate.getFullYear()}-${String(normalizedAptDate.getMonth() + 1).padStart(2, '0')}-${String(normalizedAptDate.getDate()).padStart(2, '0')}`;
      return aptDateStr === targetDateStr;
    });
  };

  const getTypeColorClass = (type: string) => {
    const key = (type || '').toLowerCase();
    if (key.includes('follow')) return 'from-purple-100 to-indigo-100 text-indigo-800 bg-purple-100';
    if (key.includes('consult')) return 'from-blue-100 to-cyan-100 text-blue-800 bg-blue-100';
    if (key.includes('triage')) return 'from-amber-100 to-yellow-100 text-amber-800 bg-amber-100';
    if (key.includes('procedure')) return 'from-rose-100 to-pink-100 text-rose-800 bg-rose-100';
    if (key.includes('med')) return 'from-emerald-100 to-teal-100 text-emerald-800 bg-emerald-100';
    return 'from-slate-100 to-slate-200 text-slate-700 bg-slate-100';
  };

  const handlePrev = () => {
    const d = new Date(calendarDate);
    if (calendarView === 'day') d.setDate(d.getDate() - 1);
    else if (calendarView === 'week') d.setDate(d.getDate() - 7);
    else d.setMonth(d.getMonth() - 1);
    setCalendarDate(d);
  };

  const handleNext = () => {
    const d = new Date(calendarDate);
    if (calendarView === 'day') d.setDate(d.getDate() + 1);
    else if (calendarView === 'week') d.setDate(d.getDate() + 7);
    else d.setMonth(d.getMonth() + 1);
    setCalendarDate(d);
  };

  const handleDayClick = (date: Date) => {
    setCalendarDate(date);
    setCalendarView('day');
  };

  const handleDragStart = (appointmentId: string) => {
    setDraggingAppointmentId(appointmentId);
  };

  const handleDayDrop = async (date: Date) => {
    try {
      if (!draggingAppointmentId) return;
      const token = localStorage.getItem('ehr_token');
      if (!token) return;
      
      // Find appointment in either appointments or calendarAppointments
      const apt = appointments.find(a => a.id === draggingAppointmentId) || 
                  calendarAppointments.find(a => a.id === draggingAppointmentId);
      if (!apt) return;
      
      const old = new Date(apt.appointmentDate);
      const newDate = new Date(date.getFullYear(), date.getMonth(), date.getDate(), old.getHours(), old.getMinutes());
      await ehrApi.updateAppointment(apt.id, { appointmentDate: newDate.toISOString() }, token, tenantSlug!);
      
      // Update both appointment lists
      setAppointments(prev => prev.map(a => a.id === apt.id ? { ...a, appointmentDate: newDate.toISOString() } : a));
      setCalendarAppointments(prev => prev.map(a => a.id === apt.id ? { ...a, appointmentDate: newDate.toISOString() } : a));
      
      showSuccess('Rescheduled', 'Appointment moved successfully');
    } catch {
      showError('Error', 'Failed to reschedule');
    } finally {
      setDraggingAppointmentId(null);
    }
  };

  const renderDayView = (appointments: Appointment[]) => {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {appointments.map((appointment) => {
          const awaitingPayment = appointment.paymentStatus === 'awaiting_payment';
          const feeEstimate = formatCurrency(appointment.feeAmount ?? null);

          return (
            <div
              key={appointment.id}
              draggable
              onDragStart={() => handleDragStart(appointment.id)}
              className={`bg-gradient-to-br from-white to-slate-50 rounded-xl p-4 border ${awaitingPayment ? 'border-amber-300' : 'border-slate-200/50'} ${awaitingPayment ? 'opacity-90 ring-1 ring-amber-200' : ''} hover:shadow-md transition-all duration-200`}
            >
              <div className="flex items-start gap-3">
                <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${awaitingPayment ? 'bg-gradient-to-r from-amber-500 to-orange-600' : 'bg-gradient-to-r from-blue-500 to-indigo-600'}`}>
                  <Clock className="w-5 h-5 text-white" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h4 className="font-semibold text-slate-900 truncate">
                      {appointment.patient.firstName} {appointment.patient.lastName}
                    </h4>
                    {awaitingPayment && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-100 text-amber-700 border border-amber-300">
                        <CreditCard className="w-3 h-3" /> Awaiting Payment
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-slate-600">
                    {new Date(appointment.appointmentDate).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} • {appointment.durationMinutes} min
                  </p>
                  <div className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium bg-gradient-to-r ${getTypeColorClass(appointment.appointmentType)} mb-1`}>
                    {appointment.appointmentType || 'Appointment'}
                  </div>
                  <p className="text-xs text-slate-500">
                    Dr. {appointment.doctor.firstName} {appointment.doctor.lastName}
                  </p>
                  <div className="flex items-center gap-2 mt-2 flex-wrap">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                      appointment.priorityLevel === 'urgent' ? 'bg-red-100 text-red-800' :
                      appointment.priorityLevel === 'high' ? 'bg-orange-100 text-orange-800' :
                      appointment.priorityLevel === 'normal' ? 'bg-blue-100 text-blue-800' :
                      'bg-gray-100 text-gray-800'
                    }`}>
                      {appointment.priorityLevel}
                    </span>
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                      appointment.status === 'scheduled' ? 'bg-blue-100 text-blue-800' :
                      appointment.status === 'confirmed' ? 'bg-green-100 text-green-800' :
                      appointment.status === 'in-progress' ? 'bg-yellow-100 text-yellow-800' :
                      'bg-gray-100 text-gray-800'
                    }`}>
                      {appointment.status}
                    </span>
                    {feeEstimate && (
                      <span className="px-2 py-1 rounded-full text-xs font-medium bg-slate-100 text-slate-700">
                        Fee: {feeEstimate}
                      </span>
                    )}
                  </div>
                  {appointment.reason && (
                    <p className="text-xs text-slate-500 mt-1 truncate">
                      {appointment.reason}
                    </p>
                  )}
                  {awaitingPayment && (
                    <div className="mt-2 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-2 py-1 flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <Lock className="w-3 h-3" />
                        <span>
                          {isNurseAccountsUser()
                            ? 'Payment pending. Record payment to unlock vitals and triage.'
                            : 'Accounts must confirm payment before vitals or triage can begin.'}
                        </span>
                      </div>
                      {isNurseAccountsUser() && (
                        <button
                          type="button"
                          onClick={() => openPaymentForAppointment(appointment)}
                          className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-amber-600 text-white font-semibold hover:bg-amber-700 transition-colors"
                        >
                          <CreditCard className="w-3 h-3" />
                          Record Payment
                        </button>
                      )}
                    </div>
                  )}
                  
                  {/* Quick Actions */}
                  {!awaitingPayment && (
                    <div className="mt-3 flex flex-wrap gap-2">
                      <button
                        onClick={() => handleRecordVitals(appointment)}
                        className="flex-1 min-w-[100px] px-2 py-1.5 bg-gradient-to-r from-red-500 to-pink-600 hover:from-red-600 hover:to-pink-700 text-white rounded-lg transition-colors flex items-center justify-center gap-1 text-xs font-medium"
                      >
                        <Heart className="w-3 h-3" />
                        Vitals
                      </button>
                      <button
                        onClick={() => handleTriageAssessment(appointment)}
                        className="flex-1 min-w-[100px] px-2 py-1.5 bg-gradient-to-r from-orange-500 to-yellow-600 hover:from-orange-600 hover:to-yellow-700 text-white rounded-lg transition-colors flex items-center justify-center gap-1 text-xs font-medium"
                      >
                        <ClipboardList className="w-3 h-3" />
                        Triage
                      </button>
                      <button
                        onClick={() => {
                          setCarePlansPatientId(appointment.patient.id);
                          setCarePlansPatientName(`${appointment.patient.firstName} ${appointment.patient.lastName}`);
                          setShowCarePlansModal(true);
                        }}
                        className="flex-1 min-w-[100px] px-2 py-1.5 bg-gradient-to-r from-teal-500 to-cyan-600 hover:from-teal-600 hover:to-cyan-700 text-white rounded-lg transition-colors flex items-center justify-center gap-1 text-xs font-medium"
                      >
                        <Target className="w-3 h-3" />
                        Care Plans
                      </button>
                      <button
                        onClick={() => {
                          setLabResultsPatientId(appointment.patient.id);
                          setLabResultsPatientName(`${appointment.patient.firstName} ${appointment.patient.lastName}`);
                          setShowLabResultsModal(true);
                        }}
                        className="flex-1 min-w-[100px] px-2 py-1.5 bg-gradient-to-r from-purple-500 to-indigo-600 hover:from-purple-600 hover:to-indigo-700 text-white rounded-lg transition-colors flex items-center justify-center gap-1 text-xs font-medium"
                      >
                        <TestTube className="w-3 h-3" />
                        Lab Results
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  const renderWeekView = (appointmentsList: Appointment[]) => {
    const refDate = calendarDate;
    const weekDates = getWeekDates(refDate);
    
    return (
      <div className="grid grid-cols-7 gap-2 bg-white">
        {weekDates.map((date, index) => {
          const dayAppointments = getAppointmentsForDate(date, appointmentsList);
          const isToday = date.toDateString() === new Date().toDateString();
          
          return (
            <div key={index} className={`rounded-lg border-2 ${isToday ? 'border-blue-500 bg-blue-50' : 'border-slate-200 bg-white'}`} onDragOver={(e) => e.preventDefault()} onDrop={() => handleDayDrop(date)}>
              <button onClick={() => handleDayClick(date)} className={`w-full text-left p-3 text-center ${isToday ? 'bg-blue-500 text-white' : 'bg-slate-100 text-slate-700'}`}>
                <div className="text-sm font-semibold">{date.toLocaleDateString('en-US', { weekday: 'short' })}</div>
                <div className="text-lg font-bold">{date.getDate()}</div>
              </button>
              <div className="p-2 min-h-[120px] bg-white">
                {dayAppointments.length === 0 ? (
                  <div className="text-xs text-slate-400 text-center py-4 bg-white">No appointments</div>
                ) : (
                  dayAppointments.map((apt) => (
                    <div key={apt.id} draggable onDragStart={() => handleDragStart(apt.id)} className={`mb-2 p-2 bg-gradient-to-r ${getTypeColorClass(apt.appointmentType || 'consultation')} rounded text-xs cursor-move hover:shadow-md transition-shadow`}>
                      <div className="font-semibold truncate">{apt.patient.firstName} {apt.patient.lastName}</div>
                      <div className="text-slate-700">
                        {new Date(apt.appointmentDate).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  const renderMonthView = (appointmentsList: Appointment[]) => {
    const today = new Date();
    const monthDates = getMonthDates(calendarDate);
    
    return (
      <div className="grid grid-cols-7 gap-1 bg-white">
        {/* Month header */}
        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
          <div key={day} className="p-3 text-center text-sm font-semibold text-slate-600 bg-slate-100 rounded">
            {day}
          </div>
        ))}
        
        {/* Calendar days */}
        {monthDates.map((date, index) => {
          const dayAppointments = getAppointmentsForDate(date, appointmentsList);
          const isToday = date.toDateString() === today.toDateString();
          const isCurrentMonth = date.getMonth() === calendarDate.getMonth();
          
          return (
            <div key={index} className={`min-h-[100px] p-2 border border-slate-200 rounded ${isCurrentMonth ? 'bg-white' : 'bg-slate-50'} hover:border-slate-300 transition-colors`} onDragOver={(e) => e.preventDefault()} onDrop={() => handleDayDrop(date)}>
              <button onClick={() => handleDayClick(date)} className={`text-sm font-semibold mb-1 ${isToday ? 'text-blue-600 bg-blue-100 rounded-full w-6 h-6 flex items-center justify-center' : 'text-slate-700'}`}>
                {date.getDate()}
              </button>
              <div className="space-y-1 bg-transparent">
                {dayAppointments.length === 0 ? (
                  <div className="text-xs text-slate-300 text-center py-1 bg-transparent">—</div>
                ) : (
                  <>
                    {dayAppointments.slice(0, 2).map((apt) => (
                      <div key={apt.id} draggable onDragStart={() => handleDragStart(apt.id)} className={`text-xs p-1 bg-gradient-to-r ${getTypeColorClass(apt.appointmentType || 'consultation')} rounded truncate cursor-move hover:shadow-sm transition-shadow`}>
                        <div className="font-medium">{apt.patient.firstName}</div>
                        <div className="text-slate-700">
                          {new Date(apt.appointmentDate).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </div>
                      </div>
                    ))}
                    {dayAppointments.length > 2 && (
                      <div className="text-xs text-slate-500 text-center font-medium bg-transparent">
                        +{dayAppointments.length - 2} more
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  // Enhanced calendar data fetching using new backend APIs
  const fetchCalendarAppointments = async () => {
    try {
      setCalendarLoading(true);
      const token = localStorage.getItem('ehr_token');
      if (!token) return;

      let fetchedAppointments: Appointment[] = [];

      if (calendarView === 'month') {
        // Use enhanced month view API
        const response = await ehrApi.getMonthView(
          calendarDate.getFullYear(),
          calendarDate.getMonth() + 1,
          token,
          tenantSlug!
        );
        // Flatten appointmentsByDate into array and transform structure
        const allAppointments: Appointment[] = [];
        Object.values(response.data.appointmentsByDate || {}).forEach((dayAppointments: any) => {
          dayAppointments.forEach((apt: any) => {
            // Transform backend structure to frontend structure
            // Backend sends: { patient: { name: "First Last", ... }, doctor: { name: "First Last", ... }, type, start, ... }
            // Frontend expects: { patient: { firstName, lastName, ... }, doctor: { firstName, lastName, ... }, appointmentType, appointmentDate, ... }
            const patientName = apt.patient?.name || '';
            const doctorName = apt.doctor?.name || '';
            const [patientFirstName = '', ...patientLastNameParts] = patientName.split(' ');
            const [doctorFirstName = '', ...doctorLastNameParts] = doctorName.split(' ');
            
            const transformed: Appointment = {
              id: apt.id,
              appointmentDate: apt.start || apt.appointmentDate,
              appointmentType: apt.type || apt.appointmentType || 'consultation',
              durationMinutes: apt.durationMinutes || 30,
              status: apt.status || 'scheduled',
              reason: apt.reason || '',
              notes: apt.notes || '',
              priorityLevel: apt.priorityLevel || 'normal',
              paymentStatus: apt.paymentStatus || null,
              feeAmount: apt.feeAmount || null,
              patient: {
                id: apt.patient?.id || '',
                firstName: apt.patient?.firstName || patientFirstName,
                lastName: apt.patient?.lastName || patientLastNameParts.join(' ') || '',
                patientNumber: apt.patient?.patientNumber || '',
                phone: apt.patient?.phone || '',
                email: apt.patient?.email || '',
                dateOfBirth: apt.patient?.dateOfBirth || '',
                gender: apt.patient?.gender || '',
                bloodType: apt.patient?.bloodType || '',
                allergies: apt.patient?.allergies || '',
                chronicConditions: apt.patient?.chronicConditions || ''
              },
              doctor: {
                id: apt.doctor?.id || '',
                firstName: apt.doctor?.firstName || doctorFirstName,
                lastName: apt.doctor?.lastName || doctorLastNameParts.join(' ') || '',
              },
              vitals: undefined,
            };
            allAppointments.push(transformed);
          });
        });
        fetchedAppointments = allAppointments;
      } else if (calendarView === 'week') {
        // Use enhanced week view API
        const weekStart = new Date(calendarDate);
        const dayOfWeek = weekStart.getDay();
        const diff = weekStart.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1);
        weekStart.setDate(diff);
        
        // Use local date string
        const year = weekStart.getFullYear();
        const month = String(weekStart.getMonth() + 1).padStart(2, '0');
        const day = String(weekStart.getDate()).padStart(2, '0');
        const weekStartString = `${year}-${month}-${day}`;
        
        const response = await ehrApi.getWeekView(weekStartString, token, tenantSlug!);
        // Flatten appointmentsByDay into array and transform structure
        const allAppointments: Appointment[] = [];
        Object.values(response.data.appointmentsByDay || {}).forEach((dayAppointments: any) => {
          dayAppointments.forEach((apt: any) => {
            // Transform backend structure to frontend structure
            const patientName = apt.patient?.name || '';
            const doctorName = apt.doctor?.name || '';
            const [patientFirstName = '', ...patientLastNameParts] = patientName.split(' ');
            const [doctorFirstName = '', ...doctorLastNameParts] = doctorName.split(' ');
            
            const transformed: Appointment = {
              id: apt.id,
              appointmentDate: apt.start || apt.appointmentDate,
              appointmentType: apt.type || apt.appointmentType || 'consultation',
              durationMinutes: apt.durationMinutes || 30,
              status: apt.status || 'scheduled',
              reason: apt.reason || '',
              notes: apt.notes || '',
              priorityLevel: apt.priorityLevel || 'normal',
              paymentStatus: apt.paymentStatus || null,
              feeAmount: apt.feeAmount || null,
              patient: {
                id: apt.patient?.id || '',
                firstName: apt.patient?.firstName || patientFirstName,
                lastName: apt.patient?.lastName || patientLastNameParts.join(' ') || '',
                patientNumber: apt.patient?.patientNumber || '',
                phone: apt.patient?.phone || '',
                email: apt.patient?.email || '',
                dateOfBirth: apt.patient?.dateOfBirth || '',
                gender: apt.patient?.gender || '',
                bloodType: apt.patient?.bloodType || '',
                allergies: apt.patient?.allergies || '',
                chronicConditions: apt.patient?.chronicConditions || ''
              },
              doctor: {
                id: apt.doctor?.id || '',
                firstName: apt.doctor?.firstName || doctorFirstName,
                lastName: apt.doctor?.lastName || doctorLastNameParts.join(' ') || '',
              },
              vitals: undefined,
            };
            allAppointments.push(transformed);
          });
        });
        fetchedAppointments = allAppointments;
      } else {
        // Day view - use existing API
        // Use local date string to ensure we fetch for the correct day in the user's timezone
        const getLocalDateString = (date: Date) => {
          const year = date.getFullYear();
          const month = String(date.getMonth() + 1).padStart(2, '0');
          const day = String(date.getDate()).padStart(2, '0');
          return `${year}-${month}-${day}`;
        };
        const dateStr = getLocalDateString(calendarDate);
        const response = await ehrApi.getAppointments(token, tenantSlug!, { date: dateStr });
        fetchedAppointments = response.data.appointments || [];
      }

      // Fetch vitals for appointments
      const appointmentsWithVitals = await fetchVitalsForAppointments(fetchedAppointments);
      setCalendarAppointments(appointmentsWithVitals);
    } catch {
      // Fallback to today's appointments
      setCalendarAppointments(appointments);
    } finally {
      setCalendarLoading(false);
    }
  };

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (activeTab === 'calendar') {
      fetchCalendarAppointments();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [calendarDate, calendarView, activeTab]);

  const renderCalendar = () => {
    const today = new Date();
    // Use calendarAppointments for all views to ensure date navigation works correctly
    const appointmentsToDisplay = calendarAppointments;
    const dayAppointments = getAppointmentsForDate(calendarDate, appointmentsToDisplay);
    const isToday = calendarDate.toDateString() === today.toDateString();
    
    return (
      <div className="space-y-6">
        {/* Today's Schedule Header */}
        <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl p-6 border border-blue-200/50">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold text-slate-900">
                {calendarView === 'day' ? (isToday ? "Today's Schedule" : "Daily Schedule") : 
                 calendarView === 'week' ? "Week View" : 
                 "Month View"}
              </h2>
              <p className="text-slate-600">
                {formatDateToDDMMYYYY(calendarDate)} • {dayAppointments.length} appointments
                {calendarView !== 'day' && ` • ${appointmentsToDisplay.length} total in view`}
              </p>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={() => {
                  fetchTodayAppointments();
                  fetchCalendarAppointments();
                }}
                disabled={loading || calendarLoading}
                className="p-2 hover:bg-white/50 rounded-lg transition-all duration-200 disabled:opacity-50"
              >
                <RefreshCw className={`w-5 h-5 text-slate-600 ${loading || calendarLoading ? 'animate-spin' : ''}`} />
              </button>
            </div>
          </div>
        </div>

        {/* Calendar View */}
        <div className="bg-white rounded-xl shadow-lg border border-slate-200/50 overflow-hidden">
          {/* Calendar Header */}
          <div className="bg-gradient-to-r from-slate-50 to-blue-50 p-6 border-b border-slate-200/50">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-slate-900">
                {calendarView === 'day' && calendarDate.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                {calendarView === 'week' && `Week of ${getWeekDates(calendarDate)[0].toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - ${getWeekDates(calendarDate)[6].toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`}
                {calendarView === 'month' && calendarDate.toLocaleDateString('en-US', { year: 'numeric', month: 'long' })}
              </h3>
              <div className="flex items-center gap-2 mr-4">
                <button onClick={handlePrev} className="px-3 py-1 rounded-lg text-sm font-medium text-slate-600 hover:bg-slate-100">Prev</button>
                <button onClick={() => setCalendarDate(new Date())} className="px-3 py-1 rounded-lg text-sm font-medium text-slate-600 hover:bg-slate-100">Today</button>
                <button onClick={handleNext} className="px-3 py-1 rounded-lg text-sm font-medium text-slate-600 hover:bg-slate-100">Next</button>
              </div>
              <div className="flex items-center gap-2">
                <button 
                  onClick={() => setCalendarView('day')}
                  className={`px-3 py-1 rounded-lg text-sm font-medium transition-all duration-200 ${
                    calendarView === 'day' 
                      ? 'bg-blue-500 text-white shadow-md' 
                      : 'text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  Day
                </button>
                <button 
                  onClick={() => setCalendarView('week')}
                  className={`px-3 py-1 rounded-lg text-sm font-medium transition-all duration-200 ${
                    calendarView === 'week' 
                      ? 'bg-blue-500 text-white shadow-md' 
                      : 'text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  Week
                </button>
                <button 
                  onClick={() => setCalendarView('month')}
                  className={`px-3 py-1 rounded-lg text-sm font-medium transition-all duration-200 ${
                    calendarView === 'month' 
                      ? 'bg-blue-500 text-white shadow-md' 
                      : 'text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  Month
                </button>
              </div>
            </div>
          </div>

          {/* Calendar Content */}
          <div className="p-6 bg-white">
            {calendarLoading ? (
              <div className="text-center py-12 bg-white">
                <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
                <p className="mt-2 text-slate-600">Loading calendar...</p>
              </div>
            ) : calendarView === 'day' && dayAppointments.length === 0 ? (
              <div className="text-center py-12 bg-white">
                <Calendar className="w-16 h-16 text-slate-300 mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-slate-600 mb-2">No appointments</h3>
                <p className="text-slate-500">No appointments for this day.</p>
              </div>
            ) : (
              (() => {
                switch (calendarView) {
                  case 'day':
                    return renderDayView(dayAppointments);
                  case 'week':
                    return renderWeekView(appointmentsToDisplay);
                  case 'month':
                    return renderMonthView(appointmentsToDisplay);
                  default:
                    return renderDayView(dayAppointments);
                }
              })()
            )}
          </div>
        </div>
      </div>
    );
  };

  const renderDashboard = () => {
    const deriveMhQuickRiskLevel = (tool: string, score: number): 'low' | 'moderate' | 'high' => {
      if (tool === 'PHQ9') {
        if (score >= 15) return 'high';
        if (score >= 10) return 'moderate';
      }
      if (tool === 'GAD7') {
        if (score >= 15) return 'high';
        if (score >= 10) return 'moderate';
      }
      return 'low';
    };

    const runMhQuickInterpretation = async () => {
      const numericScore = Number(mhQuickScore);
      if (Number.isNaN(numericScore)) {
        showError('Mental health', 'Enter a valid score before interpreting');
        return;
      }

      try {
        const result = await cdssApi.interpretMhScreening({
          tool: mhQuickTool,
          score: numericScore,
          language_code: mhQuickLanguage,
        });
        setMhQuickResult(result);

        const derivedRisk = deriveMhQuickRiskLevel(mhQuickTool, numericScore);
        if (derivedRisk !== 'low') {
          const safetyPlan = await cdssApi.getMhSafetyPlanTemplate({ risk_level: derivedRisk });
          setMhQuickSafetyPlan(safetyPlan);
        } else {
          setMhQuickSafetyPlan(null);
        }
      } catch {
        showError('Mental health', 'Failed to interpret the screening score');
      }
    };

    const openMentalHealthWorkspace = (targetTab: 'careplans' | 'screening' | 'followups' | 'safeplan') => {
      if (!selectedPatient) {
        showError('Mental health', 'Select a patient from the queue first');
        return;
      }
      setMentalHealthInitialTab(targetTab);
      setShowMentalHealthModal(true);
    };

    const getStatGradient = (label: string) => {
      switch (label) {
        case 'Patients Waiting': return 'from-blue-500 to-cyan-600';
        case 'In Progress': return 'from-yellow-500 to-orange-600';
        case 'Vitals Recorded': return 'from-purple-500 to-pink-600';
        case 'Urgent Cases': return 'from-red-500 to-rose-600';
        case 'Completed Today': return 'from-green-500 to-emerald-600';
        case 'Awaiting Payment': return 'from-amber-500 to-orange-600';
        case 'Cross-Module': return 'from-violet-500 to-indigo-600';
        default: return 'from-slate-500 to-slate-600';
      }
    };

    return (
      <div className="space-y-6 sm:space-y-8">
        {/* Quick Stats - Compact Informational Section */}
        <div className="bg-white/60 backdrop-blur-sm rounded-2xl border border-slate-200/50 p-4 sm:p-6 shadow-md">
          <div className="flex items-center gap-2 mb-4">
            <BarChart3 className="w-5 h-5 text-slate-600" />
            <h3 className="text-lg font-bold text-slate-900">Today's Statistics</h3>
            <span className="text-xs text-slate-500 ml-auto">Real-time metrics</span>
          </div>
          
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 sm:gap-3">
            {quickStats.map((stat, index) => (
              <div 
                key={index} 
                className="relative overflow-hidden rounded-lg sm:rounded-xl shadow-sm hover:shadow-md transition-all duration-200 group"
              >
                {/* Gradient Background - Subtle */}
                <div className={`absolute inset-0 bg-gradient-to-br ${getStatGradient(stat.label)} opacity-10 group-hover:opacity-20 transition-opacity`}></div>
                
                {/* Content - Compact */}
                <div className="relative p-3 sm:p-4">
                  <div className="flex items-center gap-2 mb-2">
                    {/* Small Icon */}
                    <div className={`p-1.5 sm:p-2 bg-gradient-to-br ${getStatGradient(stat.label)} rounded-md sm:rounded-lg`}>
                      <stat.icon className="w-3 h-3 sm:w-4 sm:h-4 text-white" />
                    </div>
                    
                    {/* Value - Compact */}
                    <div className={`text-xl sm:text-2xl font-bold bg-gradient-to-br ${getStatGradient(stat.label)} bg-clip-text text-transparent`}>
                      {stat.value}
                    </div>
                  </div>
                  
                  {/* Label - Small */}
                  <div className="text-[10px] sm:text-xs font-medium text-slate-600 leading-tight">
                    {stat.label}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white/70 backdrop-blur-sm rounded-2xl border border-slate-200/60 p-4 sm:p-6 shadow-md">
          <div className="flex items-center justify-between gap-3 mb-4">
            <div>
              <h3 className="text-lg font-bold text-slate-900">AI/CDSS Outcome Snapshot</h3>
              <p className="text-sm text-slate-600">
                Live nurse queue execution and SLA outcomes for the last {outcomeWindowDays} days.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  void Promise.all([
                    loadNurseOutcomeAnalytics(30),
                    loadPostVisitTrialAnalytics(30),
                    loadPostVisitTrialSlaAccountability(30),
                  ]);
                }}
                className="px-3 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 flex items-center gap-2 text-sm font-semibold"
              >
                <RefreshCw className={`w-4 h-4 ${nurseOutcomeAnalyticsLoading || postVisitTrialAnalyticsLoading || postVisitTrialSlaAccountabilityLoading ? 'animate-spin' : ''}`} />
                Refresh
              </button>
              <button
                type="button"
                onClick={() => {
                  void exportPostVisitTrialAudit();
                }}
                disabled={postVisitTrialAuditExportLoading}
                className="px-3 py-2 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 flex items-center gap-2 text-sm font-semibold disabled:opacity-60"
              >
                <ArrowDown className={`w-4 h-4 ${postVisitTrialAuditExportLoading ? 'animate-bounce' : ''}`} />
                {postVisitTrialAuditExportLoading ? 'Exporting…' : 'Export Trial Audit'}
              </button>
            </div>
          </div>

          {nurseOutcomeAnalyticsLoading && !nurseOutcomeAnalytics && !postVisitTrialAnalytics && !postVisitTrialSlaAccountability ? (
            <div className="py-8 flex items-center justify-center text-slate-600">
              <Loader2 className="w-5 h-5 animate-spin mr-2" />
              Loading outcome metrics...
            </div>
          ) : nurseOutcomeAnalytics ? (
            <>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-3">
                  <p className="text-xs font-semibold text-slate-500">Queue Completion</p>
                  <p className="text-xl font-bold text-slate-900">
                    {outcomeQueue?.completionRatePercent ?? 0}%
                  </p>
                </div>
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-3">
                  <p className="text-xs font-semibold text-slate-500">Active Queue</p>
                  <p className="text-xl font-bold text-slate-900">
                    {outcomeQueue?.activeItems ?? 0}
                  </p>
                </div>
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-3">
                  <p className="text-xs font-semibold text-slate-500">Pending &gt;24h</p>
                  <p className="text-xl font-bold text-slate-900">
                    {outcomeQueue?.pendingOlderThan24h ?? 0}
                  </p>
                </div>
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-3">
                  <p className="text-xs font-semibold text-slate-500">HIV Actions Executed</p>
                  <p className="text-xl font-bold text-slate-900">
                    {outcomeExecution?.executedActionsTotal ?? 0}
                  </p>
                </div>
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-3">
                  <p className="text-xs font-semibold text-slate-500">Reused/Idempotent</p>
                  <p className="text-xl font-bold text-slate-900">
                    {outcomeExecution?.reusedOrIdempotentTotal ?? 0}
                  </p>
                </div>
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-3">
                  <p className="text-xs font-semibold text-slate-500">Maternity SLA Breached</p>
                  <p className="text-xl font-bold text-slate-900">
                    {outcomeMaternity?.breached ?? 0}
                  </p>
                </div>
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-3">
                  <p className="text-xs font-semibold text-slate-500">Trial Enrolled</p>
                  <p className="text-xl font-bold text-slate-900">
                    {postVisitTrialAnalytics?.trialFunnel?.enrolled ?? 0}
                  </p>
                </div>
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-3">
                  <p className="text-xs font-semibold text-slate-500">Trial SLA Breached</p>
                  <p className="text-xl font-bold text-slate-900">
                    {postVisitTrialAnalytics?.trialDecisionSla?.breachedEscalations ?? 0}
                  </p>
                </div>
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-3">
                  <p className="text-xs font-semibold text-slate-500">Memory Active/Retired</p>
                  <p className="text-xl font-bold text-slate-900">
                    {(postVisitTrialAnalytics?.companionMemory?.active ?? 0)}/{(postVisitTrialAnalytics?.companionMemory?.retired ?? 0)}
                  </p>
                </div>
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-3">
                  <p className="text-xs font-semibold text-slate-500">SLA Clinicians</p>
                  <p className="text-xl font-bold text-slate-900">
                    {postVisitTrialSlaAccountability?.summary?.cliniciansWithAssignments ?? 0}
                  </p>
                </div>
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-3">
                  <p className="text-xs font-semibold text-amber-700">Trial Breached Open</p>
                  <p className="text-xl font-bold text-amber-800">
                    {postVisitTrialSlaAccountability?.summary?.breachedOpenEscalations ?? 0}
                  </p>
                </div>
                <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3">
                  <p className="text-xs font-semibold text-emerald-700">Trial SLA Compliance</p>
                  <p className="text-xl font-bold text-emerald-800">
                    {postVisitTrialSlaAccountability?.summary?.resolvedWithinSlaPercent ?? 0}%
                  </p>
                </div>
              </div>

              {Array.isArray(postVisitTrialSlaAccountability?.items) && (postVisitTrialSlaAccountability?.items?.length ?? 0) > 0 && (
                <div className="mt-3 rounded-lg border border-slate-200 bg-slate-50 p-3">
                  <p className="text-xs font-semibold text-slate-600 mb-2">Top Trial SLA Accountability</p>
                  <div className="space-y-1">
                    {(postVisitTrialSlaAccountability?.items ?? []).slice(0, 4).map((item, index) => {
                      const clinicianName = [item.clinician?.firstName, item.clinician?.lastName].filter(Boolean).join(' ').trim();
                      return (
                        <p key={`${item.clinician?.id || 'clinician'}-${index}`} className="text-xs text-slate-700">
                          {clinicianName || item.clinician?.id || 'Unassigned'}: open {item.openCount ?? 0} • breached {item.breachedOpenCount ?? 0} • SLA {item.resolvedWithinSlaPercent ?? 0}%
                        </p>
                      );
                    })}
                  </div>
                </div>
              )}

              <div className="mt-3 text-xs text-slate-500">
                Last generated:{' '}
                {nurseOutcomeAnalytics.generatedAt
                  ? formatDateTimeToDDMMYYYYHHMM(nurseOutcomeAnalytics.generatedAt)
                  : 'n/a'}
              </div>
            </>
          ) : (
            <div className="py-8 text-sm text-slate-600">No outcome analytics available yet.</div>
          )}
        </div>

        <NurseCrossModuleEscalations
          items={crossModuleItems}
          summary={crossModuleSummary}
          loading={crossModuleLoading}
          compact
          acknowledgingTaskId={acknowledgingCrossModuleTaskId}
          workflowActionItemId={updatingCrossModuleWorkflowItemId}
          recommendationActionKey={executingRecommendationActionKey}
          onRefresh={loadCrossModuleFeed}
          onOpenWorkflow={handleOpenCrossModuleWorkflow}
          onAcknowledgeMaternityTask={handleAcknowledgeCrossModuleMaternityTask}
          onUpdateWorkflowStatus={handleUpdateCrossModuleWorkflowStatus}
          onExecuteRecommendationAction={handleExecuteRecommendationAction}
        />

      <div className="rounded-2xl border border-slate-200/60 bg-white/70 p-4 shadow-md backdrop-blur-sm">
        <div className="mb-4 flex items-center gap-2">
          <Brain className="h-5 w-5 text-violet-600" />
          <div>
            <h3 className="text-lg font-bold text-slate-900">Mental Health / mhGAP</h3>
            <p className="text-sm text-slate-600">Quick screening interpretation, safety planning, and care-plan handoff.</p>
          </div>
        </div>

        <div className="grid gap-3 md:grid-cols-4">
          <select
            value={mhQuickTool}
            onChange={(event) => setMhQuickTool(event.target.value)}
            className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700"
          >
            {mhQuickTools.map((tool) => (
              <option key={tool.id} value={tool.id}>
                {tool.name}
              </option>
            ))}
          </select>
          <select
            value={mhQuickLanguage}
            onChange={(event) => setMhQuickLanguage(event.target.value)}
            className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700"
          >
            {(mhQuickTools.find((tool) => tool.id === mhQuickTool)?.languages || ['en']).map((languageCode) => (
              <option key={languageCode} value={languageCode}>
                {languageCode.toUpperCase()}
              </option>
            ))}
          </select>
          <input
            type="number"
            value={mhQuickScore}
            onChange={(event) => setMhQuickScore(event.target.value)}
            placeholder="Enter total score"
            className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700"
          />
          <button
            type="button"
            onClick={() => {
              void runMhQuickInterpretation();
            }}
            className="rounded-xl bg-violet-600 px-4 py-2 text-sm font-semibold text-white hover:bg-violet-700"
          >
            Interpret score
          </button>
        </div>

        {mhQuickResult && (
          <div className="mt-4 rounded-xl border border-violet-200 bg-violet-50 p-4">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm font-semibold text-violet-900">{mhQuickResult.tool_name || mhQuickResult.tool}</span>
              <span className="rounded-full bg-white px-2 py-0.5 text-xs font-medium text-violet-700">
                {mhQuickResult.severity}
              </span>
            </div>
            <p className="mt-2 text-sm text-violet-800">{mhQuickResult.action}</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => openMentalHealthWorkspace('careplans')}
                className="rounded-lg bg-white px-3 py-2 text-sm font-medium text-violet-700 hover:bg-violet-100"
              >
                Open care plan form
              </button>
              <button
                type="button"
                onClick={() => openMentalHealthWorkspace('screening')}
                className="rounded-lg bg-white px-3 py-2 text-sm font-medium text-violet-700 hover:bg-violet-100"
              >
                Open screening workspace
              </button>
            </div>
          </div>
        )}

        {mhQuickSafetyPlan && (
          <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-4">
            <div className="flex items-center gap-2">
              <Shield className="h-4 w-4 text-red-600" />
              <p className="text-sm font-semibold text-red-800">Safety plan template</p>
            </div>
            <p className="mt-2 text-sm text-red-700">{mhQuickSafetyPlan.emergency_action}</p>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-red-700">
              {(mhQuickSafetyPlan.warning_signs || []).slice(0, 3).map((item: string) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
            <button
              type="button"
              onClick={() => openMentalHealthWorkspace('safeplan')}
              className="mt-3 rounded-lg bg-white px-3 py-2 text-sm font-medium text-red-700 hover:bg-red-100"
            >
              Open safety plan workspace
            </button>
          </div>
        )}
      </div>

      {/* Quick Actions - Prominent Clickable Cards */}
      <div>
        <div className="flex items-center gap-2 mb-4">
          <Activity className="w-5 h-5 text-slate-600" />
          <h3 className="text-lg font-bold text-slate-900">Quick Actions</h3>
          <span className="text-xs text-slate-500 ml-auto">Click to navigate</span>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-6">
        {getDashboardGridActions().map((action, index) => (
          <button
            key={index}
            onClick={action.action}
            className="relative overflow-hidden rounded-2xl shadow-lg hover:shadow-2xl transition-all duration-300 group text-left transform hover:-translate-y-1"
          >
            {/* Gradient Background */}
            <div className={`absolute inset-0 bg-gradient-to-br ${action.color} opacity-90 group-hover:opacity-100 transition-opacity`}></div>
            
            {/* Content */}
            <div className="relative p-6">
              {/* Icon */}
              <div className="w-14 h-14 bg-white/20 backdrop-blur-sm rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 group-hover:rotate-3 transition-all duration-300 shadow-lg">
                <action.icon className="w-7 h-7 text-white" />
              </div>
              
              {/* Text */}
              <h3 className="text-lg font-bold text-white mb-1.5 drop-shadow-sm">{action.label}</h3>
              <p className="text-sm text-white/90 leading-relaxed">{action.desc}</p>
              
              {/* Badge */}
              {action.badge && action.badge > 0 && (
                <div className="absolute top-4 right-4 flex items-center justify-center">
                  <span className="relative inline-flex">
                    <span className="inline-flex items-center justify-center px-3 py-1.5 rounded-full text-xs font-bold bg-white text-slate-900 shadow-lg ring-2 ring-white/30">
                      {action.badge}
                    </span>
                    <span className="absolute top-0 right-0 -mt-1 -mr-1 flex h-3 w-3">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-3 w-3 bg-white"></span>
                    </span>
                  </span>
                </div>
              )}
              
              {/* Hover Arrow */}
              <div className="absolute bottom-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity">
                <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                </svg>
              </div>
            </div>
            
            {/* Shimmer Effect */}
            <div className="absolute inset-0 -translate-x-full group-hover:translate-x-full transition-transform duration-1000 bg-gradient-to-r from-transparent via-white/10 to-transparent"></div>
          </button>
        ))}
        </div>
      </div>
    </div>
    );
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 overflow-x-hidden">
      {/* Mobile Sidebar Backdrop */}
      {sidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-40 lg:hidden backdrop-blur-sm transition-opacity"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={`fixed left-0 top-0 h-full w-64 bg-gradient-to-b from-slate-900 via-slate-800 to-slate-900 text-white z-50 transition-transform duration-300 ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'} lg:translate-x-0 shadow-2xl flex flex-col`}>
        {/* Logo Section */}
        <div className="p-6 border-b border-slate-700/50 relative">
          <div className="flex items-center gap-3 min-w-0">
            {tenantInfo?.logoUrl ? (
              <div className="h-11 w-11 rounded-xl border border-white/20 bg-white/5 flex items-center justify-center overflow-hidden">
                <img src={tenantInfo.logoUrl} alt={`${tenantDisplayName} logo`} className="w-full h-full object-cover" />
              </div>
            ) : (
              <div className="h-11 w-11 rounded-xl border border-white/20 bg-white/5 flex items-center justify-center overflow-hidden">
                <span className="text-xs font-bold tracking-wide text-white">{tenantInitials}</span>
              </div>
            )}
            <div className="min-w-0">
              <h1 className="font-bold text-lg leading-tight truncate">{tenantDisplayName}</h1>
              <p className="text-xs text-slate-400">Nurse Portal</p>
              {billingSummary && (
                <span className={`mt-2 inline-flex rounded-full px-2 py-1 text-[10px] font-semibold ${billingTone.pill}`}>
                  {billingSummary.daysUntilSuspension ?? billingSummary.daysRemaining ?? 'N/A'}d
                </span>
              )}
            </div>
            {/* Mobile Close Button */}
            <button 
              onClick={() => setSidebarOpen(false)}
              className="lg:hidden absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white p-2"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-4 py-6 space-y-2 overflow-y-auto">
          {getSidebarNavigation().map((item, index) => {
             const isSectionActive = activeSection === item.section;
             return (
               <div key={index} className="space-y-1">
                 <button
                   onClick={() => {
                     setActiveSection(item.section);
                     setActiveTab(item.tab as any);
                     // Keep sidebar open to show children
                   }}
                   className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 group ${
                     isSectionActive 
                       ? `bg-gradient-to-r ${item.color} shadow-lg text-white` 
                       : 'text-slate-400 hover:bg-slate-800 hover:text-white'
                   }`}
                 >
                   <item.icon className={`w-5 h-5 ${isSectionActive ? 'text-white' : 'text-slate-400 group-hover:text-white'}`} />
                   <div className="text-left flex-1">
                     <p className="font-medium">{item.label}</p>
                     <p className={`text-xs ${isSectionActive ? 'text-white/80' : 'text-slate-500 group-hover:text-slate-400'}`}>{item.desc}</p>
                   </div>
                   {isSectionActive ? <ChevronDown className="w-4 h-4 text-white/80" /> : <ChevronDown className="w-4 h-4 text-slate-600 -rotate-90" />}
                 </button>
                 
                 {/* Sub-navigation Children */}
                 {isSectionActive && item.children && (
                   <div className="pl-4 space-y-1 mt-1 mb-3 animate-fadeIn">
                     {item.children.map((child, childIndex) => {
                       const isTabActive = activeTab === child.tab;
                       return (
                         <button
                           key={childIndex}
                           onClick={() => {
                             setActiveTab(child.tab as any);
                             setSidebarOpen(false); // Close sidebar on mobile after selection
                           }}
                           className={`w-full flex items-center gap-3 px-4 py-2 rounded-lg transition-all duration-200 text-sm ${
                             isTabActive
                               ? 'bg-slate-800 text-white font-medium border-l-2 border-emerald-500'
                               : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
                           }`}
                         >
                           <child.icon className={`w-4 h-4 ${isTabActive ? 'text-emerald-400' : 'text-slate-500'}`} />
                           <span>{child.label}</span>
                         </button>
                       );
                     })}
                   </div>
                 )}
               </div>
             );
          })}
        </nav>

        {/* Logout */}
        <div className="p-6 border-t border-slate-700/50">
           <button
             onClick={handleLogout}
             className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-slate-300 hover:bg-red-500/20 hover:text-red-400 transition-all duration-200"
           >
             <LogOut className="w-5 h-5" />
             <span className="font-medium">Sign Out</span>
           </button>
        </div>
      </aside>

      {/* Main Content Wrapper */}
      <div className="lg:pl-64 transition-all duration-300 flex flex-col min-h-screen">
      {/* Slim Top Bar: system title + notifications + user */}
      <header className="bg-white/80 backdrop-blur-sm border-b border-slate-200/50 sticky top-0 z-30">
        <div className="w-full max-w-full mx-auto px-2 sm:px-4 lg:px-6">
          <div className="flex justify-between items-center h-14">
            {/* Left Section - Hamburger + Title */}
            <div className="flex items-center space-x-4">
              <button
                onClick={() => setSidebarOpen(true)}
                className="lg:hidden p-2 -ml-2 text-slate-500 hover:bg-slate-100 rounded-lg transition-colors"
              >
                <Menu className="w-6 h-6" />
              </button>
              <div className="hidden sm:block">
                <div className="flex items-center gap-2">
                  <h1 className="text-lg font-bold text-slate-900">Nurse Dashboard</h1>
                  {subscriptionMiniLabel && (
                    <span className={`inline-flex rounded-full px-2 py-1 text-[10px] font-semibold ${billingTone.pill}`}>
                      {subscriptionMiniLabel}
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-600">Patient Care Management</p>
              </div>
            </div>

            {/* Right Section - Notifications + User */}
            <div className="flex items-center space-x-3">
              {/* Refresh Button */}
              <button
                onClick={() => {
                  fetchTodayAppointments();
                  loadCrossModuleFeed();
                }}
                disabled={loading}
                className="p-2 text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-all duration-200 disabled:opacity-50"
                title="Refresh Data"
              >
                <RefreshCw className={`h-5 w-5 ${loading ? 'animate-spin' : ''}`} />
              </button>

              {/* AI Guideline Toggle */}
              <button
                onClick={() => setShowGuidelineSearch(!showGuidelineSearch)}
                className={`flex items-center space-x-2 px-3 py-2 rounded-lg transition-all duration-200 ${
                  showGuidelineSearch 
                    ? 'bg-blue-100 text-blue-700' 
                    : 'bg-white/50 hover:bg-slate-100 text-slate-700'
                }`}
                title="AI Clinical Guidelines"
              >
                <BookOpen className="w-5 h-5" />
                <span className="hidden lg:inline text-sm font-medium">Guidelines</span>
              </button>

              {/* Proactive AI Alert Bell */}
              <ProactiveAlertBell
                userId={currentUser?.id || ''}
                token={localStorage.getItem('ehr_token') || ''}
              />

              {/* Notifications */}
              <div className="relative">
                <button
                  onClick={() => setShowNotifications(!showNotifications)}
                  className="p-2 text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-all duration-200 relative"
                >
                  <Bell className="h-5 w-5" />
                  {(taskCounts.pending + taskCounts.inProgress + taskCounts.overdue + alertCounts.active + crossModuleSummary.total) > 0 && (
                    <span className={`absolute -top-1 -right-1 text-white text-xs font-bold rounded-full h-6 w-6 flex items-center justify-center shadow-lg transform scale-110 animate-pulse ${
                      alertCounts.critical > 0 || crossModuleSummary.critical > 0
                        ? 'bg-gradient-to-r from-red-600 to-red-700' 
                        : alertCounts.high > 0 || crossModuleSummary.high > 0
                        ? 'bg-gradient-to-r from-orange-500 to-red-500'
                        : 'bg-gradient-to-r from-green-500 to-emerald-600'
                    }`}>
                      {taskCounts.pending + taskCounts.inProgress + taskCounts.overdue + alertCounts.active + crossModuleSummary.total}
                    </span>
                  )}
                </button>

                {showNotifications && (
                  <div className="absolute right-0 mt-2 w-80 bg-white rounded-xl shadow-lg border border-slate-200/50 py-2 z-50 overflow-hidden">
                    <div className="px-4 py-3 border-b border-slate-100 bg-slate-50/50">
                      <h3 className="font-semibold text-slate-900">Notifications</h3>
                    </div>
                    <div className="max-h-96 overflow-y-auto">
                      {alertCounts.active > 0 && (
                         <button 
                           onClick={() => {
                             setActiveSection('main');
                             setActiveTab('alerts');
                             setShowNotifications(false);
                           }}
                           className="w-full text-left px-4 py-3 hover:bg-slate-50 border-b border-slate-50 transition-colors group"
                         >
                           <div className="flex items-start gap-3">
                             <div className="p-2 bg-red-100 text-red-600 rounded-lg group-hover:bg-red-200 transition-colors">
                               <AlertTriangle className="w-4 h-4" />
                             </div>
                             <div>
                               <p className="text-sm font-medium text-slate-900">Patient Safety Alerts</p>
                               <p className="text-xs text-slate-500">{alertCounts.active} active alerts ({alertCounts.critical} critical)</p>
                             </div>
                           </div>
                         </button>
                      )}
                      
                      {(taskCounts.pending + taskCounts.overdue) > 0 && (
                         <button 
                           onClick={() => {
                             setActiveSection('main');
                             setActiveTab('tasks');
                             setShowNotifications(false);
                           }}
                           className="w-full text-left px-4 py-3 hover:bg-slate-50 border-b border-slate-50 transition-colors group"
                         >
                           <div className="flex items-start gap-3">
                             <div className="p-2 bg-blue-100 text-blue-600 rounded-lg group-hover:bg-blue-200 transition-colors">
                               <ClipboardList className="w-4 h-4" />
                             </div>
                             <div>
                               <p className="text-sm font-medium text-slate-900">My Tasks</p>
                               <p className="text-xs text-slate-500">{taskCounts.pending} pending, {taskCounts.overdue} overdue</p>
                             </div>
                           </div>
                         </button>
                      )}

                      {crossModuleSummary.total > 0 && (
                         <button 
                           onClick={() => {
                             setActiveSection('main');
                             setActiveTab('cross-module');
                             setShowNotifications(false);
                           }}
                           className="w-full text-left px-4 py-3 hover:bg-slate-50 border-b border-slate-50 transition-colors group"
                         >
                           <div className="flex items-start gap-3">
                             <div className="p-2 bg-violet-100 text-violet-600 rounded-lg group-hover:bg-violet-200 transition-colors">
                               <Sparkles className="w-4 h-4" />
                             </div>
                             <div>
                               <p className="text-sm font-medium text-slate-900">Cross-Module Escalations</p>
                               <p className="text-xs text-slate-500">{crossModuleSummary.total} shared items ({crossModuleSummary.critical} critical)</p>
                             </div>
                           </div>
                         </button>
                      )}

                      {taskCounts.pending === 0 && alertCounts.active === 0 && crossModuleSummary.total === 0 && (
                        <div className="px-4 py-8 text-center text-slate-500">
                          <CheckCircle className="w-8 h-8 mx-auto mb-2 text-slate-300" />
                          <p className="text-sm">No new notifications</p>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* User Profile Dropdown */}
              <div className="relative" data-dropdown="user">
                <button
                  onClick={() => setShowUserDropdown(!showUserDropdown)}
                  className="flex items-center space-x-3 p-2 rounded-lg hover:bg-slate-100 transition-all duration-200"
                >
                  <div className="h-8 w-8 bg-gradient-to-r from-blue-500 to-indigo-600 rounded-full flex items-center justify-center">
                    <UserCircle className="h-5 w-5 text-white" />
                  </div>
                  <div className="hidden sm:block text-left">
                    <p className="text-sm font-semibold text-slate-900">
                      {currentUser?.firstName} {currentUser?.lastName}
                    </p>
                    <p className="text-xs text-slate-600 capitalize">{currentUser?.role}</p>
                  </div>
                  <ChevronDown className="h-4 w-4 text-slate-500" />
                </button>

                {/* User Dropdown Menu */}
                {showUserDropdown && (
                  <div className="absolute right-0 mt-2 w-64 bg-white rounded-xl shadow-lg border border-slate-200/50 py-2 z-50">
                    <div className="px-4 py-3 border-b border-slate-200/50">
                      <p className="text-sm font-semibold text-slate-900">
                        {currentUser?.firstName} {currentUser?.lastName}
                      </p>
                      <p className="text-xs text-slate-600 capitalize">{currentUser?.role}</p>
                      <p className="text-xs text-slate-500">{currentUser?.email}</p>
                    </div>
                    <div className="py-2">
                      <button className="w-full px-4 py-2 text-left text-sm text-slate-700 hover:bg-slate-50 flex items-center space-x-3">
                        <User className="h-4 w-4" />
                        <span>Profile Settings</span>
                      </button>
                      <button className="w-full px-4 py-2 text-left text-sm text-slate-700 hover:bg-slate-50 flex items-center space-x-3">
                        <Settings className="h-4 w-4" />
                        <span>Preferences</span>
                      </button>
                      <button className="w-full px-4 py-2 text-left text-sm text-slate-700 hover:bg-slate-50 flex items-center space-x-3">
                        <Shield className="h-4 w-4" />
                        <span>Security</span>
                      </button>
                    </div>
                    <div className="border-t border-slate-200/50 py-2">
                      <button
                        onClick={handleLogout}
                        className="w-full px-4 py-2 text-left text-sm text-red-600 hover:bg-red-50 flex items-center space-x-3"
                      >
                        <LogOut className="h-4 w-4" />
                        <span>Sign Out</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>

            </div>
          </div>
        </div>
      </header>


      {/* Content */}
      <div className="w-full max-w-full mx-auto px-2 sm:px-4 lg:px-6 py-4 sm:py-6 lg:py-8 overflow-x-hidden">
        {activeTab === 'dashboard' && activeSection === 'main' && renderDashboard()}
        {activeTab === 'tasks' && (
          <TaskManagement 
            currentUser={currentUser}
            appointments={appointments}
            onTaskComplete={(_taskId) => {
              // Could trigger refresh of other data
            }}
            onTaskUpdate={(_task) => {
              // Could update task in real-time
            }}
            onTaskCountsChange={(counts) => {
              calculateTaskCounts([counts.pending, counts.inProgress, counts.overdue]);
            }}
          />
        )}

        {activeTab === 'cross-module' && (
          <div className="space-y-6">
            <NurseCrossModuleEscalations
              items={crossModuleItems}
              summary={crossModuleSummary}
              loading={crossModuleLoading}
              acknowledgingTaskId={acknowledgingCrossModuleTaskId}
              workflowActionItemId={updatingCrossModuleWorkflowItemId}
              recommendationActionKey={executingRecommendationActionKey}
              onRefresh={loadCrossModuleFeed}
              onOpenWorkflow={handleOpenCrossModuleWorkflow}
              onAcknowledgeMaternityTask={handleAcknowledgeCrossModuleMaternityTask}
              onUpdateWorkflowStatus={handleUpdateCrossModuleWorkflowStatus}
              onExecuteRecommendationAction={handleExecuteRecommendationAction}
            />
            {tenantSlug && localStorage.getItem('ehr_token') && (
              <div className="space-y-4">
                <PostVisitEscalationQueue
                  tenantSlug={tenantSlug}
                  token={localStorage.getItem('ehr_token') || ''}
                  defaultRouteTarget="nurse"
                  compact
                />
                <PostVisitEscalationQueue
                  tenantSlug={tenantSlug}
                  token={localStorage.getItem('ehr_token') || ''}
                  defaultRouteTarget="nurse"
                  triggerType="trial_decision_sla_breach"
                  title="Trial Decision SLA Queue"
                  subtitle="Shared nurse/doctor queue for stale trial decisions."
                  compact
                />
              </div>
            )}
          </div>
        )}

        {activeTab === 'copilot-metrics' && (
          <div className="space-y-6">
            <div className="bg-gradient-to-br from-white to-slate-50 rounded-2xl shadow-lg border border-slate-200/50 p-6">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-gradient-to-r from-indigo-500 to-purple-600 rounded-xl">
                    <BarChart3 className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-slate-900">Nurse Copilot KPIs</h2>
                    <p className="text-sm text-slate-600">
                      Time-to-triage, documentation time, alert response, and usage patterns.
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={async () => {
                    const token = localStorage.getItem('ehr_token');
                    const activeTenant = resolveTenantSlug();
                    if (!token || !activeTenant) {
                      return;
                    }
                    try {
                      setNurseCopilotKpisLoading(true);
                      const [res] = await Promise.all([
                        ehrApi.getNurseCopilotKpis(token, activeTenant),
                        loadNurseOutcomeAnalytics(30),
                      ]);
                      setNurseCopilotKpis(res.data || null);
                    } catch {
                    } finally {
                      setNurseCopilotKpisLoading(false);
                    }
                  }}
                  className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 flex items-center gap-2 font-semibold text-sm"
                >
                  <RefreshCw className={`w-4 h-4 ${nurseCopilotKpisLoading ? 'animate-spin' : ''}`} />
                  Refresh KPIs & Outcomes
                </button>
              </div>

              {nurseCopilotKpisLoading && (
                <div className="py-12 flex flex-col items-center justify-center">
                  <Loader2 className="w-8 h-8 text-indigo-500 animate-spin mb-3" />
                  <p className="text-sm text-slate-600">Loading nurse copilot metrics...</p>
                </div>
              )}

              {!nurseCopilotKpisLoading && nurseCopilotKpis && (
                <div className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div className="bg-white border border-slate-200 rounded-xl p-4">
                      <p className="text-xs font-semibold text-slate-500 mb-1">Total Recommendations</p>
                      <p className="text-2xl font-bold text-slate-900">
                        {nurseCopilotKpis.recommendationsTotal ?? 0}
                      </p>
                    </div>
                    <div className="bg-white border border-slate-200 rounded-xl p-4">
                      <p className="text-xs font-semibold text-slate-500 mb-1">Total Decisions</p>
                      <p className="text-2xl font-bold text-slate-900">
                        {nurseCopilotKpis.decisionsTotal ?? 0}
                      </p>
                    </div>
                    <div className="bg-white border border-slate-200 rounded-xl p-4">
                      <p className="text-xs font-semibold text-slate-500 mb-1">Avg Time to Triage</p>
                      <p className="text-2xl font-bold text-slate-900">
                        {nurseCopilotKpis.timeToTriage?.averageSeconds != null
                          ? `${Math.round(nurseCopilotKpis.timeToTriage.averageSeconds)}s`
                          : '—'}
                      </p>
                    </div>
                    <div className="bg-white border border-slate-200 rounded-xl p-4">
                      <p className="text-xs font-semibold text-slate-500 mb-1">Avg Alert Response</p>
                      <p className="text-2xl font-bold text-slate-900">
                        {nurseCopilotKpis.alertResponse?.averageSeconds != null
                          ? `${Math.round(nurseCopilotKpis.alertResponse.averageSeconds)}s`
                          : '—'}
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="bg-white border border-slate-200 rounded-xl p-4">
                      <p className="text-xs font-semibold text-slate-500 mb-3">Recommendations by Type</p>
                      <div className="space-y-2 text-sm text-slate-700">
                        {Object.entries(nurseCopilotKpis.recommendationsByType || {}).map(([key, value]) => (
                          <div key={key} className="flex items-center justify-between">
                            <span className="capitalize">{key}</span>
                            <span className="font-semibold">{value as number}</span>
                          </div>
                        ))}
                        {(!nurseCopilotKpis.recommendationsByType ||
                          Object.keys(nurseCopilotKpis.recommendationsByType).length === 0) && (
                          <p className="text-xs text-slate-500">No recommendations recorded yet.</p>
                        )}
                      </div>
                    </div>
                    <div className="bg-white border border-slate-200 rounded-xl p-4">
                      <p className="text-xs font-semibold text-slate-500 mb-3">Decisions by Type</p>
                      <div className="space-y-2 text-sm text-slate-700">
                        {Object.entries(nurseCopilotKpis.decisionsByType || {}).map(([key, value]) => (
                          <div key={key} className="flex items-center justify-between">
                            <span className="capitalize">{key}</span>
                            <span className="font-semibold">{value as number}</span>
                          </div>
                        ))}
                        {(!nurseCopilotKpis.decisionsByType ||
                          Object.keys(nurseCopilotKpis.decisionsByType).length === 0) && (
                          <p className="text-xs text-slate-500">No decisions recorded yet.</p>
                        )}
                      </div>
                    </div>
                    <div className="bg-white border border-slate-200 rounded-xl p-4">
                      <p className="text-xs font-semibold text-slate-500 mb-3">Documentation Duration</p>
                      <div className="space-y-2 text-sm text-slate-700">
                        <div className="flex items-center justify-between">
                          <span>Samples</span>
                          <span className="font-semibold">
                            {nurseCopilotKpis.documentation?.samples ?? 0}
                          </span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span>Average</span>
                          <span className="font-semibold">
                            {nurseCopilotKpis.documentation?.averageSeconds != null
                              ? `${Math.round(nurseCopilotKpis.documentation.averageSeconds)}s`
                              : '—'}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {!nurseCopilotKpisLoading && !nurseCopilotKpis && (
                <div className="py-12 flex flex-col items-center justify-center">
                  <Activity className="w-10 h-10 text-slate-300 mb-3" />
                  <p className="text-sm text-slate-600">
                    No nurse copilot metrics available yet. Metrics will appear after copilot usage.
                  </p>
                </div>
              )}

              <div className="mt-6 border-t border-slate-200 pt-6">
                <h3 className="text-lg font-bold text-slate-900 mb-1">Cross-Module Outcome Metrics</h3>
                <p className="text-sm text-slate-600 mb-4">
                  Live execution and SLA outcomes from the nurse cross-module queue.
                </p>

                {nurseOutcomeAnalyticsLoading && !nurseOutcomeAnalytics ? (
                  <div className="py-8 flex items-center justify-center text-slate-600">
                    <Loader2 className="w-5 h-5 animate-spin mr-2" />
                    Loading outcome metrics...
                  </div>
                ) : nurseOutcomeAnalytics ? (
                  <div className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4">
                      <div className="bg-white border border-slate-200 rounded-xl p-4">
                        <p className="text-xs font-semibold text-slate-500 mb-1">Queue Completion</p>
                        <p className="text-2xl font-bold text-slate-900">
                          {outcomeQueue?.completionRatePercent ?? 0}%
                        </p>
                      </div>
                      <div className="bg-white border border-slate-200 rounded-xl p-4">
                        <p className="text-xs font-semibold text-slate-500 mb-1">Queue Active</p>
                        <p className="text-2xl font-bold text-slate-900">
                          {outcomeQueue?.activeItems ?? 0}
                        </p>
                      </div>
                      <div className="bg-white border border-slate-200 rounded-xl p-4">
                        <p className="text-xs font-semibold text-slate-500 mb-1">Pending &gt;24h</p>
                        <p className="text-2xl font-bold text-slate-900">
                          {outcomeQueue?.pendingOlderThan24h ?? 0}
                        </p>
                      </div>
                      <div className="bg-white border border-slate-200 rounded-xl p-4">
                        <p className="text-xs font-semibold text-slate-500 mb-1">HIV Actions</p>
                        <p className="text-2xl font-bold text-slate-900">
                          {outcomeExecution?.executedActionsTotal ?? 0}
                        </p>
                      </div>
                      <div className="bg-white border border-slate-200 rounded-xl p-4">
                        <p className="text-xs font-semibold text-slate-500 mb-1">Visit Drafts</p>
                        <p className="text-2xl font-bold text-slate-900">
                          {outcomeExecution?.visitPrepDraftsCreated ?? 0}
                        </p>
                      </div>
                      <div className="bg-white border border-slate-200 rounded-xl p-4">
                        <p className="text-xs font-semibold text-slate-500 mb-1">SLA Breached</p>
                        <p className="text-2xl font-bold text-slate-900">
                          {outcomeMaternity?.breached ?? 0}
                        </p>
                      </div>
                    </div>
                    <div className="text-xs text-slate-500">
                      Window: last {outcomeWindowDays} days • Last generated:{' '}
                      {nurseOutcomeAnalytics.generatedAt
                        ? formatDateTimeToDDMMYYYYHHMM(nurseOutcomeAnalytics.generatedAt)
                        : 'n/a'}
                    </div>
                  </div>
                ) : (
                  <div className="py-6 text-sm text-slate-600">
                    No cross-module outcome metrics available yet.
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'alerts' && (
          <PatientSafetyAlerts 
            currentUser={currentUser}
            appointments={appointments}
            acknowledgedAlertIds={acknowledgedAlertIds}
            onAlertAcknowledge={handleAlertAcknowledge}
            onAlertDismiss={(alertId) => {
              handleAlertAcknowledge(alertId);
            }}
            onAlertCountsChange={(counts) => {
              calculateTaskCounts([counts.active, counts.critical, counts.high]);
            }}
          />
        )}

        {activeTab === 'calendar' && renderCalendar()}
        {activeTab === 'patients' && (
          <div className="space-y-6">
            <div className="bg-gradient-to-br from-white to-slate-50 rounded-2xl shadow-lg border border-slate-200/50 p-6">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-gradient-to-r from-blue-500 to-cyan-600 rounded-xl">
                    <Users className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-slate-900">Patients</h3>
                    <p className="text-sm text-slate-600">Total: {filteredPatients.length} patients</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setShowCreatePatientModal(true)}
                    className="px-4 py-2 bg-gradient-to-r from-emerald-500 to-teal-600 text-white rounded-xl hover:from-emerald-600 hover:to-teal-700 transition-all duration-200 font-semibold text-sm"
                  >
                    + New Patient
                  </button>
                </div>
              </div>

              {/* Search Bar */}
              <div className="mb-6">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Search patients by name, ID, email, or phone..."
                    value={patientSearchTerm}
                    onChange={(e) => setPatientSearchTerm(e.target.value)}
                    className="w-full pl-10 pr-4 py-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
                  />
                </div>
              </div>

              {/* Patients Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
                {getPaginatedPatients().map((p) => {
                  const hasUpcoming = hasScheduledAppointments(p.id);
                  const awaitingAppointment = getAwaitingPaymentAppointment(p.id);

                  return (
                    <div key={p.id} className="bg-white/60 rounded-xl p-4 border border-slate-200/60 hover:shadow-md transition-all duration-200">
                      <div className="flex items-center gap-3 mb-3">
                        <div className="w-10 h-10 bg-gradient-to-br from-pink-500 to-rose-600 rounded-lg text-white font-bold flex items-center justify-center">
                          {p.firstName.charAt(0)}{p.lastName.charAt(0)}
                        </div>
                        <div className="flex-1">
                          <div className="font-bold text-slate-900">{p.firstName} {p.lastName}</div>
                          <div className="text-sm text-slate-600">ID: {p.patientNumber}</div>
                          {hasUpcoming && (
                            <div className="text-xs text-emerald-600 font-medium flex items-center gap-1">
                              <CheckCircle className="w-3 h-3" />
                              Has Appointments
                            </div>
                          )}
                          {awaitingAppointment && (
                            <div className="mt-1 text-xs text-amber-600 font-medium flex items-center gap-1">
                              <CreditCard className="w-3 h-3" />
                              Awaiting payment confirmation
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => { setSelectedPatient(p); setShowCreateAppointmentModal(true); }}
                          className="px-3 py-2 bg-gradient-to-r from-blue-500 to-indigo-600 text-white rounded-lg text-sm hover:from-blue-600 hover:to-indigo-700 transition-all duration-200"
                        >
                          Schedule
                        </button>
                        {hasUpcoming && (
                          <button
                            onClick={() => handleVitalsForScheduledPatient(p)}
                            disabled={Boolean(awaitingAppointment)}
                            className={`px-3 py-2 rounded-lg text-sm transition-all duration-200 ${awaitingAppointment
                              ? 'bg-slate-200 text-slate-500 cursor-not-allowed'
                              : 'bg-gradient-to-r from-emerald-500 to-teal-600 text-white hover:from-emerald-600 hover:to-teal-700'
                            }`}
                          >
                            {awaitingAppointment ? 'Locked' : 'Vitals'}
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Pagination */}
              {getTotalPages() > 1 && (
                <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-4 border-t border-slate-200">
                  <div className="text-sm text-slate-600 text-center sm:text-left">
                    Showing {((currentPage - 1) * patientsPerPage) + 1} to {Math.min(currentPage * patientsPerPage, filteredPatients.length)} of {filteredPatients.length} patients
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                      disabled={currentPage === 1}
                      className="px-3 py-2 border border-slate-300 rounded-lg text-sm hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
                    >
                      Previous
                    </button>
                    <div className="hidden sm:flex items-center gap-1">
                      {Array.from({ length: getTotalPages() }, (_, i) => i + 1).map(page => (
                        <button
                          key={page}
                          onClick={() => setCurrentPage(page)}
                          className={`px-3 py-2 rounded-lg text-sm transition-all duration-200 ${
                            currentPage === page
                              ? 'bg-gradient-to-r from-blue-500 to-indigo-600 text-white shadow-lg'
                              : 'border border-slate-300 hover:bg-slate-50'
                          }`}
                        >
                          {page}
                        </button>
                      ))}
                    </div>
                    {/* Mobile page indicator */}
                    <span className="sm:hidden text-sm font-medium text-slate-600">
                      Page {currentPage} of {getTotalPages()}
                    </span>
                    <button
                      onClick={() => setCurrentPage(prev => Math.min(prev + 1, getTotalPages()))}
                      disabled={currentPage === getTotalPages()}
                      className="px-3 py-2 border border-slate-300 rounded-lg text-sm hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
                    >
                      Next
                    </button>
                  </div>
                </div>
              )}

              {/* No patients message */}
              {filteredPatients.length === 0 && (
                <div className="text-center py-12">
                  <Users className="w-16 h-16 text-slate-300 mx-auto mb-4" />
                  <h3 className="text-lg font-semibold text-slate-600 mb-2">No patients found</h3>
                  <p className="text-slate-500 mb-4">
                    {patientSearchTerm ? 'Try adjusting your search terms' : 'Start by adding a new patient'}
                  </p>
                  {!patientSearchTerm && (
                    <button
                      onClick={() => setShowCreatePatientModal(true)}
                      className="px-6 py-3 bg-gradient-to-r from-emerald-500 to-teal-600 text-white rounded-xl hover:from-emerald-600 hover:to-teal-700 transition-all duration-200 font-semibold"
                    >
                      + Add First Patient
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        )}
        {activeTab === 'queue' && (
          <TriageQueue
            appointments={appointments}
            onRecordVitals={handleRecordVitals}
            onTriageAssessment={handleTriageAssessment}
            onTriageCopilotAnalyze={handleQueueTriageCopilotAnalyze}
            triageCopilotLoading={triageCopilotLoading}
            triageCopilotPatientId={selectedPatient?.id || null}
            onViewCarePlans={(patientId, patientName) => {
              setCarePlansPatientId(patientId);
              setCarePlansPatientName(patientName);
              setShowCarePlansModal(true);
            }}
            onViewLabResults={(patientId, patientName) => {
              setLabResultsPatientId(patientId);
              setLabResultsPatientName(patientName);
              setShowLabResultsModal(true);
            }}
            onViewVitalsHistory={(patientId, patientName) => {
              openVitalsHistory(patientId, patientName);
            }}
            canManagePayments={isNurseAccountsUser()}
            onOpenPayment={isNurseAccountsUser() ? openPaymentForAppointment : undefined}
          />
        )}

        {isNurseAccountsUser() && showPaymentModal && (
          <ModalPortal>
            <div className="fixed inset-0 bg-slate-900/70 z-50 flex items-center justify-center p-4">
              <div className="bg-gradient-to-br from-emerald-500/10 via-sky-50 to-emerald-50 rounded-2xl shadow-2xl border border-emerald-100 max-w-md w-full max-h-[90vh] overflow-y-auto">
                <div className="flex items-center justify-between px-5 pt-5 pb-3 border-b border-emerald-100/60">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center text-white shadow-md">
                      <CreditCard className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="text-lg font-bold text-emerald-900">Record Patient Payment</h3>
                      <p className="text-xs text-emerald-700">
                        Nurse payment capture only – full finance workflows stay in Accounts.
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => {
                      setShowPaymentModal(false);
                      setPaymentAppointment(null);
                    }}
                    className="text-emerald-500 hover:text-emerald-700 rounded-full p-1 hover:bg-emerald-50 transition-colors"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <form onSubmit={submitPayment} className="p-5 space-y-4">
                  <div className="rounded-xl bg-white/80 border border-emerald-100 px-4 py-3 flex items-start gap-3">
                    <div className="mt-0.5 w-9 h-9 rounded-lg bg-gradient-to-br from-emerald-500 to-teal-500 flex items-center justify-center text-white text-sm font-semibold">
                      {paymentAppointment
                        ? `${paymentAppointment.patient.firstName.charAt(0)}${paymentAppointment.patient.lastName.charAt(0)}`
                        : '?'}
                    </div>
                    <div className="text-sm">
                      {paymentAppointment && (
                        <>
                          <div className="font-semibold text-slate-900">
                            {paymentAppointment.patient.firstName} {paymentAppointment.patient.lastName}
                          </div>
                          <div className="text-xs text-slate-500">
                            ID: {paymentAppointment.patient.patientNumber} •{' '}
                            {new Date(paymentAppointment.appointmentDate).toLocaleString()}
                          </div>
                          <div className="mt-1 flex flex-wrap gap-2">
                            {paymentAppointment.appointmentType && (
                              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
                                {paymentAppointment.appointmentType}
                              </span>
                            )}
                            {paymentAppointment.feeAmount != null && (
                              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-amber-50 text-amber-800 border border-amber-200">
                                Fee: ${Number(paymentAppointment.feeAmount).toFixed(2)}
                              </span>
                            )}
                          </div>
                        </>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-slate-600 mb-1 uppercase tracking-wide">
                        Amount
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={paymentForm.amount}
                        onChange={(e) => setPaymentForm((prev) => ({ ...prev, amount: e.target.value }))}
                        className="w-full px-3 py-2.5 rounded-xl border border-emerald-200 bg-white/90 text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-400/40 focus:border-emerald-500 text-sm"
                        required
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-600 mb-1 uppercase tracking-wide">
                        Payment Method
                      </label>
                      <select
                        value={paymentForm.paymentMethod}
                        onChange={(e) => setPaymentForm((prev) => ({ ...prev, paymentMethod: e.target.value }))}
                        className="w-full px-3 py-2.5 rounded-xl border border-emerald-200 bg-white/90 text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-400/40 focus:border-emerald-500 text-sm"
                        required
                      >
                        <option value="cash">Cash</option>
                        <option value="card">Card (POS/EFTPOS)</option>
                        <option value="mobile_money">Mobile Money</option>
                        <option value="bank_transfer">Bank Transfer</option>
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-slate-600 mb-1 uppercase tracking-wide">
                        Payment Reference
                      </label>
                      <input
                        type="text"
                        value={paymentForm.paymentReference}
                        onChange={(e) =>
                          setPaymentForm((prev) => ({ ...prev, paymentReference: e.target.value }))
                        }
                        className="w-full px-3 py-2.5 rounded-xl border border-slate-200 bg-white/90 text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-400/40 focus:border-emerald-500 text-sm"
                        placeholder="POS slip, mobile money code, etc."
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-600 mb-1 uppercase tracking-wide">
                        Gateway Reference
                      </label>
                      <input
                        type="text"
                        value={paymentForm.gatewayReference}
                        onChange={(e) =>
                          setPaymentForm((prev) => ({ ...prev, gatewayReference: e.target.value }))
                        }
                        className="w-full px-3 py-2.5 rounded-xl border border-slate-200 bg-white/90 text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-400/40 focus:border-emerald-500 text-sm"
                        placeholder="Stripe / telco ref (optional)"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1 uppercase tracking-wide">
                      Note
                    </label>
                    <textarea
                      value={paymentForm.note}
                      onChange={(e) => setPaymentForm((prev) => ({ ...prev, note: e.target.value }))}
                      className="w-full px-3 py-2.5 rounded-xl border border-slate-200 bg-white/90 text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-400/40 focus:border-emerald-500 text-sm min-h-[70px]"
                      placeholder="Optional note for audit trail..."
                    />
                  </div>

                  <div className="flex items-center justify-between pt-1">
                    <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-700 bg-emerald-50 border border-emerald-100 px-2 py-1 rounded-full">
                      <Shield className="w-3 h-3" />
                      Nurse payment capture – finance audit trail preserved
                    </span>
                  </div>

                  <div className="flex gap-3 pt-2">
                    <button
                      type="button"
                      onClick={() => {
                        setShowPaymentModal(false);
                        setPaymentAppointment(null);
                      }}
                      className="flex-1 px-4 py-2.5 border border-slate-200 text-slate-600 rounded-xl bg-white/80 hover:bg-slate-50 transition text-sm font-medium"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={paymentSubmitting}
                      className="flex-1 px-4 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 text-white text-sm font-semibold shadow-md hover:from-emerald-600 hover:to-teal-600 transition disabled:opacity-60"
                    >
                      {paymentSubmitting ? 'Recording...' : 'Record Payment'}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </ModalPortal>
        )}
        {activeTab === 'orders' && (
          <div className="space-y-6">
            <div className="bg-gradient-to-br from-white to-slate-50 rounded-2xl shadow-lg border border-slate-200/50 p-6">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-gradient-to-r from-purple-500 to-indigo-600 rounded-xl">
                    <ClipboardList className="w-5 h-5 text-white" />
                  </div>
                  <h3 className="text-lg font-bold text-slate-900">Authorized Orders & Procedures</h3>
                </div>
                <button
                  onClick={fetchAuthorizedOrders}
                  className="p-2 text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-all duration-200"
                  title="Refresh Orders"
                >
                  <RefreshCw className="h-5 w-5" />
                </button>
              </div>
              
              {authorizedOrders.length === 0 ? (
                <div className="text-center py-12">
                  <ClipboardList className="w-16 h-16 text-slate-300 mx-auto mb-4" />
                  <h4 className="text-lg font-semibold text-slate-600 mb-2">No Authorized Orders</h4>
                  <p className="text-slate-500">Orders will appear here once doctors authorize medications or procedures for patients.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {authorizedOrders.map((order) => (
                    <div key={order.id} className="bg-white/60 rounded-xl p-6 border border-slate-200/60 hover:shadow-md transition-all duration-200">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-3">
                            <div className={`px-3 py-1 rounded-full text-xs font-semibold ${
                              order.orderType === 'medication' 
                                ? 'bg-fuchsia-100 text-fuchsia-800' 
                                : 'bg-emerald-100 text-emerald-800'
                            }`}>
                              {order.orderType === 'medication' ? 'Medication' : 'Procedure'}
                            </div>
                            <div className={`px-3 py-1 rounded-full text-xs font-semibold ${
                              order.priority === 'urgent' 
                                ? 'bg-red-100 text-red-800' 
                                : order.priority === 'high'
                                ? 'bg-orange-100 text-orange-800'
                                : 'bg-blue-100 text-blue-800'
                            }`}>
                              {order.priority.toUpperCase()}
                            </div>
                          </div>
                          
                          <h4 className="text-lg font-semibold text-slate-900 mb-2">{order.orderName}</h4>
                          <p className="text-slate-600 mb-3">{order.description}</p>
                          
                          <div className="bg-slate-50 rounded-lg p-4 mb-4">
                            <h5 className="font-semibold text-slate-800 mb-2">Instructions:</h5>
                            <p className="text-slate-700">{order.instructions}</p>
                            {order.dosage && (
                              <p className="text-sm text-slate-600 mt-2"><strong>Dosage:</strong> {order.dosage}</p>
                            )}
                            {order.frequency && (
                              <p className="text-sm text-slate-600"><strong>Frequency:</strong> {order.frequency}</p>
                            )}
                            {order.duration && (
                              <p className="text-sm text-slate-600"><strong>Duration:</strong> {order.duration}</p>
                            )}
                          </div>
                          
                          <div className="text-sm text-slate-500">
                            <p><strong>Patient:</strong> {order.patient?.firstName} {order.patient?.lastName}</p>
                            <p><strong>Ordered by:</strong> Dr. {order.doctor?.firstName} {order.doctor?.lastName}</p>
                            <p><strong>Authorized:</strong> {new Date(order.authorizedAt).toLocaleString()}</p>
                          </div>
                        </div>
                        
                        <div className="ml-4">
                          <button
                            onClick={() => handleExecuteOrder(order.id)}
                            className="px-4 py-2 bg-gradient-to-r from-green-500 to-emerald-600 text-white rounded-lg text-sm hover:from-green-600 hover:to-emerald-700 transition-all duration-200 font-semibold"
                          >
                            Execute Order
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
        {activeTab === 'vitals' && (
          <div className="w-full overflow-x-auto space-y-4">
            <div className="rounded-xl border border-blue-200 bg-blue-50/60 p-4">
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                <div>
                  <h3 className="text-sm font-semibold text-blue-900">Vitals Copilot</h3>
                  <p className="text-xs text-blue-700">AI suggestion only. Nurse confirmation is required.</p>
                </div>
                <button
                  type="button"
                  onClick={handleVitalsCopilotInterpret}
                  disabled={vitalsCopilotLoading || !selectedPatient}
                  className="px-3 py-2 rounded-lg bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 disabled:opacity-50"
                >
                  {vitalsCopilotLoading ? 'Interpreting...' : 'Interpret Current Vitals'}
                </button>
              </div>
              {vitalsCopilotResult && (
                <div className="mt-3 space-y-2">
                  <div className="rounded-lg bg-white p-2 border border-blue-100 text-sm text-slate-700">
                    <p><strong>Risk:</strong> {vitalsCopilotResult.riskLevel || 'unknown'}</p>
                  </div>
                  {Array.isArray(vitalsCopilotResult.recommendations) && vitalsCopilotResult.recommendations.length > 0 && (
                    <GuidelineRecommendationCard
                      data={{
                        recommendation: String(vitalsCopilotResult.recommendations[0]),
                        evidence_level: vitalsCopilotResult.riskLevel === 'high' ? 'High' : vitalsCopilotResult.riskLevel === 'medium' ? 'Medium' : 'Low',
                      }}
                    />
                  )}
                  <div className="flex gap-2">
                    <button type="button" onClick={() => handleCopilotDecision('vitals', 'accept', `Risk ${vitalsCopilotResult.riskLevel || 'unknown'}`)} className="px-2 py-1 rounded bg-emerald-600 text-white text-xs font-semibold">Accept</button>
                    <button type="button" onClick={() => handleCopilotDecision('vitals', 'modify', `Risk ${vitalsCopilotResult.riskLevel || 'unknown'}`)} className="px-2 py-1 rounded bg-amber-600 text-white text-xs font-semibold">Modify</button>
                    <button type="button" onClick={() => handleCopilotDecision('vitals', 'reject', `Risk ${vitalsCopilotResult.riskLevel || 'unknown'}`)} className="px-2 py-1 rounded bg-rose-600 text-white text-xs font-semibold">Reject</button>
                  </div>
                </div>
              )}
            </div>
            <VitalsPanel 
              patient={selectedPatient || undefined}
              onSave={() => {
                fetchTodayAppointments();
                showSuccess('Vitals Saved', 'Patient vitals have been recorded successfully.');
              }}
            />
          </div>
        )}
        {activeTab === 'triage' && (
          <div className="w-full overflow-x-auto space-y-4">
            <div className="rounded-xl border border-amber-200 bg-amber-50/70 p-4">
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                <div>
                  <h3 className="text-sm font-semibold text-amber-900">Triage Copilot</h3>
                  <p className="text-xs text-amber-700">Use as decision support only. Confirm before saving triage.</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => handleTriageCopilotAnalyze()}
                    disabled={triageCopilotLoading || !selectedPatient}
                    className="px-3 py-2 rounded-lg bg-amber-600 text-white text-sm font-semibold hover:bg-amber-700 disabled:opacity-50"
                  >
                    {triageCopilotLoading ? 'Analyzing...' : 'Analyze Triage Context'}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setActiveSection('main');
                      setActiveTab('copilot-metrics');
                    }}
                    className="px-3 py-2 rounded-lg border border-amber-300 text-amber-800 text-xs font-semibold bg-amber-50 hover:bg-amber-100"
                  >
                    View Copilot KPIs
                  </button>
                </div>
              </div>
              {triageCopilotResult && (
                <div className="mt-3 text-sm text-slate-700 space-y-2">
                  <div>
                    <p><strong>Risk:</strong> {triageCopilotResult.riskLevel || 'unknown'}</p>
                    {triageCopilotResult.riskLevel &&
                      ['high', 'critical'].includes(String(triageCopilotResult.riskLevel).toLowerCase()) && (
                        <p className="text-xs text-red-700">
                          Escalation suggested: consider urgent provider review and continuous monitoring.
                        </p>
                    )}
                    <p><strong>Suggested Triage Level:</strong> {triageCopilotResult.suggestedTriageLevel || 'n/a'}</p>
                    {(() => {
                      let topReason: string | null = null;
                      if (Array.isArray(triageCopilotResult.reasons) && triageCopilotResult.reasons.length > 0) {
                        topReason = String(triageCopilotResult.reasons[0]);
                      } else if (Array.isArray(triageCopilotResult.risk?.factors) && triageCopilotResult.risk.factors.length > 0) {
                        const f = triageCopilotResult.risk.factors[0];
                        topReason = String((f && (f.name || f.factor || f.label)) || f || '');
                      }
                      return topReason ? (
                        <p><strong>Top Reason:</strong> {topReason}</p>
                      ) : null;
                    })()}
                    {Array.isArray(triageCopilotResult.missingData) && triageCopilotResult.missingData.length > 0 && (
                      <p>
                        <strong>Missing data:</strong>{' '}
                        {triageCopilotResult.missingData
                          .map((field: string) => {
                            if (!field) return '';
                            const key = field.toString();
                            if (key === 'chiefComplaint') return 'Chief complaint';
                            if (key === 'age') return 'Age';
                            if (key === 'gender') return 'Gender';
                            if (key === 'vitals') return 'Vitals';
                            return key;
                          })
                          .filter(Boolean)
                          .join(', ')}
                      </p>
                    )}
                  </div>
                  <div className="text-xs text-slate-600 space-y-1">
                    <p className="font-semibold text-slate-700">Transparency</p>
                    <div className="flex flex-wrap gap-2">
                      <span className="inline-flex items-center px-2 py-1 rounded-full border border-amber-200 bg-amber-50 text-[11px] font-semibold text-amber-800">
                        Source: {triageCopilotResult.source || 'CDSS Nurse Triage Copilot'}
                      </span>
                      {triageCopilotResult.audit?.modelVersion && (
                        <span className="inline-flex items-center px-2 py-1 rounded-full border border-slate-200 bg-slate-50 text-[11px] font-semibold text-slate-700">
                          Model: {String(triageCopilotResult.audit.modelVersion)}
                        </span>
                      )}
                      {typeof triageCopilotResult.risk?.overall_score === 'number' && (
                        <span className="inline-flex items-center px-2 py-1 rounded-full border border-indigo-200 bg-indigo-50 text-[11px] font-semibold text-indigo-800">
                          Confidence score: {triageCopilotResult.risk.overall_score.toFixed(1)}
                        </span>
                      )}
                      {triageCopilotResult.audit?.promptContextHash && (
                        <span className="inline-flex items-center px-2 py-1 rounded-full border border-slate-200 bg-slate-50 text-[11px] font-semibold text-slate-700">
                          Context hash: {String(triageCopilotResult.audit.promptContextHash).slice(0, 8)}…
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="mt-1 flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => handleCopilotDecision('triage', 'accept', `Suggested ${triageCopilotResult.suggestedTriageLevel || 'n/a'}`)}
                      className="px-2 py-1 rounded bg-emerald-600 text-white text-xs font-semibold"
                    >
                      Accept
                    </button>
                    <button
                      type="button"
                      onClick={() => handleCopilotDecision('triage', 'modify', `Suggested ${triageCopilotResult.suggestedTriageLevel || 'n/a'}`)}
                      className="px-2 py-1 rounded bg-amber-600 text-white text-xs font-semibold"
                    >
                      Modify
                    </button>
                    <button
                      type="button"
                      onClick={() => handleCopilotDecision('triage', 'reject', `Suggested ${triageCopilotResult.suggestedTriageLevel || 'n/a'}`)}
                      className="px-2 py-1 rounded bg-rose-600 text-white text-xs font-semibold"
                    >
                      Reject
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        if (!triageCopilotResult?.suggestedTriageLevel) return;
                        const level = String(triageCopilotResult.suggestedTriageLevel).toLowerCase();
                        let mapped: 'urgent' | 'high' | 'normal' | 'low' | null = null;
                        if (level.includes('resuscitation') || level.includes('emergency') || level === 'immediate') {
                          mapped = 'urgent';
                        } else if (level.includes('semi-urgent') || level.includes('semiurgent') || level === 'semi_urgent') {
                          mapped = 'high';
                        } else if (level.includes('non-urgent') || level.includes('nonurgent') || level === 'non_urgent') {
                          mapped = 'normal';
                        } else if (['urgent', 'high', 'normal', 'low'].includes(level)) {
                          mapped = level as 'urgent' | 'high' | 'normal' | 'low';
                        }
                        setTriageSuggestedPriority(mapped);
                        if (mapped) {
                          showSuccess('Suggestion applied', `Triage priority set to ${mapped} from copilot recommendation.`);
                        }
                      }}
                      className="px-2 py-1 rounded border border-amber-300 text-amber-800 text-xs font-semibold bg-amber-50 hover:bg-amber-100"
                    >
                      Apply suggestion to form
                    </button>
                  </div>
                </div>
              )}
            </div>
            <PatientAssessment 
              patient={selectedPatient || undefined}
              appointments={appointments.filter(a => String(a.patient.id) === String(selectedPatient?.id))} 
              suggestedPriority={triageSuggestedPriority || undefined}
              onSave={() => {
                fetchTodayAppointments();
                showSuccess('Triage Saved', 'Assessment recorded successfully.');
              }}
            />
          </div>
        )}
        {activeTab === 'notes' && (() => {
          const appointmentsAwaitingPayment = appointments.filter(apt => apt.paymentStatus === 'awaiting_payment');
          const hasPaymentPending = appointmentsAwaitingPayment.length > 0;

        if (hasPaymentPending && !isNurseAccountsUser()) {
            return (
              <div className="bg-gradient-to-br from-amber-50 to-orange-50 rounded-xl border-2 border-amber-300 p-8 text-center">
                <div className="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-br from-amber-500 to-orange-600 rounded-full mb-4">
                  <Lock className="w-10 h-10 text-white" />
                </div>
                <h3 className="text-2xl font-bold text-amber-900 mb-2">Payment Confirmation Required</h3>
                <p className="text-amber-700 mb-6 max-w-md mx-auto">
                  {appointmentsAwaitingPayment.length} appointment{appointmentsAwaitingPayment.length > 1 ? 's are' : ' is'} awaiting payment confirmation.
                  Nursing notes and clinical documentation are locked until Accounts confirms payment.
                </p>
                <div className="bg-white rounded-lg border border-amber-200 p-4 max-w-xl mx-auto space-y-3">
                  <p className="text-sm font-semibold text-amber-900 mb-2">Pending Appointments:</p>
                  {appointmentsAwaitingPayment.map(apt => (
                    <div key={apt.id} className="flex items-center justify-between py-2 px-3 bg-amber-50 rounded-lg border border-amber-200">
                      <div className="text-left">
                        <p className="font-semibold text-slate-900">
                          {apt.patient.firstName} {apt.patient.lastName}
                        </p>
                        <p className="text-xs text-slate-600">
                          {new Date(apt.appointmentDate).toLocaleString()}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        {apt.feeAmount && (
                          <span className="px-3 py-1 bg-amber-100 text-amber-800 rounded-full text-sm font-semibold">
                            ${apt.feeAmount.toFixed(2)}
                          </span>
                        )}
                        <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-bold bg-amber-600 text-white">
                          <CreditCard className="w-3 h-3" /> AWAITING
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
                <p className="text-xs text-amber-600 mt-6">
                  Contact Accounts department to confirm payment and unlock clinical features
                </p>
              </div>
            );
          }

          return (
            <div className="w-full overflow-x-auto space-y-4">
              <div className="rounded-xl border border-emerald-200 bg-emerald-50/70 p-4 space-y-3">
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2">
                  <div>
                    <h3 className="text-sm font-semibold text-emerald-900">Smart Charting Copilot</h3>
                    <p className="text-xs text-emerald-700">Generate draft notes and handoff summary. Review before use.</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={handleGenerateNursingDraft}
                      disabled={notesCopilotLoading || !selectedPatient}
                      className="px-3 py-2 rounded-lg bg-emerald-600 text-white text-sm font-semibold hover:bg-emerald-700 disabled:opacity-50"
                    >
                      {notesCopilotLoading ? 'Drafting...' : 'Generate Note Draft'}
                    </button>
                    <button
                      type="button"
                      onClick={handleGenerateHandoff}
                      disabled={handoffCopilotLoading || !selectedPatient}
                      className="px-3 py-2 rounded-lg bg-teal-600 text-white text-sm font-semibold hover:bg-teal-700 disabled:opacity-50"
                    >
                      {handoffCopilotLoading ? 'Summarizing...' : 'Generate Handoff'}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setActiveSection('main');
                        setActiveTab('copilot-metrics');
                      }}
                      className="px-3 py-2 rounded-lg border border-emerald-300 text-emerald-800 text-xs font-semibold bg-emerald-50 hover:bg-emerald-100"
                    >
                      View Copilot KPIs
                    </button>
                  </div>
                </div>
                {notesCopilotDraft && (
                  <div className="rounded-lg bg-white border border-emerald-200 p-3">
                    <p className="text-xs font-semibold text-emerald-800 mb-1">Draft Note</p>
                    <p className="text-sm text-slate-700 whitespace-pre-wrap">{notesCopilotDraft}</p>
                    <div className="mt-2 flex gap-2">
                      <button type="button" onClick={() => handleCopilotDecision('notes', 'accept', 'Generated note draft')} className="px-2 py-1 rounded bg-emerald-600 text-white text-xs font-semibold">Accept</button>
                      <button type="button" onClick={() => handleCopilotDecision('notes', 'modify', 'Generated note draft')} className="px-2 py-1 rounded bg-amber-600 text-white text-xs font-semibold">Modify</button>
                      <button type="button" onClick={() => handleCopilotDecision('notes', 'reject', 'Generated note draft')} className="px-2 py-1 rounded bg-rose-600 text-white text-xs font-semibold">Reject</button>
                    </div>
                  </div>
                )}
                {handoffCopilotSummary && (
                  <div className="rounded-lg bg-white border border-teal-200 p-3">
                    <p className="text-xs font-semibold text-teal-800 mb-1">Handoff Summary</p>
                    <div className="mb-2 flex flex-wrap gap-2">
                      <span className="inline-flex items-center px-2 py-1 rounded-full text-[11px] font-semibold bg-teal-50 border border-teal-200 text-teal-800">
                        Source: {handoffCopilotMeta?.source || 'CDSS Nurse Handoff Copilot'}
                      </span>
                      {handoffCopilotMeta?.audit?.modelVersion && (
                        <span className="inline-flex items-center px-2 py-1 rounded-full text-[11px] font-semibold bg-slate-50 border border-slate-200 text-slate-700">
                          Model: {String(handoffCopilotMeta.audit.modelVersion)}
                        </span>
                      )}
                      {handoffCopilotMeta?.audit?.promptContextHash && (
                        <span className="inline-flex items-center px-2 py-1 rounded-full text-[11px] font-semibold bg-slate-50 border border-slate-200 text-slate-700">
                          Context hash: {String(handoffCopilotMeta.audit.promptContextHash).slice(0, 8)}…
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-slate-700 whitespace-pre-wrap">{handoffCopilotSummary}</p>
                    <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-2 text-xs">
                      <div className="rounded border border-slate-200 bg-slate-50 px-2 py-1">
                        <span className="font-semibold text-slate-700">Workflow:</span>{' '}
                        <span className="capitalize">{handoffWorkflow.status}</span>
                      </div>
                      <div className="rounded border border-slate-200 bg-slate-50 px-2 py-1">
                        <span className="font-semibold text-slate-700">Reviewed:</span>{' '}
                        <span>{handoffWorkflow.reviewed ? 'Yes' : 'No'}</span>
                      </div>
                      {handoffWorkflow.finalizedAt && (
                        <div className="rounded border border-slate-200 bg-slate-50 px-2 py-1">
                          <span className="font-semibold text-slate-700">Finalized:</span>{' '}
                          {new Date(handoffWorkflow.finalizedAt).toLocaleString()}
                          {handoffWorkflow.finalizedBy ? ` by ${handoffWorkflow.finalizedBy}` : ''}
                        </div>
                      )}
                      {handoffWorkflow.reviewedAt && (
                        <div className="rounded border border-slate-200 bg-slate-50 px-2 py-1">
                          <span className="font-semibold text-slate-700">Reviewer Confirmation:</span>{' '}
                          {new Date(handoffWorkflow.reviewedAt).toLocaleString()}
                          {handoffWorkflow.reviewedBy ? ` by ${handoffWorkflow.reviewedBy}` : ''}
                        </div>
                      )}
                      {handoffWorkflow.sharedAt && (
                        <div className="rounded border border-slate-200 bg-slate-50 px-2 py-1 md:col-span-2">
                          <span className="font-semibold text-slate-700">Shared:</span>{' '}
                          {new Date(handoffWorkflow.sharedAt).toLocaleString()}
                          {handoffWorkflow.sharedBy ? ` by ${handoffWorkflow.sharedBy}` : ''}
                        </div>
                      )}
                    </div>
                    <div className="mt-2 flex gap-2">
                      <button type="button" onClick={() => handleCopilotDecision('handoff', 'accept', 'Generated handoff summary')} className="px-2 py-1 rounded bg-emerald-600 text-white text-xs font-semibold">Accept</button>
                      <button type="button" onClick={() => handleCopilotDecision('handoff', 'modify', 'Generated handoff summary')} className="px-2 py-1 rounded bg-amber-600 text-white text-xs font-semibold">Modify</button>
                      <button type="button" onClick={() => handleCopilotDecision('handoff', 'reject', 'Generated handoff summary')} className="px-2 py-1 rounded bg-rose-600 text-white text-xs font-semibold">Reject</button>
                    </div>
                    <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-2">
                      <input
                        type="text"
                        value={handoffRecipient}
                        onChange={(e) => setHandoffRecipient(e.target.value)}
                        placeholder="Share recipient (e.g. Next Shift Nurse)"
                        className="px-3 py-2 border border-teal-200 rounded-lg text-sm focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                      />
                      <input
                        type="text"
                        value={handoffReviewNote}
                        onChange={(e) => setHandoffReviewNote(e.target.value)}
                        placeholder="Reviewer/finalize note (optional)"
                        className="px-3 py-2 border border-teal-200 rounded-lg text-sm focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                      />
                    </div>
                    <div className="mt-2 flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={handleFinalizeHandoffWorkflow}
                        disabled={handoffActionLoading || handoffWorkflowLoading || !selectedPatient}
                        className="px-2 py-1 rounded bg-teal-700 text-white text-xs font-semibold disabled:opacity-50"
                      >
                        {handoffActionLoading ? 'Working...' : 'Finalize'}
                      </button>
                      <button
                        type="button"
                        onClick={handleConfirmHandoffReview}
                        disabled={handoffActionLoading || handoffWorkflowLoading || !selectedPatient}
                        className="px-2 py-1 rounded bg-cyan-700 text-white text-xs font-semibold disabled:opacity-50"
                      >
                        {handoffActionLoading ? 'Working...' : 'Confirm Reviewer'}
                      </button>
                      <button
                        type="button"
                        onClick={handleShareHandoffWorkflow}
                        disabled={handoffActionLoading || handoffWorkflowLoading || !selectedPatient || !handoffWorkflow.finalized}
                        className="px-2 py-1 rounded bg-indigo-700 text-white text-xs font-semibold disabled:opacity-50"
                      >
                        {handoffActionLoading ? 'Working...' : 'Share'}
                      </button>
                    </div>
                  </div>
                )}
                <input
                  type="text"
                  value={copilotDecisionNote}
                  onChange={(e) => setCopilotDecisionNote(e.target.value)}
                  placeholder="Optional reason for modify/reject decisions"
                  className="w-full px-3 py-2 border border-emerald-200 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                />
              </div>
              <NursingNotes
                patient={selectedPatient || undefined}
                appointments={appointments}
                preset={notesPreset}
                copilotDraft={notesCopilotDraft}
                copilotProvenance={notesCopilotProvenance}
                copilotDraftPatientId={selectedPatient?.id}
              />
              {selectedPatient && (
                <NursingIntelligencePanel
                  patientId={selectedPatient.id}
                  diagnoses={[]}
                  token={localStorage.getItem('ehr_token') || ''}
                  tenantSlug={tenantSlug || ''}
                />
              )}
            </div>
          );
        })()}
        
        {/* HIV Section Tabs */}
        {activeSection === 'hiv' && activeTab === 'testing' && (
          <HIVTestingWithSmartForms
            tenantSlug={tenantSlug || ''}
            token={localStorage.getItem('ehr_token') || ''}
            patientId={selectedPatient?.id}
            onTestComplete={(_testData) => {
              // Handle test completion
            }}
          />
        )}
        {activeSection === 'hiv' && activeTab === 'hiv-patients' && (
          <HIVPatientManagement tenantSlug={tenantSlug || ''} />
        )}
        {activeSection === 'hiv' && activeTab === 'tb-screening' && (
          <TBScreeningWithSmartForms
            tenantSlug={tenantSlug || ''}
            token={localStorage.getItem('ehr_token') || ''}
            patientId={selectedPatient?.id}
            onScreeningComplete={(_screeningData) => {
            }}
          />
        )}
        {activeSection === 'hiv' && activeTab === 'cervical-cancer' && (
          <CervicalCancerScreeningComponent tenantSlug={tenantSlug || ''} />
        )}
        {activeSection === 'hiv' && activeTab === 'quality-metrics' && (
          <div className="bg-white rounded-xl shadow-lg p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-slate-900">HIV Quality Metrics & Outcomes</h2>
              <button
                onClick={async () => {
                  const token = localStorage.getItem('ehr_token');
                  if (token && tenantSlug) {
                    try {
                      const metricsRes = await ehrApi.getQualityMetrics(token, tenantSlug);
                      setQualityMetrics(metricsRes.data);
                      showSuccess('Success', 'Quality metrics refreshed');
                    } catch (error) {
                      showError('Error', 'Failed to refresh metrics');
                    }
                  }
                }}
                className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 flex items-center gap-2 font-semibold"
              >
                <RefreshCw className="w-4 h-4" />
                Refresh Metrics
              </button>
            </div>
            {qualityMetrics ? (
              <HIVQualityMetricsChart metrics={qualityMetrics} />
            ) : (
              <div className="text-center py-12">
                <Activity className="w-12 h-12 text-emerald-400 mx-auto animate-spin mb-4" />
                <p className="text-slate-600">Loading quality metrics...</p>
              </div>
            )}
          </div>
        )}
        {activeSection === 'hiv' && activeTab === 'stock-management' && (
          <HIVStockManagement tenantSlug={tenantSlug || ''} />
        )}
        {activeSection === 'hiv' && activeTab === 'ltfu' && (
          <div className="glass-card rounded-2xl p-8">
            <div className="flex items-center justify-between mb-8">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-gradient-to-br from-orange-500 to-red-600 rounded-xl shadow-lg">
                  <AlertCircle className="w-6 h-6 text-white" />
                </div>
                <h2 className="text-2xl font-bold bg-gradient-to-r from-orange-600 to-red-600 bg-clip-text text-transparent">Lost to Follow-Up (LTFU) Management</h2>
              </div>
              <div className="flex items-center gap-3">
                <label className="text-sm font-semibold text-slate-700">Days since last visit:</label>
                <select
                  value={ltfuDays}
                  onChange={(e) => {
                    setLtfuDays(parseInt(e.target.value));
                    const token = localStorage.getItem('ehr_token');
                    if (token && tenantSlug) {
                      ehrApi.getLTFUPatients(parseInt(e.target.value), token, tenantSlug).then(res => {
                        setLtfuPatients(res.data.patients || []);
                      });
                    }
                  }}
                  className="glass-input px-4 py-2 rounded-xl text-slate-800 font-medium"
                >
                  <option value="30">30 days</option>
                  <option value="60">60 days</option>
                  <option value="90">90 days</option>
                  <option value="120">120 days</option>
                  <option value="180">180 days</option>
                </select>
              </div>
            </div>

            {ltfuPatients.length === 0 ? (
              <div className="text-center py-16 glass-section rounded-xl">
                <CheckCircle className="w-20 h-20 text-green-500 mx-auto mb-4" />
                <h3 className="text-xl font-bold text-slate-700 mb-2">No LTFU Patients</h3>
                <p className="text-slate-600">All patients have been seen within the last {ltfuDays} days</p>
              </div>
            ) : (
              <div className="space-y-6">
                <div className="glass-gradient rounded-xl p-6 border-l-4 border-red-500 bg-gradient-to-r from-red-500/10 to-orange-500/10">
                  <p className="font-bold text-red-900 text-lg mb-2">
                    ⚠️ {ltfuPatients.length} patient{ltfuPatients.length > 1 ? 's' : ''} lost to follow-up 
                    ({ltfuPatients.length} not seen in {ltfuDays}+ days)
                  </p>
                  <p className="text-sm text-red-700">
                    These patients require immediate follow-up action to prevent further disengagement
                  </p>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="bg-slate-100 border-b border-slate-200">
                        <th className="px-4 py-3 text-left text-sm font-semibold text-slate-700">Patient</th>
                        <th className="px-4 py-3 text-left text-sm font-semibold text-slate-700">Enrollment</th>
                        <th className="px-4 py-3 text-left text-sm font-semibold text-slate-700">Last Visit</th>
                        <th className="px-4 py-3 text-left text-sm font-semibold text-slate-700">Days Since</th>
                        <th className="px-4 py-3 text-left text-sm font-semibold text-slate-700">ART Start</th>
                        <th className="px-4 py-3 text-left text-sm font-semibold text-slate-700">Risk Level</th>
                        <th className="px-4 py-3 text-left text-sm font-semibold text-slate-700">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {ltfuPatients.map((patient: any) => {
                        const daysSince = patient.days_since_last_visit || 
                          (patient.last_visit_date 
                            ? Math.floor((new Date().getTime() - new Date(patient.last_visit_date).getTime()) / (1000 * 60 * 60 * 24))
                            : null);
                        const riskLevel = daysSince && daysSince > 180 ? 'critical' : daysSince && daysSince > 90 ? 'high' : 'medium';

                        return (
                          <tr key={patient.id} className="border-b border-slate-100 hover:bg-slate-50">
                            <td className="px-4 py-3">
                              <div>
                                <p className="font-semibold text-slate-900">
                                  {patient.first_name} {patient.last_name}
                                </p>
                                <p className="text-xs text-slate-500">{patient.patient_number}</p>
                              </div>
                            </td>
                            <td className="px-4 py-3 text-sm text-slate-600">
                              {patient.enrollment_number}
                            </td>
                            <td className="px-4 py-3 text-sm">
                              {patient.last_visit_date 
                                ? formatDateToDDMMYYYY(patient.last_visit_date)
                                : <span className="text-red-600 font-semibold">Never</span>
                              }
                            </td>
                            <td className="px-4 py-3">
                              {daysSince !== null ? (
                                <span className={`px-2 py-1 rounded text-xs font-semibold ${
                                  riskLevel === 'critical' ? 'bg-red-100 text-red-800' :
                                  riskLevel === 'high' ? 'bg-orange-100 text-orange-800' :
                                  'bg-yellow-100 text-yellow-800'
                                }`}>
                                  {daysSince} days
                                </span>
                              ) : (
                                <span className="text-slate-400">N/A</span>
                              )}
                            </td>
                            <td className="px-4 py-3 text-sm text-slate-600">
                              {patient.art_start_date ? formatDateToDDMMYYYY(patient.art_start_date) : 'N/A'}
                            </td>
                            <td className="px-4 py-3">
                              <span className={`px-2 py-1 rounded text-xs font-semibold ${
                                riskLevel === 'critical' ? 'bg-red-600 text-white' :
                                riskLevel === 'high' ? 'bg-orange-600 text-white' :
                                'bg-yellow-600 text-white'
                              }`}>
                                {riskLevel.toUpperCase()}
                              </span>
                            </td>
                            <td className="px-4 py-3">
                              <button
                                onClick={() => {
                                  navigate(`/ehr/${tenantSlug}/nurse/hiv-patients?patient=${patient.patient_id}`);
                                }}
                                className="px-3 py-1 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 text-sm font-semibold"
                              >
                                View Patient
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}
        {activeSection === 'hiv' && activeTab === 'hiv-reports' && (
          <HivReportsPanel tenantSlug={tenantSlug || ''} token={localStorage.getItem('ehr_token') || ''} />
        )}
        {activeSection === 'hiv' && activeTab === 'who-workflow' && (
          <div className="bg-white rounded-xl shadow-lg p-6">
            <div className="mb-6">
              <h2 className="text-xl font-bold text-slate-900 mb-2 flex items-center gap-2">
                <Activity className="w-6 h-6 text-indigo-600" />
                Guided WHO HIV Workflow
              </h2>
              <p className="text-slate-600">
                Step-by-step WHO-aligned HIV workflow: Testing → Registration → ART Initiation → Care & Treatment
              </p>
            </div>

            {selectedPatient ? (
              <HIVWorkflowIntegration
                patientId={selectedPatient.id}
                patientName={`${selectedPatient.firstName} ${selectedPatient.lastName}`}
                patientAge={selectedPatient.dateOfBirth ? Math.floor((new Date().getTime() - new Date(selectedPatient.dateOfBirth).getTime()) / (1000 * 60 * 60 * 24 * 365)) : undefined}
                patientSex={selectedPatient.gender}
                tenantSlug={tenantSlug || ''}
                token={localStorage.getItem('ehr_token') || ''}
                currentStage="testing"
                onComplete={() => {
                  showSuccess('Success', 'WHO Smart Forms workflow completed successfully');
                }}
              />
            ) : (
              <div className="text-center py-12 bg-gradient-to-br from-indigo-50 to-blue-50 rounded-lg border-2 border-indigo-200">
                <Activity className="w-16 h-16 text-indigo-400 mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-slate-900 mb-2">Select a patient to begin</h3>
                <p className="text-slate-600 mb-6">
                  Choose a patient from the queue or search to start the guided WHO workflow
                </p>
                <div className="flex flex-col sm:flex-row gap-4 justify-center">
                  <button
                    onClick={() => {
                      // Focus on patient search/selection
                      const searchInput = document.querySelector('input[placeholder*="Search"]') as HTMLInputElement;
                      if (searchInput) {
                        searchInput.focus();
                      }
                    }}
                    className="px-6 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 font-semibold flex items-center justify-center gap-2"
                  >
                    <Search className="w-5 h-5" />
                    Search Patient
                  </button>
                  <button
                    onClick={() => setShowHivTestingModal(true)}
                    className="px-6 py-3 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 font-semibold flex items-center justify-center gap-2"
                  >
                    <TestTube className="w-5 h-5" />
                    Start HIV Testing
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Maternity Section */}
        {activeSection === 'maternity' && (
          <div className="bg-white rounded-xl shadow-lg p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-gray-900 flex items-center">
                <Heart className="w-6 h-6 text-pink-600 mr-2" />
                Maternity & Obstetrics Care
              </h2>
            </div>

            {/* WHO Smart Forms Integration */}
            <div className="mb-6">
              <MaternityWithSmartForms
                tenantSlug={tenantSlug!}
                token={localStorage.getItem('ehr_token') || ''}
                patientId={selectedPatient?.id}
                patientName={selectedPatient ? `${selectedPatient.firstName} ${selectedPatient.lastName}` : undefined}
                onSuccess={() => {
                  // Refresh data if needed
                }}
              />
            </div>

            {/* Standard Maternity Dashboard */}
            <MaternityDashboard
              tenantSlug={tenantSlug!}
              token={localStorage.getItem('ehr_token') || ''}
            />
          </div>
        )}

        {/* Women's Health Section */}
        {activeSection === 'women-health' && (
          <div className="bg-white rounded-xl shadow-lg p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-gray-900 flex items-center">
                <Stethoscope className="w-6 h-6 text-purple-600 mr-2" />
                Women's Health
              </h2>
            </div>
            {activeTab === 'cervical-screening' && selectedPatient && (
              <CervicalCancerDashboard patientId={selectedPatient.id} />
            )}
            {activeTab === 'cervical-screening' && !selectedPatient && (
              <div className="text-slate-500 text-sm">Select a patient from the queue to view cervical cancer screening records.</div>
            )}
            {activeTab === 'family-planning' && selectedPatient && (
              <FamilyPlanningDashboard patientId={selectedPatient.id} />
            )}
            {activeTab === 'family-planning' && !selectedPatient && (
              <div className="text-slate-500 text-sm">Select a patient from the queue to view family planning records.</div>
            )}
          </div>
        )}

        {/* NCD / Hypertension Section */}
        {activeSection === 'ncd' && (
          <div className="bg-white rounded-xl shadow-lg p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-gray-900 flex items-center">
                <Activity className="w-6 h-6 text-blue-600 mr-2" />
                NCD / Hypertension Register
              </h2>
            </div>
            {activeTab === 'hypertension' && selectedPatient && (
              <HypertensionDashboard patientId={selectedPatient.id} />
            )}
            {activeTab === 'hypertension' && !selectedPatient && (
              <div className="text-slate-500 text-sm">Select a patient from the queue to view hypertension records.</div>
            )}
            {activeTab === 'traditional-medicine' && selectedPatient && (
              <TraditionalMedicineDashboard patientId={selectedPatient.id} />
            )}
            {activeTab === 'traditional-medicine' && !selectedPatient && (
              <div className="text-slate-500 text-sm">Select a patient to view their traditional medicine record.</div>
            )}
          </div>
        )}
      </div>

      {/* Vitals Recording Modal */}
      {showVitalsModal && selectedPatient && (
        <div className="fixed inset-0 z-[100] bg-black/70 backdrop-blur-md flex items-center justify-center p-4">
          <div className="w-full max-w-4xl max-h-[85vh] overflow-hidden bg-gradient-to-br from-white to-slate-50 rounded-3xl shadow-2xl border border-slate-200/50">
            <div className="sticky top-0 bg-gradient-to-r from-red-50 to-pink-50 border-b border-red-200/50 px-6 py-5 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-gradient-to-r from-red-500 to-pink-600 rounded-xl">
                  <Activity className="w-5 h-5 text-white" />
                </div>
                <h3 className="text-lg font-bold text-slate-900">Record Vitals</h3>
              </div>
              <button onClick={() => setShowVitalsModal(false)} className="p-2 rounded-lg hover:bg-white/60">
                <X className="w-5 h-5 text-slate-600" />
              </button>
            </div>
            <div className="overflow-y-auto px-6 py-6 max-h-[calc(85vh-74px)]">
              <VitalsPanel
                patient={selectedPatient}
                onClose={() => setShowVitalsModal(false)}
                onSave={(insights) => {
                  fetchTodayAppointments();
                  if (!insights?.risk) {
                    setShowVitalsModal(false);
                  }
                }}
              />
            </div>
          </div>
        </div>
      )}

      {/* Assessment Modal */}
      {showAssessmentModal && selectedPatient && (
        <div className="fixed inset-0 z-[100] bg-black/70 backdrop-blur-md flex items-center justify-center p-4">
          <div className="w-full max-w-5xl max-h-[85vh] overflow-hidden bg-gradient-to-br from-white to-slate-50 rounded-3xl shadow-2xl border border-slate-200/50">
            <div className="sticky top-0 bg-gradient-to-r from-orange-50 to-yellow-50 border-b border-amber-200/50 px-6 py-5 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-gradient-to-r from-orange-500 to-yellow-600 rounded-xl">
                  <ClipboardList className="w-5 h-5 text-white" />
                </div>
                <h3 className="text-lg font-bold text-slate-900">Triage Assessment</h3>
              </div>
              <button onClick={() => setShowAssessmentModal(false)} className="p-2 rounded-lg hover:bg-white/60">
                <X className="w-5 h-5 text-slate-600" />
              </button>
            </div>
            <div className="overflow-y-auto px-6 py-6 max-h-[calc(85vh-74px)]">
              <PatientAssessment
                patient={selectedPatient}
                appointments={appointments.filter(apt => apt.patient.id === selectedPatient?.id)}
                suggestedPriority={triageSuggestedPriority || undefined}
                onClose={() => setShowAssessmentModal(false)}
                onSave={() => {
                  setShowAssessmentModal(false);
                  fetchTodayAppointments();
                  showSuccess('Success', 'Assessment completed successfully');
                }}
              />
            </div>
          </div>
        </div>
      )}

      {showMentalHealthModal && selectedPatient && (
        <ModalPortal>
          <div className="mx-auto max-h-[85vh] w-full max-w-6xl overflow-y-auto rounded-3xl border border-slate-200/50 bg-gradient-to-br from-white to-slate-50 p-6 shadow-2xl">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <h3 className="text-xl font-bold text-slate-900">Mental Health Workspace</h3>
                <p className="text-sm text-slate-600">
                  {selectedPatient.firstName} {selectedPatient.lastName}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowMentalHealthModal(false)}
                className="rounded-lg bg-slate-100 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-200"
              >
                Close
              </button>
            </div>
            <MentalHealthDashboard
              patientId={selectedPatient.id}
              providerId={currentUser?.id || ''}
              tenantSubdomain={tenantSlug || ''}
              initialTab={mentalHealthInitialTab}
            />
          </div>
        </ModalPortal>
      )}

      {/* Execute Order Modal */}
      {showExecuteOrderModal && (
        <div className="fixed inset-0 z-[100] bg-black/70 backdrop-blur-md flex items-center justify-center p-4">
          <div className="w-full max-w-xl bg-gradient-to-br from-white to-slate-50 rounded-3xl shadow-2xl border border-slate-200/50 overflow-hidden">
            <div className="bg-gradient-to-r from-emerald-50 to-green-50 border-b border-emerald-200/50 px-6 py-5 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-gradient-to-r from-green-500 to-emerald-600 rounded-xl">
                  <ClipboardList className="w-5 h-5 text-white" />
                </div>
                <h3 className="text-lg font-bold text-slate-900">Execute Order</h3>
              </div>
              <button onClick={() => setShowExecuteOrderModal(false)} className="p-2 rounded-lg hover:bg-white/60">
                <X className="w-5 h-5 text-slate-600" />
              </button>
            </div>
            <div className="px-6 py-6">
              <label className="block text-sm font-medium text-slate-700 mb-2">Execution Notes (optional)</label>
              <textarea
                value={executionNotes}
                onChange={(e) => setExecutionNotes(e.target.value)}
                placeholder="Add any observations or details about how the order was executed..."
                className="w-full min-h-[120px] p-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all duration-200"
              />
              <div className="mt-6 flex items-center justify-end gap-3">
                <button
                  onClick={() => setShowExecuteOrderModal(false)}
                  className="px-4 py-2 rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  onClick={confirmExecuteOrder}
                  className="px-4 py-2 rounded-lg bg-gradient-to-r from-green-500 to-emerald-600 text-white hover:from-green-600 hover:to-emerald-700 font-semibold"
                >
                  Execute Order
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Create Patient Modal */}
      {showCreatePatientModal && (
        <CreatePatientModal
          isOpen={showCreatePatientModal}
          onClose={() => setShowCreatePatientModal(false)}
          onPatientCreated={() => {
            fetchTodayAppointments();
            fetchPatients();
          }}
          tenantSlug={tenantSlug!}
        />
      )}

      {/* Create Appointment Modal */}
      {showCreateAppointmentModal && (
        <CreateAppointmentModal
          onClose={() => setShowCreateAppointmentModal(false)}
          onSuccess={() => {
            setShowCreateAppointmentModal(false);
            fetchTodayAppointments();
            showSuccess('Success', 'Appointment scheduled successfully');
          }}
          preselectedPatient={selectedPatient || undefined}
        />
      )}

      {/* HIV Nurse Panel Modal */}
      {showHivModal && currentAppointment && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-md flex items-center justify-center z-[100000] p-4">
          <HIVNursePanel
            appointmentId={currentAppointment.id}
            patientId={currentAppointment.patient.id}
            tenantSlug={tenantSlug!}
            token={localStorage.getItem('ehr_token') || ''}
            onClose={() => setShowHivModal(false)}
            onSaved={() => {
              setShowHivModal(false);
              // Optionally refresh appointments
            }}
          />
        </div>
      )}

      {/* HIV Testing Modal - Available from Main Dashboard */}
      {showHivTestingModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-md flex items-center justify-center z-[100000] p-4 overflow-y-auto">
          <div className="w-full max-w-5xl bg-white rounded-2xl shadow-2xl my-8 max-h-[90vh] flex flex-col">
            <div className="sticky top-0 bg-gradient-to-r from-emerald-600 to-teal-700 px-6 py-4 flex items-center justify-between rounded-t-2xl">
              <h2 className="text-xl font-bold text-white">HIV Testing</h2>
              <button
                onClick={() => setShowHivTestingModal(false)}
                className="text-white hover:text-emerald-100"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
            <div className="p-6 overflow-y-auto flex-1">
              <HIVTestingComponent tenantSlug={tenantSlug || ''} />
            </div>
          </div>
        </div>
      )}

      {/* Shared Documents Modal */}
      {showSharedDocumentsModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-md flex items-center justify-center z-[100000] p-4 overflow-y-auto">
          <div className="w-full max-w-7xl bg-white rounded-2xl shadow-2xl my-8 max-h-[90vh] flex flex-col">
            <div className="sticky top-0 bg-gradient-to-r from-violet-600 to-purple-700 px-6 py-4 flex items-center justify-between rounded-t-2xl">
              <div className="flex items-center gap-3">
                <FolderOpen className="w-6 h-6 text-white" />
                <h2 className="text-xl font-bold text-white">Shared Documents</h2>
                {sharedDocumentsCount > 0 && (
                  <span className="inline-flex items-center justify-center px-3 py-1 rounded-full text-xs font-bold bg-white text-violet-600">
                    {sharedDocumentsCount}
                  </span>
                )}
              </div>
              <button
                onClick={() => setShowSharedDocumentsModal(false)}
                className="text-white hover:text-violet-100"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
            <div className="p-6 overflow-y-auto flex-1">
              <SharedDocumentsList
                token={localStorage.getItem('ehr_token') || ''}
                tenantSlug={tenantSlug || ''}
                currentUser={currentUser}
              />
            </div>
          </div>
        </div>
      )}

      {/* Care Plans Modal */}
      {showCarePlansModal && carePlansPatientId && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-md flex items-center justify-center z-[100000] p-4 overflow-y-auto">
          <div className="w-full max-w-7xl bg-white rounded-2xl shadow-2xl my-8 max-h-[90vh] flex flex-col">
            <div className="sticky top-0 bg-gradient-to-r from-teal-600 to-cyan-700 px-6 py-4 flex items-center justify-between rounded-t-2xl">
              <div className="flex items-center gap-3">
                <Target className="w-6 h-6 text-white" />
                <div>
                  <h2 className="text-xl font-bold text-white">Patient Care Plans</h2>
                  <p className="text-sm text-teal-100">{carePlansPatientName}</p>
                </div>
              </div>
              <button
                onClick={() => {
                  setShowCarePlansModal(false);
                  setCarePlansPatientId(null);
                  setCarePlansPatientName('');
                }}
                className="text-white hover:text-teal-100"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
            <div className="p-6 overflow-y-auto flex-1">
              <PatientCarePlansView
                patientId={carePlansPatientId}
                tenantSlug={tenantSlug || ''}
                token={localStorage.getItem('ehr_token') || ''}
                onClose={() => {
                  setShowCarePlansModal(false);
                  setCarePlansPatientId(null);
                  setCarePlansPatientName('');
                }}
              />
            </div>
          </div>
        </div>
      )}

      {/* Lab Results Modal */}
      {showLabResultsModal && labResultsPatientId && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-md flex items-center justify-center z-[100000] p-4 overflow-y-auto">
          <div className="w-full max-w-7xl bg-white rounded-2xl shadow-2xl my-8 max-h-[90vh] flex flex-col">
            <div className="sticky top-0 bg-gradient-to-r from-purple-600 to-indigo-700 px-6 py-4 flex items-center justify-between rounded-t-2xl">
              <div className="flex items-center gap-3">
                <TestTube className="w-6 h-6 text-white" />
                <div>
                  <h2 className="text-xl font-bold text-white">Laboratory Results</h2>
                  <p className="text-sm text-purple-100">{labResultsPatientName}</p>
                </div>
              </div>
              <button
                onClick={() => {
                  setShowLabResultsModal(false);
                  setLabResultsPatientId(null);
                  setLabResultsPatientName('');
                }}
                className="text-white hover:text-purple-100"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
            <div className="p-6 overflow-y-auto flex-1">
              <LabResultsViewer
                patientId={labResultsPatientId}
                tenantSlug={tenantSlug || ''}
                token={localStorage.getItem('ehr_token') || ''}
                onClose={() => {
                  setShowLabResultsModal(false);
                  setLabResultsPatientId(null);
                  setLabResultsPatientName('');
                }}
              />
            </div>
          </div>
        </div>
      )}

      {showVitalsHistoryModal && vitalsHistoryPatientId && (
        <ModalPortal>
          <div className="fixed inset-0 bg-slate-900/70 backdrop-blur-md flex items-center justify-center z-[100000] p-4 overflow-y-auto">
            <div className="w-full max-w-3xl bg-gradient-to-br from-slate-50 via-white to-sky-50 rounded-3xl shadow-2xl border border-sky-100/70 my-8 max-h-[90vh] flex flex-col overflow-hidden">
              <div className="sticky top-0 bg-gradient-to-r from-sky-500 via-indigo-500 to-violet-500 px-6 py-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-white/15 flex items-center justify-center text-white">
                    <Activity className="w-5 h-5" />
                  </div>
                  <div>
                    <h2 className="text-lg font-bold text-white">Vitals History</h2>
                    <p className="text-xs text-sky-100">
                      {vitalsHistoryPatientName}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => {
                    setShowVitalsHistoryModal(false);
                    setVitalsHistoryPatientId(null);
                    setVitalsHistoryPatientName(null);
                    setVitalsHistory([]);
                  }}
                  className="p-2 rounded-xl hover:bg-white/15 text-white transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
                {vitalsHistoryLoading ? (
                  <div className="flex flex-col items-center justify-center py-10 text-slate-500 text-sm">
                    <Loader2 className="w-6 h-6 animate-spin mb-3 text-sky-500" />
                    Loading vitals history...
                  </div>
                ) : vitalsHistory.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-10 text-center">
                    <Heart className="w-10 h-10 text-slate-300 mb-3" />
                    <h3 className="text-base font-semibold text-slate-700 mb-1">No Vital Signs Recorded</h3>
                    <p className="text-sm text-slate-500">
                      No vitals have been recorded for this patient yet. Use the Record Vitals button from the queue or patient view to capture the first set.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {vitalsHistory.map((v: any, index: number) => (
                      <div
                        key={v.id || index}
                        className="bg-white/90 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow duration-200 p-4"
                      >
                        <div className="flex items-start justify-between mb-3">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-sky-500 to-indigo-500 text-white flex items-center justify-center text-sm font-semibold">
                              {new Date(v.recordedAt || v.recorded_at).getDate()}
                            </div>
                            <div>
                              <div className="text-sm font-semibold text-slate-900">
                                {formatDateTimeToDDMMYYYYHHMM(v.recordedAt || v.recorded_at)}
                              </div>
                              <div className="text-xs text-slate-500">
                                Recorded by{' '}
                                {v.recordedByUser && (v.recordedByUser.firstName || v.recordedByUser.lastName)
                                  ? `${v.recordedByUser.firstName || ''} ${v.recordedByUser.lastName || ''}`.trim()
                                  : v.recordedBy && typeof v.recordedBy === 'object' && (v.recordedBy.firstName || v.recordedBy.lastName)
                                  ? `${v.recordedBy.firstName || ''} ${v.recordedBy.lastName || ''}`.trim()
                                  : v.recordedByName || v.recorded_by_name || 'Unknown'}
                              </div>
                            </div>
                          </div>
                          <span className="inline-flex items-center gap-1 text-[11px] font-medium px-2.5 py-1 rounded-full bg-sky-50 text-sky-700 border border-sky-200">
                            <Activity className="w-3 h-3" />
                            Visit #{v.visitNumber || vitalsHistory.length - index}
                          </span>
                        </div>

                        <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-sm text-slate-700">
                          {v.temperature != null && (
                            <div className="flex items-center gap-2">
                              <div className="w-7 h-7 rounded-lg bg-rose-50 flex items-center justify-center">
                                <Thermometer className="w-4 h-4 text-rose-500" />
                              </div>
                              <div>
                                <div className="text-xs text-slate-500">Temperature</div>
                                <div className="font-semibold">
                                  {v.temperature}°C
                                </div>
                              </div>
                            </div>
                          )}
                          {v.bloodPressure && (
                            <div className="flex items-center gap-2">
                              <div className="w-7 h-7 rounded-lg bg-amber-50 flex items-center justify-center">
                                <Activity className="w-4 h-4 text-amber-500" />
                              </div>
                              <div>
                                <div className="text-xs text-slate-500">Blood Pressure</div>
                                <div className="font-semibold">
                                  {v.bloodPressure}
                                </div>
                              </div>
                            </div>
                          )}
                          {v.heartRate != null && (
                            <div className="flex items-center gap-2">
                              <div className="w-7 h-7 rounded-lg bg-red-50 flex items-center justify-center">
                                <Heart className="w-4 h-4 text-red-500" />
                              </div>
                              <div>
                                <div className="text-xs text-slate-500">Heart Rate</div>
                                <div className="font-semibold">
                                  {v.heartRate} bpm
                                </div>
                              </div>
                            </div>
                          )}
                          {v.oxygenSaturation != null && (
                            <div className="flex items-center gap-2">
                              <div className="w-7 h-7 rounded-lg bg-emerald-50 flex items-center justify-center">
                                <Droplets className="w-4 h-4 text-emerald-500" />
                              </div>
                              <div>
                                <div className="text-xs text-slate-500">SpO₂</div>
                                <div className="font-semibold">
                                  {v.oxygenSaturation}%
                                </div>
                              </div>
                            </div>
                          )}
                          {v.respiratoryRate != null && (
                            <div className="flex items-center gap-2">
                              <div className="w-7 h-7 rounded-lg bg-sky-50 flex items-center justify-center">
                                <Activity className="w-4 h-4 text-sky-500" />
                              </div>
                              <div>
                                <div className="text-xs text-slate-500">Respiratory Rate</div>
                                <div className="font-semibold">
                                  {v.respiratoryRate} /min
                                </div>
                              </div>
                            </div>
                          )}
                          {v.weight != null && (
                            <div className="flex items-center gap-2">
                              <div className="w-7 h-7 rounded-lg bg-slate-50 flex items-center justify-center">
                                <User className="w-4 h-4 text-slate-500" />
                              </div>
                              <div>
                                <div className="text-xs text-slate-500">Weight</div>
                                <div className="font-semibold">
                                  {v.weight} kg
                                </div>
                              </div>
                            </div>
                          )}
                          {v.height != null && (
                            <div className="flex items-center gap-2">
                              <div className="w-7 h-7 rounded-lg bg-slate-50 flex items-center justify-center">
                                <ArrowDown className="w-4 h-4 text-slate-500" />
                              </div>
                              <div>
                                <div className="text-xs text-slate-500">Height</div>
                                <div className="font-semibold">
                                  {v.height} cm
                                </div>
                              </div>
                            </div>
                          )}
                          {v.bmi != null && (
                            <div className="flex items-center gap-2">
                              <div className="w-7 h-7 rounded-lg bg-violet-50 flex items-center justify-center">
                                <BarChart3 className="w-4 h-4 text-violet-500" />
                              </div>
                              <div>
                                <div className="text-xs text-slate-500">BMI</div>
                                <div className="font-semibold">
                                  {v.bmi}
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </ModalPortal>
      )}

      {/* AI Guideline Search Modal */}
      {showGuidelineSearch && (
        <ModalPortal>
          <div className="fixed inset-0 z-[100] bg-black/70 backdrop-blur-md flex items-center justify-center p-4">
            <div className="w-full max-w-4xl max-h-[85vh] overflow-hidden rounded-3xl shadow-2xl flex flex-col"
              style={{ background: 'linear-gradient(145deg, #1e3a5f 0%, #0f2744 100%)', border: '1px solid rgba(99,179,237,0.15)' }}>
              <div className="px-6 py-4 flex items-center justify-between shrink-0"
                style={{ borderBottom: '1px solid rgba(99,179,237,0.12)', background: 'rgba(255,255,255,0.04)' }}>
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
                    style={{ background: 'rgba(59,130,246,0.25)', border: '1px solid rgba(59,130,246,0.35)' }}>
                    <BookOpen className="w-4 h-4" style={{ color: '#93c5fd' }} />
                  </div>
                  <div>
                    <h3 className="text-base font-semibold" style={{ color: '#e2e8f0' }}>AI Clinical Guidelines</h3>
                    <p className="text-xs" style={{ color: '#64748b' }}>Evidence-based nursing protocols · RAG-powered</p>
                  </div>
                </div>
                <button
                  onClick={() => setShowGuidelineSearch(false)}
                  title="Close"
                  className="w-8 h-8 rounded-lg flex items-center justify-center transition-colors"
                  style={{ color: '#94a3b8', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.08)' }}
                  onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,0.12)'; (e.currentTarget as HTMLButtonElement).style.color = '#e2e8f0'; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,0.06)'; (e.currentTarget as HTMLButtonElement).style.color = '#94a3b8'; }}
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="p-6 flex-1 overflow-y-auto">
                <GuidelineSearchPanel
                  searchFn={(q) => ehrApi.searchGuidelines(`Nursing protocols, triage guidelines, medication administration, patient safety: ${q}`, localStorage.getItem('ehr_token')!, tenantSlug!)}
                  contextLabel="Nursing"
                  onMinimize={() => setShowGuidelineSearch(false)}
                />
              </div>
            </div>
          </div>
        </ModalPortal>
      )}
      </div>
    </div>
  );
};


export default NurseDashboard;
