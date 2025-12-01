import React, { useState, useEffect } from 'react';
import { usePatientAuth } from '../contexts/PatientAuthContext';
import { patientPortalApi } from '../services/api';
import { useTenantSlug } from '../hooks/useTenantSlug';
import { useNotification } from '../components/GlobalNotification';
import { useConfirmation } from '../hooks/useConfirmation';
import { ConfirmationDialog } from '../components/ConfirmationDialog';
import { Bell, ArrowLeft, Plus, Edit, Trash2, Clock, Calendar, X, Save, AlertCircle, CheckCircle } from 'lucide-react';
import { Link } from 'react-router-dom';
import { format } from 'date-fns';

const DAYS_OF_WEEK = [
  { value: 0, label: 'Sunday', short: 'Sun' },
  { value: 1, label: 'Monday', short: 'Mon' },
  { value: 2, label: 'Tuesday', short: 'Tue' },
  { value: 3, label: 'Wednesday', short: 'Wed' },
  { value: 4, label: 'Thursday', short: 'Thu' },
  { value: 5, label: 'Friday', short: 'Fri' },
  { value: 6, label: 'Saturday', short: 'Sat' },
];

const MedicationRemindersPage: React.FC = () => {
  const { token, patient } = usePatientAuth();
  const tenantSlug = useTenantSlug();
  const { showError, showSuccess } = useNotification();
  const { confirmation, confirm, cancel } = useConfirmation();
  const [reminders, setReminders] = useState<any[]>([]);
  const [prescriptions, setPrescriptions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingReminder, setEditingReminder] = useState<any>(null);
  const [formData, setFormData] = useState({
    prescriptionId: '',
    reminderTime: '09:00',
    reminderDays: [] as number[],
    reminderType: 'notification',
    timezone: 'Africa/Harare',
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      setError('');
      const [remindersData, prescriptionsData] = await Promise.all([
        patientPortalApi.getMedicationReminders(token!, tenantSlug, { activeOnly: false }),
        patientPortalApi.getPrescriptions(token!, tenantSlug, true),
      ]);
      setReminders(Array.isArray(remindersData) ? remindersData : []);
      setPrescriptions(Array.isArray(prescriptionsData) ? prescriptionsData : []);
    } catch (err: any) {
      console.error('Error loading data:', err);
      setError(err.message || 'Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateReminder = () => {
    setEditingReminder(null);
    setFormData({
      prescriptionId: '',
      reminderTime: '09:00',
      reminderDays: [],
      reminderType: 'notification',
      timezone: 'Africa/Harare',
    });
    setShowModal(true);
  };

  const handleEditReminder = (reminder: any) => {
    setEditingReminder(reminder);
    setFormData({
      prescriptionId: reminder.prescriptionId,
      reminderTime: reminder.reminderTime || '09:00',
      reminderDays: reminder.reminderDays || [],
      reminderType: reminder.reminderType || 'notification',
      timezone: reminder.timezone || 'Africa/Harare',
    });
    setShowModal(true);
  };

  const handleSaveReminder = async () => {
    if (!formData.prescriptionId || formData.reminderDays.length === 0) {
      setError('Please select a prescription and at least one day');
      return;
    }

    try {
      setError('');
      if (editingReminder) {
        await patientPortalApi.updateMedicationReminder(
          editingReminder.id,
          {
            reminderTime: formData.reminderTime,
            reminderDays: formData.reminderDays,
            reminderType: formData.reminderType,
            isActive: true,
          },
          token!,
          tenantSlug,
        );
      } else {
        await patientPortalApi.createMedicationReminder(
          formData.prescriptionId,
          {
            reminderTime: formData.reminderTime,
            reminderDays: formData.reminderDays,
            reminderType: formData.reminderType,
            timezone: formData.timezone,
          },
          token!,
          tenantSlug,
        );
      }
      setShowModal(false);
      await loadData();
    } catch (err: any) {
      setError(err.message || 'Failed to save reminder');
    }
  };

  const handleDeleteReminder = async (reminderId: string) => {
    const confirmed = await confirm({
      title: 'Delete Reminder',
      message: 'Are you sure you want to delete this reminder?',
      confirmText: 'Yes, Delete',
      cancelText: 'Cancel',
      type: 'danger',
    });

    if (!confirmed) return;

    try {
      await patientPortalApi.deleteMedicationReminder(reminderId, token!, tenantSlug);
      await loadData();
      showSuccess('Success', 'Reminder deleted successfully');
    } catch (err: any) {
      showError('Error', err.message || 'Failed to delete reminder');
    }
  };

  const toggleDay = (day: number) => {
    setFormData((prev) => ({
      ...prev,
      reminderDays: prev.reminderDays.includes(day)
        ? prev.reminderDays.filter((d) => d !== day)
        : [...prev.reminderDays, day].sort(),
    }));
  };

  const getReminderTypeLabel = (type: string) => {
    switch (type) {
      case 'sms':
        return 'SMS';
      case 'email':
        return 'Email';
      case 'push':
        return 'Push';
      case 'notification':
        return 'In-App';
      case 'all':
        return 'All';
      default:
        return type;
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 via-white to-indigo-50">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-purple-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">Loading medication reminders...</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <ConfirmationDialog
        isOpen={confirmation.isOpen}
        title={confirmation.title}
        message={confirmation.message}
        confirmText={confirmation.confirmText}
        cancelText={confirmation.cancelText}
        type={confirmation.type}
        onConfirm={() => confirmation.onConfirm?.()}
        onCancel={cancel}
      />
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50">
        {/* Header */}
        <header className="bg-white/80 backdrop-blur-sm shadow-sm border-b border-gray-200/50 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link
                to={`/${tenantSlug}/dashboard`}
                className="w-10 h-10 bg-gradient-to-br from-purple-600 to-pink-600 rounded-xl flex items-center justify-center shadow-lg hover:scale-105 transition-transform"
              >
                <ArrowLeft className="w-5 h-5 text-white" />
              </Link>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Medication Reminders</h1>
                <p className="text-sm text-gray-600">Manage your medication reminders</p>
              </div>
            </div>
            <button
              onClick={handleCreateReminder}
              className="px-4 py-2 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-xl hover:from-purple-700 hover:to-pink-700 transition-all flex items-center gap-2 shadow-lg"
            >
              <Plus className="w-5 h-5" />
              <span>New Reminder</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {error && (
          <div className="mb-6 p-4 bg-red-50 border-l-4 border-red-500 rounded-lg flex items-center gap-3">
            <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0" />
            <p className="text-sm font-medium text-red-800">{error}</p>
          </div>
        )}

        {reminders.length === 0 ? (
          <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-xl p-12 text-center border border-white/20">
            <div className="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-br from-purple-500 to-pink-600 rounded-full mb-6 shadow-lg">
              <Bell className="w-10 h-10 text-white" />
            </div>
            <h3 className="text-2xl font-bold text-gray-900 mb-2">No Reminders</h3>
            <p className="text-gray-600 mb-6">Create a reminder to never miss your medication</p>
            <button
              onClick={handleCreateReminder}
              className="px-6 py-3 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-xl hover:from-purple-700 hover:to-pink-700 transition-all shadow-lg"
            >
              Create Your First Reminder
            </button>
          </div>
        ) : (
          <div className="space-y-6">
            {reminders.map((reminder) => (
              <div
                key={reminder.id}
                className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-lg p-6 border border-white/20 hover:shadow-xl transition-all"
              >
                <div className="flex flex-col md:flex-row items-start gap-4">
                  <div className="w-16 h-16 bg-gradient-to-br from-purple-500 to-pink-600 rounded-xl flex items-center justify-center flex-shrink-0 shadow-lg">
                    <Bell className="w-8 h-8 text-white" />
                  </div>

                  <div className="flex-1 w-full">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
                      <div>
                        <h3 className="text-xl font-bold text-gray-900 mb-1">{reminder.medicationName}</h3>
                        <p className="text-sm text-gray-600">
                          {reminder.dosage} • {reminder.frequency}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <span
                          className={`px-3 py-1 rounded-full text-xs font-semibold ${
                            reminder.isActive
                              ? 'bg-green-100 text-green-800 border border-green-200'
                              : 'bg-gray-100 text-gray-800 border border-gray-200'
                          }`}
                        >
                          {reminder.isActive ? 'Active' : 'Inactive'}
                        </span>
                        <button
                          onClick={() => handleEditReminder(reminder)}
                          className="p-2 text-purple-600 hover:bg-purple-50 rounded-lg transition-colors"
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDeleteReminder(reminder.id)}
                          className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
                      <div className="bg-blue-50 rounded-xl p-4">
                        <p className="text-xs text-blue-600 mb-1 font-semibold flex items-center gap-2">
                          <Clock className="w-4 h-4" />
                          Reminder Time
                        </p>
                        <p className="font-bold text-blue-900">{reminder.reminderTime}</p>
                      </div>
                      <div className="bg-green-50 rounded-xl p-4">
                        <p className="text-xs text-green-600 mb-1 font-semibold">Notification Type</p>
                        <p className="font-bold text-green-900">{getReminderTypeLabel(reminder.reminderType)}</p>
                      </div>
                    </div>

                    <div className="mb-4">
                      <p className="text-xs text-gray-600 mb-2 font-semibold">Days of Week</p>
                      <div className="flex flex-wrap gap-2">
                        {DAYS_OF_WEEK.map((day) => (
                          <span
                            key={day.value}
                            className={`px-3 py-1 rounded-lg text-xs font-semibold ${
                              reminder.reminderDays?.includes(day.value)
                                ? 'bg-purple-100 text-purple-800 border border-purple-200'
                                : 'bg-gray-100 text-gray-500 border border-gray-200'
                            }`}
                          >
                            {day.short}
                          </span>
                        ))}
                      </div>
                    </div>

                    {reminder.nextSendAt && (
                      <div className="pt-4 border-t border-gray-200">
                        <p className="text-sm text-gray-600 flex items-center gap-2">
                          <Calendar className="w-4 h-4" />
                          Next reminder: {format(new Date(reminder.nextSendAt), 'MMM d, yyyy h:mm a')}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {/* Create/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full p-6 border border-gray-200 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-gray-900">
                {editingReminder ? 'Edit Reminder' : 'Create Reminder'}
              </h2>
              <button
                onClick={() => {
                  setShowModal(false);
                  setEditingReminder(null);
                  setFormData({
                    prescriptionId: '',
                    reminderTime: '09:00',
                    reminderDays: [],
                    reminderType: 'notification',
                    timezone: 'Africa/Harare',
                  });
                }}
                className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 transition-colors"
              >
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Medication</label>
                <select
                  value={formData.prescriptionId}
                  onChange={(e) => setFormData({ ...formData, prescriptionId: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  disabled={!!editingReminder}
                >
                  <option value="">Select medication</option>
                  {prescriptions
                    .filter((p) => p.status === 'active')
                    .map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.medicationName} ({p.dosage}, {p.frequency})
                      </option>
                    ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Reminder Time</label>
                <input
                  type="time"
                  value={formData.reminderTime}
                  onChange={(e) => setFormData({ ...formData, reminderTime: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Days of Week</label>
                <div className="grid grid-cols-7 gap-2">
                  {DAYS_OF_WEEK.map((day) => (
                    <button
                      key={day.value}
                      type="button"
                      onClick={() => toggleDay(day.value)}
                      className={`px-3 py-2 rounded-lg text-xs font-semibold transition-all ${
                        formData.reminderDays.includes(day.value)
                          ? 'bg-purple-600 text-white shadow-lg'
                          : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                      }`}
                    >
                      {day.short}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Notification Type</label>
                <select
                  value={formData.reminderType}
                  onChange={(e) => setFormData({ ...formData, reminderType: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                >
                  <option value="notification">In-App Notification</option>
                  <option value="sms">SMS</option>
                  <option value="email">Email</option>
                  <option value="push">Push Notification</option>
                  <option value="all">All (SMS + Email + Push)</option>
                </select>
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => {
                  setShowModal(false);
                  setEditingReminder(null);
                }}
                className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-xl hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveReminder}
                className="flex-1 px-4 py-2 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-xl hover:from-purple-700 hover:to-pink-700 transition-all flex items-center justify-center gap-2 shadow-lg"
              >
                <Save className="w-4 h-4" />
                <span>Save</span>
              </button>
            </div>
          </div>
        </div>
      )}
      </div>
    </>
  );
};

export default MedicationRemindersPage;

