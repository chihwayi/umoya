import { Controller, Get, Post, Patch, Body, Param, Query, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { PatientSafetyIncidentService } from '../services/patient-safety-incident.service';

@UseGuards(JwtAuthGuard)
@Controller('patient-safety/incidents')
export class PatientSafetyIncidentController {
  constructor(private readonly svc: PatientSafetyIncidentService) {}

  @Post()
  reportIncident(@Req() req: any, @Body() body: any) {
    return this.svc.reportIncident(req.tenantDb, req.tenantId, req.user.id, body);
  }

  @Get()
  listIncidents(@Req() req: any, @Query() query: any) {
    return this.svc.listIncidents(req.tenantDb, req.tenantId, query);
  }

  @Get('dashboard')
  getDashboard(@Req() req: any, @Query('since') since?: string) {
    return this.svc.getDashboard(req.tenantDb, req.tenantId, since);
  }

  @Get(':id')
  getIncident(@Req() req: any, @Param('id') id: string) {
    return this.svc.getIncident(req.tenantDb, req.tenantId, id);
  }

  @Patch(':id/status')
  updateStatus(@Req() req: any, @Param('id') id: string, @Body() body: { status: string }) {
    return this.svc.updateIncidentStatus(req.tenantDb, req.tenantId, id, body.status);
  }

  @Patch(':id/close')
  closeIncident(@Req() req: any, @Param('id') id: string) {
    return this.svc.closeIncident(req.tenantDb, req.tenantId, id);
  }

  @Post(':id/rca')
  startRca(@Req() req: any, @Param('id') id: string, @Body() body: any) {
    return this.svc.startRca(req.tenantDb, req.tenantId, id, { ...body, conductedBy: body.conductedBy ?? req.user.id });
  }

  @Patch('rca/:rcaId')
  updateRca(@Req() req: any, @Param('rcaId') rcaId: string, @Body() body: any) {
    return this.svc.updateRca(req.tenantDb, req.tenantId, rcaId, body);
  }

  @Post(':id/corrective-actions')
  addCorrectiveAction(@Req() req: any, @Param('id') id: string, @Body() body: any) {
    return this.svc.addCorrectiveAction(req.tenantDb, req.tenantId, id, body);
  }

  @Patch('corrective-actions/:actionId')
  updateCorrectiveAction(@Req() req: any, @Param('actionId') actionId: string, @Body() body: any) {
    return this.svc.updateCorrectiveAction(req.tenantDb, req.tenantId, actionId, {
      ...body,
      completedBy: body.completedBy ?? (body.status === 'completed' ? req.user.id : undefined),
    });
  }
}
