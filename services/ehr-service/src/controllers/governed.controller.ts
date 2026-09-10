import { Body, Controller, Post, Request, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { CdssService } from '../services/cdss.service';
import { RequestWithTenant } from '../middleware/tenant.middleware';

interface NcdCrisisProtocol {
  steps: string[];
  urgency: 'immediate' | 'urgent' | 'routine';
  notes: string;
}

// WHO-aligned point-of-care protocols for nurse-facing NCD crisis documentation.
// Static/deterministic by design — these are standing clinical protocols, not
// per-patient AI inference, so no external model call is needed.
const NCD_CRISIS_PROTOCOLS: Record<string, NcdCrisisProtocol> = {
  scd_voc: {
    urgency: 'urgent',
    steps: [
      'Administer rapid-acting analgesia (opioid per WHO pain ladder) within 30 minutes of triage',
      'Reassess pain score every 30 minutes until controlled',
      'Start aggressive oral/IV hydration at maintenance plus replacement rate',
      'Apply warmth to affected sites — avoid cold compresses',
      'Screen for precipitating triggers: infection, dehydration, cold exposure, hypoxia',
      'Monitor SpO2 continuously; give supplemental O2 if SpO2 < 95%',
      'Escalate to acute chest syndrome workup if new respiratory symptoms develop',
    ],
    notes: 'Vaso-occlusive crisis. Escalate to immediate if pain uncontrolled after two analgesia doses or vitals deteriorate.',
  },
  scd_acs: {
    urgency: 'immediate',
    steps: [
      'Treat as a medical emergency — notify the physician or on-call immediately',
      'Give supplemental O2 to maintain SpO2 ≥ 95%',
      'Obtain chest X-ray and blood cultures; start empiric antibiotics covering atypicals',
      'Incentive spirometry every 2 hours while awake',
      'Consider simple or exchange transfusion per haematology protocol',
      'Give IV fluids cautiously — avoid overload; monitor fluid balance closely',
      'Continuous cardiorespiratory monitoring',
    ],
    notes: 'Acute chest syndrome carries high mortality risk — do not delay escalation while awaiting imaging.',
  },
  epilepsy_seizure: {
    urgency: 'immediate',
    steps: [
      'Time the seizure from onset — if ≥5 minutes, treat as status epilepticus and give a benzodiazepine per protocol',
      'Protect the airway — recovery position; do not restrain or insert anything in the mouth',
      'Clear nearby hazards and cushion the head',
      'Give O2 if SpO2 < 94% or cyanosis is present',
      'Check capillary blood glucose and correct hypoglycaemia if present',
      'Record seizure semiology, duration, and post-ictal state',
      'If AED-naive or a breakthrough seizure on therapy, review adherence and consider drug levels',
    ],
    notes: 'Status epilepticus (≥5 min or recurrent without recovery) is a medical emergency — escalate immediately.',
  },
  htn_crisis: {
    urgency: 'immediate',
    steps: [
      'Confirm BP ≥ 180/120 mmHg on repeat measurement with a correctly sized cuff',
      'Assess for end-organ damage: neuro status, chest pain, visual changes, renal function',
      'If encephalopathy, papilloedema, AKI, or ACS present: start IV antihypertensive therapy and admit (hypertensive emergency)',
      'If no end-organ damage: start oral antihypertensive and lower BP gradually over 24–48 hours (hypertensive urgency)',
      'Avoid dropping BP more than 25% in the first hour — risk of ischaemic injury',
      'Recheck BP every 15–30 minutes during treatment',
    ],
    notes: 'Distinguish hypertensive emergency from urgency before choosing the rate of BP correction.',
  },
  diabetic_emergency: {
    urgency: 'immediate',
    steps: [
      'Check capillary glucose and ketones immediately',
      'If glucose < 3.9 mmol/L (70 mg/dL): give 15–20 g fast-acting glucose, recheck in 15 minutes',
      'If DKA suspected (high glucose, ketones positive, acidosis): start IV fluids and insulin infusion, monitor potassium hourly',
      'If HHS suspected (very high glucose, minimal ketosis, altered mental status): resuscitate cautiously and correct hyperosmolarity slowly',
      'Monitor vital signs, consciousness level, and urine output closely',
      'Identify the precipitating cause — infection, missed insulin, intercurrent illness',
    ],
    notes: 'Correct DKA/HHS gradually — rapid glucose or fluid correction risks cerebral oedema.',
  },
  ncd_complication: {
    urgency: 'urgent',
    steps: [
      'Document complication type, severity, and relevant measurements',
      'Assess for acute threat to limb, vision, or renal function requiring same-day referral',
      'Refer to the appropriate specialty (podiatry, ophthalmology, nephrology, cardiology) per severity',
      'Review and optimise glycaemic and blood pressure control',
      'Schedule follow-up per severity — urgent complications within 48–72 hours, routine within 4 weeks',
    ],
    notes: 'Severity drives referral urgency — treat SEVERE findings as same-day referrals.',
  },
};

/**
 * Governed JSON routing hub.
 *
 * Mobile CDSS service calls POST /governed/json with a `surface` field.
 * This controller routes each surface to the appropriate CdssService method
 * and returns a uniform { result, abstained } envelope.
 *
 * All surfaces are safe: they catch errors internally and return abstained
 * responses rather than throwing, keeping mobile UI safe.
 */
@ApiTags('Governed AI')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('governed')
export class GovernedController {
  constructor(private readonly cdssService: CdssService) {}

  @Post('json')
  @ApiOperation({ summary: 'Governed AI routing hub for mobile CDSS surfaces' })
  async govJson(
    @Body() body: { surface: string; task?: string; payload: any; governance?: any },
    @Request() req: RequestWithTenant,
  ) {
    const { surface, payload } = body;
    const tenantId = req.tenantId ?? 'default';
    const tenantDb = req.tenantDb;

    try {
      switch (surface) {
        // ── Nurse / Ward ─────────────────────────────────────────────────
        case 'sbar_generation': {
          const raw = await this.cdssService.generateSBAR(payload, tenantId);
          if (!raw || raw.abstained) return { abstained: true };
          // Normalise to { S, B, A, R } that mobile expects
          const sbar = raw.sbar ?? raw;
          return {
            result: {
              sbar: {
                S: sbar.situation ?? sbar.S ?? '',
                B: sbar.background ?? sbar.B ?? '',
                A: sbar.assessment ?? sbar.A ?? '',
                R: sbar.recommendation ?? sbar.R ?? '',
              },
            },
          };
        }

        case 'fall_risk_assessment': {
          const raw = await this.cdssService.assessFallRisk(payload, tenantId);
          if (!raw || raw.abstained) return { abstained: true };
          return {
            result: {
              risk_level: raw.risk_level ?? raw.riskLevel ?? 'LOW',
              score: raw.score ?? 0,
              factors: raw.factors ?? [],
              interventions: raw.interventions ?? raw.recommendations ?? [],
            },
          };
        }

        case 'medication_reconciliation': {
          const raw = await this.cdssService.reconcileMedications(payload, tenantId);
          if (!raw || raw.abstained) return { abstained: true };
          return {
            result: {
              duplicates: raw.duplicates ?? [],
              interactions: raw.interactions ?? [],
              omissions: raw.omissions ?? [],
              recommendations: raw.recommendations ?? [],
            },
          };
        }

        case 'nurse_shift_summary': {
          const raw: any = await this.cdssService.generateNurseHandoffSummary(payload, tenantId, tenantDb);
          if (!raw || raw.abstained) return { abstained: true };
          return {
            result: {
              summary: raw.summary ?? raw.handoff_summary ?? '',
              criticalCount: raw.criticalCount ?? raw.critical_count ?? 0,
              pendingActions: raw.pendingActions ?? raw.pending_actions ?? [],
              confidence: raw.confidence ?? 0.8,
              abstained: false,
            },
          };
        }

        // ── Doctor / Clinical ─────────────────────────────────────────────
        case 'dose_calculator': {
          const raw = await this.cdssService.getDosingRecommendation(payload);
          if (!raw || raw.abstained) return { abstained: true };
          return {
            result: {
              recommendation: raw.recommendation ?? '',
              dose: raw.dose ?? raw.recommended_dose ?? '',
              route: raw.route ?? '',
              frequency: raw.frequency ?? '',
              adjustments: raw.adjustments ?? raw.special_considerations ?? [],
              confidence: raw.confidence ?? 0.8,
              citations: raw.citations ?? [],
              abstained: false,
            },
          };
        }

        case 'clinical_risk_score': {
          const raw = await this.cdssService.diagnosisAssist(payload, false, tenantId, tenantDb);
          if (!raw || raw.abstained) return { abstained: true };
          return {
            result: {
              score: raw.score ?? null,
              interpretation: raw.interpretation ?? payload.description ?? '',
              recommendations: raw.recommendations ?? [],
              confidence: raw.confidence ?? 0,
              citations: raw.citations ?? [],
              abstained: false,
            },
          };
        }

        case 'diagnosis_mobile': {
          const raw = await this.cdssService.diagnosisAssist(payload?.symptoms ?? payload, true, tenantId, tenantDb);
          if (!raw || raw.abstained) return { abstained: true };
          return {
            result: {
              differentials: raw.differentials ?? raw.differential_diagnoses ?? [],
              confidence: raw.confidence ?? 0,
              abstained: false,
            },
          };
        }

        case 'lab_interpretation_mobile': {
          const raw = await this.cdssService.interpretLabResults(payload);
          if (!raw || raw.abstained) return { abstained: true };
          return {
            result: {
              interpretation: raw.interpretation ?? '',
              severity: raw.severity ?? 'unknown',
              trend: raw.trend ?? '',
              action: raw.action ?? raw.recommended_action ?? '',
              confidence: raw.confidence ?? 0,
              abstained: false,
            },
          };
        }

        case 'ncd_crisis_protocol': {
          const crisisType = String(payload?.crisis_type ?? '');
          const protocol = NCD_CRISIS_PROTOCOLS[crisisType];
          if (!protocol) return { abstained: true, reason: `Unknown crisis type: ${crisisType}` };
          return {
            result: {
              steps: protocol.steps,
              urgency: protocol.urgency,
              notes: protocol.notes,
              abstained: false,
            },
          };
        }

        default:
          return { abstained: true, reason: `Unknown surface: ${surface}` };
      }
    } catch {
      return { abstained: true, reason: 'Internal error — manual review required' };
    }
  }
}
