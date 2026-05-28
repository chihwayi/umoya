import { Controller, Get, Post, Param, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { PatientJwtAuthGuard } from '../guards/patient-jwt-auth.guard';
import { LabAiNarrativeService } from '../services/lab-ai-narrative.service';

@Controller('labs')
export class LabNarrativeController {
  constructor(private readonly narrativeSvc: LabAiNarrativeService) {}

  @UseGuards(JwtAuthGuard)
  @Get('results/:resultId/narrative')
  async getNarrative(
    @Param('resultId') resultId: string,
    @Req() req: any,
  ): Promise<unknown> {
    let narrative = await this.narrativeSvc.getNarrative(resultId, req.tenantDb);
    if (!narrative) {
      const results = await req.tenantDb.query(
        `SELECT patient_id FROM lab_results WHERE id = $1`,
        [resultId],
      );
      if (results.length > 0) {
        narrative = await this.narrativeSvc.generateNarrative(
          resultId,
          results[0].patient_id,
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
    const results = await req.tenantDb.query(
      `SELECT patient_id FROM lab_results WHERE id = $1`,
      [resultId],
    );
    if (!results.length) return { error: 'Result not found' };
    return this.narrativeSvc.generateNarrative(
      resultId,
      results[0].patient_id,
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
    const narrative: any = await this.narrativeSvc.getNarrative(resultId, req.tenantDb);
    return {
      patientNarrative: narrative?.patient_narrative ?? 'Interpretation pending.',
      hasCriticalValue: narrative?.has_critical_value ?? false,
    };
  }
}
