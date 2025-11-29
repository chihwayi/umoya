import React, { useEffect, useMemo, useState } from 'react';
import {
  ClipboardList,
  AlertTriangle,
  CheckCircle2,
  RefreshCw,
  ShieldCheck,
  Loader2,
} from 'lucide-react';
import { medicationHistoryApi } from '../services/api';
import { useNotification } from './GlobalNotification';

const reconciliationTypes = [
  { value: 'admission', label: 'Admission' },
  { value: 'transfer', label: 'Transfer' },
  { value: 'discharge', label: 'Discharge' },
  { value: 'outpatient_visit', label: 'Outpatient Visit' },
  { value: 'pharmacy_visit', label: 'Pharmacy Visit' },
];

interface MedicationReconciliationProps {
  patientId: string;
  tenantSlug: string;
  token: string;
}

const MedicationReconciliation: React.FC<MedicationReconciliationProps> = ({
  patientId,
  tenantSlug,
  token,
}) => {
  const { showError, showSuccess } = useNotification();
  const [loading, setLoading] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [history, setHistory] = useState<any[]>([]);
  const [medications, setMedications] = useState<any[]>([]);
  const [selectedMedicationIds, setSelectedMedicationIds] = useState<string[]>([]);

  const [form, setForm] = useState({
    reconciliationType: 'outpatient_visit',
    source: '',
    notes: '',
  });
  const [submitting, setSubmitting] = useState(false);

  const loadMedications = async () => {
    if (!patientId || !token || !tenantSlug) return;
    try {
      setLoading(true);
      const response = await medicationHistoryApi.getMedications(patientId, token, tenantSlug);
      setMedications(response.data || []);
    } catch (error: any) {
      console.error('Failed to load medications', error);
      showError('Medication Reconciliation', error?.response?.data?.message || 'Unable to load medications.');
    } finally {
      setLoading(false);
    }
  };

  const loadHistory = async () => {
    if (!patientId || !token || !tenantSlug) return;
    try {
      setHistoryLoading(true);
      const response = await medicationHistoryApi.getReconciliationHistory(patientId, token, tenantSlug);
      setHistory(response.data || []);
    } catch (error: any) {
      console.error('Failed to load reconciliation history', error);
      showError('Medication Reconciliation', error?.response?.data?.message || 'Unable to load history.');
    } finally {
      setHistoryLoading(false);
    }
  };

  useEffect(() => {
    loadMedications();
    loadHistory();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [patientId, tenantSlug, token]);

  const discrepancyMedications = useMemo(
    () =>
      medications.filter((med) =>
        ['needs_review', 'discrepancy'].includes((med.reconciliationStatus || '').toLowerCase()),
      ),
    [medications],
  );

  const handleCheckboxToggle = (medId: string) => {
    setSelectedMedicationIds((prev) =>
    prev.includes(medId) ? prev.filter((id) => id !== medId) : [...prev, medId]
    );
  };

  const performReconciliation = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!form.reconciliationType) {
      showError('Medication Reconciliation', 'Select a reconciliation type.');
      return;
    }

    try {
      setSubmitting(true);
      await medicationHistoryApi.performReconciliation(
        patientId,
        {
          reconciliationType: form.reconciliationType,
          source: form.source || undefined,
          medicationIds: selectedMedicationIds,
          notes: form.notes || undefined,
        },
        token,
        tenantSlug,
      );
      showSuccess('Medication Reconciliation', 'Reconciliation logged successfully.');
      setSelectedMedicationIds([]);
      setForm((prev) => ({ ...prev, notes: '' }));
      await Promise.all([loadMedications(), loadHistory()]);
    } catch (error: any) {
      console.error('Failed to perform reconciliation', error);
      showError('Medication Reconciliation', error?.response?.data?.message || 'Unable to reconcile medications.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-lg font-semibold text-slate-900 flex items-center gap-2">
            <ClipboardList className="w-5 h-5 text-emerald-600" />
            Medication Reconciliation
          </h3>
          <p className="text-sm text-slate-500">Resolve discrepancies before the next care transition.</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={loadMedications}
            disabled={loading}
            className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-60"
          >
            <RefreshCw className="w-4 h-4" />
            Refresh
          </button>
        </div>
      </div>

      <form onSubmit={performReconciliation} className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="text-xs font-semibold text-slate-500 mb-1 block">Reconciliation Type</label>
            <select
              value={form.reconciliationType}
              onChange={(e) => setForm((prev) => ({ ...prev, reconciliationType: e.target.value }))}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-emerald-200 focus:border-emerald-400"
              required
            >
              {reconciliationTypes.map((type) => (
                <option key={type.value} value={type.value}>
                  {type.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-500 mb-1 block">Source (optional)</label>
            <input
              type="text"
              value={form.source}
              onChange={(e) => setForm((prev) => ({ ...prev, source: e.target.value }))}
              placeholder="e.g., Pharmacy phone call"
              className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-emerald-200 focus:border-emerald-400"
            />
          </div>
        </div>
        <div>
          <label className="text-xs font-semibold text-slate-500 mb-1 block">Notes</label>
          <textarea
            value={form.notes}
            onChange={(e) => setForm((prev) => ({ ...prev, notes: e.target.value }))}
            rows={3}
            placeholder="Document the reconciliation context, conversations, and follow-up."
            className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-emerald-200 focus:border-emerald-400"
          />
        </div>

        <div className="rounded-2xl border border-slate-200 p-4 bg-slate-50">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-600" />
              <p className="text-sm font-semibold text-slate-700">Medications needing review</p>
            </div>
            <p className="text-xs text-slate-500">
              {discrepancyMedications.length === 0
                ? 'All medications verified'
                : `${discrepancyMedications.length} flagged`}
            </p>
          </div>
          {loading ? (
            <div className="flex items-center justify-center py-6 text-slate-400">
              <Loader2 className="w-4 h-4 animate-spin mr-2" />
              Loading medications…
            </div>
          ) : discrepancyMedications.length === 0 ? (
            <div className="flex items-center gap-2 text-sm text-slate-500">
              <ShieldCheck className="w-4 h-4 text-emerald-500" />
              Nothing needs review right now.
            </div>
          ) : (
            <div className="space-y-2 max-h-64 overflow-y-auto pr-2">
              {discrepancyMedications.map((med) => (
                <label
                  key={med.id}
                  className="flex items-center gap-3 bg-white border border-slate-200 rounded-xl px-3 py-2 shadow-sm cursor-pointer hover:border-emerald-300"
                >
                  <input
                    type="checkbox"
                    checked={selectedMedicationIds.includes(med.id)}
                    onChange={() => handleCheckboxToggle(med.id)}
                    className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                  />
                  <div>
                    <p className="text-sm font-semibold text-slate-800">{med.medicationName}</p>
                    <p className="text-xs text-slate-500">
                      {med.dosage} {med.frequency} &middot; Status: {med.reconciliationStatus}
                    </p>
                  </div>
                </label>
              ))}
            </div>
          )}
        </div>

        <div className="flex justify-end">
          <button
            type="submit"
            disabled={submitting}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-gradient-to-r from-emerald-600 to-teal-500 text-white font-semibold hover:from-emerald-700 hover:to-teal-600 disabled:opacity-60"
          >
            {submitting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" /> Reconciling…
              </>
            ) : (
              <>
                <CheckCircle2 className="w-4 h-4" /> Log Reconciliation
              </>
            )}
          </button>
        </div>
      </form>

      <div>
        <div className="flex items-center gap-2 mb-3">
          <ShieldCheck className="w-4 h-4 text-indigo-500" />
          <h4 className="text-sm font-semibold text-slate-700">Reconciliation History</h4>
        </div>
        {historyLoading ? (
          <div className="flex items-center justify-center py-6 text-slate-400">
            <Loader2 className="w-4 h-4 animate-spin mr-2" />
            Loading history…
          </div>
        ) : history.length === 0 ? (
          <p className="text-sm text-slate-500">No reconciliation logs recorded.</p>
        ) : (
          <div className="space-y-3 max-h-72 overflow-y-auto pr-2">
            {history.map((log) => (
              <div
                key={log.id}
                className="border border-slate-200 rounded-2xl p-4 bg-slate-50 shadow-sm text-sm text-slate-600"
              >
                <div className="flex items-center justify-between mb-1">
                  <p className="font-semibold text-slate-800">
                    {reconciliationTypes.find((t) => t.value === log.reconciliationType)?.label ||
                      log.reconciliationType}
                  </p>
                  <span className="text-xs text-slate-500">
                    {new Date(log.reconciliationDate).toLocaleString()}
                  </span>
                </div>
                <p className="text-xs text-slate-500 mb-2">
                  {log.source ? `Source: ${log.source}` : 'Source not recorded'}
                </p>
                <p className="text-sm">
                  {log.discrepanciesFound} discrepancies found &middot; {log.discrepanciesResolved} resolved
                </p>
                {log.notes && <p className="text-xs italic text-slate-500 mt-2">{log.notes}</p>}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default MedicationReconciliation;

