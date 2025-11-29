import React, { useState, useEffect } from 'react';
import { X, Save, ClipboardList, Search } from 'lucide-react';
import { analyticsApi, ehrApi } from '../services/api';
import { useNotification } from './GlobalNotification';

interface OutcomeRecordingFormProps {
  tenantSlug: string;
  token: string;
  outcome?: any;
  patientId?: string;
  onClose: () => void;
  onSuccess: () => void;
}

const OutcomeRecordingForm: React.FC<OutcomeRecordingFormProps> = ({
  tenantSlug,
  token,
  outcome,
  patientId,
  onClose,
  onSuccess,
}) => {
  const { showError, showSuccess } = useNotification();
  const [loading, setLoading] = useState(false);
  const [patients, setPatients] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [formData, setFormData] = useState({
    patientId: outcome?.patient_id || patientId || '',
    outcomeType: outcome?.outcome_type || 'treatment_response',
    condition: outcome?.condition || '',
    snomedCode: outcome?.snomed_code || '',
    baselineDate: outcome?.baseline_date ? outcome.baseline_date.split('T')[0] : '',
    outcomeDate: outcome?.outcome_date ? outcome.outcome_date.split('T')[0] : new Date().toISOString().split('T')[0],
    outcomeValue: outcome?.outcome_value || '',
    outcomeUnit: outcome?.outcome_unit || '',
    outcomeStatus: outcome?.outcome_status || '',
    severity: outcome?.severity || '',
    notes: outcome?.notes || '',
  });

  useEffect(() => {
    if (searchTerm.length >= 2) {
      searchPatients();
    } else {
      setPatients([]);
    }
  }, [searchTerm]);

  const searchPatients = async () => {
    try {
      const result = await ehrApi.searchPatients(tenantSlug, token, searchTerm, { limit: 10 });
      setPatients(result.data?.patients || []);
    } catch (error) {
      console.error('Failed to search patients:', error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const payload: any = {
        patientId: formData.patientId,
        outcomeType: formData.outcomeType,
        condition: formData.condition || undefined,
        snomedCode: formData.snomedCode || undefined,
        baselineDate: formData.baselineDate || undefined,
        outcomeDate: formData.outcomeDate || undefined,
        outcomeValue: formData.outcomeValue ? parseFloat(String(formData.outcomeValue)) : undefined,
        outcomeUnit: formData.outcomeUnit || undefined,
        outcomeStatus: formData.outcomeStatus || undefined,
        severity: formData.severity || undefined,
        notes: formData.notes || undefined,
      };

      if (outcome) {
        await analyticsApi.updateOutcome(tenantSlug, token, outcome.id, payload);
        showSuccess('Outcome updated successfully');
      } else {
        await analyticsApi.recordOutcome(tenantSlug, token, payload);
        showSuccess('Outcome recorded successfully');
      }
      onSuccess();
      onClose();
    } catch (error: any) {
      showError(error.response?.data?.message || 'Failed to save outcome');
    } finally {
      setLoading(false);
    }
  };

  const selectedPatient = patients.find((p) => p.id === formData.patientId);

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-6 py-4 flex items-center justify-between">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <ClipboardList className="w-5 h-5" />
            {outcome ? 'Edit Outcome' : 'Record Outcome'}
          </h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-gray-500 dark:text-gray-400" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {!patientId && (
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Patient *
              </label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  required
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  onFocus={() => searchTerm.length >= 2 && searchPatients()}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Search by name or patient number..."
                />
                {patients.length > 0 && (
                  <div className="absolute z-10 w-full mt-1 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                    {patients.map((patient) => (
                      <button
                        key={patient.id}
                        type="button"
                        onClick={() => {
                          setFormData({ ...formData, patientId: patient.id });
                          setSearchTerm(`${patient.firstName} ${patient.lastName} (${patient.patientNumber})`);
                          setPatients([]);
                        }}
                        className="w-full px-4 py-2 text-left hover:bg-gray-100 dark:hover:bg-gray-700"
                      >
                        <div className="font-medium text-gray-900 dark:text-white">
                          {patient.firstName} {patient.lastName}
                        </div>
                        <div className="text-sm text-gray-500 dark:text-gray-400">
                          {patient.patientNumber} • {patient.dateOfBirth ? new Date(patient.dateOfBirth).toLocaleDateString() : ''}
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
              {selectedPatient && (
                <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
                  Selected: {selectedPatient.firstName} {selectedPatient.lastName}
                </p>
              )}
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Outcome Type *
              </label>
              <select
                required
                value={formData.outcomeType}
                onChange={(e) => setFormData({ ...formData, outcomeType: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="treatment_response">Treatment Response</option>
                <option value="readmission">Readmission</option>
                <option value="complication">Complication</option>
                <option value="mortality">Mortality</option>
                <option value="quality_of_life">Quality of Life</option>
                <option value="other">Other</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Condition
              </label>
              <input
                type="text"
                value={formData.condition}
                onChange={(e) => setFormData({ ...formData, condition: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="e.g., Diabetes Type 2"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Baseline Date
              </label>
              <input
                type="date"
                value={formData.baselineDate}
                onChange={(e) => setFormData({ ...formData, baselineDate: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Outcome Date *
              </label>
              <input
                type="date"
                required
                value={formData.outcomeDate}
                onChange={(e) => setFormData({ ...formData, outcomeDate: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Outcome Value
              </label>
              <input
                type="number"
                step="0.01"
                value={formData.outcomeValue}
                onChange={(e) => setFormData({ ...formData, outcomeValue: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="e.g., 7.2"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Unit
              </label>
              <input
                type="text"
                value={formData.outcomeUnit}
                onChange={(e) => setFormData({ ...formData, outcomeUnit: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="e.g., mg/dL, %"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Status
              </label>
              <select
                value={formData.outcomeStatus}
                onChange={(e) => setFormData({ ...formData, outcomeStatus: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="">Select status</option>
                <option value="improved">Improved</option>
                <option value="stable">Stable</option>
                <option value="worsened">Worsened</option>
                <option value="resolved">Resolved</option>
                <option value="ongoing">Ongoing</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Severity
            </label>
            <select
              value={formData.severity}
              onChange={(e) => setFormData({ ...formData, severity: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="">Select severity</option>
              <option value="mild">Mild</option>
              <option value="moderate">Moderate</option>
              <option value="severe">Severe</option>
              <option value="critical">Critical</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Notes
            </label>
            <textarea
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              rows={4}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="Additional notes about this outcome..."
            />
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || !formData.patientId}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Save className="w-4 h-4" />
              {loading ? 'Saving...' : outcome ? 'Update' : 'Record'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default OutcomeRecordingForm;

