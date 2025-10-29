import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  Calendar, Clock, User, Stethoscope, CheckCircle, AlertCircle, 
  Play, Pause, Square, FileText, Pill, TestTube, Bell, 
  Search, Filter, RefreshCw, Eye, Edit, Phone, Video,
  Activity, Heart, Thermometer, Droplets, Weight, Zap, ArrowLeft, XCircle, Settings,
  LogOut, Menu, X, BarChart3, CreditCard, Users, Bell as BellIcon
} from 'lucide-react';
import { useNotification } from '../components/GlobalNotification.tsx';
import { ehrApi } from '../services/api.ts';
import { formatDateForAPI, getTodayFormatted } from '../utils/dateUtils';
import DatePicker from '../components/DatePicker';
import AppointmentActions from '../components/AppointmentActions';
import PatientQueue from '../components/PatientQueue';
import DoctorScheduleView from '../components/DoctorScheduleView';
import RealtimeStatusIndicator from '../components/RealtimeStatusIndicator';
import useRealtimeUpdates from '../hooks/useRealtimeUpdates';

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
  const [showNotesModal, setShowNotesModal] = useState(false);
  const [appointmentNotes, setAppointmentNotes] = useState('');
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
  const [criticalAlerts, setCriticalAlerts] = useState<VitalsAlert[]>([]);
  const [vitalsData, setVitalsData] = useState<Record<string, PatientVitals[]>>({});

  // Get current user info
  const [currentUser, setCurrentUser] = useState<any>(null);
  
  // Real-time updates
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());
  const [isUpdating, setIsUpdating] = useState(false);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'dashboard' | 'queue' | 'schedule'>('dashboard');
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    const userData = localStorage.getItem('ehr_user');
    if (userData) {
      setCurrentUser(JSON.parse(userData));
    }
  }, []);

  useEffect(() => {
    if (currentUser) {
      fetchTodayAppointments();
    }
  }, [selectedDate, currentUser]);

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
            doctorId: apt.doctor.id,
            currentUserId: currentUser?.id,
            matches: apt.doctor.id === currentUser?.id
          });
          return apt.doctor.id === currentUser?.id;
        }
      );
      
      console.log('🔍 DoctorDashboard - Filtered doctor appointments:', doctorAppointments);
      setAppointments(doctorAppointments);
      
      // Fetch vitals data for all patients with appointments today
      await fetchVitalsForAppointments(doctorAppointments);
      
      // Check for critical vitals after fetching appointments
      await checkForCriticalVitals();
    } catch (error) {
      console.error('Error fetching appointments:', error);
      showError('Error', 'Failed to fetch appointments');
    } finally {
      setLoading(false);
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
      } else if (systolic > 140 || diastolic > 90) {
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
      } else if (vitals.heartRate > 100 || vitals.heartRate < 60) {
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
      } else if (vitals.temperature > 38.0 || vitals.temperature < 36.0) {
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

  const checkForCriticalVitals = async () => {
    try {
      const criticalAlerts: VitalsAlert[] = [];

      // Check all vitals data for critical values
      Object.entries(vitalsData).forEach(([patientId, vitalsList]) => {
        if (vitalsList.length > 0) {
          const latestVitals = vitalsList[0];
          const alerts = validateVitals(latestVitals);
          
          // Add patient name to critical alerts
          const appointment = appointments.find(apt => apt.patient.id === patientId);
          const patientName = appointment ? `${appointment.patient.firstName} ${appointment.patient.lastName}` : 'Unknown Patient';
          
          alerts.forEach(alert => {
            if (alert.type === 'critical') {
              criticalAlerts.push({
                ...alert,
                message: `${patientName}: ${alert.message}`
              });
            }
          });
        }
      });

      setCriticalAlerts(criticalAlerts);
      console.log('🔍 DoctorDashboard - Critical vitals alerts:', criticalAlerts);
    } catch (error) {
      console.error('Error checking critical vitals:', error);
    }
  };

  const getVitalsStatusBadge = (appointment: Appointment) => {
    const vitalsStatus = checkVitalsStatus(appointment);
    
    if (!vitalsStatus.hasVitals) {
      return {
        text: 'No Vitals',
        color: 'bg-red-100 text-red-800 border-red-200',
        icon: <AlertCircle className="w-3 h-3" />
      };
    } else if (!vitalsStatus.isRecent) {
      return {
        text: 'Old Vitals',
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
        notes: appointmentNotes
      }, token, tenantSlug!);
      
      showSuccess('Success', 'Appointment notes saved');
      setShowNotesModal(false);
      fetchTodayAppointments();
    } catch (error) {
      console.error('Error saving notes:', error);
      showError('Error', 'Failed to save notes');
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
    return appointments.filter(apt => apt.status === 'in-progress');
  };

  const getCompletedToday = () => {
    return appointments.filter(apt => apt.status === 'completed');
  };

  const getDoctorActions = () => {
    return [
      { icon: Stethoscope, label: 'Dashboard', desc: 'Today\'s overview', color: 'from-blue-500 to-cyan-500', route: 'doctor' },
      { icon: Users, label: 'Patients', desc: 'Patient management', color: 'from-emerald-500 to-teal-500', route: 'doctor/patients' },
      { icon: Calendar, label: 'Appointments', desc: 'Schedule & manage', color: 'from-purple-500 to-indigo-500', route: 'doctor/appointments' },
      { icon: FileText, label: 'Medical Records', desc: 'Patient history & notes', color: 'from-orange-500 to-red-500' },
      { icon: Pill, label: 'Prescriptions', desc: 'Medication management', color: 'from-pink-500 to-rose-500' },
      { icon: TestTube, label: 'Lab Orders', desc: 'Request & review tests', color: 'from-violet-500 to-purple-500' },
      { icon: BarChart3, label: 'Analytics', desc: 'Patient insights', color: 'from-green-500 to-emerald-500' },
    ];
  };

  const quickStats = [
    { label: 'Today\'s Appointments', value: appointments.length.toString(), icon: Calendar, color: 'text-blue-600' },
    { label: 'In Progress', value: getCurrentAppointments().length.toString(), icon: Play, color: 'text-yellow-600' },
    { label: 'Completed', value: getCompletedToday().length.toString(), icon: CheckCircle, color: 'text-green-600' },
    { label: 'Waiting', value: appointments.filter(apt => apt.status === 'confirmed').length.toString(), icon: Clock, color: 'text-purple-600' },
  ];

  if (!currentUser) return null;

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
        {/* Critical Vitals Alerts */}
        {criticalAlerts.length > 0 && (
          <div className="bg-red-50 border-l-4 border-red-400 p-4">
            <div className="flex items-start">
              <div className="flex-shrink-0">
                <AlertCircle className="h-5 w-5 text-red-400" />
              </div>
              <div className="ml-3">
                <h3 className="text-sm font-medium text-red-800">
                  Critical Vitals Alert
                </h3>
                <div className="mt-2 text-sm text-red-700">
                  <ul className="list-disc pl-5 space-y-1">
                    {criticalAlerts.map((alert, index) => (
                      <li key={index} className="flex items-center gap-2">
                        {alert.icon}
                        {alert.message}
                      </li>
                    ))}
                  </ul>
                </div>
                <div className="mt-4">
                  <button
                    onClick={() => setCriticalAlerts([])}
                    className="bg-red-100 text-red-800 px-3 py-1 rounded-md text-sm font-medium hover:bg-red-200 transition-colors"
                  >
                    Dismiss
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

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
                  className="w-40"
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
        <div className="p-6">
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

          {/* Tab Navigation */}
          <div className="mb-8">
            <div className="border-b border-slate-200">
              <nav className="-mb-px flex space-x-8">
                <button
                  onClick={() => setActiveTab('dashboard')}
                  className={`py-2 px-1 border-b-2 font-medium text-sm ${
                    activeTab === 'dashboard'
                      ? 'border-blue-500 text-blue-600'
                      : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
                  }`}
                >
                  Dashboard
                </button>
                <button
                  onClick={() => setActiveTab('queue')}
                  className={`py-2 px-1 border-b-2 font-medium text-sm ${
                    activeTab === 'queue'
                      ? 'border-blue-500 text-blue-600'
                      : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
                  }`}
                >
                  Patient Queue
                </button>
                <button
                  onClick={() => setActiveTab('schedule')}
                  className={`py-2 px-1 border-b-2 font-medium text-sm ${
                    activeTab === 'schedule'
                      ? 'border-blue-500 text-blue-600'
                      : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
                  }`}
                >
                  Schedule View
                </button>
              </nav>
            </div>
          </div>

          {/* Tab Content */}
          {activeTab === 'dashboard' && (
            <div className="space-y-8">
              {/* Current Appointment */}
              {currentAppointment && (
                <div className="bg-white/70 backdrop-blur-sm rounded-2xl border border-slate-200/50 p-6">
                  <div className="flex items-center justify-between mb-6">
                    <h2 className="text-xl font-bold text-slate-900">Current Appointment</h2>
                    <div className="flex gap-2">
                      <button
                        onClick={() => setShowVitalsModal(true)}
                        className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2"
                      >
                        <Activity className="w-4 h-4" />
                        Record Vitals
                      </button>
                      <button
                        onClick={() => setShowNotesModal(true)}
                        className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors flex items-center gap-2"
                      >
                        <FileText className="w-4 h-4" />
                        Add Notes
                      </button>
                    </div>
                  </div>
                  
                  <div className="bg-slate-50 rounded-lg p-4">
                    <div className="flex items-center justify-between mb-4">
                      <div>
                        <h3 className="text-lg font-semibold text-slate-900">
                          {currentAppointment.patient.firstName} {currentAppointment.patient.lastName}
                        </h3>
                        <p className="text-slate-600">Patient ID: {currentAppointment.patient.patientNumber}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm text-slate-600">Appointment Time</p>
                        <p className="font-semibold">{formatTime(currentAppointment.appointmentDate)}</p>
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <p className="text-slate-600">Reason for Visit</p>
                        <p className="font-medium">{currentAppointment.reason}</p>
                      </div>
                      <div>
                        <p className="text-slate-600">Type</p>
                        <p className="font-medium">{currentAppointment.appointmentType}</p>
                      </div>
                    </div>
                    
                    <div className="mt-4 pt-4 border-t border-slate-200">
                      <button
                        onClick={() => handleAppointmentAction(currentAppointment.id, 'complete')}
                        className="w-full px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors flex items-center justify-center gap-2"
                      >
                        <CheckCircle className="w-4 h-4" />
                        Complete Appointment
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Today's Schedule - Now on Top */}
              <div className="bg-white/70 backdrop-blur-sm rounded-2xl border border-slate-200/50">
                <div className="p-6 border-b border-slate-200">
                  <div className="flex items-center justify-between">
                    <h2 className="text-xl font-bold text-slate-900">Today's Schedule</h2>
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-slate-600">
                        {appointments.length} appointment{appointments.length !== 1 ? 's' : ''} scheduled
                      </span>
                      <button
                        onClick={fetchTodayAppointments}
                        className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
                      >
                        <RefreshCw className="w-4 h-4 text-slate-600" />
                      </button>
                    </div>
                  </div>
                </div>
                <div className="p-6">
                  {loading ? (
                    <div className="text-center py-8">
                      <RefreshCw className="w-8 h-8 text-slate-400 animate-spin mx-auto mb-4" />
                      <p className="text-slate-500">Loading appointments...</p>
                    </div>
                  ) : appointments.length === 0 ? (
                    <div className="text-center py-8">
                      <Calendar className="w-12 h-12 text-slate-400 mx-auto mb-4" />
                      <p className="text-slate-500">No appointments scheduled for today</p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {appointments.map((appointment) => (
                        <div key={appointment.id} className="flex items-center justify-between p-4 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors">
                          <div className="flex items-center gap-4">
                            <div className="text-center">
                              <p className="text-sm text-slate-600">Time</p>
                              <p className="font-semibold">{formatTime(appointment.appointmentDate)}</p>
                            </div>
                            <div className="w-px h-12 bg-slate-200"></div>
                            <div>
                              <h3 className="font-semibold text-slate-900">
                                {appointment.patient.firstName} {appointment.patient.lastName}
                              </h3>
                              <p className="text-slate-600">{appointment.reason}</p>
                              <div className="flex items-center gap-2 mt-1">
                                <p className="text-sm text-slate-500">{appointment.appointmentType}</p>
                                {(() => {
                                  const vitalsBadge = getVitalsStatusBadge(appointment);
                                  return (
                                    <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium border ${vitalsBadge.color}`}>
                                      {vitalsBadge.icon}
                                      {vitalsBadge.text}
                                    </span>
                                  );
                                })()}
                              </div>
                            </div>
                          </div>
                          
                          <div className="flex items-center gap-3">
                            {(() => {
                              const vitalsBadge = getVitalsStatusBadge(appointment);
                              if (vitalsBadge.text === 'No Vitals') {
                                return (
                                  <button
                                    onClick={() => {
                                      showError('Action Required', 'Please request vitals recording from nursing staff before consultation');
                                    }}
                                    className="px-3 py-1 bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition-colors text-sm flex items-center gap-1"
                                  >
                                    <Activity className="w-4 h-4" />
                                    Request Vitals
                                  </button>
                                );
                              }
                              return null;
                            })()}
                            <AppointmentActions
                              appointment={appointment}
                              onUpdate={fetchTodayAppointments}
                              tenantSlug={tenantSlug!}
                              token={localStorage.getItem('ehr_token') || ''}
                            />
                            <button
                              onClick={() => navigate(`/ehr/${tenantSlug}/doctor/patients/${appointment.patient.id}`)}
                              className="px-3 py-1 bg-slate-600 text-white rounded-lg hover:bg-slate-700 transition-colors text-sm flex items-center gap-1"
                            >
                              <User className="w-4 h-4" />
                              View Patient
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Quick Actions and Upcoming Appointments - Hidden for now */}
              {/* <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <div className="bg-white/70 backdrop-blur-sm rounded-2xl border border-slate-200/50 p-6">
                  <h3 className="text-lg font-bold text-slate-900 mb-4">Quick Actions</h3>
                  <div className="space-y-3">
                    {getDoctorActions().slice(1, 5).map((action, index) => {
                      const Icon = action.icon;
                      return (
                        <button
                          key={index}
                          onClick={() => action.route && navigate(`/ehr/${tenantSlug}/${action.route}`)}
                          className="w-full p-3 text-left hover:bg-slate-50 rounded-lg transition-colors flex items-center gap-3"
                        >
                          <div className={`p-2 rounded-lg bg-gradient-to-r ${action.color}`}>
                            <Icon className="w-5 h-5 text-white" />
                          </div>
                          <div>
                            <p className="font-medium text-slate-900">{action.label}</p>
                            <p className="text-sm text-slate-600">{action.desc}</p>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="bg-white/70 backdrop-blur-sm rounded-2xl border border-slate-200/50 p-6">
                  <h3 className="text-lg font-bold text-slate-900 mb-4">Upcoming Appointments</h3>
                  <div className="space-y-3">
                    {getUpcomingAppointments().map((appointment) => (
                      <div key={appointment.id} className="p-3 bg-slate-50 rounded-lg">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="font-medium text-slate-900">
                              {appointment.patient.firstName} {appointment.patient.lastName}
                            </p>
                            <p className="text-sm text-slate-600">{appointment.reason}</p>
                            <div className="flex items-center gap-2 mt-1">
                              {(() => {
                                const vitalsBadge = getVitalsStatusBadge(appointment);
                                return (
                                  <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium border ${vitalsBadge.color}`}>
                                    {vitalsBadge.icon}
                                    {vitalsBadge.text}
                                  </span>
                                );
                              })()}
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="text-sm font-medium">{formatTime(appointment.appointmentDate)}</p>
                            <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${getAppointmentStatusColor(appointment.status)}`}>
                              {getAppointmentStatusIcon(appointment.status)}
                              {appointment.status}
                            </span>
                          </div>
                        </div>
                      </div>
                    ))}
                    {getUpcomingAppointments().length === 0 && (
                      <p className="text-slate-500 text-center py-4">No upcoming appointments</p>
                    )}
                  </div>
                </div>
              </div> */}
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
        </div>
      </div>

      {/* Vitals Modal */}
      {showVitalsModal && currentAppointment && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-md flex items-center justify-center z-[100] p-4 animate-in fade-in duration-300">
          <div className="bg-gradient-to-br from-white to-slate-50 rounded-3xl shadow-2xl border border-slate-200/50 w-full max-w-2xl max-h-[90vh] overflow-y-auto animate-in zoom-in-95 duration-300">
            {/* Header */}
            <div className="sticky top-0 bg-gradient-to-r from-blue-50 to-indigo-50 border-b border-blue-200/50 px-6 py-5 rounded-t-3xl">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-gradient-to-r from-blue-500 to-indigo-600 rounded-xl">
                    <Activity className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-slate-900">Record Patient Vitals</h3>
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
      )}

      {/* Notes Modal */}
      {showNotesModal && currentAppointment && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-md flex items-center justify-center z-[100] p-4 animate-in fade-in duration-300">
          <div className="bg-gradient-to-br from-white to-slate-50 rounded-3xl shadow-2xl border border-slate-200/50 w-full max-w-2xl max-h-[90vh] overflow-y-auto animate-in zoom-in-95 duration-300">
            {/* Header */}
            <div className="sticky top-0 bg-gradient-to-r from-green-50 to-emerald-50 border-b border-green-200/50 px-6 py-5 rounded-t-3xl">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-gradient-to-r from-green-500 to-emerald-600 rounded-xl">
                    <FileText className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-slate-900">Add Appointment Notes</h3>
                    <p className="text-sm text-slate-600">
                      {currentAppointment.patient.firstName} {currentAppointment.patient.lastName} • {currentAppointment.patient.patientNumber}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setShowNotesModal(false)}
                  className="p-2 hover:bg-white/50 rounded-xl transition-colors"
                >
                  <X className="w-5 h-5 text-slate-500" />
                </button>
              </div>
            </div>

            {/* Content */}
            <div className="p-6">
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2">Appointment Notes</label>
                  <textarea
                    value={appointmentNotes}
                    onChange={(e) => setAppointmentNotes(e.target.value)}
                    rows={8}
                    placeholder="Enter your clinical notes, observations, and recommendations for this appointment..."
                    className="w-full border border-slate-300 rounded-xl px-4 py-3 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors resize-none"
                  />
                </div>
                
                <div className="bg-slate-50 rounded-xl p-4">
                  <h4 className="text-sm font-semibold text-slate-700 mb-2">Appointment Details</h4>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-slate-600">Reason:</span>
                      <p className="font-medium text-slate-900">{currentAppointment.reason}</p>
                    </div>
                    <div>
                      <span className="text-slate-600">Type:</span>
                      <p className="font-medium text-slate-900">{currentAppointment.appointmentType}</p>
                    </div>
                    <div>
                      <span className="text-slate-600">Time:</span>
                      <p className="font-medium text-slate-900">{formatTime(currentAppointment.appointmentDate)}</p>
                    </div>
                    <div>
                      <span className="text-slate-600">Duration:</span>
                      <p className="font-medium text-slate-900">{currentAppointment.durationMinutes} minutes</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="sticky bottom-0 bg-slate-50 border-t border-slate-200 px-6 py-4 rounded-b-2xl">
              <div className="flex gap-3">
                <button
                  onClick={() => setShowNotesModal(false)}
                  className="flex-1 px-6 py-3 border border-slate-300 text-slate-700 rounded-xl hover:bg-slate-50 transition-colors font-medium"
                >
                  Cancel
                </button>
                <button
                  onClick={handleNotesSubmit}
                  className="flex-1 px-6 py-3 bg-gradient-to-r from-green-600 to-emerald-600 text-white rounded-xl hover:from-green-700 hover:to-emerald-700 transition-all font-medium shadow-lg"
                >
                  Save Notes
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DoctorDashboard;