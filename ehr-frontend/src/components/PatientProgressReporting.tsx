import React, { useState } from 'react';
import { TrendingUp, X, Save } from 'lucide-react';
import { ehrApi } from '../services/api';
import { useNotification } from './GlobalNotification';

interface PatientProgressReportingProps {
  carePlan: any;
  goal: any;
  tenantSlug: string;
  token: string;
  onClose: () => void;
  onSuccess: () => void;
}

const PatientProgressReporting: React.FC<PatientProgressReportingProps> = ({
  carePlan,
  goal,
  tenantSlug,
  token,
  onClose,
  onSuccess,
}) => {
  const [currentValue, setCurrentValue] = useState(goal.current_value || 0);
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const { showError } = useNotification();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!currentValue && currentValue !== 0) {
      showError('Validation Error', 'Please enter a value');
      return;
    }

    try {
      setSubmitting(true);
      const response = await ehrApi.reportGoalProgress(
        carePlan.id,
        goal.id,
        {
          currentValue: parseFloat(currentValue.toString()),
          notes: notes || undefined,
        },
        token,
        tenantSlug
      );

      // Check if goal was achieved or care plan completed
      if (response.data.goalAchieved) {
        showError('🎉 Congratulations!', 'You achieved this goal!');
      }
      if (response.data.carePlanCompleted) {
        showError('🎊 Amazing!', 'You completed all goals in your care plan!');
      }

      onSuccess();
    } catch (error: any) {
      console.error('Failed to report progress:', error);
      showError('Error', error.response?.data?.message || 'Failed to report progress');
    } finally {
      setSubmitting(false);
    }
  };

  const calculateProgress = () => {
    if (!goal.target_value) return 0;
    return Math.min(100, Math.round((currentValue / goal.target_value) * 100));
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full">
        {/* Header */}
        <div className="bg-gradient-to-r from-teal-600 to-cyan-700 text-white p-6 rounded-t-xl">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-xl font-bold flex items-center gap-2">
                <TrendingUp className="w-5 h-5" />
                Report Your Progress
              </h3>
              <p className="text-teal-100 text-sm mt-1">Update your progress on this goal</p>
            </div>
            <button onClick={onClose} className="p-2 hover:bg-white/20 rounded-lg transition-colors">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content */}
        <form onSubmit={handleSubmit} className="p-6">
          {/* Goal Info */}
          <div className="bg-slate-50 rounded-lg p-4 mb-6">
            <h4 className="font-semibold text-slate-800 mb-2">{goal.goal_text}</h4>
            <div className="text-sm text-slate-600">
              {goal.target_value && (
                <p>
                  Target: {goal.target_value} {goal.measurement_unit}
                </p>
              )}
              {goal.current_value && (
                <p>
                  Current: {goal.current_value} {goal.measurement_unit}
                </p>
              )}
            </div>
          </div>

          {/* Current Value Input */}
          <div className="mb-6">
            <label className="block text-sm font-semibold text-slate-700 mb-2">
              Current Value {goal.measurement_unit && `(${goal.measurement_unit})`}
            </label>
            <input
              type="number"
              step="0.01"
              value={currentValue}
              onChange={(e) => setCurrentValue(parseFloat(e.target.value) || 0)}
              className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent text-lg font-semibold"
              required
            />
          </div>

          {/* Progress Bar */}
          {goal.target_value && (
            <div className="mb-6">
              <div className="flex justify-between text-sm text-slate-600 mb-2">
                <span>Progress</span>
                <span className="font-semibold">{calculateProgress()}%</span>
              </div>
              <div className="w-full bg-slate-200 rounded-full h-3">
                <div
                  className={`h-3 rounded-full transition-all ${
                    calculateProgress() >= 100 ? 'bg-green-500' : 'bg-teal-600'
                  }`}
                  style={{ width: `${calculateProgress()}%` }}
                ></div>
              </div>
              {calculateProgress() >= 100 && (
                <p className="text-green-600 text-sm font-medium mt-2 flex items-center gap-1">
                  🎉 You've reached your target!
                </p>
              )}
            </div>
          )}

          {/* Notes */}
          <div className="mb-6">
            <label className="block text-sm font-semibold text-slate-700 mb-2">
              Notes (Optional)
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={4}
              placeholder="How are you feeling? Any challenges or successes to share?"
              className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent resize-none"
            />
          </div>

          {/* Actions */}
          <div className="flex gap-3">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-3 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors font-medium"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="flex-1 px-4 py-3 bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition-colors font-medium flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {submitting ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  Submitting...
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  Submit Progress
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default PatientProgressReporting;


