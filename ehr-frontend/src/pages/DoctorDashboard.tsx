import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  Calendar, Clock, User, Stethoscope, CheckCircle, AlertCircle, AlertTriangle,
  Play, Pause, Square, FileText, Pill, TestTube, Bell, 
  Search, Filter, RefreshCw, Eye, Edit, Phone, Video,
  Activity, Heart, Thermometer, Droplets, Weight, Zap, ArrowLeft, XCircle, Settings,
  LogOut, Menu, X, BarChart3, CreditCard, Users, Bell as BellIcon, ChevronDown, ChevronUp,
  Camera, TrendingUp, Baby, FlaskConical
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
import CriticalResultAlertPanel from '../components/CriticalResultAlertPanel';
import EnhancedLabOrderModal from '../components/EnhancedLabOrderModal';
import ImagingOrderModal from '../components/ImagingOrderModal';
import AdvancedResultComparison from '../components/AdvancedResultComparison';
import DoctorImagingResultsPanel from '../components/DoctorImagingResultsPanel';
import ImagingStudyViewerModal from '../components/ImagingStudyViewerModal';

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

  // Get current user info
  const [currentUser, setCurrentUser] = useState<any>(null);
  
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
      showError('Failed to load imaging study');
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
      showError('Failed to refresh imaging study');
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
        gender: currentAppointment.patient.gender,
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
      { icon: Calendar, label: 'Appointments', desc: 'Schedule & manage', color: 'from-purple-500 to-indigo-500', route: 'doctor/appointments' },
      { icon: FileText, label: 'Treatment History', desc: 'Past treatments by you', color: 'from-blue-500 to-cyan-500', route: 'doctor/treatments' },
      { icon: Activity, label: 'HIV/AIDS Care', desc: 'HIV patient management & ARV', color: 'from-red-500 to-orange-500', route: 'doctor/hiv' },
      { icon: Baby, label: 'Maternity & Obstetrics', desc: 'High-risk pregnancies & deliveries', color: 'from-pink-500 to-rose-500', route: 'doctor/maternity' },
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

          {/* Quick Actions - HIV/AIDS Care */}
          <div className="mb-8">
            <div className="bg-gradient-to-r from-red-500 via-orange-500 to-red-600 rounded-2xl shadow-xl border-4 border-red-400 p-6 hover:shadow-2xl transition-all duration-300">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4 flex-1">
                  <div className="p-4 bg-white/20 rounded-xl backdrop-blur-sm">
                    <Activity className="w-10 h-10 text-white" />
                  </div>
                  <div className="flex-1">
                    <h3 className="text-2xl font-bold text-white mb-2">HIV/AIDS Patient Management</h3>
                    <p className="text-red-50 text-base mb-3">
                      Comprehensive HIV care oversight, ARV regimen management, EAC program monitoring, and treatment failure alerts
                    </p>
                    <div className="flex flex-wrap gap-2 mb-3">
                      <span className="px-3 py-1 bg-white/20 rounded-full text-sm font-semibold text-white backdrop-blur-sm">
                        ARV Regimen Changes
                      </span>
                      <span className="px-3 py-1 bg-white/20 rounded-full text-sm font-semibold text-white backdrop-blur-sm">
                        EAC Monitoring
                      </span>
                      <span className="px-3 py-1 bg-white/20 rounded-full text-sm font-semibold text-white backdrop-blur-sm">
                        Treatment Alerts
                      </span>
                      <span className="px-3 py-1 bg-white/20 rounded-full text-sm font-semibold text-white backdrop-blur-sm">
                        Viral Load Trends
                      </span>
                    </div>
                  </div>
                </div>
                <button
                  onClick={() => navigate(`/ehr/${tenantSlug}/doctor/hiv`)}
                  className="px-6 py-3 bg-white text-red-600 rounded-xl hover:bg-red-50 font-bold text-lg shadow-lg hover:shadow-xl transition-all flex items-center gap-2 whitespace-nowrap"
                >
                  <Activity className="w-5 h-5" />
                  Open HIV Dashboard
                </button>
              </div>
            </div>
          </div>

          {/* Quick Actions - Maternity & Obstetrics */}
          <div className="mb-8">
            <div className="bg-gradient-to-r from-pink-500 via-rose-500 to-pink-600 rounded-2xl shadow-xl border-4 border-pink-400 p-6 hover:shadow-2xl transition-all duration-300">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4 flex-1">
                  <div className="p-4 bg-white/20 rounded-xl backdrop-blur-sm">
                    <Baby className="w-10 h-10 text-white" />
                  </div>
                  <div className="flex-1">
                    <h3 className="text-2xl font-bold text-white mb-2">Maternity & Obstetrics</h3>
                    <p className="text-pink-50 text-base mb-3">
                      High-risk pregnancy management, delivery oversight, maternal complications, and referral cases
                    </p>
                    <div className="flex flex-wrap gap-2 mb-3">
                      <span className="px-3 py-1 bg-white/20 rounded-full text-sm font-semibold text-white backdrop-blur-sm">
                        High-Risk Cases
                      </span>
                      <span className="px-3 py-1 bg-white/20 rounded-full text-sm font-semibold text-white backdrop-blur-sm">
                        Upcoming Deliveries
                      </span>
                      <span className="px-3 py-1 bg-white/20 rounded-full text-sm font-semibold text-white backdrop-blur-sm">
                        Complications
                      </span>
                      <span className="px-3 py-1 bg-white/20 rounded-full text-sm font-semibold text-white backdrop-blur-sm">
                        Referral Review
                      </span>
                    </div>
                  </div>
                </div>
                <button
                  onClick={() => navigate(`/ehr/${tenantSlug}/doctor/maternity`)}
                  className="px-6 py-3 bg-white text-pink-600 rounded-xl hover:bg-pink-50 font-bold text-lg shadow-lg hover:shadow-xl transition-all flex items-center gap-2 whitespace-nowrap"
                >
                  <Baby className="w-5 h-5" />
                  Open Maternity Center
                </button>
              </div>
            </div>
          </div>

          {/* Quick Actions - Oncology */}
          <div className="mb-8">
            <div className="bg-gradient-to-r from-purple-600 via-fuchsia-600 to-rose-600 rounded-2xl shadow-xl border-4 border-fuchsia-400 p-6 hover:shadow-2xl transition-all duration-300">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4 flex-1">
                  <div className="p-4 bg-white/15 rounded-xl backdrop-blur-sm">
                    <FlaskConical className="w-10 h-10 text-white" />
                  </div>
                  <div className="flex-1">
                    <h3 className="text-2xl font-bold text-white mb-2">Oncology Care Navigator</h3>
                    <p className="text-fuchsia-50 text-base mb-3">
                      Coordinate tumor board plans, systemic therapy regimens, infusion sessions, and toxicity tracking in one console.
                    </p>
                    <div className="flex flex-wrap gap-2 mb-3">
                      <span className="px-3 py-1 bg-white/20 rounded-full text-sm font-semibold text-white backdrop-blur-sm">
                        Tumor Board Workflow
                      </span>
                      <span className="px-3 py-1 bg-white/20 rounded-full text-sm font-semibold text-white backdrop-blur-sm">
                        Regimen Tracking
                      </span>
                      <span className="px-3 py-1 bg-white/20 rounded-full text-sm font-semibold text-white backdrop-blur-sm">
                        Infusion Sessions
                      </span>
                      <span className="px-3 py-1 bg-white/20 rounded-full text-sm font-semibold text-white backdrop-blur-sm">
                        Adverse Events
                      </span>
                    </div>
                  </div>
                </div>
                <button
                  onClick={() => navigate(`/ehr/${tenantSlug}/doctor/oncology`)}
                  className="px-6 py-3 bg-white text-fuchsia-600 rounded-xl hover:bg-fuchsia-50 font-bold text-lg shadow-lg hover:shadow-xl transition-all flex items-center gap-2 whitespace-nowrap"
                >
                  <FlaskConical className="w-5 h-5" />
                  Open Oncology Hub
                </button>
              </div>
            </div>
          </div>

          {/* Quick Actions - Ophthalmology */}
          <div className="mb-8">
            <div className="bg-gradient-to-r from-sky-500 via-indigo-500 to-blue-600 rounded-2xl shadow-xl border-4 border-sky-400 p-6 hover:shadow-2xl transition-all duration-300">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4 flex-1">
                  <div className="p-4 bg-white/15 rounded-xl backdrop-blur-sm">
                    <Eye className="w-10 h-10 text-white" />
                  </div>
                  <div className="flex-1">
                    <h3 className="text-2xl font-bold text-white mb-2">Ophthalmology Clinic</h3>
                    <p className="text-blue-50 text-base mb-3">
                      Manage eye encounters, visual acuity, refraction, OCT imaging, and follow-up cadences with structured tools.
                    </p>
                    <div className="flex flex-wrap gap-2 mb-3">
                      <span className="px-3 py-1 bg-white/20 rounded-full text-sm font-semibold text-white backdrop-blur-sm">
                        Visual Acuity Logs
                      </span>
                      <span className="px-3 py-1 bg-white/20 rounded-full text-sm font-semibold text-white backdrop-blur-sm">
                        Refraction Records
                      </span>
                      <span className="px-3 py-1 bg-white/20 rounded-full text-sm font-semibold text-white backdrop-blur-sm">
                        OCT Imaging
                      </span>
                      <span className="px-3 py-1 bg-white/20 rounded-full text-sm font-semibold text-white backdrop-blur-sm">
                        Follow-Up Scheduling
                      </span>
                    </div>
                  </div>
                </div>
                <button
                  onClick={() => navigate(`/ehr/${tenantSlug}/doctor/ophthalmology`)}
                  className="px-6 py-3 bg-white text-sky-600 rounded-xl hover:bg-sky-50 font-bold text-lg shadow-lg hover:shadow-xl transition-all flex items-center gap-2 whitespace-nowrap"
                >
                  <Eye className="w-5 h-5" />
                  Open Ophthalmology Suite
                </button>
              </div>
            </div>
          </div>

          {/* Tab Navigation */}
          <div className="mb-8">
            <div className="bg-white/80 backdrop-blur-sm rounded-2xl border border-slate-200/60 p-2 shadow-sm sticky top-16 z-20">
              <nav className="grid grid-cols-1 sm:grid-cols-5 gap-2">
                <button
                  onClick={() => setActiveTab('dashboard')}
                  className={`group flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-sm font-semibold transition-all ${
                    activeTab === 'dashboard'
                      ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow'
                      : 'bg-white text-slate-700 border border-slate-200 hover:border-indigo-200 hover:text-indigo-700'
                  }`}
                >
                  <BarChart3 className={`w-4 h-4 ${activeTab === 'dashboard' ? 'text-white' : 'text-slate-500 group-hover:text-indigo-600'}`} />
                  <span>Dashboard</span>
                </button>
                <button
                  onClick={() => setActiveTab('queue')}
                  className={`group flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-sm font-semibold transition-all ${
                    activeTab === 'queue'
                      ? 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow'
                      : 'bg-white text-slate-700 border border-slate-200 hover:border-emerald-200 hover:text-emerald-700'
                  }`}
                >
                  <Users className={`w-4 h-4 ${activeTab === 'queue' ? 'text-white' : 'text-slate-500 group-hover:text-emerald-600'}`} />
                  <span>Patient Queue</span>
                </button>
                <button
                  onClick={() => setActiveTab('schedule')}
                  className={`group flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-sm font-semibold transition-all ${
                    activeTab === 'schedule'
                      ? 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow'
                      : 'bg-white text-slate-700 border border-slate-200 hover:border-purple-200 hover:text-purple-700'
                  }`}
                >
                  <Calendar className={`w-4 h-4 ${activeTab === 'schedule' ? 'text-white' : 'text-slate-500 group-hover:text-purple-600'}`} />
                  <span>Schedule View</span>
                </button>
                <button
                  onClick={() => setActiveTab('current-appointment')}
                  className={`group flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-sm font-semibold transition-all ${
                    activeTab === 'current-appointment'
                      ? 'bg-gradient-to-r from-sky-600 to-cyan-600 text-white shadow'
                      : 'bg-white text-slate-700 border border-slate-200 hover:border-sky-200 hover:text-sky-700'
                  }`}
              >
                <FileText className={`w-4 h-4 ${activeTab === 'current-appointment' ? 'text-white' : 'text-slate-500 group-hover:text-sky-600'}`} />
                <span>Current Appointment</span>
              </button>
              <button
                  onClick={() => setActiveTab('critical-alerts')}
                  className={`group relative flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-sm font-semibold transition-all ${
                    activeTab === 'critical-alerts'
                      ? 'bg-gradient-to-r from-red-600 to-rose-600 text-white shadow'
                      : 'bg-white text-slate-700 border border-slate-200 hover:border-red-200 hover:text-red-700'
                  }`}
                >
                  <AlertTriangle className={`w-4 h-4 ${activeTab === 'critical-alerts' ? 'text-white' : 'text-slate-500 group-hover:text-red-600'}`} />
                  <span>Critical Alerts</span>
                  {criticalAlertCount > 0 && (
                    <span className="absolute -top-1 -right-1 bg-red-600 text-white text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center animate-pulse">
                      {criticalAlertCount}
                    </span>
                  )}
                </button>
              </nav>
            </div>
          </div>

          {/* Tab Content */}
          {activeTab === 'dashboard' && (
            <div className="space-y-8">
              {/* Smart Task Hub */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2 bg-white/70 backdrop-blur-sm rounded-2xl border border-slate-200/50 p-6">
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="text-xl font-bold text-slate-900">Today</h2>
                    <button onClick={() => { fetchTodayAppointments(); fetchAuthorizedOrders(); }} className="p-2 hover:bg-slate-100 rounded-lg transition-colors">
                      <RefreshCw className="w-4 h-4 text-slate-600" />
                    </button>
                  </div>
                  <div className="space-y-3">
                    {/* Critical Alerts - URGENT PRIORITY */}
                    {criticalAlertCount > 0 && (
                      <div 
                        onClick={() => setActiveTab('critical-alerts')}
                        className="p-3 border-2 border-red-500 bg-red-50 rounded-lg flex items-center justify-between cursor-pointer hover:bg-red-100 transition-colors animate-pulse"
                      >
                        <div className="flex items-center gap-2">
                          <AlertTriangle className="w-5 h-5 text-red-600" />
                          <div className="text-sm font-bold text-red-900">🚨 CRITICAL LAB RESULTS PENDING</div>
                        </div>
                        <span className="text-xs px-3 py-1 rounded-full bg-red-600 text-white font-bold">{criticalAlertCount}</span>
                      </div>
                    )}
                    
                    {/* Tasks: results to review, notes to finalize, messages could be wired later */}
                    <div className="p-3 border border-slate-200 rounded-lg flex items-center justify-between">
                      <div className="text-sm text-slate-700">Authorized orders awaiting nursing execution</div>
                      <span className="text-xs px-2 py-1 rounded bg-blue-100 text-blue-800">{authorizedOrders.length}</span>
                    </div>
                    <div className="p-3 border border-slate-200 rounded-lg flex items-center justify-between">
                      <div className="text-sm text-slate-700">Appointments in progress</div>
                      <span className="text-xs px-2 py-1 rounded bg-emerald-100 text-emerald-800">{getCurrentAppointments().length}</span>
                    </div>
                    <div className="p-3 border border-slate-200 rounded-lg flex items-center justify-between">
                      <div className="text-sm text-slate-700">Patients checked-in and waiting</div>
                      <span className="text-xs px-2 py-1 rounded bg-amber-100 text-amber-800">{appointments.filter(a => a.status === 'confirmed').length}</span>
                    </div>
                  </div>
                </div>

                {/* Vitals snapshot */}
                <div className="bg-white/70 backdrop-blur-sm rounded-2xl border border-slate-200/50 p-6">
                  <h3 className="text-lg font-bold text-slate-900 mb-4">Latest Vitals</h3>
                  {appointments.slice(0, 5).map((apt) => {
                    const list = vitalsData[apt.patient.id] || [];
                    const latest = list[0];
                    return (
                      <div key={apt.id} className="mb-3 p-3 rounded-lg border border-slate-200">
                        <div className="flex items-center justify-between mb-2">
                          <div className="font-medium text-slate-900 truncate">{apt.patient.firstName} {apt.patient.lastName}</div>
                          <div className="text-xs text-slate-500">{latest ? new Date(latest.recordedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'No vitals'}</div>
                        </div>
                        <div className="flex flex-wrap gap-2 text-xs">
                          <span className="px-2 py-1 rounded bg-slate-100 text-slate-800">BP: {latest?.bloodPressure || '-'}</span>
                          <span className="px-2 py-1 rounded bg-slate-100 text-slate-800">HR: {latest?.heartRate ?? '-'}</span>
                          <span className="px-2 py-1 rounded bg-slate-100 text-slate-800">Temp: {latest?.temperature ?? '-'}</span>
                          <span className="px-2 py-1 rounded bg-slate-100 text-slate-800">SpO2: {latest?.oxygenSaturation ?? '-'}</span>
                        </div>
                      </div>
                    );
                  })}
                  {appointments.length === 0 && (
                    <p className="text-sm text-slate-500">No patients today.</p>
                  )}
                </div>
              </div>
              {/* Current Appointment moved to its own tab */}

              <DoctorImagingResultsPanel
                tenantSlug={tenantSlug!}
                token={localStorage.getItem('ehr_token') || ''}
                statusFilter="awaiting_ack"
                hideTabs
                compact
                title="Imaging Reports Awaiting Review"
                onOpenStudy={openImagingStudy}
              />
              
              {/* Orders & Medication - side by side */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Orders Lifecycle */}
                <div className="bg-white/70 backdrop-blur-sm rounded-2xl border border-slate-200/50 p-6">
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="text-xl font-bold text-slate-900">Orders Lifecycle</h2>
                    <button onClick={fetchAuthorizedOrders} className="p-2 hover:bg-slate-100 rounded-lg transition-colors">
                      <RefreshCw className="w-4 h-4 text-slate-600" />
                    </button>
                  </div>
                  {authorizedOrders.length === 0 ? (
                    <p className="text-slate-500">No authorized orders awaiting execution.</p>
                  ) : (
                    <>
                      <div className="space-y-3 max-h-96 overflow-y-auto">
                        {(showAllOrders ? authorizedOrders : authorizedOrders.slice(0, 5)).map((o) => (
                          <div key={o.id} className="p-4 border border-slate-200 rounded-lg flex items-center justify-between">
                            <div>
                              <div className="font-semibold text-slate-900">{o.orderName}</div>
                              <div className="text-xs text-slate-600">{o.orderType} • Priority: {o.priority}</div>
                            </div>
                            <span className="text-xs px-2 py-1 rounded bg-blue-100 text-blue-800">Authorized</span>
                          </div>
                        ))}
                      </div>
                      {authorizedOrders.length > 5 && (
                        <button
                          onClick={() => setShowAllOrders(!showAllOrders)}
                          className="mt-3 w-full text-sm text-blue-600 hover:text-blue-800 font-medium flex items-center justify-center gap-2 py-2 hover:bg-blue-50 rounded-lg transition-colors"
                        >
                          {showAllOrders ? (
                            <>
                              <span>Show Less</span>
                              <ArrowLeft className="w-4 h-4 rotate-90" />
                            </>
                          ) : (
                            <>
                              <span>Show {authorizedOrders.length - 5} More</span>
                              <ArrowLeft className="w-4 h-4 -rotate-90" />
                            </>
                          )}
                        </button>
                      )}
                    </>
                  )}
                </div>

                {/* Medication Safety (basic) */}
                <div className="bg-white/70 backdrop-blur-sm rounded-2xl border border-slate-200/50 p-6">
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="text-xl font-bold text-slate-900">Medication Safety</h2>
                    <button onClick={() => { fetchAuthorizedOrders(); }} className="p-2 hover:bg-slate-100 rounded-lg transition-colors">
                      <RefreshCw className="w-4 h-4 text-slate-600" />
                    </button>
                  </div>
                  <div className="text-sm text-slate-700 mb-3">Active medication orders today</div>
                  {(() => {
                    const medications = authorizedOrders.filter(o => o.orderType === 'medication');
                    return medications.length === 0 ? (
                      <p className="text-slate-500">No medication orders found.</p>
                    ) : (
                      <>
                        <div className="space-y-3 max-h-96 overflow-y-auto">
                          {(showAllMedications ? medications : medications.slice(0, 5)).map((m) => (
                            <div key={m.id} className="p-4 border border-slate-200 rounded-lg">
                              <div className="flex items-center justify-between">
                                <div>
                                  <div className="font-semibold text-slate-900">{m.orderName}</div>
                                  <div className="text-xs text-slate-600">Dosage: {m.dosage || '-'} • Freq: {m.frequency || '-'}</div>
                                </div>
                                <span className="text-xs px-2 py-1 rounded bg-emerald-100 text-emerald-800">OK</span>
                              </div>
                            </div>
                          ))}
                        </div>
                        {medications.length > 5 && (
                          <button
                            onClick={() => setShowAllMedications(!showAllMedications)}
                            className="mt-3 w-full text-sm text-emerald-600 hover:text-emerald-800 font-medium flex items-center justify-center gap-2 py-2 hover:bg-emerald-50 rounded-lg transition-colors"
                          >
                            {showAllMedications ? (
                              <>
                                <span>Show Less</span>
                                <ArrowLeft className="w-4 h-4 rotate-90" />
                              </>
                            ) : (
                              <>
                                <span>Show {medications.length - 5} More</span>
                                <ArrowLeft className="w-4 h-4 -rotate-90" />
                              </>
                            )}
                          </button>
                        )}
                      </>
                    );
                  })()}
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
                        <button onClick={() => setShowClinicalNotesModal(true)} className="px-3 py-2 bg-white/20 hover:bg-white/30 rounded-lg transition-colors flex items-center gap-2 text-sm backdrop-blur-sm">
                          <FileText className="w-4 h-4" />
                          Notes
                        </button>
                        <button onClick={() => setShowPrescriptionsModal(true)} className="px-3 py-2 bg-white/20 hover:bg-white/30 rounded-lg transition-colors flex items-center gap-2 text-sm backdrop-blur-sm">
                          <Pill className="w-4 h-4" />
                          Rx
                        </button>
                        <button onClick={() => setShowEnhancedLabOrderModal(true)} className="px-3 py-2 bg-gradient-to-r from-blue-500 to-indigo-500 hover:from-blue-600 hover:to-indigo-600 rounded-lg transition-colors flex items-center gap-2 text-sm text-white shadow-md">
                          <TestTube className="w-4 h-4" />
                          Order Labs
                        </button>
                        <button onClick={() => setShowImagingOrderModal(true)} className="px-3 py-2 bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 rounded-lg transition-colors flex items-center gap-2 text-sm text-white shadow-md">
                          <Camera className="w-4 h-4" />
                          🆕 Order Imaging
                        </button>
                        <button onClick={() => setShowLabResultsModal(true)} className="px-3 py-2 bg-white/20 hover:bg-white/30 rounded-lg transition-colors flex items-center gap-2 text-sm backdrop-blur-sm">
                          <TestTube className="w-4 h-4" />
                          Lab Results
                        </button>
                        <button onClick={() => setShowResultComparisonModal(true)} className="px-3 py-2 bg-gradient-to-r from-teal-500 to-cyan-500 hover:from-teal-600 hover:to-cyan-600 rounded-lg transition-colors flex items-center gap-2 text-sm text-white shadow-md">
                          <TrendingUp className="w-4 h-4" />
                          🆕 Result Trends
                        </button>
                        <button onClick={() => setShowVitalsModal(true)} className="px-3 py-2 bg-white/20 hover:bg-white/30 rounded-lg transition-colors flex items-center gap-2 text-sm backdrop-blur-sm">
                          <Activity className="w-4 h-4" />
                          Vitals
                        </button>
                        <button onClick={() => setShowProblemsModal(true)} className="px-3 py-2 bg-white/20 hover:bg-white/30 rounded-lg transition-colors flex items-center gap-2 text-sm backdrop-blur-sm">
                          <Stethoscope className="w-4 h-4" />
                          Problems
                        </button>
                        <button onClick={() => setShowAllergiesModal(true)} className="px-3 py-2 bg-white/20 hover:bg-white/30 rounded-lg transition-colors flex items-center gap-2 text-sm backdrop-blur-sm">
                          <AlertTriangle className="w-4 h-4" />
                          Allergies
                        </button>
                        <button onClick={() => { setCurrentReferralAppointment(currentAppointment); setShowReferralModal(true); }} className="px-3 py-2 bg-white/20 hover:bg-white/30 rounded-lg transition-colors flex items-center gap-2 text-sm backdrop-blur-sm">
                          <Stethoscope className="w-4 h-4" />
                          Refer
                        </button>
                        <button onClick={() => handleAppointmentAction(currentAppointment.id, 'complete')} className="px-4 py-2 bg-green-500 hover:bg-green-600 rounded-lg transition-colors flex items-center gap-2 text-sm font-medium">
                          <CheckCircle className="w-4 h-4" />
                          Complete
                        </button>
                      </div>
                    </div>
                  </div>

                  <DoctorImagingResultsPanel
                    tenantSlug={tenantSlug!}
                    token={localStorage.getItem('ehr_token') || ''}
                    patientId={currentAppointment.patient.id}
                    hideTabs
                    compact
                    title="This Patient's Imaging Timeline"
                    onOpenStudy={openImagingStudy}
                  />

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
                        <button onClick={()=>setShowAllergiesModal(true)} className="text-xs text-rose-600 hover:text-rose-800 font-medium">Manage</button>
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
                    Refer Patient to Nurse
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
        <AdvancedResultComparison
          patientId={currentAppointment.patient.id}
          patientName={`${currentAppointment.patient.firstName} ${currentAppointment.patient.lastName}`}
          tenantSlug={tenantSlug!}
          token={localStorage.getItem('ehr_token') || ''}
          onClose={() => setShowResultComparisonModal(false)}
        />
      )}
    </div>
  );
};

export default DoctorDashboard;