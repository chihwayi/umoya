import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  Brain,
  ClipboardList,
  Languages,
  Pill,
  Plus,
  ShieldCheck,
  Users,
} from 'lucide-react';
import { cdssApi } from '../services/api';
import { useNotification } from './GlobalNotification';

interface Props {
  patientId: string;
  providerId: string;
  tenantSubdomain: string;
  initialTab?: 'overview' | 'screening' | 'mhgap' | 'careplans' | 'followups' | 'crisis' | 'safeplan' | 'meds';
}

type TabKey =
  | 'overview'
  | 'screening'
  | 'mhgap'
  | 'careplans'
  | 'followups'
  | 'crisis'
  | 'safeplan'
  | 'meds';

type ScreeningToolSummary = {
  id: string;
  name: string;
  languages: string[];
};

type ScreeningToolDefinition = {
  tool_id: string;
  language_code: string;
  language_name: string;
  title: string;
  instructions: string;
  response_options: Array<{ value: number; label: string }>;
  questions: Array<{ id: number; text: string }>;
  scoring?: { min: number; max: number };
};

const TAB_LABELS: Array<{ key: TabKey; label: string; icon: any }> = [
  { key: 'overview', label: 'Overview', icon: Brain },
  { key: 'screening', label: 'Screening', icon: ClipboardList },
  { key: 'mhgap', label: 'mhGAP Assess', icon: Brain },
  { key: 'careplans', label: 'Care Plans', icon: Users },
  { key: 'followups', label: 'Follow-ups', icon: Users },
  { key: 'crisis', label: 'Crisis', icon: AlertTriangle },
  { key: 'safeplan', label: 'Safe Plan', icon: ShieldCheck },
  { key: 'meds', label: 'Medications', icon: Pill },
];

const RISK_BADGE: Record<string, string> = {
  low: 'bg-green-100 text-green-700',
  moderate: 'bg-yellow-100 text-yellow-700',
  high: 'bg-orange-100 text-orange-700',
  imminent: 'bg-red-100 text-red-700',
};

const SEVERITY_TEXT: Record<string, string> = {
  none: 'text-green-600',
  minimal: 'text-green-600',
  mild: 'text-yellow-600',
  moderate: 'text-orange-600',
  moderately_severe: 'text-orange-700 font-semibold',
  severe: 'text-red-700 font-semibold',
  low: 'text-green-600',
  hazardous: 'text-yellow-700',
  harmful: 'text-orange-700',
  dependent: 'text-red-700 font-semibold',
};

const LANGUAGE_LABELS: Record<string, string> = {
  en: 'English',
  sw: 'Swahili',
  zu: 'Zulu',
  xh: 'Xhosa',
  af: 'Afrikaans',
  sn: 'Shona',
  nd: 'Ndebele',
  tn: 'Setswana',
  ny: 'Chichewa',
  pt: 'Portuguese',
  fr: 'French',
  ln: 'Lingala',
};

const defaultCarePlan = {
  diagnosisIcd10: '',
  diagnosisName: '',
  careLevel: 'community',
  assignedChwId: '',
  goals: '',
  interventions: '',
  medication: '',
  reviewDate: '',
};

const defaultFollowup = {
  carePlanId: '',
  followupDate: new Date().toISOString().slice(0, 10),
  status: 'completed',
  symptomChange: 'same',
  medicationAdherent: true,
  safetyConcern: false,
  notes: '',
  nextFollowupDate: '',
};

const defaultMhgapForm = {
  presentingComplaint: '',
  durationWeeks: '',
  functionalImpairment: false,
  priorEpisode: false,
  substanceUse: false,
  safetyConcern: false,
  ageYears: '',
  pregnancy: false,
};

export default function MentalHealthDashboard({
  patientId,
  providerId,
  tenantSubdomain,
  initialTab = 'overview',
}: Props) {
  const { showError, showSuccess } = useNotification();
  const [tab, setTab] = useState<TabKey>(initialTab);
  const [screenings, setScreenings] = useState<any[]>([]);
  const [crisisEvents, setCrisisEvents] = useState<any[]>([]);
  const [activePlan, setActivePlan] = useState<any | null>(null);
  const [medications, setMedications] = useState<any[]>([]);
  const [medAlerts, setMedAlerts] = useState<Record<string, any>>({});
  const [carePlans, setCarePlans] = useState<any[]>([]);
  const [followups, setFollowups] = useState<any[]>([]);
  const [referralPathway, setReferralPathway] = useState<any | null>(null);
  const [screeningTools, setScreeningTools] = useState<ScreeningToolSummary[]>([]);
  const [screenTool, setScreenTool] = useState('PHQ9');
  const [screenLanguage, setScreenLanguage] = useState('en');
  const [screenToolDefinition, setScreenToolDefinition] = useState<ScreeningToolDefinition | null>(null);
  const [screenResponses, setScreenResponses] = useState<Record<string, number>>({});
  const [screenResult, setScreenResult] = useState<any | null>(null);
  const [mhgapForm, setMhgapForm] = useState(defaultMhgapForm);
  const [mhgapResult, setMhgapResult] = useState<any | null>(null);
  const [carePlanForm, setCarePlanForm] = useState(defaultCarePlan);
  const [followupForm, setFollowupForm] = useState(defaultFollowup);
  const [crisisForm, setCrisisForm] = useState({
    crisisType: 'suicidal_ideation',
    lethality: 'low',
    meansAccess: false,
    priorAttempts: 0,
    outcome: '',
    eventDate: new Date().toISOString().slice(0, 10),
  });
  const [medicationForm, setMedicationForm] = useState({
    drugName: '',
    drugClass: 'antidepressant',
    doseMg: '',
    frequency: '',
    startDate: new Date().toISOString().slice(0, 10),
    indication: '',
  });
  const [safetyRiskLevel, setSafetyRiskLevel] = useState('high');
  const [safetyPlanTemplate, setSafetyPlanTemplate] = useState<any | null>(null);

  useEffect(() => {
    setTab(initialTab);
  }, [initialTab]);

  const loadDashboard = async () => {
    try {
      const [
        screeningHistory,
        crisisHistory,
        safePlan,
        currentMeds,
        carePlanHistory,
        followupHistory,
        pathway,
        toolList,
      ] = await Promise.all([
        cdssApi.getMhScreenings(patientId, tenantSubdomain),
        cdssApi.getMhCrisisEvents(patientId, tenantSubdomain),
        cdssApi.getActiveSafePlan(patientId, tenantSubdomain),
        cdssApi.getMhMedications(patientId, tenantSubdomain, true),
        cdssApi.getMhCarePlans(patientId, tenantSubdomain),
        cdssApi.getMhFollowups(patientId, tenantSubdomain),
        cdssApi.getMhReferralPathway(tenantSubdomain),
        cdssApi.listMhScreeningTools(),
      ]);

      setScreenings(Array.isArray(screeningHistory) ? screeningHistory : []);
      setCrisisEvents(Array.isArray(crisisHistory) ? crisisHistory : []);
      setActivePlan(safePlan || null);
      setMedications(Array.isArray(currentMeds) ? currentMeds : []);
      setCarePlans(Array.isArray(carePlanHistory) ? carePlanHistory : []);
      setFollowups(Array.isArray(followupHistory) ? followupHistory : []);
      setReferralPathway(pathway || null);
      setScreeningTools(Array.isArray(toolList?.tools) ? toolList.tools : []);

      const nextAlerts: Record<string, any> = {};
      await Promise.all(
        (Array.isArray(currentMeds) ? currentMeds : []).map(async (medication: any) => {
          try {
            nextAlerts[medication.id] = await cdssApi.monitorMhMedication({
              drug_name: medication.drugName,
              drug_class: medication.drugClass,
              dose_mg: medication.doseMg,
            });
          } catch {
            // Non-blocking alert fetch
          }
        }),
      );
      setMedAlerts(nextAlerts);
    } catch {
      showError('Mental health', 'Failed to load mental health workspace data');
    }
  };

  useEffect(() => {
    void loadDashboard();
  }, [patientId, tenantSubdomain]);

  useEffect(() => {
    const activeTool = screeningTools.find((tool) => tool.id === screenTool);
    if (!activeTool) return;
    if (!activeTool.languages.includes(screenLanguage)) {
      setScreenLanguage(activeTool.languages[0] || 'en');
    }
  }, [screenTool, screenLanguage, screeningTools]);

  useEffect(() => {
    if (!screenTool) return;
    const loadDefinition = async () => {
      try {
        const definition = await cdssApi.getMhScreeningToolDefinition(screenTool, screenLanguage);
        setScreenToolDefinition(definition);
        setScreenResponses({});
      } catch {
        showError('Screening tools', 'Failed to load translated screening questions');
      }
    };
    void loadDefinition();
  }, [screenTool, screenLanguage]);

  const latestScreening = screenings[0] || null;
  const hasSafetyConcern = followups.some((item) => item.safetyConcern) || crisisEvents.some((item) => item.lethality === 'high');
  const criticalMedicationAlert = Object.values(medAlerts).some((alert: any) => alert?.has_critical_alert);
  const currentLanguageLabel = LANGUAGE_LABELS[screenLanguage] || screenLanguage.toUpperCase();

  const screeningTotal = useMemo(
    () => Object.values(screenResponses).reduce((sum, value) => sum + (Number(value) || 0), 0),
    [screenResponses],
  );

  const currentToolLanguages = screeningTools.find((tool) => tool.id === screenTool)?.languages || ['en'];

  const screeningComplete =
    screenToolDefinition && Object.keys(screenResponses).length === screenToolDefinition.questions.length;

  const submitScreening = async () => {
    if (!screenToolDefinition) return;
    try {
      const result = await cdssApi.interpretMhScreening({
        tool: screenTool,
        score: screeningTotal,
        language_code: screenLanguage,
      });
      const questionNineValue =
        screenTool === 'PHQ9' ? Number(screenResponses[String(9)] ?? 0) : 0;
      const riskLevel = questionNineValue >= 1 ? 'high' : result.refer_specialist ? 'moderate' : 'low';

      await cdssApi.addMhScreening(patientId, tenantSubdomain, {
        screenedBy: providerId,
        tool: screenTool,
        responses: screenResponses,
        totalScore: screeningTotal,
        severity: result.severity,
        riskLevel,
        actionTaken: result.action,
        languageCode: screenLanguage,
        referred: Boolean(result.refer_specialist),
      });

      setScreenResult({ ...result, riskLevel });
      showSuccess('Screening saved', `${result.tool_name || result.tool} scored and recorded successfully`);
      await loadDashboard();
    } catch {
      showError('Screening', 'Unable to interpret and save the screening');
    }
  };

  const submitMhgapAssessment = async () => {
    try {
      const result = await cdssApi.assessMhGap({
        presenting_complaint: mhgapForm.presentingComplaint,
        duration_weeks: mhgapForm.durationWeeks ? Number(mhgapForm.durationWeeks) : undefined,
        functional_impairment: mhgapForm.functionalImpairment,
        prior_episode: mhgapForm.priorEpisode,
        substance_use: mhgapForm.substanceUse,
        safety_concern: mhgapForm.safetyConcern,
        age_years: mhgapForm.ageYears ? Number(mhgapForm.ageYears) : undefined,
        pregnancy: mhgapForm.pregnancy,
      });
      setMhgapResult(result);
      showSuccess('mhGAP assessment', 'Rule-based mhGAP assessment completed');
    } catch {
      showError('mhGAP assessment', 'Failed to run mhGAP assessment');
    }
  };

  const submitCarePlan = async () => {
    try {
      await cdssApi.createMhCarePlan(tenantSubdomain, {
        patientId,
        diagnosisIcd10: carePlanForm.diagnosisIcd10 || null,
        diagnosisName: carePlanForm.diagnosisName || null,
        careLevel: carePlanForm.careLevel,
        assignedChwId: carePlanForm.assignedChwId || null,
        goals: carePlanForm.goals,
        interventions: carePlanForm.interventions,
        medication: carePlanForm.medication || null,
        reviewDate: carePlanForm.reviewDate || null,
      });
      setCarePlanForm(defaultCarePlan);
      showSuccess('Care plan saved', 'Community mental health care plan created');
      await loadDashboard();
    } catch {
      showError('Care plan', 'Failed to create the care plan');
    }
  };

  const submitFollowup = async () => {
    try {
      await cdssApi.recordMhFollowup(tenantSubdomain, {
        carePlanId: followupForm.carePlanId || null,
        patientId,
        followupDate: followupForm.followupDate,
        status: followupForm.status,
        symptomChange: followupForm.symptomChange,
        medicationAdherent: followupForm.medicationAdherent,
        safetyConcern: followupForm.safetyConcern,
        notes: followupForm.notes || null,
        nextFollowupDate: followupForm.nextFollowupDate || null,
      });
      setFollowupForm(defaultFollowup);
      showSuccess('Follow-up recorded', 'Community follow-up saved successfully');
      await loadDashboard();
    } catch {
      showError('Follow-up', 'Failed to record the follow-up');
    }
  };

  const submitCrisis = async () => {
    try {
      await cdssApi.addMhCrisisEvent(patientId, tenantSubdomain, {
        ...crisisForm,
        reportedBy: providerId,
      });
      showSuccess('Crisis event saved', 'Crisis event recorded successfully');
      await loadDashboard();
    } catch {
      showError('Crisis event', 'Failed to record the crisis event');
    }
  };

  const submitMedication = async () => {
    try {
      await cdssApi.addMhMedication(patientId, tenantSubdomain, {
        ...medicationForm,
        prescribedBy: providerId,
      });
      showSuccess('Medication saved', 'Medication recorded successfully');
      await loadDashboard();
    } catch {
      showError('Medication', 'Failed to add medication');
    }
  };

  const generateSafetyPlan = async () => {
    try {
      const template = await cdssApi.getMhSafetyPlanTemplate({
        risk_level: safetyRiskLevel,
      });
      setSafetyPlanTemplate(template);
      showSuccess('Safety plan ready', 'Safety plan template generated');
    } catch {
      showError('Safety plan', 'Failed to generate safety plan template');
    }
  };

  const saveSafetyPlan = async () => {
    if (!safetyPlanTemplate) {
      showError('Safety plan', 'Generate a safety plan template first');
      return;
    }

    try {
      await cdssApi.upsertSafePlan(patientId, tenantSubdomain, {
        createdBy: providerId,
        warningSigns: safetyPlanTemplate.warning_signs || [],
        internalCoping: safetyPlanTemplate.coping_strategies || [],
        socialDistractions: [],
        supportContacts: safetyPlanTemplate.support_contacts || [],
        professionalContacts: [],
        meansRestriction: safetyPlanTemplate.means_restriction_advice || '',
        reasonToLive: safetyPlanTemplate.emergency_action || '',
      });
      showSuccess('Safety plan saved', 'Structured safety plan saved to the patient record');
      await loadDashboard();
    } catch {
      showError('Safety plan', 'Failed to save the safety plan');
    }
  };

  return (
    <div className="space-y-4">
      {(hasSafetyConcern || criticalMedicationAlert) && (
        <div className="space-y-2">
          {hasSafetyConcern && (
            <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
              <AlertTriangle className="h-4 w-4" />
              Safety concern recorded in follow-up or crisis history. Review immediately.
            </div>
          )}
          {criticalMedicationAlert && (
            <div className="flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-700">
              <Pill className="h-4 w-4" />
              A psychotropic medication monitoring alert is active for this patient.
            </div>
          )}
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        {TAB_LABELS.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            type="button"
            onClick={() => setTab(key)}
            className={`flex items-center gap-1 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
              tab === key ? 'bg-purple-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            <Icon className="h-4 w-4" />
            {label}
          </button>
        ))}
      </div>

      {tab === 'overview' && (
        <div className="grid gap-4 md:grid-cols-4">
          <div className="rounded-lg border bg-white p-4">
            <p className="text-xs text-gray-500">Latest screening</p>
            <p className="mt-2 text-lg font-semibold">{latestScreening?.tool || 'None yet'}</p>
            <p className={`text-sm ${SEVERITY_TEXT[latestScreening?.severity] || 'text-gray-500'}`}>
              {latestScreening?.severity || 'No score yet'}
            </p>
          </div>
          <div className="rounded-lg border bg-white p-4">
            <p className="text-xs text-gray-500">Care plans</p>
            <p className="mt-2 text-2xl font-semibold">{carePlans.length}</p>
            <p className="text-sm text-gray-500">Active and historical</p>
          </div>
          <div className="rounded-lg border bg-white p-4">
            <p className="text-xs text-gray-500">Follow-ups</p>
            <p className="mt-2 text-2xl font-semibold">{followups.length}</p>
            <p className="text-sm text-gray-500">Community follow-up visits</p>
          </div>
          <div className="rounded-lg border bg-white p-4">
            <p className="text-xs text-gray-500">Current language</p>
            <p className="mt-2 text-lg font-semibold">{currentLanguageLabel}</p>
            <p className="text-sm text-gray-500">For screening tools</p>
          </div>

          {referralPathway && (
            <div className="rounded-lg border bg-white p-4 md:col-span-4">
              <p className="mb-2 text-sm font-semibold text-gray-900">Referral pathway</p>
              <div className="grid gap-2 md:grid-cols-4">
                {(referralPathway.levels || []).map((level: any) => (
                  <div key={level.level} className="rounded-md bg-gray-50 p-3">
                    <p className="text-xs font-semibold uppercase text-gray-600">{level.level}</p>
                    <p className="mt-1 text-sm text-gray-700">{level.description}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {tab === 'screening' && (
        <div className="space-y-4">
          <div className="rounded-lg border bg-white p-4">
            <div className="grid gap-3 md:grid-cols-3">
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Tool</label>
                <select
                  value={screenTool}
                  onChange={(event) => setScreenTool(event.target.value)}
                  className="w-full rounded-lg border px-3 py-2 text-sm"
                >
                  {screeningTools.map((tool) => (
                    <option key={tool.id} value={tool.id}>
                      {tool.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Language</label>
                <select
                  value={screenLanguage}
                  onChange={(event) => setScreenLanguage(event.target.value)}
                  className="w-full rounded-lg border px-3 py-2 text-sm"
                >
                  {currentToolLanguages.map((languageCode) => (
                    <option key={languageCode} value={languageCode}>
                      {LANGUAGE_LABELS[languageCode] || languageCode.toUpperCase()}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex items-end">
                <div className="flex items-center gap-2 rounded-lg border bg-gray-50 px-3 py-2 text-sm text-gray-700">
                  <Languages className="h-4 w-4" />
                  {screenToolDefinition?.title || 'Loading translation...'}
                </div>
              </div>
            </div>

            {screenToolDefinition && (
              <>
                <p className="mt-4 text-sm text-gray-600">{screenToolDefinition.instructions}</p>
                <div className="mt-4 space-y-3">
                  {screenToolDefinition.questions.map((question) => (
                    <div key={question.id} className="rounded-lg bg-gray-50 p-3">
                      <p className="mb-2 text-sm font-medium text-gray-800">
                        {question.id}. {question.text}
                      </p>
                      <div className="grid gap-2 md:grid-cols-2">
                        {screenToolDefinition.response_options.map((option) => (
                          <label key={option.value} className="flex items-center gap-2 text-sm text-gray-700">
                            <input
                              type="radio"
                              name={`screening-${question.id}`}
                              checked={screenResponses[String(question.id)] === option.value}
                              onChange={() =>
                                setScreenResponses((previous) => ({
                                  ...previous,
                                  [String(question.id)]: option.value,
                                }))
                              }
                            />
                            {option.label}
                          </label>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}

            <div className="mt-4 flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={() => void submitScreening()}
                disabled={!screeningComplete}
                className="rounded-lg bg-purple-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
              >
                Interpret and save
              </button>
              <span className="text-sm text-gray-600">Total score: {screeningTotal}</span>
            </div>

            {screenResult && (
              <div className="mt-4 rounded-lg border border-purple-200 bg-purple-50 p-4">
                <p className="text-sm font-semibold text-purple-900">{screenResult.tool_name || screenResult.tool}</p>
                <p className={`text-sm ${SEVERITY_TEXT[screenResult.severity] || 'text-gray-700'}`}>
                  Severity: {screenResult.severity}
                </p>
                <p className="mt-1 text-sm text-purple-800">{screenResult.action}</p>
                <p className="mt-2 text-xs text-purple-700">
                  Referral needed: {screenResult.refer_specialist ? 'Yes' : 'No'} • Risk: {screenResult.riskLevel}
                </p>
              </div>
            )}
          </div>

          <div className="rounded-lg border bg-white p-4">
            <p className="mb-3 text-sm font-semibold text-gray-900">Screening history</p>
            <div className="space-y-2">
              {screenings.map((screening) => (
                <div key={screening.id} className="rounded-md bg-gray-50 p-3 text-sm text-gray-700">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium">{screening.tool}</span>
                    <span className={`${SEVERITY_TEXT[screening.severity] || ''}`}>{screening.severity}</span>
                    <span className={`rounded-full px-2 py-0.5 text-xs ${RISK_BADGE[screening.riskLevel] || 'bg-gray-100 text-gray-700'}`}>
                      {screening.riskLevel || 'low'}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-gray-500">
                    Score {screening.totalScore} • language {screening.languageCode || 'en'} • {new Date(screening.screenedAt).toLocaleDateString()}
                  </p>
                </div>
              ))}
              {!screenings.length && <p className="text-sm text-gray-500">No screening history yet.</p>}
            </div>
          </div>
        </div>
      )}

      {tab === 'mhgap' && (
        <div className="space-y-4 rounded-lg border bg-white p-4">
          <div className="grid gap-3 md:grid-cols-2">
            <div className="md:col-span-2">
              <label className="mb-1 block text-sm font-medium text-gray-700">Presenting complaint</label>
              <textarea
                value={mhgapForm.presentingComplaint}
                onChange={(event) => setMhgapForm((previous) => ({ ...previous, presentingComplaint: event.target.value }))}
                className="w-full rounded-lg border px-3 py-2 text-sm"
                rows={4}
                placeholder="Describe the main complaint in the patient's own words"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Duration (weeks)</label>
              <input
                value={mhgapForm.durationWeeks}
                onChange={(event) => setMhgapForm((previous) => ({ ...previous, durationWeeks: event.target.value }))}
                className="w-full rounded-lg border px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Age (years)</label>
              <input
                value={mhgapForm.ageYears}
                onChange={(event) => setMhgapForm((previous) => ({ ...previous, ageYears: event.target.value }))}
                className="w-full rounded-lg border px-3 py-2 text-sm"
              />
            </div>
          </div>
          <div className="grid gap-2 md:grid-cols-4">
            {[
              ['functionalImpairment', 'Functional impairment'],
              ['priorEpisode', 'Prior episode'],
              ['substanceUse', 'Substance use'],
              ['safetyConcern', 'Safety concern'],
            ].map(([key, label]) => (
              <label key={key} className="flex items-center gap-2 text-sm text-gray-700">
                <input
                  type="checkbox"
                  checked={Boolean((mhgapForm as any)[key])}
                  onChange={(event) => setMhgapForm((previous) => ({ ...previous, [key]: event.target.checked }))}
                />
                {label}
              </label>
            ))}
          </div>
          <button
            type="button"
            onClick={() => void submitMhgapAssessment()}
            className="rounded-lg bg-purple-600 px-4 py-2 text-sm font-medium text-white"
          >
            Run mhGAP assessment
          </button>

          {mhgapResult && (
            <div className="rounded-lg border border-purple-200 bg-purple-50 p-4">
              <p className="text-sm font-semibold text-purple-900">
                {mhgapResult.condition} ({mhgapResult.icd10})
              </p>
              <p className={`text-sm ${SEVERITY_TEXT[mhgapResult.severity] || 'text-purple-800'}`}>
                Severity: {mhgapResult.severity}
              </p>
              <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-purple-800">
                {(mhgapResult.management_steps || []).map((step: string) => (
                  <li key={step}>{step}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {tab === 'careplans' && (
        <div className="space-y-4">
          <div className="rounded-lg border bg-white p-4">
            <p className="mb-3 text-sm font-semibold text-gray-900">Create care plan</p>
            <div className="grid gap-3 md:grid-cols-2">
              <input
                placeholder="Diagnosis ICD-10"
                value={carePlanForm.diagnosisIcd10}
                onChange={(event) => setCarePlanForm((previous) => ({ ...previous, diagnosisIcd10: event.target.value }))}
                className="rounded-lg border px-3 py-2 text-sm"
              />
              <input
                placeholder="Diagnosis name"
                value={carePlanForm.diagnosisName}
                onChange={(event) => setCarePlanForm((previous) => ({ ...previous, diagnosisName: event.target.value }))}
                className="rounded-lg border px-3 py-2 text-sm"
              />
              <select
                value={carePlanForm.careLevel}
                onChange={(event) => setCarePlanForm((previous) => ({ ...previous, careLevel: event.target.value }))}
                className="rounded-lg border px-3 py-2 text-sm"
              >
                <option value="community">Community</option>
                <option value="clinic">Clinic</option>
                <option value="district">District</option>
                <option value="specialist">Specialist</option>
              </select>
              <input
                placeholder="Assigned CHW ID"
                value={carePlanForm.assignedChwId}
                onChange={(event) => setCarePlanForm((previous) => ({ ...previous, assignedChwId: event.target.value }))}
                className="rounded-lg border px-3 py-2 text-sm"
              />
              <textarea
                placeholder="Goals (comma separated)"
                value={carePlanForm.goals}
                onChange={(event) => setCarePlanForm((previous) => ({ ...previous, goals: event.target.value }))}
                className="rounded-lg border px-3 py-2 text-sm md:col-span-2"
                rows={2}
              />
              <textarea
                placeholder="Interventions (comma separated)"
                value={carePlanForm.interventions}
                onChange={(event) => setCarePlanForm((previous) => ({ ...previous, interventions: event.target.value }))}
                className="rounded-lg border px-3 py-2 text-sm md:col-span-2"
                rows={2}
              />
              <input
                placeholder="Medication"
                value={carePlanForm.medication}
                onChange={(event) => setCarePlanForm((previous) => ({ ...previous, medication: event.target.value }))}
                className="rounded-lg border px-3 py-2 text-sm"
              />
              <input
                type="date"
                value={carePlanForm.reviewDate}
                onChange={(event) => setCarePlanForm((previous) => ({ ...previous, reviewDate: event.target.value }))}
                className="rounded-lg border px-3 py-2 text-sm"
              />
            </div>
            <button
              type="button"
              onClick={() => void submitCarePlan()}
              className="mt-4 rounded-lg bg-purple-600 px-4 py-2 text-sm font-medium text-white"
            >
              Save care plan
            </button>
          </div>

          <div className="rounded-lg border bg-white p-4">
            <p className="mb-3 text-sm font-semibold text-gray-900">Existing care plans</p>
            <div className="space-y-3">
              {carePlans.map((plan) => (
                <div key={plan.id} className="rounded-md bg-gray-50 p-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-semibold text-gray-900">{plan.diagnosisName || 'Mental health care plan'}</span>
                    <span className="rounded-full bg-gray-200 px-2 py-0.5 text-xs text-gray-700">{plan.careLevel || 'community'}</span>
                    <span className="rounded-full bg-blue-100 px-2 py-0.5 text-xs text-blue-700">{plan.status}</span>
                  </div>
                  <p className="mt-1 text-xs text-gray-600">
                    Review: {plan.reviewDate || 'Not set'} • CHW: {plan.assignedChwId || 'Unassigned'}
                  </p>
                </div>
              ))}
              {!carePlans.length && <p className="text-sm text-gray-500">No care plans recorded yet.</p>}
            </div>
          </div>
        </div>
      )}

      {tab === 'followups' && (
        <div className="space-y-4">
          <div className="rounded-lg border bg-white p-4">
            <p className="mb-3 text-sm font-semibold text-gray-900">Record community follow-up</p>
            <div className="grid gap-3 md:grid-cols-2">
              <select
                value={followupForm.carePlanId}
                onChange={(event) => setFollowupForm((previous) => ({ ...previous, carePlanId: event.target.value }))}
                className="rounded-lg border px-3 py-2 text-sm"
              >
                <option value="">No linked care plan</option>
                {carePlans.map((plan) => (
                  <option key={plan.id} value={plan.id}>
                    {plan.diagnosisName || plan.id}
                  </option>
                ))}
              </select>
              <input
                type="date"
                value={followupForm.followupDate}
                onChange={(event) => setFollowupForm((previous) => ({ ...previous, followupDate: event.target.value }))}
                className="rounded-lg border px-3 py-2 text-sm"
              />
              <select
                value={followupForm.status}
                onChange={(event) => setFollowupForm((previous) => ({ ...previous, status: event.target.value }))}
                className="rounded-lg border px-3 py-2 text-sm"
              >
                <option value="completed">Completed</option>
                <option value="missed">Missed</option>
                <option value="rescheduled">Rescheduled</option>
              </select>
              <select
                value={followupForm.symptomChange}
                onChange={(event) => setFollowupForm((previous) => ({ ...previous, symptomChange: event.target.value }))}
                className="rounded-lg border px-3 py-2 text-sm"
              >
                <option value="improved">Improved</option>
                <option value="same">Same</option>
                <option value="worse">Worse</option>
              </select>
              <label className="flex items-center gap-2 text-sm text-gray-700">
                <input
                  type="checkbox"
                  checked={followupForm.medicationAdherent}
                  onChange={(event) => setFollowupForm((previous) => ({ ...previous, medicationAdherent: event.target.checked }))}
                />
                Medication adherent
              </label>
              <label className="flex items-center gap-2 text-sm text-gray-700">
                <input
                  type="checkbox"
                  checked={followupForm.safetyConcern}
                  onChange={(event) => setFollowupForm((previous) => ({ ...previous, safetyConcern: event.target.checked }))}
                />
                Safety concern
              </label>
              <textarea
                placeholder="Notes"
                value={followupForm.notes}
                onChange={(event) => setFollowupForm((previous) => ({ ...previous, notes: event.target.value }))}
                className="rounded-lg border px-3 py-2 text-sm md:col-span-2"
                rows={3}
              />
              <input
                type="date"
                value={followupForm.nextFollowupDate}
                onChange={(event) => setFollowupForm((previous) => ({ ...previous, nextFollowupDate: event.target.value }))}
                className="rounded-lg border px-3 py-2 text-sm"
              />
            </div>
            <button
              type="button"
              onClick={() => void submitFollowup()}
              className="mt-4 rounded-lg bg-purple-600 px-4 py-2 text-sm font-medium text-white"
            >
              Save follow-up
            </button>
          </div>

          <div className="rounded-lg border bg-white p-4">
            <p className="mb-3 text-sm font-semibold text-gray-900">Follow-up history</p>
            <div className="space-y-3">
              {followups.map((followup) => (
                <div key={followup.id} className="rounded-md bg-gray-50 p-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-semibold text-gray-900">{followup.followupDate}</span>
                    <span className="rounded-full bg-gray-200 px-2 py-0.5 text-xs text-gray-700">{followup.status || 'completed'}</span>
                    {followup.safetyConcern && (
                      <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs text-red-700">Safety concern</span>
                    )}
                  </div>
                  <p className="mt-1 text-xs text-gray-600">
                    Symptom change: {followup.symptomChange || 'not recorded'} • Medication adherent:{' '}
                    {followup.medicationAdherent === null || followup.medicationAdherent === undefined
                      ? 'not recorded'
                      : followup.medicationAdherent
                        ? 'yes'
                        : 'no'}
                  </p>
                </div>
              ))}
              {!followups.length && <p className="text-sm text-gray-500">No follow-up history yet.</p>}
            </div>
          </div>
        </div>
      )}

      {tab === 'crisis' && (
        <div className="space-y-4">
          <div className="rounded-lg border bg-white p-4">
            <p className="mb-3 text-sm font-semibold text-gray-900">Record crisis event</p>
            <div className="grid gap-3 md:grid-cols-2">
              <select
                value={crisisForm.crisisType}
                onChange={(event) => setCrisisForm((previous) => ({ ...previous, crisisType: event.target.value }))}
                className="rounded-lg border px-3 py-2 text-sm"
              >
                <option value="suicidal_ideation">Suicidal ideation</option>
                <option value="self_harm">Self-harm</option>
                <option value="agitation">Agitation</option>
                <option value="psychosis">Psychosis</option>
              </select>
              <select
                value={crisisForm.lethality}
                onChange={(event) => setCrisisForm((previous) => ({ ...previous, lethality: event.target.value }))}
                className="rounded-lg border px-3 py-2 text-sm"
              >
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
              </select>
              <label className="flex items-center gap-2 text-sm text-gray-700">
                <input
                  type="checkbox"
                  checked={crisisForm.meansAccess}
                  onChange={(event) => setCrisisForm((previous) => ({ ...previous, meansAccess: event.target.checked }))}
                />
                Means access
              </label>
              <input
                type="number"
                value={crisisForm.priorAttempts}
                onChange={(event) => setCrisisForm((previous) => ({ ...previous, priorAttempts: Number(event.target.value) }))}
                className="rounded-lg border px-3 py-2 text-sm"
                placeholder="Prior attempts"
              />
            </div>
            <button
              type="button"
              onClick={() => void submitCrisis()}
              className="mt-4 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white"
            >
              Save crisis event
            </button>
          </div>

          <div className="rounded-lg border bg-white p-4">
            <p className="mb-3 text-sm font-semibold text-gray-900">Crisis history</p>
            <div className="space-y-3">
              {crisisEvents.map((event) => (
                <div key={event.id} className="rounded-md bg-gray-50 p-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-semibold text-gray-900">{event.crisisType}</span>
                    <span className={`rounded-full px-2 py-0.5 text-xs ${RISK_BADGE[event.lethality] || 'bg-gray-100 text-gray-700'}`}>
                      {event.lethality}
                    </span>
                  </div>
                </div>
              ))}
              {!crisisEvents.length && <p className="text-sm text-gray-500">No crisis history recorded.</p>}
            </div>
          </div>
        </div>
      )}

      {tab === 'safeplan' && (
        <div className="space-y-4">
          <div className="rounded-lg border bg-white p-4">
            <p className="mb-3 text-sm font-semibold text-gray-900">Safety plan template</p>
            <div className="flex flex-wrap gap-3">
              <select
                value={safetyRiskLevel}
                onChange={(event) => setSafetyRiskLevel(event.target.value)}
                className="rounded-lg border px-3 py-2 text-sm"
              >
                <option value="low">Low</option>
                <option value="moderate">Moderate</option>
                <option value="high">High</option>
                <option value="imminent">Imminent</option>
              </select>
              <button
                type="button"
                onClick={() => void generateSafetyPlan()}
                className="rounded-lg bg-purple-600 px-4 py-2 text-sm font-medium text-white"
              >
                Generate template
              </button>
              <button
                type="button"
                onClick={() => void saveSafetyPlan()}
                className="rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white"
              >
                Save as active plan
              </button>
            </div>

            {safetyPlanTemplate && (
              <div className="mt-4 rounded-lg border border-green-200 bg-green-50 p-4">
                <p className="text-sm font-semibold text-green-900">Generated safety plan</p>
                <p className="mt-2 text-sm text-green-800">{safetyPlanTemplate.emergency_action}</p>
                <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-green-800">
                  {(safetyPlanTemplate.warning_signs || []).map((item: string) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          {activePlan && (
            <div className="rounded-lg border bg-white p-4">
              <p className="mb-3 text-sm font-semibold text-gray-900">Active saved safety plan</p>
              <p className="text-sm text-gray-700">Reason to live: {activePlan.reasonToLive || 'Not documented'}</p>
              <p className="mt-2 text-sm text-gray-700">
                Warning signs: {(activePlan.warningSigns || []).join(', ') || 'Not documented'}
              </p>
            </div>
          )}
        </div>
      )}

      {tab === 'meds' && (
        <div className="space-y-4">
          <div className="rounded-lg border bg-white p-4">
            <p className="mb-3 text-sm font-semibold text-gray-900">Add psychotropic medication</p>
            <div className="grid gap-3 md:grid-cols-2">
              <input
                placeholder="Drug name"
                value={medicationForm.drugName}
                onChange={(event) => setMedicationForm((previous) => ({ ...previous, drugName: event.target.value }))}
                className="rounded-lg border px-3 py-2 text-sm"
              />
              <select
                value={medicationForm.drugClass}
                onChange={(event) => setMedicationForm((previous) => ({ ...previous, drugClass: event.target.value }))}
                className="rounded-lg border px-3 py-2 text-sm"
              >
                <option value="antidepressant">Antidepressant</option>
                <option value="antipsychotic">Antipsychotic</option>
                <option value="mood_stabilizer">Mood stabilizer</option>
              </select>
              <input
                placeholder="Dose"
                value={medicationForm.doseMg}
                onChange={(event) => setMedicationForm((previous) => ({ ...previous, doseMg: event.target.value }))}
                className="rounded-lg border px-3 py-2 text-sm"
              />
              <input
                placeholder="Frequency"
                value={medicationForm.frequency}
                onChange={(event) => setMedicationForm((previous) => ({ ...previous, frequency: event.target.value }))}
                className="rounded-lg border px-3 py-2 text-sm"
              />
            </div>
            <button
              type="button"
              onClick={() => void submitMedication()}
              className="mt-4 rounded-lg bg-purple-600 px-4 py-2 text-sm font-medium text-white"
            >
              Add medication
            </button>
          </div>

          <div className="rounded-lg border bg-white p-4">
            <p className="mb-3 text-sm font-semibold text-gray-900">Medication monitoring</p>
            <div className="space-y-3">
              {medications.map((medication) => (
                <div key={medication.id} className="rounded-md bg-gray-50 p-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-semibold text-gray-900">{medication.drugName}</span>
                    {medAlerts[medication.id]?.has_critical_alert && (
                      <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs text-red-700">Critical alert</span>
                    )}
                  </div>
                  <ul className="mt-2 list-disc space-y-1 pl-5 text-xs text-gray-700">
                    {(medAlerts[medication.id]?.monitoring_due || []).map((item: string) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                </div>
              ))}
              {!medications.length && <p className="text-sm text-gray-500">No active psychotropic medications.</p>}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
