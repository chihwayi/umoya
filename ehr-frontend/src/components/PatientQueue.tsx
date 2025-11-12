import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Clock, User, Phone, Mail, Calendar,
  CheckCircle, AlertCircle, AlertTriangle, Play, Pause, Square, XCircle,
  RefreshCw, Search, Filter, Bell, Activity, Heart, Thermometer, Droplets, Eye, Weight, Ruler, CreditCard
} from 'lucide-react';
import { useNotification } from '../components/GlobalNotification';
import { ehrApi } from '../services/api';
import { formatDateForAPI, getTodayFormatted } from '../utils/dateUtils';

interface Patient {
  id: string;
  firstName: string;
  lastName: string;
  patientNumber: string;
  dateOfBirth: string;
  phone: string;
  email: string;
}

interface Appointment {
  id: string;
  patient: Patient;
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

interface PatientQueueProps {
  tenantSlug: string;
  token: string;
  onAppointmentUpdate: () => void;
  appointments?: Appointment[]; // Add appointments prop
}

const PatientQueue: React.FC<PatientQueueProps> = ({
  tenantSlug,
  token,
  onAppointmentUpdate,
  appointments: propAppointments = []
}) => {
  const navigate = useNavigate();
  const { showSuccess, showError } = useNotification();
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [selectedDate, setSelectedDate] = useState(getTodayFormatted());
  const [vitalsData, setVitalsData] = useState<Record<string, PatientVitals[]>>({});

  // Use appointments from props if available, otherwise use local state
  const displayAppointments = propAppointments.length > 0 ? propAppointments : appointments;

  useEffect(() => {
    if (propAppointments.length === 0) {
      fetchAppointments();
    }
  }, [selectedDate, propAppointments.length]);

  useEffect(() => {
    // Whenever appointments to display change, fetch vitals for those patients
    if (displayAppointments.length > 0) {
      fetchVitalsForAppointments(displayAppointments);
    }
  }, [displayAppointments]);

  const fetchAppointments = async () => {
    try {
      setLoading(true);
      console.log('🔍 PatientQueue - Fetching appointments independently');
      const response = await ehrApi.getAppointments(token, tenantSlug, {
        date: formatDateForAPI(selectedDate)
      });
      console.log('🔍 PatientQueue - All appointments from API:', response.data.appointments);
      
      // Get current user from localStorage for filtering
      const userData = localStorage.getItem('ehr_user');
      const currentUser = userData ? JSON.parse(userData) : null;
      console.log('🔍 PatientQueue - Current user:', currentUser);
      
      // Filter by doctor if user is available
      const filteredAppointments = currentUser 
        ? response.data.appointments.filter((apt: any) => apt.doctor.id === currentUser.id)
        : response.data.appointments;
      
      console.log('🔍 PatientQueue - Filtered appointments:', filteredAppointments);
      setAppointments(filteredAppointments);
      // Trigger vitals fetch for fetched list
      fetchVitalsForAppointments(filteredAppointments);
    } catch (error) {
      console.error('Error fetching appointments:', error);
      showError('Error', 'Failed to fetch appointments');
    } finally {
      setLoading(false);
    }
  };

  const fetchVitalsForAppointments = async (apts: Appointment[]) => {
    try {
      const vitalsPromises = apts.map(async (appointment) => {
        try {
          const vitals = await ehrApi.getVitals(appointment.patient.id, token, tenantSlug);
          return { patientId: appointment.patient.id, vitals: vitals.data.vitals || [] };
        } catch (error) {
          return { patientId: appointment.patient.id, vitals: [] };
        }
      });
      const results = await Promise.all(vitalsPromises);
      const map: Record<string, PatientVitals[]> = {};
      results.forEach(({ patientId, vitals }) => {
        map[patientId] = vitals.sort((a: PatientVitals, b: PatientVitals) =>
          new Date(b.recordedAt).getTime() - new Date(a.recordedAt).getTime()
        );
      });
      setVitalsData(map);
    } catch (e) {
      // Swallow vitals errors; queue should still render
    }
  };

  const validateVitals = (vitals: PatientVitals): VitalsAlert[] => {
    const alerts: VitalsAlert[] = [];
    if (vitals.bloodPressure) {
      const [systolicStr, diastolicStr] = vitals.bloodPressure.split('/');
      const systolic = Number(systolicStr);
      const diastolic = Number(diastolicStr);
      if (systolic > 180 || diastolic > 110) {
        alerts.push({ type: 'critical', message: `BP ${vitals.bloodPressure}`, icon: <AlertCircle className="w-3 h-3" />, color: 'text-red-600' });
      } else if (systolic > 160 || diastolic > 100) {
        alerts.push({ type: 'warning', message: `BP ${vitals.bloodPressure}`, icon: <AlertTriangle className="w-3 h-3" />, color: 'text-orange-600' });
      }
    }
    if (vitals.heartRate > 0) {
      if (vitals.heartRate > 120 || vitals.heartRate < 50) {
        alerts.push({ type: 'critical', message: `HR ${vitals.heartRate}`, icon: <Heart className="w-3 h-3" />, color: 'text-red-600' });
      } else if (vitals.heartRate > 110 || vitals.heartRate < 55) {
        alerts.push({ type: 'warning', message: `HR ${vitals.heartRate}`, icon: <Heart className="w-3 h-3" />, color: 'text-orange-600' });
      }
    }
    if (vitals.temperature > 0) {
      if (vitals.temperature > 39.5 || vitals.temperature < 35.0) {
        alerts.push({ type: 'critical', message: `Temp ${vitals.temperature}°C`, icon: <Thermometer className="w-3 h-3" />, color: 'text-red-600' });
      } else if (vitals.temperature > 38.5 || vitals.temperature < 35.5) {
        alerts.push({ type: 'warning', message: `Temp ${vitals.temperature}°C`, icon: <Thermometer className="w-3 h-3" />, color: 'text-orange-600' });
      }
    }
    if (vitals.oxygenSaturation > 0) {
      if (vitals.oxygenSaturation < 90) {
        alerts.push({ type: 'critical', message: `SpO2 ${vitals.oxygenSaturation}%`, icon: <Droplets className="w-3 h-3" />, color: 'text-red-600' });
      } else if (vitals.oxygenSaturation < 95) {
        alerts.push({ type: 'warning', message: `SpO2 ${vitals.oxygenSaturation}%`, icon: <Droplets className="w-3 h-3" />, color: 'text-orange-600' });
      }
    }
    return alerts;
  };

  const getVitalsStatusBadge = (appointment: Appointment) => {
    const list = vitalsData[appointment.patient.id] || [];
    if (list.length === 0) {
      return { text: 'No Vitals', color: 'bg-red-100 text-red-800 border-red-200', icon: <AlertCircle className="w-3 h-3" /> };
    }
    const latest = list[0];
    const alerts = validateVitals(latest);
    if (alerts.some(a => a.type === 'critical')) {
      return { text: 'Critical Vitals', color: 'bg-red-100 text-red-800 border-red-200', icon: <AlertCircle className="w-3 h-3" /> };
    }
    if (alerts.some(a => a.type === 'warning')) {
      return { text: 'Vitals Warning', color: 'bg-orange-100 text-orange-800 border-orange-200', icon: <AlertTriangle className="w-3 h-3" /> };
    }
    return { text: 'Vitals OK', color: 'bg-green-100 text-green-800 border-green-200', icon: <CheckCircle className="w-3 h-3" /> };
  };

  const handleAppointmentAction = async (appointmentId: string, action: string) => {
    try {
      switch (action) {
        case 'check-in':
          await ehrApi.updateAppointmentStatus(appointmentId, 'confirmed', token, tenantSlug);
          showSuccess('Success', 'Patient checked in successfully');
          break;
        case 'start':
          await ehrApi.startAppointment(appointmentId, token, tenantSlug);
          showSuccess('Success', 'Appointment started');
          break;
        case 'complete':
          await ehrApi.completeAppointment(appointmentId, token, tenantSlug);
          showSuccess('Success', 'Appointment completed');
          break;
        case 'no-show':
          await ehrApi.updateAppointmentStatus(appointmentId, 'no-show', token, tenantSlug);
          showSuccess('Success', 'Marked as no-show');
          break;
      }
      
      fetchAppointments();
      onAppointmentUpdate();
    } catch (error) {
      console.error(`Error ${action} appointment:`, error);
      showError('Error', `Failed to ${action} appointment`);
    }
  };

  const formatStatusLabel = (status: string) => {
    const normalizedStatus = status.replace('_', '-');
    switch (normalizedStatus) {
      case 'scheduled':
        return 'Scheduled';
      case 'confirmed':
        return 'Waiting';
      case 'in-progress':
      case 'in_progress':
        return 'In Progress';
      case 'completed':
        return 'Completed';
      case 'cancelled':
        return 'Cancelled';
      case 'no-show':
      case 'no_show':
        return 'No Show';
      case 'awaiting-payment':
        return 'Awaiting Payment';
      default:
        return normalizedStatus.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
    }
  };

  const getStatusColor = (status: string) => {
    const normalizedStatus = status.replace('_', '-');
    switch (normalizedStatus) {
      case 'scheduled': return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'confirmed': return 'bg-green-100 text-green-800 border-green-200';
      case 'in-progress': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'completed': return 'bg-gray-100 text-gray-800 border-gray-200';
      case 'cancelled': return 'bg-red-100 text-red-800 border-red-200';
      case 'no-show': return 'bg-orange-100 text-orange-800 border-orange-200';
      case 'awaiting-payment': return 'bg-amber-100 text-amber-800 border-amber-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getStatusIcon = (status: string) => {
    const normalizedStatus = status.replace('_', '-');
    switch (normalizedStatus) {
      case 'scheduled': return <Clock className="w-4 h-4" />;
      case 'confirmed': return <CheckCircle className="w-4 h-4" />;
      case 'in-progress': return <Play className="w-4 h-4" />;
      case 'completed': return <Square className="w-4 h-4" />;
      case 'cancelled': return <AlertCircle className="w-4 h-4" />;
      case 'no-show': return <XCircle className="w-4 h-4" />;
      case 'awaiting-payment': return <AlertTriangle className="w-4 h-4" />;
      default: return <Clock className="w-4 h-4" />;
    }
  };

  const formatTime = (dateString: string) => {
    return new Date(dateString).toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    });
  };

  const getWaitTime = (appointment: Appointment) => {
    if (appointment.status === 'completed' || appointment.status === 'cancelled') return null;
    
    const now = new Date();
    const appointmentTime = new Date(appointment.appointmentDate);
    const diffMinutes = Math.floor((now.getTime() - appointmentTime.getTime()) / (1000 * 60));
    
    if (diffMinutes < 0) return `In ${Math.abs(diffMinutes)} min`;
    if (diffMinutes < 60) return `${diffMinutes} min ago`;
    return `${Math.floor(diffMinutes / 60)}h ${diffMinutes % 60}m ago`;
  };

  const filteredAppointments = displayAppointments.filter(appointment => {
    const matchesSearch = searchTerm === '' || 
      `${appointment.patient.firstName} ${appointment.patient.lastName}`.toLowerCase().includes(searchTerm.toLowerCase()) ||
      appointment.patient.patientNumber.toLowerCase().includes(searchTerm.toLowerCase());
    
    // Handle both status formats (with hyphen and underscore)
    const normalizedStatus = appointment.status.replace('_', '-');
    const normalizedFilterStatus = filterStatus.replace('_', '-');
    const matchesStatus = filterStatus === 'all' || normalizedStatus === normalizedFilterStatus;
    
    return matchesSearch && matchesStatus;
  });

  const getQueueStats = () => {
    // Debug: Log all appointment statuses
    console.log('🔍 PatientQueue - All appointments:', displayAppointments);
    console.log('🔍 PatientQueue - Appointment statuses:', displayAppointments.map(apt => ({ 
      id: apt.id, 
      patient: `${apt.patient.firstName} ${apt.patient.lastName}`, 
      status: apt.status 
    })));
    
    const stats = {
      waiting: displayAppointments.filter(apt => apt.status === 'confirmed').length,
      inProgress: displayAppointments.filter(apt => apt.status === 'in-progress' || apt.status === 'in_progress').length,
      completed: displayAppointments.filter(apt => apt.status === 'completed').length,
      noShow: displayAppointments.filter(apt => apt.status === 'no-show' || apt.status === 'no_show').length
    };
    
    console.log('📊 PatientQueue - Calculated stats:', stats);
    return stats;
  };

  const stats = getQueueStats();

  return (
    <div className="bg-white/70 backdrop-blur-sm rounded-2xl border border-slate-200/50 shadow-sm">
      {/* Header */}
      <div className="p-6 border-b border-slate-200">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold text-slate-900">Patient Queue</h2>
          <button
            onClick={fetchAppointments}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <RefreshCw className={`w-5 h-5 text-gray-600 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
          <div className="bg-blue-50 rounded-lg p-3">
            <div className="flex items-center gap-2">
              <Clock className="w-5 h-5 text-blue-600" />
              <div>
                <p className="text-sm text-blue-600">Waiting</p>
                <p className="text-2xl font-bold text-blue-900">{stats.waiting}</p>
              </div>
            </div>
          </div>
          <div className="bg-yellow-50 rounded-lg p-3">
            <div className="flex items-center gap-2">
              <Play className="w-5 h-5 text-yellow-600" />
              <div>
                <p className="text-sm text-yellow-600">In Progress</p>
                <p className="text-2xl font-bold text-yellow-900">{stats.inProgress}</p>
              </div>
            </div>
          </div>
          <div className="bg-green-50 rounded-lg p-3">
            <div className="flex items-center gap-2">
              <CheckCircle className="w-5 h-5 text-green-600" />
              <div>
                <p className="text-sm text-green-600">Completed</p>
                <p className="text-2xl font-bold text-green-900">{stats.completed}</p>
              </div>
            </div>
          </div>
          <div className="bg-orange-50 rounded-lg p-3">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-5 h-5 text-orange-600" />
              <div>
                <p className="text-sm text-orange-600">No Show</p>
                <p className="text-2xl font-bold text-orange-900">{stats.noShow}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search patients..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="all">All Status</option>
            <option value="scheduled">Scheduled</option>
            <option value="confirmed">Waiting</option>
            <option value="in-progress">In Progress</option>
            <option value="in_progress">In Progress (Alt)</option>
            <option value="completed">Completed</option>
            <option value="cancelled">Cancelled</option>
            <option value="no-show">No Show</option>
            <option value="awaiting_payment">Awaiting Payment</option>
          </select>
        </div>
      </div>

      {/* Queue List */}
      <div className="p-6">
        {loading ? (
          <div className="text-center py-8">
            <RefreshCw className="w-8 h-8 text-gray-400 animate-spin mx-auto mb-4" />
            <p className="text-gray-500">Loading queue...</p>
          </div>
        ) : filteredAppointments.length === 0 ? (
          <div className="text-center py-8">
            <User className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-500">No patients in queue</p>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredAppointments.map((appointment) => (
              <div
                key={appointment.id}
                className={`p-4 border rounded-lg transition-all hover:shadow-md ${
                  (appointment.status === 'in-progress' || appointment.status === 'in_progress')
                    ? 'border-yellow-300 bg-yellow-50' 
                    : appointment.status === 'confirmed'
                    ? 'border-green-300 bg-green-50'
                    : 'border-gray-200 bg-white'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="text-center">
                      <p className="text-sm text-gray-600">Time</p>
                      <p className="font-semibold text-gray-900">{formatTime(appointment.appointmentDate)}</p>
                    </div>
                    <div className="w-px h-12 bg-gray-200"></div>
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="font-semibold text-gray-900">
                          {appointment.patient.firstName} {appointment.patient.lastName}
                        </h3>
                        <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium border ${getStatusColor(appointment.status)}`}>
                          {getStatusIcon(appointment.status)}
                          {formatStatusLabel(appointment.status)}
                        </span>
                        {(appointment.status === 'completed' || appointment.status === 'Completed') && (
                          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium border bg-green-100 text-green-800 border-green-200">
                            <CheckCircle className="w-3 h-3" />
                            Completed
                          </span>
                        )}
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm text-gray-600">
                        <div>
                          <p><span className="font-medium">ID:</span> {appointment.patient.patientNumber}</p>
                          <p><span className="font-medium">Type:</span> {appointment.appointmentType}</p>
                        </div>
                        <div>
                          <p><span className="font-medium">Reason:</span> {appointment.reason}</p>
                          <p><span className="font-medium">Duration:</span> {appointment.durationMinutes} min</p>
                        </div>
                        <div>
                          <p><span className="font-medium">Phone:</span> {appointment.patient.phone || 'Not provided'}</p>
                          {getWaitTime(appointment) && (
                            <p className="text-orange-600 font-medium">
                              <Clock className="w-3 h-3 inline mr-1" />
                              {getWaitTime(appointment)}
                            </p>
                          )}
                        </div>
                      </div>
                      <div className="mt-2">
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
                  
                  <div className="flex gap-2">
                    {/* Primary status control first (Check In / Start / Complete) */}
                    {(() => {
                      const normalizedStatus = appointment.status.replace('_', '-');
                      if (normalizedStatus === 'awaiting-payment') {
                        return (
                          <span className="px-3 py-1 bg-amber-100 text-amber-800 border border-amber-200 rounded-lg text-sm flex items-center gap-1">
                            <CreditCard className="w-4 h-4" />
                            Awaiting Payment
                          </span>
                        );
                      }
                      if (normalizedStatus === 'scheduled') {
                        return (
                          <button
                            onClick={() => handleAppointmentAction(appointment.id, 'check-in')}
                            className="px-3 py-1 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-sm flex items-center gap-1"
                          >
                            <CheckCircle className="w-4 h-4" />
                            Check In
                          </button>
                        );
                      } else if (normalizedStatus === 'confirmed') {
                        return (
                          <button
                            onClick={() => handleAppointmentAction(appointment.id, 'start')}
                            className="px-3 py-1 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm flex items-center gap-1"
                          >
                            <Play className="w-4 h-4" />
                            Start
                          </button>
                        );
                      } else if (normalizedStatus === 'in-progress' || normalizedStatus === 'in_progress') {
                        return (
                          <button
                            onClick={() => handleAppointmentAction(appointment.id, 'complete')}
                            className="px-3 py-1 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-sm flex items-center gap-1"
                          >
                            <Square className="w-4 h-4" />
                            Complete
                          </button>
                        );
                      }
                      return null;
                    })()}
                    <button
                      onClick={() => navigate(`/ehr/${tenantSlug}/doctor/patients/${appointment.patient.id}`)}
                      className="px-3 py-1 bg-slate-600 text-white rounded-lg hover:bg-slate-700 transition-colors text-sm flex items-center gap-1"
                    >
                      <User className="w-4 h-4" />
                      View Patient
                    </button>
                  </div>
                </div>
                {appointment.paymentStatus === 'awaiting_payment' && (
                  <div className="mt-3 p-3 rounded-lg border border-amber-200 bg-amber-50 text-amber-800 text-sm flex gap-2">
                    <CreditCard className="w-4 h-4 mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="font-semibold">Payment required</p>
                      <p>
                        Please direct the patient to the Accounts desk to confirm payment before starting this consultation.
                      </p>
                      {typeof appointment.feeAmount === 'number' && (
                        <p className="mt-1">
                          Outstanding fee: <span className="font-semibold">${appointment.feeAmount.toFixed(2)}</span>
                        </p>
                      )}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default PatientQueue;
