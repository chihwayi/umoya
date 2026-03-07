/**
 * SOAP Template Registry — specialty-specific required SOAP fields and validation.
 * Drives encounter specialty validation and publish/signoff gates.
 * No PHI stored; validation is stateless (caller supplies SOAP + context).
 */

export type PostVisitSoapSpecialty = 'general_practice' | 'mental_health' | 'cardiology' | 'paediatrics';

export interface SpecialtySoapCheckResult {
  id: string;
  label: string;
  passed: boolean;
  guidance: string;
}

export interface SpecialtySoapValidationSummary {
  specialty: PostVisitSoapSpecialty;
  templateVersion: 'v1';
  isComplete: boolean;
  completenessScore: number;
  checks: SpecialtySoapCheckResult[];
  missingCheckIds: string[];
}

/** Context passed into registry (no raw PHI; caller derives from patient context). */
export interface SoapTemplateContext {
  modules?: Record<string, any>;
  age?: number;
  hasWeight?: boolean;
}

/** SOAP note fields (normalized strings). */
export interface SoapNoteFields {
  subjective: string;
  objective: string;
  assessment: string;
  plan: string;
}

const SPECIALTIES: PostVisitSoapSpecialty[] = [
  'general_practice',
  'mental_health',
  'cardiology',
  'paediatrics',
];

/**
 * Run specialty-specific SOAP validation. Returns summary with required-field checks.
 * Encounter specialty drives required SOAP fields; missing required fields yield isComplete: false.
 */
export function getValidationSummary(
  specialty: PostVisitSoapSpecialty,
  soapNote: SoapNoteFields,
  context: SoapTemplateContext,
): SpecialtySoapValidationSummary {
  const { subjective, objective, assessment, plan } = soapNote;
  const { modules = {}, age = 0, hasWeight = false } = context;

  const checksBySpecialty: Record<PostVisitSoapSpecialty, SpecialtySoapCheckResult[]> = {
    general_practice: [
      {
        id: 'gp_subjective_present',
        label: 'Subjective history documented',
        passed: subjective.length > 0,
        guidance: 'Capture chief complaint and patient-reported symptoms in subjective.',
      },
      {
        id: 'gp_assessment_present',
        label: 'Assessment documented',
        passed: assessment.length > 0,
        guidance: 'Document clinical impression/diagnosis in assessment.',
      },
      {
        id: 'gp_plan_present',
        label: 'Plan documented',
        passed: plan.length > 0,
        guidance: 'Document clear follow-up or treatment plan.',
      },
    ],
    cardiology: [
      {
        id: 'cardio_subjective_symptoms',
        label: 'Cardiac symptom narrative present',
        passed: /(chest|palpitation|dyspnea|shortness of breath|syncope|edema|angina)/i.test(subjective),
        guidance: 'Document key cardiac symptoms (e.g., chest pain, dyspnea, palpitations).',
      },
      {
        id: 'cardio_objective_vitals',
        label: 'Objective cardiovascular findings present',
        passed:
          /(bp|blood pressure|heart rate|ecg|ekg|rhythm|murmur|troponin|spo2)/i.test(objective) ||
          !!modules?.cardiology?.latestEncounter,
        guidance: 'Include objective cardiovascular findings/vitals or ECG context.',
      },
      {
        id: 'cardio_plan_followup',
        label: 'Cardiology follow-up/management plan present',
        passed: /(follow|echo|ecg|stress|angi|cardio|review)/i.test(plan),
        guidance: 'Include cardiology-specific plan/follow-up actions.',
      },
    ],
    paediatrics: [
      {
        id: 'peds_age_context',
        label: 'Paediatric age context confirmed',
        passed: age > 0 && age < 15,
        guidance: 'Ensure paediatric template is used only for paediatric patients.',
      },
      {
        id: 'peds_weight_documented',
        label: 'Weight documented for dosing context',
        passed: hasWeight || /(weight|kg)/i.test(objective),
        guidance: 'Capture child weight for safe dosing and growth context.',
      },
      {
        id: 'peds_guardian_plan',
        label: 'Caregiver/follow-up instructions present',
        passed: /(caregiver|guardian|parent|return|follow)/i.test(plan),
        guidance: 'Document caregiver education and return/follow-up instructions.',
      },
    ],
    mental_health: [
      {
        id: 'mh_subjective_mse',
        label: 'Mood/affect symptom narrative present',
        passed: /(mood|anxiety|sleep|stress|depress|psych|panic|hallucinat)/i.test(subjective),
        guidance: 'Capture symptom narrative relevant to mental health visit.',
      },
      {
        id: 'mh_assessment_risk',
        label: 'Risk/safety assessment documented',
        passed: /(risk|suicid|self-harm|homicid|safety)/i.test(assessment),
        guidance: 'Include risk/safety assessment in mental-health assessment.',
      },
      {
        id: 'mh_plan_support',
        label: 'Plan includes support/therapy/follow-up',
        passed: /(therapy|counsel|follow|support|referral|safety plan)/i.test(plan),
        guidance: 'Include treatment/support or referral plan.',
      },
    ],
  };

  const checks = checksBySpecialty[specialty];
  const missingCheckIds = checks.filter((c) => !c.passed).map((c) => c.id);
  const passedCount = checks.filter((c) => c.passed).length;
  const completenessScore = checks.length ? Number((passedCount / checks.length).toFixed(2)) : 0;

  return {
    specialty,
    templateVersion: 'v1',
    isComplete: missingCheckIds.length === 0,
    completenessScore,
    checks,
    missingCheckIds,
  };
}

/** Return list of supported specialties (General Practice, Mental Health, Cardiology, Paediatrics). */
export function getSupportedSpecialties(): PostVisitSoapSpecialty[] {
  return [...SPECIALTIES];
}
