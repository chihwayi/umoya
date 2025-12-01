import React, { useState, useEffect } from 'react';
import { X, Plus, Trash2, Save, ChevronUp, ChevronDown, Settings, Eye, Play } from 'lucide-react';
import { ehrApi } from '../services/api';
import { useNotification } from './GlobalNotification';

interface WorkflowStep {
  id?: string;
  step_order?: number;
  step_type: string;
  step_config: any;
  conditions?: any;
  timeout_minutes?: number;
  is_required: boolean;
}

interface Workflow {
  id?: string;
  name: string;
  description: string;
  trigger_event: string;
  trigger_conditions?: any;
  is_active: boolean;
  priority: number;
  steps: WorkflowStep[];
}

interface WorkflowBuilderProps {
  workflow?: Workflow | null;
  tenantSlug: string;
  token: string;
  onClose: () => void;
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

const STEP_TYPES = [
  { value: 'assign_role', label: 'Assign to Role' },
  { value: 'send_notification', label: 'Send Notification' },
  { value: 'create_task', label: 'Create Task' },
  { value: 'update_status', label: 'Update Status' },
  { value: 'create_order', label: 'Create Order' },
  { value: 'assign_appointment', label: 'Assign Appointment' },
  { value: 'send_message', label: 'Send Message' },
  { value: 'wait', label: 'Wait' },
  { value: 'condition', label: 'Condition' },
];

const WorkflowBuilder: React.FC<WorkflowBuilderProps> = ({ workflow, tenantSlug, token, onClose }) => {
  const { showSuccess, showError } = useNotification();
  const [saving, setSaving] = useState(false);
  const [currentTab, setCurrentTab] = useState<'design' | 'preview'>('design');

  const [formData, setFormData] = useState<Workflow>({
    name: workflow?.name || '',
    description: workflow?.description || '',
    trigger_event: workflow?.trigger_event || 'patient_check_in',
    trigger_conditions: workflow?.trigger_conditions || {},
    is_active: workflow?.is_active !== false,
    priority: workflow?.priority || 0,
    steps: workflow?.steps || [],
  });

  const addStep = () => {
    setFormData({
      ...formData,
      steps: [
        ...formData.steps,
        {
          step_type: 'send_notification',
          step_config: {},
          is_required: true,
        },
      ],
    });
  };

  const updateStep = (index: number, updates: Partial<WorkflowStep>) => {
    const updated = [...formData.steps];
    updated[index] = { ...updated[index], ...updates };
    setFormData({ ...formData, steps: updated });
  };

  const removeStep = (index: number) => {
    setFormData({
      ...formData,
      steps: formData.steps.filter((_, i) => i !== index),
    });
  };

  const moveStep = (index: number, direction: 'up' | 'down') => {
    const steps = [...formData.steps];
    if (direction === 'up' && index > 0) {
      [steps[index - 1], steps[index]] = [steps[index], steps[index - 1]];
    } else if (direction === 'down' && index < steps.length - 1) {
      [steps[index], steps[index + 1]] = [steps[index + 1], steps[index]];
    }
    setFormData({ ...formData, steps });
  };

  const renderStepConfig = (step: WorkflowStep, index: number) => {
    const config = step.step_config || {};

    switch (step.step_type) {
      case 'send_notification':
        return (
          <div className="space-y-3">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">User IDs (comma-separated)</label>
              <input
                type="text"
                value={config.userIds?.join(',') || ''}
                onChange={(e) =>
                  updateStep(index, {
                    step_config: {
                      ...config,
                      userIds: e.target.value.split(',').map((id) => id.trim()).filter(Boolean),
                    },
                  })
                }
                placeholder="user-id-1, user-id-2"
                className="w-full border border-slate-200 rounded-lg px-3 py-2"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Message</label>
              <textarea
                value={config.message || ''}
                onChange={(e) => updateStep(index, { step_config: { ...config, message: e.target.value } })}
                rows={3}
                className="w-full border border-slate-200 rounded-lg px-3 py-2"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Priority</label>
              <select
                value={config.priority || 'normal'}
                onChange={(e) => updateStep(index, { step_config: { ...config, priority: e.target.value } })}
                className="w-full border border-slate-200 rounded-lg px-3 py-2"
              >
                <option value="low">Low</option>
                <option value="normal">Normal</option>
                <option value="high">High</option>
                <option value="urgent">Urgent</option>
              </select>
            </div>
          </div>
        );

      case 'create_task':
        return (
          <div className="space-y-3">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Assigned To (User ID)</label>
              <input
                type="text"
                value={config.assignedTo || ''}
                onChange={(e) => updateStep(index, { step_config: { ...config, assignedTo: e.target.value } })}
                className="w-full border border-slate-200 rounded-lg px-3 py-2"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Task Title</label>
              <input
                type="text"
                value={config.title || ''}
                onChange={(e) => updateStep(index, { step_config: { ...config, title: e.target.value } })}
                className="w-full border border-slate-200 rounded-lg px-3 py-2"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Description</label>
              <textarea
                value={config.description || ''}
                onChange={(e) => updateStep(index, { step_config: { ...config, description: e.target.value } })}
                rows={3}
                className="w-full border border-slate-200 rounded-lg px-3 py-2"
              />
            </div>
          </div>
        );

      case 'update_status':
        return (
          <div className="space-y-3">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Entity Type</label>
              <input
                type="text"
                value={config.entityType || ''}
                onChange={(e) => updateStep(index, { step_config: { ...config, entityType: e.target.value } })}
                placeholder="appointments, lab_orders, etc."
                className="w-full border border-slate-200 rounded-lg px-3 py-2"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Entity ID (from trigger)</label>
              <input
                type="text"
                value={config.entityId || ''}
                onChange={(e) => updateStep(index, { step_config: { ...config, entityId: e.target.value } })}
                placeholder="Use trigger entity ID"
                className="w-full border border-slate-200 rounded-lg px-3 py-2"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">New Status</label>
              <input
                type="text"
                value={config.status || ''}
                onChange={(e) => updateStep(index, { step_config: { ...config, status: e.target.value } })}
                className="w-full border border-slate-200 rounded-lg px-3 py-2"
              />
            </div>
          </div>
        );

      case 'wait':
        return (
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Wait Duration (minutes)</label>
            <input
              type="number"
              value={config.durationMinutes || ''}
              onChange={(e) =>
                updateStep(index, { step_config: { ...config, durationMinutes: parseInt(e.target.value) || 0 } })
              }
              className="w-full border border-slate-200 rounded-lg px-3 py-2"
            />
          </div>
        );

      default:
        return (
          <div className="text-sm text-slate-500">
            Configuration for {step.step_type} step type
          </div>
        );
    }
  };

  const handleSave = async () => {
    if (!formData.name.trim()) {
      showError('Validation Error', 'Workflow name is required');
      return;
    }
    if (formData.steps.length === 0) {
      showError('Validation Error', 'At least one step is required');
      return;
    }

    setSaving(true);
    try {
      if (workflow?.id) {
        await ehrApi.updateWorkflow(workflow.id, formData, token, tenantSlug);
        showSuccess('Success', 'Workflow updated successfully!');
      } else {
        await ehrApi.createWorkflow(formData, token, tenantSlug);
        showSuccess('Success', 'Workflow created successfully!');
      }
      onClose();
    } catch (error: any) {
      showError('Error', error.response?.data?.message || 'Failed to save workflow');
    } finally {
      setSaving(false);
    }
  };

  if (!workflow && !formData.name) {
    // Initial state - show template selection or basic form
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-600 to-indigo-700 text-white p-6 flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold">{workflow?.id ? 'Edit' : 'Create'} Workflow</h2>
            <p className="text-blue-100 text-sm mt-1">Design automated clinical workflows</p>
          </div>
          <button onClick={onClose} className="text-white hover:bg-white/20 rounded-lg p-2 transition-colors">
            <X className="h-6 w-6" />
          </button>
        </div>

        {/* Tabs */}
        <div className="border-b border-slate-200">
          <nav className="-mb-px flex space-x-8 px-6">
            <button
              onClick={() => setCurrentTab('design')}
              className={`whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm ${
                currentTab === 'design'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
              }`}
            >
              Design
            </button>
            <button
              onClick={() => setCurrentTab('preview')}
              className={`whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm ${
                currentTab === 'preview'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
              }`}
            >
              Preview
            </button>
          </nav>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 bg-slate-50">
          {currentTab === 'design' && (
            <div className="space-y-6">
              {/* Basic Info */}
              <div className="bg-white p-6 rounded-lg shadow-sm border border-slate-200">
                <h3 className="text-lg font-semibold text-slate-800 mb-4">Basic Information</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      Workflow Name <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      className="w-full border border-slate-200 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500/20"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Trigger Event</label>
                    <select
                      value={formData.trigger_event}
                      onChange={(e) => setFormData({ ...formData, trigger_event: e.target.value })}
                      className="w-full border border-slate-200 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500/20"
                    >
                      {TRIGGER_EVENTS.map((event) => (
                        <option key={event.value} value={event.value}>
                          {event.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-slate-700 mb-1">Description</label>
                    <textarea
                      value={formData.description}
                      onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                      rows={2}
                      className="w-full border border-slate-200 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500/20"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Priority</label>
                    <input
                      type="number"
                      value={formData.priority}
                      onChange={(e) => setFormData({ ...formData, priority: parseInt(e.target.value) || 0 })}
                      className="w-full border border-slate-200 rounded-lg px-3 py-2"
                    />
                  </div>
                  <div className="flex items-center gap-3">
                    <input
                      type="checkbox"
                      id="isActive"
                      checked={formData.is_active}
                      onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                      className="w-4 h-4 text-blue-600 border-slate-300 rounded focus:ring-blue-500"
                    />
                    <label htmlFor="isActive" className="text-sm font-medium text-slate-700">
                      Active
                    </label>
                  </div>
                </div>
              </div>

              {/* Workflow Steps */}
              <div className="bg-white p-6 rounded-lg shadow-sm border border-slate-200">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-slate-800">Workflow Steps</h3>
                  <button
                    onClick={addStep}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2 text-sm"
                  >
                    <Plus className="w-4 h-4" />
                    Add Step
                  </button>
                </div>

                <div className="space-y-4">
                  {formData.steps.map((step, index) => (
                    <div key={index} className="bg-slate-50 border border-slate-200 rounded-lg p-4">
                      <div className="flex items-center justify-between mb-3">
                        <h4 className="font-medium text-slate-700">Step {index + 1}</h4>
                        <div className="flex gap-1">
                          <button
                            onClick={() => moveStep(index, 'up')}
                            disabled={index === 0}
                            className="p-1 text-slate-500 hover:bg-slate-100 rounded-md disabled:opacity-50"
                          >
                            <ChevronUp className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => moveStep(index, 'down')}
                            disabled={index === formData.steps.length - 1}
                            className="p-1 text-slate-500 hover:bg-slate-100 rounded-md disabled:opacity-50"
                          >
                            <ChevronDown className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => removeStep(index)}
                            className="p-1 text-red-600 hover:bg-red-50 rounded-md"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                      <div className="space-y-3">
                        <div>
                          <label className="block text-sm font-medium text-slate-700 mb-1">Step Type</label>
                          <select
                            value={step.step_type}
                            onChange={(e) => updateStep(index, { step_type: e.target.value, step_config: {} })}
                            className="w-full border border-slate-200 rounded-lg px-3 py-2"
                          >
                            {STEP_TYPES.map((type) => (
                              <option key={type.value} value={type.value}>
                                {type.label}
                              </option>
                            ))}
                          </select>
                        </div>
                        {renderStepConfig(step, index)}
                        <div className="flex items-center gap-3">
                          <input
                            type="checkbox"
                            id={`required-${index}`}
                            checked={step.is_required}
                            onChange={(e) => updateStep(index, { is_required: e.target.checked })}
                            className="w-4 h-4 text-blue-600 border-slate-300 rounded focus:ring-blue-500"
                          />
                          <label htmlFor={`required-${index}`} className="text-sm font-medium text-slate-700">
                            Required (workflow fails if this step fails)
                          </label>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {currentTab === 'preview' && (
            <div className="bg-white p-6 rounded-lg shadow-sm border border-slate-200">
              <h3 className="text-lg font-semibold text-slate-800 mb-4">Workflow Preview</h3>
              <div className="space-y-4">
                <div>
                  <h4 className="font-medium text-slate-700 mb-2">{formData.name}</h4>
                  <p className="text-slate-600 text-sm mb-4">{formData.description}</p>
                  <div className="text-sm text-slate-500">
                    <p>Trigger: {TRIGGER_EVENTS.find((e) => e.value === formData.trigger_event)?.label}</p>
                    <p>Priority: {formData.priority}</p>
                    <p>Status: {formData.is_active ? 'Active' : 'Inactive'}</p>
                  </div>
                </div>
                <div className="border-t border-slate-200 pt-4">
                  <h5 className="font-medium text-slate-700 mb-3">Steps ({formData.steps.length})</h5>
                  <div className="space-y-2">
                    {formData.steps.map((step, index) => (
                      <div key={index} className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg">
                        <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center font-semibold">
                          {index + 1}
                        </div>
                        <div className="flex-1">
                          <p className="font-medium text-slate-700">
                            {STEP_TYPES.find((t) => t.value === step.step_type)?.label}
                          </p>
                          <p className="text-sm text-slate-500">{step.step_type}</p>
                        </div>
                        {step.is_required && (
                          <span className="px-2 py-1 bg-red-100 text-red-800 rounded-full text-xs font-medium">
                            Required
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-slate-200 p-4 bg-slate-50 flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-200 text-slate-700 rounded-lg hover:bg-slate-300 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2"
          >
            {saving ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                Saving...
              </>
            ) : (
              <>
                <Save className="h-5 w-5" />
                Save Workflow
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default WorkflowBuilder;

