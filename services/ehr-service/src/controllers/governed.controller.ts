import { Body, Controller, Post, Request, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { CdssService } from '../services/cdss.service';
import { RequestWithTenant } from '../middleware/tenant.middleware';

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

        default:
          return { abstained: true, reason: `Unknown surface: ${surface}` };
      }
    } catch {
      return { abstained: true, reason: 'Internal error — manual review required' };
    }
  }
}
