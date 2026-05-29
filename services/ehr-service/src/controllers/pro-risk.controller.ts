import { Controller, Get, Patch, Param, Query, Req } from '@nestjs/common';
import { ProRiskLoopService } from '../services/pro-risk-loop.service';

@Controller('risk')
export class ProRiskController {
  constructor(private readonly loop: ProRiskLoopService) {}

  @Get('patients/high-risk')
  getHighRisk(@Req() req: any, @Query('minScore') min?: string) {
    return this.loop.getHighRiskPatients(req.tenantDb, min ? +min : 70);
  }

  @Get('patients/:patientId/history')
  getHistory(
    @Req() req: any,
    @Param('patientId') id: string,
    @Query('days') days?: string,
  ) {
    return this.loop.getScoreHistory(req.tenantDb, id, days ? +days : 30);
  }

  @Get('outreach-tasks')
  getTasks(@Req() req: any, @Query('assignedTo') assignedTo?: string) {
    return this.loop.getPendingOutreachTasks(req.tenantDb, assignedTo);
  }

  @Patch('outreach-tasks/:id/complete')
  completeTask(@Req() req: any, @Param('id') id: string) {
    return this.loop.completeOutreachTask(req.tenantDb, id);
  }
}
