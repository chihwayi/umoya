import React, { useState } from 'react';
import {
  Users, Clock, AlertTriangle, CheckCircle, Activity, Eye, 
  Heart, Thermometer, Droplets, Plus, Search, Filter,
  ArrowUp, ArrowDown, User, Calendar, Stethoscope, ClipboardList
} from 'lucide-react';
import { formatDateTimeToDDMMYYYYHHMM } from '../utils/dateFormatting';

interface Patient {
  id: string;
  patientNumber: string;
  firstName: string;
  lastName: string;
  dateOfBirth: string;
  gender: string;
  phone: string;
  email: string;
  bloodType: string;
  allergies: string;
  chronicConditions: string;
}

interface Appointment {
  id: string;
  appointmentDate: string;
  durationMinutes: number;
  appointmentType: string;
  status: string;
  reason: string;
  notes: string;
  priorityLevel: string;
  patient: Patient;
  doctor: {
    id: string;
    firstName: string;
    lastName: string;
  };
  vitals?: {
    bloodPressure: string;
    heartRate: number;
    temperature: number;
    oxygenSaturation: number;
    respiratoryRate: number;
    weight: number;
    height: number;
    bmi: number;
    recordedAt: string;
    recordedBy: string;
  };
}

interface TriageQueueProps {
  appointments: Appointment[];
  onRecordVitals: (patient: Patient) => void;
  onTriageAssessment: (patient: Patient) => void;
}

const TriageQueue: React.FC<TriageQueueProps> = ({ 
  appointments, 
  onRecordVitals, 
  onTriageAssessment 
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterPriority, setFilterPriority] = useState('all');
  const [sortBy, setSortBy] = useState('priority');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');

  const getPriorityOrder = (priority: string) => {
    switch (priority) {
      case 'urgent': return 1;
      case 'high': return 2;
      case 'normal': return 3;
      case 'low': return 4;
      default: return 5;
    }
  };

  const getStatusOrder = (status: string) => {
    switch (status) {
      case 'in-progress': return 1;
      case 'confirmed': return 2;
      case 'scheduled': return 3;
      case 'completed': return 4;
      case 'cancelled': return 5;
      case 'no-show': return 6;
      default: return 7;
    }
  };

  const filteredAppointments = appointments
    .filter(appointment => {
      const matchesSearch = 
        appointment.patient.firstName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        appointment.patient.lastName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        appointment.patient.patientNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
        appointment.appointmentType.toLowerCase().includes(searchTerm.toLowerCase());
      
      const matchesStatus = filterStatus === 'all' || appointment.status === filterStatus;
      const matchesPriority = filterPriority === 'all' || appointment.priorityLevel === filterPriority;
      
      return matchesSearch && matchesStatus && matchesPriority;
    })
    .sort((a, b) => {
      let comparison = 0;
      
      switch (sortBy) {
        case 'priority':
          comparison = getPriorityOrder(a.priorityLevel) - getPriorityOrder(b.priorityLevel);
          break;
        case 'time':
          comparison = new Date(a.appointmentDate).getTime() - new Date(b.appointmentDate).getTime();
          break;
        case 'name':
          comparison = `${a.patient.firstName} ${a.patient.lastName}`.localeCompare(`${b.patient.firstName} ${b.patient.lastName}`);
          break;
        case 'status':
          comparison = getStatusOrder(a.status) - getStatusOrder(b.status);
          break;
        default:
          comparison = 0;
      }
      
      return sortOrder === 'asc' ? comparison : -comparison;
    });

  const getQueueStats = () => {
    const waiting = appointments.filter(apt => apt.status === 'scheduled' || apt.status === 'confirmed').length;
    const inProgress = appointments.filter(apt => apt.status === 'in-progress').length;
    const urgent = appointments.filter(apt => apt.priorityLevel === 'urgent' || apt.priorityLevel === 'high').length;
    const vitalsRecorded = appointments.filter(apt => apt.vitals).length;

    return { waiting, inProgress, urgent, vitalsRecorded };
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'urgent': return 'bg-red-100 text-red-800 border-red-200';
      case 'high': return 'bg-orange-100 text-orange-800 border-orange-200';
      case 'normal': return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'low': return 'bg-gray-100 text-gray-800 border-gray-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'scheduled': return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'confirmed': return 'bg-green-100 text-green-800 border-green-200';
      case 'in-progress': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'completed': return 'bg-emerald-100 text-emerald-800 border-emerald-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const handleStatusChange = async (appointmentId: string, newStatus: string) => {
    try {
      const token = localStorage.getItem('ehr_token');
      const tenantSlug = localStorage.getItem('ehr_tenant_slug');
      
      if (!token || !tenantSlug) {
        console.error('Authentication required');
        return;
      }

      // Import the API function
      const { ehrApi } = await import('../services/api');
      
      await ehrApi.updateAppointmentStatus(appointmentId, newStatus, token, tenantSlug);
      
      // Refresh the page to show updated status
      window.location.reload();
    } catch (error) {
      console.error('Error updating appointment status:', error);
    }
  };

  const stats = getQueueStats();

  return (
    <div className="space-y-8">
      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-gradient-to-br from-white to-blue-50 rounded-2xl shadow-lg border border-blue-200/50 p-6 hover:shadow-xl transition-all duration-300">
          <div className="flex items-center justify-between mb-3">
            <div className="p-2 bg-gradient-to-r from-blue-500 to-cyan-600 rounded-xl">
              <Clock className="w-5 h-5 text-white" />
            </div>
            <div className="text-3xl font-bold text-blue-600">{stats.waiting}</div>
          </div>
          <div className="text-sm font-semibold text-slate-600">Waiting</div>
        </div>
        
        <div className="bg-gradient-to-br from-white to-yellow-50 rounded-2xl shadow-lg border border-yellow-200/50 p-6 hover:shadow-xl transition-all duration-300">
          <div className="flex items-center justify-between mb-3">
            <div className="p-2 bg-gradient-to-r from-yellow-500 to-amber-600 rounded-xl">
              <Activity className="w-5 h-5 text-white" />
            </div>
            <div className="text-3xl font-bold text-yellow-600">{stats.inProgress}</div>
          </div>
          <div className="text-sm font-semibold text-slate-600">In Progress</div>
        </div>
        
        <div className="bg-gradient-to-br from-white to-red-50 rounded-2xl shadow-lg border border-red-200/50 p-6 hover:shadow-xl transition-all duration-300">
          <div className="flex items-center justify-between mb-3">
            <div className="p-2 bg-gradient-to-r from-red-500 to-rose-600 rounded-xl">
              <AlertTriangle className="w-5 h-5 text-white" />
            </div>
            <div className="text-3xl font-bold text-red-600">{stats.urgent}</div>
          </div>
          <div className="text-sm font-semibold text-slate-600">Urgent</div>
        </div>
        
        <div className="bg-gradient-to-br from-white to-green-50 rounded-2xl shadow-lg border border-green-200/50 p-6 hover:shadow-xl transition-all duration-300">
          <div className="flex items-center justify-between mb-3">
            <div className="p-2 bg-gradient-to-r from-green-500 to-emerald-600 rounded-xl">
              <CheckCircle className="w-5 h-5 text-white" />
            </div>
            <div className="text-3xl font-bold text-green-600">{stats.vitalsRecorded}</div>
          </div>
          <div className="text-sm font-semibold text-slate-600">Vitals Recorded</div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-gradient-to-br from-white to-slate-50 rounded-2xl shadow-lg border border-slate-200/50 p-8">
        <div className="flex items-center gap-3 mb-6">
          <div className="p-2 bg-gradient-to-r from-indigo-500 to-purple-600 rounded-xl">
            <Filter className="w-5 h-5 text-white" />
          </div>
          <h3 className="text-lg font-bold text-slate-900">Filter & Sort Patients</h3>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-5 gap-6">
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-3">Search</label>
            <div className="relative">
              <Search className="w-5 h-5 absolute left-4 top-1/2 transform -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Search patients..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-12 pr-4 py-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-pink-500 focus:border-transparent transition-all duration-200 bg-white/50"
              />
            </div>
          </div>
          
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-3">Status</label>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="w-full border border-slate-300 rounded-xl px-4 py-3 focus:ring-2 focus:ring-pink-500 focus:border-transparent transition-all duration-200 bg-white/50"
            >
              <option value="all">All Status</option>
              <option value="scheduled">Scheduled</option>
              <option value="confirmed">Confirmed</option>
              <option value="in-progress">In Progress</option>
            </select>
          </div>
          
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-3">Priority</label>
            <select
              value={filterPriority}
              onChange={(e) => setFilterPriority(e.target.value)}
              className="w-full border border-slate-300 rounded-xl px-4 py-3 focus:ring-2 focus:ring-pink-500 focus:border-transparent transition-all duration-200 bg-white/50"
            >
              <option value="all">All Priority</option>
              <option value="urgent">Urgent</option>
              <option value="high">High</option>
              <option value="normal">Normal</option>
              <option value="low">Low</option>
            </select>
          </div>
          
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-3">Sort By</label>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="w-full border border-slate-300 rounded-xl px-4 py-3 focus:ring-2 focus:ring-pink-500 focus:border-transparent transition-all duration-200 bg-white/50"
            >
              <option value="priority">Priority</option>
              <option value="time">Time</option>
              <option value="name">Name</option>
              <option value="status">Status</option>
            </select>
          </div>
          
          <div className="flex items-end">
            <button
              onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
              className="w-full px-4 py-3 bg-gradient-to-r from-slate-500 to-slate-600 text-white rounded-xl hover:from-slate-600 hover:to-slate-700 transition-all duration-200 font-semibold flex items-center justify-center gap-2"
            >
              {sortOrder === 'asc' ? <ArrowUp className="w-4 h-4" /> : <ArrowDown className="w-4 h-4" />}
              {sortOrder === 'asc' ? 'Ascending' : 'Descending'}
            </button>
          </div>
        </div>
      </div>

      {/* Patient Queue */}
      <div className="bg-gradient-to-br from-white to-slate-50 rounded-2xl shadow-lg border border-slate-200/50 overflow-hidden">
        <div className="bg-gradient-to-r from-slate-50 to-pink-50 p-8 border-b border-slate-200/50">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-gradient-to-r from-pink-500 to-rose-600 rounded-xl">
              <Users className="w-6 h-6 text-white" />
            </div>
            <h3 className="text-xl font-bold text-slate-900">
              Patient Queue ({filteredAppointments.length})
            </h3>
          </div>
        </div>
        
        <div className="divide-y divide-slate-200/50">
          {filteredAppointments.map((appointment) => (
            <div key={appointment.id} className="p-8 hover:bg-gradient-to-r hover:from-slate-50 hover:to-pink-50/30 transition-all duration-300 group">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-6">
                  <div className="w-16 h-16 bg-gradient-to-br from-pink-500 via-rose-600 to-purple-600 rounded-2xl flex items-center justify-center text-white font-bold text-xl shadow-lg group-hover:shadow-xl transition-all duration-300">
                    {appointment.patient.firstName.charAt(0)}{appointment.patient.lastName.charAt(0)}
                  </div>
                  <div className="flex-1">
                    <h4 className="text-xl font-bold text-slate-900 group-hover:text-pink-900 transition-colors mb-2">
                      {appointment.patient.firstName} {appointment.patient.lastName}
                    </h4>
                    <p className="text-slate-600 font-medium mb-3">
                      ID: {appointment.patient.patientNumber} • {appointment.appointmentType}
                    </p>
                    <div className="flex items-center gap-4 mb-3">
                      <span className={`px-3 py-1 rounded-full text-xs font-semibold border ${getPriorityColor(appointment.priorityLevel)}`}>
                        {appointment.priorityLevel}
                      </span>
                      <span className={`px-3 py-1 rounded-full text-xs font-semibold border ${getStatusColor(appointment.status)}`}>
                        {appointment.status}
                      </span>
                      <span className="text-sm text-slate-500">
                        {formatDateTimeToDDMMYYYYHHMM(appointment.appointmentDate)}
                      </span>
                    </div>
                    
                    {/* Vitals Status */}
                    <div className="flex items-center gap-4">
                      {appointment.vitals ? (
                        <div className="flex items-center gap-2 text-green-600">
                          <CheckCircle className="w-4 h-4" />
                          <span className="text-sm font-semibold">Vitals Recorded</span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2 text-orange-600">
                          <AlertTriangle className="w-4 h-4" />
                          <span className="text-sm font-semibold">Vitals Pending</span>
                        </div>
                      )}
                      
                      {appointment.vitals && (
                        <div className="flex items-center gap-4 text-sm text-slate-600">
                          <div className="flex items-center gap-1">
                            <Heart className="w-3 h-3" />
                            <span>{appointment.vitals.heartRate} bpm</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <Thermometer className="w-3 h-3" />
                            <span>{appointment.vitals.temperature}°C</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <Droplets className="w-3 h-3" />
                            <span>{appointment.vitals.oxygenSaturation}%</span>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
                
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => onRecordVitals(appointment.patient)}
                    className="px-4 py-2 bg-gradient-to-r from-red-500 to-pink-600 text-white rounded-xl hover:from-red-600 hover:to-pink-700 transition-all duration-200 font-semibold text-sm flex items-center gap-2"
                  >
                    <Activity className="w-4 h-4" />
                    Record Vitals
                  </button>
                  <button
                    onClick={() => onTriageAssessment(appointment.patient)}
                    className="px-4 py-2 bg-gradient-to-r from-orange-500 to-yellow-600 text-white rounded-xl hover:from-orange-600 hover:to-yellow-700 transition-all duration-200 font-semibold text-sm flex items-center gap-2"
                  >
                    <ClipboardList className="w-4 h-4" />
                    Triage
                  </button>
                  
                  {/* Status Change Buttons */}
                  {appointment.status === 'scheduled' && (
                    <button
                      onClick={() => handleStatusChange(appointment.id, 'confirmed')}
                      className="px-3 py-2 bg-gradient-to-r from-green-500 to-emerald-600 text-white rounded-lg hover:from-green-600 hover:to-emerald-700 transition-all duration-200 font-semibold text-sm flex items-center gap-1"
                    >
                      <CheckCircle className="w-4 h-4" />
                      Confirm
                    </button>
                  )}
                  
                  {appointment.status === 'confirmed' && (
                    <button
                      onClick={() => handleStatusChange(appointment.id, 'in-progress')}
                      className="px-3 py-2 bg-gradient-to-r from-blue-500 to-cyan-600 text-white rounded-lg hover:from-blue-600 hover:to-cyan-700 transition-all duration-200 font-semibold text-sm flex items-center gap-1"
                    >
                      <Activity className="w-4 h-4" />
                      Start
                    </button>
                  )}
                  
                  {(appointment.status === 'in-progress' || appointment.status === 'in_progress') && (
                    <button
                      onClick={() => handleStatusChange(appointment.id, 'completed')}
                      className="px-3 py-2 bg-gradient-to-r from-purple-500 to-indigo-600 text-white rounded-lg hover:from-purple-600 hover:to-indigo-700 transition-all duration-200 font-semibold text-sm flex items-center gap-1"
                    >
                      <CheckCircle className="w-4 h-4" />
                      Complete
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default TriageQueue;
