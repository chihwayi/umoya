import React, { useState, useEffect } from 'react';
import { FileText, Target, Activity, CheckCircle, Clock, TrendingUp, X } from 'lucide-react';
import { ehrApi } from '../services/api';
import { useNotification } from './GlobalNotification';
import PatientProgressReporting from './PatientProgressReporting';

interface CarePlan {
  id: string;
  name: string;
  description: string;
  category: string;
  status: string;
  start_date: string;
  end_date?: string;
  target_completion_date?: string;
  goals: any[];
  interventions: any[];
  progress: any[];
}

interface PatientCarePlansViewProps {
  tenantSlug: string;
  token: string;
  onClose?: () => void;
}

const PatientCarePlansView: React.FC<PatientCarePlansViewProps> = ({
  tenantSlug,
  token,
  onClose,
}) => {
  const [carePlans, setCarePlans] = useState<CarePlan[]>([]);
  const [selectedCarePlan, setSelectedCarePlan] = useState<CarePlan | null>(null);
  const [showProgressModal, setShowProgressModal] = useState(false);
  const [selectedGoal, setSelectedGoal] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const { showSuccess, showError } = useNotification();

  useEffect(() => {
    loadCarePlans();
  }, []);

  const loadCarePlans = async () => {
    try {
      setLoading(true);
      const response = await ehrApi.getPatientCarePlans(token, tenantSlug, { status: 'active' });
      setCarePlans(response.data || []);
    } catch (error: any) {
      console.error('Failed to load care plans:', error);
      showError('Error', 'Failed to load your care plans');
    } finally {
      setLoading(false);
    }
  };

  const loadCarePlanDetails = async (carePlanId: string) => {
    try {
      const response = await ehrApi.getPatientCarePlan(carePlanId, token, tenantSlug);
      setSelectedCarePlan(response.data);
    } catch (error: any) {
      showError('Error', 'Failed to load care plan details');
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
      case 'achieved':
        return 'bg-green-100 text-green-800 border-green-300';
      case 'active':
      case 'in_progress':
        return 'bg-blue-100 text-blue-800 border-blue-300';
      case 'on_hold':
        return 'bg-orange-100 text-orange-800 border-orange-300';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-300';
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString();
  };

  const calculateProgress = (goal: any) => {
    if (!goal.target_value || !goal.current_value) return 0;
    return Math.min(100, Math.round((goal.current_value / goal.target_value) * 100));
  };

  return (
    <div className="bg-white rounded-xl shadow-lg border border-slate-200 max-h-[90vh] flex flex-col">
      {/* Header */}
      <div className="bg-gradient-to-r from-teal-600 to-cyan-700 text-white p-6 rounded-t-xl">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold flex items-center gap-3">
              <FileText className="w-6 h-6" />
              My Care Plans
            </h2>
            <p className="text-teal-100 text-sm mt-1">View your active care plans and track your progress</p>
          </div>
          {onClose && (
            <button onClick={onClose} className="p-2 hover:bg-white/20 rounded-lg transition-colors">
              <X className="w-5 h-5" />
            </button>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-teal-600"></div>
          </div>
        ) : selectedCarePlan ? (
          // Detailed View
          <div>
            <button
              onClick={() => setSelectedCarePlan(null)}
              className="mb-4 text-teal-600 hover:text-teal-700 font-medium flex items-center gap-2"
            >
              ← Back to all care plans
            </button>

            <div className="bg-gradient-to-r from-teal-50 to-cyan-50 rounded-lg p-6 mb-6">
              <h3 className="text-2xl font-bold text-slate-800 mb-2">{selectedCarePlan.name}</h3>
              <p className="text-slate-600 mb-4">{selectedCarePlan.description}</p>
              <div className="flex gap-4 text-sm">
                <span className="flex items-center gap-1">
                  <Clock className="w-4 h-4" />
                  Started: {formatDate(selectedCarePlan.start_date)}
                </span>
                {selectedCarePlan.target_completion_date && (
                  <span className="flex items-center gap-1">
                    <Target className="w-4 h-4" />
                    Target: {formatDate(selectedCarePlan.target_completion_date)}
                  </span>
                )}
                <span className={`px-3 py-1 rounded-full text-xs font-medium border ${getStatusColor(selectedCarePlan.status)}`}>
                  {selectedCarePlan.status}
                </span>
              </div>
            </div>

            {/* Goals */}
            <div className="mb-6">
              <h4 className="text-lg font-semibold text-slate-800 mb-4 flex items-center gap-2">
                <Target className="w-5 h-5 text-teal-600" />
                Your Goals
              </h4>
              <div className="space-y-4">
                {selectedCarePlan.goals?.map((goal: any) => (
                  <div key={goal.id} className="bg-white border border-slate-200 rounded-lg p-4">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex-1">
                        <h5 className="font-semibold text-slate-800 mb-1">{goal.goal_text}</h5>
                        <span className={`inline-block px-2 py-1 rounded-full text-xs font-medium border ${getStatusColor(goal.status)}`}>
                          {goal.status}
                        </span>
                      </div>
                      {goal.status !== 'achieved' && (
                        <button
                          onClick={() => {
                            setSelectedGoal(goal);
                            setShowProgressModal(true);
                          }}
                          className="px-3 py-1 bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition-colors text-sm font-medium flex items-center gap-1"
                        >
                          <TrendingUp className="w-4 h-4" />
                          Report Progress
                        </button>
                      )}
                    </div>

                    {goal.target_value && (
                      <div className="mt-3">
                        <div className="flex justify-between text-sm text-slate-600 mb-1">
                          <span>Progress: {goal.current_value || 0} / {goal.target_value} {goal.measurement_unit}</span>
                          <span>{calculateProgress(goal)}%</span>
                        </div>
                        <div className="w-full bg-slate-200 rounded-full h-2">
                          <div
                            className="bg-teal-600 h-2 rounded-full transition-all"
                            style={{ width: `${calculateProgress(goal)}%` }}
                          ></div>
                        </div>
                      </div>
                    )}

                    {goal.target_date && (
                      <div className="mt-2 text-sm text-slate-500">
                        Target Date: {formatDate(goal.target_date)}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Interventions */}
            <div className="mb-6">
              <h4 className="text-lg font-semibold text-slate-800 mb-4 flex items-center gap-2">
                <Activity className="w-5 h-5 text-cyan-600" />
                Your Care Activities
              </h4>
              <div className="space-y-3">
                {selectedCarePlan.interventions?.map((intervention: any) => (
                  <div key={intervention.id} className="bg-cyan-50 border border-cyan-200 rounded-lg p-4">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <h5 className="font-medium text-slate-800 mb-1">{intervention.intervention_text}</h5>
                        <div className="flex gap-3 text-sm text-slate-600">
                          <span>Type: {intervention.intervention_type}</span>
                          {intervention.frequency && <span>Frequency: {intervention.frequency}</span>}
                        </div>
                      </div>
                      <span className={`px-2 py-1 rounded-full text-xs font-medium border ${getStatusColor(intervention.status)}`}>
                        {intervention.status}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Progress History */}
            {selectedCarePlan.progress && selectedCarePlan.progress.length > 0 && (
              <div>
                <h4 className="text-lg font-semibold text-slate-800 mb-4 flex items-center gap-2">
                  <CheckCircle className="w-5 h-5 text-green-600" />
                  Progress History
                </h4>
                <div className="space-y-3">
                  {selectedCarePlan.progress.map((progress: any, index: number) => (
                    <div key={index} className="bg-slate-50 border border-slate-200 rounded-lg p-4">
                      <div className="flex justify-between items-start mb-2">
                        <span className="text-sm font-medium text-slate-700">
                          {progress.recorded_by_type === 'patient' ? 'You' : 'Your Care Team'}
                        </span>
                        <span className="text-xs text-slate-500">
                          {new Date(progress.recorded_at).toLocaleString()}
                        </span>
                      </div>
                      <p className="text-slate-600">{progress.notes}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : carePlans.length === 0 ? (
          <div className="text-center py-12 text-slate-500">
            <FileText className="w-12 h-12 mx-auto mb-3 text-slate-400" />
            <p className="text-lg font-medium mb-2">No Active Care Plans</p>
            <p className="text-sm text-slate-400">You don't have any active care plans at the moment</p>
          </div>
        ) : (
          // List View
          <div className="space-y-4">
            {carePlans.map((plan) => (
              <div
                key={plan.id}
                className="bg-white border border-slate-200 rounded-lg p-5 hover:shadow-md transition-shadow cursor-pointer"
                onClick={() => loadCarePlanDetails(plan.id)}
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1">
                    <h3 className="text-lg font-semibold text-slate-800 mb-1">{plan.name}</h3>
                    <p className="text-slate-600 text-sm mb-2">{plan.description}</p>
                    <div className="flex gap-4 text-sm text-slate-500">
                      <span>Started: {formatDate(plan.start_date)}</span>
                      {plan.target_completion_date && (
                        <span>Target: {formatDate(plan.target_completion_date)}</span>
                      )}
                    </div>
                  </div>
                  <span className={`px-3 py-1 rounded-full text-xs font-medium border ${getStatusColor(plan.status)}`}>
                    {plan.status}
                  </span>
                </div>

                <div className="flex gap-4 mt-3 text-sm">
                  <span className="flex items-center gap-1 text-teal-600">
                    <Target className="w-4 h-4" />
                    {plan.goals?.length || 0} goals
                  </span>
                  <span className="flex items-center gap-1 text-cyan-600">
                    <Activity className="w-4 h-4" />
                    {plan.interventions?.length || 0} activities
                  </span>
                  {plan.goals && (
                    <span className="flex items-center gap-1 text-green-600">
                      <CheckCircle className="w-4 h-4" />
                      {plan.goals.filter((g: any) => g.status === 'achieved').length} achieved
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Progress Reporting Modal */}
      {showProgressModal && selectedGoal && selectedCarePlan && (
        <PatientProgressReporting
          carePlan={selectedCarePlan}
          goal={selectedGoal}
          tenantSlug={tenantSlug}
          token={token}
          onClose={() => {
            setShowProgressModal(false);
            setSelectedGoal(null);
          }}
          onSuccess={() => {
            setShowProgressModal(false);
            setSelectedGoal(null);
            loadCarePlanDetails(selectedCarePlan.id);
            showSuccess('Success', 'Progress reported successfully!');
          }}
        />
      )}
    </div>
  );
};

export default PatientCarePlansView;


import { FileText, Target, Activity, CheckCircle, Clock, TrendingUp, X } from 'lucide-react';
import { ehrApi } from '../services/api';
import { useNotification } from './GlobalNotification';
import PatientProgressReporting from './PatientProgressReporting';

interface CarePlan {
  id: string;
  name: string;
  description: string;
  category: string;
  status: string;
  start_date: string;
  end_date?: string;
  target_completion_date?: string;
  goals: any[];
  interventions: any[];
  progress: any[];
}

interface PatientCarePlansViewProps {
  tenantSlug: string;
  token: string;
  onClose?: () => void;
}

const PatientCarePlansView: React.FC<PatientCarePlansViewProps> = ({
  tenantSlug,
  token,
  onClose,
}) => {
  const [carePlans, setCarePlans] = useState<CarePlan[]>([]);
  const [selectedCarePlan, setSelectedCarePlan] = useState<CarePlan | null>(null);
  const [showProgressModal, setShowProgressModal] = useState(false);
  const [selectedGoal, setSelectedGoal] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const { showSuccess, showError } = useNotification();

  useEffect(() => {
    loadCarePlans();
  }, []);

  const loadCarePlans = async () => {
    try {
      setLoading(true);
      const response = await ehrApi.getPatientCarePlans(token, tenantSlug, { status: 'active' });
      setCarePlans(response.data || []);
    } catch (error: any) {
      console.error('Failed to load care plans:', error);
      showError('Error', 'Failed to load your care plans');
    } finally {
      setLoading(false);
    }
  };

  const loadCarePlanDetails = async (carePlanId: string) => {
    try {
      const response = await ehrApi.getPatientCarePlan(carePlanId, token, tenantSlug);
      setSelectedCarePlan(response.data);
    } catch (error: any) {
      showError('Error', 'Failed to load care plan details');
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
      case 'achieved':
        return 'bg-green-100 text-green-800 border-green-300';
      case 'active':
      case 'in_progress':
        return 'bg-blue-100 text-blue-800 border-blue-300';
      case 'on_hold':
        return 'bg-orange-100 text-orange-800 border-orange-300';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-300';
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString();
  };

  const calculateProgress = (goal: any) => {
    if (!goal.target_value || !goal.current_value) return 0;
    return Math.min(100, Math.round((goal.current_value / goal.target_value) * 100));
  };

  return (
    <div className="bg-white rounded-xl shadow-lg border border-slate-200 max-h-[90vh] flex flex-col">
      {/* Header */}
      <div className="bg-gradient-to-r from-teal-600 to-cyan-700 text-white p-6 rounded-t-xl">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold flex items-center gap-3">
              <FileText className="w-6 h-6" />
              My Care Plans
            </h2>
            <p className="text-teal-100 text-sm mt-1">View your active care plans and track your progress</p>
          </div>
          {onClose && (
            <button onClick={onClose} className="p-2 hover:bg-white/20 rounded-lg transition-colors">
              <X className="w-5 h-5" />
            </button>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-teal-600"></div>
          </div>
        ) : selectedCarePlan ? (
          // Detailed View
          <div>
            <button
              onClick={() => setSelectedCarePlan(null)}
              className="mb-4 text-teal-600 hover:text-teal-700 font-medium flex items-center gap-2"
            >
              ← Back to all care plans
            </button>

            <div className="bg-gradient-to-r from-teal-50 to-cyan-50 rounded-lg p-6 mb-6">
              <h3 className="text-2xl font-bold text-slate-800 mb-2">{selectedCarePlan.name}</h3>
              <p className="text-slate-600 mb-4">{selectedCarePlan.description}</p>
              <div className="flex gap-4 text-sm">
                <span className="flex items-center gap-1">
                  <Clock className="w-4 h-4" />
                  Started: {formatDate(selectedCarePlan.start_date)}
                </span>
                {selectedCarePlan.target_completion_date && (
                  <span className="flex items-center gap-1">
                    <Target className="w-4 h-4" />
                    Target: {formatDate(selectedCarePlan.target_completion_date)}
                  </span>
                )}
                <span className={`px-3 py-1 rounded-full text-xs font-medium border ${getStatusColor(selectedCarePlan.status)}`}>
                  {selectedCarePlan.status}
                </span>
              </div>
            </div>

            {/* Goals */}
            <div className="mb-6">
              <h4 className="text-lg font-semibold text-slate-800 mb-4 flex items-center gap-2">
                <Target className="w-5 h-5 text-teal-600" />
                Your Goals
              </h4>
              <div className="space-y-4">
                {selectedCarePlan.goals?.map((goal: any) => (
                  <div key={goal.id} className="bg-white border border-slate-200 rounded-lg p-4">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex-1">
                        <h5 className="font-semibold text-slate-800 mb-1">{goal.goal_text}</h5>
                        <span className={`inline-block px-2 py-1 rounded-full text-xs font-medium border ${getStatusColor(goal.status)}`}>
                          {goal.status}
                        </span>
                      </div>
                      {goal.status !== 'achieved' && (
                        <button
                          onClick={() => {
                            setSelectedGoal(goal);
                            setShowProgressModal(true);
                          }}
                          className="px-3 py-1 bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition-colors text-sm font-medium flex items-center gap-1"
                        >
                          <TrendingUp className="w-4 h-4" />
                          Report Progress
                        </button>
                      )}
                    </div>

                    {goal.target_value && (
                      <div className="mt-3">
                        <div className="flex justify-between text-sm text-slate-600 mb-1">
                          <span>Progress: {goal.current_value || 0} / {goal.target_value} {goal.measurement_unit}</span>
                          <span>{calculateProgress(goal)}%</span>
                        </div>
                        <div className="w-full bg-slate-200 rounded-full h-2">
                          <div
                            className="bg-teal-600 h-2 rounded-full transition-all"
                            style={{ width: `${calculateProgress(goal)}%` }}
                          ></div>
                        </div>
                      </div>
                    )}

                    {goal.target_date && (
                      <div className="mt-2 text-sm text-slate-500">
                        Target Date: {formatDate(goal.target_date)}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Interventions */}
            <div className="mb-6">
              <h4 className="text-lg font-semibold text-slate-800 mb-4 flex items-center gap-2">
                <Activity className="w-5 h-5 text-cyan-600" />
                Your Care Activities
              </h4>
              <div className="space-y-3">
                {selectedCarePlan.interventions?.map((intervention: any) => (
                  <div key={intervention.id} className="bg-cyan-50 border border-cyan-200 rounded-lg p-4">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <h5 className="font-medium text-slate-800 mb-1">{intervention.intervention_text}</h5>
                        <div className="flex gap-3 text-sm text-slate-600">
                          <span>Type: {intervention.intervention_type}</span>
                          {intervention.frequency && <span>Frequency: {intervention.frequency}</span>}
                        </div>
                      </div>
                      <span className={`px-2 py-1 rounded-full text-xs font-medium border ${getStatusColor(intervention.status)}`}>
                        {intervention.status}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Progress History */}
            {selectedCarePlan.progress && selectedCarePlan.progress.length > 0 && (
              <div>
                <h4 className="text-lg font-semibold text-slate-800 mb-4 flex items-center gap-2">
                  <CheckCircle className="w-5 h-5 text-green-600" />
                  Progress History
                </h4>
                <div className="space-y-3">
                  {selectedCarePlan.progress.map((progress: any, index: number) => (
                    <div key={index} className="bg-slate-50 border border-slate-200 rounded-lg p-4">
                      <div className="flex justify-between items-start mb-2">
                        <span className="text-sm font-medium text-slate-700">
                          {progress.recorded_by_type === 'patient' ? 'You' : 'Your Care Team'}
                        </span>
                        <span className="text-xs text-slate-500">
                          {new Date(progress.recorded_at).toLocaleString()}
                        </span>
                      </div>
                      <p className="text-slate-600">{progress.notes}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : carePlans.length === 0 ? (
          <div className="text-center py-12 text-slate-500">
            <FileText className="w-12 h-12 mx-auto mb-3 text-slate-400" />
            <p className="text-lg font-medium mb-2">No Active Care Plans</p>
            <p className="text-sm text-slate-400">You don't have any active care plans at the moment</p>
          </div>
        ) : (
          // List View
          <div className="space-y-4">
            {carePlans.map((plan) => (
              <div
                key={plan.id}
                className="bg-white border border-slate-200 rounded-lg p-5 hover:shadow-md transition-shadow cursor-pointer"
                onClick={() => loadCarePlanDetails(plan.id)}
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1">
                    <h3 className="text-lg font-semibold text-slate-800 mb-1">{plan.name}</h3>
                    <p className="text-slate-600 text-sm mb-2">{plan.description}</p>
                    <div className="flex gap-4 text-sm text-slate-500">
                      <span>Started: {formatDate(plan.start_date)}</span>
                      {plan.target_completion_date && (
                        <span>Target: {formatDate(plan.target_completion_date)}</span>
                      )}
                    </div>
                  </div>
                  <span className={`px-3 py-1 rounded-full text-xs font-medium border ${getStatusColor(plan.status)}`}>
                    {plan.status}
                  </span>
                </div>

                <div className="flex gap-4 mt-3 text-sm">
                  <span className="flex items-center gap-1 text-teal-600">
                    <Target className="w-4 h-4" />
                    {plan.goals?.length || 0} goals
                  </span>
                  <span className="flex items-center gap-1 text-cyan-600">
                    <Activity className="w-4 h-4" />
                    {plan.interventions?.length || 0} activities
                  </span>
                  {plan.goals && (
                    <span className="flex items-center gap-1 text-green-600">
                      <CheckCircle className="w-4 h-4" />
                      {plan.goals.filter((g: any) => g.status === 'achieved').length} achieved
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Progress Reporting Modal */}
      {showProgressModal && selectedGoal && selectedCarePlan && (
        <PatientProgressReporting
          carePlan={selectedCarePlan}
          goal={selectedGoal}
          tenantSlug={tenantSlug}
          token={token}
          onClose={() => {
            setShowProgressModal(false);
            setSelectedGoal(null);
          }}
          onSuccess={() => {
            setShowProgressModal(false);
            setSelectedGoal(null);
            loadCarePlanDetails(selectedCarePlan.id);
            showSuccess('Success', 'Progress reported successfully!');
          }}
        />
      )}
    </div>
  );
};

export default PatientCarePlansView;

