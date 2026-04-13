import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { AlertTriangle, Brain, Pill, ShieldAlert, Waves } from 'lucide-react';
import { epilepsyApi } from '../services/api';
import { useNotification } from './GlobalNotification';

type TabKey = 'register' | 'seizures' | 'aed' | 'toxicity';

const tabMeta: Array<{ key: TabKey; label: string; icon: React.ComponentType<{ className?: string }> }> = [
  { key: 'register', label: 'Register', icon: Brain },
  { key: 'seizures', label: 'Seizures', icon: Waves },
  { key: 'aed', label: 'AED', icon: Pill },
  { key: 'toxicity', label: 'Toxicity', icon: ShieldAlert },
];

const aedLevelRanges: Record<string, { min: number; max: number; unit: string }> = {
  phenobarbital: { min: 15, max: 40, unit: 'mcg/mL' },
  sodium_valproate: { min: 50, max: 100, unit: 'mcg/mL' },
  carbamazepine: { min: 4, max: 12, unit: 'mcg/mL' },
  phenytoin: { min: 10, max: 20, unit: 'mcg/mL' },
};

const knownAeds = ['phenobarbital', 'sodium_valproate', 'carbamazepine', 'phenytoin', 'lamotrigine'];
const toxicityTypes = [
  'hepatotoxicity',
  'pancreatitis',
  'Stevens-Johnson_syndrome',
  'hyponatraemia',
  'bone_marrow_suppression',
  'thrombocytopenia',
  'encephalopathy',
];

function badgeTone(severity: string): string {
  if (severity === 'critical' || severity === 'severe') return 'border-red-500/40 bg-red-500/15 text-red-100';
  if (severity === 'major' || severity === 'moderate') return 'border-amber-500/40 bg-amber-500/15 text-amber-100';
  return 'border-slate-700 bg-slate-800/80 text-slate-200';
}

function safeJsonParse(value: string): Record<string, any> | null {
  if (!value.trim()) return null;
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

export default function EpilepsyDashboard({ patientId }: { patientId: string }) {
  const { tenantSlug } = useParams<{ tenantSlug: string }>();
  const token = localStorage.getItem('ehr_token') || '';
  const currentUserId = useMemo(() => {
    try {
      const stored = localStorage.getItem('ehr_user');
      if (!stored) return '';
      const parsed = JSON.parse(stored);
      return parsed?.id || parsed?.userId || '';
    } catch {
      return '';
    }
  }, []);
  const { showError, showSuccess } = useNotification();

  const [activeTab, setActiveTab] = useState<TabKey>('register');
  const [registerEntry, setRegisterEntry] = useState<any | null>(null);
  const [seizureHistory, setSeizureHistory] = useState<any[]>([]);
  const [aedTherapy, setAedTherapy] = useState<any[]>([]);
  const [toxicityEvents, setToxicityEvents] = useState<any[]>([]);
  const [aedDoseResult, setAedDoseResult] = useState<any | null>(null);
  const [interactionResult, setInteractionResult] = useState<any | null>(null);
  const [statusResult, setStatusResult] = useState<any | null>(null);

  const [registerForm, setRegisterForm] = useState({
    diagnosisDate: '',
    ilaeSeizureType: 'focal_aware',
    ilaeSyndrome: 'Unclassified',
    etiology: 'unknown',
    etiologyDetail: '',
    icd11Code: 'G40',
    seizureFreedomSince: '',
    lastSeizureDate: '',
    seizureFrequencyPerMonth: '',
    currentStatus: 'active',
    drivingRestriction: false,
    pregnancyRiskCounselled: false,
    notes: '',
    nextReviewDate: '',
  });
  const [doseAdvisorForm, setDoseAdvisorForm] = useState({
    seizureType: 'focal_aware',
    patientAgeYears: '',
    patientWeightKg: '',
    sex: 'female',
    isWra: false,
    concurrentArv: false,
    concurrentTbTreatment: false,
    comorbidities: '',
    lowResourceSetting: true,
  });
  const [seizureForm, setSeizureForm] = useState({
    seizureDate: new Date().toISOString().slice(0, 10),
    seizureType: 'generalised_tonic_clonic',
    durationMinutes: '',
    triggers: '',
    postictalState: '',
    statusEpilepticus: false,
  });
  const [statusForm, setStatusForm] = useState({
    durationMinutes: '',
    patientAgeYears: '',
    patientWeightKg: '',
    ivAccess: true,
    drugsAvailable: 'diazepam,phenobarbital',
  });
  const [aedForm, setAedForm] = useState({
    drugName: 'phenobarbital',
    doseMg: '',
    frequency: 'once daily at night',
    route: 'oral',
    startDate: new Date().toISOString().slice(0, 10),
    drugLevelResult: '',
    drugLevelUnit: 'mcg/mL',
    drugLevelDate: '',
    drugLevelInterpretation: '',
    indication: '',
    notes: '',
    concurrentDrugs: '',
    isWra: false,
  });
  const [interactionForm, setInteractionForm] = useState({
    aedName: 'phenobarbital',
    concurrentDrugs: '',
    isWra: false,
  });
  const [toxicityForm, setToxicityForm] = useState({
    eventDate: new Date().toISOString().slice(0, 10),
    drugName: 'phenobarbital',
    toxicityType: 'hepatotoxicity',
    severity: 'mild',
    organSystem: 'hepatic',
    clinicalFindings: '',
    labMarkers: '{}',
    actionTaken: '',
    outcome: '',
  });

  const activeAed = useMemo(
    () => aedTherapy.filter((row) => !row.stopDate),
    [aedTherapy],
  );

  const loadData = useCallback(async () => {
    if (!tenantSlug || !token) return;
    try {
      const [registerRow, seizures, therapies, toxicities] = await Promise.all([
        epilepsyApi.getRegister(patientId, token, tenantSlug).catch(() => null),
        epilepsyApi.getSeizureHistory(patientId, token, tenantSlug).catch(() => []),
        epilepsyApi.getAedTherapy(patientId, token, tenantSlug).catch(() => []),
        epilepsyApi.getToxicityEvents(patientId, token, tenantSlug).catch(() => []),
      ]);
      setRegisterEntry(registerRow ?? null);
      setSeizureHistory(Array.isArray(seizures) ? seizures : []);
      setAedTherapy(Array.isArray(therapies) ? therapies : []);
      setToxicityEvents(Array.isArray(toxicities) ? toxicities : []);
    } catch (error: any) {
      showError('Epilepsy', error?.response?.data?.message || 'Failed to load epilepsy records.');
    }
  }, [patientId, showError, tenantSlug, token]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  useEffect(() => {
    if (!registerEntry) return;
    setRegisterForm({
      diagnosisDate: registerEntry.diagnosisDate ?? '',
      ilaeSeizureType: registerEntry.ilaeSeizureType ?? 'focal_aware',
      ilaeSyndrome: registerEntry.ilaeSyndrome ?? 'Unclassified',
      etiology: registerEntry.etiology ?? 'unknown',
      etiologyDetail: registerEntry.etiologyDetail ?? '',
      icd11Code: registerEntry.icd11Code ?? 'G40',
      seizureFreedomSince: registerEntry.seizureFreedomSince ?? '',
      lastSeizureDate: registerEntry.lastSeizureDate ?? '',
      seizureFrequencyPerMonth: registerEntry.seizureFrequencyPerMonth?.toString?.() ?? '',
      currentStatus: registerEntry.currentStatus ?? 'active',
      drivingRestriction: Boolean(registerEntry.drivingRestriction),
      pregnancyRiskCounselled: Boolean(registerEntry.pregnancyRiskCounselled),
      notes: registerEntry.notes ?? '',
      nextReviewDate: registerEntry.nextReviewDate ?? '',
    });
  }, [registerEntry]);

  const submitRegister = async () => {
    if (!tenantSlug || !token) return;
    const payload = {
      diagnosisDate: registerForm.diagnosisDate || null,
      ilaeSeizureType: registerForm.ilaeSeizureType || null,
      ilaeSyndrome: registerForm.ilaeSyndrome || null,
      etiology: registerForm.etiology || null,
      etiologyDetail: registerForm.etiologyDetail || null,
      icd11Code: registerForm.icd11Code || null,
      seizureFreedomSince: registerForm.seizureFreedomSince || null,
      lastSeizureDate: registerForm.lastSeizureDate || null,
      seizureFrequencyPerMonth: registerForm.seizureFrequencyPerMonth ? Number(registerForm.seizureFrequencyPerMonth) : null,
      currentStatus: registerForm.currentStatus,
      drivingRestriction: registerForm.drivingRestriction,
      pregnancyRiskCounselled: registerForm.pregnancyRiskCounselled,
      notes: registerForm.notes || null,
      nextReviewDate: registerForm.nextReviewDate || null,
    };
    try {
      if (registerEntry?.id) {
        await epilepsyApi.updateRegister(registerEntry.id, payload, token, tenantSlug);
        showSuccess('Epilepsy Register', 'Register updated.');
      } else {
        await epilepsyApi.enroll(patientId, payload, token, tenantSlug);
        showSuccess('Epilepsy Register', 'Patient enrolled in the epilepsy register.');
      }
      await loadData();
    } catch (error: any) {
      showError('Epilepsy Register', error?.response?.data?.message || 'Failed to save epilepsy register.');
    }
  };

  const runDoseAdvisor = async () => {
    if (!tenantSlug || !token) return;
    try {
      const result = await epilepsyApi.getAedDose(
        {
          seizure_type: doseAdvisorForm.seizureType,
          patient_age_years: Number(doseAdvisorForm.patientAgeYears || 0),
          patient_weight_kg: doseAdvisorForm.patientWeightKg ? Number(doseAdvisorForm.patientWeightKg) : null,
          sex: doseAdvisorForm.sex || null,
          is_wra: doseAdvisorForm.isWra,
          concurrent_arv: doseAdvisorForm.concurrentArv,
          concurrent_tb_treatment: doseAdvisorForm.concurrentTbTreatment,
          comorbidities: doseAdvisorForm.comorbidities.split(',').map((item) => item.trim()).filter(Boolean),
          low_resource_setting: doseAdvisorForm.lowResourceSetting,
        },
        token,
        tenantSlug,
      );
      setAedDoseResult(result);
    } catch (error: any) {
      showError('AED Dose', error?.response?.data?.message || 'Failed to get AED guidance.');
    }
  };

  const submitSeizure = async () => {
    if (!tenantSlug || !token) return;
    try {
      await epilepsyApi.recordSeizure(
        patientId,
        {
          recordedBy: currentUserId || null,
          seizureDate: new Date(`${seizureForm.seizureDate}T00:00:00.000Z`).toISOString(),
          seizureType: seizureForm.seizureType,
          durationSeconds: seizureForm.durationMinutes ? Number(seizureForm.durationMinutes) * 60 : null,
          triggers: seizureForm.triggers ? seizureForm.triggers.split(',').map((item) => item.trim()).filter(Boolean) : [],
          postictalState: seizureForm.postictalState || null,
          statusEpilepticus: seizureForm.statusEpilepticus,
          injuryOccurred: false,
          witnessPresent: false,
          clusterEvent: false,
          notes: seizureForm.triggers || null,
        },
        token,
        tenantSlug,
      );
      showSuccess('Seizure Diary', 'Seizure event recorded.');
      await loadData();
    } catch (error: any) {
      showError('Seizure Diary', error?.response?.data?.message || 'Failed to record seizure event.');
    }
  };

  const runStatusProtocol = async () => {
    if (!tenantSlug || !token) return;
    try {
      const result = await epilepsyApi.getStatusEpilepticusProtocol(
        {
          duration_minutes: Number(statusForm.durationMinutes || 0),
          patient_age_years: Number(statusForm.patientAgeYears || 0),
          patient_weight_kg: statusForm.patientWeightKg ? Number(statusForm.patientWeightKg) : null,
          iv_access: statusForm.ivAccess,
          drugs_available: statusForm.drugsAvailable.split(',').map((item) => item.trim()).filter(Boolean),
        },
        token,
        tenantSlug,
      );
      setStatusResult(result);
    } catch (error: any) {
      showError('Status Epilepticus', error?.response?.data?.message || 'Failed to load protocol.');
    }
  };

  const submitAed = async () => {
    if (!tenantSlug || !token) return;
    try {
      const result = await epilepsyApi.recordAed(
        patientId,
        {
          drugName: aedForm.drugName,
          doseMg: Number(aedForm.doseMg || 0),
          frequency: aedForm.frequency,
          route: aedForm.route,
          startDate: aedForm.startDate,
          drugLevelResult: aedForm.drugLevelResult ? Number(aedForm.drugLevelResult) : null,
          drugLevelUnit: aedForm.drugLevelUnit || null,
          drugLevelDate: aedForm.drugLevelDate || null,
          drugLevelInterpretation: aedForm.drugLevelInterpretation || null,
          indication: aedForm.indication || null,
          notes: aedForm.notes || null,
          concurrentDrugs: aedForm.concurrentDrugs.split(',').map((item) => item.trim()).filter(Boolean),
          isWra: aedForm.isWra,
        },
        token,
        tenantSlug,
      );
      setInteractionResult(result?.interactionAlerts ?? null);
      showSuccess('AED Therapy', 'AED therapy saved.');
      await loadData();
    } catch (error: any) {
      showError('AED Therapy', error?.response?.data?.message || 'Failed to record AED therapy.');
    }
  };

  const stopAed = async (id: string) => {
    if (!tenantSlug || !token) return;
    try {
      await epilepsyApi.stopAed(
        id,
        {
          stopDate: new Date().toISOString().slice(0, 10),
          stopReason: 'Stopped from dashboard',
        },
        token,
        tenantSlug,
      );
      showSuccess('AED Therapy', 'AED marked as stopped.');
      await loadData();
    } catch (error: any) {
      showError('AED Therapy', error?.response?.data?.message || 'Failed to stop AED.');
    }
  };

  const runInteractionChecker = async () => {
    if (!tenantSlug || !token) return;
    try {
      const result = await epilepsyApi.checkDrugInteractions(
        {
          aed_name: interactionForm.aedName,
          concurrent_drugs: interactionForm.concurrentDrugs.split(',').map((item) => item.trim()).filter(Boolean),
          is_wra: interactionForm.isWra,
        },
        token,
        tenantSlug,
      );
      setInteractionResult(result);
    } catch (error: any) {
      showError('Drug Interactions', error?.response?.data?.message || 'Failed to check interactions.');
    }
  };

  const submitToxicity = async () => {
    if (!tenantSlug || !token) return;
    const labMarkers = safeJsonParse(toxicityForm.labMarkers);
    if (toxicityForm.labMarkers.trim() && !labMarkers) {
      showError('Toxicity', 'Lab markers must be valid JSON.');
      return;
    }
    try {
      await epilepsyApi.recordToxicity(
        patientId,
        {
          eventDate: toxicityForm.eventDate,
          drugName: toxicityForm.drugName,
          toxicityType: toxicityForm.toxicityType,
          severity: toxicityForm.severity,
          organSystem: toxicityForm.organSystem || null,
          clinicalFindings: toxicityForm.clinicalFindings || null,
          labMarkers: labMarkers ?? {},
          actionTaken: toxicityForm.actionTaken || null,
          outcome: toxicityForm.outcome || null,
        },
        token,
        tenantSlug,
      );
      showSuccess('Toxicity', 'Toxicity event recorded.');
      await loadData();
    } catch (error: any) {
      showError('Toxicity', error?.response?.data?.message || 'Failed to record toxicity event.');
    }
  };

  return (
    <div className="space-y-6 rounded-3xl border border-slate-800 bg-slate-950 p-4 text-slate-100">
      <div className="flex flex-wrap gap-2">
        {tabMeta.map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.key}
              type="button"
              onClick={() => setActiveTab(tab.key)}
              className={`inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-medium transition ${
                activeTab === tab.key
                  ? 'border-cyan-500 bg-cyan-500/15 text-cyan-200'
                  : 'border-slate-800 bg-slate-900/80 text-slate-300 hover:border-slate-700'
              }`}
            >
              <Icon className="h-4 w-4" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {activeTab === 'register' && (
        <div className="grid gap-6 lg:grid-cols-2">
          <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-5">
            <h3 className="mb-4 text-lg font-semibold text-white">Epilepsy Register</h3>
            <div className="grid gap-3 md:grid-cols-2">
              <input className="rounded-xl border border-slate-800 bg-slate-950 px-3 py-2" value={registerForm.diagnosisDate} onChange={(e) => setRegisterForm((s) => ({ ...s, diagnosisDate: e.target.value }))} type="date" />
              <select className="rounded-xl border border-slate-800 bg-slate-950 px-3 py-2" value={registerForm.ilaeSeizureType} onChange={(e) => setRegisterForm((s) => ({ ...s, ilaeSeizureType: e.target.value }))}>
                <option value="focal_aware">Focal aware</option>
                <option value="focal_impaired">Focal impaired</option>
                <option value="generalised_tonic_clonic">Generalised tonic clonic</option>
                <option value="absence">Absence</option>
                <option value="myoclonic">Myoclonic</option>
                <option value="unknown_onset">Unknown onset</option>
              </select>
              <input className="rounded-xl border border-slate-800 bg-slate-950 px-3 py-2" value={registerForm.ilaeSyndrome} onChange={(e) => setRegisterForm((s) => ({ ...s, ilaeSyndrome: e.target.value }))} placeholder="ILAE syndrome" />
              <select className="rounded-xl border border-slate-800 bg-slate-950 px-3 py-2" value={registerForm.etiology} onChange={(e) => setRegisterForm((s) => ({ ...s, etiology: e.target.value }))}>
                <option value="unknown">Unknown</option>
                <option value="structural">Structural</option>
                <option value="genetic">Genetic</option>
                <option value="infectious">Infectious</option>
                <option value="metabolic">Metabolic</option>
                <option value="immune">Immune</option>
              </select>
              <input className="rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 md:col-span-2" value={registerForm.etiologyDetail} onChange={(e) => setRegisterForm((s) => ({ ...s, etiologyDetail: e.target.value }))} placeholder="Etiology detail" />
              <input className="rounded-xl border border-slate-800 bg-slate-950 px-3 py-2" value={registerForm.icd11Code} onChange={(e) => setRegisterForm((s) => ({ ...s, icd11Code: e.target.value }))} placeholder="ICD-11 code" />
              <input className="rounded-xl border border-slate-800 bg-slate-950 px-3 py-2" value={registerForm.nextReviewDate} onChange={(e) => setRegisterForm((s) => ({ ...s, nextReviewDate: e.target.value }))} type="date" />
              <input className="rounded-xl border border-slate-800 bg-slate-950 px-3 py-2" value={registerForm.seizureFreedomSince} onChange={(e) => setRegisterForm((s) => ({ ...s, seizureFreedomSince: e.target.value }))} type="date" />
              <input className="rounded-xl border border-slate-800 bg-slate-950 px-3 py-2" value={registerForm.lastSeizureDate} onChange={(e) => setRegisterForm((s) => ({ ...s, lastSeizureDate: e.target.value }))} type="date" />
              <input className="rounded-xl border border-slate-800 bg-slate-950 px-3 py-2" value={registerForm.seizureFrequencyPerMonth} onChange={(e) => setRegisterForm((s) => ({ ...s, seizureFrequencyPerMonth: e.target.value }))} placeholder="Seizures per month" />
              <select className="rounded-xl border border-slate-800 bg-slate-950 px-3 py-2" value={registerForm.currentStatus} onChange={(e) => setRegisterForm((s) => ({ ...s, currentStatus: e.target.value }))}>
                <option value="active">Active</option>
                <option value="stable">Stable</option>
                <option value="seizure_free">Seizure free</option>
                <option value="inactive">Inactive</option>
              </select>
              <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={registerForm.drivingRestriction} onChange={(e) => setRegisterForm((s) => ({ ...s, drivingRestriction: e.target.checked }))} /> Driving restriction</label>
              <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={registerForm.pregnancyRiskCounselled} onChange={(e) => setRegisterForm((s) => ({ ...s, pregnancyRiskCounselled: e.target.checked }))} /> Pregnancy risk counselled</label>
              <textarea className="rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 md:col-span-2" rows={3} value={registerForm.notes} onChange={(e) => setRegisterForm((s) => ({ ...s, notes: e.target.value }))} placeholder="Clinical notes" />
            </div>
            <button type="button" onClick={submitRegister} className="mt-4 rounded-xl bg-cyan-500 px-4 py-2 font-semibold text-slate-950">
              {registerEntry ? 'Update register' : 'Enroll patient'}
            </button>
            {registerEntry && (
              <div className="mt-4 rounded-2xl border border-slate-800 bg-slate-950 p-4 text-sm text-slate-300">
                <div className="flex flex-wrap gap-2">
                  <span className={`rounded-full border px-3 py-1 ${badgeTone(registerEntry.currentStatus)}`}>{registerEntry.currentStatus}</span>
                  <span>Next review: {registerEntry.nextReviewDate || 'Not set'}</span>
                </div>
                <p className="mt-2">Last seizure: {registerEntry.lastSeizureDate || 'Not recorded'}</p>
                <p>Seizure freedom since: {registerEntry.seizureFreedomSince || 'Not recorded'}</p>
                <p>Frequency/month: {registerEntry.seizureFrequencyPerMonth ?? 'Not recorded'}</p>
              </div>
            )}
          </div>

          <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-5">
            <h3 className="mb-4 text-lg font-semibold text-white">AED Dose Advisor</h3>
            <div className="grid gap-3 md:grid-cols-2">
              <select className="rounded-xl border border-slate-800 bg-slate-950 px-3 py-2" value={doseAdvisorForm.seizureType} onChange={(e) => setDoseAdvisorForm((s) => ({ ...s, seizureType: e.target.value }))}>
                <option value="focal_aware">Focal aware</option>
                <option value="generalised_tonic_clonic">Generalised tonic clonic</option>
                <option value="absence">Absence</option>
                <option value="myoclonic">Myoclonic</option>
              </select>
              <input className="rounded-xl border border-slate-800 bg-slate-950 px-3 py-2" value={doseAdvisorForm.patientAgeYears} onChange={(e) => setDoseAdvisorForm((s) => ({ ...s, patientAgeYears: e.target.value }))} placeholder="Age in years" />
              <input className="rounded-xl border border-slate-800 bg-slate-950 px-3 py-2" value={doseAdvisorForm.patientWeightKg} onChange={(e) => setDoseAdvisorForm((s) => ({ ...s, patientWeightKg: e.target.value }))} placeholder="Weight kg" />
              <select className="rounded-xl border border-slate-800 bg-slate-950 px-3 py-2" value={doseAdvisorForm.sex} onChange={(e) => setDoseAdvisorForm((s) => ({ ...s, sex: e.target.value }))}>
                <option value="female">Female</option>
                <option value="male">Male</option>
              </select>
              <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={doseAdvisorForm.isWra} onChange={(e) => setDoseAdvisorForm((s) => ({ ...s, isWra: e.target.checked }))} /> Woman of reproductive age</label>
              <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={doseAdvisorForm.concurrentArv} onChange={(e) => setDoseAdvisorForm((s) => ({ ...s, concurrentArv: e.target.checked }))} /> Concurrent ARVs</label>
              <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={doseAdvisorForm.concurrentTbTreatment} onChange={(e) => setDoseAdvisorForm((s) => ({ ...s, concurrentTbTreatment: e.target.checked }))} /> TB treatment</label>
              <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={doseAdvisorForm.lowResourceSetting} onChange={(e) => setDoseAdvisorForm((s) => ({ ...s, lowResourceSetting: e.target.checked }))} /> Low-resource setting</label>
              <textarea className="rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 md:col-span-2" rows={2} value={doseAdvisorForm.comorbidities} onChange={(e) => setDoseAdvisorForm((s) => ({ ...s, comorbidities: e.target.value }))} placeholder="Comorbidities, comma separated" />
            </div>
            <button type="button" onClick={runDoseAdvisor} className="mt-4 rounded-xl bg-emerald-500 px-4 py-2 font-semibold text-slate-950">
              Run dose advisor
            </button>
            {aedDoseResult && (
              <div className="mt-4 space-y-3 rounded-2xl border border-slate-800 bg-slate-950 p-4">
                <div className="flex items-center gap-2 text-lg font-semibold text-white">
                  <Pill className="h-5 w-5 text-cyan-300" />
                  {aedDoseResult.recommended_aed}
                </div>
                <pre className="whitespace-pre-wrap text-sm text-slate-300">{JSON.stringify(aedDoseResult.dose_recommendation, null, 2)}</pre>
                {Array.isArray(aedDoseResult.warnings) && aedDoseResult.warnings.map((warning: string) => (
                  <div key={warning} className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-3 text-sm text-amber-100">
                    {warning}
                  </div>
                ))}
                {Array.isArray(aedDoseResult.interaction_alerts) && aedDoseResult.interaction_alerts.map((alert: any, index: number) => (
                  <div key={`${alert.interaction}-${index}`} className={`rounded-xl border p-3 text-sm ${badgeTone(alert.severity)}`}>
                    <div className="font-semibold">{alert.severity}</div>
                    <div>{alert.interaction}</div>
                    <div className="mt-1 text-slate-200/90">{alert.management}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === 'seizures' && (
        <div className="grid gap-6 lg:grid-cols-2">
          <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-5">
            <h3 className="mb-4 text-lg font-semibold text-white">Seizure Diary</h3>
            <div className="grid gap-3 md:grid-cols-2">
              <input className="rounded-xl border border-slate-800 bg-slate-950 px-3 py-2" type="date" value={seizureForm.seizureDate} onChange={(e) => setSeizureForm((s) => ({ ...s, seizureDate: e.target.value }))} />
              <select className="rounded-xl border border-slate-800 bg-slate-950 px-3 py-2" value={seizureForm.seizureType} onChange={(e) => setSeizureForm((s) => ({ ...s, seizureType: e.target.value }))}>
                <option value="generalised_tonic_clonic">Generalised tonic clonic</option>
                <option value="focal_aware">Focal aware</option>
                <option value="focal_impaired">Focal impaired</option>
                <option value="absence">Absence</option>
              </select>
              <input className="rounded-xl border border-slate-800 bg-slate-950 px-3 py-2" value={seizureForm.durationMinutes} onChange={(e) => setSeizureForm((s) => ({ ...s, durationMinutes: e.target.value }))} placeholder="Duration minutes" />
              <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={seizureForm.statusEpilepticus} onChange={(e) => setSeizureForm((s) => ({ ...s, statusEpilepticus: e.target.checked }))} /> Status epilepticus</label>
              <input className="rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 md:col-span-2" value={seizureForm.triggers} onChange={(e) => setSeizureForm((s) => ({ ...s, triggers: e.target.value }))} placeholder="Triggers" />
              <textarea className="rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 md:col-span-2" rows={2} value={seizureForm.postictalState} onChange={(e) => setSeizureForm((s) => ({ ...s, postictalState: e.target.value }))} placeholder="Postictal state" />
            </div>
            <button type="button" onClick={submitSeizure} className="mt-4 rounded-xl bg-cyan-500 px-4 py-2 font-semibold text-slate-950">
              Record seizure
            </button>

            <div className="mt-6 space-y-3">
              {seizureHistory.map((item, index) => (
                <div key={item.id ?? index} className="rounded-2xl border border-slate-800 bg-slate-950 p-4 text-sm text-slate-300">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold text-white">{item.seizureType ?? item.type ?? 'Seizure'}</span>
                    {Boolean(item.statusEpilepticus ?? item.status_epilepticus) && (
                      <span className="rounded-full border border-red-500/40 bg-red-500/15 px-3 py-1 text-red-100">Status epilepticus</span>
                    )}
                  </div>
                  <div className="mt-2">Date: {item.seizureDate ?? item.recordedAt ?? item.createdAt ?? 'Unknown'}</div>
                  <div>Duration: {item.durationSeconds ? `${Math.round(Number(item.durationSeconds) / 60)} min` : (item.duration ?? 'Not recorded')}</div>
                  <div>Triggers: {Array.isArray(item.triggers) ? item.triggers.join(', ') || 'None recorded' : (item.triggers ?? 'None recorded')}</div>
                  <div>Postictal: {item.postictalState ?? 'None recorded'}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-5">
            <h3 className="mb-4 text-lg font-semibold text-white">Status Epilepticus Protocol</h3>
            <div className="grid gap-3 md:grid-cols-2">
              <input className="rounded-xl border border-slate-800 bg-slate-950 px-3 py-2" value={statusForm.durationMinutes} onChange={(e) => setStatusForm((s) => ({ ...s, durationMinutes: e.target.value }))} placeholder="Duration minutes" />
              <input className="rounded-xl border border-slate-800 bg-slate-950 px-3 py-2" value={statusForm.patientAgeYears} onChange={(e) => setStatusForm((s) => ({ ...s, patientAgeYears: e.target.value }))} placeholder="Age in years" />
              <input className="rounded-xl border border-slate-800 bg-slate-950 px-3 py-2" value={statusForm.patientWeightKg} onChange={(e) => setStatusForm((s) => ({ ...s, patientWeightKg: e.target.value }))} placeholder="Weight kg" />
              <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={statusForm.ivAccess} onChange={(e) => setStatusForm((s) => ({ ...s, ivAccess: e.target.checked }))} /> IV access available</label>
              <textarea className="rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 md:col-span-2" rows={2} value={statusForm.drugsAvailable} onChange={(e) => setStatusForm((s) => ({ ...s, drugsAvailable: e.target.value }))} placeholder="Available drugs, comma separated" />
            </div>
            <button type="button" onClick={runStatusProtocol} className="mt-4 rounded-xl bg-red-500 px-4 py-2 font-semibold text-white">
              Run protocol
            </button>

            {statusResult?.current_recommendation && (
              <div className="mt-4 rounded-2xl border border-red-500/40 bg-red-500/10 p-4">
                <div className="flex items-center gap-2 text-lg font-semibold text-white">
                  <AlertTriangle className="h-5 w-5 text-red-300" />
                  Phase {statusResult.current_recommendation.phase}
                </div>
                <p className="mt-2 text-sm text-red-100">{statusResult.current_recommendation.immediate_action}</p>
                <p className="mt-2 text-sm text-red-50">Drug: {statusResult.current_recommendation.drug || 'Supportive care'}</p>
                <p className="text-sm text-red-50">Dose: {statusResult.current_recommendation.dose || 'See protocol'}</p>
                {statusResult.current_recommendation.alternative && (
                  <p className="text-sm text-red-100">Alternative: {statusResult.current_recommendation.alternative}</p>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === 'aed' && (
        <div className="grid gap-6 lg:grid-cols-2">
          <div className="space-y-4 rounded-2xl border border-slate-800 bg-slate-900/80 p-5">
            <h3 className="text-lg font-semibold text-white">AED Therapy</h3>
            <div className="grid gap-3 md:grid-cols-2">
              <select className="rounded-xl border border-slate-800 bg-slate-950 px-3 py-2" value={aedForm.drugName} onChange={(e) => setAedForm((s) => ({ ...s, drugName: e.target.value }))}>
                {knownAeds.map((drug) => <option key={drug} value={drug}>{drug}</option>)}
              </select>
              <input className="rounded-xl border border-slate-800 bg-slate-950 px-3 py-2" value={aedForm.doseMg} onChange={(e) => setAedForm((s) => ({ ...s, doseMg: e.target.value }))} placeholder="Dose mg" />
              <input className="rounded-xl border border-slate-800 bg-slate-950 px-3 py-2" value={aedForm.frequency} onChange={(e) => setAedForm((s) => ({ ...s, frequency: e.target.value }))} placeholder="Frequency" />
              <input className="rounded-xl border border-slate-800 bg-slate-950 px-3 py-2" value={aedForm.route} onChange={(e) => setAedForm((s) => ({ ...s, route: e.target.value }))} placeholder="Route" />
              <input className="rounded-xl border border-slate-800 bg-slate-950 px-3 py-2" type="date" value={aedForm.startDate} onChange={(e) => setAedForm((s) => ({ ...s, startDate: e.target.value }))} />
              <input className="rounded-xl border border-slate-800 bg-slate-950 px-3 py-2" value={aedForm.indication} onChange={(e) => setAedForm((s) => ({ ...s, indication: e.target.value }))} placeholder="Indication" />
              <input className="rounded-xl border border-slate-800 bg-slate-950 px-3 py-2" value={aedForm.drugLevelResult} onChange={(e) => setAedForm((s) => ({ ...s, drugLevelResult: e.target.value }))} placeholder="Drug level result" />
              <input className="rounded-xl border border-slate-800 bg-slate-950 px-3 py-2" value={aedForm.drugLevelUnit} onChange={(e) => setAedForm((s) => ({ ...s, drugLevelUnit: e.target.value }))} placeholder="Drug level unit" />
              <input className="rounded-xl border border-slate-800 bg-slate-950 px-3 py-2" type="date" value={aedForm.drugLevelDate} onChange={(e) => setAedForm((s) => ({ ...s, drugLevelDate: e.target.value }))} />
              <input className="rounded-xl border border-slate-800 bg-slate-950 px-3 py-2" value={aedForm.drugLevelInterpretation} onChange={(e) => setAedForm((s) => ({ ...s, drugLevelInterpretation: e.target.value }))} placeholder="Drug level interpretation" />
              <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={aedForm.isWra} onChange={(e) => setAedForm((s) => ({ ...s, isWra: e.target.checked }))} /> Woman of reproductive age</label>
              <textarea className="rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 md:col-span-2" rows={2} value={aedForm.concurrentDrugs} onChange={(e) => setAedForm((s) => ({ ...s, concurrentDrugs: e.target.value }))} placeholder="Concurrent drugs, comma separated" />
              <textarea className="rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 md:col-span-2" rows={2} value={aedForm.notes} onChange={(e) => setAedForm((s) => ({ ...s, notes: e.target.value }))} placeholder="Therapy notes" />
            </div>
            <button type="button" onClick={submitAed} className="rounded-xl bg-cyan-500 px-4 py-2 font-semibold text-slate-950">
              Save AED therapy
            </button>
            {interactionResult && (
              <div className="rounded-2xl border border-slate-800 bg-slate-950 p-4">
                <h4 className="mb-2 font-semibold text-white">Interaction alerts</h4>
                {(interactionResult.alerts || []).length === 0 ? (
                  <p className="text-sm text-slate-400">No interaction alerts returned.</p>
                ) : (
                  <div className="space-y-2">
                    {(interactionResult.alerts || []).map((alert: any, index: number) => (
                      <div key={`${alert.interacting_drug}-${index}`} className={`rounded-xl border p-3 text-sm ${badgeTone(alert.severity)}`}>
                        <div className="font-semibold">{alert.severity}</div>
                        <div>{alert.interacting_drug}: {alert.clinical_effect}</div>
                        <div className="mt-1">{alert.management}</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="space-y-4 rounded-2xl border border-slate-800 bg-slate-900/80 p-5">
            <h3 className="text-lg font-semibold text-white">Active AEDs</h3>
            <div className="space-y-3">
              {activeAed.map((record) => {
                const range = aedLevelRanges[(record.drugName || '').toLowerCase()];
                const level = record.drugLevelResult ? Number(record.drugLevelResult) : null;
                const inRange = range && level !== null ? level >= range.min && level <= range.max : null;
                return (
                  <div key={record.id} className="rounded-2xl border border-slate-800 bg-slate-950 p-4 text-sm text-slate-300">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <div className="font-semibold text-white">{record.drugName}</div>
                        <div>{record.doseMg} mg, {record.frequency}</div>
                      </div>
                      <button type="button" onClick={() => void stopAed(record.id)} className="rounded-lg border border-red-500/40 px-3 py-1 text-red-200">
                        Stop
                      </button>
                    </div>
                    <div className="mt-2">Started: {record.startDate}</div>
                    <div>Drug level: {level ?? 'Not recorded'} {record.drugLevelUnit || ''}</div>
                    {range && level !== null && (
                      <div className={`mt-2 inline-flex rounded-full border px-3 py-1 ${inRange ? 'border-green-500/40 bg-green-500/15 text-green-100' : 'border-amber-500/40 bg-amber-500/15 text-amber-100'}`}>
                        Therapeutic range {range.min}-{range.max} {range.unit}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            <div className="rounded-2xl border border-slate-800 bg-slate-950 p-4">
              <h4 className="mb-3 font-semibold text-white">Drug interaction checker</h4>
              <div className="grid gap-3">
                <select className="rounded-xl border border-slate-800 bg-slate-900 px-3 py-2" value={interactionForm.aedName} onChange={(e) => setInteractionForm((s) => ({ ...s, aedName: e.target.value }))}>
                  {knownAeds.map((drug) => <option key={drug} value={drug}>{drug}</option>)}
                </select>
                <textarea className="rounded-xl border border-slate-800 bg-slate-900 px-3 py-2" rows={2} value={interactionForm.concurrentDrugs} onChange={(e) => setInteractionForm((s) => ({ ...s, concurrentDrugs: e.target.value }))} placeholder="Concurrent drugs, comma separated" />
                <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={interactionForm.isWra} onChange={(e) => setInteractionForm((s) => ({ ...s, isWra: e.target.checked }))} /> Woman of reproductive age</label>
                <button type="button" onClick={runInteractionChecker} className="rounded-xl bg-amber-500 px-4 py-2 font-semibold text-slate-950">
                  Check interactions
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'toxicity' && (
        <div className="grid gap-6 lg:grid-cols-2">
          <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-5">
            <h3 className="mb-4 text-lg font-semibold text-white">Record Toxicity Event</h3>
            <div className="grid gap-3 md:grid-cols-2">
              <input className="rounded-xl border border-slate-800 bg-slate-950 px-3 py-2" type="date" value={toxicityForm.eventDate} onChange={(e) => setToxicityForm((s) => ({ ...s, eventDate: e.target.value }))} />
              <select className="rounded-xl border border-slate-800 bg-slate-950 px-3 py-2" value={toxicityForm.drugName} onChange={(e) => setToxicityForm((s) => ({ ...s, drugName: e.target.value }))}>
                {knownAeds.map((drug) => <option key={drug} value={drug}>{drug}</option>)}
              </select>
              <select className="rounded-xl border border-slate-800 bg-slate-950 px-3 py-2" value={toxicityForm.toxicityType} onChange={(e) => setToxicityForm((s) => ({ ...s, toxicityType: e.target.value }))}>
                {toxicityTypes.map((item) => <option key={item} value={item}>{item}</option>)}
              </select>
              <select className="rounded-xl border border-slate-800 bg-slate-950 px-3 py-2" value={toxicityForm.severity} onChange={(e) => setToxicityForm((s) => ({ ...s, severity: e.target.value }))}>
                <option value="mild">Mild</option>
                <option value="moderate">Moderate</option>
                <option value="severe">Severe</option>
                <option value="critical">Critical</option>
              </select>
              <input className="rounded-xl border border-slate-800 bg-slate-950 px-3 py-2" value={toxicityForm.organSystem} onChange={(e) => setToxicityForm((s) => ({ ...s, organSystem: e.target.value }))} placeholder="Organ system" />
              <input className="rounded-xl border border-slate-800 bg-slate-950 px-3 py-2" value={toxicityForm.outcome} onChange={(e) => setToxicityForm((s) => ({ ...s, outcome: e.target.value }))} placeholder="Outcome" />
              <textarea className="rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 md:col-span-2" rows={2} value={toxicityForm.clinicalFindings} onChange={(e) => setToxicityForm((s) => ({ ...s, clinicalFindings: e.target.value }))} placeholder="Clinical findings" />
              <textarea className="rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 md:col-span-2" rows={3} value={toxicityForm.labMarkers} onChange={(e) => setToxicityForm((s) => ({ ...s, labMarkers: e.target.value }))} placeholder="Lab markers JSON" />
              <textarea className="rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 md:col-span-2" rows={2} value={toxicityForm.actionTaken} onChange={(e) => setToxicityForm((s) => ({ ...s, actionTaken: e.target.value }))} placeholder="Action taken" />
            </div>
            <button type="button" onClick={submitToxicity} className="mt-4 rounded-xl bg-red-500 px-4 py-2 font-semibold text-white">
              Record toxicity
            </button>
          </div>

          <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-5">
            <h3 className="mb-4 text-lg font-semibold text-white">Toxicity History</h3>
            <div className="space-y-3">
              {toxicityEvents.map((event, index) => (
                <div key={event.id ?? index} className="rounded-2xl border border-slate-800 bg-slate-950 p-4 text-sm text-slate-300">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold text-white">{event.drugName}</span>
                    <span className={`rounded-full border px-3 py-1 ${badgeTone(event.severity)}`}>{event.severity}</span>
                  </div>
                  <div className="mt-2">Date: {event.eventDate}</div>
                  <div>Type: {event.toxicityType}</div>
                  <div>Outcome: {event.outcome || 'Pending'}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
