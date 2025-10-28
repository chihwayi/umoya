import React, { useState, useEffect } from 'react';
import { X, Calendar, Clock, User, FileText } from 'lucide-react';
import { useNotification } from './GlobalNotification.tsx';

interface Patient {
  id: string;
  firstName: string;
  lastName: string;
  patientNumber: string;
}

interface Doctor {
  id: string;
  firstName: string;
  lastName: string;
  role: string;
}

interface CreateAppointmentModalProps {
  onClose: () => void;
  onSuccess: () => void;
}

const CreateAppointmentModal: React.FC<CreateAppointmentModalProps> = ({ onClose, onSuccess }) => {
  const { showError } = useNotification();
  const [formData, setFormData] = useState({
    patientId: '',
    doctorId: '',
    appointmentDate: '',
    appointmentType: 'consultation',
    durationMinutes: 30,
    reason: '',
    notes: '',
    priorityLevel: 'normal',
    isTelehealth: false,
    virtualMeetingUrl: '',
    patientInstructions: '',
    estimatedCost: '',
  });
  const [patients, setPatients] = useState<Patient[]>([]);
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [availableSlots, setAvailableSlots] = useState<string[]>([]);
  const [selectedTime, setSelectedTime] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadingSlots, setLoadingSlots] = useState(false);

  useEffect(() => {
    fetchPatients();
    fetchDoctors();
  }, []);

  useEffect(() => {
    if (formData.doctorId && formData.appointmentDate) {
      fetchAvailableSlots();
    }
  }, [formData.doctorId, formData.appointmentDate]);

  const fetchPatients = async () => {
    try {
      const token = localStorage.getItem('ehr_token');
      const response = await fetch('http://localhost:3013/api/patients', {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        setPatients(data.patients || []);
      }
    } catch (error) {
      console.error('Error fetching patients:', error);
    }
  };

  const fetchDoctors = async () => {
    try {
      const token = localStorage.getItem('ehr_token');
      const response = await fetch('http://localhost:3013/api/users?role=doctor', {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        setDoctors(data.users || []);
      }
    } catch (error) {
      console.error('Error fetching doctors:', error);
    }
  };

  const fetchAvailableSlots = async () => {
    setLoadingSlots(true);
    try {
      const token = localStorage.getItem('ehr_token');
      const response = await fetch(
        `http://localhost:3013/api/appointments/doctor/${formData.doctorId}/available-slots?date=${formData.appointmentDate}`,
        {
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        }
      );

      if (response.ok) {
        const slots = await response.json();
        setAvailableSlots(slots);
      }
    } catch (error) {
      console.error('Error fetching available slots:', error);
    } finally {
      setLoadingSlots(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!selectedTime) {
      showError('Validation Error', 'Please select an appointment time');
      return;
    }

    setLoading(true);
    try {
      const token = localStorage.getItem('ehr_token');
      
      // Combine date and time
      const appointmentDateTime = new Date(`${formData.appointmentDate}T${selectedTime}`);
      
      const response = await fetch('http://localhost:3013/api/appointments', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...formData,
          appointmentDate: appointmentDateTime.toISOString(),
        }),
      });

      if (response.ok) {
        onSuccess();
      } else {
        const error = await response.json();
        showError('Creation Failed', error.message || 'Failed to create appointment');
      }
    } catch (error) {
      console.error('Error creating appointment:', error);
      showError('Creation Failed', 'Failed to create appointment');
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h2 className="text-xl font-semibold text-gray-900">Schedule New Appointment</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* Patient Selection */}
          <div>
            <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-2">
              <User className="h-4 w-4" />
              Patient
            </label>
            <select
              name="patientId"
              value={formData.patientId}
              onChange={handleInputChange}
              required
              className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="">Select a patient</option>
              {patients.map((patient) => (
                <option key={patient.id} value={patient.id}>
                  {patient.firstName} {patient.lastName} ({patient.patientNumber})
                </option>
              ))}
            </select>
          </div>

          {/* Doctor Selection */}
          <div>
            <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-2">
              <User className="h-4 w-4" />
              Doctor
            </label>
            <select
              name="doctorId"
              value={formData.doctorId}
              onChange={handleInputChange}
              required
              className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="">Select a doctor</option>
              {doctors.map((doctor) => (
                <option key={doctor.id} value={doctor.id}>
                  Dr. {doctor.firstName} {doctor.lastName}
                </option>
              ))}
            </select>
          </div>

          {/* Date and Time */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-2">
                <Calendar className="h-4 w-4" />
                Date
              </label>
              <input
                type="date"
                name="appointmentDate"
                value={formData.appointmentDate}
                onChange={handleInputChange}
                min={new Date().toISOString().split('T')[0]}
                required
                className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            <div>
              <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-2">
                <Clock className="h-4 w-4" />
                Time
              </label>
              {loadingSlots ? (
                <div className="w-full border border-gray-300 rounded-lg px-3 py-2 text-gray-500">
                  Loading available times...
                </div>
              ) : (
                <select
                  value={selectedTime}
                  onChange={(e) => setSelectedTime(e.target.value)}
                  required
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="">Select time</option>
                  {availableSlots.map((slot) => (
                    <option key={slot} value={slot}>
                      {slot}
                    </option>
                  ))}
                </select>
              )}
            </div>
          </div>

          {/* Appointment Type and Duration */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Appointment Type
              </label>
              <select
                name="appointmentType"
                value={formData.appointmentType}
                onChange={handleInputChange}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="consultation">Consultation</option>
                <option value="follow_up">Follow-up</option>
                <option value="emergency">Emergency</option>
                <option value="procedure">Procedure</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Duration (minutes)
              </label>
              <select
                name="durationMinutes"
                value={formData.durationMinutes}
                onChange={handleInputChange}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value={15}>15 minutes</option>
                <option value={30}>30 minutes</option>
                <option value={45}>45 minutes</option>
                <option value={60}>1 hour</option>
                <option value={90}>1.5 hours</option>
                <option value={120}>2 hours</option>
              </select>
            </div>
          </div>

          {/* Reason */}
          <div>
            <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-2">
              <FileText className="h-4 w-4" />
              Reason for Visit
            </label>
            <input
              type="text"
              name="reason"
              value={formData.reason}
              onChange={handleInputChange}
              placeholder="Brief description of the visit purpose"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          {/* Priority and Telehealth */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Priority Level
              </label>
              <select
                name="priorityLevel"
                value={formData.priorityLevel}
                onChange={handleInputChange}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="low">Low</option>
                <option value="normal">Normal</option>
                <option value="high">High</option>
                <option value="urgent">Urgent</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Estimated Cost (USD)
              </label>
              <input
                type="number"
                name="estimatedCost"
                value={formData.estimatedCost}
                onChange={handleInputChange}
                placeholder="0.00"
                step="0.01"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>

          {/* Telehealth Option */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="flex items-center gap-3 mb-3">
              <input
                type="checkbox"
                name="isTelehealth"
                checked={formData.isTelehealth}
                onChange={(e) => setFormData(prev => ({ ...prev, isTelehealth: e.target.checked }))}
                className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
              />
              <label className="text-sm font-medium text-blue-900">
                Virtual Appointment (Telehealth)
              </label>
            </div>
            {formData.isTelehealth && (
              <input
                type="url"
                name="virtualMeetingUrl"
                value={formData.virtualMeetingUrl}
                onChange={handleInputChange}
                placeholder="Meeting URL (will be generated if empty)"
                className="w-full border border-blue-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            )}
          </div>

          {/* Patient Instructions */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Patient Instructions
            </label>
            <textarea
              name="patientInstructions"
              value={formData.patientInstructions}
              onChange={handleInputChange}
              rows={2}
              placeholder="Instructions for the patient (preparation, what to bring, etc.)"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          {/* Notes */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Additional Notes
            </label>
            <textarea
              name="notes"
              value={formData.notes}
              onChange={handleInputChange}
              rows={3}
              placeholder="Any additional information or special instructions"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors disabled:opacity-50"
            >
              {loading ? 'Creating...' : 'Schedule Appointment'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default CreateAppointmentModal;