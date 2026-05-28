import {
  Controller, Get, Post, Patch, Param, Body, Req, UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { RadiologyAiService } from '../services/radiology-ai.service';

@UseGuards(JwtAuthGuard)
@Controller('radiology')
export class RadiologyReviewController {
  constructor(private readonly radiologyAi: RadiologyAiService) {}

  @Post('studies/:studyId/analyse')
  async analyseStudy(
    @Param('studyId') studyId: string,
    @Body() body: { patientId: string; modality?: string; bodyPart?: string },
    @Req() req: any,
  ): Promise<unknown> {
    return this.radiologyAi.analyseStudyWithDb(
      studyId,
      body.patientId,
      req.user.sub,
      req.tenantDb,
      req.tenantSubdomain ?? '',
      { modality: body.modality, bodyPart: body.bodyPart },
    );
  }

  @Get('studies/:studyId/ai-findings')
  async getFindings(
    @Param('studyId') studyId: string,
    @Req() req: any,
  ): Promise<unknown> {
    return this.radiologyAi.getFindingsByStudyId(studyId, req.tenantDb);
  }

  @Patch('ai-findings/:findingId/review')
  async reviewFinding(
    @Param('findingId') findingId: string,
    @Body() body: { status: 'confirmed' | 'rejected' | 'needs_review'; comment?: string },
    @Req() req: any,
  ): Promise<unknown> {
    return this.radiologyAi.reviewFindingById(
      findingId,
      req.user.sub,
      body.status,
      body.comment,
      req.tenantDb,
    );
  }

  @Get('patients/:patientId/history')
  async getHistory(
    @Param('patientId') patientId: string,
    @Req() req: any,
  ): Promise<unknown[]> {
    return this.radiologyAi.getPatientRadiologyAiHistory(patientId, req.tenantDb);
  }
}
