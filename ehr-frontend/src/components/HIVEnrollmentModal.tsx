import React, { useState } from 'react';
import { X, Save, Calendar, Activity, User } from 'lucide-react';
import { ehrApi } from '../services/api';
import { useNotification } from './GlobalNotification';

interface HIVEnrollmentModalProps {
  patientId: string;
  patientName: string;
  onClose: () => void;
  onSuccess: () => void;
  tenantSlug: string;
}

const HIVEnrollmentModal: React.FC<HIVEnrollmentModalProps> = ({
  patientId,
  patientName,
  onClose,
  onSuccess,
  tenantSlug
}) => {
  const { showSuccess, showError } = useNotification();
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    enrollmentDate: new Date().toISOString().split('T')[0],
    dateConfirmedPositive: new Date().toISOString().split('T')[0],
    baselineCd4: '',
    baselineViralLoad: '',
    baselineViralLoadUnit: 'copies/mL',
    baselineClinicalStage: 'stage1',
    baselineWhoStage: '',
    currentRegimen: '',
    enrollmentNotes: ''
  });

  const handleSubmit = async () => {
    try {
      const token = localStorage.getItem('ehr_token');
      const currentUser = JSON.parse(localStorage.getItem('ehr_user') || '{}');
      
      if (!token) {
        showError('Error', 'Not authenticated');
        return;
      }

      setLoading(true);
      await ehrApi.enrollInHivCare({
        patientId,
        enrollmentDate: form.enrollmentDate,
        dateConfirmedPositive: form.dateConfirmedPositive,
        baselineCd4: form.baselineCd4 ? parseInt(form.baselineCd4) : null,
        baselineViralLoad: form.baselineViralLoad ? parseFloat(form.baselineViralLoad) : null,
        createdBy: currentUser.id,
        baselineClinicalStage: form.baselineClinicalStage,
        baselineWhoStage: form.baselineWhoStage,
        currentRegimen: form.currentRegimen,
        enrollmentNotes: form.enrollmentNotes
      }, token, tenantSlug);

      showSuccess('Success', 'Patient enrolled in HIV care successfully');
      onSuccess();
      onClose();
    } catch (error: any) {
      console.error('Enrollment failed:', error);
      showError('Error', error.response?.data?.message || 'Failed to enroll patient');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-md flex items-center justify-center z-[100000] p-4">
      <div className="w-full max-w-2xl bg-white rounded-2xl shadow-2xl">
        <div className="bg-gradient-to-r from-emerald-600 to-teal-700 px-6 py-4 flex items-center justify-between rounded-t-2xl">
          <h2 className="text-xl font-bold text-white">Enroll Patient in HIV Care</h2>
          <button onClick={onClose} className="text-white hover:text-emerald-100">
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-lg">
            <div className="flex items-center gap-2 mb-2">
              <User className="w-5 h-5 text-emerald-600" />
              <span className="font-semibold text-emerald-900">{patientName}</span>
            </div>
            <p className="text-sm text-emerald-700">Enrolling this patient in HIV care program</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Enrollment Date</label>
              <input
                type="date"
                value={form.enrollmentDate}
                onChange={(e) => setForm({ ...form, enrollmentDate: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Date Confirmed Positive</label>
              <input
                type="date"
                value={form.dateConfirmedPositive}
                onChange={(e) => setForm({ ...form, dateConfirmedPositive: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Baseline CD4 Count</label>
              <input
                type="number"
                value={form.baselineCd4}
                onChange={(e) => setForm({ ...form, baselineCd4: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
                placeholder="CD4 cells/mm³"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Baseline Viral Load</label>
              <input
                type="number"
                step="0.01"
                value={form.baselineViralLoad}
                onChange={(e) => setForm({ ...form, baselineViralLoad: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
                placeholder="Viral load"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Clinical Stage</label>
              <select
                value={form.baselineClinicalStage}
                onChange={(e) => setForm({ ...form, baselineClinicalStage: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
              >
                <option value="stage1">Stage 1</option>
                <option value="stage2">Stage 2</option>
                <option value="stage3">Stage 3</option>
                <option value="stage4">Stage 4</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Current Regimen</label>
              <input
                type="text"
                value={form.currentRegimen}
                onChange={(e) => setForm({ ...form, currentRegimen: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
                placeholder="e.g., TLD"
              />
            </div>

            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-slate-700 mb-2">Notes</label>
              <textarea
                value={form.enrollmentNotes}
                onChange={(e) => setForm({ ...form, enrollmentNotes: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
                rows={3}
                placeholder="Additional enrollment notes..."
              />
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-200">
            <button
              onClick={onClose}
              className="px-4 py-2 border border-slate-300 rounded-lg text-slate-700 hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              onClick={handleSubmit}
              disabled={loading}
              className="px-6 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50 flex items-center gap-2"
            >
              <Save className="w-5 h-5" />
              {loading ? 'Enrolling...' : 'Enroll Patient'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default HIVEnrollmentModal;

