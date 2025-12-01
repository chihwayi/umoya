import React, { useState } from 'react';
import { X, Bell, Mail, MessageSquare, CheckCircle2, AlertCircle } from 'lucide-react';
import { useNotification } from './GlobalNotification';
import { ehrApi } from '../services/api';

interface AppointmentReminderModalProps {
  appointment: {
    id: string;
    patient: {
      firstName: string;
      lastName: string;
      phone?: string;
      email?: string;
    };
    appointmentDate: string;
    doctor: {
      firstName: string;
      lastName: string;
    };
    reminderSentCount?: number;
    lastReminderSent?: string;
  };
  onClose: () => void;
  onSuccess: () => void;
}

const AppointmentReminderModal: React.FC<AppointmentReminderModalProps> = ({
  appointment,
  onClose,
  onSuccess,
}) => {
  const { showError, showSuccess } = useNotification();
  const [sendSms, setSendSms] = useState(true);
  const [sendEmail, setSendEmail] = useState(false);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);

  const handleSend = async () => {
    if (!sendSms && !sendEmail) {
      showError('Validation Error', 'Please select at least one delivery method (SMS or Email)');
      return;
    }

    if (sendSms && !appointment.patient.phone) {
      showError('Validation Error', 'Patient does not have a phone number on file');
      return;
    }

    if (sendEmail && !appointment.patient.email) {
      showError('Validation Error', 'Patient does not have an email address on file');
      return;
    }

    setLoading(true);
    try {
      const token = localStorage.getItem('ehr_token');
      const tenantSlug = localStorage.getItem('ehr_tenant');

      if (!token || !tenantSlug) {
        showError('Authentication Error', 'Missing token or tenant information');
        return;
      }

      const response = await ehrApi.sendAppointmentReminder(
        appointment.id,
        { sendSms, sendEmail },
        token,
        tenantSlug
      );

      setResult(response.data);
      showSuccess('Success', 'Reminder sent successfully');
      setTimeout(() => {
        onSuccess();
        onClose();
      }, 2000);
    } catch (error: any) {
      console.error('Error sending reminder:', error);
      const msg = error?.response?.data?.message || 'Failed to send reminder';
      showError('Send Failed', msg);
    } finally {
      setLoading(false);
    }
  };

  const appointmentDate = new Date(appointment.appointmentDate);
  const formattedDate = appointmentDate.toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
  const formattedTime = appointmentDate.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl max-w-md w-full">
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 rounded-lg">
              <Bell className="h-5 w-5 text-blue-600" />
            </div>
            <h2 className="text-xl font-semibold text-gray-900">Send Appointment Reminder</h2>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* Appointment Details */}
          <div className="bg-gray-50 rounded-lg p-4">
            <h3 className="font-semibold text-gray-900 mb-2">Appointment Details</h3>
            <div className="space-y-1 text-sm text-gray-600">
              <p><strong>Patient:</strong> {appointment.patient.firstName} {appointment.patient.lastName}</p>
              <p><strong>Date:</strong> {formattedDate}</p>
              <p><strong>Time:</strong> {formattedTime}</p>
              <p><strong>Doctor:</strong> Dr. {appointment.doctor.firstName} {appointment.doctor.lastName}</p>
              {appointment.reminderSentCount && appointment.reminderSentCount > 0 && (
                <p className="text-xs text-gray-500 mt-2">
                  Previous reminders sent: {appointment.reminderSentCount}
                  {appointment.lastReminderSent && (
                    <span className="ml-2">
                      (Last: {new Date(appointment.lastReminderSent).toLocaleString()})
                    </span>
                  )}
                </p>
              )}
            </div>
          </div>

          {/* Delivery Methods */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-3">
              Select Delivery Method(s)
            </label>
            <div className="space-y-3">
              <label className="flex items-center gap-3 p-3 border border-gray-200 rounded-lg cursor-pointer hover:bg-gray-50 transition-colors">
                <input
                  type="checkbox"
                  checked={sendSms}
                  onChange={(e) => setSendSms(e.target.checked)}
                  disabled={!appointment.patient.phone}
                  className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                />
                <MessageSquare className={`h-5 w-5 ${sendSms ? 'text-blue-600' : 'text-gray-400'}`} />
                <div className="flex-1">
                  <div className="font-medium text-gray-900">SMS</div>
                  <div className="text-xs text-gray-500">
                    {appointment.patient.phone ? (
                      `Send to ${appointment.patient.phone}`
                    ) : (
                      <span className="text-red-500">No phone number on file</span>
                    )}
                  </div>
                </div>
              </label>

              <label className="flex items-center gap-3 p-3 border border-gray-200 rounded-lg cursor-pointer hover:bg-gray-50 transition-colors">
                <input
                  type="checkbox"
                  checked={sendEmail}
                  onChange={(e) => setSendEmail(e.target.checked)}
                  disabled={!appointment.patient.email}
                  className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                />
                <Mail className={`h-5 w-5 ${sendEmail ? 'text-blue-600' : 'text-gray-400'}`} />
                <div className="flex-1">
                  <div className="font-medium text-gray-900">Email</div>
                  <div className="text-xs text-gray-500">
                    {appointment.patient.email ? (
                      `Send to ${appointment.patient.email}`
                    ) : (
                      <span className="text-red-500">No email address on file</span>
                    )}
                  </div>
                </div>
              </label>
            </div>
          </div>

          {/* Result Display */}
          {result && (
            <div className={`p-4 rounded-lg border ${
              result.success ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'
            }`}>
              <div className="flex items-start gap-2">
                {result.success ? (
                  <CheckCircle2 className="h-5 w-5 text-green-600 mt-0.5" />
                ) : (
                  <AlertCircle className="h-5 w-5 text-red-600 mt-0.5" />
                )}
                <div className="flex-1">
                  <p className={`font-medium ${result.success ? 'text-green-800' : 'text-red-800'}`}>
                    {result.message}
                  </p>
                  <div className="mt-2 space-y-1 text-sm">
                    {result.smsSent && (
                      <p className="text-green-700">✓ SMS sent successfully</p>
                    )}
                    {result.emailSent && (
                      <p className="text-green-700">✓ Email sent successfully</p>
                    )}
                    {result.errors && result.errors.length > 0 && (
                      <div className="text-red-700">
                        <p className="font-medium">Errors:</p>
                        <ul className="list-disc list-inside">
                          {result.errors.map((error: string, index: number) => (
                            <li key={index}>{error}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3 pt-4 border-t border-gray-200">
            <button
              onClick={onClose}
              className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSend}
              disabled={loading || (!sendSms && !sendEmail) || (sendSms && !appointment.patient.phone) || (sendEmail && !appointment.patient.email)}
              className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  Sending...
                </>
              ) : (
                <>
                  <Bell className="h-4 w-4" />
                  Send Reminder
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AppointmentReminderModal;


