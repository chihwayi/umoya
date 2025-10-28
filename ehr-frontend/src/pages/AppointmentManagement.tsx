import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Calendar, Clock, User, Plus, Search, Filter, ArrowLeft } from 'lucide-react';
import CreateAppointmentModal from '../components/CreateAppointmentModal.tsx';
import { useNotification } from '../components/GlobalNotification.tsx';
import { ehrApi } from '../services/api.ts';

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

const AppointmentManagement: React.FC = () => {
  const { tenantSlug } = useParams<{ tenantSlug: string }>();
  const navigate = useNavigate();
  const { showError, showSuccess } = useNotification();
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [statusFilter, setStatusFilter] = useState('all');

  useEffect(() => {
    fetchAppointments();
  }, [selectedDate, statusFilter]);

  const fetchAppointments = async () => {
    try {
      console.log('🔄 Frontend: fetchAppointments called');
      const token = localStorage.getItem('ehr_token');
      console.log('🔑 Token exists:', !!token);
      console.log('🏢 Tenant slug:', tenantSlug);
      
      if (!token || !tenantSlug) {
        console.log('❌ Missing token or tenant slug');
        return;
      }
      
      const params: any = {};
      // Temporarily remove date filter
      // if (selectedDate) params.date = selectedDate;
      if (statusFilter !== 'all') params.status = statusFilter;
      
      console.log('📋 Request params:', params);
      console.log('🌐 Making API call...');
      
      const response = await ehrApi.getAppointments(token, tenantSlug, params);
      console.log('✅ API response:', response);
      console.log('📊 Response data:', response.data);
      console.log('📊 Appointments in response:', response.data.appointments || response.data || []);
      
      setAppointments(response.data.appointments || response.data || []);
    } catch (error: any) {
      console.error('❌ Error fetching appointments:', error);
      console.error('❌ Error response:', error.response);
      if (error.response?.status === 404) {
        setAppointments([]);
      } else {
        showError('Error', 'Failed to load appointments');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleCreateAppointment = () => {
    setShowCreateModal(false);
    fetchAppointments();
    showSuccess('Success', 'Appointment created successfully');
  };

  const handleStatusUpdate = async (appointmentId: string, newStatus: string) => {
    try {
      const token = localStorage.getItem('ehr_token');
      const response = await fetch(`http://localhost:3013/api/appointments/${appointmentId}/status`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
          'X-Tenant-ID': 'bulawayo-general',
        },
        body: JSON.stringify({ status: newStatus }),
      });

      if (response.ok) {
        fetchAppointments();
        showSuccess('Success', 'Appointment status updated');
      }
    } catch (error) {
      console.error('Error updating appointment:', error);
      showError('Update Failed', 'Failed to update appointment');
    }
  };

  const handleQuickAction = async (appointmentId: string, action: string) => {
    try {
      const token = localStorage.getItem('ehr_token');
      const response = await fetch(`http://localhost:3013/api/appointments/${appointmentId}/${action}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
          'X-Tenant-ID': 'bulawayo-general',
        },
      });

      if (response.ok) {
        fetchAppointments();
        const actionMessages = {
          'check-in': 'Patient checked in successfully',
          'start': 'Appointment started',
          'complete': 'Appointment completed'
        };
        showSuccess('Success', actionMessages[action as keyof typeof actionMessages] || 'Action completed');
      }
    } catch (error) {
      console.error('Error performing action:', error);
      showError('Action Failed', 'Failed to perform action');
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'scheduled': return 'bg-blue-100 text-blue-800';
      case 'confirmed': return 'bg-green-100 text-green-800';
      case 'in_progress': return 'bg-yellow-100 text-yellow-800';
      case 'completed': return 'bg-gray-100 text-gray-800';
      case 'cancelled': return 'bg-red-100 text-red-800';
      case 'no_show': return 'bg-orange-100 text-orange-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'consultation': return 'bg-blue-50 border-blue-200';
      case 'follow_up': return 'bg-green-50 border-green-200';
      case 'emergency': return 'bg-red-50 border-red-200';
      case 'procedure': return 'bg-purple-50 border-purple-200';
      default: return 'bg-gray-50 border-gray-200';
    }
  };

  const filteredAppointments = appointments.filter(appointment =>
    appointment.patient.firstName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    appointment.patient.lastName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    appointment.patient.patientNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
    appointment.doctor.firstName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    appointment.doctor.lastName.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const formatTime = (dateString: string) => {
    return new Date(dateString).toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 flex items-center justify-center">
        <div className="bg-white/70 backdrop-blur-sm rounded-2xl p-8 border border-slate-200/50">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="text-slate-600 mt-4 text-center">Loading appointments...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50">
      <div className="p-6 max-w-7xl mx-auto">
        {/* Back Button */}
        <button
          onClick={() => navigate(`/ehr/${tenantSlug}/dashboard`)}
          className="flex items-center gap-2 text-slate-600 hover:text-slate-800 mb-4 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span className="text-sm">Back to Dashboard</span>
        </button>

        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-gradient-to-r from-blue-500 to-indigo-600 rounded-xl">
              <Calendar className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-800">Appointment Management</h1>
              <p className="text-slate-600">Schedule and manage patient appointments</p>
            </div>
          </div>
          
          <button
            onClick={() => setShowCreateModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-blue-500 to-indigo-600 text-white rounded-lg hover:from-blue-600 hover:to-indigo-700 transition-all"
          >
            <Plus className="w-4 h-4" />
            New Appointment
          </button>
        </div>

        {/* Filters */}
        <div className="bg-white/70 backdrop-blur-sm rounded-2xl border border-slate-200/50 p-4 mb-6">
        <div className="flex flex-wrap gap-4 items-center">
          <div className="flex items-center gap-2">
            <Calendar className="h-5 w-5 text-gray-500" />
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          <div className="flex items-center gap-2">
            <Filter className="h-5 w-5 text-gray-500" />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="all">All Status</option>
              <option value="scheduled">Scheduled</option>
              <option value="confirmed">Confirmed</option>
              <option value="in_progress">In Progress</option>
              <option value="completed">Completed</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </div>

          <div className="flex items-center gap-2 flex-1 max-w-md">
            <Search className="h-5 w-5 text-gray-500" />
            <input
              type="text"
              placeholder="Search patients or doctors..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="flex-1 border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
        </div>
      </div>

      {/* Appointments List */}
      <div className="space-y-4">
        {filteredAppointments.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-xl shadow-sm border border-gray-200">
            <Calendar className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No appointments found</h3>
            <p className="text-slate-500">No appointments scheduled for the selected criteria.</p>
          </div>
        ) : (
          filteredAppointments.map((appointment) => (
            <div
              key={appointment.id}
              className={`bg-white rounded-xl shadow-sm border-2 p-6 hover:shadow-md transition-shadow ${getTypeColor(appointment.appointmentType)}`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="bg-blue-100 p-3 rounded-full">
                    <Clock className="h-6 w-6 text-blue-600" />
                  </div>
                  <div>
                    <div className="flex items-center gap-3 mb-1">
                      <h3 className="text-lg font-semibold text-gray-900">
                        {appointment.patient.firstName} {appointment.patient.lastName}
                      </h3>
                      <span className="text-sm text-gray-500">
                        ({appointment.patient.patientNumber})
                      </span>
                    </div>
                    <div className="flex items-center gap-4 text-sm text-gray-600">
                      <div className="flex items-center gap-1">
                        <User className="h-4 w-4" />
                        Dr. {appointment.doctor.firstName} {appointment.doctor.lastName}
                      </div>
                      <div className="flex items-center gap-1">
                        <Clock className="h-4 w-4" />
                        {formatTime(appointment.appointmentDate)} ({appointment.durationMinutes} min)
                      </div>
                    </div>
                    {appointment.reason && (
                      <p className="text-sm text-gray-600 mt-1">
                        <strong>Reason:</strong> {appointment.reason}
                      </p>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <span className="text-sm font-medium text-gray-700 capitalize">
                    {appointment.appointmentType.replace('_', ' ')}
                  </span>
                  
                  {/* Quick Action Buttons */}
                  <div className="flex gap-2">
                    {appointment.status === 'scheduled' && (
                      <button
                        onClick={() => handleQuickAction(appointment.id, 'check-in')}
                        className="px-3 py-1 bg-blue-100 text-blue-700 rounded-lg text-sm hover:bg-blue-200 transition-colors"
                      >
                        Check In
                      </button>
                    )}
                    {appointment.status === 'confirmed' && (
                      <button
                        onClick={() => handleQuickAction(appointment.id, 'start')}
                        className="px-3 py-1 bg-green-100 text-green-700 rounded-lg text-sm hover:bg-green-200 transition-colors"
                      >
                        Start
                      </button>
                    )}
                    {appointment.status === 'in_progress' && (
                      <button
                        onClick={() => handleQuickAction(appointment.id, 'complete')}
                        className="px-3 py-1 bg-purple-100 text-purple-700 rounded-lg text-sm hover:bg-purple-200 transition-colors"
                      >
                        Complete
                      </button>
                    )}
                  </div>
                  
                  <select
                    value={appointment.status}
                    onChange={(e) => handleStatusUpdate(appointment.id, e.target.value)}
                    className={`px-3 py-1 rounded-full text-sm font-medium border-0 ${getStatusColor(appointment.status)}`}
                  >
                    <option value="scheduled">Scheduled</option>
                    <option value="confirmed">Confirmed</option>
                    <option value="in_progress">In Progress</option>
                    <option value="completed">Completed</option>
                    <option value="cancelled">Cancelled</option>
                    <option value="no_show">No Show</option>
                  </select>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

        {/* Create Appointment Modal */}
        {showCreateModal && (
          <CreateAppointmentModal
            onClose={() => setShowCreateModal(false)}
            onSuccess={handleCreateAppointment}
          />
        )}
      </div>
    </div>
  );
};

export default AppointmentManagement;