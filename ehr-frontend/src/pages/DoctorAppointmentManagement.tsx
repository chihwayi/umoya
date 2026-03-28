import React, { useCallback, useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  ArrowLeft, Calendar, Clock, Search,
  Eye, CheckCircle, XCircle,
  AlertCircle, Play, Square, RefreshCw
} from 'lucide-react';
import { ehrApi } from '../services/api';
import { useNotification } from '../components/GlobalNotification';
import { useConfirmation } from '../hooks/useConfirmation';
import { formatDateToDDMMYYYY, formatDateTimeToDDMMYYYYHHMM } from '../utils/dateFormatting';
import { formatDateForAPI } from '../utils/dateUtils';
import DatePicker from '../components/DatePicker';
import AppointmentWaitlist from '../components/AppointmentWaitlist';

interface Appointment {
  id: string;
  patient: {
    id: string;
    firstName: string;
    lastName: string;
    patientNumber: string;
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

interface DoctorAppointmentManagementProps {
  embedded?: boolean;
}

const DoctorAppointmentManagement: React.FC<DoctorAppointmentManagementProps> = ({ embedded = false }) => {
  const { tenantSlug } = useParams<{ tenantSlug: string }>();
  const navigate = useNavigate();
  const { showSuccess, showError } = useNotification();
  const { confirm, Dialog } = useConfirmation();
  
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [filterStatus, setFilterStatus] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [currentUser, setCurrentUser] = useState<any>(null);

  useEffect(() => {
    const userData = localStorage.getItem('ehr_user');
    if (userData) {
      setCurrentUser(JSON.parse(userData));
    }
  }, []);

  const fetchAppointments = useCallback(async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('ehr_token');
      if (!token || !currentUser) return;

      const response = await ehrApi.getAppointments(token, tenantSlug!, {
        date: formatDateForAPI(formatDateToDDMMYYYY(selectedDate))
      });
      
      // Filter appointments for current doctor
      const doctorAppointments = response.data.appointments.filter(
        (apt: Appointment) => apt.doctor.id === currentUser.id
      );
      
      setAppointments(doctorAppointments);
    } catch (error) {
      console.error('Error fetching appointments:', error);
      showError('Error', 'Failed to fetch appointments');
    } finally {
      setLoading(false);
    }
  }, [currentUser, selectedDate, showError, tenantSlug]);

  useEffect(() => {
    if (currentUser) {
      fetchAppointments();
    }
  }, [currentUser, fetchAppointments]);

  const getStatusColor = (status: string) => {
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

  const handleAppointmentAction = async (appointmentId: string, action: string) => {
    try {
      const token = localStorage.getItem('ehr_token');
      if (!token) return;

      // Show confirmation for cancel action
      if (action === 'cancel') {
        const confirmed = await confirm({
          title: 'Cancel Appointment',
          message: 'Are you sure you want to cancel this appointment? This action will notify the patient.',
          type: 'warning',
          confirmText: 'Yes, Cancel',
          cancelText: 'Keep Appointment',
        });
        if (!confirmed) return;
      }

      switch (action) {
        case 'start':
          await ehrApi.startAppointment(appointmentId, token, tenantSlug!);
          showSuccess('Success', 'Appointment started successfully');
          break;
        case 'complete':
          await ehrApi.completeAppointment(appointmentId, token, tenantSlug!);
          showSuccess('Success', 'Appointment completed successfully');
          break;
        case 'cancel':
          await ehrApi.updateAppointmentStatus(appointmentId, 'cancelled', token, tenantSlug!);
          showSuccess('Success', 'Appointment cancelled successfully');
          break;
      }
      
      fetchAppointments();
    } catch (error) {
      console.error('Error updating appointment:', error);
      showError('Error', 'Failed to update appointment');
    }
  };

  const filteredAppointments = appointments.filter(appointment => {
    const matchesStatus = filterStatus === 'all' || appointment.status === filterStatus;
    const matchesSearch = searchTerm === '' || 
      appointment.patient.firstName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      appointment.patient.lastName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      appointment.patient.patientNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
      appointment.appointmentType.toLowerCase().includes(searchTerm.toLowerCase());
    
    return matchesStatus && matchesSearch;
  });

  const getAppointmentStats = () => {
    const total = appointments.length;
    const scheduled = appointments.filter(apt => apt.status === 'scheduled').length;
    const confirmed = appointments.filter(apt => apt.status === 'confirmed').length;
    const inProgress = appointments.filter(apt => apt.status === 'in-progress').length;
    const completed = appointments.filter(apt => apt.status === 'completed').length;
    const cancelled = appointments.filter(apt => apt.status === 'cancelled').length;
    const noShow = appointments.filter(apt => apt.status === 'no-show').length;

    return { total, scheduled, confirmed, inProgress, completed, cancelled, noShow };
  };

  const stats = getAppointmentStats();

  return (
    <div className={embedded ? '' : 'min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50'}>
      {!embedded && (
        <div className="bg-white/80 backdrop-blur-sm shadow-lg border-b border-slate-200/50 sticky top-0 z-10">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex items-center justify-between h-20">
              <div className="flex items-center gap-6">
                <button
                  onClick={() => navigate(`/ehr/${tenantSlug}/doctor`)}
                  className="p-3 hover:bg-slate-100 rounded-xl transition-all duration-200 group"
                >
                  <ArrowLeft className="w-5 h-5 text-slate-600 group-hover:text-slate-900 transition-colors" />
                </button>
                <div className="flex items-center gap-4">
                  <div className="p-3 bg-gradient-to-r from-blue-500 to-indigo-600 rounded-2xl shadow-lg">
                    <Calendar className="w-7 h-7 text-white" />
                  </div>
                  <div>
                    <h1 className="text-2xl font-bold text-slate-900">My Appointments</h1>
                    <p className="text-slate-600 font-medium">Manage your patient appointments</p>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <button
                  onClick={fetchAppointments}
                  disabled={loading}
                  className="p-3 hover:bg-slate-100 rounded-xl transition-all duration-200 disabled:opacity-50 group"
                >
                  <RefreshCw className={`w-5 h-5 text-slate-600 group-hover:text-slate-900 transition-colors ${loading ? 'animate-spin' : ''}`} />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className={embedded ? 'space-y-8' : 'max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8'}>
        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-6">
          <div className="bg-gradient-to-br from-white to-slate-50 rounded-2xl shadow-lg border border-slate-200/50 p-6 hover:shadow-xl transition-all duration-300">
            <div className="flex items-center justify-between mb-3">
              <div className="p-2 bg-gradient-to-r from-slate-500 to-slate-600 rounded-xl">
                <Calendar className="w-5 h-5 text-white" />
              </div>
              <div className="text-3xl font-bold text-slate-900">{stats.total}</div>
            </div>
            <div className="text-sm font-semibold text-slate-600">Total</div>
          </div>
          <div className="bg-gradient-to-br from-white to-blue-50 rounded-2xl shadow-lg border border-blue-200/50 p-6 hover:shadow-xl transition-all duration-300">
            <div className="flex items-center justify-between mb-3">
              <div className="p-2 bg-gradient-to-r from-blue-500 to-cyan-600 rounded-xl">
                <Calendar className="w-5 h-5 text-white" />
              </div>
              <div className="text-3xl font-bold text-blue-600">{stats.scheduled}</div>
            </div>
            <div className="text-sm font-semibold text-slate-600">Scheduled</div>
          </div>
          <div className="bg-gradient-to-br from-white to-green-50 rounded-2xl shadow-lg border border-green-200/50 p-6 hover:shadow-xl transition-all duration-300">
            <div className="flex items-center justify-between mb-3">
              <div className="p-2 bg-gradient-to-r from-green-500 to-emerald-600 rounded-xl">
                <CheckCircle className="w-5 h-5 text-white" />
              </div>
              <div className="text-3xl font-bold text-green-600">{stats.confirmed}</div>
            </div>
            <div className="text-sm font-semibold text-slate-600">Confirmed</div>
          </div>
          <div className="bg-gradient-to-br from-white to-yellow-50 rounded-2xl shadow-lg border border-yellow-200/50 p-6 hover:shadow-xl transition-all duration-300">
            <div className="flex items-center justify-between mb-3">
              <div className="p-2 bg-gradient-to-r from-yellow-500 to-amber-600 rounded-xl">
                <Clock className="w-5 h-5 text-white" />
              </div>
              <div className="text-3xl font-bold text-yellow-600">{stats.inProgress}</div>
            </div>
            <div className="text-sm font-semibold text-slate-600">In Progress</div>
          </div>
          <div className="bg-gradient-to-br from-white to-emerald-50 rounded-2xl shadow-lg border border-emerald-200/50 p-6 hover:shadow-xl transition-all duration-300">
            <div className="flex items-center justify-between mb-3">
              <div className="p-2 bg-gradient-to-r from-emerald-500 to-green-600 rounded-xl">
                <CheckCircle className="w-5 h-5 text-white" />
              </div>
              <div className="text-3xl font-bold text-emerald-600">{stats.completed}</div>
            </div>
            <div className="text-sm font-semibold text-slate-600">Completed</div>
          </div>
          <div className="bg-gradient-to-br from-white to-red-50 rounded-2xl shadow-lg border border-red-200/50 p-6 hover:shadow-xl transition-all duration-300">
            <div className="flex items-center justify-between mb-3">
              <div className="p-2 bg-gradient-to-r from-red-500 to-rose-600 rounded-xl">
                <XCircle className="w-5 h-5 text-white" />
              </div>
              <div className="text-3xl font-bold text-red-600">{stats.cancelled}</div>
            </div>
            <div className="text-sm font-semibold text-slate-600">Cancelled</div>
          </div>
          <div className="bg-gradient-to-br from-white to-orange-50 rounded-2xl shadow-lg border border-orange-200/50 p-6 hover:shadow-xl transition-all duration-300">
            <div className="flex items-center justify-between mb-3">
              <div className="p-2 bg-gradient-to-r from-orange-500 to-amber-600 rounded-xl">
                <AlertCircle className="w-5 h-5 text-white" />
              </div>
              <div className="text-3xl font-bold text-orange-600">{stats.noShow}</div>
            </div>
            <div className="text-sm font-semibold text-slate-600">No Show</div>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-gradient-to-br from-white to-slate-50 rounded-2xl shadow-lg border border-slate-200/50 p-8">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2 bg-gradient-to-r from-indigo-500 to-purple-600 rounded-xl">
              <Search className="w-5 h-5 text-white" />
            </div>
            <h3 className="text-lg font-bold text-slate-900">Search & Filter Appointments</h3>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-3">Date Filter</label>
              <DatePicker
                value={selectedDate.toISOString().split('T')[0]}
                onChange={(newValue: string) => setSelectedDate(new Date(newValue))}
                placeholder="Select date"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-3">Status Filter</label>
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="w-full border border-slate-300 rounded-xl px-4 py-3 focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all duration-200 bg-white/50"
              >
                <option value="all">All Statuses</option>
                <option value="scheduled">Scheduled</option>
                <option value="confirmed">Confirmed</option>
                <option value="in-progress">In Progress</option>
                <option value="completed">Completed</option>
                <option value="cancelled">Cancelled</option>
                <option value="no-show">No Show</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-3">Search Appointments</label>
              <div className="relative">
                <Search className="w-5 h-5 absolute left-4 top-1/2 transform -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search by patient name, type, reason..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-12 pr-4 py-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all duration-200 bg-white/50"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Appointments List */}
        <div className="bg-gradient-to-br from-white to-slate-50 rounded-2xl shadow-lg border border-slate-200/50 overflow-hidden">
          <div className="bg-gradient-to-r from-slate-50 to-blue-50 p-8 border-b border-slate-200/50">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-gradient-to-r from-blue-500 to-indigo-600 rounded-xl">
                <Calendar className="w-6 h-6 text-white" />
              </div>
              <div>
                <h3 className="text-xl font-bold text-slate-900">
                  Appointments for {formatDateToDDMMYYYY(selectedDate)}
                </h3>
                <p className="text-sm text-slate-600 font-medium">
                  {filteredAppointments.length} appointment(s) found
                </p>
              </div>
            </div>
          </div>
          
          <div className="p-6">
            {loading ? (
              <div className="text-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
                <p className="text-slate-600">Loading appointments...</p>
              </div>
            ) : filteredAppointments.length === 0 ? (
              <div className="text-center py-8">
                <Calendar className="w-12 h-12 text-slate-400 mx-auto mb-4" />
                <p className="text-slate-500">No appointments found for the selected criteria</p>
              </div>
            ) : (
              <div className="space-y-4">
                {filteredAppointments.map((appointment) => (
                  <div key={appointment.id} className="border border-slate-200 rounded-lg p-4 hover:bg-slate-50 transition-colors">
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <h4 className="font-semibold text-slate-900">
                            {appointment.patient.firstName} {appointment.patient.lastName}
                          </h4>
                          <span className="text-sm text-slate-500">#{appointment.patient.patientNumber}</span>
                          <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(appointment.status)}`}>
                            {getStatusIcon(appointment.status)}
                            {appointment.status}
                          </span>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm text-slate-600">
                          <div>
                            <span className="font-medium">Time:</span> {formatDateTimeToDDMMYYYYHHMM(appointment.appointmentDate)}
                          </div>
                          <div>
                            <span className="font-medium">Type:</span> {appointment.appointmentType}
                          </div>
                          <div>
                            <span className="font-medium">Duration:</span> {appointment.durationMinutes} min
                          </div>
                        </div>
                        {appointment.reason && (
                          <p className="text-sm text-slate-600 mt-2">
                            <span className="font-medium">Reason:</span> {appointment.reason}
                          </p>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => navigate(`/ehr/${tenantSlug}/doctor/patients/${appointment.patient.id}`)}
                          className="p-2 text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                          title="View Patient"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        {appointment.status === 'scheduled' && (
                          <button
                            onClick={() => handleAppointmentAction(appointment.id, 'start')}
                            className="px-3 py-1 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-sm"
                          >
                            Start
                          </button>
                        )}
                        {appointment.status === 'in-progress' && (
                          <button
                            onClick={() => handleAppointmentAction(appointment.id, 'complete')}
                            className="px-3 py-1 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm"
                          >
                            Complete
                          </button>
                        )}
                        {(appointment.status === 'scheduled' || appointment.status === 'confirmed') && (
                          <button
                            onClick={() => handleAppointmentAction(appointment.id, 'cancel')}
                            className="px-3 py-1 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors text-sm"
                          >
                            Cancel
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div>
            <AppointmentWaitlist tenantSlug={tenantSlug!} onScheduled={fetchAppointments} />
          </div>
        </div>
      </div>
      {Dialog}
    </div>
  );
};

export default DoctorAppointmentManagement;
