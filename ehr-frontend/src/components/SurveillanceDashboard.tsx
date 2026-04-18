import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  BellRing,
  CheckCircle2,
  CloudUpload,
  Radar,
  RefreshCcw,
  ShieldAlert,
} from 'lucide-react';
import { outbreakApi, surveillanceApi, vhfApi } from '../services/api';
import { useNotification } from './GlobalNotification';

type Props = {
  tenantSlug: string;
  token: string;
};

type TabKey = 'ebs' | 'ihr' | 'sormas' | 'summary';

const riskBadge: Record<string, string> = {
  low: 'bg-slate-700/60 text-slate-200 border-slate-600',
  moderate: 'bg-amber-500/20 text-amber-200 border-amber-500/40',
  high: 'bg-orange-500/20 text-orange-200 border-orange-500/40',
  critical: 'bg-red-500/20 text-red-200 border-red-500/40',
};

const statusBadge: Record<string, string> = {
  success: 'bg-emerald-500/20 text-emerald-200 border-emerald-500/40',
  failed: 'bg-red-500/20 text-red-200 border-red-500/40',
  pending: 'bg-amber-500/20 text-amber-200 border-amber-500/40',
  conflict: 'bg-orange-500/20 text-orange-200 border-orange-500/40',
  unverified: 'bg-slate-700/60 text-slate-200 border-slate-600',
  under_investigation: 'bg-blue-500/20 text-blue-200 border-blue-500/40',
  verified_event: 'bg-emerald-500/20 text-emerald-200 border-emerald-500/40',
  discarded: 'bg-slate-700/60 text-slate-300 border-slate-600',
};

const diseaseBadge: Record<string, string> = {
  MONKEYPOX: 'bg-orange-500/20 text-orange-200 border-orange-500/40',
  EVD: 'bg-red-500/20 text-red-200 border-red-500/40',
  PLAGUE: 'bg-fuchsia-500/20 text-fuchsia-200 border-fuchsia-500/40',
  YELLOW_FEVER: 'bg-yellow-500/20 text-yellow-200 border-yellow-500/40',
  CSM: 'bg-cyan-500/20 text-cyan-200 border-cyan-500/40',
  LASSA: 'bg-pink-500/20 text-pink-200 border-pink-500/40',
};

const initialSignalForm = {
  signalSource: 'community_report',
  signalType: 'disease_cluster',
  diseaseSuspected: 'ebola',
  district: '',
  villageArea: '',
  description: '',
  rawSourceText: '',
  caseCount: '1',
  deathCount: '0',
};

const initialIhrForm = {
  eventType: 'case',
  disease: 'ebola',
  diseaseCategory: 'ihd_annex2',
  caseCount: '1',
  deathCount: '0',
  facilityName: '',
  district: '',
  province: '',
  affectedCountry: 'Zimbabwe',
  unusualUnexpected: true,
  significantPublicHealthImpact: true,
  significantSpread: false,
  travelTradeRestriction: false,
  healthcareWorkersAffected: false,
  laboratoryConfirmed: false,
};

export default function SurveillanceDashboard({ tenantSlug, token }: Props) {
  const { showError, showSuccess } = useNotification();
  const [tab, setTab] = useState<TabKey>('ebs');
  const [loading, setLoading] = useState(false);
  const [signals, setSignals] = useState<any[]>([]);
  const [ihrNotifications, setIhrNotifications] = useState<any[]>([]);
  const [sormasLogs, setSormasLogs] = useState<any[]>([]);
  const [summary, setSummary] = useState<any>(null);
  const [caseRows, setCaseRows] = useState<any[]>([]);
  const [signalStatusFilter, setSignalStatusFilter] = useState('');
  const [signalForm, setSignalForm] = useState(initialSignalForm);
  const [ihrForm, setIhrForm] = useState(initialIhrForm);
  const [selectedIhrId, setSelectedIhrId] = useState<string>('');
  const [selectedAssessment, setSelectedAssessment] = useState<any>(null);

  const loadData = useCallback(async () => {
    if (!tenantSlug || !token) return;
    setLoading(true);
    try {
      const [signalRows, ihrRows, logRows, summaryRow, vhfCases, plagueCases, yellowFeverCases, meningitisCases] =
        await Promise.all([
          surveillanceApi.getEbsSignals(signalStatusFilter || undefined, token, tenantSlug),
          surveillanceApi.getIhrNotifications(token, tenantSlug),
          surveillanceApi.getSormasLogs(token, tenantSlug),
          surveillanceApi.getSurveillanceSummary(token, tenantSlug),
          vhfApi.getCases(token, tenantSlug).catch(() => []),
          outbreakApi.getPlagueCases(undefined, token, tenantSlug).catch(() => []),
          outbreakApi.getYellowFeverCases(undefined, token, tenantSlug).catch(() => []),
          outbreakApi.getMeningitisCases(undefined, token, tenantSlug).catch(() => []),
        ]);

      setSignals(Array.isArray(signalRows) ? signalRows : []);
      setIhrNotifications(Array.isArray(ihrRows) ? ihrRows : []);
      setSormasLogs(Array.isArray(logRows) ? logRows : []);
      setSummary(summaryRow || null);
      setCaseRows([
        ...(Array.isArray(vhfCases) ? vhfCases.map((item: any) => ({ ...item, sourceTable: 'vhf_cases' })) : []),
        ...(Array.isArray(plagueCases) ? plagueCases.map((item: any) => ({ ...item, sourceTable: 'plague_cases' })) : []),
        ...(Array.isArray(yellowFeverCases) ? yellowFeverCases.map((item: any) => ({ ...item, sourceTable: 'yellow_fever_cases' })) : []),
        ...(Array.isArray(meningitisCases) ? meningitisCases.map((item: any) => ({ ...item, sourceTable: 'meningitis_cases' })) : []),
      ]);
    } catch (error: any) {
      showError('Surveillance', error?.response?.data?.message || 'Failed to load surveillance data.');
    } finally {
      setLoading(false);
    }
  }, [signalStatusFilter, tenantSlug, token, showError]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const latestLogByCaseId = useMemo(() => {
    const index: Record<string, any> = {};
    for (const log of sormasLogs) {
      if (!index[log.localCaseId]) {
        index[log.localCaseId] = log;
      }
    }
    return index;
  }, [sormasLogs]);

  const submitSignal = async () => {
    try {
      await surveillanceApi.reportEbsSignal(
        {
          signalSource: signalForm.signalSource,
          signalType: signalForm.signalType,
          diseaseSuspected: signalForm.diseaseSuspected || null,
          district: signalForm.district || null,
          villageArea: signalForm.villageArea || null,
          description: signalForm.description,
          rawSourceText: signalForm.rawSourceText || null,
          caseCount: Number(signalForm.caseCount || 0),
          deathCount: Number(signalForm.deathCount || 0),
        },
        token,
        tenantSlug,
      );
      setSignalForm(initialSignalForm);
      showSuccess('EBS Signals', 'Signal reported and triaged.');
      await loadData();
    } catch (error: any) {
      showError('EBS Signals', error?.response?.data?.message || 'Failed to report signal.');
    }
  };

  const submitIhr = async () => {
    try {
      const payload = {
        eventType: ihrForm.eventType,
        disease: ihrForm.disease,
        diseaseCategory: ihrForm.diseaseCategory || null,
        caseCount: Number(ihrForm.caseCount || 0),
        deathCount: Number(ihrForm.deathCount || 0),
        facilityName: ihrForm.facilityName || null,
        district: ihrForm.district || null,
        province: ihrForm.province || null,
        affectedCountry: ihrForm.affectedCountry,
        ihrAnnex2CriteriaMet: {
          unusual_unexpected: ihrForm.unusualUnexpected,
          significant_public_health_impact: ihrForm.significantPublicHealthImpact,
          significant_spread: ihrForm.significantSpread,
          travel_trade_restriction: ihrForm.travelTradeRestriction,
          healthcare_workers_affected: ihrForm.healthcareWorkersAffected,
          laboratory_confirmed: ihrForm.laboratoryConfirmed,
        },
      };
      const created = await surveillanceApi.createIhr(payload, token, tenantSlug);
      setSelectedIhrId(created?.id || '');
      setSelectedAssessment(created?.cdssAnnex2Assessment || null);
      showSuccess('IHR Notifications', 'IHR notification created.');
      await loadData();
    } catch (error: any) {
      showError('IHR Notifications', error?.response?.data?.message || 'Failed to create IHR notification.');
    }
  };

  const runAssessment = async (id: string) => {
    try {
      const result = await surveillanceApi.runAnnex2Assessment(
        id,
        {
          unusual_or_unexpected: ihrForm.unusualUnexpected,
          significant_public_health_impact: ihrForm.significantPublicHealthImpact,
          significant_international_spread: ihrForm.significantSpread,
          trade_travel_restriction_risk: ihrForm.travelTradeRestriction,
          healthcare_workers_affected: ihrForm.healthcareWorkersAffected,
          laboratory_confirmed: ihrForm.laboratoryConfirmed,
          days_since_first_case: 0,
        },
        token,
        tenantSlug,
      );
      setSelectedIhrId(id);
      setSelectedAssessment(result);
      showSuccess('IHR Annex 2', 'CDSS assessment completed.');
      await loadData();
    } catch (error: any) {
      showError('IHR Annex 2', error?.response?.data?.message || 'Failed to run Annex 2 assessment.');
    }
  };

  const pushCase = async (row: any) => {
    try {
      await surveillanceApi.pushToSormas(
        {
          localCaseId: row.id,
          sourceTable: row.sourceTable,
        },
        token,
        tenantSlug,
      );
      showSuccess('SORMAS Sync', 'Case sent to SORMAS.');
      await loadData();
    } catch (error: any) {
      showError('SORMAS Sync', error?.response?.data?.message || 'Failed to push case to SORMAS.');
    }
  };

  const retrySync = async (logId: string) => {
    try {
      await surveillanceApi.retrySormasSync(logId, token, tenantSlug);
      showSuccess('SORMAS Sync', 'Retry queued successfully.');
      await loadData();
    } catch (error: any) {
      showError('SORMAS Sync', error?.response?.data?.message || 'Failed to retry SORMAS sync.');
    }
  };

  const markSignalStatus = async (id: string, triageStatus: string) => {
    try {
      await surveillanceApi.updateEbsSignal(id, { triageStatus }, token, tenantSlug);
      showSuccess('EBS Signals', 'Signal status updated.');
      await loadData();
    } catch (error: any) {
      showError('EBS Signals', error?.response?.data?.message || 'Failed to update signal.');
    }
  };

  const markNotified = async (id: string, field: 'notifiedNfp' | 'notifiedWhoAfro') => {
    const nowIso = new Date().toISOString();
    const patch =
      field === 'notifiedNfp'
        ? { notifiedNfp: true, nfpNotifiedAt: nowIso }
        : { notifiedWhoAfro: true, whoAfroNotifiedAt: nowIso };
    try {
      await surveillanceApi.updateIhr(id, patch, token, tenantSlug);
      showSuccess('IHR Notifications', 'Notification status updated.');
      await loadData();
    } catch (error: any) {
      showError('IHR Notifications', error?.response?.data?.message || 'Failed to update notification state.');
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 px-4 py-6 text-slate-100 md:px-6">
      <div className="mx-auto max-w-7xl space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-[0.25em] text-cyan-300">Sprint 152</p>
            <h1 className="text-3xl font-semibold text-white">SORMAS Bridge & IHR Alert Pipeline</h1>
            <p className="mt-1 text-sm text-slate-400">
              Event-based surveillance, IHR Annex 2 assessment, and national SORMAS sync in one workflow.
            </p>
          </div>
          <button
            type="button"
            onClick={() => void loadData()}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-700 bg-slate-900/80 px-4 py-2 text-sm font-medium text-slate-200 hover:border-slate-600"
          >
            <RefreshCcw className="h-4 w-4" />
            {loading ? 'Refreshing…' : 'Refresh'}
          </button>
        </div>

        <div className="flex flex-wrap gap-2">
          {[
            { key: 'ebs' as TabKey, label: 'EBS Signals', Icon: Radar },
            { key: 'ihr' as TabKey, label: 'IHR Notifications', Icon: ShieldAlert },
            { key: 'sormas' as TabKey, label: 'SORMAS Sync', Icon: CloudUpload },
            { key: 'summary' as TabKey, label: 'Summary', Icon: BellRing },
          ].map(({ key, label, Icon }) => (
            <button
              key={key}
              type="button"
              onClick={() => setTab(key)}
              className={`inline-flex items-center gap-2 rounded-xl border px-4 py-2 text-sm font-medium ${
                tab === key
                  ? 'border-cyan-500 bg-cyan-500/15 text-cyan-100'
                  : 'border-slate-700 bg-slate-900/80 text-slate-300 hover:border-slate-600'
              }`}
            >
              <Icon className="h-4 w-4" />
              {label}
            </button>
          ))}
        </div>

        {tab === 'ebs' && (
          <div className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
            <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-5">
              <h2 className="text-lg font-semibold text-white">Report Signal</h2>
              <div className="mt-4 grid gap-3 md:grid-cols-2">
                <select value={signalForm.signalSource} onChange={(e) => setSignalForm((p) => ({ ...p, signalSource: e.target.value }))} className="rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm">
                  <option value="community_report">Community report</option>
                  <option value="media">Media</option>
                  <option value="chw">CHW</option>
                  <option value="lab">Laboratory</option>
                  <option value="clinical">Clinical</option>
                  <option value="social_media">Social media</option>
                </select>
                <select value={signalForm.signalType} onChange={(e) => setSignalForm((p) => ({ ...p, signalType: e.target.value }))} className="rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm">
                  <option value="disease_cluster">Disease cluster</option>
                  <option value="unusual_death">Unusual death</option>
                  <option value="rumour">Rumour</option>
                  <option value="laboratory_alert">Laboratory alert</option>
                  <option value="outbreak_alert">Outbreak alert</option>
                </select>
                <input value={signalForm.diseaseSuspected} onChange={(e) => setSignalForm((p) => ({ ...p, diseaseSuspected: e.target.value }))} placeholder="Disease suspected" className="rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm" />
                <input value={signalForm.district} onChange={(e) => setSignalForm((p) => ({ ...p, district: e.target.value }))} placeholder="District" className="rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm" />
                <input value={signalForm.villageArea} onChange={(e) => setSignalForm((p) => ({ ...p, villageArea: e.target.value }))} placeholder="Village or area" className="rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm md:col-span-2" />
                <textarea value={signalForm.description} onChange={(e) => setSignalForm((p) => ({ ...p, description: e.target.value }))} placeholder="Signal description" className="min-h-[96px] rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm md:col-span-2" />
                <textarea value={signalForm.rawSourceText} onChange={(e) => setSignalForm((p) => ({ ...p, rawSourceText: e.target.value }))} placeholder="Raw source text or media extract" className="min-h-[80px] rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm md:col-span-2" />
                <input value={signalForm.caseCount} onChange={(e) => setSignalForm((p) => ({ ...p, caseCount: e.target.value }))} placeholder="Case count" className="rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm" />
                <input value={signalForm.deathCount} onChange={(e) => setSignalForm((p) => ({ ...p, deathCount: e.target.value }))} placeholder="Death count" className="rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm" />
              </div>
              <button type="button" onClick={submitSignal} className="mt-4 rounded-xl bg-cyan-500 px-4 py-2 text-sm font-semibold text-slate-950 hover:bg-cyan-400">
                Submit Signal
              </button>
            </div>

            <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-5">
              <div className="flex items-center justify-between gap-3">
                <h2 className="text-lg font-semibold text-white">Signal Queue</h2>
                <select value={signalStatusFilter} onChange={(e) => setSignalStatusFilter(e.target.value)} className="rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm">
                  <option value="">All statuses</option>
                  <option value="unverified">Unverified</option>
                  <option value="under_investigation">Under investigation</option>
                  <option value="verified_event">Verified event</option>
                  <option value="discarded">Discarded</option>
                </select>
              </div>
              <div className="mt-4 space-y-3">
                {signals.map((signal) => (
                  <div key={signal.id} className="rounded-xl border border-slate-800 bg-slate-950/70 p-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <div className="flex flex-wrap gap-2">
                          <span className={`inline-flex rounded-full border px-2.5 py-0.5 text-xs ${statusBadge[signal.triageStatus] || statusBadge.unverified}`}>
                            {String(signal.triageStatus || '').replace(/_/g, ' ')}
                          </span>
                          {signal.cdssRiskLevel && (
                            <span className={`inline-flex rounded-full border px-2.5 py-0.5 text-xs ${riskBadge[signal.cdssRiskLevel] || riskBadge.low}`}>
                              {signal.cdssRiskLevel}
                            </span>
                          )}
                        </div>
                        <p className="mt-2 text-sm text-white">{signal.description}</p>
                        <p className="mt-1 text-xs text-slate-400">
                          {signal.signalSource} · {signal.signalType} · {signal.district || 'Unknown district'}
                        </p>
                        {signal.cdssRecommendedAction && (
                          <p className="mt-2 text-sm text-cyan-100">{signal.cdssRecommendedAction}</p>
                        )}
                        {signal.cdssConfidence !== null && signal.cdssConfidence !== undefined && (
                          <p className="mt-1 text-xs text-slate-400">
                            {(Number(signal.cdssConfidence) * 100).toFixed(0)}% confidence
                          </p>
                        )}
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <button type="button" onClick={() => void markSignalStatus(signal.id, 'under_investigation')} className="rounded-lg border border-slate-700 px-3 py-1.5 text-xs text-slate-200 hover:border-slate-600">
                          Investigate
                        </button>
                        <button type="button" onClick={() => void markSignalStatus(signal.id, 'verified_event')} className="rounded-lg border border-emerald-700 px-3 py-1.5 text-xs text-emerald-200 hover:border-emerald-600">
                          Verify
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
                {signals.length === 0 && (
                  <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-4 text-sm text-slate-400">
                    No EBS signals found for this filter.
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {tab === 'ihr' && (
          <div className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
            <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-5">
              <h2 className="text-lg font-semibold text-white">Create IHR Notification</h2>
              <div className="mt-4 grid gap-3 md:grid-cols-2">
                <input value={ihrForm.disease} onChange={(e) => setIhrForm((p) => ({ ...p, disease: e.target.value }))} placeholder="Disease" className="rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm" />
                <input value={ihrForm.affectedCountry} onChange={(e) => setIhrForm((p) => ({ ...p, affectedCountry: e.target.value }))} placeholder="Affected country" className="rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm" />
                <input value={ihrForm.caseCount} onChange={(e) => setIhrForm((p) => ({ ...p, caseCount: e.target.value }))} placeholder="Case count" className="rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm" />
                <input value={ihrForm.deathCount} onChange={(e) => setIhrForm((p) => ({ ...p, deathCount: e.target.value }))} placeholder="Death count" className="rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm" />
                <input value={ihrForm.facilityName} onChange={(e) => setIhrForm((p) => ({ ...p, facilityName: e.target.value }))} placeholder="Facility name" className="rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm" />
                <input value={ihrForm.district} onChange={(e) => setIhrForm((p) => ({ ...p, district: e.target.value }))} placeholder="District" className="rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm" />
                <input value={ihrForm.province} onChange={(e) => setIhrForm((p) => ({ ...p, province: e.target.value }))} placeholder="Province" className="rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm md:col-span-2" />
              </div>
              <div className="mt-4 grid gap-2 md:grid-cols-2">
                {[
                  ['unusualUnexpected', 'Unusual or unexpected'],
                  ['significantPublicHealthImpact', 'Significant public health impact'],
                  ['significantSpread', 'International spread risk'],
                  ['travelTradeRestriction', 'Trade or travel restriction risk'],
                  ['healthcareWorkersAffected', 'Healthcare workers affected'],
                  ['laboratoryConfirmed', 'Laboratory confirmed'],
                ].map(([key, label]) => (
                  <label key={key} className="flex items-center gap-2 rounded-xl border border-slate-800 bg-slate-950/70 px-3 py-2 text-sm text-slate-200">
                    <input type="checkbox" checked={(ihrForm as any)[key]} onChange={(e) => setIhrForm((p) => ({ ...p, [key]: e.target.checked }))} />
                    {label}
                  </label>
                ))}
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                <button type="button" onClick={submitIhr} className="rounded-xl bg-cyan-500 px-4 py-2 text-sm font-semibold text-slate-950 hover:bg-cyan-400">
                  Create Notification
                </button>
                {selectedIhrId && (
                  <button type="button" onClick={() => void runAssessment(selectedIhrId)} className="rounded-xl border border-cyan-500/50 px-4 py-2 text-sm text-cyan-100 hover:border-cyan-400">
                    Run CDSS Annex 2 Assessment
                  </button>
                )}
              </div>
              {selectedAssessment && (
                <div className="mt-4 rounded-xl border border-slate-800 bg-slate-950/70 p-4">
                  {selectedAssessment.abstained && (
                    <div className="mb-3 rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm text-amber-100">
                      CDSS abstained. Manual public-health review is required.
                    </div>
                  )}
                  <div className="grid gap-2 text-sm text-slate-200">
                    <p><span className="font-medium text-white">PHEIC required:</span> {selectedAssessment.pheic_notification_required ? 'Yes' : 'No'}</p>
                    <p><span className="font-medium text-white">Urgency:</span> {selectedAssessment.notification_urgency || 'n/a'}</p>
                    <p><span className="font-medium text-white">Criteria met:</span> {Array.isArray(selectedAssessment.annex2_criteria_met) ? selectedAssessment.annex2_criteria_met.join(', ') : 'None'}</p>
                    {selectedAssessment.confidence !== null && selectedAssessment.confidence !== undefined && (
                      <p className="text-slate-400">{(Number(selectedAssessment.confidence) * 100).toFixed(0)}% confidence</p>
                    )}
                    <textarea readOnly value={selectedAssessment.reporting_template || ''} className="mt-2 min-h-[120px] rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-200" />
                  </div>
                </div>
              )}
            </div>

            <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-5">
              <h2 className="text-lg font-semibold text-white">IHR Queue</h2>
              <div className="mt-4 space-y-3">
                {ihrNotifications.map((item) => (
                  <div key={item.id} className="rounded-xl border border-slate-800 bg-slate-950/70 p-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-medium text-white">{item.disease}</p>
                        <p className="mt-1 text-xs text-slate-400">
                          {item.affectedCountry} · {item.caseCount} cases · {item.deathCount} deaths
                        </p>
                        {item.cdssAnnex2Assessment?.notification_urgency && (
                          <p className="mt-2 text-sm text-cyan-100">
                            {item.cdssAnnex2Assessment.notification_urgency}
                            {item.cdssConfidence !== null && item.cdssConfidence !== undefined
                              ? ` · ${(Number(item.cdssConfidence) * 100).toFixed(0)}% confidence`
                              : ''}
                          </p>
                        )}
                        {item.cdssAnnex2Assessment?.abstained && (
                          <p className="mt-2 text-sm text-amber-200">CDSS abstained. Manual Annex 2 review required.</p>
                        )}
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {!item.notifiedNfp && (
                          <button type="button" onClick={() => void markNotified(item.id, 'notifiedNfp')} className="rounded-lg border border-cyan-500/40 px-3 py-1.5 text-xs text-cyan-100 hover:border-cyan-400">
                            Mark NFP notified
                          </button>
                        )}
                        {!item.notifiedWhoAfro && (
                          <button type="button" onClick={() => void markNotified(item.id, 'notifiedWhoAfro')} className="rounded-lg border border-emerald-500/40 px-3 py-1.5 text-xs text-emerald-100 hover:border-emerald-400">
                            Mark WHO AFRO notified
                          </button>
                        )}
                        <button type="button" onClick={() => void runAssessment(item.id)} className="rounded-lg border border-slate-700 px-3 py-1.5 text-xs text-slate-200 hover:border-slate-600">
                          Re-run assessment
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
                {ihrNotifications.length === 0 && (
                  <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-4 text-sm text-slate-400">
                    No IHR notifications created yet.
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {tab === 'sormas' && (
          <div className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
            <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-5">
              <h2 className="text-lg font-semibold text-white">Case Push Queue</h2>
              <div className="mt-4 space-y-3">
                {caseRows.map((row) => {
                  const log = latestLogByCaseId[row.id];
                  const diseaseLabel =
                    row.sourceTable === 'vhf_cases'
                      ? String(row.pathogen || '').toUpperCase()
                      : row.sourceTable === 'plague_cases'
                        ? 'PLAGUE'
                        : row.sourceTable === 'yellow_fever_cases'
                          ? 'YELLOW_FEVER'
                          : 'CSM';
                  return (
                    <div key={`${row.sourceTable}-${row.id}`} className="rounded-xl border border-slate-800 bg-slate-950/70 p-4">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <div className="flex flex-wrap gap-2">
                            <span className={`inline-flex rounded-full border px-2.5 py-0.5 text-xs ${diseaseBadge[diseaseLabel] || 'border-slate-600 bg-slate-700/60 text-slate-200'}`}>
                              {diseaseLabel.replace(/_/g, ' ')}
                            </span>
                            {log && (
                              <span className={`inline-flex rounded-full border px-2.5 py-0.5 text-xs ${statusBadge[log.syncStatus] || statusBadge.pending}`}>
                                {log.syncStatus}
                              </span>
                            )}
                          </div>
                          <p className="mt-2 text-sm text-white">Case ID: {row.id}</p>
                          <p className="mt-1 text-xs text-slate-400">
                            Source: {row.sourceTable} · Classification: {row.classification || 'n/a'}
                          </p>
                          {log?.errorMessage && (
                            <p className="mt-2 text-sm text-red-200">{log.errorMessage}</p>
                          )}
                        </div>
                        <button type="button" onClick={() => void pushCase(row)} className="rounded-xl bg-cyan-500 px-4 py-2 text-sm font-semibold text-slate-950 hover:bg-cyan-400">
                          Push to SORMAS
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-5">
              <h2 className="text-lg font-semibold text-white">Sync Log</h2>
              <div className="mt-4 space-y-3">
                {sormasLogs.map((log) => (
                  <div key={log.id} className="rounded-xl border border-slate-800 bg-slate-950/70 p-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <div className="flex flex-wrap gap-2">
                          <span className={`inline-flex rounded-full border px-2.5 py-0.5 text-xs ${diseaseBadge[log.sormasDisease] || 'border-slate-600 bg-slate-700/60 text-slate-200'}`}>
                            {String(log.sormasDisease || 'OTHER').replace(/_/g, ' ')}
                          </span>
                          <span className={`inline-flex rounded-full border px-2.5 py-0.5 text-xs ${statusBadge[log.syncStatus] || statusBadge.pending}`}>
                            {log.syncStatus}
                          </span>
                        </div>
                        <p className="mt-2 text-sm text-white">{log.sourceTable} · {log.localCaseId}</p>
                        <p className="mt-1 text-xs text-slate-400">
                          HTTP {log.httpStatusCode || '—'} · retries {log.retryCount || 0}
                        </p>
                        {log.errorMessage && <p className="mt-2 text-sm text-red-200">{log.errorMessage}</p>}
                      </div>
                      {log.syncStatus === 'failed' && (
                        <button type="button" onClick={() => void retrySync(log.id)} className="rounded-lg border border-amber-500/40 px-3 py-1.5 text-xs text-amber-100 hover:border-amber-400">
                          Retry
                        </button>
                      )}
                    </div>
                  </div>
                ))}
                {sormasLogs.length === 0 && (
                  <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-4 text-sm text-slate-400">
                    No SORMAS sync attempts recorded yet.
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {tab === 'summary' && (
          <div className="space-y-6">
            <div className="grid gap-4 md:grid-cols-3">
              <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-5">
                <div className="flex items-center gap-2 text-slate-300">
                  <CloudUpload className="h-4 w-4 text-cyan-300" />
                  SORMAS failed syncs
                </div>
                <p className={`mt-3 text-3xl font-semibold ${(summary?.sormas?.failed || 0) > 0 ? 'text-red-300' : 'text-white'}`}>
                  {summary?.sormas?.failed ?? 0}
                </p>
              </div>
              <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-5">
                <div className="flex items-center gap-2 text-slate-300">
                  <ShieldAlert className="h-4 w-4 text-amber-300" />
                  IHR PHEIC-relevant
                </div>
                <p className="mt-3 text-3xl font-semibold text-white">{summary?.ihr?.pheicRelevant ?? 0}</p>
              </div>
              <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-5">
                <div className="flex items-center gap-2 text-slate-300">
                  <Radar className="h-4 w-4 text-fuchsia-300" />
                  EBS unverified
                </div>
                <p className="mt-3 text-3xl font-semibold text-white">{summary?.ebs?.unverified ?? 0}</p>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-5">
                <p className="text-sm text-slate-300">Total sync attempts</p>
                <p className="mt-2 text-2xl font-semibold text-white">{summary?.sormas?.total ?? 0}</p>
              </div>
              <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-5">
                <p className="text-sm text-slate-300">Total IHR notifications</p>
                <p className="mt-2 text-2xl font-semibold text-white">{summary?.ihr?.total ?? 0}</p>
              </div>
              <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-5">
                <p className="text-sm text-slate-300">Total EBS signals</p>
                <p className="mt-2 text-2xl font-semibold text-white">{summary?.ebs?.total ?? 0}</p>
              </div>
            </div>

            <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-5">
              <h2 className="text-lg font-semibold text-white">Operational Health</h2>
              <div className="mt-4 space-y-3 text-sm text-slate-300">
                <p className="flex items-center gap-2">
                  {(summary?.sormas?.failed || 0) === 0 ? <CheckCircle2 className="h-4 w-4 text-emerald-300" /> : <AlertTriangle className="h-4 w-4 text-red-300" />}
                  SORMAS bridge {(summary?.sormas?.failed || 0) === 0 ? 'looks healthy' : 'has failed syncs that need retry or configuration review'}.
                </p>
                <p className="flex items-center gap-2">
                  <BellRing className="h-4 w-4 text-amber-300" />
                  {summary?.ihr?.pheicRelevant ?? 0} events currently flagged as PHEIC-relevant.
                </p>
                <p className="flex items-center gap-2">
                  <Radar className="h-4 w-4 text-cyan-300" />
                  {summary?.ebs?.unverified ?? 0} community or clinical signals still awaiting verification.
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
