import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Calendar, Clock, User, Stethoscope, CheckCircle, AlertCircle, AlertTriangle,
  Play, Pause, Square, FileText, Pill, TestTube, Bell, 
  Search, Filter, RefreshCw, Eye, Edit, Phone, Video,
  Activity, Heart, HeartPulse, Thermometer, Droplets, Weight, Zap, ArrowLeft, XCircle, Settings,
  LogOut, Menu, X, BarChart3, CreditCard, Users, Bell as BellIcon, ChevronDown, ChevronUp,
  Camera, TrendingUp, Baby, FlaskConical, Target, Send, Mail, Shield, Syringe, Route
} from 'lucide-react';
import { useNotification } from '../components/GlobalNotification';
import { ehrApi } from '../services/api';
import { formatDateForAPI, getTodayFormatted } from '../utils/dateUtils';
import DatePicker from '../components/DatePicker';
import AppointmentActions from '../components/AppointmentActions';
import PatientQueue from '../components/PatientQueue';
import DoctorScheduleView from '../components/DoctorScheduleView';
import RealtimeStatusIndicator from '../components/RealtimeStatusIndicator';
import useRealtimeUpdates from '../hooks/useRealtimeUpdates';
import ModalPortal from '../components/ModalPortal';
import AppointmentNotes from '../components/AppointmentNotes';
import ProblemListModal from '../components/ProblemListModal';
import AllergiesModal from '../components/AllergiesModal';
import ChartSidebar from '../components/ChartSidebar';
import ClinicalNotesModal from '../components/ClinicalNotesModal';
import PrescriptionsModal from '../components/PrescriptionsModal';
import LabOrdersModal from '../components/LabOrdersModal';
import LabResultsViewer from '../components/LabResultsViewer';
import { chartApi } from '../services/api';
import ClinicalAlerts from '../components/ClinicalAlerts';
import { checkVitalsAlerts, VitalsData } from '../utils/vitalsAlerts';
// Tier 1 Components
import ConsentLibrary from '../components/ConsentLibrary';
import ImmunizationHistory from '../components/ImmunizationHistory';
import PathwayManagement from '../components/PathwayManagement';
import CriticalResultAlertPanel from '../components/CriticalResultAlertPanel';
import ProAlerts from '../components/ProAlerts';
import PatientProViewer from '../components/PatientProViewer';
import QuestionnaireLibrary from '../components/QuestionnaireLibrary';
import PatientProSchedules from '../components/PatientProSchedules';
import WorkflowList from '../components/WorkflowList';
import CarePlanTemplates from '../components/CarePlanTemplates';
import CarePlanViewer from '../components/CarePlanViewer';
import CarePlanBuilder from '../components/CarePlanBuilder';
import CarePlanList from '../components/CarePlanList';
import ReferralList from '../components/ReferralList';
import ReferralForm from '../components/ReferralForm';
import ReferralTemplates from '../components/ReferralTemplates';
import DocumentList from '../components/DocumentList';
import { Inbox } from '../components/Inbox';
import { MessageComposer } from '../components/MessageComposer';
import EnhancedLabOrderModal from '../components/EnhancedLabOrderModal';
import ImagingOrderModal from '../components/ImagingOrderModal';
import AdvancedResultComparison from '../components/AdvancedResultComparison';
import DoctorImagingResultsPanel from '../components/DoctorImagingResultsPanel';
import ImagingStudyViewerModal from '../components/ImagingStudyViewerModal';
import DoctorAvailabilityManager from '../components/DoctorAvailabilityManager';

interface Appointment {
  id: string;
  patient: {
    id: string;
    firstName: string;
    lastName: string;
    patientNumber: string;
    dateOfBirth: string;
    phone: string;
    email: string;
  };
  doctor: {
    id: string;
    firstName: string;
    lastName: string;
  };
  appointmentDate: string;
  durationMinutes: number;
  appointmentType: string;
  status: string;
  reason: string;
  notes: string;
  checkInTime?: string;
  actualStartTime?: string;
  actualEndTime?: string;
  paymentStatus?: string;
  financeTransactionId?: string | null;
  feeAmount?: number | null;
}

interface PatientVitals {
  id: string;
  patientId: string;
  bloodPressure: string;
  heartRate: number;
  temperature: number;
  weight: number;
  height: number;
  oxygenSaturation: number;
  respiratoryRate?: number;
  painLevel?: number;
  bloodGlucose?: number;
  recordedAt: string;
  recordedBy: string;
}

interface VitalsAlert {
  type: 'critical' | 'warning' | 'normal' | 'missing';
  message: string;
  icon: React.ReactNode;
  color: string;
}

const DoctorDashboard: React.FC = () => {
  const { tenantSlug } = useParams<{ tenantSlug: string }>();
  const navigate = useNavigate();
  const { showError, showSuccess } = useNotification();
  
  // State
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [selectedDate, setSelectedDate] = useState(getTodayFormatted());
  const [loading, setLoading] = useState(true);
  const [currentAppointment, setCurrentAppointment] = useState<Appointment | null>(null);
  const [patientVitals, setPatientVitals] = useState<PatientVitals | null>(null);
  const [showVitalsModal, setShowVitalsModal] = useState(false);
  const [showComprehensiveNotes, setShowComprehensiveNotes] = useState(false);
  const [showReferralModal, setShowReferralModal] = useState(false);
  const [referralReason, setReferralReason] = useState('');
  const [referralInstructions, setReferralInstructions] = useState('');
  const [currentReferralAppointment, setCurrentReferralAppointment] = useState<Appointment | null>(null);
  const [vitalsForm, setVitalsForm] = useState({
    bloodPressure: '',
    heartRate: '',
    temperature: '',
    weight: '',
    height: '',
    oxygenSaturation: ''
  });
  const [vitalsAlerts, setVitalsAlerts] = useState<VitalsAlert[]>([]);
  const [showVitalsAlert, setShowVitalsAlert] = useState(false);
  const [vitalsData, setVitalsData] = useState<Record<string, PatientVitals[]>>({});
  const [authorizedOrders, setAuthorizedOrders] = useState<any[]>([]);
  const [problems, setProblems] = useState<any[]>([]);
  const [allergies, setAllergies] = useState<any[]>([]);
  const [showSoapModal, setShowSoapModal] = useState(false);
  const [soapData, setSoapData] = useState({ subjective: '', objective: '', assessment: '', plan: '' });
  const [showRxTemplateModal, setShowRxTemplateModal] = useState(false);
  const [rxData, setRxData] = useState({ medication: '', dosage: '', frequency: '', duration: '' });
  const [showCarePlanModal, setShowCarePlanModal] = useState(false);
  const [carePlan, setCarePlan] = useState({ goals: '', tasks: '', dueDate: '' });
  const [showReferralListModal, setShowReferralListModal] = useState(false);
  const [showReferralFormModal, setShowReferralFormModal] = useState(false);
  const [showReferralTemplatesModal, setShowReferralTemplatesModal] = useState(false);
  const [showDocumentListModal, setShowDocumentListModal] = useState(false);
  const [showInboxModal, setShowInboxModal] = useState(false);
  const [showMessageComposerModal, setShowMessageComposerModal] = useState(false);
  const [unreadMessageCount, setUnreadMessageCount] = useState(0);
  const [patientRiskAssessment, setPatientRiskAssessment] = useState<any>(null);
  const [loadingRiskAssessment, setLoadingRiskAssessment] = useState(false);
  const [clinicalGuidelines, setClinicalGuidelines] = useState<any>(null);
  const [showGuidelinesModal, setShowGuidelinesModal] = useState(false);
  const [showProblemsModal, setShowProblemsModal] = useState(false);
  const [showAllergiesModal, setShowAllergiesModal] = useState(false);
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    riskDetails: false,
    trends: false,
    patterns: false,
    recommendations: false
  });
  const [showClinicalNotesModal, setShowClinicalNotesModal] = useState(false);
  const [showPrescriptionsModal, setShowPrescriptionsModal] = useState(false);
  const [showLabOrdersModal, setShowLabOrdersModal] = useState(false);
  const [showLabResultsModal, setShowLabResultsModal] = useState(false);
  const [showAllOrders, setShowAllOrders] = useState(false);
  const [showAllMedications, setShowAllMedications] = useState(false);
  const [showEnhancedLabOrderModal, setShowEnhancedLabOrderModal] = useState(false);
  const [showImagingOrderModal, setShowImagingOrderModal] = useState(false);
  const [showResultComparisonModal, setShowResultComparisonModal] = useState(false);
  const [showAvailabilityManager, setShowAvailabilityManager] = useState(false);
  const [showProViewerModal, setShowProViewerModal] = useState(false);
  const [showQuestionnaireLibrary, setShowQuestionnaireLibrary] = useState(false);
  const [showWorkflowList, setShowWorkflowList] = useState(false);
  const [showCarePlanList, setShowCarePlanList] = useState(false);
  const [showCarePlanTemplates, setShowCarePlanTemplates] = useState(false);
  const [showCarePlanViewer, setShowCarePlanViewer] = useState(false);
  const [showCarePlanBuilder, setShowCarePlanBuilder] = useState(false);
  const [selectedCarePlanId, setSelectedCarePlanId] = useState<string | null>(null);
  const [carePlanPatientId, setCarePlanPatientId] = useState<string | null>(null);
  const [currentUser, setCurrentUser] = useState<any>(null);
  // Tier 1 Feature States
  const [showConsentLibraryModal, setShowConsentLibraryModal] = useState(false);
  const [showImmunizationsModal, setShowImmunizationsModal] = useState(false);
  const [showPathwaysModal, setShowPathwaysModal] = useState(false);
  // Questionnaires States
  const [showProScheduleModal, setShowProScheduleModal] = useState(false);
  const [selectedPatientIdForPro, setSelectedPatientIdForPro] = useState<string | null>(null);
  const appointmentAwaitingPayment = currentAppointment?.paymentStatus === 'awaiting_payment';
  const appointmentFinanceReference = currentAppointment?.financeTransactionId || null;
  const appointmentFee =
    currentAppointment?.feeAmount !== undefined && currentAppointment?.feeAmount !== null
      ? Number(currentAppointment.feeAmount)
      : null;

  const notifyAppointmentPaymentBlocked = (context: string) => {
    if (!currentAppointment) return;
    const financeDetails = [
      appointmentFinanceReference ? `Finance reference: ${appointmentFinanceReference}` : null,
      appointmentFee && !Number.isNaN(appointmentFee) ? `Fee amount: $${appointmentFee.toFixed(2)}` : null,
    ]
      .filter(Boolean)
      .join(' • ');
    showError(
      'Awaiting payment',
      `${context}. Accounts must clear payment before continuing.${
        financeDetails ? ` ${financeDetails}` : ''
      }`,
    );
  };

  const openClinicalNotesModal = () => {
    if (!currentAppointment) return;
    if (appointmentAwaitingPayment) {
      notifyAppointmentPaymentBlocked('Clinical notes are locked until payment clears');
      return;
    }
    setShowClinicalNotesModal(true);
  };

  const openPrescriptionsModal = () => {
    if (!currentAppointment) return;
    if (appointmentAwaitingPayment) {
      notifyAppointmentPaymentBlocked('Prescriptions are locked until payment clears');
      return;
    }
    setShowPrescriptionsModal(true);
  };

  const openCarePlansModal = () => {
    if (!currentAppointment?.patient?.id) return;
    if (appointmentAwaitingPayment) {
      notifyAppointmentPaymentBlocked('Care plans are locked until payment clears');
      return;
    }
    setCarePlanPatientId(currentAppointment.patient.id);
    setShowCarePlanList(true);
  };

  const openEnhancedLabOrderModal = () => {
    if (!currentAppointment) return;
    if (appointmentAwaitingPayment) {
      notifyAppointmentPaymentBlocked('Lab orders are locked until payment clears');
      return;
    }
    setShowEnhancedLabOrderModal(true);
  };

  const openImagingOrderModal = () => {
    if (!currentAppointment) return;
    if (appointmentAwaitingPayment) {
      notifyAppointmentPaymentBlocked('Imaging orders are locked until payment clears');
      return;
    }
    setShowImagingOrderModal(true);
  };

  const openResultComparisonModal = () => {
    if (!currentAppointment) return;
    if (appointmentAwaitingPayment) {
      notifyAppointmentPaymentBlocked('Result trends are locked until payment clears');
      return;
    }
    setShowResultComparisonModal(true);
  };

  const openVitalsModal = () => {
    if (!currentAppointment) return;
    if (appointmentAwaitingPayment) {
      notifyAppointmentPaymentBlocked('Vital capture is locked until payment clears');
      return;
    }
    setShowVitalsModal(true);
  };

  const openProblemsModal = () => {
    if (!currentAppointment) return;
    if (appointmentAwaitingPayment) {
      notifyAppointmentPaymentBlocked('Problem list edits are locked until payment clears');
      return;
    }
    setShowProblemsModal(true);
  };

  const openAllergiesModal = () => {
    if (!currentAppointment) return;
    if (appointmentAwaitingPayment) {
      notifyAppointmentPaymentBlocked('Allergy updates are locked until payment clears');
      return;
    }
    setShowAllergiesModal(true);
  };

  const openReferralModal = () => {
    if (!currentAppointment) return;
    if (appointmentAwaitingPayment) {
      notifyAppointmentPaymentBlocked('Return to nurse is locked until payment clears');
      return;
    }
    setCurrentReferralAppointment(currentAppointment);
    setShowReferralModal(true);
  };

  const specialistModules = useMemo(() => {
    const tenantPath = (path: string) => (tenantSlug ? `/ehr/${tenantSlug}${path}` : '#');
    return [
      {
        title: 'Emergency Department',
        description: 'Real-time ED tracking board, ESI triage levels, wait times, and critical patient monitoring.',
        gradient: 'from-red-600 via-orange-600 to-red-700',
        border: 'border-red-500',
        icon: AlertCircle,
        chips: ['ED Tracking Board', 'ESI Triage', 'Wait Times', 'Metrics Dashboard'],
        buttonLabel: 'Open ED Dashboard',
        buttonTextColor: 'text-red-700',
        buttonHover: 'hover:bg-red-50',
        route: tenantPath('/emergency'),
        requiresPaymentClearance: false,
        paymentLockedMessage: '',
      },
      {
        title: 'Bed Management & ADT',
        description: 'Hospital-wide bed status, real-time occupancy, patient admissions, discharges, and transfers.',
        gradient: 'from-blue-600 via-cyan-600 to-blue-700',
        border: 'border-blue-500',
        icon: Activity,
        chips: ['46 Beds', '5 Wards', 'Real-time Status', 'ADT Workflow'],
        buttonLabel: 'Open Bed Management',
        buttonTextColor: 'text-blue-700',
        buttonHover: 'hover:bg-blue-50',
        route: tenantPath('/bed-management'),
        requiresPaymentClearance: false,
        paymentLockedMessage: '',
      },
      {
        title: 'HIV/AIDS Patient Management',
        description: 'Comprehensive HIV care oversight, ARV regimen management, and treatment failure alerts.',
        gradient: 'from-red-500 via-orange-500 to-red-600',
        border: 'border-red-400',
        icon: Activity,
        chips: ['ARV Regimen Changes', 'EAC Monitoring', 'Treatment Alerts', 'Viral Load Trends'],
        buttonLabel: 'Open HIV Dashboard',
        buttonTextColor: 'text-red-600',
        buttonHover: 'hover:bg-red-50',
        route: tenantPath('/doctor/hiv'),
        requiresPaymentClearance: true,
        paymentLockedMessage: 'HIV specialist workflows are locked until payment clears.',
      },
      {
        title: 'Maternity & Obstetrics',
        description: 'High-risk pregnancy management, delivery oversight, maternal complications, and referral cases.',
        gradient: 'from-pink-500 via-rose-500 to-pink-600',
        border: 'border-pink-400',
        icon: Baby,
        chips: ['High-Risk Cases', 'Upcoming Deliveries', 'Complication Watch', 'Referral Review'],
        buttonLabel: 'Open Maternity Center',
        buttonTextColor: 'text-pink-600',
        buttonHover: 'hover:bg-pink-50',
        route: tenantPath('/doctor/maternity'),
        requiresPaymentClearance: true,
        paymentLockedMessage: 'Maternity workflows are locked until payment clears.',
      },
      {
        title: 'Oncology Care Navigator',
        description: 'Coordinate tumor board plans, therapy regimens, infusion sessions, and toxicity tracking.',
        gradient: 'from-purple-600 via-fuchsia-600 to-rose-600',
        border: 'border-fuchsia-400',
        icon: FlaskConical,
        chips: ['Tumor Board Workflow', 'Regimen Tracking', 'Infusion Sessions', 'Adverse Events'],
        buttonLabel: 'Open Oncology Hub',
        buttonTextColor: 'text-fuchsia-600',
        buttonHover: 'hover:bg-fuchsia-50',
        route: tenantPath('/doctor/oncology'),
        requiresPaymentClearance: true,
        paymentLockedMessage: 'Oncology workflows are locked until payment clears.',
      },
      {
        title: 'Cardiology Command Center',
        description: 'Risk stratification, diagnostic orchestration, and payment-gated cath lab workflows.',
        gradient: 'from-red-600 via-rose-600 to-amber-500',
        border: 'border-rose-500',
        icon: HeartPulse,
        chips: ['Risk Scores', 'Diagnostic Workups', 'Finance Locks', 'Follow-Up Planning'],
        buttonLabel: 'Open Cardiology Hub',
        buttonTextColor: 'text-rose-600',
        buttonHover: 'hover:bg-rose-50',
        route: tenantPath('/doctor/cardiology'),
        requiresPaymentClearance: true,
        paymentLockedMessage: 'Cardiology workflows are locked until payment clears.',
      },
      {
        title: 'Ophthalmology Clinic',
        description: 'Manage eye encounters, visual acuity, refraction, OCT imaging, and follow-up cadences.',
        gradient: 'from-sky-500 via-indigo-500 to-blue-600',
        border: 'border-sky-400',
        icon: Eye,
        chips: ['Visual Acuity Logs', 'Refraction Records', 'OCT Imaging', 'Follow-Up Scheduling'],
        buttonLabel: 'Open Ophthalmology Suite',
        buttonTextColor: 'text-sky-600',
        buttonHover: 'hover:bg-sky-50',
        route: tenantPath('/doctor/ophthalmology'),
        requiresPaymentClearance: true,
        paymentLockedMessage: 'Ophthalmology workflows are locked until payment clears.',
      },
    ];
  }, [tenantSlug]);
  
  // Real-time updates
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());
  const [isUpdating, setIsUpdating] = useState(false);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'dashboard' | 'queue' | 'schedule' | 'current-appointment' | 'critical-alerts'>('dashboard');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [criticalAlertCount, setCriticalAlertCount] = useState(0);
  const [criticalImagingCount, setCriticalImagingCount] = useState(0);
  const [imagingViewerOpen, setImagingViewerOpen] = useState(false);
  const [selectedImagingStudyId, setSelectedImagingStudyId] = useState<string | null>(null);
  const [imagingStudyDetails, setImagingStudyDetails] = useState<any | null>(null);
  const [loadingImagingStudy, setLoadingImagingStudy] = useState(false);
  const [imagingStudyLoadError, setImagingStudyLoadError] = useState(false);

  useEffect(() => {
    const userData = localStorage.getItem('ehr_user');
    if (userData) {
      setCurrentUser(JSON.parse(userData));
    }
  }, []);

  // Load critical alert count on mount and refresh every 2 minutes
  useEffect(() => {
    const loadAlertCount = async () => {
      try {
        const token = localStorage.getItem('ehr_token');
        if (token && tenantSlug) {
          const [labResponse, imagingResponse] = await Promise.all([
            ehrApi.getCriticalAlertStats(tenantSlug, token),
            ehrApi.getDoctorImagingResults(tenantSlug, token, { status: 'critical' }),
          ]);

          const labPending = labResponse.data?.pending_count || 0;
          const imagingCritical =
            imagingResponse.data?.counts?.critical ??
            (Array.isArray(imagingResponse.data?.results)
              ? imagingResponse.data.results.length
              : 0);

          setCriticalImagingCount(imagingCritical);
          setCriticalAlertCount(labPending + imagingCritical);
        }
      } catch (error) {
        console.error('Failed to load alert count:', error);
      }
    };

    loadAlertCount();
    const interval = setInterval(loadAlertCount, 120000); // Every 2 minutes
    return () => clearInterval(interval);
  }, [tenantSlug]);

  useEffect(() => {
    if (currentUser) {
      fetchTodayAppointments();
      fetchAuthorizedOrders();
    }
  }, [selectedDate, currentUser]);

  // Load unread message count
  useEffect(() => {
    const loadUnreadCount = async () => {
      try {
        const token = localStorage.getItem('ehr_token') || '';
        if (token && tenantSlug) {
          const response = await ehrApi.getUnreadCount(token, tenantSlug);
          setUnreadMessageCount(response.data.count || 0);
        }
      } catch (error) {
        console.error('Failed to load unread count:', error);
      }
    };

    loadUnreadCount();
    // Refresh every 30 seconds
    const interval = setInterval(loadUnreadCount, 30000);
    return () => clearInterval(interval);
  }, [tenantSlug]);

  useEffect(() => {
    const loadChartData = async () => {
      try {
        const token = localStorage.getItem('ehr_token') || '';
        if (currentAppointment && token) {
          const pid = currentAppointment.patient.id;
          const [p, a] = await Promise.all([
            chartApi.getProblems(pid, token, tenantSlug!),
            chartApi.getAllergies(pid, token, tenantSlug!)
          ]);
          setProblems(p.data || []);
          setAllergies(a.data || []);
        } else {
          setProblems([]); setAllergies([]);
          setPatientRiskAssessment(null);
        }
      } catch {
        setProblems([]); setAllergies([]);
      }
    };
    loadChartData();
  }, [currentAppointment, tenantSlug]);

  const openImagingStudy = async (studyId: string) => {
    if (!tenantSlug) return;
    const token = localStorage.getItem('ehr_token') || '';
    try {
      setSelectedImagingStudyId(studyId);
      setImagingViewerOpen(true);
      setLoadingImagingStudy(true);
      setImagingStudyLoadError(false);
      const { data } = await ehrApi.getImagingStudy(tenantSlug, token, studyId);
      setImagingStudyDetails(data);
    } catch (error) {
      console.error('Failed to load imaging study', error);
      showError('Failed to load imaging study', 'Unable to load imaging study.');
      setImagingStudyLoadError(true);
    } finally {
      setLoadingImagingStudy(false);
    }
  };

  const refreshImagingStudy = async () => {
    if (!selectedImagingStudyId || !tenantSlug) return;
    const token = localStorage.getItem('ehr_token') || '';
    try {
      setLoadingImagingStudy(true);
      setImagingStudyLoadError(false);
      const { data } = await ehrApi.getImagingStudy(tenantSlug, token, selectedImagingStudyId);
      setImagingStudyDetails(data);
    } catch (error) {
      console.error('Failed to refresh imaging study', error);
      showError('Failed to refresh imaging study', 'Unable to refresh imaging study.');
      setImagingStudyLoadError(true);
    } finally {
      setLoadingImagingStudy(false);
    }
  };

  const closeImagingViewer = () => {
    setImagingViewerOpen(false);
    setSelectedImagingStudyId(null);
    setImagingStudyDetails(null);
    setImagingStudyLoadError(false);
  };

  // Auto-calculate risk assessment when patient and data are ready
  useEffect(() => {
    if (currentAppointment && Object.keys(vitalsData).length > 0 && authorizedOrders.length >= 0) {
      calculatePatientRisk();
    }
  }, [currentAppointment, vitalsData, authorizedOrders, problems]);

  // Calculate patient risk assessment
  const calculatePatientRisk = async () => {
    if (!currentAppointment) return;
    
    try {
      setLoadingRiskAssessment(true);
      const token = localStorage.getItem('ehr_token');
      if (!token) return;

      const latestVitals = vitalsData[currentAppointment.patient.id]?.[0];
      const patientAge = currentAppointment.patient.dateOfBirth 
        ? Math.floor((new Date().getTime() - new Date(currentAppointment.patient.dateOfBirth).getTime()) / (1000 * 60 * 60 * 24 * 365.25))
        : undefined;

      const patientMedications = authorizedOrders
        .filter((o: any) => o.patientId === currentAppointment.patient.id && o.orderType === 'medication')
        .map((o: any) => o.orderName);

      const patientData = {
        patientId: currentAppointment.patient.id,
        age: patientAge,
        vitals: latestVitals ? {
          bloodPressure: latestVitals.bloodPressure,
          heartRate: latestVitals.heartRate,
          temperature: latestVitals.temperature,
          oxygenSaturation: latestVitals.oxygenSaturation,
          weight: latestVitals.weight,
        } : {},
        medications: patientMedications,
        diagnoses: problems.map((p: any) => p.problemName || p.name || '').filter(Boolean),
      };

      const riskResult = await ehrApi.getRiskAssessment(patientData, token, tenantSlug!);
      setPatientRiskAssessment(riskResult.data);
    } catch (error) {
      console.error('Failed to calculate risk assessment:', error);
      setPatientRiskAssessment(null);
    } finally {
      setLoadingRiskAssessment(false);
    }
  };

  // Real-time updates
  const handleRealtimeUpdate = async () => {
    try {
      setIsUpdating(true);
      setConnectionError(null);
      await fetchTodayAppointments();
      setLastUpdate(new Date());
    } catch (error) {
      console.error('Real-time update failed:', error);
      setConnectionError('Update failed');
    } finally {
      setIsUpdating(false);
    }
  };

  useRealtimeUpdates({
    onUpdate: handleRealtimeUpdate,
    interval: 60000, // 60 seconds - reduced frequency
    enabled: false // Disabled to prevent modal closing
  });

  const fetchVitalsForAppointments = async (appointments: Appointment[]) => {
    try {
      const token = localStorage.getItem('ehr_token');
      if (!token) return;

      const vitalsPromises = appointments.map(async (appointment) => {
        try {
          const vitals = await ehrApi.getVitals(appointment.patient.id, token, tenantSlug!);
          return { patientId: appointment.patient.id, vitals: vitals.data.vitals || [] };
        } catch (error) {
          console.log(`No vitals found for patient ${appointment.patient.id}:`, error);
          return { patientId: appointment.patient.id, vitals: [] };
        }
      });

      const vitalsResults = await Promise.all(vitalsPromises);
      const vitalsMap: Record<string, PatientVitals[]> = {};
      
      vitalsResults.forEach(({ patientId, vitals }) => {
        vitalsMap[patientId] = vitals.sort((a: PatientVitals, b: PatientVitals) => 
          new Date(b.recordedAt).getTime() - new Date(a.recordedAt).getTime()
        );
      });

      setVitalsData(vitalsMap);
      console.log('🔍 DoctorDashboard - Fetched vitals data:', vitalsMap);
    } catch (error) {
      console.error('Error fetching vitals data:', error);
    }
  };

  const fetchTodayAppointments = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('ehr_token');
      if (!token || !currentUser) {
        console.log('🔍 DoctorDashboard - Missing token or currentUser:', { token: !!token, currentUser });
        return;
      }

      console.log('🔍 DoctorDashboard - Fetching appointments for date:', selectedDate);
      console.log('🔍 DoctorDashboard - Current user:', currentUser);
      console.log('🔍 DoctorDashboard - Tenant slug:', tenantSlug);
      console.log('🔍 DoctorDashboard - Formatted date for API:', formatDateForAPI(selectedDate));

      const response = await ehrApi.getAppointments(token, tenantSlug!, {
        date: formatDateForAPI(selectedDate)
      });
      
      console.log('🔍 DoctorDashboard - API response:', response.data);
      console.log('🔍 DoctorDashboard - All appointments:', response.data.appointments);
      
      // Filter appointments for current doctor
      const doctorAppointments = response.data.appointments.filter(
        (apt: Appointment) => {
          console.log('🔍 DoctorDashboard - Checking appointment:', {
            appointmentId: apt.id,
            patientName: `${apt.patient.firstName} ${apt.patient.lastName}`,
            appointmentDate: apt.appointmentDate,
            doctorId: apt.doctor.id,
            currentUserId: currentUser?.id,
            matches: apt.doctor.id === currentUser?.id
          });
          return apt.doctor.id === currentUser?.id;
        }
      );
      
      console.log('🔍 DoctorDashboard - Filtered doctor appointments:', doctorAppointments);
      setAppointments(doctorAppointments);
      // Select current in-progress appointment for this doctor
      const inProgress = doctorAppointments.filter((a: any) => {
        const s = (a.status || '').replace('_','-');
        return s === 'in-progress';
      });
      if (inProgress.length > 0) {
        // pick the one with latest actualStartTime or nearest appointmentDate
        const picked = [...inProgress].sort((a: any, b: any) => {
          const atA = new Date(a.actualStartTime || a.appointmentDate).getTime();
          const atB = new Date(b.actualStartTime || b.appointmentDate).getTime();
          return atB - atA;
        })[0];
        setCurrentAppointment(picked);
      } else {
        setCurrentAppointment(null);
      }
      
      // Fetch vitals data for all patients with appointments today
      await fetchVitalsForAppointments(doctorAppointments);
      
      // Check for critical vitals after fetching appointments
    } catch (error) {
      console.error('Error fetching appointments:', error);
      showError('Error', 'Failed to fetch appointments');
    } finally {
      setLoading(false);
    }
  };

  const fetchAuthorizedOrders = async () => {
    try {
      const token = localStorage.getItem('ehr_token');
      if (!token) return;
      const response = await ehrApi.getAuthorizedOrders(token, tenantSlug!);
      setAuthorizedOrders(response.data.orders || []);
    } catch (error) {
      console.error('Error fetching authorized orders:', error);
      setAuthorizedOrders([]);
    }
  };

  const getAppointmentStatusColor = (status: string) => {
    switch (status) {
      case 'scheduled': return 'bg-blue-100 text-blue-800';
      case 'confirmed': return 'bg-green-100 text-green-800';
      case 'in-progress': return 'bg-yellow-100 text-yellow-800';
      case 'completed': return 'bg-gray-100 text-gray-800';
      case 'cancelled': return 'bg-red-100 text-red-800';
      case 'no-show': return 'bg-orange-100 text-orange-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const normalizeStatus = (status: string) => {
    if (!status) return '';
    const s = status.toLowerCase().replace('_', '-');
    if (s === 'in-progress' || s === 'inprogress') return 'in-progress';
    return s;
  };

  const getAppointmentStatusIcon = (status: string) => {
    switch (status) {
      case 'scheduled': return <Clock className="w-4 h-4" />;
      case 'confirmed': return <CheckCircle className="w-4 h-4" />;
      case 'in-progress': return <Play className="w-4 h-4" />;
      case 'completed': return <Square className="w-4 h-4" />;
      case 'cancelled': return <XCircle className="w-4 h-4" />;
      case 'no-show': return <AlertCircle className="w-4 h-4" />;
      default: return <Clock className="w-4 h-4" />;
    }
  };

  const handleAppointmentAction = async (appointmentId: string, action: string) => {
    if (appointmentAwaitingPayment && currentAppointment?.id === appointmentId && action !== 'cancel') {
      notifyAppointmentPaymentBlocked('Appointment workflow actions are locked until payment clears');
      return;
    }
    try {
      const token = localStorage.getItem('ehr_token');
      if (!token) return;

      switch (action) {
        case 'check-in':
          await ehrApi.updateAppointmentStatus(appointmentId, 'confirmed', token, tenantSlug!);
          showSuccess('Success', 'Patient checked in successfully');
          break;
        case 'start':
          await ehrApi.startAppointment(appointmentId, token, tenantSlug!);
          setCurrentAppointment(appointments.find(apt => apt.id === appointmentId) || null);
          showSuccess('Success', 'Appointment started');
          break;
        case 'complete':
          await ehrApi.completeAppointment(appointmentId, token, tenantSlug!);
          setCurrentAppointment(null);
          showSuccess('Success', 'Appointment completed');
          break;
        case 'cancel':
          await ehrApi.updateAppointmentStatus(appointmentId, 'cancelled', token, tenantSlug!);
          showSuccess('Success', 'Appointment cancelled');
          break;
      }
      
      fetchTodayAppointments();
    } catch (error) {
      console.error(`Error ${action} appointment:`, error);
      showError('Error', `Failed to ${action} appointment`);
    }
  };

  const handleVitalsSubmit = async () => {
    try {
      const token = localStorage.getItem('ehr_token');
      if (!token || !currentAppointment) return;

      // Here you would typically save vitals to the database
      // For now, we'll just show success
      showSuccess('Success', 'Patient vitals recorded');
      setShowVitalsModal(false);
      setVitalsForm({
        bloodPressure: '',
        heartRate: '',
        temperature: '',
        weight: '',
        height: '',
        oxygenSaturation: ''
      });
    } catch (error) {
      console.error('Error saving vitals:', error);
      showError('Error', 'Failed to save vitals');
    }
  };

  // Vitals validation functions
  const validateVitals = (vitals: PatientVitals): VitalsAlert[] => {
    const alerts: VitalsAlert[] = [];
    
    // Blood Pressure validation
    if (vitals.bloodPressure) {
      const [systolic, diastolic] = vitals.bloodPressure.split('/').map(Number);
      if (systolic > 180 || diastolic > 110) {
        alerts.push({
          type: 'critical',
          message: `Critical Blood Pressure: ${vitals.bloodPressure} mmHg`,
          icon: <AlertCircle className="w-4 h-4" />,
          color: 'text-red-600'
        });
      } else if (systolic > 160 || diastolic > 100) {
        alerts.push({
          type: 'warning',
          message: `Elevated Blood Pressure: ${vitals.bloodPressure} mmHg`,
          icon: <AlertCircle className="w-4 h-4" />,
          color: 'text-orange-600'
        });
      }
    }

    // Heart Rate validation
    if (vitals.heartRate > 0) {
      if (vitals.heartRate > 120 || vitals.heartRate < 50) {
        alerts.push({
          type: 'critical',
          message: `Abnormal Heart Rate: ${vitals.heartRate} bpm`,
          icon: <Heart className="w-4 h-4" />,
          color: 'text-red-600'
        });
      } else if (vitals.heartRate > 110 || vitals.heartRate < 55) {
        alerts.push({
          type: 'warning',
          message: `Elevated Heart Rate: ${vitals.heartRate} bpm`,
          icon: <Heart className="w-4 h-4" />,
          color: 'text-orange-600'
        });
      }
    }

    // Temperature validation
    if (vitals.temperature > 0) {
      if (vitals.temperature > 39.5 || vitals.temperature < 35.0) {
        alerts.push({
          type: 'critical',
          message: `Critical Temperature: ${vitals.temperature}°C`,
          icon: <Thermometer className="w-4 h-4" />,
          color: 'text-red-600'
        });
      } else if (vitals.temperature > 38.5 || vitals.temperature < 35.5) {
        alerts.push({
          type: 'warning',
          message: `Elevated Temperature: ${vitals.temperature}°C`,
          icon: <Thermometer className="w-4 h-4" />,
          color: 'text-orange-600'
        });
      }
    }

    // Oxygen Saturation validation
    if (vitals.oxygenSaturation > 0) {
      if (vitals.oxygenSaturation < 90) {
        alerts.push({
          type: 'critical',
          message: `Low Oxygen Saturation: ${vitals.oxygenSaturation}%`,
          icon: <Droplets className="w-4 h-4" />,
          color: 'text-red-600'
        });
      } else if (vitals.oxygenSaturation < 95) {
        alerts.push({
          type: 'warning',
          message: `Reduced Oxygen Saturation: ${vitals.oxygenSaturation}%`,
          icon: <Droplets className="w-4 h-4" />,
          color: 'text-orange-600'
        });
      }
    }

    // Respiratory Rate validation
    if (vitals.respiratoryRate && vitals.respiratoryRate > 0) {
      if (vitals.respiratoryRate > 25 || vitals.respiratoryRate < 8) {
        alerts.push({
          type: 'critical',
          message: `Abnormal Respiratory Rate: ${vitals.respiratoryRate} breaths/min`,
          icon: <Activity className="w-4 h-4" />,
          color: 'text-red-600'
        });
      }
    }

    // Pain Level validation
    if (vitals.painLevel && vitals.painLevel > 0) {
      if (vitals.painLevel >= 8) {
        alerts.push({
          type: 'critical',
          message: `Severe Pain Level: ${vitals.painLevel}/10`,
          icon: <AlertCircle className="w-4 h-4" />,
          color: 'text-red-600'
        });
      } else if (vitals.painLevel >= 6) {
        alerts.push({
          type: 'warning',
          message: `Moderate Pain Level: ${vitals.painLevel}/10`,
          icon: <AlertCircle className="w-4 h-4" />,
          color: 'text-orange-600'
        });
      }
    }

    // Blood Glucose validation
    if (vitals.bloodGlucose && vitals.bloodGlucose > 0) {
      if (vitals.bloodGlucose > 300 || vitals.bloodGlucose < 70) {
        alerts.push({
          type: 'critical',
          message: `Critical Blood Glucose: ${vitals.bloodGlucose} mg/dL`,
          icon: <TestTube className="w-4 h-4" />,
          color: 'text-red-600'
        });
      } else if (vitals.bloodGlucose > 200 || vitals.bloodGlucose < 100) {
        alerts.push({
          type: 'warning',
          message: `Elevated Blood Glucose: ${vitals.bloodGlucose} mg/dL`,
          icon: <TestTube className="w-4 h-4" />,
          color: 'text-orange-600'
        });
      }
    }

    return alerts;
  };

  const checkVitalsStatus = (appointment: Appointment) => {
    // Check if we have vitals data for this patient
    const patientVitals = vitalsData[appointment.patient.id];
    
    if (!patientVitals || patientVitals.length === 0) {
      return {
        hasVitals: false,
        isRecent: false,
        alerts: [] as VitalsAlert[]
      };
    }

    // Get the most recent vitals
    const latestVitals = patientVitals[0];
    const vitalsAge = Date.now() - new Date(latestVitals.recordedAt).getTime();
    const isRecent = vitalsAge < 4 * 60 * 60 * 1000; // 4 hours

    // Validate vitals and generate alerts
    const alerts = validateVitals(latestVitals);

    return {
      hasVitals: true,
      isRecent,
      alerts
    };
  };


  const getVitalsStatusBadge = (appointment: Appointment) => {
    const vitalsStatus = checkVitalsStatus(appointment);
    
    if (!vitalsStatus.hasVitals) {
      return {
        text: 'No Vitals',
        color: 'bg-red-100 text-red-800 border-red-200',
        icon: <AlertCircle className="w-3 h-3" />
      };
    } else if (vitalsStatus.alerts.some(alert => alert.type === 'critical')) {
      return {
        text: 'Critical Vitals',
        color: 'bg-red-100 text-red-800 border-red-200',
        icon: <AlertCircle className="w-3 h-3" />
      };
    } else if (vitalsStatus.alerts.some(alert => alert.type === 'warning')) {
      return {
        text: 'Vitals Warning',
        color: 'bg-orange-100 text-orange-800 border-orange-200',
        icon: <AlertTriangle className="w-3 h-3" />
      };
    } else if (!vitalsStatus.isRecent) {
      return {
        text: 'Vitals History',
        color: 'bg-yellow-100 text-yellow-800 border-yellow-200',
        icon: <Clock className="w-3 h-3" />
      };
    } else {
      return {
        text: 'Vitals OK',
        color: 'bg-green-100 text-green-800 border-green-200',
        icon: <CheckCircle className="w-3 h-3" />
      };
    }
  };

  const handleNotesSubmit = async () => {
    try {
      const token = localStorage.getItem('ehr_token');
      if (!token || !currentAppointment) return;

      // Update appointment notes
      await ehrApi.updateAppointment(currentAppointment.id, {
        notes: currentAppointment.notes || ''
      }, token, tenantSlug!);
      
      showSuccess('Success', 'Appointment notes saved');
      fetchTodayAppointments();
      fetchTodayAppointments();
    } catch (error) {
      console.error('Error saving notes:', error);
      showError('Error', 'Failed to save notes');
    }
  };

  const handleReferralSubmit = async () => {
    try {
      const token = localStorage.getItem('ehr_token');
      if (!token || !currentReferralAppointment) return;

      // Add referral notes
      await ehrApi.updateAppointment(currentReferralAppointment.id, {
        notes: `REFERRED TO NURSE\nReason: ${referralReason}\nInstructions: ${referralInstructions}`
      }, token, tenantSlug!);

      // Create specific order based on referral reason
      const orderData = {
        patientId: currentReferralAppointment.patient.id,
        appointmentId: currentReferralAppointment.id,
        doctorId: currentUser?.id,
        orderType: getOrderTypeFromReason(referralReason),
        orderName: getOrderNameFromReason(referralReason),
        description: `Doctor referral: ${referralReason}`,
        instructions: referralInstructions || `Please perform ${referralReason.toLowerCase()} as requested by doctor`,
        priority: 'normal'
      };

      const created = await ehrApi.createOrder(orderData, token, tenantSlug!);
      const orderId = created?.data?.order?.id;
      if (orderId) {
        await ehrApi.authorizeOrder(orderId, token, tenantSlug!);
      }
      
      showSuccess('Success', 'Referral created and orders sent to nurse');
      setShowReferralModal(false);
      setReferralReason('');
      setReferralInstructions('');
      fetchTodayAppointments();
    } catch (error) {
      console.error('Error referring patient:', error);
      const anyErr: any = error as any;
      const msg = anyErr?.response?.data?.message || anyErr?.response?.data || 'Failed to refer patient to nurse';
      showError('Error', Array.isArray(msg) ? msg.join(', ') : msg);
    }
  };

  const getOrderTypeFromReason = (reason: string): string => {
    switch (reason) {
      case 'Injection': return 'procedure';
      case 'IV Drip': return 'procedure';
      case 'Wound Dressing': return 'procedure';
      case 'Vital Signs': return 'procedure';
      case 'Medication Administration': return 'medication';
      case 'Blood Draw': return 'lab_test';
      default: return 'procedure';
    }
  };

  const getOrderNameFromReason = (reason: string): string => {
    switch (reason) {
      case 'Injection': return 'Administer Injection';
      case 'IV Drip': return 'Set up IV Drip';
      case 'Wound Dressing': return 'Apply Wound Dressing';
      case 'Vital Signs': return 'Monitor Vital Signs';
      case 'Medication Administration': return 'Administer Medication';
      case 'Blood Draw': return 'Collect Blood Sample';
      default: return reason;
    }
  };

  const formatTime = (dateString: string) => {
    return new Date(dateString).toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    });
  };

  const getUpcomingAppointments = () => {
    const now = new Date();
    return appointments.filter(apt => {
      const aptTime = new Date(apt.appointmentDate);
      return aptTime > now && apt.status !== 'completed' && apt.status !== 'cancelled';
    }).slice(0, 3);
  };

  const getCurrentAppointments = () => {
    return appointments.filter(apt => normalizeStatus(apt.status) === 'in-progress');
  };

  const getCompletedToday = () => {
    return appointments.filter(apt => normalizeStatus(apt.status) === 'completed');
  };

  const getDoctorActions = () => {
    return [
      { icon: Users, label: 'Patients', desc: 'Patient management', color: 'from-emerald-500 to-teal-500', route: 'doctor/patients' },
      { icon: Activity, label: 'Workflows', desc: 'Automate care processes', color: 'from-violet-500 to-purple-500', action: 'workflows' },
      { icon: Mail, label: 'Messages', desc: 'Provider messaging & inbox', color: 'from-indigo-500 to-purple-500', action: 'messages' },
      { icon: Calendar, label: 'Appointments', desc: 'Schedule & manage', color: 'from-purple-500 to-indigo-500', route: 'doctor/appointments' },
      { icon: FileText, label: 'Treatment History', desc: 'Past treatments by you', color: 'from-blue-500 to-cyan-500', route: 'doctor/treatments' },
      { icon: AlertCircle, label: 'Emergency Dept', desc: 'ED tracking board & triage', color: 'from-red-500 to-orange-600', route: 'emergency' },
      { icon: Activity, label: 'Bed Management', desc: 'Hospital-wide bed status & ADT', color: 'from-blue-600 to-cyan-600', route: 'bed-management' },
      { icon: Activity, label: 'HIV/AIDS Care', desc: 'HIV patient management & ARV', color: 'from-red-500 to-orange-500', route: 'doctor/hiv' },
      { icon: Baby, label: 'Maternity & Obstetrics', desc: 'High-risk pregnancies & deliveries', color: 'from-pink-500 to-rose-500', route: 'doctor/maternity' },
      { icon: Heart, label: 'Oncology', desc: 'Cancer care & treatment', color: 'from-violet-500 to-purple-500', route: 'doctor/oncology' },
      { icon: Heart, label: 'Cardiology', desc: 'Heart & cardiovascular care', color: 'from-red-500 to-pink-500', route: 'doctor/cardiology' },
      { icon: Eye, label: 'Ophthalmology', desc: 'Eye care & vision', color: 'from-blue-500 to-cyan-500', route: 'doctor/ophthalmology' },
      { icon: BarChart3, label: 'Analytics', desc: 'Patient insights', color: 'from-green-500 to-emerald-500' },
    ];
  };

  const inProgressCount = getCurrentAppointments().length;
  const waitingCount = appointments.filter(a => normalizeStatus(a.status) === 'confirmed').length;
  const authorizedCount = authorizedOrders.length;

  const quickStats = [
    { label: 'Today\'s Appointments', value: appointments.length.toString(), icon: Calendar, color: 'text-blue-600' },
    { label: 'In Progress', value: inProgressCount.toString(), icon: Play, color: 'text-yellow-600' },
    { label: 'Completed', value: getCompletedToday().length.toString(), icon: CheckCircle, color: 'text-green-600' },
    { label: 'Waiting', value: waitingCount.toString(), icon: Clock, color: 'text-purple-600' },
  ];

  if (!currentUser) return null;

  const modalOpen = showVitalsModal || showComprehensiveNotes || showReferralModal || showSoapModal || showRxTemplateModal || showCarePlanModal;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50">
      {/* Mobile Sidebar Overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 bg-black/50 z-40 lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      {/* Sidebar */}
      <div className={`fixed left-0 top-0 h-full w-64 bg-gradient-to-b from-slate-800 via-slate-900 to-gray-900 border-r border-slate-700/50 z-50 transform transition-transform lg:translate-x-0 ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'} flex flex-col`}>
        <div className="p-6 flex-1 overflow-y-auto">
          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-gradient-to-r from-blue-500 to-indigo-600 rounded-xl">
                <Stethoscope className="w-6 h-6 text-white" />
              </div>
              <div>
                <h2 className="font-bold text-white">MediCore</h2>
                <p className="text-xs text-slate-300">Doctor Portal</p>
              </div>
            </div>
            <button onClick={() => setSidebarOpen(false)} className="lg:hidden">
              <X className="w-5 h-5 text-slate-400" />
            </button>
          </div>

          {/* User Info */}
          <div className="mb-8 p-4 bg-slate-800/50 rounded-xl border border-slate-700/50">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-r from-blue-500 to-indigo-600 rounded-full flex items-center justify-center">
                <User className="w-5 h-5 text-white" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-semibold text-white truncate">Dr. {currentUser?.lastName}</p>
                <p className="text-xs text-slate-400 truncate">{currentUser?.email}</p>
              </div>
            </div>
          </div>

          {/* Navigation */}
          <nav className="space-y-2">
            {getDoctorActions().map((action, index) => {
              const Icon = action.icon;
              const isActive = action.route === 'doctor' || (action.route && window.location.pathname.includes(action.route));
              
              return (
                <button
                  key={index}
                  onClick={() => {
                    if (action.route === 'doctor') {
                      setActiveTab('dashboard');
                    } else if (action.action === 'questionnaires') {
                      // Open questionnaire library - if no patient selected, show error
                      if (!currentAppointment?.patient?.id) {
                        showError('No Patient Selected', 'Please select a patient from your appointments first, then open the questionnaire library.');
                        setSidebarOpen(false);
                        return;
                      }
                      setShowQuestionnaireLibrary(true);
                      setSidebarOpen(false);
                    } else if (action.action === 'workflows') {
                      setShowWorkflowList(true);
                      setSidebarOpen(false);
                    } else if (action.action === 'care-plans') {
                      // Open care plan list - auto-select first patient if none selected
                      let patientId = currentAppointment?.patient?.id;
                      
                      if (!patientId && appointments.length > 0) {
                        // Auto-select first appointment's patient
                        patientId = appointments[0].patient?.id;
                        if (patientId) {
                          setCurrentAppointment(appointments[0]);
                          showSuccess('Patient Selected', `Showing care plans for ${appointments[0].patient.firstName} ${appointments[0].patient.lastName}`);
                        }
                      }
                      
                      if (!patientId) {
                        showError('No Patients Available', 'You have no appointments today. Care plans require a patient context.');
                      } else {
                        setCarePlanPatientId(patientId);
                        setShowCarePlanList(true);
                        setSidebarOpen(false);
                      }
                    } else if (action.action === 'referrals') {
                      // Open referral list - auto-select first patient if none selected
                      let patientId = currentAppointment?.patient?.id;
                      
                      if (!patientId && appointments.length > 0) {
                        // Auto-select first appointment's patient
                        patientId = appointments[0].patient?.id;
                        if (patientId) {
                          setCurrentAppointment(appointments[0]);
                          showSuccess('Patient Selected', `Showing referrals for ${appointments[0].patient.firstName} ${appointments[0].patient.lastName}`);
                        }
                      }
                      
                      if (!patientId) {
                        showError('No Patients Available', 'You have no appointments today. Referrals require a patient context.');
                      } else {
                        setShowReferralListModal(true);
                        setSidebarOpen(false);
                      }
                    } else if (action.action === 'documents') {
                      // Open document list - auto-select first patient if none selected
                      let patientId = currentAppointment?.patient?.id;
                      
                      if (!patientId && appointments.length > 0) {
                        // Auto-select first appointment's patient
                        patientId = appointments[0].patient?.id;
                        if (patientId) {
                          setCurrentAppointment(appointments[0]);
                          showSuccess('Patient Selected', `Showing documents for ${appointments[0].patient.firstName} ${appointments[0].patient.lastName}`);
                        }
                      }
                      
                      if (!patientId) {
                        showError('No Patients Available', 'You have no appointments today. Documents require a patient context.');
                      } else {
                        setShowDocumentListModal(true);
                        setSidebarOpen(false);
                      }
                    } else if (action.action === 'messages') {
                      // Open inbox
                      setShowInboxModal(true);
                      setSidebarOpen(false);
                    } else if (action.route) {
                      navigate(`/ehr/${tenantSlug}/${action.route}`);
                    }
                    setSidebarOpen(false);
                  }}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 ${
                    isActive
                      ? 'bg-gradient-to-r from-blue-500/20 to-indigo-500/20 border border-blue-500/30 text-white'
                      : 'text-slate-300 hover:bg-slate-800/50 hover:text-white'
                  }`}
                >
                  <Icon className="w-5 h-5 flex-shrink-0" />
                  <div className="text-left min-w-0 flex-1">
                    <p className="font-medium truncate">{action.label}</p>
                    <p className="text-xs text-slate-400 truncate">{action.desc}</p>
                  </div>
                  {action.action === 'messages' && unreadMessageCount > 0 && (
                    <span className="px-2 py-1 bg-blue-600 text-white text-xs font-semibold rounded-full">
                      {unreadMessageCount}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>
        </div>

        {/* Logout Button - Fixed at bottom */}
        <div className="p-6 border-t border-slate-700/50">
          <button
            onClick={() => {
              localStorage.removeItem('ehr_token');
              localStorage.removeItem('ehr_user');
              localStorage.removeItem('ehr_tenant');
              navigate(`/ehr/${tenantSlug}`);
            }}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-slate-300 hover:bg-red-500/20 hover:text-red-400 transition-all duration-200"
          >
            <LogOut className="w-5 h-5 flex-shrink-0" />
            <span className="font-medium">Logout</span>
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="lg:pl-64">

        {/* Top Header */}
        <div className="bg-white/80 backdrop-blur-sm border-b border-slate-200/50 sticky top-0 z-30">
          <div className="px-4 sm:px-6 lg:px-8">
            <div className="flex items-center justify-between h-16">
              <div className="flex items-center gap-4">
                <button
                  onClick={() => setSidebarOpen(true)}
                  className="lg:hidden p-2 rounded-lg hover:bg-slate-100 transition-colors"
                >
                  <Menu className="w-5 h-5 text-slate-600" />
                </button>
                <div>
                  <h1 className="text-xl font-bold text-slate-900">Doctor Dashboard</h1>
                  <p className="text-sm text-slate-600">Welcome back, Dr. {currentUser?.lastName}</p>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <button
                  onClick={() => setShowAvailabilityManager(true)}
                  className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
                  title="Manage Availability"
                >
                  <Calendar className="h-4 w-4" />
                  Availability
                </button>
                <RealtimeStatusIndicator
                  isConnected={!connectionError}
                  lastUpdate={lastUpdate}
                  isUpdating={isUpdating}
                  error={connectionError}
                />
                <DatePicker
                  value={selectedDate}
                  onChange={setSelectedDate}
                />
                <button
                  onClick={fetchTodayAppointments}
                  className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
                >
                  <RefreshCw className="w-5 h-5 text-slate-600" />
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Main Content Area */}
        <div className={`p-6 ${modalOpen ? 'pointer-events-none' : ''}`} aria-hidden={modalOpen}
        >
          {/* Quick Stats */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            {quickStats.map((stat, index) => {
              const Icon = stat.icon;
              return (
                <div key={index} className="bg-white/70 backdrop-blur-sm rounded-2xl border border-slate-200/50 p-6 hover:shadow-lg transition-all duration-300">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-slate-600">{stat.label}</p>
                      <p className="text-3xl font-bold text-slate-900">{stat.value}</p>
                    </div>
                    <div className={`p-3 rounded-xl bg-gradient-to-r ${stat.color.includes('blue') ? 'from-blue-500 to-cyan-500' : stat.color.includes('yellow') ? 'from-yellow-500 to-orange-500' : stat.color.includes('green') ? 'from-green-500 to-emerald-500' : 'from-purple-500 to-indigo-500'}`}>
                      <Icon className="w-6 h-6 text-white" />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Specialist Modules */}
          <div className="mb-10">
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
              {specialistModules.map((module) => {
                const Icon = module.icon;
                return (
                  <div
                    key={module.title}
                    className={`group relative overflow-hidden rounded-2xl border-4 ${module.border} bg-gradient-to-r ${module.gradient} shadow-lg transition-all duration-300 hover:shadow-2xl`}
                  >
                    <div className="absolute inset-0 opacity-0 group-hover:opacity-10 bg-white transition-opacity duration-300" />
                    <div className="relative flex h-full flex-col gap-4 p-5 text-white">
                      <div className="flex items-start gap-3">
                        <div className="p-3 bg-white/15 rounded-xl backdrop-blur-sm">
                          <Icon className="w-8 h-8 text-white" />
                        </div>
                        <div className="flex-1">
                          <h3 className="text-lg font-semibold leading-tight">{module.title}</h3>
                          <p className="text-sm text-white/80 mt-2">{module.description}</p>
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {module.chips.map((chip) => (
                          <span
                            key={chip}
                            className="px-2.5 py-1 bg-white/20 rounded-full text-xs font-medium tracking-wide backdrop-blur-sm"
                          >
                            {chip}
                          </span>
                        ))}
                      </div>
                      <div className="mt-auto">
                        <button
                          onClick={() => {
                            if (module.requiresPaymentClearance && appointmentAwaitingPayment) {
                              notifyAppointmentPaymentBlocked(
                                module.paymentLockedMessage || 'This specialist workflow is locked until payment clears.',
                              );
                              return;
                            }
                            if (module.route !== '#') {
                              navigate(module.route);
                            }
                          }}
                          className={`w-full inline-flex items-center justify-center gap-2 px-4 py-2 bg-white rounded-xl font-semibold shadow hover:shadow-lg transition ${module.buttonTextColor} ${module.buttonHover}`}
                        >
                          <Icon className={`w-4 h-4 ${module.buttonTextColor}`} />
                          <span>{module.buttonLabel}</span>
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Tab Navigation */}
          <div className="mb-8">
            <div className="bg-gradient-to-r from-slate-50 via-indigo-50 to-purple-50 rounded-2xl border-2 border-indigo-200 p-3 shadow-lg sticky top-16 z-20">
              <nav className="flex items-center justify-between gap-2 overflow-x-auto">
                <button
                  onClick={() => setActiveTab('dashboard')}
                  className={`group flex items-center justify-center gap-2 px-5 py-3.5 rounded-xl text-sm font-bold transition-all whitespace-nowrap shadow-md hover:shadow-lg ${
                    activeTab === 'dashboard'
                      ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-blue-200 scale-105'
                      : 'bg-white text-slate-700 border-2 border-blue-200 hover:border-blue-400 hover:text-blue-700 hover:scale-105'
                  }`}
                >
                  <BarChart3 className={`w-5 h-5 ${activeTab === 'dashboard' ? 'text-white' : 'text-blue-500 group-hover:text-blue-700'}`} />
                  <span>Dashboard</span>
                </button>
                <button
                  onClick={() => setActiveTab('queue')}
                  className={`group flex items-center justify-center gap-2 px-5 py-3.5 rounded-xl text-sm font-bold transition-all whitespace-nowrap shadow-md hover:shadow-lg ${
                    activeTab === 'queue'
                      ? 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-emerald-200 scale-105'
                      : 'bg-white text-slate-700 border-2 border-emerald-200 hover:border-emerald-400 hover:text-emerald-700 hover:scale-105'
                  }`}
                >
                  <Users className={`w-5 h-5 ${activeTab === 'queue' ? 'text-white' : 'text-emerald-500 group-hover:text-emerald-700'}`} />
                  <span>Queue</span>
                </button>
                <button
                  onClick={() => setActiveTab('schedule')}
                  className={`group flex items-center justify-center gap-2 px-5 py-3.5 rounded-xl text-sm font-bold transition-all whitespace-nowrap shadow-md hover:shadow-lg ${
                    activeTab === 'schedule'
                      ? 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-purple-200 scale-105'
                      : 'bg-white text-slate-700 border-2 border-purple-200 hover:border-purple-400 hover:text-purple-700 hover:scale-105'
                  }`}
                >
                  <Calendar className={`w-5 h-5 ${activeTab === 'schedule' ? 'text-white' : 'text-purple-500 group-hover:text-purple-700'}`} />
                  <span>Schedule</span>
                </button>
                <button
                  onClick={() => setActiveTab('current-appointment')}
                  className={`group flex items-center justify-center gap-2 px-5 py-3.5 rounded-xl text-sm font-bold transition-all whitespace-nowrap shadow-md hover:shadow-lg ${
                    activeTab === 'current-appointment'
                      ? 'bg-gradient-to-r from-sky-600 to-cyan-600 text-white shadow-sky-200 scale-105'
                      : 'bg-white text-slate-700 border-2 border-sky-200 hover:border-sky-400 hover:text-sky-700 hover:scale-105'
                  }`}
              >
                <FileText className={`w-5 h-5 ${activeTab === 'current-appointment' ? 'text-white' : 'text-sky-500 group-hover:text-sky-700'}`} />
                <span>Appointment</span>
              </button>
              <button
                  onClick={() => setActiveTab('critical-alerts')}
                  className={`group relative flex items-center justify-center gap-2 px-5 py-3.5 rounded-xl text-sm font-bold transition-all whitespace-nowrap shadow-md hover:shadow-lg ${
                    activeTab === 'critical-alerts'
                      ? 'bg-gradient-to-r from-red-600 to-rose-600 text-white shadow-red-200 scale-105'
                      : 'bg-white text-slate-700 border-2 border-red-200 hover:border-red-400 hover:text-red-700 hover:scale-105'
                  }`}
                >
                  <AlertTriangle className={`w-5 h-5 ${activeTab === 'critical-alerts' ? 'text-white' : 'text-red-500 group-hover:text-red-700'}`} />
                  <span>Alerts</span>
                  {criticalAlertCount > 0 && (
                    <span className="absolute -top-1 -right-1 bg-red-600 text-white text-xs font-bold rounded-full w-6 h-6 flex items-center justify-center animate-pulse shadow-lg">
                      {criticalAlertCount}
                    </span>
                  )}
                </button>
                <button
                  onClick={() => setActiveTab('imaging')}
                  className={`group flex items-center justify-center gap-2 px-5 py-3.5 rounded-xl text-sm font-bold transition-all whitespace-nowrap shadow-md hover:shadow-lg ${
                    activeTab === 'imaging'
                      ? 'bg-gradient-to-r from-violet-600 to-purple-600 text-white shadow-violet-200 scale-105'
                      : 'bg-white text-slate-700 border-2 border-violet-200 hover:border-violet-400 hover:text-violet-700 hover:scale-105'
                  }`}
                >
                  <Activity className={`w-5 h-5 ${activeTab === 'imaging' ? 'text-white' : 'text-violet-500 group-hover:text-violet-700'}`} />
                  <span>Imaging</span>
                </button>
              </nav>
            </div>
          </div>

          {/* Tab Content */}
          {activeTab === 'dashboard' && (
            <div className="space-y-6">
              {/* Critical Alert Banner */}
              {criticalAlertCount > 0 && (
                <div 
                  onClick={() => setActiveTab('critical-alerts')}
                  className="p-4 border-2 border-red-500 bg-red-50 rounded-xl flex items-center justify-between cursor-pointer hover:bg-red-100 transition-colors animate-pulse shadow-lg"
                >
                  <div className="flex items-center gap-3">
                    <AlertTriangle className="w-6 h-6 text-red-600" />
                    <div>
                      <div className="text-base font-bold text-red-900">🚨 CRITICAL LAB RESULTS PENDING</div>
                      <div className="text-sm text-red-700">Immediate attention required</div>
                    </div>
                  </div>
                  <span className="text-lg px-4 py-2 rounded-full bg-red-600 text-white font-bold">{criticalAlertCount}</span>
                </div>
              )}

              {/* Key Metrics Cards */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* Today's Appointments */}
                <div className="bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl p-6 text-white shadow-lg hover:shadow-xl transition-shadow">
                  <div className="flex items-center justify-between mb-4">
                    <Calendar className="w-8 h-8 opacity-80" />
                    <span className="text-4xl font-bold">{appointments.length}</span>
                  </div>
                  <div className="text-sm opacity-90">Today's Appointments</div>
                  <div className="mt-2 flex items-center gap-4 text-xs">
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {getCurrentAppointments().length} in progress
                    </span>
                    <span className="flex items-center gap-1">
                      <CheckCircle className="w-3 h-3" />
                      {appointments.filter(a => a.status === 'completed').length} completed
                    </span>
                  </div>
                </div>

                {/* Messages */}
                <div 
                  onClick={() => setShowInboxModal(true)}
                  className="bg-gradient-to-br from-purple-500 to-pink-600 rounded-xl p-6 text-white shadow-lg hover:shadow-xl transition-all cursor-pointer hover:scale-105"
                >
                  <div className="flex items-center justify-between mb-4">
                    <Mail className="w-8 h-8 opacity-80" />
                    <span className="text-4xl font-bold">{unreadMessageCount}</span>
                  </div>
                  <div className="text-sm opacity-90">Unread Messages</div>
                  <div className="mt-2 text-xs opacity-80">Click to open inbox</div>
                </div>

                {/* Pending Actions */}
                <div className="bg-gradient-to-br from-emerald-500 to-teal-600 rounded-xl p-6 text-white shadow-lg hover:shadow-xl transition-shadow">
                  <div className="flex items-center justify-between mb-4">
                    <FileText className="w-8 h-8 opacity-80" />
                    <span className="text-4xl font-bold">{authorizedOrders.length}</span>
                  </div>
                  <div className="text-sm opacity-90">Pending Orders</div>
                  <div className="mt-2 text-xs opacity-80">Awaiting nursing execution</div>
                </div>
              </div>

              {/* Quick Actions */}
              <div className="bg-white/70 backdrop-blur-sm rounded-2xl border border-slate-200/50 p-6">
                <h3 className="text-lg font-bold text-slate-900 mb-4">Quick Actions</h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <button
                    onClick={() => setActiveTab('current-appointment')}
                    className="p-4 bg-gradient-to-br from-sky-50 to-blue-50 border border-sky-200 rounded-xl hover:shadow-md transition-all group"
                  >
                    <FileText className="w-6 h-6 text-sky-600 mb-2 mx-auto group-hover:scale-110 transition-transform" />
                    <div className="text-sm font-semibold text-slate-900">Current Patient</div>
                  </button>
                  <button
                    onClick={() => setActiveTab('queue')}
                    className="p-4 bg-gradient-to-br from-emerald-50 to-teal-50 border border-emerald-200 rounded-xl hover:shadow-md transition-all group"
                  >
                    <Users className="w-6 h-6 text-emerald-600 mb-2 mx-auto group-hover:scale-110 transition-transform" />
                    <div className="text-sm font-semibold text-slate-900">Patient Queue</div>
                  </button>
                  <button
                    onClick={() => setActiveTab('schedule')}
                    className="p-4 bg-gradient-to-br from-purple-50 to-indigo-50 border border-purple-200 rounded-xl hover:shadow-md transition-all group"
                  >
                    <Calendar className="w-6 h-6 text-purple-600 mb-2 mx-auto group-hover:scale-110 transition-transform" />
                    <div className="text-sm font-semibold text-slate-900">Schedule</div>
                  </button>
                  <button
                    onClick={() => setShowInboxModal(true)}
                    className="p-4 bg-gradient-to-br from-pink-50 to-purple-50 border border-pink-200 rounded-xl hover:shadow-md transition-all group relative"
                  >
                    <Mail className="w-6 h-6 text-pink-600 mb-2 mx-auto group-hover:scale-110 transition-transform" />
                    <div className="text-sm font-semibold text-slate-900">Messages</div>
                    {unreadMessageCount > 0 && (
                      <span className="absolute -top-2 -right-2 bg-red-600 text-white text-xs font-bold rounded-full w-6 h-6 flex items-center justify-center">
                        {unreadMessageCount}
                      </span>
                    )}
                  </button>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'queue' && (
            <PatientQueue
              tenantSlug={tenantSlug!}
              token={localStorage.getItem('ehr_token') || ''}
              onAppointmentUpdate={fetchTodayAppointments}
              appointments={appointments}
              onAppointmentSelect={(appointment) => {
                setCurrentAppointment(appointment);
                // Switch to the main view tab to show appointment details
                setActiveTab('main');
              }}
            />
          )}

          {activeTab === 'schedule' && (
            <DoctorScheduleView
              tenantSlug={tenantSlug!}
              token={localStorage.getItem('ehr_token') || ''}
              onAppointmentUpdate={fetchTodayAppointments}
              appointments={appointments}
            />
          )}

          {activeTab === 'critical-alerts' && (
            <div className="space-y-6">
              <div className="bg-white rounded-2xl shadow-lg p-6">
                <h2 className="text-2xl font-bold text-gray-900 mb-6 flex items-center">
                  <AlertTriangle className="w-6 h-6 text-red-600 mr-2" />
                  Critical Lab Results & Alerts
                </h2>
                <CriticalResultAlertPanel
                  tenantSlug={tenantSlug!}
                  token={localStorage.getItem('ehr_token') || ''}
                  showAllAlerts={false}
                />
              </div>

              <DoctorImagingResultsPanel
                tenantSlug={tenantSlug!}
                token={localStorage.getItem('ehr_token') || ''}
                statusFilter="critical"
                hideTabs
                compact
                title={`Critical Imaging Findings (${criticalImagingCount})`}
                onOpenStudy={openImagingStudy}
              />
            </div>
          )}

          {activeTab === 'current-appointment' && (
            <div className="space-y-4 max-h-[calc(100vh-200px)] overflow-y-auto">
              {currentAppointment ? (
                <>
                  {/* Compact Header with Quick Actions */}
                  <div className="bg-gradient-to-r from-indigo-600 to-purple-600 rounded-2xl p-5 text-white shadow-lg">
                    <div className="flex items-center justify-between flex-wrap gap-4">
                      <div className="flex-1 min-w-[200px]">
                        <h2 className="text-2xl font-bold mb-1">{currentAppointment.patient.firstName} {currentAppointment.patient.lastName}</h2>
                        <div className="flex items-center gap-4 text-sm opacity-90">
                          <span>ID: {currentAppointment.patient.patientNumber}</span>
                          <span>•</span>
                          <span>{formatTime(currentAppointment.appointmentDate)}</span>
                          <span>•</span>
                          <span className="capitalize">{currentAppointment.appointmentType}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <button
                          onClick={openClinicalNotesModal}
                          disabled={appointmentAwaitingPayment}
                          className="px-3 py-2 bg-white/20 hover:bg-white/30 disabled:hover:bg-white/20 disabled:opacity-60 disabled:cursor-not-allowed rounded-lg transition-colors flex items-center gap-2 text-sm backdrop-blur-sm"
                        >
                          <FileText className="w-4 h-4" />
                          Notes
                        </button>
                        <button
                          onClick={openPrescriptionsModal}
                          disabled={appointmentAwaitingPayment}
                          className="px-3 py-2 bg-white/20 hover:bg-white/30 disabled:hover:bg-white/20 disabled:opacity-60 disabled:cursor-not-allowed rounded-lg transition-colors flex items-center gap-2 text-sm backdrop-blur-sm"
                        >
                          <Pill className="w-4 h-4" />
                          Rx
                        </button>
                        <button
                          onClick={openEnhancedLabOrderModal}
                          disabled={appointmentAwaitingPayment}
                          className="px-3 py-2 bg-gradient-to-r from-blue-500 to-indigo-500 hover:from-blue-600 hover:to-indigo-600 disabled:opacity-60 disabled:hover:from-blue-500 disabled:hover:to-indigo-500 disabled:cursor-not-allowed rounded-lg transition-colors flex items-center gap-2 text-sm text-white shadow-md"
                        >
                          <TestTube className="w-4 h-4" />
                          Order Labs
                        </button>
                        <button
                          onClick={openImagingOrderModal}
                          disabled={appointmentAwaitingPayment}
                          className="px-3 py-2 bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 disabled:opacity-60 disabled:hover:from-purple-500 disabled:hover:to-pink-500 disabled:cursor-not-allowed rounded-lg transition-colors flex items-center gap-2 text-sm text-white shadow-md"
                        >
                          <Camera className="w-4 h-4" />
                          🆕 Order Imaging
                        </button>
                        <button
                          onClick={openCarePlansModal}
                          disabled={appointmentAwaitingPayment}
                          className="px-3 py-2 bg-gradient-to-r from-teal-500 to-cyan-500 hover:from-teal-600 hover:to-cyan-600 disabled:opacity-60 disabled:hover:from-teal-500 disabled:hover:to-cyan-500 disabled:cursor-not-allowed rounded-lg transition-colors flex items-center gap-2 text-sm text-white shadow-md"
                        >
                          <Target className="w-4 h-4" />
                          Care Plans
                        </button>
                        <button
                          onClick={() => setShowReferralListModal(true)}
                          disabled={appointmentAwaitingPayment}
                          className="px-3 py-2 bg-gradient-to-r from-blue-500 to-indigo-500 hover:from-blue-600 hover:to-indigo-600 disabled:opacity-60 disabled:hover:from-blue-500 disabled:hover:to-indigo-500 disabled:cursor-not-allowed rounded-lg transition-colors flex items-center gap-2 text-sm text-white shadow-md"
                        >
                          <Send className="w-4 h-4" />
                          Referrals
                        </button>
                        <button
                          onClick={() => setShowDocumentListModal(true)}
                          disabled={appointmentAwaitingPayment}
                          className="px-3 py-2 bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 disabled:opacity-60 disabled:hover:from-purple-500 disabled:hover:to-pink-500 disabled:cursor-not-allowed rounded-lg transition-colors flex items-center gap-2 text-sm text-white shadow-md"
                        >
                          <FileText className="w-4 h-4" />
                          Documents
                        </button>
                        <button
                          onClick={() => {
                            if (currentAppointment?.patient?.id) {
                              setSelectedPatientIdForPro(currentAppointment.patient.id);
                              setShowProScheduleModal(true);
                            }
                          }}
                          disabled={appointmentAwaitingPayment}
                          className="px-3 py-2 bg-gradient-to-r from-indigo-500 to-purple-500 hover:from-indigo-600 hover:to-purple-600 disabled:opacity-60 disabled:hover:from-indigo-500 disabled:hover:to-purple-500 disabled:cursor-not-allowed rounded-lg transition-colors flex items-center gap-2 text-sm text-white shadow-md"
                        >
                          <FileText className="w-4 h-4" />
                          Questionnaires
                        </button>
                        {/* Tier 1 Feature Buttons */}
                        <button
                          onClick={() => setShowConsentLibraryModal(true)}
                          disabled={appointmentAwaitingPayment}
                          className="px-3 py-2 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 disabled:opacity-60 disabled:cursor-not-allowed rounded-lg transition-colors flex items-center gap-2 text-sm text-white shadow-md"
                          title="Manage patient consents"
                        >
                          <Shield className="w-4 h-4" />
                          Consents
                        </button>
                        <button
                          onClick={() => setShowImmunizationsModal(true)}
                          disabled={appointmentAwaitingPayment}
                          className="px-3 py-2 bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 disabled:opacity-60 disabled:cursor-not-allowed rounded-lg transition-colors flex items-center gap-2 text-sm text-white shadow-md"
                          title="View immunization history"
                        >
                          <Syringe className="w-4 h-4" />
                          Immunizations
                        </button>
                        <button
                          onClick={() => setShowPathwaysModal(true)}
                          disabled={appointmentAwaitingPayment}
                          className="px-3 py-2 bg-gradient-to-r from-violet-500 to-purple-500 hover:from-violet-600 hover:to-purple-600 disabled:opacity-60 disabled:cursor-not-allowed rounded-lg transition-colors flex items-center gap-2 text-sm text-white shadow-md"
                          title="Manage clinical pathways"
                        >
                          <Route className="w-4 h-4" />
                          Pathways
                        </button>
                        <button onClick={() => setShowLabResultsModal(true)} className="px-3 py-2 bg-white/20 hover:bg-white/30 rounded-lg transition-colors flex items-center gap-2 text-sm backdrop-blur-sm">
                          <TestTube className="w-4 h-4" />
                          Lab Results
                        </button>
                        <button
                          onClick={openResultComparisonModal}
                          disabled={appointmentAwaitingPayment}
                          className="px-3 py-2 bg-gradient-to-r from-teal-500 to-cyan-500 hover:from-teal-600 hover:to-cyan-600 disabled:opacity-60 disabled:hover:from-teal-500 disabled:hover:to-cyan-500 disabled:cursor-not-allowed rounded-lg transition-colors flex items-center gap-2 text-sm text-white shadow-md"
                        >
                          <TrendingUp className="w-4 h-4" />
                          🆕 Result Trends
                        </button>
                        <button
                          onClick={openVitalsModal}
                          disabled={appointmentAwaitingPayment}
                          className="px-3 py-2 bg-white/20 hover:bg-white/30 disabled:hover:bg-white/20 disabled:opacity-60 disabled:cursor-not-allowed rounded-lg transition-colors flex items-center gap-2 text-sm backdrop-blur-sm"
                        >
                          <Activity className="w-4 h-4" />
                          Vitals
                        </button>
                        <button
                          onClick={openProblemsModal}
                          disabled={appointmentAwaitingPayment}
                          className="px-3 py-2 bg-white/20 hover:bg-white/30 disabled:hover:bg-white/20 disabled:opacity-60 disabled:cursor-not-allowed rounded-lg transition-colors flex items-center gap-2 text-sm backdrop-blur-sm"
                        >
                          <Stethoscope className="w-4 h-4" />
                          Problems
                        </button>
                        <button
                          onClick={openAllergiesModal}
                          disabled={appointmentAwaitingPayment}
                          className="px-3 py-2 bg-white/20 hover:bg-white/30 disabled:hover:bg-white/20 disabled:opacity-60 disabled:cursor-not-allowed rounded-lg transition-colors flex items-center gap-2 text-sm backdrop-blur-sm"
                        >
                          <AlertTriangle className="w-4 h-4" />
                          Allergies
                        </button>
                        <button
                          onClick={openReferralModal}
                          disabled={appointmentAwaitingPayment}
                          className="px-3 py-2 bg-white/20 hover:bg-white/30 disabled:hover:bg-white/20 disabled:opacity-60 disabled:cursor-not-allowed rounded-lg transition-colors flex items-center gap-2 text-sm backdrop-blur-sm"
                        >
                          <Stethoscope className="w-4 h-4" />
                          Return to Nurse
                        </button>
                        <button
                          onClick={() => handleAppointmentAction(currentAppointment.id, 'complete')}
                          disabled={appointmentAwaitingPayment}
                          className="px-4 py-2 bg-green-500 hover:bg-green-600 disabled:opacity-60 disabled:hover:bg-green-500 disabled:cursor-not-allowed rounded-lg transition-colors flex items-center gap-2 text-sm font-medium"
                        >
                          <CheckCircle className="w-4 h-4" />
                          Complete
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Compact Grid Layout - 3 Columns */}
                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                    {/* Risk Assessment Panel - Compact with Collapsible Sections */}
                    {patientRiskAssessment ? (
                      <div className="bg-gradient-to-br from-orange-50 to-amber-50 rounded-2xl border border-orange-200/50 p-5">
                        <div className="flex items-center justify-between mb-4">
                          <div className="flex items-center gap-2">
                            <div className="p-1.5 bg-gradient-to-r from-orange-500 to-amber-600 rounded-lg">
                              <AlertTriangle className="w-4 h-4 text-white" />
                            </div>
                            <div>
                              <h3 className="text-base font-bold text-slate-900">Risk Assessment</h3>
                            </div>
                          </div>
                          <button
                            onClick={calculatePatientRisk}
                            disabled={loadingRiskAssessment}
                            className="px-2 py-1 bg-white/70 hover:bg-white rounded text-xs font-medium text-orange-700 border border-orange-200 disabled:opacity-50"
                            title="Refresh Risk Assessment"
                          >
                            <RefreshCw className={`w-3 h-3 ${loadingRiskAssessment ? 'animate-spin' : ''}`} />
                          </button>
                        </div>
                        
                        {/* Risk Score - Prominent Display */}
                        <div className="bg-white/90 rounded-xl p-4 border-2 border-orange-300/50 mb-3">
                          <p className="text-xs text-slate-600 mb-1">Overall Risk Score</p>
                          {(() => {
                            // Calculate actual risk score from factors if overall_score is 0
                            const riskFactors = patientRiskAssessment.factors || [];
                            const calculatedScore = riskFactors.length > 0 
                              ? riskFactors.reduce((sum: number, f: any) => sum + (f.score || 0), 0) / riskFactors.length
                              : patientRiskAssessment.overall_score;
                            const displayScore = calculatedScore > 0 ? calculatedScore : (riskFactors.length > 0 ? 5 : 0);
                            
                            return (
                              <>
                                <div className="flex items-baseline gap-2">
                                  <p className={`text-3xl font-bold ${
                                    patientRiskAssessment.risk_level === 'critical' ? 'text-red-600' :
                                    patientRiskAssessment.risk_level === 'high' ? 'text-orange-600' :
                                    patientRiskAssessment.risk_level === 'moderate' ? 'text-yellow-600' :
                                    'text-green-600'
                                  }`}>
                                    {displayScore.toFixed(1)}%
                                  </p>
                                </div>
                                <span className={`text-xs px-2 py-1 rounded-full mt-2 inline-block ${
                                  patientRiskAssessment.risk_level === 'critical' ? 'bg-red-100 text-red-700' :
                                  patientRiskAssessment.risk_level === 'high' ? 'bg-orange-100 text-orange-700' :
                                  patientRiskAssessment.risk_level === 'moderate' ? 'bg-yellow-100 text-yellow-700' :
                                  'bg-green-100 text-green-700'
                                }`}>
                                  {patientRiskAssessment.risk_level.toUpperCase()} RISK
                                </span>
                                {riskFactors.length > 0 && (
                                  <div className="mt-2 pt-2 border-t border-orange-200">
                                    <div className="grid grid-cols-2 gap-1 text-xs">
                                      {riskFactors.slice(0, 4).map((factor: any, idx: number) => (
                                        <div key={idx} className="flex items-center justify-between">
                                          <span className="text-slate-600 capitalize">{factor.category || factor.model?.split(' ')[0] || 'Risk'}:</span>
                                          <span className={`font-semibold ${
                                            factor.level === 'high' || factor.level === 'critical' ? 'text-orange-600' :
                                            factor.level === 'moderate' ? 'text-yellow-600' :
                                            'text-green-600'
                                          }`}>
                                            {factor.score?.toFixed(1)}%
                                          </span>
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                )}
                              </>
                            );
                          })()}
                        </div>

                        {/* Collapsible Sections */}
                        <div className="space-y-2">
                          {/* Historical Context - Collapsible */}
                          {patientRiskAssessment.historical_context && (
                            <div className="bg-white/70 rounded-lg border border-orange-200/50 overflow-hidden">
                              <button
                                onClick={() => setExpandedSections({...expandedSections, riskDetails: !expandedSections.riskDetails})}
                                className="w-full flex items-center justify-between p-2 text-xs font-semibold text-slate-700 hover:bg-white/50 transition-colors"
                              >
                                <span>History & Context</span>
                                {expandedSections.riskDetails ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                              </button>
                              {expandedSections.riskDetails && (
                                <div className="p-2 pt-0 border-t border-orange-200/50">
                                  <div className="grid grid-cols-2 gap-1 text-xs">
                                    <div><span className="text-slate-500">Visits:</span> <span className="font-semibold">{patientRiskAssessment.historical_context.total_visits}</span></div>
                                    {patientRiskAssessment.historical_context.days_since_last_visit !== null && (
                                      <div><span className="text-slate-500">Days Since:</span> <span className="font-semibold">{patientRiskAssessment.historical_context.days_since_last_visit}</span></div>
                                    )}
                                    {patientRiskAssessment.historical_context.previous_admissions > 0 && (
                                      <div><span className="text-slate-500">Admissions:</span> <span className="font-semibold">{patientRiskAssessment.historical_context.previous_admissions}</span></div>
                                    )}
                                    {patientRiskAssessment.historical_context.ed_visits > 0 && (
                                      <div><span className="text-slate-500">ED Visits:</span> <span className="font-semibold">{patientRiskAssessment.historical_context.ed_visits}</span></div>
                                    )}
                                  </div>
                                </div>
                              )}
                            </div>
                          )}

                          {/* Vital Trends - Collapsible */}
                          {patientRiskAssessment.trends && patientRiskAssessment.trends.trends && Object.keys(patientRiskAssessment.trends.trends).length > 0 && (
                            <div className="bg-white/70 rounded-lg border border-orange-200/50 overflow-hidden">
                              <button
                                onClick={() => setExpandedSections({...expandedSections, trends: !expandedSections.trends})}
                                className="w-full flex items-center justify-between p-2 text-xs font-semibold text-slate-700 hover:bg-white/50 transition-colors"
                              >
                                <span>Vital Trends</span>
                                {expandedSections.trends ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                              </button>
                              {expandedSections.trends && (
                                <div className="p-2 pt-0 border-t border-orange-200/50 space-y-1">
                                  {Object.entries(patientRiskAssessment.trends.trends).slice(0, 5).map(([key, trend]: [string, any]) => (
                                    <div key={key} className="flex items-center justify-between text-xs">
                                      <span className="text-slate-700 capitalize">{key.replace(/([A-Z])/g, ' $1').trim()}:</span>
                                      <span className={`font-semibold ${
                                        trend.trend === 'worsening' || trend.trend === 'increasing' ? 'text-red-600' :
                                        trend.trend === 'improving' || trend.trend === 'decreasing' ? 'text-green-600' :
                                        'text-yellow-600'
                                      }`}>
                                        {trend.trend}
                                      </span>
                                    </div>
                                  ))}
                                  {patientRiskAssessment.trends.alerts && patientRiskAssessment.trends.alerts.length > 0 && (
                                    <div className="mt-2 pt-2 border-t border-orange-200">
                                      {patientRiskAssessment.trends.alerts.slice(0, 1).map((alert: string, idx: number) => (
                                        <p key={idx} className="text-xs text-red-700 flex items-start gap-1">
                                          <AlertCircle className="w-3 h-3 mt-0.5 flex-shrink-0" />
                                          <span>{alert}</span>
                                        </p>
                                      ))}
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                          )}

                          {/* Visit Patterns - Collapsible */}
                          {patientRiskAssessment.visit_patterns && patientRiskAssessment.visit_patterns.patterns && (
                            <div className="bg-white/70 rounded-lg border border-orange-200/50 overflow-hidden">
                              <button
                                onClick={() => setExpandedSections({...expandedSections, patterns: !expandedSections.patterns})}
                                className="w-full flex items-center justify-between p-2 text-xs font-semibold text-slate-700 hover:bg-white/50 transition-colors"
                              >
                                <span>Visit Patterns</span>
                                {expandedSections.patterns ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                              </button>
                              {expandedSections.patterns && (
                                <div className="p-2 pt-0 border-t border-orange-200/50 text-xs space-y-1">
                                  {patientRiskAssessment.visit_patterns.patterns.visit_frequency && (
                                    <>
                                      <div className="flex justify-between">
                                        <span className="text-slate-600">Frequency:</span>
                                        <span className="font-semibold capitalize">{patientRiskAssessment.visit_patterns.patterns.visit_frequency.frequency_category}</span>
                                      </div>
                                      <div className="flex justify-between">
                                        <span className="text-slate-600">Interval:</span>
                                        <span className="font-semibold">{patientRiskAssessment.visit_patterns.patterns.visit_frequency.average_interval_days} days</span>
                                      </div>
                                    </>
                                  )}
                                  {patientRiskAssessment.visit_patterns.patterns.recurring_diagnoses && patientRiskAssessment.visit_patterns.patterns.recurring_diagnoses.length > 0 && (
                                    <div className="pt-2 border-t border-orange-200">
                                      <p className="text-slate-600 mb-1 font-semibold">Recurring:</p>
                                      {patientRiskAssessment.visit_patterns.patterns.recurring_diagnoses.slice(0, 3).map((diag: any, idx: number) => (
                                        <div key={idx} className="flex justify-between">
                                          <span className="text-slate-700">{diag.diagnosis}</span>
                                          <span className="text-slate-500">({diag.count}x)</span>
                                        </div>
                                      ))}
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                          )}

                          {/* Recommendations - Collapsible */}
                          {patientRiskAssessment.recommendations && patientRiskAssessment.recommendations.length > 0 && (
                            <div className="bg-white/70 rounded-lg border border-orange-200/50 overflow-hidden">
                              <button
                                onClick={() => setExpandedSections({...expandedSections, recommendations: !expandedSections.recommendations})}
                                className="w-full flex items-center justify-between p-2 text-xs font-semibold text-slate-700 hover:bg-white/50 transition-colors"
                              >
                                <span>Recommendations ({patientRiskAssessment.recommendations.length})</span>
                                {expandedSections.recommendations ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                              </button>
                              {expandedSections.recommendations && (
                                <div className="p-2 pt-0 border-t border-orange-200/50">
                                  <ul className="space-y-1 text-xs text-slate-700">
                                    {patientRiskAssessment.recommendations.slice(0, 5).map((rec: string, idx: number) => (
                                      <li key={idx} className="flex items-start gap-2">
                                        <span className="text-orange-600 mt-0.5">•</span>
                                        <span>{rec}</span>
                                      </li>
                                    ))}
                                  </ul>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    ) : (
                      <div className="bg-white/70 backdrop-blur-sm rounded-2xl border border-slate-200/50 p-5 flex items-center justify-center min-h-[150px]">
                        <p className="text-slate-500 text-xs text-center">Click "Refresh" to calculate risk assessment</p>
                      </div>
                    )}

                    {/* Clinical Alerts - Compact */}
                    {(() => {
                      const latestVitals = vitalsData[currentAppointment.patient.id]?.[0];
                      const vitalsForAlert: VitalsData | undefined = latestVitals ? {
                        bloodPressure: latestVitals.bloodPressure || undefined,
                        heartRate: latestVitals.heartRate || undefined,
                        temperature: latestVitals.temperature || undefined,
                        oxygenSaturation: latestVitals.oxygenSaturation || undefined,
                        respiratoryRate: latestVitals.respiratoryRate || undefined,
                        bloodGlucose: latestVitals.bloodGlucose || undefined
                      } : undefined;

                      return (
                        <div className="bg-white/70 backdrop-blur-sm rounded-2xl border border-slate-200/50 p-5">
                          <h3 className="text-base font-bold text-slate-900 mb-3 flex items-center gap-2">
                            <AlertCircle className="w-4 h-4 text-red-600" />
                            Clinical Alerts
                          </h3>
                          <ClinicalAlerts
                            vitals={vitalsForAlert}
                            allergies={allergies}
                          />
                        </div>
                      );
                    })()}

                    {/* PRO Alerts - Patient-Reported Outcomes */}
                    {currentAppointment && (
                      <div className="bg-white/70 backdrop-blur-sm rounded-2xl border border-slate-200/50 p-5">
                        <div className="flex items-center justify-between mb-3">
                          <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                            <FileText className="w-4 h-4 text-purple-600" />
                            Patient-Reported Outcomes
                          </h3>
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => {
                                if (!currentAppointment?.patient?.id) {
                                  showError('No Patient Selected', 'Please select a patient first');
                                  return;
                                }
                                setShowQuestionnaireLibrary(true);
                              }}
                              className="px-3 py-1.5 text-xs font-semibold bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-1"
                              title="Assign Questionnaire"
                            >
                              <FileText className="w-3 h-3" />
                              Assign
                            </button>
                            <button
                              onClick={() => setShowProViewerModal(true)}
                              className="px-3 py-1.5 text-xs font-semibold bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors flex items-center gap-1"
                            >
                              <Eye className="w-3 h-3" />
                              View All
                            </button>
                          </div>
                        </div>
                        <ProAlerts
                          patientId={currentAppointment.patient.id}
                          tenantSlug={tenantSlug!}
                          token={localStorage.getItem('ehr_token') || ''}
                          onAlertClick={() => setShowProViewerModal(true)}
                        />
                      </div>
                    )}

                    {/* Chart Sidebar - Compact */}
                    <div className="lg:col-span-1">
                      <ChartSidebar
                        appointment={{ ...currentAppointment, notes: JSON.stringify({ problems, allergies }) }}
                        vitals={vitalsData[currentAppointment.patient.id] || []}
                        labOrders={authorizedOrders.filter(o => o.patientId === currentAppointment.patient.id)}
                      />
                    </div>
                  </div>

                  {/* Allergies & Orders - Compact Row */}
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    {/* Allergies Section - Compact */}
                    <div className="bg-white/70 backdrop-blur-sm rounded-2xl border border-slate-200/50 p-5">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <AlertTriangle className="w-4 h-4 text-rose-600" />
                          <h3 className="text-base font-bold text-slate-900">Allergies</h3>
                        </div>
                        <button
                          onClick={openAllergiesModal}
                          disabled={appointmentAwaitingPayment}
                          className="text-xs text-rose-600 hover:text-rose-800 disabled:hover:text-rose-600 disabled:opacity-60 disabled:cursor-not-allowed font-medium"
                        >
                          Manage
                        </button>
                      </div>
                      {allergies.length === 0 ? (
                        <p className="text-xs text-slate-500">No known allergies</p>
                      ) : (
                        <div className="space-y-2 max-h-48 overflow-y-auto">
                          {allergies.slice(0, 5).map((a: any) => (
                            <div key={a.id} className="p-2 border border-slate-200 rounded-lg text-xs">
                              <div className="flex items-center justify-between">
                                <div className="font-semibold text-slate-900">{a.allergen}</div>
                                {a.severity && (
                                  <span className={`px-2 py-0.5 rounded-full border text-xs ${
                                    a.severity === 'severe' ? 'bg-red-50 text-red-700 border-red-200' : 
                                    a.severity === 'moderate' ? 'bg-orange-50 text-orange-700 border-orange-200' : 
                                    'bg-yellow-50 text-yellow-700 border-yellow-200'
                                  }`}>
                                    {a.severity}
                                  </span>
                                )}
                              </div>
                              {a.reaction && (
                                <div className="text-xs text-slate-600 mt-1">{a.reaction}</div>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Recent Orders Section - Compact */}
                    <div className="bg-white/70 backdrop-blur-sm rounded-2xl border border-slate-200/50 p-5">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <TestTube className="w-4 h-4 text-violet-600" />
                          <h3 className="text-base font-bold text-slate-900">Recent Orders</h3>
                        </div>
                        <button onClick={() => fetchAuthorizedOrders()} className="p-1 hover:bg-slate-100 rounded transition-colors" title="Refresh">
                          <RefreshCw className="w-3 h-3 text-slate-600" />
                        </button>
                      </div>
                      {(() => {
                        const patientOrders = authorizedOrders.filter(o => o.patientId === currentAppointment.patient.id);
                        return patientOrders.length === 0 ? (
                          <p className="text-xs text-slate-500">No recent orders</p>
                        ) : (
                          <div className="space-y-2 max-h-48 overflow-y-auto">
                            {patientOrders.slice(0, 6).map((o: any) => (
                              <div key={o.id} className="p-2 border border-slate-200 rounded-lg text-xs">
                                <div className="flex items-center justify-between">
                                  <div className="flex-1 min-w-0">
                                    <div className="font-semibold text-slate-900 truncate">{o.orderName}</div>
                                    <div className="text-xs text-slate-600 mt-0.5">
                                      {o.orderType === 'lab_test' ? 'Lab' : o.orderType === 'medication' ? 'Rx' : o.orderType} • {o.priority}
                                    </div>
                                  </div>
                                  <span className={`px-2 py-0.5 rounded-full border text-xs ml-2 flex-shrink-0 ${
                                    o.status === 'authorized' ? 'bg-blue-50 text-blue-700 border-blue-200' :
                                    o.status === 'completed' ? 'bg-green-50 text-green-700 border-green-200' :
                                    o.status === 'in_progress' ? 'bg-yellow-50 text-yellow-700 border-yellow-200' :
                                    'bg-gray-50 text-gray-700 border-gray-200'
                                  }`}>
                                    {o.status}
                                  </span>
                                </div>
                              </div>
                            ))}
                          </div>
                        );
                      })()}
                    </div>
                  </div>
                </>
              ) : (
                <div className="bg-white/70 backdrop-blur-sm rounded-2xl border border-slate-200/50 p-8 text-center text-slate-600">
                  No in-progress appointment found for you today.
                </div>
              )}
            </div>
          )}

          {/* Imaging Tab */}
          {activeTab === 'imaging' && (
            <div className="space-y-6">
              {currentAppointment ? (
                <>
                  {/* Beautiful Header with Gradient */}
                  <div className="bg-gradient-to-br from-violet-600 via-purple-600 to-fuchsia-600 rounded-3xl p-8 text-white shadow-2xl border border-violet-400/50">
                    <div className="flex items-center justify-between flex-wrap gap-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-3">
                          <div className="p-3 bg-white/20 backdrop-blur-sm rounded-2xl shadow-lg">
                            <Activity className="w-8 h-8 text-white" />
                          </div>
                          <div>
                            <h2 className="text-3xl font-bold">Imaging Results & Timeline</h2>
                            <p className="text-violet-100 text-sm mt-1">Radiology orders, reports & acknowledgements</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-4 text-sm bg-white/10 backdrop-blur-sm rounded-xl px-4 py-2 w-fit">
                          <div className="flex items-center gap-2">
                            <User className="w-4 h-4" />
                            <span className="font-semibold">{currentAppointment.patient.firstName} {currentAppointment.patient.lastName}</span>
                          </div>
                          <span className="text-violet-200">•</span>
                          <span>Patient ID: {currentAppointment.patient.patientNumber}</span>
                          <span className="text-violet-200">•</span>
                          <span>{currentAppointment.patient.gender}, {new Date().getFullYear() - new Date(currentAppointment.patient.dateOfBirth).getFullYear()}y</span>
                        </div>
                      </div>
                      <button
                        onClick={openImagingOrderModal}
                        disabled={appointmentAwaitingPayment}
                        className="px-6 py-3 bg-white text-violet-600 hover:bg-violet-50 disabled:opacity-60 disabled:cursor-not-allowed rounded-xl transition-all flex items-center gap-2 font-semibold shadow-lg hover:shadow-xl disabled:hover:bg-white"
                      >
                        <Camera className="w-5 h-5" />
                        Order New Imaging
                      </button>
                    </div>
                  </div>

                  {/* Imaging Results Panel with Gradient Border */}
                  <div className="bg-gradient-to-br from-white via-violet-50/30 to-purple-50/30 rounded-3xl shadow-xl border-2 border-violet-200/50 p-6">
                    <DoctorImagingResultsPanel
                      tenantSlug={tenantSlug!}
                      token={localStorage.getItem('ehr_token') || ''}
                      patientId={currentAppointment.patient.id}
                      hideTabs={false}
                      compact={false}
                      title="Complete Imaging Timeline"
                      onOpenStudy={openImagingStudy}
                    />
                  </div>
                </>
              ) : (
                <div className="bg-gradient-to-br from-violet-50 to-purple-50 backdrop-blur-sm rounded-3xl border-2 border-violet-200/50 p-12 text-center">
                  <div className="max-w-md mx-auto">
                    <div className="w-20 h-20 bg-gradient-to-br from-violet-500 to-purple-600 rounded-full flex items-center justify-center mx-auto mb-6 shadow-xl">
                      <Activity className="w-10 h-10 text-white" />
                    </div>
                    <h3 className="text-2xl font-bold text-slate-900 mb-3">No Patient Selected</h3>
                    <p className="text-slate-600">Please select a patient from your current appointment to view their imaging results and timeline.</p>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Vitals Modal */}
      {showVitalsModal && currentAppointment && (
        <ModalPortal>
        <div className="fixed inset-0 bg-black/70 backdrop-blur-md flex items-center justify-center z-[100000] p-4 animate-in fade-in duration-300">
          <div className="bg-gradient-to-br from-white to-slate-50 rounded-3xl shadow-2xl border border-slate-200/50 w-full max-w-2xl max-h-[90vh] overflow-y-auto animate-in zoom-in-95 duration-300">
            {/* Header */}
            <div className="sticky top-0 bg-gradient-to-r from-blue-50 to-indigo-50 border-b border-blue-200/50 px-6 py-5 rounded-t-3xl">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-gradient-to-r from-blue-500 to-indigo-600 rounded-xl">
                    <Activity className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-slate-900">View Patient Vitals</h3>
                    <p className="text-sm text-slate-600">
                      {currentAppointment.patient.firstName} {currentAppointment.patient.lastName} • {currentAppointment.patient.patientNumber}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setShowVitalsModal(false)}
                  className="p-2 hover:bg-white/50 rounded-xl transition-colors"
                >
                  <X className="w-5 h-5 text-slate-500" />
                </button>
              </div>
            </div>

            {/* Content */}
            <div className="p-6">
              {/* Display existing vitals */}
              {(vitalsData[currentAppointment.patient.id] || []).length > 0 && (
                <div className="mb-6 space-y-4">
                  <h4 className="text-lg font-semibold text-slate-900">Recent Vitals</h4>
                  {(vitalsData[currentAppointment.patient.id] || []).slice(0, 3).map((v: PatientVitals) => (
                    <div key={v.id} className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl border border-blue-200/50 p-4">
                      <div className="flex items-center justify-between mb-3">
                        <span className="text-sm font-medium text-slate-700">
                          {new Date(v.recordedAt).toLocaleString()}
                        </span>
                        <span className="text-xs bg-white/70 text-slate-600 px-2 py-1 rounded">Recorded by: {v.recordedBy}</span>
                      </div>
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-sm">
                        <div className="flex items-center gap-2">
                          <Droplets className="w-4 h-4 text-blue-600" />
                          <span className="text-slate-700">BP:</span>
                          <span className="font-medium text-slate-900">{v.bloodPressure || '—'}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Heart className="w-4 h-4 text-red-600" />
                          <span className="text-slate-700">HR:</span>
                          <span className="font-medium text-slate-900">{v.heartRate ?? '—'} bpm</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Thermometer className="w-4 h-4 text-orange-600" />
                          <span className="text-slate-700">Temp:</span>
                          <span className="font-medium text-slate-900">{v.temperature ?? '—'} °C</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Activity className="w-4 h-4 text-green-600" />
                          <span className="text-slate-700">SpO2:</span>
                          <span className="font-medium text-slate-900">{v.oxygenSaturation ?? '—'} %</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Weight className="w-4 h-4 text-purple-600" />
                          <span className="text-slate-700">Weight:</span>
                          <span className="font-medium text-slate-900">{v.weight ?? '—'} kg</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <User className="w-4 h-4 text-indigo-600" />
                          <span className="text-slate-700">Height:</span>
                          <span className="font-medium text-slate-900">{v.height ?? '—'} cm</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              
              <div className="border-t border-slate-200 pt-6">
                <h4 className="text-lg font-semibold text-slate-900 mb-4">Record New Vitals</h4>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Blood Pressure */}
                <div className="space-y-2">
                  <label className="block text-sm font-semibold text-slate-700">Blood Pressure</label>
                  <div className="relative">
                    <input
                      type="text"
                      value={vitalsForm.bloodPressure}
                      onChange={(e) => setVitalsForm(prev => ({ ...prev, bloodPressure: e.target.value }))}
                      placeholder="120/80"
                      className="w-full border border-slate-300 rounded-xl px-4 py-3 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors"
                    />
                    <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                      <Droplets className="w-4 h-4 text-slate-400" />
                    </div>
                  </div>
                </div>

                {/* Heart Rate */}
                <div className="space-y-2">
                  <label className="block text-sm font-semibold text-slate-700">Heart Rate</label>
                  <div className="relative">
                    <input
                      type="number"
                      value={vitalsForm.heartRate}
                      onChange={(e) => setVitalsForm(prev => ({ ...prev, heartRate: e.target.value }))}
                      placeholder="72"
                      className="w-full border border-slate-300 rounded-xl px-4 py-3 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors"
                    />
                    <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                      <Heart className="w-4 h-4 text-slate-400" />
                    </div>
                  </div>
                </div>

                {/* Temperature */}
                <div className="space-y-2">
                  <label className="block text-sm font-semibold text-slate-700">Temperature</label>
                  <div className="relative">
                    <input
                      type="number"
                      value={vitalsForm.temperature}
                      onChange={(e) => setVitalsForm(prev => ({ ...prev, temperature: e.target.value }))}
                      placeholder="98.6"
                      step="0.1"
                      className="w-full border border-slate-300 rounded-xl px-4 py-3 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors"
                    />
                    <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                      <Thermometer className="w-4 h-4 text-slate-400" />
                    </div>
                  </div>
                </div>

                {/* Weight */}
                <div className="space-y-2">
                  <label className="block text-sm font-semibold text-slate-700">Weight (lbs)</label>
                  <div className="relative">
                    <input
                      type="number"
                      value={vitalsForm.weight}
                      onChange={(e) => setVitalsForm(prev => ({ ...prev, weight: e.target.value }))}
                      placeholder="150"
                      step="0.1"
                      className="w-full border border-slate-300 rounded-xl px-4 py-3 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors"
                    />
                    <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                      <Weight className="w-4 h-4 text-slate-400" />
                    </div>
                  </div>
                </div>

                {/* Height */}
                <div className="space-y-2">
                  <label className="block text-sm font-semibold text-slate-700">Height (in)</label>
                  <div className="relative">
                    <input
                      type="number"
                      value={vitalsForm.height}
                      onChange={(e) => setVitalsForm(prev => ({ ...prev, height: e.target.value }))}
                      placeholder="70"
                      className="w-full border border-slate-300 rounded-xl px-4 py-3 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors"
                    />
                    <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                      <User className="w-4 h-4 text-slate-400" />
                    </div>
                  </div>
                </div>

                {/* O2 Saturation */}
                <div className="space-y-2">
                  <label className="block text-sm font-semibold text-slate-700">O2 Saturation</label>
                  <div className="relative">
                    <input
                      type="number"
                      value={vitalsForm.oxygenSaturation}
                      onChange={(e) => setVitalsForm(prev => ({ ...prev, oxygenSaturation: e.target.value }))}
                      placeholder="98"
                      className="w-full border border-slate-300 rounded-xl px-4 py-3 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors"
                    />
                    <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                      <Activity className="w-4 h-4 text-slate-400" />
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="sticky bottom-0 bg-slate-50 border-t border-slate-200 px-6 py-4 rounded-b-2xl">
              <div className="flex gap-3">
                <button
                  onClick={() => setShowVitalsModal(false)}
                  className="flex-1 px-6 py-3 border border-slate-300 text-slate-700 rounded-xl hover:bg-slate-50 transition-colors font-medium"
                >
                  Cancel
                </button>
                <button
                  onClick={handleVitalsSubmit}
                  className="flex-1 px-6 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl hover:from-blue-700 hover:to-indigo-700 transition-all font-medium shadow-lg"
                >
                  Save Vitals
                </button>
              </div>
            </div>
          </div>
        </div>
        </ModalPortal>
      )}

      {/* Comprehensive Notes Modal */}
      {showComprehensiveNotes && currentAppointment && (
        <AppointmentNotes
          appointment={currentAppointment}
          onClose={() => setShowComprehensiveNotes(false)}
          onSave={() => { setShowComprehensiveNotes(false); fetchTodayAppointments(); }}
          tenantSlug={tenantSlug!}
          token={localStorage.getItem('ehr_token') || ''}
        />
      )}

      {/* Problems Modal */}
      {showProblemsModal && currentAppointment && (
        <ProblemListModal
          open={showProblemsModal}
          onClose={() => setShowProblemsModal(false)}
          onSaved={() => { setShowProblemsModal(false); fetchTodayAppointments(); }}
          appointment={currentAppointment}
          tenantSlug={tenantSlug!}
          token={localStorage.getItem('ehr_token') || ''}
        />
      )}

      {/* Allergies Modal */}
      {showAllergiesModal && currentAppointment && (
        <AllergiesModal
          open={showAllergiesModal}
          onClose={() => setShowAllergiesModal(false)}
          onSaved={() => { setShowAllergiesModal(false); fetchTodayAppointments(); }}
          appointment={currentAppointment}
          patientId={currentAppointment.patient.id}
          tenantSlug={tenantSlug!}
          token={localStorage.getItem('ehr_token') || ''}
        />
      )}

      {/* Clinical Notes Modal */}
      {showClinicalNotesModal && currentAppointment && (
        <ClinicalNotesModal
          open={showClinicalNotesModal}
          onClose={() => setShowClinicalNotesModal(false)}
          onSaved={() => { setShowClinicalNotesModal(false); fetchTodayAppointments(); }}
          appointment={currentAppointment}
          tenantSlug={tenantSlug!}
          token={localStorage.getItem('ehr_token') || ''}
        />
      )}

      {/* Prescriptions Modal */}
      {showPrescriptionsModal && currentAppointment && (
        <PrescriptionsModal
          open={showPrescriptionsModal}
          onClose={() => setShowPrescriptionsModal(false)}
          onSaved={() => { setShowPrescriptionsModal(false); fetchTodayAppointments(); fetchAuthorizedOrders(); }}
          appointment={currentAppointment}
          tenantSlug={tenantSlug!}
          token={localStorage.getItem('ehr_token') || ''}
        />
      )}

      {/* Lab Orders Modal */}
      {showLabOrdersModal && currentAppointment && (
        <LabOrdersModal
          open={showLabOrdersModal}
          onClose={() => setShowLabOrdersModal(false)}
          onSaved={() => { setShowLabOrdersModal(false); fetchTodayAppointments(); fetchAuthorizedOrders(); }}
          appointment={currentAppointment}
          tenantSlug={tenantSlug!}
          token={localStorage.getItem('ehr_token') || ''}
        />
      )}

      {/* Lab Results Modal */}
      {showLabResultsModal && currentAppointment && (
        <ModalPortal>
          <div className="fixed inset-0 bg-black/70 backdrop-blur-md flex items-center justify-center z-[100000] p-4">
            <div className="bg-white rounded-3xl shadow-2xl border border-slate-200/50 w-full max-w-6xl max-h-[90vh] overflow-hidden flex flex-col">
              <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-gradient-to-r from-blue-500 to-cyan-600 rounded-xl">
                    <TestTube className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-slate-900">Lab Results</h3>
                    <p className="text-sm text-slate-600">
                      {currentAppointment.patient.firstName} {currentAppointment.patient.lastName}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setShowLabResultsModal(false)}
                  className="p-2 rounded-lg hover:bg-slate-100 transition-colors"
                >
                  <X className="w-5 h-5 text-slate-600" />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto p-6">
                <LabResultsViewer
                  patientId={currentAppointment.patient.id}
                  tenantSlug={tenantSlug!}
                  token={localStorage.getItem('ehr_token') || ''}
                />
              </div>
            </div>
          </div>
        </ModalPortal>
      )}

      {/* Referral Modal */}
      {showReferralModal && currentReferralAppointment && (
        <ModalPortal>
        <div className="fixed inset-0 bg-black/70 backdrop-blur-md flex items-center justify-center z-[100000] p-4 animate-in fade-in duration-300">
          <div className="bg-gradient-to-br from-white to-slate-50 rounded-3xl shadow-2xl border border-slate-200/50 w-full max-w-2xl max-h-[90vh] overflow-y-auto animate-in zoom-in-95 duration-300">
            {/* Header */}
            <div className="sticky top-0 bg-gradient-to-r from-orange-50 to-red-50 border-b border-orange-200/50 px-6 py-5 rounded-t-3xl">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-2xl font-bold text-slate-900 flex items-center gap-3">
                    <Stethoscope className="w-7 h-7 text-orange-600" />
                    Return Patient to Nurse
                  </h2>
                  <p className="text-slate-600 mt-1">
                    {currentReferralAppointment.patient.firstName} {currentReferralAppointment.patient.lastName} • {currentReferralAppointment.patient.patientNumber}
                  </p>
                </div>
                <button
                  onClick={() => setShowReferralModal(false)}
                  className="p-2 hover:bg-white/50 rounded-xl transition-colors"
                >
                  <X className="w-5 h-5 text-slate-500" />
                </button>
              </div>
            </div>

            {/* Content */}
            <div className="p-6 space-y-6">
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">
                  Reason for Referral *
                </label>
                <select
                  value={referralReason}
                  onChange={(e) => setReferralReason(e.target.value)}
                  className="w-full px-4 py-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-orange-500 transition-colors"
                  required
                >
                  <option value="">Select reason...</option>
                  <option value="Injection">Injection</option>
                  <option value="IV Drip">IV Drip</option>
                  <option value="Wound Dressing">Wound Dressing</option>
                  <option value="Vital Signs">Vital Signs Monitoring</option>
                  <option value="Medication Administration">Medication Administration</option>
                  <option value="Blood Draw">Blood Draw</option>
                  <option value="Other">Other</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">
                  Specific Instructions
                </label>
                <textarea
                  value={referralInstructions}
                  onChange={(e) => setReferralInstructions(e.target.value)}
                  placeholder="Enter specific instructions for the nurse..."
                  className="w-full px-4 py-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-orange-500 transition-colors h-32 resize-none"
                />
              </div>

              <div className="bg-orange-50 border border-orange-200 rounded-xl p-4">
                <div className="flex items-start gap-3">
                  <AlertCircle className="w-5 h-5 text-orange-600 mt-0.5" />
                  <div>
                    <h4 className="font-semibold text-orange-900 mb-1">Important</h4>
                    <p className="text-orange-800 text-sm">
                      A referral note and an authorized order will be created. The patient will appear in the nurse's queue with actionable orders.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="sticky bottom-0 bg-slate-50 border-t border-slate-200 px-6 py-4 rounded-b-2xl">
              <div className="flex gap-3">
                <button
                  onClick={() => setShowReferralModal(false)}
                  className="flex-1 px-6 py-3 border border-slate-300 text-slate-700 rounded-xl hover:bg-slate-50 transition-colors font-medium"
                >
                  Cancel
                </button>
                <button
                  onClick={handleReferralSubmit}
                  disabled={!referralReason}
                  className="flex-1 px-6 py-3 bg-gradient-to-r from-orange-600 to-red-600 text-white rounded-xl hover:from-orange-700 hover:to-red-700 transition-all font-medium shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Refer to Nurse
                </button>
              </div>
            </div>
          </div>
        </div>
        </ModalPortal>
      )}

      {/* SOAP Template Modal */}
      {showSoapModal && currentAppointment && (
        <ModalPortal>
        <div className="fixed inset-0 bg-black/70 backdrop-blur-md flex items-center justify-center z-[100000] p-4">
          <div className="bg-white rounded-3xl shadow-2xl border border-slate-200/50 w-full max-w-3xl overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
              <h3 className="text-lg font-bold text-slate-900">SOAP Note</h3>
              <button onClick={() => setShowSoapModal(false)} className="p-2 rounded-lg hover:bg-slate-100"><X className="w-5 h-5 text-slate-600" /></button>
            </div>
            <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium text-slate-700">Subjective</label>
                <textarea className="w-full border border-slate-300 rounded-xl p-3 h-28" value={soapData.subjective} onChange={(e) => setSoapData({ ...soapData, subjective: e.target.value })} />
              </div>
              <div>
                <label className="text-sm font-medium text-slate-700">Objective</label>
                <textarea className="w-full border border-slate-300 rounded-xl p-3 h-28" value={soapData.objective} onChange={(e) => setSoapData({ ...soapData, objective: e.target.value })} />
              </div>
              <div>
                <label className="text-sm font-medium text-slate-700">Assessment</label>
                <textarea className="w-full border border-slate-300 rounded-xl p-3 h-24" value={soapData.assessment} onChange={(e) => setSoapData({ ...soapData, assessment: e.target.value })} />
              </div>
              <div>
                <label className="text-sm font-medium text-slate-700">Plan</label>
                <textarea className="w-full border border-slate-300 rounded-xl p-3 h-24" value={soapData.plan} onChange={(e) => setSoapData({ ...soapData, plan: e.target.value })} />
              </div>
            </div>
            <div className="px-6 py-4 border-t border-slate-200 flex items-center justify-end gap-3">
              <button onClick={() => setShowSoapModal(false)} className="px-4 py-2 rounded-lg border border-slate-300">Cancel</button>
              <button onClick={async () => {
                try {
                  const token = localStorage.getItem('ehr_token');
                  if (!token) return;
                  await ehrApi.updateAppointment(currentAppointment.id, {
                    notes: `SOAP NOTE\nS: ${soapData.subjective}\nO: ${soapData.objective}\nA: ${soapData.assessment}\nP: ${soapData.plan}`
                  }, token, tenantSlug!);
                  setShowSoapModal(false);
                  showSuccess('Saved', 'SOAP note saved');
                  fetchTodayAppointments();
                } catch (e) { showError('Error', 'Failed to save SOAP note'); }
              }} className="px-4 py-2 rounded-lg bg-gradient-to-r from-blue-600 to-indigo-600 text-white">Save SOAP</button>
            </div>
          </div>
        </div>
        </ModalPortal>
      )}

      {/* Prescribing Template Modal */}
      {showRxTemplateModal && currentAppointment && (
        <ModalPortal>
        <div className="fixed inset-0 bg-black/70 backdrop-blur-md flex items-center justify-center z-[100000] p-4">
          <div className="bg-white rounded-3xl shadow-2xl border border-slate-200/50 w-full max-w-2xl overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
              <h3 className="text-lg font-bold text-slate-900">Prescribe Medication</h3>
              <button onClick={() => setShowRxTemplateModal(false)} className="p-2 rounded-lg hover:bg-slate-100"><X className="w-5 h-5 text-slate-600" /></button>
            </div>
            <div className="p-6 space-y-3">
              <input className="w-full border border-slate-300 rounded-xl p-3" placeholder="Medication" value={rxData.medication} onChange={(e) => setRxData({ ...rxData, medication: e.target.value })} />
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <input className="border border-slate-300 rounded-xl p-3" placeholder="Dosage" value={rxData.dosage} onChange={(e) => setRxData({ ...rxData, dosage: e.target.value })} />
                <input className="border border-slate-300 rounded-xl p-3" placeholder="Frequency" value={rxData.frequency} onChange={(e) => setRxData({ ...rxData, frequency: e.target.value })} />
                <input className="border border-slate-300 rounded-xl p-3" placeholder="Duration" value={rxData.duration} onChange={(e) => setRxData({ ...rxData, duration: e.target.value })} />
              </div>
            </div>
            <div className="px-6 py-4 border-t border-slate-200 flex items-center justify-end gap-3">
              <button onClick={() => setShowRxTemplateModal(false)} className="px-4 py-2 rounded-lg border border-slate-300">Cancel</button>
              <button onClick={async () => {
                try {
                  const token = localStorage.getItem('ehr_token');
                  if (!token || !currentUser) return;
                  const created = await ehrApi.createOrder({
                    patientId: currentAppointment.patient.id,
                    appointmentId: currentAppointment.id,
                    doctorId: currentUser.id,
                    orderType: 'medication',
                    orderName: rxData.medication,
                    description: `Prescription for ${rxData.medication}`,
                    instructions: `Dosage: ${rxData.dosage}, Frequency: ${rxData.frequency}, Duration: ${rxData.duration}`,
                    priority: 'normal',
                    dosage: rxData.dosage,
                    frequency: rxData.frequency,
                    duration: rxData.duration
                  }, token, tenantSlug!);
                  const orderId = created?.data?.order?.id;
                  if (orderId) { await ehrApi.authorizeOrder(orderId, token, tenantSlug!); }
                  setShowRxTemplateModal(false);
                  showSuccess('Prescribed', 'Medication order created and authorized');
                  fetchTodayAppointments();
                  fetchAuthorizedOrders();
                } catch (e) { showError('Error', 'Failed to create prescription'); }
              }} className="px-4 py-2 rounded-lg bg-gradient-to-r from-fuchsia-600 to-pink-600 text-white">Create Prescription</button>
            </div>
          </div>
        </div>
        </ModalPortal>
      )}

      {/* Care Plan Modal */}
      {showCarePlanModal && currentAppointment && (
        <ModalPortal>
        <div className="fixed inset-0 bg-black/70 backdrop-blur-md flex items-center justify-center z-[100000] p-4">
          <div className="bg-white rounded-3xl shadow-2xl border border-slate-200/50 w-full max-w-2xl overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
              <h3 className="text-lg font-bold text-slate-900">Care Plan</h3>
              <button onClick={() => setShowCarePlanModal(false)} className="p-2 rounded-lg hover:bg-slate-100"><X className="w-5 h-5 text-slate-600" /></button>
            </div>
            <div className="p-6 space-y-3">
              <textarea className="w-full border border-slate-300 rounded-xl p-3 h-20" placeholder="Goals" value={carePlan.goals} onChange={(e) => setCarePlan({ ...carePlan, goals: e.target.value })} />
              <textarea className="w-full border border-slate-300 rounded-xl p-3 h-20" placeholder="Tasks" value={carePlan.tasks} onChange={(e) => setCarePlan({ ...carePlan, tasks: e.target.value })} />
              <input className="w-full border border-slate-300 rounded-xl p-3" placeholder="Due date (optional)" value={carePlan.dueDate} onChange={(e) => setCarePlan({ ...carePlan, dueDate: e.target.value })} />
            </div>
            <div className="px-6 py-4 border-t border-slate-200 flex items-center justify-end gap-3">
              <button onClick={() => setShowCarePlanModal(false)} className="px-4 py-2 rounded-lg border border-slate-300">Cancel</button>
              <button onClick={async () => {
                try {
                  const token = localStorage.getItem('ehr_token');
                  if (!token) return;
                  await ehrApi.updateAppointment(currentAppointment.id, {
                    notes: `CARE PLAN\nGoals: ${carePlan.goals}\nTasks: ${carePlan.tasks}\nDue: ${carePlan.dueDate || '—'}`
                  }, token, tenantSlug!);
                  setShowCarePlanModal(false);
                  showSuccess('Saved', 'Care plan saved to notes');
                  fetchTodayAppointments();
                } catch (e) { showError('Error', 'Failed to save care plan'); }
              }} className="px-4 py-2 rounded-lg bg-gradient-to-r from-emerald-600 to-teal-600 text-white">Save Care Plan</button>
            </div>
          </div>
        </div>
        </ModalPortal>
      )}

      {/* Enhanced Lab Order Modal (NEW!) */}
      {showEnhancedLabOrderModal && currentAppointment && (
        <EnhancedLabOrderModal
          patientId={currentAppointment.patient.id}
          patientName={`${currentAppointment.patient.firstName} ${currentAppointment.patient.lastName}`}
          tenantSlug={tenantSlug!}
          token={localStorage.getItem('ehr_token') || ''}
          onClose={() => setShowEnhancedLabOrderModal(false)}
          onSuccess={() => {
            setShowEnhancedLabOrderModal(false);
            fetchTodayAppointments();
          }}
          orderingProviderId={currentUser?.id || ''}
        />
      )}

      {/* Imaging Order Modal (NEW!) */}
      {showImagingOrderModal && currentAppointment && (
        <ImagingOrderModal
          patientId={currentAppointment.patient.id}
          patientName={`${currentAppointment.patient.firstName} ${currentAppointment.patient.lastName}`}
          tenantSlug={tenantSlug!}
          token={localStorage.getItem('ehr_token') || ''}
          onClose={() => setShowImagingOrderModal(false)}
          onSuccess={() => {
            setShowImagingOrderModal(false);
            fetchTodayAppointments();
          }}
          orderingProviderId={currentUser?.id}
        />
      )}

      {imagingViewerOpen && tenantSlug && (
        <ImagingStudyViewerModal
          isOpen={imagingViewerOpen}
          onClose={closeImagingViewer}
          study={loadingImagingStudy ? null : imagingStudyDetails}
          tenantSlug={tenantSlug!}
          token={localStorage.getItem('ehr_token') || ''}
          onRefresh={refreshImagingStudy}
          isLoading={loadingImagingStudy}
          loadError={imagingStudyLoadError}
          currentUser={currentUser}
        />
      )}

      {/* Advanced Result Comparison Modal (NEW!) */}
      {showResultComparisonModal && currentAppointment && (
        <ModalPortal>
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <AdvancedResultComparison
              patientId={currentAppointment.patient.id}
              tenantSlug={tenantSlug!}
              token={localStorage.getItem('ehr_token') || ''}
              onClose={() => setShowResultComparisonModal(false)}
            />
          </div>
        </ModalPortal>
      )}

      {/* Doctor Availability Manager */}
      {showAvailabilityManager && currentUser && tenantSlug && (
        <DoctorAvailabilityManager
          doctorId={currentUser.id}
          tenantSlug={tenantSlug}
          onClose={() => setShowAvailabilityManager(false)}
        />
      )}

      {/* Patient PRO Viewer Modal */}
      {showProViewerModal && currentAppointment && (
        <ModalPortal>
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
              <PatientProViewer
                patientId={currentAppointment.patient.id}
                tenantSlug={tenantSlug!}
                token={localStorage.getItem('ehr_token') || ''}
                onClose={() => setShowProViewerModal(false)}
              />
            </div>
          </div>
        </ModalPortal>
      )}

      {/* Questionnaire Library Modal */}
      {showQuestionnaireLibrary && currentAppointment && (
        <ModalPortal>
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl shadow-2xl max-w-5xl w-full max-h-[90vh] overflow-hidden">
              <QuestionnaireLibrary
                patientId={currentAppointment.patient.id}
                tenantSlug={tenantSlug!}
                token={localStorage.getItem('ehr_token') || ''}
                onClose={() => setShowQuestionnaireLibrary(false)}
                onAssigned={() => {
                  setShowQuestionnaireLibrary(false);
                  showSuccess('Success', 'Questionnaire assigned successfully!');
                  // Optionally refresh PRO alerts
                }}
              />
            </div>
          </div>
        </ModalPortal>
      )}

      {/* Workflow List Modal */}
      {showWorkflowList && tenantSlug && (
        <ModalPortal>
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl shadow-2xl max-w-6xl w-full max-h-[90vh] overflow-hidden">
              <WorkflowList
                tenantSlug={tenantSlug}
                token={localStorage.getItem('ehr_token') || ''}
                onClose={() => setShowWorkflowList(false)}
              />
            </div>
          </div>
        </ModalPortal>
      )}

      {/* Care Plan List Modal */}
      {showCarePlanList && tenantSlug && carePlanPatientId && (
        <ModalPortal>
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <CarePlanList
              patientId={carePlanPatientId}
              tenantSlug={tenantSlug}
              token={localStorage.getItem('ehr_token') || ''}
              onClose={() => {
                setShowCarePlanList(false);
                setCarePlanPatientId(null);
              }}
            />
          </div>
        </ModalPortal>
      )}

      {/* Care Plan Templates Modal */}
      {showCarePlanTemplates && tenantSlug && carePlanPatientId && (
        <CarePlanTemplates
          patientId={carePlanPatientId}
          tenantSlug={tenantSlug}
          token={localStorage.getItem('ehr_token') || ''}
          onClose={() => {
            setShowCarePlanTemplates(false);
            setCarePlanPatientId(null);
          }}
          onApplied={() => {
            setShowCarePlanTemplates(false);
            // Optionally refresh patient care plans
          }}
        />
      )}

      {/* Care Plan Viewer Modal */}
      {showCarePlanViewer && tenantSlug && selectedCarePlanId && (
        <CarePlanViewer
          carePlanId={selectedCarePlanId}
          tenantSlug={tenantSlug}
          token={localStorage.getItem('ehr_token') || ''}
          onClose={() => {
            setShowCarePlanViewer(false);
            setSelectedCarePlanId(null);
          }}
          onEdit={() => {
            setShowCarePlanViewer(false);
            setShowCarePlanBuilder(true);
          }}
        />
      )}

      {/* Referral List Modal */}
      {showReferralListModal && tenantSlug && currentAppointment?.patient?.id && (
        <ModalPortal>
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <ReferralList
              patientId={currentAppointment.patient.id}
              tenantSlug={tenantSlug}
              token={localStorage.getItem('ehr_token') || ''}
            />
            <button
              onClick={() => setShowReferralListModal(false)}
              className="absolute top-4 right-4 p-2 bg-white rounded-lg hover:bg-slate-100 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </ModalPortal>
      )}

      {/* Referral Form Modal */}
      {showReferralFormModal && tenantSlug && currentAppointment?.patient && (
        <ReferralForm
          patientId={currentAppointment.patient.id}
          patientName={`${currentAppointment.patient.firstName} ${currentAppointment.patient.lastName}`}
          tenantSlug={tenantSlug}
          token={localStorage.getItem('ehr_token') || ''}
          onClose={() => setShowReferralFormModal(false)}
          onSuccess={() => {
            setShowReferralFormModal(false);
            setShowReferralListModal(true);
          }}
        />
      )}

      {/* Referral Templates Modal */}
      {showReferralTemplatesModal && tenantSlug && currentAppointment?.patient && (
        <ReferralTemplates
          patientId={currentAppointment.patient.id}
          patientName={`${currentAppointment.patient.firstName} ${currentAppointment.patient.lastName}`}
          tenantSlug={tenantSlug}
          token={localStorage.getItem('ehr_token') || ''}
          onClose={() => setShowReferralTemplatesModal(false)}
          onTemplateApplied={(referralId) => {
            setShowReferralTemplatesModal(false);
            setShowReferralListModal(true);
          }}
        />
      )}

      {/* Document List Modal */}
      {showDocumentListModal && tenantSlug && currentAppointment?.patient && (
        <ModalPortal>
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <DocumentList
              patientId={currentAppointment.patient.id}
              patientName={`${currentAppointment.patient.firstName} ${currentAppointment.patient.lastName}`}
              tenantSlug={tenantSlug}
              token={localStorage.getItem('ehr_token') || ''}
              onClose={() => setShowDocumentListModal(false)}
            />
          </div>
        </ModalPortal>
      )}

      {/* Inbox Modal */}
      {showInboxModal && tenantSlug && (
        <Inbox
          onClose={() => setShowInboxModal(false)}
          onCompose={() => {
            setShowInboxModal(false);
            setShowMessageComposerModal(true);
          }}
          token={localStorage.getItem('ehr_token') || ''}
          tenantSlug={tenantSlug}
        />
      )}

      {/* Message Composer Modal */}
      {showMessageComposerModal && tenantSlug && (
        <MessageComposer
          onClose={() => setShowMessageComposerModal(false)}
          onSent={() => {
            setShowMessageComposerModal(false);
            setShowInboxModal(true);
          }}
          token={localStorage.getItem('ehr_token') || ''}
          tenantSlug={tenantSlug}
          patientId={currentAppointment?.patient?.id}
          appointmentId={currentAppointment?.id}
        />
      )}

      {/* Care Plan Builder Modal */}
      {showCarePlanBuilder && tenantSlug && carePlanPatientId && (
        <CarePlanBuilder
          patientId={carePlanPatientId}
          carePlanId={selectedCarePlanId || undefined}
          tenantSlug={tenantSlug}
          token={localStorage.getItem('ehr_token') || ''}
          onClose={() => {
            setShowCarePlanBuilder(false);
            setSelectedCarePlanId(null);
          }}
          onSave={() => {
            setShowCarePlanBuilder(false);
            // Optionally refresh patient care plans
          }}
        />
      )}
      {/* Tier 1 Feature Modals */}
      {showConsentLibraryModal && currentAppointment && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-6xl w-full max-h-[90vh] overflow-hidden flex flex-col">
            <div className="sticky top-0 bg-gradient-to-r from-indigo-600 to-purple-600 text-white p-6 flex items-center justify-between z-10">
              <div>
                <h2 className="text-2xl font-bold">Consent Library</h2>
                <p className="text-indigo-100 mt-1">Select a consent template for {currentAppointment.patient.firstName} {currentAppointment.patient.lastName}</p>
              </div>
              <button
                onClick={() => setShowConsentLibraryModal(false)}
                className="p-2 hover:bg-white/20 rounded-lg transition-colors"
              >
                <XCircle className="w-6 h-6" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-6">
              <ConsentLibrary
                patientId={currentAppointment.patient.id}
                appointmentId={currentAppointment.id}
                tenantSlug={tenantSlug!}
                token={localStorage.getItem('ehr_token') || ''}
                onSelectTemplate={(templateId) => {
                  console.log('Selected template:', templateId);
                  setShowConsentLibraryModal(false);
                }}
                onClose={() => setShowConsentLibraryModal(false)}
              />
            </div>
          </div>
        </div>
      )}

      {showImmunizationsModal && currentAppointment && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-6xl w-full max-h-[90vh] overflow-hidden flex flex-col">
            <div className="sticky top-0 bg-gradient-to-r from-emerald-600 to-teal-600 text-white p-6 flex items-center justify-between z-10">
              <div>
                <h2 className="text-2xl font-bold">Immunization History</h2>
                <p className="text-emerald-100 mt-1">Vaccine records for {currentAppointment.patient.firstName} {currentAppointment.patient.lastName}</p>
              </div>
              <button
                onClick={() => setShowImmunizationsModal(false)}
                className="p-2 hover:bg-white/20 rounded-lg transition-colors"
              >
                <XCircle className="w-6 h-6" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-6">
              <ImmunizationHistory
                patientId={currentAppointment.patient.id}
                tenantSlug={tenantSlug!}
                token={localStorage.getItem('ehr_token') || ''}
                onAddImmunization={() => {
                  console.log('Add immunization clicked');
                }}
              />
            </div>
          </div>
        </div>
      )}

      {showPathwaysModal && currentAppointment && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-6xl w-full max-h-[90vh] overflow-hidden flex flex-col">
            <div className="sticky top-0 bg-gradient-to-r from-blue-600 to-cyan-600 text-white p-6 flex items-center justify-between z-10">
              <div>
                <h2 className="text-2xl font-bold">Clinical Pathways</h2>
                <p className="text-blue-100 mt-1">Evidence-based care pathways for {currentAppointment.patient.firstName} {currentAppointment.patient.lastName}</p>
              </div>
              <button
                onClick={() => setShowPathwaysModal(false)}
                className="p-2 hover:bg-white/20 rounded-lg transition-colors"
              >
                <XCircle className="w-6 h-6" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-6">
              <PathwayManagement
                patientId={currentAppointment.patient.id}
                tenantSlug={tenantSlug!}
                token={localStorage.getItem('ehr_token') || ''}
              />
            </div>
          </div>
        </div>
      )}

      {/* Questionnaires (PRO) Modal */}
      {showProScheduleModal && selectedPatientIdForPro && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-6xl w-full max-h-[90vh] overflow-hidden flex flex-col">
            <div className="sticky top-0 bg-gradient-to-r from-indigo-600 to-purple-600 text-white p-6 flex items-center justify-between z-10">
              <div>
                <h2 className="text-2xl font-bold">Questionnaires & PRO Schedules</h2>
                <p className="text-indigo-100 mt-1">Patient-Reported Outcomes scheduling and management</p>
              </div>
              <button
                onClick={() => {
                  setShowProScheduleModal(false);
                  setSelectedPatientIdForPro(null);
                }}
                className="p-2 hover:bg-white/20 rounded-lg transition-colors"
              >
                <XCircle className="w-6 h-6" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-6">
              <PatientProSchedules
                patientId={selectedPatientIdForPro}
                tenantSlug={tenantSlug!}
                token={localStorage.getItem('ehr_token') || ''}
                onScheduleCreated={() => {
                  console.log('PRO schedule created');
                }}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DoctorDashboard;