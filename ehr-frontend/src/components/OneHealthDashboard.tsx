import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { AlertTriangle, CheckCircle2, PawPrint, ShieldAlert, Syringe, FileText } from 'lucide-react';
import { oneHealthApi } from '../services/api';
import { useNotification } from './GlobalNotification';

type TabKey = 'exposures' | 'pep' | 'reports';

const tabs: Array<{ key: TabKey; label: string; icon: React.ComponentType<{ className?: string }> }> = [
  { key: 'exposures', label: 'Animal Exposures', icon: PawPrint },
  { key: 'pep', label: 'Rabies PEP', icon: Syringe },
  { key: 'reports', label: 'One Health Reports', icon: FileText },
];

const animalTypes = ['cattle', 'dog', 'cat', 'bat', 'goat', 'sheep', 'rodent', 'wildlife', 'poultry', 'camel', 'pig', 'monkey'];
const exposureTypes = ['bite', 'scratch', 'contact', 'consumption', 'vector_borne'];
const zoonosisOptions = [
  { label: 'Rabies', value: 'rabies', icd11: '1C82' },
  { label: 'Brucellosis', value: 'brucellosis', icd11: '1B95' },
  { label: 'Rift Valley Fever', value: 'rift_valley_fever', icd11: '1D43' },
  { label: 'Anthrax', value: 'anthrax', icd11: '1B97' },
  { label: 'Leptospirosis', value: 'leptospirosis', icd11: '1C10' },
  { label: 'Q Fever', value: 'q_fever', icd11: '1C30' },
  { label: 'Human African Trypanosomiasis', value: 'human_african_trypanosomiasis', icd11: '1F50' },
];

const urgencyTone = (urgency?: string) => {
  if (urgency === 'emergency') return 'border-red-500/40 bg-red-500/15 text-red-100';
  if (urgency === 'urgent') return 'border-amber-500/40 bg-amber-500/15 text-amber-100';
  return 'border-emerald-500/40 bg-emerald-500/15 text-emerald-100';
};

const boolLabel = (value: boolean | null | undefined) => {
  if (value === true) return 'Yes';
  if (value === false) return 'No';
  return 'Unknown';
};

const parseJsonInput = (value: string) => {
  if (!value.trim()) return {};
  try {
    return JSON.parse(value);
  } catch {
    throw new Error('Lab evidence must be valid JSON.');
  }
};

export default function OneHealthDashboard({ patientId }: { patientId: string }) {
  const { tenantSlug } = useParams<{ tenantSlug: string }>();
  const token = localStorage.getItem('ehr_token') || '';
  const { showError, showSuccess } = useNotification();

  const [activeTab, setActiveTab] = useState<TabKey>('exposures');
  const [loading, setLoading] = useState(false);
  const [exposures, setExposures] = useState<any[]>([]);
  const [reports, setReports] = useState<any[]>([]);
  const [pepStatus, setPepStatus] = useState<any[]>([]);
  const [latestAssessment, setLatestAssessment] = useState<any | null>(null);
  const [selectedExposureId, setSelectedExposureId] = useState<string>('');
  const [pactrCondition, setPactrCondition] = useState('');
  const [pactrMatches, setPactrMatches] = useState<any[]>([]);
  const [pactrSearchResults, setPactrSearchResults] = useState<any[]>([]);
  const [pactrLoading, setPactrLoading] = useState<'match' | 'search' | null>(null);

  const [exposureForm, setExposureForm] = useState({
    animalType: 'dog',
    exposureType: 'bite',
    exposureDate: new Date().toISOString().slice(0, 10),
    exposureLocation: '',
    animalIll: '',
    animalVaccinated: '',
    notes: '',
  });
  const [pepForm, setPepForm] = useState({
    exposureDate: new Date().toISOString().slice(0, 10),
    protocol: 'essen',
    weightKg: '',
    facilityId: '',
  });
  const [reportForm, setReportForm] = useState({
    suspectedZoonosis: 'rabies',
    icd11Code: '1C82',
    reportDate: new Date().toISOString().slice(0, 10),
    clinicalSummary: '',
    labEvidence: '{}',
    animalExposureId: '',
    outcome: '',
  });

  const selectedExposure = useMemo(
    () => exposures.find((item) => item.id === selectedExposureId) ?? exposures[0] ?? null,
    [exposures, selectedExposureId],
  );

  const loadData = useCallback(async () => {
    if (!tenantSlug || !token) return;
    setLoading(true);
    try {
      const [exposureRows, reportRows, pepRows] = await Promise.all([
        oneHealthApi.getExposures(patientId, token, tenantSlug).catch(() => []),
        oneHealthApi.getReports(patientId, token, tenantSlug).catch(() => []),
        oneHealthApi.getRabiesPepStatus(patientId, token, tenantSlug).catch(() => []),
      ]);
      setExposures(Array.isArray(exposureRows) ? exposureRows : []);
      setReports(Array.isArray(reportRows) ? reportRows : []);
      setPepStatus(Array.isArray(pepRows) ? pepRows : []);
    } catch (error: any) {
      showError('One Health', error?.response?.data?.message || 'Failed to load One Health records.');
    } finally {
      setLoading(false);
    }
  }, [patientId, showError, tenantSlug, token]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  useEffect(() => {
    if (selectedExposure?.exposureDate) {
      setPepForm((prev) => ({ ...prev, exposureDate: selectedExposure.exposureDate }));
      setReportForm((prev) => ({ ...prev, animalExposureId: selectedExposure.id }));
    }
  }, [selectedExposure]);

  const submitExposure = async () => {
    if (!tenantSlug || !token) return;
    try {
      const result = await oneHealthApi.recordExposure(
        patientId,
        {
          animalType: exposureForm.animalType,
          exposureType: exposureForm.exposureType,
          exposureDate: exposureForm.exposureDate || null,
          exposureLocation: exposureForm.exposureLocation || null,
          animalIll: exposureForm.animalIll === '' ? null : exposureForm.animalIll === 'true',
          animalVaccinated: exposureForm.animalVaccinated === '' ? null : exposureForm.animalVaccinated === 'true',
          notes: exposureForm.notes || null,
        },
        token,
        tenantSlug,
      );
      setLatestAssessment(result?.zoonoticAssessment ?? null);
      setPactrCondition(result?.zoonoticAssessment?.primary_suspect || exposureForm.animalType);
      showSuccess('One Health', 'Animal exposure recorded.');
      setExposureForm((prev) => ({ ...prev, notes: '' }));
      await loadData();
    } catch (error: any) {
      showError('One Health', error?.response?.data?.message || 'Failed to record animal exposure.');
    }
  };

  const submitPep = async () => {
    if (!tenantSlug || !token) return;
    try {
      const result = await oneHealthApi.startRabiesPep(
        patientId,
        {
          exposureDate: pepForm.exposureDate,
          protocol: pepForm.protocol,
          weightKg: pepForm.weightKg ? Number(pepForm.weightKg) : undefined,
          facilityId: pepForm.facilityId || undefined,
        },
        token,
        tenantSlug,
      );
      setPepStatus(Array.isArray(result?.pepSchedule) ? result.pepSchedule : []);
      showSuccess('Rabies PEP', 'Rabies PEP schedule created.');
      await loadData();
    } catch (error: any) {
      showError('Rabies PEP', error?.response?.data?.message || 'Failed to start rabies PEP schedule.');
    }
  };

  const submitReport = async () => {
    if (!tenantSlug || !token) return;
    try {
      const payload = {
        suspectedZoonosis: reportForm.suspectedZoonosis,
        icd11Code: reportForm.icd11Code || null,
        reportDate: reportForm.reportDate,
        clinicalSummary: reportForm.clinicalSummary || null,
        labEvidence: parseJsonInput(reportForm.labEvidence),
        animalExposureId: reportForm.animalExposureId || null,
        outcome: reportForm.outcome || null,
      };
      await oneHealthApi.createReport(patientId, payload, token, tenantSlug);
      showSuccess('One Health Report', 'Case report created.');
      setReportForm((prev) => ({ ...prev, clinicalSummary: '', labEvidence: '{}', outcome: '' }));
      await loadData();
    } catch (error: any) {
      showError('One Health Report', error instanceof Error ? error.message : error?.response?.data?.message || 'Failed to create One Health report.');
    }
  };

  const submitToVet = async (reportId: string) => {
    if (!tenantSlug || !token) return;
    try {
      await oneHealthApi.submitReport(reportId, token, tenantSlug);
      showSuccess('Vet Authority', 'Report submission processed.');
      await loadData();
    } catch (error: any) {
      showError('Vet Authority', error?.response?.data?.message || error?.message || 'Report saved locally, but vet submission failed.');
    }
  };

  const onZoonosisChange = (value: string) => {
    const selected = zoonosisOptions.find((option) => option.value === value);
    setReportForm((prev) => ({
      ...prev,
      suspectedZoonosis: value,
      icd11Code: selected?.icd11 || '',
    }));
  };

  const runPactrMatch = async () => {
    if (!tenantSlug || !token) return;
    const condition = pactrCondition.trim() || latestAssessment?.primary_suspect || reportForm.suspectedZoonosis;
    if (!condition) {
      showError('PACTR', 'Enter or generate a condition before matching trials.');
      return;
    }
    try {
      setPactrLoading('match');
      const rows = await oneHealthApi.matchPACTRTrials(tenantSlug, patientId, token, condition);
      setPactrMatches(Array.isArray(rows) ? rows : []);
      showSuccess('PACTR', 'Patient-specific PACTR trial matching completed.');
    } catch (error: any) {
      showError('PACTR', error?.response?.data?.message || 'Failed to match patient to PACTR trials.');
    } finally {
      setPactrLoading(null);
    }
  };

  const runPactrSearch = async () => {
    if (!tenantSlug || !token) return;
    const condition = pactrCondition.trim() || latestAssessment?.primary_suspect || reportForm.suspectedZoonosis;
    if (!condition) {
      showError('PACTR', 'Enter or generate a condition before searching.');
      return;
    }
    try {
      setPactrLoading('search');
      const rows = await oneHealthApi.searchPACTR(condition, token, tenantSlug);
      setPactrSearchResults(Array.isArray(rows) ? rows : []);
      showSuccess('PACTR', 'PACTR registry search completed.');
    } catch (error: any) {
      showError('PACTR', error?.response?.data?.message || 'Failed to search PACTR trials.');
    } finally {
      setPactrLoading(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-emerald-500/20 bg-slate-950/80 p-5 shadow-lg shadow-emerald-950/20">
        <div className="flex flex-wrap gap-3">
          {tabs.map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              type="button"
              onClick={() => setActiveTab(key)}
              className={`inline-flex items-center gap-2 rounded-xl border px-4 py-2 text-sm font-semibold transition ${
                activeTab === key
                  ? 'border-emerald-400/50 bg-emerald-500/15 text-emerald-100'
                  : 'border-slate-700 bg-slate-900/70 text-slate-300 hover:border-slate-600'
              }`}
            >
              <Icon className="h-4 w-4" />
              {label}
            </button>
          ))}
        </div>
      </div>

      {activeTab === 'exposures' && (
        <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
          <div className="rounded-2xl border border-slate-800 bg-slate-950/80 p-5">
            <h3 className="text-lg font-semibold text-white">Record Animal Exposure</h3>
            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <label className="text-sm text-slate-300">
                Animal type
                <select className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2" value={exposureForm.animalType} onChange={(e) => setExposureForm((prev) => ({ ...prev, animalType: e.target.value }))}>
                  {animalTypes.map((option) => <option key={option} value={option}>{option}</option>)}
                </select>
              </label>
              <label className="text-sm text-slate-300">
                Exposure type
                <select className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2" value={exposureForm.exposureType} onChange={(e) => setExposureForm((prev) => ({ ...prev, exposureType: e.target.value }))}>
                  {exposureTypes.map((option) => <option key={option} value={option}>{option}</option>)}
                </select>
              </label>
              <label className="text-sm text-slate-300">
                Exposure date
                <input className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2" type="date" value={exposureForm.exposureDate} onChange={(e) => setExposureForm((prev) => ({ ...prev, exposureDate: e.target.value }))} />
              </label>
              <label className="text-sm text-slate-300">
                Exposure location
                <input className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2" value={exposureForm.exposureLocation} onChange={(e) => setExposureForm((prev) => ({ ...prev, exposureLocation: e.target.value }))} />
              </label>
              <label className="text-sm text-slate-300">
                Animal ill
                <select className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2" value={exposureForm.animalIll} onChange={(e) => setExposureForm((prev) => ({ ...prev, animalIll: e.target.value }))}>
                  <option value="">Unknown</option>
                  <option value="true">Yes</option>
                  <option value="false">No</option>
                </select>
              </label>
              <label className="text-sm text-slate-300">
                Animal vaccinated
                <select className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2" value={exposureForm.animalVaccinated} onChange={(e) => setExposureForm((prev) => ({ ...prev, animalVaccinated: e.target.value }))}>
                  <option value="">Unknown</option>
                  <option value="true">Yes</option>
                  <option value="false">No</option>
                </select>
              </label>
            </div>
            <label className="mt-4 block text-sm text-slate-300">
              Notes
              <textarea className="mt-1 min-h-[96px] w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2" value={exposureForm.notes} onChange={(e) => setExposureForm((prev) => ({ ...prev, notes: e.target.value }))} />
            </label>
            <button type="button" onClick={submitExposure} className="mt-4 rounded-xl bg-emerald-500 px-4 py-2 text-sm font-semibold text-slate-950 hover:bg-emerald-400">
              Save exposure
            </button>
          </div>

          <div className="space-y-4">
            <div className="rounded-2xl border border-slate-800 bg-slate-950/80 p-5">
              <h3 className="text-lg font-semibold text-white">Live Zoonotic Assessment</h3>
              {latestAssessment ? (
                <div className="mt-4 space-y-3 text-sm">
                  <div className={`inline-flex rounded-full border px-3 py-1 font-semibold ${urgencyTone(latestAssessment?.urgency)}`}>
                    {latestAssessment?.urgency || 'routine'}
                  </div>
                  <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-4">
                    <p className="text-xs uppercase tracking-wide text-slate-400">Primary suspect</p>
                    <p className="mt-1 text-base font-semibold text-white">{latestAssessment?.primary_suspect || 'No primary suspect'}</p>
                  </div>
                  {latestAssessment?.pep_indication && (
                    <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-4 text-amber-100">
                      <div className="flex items-center gap-2 font-semibold">
                        <ShieldAlert className="h-4 w-4" />
                        Rabies PEP indicated
                      </div>
                      <p className="mt-2 text-sm">{latestAssessment?.pep_recommendation?.immediate_action}</p>
                    </div>
                  )}
                  {latestAssessment?.vet_notification_required && (
                    <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-red-100">
                      Veterinary authority notification required.
                    </div>
                  )}
                  <div className="space-y-2">
                    {(latestAssessment?.management_summaries || []).map((item: any) => (
                      <div key={item.disease} className="rounded-xl border border-slate-800 bg-slate-900/70 p-4">
                        <div className="flex items-center justify-between gap-3">
                          <p className="font-semibold text-white">{item.disease}</p>
                          <span className="text-xs text-slate-400">{item.icd11}</span>
                        </div>
                        <p className="mt-2 text-slate-300">{item.management}</p>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="mt-4 rounded-xl border border-dashed border-slate-700 p-4 text-sm text-slate-400">
                  Save an exposure to see immediate zoonotic guidance.
                </div>
              )}
            </div>

            <div className="rounded-2xl border border-slate-800 bg-slate-950/80 p-5">
              <h3 className="text-lg font-semibold text-white">Exposure History</h3>
              <div className="mt-4 space-y-3">
                {loading && exposures.length === 0 ? (
                  <div className="text-sm text-slate-400">Loading exposures…</div>
                ) : exposures.length === 0 ? (
                  <div className="text-sm text-slate-400">No animal exposures recorded yet.</div>
                ) : (
                  exposures.map((exposure) => (
                    <button
                      type="button"
                      key={exposure.id}
                      onClick={() => setSelectedExposureId(exposure.id)}
                      className={`w-full rounded-xl border p-4 text-left ${selectedExposureId === exposure.id ? 'border-emerald-500/40 bg-emerald-500/10' : 'border-slate-800 bg-slate-900/70'}`}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <p className="font-semibold text-white">{exposure.animalType} · {exposure.exposureType}</p>
                          <p className="text-sm text-slate-400">{exposure.exposureDate || exposure.recordedDate} · {exposure.exposureLocation || 'No location recorded'}</p>
                        </div>
                        {exposure.rabiesPepStarted ? (
                          <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-1 text-xs text-emerald-100">
                            <CheckCircle2 className="h-3 w-3" />
                            PEP started
                          </span>
                        ) : null}
                      </div>
                      <div className="mt-2 text-xs text-slate-500">
                        Animal ill: {boolLabel(exposure.animalIll)} · Vaccinated: {boolLabel(exposure.animalVaccinated)}
                      </div>
                    </button>
                  ))
                )}
              </div>
            </div>

            <div className="rounded-2xl border border-slate-800 bg-slate-950/80 p-5">
              <h3 className="text-lg font-semibold text-white">PACTR Trial Matching</h3>
              <p className="mt-1 text-sm text-slate-400">
                Use the suspected zoonosis or exposure pathway to search African trial options.
              </p>
              <label className="mt-4 block text-sm text-slate-300">
                Condition / pathway
                <input
                  className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2"
                  value={pactrCondition}
                  onChange={(e) => setPactrCondition(e.target.value)}
                  placeholder={latestAssessment?.primary_suspect || 'rabies'}
                />
              </label>
              <div className="mt-4 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={runPactrMatch}
                  disabled={pactrLoading !== null}
                  className="rounded-xl bg-cyan-400 px-4 py-2 text-sm font-semibold text-slate-950 hover:bg-cyan-300 disabled:opacity-60"
                >
                  {pactrLoading === 'match' ? 'Matching…' : 'Match Patient'}
                </button>
                <button
                  type="button"
                  onClick={runPactrSearch}
                  disabled={pactrLoading !== null}
                  className="rounded-xl border border-slate-700 px-4 py-2 text-sm font-semibold text-slate-100 hover:border-slate-600 disabled:opacity-60"
                >
                  {pactrLoading === 'search' ? 'Searching…' : 'Search Registry'}
                </button>
              </div>
              {(pactrMatches.length > 0 || pactrSearchResults.length > 0) && (
                <div className="mt-4 space-y-4">
                  {pactrMatches.length > 0 && (
                    <div className="space-y-2">
                      <p className="text-xs font-semibold uppercase tracking-wide text-cyan-300">Matched for this patient</p>
                      {pactrMatches.slice(0, 5).map((trial) => (
                        <div key={trial.id || trial.registryId || trial.nctId} className="rounded-xl border border-slate-800 bg-slate-900/70 p-4">
                          <p className="font-semibold text-white">{trial.trialTitle || trial.title || 'Untitled trial'}</p>
                          <p className="mt-1 text-sm text-slate-400">
                            {(trial.registry || 'PACTR').toUpperCase()} · {trial.registryId || trial.nctId || 'No ID'} · Score {Number(trial.eligibilityScore || 0).toFixed(2)}
                          </p>
                        </div>
                      ))}
                    </div>
                  )}
                  {pactrSearchResults.length > 0 && (
                    <div className="space-y-2">
                      <p className="text-xs font-semibold uppercase tracking-wide text-emerald-300">Registry search results</p>
                      {pactrSearchResults.slice(0, 5).map((trial) => (
                        <div key={trial.registryId || trial.id} className="rounded-xl border border-slate-800 bg-slate-900/70 p-4">
                          <p className="font-semibold text-white">{trial.title || 'Untitled trial'}</p>
                          <p className="mt-1 text-sm text-slate-400">
                            PACTR · {trial.registryId || 'No ID'} · {trial.phase || 'Phase n/a'}
                          </p>
                          {trial.url ? (
                            <a href={trial.url} target="_blank" rel="noreferrer" className="mt-2 inline-flex text-xs font-semibold text-cyan-300 hover:text-cyan-200">
                              Open registry listing
                            </a>
                          ) : null}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {activeTab === 'pep' && (
        <div className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
          <div className="rounded-2xl border border-slate-800 bg-slate-950/80 p-5">
            <h3 className="text-lg font-semibold text-white">Start Rabies PEP</h3>
            <div className="mt-4 grid gap-4">
              <label className="text-sm text-slate-300">
                Exposure
                <select className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2" value={selectedExposureId} onChange={(e) => setSelectedExposureId(e.target.value)}>
                  <option value="">Latest exposure</option>
                  {exposures.map((exposure) => (
                    <option key={exposure.id} value={exposure.id}>
                      {exposure.animalType} · {exposure.exposureType} · {exposure.exposureDate || exposure.recordedDate}
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-sm text-slate-300">
                Exposure date
                <input className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2" type="date" value={pepForm.exposureDate} onChange={(e) => setPepForm((prev) => ({ ...prev, exposureDate: e.target.value }))} />
              </label>
              <label className="text-sm text-slate-300">
                Protocol
                <select className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2" value={pepForm.protocol} onChange={(e) => setPepForm((prev) => ({ ...prev, protocol: e.target.value }))}>
                  <option value="essen">Essen</option>
                  <option value="zagreb">Zagreb</option>
                </select>
              </label>
              <label className="text-sm text-slate-300">
                Weight (kg)
                <input className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2" value={pepForm.weightKg} onChange={(e) => setPepForm((prev) => ({ ...prev, weightKg: e.target.value }))} />
              </label>
              <label className="text-sm text-slate-300">
                Facility ID
                <input className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2" value={pepForm.facilityId} onChange={(e) => setPepForm((prev) => ({ ...prev, facilityId: e.target.value }))} />
              </label>
            </div>
            <button type="button" onClick={submitPep} className="mt-4 rounded-xl bg-amber-400 px-4 py-2 text-sm font-semibold text-slate-950 hover:bg-amber-300">
              Start PEP schedule
            </button>
          </div>

          <div className="rounded-2xl border border-slate-800 bg-slate-950/80 p-5">
            <h3 className="text-lg font-semibold text-white">PEP Dose Timeline</h3>
            <div className="mt-4 space-y-3">
              {pepStatus.length === 0 ? (
                <div className="rounded-xl border border-dashed border-slate-700 p-4 text-sm text-slate-400">
                  No rabies PEP schedule recorded yet.
                </div>
              ) : (
                pepStatus.map((dose: any, index) => {
                  const scheduledDate = dose.scheduledDate || dose.administeredAt?.slice?.(0, 10) || 'Unknown';
                  const status = dose.status || 'given';
                  const isOverdue = status === 'missed';
                  return (
                    <div key={`${dose.id || index}-${scheduledDate}`} className={`rounded-xl border p-4 ${isOverdue ? 'border-red-500/30 bg-red-500/10' : 'border-slate-800 bg-slate-900/70'}`}>
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <p className="font-semibold text-white">Dose {dose.doseNumber ?? index + 1}</p>
                          <p className="text-sm text-slate-400">{scheduledDate} · Rabies vaccine (HDCV/PCECV/PVRV)</p>
                          <p className="text-xs text-slate-500">Route: {dose.route || 'IM'} · Site: {dose.site || 'deltoid'}</p>
                        </div>
                        <span className={`rounded-full px-3 py-1 text-xs font-semibold ${isOverdue ? 'bg-red-500/20 text-red-100' : 'bg-emerald-500/15 text-emerald-100'}`}>
                          {status}
                        </span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}

      {activeTab === 'reports' && (
        <div className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
          <div className="rounded-2xl border border-slate-800 bg-slate-950/80 p-5">
            <h3 className="text-lg font-semibold text-white">Create One Health Report</h3>
            <div className="mt-4 grid gap-4">
              <label className="text-sm text-slate-300">
                Suspected zoonosis
                <select className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2" value={reportForm.suspectedZoonosis} onChange={(e) => onZoonosisChange(e.target.value)}>
                  {zoonosisOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                </select>
              </label>
              <label className="text-sm text-slate-300">
                ICD-11 code
                <input className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2" value={reportForm.icd11Code} onChange={(e) => setReportForm((prev) => ({ ...prev, icd11Code: e.target.value }))} />
              </label>
              <label className="text-sm text-slate-300">
                Report date
                <input className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2" type="date" value={reportForm.reportDate} onChange={(e) => setReportForm((prev) => ({ ...prev, reportDate: e.target.value }))} />
              </label>
              <label className="text-sm text-slate-300">
                Linked exposure
                <select className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2" value={reportForm.animalExposureId} onChange={(e) => setReportForm((prev) => ({ ...prev, animalExposureId: e.target.value }))}>
                  <option value="">None</option>
                  {exposures.map((exposure) => (
                    <option key={exposure.id} value={exposure.id}>
                      {exposure.animalType} · {exposure.exposureType} · {exposure.exposureDate || exposure.recordedDate}
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-sm text-slate-300">
                Clinical summary
                <textarea className="mt-1 min-h-[110px] w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2" value={reportForm.clinicalSummary} onChange={(e) => setReportForm((prev) => ({ ...prev, clinicalSummary: e.target.value }))} />
              </label>
              <label className="text-sm text-slate-300">
                Lab evidence (JSON)
                <textarea className="mt-1 min-h-[96px] w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 font-mono text-xs" value={reportForm.labEvidence} onChange={(e) => setReportForm((prev) => ({ ...prev, labEvidence: e.target.value }))} />
              </label>
              <label className="text-sm text-slate-300">
                Outcome
                <input className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2" value={reportForm.outcome} onChange={(e) => setReportForm((prev) => ({ ...prev, outcome: e.target.value }))} />
              </label>
            </div>
            <button type="button" onClick={submitReport} className="mt-4 rounded-xl bg-sky-400 px-4 py-2 text-sm font-semibold text-slate-950 hover:bg-sky-300">
              Save report
            </button>
          </div>

          <div className="rounded-2xl border border-slate-800 bg-slate-950/80 p-5">
            <h3 className="text-lg font-semibold text-white">Report Register</h3>
            <div className="mt-4 space-y-3">
              {reports.length === 0 ? (
                <div className="rounded-xl border border-dashed border-slate-700 p-4 text-sm text-slate-400">
                  No One Health reports recorded yet.
                </div>
              ) : (
                reports.map((report) => (
                  <div key={report.id} className="rounded-xl border border-slate-800 bg-slate-900/70 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-semibold text-white">{report.suspectedZoonosis}</p>
                        <p className="text-sm text-slate-400">{report.reportDate} · {report.icd11Code || 'No ICD-11 code'}</p>
                        {report.vetAuthorityReference ? (
                          <p className="mt-1 text-xs text-slate-500">Vet reference: {report.vetAuthorityReference}</p>
                        ) : null}
                      </div>
                      <span className={`rounded-full px-3 py-1 text-xs font-semibold ${report.submittedToVetAuthority ? 'bg-emerald-500/15 text-emerald-100' : 'bg-slate-800 text-slate-300'}`}>
                        {report.submittedToVetAuthority ? 'submitted' : 'local'}
                      </span>
                    </div>
                    {report.clinicalSummary ? (
                      <p className="mt-3 text-sm text-slate-300">{report.clinicalSummary}</p>
                    ) : null}
                    <button type="button" onClick={() => submitToVet(report.id)} className="mt-3 inline-flex items-center gap-2 rounded-xl border border-slate-700 px-3 py-2 text-sm text-slate-200 hover:border-slate-600">
                      <AlertTriangle className="h-4 w-4" />
                      Submit to Vet Authority
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
