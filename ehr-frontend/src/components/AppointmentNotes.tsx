import React, { useState, useEffect } from 'react';
import { 
  FileText, Save, X, Plus, Edit, Trash2, 
  Pill, TestTube, Heart, Activity, AlertCircle,
  Calendar, Clock, User, Stethoscope
} from 'lucide-react';
import { useNotification } from './GlobalNotification.tsx';
import { ehrApi } from '../services/api.ts';
import { formatDateToDDMMYYYY, formatDateTimeToDDMMYYYYHHMM, parseDDMMYYYYToDate, parseDDMMYYYYHHMMToDate } from '../utils/dateFormatting';

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

interface TreatmentPlan {
  id: string;
  appointmentId: string;
  diagnosis: string;
  medications: Medication[];
  labOrders: LabOrder[];
  followUpInstructions: string;
  nextAppointment?: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

interface Medication {
  id: string;
  name: string;
  dosage: string;
  frequency: string;
  duration: string;
  instructions: string;
  prescribedBy: string;
  prescribedAt: string;
}

interface LabOrder {
  id: string;
  testName: string;
  testCode: string;
  instructions: string;
  priority: 'routine' | 'urgent' | 'stat';
  orderedBy: string;
  orderedAt: string;
}

interface AppointmentNotesProps {
  appointment: Appointment;
  onClose: () => void;
  onSave: () => void;
  tenantSlug: string;
  token: string;
}

const AppointmentNotes: React.FC<AppointmentNotesProps> = ({
  appointment,
  onClose,
  onSave,
  tenantSlug,
  token
}) => {
  const { showSuccess, showError } = useNotification();
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'notes' | 'treatment' | 'prescriptions' | 'lab'>('notes');
  
  // Notes state
  const [notes, setNotes] = useState(appointment.notes || '');
  const [chiefComplaint, setChiefComplaint] = useState('');
  const [historyOfPresentIllness, setHistoryOfPresentIllness] = useState('');
  const [physicalExam, setPhysicalExam] = useState('');
  const [assessment, setAssessment] = useState('');
  const [plan, setPlan] = useState('');
  
  // Treatment plan state
  const [treatmentPlan, setTreatmentPlan] = useState<TreatmentPlan | null>(null);
  const [diagnosis, setDiagnosis] = useState('');
  const [followUpInstructions, setFollowUpInstructions] = useState('');
  const [nextAppointment, setNextAppointment] = useState('');
  
  // Prescriptions state
  const [medications, setMedications] = useState<Medication[]>([]);
  const [newMedication, setNewMedication] = useState({
    name: '',
    dosage: '',
    frequency: '',
    duration: '',
    instructions: ''
  });
  const [showAddMedication, setShowAddMedication] = useState(false);
  
  // Lab orders state
  const [labOrders, setLabOrders] = useState<LabOrder[]>([]);
  const [newLabOrder, setNewLabOrder] = useState({
    testName: '',
    testCode: '',
    instructions: '',
    priority: 'routine' as 'routine' | 'urgent' | 'stat'
  });
  const [showAddLabOrder, setShowAddLabOrder] = useState(false);

  useEffect(() => {
    loadAppointmentData();
  }, [appointment.id]);

  const loadAppointmentData = async () => {
    try {
      // Parse existing comprehensive notes if they exist
      if (appointment.notes) {
        try {
          const parsedNotes = JSON.parse(appointment.notes);
          
          // Load clinical documentation
          if (parsedNotes.clinicalDocumentation) {
            setChiefComplaint(parsedNotes.clinicalDocumentation.chiefComplaint || '');
            setHistoryOfPresentIllness(parsedNotes.clinicalDocumentation.historyOfPresentIllness || '');
            setPhysicalExam(parsedNotes.clinicalDocumentation.physicalExamination || '');
            setAssessment(parsedNotes.clinicalDocumentation.clinicalAssessment || '');
          }
          
          // Load treatment plan
          if (parsedNotes.treatmentPlan) {
            setDiagnosis(parsedNotes.treatmentPlan.primaryDiagnosis || '');
            setPlan(parsedNotes.treatmentPlan.treatmentPlan || '');
            setFollowUpInstructions(parsedNotes.treatmentPlan.patientEducation || '');
          }
          
          // Load basic notes
          setNotes(parsedNotes.notes || appointment.notes || '');
          
        } catch (parseError) {
          // If JSON parsing fails, treat as plain text
          console.log('Notes are not in JSON format, treating as plain text');
          setNotes(appointment.notes || '');
        }
      } else {
        setNotes('');
      }
      
      // Load patient instructions
      if (appointment.patientInstructions) {
        setFollowUpInstructions(appointment.patientInstructions);
      }
      
    } catch (error) {
      console.error('Error loading appointment data:', error);
    }
  };

  const handleSaveNotes = async () => {
    try {
      setLoading(true);
      
      // Create comprehensive notes object with all clinical documentation
      const comprehensiveNotes = {
        // Basic notes
        notes: notes,
        
        // Clinical Documentation
        clinicalDocumentation: {
          chiefComplaint: chiefComplaint,
          historyOfPresentIllness: historyOfPresentIllness,
          physicalExamination: physicalExam,
          clinicalAssessment: assessment,
          additionalNotes: notes
        },
        
        // Treatment Plan
        treatmentPlan: {
          primaryDiagnosis: diagnosis,
          treatmentPlan: plan,
          patientEducation: followUpInstructions,
          followUpInstructions: followUpInstructions
        },
        
        // Patient Instructions (using existing field)
        patientInstructions: followUpInstructions
      };
      
      // Update the appointment with comprehensive notes
      await ehrApi.updateAppointment(appointment.id, {
        notes: JSON.stringify(comprehensiveNotes),
        patientInstructions: followUpInstructions
      }, token, tenantSlug);
      
      // Create follow-up appointment if next appointment date is set
      if (nextAppointment) {
        await createFollowUpAppointment();
      }
      
      showSuccess('Success', 'Appointment notes and follow-up saved successfully');
      onSave();
    } catch (error) {
      console.error('Error saving notes:', error);
      showError('Error', 'Failed to save appointment notes');
    } finally {
      setLoading(false);
    }
  };

  const createFollowUpAppointment = async () => {
    try {
      if (!nextAppointment) return;
      
      // Get current user for the follow-up appointment
      const userData = localStorage.getItem('ehr_user');
      const currentUser = userData ? JSON.parse(userData) : null;
      
      if (!currentUser) {
        showError('Error', 'Unable to create follow-up appointment: User not found');
        return;
      }
      
      // Create follow-up appointment data
      const followUpData = {
        patientId: appointment.patient.id,
        doctorId: currentUser.id,
        appointmentDate: nextAppointment,
        durationMinutes: appointment.durationMinutes || 30,
        appointmentType: 'Follow-up',
        status: 'scheduled',
        reason: `Follow-up for ${appointment.appointmentType} - ${new Date(appointment.appointmentDate).toLocaleDateString()}`,
        notes: `Follow-up appointment scheduled from appointment on ${new Date(appointment.appointmentDate).toLocaleDateString()}`,
        priorityLevel: 'normal',
        isTelehealth: appointment.isTelehealth || false,
        parentAppointmentId: appointment.id, // Link to original appointment
        createdBy: currentUser.id
      };
      
      console.log('🔍 Creating follow-up appointment:', followUpData);
      
      // Create the follow-up appointment
      const response = await ehrApi.createAppointment(followUpData, token, tenantSlug);
      
      console.log('✅ Follow-up appointment created:', response.data);
      showSuccess('Success', 'Follow-up appointment created successfully');
      
    } catch (error) {
      console.error('Error creating follow-up appointment:', error);
      showError('Error', 'Failed to create follow-up appointment');
    }
  };

  const handleAddMedication = () => {
    if (!newMedication.name || !newMedication.dosage || !newMedication.frequency) {
      showError('Error', 'Please fill in required medication fields');
      return;
    }

    const medication: Medication = {
      id: Date.now().toString(),
      ...newMedication,
      prescribedBy: 'current-user', // In real app, get from user context
      prescribedAt: new Date().toISOString()
    };

    setMedications(prev => [...prev, medication]);
    setNewMedication({
      name: '',
      dosage: '',
      frequency: '',
      duration: '',
      instructions: ''
    });
    setShowAddMedication(false);
    showSuccess('Success', 'Medication added to prescription list');
  };

  const handleAddLabOrder = () => {
    if (!newLabOrder.testName) {
      showError('Error', 'Please enter test name');
      return;
    }

    const labOrder: LabOrder = {
      id: Date.now().toString(),
      ...newLabOrder,
      orderedBy: 'current-user', // In real app, get from user context
      orderedAt: new Date().toISOString()
    };

    setLabOrders(prev => [...prev, labOrder]);
    setNewLabOrder({
      testName: '',
      testCode: '',
      instructions: '',
      priority: 'routine'
    });
    setShowAddLabOrder(false);
    showSuccess('Success', 'Lab order added');
  };

  const handleRemoveMedication = (id: string) => {
    setMedications(prev => prev.filter(med => med.id !== id));
  };

  const handleRemoveLabOrder = (id: string) => {
    setLabOrders(prev => prev.filter(order => order.id !== id));
  };

  const formatTime = (dateString: string) => {
    return new Date(dateString).toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    });
  };

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-md flex items-center justify-center z-[100] p-4 animate-in fade-in duration-300">
      <div className="bg-gradient-to-br from-white to-slate-50 rounded-3xl shadow-2xl border border-slate-200/50 w-full max-w-6xl h-[90vh] flex flex-col animate-in zoom-in-95 duration-300">
        {/* Header */}
        <div className="bg-gradient-to-r from-indigo-50 to-purple-50 border-b border-indigo-200/50 px-6 py-5 rounded-t-3xl">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-gradient-to-r from-indigo-500 to-purple-600 rounded-xl">
                <Stethoscope className="w-7 h-7 text-white" />
              </div>
              <div>
                <h2 className="text-2xl font-bold text-slate-900">Comprehensive Notes & Treatment</h2>
                <div className="flex items-center gap-6 mt-2 text-sm text-slate-600">
                  <div className="flex items-center gap-2">
                    <User className="w-4 h-4" />
                    <span className="font-medium">{appointment.patient.firstName} {appointment.patient.lastName}</span>
                    <span className="text-slate-400">•</span>
                    <span className="text-slate-500">ID: {appointment.patient.patientNumber}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Calendar className="w-4 h-4" />
                    <span>{formatDateToDDMMYYYY(appointment.appointmentDate)}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Clock className="w-4 h-4" />
                    <span>{formatTime(appointment.appointmentDate)}</span>
                  </div>
                </div>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-white/50 rounded-xl transition-colors"
            >
              <X className="w-6 h-6 text-slate-500" />
            </button>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="bg-slate-50/50 border-b border-slate-200/50">
          <nav className="flex space-x-1 px-6">
            <button
              onClick={() => setActiveTab('notes')}
              className={`py-4 px-4 border-b-2 font-medium text-sm rounded-t-lg transition-all ${
                activeTab === 'notes'
                  ? 'border-indigo-500 text-indigo-600 bg-white shadow-sm'
                  : 'border-transparent text-slate-500 hover:text-slate-700 hover:bg-white/50'
              }`}
            >
              <FileText className="w-4 h-4 inline mr-2" />
              Clinical Documentation
            </button>
            <button
              onClick={() => setActiveTab('treatment')}
              className={`py-4 px-4 border-b-2 font-medium text-sm rounded-t-lg transition-all ${
                activeTab === 'treatment'
                  ? 'border-indigo-500 text-indigo-600 bg-white shadow-sm'
                  : 'border-transparent text-slate-500 hover:text-slate-700 hover:bg-white/50'
              }`}
            >
              <Stethoscope className="w-4 h-4 inline mr-2" />
              Treatment & Follow-up
            </button>
            <button
              onClick={() => setActiveTab('prescriptions')}
              className={`py-4 px-4 border-b-2 font-medium text-sm rounded-t-lg transition-all ${
                activeTab === 'prescriptions'
                  ? 'border-indigo-500 text-indigo-600 bg-white shadow-sm'
                  : 'border-transparent text-slate-500 hover:text-slate-700 hover:bg-white/50'
              }`}
            >
              <Pill className="w-4 h-4 inline mr-2" />
              Prescriptions
            </button>
            <button
              onClick={() => setActiveTab('lab')}
              className={`py-4 px-4 border-b-2 font-medium text-sm rounded-t-lg transition-all ${
                activeTab === 'lab'
                  ? 'border-indigo-500 text-indigo-600 bg-white shadow-sm'
                  : 'border-transparent text-slate-500 hover:text-slate-700 hover:bg-white/50'
              }`}
            >
              <TestTube className="w-4 h-4 inline mr-2" />
              Lab Orders
            </button>
          </nav>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 bg-slate-50/30">
          {activeTab === 'notes' && (
            <div className="space-y-6">
              <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-200/50">
                <label className="block text-sm font-semibold text-slate-700 mb-3">
                  Chief Complaint
                </label>
                <textarea
                  value={chiefComplaint}
                  onChange={(e) => setChiefComplaint(e.target.value)}
                  rows={2}
                  placeholder="Patient's main concern or reason for visit..."
                  className="w-full border border-slate-300 rounded-xl px-4 py-3 focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-colors resize-none"
                />
              </div>

              <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-200/50">
                <label className="block text-sm font-semibold text-slate-700 mb-3">
                  History of Present Illness
                </label>
                <textarea
                  value={historyOfPresentIllness}
                  onChange={(e) => setHistoryOfPresentIllness(e.target.value)}
                  rows={4}
                  placeholder="Detailed history of the current problem, symptoms, duration, and progression..."
                  className="w-full border border-slate-300 rounded-xl px-4 py-3 focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-colors resize-none"
                />
              </div>

              <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-200/50">
                <label className="block text-sm font-semibold text-slate-700 mb-3">
                  Physical Examination
                </label>
                <textarea
                  value={physicalExam}
                  onChange={(e) => setPhysicalExam(e.target.value)}
                  rows={4}
                  placeholder="Physical examination findings, vital signs, and clinical observations..."
                  className="w-full border border-slate-300 rounded-xl px-4 py-3 focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-colors resize-none"
                />
              </div>

              <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-200/50">
                <label className="block text-sm font-semibold text-slate-700 mb-3">
                  Clinical Assessment
                </label>
                <textarea
                  value={assessment}
                  onChange={(e) => setAssessment(e.target.value)}
                  rows={3}
                  placeholder="Clinical impression, differential diagnosis, and assessment..."
                  className="w-full border border-slate-300 rounded-xl px-4 py-3 focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-colors resize-none"
                />
              </div>

              <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-200/50">
                <label className="block text-sm font-semibold text-slate-700 mb-3">
                  Additional Clinical Notes
                </label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={4}
                  placeholder="Any additional clinical observations, patient concerns, or relevant information..."
                  className="w-full border border-slate-300 rounded-xl px-4 py-3 focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-colors resize-none"
                />
              </div>
            </div>
          )}

          {activeTab === 'treatment' && (
            <div className="space-y-6">
              <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-200/50">
                <label className="block text-sm font-semibold text-slate-700 mb-3">
                  Primary Diagnosis
                </label>
                <input
                  type="text"
                  value={diagnosis}
                  onChange={(e) => setDiagnosis(e.target.value)}
                  placeholder="Enter primary diagnosis (ICD-10 code if applicable)..."
                  className="w-full border border-slate-300 rounded-xl px-4 py-3 focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-colors"
                />
              </div>

              <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-200/50">
                <label className="block text-sm font-semibold text-slate-700 mb-3">
                  Treatment Plan
                </label>
                <textarea
                  value={plan}
                  onChange={(e) => setPlan(e.target.value)}
                  rows={4}
                  placeholder="Detailed treatment plan including medications, procedures, lifestyle modifications, and therapeutic interventions..."
                  className="w-full border border-slate-300 rounded-xl px-4 py-3 focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-colors resize-none"
                />
              </div>

              <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-200/50">
                <label className="block text-sm font-semibold text-slate-700 mb-3">
                  Patient Education & Instructions
                </label>
                <textarea
                  value={followUpInstructions}
                  onChange={(e) => setFollowUpInstructions(e.target.value)}
                  rows={4}
                  placeholder="Instructions for patient regarding self-care, warning signs to watch for, and when to seek immediate medical attention..."
                  className="w-full border border-slate-300 rounded-xl px-4 py-3 focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-colors resize-none"
                />
              </div>

              <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-200/50">
                <label className="block text-sm font-semibold text-slate-700 mb-3">
                  Follow-up & Next Appointment
                </label>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-600 mb-2">
                      Next Appointment Date & Time
                    </label>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs text-slate-500 mb-1">Date (DD/MM/YYYY)</label>
                        <input
                          type="text"
                          placeholder="DD/MM/YYYY"
                          value={nextAppointment ? formatDateToDDMMYYYY(nextAppointment) : ''}
                          onChange={(e) => {
                            const dateStr = e.target.value;
                            const date = parseDDMMYYYYToDate(dateStr);
                            if (date) {
                              setNextAppointment(date.toISOString());
                            }
                          }}
                          className="w-full border border-slate-300 rounded-xl px-4 py-3 focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-colors"
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-slate-500 mb-1">Time</label>
                        <input
                          type="time"
                          value={nextAppointment ? new Date(nextAppointment).toTimeString().slice(0, 5) : ''}
                          onChange={(e) => {
                            if (nextAppointment) {
                              const [hours, minutes] = e.target.value.split(':');
                              const date = new Date(nextAppointment);
                              date.setHours(parseInt(hours), parseInt(minutes));
                              setNextAppointment(date.toISOString());
                            }
                          }}
                          className="w-full border border-slate-300 rounded-xl px-4 py-3 focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-colors"
                        />
                      </div>
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-600 mb-2">
                      Follow-up Instructions
                    </label>
                    <textarea
                      rows={3}
                      placeholder="Specific follow-up requirements, monitoring parameters, and timeline for next visit..."
                      className="w-full border border-slate-300 rounded-xl px-4 py-3 focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-colors resize-none"
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'prescriptions' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-gray-900">Prescribed Medications</h3>
                <button
                  onClick={() => setShowAddMedication(true)}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2"
                >
                  <Plus className="w-4 h-4" />
                  Add Medication
                </button>
              </div>

              {medications.length === 0 ? (
                <div className="text-center py-8">
                  <Pill className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                  <p className="text-gray-500">No medications prescribed</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {medications.map((medication) => (
                    <div key={medication.id} className="bg-gray-50 rounded-lg p-4">
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <h4 className="font-semibold text-gray-900">{medication.name}</h4>
                          <p className="text-sm text-gray-600">
                            {medication.dosage} - {medication.frequency}
                          </p>
                          <p className="text-sm text-gray-600">
                            Duration: {medication.duration}
                          </p>
                          {medication.instructions && (
                            <p className="text-sm text-gray-600 mt-1">
                              Instructions: {medication.instructions}
                            </p>
                          )}
                        </div>
                        <button
                          onClick={() => handleRemoveMedication(medication.id)}
                          className="p-2 text-red-600 hover:bg-red-100 rounded-lg transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {showAddMedication && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <h4 className="font-semibold text-blue-900 mb-4">Add New Medication</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Medication Name *</label>
                      <input
                        type="text"
                        value={newMedication.name}
                        onChange={(e) => setNewMedication(prev => ({ ...prev, name: e.target.value }))}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Dosage *</label>
                      <input
                        type="text"
                        value={newMedication.dosage}
                        onChange={(e) => setNewMedication(prev => ({ ...prev, dosage: e.target.value }))}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Frequency *</label>
                      <input
                        type="text"
                        value={newMedication.frequency}
                        onChange={(e) => setNewMedication(prev => ({ ...prev, frequency: e.target.value }))}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Duration</label>
                      <input
                        type="text"
                        value={newMedication.duration}
                        onChange={(e) => setNewMedication(prev => ({ ...prev, duration: e.target.value }))}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                    </div>
                  </div>
                  <div className="mt-4">
                    <label className="block text-sm font-medium text-gray-700 mb-1">Instructions</label>
                    <textarea
                      value={newMedication.instructions}
                      onChange={(e) => setNewMedication(prev => ({ ...prev, instructions: e.target.value }))}
                      rows={2}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                  <div className="flex gap-3 mt-4">
                    <button
                      onClick={() => setShowAddMedication(false)}
                      className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleAddMedication}
                      className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                    >
                      Add Medication
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab === 'lab' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-gray-900">Lab Orders</h3>
                <button
                  onClick={() => setShowAddLabOrder(true)}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2"
                >
                  <Plus className="w-4 h-4" />
                  Add Lab Order
                </button>
              </div>

              {labOrders.length === 0 ? (
                <div className="text-center py-8">
                  <TestTube className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                  <p className="text-gray-500">No lab orders</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {labOrders.map((order) => (
                    <div key={order.id} className="bg-gray-50 rounded-lg p-4">
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <h4 className="font-semibold text-gray-900">{order.testName}</h4>
                          {order.testCode && (
                            <p className="text-sm text-gray-600">Code: {order.testCode}</p>
                          )}
                          <p className="text-sm text-gray-600">
                            Priority: <span className={`font-medium ${
                              order.priority === 'stat' ? 'text-red-600' :
                              order.priority === 'urgent' ? 'text-orange-600' :
                              'text-blue-600'
                            }`}>
                              {order.priority.toUpperCase()}
                            </span>
                          </p>
                          {order.instructions && (
                            <p className="text-sm text-gray-600 mt-1">
                              Instructions: {order.instructions}
                            </p>
                          )}
                        </div>
                        <button
                          onClick={() => handleRemoveLabOrder(order.id)}
                          className="p-2 text-red-600 hover:bg-red-100 rounded-lg transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {showAddLabOrder && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <h4 className="font-semibold text-blue-900 mb-4">Add New Lab Order</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Test Name *</label>
                      <input
                        type="text"
                        value={newLabOrder.testName}
                        onChange={(e) => setNewLabOrder(prev => ({ ...prev, testName: e.target.value }))}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Test Code</label>
                      <input
                        type="text"
                        value={newLabOrder.testCode}
                        onChange={(e) => setNewLabOrder(prev => ({ ...prev, testCode: e.target.value }))}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Priority</label>
                      <select
                        value={newLabOrder.priority}
                        onChange={(e) => setNewLabOrder(prev => ({ ...prev, priority: e.target.value as 'routine' | 'urgent' | 'stat' }))}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      >
                        <option value="routine">Routine</option>
                        <option value="urgent">Urgent</option>
                        <option value="stat">STAT</option>
                      </select>
                    </div>
                  </div>
                  <div className="mt-4">
                    <label className="block text-sm font-medium text-gray-700 mb-1">Instructions</label>
                    <textarea
                      value={newLabOrder.instructions}
                      onChange={(e) => setNewLabOrder(prev => ({ ...prev, instructions: e.target.value }))}
                      rows={2}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                  <div className="flex gap-3 mt-4">
                    <button
                      onClick={() => setShowAddLabOrder(false)}
                      className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleAddLabOrder}
                      className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                    >
                      Add Lab Order
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 bg-slate-50 border-t border-slate-200 px-6 py-4 rounded-b-3xl">
          <div className="flex items-center justify-between">
            <div className="text-sm text-slate-500 flex items-center gap-2">
              <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
              Last saved: {new Date().toLocaleString()}
            </div>
            <div className="flex gap-3">
              <button
                onClick={onClose}
                className="px-6 py-3 border border-slate-300 text-slate-700 rounded-xl hover:bg-slate-50 transition-colors font-medium"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveNotes}
                disabled={loading}
                className="px-6 py-3 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-xl hover:from-indigo-700 hover:to-purple-700 transition-all font-medium shadow-lg disabled:opacity-50 flex items-center gap-2"
              >
                <Save className="w-4 h-4" />
                {loading ? 'Saving...' : 'Save All'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AppointmentNotes;
