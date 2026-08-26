import React, { useState, useEffect, useRef } from 'react';
import { X, Clock, User, FileText, Search, ChevronDown, Repeat, AlertCircle, Loader2 } from 'lucide-react';
import { useNotification } from './GlobalNotification';
import { ehrApi } from '../services/api';
import { formatDateForAPI, isValidDate } from '../utils/dateUtils';
import DatePicker from './DatePicker';
// eslint-disable-next-line @typescript-eslint/no-unused-vars -- in-progress resource-booking UI (not yet rendered)
import AppointmentResourceSelector from './AppointmentResourceSelector';

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
  const { showError, showSuccess } = useNotification();
  const [formData, setFormData] = useState({
    patientId: '',
    doctorId: '',
    appointmentDate: '',
    appointmentType: 'consultation',
    durationMinutes: 30,
    reason: '',
    notes: '',
  });
  const [patients, setPatients] = useState<Patient[]>([]);
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [availableSlots, setAvailableSlots] = useState<string[]>([]);
  const [selectedTime, setSelectedTime] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [isRecurring, setIsRecurring] = useState(false);
  const [recurringPattern, setRecurringPattern] = useState<'weekly' | 'monthly'>('weekly');
  const [recurringEndDate, setRecurringEndDate] = useState('');
  const [conflictWarning, setConflictWarning] = useState<string | null>(null);
  const [checkingConflict, setCheckingConflict] = useState(false);
  // Reserved for the in-progress resource-booking UI; selectedResources is read in the create flow.
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [selectedResources, setSelectedResources] = useState<string[]>([]);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [showResources, setShowResources] = useState(false);
  
  // Patient search states
  const [patientSearchTerm, setPatientSearchTerm] = useState('');
  const [filteredPatients, setFilteredPatients] = useState<Patient[]>([]);
  const [showPatientDropdown, setShowPatientDropdown] = useState(false);
  const [, setSelectedPatient] = useState<Patient | null>(null);
  const patientDropdownRef = useRef<HTMLDivElement>(null);

  // Doctor search states
  const [doctorSearchTerm, setDoctorSearchTerm] = useState('');
  const [filteredDoctors, setFilteredDoctors] = useState<Doctor[]>([]);
  const [showDoctorDropdown, setShowDoctorDropdown] = useState(false);
  const [selectedDoctor, setSelectedDoctor] = useState<Doctor | null>(null);
  const doctorDropdownRef = useRef<HTMLDivElement>(null);

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

  // Filter doctors based on search term
  useEffect(() => {
    if (doctorSearchTerm.trim() === '') {
      setFilteredDoctors(doctors);
    } else {
      const filtered = doctors.filter(doctor =>
        `${doctor.firstName} ${doctor.lastName}`.toLowerCase().includes(doctorSearchTerm.toLowerCase())
      );
      setFilteredDoctors(filtered);
    }
  }, [doctorSearchTerm, doctors]);

  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (patientDropdownRef.current && !patientDropdownRef.current.contains(event.target as Node)) {
        setShowPatientDropdown(false);
      }
      if (doctorDropdownRef.current && !doctorDropdownRef.current.contains(event.target as Node)) {
        setShowDoctorDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  useEffect(() => {
    // Only query once the typed date is complete & valid — avoids firing the API with
    // partial input (e.g. "07/06/202") which produced empty-date 500s.
    if (formData.doctorId && isValidDate(formData.appointmentDate)) {
      fetchAvailableSlots();
    } else {
      setAvailableSlots([]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formData.doctorId, formData.appointmentDate]);

  // Check for conflicts when time is selected
  useEffect(() => {
    if (formData.doctorId && isValidDate(formData.appointmentDate) && selectedTime) {
      checkForConflicts();
    } else {
      setConflictWarning(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formData.doctorId, formData.appointmentDate, selectedTime, formData.durationMinutes]);

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

  const checkForConflicts = async () => {
    if (!formData.doctorId || !formData.appointmentDate || !selectedTime) return;

    setCheckingConflict(true);
    try {
      const token = localStorage.getItem('ehr_token');
      const tenantSlug = localStorage.getItem('ehr_tenant');
      
      if (!token || !tenantSlug) return;

      const apiDate = formatDateForAPI(formData.appointmentDate);
      const [year, month, day] = apiDate.split('-').map(Number);
      const [hours, minutes] = selectedTime.split(':').map(Number);
      const appointmentDateTime = new Date(year, month - 1, day, hours, minutes);

      const result = await ehrApi.checkAppointmentAvailability(
        formData.doctorId,
        appointmentDateTime.toISOString(),
        Number(formData.durationMinutes) || 30,
        token,
        tenantSlug
      );

      if (result.data?.hasConflict) {
        setConflictWarning(result.data.message || 'This time slot conflicts with an existing appointment or doctor unavailability');
      } else {
        setConflictWarning(null);
      }
    } catch (error) {
      console.error('Error checking conflicts:', error);
      // Silently fail - don't block the user from creating appointments
      // Just clear any existing warning
      setConflictWarning(null);
    } finally {
      setCheckingConflict(false);
    }
  };

  // eslint-disable-next-line @typescript-eslint/no-unused-vars -- in-progress resource-booking feature
  const bookResourcesForAppointment = async (appointmentId: string, appointmentDateTime: Date, durationMinutes: number, token: string, tenantSlug: string) => {
    const bookingStart = appointmentDateTime.toISOString();
    const bookingEnd = new Date(appointmentDateTime.getTime() + durationMinutes * 60 * 1000).toISOString();

    for (const resourceId of selectedResources) {
      try {
        await ehrApi.bookAppointmentResource(
          {
            appointmentId,
            resourceId,
            bookingStart,
            bookingEnd,
          },
          token,
          tenantSlug
        );
      } catch (error) {
        console.error(`Failed to book resource ${resourceId}:`, error);
        // Don't fail the appointment creation if resource booking fails
      }
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
      if (!apiDate) {
        setAvailableSlots([]);
        return;
      }
      const response = await ehrApi.getAvailableSlots(formData.doctorId, apiDate, token, tenantSlug);
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

    // Check for conflicts before submitting
    if (conflictWarning) {
      showError('Conflict Detected', 'Please select a different time slot. ' + conflictWarning);
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

      // Create date object properly to avoid timezone issues
      const [year, month, day] = apiDate.split('-').map(Number);
      const [hours, minutes] = selectedTime.split(':').map(Number);

      // Create date in local timezone, then convert to UTC properly
      const appointmentDateTime = new Date(year, month - 1, day, hours, minutes);

      const payload = {
        patientId: formData.patientId,
        doctorId: formData.doctorId,
        appointmentDate: appointmentDateTime.toISOString(),
        durationMinutes: Number(formData.durationMinutes) || 30,
        appointmentType: formData.appointmentType,
        reason: formData.reason || undefined,
        notes: formData.notes || undefined,
      };

      let createdAppointment: any = null;
      
      if (isRecurring) {
        if (!recurringEndDate) {
          showError('Validation Error', 'Please select an end date for recurring appointments');
          return;
        }
        
        const endDateApi = formatDateForAPI(recurringEndDate);
        const [endYear, endMonth, endDay] = endDateApi.split('-').map(Number);
        const endDateTime = new Date(endYear, endMonth - 1, endDay, 23, 59);
        
        const result = await ehrApi.createRecurringAppointments(payload, recurringPattern, endDateTime.toISOString(), token, tenantSlug);
        const count = Array.isArray(result.data) ? result.data.length : 0;
        showSuccess('Success', `Created ${count} recurring appointment${count !== 1 ? 's' : ''} successfully`);
        createdAppointment = Array.isArray(result.data) && result.data.length > 0 ? result.data[0] : null;
      } else {
        const result = await ehrApi.createAppointment(payload, token, tenantSlug);
        createdAppointment = result.data;
        showSuccess('Success', 'Appointment scheduled successfully');
      }

      // Book resources if selected
      if (createdAppointment && selectedResources.length > 0) {
        const bookingStart = appointmentDateTime.toISOString();
        const bookingEnd = new Date(appointmentDateTime.getTime() + (Number(formData.durationMinutes) || 30) * 60 * 1000).toISOString();

        for (const resourceId of selectedResources) {
          try {
            await ehrApi.bookAppointmentResource(
              {
                appointmentId: createdAppointment.id,
                resourceId,
                bookingStart,
                bookingEnd,
              },
              token,
              tenantSlug
            );
          } catch (error) {
            console.error(`Failed to book resource ${resourceId}:`, error);
            // Don't fail the appointment creation if resource booking fails
          }
        }
      }

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

          {/* Doctor Selection - Searchable Dropdown */}
          <div>
            <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-2">
              <User className="h-4 w-4" />
              Doctor
            </label>
            <div className="relative" ref={doctorDropdownRef}>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search doctors by name..."
                  value={doctorSearchTerm}
                  onChange={(e) => {
                    setDoctorSearchTerm(e.target.value);
                    setShowDoctorDropdown(true);
                  }}
                  onFocus={() => setShowDoctorDropdown(true)}
                  className="w-full border border-gray-300 rounded-lg pl-10 pr-10 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
                {selectedDoctor && (
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedDoctor(null);
                      setDoctorSearchTerm('');
                      setFormData(prev => ({ ...prev, doctorId: '' }));
                      setShowDoctorDropdown(false);
                    }}
                    className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
                {!selectedDoctor && (
                  <ChevronDown className="absolute right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
                )}
              </div>

              {/* Dropdown List */}
              {showDoctorDropdown && (
                <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                  {filteredDoctors.length > 0 ? (
                    filteredDoctors.map((doctor) => (
                      <button
                        key={doctor.id}
                        type="button"
                        onClick={() => {
                          setSelectedDoctor(doctor);
                          setDoctorSearchTerm(`Dr. ${doctor.firstName} ${doctor.lastName}`);
                          setFormData(prev => ({ ...prev, doctorId: doctor.id }));
                          setShowDoctorDropdown(false);
                        }}
                        className="w-full px-4 py-3 text-left hover:bg-blue-50 transition-colors border-b border-gray-100 last:border-b-0"
                      >
                        <div className="font-medium text-gray-900">
                          Dr. {doctor.firstName} {doctor.lastName}
                        </div>
                        <div className="text-xs text-gray-500 capitalize">{doctor.role}</div>
                      </button>
                    ))
                  ) : (
                    <div className="px-4 py-3 text-gray-500 text-center">
                      No doctors found
                    </div>
                  )}
                </div>
              )}
            </div>
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
              {availableSlots.length > 0 && (
                <div className="text-xs text-gray-500 mt-1">
                  {availableSlots.length} time slots available
                </div>
              )}
              {checkingConflict && (
                <div className="text-xs text-blue-500 mt-1 flex items-center gap-1">
                  <Loader2 className="h-3 w-3 animate-spin" />
                  Checking for conflicts...
                </div>
              )}
              {conflictWarning && (
                <div className="mt-2 p-2 bg-yellow-50 border border-yellow-200 rounded-lg">
                  <div className="flex items-start gap-2">
                    <AlertCircle className="h-4 w-4 text-yellow-600 mt-0.5 flex-shrink-0" />
                    <p className="text-xs text-yellow-800">{conflictWarning}</p>
                  </div>
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

          {/* Recurring Appointment Options */}
          <div className="border-t border-gray-200 pt-4">
            <div className="flex items-center gap-3 mb-4">
              <input
                type="checkbox"
                id="isRecurring"
                checked={isRecurring}
                onChange={(e) => setIsRecurring(e.target.checked)}
                className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
              />
              <label htmlFor="isRecurring" className="flex items-center gap-2 text-sm font-medium text-gray-700 cursor-pointer">
                <Repeat className="h-4 w-4" />
                Make this a recurring appointment
              </label>
            </div>

            {isRecurring && (
              <div className="ml-7 space-y-4 bg-blue-50 p-4 rounded-lg border border-blue-200">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Recurrence Pattern
                    </label>
                    <select
                      value={recurringPattern}
                      onChange={(e) => setRecurringPattern(e.target.value as 'weekly' | 'monthly')}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    >
                      <option value="weekly">Weekly</option>
                      <option value="monthly">Monthly</option>
                    </select>
                    <p className="text-xs text-gray-500 mt-1">
                      {recurringPattern === 'weekly' 
                        ? 'Appointment will repeat every week' 
                        : 'Appointment will repeat every month'}
                    </p>
                  </div>

                  <div>
                    <DatePicker
                      label="End Date (dd/mm/yyyy)"
                      value={recurringEndDate}
                      onChange={(val) => setRecurringEndDate(val)}
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      Last date for recurring appointments
                    </p>
                  </div>
                </div>

                <div className="bg-blue-100 border border-blue-300 rounded-lg p-3">
                  <p className="text-xs text-blue-800">
                    <strong>Note:</strong> All recurring appointments will be created with the same details (doctor, duration, type, etc.) 
                    and will be scheduled on the same day of the week/month until the end date.
                  </p>
                </div>
              </div>
            )}
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
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors disabled:opacity-50 flex items-center gap-2"
            >
              {loading ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  {isRecurring ? 'Creating Recurring Appointments...' : 'Creating...'}
                </>
              ) : (
                <>
                  {isRecurring && <Repeat className="h-4 w-4" />}
                  {isRecurring ? 'Schedule Recurring Appointments' : 'Schedule Appointment'}
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default CreateAppointmentModal;
