import { Controller, Get, Post, Param, Body, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { ClinicalSummaryService } from '../services/clinical-summary.service';

@UseGuards(JwtAuthGuard)
@Controller('patients')
export class ClinicalSummaryController {
  constructor(private readonly summaryService: ClinicalSummaryService) {}

  @Get(':patientId/clinical-summary')
  async getSummary(
    @Param('patientId') patientId: string,
    @Req() req: any,
  ): Promise<unknown> {
    let summary = await this.summaryService.getSummary(patientId, req.tenantDb);
    if (!summary) summary = await this.summaryService.generateSummary(patientId, req.tenantDb);
    return summary;
  }

  @Post(':patientId/clinical-summary/regenerate')
  async regenerate(
    @Param('patientId') patientId: string,
    @Req() req: any,
  ): Promise<unknown> {
    return this.summaryService.generateSummary(patientId, req.tenantDb);
  }

  @Post(':patientId/clinical-summary/feedback')
  async feedback(
    @Param('patientId') patientId: string,
    @Body() body: { positive: boolean },
    @Req() req: any,
  ): Promise<{ ok: boolean }> {
    await this.summaryService.submitFeedback(patientId, body.positive, req.tenantDb);
    return { ok: true };
  }
}
