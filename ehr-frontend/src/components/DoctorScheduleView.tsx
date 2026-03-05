import React, { useCallback, useEffect, useState } from 'react';
import { 
  Calendar, Clock, ChevronLeft, ChevronRight,
  Search, RefreshCw,
  CheckCircle, AlertCircle, Play, Square, XCircle
} from 'lucide-react';
import { useNotification } from '../components/GlobalNotification';
import { ehrApi } from '../services/api';
import { formatDateForAPI, formatDateForInput } from '../utils/dateUtils';
import AppointmentActions from './AppointmentActions';

interface Appointment {
  id: string;
  patient: {
    id: string;
    firstName: string;
    lastName: string;
    patientNumber: string;
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
}

interface DoctorScheduleViewProps {
  tenantSlug: string;
  token: string;
  onAppointmentUpdate: () => void;
  appointments?: Appointment[]; // Add appointments prop
}

const DoctorScheduleView: React.FC<DoctorScheduleViewProps> = ({
  tenantSlug,
  token,
  appointments: propAppointments = []
}) => {
  const { showError } = useNotification();
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(false);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [viewMode, setViewMode] = useState<'day' | 'week' | 'month'>('week');
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');

  // Use appointments from props if available, otherwise use local state
  const displayAppointments = propAppointments.length > 0 ? propAppointments : appointments;

  const fetchAppointments = useCallback(async () => {
    try {
      setLoading(true);
      console.log('🔍 DoctorScheduleView - Fetching appointments independently');
      
      // For now, we'll fetch appointments for the current date only
      // The backend API only supports single date filtering, not date ranges
      const response = await ehrApi.getAppointments(token, tenantSlug, {
        date: formatDateForAPI(formatDateForInput(currentDate))
      });
      
      console.log('🔍 DoctorScheduleView - All appointments from API:', response.data.appointments);
      
      // Get current user from localStorage for filtering
      const userData = localStorage.getItem('ehr_user');
      const currentUser = userData ? JSON.parse(userData) : null;
      console.log('🔍 DoctorScheduleView - Current user:', currentUser);
      
      // Filter by doctor if user is available
      const filteredAppointments = currentUser 
        ? response.data.appointments.filter((apt: any) => apt.doctor.id === currentUser.id)
        : response.data.appointments;
      
      console.log('🔍 DoctorScheduleView - Filtered appointments:', filteredAppointments);
      setAppointments(filteredAppointments);
    } catch (error) {
      console.error('Error fetching appointments:', error);
      showError('Error', 'Failed to fetch appointments');
    } finally {
      setLoading(false);
    }
  }, [currentDate, showError, tenantSlug, token]);

  useEffect(() => {
    if (propAppointments.length === 0) {
      fetchAppointments();
    }
  }, [fetchAppointments, propAppointments.length, viewMode]);

  const getStartOfPeriod = (date: Date, mode: string) => {
    const d = new Date(date);
    switch (mode) {
      case 'day':
        return d;
      case 'week':
        const day = d.getDay();
        const diff = d.getDate() - day;
        return new Date(d.setDate(diff));
      case 'month':
        return new Date(d.getFullYear(), d.getMonth(), 1);
      default:
        return d;
    }
  };

  const getEndOfPeriod = (date: Date, mode: string) => {
    const d = new Date(date);
    switch (mode) {
      case 'day':
        return d;
      case 'week':
        const day = d.getDay();
        const diff = d.getDate() - day + 6;
        return new Date(d.setDate(diff));
      case 'month':
        return new Date(d.getFullYear(), d.getMonth() + 1, 0);
      default:
        return d;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'scheduled': return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'confirmed': return 'bg-green-100 text-green-800 border-green-200';
      case 'in-progress': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'completed': return 'bg-gray-100 text-gray-800 border-gray-200';
      case 'cancelled': return 'bg-red-100 text-red-800 border-red-200';
      case 'no-show': return 'bg-orange-100 text-orange-800 border-orange-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getStatusIcon = (status: string) => {
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

  const formatTime = (dateString: string) => {
    return new Date(dateString).toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    });
  };

  const navigatePeriod = (direction: 'prev' | 'next') => {
    const newDate = new Date(currentDate);
    switch (viewMode) {
      case 'day':
        newDate.setDate(newDate.getDate() + (direction === 'next' ? 1 : -1));
        break;
      case 'week':
        newDate.setDate(newDate.getDate() + (direction === 'next' ? 7 : -7));
        break;
      case 'month':
        newDate.setMonth(newDate.getMonth() + (direction === 'next' ? 1 : -1));
        break;
    }
    setCurrentDate(newDate);
  };

  const goToToday = () => {
    setCurrentDate(new Date());
  };

  const getPeriodTitle = () => {
    switch (viewMode) {
      case 'day':
        return currentDate.toLocaleDateString('en-US', {
          weekday: 'long',
          year: 'numeric',
          month: 'long',
          day: 'numeric'
        });
      case 'week':
        const start = getStartOfPeriod(currentDate, 'week');
        const end = getEndOfPeriod(currentDate, 'week');
        return `${start.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - ${end.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`;
      case 'month':
        return currentDate.toLocaleDateString('en-US', {
          year: 'numeric',
          month: 'long'
        });
      default:
        return '';
    }
  };

  const getAppointmentsForDate = (date: Date) => {
    return filteredAppointments.filter(apt => {
      const aptDate = new Date(apt.appointmentDate);
      return aptDate.toDateString() === date.toDateString();
    });
  };

  const getWeekDays = () => {
    const start = getStartOfPeriod(currentDate, 'week');
    const days = [];
    for (let i = 0; i < 7; i++) {
      const day = new Date(start);
      day.setDate(start.getDate() + i);
      days.push(day);
    }
    return days;
  };

  const filteredAppointments = displayAppointments.filter(appointment => {
    const matchesSearch = searchTerm === '' || 
      `${appointment.patient.firstName} ${appointment.patient.lastName}`.toLowerCase().includes(searchTerm.toLowerCase()) ||
      appointment.patient.patientNumber.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesStatus = filterStatus === 'all' || appointment.status === filterStatus;
    
    return matchesSearch && matchesStatus;
  });

  const renderDayView = () => {
    const dayAppointments = getAppointmentsForDate(currentDate);
    
    return (
      <div className="space-y-4">
        {dayAppointments.length === 0 ? (
          <div className="text-center py-8">
            <Calendar className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-500">No appointments scheduled for this day</p>
          </div>
        ) : (
          dayAppointments.map((appointment) => (
            <div key={appointment.id} className="bg-white border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="text-center">
                    <p className="text-sm text-gray-600">Time</p>
                    <p className="font-semibold text-gray-900">{formatTime(appointment.appointmentDate)}</p>
                  </div>
                  <div className="w-px h-12 bg-gray-200"></div>
                  <div className="flex-1">
                    <h3 className="font-semibold text-gray-900">
                      {appointment.patient.firstName} {appointment.patient.lastName}
                    </h3>
                    <p className="text-gray-600">{appointment.reason}</p>
                    <p className="text-sm text-gray-500">{appointment.appointmentType} • {appointment.durationMinutes} min</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <AppointmentActions
                    appointment={appointment}
                    onUpdate={fetchAppointments}
                    tenantSlug={tenantSlug}
                    token={token}
                  />
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    );
  };

  const renderWeekView = () => {
    const weekDays = getWeekDays();
    
    return (
      <div className="grid grid-cols-7 gap-4">
        {weekDays.map((day, index) => {
          const dayAppointments = getAppointmentsForDate(day);
          const isToday = day.toDateString() === new Date().toDateString();
          
          return (
            <div key={index} className={`rounded-lg border ${isToday ? 'border-blue-300 bg-blue-50' : 'border-gray-200 bg-white'}`}>
              <div className={`p-3 border-b ${isToday ? 'border-blue-200' : 'border-gray-200'}`}>
                <h3 className={`font-semibold ${isToday ? 'text-blue-900' : 'text-gray-900'}`}>
                  {day.toLocaleDateString('en-US', { weekday: 'short' })}
                </h3>
                <p className={`text-sm ${isToday ? 'text-blue-700' : 'text-gray-600'}`}>
                  {day.getDate()}
                </p>
              </div>
              <div className="p-3 space-y-2">
                {dayAppointments.length === 0 ? (
                  <p className="text-xs text-gray-400 text-center">No appointments</p>
                ) : (
                  dayAppointments.map((appointment) => (
                    <div key={appointment.id} className="text-xs bg-gray-100 rounded p-2">
                      <p className="font-medium truncate">
                        {appointment.patient.firstName} {appointment.patient.lastName}
                      </p>
                      <p className="text-gray-600">{formatTime(appointment.appointmentDate)}</p>
                      <span className={`inline-flex items-center gap-1 px-1 py-0.5 rounded text-xs ${getStatusColor(appointment.status)}`}>
                        {getStatusIcon(appointment.status)}
                        {appointment.status}
                      </span>
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

  const renderMonthView = () => {
    const monthStart = getStartOfPeriod(currentDate, 'month');
    const startDate = new Date(monthStart);
    startDate.setDate(startDate.getDate() - startDate.getDay());
    
    const weeks = [];
    for (let i = 0; i < 6; i++) {
      const week = [];
      for (let j = 0; j < 7; j++) {
        const date = new Date(startDate);
        date.setDate(startDate.getDate() + (i * 7) + j);
        week.push(date);
      }
      weeks.push(week);
    }

    return (
      <div className="space-y-2">
        {/* Month header */}
        <div className="grid grid-cols-7 gap-1 text-center text-sm font-medium text-gray-500 border-b pb-2">
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
            <div key={day} className="p-2">{day}</div>
          ))}
        </div>
        
        {/* Month grid */}
        {weeks.map((week, weekIndex) => (
          <div key={weekIndex} className="grid grid-cols-7 gap-1">
            {week.map((date, dayIndex) => {
              const dayAppointments = getAppointmentsForDate(date);
              const isCurrentMonth = date.getMonth() === currentDate.getMonth();
              const isToday = date.toDateString() === new Date().toDateString();
              
              return (
                <div
                  key={dayIndex}
                  className={`min-h-[100px] p-2 border rounded ${
                    isCurrentMonth 
                      ? isToday 
                        ? 'border-blue-300 bg-blue-50' 
                        : 'border-gray-200 bg-white'
                      : 'border-gray-100 bg-gray-50'
                  }`}
                >
                  <div className={`text-sm font-medium mb-1 ${
                    isCurrentMonth 
                      ? isToday 
                        ? 'text-blue-900' 
                        : 'text-gray-900'
                      : 'text-gray-400'
                  }`}>
                    {date.getDate()}
                  </div>
                  <div className="space-y-1">
                    {dayAppointments.slice(0, 3).map((appointment) => (
                      <div key={appointment.id} className="text-xs bg-gray-100 rounded p-1 truncate">
                        <p className="font-medium">
                          {appointment.patient.firstName} {appointment.patient.lastName}
                        </p>
                        <p className="text-gray-600">{formatTime(appointment.appointmentDate)}</p>
                      </div>
                    ))}
                    {dayAppointments.length > 3 && (
                      <p className="text-xs text-gray-500">+{dayAppointments.length - 3} more</p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ))}
      </div>
    );
  };

  return (
    <div className="bg-white/70 backdrop-blur-sm rounded-2xl border border-slate-200/50 shadow-sm">
      {/* Header */}
      <div className="p-6 border-b border-slate-200">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold text-slate-900">Schedule View</h2>
          <div className="flex items-center gap-2">
            <button
              onClick={goToToday}
              className="px-3 py-1 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              Today
            </button>
            <button
              onClick={fetchAppointments}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <RefreshCw className={`w-5 h-5 text-gray-600 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {/* View Controls */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setViewMode('day')}
              className={`px-3 py-1 rounded-lg text-sm font-medium transition-colors ${
                viewMode === 'day' 
                  ? 'bg-blue-600 text-white' 
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Day
            </button>
            <button
              onClick={() => setViewMode('week')}
              className={`px-3 py-1 rounded-lg text-sm font-medium transition-colors ${
                viewMode === 'week' 
                  ? 'bg-blue-600 text-white' 
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Week
            </button>
            <button
              onClick={() => setViewMode('month')}
              className={`px-3 py-1 rounded-lg text-sm font-medium transition-colors ${
                viewMode === 'month' 
                  ? 'bg-blue-600 text-white' 
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Month
            </button>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => navigatePeriod('prev')}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <ChevronLeft className="w-5 h-5 text-gray-600" />
            </button>
            <h3 className="text-lg font-semibold text-gray-900 min-w-[200px] text-center">
              {getPeriodTitle()}
            </h3>
            <button
              onClick={() => navigatePeriod('next')}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <ChevronRight className="w-5 h-5 text-gray-600" />
            </button>
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search appointments..."
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
            <option value="confirmed">Confirmed</option>
            <option value="in-progress">In Progress</option>
            <option value="completed">Completed</option>
            <option value="cancelled">Cancelled</option>
            <option value="no-show">No Show</option>
          </select>
        </div>
      </div>

      {/* Schedule Content */}
      <div className="p-6">
        {loading ? (
          <div className="text-center py-8">
            <RefreshCw className="w-8 h-8 text-gray-400 animate-spin mx-auto mb-4" />
            <p className="text-gray-500">Loading schedule...</p>
          </div>
        ) : (
          <>
            {viewMode === 'day' && renderDayView()}
            {viewMode === 'week' && renderWeekView()}
            {viewMode === 'month' && renderMonthView()}
          </>
        )}
      </div>
    </div>
  );
};

export default DoctorScheduleView;
