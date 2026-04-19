import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertTriangle, HeartHandshake, Home, Loader2, ShieldAlert, Users } from 'lucide-react';
import { culturalApi } from '../services/api';
import { useNotification } from './GlobalNotification';

type Props = {
  patientId: string;
  tenantSlug: string;
  token: string;
};

const today = new Date().toISOString().slice(0, 10);

const badgeClasses: Record<string, string> = {
  low: 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30',
  moderate: 'bg-amber-500/15 text-amber-300 border border-amber-500/30',
  high: 'bg-rose-500/15 text-rose-300 border border-rose-500/30',
  none: 'bg-slate-800 text-slate-300 border border-slate-700',
  possible: 'bg-amber-500/15 text-amber-300 border border-amber-500/30',
};

const UbuntuCulturalPanel: React.FC<Props> = ({ patientId, tenantSlug, token }) => {
  const { showError, showSuccess } = useNotification();
  const [activeTab, setActiveTab] = useState<'sdoh' | 'consent' | 'wellbeing'>('sdoh');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState<'sdoh' | 'consent' | 'wellbeing' | null>(null);
  const [summary, setSummary] = useState<any>(null);
  const [sdoh, setSdoh] = useState<any>({
    patientId,
    assessmentDate: today,
    foodInsecurity: 'unknown',
    mealsPerDay: '',
    housingType: '',
    householdMembers: '',
    waterSource: '',
    sanitation: '',
    electricity: false,
    householdIncomeUsdMonth: '',
    employmentStatus: '',
    socialGrantRecipient: false,
    socialGrantTypes: [] as string[],
    educationLevel: '',
    literacy: '',
    gbvScreenPositive: false,
    gbvScreenDate: '',
    childProtectionConcern: false,
    extendedFamilySupport: '',
    communityGroupMember: false,
    communityGroupTypes: [] as string[],
  });
  const [sdohRisk, setSdohRisk] = useState<any>(null);
  const [familyConsents, setFamilyConsents] = useState<any[]>([]);
  const [familyConsentForm, setFamilyConsentForm] = useState<any>({
    patientId,
    meetingDate: new Date().toISOString().slice(0, 16),
    familyMembersPresentText: '',
    communityElderPresent: false,
    traditionalHealerPresent: false,
    religiousLeaderPresent: false,
    decisionType: 'treatment_consent',
    clinicalInformationShared: '',
    patientCapacityAssessed: true,
    patientHasCapacity: true,
    consensusReached: true,
    decisionMade: '',
    patientAgrees: true,
    culturalConflictNoted: false,
    culturalConflictDescription: '',
    ethicsConsultationRequested: false,
  });
  const [wellbeingHistory, setWellbeingHistory] = useState<any[]>([]);
  const [wellbeingForm, setWellbeingForm] = useState<any>({
    patientId,
    assessmentDate: today,
    socialConnectedness: 'moderate',
    communityBelonging: 'moderate',
    spiritualWellbeing: 'well',
    ancestralHarmony: 'at_peace',
    griefBereavement: false,
    griefType: '',
    currentlyUsingTraditionalHealer: false,
    traditionalHealerType: '',
    traditionalHealerTreatment: '',
    phq9Score: '',
    gad7Score: '',
    stigmaExperienced: false,
    helpSeekingBarriersText: '',
  });

  const tmRiskClass = useMemo(() => {
    const risk = wellbeingHistory[0]?.herbDrugInteractionRisk || summary?.herbDrugInteractionRisk || 'none';
    return badgeClasses[risk] || badgeClasses.none;
  }, [summary, wellbeingHistory]);

  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      const [sdohRes, riskRes, familyRes, wellbeingRes, summaryRes] = await Promise.allSettled([
        culturalApi.getSdoh(patientId, token, tenantSlug),
        culturalApi.getSdohRisk(patientId, token, tenantSlug),
        culturalApi.getFamilyConsents(patientId, token, tenantSlug),
        culturalApi.getWellbeingHistory(patientId, token, tenantSlug),
        culturalApi.getCulturalSummary(patientId, token, tenantSlug),
      ]);

      if (sdohRes.status === 'fulfilled' && sdohRes.value) {
        setSdoh((current: any) => ({ ...current, ...sdohRes.value }));
      }
      if (riskRes.status === 'fulfilled') {
        setSdohRisk(riskRes.value);
      }
      if (familyRes.status === 'fulfilled' && Array.isArray(familyRes.value)) {
        setFamilyConsents(familyRes.value);
      }
      if (wellbeingRes.status === 'fulfilled' && Array.isArray(wellbeingRes.value)) {
        setWellbeingHistory(wellbeingRes.value);
      }
      if (summaryRes.status === 'fulfilled') {
        setSummary(summaryRes.value);
      }
    } catch (error) {
      showError('Ubuntu Cultural Health', 'Failed to load cultural health records');
    } finally {
      setLoading(false);
    }
  }, [patientId, showError, tenantSlug, token]);

  useEffect(() => {
    void loadAll();
  }, [loadAll]);

  const handleSdohSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSubmitting('sdoh');
    try {
      await culturalApi.upsertSdoh(
        {
          ...sdoh,
          patientId,
          mealsPerDay: toNumberOrNull(sdoh.mealsPerDay),
          householdMembers: toNumberOrNull(sdoh.householdMembers),
          householdIncomeUsdMonth: toNumberOrNull(sdoh.householdIncomeUsdMonth),
        },
        token,
        tenantSlug,
      );
      setSdohRisk(await culturalApi.getSdohRisk(patientId, token, tenantSlug));
      setSummary(await culturalApi.getCulturalSummary(patientId, token, tenantSlug));
      showSuccess('Ubuntu Cultural Health', 'Social determinants saved');
    } catch (error) {
      showError('Ubuntu Cultural Health', 'Failed to save social determinants');
    } finally {
      setSubmitting(null);
    }
  };

  const handleConsentSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSubmitting('consent');
    try {
      await culturalApi.recordFamilyConsent(
        {
          ...familyConsentForm,
          patientId,
          familyMembersPresent: familyConsentForm.familyMembersPresentText
            .split('\n')
            .map((line: string) => line.trim())
            .filter(Boolean)
            .map((line: string) => {
              const [name, relationship, phone] = line.split('|').map((value) => value.trim());
              return { name, relationship, phone };
            }),
        },
        token,
        tenantSlug,
      );
      setFamilyConsents(await culturalApi.getFamilyConsents(patientId, token, tenantSlug));
      setSummary(await culturalApi.getCulturalSummary(patientId, token, tenantSlug));
      showSuccess('Ubuntu Cultural Health', 'Family council consent recorded');
    } catch (error) {
      showError('Ubuntu Cultural Health', 'Failed to record family council consent');
    } finally {
      setSubmitting(null);
    }
  };

  const handleWellbeingSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSubmitting('wellbeing');
    try {
      await culturalApi.recordWellbeing(
        {
          ...wellbeingForm,
          patientId,
          phq9Score: toNumberOrNull(wellbeingForm.phq9Score),
          gad7Score: toNumberOrNull(wellbeingForm.gad7Score),
          helpSeekingBarriers: wellbeingForm.helpSeekingBarriersText
            .split(',')
            .map((item: string) => item.trim())
            .filter(Boolean),
        },
        token,
        tenantSlug,
      );
      setWellbeingHistory(await culturalApi.getWellbeingHistory(patientId, token, tenantSlug));
      setSummary(await culturalApi.getCulturalSummary(patientId, token, tenantSlug));
      showSuccess('Ubuntu Cultural Health', 'Wellbeing assessment recorded');
    } catch (error) {
      showError('Ubuntu Cultural Health', 'Failed to record wellbeing assessment');
    } finally {
      setSubmitting(null);
    }
  };

  if (loading) {
    return (
      <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-6 text-slate-200">
        <div className="flex items-center gap-3">
          <Loader2 className="h-5 w-5 animate-spin text-emerald-400" />
          <span>Loading Ubuntu cultural health module...</span>
        </div>
      </div>
    );
  }

  return (
    <section className="rounded-3xl border border-slate-800 bg-slate-900/80 p-6 text-slate-100 shadow-2xl">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="flex items-center gap-3">
            <HeartHandshake className="h-6 w-6 text-emerald-400" />
            <h2 className="text-xl font-semibold">Ubuntu Cultural Health</h2>
          </div>
          <p className="mt-2 text-sm text-slate-400">
            Social determinants, family council consent, and culturally grounded wellbeing for this patient.
          </p>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <StatCard label="SDOH Risk" value={summary?.sdohRiskLevel || 'Unknown'} tone={summary?.sdohRiskLevel || 'none'} />
          <StatCard label="Wellbeing Risk" value={summary?.wellbeingRisk || 'Unknown'} tone={summary?.wellbeingRisk || 'none'} />
          <StatCard label="Family Consents" value={String(summary?.familyConsentCount || 0)} tone="none" />
        </div>
      </div>

      {summary?.tmInteractionFlag && (
        <div className="mt-5 rounded-2xl border border-rose-500/30 bg-rose-500/10 p-4 text-rose-100">
          <div className="flex items-start gap-3">
            <ShieldAlert className="mt-0.5 h-5 w-5 text-rose-300" />
            <div>
              <div className="font-medium">High herb-drug interaction risk flagged</div>
              <p className="mt-1 text-sm text-rose-100/90">
                Traditional healer treatment may be interacting with active biomedical therapy. Review the traditional medicine module alerts promptly.
              </p>
            </div>
          </div>
        </div>
      )}

      <div className="mt-6 flex flex-wrap gap-2">
        <TabButton icon={Home} label="Social Determinants" active={activeTab === 'sdoh'} onClick={() => setActiveTab('sdoh')} />
        <TabButton icon={Users} label="Family & Consent" active={activeTab === 'consent'} onClick={() => setActiveTab('consent')} />
        <TabButton icon={HeartHandshake} label="Wellbeing" active={activeTab === 'wellbeing'} onClick={() => setActiveTab('wellbeing')} />
      </div>

      {activeTab === 'sdoh' && (
        <div className="mt-6 grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
          <form className="space-y-4" onSubmit={handleSdohSubmit}>
            <div className="grid gap-4 md:grid-cols-2">
              <SelectField label="Food Security" value={sdoh.foodInsecurity || 'unknown'} onChange={(value) => setSdoh({ ...sdoh, foodInsecurity: value })} options={['unknown', 'food_secure', 'mildly_insecure', 'moderately_insecure', 'severely_insecure']} />
              <InputField label="Meals Per Day" type="number" value={sdoh.mealsPerDay ?? ''} onChange={(value) => setSdoh({ ...sdoh, mealsPerDay: value })} />
              <SelectField label="Housing Type" value={sdoh.housingType || ''} onChange={(value) => setSdoh({ ...sdoh, housingType: value })} options={['', 'permanent', 'semi_permanent', 'informal_shack', 'homeless']} />
              <InputField label="Household Members" type="number" value={sdoh.householdMembers ?? ''} onChange={(value) => setSdoh({ ...sdoh, householdMembers: value })} />
              <SelectField label="Water Source" value={sdoh.waterSource || ''} onChange={(value) => setSdoh({ ...sdoh, waterSource: value })} options={['', 'piped', 'borehole', 'river', 'purchased']} />
              <SelectField label="Sanitation" value={sdoh.sanitation || ''} onChange={(value) => setSdoh({ ...sdoh, sanitation: value })} options={['', 'flush_toilet', 'pit_latrine', 'open_defecation']} />
              <InputField label="Income / Month (USD)" type="number" value={sdoh.householdIncomeUsdMonth ?? ''} onChange={(value) => setSdoh({ ...sdoh, householdIncomeUsdMonth: value })} />
              <SelectField label="Employment Status" value={sdoh.employmentStatus || ''} onChange={(value) => setSdoh({ ...sdoh, employmentStatus: value })} options={['', 'employed', 'self_employed', 'unemployed', 'subsistence']} />
              <SelectField label="Education Level" value={sdoh.educationLevel || ''} onChange={(value) => setSdoh({ ...sdoh, educationLevel: value })} options={['', 'none', 'primary', 'secondary', 'tertiary']} />
              <SelectField label="Literacy" value={sdoh.literacy || ''} onChange={(value) => setSdoh({ ...sdoh, literacy: value })} options={['', 'literate', 'partial_literacy', 'illiterate']} />
              <SelectField label="Family Support" value={sdoh.extendedFamilySupport || ''} onChange={(value) => setSdoh({ ...sdoh, extendedFamilySupport: value })} options={['', 'strong', 'moderate', 'weak', 'none']} />
              <InputField label="Social Grant Types (comma-separated)" value={(sdoh.socialGrantTypes || []).join(', ')} onChange={(value) => setSdoh({ ...sdoh, socialGrantTypes: value.split(',').map((item) => item.trim()).filter(Boolean) })} />
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <CheckboxField label="Electricity Access" checked={Boolean(sdoh.electricity)} onChange={(checked) => setSdoh({ ...sdoh, electricity: checked })} />
              <CheckboxField label="Social Grant Recipient" checked={Boolean(sdoh.socialGrantRecipient)} onChange={(checked) => setSdoh({ ...sdoh, socialGrantRecipient: checked })} />
              <CheckboxField label="Community Group Member" checked={Boolean(sdoh.communityGroupMember)} onChange={(checked) => setSdoh({ ...sdoh, communityGroupMember: checked })} />
              <CheckboxField label="GBV Screen Positive" checked={Boolean(sdoh.gbvScreenPositive)} onChange={(checked) => setSdoh({ ...sdoh, gbvScreenPositive: checked })} />
              <CheckboxField label="Child Protection Concern" checked={Boolean(sdoh.childProtectionConcern)} onChange={(checked) => setSdoh({ ...sdoh, childProtectionConcern: checked })} />
            </div>

            <button type="submit" className="rounded-xl bg-emerald-500 px-4 py-2 font-medium text-slate-950 transition hover:bg-emerald-400 disabled:opacity-60" disabled={submitting === 'sdoh'}>
              {submitting === 'sdoh' ? 'Saving...' : 'Save SDOH Assessment'}
            </button>
          </form>

          <div className="space-y-4">
            <div className="rounded-2xl border border-slate-800 bg-slate-950 p-5">
              <div className="text-sm uppercase tracking-wide text-slate-400">CDSS Social Risk</div>
              <div className="mt-3 flex items-end gap-3">
                <div className="text-4xl font-semibold text-white">{sdohRisk?.sdoh_risk_score ?? summary?.sdohRiskScore ?? '--'}</div>
                <span className={`rounded-full px-3 py-1 text-sm ${badgeClasses[sdohRisk?.sdoh_risk_level || summary?.sdohRiskLevel || 'none'] || badgeClasses.none}`}>
                  {sdohRisk?.sdoh_risk_level || summary?.sdohRiskLevel || 'pending'}
                </span>
              </div>
              <div className="mt-4">
                <div className="text-xs uppercase tracking-wide text-slate-500">Key Risk Factors</div>
                <ul className="mt-2 space-y-2 text-sm text-slate-300">
                  {(sdohRisk?.key_risk_factors || []).map((factor: string) => <li key={factor}>• {factor}</li>)}
                </ul>
              </div>
              <div className="mt-4">
                <div className="text-xs uppercase tracking-wide text-slate-500">Recommended Community Resources</div>
                <ul className="mt-2 space-y-2 text-sm text-slate-300">
                  {(sdohRisk?.recommended_community_resources || []).map((item: string) => <li key={item}>• {item}</li>)}
                </ul>
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'consent' && (
        <div className="mt-6 grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
          <form className="space-y-4" onSubmit={handleConsentSubmit}>
            <div className="grid gap-4 md:grid-cols-2">
              <InputField label="Meeting Date" type="datetime-local" value={familyConsentForm.meetingDate} onChange={(value) => setFamilyConsentForm({ ...familyConsentForm, meetingDate: value })} />
              <SelectField label="Decision Type" value={familyConsentForm.decisionType} onChange={(value) => setFamilyConsentForm({ ...familyConsentForm, decisionType: value })} options={['treatment_consent', 'disclosure', 'end_of_life', 'surgery', 'hiv_disclosure', 'mental_health']} />
            </div>
            <TextAreaField label="Clinical Information Shared" value={familyConsentForm.clinicalInformationShared} onChange={(value) => setFamilyConsentForm({ ...familyConsentForm, clinicalInformationShared: value })} rows={3} />
            <TextAreaField label="Family Members Present" helper="One per line: name | relationship | phone" value={familyConsentForm.familyMembersPresentText} onChange={(value) => setFamilyConsentForm({ ...familyConsentForm, familyMembersPresentText: value })} rows={4} />
            <TextAreaField label="Decision Made" value={familyConsentForm.decisionMade} onChange={(value) => setFamilyConsentForm({ ...familyConsentForm, decisionMade: value })} rows={3} />
            <TextAreaField label="Cultural Conflict Description" value={familyConsentForm.culturalConflictDescription} onChange={(value) => setFamilyConsentForm({ ...familyConsentForm, culturalConflictDescription: value })} rows={2} />
            <div className="grid gap-4 md:grid-cols-2">
              <CheckboxField label="Community Elder Present" checked={Boolean(familyConsentForm.communityElderPresent)} onChange={(checked) => setFamilyConsentForm({ ...familyConsentForm, communityElderPresent: checked })} />
              <CheckboxField label="Traditional Healer Present" checked={Boolean(familyConsentForm.traditionalHealerPresent)} onChange={(checked) => setFamilyConsentForm({ ...familyConsentForm, traditionalHealerPresent: checked })} />
              <CheckboxField label="Religious Leader Present" checked={Boolean(familyConsentForm.religiousLeaderPresent)} onChange={(checked) => setFamilyConsentForm({ ...familyConsentForm, religiousLeaderPresent: checked })} />
              <CheckboxField label="Consensus Reached" checked={Boolean(familyConsentForm.consensusReached)} onChange={(checked) => setFamilyConsentForm({ ...familyConsentForm, consensusReached: checked })} />
              <CheckboxField label="Patient Capacity Assessed" checked={Boolean(familyConsentForm.patientCapacityAssessed)} onChange={(checked) => setFamilyConsentForm({ ...familyConsentForm, patientCapacityAssessed: checked })} />
              <CheckboxField label="Patient Has Capacity" checked={Boolean(familyConsentForm.patientHasCapacity)} onChange={(checked) => setFamilyConsentForm({ ...familyConsentForm, patientHasCapacity: checked })} />
              <CheckboxField label="Patient Agrees" checked={Boolean(familyConsentForm.patientAgrees)} onChange={(checked) => setFamilyConsentForm({ ...familyConsentForm, patientAgrees: checked })} />
              <CheckboxField label="Cultural Conflict Noted" checked={Boolean(familyConsentForm.culturalConflictNoted)} onChange={(checked) => setFamilyConsentForm({ ...familyConsentForm, culturalConflictNoted: checked })} />
              <CheckboxField label="Ethics Consultation Requested" checked={Boolean(familyConsentForm.ethicsConsultationRequested)} onChange={(checked) => setFamilyConsentForm({ ...familyConsentForm, ethicsConsultationRequested: checked })} />
            </div>
            <button type="submit" className="rounded-xl bg-emerald-500 px-4 py-2 font-medium text-slate-950 transition hover:bg-emerald-400 disabled:opacity-60" disabled={submitting === 'consent'}>
              {submitting === 'consent' ? 'Saving...' : 'Record Family Council Meeting'}
            </button>
          </form>

          <div className="space-y-3">
            {familyConsents.length === 0 && <EmptyState message="No family council records yet." />}
            {familyConsents.map((record) => (
              <div key={record.id} className="rounded-2xl border border-slate-800 bg-slate-950 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="font-medium text-white">{record.decisionType?.replace(/_/g, ' ')}</div>
                    <div className="mt-1 text-sm text-slate-400">{formatDate(record.meetingDate)}</div>
                  </div>
                  <span className={`rounded-full px-2.5 py-1 text-xs ${record.culturalConflictNoted ? badgeClasses.moderate : badgeClasses.low}`}>
                    {record.culturalConflictNoted ? 'Conflict noted' : 'Stable'}
                  </span>
                </div>
                <p className="mt-3 text-sm text-slate-300">{record.decisionMade}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {activeTab === 'wellbeing' && (
        <div className="mt-6 grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
          <form className="space-y-4" onSubmit={handleWellbeingSubmit}>
            <div className="grid gap-4 md:grid-cols-2">
              <SelectField label="Social Connectedness" value={wellbeingForm.socialConnectedness} onChange={(value) => setWellbeingForm({ ...wellbeingForm, socialConnectedness: value })} options={['strong', 'moderate', 'weak', 'isolated']} />
              <SelectField label="Community Belonging" value={wellbeingForm.communityBelonging} onChange={(value) => setWellbeingForm({ ...wellbeingForm, communityBelonging: value })} options={['high', 'moderate', 'low', 'excluded']} />
              <SelectField label="Spiritual Wellbeing" value={wellbeingForm.spiritualWellbeing} onChange={(value) => setWellbeingForm({ ...wellbeingForm, spiritualWellbeing: value })} options={['well', 'distressed', 'crisis']} />
              <SelectField label="Ancestral Harmony" value={wellbeingForm.ancestralHarmony} onChange={(value) => setWellbeingForm({ ...wellbeingForm, ancestralHarmony: value })} options={['at_peace', 'troubled', 'seeking_guidance']} />
              <InputField label="PHQ-9" type="number" value={wellbeingForm.phq9Score} onChange={(value) => setWellbeingForm({ ...wellbeingForm, phq9Score: value })} />
              <InputField label="GAD-7" type="number" value={wellbeingForm.gad7Score} onChange={(value) => setWellbeingForm({ ...wellbeingForm, gad7Score: value })} />
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <CheckboxField label="Grief / Bereavement" checked={Boolean(wellbeingForm.griefBereavement)} onChange={(checked) => setWellbeingForm({ ...wellbeingForm, griefBereavement: checked })} />
              <CheckboxField label="Traditional Healer Active" checked={Boolean(wellbeingForm.currentlyUsingTraditionalHealer)} onChange={(checked) => setWellbeingForm({ ...wellbeingForm, currentlyUsingTraditionalHealer: checked })} />
              <CheckboxField label="Stigma Experienced" checked={Boolean(wellbeingForm.stigmaExperienced)} onChange={(checked) => setWellbeingForm({ ...wellbeingForm, stigmaExperienced: checked })} />
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <SelectField label="Grief Type" value={wellbeingForm.griefType || ''} onChange={(value) => setWellbeingForm({ ...wellbeingForm, griefType: value })} options={['', 'recent_death', 'prolonged_grief', 'multiple_losses']} />
              <SelectField label="Traditional Healer Type" value={wellbeingForm.traditionalHealerType || ''} onChange={(value) => setWellbeingForm({ ...wellbeingForm, traditionalHealerType: value })} options={['', 'sangoma', 'nyangas', 'faith_healer', 'herbalist']} />
            </div>
            <TextAreaField label="Traditional Healer Treatment" value={wellbeingForm.traditionalHealerTreatment} onChange={(value) => setWellbeingForm({ ...wellbeingForm, traditionalHealerTreatment: value })} rows={3} />
            <TextAreaField label="Help-Seeking Barriers" helper="Comma-separated: stigma, cost, transport, family opposition" value={wellbeingForm.helpSeekingBarriersText} onChange={(value) => setWellbeingForm({ ...wellbeingForm, helpSeekingBarriersText: value })} rows={2} />
            <button type="submit" className="rounded-xl bg-emerald-500 px-4 py-2 font-medium text-slate-950 transition hover:bg-emerald-400 disabled:opacity-60" disabled={submitting === 'wellbeing'}>
              {submitting === 'wellbeing' ? 'Saving...' : 'Record Wellbeing Assessment'}
            </button>
          </form>

          <div className="space-y-4">
            <div className="rounded-2xl border border-slate-800 bg-slate-950 p-5">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-sm uppercase tracking-wide text-slate-400">Latest Psychosocial Risk</div>
                  <div className="mt-2 text-2xl font-semibold text-white">{wellbeingHistory[0]?.cdssPsychosocialRisk || summary?.wellbeingRisk || 'Pending'}</div>
                </div>
                <span className={`rounded-full px-3 py-1 text-sm ${tmRiskClass}`}>
                  {wellbeingHistory[0]?.herbDrugInteractionRisk || summary?.herbDrugInteractionRisk || 'none'} HDI risk
                </span>
              </div>
              {wellbeingHistory[0]?.cdssRecommendation && (
                <p className="mt-4 text-sm text-slate-300">{wellbeingHistory[0].cdssRecommendation}</p>
              )}
            </div>

            {wellbeingHistory.length === 0 && <EmptyState message="No Ubuntu wellbeing assessments yet." />}
            {wellbeingHistory.map((record) => (
              <div key={record.id} className="rounded-2xl border border-slate-800 bg-slate-950 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="font-medium text-white">{formatDate(record.assessmentDate)}</div>
                    <div className="mt-1 text-sm text-slate-400">
                      Connectedness: {record.socialConnectedness} • Belonging: {record.communityBelonging || 'n/a'}
                    </div>
                  </div>
                  <span className={`rounded-full px-2.5 py-1 text-xs ${badgeClasses[record.cdssPsychosocialRisk || 'none'] || badgeClasses.none}`}>
                    {record.cdssPsychosocialRisk || 'pending'}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  );
};

const TabButton = ({ icon: Icon, label, active, onClick }: { icon: React.ElementType; label: string; active: boolean; onClick: () => void }) => (
  <button
    type="button"
    onClick={onClick}
    className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm transition ${
      active ? 'bg-emerald-500 text-slate-950' : 'border border-slate-700 bg-slate-950 text-slate-300 hover:border-slate-600'
    }`}
  >
    <Icon className="h-4 w-4" />
    {label}
  </button>
);

const StatCard = ({ label, value, tone }: { label: string; value: string; tone: string }) => (
  <div className="rounded-2xl border border-slate-800 bg-slate-950 px-4 py-3">
    <div className="text-xs uppercase tracking-wide text-slate-500">{label}</div>
    <div className="mt-2 flex items-center gap-2">
      <span className="text-lg font-semibold text-white">{value}</span>
      <span className={`rounded-full px-2 py-0.5 text-xs ${badgeClasses[tone] || badgeClasses.none}`}>{tone}</span>
    </div>
  </div>
);

const InputField = ({ label, value, onChange, type = 'text' }: { label: string; value: string | number; onChange: (value: string) => void; type?: string }) => (
  <label className="block">
    <span className="mb-1.5 block text-sm text-slate-300">{label}</span>
    <input type={type} value={value} onChange={(event) => onChange(event.target.value)} className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-slate-100 outline-none transition focus:border-emerald-400" />
  </label>
);

const SelectField = ({ label, value, onChange, options }: { label: string; value: string; onChange: (value: string) => void; options: string[] }) => (
  <label className="block">
    <span className="mb-1.5 block text-sm text-slate-300">{label}</span>
    <select value={value} onChange={(event) => onChange(event.target.value)} className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-slate-100 outline-none transition focus:border-emerald-400">
      {options.map((option) => (
        <option key={option || 'blank'} value={option}>
          {option || 'Select...'}
        </option>
      ))}
    </select>
  </label>
);

const CheckboxField = ({ label, checked, onChange }: { label: string; checked: boolean; onChange: (checked: boolean) => void }) => (
  <label className="flex items-center gap-3 rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-slate-200">
    <input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} className="h-4 w-4 rounded border-slate-600 bg-slate-950 text-emerald-500" />
    <span>{label}</span>
  </label>
);

const TextAreaField = ({ label, value, onChange, rows, helper }: { label: string; value: string; onChange: (value: string) => void; rows: number; helper?: string }) => (
  <label className="block">
    <span className="mb-1.5 block text-sm text-slate-300">{label}</span>
    <textarea rows={rows} value={value} onChange={(event) => onChange(event.target.value)} className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-slate-100 outline-none transition focus:border-emerald-400" />
    {helper ? <span className="mt-1 block text-xs text-slate-500">{helper}</span> : null}
  </label>
);

const EmptyState = ({ message }: { message: string }) => (
  <div className="rounded-2xl border border-dashed border-slate-700 bg-slate-950/60 p-6 text-sm text-slate-400">
    <div className="flex items-center gap-2">
      <AlertTriangle className="h-4 w-4" />
      <span>{message}</span>
    </div>
  </div>
);

const formatDate = (value: string) => {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
};

const toNumberOrNull = (value: string | number) => {
  if (value === '' || value === null || value === undefined) {
    return null;
  }
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
};

export default UbuntuCulturalPanel;
