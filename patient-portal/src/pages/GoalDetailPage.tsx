import React, { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { usePatientAuth } from '../contexts/PatientAuthContext';
import { patientPortalApi } from '../services/api';
import { useTenantSlug } from '../hooks/useTenantSlug';
import { useNotification } from '../components/GlobalNotification';
import { ArrowLeft, Target, TrendingUp, Calendar, Award, Plus, Edit, Trash2 } from 'lucide-react';
import { format } from 'date-fns';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

const GoalDetailPage: React.FC = () => {
  const { goalId } = useParams<{ goalId: string }>();
  const { token } = usePatientAuth();
  const tenantSlug = useTenantSlug();
  const navigate = useNavigate();
  const { showError, showSuccess } = useNotification();

  const [goal, setGoal] = useState<any>(null);
  const [progressLogs, setProgressLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showLogForm, setShowLogForm] = useState(false);
  const [logFormData, setLogFormData] = useState({
    loggedValue: '',
    loggedDate: new Date().toISOString().split('T')[0],
    notes: '',
  });
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  useEffect(() => {
    if (goalId) {
      loadGoal();
      loadProgressLogs();
    }
  }, [goalId]);

  const loadGoal = async () => {
    try {
      const data = await patientPortalApi.getGoal(token!, tenantSlug, goalId!);
      setGoal(data);
    } catch (err: any) {
      console.error('Error loading goal:', err);
      showError('Failed to load goal', err.message || 'Please try again later');
      navigate(`/${tenantSlug}/goals`);
    } finally {
      setLoading(false);
    }
  };

  const loadProgressLogs = async () => {
    try {
      const data = await patientPortalApi.getProgressLogs(token!, tenantSlug, goalId!, 30);
      setProgressLogs(Array.isArray(data) ? data : []);
    } catch (err: any) {
      console.error('Error loading progress logs:', err);
    }
  };

  const handleLogProgress = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!logFormData.loggedValue) {
      showError('Validation Error', 'Please enter a value');
      return;
    }

    try {
      await patientPortalApi.logProgress(token!, tenantSlug, goalId!, {
        loggedValue: parseFloat(logFormData.loggedValue),
        loggedDate: logFormData.loggedDate,
        source: 'patient_portal',
        notes: logFormData.notes || undefined,
      });

      showSuccess('Progress logged successfully!', 'success');
      setShowLogForm(false);
      setLogFormData({ loggedValue: '', loggedDate: new Date().toISOString().split('T')[0], notes: '' });
      loadGoal();
      loadProgressLogs();
    } catch (err: any) {
      console.error('Error logging progress:', err);
      showError('Failed to log progress', err.message || 'Please try again later');
    }
  };

  const handleDelete = async () => {
    if (!showDeleteConfirm) {
      setShowDeleteConfirm(true);
      return;
    }

    try {
      await patientPortalApi.deleteGoal(token!, tenantSlug, goalId!);
      showSuccess('Goal deleted successfully', 'success');
      navigate(`/${tenantSlug}/goals`);
    } catch (err: any) {
      showError('Failed to delete goal', err.message || 'Please try again later');
    } finally {
      setShowDeleteConfirm(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 p-4 sm:p-6 lg:p-8">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center justify-center h-64">
            <div className="text-center">
              <div className="w-16 h-16 border-4 border-purple-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
              <p className="text-gray-600">Loading goal...</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!goal) return null;

  const chartData = progressLogs
    .sort((a, b) => new Date(a.logged_date).getTime() - new Date(b.logged_date).getTime())
    .map((log) => ({
      date: format(new Date(log.logged_date), 'MMM dd'),
      value: parseFloat(log.logged_value),
    }));

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 p-4 sm:p-6 lg:p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <Link
                to={`/${tenantSlug}/goals`}
                className="w-10 h-10 bg-gradient-to-br from-purple-600 to-blue-600 rounded-xl flex items-center justify-center shadow-lg hover:scale-105 transition-transform"
              >
                <ArrowLeft className="w-5 h-5 text-white" />
              </Link>
              <div className="w-12 h-12 bg-gradient-to-br from-purple-600 to-blue-600 rounded-xl flex items-center justify-center shadow-lg">
                <Target className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-3xl font-bold text-gray-900">{goal.goal_name}</h1>
                <p className="text-gray-600 mt-1">{goal.description || 'Health goal tracking'}</p>
              </div>
            </div>
            {goal.status === 'active' && (
              <div className="flex gap-2">
                <button
                  onClick={() => navigate(`/${tenantSlug}/goals/${goalId}/edit`)}
                  className="px-4 py-2 bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 transition-colors flex items-center gap-2"
                >
                  <Edit className="w-4 h-4" />
                  Edit
                </button>
                {showDeleteConfirm ? (
                  <div className="flex gap-2">
                    <button
                      onClick={handleDelete}
                      className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors flex items-center gap-2"
                    >
                      <Trash2 className="w-4 h-4" />
                      Confirm Delete
                    </button>
                    <button
                      onClick={() => setShowDeleteConfirm(false)}
                      className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={handleDelete}
                    className="px-4 py-2 bg-red-100 text-red-700 rounded-lg hover:bg-red-200 transition-colors flex items-center gap-2"
                  >
                    <Trash2 className="w-4 h-4" />
                    Delete
                  </button>
                )}
              </div>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-6">
            {/* Progress Chart */}
            {chartData.length > 0 && (
              <div className="bg-white rounded-2xl shadow-sm p-6 border border-gray-200">
                <h3 className="text-lg font-bold text-gray-900 mb-6 flex items-center gap-2">
                  <TrendingUp className="w-5 h-5" />
                  Progress Over Time
                </h3>
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                    <XAxis dataKey="date" stroke="#6b7280" style={{ fontSize: '12px' }} />
                    <YAxis stroke="#6b7280" style={{ fontSize: '12px' }} />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: 'white',
                        border: '1px solid #e5e7eb',
                        borderRadius: '8px',
                        padding: '12px',
                      }}
                    />
                    <Legend />
                    <Line
                      type="monotone"
                      dataKey="value"
                      stroke="#8b5cf6"
                      strokeWidth={2}
                      dot={{ fill: '#8b5cf6', r: 4 }}
                      activeDot={{ r: 6 }}
                      name={`Value (${goal.unit || ''})`}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}

            {/* Progress Logs */}
            <div className="bg-white rounded-2xl shadow-sm p-6 border border-gray-200">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-bold text-gray-900">Progress History</h3>
                {goal.status === 'active' && (
                  <button
                    onClick={() => setShowLogForm(!showLogForm)}
                    className="px-4 py-2 bg-gradient-to-r from-purple-600 to-blue-600 text-white rounded-lg hover:from-purple-700 hover:to-blue-700 transition-all flex items-center gap-2 text-sm font-semibold"
                  >
                    <Plus className="w-4 h-4" />
                    Log Progress
                  </button>
                )}
              </div>

              {showLogForm && (
                <form onSubmit={handleLogProgress} className="mb-6 p-4 bg-purple-50 rounded-lg border border-purple-200">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-1">Value</label>
                      <input
                        type="number"
                        step="0.01"
                        value={logFormData.loggedValue}
                        onChange={(e) => setLogFormData({ ...logFormData, loggedValue: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-600"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-1">Date</label>
                      <input
                        type="date"
                        value={logFormData.loggedDate}
                        onChange={(e) => setLogFormData({ ...logFormData, loggedDate: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-600"
                        required
                      />
                    </div>
                    <div className="flex items-end">
                      <button
                        type="submit"
                        className="w-full px-4 py-2 bg-gradient-to-r from-purple-600 to-blue-600 text-white rounded-lg hover:from-purple-700 hover:to-blue-700 transition-all font-semibold"
                      >
                        Save
                      </button>
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1">Notes</label>
                    <textarea
                      value={logFormData.notes}
                      onChange={(e) => setLogFormData({ ...logFormData, notes: e.target.value })}
                      rows={2}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-600"
                    />
                  </div>
                </form>
              )}

              {progressLogs.length === 0 ? (
                <p className="text-gray-500 text-center py-8">No progress logged yet</p>
              ) : (
                <div className="space-y-3">
                  {progressLogs.map((log) => (
                    <div key={log.id} className="p-4 bg-gray-50 rounded-lg border border-gray-200">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-semibold text-gray-900">
                            {log.logged_value} {goal.unit || ''}
                          </p>
                          <p className="text-sm text-gray-600">
                            {format(new Date(log.logged_date), 'MMM dd, yyyy')}
                          </p>
                        </div>
                        {log.notes && (
                          <p className="text-sm text-gray-600">{log.notes}</p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Goal Info */}
            <div className="bg-white rounded-2xl shadow-sm p-6 border border-gray-200">
              <h3 className="text-lg font-bold text-gray-900 mb-4">Goal Details</h3>
              <div className="space-y-4">
                <div>
                  <p className="text-sm text-gray-600">Status</p>
                  <p className="font-semibold text-gray-900 capitalize">{goal.status}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Start Date</p>
                  <p className="font-semibold text-gray-900">
                    {format(new Date(goal.start_date), 'MMM dd, yyyy')}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Target Date</p>
                  <p className="font-semibold text-gray-900">
                    {format(new Date(goal.target_date), 'MMM dd, yyyy')}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Current Value</p>
                  <p className="font-semibold text-gray-900">
                    {goal.current_value || 'N/A'} {goal.unit || ''}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Target Value</p>
                  <p className="font-semibold text-gray-900">
                    {goal.target_value} {goal.unit || ''}
                  </p>
                </div>
              </div>
            </div>

            {/* Progress */}
            <div className="bg-white rounded-2xl shadow-sm p-6 border border-gray-200">
              <h3 className="text-lg font-bold text-gray-900 mb-4">Progress</h3>
              <div className="mb-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-semibold text-gray-700">Overall</span>
                  <span className="text-lg font-bold text-purple-600">
                    {goal.progress_percentage.toFixed(1)}%
                  </span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-4 overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-purple-600 to-blue-600 rounded-full transition-all duration-500"
                    style={{ width: `${Math.min(goal.progress_percentage, 100)}%` }}
                  ></div>
                </div>
              </div>
              {goal.milestone_achieved && (
                <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg flex items-center gap-2">
                  <Award className="w-5 h-5 text-yellow-600" />
                  <span className="text-sm font-semibold text-yellow-800">
                    Milestone Reached!
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default GoalDetailPage;

