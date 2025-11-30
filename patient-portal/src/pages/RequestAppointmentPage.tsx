import React, { useState, useEffect, useRef } from 'react';
import { usePatientAuth } from '../contexts/PatientAuthContext';
import { patientPortalApi } from '../services/api';
import { Calendar, Clock, User, ArrowLeft, CreditCard, Phone, DollarSign, AlertCircle, CheckCircle, Loader2, Stethoscope, Search, ChevronDown, X } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { format } from 'date-fns';

interface Doctor {
  id: string;
  firstName: string;
  lastName: string;
  specialization?: string;
}

const RequestAppointmentPage: React.FC = () => {
  const { token, patient } = usePatientAuth();
  const navigate = useNavigate();
  const tenantSlug = localStorage.getItem('patient_tenant') || 'bulawayo-general';
  
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [availableSlots, setAvailableSlots] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingDoctors, setLoadingDoctors] = useState(true);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  
  // Doctor search states
  const [doctorSearchTerm, setDoctorSearchTerm] = useState('');
  const [filteredDoctors, setFilteredDoctors] = useState<Doctor[]>([]);
  const [showDoctorDropdown, setShowDoctorDropdown] = useState(false);
  const [selectedDoctorDisplay, setSelectedDoctorDisplay] = useState('');
  const doctorDropdownRef = useRef<HTMLDivElement>(null);

  const [formData, setFormData] = useState({
    doctorId: '',
    appointmentDate: '',
    appointmentTime: '',
    reason: '',
    durationMinutes: 30,
    appointmentType: 'consultation',
    notes: '',
    isTelehealth: false,
  });

  const [paymentData, setPaymentData] = useState({
    method: 'ecocash' as 'ecocash' | 'onemoney' | 'cash' | 'card',
    phoneNumber: patient?.phone || '',
    amount: 20, // Default consultation fee
    currency: 'USD',
  });

  useEffect(() => {
    loadDoctors();
  }, []);

  useEffect(() => {
    if (formData.doctorId && formData.appointmentDate) {
      loadAvailableSlots();
    } else {
      setAvailableSlots([]);
    }
  }, [formData.doctorId, formData.appointmentDate]);

  // Filter doctors based on search term
  useEffect(() => {
    if (doctorSearchTerm.trim() === '') {
      setFilteredDoctors(doctors);
    } else {
      const searchLower = doctorSearchTerm.toLowerCase();
      const filtered = doctors.filter(doctor =>
        `${doctor.firstName} ${doctor.lastName}`.toLowerCase().includes(searchLower) ||
        (doctor.specialization && doctor.specialization.toLowerCase().includes(searchLower)) ||
        `${doctor.firstName} ${doctor.lastName} ${doctor.specialization || ''}`.toLowerCase().includes(searchLower)
      );
      setFilteredDoctors(filtered);
    }
  }, [doctorSearchTerm, doctors]);

  // Update selected doctor display
  useEffect(() => {
    if (formData.doctorId) {
      const doctor = doctors.find(d => d.id === formData.doctorId);
      if (doctor) {
        setSelectedDoctorDisplay(`Dr. ${doctor.firstName} ${doctor.lastName}${doctor.specialization ? ` - ${doctor.specialization}` : ''}`);
        setDoctorSearchTerm(`Dr. ${doctor.firstName} ${doctor.lastName}${doctor.specialization ? ` - ${doctor.specialization}` : ''}`);
      }
    } else {
      setSelectedDoctorDisplay('');
      setDoctorSearchTerm('');
    }
  }, [formData.doctorId, doctors]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (doctorDropdownRef.current && !doctorDropdownRef.current.contains(event.target as Node)) {
        setShowDoctorDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const loadDoctors = async () => {
    try {
      setLoadingDoctors(true);
      const data = await patientPortalApi.getAvailableDoctors(token!, tenantSlug);
      setDoctors(data || []);
      setFilteredDoctors(data || []);
    } catch (err: any) {
      setError(err.message || 'Failed to load doctors');
    } finally {
      setLoadingDoctors(false);
    }
  };

  const handleDoctorSelect = (doctor: Doctor) => {
    setFormData({ ...formData, doctorId: doctor.id, appointmentDate: '', appointmentTime: '' });
    setSelectedDoctorDisplay(`Dr. ${doctor.firstName} ${doctor.lastName}${doctor.specialization ? ` - ${doctor.specialization}` : ''}`);
    setDoctorSearchTerm(`Dr. ${doctor.firstName} ${doctor.lastName}${doctor.specialization ? ` - ${doctor.specialization}` : ''}`);
    setShowDoctorDropdown(false);
  };

  const handleDoctorSearchChange = (value: string) => {
    setDoctorSearchTerm(value);
    setShowDoctorDropdown(true);
    if (!value) {
      setFormData({ ...formData, doctorId: '', appointmentDate: '', appointmentTime: '' });
      setSelectedDoctorDisplay('');
    }
  };

  const clearDoctorSelection = () => {
    setFormData({ ...formData, doctorId: '', appointmentDate: '', appointmentTime: '' });
    setDoctorSearchTerm('');
    setSelectedDoctorDisplay('');
    setShowDoctorDropdown(false);
  };

  const loadAvailableSlots = async () => {
    if (!formData.doctorId || !formData.appointmentDate) return;

    try {
      setLoadingSlots(true);
      const dateStr = formData.appointmentDate;
      const data = await patientPortalApi.getAvailableTimeSlots(
        formData.doctorId,
        dateStr,
        token!,
        tenantSlug,
      );
      setAvailableSlots(Array.isArray(data) ? data : []);
    } catch (err: any) {
      console.error('Failed to load available slots:', err);
      setAvailableSlots([]);
    } finally {
      setLoadingSlots(false);
    }
  };

  const handleDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const date = e.target.value;
    setFormData({ ...formData, appointmentDate: date, appointmentTime: '' });
  };

  const handleTimeSlotSelect = (slot: string) => {
    // Extract time from ISO string (HH:MM format)
    const slotDate = new Date(slot);
    const hours = slotDate.getHours().toString().padStart(2, '0');
    const minutes = slotDate.getMinutes().toString().padStart(2, '0');
    const timeString = `${hours}:${minutes}`;
    setFormData({ ...formData, appointmentTime: timeString });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess(false);

    if (!formData.doctorId) {
      setError('Please select a doctor');
      return;
    }

    if (!formData.appointmentDate || !formData.appointmentTime) {
      setError('Please select a date and time');
      return;
    }

    if (!formData.reason.trim()) {
      setError('Please provide a reason for the appointment');
      return;
    }

    if ((paymentData.method === 'ecocash' || paymentData.method === 'onemoney') && !paymentData.phoneNumber) {
      setError('Please provide a phone number for mobile money payment');
      return;
    }

    try {
      setSubmitting(true);

      // Combine date and time
      // appointmentTime is in HH:MM format, combine with date
      const appointmentDateTime = new Date(`${formData.appointmentDate}T${formData.appointmentTime}:00`);
      
      const result = await patientPortalApi.requestAppointmentWithPayment(
        {
          appointment: {
            doctorId: formData.doctorId,
            appointmentDate: appointmentDateTime.toISOString(),
            reason: formData.reason,
            durationMinutes: formData.durationMinutes,
            appointmentType: formData.appointmentType,
            notes: formData.notes,
            isTelehealth: formData.isTelehealth,
          },
          payment: paymentData,
        },
        token!,
        tenantSlug,
      );

      setSuccess(true);
      
      // Show success message and redirect
      setTimeout(() => {
        navigate('/appointments');
      }, 3000);
    } catch (err: any) {
      setError(err.message || 'Failed to request appointment');
      console.error('Error requesting appointment:', err);
    } finally {
      setSubmitting(false);
    }
  };

  const selectedDoctor = doctors.find(d => d.id === formData.doctorId);

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 via-white to-indigo-50 p-4">
        <div className="max-w-md w-full bg-white/80 backdrop-blur-sm rounded-2xl shadow-xl p-10 text-center border border-white/20">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-br from-green-500 to-emerald-600 rounded-full mb-6 shadow-lg animate-bounce">
            <CheckCircle className="w-10 h-10 text-white" />
          </div>
          <h2 className="text-3xl font-bold text-gray-900 mb-3">Appointment Requested!</h2>
          <p className="text-gray-600 mb-6">
            {paymentData.method === 'ecocash' || paymentData.method === 'onemoney'
              ? 'Please complete the mobile money payment to confirm your appointment. Check your phone for payment instructions.'
              : 'Your appointment has been requested and payment processed successfully!'}
          </p>
          <Link
            to="/appointments"
            className="inline-block px-6 py-3 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-xl font-semibold hover:from-indigo-700 hover:to-purple-700 transition-all transform hover:scale-105 shadow-lg"
          >
            View My Appointments
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50">
      {/* Header */}
      <header className="bg-white/80 backdrop-blur-sm shadow-sm border-b border-gray-200/50 sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center gap-4">
            <Link
              to="/appointments"
              className="w-10 h-10 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-xl flex items-center justify-center shadow-lg hover:scale-105 transition-transform"
            >
              <ArrowLeft className="w-5 h-5 text-white" />
            </Link>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Request Appointment</h1>
              <p className="text-sm text-gray-600">Book an appointment and pay online</p>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {error && (
          <div className="mb-6 p-4 bg-red-50 border-l-4 border-red-500 rounded-lg flex items-center gap-3 animate-shake">
            <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0" />
            <p className="text-sm font-medium text-red-800">{error}</p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Doctor Selection */}
          <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-lg p-6 border border-white/20 relative z-10">
            <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
              <Stethoscope className="w-5 h-5 text-blue-600" />
              Select Doctor
            </h2>
            {loadingDoctors ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-6 h-6 text-indigo-600 animate-spin" />
              </div>
            ) : (
              <div className="relative z-50" ref={doctorDropdownRef}>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                    <Search className="h-5 w-5 text-gray-400" />
                  </div>
                  <input
                    type="text"
                    value={doctorSearchTerm}
                    onChange={(e) => handleDoctorSearchChange(e.target.value)}
                    onFocus={() => setShowDoctorDropdown(true)}
                    placeholder="Search for a doctor..."
                    required={!formData.doctorId}
                    className="w-full pl-12 pr-10 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all bg-white/50 backdrop-blur-sm"
                  />
                  {formData.doctorId && (
                    <button
                      type="button"
                      onClick={clearDoctorSelection}
                      className="absolute inset-y-0 right-0 pr-4 flex items-center text-gray-400 hover:text-gray-600 transition-colors"
                    >
                      <X className="h-5 w-5" />
                    </button>
                  )}
                  {!formData.doctorId && (
                    <div className="absolute inset-y-0 right-0 pr-4 flex items-center pointer-events-none">
                      <ChevronDown className="h-5 w-5 text-gray-400" />
                    </div>
                  )}
                </div>
                
                {showDoctorDropdown && filteredDoctors.length > 0 && (
                  <div className="absolute z-[9999] w-full mt-2 bg-white rounded-xl shadow-2xl border border-gray-200 max-h-64 overflow-y-auto">
                    {filteredDoctors.map((doctor) => (
                      <button
                        key={doctor.id}
                        type="button"
                        onClick={() => handleDoctorSelect(doctor)}
                        className={`w-full px-4 py-3 text-left hover:bg-blue-50 transition-colors ${
                          formData.doctorId === doctor.id ? 'bg-blue-50 border-l-4 border-blue-600' : ''
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-full flex items-center justify-center text-white font-semibold">
                            {doctor.firstName.charAt(0)}{doctor.lastName.charAt(0)}
                          </div>
                          <div className="flex-1">
                            <p className="font-semibold text-gray-900">
                              Dr. {doctor.firstName} {doctor.lastName}
                            </p>
                            {doctor.specialization && (
                              <p className="text-sm text-gray-600">{doctor.specialization}</p>
                            )}
                          </div>
                          {formData.doctorId === doctor.id && (
                            <CheckCircle className="w-5 h-5 text-blue-600" />
                          )}
                        </div>
                      </button>
                    ))}
                  </div>
                )}
                
                {showDoctorDropdown && doctorSearchTerm && filteredDoctors.length === 0 && (
                  <div className="absolute z-[9999] w-full mt-2 bg-white rounded-xl shadow-2xl border border-gray-200 p-4 text-center text-gray-500">
                    <p>No doctors found matching "{doctorSearchTerm}"</p>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Date Selection */}
          {formData.doctorId && (
            <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-lg p-6 border border-white/20">
              <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
                <Calendar className="w-5 h-5 text-green-600" />
                Select Date
              </h2>
              <input
                type="date"
                value={formData.appointmentDate}
                onChange={handleDateChange}
                min={new Date().toISOString().split('T')[0]}
                max={new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]}
                required
                className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-green-500 transition-all bg-white/50 backdrop-blur-sm"
              />
              <p className="text-xs text-gray-500 mt-2">You can book appointments up to 90 days in advance</p>
            </div>
          )}

          {/* Time Slot Selection */}
          {formData.appointmentDate && formData.doctorId && (
            <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-lg p-6 border border-white/20">
              <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
                <Clock className="w-5 h-5 text-purple-600" />
                Select Time
              </h2>
              {loadingSlots ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-6 h-6 text-indigo-600 animate-spin" />
                </div>
              ) : availableSlots.length === 0 ? (
                <p className="text-gray-600 text-center py-4">No available time slots for this date</p>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                  {availableSlots.map((slot) => {
                    const slotDate = new Date(slot);
                    const hours = slotDate.getHours().toString().padStart(2, '0');
                    const minutes = slotDate.getMinutes().toString().padStart(2, '0');
                    const timeString = `${hours}:${minutes}`;
                    const isSelected = formData.appointmentTime === timeString;
                    return (
                      <button
                        key={slot}
                        type="button"
                        onClick={() => handleTimeSlotSelect(slot)}
                        disabled={false}
                        className={`px-4 py-3 rounded-xl font-semibold transition-all transform hover:scale-105 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${
                          isSelected
                            ? 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-lg ring-2 ring-purple-300'
                            : 'bg-gray-100 text-gray-700 hover:bg-gray-200 active:scale-95'
                        }`}
                      >
                        {format(slotDate, 'h:mm a')}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* Appointment Details */}
          <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-lg p-6 border border-white/20 relative z-0">
            <h2 className="text-xl font-bold text-gray-900 mb-4">Appointment Details</h2>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Reason for Visit <span className="text-red-500">*</span>
                </label>
                <textarea
                  value={formData.reason}
                  onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
                  required
                  rows={3}
                  placeholder="Briefly describe the reason for your appointment..."
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all bg-white/50 backdrop-blur-sm resize-none"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Duration</label>
                  <select
                    value={formData.durationMinutes}
                    onChange={(e) => setFormData({ ...formData, durationMinutes: parseInt(e.target.value) })}
                    className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all bg-white/50 backdrop-blur-sm"
                  >
                    <option value={15}>15 minutes</option>
                    <option value={30}>30 minutes</option>
                    <option value={45}>45 minutes</option>
                    <option value={60}>60 minutes</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Appointment Type</label>
                  <select
                    value={formData.appointmentType}
                    onChange={(e) => setFormData({ ...formData, appointmentType: e.target.value })}
                    className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all bg-white/50 backdrop-blur-sm"
                  >
                    <option value="consultation">Consultation</option>
                    <option value="follow-up">Follow-up</option>
                    <option value="checkup">Checkup</option>
                    <option value="emergency">Emergency</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.isTelehealth}
                    onChange={(e) => setFormData({ ...formData, isTelehealth: e.target.checked })}
                    className="w-5 h-5 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500 cursor-pointer"
                  />
                  <span className="text-sm font-medium text-gray-700">Telehealth appointment (Virtual)</span>
                </label>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Additional Notes (Optional)</label>
                <textarea
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  rows={2}
                  placeholder="Any additional information..."
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all bg-white/50 backdrop-blur-sm resize-none"
                />
              </div>
            </div>
          </div>

          {/* Payment Section */}
          <div className="bg-gradient-to-br from-yellow-50 to-orange-50 rounded-2xl shadow-lg p-6 border border-yellow-200">
            <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
              <CreditCard className="w-5 h-5 text-yellow-600" />
              Payment
            </h2>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Payment Method <span className="text-red-500">*</span></label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {['ecocash', 'onemoney', 'cash', 'card'].map((method) => (
                    <button
                      key={method}
                      type="button"
                      onClick={() => setPaymentData({ ...paymentData, method: method as any })}
                      className={`px-4 py-3 rounded-xl font-semibold transition-all transform hover:scale-105 ${
                        paymentData.method === method
                          ? 'bg-gradient-to-r from-yellow-600 to-orange-600 text-white shadow-lg'
                          : 'bg-white text-gray-700 hover:bg-gray-100 border-2 border-gray-200'
                      }`}
                    >
                      {method.charAt(0).toUpperCase() + method.slice(1)}
                    </button>
                  ))}
                </div>
              </div>

              {(paymentData.method === 'ecocash' || paymentData.method === 'onemoney') && (
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Phone Number <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                      <Phone className="h-5 w-5 text-gray-400" />
                    </div>
                    <input
                      type="tel"
                      value={paymentData.phoneNumber}
                      onChange={(e) => setPaymentData({ ...paymentData, phoneNumber: e.target.value })}
                      required
                      placeholder="e.g., 0771234567"
                      className="w-full pl-12 pr-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-yellow-500 focus:border-yellow-500 transition-all bg-white/50 backdrop-blur-sm"
                    />
                  </div>
                </div>
              )}

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Amount</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                    <DollarSign className="h-5 w-5 text-gray-400" />
                  </div>
                  <input
                    type="number"
                    value={paymentData.amount}
                    onChange={(e) => setPaymentData({ ...paymentData, amount: parseFloat(e.target.value) || 0 })}
                    min="0"
                    step="0.01"
                    required
                    className="w-full pl-12 pr-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-yellow-500 focus:border-yellow-500 transition-all bg-white/50 backdrop-blur-sm"
                  />
                </div>
                <p className="text-xs text-gray-500 mt-1">Default consultation fee: $20</p>
              </div>
            </div>
          </div>

          {/* Summary */}
          {selectedDoctor && formData.appointmentDate && formData.appointmentTime && (
            <div className="bg-gradient-to-r from-indigo-600 to-purple-600 rounded-2xl shadow-xl p-6 text-white">
              <h3 className="text-xl font-bold mb-4">Appointment Summary</h3>
              <div className="space-y-2 text-indigo-100">
                <p><span className="font-semibold">Doctor:</span> Dr. {selectedDoctor.firstName} {selectedDoctor.lastName}</p>
                <p><span className="font-semibold">Date:</span> {format(new Date(`${formData.appointmentDate}T${formData.appointmentTime || '12:00'}:00`), 'EEEE, MMMM d, yyyy')}</p>
                <p><span className="font-semibold">Time:</span> {formData.appointmentTime ? (() => {
                  const [hours, minutes] = formData.appointmentTime.split(':');
                  const timeDate = new Date();
                  timeDate.setHours(parseInt(hours), parseInt(minutes));
                  return format(timeDate, 'h:mm a');
                })() : 'Not selected'}</p>
                <p><span className="font-semibold">Duration:</span> {formData.durationMinutes} minutes</p>
                <p><span className="font-semibold">Type:</span> {formData.appointmentType}</p>
                {formData.isTelehealth && <p><span className="font-semibold">Mode:</span> Telehealth (Virtual)</p>}
                <p className="pt-2 border-t border-indigo-500 mt-2">
                  <span className="font-semibold">Total Amount:</span> ${paymentData.amount.toFixed(2)}
                </p>
              </div>
            </div>
          )}

          {/* Submit Button */}
          <div className="flex items-center gap-4">
            <Link
              to="/appointments"
              className="px-6 py-3 text-gray-700 hover:bg-gray-100 rounded-xl transition-colors border border-gray-200"
            >
              Cancel
            </Link>
            <button
              type="submit"
              disabled={submitting || !formData.doctorId || !formData.appointmentDate || !formData.appointmentTime || !formData.reason}
              className="flex-1 px-6 py-3 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-xl font-semibold hover:from-indigo-700 hover:to-purple-700 transition-all transform hover:scale-105 shadow-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {submitting ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Processing...
                </>
              ) : (
                <>
                  <CreditCard className="w-5 h-5" />
                  Request Appointment & Pay
                </>
              )}
            </button>
          </div>
        </form>
      </main>
    </div>
  );
};

export default RequestAppointmentPage;

