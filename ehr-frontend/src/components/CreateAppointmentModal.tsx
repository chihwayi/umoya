import React, { useState, useEffect, useRef } from 'react';
import { X, Calendar, Clock, User, FileText, Search, ChevronDown } from 'lucide-react';
import { useNotification } from './GlobalNotification.tsx';
import { ehrApi } from '../services/api.ts';
import { formatDateForAPI, isValidDate } from '../utils/dateUtils';
import DatePicker from './DatePicker';

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
  preselectedPatient?: Patient;
}

const CreateAppointmentModal: React.FC<CreateAppointmentModalProps> = ({ onClose, onSuccess, preselectedPatient }) => {
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
    status: 'scheduled',
  });
  const [patients, setPatients] = useState<Patient[]>([]);
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [availableSlots, setAvailableSlots] = useState<string[]>([]);
  const [selectedTime, setSelectedTime] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadingSlots, setLoadingSlots] = useState(false);
  
  // Patient search states
  const [patientSearchTerm, setPatientSearchTerm] = useState('');
  const [filteredPatients, setFilteredPatients] = useState<Patient[]>([]);
  const [showPatientDropdown, setShowPatientDropdown] = useState(false);
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
  const patientDropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchPatients();
    fetchDoctors();
  }, []);

  // Auto-populate patient if preselected
  useEffect(() => {
    if (preselectedPatient) {
      setSelectedPatient(preselectedPatient);
      setPatientSearchTerm(`${preselectedPatient.firstName} ${preselectedPatient.lastName} (${preselectedPatient.patientNumber})`);
      setFormData(prev => ({
        ...prev,
        patientId: preselectedPatient.id
      }));
    }
  }, [preselectedPatient]);

  // Filter patients based on search term
  useEffect(() => {
    if (patientSearchTerm.trim() === '') {
      setFilteredPatients(patients);
    } else {
      const filtered = patients.filter(patient =>
        `${patient.firstName} ${patient.lastName}`.toLowerCase().includes(patientSearchTerm.toLowerCase()) ||
        patient.patientNumber.toLowerCase().includes(patientSearchTerm.toLowerCase())
      );
      setFilteredPatients(filtered);
    }
  }, [patientSearchTerm, patients]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (patientDropdownRef.current && !patientDropdownRef.current.contains(event.target as Node)) {
        setShowPatientDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  useEffect(() => {
    if (formData.doctorId && formData.appointmentDate) {
      fetchAvailableSlots();
    }
  }, [formData.doctorId, formData.appointmentDate]);

  const fetchPatients = async () => {
    try {
      const token = localStorage.getItem('ehr_token');
      const tenantSlug = localStorage.getItem('ehr_tenant');
      
      if (!token || !tenantSlug) {
        console.error('Missing token or tenant');
        return;
      }

      const response = await ehrApi.getPatients(token, tenantSlug);
      setPatients(response.data.patients || []);
    } catch (error) {
      console.error('Error fetching patients:', error);
    }
  };

  const fetchDoctors = async () => {
    try {
      const token = localStorage.getItem('ehr_token');
      const tenantSlug = localStorage.getItem('ehr_tenant');
      
      if (!token || !tenantSlug) {
        console.error('Missing token or tenant');
        return;
      }

      const response = await ehrApi.getUsers(token, tenantSlug, 'doctor');
      setDoctors(response.data || []);
    } catch (error) {
      console.error('Error fetching doctors:', error);
    }
  };

  const fetchAvailableSlots = async () => {
    setLoadingSlots(true);
    try {
      const token = localStorage.getItem('ehr_token');
      const tenantSlug = localStorage.getItem('ehr_tenant');
      
      if (!token || !tenantSlug) {
        console.error('Missing token or tenant');
        return;
      }

      // Convert dd/mm/yyyy to yyyy-mm-dd for API
      const apiDate = formatDateForAPI(formData.appointmentDate);
      console.log('Fetching available slots for doctor:', formData.doctorId, 'date:', formData.appointmentDate, 'API date:', apiDate);
      const response = await ehrApi.getAvailableSlots(formData.doctorId, apiDate, token, tenantSlug);
      console.log('Available slots response:', response.data);
      setAvailableSlots(response.data || []);
    } catch (error) {
      console.error('Error fetching available slots:', error);
    } finally {
      setLoadingSlots(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const uuidRegex = /^[0-9a-fA-F-]{36}$/;
    
    if (!formData.patientId) {
      showError('Validation Error', 'Please select a patient');
      return;
    }
    if (!uuidRegex.test(formData.patientId)) {
      showError('Validation Error', 'Invalid patient selection');
      return;
    }
    if (!formData.doctorId) {
      showError('Validation Error', 'Please select a doctor');
      return;
    }
    if (!uuidRegex.test(formData.doctorId)) {
      showError('Validation Error', 'Invalid doctor selection');
      return;
    }
    if (!formData.appointmentDate) {
      showError('Validation Error', 'Please select a date');
      return;
    }
    if (!selectedTime) {
      showError('Validation Error', 'Please select an appointment time');
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
      
      // Combine date and time - convert dd/mm/yyyy to yyyy-mm-dd first
      const apiDate = formatDateForAPI(formData.appointmentDate);
      console.log('📅 Selected date:', formData.appointmentDate);
      console.log('📅 API date:', apiDate);
      console.log('📅 Selected time:', selectedTime);
      
      // Create date object properly to avoid timezone issues
      const [year, month, day] = apiDate.split('-').map(Number);
      const [hours, minutes] = selectedTime.split(':').map(Number);
      
      // Create date in local timezone, then convert to UTC properly
      const appointmentDateTime = new Date(year, month - 1, day, hours, minutes);
      console.log('📅 Created appointment date:', appointmentDateTime);
      console.log('📅 Appointment date local:', appointmentDateTime.toLocaleString());
      console.log('📅 Appointment date UTC:', appointmentDateTime.toISOString());
      
      const payload = {
        patientId: formData.patientId,
        doctorId: formData.doctorId,
        appointmentDate: appointmentDateTime.toISOString(),
        durationMinutes: Number(formData.durationMinutes) || 30,
        appointmentType: formData.appointmentType,
        reason: formData.reason || undefined,
        notes: formData.notes || undefined,
      };

      console.log('📤 Create appointment payload:', payload);

      await ehrApi.createAppointment(payload, token, tenantSlug);

      onSuccess();
    } catch (error: any) {
      console.error('Error creating appointment:', error?.response?.data || error);
      const msg = error?.response?.data?.message || error?.response?.data || 'Failed to create appointment';
      showError('Creation Failed', Array.isArray(msg) ? msg.join(', ') : msg);
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

  const handlePatientSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
    setPatientSearchTerm(e.target.value);
    setShowPatientDropdown(true);
  };

  const handlePatientSelect = (patient: Patient) => {
    setSelectedPatient(patient);
    setPatientSearchTerm(`${patient.firstName} ${patient.lastName} (${patient.patientNumber})`);
    setFormData(prev => ({
      ...prev,
      patientId: patient.id
    }));
    setShowPatientDropdown(false);
  };

  const handlePatientInputFocus = () => {
    setShowPatientDropdown(true);
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
          <div className="relative" ref={patientDropdownRef}>
            <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-2">
              <User className="h-4 w-4" />
              Patient
            </label>
            <div className="relative">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <input
                  type="text"
                  value={patientSearchTerm}
                  onChange={handlePatientSearch}
                  onFocus={handlePatientInputFocus}
                  placeholder="Search patients by name or patient number..."
                  readOnly={!!preselectedPatient}
                  className={`w-full border border-gray-300 rounded-lg pl-10 pr-10 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent ${preselectedPatient ? 'bg-gray-50 cursor-not-allowed' : ''}`}
                />
                <ChevronDown className="absolute right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              </div>
              
              {showPatientDropdown && !preselectedPatient && (
                <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                  {filteredPatients.length > 0 ? (
                    filteredPatients.map((patient) => (
                      <div
                        key={patient.id}
                        onClick={() => handlePatientSelect(patient)}
                        className="px-4 py-3 hover:bg-gray-50 cursor-pointer border-b border-gray-100 last:border-b-0"
                      >
                        <div className="font-medium text-gray-900">
                          {patient.firstName} {patient.lastName}
                        </div>
                        <div className="text-sm text-gray-500">
                          Patient #: {patient.patientNumber}
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="px-4 py-3 text-gray-500 text-center">
                      No patients found
                    </div>
                  )}
                </div>
              )}
            </div>
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
              <DatePicker
                label="Date (dd/mm/yyyy)"
                value={formData.appointmentDate}
                onChange={(val) => setFormData((prev) => ({ ...prev, appointmentDate: val }))}
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
              ) : availableSlots.length === 0 ? (
                <div className="w-full border border-gray-300 rounded-lg px-3 py-2 text-gray-500">
                  No available times for selected date
                </div>
              ) : (
                <select
                  value={selectedTime}
                  onChange={(e) => {
                    console.log('Time selected:', e.target.value);
                    setSelectedTime(e.target.value);
                  }}
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
              {availableSlots.length > 0 && (
                <div className="text-xs text-gray-500 mt-1">
                  {availableSlots.length} time slots available
                </div>
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

          {/* Priority and Status */}
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
                Status
              </label>
              <select
                name="status"
                value={formData.status}
                onChange={handleInputChange}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="scheduled">Scheduled</option>
                <option value="confirmed">Confirmed</option>
                <option value="in-progress">In Progress</option>
                <option value="completed">Completed</option>
                <option value="cancelled">Cancelled</option>
                <option value="no-show">No Show</option>
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