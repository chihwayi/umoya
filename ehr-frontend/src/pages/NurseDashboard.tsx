import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import {
  Users, Calendar, Activity, Heart, Thermometer, Droplets, 
  Eye, Stethoscope, FileText, Clock, AlertTriangle, CheckCircle,
  Plus, Search, Filter, RefreshCw, Bell, User, LogOut,
  TrendingUp, BarChart3, Pill, TestTube, ClipboardList, 
  ChevronDown, Settings, Shield, UserCircle, Menu, X
} from 'lucide-react';
import { ehrApi } from '../services/api.ts';
import CreatePatientModal from '../components/CreatePatientModal';
import CreateAppointmentModal from '../components/CreateAppointmentModal';
import { useNotification } from '../components/GlobalNotification.tsx';
import { formatDateToDDMMYYYY, formatDateTimeToDDMMYYYYHHMM } from '../utils/dateFormatting';
import VitalsPanel from '../components/VitalsPanel';
import TriageQueue from '../components/TriageQueue';
import PatientAssessment from '../components/PatientAssessment';
import NursingNotes from '../components/NursingNotes';

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

const NurseDashboard: React.FC = () => {
  const { tenantSlug } = useParams<{ tenantSlug: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const { showSuccess, showError } = useNotification();

  const [currentUser, setCurrentUser] = useState<any>(null);
  const [activeTab, setActiveTab] = useState('calendar');
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

  useEffect(() => {
    const user = JSON.parse(localStorage.getItem('ehr_user') || '{}');
    setCurrentUser(user);
  }, []);

  useEffect(() => {
    if (currentUser) {
      fetchTodayAppointments();
      fetchPatients();
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

  // Filter patients based on search term
  useEffect(() => {
    if (patientSearchTerm.trim() === '') {
      setFilteredPatients(patients);
    } else {
      const filtered = patients.filter(patient =>
        `${patient.firstName} ${patient.lastName}`.toLowerCase().includes(patientSearchTerm.toLowerCase()) ||
        patient.patientNumber.toLowerCase().includes(patientSearchTerm.toLowerCase()) ||
        patient.email?.toLowerCase().includes(patientSearchTerm.toLowerCase()) ||
        patient.phoneNumber?.toLowerCase().includes(patientSearchTerm.toLowerCase())
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

  const fetchTodayAppointments = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('ehr_token');
      if (!token) return;

      const today = new Date();
      const todayString = today.toISOString().split('T')[0];
      console.log('🔍 Fetching appointments for date:', todayString);
      console.log('🔍 Today object:', today);
      console.log('🔍 Today timezone offset:', today.getTimezoneOffset());
      
      const response = await ehrApi.getAppointments(
        token,
        tenantSlug!,
        { date: todayString }
      );
      console.log('📅 Raw appointments response:', response.data);
      console.log('📊 Total appointments:', response.data.appointments?.length || 0);

      // Show ALL appointments for today - nurses need to see everything
      const allAppointments = response.data.appointments || [];
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
            ehrApi.getAppointments(token, tenantSlug!, { date: yesterdayString }),
            ehrApi.getAppointments(token, tenantSlug!, { date: dayBeforeString })
          ]);
          
          const recentAppointments = [
            ...(yesterdayResponse.data.appointments || []),
            ...(dayBeforeResponse.data.appointments || [])
          ];
          
          console.log('📅 Recent appointments found:', recentAppointments.length);
          setAppointments(recentAppointments);
        } catch (error) {
          console.error('Error fetching recent appointments:', error);
          setAppointments(allAppointments);
        }
      } else {
        setAppointments(allAppointments);
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

    return { waiting, inProgress, completed, urgent };
  };

  const getNurseActions = () => {
    return [
      { icon: Calendar, label: 'Today\'s Schedule', desc: 'View today\'s appointments', color: 'from-blue-500 to-cyan-500', action: () => setActiveTab('calendar') },
      { icon: Users, label: 'Patients', desc: 'Browse & schedule', color: 'from-blue-500 to-cyan-500', action: () => setActiveTab('patients') },
      { icon: Users, label: 'Patient Queue', desc: 'Manage patient flow', color: 'from-indigo-500 to-purple-500', action: () => setActiveTab('queue') },
      { icon: Activity, label: 'Vitals Recording', desc: 'Record patient vitals', color: 'from-red-500 to-pink-500', action: () => setActiveTab('vitals') },
      { icon: ClipboardList, label: 'Triage Assessment', desc: 'Patient assessment', color: 'from-orange-500 to-yellow-500', action: () => setActiveTab('triage') },
      { icon: FileText, label: 'Nursing Notes', desc: 'Document care provided', color: 'from-green-500 to-emerald-500', action: () => setActiveTab('notes') },
      { icon: FileText, label: 'Care Plans', desc: 'Plan nursing care', color: 'from-emerald-500 to-teal-500', action: () => { setActiveTab('notes'); setNotesPreset('care_plans'); } },
      { icon: Pill, label: 'Medications', desc: 'Administer & track', color: 'from-fuchsia-500 to-pink-600', action: () => { setActiveTab('notes'); setNotesPreset('medications'); } },
    ];
  };

  const quickStats = [
    { label: 'Patients Waiting', value: getQueueStats().waiting.toString(), icon: Clock, color: 'text-blue-600' },
    { label: 'In Progress', value: getQueueStats().inProgress.toString(), icon: Activity, color: 'text-yellow-600' },
    { label: 'Urgent Cases', value: getQueueStats().urgent.toString(), icon: AlertTriangle, color: 'text-red-600' },
    { label: 'Completed Today', value: getQueueStats().completed.toString(), icon: CheckCircle, color: 'text-green-600' },
  ];

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

  const handleRecordVitals = (patient: Patient) => {
    setSelectedPatient(patient);
    setShowVitalsModal(true);
  };

  const handleTriageAssessment = (patient: Patient) => {
    setSelectedPatient(patient);
    setShowAssessmentModal(true);
  };

  const fetchPatients = async () => {
    try {
      const token = localStorage.getItem('ehr_token');
      if (!token) return;
      const resp = await ehrApi.getPatients(token, tenantSlug!);
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

  // Check if patient has scheduled appointments
  const hasScheduledAppointments = (patientId: string) => {
    return appointments.some(apt => apt.patient.id === patientId);
  };

  const handleVitalsForScheduledPatient = (patient: Patient) => {
    if (hasScheduledAppointments(patient.id)) {
      setSelectedPatient(patient);
      setShowVitalsModal(true);
    } else {
      showError('No Scheduled Appointments', 'This patient has no scheduled appointments. Vitals can only be recorded for patients with appointments.');
    }
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

  const getAppointmentsForDate = (date: Date) => {
    return appointments.filter(apt => {
      const aptDate = new Date(apt.appointmentDate);
      return aptDate.toDateString() === date.toDateString();
    });
  };

  const getTypeColorClass = (type: string) => {
    const key = (type || '').toLowerCase();
    if (key.includes('follow')) return 'from-purple-100 to-indigo-100 text-indigo-800';
    if (key.includes('consult')) return 'from-blue-100 to-cyan-100 text-blue-800';
    if (key.includes('triage')) return 'from-amber-100 to-yellow-100 text-amber-800';
    if (key.includes('procedure')) return 'from-rose-100 to-pink-100 text-rose-800';
    if (key.includes('med')) return 'from-emerald-100 to-teal-100 text-emerald-800';
    return 'from-slate-100 to-slate-200 text-slate-700';
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
      const apt = appointments.find(a => a.id === draggingAppointmentId);
      if (!apt) return;
      const old = new Date(apt.appointmentDate);
      const newDate = new Date(date.getFullYear(), date.getMonth(), date.getDate(), old.getHours(), old.getMinutes());
      await ehrApi.updateAppointment(apt.id, { appointmentDate: newDate.toISOString() }, token, tenantSlug!);
      setAppointments(prev => prev.map(a => a.id === apt.id ? { ...a, appointmentDate: newDate.toISOString() } : a));
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
        {appointments.map((appointment) => (
          <div key={appointment.id} draggable onDragStart={() => handleDragStart(appointment.id)} className="bg-gradient-to-br from-white to-slate-50 rounded-xl p-4 border border-slate-200/50 hover:shadow-md transition-all duration-200">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 bg-gradient-to-r from-blue-500 to-indigo-600 rounded-lg flex items-center justify-center flex-shrink-0">
                <Clock className="w-5 h-5 text-white" />
              </div>
              <div className="flex-1 min-w-0">
                <h4 className="font-semibold text-slate-900 truncate">
                  {appointment.patient.firstName} {appointment.patient.lastName}
                </h4>
                <p className="text-sm text-slate-600">
                  {new Date(appointment.appointmentDate).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} • {appointment.durationMinutes} min
                </p>
                <div className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium bg-gradient-to-r ${getTypeColorClass(appointment.appointmentType)} mb-1`}>
                  {appointment.appointmentType || 'Appointment'}
                </div>
                <p className="text-xs text-slate-500">
                  Dr. {appointment.doctor.firstName} {appointment.doctor.lastName}
                </p>
                <div className="flex items-center gap-2 mt-2">
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
                </div>
                {appointment.reason && (
                  <p className="text-xs text-slate-500 mt-1 truncate">
                    {appointment.reason}
                  </p>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  };

  const renderWeekView = (appointments: Appointment[]) => {
    const refDate = calendarDate;
    const weekDates = getWeekDates(refDate);
    
    return (
      <div className="grid grid-cols-7 gap-2">
        {weekDates.map((date, index) => {
          const dayAppointments = getAppointmentsForDate(date);
          const isToday = date.toDateString() === new Date().toDateString();
          
          return (
            <div key={index} className={`rounded-lg border-2 ${isToday ? 'border-blue-500 bg-blue-50' : 'border-slate-200 bg-white'}`} onDragOver={(e) => e.preventDefault()} onDrop={() => handleDayDrop(date)}>
              <button onClick={() => handleDayClick(date)} className={`w-full text-left p-3 text-center ${isToday ? 'bg-blue-500 text-white' : 'bg-slate-100 text-slate-700'}`}>
                <div className="text-sm font-semibold">{date.toLocaleDateString('en-US', { weekday: 'short' })}</div>
                <div className="text-lg font-bold">{date.getDate()}</div>
              </button>
              <div className="p-2 min-h-[120px]">
                {dayAppointments.map((apt) => (
                  <div key={apt.id} draggable onDragStart={() => handleDragStart(apt.id)} className={`mb-2 p-2 bg-gradient-to-r ${getTypeColorClass(apt.appointmentType)} rounded text-xs`}>
                    <div className="font-semibold truncate">{apt.patient.firstName} {apt.patient.lastName}</div>
                    <div className="text-slate-700">
                      {new Date(apt.appointmentDate).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  const renderMonthView = (appointments: Appointment[]) => {
    const today = new Date();
    const monthDates = getMonthDates(calendarDate);
    
    return (
      <div className="grid grid-cols-7 gap-1">
        {/* Month header */}
        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
          <div key={day} className="p-3 text-center text-sm font-semibold text-slate-600 bg-slate-100 rounded">
            {day}
          </div>
        ))}
        
        {/* Calendar days */}
        {monthDates.map((date, index) => {
          const dayAppointments = getAppointmentsForDate(date);
          const isToday = date.toDateString() === today.toDateString();
          const isCurrentMonth = date.getMonth() === calendarDate.getMonth();
          
          return (
            <div key={index} className={`min-h-[100px] p-2 border border-slate-200 rounded ${isCurrentMonth ? 'bg-white' : 'bg-slate-50'}`} onDragOver={(e) => e.preventDefault()} onDrop={() => handleDayDrop(date)}>
              <button onClick={() => handleDayClick(date)} className={`text-sm font-semibold mb-1 ${isToday ? 'text-blue-600 bg-blue-100 rounded-full w-6 h-6 flex items-center justify-center' : 'text-slate-700'}`}>
                {date.getDate()}
              </button>
              <div className="space-y-1">
                {dayAppointments.slice(0, 2).map((apt) => (
                  <div key={apt.id} draggable onDragStart={() => handleDragStart(apt.id)} className={`text-xs p-1 bg-gradient-to-r ${getTypeColorClass(apt.appointmentType)} rounded truncate`}>
                    <div className="font-medium">{apt.patient.firstName}</div>
                    <div className="text-slate-700">
                      {new Date(apt.appointmentDate).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </div>
                  </div>
                ))}
                {dayAppointments.length > 2 && (
                  <div className="text-xs text-slate-500 text-center">
                    +{dayAppointments.length - 2} more
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  const renderCalendar = () => {
    const today = new Date();
    const dayAppointments = getAppointmentsForDate(calendarDate);
    
    console.log('📅 Calendar render - Total appointments:', appointments.length);
    console.log('📅 Calendar render - Selected day appointments:', dayAppointments.length);

    return (
      <div className="space-y-6">
        {/* Today's Schedule Header */}
        <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl p-6 border border-blue-200/50">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold text-slate-900">Today's Schedule</h2>
              <p className="text-slate-600">{formatDateToDDMMYYYY(calendarDate)} • {dayAppointments.length} appointments</p>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={fetchTodayAppointments}
                disabled={loading}
                className="p-2 hover:bg-white/50 rounded-lg transition-all duration-200 disabled:opacity-50"
              >
                <RefreshCw className={`w-5 h-5 text-slate-600 ${loading ? 'animate-spin' : ''}`} />
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
          <div className="p-6">
            {calendarView === 'day' && dayAppointments.length === 0 ? (
              <div className="text-center py-12">
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
                    return renderWeekView(appointments);
                  case 'month':
                    return renderMonthView(appointments);
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

  const renderDashboard = () => (
    <div className="space-y-8">
      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        {quickStats.map((stat, index) => (
          <div key={index} className="bg-gradient-to-br from-white to-slate-50 rounded-2xl shadow-lg border border-slate-200/50 p-6 hover:shadow-xl transition-all duration-300">
            <div className="flex items-center justify-between mb-3">
              <div className="p-3 bg-gradient-to-r from-slate-100 to-slate-200 rounded-xl">
                <stat.icon className="w-6 h-6 text-slate-600" />
              </div>
              <div className="text-3xl font-bold text-slate-900">{stat.value}</div>
            </div>
            <div className="text-sm font-semibold text-slate-600">{stat.label}</div>
          </div>
        ))}
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
        {getNurseActions().map((action, index) => (
          <button
            key={index}
            onClick={action.action}
            className="bg-gradient-to-br from-white to-slate-50 rounded-2xl shadow-lg border border-slate-200/50 p-6 hover:shadow-xl transition-all duration-300 group text-left"
          >
            <div className={`p-3 bg-gradient-to-r ${action.color} rounded-xl w-fit mb-4 group-hover:scale-110 transition-transform duration-200`}>
              <action.icon className="w-6 h-6 text-white" />
            </div>
            <h3 className="text-lg font-bold text-slate-900 mb-2">{action.label}</h3>
            <p className="text-sm text-slate-600">{action.desc}</p>
          </button>
        ))}
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50">
      {/* Slim Top Bar: system title + notifications + user */}
      <header className="bg-white/80 backdrop-blur-sm border-b border-slate-200/50 sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
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
                <span className="absolute -top-1 -right-1 h-3 w-3 bg-red-500 rounded-full text-xs"></span>
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

      {/* Page Tabs (in-content) */}
      <div className="bg-white/80 backdrop-blur-sm border-b border-slate-200/50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <nav className="flex space-x-8">
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
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
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
                {getPaginatedPatients().map((p) => (
                  <div key={p.id} className="bg-white/60 rounded-xl p-4 border border-slate-200/60 hover:shadow-md transition-all duration-200">
                    <div className="flex items-center gap-3 mb-3">
                      <div className="w-10 h-10 bg-gradient-to-br from-pink-500 to-rose-600 rounded-lg text-white font-bold flex items-center justify-center">
                        {p.firstName.charAt(0)}{p.lastName.charAt(0)}
                      </div>
                      <div className="flex-1">
                        <div className="font-bold text-slate-900">{p.firstName} {p.lastName}</div>
                        <div className="text-sm text-slate-600">ID: {p.patientNumber}</div>
                        {hasScheduledAppointments(p.id) && (
                          <div className="text-xs text-emerald-600 font-medium flex items-center gap-1">
                            <CheckCircle className="w-3 h-3" />
                            Has Appointments
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
                      {hasScheduledAppointments(p.id) && (
                        <button
                          onClick={() => handleVitalsForScheduledPatient(p)}
                          className="px-3 py-2 bg-gradient-to-r from-emerald-500 to-teal-600 text-white rounded-lg text-sm hover:from-emerald-600 hover:to-teal-700 transition-all duration-200"
                        >
                          Vitals
                        </button>
                      )}
                    </div>
                  </div>
                ))}
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
        {activeTab === 'queue' && <TriageQueue appointments={appointments} onRecordVitals={handleRecordVitals} onTriageAssessment={handleTriageAssessment} />}
        {activeTab === 'orders' && (
          <div className="space-y-6">
            <div className="bg-gradient-to-br from-white to-slate-50 rounded-2xl shadow-lg border border-slate-200/50 p-6">
              <div className="flex items-center gap-3 mb-6">
                <div className="p-2 bg-gradient-to-r from-purple-500 to-indigo-600 rounded-xl">
                  <ClipboardList className="w-5 h-5 text-white" />
                </div>
                <h3 className="text-lg font-bold text-slate-900">Orders & Procedures (Today)</h3>
              </div>
              {appointments.length === 0 ? (
                <div className="text-slate-600">No appointments today.</div>
              ) : (
                <div className="space-y-4">
                  {appointments.map((apt) => (
                    <div key={apt.id} className="bg-white/60 rounded-xl p-4 border border-slate-200/60">
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="font-semibold text-slate-900">{apt.patient.firstName} {apt.patient.lastName}</div>
                          <div className="text-sm text-slate-600">Dr. {apt.doctor.firstName} {apt.doctor.lastName} • {new Date(apt.appointmentDate).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => { setSelectedPatient(apt.patient); setNotesPreset('medications'); setActiveTab('notes'); }}
                            className="px-3 py-2 bg-gradient-to-r from-fuchsia-500 to-pink-600 text-white rounded-lg text-sm hover:from-fuchsia-600 hover:to-pink-700 transition-all duration-200"
                          >
                            Administer Medication
                          </button>
                          <button
                            onClick={() => { setSelectedPatient(apt.patient); setNotesPreset(undefined); setActiveTab('notes'); }}
                            className="px-3 py-2 bg-gradient-to-r from-emerald-500 to-teal-600 text-white rounded-lg text-sm hover:from-emerald-600 hover:to-teal-700 transition-all duration-200"
                          >
                            Start Procedure
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
        {activeTab === 'vitals' && <VitalsPanel appointments={appointments} />}
        {activeTab === 'triage' && <PatientAssessment appointments={appointments} />}
        {activeTab === 'notes' && <NursingNotes appointments={appointments} preset={notesPreset} />}
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
    </div>
  );
};

export default NurseDashboard;
