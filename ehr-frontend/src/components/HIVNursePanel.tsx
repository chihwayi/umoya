import React, { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, Activity, TestTube, CheckCircle, Save, X, Loader2 } from 'lucide-react';
import { ehrApi } from '../services/api';
import { useNotification } from './GlobalNotification';

type HIVNursePanelProps = {
  appointmentId: string;
  patientId: string;
  tenantSlug: string;
  token: string;
  onClose: () => void;
  onSaved?: () => void;
};

const createInitialFormState = () => ({
  hivStatus: 'known_positive', // known_positive | newly_diagnosed | unknown
  onART: true,
  regimen: 'TLD',
  startDate: '',
  adherence: 100,
  sideEffects: '',
  tbScreen: 'no_cough', // no_cough | cough | night_sweats | weight_loss | fever
  pregnantBreastfeeding: 'no', // no | pregnant | breastfeeding
  lastVLDate: '',
  lastVLResult: '', // copies/mL
  lastCD4: '',
  oiProphylaxis: 'cotrimoxazole',
});

const HIVNursePanel: React.FC<HIVNursePanelProps> = ({ appointmentId, patientId, tenantSlug, token, onClose, onSaved }) => {
  const [loading, setLoading] = useState(false);
  const { showSuccess, showError } = useNotification();
  const [form, setForm] = useState(createInitialFormState);
  const [submitting, setSubmitting] = useState(false);
  const [loadingExisting, setLoadingExisting] = useState(false);

  const cdssInputs = useMemo(() => ({
    diagnoses: ['HIV'],
    medications: [form.regimen],
  }), [form.regimen]);

  useEffect(() => {
    if (!tenantSlug || !token) {
      return;
    }

    let cancelled = false;

    const loadExistingIntake = async () => {
      try {
        setLoadingExisting(true);
        setForm(createInitialFormState());

        const appointmentResponse = await ehrApi.getHivNurseIntakeForAppointment(appointmentId, token, tenantSlug);
        const intake = appointmentResponse.data?.intake;

        if (!cancelled && intake?.form) {
          setForm((prev) => ({ ...prev, ...intake.form }));
          return;
        }

        const patientResponse = await ehrApi.getHivNurseIntakesByPatient(patientId, token, tenantSlug);
        const latest = Array.isArray(patientResponse.data?.intakes)
          ? patientResponse.data.intakes[0]
          : null;
        if (!cancelled && latest?.form) {
          setForm((prev) => ({ ...prev, ...latest.form }));
        }
      } catch (error) {
        console.error('Failed to load HIV nurse intake', error);
      } finally {
        if (!cancelled) {
          setLoadingExisting(false);
        }
      }
    };

    loadExistingIntake();

    return () => {
      cancelled = true;
    };
  }, [appointmentId, patientId, tenantSlug, token]);

  const save = async () => {
    if (!tenantSlug || !token) {
      showError('Session expired', 'Please sign in again to continue.');
      return;
    }

    try {
      setSubmitting(true);
      const adherenceValue =
        typeof form.adherence === 'number' ? form.adherence : Number(form.adherence);

      await ehrApi.saveHivNurseIntake(
        {
          patientId,
          appointmentId,
          intakeDate: new Date().toISOString(),
          form,
          adherencePercentage:
            Number.isFinite(adherenceValue) && !Number.isNaN(adherenceValue)
              ? adherenceValue
              : undefined,
          regimen: form.regimen,
        },
        token,
        tenantSlug,
      );

      showSuccess('HIV intake saved', 'Nursing intake has been recorded successfully.');
      onSaved && onSaved();
      onClose();
    } catch (e: any) {
      console.error('Failed to save HIV intake:', e);
      const message = e?.response?.data?.message || 'Failed to save HIV intake';
      showError('Save failed', message);
    } finally {
      setSubmitting(false);
    }
  };

  const orderVL = async () => {
    try {
      setLoading(true);
      await ehrApi.createLabOrder({
        patientId,
        tests: [{ testCode: 'VL', testName: 'HIV Viral Load', category: 'virology', specimenType: 'plasma' }],
        priority: 'routine',
        clinicalInfo: 'HIV care - Viral Load monitoring',
      }, token, tenantSlug);
      showSuccess('Viral load order submitted. Accounts will release the test once payment is confirmed.');
    } catch (e) {
      console.error('Failed to order VL:', e);
      showError('Failed to submit viral load order');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full max-w-3xl bg-white rounded-2xl shadow-xl border border-slate-200 overflow-hidden">
      <div className="px-5 py-3 border-b border-slate-200 flex items-center justify-between bg-gradient-to-r from-emerald-600 to-teal-600 text-white">
        <div className="flex items-center gap-2">
          <Activity className="w-5 h-5" />
          <h3 className="font-semibold">HIV Nurse Intake</h3>
        </div>
        <button onClick={onClose} className="p-2 rounded hover:bg-white/10"><X className="w-5 h-5" /></button>
      </div>

      <div className="p-5 space-y-5">
        {loadingExisting && (
          <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800 flex items-center gap-2">
            <Loader2 className="w-4 h-4 animate-spin" />
            <span>Loading previous intake details…</span>
          </div>
        )}

        {/* Status & ART */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="text-xs text-slate-600">HIV Status</label>
            <select value={form.hivStatus} onChange={e => setForm({ ...form, hivStatus: e.target.value })} className="w-full border rounded-lg p-2">
              <option value="known_positive">Known Positive</option>
              <option value="newly_diagnosed">Newly Diagnosed</option>
              <option value="unknown">Unknown</option>
            </select>
          </div>
          <div>
            <label className="text-xs text-slate-600">On ART</label>
            <select value={form.onART ? 'yes' : 'no'} onChange={e => setForm({ ...form, onART: e.target.value === 'yes' })} className="w-full border rounded-lg p-2">
              <option value="yes">Yes</option>
              <option value="no">No</option>
            </select>
          </div>
          <div>
            <label className="text-xs text-slate-600">Regimen</label>
            <select value={form.regimen} onChange={e => setForm({ ...form, regimen: e.target.value })} className="w-full border rounded-lg p-2">
              <option>TLD</option>
              <option>AZT/3TC/DTG</option>
              <option>Other</option>
            </select>
          </div>
        </div>

        {/* Monitoring */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="text-xs text-slate-600">Last VL Date</label>
            <input type="date" value={form.lastVLDate} onChange={e => setForm({ ...form, lastVLDate: e.target.value })} className="w-full border rounded-lg p-2" />
          </div>
          <div>
            <label className="text-xs text-slate-600">Last VL Result (copies/mL)</label>
            <input value={form.lastVLResult} onChange={e => setForm({ ...form, lastVLResult: e.target.value })} className="w-full border rounded-lg p-2" />
          </div>
          <div>
            <label className="text-xs text-slate-600">Last CD4</label>
            <input value={form.lastCD4} onChange={e => setForm({ ...form, lastCD4: e.target.value })} className="w-full border rounded-lg p-2" />
          </div>
        </div>

        {/* Adherence & TB */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="text-xs text-slate-600">Adherence (%)</label>
            <input type="number" min={0} max={100} value={form.adherence} onChange={e => setForm({ ...form, adherence: Number(e.target.value) })} className="w-full border rounded-lg p-2" />
          </div>
          <div>
            <label className="text-xs text-slate-600">TB Screening</label>
            <select value={form.tbScreen} onChange={e => setForm({ ...form, tbScreen: e.target.value })} className="w-full border rounded-lg p-2">
              <option value="no_cough">No TB symptoms</option>
              <option value="cough">Cough</option>
              <option value="night_sweats">Night sweats</option>
              <option value="weight_loss">Weight loss</option>
              <option value="fever">Fever</option>
            </select>
          </div>
          <div>
            <label className="text-xs text-slate-600">Pregnant/Breastfeeding</label>
            <select value={form.pregnantBreastfeeding} onChange={e => setForm({ ...form, pregnantBreastfeeding: e.target.value })} className="w-full border rounded-lg p-2">
              <option value="no">No</option>
              <option value="pregnant">Pregnant</option>
              <option value="breastfeeding">Breastfeeding</option>
            </select>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="flex items-center gap-3">
          <button onClick={orderVL} disabled={loading} className="px-3 py-2 rounded-lg border border-blue-200 text-blue-700 hover:bg-blue-50 text-sm flex items-center gap-2">
            <TestTube className="w-4 h-4" /> Order Viral Load
          </button>
          <button onClick={save} disabled={submitting || loadingExisting} className="px-3 py-2 rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 text-sm flex items-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed">
            <Save className="w-4 h-4" /> {submitting ? 'Saving…' : 'Save HIV Intake'}
          </button>
        </div>

        {/* Simple CDSS prompts */}
        <div className="mt-4 p-3 rounded-lg border border-amber-300 bg-amber-50 text-amber-900 text-sm">
          <div className="flex items-center gap-2 mb-1">
            <AlertTriangle className="w-4 h-4" />
            <span className="font-semibold">CDSS Prompts</span>
          </div>
          <ul className="list-disc pl-5 space-y-1">
            <li>Viral Load due if > 6 months from last test</li>
            <li>Consider TB testing if any symptom present</li>
            <li>Ensure cotrimoxazole prophylaxis when indicated</li>
            <li>For pregnancy/breastfeeding: ensure PMTCT linkage and VL monitoring</li>
          </ul>
        </div>
      </div>
    </div>
  );
};

export default HIVNursePanel;
