/**
 * RealTimeAlertEngine — stream partial transcript processing and structured vitals alerting.
 * Detects allergy, medication reaction, dose/vitals, sepsis, Zimbabwe-context disease signals,
 * and multi-system emergencies from live transcript chunks and/or structured vitals objects.
 * No PHI stored; stateless detection only. Caller is responsible for persistence and HIPAA audit.
 */

export type RealTimeAlertSeverity = 'moderate' | 'high' | 'critical';

export interface RealTimeAlertEngineDraft {
  alertType: string;
  severity: RealTimeAlertSeverity;
  alertMessage: string;
  suggestedAction: string;
  confidence: number;
  triggerTerms?: string[];
  metadata?: Record<string, any>;
}

/** Structured vitals for threshold-based alerting (all fields optional). */
export interface VitalsInput {
  /** Celsius */
  temperature?: number;
  heartRate?: number;
  respiratoryRate?: number;
  systolicBp?: number;
  diastolicBp?: number;
  /** 0–100 */
  spo2?: number;
  /** Glasgow Coma Scale 3–15 */
  gcs?: number;
  /** mmol/L */
  bloodGlucose?: number;
  /** mmol/L */
  lactate?: number;
  /** NEWS2 total if pre-computed */
  news2Score?: number;
}

function collectMatchingTerms(text: string, terms: string[]): string[] {
  const matches: string[] = [];
  for (const term of terms) {
    if (text.includes(term)) matches.push(term);
  }
  return matches;
}

function getSeverityRank(severity: RealTimeAlertSeverity): number {
  if (severity === 'critical') return 3;
  if (severity === 'high') return 2;
  return 1;
}

function dedupeDrafts(items: RealTimeAlertEngineDraft[]): RealTimeAlertEngineDraft[] {
  const byType = new Map<string, RealTimeAlertEngineDraft>();
  for (const item of items) {
    const existing = byType.get(item.alertType);
    if (!existing) {
      byType.set(item.alertType, item);
      continue;
    }
    const nextRank = getSeverityRank(item.severity);
    const currentRank = getSeverityRank(existing.severity);
    if (nextRank > currentRank || (nextRank === currentRank && item.confidence > existing.confidence)) {
      byType.set(item.alertType, item);
    }
  }
  return Array.from(byType.values()).sort((left, right) => {
    const delta = getSeverityRank(right.severity) - getSeverityRank(left.severity);
    if (delta !== 0) return delta;
    return right.confidence - left.confidence;
  });
}

function normalizeGlucoseToMmol(value: number): number {
  // Older patient-facing flows store glucose in mg/dL, while clinical vitals entry uses mmol/L.
  // Values above 60 are physiologically implausible in mmol/L, so treat them as mg/dL.
  return value > 60 ? Number((value / 18).toFixed(1)) : value;
}

/**
 * Detect intra-visit safety alert drafts from a transcript chunk (allergy, medication reaction,
 * dose/vitals, cardiorespiratory, behavioral). Designed for low-latency use on local stack.
 */
export function detectFromTranscript(text: string): RealTimeAlertEngineDraft[] {
  const normalized = String(text || '').toLowerCase();
  if (!normalized.trim()) return [];
  const drafts: RealTimeAlertEngineDraft[] = [];

  const cardiorespiratoryTerms = [
    'chest pain',
    'shortness of breath',
    'difficulty breathing',
    'cannot breathe',
    'can not breathe',
    'fainted',
    'passed out',
    'seizure',
  ];
  const cardiorespiratoryMatches = collectMatchingTerms(normalized, cardiorespiratoryTerms);
  if (cardiorespiratoryMatches.length > 0) {
    drafts.push({
      alertType: 'cardiorespiratory_emergency_signal',
      severity: 'critical',
      alertMessage: 'Potential cardiorespiratory emergency signal detected in live transcript.',
      suggestedAction: 'Pause routine flow and activate emergency response pathway with immediate vital reassessment.',
      confidence: 0.94,
      triggerTerms: cardiorespiratoryMatches.slice(0, 8),
      metadata: { detection: 'keyword_bundle_v1' },
    });
  }

  const behavioralTerms = ['suicidal', 'suicide', 'self harm', 'self-harm', 'overdose', 'kill myself'];
  const behavioralMatches = collectMatchingTerms(normalized, behavioralTerms);
  if (behavioralMatches.length > 0) {
    drafts.push({
      alertType: 'acute_behavioral_safety_signal',
      severity: 'critical',
      alertMessage: 'Acute behavioral safety risk phrase detected.',
      suggestedAction: 'Initiate safety protocol, keep patient supervised, and escalate to urgent behavioral response.',
      confidence: 0.92,
      triggerTerms: behavioralMatches.slice(0, 8),
      metadata: { detection: 'keyword_bundle_v1' },
    });
  }

  const medicationReactionTerms = [
    'allergic reaction',
    'rash after',
    'swelling lips',
    'swollen tongue',
    'medication reaction',
  ];
  const medicationReactionMatches = collectMatchingTerms(normalized, medicationReactionTerms);
  if (medicationReactionMatches.length > 0) {
    drafts.push({
      alertType: 'acute_medication_reaction_signal',
      severity: 'high',
      alertMessage: 'Possible acute medication reaction detected.',
      suggestedAction:
        'Review recent medication exposure immediately and trigger urgent allergy/adverse reaction assessment.',
      confidence: 0.84,
      triggerTerms: medicationReactionMatches.slice(0, 8),
      metadata: { detection: 'keyword_bundle_v1' },
    });
  }

  const painScoreMatch = normalized.match(/(?:pain\s*(?:score)?\s*[:=]?\s*)(10|[8-9])\s*(?:\/\s*10)?/i);
  if (painScoreMatch) {
    drafts.push({
      alertType: 'severe_pain_signal',
      severity: 'high',
      alertMessage: 'Severe pain score captured during encounter.',
      suggestedAction: 'Run severe pain protocol with urgent reassessment and doctor intervention.',
      confidence: 0.79,
      triggerTerms: [`pain_score_${painScoreMatch[1]}`],
      metadata: { detection: 'numeric_pattern_v1' },
    });
  }

  const bloodPressureMatch = normalized.match(/\b(\d{2,3})\s*\/\s*(\d{2,3})\b/);
  if (bloodPressureMatch) {
    const systolic = Number(bloodPressureMatch[1]);
    const diastolic = Number(bloodPressureMatch[2]);
    if (Number.isFinite(systolic) && Number.isFinite(diastolic)) {
      if (systolic >= 180 || diastolic >= 120) {
        drafts.push({
          alertType: 'hypertensive_crisis_signal',
          severity: 'critical',
          alertMessage: `Severely elevated blood pressure detected (${systolic}/${diastolic}).`,
          suggestedAction: 'Trigger urgent hypertensive emergency workflow and verify measurement immediately.',
          confidence: 0.9,
          triggerTerms: [`bp_${systolic}_${diastolic}`],
          metadata: { systolic, diastolic, detection: 'vitals_pattern_v1' },
        });
      } else if (systolic >= 160 || diastolic >= 100) {
        drafts.push({
          alertType: 'severe_hypertension_signal',
          severity: 'high',
          alertMessage: `Severe hypertension range detected (${systolic}/${diastolic}).`,
          suggestedAction: 'Repeat blood pressure and prioritize clinician review in current visit.',
          confidence: 0.81,
          triggerTerms: [`bp_${systolic}_${diastolic}`],
          metadata: { systolic, diastolic, detection: 'vitals_pattern_v1' },
        });
      } else if (systolic < 90 || diastolic < 60) {
        drafts.push({
          alertType: 'hypotension_signal',
          severity: 'high',
          alertMessage: `Possible hypotension detected (${systolic}/${diastolic}).`,
          suggestedAction: 'Assess perfusion signs and repeat vitals with urgent clinician review.',
          confidence: 0.8,
          triggerTerms: [`bp_${systolic}_${diastolic}`],
          metadata: { systolic, diastolic, detection: 'vitals_pattern_v1' },
        });
      }
    }
  }

  const spo2Match = normalized.match(/(?:spo2|oxygen saturation)\s*(?:is|of|:|=)?\s*(\d{2,3})\s*%?/i);
  if (spo2Match) {
    const spo2 = Number(spo2Match[1]);
    if (Number.isFinite(spo2)) {
      if (spo2 < 90) {
        drafts.push({
          alertType: 'critical_hypoxia_signal',
          severity: 'critical',
          alertMessage: `Critical oxygen saturation detected (${spo2}%).`,
          suggestedAction: 'Start urgent hypoxia management protocol and escalate immediately.',
          confidence: 0.93,
          triggerTerms: [`spo2_${spo2}`],
          metadata: { spo2, detection: 'vitals_pattern_v1' },
        });
      } else if (spo2 < 93) {
        drafts.push({
          alertType: 'hypoxia_risk_signal',
          severity: 'high',
          alertMessage: `Low oxygen saturation detected (${spo2}%).`,
          suggestedAction: 'Repeat pulse oximetry and evaluate for respiratory compromise.',
          confidence: 0.86,
          triggerTerms: [`spo2_${spo2}`],
          metadata: { spo2, detection: 'vitals_pattern_v1' },
        });
      }
    }
  }

  // ── Sepsis multi-signal ───────────────────────────────────────────────────
  const sepsisTerms = ['sepsis', 'septic', 'bacteremia', 'bacteraemia', 'blood infection', 'systemic infection'];
  const sepsisMatches = collectMatchingTerms(normalized, sepsisTerms);
  const feverMentioned = /\b(fever|febrile|temperature of 3[89]|temp 3[89])\b/.test(normalized);
  const alteredMentalMentioned = /\b(confused|confusion|disoriented|altered|not responsive|unresponsive|drowsy|lethargic)\b/.test(normalized);
  const lowBpMentioned = /\b(hypotensive|low blood pressure|bp (?:is )?(?:[56789]\d|[1-8]\d)\b)/.test(normalized);
  const sepsisSignalCount = [sepsisMatches.length > 0, feverMentioned && alteredMentalMentioned, feverMentioned && lowBpMentioned].filter(Boolean).length;
  if (sepsisSignalCount >= 1 || (feverMentioned && alteredMentalMentioned && lowBpMentioned)) {
    drafts.push({
      alertType: 'sepsis_signal',
      severity: sepsisSignalCount >= 2 || (feverMentioned && alteredMentalMentioned && lowBpMentioned) ? 'critical' : 'high',
      alertMessage: 'Possible sepsis signals detected in transcript (fever, altered mental status, or hypotension cluster).',
      suggestedAction: 'Initiate hour-1 sepsis bundle: blood cultures × 2, lactate, broad-spectrum antibiotics, 30 mL/kg IV fluid bolus.',
      confidence: sepsisMatches.length > 0 ? 0.88 : 0.72,
      triggerTerms: [...sepsisMatches, ...(feverMentioned ? ['fever'] : []), ...(alteredMentalMentioned ? ['altered_mental_status'] : []), ...(lowBpMentioned ? ['hypotension'] : [])],
      metadata: { detection: 'multi_signal_sepsis_v1' },
    });
  }

  // ── Anaphylaxis constellation ─────────────────────────────────────────────
  const anaphylaxisTerms = ['anaphylaxis', 'anaphylactic', 'throat closing', 'throat tightening', 'tongue swelling', 'swollen tongue', 'severe allergic', 'adrenaline', 'epinephrine', 'epipen'];
  const anaphylaxisMatches = collectMatchingTerms(normalized, anaphylaxisTerms);
  const hivesOrUrticaria = /\b(hives|urticaria|widespread rash|itching all over)\b/.test(normalized);
  const wheezingMentioned = /\b(wheez|stridor|unable to breathe|can't breathe)\b/.test(normalized);
  if (anaphylaxisMatches.length > 0 || (hivesOrUrticaria && wheezingMentioned)) {
    drafts.push({
      alertType: 'anaphylaxis_signal',
      severity: 'critical',
      alertMessage: 'Possible anaphylaxis constellation detected (urticaria + wheeze or explicit anaphylaxis terms).',
      suggestedAction: 'Administer IM adrenaline 0.5 mg immediately. Lay flat, legs elevated. IV access, fluids, call emergency team.',
      confidence: anaphylaxisMatches.length > 0 ? 0.91 : 0.78,
      triggerTerms: [...anaphylaxisMatches, ...(hivesOrUrticaria ? ['urticaria'] : []), ...(wheezingMentioned ? ['wheeze'] : [])],
      metadata: { detection: 'anaphylaxis_constellation_v1' },
    });
  }

  // ── Zimbabwe / Africa-context disease signals ─────────────────────────────

  // Malaria (fever + rigors — very common in Zimbabwe)
  const malariaTerms = ['malaria', 'plasmodium', 'falciparum', 'positive rdts', 'positive malaria'];
  const malariaMatches = collectMatchingTerms(normalized, malariaTerms);
  const rigorsMentioned = /\b(rigor|chills and fever|shaking chills|teeth chattering|whole body shaking)\b/.test(normalized);
  if (malariaMatches.length > 0 || (feverMentioned && rigorsMentioned)) {
    drafts.push({
      alertType: 'malaria_signal',
      severity: malariaMatches.length > 0 ? 'high' : 'moderate',
      alertMessage: 'Possible malaria signal (fever + rigors or explicit malaria mention).',
      suggestedAction: 'Perform malaria RDT and thick/thin film urgently. If confirmed, start artemisinin-based combination therapy per national protocol.',
      confidence: malariaMatches.length > 0 ? 0.87 : 0.68,
      triggerTerms: [...malariaMatches, ...(rigorsMentioned ? ['rigors'] : [])],
      metadata: { detection: 'zimbabwe_malaria_v1' },
    });
  }

  // TB red flag — haemoptysis (blood in sputum)
  const haemoptysisMentioned = /\b(coughing blood|blood in sputum|haemoptysis|hemoptysis|bloody cough|spitting blood)\b/.test(normalized);
  if (haemoptysisMentioned) {
    drafts.push({
      alertType: 'haemoptysis_signal',
      severity: 'high',
      alertMessage: 'Haemoptysis reported — consider TB, lung cancer, or pulmonary embolism.',
      suggestedAction: 'Urgent chest X-ray, sputum AFB smear × 3, GeneXpert. Isolate if TB suspected. Rule out PE.',
      confidence: 0.89,
      triggerTerms: ['haemoptysis'],
      metadata: { detection: 'tb_red_flag_v1' },
    });
  }

  // Meningitis constellation (stiff neck + fever + photophobia/headache)
  const stiffNeckMentioned = /\b(stiff neck|neck stiffness|nuchal rigidity|kernig|brudzinski)\b/.test(normalized);
  const photophobiaMentioned = /\b(photophobia|sensitive to light|light hurts|can't stand light)\b/.test(normalized);
  const meningitisTerms = ['meningitis', 'meningococcal'];
  const meningitisMatches = collectMatchingTerms(normalized, meningitisTerms);
  if (meningitisMatches.length > 0 || (stiffNeckMentioned && feverMentioned)) {
    drafts.push({
      alertType: 'meningitis_signal',
      severity: 'critical',
      alertMessage: 'Possible meningitis signal (stiff neck + fever, or explicit meningitis mention).',
      suggestedAction: 'Urgent LP (if no papilloedema/focal neurology). Start IV ceftriaxone 2g immediately — do not delay for LP. CT head if indicated.',
      confidence: meningitisMatches.length > 0 ? 0.9 : (stiffNeckMentioned && photophobiaMentioned ? 0.82 : 0.71),
      triggerTerms: [...meningitisMatches, ...(stiffNeckMentioned ? ['stiff_neck'] : []), ...(photophobiaMentioned ? ['photophobia'] : [])],
      metadata: { detection: 'meningitis_constellation_v1' },
    });
  }

  // Eclampsia / pre-eclampsia (visual disturbance + headache + hypertension context — pregnancy)
  const visualDisturbanceMentioned = /\b(blurred vision|visual disturbance|seeing spots|flashing lights|cannot see properly)\b/.test(normalized);
  const severeHeadacheMentioned = /\b(severe headache|worst headache|thunderclap|splitting headache|headache 10|headache \d\/10)\b/.test(normalized);
  const pregnancyContext = /\b(pregnant|pregnancy|antenatal|gravida|weeks gestation|trimester)\b/.test(normalized);
  if (pregnancyContext && ((visualDisturbanceMentioned && severeHeadacheMentioned) || /\beclampsia\b/.test(normalized))) {
    drafts.push({
      alertType: 'eclampsia_signal',
      severity: 'critical',
      alertMessage: 'Possible eclampsia/pre-eclampsia signal in pregnant patient (severe headache + visual disturbance).',
      suggestedAction: 'BP + urine protein immediately. IV MgSO4 loading dose 4g over 15 min if seizure or imminent eclampsia. Antihypertensive if BP ≥160/110. Obstetric emergency team.',
      confidence: /\beclampsia\b/.test(normalized) ? 0.93 : 0.77,
      triggerTerms: [...(visualDisturbanceMentioned ? ['visual_disturbance'] : []), ...(severeHeadacheMentioned ? ['severe_headache'] : []), 'pregnancy_context'],
      metadata: { detection: 'eclampsia_constellation_v1' },
    });
  }

  // Cholera / severe AGE (severe vomiting + diarrhoea + dehydration)
  const choleraTerms = ['cholera', 'rice water stool', 'rice-water'];
  const choleraMatches = collectMatchingTerms(normalized, choleraTerms);
  const severeDehydrationMentioned = /\b(severely dehydrated|sunken eyes|skin turgor|rapid dehydration|profuse diarrhoea|watery diarrhoea|watery stool)\b/.test(normalized);
  if (choleraMatches.length > 0 || severeDehydrationMentioned) {
    drafts.push({
      alertType: 'severe_diarrhoeal_disease_signal',
      severity: choleraMatches.length > 0 ? 'critical' : 'high',
      alertMessage: 'Possible severe diarrhoeal disease / cholera signal.',
      suggestedAction: 'Assess dehydration severity (WHO scale). Aggressive ORS or IV Ringer\'s Lactate. Stool culture/RDT. Notify infection control. Isolate if cholera suspected.',
      confidence: choleraMatches.length > 0 ? 0.9 : 0.72,
      triggerTerms: [...choleraMatches, ...(severeDehydrationMentioned ? ['severe_dehydration'] : [])],
      metadata: { detection: 'cholera_diarrhoeal_v1' },
    });
  }

  return dedupeDrafts(fuseMultiSignalAlerts(drafts));
}

/**
 * When ≥2 distinct critical or high signal categories co-occur in the same pass,
 * add a 'multi_system_emergency' meta-alert to ensure escalation is not missed.
 */
function fuseMultiSignalAlerts(drafts: RealTimeAlertEngineDraft[]): RealTimeAlertEngineDraft[] {
  const highOrCritical = drafts.filter(d => d.severity === 'critical' || d.severity === 'high');
  const uniqueTypes = new Set(highOrCritical.map(d => d.alertType));
  if (uniqueTypes.size >= 2) {
    drafts.push({
      alertType: 'multi_system_emergency',
      severity: 'critical',
      alertMessage: `Multi-system emergency signals detected (${uniqueTypes.size} concurrent): ${Array.from(uniqueTypes).join(', ')}.`,
      suggestedAction: 'Activate emergency response team immediately. Do not manage alone — this presentation has multiple concurrent high-severity signals.',
      confidence: Math.min(0.99, 0.7 + uniqueTypes.size * 0.08),
      triggerTerms: Array.from(uniqueTypes),
      metadata: { signalCount: uniqueTypes.size, detection: 'multi_signal_fusion_v1' },
    });
  }
  return drafts;
}

/**
 * Analyse structured vitals and return alert drafts based on clinical thresholds.
 * Covers temperature, HR, RR, BP, SpO2, GCS, blood glucose, lactate, and NEWS2.
 */
export function analyseVitals(vitals: VitalsInput): RealTimeAlertEngineDraft[] {
  const drafts: RealTimeAlertEngineDraft[] = [];

  const { temperature, heartRate, respiratoryRate, systolicBp, diastolicBp, spo2, gcs, lactate, news2Score } = vitals;
  const bloodGlucose = vitals.bloodGlucose !== undefined && Number.isFinite(vitals.bloodGlucose)
    ? normalizeGlucoseToMmol(vitals.bloodGlucose)
    : undefined;

  // Temperature
  if (temperature !== undefined && Number.isFinite(temperature)) {
    if (temperature >= 40) {
      drafts.push({ alertType: 'hyperpyrexia', severity: 'critical', alertMessage: `Hyperpyrexia: temperature ${temperature}°C — risk of febrile seizure and end-organ damage.`, suggestedAction: 'Active cooling (tepid sponging, fan, antipyretics). Paracetamol IV/PR. Investigate for bacterial infection/malaria.', confidence: 0.95, metadata: { temperature } });
    } else if (temperature >= 38.5) {
      drafts.push({ alertType: 'high_fever', severity: 'high', alertMessage: `High fever: ${temperature}°C.`, suggestedAction: 'Antipyretics, blood cultures, malaria RDT. Assess for source of infection.', confidence: 0.88, metadata: { temperature } });
    } else if (temperature < 35) {
      drafts.push({ alertType: 'hypothermia', severity: 'critical', alertMessage: `Hypothermia: temperature ${temperature}°C.`, suggestedAction: 'Active rewarming. Consider sepsis, exposure, metabolic cause. Cardiac monitoring (risk of arrhythmia).', confidence: 0.94, metadata: { temperature } });
    }
  }

  // Heart rate
  if (heartRate !== undefined && Number.isFinite(heartRate)) {
    if (heartRate > 150) {
      drafts.push({ alertType: 'severe_tachycardia', severity: 'critical', alertMessage: `Severe tachycardia: HR ${heartRate} bpm.`, suggestedAction: 'ECG immediately. Assess haemodynamic stability. Rule out SVT, AF with rapid response, sepsis.', confidence: 0.93, metadata: { heartRate } });
    } else if (heartRate > 120) {
      drafts.push({ alertType: 'tachycardia', severity: 'high', alertMessage: `Significant tachycardia: HR ${heartRate} bpm.`, suggestedAction: 'Assess for fever, pain, hypovolaemia, anxiety, sepsis. ECG if new onset.', confidence: 0.85, metadata: { heartRate } });
    } else if (heartRate < 40) {
      drafts.push({ alertType: 'severe_bradycardia', severity: 'critical', alertMessage: `Severe bradycardia: HR ${heartRate} bpm.`, suggestedAction: 'Atropine 0.5 mg IV if symptomatic. ECG. Transcutaneous pacing if no response. Cardiology emergency.', confidence: 0.94, metadata: { heartRate } });
    } else if (heartRate < 50) {
      drafts.push({ alertType: 'bradycardia', severity: 'high', alertMessage: `Bradycardia: HR ${heartRate} bpm.`, suggestedAction: 'ECG. Review medications (beta-blockers, digoxin, amiodarone). Assess for symptoms (syncope, dizziness).', confidence: 0.86, metadata: { heartRate } });
    }
  }

  // Respiratory rate
  if (respiratoryRate !== undefined && Number.isFinite(respiratoryRate)) {
    if (respiratoryRate >= 30) {
      drafts.push({ alertType: 'severe_tachypnoea', severity: 'critical', alertMessage: `Severe tachypnoea: RR ${respiratoryRate}/min.`, suggestedAction: 'Urgent respiratory assessment. Consider pneumonia, pulmonary oedema, DKA, metabolic acidosis. SpO2, ABG.', confidence: 0.92, metadata: { respiratoryRate } });
    } else if (respiratoryRate >= 25) {
      drafts.push({ alertType: 'tachypnoea', severity: 'high', alertMessage: `Tachypnoea: RR ${respiratoryRate}/min.`, suggestedAction: 'Assess breathing effort and SpO2. Chest X-ray. Respiratory cause investigation.', confidence: 0.84, metadata: { respiratoryRate } });
    } else if (respiratoryRate <= 8) {
      drafts.push({ alertType: 'bradypnoea', severity: 'critical', alertMessage: `Bradypnoea/respiratory depression: RR ${respiratoryRate}/min.`, suggestedAction: 'Assess consciousness. Consider opioid toxicity (naloxone 0.4 mg IV). Airway support ready.', confidence: 0.92, metadata: { respiratoryRate } });
    }
  }

  // SpO2
  if (spo2 !== undefined && Number.isFinite(spo2)) {
    if (spo2 < 90) {
      drafts.push({ alertType: 'critical_hypoxia', severity: 'critical', alertMessage: `Critical hypoxia: SpO2 ${spo2}%.`, suggestedAction: 'High-flow O2 immediately. Consider non-rebreather mask or NIV. Urgent assessment — rule out pneumothorax, acute PE, severe pneumonia.', confidence: 0.96, metadata: { spo2 } });
    } else if (spo2 < 94) {
      drafts.push({ alertType: 'hypoxia', severity: 'high', alertMessage: `Hypoxia: SpO2 ${spo2}%.`, suggestedAction: 'Supplemental oxygen. Chest auscultation and X-ray. Assess for respiratory compromise.', confidence: 0.88, metadata: { spo2 } });
    }
  }

  // Systolic BP
  if (systolicBp !== undefined && Number.isFinite(systolicBp)) {
    const dbp = diastolicBp ?? 0;
    if (systolicBp >= 180 || dbp >= 120) {
      drafts.push({ alertType: 'hypertensive_crisis', severity: 'critical', alertMessage: `Hypertensive crisis: BP ${systolicBp}/${dbp} mmHg.`, suggestedAction: 'Assess for end-organ damage (headache, visual change, chest pain, dyspnoea). IV labetalol or hydralazine. Aim ≤25% reduction in first hour.', confidence: 0.94, metadata: { systolicBp, diastolicBp } });
    } else if (systolicBp >= 160 || dbp >= 100) {
      drafts.push({ alertType: 'severe_hypertension', severity: 'high', alertMessage: `Severe hypertension: BP ${systolicBp}/${dbp} mmHg.`, suggestedAction: 'Oral antihypertensive and close monitoring. Reassess in 30–60 min.', confidence: 0.86, metadata: { systolicBp, diastolicBp } });
    } else if (systolicBp < 90) {
      drafts.push({ alertType: 'hypotension', severity: 'critical', alertMessage: `Hypotension: SBP ${systolicBp} mmHg.`, suggestedAction: 'IV access. 500 mL crystalloid bolus. Assess for septic/cardiogenic/hypovolaemic shock. Vasopressors if not responding.', confidence: 0.93, metadata: { systolicBp, diastolicBp } });
    }
  }

  // GCS
  if (gcs !== undefined && Number.isFinite(gcs)) {
    if (gcs <= 8) {
      drafts.push({ alertType: 'severely_impaired_consciousness', severity: 'critical', alertMessage: `Severely impaired consciousness: GCS ${gcs}/15.`, suggestedAction: 'Protect airway (consider intubation). Fingerprick glucose. Naloxone if opioid suspected. CT head. Neurology/ICU input.', confidence: 0.97, metadata: { gcs } });
    } else if (gcs <= 12) {
      drafts.push({ alertType: 'impaired_consciousness', severity: 'high', alertMessage: `Impaired consciousness: GCS ${gcs}/15.`, suggestedAction: 'Continuous monitoring. Assess for metabolic cause (glucose, Na, Ca, renal). Neurological examination. Consider CT head.', confidence: 0.9, metadata: { gcs } });
    }
  }

  // Blood glucose
  if (bloodGlucose !== undefined && Number.isFinite(bloodGlucose)) {
    if (bloodGlucose < 2.8) {
      drafts.push({ alertType: 'severe_hypoglycaemia', severity: 'critical', alertMessage: `Severe hypoglycaemia: BGL ${bloodGlucose} mmol/L.`, suggestedAction: 'If conscious: 15–20g oral glucose. If unconscious: 50 mL 50% dextrose IV or 1 mg glucagon IM. Recheck in 15 min. Identify cause.', confidence: 0.97, metadata: { bloodGlucose } });
    } else if (bloodGlucose < 4.0) {
      drafts.push({ alertType: 'hypoglycaemia', severity: 'high', alertMessage: `Hypoglycaemia: BGL ${bloodGlucose} mmol/L.`, suggestedAction: 'Oral glucose 15–20g (if conscious). Recheck in 15 min. Review insulin/sulphonylurea dose.', confidence: 0.9, metadata: { bloodGlucose } });
    } else if (bloodGlucose > 25) {
      drafts.push({ alertType: 'severe_hyperglycaemia', severity: 'critical', alertMessage: `Severe hyperglycaemia: BGL ${bloodGlucose} mmol/L — DKA/HHS risk.`, suggestedAction: 'Urgent ketones (urine/blood). If DKA: IV fluid resuscitation, insulin infusion, potassium replacement. ICU or HDU.', confidence: 0.93, metadata: { bloodGlucose } });
    } else if (bloodGlucose > 14) {
      drafts.push({ alertType: 'hyperglycaemia', severity: 'high', alertMessage: `Significant hyperglycaemia: BGL ${bloodGlucose} mmol/L.`, suggestedAction: 'Check urine/blood ketones. Assess hydration and consciousness. Adjust insulin regime.', confidence: 0.85, metadata: { bloodGlucose } });
    }
  }

  // Lactate
  if (lactate !== undefined && Number.isFinite(lactate)) {
    if (lactate >= 4) {
      drafts.push({ alertType: 'severe_lactic_acidosis', severity: 'critical', alertMessage: `Severe hyperlactataemia: lactate ${lactate} mmol/L — indicates severe tissue hypoperfusion.`, suggestedAction: 'Hour-1 sepsis bundle. IV fluids. Source control. Vasopressors if MAP <65 after fluid resuscitation. ICU admission.', confidence: 0.95, metadata: { lactate } });
    } else if (lactate >= 2) {
      drafts.push({ alertType: 'elevated_lactate', severity: 'high', alertMessage: `Elevated lactate: ${lactate} mmol/L — occult hypoperfusion or early sepsis.`, suggestedAction: 'Repeat lactate after 2h of IV fluids. Blood cultures. Consider early antibiotics and sepsis workup.', confidence: 0.87, metadata: { lactate } });
    }
  }

  // Pre-computed NEWS2 score
  if (news2Score !== undefined && Number.isFinite(news2Score)) {
    if (news2Score >= 7) {
      drafts.push({ alertType: 'news2_high_risk', severity: 'critical', alertMessage: `NEWS2 score ${news2Score} — HIGH clinical risk. Urgent response required.`, suggestedAction: 'Continuous monitoring. Emergency assessment by doctor. Consider ICU/HDU. Implement NEWS2 high-risk response protocol.', confidence: 0.96, metadata: { news2Score } });
    } else if (news2Score >= 5) {
      drafts.push({ alertType: 'news2_medium_risk', severity: 'high', alertMessage: `NEWS2 score ${news2Score} — MEDIUM clinical risk.`, suggestedAction: 'Urgent medical review within 30 minutes. Increase monitoring frequency to every 30 min.', confidence: 0.9, metadata: { news2Score } });
    }
  }

  return dedupeDrafts(fuseMultiSignalAlerts(drafts));
}

/**
 * Unified entry point — run both transcript and vitals analysis in one call.
 */
export function analyse(input: { text?: string; vitals?: VitalsInput }): RealTimeAlertEngineDraft[] {
  const transcriptAlerts = input.text ? detectFromTranscript(input.text) : [];
  const vitalsAlerts = input.vitals ? analyseVitals(input.vitals) : [];
  const combined = dedupeDrafts(fuseMultiSignalAlerts([...transcriptAlerts, ...vitalsAlerts]));
  return combined;
}
