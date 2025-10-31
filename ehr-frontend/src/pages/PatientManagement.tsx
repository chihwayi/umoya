import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  Users, Plus, Search, Filter, ArrowLeft, Eye, Edit, UserX,
  Calendar, Phone, Mail, MapPin, Heart, AlertTriangle, Shield
} from 'lucide-react';
import { useNotification } from '../components/GlobalNotification';
import { ehrApi } from '../services/api';
import CreatePatientModal from '../components/CreatePatientModal';

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
  emergencyContactRelationship?: string;
  medicalAidProvider?: string;
  medicalAidNumber?: string;
  bloodType?: string;
  allergies?: string;
  medicalHistory?: string;
  isActive: boolean;
  createdAt: string;
  age: number;
}

const PatientManagement: React.FC = () => {
  const { tenantSlug } = useParams<{ tenantSlug: string }>();
  const navigate = useNavigate();
  const [patients, setPatients] = useState<Patient[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [stats, setStats] = useState({ totalPatients: 0, newPatientsThisMonth: 0 });
  const { showSuccess, showError } = useNotification();

  useEffect(() => {
    fetchPatients();
    fetchStats();
  }, []);

  const fetchPatients = async () => {
    try {
      const token = localStorage.getItem('ehr_token');
      if (!token || !tenantSlug) return;
      
      const response = await ehrApi.getPatients(token, tenantSlug);
      setPatients(response.data.patients || response.data || []);
    } catch (error: any) {
      if (error.response?.status === 404 || error.response?.data?.message?.includes('not found')) {
        setPatients([]);
      } else {
        showError('Error', 'Failed to load patients');
      }
    } finally {
      setLoading(false);
    }
  };

  const fetchStats = async () => {
    try {
      const token = localStorage.getItem('ehr_token');
      if (!token || !tenantSlug) return;
      
      const response = await ehrApi.getPatientStats(token, tenantSlug);
      setStats(response.data || { totalPatients: 0, newPatientsThisMonth: 0 });
    } catch (error) {
      setStats({ totalPatients: 0, newPatientsThisMonth: 0 });
    }
  };

  const handleSearch = async () => {
    if (!searchTerm.trim()) {
      fetchPatients();
      return;
    }

    try {
      const token = localStorage.getItem('ehr_token');
      if (!token || !tenantSlug) return;
      
      const response = await ehrApi.searchPatients(searchTerm, token, tenantSlug);
      setPatients(response.data);
    } catch (error) {
      showError('Error', 'Search failed');
    }
  };

  const getGenderIcon = (gender: string) => {
    return gender === 'male' ? '👨' : gender === 'female' ? '👩' : '👤';
  };

  const getBloodTypeColor = (bloodType?: string) => {
    if (!bloodType) return 'bg-gray-100 text-gray-600';
    return 'bg-red-100 text-red-700';
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

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-blue-500 border-t-transparent"></div>
      </div>
    );
  }

  return (
    <div className="p-6">
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
          <div className="p-3 bg-gradient-to-r from-emerald-500 to-teal-600 rounded-xl">
            <Users className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-800">Patient Management</h1>
            <p className="text-slate-600">Manage patient records and information</p>
          </div>
        </div>
        
        <button
          onClick={() => setShowCreateModal(true)}
          className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-emerald-500 to-teal-600 text-white rounded-lg hover:from-emerald-600 hover:to-teal-700 transition-all"
        >
          <Plus className="w-4 h-4" />
          Add Patient
        </button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
        <div className="bg-white/70 backdrop-blur-sm rounded-2xl border border-slate-200/50 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-slate-600 text-sm">Total Patients</p>
              <p className="text-2xl font-bold text-slate-800 mt-1">{stats.totalPatients}</p>
            </div>
            <Users className="w-8 h-8 text-emerald-600" />
          </div>
        </div>
        
        <div className="bg-white/70 backdrop-blur-sm rounded-2xl border border-slate-200/50 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-slate-600 text-sm">New This Month</p>
              <p className="text-2xl font-bold text-slate-800 mt-1">{stats.newPatientsThisMonth}</p>
            </div>
            <Calendar className="w-8 h-8 text-blue-600" />
          </div>
        </div>
      </div>

      {/* Search & Filters */}
      <div className="bg-white/70 backdrop-blur-sm rounded-2xl border border-slate-200/50 p-4 mb-6">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-4 h-4" />
            <input
              type="text"
              placeholder="Search by name, MRN, National ID, or phone..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
              className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
            />
          </div>
          
          <button
            onClick={handleSearch}
            className="px-4 py-2 bg-emerald-500 text-white rounded-lg hover:bg-emerald-600 transition-colors"
          >
            Search
          </button>
        </div>
      </div>

      {/* Patients Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
        {patients.map((patient) => (
          <div key={patient.id} className="bg-white/70 backdrop-blur-sm rounded-2xl border border-slate-200/50 p-6 hover:shadow-lg transition-all">
            {/* Patient Header */}
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-gradient-to-r from-emerald-500 to-teal-600 rounded-full flex items-center justify-center text-white text-lg">
                  {getGenderIcon(patient.gender)}
                </div>
                <div>
                  <h3 className="font-semibold text-slate-800">{patient.firstName} {patient.lastName}</h3>
                  <p className="text-sm text-slate-600">MRN: {patient.patientNumber}</p>
                </div>
              </div>
              
              <div className="flex items-center gap-1">
                {patient.bloodType && (
                  <span className={`px-2 py-1 text-xs font-medium rounded-full ${getBloodTypeColor(patient.bloodType)}`}>
                    {patient.bloodType}
                  </span>
                )}
                {patient.allergies && (
                  <div title="Has allergies">
                    <AlertTriangle className="w-4 h-4 text-amber-500" />
                  </div>
                )}
              </div>
            </div>

            {/* Patient Details */}
            <div className="space-y-2 mb-4">
              <div className="flex items-center gap-2 text-sm text-slate-600">
                <Calendar className="w-4 h-4" />
                <span>{calculateAge(patient.dateOfBirth)} years old</span>
              </div>
              
              <div className="flex items-center gap-2 text-sm text-slate-600">
                <Phone className="w-4 h-4" />
                <span>{patient.phone}</span>
              </div>
              
              {patient.email && (
                <div className="flex items-center gap-2 text-sm text-slate-600">
                  <Mail className="w-4 h-4" />
                  <span>{patient.email}</span>
                </div>
              )}
              
              <div className="flex items-center gap-2 text-sm text-slate-600">
                <MapPin className="w-4 h-4" />
                <span>{patient.city}</span>
              </div>

              {patient.medicalAidProvider && (
                <div className="flex items-center gap-2 text-sm text-slate-600">
                  <Shield className="w-4 h-4" />
                  <span>{patient.medicalAidProvider}</span>
                </div>
              )}
            </div>

            {/* Emergency Contact */}
            <div className="bg-slate-50 rounded-lg p-3 mb-4">
              <p className="text-xs font-medium text-slate-700 mb-1">Emergency Contact</p>
              <p className="text-sm text-slate-600">{patient.emergencyContactName}</p>
              <p className="text-xs text-slate-500">{patient.emergencyContactPhone}</p>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-2">
              <button 
                onClick={() => navigate(`/ehr/${tenantSlug}/patients/${patient.id}`)}
                className="flex items-center gap-1 px-3 py-1 text-xs bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 transition-colors"
              >
                <Eye className="w-3 h-3" />
                View
              </button>
              
              <button className="flex items-center gap-1 px-3 py-1 text-xs bg-emerald-100 text-emerald-700 rounded-lg hover:bg-emerald-200 transition-colors">
                <Edit className="w-3 h-3" />
                Edit
              </button>
              
              <button className="flex items-center gap-1 px-3 py-1 text-xs bg-red-100 text-red-700 rounded-lg hover:bg-red-200 transition-colors">
                <UserX className="w-3 h-3" />
                Deactivate
              </button>
            </div>
          </div>
        ))}
      </div>

      {patients.length === 0 && (
        <div className="text-center py-12">
          <Users className="w-16 h-16 text-slate-300 mx-auto mb-4" />
          <h3 className="text-xl font-semibold text-slate-600 mb-2">No patients found</h3>
          <p className="text-slate-500">Add your first patient to get started</p>
        </div>
      )}

      {/* Create Patient Modal */}
      <CreatePatientModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onPatientCreated={fetchPatients}
        tenantSlug={tenantSlug!}
      />
    </div>
  );
};

export default PatientManagement;