import React, { useState, useEffect } from 'react';
import { X, Plus, Trash2, Save, Calendar, Users, Target, Activity } from 'lucide-react';
import { ehrApi } from '../services/api';
import { useNotification } from './GlobalNotification';
import ConfirmDialog from './ConfirmDialog';

interface CarePlan {
  id?: string;
  patient_id?: string;
  name: string;
  description: string;
  category: string;
  status: string;
  start_date: string;
  end_date?: string;
  target_completion_date?: string;
  primary_provider_id?: string;
  care_team: string[];
  diagnosis_codes: string[];
  notes: string;
  goals: Goal[];
  interventions: Intervention[];
}

interface Goal {
  id?: string;
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
  id?: string;
  goal_id?: string;
  intervention_text: string;
  intervention_type: string;
  frequency?: string;
  duration?: string;
  responsible_role?: string;
  assigned_to?: string;
  status: string;
  start_date?: string;
  end_date?: string;
}

interface CarePlanBuilderProps {
  patientId: string;
  carePlan?: CarePlan | null;
  tenantSlug: string;
  token: string;
  onClose: () => void;
  onSave?: () => void;
}

const CATEGORIES = [
  { value: 'chronic_disease', label: 'Chronic Disease' },
  { value: 'post_surgery', label: 'Post-Surgery' },
  { value: 'preventive_care', label: 'Preventive Care' },
  { value: 'mental_health', label: 'Mental Health' },
  { value: 'maternity', label: 'Maternity' },
  { value: 'pediatric', label: 'Pediatric' },
  { value: 'geriatric', label: 'Geriatric' },
  { value: 'rehabilitation', label: 'Rehabilitation' },
  { value: 'palliative', label: 'Palliative' },
  { value: 'general', label: 'General' },
];

const GOAL_TYPES = [
  { value: 'clinical', label: 'Clinical' },
  { value: 'functional', label: 'Functional' },
  { value: 'behavioral', label: 'Behavioral' },
  { value: 'quality_of_life', label: 'Quality of Life' },
  { value: 'symptom_management', label: 'Symptom Management' },
  { value: 'preventive', label: 'Preventive' },
  { value: 'education', label: 'Education' },
];

const INTERVENTION_TYPES = [
  { value: 'medication', label: 'Medication' },
  { value: 'therapy', label: 'Therapy' },
  { value: 'education', label: 'Education' },
  { value: 'lifestyle', label: 'Lifestyle' },
  { value: 'monitoring', label: 'Monitoring' },
  { value: 'referral', label: 'Referral' },
  { value: 'procedure', label: 'Procedure' },
  { value: 'counseling', label: 'Counseling' },
  { value: 'other', label: 'Other' },
];

const CarePlanBuilder: React.FC<CarePlanBuilderProps> = ({
  patientId,
  carePlan,
  tenantSlug,
  token,
  onClose,
  onSave,
}) => {
  const [formData, setFormData] = useState<CarePlan>({
    patient_id: patientId,
    name: '',
    description: '',
    category: 'general',
    status: 'active',
    start_date: new Date().toISOString().split('T')[0],
    care_team: [],
    diagnosis_codes: [],
    notes: '',
    goals: [],
    interventions: [],
  });

  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<'details' | 'goals' | 'interventions'>('details');
  const { showSuccess, showError } = useNotification();

  useEffect(() => {
    if (carePlan) {
      setFormData({
        ...carePlan,
        goals: carePlan.goals || [],
        interventions: carePlan.interventions || [],
      });
    }
  }, [carePlan]);

  const handleSave = async () => {
    try {
      setSaving(true);

      if (carePlan?.id) {
        // Update existing
        await ehrApi.updateCarePlan(carePlan.id, formData, token, tenantSlug);
        showSuccess('Success', 'Care plan updated successfully');
      } else {
        // Create new
        await ehrApi.createCarePlan(formData, token, tenantSlug);
        showSuccess('Success', 'Care plan created successfully');
      }

      if (onSave) onSave();
      onClose();
    } catch (error: any) {
      showError('Error', error.response?.data?.message || 'Failed to save care plan');
    } finally {
      setSaving(false);
    }
  };

  const addGoal = () => {
    setFormData({
      ...formData,
      goals: [
        ...formData.goals,
        {
          goal_text: '',
          goal_type: 'clinical',
          status: 'in_progress',
          priority: 'normal',
        },
      ],
    });
  };

  const updateGoal = (index: number, updates: Partial<Goal>) => {
    const newGoals = [...formData.goals];
    newGoals[index] = { ...newGoals[index], ...updates };
    setFormData({ ...formData, goals: newGoals });
  };

  const removeGoal = (index: number) => {
    setFormData({
      ...formData,
      goals: formData.goals.filter((_, i) => i !== index),
    });
  };

  const addIntervention = () => {
    setFormData({
      ...formData,
      interventions: [
        ...formData.interventions,
        {
          intervention_text: '',
          intervention_type: 'medication',
          status: 'pending',
        },
      ],
    });
  };

  const updateIntervention = (index: number, updates: Partial<Intervention>) => {
    const newInterventions = [...formData.interventions];
    newInterventions[index] = { ...newInterventions[index], ...updates };
    setFormData({ ...formData, interventions: newInterventions });
  };

  const removeIntervention = (index: number) => {
    setFormData({
      ...formData,
      interventions: formData.interventions.filter((_, i) => i !== index),
    });
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-6xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="bg-gradient-to-r from-teal-600 to-cyan-700 text-white p-6 flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold flex items-center gap-3">
              <Activity className="w-6 h-6" />
              {carePlan?.id ? 'Edit Care Plan' : 'Create Care Plan'}
            </h2>
            <p className="text-teal-100 text-sm mt-1">
              {carePlan?.id ? 'Update care plan details, goals, and interventions' : 'Build a comprehensive care plan for the patient'}
            </p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-white/20 rounded-lg transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tabs */}
        <div className="border-b border-slate-200 bg-slate-50 px-6">
          <div className="flex gap-4">
            <button
              onClick={() => setActiveTab('details')}
              className={`px-4 py-3 font-medium transition-colors border-b-2 ${
                activeTab === 'details'
                  ? 'border-teal-600 text-teal-600'
                  : 'border-transparent text-slate-600 hover:text-slate-900'
              }`}
            >
              Plan Details
            </button>
            <button
              onClick={() => setActiveTab('goals')}
              className={`px-4 py-3 font-medium transition-colors border-b-2 ${
                activeTab === 'goals'
                  ? 'border-teal-600 text-teal-600'
                  : 'border-transparent text-slate-600 hover:text-slate-900'
              }`}
            >
              Goals ({formData.goals.length})
            </button>
            <button
              onClick={() => setActiveTab('interventions')}
              className={`px-4 py-3 font-medium transition-colors border-b-2 ${
                activeTab === 'interventions'
                  ? 'border-teal-600 text-teal-600'
                  : 'border-transparent text-slate-600 hover:text-slate-900'
              }`}
            >
              Interventions ({formData.interventions.length})
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {activeTab === 'details' && (
            <div className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-slate-700 mb-2">Plan Name *</label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                    placeholder="e.g., Diabetes Management Plan"
                    required
                  />
                </div>

                <div className="col-span-2">
                  <label className="block text-sm font-medium text-slate-700 mb-2">Description</label>
                  <textarea
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                    rows={3}
                    placeholder="Describe the care plan objectives and approach"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Category *</label>
                  <select
                    value={formData.category}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                    required
                  >
                    {CATEGORIES.map((cat) => (
                      <option key={cat.value} value={cat.value}>
                        {cat.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Status</label>
                  <select
                    value={formData.status}
                    onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                  >
                    <option value="draft">Draft</option>
                    <option value="active">Active</option>
                    <option value="on_hold">On Hold</option>
                    <option value="completed">Completed</option>
                    <option value="cancelled">Cancelled</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Start Date *</label>
                  <input
                    type="date"
                    value={formData.start_date}
                    onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Target Completion Date</label>
                  <input
                    type="date"
                    value={formData.target_completion_date || ''}
                    onChange={(e) => setFormData({ ...formData, target_completion_date: e.target.value })}
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                  />
                </div>

                <div className="col-span-2">
                  <label className="block text-sm font-medium text-slate-700 mb-2">Notes</label>
                  <textarea
                    value={formData.notes}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                    rows={3}
                    placeholder="Additional notes about the care plan"
                  />
                </div>
              </div>
            </div>
          )}

          {activeTab === 'goals' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-slate-800">Care Plan Goals</h3>
                <button
                  onClick={addGoal}
                  className="px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition-colors flex items-center gap-2"
                >
                  <Plus className="w-4 h-4" />
                  Add Goal
                </button>
              </div>

              {formData.goals.length === 0 ? (
                <div className="text-center py-12 text-slate-500">
                  <Target className="w-12 h-12 mx-auto mb-3 text-slate-400" />
                  <p className="text-lg font-medium">No goals added yet</p>
                  <p className="text-sm text-slate-400 mt-1">Click "Add Goal" to define care plan objectives</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {formData.goals.map((goal, index) => (
                    <div key={index} className="bg-slate-50 border border-slate-200 rounded-lg p-4">
                      <div className="flex items-start justify-between mb-3">
                        <h4 className="font-medium text-slate-800">Goal {index + 1}</h4>
                        <button
                          onClick={() => removeGoal(index)}
                          className="p-1 text-red-600 hover:bg-red-50 rounded transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div className="col-span-2">
                          <label className="block text-sm font-medium text-slate-700 mb-1">Goal Description *</label>
                          <textarea
                            value={goal.goal_text}
                            onChange={(e) => updateGoal(index, { goal_text: e.target.value })}
                            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent text-sm"
                            rows={2}
                            placeholder="e.g., Achieve HbA1c level below 7%"
                            required
                          />
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-slate-700 mb-1">Goal Type *</label>
                          <select
                            value={goal.goal_type}
                            onChange={(e) => updateGoal(index, { goal_type: e.target.value })}
                            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent text-sm"
                            required
                          >
                            {GOAL_TYPES.map((type) => (
                              <option key={type.value} value={type.value}>
                                {type.label}
                              </option>
                            ))}
                          </select>
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-slate-700 mb-1">Priority</label>
                          <select
                            value={goal.priority}
                            onChange={(e) => updateGoal(index, { priority: e.target.value })}
                            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent text-sm"
                          >
                            <option value="low">Low</option>
                            <option value="normal">Normal</option>
                            <option value="high">High</option>
                            <option value="urgent">Urgent</option>
                          </select>
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-slate-700 mb-1">Target Value</label>
                          <input
                            type="text"
                            value={goal.target_value || ''}
                            onChange={(e) => updateGoal(index, { target_value: e.target.value })}
                            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent text-sm"
                            placeholder="e.g., < 7%"
                          />
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-slate-700 mb-1">Measurement Unit</label>
                          <input
                            type="text"
                            value={goal.measurement_unit || ''}
                            onChange={(e) => updateGoal(index, { measurement_unit: e.target.value })}
                            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent text-sm"
                            placeholder="e.g., %, mmHg, kg"
                          />
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-slate-700 mb-1">Target Date</label>
                          <input
                            type="date"
                            value={goal.target_date || ''}
                            onChange={(e) => updateGoal(index, { target_date: e.target.value })}
                            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent text-sm"
                          />
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-slate-700 mb-1">Status</label>
                          <select
                            value={goal.status}
                            onChange={(e) => updateGoal(index, { status: e.target.value })}
                            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent text-sm"
                          >
                            <option value="not_started">Not Started</option>
                            <option value="in_progress">In Progress</option>
                            <option value="achieved">Achieved</option>
                            <option value="partially_achieved">Partially Achieved</option>
                            <option value="not_achieved">Not Achieved</option>
                            <option value="on_hold">On Hold</option>
                          </select>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {activeTab === 'interventions' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-slate-800">Care Plan Interventions</h3>
                <button
                  onClick={addIntervention}
                  className="px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition-colors flex items-center gap-2"
                >
                  <Plus className="w-4 h-4" />
                  Add Intervention
                </button>
              </div>

              {formData.interventions.length === 0 ? (
                <div className="text-center py-12 text-slate-500">
                  <Activity className="w-12 h-12 mx-auto mb-3 text-slate-400" />
                  <p className="text-lg font-medium">No interventions added yet</p>
                  <p className="text-sm text-slate-400 mt-1">Click "Add Intervention" to define care actions</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {formData.interventions.map((intervention, index) => (
                    <div key={index} className="bg-slate-50 border border-slate-200 rounded-lg p-4">
                      <div className="flex items-start justify-between mb-3">
                        <h4 className="font-medium text-slate-800">Intervention {index + 1}</h4>
                        <button
                          onClick={() => removeIntervention(index)}
                          className="p-1 text-red-600 hover:bg-red-50 rounded transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div className="col-span-2">
                          <label className="block text-sm font-medium text-slate-700 mb-1">Intervention Description *</label>
                          <textarea
                            value={intervention.intervention_text}
                            onChange={(e) => updateIntervention(index, { intervention_text: e.target.value })}
                            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent text-sm"
                            rows={2}
                            placeholder="e.g., Metformin 500mg twice daily"
                            required
                          />
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-slate-700 mb-1">Intervention Type *</label>
                          <select
                            value={intervention.intervention_type}
                            onChange={(e) => updateIntervention(index, { intervention_type: e.target.value })}
                            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent text-sm"
                            required
                          >
                            {INTERVENTION_TYPES.map((type) => (
                              <option key={type.value} value={type.value}>
                                {type.label}
                              </option>
                            ))}
                          </select>
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-slate-700 mb-1">Frequency</label>
                          <input
                            type="text"
                            value={intervention.frequency || ''}
                            onChange={(e) => updateIntervention(index, { frequency: e.target.value })}
                            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent text-sm"
                            placeholder="e.g., Twice daily, Weekly"
                          />
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-slate-700 mb-1">Duration</label>
                          <input
                            type="text"
                            value={intervention.duration || ''}
                            onChange={(e) => updateIntervention(index, { duration: e.target.value })}
                            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent text-sm"
                            placeholder="e.g., 6 months, Ongoing"
                          />
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-slate-700 mb-1">Responsible Role</label>
                          <input
                            type="text"
                            value={intervention.responsible_role || ''}
                            onChange={(e) => updateIntervention(index, { responsible_role: e.target.value })}
                            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent text-sm"
                            placeholder="e.g., doctor, nurse, patient"
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-slate-200 p-6 bg-slate-50 flex items-center justify-between">
          <button
            onClick={onClose}
            className="px-6 py-2 text-slate-700 hover:bg-slate-200 rounded-lg transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving || !formData.name || !formData.category}
            className="px-6 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Save className="w-4 h-4" />
            {saving ? 'Saving...' : carePlan?.id ? 'Update Care Plan' : 'Create Care Plan'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default CarePlanBuilder;
