import React, { useCallback, useEffect, useState } from 'react';
import { Calculator, Loader2, RefreshCw } from 'lucide-react';
import { diabetesApi } from '../services/api';
import { useNotification } from './GlobalNotification';

type DiabetesInsulinRegimenProps = {
  tenantSlug: string;
  token: string;
  registryId?: string;
  patientId?: string;
};

const DiabetesInsulinRegimen: React.FC<DiabetesInsulinRegimenProps> = ({
  tenantSlug,
  token,
  registryId,
}) => {
  const { showError, showSuccess } = useNotification();
  const [regimen, setRegimen] = useState<any | null>(null);
  const [loading, setLoading] = useState(false);
  const [calcSubmitting, setCalcSubmitting] = useState(false);
  const [calcResult, setCalcResult] = useState<any | null>(null);
  const [calcState, setCalcState] = useState({
    currentGlucose: '',
    carbohydrateIntake: '',
  });

  const fetchRegimen = useCallback(async () => {
    if (!registryId || !tenantSlug || !token) {
      return;
    }
    setLoading(true);
    try {
      const response = await diabetesApi.getActiveInsulinRegimen(registryId, token, tenantSlug);
      setRegimen(response.data ?? null);
    } catch (error) {
      console.error('Failed to load insulin regimen', error);
      showError('Unable to load insulin regimen', 'Please retry shortly.');
    } finally {
      setLoading(false);
    }
  }, [registryId, tenantSlug, token, showError]);

  useEffect(() => {
    fetchRegimen();
  }, [fetchRegimen]);

  const handleCalcChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = event.target;
    setCalcState((prev) => ({ ...prev, [name]: value }));
  };

  const handleCalculateDose = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!regimen?.id) {
      showError('No regimen', 'Define an insulin regimen before running the calculator.');
      return;
    }
    setCalcSubmitting(true);
    try {
      const payload = {
        currentGlucose: Number(calcState.currentGlucose),
        carbohydrateIntake: Number(calcState.carbohydrateIntake),
      };
      const response = await diabetesApi.calculateInsulinDose(regimen.id, token, tenantSlug, payload);
      setCalcResult(response.data);
    } catch (error) {
      console.error('Failed to calculate dose', error);
      showError('Unable to calculate dose', 'Please verify the inputs and retry.');
    } finally {
      setCalcSubmitting(false);
    }
  };

  if (!registryId) {
    return (
      <div className="rounded-3xl border border-dashed border-slate-200 p-6 text-center text-slate-400">
        Select a registry to view insulin regimen details.
      </div>
    );
  }

  return (
    <div className="rounded-3xl border border-slate-100 bg-white shadow-sm">
      <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
        <div>
          <p className="text-xs uppercase tracking-[0.35em] text-slate-400">Insulin strategy</p>
          <h3 className="text-xl font-semibold text-slate-900">Regimen & calculator</h3>
        </div>
        <button
          onClick={fetchRegimen}
          disabled={loading}
          className="inline-flex items-center gap-1 rounded-full border border-slate-200 px-3 py-1 text-xs text-slate-600 hover:bg-slate-100 disabled:opacity-50"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {loading && (
        <div className="flex items-center justify-center py-10 text-slate-500">
          <Loader2 className="h-5 w-5 animate-spin mr-2" />
          Loading regimen...
        </div>
      )}

      {!loading && !regimen && (
        <div className="p-6 text-sm text-slate-500">
          No insulin regimen on file. Document basal/bolus therapy to unlock the calculator.
        </div>
      )}

      {!loading && regimen && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 p-6">
          <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4 space-y-2">
            <p className="text-xs uppercase tracking-[0.35em] text-slate-400">Regimen type</p>
            <p className="text-2xl font-semibold text-slate-900 capitalize">
              {regimen.regimen_type?.replace('_', ' ') ?? 'N/A'}
            </p>
            <div className="text-xs text-slate-500 space-y-1">
              {regimen.basal_insulin_type && <p>Basal: {regimen.basal_insulin_type} ({regimen.basal_dose} units)</p>}
              {regimen.bolus_insulin_type && (
                <p>
                  Bolus: {regimen.bolus_insulin_type} • Carb ratio {regimen.carb_ratio ?? '—'}
                </p>
              )}
              {regimen.correction_factor && <p>Correction factor: {regimen.correction_factor}</p>}
              {regimen.target_glucose && <p>Target glucose: {regimen.target_glucose} mmol/L</p>}
            </div>
          </div>

          <form onSubmit={handleCalculateDose} className="lg:col-span-2 rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <div>
                <p className="text-xs uppercase tracking-[0.35em] text-slate-400">Dose calculator</p>
                <h4 className="text-lg font-semibold text-slate-900">Smart bolus helper</h4>
              </div>
              <Calculator className="h-5 w-5 text-slate-400" />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <label className="text-xs text-slate-500 flex flex-col gap-1">
                Current glucose
                <input
                  type="number"
                  name="currentGlucose"
                  value={calcState.currentGlucose}
                  onChange={handleCalcChange}
                  placeholder="e.g., 210"
                  required
                  className="rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-900 focus:border-indigo-200 focus:ring focus:ring-indigo-100"
                />
              </label>
              <label className="text-xs text-slate-500 flex flex-col gap-1">
                Carbohydrates (g)
                <input
                  type="number"
                  name="carbohydrateIntake"
                  value={calcState.carbohydrateIntake}
                  onChange={handleCalcChange}
                  placeholder="45"
                  required
                  className="rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-900 focus:border-indigo-200 focus:ring focus:ring-indigo-100"
                />
              </label>
              <label className="text-xs text-slate-500 flex flex-col gap-1">
                Target glucose
                <input
                  type="number"
                  value={regimen.target_glucose ?? ''}
                  readOnly
                  className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900"
                />
              </label>
            </div>
            <div className="mt-3 flex justify-end">
              <button
                type="submit"
                disabled={calcSubmitting}
                className="inline-flex items-center gap-2 rounded-2xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow hover:bg-indigo-500 disabled:opacity-50"
              >
                {calcSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
                Calculate dose
              </button>
            </div>
            {calcResult && (
              <div className="mt-4 rounded-2xl border border-indigo-100 bg-indigo-50 p-4 text-sm text-indigo-900">
                <p className="font-semibold text-indigo-900">Recommended dose: {calcResult.recommendedUnits} U</p>
                <p className="text-xs text-indigo-700 mt-1">
                  Carb dose {calcResult.components?.carbDose ?? '—'} U • Correction dose{' '}
                  {calcResult.components?.correctionDose ?? '—'} U
                </p>
              </div>
            )}
          </form>
        </div>
      )}
    </div>
  );
};

export default DiabetesInsulinRegimen;


