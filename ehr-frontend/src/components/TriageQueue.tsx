import React, { useState } from 'react';
import {
  Users, Clock, AlertTriangle, CheckCircle, Activity, Eye, 
  Heart, Thermometer, Droplets, Plus, Search, Filter,
  ArrowUp, ArrowDown, User, Calendar, Stethoscope, ClipboardList,
  CreditCard, Lock, Target, TestTube, Brain
} from 'lucide-react';
import { formatDateTimeToDDMMYYYYHHMM } from '../utils/dateFormatting';
import { useNotification } from './GlobalNotification';

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
  paymentStatus?: string;
  financeTransactionId?: string | null;
  feeAmount?: number | null;
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
  onRecordVitals: (appointment: Appointment) => void;
  onTriageAssessment: (appointment: Appointment) => void;
  onTriageCopilotAnalyze?: (appointment: Appointment) => Promise<void> | void;
  triageCopilotLoading?: boolean;
  triageCopilotPatientId?: string | null;
  onViewCarePlans?: (patientId: string, patientName: string) => void;
  onViewLabResults?: (patientId: string, patientName: string) => void;
  onViewVitalsHistory?: (patientId: string, patientName: string) => void;
  canManagePayments?: boolean;
  onOpenPayment?: (appointment: Appointment) => void;
}

const TriageQueue: React.FC<TriageQueueProps> = ({
  appointments,
  onRecordVitals,
  onTriageAssessment,
  onTriageCopilotAnalyze,
  triageCopilotLoading = false,
  triageCopilotPatientId = null,
  onViewCarePlans,
  onViewLabResults,
  onViewVitalsHistory,
  canManagePayments,
  onOpenPayment,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterPriority, setFilterPriority] = useState('all');
  const [sortBy, setSortBy] = useState('priority');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const { showError, showSuccess } = useNotification();

  const formatCurrency = (value?: number | string | null) => {
    if (value === null || value === undefined) return null;
    const numeric = Number(value);
    if (Number.isNaN(numeric)) return null;
    return `$${numeric.toFixed(2)}`;
  };

  const buildFinanceDetails = (appointment: Appointment) => {
    const details: string[] = [];
    const formattedFee = formatCurrency(appointment.feeAmount ?? null);
    if (formattedFee) {
      details.push(`Fee amount: ${formattedFee}`);
    }
    if (appointment.financeTransactionId) {
      details.push(`Finance reference: ${appointment.financeTransactionId}`);
    }
    return details.join(' • ');
  };

  const notifyPaymentBlocked = (appointment: Appointment, context: string) => {
    const financeDetails = buildFinanceDetails(appointment);
    const suffix = financeDetails ? ` ${financeDetails}` : '';
    showError(`Action Blocked (Payment Pending)`, `${context}. ${suffix}`);
  };

  const getCriticalVitals = (vitals: Appointment['vitals']) => {
    if (!vitals) return [];
    const critical = [];
    
    // BP check
    if (vitals.bloodPressure) {
      const [sys, dia] = vitals.bloodPressure.split('/').map(Number);
      if (sys >= 140 || sys <= 90) critical.push({ label: `BP ${vitals.bloodPressure}`, severity: 'high' });
      else if (dia >= 90 || dia <= 60) critical.push({ label: `BP ${vitals.bloodPressure}`, severity: 'high' });
    }

    // SpO2 check
    if (vitals.oxygenSaturation && vitals.oxygenSaturation < 95) {
      critical.push({ label: `SpO2 ${vitals.oxygenSaturation}%`, severity: 'high' });
    }

    // HR check
    if (vitals.heartRate && (vitals.heartRate > 100 || vitals.heartRate < 60)) {
      critical.push({ label: `HR ${vitals.heartRate}`, severity: 'medium' });
    }

    // Temp check
    if (vitals.temperature && (vitals.temperature > 38 || vitals.temperature < 36)) {
      critical.push({ label: `Temp ${vitals.temperature}°C`, severity: 'medium' });
    }

    return critical;
  };

  const ensurePaymentCleared = (appointment: Appointment, context: string) => {
    if (appointment.paymentStatus === 'awaiting_payment') {
      notifyPaymentBlocked(appointment, context);
      return false;
    }
    return true;
  };

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
      // Safety checks for patient data
      const patient = appointment.patient || {};
      const firstName = patient.firstName || '';
      const lastName = patient.lastName || '';
      const patientNumber = patient.patientNumber || '';
      const appointmentType = appointment.appointmentType || '';
      
      const searchLower = searchTerm.toLowerCase();

      const matchesSearch = 
        firstName.toLowerCase().includes(searchLower) ||
        lastName.toLowerCase().includes(searchLower) ||
        patientNumber.toLowerCase().includes(searchLower) ||
        appointmentType.toLowerCase().includes(searchLower);
      
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
                const nameA = a.patient ? `${a.patient.firstName || ''} ${a.patient.lastName || ''}` : '';
                const nameB = b.patient ? `${b.patient.firstName || ''} ${b.patient.lastName || ''}` : '';
                comparison = nameA.localeCompare(nameB);
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
    const vitalsRecorded = appointments.filter(apt => !!apt.vitals).length;
    const awaitingPayment = appointments.filter(apt => apt.paymentStatus === 'awaiting_payment').length;

    return { waiting, inProgress, urgent, vitalsRecorded, awaitingPayment };
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

  const getQueueRiskLevel = (appointment: Appointment): 'low' | 'medium' | 'high' => {
    let level = 0;

    if (appointment.priorityLevel === 'urgent' || appointment.priorityLevel === 'high') {
      level = Math.max(level, 2);
    }

    const vitals = appointment.vitals || null;
    const criticalVitals = vitals ? getCriticalVitals(vitals) : [];
    if (criticalVitals.some((alert) => alert.severity === 'high')) {
      level = Math.max(level, 2);
    } else if (criticalVitals.length > 0) {
      level = Math.max(level, 1);
    }

    const hasAllergies = !!appointment.patient?.allergies && appointment.patient.allergies.trim().length > 0;
    const hasConditions = !!appointment.patient?.chronicConditions && appointment.patient.chronicConditions.trim().length > 0;
    if (hasAllergies || hasConditions || isElderly(appointment.patient?.dateOfBirth)) {
      level = Math.max(level, 1);
    }

    if (level >= 2) return 'high';
    if (level === 1) return 'medium';
    return 'low';
  };

  const getQueueRiskColor = (risk: 'low' | 'medium' | 'high') => {
    switch (risk) {
      case 'high':
        return 'bg-red-100 text-red-800 border-red-200';
      case 'medium':
        return 'bg-amber-100 text-amber-800 border-amber-200';
      case 'low':
      default:
        return 'bg-emerald-50 text-emerald-800 border-emerald-200';
    }
  };

  const handleStatusChange = async (appointment: Appointment, newStatus: string) => {
    if (!ensurePaymentCleared(appointment, 'Cannot update appointment status while payment is pending')) {
      return;
    }

    try {
      const token = localStorage.getItem('ehr_token');
      const tenantSlug = localStorage.getItem('ehr_tenant_slug');
      
      if (!token || !tenantSlug) {
        showError('Authentication required', 'Please login to update appointment status.');
        return;
      }

      const { ehrApi } = await import('../services/api');
      await ehrApi.updateAppointmentStatus(appointment.id, newStatus, token, tenantSlug);
      showSuccess('Status updated', `Appointment marked as ${newStatus}`);
      window.location.reload();
    } catch (error) {
      console.error('Error updating appointment status:', error);
      showError('Error', 'Failed to update appointment status');
    }
  };

  const isElderly = (dob: string | undefined) => {
    if (!dob) return false;
    const birthDate = new Date(dob);
    const ageDifMs = Date.now() - birthDate.getTime();
    const ageDate = new Date(ageDifMs);
    return Math.abs(ageDate.getUTCFullYear() - 1970) > 65;
  };

  const isWaived = (appointment: Appointment) => {
    // Auto-waive payment for elderly patients (>65)
    return isElderly(appointment.patient.dateOfBirth);
  };

  const handleRecordVitalsClick = (appointment: Appointment) => {
    if (!isWaived(appointment) && !ensurePaymentCleared(appointment, 'Vitals cannot be recorded while payment is pending')) {
      return;
    }
    onRecordVitals(appointment);
  };

  const handleTriageClick = (appointment: Appointment) => {
    if (!isWaived(appointment) && !ensurePaymentCleared(appointment, 'Triage assessment is locked until payment is confirmed')) {
      return;
    }
    onTriageAssessment(appointment);
  };

  const handleTriageCopilotClick = async (appointment: Appointment) => {
    if (!isWaived(appointment) && !ensurePaymentCleared(appointment, 'AI triage support is locked until payment is confirmed')) {
      return;
    }
    if (onTriageCopilotAnalyze) {
      await onTriageCopilotAnalyze(appointment);
      return;
    }
    onTriageAssessment(appointment);
  };

  const stats = getQueueStats();

  return (
    <div className="space-y-8">
      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-6">
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

        <div className="bg-gradient-to-br from-white to-amber-50 rounded-2xl shadow-lg border border-amber-200/50 p-6 hover:shadow-xl transition-all duration-300">
          <div className="flex items-center justify-between mb-3">
            <div className="p-2 bg-gradient-to-r from-amber-500 to-orange-600 rounded-xl">
              <CreditCard className="w-5 h-5 text-white" />
            </div>
            <div className={`text-3xl font-bold ${stats.awaitingPayment > 0 ? 'text-amber-600' : 'text-slate-400'}`}>{stats.awaitingPayment}</div>
          </div>
          <div className="text-sm font-semibold text-slate-600">Awaiting Payment</div>
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
          {filteredAppointments.map((appointment) => {
            const awaitingPayment = appointment.paymentStatus === 'awaiting_payment';
            const feeEstimate = formatCurrency(appointment.feeAmount ?? null);
            const financeReference = appointment.financeTransactionId;
            const latestVitals = appointment.vitals || null;
            const hasVisitVitals =
              !!latestVitals &&
              !!latestVitals.recordedAt &&
              new Date(latestVitals.recordedAt).toDateString() ===
                new Date(appointment.appointmentDate).toDateString();
            const queueRiskLevel = getQueueRiskLevel(appointment);

            return (
              <div key={appointment.id} className={`p-8 transition-all duration-300 group ${awaitingPayment ? 'bg-amber-50/60' : 'hover:bg-gradient-to-r hover:from-slate-50 hover:to-pink-50/30'}`}>
                <div className="flex items-center justify-between gap-6">
                  <div className="flex items-center gap-6 flex-1">
                    <div className={`w-16 h-16 rounded-2xl flex items-center justify-center text-white font-bold text-xl shadow-lg group-hover:shadow-xl transition-all duration-300 ${awaitingPayment ? 'bg-gradient-to-br from-amber-500 via-orange-600 to-amber-700' : 'bg-gradient-to-br from-pink-500 via-rose-600 to-purple-600'}`}>
                      {appointment.patient.firstName.charAt(0)}{appointment.patient.lastName.charAt(0)}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2 flex-wrap">
                        <h4 className={`text-xl font-bold ${awaitingPayment ? 'text-amber-800' : 'text-slate-900 group-hover:text-pink-900 transition-colors'}`}>
                          {appointment.patient?.firstName || 'Unknown'} {appointment.patient?.lastName || 'Patient'}
                        </h4>
                        {awaitingPayment && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-700 border border-amber-200">
                            <CreditCard className="w-3 h-3" /> Awaiting Payment
                          </span>
                        )}
                      </div>
                      <p className="text-slate-600 font-medium mb-3">
                        ID: {appointment.patient?.patientNumber || 'N/A'} • {appointment.appointmentType}
                      </p>
                      <div className="flex items-center gap-4 mb-3 flex-wrap">
                        <span className={`px-3 py-1 rounded-full text-xs font-semibold border ${getPriorityColor(appointment.priorityLevel)}`}>
                          {appointment.priorityLevel}
                        </span>
                        <span className={`px-3 py-1 rounded-full text-xs font-semibold border ${getStatusColor(appointment.status)}`}>
                          {appointment.status}
                        </span>
                        <span className={`px-3 py-1 rounded-full text-xs font-semibold border ${getQueueRiskColor(queueRiskLevel)}`}>
                          Queue risk: {queueRiskLevel === 'high' ? 'High' : queueRiskLevel === 'medium' ? 'Medium' : 'Low'}
                        </span>
                        <span className="text-sm text-slate-500">
                          {formatDateTimeToDDMMYYYYHHMM(appointment.appointmentDate)}
                        </span>
                        {feeEstimate && (
                          <span className="px-3 py-1 rounded-full text-xs font-semibold border border-slate-200 text-slate-600 bg-slate-50">
                            Fee: {feeEstimate}
                          </span>
                        )}
                      </div>

                      {/* Vitals Status */}
                      <div className="flex flex-wrap items-center gap-4">
                        {hasVisitVitals ? (
                          <div className="flex items-center gap-2 text-green-600">
                            <CheckCircle className="w-4 h-4" />
                            <span className="text-sm font-semibold">Vitals Recorded</span>
                          </div>
                        ) : (
                          <div className={`flex items-center gap-2 ${awaitingPayment ? 'text-amber-600' : 'text-orange-600'}`}>
                            <AlertTriangle className="w-4 h-4" />
                            <span className="text-sm font-semibold">Vitals Pending</span>
                          </div>
                        )}
                        
                        {hasVisitVitals && latestVitals && (
                          <div className="flex items-center gap-4 text-sm text-slate-600">
                            <div className="flex items-center gap-1">
                              <Heart className="w-3 h-3" />
                              <span>{latestVitals.heartRate} bpm</span>
                            </div>
                            <div className="flex items-center gap-1">
                              <Thermometer className="w-3 h-3" />
                              <span>{latestVitals.temperature}°C</span>
                            </div>
                            <div className="flex items-center gap-1">
                              <Droplets className="w-3 h-3" />
                              <span>{latestVitals.oxygenSaturation}%</span>
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Critical Vitals Tags */}
                      {hasVisitVitals && latestVitals && getCriticalVitals(latestVitals).length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-2">
                          {getCriticalVitals(latestVitals).map((alert, idx) => (
                            <span key={idx} className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-bold border ${alert.severity === 'high' ? 'bg-red-100 text-red-700 border-red-200' : 'bg-amber-100 text-amber-800 border-amber-200'}`}>
                              <Activity className="w-3 h-3" />
                              {alert.label}
                            </span>
                          ))}
                        </div>
                      )}

                      {/* Clinical Context */}
                      {(appointment.patient?.allergies || appointment.patient?.chronicConditions || isElderly(appointment.patient?.dateOfBirth)) && (
                        <div className="mt-3 flex flex-wrap items-center gap-2">
                          {isElderly(appointment.patient?.dateOfBirth) && (
                            <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-semibold bg-orange-50 text-orange-700 border border-orange-200">
                              <AlertTriangle className="w-3 h-3" />
                              Fall Risk (Age &gt; 65)
                            </span>
                          )}
                          {appointment.patient?.allergies && appointment.patient.allergies.trim().length > 0 && (
                            <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-semibold bg-rose-50 text-rose-700 border border-rose-200">
                              <AlertTriangle className="w-3 h-3" />
                              Allergies: {appointment.patient.allergies}
                            </span>
                          )}
                          {appointment.patient?.chronicConditions && appointment.patient.chronicConditions.trim().length > 0 && (
                            <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200">
                              <Stethoscope className="w-3 h-3" />
                              Conditions: {appointment.patient.chronicConditions}
                            </span>
                          )}
                        </div>
                      )}

                      {awaitingPayment && !isWaived(appointment) && (
                        <div className="mt-3 text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 flex flex-col gap-1">
                          <span className="flex items-center gap-2 font-medium">
                            <Lock className="w-4 h-4" /> Payment required before nursing actions
                          </span>
                          <span>
                            {canManagePayments
                              ? 'Record payment in Billing to unlock vitals, triage, and status updates.'
                              : 'Coordinate with Accounts to unlock vitals, triage, and status updates.'}
                          </span>
                          {financeReference && (
                            <span className="text-xs text-amber-600">
                              Finance reference: <span className="font-mono">{financeReference}</span>
                            </span>
                          )}
                          {canManagePayments && onOpenPayment && (
                            <button
                              type="button"
                              onClick={() => onOpenPayment(appointment)}
                              className="mt-2 inline-flex items-center justify-center px-3 py-1.5 rounded-lg text-xs font-semibold bg-amber-600 text-white hover:bg-amber-700 transition-colors"
                            >
                              <CreditCard className="w-3 h-3 mr-1" />
                              Record Payment
                            </button>
                          )}
                        </div>
                      )}
                      {awaitingPayment && isWaived(appointment) && (
                        <div className="mt-3 text-sm text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2 flex items-center gap-2">
                          <CheckCircle className="w-4 h-4" />
                          <span className="font-medium">Payment Waived (Age &gt; 65)</span>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 flex-wrap justify-end">
                    {hasVisitVitals ? (
                      <span className="px-3 py-2 rounded-lg border border-green-200 bg-green-50 text-green-800 text-sm font-semibold">Vitals recorded</span>
                    ) : (
                      <button
                        onClick={() => handleRecordVitalsClick(appointment)}
                        disabled={awaitingPayment && !isWaived(appointment)}
                        className={`px-4 py-2 rounded-xl font-semibold text-sm flex items-center gap-2 transition-all duration-200 ${awaitingPayment && !isWaived(appointment)
                          ? 'bg-slate-200 text-slate-500 cursor-not-allowed'
                          : 'bg-gradient-to-r from-red-500 to-pink-600 text-white hover:from-red-600 hover:to-pink-700'
                        }`}
                      >
                        <Heart className="w-4 h-4" />
                        Record Vitals
                      </button>
                    )}
                    
                    <button
                      onClick={() => handleTriageClick(appointment)}
                      disabled={awaitingPayment && !isWaived(appointment)}
                      className={`px-4 py-2 rounded-xl font-semibold text-sm flex items-center gap-2 transition-all duration-200 ${awaitingPayment && !isWaived(appointment)
                        ? 'bg-slate-200 text-slate-500 cursor-not-allowed'
                        : 'bg-gradient-to-r from-orange-500 to-yellow-600 text-white hover:from-orange-600 hover:to-yellow-700'
                      }`}
                    >
                      <ClipboardList className="w-4 h-4" />
                      Triage Assessment
                    </button>
                    <button
                      onClick={() => handleTriageCopilotClick(appointment)}
                      disabled={(awaitingPayment && !isWaived(appointment)) || (triageCopilotLoading && triageCopilotPatientId === appointment.patient.id)}
                      className={`px-4 py-2 rounded-xl font-semibold text-sm flex items-center gap-2 transition-all duration-200 ${
                        (awaitingPayment && !isWaived(appointment)) || (triageCopilotLoading && triageCopilotPatientId === appointment.patient.id)
                          ? 'bg-slate-200 text-slate-500 cursor-not-allowed'
                          : 'bg-gradient-to-r from-amber-500 to-orange-600 text-white hover:from-amber-600 hover:to-orange-700'
                      }`}
                    >
                      <Brain className="w-4 h-4" />
                      {triageCopilotLoading && triageCopilotPatientId === appointment.patient.id
                        ? 'Analyzing...'
                        : 'AI Suggest + Open'}
                    </button>
                    {onViewVitalsHistory && (
                      <button
                        type="button"
                        onClick={() =>
                          onViewVitalsHistory(
                            appointment.patient.id,
                            `${appointment.patient.firstName} ${appointment.patient.lastName}`,
                          )
                        }
                        className="px-4 py-2 rounded-xl font-semibold text-sm flex items-center gap-2 transition-all duration-200 bg-gradient-to-r from-sky-500 to-indigo-600 text-white hover:from-sky-600 hover:to-indigo-700"
                      >
                        <Activity className="w-4 h-4" />
                        Vitals History
                      </button>
                    )}
                    {onViewCarePlans && (
                      <button
                        onClick={() => onViewCarePlans(appointment.patient.id, `${appointment.patient.firstName} ${appointment.patient.lastName}`)}
                        className="px-4 py-2 rounded-xl font-semibold text-sm flex items-center gap-2 transition-all duration-200 bg-gradient-to-r from-teal-500 to-cyan-600 text-white hover:from-teal-600 hover:to-cyan-700"
                      >
                        <Target className="w-4 h-4" />
                        Care Plans
                      </button>
                    )}
                    {onViewLabResults && (
                      <button
                        onClick={() => onViewLabResults(appointment.patient.id, `${appointment.patient.firstName} ${appointment.patient.lastName}`)}
                        className="px-4 py-2 rounded-xl font-semibold text-sm flex items-center gap-2 transition-all duration-200 bg-gradient-to-r from-purple-500 to-indigo-600 text-white hover:from-purple-600 hover:to-indigo-700"
                      >
                        <TestTube className="w-4 h-4" />
                        Lab Results
                      </button>
                    )}
                    {/* Status Change Buttons */}
                    {appointment.status === 'scheduled' && (
                      <button
                        onClick={() => handleStatusChange(appointment, 'confirmed')}
                        disabled={awaitingPayment}
                        className={`px-3 py-2 rounded-lg font-semibold text-sm flex items-center gap-1 transition-all duration-200 ${awaitingPayment
                          ? 'bg-slate-200 text-slate-500 cursor-not-allowed'
                          : 'bg-gradient-to-r from-green-500 to-emerald-600 text-white hover:from-green-600 hover:to-emerald-700'
                        }`}
                      >
                        <CheckCircle className="w-4 h-4" />
                        Confirm
                      </button>
                    )}
                    
                    {appointment.status === 'confirmed' && (
                      <button
                        onClick={() => handleStatusChange(appointment, 'in-progress')}
                        disabled={awaitingPayment}
                        className={`px-3 py-2 rounded-lg font-semibold text-sm flex items-center gap-1 transition-all duration-200 ${awaitingPayment
                          ? 'bg-slate-200 text-slate-500 cursor-not-allowed'
                          : 'bg-gradient-to-r from-blue-500 to-cyan-600 text-white hover:from-blue-600 hover:to-cyan-700'
                        }`}
                      >
                        <Activity className="w-4 h-4" />
                        Start
                      </button>
                    )}
                    
                    {(appointment.status === 'in-progress' || appointment.status === 'in_progress') && (
                      <button
                        onClick={() => handleStatusChange(appointment, 'completed')}
                        disabled={awaitingPayment}
                        className={`px-3 py-2 rounded-lg font-semibold text-sm flex items-center gap-1 transition-all duration-200 ${awaitingPayment
                          ? 'bg-slate-200 text-slate-500 cursor-not-allowed'
                          : 'bg-gradient-to-r from-purple-500 to-indigo-600 text-white hover:from-purple-600 hover:to-indigo-700'
                        }`}
                      >
                        <CheckCircle className="w-4 h-4" />
                        Complete
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

    </div>
  );
};

export default TriageQueue;
