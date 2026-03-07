/**
 * RealTimeAlertEngine — stream partial transcript processing for intra-visit safety alerts.
 * Detects allergy, medication reaction, dose/vitals, and emergency signals from live transcript chunks.
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

  return dedupeDrafts(drafts);
}
