import React, { useState } from 'react';
import { X, Save, TrendingUp } from 'lucide-react';
import { ehrApi } from '../services/api';
import { useNotification } from './GlobalNotification';

interface Goal {
  id: string;
  goal_number: number;
  goal_text: string;
  goal_type: string;
  target_value?: string;
  current_value?: string;
  measurement_unit?: string;
}

interface Intervention {
  id: string;
  intervention_number: number;
  intervention_text: string;
  intervention_type: string;
}

interface CarePlanProgressProps {
  carePlanId: string;
  goals: Goal[];
  interventions: Intervention[];
  tenantSlug: string;
  token: string;
  onClose: () => void;
}

const PROGRESS_TYPES = [
  { value: 'goal_update', label: 'Goal Update' },
  { value: 'intervention_completed', label: 'Intervention Completed' },
  { value: 'milestone_reached', label: 'Milestone Reached' },
  { value: 'status_change', label: 'Status Change' },
  { value: 'note', label: 'General Note' },
];

const CarePlanProgress: React.FC<CarePlanProgressProps> = ({
  carePlanId,
  goals,
  interventions,
  tenantSlug,
  token,
  onClose,
}) => {
  const [progressData, setProgressData] = useState({
    progressType: 'goal_update',
    goalId: '',
    interventionId: '',
    progressDate: new Date().toISOString().split('T')[0],
    currentValue: '',
    progressPercentage: '',
    notes: '',
  });

  const [saving, setSaving] = useState(false);
  const { showSuccess, showError } = useNotification();

  const handleSave = async () => {
    try {
      setSaving(true);

      const data: any = {
        progressType: progressData.progressType,
        progressDate: progressData.progressDate,
        notes: progressData.notes,
      };

      if (progressData.goalId) {
        data.goalId = progressData.goalId;
      }

      if (progressData.interventionId) {
        data.interventionId = progressData.interventionId;
      }

      if (progressData.currentValue) {
        data.currentValue = progressData.currentValue;
      }

      if (progressData.progressPercentage) {
        data.progressPercentage = parseInt(progressData.progressPercentage, 10);
      }

      await ehrApi.recordProgress(carePlanId, data, token, tenantSlug);
      showSuccess('Success', 'Progress recorded successfully');
      onClose();
    } catch (error: any) {
      showError('Error', error.response?.data?.message || 'Failed to record progress');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-[60] flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="bg-gradient-to-r from-teal-600 to-cyan-700 text-white p-6 flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold flex items-center gap-3">
              <TrendingUp className="w-6 h-6" />
              Record Progress
            </h2>
            <p className="text-teal-100 text-sm mt-1">Update care plan progress and outcomes</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-white/20 rounded-lg transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Progress Type *</label>
              <select
                value={progressData.progressType}
                onChange={(e) => setProgressData({ ...progressData, progressType: e.target.value })}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                required
              >
                {PROGRESS_TYPES.map((type) => (
                  <option key={type.value} value={type.value}>
                    {type.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Progress Date *</label>
              <input
                type="date"
                value={progressData.progressDate}
                onChange={(e) => setProgressData({ ...progressData, progressDate: e.target.value })}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                required
              />
            </div>

            {goals.length > 0 && (
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Related Goal (Optional)</label>
                <select
                  value={progressData.goalId}
                  onChange={(e) => setProgressData({ ...progressData, goalId: e.target.value })}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                >
                  <option value="">-- Select Goal --</option>
                  {goals.map((goal) => (
                    <option key={goal.id} value={goal.id}>
                      Goal {goal.goal_number}: {goal.goal_text}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {interventions.length > 0 && (
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Related Intervention (Optional)</label>
                <select
                  value={progressData.interventionId}
                  onChange={(e) => setProgressData({ ...progressData, interventionId: e.target.value })}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                >
                  <option value="">-- Select Intervention --</option>
                  {interventions.map((intervention) => (
                    <option key={intervention.id} value={intervention.id}>
                      Intervention {intervention.intervention_number}: {intervention.intervention_text}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {progressData.goalId && (
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Current Value</label>
                <input
                  type="text"
                  value={progressData.currentValue}
                  onChange={(e) => setProgressData({ ...progressData, currentValue: e.target.value })}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                  placeholder="e.g., 6.8%, 145/85 mmHg"
                />
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Progress Percentage</label>
              <input
                type="number"
                min="0"
                max="100"
                value={progressData.progressPercentage}
                onChange={(e) => setProgressData({ ...progressData, progressPercentage: e.target.value })}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                placeholder="0-100"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Notes *</label>
              <textarea
                value={progressData.notes}
                onChange={(e) => setProgressData({ ...progressData, notes: e.target.value })}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                rows={4}
                placeholder="Describe the progress update, observations, or changes"
                required
              />
            </div>
          </div>
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
            disabled={saving || !progressData.notes}
            className="px-6 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Save className="w-4 h-4" />
            {saving ? 'Saving...' : 'Record Progress'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default CarePlanProgress;
