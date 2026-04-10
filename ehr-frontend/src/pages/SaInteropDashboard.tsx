import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Activity,
  ArrowLeft,
  DatabaseZap,
  FileCode2,
  FileJson2,
  FileSearch,
  Link2,
  RefreshCw,
  Send,
} from 'lucide-react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { useNotification } from '../components/GlobalNotification';
import { ehrAxios } from '../services/api';

type TabKey = 'nhls' | 'tierNet' | 'etrNet';

interface SaInteropDashboardProps {
  tenantSlug?: string;
  token?: string;
}

interface NhlsResultRow {
  id: string;
  patientId: string | null;
  nhlsPatientId: string | null;
  nhlsLabNumber: string;
  testLoincCode: string | null;
  testName: string;
  resultValue: string | null;
  resultUnit: string | null;
  referenceRange: string | null;
  abnormalFlag: string | null;
  resultStatus: string | null;
  collectedAt: string | null;
  resultedAt: string | null;
  processed: boolean;
}

interface TierExportRow {
  id: string;
  patientId: string;
  exportDate: string;
  exportType: string;
  exportStatus: string;
  tierNetUid: string | null;
  submittedAt: string | null;
  errorMessage: string | null;
}

interface EtrNotificationRow {
  id: string;
  patientId: string;
  tbCaseId: string | null;
  notificationDate: string;
  exportStatus: string;
  etrReference: string | null;
  errorMessage: string | null;
  submittedAt: string | null;
}

const authHeaders = (token: string, tenantSlug: string) => ({
  Authorization: `Bearer ${token}`,
  'X-Tenant-ID': tenantSlug,
});

const getStoredToken = () => localStorage.getItem('ehr_token') || localStorage.getItem('token') || '';

const apiError = (error: any, fallback: string) =>
  error?.response?.data?.message || error?.message || fallback;

const StatCard: React.FC<{ label: string; value: string | number; icon: React.ReactNode; tone: string }> = ({
  label,
  value,
  icon,
  tone,
}) => (
  <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-4">
    <div className="flex items-center justify-between gap-3">
      <div>
        <p className="text-xs uppercase tracking-wide text-slate-400">{label}</p>
        <p className="mt-2 text-2xl font-semibold text-white">{value}</p>
      </div>
      <div className={`rounded-xl p-3 ${tone}`}>{icon}</div>
    </div>
  </div>
);

const TabButton: React.FC<{
  active: boolean;
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
}> = ({ active, icon, label, onClick }) => (
  <button
    type="button"
    onClick={onClick}
    className={`inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-sm font-medium transition ${
      active
        ? 'border-cyan-600 bg-cyan-500/10 text-cyan-200'
        : 'border-slate-800 bg-slate-900/80 text-slate-300 hover:border-slate-700 hover:text-white'
    }`}
  >
    {icon}
    {label}
  </button>
);

const SaInteropDashboard: React.FC<SaInteropDashboardProps> = ({ tenantSlug: tenantSlugProp, token: tokenProp }) => {
  const params = useParams<{ tenantSlug: string }>();
  const tenantSlug = tenantSlugProp || params.tenantSlug || '';
  const token = tokenProp || getStoredToken();
  const navigate = useNavigate();
  const { showError, showSuccess } = useNotification();

  const [tab, setTab] = useState<TabKey>('nhls');
  const [loading, setLoading] = useState(false);
  const [pendingResults, setPendingResults] = useState<NhlsResultRow[]>([]);
  const [patientResults, setPatientResults] = useState<NhlsResultRow[]>([]);
  const [tierExports, setTierExports] = useState<TierExportRow[]>([]);
  const [etrNotifications, setEtrNotifications] = useState<EtrNotificationRow[]>([]);
  const [linkPatientIds, setLinkPatientIds] = useState<Record<string, string>>({});
  const [patientSearchId, setPatientSearchId] = useState('');
  const [hl7Input, setHl7Input] = useState('');
  const [tierPatientId, setTierPatientId] = useState('');
  const [tbCaseId, setTbCaseId] = useState('');
  const [lastIngestCount, setLastIngestCount] = useState<number | null>(null);

  const headers = useMemo(() => authHeaders(token, tenantSlug), [token, tenantSlug]);

  const loadPendingResults = useCallback(async () => {
    if (!tenantSlug || !token) return;
    const { data } = await ehrAxios.get('/nhls/results/pending', { headers });
    setPendingResults(Array.isArray(data) ? data : []);
  }, [headers, tenantSlug, token]);

  const loadTierExports = useCallback(async () => {
    if (!tenantSlug || !token) return;
    const { data } = await ehrAxios.get('/tier-net/exports', { headers });
    setTierExports(Array.isArray(data) ? data : []);
  }, [headers, tenantSlug, token]);

  const loadEtrNotifications = useCallback(async () => {
    if (!tenantSlug || !token) return;
    const { data } = await ehrAxios.get('/etr-net/notifications', { headers });
    setEtrNotifications(Array.isArray(data) ? data : []);
  }, [headers, tenantSlug, token]);

  const loadPatientResults = useCallback(async () => {
    if (!tenantSlug || !token || !patientSearchId.trim()) {
      setPatientResults([]);
      return;
    }
    const { data } = await ehrAxios.get(`/nhls/results/${patientSearchId.trim()}`, { headers });
    setPatientResults(Array.isArray(data) ? data : []);
  }, [headers, patientSearchId, tenantSlug, token]);

  const refreshAll = useCallback(async () => {
    if (!tenantSlug || !token) return;
    setLoading(true);
    try {
      await Promise.all([loadPendingResults(), loadTierExports(), loadEtrNotifications()]);
      if (patientSearchId.trim()) {
        await loadPatientResults();
      }
    } catch (error: any) {
      showError('Refresh failed', apiError(error, 'Unable to load SA interop data.'));
    } finally {
      setLoading(false);
    }
  }, [loadEtrNotifications, loadPatientResults, loadPendingResults, loadTierExports, patientSearchId, showError, tenantSlug, token]);

  useEffect(() => {
    void refreshAll();
  }, [refreshAll]);

  const chartData = useMemo(
    () => [
      { name: 'Unlinked NHLS', value: pendingResults.length },
      { name: 'TIER Exports', value: tierExports.length },
      { name: 'ETR Notices', value: etrNotifications.length },
    ],
    [pendingResults.length, tierExports.length, etrNotifications.length],
  );

  const abnormalPatientResults = useMemo(
    () => patientResults.filter((row) => ['H', 'HH', 'L', 'LL', 'A'].includes(String(row.abnormalFlag || '').toUpperCase())).length,
    [patientResults],
  );

  const handleManualIngest = async () => {
    if (!hl7Input.trim()) {
      showError('HL7 required', 'Paste a valid NHLS HL7 ORU message before ingesting.');
      return;
    }

    try {
      const { data } = await ehrAxios.post('/nhls/hl7/ingest', { hl7: hl7Input }, { headers });
      const count = Array.isArray(data) ? data.length : 0;
      setLastIngestCount(count);
      showSuccess('HL7 ingested', `Parsed and stored ${count} NHLS result row(s).`);
      setHl7Input('');
      await loadPendingResults();
    } catch (error: any) {
      showError('HL7 ingest failed', apiError(error, 'Unable to ingest NHLS HL7 payload.'));
    }
  };

  const handleLinkResult = async (resultId: string) => {
    const patientId = (linkPatientIds[resultId] || '').trim();
    if (!patientId) {
      showError('Patient required', 'Enter a patient ID before linking this NHLS result.');
      return;
    }

    try {
      await ehrAxios.patch(`/nhls/results/${resultId}/link`, { patientId }, { headers });
      showSuccess('Result linked', 'The NHLS result is now linked to the selected patient.');
      setLinkPatientIds((current) => ({ ...current, [resultId]: '' }));
      await Promise.all([loadPendingResults(), patientSearchId.trim() ? loadPatientResults() : Promise.resolve()]);
    } catch (error: any) {
      showError('Link failed', apiError(error, 'Unable to link NHLS result to patient.'));
    }
  };

  const handleExportPatient = async () => {
    if (!tierPatientId.trim()) {
      showError('Patient required', 'Enter a patient ID to generate a TIER.net export.');
      return;
    }

    try {
      await ehrAxios.post(`/tier-net/export/${tierPatientId.trim()}`, {}, { headers });
      showSuccess('Export queued', 'The TIER.net patient export has been generated and stored.');
      setTierPatientId('');
      await loadTierExports();
    } catch (error: any) {
      showError('Export failed', apiError(error, 'Unable to generate the TIER.net export.'));
    }
  };

  const handleBatchExport = async () => {
    try {
      const { data } = await ehrAxios.post('/tier-net/export/batch', {}, { headers });
      showSuccess('Batch export started', `Queued ${Number(data?.queued || 0)} ART patient export(s).`);
      await loadTierExports();
    } catch (error: any) {
      showError('Batch export failed', apiError(error, 'Unable to queue TIER.net batch exports.'));
    }
  };

  const handleDownloadExport = async (exportId: string) => {
    try {
      const { data } = await ehrAxios.get(`/tier-net/exports/${exportId}/download`, { headers });
      const xml = data?.xml || '';
      const blob = new Blob([xml], { type: 'application/xml;charset=utf-8' });
      const href = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = href;
      anchor.download = `tier-net-export-${exportId}.xml`;
      anchor.click();
      URL.revokeObjectURL(href);
      showSuccess('Download ready', 'The TIER.net XML export has been downloaded.');
    } catch (error: any) {
      showError('Download failed', apiError(error, 'Unable to download the TIER.net XML export.'));
    }
  };

  const handleNotifyCase = async () => {
    if (!tbCaseId.trim()) {
      showError('TB case required', 'Enter a TB case ID before notifying ETR.net.');
      return;
    }

    try {
      const { data } = await ehrAxios.post(`/etr-net/notify/${tbCaseId.trim()}`, {}, { headers });
      if (data?.exportStatus === 'submitted') {
        showSuccess('Notification submitted', 'ETR.net notification was sent successfully.');
      } else {
        showError('Notification failed', data?.errorMessage || 'ETR.net notification was saved as failed.');
      }
      setTbCaseId('');
      await loadEtrNotifications();
    } catch (error: any) {
      showError('Notify failed', apiError(error, 'Unable to notify ETR.net.'));
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <div className="mx-auto flex max-w-7xl flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <button
              type="button"
              onClick={() => navigate(`/ehr/${tenantSlug}/dashboard`)}
              className="mb-3 inline-flex items-center gap-2 rounded-xl border border-slate-800 bg-slate-900/80 px-3 py-2 text-sm text-slate-300 transition hover:border-slate-700 hover:text-white"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to dashboard
            </button>
            <h1 className="text-3xl font-semibold tracking-tight text-white">SA National Interop</h1>
            <p className="mt-2 max-w-3xl text-sm text-slate-400">
              NHLS lab ingestion, TIER.net HIV exports, and ETR.net TB case notifications from live tenant data.
            </p>
          </div>

          <button
            type="button"
            onClick={() => void refreshAll()}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-800 bg-slate-900/80 px-4 py-2 text-sm font-medium text-slate-200 transition hover:border-slate-700 hover:text-white"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>

        <div className="grid gap-4 md:grid-cols-4">
          <StatCard
            label="Unlinked NHLS"
            value={pendingResults.length}
            icon={<FileSearch className="h-5 w-5 text-cyan-200" />}
            tone="bg-cyan-500/10"
          />
          <StatCard
            label="Patient NHLS Results"
            value={patientResults.length}
            icon={<Activity className="h-5 w-5 text-amber-200" />}
            tone="bg-amber-500/10"
          />
          <StatCard
            label="TIER Exports"
            value={tierExports.length}
            icon={<FileCode2 className="h-5 w-5 text-emerald-200" />}
            tone="bg-emerald-500/10"
          />
          <StatCard
            label="ETR Notices"
            value={etrNotifications.length}
            icon={<FileJson2 className="h-5 w-5 text-fuchsia-200" />}
            tone="bg-fuchsia-500/10"
          />
        </div>

        <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-4">
          <div className="mb-4 flex flex-wrap gap-2">
            <TabButton active={tab === 'nhls'} icon={<DatabaseZap className="h-4 w-4" />} label="NHLS Results" onClick={() => setTab('nhls')} />
            <TabButton active={tab === 'tierNet'} icon={<FileCode2 className="h-4 w-4" />} label="TIER.net" onClick={() => setTab('tierNet')} />
            <TabButton active={tab === 'etrNet'} icon={<FileJson2 className="h-4 w-4" />} label="ETR.net" onClick={() => setTab('etrNet')} />
          </div>

          <div className="mb-6 h-72 rounded-2xl border border-slate-800 bg-slate-950/60 p-3">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                <XAxis dataKey="name" stroke="#94a3b8" />
                <YAxis stroke="#94a3b8" allowDecimals={false} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#020617', border: '1px solid #334155', borderRadius: 12 }}
                  labelStyle={{ color: '#e2e8f0' }}
                />
                <Bar dataKey="value" fill="#06b6d4" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {tab === 'nhls' && (
            <div className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
              <div className="space-y-6">
                <section className="rounded-2xl border border-slate-800 bg-slate-950/60 p-4">
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <div>
                      <h2 className="text-lg font-semibold text-white">Unlinked Results</h2>
                      <p className="text-sm text-slate-400">Results waiting for manual patient matching.</p>
                    </div>
                    <span className="rounded-full border border-slate-700 px-3 py-1 text-xs text-slate-300">
                      {pendingResults.length} pending
                    </span>
                  </div>
                  <div className="space-y-3">
                    {pendingResults.length === 0 && (
                      <div className="rounded-xl border border-slate-800 bg-slate-900/60 px-4 py-3 text-sm text-slate-400">
                        No unlinked NHLS results found.
                      </div>
                    )}
                    {pendingResults.map((row) => (
                      <div key={row.id} className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
                        <div className="grid gap-3 lg:grid-cols-[1fr_auto]">
                          <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                            <div>
                              <p className="text-xs uppercase tracking-wide text-slate-500">Lab number</p>
                              <p className="text-sm font-medium text-white">{row.nhlsLabNumber}</p>
                            </div>
                            <div>
                              <p className="text-xs uppercase tracking-wide text-slate-500">Test</p>
                              <p className="text-sm font-medium text-white">{row.testName}</p>
                            </div>
                            <div>
                              <p className="text-xs uppercase tracking-wide text-slate-500">Result</p>
                              <p className="text-sm font-medium text-white">
                                {row.resultValue || 'N/A'} {row.resultUnit || ''}
                              </p>
                            </div>
                            <div>
                              <p className="text-xs uppercase tracking-wide text-slate-500">Flag</p>
                              <p className="text-sm font-medium text-amber-300">{row.abnormalFlag || 'Normal'}</p>
                            </div>
                            <div>
                              <p className="text-xs uppercase tracking-wide text-slate-500">Resulted</p>
                              <p className="text-sm font-medium text-white">{row.resultedAt ? new Date(row.resultedAt).toLocaleString() : 'N/A'}</p>
                            </div>
                            <div>
                              <p className="text-xs uppercase tracking-wide text-slate-500">NHLS patient ID</p>
                              <p className="text-sm font-medium text-white">{row.nhlsPatientId || 'N/A'}</p>
                            </div>
                          </div>
                          <div className="flex min-w-[230px] flex-col gap-2">
                            <input
                              value={linkPatientIds[row.id] || ''}
                              onChange={(event) =>
                                setLinkPatientIds((current) => ({ ...current, [row.id]: event.target.value }))
                              }
                              placeholder="Enter patient ID"
                              className="rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white outline-none focus:border-cyan-500"
                            />
                            <button
                              type="button"
                              onClick={() => void handleLinkResult(row.id)}
                              className="inline-flex items-center justify-center gap-2 rounded-xl bg-cyan-500 px-3 py-2 text-sm font-medium text-slate-950 transition hover:bg-cyan-400"
                            >
                              <Link2 className="h-4 w-4" />
                              Link to Patient
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </section>

                <section className="rounded-2xl border border-slate-800 bg-slate-950/60 p-4">
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <div>
                      <h2 className="text-lg font-semibold text-white">Patient NHLS Results</h2>
                      <p className="text-sm text-slate-400">Search a patient ID to review linked NHLS results.</p>
                    </div>
                    <span className="rounded-full border border-slate-700 px-3 py-1 text-xs text-slate-300">
                      {abnormalPatientResults} abnormal
                    </span>
                  </div>
                  <div className="mb-4 flex flex-col gap-3 sm:flex-row">
                    <input
                      value={patientSearchId}
                      onChange={(event) => setPatientSearchId(event.target.value)}
                      placeholder="Search patient ID"
                      className="flex-1 rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white outline-none focus:border-cyan-500"
                    />
                    <button
                      type="button"
                      onClick={() => void loadPatientResults()}
                      className="rounded-xl border border-slate-700 px-4 py-2 text-sm font-medium text-slate-200 transition hover:border-slate-600 hover:text-white"
                    >
                      Search
                    </button>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="min-w-full text-sm">
                      <thead className="text-left text-slate-400">
                        <tr>
                          <th className="pb-2 pr-4">Resulted</th>
                          <th className="pb-2 pr-4">Lab #</th>
                          <th className="pb-2 pr-4">Test</th>
                          <th className="pb-2 pr-4">Value</th>
                          <th className="pb-2 pr-4">Range</th>
                          <th className="pb-2 pr-4">Flag</th>
                        </tr>
                      </thead>
                      <tbody>
                        {patientResults.map((row) => (
                          <tr key={row.id} className="border-t border-slate-800">
                            <td className="py-3 pr-4 text-slate-300">{row.resultedAt ? new Date(row.resultedAt).toLocaleDateString() : 'N/A'}</td>
                            <td className="py-3 pr-4 text-white">{row.nhlsLabNumber}</td>
                            <td className="py-3 pr-4 text-white">{row.testName}</td>
                            <td className="py-3 pr-4 text-white">{row.resultValue || 'N/A'} {row.resultUnit || ''}</td>
                            <td className="py-3 pr-4 text-slate-300">{row.referenceRange || 'N/A'}</td>
                            <td className="py-3 pr-4">
                              <span className={`rounded-full px-2 py-1 text-xs font-medium ${
                                row.abnormalFlag ? 'bg-amber-500/15 text-amber-300' : 'bg-emerald-500/15 text-emerald-300'
                              }`}>
                                {row.abnormalFlag || 'Normal'}
                              </span>
                            </td>
                          </tr>
                        ))}
                        {patientResults.length === 0 && (
                          <tr>
                            <td colSpan={6} className="py-4 text-center text-slate-500">
                              No patient NHLS results loaded.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </section>
              </div>

              <section className="rounded-2xl border border-slate-800 bg-slate-950/60 p-4">
                <h2 className="text-lg font-semibold text-white">Manual HL7 Ingest</h2>
                <p className="mt-1 text-sm text-slate-400">Paste raw NHLS ORU HL7 and store one result row per OBX segment.</p>
                <textarea
                  value={hl7Input}
                  onChange={(event) => setHl7Input(event.target.value)}
                  placeholder="Paste raw HL7 ORU^R01 message here"
                  rows={16}
                  className="mt-4 w-full rounded-2xl border border-slate-700 bg-slate-950 px-3 py-3 text-sm text-white outline-none focus:border-cyan-500"
                />
                <button
                  type="button"
                  onClick={() => void handleManualIngest()}
                  className="mt-4 inline-flex items-center gap-2 rounded-xl bg-cyan-500 px-4 py-2.5 text-sm font-medium text-slate-950 transition hover:bg-cyan-400"
                >
                  <Send className="h-4 w-4" />
                  Ingest HL7
                </button>
                {lastIngestCount !== null && (
                  <p className="mt-3 text-sm text-slate-300">Last ingest stored {lastIngestCount} parsed result row(s).</p>
                )}
              </section>
            </div>
          )}

          {tab === 'tierNet' && (
            <div className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
              <section className="rounded-2xl border border-slate-800 bg-slate-950/60 p-4">
                <h2 className="text-lg font-semibold text-white">Generate Exports</h2>
                <p className="mt-1 text-sm text-slate-400">Build TIER.net v2 XML from real HIV enrollment and visit data.</p>
                <div className="mt-4 space-y-3">
                  <input
                    value={tierPatientId}
                    onChange={(event) => setTierPatientId(event.target.value)}
                    placeholder="Patient ID"
                    className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white outline-none focus:border-cyan-500"
                  />
                  <button
                    type="button"
                    onClick={() => void handleExportPatient()}
                    className="inline-flex items-center gap-2 rounded-xl bg-emerald-500 px-4 py-2.5 text-sm font-medium text-slate-950 transition hover:bg-emerald-400"
                  >
                    <FileCode2 className="h-4 w-4" />
                    Export Patient
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleBatchExport()}
                    className="inline-flex items-center gap-2 rounded-xl border border-slate-700 px-4 py-2.5 text-sm font-medium text-slate-200 transition hover:border-slate-600 hover:text-white"
                  >
                    <RefreshCw className="h-4 w-4" />
                    Batch Export All ART Patients
                  </button>
                </div>
              </section>

              <section className="rounded-2xl border border-slate-800 bg-slate-950/60 p-4">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <div>
                    <h2 className="text-lg font-semibold text-white">Export History</h2>
                    <p className="text-sm text-slate-400">Latest stored TIER.net XML exports.</p>
                  </div>
                  <span className="rounded-full border border-slate-700 px-3 py-1 text-xs text-slate-300">
                    {tierExports.length} exports
                  </span>
                </div>
                <div className="overflow-x-auto">
                  <table className="min-w-full text-sm">
                    <thead className="text-left text-slate-400">
                      <tr>
                        <th className="pb-2 pr-4">Patient</th>
                        <th className="pb-2 pr-4">Export Date</th>
                        <th className="pb-2 pr-4">Type</th>
                        <th className="pb-2 pr-4">Status</th>
                        <th className="pb-2 pr-4">Submitted</th>
                        <th className="pb-2 pr-4">Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {tierExports.map((row) => (
                        <tr key={row.id} className="border-t border-slate-800">
                          <td className="py-3 pr-4 text-white">{row.patientId}</td>
                          <td className="py-3 pr-4 text-slate-300">{row.exportDate}</td>
                          <td className="py-3 pr-4 text-slate-300">{row.exportType}</td>
                          <td className="py-3 pr-4 text-slate-300">{row.exportStatus}</td>
                          <td className="py-3 pr-4 text-slate-300">{row.submittedAt ? new Date(row.submittedAt).toLocaleString() : 'N/A'}</td>
                          <td className="py-3 pr-4">
                            <button
                              type="button"
                              onClick={() => void handleDownloadExport(row.id)}
                              className="rounded-lg border border-slate-700 px-3 py-1.5 text-xs font-medium text-slate-200 transition hover:border-slate-600 hover:text-white"
                            >
                              Download XML
                            </button>
                          </td>
                        </tr>
                      ))}
                      {tierExports.length === 0 && (
                        <tr>
                          <td colSpan={6} className="py-4 text-center text-slate-500">
                            No TIER.net exports found.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </section>
            </div>
          )}

          {tab === 'etrNet' && (
            <div className="grid gap-6 xl:grid-cols-[0.85fr_1.15fr]">
              <section className="rounded-2xl border border-slate-800 bg-slate-950/60 p-4">
                <h2 className="text-lg font-semibold text-white">Notify TB Case</h2>
                <p className="mt-1 text-sm text-slate-400">Submit a live ETR.net notification or store a real failed record if unreachable.</p>
                <div className="mt-4 space-y-3">
                  <input
                    value={tbCaseId}
                    onChange={(event) => setTbCaseId(event.target.value)}
                    placeholder="TB Case ID"
                    className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white outline-none focus:border-cyan-500"
                  />
                  <button
                    type="button"
                    onClick={() => void handleNotifyCase()}
                    className="inline-flex items-center gap-2 rounded-xl bg-fuchsia-500 px-4 py-2.5 text-sm font-medium text-slate-950 transition hover:bg-fuchsia-400"
                  >
                    <Send className="h-4 w-4" />
                    Notify Case
                  </button>
                </div>
              </section>

              <section className="rounded-2xl border border-slate-800 bg-slate-950/60 p-4">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <div>
                    <h2 className="text-lg font-semibold text-white">Notification History</h2>
                    <p className="text-sm text-slate-400">Latest ETR.net notification attempts and outcomes.</p>
                  </div>
                  <span className="rounded-full border border-slate-700 px-3 py-1 text-xs text-slate-300">
                    {etrNotifications.length} records
                  </span>
                </div>
                <div className="overflow-x-auto">
                  <table className="min-w-full text-sm">
                    <thead className="text-left text-slate-400">
                      <tr>
                        <th className="pb-2 pr-4">TB Case</th>
                        <th className="pb-2 pr-4">Date</th>
                        <th className="pb-2 pr-4">Reference</th>
                        <th className="pb-2 pr-4">Status</th>
                        <th className="pb-2 pr-4">Error</th>
                      </tr>
                    </thead>
                    <tbody>
                      {etrNotifications.map((row) => (
                        <tr key={row.id} className="border-t border-slate-800">
                          <td className="py-3 pr-4 text-white">{row.tbCaseId || 'N/A'}</td>
                          <td className="py-3 pr-4 text-slate-300">{row.notificationDate}</td>
                          <td className="py-3 pr-4 text-slate-300">{row.etrReference || 'N/A'}</td>
                          <td className="py-3 pr-4 text-slate-300">{row.exportStatus}</td>
                          <td className="py-3 pr-4 text-rose-300">{row.errorMessage || 'None'}</td>
                        </tr>
                      ))}
                      {etrNotifications.length === 0 && (
                        <tr>
                          <td colSpan={5} className="py-4 text-center text-slate-500">
                            No ETR.net notifications found.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </section>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default SaInteropDashboard;
