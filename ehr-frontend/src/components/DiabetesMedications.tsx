import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Pill, Plus, RefreshCw, ShieldCheck, Loader2 } from 'lucide-react';
import { diabetesApi } from '../services/api';
import { useNotification } from './GlobalNotification';

type DiabetesMedicationsProps = {
  tenantSlug: string;
  token: string;
  registryId?: string;
  patientId?: string;
};

const medicationTypeColors: Record<string, string> = {
  oral: 'bg-sky-100 text-sky-700',
  injectable: 'bg-violet-100 text-violet-700',
  insulin: 'bg-emerald-100 text-emerald-700',
  combination: 'bg-amber-100 text-amber-800',
};

const DiabetesMedications: React.FC<DiabetesMedicationsProps> = ({ tenantSlug, token, registryId, patientId }) => {
  const { showError, showSuccess } = useNotification();
  const [medications, setMedications] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [adherenceUpdating, setAdherenceUpdating] = useState<string | null>(null);
  const [formState, setFormState] = useState({
    medicationName: '',
    medicationType: 'oral',
    dosage: '',
    frequency: '',
    startDate: new Date().toISOString().slice(0, 10),
  });

  const fetchMedications = useCallback(async () => {
    if (!registryId || !tenantSlug || !token) return;
    setLoading(true);
    try {
      const response = await diabetesApi.listMedications(registryId, token, tenantSlug);
      setMedications(Array.isArray(response.data) ? response.data : []);
    } catch (error) {
      console.error('Failed to load diabetes medications', error);
      showError('Unable to load medications', 'Please retry shortly.');
    } finally {
      setLoading(false);
    }
  }, [registryId, tenantSlug, token, showError]);

  useEffect(() => {
    fetchMedications();
  }, [fetchMedications]);

  const handleFormChange = (event: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = event.target;
    setFormState((prev) => ({ ...prev, [name]: value }));
  };

  const handleAddMedication = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!registryId || !patientId) {
      showError('Missing registry', 'Select a registry before adding a medication.');
      return;
    }
    setSubmitting(true);
    try {
      const payload = {
        patientId,
        medicationName: formState.medicationName,
        medicationType: formState.medicationType,
        dosage: formState.dosage,
        frequency: formState.frequency,
        startDate: formState.startDate,
      };
      await diabetesApi.createMedication(registryId, token, tenantSlug, payload);
      showSuccess('Medication added', `${formState.medicationName} is now tracked.`);
      setShowForm(false);
      setFormState({
        medicationName: '',
        medicationType: 'oral',
        dosage: '',
        frequency: '',
        startDate: new Date().toISOString().slice(0, 10),
      });
      await fetchMedications();
    } catch (error) {
      console.error('Failed to add medication', error);
      showError('Unable to add medication', 'Please verify the details and retry.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleAdherenceUpdate = async (medicationId: string, adherence: number) => {
    setAdherenceUpdating(medicationId);
    try {
      await diabetesApi.trackMedicationAdherence(medicationId, token, tenantSlug, {
        adherencePercentage: adherence,
      });
      await fetchMedications();
    } catch (error) {
      console.error('Failed to update adherence', error);
      showError('Unable to update adherence', 'Please retry shortly.');
    } finally {
      setAdherenceUpdating(null);
    }
  };

  const adherenceAverage = useMemo(() => {
    const items = medications.filter((med) => typeof med.adherence_percentage === 'number');
    if (!items.length) return null;
    const sum = items.reduce((acc, med) => acc + (med.adherence_percentage ?? 0), 0);
    return Math.round(sum / items.length);
  }, [medications]);

  if (!registryId) {
    return (
      <div className="rounded-3xl border border-dashed border-slate-200 p-6 text-center text-slate-400">
        Select a registry to review medications.
      </div>
    );
  }

  return (
    <div className="rounded-3xl border border-slate-100 bg-white p-6 shadow-sm">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.35em] text-slate-400">Therapy stack</p>
          <h3 className="text-xl font-semibold text-slate-900">Active medications</h3>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={fetchMedications}
            disabled={loading}
            className="inline-flex items-center gap-1 rounded-full border border-slate-200 px-3 py-1 text-xs text-slate-600 hover:bg-slate-100 disabled:opacity-50"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
          <button
            onClick={() => setShowForm((prev) => !prev)}
            className="inline-flex items-center gap-1 rounded-full bg-rose-600 px-3 py-1 text-xs font-semibold text-white shadow hover:bg-rose-500"
          >
            <Plus className="h-3.5 w-3.5" />
            Add medication
          </button>
        </div>
      </div>

      {showForm && (
        <form onSubmit={handleAddMedication} className="mt-4 grid grid-cols-1 md:grid-cols-5 gap-3 rounded-2xl border border-slate-100 bg-slate-50 p-4">
          <input
            type="text"
            name="medicationName"
            placeholder="Medication name"
            value={formState.medicationName}
            onChange={handleFormChange}
            className="rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-900 focus:border-rose-200 focus:ring focus:ring-rose-100 md:col-span-2"
            required
          />
          <select
            name="medicationType"
            value={formState.medicationType}
            onChange={handleFormChange}
            className="rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-900 focus:border-rose-200 focus:ring focus:ring-rose-100"
          >
            <option value="oral">Oral</option>
            <option value="injectable">Injectable</option>
            <option value="insulin">Insulin</option>
            <option value="combination">Combination</option>
            <option value="other">Other</option>
          </select>
          <input
            type="text"
            name="dosage"
            placeholder="Dose (e.g., 500 mg)"
            value={formState.dosage}
            onChange={handleFormChange}
            className="rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-900 focus:border-rose-200 focus:ring focus:ring-rose-100"
            required
          />
          <input
            type="text"
            name="frequency"
            placeholder="Frequency (e.g., BID)"
            value={formState.frequency}
            onChange={handleFormChange}
            className="rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-900 focus:border-rose-200 focus:ring focus:ring-rose-100"
            required
          />
          <input
            type="date"
            name="startDate"
            value={formState.startDate}
            onChange={handleFormChange}
            className="rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-900 focus:border-rose-200 focus:ring focus:ring-rose-100"
            required
          />
          <div className="md:col-span-5 flex justify-end">
            <button
              type="submit"
              disabled={submitting}
              className="inline-flex items-center gap-2 rounded-2xl bg-rose-600 px-4 py-2 text-sm font-semibold text-white shadow hover:bg-rose-500 disabled:opacity-50"
            >
              {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
              Save medication
            </button>
          </div>
        </form>
      )}

      <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="rounded-2xl border border-slate-100 bg-gradient-to-br from-rose-50 to-white p-4">
          <p className="text-xs uppercase tracking-[0.35em] text-rose-500">Adherence</p>
          <p className="text-3xl font-semibold text-slate-900">
            {adherenceAverage !== null ? `${adherenceAverage}%` : '—'}
          </p>
          <p className="text-xs text-slate-500">Average across tracked medications</p>
        </div>
        <div className="rounded-2xl border border-slate-100 bg-gradient-to-br from-indigo-50 to-white p-4">
          <p className="text-xs uppercase tracking-[0.35em] text-indigo-500">Active meds</p>
          <p className="text-3xl font-semibold text-slate-900">{medications.length}</p>
          <p className="text-xs text-slate-500">Therapies currently on file</p>
        </div>
        <div className="rounded-2xl border border-slate-100 bg-gradient-to-br from-emerald-50 to-white p-4">
          <p className="text-xs uppercase tracking-[0.35em] text-emerald-500">Insulin focus</p>
          <p className="text-3xl font-semibold text-slate-900">
            {medications.filter((med) => med.medication_type === 'insulin').length}
          </p>
          <p className="text-xs text-slate-500">Active insulin therapies</p>
        </div>
      </div>

      <div className="mt-6 space-y-3">
        {loading && (
          <div className="flex items-center justify-center rounded-2xl border border-slate-100 bg-white py-6 text-slate-500">
            <Loader2 className="h-5 w-5 animate-spin mr-2" />
            Loading medications...
          </div>
        )}
        {!loading && medications.length === 0 && (
          <div className="rounded-2xl border border-dashed border-slate-200 p-6 text-center text-slate-500">
            No medications recorded yet.
          </div>
        )}
        {!loading &&
          medications.map((medication) => (
            <div
              key={medication.id}
              className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm flex flex-col md:flex-row md:items-center md:justify-between gap-4"
            >
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-slate-50 text-slate-600">
                  <Pill className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-slate-900">{medication.medication_name}</p>
                  <p className="text-xs text-slate-500">
                    {medication.dosage} • {medication.frequency}
                  </p>
                  <p className="text-[11px] uppercase tracking-[0.25em] text-slate-400 mt-1">
                    {medication.medication_type}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span
                  className={`inline-flex items-center gap-1 rounded-full border px-3 py-1 text-xs font-semibold ${
                    medicationTypeColors[medication.medication_type] ??
                    'bg-slate-100 text-slate-600 border-slate-200'
                  }`}
                >
                  <ShieldCheck className="h-3.5 w-3.5" />
                  {medication.status ?? 'active'}
                </span>
                <div className="flex items-center gap-2">
                  <label className="text-xs text-slate-500">Adherence</label>
                  <input
                    type="number"
                    min={0}
                    max={100}
                    defaultValue={medication.adherence_percentage ?? 0}
                    onBlur={(event) => {
                      const value = Number(event.target.value);
                      if (!Number.isNaN(value)) {
                        handleAdherenceUpdate(medication.id, value);
                      }
                    }}
                    className="w-20 rounded-xl border border-slate-200 px-2 py-1 text-xs text-slate-900 focus:border-emerald-200 focus:ring focus:ring-emerald-100"
                  />
                  {adherenceUpdating === medication.id && <Loader2 className="h-4 w-4 animate-spin text-emerald-500" />}
                </div>
              </div>
            </div>
          ))}
      </div>
    </div>
  );
};

export default DiabetesMedications;


