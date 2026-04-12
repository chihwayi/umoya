import React, { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { AlertTriangle, CheckCircle2, ClipboardList, Droplets, HeartPulse, ShieldPlus, Syringe } from 'lucide-react';
import { scdApi } from '../services/api';
import { useNotification } from './GlobalNotification';

type TabKey = 'register' | 'crisis' | 'treatment' | 'screening';

const riskBadgeStyles: Record<string, string> = {
  low: 'border-green-500/30 bg-green-500/10 text-green-300',
  moderate: 'border-amber-500/30 bg-amber-500/10 text-amber-300',
  high: 'border-red-500/30 bg-red-500/10 text-red-300',
  very_high: 'border-red-600/40 bg-red-500/15 text-red-200',
};

const crisisCardStyles: Record<string, string> = {
  mild: 'border-green-500/30 bg-green-500/10 text-green-100',
  moderate: 'border-yellow-500/30 bg-yellow-500/10 text-yellow-100',
  severe: 'border-orange-500/30 bg-orange-500/10 text-orange-100',
  life_threatening: 'border-red-500/40 bg-red-500/15 text-red-100',
};

const doseCardStyles: Record<string, string> = {
  hold: 'border-red-500/40 bg-red-500/15 text-red-100',
  start: 'border-blue-500/40 bg-blue-500/15 text-blue-100',
  continue: 'border-green-500/40 bg-green-500/15 text-green-100',
  escalate: 'border-amber-500/40 bg-amber-500/15 text-amber-100',
};

const mandatoryScreenings = ['tcd', 'renal'];

function classifyTcd(value: string): string | null {
  if (!value) return null;
  const numeric = Number(value);
  if (Number.isNaN(numeric)) return null;
  if (numeric >= 200) return 'abnormal';
  if (numeric >= 170) return 'conditional';
  return 'normal';
}

export default function ScdDashboard({
  patientId,
  patientWeightKg,
}: {
  patientId: string;
  patientWeightKg?: number;
}) {
  const { tenantSlug } = useParams<{ tenantSlug: string }>();
  const token = localStorage.getItem('ehr_token') || '';
  const { showError, showSuccess } = useNotification();

  const [tab, setTab] = useState<TabKey>('register');
  const [registerEntry, setRegisterEntry] = useState<any | null>(null);
  const [crisisHistory, setCrisisHistory] = useState<any[]>([]);
  const [treatmentHistory, setTreatmentHistory] = useState<any[]>([]);
  const [screeningHistory, setScreeningHistory] = useState<any[]>([]);
  const [riskResult, setRiskResult] = useState<any | null>(null);
  const [crisisResult, setCrisisResult] = useState<any | null>(null);
  const [doseResult, setDoseResult] = useState<any | null>(null);

  const [registerForm, setRegisterForm] = useState({
    genotype: 'HbSS',
    diagnosisMethod: 'electrophoresis',
    diagnosisDate: '',
    isConfirmed: true,
    linkedBirthId: '',
    baselineHbGDl: '',
    bloodGroup: '',
    hasStrokeHistory: false,
    hasAcsHistory: false,
    hasPriapismHistory: false,
    hasRenalDisease: false,
    hasAvascularNecrosis: false,
    onHydroxyurea: false,
    onPenicillinProphylaxis: false,
    onFolicAcid: false,
    onMalariaProphylaxis: false,
    transcranialDopplerVelocity: '',
    tcdDate: '',
    spleenStatus: 'normal',
    status: 'active',
    nextReviewDate: '',
    notes: '',
  });
  const [crisisForm, setCrisisForm] = useState({
    crisisType: 'voc',
    eventDate: new Date().toISOString().slice(0, 10),
    painScore: '5',
    sbpAtEvent: '',
    dbpAtEvent: '',
    spo2AtEvent: '',
    hbAtEvent: '',
    wbcAtEvent: '',
    triggerIdentified: '',
    fever: false,
    newChestSymptoms: false,
    newNeuroSymptoms: false,
    management: '',
    analgesiaGiven: '',
    transfusionGiven: false,
    transfusionUnits: '',
    hospitalised: false,
    hospitalDays: '',
    outcome: 'resolved',
    notes: '',
  });
  const [treatmentForm, setTreatmentForm] = useState({
    recordedAt: new Date().toISOString().slice(0, 10),
    treatmentType: 'hydroxyurea',
    drugName: 'Hydroxyurea',
    patientWeightKg: patientWeightKg?.toString() || '',
    doseMg: '',
    doseMgPerKg: '',
    frequency: 'daily',
    indication: 'standard',
    hbGDl: '',
    mcvFl: '',
    wbcX10_9: '',
    ancX10_9: '',
    plateletsX10_9: '',
    reticulocytesX10_9: '',
    hbfPct: '',
    weeksOnCurrentDose: '',
    nextReviewDate: '',
    notes: '',
  });
  const [screeningForm, setScreeningForm] = useState({
    screenedAt: new Date().toISOString().slice(0, 10),
    screeningType: 'tcd',
    resultNormal: true,
    resultDetail: '',
    tcdVelocityCmS: '',
    egfrMlMin: '',
    urineAlbuminCreatinine: '',
    referred: false,
    referralReason: '',
    nextScreeningDate: '',
    notes: '',
  });

  const loadData = async () => {
    if (!tenantSlug || !token) return;
    try {
      const [registerRow, crisisRows, treatmentRows, screeningRows] = await Promise.all([
        scdApi.getRegister(patientId, token, tenantSlug).catch(() => null),
        scdApi.getCrisisHistory(patientId, token, tenantSlug),
        scdApi.getTreatmentHistory(patientId, token, tenantSlug),
        scdApi.getScreeningHistory(patientId, token, tenantSlug),
      ]);
      setRegisterEntry(registerRow ?? null);
      setCrisisHistory(Array.isArray(crisisRows) ? crisisRows : []);
      setTreatmentHistory(Array.isArray(treatmentRows) ? treatmentRows : []);
      setScreeningHistory(Array.isArray(screeningRows) ? screeningRows : []);
    } catch (error: any) {
      showError('SCD', error?.response?.data?.message || 'Failed to load SCD records.');
    }
  };

  useEffect(() => {
    void loadData();
  }, [patientId, tenantSlug]);

  useEffect(() => {
    if (!registerEntry) return;
    setRegisterForm({
      genotype: registerEntry.genotype ?? 'HbSS',
      diagnosisMethod: registerEntry.diagnosisMethod ?? 'electrophoresis',
      diagnosisDate: registerEntry.diagnosisDate ?? '',
      isConfirmed: Boolean(registerEntry.isConfirmed),
      linkedBirthId: registerEntry.linkedBirthId ?? '',
      baselineHbGDl: registerEntry.baselineHbGDl?.toString?.() ?? '',
      bloodGroup: registerEntry.bloodGroup ?? '',
      hasStrokeHistory: Boolean(registerEntry.hasStrokeHistory),
      hasAcsHistory: Boolean(registerEntry.hasAcsHistory),
      hasPriapismHistory: Boolean(registerEntry.hasPriapismHistory),
      hasRenalDisease: Boolean(registerEntry.hasRenalDisease),
      hasAvascularNecrosis: Boolean(registerEntry.hasAvascularNecrosis),
      onHydroxyurea: Boolean(registerEntry.onHydroxyurea),
      onPenicillinProphylaxis: Boolean(registerEntry.onPenicillinProphylaxis),
      onFolicAcid: Boolean(registerEntry.onFolicAcid),
      onMalariaProphylaxis: Boolean(registerEntry.onMalariaProphylaxis),
      transcranialDopplerVelocity: registerEntry.transcranialDopplerVelocity?.toString?.() ?? '',
      tcdDate: registerEntry.tcdDate ?? '',
      spleenStatus: registerEntry.spleenStatus ?? 'normal',
      status: registerEntry.status ?? 'active',
      nextReviewDate: registerEntry.nextReviewDate ?? '',
      notes: registerEntry.notes ?? '',
    });
    void loadRisk(registerRowPayload(registerEntry));
  }, [registerEntry]);

  const loadRisk = async (payload?: any) => {
    if (!tenantSlug || !token) return;
    try {
      const risk = await scdApi.getComplicationRisk(
        patientId,
        payload ?? registerRowPayload(registerEntry),
        token,
        tenantSlug,
      );
      setRiskResult(risk);
    } catch (error: any) {
      showError('SCD Risk', error?.response?.data?.message || 'Failed to calculate complication risk.');
    }
  };

  const registerRowPayload = (entry: any) => ({
    genotype: entry?.genotype ?? registerForm.genotype,
    ageYears: 0,
    tcdVelocityCmS: entry?.transcranialDopplerVelocity ?? (registerForm.transcranialDopplerVelocity ? Number(registerForm.transcranialDopplerVelocity) : null),
    hasStrokeHistory: entry?.hasStrokeHistory ?? registerForm.hasStrokeHistory,
    hbGDl: entry?.baselineHbGDl ?? (registerForm.baselineHbGDl ? Number(registerForm.baselineHbGDl) : null),
    onHydroxyurea: entry?.onHydroxyurea ?? registerForm.onHydroxyurea,
    hasRenalDisease: entry?.hasRenalDisease ?? registerForm.hasRenalDisease,
  });

  const submitRegister = async () => {
    if (!tenantSlug || !token) return;
    try {
      const payload = {
        genotype: registerForm.genotype,
        diagnosisMethod: registerForm.diagnosisMethod || null,
        diagnosisDate: registerForm.diagnosisDate || null,
        isConfirmed: registerForm.isConfirmed,
        linkedBirthId: registerForm.linkedBirthId || null,
        baselineHbGDl: registerForm.baselineHbGDl ? Number(registerForm.baselineHbGDl) : null,
        bloodGroup: registerForm.bloodGroup || null,
        hasStrokeHistory: registerForm.hasStrokeHistory,
        hasAcsHistory: registerForm.hasAcsHistory,
        hasPriapismHistory: registerForm.hasPriapismHistory,
        hasRenalDisease: registerForm.hasRenalDisease,
        hasAvascularNecrosis: registerForm.hasAvascularNecrosis,
        onHydroxyurea: registerForm.onHydroxyurea,
        onPenicillinProphylaxis: registerForm.onPenicillinProphylaxis,
        onFolicAcid: registerForm.onFolicAcid,
        onMalariaProphylaxis: registerForm.onMalariaProphylaxis,
        transcranialDopplerVelocity: registerForm.transcranialDopplerVelocity ? Number(registerForm.transcranialDopplerVelocity) : null,
        tcdDate: registerForm.tcdDate || null,
        spleenStatus: registerForm.spleenStatus || null,
        status: registerForm.status,
        nextReviewDate: registerForm.nextReviewDate || null,
        notes: registerForm.notes || null,
      };
      if (registerEntry?.id) {
        await scdApi.updateRegister(registerEntry.id, payload, token, tenantSlug);
        showSuccess('SCD Register', 'SCD register entry updated.');
      } else {
        await scdApi.enroll(patientId, payload, token, tenantSlug);
        showSuccess('SCD Register', 'Patient enrolled in the SCD register.');
      }
      await loadData();
    } catch (error: any) {
      showError('SCD Register', error?.response?.data?.message || 'Failed to save SCD register entry.');
    }
  };

  const submitCrisis = async () => {
    if (!tenantSlug || !token) return;
    try {
      const response = await scdApi.recordCrisis(patientId, {
        eventDate: crisisForm.eventDate,
        crisisType: crisisForm.crisisType,
        painScore: crisisForm.painScore ? Number(crisisForm.painScore) : null,
        sbpAtEvent: crisisForm.sbpAtEvent ? Number(crisisForm.sbpAtEvent) : null,
        dbpAtEvent: crisisForm.dbpAtEvent ? Number(crisisForm.dbpAtEvent) : null,
        spo2AtEvent: crisisForm.spo2AtEvent ? Number(crisisForm.spo2AtEvent) : null,
        hbAtEvent: crisisForm.hbAtEvent ? Number(crisisForm.hbAtEvent) : null,
        wbcAtEvent: crisisForm.wbcAtEvent ? Number(crisisForm.wbcAtEvent) : null,
        triggerIdentified: crisisForm.triggerIdentified || null,
        fever: crisisForm.fever,
        newChestSymptoms: crisisForm.newChestSymptoms,
        newNeuroSymptoms: crisisForm.newNeuroSymptoms,
        management: crisisForm.management || null,
        analgesiaGiven: crisisForm.analgesiaGiven || null,
        transfusionGiven: crisisForm.transfusionGiven,
        transfusionUnits: crisisForm.transfusionUnits ? Number(crisisForm.transfusionUnits) : null,
        hospitalised: crisisForm.hospitalised,
        hospitalDays: crisisForm.hospitalDays ? Number(crisisForm.hospitalDays) : null,
        outcome: crisisForm.outcome || null,
        notes: crisisForm.notes || null,
      }, token, tenantSlug);
      setCrisisResult(response?.triageGuidance ?? null);
      showSuccess('SCD Crisis', 'Crisis event recorded with triage guidance.');
      await loadData();
    } catch (error: any) {
      showError('SCD Crisis', error?.response?.data?.message || 'Failed to save crisis event.');
    }
  };

  const submitTreatment = async () => {
    if (!tenantSlug || !token) return;
    try {
      const response = await scdApi.recordTreatment(patientId, {
        recordedAt: treatmentForm.recordedAt,
        treatmentType: treatmentForm.treatmentType,
        drugName: treatmentForm.drugName || null,
        patientWeightKg: treatmentForm.patientWeightKg ? Number(treatmentForm.patientWeightKg) : null,
        doseMg: treatmentForm.doseMg ? Number(treatmentForm.doseMg) : null,
        doseMgPerKg: treatmentForm.doseMgPerKg ? Number(treatmentForm.doseMgPerKg) : null,
        frequency: treatmentForm.frequency || null,
        indication: treatmentForm.indication || null,
        hbGDl: treatmentForm.hbGDl ? Number(treatmentForm.hbGDl) : null,
        mcvFl: treatmentForm.mcvFl ? Number(treatmentForm.mcvFl) : null,
        wbcX10_9: treatmentForm.wbcX10_9 ? Number(treatmentForm.wbcX10_9) : null,
        ancX10_9: treatmentForm.ancX10_9 ? Number(treatmentForm.ancX10_9) : null,
        plateletsX10_9: treatmentForm.plateletsX10_9 ? Number(treatmentForm.plateletsX10_9) : null,
        reticulocytesX10_9: treatmentForm.reticulocytesX10_9 ? Number(treatmentForm.reticulocytesX10_9) : null,
        hbfPct: treatmentForm.hbfPct ? Number(treatmentForm.hbfPct) : null,
        weeksOnCurrentDose: treatmentForm.weeksOnCurrentDose ? Number(treatmentForm.weeksOnCurrentDose) : null,
        nextReviewDate: treatmentForm.nextReviewDate || null,
        genotype: registerEntry?.genotype ?? registerForm.genotype,
        notes: treatmentForm.notes || null,
      }, token, tenantSlug);
      setDoseResult(response?.doseGuidance ?? null);
      showSuccess('SCD Treatment', 'Treatment record saved.');
      await loadData();
    } catch (error: any) {
      showError('SCD Treatment', error?.response?.data?.message || 'Failed to save treatment record.');
    }
  };

  const submitScreening = async () => {
    if (!tenantSlug || !token) return;
    try {
      await scdApi.recordScreening(patientId, {
        screenedAt: screeningForm.screenedAt,
        screeningType: screeningForm.screeningType,
        resultNormal: screeningForm.resultNormal,
        resultDetail: screeningForm.resultDetail || null,
        tcdVelocityCmS: screeningForm.tcdVelocityCmS ? Number(screeningForm.tcdVelocityCmS) : null,
        tcdClassification: classifyTcd(screeningForm.tcdVelocityCmS),
        egfrMlMin: screeningForm.egfrMlMin ? Number(screeningForm.egfrMlMin) : null,
        urineAlbuminCreatinine: screeningForm.urineAlbuminCreatinine ? Number(screeningForm.urineAlbuminCreatinine) : null,
        referred: screeningForm.referred,
        referralReason: screeningForm.referralReason || null,
        nextScreeningDate: screeningForm.nextScreeningDate || null,
        notes: screeningForm.notes || null,
      }, token, tenantSlug);
      showSuccess('SCD Screening', 'Complication screening saved.');
      await loadData();
    } catch (error: any) {
      showError('SCD Screening', error?.response?.data?.message || 'Failed to save screening record.');
    }
  };

  const screeningTracker = useMemo(() => {
    return mandatoryScreenings.map((type) => {
      const rows = screeningHistory.filter((item) => item.screeningType === type);
      const latest = rows[0];
      return {
        type,
        lastDone: latest?.screenedAt ?? 'Not done',
        nextDue: latest?.nextScreeningDate ?? 'Due now',
      };
    });
  }, [screeningHistory]);

  return (
    <div className="space-y-5 rounded-3xl border border-slate-800 bg-slate-950 p-5 text-slate-100 shadow-2xl">
      <div className="flex flex-wrap gap-2">
        {[
          { key: 'register', label: 'SCD Register', icon: ClipboardList },
          { key: 'crisis', label: 'Crisis Events', icon: AlertTriangle },
          { key: 'treatment', label: 'Hydroxyurea & Meds', icon: Syringe },
          { key: 'screening', label: 'Complication Screening', icon: ShieldPlus },
        ].map((item) => (
          <button
            key={item.key}
            type="button"
            onClick={() => setTab(item.key as TabKey)}
            className={`inline-flex items-center gap-2 rounded-xl border px-4 py-2 text-sm font-semibold ${
              tab === item.key
                ? 'border-cyan-500 bg-cyan-500/15 text-cyan-200'
                : 'border-slate-800 bg-slate-900/80 text-slate-300 hover:border-slate-700'
            }`}
          >
            <item.icon className="h-4 w-4" />
            {item.label}
          </button>
        ))}
      </div>

      {tab === 'register' && (
        <div className="grid gap-5 xl:grid-cols-[1.1fr_0.9fr]">
          <div className="space-y-4 rounded-2xl border border-slate-800 bg-slate-900/80 p-5">
            <div className="flex items-center gap-2">
              <Droplets className="h-4 w-4 text-cyan-300" />
              <h3 className="text-lg font-semibold">SCD Register</h3>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <select value={registerForm.genotype} onChange={(e) => setRegisterForm((c) => ({ ...c, genotype: e.target.value }))} className="rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm">
                {['HbSS', 'HbSC', 'HbS_beta_thal', 'HbAS', 'HbAC', 'other'].map((value) => <option key={value} value={value}>{value}</option>)}
              </select>
              <select value={registerForm.diagnosisMethod} onChange={(e) => setRegisterForm((c) => ({ ...c, diagnosisMethod: e.target.value }))} className="rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm">
                {['newborn_screening', 'electrophoresis', 'hplc', 'sickling_test', 'clinical'].map((value) => <option key={value} value={value}>{value.replace(/_/g, ' ')}</option>)}
              </select>
              <input type="date" value={registerForm.diagnosisDate} onChange={(e) => setRegisterForm((c) => ({ ...c, diagnosisDate: e.target.value }))} className="rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm" />
              <input value={registerForm.bloodGroup} onChange={(e) => setRegisterForm((c) => ({ ...c, bloodGroup: e.target.value }))} placeholder="Blood group" className="rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm" />
              <input value={registerForm.baselineHbGDl} onChange={(e) => setRegisterForm((c) => ({ ...c, baselineHbGDl: e.target.value }))} type="number" step="0.1" placeholder="Baseline Hb (g/dL)" className="rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm" />
              <input value={registerForm.linkedBirthId} onChange={(e) => setRegisterForm((c) => ({ ...c, linkedBirthId: e.target.value }))} placeholder="Linked birth ID (optional)" className="rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm" />
              <input value={registerForm.transcranialDopplerVelocity} onChange={(e) => setRegisterForm((c) => ({ ...c, transcranialDopplerVelocity: e.target.value }))} type="number" step="0.1" placeholder="Latest TCD velocity (cm/s)" className="rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm" />
              <input type="date" value={registerForm.tcdDate} onChange={(e) => setRegisterForm((c) => ({ ...c, tcdDate: e.target.value }))} className="rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm" />
              <select value={registerForm.spleenStatus} onChange={(e) => setRegisterForm((c) => ({ ...c, spleenStatus: e.target.value }))} className="rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm">
                {['normal', 'enlarged', 'auto_infarcted', 'removed'].map((value) => <option key={value} value={value}>{value.replace(/_/g, ' ')}</option>)}
              </select>
              <select value={registerForm.status} onChange={(e) => setRegisterForm((c) => ({ ...c, status: e.target.value }))} className="rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm">
                {['active', 'lost_to_follow_up', 'transferred', 'deceased'].map((value) => <option key={value} value={value}>{value.replace(/_/g, ' ')}</option>)}
              </select>
              <input type="date" value={registerForm.nextReviewDate} onChange={(e) => setRegisterForm((c) => ({ ...c, nextReviewDate: e.target.value }))} className="rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm md:col-span-2" />
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              {[
                ['isConfirmed', 'Confirmed diagnosis'],
                ['hasStrokeHistory', 'Prior stroke/TIA'],
                ['hasAcsHistory', 'History of ACS'],
                ['hasPriapismHistory', 'History of priapism'],
                ['hasRenalDisease', 'Known renal disease'],
                ['hasAvascularNecrosis', 'Avascular necrosis'],
                ['onHydroxyurea', 'On hydroxyurea'],
                ['onPenicillinProphylaxis', 'On penicillin prophylaxis'],
                ['onFolicAcid', 'On folic acid'],
                ['onMalariaProphylaxis', 'On malaria prophylaxis'],
              ].map(([key, label]) => (
                <label key={key} className="inline-flex items-center gap-2 rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 text-sm">
                  <input
                    type="checkbox"
                    checked={Boolean(registerForm[key as keyof typeof registerForm])}
                    onChange={(e) => setRegisterForm((c) => ({ ...c, [key]: e.target.checked }))}
                  />
                  {label}
                </label>
              ))}
            </div>
            <textarea value={registerForm.notes} onChange={(e) => setRegisterForm((c) => ({ ...c, notes: e.target.value }))} rows={3} placeholder="Notes" className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm" />
            <div className="flex gap-3">
              <button type="button" onClick={() => void submitRegister()} className="rounded-xl bg-cyan-600 px-4 py-2 text-sm font-semibold text-white hover:bg-cyan-500">
                {registerEntry ? 'Update Register' : 'Enroll Patient'}
              </button>
              <button type="button" onClick={() => void loadRisk()} className="rounded-xl border border-slate-700 bg-slate-950 px-4 py-2 text-sm font-semibold text-slate-200 hover:border-slate-600">
                Refresh Risk
              </button>
            </div>
          </div>

          <div className="space-y-4">
            <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-5">
              <div className="mb-3 flex items-center gap-2">
                <HeartPulse className="h-4 w-4 text-rose-300" />
                <h3 className="text-lg font-semibold">Complication Risk</h3>
              </div>
              {riskResult ? (
                <div className="space-y-3">
                  <div className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold ${riskBadgeStyles[riskResult.overall_risk] || riskBadgeStyles.low}`}>
                    Overall risk: {String(riskResult.overall_risk || 'low').replace(/_/g, ' ')}
                  </div>
                  {Array.isArray(riskResult.risk_flags) && riskResult.risk_flags.length > 0 ? riskResult.risk_flags.map((flag: any, idx: number) => (
                    <div key={`${flag.domain}-${idx}`} className="rounded-xl border border-slate-800 bg-slate-950 p-3">
                      <div className="flex items-center gap-2">
                        <span className={`rounded-full border px-2 py-0.5 text-[11px] font-semibold ${riskBadgeStyles[flag.risk_level] || riskBadgeStyles.low}`}>
                          {String(flag.risk_level).replace(/_/g, ' ')}
                        </span>
                        <span className="text-sm font-semibold capitalize">{flag.domain}</span>
                      </div>
                      <p className="mt-2 text-sm text-slate-200">{flag.finding}</p>
                      <p className="mt-1 text-xs text-slate-400">{flag.action}</p>
                    </div>
                  )) : <p className="text-sm text-slate-400">No complication flags detected.</p>}
                </div>
              ) : (
                <p className="text-sm text-slate-400">Save or load a register entry to view risk guidance.</p>
              )}
            </div>
            <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-5">
              <div className="mb-3 flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-emerald-300" />
                <h3 className="text-lg font-semibold">Vaccination Checklist</h3>
              </div>
              <ul className="space-y-2 text-sm text-slate-200">
                {(riskResult?.vaccinations_required || []).map((item: string) => (
                  <li key={item} className="rounded-xl border border-slate-800 bg-slate-950 px-3 py-2">{item}</li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}

      {tab === 'crisis' && (
        <div className="grid gap-5 xl:grid-cols-[1.05fr_0.95fr]">
          <div className="space-y-4 rounded-2xl border border-slate-800 bg-slate-900/80 p-5">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-300" />
              <h3 className="text-lg font-semibold">Record Crisis Event</h3>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <select value={crisisForm.crisisType} onChange={(e) => setCrisisForm((c) => ({ ...c, crisisType: e.target.value }))} className="rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm">
                {['voc', 'acs', 'splenic_sequestration', 'stroke', 'tia', 'priapism', 'aplastic_crisis', 'other'].map((value) => <option key={value} value={value}>{value.replace(/_/g, ' ')}</option>)}
              </select>
              <input type="date" value={crisisForm.eventDate} onChange={(e) => setCrisisForm((c) => ({ ...c, eventDate: e.target.value }))} className="rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm" />
              <input type="number" min="0" max="10" value={crisisForm.painScore} onChange={(e) => setCrisisForm((c) => ({ ...c, painScore: e.target.value }))} placeholder="Pain score (0-10)" className="rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm" />
              <input type="number" value={crisisForm.spo2AtEvent} onChange={(e) => setCrisisForm((c) => ({ ...c, spo2AtEvent: e.target.value }))} placeholder="SpO2 %" className="rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm" />
              <input type="number" value={crisisForm.sbpAtEvent} onChange={(e) => setCrisisForm((c) => ({ ...c, sbpAtEvent: e.target.value }))} placeholder="SBP" className="rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm" />
              <input type="number" value={crisisForm.dbpAtEvent} onChange={(e) => setCrisisForm((c) => ({ ...c, dbpAtEvent: e.target.value }))} placeholder="DBP" className="rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm" />
              <input type="number" step="0.1" value={crisisForm.hbAtEvent} onChange={(e) => setCrisisForm((c) => ({ ...c, hbAtEvent: e.target.value }))} placeholder="Hb at event (g/dL)" className="rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm" />
              <input type="number" step="0.1" value={crisisForm.wbcAtEvent} onChange={(e) => setCrisisForm((c) => ({ ...c, wbcAtEvent: e.target.value }))} placeholder="WBC x10^9/L" className="rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm" />
              <input value={crisisForm.triggerIdentified} onChange={(e) => setCrisisForm((c) => ({ ...c, triggerIdentified: e.target.value }))} placeholder="Trigger identified" className="rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm md:col-span-2" />
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              {[
                ['fever', 'Fever'],
                ['newChestSymptoms', 'New chest symptoms'],
                ['newNeuroSymptoms', 'New neuro symptoms'],
                ['transfusionGiven', 'Transfusion given'],
                ['hospitalised', 'Hospitalised'],
              ].map(([key, label]) => (
                <label key={key} className="inline-flex items-center gap-2 rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 text-sm">
                  <input type="checkbox" checked={Boolean(crisisForm[key as keyof typeof crisisForm])} onChange={(e) => setCrisisForm((c) => ({ ...c, [key]: e.target.checked }))} />
                  {label}
                </label>
              ))}
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <input value={crisisForm.transfusionUnits} onChange={(e) => setCrisisForm((c) => ({ ...c, transfusionUnits: e.target.value }))} type="number" placeholder="Transfusion units" className="rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm" />
              <input value={crisisForm.hospitalDays} onChange={(e) => setCrisisForm((c) => ({ ...c, hospitalDays: e.target.value }))} type="number" placeholder="Hospital days" className="rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm" />
              <input value={crisisForm.analgesiaGiven} onChange={(e) => setCrisisForm((c) => ({ ...c, analgesiaGiven: e.target.value }))} placeholder="Analgesia given" className="rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm md:col-span-2" />
              <textarea value={crisisForm.management} onChange={(e) => setCrisisForm((c) => ({ ...c, management: e.target.value }))} rows={3} placeholder="Management details" className="rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm md:col-span-2" />
            </div>
            <button type="button" onClick={() => void submitCrisis()} className="rounded-xl bg-amber-600 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-500">
              Save Crisis Event
            </button>
          </div>
          <div className="space-y-4">
            {crisisResult && (
              <div className={`rounded-2xl border p-5 ${crisisCardStyles[crisisResult.severity] || crisisCardStyles.mild}`}>
                <div className="flex items-center justify-between gap-3">
                  <h3 className="text-lg font-semibold capitalize">{String(crisisResult.severity).replace(/_/g, ' ')} triage</h3>
                  {crisisResult.escalate_now && <span className="rounded-full border border-red-400/40 bg-red-500/20 px-3 py-1 text-xs font-bold text-red-100">Escalate now</span>}
                </div>
                {crisisResult.immediate_action && <p className="mt-3 text-sm font-semibold">{crisisResult.immediate_action}</p>}
                {crisisResult.management && <p className="mt-3 text-sm">{crisisResult.management}</p>}
                {crisisResult.analgesia_ladder && <p className="mt-2 text-xs text-slate-200">Analgesia ladder: {crisisResult.analgesia_ladder}</p>}
                {crisisResult.escalate_if && <p className="mt-2 text-xs text-slate-300">Escalate if: {crisisResult.escalate_if}</p>}
              </div>
            )}
            <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-5">
              <h3 className="mb-3 text-lg font-semibold">Past Crisis Events</h3>
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead className="text-left text-slate-400">
                    <tr>
                      <th className="pb-2">Date</th>
                      <th className="pb-2">Type</th>
                      <th className="pb-2">Severity</th>
                      <th className="pb-2">Hospitalised</th>
                      <th className="pb-2">Outcome</th>
                    </tr>
                  </thead>
                  <tbody className="text-slate-200">
                    {crisisHistory.map((item) => (
                      <tr key={item.id} className="border-t border-slate-800">
                        <td className="py-2">{item.eventDate}</td>
                        <td className="py-2 capitalize">{String(item.crisisType || '').replace(/_/g, ' ')}</td>
                        <td className="py-2 capitalize">{String(item.severity || '').replace(/_/g, ' ')}</td>
                        <td className="py-2">{item.hospitalised ? 'Yes' : 'No'}</td>
                        <td className="py-2">{item.outcome || '—'}</td>
                      </tr>
                    ))}
                    {crisisHistory.length === 0 && (
                      <tr>
                        <td colSpan={5} className="py-4 text-center text-slate-500">No crisis events recorded yet.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}

      {tab === 'treatment' && (
        <div className="grid gap-5 xl:grid-cols-[1.05fr_0.95fr]">
          <div className="space-y-4 rounded-2xl border border-slate-800 bg-slate-900/80 p-5">
            <div className="flex items-center gap-2">
              <Syringe className="h-4 w-4 text-sky-300" />
              <h3 className="text-lg font-semibold">Hydroxyurea & Medications</h3>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <input type="date" value={treatmentForm.recordedAt} onChange={(e) => setTreatmentForm((c) => ({ ...c, recordedAt: e.target.value }))} className="rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm" />
              <select value={treatmentForm.treatmentType} onChange={(e) => setTreatmentForm((c) => ({ ...c, treatmentType: e.target.value }))} className="rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm">
                {['hydroxyurea', 'penicillin_prophylaxis', 'folic_acid', 'malaria_prophylaxis', 'transfusion', 'bone_marrow_transplant', 'other'].map((value) => <option key={value} value={value}>{value.replace(/_/g, ' ')}</option>)}
              </select>
              <input value={treatmentForm.drugName} onChange={(e) => setTreatmentForm((c) => ({ ...c, drugName: e.target.value }))} placeholder="Drug name" className="rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm" />
              <input value={treatmentForm.patientWeightKg} onChange={(e) => setTreatmentForm((c) => ({ ...c, patientWeightKg: e.target.value }))} type="number" step="0.1" placeholder="Patient weight (kg)" className="rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm" />
              <input value={treatmentForm.doseMg} onChange={(e) => setTreatmentForm((c) => ({ ...c, doseMg: e.target.value }))} type="number" step="0.1" placeholder="Dose mg" className="rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm" />
              <input value={treatmentForm.doseMgPerKg} onChange={(e) => setTreatmentForm((c) => ({ ...c, doseMgPerKg: e.target.value }))} type="number" step="0.1" placeholder="Dose mg/kg" className="rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm" />
              <input value={treatmentForm.frequency} onChange={(e) => setTreatmentForm((c) => ({ ...c, frequency: e.target.value }))} placeholder="Frequency" className="rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm" />
              <input value={treatmentForm.indication} onChange={(e) => setTreatmentForm((c) => ({ ...c, indication: e.target.value }))} placeholder="Indication" className="rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm" />
            </div>

            {treatmentForm.treatmentType === 'hydroxyurea' && (
              <div className="grid gap-3 md:grid-cols-2 rounded-2xl border border-slate-800 bg-slate-950 p-4">
                <input value={treatmentForm.hbGDl} onChange={(e) => setTreatmentForm((c) => ({ ...c, hbGDl: e.target.value }))} type="number" step="0.1" placeholder="Hb g/dL" className="rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-sm" />
                <input value={treatmentForm.mcvFl} onChange={(e) => setTreatmentForm((c) => ({ ...c, mcvFl: e.target.value }))} type="number" step="0.1" placeholder="MCV fL" className="rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-sm" />
                <input value={treatmentForm.wbcX10_9} onChange={(e) => setTreatmentForm((c) => ({ ...c, wbcX10_9: e.target.value }))} type="number" step="0.1" placeholder="WBC x10^9/L" className="rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-sm" />
                <input value={treatmentForm.ancX10_9} onChange={(e) => setTreatmentForm((c) => ({ ...c, ancX10_9: e.target.value }))} type="number" step="0.1" placeholder="ANC x10^9/L" className="rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-sm" />
                <input value={treatmentForm.plateletsX10_9} onChange={(e) => setTreatmentForm((c) => ({ ...c, plateletsX10_9: e.target.value }))} type="number" step="0.1" placeholder="Platelets x10^9/L" className="rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-sm" />
                <input value={treatmentForm.reticulocytesX10_9} onChange={(e) => setTreatmentForm((c) => ({ ...c, reticulocytesX10_9: e.target.value }))} type="number" step="0.1" placeholder="Reticulocytes x10^9/L" className="rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-sm" />
                <input value={treatmentForm.hbfPct} onChange={(e) => setTreatmentForm((c) => ({ ...c, hbfPct: e.target.value }))} type="number" step="0.1" placeholder="HbF %" className="rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-sm" />
                <input value={treatmentForm.weeksOnCurrentDose} onChange={(e) => setTreatmentForm((c) => ({ ...c, weeksOnCurrentDose: e.target.value }))} type="number" placeholder="Weeks on current dose" className="rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-sm" />
              </div>
            )}
            <div className="grid gap-3 md:grid-cols-2">
              <input type="date" value={treatmentForm.nextReviewDate} onChange={(e) => setTreatmentForm((c) => ({ ...c, nextReviewDate: e.target.value }))} className="rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm" />
              <textarea value={treatmentForm.notes} onChange={(e) => setTreatmentForm((c) => ({ ...c, notes: e.target.value }))} rows={3} placeholder="Notes" className="rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm md:col-span-2" />
            </div>
            <button type="button" onClick={() => void submitTreatment()} className="rounded-xl bg-sky-600 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-500">
              Save Treatment
            </button>
          </div>
          <div className="space-y-4">
            {doseResult && (
              <div className={`rounded-2xl border p-5 ${doseCardStyles[doseResult.action] || doseCardStyles.continue}`}>
                <h3 className="text-lg font-semibold uppercase">{doseResult.action}</h3>
                {doseResult.recommended_dose_mg !== undefined && <p className="mt-2 text-sm">Recommended dose: {doseResult.recommended_dose_mg ?? 'Hold'} mg</p>}
                {Array.isArray(doseResult.reason) && doseResult.reason.map((item: string) => (
                  <p key={item} className="mt-2 text-sm font-semibold">{item}</p>
                ))}
                {doseResult.resume_when && <p className="mt-2 text-xs text-slate-200">{doseResult.resume_when}</p>}
              </div>
            )}
            <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-5">
              <h3 className="mb-3 text-lg font-semibold">Treatment History</h3>
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead className="text-left text-slate-400">
                    <tr>
                      <th className="pb-2">Date</th>
                      <th className="pb-2">Type</th>
                      <th className="pb-2">Dose</th>
                      <th className="pb-2">Action</th>
                      <th className="pb-2">Next review</th>
                    </tr>
                  </thead>
                  <tbody className="text-slate-200">
                    {treatmentHistory.map((item) => (
                      <tr key={item.id} className="border-t border-slate-800">
                        <td className="py-2">{item.recordedAt}</td>
                        <td className="py-2 capitalize">{String(item.treatmentType || '').replace(/_/g, ' ')}</td>
                        <td className="py-2">{item.doseMg ? `${item.doseMg} mg` : '—'}</td>
                        <td className="py-2 capitalize">{String(item.action || '').replace(/_/g, ' ') || '—'}</td>
                        <td className="py-2">{item.nextReviewDate || '—'}</td>
                      </tr>
                    ))}
                    {treatmentHistory.length === 0 && (
                      <tr>
                        <td colSpan={5} className="py-4 text-center text-slate-500">No treatment records yet.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}

      {tab === 'screening' && (
        <div className="grid gap-5 xl:grid-cols-[1.05fr_0.95fr]">
          <div className="space-y-4 rounded-2xl border border-slate-800 bg-slate-900/80 p-5">
            <div className="flex items-center gap-2">
              <ShieldPlus className="h-4 w-4 text-emerald-300" />
              <h3 className="text-lg font-semibold">Complication Screening</h3>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <input type="date" value={screeningForm.screenedAt} onChange={(e) => setScreeningForm((c) => ({ ...c, screenedAt: e.target.value }))} className="rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm" />
              <select value={screeningForm.screeningType} onChange={(e) => setScreeningForm((c) => ({ ...c, screeningType: e.target.value }))} className="rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm">
                {['tcd', 'eye', 'renal', 'cardiac', 'pulmonary', 'bone', 'growth', 'neurocognitive'].map((value) => <option key={value} value={value}>{value.toUpperCase()}</option>)}
              </select>
              <label className="inline-flex items-center gap-2 rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 text-sm">
                <input type="checkbox" checked={screeningForm.resultNormal} onChange={(e) => setScreeningForm((c) => ({ ...c, resultNormal: e.target.checked }))} />
                Result normal
              </label>
              <label className="inline-flex items-center gap-2 rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 text-sm">
                <input type="checkbox" checked={screeningForm.referred} onChange={(e) => setScreeningForm((c) => ({ ...c, referred: e.target.checked }))} />
                Referred
              </label>
            </div>
            {screeningForm.screeningType === 'tcd' && (
              <div className="rounded-2xl border border-slate-800 bg-slate-950 p-4">
                <div className="grid gap-3 md:grid-cols-2">
                  <input value={screeningForm.tcdVelocityCmS} onChange={(e) => setScreeningForm((c) => ({ ...c, tcdVelocityCmS: e.target.value }))} type="number" step="0.1" placeholder="TCD velocity cm/s" className="rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-sm" />
                  <div className="rounded-xl border border-slate-800 bg-slate-900 px-3 py-2 text-sm text-slate-200">
                    Classification: {classifyTcd(screeningForm.tcdVelocityCmS) || '—'}
                  </div>
                </div>
              </div>
            )}
            {screeningForm.screeningType === 'renal' && (
              <div className="grid gap-3 md:grid-cols-2 rounded-2xl border border-slate-800 bg-slate-950 p-4">
                <input value={screeningForm.egfrMlMin} onChange={(e) => setScreeningForm((c) => ({ ...c, egfrMlMin: e.target.value }))} type="number" step="0.1" placeholder="eGFR mL/min" className="rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-sm" />
                <input value={screeningForm.urineAlbuminCreatinine} onChange={(e) => setScreeningForm((c) => ({ ...c, urineAlbuminCreatinine: e.target.value }))} type="number" step="0.1" placeholder="Urine ACR mg/mmol" className="rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-sm" />
              </div>
            )}
            <textarea value={screeningForm.resultDetail} onChange={(e) => setScreeningForm((c) => ({ ...c, resultDetail: e.target.value }))} rows={3} placeholder="Result details" className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm" />
            {screeningForm.referred && (
              <input value={screeningForm.referralReason} onChange={(e) => setScreeningForm((c) => ({ ...c, referralReason: e.target.value }))} placeholder="Referral reason" className="rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm" />
            )}
            <div className="grid gap-3 md:grid-cols-2">
              <input type="date" value={screeningForm.nextScreeningDate} onChange={(e) => setScreeningForm((c) => ({ ...c, nextScreeningDate: e.target.value }))} className="rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm" />
              <textarea value={screeningForm.notes} onChange={(e) => setScreeningForm((c) => ({ ...c, notes: e.target.value }))} rows={2} placeholder="Notes" className="rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm" />
            </div>
            <button type="button" onClick={() => void submitScreening()} className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-500">
              Save Screening
            </button>
          </div>

          <div className="space-y-4">
            <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-5">
              <h3 className="mb-3 text-lg font-semibold">Mandatory Screening Tracker</h3>
              <div className="space-y-3">
                {screeningTracker.map((item) => (
                  <div key={item.type} className="rounded-xl border border-slate-800 bg-slate-950 p-3">
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-sm font-semibold uppercase">{item.type}</span>
                      {riskResult?.overdue_screening_check?.includes(item.type) && (
                        <span className="rounded-full border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-[11px] font-semibold text-amber-300">Mandatory</span>
                      )}
                    </div>
                    <p className="mt-2 text-sm text-slate-300">Last done: {item.lastDone}</p>
                    <p className="text-sm text-slate-400">Next due: {item.nextDue}</p>
                  </div>
                ))}
              </div>
            </div>
            <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-5">
              <h3 className="mb-3 text-lg font-semibold">Screening History</h3>
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead className="text-left text-slate-400">
                    <tr>
                      <th className="pb-2">Date</th>
                      <th className="pb-2">Type</th>
                      <th className="pb-2">Result</th>
                      <th className="pb-2">Referral</th>
                    </tr>
                  </thead>
                  <tbody className="text-slate-200">
                    {screeningHistory.map((item) => (
                      <tr key={item.id} className="border-t border-slate-800">
                        <td className="py-2">{item.screenedAt}</td>
                        <td className="py-2 uppercase">{item.screeningType}</td>
                        <td className="py-2">{item.resultNormal === null || item.resultNormal === undefined ? '—' : item.resultNormal ? 'Normal' : 'Abnormal'}</td>
                        <td className="py-2">{item.referred ? 'Yes' : 'No'}</td>
                      </tr>
                    ))}
                    {screeningHistory.length === 0 && (
                      <tr>
                        <td colSpan={4} className="py-4 text-center text-slate-500">No screening history yet.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
