import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertTriangle, CheckCircle2, ClipboardList, Loader2, RefreshCw } from 'lucide-react';
import { diabetesApi } from '../services/api';
import { useNotification } from './GlobalNotification';

type CareBundleComponent = {
  key: string;
  label: string;
  completed: boolean;
};

type CareBundleSnapshot = {
  bundle: any | null;
  completionPercentage: number | null;
  components: CareBundleComponent[];
};

type DiabetesCareBundleProps = {
  tenantSlug: string;
  token: string;
  registryId?: string;
  patientId?: string;
  initialData?: CareBundleSnapshot | null;
  onUpdated?: (snapshot: CareBundleSnapshot) => void;
};

const CARE_COMPONENT_DESCRIPTIONS: Record<string, string> = {
  hba1c_checked: 'Quarterly HbA1c monitoring',
  blood_pressure_checked: 'Blood pressure review',
  lipid_profile_checked: 'Annual lipid profile',
  foot_exam_checked: 'Foot exam with sensory check',
  eye_exam_checked: 'Dilated eye exam',
  urine_acr_checked: 'Urine albumin/creatinine ratio',
  diabetes_education_documented: 'Education session',
  medication_review_completed: 'Medication reconciliation',
};

const DiabetesCareBundle: React.FC<DiabetesCareBundleProps> = ({
  tenantSlug,
  token,
  registryId,
  patientId,
  initialData,
  onUpdated,
}) => {
  const { showError, showSuccess } = useNotification();
  const [snapshot, setSnapshot] = useState<CareBundleSnapshot | null>(initialData ?? null);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [formState, setFormState] = useState({
    bundleDate: new Date().toISOString().slice(0, 10),
    hba1cValue: '',
    systolicBp: '',
    diastolicBp: '',
    completionPercentage: '',
  });

  const fetchSnapshot = useCallback(async () => {
    if (!registryId || !tenantSlug || !token) {
      return;
    }
    setLoading(true);
    try {
      const response = await diabetesApi.getCareBundleCompletion(registryId, token, tenantSlug);
      setSnapshot(response.data);
      onUpdated?.(response.data);
    } catch (error) {
      console.error('Failed to load care bundle completion', error);
      showError('Unable to load care bundle', 'Please retry shortly.');
    } finally {
      setLoading(false);
    }
  }, [registryId, tenantSlug, token, onUpdated, showError]);

  useEffect(() => {
    if (registryId && tenantSlug && token && !initialData) {
      fetchSnapshot();
    }
  }, [fetchSnapshot, initialData, registryId, tenantSlug, token]);

  const handleFormChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = event.target;
    setFormState((prev) => ({ ...prev, [name]: value }));
  };

  const handleRecordBundle = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!registryId || !patientId) {
      showError('Missing registry', 'Select a registry before recording bundle data.');
      return;
    }
    setSubmitting(true);
    try {
      const payload: Record<string, any> = {
        patientId,
        bundleDate: formState.bundleDate || undefined,
        hba1cChecked: Boolean(formState.hba1cValue),
        hba1cValue: formState.hba1cValue ? Number(formState.hba1cValue) : undefined,
        hba1cDate: formState.bundleDate || undefined,
        bloodPressureChecked: Boolean(formState.systolicBp && formState.diastolicBp),
        systolicBp: formState.systolicBp ? Number(formState.systolicBp) : undefined,
        diastolicBp: formState.diastolicBp ? Number(formState.diastolicBp) : undefined,
        bloodPressureDate: formState.bundleDate || undefined,
        bundleCompletionPercentage: formState.completionPercentage
          ? Number(formState.completionPercentage)
          : undefined,
      };
      await diabetesApi.recordCareBundle(registryId, token, tenantSlug, payload);
      showSuccess('Care bundle updated', 'The care bundle snapshot has been recorded.');
      setShowForm(false);
      setFormState((prev) => ({ ...prev, hba1cValue: '', systolicBp: '', diastolicBp: '' }));
      await fetchSnapshot();
    } catch (error) {
      console.error('Failed to record care bundle', error);
      showError('Unable to save care bundle', 'Please verify the values and retry.');
    } finally {
      setSubmitting(false);
    }
  };

  const completion = useMemo(() => snapshot?.completionPercentage ?? null, [snapshot]);
  const renderComponentRow = (component: CareBundleComponent) => {
    const Icon = component.completed ? CheckCircle2 : AlertTriangle;
    return (
      <div
        key={component.key}
        className="flex items-center justify-between rounded-2xl border border-slate-100 bg-white px-4 py-3 shadow-sm"
      >
        <div>
          <p className="text-sm font-semibold text-slate-900">{component.label}</p>
          <p className="text-xs text-slate-500">
            {CARE_COMPONENT_DESCRIPTIONS[component.key] ?? 'Tracked requirement'}
          </p>
        </div>
        <div
          className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-semibold ${
            component.completed
              ? 'bg-emerald-100 text-emerald-700 border border-emerald-200'
              : 'bg-amber-50 text-amber-700 border border-amber-200'
          }`}
        >
          <Icon className="h-3.5 w-3.5" />
          {component.completed ? 'Completed' : 'Pending'}
        </div>
      </div>
    );
  };

  if (!registryId) {
    return (
      <div className="rounded-3xl border border-dashed border-slate-200 p-6 text-center text-slate-400">
        Select a registry to view the diabetes care bundle.
      </div>
    );
  }

  return (
    <div className="rounded-3xl border border-slate-100 bg-gradient-to-b from-slate-50 to-white p-6 shadow-sm">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.35em] text-slate-400">Care bundle</p>
          <h3 className="text-xl font-semibold text-slate-900">WHO-aligned checklist</h3>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={fetchSnapshot}
            disabled={loading}
            className="inline-flex items-center gap-1 rounded-full border border-slate-200 px-3 py-1 text-xs text-slate-600 hover:bg-slate-100 disabled:opacity-50"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
          <button
            onClick={() => setShowForm((prev) => !prev)}
            className="inline-flex items-center gap-1 rounded-full bg-indigo-600 px-3 py-1 text-xs font-semibold text-white shadow-sm hover:bg-indigo-500"
          >
            {showForm ? 'Close Form' : 'Record Snapshot'}
          </button>
        </div>
      </div>

      {showForm && (
        <form onSubmit={handleRecordBundle} className="mt-4 grid grid-cols-1 md:grid-cols-4 gap-3 rounded-2xl border border-slate-100 bg-white/70 p-4">
          <label className="text-xs text-slate-500 flex flex-col gap-1">
            Bundle date
            <input
              type="date"
              name="bundleDate"
              value={formState.bundleDate}
              onChange={handleFormChange}
              className="rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-900 focus:border-indigo-300 focus:ring focus:ring-indigo-200"
            />
          </label>
          <label className="text-xs text-slate-500 flex flex-col gap-1">
            HbA1c (%)
            <input
              type="number"
              step="0.1"
              name="hba1cValue"
              value={formState.hba1cValue}
              onChange={handleFormChange}
              placeholder="7.2"
              className="rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-900 focus:border-indigo-300 focus:ring focus:ring-indigo-200"
            />
          </label>
          <label className="text-xs text-slate-500 flex flex-col gap-1">
            Systolic BP
            <input
              type="number"
              name="systolicBp"
              value={formState.systolicBp}
              onChange={handleFormChange}
              placeholder="120"
              className="rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-900 focus:border-indigo-300 focus:ring focus:ring-indigo-200"
            />
          </label>
          <label className="text-xs text-slate-500 flex flex-col gap-1">
            Diastolic BP
            <input
              type="number"
              name="diastolicBp"
              value={formState.diastolicBp}
              onChange={handleFormChange}
              placeholder="80"
              className="rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-900 focus:border-indigo-300 focus:ring focus:ring-indigo-200"
            />
          </label>
          <label className="text-xs text-slate-500 flex flex-col gap-1 md:col-span-2">
            Completion %
            <input
              type="number"
              min={0}
              max={100}
              name="completionPercentage"
              value={formState.completionPercentage}
              onChange={handleFormChange}
              placeholder="82"
              className="rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-900 focus:border-indigo-300 focus:ring focus:ring-indigo-200"
            />
          </label>
          <div className="md:col-span-4 flex justify-end">
            <button
              type="submit"
              disabled={submitting}
              className="inline-flex items-center gap-2 rounded-2xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow hover:bg-emerald-500 disabled:opacity-50"
            >
              {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
              Save snapshot
            </button>
          </div>
        </form>
      )}

      <div className="mt-6 grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.35em] text-slate-400">Completion</p>
              <p className="text-3xl font-semibold text-slate-900">
                {completion !== null ? `${completion}%` : '—'}
              </p>
              <p className="text-xs text-slate-500">
                {snapshot?.bundle?.bundle_date ? `Updated ${new Date(snapshot.bundle.bundle_date).toLocaleDateString()}` : 'No bundle recorded'}
              </p>
            </div>
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-indigo-50 text-indigo-600">
              <ClipboardList className="h-7 w-7" />
            </div>
          </div>
        </div>
        <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
          <p className="text-xs uppercase tracking-[0.35em] text-slate-400">Latest HbA1c</p>
          <p className="text-3xl font-semibold text-slate-900">
            {snapshot?.bundle?.hba1c_value ? `${snapshot.bundle.hba1c_value}%` : '—'}
          </p>
          <p className="text-xs text-slate-500">
            {snapshot?.bundle?.hba1c_date ? new Date(snapshot.bundle.hba1c_date).toLocaleDateString() : 'Awaiting lab result'}
          </p>
        </div>
        <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
          <p className="text-xs uppercase tracking-[0.35em] text-slate-400">Blood pressure</p>
          <p className="text-3xl font-semibold text-slate-900">
            {snapshot?.bundle?.systolic_bp && snapshot.bundle.diastolic_bp
              ? `${snapshot.bundle.systolic_bp}/${snapshot.bundle.diastolic_bp}`
              : '—'}
          </p>
          <p className="text-xs text-slate-500">
            {snapshot?.bundle?.bp_date ? `Recorded ${new Date(snapshot.bundle.bp_date).toLocaleDateString()}` : 'Not captured'}
          </p>
        </div>
      </div>

      <div className="mt-6 space-y-3">
        {loading && (
          <div className="flex items-center justify-center rounded-2xl border border-slate-100 bg-white py-6 text-slate-500">
            <Loader2 className="h-5 w-5 animate-spin mr-2" />
            Loading care bundle components...
          </div>
        )}
        {!loading && snapshot?.components?.length
          ? snapshot.components.map(renderComponentRow)
          : !loading && (
              <div className="rounded-2xl border border-dashed border-slate-200 p-6 text-center text-slate-500">
                No care bundle checklist entries yet.
              </div>
            )}
      </div>
    </div>
  );
};

export default DiabetesCareBundle;


