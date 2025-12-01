import React, { useState } from 'react';
import { usePatientAuth } from '../contexts/PatientAuthContext';
import { patientPortalApi } from '../services/api';
import { useTenantSlug } from '../hooks/useTenantSlug';
import { useNotification } from '../components/GlobalNotification';
import { useNavigate, Link } from 'react-router-dom';
import { ArrowLeft, Target, Save } from 'lucide-react';

const CreateGoalPage: React.FC = () => {
  const { token } = usePatientAuth();
  const tenantSlug = useTenantSlug();
  const navigate = useNavigate();
  const { showError, showSuccess } = useNotification();

  const [formData, setFormData] = useState({
    goalType: 'weight_loss',
    goalName: '',
    description: '',
    targetValue: '',
    currentValue: '',
    unit: '',
    startDate: new Date().toISOString().split('T')[0],
    targetDate: '',
    isAutoTracked: false,
    notes: '',
  });

  const [loading, setLoading] = useState(false);

  const goalTypes = [
    { value: 'weight_loss', label: 'Weight Loss' },
    { value: 'weight_gain', label: 'Weight Gain' },
    { value: 'blood_pressure', label: 'Blood Pressure Control' },
    { value: 'blood_glucose', label: 'Blood Glucose Control' },
    { value: 'cholesterol', label: 'Cholesterol Management' },
    { value: 'exercise', label: 'Exercise' },
    { value: 'medication_adherence', label: 'Medication Adherence' },
    { value: 'smoking_cessation', label: 'Smoking Cessation' },
    { value: 'alcohol_reduction', label: 'Alcohol Reduction' },
    { value: 'diet', label: 'Diet' },
    { value: 'other', label: 'Other' },
  ];

  const getDefaultUnit = (goalType: string) => {
    const units: Record<string, string> = {
      weight_loss: 'kg',
      weight_gain: 'kg',
      blood_pressure: 'mmHg',
      blood_glucose: 'mg/dL',
      cholesterol: 'mg/dL',
      exercise: 'minutes/day',
      medication_adherence: '%',
      smoking_cessation: 'cigarettes/day',
      alcohol_reduction: 'drinks/week',
      diet: '',
      other: '',
    };
    return units[goalType] || '';
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.goalName || !formData.targetDate) {
      showError('Validation Error', 'Please fill in all required fields');
      return;
    }

    if (!formData.targetValue) {
      showError('Validation Error', 'Please enter a target value');
      return;
    }

    try {
      setLoading(true);
      await patientPortalApi.createGoal(token!, tenantSlug, {
        goalType: formData.goalType,
        goalName: formData.goalName,
        description: formData.description || undefined,
        targetValue: parseFloat(formData.targetValue),
        currentValue: formData.currentValue ? parseFloat(formData.currentValue) : undefined,
        unit: formData.unit || getDefaultUnit(formData.goalType),
        startDate: formData.startDate,
        targetDate: formData.targetDate,
        isAutoTracked: formData.isAutoTracked,
        notes: formData.notes || undefined,
      });

      showSuccess('Goal created successfully!', 'success');
      navigate(`/${tenantSlug}/goals`);
    } catch (err: any) {
      console.error('Error creating goal:', err);
      showError('Failed to create goal', err.message || 'Please try again later');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 p-4 sm:p-6 lg:p-8">
      <div className="max-w-3xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-4">
            <Link
              to={`/${tenantSlug}/goals`}
              className="w-10 h-10 bg-gradient-to-br from-purple-600 to-blue-600 rounded-xl flex items-center justify-center shadow-lg hover:scale-105 transition-transform"
            >
              <ArrowLeft className="w-5 h-5 text-white" />
            </Link>
            <div className="w-12 h-12 bg-gradient-to-br from-purple-600 to-blue-600 rounded-xl flex items-center justify-center shadow-lg">
              <Target className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Create Health Goal</h1>
              <p className="text-gray-600 mt-1">Set a new goal to improve your health</p>
            </div>
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="bg-white rounded-2xl shadow-sm p-6 border border-gray-200">
          <div className="space-y-6">
            {/* Goal Type */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Goal Type <span className="text-red-500">*</span>
              </label>
              <select
                value={formData.goalType}
                onChange={(e) => {
                  setFormData({
                    ...formData,
                    goalType: e.target.value,
                    unit: getDefaultUnit(e.target.value),
                  });
                }}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-600 focus:border-transparent"
                required
              >
                {goalTypes.map((type) => (
                  <option key={type.value} value={type.value}>
                    {type.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Goal Name */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Goal Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={formData.goalName}
                onChange={(e) => setFormData({ ...formData, goalName: e.target.value })}
                placeholder="e.g., Lose 10kg by summer"
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-600 focus:border-transparent"
                required
              />
            </div>

            {/* Description */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Description</label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Describe your goal and why it's important to you..."
                rows={4}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-600 focus:border-transparent"
              />
            </div>

            {/* Target Value & Current Value */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Target Value <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={formData.targetValue}
                  onChange={(e) => setFormData({ ...formData, targetValue: e.target.value })}
                  placeholder="e.g., 70"
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-600 focus:border-transparent"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Current Value</label>
                <input
                  type="number"
                  step="0.01"
                  value={formData.currentValue}
                  onChange={(e) => setFormData({ ...formData, currentValue: e.target.value })}
                  placeholder="e.g., 80"
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-600 focus:border-transparent"
                />
              </div>
            </div>

            {/* Unit */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Unit</label>
              <input
                type="text"
                value={formData.unit || getDefaultUnit(formData.goalType)}
                onChange={(e) => setFormData({ ...formData, unit: e.target.value })}
                placeholder="e.g., kg, mmHg, mg/dL"
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-600 focus:border-transparent"
              />
            </div>

            {/* Dates */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Start Date <span className="text-red-500">*</span>
                </label>
                <input
                  type="date"
                  value={formData.startDate}
                  onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-600 focus:border-transparent"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Target Date <span className="text-red-500">*</span>
                </label>
                <input
                  type="date"
                  value={formData.targetDate}
                  onChange={(e) => setFormData({ ...formData, targetDate: e.target.value })}
                  min={formData.startDate}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-600 focus:border-transparent"
                  required
                />
              </div>
            </div>

            {/* Auto-tracked */}
            <div className="flex items-center gap-3">
              <input
                type="checkbox"
                id="autoTracked"
                checked={formData.isAutoTracked}
                onChange={(e) => setFormData({ ...formData, isAutoTracked: e.target.checked })}
                className="w-5 h-5 text-purple-600 border-gray-300 rounded focus:ring-purple-600"
              />
              <label htmlFor="autoTracked" className="text-sm font-semibold text-gray-700">
                Automatically track progress from vitals submissions
              </label>
            </div>

            {/* Notes */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Notes</label>
              <textarea
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                placeholder="Any additional notes or reminders..."
                rows={3}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-600 focus:border-transparent"
              />
            </div>

            {/* Submit Button */}
            <div className="flex gap-4 pt-4">
              <button
                type="submit"
                disabled={loading}
                className="flex-1 px-6 py-3 bg-gradient-to-r from-purple-600 to-blue-600 text-white rounded-xl hover:from-purple-700 hover:to-blue-700 transition-all flex items-center justify-center gap-2 shadow-lg font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? (
                  <>
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    Creating...
                  </>
                ) : (
                  <>
                    <Save className="w-5 h-5" />
                    Create Goal
                  </>
                )}
              </button>
              <Link
                to={`/${tenantSlug}/goals`}
                className="px-6 py-3 bg-gray-100 text-gray-700 rounded-xl hover:bg-gray-200 transition-colors font-semibold"
              >
                Cancel
              </Link>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};

export default CreateGoalPage;

