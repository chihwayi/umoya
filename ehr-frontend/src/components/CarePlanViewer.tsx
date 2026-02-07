import React, { useState, useEffect } from 'react';
import { X, Edit, CheckCircle, XCircle, Clock, Target, Activity, TrendingUp, Calendar, User, Plus } from 'lucide-react';
import { ehrApi } from '../services/api';
import { useNotification } from './GlobalNotification';
import CarePlanProgress from './CarePlanProgress';

interface CarePlan {
  id: string;
  patient_id: string;
  name: string;
  description: string;
  category: string;
  status: string;
  start_date: string;
  end_date?: string;
  target_completion_date?: string;
  primary_provider_id?: string;
  care_team: any[];
  diagnosis_codes: string[];
  notes: string;
  goals: Goal[];
  interventions: Intervention[];
  created_at: string;
  updated_at: string;
}

interface Goal {
  id: string;
  goal_number: number;
  goal_text: string;
  goal_type: string;
  target_value?: string;
  current_value?: string;
  measurement_unit?: string;
  target_date?: string;
  status: string;
  priority: string;
  notes?: string;
}

interface Intervention {
  id: string;
  goal_id?: string;
  intervention_number: number;
  intervention_text: string;
  intervention_type: string;
  frequency?: string;
  duration?: string;
  responsible_role?: string;
  assigned_to?: string;
  status: string;
  start_date?: string;
  end_date?: string;
  completion_date?: string;
  outcome_notes?: string;
}

interface CarePlanViewerProps {
  carePlanId: string;
  tenantSlug: string;
  token: string;
  onClose: () => void;
  onEdit?: () => void;
}

const CarePlanViewer: React.FC<CarePlanViewerProps> = ({
  carePlanId,
  tenantSlug,
  token,
  onClose,
  onEdit,
}) => {
  const [carePlan, setCarePlan] = useState<CarePlan | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'overview' | 'goals' | 'interventions' | 'progress'>('overview');
  const [showProgressModal, setShowProgressModal] = useState(false);
  const { showError, showSuccess } = useNotification();

  useEffect(() => {
    loadCarePlan();
  }, [carePlanId]);

  const loadCarePlan = async () => {
    try {
      setLoading(true);
      const response = await ehrApi.getCarePlanById(carePlanId, token, tenantSlug);
      setCarePlan(response.data);
    } catch (error: any) {
      console.error('Failed to load care plan:', error);
      showError('Error', 'Failed to load care plan details');
    } finally {
      setLoading(false);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
      case 'achieved':
        return <CheckCircle className="w-5 h-5 text-green-600" />;
      case 'failed':
      case 'not_achieved':
        return <XCircle className="w-5 h-5 text-red-600" />;
      case 'in_progress':
      case 'active':
        return <Activity className="w-5 h-5 text-blue-600" />;
      case 'pending':
      case 'not_started':
        return <Clock className="w-5 h-5 text-yellow-600" />;
      default:
        return <Clock className="w-5 h-5 text-gray-600" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
      case 'achieved':
        return 'bg-green-100 text-green-800 border-green-300';
      case 'failed':
      case 'not_achieved':
      case 'cancelled':
        return 'bg-red-100 text-red-800 border-red-300';
      case 'in_progress':
      case 'active':
        return 'bg-blue-100 text-blue-800 border-blue-300';
      case 'pending':
      case 'not_started':
      case 'draft':
        return 'bg-yellow-100 text-yellow-800 border-yellow-300';
      case 'on_hold':
        return 'bg-orange-100 text-orange-800 border-orange-300';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-300';
    }
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString();
  };

  const handleCompleteIntervention = async (interventionId: string) => {
    try {
      await ehrApi.completeIntervention(interventionId, 'Completed successfully', token, tenantSlug);
      showSuccess('Success', 'Intervention marked as completed');
      loadCarePlan();
    } catch (error: any) {
      showError('Error', error.response?.data?.message || 'Failed to complete intervention');
    }
  };

  const handleAchieveGoal = async (goalId: string) => {
    try {
      await ehrApi.achieveGoal(goalId, token, tenantSlug);
      showSuccess('Success', 'Goal marked as achieved');
      loadCarePlan();
    } catch (error: any) {
      showError('Error', error.response?.data?.message || 'Failed to achieve goal');
    }
  };

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center">
        <div className="bg-white rounded-2xl p-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-teal-600 mx-auto"></div>
          <p className="text-slate-600 mt-4">Loading care plan...</p>
        </div>
      </div>
    );
  }

  if (!carePlan) {
    return null;
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-6xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="bg-gradient-to-r from-teal-600 to-cyan-700 text-white p-6">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-2">
                <h2 className="text-2xl font-bold">{carePlan.name}</h2>
                <span className={`px-3 py-1 rounded-full text-xs font-medium border ${getStatusColor(carePlan.status)}`}>
                  {carePlan.status}
                </span>
              </div>
              <p className="text-teal-100 text-sm">{carePlan.description}</p>
              <div className="flex gap-4 mt-3 text-sm text-teal-100">
                <span className="flex items-center gap-1">
                  <Calendar className="w-4 h-4" />
                  Start: {formatDate(carePlan.start_date)}
                </span>
                {carePlan.target_completion_date && (
                  <span className="flex items-center gap-1">
                    <Target className="w-4 h-4" />
                    Target: {formatDate(carePlan.target_completion_date)}
                  </span>
                )}
              </div>
            </div>
            <div className="flex gap-2">
              {onEdit && (
                <button
                  onClick={onEdit}
                  className="p-2 bg-white/10 hover:bg-white/20 rounded-lg transition-colors"
                  title="Edit Care Plan"
                >
                  <Edit className="w-5 h-5" />
                </button>
              )}
              <button onClick={onClose} className="p-2 hover:bg-white/20 rounded-lg transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="border-b border-slate-200 bg-slate-50 px-6">
          <div className="flex gap-4">
            <button
              onClick={() => setActiveTab('overview')}
              className={`px-4 py-3 font-medium transition-colors border-b-2 ${
                activeTab === 'overview'
                  ? 'border-teal-600 text-teal-600'
                  : 'border-transparent text-slate-600 hover:text-slate-900'
              }`}
            >
              Overview
            </button>
            <button
              onClick={() => setActiveTab('goals')}
              className={`px-4 py-3 font-medium transition-colors border-b-2 ${
                activeTab === 'goals'
                  ? 'border-teal-600 text-teal-600'
                  : 'border-transparent text-slate-600 hover:text-slate-900'
              }`}
            >
              Goals ({carePlan.goals?.length || 0})
            </button>
            <button
              onClick={() => setActiveTab('interventions')}
              className={`px-4 py-3 font-medium transition-colors border-b-2 ${
                activeTab === 'interventions'
                  ? 'border-teal-600 text-teal-600'
                  : 'border-transparent text-slate-600 hover:text-slate-900'
              }`}
            >
              Interventions ({carePlan.interventions?.length || 0})
            </button>
            <button
              onClick={() => setActiveTab('progress')}
              className={`px-4 py-3 font-medium transition-colors border-b-2 ${
                activeTab === 'progress'
                  ? 'border-teal-600 text-teal-600'
                  : 'border-transparent text-slate-600 hover:text-slate-900'
              }`}
            >
              Progress & Outcomes
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {activeTab === 'overview' && (
            <div className="space-y-6">
              {/* Summary Cards */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-blue-600 font-medium">Total Goals</p>
                      <p className="text-2xl font-bold text-blue-900">{carePlan.goals?.length || 0}</p>
                    </div>
                    <Target className="w-8 h-8 text-blue-500" />
                  </div>
                </div>

                <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-green-600 font-medium">Achieved Goals</p>
                      <p className="text-2xl font-bold text-green-900">
                        {carePlan.goals?.filter((g) => g.status === 'achieved').length || 0}
                      </p>
                    </div>
                    <CheckCircle className="w-8 h-8 text-green-500" />
                  </div>
                </div>

                <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-purple-600 font-medium">Active Interventions</p>
                      <p className="text-2xl font-bold text-purple-900">
                        {carePlan.interventions?.filter((i) => i.status === 'in_progress' || i.status === 'pending').length || 0}
                      </p>
                    </div>
                    <Activity className="w-8 h-8 text-purple-500" />
                  </div>
                </div>
              </div>

              {/* Care Plan Details */}
              <div className="bg-white border border-slate-200 rounded-lg p-6">
                <h3 className="text-lg font-semibold text-slate-800 mb-4">Care Plan Details</h3>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-slate-600">Category</p>
                    <p className="font-medium text-slate-900">{carePlan.category.replace(/_/g, ' ')}</p>
                  </div>
                  <div>
                    <p className="text-slate-600">Status</p>
                    <p className="font-medium text-slate-900">{carePlan.status}</p>
                  </div>
                  <div>
                    <p className="text-slate-600">Start Date</p>
                    <p className="font-medium text-slate-900">{formatDate(carePlan.start_date)}</p>
                  </div>
                  {carePlan.target_completion_date && (
                    <div>
                      <p className="text-slate-600">Target Completion</p>
                      <p className="font-medium text-slate-900">{formatDate(carePlan.target_completion_date)}</p>
                    </div>
                  )}
                  {carePlan.end_date && (
                    <div>
                      <p className="text-slate-600">End Date</p>
                      <p className="font-medium text-slate-900">{formatDate(carePlan.end_date)}</p>
                    </div>
                  )}
                </div>
                {carePlan.notes && (
                  <div className="mt-4 p-3 bg-slate-50 rounded-lg">
                    <p className="text-sm text-slate-600 font-medium mb-1">Notes</p>
                    <p className="text-sm text-slate-700">{carePlan.notes}</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === 'goals' && (
            <div className="space-y-4">
              {carePlan.goals && carePlan.goals.length > 0 ? (
                carePlan.goals.map((goal) => (
                  <div key={goal.id} className="bg-white border border-slate-200 rounded-lg p-4">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <div className="w-8 h-8 rounded-full bg-teal-100 text-teal-700 font-bold flex items-center justify-center">
                            {goal.goal_number}
                          </div>
                          <h4 className="font-semibold text-slate-800">{goal.goal_text}</h4>
                          <span className={`px-2 py-1 rounded-full text-xs font-medium border ${getStatusColor(goal.status)}`}>
                            {goal.status.replace(/_/g, ' ')}
                          </span>
                        </div>
                        <div className="flex gap-4 text-sm text-slate-600 ml-11">
                          <span>Type: {goal.goal_type.replace(/_/g, ' ')}</span>
                          <span>Priority: {goal.priority}</span>
                          {goal.target_value && <span>Target: {goal.target_value} {goal.measurement_unit}</span>}
                          {goal.current_value && <span>Current: {goal.current_value} {goal.measurement_unit}</span>}
                          {goal.target_date && <span>Due: {formatDate(goal.target_date)}</span>}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {goal.status !== 'achieved' && (
                          <button
                            onClick={() => handleAchieveGoal(goal.id)}
                            className="px-3 py-1 text-green-600 hover:bg-green-50 rounded-lg transition-colors text-sm flex items-center gap-1"
                          >
                            <CheckCircle className="w-4 h-4" />
                            Mark Achieved
                          </button>
                        )}
                        {getStatusIcon(goal.status)}
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center py-12 text-slate-500">
                  <Target className="w-12 h-12 mx-auto mb-3 text-slate-400" />
                  <p className="text-lg font-medium">No goals defined</p>
                </div>
              )}
            </div>
          )}

          {activeTab === 'interventions' && (
            <div className="space-y-4">
              {carePlan.interventions && carePlan.interventions.length > 0 ? (
                carePlan.interventions.map((intervention) => (
                  <div key={intervention.id} className="bg-white border border-slate-200 rounded-lg p-4">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <div className="w-8 h-8 rounded-full bg-cyan-100 text-cyan-700 font-bold flex items-center justify-center">
                            {intervention.intervention_number}
                          </div>
                          <h4 className="font-semibold text-slate-800">{intervention.intervention_text}</h4>
                          <span className={`px-2 py-1 rounded-full text-xs font-medium border ${getStatusColor(intervention.status)}`}>
                            {intervention.status.replace(/_/g, ' ')}
                          </span>
                        </div>
                        <div className="flex gap-4 text-sm text-slate-600 ml-11">
                          <span>Type: {intervention.intervention_type}</span>
                          {intervention.frequency && <span>Frequency: {intervention.frequency}</span>}
                          {intervention.duration && <span>Duration: {intervention.duration}</span>}
                          {intervention.responsible_role && <span>Role: {intervention.responsible_role}</span>}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {intervention.status !== 'completed' && (
                          <button
                            onClick={() => handleCompleteIntervention(intervention.id)}
                            className="px-3 py-1 text-green-600 hover:bg-green-50 rounded-lg transition-colors text-sm flex items-center gap-1"
                          >
                            <CheckCircle className="w-4 h-4" />
                            Complete
                          </button>
                        )}
                        {getStatusIcon(intervention.status)}
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center py-12 text-slate-500">
                  <Activity className="w-12 h-12 mx-auto mb-3 text-slate-400" />
                  <p className="text-lg font-medium">No interventions defined</p>
                </div>
              )}
            </div>
          )}

          {activeTab === 'progress' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-slate-800">Progress Tracking</h3>
                <button
                  onClick={() => setShowProgressModal(true)}
                  className="px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition-colors flex items-center gap-2"
                >
                  <Plus className="w-4 h-4" />
                  Record Progress
                </button>
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-center">
                <TrendingUp className="w-12 h-12 mx-auto mb-3 text-blue-500" />
                <p className="text-blue-800 font-medium">Progress tracking coming soon</p>
                <p className="text-sm text-blue-600 mt-1">View and record care plan progress updates</p>
              </div>
            </div>
          )}
        </div>

        {/* Progress Modal */}
        {showProgressModal && (
          <CarePlanProgress
            carePlanId={carePlanId}
            goals={carePlan.goals || []}
            interventions={carePlan.interventions || []}
            tenantSlug={tenantSlug}
            token={token}
            onClose={() => {
              setShowProgressModal(false);
              loadCarePlan();
            }}
          />
        )}
      </div>
    </div>
  );
};

export default CarePlanViewer;
