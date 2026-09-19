import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import {
  Users, Clock, AlertTriangle, CheckCircle, Activity, Eye,
  Heart, Thermometer, Droplets, Plus, Search, Filter,
  ArrowUp, ArrowDown, User, Calendar, Stethoscope, ClipboardList,
  CreditCard, Lock, Target, TestTube, MoreVertical, ChevronDown
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
  const [expandedVitalsId, setExpandedVitalsId] = useState<string | null>(null);
  const [openMoreMenuId, setOpenMoreMenuId] = useState<string | null>(null);
  const [moreMenuPosition, setMoreMenuPosition] = useState<{ left: number; top?: number; bottom?: number; maxHeight: number } | null>(null);
  const { showError, showSuccess } = useNotification();

  // The dropdown is rendered into document.body (see MoreMenuPortal below) so no
  // ancestor's overflow/scroll clipping or stacking context can hide or clip it.
  const closeMoreMenu = () => {
    setOpenMoreMenuId(null);
    setMoreMenuPosition(null);
  };

  useEffect(() => {
    if (!openMoreMenuId) return;
    const handleScrollOrResize = () => closeMoreMenu();
    window.addEventListener('scroll', handleScrollOrResize, true);
    window.addEventListener('resize', handleScrollOrResize);
    return () => {
      window.removeEventListener('scroll', handleScrollOrResize, true);
      window.removeEventListener('resize', handleScrollOrResize);
    };
  }, [openMoreMenuId]);

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

  // Only summarizes vitals NOT already called out by getCriticalVitals below —
  // otherwise an abnormal reading (the common case for a triage patient)
  // rendered in both the compact string AND its own critical badge,
  // showing the same number twice side by side.
  const getCompactVitalsString = (vitals: Appointment['vitals']) => {
    if (!vitals) return '';
    const critical = new Set(getCriticalVitals(vitals).map((c) => c.label));
    const parts: string[] = [];
    if (vitals.heartRate && !critical.has(`HR ${vitals.heartRate}`)) parts.push(`HR ${vitals.heartRate}`);
    if (vitals.temperature && !critical.has(`Temp ${vitals.temperature}°C`)) parts.push(`Temp ${vitals.temperature}°C`);
    if (vitals.oxygenSaturation && !critical.has(`SpO2 ${vitals.oxygenSaturation}%`)) parts.push(`SpO2 ${vitals.oxygenSaturation}%`);
    return parts.join(' · ');
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
    } catch {
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
      <div className="bg-gradient-to-br from-white to-slate-50 rounded-2xl shadow-lg border border-slate-200/50">

        <div className="bg-gradient-to-r from-slate-50 to-pink-50 p-8 border-b border-slate-200/50 rounded-t-2xl">
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
            const vitalsExpanded = expandedVitalsId === appointment.id;
            const moreMenuOpen = openMoreMenuId === appointment.id;

            return (
              <div key={appointment.id} className={`transition-all duration-300 group ${awaitingPayment ? 'bg-amber-50/60' : 'hover:bg-gradient-to-r hover:from-slate-50 hover:to-pink-50/30'}`}>
                {/* Main card - compact header row */}
                <div className="p-4 space-y-2">
                  {/* Top row: Avatar, Name, Badges, Actions */}
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      {/* Avatar */}
                      <div className={`w-10 h-10 rounded-lg flex-shrink-0 flex items-center justify-center text-white font-bold text-sm shadow ${awaitingPayment ? 'bg-gradient-to-br from-amber-500 to-orange-600' : 'bg-gradient-to-br from-pink-500 to-purple-600'}`}>
                        {appointment.patient.firstName.charAt(0)}{appointment.patient.lastName.charAt(0)}
                      </div>

                      {/* Name & Key Info */}
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h4 className={`font-semibold truncate ${awaitingPayment ? 'text-amber-800' : 'text-slate-900'}`}>
                            {appointment.patient?.firstName || 'Unknown'} {appointment.patient?.lastName || 'Patient'}
                          </h4>
                          <span className="text-xs text-slate-500 flex-shrink-0">
                            ID: {appointment.patient?.patientNumber || 'N/A'}
                          </span>
                        </div>
                        <p className="text-xs text-slate-600 truncate">
                          {appointment.appointmentType} • {formatDateTimeToDDMMYYYYHHMM(appointment.appointmentDate)}
                        </p>
                      </div>

                      {/* Status badges - compact inline */}
                      <div className="flex items-center gap-1 flex-wrap flex-shrink-0">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-semibold border ${getPriorityColor(appointment.priorityLevel)}`}>
                          {appointment.priorityLevel}
                        </span>
                        <span className={`px-2 py-0.5 rounded-full text-xs font-semibold border ${getStatusColor(appointment.status)}`}>
                          {appointment.status}
                        </span>
                        <span className={`px-2 py-0.5 rounded-full text-xs font-semibold border ${getQueueRiskColor(queueRiskLevel)}`}>
                          {queueRiskLevel === 'high' ? 'High Risk' : queueRiskLevel === 'medium' ? 'Med Risk' : 'Low Risk'}
                        </span>
                      </div>
                    </div>

                    {/* Right side: Primary actions & more menu */}
                    <div className="flex items-center gap-1 flex-shrink-0 relative">
                      {/* Primary action button (Record Vitals or Triage) */}
                      {hasVisitVitals ? (
                        <span className="px-2 py-1 rounded-lg border border-green-200 bg-green-50 text-green-800 text-xs font-semibold flex-shrink-0">
                          Vitals ✓
                        </span>
                      ) : (
                        <button
                          onClick={() => handleRecordVitalsClick(appointment)}
                          disabled={awaitingPayment && !isWaived(appointment)}
                          className={`px-2 py-1 rounded-lg font-semibold text-xs flex items-center gap-1 flex-shrink-0 transition-all ${awaitingPayment && !isWaived(appointment)
                            ? 'bg-slate-200 text-slate-500 cursor-not-allowed'
                            : 'bg-red-500 text-white hover:bg-red-600'
                          }`}
                        >
                          <Heart className="w-3 h-3" />
                          Record
                        </button>
                      )}

                      {/* Triage button */}
                      <button
                        onClick={() => handleTriageClick(appointment)}
                        disabled={awaitingPayment && !isWaived(appointment)}
                        className={`px-2 py-1 rounded-lg font-semibold text-xs flex items-center gap-1 flex-shrink-0 transition-all ${awaitingPayment && !isWaived(appointment)
                          ? 'bg-slate-200 text-slate-500 cursor-not-allowed'
                          : 'bg-orange-500 text-white hover:bg-orange-600'
                        }`}
                      >
                        <ClipboardList className="w-3 h-3" />
                        Triage
                      </button>

                      {/* Status action button */}
                      {appointment.status === 'scheduled' && (
                        <button
                          onClick={() => handleStatusChange(appointment, 'confirmed')}
                          disabled={awaitingPayment}
                          className={`px-2 py-1 rounded-lg font-semibold text-xs flex items-center gap-1 flex-shrink-0 transition-all ${awaitingPayment
                            ? 'bg-slate-200 text-slate-500 cursor-not-allowed'
                            : 'bg-green-500 text-white hover:bg-green-600'
                          }`}
                        >
                          <CheckCircle className="w-3 h-3" />
                          Confirm
                        </button>
                      )}

                      {appointment.status === 'confirmed' && (
                        <button
                          onClick={() => handleStatusChange(appointment, 'in-progress')}
                          disabled={awaitingPayment}
                          className={`px-2 py-1 rounded-lg font-semibold text-xs flex items-center gap-1 flex-shrink-0 transition-all ${awaitingPayment
                            ? 'bg-slate-200 text-slate-500 cursor-not-allowed'
                            : 'bg-blue-500 text-white hover:bg-blue-600'
                          }`}
                        >
                          <Activity className="w-3 h-3" />
                          Start
                        </button>
                      )}

                      {(appointment.status === 'in-progress' || appointment.status === 'in_progress') && (
                        <button
                          onClick={() => handleStatusChange(appointment, 'completed')}
                          disabled={awaitingPayment}
                          className={`px-2 py-1 rounded-lg font-semibold text-xs flex items-center gap-1 flex-shrink-0 transition-all ${awaitingPayment
                            ? 'bg-slate-200 text-slate-500 cursor-not-allowed'
                            : 'bg-purple-500 text-white hover:bg-purple-600'
                          }`}
                        >
                          <CheckCircle className="w-3 h-3" />
                          Done
                        </button>
                      )}

                      {/* More menu button — the menu itself is portaled to <body> (see
                          below) so no ancestor's rounded-corner clipping, overflow, or
                          sticky/fixed header can hide or cut it off. */}
                      <button
                        onClick={(e) => {
                          if (moreMenuOpen) {
                            closeMoreMenu();
                            return;
                          }
                          const rect = e.currentTarget.getBoundingClientRect();
                          const left = Math.max(8, rect.right - 224);
                          const spaceBelow = window.innerHeight - rect.bottom - 12;
                          const spaceAbove = rect.top - 12;
                          // Flip the menu above the trigger when there isn't enough room
                          // below, so it's never pushed past the bottom of the viewport.
                          if (spaceBelow < 220 && spaceAbove > spaceBelow) {
                            setMoreMenuPosition({ bottom: window.innerHeight - rect.top + 6, left, maxHeight: spaceAbove });
                          } else {
                            setMoreMenuPosition({ top: rect.bottom + 6, left, maxHeight: spaceBelow });
                          }
                          setOpenMoreMenuId(appointment.id);
                        }}
                        className="p-1 rounded-lg hover:bg-slate-200 transition-colors flex-shrink-0"
                      >
                        <MoreVertical className="w-4 h-4 text-slate-600" />
                      </button>

                      {moreMenuOpen && moreMenuPosition && createPortal(
                        <>
                          <div className="fixed inset-0 z-40" onClick={closeMoreMenu} />
                          <div
                            className="fixed w-56 bg-white border border-slate-200/50 rounded-xl shadow-lg z-50 overflow-y-auto py-1.5"
                            style={{
                              top: moreMenuPosition.top,
                              bottom: moreMenuPosition.bottom,
                              left: moreMenuPosition.left,
                              maxHeight: Math.max(120, moreMenuPosition.maxHeight),
                            }}
                          >
                            {onViewVitalsHistory && (
                              <button
                                type="button"
                                onClick={() => {
                                  onViewVitalsHistory(
                                    appointment.patient.id,
                                    `${appointment.patient.firstName} ${appointment.patient.lastName}`,
                                  );
                                  closeMoreMenu();
                                }}
                                className="w-full flex items-center gap-3 text-left px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors group"
                              >
                                <span className="flex items-center justify-center w-8 h-8 rounded-lg bg-blue-100 text-blue-600 group-hover:bg-blue-200 transition-colors flex-shrink-0">
                                  <Activity className="w-4 h-4" />
                                </span>
                                Vitals History
                              </button>
                            )}
                            {onViewCarePlans && (
                              <button
                                onClick={() => {
                                  onViewCarePlans(appointment.patient.id, `${appointment.patient.firstName} ${appointment.patient.lastName}`);
                                  closeMoreMenu();
                                }}
                                className="w-full flex items-center gap-3 text-left px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors group"
                              >
                                <span className="flex items-center justify-center w-8 h-8 rounded-lg bg-teal-100 text-teal-600 group-hover:bg-teal-200 transition-colors flex-shrink-0">
                                  <Target className="w-4 h-4" />
                                </span>
                                Care Plans
                              </button>
                            )}
                            {onViewLabResults && (
                              <button
                                onClick={() => {
                                  onViewLabResults(appointment.patient.id, `${appointment.patient.firstName} ${appointment.patient.lastName}`);
                                  closeMoreMenu();
                                }}
                                className="w-full flex items-center gap-3 text-left px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors group"
                              >
                                <span className="flex items-center justify-center w-8 h-8 rounded-lg bg-violet-100 text-violet-600 group-hover:bg-violet-200 transition-colors flex-shrink-0">
                                  <TestTube className="w-4 h-4" />
                                </span>
                                Lab Results
                              </button>
                            )}
                            {awaitingPayment && !isWaived(appointment) && canManagePayments && onOpenPayment && (
                              <button
                                type="button"
                                onClick={() => {
                                  onOpenPayment(appointment);
                                  closeMoreMenu();
                                }}
                                className="w-full flex items-center gap-3 text-left px-3 py-2 text-sm font-semibold text-amber-700 hover:bg-amber-50 transition-colors group border-t border-slate-100 mt-1 pt-2.5"
                              >
                                <span className="flex items-center justify-center w-8 h-8 rounded-lg bg-amber-100 text-amber-700 group-hover:bg-amber-200 transition-colors flex-shrink-0">
                                  <CreditCard className="w-4 h-4" />
                                </span>
                                Record Payment
                              </button>
                            )}
                          </div>
                        </>,
                        document.body
                      )}
                    </div>
                  </div>

                  {/* Second row: Compact vitals & additional info */}
                  <div className="flex items-center gap-3 flex-wrap pl-13">
                    {/* Vitals badge - clickable to expand */}
                    {hasVisitVitals && latestVitals && (
                      <button
                        onClick={() => setExpandedVitalsId(vitalsExpanded ? null : appointment.id)}
                        className="inline-flex items-center gap-1 px-2 py-1 rounded-lg border border-indigo-200 bg-indigo-50 hover:bg-indigo-100 text-xs text-indigo-700 font-semibold transition-colors cursor-pointer"
                      >
                        <Eye className="w-3 h-3" />
                        {getCompactVitalsString(latestVitals) || 'Vitals'}
                        <ChevronDown className={`w-3 h-3 transition-transform ${vitalsExpanded ? 'rotate-180' : ''}`} />
                      </button>
                    )}

                    {!hasVisitVitals && (
                      <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-semibold border ${awaitingPayment ? 'bg-amber-50 text-amber-700 border-amber-200' : 'bg-orange-50 text-orange-700 border-orange-200'}`}>
                        <AlertTriangle className="w-3 h-3" />
                        Vitals Pending
                      </span>
                    )}

                    {/* Critical vitals inline */}
                    {hasVisitVitals && latestVitals && getCriticalVitals(latestVitals).length > 0 && (
                      <div className="flex items-center gap-1 flex-wrap">
                        {getCriticalVitals(latestVitals).map((alert, idx) => (
                          <span key={idx} className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold border ${alert.severity === 'high' ? 'bg-red-100 text-red-700 border-red-200' : 'bg-amber-100 text-amber-800 border-amber-200'}`}>
                            {alert.label}
                          </span>
                        ))}
                      </div>
                    )}

                    {/* Clinical alerts */}
                    {isElderly(appointment.patient?.dateOfBirth) && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-orange-50 text-orange-700 border border-orange-200">
                        <AlertTriangle className="w-3 h-3" />
                        Fall Risk
                      </span>
                    )}

                    {feeEstimate && (
                      <span className="px-2 py-0.5 rounded-full text-xs font-semibold border border-slate-200 text-slate-600 bg-slate-50">
                        {feeEstimate}
                      </span>
                    )}

                    {awaitingPayment && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-700 border border-amber-200">
                        <CreditCard className="w-3 h-3" /> Payment Pending
                      </span>
                    )}
                  </div>

                  {/* Expanded vitals detail section */}
                  {vitalsExpanded && hasVisitVitals && latestVitals && (
                    <div className="ml-13 p-3 rounded-lg bg-slate-50 border border-slate-200 text-sm space-y-2">
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                        <div>
                          <p className="text-xs text-slate-600 font-semibold">BP</p>
                          <p className="font-semibold text-slate-900">{latestVitals.bloodPressure}</p>
                        </div>
                        <div>
                          <p className="text-xs text-slate-600 font-semibold">HR</p>
                          <p className="font-semibold text-slate-900">{latestVitals.heartRate} bpm</p>
                        </div>
                        <div>
                          <p className="text-xs text-slate-600 font-semibold">Temp</p>
                          <p className="font-semibold text-slate-900">{latestVitals.temperature}°C</p>
                        </div>
                        <div>
                          <p className="text-xs text-slate-600 font-semibold">SpO2</p>
                          <p className="font-semibold text-slate-900">{latestVitals.oxygenSaturation}%</p>
                        </div>
                        <div>
                          <p className="text-xs text-slate-600 font-semibold">RR</p>
                          <p className="font-semibold text-slate-900">{latestVitals.respiratoryRate}</p>
                        </div>
                        <div>
                          <p className="text-xs text-slate-600 font-semibold">BMI</p>
                          <p className="font-semibold text-slate-900">{latestVitals.bmi}</p>
                        </div>
                      </div>
                      <div className="text-xs text-slate-600 pt-2 border-t border-slate-200">
                        Recorded by {latestVitals.recordedBy} on {new Date(latestVitals.recordedAt).toLocaleString()}
                      </div>
                    </div>
                  )}

                  {/* Payment & Clinical alerts section */}
                  {(awaitingPayment || appointment.patient?.allergies || appointment.patient?.chronicConditions) && (
                    <div className="ml-13 space-y-2">
                      {awaitingPayment && !isWaived(appointment) && (
                        <div className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-2 py-1.5">
                          <span className="font-semibold block mb-0.5">
                            <Lock className="w-3 h-3 inline mr-1" /> Payment required
                          </span>
                          <span className="block">
                            {canManagePayments
                              ? 'Record payment to unlock vitals, triage, and updates.'
                              : 'Contact Accounts to proceed.'}
                          </span>
                        </div>
                      )}
                      {appointment.patient?.allergies && appointment.patient.allergies.trim().length > 0 && (
                        <div className="text-xs text-rose-700 bg-rose-50 border border-rose-200 rounded-lg px-2 py-1.5">
                          <span className="font-semibold block">
                            <AlertTriangle className="w-3 h-3 inline mr-1" /> Allergies: {appointment.patient.allergies}
                          </span>
                        </div>
                      )}
                      {appointment.patient?.chronicConditions && appointment.patient.chronicConditions.trim().length > 0 && (
                        <div className="text-xs text-indigo-700 bg-indigo-50 border border-indigo-200 rounded-lg px-2 py-1.5">
                          <span className="font-semibold block">
                            <Stethoscope className="w-3 h-3 inline mr-1" /> Conditions: {appointment.patient.chronicConditions}
                          </span>
                        </div>
                      )}
                    </div>
                  )}
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
