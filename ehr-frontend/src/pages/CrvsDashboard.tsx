import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { AlertTriangle, ArrowLeft, Baby, FileText, RefreshCw } from 'lucide-react';
import { useNotification } from '../components/GlobalNotification';
import { ehrAxios } from '../services/api';

type TabKey = 'birth' | 'death' | 'mdsr';

interface CrvsDashboardProps {
  tenantSlug: string;
  token?: string;
}

interface BirthRow {
  id: string;
  patientId: string;
  motherPatientId: string | null;
  birthDate: string;
  birthType: string;
  gestationalAgeWeeks: number | null;
  birthWeightGrams: number | null;
  placeOfBirth: string | null;
  crvsReference: string | null;
  submittedToCrvs: boolean;
  errorMessage: string | null;
  createdAt: string;
}

interface DeathRow {
  id: string;
  patientId: string;
  deathDate: string;
  deathTime: string | null;
  placeOfDeath: string | null;
  causeOfDeathPrimary: string;
  causeOfDeathIcd10: string;
  mannerOfDeath: string | null;
  crvsReference: string | null;
  submittedToCrvs: boolean;
  createdAt: string;
}

interface MdsrRow {
  id: string;
  patientId: string;
  deathCertificateId: string | null;
  deathDate: string;
  primaryCause: string | null;
  primaryCauseIcd10: string | null;
  avoidable: boolean | null;
  avoidanceFactors: string | null;
  committeeReviewDate: string | null;
  reviewedBy: string | null;
  actionPoints: string | null;
  submittedToMoh: boolean;
  createdAt: string;
}

const authHeaders = (token: string, tenantSlug: string) => ({
  Authorization: `Bearer ${token}`,
  'X-Tenant-ID': tenantSlug,
});

const todayIso = () => new Date().toISOString().slice(0, 10);
const nowTime = () => new Date().toISOString().slice(11, 16);
const getStoredToken = () => localStorage.getItem('ehr_token') || localStorage.getItem('token') || '';

const apiError = (error: any, fallback: string) =>
  error?.response?.data?.message || error?.message || fallback;

const TabButton: React.FC<{
  active: boolean;
  label: string;
  icon: React.ReactNode;
  onClick: () => void;
}> = ({ active, label, icon, onClick }) => (
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

const statusBadge = (ok: boolean, pendingText: string) =>
  ok
    ? 'bg-emerald-500/15 text-emerald-300 border-emerald-600/40'
    : `bg-amber-500/15 text-amber-300 border-amber-600/40 ${pendingText}`;

const CrvsDashboard: React.FC<CrvsDashboardProps> = ({ tenantSlug: tenantSlugProp, token: tokenProp }) => {
  const params = useParams<{ tenantSlug: string }>();
  const tenantSlug = tenantSlugProp || params.tenantSlug || '';
  const token = tokenProp || getStoredToken();
  const navigate = useNavigate();
  const { showError, showSuccess } = useNotification();

  const [tab, setTab] = useState<TabKey>('birth');
  const [loading, setLoading] = useState(false);
  const [births, setBirths] = useState<BirthRow[]>([]);
  const [deaths, setDeaths] = useState<DeathRow[]>([]);
  const [mdsrRows, setMdsrRows] = useState<MdsrRow[]>([]);
  const [reviewingId, setReviewingId] = useState<string | null>(null);

  const [birthForm, setBirthForm] = useState({
    patientId: '',
    motherPatientId: '',
    maternityRecordId: '',
    birthDate: `${todayIso()}T00:00`,
    birthType: 'live_birth',
    gestationalAgeWeeks: '',
    birthWeightGrams: '',
    deliveryMode: '',
    birthOrder: '1',
    plurality: 'single',
    placeOfBirth: '',
  });

  const [deathForm, setDeathForm] = useState({
    patientId: '',
    deathDate: todayIso(),
    deathTime: nowTime(),
    placeOfDeath: '',
    causeOfDeathPrimary: '',
    causeOfDeathIcd10: '',
    causeOfDeathSecondary: '',
    causeOfDeathSecondaryIcd10: '',
    mannerOfDeath: 'natural',
    certifyingProvider: '',
  });

  const [mdsrForm, setMdsrForm] = useState({
    patientId: '',
    deathCertificateId: '',
    deathDate: todayIso(),
    weeksGestationAtDeath: '',
    primaryCause: '',
    primaryCauseIcd10: '',
    avoidable: 'unknown',
    avoidanceFactors: '',
    committeeReviewDate: '',
    reviewedBy: '',
    actionPoints: '',
  });

  const [reviewForm, setReviewForm] = useState({
    committeeReviewDate: todayIso(),
    reviewedBy: '',
    actionPoints: '',
    avoidable: 'true',
    avoidanceFactors: '',
  });

  const headers = useMemo(() => authHeaders(token, tenantSlug), [token, tenantSlug]);

  const loadBirths = useCallback(async () => {
    const { data } = await ehrAxios.get('/crvs/birth', { headers });
    setBirths(Array.isArray(data) ? data : []);
  }, [headers]);

  const loadDeaths = useCallback(async () => {
    const { data } = await ehrAxios.get('/crvs/death', { headers });
    setDeaths(Array.isArray(data) ? data : []);
  }, [headers]);

  const loadMdsr = useCallback(async () => {
    const { data } = await ehrAxios.get('/crvs/mdsr', { headers });
    setMdsrRows(Array.isArray(data) ? data : []);
  }, [headers]);

  const refreshAll = useCallback(async () => {
    if (!tenantSlug || !token) return;
    setLoading(true);
    try {
      await Promise.all([loadBirths(), loadDeaths(), loadMdsr()]);
    } catch (error: any) {
      showError('Refresh failed', apiError(error, 'Unable to load CRVS data.'));
    } finally {
      setLoading(false);
    }
  }, [loadBirths, loadDeaths, loadMdsr, showError, tenantSlug, token]);

  useEffect(() => {
    void refreshAll();
  }, [refreshAll]);

  const handleBirthSubmit = async () => {
    try {
      await ehrAxios.post(
        '/crvs/birth',
        {
          ...birthForm,
          motherPatientId: birthForm.motherPatientId || null,
          maternityRecordId: birthForm.maternityRecordId || null,
          gestationalAgeWeeks: birthForm.gestationalAgeWeeks || null,
          birthWeightGrams: birthForm.birthWeightGrams || null,
          deliveryMode: birthForm.deliveryMode || null,
          placeOfBirth: birthForm.placeOfBirth || null,
        },
        { headers },
      );
      showSuccess('Birth recorded', 'The birth notification has been stored.');
      setBirthForm({
        patientId: '',
        motherPatientId: '',
        maternityRecordId: '',
        birthDate: `${todayIso()}T00:00`,
        birthType: 'live_birth',
        gestationalAgeWeeks: '',
        birthWeightGrams: '',
        deliveryMode: '',
        birthOrder: '1',
        plurality: 'single',
        placeOfBirth: '',
      });
      await loadBirths();
    } catch (error: any) {
      showError('Birth registration failed', apiError(error, 'Unable to register the birth notification.'));
    }
  };

  const handleDeathSubmit = async () => {
    try {
      await ehrAxios.post(
        '/crvs/death',
        {
          ...deathForm,
          deathTime: deathForm.deathTime || null,
          placeOfDeath: deathForm.placeOfDeath || null,
          causeOfDeathSecondary: deathForm.causeOfDeathSecondary || null,
          causeOfDeathSecondaryIcd10: deathForm.causeOfDeathSecondaryIcd10 || null,
          mannerOfDeath: deathForm.mannerOfDeath || null,
          certifyingProvider: deathForm.certifyingProvider || null,
        },
        { headers },
      );
      showSuccess('Death certificate recorded', 'The death record has been stored.');
      setDeathForm({
        patientId: '',
        deathDate: todayIso(),
        deathTime: nowTime(),
        placeOfDeath: '',
        causeOfDeathPrimary: '',
        causeOfDeathIcd10: '',
        causeOfDeathSecondary: '',
        causeOfDeathSecondaryIcd10: '',
        mannerOfDeath: 'natural',
        certifyingProvider: '',
      });
      await loadDeaths();
    } catch (error: any) {
      showError('Death registration failed', apiError(error, 'Unable to register the death certificate.'));
    }
  };

  const handleMdsrSubmit = async () => {
    try {
      await ehrAxios.post(
        '/crvs/mdsr',
        {
          ...mdsrForm,
          deathCertificateId: mdsrForm.deathCertificateId || null,
          weeksGestationAtDeath: mdsrForm.weeksGestationAtDeath || null,
          primaryCause: mdsrForm.primaryCause || null,
          primaryCauseIcd10: mdsrForm.primaryCauseIcd10 || null,
          avoidable:
            mdsrForm.avoidable === 'unknown'
              ? null
              : mdsrForm.avoidable === 'true',
          avoidanceFactors: mdsrForm.avoidanceFactors || null,
          committeeReviewDate: mdsrForm.committeeReviewDate || null,
          reviewedBy: mdsrForm.reviewedBy || null,
          actionPoints: mdsrForm.actionPoints || null,
        },
        { headers },
      );
      showSuccess('MDSR submitted', 'The maternal death notification has been recorded.');
      setMdsrForm({
        patientId: '',
        deathCertificateId: '',
        deathDate: todayIso(),
        weeksGestationAtDeath: '',
        primaryCause: '',
        primaryCauseIcd10: '',
        avoidable: 'unknown',
        avoidanceFactors: '',
        committeeReviewDate: '',
        reviewedBy: '',
        actionPoints: '',
      });
      await loadMdsr();
    } catch (error: any) {
      showError('MDSR submission failed', apiError(error, 'Unable to submit the MDSR notification.'));
    }
  };

  const handleReview = async (id: string) => {
    try {
      await ehrAxios.patch(
        `/crvs/mdsr/${id}/review`,
        {
          committeeReviewDate: reviewForm.committeeReviewDate || null,
          reviewedBy: reviewForm.reviewedBy || null,
          actionPoints: reviewForm.actionPoints || null,
          avoidable: reviewForm.avoidable === 'true',
          avoidanceFactors: reviewForm.avoidanceFactors || null,
        },
        { headers },
      );
      showSuccess('Review recorded', 'The committee review details have been saved.');
      setReviewingId(null);
      setReviewForm({
        committeeReviewDate: todayIso(),
        reviewedBy: '',
        actionPoints: '',
        avoidable: 'true',
        avoidanceFactors: '',
      });
      await loadMdsr();
    } catch (error: any) {
      showError('Review failed', apiError(error, 'Unable to save the committee review.'));
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 px-4 py-6 text-slate-300 sm:px-6 lg:px-8">
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
            <h1 className="text-3xl font-semibold text-white">CRVS Birth / Death Notification</h1>
            <p className="mt-2 max-w-3xl text-sm text-slate-300">
              Record births, generate death certificates, and manage maternal death surveillance and committee review workflows.
            </p>
          </div>
          <button
            type="button"
            onClick={() => void refreshAll()}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-700 px-4 py-2 text-sm font-medium text-slate-200 hover:border-slate-600 hover:text-white"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>

        <div className="flex flex-wrap gap-3">
          <TabButton active={tab === 'birth'} label="Birth Registration" icon={<Baby className="h-4 w-4" />} onClick={() => setTab('birth')} />
          <TabButton active={tab === 'death'} label="Death Certificates" icon={<FileText className="h-4 w-4" />} onClick={() => setTab('death')} />
          <TabButton active={tab === 'mdsr'} label="MDSR / Perinatal Review" icon={<AlertTriangle className="h-4 w-4" />} onClick={() => setTab('mdsr')} />
        </div>

        {tab === 'birth' && (
          <div className="grid gap-6 xl:grid-cols-[360px_minmax(0,1fr)]">
            <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-5">
              <h2 className="text-lg font-semibold text-white">Register Birth</h2>
              <div className="mt-4 space-y-3">
                <input value={birthForm.patientId} onChange={(e) => setBirthForm((p) => ({ ...p, patientId: e.target.value }))} placeholder="Patient ID" className="w-full rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-white outline-none" />
                <input value={birthForm.motherPatientId} onChange={(e) => setBirthForm((p) => ({ ...p, motherPatientId: e.target.value }))} placeholder="Mother patient ID" className="w-full rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-white outline-none" />
                <input value={birthForm.maternityRecordId} onChange={(e) => setBirthForm((p) => ({ ...p, maternityRecordId: e.target.value }))} placeholder="Maternity record ID" className="w-full rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-white outline-none" />
                <input type="datetime-local" value={birthForm.birthDate} onChange={(e) => setBirthForm((p) => ({ ...p, birthDate: e.target.value }))} className="w-full rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-white outline-none" />
                <select value={birthForm.birthType} onChange={(e) => setBirthForm((p) => ({ ...p, birthType: e.target.value }))} className="w-full rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-white outline-none">
                  <option value="live_birth">Live birth</option>
                  <option value="stillbirth">Stillbirth</option>
                  <option value="miscarriage">Miscarriage</option>
                </select>
                <input value={birthForm.gestationalAgeWeeks} onChange={(e) => setBirthForm((p) => ({ ...p, gestationalAgeWeeks: e.target.value }))} placeholder="Gestational age (weeks)" className="w-full rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-white outline-none" />
                <input value={birthForm.birthWeightGrams} onChange={(e) => setBirthForm((p) => ({ ...p, birthWeightGrams: e.target.value }))} placeholder="Birth weight (grams)" className="w-full rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-white outline-none" />
                <input value={birthForm.deliveryMode} onChange={(e) => setBirthForm((p) => ({ ...p, deliveryMode: e.target.value }))} placeholder="Delivery mode" className="w-full rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-white outline-none" />
                <input value={birthForm.birthOrder} onChange={(e) => setBirthForm((p) => ({ ...p, birthOrder: e.target.value }))} placeholder="Birth order" className="w-full rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-white outline-none" />
                <input value={birthForm.plurality} onChange={(e) => setBirthForm((p) => ({ ...p, plurality: e.target.value }))} placeholder="Plurality" className="w-full rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-white outline-none" />
                <input value={birthForm.placeOfBirth} onChange={(e) => setBirthForm((p) => ({ ...p, placeOfBirth: e.target.value }))} placeholder="Place of birth" className="w-full rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-white outline-none" />
                <button type="button" onClick={handleBirthSubmit} className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-cyan-500 px-4 py-2 text-sm font-semibold text-slate-950 hover:bg-cyan-400">
                  <Baby className="h-4 w-4" />
                  Save Birth Notification
                </button>
              </div>
            </div>

            <div className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/80">
              <div className="border-b border-slate-800 px-5 py-4">
                <h2 className="text-lg font-semibold text-white">Recent Birth Notifications</h2>
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-slate-800 text-sm">
                  <thead className="bg-slate-950/60 text-left text-slate-400">
                    <tr>
                      <th className="px-4 py-3 font-medium">Patient</th>
                      <th className="px-4 py-3 font-medium">Type</th>
                      <th className="px-4 py-3 font-medium">Birth Date</th>
                      <th className="px-4 py-3 font-medium">Place</th>
                      <th className="px-4 py-3 font-medium">CRVS Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800">
                    {births.map((row) => (
                      <tr key={row.id} className="hover:bg-slate-950/40">
                        <td className="px-4 py-3 text-white">{row.patientId}</td>
                        <td className="px-4 py-3 text-slate-300">{row.birthType}</td>
                        <td className="px-4 py-3 text-slate-300">{new Date(row.birthDate).toLocaleString()}</td>
                        <td className="px-4 py-3 text-slate-300">{row.placeOfBirth || '-'}</td>
                        <td className="px-4 py-3">
                          <span className={`rounded-full border px-2.5 py-1 text-xs font-medium ${statusBadge(row.submittedToCrvs, '')}`}>
                            {row.submittedToCrvs ? row.crvsReference || 'Submitted' : row.errorMessage || 'Pending'}
                          </span>
                        </td>
                      </tr>
                    ))}
                    {!births.length && (
                      <tr><td colSpan={5} className="px-4 py-8 text-center text-slate-500">No birth notifications yet.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {tab === 'death' && (
          <div className="grid gap-6 xl:grid-cols-[380px_minmax(0,1fr)]">
            <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-5">
              <h2 className="text-lg font-semibold text-white">Register Death</h2>
              <div className="mt-4 space-y-3">
                <input value={deathForm.patientId} onChange={(e) => setDeathForm((p) => ({ ...p, patientId: e.target.value }))} placeholder="Patient ID" className="w-full rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-white outline-none" />
                <input type="date" value={deathForm.deathDate} onChange={(e) => setDeathForm((p) => ({ ...p, deathDate: e.target.value }))} className="w-full rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-white outline-none" />
                <input type="time" value={deathForm.deathTime} onChange={(e) => setDeathForm((p) => ({ ...p, deathTime: e.target.value }))} className="w-full rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-white outline-none" />
                <input value={deathForm.placeOfDeath} onChange={(e) => setDeathForm((p) => ({ ...p, placeOfDeath: e.target.value }))} placeholder="Place of death" className="w-full rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-white outline-none" />
                <input value={deathForm.causeOfDeathPrimary} onChange={(e) => setDeathForm((p) => ({ ...p, causeOfDeathPrimary: e.target.value }))} placeholder="Primary cause of death" className="w-full rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-white outline-none" />
                <input value={deathForm.causeOfDeathIcd10} onChange={(e) => setDeathForm((p) => ({ ...p, causeOfDeathIcd10: e.target.value }))} placeholder="Primary ICD-10 code" className="w-full rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-white outline-none" />
                <input value={deathForm.causeOfDeathSecondary} onChange={(e) => setDeathForm((p) => ({ ...p, causeOfDeathSecondary: e.target.value }))} placeholder="Secondary cause of death" className="w-full rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-white outline-none" />
                <input value={deathForm.causeOfDeathSecondaryIcd10} onChange={(e) => setDeathForm((p) => ({ ...p, causeOfDeathSecondaryIcd10: e.target.value }))} placeholder="Secondary ICD-10 code" className="w-full rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-white outline-none" />
                <input value={deathForm.mannerOfDeath} onChange={(e) => setDeathForm((p) => ({ ...p, mannerOfDeath: e.target.value }))} placeholder="Manner of death" className="w-full rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-white outline-none" />
                <input value={deathForm.certifyingProvider} onChange={(e) => setDeathForm((p) => ({ ...p, certifyingProvider: e.target.value }))} placeholder="Certifying provider ID" className="w-full rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-white outline-none" />
                <button type="button" onClick={handleDeathSubmit} className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-cyan-500 px-4 py-2 text-sm font-semibold text-slate-950 hover:bg-cyan-400">
                  <FileText className="h-4 w-4" />
                  Save Death Certificate
                </button>
              </div>
            </div>

            <div className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/80">
              <div className="border-b border-slate-800 px-5 py-4">
                <h2 className="text-lg font-semibold text-white">Death Records</h2>
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-slate-800 text-sm">
                  <thead className="bg-slate-950/60 text-left text-slate-400">
                    <tr>
                      <th className="px-4 py-3 font-medium">Patient</th>
                      <th className="px-4 py-3 font-medium">Death Date</th>
                      <th className="px-4 py-3 font-medium">Primary Cause</th>
                      <th className="px-4 py-3 font-medium">ICD-10</th>
                      <th className="px-4 py-3 font-medium">Submission</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800">
                    {deaths.map((row) => (
                      <tr key={row.id} className="hover:bg-slate-950/40">
                        <td className="px-4 py-3 text-white">{row.patientId}</td>
                        <td className="px-4 py-3 text-slate-300">{row.deathDate}</td>
                        <td className="px-4 py-3 text-slate-300">{row.causeOfDeathPrimary}</td>
                        <td className="px-4 py-3 text-slate-300">{row.causeOfDeathIcd10}</td>
                        <td className="px-4 py-3">
                          <span className={`rounded-full border px-2.5 py-1 text-xs font-medium ${statusBadge(row.submittedToCrvs, '')}`}>
                            {row.submittedToCrvs ? row.crvsReference || 'Submitted' : 'Pending'}
                          </span>
                        </td>
                      </tr>
                    ))}
                    {!deaths.length && (
                      <tr><td colSpan={5} className="px-4 py-8 text-center text-slate-500">No death certificates yet.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {tab === 'mdsr' && (
          <div className="grid gap-6 xl:grid-cols-[380px_minmax(0,1fr)]">
            <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-5">
              <h2 className="text-lg font-semibold text-white">Submit MDSR Notification</h2>
              <div className="mt-4 space-y-3">
                <input value={mdsrForm.patientId} onChange={(e) => setMdsrForm((p) => ({ ...p, patientId: e.target.value }))} placeholder="Patient ID" className="w-full rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-white outline-none" />
                <input value={mdsrForm.deathCertificateId} onChange={(e) => setMdsrForm((p) => ({ ...p, deathCertificateId: e.target.value }))} placeholder="Death certificate ID" className="w-full rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-white outline-none" />
                <input type="date" value={mdsrForm.deathDate} onChange={(e) => setMdsrForm((p) => ({ ...p, deathDate: e.target.value }))} className="w-full rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-white outline-none" />
                <input value={mdsrForm.weeksGestationAtDeath} onChange={(e) => setMdsrForm((p) => ({ ...p, weeksGestationAtDeath: e.target.value }))} placeholder="Gestation weeks at death" className="w-full rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-white outline-none" />
                <input value={mdsrForm.primaryCause} onChange={(e) => setMdsrForm((p) => ({ ...p, primaryCause: e.target.value }))} placeholder="Primary cause" className="w-full rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-white outline-none" />
                <input value={mdsrForm.primaryCauseIcd10} onChange={(e) => setMdsrForm((p) => ({ ...p, primaryCauseIcd10: e.target.value }))} placeholder="Primary cause ICD-10" className="w-full rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-white outline-none" />
                <select value={mdsrForm.avoidable} onChange={(e) => setMdsrForm((p) => ({ ...p, avoidable: e.target.value }))} className="w-full rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-white outline-none">
                  <option value="unknown">Avoidable unknown</option>
                  <option value="true">Avoidable</option>
                  <option value="false">Not avoidable</option>
                </select>
                <textarea value={mdsrForm.avoidanceFactors} onChange={(e) => setMdsrForm((p) => ({ ...p, avoidanceFactors: e.target.value }))} placeholder="Avoidance factors" rows={3} className="w-full rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-white outline-none" />
                <textarea value={mdsrForm.actionPoints} onChange={(e) => setMdsrForm((p) => ({ ...p, actionPoints: e.target.value }))} placeholder="Initial action points" rows={3} className="w-full rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-white outline-none" />
                <button type="button" onClick={handleMdsrSubmit} className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-cyan-500 px-4 py-2 text-sm font-semibold text-slate-950 hover:bg-cyan-400">
                  <AlertTriangle className="h-4 w-4" />
                  Save MDSR Notification
                </button>
              </div>
            </div>

            <div className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/80">
              <div className="border-b border-slate-800 px-5 py-4">
                <h2 className="text-lg font-semibold text-white">MDSR / Perinatal Review Records</h2>
              </div>
              <div className="space-y-4 p-4">
                {mdsrRows.map((row) => (
                  <div key={row.id} className="rounded-2xl border border-slate-800 bg-slate-950/70 p-4">
                    <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                      <div className="space-y-1">
                        <p className="text-sm font-semibold text-white">Patient {row.patientId}</p>
                        <p className="text-sm text-slate-300">Death date: {row.deathDate}</p>
                        <p className="text-sm text-slate-300">Primary cause: {row.primaryCause || '-'} {row.primaryCauseIcd10 ? `(${row.primaryCauseIcd10})` : ''}</p>
                        <p className="text-sm text-slate-300">Committee review: {row.committeeReviewDate || 'Pending'}</p>
                        <p className="text-sm text-slate-300">Action points: {row.actionPoints || 'Pending review'}</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setReviewingId(reviewingId === row.id ? null : row.id)}
                        className="rounded-xl border border-slate-700 px-4 py-2 text-sm font-medium text-slate-200 hover:text-white"
                      >
                        {reviewingId === row.id ? 'Cancel Review' : 'Record Review'}
                      </button>
                    </div>

                    {reviewingId === row.id && (
                      <div className="mt-4 grid gap-3 border-t border-slate-800 pt-4">
                        <input type="date" value={reviewForm.committeeReviewDate} onChange={(e) => setReviewForm((p) => ({ ...p, committeeReviewDate: e.target.value }))} className="rounded-xl border border-slate-800 bg-slate-900/80 px-3 py-2 text-sm text-white outline-none" />
                        <input value={reviewForm.reviewedBy} onChange={(e) => setReviewForm((p) => ({ ...p, reviewedBy: e.target.value }))} placeholder="Reviewed by user ID" className="rounded-xl border border-slate-800 bg-slate-900/80 px-3 py-2 text-sm text-white outline-none" />
                        <select value={reviewForm.avoidable} onChange={(e) => setReviewForm((p) => ({ ...p, avoidable: e.target.value }))} className="rounded-xl border border-slate-800 bg-slate-900/80 px-3 py-2 text-sm text-white outline-none">
                          <option value="true">Avoidable</option>
                          <option value="false">Not avoidable</option>
                        </select>
                        <textarea value={reviewForm.avoidanceFactors} onChange={(e) => setReviewForm((p) => ({ ...p, avoidanceFactors: e.target.value }))} placeholder="Avoidance factors" rows={3} className="rounded-xl border border-slate-800 bg-slate-900/80 px-3 py-2 text-sm text-white outline-none" />
                        <textarea value={reviewForm.actionPoints} onChange={(e) => setReviewForm((p) => ({ ...p, actionPoints: e.target.value }))} placeholder="Committee action points" rows={3} className="rounded-xl border border-slate-800 bg-slate-900/80 px-3 py-2 text-sm text-white outline-none" />
                        <button type="button" onClick={() => void handleReview(row.id)} className="inline-flex items-center justify-center gap-2 rounded-xl bg-cyan-500 px-4 py-2 text-sm font-semibold text-slate-950 hover:bg-cyan-400">
                          Save Review
                        </button>
                      </div>
                    )}
                  </div>
                ))}
                {!mdsrRows.length && (
                  <div className="rounded-2xl border border-dashed border-slate-800 bg-slate-950/40 p-8 text-center text-slate-500">
                    No MDSR notifications yet.
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default CrvsDashboard;
