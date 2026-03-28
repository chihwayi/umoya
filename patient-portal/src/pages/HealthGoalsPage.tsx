import React, { useEffect, useState } from 'react';
import { usePatientAuth } from '../contexts/PatientAuthContext';
import { patientPortalApi } from '../services/api';
import { useTenantSlug } from '../hooks/useTenantSlug';
import { useNotification } from '../components/GlobalNotification';
import { Link, useNavigate } from 'react-router-dom';
import {
  Target, Calendar, Award, Plus, Edit, Trash2, ArrowLeft, CheckCircle, Clock, XCircle,
} from 'lucide-react';
import { format } from 'date-fns';

interface Goal {
  id: string;
  goal_type: string;
  goal_name: string;
  description?: string;
  target_value: number;
  current_value: number;
  unit?: string;
  start_date: string;
  target_date: string;
  status: string;
  progress_percentage: number;
  milestone_percentage: number;
  milestone_achieved: boolean;
}

const HealthGoalsPage: React.FC = () => {
  const { token } = usePatientAuth();
  const tenantSlug = useTenantSlug();
  const navigate = useNavigate();
  const { showError, showSuccess } = useNotification();
  const [goals, setGoals] = useState<Goal[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'all' | 'active' | 'completed'>('all');
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  useEffect(() => {
    loadGoals();
  }, [activeTab]); // eslint-disable-line react-hooks/exhaustive-deps

  const loadGoals = async () => {
    try {
      setLoading(true);
      const status = activeTab === 'all' ? undefined : activeTab;
      const data = await patientPortalApi.getGoals(token!, tenantSlug, status);
      setGoals(Array.isArray(data) ? data : []);
    } catch (err: any) {
      console.error('Error loading goals:', err);
      showError('Failed to load goals', err.message || 'Please try again later');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (goalId: string) => {
    if (deleteConfirmId !== goalId) {
      setDeleteConfirmId(goalId);
      return;
    }

    try {
      await patientPortalApi.deleteGoal(token!, tenantSlug, goalId);
      showSuccess('Goal deleted successfully', 'success');
      loadGoals();
    } catch (err: any) {
      showError('Failed to delete goal', err.message || 'Please try again later');
    } finally {
      setDeleteConfirmId(null);
    }
  };

  const getGoalTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      weight_loss: 'Weight Loss',
      weight_gain: 'Weight Gain',
      blood_pressure: 'Blood Pressure',
      blood_glucose: 'Blood Glucose',
      cholesterol: 'Cholesterol',
      exercise: 'Exercise',
      medication_adherence: 'Medication Adherence',
      smoking_cessation: 'Smoking Cessation',
      alcohol_reduction: 'Alcohol Reduction',
      diet: 'Diet',
      other: 'Other',
    };
    return labels[type] || type;
  };

  const getStatusBadge = (status: string) => {
    const badges: Record<string, { bg: string; text: string; icon: any }> = {
      active: { bg: 'bg-green-100', text: 'text-green-800', icon: CheckCircle },
      completed: { bg: 'bg-blue-100', text: 'text-blue-800', icon: Award },
      paused: { bg: 'bg-yellow-100', text: 'text-yellow-800', icon: Clock },
      cancelled: { bg: 'bg-gray-100', text: 'text-gray-800', icon: XCircle },
      failed: { bg: 'bg-red-100', text: 'text-red-800', icon: XCircle },
    };
    return badges[status] || badges.active;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 p-4 sm:p-6 lg:p-8">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center justify-center h-64">
            <div className="text-center">
              <div className="w-16 h-16 border-4 border-purple-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
              <p className="text-gray-600">Loading goals...</p>
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
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <Link
                to={`/${tenantSlug}/dashboard`}
                className="w-10 h-10 bg-gradient-to-br from-purple-600 to-blue-600 rounded-xl flex items-center justify-center shadow-lg hover:scale-105 transition-transform"
              >
                <ArrowLeft className="w-5 h-5 text-white" />
              </Link>
              <div className="w-12 h-12 bg-gradient-to-br from-purple-600 to-blue-600 rounded-xl flex items-center justify-center shadow-lg">
                <Target className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-3xl font-bold text-gray-900">Health Goals</h1>
                <p className="text-gray-600 mt-1">Track your progress towards better health</p>
              </div>
            </div>
            <Link
              to={`/${tenantSlug}/goals/new`}
              className="px-6 py-3 bg-gradient-to-r from-purple-600 to-blue-600 text-white rounded-xl hover:from-purple-700 hover:to-blue-700 transition-all flex items-center gap-2 shadow-lg font-semibold"
            >
              <Plus className="w-5 h-5" />
              New Goal
            </Link>
          </div>

          {/* Tabs */}
          <div className="flex gap-2 border-b border-gray-200">
            <button
              onClick={() => setActiveTab('all')}
              className={`px-6 py-3 font-semibold transition-colors border-b-2 ${
                activeTab === 'all'
                  ? 'border-purple-600 text-purple-600'
                  : 'border-transparent text-gray-600 hover:text-gray-900'
              }`}
            >
              All Goals
            </button>
            <button
              onClick={() => setActiveTab('active')}
              className={`px-6 py-3 font-semibold transition-colors border-b-2 ${
                activeTab === 'active'
                  ? 'border-purple-600 text-purple-600'
                  : 'border-transparent text-gray-600 hover:text-gray-900'
              }`}
            >
              Active
            </button>
            <button
              onClick={() => setActiveTab('completed')}
              className={`px-6 py-3 font-semibold transition-colors border-b-2 ${
                activeTab === 'completed'
                  ? 'border-purple-600 text-purple-600'
                  : 'border-transparent text-gray-600 hover:text-gray-900'
              }`}
            >
              Completed
            </button>
          </div>
        </div>

        {/* Goals List */}
        {goals.length === 0 ? (
          <div className="bg-white rounded-2xl shadow-sm p-12 text-center border border-gray-200">
            <Target className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-gray-900 mb-2">No Goals Yet</h3>
            <p className="text-gray-600 mb-6">
              {activeTab === 'completed' 
                ? "You haven't completed any goals yet. Keep working towards your active goals!"
                : "Start your health journey by setting your first goal."}
            </p>
            {activeTab !== 'completed' && (
              <Link
                to={`/${tenantSlug}/goals/new`}
                className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-purple-600 to-blue-600 text-white rounded-xl hover:from-purple-700 hover:to-blue-700 transition-all shadow-lg font-semibold"
              >
                <Plus className="w-5 h-5" />
                Create Your First Goal
              </Link>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {goals.map((goal) => {
              const statusBadge = getStatusBadge(goal.status);
              const StatusIcon = statusBadge.icon;

              return (
                <div
                  key={goal.id}
                  className="bg-white rounded-2xl shadow-sm p-6 border border-gray-200 hover:shadow-md transition-shadow"
                >
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <h3 className="text-xl font-bold text-gray-900">{goal.goal_name}</h3>
                        <span className={`px-3 py-1 rounded-full text-xs font-semibold flex items-center gap-1 ${statusBadge.bg} ${statusBadge.text}`}>
                          <StatusIcon className="w-3 h-3" />
                          {goal.status.charAt(0).toUpperCase() + goal.status.slice(1)}
                        </span>
                      </div>
                      {goal.description && (
                        <p className="text-gray-600 text-sm mb-3">{goal.description}</p>
                      )}
                      <div className="flex items-center gap-4 text-sm text-gray-600 mb-4">
                        <div className="flex items-center gap-1">
                          <Calendar className="w-4 h-4" />
                          <span>Target: {format(new Date(goal.target_date), 'MMM dd, yyyy')}</span>
                        </div>
                        <span className="px-2 py-1 bg-purple-100 text-purple-800 rounded text-xs font-semibold">
                          {getGoalTypeLabel(goal.goal_type)}
                        </span>
                      </div>
                    </div>
                    {goal.status === 'active' && (
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => navigate(`/${tenantSlug}/goals/${goal.id}/edit`)}
                          className="p-2 rounded-lg bg-blue-100 text-blue-700 hover:bg-blue-200 transition-colors"
                          title="Edit"
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                        {deleteConfirmId === goal.id ? (
                          <div className="flex gap-1">
                            <button
                              onClick={() => handleDelete(goal.id)}
                              className="p-2 rounded-lg bg-red-600 text-white hover:bg-red-700 transition-colors"
                              title="Confirm Delete"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => setDeleteConfirmId(null)}
                              className="p-2 rounded-lg bg-gray-100 text-gray-700 hover:bg-gray-200 transition-colors"
                              title="Cancel"
                            >
                              ×
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => handleDelete(goal.id)}
                            className="p-2 rounded-lg bg-red-100 text-red-700 hover:bg-red-200 transition-colors"
                            title="Delete"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Progress Bar */}
                  <div className="mb-4">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-semibold text-gray-700">Progress</span>
                      <span className="text-sm font-bold text-purple-600">{goal.progress_percentage.toFixed(1)}%</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-purple-600 to-blue-600 rounded-full transition-all duration-500"
                        style={{ width: `${Math.min(goal.progress_percentage, 100)}%` }}
                      ></div>
                    </div>
                    <div className="flex items-center justify-between mt-2 text-xs text-gray-600">
                      <span>
                        Current: {goal.current_value} {goal.unit || ''}
                      </span>
                      <span>
                        Target: {goal.target_value} {goal.unit || ''}
                      </span>
                    </div>
                  </div>

                  {/* Milestone Badge */}
                  {goal.milestone_achieved && (
                    <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg flex items-center gap-2">
                      <Award className="w-5 h-5 text-yellow-600" />
                      <span className="text-sm font-semibold text-yellow-800">
                        Milestone Reached! {goal.milestone_percentage}% progress achieved
                      </span>
                    </div>
                  )}

                  {/* Actions */}
                  {goal.status === 'active' && (
                    <div className="mt-4 flex gap-2">
                      <button
                        onClick={() => navigate(`/${tenantSlug}/goals/${goal.id}/progress`)}
                        className="flex-1 px-4 py-2 bg-gradient-to-r from-purple-600 to-blue-600 text-white rounded-lg hover:from-purple-700 hover:to-blue-700 transition-all text-sm font-semibold"
                      >
                        Log Progress
                      </button>
                      <button
                        onClick={() => navigate(`/${tenantSlug}/goals/${goal.id}`)}
                        className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors text-sm font-semibold"
                      >
                        View Details
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default HealthGoalsPage;

