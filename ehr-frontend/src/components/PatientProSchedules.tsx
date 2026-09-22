import React, { useEffect, useState } from 'react';
import { Calendar, Clock, Repeat, Plus, Edit, Trash2, CheckCircle, XCircle } from 'lucide-react';
import { format } from 'date-fns';
import { ehrApi } from '../services/api';
import { useNotification } from './GlobalNotification';
import { useConfirmation } from '../hooks/useConfirmation';
import { noNativeButtonBackground } from '../hooks/useNoNativeButtonBackground';

interface Schedule {
  id: string;
  questionnaire_code: string;
  questionnaire_name: string;
  questionnaire_description?: string;
  category: string;
  schedule_type: 'one_time' | 'daily' | 'weekly' | 'monthly' | 'event_triggered';
  start_date: string;
  end_date?: string;
  frequency: number;
  day_of_week?: number;
  day_of_month?: number;
  trigger_event?: string;
  is_active: boolean;
  created_at: string;
}

interface QuestionnaireTemplate {
  id: string;
  code: string;
  name: string;
  category?: string;
  is_active: boolean;
  is_standard: boolean;
}

interface PatientProSchedulesProps {
  patientId: string;
  tenantSlug: string;
  token: string;
  onScheduleCreated?: () => void;
}

const PatientProSchedules: React.FC<PatientProSchedulesProps> = ({
  patientId,
  tenantSlug,
  token,
  onScheduleCreated,
}) => {
  const { showError, showSuccess } = useNotification();
  const { confirm, Dialog } = useConfirmation();
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingSchedule, setEditingSchedule] = useState<Schedule | null>(null);
  const [availableTemplates, setAvailableTemplates] = useState<QuestionnaireTemplate[]>([]);
  const [creating, setCreating] = useState(false);
  const [formTemplateId, setFormTemplateId] = useState('');
  const [formScheduleType, setFormScheduleType] = useState<Schedule['schedule_type']>('one_time');
  const [formStartDate, setFormStartDate] = useState('');
  const [formEndDate, setFormEndDate] = useState('');
  const [formFrequency, setFormFrequency] = useState(1);
  const [formDayOfWeek, setFormDayOfWeek] = useState(1);
  const [formDayOfMonth, setFormDayOfMonth] = useState(1);
  const [formTriggerEvent, setFormTriggerEvent] = useState('');

  useEffect(() => {
    loadSchedules();
    loadTemplates();
  }, [patientId]);

  const resetForm = () => {
    setFormTemplateId('');
    setFormScheduleType('one_time');
    setFormStartDate('');
    setFormEndDate('');
    setFormFrequency(1);
    setFormDayOfWeek(1);
    setFormDayOfMonth(1);
    setFormTriggerEvent('');
  };

  const handleCreateSchedule = async () => {
    if (!formTemplateId || !formStartDate) {
      showError('Missing required fields', 'Select a questionnaire and start date');
      return;
    }
    try {
      setCreating(true);
      await ehrApi.createProSchedule(patientId, {
        templateId: formTemplateId,
        scheduleType: formScheduleType,
        startDate: formStartDate,
        endDate: formEndDate || undefined,
        frequency: formScheduleType === 'daily' || formScheduleType === 'weekly' || formScheduleType === 'monthly' ? formFrequency : undefined,
        dayOfWeek: formScheduleType === 'weekly' ? formDayOfWeek : undefined,
        dayOfMonth: formScheduleType === 'monthly' ? formDayOfMonth : undefined,
        triggerEvent: formScheduleType === 'event_triggered' ? formTriggerEvent : undefined,
      }, token, tenantSlug);
      showSuccess('Schedule created successfully', 'success');
      setShowCreateModal(false);
      resetForm();
      loadSchedules();
      onScheduleCreated?.();
    } catch (err: any) {
      showError('Failed to create schedule', err.response?.data?.message || err.message || 'Please try again later');
    } finally {
      setCreating(false);
    }
  };

  const loadSchedules = async () => {
    try {
      setLoading(true);
      const response = await ehrApi.getPatientProSchedules(patientId, token, tenantSlug);
      setSchedules(Array.isArray(response.data) ? response.data : []);
    } catch (err: any) {
      console.error('Error loading schedules:', err);
      showError('Failed to load schedules', err.message || 'Please try again later');
    } finally {
      setLoading(false);
    }
  };

  const loadTemplates = async () => {
    try {
      const response = await ehrApi.getProTemplates(token, tenantSlug);
      const templates = Array.isArray(response.data) ? response.data : [];
      setAvailableTemplates(templates.filter((t: QuestionnaireTemplate) => t.is_active));
    } catch (err: any) {
      console.error('Error loading templates:', err);
    }
  };

  const handleDelete = async (scheduleId: string) => {
    const shouldProceed = await confirm({
      title: 'Delete Schedule',
      message: 'Are you sure you want to delete this schedule?',
      confirmText: 'Delete',
      cancelText: 'Keep',
      type: 'danger',
    });
    if (!shouldProceed) return;

    try {
      await ehrApi.deleteProSchedule(scheduleId, token, tenantSlug);
      showSuccess('Schedule deleted successfully', 'success');
      loadSchedules();
    } catch (err: any) {
      showError('Failed to delete schedule', err.message || 'Please try again later');
    }
  };

  const handleToggleActive = async (schedule: Schedule) => {
    try {
      await ehrApi.updateProSchedule(schedule.id, { isActive: !schedule.is_active }, token, tenantSlug);
      showSuccess(`Schedule ${!schedule.is_active ? 'activated' : 'deactivated'} successfully`, 'success');
      loadSchedules();
    } catch (err: any) {
      showError('Failed to update schedule', err.message || 'Please try again later');
    }
  };

  const getScheduleTypeLabel = (type: string) => {
    switch (type) {
      case 'one_time':
        return 'One Time';
      case 'daily':
        return 'Daily';
      case 'weekly':
        return 'Weekly';
      case 'monthly':
        return 'Monthly';
      case 'event_triggered':
        return 'Event Triggered';
      default:
        return type;
    }
  };

  const getScheduleDescription = (schedule: Schedule) => {
    switch (schedule.schedule_type) {
      case 'daily':
        return `Every ${schedule.frequency} day(s)`;
      case 'weekly':
        const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
        return `Every ${schedule.frequency} week(s) on ${days[schedule.day_of_week || 0]}`;
      case 'monthly':
        return `Every ${schedule.frequency} month(s) on day ${schedule.day_of_month}`;
      case 'one_time':
        return `One time on ${format(new Date(schedule.start_date), 'MMM dd, yyyy')}`;
      case 'event_triggered':
        return `Triggered by: ${schedule.trigger_event || 'Event'}`;
      default:
        return '';
    }
  };

  if (loading) {
    return (
      <div className="bg-white/70 backdrop-blur-sm rounded-2xl border border-slate-200/50 p-6">
        <div className="flex items-center justify-center h-32">
          <div className="text-center">
            <div className="w-8 h-8 border-4 border-purple-600 border-t-transparent rounded-full animate-spin mx-auto mb-2"></div>
            <p className="text-slate-600 text-sm">Loading schedules...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      {Dialog}
      <div className="bg-white/70 backdrop-blur-sm rounded-2xl border border-slate-200/50 p-6">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-semibold text-slate-800 flex items-center gap-2">
          <Calendar className="w-5 h-5" />
          Questionnaire Schedules
        </h3>
        <button
          onClick={() => setShowCreateModal(true)}
          className="px-4 py-2 bg-gradient-to-r from-purple-600 to-blue-600 text-white rounded-lg hover:from-purple-700 hover:to-blue-700 transition-all flex items-center gap-2 text-sm font-semibold"
        >
          <Plus className="w-4 h-4" />
          New Schedule
        </button>
      </div>

      {schedules.length === 0 ? (
        <div className="text-center py-8">
          <Calendar className="w-12 h-12 text-slate-400 mx-auto mb-3" />
          <p className="text-slate-600">No schedules configured for this patient</p>
        </div>
      ) : (
        <div className="space-y-3">
          {schedules.map((schedule) => (
            <div
              key={schedule.id}
              className="p-4 bg-slate-50 rounded-lg border border-slate-200 hover:border-purple-300 transition-colors"
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <h4 className="font-semibold text-slate-800">{schedule.questionnaire_name}</h4>
                    <span
                      className={`px-2 py-1 rounded text-xs font-semibold ${
                        schedule.is_active
                          ? 'bg-green-100 text-green-800 border border-green-300'
                          : 'bg-gray-100 text-gray-800 border border-gray-300'
                      }`}
                    >
                      {schedule.is_active ? (
                        <span className="flex items-center gap-1">
                          <CheckCircle className="w-3 h-3" /> Active
                        </span>
                      ) : (
                        <span className="flex items-center gap-1">
                          <XCircle className="w-3 h-3" /> Inactive
                        </span>
                      )}
                    </span>
                  </div>
                  <div className="flex flex-wrap items-center gap-3 text-sm text-slate-600">
                    <div className="flex items-center gap-1">
                      <Repeat className="w-4 h-4" />
                      <span className="font-medium">{getScheduleTypeLabel(schedule.schedule_type)}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Clock className="w-4 h-4" />
                      <span>{getScheduleDescription(schedule)}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Calendar className="w-4 h-4" />
                      <span>
                        {format(new Date(schedule.start_date), 'MMM dd, yyyy')}
                        {schedule.end_date && ` - ${format(new Date(schedule.end_date), 'MMM dd, yyyy')}`}
                      </span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2 ml-4">
                  <button
                    onClick={() => handleToggleActive(schedule)}
                    className={`p-2 rounded-lg transition-colors ${
                      schedule.is_active
                        ? 'bg-yellow-100 text-yellow-700 hover:bg-yellow-200'
                        : 'bg-green-100 text-green-700 hover:bg-green-200'
                    }`}
                    title={schedule.is_active ? 'Deactivate' : 'Activate'}
                  >
                    {schedule.is_active ? <XCircle className="w-4 h-4" /> : <CheckCircle className="w-4 h-4" />}
                  </button>
                  <button
                    onClick={() => handleDelete(schedule.id)}
                    className="p-2 rounded-lg bg-red-100 text-red-700 hover:bg-red-200 transition-colors"
                    title="Delete"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
      </div>

      {showCreateModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-gradient-to-r from-purple-600 to-blue-600 text-white p-5 flex items-center justify-between z-10">
              <h3 className="text-lg font-bold">New Questionnaire Schedule</h3>
              <button
                ref={noNativeButtonBackground}
                onClick={() => { setShowCreateModal(false); resetForm(); }}
                className="appearance-none p-1 hover:bg-white/20 rounded-lg transition-colors"
              >
                <XCircle className="w-6 h-6" />
              </button>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Questionnaire</label>
                <select
                  value={formTemplateId}
                  onChange={(e) => setFormTemplateId(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                >
                  <option value="">Select a questionnaire...</option>
                  {availableTemplates.map((t) => (
                    <option key={t.id} value={t.id}>{t.name} ({t.code})</option>
                  ))}
                </select>
                {availableTemplates.length === 0 && (
                  <p className="text-xs text-slate-500 mt-1">No active questionnaire templates found.</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Schedule Type</label>
                <select
                  value={formScheduleType}
                  onChange={(e) => setFormScheduleType(e.target.value as Schedule['schedule_type'])}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                >
                  <option value="one_time">One Time</option>
                  <option value="daily">Daily</option>
                  <option value="weekly">Weekly</option>
                  <option value="monthly">Monthly</option>
                  <option value="event_triggered">Event Triggered</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Start Date</label>
                  <input
                    type="date"
                    value={formStartDate}
                    onChange={(e) => setFormStartDate(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">End Date (optional)</label>
                  <input
                    type="date"
                    value={formEndDate}
                    onChange={(e) => setFormEndDate(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                  />
                </div>
              </div>

              {(formScheduleType === 'daily' || formScheduleType === 'weekly' || formScheduleType === 'monthly') && (
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Repeat every {formFrequency} {formScheduleType === 'daily' ? 'day(s)' : formScheduleType === 'weekly' ? 'week(s)' : 'month(s)'}
                  </label>
                  <input
                    type="number"
                    min={1}
                    value={formFrequency}
                    onChange={(e) => setFormFrequency(Math.max(1, parseInt(e.target.value) || 1))}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                  />
                </div>
              )}

              {formScheduleType === 'weekly' && (
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Day of Week</label>
                  <select
                    value={formDayOfWeek}
                    onChange={(e) => setFormDayOfWeek(parseInt(e.target.value))}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                  >
                    {['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'].map((d, i) => (
                      <option key={i} value={i}>{d}</option>
                    ))}
                  </select>
                </div>
              )}

              {formScheduleType === 'monthly' && (
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Day of Month</label>
                  <input
                    type="number"
                    min={1}
                    max={31}
                    value={formDayOfMonth}
                    onChange={(e) => setFormDayOfMonth(Math.min(31, Math.max(1, parseInt(e.target.value) || 1)))}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                  />
                </div>
              )}

              {formScheduleType === 'event_triggered' && (
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Trigger Event</label>
                  <input
                    type="text"
                    value={formTriggerEvent}
                    onChange={(e) => setFormTriggerEvent(e.target.value)}
                    placeholder="e.g. appointment_scheduled, medication_started"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                  />
                </div>
              )}
            </div>
            <div className="sticky bottom-0 bg-white border-t border-slate-200 p-4 flex items-center justify-end gap-3">
              <button
                ref={noNativeButtonBackground}
                onClick={() => { setShowCreateModal(false); resetForm(); }}
                className="appearance-none px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateSchedule}
                disabled={creating || !formTemplateId || !formStartDate}
                className="px-4 py-2 bg-gradient-to-r from-purple-600 to-blue-600 text-white rounded-lg hover:from-purple-700 hover:to-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all text-sm font-semibold"
              >
                {creating ? 'Creating...' : 'Create Schedule'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default PatientProSchedules;
