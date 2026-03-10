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
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-600 to-blue-700 text-white p-6 flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold">Manage Availability</h2>
            <p className="text-blue-100 text-sm mt-1">Mark days or times when you're unavailable</p>
          </div>
          <button
            onClick={onClose}
            className="text-white hover:bg-white/20 rounded-lg p-2 transition-colors"
          >
            <X className="h-6 w-6" />
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
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              <Plus className="h-5 w-5" />
              Add Unavailability Period
            </button>
          </div>

          {/* Form */}
          {showForm && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 mb-6">
              <h3 className="text-lg font-semibold text-gray-800 mb-4">
                {editingId ? 'Edit' : 'Add'} Unavailability Period
              </h3>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Start Date <span className="text-red-500">*</span>
                    </label>
                    <DatePicker
                      value={formData.startDate}
                      onChange={(val) => setFormData({ ...formData, startDate: val })}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      End Date (optional)
                    </label>
                    <DatePicker
                      value={formData.endDate}
                      onChange={(val) => setFormData({ ...formData, endDate: val })}
                    />
                    <p className="text-xs text-gray-500 mt-1">
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
                    className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                  />
                  <label htmlFor="isAllDay" className="text-sm font-medium text-gray-700">
                    All Day
                  </label>
                </div>

                {!formData.isAllDay && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Start Time
                      </label>
                      <input
                        type="time"
                        value={formData.startTime}
                        onChange={(e) => setFormData({ ...formData, startTime: e.target.value })}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        End Time
                      </label>
                      <input
                        type="time"
                        value={formData.endTime}
                        onChange={(e) => setFormData({ ...formData, endTime: e.target.value })}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                    </div>
                  </div>
                )}

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Reason (optional)
                  </label>
                  <input
                    type="text"
                    value={formData.reason}
                    onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
                    placeholder="e.g., Vacation, Conference, Personal"
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Notes (optional)
                  </label>
                  <textarea
                    value={formData.notes}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                    placeholder="Additional details..."
                    rows={3}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>

                <div className="flex gap-3">
                  <button
                    type="submit"
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
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
                    className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* List */}
          {loading ? (
            <div className="text-center py-8 text-gray-500">Loading...</div>
          ) : !Array.isArray(availabilities) || availabilities.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <AlertCircle className="h-12 w-12 mx-auto mb-3 text-gray-400" />
              <p>No unavailability periods set</p>
              <p className="text-sm mt-1">Add one to prevent appointments during that time</p>
            </div>
          ) : (
            <div className="space-y-3">
              {availabilities.map((availability) => (
                <div
                  key={availability.id}
                  className="bg-white border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <Calendar className="h-5 w-5 text-blue-600" />
                        <span className="font-semibold text-gray-800">
                          {formatDate(availability.startDate)}
                          {availability.endDate && availability.endDate !== availability.startDate && (
                            <> - {formatDate(availability.endDate)}</>
                          )}
                        </span>
                      </div>
                      {!availability.isAllDay && availability.startTime && availability.endTime && (
                        <div className="flex items-center gap-2 text-sm text-gray-600 mb-2">
                          <Clock className="h-4 w-4" />
                          <span>
                            {availability.startTime} - {availability.endTime}
                          </span>
                        </div>
                      )}
                      {availability.isAllDay && (
                        <div className="flex items-center gap-2 text-sm text-gray-600 mb-2">
                          <CheckCircle className="h-4 w-4 text-green-600" />
                          <span className="text-green-700 font-medium">All Day</span>
                        </div>
                      )}
                      {availability.reason && (
                        <p className="text-sm text-gray-600 mb-1">
                          <span className="font-medium">Reason:</span> {availability.reason}
                        </p>
                      )}
                      {availability.notes && (
                        <p className="text-sm text-gray-500">{availability.notes}</p>
                      )}
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleEdit(availability)}
                        className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                        title="Edit"
                      >
                        <Edit className="h-5 w-5" />
                      </button>
                      <button
                        onClick={() => handleDelete(availability.id)}
                        className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                        title="Delete"
                      >
                        <Trash2 className="h-5 w-5" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-gray-200 p-4 bg-gray-50">
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
            <p className="text-sm text-blue-800">
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
