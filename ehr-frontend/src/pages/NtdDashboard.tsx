import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ArrowLeft, Bug, CalendarDays, RefreshCw, Stethoscope } from 'lucide-react';
import { useNavigate, useParams } from 'react-router-dom';
import { useNotification } from '../components/GlobalNotification';
import { ehrAxios } from '../services/api';
import NtdClinicalDepthDashboard from '../components/ntd/NtdDashboard';

interface NtdDashboardProps {
  tenantSlug: string;
  token?: string;
}

type TabKey = 'assessments' | 'campaigns' | 'clinical_depth';

const diseaseTypes = [
  'schistosomiasis',
  'filariasis',
  'trachoma',
  'leprosy',
  'HAT (sleeping sickness)',
  'onchocerciasis',
];

const getToken = () => localStorage.getItem('ehr_token') || localStorage.getItem('token') || '';
const todayIso = () => new Date().toISOString().slice(0, 10);

const apiError = (error: any, fallback: string) =>
  error?.response?.data?.message || error?.message || fallback;

const NtdDashboard: React.FC<NtdDashboardProps> = ({ tenantSlug: tenantSlugProp, token: tokenProp }) => {
  const params = useParams<{ tenantSlug: string }>();
  const tenantSlug = tenantSlugProp || params.tenantSlug || '';
  const token = tokenProp || getToken();
  const navigate = useNavigate();
  const { showError, showSuccess } = useNotification();

  const [tab, setTab] = useState<TabKey>('assessments');
  const [loading, setLoading] = useState(false);
  const [assessmentPatientId, setAssessmentPatientId] = useState('');
  const [assessmentHistory, setAssessmentHistory] = useState<any[]>([]);
  const [campaigns, setCampaigns] = useState<any[]>([]);
  const [sessionCounts, setSessionCounts] = useState<Record<string, string>>({});

  const [assessmentForm, setAssessmentForm] = useState({
    patientId: '',
    diseaseType: diseaseTypes[0],
    assessmentDate: todayIso(),
    diseaseStage: '',
    disabilityGrade: '',
    mdaEligible: 'unknown',
    treatmentGiven: '',
    doseMg: '',
    lotNumber: '',
    followUpDate: '',
    notes: '',
  });

  const [campaignForm, setCampaignForm] = useState({
    campaignName: '',
    diseaseType: diseaseTypes[0],
    drugName: '',
    startDate: todayIso(),
    endDate: todayIso(),
    targetPopulation: '',
    coverageArea: '',
    dhis2DatasetUid: '',
  });

  const headers = useMemo(
    () => ({
      Authorization: `Bearer ${token}`,
      'X-Tenant-ID': tenantSlug,
    }),
    [tenantSlug, token],
  );

  const loadCampaigns = useCallback(async () => {
    const { data } = await ehrAxios.get('/ntd/mda/campaigns', { headers });
    setCampaigns(Array.isArray(data) ? data : []);
  }, [headers]);

  const loadAssessments = useCallback(async (patientId: string) => {
    if (!patientId.trim()) {
      setAssessmentHistory([]);
      return;
    }
    const { data } = await ehrAxios.get(`/ntd/assessments/${encodeURIComponent(patientId.trim())}`, { headers });
    setAssessmentHistory(Array.isArray(data) ? data : []);
  }, [headers]);

  const refresh = useCallback(async () => {
    if (!tenantSlug || !token) return;
    setLoading(true);
    try {
      await Promise.all([
        loadCampaigns(),
        assessmentPatientId.trim() ? loadAssessments(assessmentPatientId) : Promise.resolve(),
      ]);
    } catch (error: any) {
      showError('Refresh failed', apiError(error, 'Unable to refresh NTD data.'));
    } finally {
      setLoading(false);
    }
  }, [assessmentPatientId, loadAssessments, loadCampaigns, showError, tenantSlug, token]);

  useEffect(() => {
    void loadCampaigns();
  }, [loadCampaigns]);

  const submitAssessment = async () => {
    try {
      await ehrAxios.post(
        '/ntd/assess',
        {
          ...assessmentForm,
          disabilityGrade: assessmentForm.disabilityGrade || null,
          mdaEligible:
            assessmentForm.mdaEligible === 'unknown'
              ? null
              : assessmentForm.mdaEligible === 'true',
          doseMg: assessmentForm.doseMg || null,
          followUpDate: assessmentForm.followUpDate || null,
          diseaseStage: assessmentForm.diseaseStage || null,
          treatmentGiven: assessmentForm.treatmentGiven || null,
          lotNumber: assessmentForm.lotNumber || null,
          notes: assessmentForm.notes || null,
        },
        { headers },
      );
      showSuccess('Assessment saved', 'The NTD assessment has been recorded.');
      setAssessmentPatientId(assessmentForm.patientId);
      setAssessmentForm({
        patientId: '',
        diseaseType: diseaseTypes[0],
        assessmentDate: todayIso(),
        diseaseStage: '',
        disabilityGrade: '',
        mdaEligible: 'unknown',
        treatmentGiven: '',
        doseMg: '',
        lotNumber: '',
        followUpDate: '',
        notes: '',
      });
      await loadAssessments(assessmentPatientId || assessmentForm.patientId);
    } catch (error: any) {
      showError('Assessment failed', apiError(error, 'Unable to record the NTD assessment.'));
    }
  };

  const submitCampaign = async () => {
    try {
      await ehrAxios.post(
        '/ntd/mda/campaigns',
        {
          ...campaignForm,
          targetPopulation: campaignForm.targetPopulation || null,
          coverageArea: campaignForm.coverageArea || null,
          dhis2DatasetUid: campaignForm.dhis2DatasetUid || null,
        },
        { headers },
      );
      showSuccess('Campaign created', 'The MDA campaign has been saved.');
      setCampaignForm({
        campaignName: '',
        diseaseType: diseaseTypes[0],
        drugName: '',
        startDate: todayIso(),
        endDate: todayIso(),
        targetPopulation: '',
        coverageArea: '',
        dhis2DatasetUid: '',
      });
      await loadCampaigns();
    } catch (error: any) {
      showError('Campaign failed', apiError(error, 'Unable to create the MDA campaign.'));
    }
  };

  const recordSession = async (campaignId: string) => {
    const count = Number(sessionCounts[campaignId] || 0);
    if (!Number.isFinite(count) || count <= 0) {
      showError('Invalid count', 'Enter a treated count greater than zero.');
      return;
    }

    try {
      await ehrAxios.patch(`/ntd/mda/campaigns/${campaignId}/record`, { count }, { headers });
      showSuccess('Session recorded', 'The treated count has been updated.');
      setSessionCounts((current) => ({ ...current, [campaignId]: '' }));
      await loadCampaigns();
    } catch (error: any) {
      showError('Update failed', apiError(error, 'Unable to update the campaign treated count.'));
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
            <h1 className="text-3xl font-semibold text-white">NTD Programs</h1>
            <p className="mt-2 max-w-3xl text-sm text-slate-300">
              Track NTD patient assessments and community MDA campaigns without leaving the EHR workflow.
            </p>
          </div>
          <button
            type="button"
            onClick={() => void refresh()}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-700 px-4 py-2 text-sm font-medium text-slate-200 hover:border-slate-600 hover:text-white"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>

        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            onClick={() => setTab('assessments')}
            className={`inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-sm font-medium ${
              tab === 'assessments'
                ? 'border-cyan-600 bg-cyan-500/10 text-cyan-200'
                : 'border-slate-800 bg-slate-900/80 text-slate-300 hover:border-slate-700 hover:text-white'
            }`}
          >
            <Bug className="h-4 w-4" />
            Patient Assessments
          </button>
          <button
            type="button"
            onClick={() => setTab('campaigns')}
            className={`inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-sm font-medium ${
              tab === 'campaigns'
                ? 'border-cyan-600 bg-cyan-500/10 text-cyan-200'
                : 'border-slate-800 bg-slate-900/80 text-slate-300 hover:border-slate-700 hover:text-white'
            }`}
          >
            <CalendarDays className="h-4 w-4" />
            MDA Campaigns
          </button>
          <button
            type="button"
            onClick={() => setTab('clinical_depth')}
            className={`inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-sm font-medium ${
              tab === 'clinical_depth'
                ? 'border-cyan-600 bg-cyan-500/10 text-cyan-200'
                : 'border-slate-800 bg-slate-900/80 text-slate-300 hover:border-slate-700 hover:text-white'
            }`}
          >
            <Stethoscope className="h-4 w-4" />
            Clinical Depth (S153)
          </button>
        </div>

        {tab === 'assessments' && (
          <div className="grid gap-6 xl:grid-cols-[380px_minmax(0,1fr)]">
            <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-5">
              <h2 className="text-lg font-semibold text-white">Record Assessment</h2>
              <div className="mt-4 space-y-3">
                <input value={assessmentForm.patientId} onChange={(e) => setAssessmentForm((p) => ({ ...p, patientId: e.target.value }))} placeholder="Patient ID" className="w-full rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-white outline-none" />
                <select value={assessmentForm.diseaseType} onChange={(e) => setAssessmentForm((p) => ({ ...p, diseaseType: e.target.value }))} className="w-full rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-white outline-none">
                  {diseaseTypes.map((type) => <option key={type} value={type}>{type}</option>)}
                </select>
                <input type="date" value={assessmentForm.assessmentDate} onChange={(e) => setAssessmentForm((p) => ({ ...p, assessmentDate: e.target.value }))} className="w-full rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-white outline-none" />
                <input value={assessmentForm.diseaseStage} onChange={(e) => setAssessmentForm((p) => ({ ...p, diseaseStage: e.target.value }))} placeholder="Disease stage" className="w-full rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-white outline-none" />
                <input value={assessmentForm.disabilityGrade} onChange={(e) => setAssessmentForm((p) => ({ ...p, disabilityGrade: e.target.value }))} placeholder="Disability grade" className="w-full rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-white outline-none" />
                <select value={assessmentForm.mdaEligible} onChange={(e) => setAssessmentForm((p) => ({ ...p, mdaEligible: e.target.value }))} className="w-full rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-white outline-none">
                  <option value="unknown">MDA eligibility unknown</option>
                  <option value="true">MDA eligible</option>
                  <option value="false">Not MDA eligible</option>
                </select>
                <input value={assessmentForm.treatmentGiven} onChange={(e) => setAssessmentForm((p) => ({ ...p, treatmentGiven: e.target.value }))} placeholder="Treatment given" className="w-full rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-white outline-none" />
                <input value={assessmentForm.doseMg} onChange={(e) => setAssessmentForm((p) => ({ ...p, doseMg: e.target.value }))} placeholder="Dose (mg)" className="w-full rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-white outline-none" />
                <input value={assessmentForm.lotNumber} onChange={(e) => setAssessmentForm((p) => ({ ...p, lotNumber: e.target.value }))} placeholder="Lot number" className="w-full rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-white outline-none" />
                <input type="date" value={assessmentForm.followUpDate} onChange={(e) => setAssessmentForm((p) => ({ ...p, followUpDate: e.target.value }))} className="w-full rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-white outline-none" />
                <textarea value={assessmentForm.notes} onChange={(e) => setAssessmentForm((p) => ({ ...p, notes: e.target.value }))} placeholder="Notes" rows={3} className="w-full rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-white outline-none" />
                <button type="button" onClick={() => void submitAssessment()} className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-cyan-500 px-4 py-2 text-sm font-semibold text-slate-950 hover:bg-cyan-400">
                  Save Assessment
                </button>
              </div>
            </div>

            <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-5">
              <div className="flex gap-3">
                <input value={assessmentPatientId} onChange={(e) => setAssessmentPatientId(e.target.value)} placeholder="Patient ID for history" className="flex-1 rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-white outline-none" />
                <button type="button" onClick={() => void loadAssessments(assessmentPatientId)} className="rounded-xl border border-slate-700 px-4 py-2 text-sm font-medium text-slate-200 hover:text-white">
                  Load
                </button>
              </div>
              <div className="mt-4 space-y-3">
                {assessmentHistory.map((row) => (
                  <div key={row.id} className="rounded-2xl border border-slate-800 bg-slate-950/70 p-4">
                    <p className="text-sm font-semibold text-white">{row.diseaseType}</p>
                    <p className="text-xs text-slate-400 mt-1">{row.assessmentDate}</p>
                    <div className="mt-2 grid gap-1 text-sm text-slate-300">
                      <p>Stage: {row.diseaseStage || '-'}</p>
                      <p>Treatment: {row.treatmentGiven || '-'}</p>
                      <p>MDA eligible: {row.mdaEligible === null ? '-' : row.mdaEligible ? 'Yes' : 'No'}</p>
                    </div>
                  </div>
                ))}
                {!assessmentHistory.length && (
                  <div className="rounded-2xl border border-dashed border-slate-800 bg-slate-950/40 p-8 text-center text-slate-500">
                    No assessment history loaded yet.
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {tab === 'campaigns' && (
          <div className="grid gap-6 xl:grid-cols-[380px_minmax(0,1fr)]">
            <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-5">
              <h2 className="text-lg font-semibold text-white">Create Campaign</h2>
              <div className="mt-4 space-y-3">
                <input value={campaignForm.campaignName} onChange={(e) => setCampaignForm((p) => ({ ...p, campaignName: e.target.value }))} placeholder="Campaign name" className="w-full rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-white outline-none" />
                <select value={campaignForm.diseaseType} onChange={(e) => setCampaignForm((p) => ({ ...p, diseaseType: e.target.value }))} className="w-full rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-white outline-none">
                  {diseaseTypes.map((type) => <option key={type} value={type}>{type}</option>)}
                </select>
                <input value={campaignForm.drugName} onChange={(e) => setCampaignForm((p) => ({ ...p, drugName: e.target.value }))} placeholder="Drug name" className="w-full rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-white outline-none" />
                <input type="date" value={campaignForm.startDate} onChange={(e) => setCampaignForm((p) => ({ ...p, startDate: e.target.value }))} className="w-full rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-white outline-none" />
                <input type="date" value={campaignForm.endDate} onChange={(e) => setCampaignForm((p) => ({ ...p, endDate: e.target.value }))} className="w-full rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-white outline-none" />
                <input value={campaignForm.targetPopulation} onChange={(e) => setCampaignForm((p) => ({ ...p, targetPopulation: e.target.value }))} placeholder="Target population" className="w-full rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-white outline-none" />
                <input value={campaignForm.coverageArea} onChange={(e) => setCampaignForm((p) => ({ ...p, coverageArea: e.target.value }))} placeholder="Coverage area" className="w-full rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-white outline-none" />
                <input value={campaignForm.dhis2DatasetUid} onChange={(e) => setCampaignForm((p) => ({ ...p, dhis2DatasetUid: e.target.value }))} placeholder="DHIS2 dataset UID" className="w-full rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-white outline-none" />
                <button type="button" onClick={() => void submitCampaign()} className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-cyan-500 px-4 py-2 text-sm font-semibold text-slate-950 hover:bg-cyan-400">
                  Save Campaign
                </button>
              </div>
            </div>

            <div className="space-y-3">
              {campaigns.map((campaign) => (
                <div key={campaign.id} className="rounded-2xl border border-slate-800 bg-slate-900/80 p-5">
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                    <div>
                      <p className="text-lg font-semibold text-white">{campaign.campaignName}</p>
                      <p className="text-sm text-slate-300">{campaign.diseaseType} · {campaign.drugName}</p>
                      <p className="text-xs text-slate-400 mt-1">{campaign.startDate} to {campaign.endDate}</p>
                    </div>
                    <div className="text-sm text-slate-300">
                      Treated: <span className="font-semibold text-white">{campaign.treatedCount || 0}</span>
                    </div>
                  </div>
                  <div className="mt-4 grid gap-3 md:grid-cols-[1fr_auto]">
                    <input value={sessionCounts[campaign.id] || ''} onChange={(e) => setSessionCounts((current) => ({ ...current, [campaign.id]: e.target.value }))} placeholder="Record treated count for session" className="rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-white outline-none" />
                    <button type="button" onClick={() => void recordSession(campaign.id)} className="rounded-xl border border-slate-700 px-4 py-2 text-sm font-medium text-slate-200 hover:text-white">
                      Record Session
                    </button>
                  </div>
                </div>
              ))}
              {!campaigns.length && (
                <div className="rounded-2xl border border-dashed border-slate-800 bg-slate-950/40 p-8 text-center text-slate-500">
                  No campaigns created yet.
                </div>
              )}
            </div>
          </div>
        )}

        {tab === 'clinical_depth' && (
          <NtdClinicalDepthDashboard />
        )}
      </div>
    </div>
  );
};

export default NtdDashboard;
