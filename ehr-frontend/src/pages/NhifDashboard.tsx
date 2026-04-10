import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  BadgeDollarSign,
  CreditCard,
  FileCheck2,
  RefreshCw,
  ShieldCheck,
  Users,
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

type TabKey = 'schemes' | 'members' | 'claims' | 'capitation';

interface NhifDashboardProps {
  tenantSlug?: string;
  token?: string;
}

interface SchemeRow {
  id: string;
  schemeCode: string;
  schemeName: string;
  countryCode: string;
  paymentModel: string;
  capitationRate: number | null;
  capitationCurrency: string | null;
  apiBaseUrl: string | null;
  apiKeyEnvVar: string | null;
}

interface MemberRow {
  id: string;
  patientId: string;
  nhifSchemeId: string | null;
  memberNumber: string;
  principalMemberNumber: string | null;
  relationship: string | null;
  enrollmentDate: string;
  expiryDate: string | null;
  status: string;
  contributionAmount: number | null;
  contributionFrequency: string | null;
}

interface ClaimRow {
  id: string;
  invoiceId: string;
  patientId: string;
  schemeMemberId: string | null;
  nhifSchemeId: string | null;
  claimNumber: string | null;
  claimDate: string;
  visitType: string | null;
  diagnosisIcd10: string | null;
  procedureCodes: string[] | null;
  claimedAmount: number | null;
  approvedAmount: number | null;
  copayAmount: number | null;
  status: string;
  schemeReference: string | null;
}

interface CapitationRow {
  id?: string;
  nhif_scheme_id?: string | null;
  nhifSchemeId?: string | null;
  payment_month?: string;
  paymentMonth?: string;
  member_count?: number;
  memberCount?: number;
  rate_per_member?: number;
  ratePerMember?: number;
  total_amount?: number;
  totalAmount?: number;
  currency: string;
  received_date?: string | null;
  receivedDate?: string | null;
  reference?: string | null;
  notes?: string | null;
}

const authHeaders = (token: string, tenantSlug: string) => ({
  Authorization: `Bearer ${token}`,
  'X-Tenant-ID': tenantSlug,
});

const getStoredToken = () => localStorage.getItem('ehr_token') || localStorage.getItem('token') || '';
const todayIso = () => new Date().toISOString().slice(0, 10);
const currentMonthIso = () => new Date().toISOString().slice(0, 7);

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

const ModalPanel: React.FC<{ title: string; onClose: () => void; children: React.ReactNode }> = ({
  title,
  onClose,
  children,
}) => (
  <div className="rounded-2xl border border-slate-800 bg-slate-950 p-4">
    <div className="mb-3 flex items-center justify-between">
      <h3 className="text-sm font-semibold text-white">{title}</h3>
      <button
        type="button"
        onClick={onClose}
        className="rounded-lg border border-slate-800 px-2.5 py-1 text-xs text-slate-300 hover:text-white"
      >
        Dismiss
      </button>
    </div>
    {children}
  </div>
);

const NhifDashboard: React.FC<NhifDashboardProps> = ({ tenantSlug: tenantSlugProp, token: tokenProp }) => {
  const params = useParams<{ tenantSlug: string }>();
  const tenantSlug = tenantSlugProp || params.tenantSlug || '';
  const token = tokenProp || getStoredToken();
  const navigate = useNavigate();
  const { showError, showSuccess } = useNotification();

  const [tab, setTab] = useState<TabKey>('schemes');
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const [schemes, setSchemes] = useState<SchemeRow[]>([]);
  const [members, setMembers] = useState<MemberRow[]>([]);
  const [claims, setClaims] = useState<ClaimRow[]>([]);
  const [claimsTotal, setClaimsTotal] = useState(0);
  const [capitation, setCapitation] = useState<CapitationRow[]>([]);

  const [patientSearchId, setPatientSearchId] = useState('');
  const [eligibilityResult, setEligibilityResult] = useState<any | null>(null);

  const [schemeForm, setSchemeForm] = useState({
    schemeCode: '',
    schemeName: '',
    countryCode: 'KEN',
    paymentModel: 'capitation',
    capitationRate: '',
    capitationCurrency: 'USD',
    apiBaseUrl: '',
    apiKeyEnvVar: '',
  });

  const [memberForm, setMemberForm] = useState({
    patientId: '',
    nhifSchemeId: '',
    memberNumber: '',
    principalMemberNumber: '',
    relationship: 'self',
    enrollmentDate: todayIso(),
    expiryDate: '',
    status: 'active',
    contributionAmount: '',
    contributionFrequency: 'monthly',
  });

  const [claimFilters, setClaimFilters] = useState({
    status: '',
    schemeId: '',
    from: '',
    to: '',
    page: 1,
    limit: 20,
  });
  const [claimForm, setClaimForm] = useState({
    invoiceId: '',
    patientId: '',
    schemeMemberId: '',
    nhifSchemeId: '',
    claimNumber: '',
    claimDate: todayIso(),
    visitType: 'outpatient',
    diagnosisIcd10: '',
    procedureCodes: '',
    claimedAmount: '',
    approvedAmount: '',
    copayAmount: '',
    status: 'submitted',
    schemeReference: '',
    rejectionReason: '',
  });
  const [claimUpdateState, setClaimUpdateState] = useState<Record<string, string>>({});

  const [capitationForm, setCapitationForm] = useState({
    nhifSchemeId: '',
    paymentMonth: `${currentMonthIso()}-01`,
    memberCount: '',
    ratePerMember: '',
    totalAmount: '',
    currency: 'USD',
    receivedDate: todayIso(),
    reference: '',
    notes: '',
  });

  const requestConfig = useMemo(() => {
    if (!tenantSlug || !token) return null;
    return { headers: authHeaders(token, tenantSlug) };
  }, [tenantSlug, token]);

  useEffect(() => {
    const memberCount = Number(capitationForm.memberCount || 0);
    const ratePerMember = Number(capitationForm.ratePerMember || 0);
    const totalAmount = memberCount * ratePerMember;
    setCapitationForm((prev) => ({
      ...prev,
      totalAmount: totalAmount ? totalAmount.toFixed(2) : '',
    }));
  }, [capitationForm.memberCount, capitationForm.ratePerMember]);

  const loadSchemes = useCallback(async () => {
    if (!requestConfig) return;
    const res = await ehrAxios.get('/nhif/schemes', requestConfig);
    setSchemes(res.data ?? []);
  }, [requestConfig]);

  const loadClaims = useCallback(async () => {
    if (!requestConfig) return;
    const params = {
      status: claimFilters.status || undefined,
      schemeId: claimFilters.schemeId || undefined,
      from: claimFilters.from || undefined,
      to: claimFilters.to || undefined,
      page: claimFilters.page,
      limit: claimFilters.limit,
    };
    const res = await ehrAxios.get('/nhif/claims', { ...requestConfig, params });
    setClaims(res.data.data ?? []);
    setClaimsTotal(res.data.total ?? 0);
  }, [claimFilters, requestConfig]);

  const loadCapitation = useCallback(async () => {
    if (!requestConfig) return;
    const res = await ehrAxios.get('/nhif/capitation/report', {
      ...requestConfig,
      params: { schemeId: claimFilters.schemeId || undefined },
    });
    setCapitation(res.data ?? []);
  }, [claimFilters.schemeId, requestConfig]);

  useEffect(() => {
    loadSchemes().catch((error: any) => showError('NHIF schemes', apiError(error, 'Failed to load schemes')));
  }, [loadSchemes, showError]);

  useEffect(() => {
    if (tab !== 'claims') return;
    loadClaims().catch((error: any) => showError('NHIF claims', apiError(error, 'Failed to load claims')));
  }, [loadClaims, showError, tab]);

  useEffect(() => {
    if (tab !== 'capitation') return;
    loadCapitation().catch((error: any) => showError('Capitation', apiError(error, 'Failed to load capitation report')));
  }, [loadCapitation, showError, tab]);

  const loadMembers = async () => {
    if (!requestConfig || !patientSearchId) {
      setMembers([]);
      return;
    }
    const res = await ehrAxios.get(`/nhif/members/${patientSearchId}`, requestConfig);
    setMembers(res.data ?? []);
  };

  const refreshCurrentTab = async () => {
    setRefreshing(true);
    try {
      if (tab === 'schemes') {
        await loadSchemes();
      } else if (tab === 'members') {
        await loadMembers();
      } else if (tab === 'claims') {
        await loadClaims();
      } else if (tab === 'capitation') {
        await loadCapitation();
      }
      showSuccess('Refreshed', 'NHIF dashboard data refreshed successfully.');
    } catch (error: any) {
      showError('Refresh', apiError(error, 'Failed to refresh NHIF dashboard'));
    } finally {
      setRefreshing(false);
    }
  };

  const handleCreateScheme = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!requestConfig) return;

    try {
      setLoading(true);
      await ehrAxios.post(
        '/nhif/schemes',
        {
          ...schemeForm,
          capitationRate: schemeForm.capitationRate ? Number(schemeForm.capitationRate) : null,
          capitationCurrency: schemeForm.capitationCurrency || null,
          apiBaseUrl: schemeForm.apiBaseUrl || null,
          apiKeyEnvVar: schemeForm.apiKeyEnvVar || null,
          isActive: true,
        },
        requestConfig,
      );
      await loadSchemes();
      setSchemeForm({
        schemeCode: '',
        schemeName: '',
        countryCode: 'KEN',
        paymentModel: 'capitation',
        capitationRate: '',
        capitationCurrency: 'USD',
        apiBaseUrl: '',
        apiKeyEnvVar: '',
      });
      showSuccess('Scheme created', 'NHIF/CBHI scheme saved successfully.');
    } catch (error: any) {
      showError('Create scheme', apiError(error, 'Failed to create scheme'));
    } finally {
      setLoading(false);
    }
  };

  const handleEnrollMember = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!requestConfig) return;

    try {
      setLoading(true);
      await ehrAxios.post(
        '/nhif/members',
        {
          ...memberForm,
          nhifSchemeId: memberForm.nhifSchemeId || null,
          principalMemberNumber: memberForm.principalMemberNumber || null,
          relationship: memberForm.relationship || null,
          expiryDate: memberForm.expiryDate || null,
          contributionAmount: memberForm.contributionAmount ? Number(memberForm.contributionAmount) : null,
          contributionFrequency: memberForm.contributionFrequency || null,
        },
        requestConfig,
      );
      if (patientSearchId === memberForm.patientId) {
        await loadMembers();
      }
      showSuccess('Member enrolled', 'Scheme member enrollment saved successfully.');
    } catch (error: any) {
      showError('Enroll member', apiError(error, 'Failed to enroll scheme member'));
    } finally {
      setLoading(false);
    }
  };

  const handleLoadMembers = async () => {
    try {
      await loadMembers();
      showSuccess('Members loaded', 'Patient memberships loaded successfully.');
    } catch (error: any) {
      showError('Load members', apiError(error, 'Failed to load patient memberships'));
    }
  };

  const handleCheckEligibility = async (memberId: string) => {
    if (!requestConfig) return;
    try {
      setLoading(true);
      const res = await ehrAxios.post(`/nhif/eligibility/${memberId}`, {}, requestConfig);
      setEligibilityResult(res.data);
      showSuccess('Eligibility checked', 'Eligibility response received.');
    } catch (error: any) {
      setEligibilityResult(error?.response?.data ?? { error: apiError(error, 'Eligibility API unreachable') });
      showError('Eligibility', apiError(error, 'Eligibility check failed'));
    } finally {
      setLoading(false);
    }
  };

  const handleSubmitClaim = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!requestConfig) return;

    try {
      setLoading(true);
      await ehrAxios.post(
        '/nhif/claims',
        {
          ...claimForm,
          schemeMemberId: claimForm.schemeMemberId || null,
          nhifSchemeId: claimForm.nhifSchemeId || null,
          claimNumber: claimForm.claimNumber || null,
          visitType: claimForm.visitType || null,
          diagnosisIcd10: claimForm.diagnosisIcd10 || null,
          procedureCodes: claimForm.procedureCodes
            ? claimForm.procedureCodes.split(',').map((item) => item.trim()).filter(Boolean)
            : null,
          claimedAmount: claimForm.claimedAmount ? Number(claimForm.claimedAmount) : null,
          approvedAmount: claimForm.approvedAmount ? Number(claimForm.approvedAmount) : null,
          copayAmount: claimForm.copayAmount ? Number(claimForm.copayAmount) : null,
          schemeReference: claimForm.schemeReference || null,
          rejectionReason: claimForm.rejectionReason || null,
        },
        requestConfig,
      );
      await loadClaims();
      showSuccess('Claim submitted', 'NHIF claim saved successfully.');
    } catch (error: any) {
      showError('Submit claim', apiError(error, 'Failed to submit claim'));
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateClaimStatus = async (claimId: string) => {
    if (!requestConfig) return;
    const nextStatus = claimUpdateState[claimId];
    if (!nextStatus) {
      showError('Validation', 'Select a claim status first.');
      return;
    }

    try {
      setLoading(true);
      await ehrAxios.patch(`/nhif/claims/${claimId}`, { status: nextStatus }, requestConfig);
      await loadClaims();
      showSuccess('Claim updated', 'Claim status updated successfully.');
    } catch (error: any) {
      showError('Update claim', apiError(error, 'Failed to update claim status'));
    } finally {
      setLoading(false);
    }
  };

  const handleRecordCapitation = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!requestConfig) return;

    try {
      setLoading(true);
      await ehrAxios.post(
        '/nhif/capitation',
        {
          nhifSchemeId: capitationForm.nhifSchemeId || null,
          paymentMonth: capitationForm.paymentMonth,
          memberCount: Number(capitationForm.memberCount || 0),
          ratePerMember: Number(capitationForm.ratePerMember || 0),
          totalAmount: Number(capitationForm.totalAmount || 0),
          currency: capitationForm.currency,
          receivedDate: capitationForm.receivedDate || null,
          reference: capitationForm.reference || null,
          notes: capitationForm.notes || null,
        },
        requestConfig,
      );
      await loadCapitation();
      showSuccess('Capitation recorded', 'Capitation payment saved successfully.');
    } catch (error: any) {
      showError('Capitation', apiError(error, 'Failed to record capitation payment'));
    } finally {
      setLoading(false);
    }
  };

  const capitationChartData = useMemo(
    () =>
      capitation.map((row) => ({
        month: (row.payment_month || row.paymentMonth || '').slice(0, 7),
        totalAmount: Number(row.total_amount ?? row.totalAmount ?? 0),
      })),
    [capitation],
  );

  const activeSchemeCount = schemes.length;
  const activeMembersCount = members.filter((member) => member.status === 'active').length;
  const submittedClaimsCount = claims.filter((claim) => claim.status === 'submitted').length;
  const capitationTotal = capitation.reduce((sum, row) => sum + Number(row.total_amount ?? row.totalAmount ?? 0), 0);

  return (
    <div className="min-h-screen bg-slate-950 px-4 py-6 text-slate-100 md:px-6">
      <div className="mx-auto max-w-7xl space-y-6">
        <div className="rounded-3xl border border-slate-800 bg-gradient-to-r from-slate-900 via-slate-900 to-cyan-950/60 p-6">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div className="space-y-3">
              <button
                type="button"
                onClick={() => navigate(`/ehr/${tenantSlug}/dashboard`)}
                className="inline-flex items-center gap-2 rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-slate-300 hover:text-white"
              >
                <ArrowLeft className="h-4 w-4" />
                Back to dashboard
              </button>
              <div>
                <p className="text-sm uppercase tracking-[0.28em] text-cyan-300">S134 NHIF / CBHI</p>
                <h1 className="mt-2 text-3xl font-semibold text-white">Capitation Billing Model</h1>
                <p className="mt-2 max-w-3xl text-sm text-slate-300">
                  Manage NHIF/CBHI schemes, enroll members, submit claims, track capitation payments,
                  and run live eligibility checks with real scheme endpoints or real API errors.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={refreshCurrentTab}
              disabled={refreshing}
              className="inline-flex items-center gap-2 rounded-xl border border-slate-800 bg-slate-900/80 px-4 py-2 text-sm font-medium text-slate-200 hover:border-slate-700 hover:text-white disabled:opacity-60"
            >
              <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
              Refresh
            </button>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <StatCard label="Active Schemes" value={activeSchemeCount} icon={<ShieldCheck className="h-5 w-5 text-white" />} tone="bg-cyan-500/20 text-cyan-200" />
          <StatCard label="Active Members" value={activeMembersCount} icon={<Users className="h-5 w-5 text-white" />} tone="bg-emerald-500/20 text-emerald-200" />
          <StatCard label="Submitted Claims" value={submittedClaimsCount} icon={<FileCheck2 className="h-5 w-5 text-white" />} tone="bg-amber-500/20 text-amber-200" />
          <StatCard label="Capitation Total" value={capitationTotal.toFixed(2)} icon={<BadgeDollarSign className="h-5 w-5 text-white" />} tone="bg-violet-500/20 text-violet-200" />
        </div>

        <div className="flex flex-wrap gap-2">
          <TabButton active={tab === 'schemes'} icon={<ShieldCheck className="h-4 w-4" />} label="Schemes" onClick={() => setTab('schemes')} />
          <TabButton active={tab === 'members'} icon={<Users className="h-4 w-4" />} label="Members" onClick={() => setTab('members')} />
          <TabButton active={tab === 'claims'} icon={<FileCheck2 className="h-4 w-4" />} label="Claims" onClick={() => setTab('claims')} />
          <TabButton active={tab === 'capitation'} icon={<CreditCard className="h-4 w-4" />} label="Capitation" onClick={() => setTab('capitation')} />
        </div>

        {tab === 'schemes' && (
          <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
            <section className="rounded-2xl border border-slate-800 bg-slate-900/80 p-5">
              <h2 className="mb-4 text-lg font-semibold text-white">Active Schemes</h2>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-slate-800 text-sm">
                  <thead>
                    <tr className="text-left text-slate-400">
                      <th className="px-3 py-2 font-medium">Scheme</th>
                      <th className="px-3 py-2 font-medium">Country</th>
                      <th className="px-3 py-2 font-medium">Model</th>
                      <th className="px-3 py-2 font-medium">Capitation</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800">
                    {schemes.map((scheme) => (
                      <tr key={scheme.id} className="text-slate-200">
                        <td className="px-3 py-3">
                          <div className="font-medium text-white">{scheme.schemeName}</div>
                          <div className="text-xs text-slate-400">{scheme.schemeCode}</div>
                        </td>
                        <td className="px-3 py-3">{scheme.countryCode}</td>
                        <td className="px-3 py-3">{scheme.paymentModel}</td>
                        <td className="px-3 py-3">
                          {scheme.capitationRate != null ? `${scheme.capitationRate} ${scheme.capitationCurrency || ''}` : 'n/a'}
                        </td>
                      </tr>
                    ))}
                    {schemes.length === 0 && (
                      <tr>
                        <td colSpan={4} className="px-3 py-6 text-center text-slate-400">No schemes found.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </section>

            <section className="rounded-2xl border border-slate-800 bg-slate-900/80 p-5">
              <h2 className="mb-4 text-lg font-semibold text-white">Add Scheme</h2>
              <form className="space-y-4" onSubmit={handleCreateScheme}>
                <div className="grid gap-4 md:grid-cols-2">
                  <input value={schemeForm.schemeCode} onChange={(event) => setSchemeForm((prev) => ({ ...prev, schemeCode: event.target.value }))} placeholder="Scheme code" className="rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-white" />
                  <input value={schemeForm.schemeName} onChange={(event) => setSchemeForm((prev) => ({ ...prev, schemeName: event.target.value }))} placeholder="Scheme name" className="rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-white" />
                  <select value={schemeForm.countryCode} onChange={(event) => setSchemeForm((prev) => ({ ...prev, countryCode: event.target.value }))} className="rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-white">
                    {['KEN', 'TZA', 'ZMB', 'ZWE', 'MOZ', 'BWA', 'NAM'].map((code) => <option key={code} value={code}>{code}</option>)}
                  </select>
                  <select value={schemeForm.paymentModel} onChange={(event) => setSchemeForm((prev) => ({ ...prev, paymentModel: event.target.value }))} className="rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-white">
                    {['capitation', 'fee_for_service', 'mixed'].map((item) => <option key={item} value={item}>{item}</option>)}
                  </select>
                  <input value={schemeForm.capitationRate} onChange={(event) => setSchemeForm((prev) => ({ ...prev, capitationRate: event.target.value }))} placeholder="Capitation rate" className="rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-white" />
                  <input value={schemeForm.capitationCurrency} onChange={(event) => setSchemeForm((prev) => ({ ...prev, capitationCurrency: event.target.value }))} placeholder="Currency" className="rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-white" />
                </div>
                <input value={schemeForm.apiBaseUrl} onChange={(event) => setSchemeForm((prev) => ({ ...prev, apiBaseUrl: event.target.value }))} placeholder="API base URL" className="w-full rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-white" />
                <input value={schemeForm.apiKeyEnvVar} onChange={(event) => setSchemeForm((prev) => ({ ...prev, apiKeyEnvVar: event.target.value }))} placeholder="API key env var" className="w-full rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-white" />
                <div className="flex justify-end">
                  <button type="submit" disabled={loading} className="rounded-xl bg-cyan-500 px-4 py-2 text-sm font-medium text-slate-950 hover:bg-cyan-400 disabled:opacity-60">
                    Save Scheme
                  </button>
                </div>
              </form>
            </section>
          </div>
        )}

        {tab === 'members' && (
          <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
            <section className="space-y-6">
              <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-5">
                <div className="mb-4 flex flex-col gap-3 md:flex-row">
                  <input value={patientSearchId} onChange={(event) => setPatientSearchId(event.target.value)} placeholder="Search patient ID" className="flex-1 rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-white" />
                  <button type="button" onClick={handleLoadMembers} className="rounded-xl border border-slate-800 bg-slate-950 px-4 py-2 text-sm text-slate-200 hover:text-white">
                    Load Memberships
                  </button>
                </div>
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-slate-800 text-sm">
                    <thead>
                      <tr className="text-left text-slate-400">
                        <th className="px-3 py-2 font-medium">Scheme ID</th>
                        <th className="px-3 py-2 font-medium">Member</th>
                        <th className="px-3 py-2 font-medium">Relationship</th>
                        <th className="px-3 py-2 font-medium">Enrollment</th>
                        <th className="px-3 py-2 font-medium">Expiry</th>
                        <th className="px-3 py-2 font-medium">Status</th>
                        <th className="px-3 py-2 font-medium">Contribution</th>
                        <th className="px-3 py-2 font-medium">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800">
                      {members.map((member) => (
                        <tr key={member.id} className="text-slate-200">
                          <td className="px-3 py-3">{member.nhifSchemeId || 'n/a'}</td>
                          <td className="px-3 py-3">
                            <div>{member.memberNumber}</div>
                            <div className="text-xs text-slate-400">{member.principalMemberNumber || 'principal n/a'}</div>
                          </td>
                          <td className="px-3 py-3">{member.relationship || 'n/a'}</td>
                          <td className="px-3 py-3">{member.enrollmentDate}</td>
                          <td className="px-3 py-3">{member.expiryDate || 'n/a'}</td>
                          <td className="px-3 py-3">{member.status}</td>
                          <td className="px-3 py-3">
                            {member.contributionAmount != null ? `${member.contributionAmount} ${member.contributionFrequency || ''}` : 'n/a'}
                          </td>
                          <td className="px-3 py-3">
                            <button type="button" onClick={() => handleCheckEligibility(member.id)} className="rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 text-xs text-slate-200 hover:text-white">
                              Check Eligibility
                            </button>
                          </td>
                        </tr>
                      ))}
                      {members.length === 0 && (
                        <tr>
                          <td colSpan={8} className="px-3 py-6 text-center text-slate-400">No memberships loaded yet.</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {eligibilityResult && (
                <ModalPanel title="Eligibility Result" onClose={() => setEligibilityResult(null)}>
                  <pre className="overflow-x-auto whitespace-pre-wrap text-xs text-slate-300">
                    {JSON.stringify(eligibilityResult, null, 2)}
                  </pre>
                </ModalPanel>
              )}
            </section>

            <section className="rounded-2xl border border-slate-800 bg-slate-900/80 p-5">
              <h2 className="mb-4 text-lg font-semibold text-white">Enroll Member</h2>
              <form className="space-y-4" onSubmit={handleEnrollMember}>
                <div className="grid gap-4 md:grid-cols-2">
                  <input value={memberForm.patientId} onChange={(event) => setMemberForm((prev) => ({ ...prev, patientId: event.target.value }))} placeholder="Patient ID" className="rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-white" />
                  <select value={memberForm.nhifSchemeId} onChange={(event) => setMemberForm((prev) => ({ ...prev, nhifSchemeId: event.target.value }))} className="rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-white">
                    <option value="">Select scheme</option>
                    {schemes.map((scheme) => <option key={scheme.id} value={scheme.id}>{scheme.schemeName}</option>)}
                  </select>
                  <input value={memberForm.memberNumber} onChange={(event) => setMemberForm((prev) => ({ ...prev, memberNumber: event.target.value }))} placeholder="Member number" className="rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-white" />
                  <input value={memberForm.principalMemberNumber} onChange={(event) => setMemberForm((prev) => ({ ...prev, principalMemberNumber: event.target.value }))} placeholder="Principal member number" className="rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-white" />
                  <input value={memberForm.relationship} onChange={(event) => setMemberForm((prev) => ({ ...prev, relationship: event.target.value }))} placeholder="Relationship" className="rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-white" />
                  <input type="date" value={memberForm.enrollmentDate} onChange={(event) => setMemberForm((prev) => ({ ...prev, enrollmentDate: event.target.value }))} className="rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-white" />
                  <input type="date" value={memberForm.expiryDate} onChange={(event) => setMemberForm((prev) => ({ ...prev, expiryDate: event.target.value }))} className="rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-white" />
                  <select value={memberForm.status} onChange={(event) => setMemberForm((prev) => ({ ...prev, status: event.target.value }))} className="rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-white">
                    {['active', 'inactive', 'suspended', 'expired'].map((item) => <option key={item} value={item}>{item}</option>)}
                  </select>
                  <input value={memberForm.contributionAmount} onChange={(event) => setMemberForm((prev) => ({ ...prev, contributionAmount: event.target.value }))} placeholder="Contribution amount" className="rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-white" />
                  <select value={memberForm.contributionFrequency} onChange={(event) => setMemberForm((prev) => ({ ...prev, contributionFrequency: event.target.value }))} className="rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-white">
                    {['monthly', 'quarterly', 'annual'].map((item) => <option key={item} value={item}>{item}</option>)}
                  </select>
                </div>
                <div className="flex justify-end">
                  <button type="submit" disabled={loading} className="rounded-xl bg-cyan-500 px-4 py-2 text-sm font-medium text-slate-950 hover:bg-cyan-400 disabled:opacity-60">
                    Enroll Member
                  </button>
                </div>
              </form>
            </section>
          </div>
        )}

        {tab === 'claims' && (
          <div className="space-y-6">
            <section className="rounded-2xl border border-slate-800 bg-slate-900/80 p-5">
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-6">
                <select value={claimFilters.status} onChange={(event) => setClaimFilters((prev) => ({ ...prev, status: event.target.value, page: 1 }))} className="rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-white">
                  <option value="">all</option>
                  {['submitted', 'approved', 'rejected', 'pending'].map((item) => <option key={item} value={item}>{item}</option>)}
                </select>
                <select value={claimFilters.schemeId} onChange={(event) => setClaimFilters((prev) => ({ ...prev, schemeId: event.target.value, page: 1 }))} className="rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-white">
                  <option value="">all schemes</option>
                  {schemes.map((scheme) => <option key={scheme.id} value={scheme.id}>{scheme.schemeName}</option>)}
                </select>
                <input type="date" value={claimFilters.from} onChange={(event) => setClaimFilters((prev) => ({ ...prev, from: event.target.value, page: 1 }))} className="rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-white" />
                <input type="date" value={claimFilters.to} onChange={(event) => setClaimFilters((prev) => ({ ...prev, to: event.target.value, page: 1 }))} className="rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-white" />
                <input type="number" min="1" value={claimFilters.page} onChange={(event) => setClaimFilters((prev) => ({ ...prev, page: Number(event.target.value) || 1 }))} className="rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-white" />
                <input type="number" min="1" max="100" value={claimFilters.limit} onChange={(event) => setClaimFilters((prev) => ({ ...prev, limit: Number(event.target.value) || 20, page: 1 }))} className="rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-white" />
              </div>
              <p className="mt-3 text-sm text-slate-400">Total claims: {claimsTotal}</p>
            </section>

            <div className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
              <section className="rounded-2xl border border-slate-800 bg-slate-900/80 p-5">
                <h2 className="mb-4 text-lg font-semibold text-white">Claims List</h2>
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-slate-800 text-sm">
                    <thead>
                      <tr className="text-left text-slate-400">
                        <th className="px-3 py-2 font-medium">Date</th>
                        <th className="px-3 py-2 font-medium">Invoice</th>
                        <th className="px-3 py-2 font-medium">Patient</th>
                        <th className="px-3 py-2 font-medium">Scheme</th>
                        <th className="px-3 py-2 font-medium">Claimed</th>
                        <th className="px-3 py-2 font-medium">Copay</th>
                        <th className="px-3 py-2 font-medium">Approved</th>
                        <th className="px-3 py-2 font-medium">Status</th>
                        <th className="px-3 py-2 font-medium">Reference</th>
                        <th className="px-3 py-2 font-medium">Update</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800">
                      {claims.map((claim) => (
                        <tr key={claim.id} className="text-slate-200">
                          <td className="px-3 py-3">{claim.claimDate}</td>
                          <td className="px-3 py-3">{claim.invoiceId}</td>
                          <td className="px-3 py-3">{claim.patientId}</td>
                          <td className="px-3 py-3">{claim.nhifSchemeId || 'n/a'}</td>
                          <td className="px-3 py-3">{claim.claimedAmount ?? 'n/a'}</td>
                          <td className="px-3 py-3">{claim.copayAmount ?? 'n/a'}</td>
                          <td className="px-3 py-3">{claim.approvedAmount ?? 'n/a'}</td>
                          <td className="px-3 py-3">{claim.status}</td>
                          <td className="px-3 py-3">{claim.schemeReference || 'n/a'}</td>
                          <td className="px-3 py-3">
                            <div className="flex gap-2">
                              <select value={claimUpdateState[claim.id] || ''} onChange={(event) => setClaimUpdateState((prev) => ({ ...prev, [claim.id]: event.target.value }))} className="rounded-lg border border-slate-800 bg-slate-950 px-2 py-1 text-xs text-white">
                                <option value="">status</option>
                                {['submitted', 'approved', 'rejected', 'pending', 'settled'].map((item) => <option key={item} value={item}>{item}</option>)}
                              </select>
                              <button type="button" onClick={() => handleUpdateClaimStatus(claim.id)} className="rounded-lg border border-slate-800 bg-slate-950 px-2 py-1 text-xs text-slate-200 hover:text-white">
                                Save
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                      {claims.length === 0 && (
                        <tr>
                          <td colSpan={10} className="px-3 py-6 text-center text-slate-400">No claims found.</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </section>

              <section className="rounded-2xl border border-slate-800 bg-slate-900/80 p-5">
                <h2 className="mb-4 text-lg font-semibold text-white">Submit Claim</h2>
                <form className="space-y-4" onSubmit={handleSubmitClaim}>
                  <div className="grid gap-4 md:grid-cols-2">
                    <input value={claimForm.invoiceId} onChange={(event) => setClaimForm((prev) => ({ ...prev, invoiceId: event.target.value }))} placeholder="Invoice ID" className="rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-white" />
                    <input value={claimForm.patientId} onChange={(event) => setClaimForm((prev) => ({ ...prev, patientId: event.target.value }))} placeholder="Patient ID" className="rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-white" />
                    <input value={claimForm.schemeMemberId} onChange={(event) => setClaimForm((prev) => ({ ...prev, schemeMemberId: event.target.value }))} placeholder="Scheme member ID" className="rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-white" />
                    <select value={claimForm.nhifSchemeId} onChange={(event) => setClaimForm((prev) => ({ ...prev, nhifSchemeId: event.target.value }))} className="rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-white">
                      <option value="">Select scheme</option>
                      {schemes.map((scheme) => <option key={scheme.id} value={scheme.id}>{scheme.schemeName}</option>)}
                    </select>
                    <input value={claimForm.claimNumber} onChange={(event) => setClaimForm((prev) => ({ ...prev, claimNumber: event.target.value }))} placeholder="Claim number" className="rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-white" />
                    <input type="date" value={claimForm.claimDate} onChange={(event) => setClaimForm((prev) => ({ ...prev, claimDate: event.target.value }))} className="rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-white" />
                    <input value={claimForm.visitType} onChange={(event) => setClaimForm((prev) => ({ ...prev, visitType: event.target.value }))} placeholder="Visit type" className="rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-white" />
                    <input value={claimForm.diagnosisIcd10} onChange={(event) => setClaimForm((prev) => ({ ...prev, diagnosisIcd10: event.target.value }))} placeholder="Diagnosis ICD-10" className="rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-white" />
                    <input value={claimForm.procedureCodes} onChange={(event) => setClaimForm((prev) => ({ ...prev, procedureCodes: event.target.value }))} placeholder="Procedure codes comma-separated" className="rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-white md:col-span-2" />
                    <input value={claimForm.claimedAmount} onChange={(event) => setClaimForm((prev) => ({ ...prev, claimedAmount: event.target.value }))} placeholder="Claimed amount" className="rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-white" />
                    <input value={claimForm.copayAmount} onChange={(event) => setClaimForm((prev) => ({ ...prev, copayAmount: event.target.value }))} placeholder="Copay amount" className="rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-white" />
                    <input value={claimForm.approvedAmount} onChange={(event) => setClaimForm((prev) => ({ ...prev, approvedAmount: event.target.value }))} placeholder="Approved amount" className="rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-white" />
                    <input value={claimForm.schemeReference} onChange={(event) => setClaimForm((prev) => ({ ...prev, schemeReference: event.target.value }))} placeholder="Scheme reference" className="rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-white" />
                  </div>
                  <div className="flex justify-end">
                    <button type="submit" disabled={loading} className="rounded-xl bg-cyan-500 px-4 py-2 text-sm font-medium text-slate-950 hover:bg-cyan-400 disabled:opacity-60">
                      Save Claim
                    </button>
                  </div>
                </form>
              </section>
            </div>
          </div>
        )}

        {tab === 'capitation' && (
          <div className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
            <section className="rounded-2xl border border-slate-800 bg-slate-900/80 p-5">
              <h2 className="mb-4 text-lg font-semibold text-white">Record Payment</h2>
              <form className="space-y-4" onSubmit={handleRecordCapitation}>
                <div className="grid gap-4 md:grid-cols-2">
                  <select value={capitationForm.nhifSchemeId} onChange={(event) => setCapitationForm((prev) => ({ ...prev, nhifSchemeId: event.target.value }))} className="rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-white">
                    <option value="">Select scheme</option>
                    {schemes.map((scheme) => <option key={scheme.id} value={scheme.id}>{scheme.schemeName}</option>)}
                  </select>
                  <input type="date" value={capitationForm.paymentMonth} onChange={(event) => setCapitationForm((prev) => ({ ...prev, paymentMonth: event.target.value }))} className="rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-white" />
                  <input value={capitationForm.memberCount} onChange={(event) => setCapitationForm((prev) => ({ ...prev, memberCount: event.target.value }))} placeholder="Member count" className="rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-white" />
                  <input value={capitationForm.ratePerMember} onChange={(event) => setCapitationForm((prev) => ({ ...prev, ratePerMember: event.target.value }))} placeholder="Rate per member" className="rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-white" />
                  <input value={capitationForm.totalAmount} readOnly placeholder="Total amount" className="rounded-xl border border-slate-800 bg-slate-900 px-3 py-2 text-sm text-slate-200" />
                  <input value={capitationForm.currency} onChange={(event) => setCapitationForm((prev) => ({ ...prev, currency: event.target.value }))} placeholder="Currency" className="rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-white" />
                  <input type="date" value={capitationForm.receivedDate} onChange={(event) => setCapitationForm((prev) => ({ ...prev, receivedDate: event.target.value }))} className="rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-white" />
                  <input value={capitationForm.reference} onChange={(event) => setCapitationForm((prev) => ({ ...prev, reference: event.target.value }))} placeholder="Reference" className="rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-white" />
                </div>
                <textarea value={capitationForm.notes} onChange={(event) => setCapitationForm((prev) => ({ ...prev, notes: event.target.value }))} placeholder="Notes" rows={4} className="w-full rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-white" />
                <div className="flex justify-end">
                  <button type="submit" disabled={loading} className="rounded-xl bg-cyan-500 px-4 py-2 text-sm font-medium text-slate-950 hover:bg-cyan-400 disabled:opacity-60">
                    Save Payment
                  </button>
                </div>
              </form>
            </section>

            <section className="space-y-6">
              <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-5">
                <h2 className="mb-4 text-lg font-semibold text-white">Monthly Total Received</h2>
                <div className="h-72">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={capitationChartData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                      <XAxis dataKey="month" stroke="#94a3b8" />
                      <YAxis stroke="#94a3b8" />
                      <Tooltip />
                      <Bar dataKey="totalAmount" radius={[8, 8, 0, 0]} fill="#22d3ee" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-5">
                <h2 className="mb-4 text-lg font-semibold text-white">Capitation Log</h2>
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-slate-800 text-sm">
                    <thead>
                      <tr className="text-left text-slate-400">
                        <th className="px-3 py-2 font-medium">Month</th>
                        <th className="px-3 py-2 font-medium">Members</th>
                        <th className="px-3 py-2 font-medium">Rate</th>
                        <th className="px-3 py-2 font-medium">Total</th>
                        <th className="px-3 py-2 font-medium">Received</th>
                        <th className="px-3 py-2 font-medium">Reference</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800">
                      {capitation.map((row, index) => (
                        <tr key={`${row.nhif_scheme_id || row.nhifSchemeId || 'scheme'}-${row.payment_month || row.paymentMonth || index}`} className="text-slate-200">
                          <td className="px-3 py-3">{row.payment_month || row.paymentMonth}</td>
                          <td className="px-3 py-3">{row.member_count ?? row.memberCount ?? 0}</td>
                          <td className="px-3 py-3">{row.rate_per_member ?? row.ratePerMember ?? 0}</td>
                          <td className="px-3 py-3">{row.total_amount ?? row.totalAmount ?? 0}</td>
                          <td className="px-3 py-3">{row.received_date || row.receivedDate || 'n/a'}</td>
                          <td className="px-3 py-3">{row.reference || 'n/a'}</td>
                        </tr>
                      ))}
                      {capitation.length === 0 && (
                        <tr>
                          <td colSpan={6} className="px-3 py-6 text-center text-slate-400">No capitation payments recorded yet.</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </section>
          </div>
        )}
      </div>
    </div>
  );
};

export default NhifDashboard;
