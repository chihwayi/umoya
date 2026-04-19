import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { AlertTriangle, ArrowLeft, Baby, ClipboardCheck, Home, RefreshCw, ShieldAlert, Users } from 'lucide-react';
import { useNotification } from '../components/GlobalNotification';
import { tbaApi } from '../services/api';

type TabKey = 'register' | 'births' | 'summary';

interface TbaRow {
  id: string;
  tbaCode: string;
  fullName: string;
  district: string;
  village: string;
  trained: boolean;
  lastSupervisionDate: string | null;
  supervisionScore: number | null;
  supervisionRisk: string | null;
}

interface BirthRow {
  id: string;
  motherName: string;
  birthDate: string;
  birthOutcome: string;
  babyAlive: boolean;
  maternalAlive: boolean;
  referred: boolean;
  referralReason: string | null;
  crvsNotified: boolean;
  birthCertificateNumber: string | null;
  cdssRiskLevel: string | null;
  cdssRecommendation: string | null;
}

const getStoredToken = () => localStorage.getItem('ehr_token') || localStorage.getItem('token') || '';
const todayIso = () => new Date().toISOString().slice(0, 10);

const riskBadge = (risk?: string | null) => {
  const value = String(risk || '').toLowerCase();
  if (value === 'high') return 'border-red-500/40 bg-red-500/10 text-red-100';
  if (value === 'medium' || value === 'moderate') return 'border-amber-500/40 bg-amber-500/10 text-amber-100';
  if (value === 'low') return 'border-emerald-500/40 bg-emerald-500/10 text-emerald-100';
  return 'border-slate-700 bg-slate-900 text-slate-300';
};

const TbaDashboard: React.FC<{ tenantSlug?: string; token?: string }> = ({ tenantSlug: tenantSlugProp, token: tokenProp }) => {
  const params = useParams<{ tenantSlug: string }>();
  const tenantSlug = tenantSlugProp || params.tenantSlug || '';
  const token = tokenProp || getStoredToken();
  const navigate = useNavigate();
  const { showError, showSuccess } = useNotification();

  const [tab, setTab] = useState<TabKey>('register');
  const [loading, setLoading] = useState(false);
  const [districtFilter, setDistrictFilter] = useState('');
  const [tbas, setTbas] = useState<TbaRow[]>([]);
  const [births, setBirths] = useState<BirthRow[]>([]);
  const [summary, setSummary] = useState<Record<string, number> | null>(null);

  const [tbaForm, setTbaForm] = useState({
    tbaCode: '',
    fullName: '',
    sex: 'female',
    dateOfBirth: '',
    phone: '',
    village: '',
    ward: '',
    district: '',
    trained: false,
    trainingType: 'basic_TBA_training',
    lastTrainingDate: '',
    trainingInstitution: '',
    assignedChwId: '',
    assignedFacilityId: '',
    supervisingMidwifeId: '',
    lastSupervisionDate: '',
  });

  const [birthForm, setBirthForm] = useState({
    tbaId: '',
    attendedByType: 'tba',
    attendedByName: '',
    motherPatientId: '',
    motherName: '',
    motherPhone: '',
    motherVillage: '',
    motherAgeYears: '',
    motherParity: '',
    antenatalVisits: '0',
    lastAncDate: '',
    birthDate: todayIso(),
    birthTime: '',
    birthPlaceDescription: 'home',
    gestationalAgeWeeks: '',
    babyAlive: true,
    babySex: 'female',
    birthWeightKg: '',
    apgarScore: '',
    birthOutcome: 'live_birth',
    multipleBirth: false,
    multipleBirthCount: '',
    maternalAlive: true,
    maternalComplications: '',
    cordCutWith: 'sterile_blade',
    misoprostolGiven: false,
    vitaminKGiven: false,
    eyeCareGiven: false,
    breastfeedingInitiated: true,
    referralFacility: '',
    referralOutcome: '',
    previousComplications: '',
    distanceToFacilityKm: '',
  });

  const loadData = useCallback(async () => {
    if (!tenantSlug || !token) return;
    setLoading(true);
    try {
      const [tbaRows, birthRows] = await Promise.all([
        tbaApi.getTbas(districtFilter || undefined, token, tenantSlug),
        tbaApi.getBirths({}, token, tenantSlug),
      ]);
      setTbas(Array.isArray(tbaRows) ? tbaRows : []);
      setBirths(Array.isArray(birthRows) ? birthRows : []);
      if (districtFilter) {
        setSummary(await tbaApi.getSummary(districtFilter, token, tenantSlug));
      } else {
        setSummary(null);
      }
    } catch (error: any) {
      showError('TBA dashboard', error?.response?.data?.message || 'Failed to load TBA data.');
    } finally {
      setLoading(false);
    }
  }, [districtFilter, showError, tenantSlug, token]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const highRiskOverdue = useMemo(() => {
    const threshold = new Date();
    threshold.setMonth(threshold.getMonth() - 3);
    return tbas.filter((tba) => {
      if (String(tba.supervisionRisk || '').toLowerCase() !== 'high') return false;
      if (!tba.lastSupervisionDate) return true;
      return new Date(tba.lastSupervisionDate) < threshold;
    });
  }, [tbas]);

  const registerTba = async () => {
    try {
      await tbaApi.registerTba(
        {
          ...tbaForm,
          dateOfBirth: tbaForm.dateOfBirth || null,
          phone: tbaForm.phone || null,
          ward: tbaForm.ward || null,
          trainingType: tbaForm.trained ? tbaForm.trainingType : 'none',
          lastTrainingDate: tbaForm.lastTrainingDate || null,
          trainingInstitution: tbaForm.trainingInstitution || null,
          assignedChwId: tbaForm.assignedChwId || null,
          assignedFacilityId: tbaForm.assignedFacilityId || null,
          supervisingMidwifeId: tbaForm.supervisingMidwifeId || null,
          lastSupervisionDate: tbaForm.lastSupervisionDate || null,
        },
        token,
        tenantSlug,
      );
      showSuccess('TBA registered', 'Traditional birth attendant saved and risk-scored.');
      setTbaForm({
        tbaCode: '',
        fullName: '',
        sex: 'female',
        dateOfBirth: '',
        phone: '',
        village: '',
        ward: '',
        district: '',
        trained: false,
        trainingType: 'basic_TBA_training',
        lastTrainingDate: '',
        trainingInstitution: '',
        assignedChwId: '',
        assignedFacilityId: '',
        supervisingMidwifeId: '',
        lastSupervisionDate: '',
      });
      await loadData();
    } catch (error: any) {
      showError('TBA register', error?.response?.data?.message || 'Failed to register TBA.');
    }
  };

  const rescoreTba = async (id: string) => {
    try {
      const result = await tbaApi.scoreTbaRisk(id, token, tenantSlug);
      showSuccess('Risk rescored', `Score ${result?.supervisionScore ?? 'n/a'}/100, risk ${result?.supervisionRisk ?? 'unknown'}.`);
      await loadData();
    } catch (error: any) {
      showError('Risk scoring', error?.response?.data?.message || 'Failed to rescore TBA risk.');
    }
  };

  const recordBirth = async () => {
    try {
      const result = await tbaApi.recordBirth(
        {
          ...birthForm,
          tbaId: birthForm.tbaId || null,
          attendedByName: birthForm.attendedByName || null,
          motherPatientId: birthForm.motherPatientId || null,
          motherPhone: birthForm.motherPhone || null,
          motherAgeYears: birthForm.motherAgeYears || null,
          motherParity: birthForm.motherParity || null,
          antenatalVisits: Number(birthForm.antenatalVisits || 0),
          lastAncDate: birthForm.lastAncDate || null,
          birthTime: birthForm.birthTime || null,
          gestationalAgeWeeks: birthForm.gestationalAgeWeeks || null,
          birthWeightKg: birthForm.birthWeightKg || null,
          apgarScore: birthForm.apgarScore || null,
          multipleBirthCount: birthForm.multipleBirth ? Number(birthForm.multipleBirthCount || 2) : null,
          maternalComplications: birthForm.maternalComplications.split(',').map((item) => item.trim()).filter(Boolean),
          referralFacility: birthForm.referralFacility || null,
          referralOutcome: birthForm.referralOutcome || null,
          previousComplications: birthForm.previousComplications.split(',').map((item) => item.trim()).filter(Boolean),
          distanceToFacilityKm: birthForm.distanceToFacilityKm || 0,
        },
        token,
        tenantSlug,
      );
      showSuccess('Birth recorded', result?.referred ? 'Birth saved and urgent referral guidance was triggered.' : 'Birth saved successfully.');
      setBirthForm((prev) => ({
        ...prev,
        motherPatientId: '',
        motherName: '',
        motherPhone: '',
        motherVillage: '',
        motherAgeYears: '',
        motherParity: '',
        antenatalVisits: '0',
        lastAncDate: '',
        birthDate: todayIso(),
        birthTime: '',
        gestationalAgeWeeks: '',
        birthWeightKg: '',
        apgarScore: '',
        maternalComplications: '',
        previousComplications: '',
        referralFacility: '',
        referralOutcome: '',
        distanceToFacilityKm: '',
      }));
      await loadData();
    } catch (error: any) {
      showError('Home birth', error?.response?.data?.message || 'Failed to record home birth.');
    }
  };

  const notifyCrvs = async (id: string) => {
    try {
      const result = await tbaApi.notifyCrvs(id, token, tenantSlug);
      showSuccess('CRVS notified', `Birth notification submitted${result?.birthCertificateNumber ? ` (${result.birthCertificateNumber})` : ''}.`);
      await loadData();
    } catch (error: any) {
      showError('CRVS notify', error?.response?.data?.message || 'Failed to notify CRVS.');
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <div className="mx-auto max-w-7xl px-4 py-6 md:px-6">
        <div className="mb-6 flex items-center justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-[0.28em] text-cyan-300">Sprint 156</p>
            <h1 className="text-3xl font-semibold text-white">TBA & Rural Birth Registration</h1>
            <p className="mt-1 text-sm text-slate-400">Supervise traditional birth attendants, capture home births, and notify CRVS from rural workflows.</p>
          </div>
          <div className="flex gap-2">
            <button type="button" onClick={() => navigate(-1)} className="inline-flex items-center gap-2 rounded-xl border border-slate-800 bg-slate-900/80 px-3 py-2 text-sm text-slate-300"><ArrowLeft className="h-4 w-4" />Back</button>
            <button type="button" onClick={() => void loadData()} className="inline-flex items-center gap-2 rounded-xl border border-slate-800 bg-slate-900/80 px-3 py-2 text-sm text-slate-300"><RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />Refresh</button>
          </div>
        </div>

        {highRiskOverdue.length > 0 && (
          <div className="mb-6 rounded-2xl border border-red-500/40 bg-red-500/10 p-4 text-sm text-red-100">
            <div className="flex items-start gap-3">
              <ShieldAlert className="mt-0.5 h-5 w-5" />
              <div>
                <p className="font-semibold">High-risk TBAs overdue for supervision</p>
                <p className="mt-1">{highRiskOverdue.map((row) => `${row.fullName} (${row.tbaCode})`).join(', ')}</p>
              </div>
            </div>
          </div>
        )}

        <div className="mb-6 flex flex-wrap gap-2">
          {[
            { key: 'register', label: 'TBA Register', icon: Users },
            { key: 'births', label: 'Home Births', icon: Baby },
            { key: 'summary', label: 'Summary', icon: ClipboardCheck },
          ].map((item) => (
            <button
              key={item.key}
              type="button"
              onClick={() => setTab(item.key as TabKey)}
              className={`inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-sm font-medium ${
                tab === item.key ? 'border-cyan-600 bg-cyan-500/10 text-cyan-200' : 'border-slate-800 bg-slate-900/80 text-slate-300 hover:border-slate-700 hover:text-white'
              }`}
            >
              <item.icon className="h-4 w-4" />
              {item.label}
            </button>
          ))}
        </div>

        {tab === 'register' && (
          <div className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
            <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-5">
              <h2 className="text-lg font-semibold text-white">Register TBA</h2>
              <div className="mt-4 grid gap-3 md:grid-cols-2">
                <input value={tbaForm.tbaCode} onChange={(e) => setTbaForm((p) => ({ ...p, tbaCode: e.target.value }))} placeholder="TBA code" className="rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm" />
                <input value={tbaForm.fullName} onChange={(e) => setTbaForm((p) => ({ ...p, fullName: e.target.value }))} placeholder="Full name" className="rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm" />
                <select value={tbaForm.sex} onChange={(e) => setTbaForm((p) => ({ ...p, sex: e.target.value }))} className="rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm"><option value="female">Female</option><option value="male">Male</option></select>
                <input type="date" value={tbaForm.dateOfBirth} onChange={(e) => setTbaForm((p) => ({ ...p, dateOfBirth: e.target.value }))} className="rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm" />
                <input value={tbaForm.phone} onChange={(e) => setTbaForm((p) => ({ ...p, phone: e.target.value }))} placeholder="Phone" className="rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm" />
                <input value={tbaForm.village} onChange={(e) => setTbaForm((p) => ({ ...p, village: e.target.value }))} placeholder="Village" className="rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm" />
                <input value={tbaForm.ward} onChange={(e) => setTbaForm((p) => ({ ...p, ward: e.target.value }))} placeholder="Ward" className="rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm" />
                <input value={tbaForm.district} onChange={(e) => setTbaForm((p) => ({ ...p, district: e.target.value }))} placeholder="District" className="rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm" />
                <label className="flex items-center gap-2 rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm"><input type="checkbox" checked={tbaForm.trained} onChange={(e) => setTbaForm((p) => ({ ...p, trained: e.target.checked }))} />Trained TBA</label>
                <select value={tbaForm.trainingType} onChange={(e) => setTbaForm((p) => ({ ...p, trainingType: e.target.value }))} className="rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm"><option value="basic_TBA_training">Basic TBA training</option><option value="skilled_birth_attendant">Skilled birth attendant</option><option value="none">None</option></select>
                <input type="date" value={tbaForm.lastTrainingDate} onChange={(e) => setTbaForm((p) => ({ ...p, lastTrainingDate: e.target.value }))} className="rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm" />
                <input value={tbaForm.trainingInstitution} onChange={(e) => setTbaForm((p) => ({ ...p, trainingInstitution: e.target.value }))} placeholder="Training institution" className="rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm" />
                <input value={tbaForm.assignedChwId} onChange={(e) => setTbaForm((p) => ({ ...p, assignedChwId: e.target.value }))} placeholder="Assigned CHW ID" className="rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm" />
                <input value={tbaForm.assignedFacilityId} onChange={(e) => setTbaForm((p) => ({ ...p, assignedFacilityId: e.target.value }))} placeholder="Assigned facility ID" className="rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm" />
                <input value={tbaForm.supervisingMidwifeId} onChange={(e) => setTbaForm((p) => ({ ...p, supervisingMidwifeId: e.target.value }))} placeholder="Supervising midwife ID" className="rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm" />
                <input type="date" value={tbaForm.lastSupervisionDate} onChange={(e) => setTbaForm((p) => ({ ...p, lastSupervisionDate: e.target.value }))} className="rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm" />
              </div>
              <button type="button" onClick={registerTba} className="mt-4 rounded-xl bg-cyan-500 px-4 py-2 text-sm font-semibold text-slate-950 hover:bg-cyan-400">Save TBA</button>
            </div>
            <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-5">
              <div className="flex gap-2">
                <input value={districtFilter} onChange={(e) => setDistrictFilter(e.target.value)} placeholder="Filter by district" className="flex-1 rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm" />
                <button type="button" onClick={() => void loadData()} className="rounded-xl border border-slate-700 px-4 py-2 text-sm text-slate-200">Apply</button>
              </div>
              <div className="mt-4 space-y-3">
                {tbas.map((tba) => (
                  <div key={tba.id} className="rounded-xl border border-slate-800 bg-slate-950/70 p-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-white">{tba.fullName}</p>
                        <p className="mt-1 text-xs text-slate-400">{tba.tbaCode} · {tba.village}, {tba.district}</p>
                        <div className="mt-2 flex flex-wrap gap-2">
                          <span className={`inline-flex rounded-full border px-2.5 py-0.5 text-xs ${riskBadge(tba.supervisionRisk)}`}>{tba.supervisionRisk || 'unscored'}</span>
                          <span className="inline-flex rounded-full border border-slate-700 bg-slate-900 px-2.5 py-0.5 text-xs text-slate-300">{tba.supervisionScore ?? 'n/a'}/100</span>
                          <span className="inline-flex rounded-full border border-slate-700 bg-slate-900 px-2.5 py-0.5 text-xs text-slate-300">{tba.trained ? 'Trained' : 'Untrained'}</span>
                        </div>
                      </div>
                      <button type="button" onClick={() => void rescoreTba(tba.id)} className="rounded-lg border border-cyan-500/40 px-3 py-1.5 text-xs text-cyan-100">Score Risk</button>
                    </div>
                  </div>
                ))}
                {!tbas.length && <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-6 text-sm text-slate-400">No TBA records yet for the current filter.</div>}
              </div>
            </div>
          </div>
        )}

        {tab === 'births' && (
          <div className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
            <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-5">
              <h2 className="text-lg font-semibold text-white">Record Home Birth</h2>
              <div className="mt-4 grid gap-3 md:grid-cols-2">
                <select value={birthForm.tbaId} onChange={(e) => setBirthForm((p) => ({ ...p, tbaId: e.target.value }))} className="rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm"><option value="">Select TBA</option>{tbas.map((tba) => <option key={tba.id} value={tba.id}>{tba.fullName} ({tba.tbaCode})</option>)}</select>
                <select value={birthForm.attendedByType} onChange={(e) => setBirthForm((p) => ({ ...p, attendedByType: e.target.value }))} className="rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm"><option value="tba">TBA</option><option value="relative">Relative</option><option value="alone">Alone</option><option value="other">Other</option></select>
                <input value={birthForm.attendedByName} onChange={(e) => setBirthForm((p) => ({ ...p, attendedByName: e.target.value }))} placeholder="Attendant name" className="rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm" />
                <input value={birthForm.motherPatientId} onChange={(e) => setBirthForm((p) => ({ ...p, motherPatientId: e.target.value }))} placeholder="Mother patient ID" className="rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm" />
                <input value={birthForm.motherName} onChange={(e) => setBirthForm((p) => ({ ...p, motherName: e.target.value }))} placeholder="Mother name" className="rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm" />
                <input value={birthForm.motherPhone} onChange={(e) => setBirthForm((p) => ({ ...p, motherPhone: e.target.value }))} placeholder="Mother phone" className="rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm" />
                <input value={birthForm.motherVillage} onChange={(e) => setBirthForm((p) => ({ ...p, motherVillage: e.target.value }))} placeholder="Mother village" className="rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm" />
                <input value={birthForm.motherAgeYears} onChange={(e) => setBirthForm((p) => ({ ...p, motherAgeYears: e.target.value }))} placeholder="Mother age" className="rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm" />
                <input value={birthForm.motherParity} onChange={(e) => setBirthForm((p) => ({ ...p, motherParity: e.target.value }))} placeholder="Parity" className="rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm" />
                <input value={birthForm.antenatalVisits} onChange={(e) => setBirthForm((p) => ({ ...p, antenatalVisits: e.target.value }))} placeholder="ANC visits" className="rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm" />
                <input type="date" value={birthForm.lastAncDate} onChange={(e) => setBirthForm((p) => ({ ...p, lastAncDate: e.target.value }))} className="rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm" />
                <input type="date" value={birthForm.birthDate} onChange={(e) => setBirthForm((p) => ({ ...p, birthDate: e.target.value }))} className="rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm" />
                <input type="time" value={birthForm.birthTime} onChange={(e) => setBirthForm((p) => ({ ...p, birthTime: e.target.value }))} className="rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm" />
                <input value={birthForm.birthPlaceDescription} onChange={(e) => setBirthForm((p) => ({ ...p, birthPlaceDescription: e.target.value }))} placeholder="Birth place" className="rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm" />
                <input value={birthForm.gestationalAgeWeeks} onChange={(e) => setBirthForm((p) => ({ ...p, gestationalAgeWeeks: e.target.value }))} placeholder="Gestational age weeks" className="rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm" />
                <select value={birthForm.babySex} onChange={(e) => setBirthForm((p) => ({ ...p, babySex: e.target.value }))} className="rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm"><option value="female">Female</option><option value="male">Male</option><option value="unknown">Unknown</option></select>
                <input value={birthForm.birthWeightKg} onChange={(e) => setBirthForm((p) => ({ ...p, birthWeightKg: e.target.value }))} placeholder="Birth weight (kg)" className="rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm" />
                <input value={birthForm.apgarScore} onChange={(e) => setBirthForm((p) => ({ ...p, apgarScore: e.target.value }))} placeholder="Apgar score" className="rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm" />
                <select value={birthForm.birthOutcome} onChange={(e) => setBirthForm((p) => ({ ...p, birthOutcome: e.target.value }))} className="rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm"><option value="live_birth">Live birth</option><option value="fresh_stillbirth">Fresh stillbirth</option><option value="macerated_stillbirth">Macerated stillbirth</option></select>
                <input value={birthForm.distanceToFacilityKm} onChange={(e) => setBirthForm((p) => ({ ...p, distanceToFacilityKm: e.target.value }))} placeholder="Distance to facility (km)" className="rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm" />
                <input value={birthForm.cordCutWith} onChange={(e) => setBirthForm((p) => ({ ...p, cordCutWith: e.target.value }))} placeholder="Cord cut with" className="rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm" />
                <input value={birthForm.referralFacility} onChange={(e) => setBirthForm((p) => ({ ...p, referralFacility: e.target.value }))} placeholder="Referral facility" className="rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm" />
                <input value={birthForm.referralOutcome} onChange={(e) => setBirthForm((p) => ({ ...p, referralOutcome: e.target.value }))} placeholder="Referral outcome" className="rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm" />
              </div>
              <div className="mt-3 grid gap-3 md:grid-cols-2">
                <label className="flex items-center gap-2 rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm"><input type="checkbox" checked={birthForm.babyAlive} onChange={(e) => setBirthForm((p) => ({ ...p, babyAlive: e.target.checked }))} />Baby alive</label>
                <label className="flex items-center gap-2 rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm"><input type="checkbox" checked={birthForm.maternalAlive} onChange={(e) => setBirthForm((p) => ({ ...p, maternalAlive: e.target.checked }))} />Mother alive</label>
                <label className="flex items-center gap-2 rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm"><input type="checkbox" checked={birthForm.multipleBirth} onChange={(e) => setBirthForm((p) => ({ ...p, multipleBirth: e.target.checked }))} />Multiple birth</label>
                <input value={birthForm.multipleBirthCount} onChange={(e) => setBirthForm((p) => ({ ...p, multipleBirthCount: e.target.value }))} placeholder="Multiple birth count" className="rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm" />
                <label className="flex items-center gap-2 rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm"><input type="checkbox" checked={birthForm.misoprostolGiven} onChange={(e) => setBirthForm((p) => ({ ...p, misoprostolGiven: e.target.checked }))} />Misoprostol given</label>
                <label className="flex items-center gap-2 rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm"><input type="checkbox" checked={birthForm.vitaminKGiven} onChange={(e) => setBirthForm((p) => ({ ...p, vitaminKGiven: e.target.checked }))} />Vitamin K given</label>
                <label className="flex items-center gap-2 rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm"><input type="checkbox" checked={birthForm.eyeCareGiven} onChange={(e) => setBirthForm((p) => ({ ...p, eyeCareGiven: e.target.checked }))} />Eye care given</label>
                <label className="flex items-center gap-2 rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm"><input type="checkbox" checked={birthForm.breastfeedingInitiated} onChange={(e) => setBirthForm((p) => ({ ...p, breastfeedingInitiated: e.target.checked }))} />Breastfeeding initiated</label>
              </div>
              <textarea value={birthForm.previousComplications} onChange={(e) => setBirthForm((p) => ({ ...p, previousComplications: e.target.value }))} placeholder="Previous complications CSV" className="mt-3 min-h-[80px] w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm" />
              <textarea value={birthForm.maternalComplications} onChange={(e) => setBirthForm((p) => ({ ...p, maternalComplications: e.target.value }))} placeholder="Current maternal complications CSV" className="mt-3 min-h-[100px] w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm" />
              <button type="button" onClick={recordBirth} className="mt-4 rounded-xl bg-cyan-500 px-4 py-2 text-sm font-semibold text-slate-950 hover:bg-cyan-400">Save Home Birth</button>
            </div>

            <div className="space-y-4">
              {births.some((birth) => birth.referred) && (
                <div className="rounded-2xl border border-red-500/40 bg-red-500/10 p-4 text-sm text-red-100">
                  <div className="flex items-start gap-3">
                    <AlertTriangle className="mt-0.5 h-5 w-5" />
                    <div>
                      <p className="font-semibold">Immediate referral required</p>
                      <p className="mt-1">One or more recent home births triggered urgent referral guidance. Review the risk panel and notify the receiving facility promptly.</p>
                    </div>
                  </div>
                </div>
              )}
              <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-5">
                <h2 className="text-lg font-semibold text-white">Recorded Home Births</h2>
                <div className="mt-4 space-y-3">
                  {births.map((birth) => (
                    <div key={birth.id} className="rounded-xl border border-slate-800 bg-slate-950/70 p-4">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <p className="text-sm font-semibold text-white">{birth.motherName}</p>
                          <p className="mt-1 text-xs text-slate-400">{birth.birthDate} · {birth.birthOutcome}</p>
                          <div className="mt-2 flex flex-wrap gap-2">
                            <span className={`inline-flex rounded-full border px-2.5 py-0.5 text-xs ${riskBadge(birth.cdssRiskLevel)}`}>{birth.cdssRiskLevel || 'unscored'}</span>
                            <span className={`inline-flex rounded-full border px-2.5 py-0.5 text-xs ${birth.crvsNotified ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-100' : 'border-slate-700 bg-slate-900 text-slate-300'}`}>{birth.crvsNotified ? 'CRVS notified' : 'Unregistered'}</span>
                            {birth.referred && <span className="inline-flex rounded-full border border-red-500/40 bg-red-500/10 px-2.5 py-0.5 text-xs text-red-100">Immediate referral</span>}
                          </div>
                          {birth.cdssRecommendation && <p className="mt-2 text-sm text-slate-300">{birth.cdssRecommendation}</p>}
                          {birth.referralReason && <p className="mt-1 text-xs text-red-200">Referral reason: {birth.referralReason}</p>}
                        </div>
                        {!birth.crvsNotified && <button type="button" onClick={() => void notifyCrvs(birth.id)} className="rounded-lg border border-cyan-500/40 px-3 py-1.5 text-xs text-cyan-100">Notify CRVS</button>}
                      </div>
                    </div>
                  ))}
                  {!births.length && <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-6 text-sm text-slate-400">No home births recorded yet.</div>}
                </div>
              </div>
            </div>
          </div>
        )}

        {tab === 'summary' && (
          <div className="space-y-6">
            <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-5">
              <div className="flex gap-2">
                <input value={districtFilter} onChange={(e) => setDistrictFilter(e.target.value)} placeholder="District for summary" className="flex-1 rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm" />
                <button type="button" onClick={() => void loadData()} className="rounded-xl border border-slate-700 px-4 py-2 text-sm text-slate-200">Load</button>
              </div>
            </div>
            <div className="grid gap-4 md:grid-cols-3 xl:grid-cols-6">
              <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-4"><div className="flex items-center gap-2 text-slate-300"><Users className="h-4 w-4 text-cyan-300" />TBA count</div><p className="mt-3 text-3xl font-semibold text-white">{summary?.tbaCount ?? 0}</p></div>
              <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-4"><div className="flex items-center gap-2 text-slate-300"><ClipboardCheck className="h-4 w-4 text-emerald-300" />Active %</div><p className="mt-3 text-3xl font-semibold text-white">{summary?.activePercent ?? 0}%</p></div>
              <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-4"><div className="flex items-center gap-2 text-slate-300"><ShieldAlert className="h-4 w-4 text-red-300" />High-risk TBAs</div><p className="mt-3 text-3xl font-semibold text-white">{summary?.highRiskTbaCount ?? 0}</p></div>
              <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-4"><div className="flex items-center gap-2 text-slate-300"><Home className="h-4 w-4 text-cyan-300" />Home births</div><p className="mt-3 text-3xl font-semibold text-white">{summary?.homeBirthsThisMonth ?? 0}</p></div>
              <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-4"><div className="flex items-center gap-2 text-slate-300"><AlertTriangle className="h-4 w-4 text-amber-300" />Unregistered births</div><p className="mt-3 text-3xl font-semibold text-white">{summary?.unregisteredBirths ?? 0}</p></div>
              <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-4"><div className="flex items-center gap-2 text-slate-300"><Baby className="h-4 w-4 text-rose-300" />Deaths</div><p className="mt-3 text-3xl font-semibold text-white">{(summary?.maternalDeaths ?? 0) + (summary?.neonatalDeaths ?? 0)}</p></div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default TbaDashboard;
