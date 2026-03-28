import React, { useState, useEffect } from 'react';
import { Calendar, Clock, X, Plus, Edit, Trash2, AlertCircle, CheckCircle } from 'lucide-react';
import { doctorAvailabilityApi } from '../services/api';
import { useNotification } from './GlobalNotification';
import DatePicker from './DatePicker';
import { formatDateForAPI, formatDateToDDMMYYYY } from '../utils/dateUtils';
import { useConfirmation } from '../hooks/useConfirmation';

interface DoctorAvailability {
  id: string;
  doctorId: string;
  startDate: string;
  endDate?: string;
  startTime?: string;
  endTime?: string;
  isAllDay: boolean;
  isUnavailable: boolean;
  reason?: string;
  notes?: string;
}

interface DoctorAvailabilityManagerProps {
  doctorId: string;
  tenantSlug: string;
  onClose: () => void;
}

const DoctorAvailabilityManager: React.FC<DoctorAvailabilityManagerProps> = ({
  doctorId,
  tenantSlug,
  onClose,
}) => {
  const { showSuccess, showError } = useNotification();
  const { confirm, Dialog } = useConfirmation();
  const [availabilities, setAvailabilities] = useState<DoctorAvailability[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    startDate: '',
    endDate: '',
    startTime: '',
    endTime: '',
    isAllDay: false,
    isUnavailable: true,
    reason: '',
    notes: '',
  });

  useEffect(() => {
    fetchAvailabilities();
  }, [doctorId]);

  const fetchAvailabilities = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('ehr_token');
      if (!token) return;

      const response = await doctorAvailabilityApi.list(
        { doctorId },
        token,
        tenantSlug
      );
      
      // Handle different response structures
      let availabilitiesList: DoctorAvailability[] = [];
      
      // Debug logging
      console.log('DoctorAvailabilityManager - API Response:', response);
      console.log('DoctorAvailabilityManager - response.data:', response.data);
      console.log('DoctorAvailabilityManager - response.data type:', typeof response.data);
      console.log('DoctorAvailabilityManager - isArray(response.data):', Array.isArray(response.data));
      
      if (Array.isArray(response.data)) {
        availabilitiesList = response.data;
      } else if (response.data && typeof response.data === 'object') {
        // Try common nested structures
        if (Array.isArray(response.data.availabilities)) {
          availabilitiesList = response.data.availabilities;
        } else if (Array.isArray(response.data.data)) {
          availabilitiesList = response.data.data;
        } else if (Array.isArray(response.data.items)) {
          availabilitiesList = response.data.items;
        } else if (Array.isArray(response.data.results)) {
          availabilitiesList = response.data.results;
        }
      }
      
      console.log('DoctorAvailabilityManager - Final availabilitiesList:', availabilitiesList);
      setAvailabilities(availabilitiesList);
    } catch (error: any) {
      console.error('Error fetching availabilities:', error);
      showError('Error', 'Failed to load availability records');
      setAvailabilities([]); // Ensure it's always an array
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const token = localStorage.getItem('ehr_token');
      if (!token) {
        showError('Error', 'Authentication required');
        return;
      }

      const payload = {
        doctorId,
        startDate: formatDateForAPI(formData.startDate),
        endDate: formData.endDate ? formatDateForAPI(formData.endDate) : undefined,
        startTime: formData.isAllDay ? undefined : formData.startTime,
        endTime: formData.isAllDay ? undefined : formData.endTime,
        isAllDay: formData.isAllDay,
        isUnavailable: formData.isUnavailable,
        reason: formData.reason || undefined,
        notes: formData.notes || undefined,
      };

      if (editingId) {
        await doctorAvailabilityApi.update(editingId, payload, token, tenantSlug);
        showSuccess('Success', 'Availability updated successfully');
      } else {
        await doctorAvailabilityApi.create(payload, token, tenantSlug);
        showSuccess('Success', 'Unavailability period added successfully');
      }

      setShowForm(false);
      setEditingId(null);
      resetForm();
      fetchAvailabilities();
    } catch (error: any) {
      console.error('Error saving availability:', error);
      const message = error?.response?.data?.message || 'Failed to save availability';
      showError('Error', Array.isArray(message) ? message.join(', ') : message);
    }
  };

  const formatDateForDatePicker = (dateString: string): string => {
    if (!dateString) return '';
    const date = new Date(dateString);
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    return `${day}/${month}/${year}`;
  };

  const handleEdit = (availability: DoctorAvailability) => {
    setEditingId(availability.id);
    setFormData({
      startDate: formatDateForDatePicker(availability.startDate),
      endDate: availability.endDate ? formatDateForDatePicker(availability.endDate) : '',
      startTime: availability.startTime || '',
      endTime: availability.endTime || '',
      isAllDay: availability.isAllDay,
      isUnavailable: availability.isUnavailable,
      reason: availability.reason || '',
      notes: availability.notes || '',
    });
    setShowForm(true);
  };

  const handleDelete = async (id: string) => {
    const shouldProceed = await confirm({
      title: 'Delete Unavailability Period',
      message: 'Are you sure you want to delete this unavailability period?',
      confirmText: 'Delete',
      cancelText: 'Keep',
      type: 'danger',
    });
    if (!shouldProceed) {
      return;
    }

    try {
      const token = localStorage.getItem('ehr_token');
      if (!token) {
        showError('Error', 'Authentication required');
        return;
      }

      await doctorAvailabilityApi.delete(id, token, tenantSlug);
      showSuccess('Success', 'Unavailability period deleted successfully');
      fetchAvailabilities();
    } catch (error: any) {
      console.error('Error deleting availability:', error);
      showError('Error', 'Failed to delete availability');
    }
  };

  const resetForm = () => {
    setFormData({
      startDate: '',
      endDate: '',
      startTime: '',
      endTime: '',
      isAllDay: false,
      isUnavailable: true,
      reason: '',
      notes: '',
    });
  };

  const formatDate = (dateString: string) => {
    return formatDateToDDMMYYYY(new Date(dateString));
  };

  return (
    <>
      {Dialog}
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/45 p-4 backdrop-blur-sm">
      <div className="flex max-h-[90vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between bg-gradient-to-r from-sky-600 via-cyan-600 to-indigo-700 p-6 text-white">
          <div>
            <h2 className="text-2xl font-bold">Manage Availability</h2>
            <p className="mt-1 text-sm text-cyan-100">Mark days or times when you're unavailable</p>
          </div>
          <button
            onClick={onClose}
            className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-white/40 bg-white/15 text-white shadow-sm transition-colors hover:bg-white/25 focus:outline-none focus:ring-2 focus:ring-white/70"
            aria-label="Close availability manager"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {/* Add New Button */}
          <div className="mb-6">
            <button
              onClick={() => {
                resetForm();
                setEditingId(null);
                setShowForm(true);
              }}
              className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-cyan-600 to-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-all hover:from-cyan-700 hover:to-indigo-700 hover:shadow-md"
            >
              <Plus className="h-5 w-5" />
              Add Unavailability Period
            </button>
          </div>

          {/* Form */}
          {showForm && (
            <div className="mb-6 rounded-2xl border border-sky-200 bg-gradient-to-r from-sky-50 via-white to-indigo-50 p-6">
              <h3 className="mb-4 text-lg font-semibold text-slate-800">
                {editingId ? 'Edit' : 'Add'} Unavailability Period
              </h3>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="mb-2 block text-sm font-medium text-slate-700">
                      Start Date <span className="text-red-500">*</span>
                    </label>
                    <DatePicker
                      value={formData.startDate}
                      onChange={(val) => setFormData({ ...formData, startDate: val })}
                    />
                  </div>
                  <div>
                    <label className="mb-2 block text-sm font-medium text-slate-700">
                      End Date (optional)
                    </label>
                    <DatePicker
                      value={formData.endDate}
                      onChange={(val) => setFormData({ ...formData, endDate: val })}
                    />
                    <p className="mt-1 text-xs text-slate-500">
                      Leave empty for single day
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    id="isAllDay"
                    checked={formData.isAllDay}
                    onChange={(e) => setFormData({ ...formData, isAllDay: e.target.checked })}
                    className="h-4 w-4 rounded border-slate-300 text-cyan-600 focus:ring-cyan-500"
                  />
                  <label htmlFor="isAllDay" className="text-sm font-medium text-slate-700">
                    All Day
                  </label>
                </div>

                {!formData.isAllDay && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="mb-2 block text-sm font-medium text-slate-700">
                        Start Time
                      </label>
                      <input
                        type="time"
                        value={formData.startTime}
                        onChange={(e) => setFormData({ ...formData, startTime: e.target.value })}
                        className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-slate-800 focus:border-transparent focus:ring-2 focus:ring-cyan-500"
                      />
                    </div>
                    <div>
                      <label className="mb-2 block text-sm font-medium text-slate-700">
                        End Time
                      </label>
                      <input
                        type="time"
                        value={formData.endTime}
                        onChange={(e) => setFormData({ ...formData, endTime: e.target.value })}
                        className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-slate-800 focus:border-transparent focus:ring-2 focus:ring-cyan-500"
                      />
                    </div>
                  </div>
                )}

                <div>
                  <label className="mb-2 block text-sm font-medium text-slate-700">
                    Reason (optional)
                  </label>
                  <input
                    type="text"
                    value={formData.reason}
                    onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
                    placeholder="e.g., Vacation, Conference, Personal"
                    className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-slate-800 focus:border-transparent focus:ring-2 focus:ring-cyan-500"
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium text-slate-700">
                    Notes (optional)
                  </label>
                  <textarea
                    value={formData.notes}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                    placeholder="Additional details..."
                    rows={3}
                    className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-slate-800 focus:border-transparent focus:ring-2 focus:ring-cyan-500"
                  />
                </div>

                <div className="flex gap-3">
                  <button
                    type="submit"
                    className="rounded-xl bg-gradient-to-r from-cyan-600 to-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-all hover:from-cyan-700 hover:to-indigo-700"
                  >
                    {editingId ? 'Update' : 'Add'} Unavailability
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowForm(false);
                      setEditingId(null);
                      resetForm();
                    }}
                    className="rounded-xl border border-slate-300 bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-200"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* List */}
          {loading ? (
            <div className="py-8 text-center text-slate-500">Loading...</div>
          ) : !Array.isArray(availabilities) || availabilities.length === 0 ? (
            <div className="py-8 text-center text-slate-500">
              <AlertCircle className="mx-auto mb-3 h-12 w-12 text-slate-400" />
              <p>No unavailability periods set</p>
              <p className="text-sm mt-1">Add one to prevent appointments during that time</p>
            </div>
          ) : (
            <div className="space-y-3">
              {availabilities.map((availability) => (
                <div
                  key={availability.id}
                  className="rounded-xl border border-slate-200 bg-gradient-to-r from-white to-slate-50 p-4 transition-shadow hover:shadow-md"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <Calendar className="h-5 w-5 text-cyan-600" />
                        <span className="font-semibold text-slate-800">
                          {formatDate(availability.startDate)}
                          {availability.endDate && availability.endDate !== availability.startDate && (
                            <> - {formatDate(availability.endDate)}</>
                          )}
                        </span>
                      </div>
                      {!availability.isAllDay && availability.startTime && availability.endTime && (
                        <div className="mb-2 flex items-center gap-2 text-sm text-slate-600">
                          <Clock className="h-4 w-4 text-indigo-600" />
                          <span>
                            {availability.startTime} - {availability.endTime}
                          </span>
                        </div>
                      )}
                      {availability.isAllDay && (
                        <div className="mb-2 flex items-center gap-2 text-sm text-slate-600">
                          <CheckCircle className="h-4 w-4 text-green-600" />
                          <span className="text-green-700 font-medium">All Day</span>
                        </div>
                      )}
                      {availability.reason && (
                        <p className="mb-1 text-sm text-slate-600">
                          <span className="font-medium">Reason:</span> {availability.reason}
                        </p>
                      )}
                      {availability.notes && (
                        <p className="text-sm text-slate-500">{availability.notes}</p>
                      )}
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleEdit(availability)}
                        className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-cyan-200 bg-cyan-50 text-cyan-700 transition-colors hover:bg-cyan-100"
                        title="Edit"
                      >
                        <Edit className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(availability.id)}
                        className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-rose-200 bg-rose-50 text-rose-700 transition-colors hover:bg-rose-100"
                        title="Delete"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-slate-200 bg-slate-50 p-4">
          <div className="rounded-xl border border-cyan-200 bg-gradient-to-r from-cyan-50 via-white to-indigo-50 p-3">
            <p className="text-sm text-slate-700">
              <strong>Note:</strong> When you mark yourself as unavailable, nurses and receptionists will not be able to schedule appointments during those times.
            </p>
          </div>
        </div>
      </div>
      </div>
    </>
  );
};

export default DoctorAvailabilityManager;
