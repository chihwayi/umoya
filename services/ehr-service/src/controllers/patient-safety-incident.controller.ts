import { Controller, Get, Post, Patch, Body, Param, Query, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { RolesGuard } from '../guards/roles.guard';
import { Roles } from '../decorators/roles.decorator';
import { PatientSafetyIncidentService } from '../services/patient-safety-incident.service';

// Reporting an incident stays open to any authenticated staff member — any
// role should be able to report a safety concern, and restricting who can
// file one is its own anti-pattern. The review/closure/RCA workflow that
// follows is admin-only, since any staff account could previously close an
// incident or complete a root-cause analysis with no oversight.
@UseGuards(JwtAuthGuard, RolesGuard)
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
  @Roles('admin', 'doctor')
  updateStatus(@Req() req: any, @Param('id') id: string, @Body() body: { status: string }) {
    return this.svc.updateIncidentStatus(req.tenantDb, req.tenantId, id, body.status);
  }

  @Patch(':id/close')
  @Roles('admin', 'doctor')
  closeIncident(@Req() req: any, @Param('id') id: string) {
    return this.svc.closeIncident(req.tenantDb, req.tenantId, id);
  }

  @Post(':id/rca')
  @Roles('admin', 'doctor')
  startRca(@Req() req: any, @Param('id') id: string, @Body() body: any) {
    return this.svc.startRca(req.tenantDb, req.tenantId, id, { ...body, conductedBy: body.conductedBy ?? req.user.id });
  }

  @Patch('rca/:rcaId')
  @Roles('admin', 'doctor')
  updateRca(@Req() req: any, @Param('rcaId') rcaId: string, @Body() body: any) {
    return this.svc.updateRca(req.tenantDb, req.tenantId, rcaId, body);
  }

  @Post(':id/corrective-actions')
  @Roles('admin', 'doctor')
  addCorrectiveAction(@Req() req: any, @Param('id') id: string, @Body() body: any) {
    return this.svc.addCorrectiveAction(req.tenantDb, req.tenantId, id, body);
  }

  @Patch('corrective-actions/:actionId')
  @Roles('admin', 'doctor')
  updateCorrectiveAction(@Req() req: any, @Param('actionId') actionId: string, @Body() body: any) {
    return this.svc.updateCorrectiveAction(req.tenantDb, req.tenantId, actionId, {
      ...body,
      completedBy: body.completedBy ?? (body.status === 'completed' ? req.user.id : undefined),
    });
  }
}
