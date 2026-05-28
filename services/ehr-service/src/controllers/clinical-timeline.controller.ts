import { Controller, Get, Post, Param, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { ClinicalTimelineService } from '../services/clinical-timeline.service';

@UseGuards(JwtAuthGuard)
@Controller('patients')
export class ClinicalTimelineController {
  constructor(private readonly timeline: ClinicalTimelineService) {}

  @Get(':patientId/ai-timeline')
  async getTimeline(@Param('patientId') patientId: string, @Req() req: any): Promise<unknown> {
    let tl = await this.timeline.getTimeline(patientId, req.tenantDb);
    if (!tl) {
      tl = await this.timeline.generateTimeline(patientId, req.tenantDb);
    }
    return tl;
  }

  @Post(':patientId/ai-timeline/regenerate')
  async regenerate(@Param('patientId') patientId: string, @Req() req: any): Promise<unknown> {
    return this.timeline.generateTimeline(patientId, req.tenantDb);
  }
}
