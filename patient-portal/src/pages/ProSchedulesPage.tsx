import React, { useEffect, useState } from 'react';
import { usePatientAuth } from '../contexts/PatientAuthContext';
import { patientPortalApi } from '../services/api';
import { useTenantSlug } from '../hooks/useTenantSlug';
import { useNotification } from '../components/GlobalNotification';
import {
  Calendar, Clock, Repeat, ArrowLeft, CheckCircle,
} from 'lucide-react';
import { format } from 'date-fns';
import { Link } from 'react-router-dom';

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

const ProSchedulesPage: React.FC = () => {
  const { token } = usePatientAuth();
  const tenantSlug = useTenantSlug();
  const { showError } = useNotification();
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadSchedules();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const loadSchedules = async () => {
    try {
      setLoading(true);
      const data = await patientPortalApi.getQuestionnaireSchedules(token!, tenantSlug);
      setSchedules(Array.isArray(data) ? data : []);
    } catch (err: any) {
      console.error('Error loading schedules:', err);
      showError('Failed to load schedules', err.message || 'Please try again later');
    } finally {
      setLoading(false);
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
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 p-4 sm:p-6 lg:p-8">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center justify-center h-64">
            <div className="text-center">
              <div className="w-16 h-16 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
              <p className="text-gray-600">Loading schedules...</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 p-4 sm:p-6 lg:p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-4">
            <Link
              to={`/${tenantSlug}/dashboard`}
              className="w-10 h-10 bg-gradient-to-br from-purple-600 to-blue-600 rounded-xl flex items-center justify-center shadow-lg hover:scale-105 transition-transform"
            >
              <ArrowLeft className="w-5 h-5 text-white" />
            </Link>
            <div className="w-12 h-12 bg-gradient-to-br from-purple-600 to-blue-600 rounded-xl flex items-center justify-center shadow-lg">
              <Calendar className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Questionnaire Schedules</h1>
              <p className="text-gray-600 mt-1">View your scheduled health questionnaires</p>
            </div>
          </div>
        </div>

        {/* Schedules List */}
        {schedules.length === 0 ? (
          <div className="bg-white rounded-2xl shadow-sm p-12 text-center border border-gray-200">
            <Calendar className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-gray-900 mb-2">No Scheduled Questionnaires</h3>
            <p className="text-gray-600">
              Your care team hasn't set up any scheduled questionnaires yet. Questionnaires will appear here when they are scheduled.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {schedules.map((schedule) => (
              <div
                key={schedule.id}
                className="bg-white rounded-2xl shadow-sm p-6 border border-gray-200 hover:shadow-md transition-shadow"
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="text-xl font-bold text-gray-900">{schedule.questionnaire_name}</h3>
                      <span
                        className={`px-3 py-1 rounded-full text-xs font-semibold ${
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
                          'Inactive'
                        )}
                      </span>
                    </div>
                    {schedule.questionnaire_description && (
                      <p className="text-gray-600 text-sm mb-3">{schedule.questionnaire_description}</p>
                    )}
                    <div className="flex flex-wrap items-center gap-4 text-sm text-gray-600">
                      <div className="flex items-center gap-1">
                        <Repeat className="w-4 h-4" />
                        <span className="font-semibold">{getScheduleTypeLabel(schedule.schedule_type)}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Clock className="w-4 h-4" />
                        <span>{getScheduleDescription(schedule)}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Calendar className="w-4 h-4" />
                        <span>
                          Starts: {format(new Date(schedule.start_date), 'MMM dd, yyyy')}
                          {schedule.end_date && ` - Ends: ${format(new Date(schedule.end_date), 'MMM dd, yyyy')}`}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default ProSchedulesPage;

