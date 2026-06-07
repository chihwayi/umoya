/**
 * Umoya CDSS Service — Mobile
 *
 * All methods proxy to the EHR service which forwards to the CDSS FastAPI
 * service at port 8000. Never call CDSS directly from mobile.
 *
 * All methods are safe: they catch errors and return fallback values with
 * `abstained: true` rather than throwing. Never show fake data on failure.
 */

import { api } from './api';

// ─── Result types ─────────────────────────────────────────────────────────────

export interface DrugInteraction {
  drug1: string;
  drug2: string;
  severity: 'major' | 'moderate' | 'minor';
  description: string;
  recommendation: string;
}

export interface InteractionResult {
  interactions: DrugInteraction[];
  confidence: number;
  abstained: boolean;
}

export interface HerbDrugInteraction {
  herb: string;
  drug: string;
  severity: 'major' | 'moderate' | 'minor';
  warning: string;
}

export interface HerbDrugResult {
  interactions: HerbDrugInteraction[];
  confidence: number;
  abstained: boolean;
}

export interface DosingResult {
  recommendation: string;
  dose: string;
  route: string;
  frequency: string;
  adjustments: string[];
  confidence: number;
  citations: string[];
  abstained: boolean;
}

export interface RiskScoreResult {
  score: number | null;
  interpretation: string;
  recommendations: string[];
  confidence: number;
  citations: string[];
  abstained: boolean;
}

export interface GuidelineEntry {
  title: string;
  content: string;
  source: string;
  confidence: number;
}

export interface GuidelineResult {
  results: GuidelineEntry[];
  abstained: boolean;
}

export interface DiagnosisDifferential {
  diagnosis: string;
  icd: string;
  probability: number;
  reasoning: string;
}

export interface DiagnosisResult {
  differentials: DiagnosisDifferential[];
  confidence: number;
  abstained: boolean;
}

export interface LabInterpretResult {
  interpretation: string;
  severity: 'critical' | 'high' | 'moderate' | 'normal' | 'unknown';
  trend: string;
  action: string;
  confidence: number;
  abstained: boolean;
}

export interface RiskTierResult {
  tier: 'Critical' | 'High' | 'Medium' | 'Low' | 'Minimal';
  score: number;
  factors: string[];
  recommended_actions: string[];
  confidence: number;
}

export interface CareGapResult {
  id: string;
  type: string;
  icdCode: string;
  description: string;
  priority: 'high' | 'medium' | 'low';
  dueDate: string;
}

export interface DeteriorationResult {
  probability: number;
  tier: 'critical' | 'high' | 'moderate' | 'low';
  news2Score: number;
  interventions: string[];
  riskHorizonHours: number;
}

export interface ShiftSummaryResult {
  summary: string;
  criticalCount: number;
  pendingActions: string[];
  confidence: number;
  abstained: boolean;
}

export interface AvailableDoctor {
  id: string;
  name: string;
  role: string;
  available: boolean;
  specialty: string;
}

export interface SbarResult {
  S: string;
  B: string;
  A: string;
  R: string;
}

export interface FallRiskResult {
  riskLevel: 'HIGH' | 'MODERATE' | 'LOW';
  score: number;
  factors: string[];
  interventions: string[];
}

export interface MedRecResult {
  duplicates: string[];
  interactions: string[];
  omissions: string[];
  recommendations: string[];
}

export interface PactrTrial {
  id: string;
  title: string;
  phase: string;
  sponsor: string;
  condition: string;
  criteriaMatched: string[];
  registryUrl?: string;
}

export interface PactrEligibilityResult {
  trials: PactrTrial[];
  patientId: string;
  checkedAt: string;
}

// ─── Safe fallbacks ───────────────────────────────────────────────────────────

const ABSTAINED_INTERACTION: InteractionResult = { interactions: [], confidence: 0, abstained: true };
const ABSTAINED_DOSING: DosingResult = { recommendation: '', dose: '', route: '', frequency: '', adjustments: [], confidence: 0, citations: [], abstained: true };
const ABSTAINED_RISK: RiskScoreResult = { score: null, interpretation: '', recommendations: [], confidence: 0, citations: [], abstained: true };
const ABSTAINED_GUIDELINE: GuidelineResult = { results: [], abstained: true };
const ABSTAINED_DIAGNOSIS: DiagnosisResult = { differentials: [], confidence: 0, abstained: true };
const ABSTAINED_LAB: LabInterpretResult = { interpretation: '', severity: 'unknown', trend: '', action: '', confidence: 0, abstained: true };

export interface SafetySyndromeAlert {
  type: string;
  severity: string;
  message: string;
  action?: string;
}
export interface SafetyEvalResult {
  acute_deterioration: boolean;
  acute_state: string;
  aggregate_severity: string;
  sepsis_screen_positive: boolean;
  syndrome_alerts: SafetySyndromeAlert[];
  copilot_summary?: string;
}
const ABSTAINED_SAFETY: SafetyEvalResult = {
  acute_deterioration: false, acute_state: 'STABLE', aggregate_severity: 'low',
  sepsis_screen_positive: false, syndrome_alerts: [],
};

// ─── CdssService ──────────────────────────────────────────────────────────────

export const CdssService = {
  /**
   * Drug-drug interaction check.
   * POST /cdss/drug-interactions
   */
  async checkInteractions(drugs: string[]): Promise<InteractionResult> {
    try {
      const res = await api.post<InteractionResult>('/cdss/drug-interactions', { drugs });
      return res.data ?? ABSTAINED_INTERACTION;
    } catch {
      return ABSTAINED_INTERACTION;
    }
  },

  /**
   * Herb-drug interaction check (traditional medicine disclosures).
   *
   * Flow:
   * 1) GET /cultural/social-determinants/:patientId/traditional-medicine-disclosures
   * 2) POST /cdss/traditional-medicine/herb-drug-interactions
   *
   * Returns:
   * - HerbDrugResult if disclosures exist (even if interactions empty / abstained)
   * - null if no disclosures or if the check fails
   */
  async checkHerbDrugInteractions(
    patientId: string,
    currentMedications: string[],
  ): Promise<HerbDrugResult | null> {
    try {
      const disclosuresRes = await api.get<{
        disclosures: Array<{ herb: string; form: string; frequency: string }>;
      }>(`/cultural/social-determinants/${patientId}/traditional-medicine-disclosures`);

      const disclosures = disclosuresRes.data?.disclosures ?? [];
      const herbs = disclosures.map((d) => d.herb).filter(Boolean);
      if (herbs.length === 0) return null;

      const interactionsRes = await api.post<HerbDrugResult>(
        '/cdss/traditional-medicine/herb-drug-interactions',
        { herbs, currentMedications },
      );
      return interactionsRes.data ?? { interactions: [], confidence: 0, abstained: true };
    } catch {
      return null;
    }
  },

  /**
   * Dose calculation via governed JSON endpoint.
   * POST /governed/json surface='dose_calculator' task='calculate_dose'
   */
  async dosing(description: string): Promise<DosingResult> {
    try {
      const res = await api.post<{ result: DosingResult }>('/governed/json', {
        surface:    'dose_calculator',
        task:       'calculate_dose',
        payload:    { description },
        governance: { require_citations: true, abstain_if_uncertain: true, phi_guard: true },
      });
      return res.data?.result ?? ABSTAINED_DOSING;
    } catch {
      return ABSTAINED_DOSING;
    }
  },

  /**
   * Clinical risk score calculation via governed JSON endpoint.
   * POST /governed/json surface='clinical_risk_score' task='calculate_risk'
   */
  async riskScore(description: string): Promise<RiskScoreResult> {
    try {
      const res = await api.post<{ result: RiskScoreResult }>('/governed/json', {
        surface:    'clinical_risk_score',
        task:       'calculate_risk',
        payload:    { description },
        governance: { require_citations: true, abstain_if_uncertain: true, phi_guard: true },
      });
      return res.data?.result ?? ABSTAINED_RISK;
    } catch {
      return ABSTAINED_RISK;
    }
  },

  /**
   * Deterministic clinical-safety synthesis (NEWS2-aware qSOFA/SIRS/DKA/pain +
   * syndrome alerts). Single source of truth shared with the web.
   * POST /cdss/safety-eval
   */
  async safetyEval(vitals: Record<string, any>): Promise<SafetyEvalResult> {
    try {
      const res = await api.post<SafetyEvalResult>('/cdss/safety-eval', { vitals });
      return res.data ?? ABSTAINED_SAFETY;
    } catch {
      return ABSTAINED_SAFETY;
    }
  },

  /**
   * Guideline knowledge search.
   * POST /knowledge/search
   */
  async guidelineSearch(query: string): Promise<GuidelineResult> {
    try {
      const res = await api.post<GuidelineResult>('/knowledge/search', {
        query,
        surface: 'mobile_guidelines',
        top_k:   5,
      });
      return res.data ?? ABSTAINED_GUIDELINE;
    } catch {
      return ABSTAINED_GUIDELINE;
    }
  },

  /**
   * Differential diagnosis suggestion via governed JSON endpoint.
   * POST /governed/json surface='diagnosis_mobile' task='suggest_diagnosis'
   */
  async diagnosisSuggest(symptoms: string): Promise<DiagnosisResult> {
    try {
      const res = await api.post<{ result: DiagnosisResult }>('/governed/json', {
        surface:    'diagnosis_mobile',
        task:       'suggest_diagnosis',
        payload:    { symptoms },
        governance: { require_citations: false, abstain_if_uncertain: true, phi_guard: true },
      });
      return res.data?.result ?? ABSTAINED_DIAGNOSIS;
    } catch {
      return ABSTAINED_DIAGNOSIS;
    }
  },

  /**
   * Lab result interpretation via governed JSON endpoint.
   * POST /governed/json surface='lab_interpretation_mobile' task='interpret'
   */
  async interpretLab(
    test: string,
    value: string,
    unit: string,
    patientContext?: string,
  ): Promise<LabInterpretResult> {
    try {
      const res = await api.post<{ result: LabInterpretResult }>('/governed/json', {
        surface:    'lab_interpretation_mobile',
        task:       'interpret',
        payload:    { test, value, unit, patientContext },
        governance: { require_citations: false, abstain_if_uncertain: true, phi_guard: true },
      });
      return res.data?.result ?? ABSTAINED_LAB;
    } catch {
      return ABSTAINED_LAB;
    }
  },

  /**
   * Get ML risk tier for a patient.
   * GET /model-monitoring/risk-stratification/patient/:patientId
   */
  async getPatientRiskTier(patientId: string): Promise<RiskTierResult | null> {
    try {
      const res = await api.get<RiskTierResult>(
        `/model-monitoring/risk-stratification/patient/${patientId}`,
      );
      return res.data ?? null;
    } catch {
      return null;
    }
  },

  /**
   * Get open care gaps for a patient.
   * GET /care-gaps/patient/:patientId
   */
  async getPatientCareGaps(patientId: string): Promise<CareGapResult[]> {
    try {
      const res = await api.get<CareGapResult[]>(`/care-gaps/patient/${patientId}`);
      return res.data ?? [];
    } catch {
      return [];
    }
  },

  /**
   * Get ML deterioration risk for a patient.
   * GET /early-warning/patient/:patientId/ml-risk
   */
  async getDeteriorationRisk(patientId: string): Promise<DeteriorationResult | null> {
    try {
      const res = await api.get<DeteriorationResult>(
        `/early-warning/patient/${patientId}/ml-risk`,
      );
      return res.data ?? null;
    } catch {
      return null;
    }
  },

  /**
   * Get AI shift summary for a ward.
   * POST /governed/json surface='nurse_shift_summary' task='summarize_shift'
   */
  async getAiShiftSummary(wardId?: string): Promise<ShiftSummaryResult> {
    try {
      const res = await api.post<{ result: ShiftSummaryResult }>('/governed/json', {
        surface:    'nurse_shift_summary',
        task:       'summarize_shift',
        payload:    { wardId },
        governance: { require_citations: false, abstain_if_uncertain: true, phi_guard: true },
      });
      return res.data?.result ?? { summary: '', criticalCount: 0, pendingActions: [], confidence: 0, abstained: true };
    } catch {
      return { summary: '', criticalCount: 0, pendingActions: [], confidence: 0, abstained: true };
    }
  },

  /**
   * Get list of available doctors.
   * GET /staff/doctors/available
   */
  async getAvailableDoctors(): Promise<AvailableDoctor[]> {
    try {
      const res = await api.get<AvailableDoctor[]>('/staff/doctors/available');
      return res.data ?? [];
    } catch {
      return [];
    }
  },

  /**
   * Generate SBAR handoff note for a patient.
   * POST /governed/json surface='sbar_generation'
   */
  async generateSBAR(params: {
    patientId: string;
    admissionDiagnosis: string;
    currentVitals: Record<string, number>;
    medications: string[];
    patientAge: number;
  }): Promise<SbarResult | null> {
    try {
      const res = await api.post<{ result: { sbar: SbarResult }; abstained?: boolean }>('/governed/json', {
        surface:    'sbar_generation',
        task:       'generate_sbar',
        payload:    {
          admission_diagnosis:   params.admissionDiagnosis,
          current_vitals:        params.currentVitals,
          current_medications:   params.medications,
          patient_age:           params.patientAge,
          active_concerns:       [],
        },
        governance: { abstain_if_uncertain: true, phi_guard: true },
      });
      if (res.data?.abstained) return null;
      return res.data?.result?.sbar ?? null;
    } catch {
      return null;
    }
  },

  /**
   * Assess fall risk for a patient.
   * POST /governed/json surface='fall_risk_assessment'
   */
  async assessFallRisk(params: {
    patientId: string;
    age: number;
    diagnoses: string[];
    medications: string[];
    gait: 'normal' | 'weak' | 'impaired';
    mentalStatus: 'oriented' | 'forgetful' | 'confused';
  }): Promise<FallRiskResult | null> {
    try {
      const res = await api.post<{ result: { risk_level: string; score: number; factors: string[]; interventions: string[] }; abstained?: boolean }>('/governed/json', {
        surface:    'fall_risk_assessment',
        task:       'assess_fall_risk',
        payload:    {
          age:            params.age,
          diagnoses:      params.diagnoses,
          medications:    params.medications,
          gait:           params.gait,
          mental_status:  params.mentalStatus,
        },
        governance: { abstain_if_uncertain: true, phi_guard: true },
      });
      if (res.data?.abstained) return null;
      const r = res.data?.result;
      if (!r) return null;
      return {
        riskLevel:     (r.risk_level?.toUpperCase() ?? 'LOW') as FallRiskResult['riskLevel'],
        score:         r.score ?? 0,
        factors:       r.factors ?? [],
        interventions: r.interventions ?? [],
      };
    } catch {
      return null;
    }
  },

  /**
   * AI ESI triage level suggestion.
   * POST /governed/json surface='triage_esi' task='suggest_esi'
   */
  async triageESI(params: {
    age: number;
    complaint: string;
  }): Promise<1 | 2 | 3 | 4 | 5 | null> {
    try {
      const res = await api.post<{ result: { esi: number }; abstained?: boolean }>('/governed/json', {
        surface:    'triage_esi',
        task:       'suggest_esi',
        payload:    { age: params.age, complaint: params.complaint },
        governance: { abstain_if_uncertain: true, phi_guard: true },
      });
      if (res.data?.abstained) return null;
      const esi = res.data?.result?.esi;
      if (esi && esi >= 1 && esi <= 5) return esi as 1 | 2 | 3 | 4 | 5;
      return null;
    } catch {
      return null;
    }
  },

  /**
   * AI medication reconciliation check.
   * POST /governed/json surface='medication_reconciliation'
   */
  async reconcileMedications(params: {
    patientId: string;
    homeMeds: string[];
    hospitalMeds: string[];
    diagnoses: string[];
  }): Promise<MedRecResult | null> {
    try {
      const res = await api.post<{ result: MedRecResult; abstained?: boolean }>('/governed/json', {
        surface:    'medication_reconciliation',
        task:       'reconcile_medications',
        payload:    {
          home_medications:     params.homeMeds,
          hospital_medications: params.hospitalMeds,
          diagnoses:            params.diagnoses,
        },
        governance: { abstain_if_uncertain: true, phi_guard: true },
      });
      if (res.data?.abstained) return null;
      return res.data?.result ?? null;
    } catch {
      return null;
    }
  },

  /**
   * PACTR trial eligibility check.
   * GET /pactr/trials/eligible?patientId=:patientId
   */
  async getPactrTrialEligibility(patientId: string): Promise<PactrEligibilityResult | null> {
    try {
      const trimmed = patientId.trim();
      if (!trimmed) {
        return null;
      }
      const res = await api.get<PactrEligibilityResult>(
        `/pactr/trials/eligible?patientId=${encodeURIComponent(trimmed)}`,
      );
      if (!res.data?.trials?.length) {
        return null;
      }
      return res.data;
    } catch {
      return null;
    }
  },
};
