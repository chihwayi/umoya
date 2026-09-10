import { Controller, Get, Post, Param, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { PatientJwtAuthGuard } from '../guards/patient-jwt-auth.guard';
import { LabAiNarrativeService } from '../services/lab-ai-narrative.service';
import { LabOrderService } from '../services/lab-order.service';

@Controller('labs')
export class LabNarrativeController {
  constructor(
    private readonly narrativeSvc: LabAiNarrativeService,
    private readonly labOrderService: LabOrderService,
  ) {}

  @UseGuards(JwtAuthGuard)
  @Get('results/:resultId/narrative')
  async getNarrative(
    @Param('resultId') resultId: string,
    @Req() req: any,
  ): Promise<unknown> {
    let narrative = await this.narrativeSvc.getNarrative(resultId, req.tenantDb);
    if (!narrative) {
      const match = await this.labOrderService.findByResultId(resultId, req.tenantDb);
      if (match) {
        narrative = await this.narrativeSvc.generateNarrative(
          resultId,
          match.order.patientId,
          req.tenantDb,
          req.tenantSubdomain ?? '',
        );
      }
    }
    return narrative;
  }

  @UseGuards(JwtAuthGuard)
  @Post('results/:resultId/regenerate-narrative')
  async regenerate(
    @Param('resultId') resultId: string,
    @Req() req: any,
  ): Promise<unknown> {
    const match = await this.labOrderService.findByResultId(resultId, req.tenantDb);
    if (!match) return { error: 'Result not found' };
    return this.narrativeSvc.generateNarrative(
      resultId,
      match.order.patientId,
      req.tenantDb,
      req.tenantSubdomain ?? '',
    );
  }

  @UseGuards(PatientJwtAuthGuard)
  @Get('patient/results/:resultId/narrative')
  async getPatientNarrative(
    @Param('resultId') resultId: string,
    @Req() req: any,
  ): Promise<{ patientNarrative: string; hasCriticalValue: boolean }> {
    const match = await this.labOrderService.findByResultId(resultId, req.tenantDb);
    if (!match || match.order.patientId !== req.patientId) {
      return { patientNarrative: 'Interpretation pending.', hasCriticalValue: false };
    }

    let narrative: any = await this.narrativeSvc.getNarrative(resultId, req.tenantDb);
    if (!narrative) {
      narrative = await this.narrativeSvc.generateNarrative(
        resultId,
        match.order.patientId,
        req.tenantDb,
        req.tenantSubdomain ?? '',
      );
    }
    return {
      patientNarrative: narrative?.patient_narrative ?? 'Interpretation pending.',
      hasCriticalValue: narrative?.has_critical_value ?? false,
    };
  }
}
