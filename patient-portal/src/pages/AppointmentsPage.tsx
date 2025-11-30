import React, { useState, useEffect } from 'react';
import { usePatientAuth } from '../contexts/PatientAuthContext';
import { patientPortalApi } from '../services/api';
import { Calendar, Clock, User, X, Plus, AlertCircle, ArrowLeft, CheckCircle, MapPin, FileText, Video, Phone } from 'lucide-react';
import { Link } from 'react-router-dom';
import { format } from 'date-fns';

const AppointmentsPage: React.FC = () => {
  const { token, patient } = usePatientAuth();
  const tenantSlug = localStorage.getItem('patient_tenant') || 'bulawayo-general';
  const [appointments, setAppointments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    loadAppointments();
  }, []);

  const loadAppointments = async () => {
    try {
      setLoading(true);
      setError('');
      const data = await patientPortalApi.getAppointments(token!, tenantSlug);
      // Handle both array and object with array property
      const appointmentsList = Array.isArray(data) ? data : (data?.appointments || data?.data || []);
      setAppointments(appointmentsList);
      if (appointmentsList.length === 0) {
        console.log('No appointments found for patient');
      }
    } catch (err: any) {
      console.error('Error loading appointments:', err);
      setError(err.message || 'Failed to load appointments');
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = async (id: string) => {
    if (!window.confirm('Are you sure you want to cancel this appointment?')) return;

    try {
      await patientPortalApi.cancelAppointment(id, token!, tenantSlug);
      await loadAppointments();
    } catch (err: any) {
      alert(err.message || 'Failed to cancel appointment');
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'scheduled': return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'completed': return 'bg-green-100 text-green-800 border-green-200';
      case 'cancelled': return 'bg-red-100 text-red-800 border-red-200';
      case 'awaiting_payment': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 via-white to-indigo-50">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">Loading your appointments...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50">
      {/* Header */}
      <header className="bg-white/80 backdrop-blur-sm shadow-sm border-b border-gray-200/50 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link
                to="/dashboard"
                className="w-10 h-10 bg-gradient-to-br from-indigo-600 to-purple-600 rounded-xl flex items-center justify-center shadow-lg hover:scale-105 transition-transform"
              >
                <ArrowLeft className="w-5 h-5 text-white" />
              </Link>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">My Appointments</h1>
                <p className="text-sm text-gray-600">View and manage your appointments</p>
              </div>
            </div>
            <Link
              to="/appointments/request"
              className="hidden md:flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-xl font-semibold hover:from-indigo-700 hover:to-purple-700 transition-all transform hover:scale-105 shadow-lg"
            >
              <Plus className="w-5 h-5" />
              Request Appointment
            </Link>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {error && (
          <div className="mb-6 p-4 bg-red-50 border-l-4 border-red-500 rounded-lg flex items-center gap-3 animate-shake">
            <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0" />
            <p className="text-sm font-medium text-red-800">{error}</p>
          </div>
        )}

        {appointments.length === 0 ? (
          <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-xl p-12 text-center border border-white/20">
            <div className="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-full mb-6 shadow-lg">
              <Calendar className="w-10 h-10 text-white" />
            </div>
            <h3 className="text-2xl font-bold text-gray-900 mb-2">No Appointments</h3>
            <p className="text-gray-600 mb-8 max-w-md mx-auto">
              You don't have any appointments scheduled yet. Request an appointment to get started.
            </p>
            <Link
              to="/appointments/request"
              className="inline-flex items-center gap-2 px-8 py-4 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-xl font-semibold hover:from-indigo-700 hover:to-purple-700 transition-all transform hover:scale-105 shadow-lg"
            >
              <Plus className="w-5 h-5" />
              Request Appointment
            </Link>
          </div>
        ) : (
          <div className="space-y-6">
            {appointments.map((apt) => (
              <div
                key={apt.id}
                className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-lg p-6 border border-white/20 hover:shadow-xl transition-all transform hover:scale-[1.01]"
              >
                <div className="flex flex-col md:flex-row items-start gap-4">
                  <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl flex items-center justify-center flex-shrink-0 shadow-lg">
                    {apt.isTelehealth ? (
                      <Video className="w-8 h-8 text-white" />
                    ) : (
                      <Calendar className="w-8 h-8 text-white" />
                    )}
                  </div>
                  
                  <div className="flex-1 w-full">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
                      <div>
                        <div className="flex items-center gap-3 mb-2 flex-wrap">
                          <h3 className="text-xl font-bold text-gray-900">
                            {format(new Date(apt.appointmentDate), 'EEEE, MMMM d, yyyy')}
                          </h3>
                          <span className={`px-3 py-1 rounded-full text-xs font-semibold border ${getStatusColor(apt.status)}`}>
                            {apt.status.charAt(0).toUpperCase() + apt.status.slice(1).replace('_', ' ')}
                          </span>
                          {apt.isTelehealth && (
                            <span className="px-3 py-1 bg-purple-100 text-purple-800 rounded-full text-xs font-semibold border border-purple-200 flex items-center gap-1">
                              <Video className="w-3 h-3" />
                              Telehealth
                            </span>
                          )}
                        </div>
                        <div className="flex flex-wrap items-center gap-4 text-gray-600">
                          <div className="flex items-center gap-2">
                            <Clock className="w-4 h-4" />
                            <span className="text-sm font-medium">
                              {format(new Date(apt.appointmentDate), 'h:mm a')}
                            </span>
                            <span className="text-xs">({apt.durationMinutes} min)</span>
                          </div>
                          {apt.doctor && (
                            <div className="flex items-center gap-2">
                              <User className="w-4 h-4" />
                              <span className="text-sm">
                                Dr. {apt.doctor.firstName} {apt.doctor.lastName}
                                {apt.doctor.specialization && ` - ${apt.doctor.specialization}`}
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                      
                      {apt.status === 'scheduled' && (
                        <button
                          onClick={() => handleCancel(apt.id)}
                          className="flex-shrink-0 px-4 py-2 text-red-600 hover:bg-red-50 rounded-xl transition-colors flex items-center gap-2 border border-red-200 hover:border-red-300 self-start sm:self-auto"
                        >
                          <X className="w-4 h-4" />
                          <span>Cancel</span>
                        </button>
                      )}

                      {apt.status === 'completed' && (
                        <div className="flex-shrink-0 px-4 py-2 bg-green-50 text-green-600 rounded-xl flex items-center gap-2 border border-green-200 self-start sm:self-auto">
                          <CheckCircle className="w-4 h-4" />
                          <span>Completed</span>
                        </div>
                      )}
                    </div>

                    {apt.reason && (
                      <div className="bg-blue-50 border-l-4 border-blue-500 rounded-lg p-4 mb-4">
                        <p className="text-sm text-gray-700">
                          <strong className="text-blue-900">Reason:</strong> {apt.reason}
                        </p>
                      </div>
                    )}

                    {apt.notes && (
                      <div className="flex items-start gap-2 text-sm text-gray-600 mb-4">
                        <FileText className="w-4 h-4 mt-0.5 flex-shrink-0" />
                        <p>{apt.notes}</p>
                      </div>
                    )}

                    {apt.virtualMeetingUrl && (
                      <div className="bg-purple-50 border-l-4 border-purple-500 rounded-lg p-4">
                        <p className="text-sm font-semibold text-purple-900 mb-2">Virtual Meeting Link:</p>
                        <a
                          href={apt.virtualMeetingUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-sm text-purple-700 hover:text-purple-900 underline flex items-center gap-2"
                        >
                          <Video className="w-4 h-4" />
                          Join Meeting
                        </a>
                      </div>
                    )}

                    {apt.patientInstructions && (
                      <div className="mt-4 bg-indigo-50 border-l-4 border-indigo-500 rounded-lg p-4">
                        <p className="text-sm font-semibold text-indigo-900 mb-1">Patient Instructions:</p>
                        <p className="text-sm text-indigo-800">{apt.patientInstructions}</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Mobile Request Button */}
        <div className="md:hidden fixed bottom-6 right-6 z-20">
          <Link
            to="/appointments/request"
            className="w-14 h-14 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-full shadow-lg hover:from-indigo-700 hover:to-purple-700 transition-all transform hover:scale-110 flex items-center justify-center"
          >
            <Plus className="w-6 h-6" />
          </Link>
        </div>
      </main>
    </div>
  );
};

export default AppointmentsPage;
