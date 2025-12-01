import React, { useState, useEffect } from 'react';
import { X, RefreshCw, Clock, CheckCircle, XCircle, AlertCircle, Activity } from 'lucide-react';
import { ehrApi } from '../services/api';
import { useNotification } from './GlobalNotification';

interface WorkflowExecution {
  id: string;
  workflow_id: string;
  workflow_name?: string;
  trigger_event: string;
  trigger_entity_type: string;
  trigger_entity_id: string;
  patient_id?: string;
  status: string;
  started_at?: string;
  completed_at?: string;
  error_message?: string;
  execution_data?: any;
  steps?: StepExecution[];
}

interface StepExecution {
  id: string;
  step_id: string;
  step_order: number;
  status: string;
  started_at?: string;
  completed_at?: string;
  result_data?: any;
  error_message?: string;
}

interface WorkflowExecutionViewerProps {
  workflowId: string;
  tenantSlug: string;
  token: string;
  onClose: () => void;
}

const WorkflowExecutionViewer: React.FC<WorkflowExecutionViewerProps> = ({
  workflowId,
  tenantSlug,
  token,
  onClose,
}) => {
  const [executions, setExecutions] = useState<WorkflowExecution[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedExecution, setSelectedExecution] = useState<WorkflowExecution | null>(null);
  const { showError } = useNotification();

  useEffect(() => {
    loadExecutions();
    // Auto-refresh every 5 seconds to catch new executions
    const interval = setInterval(() => {
      loadExecutions();
    }, 5000);
    return () => clearInterval(interval);
  }, [workflowId]);

  const loadExecutions = async () => {
    try {
      setLoading(true);
      const response = await ehrApi.getWorkflowExecutions(token, tenantSlug, {
        workflowId,
        limit: 50,
      });
      setExecutions(response.data || []);

      // Load step details for each execution
      for (const execution of response.data || []) {
        try {
          const stepsResponse = await ehrApi.getStepExecutions(execution.id, token, tenantSlug);
          execution.steps = stepsResponse.data || [];
        } catch (error) {
          console.error('Failed to load steps for execution:', error);
        }
      }
    } catch (error: any) {
      console.error('Failed to load executions:', error);
      showError('Error', 'Failed to load workflow executions');
    } finally {
      setLoading(false);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="w-5 h-5 text-green-600" />;
      case 'failed':
        return <XCircle className="w-5 h-5 text-red-600" />;
      case 'running':
        return <Activity className="w-5 h-5 text-blue-600 animate-pulse" />;
      case 'pending':
        return <Clock className="w-5 h-5 text-yellow-600" />;
      default:
        return <AlertCircle className="w-5 h-5 text-gray-600" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'bg-green-100 text-green-800 border-green-300';
      case 'failed':
        return 'bg-red-100 text-red-800 border-red-300';
      case 'running':
        return 'bg-blue-100 text-blue-800 border-blue-300';
      case 'pending':
        return 'bg-yellow-100 text-yellow-800 border-yellow-300';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-300';
    }
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleString();
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-6xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-600 to-indigo-700 text-white p-6 flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold flex items-center gap-3">
              <Activity className="w-6 h-6" />
              Workflow Execution History
            </h2>
            <p className="text-blue-100 text-sm mt-1">View workflow execution details and step status</p>
          </div>
          <div className="flex gap-3">
            <button
              onClick={loadExecutions}
              className="p-2 hover:bg-white/20 rounded-lg transition-colors"
              title="Refresh"
            >
              <RefreshCw className="w-5 h-5" />
            </button>
            <button onClick={onClose} className="p-2 hover:bg-white/20 rounded-lg transition-colors">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            </div>
          ) : executions.length === 0 ? (
            <div className="text-center py-12 text-slate-500">
              <Activity className="w-12 h-12 mx-auto mb-3 text-slate-400" />
              <p className="text-lg font-medium mb-2">No executions found for this workflow</p>
              <p className="text-sm text-slate-400 mb-4">
                Workflows are automatically triggered when their trigger events occur.
              </p>
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 max-w-md mx-auto text-left">
                <p className="text-sm text-blue-800 font-medium mb-2">To test this workflow:</p>
                <ul className="text-sm text-blue-700 space-y-1 list-disc list-inside">
                  <li>Click the lightning bolt (⚡) icon next to the workflow</li>
                  <li>Or trigger the actual event (e.g., schedule an appointment, record vitals)</li>
                </ul>
                <p className="text-xs text-blue-600 mt-3 italic">
                  This viewer auto-refreshes every 5 seconds to show new executions.
                </p>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {executions.map((execution) => (
                <div
                  key={execution.id}
                  className="bg-white border border-slate-200 rounded-lg p-4 hover:shadow-md transition-shadow"
                >
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        {getStatusIcon(execution.status)}
                        <h3 className="text-lg font-semibold text-slate-800">
                          Execution {execution.id.substring(0, 8)}
                        </h3>
                        <span className={`px-2 py-1 rounded-full text-xs font-medium border ${getStatusColor(execution.status)}`}>
                          {execution.status}
                        </span>
                      </div>
                      <div className="text-sm text-slate-600 space-y-1">
                        <p>Trigger: {execution.trigger_event}</p>
                        <p>Entity: {execution.trigger_entity_type} ({execution.trigger_entity_id.substring(0, 8)})</p>
                        {execution.patient_id && <p>Patient: {execution.patient_id.substring(0, 8)}</p>}
                        <p>Started: {formatDate(execution.started_at)}</p>
                        {execution.completed_at && <p>Completed: {formatDate(execution.completed_at)}</p>}
                      </div>
                      {execution.error_message && (
                        <div className="mt-2 p-3 bg-red-50 border border-red-200 rounded-lg">
                          <p className="text-sm text-red-800 font-medium">Error:</p>
                          <p className="text-sm text-red-700">{execution.error_message}</p>
                        </div>
                      )}
                    </div>
                    <button
                      onClick={() => setSelectedExecution(selectedExecution?.id === execution.id ? null : execution)}
                      className="px-3 py-1 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors text-sm"
                    >
                      {selectedExecution?.id === execution.id ? 'Hide' : 'Show'} Steps
                    </button>
                  </div>

                  {selectedExecution?.id === execution.id && execution.steps && (
                    <div className="border-t border-slate-200 pt-4 mt-4">
                      <h4 className="font-medium text-slate-700 mb-3">Step Execution Details</h4>
                      <div className="space-y-2">
                        {execution.steps.map((step, index) => (
                          <div
                            key={step.id}
                            className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg"
                          >
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center font-semibold ${
                              step.status === 'completed' ? 'bg-green-100 text-green-600' :
                              step.status === 'failed' ? 'bg-red-100 text-red-600' :
                              step.status === 'running' ? 'bg-blue-100 text-blue-600' :
                              'bg-gray-100 text-gray-600'
                            }`}>
                              {step.step_order}
                            </div>
                            <div className="flex-1">
                              <p className="font-medium text-slate-700">Step {step.step_order}</p>
                              <p className="text-sm text-slate-500">
                                Status: {step.status} | Started: {formatDate(step.started_at)} | Completed: {formatDate(step.completed_at)}
                              </p>
                              {step.error_message && (
                                <p className="text-sm text-red-600 mt-1">{step.error_message}</p>
                              )}
                            </div>
                            {getStatusIcon(step.status)}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default WorkflowExecutionViewer;

