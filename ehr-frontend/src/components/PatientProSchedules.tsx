import React, { useEffect, useState } from 'react';
import { Calendar, Clock, Repeat, Plus, Edit, Trash2, CheckCircle, XCircle } from 'lucide-react';
import { format } from 'date-fns';
import { ehrApi } from '../services/api';
import { useNotification } from './GlobalNotification';
import { useConfirmation } from '../hooks/useConfirmation';

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
  const [availableTemplates, setAvailableTemplates] = useState<any[]>([]);

  useEffect(() => {
    loadSchedules();
    loadTemplates();
  }, [patientId]);

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
      // This would need to be added to the API - for now, we'll use a placeholder
      // const response = await ehrApi.getQuestionnaireTemplates(token, tenantSlug);
      // setAvailableTemplates(response.data || []);
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
    </>
  );
};

export default PatientProSchedules;
