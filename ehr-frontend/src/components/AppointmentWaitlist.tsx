import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  BellRing,
  Calendar,
  CheckCircle2,
  Clock,
  Loader2,
  Plus,
  RefreshCw,
  Search,
  Stethoscope,
  Trash2,
  User,
} from 'lucide-react';
import { ehrApi } from '../services/api';
import { useNotification } from './GlobalNotification';
import ModalPortal from './ModalPortal';
import ConfirmationDialog from './ConfirmationDialog';
import DatePicker from './DatePicker';
import { formatDateForAPI, formatDateForInput, isValidDate } from '../utils/dateUtils';

interface PatientOption {
  id: string;
  firstName: string;
  lastName: string;
  patientNumber?: string;
}

interface DoctorOption {
  id: string;
  firstName: string;
  lastName: string;
}

export interface WaitlistEntry {
  id: string;
  patientId: string;
  doctorId?: string;
  appointmentType?: string;
  preferredDate?: string;
  preferredTimeStart?: string;
  preferredTimeEnd?: string;
  priority: 'low' | 'normal' | 'high' | 'urgent';
  reason?: string;
  notes?: string;
  status: 'pending' | 'notified' | 'scheduled' | 'cancelled' | 'expired';
  notifiedAt?: string;
  createdAt: string;
  patient?: {
    firstName: string;
    lastName: string;
    patientNumber?: string;
  };
  doctor?: {
    firstName: string;
    lastName: string;
  };
}

interface AppointmentWaitlistProps {
  tenantSlug: string;
  onScheduled?: () => void;
}

const PRIORITY_OPTIONS = [
  { value: 'all', label: 'All priorities' },
  { value: 'urgent', label: 'Urgent' },
  { value: 'high', label: 'High' },
  { value: 'normal', label: 'Normal' },
  { value: 'low', label: 'Low' },
];

const STATUS_OPTIONS = [
  { value: 'all', label: 'All statuses' },
  { value: 'pending', label: 'Pending' },
  { value: 'notified', label: 'Notified' },
  { value: 'scheduled', label: 'Scheduled' },
  { value: 'cancelled', label: 'Cancelled' },
  { value: 'expired', label: 'Expired' },
];

const PRIORITY_BADGE: Record<string, string> = {
  urgent: 'bg-red-100 text-red-700 border-red-200',
  high: 'bg-amber-100 text-amber-700 border-amber-200',
  normal: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  low: 'bg-slate-100 text-slate-600 border-slate-200',
};

const STATUS_BADGE: Record<string, string> = {
  pending: 'bg-amber-50 text-amber-700 border-amber-200',
  notified: 'bg-indigo-50 text-indigo-700 border-indigo-200',
  scheduled: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  cancelled: 'bg-rose-50 text-rose-700 border-rose-200',
  expired: 'bg-slate-50 text-slate-600 border-slate-200',
};

const AppointmentWaitlist: React.FC<AppointmentWaitlistProps> = ({ tenantSlug, onScheduled }) => {
  const { showError, showSuccess } = useNotification();
  const token = useMemo(() => localStorage.getItem('ehr_token') || '', []);

  const [entries, setEntries] = useState<WaitlistEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [filters, setFilters] = useState({ status: 'pending', priority: 'all' });

  const [patients, setPatients] = useState<PatientOption[]>([]);
  const [doctors, setDoctors] = useState<DoctorOption[]>([]);

  const [showForm, setShowForm] = useState(false);
  const [formSubmitting, setFormSubmitting] = useState(false);
  const [form, setForm] = useState({
    patientId: '',
    doctorId: '',
    appointmentType: 'consultation',
    preferredDate: '',
    preferredTimeStart: '',
    preferredTimeEnd: '',
    priority: 'normal' as WaitlistEntry['priority'],
    reason: '',
    notes: '',
  });

  const [scheduleModalOpen, setScheduleModalOpen] = useState(false);
  const [scheduleEntry, setScheduleEntry] = useState<WaitlistEntry | null>(null);
  const [scheduleSubmitting, setScheduleSubmitting] = useState(false);
  const [scheduleForm, setScheduleForm] = useState({ date: '', time: '' });

  const [confirmDialog, setConfirmDialog] = useState<{
    open: boolean;
    entry: WaitlistEntry | null;
    mode: 'delete' | 'notify' | null;
    loading: boolean;
  }>({ open: false, entry: null, mode: null, loading: false });

  const loadLookups = useCallback(async () => {
    if (!tenantSlug || !token) return;
    try {
      const [patientsRes, doctorsRes] = await Promise.all([
        ehrApi.getPatients(token, tenantSlug, 1, 1000),
        ehrApi.getUsers(token, tenantSlug, 'doctor'),
      ]);
      setPatients(patientsRes.data?.patients || patientsRes.data || []);
      setDoctors(doctorsRes.data || []);
    } catch (error) {
      console.error('Failed to load lookup data', error);
      showError('Lookups', 'Unable to load patient/doctor lists.');
    }
  }, [tenantSlug, token, showError]);

  const loadEntries = useCallback(async () => {
    if (!tenantSlug || !token) return;
    try {
      setLoading(true);
      const params: Record<string, string> = {};
      if (filters.status !== 'all') params.status = filters.status;
      if (filters.priority !== 'all') params.priority = filters.priority;
      const response = await ehrApi.getWaitlist(token, tenantSlug, params);
      setEntries(response.data || []);
    } catch (error) {
      console.error('Failed to load waitlist entries', error);
      showError('Waitlist', 'Unable to load appointment waitlist.');
    } finally {
      setLoading(false);
    }
  }, [tenantSlug, token, filters, showError]);

  useEffect(() => {
    loadLookups();
  }, [loadLookups]);

  useEffect(() => {
    loadEntries();
  }, [loadEntries]);

  const resetForm = () => {
    setForm({
      patientId: '',
      doctorId: '',
      appointmentType: 'consultation',
      preferredDate: '',
      preferredTimeStart: '',
      preferredTimeEnd: '',
      priority: 'normal',
      reason: '',
      notes: '',
    });
  };

  const handleCreateEntry = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!form.patientId) {
      showError('Validation', 'Please select a patient before adding them to waitlist.');
      return;
    }

    const payload = {
      ...form,
      doctorId: form.doctorId || undefined,
      preferredDate: form.preferredDate && isValidDate(form.preferredDate) ? formatDateForAPI(form.preferredDate) : undefined,
      preferredTimeStart: form.preferredTimeStart || undefined,
      preferredTimeEnd: form.preferredTimeEnd || undefined,
      reason: form.reason || undefined,
      notes: form.notes || undefined,
    };

    try {
      setFormSubmitting(true);
      await ehrApi.createWaitlistEntry(payload, token, tenantSlug);
      showSuccess('Waitlist', 'Patient added to appointment waitlist.');
      resetForm();
      setShowForm(false);
      loadEntries();
    } catch (error: any) {
      console.error('Failed to add waitlist entry', error);
      showError('Waitlist', error?.response?.data?.message || 'Unable to add patient to waitlist.');
    } finally {
      setFormSubmitting(false);
    }
  };

  const openConfirmDialog = (entry: WaitlistEntry, mode: 'delete' | 'notify') => {
    setConfirmDialog({ open: true, entry, mode, loading: false });
  };

  const handleConfirm = async () => {
    if (!confirmDialog.entry || !confirmDialog.mode) return;
    setConfirmDialog((prev) => ({ ...prev, loading: true }));
    try {
      if (confirmDialog.mode === 'delete') {
        await ehrApi.deleteWaitlistEntry(confirmDialog.entry.id, token, tenantSlug);
        showSuccess('Waitlist', 'Entry removed from waitlist.');
      } else {
        await ehrApi.notifyWaitlistEntry(confirmDialog.entry.id, token, tenantSlug);
        showSuccess('Waitlist', 'Patient marked as notified.');
      }
      loadEntries();
    } catch (error: any) {
      console.error('Waitlist action failed', error);
      showError('Waitlist', error?.response?.data?.message || 'Unable to update waitlist entry.');
    } finally {
      setConfirmDialog({ open: false, entry: null, mode: null, loading: false });
    }
  };

  const openScheduleModal = (entry: WaitlistEntry) => {
    setScheduleEntry(entry);
    setScheduleForm({
      date: entry.preferredDate ? formatDateForInput(entry.preferredDate) : '',
      time: entry.preferredTimeStart?.slice(0, 5) || '',
    });
    setScheduleModalOpen(true);
  };

  const handleSchedule = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!scheduleEntry || !scheduleForm.date || !scheduleForm.time) {
      showError('Schedule', 'Pick a date and time before scheduling.');
      return;
    }

    const apiDate = formatDateForAPI(scheduleForm.date);
    if (!apiDate) {
      showError('Schedule', 'Invalid date selected.');
      return;
    }

    try {
      setScheduleSubmitting(true);
      const payload = `${apiDate}T${scheduleForm.time}:00`;
      await ehrApi.scheduleFromWaitlist(scheduleEntry.id, payload, token, tenantSlug);
      showSuccess('Schedule', 'Appointment created from waitlist entry.');
      setScheduleModalOpen(false);
      setScheduleEntry(null);
      setScheduleForm({ date: '', time: '' });
      loadEntries();
      onScheduled?.();
    } catch (error: any) {
      console.error('Failed to schedule from waitlist', error);
      showError('Schedule', error?.response?.data?.message || 'Unable to schedule appointment.');
    } finally {
      setScheduleSubmitting(false);
    }
  };

  const filteredEntries = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    const sorted = entries.slice().sort((a, b) => {
      const priorityWeight: Record<WaitlistEntry['priority'], number> = { urgent: 4, high: 3, normal: 2, low: 1 };
      const diff = priorityWeight[b.priority] - priorityWeight[a.priority];
      if (diff !== 0) return diff;
      return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
    });
    if (!term) return sorted;
    return sorted.filter((entry) => {
      const fullName = `${entry.patient?.firstName || ''} ${entry.patient?.lastName || ''}`.toLowerCase();
      const patientNumber = entry.patient?.patientNumber?.toLowerCase() || '';
      const reason = entry.reason?.toLowerCase() || '';
      return (
        fullName.includes(term) ||
        patientNumber.includes(term) ||
        reason.includes(term)
      );
    });
  }, [entries, searchTerm]);

  return (
    <section className="bg-white rounded-2xl shadow-sm border border-slate-200/70 p-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <BellRing className="w-5 h-5 text-blue-600" />
            Appointment Waitlist
          </h2>
          <p className="text-sm text-slate-500">
            Track patients waiting for open appointment slots and schedule them quickly.
          </p>
        </div>
        <div className="flex gap-3">
          <button
            type="button"
            onClick={loadEntries}
            disabled={loading}
            className="inline-flex items-center gap-2 px-4 py-2 border border-slate-200 rounded-xl text-slate-600 hover:bg-slate-50 disabled:opacity-50"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
            Refresh
          </button>
          <button
            type="button"
            onClick={() => setShowForm(true)}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-600 text-white font-medium hover:bg-blue-700"
          >
            <Plus className="w-4 h-4" />
            Add to Waitlist
          </button>
        </div>
      </div>

      <div className="mt-6 grid gap-4 md:grid-cols-3">
        <div className="rounded-xl border border-slate-200 p-4 bg-slate-50">
          <p className="text-xs font-semibold text-slate-500 uppercase">Total Entries</p>
          <p className="text-3xl font-bold text-slate-900 mt-1">{entries.length}</p>
        </div>
        <div className="rounded-xl border border-amber-200 p-4 bg-amber-50">
          <p className="text-xs font-semibold text-amber-600 uppercase">Pending</p>
          <p className="text-3xl font-bold text-amber-700 mt-1">{entries.filter((e) => e.status === 'pending').length}</p>
        </div>
        <div className="rounded-xl border border-indigo-200 p-4 bg-indigo-50">
          <p className="text-xs font-semibold text-indigo-600 uppercase">Notified</p>
          <p className="text-3xl font-bold text-indigo-700 mt-1">{entries.filter((e) => e.status === 'notified').length}</p>
        </div>
      </div>

      <div className="mt-6 grid gap-4 md:grid-cols-3">
        <div>
          <label className="text-xs font-semibold text-slate-500 uppercase block mb-2">Search</label>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search by patient, number, or reason"
              className="w-full pl-10 pr-3 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>
        <div>
          <label className="text-xs font-semibold text-slate-500 uppercase block mb-2">Status</label>
          <select
            value={filters.status}
            onChange={(e) => setFilters((prev) => ({ ...prev, status: e.target.value }))}
            className="w-full border border-slate-200 rounded-xl px-3 py-2 focus:ring-2 focus:ring-blue-500"
          >
            {STATUS_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-xs font-semibold text-slate-500 uppercase block mb-2">Priority</label>
          <select
            value={filters.priority}
            onChange={(e) => setFilters((prev) => ({ ...prev, priority: e.target.value }))}
            className="w-full border border-slate-200 rounded-xl px-3 py-2 focus:ring-2 focus:ring-blue-500"
          >
            {PRIORITY_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="mt-6">
        {loading ? (
          <div className="py-16 text-center text-slate-500 flex items-center justify-center gap-2">
            <Loader2 className="w-5 h-5 animate-spin" />
            Loading waitlist entries...
          </div>
        ) : filteredEntries.length === 0 ? (
          <div className="py-16 text-center border border-dashed border-slate-200 rounded-2xl bg-slate-50 text-slate-500">
            No waitlist entries found for the selected filters.
          </div>
        ) : (
          <div className="space-y-4">
            {filteredEntries.map((entry) => (
              <div key={entry.id} className="border border-slate-200 rounded-2xl p-4 hover:border-blue-200 transition-colors">
                <div className="flex flex-col gap-3 lg:flex-row lg:justify-between">
                  <div>
                    <div className="flex flex-wrap items-center gap-3">
                      <div className="flex items-center gap-2 text-slate-800 font-semibold">
                        <User className="w-4 h-4 text-blue-500" />
                        {entry.patient ? `${entry.patient.firstName} ${entry.patient.lastName}` : 'Unknown patient'}
                      </div>
                      {entry.patient?.patientNumber && (
                        <span className="text-xs text-slate-500 bg-slate-100 rounded-full px-2 py-1">
                          #{entry.patient.patientNumber}
                        </span>
                      )}
                      <span className={`text-xs font-semibold px-2 py-1 rounded-full border ${PRIORITY_BADGE[entry.priority]}`}>
                        {entry.priority.toUpperCase()}
                      </span>
                      <span className={`text-xs font-semibold px-2 py-1 rounded-full border ${STATUS_BADGE[entry.status]}`}>
                        {entry.status.toUpperCase()}
                      </span>
                    </div>
                    {entry.reason && <p className="text-sm text-slate-600 mt-2">{entry.reason}</p>}
                    <div className="mt-3 grid gap-3 sm:grid-cols-2 text-sm text-slate-600">
                      <div className="flex items-center gap-2">
                        <Calendar className="w-4 h-4 text-slate-400" />
                        Preferred date:{' '}
                        <span className="font-medium">
                          {entry.preferredDate ? formatDateForInput(entry.preferredDate) : 'Any'}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Clock className="w-4 h-4 text-slate-400" />
                        {entry.preferredTimeStart
                          ? `${entry.preferredTimeStart.slice(0, 5)} - ${entry.preferredTimeEnd?.slice(0, 5) || 'N/A'}`
                          : 'No time preference'}
                      </div>
                      {entry.doctor && (
                        <div className="flex items-center gap-2">
                          <Stethoscope className="w-4 h-4 text-slate-400" />
                          {entry.doctor.firstName} {entry.doctor.lastName}
                        </div>
                      )}
                      <div className="text-xs text-slate-500">
                        Added {new Date(entry.createdAt).toLocaleDateString()} •{' '}
                        {entry.notifiedAt ? `Notified ${new Date(entry.notifiedAt).toLocaleDateString()}` : 'Not notified'}
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-col gap-2 min-w-[200px]">
                    {entry.status === 'pending' && (
                      <>
                        <button
                          type="button"
                          onClick={() => openScheduleModal(entry)}
                          className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-emerald-600 text-white text-sm font-semibold hover:bg-emerald-700"
                        >
                          <CheckCircle2 className="w-4 h-4" />
                          Schedule
                        </button>
                        <button
                          type="button"
                          onClick={() => openConfirmDialog(entry, 'notify')}
                          className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl border border-indigo-200 text-indigo-700 text-sm font-semibold hover:bg-indigo-50"
                        >
                          <BellRing className="w-4 h-4" />
                          Mark Notified
                        </button>
                      </>
                    )}
                    <button
                      type="button"
                      onClick={() => openConfirmDialog(entry, 'delete')}
                      className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl border border-red-200 text-red-600 text-sm font-semibold hover:bg-red-50"
                    >
                      <Trash2 className="w-4 h-4" />
                      Remove
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {showForm && (
        <ModalPortal>
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[9999] p-4" onClick={() => !formSubmitting && setShowForm(false)}>
            <div className="bg-white rounded-2xl w-full max-w-2xl p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-xl font-semibold text-slate-900">Add to Waitlist</h3>
                  <p className="text-sm text-slate-500">Capture patient preferences to help fill cancellations quickly.</p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  className="text-slate-400 hover:text-slate-600"
                  disabled={formSubmitting}
                >
                  ✕
                </button>
              </div>

              <form className="space-y-4" onSubmit={handleCreateEntry}>
                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <label className="text-sm font-semibold text-slate-700 mb-2 block">Patient</label>
                    <select
                      value={form.patientId}
                      onChange={(e) => setForm((prev) => ({ ...prev, patientId: e.target.value }))}
                      className="w-full border border-slate-200 rounded-xl px-3 py-2 focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="">Select patient</option>
                      {patients.map((patient) => (
                        <option key={patient.id} value={patient.id}>
                          {patient.firstName} {patient.lastName} {patient.patientNumber ? `(#${patient.patientNumber})` : ''}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-sm font-semibold text-slate-700 mb-2 block">Preferred Doctor</label>
                    <select
                      value={form.doctorId}
                      onChange={(e) => setForm((prev) => ({ ...prev, doctorId: e.target.value }))}
                      className="w-full border border-slate-200 rounded-xl px-3 py-2 focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="">Any doctor</option>
                      {doctors.map((doctor) => (
                        <option key={doctor.id} value={doctor.id}>
                          Dr. {doctor.firstName} {doctor.lastName}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <label className="text-sm font-semibold text-slate-700 mb-2 block">Appointment Type</label>
                    <input
                      type="text"
                      value={form.appointmentType}
                      onChange={(e) => setForm((prev) => ({ ...prev, appointmentType: e.target.value }))}
                      className="w-full border border-slate-200 rounded-xl px-3 py-2 focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="text-sm font-semibold text-slate-700 mb-2 block">Priority</label>
                    <select
                      value={form.priority}
                      onChange={(e) => setForm((prev) => ({ ...prev, priority: e.target.value as WaitlistEntry['priority'] }))}
                      className="w-full border border-slate-200 rounded-xl px-3 py-2 focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="urgent">Urgent</option>
                      <option value="high">High</option>
                      <option value="normal">Normal</option>
                      <option value="low">Low</option>
                    </select>
                  </div>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <DatePicker
                    label="Preferred date"
                    value={form.preferredDate}
                    onChange={(value: string) => setForm((prev) => ({ ...prev, preferredDate: value }))}
                  />
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-sm font-semibold text-slate-700 mb-2 block">Start time</label>
                      <input
                        type="time"
                        value={form.preferredTimeStart}
                        onChange={(e) => setForm((prev) => ({ ...prev, preferredTimeStart: e.target.value }))}
                        className="w-full border border-slate-200 rounded-xl px-3 py-2 focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <div>
                      <label className="text-sm font-semibold text-slate-700 mb-2 block">End time</label>
                      <input
                        type="time"
                        value={form.preferredTimeEnd}
                        onChange={(e) => setForm((prev) => ({ ...prev, preferredTimeEnd: e.target.value }))}
                        className="w-full border border-slate-200 rounded-xl px-3 py-2 focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  </div>
                </div>

                <div>
                  <label className="text-sm font-semibold text-slate-700 mb-2 block">Reason</label>
                  <textarea
                    rows={2}
                    value={form.reason}
                    onChange={(e) => setForm((prev) => ({ ...prev, reason: e.target.value }))}
                    className="w-full border border-slate-200 rounded-xl px-3 py-2 focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="text-sm font-semibold text-slate-700 mb-2 block">Notes</label>
                  <textarea
                    rows={3}
                    value={form.notes}
                    onChange={(e) => setForm((prev) => ({ ...prev, notes: e.target.value }))}
                    className="w-full border border-slate-200 rounded-xl px-3 py-2 focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div className="flex justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => setShowForm(false)}
                    className="px-4 py-2 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50"
                    disabled={formSubmitting}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={formSubmitting}
                    className="px-5 py-2 rounded-xl bg-blue-600 text-white font-semibold hover:bg-blue-700 flex items-center gap-2 disabled:opacity-50"
                  >
                    {formSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
                    Add to Waitlist
                  </button>
                </div>
              </form>
            </div>
          </div>
        </ModalPortal>
      )}

      {scheduleModalOpen && scheduleEntry && (
        <ModalPortal>
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[9999] p-4" onClick={() => !scheduleSubmitting && setScheduleModalOpen(false)}>
            <div className="bg-white rounded-2xl w-full max-w-lg p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-xl font-semibold text-slate-900">Schedule from Waitlist</h3>
                  <p className="text-sm text-slate-500">
                    Creating appointment for {scheduleEntry.patient ? `${scheduleEntry.patient.firstName} ${scheduleEntry.patient.lastName}` : 'patient'}.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setScheduleModalOpen(false)}
                  className="text-slate-400 hover:text-slate-600"
                  disabled={scheduleSubmitting}
                >
                  ✕
                </button>
              </div>

              <form className="space-y-4" onSubmit={handleSchedule}>
                <DatePicker
                  label="Appointment date"
                  value={scheduleForm.date}
                  onChange={(value: string) => setScheduleForm((prev) => ({ ...prev, date: value }))}
                />
                <div>
                  <label className="text-sm font-semibold text-slate-700 mb-2 block">Time</label>
                  <input
                    type="time"
                    value={scheduleForm.time}
                    onChange={(e) => setScheduleForm((prev) => ({ ...prev, time: e.target.value }))}
                    className="w-full border border-slate-200 rounded-xl px-3 py-2 focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div className="flex justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => setScheduleModalOpen(false)}
                    className="px-4 py-2 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50"
                    disabled={scheduleSubmitting}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={scheduleSubmitting}
                    className="px-5 py-2 rounded-xl bg-emerald-600 text-white font-semibold hover:bg-emerald-700 flex items-center gap-2 disabled:opacity-50"
                  >
                    {scheduleSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
                    Schedule Appointment
                  </button>
                </div>
              </form>
            </div>
          </div>
        </ModalPortal>
      )}

      <ConfirmationDialog
        isOpen={confirmDialog.open}
        onClose={() => !confirmDialog.loading && setConfirmDialog({ open: false, entry: null, mode: null, loading: false })}
        onConfirm={handleConfirm}
        title={confirmDialog.mode === 'delete' ? 'Remove waitlist entry' : 'Mark as notified'}
        message={
          confirmDialog.mode === 'delete'
            ? 'This patient will be removed from the waitlist. This action cannot be undone.'
            : 'Confirm that the patient has been notified about an available slot.'
        }
        type={confirmDialog.mode === 'delete' ? 'danger' : 'info'}
        confirmText={confirmDialog.mode === 'delete' ? 'Remove' : 'Mark notified'}
        isLoading={confirmDialog.loading}
      />
    </section>
  );
};

export default AppointmentWaitlist;
