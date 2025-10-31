import React, { useState } from 'react';
import { 
  CheckCircle, Play, Square, XCircle, Calendar, Clock, 
  Edit, Trash2, AlertCircle, User, Phone, Video, FileText, X, Pill, TestTube 
} from 'lucide-react';
import { useNotification } from './GlobalNotification';
import { ehrApi } from '../services/api';
import DatePicker from './DatePicker';
import { formatDateForAPI, formatDateForInput } from '../utils/dateUtils';
import AppointmentNotes from './AppointmentNotes';
import ClinicalNotesModal from './ClinicalNotesModal';
import PrescriptionsModal from './PrescriptionsModal';
import LabOrdersModal from './LabOrdersModal';

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

interface AppointmentActionsProps {
  appointment: Appointment;
  onUpdate: () => void;
  tenantSlug: string;
  token: string;
}

const AppointmentActions: React.FC<AppointmentActionsProps> = ({
  appointment,
  onUpdate,
  tenantSlug,
  token
}) => {
  const { showSuccess, showError } = useNotification();
  const [showRescheduleModal, setShowRescheduleModal] = useState(false);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [showNotesModal, setShowNotesModal] = useState(false);
  const [showComprehensiveNotes, setShowComprehensiveNotes] = useState(false);
  const [showClinicalNotes, setShowClinicalNotes] = useState(false);
  const [showPrescriptions, setShowPrescriptions] = useState(false);
  const [showLabOrders, setShowLabOrders] = useState(false);
  const [rescheduleData, setRescheduleData] = useState({
    appointmentDate: formatDateForInput(new Date(appointment.appointmentDate)),
    selectedTime: new Date(appointment.appointmentDate).toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    }),
    reason: ''
  });
  const [appointmentNotes, setAppointmentNotes] = useState(appointment.notes || '');
  const [cancelNotes, setCancelNotes] = useState('');
  const [loading, setLoading] = useState(false);

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

  const handleStatusChange = async (newStatus: string) => {
    try {
      setLoading(true);
      await ehrApi.updateAppointmentStatus(appointment.id, newStatus, token, tenantSlug);
      showSuccess('Success', `Appointment ${newStatus} successfully`);
      onUpdate();
    } catch (error) {
      console.error(`Error updating status to ${newStatus}:`, error);
      showError('Error', `Failed to ${newStatus} appointment`);
    } finally {
      setLoading(false);
    }
  };

  const handleStartAppointment = async () => {
    try {
      setLoading(true);
      await ehrApi.startAppointment(appointment.id, token, tenantSlug);
      showSuccess('Success', 'Appointment started');
      onUpdate();
    } catch (error) {
      console.error('Error starting appointment:', error);
      showError('Error', 'Failed to start appointment');
    } finally {
      setLoading(false);
    }
  };

  const handleCompleteAppointment = async () => {
    try {
      setLoading(true);
      await ehrApi.completeAppointment(appointment.id, token, tenantSlug);
      showSuccess('Success', 'Appointment completed');
      onUpdate();
    } catch (error) {
      console.error('Error completing appointment:', error);
      showError('Error', 'Failed to complete appointment');
    } finally {
      setLoading(false);
    }
  };

  const handleReschedule = async () => {
    try {
      setLoading(true);
      const appointmentDateTime = new Date(`${formatDateForAPI(rescheduleData.appointmentDate)}T${rescheduleData.selectedTime}:00`);
      
      await ehrApi.updateAppointment(appointment.id, {
        appointmentDate: appointmentDateTime.toISOString(),
        notes: rescheduleData.reason ? `${appointment.notes}\n\nRescheduled: ${rescheduleData.reason}` : appointment.notes
      }, token, tenantSlug);
      
      showSuccess('Success', 'Appointment rescheduled successfully');
      setShowRescheduleModal(false);
      onUpdate();
    } catch (error) {
      console.error('Error rescheduling appointment:', error);
      showError('Error', 'Failed to reschedule appointment');
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = async () => {
    try {
      setLoading(true);
      const cancellationNote = cancelNotes ? `\n\nCancellation Reason: ${cancelNotes}` : '';
      await ehrApi.updateAppointment(appointment.id, {
        status: 'cancelled',
        notes: `${appointment.notes || ''}${cancellationNote}`
      }, token, tenantSlug);
      showSuccess('Success', 'Appointment cancelled');
      setShowCancelModal(false);
      setCancelNotes('');
      onUpdate();
    } catch (error) {
      console.error('Error cancelling appointment:', error);
      showError('Error', 'Failed to cancel appointment');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveNotes = async () => {
    try {
      setLoading(true);
      await ehrApi.updateAppointment(appointment.id, {
        notes: appointmentNotes
      }, token, tenantSlug);
      
      showSuccess('Success', 'Appointment notes saved');
      setShowNotesModal(false);
      onUpdate();
    } catch (error) {
      console.error('Error saving notes:', error);
      showError('Error', 'Failed to save notes');
    } finally {
      setLoading(false);
    }
  };

  const formatTime = (dateString: string) => {
    return new Date(dateString).toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    });
  };

  const getAvailableActions = () => {
    const actions: React.ReactNode[] = [];
    const normalizedStatus = appointment.status.replace('_', '-');
    
    switch (normalizedStatus) {
      case 'scheduled':
        actions.push(
          <button
            key="check-in"
            onClick={() => handleStatusChange('confirmed')}
            disabled={loading}
            className="px-3 py-1 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-sm flex items-center gap-1"
          >
            <CheckCircle className="w-4 h-4" />
            Check In
          </button>
        );
        break;
        
      case 'confirmed':
        actions.push(
          <button
            key="start"
            onClick={handleStartAppointment}
            disabled={loading}
            className="px-3 py-1 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm flex items-center gap-1"
          >
            <Play className="w-4 h-4" />
            Start
          </button>
        );
        break;
        
      case 'in-progress':
        actions.unshift(
          <button
            key="complete"
            onClick={handleCompleteAppointment}
            disabled={loading}
            className="px-3 py-1 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-sm flex items-center gap-1"
          >
            <Square className="w-4 h-4" />
            Complete
          </button>
        );
        break;
    }
    
    // Doctor-facing minimal actions: remove reschedule/cancel and Quick Notes
    actions.push(
      <button
        key="clinical-notes"
        onClick={() => setShowClinicalNotes(true)}
        className="px-3 py-1 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors text-sm flex items-center gap-1"
      >
        <FileText className="w-4 h-4" />
        Clinical Notes
      </button>,
      <button
        key="prescriptions"
        onClick={() => setShowPrescriptions(true)}
        className="px-3 py-1 bg-pink-600 text-white rounded-lg hover:bg-pink-700 transition-colors text-sm flex items-center gap-1"
      >
        <Pill className="w-4 h-4" />
        Prescriptions
      </button>,
      <button
        key="lab-orders"
        onClick={() => setShowLabOrders(true)}
        className="px-3 py-1 bg-violet-600 text-white rounded-lg hover:bg-violet-700 transition-colors text-sm flex items-center gap-1"
      >
        <TestTube className="w-4 h-4" />
        Lab Orders
      </button>,
      null
    );
    
    return actions;
  };

  return (
    <>
      <div className="flex items-center gap-2">
        {getAvailableActions()}
      </div>

      {/* Reschedule Modal */}
      {showRescheduleModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-md flex items-center justify-center z-[100] p-4 animate-in fade-in duration-300">
          <div className="bg-gradient-to-br from-white to-slate-50 rounded-3xl shadow-2xl border border-slate-200/50 w-full max-w-2xl max-h-[90vh] overflow-y-auto animate-in zoom-in-95 duration-300">
            {/* Header */}
            <div className="sticky top-0 bg-gradient-to-r from-yellow-50 to-amber-50 border-b border-yellow-200/50 px-6 py-5 rounded-t-3xl">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-gradient-to-r from-yellow-500 to-amber-600 rounded-xl">
                    <Calendar className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-slate-900">Reschedule Appointment</h3>
                    <p className="text-sm text-slate-600">
                      {appointment.patient.firstName} {appointment.patient.lastName} • {appointment.patient.patientNumber}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setShowRescheduleModal(false)}
                  className="p-2 hover:bg-white/50 rounded-xl transition-colors"
                >
                  <X className="w-5 h-5 text-slate-500" />
                </button>
              </div>
            </div>

            {/* Content */}
            <div className="p-6">
              <div className="space-y-6">
              
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-2">New Date</label>
                    <DatePicker
                      value={rescheduleData.appointmentDate}
                      onChange={(date) => setRescheduleData(prev => ({ ...prev, appointmentDate: date }))}
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-2">New Time</label>
                    <input
                      type="time"
                      value={rescheduleData.selectedTime}
                      onChange={(e) => setRescheduleData(prev => ({ ...prev, selectedTime: e.target.value }))}
                      className="w-full border border-slate-300 rounded-xl px-4 py-3 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors"
                    />
                  </div>
                </div>
                
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2">Reason (Optional)</label>
                  <textarea
                    value={rescheduleData.reason}
                    onChange={(e) => setRescheduleData(prev => ({ ...prev, reason: e.target.value }))}
                    rows={3}
                    placeholder="Reason for rescheduling..."
                    className="w-full border border-slate-300 rounded-xl px-4 py-3 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors resize-none"
                  />
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="sticky bottom-0 bg-slate-50 border-t border-slate-200 px-6 py-4 rounded-b-2xl">
              <div className="flex gap-3">
                <button
                  onClick={() => setShowRescheduleModal(false)}
                  className="flex-1 px-6 py-3 border border-slate-300 text-slate-700 rounded-xl hover:bg-slate-50 transition-colors font-medium"
                >
                  Cancel
                </button>
                <button
                  onClick={handleReschedule}
                  disabled={loading}
                  className="flex-1 px-6 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl hover:from-blue-700 hover:to-indigo-700 transition-all font-medium shadow-lg disabled:opacity-50"
                >
                  {loading ? 'Rescheduling...' : 'Reschedule'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      {/* Prescriptions Modal */}
      {showPrescriptions && (
        <PrescriptionsModal
          open={showPrescriptions}
          onClose={() => setShowPrescriptions(false)}
          onSaved={() => { setShowPrescriptions(false); onUpdate(); }}
          appointment={appointment}
          tenantSlug={tenantSlug}
          token={token}
        />
      )}
      {showLabOrders && (
        <LabOrdersModal
          open={showLabOrders}
          onClose={() => setShowLabOrders(false)}
          onSaved={() => { setShowLabOrders(false); onUpdate(); }}
          appointment={appointment}
          tenantSlug={tenantSlug}
          token={token}
        />
      )}

      {/* Cancel Modal */}
      {showCancelModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-md flex items-center justify-center z-[100] p-4 animate-in fade-in duration-300">
          <div className="bg-gradient-to-br from-white to-slate-50 rounded-3xl shadow-2xl border border-slate-200/50 w-full max-w-2xl max-h-[90vh] overflow-y-auto animate-in zoom-in-95 duration-300">
            {/* Header */}
            <div className="sticky top-0 bg-gradient-to-r from-red-50 to-rose-50 border-b border-red-200/50 px-6 py-5 rounded-t-3xl">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-gradient-to-r from-red-500 to-rose-600 rounded-xl">
                    <XCircle className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-slate-900">Cancel Appointment</h3>
                    <p className="text-sm text-slate-600">
                      {appointment.patient.firstName} {appointment.patient.lastName} • {formatTime(appointment.appointmentDate)} - {appointment.appointmentType}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setShowCancelModal(false)}
                  className="p-2 hover:bg-white/50 rounded-xl transition-colors"
                >
                  <X className="w-5 h-5 text-slate-500" />
                </button>
              </div>
            </div>

            {/* Content */}
            <div className="p-6">
              <div className="space-y-6">
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2">Reason for Cancellation</label>
                  <textarea
                    value={cancelNotes}
                    onChange={(e) => setCancelNotes(e.target.value)}
                    rows={4}
                    placeholder="Please provide a reason for cancelling this appointment..."
                    className="w-full border border-slate-300 rounded-xl px-4 py-3 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors resize-none"
                  />
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="sticky bottom-0 bg-slate-50 border-t border-slate-200 px-6 py-4 rounded-b-2xl">
              <div className="flex gap-3">
                <button
                  onClick={() => setShowCancelModal(false)}
                  className="flex-1 px-6 py-3 border border-slate-300 text-slate-700 rounded-xl hover:bg-slate-50 transition-colors font-medium"
                >
                  Keep Appointment
                </button>
                <button
                  onClick={handleCancel}
                  disabled={loading}
                  className="flex-1 px-6 py-3 bg-gradient-to-r from-red-600 to-red-700 text-white rounded-xl hover:from-red-700 hover:to-red-800 transition-all font-medium shadow-lg disabled:opacity-50"
                >
                  {loading ? 'Cancelling...' : 'Cancel Appointment'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Notes Modal */}
      {showNotesModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-md flex items-center justify-center z-[100] p-4 animate-in fade-in duration-300">
          <div className="bg-gradient-to-br from-white to-slate-50 rounded-3xl shadow-2xl border border-slate-200/50 w-full max-w-2xl max-h-[90vh] overflow-y-auto animate-in zoom-in-95 duration-300">
            {/* Header */}
            <div className="sticky top-0 bg-gradient-to-r from-purple-50 to-indigo-50 border-b border-purple-200/50 px-6 py-5 rounded-t-3xl">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-gradient-to-r from-purple-500 to-indigo-600 rounded-xl">
                    <FileText className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-slate-900">Appointment Notes</h3>
                    <p className="text-sm text-slate-600">
                      {appointment.patient.firstName} {appointment.patient.lastName} • {formatTime(appointment.appointmentDate)} - {appointment.appointmentType}
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
              <div className="space-y-6">
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2">Appointment Notes</label>
                  <textarea
                    value={appointmentNotes}
                    onChange={(e) => setAppointmentNotes(e.target.value)}
                    rows={8}
                    placeholder="Enter detailed notes about this appointment..."
                    className="w-full border border-slate-300 rounded-xl px-4 py-3 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors resize-none"
                  />
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
                  onClick={handleSaveNotes}
                  disabled={loading}
                  className="flex-1 px-6 py-3 bg-gradient-to-r from-green-600 to-emerald-600 text-white rounded-xl hover:from-green-700 hover:to-emerald-700 transition-all font-medium shadow-lg disabled:opacity-50"
                >
                  {loading ? 'Saving...' : 'Save Notes'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Comprehensive Notes Modal removed in favor of separate modals */}
      {/* Clinical Notes Modal */}
      {showClinicalNotes && (
        <ClinicalNotesModal
          open={showClinicalNotes}
          onClose={() => setShowClinicalNotes(false)}
          onSaved={() => { setShowClinicalNotes(false); onUpdate(); }}
          appointment={appointment}
          tenantSlug={tenantSlug}
          token={token}
        />
      )}
    </>
  );
};

export default AppointmentActions;
