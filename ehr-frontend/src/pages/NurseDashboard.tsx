import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import {
  Users, Calendar, Activity, Heart, Thermometer, Droplets, 
  Eye, Stethoscope, FileText, Clock, AlertTriangle, CheckCircle,
  Plus, Search, Filter, RefreshCw, Bell, User, LogOut,
  TrendingUp, BarChart3, Pill, TestTube, ClipboardList, 
  ChevronDown, Settings, Shield, UserCircle, Menu, X, Package,
  CreditCard, Lock, Share2, FolderOpen, Target, LayoutDashboard,
  Bed, AlertCircle
} from 'lucide-react';
import { ehrApi } from '../services/api';
import CreatePatientModal from '../components/CreatePatientModal';
import CreateAppointmentModal from '../components/CreateAppointmentModal';
import { useNotification } from '../components/GlobalNotification';
import { formatDateToDDMMYYYY, formatDateTimeToDDMMYYYYHHMM } from '../utils/dateFormatting';
import VitalsPanel from '../components/VitalsPanel';
import TriageQueue from '../components/TriageQueue';
import PatientAssessment from '../components/PatientAssessment';
import NursingNotes from '../components/NursingNotes';
import TaskManagement from '../components/TaskManagement';
import PatientSafetyAlerts from '../components/PatientSafetyAlerts';
import HIVNursePanel from '../components/HIVNursePanel';
import HIVTestingComponent from '../components/HIVTestingComponent';
import HIVPatientManagement from '../components/HIVPatientManagement';
import TBScreeningComponent from '../components/TBScreeningComponent';
import CervicalCancerScreeningComponent from '../components/CervicalCancerScreeningComponent';
import HIVQualityMetricsChart from '../components/HIVQualityMetricsChart';
import HIVStockManagement from '../components/HIVStockManagement';
import HIVMonthlyReturnForm from '../components/HIVMonthlyReturnForm';
import MaternityDashboard from '../components/MaternityDashboard';
import SharedDocumentsList from '../components/SharedDocumentsList';
import PatientCarePlansView from '../components/PatientCarePlansView';
import LabResultsViewer from '../components/LabResultsViewer';

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
  const { showSuccess, showError } = useNotification();

  const [currentUser, setCurrentUser] = useState<any>(null);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [activeSection, setActiveSection] = useState<'main' | 'hiv' | 'maternity'>('main');
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
  const [showMobileMenu, setShowMobileMenu] = useState(false);
  const [calendarView, setCalendarView] = useState<'day' | 'week' | 'month'>('day');
  const [calendarDate, setCalendarDate] = useState<Date>(new Date());
  const [draggingAppointmentId, setDraggingAppointmentId] = useState<string | null>(null);
  const [authorizedOrders, setAuthorizedOrders] = useState<any[]>([]);
  const [taskCounts, setTaskCounts] = useState({ pending: 0, inProgress: 0, overdue: 0 });
  const [alertCounts, setAlertCounts] = useState({ active: 0, critical: 0, high: 0 });
  const [showExecuteOrderModal, setShowExecuteOrderModal] = useState(false);
  const [executingOrderId, setExecutingOrderId] = useState<string | null>(null);
  const [executionNotes, setExecutionNotes] = useState<string>('');
  const [showHivModal, setShowHivModal] = useState(false);
  const [currentAppointment, setCurrentAppointment] = useState<Appointment | null>(null);
  const [showHivTestingModal, setShowHivTestingModal] = useState(false);
  const [qualityMetrics, setQualityMetrics] = useState<any>(null);
  const [ltfuPatients, setLtfuPatients] = useState<any[]>([]);
  const [showSharedDocumentsModal, setShowSharedDocumentsModal] = useState(false);
  const [sharedDocumentsCount, setSharedDocumentsCount] = useState(0);
  const [showCarePlansModal, setShowCarePlansModal] = useState(false);
  const [carePlansPatientId, setCarePlansPatientId] = useState<string | null>(null);
  const [carePlansPatientName, setCarePlansPatientName] = useState<string>('');
  
  const [showLabResultsModal, setShowLabResultsModal] = useState(false);
  const [labResultsPatientId, setLabResultsPatientId] = useState<string | null>(null);
  const [labResultsPatientName, setLabResultsPatientName] = useState<string>('');
  const [ltfuDays, setLtfuDays] = useState(90);
  const [calendarAppointments, setCalendarAppointments] = useState<Appointment[]>([]);
  const [calendarLoading, setCalendarLoading] = useState(false);
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

  // Calculate task counts from appointments directly
  const calculateTaskCountsFromAppointments = useCallback((appointments: any[]) => {
    if (!Array.isArray(appointments)) {
      setTaskCounts({ pending: 0, inProgress: 0, overdue: 0 });
      return;
    }

    const now = new Date();
    let pending = 0;
    let inProgress = 0;
    let overdue = 0;

    appointments.forEach((apt) => {
      const appointmentTime = new Date(apt.appointmentDate);
      
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
      console.warn('calculateTaskCounts received non-array:', tasks);
      setTaskCounts({ pending: 0, inProgress: 0, overdue: 0 });
      return;
    }
    
    const pending = tasks.filter(task => task.status === 'pending').length;
    const inProgress = tasks.filter(task => task.status === 'in_progress').length;
    const overdue = tasks.filter(task => task.status === 'overdue').length;
    setTaskCounts({ pending, inProgress, overdue });
  }, []);

  // Calculate alert counts (for component callbacks)
  const calculateAlertCounts = useCallback((alerts: any[]) => {
    if (!Array.isArray(alerts)) {
      console.warn('calculateAlertCounts received non-array:', alerts);
      setAlertCounts({ active: 0, critical: 0, high: 0 });
      return;
    }
    
    const active = alerts.filter(alert => alert.isActive).length;
    const critical = alerts.filter(alert => alert.severity === 'critical' && alert.isActive).length;
    const high = alerts.filter(alert => alert.severity === 'high' && alert.isActive).length;
    setAlertCounts({ active, critical, high });
  }, []);

  useEffect(() => {
    const user = JSON.parse(localStorage.getItem('ehr_user') || '{}');
    setCurrentUser(user);
  }, []);

  // Calculate counts immediately when appointments are loaded
  useEffect(() => {
    if (appointments.length > 0) {
      calculateTaskCountsFromAppointments(appointments);
      calculateAlertCountsFromAppointments(appointments);
    } else {
      setTaskCounts({ pending: 0, inProgress: 0, overdue: 0 });
      setAlertCounts({ active: 0, critical: 0, high: 0 });
    }
  }, [appointments, calculateTaskCountsFromAppointments, calculateAlertCountsFromAppointments]);

  useEffect(() => {
    if (currentUser) {
      fetchTodayAppointments();
      fetchPatients();
      fetchAuthorizedOrders();
    }
  }, [currentUser, tenantSlug]);

  // Close dropdowns when clicking outside
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
      } catch (error) {
        console.error('Error loading shared documents count:', error);
      }
    };

    if (tenantSlug) {
      loadSharedCount();
      // Refresh count every 2 minutes
      const interval = setInterval(loadSharedCount, 120000);
      return () => clearInterval(interval);
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
    else setActiveTab('calendar');
  }, [location.pathname]);

  // Load Quality Metrics and LTFU when in HIV section
  useEffect(() => {
    if (activeSection === 'hiv' && (activeTab === 'quality-metrics' || activeTab === 'ltfu' || activeTab === 'monthly-return')) {
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
        } catch (error) {
          console.error('Failed to load metrics:', error);
        }
      };

      loadMetrics();
    }
  }, [activeSection, activeTab, tenantSlug, ltfuDays]);

  const fetchAuthorizedOrders = async () => {
    try {
      const token = localStorage.getItem('ehr_token');
      const activeTenant = resolveTenantSlug();
      if (!token || !activeTenant) {
        console.warn('fetchAuthorizedOrders skipped - missing token or tenant slug');
        return;
      }

      const response = await ehrApi.getAuthorizedOrders(token, activeTenant);
      setAuthorizedOrders(response.data.orders || []);
      console.log('🔍 NurseDashboard - Fetched authorized orders:', response.data.orders);
    } catch (error: any) {
      // Handle 500 error gracefully - likely means no orders exist yet
      if (error?.response?.status === 500) {
        console.log('🔍 NurseDashboard - No authorized orders found (500 error - likely no orders exist yet)');
        setAuthorizedOrders([]);
      } else {
        console.error('Error fetching authorized orders:', error);
        setAuthorizedOrders([]);
      }
    }
  };

  const fetchVitalsForAppointments = async (appointments: Appointment[]) => {
    try {
      const token = localStorage.getItem('ehr_token');
      const activeTenant = resolveTenantSlug();
      if (!token || !activeTenant) {
        console.warn('fetchVitalsForAppointments skipped - missing token or tenant slug');
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
            console.log(`No vitals found for patient ${appointment.patient.id}:`, error);
            return {
              ...appointment,
              vitals: null
            };
          }
        })
      );

      return appointmentsWithVitals;
    } catch (error) {
      console.error('Error fetching vitals for appointments:', error);
      return appointments;
    }
  };

  const fetchTodayAppointments = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('ehr_token');
      const activeTenant = resolveTenantSlug();
      if (!token || !activeTenant) {
        console.warn('fetchTodayAppointments skipped - missing token or tenant slug');
        return;
      }

      const today = new Date();
      const todayString = today.toISOString().split('T')[0];
      console.log('🔍 Fetching appointments for date:', todayString);
      console.log('🔍 Today object:', today);
      console.log('🔍 Today timezone offset:', today.getTimezoneOffset());
      
      const response = await ehrApi.getAppointments(token, activeTenant, { date: todayString });
      console.log('📅 Raw appointments response:', response.data);
      console.log('📊 Total appointments:', response.data.appointments?.length || 0);

      // Show ALL appointments for today - nurses need to see everything
      let allAppointments = response.data.appointments || [];
      console.log('👩‍⚕️ Setting appointments for nurse:', allAppointments);
      
      // If no appointments for today, let's also check yesterday and day before
      if (allAppointments.length === 0) {
        console.log('📅 No appointments for today, checking recent days...');
        try {
          const yesterday = new Date(today);
          yesterday.setDate(yesterday.getDate() - 1);
          const yesterdayString = yesterday.toISOString().split('T')[0];
          
          const dayBefore = new Date(today);
          dayBefore.setDate(dayBefore.getDate() - 2);
          const dayBeforeString = dayBefore.toISOString().split('T')[0];
          
          console.log('🔍 Also checking yesterday:', yesterdayString);
          console.log('🔍 And day before:', dayBeforeString);
          
          // Fetch appointments for yesterday and day before
          const [yesterdayResponse, dayBeforeResponse] = await Promise.all([
            ehrApi.getAppointments(token, activeTenant, { date: yesterdayString }),
            ehrApi.getAppointments(token, activeTenant, { date: dayBeforeString }),
          ]);
          
          const recentAppointments = [
            ...(yesterdayResponse.data.appointments || []),
            ...(dayBeforeResponse.data.appointments || [])
          ];
          
          console.log('📅 Recent appointments found:', recentAppointments.length);
          
          // Fetch vitals for recent appointments
          const appointmentsWithVitals = await fetchVitalsForAppointments(recentAppointments);
          setAppointments(appointmentsWithVitals);
        } catch (error) {
          console.error('Error fetching recent appointments:', error);
          // Fetch vitals for today's appointments as fallback
          const appointmentsWithVitals = await fetchVitalsForAppointments(allAppointments);
          setAppointments(appointmentsWithVitals);
        }
      } else {
        // Fetch vitals for today's appointments
        const appointmentsWithVitals = await fetchVitalsForAppointments(allAppointments);
        setAppointments(appointmentsWithVitals);
      }
    } catch (error) {
      console.error('Error fetching appointments:', error);
      showError('Error', 'Failed to fetch appointments');
    } finally {
      setLoading(false);
    }
  };

  const getQueueStats = () => {
    const waiting = appointments.filter(apt => apt.status === 'scheduled' || apt.status === 'confirmed').length;
    const inProgress = appointments.filter(apt => apt.status === 'in-progress').length;
    const completed = appointments.filter(apt => apt.status === 'completed').length;
    const urgent = appointments.filter(apt => apt.priorityLevel === 'urgent' || apt.priorityLevel === 'high').length;
    const vitalsRecorded = appointments.filter(apt => apt.vitals !== null && apt.vitals !== undefined).length;
    const awaitingPayment = appointments.filter(apt => apt.paymentStatus === 'awaiting_payment').length;

    return { waiting, inProgress, completed, urgent, vitalsRecorded, awaitingPayment };
  };

  const getNurseActions = () => {
    return [
      { icon: Activity, label: 'My Tasks', desc: 'Epic-style task management', color: 'from-indigo-500 to-purple-600', action: () => setActiveTab('tasks') },
      { icon: Calendar, label: 'Today\'s Schedule', desc: 'View today\'s appointments', color: 'from-blue-500 to-cyan-500', action: () => setActiveTab('calendar') },
      { icon: AlertCircle, label: 'Emergency Dept', desc: 'ED tracking board & triage', color: 'from-red-500 to-orange-600', action: () => navigate(`/ehr/${tenantSlug}/emergency`) },
      { icon: Bed, label: 'Bed Management', desc: 'Hospital-wide bed status & ADT', color: 'from-blue-600 to-cyan-600', action: () => navigate(`/ehr/${tenantSlug}/bed-management`) },
      { icon: Users, label: 'Patients', desc: 'Browse & schedule', color: 'from-blue-500 to-cyan-500', action: () => setActiveTab('patients') },
      { icon: Users, label: 'Patient Queue', desc: 'Manage patient flow', color: 'from-indigo-500 to-purple-500', action: () => setActiveTab('queue') },
      { icon: Heart, label: 'Vitals Recording', desc: 'Record patient vitals', color: 'from-red-500 to-pink-500', action: () => setActiveTab('vitals') },
      { icon: ClipboardList, label: 'Triage Assessment', desc: 'Patient assessment', color: 'from-orange-500 to-yellow-500', action: () => setActiveTab('triage') },
      { icon: FileText, label: 'Nursing Notes', desc: 'Document care provided', color: 'from-green-500 to-emerald-500', action: () => setActiveTab('notes') },
      { icon: TestTube, label: 'HIV Testing', desc: 'Perform HIV test', color: 'from-emerald-600 to-teal-700', action: () => setShowHivTestingModal(true) },
      { icon: FolderOpen, label: 'Shared Documents', desc: 'View shared patient documents', color: 'from-violet-500 to-purple-600', action: () => setShowSharedDocumentsModal(true), badge: sharedDocumentsCount > 0 ? sharedDocumentsCount : undefined },
    ];
  };

  const queueStats = getQueueStats();

  const quickStats = [
    { label: 'Patients Waiting', value: queueStats.waiting.toString(), icon: Clock, color: 'text-blue-600' },
    { label: 'In Progress', value: queueStats.inProgress.toString(), icon: Activity, color: 'text-yellow-600' },
    { label: 'Vitals Recorded', value: queueStats.vitalsRecorded.toString(), icon: Heart, color: 'text-purple-600' },
    { label: 'Urgent Cases', value: queueStats.urgent.toString(), icon: AlertTriangle, color: 'text-red-600' },
    { label: 'Completed Today', value: queueStats.completed.toString(), icon: CheckCircle, color: 'text-green-600' },
    { label: 'Awaiting Payment', value: queueStats.awaitingPayment.toString(), icon: CreditCard, color: 'text-amber-600' },
  ];

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
    } catch (error) {
      console.error('Error executing order:', error);
      showError('Error', 'Failed to execute order');
    }
  };

  const handleLogout = () => {
    try {
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
    } catch (error) {
      console.error('Logout error:', error);
      showError('Logout Error', 'There was an issue logging out. Please try again.');
    }
  };

  const handleRecordVitals = (appointment: Appointment) => {
    if (appointment.paymentStatus === 'awaiting_payment') {
      notifyPaymentBlocked(appointment, 'Vitals cannot be recorded while payment is pending');
      return;
    }
    setSelectedPatient(appointment.patient);
    setShowVitalsModal(true);
  };

  const handleTriageAssessment = (appointment: Appointment) => {
    if (appointment.paymentStatus === 'awaiting_payment') {
      notifyPaymentBlocked(appointment, 'Triage assessment is locked until payment is confirmed');
      return;
    }
    setSelectedPatient(appointment.patient);
    setShowAssessmentModal(true);
  };

  const fetchPatients = async () => {
    try {
      const token = localStorage.getItem('ehr_token');
      const activeTenant = resolveTenantSlug();
      if (!token || !activeTenant) {
        console.warn('fetchPatients skipped - missing token or tenant slug');
        return;
      }
      const resp = await ehrApi.getPatients(token, activeTenant);
      setPatients(resp.data.patients || []);
    } catch (e) {
      console.error('Error fetching patients:', e);
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
    if (awaitingAppointment) {
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
    const lastDay = new Date(year, month + 1, 0);
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
    } catch (e) {
      console.error('Reschedule error', e);
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
                    <div className="mt-2 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-2 py-1 flex items-center gap-2">
                      <Lock className="w-3 h-3" />
                      Accounts must confirm payment before vitals or triage can begin.
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
        console.log('📅 Month view API response:', response.data);
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
              },
              doctor: {
                id: apt.doctor?.id || '',
                firstName: apt.doctor?.firstName || doctorFirstName,
                lastName: apt.doctor?.lastName || doctorLastNameParts.join(' ') || '',
              },
              vitals: null,
            };
            allAppointments.push(transformed);
          });
        });
        console.log('📅 Transformed appointments for month view:', allAppointments);
        fetchedAppointments = allAppointments;
      } else if (calendarView === 'week') {
        // Use enhanced week view API
        const weekStart = new Date(calendarDate);
        const dayOfWeek = weekStart.getDay();
        const diff = weekStart.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1);
        weekStart.setDate(diff);
        const weekStartString = weekStart.toISOString().split('T')[0];
        
        const response = await ehrApi.getWeekView(weekStartString, token, tenantSlug!);
        console.log('📅 Week view API response:', response.data);
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
              },
              doctor: {
                id: apt.doctor?.id || '',
                firstName: apt.doctor?.firstName || doctorFirstName,
                lastName: apt.doctor?.lastName || doctorLastNameParts.join(' ') || '',
              },
              vitals: null,
            };
            allAppointments.push(transformed);
          });
        });
        console.log('📅 Transformed appointments for week view:', allAppointments);
        fetchedAppointments = allAppointments;
      } else {
        // Day view - use existing API
        const dateStr = calendarDate.toISOString().split('T')[0];
        const response = await ehrApi.getAppointments(token, tenantSlug!, { date: dateStr });
        fetchedAppointments = response.data.appointments || [];
      }

      // Fetch vitals for appointments
      const appointmentsWithVitals = await fetchVitalsForAppointments(fetchedAppointments);
      setCalendarAppointments(appointmentsWithVitals);
    } catch (error) {
      console.error('Error fetching calendar appointments:', error);
      // Fallback to today's appointments
      setCalendarAppointments(appointments);
    } finally {
      setCalendarLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'calendar') {
      fetchCalendarAppointments();
    }
  }, [calendarDate, calendarView, activeTab]);

  const renderCalendar = () => {
    const today = new Date();
    // Use calendarAppointments for calendar view, appointments for day view
    const appointmentsToDisplay = calendarView === 'day' ? appointments : calendarAppointments;
    const dayAppointments = getAppointmentsForDate(calendarDate, appointmentsToDisplay);
    
    console.log('📅 Calendar render - View:', calendarView);
    console.log('📅 Calendar render - Total appointments:', appointmentsToDisplay.length);
    console.log('📅 Calendar render - Selected day appointments:', dayAppointments.length);

    return (
      <div className="space-y-6">
        {/* Today's Schedule Header */}
        <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl p-6 border border-blue-200/50">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold text-slate-900">
                {calendarView === 'day' ? "Today's Schedule" : 
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
    const getStatGradient = (label: string) => {
      switch (label) {
        case 'Patients Waiting': return 'from-blue-500 to-cyan-600';
        case 'In Progress': return 'from-yellow-500 to-orange-600';
        case 'Vitals Recorded': return 'from-purple-500 to-pink-600';
        case 'Urgent Cases': return 'from-red-500 to-rose-600';
        case 'Completed Today': return 'from-green-500 to-emerald-600';
        case 'Awaiting Payment': return 'from-amber-500 to-orange-600';
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
          
          <div className="grid grid-cols-3 lg:grid-cols-6 gap-2 sm:gap-3">
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

      {/* Quick Actions - Prominent Clickable Cards */}
      <div>
        <div className="flex items-center gap-2 mb-4">
          <Activity className="w-5 h-5 text-slate-600" />
          <h3 className="text-lg font-bold text-slate-900">Quick Actions</h3>
          <span className="text-xs text-slate-500 ml-auto">Click to navigate</span>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-6">
        {getNurseActions().map((action, index) => (
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
      {/* Slim Top Bar: system title + notifications + user */}
      <header className="bg-white/80 backdrop-blur-sm border-b border-slate-200/50 sticky top-0 z-30">
        <div className="w-full max-w-full mx-auto px-2 sm:px-4 lg:px-6">
          <div className="flex justify-between items-center h-14">
            {/* Left Section - System Title */}
            <div className="flex items-center space-x-4">
              <div className="flex-shrink-0">
                <div className="h-8 w-8 bg-gradient-to-r from-pink-500 to-rose-600 rounded-lg flex items-center justify-center shadow-lg">
                  <Stethoscope className="h-5 w-5 text-white" />
                </div>
              </div>
              <div className="hidden sm:block">
                <h1 className="text-lg font-bold text-slate-900">Nurse Dashboard</h1>
                <p className="text-xs text-slate-600">Patient Care Management</p>
              </div>
            </div>

            {/* Right Section - Notifications + User */}
            <div className="flex items-center space-x-3">
              {/* Refresh Button */}
              <button
                onClick={fetchTodayAppointments}
                disabled={loading}
                className="p-2 text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-all duration-200 disabled:opacity-50"
                title="Refresh Data"
              >
                <RefreshCw className={`h-5 w-5 ${loading ? 'animate-spin' : ''}`} />
              </button>

              {/* Notifications */}
              <button className="p-2 text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-all duration-200 relative">
                <Bell className="h-5 w-5" />
                {(taskCounts.pending + taskCounts.inProgress + taskCounts.overdue + alertCounts.active) > 0 && (
                  <span className={`absolute -top-1 -right-1 text-white text-xs font-bold rounded-full h-6 w-6 flex items-center justify-center shadow-lg transform scale-110 animate-pulse ${
                    alertCounts.critical > 0 
                      ? 'bg-gradient-to-r from-red-600 to-red-700' 
                      : alertCounts.high > 0 
                      ? 'bg-gradient-to-r from-orange-500 to-red-500'
                      : 'bg-gradient-to-r from-green-500 to-emerald-600'
                  }`}>
                    {taskCounts.pending + taskCounts.inProgress + taskCounts.overdue + alertCounts.active}
                  </span>
                )}
              </button>

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

      {/* Section Navigation Bar */}
      <div className="bg-gradient-to-r from-emerald-600 to-teal-700 border-b-2 border-emerald-800 shadow-lg overflow-x-auto">
        <div className="w-full max-w-full mx-auto px-2 sm:px-4 lg:px-6">
          <nav className="flex space-x-2 sm:space-x-4 lg:space-x-6 min-w-max">
            <button
              onClick={() => {
                setActiveSection('main');
                setActiveTab('dashboard');
              }}
              className={`py-3 px-4 border-b-2 font-bold text-sm transition-all duration-200 flex items-center gap-2 ${
                activeSection === 'main'
                  ? 'border-white text-white'
                  : 'border-transparent text-emerald-100 hover:text-white'
              }`}
            >
              <Stethoscope className="w-4 h-4" />
              Main Dashboard
            </button>
            <button
              onClick={() => {
                setActiveSection('hiv');
                setActiveTab('testing');
              }}
              className={`py-3 px-4 border-b-2 font-bold text-sm transition-all duration-200 flex items-center gap-2 ${
                activeSection === 'hiv'
                  ? 'border-white text-white'
                  : 'border-transparent text-emerald-100 hover:text-white'
              }`}
            >
              <Activity className="w-4 h-4" />
              HIV/AIDS/TB Program
            </button>
            <button
              onClick={() => {
                setActiveSection('maternity');
                setActiveTab('maternity');
              }}
              className={`py-3 px-4 border-b-2 font-bold text-sm transition-all duration-200 flex items-center gap-2 ${
                activeSection === 'maternity'
                  ? 'border-white text-white'
                  : 'border-transparent text-emerald-100 hover:text-white'
              }`}
            >
              <Heart className="w-4 h-4" />
              Maternity & Obstetrics
            </button>
          </nav>
        </div>
      </div>

      {/* Page Tabs (in-content) */}
      <div className="bg-white/80 backdrop-blur-sm border-b border-slate-200/50 overflow-x-auto">
        <div className="w-full max-w-full mx-auto px-2 sm:px-4 lg:px-6">
          {activeSection === 'main' ? (
            <nav className="flex space-x-4 sm:space-x-6 lg:space-x-8 min-w-max pb-px">
              <button
                onClick={() => setActiveTab('dashboard')}
                className={`py-3 sm:py-4 px-2 sm:px-3 lg:px-4 border-b-2 font-semibold text-xs sm:text-sm transition-all duration-200 relative whitespace-nowrap ${
                  activeTab === 'dashboard'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
                }`}
              >
                <LayoutDashboard className="w-4 h-4 inline mr-2" />
                Dashboard
              </button>
              <button
                onClick={() => setActiveTab('tasks')}
                className={`py-3 sm:py-4 px-2 sm:px-3 lg:px-4 border-b-2 font-semibold text-xs sm:text-sm transition-all duration-200 relative whitespace-nowrap ${
                  activeTab === 'tasks'
                    ? 'border-indigo-500 text-indigo-600'
                    : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
                }`}
              >
                <Activity className="w-4 h-4 inline mr-2" />
                My Tasks
                {(taskCounts.pending > 0 || taskCounts.inProgress > 0 || taskCounts.overdue > 0) && (
                  <span className="absolute -top-1 -right-1 bg-gradient-to-r from-green-500 to-emerald-600 text-white text-xs font-bold rounded-full h-6 w-6 flex items-center justify-center shadow-lg transform scale-110 animate-pulse">
                    {taskCounts.pending + taskCounts.inProgress + taskCounts.overdue}
                  </span>
                )}
              </button>
              <button
                onClick={() => setActiveTab('alerts')}
                className={`py-3 sm:py-4 px-2 sm:px-3 lg:px-4 border-b-2 font-semibold text-xs sm:text-sm transition-all duration-200 relative whitespace-nowrap ${
                  activeTab === 'alerts'
                    ? 'border-red-500 text-red-600'
                    : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
                }`}
              >
                <Bell className="w-4 h-4 inline mr-2" />
                Safety Alerts
                {alertCounts.active > 0 && (
                  <span className={`absolute -top-1 -right-1 text-white text-xs font-bold rounded-full h-6 w-6 flex items-center justify-center shadow-lg transform scale-110 animate-pulse ${
                    alertCounts.critical > 0 
                      ? 'bg-gradient-to-r from-red-600 to-red-700' 
                      : alertCounts.high > 0 
                      ? 'bg-gradient-to-r from-orange-500 to-red-500'
                      : 'bg-gradient-to-r from-yellow-500 to-orange-500'
                  }`}>
                    {alertCounts.active}
                  </span>
                )}
              </button>
              <button
                onClick={() => setActiveTab('calendar')}
                className={`py-4 px-1 border-b-2 font-semibold text-sm transition-all duration-200 ${
                  activeTab === 'calendar'
                    ? 'border-pink-500 text-pink-600'
                    : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
                }`}
              >
                <Calendar className="w-4 h-4 inline mr-2" />
                Today's Schedule
              </button>
              <button
                onClick={() => setActiveTab('patients')}
                className={`py-4 px-1 border-b-2 font-semibold text-sm transition-all duration-200 ${
                  activeTab === 'patients'
                    ? 'border-pink-500 text-pink-600'
                    : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
                }`}
              >
                <Users className="w-4 h-4 inline mr-2" />
                Patients
              </button>
              <button
                onClick={() => setActiveTab('queue')}
                className={`py-4 px-1 border-b-2 font-semibold text-sm transition-all duration-200 ${
                  activeTab === 'queue'
                    ? 'border-pink-500 text-pink-600'
                    : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
                }`}
              >
                <Activity className="w-4 h-4 inline mr-2" />
                Patient Queue
              </button>
              <button
                onClick={() => setActiveTab('orders')}
                className={`py-4 px-1 border-b-2 font-semibold text-sm transition-all duration-200 ${
                  activeTab === 'orders'
                    ? 'border-pink-500 text-pink-600'
                    : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
                }`}
              >
                <ClipboardList className="w-4 h-4 inline mr-2" />
                Orders & Procedures
              </button>
              <button
                onClick={() => setActiveTab('notes')}
                className={`py-4 px-1 border-b-2 font-semibold text-sm transition-all duration-200 ${
                  activeTab === 'notes'
                    ? 'border-pink-500 text-pink-600'
                    : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
                }`}
              >
                <FileText className="w-4 h-4 inline mr-2" />
                Nursing Notes
              </button>
            </nav>
          ) : activeSection === 'hiv' ? (
            <nav className="flex space-x-4 sm:space-x-6 lg:space-x-8 min-w-max pb-px" aria-label="HIV Tabs">
              <button
                onClick={() => setActiveTab('testing')}
                className={`py-4 px-1 border-b-2 font-semibold text-sm transition-all duration-200 ${
                  activeTab === 'testing'
                    ? 'border-emerald-500 text-emerald-600'
                    : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
                }`}
              >
                <TestTube className="w-4 h-4 inline mr-2" />
                HIV Testing
              </button>
              <button
                onClick={() => setActiveTab('hiv-patients')}
                className={`py-4 px-1 border-b-2 font-semibold text-sm transition-all duration-200 ${
                  activeTab === 'hiv-patients'
                    ? 'border-emerald-500 text-emerald-600'
                    : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
                }`}
              >
                <Users className="w-4 h-4 inline mr-2" />
                Patients on Care
              </button>
              <button
                onClick={() => setActiveTab('tb-screening')}
                className={`py-4 px-1 border-b-2 font-semibold text-sm transition-all duration-200 ${
                  activeTab === 'tb-screening'
                    ? 'border-emerald-500 text-emerald-600'
                    : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
                }`}
              >
                <Stethoscope className="w-4 h-4 inline mr-2" />
                TB Screening
              </button>
              <button
                onClick={() => setActiveTab('cervical-cancer')}
                className={`py-4 px-1 border-b-2 font-semibold text-sm transition-all duration-200 ${
                  activeTab === 'cervical-cancer'
                    ? 'border-emerald-500 text-emerald-600'
                    : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
                }`}
              >
                <Activity className="w-4 h-4 inline mr-2" />
                Cervical Cancer Screening
              </button>
              <button
                onClick={() => setActiveTab('quality-metrics')}
                className={`py-4 px-1 border-b-2 font-semibold text-sm transition-all duration-200 ${
                  activeTab === 'quality-metrics'
                    ? 'border-emerald-500 text-emerald-600'
                    : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
                }`}
              >
                <BarChart3 className="w-4 h-4 inline mr-2" />
                Quality Metrics
              </button>
              <button
                onClick={() => setActiveTab('stock-management')}
                className={`py-4 px-1 border-b-2 font-semibold text-sm transition-all duration-200 ${
                  activeTab === 'stock-management'
                    ? 'border-emerald-500 text-emerald-600'
                    : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
                }`}
              >
                <Package className="w-4 h-4 inline mr-2" />
                Stock Management
              </button>
              <button
                onClick={() => setActiveTab('ltfu')}
                className={`py-4 px-1 border-b-2 font-semibold text-sm transition-all duration-200 ${
                  activeTab === 'ltfu'
                    ? 'border-emerald-500 text-emerald-600'
                    : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
                }`}
              >
                <Clock className="w-4 h-4 inline mr-2" />
                LTFU Management
              </button>
              <button
                onClick={() => setActiveTab('monthly-return')}
                className={`py-4 px-1 border-b-2 font-semibold text-sm transition-all duration-200 ${
                  activeTab === 'monthly-return'
                    ? 'border-emerald-500 text-emerald-600'
                    : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
                }`}
              >
                <FileText className="w-4 h-4 inline mr-2" />
                Monthly Return
              </button>
            </nav>
          ) : (
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 py-4">
              <div className="flex items-center gap-3 text-white">
                <div className="p-2 bg-white/20 rounded-lg">
                  <Heart className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-sm uppercase text-white/80 tracking-wide">Maternity & Obstetrics Workspace</p>
                  <p className="text-base font-semibold">Monitor high-risk pregnancies, ANC follow-ups, and deliveries</p>
                </div>
              </div>
              <div className="text-xs text-emerald-100/90">
                Data refreshes automatically. Use the detailed cards below to open charts and manage care.
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="w-full max-w-full mx-auto px-2 sm:px-4 lg:px-6 py-4 sm:py-6 lg:py-8 overflow-x-hidden">
        {activeTab === 'dashboard' && activeSection === 'main' && renderDashboard()}
        {activeTab === 'tasks' && (
          <TaskManagement 
            currentUser={currentUser}
            appointments={appointments}
            onTaskComplete={(taskId) => {
              console.log('Task completed:', taskId);
              // Could trigger refresh of other data
            }}
            onTaskUpdate={(task) => {
              console.log('Task updated:', task);
              // Could update task in real-time
            }}
            onTaskCountsChange={(counts) => {
              calculateTaskCounts([counts.pending, counts.inProgress, counts.overdue]);
            }}
          />
        )}

        {activeTab === 'alerts' && (
          <PatientSafetyAlerts 
            currentUser={currentUser}
            appointments={appointments}
            onAlertAcknowledge={(alertId) => {
              console.log('Alert acknowledged:', alertId);
              // Could trigger refresh of other data
            }}
            onAlertDismiss={(alertId) => {
              console.log('Alert dismissed:', alertId);
              // Could update alert status
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
                <div className="flex items-center justify-between pt-4 border-t border-slate-200">
                  <div className="text-sm text-slate-600">
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
                    <div className="flex items-center gap-1">
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
          />
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
          <div className="w-full overflow-x-auto">
            <VitalsPanel appointments={appointments} />
          </div>
        )}
        {activeTab === 'triage' && (
          <div className="w-full overflow-x-auto">
            <PatientAssessment appointments={appointments} />
          </div>
        )}
        {activeTab === 'notes' && (() => {
          const appointmentsAwaitingPayment = appointments.filter(apt => apt.paymentStatus === 'awaiting_payment');
          const hasPaymentPending = appointmentsAwaitingPayment.length > 0;

          if (hasPaymentPending) {
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
            <div className="w-full overflow-x-auto">
              <NursingNotes appointments={appointments} preset={notesPreset} />
            </div>
          );
        })()}
        
        {/* HIV Section Tabs */}
        {activeSection === 'hiv' && activeTab === 'testing' && (
          <HIVTestingComponent tenantSlug={tenantSlug || ''} />
        )}
        {activeSection === 'hiv' && activeTab === 'hiv-patients' && (
          <HIVPatientManagement tenantSlug={tenantSlug || ''} />
        )}
        {activeSection === 'hiv' && activeTab === 'tb-screening' && (
          <TBScreeningComponent tenantSlug={tenantSlug || ''} />
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
          <div className="bg-white rounded-xl shadow-lg p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-slate-900">Lost to Follow-Up (LTFU) Management</h2>
              <div className="flex items-center gap-3">
                <label className="text-sm text-slate-600">Days since last visit:</label>
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
                  className="px-3 py-2 border border-slate-300 rounded-lg"
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
              <div className="text-center py-12">
                <CheckCircle className="w-16 h-16 text-green-400 mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-slate-600 mb-2">No LTFU Patients</h3>
                <p className="text-slate-500">All patients have been seen within the last {ltfuDays} days</p>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="bg-red-50 border-l-4 border-red-500 p-4 rounded mb-6">
                  <p className="font-semibold text-red-900">
                    ⚠️ {ltfuPatients.length} patient{ltfuPatients.length > 1 ? 's' : ''} lost to follow-up 
                    ({ltfuPatients.length} not seen in {ltfuDays}+ days)
                  </p>
                  <p className="text-sm text-red-700 mt-1">
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

        {/* Maternity Section */}
        {activeSection === 'maternity' && (
          <div className="bg-white rounded-xl shadow-lg p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-gray-900 flex items-center">
                <Heart className="w-6 h-6 text-pink-600 mr-2" />
                Maternity & Obstetrics Care
              </h2>
            </div>
            <MaternityDashboard
              tenantSlug={tenantSlug!}
              token={localStorage.getItem('ehr_token') || ''}
            />
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
                onSave={() => {
                  setShowVitalsModal(false);
                  fetchTodayAppointments();
                  showSuccess('Success', 'Vitals recorded successfully');
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
            showSuccess('Success', 'Patient created successfully');
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
    </div>
  );
};


export default NurseDashboard;
