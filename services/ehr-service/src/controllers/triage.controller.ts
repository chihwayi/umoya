import { UseGuards, Controller, Post, Get, Body, Param, Req } from '@nestjs/common';
import { TriageService } from '../services/triage.service';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';

@Controller('triage')
@UseGuards(JwtAuthGuard)
export class TriageController {
  constructor(private readonly triageService: TriageService) {}

  @Post()
  async record(@Body() body: any, @Req() req: any) {
    const tenantId = req.tenantId;
    const saved = await this.triageService.recordAssessment(body, tenantId);
    return { success: true, assessment: saved };
  }

  @Get('patient/:patientId')
  async getByPatient(@Param('patientId') patientId: string, @Req() req: any) {
    const tenantId = req.tenantId;
    const assessments = await this.triageService.getByPatient(patientId, tenantId);
    return { assessments, total: assessments.length };
  }

  @Post('cdss/sats-score')
  satsScore(@Body() body: any) {
    return this.triageService.satsScore(body);
  }

  @Post('cdss/news-score')
  newsScore(@Body() body: any) {
    return this.triageService.newsScore(body);
  }

  @Post('cdss/code-blue')
  codeBlue(@Body() body: any) {
    return this.triageService.codeBlueProtocol(body);
  }
}


