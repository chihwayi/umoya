import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  ArrowLeft, User, Calendar, Phone, Mail, MapPin, Heart, Shield, 
  AlertTriangle, Edit, FileText, Clock, Activity
} from 'lucide-react';
import { useNotification } from '../components/GlobalNotification';
import { ehrApi } from '../services/api';
import CurrentMedications from '../components/CurrentMedications';
import MedicationTimeline from '../components/MedicationTimeline';
import MedicationReconciliation from '../components/MedicationReconciliation';
import PatientProTrends from '../components/PatientProTrends';
import PatientProSchedules from '../components/PatientProSchedules';

interface Patient {
  id: string;
  patientNumber: string;
  firstName: string;
  lastName: string;
  dateOfBirth: string;
  gender: string;
  nationalId: string;
  phone: string;
  email?: string;
  address: string;
  city: string;
  emergencyContactName: string;
  emergencyContactPhone: string;
  medicalAidProvider?: string;
  medicalAidNumber?: string;
  bloodType?: string;
  allergies?: string;
  medicalHistory?: string;
  createdAt: string;
  age: number;
}

const PatientDetail: React.FC = () => {
  const { tenantSlug, patientId } = useParams<{ tenantSlug: string; patientId: string }>();
  const navigate = useNavigate();
  const [patient, setPatient] = useState<Patient | null>(null);
  const [loading, setLoading] = useState(true);
  const { showError } = useNotification();

  useEffect(() => {
    fetchPatient();
  }, [patientId]);

  const fetchPatient = async () => {
    try {
      const token = localStorage.getItem('ehr_token');
      if (!token || !tenantSlug || !patientId) return;
      
      const response = await ehrApi.getPatientById(patientId, token, tenantSlug);
      setPatient(response.data);
    } catch (error) {
      showError('Error', 'Failed to load patient details');
      navigate(`/ehr/${tenantSlug}/patients`);
    } finally {
      setLoading(false);
    }
  };

  const calculateAge = (dateOfBirth: string) => {
    const today = new Date();
    const birthDate = new Date(dateOfBirth);
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }
    
    return age;
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-GB');
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-emerald-500 border-t-transparent"></div>
      </div>
    );
  }

  if (!patient) {
    return (
      <div className="p-6">
        <div className="text-center py-12">
          <User className="w-16 h-16 text-slate-300 mx-auto mb-4" />
          <h3 className="text-xl font-semibold text-slate-600 mb-2">Patient not found</h3>
          <button
            onClick={() => navigate(`/ehr/${tenantSlug}/patients`)}
            className="text-emerald-600 hover:text-emerald-700"
          >
            Back to patients
          </button>
        </div>
      </div>
    );
  }

  const authToken = (typeof window !== 'undefined' && localStorage.getItem('ehr_token')) || '';

  return (
    <div className="p-6">
      {/* Back Button */}
      <button
        onClick={() => navigate(`/ehr/${tenantSlug}/patients`)}
        className="flex items-center gap-2 text-slate-600 hover:text-slate-800 mb-6 transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        <span className="text-sm">Back to Patients</span>
      </button>

      {/* Patient Header */}
      <div className="bg-white/70 backdrop-blur-sm rounded-2xl border border-slate-200/50 p-6 mb-6">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 bg-gradient-to-r from-emerald-500 to-teal-600 rounded-full flex items-center justify-center text-white text-2xl">
              {patient.gender === 'male' ? '👨' : patient.gender === 'female' ? '👩' : '👤'}
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-800">{patient.firstName} {patient.lastName}</h1>
              <p className="text-slate-600">MRN: {patient.patientNumber}</p>
              <div className="flex items-center gap-4 mt-2">
                <span className="text-sm text-slate-600">{calculateAge(patient.dateOfBirth)} years old</span>
                {patient.bloodType && (
                  <span className="px-2 py-1 text-xs font-medium bg-red-100 text-red-700 rounded-full">
                    {patient.bloodType}
                  </span>
                )}
                {patient.allergies && (
                  <div className="flex items-center gap-1 px-2 py-1 bg-amber-100 text-amber-700 rounded-full">
                    <AlertTriangle className="w-3 h-3" />
                    <span className="text-xs font-medium">Allergies</span>
                  </div>
                )}
              </div>
            </div>
          </div>
          
          <button className="flex items-center gap-2 px-4 py-2 bg-emerald-500 text-white rounded-lg hover:bg-emerald-600 transition-colors">
            <Edit className="w-4 h-4" />
            Edit Patient
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Personal Information */}
        <div className="bg-white/70 backdrop-blur-sm rounded-2xl border border-slate-200/50 p-6">
          <h2 className="text-lg font-semibold text-slate-800 mb-4 flex items-center gap-2">
            <User className="w-5 h-5" />
            Personal Information
          </h2>
          
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium text-slate-600">First Name</label>
                <p className="text-slate-800">{patient.firstName}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-slate-600">Last Name</label>
                <p className="text-slate-800">{patient.lastName}</p>
              </div>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium text-slate-600">Date of Birth</label>
                <p className="text-slate-800">{formatDate(patient.dateOfBirth)}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-slate-600">Gender</label>
                <p className="text-slate-800 capitalize">{patient.gender}</p>
              </div>
            </div>
            
            <div>
              <label className="text-sm font-medium text-slate-600">National ID</label>
              <p className="text-slate-800">{patient.nationalId}</p>
            </div>
          </div>
        </div>

        {/* Contact Information */}
        <div className="bg-white/70 backdrop-blur-sm rounded-2xl border border-slate-200/50 p-6">
          <h2 className="text-lg font-semibold text-slate-800 mb-4 flex items-center gap-2">
            <Phone className="w-5 h-5" />
            Contact Information
          </h2>
          
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium text-slate-600">Phone</label>
              <p className="text-slate-800">{patient.phone}</p>
            </div>
            
            {patient.email && (
              <div>
                <label className="text-sm font-medium text-slate-600">Email</label>
                <p className="text-slate-800">{patient.email}</p>
              </div>
            )}
            
            <div>
              <label className="text-sm font-medium text-slate-600">Address</label>
              <p className="text-slate-800">{patient.address}</p>
            </div>
            
            <div>
              <label className="text-sm font-medium text-slate-600">City</label>
              <p className="text-slate-800">{patient.city}</p>
            </div>
          </div>
        </div>

        {/* Emergency Contact */}
        <div className="bg-white/70 backdrop-blur-sm rounded-2xl border border-slate-200/50 p-6">
          <h2 className="text-lg font-semibold text-slate-800 mb-4 flex items-center gap-2">
            <AlertTriangle className="w-5 h-5" />
            Emergency Contact
          </h2>
          
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium text-slate-600">Contact Name</label>
              <p className="text-slate-800">{patient.emergencyContactName}</p>
            </div>
            
            <div>
              <label className="text-sm font-medium text-slate-600">Phone Number</label>
              <p className="text-slate-800">{patient.emergencyContactPhone}</p>
            </div>
          </div>
        </div>

        {/* Medical Aid */}
        {patient.medicalAidProvider && (
          <div className="bg-white/70 backdrop-blur-sm rounded-2xl border border-slate-200/50 p-6">
            <h2 className="text-lg font-semibold text-slate-800 mb-4 flex items-center gap-2">
              <Shield className="w-5 h-5" />
              Medical Aid
            </h2>
            
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium text-slate-600">Provider</label>
                <p className="text-slate-800">{patient.medicalAidProvider}</p>
              </div>
              
              {patient.medicalAidNumber && (
                <div>
                  <label className="text-sm font-medium text-slate-600">Member Number</label>
                  <p className="text-slate-800">{patient.medicalAidNumber}</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Medical Information */}
        <div className="bg-white/70 backdrop-blur-sm rounded-2xl border border-slate-200/50 p-6 lg:col-span-2">
          <h2 className="text-lg font-semibold text-slate-800 mb-4 flex items-center gap-2">
            <Heart className="w-5 h-5" />
            Medical Information
          </h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {patient.allergies && (
              <div>
                <label className="text-sm font-medium text-slate-600 flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-amber-500" />
                  Known Allergies
                </label>
                <div className="mt-2 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                  <p className="text-slate-800">{patient.allergies}</p>
                </div>
              </div>
            )}
            
            {patient.medicalHistory && (
              <div>
                <label className="text-sm font-medium text-slate-600">Medical History</label>
                <div className="mt-2 p-3 bg-slate-50 border border-slate-200 rounded-lg">
                  <p className="text-slate-800">{patient.medicalHistory}</p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Registration Info */}
        <div className="bg-white/70 backdrop-blur-sm rounded-2xl border border-slate-200/50 p-6 lg:col-span-2">
          <h2 className="text-lg font-semibold text-slate-800 mb-4 flex items-center gap-2">
            <Clock className="w-5 h-5" />
            Registration Information
          </h2>
          
          <div className="flex items-center gap-6 text-sm text-slate-600">
            <span>Registered: {formatDate(patient.createdAt)}</span>
            <span>Patient ID: {patient.id}</span>
          </div>
        </div>
      </div>

      {/* Current Medications */}
      <div className="mt-6">
        <CurrentMedications
          patientId={patient.id}
          tenantSlug={tenantSlug!}
          token={authToken}
        />
      </div>

      {/* Medication Timeline */}
      <div className="mt-6">
        <MedicationTimeline patientId={patient.id} tenantSlug={tenantSlug!} token={authToken} />
      </div>

      {/* Medication Reconciliation */}
      <div className="mt-6">
        <MedicationReconciliation patientId={patient.id} tenantSlug={tenantSlug!} token={authToken} />
      </div>

      {/* PRO Trends */}
      <div className="mt-6">
        <PatientProTrends patientId={patient.id} tenantSlug={tenantSlug!} token={authToken} />
      </div>

      {/* PRO Schedules */}
      <div className="mt-6">
        <PatientProSchedules patientId={patient.id} tenantSlug={tenantSlug!} token={authToken} />
      </div>
    </div>
  );
};

export default PatientDetail;