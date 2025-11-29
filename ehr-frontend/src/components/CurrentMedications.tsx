import React, { useState, useEffect } from 'react';
import { Pill, Plus, Edit, Trash2, AlertCircle, CheckCircle, XCircle, Clock, Loader2 } from 'lucide-react';
import { useNotification } from './GlobalNotification';
import { medicationHistoryApi } from '../services/api';
import ModalPortal from './ModalPortal';
import ConfirmationDialog from './ConfirmationDialog';

interface Medication {
  id: string;
  medicationName: string;
  genericName?: string;
  dosage: string;
  dosageUnit?: string;
  frequency: string;
  route?: string;
  duration?: string;
  startDate?: string;
  endDate?: string;
  status: string;
  medicationType: string;
  adherencePercentage?: number;
  lastTakenDate?: string;
  notes?: string;
  reconciliationStatus?: string;
}

interface CurrentMedicationsProps {
  patientId: string;
  tenantSlug: string;
  token: string;
  onMedicationAdded?: () => void;
}

const CurrentMedications: React.FC<CurrentMedicationsProps> = ({
  patientId,
  tenantSlug,
  token,
  onMedicationAdded
}) => {
  const { showSuccess, showError } = useNotification();
  const [medications, setMedications] = useState<Medication[]>([]);
  const [loading, setLoading] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingMedication, setEditingMedication] = useState<Medication | null>(null);
  const [confirmDialog, setConfirmDialog] = useState<{
    open: boolean;
    title: string;
    message: string;
    variant: 'danger' | 'warning' | 'info';
    onConfirm: () => void;
  }>({
    open: false,
    title: '',
    message: '',
    variant: 'warning',
    onConfirm: () => {},
  });

  useEffect(() => {
    fetchCurrentMedications();
  }, [patientId]);

  const fetchCurrentMedications = async () => {
    setLoading(true);
    try {
      const response = await medicationHistoryApi.getCurrentMedications(patientId, token, tenantSlug);
      setMedications(response.data || []);
    } catch (error: any) {
      console.error('Failed to fetch current medications:', error);
      showError('Error', 'Failed to load current medications');
    } finally {
      setLoading(false);
    }
  };

  const handleDiscontinue = async (medicationId: string) => {
    setConfirmDialog({
      open: true,
      title: 'Discontinue Medication',
      message: 'Are you sure you want to discontinue this medication?',
      variant: 'warning',
      onConfirm: async () => {
        setConfirmDialog(prev => ({ ...prev, open: false }));
        try {
          await medicationHistoryApi.discontinueMedication(patientId, medicationId, 'Discontinued by provider', token, tenantSlug);
          showSuccess('Success', 'Medication discontinued');
          fetchCurrentMedications();
          onMedicationAdded?.();
        } catch (error: any) {
          showError('Error', 'Failed to discontinue medication');
        }
      },
    });
  };

  const handleDelete = async (medicationId: string) => {
    setConfirmDialog({
      open: true,
      title: 'Delete Medication',
      message: 'Are you sure you want to delete this medication? This action cannot be undone.',
      variant: 'danger',
      onConfirm: async () => {
        setConfirmDialog(prev => ({ ...prev, open: false }));
        try {
          await medicationHistoryApi.deleteMedication(patientId, medicationId, token, tenantSlug);
          showSuccess('Success', 'Medication deleted');
          fetchCurrentMedications();
          onMedicationAdded?.();
        } catch (error: any) {
          showError('Error', 'Failed to delete medication');
        }
      },
    });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
        return 'bg-green-100 text-green-700';
      case 'discontinued':
        return 'bg-red-100 text-red-700';
      case 'completed':
        return 'bg-blue-100 text-blue-700';
      case 'on_hold':
        return 'bg-yellow-100 text-yellow-700';
      default:
        return 'bg-slate-100 text-slate-700';
    }
  };

  const getAdherenceColor = (percentage?: number) => {
    if (!percentage) return 'text-slate-500';
    if (percentage >= 80) return 'text-green-600';
    if (percentage >= 60) return 'text-yellow-600';
    return 'text-red-600';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="w-6 h-6 text-indigo-600 animate-spin" />
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-slate-900 flex items-center gap-2">
          <Pill className="w-5 h-5 text-indigo-600" />
          Current Medications
        </h3>
        <button
          onClick={() => setShowAddModal(true)}
          className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors flex items-center gap-2 text-sm font-medium"
        >
          <Plus className="w-4 h-4" />
          Add Medication
        </button>
      </div>

      {medications.length === 0 ? (
        <div className="text-center py-8">
          <Pill className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <p className="text-slate-600">No current medications</p>
          <button
            onClick={() => setShowAddModal(true)}
            className="mt-3 text-indigo-600 hover:text-indigo-700 text-sm font-medium"
          >
            Add first medication
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {medications.map((medication) => (
            <div
              key={medication.id}
              className="p-4 border border-slate-200 rounded-lg hover:border-indigo-300 transition-colors"
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <h4 className="font-semibold text-slate-900">{medication.medicationName}</h4>
                    {medication.genericName && (
                      <span className="text-xs text-slate-500">({medication.genericName})</span>
                    )}
                    <span className={`px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(medication.status)}`}>
                      {medication.status}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-sm text-slate-600">
                    <div>
                      <span className="font-medium">Dosage:</span> {medication.dosage} {medication.dosageUnit || ''}
                    </div>
                    <div>
                      <span className="font-medium">Frequency:</span> {medication.frequency}
                    </div>
                    {medication.route && (
                      <div>
                        <span className="font-medium">Route:</span> {medication.route}
                      </div>
                    )}
                    {medication.duration && (
                      <div>
                        <span className="font-medium">Duration:</span> {medication.duration}
                      </div>
                    )}
                  </div>
                  {medication.startDate && (
                    <div className="mt-2 text-xs text-slate-500 flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      Started: {new Date(medication.startDate).toLocaleDateString()}
                    </div>
                  )}
                  {medication.adherencePercentage !== undefined && (
                    <div className="mt-2 flex items-center gap-2">
                      <span className="text-xs text-slate-600">Adherence:</span>
                      <span className={`text-sm font-semibold ${getAdherenceColor(medication.adherencePercentage)}`}>
                        {medication.adherencePercentage}%
                      </span>
                    </div>
                  )}
                  {medication.notes && (
                    <p className="mt-2 text-sm text-slate-600">{medication.notes}</p>
                  )}
                </div>
                <div className="flex items-center gap-2 ml-4">
                  <button
                    onClick={() => setEditingMedication(medication)}
                    className="p-2 text-slate-600 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                    title="Edit"
                  >
                    <Edit className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleDiscontinue(medication.id)}
                    className="p-2 text-slate-600 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                    title="Discontinue"
                  >
                    <XCircle className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add/Edit Medication Modal */}
      {showAddModal && (
        <AddEditMedicationModal
          patientId={patientId}
          tenantSlug={tenantSlug}
          token={token}
          medication={editingMedication}
          onClose={() => {
            setShowAddModal(false);
            setEditingMedication(null);
          }}
          onSave={() => {
            fetchCurrentMedications();
            onMedicationAdded?.();
            setShowAddModal(false);
            setEditingMedication(null);
          }}
        />
      )}
    </div>
  );
};

// Add/Edit Medication Modal Component
interface AddEditMedicationModalProps {
  patientId: string;
  tenantSlug: string;
  token: string;
  medication?: Medication | null;
  onClose: () => void;
  onSave: () => void;
}

const AddEditMedicationModal: React.FC<AddEditMedicationModalProps> = ({
  patientId,
  tenantSlug,
  token,
  medication,
  onClose,
  onSave
}) => {
  const { showSuccess, showError } = useNotification();
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    medicationName: medication?.medicationName || '',
    genericName: medication?.genericName || '',
    dosage: medication?.dosage || '',
    dosageUnit: medication?.dosageUnit || '',
    frequency: medication?.frequency || '',
    route: medication?.route || 'oral',
    duration: medication?.duration || '',
    startDate: medication?.startDate ? new Date(medication.startDate).toISOString().split('T')[0] : '',
    notes: medication?.notes || '',
    medicationType: medication?.medicationType || 'current',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.medicationName || !form.dosage || !form.frequency) {
      showError('Validation Error', 'Please fill in all required fields');
      return;
    }

    setLoading(true);
    try {
      if (medication) {
        await medicationHistoryApi.updateMedication(patientId, medication.id, form, token, tenantSlug);
        showSuccess('Success', 'Medication updated successfully');
      } else {
        await medicationHistoryApi.createMedication(patientId, form, token, tenantSlug);
        showSuccess('Success', 'Medication added successfully');
      }
      onSave();
    } catch (error: any) {
      showError('Error', error.response?.data?.message || 'Failed to save medication');
    } finally {
      setLoading(false);
    }
  };

  return (
    <ModalPortal>
      <div className="fixed inset-0 bg-black/70 backdrop-blur-md flex items-center justify-center z-[100000] p-4">
        <div className="w-full max-w-2xl bg-white rounded-2xl shadow-2xl max-h-[90vh] flex flex-col">
          <div className="bg-gradient-to-r from-indigo-600 to-purple-700 px-6 py-4 flex items-center justify-between rounded-t-2xl">
            <h2 className="text-xl font-bold text-white">
              {medication ? 'Edit Medication' : 'Add Medication'}
            </h2>
            <button onClick={onClose} className="text-white hover:text-indigo-100 transition-colors">
              <XCircle className="w-6 h-6" />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6">
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Medication Name *</label>
                <input
                  type="text"
                  value={form.medicationName}
                  onChange={(e) => setForm({ ...form, medicationName: e.target.value })}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Generic Name</label>
                <input
                  type="text"
                  value={form.genericName}
                  onChange={(e) => setForm({ ...form, genericName: e.target.value })}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Dosage *</label>
                  <input
                    type="text"
                    value={form.dosage}
                    onChange={(e) => setForm({ ...form, dosage: e.target.value })}
                    placeholder="e.g., 500"
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Unit</label>
                  <input
                    type="text"
                    value={form.dosageUnit}
                    onChange={(e) => setForm({ ...form, dosageUnit: e.target.value })}
                    placeholder="e.g., mg"
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Frequency *</label>
                <input
                  type="text"
                  value={form.frequency}
                  onChange={(e) => setForm({ ...form, frequency: e.target.value })}
                  placeholder="e.g., Twice daily"
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Route</label>
                  <select
                    value={form.route}
                    onChange={(e) => setForm({ ...form, route: e.target.value })}
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="oral">Oral</option>
                    <option value="injection">Injection</option>
                    <option value="topical">Topical</option>
                    <option value="inhalation">Inhalation</option>
                    <option value="intravenous">IV</option>
                    <option value="sublingual">Sublingual</option>
                    <option value="rectal">Rectal</option>
                    <option value="other">Other</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Start Date</label>
                  <input
                    type="date"
                    value={form.startDate}
                    onChange={(e) => setForm({ ...form, startDate: e.target.value })}
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Duration</label>
                <input
                  type="text"
                  value={form.duration}
                  onChange={(e) => setForm({ ...form, duration: e.target.value })}
                  placeholder="e.g., 7 days"
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Notes</label>
                <textarea
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                  rows={3}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 mt-6 pt-4 border-t">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-slate-700 hover:bg-slate-100 rounded-lg"
                disabled={loading}
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading}
                className="px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 flex items-center gap-2"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <CheckCircle className="w-4 h-4" />
                    {medication ? 'Update' : 'Add'} Medication
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </ModalPortal>
  );
};

export default CurrentMedications;
