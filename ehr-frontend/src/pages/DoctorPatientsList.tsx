import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  ArrowLeft, Users, Search, Filter, Plus, Eye, Phone, Mail, Calendar,
  User, Heart, Activity, AlertCircle, RefreshCw, ChevronLeft, ChevronRight
} from 'lucide-react';
import { ehrApi } from '../services/api';
import { useNotification } from '../components/GlobalNotification';
import { formatDateToDDMMYYYY } from '../utils/dateFormatting';

interface Patient {
  id: string;
  patientNumber: string;
  firstName: string;
  lastName: string;
  dateOfBirth: string;
  gender: string;
  phone: string;
  email: string;
  address: string;
  city: string;
  bloodType: string;
  allergies: string;
  chronicConditions: string;
  emergencyContactName: string;
  emergencyContactPhone: string;
  medicalAidName: string;
  medicalAidNumber: string;
  medicalAidPlan: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

interface Appointment {
  id: string;
  appointmentDate: string;
  appointmentType: string;
  status: string;
  reason: string;
}

const DoctorPatientsList: React.FC = () => {
  const { tenantSlug } = useParams<{ tenantSlug: string }>();
  const navigate = useNavigate();
  const { showError } = useNotification();
  
  const [patients, setPatients] = useState<Patient[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterGender, setFilterGender] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [patientsPerPage] = useState(10);
  const [patientAppointments, setPatientAppointments] = useState<{ [key: string]: Appointment[] }>({});

  useEffect(() => {
    fetchPatients();
  }, []);

  const fetchPatients = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('ehr_token');
      if (!token) return;

      const response = await ehrApi.getPatients(token, tenantSlug!);
      setPatients(response.data.patients || []);
      
      // Fetch appointments for each patient to show recent activity
      await fetchPatientAppointments(response.data.patients || []);
    } catch (error) {
      console.error('Error fetching patients:', error);
      showError('Error', 'Failed to fetch patients');
    } finally {
      setLoading(false);
    }
  };

  const fetchPatientAppointments = async (patients: Patient[]) => {
    try {
      const token = localStorage.getItem('ehr_token');
      if (!token) return;

      // Get current user to filter appointments by doctor
      const userData = localStorage.getItem('ehr_user');
      const currentUser = userData ? JSON.parse(userData) : null;
      
      if (!currentUser) return;

      const appointmentsMap: { [key: string]: Appointment[] } = {};

      // Fetch appointments for each patient
      for (const patient of patients) {
        try {
          const response = await ehrApi.getAppointments(token, tenantSlug!, {
            date: new Date().toISOString().split('T')[0]
          });

          // Filter appointments for this patient and current doctor
          const patientAppointments = response.data.appointments.filter(
            (apt: any) => 
              apt.patient.id === patient.id && 
              apt.doctor.id === currentUser.id
          );

          appointmentsMap[patient.id] = patientAppointments.slice(0, 3); // Show only last 3 appointments
        } catch (error) {
          console.error(`Error fetching appointments for patient ${patient.id}:`, error);
          appointmentsMap[patient.id] = [];
        }
      }

      setPatientAppointments(appointmentsMap);
    } catch (error) {
      console.error('Error fetching patient appointments:', error);
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
      case 'scheduled': return <Calendar className="w-3 h-3" />;
      case 'confirmed': return <Calendar className="w-3 h-3" />;
      case 'in-progress': return <Activity className="w-3 h-3" />;
      case 'completed': return <Calendar className="w-3 h-3" />;
      case 'cancelled': return <AlertCircle className="w-3 h-3" />;
      case 'no-show': return <AlertCircle className="w-3 h-3" />;
      default: return <Calendar className="w-3 h-3" />;
    }
  };

  const filteredPatients = patients.filter(patient => {
    const matchesSearch = searchTerm === '' || 
      patient.firstName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      patient.lastName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      patient.patientNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
      patient.phone?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      patient.email?.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesGender = filterGender === 'all' || patient.gender === filterGender;
    const matchesStatus = filterStatus === 'all' || 
      (filterStatus === 'active' && patient.isActive) ||
      (filterStatus === 'inactive' && !patient.isActive);
    
    return matchesSearch && matchesGender && matchesStatus;
  });

  // Pagination
  const indexOfLastPatient = currentPage * patientsPerPage;
  const indexOfFirstPatient = indexOfLastPatient - patientsPerPage;
  const currentPatients = filteredPatients.slice(indexOfFirstPatient, indexOfLastPatient);
  const totalPages = Math.ceil(filteredPatients.length / patientsPerPage);

  const paginate = (pageNumber: number) => setCurrentPage(pageNumber);

  const getPatientStats = () => {
    const total = patients.length;
    const active = patients.filter(p => p.isActive).length;
    const inactive = patients.filter(p => !p.isActive).length;
    const male = patients.filter(p => p.gender === 'male').length;
    const female = patients.filter(p => p.gender === 'female').length;

    return { total, active, inactive, male, female };
  };

  const stats = getPatientStats();

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50">
      {/* Header */}
      <div className="bg-white/80 backdrop-blur-sm shadow-lg border-b border-slate-200/50 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-20">
            <div className="flex items-center gap-6">
              <button
                onClick={() => navigate(`/ehr/${tenantSlug}/doctor`)}
                className="p-3 hover:bg-slate-100 rounded-xl transition-all duration-200 group"
              >
                <ArrowLeft className="w-5 h-5 text-slate-600 group-hover:text-slate-900 transition-colors" />
              </button>
              <div className="flex items-center gap-4">
                <div className="p-3 bg-gradient-to-r from-blue-500 to-indigo-600 rounded-2xl shadow-lg">
                  <Users className="w-7 h-7 text-white" />
                </div>
                <div>
                  <h1 className="text-2xl font-bold text-slate-900">My Patients</h1>
                  <p className="text-slate-600 font-medium">Manage your patient records and medical history</p>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={fetchPatients}
                disabled={loading}
                className="p-3 hover:bg-slate-100 rounded-xl transition-all duration-200 disabled:opacity-50 group"
              >
                <RefreshCw className={`w-5 h-5 text-slate-600 group-hover:text-slate-900 transition-colors ${loading ? 'animate-spin' : ''}`} />
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-6 mb-8">
          <div className="bg-gradient-to-br from-white to-slate-50 rounded-2xl shadow-lg border border-slate-200/50 p-6 hover:shadow-xl transition-all duration-300">
            <div className="flex items-center justify-between mb-3">
              <div className="p-2 bg-gradient-to-r from-slate-500 to-slate-600 rounded-xl">
                <Users className="w-5 h-5 text-white" />
              </div>
              <div className="text-3xl font-bold text-slate-900">{stats.total}</div>
            </div>
            <div className="text-sm font-semibold text-slate-600">Total Patients</div>
          </div>
          <div className="bg-gradient-to-br from-white to-green-50 rounded-2xl shadow-lg border border-green-200/50 p-6 hover:shadow-xl transition-all duration-300">
            <div className="flex items-center justify-between mb-3">
              <div className="p-2 bg-gradient-to-r from-green-500 to-emerald-600 rounded-xl">
                <Heart className="w-5 h-5 text-white" />
              </div>
              <div className="text-3xl font-bold text-green-600">{stats.active}</div>
            </div>
            <div className="text-sm font-semibold text-slate-600">Active</div>
          </div>
          <div className="bg-gradient-to-br from-white to-gray-50 rounded-2xl shadow-lg border border-gray-200/50 p-6 hover:shadow-xl transition-all duration-300">
            <div className="flex items-center justify-between mb-3">
              <div className="p-2 bg-gradient-to-r from-gray-500 to-slate-600 rounded-xl">
                <User className="w-5 h-5 text-white" />
              </div>
              <div className="text-3xl font-bold text-gray-600">{stats.inactive}</div>
            </div>
            <div className="text-sm font-semibold text-slate-600">Inactive</div>
          </div>
          <div className="bg-gradient-to-br from-white to-blue-50 rounded-2xl shadow-lg border border-blue-200/50 p-6 hover:shadow-xl transition-all duration-300">
            <div className="flex items-center justify-between mb-3">
              <div className="p-2 bg-gradient-to-r from-blue-500 to-cyan-600 rounded-xl">
                <User className="w-5 h-5 text-white" />
              </div>
              <div className="text-3xl font-bold text-blue-600">{stats.male}</div>
            </div>
            <div className="text-sm font-semibold text-slate-600">Male</div>
          </div>
          <div className="bg-gradient-to-br from-white to-pink-50 rounded-2xl shadow-lg border border-pink-200/50 p-6 hover:shadow-xl transition-all duration-300">
            <div className="flex items-center justify-between mb-3">
              <div className="p-2 bg-gradient-to-r from-pink-500 to-rose-600 rounded-xl">
                <User className="w-5 h-5 text-white" />
              </div>
              <div className="text-3xl font-bold text-pink-600">{stats.female}</div>
            </div>
            <div className="text-sm font-semibold text-slate-600">Female</div>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-gradient-to-br from-white to-slate-50 rounded-2xl shadow-lg border border-slate-200/50 p-8 mb-8">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2 bg-gradient-to-r from-indigo-500 to-purple-600 rounded-xl">
              <Filter className="w-5 h-5 text-white" />
            </div>
            <h3 className="text-lg font-bold text-slate-900">Search & Filter Patients</h3>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-3">Search Patients</label>
              <div className="relative">
                <Search className="w-5 h-5 absolute left-4 top-1/2 transform -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search by name, ID, phone, email..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-12 pr-4 py-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all duration-200 bg-white/50"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-3">Gender</label>
              <select
                value={filterGender}
                onChange={(e) => setFilterGender(e.target.value)}
                className="w-full border border-slate-300 rounded-xl px-4 py-3 focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all duration-200 bg-white/50"
              >
                <option value="all">All Genders</option>
                <option value="male">Male</option>
                <option value="female">Female</option>
                <option value="other">Other</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-3">Status</label>
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="w-full border border-slate-300 rounded-xl px-4 py-3 focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all duration-200 bg-white/50"
              >
                <option value="all">All Status</option>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
            </div>
            <div className="flex items-end">
              <button
                onClick={() => {
                  setSearchTerm('');
                  setFilterGender('all');
                  setFilterStatus('all');
                }}
                className="w-full px-6 py-3 bg-gradient-to-r from-slate-500 to-slate-600 text-white rounded-xl hover:from-slate-600 hover:to-slate-700 transition-all duration-200 font-semibold shadow-lg hover:shadow-xl"
              >
                Clear Filters
              </button>
            </div>
          </div>
        </div>

        {/* Patients List */}
        <div className="bg-gradient-to-br from-white to-slate-50 rounded-2xl shadow-lg border border-slate-200/50 overflow-hidden">
          <div className="bg-gradient-to-r from-slate-50 to-blue-50 p-8 border-b border-slate-200/50">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-gradient-to-r from-blue-500 to-indigo-600 rounded-xl">
                  <Users className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-slate-900">
                    My Patients ({filteredPatients.length})
                  </h3>
                  <p className="text-sm text-slate-600 font-medium">
                    Showing {indexOfFirstPatient + 1}-{Math.min(indexOfLastPatient, filteredPatients.length)} of {filteredPatients.length} patients
                  </p>
                </div>
              </div>
            </div>
          </div>
          
          <div className="p-6">
            {loading ? (
              <div className="text-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
                <p className="text-slate-600">Loading patients...</p>
              </div>
            ) : currentPatients.length === 0 ? (
              <div className="text-center py-8">
                <Users className="w-12 h-12 text-slate-400 mx-auto mb-4" />
                <p className="text-slate-500">No patients found matching your criteria</p>
              </div>
            ) : (
              <div className="space-y-6">
                {currentPatients.map((patient) => (
                  <div key={patient.id} className="bg-gradient-to-r from-white to-slate-50/50 border border-slate-200/50 rounded-2xl p-8 hover:shadow-xl hover:border-indigo-200/50 transition-all duration-300 group">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-6 mb-6">
                          <div className="w-16 h-16 bg-gradient-to-br from-blue-500 via-indigo-600 to-purple-600 rounded-2xl flex items-center justify-center text-white font-bold text-xl shadow-lg group-hover:shadow-xl transition-all duration-300">
                            {patient.firstName.charAt(0)}{patient.lastName.charAt(0)}
                          </div>
                          <div className="flex-1">
                            <h4 className="text-xl font-bold text-slate-900 group-hover:text-indigo-900 transition-colors mb-2">
                              {patient.firstName} {patient.lastName}
                            </h4>
                            <p className="text-slate-600 font-medium mb-3">
                              ID: {patient.patientNumber} • {calculateAge(patient.dateOfBirth)} years old • {patient.gender}
                            </p>
                            <div className="flex items-center gap-4">
                              <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                                patient.isActive ? 'bg-gradient-to-r from-green-100 to-emerald-100 text-green-800 border border-green-200' : 'bg-gradient-to-r from-gray-100 to-slate-100 text-gray-800 border border-gray-200'
                              }`}>
                                {patient.isActive ? 'Active' : 'Inactive'}
                              </span>
                              <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                                patient.gender === 'male' ? 'bg-gradient-to-r from-blue-100 to-cyan-100 text-blue-800 border border-blue-200' :
                                patient.gender === 'female' ? 'bg-gradient-to-r from-pink-100 to-rose-100 text-pink-800 border border-pink-200' :
                                'bg-gradient-to-r from-gray-100 to-slate-100 text-gray-800 border border-gray-200'
                              }`}>
                                {patient.gender}
                              </span>
                            </div>
                          </div>
                        </div>
                        
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-sm mb-6">
                          <div className="flex items-center gap-3 p-3 bg-white/50 rounded-xl border border-slate-200/50">
                            <div className="p-2 bg-gradient-to-r from-green-100 to-emerald-100 rounded-lg">
                              <Phone className="w-4 h-4 text-green-600" />
                            </div>
                            <span className="text-slate-700 font-medium">{patient.phone || 'No phone'}</span>
                          </div>
                          <div className="flex items-center gap-3 p-3 bg-white/50 rounded-xl border border-slate-200/50">
                            <div className="p-2 bg-gradient-to-r from-blue-100 to-cyan-100 rounded-lg">
                              <Mail className="w-4 h-4 text-blue-600" />
                            </div>
                            <span className="text-slate-700 font-medium">{patient.email || 'No email'}</span>
                          </div>
                          <div className="flex items-center gap-3 p-3 bg-white/50 rounded-xl border border-slate-200/50">
                            <div className="p-2 bg-gradient-to-r from-red-100 to-pink-100 rounded-lg">
                              <Heart className="w-4 h-4 text-red-600" />
                            </div>
                            <span className="text-slate-700 font-medium">{patient.bloodType || 'Not specified'}</span>
                          </div>
                        </div>

                        {/* Recent Appointments */}
                        {patientAppointments[patient.id] && patientAppointments[patient.id].length > 0 && (
                          <div className="mt-6 pt-6 border-t border-slate-200/50">
                            <div className="flex items-center gap-2 mb-4">
                              <Calendar className="w-5 h-5 text-slate-500" />
                              <h5 className="text-sm font-bold text-slate-700">Recent Appointments</h5>
                            </div>
                            <div className="space-y-3">
                              {patientAppointments[patient.id].map((appointment) => (
                                <div key={appointment.id} className="flex items-center justify-between p-4 bg-white/50 rounded-xl border border-slate-200/50 hover:shadow-md transition-all duration-200">
                                  <div className="flex items-center gap-4">
                                    <div className="p-2 bg-gradient-to-r from-slate-100 to-slate-200 rounded-lg">
                                      <Calendar className="w-4 h-4 text-slate-600" />
                                    </div>
                                    <div>
                                      <span className="text-sm font-semibold text-slate-700">{appointment.appointmentType}</span>
                                      <span className="text-sm text-slate-500 ml-3">
                                        {formatDateToDDMMYYYY(appointment.appointmentDate)}
                                      </span>
                                    </div>
                                  </div>
                                  <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                                    appointment.status === 'scheduled' ? 'bg-gradient-to-r from-blue-100 to-cyan-100 text-blue-800 border border-blue-200' :
                                    appointment.status === 'completed' ? 'bg-gradient-to-r from-green-100 to-emerald-100 text-green-800 border border-green-200' :
                                    appointment.status === 'cancelled' ? 'bg-gradient-to-r from-red-100 to-rose-100 text-red-800 border border-red-200' :
                                    'bg-gradient-to-r from-yellow-100 to-amber-100 text-yellow-800 border border-yellow-200'
                                  }`}>
                                    {appointment.status}
                                  </span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                      
                      <div className="flex items-center gap-3">
                        <button
                          onClick={() => navigate(`/ehr/${tenantSlug}/doctor/patients/${patient.id}`)}
                          className="px-6 py-3 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-xl hover:from-indigo-700 hover:to-purple-700 transition-all duration-200 font-semibold shadow-lg hover:shadow-xl group-hover:scale-105 flex items-center gap-2"
                        >
                          <Eye className="w-4 h-4" />
                          View Details
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between mt-8 p-6 bg-gradient-to-r from-slate-50 to-blue-50 rounded-2xl border border-slate-200/50">
                <div className="text-sm font-semibold text-slate-700">
                  Page {currentPage} of {totalPages}
                </div>
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => paginate(currentPage - 1)}
                    disabled={currentPage === 1}
                    className="p-3 border border-slate-300 rounded-xl hover:bg-white hover:shadow-md disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  
                  {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                    <button
                      key={page}
                      onClick={() => paginate(page)}
                      className={`px-4 py-3 text-sm font-semibold rounded-xl transition-all duration-200 ${
                        currentPage === page
                          ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-lg'
                          : 'border border-slate-300 hover:bg-white hover:shadow-md text-slate-700'
                      }`}
                    >
                      {page}
                    </button>
                  ))}
                  
                  <button
                    onClick={() => paginate(currentPage + 1)}
                    disabled={currentPage === totalPages}
                    className="p-3 border border-slate-300 rounded-xl hover:bg-white hover:shadow-md disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default DoctorPatientsList;
