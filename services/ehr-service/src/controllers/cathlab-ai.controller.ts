import { Controller, Get, Post, Body, Param, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { CathLabAiService } from '../services/cathlab-ai.service';

@UseGuards(JwtAuthGuard)
@Controller('cathlab/ai')
export class CathLabAiController {
  constructor(private readonly svc: CathLabAiService) {}

  @Post('ecg-interpretation')
  recordEcgInterpretation(
    @Req() req: any,
    @Body() body: {
      caseId: string; patientId: string; leadsAffected: string[];
      maxStElevMm: number; territory?: string; sgarbossaScore?: number;
      aiImpression?: string; aiConfidence?: number;
    },
  ) {
    return this.svc.recordEcgInterpretation(req.tenantDb, req.user.id, body);
  }

  @Post('contrast-risk')
  computeContrastRisk(
    @Req() req: any,
    @Body() body: {
      caseId: string; patientId: string;
      hypotension: boolean; iabpUse: boolean; chfPresent: boolean; ageGt75: boolean;
      anaemia: boolean; diabetes: boolean;
      contrastVolumeMl?: number; creatinineUmolL?: number; egfrMlMin?: number;
    },
  ) {
    return this.svc.computeContrastRisk(req.tenantDb, body);
  }

  @Post('dapt-recommendation')
  createDaptRecommendation(
    @Req() req: any,
    @Body() body: {
      caseId: string; patientId: string; stentType: string; indication: string;
      daptScore?: number; bleedingRiskHigh?: boolean;
      currentMedications?: string[];
    },
  ) {
    return this.svc.createDaptRecommendation(req.tenantDb, req.user.id, body);
  }

  @Post('syntax-score')
  recordSyntaxScore(
    @Req() req: any,
    @Body() body: { caseId: string; syntaxScore: number; syntaxIiScore?: number },
  ) {
    return this.svc.recordSyntaxScore(req.tenantDb, req.user.id, body);
  }

  @Get('quality-metrics')
  getQualityMetrics(@Req() req: any) {
    return this.svc.getQualityMetrics(req.tenantDb);
  }

  @Get('case/:caseId/summary')
  getCaseSummary(@Req() req: any, @Param('caseId') caseId: string) {
    return this.svc.getCaseAiSummary(req.tenantDb, caseId);
  }
}
