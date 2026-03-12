import React, { useState, useEffect } from 'react';
import { X, TrendingUp, Activity, CheckCircle, XCircle, Clock, BarChart3 } from 'lucide-react';
import { ehrApi } from '../services/api';
import { useNotification } from './GlobalNotification';

interface WorkflowAnalyticsProps {
  workflowId?: string;
  tenantSlug: string;
  token: string;
  onClose: () => void;
}

interface AnalyticsData {
  totalWorkflows?: number;
  activeWorkflows?: number;
  totalExecutions: number;
  completedExecutions: number;
  failedExecutions: number;
  runningExecutions?: number;
  successRate: number;
  avgExecutionTimeSeconds: number;
  executionsByTrigger?: Array<{ triggerEvent: string; count: number }>;
  mostUsedWorkflows?: Array<{ id: string; name: string; executionCount: number }>;
  executionsOverTime?: Array<{ date: string; count: number }>;
  workflow?: { id: string; name: string; triggerEvent: string; isActive: boolean };
  stepFailures?: Array<{ stepType: string; failureCount: number }>;
  recentExecutions?: Array<{
    id: string;
    status: string;
    startedAt: string;
    completedAt: string;
    triggerEvent: string;
  }>;
}

const WorkflowAnalytics: React.FC<WorkflowAnalyticsProps> = ({
  workflowId,
  tenantSlug,
  token,
  onClose,
}) => {
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const { showError } = useNotification();

  useEffect(() => {
    loadAnalytics();
  }, [workflowId]);

  const loadAnalytics = async () => {
    try {
      setLoading(true);
      let response;
      if (workflowId) {
        response = await ehrApi.getWorkflowAnalyticsById(workflowId, token, tenantSlug);
      } else {
        response = await ehrApi.getWorkflowAnalytics(token, tenantSlug);
      }
      setAnalytics(response.data);
    } catch (error: any) {
      console.error('Failed to load analytics:', error);
      showError('Error', 'Failed to load workflow analytics');
    } finally {
      setLoading(false);
    }
  };

  const formatDuration = (seconds: number) => {
    if (seconds < 60) return `${seconds}s`;
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}m ${remainingSeconds}s`;
  };

  return (
    <div className="fixed inset-0 bg-slate-900/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-gradient-to-br from-white via-slate-50 to-indigo-50 rounded-2xl shadow-2xl w-full max-w-6xl max-h-[90vh] overflow-hidden flex flex-col border border-slate-200/80">
        {/* Header */}
        <div className="bg-gradient-to-r from-slate-100 via-indigo-100 to-violet-100 p-6 flex items-center justify-between border-b border-indigo-200/70">
          <div>
            <h2 className="text-2xl font-bold text-slate-900 flex items-center gap-3">
              <BarChart3 className="w-6 h-6 text-indigo-600" />
              {workflowId ? 'Workflow Analytics' : 'Overall Workflow Analytics'}
            </h2>
            <p className="text-slate-600 text-sm mt-1">
              {workflowId
                ? 'Performance metrics and insights for this workflow'
                : 'System-wide workflow performance and usage statistics'}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 bg-white text-slate-700 border border-slate-200 hover:bg-slate-100 rounded-lg transition-colors"
            title="Close analytics"
          >
            <X className="w-5 h-5 text-slate-700" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
            </div>
          ) : analytics ? (
            <div className="space-y-6">
              {/* Workflow Info (if specific workflow) */}
              {analytics.workflow && (
                <div className="bg-gradient-to-r from-purple-50 to-indigo-50 border border-purple-200 rounded-lg p-4">
                  <h3 className="text-lg font-semibold text-purple-900 mb-2">{analytics.workflow.name}</h3>
                  <div className="flex gap-4 text-sm text-purple-700">
                    <span>Trigger: {analytics.workflow.triggerEvent}</span>
                    <span
                      className={`px-2 py-1 rounded ${
                        analytics.workflow.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700'
                      }`}
                    >
                      {analytics.workflow.isActive ? 'Active' : 'Inactive'}
                    </span>
                  </div>
                </div>
              )}

              {/* Key Metrics */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {analytics.totalWorkflows !== undefined && (
                  <div className="bg-white border border-slate-200 rounded-lg p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-slate-600">Total Workflows</p>
                        <p className="text-2xl font-bold text-slate-900">{analytics.totalWorkflows}</p>
                        <p className="text-xs text-green-600 mt-1">{analytics.activeWorkflows} active</p>
                      </div>
                      <Activity className="w-8 h-8 text-blue-500" />
                    </div>
                  </div>
                )}

                <div className="bg-white border border-slate-200 rounded-lg p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-slate-600">Total Executions</p>
                      <p className="text-2xl font-bold text-slate-900">{analytics.totalExecutions}</p>
                      {analytics.runningExecutions !== undefined && (
                        <p className="text-xs text-blue-600 mt-1">{analytics.runningExecutions} running</p>
                      )}
                    </div>
                    <TrendingUp className="w-8 h-8 text-purple-500" />
                  </div>
                </div>

                <div className="bg-white border border-slate-200 rounded-lg p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-slate-600">Success Rate</p>
                      <p className="text-2xl font-bold text-slate-900">{analytics.successRate}%</p>
                      <p className="text-xs text-green-600 mt-1">{analytics.completedExecutions} completed</p>
                    </div>
                    <CheckCircle className="w-8 h-8 text-green-500" />
                  </div>
                </div>

                <div className="bg-white border border-slate-200 rounded-lg p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-slate-600">Avg Duration</p>
                      <p className="text-2xl font-bold text-slate-900">
                        {formatDuration(analytics.avgExecutionTimeSeconds)}
                      </p>
                      <p className="text-xs text-slate-500 mt-1">per execution</p>
                    </div>
                    <Clock className="w-8 h-8 text-orange-500" />
                  </div>
                </div>
              </div>

              {/* Execution Status Breakdown */}
              <div className="bg-white border border-slate-200 rounded-lg p-6">
                <h3 className="text-lg font-semibold text-slate-800 mb-4">Execution Status</h3>
                <div className="grid grid-cols-3 gap-4">
                  <div className="text-center p-4 bg-green-50 rounded-lg">
                    <CheckCircle className="w-8 h-8 text-green-600 mx-auto mb-2" />
                    <p className="text-2xl font-bold text-green-700">{analytics.completedExecutions}</p>
                    <p className="text-sm text-green-600">Completed</p>
                  </div>
                  <div className="text-center p-4 bg-red-50 rounded-lg">
                    <XCircle className="w-8 h-8 text-red-600 mx-auto mb-2" />
                    <p className="text-2xl font-bold text-red-700">{analytics.failedExecutions}</p>
                    <p className="text-sm text-red-600">Failed</p>
                  </div>
                  {analytics.runningExecutions !== undefined && (
                    <div className="text-center p-4 bg-blue-50 rounded-lg">
                      <Activity className="w-8 h-8 text-blue-600 mx-auto mb-2" />
                      <p className="text-2xl font-bold text-blue-700">{analytics.runningExecutions}</p>
                      <p className="text-sm text-blue-600">Running</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Executions by Trigger */}
              {analytics.executionsByTrigger && analytics.executionsByTrigger.length > 0 && (
                <div className="bg-white border border-slate-200 rounded-lg p-6">
                  <h3 className="text-lg font-semibold text-slate-800 mb-4">Executions by Trigger Event</h3>
                  <div className="space-y-2">
                    {analytics.executionsByTrigger.map((item) => (
                      <div key={item.triggerEvent} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                        <span className="text-sm font-medium text-slate-700">{item.triggerEvent}</span>
                        <span className="text-sm font-bold text-slate-900">{item.count} executions</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Most Used Workflows */}
              {analytics.mostUsedWorkflows && analytics.mostUsedWorkflows.length > 0 && (
                <div className="bg-white border border-slate-200 rounded-lg p-6">
                  <h3 className="text-lg font-semibold text-slate-800 mb-4">Most Used Workflows</h3>
                  <div className="space-y-2">
                    {analytics.mostUsedWorkflows.map((workflow) => (
                      <div key={workflow.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                        <span className="text-sm font-medium text-slate-700">{workflow.name}</span>
                        <span className="text-sm font-bold text-slate-900">{workflow.executionCount} executions</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Step Failures */}
              {analytics.stepFailures && analytics.stepFailures.length > 0 && (
                <div className="bg-white border border-slate-200 rounded-lg p-6">
                  <h3 className="text-lg font-semibold text-slate-800 mb-4">Step Failure Analysis</h3>
                  <div className="space-y-2">
                    {analytics.stepFailures.map((item) => (
                      <div key={item.stepType} className="flex items-center justify-between p-3 bg-red-50 rounded-lg">
                        <span className="text-sm font-medium text-red-700">{item.stepType}</span>
                        <span className="text-sm font-bold text-red-900">{item.failureCount} failures</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Recent Executions */}
              {analytics.recentExecutions && analytics.recentExecutions.length > 0 && (
                <div className="bg-white border border-slate-200 rounded-lg p-6">
                  <h3 className="text-lg font-semibold text-slate-800 mb-4">Recent Executions</h3>
                  <div className="space-y-2">
                    {analytics.recentExecutions.map((execution) => (
                      <div key={execution.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                        <div>
                          <p className="text-sm font-medium text-slate-700">
                            {execution.id.substring(0, 8)} - {execution.triggerEvent}
                          </p>
                          <p className="text-xs text-slate-500">{new Date(execution.startedAt).toLocaleString()}</p>
                        </div>
                        <span
                          className={`px-2 py-1 rounded text-xs font-medium ${
                            execution.status === 'completed'
                              ? 'bg-green-100 text-green-700'
                              : execution.status === 'failed'
                              ? 'bg-red-100 text-red-700'
                              : 'bg-blue-100 text-blue-700'
                          }`}
                        >
                          {execution.status}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="text-center py-12 text-slate-500">
              <BarChart3 className="w-12 h-12 mx-auto mb-3 text-slate-400" />
              <p className="text-lg font-medium">No analytics data available</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default WorkflowAnalytics;
