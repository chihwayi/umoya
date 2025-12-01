import React, { useState, useEffect } from 'react';
import { Search, Filter, Plus, Edit, Trash2, Play, Pause, Copy, Eye, X, CheckCircle, AlertCircle, Clock, Activity, Zap } from 'lucide-react';
import { ehrApi } from '../services/api';
import { useNotification } from './GlobalNotification';
import WorkflowBuilder from './WorkflowBuilder';
import WorkflowExecutionViewer from './WorkflowExecutionViewer';
import ConfirmDialog from './ConfirmDialog';

interface Workflow {
  id: string;
  name: string;
  description: string;
  trigger_event: string;
  trigger_conditions?: any;
  is_active: boolean;
  priority: number;
  created_at: string;
  steps?: WorkflowStep[];
}

interface WorkflowStep {
  id: string;
  step_order: number;
  step_type: string;
  step_config: any;
  is_required: boolean;
}

interface WorkflowTemplate {
  id: string;
  name: string;
  description: string;
  category?: string;
  template_data: any;
  is_default: boolean;
  is_active: boolean;
}

interface WorkflowListProps {
  tenantSlug: string;
  token: string;
  onClose?: () => void;
}

const TRIGGER_EVENTS = [
  { value: 'patient_check_in', label: 'Patient Check-In' },
  { value: 'appointment_scheduled', label: 'Appointment Scheduled' },
  { value: 'appointment_started', label: 'Appointment Started' },
  { value: 'appointment_completed', label: 'Appointment Completed' },
  { value: 'lab_result_received', label: 'Lab Result Received' },
  { value: 'vitals_recorded', label: 'Vitals Recorded' },
  { value: 'prescription_created', label: 'Prescription Created' },
  { value: 'triage_completed', label: 'Triage Completed' },
  { value: 'referral_created', label: 'Referral Created' },
  { value: 'custom', label: 'Custom' },
];

const WorkflowList: React.FC<WorkflowListProps> = ({ tenantSlug, token, onClose }) => {
  const [workflows, setWorkflows] = useState<Workflow[]>([]);
  const [filteredWorkflows, setFilteredWorkflows] = useState<Workflow[]>([]);
  const [templates, setTemplates] = useState<WorkflowTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingTemplates, setLoadingTemplates] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedTrigger, setSelectedTrigger] = useState<string>('');
  const [showActiveOnly, setShowActiveOnly] = useState<boolean | undefined>(undefined);
  const [selectedWorkflow, setSelectedWorkflow] = useState<Workflow | null>(null);
  const [showBuilder, setShowBuilder] = useState(false);
  const [showExecutionViewer, setShowExecutionViewer] = useState(false);
  const [selectedExecutionId, setSelectedExecutionId] = useState<string | null>(null);
  const [showTemplates, setShowTemplates] = useState(true);
  const [deleteConfirm, setDeleteConfirm] = useState<{ open: boolean; workflowId: string | null }>({
    open: false,
    workflowId: null,
  });
  const { showSuccess, showError } = useNotification();

  useEffect(() => {
    loadWorkflows();
    loadTemplates();
  }, [selectedTrigger, showActiveOnly]);

  useEffect(() => {
    filterWorkflows();
  }, [workflows, searchTerm]);

  const loadWorkflows = async () => {
    try {
      setLoading(true);
      const response = await ehrApi.getWorkflows(token, tenantSlug, {
        triggerEvent: selectedTrigger || undefined,
        isActive: showActiveOnly,
        search: searchTerm || undefined,
      });
      setWorkflows(response.data || []);
    } catch (error: any) {
      console.error('Failed to load workflows:', error);
      showError('Error', 'Failed to load workflows. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const loadTemplates = async () => {
    try {
      setLoadingTemplates(true);
      const response = await ehrApi.getWorkflowTemplates(token, tenantSlug);
      setTemplates(response.data || []);
    } catch (error: any) {
      console.error('Failed to load templates:', error);
      showError('Error', 'Failed to load workflow templates. Please try again.');
    } finally {
      setLoadingTemplates(false);
    }
  };

  const handleCreateFromTemplate = async (templateId: string) => {
    try {
      await ehrApi.createWorkflowFromTemplate(templateId, token, tenantSlug);
      showSuccess('Success', 'Workflow created from template successfully');
      loadWorkflows();
    } catch (error: any) {
      showError('Error', error.response?.data?.message || 'Failed to create workflow from template');
    }
  };

  const filterWorkflows = () => {
    let filtered = [...workflows];

    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(
        w =>
          w.name.toLowerCase().includes(term) ||
          w.description?.toLowerCase().includes(term) ||
          w.trigger_event.toLowerCase().includes(term),
      );
    }

    setFilteredWorkflows(filtered);
  };

  const handleDeleteClick = (workflowId: string) => {
    setDeleteConfirm({ open: true, workflowId });
  };

  const handleDeleteConfirm = async () => {
    if (!deleteConfirm.workflowId) return;

    try {
      await ehrApi.deleteWorkflow(deleteConfirm.workflowId, token, tenantSlug);
      showSuccess('Success', 'Workflow deleted successfully');
      setDeleteConfirm({ open: false, workflowId: null });
      loadWorkflows();
    } catch (error: any) {
      showError('Error', error.response?.data?.message || 'Failed to delete workflow');
      setDeleteConfirm({ open: false, workflowId: null });
    }
  };

  const handleDeleteCancel = () => {
    setDeleteConfirm({ open: false, workflowId: null });
  };

  const handleTestWorkflow = async (workflow: Workflow) => {
    try {
      // Generate a valid UUID for test entity ID
      const generateUUID = () => {
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
          const r = (Math.random() * 16) | 0;
          const v = c === 'x' ? r : (r & 0x3) | 0x8;
          return v.toString(16);
        });
      };

      // Create a test execution with dummy data
      // Include _bypassConditions flag to bypass trigger conditions for testing
      await ehrApi.executeWorkflow(
        {
          triggerEvent: workflow.trigger_event,
          entityType: 'test',
          entityId: generateUUID(), // Generate valid UUID for test
          patientId: null, // Can be set if needed
          data: {
            _bypassConditions: true, // Bypass trigger conditions for testing
          },
        },
        token,
        tenantSlug,
      );
      showSuccess('Success', 'Workflow test execution triggered! Check execution history.');
      // If execution viewer is open for this workflow, refresh it
      if (showExecutionViewer && selectedWorkflow?.id === workflow.id) {
        // Trigger a refresh by updating the key or calling a refresh function
        // For now, we'll just show a message - user can manually refresh
        setTimeout(() => {
          loadWorkflows(); // Reload workflows to see updated execution count
        }, 1000);
      }
    } catch (error: any) {
      showError('Error', error.response?.data?.message || 'Failed to test workflow');
    }
  };

  const handleToggleActive = async (workflow: Workflow) => {
    try {
      if (workflow.is_active) {
        await ehrApi.deactivateWorkflow(workflow.id, token, tenantSlug);
        showSuccess('Success', 'Workflow deactivated');
      } else {
        await ehrApi.activateWorkflow(workflow.id, token, tenantSlug);
        showSuccess('Success', 'Workflow activated');
      }
      loadWorkflows();
    } catch (error: any) {
      showError('Error', error.response?.data?.message || 'Failed to update workflow');
    }
  };

  const handleDuplicate = async (workflowId: string) => {
    try {
      await ehrApi.duplicateWorkflow(workflowId, token, tenantSlug);
      showSuccess('Success', 'Workflow duplicated successfully');
      loadWorkflows();
    } catch (error: any) {
      showError('Error', error.response?.data?.message || 'Failed to duplicate workflow');
    }
  };

  const getTriggerEventLabel = (event: string) => {
    return TRIGGER_EVENTS.find(e => e.value === event)?.label || event.replace(/_/g, ' ');
  };

  const getStatusColor = (isActive: boolean) => {
    return isActive
      ? 'bg-green-100 text-green-800 border-green-300'
      : 'bg-gray-100 text-gray-800 border-gray-300';
  };

  return (
    <div className="bg-white rounded-xl shadow-lg border border-slate-200 max-h-[90vh] flex flex-col">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-600 to-indigo-700 text-white p-6 rounded-t-xl">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold flex items-center gap-3">
              <Activity className="w-6 h-6" />
              Clinical Workflows
            </h2>
            <p className="text-blue-100 text-sm mt-1">Automate care processes and streamline workflows</p>
          </div>
          <div className="flex gap-3">
            <button
              onClick={() => {
                setSelectedWorkflow(null);
                setShowBuilder(true);
              }}
              className="px-4 py-2 bg-white text-blue-600 rounded-lg hover:bg-blue-50 transition-colors flex items-center gap-2 text-sm font-semibold"
            >
              <Plus className="w-4 h-4" />
              Create Workflow
            </button>
            {onClose && (
              <button onClick={onClose} className="p-2 hover:bg-white/20 rounded-lg transition-colors">
                <X className="w-5 h-5" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="p-4 border-b border-slate-200 bg-slate-50">
        <div className="flex flex-wrap gap-4">
          <div className="flex-1 min-w-[200px]">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-4 h-4" />
              <input
                type="text"
                placeholder="Search workflows..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20"
              />
            </div>
          </div>
          <select
            value={selectedTrigger}
            onChange={(e) => setSelectedTrigger(e.target.value)}
            className="px-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20"
          >
            <option value="">All Triggers</option>
            {TRIGGER_EVENTS.map(event => (
              <option key={event.value} value={event.value}>{event.label}</option>
            ))}
          </select>
          <select
            value={showActiveOnly === undefined ? '' : showActiveOnly ? 'active' : 'inactive'}
            onChange={(e) => setShowActiveOnly(e.target.value === '' ? undefined : e.target.value === 'active')}
            className="px-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20"
          >
            <option value="">All Status</option>
            <option value="active">Active Only</option>
            <option value="inactive">Inactive Only</option>
          </select>
          <button
            onClick={loadWorkflows}
            className="px-4 py-2 bg-slate-200 text-slate-700 rounded-lg hover:bg-slate-300 transition-colors flex items-center gap-2"
          >
            <Filter className="w-4 h-4" />
            Refresh
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-slate-200 bg-white">
        <div className="flex">
          <button
            onClick={() => setShowTemplates(true)}
            className={`px-6 py-3 font-medium text-sm transition-colors ${
              showTemplates
                ? 'text-blue-600 border-b-2 border-blue-600'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Available Templates ({templates.length})
          </button>
          <button
            onClick={() => setShowTemplates(false)}
            className={`px-6 py-3 font-medium text-sm transition-colors ${
              !showTemplates
                ? 'text-blue-600 border-b-2 border-blue-600'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            My Workflows ({workflows.length})
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4">
        {showTemplates ? (
          /* Templates Section */
          loadingTemplates ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            </div>
          ) : templates.length === 0 ? (
            <div className="text-center py-12 text-slate-500">
              <Activity className="w-12 h-12 mx-auto mb-3 text-slate-400" />
              <p>No templates available</p>
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {templates.map((template) => (
                <div
                  key={template.id}
                  className="bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-200 rounded-lg p-5 hover:shadow-lg transition-all"
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1">
                      <h3 className="text-lg font-semibold text-slate-800 mb-1">{template.name}</h3>
                      {template.description && (
                        <p className="text-slate-600 text-sm mb-3">{template.description}</p>
                      )}
                      {template.category && (
                        <span className="inline-block px-2 py-1 bg-blue-100 text-blue-800 rounded-full text-xs font-medium mb-3">
                          {template.category}
                        </span>
                      )}
                      {template.template_data?.triggerEvent && (
                        <div className="text-sm text-slate-500 mb-3">
                          <span className="font-medium">Trigger:</span>{' '}
                          {getTriggerEventLabel(template.template_data.triggerEvent)}
                        </div>
                      )}
                      {template.template_data?.steps && (
                        <div className="text-sm text-slate-500 mb-4">
                          <span className="font-medium">{template.template_data.steps.length}</span> steps configured
                        </div>
                      )}
                    </div>
                    {template.is_default && (
                      <span className="px-2 py-1 bg-green-100 text-green-800 rounded-full text-xs font-medium">
                        Default
                      </span>
                    )}
                  </div>
                  <button
                    onClick={() => handleCreateFromTemplate(template.id)}
                    className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center justify-center gap-2 font-medium"
                  >
                    <Plus className="w-4 h-4" />
                    Create from Template
                  </button>
                </div>
              ))}
            </div>
          )
        ) : (
          /* Workflows List */
          loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            </div>
          ) : filteredWorkflows.length === 0 ? (
          <div className="text-center py-12 text-slate-500">
            <Activity className="w-12 h-12 mx-auto mb-3 text-slate-400" />
            <p>No workflows found</p>
            <button
              onClick={() => {
                setSelectedWorkflow(null);
                setShowBuilder(true);
              }}
              className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              Create Your First Workflow
            </button>
          </div>
        ) : (
          <div className="grid gap-4">
            {filteredWorkflows.map((workflow) => (
              <div
                key={workflow.id}
                className="bg-white border border-slate-200 rounded-lg p-4 hover:shadow-md transition-shadow"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="text-lg font-semibold text-slate-800">{workflow.name}</h3>
                      <span className={`px-2 py-1 rounded-full text-xs font-medium border ${getStatusColor(workflow.is_active)}`}>
                        {workflow.is_active ? 'Active' : 'Inactive'}
                      </span>
                      {workflow.priority > 0 && (
                        <span className="px-2 py-1 bg-purple-100 text-purple-800 rounded-full text-xs font-medium">
                          Priority: {workflow.priority}
                        </span>
                      )}
                    </div>
                    {workflow.description && (
                      <p className="text-slate-600 text-sm mb-2">{workflow.description}</p>
                    )}
                    <div className="flex items-center gap-4 text-sm text-slate-500">
                      <span className="flex items-center gap-1">
                        <Clock className="w-4 h-4" />
                        Trigger: {getTriggerEventLabel(workflow.trigger_event)}
                      </span>
                      {workflow.steps && (
                        <span className="flex items-center gap-1">
                          <Activity className="w-4 h-4" />
                          {workflow.steps.length} step{workflow.steps.length !== 1 ? 's' : ''}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleTestWorkflow(workflow)}
                      className="p-2 text-green-600 hover:bg-green-50 rounded-lg transition-colors"
                      title="Test Workflow"
                      disabled={!workflow.is_active}
                    >
                      <Zap className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => {
                        setSelectedWorkflow(workflow);
                        setShowExecutionViewer(true);
                      }}
                      className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                      title="View Executions"
                    >
                      <Eye className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => {
                        setSelectedWorkflow(workflow);
                        setShowBuilder(true);
                      }}
                      className="p-2 text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                      title="Edit"
                    >
                      <Edit className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleToggleActive(workflow)}
                      className={`p-2 rounded-lg transition-colors ${
                        workflow.is_active
                          ? 'text-orange-600 hover:bg-orange-50'
                          : 'text-green-600 hover:bg-green-50'
                      }`}
                      title={workflow.is_active ? 'Deactivate' : 'Activate'}
                    >
                      {workflow.is_active ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                    </button>
                    <button
                      onClick={() => handleDuplicate(workflow.id)}
                      className="p-2 text-purple-600 hover:bg-purple-50 rounded-lg transition-colors"
                      title="Duplicate"
                    >
                      <Copy className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDeleteClick(workflow.id)}
                      className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                      title="Delete"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )
        )}
      </div>

      {/* Modals */}
      {showBuilder && (
        <WorkflowBuilder
          workflow={selectedWorkflow}
          tenantSlug={tenantSlug}
          token={token}
          onClose={() => {
            setShowBuilder(false);
            setSelectedWorkflow(null);
            loadWorkflows();
          }}
        />
      )}

      {showExecutionViewer && selectedWorkflow && (
        <WorkflowExecutionViewer
          workflowId={selectedWorkflow.id}
          tenantSlug={tenantSlug}
          token={token}
          onClose={() => {
            setShowExecutionViewer(false);
            setSelectedWorkflow(null);
          }}
        />
      )}

      {/* Confirmation Dialog */}
      <ConfirmDialog
        open={deleteConfirm.open}
        title="Delete Workflow"
        message="Are you sure you want to delete this workflow? This action cannot be undone."
        confirmText="Delete"
        cancelText="Cancel"
        variant="danger"
        onConfirm={handleDeleteConfirm}
        onCancel={handleDeleteCancel}
      />
    </div>
  );
};

export default WorkflowList;

