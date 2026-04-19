import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Activity, ArrowLeft, FileSymlink, Link2, RefreshCw, ShieldAlert, TestTube } from 'lucide-react';
import { interopApi } from '../services/api';
import { useNotification } from './GlobalNotification';

type TabKey = 'disa' | 'smartcare' | 'cross-border';

interface InteropDashboardProps {
  tenantSlug?: string;
  token?: string;
}

interface DisaRow {
  id: string;
  sampleId?: string | null;
  sampleCollectionDate?: string | null;
  resultValue?: string | null;
  resultNumeric?: number | null;
  suppressed?: boolean | null;
  syncStatus?: string;
}

interface SmartcareLinkRow {
  id: string;
  localPatientId: string;
  smartcarePatientUuid: string;
  artStartDate?: string | null;
  lastRegimen?: string | null;
  lastVl?: number | null;
  lastVlDate?: string | null;
  syncStatus?: string;
  importError?: string | null;
}

interface CrossBorderFlagRow {
  id: string;
  patientId: string;
  originCountry: string;
  currentCountry: string;
  crossBorderReason?: string | null;
  foreignFacility?: string | null;
  lastForeignVisitDate?: string | null;
  continuityGapDetected?: boolean;
}

const getStoredToken = () => localStorage.getItem('ehr_token') || localStorage.getItem('token') || '';

const apiError = (error: any, fallback: string) =>
  error?.response?.data?.message || error?.message || fallback;

const badgeClass = (value: string) => {
  const normalized = String(value || '').toLowerCase();
  if (normalized.includes('high') || normalized.includes('failed')) return 'border-red-500/30 bg-red-500/15 text-red-200';
  if (normalized.includes('moderate') || normalized.includes('pending')) return 'border-amber-500/30 bg-amber-500/15 text-amber-200';
  if (normalized.includes('success') || normalized.includes('linked') || normalized.includes('none') || normalized.includes('low')) {
    return 'border-emerald-500/30 bg-emerald-500/15 text-emerald-200';
  }
  return 'border-slate-700 bg-slate-800 text-slate-200';
};

const TabButton: React.FC<{ active: boolean; icon: React.ReactNode; label: string; onClick: () => void }> = ({
  active,
  icon,
  label,
  onClick,
}) => (
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

const InteropDashboard: React.FC<InteropDashboardProps> = ({ tenantSlug: tenantSlugProp, token: tokenProp }) => {
  const params = useParams<{ tenantSlug: string }>();
  const tenantSlug = tenantSlugProp || params.tenantSlug || '';
  const token = tokenProp || getStoredToken();
  const navigate = useNavigate();
  const { showError, showSuccess } = useNotification();

  const [tab, setTab] = useState<TabKey>('disa');
  const [loading, setLoading] = useState(false);
  const [summary, setSummary] = useState<any>(null);
  const [disaRows, setDisaRows] = useState<DisaRow[]>([]);
  const [smartcareLink, setSmartcareLink] = useState<SmartcareLinkRow | null>(null);
  const [crossBorderFlags, setCrossBorderFlags] = useState<CrossBorderFlagRow[]>([]);
  const [continuityByPatient, setContinuityByPatient] = useState<Record<string, any>>({});

  const [disaForm, setDisaForm] = useState({ nid: '', patientId: '' });
  const [historyPatientId, setHistoryPatientId] = useState('');
  const [smartcareForm, setSmartcareForm] = useState({ localPatientId: '', smartcareUuid: '', artNumber: '' });
  const [crossBorderForm, setCrossBorderForm] = useState({
    patientId: '',
    originCountry: 'ZM',
    currentCountry: 'MZ',
    crossBorderReason: 'labour_migration',
    foreignArtNumber: '',
    foreignFacility: '',
    lastForeignVisitDate: '',
  });

  const canLoad = Boolean(tenantSlug && token);

  const loadSummary = useCallback(async () => {
    if (!canLoad) return;
    const data = await interopApi.getInteropSummary(token, tenantSlug);
    setSummary(data || null);
    setCrossBorderFlags(Array.isArray(data?.recentCrossBorderFlags) ? data.recentCrossBorderFlags : []);
  }, [canLoad, tenantSlug, token]);

  useEffect(() => {
    const run = async () => {
      if (!canLoad) return;
      setLoading(true);
      try {
        await loadSummary();
      } catch (error: any) {
        showError('Refresh failed', apiError(error, 'Unable to load interop data.'));
      } finally {
        setLoading(false);
      }
    };
    void run();
  }, [canLoad, loadSummary, showError]);

  const cards = useMemo(
    () => [
      { label: 'DISA Syncs', value: Number(summary?.disa?.total || 0) },
      { label: 'DISA Success', value: Number(summary?.disa?.success || 0) },
      { label: 'SmartCare Links', value: Number(summary?.smartcareLinks || 0) },
      { label: 'Cross-Border Flags', value: Number(summary?.crossBorderPatients || 0) },
    ],
    [summary],
  );

  const handlePullDisa = async () => {
    if (!disaForm.nid.trim()) {
      showError('Missing NID', 'Enter a Mozambique NID / NUIC before pulling DISA results.');
      return;
    }
    try {
      const data = await interopApi.pullDisaVl(disaForm, token, tenantSlug);
      setDisaRows(Array.isArray(data) ? data : []);
      showSuccess('DISA sync complete', `Retrieved ${Array.isArray(data) ? data.length : 0} result row(s).`);
      await loadSummary();
    } catch (error: any) {
      showError('DISA pull failed', apiError(error, 'Unable to pull DISA viral load results.'));
    }
  };

  const handleLoadHistory = async () => {
    if (!historyPatientId.trim()) {
      showError('Missing patient ID', 'Enter a local patient ID to load DISA history.');
      return;
    }
    try {
      const data = await interopApi.getDisaHistory(historyPatientId, token, tenantSlug);
      setDisaRows(Array.isArray(data) ? data : []);
    } catch (error: any) {
      showError('History load failed', apiError(error, 'Unable to load DISA history.'));
    }
  };

  const handleLinkSmartcare = async () => {
    if (!smartcareForm.localPatientId.trim() || !smartcareForm.smartcareUuid.trim()) {
      showError('Missing fields', 'Local patient ID and SmartCare UUID are required.');
      return;
    }
    try {
      const data = await interopApi.linkSmartcare(smartcareForm, token, tenantSlug);
      setSmartcareLink(data || null);
      showSuccess('SmartCare linked', 'Patient link saved and import attempted.');
      await loadSummary();
    } catch (error: any) {
      showError('Link failed', apiError(error, 'Unable to link the SmartCare patient.'));
    }
  };

  const handleLoadSmartcare = async () => {
    if (!smartcareForm.localPatientId.trim()) {
      showError('Missing patient ID', 'Enter a local patient ID to load the SmartCare link.');
      return;
    }
    try {
      const data = await interopApi.getSmartcareLink(smartcareForm.localPatientId, token, tenantSlug);
      setSmartcareLink(data || null);
    } catch (error: any) {
      showError('Lookup failed', apiError(error, 'Unable to fetch the SmartCare link.'));
    }
  };

  const handleFlagCrossBorder = async () => {
    if (!crossBorderForm.patientId.trim()) {
      showError('Missing patient ID', 'Local patient ID is required.');
      return;
    }
    try {
      await interopApi.flagCrossBorder(crossBorderForm, token, tenantSlug);
      showSuccess('Patient flagged', 'Cross-border continuity tracking has been saved.');
      await loadSummary();
    } catch (error: any) {
      showError('Flagging failed', apiError(error, 'Unable to save the cross-border flag.'));
    }
  };

  const handleAssessContinuity = async (patientId: string) => {
    try {
      const data = await interopApi.assessContinuity(patientId, token, tenantSlug);
      setContinuityByPatient((current) => ({ ...current, [patientId]: data }));
      showSuccess('Assessment ready', 'Continuity assessment completed.');
      await loadSummary();
    } catch (error: any) {
      showError('Assessment failed', apiError(error, 'Unable to assess cross-border continuity.'));
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 px-4 py-6 text-slate-100 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <div className="flex flex-col gap-4 rounded-3xl border border-slate-800 bg-slate-900/80 p-6 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <button
              type="button"
              onClick={() => navigate(`/ehr/${tenantSlug}`)}
              className="mb-4 inline-flex items-center gap-2 rounded-lg border border-slate-800 px-3 py-2 text-sm text-slate-300 hover:text-white"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to EHR
            </button>
            <h1 className="text-3xl font-semibold text-white">DISA + SmartCare Interop</h1>
            <p className="mt-2 max-w-3xl text-sm text-slate-400">
              Mozambique DISA viral load pull, Zambia SmartCare patient linking, and cross-border ART continuity support.
            </p>
          </div>
          <button
            type="button"
            onClick={() => void loadSummary()}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-700 bg-slate-950 px-4 py-2 text-sm font-medium text-slate-200 hover:border-slate-600"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {cards.map((card) => (
            <div key={card.label} className="rounded-2xl border border-slate-800 bg-slate-900/80 p-5">
              <div className="text-sm text-slate-400">{card.label}</div>
              <div className="mt-2 text-3xl font-semibold text-white">{card.value}</div>
            </div>
          ))}
        </div>

        <div className="flex flex-wrap gap-3">
          <TabButton active={tab === 'disa'} icon={<TestTube className="h-4 w-4" />} label="DISA (Mozambique VL)" onClick={() => setTab('disa')} />
          <TabButton active={tab === 'smartcare'} icon={<Link2 className="h-4 w-4" />} label="SmartCare (Zambia ART)" onClick={() => setTab('smartcare')} />
          <TabButton active={tab === 'cross-border'} icon={<ShieldAlert className="h-4 w-4" />} label="Cross-Border Patients" onClick={() => setTab('cross-border')} />
        </div>

        {tab === 'disa' && (
          <div className="grid gap-6 xl:grid-cols-[360px_minmax(0,1fr)]">
            <div className="rounded-3xl border border-slate-800 bg-slate-900/80 p-6">
              <h2 className="text-lg font-semibold text-white">DISA Viral Load Pull</h2>
              <div className="mt-4 space-y-3">
                <input className="w-full rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 text-sm" placeholder="Mozambique NID / NUIC" value={disaForm.nid} onChange={(e) => setDisaForm((c) => ({ ...c, nid: e.target.value }))} />
                <input className="w-full rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 text-sm" placeholder="Local patient ID (optional)" value={disaForm.patientId} onChange={(e) => setDisaForm((c) => ({ ...c, patientId: e.target.value }))} />
                <button type="button" onClick={() => void handlePullDisa()} className="w-full rounded-xl bg-cyan-500 px-4 py-2.5 text-sm font-semibold text-slate-950 hover:bg-cyan-400">
                  Pull Results
                </button>
              </div>
              <div className="mt-6 border-t border-slate-800 pt-6">
                <h3 className="text-sm font-semibold text-slate-200">History Lookup</h3>
                <div className="mt-3 flex gap-2">
                  <input className="flex-1 rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 text-sm" placeholder="Local patient ID" value={historyPatientId} onChange={(e) => setHistoryPatientId(e.target.value)} />
                  <button type="button" onClick={() => void handleLoadHistory()} className="rounded-xl border border-slate-700 px-4 py-2 text-sm text-slate-200 hover:border-slate-600">
                    Load
                  </button>
                </div>
              </div>
            </div>
            <div className="rounded-3xl border border-slate-800 bg-slate-900/80 p-6">
              <h2 className="text-lg font-semibold text-white">Results</h2>
              <div className="mt-4 overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead className="text-left text-slate-400">
                    <tr>
                      <th className="px-3 py-2">Sample ID</th>
                      <th className="px-3 py-2">Collection Date</th>
                      <th className="px-3 py-2">VL Result</th>
                      <th className="px-3 py-2">Suppressed</th>
                      <th className="px-3 py-2">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {disaRows.map((row) => (
                      <tr key={row.id} className="border-t border-slate-800">
                        <td className="px-3 py-2 text-white">{row.sampleId || 'N/A'}</td>
                        <td className="px-3 py-2">{row.sampleCollectionDate || 'N/A'}</td>
                        <td className="px-3 py-2">{row.resultValue || row.resultNumeric || 'N/A'}</td>
                        <td className="px-3 py-2">
                          {row.suppressed === null || row.suppressed === undefined ? 'Unknown' : (
                            <span className={`inline-flex rounded-full border px-2 py-1 text-xs ${row.suppressed ? 'border-emerald-500/30 bg-emerald-500/15 text-emerald-200' : 'border-red-500/30 bg-red-500/15 text-red-200'}`}>
                              {row.suppressed ? 'Suppressed' : 'Unsuppressed'}
                            </span>
                          )}
                        </td>
                        <td className="px-3 py-2">
                          <span className={`inline-flex rounded-full border px-2 py-1 text-xs ${badgeClass(row.syncStatus || 'pending')}`}>
                            {row.syncStatus || 'pending'}
                          </span>
                        </td>
                      </tr>
                    ))}
                    {!disaRows.length && (
                      <tr>
                        <td colSpan={5} className="px-3 py-8 text-center text-slate-500">No DISA results loaded yet.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {tab === 'smartcare' && (
          <div className="grid gap-6 xl:grid-cols-[360px_minmax(0,1fr)]">
            <div className="rounded-3xl border border-slate-800 bg-slate-900/80 p-6">
              <h2 className="text-lg font-semibold text-white">SmartCare Link</h2>
              <div className="mt-4 space-y-3">
                <input className="w-full rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 text-sm" placeholder="Local patient ID" value={smartcareForm.localPatientId} onChange={(e) => setSmartcareForm((c) => ({ ...c, localPatientId: e.target.value }))} />
                <input className="w-full rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 text-sm" placeholder="SmartCare patient UUID" value={smartcareForm.smartcareUuid} onChange={(e) => setSmartcareForm((c) => ({ ...c, smartcareUuid: e.target.value }))} />
                <input className="w-full rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 text-sm" placeholder="ART number (optional)" value={smartcareForm.artNumber} onChange={(e) => setSmartcareForm((c) => ({ ...c, artNumber: e.target.value }))} />
                <div className="grid grid-cols-2 gap-2">
                  <button type="button" onClick={() => void handleLinkSmartcare()} className="rounded-xl bg-cyan-500 px-4 py-2.5 text-sm font-semibold text-slate-950 hover:bg-cyan-400">Link & Import</button>
                  <button type="button" onClick={() => void handleLoadSmartcare()} className="rounded-xl border border-slate-700 px-4 py-2.5 text-sm text-slate-200 hover:border-slate-600">Load Link</button>
                </div>
              </div>
            </div>
            <div className="rounded-3xl border border-slate-800 bg-slate-900/80 p-6">
              <h2 className="text-lg font-semibold text-white">Imported ART Summary</h2>
              {smartcareLink ? (
                <div className="mt-4 space-y-4">
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="rounded-2xl border border-slate-800 bg-slate-950 p-4"><div className="text-xs uppercase tracking-wide text-slate-500">ART Start</div><div className="mt-2 text-lg font-semibold text-white">{smartcareLink.artStartDate || 'Not imported'}</div></div>
                    <div className="rounded-2xl border border-slate-800 bg-slate-950 p-4"><div className="text-xs uppercase tracking-wide text-slate-500">Last Regimen</div><div className="mt-2 text-lg font-semibold text-white">{smartcareLink.lastRegimen || 'Not imported'}</div></div>
                    <div className="rounded-2xl border border-slate-800 bg-slate-950 p-4"><div className="text-xs uppercase tracking-wide text-slate-500">Last VL</div><div className="mt-2 text-lg font-semibold text-white">{smartcareLink.lastVl ?? 'Not imported'}</div></div>
                    <div className="rounded-2xl border border-slate-800 bg-slate-950 p-4"><div className="text-xs uppercase tracking-wide text-slate-500">Status</div><div className="mt-2"><span className={`inline-flex rounded-full border px-2 py-1 text-xs ${badgeClass(smartcareLink.syncStatus || 'linked')}`}>{smartcareLink.syncStatus || 'linked'}</span></div></div>
                  </div>
                  <button type="button" onClick={() => void handleAssessContinuity(smartcareLink.localPatientId)} className="inline-flex items-center gap-2 rounded-xl border border-cyan-700 bg-cyan-500/10 px-4 py-2 text-sm font-medium text-cyan-200 hover:bg-cyan-500/15">
                    <Activity className="h-4 w-4" />
                    Assess Continuity
                  </button>
                  {continuityByPatient[smartcareLink.localPatientId] && (
                    <div className="rounded-2xl border border-slate-800 bg-slate-950 p-4">
                      <div className="flex items-center justify-between gap-3">
                        <h3 className="text-sm font-semibold text-white">CDSS Continuity Assessment</h3>
                        <span className={`inline-flex rounded-full border px-2 py-1 text-xs ${badgeClass(continuityByPatient[smartcareLink.localPatientId]?.gap_severity || 'none')}`}>
                          {continuityByPatient[smartcareLink.localPatientId]?.gap_severity || 'none'}
                        </span>
                      </div>
                      <p className="mt-3 text-sm text-slate-300">{continuityByPatient[smartcareLink.localPatientId]?.gap_explanation || 'No explanation returned.'}</p>
                      <ul className="mt-3 space-y-2 text-sm text-slate-300">
                        {(continuityByPatient[smartcareLink.localPatientId]?.recommended_actions || []).map((action: string) => (
                          <li key={action} className="flex items-start gap-2">
                            <FileSymlink className="mt-0.5 h-4 w-4 text-cyan-300" />
                            <span>{action}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {smartcareLink.importError && <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-100">{smartcareLink.importError}</div>}
                </div>
              ) : (
                <div className="mt-4 rounded-2xl border border-slate-800 bg-slate-950 p-6 text-sm text-slate-400">No SmartCare link loaded yet.</div>
              )}
            </div>
          </div>
        )}

        {tab === 'cross-border' && (
          <div className="grid gap-6 xl:grid-cols-[360px_minmax(0,1fr)]">
            <div className="rounded-3xl border border-slate-800 bg-slate-900/80 p-6">
              <h2 className="text-lg font-semibold text-white">Flag Cross-Border Patient</h2>
              <div className="mt-4 space-y-3">
                <input className="w-full rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 text-sm" placeholder="Local patient ID" value={crossBorderForm.patientId} onChange={(e) => setCrossBorderForm((c) => ({ ...c, patientId: e.target.value }))} />
                <div className="grid grid-cols-2 gap-2">
                  <input className="rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 text-sm" placeholder="Origin country" value={crossBorderForm.originCountry} onChange={(e) => setCrossBorderForm((c) => ({ ...c, originCountry: e.target.value.toUpperCase() }))} />
                  <input className="rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 text-sm" placeholder="Current country" value={crossBorderForm.currentCountry} onChange={(e) => setCrossBorderForm((c) => ({ ...c, currentCountry: e.target.value.toUpperCase() }))} />
                </div>
                <input className="w-full rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 text-sm" placeholder="Cross-border reason" value={crossBorderForm.crossBorderReason} onChange={(e) => setCrossBorderForm((c) => ({ ...c, crossBorderReason: e.target.value }))} />
                <input className="w-full rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 text-sm" placeholder="Foreign ART number" value={crossBorderForm.foreignArtNumber} onChange={(e) => setCrossBorderForm((c) => ({ ...c, foreignArtNumber: e.target.value }))} />
                <input className="w-full rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 text-sm" placeholder="Foreign facility" value={crossBorderForm.foreignFacility} onChange={(e) => setCrossBorderForm((c) => ({ ...c, foreignFacility: e.target.value }))} />
                <input type="date" className="w-full rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 text-sm" value={crossBorderForm.lastForeignVisitDate} onChange={(e) => setCrossBorderForm((c) => ({ ...c, lastForeignVisitDate: e.target.value }))} />
                <button type="button" onClick={() => void handleFlagCrossBorder()} className="w-full rounded-xl bg-cyan-500 px-4 py-2.5 text-sm font-semibold text-slate-950 hover:bg-cyan-400">Save Flag</button>
              </div>
            </div>
            <div className="rounded-3xl border border-slate-800 bg-slate-900/80 p-6">
              <h2 className="text-lg font-semibold text-white">Flagged Patients</h2>
              <div className="mt-4 space-y-4">
                {crossBorderFlags.map((flag) => {
                  const continuity = continuityByPatient[flag.patientId];
                  return (
                    <div key={flag.id} className="rounded-2xl border border-slate-800 bg-slate-950 p-4">
                      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                        <div>
                          <div className="text-sm font-semibold text-white">Patient {flag.patientId}</div>
                          <div className="mt-1 text-sm text-slate-400">{flag.originCountry} → {flag.currentCountry} • {flag.crossBorderReason || 'reason not stated'}</div>
                          <div className="mt-1 text-xs text-slate-500">Last foreign visit: {flag.lastForeignVisitDate || 'Unknown'} • Facility: {flag.foreignFacility || 'Unknown'}</div>
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                          <span className={`inline-flex rounded-full border px-2 py-1 text-xs ${flag.continuityGapDetected ? 'border-red-500/30 bg-red-500/15 text-red-200' : 'border-emerald-500/30 bg-emerald-500/15 text-emerald-200'}`}>
                            {flag.continuityGapDetected ? 'Gap detected' : 'No gap flagged'}
                          </span>
                          {continuity?.gap_severity && <span className={`inline-flex rounded-full border px-2 py-1 text-xs ${badgeClass(continuity.gap_severity)}`}>{continuity.gap_severity}</span>}
                          <button type="button" onClick={() => void handleAssessContinuity(flag.patientId)} className="rounded-xl border border-slate-700 px-3 py-2 text-sm text-slate-200 hover:border-slate-600">Assess Continuity</button>
                        </div>
                      </div>
                      {continuity?.recommended_actions?.length ? (
                        <ul className="mt-3 space-y-1 text-sm text-slate-300">
                          {continuity.recommended_actions.map((action: string) => <li key={action}>• {action}</li>)}
                        </ul>
                      ) : null}
                    </div>
                  );
                })}
                {!crossBorderFlags.length && <div className="rounded-2xl border border-slate-800 bg-slate-950 p-6 text-sm text-slate-400">No cross-border patient flags have been recorded yet.</div>}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default InteropDashboard;
